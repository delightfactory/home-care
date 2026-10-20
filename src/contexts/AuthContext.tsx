import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { User as AppUser } from '../types'
import { CacheManager } from '../utils/query-cache'

interface AuthContextType {
  user: AppUser | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<AppUser>) => Promise<{ error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const currentUserId = useRef<string | null>(null)
  const authRevision = useRef(0)
  const setScopedUser = (profile: AppUser | null, revision = authRevision.current) => {
    if (revision !== authRevision.current) return
    if (profile && profile.id !== currentUserId.current) return
    const permissions = (profile as { role?: { permissions?: unknown } } | null)?.role?.permissions
    CacheManager.setProfileScope(JSON.stringify([profile?.id, profile?.role_id, permissions, profile?.is_active]))
    setUser(profile)
  }

  useEffect(() => {
    let isMounted = true

    // Get initial session
    const getInitialSession = async () => {
      try {
        const initialRevision = authRevision.current
        const { data: { session } } = await supabase.auth.getSession()

        if (!isMounted || initialRevision !== authRevision.current) return

        currentUserId.current = session?.user.id ?? null
        setSession(session)
        // ابدأ جلب الملف التعريفي في الخلفية بدون انتظار
        if (session?.user) {
          fetchUserProfile(session.user)
        }
        // لا نمنع واجهة المستخدم من التحميل
        if (isMounted) setLoading(false)
      } catch (error) {
        console.error('Error getting initial session:', error)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        authRevision.current++
        currentUserId.current = session?.user.id ?? null
        console.log('Auth state change:', event, session?.user?.email)

        setSession(session)

        if (session?.user) {
          fetchUserProfile(session.user)
        } else {
          setScopedUser(null)
        }

        if (isMounted) {
          setLoading(false)
        }
      }
    )

    return () => {
      isMounted = false
      authRevision.current++
      currentUserId.current = null
      subscription.unsubscribe()
    }
  }, [])

  const fetchUserProfile = async (authUser: User, retryCount = 0, revision = authRevision.current): Promise<void> => {
    if (authUser.id !== currentUserId.current || revision !== authRevision.current) return
    const MAX_RETRIES = 2  // تقليل عدد المحاولات لتسريع الفشل
    const RETRY_DELAY = 300 // تقليل التأخير من 500ms إلى 300ms

    try {
      // جلب الملف الشخصي مع timeout معقول
      let profileDeadline: ReturnType<typeof setTimeout> | undefined
      const timeoutPromise = new Promise((_, reject) =>
        profileDeadline = setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
      )

      const fetchPromise = supabase
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('id', authUser.id)
        .single()

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise])
        .finally(() => clearTimeout(profileDeadline)) as any
      if (authUser.id !== currentUserId.current || revision !== authRevision.current) return

      if (error) {
        console.warn(`User profile fetch attempt ${retryCount + 1} failed:`, error.message)

        // إعادة المحاولة مع تأخير بسيط
        if (retryCount < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          return fetchUserProfile(authUser, retryCount + 1, revision)
        }

        // بعد استنفاد المحاولات: استخدم RPC مباشرة
        console.log('All retries exhausted, trying final RPC fallback...')
        const { data: roleName } = await supabase.rpc('get_current_user_role')
        if (authUser.id !== currentUserId.current || revision !== authRevision.current) return

        const fallbackUser = {
          id: authUser.id,
          full_name: authUser.email?.split('@')[0] || 'مستخدم',
          phone: null,
          role_id: null,
          role: {
            name: roleName || 'pending',
            name_ar: roleName === 'technician' ? 'فني' :
              roleName === 'team_leader' ? 'قائد فريق' :
                roleName === 'manager' ? 'المدير العام' :
                  roleName === 'pending' ? 'قيد المراجعة' : 'مستخدم',
            permissions: {}
          },
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        console.log('Using fallback with role from RPC:', roleName)
        setScopedUser(fallbackUser as any, revision)
        return
      }

      setScopedUser(data, revision)
    } catch (error) {
      if (authUser.id !== currentUserId.current || revision !== authRevision.current) return
      console.warn('Error fetching user profile:', error)

      // retry بسرعة
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
        return fetchUserProfile(authUser, retryCount + 1, revision)
      }

      // fallback نهائي
      try {
        const { data: roleName } = await supabase.rpc('get_current_user_role')
        if (authUser.id !== currentUserId.current || revision !== authRevision.current) return
        const fallbackUser = {
          id: authUser.id,
          full_name: authUser.email?.split('@')[0] || 'مستخدم',
          phone: null,
          role_id: null,
          role: {
            name: roleName || 'pending',
            name_ar: roleName === 'technician' ? 'فني' :
              roleName === 'team_leader' ? 'قائد فريق' :
                roleName === 'manager' ? 'المدير العام' :
                  roleName === 'pending' ? 'قيد المراجعة' : 'مستخدم',
            permissions: {}
          },
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        setScopedUser(fallbackUser as any, revision)
      } catch (rpcError) {
        if (authUser.id !== currentUserId.current || revision !== authRevision.current) return
        console.error('RPC fallback also failed:', rpcError)
        // أمان: تسجيل خروج إجباري - لا نسمح بمستخدم بدون دور متحقق منه
        console.warn('SECURITY: Forcing sign-out due to failed profile fetch')
        try {
          await supabase.auth.signOut()
        } catch (signOutError) {
          console.error('Sign-out also failed:', signOutError)
        }
        if (revision === authRevision.current) {
          setScopedUser(null, revision)
          setSession(null)
        }
      }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { error: error.message }
      }

      return {}
    } catch (error) {
      return { error: 'حدث خطأ أثناء تسجيل الدخول' }
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signUp({ email, password })
      console.error('signUp response', { data, error })

      if (error) {
        return { error: error.message }
      }
      return {}
    } catch (error) {
      return { error: 'حدث خطأ أثناء إنشاء الحساب' }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      await supabase.auth.signOut()
      setUser(null)
      setSession(null)
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates: Partial<AppUser>) => {
    try {
      if (!user) return { error: 'المستخدم غير مسجل الدخول' }

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)

      if (error) {
        return { error: error.message }
      }

      // Update local user state
      setScopedUser({ ...user, ...updates })
      return {}
    } catch (error) {
      return { error: 'حدث خطأ أثناء تحديث الملف الشخصي' }
    }
  }

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signOut,
    updateProfile,
    signUp,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
