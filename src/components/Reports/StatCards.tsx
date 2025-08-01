import React from 'react'
import { 
  DollarSign, 
  Users, 
  ShoppingCart, 
  TrendingUp,
  Award,
  Calendar,
  Target
} from 'lucide-react'
import { TrendIndicator } from '../Charts/ChartComponents'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: {
    direction: 'up' | 'down' | 'stable'
    percentage: number
    period?: string
  }
  subtitle?: string
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray'
  className?: string
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  subtitle,
  color = 'blue',
  className = ''
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200'
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-200 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3 sm:mb-2">
            <h3 className="text-sm sm:text-base font-medium text-gray-600 truncate">{title}</h3>
            <div className={`p-2 sm:p-2.5 rounded-lg ${colorClasses[color]} flex-shrink-0`}>
              {icon}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-baseline space-y-1 sm:space-y-0 sm:space-x-2 rtl:space-x-reverse">
            <p className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {trend && (
              <div className="flex-shrink-0">
                <TrendIndicator trend={trend} />
              </div>
            )}
          </div>
          
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-500 mt-2 sm:mt-1 break-words">{subtitle}</p>
          )}
          
          {trend?.period && (
            <p className="text-xs text-gray-400 mt-1">
              مقارنة بـ {trend.period}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Dashboard Stats Grid Component
interface DashboardStatsProps {
  stats: {
    totalOrders: number
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    activeWorkers: number
    completedOrders: number
    pendingOrders: number
    averageRating: number
    trends?: {
      orders: { direction: 'up' | 'down' | 'stable', percentage: number }
      revenue: { direction: 'up' | 'down' | 'stable', percentage: number }
      profit: { direction: 'up' | 'down' | 'stable', percentage: number }
      rating: { direction: 'up' | 'down' | 'stable', percentage: number }
    }
  }
  className?: string
}

export const DashboardStatsGrid: React.FC<DashboardStatsProps> = ({ stats, className = '' }) => {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 ${className}`}>
      <StatCard
        title="إجمالي الطلبات"
        value={stats.totalOrders}
        icon={<ShoppingCart className="h-5 w-5" />}
        trend={stats.trends?.orders ? { ...stats.trends.orders, period: 'الشهر الماضي' } : undefined}
        subtitle={`${stats.completedOrders} مكتمل، ${stats.pendingOrders} معلق`}
        color="blue"
      />
      
      <StatCard
        title="إجمالي الإيرادات"
        value={`${stats.totalRevenue.toLocaleString()} ج.م`}
        icon={<DollarSign className="h-5 w-5" />}
        trend={stats.trends?.revenue ? { ...stats.trends.revenue, period: 'الشهر الماضي' } : undefined}
        color="green"
      />
      
      <StatCard
        title="صافي الربح"
        value={`${stats.netProfit.toLocaleString()} ج.م`}
        icon={<TrendingUp className="h-5 w-5" />}
        trend={stats.trends?.profit ? { ...stats.trends.profit, period: 'الشهر الماضي' } : undefined}
        subtitle={`المصروفات: ${stats.totalExpenses.toLocaleString()} ج.م`}
        color={stats.netProfit >= 0 ? 'green' : 'red'}
      />
      
      <StatCard
        title="متوسط التقييم"
        value={stats.averageRating.toFixed(1)}
        icon={<Award className="h-5 w-5" />}
        trend={stats.trends?.rating ? { ...stats.trends.rating, period: 'الشهر الماضي' } : undefined}
        subtitle={`العمال النشطون: ${stats.activeWorkers}`}
        color="purple"
      />
    </div>
  )
}

// Team Performance Cards
interface TeamPerformanceCardProps {
  team: {
    id: string
    name: string
    totalOrders: number
    completedOrders: number
    totalRevenue: number
    averageRating: number
    activeWorkers: number
  }
  className?: string
}

export const TeamPerformanceCard: React.FC<TeamPerformanceCardProps> = ({ team, className = '' }) => {
  const completionRate = team.totalOrders > 0 ? (team.completedOrders / team.totalOrders) * 100 : 0
  
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-200 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{team.name}</h3>
        <div className="flex items-center space-x-1 rtl:space-x-reverse flex-shrink-0">
          <Award className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium text-gray-700">
            {team.averageRating.toFixed(1)}
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
        <div className="text-center sm:text-right">
          <p className="text-xs sm:text-sm text-gray-600">إجمالي الطلبات</p>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{team.totalOrders}</p>
        </div>
        <div className="text-center sm:text-right">
          <p className="text-xs sm:text-sm text-gray-600">الطلبات المكتملة</p>
          <p className="text-lg sm:text-xl font-bold text-green-600">{team.completedOrders}</p>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs sm:text-sm text-gray-600">معدل الإنجاز</span>
          <span className="text-xs sm:text-sm font-medium text-gray-900">{completionRate.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm">
        <div className="flex items-center space-x-1 rtl:space-x-reverse justify-center sm:justify-start">
          <Users className="h-4 w-4 text-gray-500" />
          <span className="text-gray-600">{team.activeWorkers} عامل</span>
        </div>
        <div className="text-green-600 font-medium text-center sm:text-right">
          {team.totalRevenue.toLocaleString()} ج.م
        </div>
      </div>
    </div>
  )
}

// Worker Performance Card
interface WorkerPerformanceCardProps {
  worker: {
    id: string
    name: string
    totalOrders: number
    completedOrders: number
    averageRating: number
    totalRevenue: number
    efficiency: number
  }
  className?: string
}

export const WorkerPerformanceCard: React.FC<WorkerPerformanceCardProps> = ({ worker, className = '' }) => {
  // احسب الكفاءة إذا لم يتم تمريرها أو كانت غير صالحة
  const computedEfficiency =
    typeof worker.efficiency === 'number' && !isNaN(worker.efficiency)
      ? worker.efficiency
      : worker.totalOrders > 0
      ? (worker.completedOrders / worker.totalOrders) * 100
      : undefined;

  const efficiencyValue = computedEfficiency ?? 0;

  const displayEfficiency =
    computedEfficiency !== undefined ? `${efficiencyValue.toFixed(1)}% كفاءة` : 'غير متاح';

  const safeAverageRating =
    typeof worker.averageRating === 'number' && !isNaN(worker.averageRating)
      ? worker.averageRating
      : undefined;
  const getEfficiencyColor = (efficiency: number | undefined) => {
    if (efficiency !== undefined && efficiency >= 90) return 'text-green-600 bg-green-100'
    if (efficiency !== undefined && efficiency >= 70) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }
  
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-200 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{worker.name}</h3>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getEfficiencyColor(worker.efficiency)} flex-shrink-0 text-center`}>
          {displayEfficiency}
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <p className="text-xs sm:text-sm text-gray-600">الطلبات</p>
          <p className="text-base sm:text-lg font-bold text-gray-900">{worker.totalOrders}</p>
        </div>
        <div className="text-center">
          <p className="text-xs sm:text-sm text-gray-600">مكتمل</p>
          <p className="text-base sm:text-lg font-bold text-green-600">{worker.completedOrders}</p>
        </div>
        <div className="text-center">
          <p className="text-xs sm:text-sm text-gray-600">التقييم</p>
          <p className="text-base sm:text-lg font-bold text-yellow-600">{safeAverageRating !== undefined ? safeAverageRating.toFixed(1) : '—'}</p>
        </div>
      </div>
      
      <div className="text-center pt-3 border-t border-gray-100">
        <p className="text-xs sm:text-sm text-gray-600">إجمالي الإيرادات</p>
        <p className="text-lg sm:text-xl font-bold text-green-600 break-words">{worker.totalRevenue.toLocaleString()} ج.م</p>
      </div>
    </div>
  )
}

