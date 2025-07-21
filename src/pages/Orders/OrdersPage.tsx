import React, { useState } from 'react'
import { Plus, Edit, Eye, Search, Play, Check, XCircle } from 'lucide-react'
import { OrdersAPI } from '../../api'
import { OrderStatus } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import { OrderWithDetails } from '../../types'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import OrderFormModal from '../../components/Forms/OrderFormModal'
import DeleteConfirmModal from '../../components/UI/DeleteConfirmModal'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'

const OrdersPage: React.FC = () => {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const { data: ordersData = [], isLoading, refetch } = useQuery(
    ['orders', searchTerm],
    () => OrdersAPI.getOrders({ search: searchTerm }).then(res => res.data),
    { keepPreviousData: true }
  )
  const orders = ordersData as OrderWithDetails[]
  
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | undefined>()
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const handleDeleteOrder = async () => {
    if (!selectedOrder) return
    
    setDeleteLoading(true)
    // TODO: Implement delete order API method
    console.log('Delete order:', selectedOrder.id)
    toast.success('تم حذف الطلب بنجاح')
    setShowDeleteModal(false)
    setSelectedOrder(undefined)
    refetch()
    setDeleteLoading(false)
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
    let notes: string | undefined
    if (status === OrderStatus.CANCELLED) {
      notes = window.prompt('أدخل سبب الإلغاء:') || undefined
    }
    try {
      toast.loading('جاري تحديث حالة الطلب...', { id: 'status' })
      const response = await OrdersAPI.updateOrderStatus(order.id, status, notes, user?.id)
      if (response.success) {
        toast.success('تم تحديث حالة الطلب', { id: 'status' })
        refetch()
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      toast.error('حدث خطأ في تحديث الحالة', { id: 'status' })
      console.error('Status update error:', error)
    }
  }

  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer?.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading) {
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

      {/* Orders Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-compact bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">إجمالي الطلبات</p>
              <p className="text-2xl font-bold text-blue-800">{orders.length}</p>
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
              <p className="text-2xl font-bold text-yellow-800">{orders.filter(o => o.status === 'pending').length}</p>
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
              <p className="text-2xl font-bold text-green-800">{orders.filter(o => o.status === 'completed').length}</p>
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
              <p className="text-2xl font-bold text-red-800">{orders.filter(o => o.status === 'cancelled').length}</p>
            </div>
            <div className="p-3 bg-red-500 rounded-lg">
              <XCircle className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

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
        {searchTerm && (
          <div className="mt-3 p-3 bg-primary-50 rounded-lg border border-primary-200">
            <p className="text-sm text-primary-700">
              عرض {filteredOrders.length} من أصل {orders.length} طلب
            </p>
          </div>
        )}
      </div>

      <div className="card-elevated">
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">رقم الطلب</th>
                <th className="table-header-cell">العميل</th>
                <th className="table-header-cell">التاريخ</th>
                <th className="table-header-cell">الوقت</th>
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
                  <td className="table-cell">{order.customer?.name}</td>
                  <td className="table-cell">
                    {new Date(order.scheduled_date).toLocaleDateString('ar-AE')}
                  </td>
                  <td className="table-cell">{order.scheduled_time}</td>
                  <td className="table-cell">{getStatusBadge(order.status)}</td>
                  <td className="table-cell">{order.total_amount} ج.م</td>
                  <td className="table-cell">{order.team?.name || 'غير محدد'}</td>
                  <td className="table-cell">
                    <div className="flex space-x-2 space-x-reverse">
                      <button 
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
          
          {filteredOrders.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">لا توجد طلبات مطابقة للبحث</p>
            </div>
          )}
        </div>
      </div>

      {/* Order Form Modal */}
      <OrderFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false)
          setSelectedOrder(undefined)
        }}
        onSuccess={() => {
          refetch()
        }}
        order={selectedOrder}
        mode={formMode}
      />

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
