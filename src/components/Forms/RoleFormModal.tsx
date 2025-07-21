import React, { useState, useEffect } from 'react'
import { X, Shield, Save, User, Globe, FileText, CheckCircle, Settings } from 'lucide-react'
import { RolesAPI, type Role, type RolePermissions } from '../../lib/api/roles'
import SmartModal from '../UI/SmartModal'
import toast from 'react-hot-toast'

interface RoleFormModalProps {
  role?: Role | null
  onClose: () => void
  onSuccess: () => void
}

const RoleFormModal: React.FC<RoleFormModalProps> = ({ role, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    description: '',
    is_active: true
  })

  const [permissions, setPermissions] = useState<RolePermissions>({
    customers: { create: false, read: false, update: false, delete: false },
    services: { create: false, read: false, update: false, delete: false },
    workers: { create: false, read: false, update: false, delete: false },
    teams: { create: false, read: false, update: false, delete: false },
    orders: { create: false, read: false, update: false, delete: false, assign: false },
    routes: { create: false, read: false, update: false, delete: false },
    expenses: { create: false, read: false, update: false, delete: false, approve: false, limit: null },
    reports: { create: false, read: false, update: false, delete: false, export: false },
    settings: { create: false, read: false, update: false, delete: false },
    users: { create: false, read: false, update: false, delete: false, manage_roles: false },
    admin: false
  })

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name,
        name_ar: role.name_ar,
        description: role.description || '',
        is_active: role.is_active
      })
      setPermissions(role.permissions as RolePermissions)
    }
  }, [role])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'اسم الدور بالإنجليزية مطلوب'
    }
    
    if (!formData.name_ar.trim()) {
      newErrors.name_ar = 'اسم الدور بالعربية مطلوب'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    validateForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      const roleData = {
        ...formData,
        permissions
      }

      let response
      if (role) {
        response = await RolesAPI.updateRole(role.id, roleData)
      } else {
        response = await RolesAPI.createRole(roleData)
      }

      if (response.success) {
        toast.success(response.message || `تم ${role ? 'تحديث' : 'إنشاء'} الدور بنجاح`)
        onSuccess()
      } else {
        toast.error(response.error || 'حدث خطأ أثناء حفظ الدور')
      }
    } catch (error) {
      toast.error('حدث خطأ غير متوقع')
    } finally {
      setLoading(false)
    }
  }

  const handlePermissionChange = (section: keyof RolePermissions, action: string, value: boolean | number | null) => {
    setPermissions(prev => ({
      ...prev,
      [section]: typeof prev[section] === 'object' && prev[section] !== null
        ? { ...prev[section], [action]: value }
        : value
    }))
  }

  const handleAdminToggle = (isAdmin: boolean) => {
    if (isAdmin) {
      // إذا كان أدمن، تفعيل جميع الصلاحيات
      setPermissions({
        customers: { create: true, read: true, update: true, delete: true },
        services: { create: true, read: true, update: true, delete: true },
        workers: { create: true, read: true, update: true, delete: true },
        teams: { create: true, read: true, update: true, delete: true },
        orders: { create: true, read: true, update: true, delete: true, assign: true },
        routes: { create: true, read: true, update: true, delete: true },
        expenses: { create: true, read: true, update: true, delete: true, approve: true, limit: null },
        reports: { create: true, read: true, update: true, delete: true, export: true },
        settings: { create: true, read: true, update: true, delete: true },
        users: { create: true, read: true, update: true, delete: true, manage_roles: true },
        admin: true
      })
    } else {
      setPermissions(prev => ({ ...prev, admin: false }))
    }
  }

  const permissionSections = [
    { key: 'customers', name: 'العملاء', icon: '👥' },
    { key: 'services', name: 'الخدمات', icon: '🛠️' },
    { key: 'workers', name: 'العمال', icon: '👷' },
    { key: 'teams', name: 'الفرق', icon: '👨‍👩‍👧‍👦' },
    { key: 'orders', name: 'الطلبات', icon: '📋' },
    { key: 'routes', name: 'خطوط السير', icon: '🗺️' },
    { key: 'expenses', name: 'المصروفات', icon: '💰' },
    { key: 'reports', name: 'التقارير', icon: '📊' },
    { key: 'settings', name: 'الإعدادات', icon: '⚙️' },
    { key: 'users', name: 'المستخدمين', icon: '👤' }
  ]

  return (
    <SmartModal
      isOpen={true}
      onClose={onClose}
      title={role ? 'تعديل الدور' : 'إضافة دور جديد'}
      subtitle={role ? 'تحديث بيانات الدور والصلاحيات' : 'إنشاء دور جديد مع تحديد الصلاحيات'}
      icon={<Shield className="h-6 w-6 text-white" />}
      size="xl"
      headerGradient="from-blue-600 to-indigo-600"
    >

      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم الدور (بالإنجليزية) *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Globe className={`h-5 w-5 ${touched.name && errors.name ? 'text-red-400' : 'text-gray-400'}`} />
                  </div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    onBlur={() => handleBlur('name')}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                      touched.name && errors.name
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400'
                    }`}
                    placeholder="manager"
                    required
                  />
                  {touched.name && !errors.name && formData.name && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                  )}
                </div>
                {touched.name && errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم الدور (بالعربية) *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className={`h-5 w-5 ${touched.name_ar && errors.name_ar ? 'text-red-400' : 'text-gray-400'}`} />
                  </div>
                  <input
                    type="text"
                    value={formData.name_ar}
                    onChange={(e) => setFormData(prev => ({ ...prev, name_ar: e.target.value }))}
                    onBlur={() => handleBlur('name_ar')}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                      touched.name_ar && errors.name_ar
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400'
                    }`}
                    placeholder="المدير العام"
                    required
                  />
                  {touched.name_ar && !errors.name_ar && formData.name_ar && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                  )}
                </div>
                {touched.name_ar && errors.name_ar && (
                  <p className="mt-1 text-sm text-red-600">{errors.name_ar}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الوصف
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <FileText className="h-5 w-5 text-gray-400" />
                  </div>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-all duration-200"
                    rows={3}
                    placeholder="وصف مختصر للدور وصلاحياته"
                  />
                </div>
              </div>

              <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="mr-3 flex items-center text-sm font-medium text-gray-900">
                    <CheckCircle className="h-4 w-4 ml-2 text-green-500" />
                    نشط
                  </label>
                </div>
                <span className="text-xs text-gray-500 mr-auto">
                  {formData.is_active ? 'الدور متاح للاستخدام' : 'الدور غير متاح للاستخدام'}
                </span>
              </div>
            </div>

            {/* Admin Toggle */}
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="admin"
                  checked={permissions.admin}
                  onChange={(e) => handleAdminToggle(e.target.checked)}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <label htmlFor="admin" className="text-sm font-medium text-red-700">
                  صلاحيات المدير العام (جميع الصلاحيات)
                </label>
              </div>
              <p className="text-xs text-red-600 mt-1">
                تفعيل هذا الخيار يعطي صلاحيات كاملة على جميع أجزاء النظام
              </p>
            </div>

            {/* Permissions */}
            {!permissions.admin && (
              <div>
                <div className="flex items-center mb-4">
                  <div className="bg-blue-100 p-2 rounded-lg ml-3">
                    <Settings className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">الصلاحيات التفصيلية</h3>
                    <p className="text-sm text-gray-500">حدد الصلاحيات المتاحة لهذا الدور</p>
                  </div>
                </div>
                <div className="space-y-6">
                  {permissionSections.map((section) => {
                    const sectionPermissions = permissions[section.key as keyof RolePermissions]
                    if (typeof sectionPermissions !== 'object' || sectionPermissions === null) return null

                    return (
                      <div key={section.key} className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                          <span>{section.icon}</span>
                          {section.name}
                        </h4>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {Object.entries(sectionPermissions).map(([action, value]) => {
                            if (action === 'limit') {
                              return (
                                <div key={action} className="md:col-span-2">
                                  <label className="block text-xs text-gray-600 mb-1">
                                    حد الموافقة (ج.م)
                                  </label>
                                  <input
                                    type="number"
                                    value={typeof value === 'number' ? value.toString() : ''}
                                    onChange={(e) => handlePermissionChange(
                                      section.key as keyof RolePermissions,
                                      action,
                                      e.target.value ? parseFloat(e.target.value) : null
                                    )}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="بدون حد"
                                  />
                                </div>
                              )
                            }

                            if (typeof value !== 'boolean') return null

                            const actionNames: Record<string, string> = {
                              create: 'إنشاء',
                              read: 'عرض',
                              update: 'تعديل',
                              delete: 'حذف',
                              assign: 'تخصيص',
                              approve: 'موافقة',
                              export: 'تصدير',
                              manage_roles: 'إدارة الأدوار',
                              team_only: 'الفريق فقط'
                            }

                            return (
                              <div key={action} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`${section.key}_${action}`}
                                  checked={value}
                                  onChange={(e) => handlePermissionChange(
                                    section.key as keyof RolePermissions,
                                    action,
                                    e.target.checked
                                  )}
                                  className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label
                                  htmlFor={`${section.key}_${action}`}
                                  className="text-xs text-gray-700"
                                >
                                  {actionNames[action] || action}
                                </label>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
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
            {loading ? 'جاري الحفظ...' : (role ? 'تحديث' : 'إنشاء')}
          </button>
        </div>
      </form>
    </SmartModal>
  )
}

export default RoleFormModal
