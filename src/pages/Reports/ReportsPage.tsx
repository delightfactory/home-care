import React, { useEffect, useState } from 'react'
import { BarChart3, Calendar, Download } from 'lucide-react'
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">التقارير والإحصائيات</h1>
          <p className="text-gray-600 mt-1">تقارير الأداء اليومية والشهرية</p>
        </div>
        <div className="flex space-x-3 space-x-reverse">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input"
          />
          <button className="btn-secondary">
            <Download className="h-5 w-5 ml-2" />
            تصدير
          </button>
        </div>
      </div>

      {/* Daily Report */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center">
            <Calendar className="h-6 w-6 text-blue-600 ml-2" />
            <h3 className="card-title">تقرير يومي - {new Date(selectedDate).toLocaleDateString('ar-AE')}</h3>
          </div>
        </div>
        
        {todayDashboard ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">إجمالي الطلبات</p>
              <p className="text-2xl font-bold text-blue-900">{todayDashboard?.total_orders}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600 font-medium">الطلبات المكتملة</p>
              <p className="text-2xl font-bold text-green-900">{todayDashboard?.completed_orders}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-yellow-600 font-medium">إجمالي الإيرادات</p>
              <p className="text-2xl font-bold text-yellow-900">{todayDashboard?.total_revenue} ج.م</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">الفرق النشطة</p>
              <p className="text-2xl font-bold text-purple-900">{todayDashboard?.active_teams}</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">لا توجد بيانات لهذا التاريخ</p>
          </div>
        )}
      </div>

      {/* Team Performance */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center">
            <BarChart3 className="h-6 w-6 text-indigo-600 ml-2" />
            <h3 className="card-title">أداء الفرق</h3>
          </div>
        </div>
        {teamSummaries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-auto w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-left">
                  <th className="p-2">الفريق</th>
                  <th className="p-2">الطلبات المكتملة</th>
                  <th className="p-2">الإيرادات</th>
                  <th className="p-2">المصروفات</th>
                </tr>
              </thead>
              <tbody>
                {teamSummaries.map(ts => (
                  <tr key={ts.team_id} className="border-b">
                    <td className="p-2 font-medium">{ts.team_name}</td>
                    <td className="p-2">{ts.orders_completed}</td>
                    <td className="p-2">{ts.total_revenue} ج.م</td>
                    <td className="p-2">{ts.total_expenses} ج.م</td>
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
      <div className="card">
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
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">إجمالي الطلبات</p>
                <p className="text-2xl font-bold text-blue-900">{monthReport.total_orders}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600 font-medium">إجمالي الإيرادات</p>
                <p className="text-2xl font-bold text-green-900">{monthReport.total_revenue} ج.م</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-red-600 font-medium">إجمالي المصروفات</p>
                <p className="text-2xl font-bold text-red-900">{monthReport.total_expenses} ج.م</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-600 font-medium">صافي الربح</p>
                <p className={`text-2xl font-bold ${monthReport.net_profit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                  {monthReport.net_profit} ج.م
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">أداء الفرق</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">متوسط الطلبات لكل فريق:</span>
                    <span className="font-medium">{monthReport.avg_orders_per_team}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">متوسط التقييم:</span>
                    <span className="font-medium">{monthReport.avg_rating}/5</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">إحصائيات إضافية</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">العملاء الجدد:</span>
                    <span className="font-medium">{monthReport.new_customers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">معدل إكمال الطلبات:</span>
                    <span className="font-medium">
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
