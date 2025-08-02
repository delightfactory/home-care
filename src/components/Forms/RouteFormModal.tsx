import React, { useEffect, useState } from 'react'
import { Save, Users, FileText, CheckCircle, MapPin, X } from 'lucide-react'
import EnhancedAPI from '../../api/enhanced-api'
import {
  RouteInsert,
  RouteUpdate,
  RouteWithOrders,
  TeamWithMembers,
} from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
import SmartModal from '../UI/SmartModal'
import DateTimePicker from '../UI/DateTimePicker'
import toast from 'react-hot-toast'

interface RouteFormModalProps {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  existingRoute?: RouteWithOrders
  teams: TeamWithMembers[]
  onSaved: () => void
}

const RouteFormModal: React.FC<RouteFormModalProps> = ({
  open,
  onClose,
  mode,
  existingRoute,
  teams,
  onSaved,
}) => {
  const [formData, setFormData] = useState<RouteInsert | RouteUpdate>({
    name: '',
    date: new Date().toISOString().substring(0, 10),
    team_id: null,
    start_time: null,
    estimated_end_time: null,
    notes: '',
  } as any)
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState<{[key: string]: boolean}>({})

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  useEffect(() => {
    if (mode === 'edit' && existingRoute) {
      const { id, created_at, updated_at, ...rest } = existingRoute
      setFormData({ ...rest })
    } else if (open) {
      setFormData({
        name: '',
        date: new Date().toISOString().substring(0, 10),
        team_id: null,
        start_time: '',
        estimated_end_time: '',
        notes: '',
      } as any)
    }
  }, [mode, existingRoute, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name?.trim()) {
      toast.error('يرجى إدخال اسم خط السير')
      return
    }

    // Prepare payload: replace empty strings with null and remove undefined
    const payload: any = { ...formData }
    if (!payload.start_time) payload.start_time = null
    if (!payload.estimated_end_time) payload.estimated_end_time = null
    // Remove relational arrays that should not be sent in update
    delete (payload as any).route_orders
    delete (payload as any).orders
    delete (payload as any).team

    setLoading(true)
    try {
      if (mode === 'create') {
        const res = await EnhancedAPI.createRoute(payload as RouteInsert)
        if (!res.success) throw new Error(res.error)
        toast.success('تم إنشاء خط السير')
      } else if (existingRoute) {
        const res = await EnhancedAPI.updateRoute(existingRoute.id, payload as RouteUpdate)
        if (!res.success) throw new Error(res.error)
        toast.success('تم تحديث خط السير')
      }
      onSaved()
      onClose()
    } catch (error) {
      toast.error('حدث خطأ، حاول مرة أخرى')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <SmartModal
      isOpen={open}
      onClose={onClose}
      title={mode === 'create' ? 'إنشاء خط سير جديد' : 'تعديل خط السير'}
      subtitle={mode === 'create' ? 'أضف خط سير جديد للنظام' : 'تحديث بيانات خط السير'}
      icon={<MapPin className="h-6 w-6 text-white" />}
      size="md"
      headerGradient="from-blue-600 to-purple-600"
    >

      {loading ? (
        <div className="py-8 flex justify-center">
          <LoadingSpinner size="medium" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Route Name */}
              <div className="space-y-2">
                <label className="flex items-center label text-gray-700 font-medium">
                  <MapPin className="h-4 w-4 ml-2 text-primary-500" />
                  اسم خط السير *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${
                      touched.name && formData.name ? 'border-green-500 focus:ring-green-500' : ''
                    }`}
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    onBlur={() => handleBlur('name')}
                    placeholder="أدخل اسم خط السير"
                    required
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    {touched.name && formData.name ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <MapPin className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Date */}
              <DateTimePicker
                type="date"
                value={formData.date as string}
                onChange={(value) => setFormData({ ...formData, date: value })}
                label="تاريخ خط السير"
                placeholder="اختر تاريخ خط السير"
                disabled={loading}
              />

              {/* Team */}
              <div className="space-y-2">
                <label className="flex items-center label text-gray-700 font-medium">
                  <Users className="h-4 w-4 ml-2 text-primary-500" />
                  الفريق المسؤول
                </label>
                <div className="relative">
                  <select
                    className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${
                      touched.team_id && formData.team_id ? 'border-green-500 focus:ring-green-500' : ''
                    }`}
                    value={formData.team_id || 'none'}
                    onChange={(e) =>
                      setFormData({ ...formData, team_id: e.target.value === 'none' ? null : e.target.value })
                    }
                    onBlur={() => handleBlur('team_id')}
                  >
                    <option value="none">بدون فريق</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    {touched.team_id && formData.team_id ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Users className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="flex items-center label text-gray-700 font-medium">
                  <FileText className="h-4 w-4 ml-2 text-primary-500" />
                  ملاحظات
                </label>
                <div className="relative">
                  <textarea
                    className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 h-24 ${
                      touched.notes && formData.notes ? 'border-green-500 focus:ring-green-500' : ''
                    }`}
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    onBlur={() => handleBlur('notes')}
                    placeholder="أدخل ملاحظات إضافية (اختياري)"
                  />
                  <div className="absolute left-3 top-3">
                    {touched.notes && formData.notes ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <FileText className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>
                {formData.notes && (
                  <p className="text-xs text-gray-500">
                    {formData.notes.length} حرف
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 bg-white sticky bottom-0 left-0 right-0 z-10">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary flex items-center transition-all duration-200"
                  disabled={loading}
                >
                  <X className="h-4 w-4 ml-2" />
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading || !formData.name?.trim()}
                  className="btn-primary flex items-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                  ) : (
                    <Save className="h-4 w-4 ml-2" />
                  )}
                  {loading ? 'جاري الحفظ...' : (mode === 'create' ? 'إنشاء' : 'تحديث')}
                </button>
              </div>
        </form>
      )}
    </SmartModal>
  )
}

export default RouteFormModal
