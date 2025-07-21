import React, { useEffect, useState } from 'react'
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
import { ReportsAPI, getToday, supabase } from '../../api'
import { DailyDashboard } from '../../types'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import toast from 'react-hot-toast'

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DailyDashboard | null>(null)
  const [pendingOrders, setPendingOrders] = useState<number>(0)
  const [activeRoutes, setActiveRoutes] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
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

  if (loading) {
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
      bgColor: 'bg-blue-100'
    },
    {
      name: 'الطلبات المعلقة',
      value: pendingOrders || 0,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    },
    {
      name: 'الخطوط النشطة',
      value: activeRoutes || 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      name: 'الفرق النشطة',
      value: activeRoutes || 0,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      name: 'إجمالي الإيرادات',
      value: `${stats?.total_revenue?.toLocaleString() || 0} ج.م`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      name: 'إجمالي المصروفات',
      value: `${stats?.total_expenses?.toLocaleString() || 0} ج.م`,
      icon: TrendingUp,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    },
    {
      name: 'صافي الربح',
      value: `${stats?.net_profit?.toLocaleString() || 0} ج.م`,
      icon: DollarSign,
      color: stats && stats.net_profit >= 0 ? 'text-green-600' : 'text-red-600',
      bgColor: stats && stats.net_profit >= 0 ? 'bg-green-100' : 'bg-red-100'
    },
    {
      name: 'متوسط التقييم',
      value: stats?.average_rating?.toFixed(1) || '0.0',
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
        <p className="text-gray-600 mt-1">
          نظرة عامة على أداء الشركة اليوم
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.name} className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
              <div className="mr-4 flex-1">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">إجراءات سريعة</h3>
          </div>
          <div className="space-y-3">
            <button className="btn-primary w-full justify-start">
              <ShoppingCart className="h-5 w-5 ml-2" />
              إضافة طلب جديد
            </button>
            <button className="btn-secondary w-full justify-start">
              <Users className="h-5 w-5 ml-2" />
              إضافة عميل جديد
            </button>
            <button className="btn-secondary w-full justify-start">
              <Calendar className="h-5 w-5 ml-2" />
              عرض جدول اليوم
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">تنبيهات مهمة</h3>
          </div>
          <div className="space-y-3">
            {pendingOrders > 0 && (
              <div className="flex items-center p-3 bg-yellow-50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600 ml-2" />
                <span className="text-sm text-yellow-800">
                  يوجد {pendingOrders} طلب معلق يحتاج إلى معالجة
                </span>
              </div>
            )}
            
            {activeRoutes === 0 && (
              <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600 ml-2" />
                <span className="text-sm text-blue-800">
                  لا توجد خطوط سير نشطة اليوم
                </span>
              </div>
            )}

            {pendingOrders === 0 && activeRoutes === 0 && (
              <div className="flex items-center p-3 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 ml-2" />
                <span className="text-sm text-green-800">
                  جميع العمليات تسير بشكل طبيعي
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
