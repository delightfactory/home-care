// InvoiceDetailsModal - عرض تفاصيل فاتورة
import React from 'react'
import { X, FileText, User, Calendar, CreditCard, Package, DollarSign, Pencil, Banknote } from 'lucide-react'
import { InvoiceWithDetails } from '../../types'
import { getStatusColor, getStatusText, getPaymentMethodLabel } from '../../api'

interface InvoiceDetailsModalProps {
    invoice: InvoiceWithDetails
    onClose: () => void
    onCancel: (id: string) => void
    onEdit?: (invoice: InvoiceWithDetails) => void
    onCollect?: (invoice: InvoiceWithDetails) => void
}

const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({
    invoice,
    onClose,
    onCancel,
    onEdit,
    onCollect
}) => {
    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('ar-EG', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })
    }



    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 rounded-t-2xl px-5 py-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800">تفاصيل الفاتورة</h3>
                            <p className="text-xs text-gray-500">{invoice.invoice_number}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5">
                    {/* Status & Amount */}
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                        <div>
                            <p className="text-xs text-gray-500 mb-1">الحالة</p>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
                                {getStatusText(invoice.status)}
                            </span>
                        </div>
                        <div className="text-left">
                            <p className="text-xs text-gray-500 mb-1">المبلغ الإجمالي</p>
                            <p className="text-2xl font-bold text-gray-800">
                                {invoice.total_amount?.toLocaleString('ar-EG')} <span className="text-sm text-gray-500">ج.م</span>
                            </p>
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <InfoItem
                            icon={User}
                            label="العميل"
                            value={(invoice as any).customer?.name || '-'}
                        />
                        <InfoItem
                            icon={CreditCard}
                            label="طريقة الدفع"
                            value={getPaymentMethodLabel(invoice.payment_method, true)}
                        />
                        <InfoItem
                            icon={Calendar}
                            label="تاريخ الإنشاء"
                            value={formatDate(invoice.created_at)}
                        />
                        <InfoItem
                            icon={DollarSign}
                            label="الخصم"
                            value={invoice.discount ? `${invoice.discount.toLocaleString('ar-EG')} ج.م` : 'لا يوجد'}
                        />
                    </div>

                    {/* Items */}
                    {(invoice as any).items && (invoice as any).items.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Package className="w-4 h-4" />
                                بنود الفاتورة
                            </h4>
                            <div className="space-y-2">
                                {(invoice as any).items.map((item: any, index: number) => (
                                    <div key={item.id || index} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">
                                                {item.service?.name_ar || item.service?.name || item.description || 'بند'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {item.quantity} × {item.unit_price?.toLocaleString('ar-EG')} ج.م
                                            </p>
                                        </div>
                                        <span className="text-sm font-bold text-gray-800">
                                            {item.total_price?.toLocaleString('ar-EG') || (item.quantity * item.unit_price)?.toLocaleString('ar-EG')} ج.م
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Payment Proof */}
                    {invoice.payment_proof_url && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">إثبات الدفع</h4>
                            <img
                                src={invoice.payment_proof_url}
                                alt="إثبات الدفع"
                                className="w-full max-h-48 object-contain rounded-xl border border-gray-200 bg-gray-50"
                            />
                        </div>
                    )}

                    {/* Notes */}
                    {invoice.notes && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                            <p className="text-xs font-medium text-yellow-700 mb-1">ملاحظات</p>
                            <p className="text-sm text-yellow-800">{invoice.notes}</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                {/* Action Buttons */}
                {(invoice.status !== 'cancelled') && (
                    <div className="sticky bottom-0 bg-white border-t border-gray-200 rounded-b-2xl px-5 py-4 space-y-2">
                        {/* Edit + Collect row */}
                        <div className="flex gap-2">
                            {['draft', 'pending'].includes(invoice.status) && onEdit && (
                                <button
                                    onClick={() => { onEdit(invoice); onClose() }}
                                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    <Pencil className="w-4 h-4" />
                                    تعديل الفاتورة
                                </button>
                            )}
                            {['pending', 'partially_paid'].includes(invoice.status) && onCollect && (
                                <button
                                    onClick={() => { onCollect(invoice); onClose() }}
                                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    <Banknote className="w-4 h-4" />
                                    تحصيل
                                </button>
                            )}
                        </div>
                        {/* Cancel button */}
                        {['paid', 'pending', 'confirmed', 'partially_paid', 'draft'].includes(invoice.status) && (
                            <button
                                onClick={() => { onCancel(invoice.id); onClose() }}
                                className={`w-full py-2.5 rounded-xl text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 ${['paid', 'confirmed', 'partially_paid'].includes(invoice.status)
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-red-500 hover:bg-red-600'
                                    }`}
                            >
                                <X className="w-4 h-4" />
                                {['paid', 'confirmed', 'partially_paid'].includes(invoice.status)
                                    ? 'إلغاء فاتورة محصّلة (مع عكس الأرصدة)'
                                    : 'إلغاء الفاتورة'
                                }
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// Helper Component
const InfoItem: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
    <div className="bg-gray-50 rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-1">
            <Icon className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">{label}</span>
        </div>
        <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
)

export default InvoiceDetailsModal
