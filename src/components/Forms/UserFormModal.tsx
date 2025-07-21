import React, { useEffect, useState } from 'react'
import { X, UserPlus, Save, Mail, Lock, User, Phone, Shield, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { UsersAPI, type NewUserInput } from '../../lib/api/users'
import { type Role } from '../../lib/api/roles'
import SmartModal from '../UI/SmartModal'

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
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
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

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!isEdit && !formData.email.trim()) {
      newErrors.email = 'البريد الإلكتروني مطلوب'
    }
    
    if (!isEdit && !formData.password.trim()) {
      newErrors.password = 'كلمة المرور مطلوبة'
    }
    
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'الاسم الكامل مطلوب'
    }
    
    if (!formData.role_id) {
      newErrors.role_id = 'الدور مطلوب'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    validateForm()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
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
    <SmartModal
      isOpen={true}
      onClose={onClose}
      title={isEdit ? 'تعديل مستخدم' : 'مستخدم جديد'}
      subtitle={isEdit ? 'تحديث بيانات المستخدم' : 'إنشاء حساب مستخدم جديد'}
      icon={<UserPlus className="h-6 w-6 text-white" />}
      size="lg"
      headerGradient="from-blue-600 to-indigo-600"
    >

      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                البريد الإلكتروني {!isEdit && '*'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className={`h-5 w-5 ${touched.email && errors.email ? 'text-red-400' : 'text-gray-400'}`} />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => handleBlur('email')}
                  disabled={isEdit}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                    touched.email && errors.email
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400'
                  } ${isEdit ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="example@example.com"
                />
                {touched.email && !errors.email && formData.email && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                )}
              </div>
              {touched.email && errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Password (only on create) */}
            {!isEdit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  كلمة المرور *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className={`h-5 w-5 ${touched.password && errors.password ? 'text-red-400' : 'text-gray-400'}`} />
                  </div>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={() => handleBlur('password')}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                      touched.password && errors.password
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400'
                    }`}
                    placeholder="••••••••"
                  />
                  {touched.password && !errors.password && formData.password && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                  )}
                </div>
                {touched.password && errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>
            )}

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الاسم الكامل *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className={`h-5 w-5 ${touched.full_name && errors.full_name ? 'text-red-400' : 'text-gray-400'}`} />
                </div>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  onBlur={() => handleBlur('full_name')}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                    touched.full_name && errors.full_name
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400'
                  }`}
                  placeholder="الاسم الكامل"
                />
                {touched.full_name && !errors.full_name && formData.full_name && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                )}
              </div>
              {touched.full_name && errors.full_name && (
                <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الهاتف (اختياري)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-all duration-200"
                  placeholder="05XXXXXXXX"
                />
                {formData.phone && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الدور *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Shield className={`h-5 w-5 ${touched.role_id && errors.role_id ? 'text-red-400' : 'text-gray-400'}`} />
                </div>
                <select
                  name="role_id"
                  value={formData.role_id}
                  onChange={handleChange}
                  onBlur={() => handleBlur('role_id')}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 appearance-none ${
                    touched.role_id && errors.role_id
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400'
                  }`}
                >
                  <option value="">اختر الدور</option>
                  {roles.filter(r => r.is_active).map(role => (
                    <option key={role.id} value={role.id}>{role.name_ar}</option>
                  ))}
                </select>
                {touched.role_id && !errors.role_id && formData.role_id && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                )}
              </div>
              {touched.role_id && errors.role_id && (
                <p className="mt-1 text-sm text-red-600">{errors.role_id}</p>
              )}
            </div>

            {/* Active */}
            <div className="flex items-center p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="mr-3 flex items-center text-sm font-medium text-gray-900">
                  <CheckCircle className="h-4 w-4 ml-2 text-green-500" />
                  فعال
                </label>
              </div>
              <span className="text-xs text-gray-500 mr-auto">
                {formData.is_active ? 'المستخدم متاح للدخول' : 'المستخدم غير متاح للدخول'}
              </span>
            </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 border border-transparent rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="h-4 w-4" />
            )}
            {loading ? 'جاري الحفظ...' : (isEdit ? 'تحديث' : 'إنشاء')}
          </button>
        </div>
      </form>
    </SmartModal>
  )
}

export default UserFormModal
