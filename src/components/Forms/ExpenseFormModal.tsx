import React, { useState, useEffect } from 'react'
import { X, Save, Receipt, Tag, Users, ShoppingCart, Route, DollarSign, FileText, Image, CheckCircle } from 'lucide-react'
import { OrdersAPI } from '../../api'
import { RoutesAPI } from '../../api'
import { TeamsAPI } from '../../api'
import { ExpensesAPI } from '../../api'
import EnhancedAPI from '../../api/enhanced-api'
import { ExpenseWithCategory, ExpenseForm, ExpenseCategory } from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
import SmartModal from '../UI/SmartModal'
import DateTimePicker from '../UI/DateTimePicker'
import toast from 'react-hot-toast'

interface ExpenseFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  expense?: ExpenseWithCategory
  mode: 'create' | 'edit'
}

const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  expense,
  mode
}) => {
  const [formData, setFormData] = useState<ExpenseForm>({
    category_id: '',
    amount: 0,
    description: ''
  })
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [receiptImageUrl, setReceiptImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen) {
      Promise.all([fetchCategories(), fetchTeams(), fetchOrders(), fetchRoutes()])
    }
  }, [isOpen])

  useEffect(() => {
    if (expense && mode === 'edit') {
      setFormData({
        category_id: expense.category_id || '',
        amount: expense.amount,
        description: expense.description
      })
      setExpenseDate(expense.created_at.split('T')[0])
      setReceiptImageUrl(expense.receipt_image_url || '')
    } else {
      setFormData({
        category_id: '',
        amount: 0,
        description: ''
      })
      setExpenseDate(new Date().toISOString().split('T')[0])
      setReceiptImageUrl('')
    }
  }, [expense, mode, isOpen])

  const fetchCategories = async () => {
    try {
      setLoadingData(true)
      const data = await ExpensesAPI.getExpenseCategories()
      setCategories(data)
    } catch (error) {
      toast.error('حدث خطأ في تحميل فئات المصروفات')
      console.error('Categories fetch error:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const fetchTeams = async () => {
    try {
      const data = await TeamsAPI.getTeams()
      setTeams(data)
    } catch (error) {
      console.error('Teams fetch error', error)
    }
  }

  const fetchOrders = async () => {
    try {
      const res = await OrdersAPI.getOrders({}, 1, 100)
      setOrders(res.data)
    } catch (error) {
      console.error('Orders fetch error', error)
    }
  }

  const fetchRoutes = async () => {
    try {
      const res = await RoutesAPI.getRoutes({}, 1, 100)
      setRoutes(res.data)
    } catch (error) {
      console.error('Routes fetch error', error)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.category_id) {
      newErrors.category_id = 'فئة المصروف مطلوبة'
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'وصف المصروف مطلوب'
    }
    
    if (formData.amount <= 0) {
      newErrors.amount = 'يرجى إدخال مبلغ صحيح'
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
      if (mode === 'create') {
          const res = await EnhancedAPI.createExpense({ ...formData, receipt_image_url: receiptImageUrl })
          if (!res.success) throw new Error(res.error || 'Create expense failed')
        // replaced with EnhancedAPI above
        toast.success('تم إضافة المصروف بنجاح')
      } else {
        const res = await EnhancedAPI.updateExpense(expense!.id, { ...formData, receipt_image_url: receiptImageUrl })
         if (!res.success) throw new Error(res.error || 'Update expense failed')
        toast.success('تم تحديث بيانات المصروف بنجاح')
      }
      
      onSuccess()
      onClose()
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ البيانات')
      console.error('Expense form error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <SmartModal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'إضافة مصروف جديد' : 'تعديل بيانات المصروف'}
      subtitle={mode === 'create' ? 'تسجيل مصروف جديد' : 'تحديث بيانات المصروف'}
      icon={<Receipt className="h-6 w-6 text-white" />}
      size="lg"
      headerGradient="from-red-500 via-red-600 to-orange-600"
    >

      {loadingData ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="medium" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="flex items-center label text-gray-700 font-medium">
                <Tag className="h-4 w-4 ml-2 text-red-500" />
                فئة المصروف *
              </label>
              <div className="relative">
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                  onBlur={() => handleBlur('category_id')}
                  className={`input transition-all duration-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 hover:border-red-300 pl-10 ${
                    touched.category_id && errors.category_id
                      ? 'border-red-500 focus:ring-red-500'
                      : formData.category_id
                        ? 'border-green-500 focus:ring-green-500'
                        : ''
                  }`}
                  required
                  disabled={loading}
                >
                  <option value="">اختر فئة المصروف</option>
                  {categories.map((category) => (
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
                {touched.category_id && errors.category_id && (
                  <p className="text-sm text-red-600 mt-1 animate-bounce-in flex items-center">
                    <X className="h-3 w-3 ml-1" />
                    {errors.category_id}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center label text-gray-700 font-medium">
                <Users className="h-4 w-4 ml-2 text-red-500" />
                الفريق (اختياري)
              </label>
              <div className="relative">
                <select
                  value={formData.team_id || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, team_id: e.target.value || undefined }))}
                  className={`input transition-all duration-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 hover:border-red-300 pl-10 ${
                    formData.team_id ? 'border-green-500 focus:ring-green-500' : ''
                  }`}
                  disabled={loading}
                >
                  <option value="">اختر الفريق</option>
                  {teams.map((t:any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  {formData.team_id ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Users className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center label text-gray-700 font-medium">
                <ShoppingCart className="h-4 w-4 ml-2 text-red-500" />
                الطلب (اختياري)
              </label>
              <div className="relative">
                <select
                  value={formData.order_id || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, order_id: e.target.value || undefined }))}
                  className={`input transition-all duration-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 hover:border-red-300 pl-10 ${
                    formData.order_id ? 'border-green-500 focus:ring-green-500' : ''
                  }`}
                  disabled={loading}
                >
                  <option value="">اختر الطلب</option>
                  {orders.map((o:any) => (
                    <option key={o.id} value={o.id}>{o.order_number}</option>
                  ))}
                </select>
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  {formData.order_id ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <ShoppingCart className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center label text-gray-700 font-medium">
                <Route className="h-4 w-4 ml-2 text-red-500" />
                خط السير (اختياري)
              </label>
              <div className="relative">
                <select
                  value={formData.route_id || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, route_id: e.target.value || undefined }))}
                  className={`input transition-all duration-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 hover:border-red-300 pl-10 ${
                    formData.route_id ? 'border-green-500 focus:ring-green-500' : ''
                  }`}
                  disabled={loading}
                >
                  <option value="">اختر الخط</option>
                  {routes.map((r:any) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  {formData.route_id ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Route className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center label text-gray-700 font-medium">
                <DollarSign className="h-4 w-4 ml-2 text-red-500" />
                المبلغ (ج.م) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: Number(e.target.value) }))}
                  onBlur={() => handleBlur('amount')}
                  className={`input transition-all duration-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 hover:border-red-300 pl-10 ${
                    touched.amount && errors.amount
                      ? 'border-red-500 focus:ring-red-500'
                      : formData.amount > 0
                        ? 'border-green-500 focus:ring-green-500'
                        : ''
                  }`}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                  disabled={loading}
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  {touched.amount && !errors.amount && formData.amount > 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                {touched.amount && errors.amount && (
                  <p className="text-sm text-red-600 mt-1 animate-bounce-in flex items-center">
                    <X className="h-3 w-3 ml-1" />
                    {errors.amount}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center label text-gray-700 font-medium">
                <FileText className="h-4 w-4 ml-2 text-red-500" />
                الوصف *
              </label>
              <div className="relative">
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  onBlur={() => handleBlur('description')}
                  className={`input transition-all duration-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 hover:border-red-300 pl-10 resize-none ${
                    touched.description && errors.description
                      ? 'border-red-500 focus:ring-red-500'
                      : formData.description.trim()
                        ? 'border-green-500 focus:ring-green-500'
                        : ''
                  }`}
                  placeholder="أدخل وصف المصروف"
                  rows={3}
                  required
                  disabled={loading}
                />
                <div className="absolute left-3 top-3">
                  {touched.description && !errors.description && formData.description.trim() ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <FileText className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                {touched.description && errors.description && (
                  <p className="text-sm text-red-600 mt-1 animate-bounce-in flex items-center">
                    <X className="h-3 w-3 ml-1" />
                    {errors.description}
                  </p>
                )}
              </div>
            </div>

            <DateTimePicker
              type="date"
              value={expenseDate}
              onChange={(value) => setExpenseDate(value)}
              label="تاريخ المصروف"
              placeholder="اختر تاريخ المصروف"
              required
              disabled={loading}
            />

            <div className="space-y-2">
              <label className="flex items-center label text-gray-700 font-medium">
                <Image className="h-4 w-4 ml-2 text-red-500" />
                رابط صورة الإيصال (اختياري)
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={receiptImageUrl}
                  onChange={(e) => setReceiptImageUrl(e.target.value)}
                  className={`input transition-all duration-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 hover:border-red-300 pl-10 ${
                    receiptImageUrl.trim() ? 'border-green-500 focus:ring-green-500' : ''
                  }`}
                  placeholder="https://example.com/receipt.jpg"
                  disabled={loading}
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  {receiptImageUrl.trim() ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Image className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 space-x-reverse pt-6 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 flex items-center"
                disabled={loading}
              >
                <X className="h-4 w-4 ml-2" />
                إلغاء
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-lg hover:from-red-600 hover:to-orange-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center"
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
                    {mode === 'create' ? 'إضافة المصروف' : 'حفظ التغييرات'}
                  </div>
                )}
              </button>
            </div>
        </form>
      )}
    </SmartModal>
  )
}

export default ExpenseFormModal
