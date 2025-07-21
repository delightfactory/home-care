import React, { useEffect, useState } from 'react'
import { Plus, Calendar, Users, MapPin, ListTodo, Play, Check, Trash2, Pencil } from 'lucide-react'
import { RoutesAPI, TeamsAPI } from '../../api'
import {
  RouteWithOrders,
  RouteStatus,
  TeamWithMembers,
} from '../../types'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import RouteFormModal from '../../components/Forms/RouteFormModal'
import AssignOrdersModal from '../../components/Forms/AssignOrdersModal'
import DeleteConfirmModal from '../../components/UI/DeleteConfirmModal'
import toast from 'react-hot-toast'

const RoutesPage: React.FC = () => {
  const [routes, setRoutes] = useState<RouteWithOrders[]>([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().substring(0,10)
  const [dateFilter, setDateFilter] = useState<string>(today)
  const [statusFilter, setStatusFilter] = useState<'all' | RouteStatus>('all')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [teams, setTeams] = useState<TeamWithMembers[]>([])

  const [showFormModal, setShowFormModal] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<RouteWithOrders | undefined>()
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [routeForOrders, setRouteForOrders] = useState<RouteWithOrders | undefined>()
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const fetchTeams = async () => {
    try {
      const data = await TeamsAPI.getTeams()
      setTeams(data)
    } catch (error) {
      toast.error('تعذر تحميل الفرق')
    }
  }

  const fetchRoutes = async () => {
    try {
      setLoading(true)
      const filters: any = {}
      if (dateFilter) filters.date = dateFilter
      if (teamFilter !== 'all') filters.team_id = teamFilter
      if (statusFilter !== 'all') filters.status = [statusFilter]
      const res = await RoutesAPI.getRoutes(filters)
      setRoutes(res.data)
    } catch (error) {
      toast.error('تعذر تحميل خطوط السير')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeams()
  }, [])

  useEffect(() => {
    fetchRoutes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, teamFilter, statusFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" text="جاري تحميل خطوط السير..." />
      </div>
    )
  }

  const handleStartRoute = async (route: RouteWithOrders) => {
    try {
      const res = await RoutesAPI.startRoute(route.id)
      if (!res.success) throw new Error(res.error)
      toast.success('تم بدء خط السير')
      fetchRoutes()
    } catch (error) {
      toast.error('تعذر بدء خط السير')
      console.error(error)
    }
  }

  const handleCompleteRoute = async (route: RouteWithOrders) => {
    try {
      const res = await RoutesAPI.completeRoute(route.id)
      if (!res.success) throw new Error(res.error)
      toast.success('تم إكمال خط السير')
      fetchRoutes()
    } catch (error) {
      toast.error('تعذر إكمال خط السير')
      console.error(error)
    }
  }

  const handleDeleteRoute = async (route: RouteWithOrders) => {
    try {
      const res = await RoutesAPI.deleteRoute(route.id)
      if (!res.success) throw new Error(res.error)
      toast.success('تم حذف خط السير')
      setShowDeleteModal(false)
      fetchRoutes()
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
          <h1 className="text-2xl font-bold text-gray-900">إدارة خطوط السير</h1>
          <p className="text-gray-600 mt-1">تخطيط وتتبع خطوط سير الفرق</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setSelectedRoute(undefined)
            setFormMode('create')
            setShowFormModal(true)
          }}
        >
          <Plus className="h-5 w-5 ml-2" /> إنشاء خط سير
        </button>
      </div>

      {/* Filters */}
      <div className="card space-y-4 md:space-y-0 md:flex md:items-center md:gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Calendar className="h-5 w-5 text-gray-400" />
          <input
            type="date"
            className="input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-60">
          <Users className="h-5 w-5 text-gray-400" />
          <select
            className="select w-full"
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
            className="select w-full"
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
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm rtl:text-right">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="px-4 py-3">الاسم</th>
              <th className="px-4 py-3">التاريخ</th>
              <th className="px-4 py-3">الفريق</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">عدد الطلبات</th>
              <th className="px-4 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3">{r.date}</td>
                <td className="px-4 py-3">{r.team?.name || '-'}</td>
                <td className="px-4 py-3">{statusBadge(r.status)}</td>
                <td className="px-4 py-3">{r.route_orders?.length || 0}</td>
                <td className="px-4 py-3 space-x-1 space-x-reverse whitespace-nowrap">
                  {/* Edit */}
                  <button
                    className="icon-btn text-blue-600"
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
                    className="icon-btn text-amber-600"
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
                      className="icon-btn text-green-600"
                      title="بدء الخط"
                      onClick={() => handleStartRoute(r)}
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                  {/* Complete */}
                  {r.status === 'in_progress' && (
                    <button
                      className="icon-btn text-green-700"
                      title="إكمال الخط"
                      onClick={() => handleCompleteRoute(r)}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  {/* Delete */}
                  {r.status === 'planned' && (
                    <button
                      className="icon-btn text-red-600"
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
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  لا توجد بيانات مطابقة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showFormModal && (
        <RouteFormModal
          mode={formMode}
          open={showFormModal}
          onClose={() => setShowFormModal(false)}
          existingRoute={selectedRoute}
          onSaved={fetchRoutes}
          teams={teams}
        />
      )}

      {showAssignModal && routeForOrders && (
        <AssignOrdersModal
          open={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          route={routeForOrders}
          onSaved={fetchRoutes}
        />
      )}

      {showDeleteModal && selectedRoute && (
        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={() => handleDeleteRoute(selectedRoute)}
          title="تأكيد الحذف"
          message="هل أنت متأكد من حذف خط السير؟"
          itemName={selectedRoute.name}
        />
      )}
    </div>
  )
}

export default RoutesPage
