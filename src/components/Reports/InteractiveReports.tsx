import React, { useState, useEffect, useRef } from 'react'
import {
  Download,
  Filter,
  Search,
  SortAsc,
  SortDesc,
  FileText,
  BarChart3,
  PieChart,
  CheckCircle,
  Clock,
  XCircle,
  Eye
} from 'lucide-react'
import { RevenueTrendChart, OrdersStatusChart } from '../Charts/ChartComponents'

interface FilterOptions {
  dateRange: {
    start: string
    end: string
  }
  teams: string[]
  workers: string[]
  orderStatus: string[]
  serviceTypes: string[]
}

interface InteractiveReportsProps {
  data: {
    orders: any[]
    revenue: any[]
    teams: any[]
    workers: any[]
  }
  onFilterChange: (filters: FilterOptions) => void
  onExport: (format: 'pdf' | 'excel' | 'csv') => void
  className?: string
}

export const InteractiveReports: React.FC<InteractiveReportsProps> = ({
  data,
  onFilterChange,
  onExport,
  className = ''
}) => {
  const [activeView, setActiveView] = useState<'summary' | 'detailed' | 'charts'>('summary')
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    },
    teams: [],
    workers: [],
    orderStatus: [],
    serviceTypes: []
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const isInitialMount = useRef(true)

  useEffect(() => {
    // Skip calling onFilterChange on initial mount to prevent automatic notification
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    onFilterChange(filters)
  }, [filters, onFilterChange])

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const getSortedData = (data: any[]) => {
    if (!sortConfig) return data
    
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }

  const getFilteredData = (data: any[]) => {
    return data.filter(item => {
      const matchesSearch = searchTerm === '' || 
        Object.values(item).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      
      const matchesTeam = filters.teams.length === 0 || filters.teams.includes(item.team_id)
      const matchesWorker = filters.workers.length === 0 || filters.workers.includes(item.worker_id)
      const matchesStatus = filters.orderStatus.length === 0 || filters.orderStatus.includes(item.status)
      
      return matchesSearch && matchesTeam && matchesWorker && matchesStatus
    })
  }

  const views = [
    { id: 'summary', label: 'ملخص', icon: BarChart3 },
    { id: 'detailed', label: 'تفصيلي', icon: FileText },
    { id: 'charts', label: 'الرسوم البيانية', icon: PieChart }
  ]

  const exportFormats = [
    { format: 'pdf', label: 'PDF', icon: FileText },
    { format: 'excel', label: 'Excel', icon: FileText },
    { format: 'csv', label: 'CSV', icon: FileText }
  ]

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">التقارير التفاعلية</h2>
            <p className="text-sm text-gray-600 mt-1">تقارير قابلة للتخصيص والتصدير</p>
          </div>
          
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center px-3 py-2 rounded-lg border transition-colors ${
                showFilters 
                  ? 'bg-blue-100 border-blue-300 text-blue-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              فلترة
            </button>
            
            <div className="relative">
              <div className="flex items-center space-x-1 rtl:space-x-reverse">
                {exportFormats.map((format) => (
                  <button
                    key={format.format}
                    onClick={() => onExport(format.format as any)}
                    className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    {format.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* View Tabs */}
        <div className="flex space-x-1 rtl:space-x-reverse">
          {views.map((view) => {
            const Icon = view.icon
            return (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id as any)}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === view.id
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {view.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">نطاق التاريخ</label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, start: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, end: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            {/* Teams Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">الفرق</label>
              <select
                multiple
                value={filters.teams}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  teams: Array.from(e.target.selectedOptions, option => option.value)
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {data.teams?.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
            
            {/* Order Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">حالة الطلب</label>
              <select
                multiple
                value={filters.orderStatus}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  orderStatus: Array.from(e.target.selectedOptions, option => option.value)
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="pending">معلق</option>
                <option value="scheduled">مجدول</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="completed">مكتمل</option>
                <option value="cancelled">ملغي</option>
              </select>
            </div>
            
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">البحث</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="البحث في التقارير..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {/* Summary View */}
        {activeView === 'summary' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">إجمالي الطلبات</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {getFilteredData(data.orders || []).length}
                    </p>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium">الطلبات المكتملة</p>
                    <p className="text-2xl font-bold text-green-900">
                      {getFilteredData(data.orders || []).filter(o => o.status === 'completed').length}
                    </p>
                  </div>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-600 font-medium">الطلبات المعلقة</p>
                    <p className="text-2xl font-bold text-yellow-900">
                      {getFilteredData(data.orders || []).filter(o => o.status === 'pending').length}
                    </p>
                  </div>
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-red-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600 font-medium">الطلبات الملغية</p>
                    <p className="text-2xl font-bold text-red-900">
                      {getFilteredData(data.orders || []).filter(o => o.status === 'cancelled').length}
                    </p>
                  </div>
                  <div className="p-2 bg-red-100 rounded-lg">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Quick Insights */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">رؤى سريعة</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2">معدل الإنجاز</h4>
                  <div className="flex items-center">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                      <div 
                        className="bg-green-500 h-2 rounded-full"
                        style={{ 
                          width: `${(getFilteredData(data.orders || []).filter(o => o.status === 'completed').length / 
                                   Math.max(getFilteredData(data.orders || []).length, 1)) * 100}%` 
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {((getFilteredData(data.orders || []).filter(o => o.status === 'completed').length / 
                         Math.max(getFilteredData(data.orders || []).length, 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2">متوسط وقت التنفيذ</h4>
                  <p className="text-2xl font-bold text-blue-600">
                    {data.orders && data.orders.length > 0 
                      ? `${(data.orders.reduce((acc, order) => {
                          if (order.completed_at && order.created_at) {
                            const duration = new Date(order.completed_at).getTime() - new Date(order.created_at).getTime()
                            return acc + (duration / (1000 * 60 * 60)) // Convert to hours
                          }
                          return acc
                        }, 0) / data.orders.filter(o => o.completed_at && o.created_at).length || 1).toFixed(1)} ساعة`
                      : 'غير متوفر'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed View */}
        {activeView === 'detailed' && (
          <div className="space-y-4">
            {/* Table Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                التقرير التفصيلي ({getFilteredData(data.orders || []).length} عنصر)
              </h3>
            </div>
            
            {/* Data Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('id')}
                    >
                      <div className="flex items-center">
                        رقم الطلب
                        {sortConfig?.key === 'id' && (
                          sortConfig.direction === 'asc' ? 
                            <SortAsc className="h-4 w-4 mr-1" /> : 
                            <SortDesc className="h-4 w-4 mr-1" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('customer_name')}
                    >
                      <div className="flex items-center">
                        العميل
                        {sortConfig?.key === 'customer_name' && (
                          sortConfig.direction === 'asc' ? 
                            <SortAsc className="h-4 w-4 mr-1" /> : 
                            <SortDesc className="h-4 w-4 mr-1" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الخدمة
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center">
                        الحالة
                        {sortConfig?.key === 'status' && (
                          sortConfig.direction === 'asc' ? 
                            <SortAsc className="h-4 w-4 mr-1" /> : 
                            <SortDesc className="h-4 w-4 mr-1" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('total_amount')}
                    >
                      <div className="flex items-center">
                        المبلغ
                        {sortConfig?.key === 'total_amount' && (
                          sortConfig.direction === 'asc' ? 
                            <SortAsc className="h-4 w-4 mr-1" /> : 
                            <SortDesc className="h-4 w-4 mr-1" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      التاريخ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getSortedData(getFilteredData(data.orders || [])).map((order, index) => (
                    <tr key={order.id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{order.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.customer_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.service_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status === 'completed' ? 'مكتمل' :
                           order.status === 'pending' ? 'معلق' :
                           order.status === 'in_progress' ? 'قيد التنفيذ' :
                           order.status === 'cancelled' ? 'ملغي' : order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.total_amount?.toLocaleString()} ج.م
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(order.created_at).toLocaleDateString('ar-AE')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button className="text-blue-600 hover:text-blue-900 mr-3">
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Charts View */}
        {activeView === 'charts' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">اتجاه الإيرادات</h3>
                <RevenueTrendChart data={data.revenue || []} height={300} />
              </div>
              
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">توزيع حالات الطلبات</h3>
                <OrdersStatusChart 
                  data={[
                    { status: 'completed', name: 'مكتمل', value: getFilteredData(data.orders || []).filter(o => o.status === 'completed').length },
                    { status: 'pending', name: 'معلق', value: getFilteredData(data.orders || []).filter(o => o.status === 'pending').length },
                    { status: 'in_progress', name: 'قيد التنفيذ', value: getFilteredData(data.orders || []).filter(o => o.status === 'in_progress').length },
                    { status: 'cancelled', name: 'ملغي', value: getFilteredData(data.orders || []).filter(o => o.status === 'cancelled').length }
                  ]} 
                  height={300} 
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default InteractiveReports