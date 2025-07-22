import React, { useState } from 'react'
import { BarChart3, Calendar, Download, TrendingUp, Users, DollarSign, Target, Activity } from 'lucide-react'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import { useDashboard, useSystemHealth } from '../../hooks/useEnhancedAPI'

const ReportsPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const { dashboard, loading, error, refresh } = useDashboard(selectedDate)
  const { health } = useSystemHealth()

  // Data is now handled by hooks - no manual fetching needed

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" text="جاري تحميل التقارير..." />
      </div>
    )
  }

  const todayDashboard = dashboard?.daily
  const teamSummaries = dashboard?.teams || []
  
  // Show error state if needed
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">حدث خطأ في تحميل التقارير</p>
          <button onClick={refresh} className="btn-primary">
            إعادة المحاولة
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            التقارير والإحصائيات
          </h1>
          <p className="text-gray-600 mt-1">تقارير الأداء اليومية والشهرية</p>
        </div>
        <div className="flex space-x-3 space-x-reverse">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
          <button className="btn-secondary hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl">
            <Download className="h-5 w-5 ml-2" />
            تصدير
          </button>
        </div>
      </div>

      {/* Daily Report */}
      <div className="card-elevated">
        <div className="card-header">
          <div className="flex items-center">
            <Calendar className="h-6 w-6 text-blue-600 ml-2" />
            <h3 className="card-title">تقرير يومي - {new Date(selectedDate).toLocaleDateString('ar-AE')}</h3>
          </div>
        </div>
        
        {todayDashboard ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card-compact bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:scale-105 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">إجمالي الطلبات</p>
                  <p className="text-2xl font-bold">{todayDashboard?.total_orders}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-lg">
                  <Target className="h-6 w-6" />
                </div>
              </div>
            </div>
            <div className="card-compact bg-gradient-to-br from-green-500 to-green-600 text-white hover:scale-105 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">الطلبات المكتملة</p>
                  <p className="text-2xl font-bold">{todayDashboard?.completed_orders}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-lg">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </div>
            <div className="card-compact bg-gradient-to-br from-yellow-500 to-orange-500 text-white hover:scale-105 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-100 text-sm font-medium">إجمالي الإيرادات</p>
                  <p className="text-2xl font-bold">{todayDashboard?.total_revenue} ج.م</p>
                </div>
                <div className="p-3 bg-white/20 rounded-lg">
                  <DollarSign className="h-6 w-6" />
                </div>
              </div>
            </div>
            <div className="card-compact bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:scale-105 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">الفرق النشطة</p>
                  <p className="text-2xl font-bold">{todayDashboard?.active_teams}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-lg">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">لا توجد بيانات لهذا التاريخ</p>
          </div>
        )}
      </div>

      {/* Team Performance */}
      <div className="card-elevated">
        <div className="card-header">
          <div className="flex items-center">
            <BarChart3 className="h-6 w-6 text-indigo-600 ml-2" />
            <h3 className="card-title">أداء الفرق</h3>
          </div>
        </div>
        {teamSummaries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">الفريق</th>
                  <th className="table-header-cell">الطلبات المكتملة</th>
                  <th className="table-header-cell">الإيرادات</th>
                  <th className="table-header-cell">المصروفات</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {teamSummaries.map((ts: any) => (
                  <tr key={ts.team_id} className="table-row hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-medium">{ts.team_name}</td>
                    <td className="table-cell">{ts.orders_completed}</td>
                    <td className="table-cell text-green-600 font-semibold">{ts.total_revenue} ج.م</td>
                    <td className="table-cell text-red-600 font-semibold">{ts.total_expenses} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">لا توجد بيانات أداء للفرق</div>
        )}
      </div>

      {/* System Health Indicator */}
      {health && (
        <div className="card-compact bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 space-x-reverse">
              <Activity className="h-5 w-5 text-gray-600" />
              <div className={`w-3 h-3 rounded-full ${
                health.database?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm text-gray-600">
                قاعدة البيانات: {health.database?.response_time_ms || 0}ms
              </span>
              <span className="text-sm text-gray-600">
                الكاش: {health.cache?.stats?.size ?? 0} عنصر
              </span>
              <span className="text-sm text-gray-600">
                الذاكرة: {Math.round((health.memory?.used ?? 0) / 1024 / 1024)}MB
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Summary from Daily Data */}
      <div className="card-elevated">
        <div className="card-header">
          <div className="flex items-center">
            <BarChart3 className="h-6 w-6 text-green-600 ml-2" />
            <h3 className="card-title">
              ملخص شهري - {new Date(selectedDate).toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}
            </h3>
          </div>
        </div>
        
        {todayDashboard ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card-compact bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:scale-105 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">إجمالي الطلبات</p>
                    <p className="text-2xl font-bold">{todayDashboard.total_orders || 0}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-lg">
                    <Target className="h-6 w-6" />
                  </div>
                </div>
              </div>
              <div className="card-compact bg-gradient-to-br from-green-500 to-green-600 text-white hover:scale-105 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">إجمالي الإيرادات</p>
                    <p className="text-2xl font-bold">{todayDashboard.total_revenue || 0} ج.م</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-lg">
                    <DollarSign className="h-6 w-6" />
                  </div>
                </div>
              </div>
              <div className="card-compact bg-gradient-to-br from-red-500 to-red-600 text-white hover:scale-105 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-100 text-sm font-medium">إجمالي المصروفات</p>
                    <p className="text-2xl font-bold">{todayDashboard.total_expenses || 0} ج.م</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-lg">
                    <DollarSign className="h-6 w-6" />
                  </div>
                </div>
              </div>
              <div className="card-compact bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:scale-105 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">صافي الربح</p>
                    <p className="text-2xl font-bold">{todayDashboard.net_profit || 0} ج.م</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-lg">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">لا توجد بيانات للتاريخ المحدد</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReportsPage
