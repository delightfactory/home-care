// PayrollTab — تبويب إدارة الرواتب مع نظام الصرف الجزئى
import React, { useState, useEffect, useCallback } from 'react'
import {
    Calculator, CheckCircle2, RefreshCw, Loader2,
    Eye, X, AlertTriangle, Wallet, ChevronDown, ChevronUp,
    Users, UserCheck, ChevronRight, ShieldCheck,
} from 'lucide-react'
import { PayrollAPI } from '../../api/hr'
import { VaultsAPI } from '../../api/vaults'
import type { PayrollPeriod, PayrollItemWithWorker, PayrollDisbursement } from '../../types/hr.types'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import { formatDate, formatDateTime } from '../../utils/formatters'

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

    // صرف فردى
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set())
    const [showIndividualDisburseModal, setShowIndividualDisburseModal] = useState(false)
    const [individualVaultId, setIndividualVaultId] = useState('')
    const [disbursingIndividual, setDisbursingIndividual] = useState(false)

    // تأكيد الاعتماد
    const [showApproveModal, setShowApproveModal] = useState(false)
    const [approvePeriod, setApprovePeriod] = useState<PayrollPeriod | null>(null)
    const [approveConfirmText, setApproveConfirmText] = useState('')

    // تفاصيل قابلة للطى
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

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

    const handleApprove = (period: PayrollPeriod) => {
        setApprovePeriod(period)
        setApproveConfirmText('')
        setShowApproveModal(true)
    }

    const confirmApprove = async () => {
        if (!user?.id || !approvePeriod) return

        setApproving(true)
        try {
            const result = await PayrollAPI.approvePayroll(approvePeriod.id, user.id)
            if (result.success) {
                toast.success('تم اعتماد المسير بنجاح — يمكنك الآن صرف الرواتب')
                setShowApproveModal(false)
                loadPeriods()
                // تحديث النافذة المفتوحة إن وجدت
                if (selectedPeriod?.id === approvePeriod.id) {
                    const updated = await PayrollAPI.getPayrollPeriodById(approvePeriod.id)
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
            // ⭐ إعادة حساب تلقائى إذا كان المسير غير معتمد
            if (period.status === 'calculated') {
                await PayrollAPI.calculatePayroll(period.month, period.year)
                // تحديث بيانات المسير بعد إعادة الحساب
                const updatedPeriods = await PayrollAPI.getPayrollPeriods()
                setPeriods(updatedPeriods)
                const updatedPeriod = updatedPeriods.find(p => p.id === period.id)
                if (updatedPeriod) setSelectedPeriod(updatedPeriod)
            }
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
        return new Intl.NumberFormat('en-US', {
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

    // ══════════════════════════════════════
    // صرف فردى — helpers
    // ══════════════════════════════════════
    const unpaidItems = periodItems.filter(i => i.payment_status !== 'paid' && i.net_salary > 0)
    const selectedTotal = periodItems
        .filter(i => selectedWorkerIds.has(i.worker_id) && i.payment_status !== 'paid')
        .reduce((sum, i) => sum + (i.net_salary - (i.disbursed_amount || 0)), 0)

    const toggleWorker = (workerId: string) => {
        setSelectedWorkerIds(prev => {
            const next = new Set(prev)
            if (next.has(workerId)) next.delete(workerId)
            else next.add(workerId)
            return next
        })
    }

    const toggleAllUnpaid = () => {
        if (selectedWorkerIds.size === unpaidItems.length) {
            setSelectedWorkerIds(new Set())
        } else {
            setSelectedWorkerIds(new Set(unpaidItems.map(i => i.worker_id)))
        }
    }

    const handleOpenIndividualDisburse = async (overrideIds?: Set<string>) => {
        const ids = overrideIds || selectedWorkerIds
        if (ids.size === 0) {
            toast.error('حدد عامل واحد على الأقل')
            return
        }
        if (overrideIds) setSelectedWorkerIds(overrideIds)
        setIndividualVaultId('')
        setShowIndividualDisburseModal(true)
        try {
            const vaultList = await VaultsAPI.getVaults(true)
            setVaults(vaultList)
        } catch {
            toast.error('خطأ فى تحميل الخزائن')
        }
    }

    const handleDisburseIndividual = async () => {
        if (!user?.id || !selectedPeriod || !individualVaultId || selectedWorkerIds.size === 0) return

        const selectedVault = vaults.find(v => v.id === individualVaultId)
        if (selectedVault && selectedVault.balance < selectedTotal) {
            toast.error(`رصيد الخزنة غير كافٍ (${formatCurrency(selectedVault.balance)})`)
            return
        }

        setDisbursingIndividual(true)
        try {
            const result = await PayrollAPI.disburseWorkerSalary(
                selectedPeriod.id,
                Array.from(selectedWorkerIds),
                individualVaultId,
                user.id
            )

            if (result.success) {
                toast.success(result.message || 'تم الصرف بنجاح')
                setShowIndividualDisburseModal(false)
                setSelectedWorkerIds(new Set())
                // refresh
                loadPeriods()
                const items = await PayrollAPI.getPayrollItems(selectedPeriod.id)
                setPeriodItems(items)
                const updated = await PayrollAPI.getPayrollPeriodById(selectedPeriod.id)
                if (updated) setSelectedPeriod(updated)
            } else {
                toast.error(result.error || 'حدث خطأ فى الصرف')
            }
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ')
        } finally {
            setDisbursingIndividual(false)
        }
    }

    const toggleExpanded = (itemId: string) => {
        setExpandedItems(prev => {
            const next = new Set(prev)
            if (next.has(itemId)) next.delete(itemId)
            else next.add(itemId)
            return next
        })
    }

    // حساب نسبة الصرف
    const paidCount = periodItems.filter(i => i.payment_status === 'paid').length
    const disbursementProgress = selectedPeriod
        ? Math.min(100, ((selectedPeriod.total_disbursed || 0) / Math.max(selectedPeriod.net_total, 1)) * 100)
        : 0

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
                                                        اعتمد: {formatDate(period.approved_at)}
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
                                                        onClick={() => handleApprove(period)}
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
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowDisburseModal(false)}>
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

            {/* Individual Disburse Modal */}
            {showIndividualDisburseModal && selectedPeriod && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowIndividualDisburseModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">صرف رواتب فردى</h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {months[selectedPeriod.month - 1]} {selectedPeriod.year}
                                </p>
                            </div>
                            <button onClick={() => setShowIndividualDisburseModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* ملخص المحدّدين */}
                            <div className="bg-purple-50 rounded-xl p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">العمال المحدّدين</span>
                                    <span className="font-bold text-purple-800">{selectedWorkerIds.size} عامل</span>
                                </div>
                                <div className="flex justify-between text-sm border-t border-purple-100 pt-2">
                                    <span className="text-gray-700 font-medium">إجمالى المبلغ</span>
                                    <span className="font-bold text-emerald-600">{formatCurrency(selectedTotal)}</span>
                                </div>
                            </div>

                            {/* قائمة الأسماء */}
                            <div className="max-h-32 overflow-y-auto bg-gray-50 rounded-lg p-3 text-sm text-gray-700 space-y-1">
                                {periodItems
                                    .filter(i => selectedWorkerIds.has(i.worker_id) && i.payment_status !== 'paid')
                                    .map(i => (
                                        <div key={i.worker_id} className="flex justify-between">
                                            <span>{(i.worker as any)?.name}</span>
                                            <span className="font-semibold">{formatCurrency(i.net_salary - (i.disbursed_amount || 0))}</span>
                                        </div>
                                    ))
                                }
                            </div>

                            {/* اختيار الخزنة */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">الخزنة</label>
                                <select
                                    value={individualVaultId}
                                    onChange={(e) => setIndividualVaultId(e.target.value)}
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

                            {/* تحذير رصيد الخزنة */}
                            {individualVaultId && (() => {
                                const vault = vaults.find(v => v.id === individualVaultId)
                                if (vault && vault.balance < selectedTotal) {
                                    return (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                            <div className="flex gap-2">
                                                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                                <p className="text-xs text-red-700">
                                                    رصيد الخزنة ({formatCurrency(vault.balance)}) غير كافٍ للمبلغ المطلوب ({formatCurrency(selectedTotal)})
                                                </p>
                                            </div>
                                        </div>
                                    )
                                }
                                return null
                            })()}

                            <div className="flex gap-3">
                                <button
                                    onClick={handleDisburseIndividual}
                                    disabled={disbursingIndividual || !individualVaultId}
                                    className="flex-1 bg-purple-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {disbursingIndividual && <Loader2 className="w-4 h-4 animate-spin" />}
                                    <Wallet className="w-4 h-4" />
                                    {disbursingIndividual ? 'جارِ الصرف...' : `صرف ${formatCurrency(selectedTotal)}`}
                                </button>
                                <button
                                    onClick={() => setShowIndividualDisburseModal(false)}
                                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Approve Confirmation Modal */}
            {showApproveModal && approvePeriod && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={() => setShowApproveModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">تأكيد اعتماد المسير</h3>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        {months[approvePeriod.month - 1]} {approvePeriod.year}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowApproveModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* ملخص المسير */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">إجمالي الرواتب</span>
                                    <span className="font-semibold text-gray-900">{formatCurrency(approvePeriod.total_salaries)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">خصم الغياب</span>
                                    <span className="font-semibold text-red-600">-{formatCurrency(approvePeriod.total_absence_deductions)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">السلف</span>
                                    <span className="font-semibold text-amber-600">-{formatCurrency(approvePeriod.total_advances)}</span>
                                </div>
                                <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                                    <span className="text-gray-700 font-bold">صافي المسير</span>
                                    <span className="font-bold text-emerald-600 text-base">{formatCurrency(approvePeriod.net_total)}</span>
                                </div>
                            </div>

                            {/* تحذير */}
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <div className="flex gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-red-700 leading-relaxed">
                                        بعد الاعتماد <strong>لن يمكن</strong> إعادة حساب المسير أو تعديله.
                                        تأكد من مراجعة كل البنود قبل الاعتماد.
                                    </p>
                                </div>
                            </div>

                            {/* حقل كتابة التأكيد */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    اكتب <span className="font-bold text-red-600">اعتماد</span> للتأكيد
                                </label>
                                <input
                                    type="text"
                                    value={approveConfirmText}
                                    onChange={(e) => setApproveConfirmText(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="اكتب هنا..."
                                    dir="rtl"
                                    autoComplete="off"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={confirmApprove}
                                    disabled={approving || approveConfirmText.trim() !== 'اعتماد'}
                                    className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {approving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    <ShieldCheck className="w-4 h-4" />
                                    {approving ? 'جاري الاعتماد...' : 'اعتماد المسير'}
                                </button>
                                <button
                                    onClick={() => setShowApproveModal(false)}
                                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal — Redesigned */}
            {selectedPeriod && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => { setSelectedPeriod(null); setExpandedItems(new Set()) }}>
                    <div
                        className="bg-white w-full sm:rounded-2xl sm:w-full sm:max-w-2xl shadow-2xl max-h-[95vh] sm:max-h-[88vh] flex flex-col rounded-t-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* ═══════ Header ═══════ */}
                        <div className="flex-shrink-0 p-4 sm:p-5 border-b border-gray-100">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">
                                        مسير {months[selectedPeriod.month - 1]} {selectedPeriod.year}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusLabels[selectedPeriod.status]?.bg} ${statusLabels[selectedPeriod.status]?.color}`}>
                                            {statusLabels[selectedPeriod.status]?.label}
                                        </span>
                                        {periodItems.length > 0 && (
                                            <span className="text-xs text-gray-400">
                                                {paidCount}/{periodItems.length} مدفوع
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button onClick={() => { setSelectedPeriod(null); setExpandedItems(new Set()) }} className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors">
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>

                            {/* Progress bar */}
                            {canDisburse(selectedPeriod) || selectedPeriod.status === 'paid' ? (
                                <div>
                                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                                        <span>المصروف: <span className="font-bold text-gray-800">{formatCurrency(selectedPeriod.total_disbursed || 0)}</span></span>
                                        <span>المتبقى: <span className="font-bold text-gray-800">{formatCurrency(selectedPeriod.net_total - (selectedPeriod.total_disbursed || 0))}</span></span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${disbursementProgress >= 100 ? 'bg-emerald-500' : 'bg-purple-500'}`}
                                            style={{ width: `${disbursementProgress}%` }}
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* ═══════ Summary Cards ═══════ */}
                        <div className="flex-shrink-0 px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                <div className="bg-white rounded-xl p-2.5 text-center shadow-sm border border-gray-100">
                                    <p className="text-[10px] text-gray-400 font-medium mb-0.5">الرواتب</p>
                                    <p className="font-bold text-sm text-gray-900">{formatCurrency(selectedPeriod.total_salaries)}</p>
                                </div>
                                <div className="bg-white rounded-xl p-2.5 text-center shadow-sm border border-red-100">
                                    <p className="text-[10px] text-red-400 font-medium mb-0.5">خصم غياب</p>
                                    <p className="font-bold text-sm text-red-600">{formatCurrency(selectedPeriod.total_absence_deductions)}</p>
                                </div>
                                <div className="bg-white rounded-xl p-2.5 text-center shadow-sm border border-amber-100">
                                    <p className="text-[10px] text-amber-400 font-medium mb-0.5">السلف</p>
                                    <p className="font-bold text-sm text-amber-600">{formatCurrency(selectedPeriod.total_advances)}</p>
                                </div>
                                <div className="bg-white rounded-xl p-2.5 text-center shadow-sm border border-blue-100">
                                    <p className="text-[10px] text-blue-400 font-medium mb-0.5">الحوافز</p>
                                    <p className="font-bold text-sm text-blue-600">{formatCurrency(selectedPeriod.total_incentives)}</p>
                                </div>
                                <div className="bg-white rounded-xl p-2.5 text-center shadow-sm border border-emerald-100 col-span-3 sm:col-span-1">
                                    <p className="text-[10px] text-emerald-400 font-medium mb-0.5">صافى المسير</p>
                                    <p className="font-bold text-sm text-emerald-600">{formatCurrency(selectedPeriod.net_total)}</p>
                                </div>
                            </div>
                        </div>

                        {/* ═══════ Worker Cards ═══════ */}
                        <div className="overflow-y-auto flex-1 px-4 sm:px-5 py-3 space-y-2">
                            {loadingItems ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                                </div>
                            ) : periodItems.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 text-sm">لا توجد بنود فى هذا المسير</div>
                            ) : (
                                <>
                                    {/* Select All */}
                                    {canDisburse(selectedPeriod) && unpaidItems.length > 0 && (
                                        <div className="flex items-center gap-2 py-1.5 px-1">
                                            <input
                                                type="checkbox"
                                                checked={selectedWorkerIds.size === unpaidItems.length}
                                                onChange={toggleAllUnpaid}
                                                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                            />
                                            <span className="text-xs text-gray-500">تحديد الكل ({unpaidItems.length})</span>
                                        </div>
                                    )}

                                    {periodItems.map((item) => {
                                        const isExpanded = expandedItems.has(item.id)
                                        const workerName = (item.worker as any)?.name || '—'
                                        const isPaid = item.payment_status === 'paid'
                                        const isSelected = selectedWorkerIds.has(item.worker_id)
                                        const totalDeductions = item.absence_deduction + (item.late_penalty_amount || 0) + item.manual_deductions + item.manual_penalties + item.advance_deduction
                                        const totalAdditions = item.calculated_bonus + item.manual_incentives + item.manual_bonuses

                                        return (
                                            <div
                                                key={item.id}
                                                className={`
                                                    border rounded-xl transition-all duration-200 overflow-hidden
                                                    ${isSelected ? 'border-purple-300 bg-purple-50/40 shadow-sm' : isPaid ? 'border-green-100 bg-green-50/20' : 'border-gray-200 bg-white'}
                                                    ${!isPaid && canDisburse(selectedPeriod) ? 'hover:border-purple-200 hover:shadow-sm' : ''}
                                                `}
                                            >
                                                {/* Card Header */}
                                                <div className="flex items-center gap-3 p-3 sm:p-3.5">
                                                    {/* Checkbox */}
                                                    {canDisburse(selectedPeriod) && (
                                                        <div className="flex-shrink-0">
                                                            {!isPaid && item.net_salary > 0 ? (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => toggleWorker(item.worker_id)}
                                                                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                                                />
                                                            ) : (
                                                                <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
                                                                    <UserCheck className="w-2.5 h-2.5 text-green-600" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Worker Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="font-semibold text-sm text-gray-900 truncate">{workerName}</span>
                                                            {isPaid ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 flex-shrink-0">
                                                                    <UserCheck className="w-3 h-3" />
                                                                    مدفوع
                                                                </span>
                                                            ) : item.net_salary <= 0 ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500 flex-shrink-0">
                                                                    لا مستحقات
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 flex-shrink-0">
                                                                    لم يُدفع
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Salary Flow */}
                                                        <div className="flex items-center gap-1.5 mt-1.5 text-xs flex-wrap">
                                                            <span className="text-gray-500">{formatCurrency(item.base_salary)}</span>
                                                            {totalDeductions > 0 && (
                                                                <span className="text-red-500">−{formatCurrency(totalDeductions)}</span>
                                                            )}
                                                            {totalAdditions > 0 && (
                                                                <span className="text-green-600">+{formatCurrency(totalAdditions)}</span>
                                                            )}
                                                            <span className="text-gray-300 mx-0.5">→</span>
                                                            <span className="font-bold text-emerald-600 text-sm">{formatCurrency(item.net_salary)}</span>
                                                        </div>
                                                    </div>

                                                    {/* Expand Toggle */}
                                                    <button
                                                        onClick={() => toggleExpanded(item.id)}
                                                        className="flex-shrink-0 p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
                                                    >
                                                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                                    </button>
                                                </div>

                                                {/* Expanded Details */}
                                                {isExpanded && (
                                                    <div className="border-t border-gray-100 px-3 sm:px-3.5 py-3 bg-gray-50/60 space-y-3">
                                                        {/* عقد العمل */}
                                                        <div>
                                                            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">بيانات الحساب</p>
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                                                                <div className="flex justify-between sm:flex-col sm:items-center">
                                                                    <span className="text-gray-400">الراتب</span>
                                                                    <span className="font-semibold text-gray-700">{formatCurrency(item.base_salary)}</span>
                                                                </div>
                                                                <div className="flex justify-between sm:flex-col sm:items-center">
                                                                    <span className="text-gray-400">أيام العمل المطلوبة</span>
                                                                    <span className="font-semibold text-gray-700">{item.required_work_days || item.total_month_days}</span>
                                                                </div>
                                                                <div className="flex justify-between sm:flex-col sm:items-center">
                                                                    <span className="text-gray-400">أيام فعلية</span>
                                                                    <span className="font-semibold text-blue-700">{item.effective_days || '—'}</span>
                                                                </div>
                                                                <div className="flex justify-between sm:flex-col sm:items-center">
                                                                    <span className="text-gray-400">اليومية</span>
                                                                    <span className="font-semibold text-gray-700">{formatCurrency(item.daily_rate)}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* الحضور والغياب */}
                                                        <div>
                                                            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">الحضور والغياب</p>
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                                                                <div className="flex justify-between sm:flex-col sm:items-center">
                                                                    <span className="text-gray-400">أيام العمل</span>
                                                                    <span className="font-semibold text-green-700">{item.work_days}</span>
                                                                </div>
                                                                <div className="flex justify-between sm:flex-col sm:items-center">
                                                                    <span className="text-gray-400">غياب</span>
                                                                    <span className={`font-semibold ${item.absent_days > 0 ? 'text-red-600' : 'text-gray-400'}`}>{item.absent_days}</span>
                                                                </div>
                                                                <div className="flex justify-between sm:flex-col sm:items-center">
                                                                    <span className="text-gray-400">رصيد الإجازات</span>
                                                                    <span className="font-semibold text-blue-600">
                                                                        {item.leave_used !== undefined ? `${item.leave_used}/${item.leave_balance}` : `${item.leave_days}/${item.paid_leave_allowance}`}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between sm:flex-col sm:items-center">
                                                                    <span className="text-gray-400">غياب بدون أجر</span>
                                                                    <span className={`font-semibold ${item.unpaid_absent_days > 0 ? 'text-red-600' : 'text-gray-400'}`}>{item.unpaid_absent_days}</span>
                                                                </div>
                                                                {(item.public_holiday_days || 0) > 0 && (
                                                                    <div className="flex justify-between sm:flex-col sm:items-center">
                                                                        <span className="text-gray-400">عطل رسمية</span>
                                                                        <span className="font-semibold text-indigo-600">{item.public_holiday_days}</span>
                                                                    </div>
                                                                )}
                                                                {item.late_days > 0 && (
                                                                    <div className="flex justify-between sm:flex-col sm:items-center">
                                                                        <span className="text-gray-400">تأخيرات</span>
                                                                        <span className="font-semibold text-orange-600">{item.late_days}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* الخصومات والإضافات */}
                                                        <div>
                                                            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">الخصومات والإضافات</p>
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                                                                <div className="flex justify-between sm:flex-col sm:items-center">
                                                                    <span className="text-gray-400">خصم غياب</span>
                                                                    <span className={`font-semibold ${item.absence_deduction > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                                        {item.absence_deduction > 0 ? `-${formatCurrency(item.absence_deduction)}` : '0'}
                                                                    </span>
                                                                </div>
                                                                {(item.late_penalty_amount || 0) > 0 && (
                                                                    <div className="flex justify-between sm:flex-col sm:items-center">
                                                                        <span className="text-gray-400">جزاء تأخير</span>
                                                                        <span className="font-semibold text-orange-600">
                                                                            -{formatCurrency(item.late_penalty_amount)} <span className="text-[10px] text-gray-400">({item.late_penalty_days} يوم)</span>
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <div className="flex justify-between sm:flex-col sm:items-center">
                                                                    <span className="text-gray-400">خصومات يدوية</span>
                                                                    <span className={`font-semibold ${item.manual_deductions > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                                                                        {item.manual_deductions > 0 ? `-${formatCurrency(item.manual_deductions)}` : '0'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between sm:flex-col sm:items-center">
                                                                    <span className="text-gray-400">جزاءات يدوية</span>
                                                                    <span className={`font-semibold ${item.manual_penalties > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                                                                        {item.manual_penalties > 0 ? `-${formatCurrency(item.manual_penalties)}` : '0'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between sm:flex-col sm:items-center">
                                                                    <span className="text-gray-400">حافز محسوب</span>
                                                                    <span className={`font-semibold ${item.calculated_bonus > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                                                                        {item.calculated_bonus > 0 ? `+${formatCurrency(item.calculated_bonus)}` : '0'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between sm:flex-col sm:items-center">
                                                                    <span className="text-gray-400">مكافآت</span>
                                                                    <span className={`font-semibold ${item.manual_bonuses > 0 ? 'text-teal-600' : 'text-gray-400'}`}>
                                                                        {item.manual_bonuses > 0 ? `+${formatCurrency(item.manual_bonuses)}` : '0'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between sm:flex-col sm:items-center">
                                                                    <span className="text-gray-400">سلف</span>
                                                                    <span className={`font-semibold ${item.advance_deduction > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                                                        {item.advance_deduction > 0 ? `-${formatCurrency(item.advance_deduction)}` : '0'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </>
                            )}
                        </div>

                        {/* ═══════ Disbursement History ═══════ */}
                        {(canDisburse(selectedPeriod) || selectedPeriod.status === 'paid') && (
                            <div className="flex-shrink-0 border-t border-gray-100">
                                <button
                                    onClick={() => handleLoadDisbursements(selectedPeriod.id)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                                >
                                    {showDisbursements ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    سجل الصرف ({(selectedPeriod.total_disbursed || 0) > 0 ? 'مصروف' : 'لم يُصرف بعد'})
                                </button>

                                {showDisbursements && (
                                    <div className="px-4 sm:px-5 pb-3">
                                        {loadingDisbursements ? (
                                            <div className="flex justify-center py-3">
                                                <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                                            </div>
                                        ) : disbursements.length === 0 ? (
                                            <p className="text-center text-xs text-gray-400 py-3">لا توجد دفعات صرف بعد</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {disbursements.map((d) => (
                                                    <div key={d.id} className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-2 text-xs">
                                                        <div>
                                                            <span className="font-semibold text-purple-800">{formatCurrency(d.amount)}</span>
                                                            <span className="text-gray-500 mx-1.5">من</span>
                                                            <span className="text-gray-700">{(d.vault as any)?.name || 'خزنة محذوفة'}</span>
                                                        </div>
                                                        <span className="text-[10px] text-gray-400">
                                                            {formatDateTime(d.created_at)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ═══════ Footer Actions ═══════ */}
                        <div className="flex-shrink-0 border-t border-gray-200">
                            {/* Selection Bar */}
                            {canDisburse(selectedPeriod) && selectedWorkerIds.size > 0 && (
                                <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-purple-50 border-b border-purple-100">
                                    <div className="text-xs text-purple-800">
                                        <span className="font-bold">{selectedWorkerIds.size}</span> عامل — <span className="font-bold">{formatCurrency(selectedTotal)}</span>
                                    </div>
                                    <button
                                        onClick={() => handleOpenIndividualDisburse()}
                                        className="bg-purple-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors flex items-center gap-1.5"
                                    >
                                        <Wallet className="w-3.5 h-3.5" />
                                        صرف المحدّدين
                                    </button>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2 p-4 sm:p-5">
                                {selectedPeriod.status === 'calculated' && (
                                    <button
                                        onClick={() => handleApprove(selectedPeriod)}
                                        disabled={approving}
                                        className="flex-1 min-w-[140px] bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {approving && <Loader2 className="w-4 h-4 animate-spin" />}
                                        <CheckCircle2 className="w-4 h-4" />
                                        اعتماد المسير
                                    </button>
                                )}
                                {canDisburse(selectedPeriod) && unpaidItems.length > 0 && (
                                    <button
                                        onClick={() => {
                                            const allUnpaid = new Set(unpaidItems.map(i => i.worker_id))
                                            handleOpenIndividualDisburse(allUnpaid)
                                        }}
                                        className="flex-1 min-w-[140px] bg-purple-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Users className="w-4 h-4" />
                                        صرف الكل ({unpaidItems.length})
                                    </button>
                                )}
                                {canDisburse(selectedPeriod) && (
                                    <button
                                        onClick={() => handleOpenDisburse(selectedPeriod)}
                                        className="flex-none border border-gray-300 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Wallet className="w-4 h-4" />
                                        <span className="hidden sm:inline">صرف مبلغ من الخزنة</span>
                                        <span className="sm:hidden">صرف مبلغ</span>
                                    </button>
                                )}
                            </div>
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

