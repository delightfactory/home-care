import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { SurveysAPI } from '../../api'
import type { SurveyWithOrder, Customer } from '../../types'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import SurveyDetailsModal from '../../components/Modals/SurveyDetailsModal'
import SurveysFilterBar, { SurveysFiltersUI } from '../../components/Surveys/SurveysFilterBar'
import SurveysSearchInfo from '../../components/Surveys/SurveysSearchInfo'
import { ExportButton } from '../../components/UI'
import { exportToExcel } from '../../utils/exportExcel'
import { Search, Star, ThumbsUp, ThumbsDown, Calendar, User, Phone, MessageSquare, TrendingUp, CheckCircle, Clock, BarChart3 } from 'lucide-react'

const PAGE_SIZE = 20

type StatusFilter = 'all' | 'completed' | 'pending'

const SurveysPage: React.FC = () => {
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [surveys, setSurveys] = useState<SurveyWithOrder[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  
  // Filter state
  const [filtersUI, setFiltersUI] = useState<SurveysFiltersUI>({
    status: [],
    dateFrom: '',
    dateTo: '',
    customerSearch: '',
    rating: '',
    recommendation: ''
  })

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  // Apply filters to surveys data
  const filteredSurveys = useMemo(() => {
    let filtered = surveys
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(survey => {
        const orderNo = (survey as any).order?.order_number?.toLowerCase() || ''
        const customerName = (survey as any).order?.customer?.name?.toLowerCase() || ''
        const customerPhone = (survey as any).order?.customer?.phone?.toLowerCase() || ''
        const feedback = survey.customer_feedback?.toLowerCase() || ''
        
        return orderNo.includes(searchLower) ||
               customerName.includes(searchLower) ||
               customerPhone.includes(searchLower) ||
               feedback.includes(searchLower)
      })
    }
    
    // Apply rating filter
    if (filtersUI.rating) {
      const targetRating = parseInt(filtersUI.rating)
      filtered = filtered.filter(survey => survey.overall_rating === targetRating)
    }
    
    // Apply recommendation filter
    if (filtersUI.recommendation) {
      const recommendValue = filtersUI.recommendation === 'true'
      filtered = filtered.filter(survey => survey.would_recommend === recommendValue)
    }
    
    // Apply customer search filter
    if (filtersUI.customerSearch) {
      const customerSearchLower = filtersUI.customerSearch.toLowerCase()
      filtered = filtered.filter(survey => {
        const customerName = (survey as any).order?.customer?.name?.toLowerCase() || ''
        const customerPhone = (survey as any).order?.customer?.phone?.toLowerCase() || ''
        return customerName.includes(customerSearchLower) || customerPhone.includes(customerSearchLower)
      })
    }
    
    // Apply date filters
    if (filtersUI.dateFrom) {
      filtered = filtered.filter(survey => {
        const surveyDate = new Date(survey.created_at as string)
        const fromDate = new Date(filtersUI.dateFrom)
        return surveyDate >= fromDate
      })
    }
    
    if (filtersUI.dateTo) {
      filtered = filtered.filter(survey => {
        const surveyDate = new Date(survey.created_at as string)
        const toDate = new Date(filtersUI.dateTo)
        return surveyDate <= toDate
      })
    }
    
    return filtered
  }, [surveys, searchTerm, filtersUI])
  
  // Calculate statistics
  const statistics = useMemo(() => {
    const completed = surveys.filter(s => s.submitted_at).length
    const pending = surveys.filter(s => !s.submitted_at).length
    const avgRating = surveys.filter(s => s.overall_rating).reduce((sum, s) => sum + (s.overall_rating as number), 0) / surveys.filter(s => s.overall_rating).length || 0
    const recommendCount = surveys.filter(s => s.would_recommend === true).length
    const recommendPercentage = surveys.length > 0 ? (recommendCount / surveys.length) * 100 : 0
    
    return {
      total: surveys.length,
      completed,
      pending,
      avgRating: Math.round(avgRating * 10) / 10,
      recommendPercentage: Math.round(recommendPercentage)
    }
  }, [surveys])

  const fetchData = async () => {
    try {
      setLoading(true)
      // Determine status filter based on filtersUI
      let apiStatus: StatusFilter = 'all'
      if (filtersUI.status.length === 1) {
        apiStatus = filtersUI.status[0] as StatusFilter
      } else if (filtersUI.status.length === 0) {
        apiStatus = 'all'
      }
      
      const res = await SurveysAPI.getSurveys(apiStatus, page, PAGE_SIZE)
      setSurveys(res.data || [])
      setTotal(res.total || 0)
    } catch (error: any) {
      toast.error(error?.message || 'تعذر جلب بيانات الاستبيانات')
    } finally {
      setLoading(false)
    }
  }

  // Export to Excel function
  const handleExport = async () => {
    try {
      setIsExporting(true)
      
      // Use filtered surveys for export
      const dataToExport = filteredSurveys.map(survey => ({
        'رقم الطلب': (survey as any).order?.order_number || '',
        'اسم العميل': (survey as any).order?.customer?.name || '',
        'رقم الهاتف': (survey as any).order?.customer?.phone || '',
        'تاريخ الاستبيان': survey.created_at ? new Date(survey.created_at as string).toLocaleDateString('en-US') : '',
        'الحالة': survey.submitted_at ? 'مكتمل' : 'غير مكتمل',
        'التقييم العام': survey.overall_rating || '',
        'التوصية': survey.would_recommend === true ? 'نعم' : survey.would_recommend === false ? 'لا' : '',
        'التعليقات': survey.customer_feedback || '',
        'تاريخ الإرسال': survey.submitted_at ? new Date(survey.submitted_at as string).toLocaleDateString('en-US') : ''
      }))
      
      if (dataToExport.length === 0) {
        toast.error('لا توجد بيانات للتصدير')
        return
      }
      
      const fileName = `الاستبيانات_${new Date().toISOString().slice(0,10)}.xlsx`
      await exportToExcel(dataToExport, fileName, 'الاستبيانات')
      toast.success('تم تصدير البيانات بنجاح')
    } catch (error: any) {
      toast.error(error?.message || 'تعذر تصدير البيانات')
    } finally {
      setIsExporting(false)
    }
  }
  
  // Handle filter changes
  const handleFiltersChange = (changes: Partial<SurveysFiltersUI>) => {
    setFiltersUI(prev => ({ ...prev, ...changes }))
    setPage(1) // Reset to first page when filters change
  }
  
  // Clear all filters
  const clearFilters = () => {
    setFiltersUI({
      status: [],
      dateFrom: '',
      dateTo: '',
      customerSearch: '',
      rating: '',
      recommendation: ''
    })
    setSearchTerm('')
    setPage(1)
  }
  
  // Clear search
  const clearSearch = () => {
    setSearchTerm('')
    setPage(1)
  }
  
  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return filtersUI.status.length > 0 ||
           filtersUI.dateFrom !== '' ||
           filtersUI.dateTo !== '' ||
           filtersUI.customerSearch !== '' ||
           filtersUI.rating !== '' ||
           filtersUI.recommendation !== '' ||
           searchTerm !== ''
  }, [filtersUI, searchTerm])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersUI.status, page])

  const onPrev = () => setPage(p => Math.max(1, p - 1))
  const onNext = () => setPage(p => Math.min(totalPages, p + 1))

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-600" />
          إدارة الاستبيانات
        </h1>
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">إجمالي الاستبيانات</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">مكتملة</p>
                <p className="text-2xl font-bold text-green-600">{statistics.completed}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">في الانتظار</p>
                <p className="text-2xl font-bold text-orange-600">{statistics.pending}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">متوسط التقييم</p>
                <p className="text-2xl font-bold text-yellow-600">{statistics.avgRating || 0}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">نسبة التوصية</p>
                <p className="text-2xl font-bold text-purple-600">{statistics.recommendPercentage}%</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="البحث في الاستبيانات (رقم الطلب، اسم العميل، رقم الهاتف، التعليقات...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        {/* Filters */}
        <SurveysFilterBar
          filters={filtersUI}
          onFiltersChange={handleFiltersChange}
        />
        
        {/* Search Info */}
        {(hasActiveFilters || searchTerm) && (
          <SurveysSearchInfo
            totalResults={filteredSurveys.length}
            totalCount={total}
            searchTerm={searchTerm}
            filters={filtersUI}
            isLoading={loading}
            onClearSearch={clearSearch}
            onClearFilters={clearFilters}
          />
        )}
        
        {/* Export Button */}
        <div className="flex justify-end mb-4">
          <ExportButton
            onClick={handleExport}
            disabled={filteredSurveys.length === 0 || isExporting}
            title={isExporting ? 'جاري التصدير...' : 'تصدير Excel'}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Table Header with Enhanced Design */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-white">جدول الاستبيانات</h2>
            </div>
            <div className="text-sm text-blue-100">
              {filteredSurveys.length} من {total} استبيان
            </div>
          </div>
        </div>

        {/* Enhanced Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
                <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider w-[12%]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>التاريخ</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider w-[10%]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>رقم الطلب</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider w-[15%]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <User className="w-4 h-4 text-purple-600" />
                    <span>بيانات العميل</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider w-[10%]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span>الحالة</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider w-[12%]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <Star className="w-4 h-4 text-yellow-600" />
                    <span>التقييم</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider w-[10%]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                    <span>التوصية</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider w-[21%]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                    <span>تعليق العميل</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider w-[10%]">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>إجراءات</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <LoadingSpinner />
                      <div className="text-gray-600">
                        <p className="font-medium">جاري تحميل البيانات...</p>
                        <p className="text-sm text-gray-500 mt-1">يرجى الانتظار</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredSurveys.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <MessageSquare className="w-8 h-8 text-gray-400" />
                      </div>
                      <div className="text-gray-600">
                        <p className="font-medium text-lg">لا توجد استبيانات</p>
                        <p className="text-sm text-gray-500 mt-1">لم يتم العثور على أي استبيانات تطابق المعايير المحددة</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSurveys.map((s, index) => (
                  <SurveyRow key={s.id} survey={s} index={index} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Enhanced Pagination */}
        <div className="bg-gradient-to-r from-white via-blue-50 to-white rounded-xl shadow-lg border border-gray-100 p-6 mt-6">
          <div className="flex items-center justify-between">
            {/* Statistics */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700">الصفحة</span>
                <span className="text-sm font-bold text-blue-600">{page}</span>
                <span className="text-sm text-gray-500">من</span>
                <span className="text-sm font-bold text-blue-600">{totalPages}</span>
              </div>
              <div className="w-px h-6 bg-gray-300"></div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700">إجمالي:</span>
                <span className="text-sm font-bold text-green-600">{total}</span>
              </div>
              <div className="w-px h-6 bg-gray-300"></div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700">معروض:</span>
                <span className="text-sm font-bold text-purple-600">{filteredSurveys.length}</span>
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={onPrev}
                disabled={page <= 1 || loading}
                className="group flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>السابق</span>
              </button>
              
              <div className="flex items-center gap-1">
                <div className="px-4 py-2.5 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold shadow-md">
                  {page}
                </div>
              </div>
              
              <button
                onClick={onNext}
                disabled={page >= totalPages || loading}
                className="group flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <span>التالي</span>
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const SurveyRow: React.FC<{ survey: SurveyWithOrder; index: number }> = ({ survey, index }) => {
  const [open, setOpen] = useState(false)

  const orderNo = (survey as any).order?.order_number as string | undefined
  const customer = (survey as any).order?.customer as Customer | undefined
  const name = customer?.name || '-'
  const phone = customer?.phone || (customer as any)?.extra_phone || '-'

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-3.5 h-3.5 ${
          i < rating ? 'text-yellow-500 fill-current drop-shadow-sm' : 'text-gray-300'
        }`}
      />
    ))
  }

  const isEven = index % 2 === 0

  return (
    <tr className={`group transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-sm ${
      isEven ? 'bg-white' : 'bg-gray-50/30'
    }`}>
      {/* Date Column */}
      <td className="px-4 py-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">
              {new Date(survey.created_at as any).toLocaleDateString('en-US')}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(survey.created_at as any).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </td>

      {/* Order Number Column */}
      <td className="px-4 py-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-8 bg-green-500 rounded-full"></div>
          <span className="font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md">
            {orderNo || '-'}
          </span>
        </div>
      </td>

      {/* Customer Info Column */}
      <td className="px-4 py-4 text-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
              <User className="w-3 h-3 text-purple-600" />
            </div>
            <span className="font-medium text-gray-900 truncate max-w-[120px]" title={name}>
              {name}
            </span>
          </div>
          <div className="flex items-center gap-2 mr-8">
            <Phone className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-600 font-mono" dir="ltr">
              {phone}
            </span>
          </div>
        </div>
      </td>

      {/* Status Column */}
      <td className="px-4 py-4 text-sm">
        <div className="flex items-center justify-center">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold shadow-sm border ${
            survey.submitted_at
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border-green-200'
              : 'bg-gradient-to-r from-orange-50 to-yellow-50 text-orange-800 border-orange-200'
          }`}>
            {survey.submitted_at ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                <span>مكتمل</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5" />
                <span>معلق</span>
              </>
            )}
          </span>
        </div>
      </td>

      {/* Rating Column */}
      <td className="px-4 py-4 text-sm">
        {typeof survey.overall_rating === 'number' ? (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-0.5">
              {renderStars(survey.overall_rating as number)}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-yellow-600">{survey.overall_rating}</span>
              <span className="text-xs text-gray-500">/5</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <span className="text-gray-400 font-medium">-</span>
          </div>
        )}
      </td>

      {/* Recommendation Column */}
      <td className="px-4 py-4 text-sm">
        <div className="flex items-center justify-center">
          {survey.would_recommend === true ? (
            <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-full border border-green-200">
              <ThumbsUp className="w-4 h-4" />
              <span className="font-bold text-xs">نعم</span>
            </div>
          ) : survey.would_recommend === false ? (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-2 rounded-full border border-red-200">
              <ThumbsDown className="w-4 h-4" />
              <span className="font-bold text-xs">لا</span>
            </div>
          ) : (
            <span className="text-gray-400 font-medium">-</span>
          )}
        </div>
      </td>

      {/* Feedback Column */}
      <td className="px-4 py-4 text-sm">
        {survey.customer_feedback ? (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 max-w-[280px]">
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-700 leading-relaxed" style={{display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'}} title={survey.customer_feedback}>
                  {survey.customer_feedback}
                </p>
                {survey.customer_feedback.length > 100 && (
                  <button 
                    onClick={() => setOpen(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1 transition-colors"
                  >
                    اقرأ المزيد...
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <span className="text-gray-400 font-medium">لا يوجد تعليق</span>
          </div>
        )}
      </td>

      {/* Actions Column */}
      <td className="px-4 py-4 text-sm">
        <div className="flex items-center justify-center">
          <button
            onClick={() => setOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
          >
            <MessageSquare className="w-4 h-4" />
            <span>التفاصيل</span>
          </button>
        </div>
        <SurveyDetailsModal
          isOpen={open}
          onClose={() => setOpen(false)}
          survey={survey}
        />
      </td>
    </tr>
  )
}

export default SurveysPage
