import { supabase, handleSupabaseError } from '../supabase'
import type { ApiResponse } from '../../types'

export interface Role {
  id: string
  name: string
  name_ar: string
  permissions: Record<string, any>
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserWithRole {
  id: string
  email: string
  full_name: string
  phone?: string | null
  is_active: boolean
  role_id?: string | null
  role?: Role
  created_at: string
  updated_at: string
}

export interface RolePermissions {
  customers: {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
  }
  services: {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
  }
  workers: {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
  }
  teams: {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
  }
  orders: {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
    assign: boolean
    team_only?: boolean
  }
  routes: {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
    team_only?: boolean
  }
  expenses: {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
    approve: boolean
    limit: number | null
    team_only?: boolean
  }
  reports: {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
    export: boolean
    team_only?: boolean
  }
  settings: {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
  }
  users: {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
    manage_roles: boolean
  }
  admin: boolean
}

export class RolesAPI {
  // الحصول على جميع الأدوار
  static async getRoles(): Promise<ApiResponse<Role[]>> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name')

      if (error) throw error

      return {
        success: true,
        data: data || []
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // الحصول على دور محدد
  static async getRoleById(id: string): Promise<ApiResponse<Role>> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      return {
        success: true,
        data
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // إنشاء دور جديد
  static async createRole(roleData: Omit<Role, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Role>> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .insert(roleData)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم إنشاء الدور بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // تحديث دور
  static async updateRole(id: string, roleData: Partial<Role>): Promise<ApiResponse<Role>> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .update({
          ...roleData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم تحديث الدور بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // حذف دور
  static async deleteRole(id: string): Promise<ApiResponse<void>> {
    try {
      // التحقق من عدم وجود مستخدمين مرتبطين بهذا الدور
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id')
        .eq('role_id', id)
        .limit(1)

      if (usersError) throw usersError

      if (users && users.length > 0) {
        return {
          success: false,
          error: 'لا يمكن حذف الدور لوجود مستخدمين مرتبطين به'
        }
      }

      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', id)

      if (error) throw error

      return {
        success: true,
        message: 'تم حذف الدور بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // الحصول على جميع المستخدمين مع أدوارهم
  static async getUsersWithRoles(): Promise<ApiResponse<UserWithRole[]>> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .order('full_name')

      if (error) throw error

      return {
        success: true,
        data: data || []
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // تحديث دور مستخدم
  static async updateUserRole(userId: string, roleId: string): Promise<ApiResponse<UserWithRole>> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          role_id: roleId,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select(`
          *,
          role:roles(*)
        `)
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم تحديث دور المستخدم بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // الحصول على صلاحيات المستخدم الحالي
  static async getCurrentUserPermissions(): Promise<ApiResponse<RolePermissions>> {
    try {
      const { data, error } = await supabase.rpc('get_current_user_permissions')

      if (error) throw error

      return {
        success: true,
        data: data || {}
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // التحقق من صلاحية معينة
  static async checkPermission(permissionType: string, actionType: string): Promise<ApiResponse<boolean>> {
    try {
      const { data, error } = await supabase.rpc('check_user_permission', {
        permission_type: permissionType,
        action_type: actionType
      })

      if (error) throw error

      return {
        success: true,
        data: data || false
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // الحصول على دور المستخدم الحالي
  static async getCurrentUserRole(): Promise<ApiResponse<string>> {
    try {
      const { data, error } = await supabase.rpc('get_current_user_role')

      if (error) throw error

      return {
        success: true,
        data: data || ''
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // تفعيل/إلغاء تفعيل مستخدم
  static async toggleUserStatus(userId: string, isActive: boolean): Promise<ApiResponse<UserWithRole>> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select(`
          *,
          role:roles(*)
        `)
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: `تم ${isActive ? 'تفعيل' : 'إلغاء تفعيل'} المستخدم بنجاح`
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }
}
