import { supabase, handleSupabaseError } from '../supabase'
import type { ApiResponse } from '../../types'

export interface NewUserInput {
  email: string
  password: string
  full_name: string
  phone?: string
  role_id: string
  is_active?: boolean
}

export interface UpdateUserInput {
  full_name?: string
  phone?: string
  role_id?: string
  is_active?: boolean
}

export interface CreateTechnicianInput {
  email: string
  password: string
  full_name: string
  phone?: string
  skills?: string[]
  can_drive?: boolean
  salary?: number
}

// Helper function to call Edge Functions
async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      }
    )

    const data = await response.json()

    if (!response.ok || !data.success) {
      return { data: null, error: data.error || 'حدث خطأ غير متوقع' }
    }

    return { data, error: null }
  } catch (error) {
    console.error(`Edge function ${functionName} error:`, error)
    return { data: null, error: error instanceof Error ? error.message : 'فشل الاتصال بالخادم' }
  }
}

export class UsersAPI {
  /**
   * إنشاء مستخدم جديد مع دور
   * يستخدم Edge Function لأن Supabase Cloud لا تدعم auth.create_user() من PostgreSQL
   */
  static async createUser(input: NewUserInput): Promise<ApiResponse<{ user_id: string }>> {
    try {
      const { data, error } = await callEdgeFunction<{ user_id: string }>('create_user_with_role', {
        email: input.email,
        password: input.password,
        full_name: input.full_name,
        phone: input.phone || null,
        role_id: input.role_id,
        is_active: input.is_active ?? true
      })

      if (error) throw new Error(error)

      return { success: true, data: data!, message: 'تم إنشاء المستخدم بنجاح' }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }

  /**
   * تحديث بيانات مستخدم
   */
  static async updateUser(userId: string, input: UpdateUserInput): Promise<ApiResponse<void>> {
    try {
      const { error } = await callEdgeFunction('update_user_with_role', {
        user_id: userId,
        full_name: input.full_name,
        phone: input.phone,
        role_id: input.role_id,
        is_active: input.is_active
      })

      if (error) throw new Error(error)

      return { success: true, message: 'تم تحديث بيانات المستخدم' }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }

  /**
   * حذف مستخدم
   */
  static async deleteUser(userId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await callEdgeFunction('delete_user_and_auth', {
        user_id: userId
      })

      if (error) throw new Error(error)

      return { success: true, message: 'تم حذف المستخدم' }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }

  /**
   * إعادة تعيين كلمة المرور للمستخدم (للأدمن فقط)
   */
  static async resetUserPassword(userId: string, newPassword: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await callEdgeFunction('reset_user_password', {
        user_id: userId,
        new_password: newPassword
      })

      if (error) throw new Error(error)

      return { success: true, message: 'تم تغيير كلمة المرور بنجاح' }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }

  /**
   * إنشاء فني جديد (مستخدم + عامل) بشكل متزامن
   * يستخدم Edge Function مع دعم Rollback
   */
  static async createTechnician(input: CreateTechnicianInput): Promise<ApiResponse<{ user_id: string; worker_id: string }>> {
    try {
      const { data, error } = await callEdgeFunction<{ user_id: string; worker_id: string }>('create_technician', {
        email: input.email,
        password: input.password,
        full_name: input.full_name,
        phone: input.phone || null,
        skills: input.skills || [],
        can_drive: input.can_drive || false,
        salary: input.salary
      })

      if (error) throw new Error(error)

      return { success: true, data: data!, message: 'تم إنشاء الفني بنجاح' }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }

  /**
   * جلب المستخدمين غير المرتبطين بعمال (للربط)
   * ملاحظة: email موجود في auth.users وليس public.users
   */
  static async getUnlinkedUsers(): Promise<ApiResponse<{ id: string; full_name: string; phone: string | null }[]>> {
    try {
      // المستخدمين الذين ليس لديهم worker مرتبط
      const { data: linkedUserIds } = await supabase
        .from('workers')
        .select('user_id')
        .not('user_id', 'is', null)

      const linkedIds = linkedUserIds?.map(w => w.user_id) || []

      let query = supabase
        .from('users')
        .select('id, full_name, phone')
        .eq('is_active', true)

      if (linkedIds.length > 0) {
        query = query.not('id', 'in', `(${linkedIds.join(',')})`)
      }

      const { data, error } = await query.order('full_name')

      if (error) throw error

      return { success: true, data: data || [] }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }

  /**
   * ربط عامل موجود بمستخدم موجود
   */
  static async linkWorkerToUser(workerId: string, userId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('workers')
        .update({ user_id: userId, updated_at: new Date().toISOString() })
        .eq('id', workerId)

      if (error) throw error

      return { success: true, message: 'تم ربط العامل بالمستخدم بنجاح' }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }

  /**
   * إلغاء ربط عامل من مستخدم
   */
  static async unlinkWorkerFromUser(workerId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('workers')
        .update({ user_id: null, updated_at: new Date().toISOString() })
        .eq('id', workerId)

      if (error) throw error

      return { success: true, message: 'تم إلغاء ربط العامل بنجاح' }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}
