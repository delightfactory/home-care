import React, { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    Banknote,
    Users,
    ChevronDown,
    ChevronUp,
    Calendar,
    RefreshCw,
    ArrowDownCircle,
    ArrowUpCircle,
} from 'lucide-react'
import { ProfitLossAPI } from '../../api/profit-loss'
import { formatCurrency, getToday, getStartOfMonth, getEndOfMonth, toLocalDateISO } from '../../api'
import type { ProfitLossReport } from '../../types/hr.types'

// ─────────────────────────────────────────────────
// Date Range Presets
// ─────────────────────────────────────────────────
type PresetKey = 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom'

interface DatePreset {
    key: PresetKey
    label: string
    icon?: React.ReactNode
    getRange: () => { from: string; to: string }
}

const getYesterday = (): string => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return toLocalDateISO(d)
}

const getStartOfWeek = (): string => {
    const d = new Date()
    const day = d.getDay() // 0=Sun
    const diff = day === 0 ? 6 : day - 1 // Adjust so Monday=0
    d.setDate(d.getDate() - diff)
    return toLocalDateISO(d)
}

const getLastMonthRange = (): { from: string; to: string } => {
    const d = new Date()
    const first = new Date(d.getFullYear(), d.getMonth() - 1, 1)
    const last = new Date(d.getFullYear(), d.getMonth(), 0)
    return { from: toLocalDateISO(first), to: toLocalDateISO(last) }
}

const presets: DatePreset[] = [
    {
        key: 'today',
        label: 'اليوم',
        getRange: () => ({ from: getToday(), to: getToday() }),
    },
    {
        key: 'yesterday',
        label: 'الأمس',
        getRange: () => ({ from: getYesterday(), to: getYesterday() }),
    },
    {
        key: 'week',
        label: 'هذا الأسبوع',
        getRange: () => ({ from: getStartOfWeek(), to: getToday() }),
    },
    {
        key: 'month',
        label: 'هذا الشهر',
        getRange: () => ({ from: getStartOfMonth(), to: getEndOfMonth() }),
    },
    {
        key: 'last_month',
        label: 'الشهر الماضي',
        getRange: getLastMonthRange,
    },
]

