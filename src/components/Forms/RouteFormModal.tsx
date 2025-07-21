import React, { useEffect, useState } from 'react'
import { X, Save, Calendar, Users } from 'lucide-react'
import { RoutesAPI } from '../../api'
import {
  RouteInsert,
  RouteUpdate,
  RouteWithOrders,
  TeamWithMembers,
} from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
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
        const res = await RoutesAPI.createRoute(payload as RouteInsert)
        if (!res.success) throw new Error(res.error)
        toast.success('تم إنشاء خط السير')
      } else if (existingRoute) {
        const res = await RoutesAPI.updateRoute(existingRoute.id, payload as RouteUpdate)
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {mode === 'create' ? 'إنشاء خط سير' : 'تعديل خط سير'}
          </h2>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600"
            onClick={onClose}
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-6 flex justify-center">
            <LoadingSpinner size="medium" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                اسم خط السير *
              </label>
              <input
                type="text"
                className="input-field"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            {/* Date */}
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <input
                type="date"
                className="input-field"
                value={formData.date as string}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            {/* Team */}
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-400" />
              <select
                className="select w-full"
                value={formData.team_id || 'none'}
                onChange={(e) =>
                  setFormData({ ...formData, team_id: e.target.value === 'none' ? null : e.target.value })
                }
              >
                <option value="none">بدون فريق</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
              <textarea
                className="input-field h-24"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                إلغاء
              </button>
              <button type="submit" className="btn-primary flex items-center gap-1" disabled={loading}>
                <Save className="h-4 w-4" /> حفظ
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default RouteFormModal
