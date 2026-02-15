// PaymentsTab - تبويب المدفوعات المعلقة (instapay/bank)
// الأدمن يراجع إثبات الدفع ويؤكد مع تحديد الخزنة / يرفض
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
    CheckCircle, XCircle, Loader2,
    ImageIcon, ExternalLink, RefreshCw, CreditCard, AlertTriangle,
    Landmark
} from 'lucide-react'
import { InvoicesAPI } from '../../api/invoices'
import { VaultsAPI } from '../../api/vaults'
import { InvoiceWithDetails, Vault } from '../../types'
import { getStatusColor, getStatusText } from '../../api'
import PaymentsFilterBar, { PaymentsFiltersUI } from './PaymentsFilterBar'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'

const PaymentsTab: React.FC = () => {
    const { user } = useAuth()
    const [payments, setPayments] = useState<InvoiceWithDetails[]>([])
    const [loading, setLoading] = useState(true)
    const [filters, setFilters] = useState<PaymentsFiltersUI>({
        status: ['pending', 'partially_paid'],
        paymentMethod: [],
        dateFrom: '',
        dateTo: '',
        teamId: '',
        search: ''
    })
    const [selectedProof, setSelectedProof] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // حالة اختيار الخزنة للتأكيد
    const [confirmingId, setConfirmingId] = useState<string | null>(null)
    const [vaults, setVaults] = useState<Vault[]>([])
    const [selectedVault, setSelectedVault] = useState<string>('')
    const [vaultsLoading, setVaultsLoading] = useState(false)

    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [debouncedSearch, setDebouncedSearch] = useState('')

    const handleFiltersChange = (changes: Partial<PaymentsFiltersUI>) => {
        if ('search' in changes) {
            setFilters(prev => ({ ...prev, search: changes.search || '' }))
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
            searchTimerRef.current = setTimeout(() => {
                setDebouncedSearch(changes.search || '')
            }, 500)
        } else {
            setFilters(prev => ({ ...prev, ...changes }))
        }
    }

    const fetchPayments = useCallback(async () => {
        setLoading(true)
        try {
            // تحديد الحالات المطلوبة حسب الفلتر
            const statuses = filters.status.length > 0
                ? filters.status
                : ['pending', 'partially_paid', 'paid', 'cancelled']

            const apiFilters: any = { status: statuses }
            if (filters.dateFrom) apiFilters.date_from = filters.dateFrom
            if (filters.dateTo) apiFilters.date_to = filters.dateTo
            if (debouncedSearch.trim()) apiFilters.search = debouncedSearch.trim()
            if (filters.teamId) apiFilters.team_id = filters.teamId

            const result = await InvoicesAPI.getInvoices(apiFilters, 1, 200)

            // فلتر: instapay + bank_transfer فقط + pending يجب أن يكون له proof
            let filtered = (result.data || []).filter(inv => {
                // فلتر طريقة الدفع الإلكترونية
                const isElectronic = inv.payment_method === 'instapay' || inv.payment_method === 'bank_transfer'
                if (!isElectronic) return false

                // فلتر طريقة الدفع المحددة من المستخدم
                if (filters.paymentMethod.length > 0 && !filters.paymentMethod.includes(inv.payment_method || '')) return false

                // pending يجب أن يكون له proof
                if (inv.status === 'pending' && !inv.payment_proof_url) return false

                return true
            })

            setPayments(filtered)
        } catch (err) {
            console.error('Error fetching payments:', err)
            toast.error('خطأ في جلب المدفوعات')
        } finally {
            setLoading(false)
        }
    }, [filters.status, filters.paymentMethod, filters.dateFrom, filters.dateTo, filters.teamId, debouncedSearch])

    useEffect(() => {
        fetchPayments()
    }, [fetchPayments])

    // جلب الخزائن النشطة عند فتح modal التأكيد
    const openConfirmDialog = async (invoiceId: string) => {
        setConfirmingId(invoiceId)
        setSelectedVault('')
        setVaultsLoading(true)
        try {
            const v = await VaultsAPI.getVaults(true)
            setVaults(v)
            if (v.length === 1) setSelectedVault(v[0].id)
        } catch {
            toast.error('خطأ في جلب الخزائن')
        } finally {
            setVaultsLoading(false)
        }
    }

    const handleConfirm = async () => {
        if (!confirmingId || !selectedVault || !user?.id) return
        setActionLoading(confirmingId)
        try {
            // استدعاء collectAdmin → يضيف المبلغ للخزنة المحددة
            const payment = payments.find(p => p.id === confirmingId)
            const result = await InvoicesAPI.collectAdmin(
                confirmingId,
                selectedVault,
                (payment?.payment_method || 'instapay') as 'instapay' | 'bank_transfer',
                payment?.payment_proof_url || '',
                user.id
            )
            if (result.success) {
                toast.success('تم تأكيد الدفع وإضافة المبلغ للخزنة')
                setConfirmingId(null)
                fetchPayments()
            } else {
                toast.error(result.error || 'حدث خطأ في التأكيد')
            }
        } catch {
            toast.error('حدث خطأ')
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async (invoiceId: string) => {
        if (!confirm('هل أنت متأكد من رفض هذا الدفع؟')) return
        setActionLoading(invoiceId)
        try {
            const result = await InvoicesAPI.cancelInvoice(invoiceId, 'رفض إثبات الدفع من الإدارة', user?.id || '')
            if (result.success) {
                toast.success('تم رفض الدفع')
                fetchPayments()
            } else {
                toast.error(result.error || 'حدث خطأ')
            }
        } catch {
            toast.error('حدث خطأ')
        } finally {
            setActionLoading(null)
        }
    }

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('ar-EG', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })
    }

    const pendingCount = payments.filter(p => p.status === 'pending' && p.payment_proof_url).length

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header Stats */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {pendingCount > 0 && (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-700">
                                {pendingCount} مدفوعات في انتظار المراجعة
                            </span>
                        </div>
                    )}
                    <button
                        onClick={fetchPayments}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-600"
                    >
                        <RefreshCw className="w-4 h-4" />
                        تحديث
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <PaymentsFilterBar filters={filters} onFiltersChange={handleFiltersChange} />

            {/* Payments List */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
            ) : payments.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                    <CreditCard className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="font-medium">لا توجد مدفوعات</p>
                    <p className="text-sm mt-1">ستظهر هنا مدفوعات Instapay والتحويلات البنكية</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {payments.map((payment) => (
                        <div
                            key={payment.id}
                            className={`bg-white rounded-xl border p-4 sm:p-5 transition-all hover:shadow-md ${payment.status === 'pending'
                                ? 'border-amber-200 bg-amber-50/30'
                                : 'border-gray-200'
                                }`}
                        >
                            {/* Row 1: Invoice # + Status + Payment Method */}
                            <div className="flex items-center gap-3 flex-wrap mb-3">
                                <span className="text-sm font-bold text-gray-800">
                                    {payment.invoice_number || '-'}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                                    {payment.status === 'pending' ? 'بانتظار المراجعة' : getStatusText(payment.status)}
                                </span>
                                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                    {payment.payment_method === 'instapay' ? 'Instapay' : 'تحويل بنكي'}
                                </span>
                            </div>

                            {/* Row 2: Rich Info Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                                {/* Customer */}
                                <div className="min-w-0">
                                    <div className="text-xs text-gray-400 mb-0.5">العميل</div>
                                    <div className="text-sm font-medium text-gray-800 truncate">
                                        {(payment as any).customer?.name || '-'}
                                    </div>
                                </div>

                                {/* Amount */}
                                <div className="min-w-0">
                                    <div className="text-xs text-gray-400 mb-0.5">المبلغ</div>
                                    <div className="text-sm font-bold text-gray-800">
                                        {payment.total_amount?.toLocaleString('ar-EG')} ج.م
                                    </div>
                                </div>

                                {/* Team */}
                                <div className="min-w-0">
                                    <div className="text-xs text-gray-400 mb-0.5">الفريق</div>
                                    <div className="text-sm text-gray-700 truncate">
                                        {(payment as any).team?.name || '-'}
                                    </div>
                                </div>

                                {/* Order # */}
                                <div className="min-w-0">
                                    <div className="text-xs text-gray-400 mb-0.5">رقم الطلب</div>
                                    <div className="text-sm text-gray-700 truncate">
                                        {(payment as any).order?.order_number || '-'}
                                    </div>
                                </div>
                            </div>

                            {/* Row 3: Collector + Date */}
                            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mb-3">
                                {(payment as any).collected_by_user?.full_name && (
                                    <span className="flex items-center gap-1">
                                        <CreditCard className="w-3 h-3" />
                                        محصّل: <span className="text-gray-600 font-medium">{(payment as any).collected_by_user.full_name}</span>
                                    </span>
                                )}
                                <span>{formatDate(payment.created_at)}</span>
                                {payment.collected_at && (
                                    <span>تحصيل: {formatDate(payment.collected_at)}</span>
                                )}
                            </div>

                            {/* Row 4: Actions */}
                            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                                {/* View Proof */}
                                {payment.payment_proof_url && (
                                    <button
                                        onClick={() => setSelectedProof(payment.payment_proof_url)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors"
                                    >
                                        <ImageIcon className="w-3.5 h-3.5" />
                                        الإثبات
                                    </button>
                                )}

                                {payment.status === 'pending' && payment.payment_proof_url && (
                                    <>
                                        <button
                                            onClick={() => openConfirmDialog(payment.id)}
                                            disabled={actionLoading === payment.id}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                                        >
                                            {actionLoading === payment.id ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <CheckCircle className="w-3.5 h-3.5" />
                                            )}
                                            تأكيد
                                        </button>
                                        <button
                                            onClick={() => handleReject(payment.id)}
                                            disabled={actionLoading === payment.id}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                                        >
                                            <XCircle className="w-3.5 h-3.5" />
                                            رفض
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Vault Selection Modal for Confirm */}
            {confirmingId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={() => setConfirmingId(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                                    <Landmark className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800">تأكيد الدفع</h3>
                                    <p className="text-xs text-gray-500">اختر الخزنة لإيداع المبلغ</p>
                                </div>
                            </div>
                            <button onClick={() => setConfirmingId(null)}
                                className="p-2 hover:bg-gray-100 rounded-full">
                                <XCircle className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Payment Info */}
                            {(() => {
                                const p = payments.find(pp => pp.id === confirmingId)
                                if (!p) return null
                                return (
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600">{p.invoice_number}</span>
                                            <span className="font-bold text-gray-800">
                                                {p.total_amount?.toLocaleString('ar-EG')} ج.م
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {p.payment_method === 'instapay' ? 'Instapay' : 'تحويل بنكي'}
                                        </p>
                                    </div>
                                )
                            })()}

                            {/* Vault Selection */}
                            {vaultsLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">الخزنة:</label>
                                    <select
                                        value={selectedVault}
                                        onChange={(e) => setSelectedVault(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                    >
                                        <option value="">اختر الخزنة...</option>
                                        {vaults.map(v => (
                                            <option key={v.id} value={v.id}>
                                                {v.name_ar} — رصيد: {v.balance?.toLocaleString('ar-EG')} ج.م
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 p-5 border-t">
                            <button
                                onClick={() => setConfirmingId(null)}
                                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={!selectedVault || actionLoading === confirmingId}
                                className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {actionLoading === confirmingId ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle className="w-4 h-4" />
                                        تأكيد الدفع
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Proof Image Modal */}
            {selectedProof && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedProof(null)}>
                    <div className="bg-white rounded-2xl overflow-hidden max-w-lg w-full max-h-[80vh] relative"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="font-bold text-gray-800">إثبات الدفع</h3>
                            <button
                                onClick={() => setSelectedProof(null)}
                                className="p-1 hover:bg-gray-100 rounded-full"
                            >
                                <XCircle className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-4 flex items-center justify-center">
                            <img
                                src={selectedProof}
                                alt="إثبات الدفع"
                                className="max-w-full max-h-[60vh] rounded-lg object-contain"
                            />
                        </div>
                        <div className="p-4 border-t">
                            <a
                                href={selectedProof}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" />
                                فتح في نافذة جديدة
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default PaymentsTab
