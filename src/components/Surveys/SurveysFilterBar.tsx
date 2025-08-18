import React, { useState } from 'react'
import DateRangePicker from '../UI/DateRangePicker'
import { Search } from 'lucide-react'

export interface SurveysFiltersUI {
  status: ('all' | 'completed' | 'pending')[]
  dateFrom: string
  dateTo: string
  customerSearch: string
  rating: string
  recommendation: string
}

interface SurveysFilterBarProps {
  filters: SurveysFiltersUI
  onFiltersChange: (changes: Partial<SurveysFiltersUI>) => void
}

const statusOptions = [
  { value: 'completed', label: 'مكتمل' },
  { value: 'pending', label: 'غير مكتمل' }
]

const ratingOptions = [
  { value: '', label: 'جميع التقييمات' },
  { value: '5', label: '5 نجوم' },
  { value: '4', label: '4 نجوم' },
  { value: '3', label: '3 نجوم' },
  { value: '2', label: 'نجمتان' },
  { value: '1', label: 'نجمة واحدة' }
]

const recommendationOptions = [
  { value: '', label: 'جميع التوصيات' },
  { value: 'true', label: 'يوصي' },
  { value: 'false', label: 'لا يوصي' }
]

const SurveysFilterBar: React.FC<SurveysFilterBarProps> = ({ filters, onFiltersChange }) => {
  const defaultFilters: SurveysFiltersUI = { status: [], dateFrom: '', dateTo: '', customerSearch: '', rating: '', recommendation: '' }
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleStatus = (value: 'completed' | 'pending') => {
    const exists = filters.status.includes(value)
    const newStatus = exists ? filters.status.filter(s => s !== value) : [...filters.status, value]
    onFiltersChange({ status: newStatus })
  }

  return (
    <div className="bg-white shadow-md rounded-lg border border-gray-200 overflow-hidden mb-4">
      {/* Collapsible Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="flex items-center space-x-2 space-x-reverse text-gray-700 hover:text-gray-900 transition-colors duration-200"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold">فلاتر البحث</h3>
            <svg 
              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <div className="flex items-center space-x-2 space-x-reverse">
            {/* Active Filters Count */}
            {(filters.status.length > 0 || filters.dateFrom || filters.dateTo || filters.customerSearch || filters.rating || filters.recommendation) && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                {[
                  filters.status.length > 0 && filters.status.length,
                  (filters.dateFrom || filters.dateTo) && 1,
                  filters.customerSearch && 1,
                  filters.rating && 1,
                  filters.recommendation && 1
                ].filter(Boolean).reduce((a, b) => Number(a) + Number(b), 0)} فلتر نشط
              </span>
            )}
            
            <button
              type="button"
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:text-gray-800 transition-all duration-200"
              onClick={() => onFiltersChange(defaultFilters)}
            >
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              إعادة تعيين
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Filter Content */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
        isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Status Filters */}
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5 space-x-reverse">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">حالة الاستبيان</label>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {statusOptions.map(opt => {
                  const isSelected = filters.status.includes(opt.value as any)
                  return (
                    <label 
                      key={opt.value} 
                      className={`group relative flex items-center p-2 rounded-md border cursor-pointer transition-all duration-150 hover:shadow-sm ${
                        isSelected 
                          ? 'border-blue-400 bg-blue-50' 
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isSelected}
                        onChange={() => toggleStatus(opt.value as any)}
                      />
                      <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all duration-150 ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300 group-hover:border-blue-400'
                      }`}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`mr-2 text-xs font-medium transition-colors duration-150 ${
                        isSelected ? 'text-blue-700' : 'text-gray-700 group-hover:text-gray-900'
                      }`}>
                        {opt.label}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Customer Search */}
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5 space-x-reverse">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">البحث في العملاء</label>
              </div>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="اسم العميل أو رقم الهاتف"
                  value={filters.customerSearch}
                  onChange={(e) => onFiltersChange({ customerSearch: e.target.value })}
                  className="w-full pr-10 pl-3 py-2 text-xs bg-white border border-gray-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all duration-150 hover:border-gray-300"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5 space-x-reverse">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">الفترة الزمنية</label>
              </div>
              <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                <DateRangePicker
                  startDate={filters.dateFrom}
                  endDate={filters.dateTo}
                  onStartDateChange={date => onFiltersChange({ dateFrom: date })}
                  onEndDateChange={date => onFiltersChange({ dateTo: date })}
                />
              </div>
            </div>

            {/* Rating Filter */}
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5 space-x-reverse">
                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">التقييم</label>
              </div>
              <div className="relative">
                <select
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all duration-150 appearance-none hover:border-gray-300"
                  value={filters.rating}
                  onChange={e => onFiltersChange({ rating: e.target.value })}
                >
                  {ratingOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Recommendation Filter */}
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5 space-x-reverse">
                <div className="w-1.5 h-1.5 bg-pink-500 rounded-full"></div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">التوصية</label>
              </div>
              <div className="relative">
                <select
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all duration-150 appearance-none hover:border-gray-300"
                  value={filters.recommendation}
                  onChange={e => onFiltersChange({ recommendation: e.target.value })}
                >
                  {recommendationOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SurveysFilterBar