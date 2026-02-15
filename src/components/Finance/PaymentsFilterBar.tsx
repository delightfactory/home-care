import React, { useEffect, useState } from 'react'
import DateRangePicker from '../UI/DateRangePicker'
import EnhancedAPI from '../../api/enhanced-api'
import { TeamWithMembers } from '../../types'

export interface PaymentsFiltersUI {
    status: string[]
    paymentMethod: string[]
    dateFrom: string
    dateTo: string
    teamId: string
    search: string
}

interface PaymentsFilterBarProps {
    filters: PaymentsFiltersUI
    onFiltersChange: (changes: Partial<PaymentsFiltersUI>) => void
}

const statusOptions: { value: string; label: string }[] = [
    { value: 'pending', label: 'معلّقة' },
    { value: 'partially_paid', label: 'مدفوعة جزئياً' },
    { value: 'paid', label: 'مدفوعة' },
    { value: 'cancelled', label: 'ملغاة' },
]

const paymentMethodOptions: { value: string; label: string }[] = [
    { value: 'instapay', label: 'Instapay' },
    { value: 'bank_transfer', label: 'تحويل بنكي' },
]

const PaymentsFilterBar: React.FC<PaymentsFilterBarProps> = ({ filters, onFiltersChange }) => {
    const defaultFilters: PaymentsFiltersUI = { status: ['pending', 'partially_paid'], paymentMethod: [], dateFrom: '', dateTo: '', teamId: '', search: '' }
    const [teams, setTeams] = useState<TeamWithMembers[]>([])
    const [loadingTeams, setLoadingTeams] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)

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

    const toggleStatus = (value: string) => {
        const exists = filters.status.includes(value)
        const newStatus = exists ? filters.status.filter(s => s !== value) : [...filters.status, value]
        onFiltersChange({ status: newStatus })
    }

    const togglePaymentMethod = (value: string) => {
        const exists = filters.paymentMethod.includes(value)
        const newMethods = exists ? filters.paymentMethod.filter(m => m !== value) : [...filters.paymentMethod, value]
        onFiltersChange({ paymentMethod: newMethods })
    }

    const activeFilterCount = [
        filters.status.length > 0 ? filters.status.length : 0,
        filters.paymentMethod.length > 0 ? filters.paymentMethod.length : 0,
        (filters.dateFrom || filters.dateTo) ? 1 : 0,
        filters.teamId ? 1 : 0,
        filters.search ? 1 : 0,
    ].reduce((a: number, b: number) => a + b, 0)

    return (
        <div className="bg-white shadow-md rounded-lg border border-gray-200 overflow-hidden mb-4">
            {/* Collapsible Header */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        className="flex items-center space-x-2 space-x-reverse text-gray-700 hover:text-gray-900 transition-colors duration-200"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        <div className="w-6 h-6 bg-purple-500 rounded-md flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                            </svg>
                        </div>
                        <h3 className="text-base font-semibold">فلاتر المدفوعات</h3>
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
                        {activeFilterCount > 0 && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                                {activeFilterCount} فلتر نشط
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
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                }`}>
                <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {/* Status Filters */}
                        <div className="space-y-2">
                            <div className="flex items-center space-x-1.5 space-x-reverse">
                                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">حالة الدفع</label>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5">
                                {statusOptions.map(opt => {
                                    const isSelected = filters.status.includes(opt.value)
                                    return (
                                        <label
                                            key={opt.value}
                                            className={`group relative flex items-center p-2 rounded-md border cursor-pointer transition-all duration-150 hover:shadow-sm ${isSelected
                                                ? 'border-purple-400 bg-purple-50'
                                                : 'border-gray-200 bg-white hover:border-gray-300'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                className="sr-only"
                                                checked={isSelected}
                                                onChange={() => toggleStatus(opt.value)}
                                            />
                                            <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all duration-150 ${isSelected
                                                ? 'border-purple-500 bg-purple-500'
                                                : 'border-gray-300 group-hover:border-purple-400'
                                                }`}>
                                                {isSelected && (
                                                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span className={`mr-2 text-xs font-medium transition-colors duration-150 ${isSelected ? 'text-purple-700' : 'text-gray-700 group-hover:text-gray-900'
                                                }`}>
                                                {opt.label}
                                            </span>
                                        </label>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Payment Method + Team */}
                        <div className="space-y-4">
                            {/* Payment Method */}
                            <div className="space-y-2">
                                <div className="flex items-center space-x-1.5 space-x-reverse">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">طريقة الدفع</label>
                                </div>
                                <div className="grid grid-cols-1 gap-1.5">
                                    {paymentMethodOptions.map(opt => {
                                        const isSelected = filters.paymentMethod.includes(opt.value)
                                        return (
                                            <label
                                                key={opt.value}
                                                className={`group relative flex items-center p-2 rounded-md border cursor-pointer transition-all duration-150 hover:shadow-sm ${isSelected
                                                    ? 'border-blue-400 bg-blue-50'
                                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={isSelected}
                                                    onChange={() => togglePaymentMethod(opt.value)}
                                                />
                                                <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all duration-150 ${isSelected
                                                    ? 'border-blue-500 bg-blue-500'
                                                    : 'border-gray-300 group-hover:border-blue-400'
                                                    }`}>
                                                    {isSelected && (
                                                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <span className={`mr-2 text-xs font-medium transition-colors duration-150 ${isSelected ? 'text-blue-700' : 'text-gray-700 group-hover:text-gray-900'
                                                    }`}>
                                                    {opt.label}
                                                </span>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Team Select */}
                            <div className="space-y-2">
                                <div className="flex items-center space-x-1.5 space-x-reverse">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">الفريق</label>
                                </div>
                                <div className="relative">
                                    <select
                                        className={`w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-md focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all duration-150 appearance-none ${loadingTeams ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-300'
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
                                            <div className="w-3 h-3 border border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Search */}
                            <div className="space-y-2">
                                <div className="flex items-center space-x-1.5 space-x-reverse">
                                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
                                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">بحث</label>
                                </div>
                                <div className="relative">
                                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="رقم فاتورة أو اسم عميل..."
                                        value={filters.search}
                                        onChange={e => onFiltersChange({ search: e.target.value })}
                                        className="w-full pr-9 pl-3 py-2 text-xs bg-white border border-gray-200 rounded-md focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all duration-150 hover:border-gray-300"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Date Range */}
                        <div className="space-y-2">
                            <div className="flex items-center space-x-1.5 space-x-reverse">
                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
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
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PaymentsFilterBar
