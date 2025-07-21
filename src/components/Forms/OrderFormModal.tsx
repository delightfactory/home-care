import React, { useState, useEffect } from 'react'
import { X, Save, ShoppingCart, Plus, Trash2 } from 'lucide-react'
import { OrdersAPI, CustomersAPI, ServicesAPI, TeamsAPI } from '../../api'
import { useAuth } from '../../contexts/AuthContext'
import { Order, OrderForm, Customer, ServiceWithCategory, OrderWithDetails, TeamWithMembers } from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
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
  const [customers, setCustomers] = useState<Customer[]>([])
  const [services, setServices] = useState<ServiceWithCategory[]>([])
  const [teams, setTeams] = useState<TeamWithMembers[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
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

  const fetchInitialData = async () => {
    try {
      setLoadingData(true)
      const [customersResponse, servicesData, teamsData] = await Promise.all([
        CustomersAPI.getCustomers(),
        ServicesAPI.getServices(),
        TeamsAPI.getTeams()
      ])
      
      setCustomers(customersResponse.data)
      setServices(servicesData)
      setTeams(teamsData)
    } catch (error) {
      toast.error('حدث خطأ في تحميل البيانات')
      console.error('Order form data fetch error:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const validateForm = (): boolean => {
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

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

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
        
        const response = await OrdersAPI.createOrder(orderData, orderItems)
        if (response.success) {
          toast.success('تم إضافة الطلب بنجاح')
        } else {
          throw new Error(response.error || 'Create order failed')
        }
      } else {
        await OrdersAPI.updateOrder(order!.id, formData)
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
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-primary-100 rounded-lg ml-3">
              <ShoppingCart className="h-5 w-5 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === 'create' ? 'إضافة طلب جديد' : 'تعديل بيانات الطلب'}
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
        {loadingData ? (
          <div className="p-8 flex justify-center">
            <LoadingSpinner size="large" text="جاري تحميل البيانات..." />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Customer Selection */}
            <div>
              <label className="label label-required">العميل</label>
              <select
                name="customer_id"
                value={formData.customer_id}
                onChange={handleChange}
                className={`input ${errors.customer_id ? 'input-error' : ''}`}
                disabled={loading}
              >
                <option value="">اختر العميل</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} - {customer.phone}
                  </option>
                ))}
              </select>
              {errors.customer_id && (
                <p className="text-sm text-red-600 mt-1">{errors.customer_id}</p>
              )}
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label label-required">تاريخ الخدمة</label>
                <input
                  type="date"
                  name="scheduled_date"
                  value={formData.scheduled_date}
                  onChange={handleChange}
                  className={`input ${errors.scheduled_date ? 'input-error' : ''}`}
                  min={new Date().toISOString().split('T')[0]}
                  disabled={loading}
                />
                {errors.scheduled_date && (
                  <p className="text-sm text-red-600 mt-1">{errors.scheduled_date}</p>
                )}
              </div>

              <div>
                <label className="label label-required">وقت الخدمة</label>
                <input
                  type="time"
                  name="scheduled_time"
                  value={formData.scheduled_time}
                  onChange={handleChange}
                  className={`input ${errors.scheduled_time ? 'input-error' : ''}`}
                  disabled={loading}
                />
                {errors.scheduled_time && (
                  <p className="text-sm text-red-600 mt-1">{errors.scheduled_time}</p>
                )}
              </div>
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
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">إجمالي المبلغ:</span>
                  <span className="text-lg font-bold text-primary-600">
                    {calculateTotal().toFixed(2)} ج.م
                  </span>
                </div>
              </div>
            </div>

            {/* Team Selection */}
            <div>
              <label className="label">الفريق (اختياري)</label>
              <select
                name="team_id"
                value={formData.team_id}
                onChange={handleChange}
                className="input"
                disabled={loading}
              >
                <option value="">غير محدد</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>

            {/* Transport Method */}
            <div>
              <label className="label">وسيلة المواصلات</label>
              <select
                name="transport_method"
                value={formData.transport_method}
                onChange={handleChange}
                className="input"
                disabled={loading}
              >
                <option value="company_car">سيارة الشركة</option>
                <option value="taxi">تاكسي</option>
                <option value="uber">أوبر</option>
                <option value="public_transport">مواصلات عامة</option>
              </select>
            </div>

            {/* Payment Status */}
            <div>
              <label className="label">حالة الدفع</label>
              <select
                name="payment_status"
                value={formData.payment_status}
                onChange={handleChange}
                className="input"
                disabled={loading}
              >
                <option value="unpaid">غير مدفوع</option>
                <option value="paid_cash">مدفوع نقدًا</option>
                <option value="paid_card">مدفوع بالبطاقة</option>
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="label">طريقة الدفع</label>
              <select
                name="payment_method"
                value={formData.payment_method}
                onChange={handleChange}
                className="input"
                disabled={loading}
              >
                <option value="cash">نقدًا</option>
                <option value="card">بطاقة</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="label">ملاحظات</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="input"
                placeholder="أدخل أي ملاحظات إضافية (اختياري)"
                rows={3}
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
                    {mode === 'create' ? 'إضافة الطلب' : 'حفظ التغييرات'}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default OrderFormModal
