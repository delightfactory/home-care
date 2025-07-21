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

export class UsersAPI {
  // NOTE: إنشاء مستخدم جديد يجب أن يمر عبر Edge Function موقّعة بمفتاح الخدمة
  // هنا نستدعي دالة RPC (create_user_with_role) التي تنشئ مستخدم Auth + صف في جدول users
  static async createUser(input: NewUserInput): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.rpc('create_user_with_role', {
        p_email: input.email,
        p_password: input.password,
        p_full_name: input.full_name,
        p_phone: input.phone || null,
        p_role_id: input.role_id,
        p_is_active: input.is_active ?? true
      })

      if (error) throw error

      return { success: true, message: 'تم إنشاء المستخدم بنجاح' }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }

  static async updateUser(userId: string, input: UpdateUserInput): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.rpc('update_user_with_role', {
        p_user_id: userId,
        p_full_name: input.full_name ?? null,
        p_phone: input.phone ?? null,
        p_role_id: input.role_id ?? null,
        p_is_active: input.is_active ?? null
      })

      if (error) throw error

      return { success: true, message: 'تم تحديث بيانات المستخدم' }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }

  static async deleteUser(userId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.rpc('delete_user_and_auth', {
        p_user_id: userId
      })

      if (error) throw error

      return { success: true, message: 'تم حذف المستخدم' }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}
