import React, { useState, useEffect } from 'react'
import { RolesAPI, type RolePermissions } from '../lib/api/roles'
import { useAuth } from '../contexts/AuthContext'

export const usePermissions = () => {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<RolePermissions | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadPermissions()
    } else {
      setPermissions(null)
      setUserRole('')
      setLoading(false)
    }
  }, [user])

  const loadPermissions = async () => {
    try {
      const [permissionsResponse, roleResponse] = await Promise.all([
        RolesAPI.getCurrentUserPermissions(),
        RolesAPI.getCurrentUserRole()
      ])

      if (permissionsResponse.success) {
        setPermissions(permissionsResponse.data)
      }

      if (roleResponse.success) {
        setUserRole(roleResponse.data)
      }
    } catch (error) {
      console.error('Error loading permissions:', error)
    } finally {
      setLoading(false)
    }
  }

  // التحقق من صلاحية معينة
  const hasPermission = (section: keyof RolePermissions, action: string): boolean => {
    if (!permissions) return false
    
    // إذا كان أدمن، له جميع الصلاحيات
    if (permissions.admin) return true
    
    const sectionPermissions = permissions[section]
    if (typeof sectionPermissions === 'object' && sectionPermissions !== null) {
      return (sectionPermissions as any)[action] === true
    }
    
    return false
  }

  // التحقق من كونه أدمن
  const isAdmin = (): boolean => {
    return permissions?.admin === true
  }

  // التحقق من دور معين
  const hasRole = (roleName: string): boolean => {
    return userRole === roleName
  }

  // التحقق من أي من الأدوار المحددة
  const hasAnyRole = (roleNames: string[]): boolean => {
    return roleNames.includes(userRole)
  }

  // التحقق من حد المصروفات
  const getExpenseLimit = (): number | null => {
    if (!permissions) return null
    if (permissions.admin) return null // بدون حد للأدمن
    
    const expensePermissions = permissions.expenses
    if (typeof expensePermissions === 'object' && expensePermissions !== null) {
      return expensePermissions.limit
    }
    
    return null
  }

  // التحقق من إمكانية الموافقة على مصروف
  const canApproveExpense = (amount: number): boolean => {
    if (!hasPermission('expenses', 'approve')) return false
    
    const limit = getExpenseLimit()
    if (limit === null) return true // بدون حد
    
    return amount <= limit
  }

  // التحقق من صلاحية عرض البيانات للفريق فقط
  const isTeamOnly = (section: keyof RolePermissions): boolean => {
    if (!permissions) return false
    if (permissions.admin) return false // الأدمن يرى كل شيء
    
    const sectionPermissions = permissions[section]
    if (typeof sectionPermissions === 'object' && sectionPermissions !== null) {
      return (sectionPermissions as any).team_only === true
    }
    
    return false
  }

  return {
    permissions,
    userRole,
    loading,
    hasPermission,
    isAdmin,
    hasRole,
    hasAnyRole,
    getExpenseLimit,
    canApproveExpense,
    isTeamOnly,
    refresh: loadPermissions
  }
}

// مكون للتحقق من الصلاحيات قبل عرض المحتوى
interface PermissionGuardProps {
  section: keyof RolePermissions
  action: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  section,
  action,
  children,
  fallback = null
}) => {
  const { hasPermission, loading } = usePermissions()

  if (loading) {
    return React.createElement('div', { className: 'animate-pulse bg-gray-200 h-8 rounded' })
  }

  if (hasPermission(section, action)) {
    return React.createElement(React.Fragment, null, children)
  }

  return React.createElement(React.Fragment, null, fallback)
}

// مكون للتحقق من الدور قبل عرض المحتوى
interface RoleGuardProps {
  roles: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  roles,
  children,
  fallback = null
}) => {
  const { hasAnyRole, loading } = usePermissions()

  if (loading) {
    return React.createElement('div', { className: 'animate-pulse bg-gray-200 h-8 rounded' })
  }

  if (hasAnyRole(roles)) {
    return React.createElement(React.Fragment, null, children)
  }

  return React.createElement(React.Fragment, null, fallback)
}

// مكون للتحقق من كونه أدمن
interface AdminGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export const AdminGuard: React.FC<AdminGuardProps> = ({
  children,
  fallback = null
}) => {
  const { isAdmin, loading } = usePermissions()

  if (loading) {
    return React.createElement('div', { className: 'animate-pulse bg-gray-200 h-8 rounded' })
  }

  if (isAdmin()) {
    return React.createElement(React.Fragment, null, children)
  }

  return React.createElement(React.Fragment, null, fallback)
}
