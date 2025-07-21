import React, { useState, useEffect } from 'react'
import { X, Save, Wrench, Tag, DollarSign, Clock, FileText, CheckCircle, Globe } from 'lucide-react'
import { ServicesAPI } from '../../api'
import { Service, ServiceForm, ServiceCategory } from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
import SmartModal from '../UI/SmartModal'
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
    estimated_duration: undefined
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (service && mode === 'edit') {
      setFormData({
        category_id: service.category_id || '',
        name: service.name || '',
        name_ar: service.name_ar || '',
        description: service.description || '',
        price: service.price || 0,
        unit: service.unit || '',
        estimated_duration: service.estimated_duration || undefined
      })
    } else {
      setFormData({
        category_id: '',
        name: '',
        name_ar: '',
        description: '',
        price: 0,
        unit: '',
        estimated_duration: undefined
      })
    }
    setErrors({})
  }, [service, mode, isOpen])

  const validateForm = (): Record<string, string> => {
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

    return newErrors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationErrors = validateForm()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

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
      [name]: type === 'number' ? (value === '' ? undefined : parseFloat(value) || 0) : value 
    }))
    
    // Mark field as touched
    setTouched(prev => ({ ...prev, [name]: true }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
      title={mode === 'create' ? 'إضافة خدمة جديدة' : 'تعديل بيانات الخدمة'}
      subtitle={mode === 'create' ? 'أدخل بيانات الخدمة الجديدة' : 'قم بتعديل بيانات الخدمة'}
      icon={<Wrench className="h-6 w-6 text-white" />}
      size="lg"
      headerGradient="from-primary-500 to-primary-700"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="flex items-center label label-required text-gray-700 font-medium">
              <Tag className="h-4 w-4 ml-2 text-primary-500" />
              فئة الخدمة
            </label>
            <div className="relative">
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pl-10 ${errors.category_id ? 'input-error border-red-500 focus:ring-red-500' : 'hover:border-primary-300'} ${touched.category_id && !errors.category_id && formData.category_id ? 'border-green-500 focus:ring-green-500' : ''}`}
                disabled={loading}
              >
                <option value="">اختر فئة الخدمة</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name_ar}
                  </option>
                ))}
              </select>
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                {touched.category_id && !errors.category_id && formData.category_id ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Tag className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
            {errors.category_id && (
              <p className="text-sm text-red-600 mt-1 animate-bounce-in flex items-center">
                <X className="h-3 w-3 ml-1" />
                {errors.category_id}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="flex items-center label label-required text-gray-700 font-medium">
                <Wrench className="h-4 w-4 ml-2 text-primary-500" />
                اسم الخدمة (عربي)
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="name_ar"
                  value={formData.name_ar}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pl-10 ${errors.name_ar ? 'input-error border-red-500 focus:ring-red-500' : 'hover:border-primary-300'} ${touched.name_ar && !errors.name_ar && formData.name_ar ? 'border-green-500 focus:ring-green-500' : ''}`}
                  placeholder="أدخل اسم الخدمة بالعربية"
                  disabled={loading}
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  {touched.name_ar && !errors.name_ar && formData.name_ar ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Wrench className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
              {errors.name_ar && (
                <p className="text-sm text-red-600 mt-1 animate-bounce-in flex items-center">
                  <X className="h-3 w-3 ml-1" />
                  {errors.name_ar}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="flex items-center label label-required text-gray-700 font-medium">
                <Globe className="h-4 w-4 ml-2 text-primary-500" />
                اسم الخدمة (إنجليزي)
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pl-10 ${errors.name ? 'input-error border-red-500 focus:ring-red-500' : 'hover:border-primary-300'} ${touched.name && !errors.name && formData.name ? 'border-green-500 focus:ring-green-500' : ''}`}
                  placeholder="Enter service name in English"
                  disabled={loading}
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  {touched.name && !errors.name && formData.name ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Globe className="h-4 w-4 text-gray-400" />
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
          </div>

          <div className="space-y-2">
            <label className="flex items-center label text-gray-700 font-medium">
              <FileText className="h-4 w-4 ml-2 text-primary-500" />
              وصف الخدمة
            </label>
            <div className="relative">
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${touched.description && formData.description ? 'border-green-500 focus:ring-green-500' : ''}`}
                placeholder="أدخل وصف الخدمة (اختياري)"
                rows={3}
                disabled={loading}
              />
              <div className="absolute left-3 top-3">
                {touched.description && formData.description ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <FileText className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
            {formData.description && (
              <p className="text-xs text-gray-500">
                {formData.description.length} حرف
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="flex items-center label label-required text-gray-700 font-medium">
                <DollarSign className="h-4 w-4 ml-2 text-primary-500" />
                السعر (ج.م)
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pl-10 ${errors.price ? 'input-error border-red-500 focus:ring-red-500' : 'hover:border-primary-300'} ${touched.price && !errors.price && formData.price > 0 ? 'border-green-500 focus:ring-green-500' : ''}`}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  disabled={loading}
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  {touched.price && !errors.price && formData.price > 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
              {errors.price && (
                <p className="text-sm text-red-600 mt-1 animate-bounce-in flex items-center">
                  <X className="h-3 w-3 ml-1" />
                  {errors.price}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="flex items-center label label-required text-gray-700 font-medium">
                <Tag className="h-4 w-4 ml-2 text-primary-500" />
                وحدة القياس
              </label>
              <div className="relative">
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pl-10 ${errors.unit ? 'input-error border-red-500 focus:ring-red-500' : 'hover:border-primary-300'} ${touched.unit && !errors.unit && formData.unit ? 'border-green-500 focus:ring-green-500' : ''}`}
                  disabled={loading}
                >
                  <option value="">اختر وحدة القياس</option>
                  <option value="غرفة">غرفة</option>
                  <option value="متر مربع">متر مربع</option>
                  <option value="ساعة">ساعة</option>
                  <option value="قطعة">قطعة</option>
                  <option value="مرة واحدة">مرة واحدة</option>
                </select>
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  {touched.unit && !errors.unit && formData.unit ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Tag className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
              {errors.unit && (
                <p className="text-sm text-red-600 mt-1 animate-bounce-in flex items-center">
                  <X className="h-3 w-3 ml-1" />
                  {errors.unit}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center label text-gray-700 font-medium">
              <Clock className="h-4 w-4 ml-2 text-primary-500" />
              المدة المتوقعة (دقيقة)
            </label>
            <div className="relative">
              <input
                type="number"
                name="estimated_duration"
                value={formData.estimated_duration || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${touched.estimated_duration && formData.estimated_duration && formData.estimated_duration > 0 ? 'border-green-500 focus:ring-green-500' : ''}`}
                placeholder="0"
                min="0"
                disabled={loading}
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                {touched.estimated_duration && formData.estimated_duration && formData.estimated_duration > 0 ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Clock className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
            {formData.estimated_duration && formData.estimated_duration > 0 && (
              <p className="text-xs text-gray-500">
                المدة المتوقعة: {Math.floor(formData.estimated_duration / 60)} ساعة و {formData.estimated_duration % 60} دقيقة
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
                <LoadingSpinner size="small" />
                <span className="mr-2">جاري الحفظ...</span>
              </div>
            ) : (
              <div className="flex items-center">
                <Save className="h-4 w-4 ml-2" />
                {mode === 'create' ? 'إضافة الخدمة' : 'حفظ التغييرات'}
              </div>
            )}
          </button>
        </div>
      </form>
    </SmartModal>
  )
}

export default ServiceFormModal
