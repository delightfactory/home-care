import React, { useMemo, useEffect, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { getToday, supabase } from '../../api'
import { usePermissions } from '../../hooks/usePermissions'
import { useSystemHealth } from '../../hooks/useEnhancedAPI'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import toast from 'react-hot-toast'

// Hook مخصص لحساب إحصائيات لوحة التحكم بطريقة مبسطة ومباشرة
const useDashboardStats = (date: string) => {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // جلب طلبات اليوم المكتملة والمدفوعة فقط
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('id, status, total_amount, customer_rating, payment_status')
        .eq('scheduled_date', date)

      // جلب مصروفات اليوم المعتمدة فقط
      const { data: todayExpenses } = await supabase
        .from('expenses')
        .select('id, amount, status')
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`)
        .eq('status', 'approved')

      // جلب الفرق النشطة
      const { data: activeTeams } = await supabase
        .from('teams')
        .select('id')
        .eq('is_active', true)

      // حساب الإحصائيات
      const totalOrders = todayOrders?.length || 0
      const completedOrders = todayOrders?.filter(o => o.status === 'completed').length || 0
      const cancelledOrders = todayOrders?.filter(o => o.status === 'cancelled').length || 0

      // حساب الإيرادات من الطلبات المكتملة والمدفوعة فقط
      const paidOrders = todayOrders?.filter(o =>
        o.status === 'completed' &&
        (o.payment_status === 'paid_cash' || o.payment_status === 'paid_card')
      ) || []

      const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)

      // حساب المصروفات المعتمدة فقط
      const totalExpenses = todayExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

      // حساب صافي الربح
      const netProfit = totalRevenue - totalExpenses

      // حساب متوسط التقييم
      const ratedOrders = todayOrders?.filter(o => o.customer_rating) || []
      const averageRating = ratedOrders.length > 0
        ? ratedOrders.reduce((sum, o) => sum + (o.customer_rating || 0), 0) / ratedOrders.length
        : 0

      setStats({
        total_orders: totalOrders,
        completed_orders: completedOrders,
        cancelled_orders: cancelledOrders,
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        active_teams: activeTeams?.length || 0,
        average_rating: averageRating,
        paid_orders_count: paidOrders.length,
        approved_expenses_count: todayExpenses?.length || 0
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return { stats, loading, error, refresh: fetchStats }
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const today = useMemo(() => getToday(), [])

  // استخدام Hook المخصص للحساب المباشر
  const {
    stats,
    loading: statsLoading,
    error: statsError
  } = useDashboardStats(today)

  // Optional: system health (auto-refresh)
  const { health: _health } = useSystemHealth()

  const { hasRole } = usePermissions()
  const isSupervisor = hasRole('operations_supervisor')

  // Active routes query (cached for 1 minute)
  const { data: activeRoutes = 0, error: routesError } = useQuery(['activeRoutes', today], async () => {
    const { data: routesData } = await supabase
      .from('routes')
      .select('id', { count: 'exact', head: true })
      .eq('date', today)
      .eq('status', 'in_progress')
    return routesData?.length || 0
  }, { staleTime: 1000 * 60 })

  const pendingOrders = useMemo(() => {
    if (!stats) return 0
    return stats.total_orders - stats.completed_orders - stats.cancelled_orders
  }, [stats])

  useEffect(() => {
    if (statsError || routesError) {
      toast.error('حدث خطأ في تحميل إحصائيات لوحة التحكم')
    }
  }, [statsError, routesError])



  /* Legacy fetchDashboardStats replaced by React Query */
  /*
      try {
        setLoading(true)
        const today = getToday()
        let dashboard = await ReportsAPI.getDailyDashboard(today)
        // إذا لم يوجد تقرير يومي مخزَّن، احسب الإحصائيات بالطريقة القديمة
        if (!dashboard) {
          const legacy = await ReportsAPI.getDashboardStats()
          dashboard = {
            report_date: today,
            total_orders: legacy.today_orders,
            completed_orders: legacy.today_orders - legacy.pending_orders, // تقريب تقريبي
            cancelled_orders: 0,
            total_revenue: legacy.total_revenue,
            total_expenses: legacy.total_expenses,
            net_profit: legacy.net_profit,
            active_teams: legacy.active_teams,
            average_rating: legacy.average_rating
          }
        }
        setStats(dashboard)
        const pending = dashboard.total_orders - dashboard.completed_orders - dashboard.cancelled_orders
        setPendingOrders(pending)
        // Fetch active routes count quickly
        const { data: routesData } = await supabase
          .from('routes')
          .select('id', {count: 'exact', head: true})
          .eq('date', today)
          .eq('status', 'in_progress')
        setActiveRoutes(routesData?.length || 0)
      } catch (error) {
        toast.error('حدث خطأ في تحميل إحصائيات لوحة التحكم')
        console.error('Dashboard stats error:', error)
      } finally {
        setLoading(false)
      }
    }
  
    */

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" text="جاري تحميل لوحة التحكم..." />
      </div>
    )
  }

  const statCards = [
    {
      name: 'طلبات اليوم',
      value: stats?.total_orders || 0,
      icon: Calendar,
      color: 'text-blue-600',
      bgGradient: 'bg-gradient-to-br from-blue-50 to-blue-100',
      iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600'
    },
    {
      name: 'الطلبات المعلقة',
      value: pendingOrders || 0,
      icon: Clock,
      color: 'text-yellow-600',
      bgGradient: 'bg-gradient-to-br from-yellow-50 to-yellow-100',
      iconBg: 'bg-gradient-to-br from-yellow-500 to-yellow-600',
      pulse: pendingOrders > 0
    },
    {
      name: 'الخطوط النشطة',
      value: activeRoutes || 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bgGradient: 'bg-gradient-to-br from-green-50 to-green-100',
      iconBg: 'bg-gradient-to-br from-green-500 to-green-600',
      pulse: activeRoutes > 0
    },
    {
      name: 'الفرق النشطة',
      value: stats?.active_teams || 0,
      icon: Users,
      color: 'text-purple-600',
      bgGradient: 'bg-gradient-to-br from-purple-50 to-purple-100',
      iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600'
    },
    {
      name: 'إجمالي الإيرادات',
      value: `${stats?.total_revenue?.toLocaleString() || 0} ج.م`,
      subtitle: `من ${stats?.paid_orders_count || 0} طلب مدفوع`,
      icon: DollarSign,
      color: 'text-emerald-600',
      bgGradient: 'bg-gradient-to-br from-emerald-50 to-emerald-100',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600'
    },
    {
      name: 'إجمالي المصروفات',
      value: `${stats?.total_expenses?.toLocaleString() || 0} ج.م`,
      subtitle: `من ${stats?.approved_expenses_count || 0} مصروف معتمد`,
      icon: TrendingUp,
      color: 'text-red-600',
      bgGradient: 'bg-gradient-to-br from-red-50 to-red-100',
      iconBg: 'bg-gradient-to-br from-red-500 to-red-600'
    },
    {
      name: 'صافي الربح',
      value: `${stats?.net_profit?.toLocaleString() || 0} ج.م`,
      subtitle: 'الإيرادات المدفوعة - المصروفات المعتمدة',
      icon: DollarSign,
      color: stats && stats.net_profit >= 0 ? 'text-green-600' : 'text-red-600',
      bgGradient: stats && stats.net_profit >= 0 ? 'bg-gradient-to-br from-green-50 to-green-100' : 'bg-gradient-to-br from-red-50 to-red-100',
      iconBg: stats && stats.net_profit >= 0 ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-red-500 to-red-600'
    },
    {
      name: 'متوسط التقييم',
      value: stats?.average_rating?.toFixed(1) || '0.0',
      icon: AlertCircle,
      color: 'text-orange-600',
      bgGradient: 'bg-gradient-to-br from-orange-50 to-orange-100',
      iconBg: 'bg-gradient-to-br from-orange-500 to-orange-600'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl p-6 border border-primary-200">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-700 to-primary-900 bg-clip-text text-transparent">
          لوحة التحكم
        </h1>
        <p className="text-gray-600 mt-2 text-lg">
          نظرة عامة على أداء الشركة اليوم - {new Date().toLocaleDateString('ar-AE')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <div
            key={stat.name}
            className={`card-compact group hover:scale-105 transition-all duration-300 ${stat.bgGradient} border-0 shadow-lg hover:shadow-xl ${stat.pulse ? 'animate-pulse' : ''}`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`p-4 rounded-xl ${stat.iconBg} group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <stat.icon className="h-7 w-7 text-white" />
                </div>
              </div>
              <div className="mr-4 flex-1">
                <p className="text-sm font-semibold text-gray-700 mb-1">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 group-hover:text-primary-700 transition-colors duration-300">
                  {stat.value}
                </p>
                {stat.subtitle && (
                  <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions & Alerts */}
      <div className={`grid grid-cols-1 gap-6 ${!isSupervisor ? 'lg:grid-cols-2' : ''}`}>
        {!isSupervisor && (
          <div className="card-elevated bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <div className="card-header border-b border-blue-200">
              <h3 className="card-title text-blue-900 flex items-center">
                <TrendingUp className="h-5 w-5 ml-2" />
                إجراءات سريعة
              </h3>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/orders?action=create')}
                className="btn-primary w-full justify-start hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                <ShoppingCart className="h-5 w-5 ml-2" />
                إضافة طلب جديد
              </button>
              <button
                onClick={() => navigate('/customers?action=create')}
                className="btn-secondary w-full justify-start hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                <Users className="h-5 w-5 ml-2" />
                إضافة عميل جديد
              </button>
              <button
                onClick={() => navigate('/routes')}
                className="btn-secondary w-full justify-start hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                <Calendar className="h-5 w-5 ml-2" />
                عرض جدول اليوم
              </button>
            </div>
          </div>
        )}

        <div className="card-elevated bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <div className="card-header border-b border-amber-200">
            <h3 className="card-title text-amber-900 flex items-center">
              <AlertCircle className="h-5 w-5 ml-2" />
              تنبيهات مهمة
            </h3>
          </div>
          <div className="space-y-3">
            {pendingOrders > 0 && (
              <div className="flex items-center p-4 bg-gradient-to-r from-yellow-100 to-yellow-200 rounded-xl border border-yellow-300 shadow-sm animate-pulse">
                <AlertCircle className="h-6 w-6 text-yellow-700 ml-3 flex-shrink-0" />
                <span className="text-sm font-medium text-yellow-800">
                  يوجد {pendingOrders} طلب معلق يحتاج إلى معالجة
                </span>
              </div>
            )}

            {activeRoutes === 0 && (
              <div className="flex items-center p-4 bg-gradient-to-r from-blue-100 to-blue-200 rounded-xl border border-blue-300 shadow-sm">
                <Clock className="h-6 w-6 text-blue-700 ml-3 flex-shrink-0" />
                <span className="text-sm font-medium text-blue-800">
                  لا توجد خطوط سير نشطة اليوم
                </span>
              </div>
            )}

            {pendingOrders === 0 && activeRoutes > 0 && (
              <div className="flex items-center p-4 bg-gradient-to-r from-green-100 to-green-200 rounded-xl border border-green-300 shadow-sm">
                <CheckCircle className="h-6 w-6 text-green-700 ml-3 flex-shrink-0" />
                <span className="text-sm font-medium text-green-800">
                  جميع العمليات تسير بشكل طبيعي
                </span>
              </div>
            )}

            {pendingOrders === 0 && activeRoutes === 0 && (
              <div className="flex items-center p-4 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl border border-gray-300 shadow-sm">
                <Clock className="h-6 w-6 text-gray-700 ml-3 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-800">
                  لا توجد أنشطة اليوم
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
