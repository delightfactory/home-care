import React, { useState, useEffect } from 'react'
import { X, Save, User, MapPin, Phone, Home, FileText, CheckCircle } from 'lucide-react'
import EnhancedAPI from '../../api/enhanced-api'
import { Customer, CustomerForm } from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
import SmartModal from '../UI/SmartModal'
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
  const [touched, setTouched] = useState<Record<string, boolean>>({})

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

  const validateForm = (): Record<string, string> => {
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

    return newErrors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationErrors = validateForm()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

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
        const res = await EnhancedAPI.createCustomer(payload)
        if (!res.success) throw new Error(res.error || 'فشل في إضافة العميل')
        
        toast.success('تم إضافة العميل بنجاح')
      } else {
        const res = await EnhancedAPI.updateCustomer(customer!.id, payload)
        if (!res.success) throw new Error(res.error || 'فشل في تحديث بيانات العميل')
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
    
    // Mark field as touched
    setTouched(prev => ({ ...prev, [name]: true }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))
    
    // Validate on blur
    const validationErrors = validateForm()
    if (validationErrors[name]) {
      setErrors(prev => ({ ...prev, [name]: validationErrors[name] }))
    }
  }

  if (!isOpen) return null

  return (
    <SmartModal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'إضافة عميل جديد' : 'تعديل بيانات العميل'}
      subtitle={mode === 'create' ? 'أدخل بيانات العميل الجديد' : 'قم بتعديل بيانات العميل'}
      icon={<User className="h-6 w-6 text-white" />}
      size="md"
      headerGradient="from-primary-500 via-primary-600 to-primary-700"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="flex items-center label label-required text-gray-700 font-medium">
              <User className="h-4 w-4 ml-2 text-primary-500" />
              اسم العميل
            </label>
            <div className="relative">
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pl-10 ${errors.name ? 'input-error border-red-500 focus:ring-red-500' : 'hover:border-primary-300'} ${touched.name && !errors.name && formData.name ? 'border-green-500 focus:ring-green-500' : ''}`}
                placeholder="أدخل اسم العميل"
                disabled={loading}
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                {touched.name && !errors.name && formData.name ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <User className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
            {errors.name && (
              <p className="text-sm text-red-600 mt-1 animate-bounce-in flex items-center">
                <X className="h-3 w-3 ml-1" />
                {errors.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center label label-required text-gray-700 font-medium">
              <Phone className="h-4 w-4 ml-2 text-primary-500" />
              رقم الهاتف
            </label>
            <div className="relative">
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pl-10 ${errors.phone ? 'input-error border-red-500 focus:ring-red-500' : 'hover:border-primary-300'} ${touched.phone && !errors.phone && formData.phone ? 'border-green-500 focus:ring-green-500' : ''}`}
                placeholder="أدخل رقم الهاتف"
                disabled={loading}
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                {touched.phone && !errors.phone && formData.phone ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Phone className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
            {errors.phone && (
              <p className="text-sm text-red-600 mt-1 animate-bounce-in flex items-center">
                <X className="h-3 w-3 ml-1" />
                {errors.phone}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center label label-required text-gray-700 font-medium">
              <Home className="h-4 w-4 ml-2 text-primary-500" />
              العنوان
            </label>
            <div className="relative">
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pl-10 ${errors.address ? 'input-error border-red-500 focus:ring-red-500' : 'hover:border-primary-300'} ${touched.address && !errors.address && formData.address ? 'border-green-500 focus:ring-green-500' : ''}`}
                placeholder="أدخل العنوان التفصيلي"
                rows={3}
                disabled={loading}
              />
              <div className="absolute left-3 top-3">
                {touched.address && !errors.address && formData.address ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Home className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
            {errors.address && (
              <p className="text-sm text-red-600 mt-1 animate-bounce-in flex items-center">
                <X className="h-3 w-3 ml-1" />
                {errors.address}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center label text-gray-700 font-medium">
              <MapPin className="h-4 w-4 ml-2 text-primary-500" />
              المنطقة
            </label>
            <div className="relative">
              <input
                type="text"
                name="area"
                value={formData.area}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${touched.area && formData.area ? 'border-green-500 focus:ring-green-500' : ''}`}
                placeholder="أدخل المنطقة (اختياري)"
                disabled={loading}
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                {touched.area && formData.area ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <MapPin className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
          </div>

          {/* Coordinates */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="flex items-center text-sm font-medium text-gray-700 mb-3">
              <MapPin className="h-4 w-4 ml-2 text-primary-500" />
              الإحداثيات الجغرافية (اختياري)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label text-sm">دوائر العرض (Latitude)</label>
                <input
                  type="number"
                  name="latitude"
                  value={formData.latitude ?? ''}
                  onChange={handleChange}
                  className="input text-sm transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300"
                  placeholder="مثال: 30.0444"
                  step="0.0001"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="label text-sm">خطوط الطول (Longitude)</label>
                <input
                  type="number"
                  name="longitude"
                  value={formData.longitude ?? ''}
                  onChange={handleChange}
                  className="input text-sm transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300"
                  placeholder="مثال: 31.2357"
                  step="0.0001"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Active Toggle */}
          <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
            <label className="inline-flex items-center cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active ?? true}
                  onChange={handleChange}
                  className="sr-only"
                />
                <div className={`relative w-11 h-6 rounded-full transition-all duration-200 ${formData.is_active ? 'bg-primary-500' : 'bg-gray-300'}`}>
                  <div
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${formData.is_active ? 'right-0.5' : 'left-0.5'}`}
                    ></div>
                </div>
              </div>
              <span className="ml-3 text-gray-700 font-medium group-hover:text-primary-600 transition-colors duration-200">
                العميل نشط
              </span>
              {formData.is_active && (
                <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
              )}
            </label>
            <p className="text-xs text-gray-500 mt-2">
              {formData.is_active ? 'العميل متاح لاستقبال الطلبات' : 'العميل غير متاح حالياً'}
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center label text-gray-700 font-medium">
              <FileText className="h-4 w-4 ml-2 text-primary-500" />
              ملاحظات
            </label>
            <div className="relative">
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${touched.notes && formData.notes ? 'border-green-500 focus:ring-green-500' : ''}`}
                placeholder="أدخل أي ملاحظات إضافية (اختياري)"
                rows={3}
                disabled={loading}
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
          <div className="flex justify-end space-x-3 space-x-reverse pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              disabled={loading}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center">
                  <LoadingSpinner size="small" variant="dots" />
                  <span className="mr-2">جاري الحفظ...</span>
                </div>
              ) : (
                <div className="flex items-center">
                  <Save className="h-4 w-4 ml-2" />
                  {mode === 'create' ? 'إضافة العميل' : 'حفظ التغييرات'}
                </div>
              )}
            </button>
          </div>
        </form>
    </SmartModal>
  )
}

export default CustomerFormModal
