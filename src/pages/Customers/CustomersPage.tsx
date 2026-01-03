import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Plus, Search, Edit, Trash2, ToggleLeft, ToggleRight, Users, UserCheck, UserX, ShoppingCart, RefreshCw } from 'lucide-react'
import { ExportButton } from '../../components/UI'
import { AdminGuard } from '../../hooks/usePermissions'
import { exportToExcel } from '../../utils/exportExcel'
import EnhancedAPI from '../../api/enhanced-api'
import { CustomerWithOrders } from '../../types'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import CustomerFormModal from '../../components/Forms/CustomerFormModal'
import DeleteConfirmModal from '../../components/UI/DeleteConfirmModal'
import CustomerDetailsModal from '../../components/Customers/CustomerDetailsModal'
import toast from 'react-hot-toast'
import { eventBus } from '../../utils/EventBus'
import { useCustomers, useCustomerCounts } from '../../hooks/useEnhancedAPI'

const CustomersPage: React.FC = () => {
  // تصدير العملاء إلى ملف إكسل
  const handleExport = async () => {
    try {
      toast.loading('جاري تجهيز الملف...', { id: 'export' })

      const limit = 200 // حجم الصفحة أثناء التصدير، أقل لتجنب طول رابط Supabase
      let page = 1
      let all: any[] = []
      while (true) {
        const res = await EnhancedAPI.getCustomers(filters, page, limit, false)
        all = all.concat(res.data)
        if (page >= res.total_pages) break
        page++
      }

      if (!all.length) {
        toast.error('لا توجد بيانات للتصدير', { id: 'export' })
        return
      }

      const arabicCustomers = all.map((c: any) => ({
        'الاسم': c.name,
        'رقم الهاتف': c.phone,
        'المنطقة': c.area ?? '-',
        'عدد الطلبات': c.total_orders ?? 0,
        'حالة العميل': c.is_active ? 'نشط' : 'موقوف',
        'تاريخ التسجيل': c.created_at ? new Date(c.created_at).toLocaleDateString('ar-EG') : '-',
      }))

      const fileName = `عملاء_كامل_${new Date().toISOString().slice(0, 10)}.xlsx`
      await exportToExcel(arabicCustomers, fileName, 'العملاء')
      toast.success('تم إنشاء الملف بنجاح', { id: 'export' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل تصدير الملف', { id: 'export' })
    }
  }
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithOrders | undefined>()
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [detailsCustomerId, setDetailsCustomerId] = useState<string | undefined>()

  // Enhanced API hooks for optimized performance
  const filters = useMemo(() => {
    const baseFilters: any = {}
    if (statusFilter !== 'all') {
      baseFilters.is_active = statusFilter === 'active'
    }
    if (searchTerm) {
      baseFilters.search = searchTerm
    }
    return baseFilters
  }, [statusFilter, searchTerm])

  // Fetch paginated customers
  const {
    data: customers,
    loading,
    error,
    pagination,
    refresh,
    loadMore,
    hasMore
  } = useCustomers(filters, 1, 20)

  // Listen for global events to refresh data on external changes
  useEffect(() => {
    const unsubscribe = eventBus.on('customers:changed', () => {
      refresh()
    })
    return unsubscribe
  }, [refresh])

  // Fetch aggregate counts for accurate KPIs
  const { counts } = useCustomerCounts()

  // System health monitoring (for future use)
  // const { health } = useSystemHealth()

  // Remove unused search hook for now
  // const { 
  //   customers: searchResults, 
  //   loading: searchLoading 
  // } = useCustomerSearch(searchTerm, 10)

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

  // Load more customers (paging)
  const handleLoadMore = async () => {
    if (!hasMore) return;
    setLoadingMore(true);
    try {
      await loadMore();
    } catch (error) {
      toast.error('فشل في تحميل المزيد');
    } finally {
      setLoadingMore(false);
    }
  }

  // Infinite scroll observer for datasets > 100 rows
  useEffect(() => {
    if (customers.length < 100) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        handleLoadMore();
      }
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [customers.length, hasMore, loadingMore]);

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return

    setDeleteLoading(true)
    try {
      toast.loading('جاري حذف العميل...', { id: 'delete' })
      const response = await EnhancedAPI.deleteCustomer(selectedCustomer.id)
      if (response.success) {
        toast.success('تم حذف العميل بنجاح', { id: 'delete' })
        setShowDeleteModal(false)
        setSelectedCustomer(undefined)
        refresh()
      } else {
        throw new Error(response.error || 'فشل في حذف العميل')
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء حذف العميل', { id: 'delete' })
      console.error('Delete customer error:', error)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleToggleActive = async (customer: CustomerWithOrders) => {
    try {
      toast.loading('جاري تحديث حالة العميل...', { id: 'toggle' })
      const response = await EnhancedAPI.updateCustomer(customer.id, { is_active: !customer.is_active })
      if (response.success) {
        toast.success('تم تحديث حالة العميل', { id: 'toggle' })
        refresh()
      } else {
        throw new Error(response.error || 'فشل في تحديث الحالة')
      }
    } catch (error) {
      toast.error('حدث خطأ في تحديث الحالة', { id: 'toggle' })
      console.error(error)
    }
  }

  // Customers are already filtered by the API based on search term and status
  const filteredCustomers = customers || []

  // Show error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-red-600">حدث خطأ في تحميل العملاء: {error}</p>
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
  if (loading && filteredCustomers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" text="جاري تحميل العملاء..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-100 rounded-xl p-4 sm:p-6 border border-blue-200">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-900 bg-clip-text text-transparent">
              إدارة العملاء
            </h1>
            <p className="text-gray-600 mt-2 text-base sm:text-lg">
              إدارة قاعدة بيانات العملاء وتاريخ الخدمات
            </p>
            <div className="flex flex-wrap items-center mt-3 gap-x-4 gap-y-2">
              <div className="flex items-center">
                <span className="text-sm text-gray-500">إجمالي العملاء:</span>
                <span className="mr-1 font-bold text-blue-700">{pagination?.total || filteredCustomers.length}</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-500">النشطين:</span>
                <span className="mr-1 font-bold text-green-600">{filteredCustomers.filter(c => c.is_active).length}</span>
              </div>
              {pagination?.total && pagination.total > filteredCustomers.length && (
                <span className="text-xs text-blue-500">عرض {filteredCustomers.length} من {pagination.total}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:space-x-3 sm:space-x-reverse">
            <AdminGuard>
              <ExportButton onClick={handleExport} disabled={filteredCustomers.length === 0} className="w-full sm:w-auto" />
            </AdminGuard>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-secondary hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl w-full sm:w-auto flex items-center justify-center"
              title="تحديث البيانات"
            >
              <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 ml-2 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="text-sm sm:text-base">تحديث</span>
            </button>
            <button
              onClick={() => {
                setSelectedCustomer(undefined)
                setFormMode('create')
                setShowFormModal(true)
              }}
              className="btn-primary hover:scale-105 transition-transform duration-200 shadow-lg w-full sm:w-auto flex items-center justify-center"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 ml-2" />
              <span className="text-sm sm:text-base">إضافة عميل جديد</span>
            </button>
          </div>
        </div>
      </div>

      {/* Customer Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
        <div className="card-compact bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-lg hover:shadow-xl group hover:scale-105 transition-all duration-300">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Users className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="mr-4 flex-1">
              <p className="text-sm font-semibold text-gray-700 mb-1">إجمالي العملاء</p>
              <p className="text-2xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors duration-300">
                {pagination?.total ?? customers.length}
              </p>
            </div>
          </div>
        </div>

        <div className="card-compact bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-lg hover:shadow-xl group hover:scale-105 transition-all duration-300">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-4 rounded-xl bg-gradient-to-br from-green-500 to-green-600 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <UserCheck className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="mr-4 flex-1">
              <p className="text-sm font-semibold text-gray-700 mb-1">العملاء النشطين</p>
              <p className="text-2xl font-bold text-gray-900 group-hover:text-green-700 transition-colors duration-300">
                {counts?.active ?? '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="card-compact bg-gradient-to-br from-red-50 to-red-100 border-0 shadow-lg hover:shadow-xl group hover:scale-105 transition-all duration-300">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-4 rounded-xl bg-gradient-to-br from-red-500 to-red-600 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <UserX className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="mr-4 flex-1">
              <p className="text-sm font-semibold text-gray-700 mb-1">العملاء الموقوفين</p>
              <p className="text-2xl font-bold text-gray-900 group-hover:text-red-700 transition-colors duration-300">
                {counts?.inactive ?? '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="card-compact bg-gradient-to-br from-purple-50 to-purple-100 border-0 shadow-lg hover:shadow-xl group hover:scale-105 transition-all duration-300">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <ShoppingCart className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="mr-4 flex-1">
              <p className="text-sm font-semibold text-gray-700 mb-1">إجمالي الطلبات</p>
              <p className="text-2xl font-bold text-gray-900 group-hover:text-purple-700 transition-colors duration-300">
                {customers.reduce((sum, c) => sum + (c.total_orders || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Filters Section */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 border border-blue-100 shadow-lg">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Search Section */}
          <div className="flex-1">
            <label className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <Search className="h-4 w-4 ml-2 text-blue-600" />
              البحث والفلترة
            </label>
            <div className="relative group">
              <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 group-focus-within:text-blue-500 transition-colors duration-200" />
              <input
                type="text"
                placeholder="ابحث عن عميل بالاسم أو رقم الهاتف..."
                className="w-full pr-12 pl-4 py-3 border-2 border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-300 text-gray-900 placeholder-gray-500 shadow-sm hover:shadow-md"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Status Filter Section */}
          <div className="lg:w-64">
            <label className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <Users className="h-4 w-4 ml-2 text-blue-600" />
              حالة العميل
            </label>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-300 text-gray-900 shadow-sm hover:shadow-md appearance-none cursor-pointer"
              >
                <option value="all">جميع الحالات ({pagination?.total ?? customers.length})</option>
                <option value="active">العملاء النشطين ({counts?.active ?? '—'})</option>
                <option value="inactive">العملاء الموقوفين ({counts?.inactive ?? '—'})</option>
              </select>
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mt-6 pt-4 border-t border-blue-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center bg-white/60 backdrop-blur-sm rounded-lg px-4 py-2 shadow-sm">
              <div className="w-3 h-3 bg-blue-500 rounded-full ml-2 animate-pulse"></div>
              <span className="text-sm font-medium text-gray-700">النتائج المعروضة:</span>
              <span className="mr-2 font-bold text-blue-600 text-lg">{filteredCustomers.length}</span>
              <span className="text-sm text-gray-600">عميل</span>
            </div>

            {searchTerm && (
              <div className="flex items-center bg-green-100 rounded-lg px-3 py-2 shadow-sm">
                <span className="text-sm text-green-700">البحث عن: "{searchTerm}"</span>
              </div>
            )}

            {statusFilter !== 'all' && (
              <div className="flex items-center bg-purple-100 rounded-lg px-3 py-2 shadow-sm">
                <span className="text-sm text-purple-700">
                  الفلترة: {statusFilter === 'active' ? 'العملاء النشطين' : 'العملاء الموقوفين'}
                </span>
              </div>
            )}

            {(searchTerm || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('all')
                }}
                className="flex items-center bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors duration-200 shadow-sm"
              >
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                مسح الفلاتر
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="card-elevated">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">الاسم</th>
                <th className="table-header-cell">رقم الهاتف</th>
                <th className="table-header-cell">المنطقة</th>
                <th className="table-header-cell">عدد الطلبات</th>
                <th className="table-header-cell">الحالة</th>
                <th className="table-header-cell">تاريخ التسجيل</th>
                <th className="table-header-cell">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="table-row">
                  <td className="table-cell font-medium">
                    <button onClick={() => { setDetailsCustomerId(customer.id); setShowDetailsModal(true) }} className="text-blue-600 hover:underline">
                      {customer.name}
                    </button>
                  </td>
                  <td className="table-cell">{customer.phone}</td>
                  <td className="table-cell">{customer.area || 'غير محدد'}</td>
                  <td className="table-cell">{customer.total_orders || 0}</td>
                  <td className="table-cell">
                    {customer.is_active ? (
                      <span className="badge badge-success animate-pulse">نشط</span>
                    ) : (
                      <span className="badge badge-gray">موقوف</span>
                    )}
                  </td>
                  <td className="table-cell">
                    {new Date(customer.created_at).toLocaleDateString('ar-AE')}
                  </td>
                  <td className="table-cell">
                    <div className="flex space-x-2 space-x-reverse">
                      <button
                        onClick={() => {
                          setSelectedCustomer(customer)
                          setFormMode('edit')
                          setShowFormModal(true)
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                        title="تعديل"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(customer)}
                        className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md ${customer.is_active
                          ? 'text-yellow-600 hover:bg-yellow-50'
                          : 'text-green-600 hover:bg-green-50'
                          }`}
                        title={customer.is_active ? 'إيقاف' : 'إعادة تفعيل'}
                      >
                        {customer.is_active ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCustomer(customer)
                          setShowDeleteModal(true)
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                        title="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div ref={sentinelRef} />

          {filteredCustomers.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">لا توجد عملاء مطابقين للبحث</p>
            </div>
          )}
          {hasMore && (
            <div className="text-center py-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="btn-secondary hover:scale-105 transition-all duration-200"
              >
                {loadingMore ? 'جار التحميل...' : 'تحميل المزيد'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Customer Form Modal */}
      <CustomerFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false)
          setSelectedCustomer(undefined)
        }}
        onSuccess={() => {
          refresh()
        }}
        customer={selectedCustomer}
        mode={formMode}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setSelectedCustomer(undefined)
        }}
        onConfirm={handleDeleteCustomer}
        message={`هل أنت متأكد من رغبتك في حذف العميل "${selectedCustomer?.name}"؟ سيتم حذف جميع البيانات المرتبطة به.`}
        loading={deleteLoading}
      />

      {/* Customer Details Modal */}
      <CustomerDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false)
          setDetailsCustomerId(undefined)
        }}
        customerId={detailsCustomerId}
      />
    </div>
  )
}

export default CustomersPage
