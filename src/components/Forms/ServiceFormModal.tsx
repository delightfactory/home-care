import React, { useState, useEffect } from 'react'
import { X, Save, Wrench } from 'lucide-react'
import { ServicesAPI } from '../../api'
import { Service, ServiceForm, ServiceCategory } from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
import toast from 'react-hot-toast'

interface ServiceFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  service?: Service
  mode: 'create' | 'edit'
  categories: ServiceCategory[]
}

const ServiceFormModal: React.FC<ServiceFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  service,
  mode,
  categories
}) => {
  const [formData, setFormData] = useState<ServiceForm>({
    category_id: '',
    name: '',
    name_ar: '',
    description: '',
    price: 0,
    unit: '',
    estimated_duration: 0
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (service && mode === 'edit') {
      setFormData({
        category_id: service.category_id || '',
        name: service.name || '',
        name_ar: service.name_ar || '',
        description: service.description || '',
        price: service.price || 0,
        unit: service.unit || '',
        estimated_duration: service.estimated_duration || 0
      })
    } else {
      setFormData({
        category_id: '',
        name: '',
        name_ar: '',
        description: '',
        price: 0,
        unit: '',
        estimated_duration: 0
      })
    }
    setErrors({})
  }, [service, mode, isOpen])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.category_id) {
      newErrors.category_id = 'فئة الخدمة مطلوبة'
    }

    if (!formData.name.trim()) {
      newErrors.name = 'اسم الخدمة بالإنجليزية مطلوب'
    }

    if (!formData.name_ar.trim()) {
      newErrors.name_ar = 'اسم الخدمة بالعربية مطلوب'
    }

    if (!formData.price || formData.price <= 0) {
      newErrors.price = 'السعر مطلوب ويجب أن يكون أكبر من صفر'
    }

    if (!formData.unit.trim()) {
      newErrors.unit = 'وحدة القياس مطلوبة'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    try {
      if (mode === 'create') {
        await ServicesAPI.createService(formData)
        toast.success('تم إضافة الخدمة بنجاح')
      } else {
        await ServicesAPI.updateService(service!.id, formData)
        toast.success('تم تحديث بيانات الخدمة بنجاح')
      }
      
      onSuccess()
      onClose()
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ البيانات')
      console.error('Service form error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'number' ? parseFloat(value) || 0 : value 
    }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-primary-100 rounded-lg ml-3">
              <Wrench className="h-5 w-5 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === 'create' ? 'إضافة خدمة جديدة' : 'تعديل بيانات الخدمة'}
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
            <label className="label label-required">فئة الخدمة</label>
            <select
              name="category_id"
              value={formData.category_id}
              onChange={handleChange}
              className={`input ${errors.category_id ? 'input-error' : ''}`}
              disabled={loading}
            >
              <option value="">اختر فئة الخدمة</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name_ar}
                </option>
              ))}
            </select>
            {errors.category_id && (
              <p className="text-sm text-red-600 mt-1">{errors.category_id}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label label-required">اسم الخدمة (عربي)</label>
              <input
                type="text"
                name="name_ar"
                value={formData.name_ar}
                onChange={handleChange}
                className={`input ${errors.name_ar ? 'input-error' : ''}`}
                placeholder="أدخل اسم الخدمة بالعربية"
                disabled={loading}
              />
              {errors.name_ar && (
                <p className="text-sm text-red-600 mt-1">{errors.name_ar}</p>
              )}
            </div>

            <div>
              <label className="label label-required">اسم الخدمة (إنجليزي)</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`input ${errors.name ? 'input-error' : ''}`}
                placeholder="Enter service name in English"
                disabled={loading}
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name}</p>
              )}
            </div>
          </div>

          <div>
            <label className="label">وصف الخدمة</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="input"
              placeholder="أدخل وصف الخدمة (اختياري)"
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label label-required">السعر (ج.م)</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className={`input ${errors.price ? 'input-error' : ''}`}
                placeholder="0.00"
                min="0"
                step="0.01"
                disabled={loading}
              />
              {errors.price && (
                <p className="text-sm text-red-600 mt-1">{errors.price}</p>
              )}
            </div>

            <div>
              <label className="label label-required">وحدة القياس</label>
              <select
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                className={`input ${errors.unit ? 'input-error' : ''}`}
                disabled={loading}
              >
                <option value="">اختر وحدة القياس</option>
                <option value="غرفة">غرفة</option>
                <option value="متر مربع">متر مربع</option>
                <option value="ساعة">ساعة</option>
                <option value="قطعة">قطعة</option>
                <option value="مرة واحدة">مرة واحدة</option>
              </select>
              {errors.unit && (
                <p className="text-sm text-red-600 mt-1">{errors.unit}</p>
              )}
            </div>
          </div>

          <div>
            <label className="label">المدة المتوقعة (دقيقة)</label>
            <input
              type="number"
              name="estimated_duration"
              value={formData.estimated_duration}
              onChange={handleChange}
              className="input"
              placeholder="0"
              min="0"
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
                  {mode === 'create' ? 'إضافة الخدمة' : 'حفظ التغييرات'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ServiceFormModal
