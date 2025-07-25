import React, { useState, useMemo, useEffect } from 'react'
import { Plus, Calendar, Users, MapPin, ListTodo, Play, Check, Trash2, Pencil, Route as RouteIcon, Clock, CheckCircle } from 'lucide-react'
import EnhancedAPI from '../../api/enhanced-api'
import { eventBus } from '../../utils/EventBus'
import { useRoutes, useTeams, useSystemHealth, useRouteCounts } from '../../hooks/useEnhancedAPI'
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

  const handleStartRoute = async (route: RouteWithOrders) => {
    try {
      const res = await EnhancedAPI.startRoute(route.id)
      if (!res.success) throw new Error(res.error)
      toast.success('تم بدء خط السير')
    } catch (error) {
      toast.error('تعذر بدء خط السير')
      console.error(error)
    }


  }

  const handleCompleteRoute = async (route: RouteWithOrders) => {
    try {
      const res = await EnhancedAPI.completeRoute(route.id)
      if (!res.success) throw new Error(res.error)
      toast.success('تم إكمال خط السير')
    } catch (error) {
      toast.error('تعذر إكمال خط السير')
      console.error(error)
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
                  {/* Start */}
                  {r.status === 'planned' && (
                    <button
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                      title="بدء الخط"
                      onClick={() => handleStartRoute(r)}
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                  {/* Complete */}
                  {r.status === 'in_progress' && (
                    <button
                      className="p-2 text-green-700 hover:bg-green-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                      title="إكمال الخط"
                      onClick={() => handleCompleteRoute(r)}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  {/* Delete */}
                  {r.status === 'planned' && (
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
    </div>
  )
}

export default RoutesPage