// ─────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────
const FinancialSummaryCard: React.FC = () => {
    const [activePreset, setActivePreset] = useState<PresetKey>('today')
    const [customFrom, setCustomFrom] = useState(getToday())
    const [customTo, setCustomTo] = useState(getToday())
    const [showDetails, setShowDetails] = useState(false)

    // Compute the effective date range
    const dateRange = useMemo(() => {
        if (activePreset === 'custom') {
            return { from: customFrom, to: customTo }
        }
        const preset = presets.find(p => p.key === activePreset)
        return preset ? preset.getRange() : { from: getToday(), to: getToday() }
    }, [activePreset, customFrom, customTo])

    // Fetch P&L data using existing ProfitLossAPI
    const {
        data: report,
        isLoading,
        isFetching,
        refetch,
    } = useQuery<ProfitLossReport>(
        ['financial-summary', dateRange.from, dateRange.to],
        () => ProfitLossAPI.getReport(dateRange.from, dateRange.to),
        { staleTime: 1000 * 60 * 2, keepPreviousData: true }
    )

    const handlePresetClick = useCallback((key: PresetKey) => {
        setActivePreset(key)
    }, [])

    // Summary cards config
    const summaryItems = useMemo(() => {
        if (!report) return []
        const totalOutgoing = report.total_expenses + report.total_payroll + report.total_advances
        return [
            {
                label: 'إجمالي الإيرادات',
                value: report.total_revenue,
                icon: ArrowDownCircle,
                gradient: 'from-emerald-500 to-teal-600',
                bgLight: 'from-emerald-50 to-teal-50',
                borderColor: 'border-emerald-200',
                textColor: 'text-emerald-700',
                detail: `${report.revenue_details?.length || 0} فاتورة محصّلة`,
            },
            {
                label: 'المصروفات',
                value: report.total_expenses,
                icon: ArrowUpCircle,
                gradient: 'from-red-500 to-rose-600',
                bgLight: 'from-red-50 to-rose-50',
                borderColor: 'border-red-200',
                textColor: 'text-red-700',
                detail: `${report.expense_details?.length || 0} مصروف معتمد`,
            },
            {
                label: 'الرواتب المصروفة',
                value: report.total_payroll,
                icon: Users,
                gradient: 'from-blue-500 to-indigo-600',
                bgLight: 'from-blue-50 to-indigo-50',
                borderColor: 'border-blue-200',
                textColor: 'text-blue-700',
                detail: `${report.payroll_details?.length || 0} دفعة`,
            },
            {
                label: 'السلف المصروفة',
                value: report.total_advances,
                icon: Banknote,
                gradient: 'from-amber-500 to-orange-600',
                bgLight: 'from-amber-50 to-orange-50',
                borderColor: 'border-amber-200',
                textColor: 'text-amber-700',
                detail: `${report.advance_details?.length || 0} سلفة`,
            },
            {
                label: 'صافي الإيراد',
                value: report.net_profit,
                icon: report.net_profit >= 0 ? TrendingUp : TrendingDown,
                gradient: report.net_profit >= 0 ? 'from-green-500 to-emerald-600' : 'from-red-600 to-rose-700',
                bgLight: report.net_profit >= 0 ? 'from-green-50 to-emerald-50' : 'from-red-50 to-rose-50',
                borderColor: report.net_profit >= 0 ? 'border-green-200' : 'border-red-300',
                textColor: report.net_profit >= 0 ? 'text-green-700' : 'text-red-700',
                detail: `الإيرادات − (${formatCurrency(totalOutgoing)}) مصروفات`,
                isHighlighted: true,
            },
        ]
    }, [report])

    // Date display label
    const dateLabel = useMemo(() => {
        if (dateRange.from === dateRange.to) {
            return new Date(dateRange.from + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            })
        }
        const from = new Date(dateRange.from + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const to = new Date(dateRange.to + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        return `${from} — ${to}`
    }, [dateRange])

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* ── Header ── */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 sm:px-6 py-4 sm:py-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/10 backdrop-blur rounded-xl">
                            <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-white">الملخص المالي</h3>
                            <p className="text-xs sm:text-sm text-slate-300 mt-0.5 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                {dateLabel}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="self-end sm:self-auto p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        title="تحديث"
                    >
                        <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isFetching ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* ── Preset filters ── */}
                <div className="flex flex-wrap gap-2 mt-3 sm:mt-4">
                    {presets.map(preset => (
                        <button
                            key={preset.key}
                            onClick={() => handlePresetClick(preset.key)}
                            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 ${activePreset === preset.key
                                ? 'bg-white text-slate-800 shadow-md scale-105'
                                : 'bg-white/10 text-slate-200 hover:bg-white/20'
                                }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                    <button
                        onClick={() => handlePresetClick('custom')}
                        className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 ${activePreset === 'custom'
                            ? 'bg-white text-slate-800 shadow-md scale-105'
                            : 'bg-white/10 text-slate-200 hover:bg-white/20'
                            }`}
                    >
                        مخصص
                    </button>
                </div>

                {/* ── Custom date pickers ── */}
                {activePreset === 'custom' && (
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3 animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 flex-1">
                            <label className="text-xs text-slate-300 whitespace-nowrap">من</label>
                            <input
                                type="date"
                                value={customFrom}
                                onChange={e => setCustomFrom(e.target.value)}
                                className="flex-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 [color-scheme:dark]"
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                            <label className="text-xs text-slate-300 whitespace-nowrap">إلى</label>
                            <input
                                type="date"
                                value={customTo}
                                onChange={e => setCustomTo(e.target.value)}
                                className="flex-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 [color-scheme:dark]"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Body ── */}
            <div className="p-4 sm:p-6">
                {isLoading && !report ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                            <span className="text-sm text-gray-500">جاري تحميل البيانات المالية...</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* ── Summary Cards Grid ── */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                            {summaryItems.map((item, idx) => {
                                const Icon = item.icon
                                return (
                                    <div
                                        key={idx}
                                        className={`relative group rounded-xl border ${item.borderColor} bg-gradient-to-br ${item.bgLight} p-3 sm:p-4 transition-all duration-300 hover:shadow-md hover:scale-[1.02] ${item.isHighlighted
                                            ? 'col-span-2 sm:col-span-1 ring-1 ring-offset-1 ' +
                                            (report && report.net_profit >= 0
                                                ? 'ring-green-300'
                                                : 'ring-red-300')
                                            : ''
                                            }`}
                                    >
                                        {/* Badge for loading overlay */}
                                        {isFetching && (
                                            <div className="absolute inset-0 bg-white/60 rounded-xl flex items-center justify-center z-10">
                                                <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={`p-1.5 sm:p-2 rounded-lg bg-gradient-to-br ${item.gradient} shadow-sm`}>
                                                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                                            </div>
                                            <span className={`text-xs sm:text-sm font-semibold ${item.textColor}`}>
                                                {item.label}
                                            </span>
                                        </div>

                                        <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mt-1">
                                            {formatCurrency(item.value)}{' '}
                                            <span className="text-xs sm:text-sm font-normal text-gray-500">ج.م</span>
                                        </p>

                                        <p className="text-[10px] sm:text-xs text-gray-500 mt-1 truncate">{item.detail}</p>
                                    </div>
                                )
                            })}
                        </div>

                        {/* ── Toggle Details ── */}
                        {report && (
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="mt-4 sm:mt-5 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-xl transition-all hover:bg-gray-50"
                            >
                                {showDetails ? (
                                    <>
                                        <ChevronUp className="w-4 h-4" />
                                        إخفاء التفاصيل
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="w-4 h-4" />
                                        عرض التفاصيل
                                    </>
                                )}
                            </button>
                        )}

                        {/* ── Details Section ── */}
                        {showDetails && report && (
                            <div className="mt-4 space-y-4 animate-in slide-in-from-top-2">
                                {/* Revenue details */}
                                {report.revenue_details?.length > 0 && (
                                    <DetailsSection
                                        title="الإيرادات المحصّلة"
                                        icon={<ArrowDownCircle className="w-4 h-4 text-emerald-600" />}
                                        colorClass="emerald"
                                        items={report.revenue_details.map(r => ({
                                            label: r.invoice_number || r.id.slice(0, 8),
                                            amount: r.amount,
                                            date: r.date,
                                        }))}
                                        total={report.total_revenue}
                                    />
                                )}

                                {/* Expense details */}
                                {report.expense_details?.length > 0 && (
                                    <DetailsSection
                                        title="المصروفات المعتمدة"
                                        icon={<ArrowUpCircle className="w-4 h-4 text-red-600" />}
                                        colorClass="red"
                                        items={report.expense_details.map(e => ({
                                            label: e.description || e.category || '-',
                                            amount: e.amount,
                                            date: e.date,
                                            badge: e.category,
                                        }))}
                                        total={report.total_expenses}
                                    />
                                )}

                                {/* Payroll details */}
                                {report.payroll_details?.length > 0 && (
                                    <DetailsSection
                                        title="الرواتب المصروفة"
                                        icon={<Users className="w-4 h-4 text-blue-600" />}
                                        colorClass="blue"
                                        items={report.payroll_details.map(p => ({
                                            label: `مسير ${p.month}/${p.year}`,
                                            amount: p.amount,
                                            date: p.date,
                                        }))}
                                        total={report.total_payroll}
                                    />
                                )}

                                {/* Advance details */}
                                {report.advance_details?.length > 0 && (
                                    <DetailsSection
                                        title="السلف المصروفة"
                                        icon={<Banknote className="w-4 h-4 text-amber-600" />}
                                        colorClass="amber"
                                        items={report.advance_details.map(a => ({
                                            label: a.worker_name || '-',
                                            amount: a.amount,
                                            date: a.date,
                                            badge: a.vault_name,
                                        }))}
                                        total={report.total_advances}
                                    />
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────
// Details Sub-component
// ─────────────────────────────────────────────────
interface DetailItem {
    label: string
    amount: number
    date?: string
    badge?: string
}

const colorMap: Record<string, { bg: string; border: string; header: string; text: string }> = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', header: 'bg-emerald-100', text: 'text-emerald-800' },
    red: { bg: 'bg-red-50', border: 'border-red-200', header: 'bg-red-100', text: 'text-red-800' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-100', text: 'text-blue-800' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', header: 'bg-amber-100', text: 'text-amber-800' },
}

const DetailsSection: React.FC<{
    title: string
    icon: React.ReactNode
    colorClass: string
    items: DetailItem[]
    total: number
}> = ({ title, icon, colorClass, items, total }) => {
    const colors = colorMap[colorClass] || colorMap.emerald

    return (
        <div className={`rounded-xl border ${colors.border} overflow-hidden`}>
            {/* Section Header */}
            <div className={`${colors.header} px-4 py-2.5 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                    {icon}
                    <span className={`text-sm font-semibold ${colors.text}`}>{title}</span>
                    <span className="text-xs text-gray-500 bg-white/60 px-2 py-0.5 rounded-full">
                        {items.length}
                    </span>
                </div>
                <span className={`text-sm font-bold ${colors.text}`}>
                    {formatCurrency(total)} ج.م
                </span>
            </div>

            {/* Items List */}
            <div className={`${colors.bg} divide-y ${colors.border} max-h-48 overflow-y-auto`}>
                {items.slice(0, 20).map((item, idx) => (
                    <div key={idx} className="px-4 py-2 flex items-center justify-between text-sm hover:bg-white/50 transition-colors">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-gray-700 truncate">{item.label}</span>
                            {item.badge && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-white/70 rounded text-gray-500 whitespace-nowrap">
                                    {item.badge}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                            {item.date && (
                                <span className="text-xs text-gray-400 hidden sm:inline">
                                    {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                            )}
                            <span className="font-semibold text-gray-800 whitespace-nowrap">
                                {formatCurrency(item.amount)} ج.م
                            </span>
                        </div>
                    </div>
                ))}
                {items.length > 20 && (
                    <div className="px-4 py-2 text-xs text-center text-gray-400">
                        و {items.length - 20} عنصر آخر...
                    </div>
                )}
            </div>
        </div>
    )
}

export default FinancialSummaryCard
