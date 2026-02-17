// AdvancesTab — تبويب إدارة السلف (مع ربط الخزنة)
import React, { useState, useEffect, useCallback } from 'react'
import {
    Plus, RefreshCw, Loader2, Banknote,
    X, Eye, Ban, CheckCircle, Landmark,
} from 'lucide-react'
import { AdvancesAPI } from '../../api/hr'
import { VaultsAPI } from '../../api/vaults'
import type {
    SalaryAdvanceWithWorker,
    AdvanceInstallment,
    AdvanceType,
    AdvanceStatus,
} from '../../types/hr.types'
import type { Vault as VaultType } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'معلقة', color: 'text-orange-700', bg: 'bg-orange-100' },
    active: { label: 'نشطة', color: 'text-blue-700', bg: 'bg-blue-100' },
    completed: { label: 'مكتملة', color: 'text-green-700', bg: 'bg-green-100' },
    cancelled: { label: 'ملغاة', color: 'text-red-700', bg: 'bg-red-100' },
}

const typeLabels: Record<string, string> = {
    immediate: 'فورية',
    installment: 'بالتقسيط',
}

const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

const AdvancesTab: React.FC = () => {
    const { user } = useAuth()
    const [advances, setAdvances] = useState<SalaryAdvanceWithWorker[]>([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState<string>('')

    // التفاصيل
    const [selectedAdvance, setSelectedAdvance] = useState<SalaryAdvanceWithWorker | null>(null)
    const [installments, setInstallments] = useState<AdvanceInstallment[]>([])
    const [loadingInstallments, setLoadingInstallments] = useState(false)

    // نموذج الإضافة
    const [showAddModal, setShowAddModal] = useState(false)
    const [workers, setWorkers] = useState<{ id: string; name: string; salary: number | null }[]>([])
    const [submitting, setSubmitting] = useState(false)

    const [formWorkerId, setFormWorkerId] = useState('')
    const [formType, setFormType] = useState<AdvanceType>('installment' as AdvanceType)
    const [formAmount, setFormAmount] = useState('')
    const [formInstallments, setFormInstallments] = useState('1')
    const [formStartMonth, setFormStartMonth] = useState(new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2)
    const [formStartYear, setFormStartYear] = useState(new Date().getMonth() + 2 > 12 ? new Date().getFullYear() + 1 : new Date().getFullYear())
    const [formReason, setFormReason] = useState('')

    // اعتماد السلفة — اختيار الخزنة
    const [showVaultModal, setShowVaultModal] = useState(false)
    const [pendingAdvanceForVault, setPendingAdvanceForVault] = useState<SalaryAdvanceWithWorker | null>(null)
    const [vaults, setVaults] = useState<VaultType[]>([])
    const [vaultLoading, setVaultLoading] = useState(false)
    const [approving, setApproving] = useState(false)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const data = await AdvancesAPI.getAdvances({
                status: filterStatus ? [filterStatus as AdvanceStatus] : undefined,
            })
            setAdvances(data)
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ')
        } finally {
            setLoading(false)
        }
    }, [filterStatus])

    useEffect(() => {
        loadData()
    }, [loadData])

    useEffect(() => {
        const loadWorkers = async () => {
            const { data } = await supabase
                .from('workers')
                .select('id, name, salary')
                .eq('status', 'active')
                .order('name')
            setWorkers(data || [])
        }
        loadWorkers()
    }, [])

    const handleViewInstallments = async (advance: SalaryAdvanceWithWorker) => {
        setSelectedAdvance(advance)
        setLoadingInstallments(true)
        try {
            const data = await AdvancesAPI.getInstallments(advance.id)
            setInstallments(data)
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ')
        } finally {
            setLoadingInstallments(false)
        }
    }

    const handleCancel = async (id: string) => {
        if (!user?.id) return
        if (!confirm('هل تريد إلغاء هذه السلفة؟ سيتم استرداد المبلغ المتبقى إلى الخزنة.')) return
        const result = await AdvancesAPI.cancelAdvance(id, user.id)
        if (result.success) {
            const refund = result.data?.refund_amount || 0
            toast.success(
                refund > 0
                    ? `تم إلغاء السلفة واسترداد ${refund.toLocaleString()} ج.م إلى الخزنة`
                    : result.message || 'تم إلغاء السلفة'
            )
            loadData()
        } else {
            toast.error(result.error || 'حدث خطأ')
        }
    }

    // فتح modal اختيار الخزنة للاعتماد
    const handleApproveClick = async (advance: SalaryAdvanceWithWorker) => {
        setPendingAdvanceForVault(advance)
        setShowVaultModal(true)
        setVaultLoading(true)
        try {
            const vaultList = await VaultsAPI.getVaults(true)
            setVaults(vaultList)
        } catch {
            toast.error('تعذر جلب الخزائن')
            setShowVaultModal(false)
        } finally {
            setVaultLoading(false)
        }
    }

    // اعتماد السلفة من خزنة محددة
    const handleVaultApprove = async (vaultId: string) => {
        if (!pendingAdvanceForVault || !user?.id) return
        setApproving(true)
        try {
            const result = await AdvancesAPI.approveAdvance(
                pendingAdvanceForVault.id,
                vaultId,
                user.id
            )
            if (result.success) {
                toast.success(
                    `تم اعتماد السلفة وخصمها من الخزنة ✅\nالرصيد الجديد: ${result.data?.new_vault_balance?.toLocaleString()} ج.م`,
                    { duration: 4000 }
                )
                setShowVaultModal(false)
                setPendingAdvanceForVault(null)
                loadData()
            } else {
                toast.error(result.error || 'فشل اعتماد السلفة')
            }
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ')
        } finally {
            setApproving(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const totalAmount = parseFloat(formAmount)
        if (!formWorkerId || !totalAmount || totalAmount <= 0) {
            toast.error('تأكد من إدخال البيانات بشكل صحيح')
            return
        }

        const installmentsCount = formType === 'immediate' ? 1 : parseInt(formInstallments)
        const installmentAmount = totalAmount / installmentsCount

        setSubmitting(true)
        try {
            const result = await AdvancesAPI.createAdvance({
                worker_id: formWorkerId,
                advance_type: formType,
                total_amount: totalAmount,
                installments_count: installmentsCount,
                installment_amount: Math.round(installmentAmount * 100) / 100,
                remaining_amount: totalAmount,
                start_month: formType === 'immediate' ? new Date().getMonth() + 1 : formStartMonth,
                start_year: formType === 'immediate' ? new Date().getFullYear() : formStartYear,
                reason: formReason || undefined,
                created_by: user?.id,
            })

            if (result.success) {
                toast.success('تم إنشاء السلفة — في انتظار الاعتماد ⏳')
                setShowAddModal(false)
                resetForm()
                loadData()
            } else {
                toast.error(result.error || 'حدث خطأ')
            }
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ')
        } finally {
            setSubmitting(false)
        }
    }

    const resetForm = () => {
        setFormWorkerId('')
        setFormType('installment' as AdvanceType)
        setFormAmount('')
        setFormInstallments('1')
        setFormReason('')
    }

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

    // إحصائيات
    const pendingCount = advances.filter(a => a.status === 'pending').length
    const totalActive = advances.filter(a => a.status === 'active').reduce((s, a) => s + a.remaining_amount, 0)
    const activeCount = advances.filter(a => a.status === 'active').length

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex gap-3 items-center flex-wrap">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                    >
                        <option value="">كل الحالات</option>
                        <option value="pending">معلقة</option>
                        <option value="active">نشطة</option>
                        <option value="completed">مكتملة</option>
                        <option value="cancelled">ملغاة</option>
                    </select>
                    {pendingCount > 0 && (
                        <div className="text-sm text-orange-600 font-medium">
                            ⏳ {pendingCount} سلفة في انتظار الاعتماد
                        </div>
                    )}
                    {activeCount > 0 && (
                        <div className="text-sm text-gray-500">
                            <span className="font-semibold text-amber-600">{activeCount}</span> سلفة نشطة —
                            إجمالي متبقي: <span className="font-semibold text-amber-600">{formatCurrency(totalActive)}</span>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={loadData}
                        className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { resetForm(); setShowAddModal(true) }}
                        className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>سلفة جديدة</span>
                    </button>
                </div>
            </div>

            {/* Advances List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
            ) : advances.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <Banknote className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>لا توجد سلف مسجلة</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-right py-3 px-3 font-medium text-gray-600">العامل</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">النوع</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">المبلغ</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">المتبقي</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600 hidden sm:table-cell">الأقساط</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600 hidden md:table-cell">البداية</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">الحالة</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {advances.map((advance) => {
                                const statusDef = statusLabels[advance.status] || statusLabels.active
                                const progress = ((advance.total_amount - advance.remaining_amount) / advance.total_amount) * 100
                                return (
                                    <tr key={advance.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-3 px-3 font-medium text-gray-900">
                                            {(advance.worker as any)?.name || '—'}
                                        </td>
                                        <td className="py-3 px-3 text-center text-gray-600">
                                            {typeLabels[advance.advance_type] || advance.advance_type}
                                        </td>
                                        <td className="py-3 px-3 text-center font-semibold text-gray-900">
                                            {formatCurrency(advance.total_amount)}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`font-semibold ${advance.remaining_amount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                                    {formatCurrency(advance.remaining_amount)}
                                                </span>
                                                {advance.status === 'active' && (
                                                    <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1">
                                                        <div
                                                            className="h-full bg-amber-500 rounded-full"
                                                            style={{ width: `${Math.min(progress, 100)}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 text-center text-gray-600 hidden sm:table-cell">
                                            {advance.installments_count}
                                        </td>
                                        <td className="py-3 px-3 text-center text-gray-600 hidden md:table-cell">
                                            {months[advance.start_month - 1]} {advance.start_year}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusDef.bg} ${statusDef.color}`}>
                                                {statusDef.label}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {/* زر اعتماد — فقط للمعلقة */}
                                                {advance.status === 'pending' && (
                                                    <button
                                                        onClick={() => handleApproveClick(advance)}
                                                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                        title="اعتماد وصرف من الخزنة"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleViewInstallments(advance)}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="عرض الأقساط"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {(advance.status === 'active' || advance.status === 'pending') && (
                                                    <button
                                                        onClick={() => handleCancel(advance.id)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="إلغاء"
                                                    >
                                                        <Ban className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Advance Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900">سلفة جديدة</h3>
                            <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">العامل *</label>
                                <select
                                    value={formWorkerId}
                                    onChange={(e) => setFormWorkerId(e.target.value)}
                                    required
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500"
                                >
                                    <option value="">اختر العامل</option>
                                    {workers.map(w => (
                                        <option key={w.id} value={w.id}>{w.name} {w.salary ? `(${formatCurrency(w.salary)})` : ''}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">نوع السلفة</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setFormType('immediate' as AdvanceType); setFormInstallments('1') }}
                                        className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${formType === 'immediate'
                                            ? 'bg-amber-100 text-amber-700 border-amber-300'
                                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                            }`}
                                    >
                                        فورية
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormType('installment' as AdvanceType)}
                                        className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${formType === 'installment'
                                            ? 'bg-amber-100 text-amber-700 border-amber-300'
                                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                            }`}
                                    >
                                        بالتقسيط
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ *</label>
                                <input
                                    type="number"
                                    value={formAmount}
                                    onChange={(e) => setFormAmount(e.target.value)}
                                    min="1"
                                    step="0.01"
                                    required
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500"
                                    placeholder="0.00"
                                />
                            </div>

                            {formType === 'installment' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">عدد الأقساط</label>
                                        <input
                                            type="number"
                                            value={formInstallments}
                                            onChange={(e) => setFormInstallments(e.target.value)}
                                            min="1"
                                            max="24"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500"
                                        />
                                        {formAmount && parseInt(formInstallments) > 0 && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                قيمة القسط: <span className="font-semibold text-amber-600">
                                                    {formatCurrency(parseFloat(formAmount) / parseInt(formInstallments))}
                                                </span> شهرياً
                                            </p>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">شهر البداية</label>
                                            <select
                                                value={formStartMonth}
                                                onChange={(e) => setFormStartMonth(Number(e.target.value))}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500"
                                            >
                                                {months.map((m, i) => (
                                                    <option key={i + 1} value={i + 1}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">السنة</label>
                                            <select
                                                value={formStartYear}
                                                onChange={(e) => setFormStartYear(Number(e.target.value))}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500"
                                            >
                                                {[2024, 2025, 2026, 2027].map(y => (
                                                    <option key={y} value={y}>{y}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">السبب</label>
                                <textarea
                                    value={formReason}
                                    onChange={(e) => setFormReason(e.target.value)}
                                    rows={2}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 resize-none"
                                    placeholder="سبب السلفة (اختياري)..."
                                />
                            </div>

                            {/* ملاحظة: السلفة ستكون معلقة */}
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
                                ⏳ السلفة ستُنشأ بحالة <strong>معلقة</strong> — يجب اعتمادها وتحديد الخزنة قبل الصرف
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 bg-amber-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {submitting ? 'جارِ الإنشاء...' : 'إنشاء السلفة'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Vault Selection Modal — اختيار الخزنة للاعتماد */}
            {showVaultModal && pendingAdvanceForVault && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={() => { setShowVaultModal(false); setPendingAdvanceForVault(null) }}>
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">اعتماد وصرف السلفة</h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {(pendingAdvanceForVault.worker as any)?.name} — {formatCurrency(pendingAdvanceForVault.total_amount)} ج.م
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowVaultModal(false); setPendingAdvanceForVault(null) }}
                                className="p-1 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-5">
                            <p className="text-sm text-gray-600 mb-4">اختر الخزنة التى سيتم صرف السلفة منها:</p>

                            {vaultLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                                </div>
                            ) : vaults.length === 0 ? (
                                <p className="text-center py-6 text-gray-400">لا توجد خزائن نشطة</p>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {vaults.map((vault) => {
                                        const hasEnough = (vault.balance || 0) >= pendingAdvanceForVault.total_amount
                                        return (
                                            <button
                                                key={vault.id}
                                                onClick={() => hasEnough && handleVaultApprove(vault.id)}
                                                disabled={!hasEnough || approving}
                                                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${hasEnough
                                                    ? 'border-gray-200 hover:border-green-300 hover:bg-green-50 cursor-pointer'
                                                    : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3 text-right">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasEnough ? 'bg-green-100' : 'bg-gray-200'
                                                        }`}>
                                                        <Landmark className={`w-5 h-5 ${hasEnough ? 'text-green-600' : 'text-gray-400'}`} />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{vault.name_ar || vault.name}</p>
                                                        <p className="text-xs text-gray-500">
                                                            الرصيد: {formatCurrency(vault.balance || 0)} ج.م
                                                        </p>
                                                    </div>
                                                </div>
                                                {hasEnough ? (
                                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                                ) : (
                                                    <span className="text-xs text-red-500 font-medium flex-shrink-0">رصيد غير كافٍ</span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}

                            {approving && (
                                <div className="flex items-center justify-center gap-2 mt-4 text-amber-600">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm">جارى اعتماد السلفة...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Installments Modal */}
            {selectedAdvance && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAdvance(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">
                                    أقساط سلفة {(selectedAdvance.worker as any)?.name}
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    المبلغ: {formatCurrency(selectedAdvance.total_amount)} — المتبقي: {formatCurrency(selectedAdvance.remaining_amount)}
                                </p>
                            </div>
                            <button onClick={() => setSelectedAdvance(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-5">
                            {loadingInstallments ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                                </div>
                            ) : installments.length === 0 ? (
                                <p className="text-center py-6 text-gray-400">لا توجد أقساط</p>
                            ) : (
                                <div className="space-y-2 max-h-80 overflow-y-auto">
                                    {installments.map((inst, i) => {
                                        const isPaid = inst.status === 'deducted'
                                        const isSkipped = inst.status === 'skipped'
                                        return (
                                            <div
                                                key={inst.id}
                                                className={`flex items-center justify-between p-3 rounded-lg border ${isPaid ? 'bg-green-50 border-green-200' :
                                                    isSkipped ? 'bg-gray-50 border-gray-200' :
                                                        'bg-white border-gray-200'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isPaid ? 'bg-green-100 text-green-700' :
                                                        isSkipped ? 'bg-gray-200 text-gray-500' :
                                                            'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        {i + 1}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {months[inst.month - 1]} {inst.year}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {isPaid ? 'تم الخصم' : isSkipped ? 'تم التخطي' : 'معلق'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`font-semibold text-sm ${isPaid ? 'text-green-600' : 'text-amber-600'
                                                    }`}>
                                                    {formatCurrency(inst.amount)}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AdvancesTab
