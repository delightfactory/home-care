import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { User as AppUser } from '../types'

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

  useEffect(() => {
    let isMounted = true

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!isMounted) return

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

        console.log('Auth state change:', event, session?.user?.email)

        setSession(session)

        if (session?.user) {
          fetchUserProfile(session.user)
        } else {
          setUser(null)
        }

        if (isMounted) {
          setLoading(false)
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const fetchUserProfile = async (authUser: User, retryCount = 0): Promise<void> => {
    const MAX_RETRIES = 2  // تقليل عدد المحاولات لتسريع الفشل
    const RETRY_DELAY = 300 // تقليل التأخير من 500ms إلى 300ms

    try {
      // جلب الملف الشخصي مع timeout معقول
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
      )

      const fetchPromise = supabase
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('id', authUser.id)
        .single()

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any

      if (error) {
        console.warn(`User profile fetch attempt ${retryCount + 1} failed:`, error.message)

        // إعادة المحاولة مع تأخير بسيط
        if (retryCount < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          return fetchUserProfile(authUser, retryCount + 1)
        }

        // بعد استنفاد المحاولات: استخدم RPC مباشرة
        console.log('All retries exhausted, trying final RPC fallback...')
        const { data: roleName } = await supabase.rpc('get_current_user_role')

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
        setUser(fallbackUser as any)
        return
      }

      setUser(data)
    } catch (error) {
      console.warn('Error fetching user profile:', error)

      // retry بسرعة
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
        return fetchUserProfile(authUser, retryCount + 1)
      }

      // fallback نهائي
      try {
        const { data: roleName } = await supabase.rpc('get_current_user_role')
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
        setUser(fallbackUser as any)
      } catch (rpcError) {
        console.error('RPC fallback also failed:', rpcError)
        const lastResortUser = {
          id: authUser.id,
          full_name: authUser.email?.split('@')[0] || 'مستخدم',
          phone: null,
          role_id: null,
          role: { name: 'pending', name_ar: 'قيد المراجعة', permissions: {} },
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        setUser(lastResortUser as any)
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
      setUser({ ...user, ...updates })
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
