// InvoicesTab - تبويب الفواتير في النظام المالي الإداري
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
    Eye, XCircle, FileText,
    ChevronLeft, ChevronRight, Loader2,
    Clock, CheckCircle, Ban, RefreshCw, Plus, Pencil, Banknote
} from 'lucide-react'
import { InvoicesAPI } from '../../api/invoices'
import { InvoiceWithDetails, InvoiceFilters } from '../../types'
import { getStatusColor, getStatusText, getPaymentMethodLabel } from '../../api'
import InvoiceDetailsModal from './InvoiceDetailsModal'
import InvoiceFormModal from './InvoiceFormModal'
import InvoiceCollectModal from './InvoiceCollectModal'
import InvoicesFilterBar, { InvoicesFiltersUI } from './InvoicesFilterBar'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

const InvoicesTab: React.FC = () => {
    const { user } = useAuth()
    const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [filters, setFilters] = useState<InvoicesFiltersUI>({
        status: [], paymentMethod: [], dateFrom: '', dateTo: '', teamId: '', search: ''
    })
    const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithDetails | null>(null)
    const [stats, setStats] = useState<{
        total: number; paid: number; pending: number; cancelled: number
    }>({ total: 0, paid: 0, pending: 0, cancelled: 0 })
    const [cancelModal, setCancelModal] = useState<{ id: string; status: string } | null>(null)
    const [cancelReason, setCancelReason] = useState('')
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [editingInvoice, setEditingInvoice] = useState<InvoiceWithDetails | null>(null)
    const [collectingInvoice, setCollectingInvoice] = useState<InvoiceWithDetails | null>(null)

    const pageSize = 20
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [debouncedSearch, setDebouncedSearch] = useState('')

    const handleFiltersChange = (changes: Partial<InvoicesFiltersUI>) => {
        // Debounce search, apply other filters immediately
        if ('search' in changes) {
            setFilters(prev => ({ ...prev, search: changes.search || '' }))
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
            searchTimerRef.current = setTimeout(() => {
                setDebouncedSearch(changes.search || '')
                setPage(1)
            }, 500)
        } else {
            setFilters(prev => ({ ...prev, ...changes }))
            setPage(1)
        }
    }

    const fetchInvoices = useCallback(async () => {
        setLoading(true)
        try {
            const apiFilters: InvoiceFilters = {}
            if (filters.status.length > 0) apiFilters.status = filters.status
            if (filters.paymentMethod.length === 1) apiFilters.payment_method = filters.paymentMethod[0] as any
            if (debouncedSearch.trim()) apiFilters.search = debouncedSearch.trim()
            if (filters.dateFrom) apiFilters.date_from = filters.dateFrom
            if (filters.dateTo) apiFilters.date_to = filters.dateTo
            if (filters.teamId) apiFilters.team_id = filters.teamId

            const result = await InvoicesAPI.getInvoices(apiFilters, page, pageSize)
            if (result.data) {
                // client-side filter for multiple payment methods
                let data = result.data
                if (filters.paymentMethod.length > 1) {
                    data = data.filter(inv => filters.paymentMethod.includes(inv.payment_method || ''))
                }
                setInvoices(data)
                setTotalCount(filters.paymentMethod.length > 1 ? data.length : (result.total || 0))
            }
        } catch (err) {
            console.error('Error fetching invoices:', err)
            toast.error('خطأ في جلب الفواتير')
        } finally {
            setLoading(false)
        }
    }, [page, filters.status, filters.paymentMethod, filters.dateFrom, filters.dateTo, filters.teamId, debouncedSearch])

    const fetchStats = useCallback(async () => {
        try {
            const result = await InvoicesAPI.getInvoiceStats()
            setStats({
                total: result.total_invoices || 0,
                paid: result.paid_invoices || 0,
                pending: result.pending_invoices || 0,
                cancelled: result.cancelled_invoices || 0
            })
        } catch (err) {
            console.error('Error fetching stats:', err)
        }
    }, [])

    useEffect(() => {
        fetchInvoices()
    }, [fetchInvoices])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    const handleCancel = async (invoiceId: string) => {
        const inv = invoices.find(i => i.id === invoiceId)
        if (!inv) return

        // draft/pending → confirm بسيط بدون عكس أرصدة
        if (inv.status === 'pending' || inv.status === 'draft') {
            if (!confirm('هل أنت متأكد من إلغاء هذه الفاتورة؟')) return
            try {
                const result = await InvoicesAPI.cancelInvoice(invoiceId, 'إلغاء يدوي', user?.id || '')
                if (result.success) {
                    toast.success('تم إلغاء الفاتورة')
                    fetchInvoices(); fetchStats()
                } else {
                    toast.error(result.error || 'حدث خطأ')
                }
            } catch {
                toast.error('حدث خطأ في إلغاء الفاتورة')
            }
            return
        }

        // paid/confirmed/partially_paid → فتح modal التأكيد مع سبب إلزامي
        setCancelModal({ id: invoiceId, status: inv.status })
        setCancelReason('')
    }

    const handleConfirmCancel = async () => {
        if (!cancelModal || !cancelReason.trim()) {
            toast.error('يرجى كتابة سبب الإلغاء')
            return
        }
        try {
            const result = await InvoicesAPI.cancelInvoice(cancelModal.id, cancelReason.trim(), user?.id || '')
            if (result.success) {
                toast.success(result.message || 'تم إلغاء الفاتورة وعكس الأرصدة')
                setCancelModal(null)
                fetchInvoices(); fetchStats()
            } else {
                toast.error(result.error || 'حدث خطأ')
            }
        } catch {
            toast.error('حدث خطأ في إلغاء الفاتورة')
        }
    }

    const totalPages = Math.ceil(totalCount / pageSize)

    const filteredInvoices = invoices

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('ar-EG', {
            year: 'numeric', month: 'short', day: 'numeric'
        })
    }



    const handleFormSuccess = () => {
        setShowCreateForm(false)
        setEditingInvoice(null)
        fetchInvoices(); fetchStats()
    }

    const handleCollectSuccess = () => {
        setCollectingInvoice(null)
        fetchInvoices(); fetchStats()
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Create Invoice Button */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">الفواتير</h3>
                <button
                    onClick={() => setShowCreateForm(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    إنشاء فاتورة يدوية
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                    { label: 'إجمالي الفواتير', value: stats.total, icon: FileText, bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
                    { label: 'محصّلة', value: stats.paid, icon: CheckCircle, bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-100' },
                    { label: 'معلّقة', value: stats.pending, icon: Clock, bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
                    { label: 'ملغاة', value: stats.cancelled, icon: Ban, bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
                ].map((stat) => {
                    const Icon = stat.icon
                    return (
                        <div key={stat.label} className={`${stat.bg} rounded-xl p-3 sm:p-4 border ${stat.border}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.text}`} />
                                <span className="text-xs sm:text-sm text-gray-600">{stat.label}</span>
                            </div>
                            <p className={`text-xl sm:text-2xl font-bold ${stat.text}`}>{stat.value}</p>
                        </div>
                    )
                })}
            </div>

            {/* Filter Bar */}
            <InvoicesFilterBar filters={filters} onFiltersChange={handleFiltersChange} />

            {/* Refresh */}
            <div className="flex justify-end">
                <button
                    onClick={() => { fetchInvoices(); fetchStats() }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-600"
                >
                    <RefreshCw className="w-4 h-4" />
                    تحديث
                </button>
            </div>

            {/* Invoices Table / Cards */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="font-medium">لا توجد فواتير</p>
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-600">رقم الفاتورة</th>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-600">العميل</th>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-600">الفريق</th>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-600">الطلب</th>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-600">المبلغ</th>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-600">طريقة الدفع</th>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-600">الحالة</th>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-600">التاريخ</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredInvoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-800">
                                            {inv.invoice_number || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {(inv as any).customer?.name || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {(inv as any).team?.name || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {(inv as any).order?.order_number || '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-gray-800">
                                                {inv.total_amount?.toLocaleString('ar-EG')} ج.م
                                            </div>
                                            {inv.paid_amount > 0 && inv.paid_amount < inv.total_amount && (
                                                <div className="text-xs text-emerald-600">
                                                    مدفوع: {inv.paid_amount?.toLocaleString('ar-EG')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 text-xs">
                                            {getPaymentMethodLabel(inv.payment_method)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(inv.status)}`}>
                                                {getStatusText(inv.status)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {formatDate(inv.created_at)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => setSelectedInvoice(inv)}
                                                    className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                                                    title="عرض التفاصيل"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {['draft', 'pending'].includes(inv.status) && (
                                                    <button
                                                        onClick={() => setEditingInvoice(inv)}
                                                        className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"
                                                        title="تعديل"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {['pending', 'partially_paid'].includes(inv.status) && (
                                                    <button
                                                        onClick={() => setCollectingInvoice(inv)}
                                                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                                                        title="تحصيل"
                                                    >
                                                        <Banknote className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {['paid', 'pending', 'confirmed', 'partially_paid'].includes(inv.status) && (
                                                    <button
                                                        onClick={() => handleCancel(inv.id)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                                                        title="إلغاء"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                        {filteredInvoices.map((inv) => (
                            <div
                                key={inv.id}
                                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                            >
                                {/* Row 1: Invoice # + Status */}
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold text-gray-800">
                                        {inv.invoice_number || '-'}
                                    </span>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(inv.status)}`}>
                                        {getStatusText(inv.status)}
                                    </span>
                                </div>

                                {/* Row 2: Customer + Amount */}
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-gray-600">{(inv as any).customer?.name || '-'}</span>
                                    <div className="text-left">
                                        <span className="font-bold text-gray-800">
                                            {inv.total_amount?.toLocaleString('ar-EG')} ج.م
                                        </span>
                                        {inv.paid_amount > 0 && inv.paid_amount < inv.total_amount && (
                                            <div className="text-xs text-emerald-600">
                                                مدفوع: {inv.paid_amount?.toLocaleString('ar-EG')}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Row 3: Team + Order + Payment + Date */}
                                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400 mb-3">
                                    {(inv as any).team?.name && (
                                        <span>🏠 {(inv as any).team.name}</span>
                                    )}
                                    {(inv as any).order?.order_number && (
                                        <span>📋 {(inv as any).order.order_number}</span>
                                    )}
                                    <span>{getPaymentMethodLabel(inv.payment_method)}</span>
                                    <span>{formatDate(inv.created_at)}</span>
                                </div>

                                {/* Row 4: Action Buttons */}
                                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                    <button
                                        onClick={() => setSelectedInvoice(inv)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-colors"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        عرض
                                    </button>
                                    {['draft', 'pending'].includes(inv.status) && (
                                        <button
                                            onClick={() => setEditingInvoice(inv)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-50 text-amber-600 text-xs font-medium hover:bg-amber-100 transition-colors"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                            تعديل
                                        </button>
                                    )}
                                    {['pending', 'partially_paid'].includes(inv.status) && (
                                        <button
                                            onClick={() => setCollectingInvoice(inv)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 transition-colors"
                                        >
                                            <Banknote className="w-3.5 h-3.5" />
                                            تحصيل
                                        </button>
                                    )}
                                    {['paid', 'pending', 'confirmed', 'partially_paid'].includes(inv.status) && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleCancel(inv.id) }}
                                            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-red-50 text-red-500 text-xs font-medium hover:bg-red-100 transition-colors"
                                        >
                                            <XCircle className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4">
                            <span className="text-sm text-gray-500">
                                صفحة {page} من {totalPages} ({totalCount} فاتورة)
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Invoice Details Modal */}
            {selectedInvoice && (
                <InvoiceDetailsModal
                    invoice={selectedInvoice}
                    onClose={() => setSelectedInvoice(null)}
                    onCancel={handleCancel}
                    onEdit={(inv) => { setSelectedInvoice(null); setEditingInvoice(inv) }}
                    onCollect={(inv) => { setSelectedInvoice(null); setCollectingInvoice(inv) }}
                />
            )}

            {/* Cancel Paid Invoice Modal */}
            {cancelModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCancelModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
                            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                                <XCircle className="w-5 h-5 text-red-600" />
                            </div>
                            <h3 className="font-bold text-red-600">إلغاء فاتورة محصّلة</h3>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                                <strong>⚠️ تحذير:</strong> هذه الفاتورة محصّلة بالفعل. الإلغاء سيؤدي إلى <strong>عكس الأرصدة</strong> (خصم المبلغ من العهدة أو الخزنة المرتبطة).
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">سبب الإلغاء (إلزامي)</label>
                                <textarea
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    placeholder="اكتب سبب إلغاء الفاتورة..."
                                    rows={3}
                                    className="w-full rounded-xl border border-gray-200 py-2.5 px-3 text-sm focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                        </div>
                        <div className="px-5 py-4 border-t border-gray-200 flex gap-3">
                            <button
                                onClick={() => setCancelModal(null)}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 text-sm transition-colors"
                            >
                                تراجع
                            </button>
                            <button
                                onClick={handleConfirmCancel}
                                disabled={!cancelReason.trim()}
                                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm disabled:opacity-50 transition-colors"
                            >
                                تأكيد الإلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create / Edit Invoice Modal */}
            {(showCreateForm || editingInvoice) && (
                <InvoiceFormModal
                    invoice={editingInvoice}
                    onClose={() => { setShowCreateForm(false); setEditingInvoice(null) }}
                    onSuccess={handleFormSuccess}
                />
            )}

            {/* Collect Invoice Modal */}
            {collectingInvoice && (
                <InvoiceCollectModal
                    invoice={collectingInvoice}
                    onClose={() => setCollectingInvoice(null)}
                    onSuccess={handleCollectSuccess}
                />
            )}
        </div>
    )
}

export default InvoicesTab
