import React, { useEffect, useState } from 'react'
import DateRangePicker from '../UI/DateRangePicker'
import { ExpenseStatus, ExpenseCategory, TeamWithMembers } from '../../types'
import { ExpensesAPI } from '../../api/expenses'
import EnhancedAPI from '../../api/enhanced-api'
import { Filter } from 'lucide-react'

export interface ExpensesFiltersUI {
  status: ExpenseStatus[]
  categoryId: string
  dateFrom: string
  dateTo: string
  teamId: string
  amountMin: string
  amountMax: string
}

interface ExpensesFilterBarProps {
  filters: ExpensesFiltersUI
  onFiltersChange: (changes: Partial<ExpensesFiltersUI>) => void
}

const statusOptions: { value: ExpenseStatus; label: string }[] = [
  { value: ExpenseStatus.PENDING, label: 'معلق' },
  { value: ExpenseStatus.APPROVED, label: 'موافق عليه' },
  { value: ExpenseStatus.REJECTED, label: 'مرفوض' }
]

const ExpensesFilterBar: React.FC<ExpensesFilterBarProps> = ({ filters, onFiltersChange }) => {
  const defaultFilters: ExpensesFiltersUI = { status: [], categoryId: '', dateFrom: '', dateTo: '', teamId: '', amountMin: '', amountMax: '' }

  const resetFilters = () => {
    onFiltersChange(defaultFilters)
  }
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [teams, setTeams] = useState<TeamWithMembers[]>([])
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Keep filter expanded when user is actively filtering
  useEffect(() => {
    const hasActiveFilters = filters.status.length > 0 || 
                           filters.categoryId || 
                           filters.dateFrom || 
                           filters.dateTo || 
                           filters.teamId || 
                           filters.amountMin || 
                           filters.amountMax;
    
    if (hasActiveFilters && !isExpanded) {
      setIsExpanded(true);
    }
  }, [filters, isExpanded]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true)
        const data = await ExpensesAPI.getExpenseCategories()
        setCategories(data)
      } catch (error) {
        console.error('Categories fetch error:', error)
      } finally {
        setLoadingCategories(false)
      }
    }
    fetchCategories()
  }, [])

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setLoadingTeams(true)
        const data = await EnhancedAPI.getTeams()
        setTeams(data)
      } catch (error) {
        console.error('Teams fetch error:', error)
      } finally {
        setLoadingTeams(false)
      }
    }
    fetchTeams()
  }, [])

  const toggleStatus = (value: ExpenseStatus) => {
    const exists = filters.status.includes(value)
    const newStatus = exists ? filters.status.filter(s => s !== value) : [...filters.status, value]
    onFiltersChange({ status: newStatus })
  }

  return (
    <div className="bg-white shadow-md rounded-lg border border-gray-200 overflow-hidden mb-4">
      {/* Collapsible Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="flex items-center space-x-2 space-x-reverse text-gray-700 hover:text-gray-900 transition-colors duration-200"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="w-6 h-6 bg-teal-500 rounded-md flex items-center justify-center">
              <Filter className="w-3 h-3 text-white" />
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
            {(filters.status.length > 0 || filters.categoryId || filters.dateFrom || filters.dateTo || filters.teamId || filters.amountMin || filters.amountMax) && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-teal-100 text-teal-700 rounded-full">
                {[
                  filters.status.length > 0 && filters.status.length,
                  filters.categoryId && 1,
                  (filters.dateFrom || filters.dateTo) && 1,
                  filters.teamId && 1,
                  (filters.amountMin || filters.amountMax) && 1
                ].filter(Boolean).reduce((a, b) => Number(a) + Number(b), 0)} فلتر نشط
              </span>
            )}
            
            <button
              type="button"
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:text-gray-800 transition-all duration-200"
              onClick={resetFilters}
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
                <div className="w-1.5 h-1.5 bg-teal-500 rounded-full"></div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">حالة المصروف</label>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {statusOptions.map(option => {
                  const isSelected = filters.status.includes(option.value)
                  return (
                    <label 
                      key={option.value} 
                      className={`group relative flex items-center p-2 rounded-md border cursor-pointer transition-all duration-150 hover:shadow-sm ${
                        isSelected 
                          ? 'border-teal-400 bg-teal-50' 
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isSelected}
                        onChange={() => toggleStatus(option.value)}
                      />
                      <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all duration-150 ${
                        isSelected 
                          ? 'border-teal-500 bg-teal-500' 
                          : 'border-gray-300 group-hover:border-teal-400'
                      }`}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`mr-2 text-xs font-medium transition-colors duration-150 ${
                        isSelected ? 'text-teal-700' : 'text-gray-700 group-hover:text-gray-900'
                      }`}>
                        {option.label}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5 space-x-reverse">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">الفئة</label>
              </div>
              <div className="relative">
                <select
                  className={`w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-md focus:border-teal-500 focus:ring-1 focus:ring-teal-200 transition-all duration-150 appearance-none ${
                    loadingCategories ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-300'
                  }`}
                  value={filters.categoryId}
                  onChange={e => onFiltersChange({ categoryId: e.target.value })}
                  disabled={loadingCategories}

                >
                  <option value="">كل الفئات</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name_ar || cat.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                  {loadingCategories ? (
                    <div className="w-3 h-3 border border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5 space-x-reverse">
                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
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

            {/* Team Select */}
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5 space-x-reverse">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">الفريق</label>
              </div>
              <div className="relative">
                <select
                  className={`w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-md focus:border-teal-500 focus:ring-1 focus:ring-teal-200 transition-all duration-150 appearance-none ${
                    loadingTeams ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-300'
                  }`}
                  value={filters.teamId}
                  onChange={e => onFiltersChange({ teamId: e.target.value })}
                  disabled={loadingTeams}

                >
                  <option value="">كل الفرق</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                  {loadingTeams ? (
                    <div className="w-3 h-3 border border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* Amount Range */}
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5 space-x-reverse">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">نطاق المبلغ</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <input
                    type="number"
                    placeholder="الحد الأدنى"
                    className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-md focus:border-teal-500 focus:ring-1 focus:ring-teal-200 transition-all duration-150 hover:border-gray-300"
                    value={filters.amountMin}
                    onChange={e => onFiltersChange({ amountMin: e.target.value })}

                  />
                </div>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="الحد الأقصى"
                    className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-md focus:border-teal-500 focus:ring-1 focus:ring-teal-200 transition-all duration-150 hover:border-gray-300"
                    value={filters.amountMax}
                    onChange={e => onFiltersChange({ amountMax: e.target.value })}

                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExpensesFilterBar
