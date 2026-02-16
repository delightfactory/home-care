// TechOrderCard - بطاقة الطلب الحالى للفنى — تصميم native-like
import React, { useState, useEffect } from 'react'
import {
    User, MapPin, Building, Clock, FileText, Wrench,
    Play, CheckCircle, Loader2, ChevronDown, ChevronUp,
    AlertTriangle, Phone, MessageCircle, SkipForward
} from 'lucide-react'
import { TechnicianOrder } from '../../api/technician'
import { supabase } from '../../lib/supabase'

import TechInvoicePreview from './TechInvoicePreview'
import TechCollectionSheet from './TechCollectionSheet'

interface TechOrderCardProps {
    order: TechnicianOrder
    onStart: () => Promise<void>
    onComplete: () => Promise<void>
    onMoveToNext: () => Promise<void>
    loading?: boolean
    isLeader?: boolean
}

// مودال التأكيد
interface ConfirmModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmText: string
    confirmColor: 'blue' | 'green'
    loading?: boolean
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen, onClose, onConfirm, title, message, confirmText, confirmColor, loading
}) => {
    if (!isOpen) return null

    const colorClasses = {
        blue: 'from-blue-500 to-blue-600 shadow-blue-500/30',
        green: 'from-green-500 to-green-600 shadow-green-500/30'
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div
                className="relative bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden"
                style={{ animation: 'scaleIn 0.2s ease-out' }}
            >
                <div className="p-5 text-center">
                    <div className="w-14 h-14 mx-auto bg-amber-50 rounded-2xl flex items-center justify-center mb-3">
                        <AlertTriangle className="w-7 h-7 text-amber-500" />
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg mb-1">{title}</h3>
                    <p className="text-gray-500 text-sm">{message}</p>
                </div>

                <div className="px-5 pb-5 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 py-3 rounded-2xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 active:scale-[0.98]"
                    >
                        لا، رجوع
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 py-3 rounded-2xl font-bold text-white bg-gradient-to-r ${colorClasses[confirmColor]} shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]`}
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : confirmText}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes scaleIn {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    )
}

export const TechOrderCard: React.FC<TechOrderCardProps> = ({
    order, onStart, onComplete, onMoveToNext, loading = false, isLeader = true
}) => {
    const [showServices, setShowServices] = useState(false)
    const [confirmAction, setConfirmAction] = useState<'start' | 'complete' | null>(null)
    const [showCollectionSheet, setShowCollectionSheet] = useState(false)
    const [isCollected, setIsCollected] = useState(false)
    const [invoiceId, setInvoiceId] = useState<string | null>(null)
    const [invoiceItems, setInvoiceItems] = useState<any[] | null>(null)
    const [invoiceAmount, setInvoiceAmount] = useState<number | null>(null)

    const isInProgress = order.status === 'in_progress'
    const isPending = order.status === 'pending' || order.status === 'scheduled'
    const isCompleted = order.status === 'completed'

    // جلب بيانات الفاتورة بعد إكمال الطلب
    useEffect(() => {
        if (isCompleted && order.id) {
            const fetchInvoice = async () => {
                await new Promise(r => setTimeout(r, 500))
                const { data } = await supabase
                    .from('invoices')
                    .select(`
                        id, total_amount, subtotal,
                        items:invoice_items(
                            id, quantity, unit_price, total_price, description,
                            service:services(id, name, name_ar)
                        )
                    `)
                    .eq('order_id', order.id)
                    .maybeSingle()
                if (data) {
                    setInvoiceId(data.id)
                    if (data.items && data.items.length > 0) {
                        setInvoiceItems(data.items)
                        setInvoiceAmount(data.total_amount ?? data.subtotal ?? null)
                    }
                }
            }
            fetchInvoice()
        }
    }, [isCompleted, order.id])

    const handleConfirm = async () => {
        if (confirmAction === 'start') await onStart()
        else if (confirmAction === 'complete') await onComplete()
        setConfirmAction(null)
    }

    const statusConfig = isInProgress
        ? { text: 'جارى التنفيذ', bg: 'bg-blue-500', pulse: true }
        : { text: 'فى الانتظار', bg: 'bg-amber-500', pulse: false }

    return (
        <>
            {/* Confirmation Modals */}
            <ConfirmModal
                isOpen={confirmAction === 'start'}
                onClose={() => setConfirmAction(null)}
                onConfirm={handleConfirm}
                title="يلا نبدأ؟ 💪"
                message={`هل أنت جاهز لبدء الطلب #${order.order_number}؟`}
                confirmText="يلا بينا!"
                confirmColor="blue"
                loading={loading}
            />
            <ConfirmModal
                isOpen={confirmAction === 'complete'}
                onClose={() => setConfirmAction(null)}
                onConfirm={handleConfirm}
                title="خلّصت الطلب؟ 🎯"
                message={`تأكيد إكمال الطلب #${order.order_number}؟`}
                confirmText="أيوه، خلصت!"
                confirmColor="green"
                loading={loading}
            />

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Header — ملوّن */}
                <div className={`${isCompleted ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-blue-500 to-blue-600'} px-4 py-3`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                                <FileText className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-white font-bold text-sm">
                                طلب #{order.order_number}
                            </span>
                        </div>
                        {!isCompleted && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
                                {statusConfig.pulse && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                                {statusConfig.text}
                            </span>
                        )}
                        {isCompleted && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
                                <CheckCircle className="w-3.5 h-3.5" />
                                تم ✓
                            </span>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                    {/* Customer Name & Phone */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                                <User className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-800">
                                    {order.customer?.name || 'عميل'}
                                </p>
                                {order.scheduled_time && (
                                    <p className="text-xs text-gray-400 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {order.scheduled_time}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Phone Buttons */}
                        {isLeader && order.customer?.phone && (
                            <div className="flex items-center gap-1.5">
                                <a
                                    href={`tel:${order.customer.phone}`}
                                    className="p-2 bg-emerald-50 text-emerald-600 rounded-xl active:scale-95 transition-all"
                                >
                                    <Phone className="w-4 h-4" />
                                </a>
                                <a
                                    href={`https://wa.me/${order.customer.phone.replace(/[\s\-\(\)]/g, '').replace(/^0/, '20')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 bg-green-50 text-green-600 rounded-xl active:scale-95 transition-all"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Address */}
                    <div className="flex items-start gap-3 bg-gray-50 rounded-2xl p-3">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 leading-relaxed">
                                {order.customer?.address || 'العنوان غير محدد'}
                            </p>
                            {order.customer?.area && (
                                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                    <Building className="w-3 h-3" />
                                    {order.customer.area}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Services — مطوية */}
                    <button
                        onClick={() => setShowServices(!showServices)}
                        className="w-full flex items-center justify-between p-3 bg-blue-50/50 rounded-2xl transition-colors hover:bg-blue-50"
                    >
                        <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-medium text-gray-700">
                                الخدمات ({order.items?.length || 0})
                            </span>
                        </div>
                        {showServices ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>

                    {showServices && (
                        <div className="space-y-1.5 px-1">
                            {order.items?.map((item, index) => (
                                <div key={item.id || index} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                                    <span className="text-sm text-gray-700">
                                        {item.service?.name_ar || item.service?.name || 'خدمة'}
                                    </span>
                                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                                        x{item.quantity}
                                    </span>
                                </div>
                            ))}
                            {(!order.items || order.items.length === 0) && (
                                <p className="text-center text-gray-400 text-sm py-2">مفيش خدمات</p>
                            )}
                        </div>
                    )}

                    {/* Notes */}
                    {order.notes && (
                        <div className="bg-amber-50 rounded-2xl p-3 border border-amber-100">
                            <p className="text-xs text-amber-600 font-medium mb-1">💬 ملاحظات</p>
                            <p className="text-sm text-gray-700">{order.notes}</p>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="px-4 pb-4">
                    {isLeader ? (
                        isCompleted ? (
                            <div className="py-3 rounded-2xl font-bold text-center text-green-700 bg-green-50 border border-green-200">
                                <div className="flex items-center justify-center gap-2 text-sm">
                                    <CheckCircle className="w-4 h-4" />
                                    شغل جامد! حصّل الفاتورة 💰
                                </div>
                            </div>
                        ) : isPending ? (
                            <button
                                onClick={() => setConfirmAction('start')}
                                disabled={loading}
                                className="w-full py-4 rounded-2xl font-bold text-base text-white bg-gradient-to-r from-blue-500 to-blue-600 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                    <>
                                        <Play className="w-5 h-5" />
                                        يلا نبدأ 💪
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={() => setConfirmAction('complete')}
                                disabled={loading}
                                className="w-full py-4 rounded-2xl font-bold text-base text-white bg-gradient-to-r from-green-500 to-green-600 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-green-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                    <>
                                        <CheckCircle className="w-5 h-5" />
                                        خلّصت الطلب ✅
                                    </>
                                )}
                            </button>
                        )
                    ) : (
                        <div className="py-3 rounded-2xl font-medium text-center text-gray-500 bg-gray-50 border border-dashed border-gray-300 text-sm">
                            👁️ وضع المتابعة — القائد مسؤول عن التحديث
                        </div>
                    )}
                </div>
            </div>

            {/* Invoice Preview */}
            {isLeader && isCompleted && (invoiceItems || order.items).length > 0 && (
                <TechInvoicePreview
                    items={invoiceItems || order.items}
                    totalAmount={invoiceAmount ?? order.total_amount}
                    orderNumber={order.order_number}
                    customerName={order.customer?.name || 'عميل'}
                    onCollect={() => setShowCollectionSheet(true)}
                    isCollected={isCollected}
                />
            )}

            {/* Skip/Next button */}
            {isLeader && isCompleted && (
                <div className="mx-4 mt-3 mb-2">
                    <button
                        onClick={onMoveToNext}
                        className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] ${isCollected
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                            : 'bg-gray-100 text-gray-500 border border-dashed border-gray-300'
                            }`}
                    >
                        <SkipForward className="w-4 h-4" />
                        {isCollected ? 'الطلب التالى ←' : 'تخطى التحصيل'}
                    </button>
                </div>
            )}

            {/* Collection Sheet */}
            <TechCollectionSheet
                isOpen={showCollectionSheet}
                onClose={() => setShowCollectionSheet(false)}
                invoiceId={invoiceId}
                orderId={order.id}
                amount={invoiceAmount ?? order.total_amount}
                onSuccess={() => {
                    setIsCollected(true)
                    setShowCollectionSheet(false)
                }}
            />
        </>
    )
}

export default TechOrderCard
