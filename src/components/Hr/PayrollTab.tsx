// PayrollTab — تبويب إدارة الرواتب مع نظام الصرف الجزئى
import React, { useState, useEffect, useCallback } from 'react'
import {
    Calculator, CheckCircle2, RefreshCw, Loader2,
    Eye, X, AlertTriangle, Wallet, ChevronDown, ChevronUp,
} from 'lucide-react'
import { PayrollAPI } from '../../api/hr'
import { VaultsAPI } from '../../api/vaults'
import type { PayrollPeriod, PayrollItemWithWorker, PayrollDisbursement } from '../../types/hr.types'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

interface Vault {
    id: string
    name: string
    balance: number
    is_active: boolean
}

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: 'مسودة', color: 'text-gray-600', bg: 'bg-gray-100' },
    calculated: { label: 'محسوب', color: 'text-amber-700', bg: 'bg-amber-100' },
    approved: { label: 'معتمد', color: 'text-blue-700', bg: 'bg-blue-100' },
    partially_paid: { label: 'مصروف جزئياً', color: 'text-orange-700', bg: 'bg-orange-100' },
    paid: { label: 'مصروف بالكامل', color: 'text-green-700', bg: 'bg-green-100' },
}

const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

const PayrollTab: React.FC = () => {
    const { user } = useAuth()
    const [periods, setPeriods] = useState<PayrollPeriod[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null)
    const [periodItems, setPeriodItems] = useState<PayrollItemWithWorker[]>([])
    const [loadingItems, setLoadingItems] = useState(false)

    // حساب مسير جديد
    const [showCalcModal, setShowCalcModal] = useState(false)
    const [calcMonth, setCalcMonth] = useState(new Date().getMonth() + 1)
    const [calcYear, setCalcYear] = useState(new Date().getFullYear())
    const [calculating, setCalculating] = useState(false)
    const [approving, setApproving] = useState(false)

    // صرف الرواتب
    const [showDisburseModal, setShowDisburseModal] = useState(false)
    const [disbursePeriod, setDisbursePeriod] = useState<PayrollPeriod | null>(null)
    const [vaults, setVaults] = useState<Vault[]>([])
    const [selectedVaultId, setSelectedVaultId] = useState('')
    const [disburseAmount, setDisburseAmount] = useState('')
    const [disbursing, setDisbursing] = useState(false)

    // تاريخ الصرف
    const [disbursements, setDisbursements] = useState<PayrollDisbursement[]>([])
    const [showDisbursements, setShowDisbursements] = useState(false)
    const [loadingDisbursements, setLoadingDisbursements] = useState(false)

    const loadPeriods = useCallback(async () => {
        setLoading(true)
        try {
            const data = await PayrollAPI.getPayrollPeriods()
            setPeriods(data)
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ في تحميل المسيرات')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadPeriods()
    }, [loadPeriods])

    const handleCalculate = async () => {
        setCalculating(true)
        try {
            const result = await PayrollAPI.calculatePayroll(calcMonth, calcYear)
            if (result.success) {
                toast.success('تم حساب المسير بنجاح')
                setShowCalcModal(false)
                loadPeriods()
            } else {
                toast.error(result.error || 'حدث خطأ')
            }
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ')
        } finally {
            setCalculating(false)
        }
    }

    const handleApprove = async (periodId: string) => {
        if (!user?.id) return
        if (!window.confirm('هل أنت متأكد من اعتماد هذا المسير؟ لن يمكن إعادة حسابه بعد الاعتماد.')) return

        setApproving(true)
        try {
            const result = await PayrollAPI.approvePayroll(periodId, user.id)
            if (result.success) {
                toast.success('تم اعتماد المسير بنجاح — يمكنك الآن صرف الرواتب')
                loadPeriods()
                // تحديث النافذة المفتوحة إن وجدت
                if (selectedPeriod?.id === periodId) {
                    const updated = await PayrollAPI.getPayrollPeriodById(periodId)
                    if (updated) setSelectedPeriod(updated)
                }
            } else {
                toast.error(result.error || 'حدث خطأ')
            }
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ')
        } finally {
            setApproving(false)
        }
    }

    const handleViewDetails = async (period: PayrollPeriod) => {
        setSelectedPeriod(period)
        setLoadingItems(true)
        setShowDisbursements(false)
        setDisbursements([])
        try {
            const items = await PayrollAPI.getPayrollItems(period.id)
            setPeriodItems(items)
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ في تحميل بنود المسير')
        } finally {
            setLoadingItems(false)
        }
    }

    // فتح مودال الصرف
    const handleOpenDisburse = async (period: PayrollPeriod) => {
        setDisbursePeriod(period)
        const remaining = period.net_total - (period.total_disbursed || 0)
        setDisburseAmount(remaining.toFixed(2))
        setSelectedVaultId('')
        setShowDisburseModal(true)

        try {
            const vaultList = await VaultsAPI.getVaults(true)
            setVaults(vaultList)
        } catch (err: any) {
            toast.error('خطأ فى تحميل الخزائن')
        }
    }

    // تنفيذ الصرف
    const handleDisburse = async () => {
        if (!user?.id || !disbursePeriod || !selectedVaultId) return
        const amount = parseFloat(disburseAmount)
        if (isNaN(amount) || amount <= 0) {
            toast.error('يرجى إدخال مبلغ صحيح')
            return
        }

        const remaining = disbursePeriod.net_total - (disbursePeriod.total_disbursed || 0)
        if (amount > remaining) {
            toast.error(`المبلغ أكبر من المتبقى (${formatCurrency(remaining)})`)
            return
        }

        const selectedVault = vaults.find(v => v.id === selectedVaultId)
        if (selectedVault && selectedVault.balance < amount) {
            toast.error(`رصيد الخزنة غير كافٍ (${formatCurrency(selectedVault.balance)})`)
            return
        }

        setDisbursing(true)
        try {
            const result = await PayrollAPI.disbursePayroll(
                disbursePeriod.id,
                selectedVaultId,
                amount,
                user.id
            )

            if (result.success) {
                toast.success(result.message || 'تم الصرف بنجاح')
                setShowDisburseModal(false)
                loadPeriods()
                // تحديث التفاصيل المفتوحة
                if (selectedPeriod?.id === disbursePeriod.id) {
                    const updated = await PayrollAPI.getPayrollPeriodById(disbursePeriod.id)
                    if (updated) setSelectedPeriod(updated)
                }
            } else {
                toast.error(result.error || 'حدث خطأ فى الصرف')
            }
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ')
        } finally {
            setDisbursing(false)
        }
    }

    // جلب تاريخ الصرف
    const handleLoadDisbursements = async (periodId: string) => {
        if (showDisbursements && disbursements.length > 0) {
            setShowDisbursements(false)
            return
        }
        setLoadingDisbursements(true)
        setShowDisbursements(true)
        try {
            const data = await PayrollAPI.getDisbursements(periodId)
            setDisbursements(data)
        } catch (err: any) {
            toast.error('خطأ فى تحميل سجل الصرف')
        } finally {
            setLoadingDisbursements(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ar-EG', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(amount)
    }

    /** نسبة الصرف */
    const getDisbursementPercent = (period: PayrollPeriod) => {
        if (!period.net_total || period.net_total <= 0) return 0
        return Math.min(100, ((period.total_disbursed || 0) / period.net_total) * 100)
    }

    /** هل يمكن الصرف؟ */
    const canDisburse = (period: PayrollPeriod) =>
        ['approved', 'partially_paid'].includes(period.status)

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="text-sm text-gray-500">
                    {periods.length > 0 ? `${periods.length} مسير رواتب` : 'لا توجد مسيرات'}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={loadPeriods}
                        className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowCalcModal(true)}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                    >
                        <Calculator className="w-4 h-4" />
                        <span>حساب مسير جديد</span>
                    </button>
                </div>
            </div>

            {/* Periods List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
            ) : periods.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>لا توجد مسيرات رواتب بعد</p>
                    <p className="text-xs mt-1">اضغط "حساب مسير جديد" للبدء</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {periods.map((period) => {
                        const statusDef = statusLabels[period.status] || statusLabels.draft
                        const disbPercent = getDisbursementPercent(period)
                        return (
                            <div
                                key={period.id}
                                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                                            <Receipt className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">
                                                {months[period.month - 1]} {period.year}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusDef.bg} ${statusDef.color}`}>
                                                    {statusDef.label}
                                                </span>
                                                {period.approved_at && (
                                                    <span className="text-xs text-gray-400">
                                                        اعتمد: {new Date(period.approved_at).toLocaleDateString('ar-EG')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {/* Summary Numbers */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                            <div>
                                                <p className="text-xs text-gray-500">الرواتب</p>
                                                <p className="font-semibold text-gray-900 text-sm">{formatCurrency(period.total_salaries)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">خصم الغياب</p>
                                                <p className="font-semibold text-red-600 text-sm">{formatCurrency(period.total_absence_deductions)}</p>
                                            </div>
                                            <div className="hidden sm:block">
                                                <p className="text-xs text-gray-500">السلف</p>
                                                <p className="font-semibold text-amber-600 text-sm">{formatCurrency(period.total_advances)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">الصافي</p>
                                                <p className="font-bold text-emerald-600">{formatCurrency(period.net_total)}</p>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleViewDetails(period)}
                                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="عرض التفاصيل"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            {period.status === 'calculated' && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(period.id)}
                                                        disabled={approving}
                                                        className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                                        title="اعتماد"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            const result = await PayrollAPI.calculatePayroll(period.month, period.year)
                                                            if (result.success) {
                                                                toast.success('تم إعادة الحساب')
                                                                loadPeriods()
                                                            }
                                                        }}
                                                        className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                                                        title="إعادة حساب"
                                                    >
                                                        <RefreshCw className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                            {canDisburse(period) && (
                                                <button
                                                    onClick={() => handleOpenDisburse(period)}
                                                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                    title="صرف من الخزنة"
                                                >
                                                    <Wallet className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Disbursement Progress Bar */}
                                {canDisburse(period) || period.status === 'paid' ? (
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                        <div className="flex items-center justify-between text-xs mb-1.5">
                                            <span className="text-gray-500">
                                                المصروف: {formatCurrency(period.total_disbursed || 0)} / {formatCurrency(period.net_total)}
                                            </span>
                                            <span className={`font-medium ${period.status === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>
                                                {disbPercent.toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${period.status === 'paid' ? 'bg-green-500' : 'bg-orange-400'
                                                    }`}
                                                style={{ width: `${disbPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Calculate Modal */}
            {showCalcModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCalcModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900">حساب مسير الرواتب</h3>
                            <button onClick={() => setShowCalcModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">الشهر</label>
                                    <select
                                        value={calcMonth}
                                        onChange={(e) => setCalcMonth(Number(e.target.value))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500"
                                    >
                                        {months.map((m, i) => (
                                            <option key={i + 1} value={i + 1}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">السنة</label>
                                    <select
                                        value={calcYear}
                                        onChange={(e) => setCalcYear(Number(e.target.value))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500"
                                    >
                                        {[2024, 2025, 2026, 2027].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <div className="flex gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-amber-700">
                                        سيتم حساب المسير بناءً على سجلات الحضور والتسويات والسلف المسجلة لهذا الشهر.
                                        إذا كان المسير موجوداً مسبقاً سيتم إعادة حسابه.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleCalculate}
                                    disabled={calculating}
                                    className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {calculating && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {calculating ? 'جارِ الحساب...' : 'حساب المسير'}
                                </button>
                                <button
                                    onClick={() => setShowCalcModal(false)}
                                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Disburse Modal */}
            {showDisburseModal && disbursePeriod && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDisburseModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">صرف الرواتب</h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {months[disbursePeriod.month - 1]} {disbursePeriod.year}
                                </p>
                            </div>
                            <button onClick={() => setShowDisburseModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* ملخص المبالغ */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">إجمالى الصافى</span>
                                    <span className="font-bold text-gray-900">{formatCurrency(disbursePeriod.net_total)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">تم صرفه</span>
                                    <span className="font-semibold text-orange-600">{formatCurrency(disbursePeriod.total_disbursed || 0)}</span>
                                </div>
                                <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                                    <span className="text-gray-700 font-medium">المتبقى</span>
                                    <span className="font-bold text-emerald-600">
                                        {formatCurrency(disbursePeriod.net_total - (disbursePeriod.total_disbursed || 0))}
                                    </span>
                                </div>
                            </div>

                            {/* اختيار الخزنة */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">الخزنة</label>
                                <select
                                    value={selectedVaultId}
                                    onChange={(e) => setSelectedVaultId(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="">— اختر خزنة —</option>
                                    {vaults.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.name} (رصيد: {formatCurrency(v.balance)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* المبلغ */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ المراد صرفه</label>
                                <input
                                    type="number"
                                    value={disburseAmount}
                                    onChange={(e) => setDisburseAmount(e.target.value)}
                                    min={0.01}
                                    max={disbursePeriod.net_total - (disbursePeriod.total_disbursed || 0)}
                                    step="0.01"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500"
                                    placeholder="أدخل المبلغ"
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    اتركه بالكامل لصرف كل المتبقى، أو أدخل مبلغ جزئى
                                </p>
                            </div>

                            {/* تحذير رصيد الخزنة */}
                            {selectedVaultId && (() => {
                                const vault = vaults.find(v => v.id === selectedVaultId)
                                const amount = parseFloat(disburseAmount) || 0
                                if (vault && vault.balance < amount) {
                                    return (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                            <div className="flex gap-2">
                                                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                                <p className="text-xs text-red-700">
                                                    رصيد الخزنة ({formatCurrency(vault.balance)}) غير كافٍ للمبلغ المطلوب ({formatCurrency(amount)})
                                                </p>
                                            </div>
                                        </div>
                                    )
                                }
                                return null
                            })()}

                            <div className="flex gap-3">
                                <button
                                    onClick={handleDisburse}
                                    disabled={disbursing || !selectedVaultId || !disburseAmount}
                                    className="flex-1 bg-purple-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {disbursing && <Loader2 className="w-4 h-4 animate-spin" />}
                                    <Wallet className="w-4 h-4" />
                                    {disbursing ? 'جارِ الصرف...' : 'صرف'}
                                </button>
                                <button
                                    onClick={() => setShowDisburseModal(false)}
                                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {selectedPeriod && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPeriod(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-5xl shadow-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">
                                    تفاصيل مسير {months[selectedPeriod.month - 1]} {selectedPeriod.year}
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    الصافي: <span className="font-bold text-emerald-600">{formatCurrency(selectedPeriod.net_total)}</span>
                                    {(selectedPeriod.total_disbursed || 0) > 0 && (
                                        <span className="mr-3 text-gray-400">
                                            المصروف: <span className="font-semibold text-orange-600">{formatCurrency(selectedPeriod.total_disbursed || 0)}</span>
                                        </span>
                                    )}
                                </p>
                            </div>
                            <button onClick={() => setSelectedPeriod(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-5 border-b border-gray-100 flex-shrink-0">
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500">إجمالي الرواتب</p>
                                <p className="font-bold text-gray-900">{formatCurrency(selectedPeriod.total_salaries)}</p>
                            </div>
                            <div className="bg-red-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500">خصم الغياب</p>
                                <p className="font-bold text-red-600">{formatCurrency(selectedPeriod.total_absence_deductions)}</p>
                            </div>
                            <div className="bg-amber-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500">السلف</p>
                                <p className="font-bold text-amber-600">{formatCurrency(selectedPeriod.total_advances)}</p>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500">الحوافز</p>
                                <p className="font-bold text-blue-600">{formatCurrency(selectedPeriod.total_incentives)}</p>
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500">صافي المسير</p>
                                <p className="font-bold text-emerald-600">{formatCurrency(selectedPeriod.net_total)}</p>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="overflow-auto flex-1 p-5">
                            {loadingItems ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-white">
                                        <tr className="border-b border-gray-200">
                                            <th className="text-right py-2.5 px-2 font-medium text-gray-600 whitespace-nowrap">العامل</th>
                                            <th className="text-center py-2.5 px-2 font-medium text-gray-600 whitespace-nowrap">الراتب</th>
                                            <th className="text-center py-2.5 px-2 font-medium text-gray-600 whitespace-nowrap hidden sm:table-cell">حضور</th>
                                            <th className="text-center py-2.5 px-2 font-medium text-gray-600 whitespace-nowrap hidden sm:table-cell">غياب</th>
                                            <th className="text-center py-2.5 px-2 font-medium text-gray-600 whitespace-nowrap hidden md:table-cell">إجازة</th>
                                            <th className="text-center py-2.5 px-2 font-medium text-gray-600 whitespace-nowrap hidden md:table-cell">مسموح</th>
                                            <th className="text-center py-2.5 px-2 font-medium text-gray-600 whitespace-nowrap">غير مدفوع</th>
                                            <th className="text-center py-2.5 px-2 font-medium text-gray-600 whitespace-nowrap">خصم غياب</th>
                                            <th className="text-center py-2.5 px-2 font-medium text-gray-600 whitespace-nowrap hidden lg:table-cell">حافز محسوب</th>
                                            <th className="text-center py-2.5 px-2 font-medium text-gray-600 whitespace-nowrap hidden lg:table-cell">حوافز</th>
                                            <th className="text-center py-2.5 px-2 font-medium text-gray-600 whitespace-nowrap hidden lg:table-cell">سلف</th>
                                            <th className="text-center py-2.5 px-2 font-medium text-gray-600 whitespace-nowrap">الصافي</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {periodItems.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="py-2.5 px-2 font-medium text-gray-900">
                                                    {(item.worker as any)?.name || '—'}
                                                </td>
                                                <td className="py-2.5 px-2 text-center text-gray-700">{formatCurrency(item.base_salary)}</td>
                                                <td className="py-2.5 px-2 text-center text-green-600 hidden sm:table-cell">{item.work_days}</td>
                                                <td className="py-2.5 px-2 text-center text-red-600 hidden sm:table-cell">{item.absent_days}</td>
                                                <td className="py-2.5 px-2 text-center text-blue-600 hidden md:table-cell">{item.leave_days}</td>
                                                <td className="py-2.5 px-2 text-center text-gray-500 hidden md:table-cell">{item.paid_leave_allowance}</td>
                                                <td className="py-2.5 px-2 text-center">
                                                    <span className={`font-semibold ${item.unpaid_absent_days > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                        {item.unpaid_absent_days}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-2 text-center">
                                                    <span className={`font-semibold ${item.absence_deduction > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                        {item.absence_deduction > 0 ? `-${formatCurrency(item.absence_deduction)}` : '0'}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-2 text-center text-purple-600 hidden lg:table-cell">
                                                    {item.calculated_bonus > 0 ? `+${formatCurrency(item.calculated_bonus)}` : '0'}
                                                </td>
                                                <td className="py-2.5 px-2 text-center text-green-600 hidden lg:table-cell">
                                                    {item.manual_incentives > 0 ? `+${formatCurrency(item.manual_incentives)}` : '0'}
                                                </td>
                                                <td className="py-2.5 px-2 text-center text-amber-600 hidden lg:table-cell">
                                                    {item.advance_deduction > 0 ? `-${formatCurrency(item.advance_deduction)}` : '0'}
                                                </td>
                                                <td className="py-2.5 px-2 text-center font-bold text-emerald-600">{formatCurrency(item.net_salary)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {periodItems.length > 0 && (
                                        <tfoot className="border-t-2 border-gray-300">
                                            <tr className="font-bold">
                                                <td className="py-3 px-2 text-gray-900">الإجمالي</td>
                                                <td className="py-3 px-2 text-center text-gray-900">{formatCurrency(selectedPeriod.total_salaries)}</td>
                                                <td className="py-3 px-2 text-center hidden sm:table-cell">—</td>
                                                <td className="py-3 px-2 text-center hidden sm:table-cell">—</td>
                                                <td className="py-3 px-2 text-center hidden md:table-cell">—</td>
                                                <td className="py-3 px-2 text-center hidden md:table-cell">—</td>
                                                <td className="py-3 px-2 text-center">—</td>
                                                <td className="py-3 px-2 text-center text-red-600">{formatCurrency(selectedPeriod.total_absence_deductions)}</td>
                                                <td className="py-3 px-2 text-center text-purple-600 hidden lg:table-cell">—</td>
                                                <td className="py-3 px-2 text-center text-green-600 hidden lg:table-cell">{formatCurrency(selectedPeriod.total_incentives)}</td>
                                                <td className="py-3 px-2 text-center text-amber-600 hidden lg:table-cell">{formatCurrency(selectedPeriod.total_advances)}</td>
                                                <td className="py-3 px-2 text-center text-emerald-600">{formatCurrency(selectedPeriod.net_total)}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            )}
                        </div>

                        {/* Disbursements History Toggle */}
                        {(canDisburse(selectedPeriod) || selectedPeriod.status === 'paid') && (
                            <div className="border-t border-gray-100">
                                <button
                                    onClick={() => handleLoadDisbursements(selectedPeriod.id)}
                                    className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    {showDisbursements ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    سجل الصرف ({(selectedPeriod.total_disbursed || 0) > 0 ? 'مصروف' : 'لم يُصرف بعد'})
                                </button>

                                {showDisbursements && (
                                    <div className="px-5 pb-4">
                                        {loadingDisbursements ? (
                                            <div className="flex justify-center py-3">
                                                <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                                            </div>
                                        ) : disbursements.length === 0 ? (
                                            <p className="text-center text-sm text-gray-400 py-3">لا توجد دفعات صرف بعد</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {disbursements.map((d) => (
                                                    <div key={d.id} className="flex items-center justify-between bg-purple-50 rounded-lg px-4 py-2.5 text-sm">
                                                        <div>
                                                            <span className="font-semibold text-purple-800">{formatCurrency(d.amount)}</span>
                                                            <span className="text-gray-500 mx-2">من</span>
                                                            <span className="text-gray-700">{(d.vault as any)?.name || 'خزنة محذوفة'}</span>
                                                        </div>
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(d.created_at).toLocaleDateString('ar-EG')} — {new Date(d.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Footer Actions */}
                        <div className="flex gap-3 p-5 border-t border-gray-200 flex-shrink-0">
                            {selectedPeriod.status === 'calculated' && (
                                <button
                                    onClick={() => handleApprove(selectedPeriod.id)}
                                    disabled={approving}
                                    className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {approving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    <CheckCircle2 className="w-4 h-4" />
                                    اعتماد المسير
                                </button>
                            )}
                            {canDisburse(selectedPeriod) && (
                                <button
                                    onClick={() => handleOpenDisburse(selectedPeriod)}
                                    className="flex-1 bg-purple-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Wallet className="w-4 h-4" />
                                    صرف من الخزنة
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// مكون مساعد لأيقونة Receipt
const Receipt = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
        <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
        <path d="M12 17.5v-11" />
    </svg>
)

export default PayrollTab