// Quick Stats Summary
interface QuickStatsSummaryProps {
  stats: {
    todayOrders: number
    weeklyRevenue: number
    monthlyProfit: number
    activeTeams: number
  }
  className?: string
}

export const QuickStatsSummary: React.FC<QuickStatsSummaryProps> = ({ stats, className = '' }) => {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${className}`}>
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-3 sm:p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-blue-100 text-xs sm:text-sm truncate">طلبات اليوم</p>
            <p className="text-xl sm:text-2xl font-bold">{stats.todayOrders}</p>
          </div>
          <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-blue-200 flex-shrink-0 ml-2" />
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-3 sm:p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-green-100 text-xs sm:text-sm truncate">إيرادات الأسبوع</p>
            <p className="text-xl sm:text-2xl font-bold">{(stats.weeklyRevenue / 1000).toFixed(0)}K</p>
          </div>
          <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-200 flex-shrink-0 ml-2" />
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-3 sm:p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-purple-100 text-xs sm:text-sm truncate">ربح الشهر</p>
            <p className="text-xl sm:text-2xl font-bold">{(stats.monthlyProfit / 1000).toFixed(0)}K</p>
          </div>
          <Target className="h-6 w-6 sm:h-8 sm:w-8 text-purple-200 flex-shrink-0 ml-2" />
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-3 sm:p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-orange-100 text-xs sm:text-sm truncate">الفرق النشطة</p>
            <p className="text-xl sm:text-2xl font-bold">{stats.activeTeams}</p>
          </div>
          <Users className="h-6 w-6 sm:h-8 sm:w-8 text-orange-200 flex-shrink-0 ml-2" />
        </div>
      </div>
    </div>
  )
}