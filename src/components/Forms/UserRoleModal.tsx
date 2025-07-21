import React, { useState } from 'react'
import { Save, Shield } from 'lucide-react'
import { RolesAPI, type Role, type UserWithRole } from '../../lib/api/roles'
import SmartModal from '../UI/SmartModal'
import toast from 'react-hot-toast'

interface UserRoleModalProps {
  user: UserWithRole
  roles: Role[]
  onClose: () => void
  onSuccess: () => void
}

const UserRoleModal: React.FC<UserRoleModalProps> = ({ user, roles, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState(user.role_id || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedRoleId) {
      toast.error('يرجى اختيار دور للمستخدم')
      return
    }

    if (selectedRoleId === user.role_id) {
      toast.error('لم يتم تغيير الدور')
      onClose()
      return
    }

    setLoading(true)
    try {
      const response = await RolesAPI.updateUserRole(user.id, selectedRoleId)

      if (response.success) {
        toast.success(response.message || 'تم تحديث دور المستخدم بنجاح')
        onSuccess()
      } else {
        toast.error(response.error || 'حدث خطأ أثناء تحديث دور المستخدم')
      }
    } catch (error) {
      toast.error('حدث خطأ غير متوقع')
    } finally {
      setLoading(false)
    }
  }

  const selectedRole = roles.find(r => r.id === selectedRoleId)

  const getRoleColor = (roleName: string) => {
    switch (roleName) {
      case 'manager':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'operations_supervisor':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'receptionist':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'team_leader':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPermissionCount = (permissions: Record<string, any>) => {
    if (permissions.admin) return 'جميع الصلاحيات'
    
    let count = 0
    Object.values(permissions).forEach(section => {
      if (typeof section === 'object' && section !== null) {
        Object.values(section).forEach(permission => {
          if (permission === true) count++
        })
      }
    })
    return `${count} صلاحية`
  }

  return (
    <SmartModal
      isOpen={true}
      onClose={onClose}
      title="تغيير دور المستخدم"
      subtitle="تحديد صلاحيات المستخدم"
      icon={<Shield className="h-6 w-6 text-white" />}
      size="md"
      headerGradient="from-indigo-600 to-purple-600"
    >
      <form onSubmit={handleSubmit} className="p-6">
        {/* User Info */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">معلومات المستخدم</h3>
          <div className="text-sm text-gray-600">
            <div className="mb-1">
              <span className="font-medium">الاسم:</span> {user.full_name}
            </div>
            {user.phone && (
              <div className="mb-1">
                <span className="font-medium">الهاتف:</span> {user.phone}
              </div>
            )}
            <div>
              <span className="font-medium">الدور الحالي:</span>{' '}
              {user.role ? (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getRoleColor(user.role.name)}`}>
                  {user.role.name_ar}
                </span>
              ) : (
                <span className="text-gray-400">بدون دور</span>
              )}
            </div>
          </div>
        </div>

        {/* Role Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            اختيار الدور الجديد *
          </label>
          <div className="space-y-3">
            {roles.filter(role => role.is_active).map((role) => (
              <div key={role.id} className="relative">
                <input
                  type="radio"
                  id={role.id}
                  name="role"
                  value={role.id}
                  checked={selectedRoleId === role.id}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="sr-only"
                />
                <label
                  htmlFor={role.id}
                  className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedRoleId === role.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleColor(role.name)}`}>
                          {role.name_ar}
                        </span>
                        <span className="text-xs text-gray-500">
                          {getPermissionCount(role.permissions)}
                        </span>
                      </div>
                      {role.description && (
                        <p className="text-sm text-gray-600">{role.description}</p>
                      )}
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedRoleId === role.id
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedRoleId === role.id && (
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Role Details */}
        {selectedRole && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">تفاصيل الدور المحدد</h4>
            <div className="text-sm text-blue-800">
              <div className="mb-1">
                <span className="font-medium">الاسم:</span> {selectedRole.name_ar}
              </div>
              <div className="mb-1">
                <span className="font-medium">الصلاحيات:</span> {getPermissionCount(selectedRole.permissions)}
              </div>
              {selectedRole.description && (
                <div>
                  <span className="font-medium">الوصف:</span> {selectedRole.description}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading || !selectedRoleId}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="h-4 w-4" />
            )}
            تحديث الدور
          </button>
        </div>
      </form>
    </SmartModal>
  )
}

export default UserRoleModal
