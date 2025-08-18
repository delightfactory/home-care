import React from 'react'
import { Search, Filter, X } from 'lucide-react'
import type { SurveysFiltersUI } from './SurveysFilterBar'

interface SurveysSearchInfoProps {
  totalResults: number
  totalCount?: number
  searchTerm: string
  filters: SurveysFiltersUI
  isLoading: boolean
  onClearSearch: () => void
  onClearFilters: () => void
}

const SurveysSearchInfo: React.FC<SurveysSearchInfoProps> = ({
  totalResults,
  totalCount,
  searchTerm,
  filters,
  isLoading,
  onClearSearch,
  onClearFilters
}) => {
  const hasActiveFilters = (
    filters.status.length > 0 ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.customerSearch ||
    filters.rating ||
    filters.recommendation
  )

  const hasSearchOrFilters = searchTerm || hasActiveFilters

  if (!hasSearchOrFilters && !isLoading) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {searchTerm && <Search className="h-4 w-4 text-blue-600" />}
            {hasActiveFilters && <Filter className="h-4 w-4 text-blue-600" />}
            <span className="text-sm font-medium text-blue-900">
              {isLoading ? (
                'جاري البحث...'
              ) : (
                <>
                  {searchTerm && hasActiveFilters ? (
                    `عُثر على ${totalResults} استبيان من أصل ${totalCount || 0} (بحث + فلاتر)`
                  ) : searchTerm ? (
                    `عُثر على ${totalResults} استبيان من أصل ${totalCount || 0} (بحث)`
                  ) : hasActiveFilters ? (
                    `عُثر على ${totalResults} استبيان من أصل ${totalCount || 0} (فلاتر)`
                  ) : (
                    `إجمالي ${totalResults} استبيان`
                  )}
                </>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {searchTerm && (
            <button
              onClick={onClearSearch}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
            >
              <X className="h-3 w-3" />
              مسح البحث
            </button>
          )}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
            >
              <X className="h-3 w-3" />
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* Search and Filter Details */}
      {(searchTerm || hasActiveFilters) && (
        <div className="mt-3 pt-3 border-t border-blue-200">
          <div className="flex flex-wrap gap-2 text-xs">
            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-200 text-blue-800 rounded-full">
                <Search className="h-3 w-3" />
                البحث: "{searchTerm}"
              </span>
            )}
            {filters.status.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-200 text-green-800 rounded-full">
                الحالة: {filters.status.join(', ')}
              </span>
            )}
            {filters.dateFrom && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-200 text-purple-800 rounded-full">
                من: {filters.dateFrom}
              </span>
            )}
            {filters.dateTo && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-200 text-purple-800 rounded-full">
                إلى: {filters.dateTo}
              </span>
            )}
            {filters.rating && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full">
                التقييم: {filters.rating} نجوم
              </span>
            )}
            {filters.recommendation && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-pink-200 text-pink-800 rounded-full">
                التوصية: {filters.recommendation === 'true' ? 'يوصي' : 'لا يوصي'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SurveysSearchInfo