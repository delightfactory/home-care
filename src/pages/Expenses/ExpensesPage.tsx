import React, { useEffect, useState } from 'react'
import { Plus, Search, Edit, Trash2, Receipt, Check, XCircle, Filter } from 'lucide-react'
import { ExpensesAPI } from '../../api'
import { ExpenseWithCategory, ExpenseFilters } from '../../types'
import { TeamsAPI } from '../../api'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import ExpenseFormModal from '../../components/Forms/ExpenseFormModal'
import DeleteConfirmModal from '../../components/UI/DeleteConfirmModal'
import toast from 'react-hot-toast'

const ExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<ExpenseFilters>({})
  const [categories, setCategories] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<ExpenseWithCategory | undefined>()
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    loadFilterData()
    fetchExpenses()
  }, [])

  const loadFilterData = async () => {
    try {
      const cats = await ExpensesAPI.getExpenseCategories()
      setCategories(cats)
      const tms = await TeamsAPI.getTeams()
      setTeams(tms)
    } catch (e) { console.error(e) }
  }

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      const response = await ExpensesAPI.getExpenses(filters)
      setExpenses(response.data)
    } catch (error) {
      toast.error('حدث خطأ في تحميل المصروفات')
      console.error('Expenses fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveExpense = async (expenseId: string) => {
    try {
      const res = await ExpensesAPI.approveExpense(expenseId, user?.id || '')
      if (!res.success) throw new Error(res.error)
      toast.success('تمت الموافقة على المصروف')
      fetchExpenses()
    } catch (error) {
      toast.error('حدث خطأ أثناء الموافقة')
      console.error('Approve expense error:', error)
    }
  }

  const handleRejectExpense = async (expenseId: string) => {
    const reason = window.prompt('أدخل سبب الرفض:')
    if (reason === null) return
    try {
      const res = await ExpensesAPI.rejectExpense(expenseId, reason, user?.id || '')
      if (!res.success) throw new Error(res.error)
      toast.success('تم رفض المصروف')
      fetchExpenses()
    } catch (error) {
      toast.error('حدث خطأ أثناء الرفض')
      console.error('Reject expense error:', error)
    }
  }

  const handleDeleteExpense = async () => {
    if (!selectedExpense) return
    
    setDeleteLoading(true)
    try {
      const res = await ExpensesAPI.deleteExpense(selectedExpense.id)
      if (!res.success) throw new Error(res.error)
      toast.success('تم حذف المصروف بنجاح')
      setShowDeleteModal(false)
      setSelectedExpense(undefined)
      fetchExpenses()
    } catch (error) {
      toast.error('حدث خطأ أثناء حذف المصروف')
      console.error('Delete expense error:', error)
    } finally {
      setDeleteLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      pending: 'status-pending',
      approved: 'status-approved',
      rejected: 'status-rejected'
    }
    
    const statusTexts = {
      pending: 'معلق',
      approved: 'موافق عليه',
      rejected: 'مرفوض'
    }

    return (
      <span className={`badge ${statusClasses[status as keyof typeof statusClasses] || 'badge-gray'}`}>
        {statusTexts[status as keyof typeof statusTexts] || status}
      </span>
    )
  }

  const filteredExpenses = expenses.filter(expense =>
    expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.category?.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" text="جاري تحميل المصروفات..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة المصروفات</h1>
          <p className="text-gray-600 mt-1">إدارة مصروفات الشركة والموافقة عليها</p>
        </div>
        <button 
          onClick={() => {
            setSelectedExpense(undefined)
            setFormMode('create')
            setShowFormModal(true)
          }}
          className="btn-primary"
        >
          <Plus className="h-5 w-5 ml-2" />
          إضافة مصروف جديد
        </button>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="text-gray-500" />
            <select
              value={filters.category_id || ''}
              onChange={(e)=>setFilters(prev=>{ const f={...prev, category_id:e.target.value||undefined}; return f })}
              className="input-field"
            >
              <option value="">كل الفئات</option>
              {categories.map((c:any)=>(<option key={c.id} value={c.id}>{c.name_ar}</option>))}
            </select>
          </div>
          <div>
            <select
              value={filters.team_id||''}
              onChange={(e)=>setFilters(prev=>({...prev, team_id:e.target.value||undefined}))}
              className="input-field"
            >
              <option value="">كل الفرق</option>
              {teams.map((t:any)=>(<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </div>
          <div>
            <select
              value={filters.status?.[0]||''}
              onChange={(e)=>setFilters(prev=>({...prev, status:e.target.value? [e.target.value as any]:undefined}))}
              className="input-field"
            >
              <option value="">كل الحالات</option>
              <option value="pending">معلق</option>
              <option value="approved">موافق</option>
              <option value="rejected">مرفوض</option>
            </select>
          </div>
          <div>
            <button onClick={fetchExpenses} className="btn-secondary">تصفية</button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="البحث في المصروفات..."
            className="input pr-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">الوصف</th>
                <th className="table-header-cell">الفئة</th>
                <th className="table-header-cell">المبلغ</th>
                <th className="table-header-cell">التاريخ</th>
                <th className="table-header-cell">الحالة</th>
                <th className="table-header-cell">المُدخل بواسطة</th>
                <th className="table-header-cell">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center">
                      <Receipt className="h-4 w-4 text-gray-400 ml-2" />
                      <span className="font-medium">{expense.description}</span>
                    </div>
                  </td>
                  <td className="table-cell">{expense.category?.name}</td>
                  <td className="table-cell font-semibold">{expense.amount} ج.م</td>
                  <td className="table-cell">
                    {new Date(expense.created_at).toLocaleDateString('ar-AE')}
                  </td>
                  <td className="table-cell">{getStatusBadge(expense.status)}</td>
                  <td className="table-cell">{expense.created_by_user?.full_name || 'غير محدد'}</td>
                  <td className="table-cell">
                    <div className="flex space-x-2 space-x-reverse">
                      <button 
                        onClick={() => {
                          setSelectedExpense(expense)
                          setFormMode('edit')
                          setShowFormModal(true)
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="تعديل"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedExpense(expense)
                          setShowDeleteModal(true)
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {expense.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApproveExpense(expense.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded"
                            title="موافقة"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRejectExpense(expense.id)}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded"
                            title="رفض"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredExpenses.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">لا توجد مصروفات مطابقة للبحث</p>
            </div>
          )}
        </div>
      </div>

      {/* Expense Form Modal */}
      <ExpenseFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false)
          setSelectedExpense(undefined)
        }}
        onSuccess={() => {
          fetchExpenses()
        }}
        expense={selectedExpense}
        mode={formMode}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setSelectedExpense(undefined)
        }}
        onConfirm={handleDeleteExpense}
        title="حذف المصروف"
        message="هل أنت متأكد من رغبتك في حذف هذا المصروف؟ لا يمكن التراجع عن هذا الإجراء."
        itemName={selectedExpense?.description}
        loading={deleteLoading}
      />
    </div>
  )
}

export default ExpensesPage
