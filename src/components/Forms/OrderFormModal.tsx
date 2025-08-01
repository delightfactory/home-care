import React, { useState, useEffect } from 'react'
import { Save, ShoppingCart, Plus, Trash2, User, Truck, FileText, CheckCircle, DollarSign, CreditCard, UserPlus } from 'lucide-react'
import { OrdersAPI, ServicesAPI, TeamsAPI } from '../../api'
import EnhancedAPI from '../../api/enhanced-api'
import { useAuth } from '../../contexts/AuthContext'
import { Order, OrderForm, ServiceWithCategory, OrderWithDetails, TeamWithMembers } from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
import SmartModal from '../UI/SmartModal'
import DateTimePicker from '../UI/DateTimePicker'
import CustomerSearchInput from '../UI/CustomerSearchInput'
import CustomerFormModal from './CustomerFormModal'
import toast from 'react-hot-toast'

interface OrderFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  order?: Order
  mode: 'create' | 'edit'
}

const OrderFormModal: React.FC<OrderFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  order,
  mode
}) => {
  const [formData, setFormData] = useState<OrderForm>({
    customer_id: '',
    scheduled_date: '',
    scheduled_time: '',
    services: [{ service_id: '', quantity: 1 }],
    team_id: '',
    payment_status: 'unpaid' as any,
    payment_method: 'cash' as any,
    transport_method: 'company_car' as any,
    notes: ''
  })
  // Customer search is now handled by CustomerSearchInput component
  const [services, setServices] = useState<ServiceWithCategory[]>([])
  const [teams, setTeams] = useState<TeamWithMembers[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [showCustomerModal, setShowCustomerModal] = useState(false)
 const { user } = useAuth()

  useEffect(() => {
    if (isOpen) {
      fetchInitialData()
    }
  }, [isOpen])

  useEffect(() => {
    if (order && mode === 'edit') {
      setFormData({
        customer_id: order.customer_id,
        scheduled_date: order.scheduled_date,
        scheduled_time: order.scheduled_time,
        services: (order as OrderWithDetails).items?.map((item: any) => ({
          service_id: item.service_id,
          quantity: item.quantity
        })) || [{ service_id: '', quantity: 1 }],
        team_id: order.team_id || '',
        payment_status: (order.payment_status as any) || 'unpaid',
        payment_method: (order.payment_method as any) || 'cash',
        transport_method: (order.transport_method as any) || 'company_car',
        notes: order.notes || ''
      })
    } else {
      setFormData({
        customer_id: '',
        scheduled_date: '',
        scheduled_time: '',
        services: [{ service_id: '', quantity: 1 }],
        team_id: '',
        payment_status: 'unpaid' as any,
        payment_method: 'cash' as any,
        transport_method: 'company_car' as any,
        notes: ''
      })
    }
    setErrors({})

  
  }, [order, mode, isOpen])

  // Fetch detailed order items when editing and items not present
  useEffect(() => {
    const loadDetails = async () => {
      if (!isOpen || mode !== 'edit' || !order) return
      if ((order as OrderWithDetails).items && (order as OrderWithDetails).items!.length) return
      try {
        const detailed = await OrdersAPI.getOrderById(order.id)
        if (detailed && detailed.items) {
          setFormData(prev => ({
            ...prev,
            services: (detailed.items ?? []).map(it => ({
              service_id: it.service_id ?? '',
              quantity: it.quantity
            }))
          }))
        }
      } catch (err) {
        console.error('Could not load order items:', err)
      }
    }
    loadDetails()
  }, [isOpen, mode, order])

  const fetchInitialData = async () => {
    try {
      setLoadingData(true)
      const [servicesData, teamsData] = await Promise.all([
        ServicesAPI.getServices(),
        TeamsAPI.getTeams()
      ])
      
      setServices(servicesData)
      setTeams(teamsData)
    } catch (error) {
      toast.error('حدث خطأ في تحميل البيانات')
      console.error('Order form data fetch error:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const validateForm = (): Record<string, string> => {
    const newErrors: Record<string, string> = {}

    if (!formData.customer_id) {
      newErrors.customer_id = 'العميل مطلوب'
    }

    if (!formData.scheduled_date) {
      newErrors.scheduled_date = 'تاريخ الخدمة مطلوب'
    }

    if (!formData.scheduled_time) {
      newErrors.scheduled_time = 'وقت الخدمة مطلوب'
    }

    if (formData.services.length === 0) {
      newErrors.services = 'يجب إضافة خدمة واحدة على الأقل'
    } else {
      const hasEmptyService = formData.services.some(service => !service.service_id)
      if (hasEmptyService) {
        newErrors.services = 'يجب اختيار جميع الخدمات'
      }
    }

    return newErrors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationErrors = validateForm()
    setErrors(validationErrors)
    
    if (Object.keys(validationErrors).length > 0) {
      // Focus on first error field
      const firstErrorField = Object.keys(validationErrors)[0]
      const errorElement = document.querySelector(`[name="${firstErrorField}"]`) as HTMLElement
      if (errorElement) {
        errorElement.focus()
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      
      toast.error('يرجى تصحيح الأخطاء المذكورة أعلاه')
      return
    }

    setLoading(true)
    try {
      if (mode === 'create') {
        // Prepare order data
        const orderData = {
          customer_id: formData.customer_id,
          scheduled_date: formData.scheduled_date,
          scheduled_time: formData.scheduled_time,
          team_id: formData.team_id || null,
          payment_status: formData.payment_status,
          payment_method: formData.payment_method,
          transport_method: formData.transport_method,
          notes: formData.notes,
          created_by: user?.id || undefined
        }
        
        // Prepare order items with prices
        const orderItems = formData.services.map(serviceItem => {
          const service = services.find(s => s.id === serviceItem.service_id)
          return {
            service_id: serviceItem.service_id,
            quantity: serviceItem.quantity,
            unit_price: service?.price || 0,
            total_price: (service?.price || 0) * serviceItem.quantity
          }
        })
        
        const response = await EnhancedAPI.createOrder(orderData, orderItems)
        if (response.success) {
          toast.success('تم إضافة الطلب بنجاح')
        } else {
          throw new Error(response.error || 'Create order failed')
        }
      } else {
        // Update order base fields first (exclude services)
        const { services: svc, ...orderUpdates } = formData as any
        const updateRes = await EnhancedAPI.updateOrder(order!.id, orderUpdates)
        if (!updateRes.success) throw new Error(updateRes.error || 'Update failed')

        // Recalculate items with prices
        const orderItems = formData.services.map(serviceItem => {
          const service = services.find(s => s.id === serviceItem.service_id)
          return {
            service_id: serviceItem.service_id,
            quantity: serviceItem.quantity,
            unit_price: service?.price || 0,
            total_price: (service?.price || 0) * serviceItem.quantity
          }
        })
        const replaceRes = await EnhancedAPI.replaceOrderItems(order!.id, orderItems)
        if (!replaceRes.success) throw new Error(replaceRes.error || 'Failed to update الخدمات')
        toast.success('تم تحديث بيانات الطلب بنجاح')
      }
      
      onSuccess()
      onClose()
    } catch (error) {
      toast.error((error as Error).message || 'حدث خطأ أثناء حفظ البيانات')
      console.error('Order form error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
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
  }

  const handleServiceChange = (index: number, field: 'service_id' | 'quantity', value: string | number) => {
    const updatedServices = [...formData.services]
    updatedServices[index] = {
      ...updatedServices[index],
      [field]: value
    }
    setFormData(prev => ({ ...prev, services: updatedServices }))
    
    if (errors.services) {
      setErrors(prev => ({ ...prev, services: '' }))
    }
  }

  const addService = () => {
    setFormData(prev => ({
      ...prev,
      services: [...prev.services, { service_id: '', quantity: 1 }]
    }))
  }

  const removeService = (index: number) => {
    if (formData.services.length > 1) {
      const updatedServices = formData.services.filter((_, i) => i !== index)
      setFormData(prev => ({ ...prev, services: updatedServices }))
    }
  }

  const calculateTotal = () => {
    return formData.services.reduce((total, serviceItem) => {
      const service = services.find(s => s.id === serviceItem.service_id)
      return total + (service ? service.price * serviceItem.quantity : 0)
    }, 0)
  }

  const handleCustomerCreated = async (newCustomer?: any) => {
    setShowCustomerModal(false)
    
    if (newCustomer) {
      // Automatically set the new customer in the order form
      setFormData(prev => ({ ...prev, customer_id: newCustomer.id }))
      setTouched(prev => ({ ...prev, customer_id: true }))
      
      // Clear any customer selection errors
      if (errors.customer_id) {
        setErrors(prev => ({ ...prev, customer_id: '' }))
      }
      
      toast.success(`تم إنشاء العميل "${newCustomer.name}" بنجاح وتم تحديده في الطلب!`)
    }
  }

  if (!isOpen) return null

  return (
    <SmartModal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'إضافة طلب جديد' : 'تعديل بيانات الطلب'}
      subtitle={mode === 'create' ? 'أدخل بيانات الطلب الجديد' : 'قم بتعديل بيانات الطلب'}
      icon={<ShoppingCart className="h-6 w-6 text-white" />}
      size="xl"
      headerGradient="from-primary-500 via-primary-600 to-primary-700"
    >

      {loadingData ? (
        <div className="p-8 flex justify-center">
          <LoadingSpinner size="large" text="جاري تحميل البيانات..." />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Required fields notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-blue-400" />
              </div>
              <div className="mr-3">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">الحقول المطلوبة:</span> العميل، تاريخ الخدمة، وقت الخدمة، والخدمات المطلوبة
                </p>
              </div>
            </div>
          </div>
          
            {/* Customer Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="label label-required text-gray-700 font-medium">
                  العميل
                </label>
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(true)}
                  className="flex items-center px-3 py-1.5 text-sm bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  disabled={loading}
                >
                  <UserPlus className="h-4 w-4 ml-1" />
                  إضافة عميل جديد
                </button>
              </div>
              <CustomerSearchInput
                value={formData.customer_id}
                onChange={(customerId, _customer) => {
                  setFormData(prev => ({ ...prev, customer_id: customerId }))
                  setTouched(prev => ({ ...prev, customer_id: true }))
                  // Clear error when customer is selected
                  if (customerId && errors.customer_id) {
                    setErrors(prev => ({ ...prev, customer_id: '' }))
                  }
                }}
                onBlur={() => setTouched(prev => ({ ...prev, customer_id: true }))}
                error={touched.customer_id ? errors.customer_id : undefined}
                disabled={loading}
                required
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DateTimePicker
                type="date"
                value={formData.scheduled_date}
                onChange={(value) => setFormData(prev => ({ ...prev, scheduled_date: value }))}
                label="تاريخ الخدمة"
                placeholder="اختر تاريخ الخدمة"
                required
                disabled={loading}
                error={errors.scheduled_date}
                minDate={new Date().toISOString().split('T')[0]}
                name="scheduled_date"
              />

              <DateTimePicker
                type="time"
                value={formData.scheduled_time}
                onChange={(value) => setFormData(prev => ({ ...prev, scheduled_time: value }))}
                label="وقت الخدمة"
                placeholder="اختر وقت الخدمة"
                required
                disabled={loading}
                error={errors.scheduled_time}
                name="scheduled_time"
              />
            </div>

            {/* Services */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="label label-required">الخدمات المطلوبة</label>
                <button
                  type="button"
                  onClick={addService}
                  className="btn-secondary text-sm"
                  disabled={loading}
                >
                  <Plus className="h-4 w-4 ml-1" />
                  إضافة خدمة
                </button>
              </div>

              <div className="space-y-3">
                {formData.services.map((serviceItem, index) => (
                  <div key={index} className="flex items-center space-x-3 space-x-reverse p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <select
                        value={serviceItem.service_id}
                        onChange={(e) => handleServiceChange(index, 'service_id', e.target.value)}
                        className="input"
                        disabled={loading}
                        name={index === 0 ? "services" : undefined}
                      >
                        <option value="">اختر الخدمة</option>
                        {services.map(service => (
                          <option key={service.id} value={service.id}>
                            {service.name_ar} - {service.price} ج.م/{service.unit}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="w-24">
                      <input
                        type="number"
                        value={serviceItem.quantity}
                        onChange={(e) => handleServiceChange(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="input text-center"
                        min="1"
                        disabled={loading}
                      />
                    </div>

                    {formData.services.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeService(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {errors.services && (
                <p className="text-sm text-red-600 mt-1">{errors.services}</p>
              )}

              {/* Total */}
              <div className="mt-4 p-4 bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl border border-primary-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <DollarSign className="h-5 w-5 text-primary-600 ml-2" />
                    <span className="font-medium text-gray-700">إجمالي المبلغ:</span>
                  </div>
                  <span className="text-xl font-bold text-primary-600 bg-white px-3 py-1 rounded-lg shadow-sm">
                    {calculateTotal().toFixed(2)} ج.م
                  </span>
                </div>
              </div>
            </div>

            {/* Team Selection */}
            <div className="space-y-2">
              <label className="flex items-center label text-gray-700 font-medium">
                <User className="h-4 w-4 ml-2 text-primary-500" />
                الفريق (اختياري)
              </label>
              <div className="relative">
                <select
                  name="team_id"
                  value={formData.team_id}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${touched.team_id && formData.team_id ? 'border-green-500 focus:ring-green-500' : ''}`}
                  disabled={loading}
                >
                  <option value="">غير محدد</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  {touched.team_id && formData.team_id ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <User className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Transport Method */}
            <div className="space-y-2">
              <label className="flex items-center label text-gray-700 font-medium">
                <Truck className="h-4 w-4 ml-2 text-primary-500" />
                وسيلة المواصلات
              </label>
              <div className="relative">
                <select
                  name="transport_method"
                  value={formData.transport_method}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${touched.transport_method && formData.transport_method ? 'border-green-500 focus:ring-green-500' : ''}`}
                  disabled={loading}
                >
                  <option value="company_car">سيارة الشركة</option>
                  <option value="taxi">تاكسي</option>
                  <option value="uber">أوبر</option>
                  <option value="public_transport">مواصلات عامة</option>
                </select>
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Truck className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Payment Status & Method */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="flex items-center label text-gray-700 font-medium">
                  <CreditCard className="h-4 w-4 ml-2 text-primary-500" />
                  حالة الدفع
                </label>
                <div className="relative">
                  <select
                    name="payment_status"
                    value={formData.payment_status}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${touched.payment_status && formData.payment_status ? 'border-green-500 focus:ring-green-500' : ''}`}
                    disabled={loading}
                  >
                    <option value="unpaid">غير مدفوع</option>
                    <option value="paid_cash">مدفوع نقدًا</option>
                    <option value="paid_card">مدفوع بالبطاقة</option>
                  </select>
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <CreditCard className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center label text-gray-700 font-medium">
                  <DollarSign className="h-4 w-4 ml-2 text-primary-500" />
                  طريقة الدفع
                </label>
                <div className="relative">
                  <select
                    name="payment_method"
                    value={formData.payment_method}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${touched.payment_method && formData.payment_method ? 'border-green-500 focus:ring-green-500' : ''}`}
                    disabled={loading}
                  >
                    <option value="cash">نقدًا</option>
                    <option value="card">بطاقة</option>
                  </select>
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  </div>
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
                    <LoadingSpinner size="small" />
                    <span className="mr-2">جاري الحفظ...</span>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Save className="h-4 w-4 ml-2" />
                    {mode === 'create' ? 'إضافة الطلب' : 'حفظ التغييرات'}
                  </div>
                )}
              </button>
            </div>
        </form>
      )}
      
      {/* Customer Creation Modal */}
      <CustomerFormModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onSuccess={handleCustomerCreated}
        mode="create"
      />
    </SmartModal>
  )
}

export default OrderFormModal
