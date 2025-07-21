import React, { useState, useEffect } from 'react'
import { X, Save, Receipt } from 'lucide-react'
import { OrdersAPI } from '../../api'
import { RoutesAPI } from '../../api'
import { TeamsAPI } from '../../api'
import { ExpensesAPI } from '../../api'
import { ExpenseWithCategory, ExpenseForm, ExpenseCategory } from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.category_id) {
      toast.error('يرجى اختيار فئة المصروف')
      return
    }

    if (!formData.description.trim()) {
      toast.error('يرجى إدخال وصف المصروف')
      return
    }

    if (formData.amount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح')
      return
    }

    setLoading(true)
    try {
      if (mode === 'create') {
        await ExpensesAPI.createExpense({ ...formData, receipt_image_url: receiptImageUrl })
        toast.success('تم إضافة المصروف بنجاح')
      } else {
        await ExpensesAPI.updateExpense(expense!.id, { ...formData, receipt_image_url: receiptImageUrl })
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Receipt className="h-5 w-5 text-blue-600 ml-2" />
            <h2 className="text-lg font-semibold">
              {mode === 'create' ? 'إضافة مصروف جديد' : 'تعديل بيانات المصروف'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="medium" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                فئة المصروف *
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                className="input-field"
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الفريق (اختياري)
              </label>
              <select
                value={formData.team_id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, team_id: e.target.value || undefined }))}
                className="input-field"
                disabled={loading}
              >
                <option value="">اختر الفريق</option>
                {teams.map((t:any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الطلب (اختياري)
              </label>
              <select
                value={formData.order_id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, order_id: e.target.value || undefined }))}
                className="input-field"
                disabled={loading}
              >
                <option value="">اختر الطلب</option>
                {orders.map((o:any) => (
                  <option key={o.id} value={o.id}>{o.order_number}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                خط السير (اختياري)
              </label>
              <select
                value={formData.route_id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, route_id: e.target.value || undefined }))}
                className="input-field"
                disabled={loading}
              >
                <option value="">اختر الخط</option>
                {routes.map((r:any) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                المبلغ (ج.م) *
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: Number(e.target.value) }))}
                className="input-field"
                placeholder="0.00"
                min="0"
                step="0.01"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الوصف *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="input-field"
                placeholder="أدخل وصف المصروف"
                rows={3}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                تاريخ المصروف *
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="input-field"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                رابط صورة الإيصال (اختياري)
              </label>
              <input
                type="url"
                value={receiptImageUrl}
                onChange={(e) => setReceiptImageUrl(e.target.value)}
                className="input-field"
                placeholder="https://example.com/receipt.jpg"
                disabled={loading}
              />
            </div>

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
                    {mode === 'create' ? 'إضافة' : 'حفظ التغييرات'}
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

export default ExpenseFormModal
