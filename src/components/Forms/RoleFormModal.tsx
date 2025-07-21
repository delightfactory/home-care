import React, { useState, useEffect } from 'react'
import { X, Shield, Save } from 'lucide-react'
import { RolesAPI, type Role, type RolePermissions } from '../../lib/api/roles'
import toast from 'react-hot-toast'

interface RoleFormModalProps {
  role?: Role | null
  onClose: () => void
  onSuccess: () => void
}

const RoleFormModal: React.FC<RoleFormModalProps> = ({ role, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.name_ar.trim()) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {role ? 'تعديل الدور' : 'إضافة دور جديد'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم الدور (بالإنجليزية) *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="manager"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم الدور (بالعربية) *
                </label>
                <input
                  type="text"
                  value={formData.name_ar}
                  onChange={(e) => setFormData(prev => ({ ...prev, name_ar: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="المدير العام"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الوصف
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="وصف مختصر للدور وصلاحياته"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  الدور نشط
                </label>
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">الصلاحيات التفصيلية</h3>
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
              {role ? 'تحديث' : 'إنشاء'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RoleFormModal
