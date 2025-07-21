import React, { useEffect, useState } from 'react'
import { X, UserPlus, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { UsersAPI, type NewUserInput } from '../../lib/api/users'
import { type Role } from '../../lib/api/roles'

interface UserFormModalProps {
  user?: {
    id: string
    email: string
    full_name: string
    phone?: string | null
    role_id?: string | null
    is_active: boolean
  } | null
  roles: Role[]
  onClose: () => void
  onSuccess: () => void
}

const UserFormModal: React.FC<UserFormModalProps> = ({ user, roles, onClose, onSuccess }) => {
  const isEdit = Boolean(user)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<NewUserInput>({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role_id: '',
    is_active: true
  })

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        email: user.email ?? '',
        full_name: user.full_name ?? '',
        phone: user.phone || '',
        role_id: user.role_id || '',
        is_active: user.is_active
      }))
    }
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (( !isEdit && !(formData.email || '').trim()) || !(formData.full_name || '').trim() || !formData.role_id) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    if (!isEdit && !(formData.password || '').trim()) {
      toast.error('كلمة المرور مطلوبة')
      return
    }

    setLoading(true)
    try {
      if (isEdit && user) {
        const { success, error, message } = await UsersAPI.updateUser(user.id, {
          full_name: formData.full_name,
          phone: formData.phone,
          role_id: formData.role_id,
          is_active: formData.is_active
        })
        if (success) {
          toast.success(message || 'تم تحديث المستخدم')
          onSuccess()
        } else {
          toast.error(error || 'خطأ أثناء التحديث')
        }
      } else {
        const { success, error, message } = await UsersAPI.createUser(formData)
        if (success) {
          toast.success(message || 'تم إنشاء المستخدم')
          onSuccess()
        } else {
          toast.error(error || 'خطأ أثناء الإنشاء')
        }
      }
    } catch (err) {
      toast.error('خطأ غير متوقع')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <UserPlus className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {isEdit ? 'تعديل مستخدم' : 'مستخدم جديد'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={isEdit}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="example@example.com"
              />
            </div>

            {/* Password (only on create) */}
            {!isEdit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  placeholder="••••••••"
                />
              </div>
            )}

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="الاسم الكامل"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الهاتف (اختياري)</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="05XXXXXXXX"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
              <select
                name="role_id"
                value={formData.role_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              >
                <option value="">اختر الدور</option>
                {roles.filter(r => r.is_active).map(role => (
                  <option key={role.id} value={role.id}>{role.name_ar}</option>
                ))}
              </select>
            </div>

            {/* Active */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">فعال</label>
            </div>
          </div>

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
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isEdit ? 'تحديث' : 'إنشاء'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UserFormModal
