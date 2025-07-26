import React, { useState, useMemo, useEffect } from 'react'
import { Plus, Edit, Eye, Search, Play, Check, XCircle, RefreshCw } from 'lucide-react'
import SmartModal from '../../components/UI/SmartModal'
import EnhancedAPI from '../../api/enhanced-api'
import { OrderStatus } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import { OrderWithDetails } from '../../types'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import OrderFormModal from '../../components/Forms/OrderFormModal'
import OrderDetailsModal from '../../components/Orders/OrderDetailsModal'
import DeleteConfirmModal from '../../components/UI/DeleteConfirmModal'
import toast from 'react-hot-toast'
import { useOrders, useSystemHealth, useOrderCounts } from '../../hooks/useEnhancedAPI'
import OrdersFilterBar, { OrdersFiltersUI } from '../../components/Orders/OrdersFilterBar'
import SearchResultsInfo from '../../components/Orders/SearchResultsInfo'
import { eventBus } from '../../utils/EventBus'

const OrdersPage: React.FC = () => {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | undefined>()
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [detailsOrderId, setDetailsOrderId] = useState<string | undefined>()
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)

  // Smart filter UI state
  const [filtersUI, setFiltersUI] = useState<OrdersFiltersUI>({
    status: [],
    dateFrom: '',
    dateTo: '',
    teamId: ''
  })

  const [refreshing, setRefreshing] = useState(false)

  // Enhanced API hooks for optimized performance
  const filters = useMemo(() => ({
    status: filtersUI.status.length ? filtersUI.status : undefined,
    date_from: filtersUI.dateFrom || undefined,
    date_to: filtersUI.dateTo || undefined,
    team_id: filtersUI.teamId || undefined,
    search: searchTerm || undefined
  }), [filtersUI, searchTerm])

  const { 
    data: orders, 
    loading: isLoading, 
    error, 
    pagination,
    refresh,
    loadMore,
    hasMore 
  } = useOrders(filters, 1, 20, true)
  // Sentinel for infinite scroll
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)

  // تحديث لحظي لقائمة الطلبات عند تغيير خطوط السير أو الطلبات
  useEffect(() => {
    const handler = () => {
      // مسح كاش الطلبات حتى يتم جلب البيانات المحدَّثة
      EnhancedAPI.clearCache('enhanced:orders');
      refresh();
    }
    const offRoutes = eventBus.on('routes:changed', handler)
    const offOrders = eventBus.on('orders:changed', handler)
    return () => {
      offRoutes()
      offOrders()
    }
  }, [refresh])

  // Orders are already filtered by the API based on search term
  const filteredOrders = orders || []

  // Helper: calculate total expected execution duration (in minutes) for an order
  const getOrderDuration = (order: OrderWithDetails): number => {
    if (!order.items) return 0
    return order.items.reduce((sum, item) => {
      const perUnit = item.service?.estimated_duration || 0
      const qty = (item as any)?.quantity ?? 1
      return sum + perUnit * qty
    }, 0)
  }

  // Format minutes to human-readable Arabic string e.g. "2 س 30 د" or "45 د"
  const formatDuration = (minutes: number): string => {
    if (!minutes) return '-'
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${h} س ${m} د` : `${m} د`
  }

  // Fetch aggregate order counts
  const { counts } = useOrderCounts()

  // System health monitoring
  const { health } = useSystemHealth()
  const handleDeleteOrder = async () => {
    if (!selectedOrder) return
    
    setDeleteLoading(true)
    try {
      toast.loading('جاري حذف الطلب...', { id: 'delete' })
      const response = await EnhancedAPI.deleteOrder(selectedOrder.id)
      if (response.success) {
        toast.success('تم حذف الطلب بنجاح', { id: 'delete' })
        setShowDeleteModal(false)
        setSelectedOrder(undefined)
        refresh()
      } else {
        throw new Error(response.error || 'فشل في حذف الطلب')
      }
    } catch (error) {
      toast.error('حدث خطأ في حذف الطلب', { id: 'delete' })
      console.error('Delete order error:', error)
    } finally {
      setDeleteLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      pending: 'status-pending',
      scheduled: 'status-scheduled',
      in_progress: 'status-in-progress',
      completed: 'status-completed',
      cancelled: 'status-cancelled'
    }
    
    const statusTexts = {
      pending: 'معلق',
      scheduled: 'مجدول',
      in_progress: 'قيد التنفيذ',
      completed: 'مكتمل',
      cancelled: 'ملغي'
    }

    const isActive = status === 'in_progress'
    return (
      <span className={`badge ${statusClasses[status as keyof typeof statusClasses] || 'badge-gray'} ${isActive ? 'animate-pulse' : ''}`}>
        {statusTexts[status as keyof typeof statusTexts] || status}
      </span>
    )
  }

  const handleStatusChange = async (order: OrderWithDetails, status: OrderStatus) => {
    if (status === OrderStatus.CANCELLED) {
      setSelectedOrder(order)
      setShowCancelModal(true)
      return
    }
    let notes: string | undefined
    
    try {
      toast.loading('جاري تحديث حالة الطلب...', { id: 'status' })
      const response = await EnhancedAPI.updateOrderStatus(order.id, status, notes, user?.id)
      if (response.success) {
        toast.success('تم تحديث حالة الطلب', { id: 'status' })
        refresh()
      } else {
        throw new Error(response.error || 'فشل في تحديث الحالة')
      }
    } catch (error) {
      toast.error('حدث خطأ في تحديث الحالة', { id: 'status' })
      console.error('Status update error:', error)
    }
  }

  // Manual refresh handler
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refresh()
      toast.success('تم تحديث البيانات')
    } catch (error) {
      toast.error('فشل في تحديث البيانات')
    } finally {
      setRefreshing(false)
    }
  }

  // Load more orders for infinite scrolling
  const handleLoadMore = async () => {
    if (hasMore && !isLoading) {
      await loadMore()
    }
  }

  // Infinite scroll for large datasets
  React.useEffect(() => {
    if (filteredOrders.length < 100) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isLoading) {
        handleLoadMore();
      }
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredOrders.length, hasMore, isLoading]);

  // Show error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-red-600">حدث خطأ في تحميل الطلبات: {error}</p>
        <button 
          onClick={handleRefresh}
          className="btn-primary"
          disabled={refreshing}
        >
          {refreshing ? 'جاري المحاولة...' : 'إعادة المحاولة'}
        </button>
      </div>
    )
  }

  // Show loading state for initial load
  if (isLoading && filteredOrders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" text="جاري تحميل الطلبات..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">إدارة الطلبات</h1>
          <p className="text-gray-600 mt-2">إدارة طلبات العملاء وتتبع حالتها</p>
        </div>
        <div className="flex space-x-3 space-x-reverse">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
            title="تحديث البيانات"
          >
            <RefreshCw className={`h-5 w-5 ml-2 ${refreshing ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <button 
            onClick={() => {
              setSelectedOrder(undefined)
              setFormMode('create')
              setShowFormModal(true)
            }}
            className="btn-primary hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Plus className="h-5 w-5 ml-2" />
            طلب جديد
          </button>
        </div>
      </div>

      {/* Orders Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-compact bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">إجمالي الطلبات</p>
              <p className="text-2xl font-bold text-blue-800">{counts?.total ?? pagination?.total ?? filteredOrders.length}</p>
              {pagination?.total && pagination.total > filteredOrders.length && (
                <p className="text-xs text-blue-500">عرض {filteredOrders.length} من {pagination.total}</p>
              )}
            </div>
            <div className="p-3 bg-blue-500 rounded-lg">
              <Plus className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600">قيد الانتظار</p>
              <p className="text-2xl font-bold text-yellow-800">{counts?.pending ?? filteredOrders.filter(o => o.status === 'pending').length}</p>
            </div>
            <div className="p-3 bg-yellow-500 rounded-lg">
              <Play className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">مكتملة</p>
              <p className="text-2xl font-bold text-green-800">{counts?.completed ?? filteredOrders.filter(o => o.status === 'completed').length}</p>
            </div>
            <div className="p-3 bg-green-500 rounded-lg">
              <Check className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">ملغية</p>
              <p className="text-2xl font-bold text-red-800">{counts?.cancelled ?? filteredOrders.filter(o => o.status === 'cancelled').length}</p>
            </div>
            <div className="p-3 bg-red-500 rounded-lg">
              <XCircle className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Performance Health Indicator */}
      {health && (
        <div className="card-compact bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 space-x-reverse">
              <div className={`w-3 h-3 rounded-full ${
                health.database.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm text-gray-600">
                قاعدة البيانات: {health.database.response_time_ms}ms
              </span>
              <span className="text-sm text-gray-600">
                الكاش: {health.cache?.stats?.size ?? 0} عنصر
              </span>
              <span className="text-sm text-gray-600">
                الذاكرة: {Math.round(health.memory?.used ?? 0 / 1024 / 1024)}MB
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Smart Filters Bar */}
      <OrdersFilterBar
        filters={filtersUI}
        onFiltersChange={(changes) => setFiltersUI(prev => ({ ...prev, ...changes }))}
      />

      <div className="card-compact">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="البحث عن طلب برقم الطلب أو اسم العميل..."
            className="input pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Search Results Info */}
      <SearchResultsInfo
        totalResults={filteredOrders.length}
        totalCount={pagination?.total}
        searchTerm={searchTerm}
        filters={filtersUI}
        isLoading={isLoading}
        onClearSearch={() => setSearchTerm('')}
        onClearFilters={() => setFiltersUI({ status: [], dateFrom: '', dateTo: '', teamId: '' })}
      />

      <div className="card-elevated">
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">رقم الطلب</th>
                <th className="table-header-cell">العميل</th>
                <th className="table-header-cell">التاريخ</th>
                <th className="table-header-cell">الوقت</th>
                <th className="table-header-cell">مدة التنفيذ</th>
                <th className="table-header-cell">الحالة</th>
                <th className="table-header-cell">المبلغ</th>
                <th className="table-header-cell">الفريق</th>
                <th className="table-header-cell">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="table-row">
                  <td className="table-cell font-medium">{order.order_number}</td>
                  <td className="table-cell">{order.customer_name || 'غير محدد'}</td>
                  <td className="table-cell">
                    {new Date(order.scheduled_date).toLocaleDateString('ar-AE')}
                  </td>
                  <td className="table-cell">{order.scheduled_time}</td>
                   <td className="table-cell">{formatDuration(getOrderDuration(order))}</td>
                  <td className="table-cell">{getStatusBadge(order.status)}</td>
                  <td className="table-cell">{order.total_amount} ج.م</td>
                  <td className="table-cell">{order.team_name || 'غير محدد'}</td>
                  <td className="table-cell">
                    <div className="flex space-x-2 space-x-reverse">
                      <button 
                        onClick={() => {
                          setDetailsOrderId(order.id)
                          setShowDetailsModal(true)
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                        title="عرض التفاصيل"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedOrder(order)
                          setFormMode('edit')
                          setShowFormModal(true)
                        }}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                        title="تعديل"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {order.status === 'pending' || order.status === 'scheduled' ? (
                        <button
                          onClick={() => handleStatusChange(order, OrderStatus.IN_PROGRESS)}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                          title="بدء التنفيذ"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      ) : null}
                      {order.status === 'in_progress' ? (
                        <button
                          onClick={() => handleStatusChange(order, OrderStatus.COMPLETED)}
                          className="p-2 text-green-700 hover:bg-green-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                          title="إكمال"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      ) : null}
                      {order.status !== 'cancelled' && order.status !== 'completed' ? (
                        <button
                          onClick={() => handleStatusChange(order, OrderStatus.CANCELLED)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                          title="إلغاء"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredOrders.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {searchTerm ? 'لا توجد طلبات مطابقة للبحث' : 'لا توجد طلبات'}
              </p>
            </div>
          )}
          
          {/* Loading more indicator */}
          {isLoading && filteredOrders.length > 0 && (
            <div className="text-center py-4">
              <LoadingSpinner size="small" text="جاري تحميل المزيد..." />
            </div>
          )}
          
          {/* Load more button */}
          {hasMore && !isLoading && filteredOrders.length > 0 && (
            <div className="text-center py-4">
              <button 
                onClick={handleLoadMore}
                className="btn-secondary"
              >
                تحميل المزيد ({pagination?.total ? `${pagination.total - filteredOrders.length} متبقي` : ''})
              </button>
            </div>
          )}
        </div>
      <div ref={sentinelRef} />
      </div>

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false)
          setDetailsOrderId(undefined)
        }}
        orderId={detailsOrderId}
      />

      {/* Order Form Modal */}
      <OrderFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false)
          setSelectedOrder(undefined)
        }}
        onSuccess={() => {
          refresh()
        }}
        order={selectedOrder}
        mode={formMode}
      />

      {/* Cancel Order Modal */}
      <SmartModal
        isOpen={showCancelModal}
        size="sm"
        headerGradient="from-red-500 via-red-600 to-red-700"
        contentClassName="p-6"
        className="ring-1 ring-red-100"
        onClose={() => {
          setShowCancelModal(false)
          setCancelReason('')
          setSelectedOrder(undefined)
        }}
        title="تأكيد إلغاء الطلب"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">يرجى كتابة سبب الإلغاء قبل المتابعة:</p>
          <textarea
            className="textarea w-full textarea-bordered"
            rows={3}
            placeholder="سبب الإلغاء"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <div className="flex justify-end gap-4 mt-6">
            <button
              onClick={async () => {
                if (!selectedOrder) return
                if (!cancelReason.trim()) return
                setCancelLoading(true)
                try {
                  toast.loading('جاري إلغاء الطلب...', { id: 'cancel' })
                  const response = await EnhancedAPI.updateOrderStatus(
                    selectedOrder.id,
                    OrderStatus.CANCELLED,
                    cancelReason.trim(),
                    user?.id
                  )
                  if (response.success) {
                    toast.success('تم إلغاء الطلب', { id: 'cancel' })
                    setShowCancelModal(false)
                    setCancelReason('')
                    refresh()
                  } else {
                    throw new Error(response.error || 'فشل في إلغاء الطلب')
                  }
                } catch (error) {
                  toast.error('حدث خطأ أثناء الإلغاء', { id: 'cancel' })
                  console.error('Cancel order error:', error)
                } finally {
                  setCancelLoading(false)
                }
              }}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={cancelLoading || !cancelReason.trim()}
            >
              {cancelLoading ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
            </button>
            <button
              onClick={() => setShowCancelModal(false)}
              className="btn btn-ghost"
              disabled={cancelLoading}
            >
              تراجع
            </button>
          </div>
        </div>
      </SmartModal>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setSelectedOrder(undefined)
        }}
        onConfirm={handleDeleteOrder}
        message={`هل أنت متأكد من رغبتك في حذف الطلب "${selectedOrder?.order_number}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        loading={deleteLoading}
      />
    </div>
  )
}

export default OrdersPage
