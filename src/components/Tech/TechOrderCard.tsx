// TechOrderCard - بطاقة الطلب الحالى للفنى
import React, { useState, useEffect } from 'react'
import {
    User,
    MapPin,
    Building,
    Clock,
    FileText,
    Wrench,
    Play,
    CheckCircle,
    Loader2,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    X,
    Phone,
    MessageCircle,
    SkipForward
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
    isLeader?: boolean  // هل المستخدم قائد الفريق؟
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
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText,
    confirmColor,
    loading
}) => {
    if (!isOpen) return null

    const colorClasses = {
        blue: 'from-blue-500 to-blue-600 shadow-blue-500/30',
        green: 'from-green-500 to-green-600 shadow-green-500/30'
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <h3 className="font-bold text-gray-800">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    <p className="text-gray-600 text-center">{message}</p>
                </div>

                {/* Actions */}
                <div className="p-4 pt-0 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 py-3 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r ${colorClasses[confirmColor]} shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export const TechOrderCard: React.FC<TechOrderCardProps> = ({
    order,
    onStart,
    onComplete,
    onMoveToNext,
    loading = false,
    isLeader = true  // افتراضياً قائد للتوافق العكسي
}) => {
    const [showServices, setShowServices] = useState(true)
    const [confirmAction, setConfirmAction] = useState<'start' | 'complete' | null>(null)
    const [showCollectionSheet, setShowCollectionSheet] = useState(false)
    const [isCollected, setIsCollected] = useState(false)
    const [invoiceId, setInvoiceId] = useState<string | null>(null)
    const [invoiceItems, setInvoiceItems] = useState<any[] | null>(null)
    const [invoiceAmount, setInvoiceAmount] = useState<number | null>(null)

    const isInProgress = order.status === 'in_progress'
    const isPending = order.status === 'pending' || order.status === 'scheduled'
    const isCompleted = order.status === 'completed'

    // جلب بيانات الفاتورة الحقيقية عند إكمال الطلب
    useEffect(() => {
        if (isCompleted && order.id) {
            const fetchInvoiceData = async () => {
                // تأخير بسيط لإعطاء الـ trigger وقت لإنشاء الفاتورة
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
                    // استخدام بيانات الفاتورة الحقيقية بدل order.items
                    if (data.items && data.items.length > 0) {
                        setInvoiceItems(data.items)
                        setInvoiceAmount(data.total_amount ?? data.subtotal ?? null)
                    }
                }
            }
            fetchInvoiceData()
        }
    }, [isCompleted, order.id])

    const handleStartClick = () => {
        setConfirmAction('start')
    }

    const handleCompleteClick = () => {
        setConfirmAction('complete')
    }

    const handleConfirm = async () => {
        if (confirmAction === 'start') {
            await onStart()
        } else if (confirmAction === 'complete') {
            await onComplete()
        }
        setConfirmAction(null)
    }

    const getStatusBadge = () => {
        if (isInProgress) {
            return (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    قيد التنفيذ
                </span>
            )
        }
        return (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
                <Clock className="w-3.5 h-3.5" />
                فى الانتظار
            </span>
        )
    }

    return (
        <>
            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmAction === 'start'}
                onClose={() => setConfirmAction(null)}
                onConfirm={handleConfirm}
                title="تأكيد بدء العمل"
                message={`هل أنت متأكد من بدء العمل على الطلب #${order.order_number}؟`}
                confirmText="نعم، ابدأ العمل"
                confirmColor="blue"
                loading={loading}
            />
            <ConfirmModal
                isOpen={confirmAction === 'complete'}
                onClose={() => setConfirmAction(null)}
                onConfirm={handleConfirm}
                title="تأكيد إكمال الطلب"
                message={`هل أنت متأكد من إكمال الطلب #${order.order_number}؟`}
                confirmText="نعم، أكمل الطلب"
                confirmColor="green"
                loading={loading}
            />

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <FileText className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-white font-bold">
                                طلب #{order.order_number}
                            </span>
                        </div>
                        {getStatusBadge()}
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Customer Info */}
                    <div className="space-y-3">
                        {/* Name */}
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <User className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">اسم العميل</p>
                                <p className="font-semibold text-gray-800 text-lg">
                                    {order.customer?.name || 'غير محدد'}
                                </p>
                            </div>
                        </div>

                        {/* Phone - للقادة فقط */}
                        {isLeader && order.customer?.phone && (
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                    <Phone className="w-5 h-5 text-emerald-500" />
                                </div>
                                <div className="flex-1 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-500">رقم الهاتف</p>
                                        <p className="font-medium text-gray-800" dir="ltr">{order.customer.phone}</p>
                                        {order.customer.extra_phone && (
                                            <p className="text-sm text-gray-500" dir="ltr">{order.customer.extra_phone}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* زر الاتصال */}
                                        <a
                                            href={`tel:${order.customer.phone}`}
                                            className="p-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/30 active:scale-95"
                                            title="اتصال"
                                        >
                                            <Phone className="w-5 h-5" />
                                        </a>
                                        {/* زر واتساب */}
                                        <a
                                            href={`https://wa.me/${order.customer.phone.replace(/[\s\-\(\)]/g, '').replace(/^0/, '20')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg shadow-green-500/30 active:scale-95"
                                            title="واتساب"
                                        >
                                            <MessageCircle className="w-5 h-5" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Address */}
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                                <MapPin className="w-5 h-5 text-green-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-gray-500">العنوان</p>
                                <p className="font-medium text-gray-800">
                                    {order.customer?.address || 'غير محدد'}
                                </p>
                            </div>
                        </div>

                        {/* Area */}
                        {order.customer?.area && (
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                                    <Building className="w-5 h-5 text-purple-500" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">المنطقة</p>
                                    <p className="font-medium text-gray-800">{order.customer.area}</p>
                                </div>
                            </div>
                        )}

                        {/* Time */}
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                                <Clock className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">موعد الطلب</p>
                                <p className="font-medium text-gray-800">{order.scheduled_time}</p>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-100" />

                    {/* Services */}
                    <div>
                        <button
                            onClick={() => setShowServices(!showServices)}
                            className="w-full flex items-center justify-between text-gray-700 hover:text-blue-600 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Wrench className="w-4 h-4" />
                                <span className="font-medium">الخدمات المطلوبة ({order.items?.length || 0})</span>
                            </div>
                            {showServices ? (
                                <ChevronUp className="w-4 h-4" />
                            ) : (
                                <ChevronDown className="w-4 h-4" />
                            )}
                        </button>

                        {showServices && (
                            <div className="mt-3 space-y-2">
                                {order.items?.map((item, index) => (
                                    <div
                                        key={item.id || index}
                                        className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                                    >
                                        <span className="text-gray-700">
                                            {item.service?.name_ar || item.service?.name || 'خدمة'}
                                        </span>
                                        <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                            {item.quantity}x
                                        </span>
                                    </div>
                                ))}
                                {(!order.items || order.items.length === 0) && (
                                    <p className="text-center text-gray-500 text-sm py-2">لا توجد خدمات</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    {order.notes && (
                        <>
                            <div className="border-t border-gray-100" />
                            <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                                <p className="text-xs text-amber-600 font-medium mb-1">💬 ملاحظات</p>
                                <p className="text-gray-700">{order.notes}</p>
                            </div>
                        </>
                    )}
                </div>

                {/* Action Button - فقط للقادة */}
                <div className="p-4 pt-0">
                    {isLeader ? (
                        isCompleted ? (
                            // ✅ بعد الإكمال — شارة نجاح
                            <div className="w-full py-3 rounded-xl font-bold text-center text-green-700 bg-green-50 border-2 border-green-200">
                                <div className="flex items-center justify-center gap-2">
                                    <CheckCircle className="w-5 h-5" />
                                    <span>تم إكمال الطلب بنجاح — قم بتحصيل الفاتورة</span>
                                </div>
                            </div>
                        ) : isPending ? (
                            <button
                                onClick={handleStartClick}
                                disabled={loading}
                                className="w-full py-4 rounded-xl font-bold text-lg text-white
              bg-gradient-to-r from-blue-500 to-blue-600 
              hover:from-blue-600 hover:to-blue-700
              active:scale-[0.98] transition-all duration-200
              shadow-lg shadow-blue-500/30
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Play className="w-5 h-5" />
                                        بدء العمل
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={handleCompleteClick}
                                disabled={loading}
                                className="w-full py-4 rounded-xl font-bold text-lg text-white
              bg-gradient-to-r from-green-500 to-green-600 
              hover:from-green-600 hover:to-green-700
              active:scale-[0.98] transition-all duration-200
              shadow-lg shadow-green-500/30
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle className="w-5 h-5" />
                                        إكمال الطلب
                                    </>
                                )}
                            </button>
                        )
                    ) : (
                        // وضع العرض فقط للفنيين العاديين
                        <div className="w-full py-4 rounded-xl font-medium text-center text-gray-600 bg-gray-100 border-2 border-dashed border-gray-300">
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-xl">👁️</span>
                                <span>وضع المتابعة - القائد مسؤول عن تحديث الحالة</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Invoice Preview — للقائد بعد إكمال الطلب — يعرض بيانات الفاتورة الحقيقية من DB */}
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

            {/* Skip/Next button — بعد التحصيل أو للتخطي */}
            {isLeader && isCompleted && (
                <div className="mx-4 mt-3 mb-2">
                    <button
                        onClick={onMoveToNext}
                        className={`w-full py-3 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all duration-200 ${isCollected
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 active:scale-[0.98]'
                            : 'bg-gray-100 text-gray-500 border-2 border-dashed border-gray-300'
                            }`}
                    >
                        <SkipForward className="w-5 h-5" />
                        {isCollected ? 'الطلب التالى' : 'تخطى التحصيل → الطلب التالى'}
                    </button>
                </div>
            )}

            {/* Collection Bottom Sheet */}
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

