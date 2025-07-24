import React, { useState } from 'react'
import {
  Download,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Users,
  Target,
  CheckCircle,
  Star,
  Award,
  DollarSign
} from 'lucide-react'
import {
  TeamPerformanceChart,
  WeeklyTrendsChart,
  QuarterlyComparisonChart
} from '../Charts/ChartComponents'
import { StatCard, TeamPerformanceCard, WorkerPerformanceCard } from './StatCards'

interface AnalyticsSectionProps {
  analyticsData: {
    weeklyStats: any[]
    quarterlyStats: any[]
    performanceTrends: any[]
    workerAnalytics: any[]
  }
  onRefresh: () => void
  isLoading?: boolean
  className?: string
}

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
  analyticsData,
  onRefresh,
  isLoading = false,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'trends' | 'performance' | 'workers' | 'quarterly'>('trends')
  const [dateRange, setDateRange] = useState('30')

  const tabs = [
    { id: 'trends', label: 'الاتجاهات الأسبوعية', icon: TrendingUp },
    { id: 'performance', label: 'أداء الفرق', icon: Users },
    { id: 'workers', label: 'تحليل العمال', icon: Target },
    { id: 'quarterly', label: 'المقارنة الربعية', icon: BarChart3 }
  ]

  const handleExport = () => {
    // Export functionality
    console.log('Exporting analytics data...')
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">التحليلات المتقدمة</h2>
            <p className="text-sm text-gray-600 mt-1">تحليل شامل لأداء الشركة والاتجاهات</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 rtl:space-x-reverse">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="7">آخر 7 أيام</option>
              <option value="30">آخر 30 يوم</option>
              <option value="90">آخر 3 أشهر</option>
              <option value="365">آخر سنة</option>
            </select>
            
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              تحديث
            </button>
            
            <button
              onClick={handleExport}
              className="flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              تصدير
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-1 rtl:space-x-reverse mt-6">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-center sm:justify-start px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-gray-600">جاري تحميل البيانات...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Weekly Trends Tab */}
            {activeTab === 'trends' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                  <StatCard
                    title="متوسط الطلبات الأسبوعية"
                    value={(Array.isArray(analyticsData.weeklyStats) ? analyticsData.weeklyStats : []).reduce((acc, week) => acc + week.total_orders, 0) / (analyticsData.weeklyStats?.length || 1) || 0}
                    icon={<BarChart3 className="h-5 w-5" />}
                    color="blue"
                  />
                  <StatCard
                    title="نمو الإيرادات الأسبوعي"
                    value={`${(((Array.isArray(analyticsData.weeklyStats) && analyticsData.weeklyStats.length > 0 ? analyticsData.weeklyStats[analyticsData.weeklyStats.length - 1]?.total_revenue : 0) || 0) / 1000).toFixed(0)}K ج.م`}
                    icon={<TrendingUp className="h-5 w-5" />}
                    color="green"
                  />
                  <StatCard
                    title="معدل الربحية"
                    value={`${(((Array.isArray(analyticsData.weeklyStats) && analyticsData.weeklyStats.length > 0 ? analyticsData.weeklyStats[analyticsData.weeklyStats.length - 1]?.net_profit : 0) || 0) / ((Array.isArray(analyticsData.weeklyStats) && analyticsData.weeklyStats.length > 0 ? analyticsData.weeklyStats[analyticsData.weeklyStats.length - 1]?.total_revenue : 0) || 1) * 100).toFixed(1)}%`}
                    icon={<Target className="h-5 w-5" />}
                    color="purple"
                  />
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">الاتجاهات الأسبوعية</h3>
                  <div className="w-full overflow-x-auto">
                    <WeeklyTrendsChart data={Array.isArray(analyticsData.weeklyStats) ? analyticsData.weeklyStats : []} height={400} />
                  </div>
                </div>
              </div>
            )}

            {/* Team Performance Tab */}
            {activeTab === 'performance' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">مقارنة أداء الفرق</h3>
                  <div className="w-full overflow-x-auto">
                    <TeamPerformanceChart data={Array.isArray(analyticsData.performanceTrends) ? analyticsData.performanceTrends : []} height={400} />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                  {(Array.isArray(analyticsData.performanceTrends) ? analyticsData.performanceTrends : []).map((team, index) => (
                    <TeamPerformanceCard
                      key={team.team_id || index}
                      team={{
                        id: team.team_id,
                        name: team.team_name,
                        totalOrders: team.total_orders,
                        completedOrders: team.completed_orders,
                        totalRevenue: team.total_revenue,
                        averageRating: team.avg_rating,
                        activeWorkers: team.active_workers
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Workers Analytics Tab */}
            {activeTab === 'workers' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <StatCard
                    title="إجمالي العمال"
                    value={(Array.isArray(analyticsData.workerAnalytics) ? analyticsData.workerAnalytics : []).length}
                    icon={<Users className="h-5 w-5" />}
                    color="blue"
                  />
                  <StatCard
                    title="العمال النشطون"
                    value={(Array.isArray(analyticsData.workerAnalytics) ? analyticsData.workerAnalytics : []).filter(w => w.total_orders > 0).length}
                    icon={<CheckCircle className="h-5 w-5" />}
                    color="green"
                  />
                  <StatCard
                    title="متوسط التقييم"
                    value={((Array.isArray(analyticsData.workerAnalytics) ? analyticsData.workerAnalytics : []).reduce((acc, w) => acc + w.avg_rating, 0) / (analyticsData.workerAnalytics?.length || 1) || 0).toFixed(1)}
                    icon={<Star className="h-5 w-5" />}
                    color="yellow"
                  />
                  <StatCard
                    title="متوسط الكفاءة"
                    value={`${((Array.isArray(analyticsData.workerAnalytics) ? analyticsData.workerAnalytics : []).reduce((acc, w) => acc + w.efficiency_score, 0) / (analyticsData.workerAnalytics?.length || 1) || 0).toFixed(1)}%`}
                    icon={<Target className="h-5 w-5" />}
                    color="purple"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                  {(Array.isArray(analyticsData.workerAnalytics) ? analyticsData.workerAnalytics : []).slice(0, 9).map((worker, index) => (
                    <WorkerPerformanceCard
                      key={worker.worker_id || index}
                      worker={{
                        id: worker.worker_id,
                        name: worker.worker_name,
                        totalOrders: worker.total_orders,
                        completedOrders: worker.completed_orders,
                        averageRating: worker.avg_rating,
                        totalRevenue: worker.total_revenue,
                        efficiency: worker.efficiency_score
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quarterly Comparison Tab */}
            {activeTab === 'quarterly' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                  <StatCard
                    title="أفضل ربع"
                    value={(Array.isArray(analyticsData.quarterlyStats) ? analyticsData.quarterlyStats : []).reduce((best, current) => 
                      current.net_profit > (best?.net_profit || 0) ? current : best, {})?.quarter_label || 'غير متاح'}
                    icon={<Award className="h-5 w-5" />}
                    color="green"
                  />
                  <StatCard
                    title="نمو الإيرادات"
                    value={(Array.isArray(analyticsData.quarterlyStats) && analyticsData.quarterlyStats.length > 1) ? 
                      `${(((analyticsData.quarterlyStats[analyticsData.quarterlyStats.length - 1]?.total_revenue || 0) - 
                           (analyticsData.quarterlyStats[analyticsData.quarterlyStats.length - 2]?.total_revenue || 0)) / 
                           (analyticsData.quarterlyStats[analyticsData.quarterlyStats.length - 2]?.total_revenue || 1) * 100).toFixed(1)}%` : 
                      '0%'
                    }
                    icon={<TrendingUp className="h-5 w-5" />}
                    color="blue"
                  />
                  <StatCard
                    title="متوسط الربح الربعي"
                    value={`${(((Array.isArray(analyticsData.quarterlyStats) ? analyticsData.quarterlyStats : []).reduce((acc, q) => acc + q.net_profit, 0) || 0) / (analyticsData.quarterlyStats?.length || 1) / 1000).toFixed(0)}K ج.م`}
                    icon={<DollarSign className="h-5 w-5" />}
                    color="purple"
                  />
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">المقارنة الربعية</h3>
                  <div className="w-full overflow-x-auto">
                    <QuarterlyComparisonChart data={Array.isArray(analyticsData.quarterlyStats) ? analyticsData.quarterlyStats : []} height={400} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AnalyticsSection