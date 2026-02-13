// TechInvoicePreview - عرض فاتورة مختصرة ومرتبة للفنى
// يُعرض بعد إكمال الطلب ليناقشه الفنى مع العميل
import React from 'react'
import { FileText, Tag, Minus, Calculator } from 'lucide-react'

interface InvoiceItem {
    id: string
    quantity: number
    unit_price: number
    service?: {
        id: string
        name: string
        name_ar: string
    } | null
}

interface TechInvoicePreviewProps {
    items: InvoiceItem[]
    totalAmount: number
    discount?: number
    orderNumber: string
    customerName: string
    onCollect: () => void
    isCollected?: boolean
}

const TechInvoicePreview: React.FC<TechInvoicePreviewProps> = ({
    items,
    totalAmount,
    discount = 0,
    orderNumber,
    customerName,
    onCollect,
    isCollected = false
}) => {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
    const finalAmount = totalAmount || (subtotal - discount)

    return (
        <div className="mx-4 mt-4 animate-fade-in">
            {/* Invoice Header */}
            <div className="bg-white rounded-t-2xl border border-b-0 border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                            <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-800">فاتورة الطلب</h3>
                            <p className="text-xs text-gray-500">#{orderNumber}</p>
                        </div>
                    </div>
                    <span className="text-xs text-gray-500">{customerName}</span>
                </div>
            </div>

            {/* Items Table */}
            <div className="bg-white border-x border-gray-200 overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500">
                    <span className="col-span-6">الخدمة</span>
                    <span className="col-span-2 text-center">الكمية</span>
                    <span className="col-span-2 text-center">السعر</span>
                    <span className="col-span-2 text-left">الإجمالي</span>
                </div>

                {/* Items */}
                {items.map((item, index) => (
                    <div
                        key={item.id}
                        className={`grid grid-cols-12 gap-1 px-4 py-2.5 text-sm ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            }`}
                    >
                        <span className="col-span-6 text-gray-800 font-medium truncate">
                            {item.service?.name_ar || item.service?.name || 'خدمة'}
                        </span>
                        <span className="col-span-2 text-center text-gray-600">
                            {item.quantity}
                        </span>
                        <span className="col-span-2 text-center text-gray-600">
                            {item.unit_price.toLocaleString('ar-EG')}
                        </span>
                        <span className="col-span-2 text-left font-medium text-gray-800">
                            {(item.quantity * item.unit_price).toLocaleString('ar-EG')}
                        </span>
                    </div>
                ))}
            </div>

            {/* Summary */}
            <div className="bg-white border-x border-gray-200 px-4 py-3 space-y-2 border-t border-dashed border-gray-200">
                {/* Subtotal */}
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5" />
                        الإجمالي الفرعي
                    </span>
                    <span className="text-gray-700">{subtotal.toLocaleString('ar-EG')} ج.م</span>
                </div>

                {/* Discount */}
                {discount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-green-600 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" />
                            الخصم
                        </span>
                        <span className="text-green-600 flex items-center gap-1">
                            <Minus className="w-3 h-3" />
                            {discount.toLocaleString('ar-EG')} ج.م
                        </span>
                    </div>
                )}
            </div>

            {/* Total + Collect Button */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-b-2xl px-4 py-3 flex items-center justify-between">
                <div>
                    <p className="text-xs text-blue-200">المبلغ المطلوب</p>
                    <p className="text-xl font-bold text-white">
                        {finalAmount.toLocaleString('ar-EG')} <span className="text-sm font-normal">ج.م</span>
                    </p>
                </div>

                {isCollected ? (
                    <div className="bg-green-500/20 border border-green-400/30 rounded-xl px-4 py-2">
                        <span className="text-green-100 text-sm font-medium">✅ تم التحصيل</span>
                    </div>
                ) : (
                    <button
                        onClick={onCollect}
                        className="bg-white text-blue-600 font-bold text-sm px-5 py-2.5 rounded-xl shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200"
                    >
                        تحصيل المبلغ
                    </button>
                )}
            </div>
        </div>
    )
}

export default TechInvoicePreview
