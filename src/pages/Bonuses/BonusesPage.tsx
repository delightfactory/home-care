import React, { useState, useEffect } from 'react'
import { useBonuses } from '../../hooks/useBonuses'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import { formatCurrency } from '../../api'
import { RefreshCw, Award, TrendingUp, Users, Calendar, Star, AlertTriangle, DollarSign } from 'lucide-react'
import { ExportButton } from '../../components/UI'
import { exportToExcel } from '../../utils/exportExcel'
import toast from 'react-hot-toast'
import { useWorkers } from '../../hooks/useEnhancedAPI'

const BonusesPage: React.FC = () => {
  // تصدير البيانات إلى إكسل
  const handleExport = async () => {
    try {
      const arabicData = bonuses.map((b: any) => ({
        'العامل': getWorkerName(b.worker_id),
        'أيام العمل': b.days_worked,
        'إجمالي المساهمة': b.monthly_contribution,
        'الحد الأدنى': b.monthly_min,
        'الصافي': b.net_above_min,
        'الحافز الأساسي': b.base_bonus,
        'التقييم': b.avg_rating ?? '—',
        'عامل التقييم': (b.rating_factor * 100).toFixed(0) + '%',
        'الحافز النهائي': b.final_bonus,
        'طلبات بدون تقييم': b.unrated_orders
      }));
      const fileName = `حوافز_${month}.xlsx`;
      await exportToExcel(arabicData, fileName, 'حوافز');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل تصدير الملف');
    }
  }
  // الشهر الافتراضي: الشهر الحالي
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const [month, setMonth] = useState<string>(firstDay.toISOString().slice(0, 10))

  const { data: bonuses, loading, error, refresh } = useBonuses({ month })
  const { workers } = useWorkers()

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  // دالة للحصول على اسم العامل من المعرف
  const getWorkerName = (workerId: string) => {
    const worker = workers.find((w: any) => w.id === workerId)
    return worker?.name || 'غير معروف'
  }

  // حساب الإحصائيات
  const stats = {
    totalWorkers: bonuses.length,
    totalBonuses: bonuses.reduce((sum, b) => sum + b.final_bonus, 0),
    avgBonus: bonuses.length > 0 ? bonuses.reduce((sum, b) => sum + b.final_bonus, 0) / bonuses.length : 0,
    topPerformer: bonuses.length > 0 ? bonuses.reduce((prev, current) => (prev.final_bonus > current.final_bonus) ? prev : current) : null,
    unratedOrders: bonuses.reduce((sum, b) => sum + b.unrated_orders, 0)
  }

  // تحويل الأرقام العربية إلى إنجليزية
  const toEnglishNumbers = (str: string | number) => {
    return str.toString().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
  }

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // input type="month" يرجع YYYY-MM
    const value = e.target.value
    if (value) {
      setMonth(`${value}-01`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 lg:p-6">
      <div className="max-w-full mx-auto space-y-6 lg:space-y-8">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-xl p-4 lg:p-6 border border-gray-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3 lg:gap-4">
              <div className="p-2 lg:p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Award className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  حوافز العاملين
                </h1>
                <p className="text-gray-600 mt-1 text-sm lg:text-base">إدارة ومتابعة حوافز الفريق الشهرية</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative">
                <div className="flex items-center gap-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-700">اختر الشهر</label>
                    <input
                      type="month"
                      value={month.slice(0, 7)}
                      onChange={handleMonthChange}
                      className="bg-white border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:border-gray-300 min-w-[160px]"
                    />
                  </div>
                </div>
              </div>
              <ExportButton onClick={handleExport} disabled={loading || bonuses.length===0} />
              <button
                onClick={refresh}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 font-medium"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                تحديث
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">إجمالي العاملين</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{toEnglishNumbers(stats.totalWorkers)}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">إجمالي الحوافز</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{toEnglishNumbers(formatCurrency(stats.totalBonuses))}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">متوسط الحافز</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{toEnglishNumbers(formatCurrency(stats.avgBonus))}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">طلبات بدون تقييم</p>
                <p className={`text-2xl font-bold mt-1 ${stats.unratedOrders > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {toEnglishNumbers(stats.unratedOrders)}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${stats.unratedOrders > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                {stats.unratedOrders > 0 ? 
                  <AlertTriangle className="w-6 h-6 text-red-600" /> : 
                  <Star className="w-6 h-6 text-green-600" />
                }
              </div>
            </div>
          </div>
        </div>

        {/* Top Performer Card */}
        {stats.topPerformer && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-lg">
                <Award className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold">أفضل أداء هذا الشهر</h3>
                <p className="text-white/90">
                  {getWorkerName(stats.topPerformer.worker_id)} - حافز: {toEnglishNumbers(formatCurrency(stats.topPerformer.final_bonus))}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-lg p-8 lg:p-12">
            <div className="flex flex-col items-center justify-center">
              <LoadingSpinner />
              <p className="text-gray-500 mt-4">جاري تحميل بيانات الحوافز...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
            <div className="px-4 lg:px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                تفاصيل حوافز العاملين
              </h2>
            </div>
            
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-gradient-to-r from-gray-50 to-blue-50">
                  <tr>
                    <th className="px-3 lg:px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                      العامل
                    </th>
                    <th className="px-3 lg:px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                      أيام العمل
                    </th>
                    <th className="px-3 lg:px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                      إجمالي المساهمة
                    </th>
                    <th className="px-3 lg:px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                      الحد الأدنى
                    </th>
                    <th className="px-3 lg:px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                      الصافي
                    </th>
                    <th className="px-3 lg:px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                      الحافز الأساسي
                    </th>
                    <th className="px-3 lg:px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                      التقييم
                    </th>
                    <th className="px-3 lg:px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                      عامل التقييم
                    </th>
                    <th className="px-3 lg:px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                      الحافز النهائي
                    </th>
                    <th className="px-3 lg:px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                      طلبات بدون تقييم
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {bonuses.map((b, index) => (
                    <tr key={b.worker_id} className={`hover:bg-blue-50/30 transition-all duration-200 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                    }`}>
                      <td className="px-3 lg:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 lg:h-10 lg:w-10">
                            <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center shadow-md">
                              <span className="text-xs lg:text-sm font-medium text-white">
                                {getWorkerName(b.worker_id).charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div className="mr-3 lg:mr-4 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {getWorkerName(b.worker_id)}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {b.worker_id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {toEnglishNumbers(b.days_worked)} يوم
                        </span>
                      </td>
                      <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                        {toEnglishNumbers(formatCurrency(b.monthly_contribution))}
                      </td>
                      <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                        {toEnglishNumbers(formatCurrency(b.monthly_min))}
                      </td>
                      <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                        {toEnglishNumbers(formatCurrency(b.net_above_min))}
                      </td>
                      <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                        {toEnglishNumbers(formatCurrency(b.base_bonus))}
                      </td>
                      <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-center">
                        {b.avg_rating ? (
                          <div className="flex items-center justify-center">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="mr-1 text-sm font-semibold text-gray-900">
                              {toEnglishNumbers(b.avg_rating.toFixed(1))}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 font-medium">—</span>
                        )}
                      </td>
                      <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                          b.rating_factor >= 0.8 ? 'bg-green-100 text-green-800' :
                          b.rating_factor >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {toEnglishNumbers((b.rating_factor * 100).toFixed(0))}%
                        </span>
                      </td>
                      <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-center">
                        <div className="bg-green-50 rounded-lg px-3 py-2 inline-block">
                          <span className="text-lg font-bold text-green-700">
                            {toEnglishNumbers(formatCurrency(b.final_bonus))}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-center">
                        {b.unrated_orders > 0 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            <AlertTriangle className="w-3 h-3 ml-1" />
                            {toEnglishNumbers(b.unrated_orders)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            <Star className="w-3 h-3 ml-1" />
                            {toEnglishNumbers(0)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {bonuses.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <Users className="w-12 h-12 text-gray-300 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد بيانات</h3>
                          <p className="text-gray-500">لم يتم العثور على بيانات حوافز للشهر المحدد</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BonusesPage
