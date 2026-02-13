// InvoicesTab - تبويب الفواتير في النظام المالي الإداري
import React, { useState, useEffect, useCallback } from 'react'
import {
    Search, Filter, Eye, XCircle, FileText,
    ChevronDown, ChevronLeft, ChevronRight, Loader2,
    Clock, CheckCircle, Ban, RefreshCw, Plus, Pencil, Banknote
} from 'lucide-react'
import { InvoicesAPI } from '../../api/invoices'
import { InvoiceWithDetails, InvoiceFilters } from '../../types'
import { getStatusColor, getStatusText, getPaymentMethodLabel } from '../../api'
import InvoiceDetailsModal from './InvoiceDetailsModal'
import InvoiceFormModal from './InvoiceFormModal'
import InvoiceCollectModal from './InvoiceCollectModal'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

const InvoicesTab: React.FC = () => {
    const { user } = useAuth()
    const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('')
    const [paymentFilter, setPaymentFilter] = useState<string>('')
    const [showFilters, setShowFilters] = useState(false)
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

    const fetchInvoices = useCallback(async () => {
        setLoading(true)
        try {
            const filters: InvoiceFilters = {}
            if (statusFilter) filters.status = [statusFilter]
            if (paymentFilter) filters.payment_method = paymentFilter as any
            if (searchTerm.trim()) filters.search = searchTerm.trim()

            const result = await InvoicesAPI.getInvoices(filters, page, pageSize)
            if (result.data) {
                setInvoices(result.data)
                setTotalCount(result.total || 0)
            }
        } catch (err) {
            console.error('Error fetching invoices:', err)
            toast.error('خطأ في جلب الفواتير')
        } finally {
            setLoading(false)
        }
    }, [page, statusFilter, paymentFilter, searchTerm])

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

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="بحث برقم الفاتورة أو اسم العميل..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
                        className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                    />
                </div>

                {/* Filter Toggle */}
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                >
                    <Filter className="w-4 h-4" />
                    فلتر
                    <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>

                {/* Refresh */}
                <button
                    onClick={() => { fetchInvoices(); fetchStats() }}
                    className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                    <RefreshCw className="w-4 h-4 text-gray-600" />
                </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 animate-fade-in">
                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">الحالة</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                            className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm"
                        >
                            <option value="">الكل</option>
                            <option value="draft">مسودة</option>
                            <option value="pending">معلّقة</option>
                            <option value="paid">مدفوعة</option>
                            <option value="confirmed">مؤكدة</option>
                            <option value="cancelled">ملغاة</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">طريقة الدفع</label>
                        <select
                            value={paymentFilter}
                            onChange={(e) => { setPaymentFilter(e.target.value); setPage(1) }}
                            className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm"
                        >
                            <option value="">الكل</option>
                            <option value="cash">نقدي</option>
                            <option value="instapay">Instapay</option>
                            <option value="bank_transfer">تحويل بنكي</option>
                        </select>
                    </div>
                </div>
            )}

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
                                        <td className="px-4 py-3 font-semibold text-gray-800">
                                            {inv.total_amount?.toLocaleString('ar-EG')} ج.م
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
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
                                onClick={() => setSelectedInvoice(inv)}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-bold text-gray-800">
                                        {inv.invoice_number || '-'}
                                    </span>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(inv.status)}`}>
                                        {getStatusText(inv.status)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">{(inv as any).customer?.name || '-'}</span>
                                    <span className="font-bold text-gray-800">
                                        {inv.total_amount?.toLocaleString('ar-EG')} ج.م
                                    </span>
                                </div>
                                <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                                    <span>{getPaymentMethodLabel(inv.payment_method)}</span>
                                    <span>{formatDate(inv.created_at)}</span>
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
