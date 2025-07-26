import React from 'react'
import { Search, Filter, Calendar, Users, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react'
import { OrderStatus } from '../../types'
import { OrdersFiltersUI } from './OrdersFilterBar'

interface SearchResultsInfoProps {
  totalResults: number
  totalCount?: number
  searchTerm: string
  filters: OrdersFiltersUI
  isLoading: boolean
  onClearSearch?: () => void
  onClearFilters?: () => void
}

const statusIcons = {
  [OrderStatus.PENDING]: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  [OrderStatus.SCHEDULED]: { icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-100' },
  [OrderStatus.IN_PROGRESS]: { icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-100' },
  [OrderStatus.COMPLETED]: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
  [OrderStatus.CANCELLED]: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' }
}

const statusLabels = {
  [OrderStatus.PENDING]: 'قيد الانتظار',
  [OrderStatus.SCHEDULED]: 'مجدول',
  [OrderStatus.IN_PROGRESS]: 'جارٍ التنفيذ',
  [OrderStatus.COMPLETED]: 'مكتمل',
  [OrderStatus.CANCELLED]: 'ملغى'
}

const SearchResultsInfo: React.FC<SearchResultsInfoProps> = ({
  totalResults,
  totalCount,
  searchTerm,
  filters,
  isLoading,
  onClearSearch,
  onClearFilters
}) => {
  const hasActiveFilters = filters.status.length > 0 || filters.dateFrom || filters.dateTo || filters.teamId
  const hasSearch = searchTerm.trim().length > 0
  const hasAnyFilter = hasActiveFilters || hasSearch

  if (!hasAnyFilter && totalResults === 0) {
    return null
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 space-x-reverse">
            <div className="w-6 h-6 bg-gray-500 rounded-md flex items-center justify-center">
              <Search className="w-3 h-3 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">نتائج البحث</h3>
          </div>
          
          {hasAnyFilter && (
            <div className="flex items-center space-x-2 space-x-reverse">
              {hasSearch && onClearSearch && (
                <button
                  type="button"
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors duration-150"
                  onClick={onClearSearch}
                >
                  <Search className="w-3 h-3 ml-1" />
                  مسح البحث
                </button>
              )}
              {hasActiveFilters && onClearFilters && (
                <button
                  type="button"
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors duration-150"
                  onClick={onClearFilters}
                >
                  <Filter className="w-3 h-3 ml-1" />
                  مسح الفلاتر
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Results Summary */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3 space-x-reverse">
            {isLoading ? (
              <div className="flex items-center space-x-2 space-x-reverse">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-gray-600">جاري البحث...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 space-x-reverse">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600">{totalResults}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {totalResults === 0 ? 'لا توجد نتائج' : `${totalResults} نتيجة`}
                    {totalCount && totalCount !== totalResults && (
                      <span className="text-gray-500"> من أصل {totalCount}</span>
                    )}
                  </p>
                  {hasAnyFilter && (
                    <p className="text-xs text-gray-500">
                      {hasSearch && hasActiveFilters ? 'بحث مع فلاتر' : hasSearch ? 'نتائج البحث' : 'نتائج الفلترة'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Filters Display */}
        {hasAnyFilter && (
          <div className="space-y-3">
            {/* Search Term */}
            {hasSearch && (
              <div className="flex items-center space-x-2 space-x-reverse">
                <Search className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">البحث:</span>
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  "{searchTerm}"
                </span>
              </div>
            )}

            {/* Status Filters */}
            {filters.status.length > 0 && (
              <div className="flex items-center space-x-2 space-x-reverse">
                <Filter className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">الحالة:</span>
                <div className="flex flex-wrap gap-1">
                  {filters.status.map(status => {
                    const statusConfig = statusIcons[status]
                    const StatusIcon = statusConfig.icon
                    return (
                      <span
                        key={status}
                        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                          statusConfig.bg
                        } ${statusConfig.color}`}
                      >
                        <StatusIcon className="w-3 h-3 ml-1" />
                        {statusLabels[status]}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Date Range */}
            {(filters.dateFrom || filters.dateTo) && (
              <div className="flex items-center space-x-2 space-x-reverse">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">التاريخ:</span>
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                  {filters.dateFrom && filters.dateTo
                    ? `${filters.dateFrom} إلى ${filters.dateTo}`
                    : filters.dateFrom
                    ? `من ${filters.dateFrom}`
                    : `حتى ${filters.dateTo}`}
                </span>
              </div>
            )}

            {/* Team Filter */}
            {filters.teamId && (
              <div className="flex items-center space-x-2 space-x-reverse">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">الفريق:</span>
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                  فريق محدد
                </span>
              </div>
            )}
          </div>
        )}

        {/* No Results Message */}
        {!isLoading && totalResults === 0 && hasAnyFilter && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2 space-x-reverse">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                لم يتم العثور على نتائج تطابق معايير البحث الحالية.
              </p>
            </div>
            <div className="mt-2 flex items-center space-x-2 space-x-reverse">
              <span className="text-xs text-yellow-700">جرب:</span>
              <ul className="text-xs text-yellow-700 list-disc list-inside">
                <li>تغيير كلمات البحث</li>
                <li>إزالة بعض الفلاتر</li>
                <li>التحقق من الإملاء</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchResultsInfo