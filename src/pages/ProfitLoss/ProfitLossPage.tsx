import React, { useState, useEffect, useCallback } from 'react'
import {
    TrendingUp, TrendingDown, DollarSign,
    Loader2, RefreshCw, BarChart3, Banknote,
} from 'lucide-react'
import { ProfitLossAPI } from '../../api/profit-loss'
import type { ProfitLossReport } from '../../types/hr.types'
import toast from 'react-hot-toast'

const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

const ProfitLossPage: React.FC = () => {
    const now = new Date()
    const [dateFrom, setDateFrom] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
    const [dateTo, setDateTo] = useState(now.toISOString().split('T')[0])
    const [report, setReport] = useState<ProfitLossReport | null>(null)
    const [loading, setLoading] = useState(false)

    // Preset periods
    const setPreset = (preset: 'month' | 'quarter' | 'year') => {
        const today = new Date()
        let from: Date

        switch (preset) {
            case 'month':
                from = new Date(today.getFullYear(), today.getMonth(), 1)
                break
            case 'quarter':
                const q = Math.floor(today.getMonth() / 3) * 3
                from = new Date(today.getFullYear(), q, 1)
                break
            case 'year':
                from = new Date(today.getFullYear(), 0, 1)
                break
        }

        setDateFrom(from.toISOString().split('T')[0])
        setDateTo(today.toISOString().split('T')[0])
    }

    const loadReport = useCallback(async () => {
        if (!dateFrom || !dateTo) return
        setLoading(true)
        try {
            const data = await ProfitLossAPI.getReport(dateFrom, dateTo)
            setReport(data)
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ في تحميل التقرير')
        } finally {
            setLoading(false)
        }
    }, [dateFrom, dateTo])

    useEffect(() => {
        loadReport()
    }, [loadReport])

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

    const profitMargin = report && report.total_revenue > 0
        ? ((report.net_profit / report.total_revenue) * 100).toFixed(1)
        : '0'

    // تجميع المصروفات حسب الفئة
    const expenseByCategory = report?.expense_details?.reduce((acc, exp) => {
        const cat = exp.category || 'بدون تصنيف'
        if (!acc[cat]) acc[cat] = 0
        acc[cat] += exp.amount
        return acc
    }, {} as Record<string, number>) || {}

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900">تقرير الأرباح والخسائر</h1>
                    <p className="text-sm text-gray-500 mt-1">نظرة شاملة على الإيرادات والمصروفات والرواتب والسلف</p>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                    <div className="flex gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">من</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">إلى</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {(['month', 'quarter', 'year'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPreset(p)}
                                className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                                {p === 'month' ? 'هذا الشهر' : p === 'quarter' ? 'هذا الربع' : 'هذه السنة'}
                            </button>
                        ))}
                        <button
                            onClick={loadReport}
                            disabled={loading}
                            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                </div>
            ) : report ? (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <TrendingUp className="w-4 h-4 text-blue-600" />
                                </div>
                                <span className="text-xs text-gray-500">الإيرادات</span>
                            </div>
                            <p className="text-lg sm:text-xl font-bold text-blue-600">{formatCurrency(report.total_revenue)}</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                                    <TrendingDown className="w-4 h-4 text-red-600" />
                                </div>
                                <span className="text-xs text-gray-500">المصروفات</span>
                            </div>
                            <p className="text-lg sm:text-xl font-bold text-red-600">{formatCurrency(report.total_expenses)}</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                                    <DollarSign className="w-4 h-4 text-amber-600" />
                                </div>
                                <span className="text-xs text-gray-500">الرواتب</span>
                            </div>
                            <p className="text-lg sm:text-xl font-bold text-amber-600">{formatCurrency(report.total_payroll)}</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <Banknote className="w-4 h-4 text-purple-600" />
                                </div>
                                <span className="text-xs text-gray-500">السلف</span>
                            </div>
                            <p className="text-lg sm:text-xl font-bold text-purple-600">{formatCurrency(report.total_advances)}</p>
                        </div>
                        <div className={`col-span-2 sm:col-span-1 rounded-xl shadow-sm border p-4 ${report.net_profit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                            }`}>
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${report.net_profit >= 0 ? 'bg-emerald-100' : 'bg-red-100'
                                    }`}>
                                    <BarChart3 className={`w-4 h-4 ${report.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                                </div>
                                <span className="text-xs text-gray-500">صافي الربح</span>
                            </div>
                            <p className={`text-lg sm:text-xl font-bold ${report.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'
                                }`}>
                                {formatCurrency(report.net_profit)}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                هامش الربح: <span className="font-semibold">{profitMargin}%</span>
                            </p>
                        </div>
                    </div>

                    {/* P&L Breakdown */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                            <h2 className="font-bold text-gray-900">تفصيل الأرباح والخسائر</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* Revenue Section */}
                            <div>
                                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                                    <span className="font-bold text-gray-900">إجمالي الإيرادات</span>
                                    <span className="font-bold text-blue-600">{formatCurrency(report.total_revenue)}</span>
                                </div>
                                {report.revenue_details.length > 0 && (
                                    <div className="mt-2 space-y-1 pr-4">
                                        {report.revenue_details.slice(0, 10).map((item, i) => (
                                            <div key={i} className="flex justify-between text-sm py-1">
                                                <span className="text-gray-600">{item.invoice_number || `فاتورة #${i + 1}`}</span>
                                                <span className="text-gray-900">{formatCurrency(item.amount)}</span>
                                            </div>
                                        ))}
                                        {report.revenue_details.length > 10 && (
                                            <p className="text-xs text-gray-400 mt-1">
                                                و {report.revenue_details.length - 10} فاتورة أخرى...
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Expenses Section with Category Breakdown */}
                            <div>
                                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                                    <span className="font-bold text-gray-900">(-) إجمالي المصروفات</span>
                                    <span className="font-bold text-red-600">{formatCurrency(report.total_expenses)}</span>
                                </div>
                                {Object.keys(expenseByCategory).length > 0 && (
                                    <div className="mt-2 space-y-1 pr-4">
                                        {Object.entries(expenseByCategory)
                                            .sort(([, a], [, b]) => b - a)
                                            .map(([cat, amount], i) => (
                                                <div key={i} className="flex justify-between text-sm py-1">
                                                    <span className="text-gray-600">{cat}</span>
                                                    <span className="text-gray-900">{formatCurrency(amount)}</span>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>

                            {/* Payroll Section */}
                            <div>
                                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                                    <span className="font-bold text-gray-900">(-) الرواتب المصروفة</span>
                                    <span className="font-bold text-amber-600">{formatCurrency(report.total_payroll)}</span>
                                </div>
                                {report.payroll_details.length > 0 && (
                                    <div className="mt-2 space-y-1 pr-4">
                                        {report.payroll_details.map((item, i) => (
                                            <div key={i} className="flex justify-between text-sm py-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-600">{months[(item.month || 1) - 1]} {item.year}</span>
                                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${item.status === 'paid' ? 'bg-green-100 text-green-700'
                                                            : item.status === 'partially_paid' ? 'bg-amber-100 text-amber-700'
                                                                : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {item.status === 'paid' ? 'مكتمل' : item.status === 'partially_paid' ? 'جزئى' : item.status}
                                                    </span>
                                                </div>
                                                <span className="text-gray-900">{formatCurrency(item.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Advances Section */}
                            <div>
                                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                                    <span className="font-bold text-gray-900">(-) السلف المصروفة</span>
                                    <span className="font-bold text-purple-600">{formatCurrency(report.total_advances)}</span>
                                </div>
                                {report.advance_details.length > 0 && (
                                    <div className="mt-2 space-y-1 pr-4">
                                        {report.advance_details.map((item, i) => (
                                            <div key={i} className="flex justify-between text-sm py-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-600">{item.worker_name}</span>
                                                    <span className="text-xs text-gray-400">{item.date}</span>
                                                </div>
                                                <span className="text-gray-900">{formatCurrency(item.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Net Profit */}
                            <div className={`rounded-xl p-4 ${report.net_profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'
                                }`}>
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-lg text-gray-900">صافي الربح</span>
                                    <span className={`font-bold text-xl ${report.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'
                                        }`}>
                                        {formatCurrency(report.net_profit)}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    = الإيرادات ({formatCurrency(report.total_revenue)}) − المصروفات ({formatCurrency(report.total_expenses)}) − الرواتب ({formatCurrency(report.total_payroll)}) − السلف ({formatCurrency(report.total_advances)})
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    )
}

export default ProfitLossPage
