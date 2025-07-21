import React, { useState, useEffect } from 'react'
import { X, Save, User } from 'lucide-react'
import { CustomersAPI } from '../../api'
import { Customer, CustomerForm } from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
import toast from 'react-hot-toast'

interface CustomerFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  customer?: Customer
  mode: 'create' | 'edit'
}

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  customer,
  mode
}) => {
  const [formData, setFormData] = useState<CustomerForm>({
    name: '',
    phone: '',
    address: '',
    area: '',
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (customer && mode === 'edit') {
      setFormData({
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        area: customer.area || '',
        latitude: (() => {
           const loc = customer.location_coordinates as any
           if (!loc) return undefined
           if (typeof loc === 'string') {
             const match = loc.match(/\(([-0-9.]+),\s*([-0-9.]+)\)/)
             return match ? Number(match[2]) : undefined // y is lat in (x,y)
           }
           if (typeof loc === 'object' && 'y' in loc) return Number((loc as any).y)
           return undefined
         })(),
         longitude: (() => {
           const loc = customer.location_coordinates as any
           if (!loc) return undefined
           if (typeof loc === 'string') {
             const match = loc.match(/\(([-0-9.]+),\s*([-0-9.]+)\)/)
             return match ? Number(match[1]) : undefined // x is lng
           }
           if (typeof loc === 'object' && 'x' in loc) return Number((loc as any).x)
           return undefined
         })(),
        is_active: customer.is_active,
        notes: customer.notes || ''
      })
    } else {
      setFormData({
        name: '',
        phone: '',
        address: '',
        area: '',
        latitude: undefined,
        longitude: undefined,
        is_active: true,
        notes: ''
      })
    }
    setErrors({})
  }, [customer, mode, isOpen])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'اسم العميل مطلوب'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'رقم الهاتف مطلوب'
    } else if (!/^[0-9+\-\s()]+$/.test(formData.phone)) {
      newErrors.phone = 'رقم الهاتف غير صحيح'
    }

    if (!formData.address.trim()) {
      newErrors.address = 'العنوان مطلوب'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    try {
      const payload: any = {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        area: formData.area || null,
        notes: formData.notes || null,
        is_active: formData.is_active ?? true,
        location_coordinates: formData.latitude !== undefined && formData.longitude !== undefined ? `(${formData.longitude},${formData.latitude})` : null
      }

      if (mode === 'create') {
        await CustomersAPI.createCustomer(payload)
        toast.success('تم إضافة العميل بنجاح')
      } else {
        await CustomersAPI.updateCustomer(customer!.id, payload)
        toast.success('تم تحديث بيانات العميل بنجاح')
      }
      
      onSuccess()
      onClose()
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ البيانات')
      console.error('Customer form error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement
    const newValue = type === 'checkbox' ? checked : value
    setFormData(prev => ({ ...prev, [name]: newValue }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-primary-100 rounded-lg ml-3">
              <User className="h-5 w-5 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === 'create' ? 'إضافة عميل جديد' : 'تعديل بيانات العميل'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label label-required">اسم العميل</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`input ${errors.name ? 'input-error' : ''}`}
              placeholder="أدخل اسم العميل"
              disabled={loading}
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="label label-required">رقم الهاتف</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={`input ${errors.phone ? 'input-error' : ''}`}
              placeholder="أدخل رقم الهاتف"
              disabled={loading}
            />
            {errors.phone && (
              <p className="text-sm text-red-600 mt-1">{errors.phone}</p>
            )}
          </div>

          <div>
            <label className="label label-required">العنوان</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              className={`input ${errors.address ? 'input-error' : ''}`}
              placeholder="أدخل العنوان التفصيلي"
              rows={3}
              disabled={loading}
            />
            {errors.address && (
              <p className="text-sm text-red-600 mt-1">{errors.address}</p>
            )}
          </div>

          <div>
            <label className="label">المنطقة</label>
            <input
              type="text"
              name="area"
              value={formData.area}
              onChange={handleChange}
              className="input"
              placeholder="أدخل المنطقة (اختياري)"
              disabled={loading}
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">دوائر العرض (Latitude)</label>
              <input
                type="number"
                name="latitude"
                value={formData.latitude ?? ''}
                onChange={handleChange}
                className="input"
                placeholder="مثال: 30.0444"
                step="0.0001"
                disabled={loading}
              />
            </div>
            <div>
              <label className="label">خطوط الطول (Longitude)</label>
              <input
                type="number"
                name="longitude"
                value={formData.longitude ?? ''}
                onChange={handleChange}
                className="input"
                placeholder="مثال: 31.2357"
                step="0.0001"
                disabled={loading}
              />
            </div>
          </div>

          {/* Active Toggle */}
          <div>
            <label className="inline-flex items-center mt-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active ?? true}
                onChange={handleChange}
                className="form-checkbox h-4 w-4 text-primary-600"
              />
              <span className="ml-2 text-gray-700">العميل نشط</span>
            </label>
          </div>

          <div>
            <label className="label">ملاحظات</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="input"
              placeholder="أدخل أي ملاحظات إضافية (اختياري)"
              rows={2}
              disabled={loading}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 space-x-reverse pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <LoadingSpinner size="small" />
              ) : (
                <>
                  <Save className="h-4 w-4 ml-2" />
                  {mode === 'create' ? 'إضافة العميل' : 'حفظ التغييرات'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CustomerFormModal
