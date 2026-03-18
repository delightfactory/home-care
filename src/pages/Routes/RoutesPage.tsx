import React, { useState, useMemo, useEffect } from 'react'
import { Plus, Calendar, Users, MapPin, ListTodo, Play, Check, Trash2, Pencil, Route as RouteIcon, Clock, CheckCircle, AlertTriangle, Package, RefreshCw } from 'lucide-react'
import EnhancedAPI from '../../api/enhanced-api'
import { eventBus } from '../../utils/EventBus'
import { useRoutes, useTeams, useSystemHealth, useRouteCounts } from '../../hooks/useEnhancedAPI'
import { usePermissions } from '../../hooks/usePermissions'
import { RouteWithOrders, RouteStatus } from '../../types'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import RouteFormModal from '../../components/Forms/RouteFormModal'
import AssignOrdersModal from '../../components/Forms/AssignOrdersModal'
import DeleteConfirmModal from '../../components/UI/DeleteConfirmModal'
import toast from 'react-hot-toast'

const RoutesPage: React.FC = () => {
  const today = new Date().toISOString().substring(0, 10)
  const [dateFilter, setDateFilter] = useState<string>(today)
  const [statusFilter, setStatusFilter] = useState<'all' | RouteStatus>('all')
  const [teamFilter, setTeamFilter] = useState<string>('all')

  // Build filters for optimized hook
  const filters = useMemo(() => {
    const f: any = {}
    if (dateFilter) f.date = dateFilter
    if (teamFilter !== 'all') f.team_id = teamFilter
    if (statusFilter !== 'all') f.status = [statusFilter]
    return f
  }, [dateFilter, teamFilter, statusFilter])

  // Optimized data hooks
  const { routes, loading: routesLoading, error: _routesError, refresh, loadMore, hasMore } = useRoutes(filters)
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const { teams, loading: teamsLoading, error: _teamsError } = useTeams()
  const { health: _health } = useSystemHealth()

  // Fetch aggregate route counts
  const { counts } = useRouteCounts()
  const { isAdmin } = usePermissions()

  // Load more handler
  const handleLoadMore = async () => {
    if (!hasMore) return;
    setLoadingMore(true);
    try {
      await loadMore();
    } catch (e) {
      toast.error('فشل في تحميل المزيد');
    } finally {
      setLoadingMore(false);
    }
  }

  // Subscribe to routes:changed for reactive refresh
  useEffect(() => {
    const unsub = eventBus.on('routes:changed', () => {
      refresh()
    })
    return unsub
  }, [refresh])

  const loading = routesLoading || teamsLoading

  const [showFormModal, setShowFormModal] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<RouteWithOrders | undefined>()
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [routeForOrders, setRouteForOrders] = useState<RouteWithOrders | undefined>()
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // حالات نافذة تأكيد تغيير حالة خط السير
  const [routeStatusConfirm, setRouteStatusConfirm] = useState<{ route: RouteWithOrders; action: 'start' | 'complete' } | null>(null)
  const [routeStatusLoading, setRouteStatusLoading] = useState(false)

  // Infinite scroll observer when dataset grows
  useEffect(() => {
    if (routes.length < 100) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        handleLoadMore();
      }
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [routes.length, hasMore, loadingMore]);

  useEffect(() => {
    refresh()
  }, [refresh, dateFilter, teamFilter, statusFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" text="جاري تحميل خطوط السير..." />
      </div>
    )
  }

  // Handle start route — show confirmation modal
  const handleStartRoute = (route: RouteWithOrders) => {
    setRouteStatusConfirm({ route, action: 'start' })
  }

  // Handle complete route — show confirmation modal
  const handleCompleteRoute = (route: RouteWithOrders) => {
    setRouteStatusConfirm({ route, action: 'complete' })
  }

  // Confirm route status change (actual API call)
  const confirmRouteStatusChange = async () => {
    if (!routeStatusConfirm) return
    setRouteStatusLoading(true)
    try {
      const { route, action } = routeStatusConfirm
      if (action === 'start') {
        const res = await EnhancedAPI.startRoute(route.id)
        if (!res.success) throw new Error(res.error)
        toast.success('تم بدء خط السير')
      } else {
        const res = await EnhancedAPI.completeRoute(route.id)
        if (!res.success) throw new Error(res.error)
        toast.success('تم إكمال خط السير')
      }
    } catch (error) {
      toast.error(routeStatusConfirm.action === 'start' ? 'تعذر بدء خط السير' : 'تعذر إكمال خط السير')
      console.error(error)
    } finally {
      setRouteStatusLoading(false)
      setRouteStatusConfirm(null)
    }
  }

  const handleDeleteRoute = async (route: RouteWithOrders) => {
    try {
      const res = await EnhancedAPI.deleteRoute(route.id)
      if (!res.success) throw new Error(res.error)
      toast.success('تم حذف خط السير')
      setShowDeleteModal(false)
    } catch (error) {
      toast.error('تعذر حذف خط السير')
      console.error(error)
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      planned: 'badge-gray',
      in_progress: 'badge-blue',
      completed: 'badge-green',
    }
    const text: Record<string, string> = {
      planned: 'مخطط',
      in_progress: 'جارٍ التنفيذ',
      completed: 'مكتمل',
    }
    return (
      <span className={`badge ${map[status] ?? 'badge-gray'}`}>{text[status] ?? status}</span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">إدارة خطوط السير</h1>
          <p className="text-gray-600 mt-2">تخطيط وتتبع خطوط سير الفرق</p>
        </div>
        <button
          className="btn-primary hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
          onClick={() => {
            setSelectedRoute(undefined)
            setFormMode('create')
            setShowFormModal(true)
          }}
        >
          <Plus className="h-5 w-5 ml-2" /> إنشاء خط سير
        </button>
      </div>

      {/* Routes Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-compact bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">إجمالي المسارات</p>
              <p className="text-2xl font-bold text-blue-800">{counts?.total ?? routes.length}</p>
            </div>
            <div className="p-3 bg-blue-500 rounded-lg">
              <RouteIcon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">مخططة</p>
              <p className="text-2xl font-bold text-gray-800">{counts?.planned ?? routes.filter(r => r.status === 'planned').length}</p>
            </div>
            <div className="p-3 bg-gray-500 rounded-lg">
              <Calendar className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className={`card-compact bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 ${routes.filter(r => r.status === 'in_progress').length > 0 ? 'animate-pulse' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600">قيد التنفيذ</p>
              <p className="text-2xl font-bold text-yellow-800">{counts?.in_progress ?? routes.filter(r => r.status === 'in_progress').length}</p>
            </div>
            <div className="p-3 bg-yellow-500 rounded-lg">
              <Clock className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">مكتملة</p>
              <p className="text-2xl font-bold text-green-800">{counts?.completed ?? routes.filter(r => r.status === 'completed').length}</p>
            </div>
            <div className="p-3 bg-green-500 rounded-lg">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-compact space-y-4 md:space-y-0 md:flex md:items-center md:gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Calendar className="h-5 w-5 text-gray-400" />
          <input
            type="date"
            className="input focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-60">
          <Users className="h-5 w-5 text-gray-400" />
          <select
            className="select w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="all">كل الفرق</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-52">
          <MapPin className="h-5 w-5 text-gray-400" />
          <select
            className="select w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">كل الحالات</option>
            <option value="planned">مخطط</option>
            <option value="in_progress">جارٍ التنفيذ</option>
            <option value="completed">مكتمل</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card-elevated overflow-x-auto">
        <table className="table">
          <thead className="table-header">
            <tr>
              <th className="table-header-cell">الاسم</th>
              <th className="table-header-cell">التاريخ</th>
              <th className="table-header-cell">الفريق</th>
              <th className="table-header-cell">الحالة</th>
              <th className="table-header-cell">عدد الطلبات</th>
              <th className="table-header-cell">إجراءات</th>
            </tr>
          </thead>
          <tbody className="table-body">
            {routes.map((r) => (
              <tr key={r.id} className="table-row">
                <td className="table-cell font-medium">{r.name}</td>
                <td className="table-cell">{r.date}</td>
                <td className="table-cell">{r.team?.name || '-'}</td>
                <td className="table-cell">{statusBadge(r.status)}</td>
                <td className="table-cell">{r.route_orders?.length || 0}</td>
                <td className="table-cell space-x-1 space-x-reverse whitespace-nowrap">
                  {/* Edit */}
                  <button
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                    title="تعديل"
                    onClick={() => {
                      setSelectedRoute(r)
                      setFormMode('edit')
                      setShowFormModal(true)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {/* Manage Orders */}
                  <button
                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                    title="إدارة الطلبات"
                    onClick={() => {
                      setRouteForOrders(r)
                      setShowAssignModal(true)
                    }}
                  >
                    <ListTodo className="h-4 w-4" />
                  </button>
                  {/* Start - Admin only */}
                  {isAdmin() && r.status === 'planned' && (
                    <button
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                      title="بدء الخط"
                      onClick={() => handleStartRoute(r)}
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                  {/* Complete - Admin only */}
                  {isAdmin() && r.status === 'in_progress' && (
                    <button
                      className="p-2 text-green-700 hover:bg-green-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                      title="إكمال الخط"
                      onClick={() => handleCompleteRoute(r)}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  {/* Delete - Admin only */}
                  {isAdmin() && r.status === 'planned' && (
                    <button
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                      title="حذف"
                      onClick={() => {
                        setSelectedRoute(r)
                        setShowDeleteModal(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {routes.length === 0 && (
              <tr>
                <td colSpan={6} className="table-cell text-center py-8">
                  <p className="text-gray-500">لا توجد بيانات مطابقة</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
          {/* Sentinel */}
          <div ref={sentinelRef} />
      </div>

      {/* Modals */}
      {showFormModal && (
        <RouteFormModal
          mode={formMode}
          open={showFormModal}
          onClose={() => setShowFormModal(false)}
          existingRoute={selectedRoute}
          onSaved={refresh}
          teams={teams}
        />
      )}

      {showAssignModal && routeForOrders && (
        <AssignOrdersModal
          open={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          route={routeForOrders}
          onSaved={refresh}
        />
      )}

      {showDeleteModal && selectedRoute && (
        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={() => handleDeleteRoute(selectedRoute)}
          message={`هل أنت متأكد من حذف خط السير "${selectedRoute.name}"؟`}
        />
      )}

      {/* Route Status Confirmation Modal */}
      {routeStatusConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => !routeStatusLoading && setRouteStatusConfirm(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-6 py-4 ${routeStatusConfirm.action === 'start' ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  {routeStatusConfirm.action === 'start'
                    ? <Play className="w-5 h-5 text-white" />
                    : <Check className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {routeStatusConfirm.action === 'start' ? 'تأكيد تشغيل خط السير' : 'تأكيد إنهاء خط السير'}
                  </h3>
                  <p className="text-sm text-white/80">{routeStatusConfirm.route.name}</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  {routeStatusConfirm.action === 'start' ? (
                    <p>هل أنت متأكد من <strong>تشغيل</strong> خط السير <strong>"{routeStatusConfirm.route.name}"</strong>؟ سيتم تحديث حالة الخط وجميع الطلبات المرتبطة.</p>
                  ) : (
                    <p>هل أنت متأكد من <strong>إنهاء</strong> خط السير <strong>"{routeStatusConfirm.route.name}"</strong>؟ سيؤدى ذلك لإنهاء الخط وتسجيل انصراف العمال المرتبطين تلقائياً.</p>
                  )}
                </div>
              </div>

              {/* Route Info */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {routeStatusConfirm.route.team?.name || 'غير محدد'}
                </span>
                <span className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  {routeStatusConfirm.route.route_orders?.length || 0} طلب
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 flex items-center gap-3 justify-end border-t border-gray-100">
              <button
                onClick={() => setRouteStatusConfirm(null)}
                disabled={routeStatusLoading}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={confirmRouteStatusChange}
                disabled={routeStatusLoading}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center gap-2 ${routeStatusConfirm.action === 'start'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                  }`}
              >
                {routeStatusLoading ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> جارٍ التنفيذ...</>
                ) : routeStatusConfirm.action === 'start' ? (
                  <><Play className="w-4 h-4" /> تشغيل</>
                ) : (
                  <><Check className="w-4 h-4" /> إنهاء</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RoutesPage
