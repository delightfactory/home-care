import React, { useEffect, useState } from 'react'
import { BarChart3, Calendar, Download, TrendingUp, Users, DollarSign, Target } from 'lucide-react'
import { ReportsAPI } from '../../api'
import { MonthlyReport, DailyDashboard, TeamSummary } from '../../types'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import toast from 'react-hot-toast'

const ReportsPage: React.FC = () => {
  const [dailyDashboard, setDailyDashboard] = useState<DailyDashboard | null>(null)
  const [teamSummaries, setTeamSummaries] = useState<TeamSummary[]>([])
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetchReports()
  }, [selectedDate])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const startOfMonth = new Date(new Date(selectedDate).getFullYear(), new Date(selectedDate).getMonth(), 1).toISOString().split('T')[0]
      const endOfMonth = new Date(new Date(selectedDate).getFullYear(), new Date(selectedDate).getMonth() + 1, 0).toISOString().split('T')[0]
      
      const [dashboardData, dailyData, teamData] = await Promise.all([
        ReportsAPI.getDailyDashboard(selectedDate),
        ReportsAPI.getDailyReports(startOfMonth, endOfMonth),
        ReportsAPI.getTeamSummaries()
      ])
      setDailyDashboard(dashboardData)
      setTeamSummaries(teamData)
      // إنشاء تقرير شهرى مبسط اعتمادًا على بيانات اليوم
      const mockMonthlyReport: MonthlyReport = {
        id: 'mock-' + new Date().getTime(),
        month: new Date(selectedDate).getMonth() + 1,
        year: new Date(selectedDate).getFullYear(),
        total_orders: dailyData.reduce((sum, report) => sum + report.total_orders, 0),
        completed_orders: dailyData.reduce((sum, report) => sum + report.completed_orders, 0),
        total_revenue: dailyData.reduce((sum, report) => sum + report.total_revenue, 0),
        total_expenses: dailyData.reduce((sum, report) => sum + report.total_expenses, 0),
        net_profit: dailyData.reduce((sum, report) => sum + report.net_profit, 0),
        avg_orders_per_team: dailyData.length > 0 ? dailyData.reduce((sum, report) => sum + report.total_orders, 0) / dailyData.length : 0,
        avg_rating: dailyData.length > 0 ? dailyData.reduce((sum, report) => sum + report.average_rating, 0) / dailyData.length : 0,
        new_customers: 0, // This would need to be calculated separately
        created_at: new Date().toISOString()
      }
      setMonthlyReports([mockMonthlyReport])
    } catch (error) {
      toast.error('حدث خطأ في تحميل التقارير')
      console.error('Reports fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" text="جاري تحميل التقارير..." />
      </div>
    )
  }

  const todayDashboard = dailyDashboard

  const currentMonth = new Date(selectedDate).getMonth() + 1
  const currentYear = new Date(selectedDate).getFullYear()
  const monthReport = monthlyReports.find(report => 
    report.month === currentMonth && report.year === currentYear
  )

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
                {teamSummaries.map(ts => (
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

      {/* Monthly Report */}
      <div className="card-elevated">
        <div className="card-header">
          <div className="flex items-center">
            <BarChart3 className="h-6 w-6 text-green-600 ml-2" />
            <h3 className="card-title">
              تقرير شهري - {new Date(currentYear, currentMonth - 1).toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}
            </h3>
          </div>
        </div>
        
        {monthReport ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card-compact bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:scale-105 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">إجمالي الطلبات</p>
                    <p className="text-2xl font-bold">{monthReport.total_orders}</p>
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
                    <p className="text-2xl font-bold">{monthReport.total_revenue} ج.م</p>
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
                    <p className="text-2xl font-bold">{monthReport.total_expenses} ج.م</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-lg">
                    <TrendingUp className="h-6 w-6 transform rotate-180" />
                  </div>
                </div>
              </div>
              <div className={`card-compact ${monthReport.net_profit >= 0 ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 'bg-gradient-to-br from-orange-500 to-red-500'} text-white hover:scale-105 transition-all duration-200`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`${monthReport.net_profit >= 0 ? 'text-emerald-100' : 'text-orange-100'} text-sm font-medium`}>صافي الربح</p>
                    <p className="text-2xl font-bold">{monthReport.net_profit} ج.م</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-lg">
                    <TrendingUp className={`h-6 w-6 ${monthReport.net_profit < 0 ? 'transform rotate-180' : ''}`} />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card-compact bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200">
                <h4 className="font-semibold text-indigo-900 mb-3 flex items-center">
                  <Users className="h-5 w-5 ml-2" />
                  أداء الفرق
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-white/50 rounded-lg">
                    <span className="text-indigo-700">متوسط الطلبات لكل فريق:</span>
                    <span className="font-bold text-indigo-900">{Math.round(monthReport.avg_orders_per_team)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/50 rounded-lg">
                    <span className="text-indigo-700">متوسط التقييم:</span>
                    <span className="font-bold text-indigo-900">{monthReport.avg_rating.toFixed(1)}/5</span>
                  </div>
                </div>
              </div>

              <div className="card-compact bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200">
                <h4 className="font-semibold text-purple-900 mb-3 flex items-center">
                  <BarChart3 className="h-5 w-5 ml-2" />
                  إحصائيات إضافية
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-white/50 rounded-lg">
                    <span className="text-purple-700">العملاء الجدد:</span>
                    <span className="font-bold text-purple-900">{monthReport.new_customers}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/50 rounded-lg">
                    <span className="text-purple-700">معدل إكمال الطلبات:</span>
                    <span className="font-bold text-purple-900">
                      {monthReport.total_orders > 0 
                        ? Math.round((monthReport.completed_orders / monthReport.total_orders) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">لا توجد بيانات لهذا الشهر</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReportsPage
