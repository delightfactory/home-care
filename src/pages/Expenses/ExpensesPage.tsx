import React, { useState } from 'react'
import { Plus, Search, Edit, Trash2, Receipt, Check, XCircle, Filter, DollarSign, TrendingUp, Clock, FileText, Activity } from 'lucide-react'
import EnhancedAPI from '../../api/enhanced-api'
import { eventBus } from '../../utils/EventBus'
import { ExpenseWithCategory, ExpenseFilters } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import ExpenseFormModal from '../../components/Forms/ExpenseFormModal'
import DeleteConfirmModal from '../../components/UI/DeleteConfirmModal'
import toast from 'react-hot-toast'
import { useExpenses, useSystemHealth, useExpenseCounts } from '../../hooks/useEnhancedAPI'

const ExpensesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<ExpenseFilters>({})
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<ExpenseWithCategory | undefined>()
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const { user } = useAuth()

  // Use optimized hooks for data fetching
  const { data: expenses, loading, error, refresh, loadMore, hasMore } = useExpenses(filters)
  // Listen for global expenses changes
  React.useEffect(() => {
    const unsub = eventBus.on('expenses:changed', () => {
      refresh()
    })
    return unsub
  }, [refresh])
  // Real-time aggregate counts
  const { counts } = useExpenseCounts()
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)
  const { health } = useSystemHealth()

  // Show error state if needed
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">حدث خطأ في تحميل المصروفات</p>
          <button onClick={refresh} className="btn-primary">
            إعادة المحاولة
          </button>
        </div>
      </div>
    )
  }

  const handleApproveExpense = async (expenseId: string) => {
    try {
      const res = await EnhancedAPI.approveExpense(expenseId, user?.id || '')
      if (!res.success) throw new Error(res.error || 'Approve failed')
      toast.success('تمت الموافقة على المصروف')
    } catch (error) {
      toast.error('حدث خطأ أثناء الموافقة')
      console.error('Approve expense error:', error)
    }
  }

  const handleRejectExpense = async (expenseId: string) => {
    const reason = window.prompt('أدخل سبب الرفض:')
    if (reason === null) return
    try {
      const res = await EnhancedAPI.rejectExpense(expenseId, reason, user?.id || '')
      if (!res.success) throw new Error(res.error || 'Reject failed')
      toast.success('تم رفض المصروف')
    } catch (error) {
      toast.error('حدث خطأ أثناء الرفض')
      console.error('Reject expense error:', error)
    }
  }

  const handleDeleteExpense = async () => {
    if (!selectedExpense) return
    
    setDeleteLoading(true)
    try {
      const result = await EnhancedAPI.deleteExpense(selectedExpense.id)
      if (!result.success) {
        throw new Error(result.error || 'فشل حذف المصروف')
      }
      toast.success(result.message || 'تم حذف المصروف بنجاح')
      setShowDeleteModal(false)
      setSelectedExpense(undefined)
      refresh()
    } catch (error) {
      toast.error('حدث خطأ أثناء حذف المصروف')
      console.error('Delete expense error:', error)
    } finally {
      setDeleteLoading(false)
    }
  }

  const onFormSuccess = () => {
    refresh() // Use hook's refresh instead of fetchExpenses
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      pending: 'status-pending animate-pulse',
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



  // Infinite scroll for large datasets
  React.useEffect(() => {
    if (expenses.length < 100) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        handleLoadMore();
      }
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [expenses.length, hasMore, loadingMore]);

  const handleLoadMore = async () => {
    if (!hasMore) return;
    setLoadingMore(true);
    try {
      await loadMore();
    } catch (error) {
      toast.error('تعذر تحميل المزيد');
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" text="جاري تحميل المصروفات..." />
      </div>
    )
  }

  // Filter expenses based on search term
  const filteredExpenses = expenses?.filter((expense: any) => 
    expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.category?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  // Calculate statistics
  const totalAmount = expenses?.reduce((sum: number, expense: any) => sum + expense.amount, 0) || 0
  const pendingExpenses = expenses?.filter((e: any) => e.status === 'pending').length || 0
  const approvedExpenses = expenses?.filter((e: any) => e.status === 'approved').length || 0

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            إدارة المصروفات
          </h1>
          <p className="text-gray-600 mt-1">إدارة مصروفات الشركة والموافقة عليها</p>
        </div>
        <button 
          onClick={() => {
            setSelectedExpense(undefined)
            setFormMode('create')
            setShowFormModal(true)
          }}
          className="btn-primary hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Plus className="h-5 w-5 ml-2" />
          إضافة مصروف جديد
        </button>
      </div>

      {/* System Health Indicator */}
      {health && (
        <div className="card-compact bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 space-x-reverse">
              <Activity className="h-5 w-5 text-gray-600" />
              <div className={`w-3 h-3 rounded-full ${
                health.database?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm text-gray-600">
                قاعدة البيانات: {health.database?.response_time_ms || 0}ms
              </span>
              <span className="text-sm text-gray-600">
                الكاش: {health.cache?.stats?.size ?? 0} عنصر
              </span>
              <span className="text-sm text-gray-600">
                الذاكرة: {Math.round((health.memory?.used ?? 0) / 1024 / 1024)}MB
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card-compact bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">إجمالي المصروفات</p>
              <p className="text-2xl font-bold">{counts?.total ?? expenses?.length ?? 0}</p>
            </div>
            <div className="p-3 bg-white/20 rounded-lg">
              <FileText className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="card-compact bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">إجمالي المبلغ</p>
              <p className="text-2xl font-bold">{totalAmount.toLocaleString()} ج.م</p>
            </div>
            <div className="p-3 bg-white/20 rounded-lg">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="card-compact bg-gradient-to-br from-yellow-500 to-orange-500 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm font-medium">في الانتظار</p>
              <p className="text-2xl font-bold">{counts?.pending ?? pendingExpenses}</p>
            </div>
            <div className="p-3 bg-white/20 rounded-lg">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="card-compact bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">موافق عليها</p>
              <p className="text-2xl font-bold">{counts?.approved ?? approvedExpenses}</p>
            </div>
            <div className="p-3 bg-white/20 rounded-lg">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card-compact">
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="text-gray-500" />
            <select
              value={filters.category_id || ''}
              onChange={(e)=>setFilters(prev=>{ const f={...prev, category_id:e.target.value||undefined}; return f })}
              className="input-field focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            >
              <option value="">كل الفئات</option>
              {/* TODO: Add categories hook when available */}
            </select>
          </div>
          <div>
            <select
              value={filters.team_id||''}
              onChange={(e)=>setFilters(prev=>({...prev, team_id:e.target.value||undefined}))}
              className="input-field focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            >
              <option value="">كل الفرق</option>
              {/* TODO: Add teams hook when available */}
            </select>
          </div>
          <div>
            <select
              value={filters.status?.[0]||''}
              onChange={(e)=>setFilters(prev=>({...prev, status:e.target.value? [e.target.value as any]:undefined}))}
              className="input-field focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            >
              <option value="">كل الحالات</option>
              <option value="pending">معلق</option>
              <option value="approved">موافق</option>
              <option value="rejected">مرفوض</option>
            </select>
          </div>
          <div>
            <button onClick={refresh} className="btn-secondary hover:scale-105 transition-all duration-200">تصفية</button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="البحث في المصروفات..."
            className="input pr-10 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {searchTerm && (
          <div className="mt-3 p-2 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              تم العثور على {filteredExpenses.length} نتيجة للبحث عن "{searchTerm}"
            </p>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="card-elevated">
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
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all hover:scale-110 shadow-sm hover:shadow-md"
                        title="تعديل"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedExpense(expense)
                          setShowDeleteModal(true)
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all hover:scale-110 shadow-sm hover:shadow-md"
                        title="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {expense.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApproveExpense(expense.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all hover:scale-110 shadow-sm hover:shadow-md"
                            title="موافقة"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRejectExpense(expense.id)}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all hover:scale-110 shadow-sm hover:shadow-md"
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
            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} />
          
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
        onSuccess={onFormSuccess}
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
        message={`هل أنت متأكد من رغبتك في حذف المصروف "${selectedExpense?.description}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        loading={deleteLoading}
      />
    </div>
  )
}

export default ExpensesPage
