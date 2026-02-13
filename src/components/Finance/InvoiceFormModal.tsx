// InvoiceFormModal - إنشاء وتعديل الفواتير اليدوية
import React, { useState, useEffect, useCallback } from 'react'
import {
    X, Plus, Trash2, FileText, Loader2,
    User, DollarSign, Hash, Save, Package
} from 'lucide-react'
import { InvoicesAPI } from '../../api/invoices'
import { CustomersAPI } from '../../api/customers'
import { ServicesAPI } from '../../api/services'
import { InvoiceWithDetails, Customer, Service } from '../../types'
import toast from 'react-hot-toast'

interface InvoiceFormModalProps {
    invoice?: InvoiceWithDetails | null  // null = إنشاء جديد
    onClose: () => void
    onSuccess: () => void
}

interface InvoiceItemForm {
    id?: string            // existing item id (for edit mode)
    service_id: string
    description: string
    quantity: number
    unit_price: number
    total_price: number
}

const InvoiceFormModal: React.FC<InvoiceFormModalProps> = ({
    invoice,
    onClose,
    onSuccess
}) => {
    const isEdit = !!invoice
    const [loading, setLoading] = useState(false)
    const [dataLoading, setDataLoading] = useState(true)

    // Data sources
    const [customers, setCustomers] = useState<Customer[]>([])
    const [services, setServices] = useState<Service[]>([])
    const [customerSearch, setCustomerSearch] = useState('')

    // Form fields
    const [customerId, setCustomerId] = useState(invoice?.customer_id || '')
    const [status, setStatus] = useState<'draft' | 'pending'>(
        (invoice?.status as 'draft' | 'pending') || 'draft'
    )
    const [discount, setDiscount] = useState(invoice?.discount || 0)
    const [notes, setNotes] = useState(invoice?.notes || '')
    const [items, setItems] = useState<InvoiceItemForm[]>([])

    // Load data
    const loadData = useCallback(async () => {
        setDataLoading(true)
        try {
            const [customersRes, servicesRes] = await Promise.all([
                CustomersAPI.getCustomers({}, 1, 200),
                ServicesAPI.getServices()
            ])
            setCustomers(customersRes.data || [])
            setServices(servicesRes || [])

            // Load existing items if editing
            if (invoice?.items && invoice.items.length > 0) {
                setItems(invoice.items.map(item => ({
                    id: item.id,
                    service_id: item.service_id || '',
                    description: item.description || '',
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total_price: item.total_price
                })))
            } else {
                setItems([createEmptyItem()])
            }
        } catch (err) {
            console.error('Error loading data:', err)
            toast.error('خطأ في تحميل البيانات')
        } finally {
            setDataLoading(false)
        }
    }, [invoice])

    useEffect(() => { loadData() }, [loadData])

    const createEmptyItem = (): InvoiceItemForm => ({
        service_id: '',
        description: '',
        quantity: 1,
        unit_price: 0,
        total_price: 0
    })

    const handleItemChange = (index: number, field: keyof InvoiceItemForm, value: any) => {
        setItems(prev => {
            const updated = [...prev]
            const item = { ...updated[index] }

            if (field === 'service_id') {
                const service = services.find(s => s.id === value)
                item.service_id = value
                item.description = service?.name_ar || service?.name || ''
                item.unit_price = service?.price || 0
                item.total_price = (service?.price || 0) * item.quantity
            } else if (field === 'quantity') {
                item.quantity = Math.max(1, value)
                item.total_price = item.unit_price * item.quantity
            } else if (field === 'unit_price') {
                item.unit_price = Math.max(0, value)
                item.total_price = item.unit_price * item.quantity
            } else if (field === 'description') {
                item.description = value
            }

            updated[index] = item
            return updated
        })
    }

    const addItem = () => {
        setItems(prev => [...prev, createEmptyItem()])
    }

    const removeItem = (index: number) => {
        if (items.length <= 1) return
        setItems(prev => prev.filter((_, i) => i !== index))
    }

    // Calculated totals
    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0)
    const totalAmount = Math.max(0, subtotal - discount)

    const handleSubmit = async () => {
        // Validation
        if (!customerId) {
            toast.error('يرجى اختيار العميل')
            return
        }
        const validItems = items.filter(i => i.description && i.unit_price > 0)
        if (validItems.length === 0) {
            toast.error('يرجى إضافة بند واحد على الأقل')
            return
        }

        setLoading(true)
        try {
            if (isEdit && invoice) {
                // Update invoice
                const updateResult = await InvoicesAPI.updateInvoice(invoice.id, {
                    customer_id: customerId,
                    status,
                    discount,
                    notes: notes || undefined,
                    subtotal,
                    total_amount: totalAmount
                })

                if (!updateResult.success) {
                    toast.error(updateResult.error || 'خطأ في تحديث الفاتورة')
                    return
                }

                // Handle items: delete removed, add new
                const existingIds = new Set(items.filter(i => i.id).map(i => i.id!))
                const originalIds = (invoice.items || []).map(i => i.id)

                // Delete removed items
                for (const origId of originalIds) {
                    if (!existingIds.has(origId)) {
                        await InvoicesAPI.deleteInvoiceItem(origId)
                    }
                }

                // Add new items (those without id)
                for (const item of validItems) {
                    if (!item.id) {
                        await InvoicesAPI.addInvoiceItem({
                            invoice_id: invoice.id,
                            service_id: item.service_id || undefined,
                            description: item.description,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            total_price: item.total_price
                        })
                    }
                }

                toast.success('تم تحديث الفاتورة بنجاح')
            } else {
                // Create new invoice
                const result = await InvoicesAPI.createInvoice(
                    {
                        customer_id: customerId,
                        status,
                        discount,
                        subtotal,
                        total_amount: totalAmount,
                        notes: notes || undefined
                    },
                    validItems.map(item => ({
                        service_id: item.service_id || undefined,
                        description: item.description,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total_price: item.total_price
                    }))
                )

                if (!result.success) {
                    toast.error(result.error || 'خطأ في إنشاء الفاتورة')
                    return
                }

                toast.success('تم إنشاء الفاتورة بنجاح')
            }

            onSuccess()
        } catch (err) {
            console.error(err)
            toast.error('حدث خطأ غير متوقع')
        } finally {
            setLoading(false)
        }
    }

    // Filter customers by search
    const filteredCustomers = customerSearch
        ? customers.filter(c =>
            c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
            c.phone?.includes(customerSearch)
        )
        : customers

    if (dataLoading) {
        return (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <span className="text-sm text-gray-500">جارٍ تحميل البيانات...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 bg-gradient-to-l from-blue-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-xl">
                            <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">
                                {isEdit ? 'تعديل الفاتورة' : 'إنشاء فاتورة يدوية'}
                            </h2>
                            {isEdit && invoice && (
                                <p className="text-xs text-gray-500 mt-0.5">{invoice.invoice_number}</p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">

                    {/* العميل */}
                    <div>
                        <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                            <User className="h-4 w-4 text-blue-500" />
                            العميل
                        </label>
                        <input
                            type="text"
                            placeholder="ابحث عن عميل بالاسم أو الهاتف..."
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            className="input w-full mb-2 text-sm"
                        />
                        <select
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value)}
                            className="input w-full"
                            disabled={loading}
                        >
                            <option value="">اختر العميل</option>
                            {filteredCustomers.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} {c.phone ? `(${c.phone})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* حالة الفاتورة */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">الحالة</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as 'draft' | 'pending')}
                                className="input w-full"
                                disabled={loading}
                            >
                                <option value="draft">مسودة</option>
                                <option value="pending">معلّقة (جاهزة للتحصيل)</option>
                            </select>
                        </div>
                        <div>
                            <label className="flex items-center gap-1 text-sm font-semibold text-gray-700 mb-1.5">
                                <DollarSign className="h-3.5 w-3.5 text-red-500" />
                                الخصم (ج.م)
                            </label>
                            <input
                                type="number"
                                value={discount || ''}
                                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                className="input w-full text-center"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {/* بنود الفاتورة */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                                <Package className="h-4 w-4 text-emerald-500" />
                                بنود الفاتورة
                            </label>
                            <button
                                type="button"
                                onClick={addItem}
                                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                                disabled={loading}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                إضافة بند
                            </button>
                        </div>

                        <div className="space-y-3">
                            {items.map((item, index) => {
                                return (
                                    <div
                                        key={index}
                                        className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4 space-y-3"
                                    >
                                        {/* Header */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-400 bg-white rounded-full px-2.5 py-0.5">
                                                بند {index + 1}
                                            </span>
                                            {items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    disabled={loading}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Service or Description */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[11px] text-gray-500 mb-1 block">الخدمة (اختياري)</label>
                                                <select
                                                    value={item.service_id}
                                                    onChange={(e) => handleItemChange(index, 'service_id', e.target.value)}
                                                    className="input w-full text-sm"
                                                    disabled={loading}
                                                >
                                                    <option value="">بند حر</option>
                                                    {services.map(s => (
                                                        <option key={s.id} value={s.id}>
                                                            {s.name_ar || s.name} — {s.price} ج.م
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[11px] text-gray-500 mb-1 block">الوصف</label>
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                                    className="input w-full text-sm"
                                                    placeholder="اسم البند"
                                                    disabled={loading}
                                                />
                                            </div>
                                        </div>

                                        {/* Price & Quantity */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="flex items-center gap-1 text-xs font-semibold text-amber-700 mb-1">
                                                    <DollarSign className="h-3 w-3" />
                                                    السعر (ج.م)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={item.unit_price || ''}
                                                    onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                    className="input w-full text-center font-semibold"
                                                    min="0"
                                                    step="0.01"
                                                    disabled={loading}
                                                />
                                            </div>
                                            <div>
                                                <label className="flex items-center gap-1 text-xs font-semibold text-blue-700 mb-1">
                                                    <Hash className="h-3 w-3" />
                                                    الكمية
                                                </label>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                                                    className="input w-full text-center font-semibold"
                                                    min="1"
                                                    disabled={loading}
                                                />
                                            </div>
                                        </div>

                                        {/* Item total */}
                                        {item.total_price > 0 && (
                                            <div className="pt-2 border-t border-dashed border-gray-300 flex justify-between items-center">
                                                <span className="text-xs text-gray-500">إجمالي البند</span>
                                                <span className="text-sm font-bold text-gray-800">
                                                    {item.total_price.toLocaleString('ar-EG')} ج.م
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* ملاحظات */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">ملاحظات</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="input w-full text-sm"
                            rows={2}
                            placeholder="ملاحظات إضافية (اختياري)"
                            disabled={loading}
                        />
                    </div>

                    {/* الملخص المالي */}
                    <div className="bg-gradient-to-l from-blue-50 to-emerald-50 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>المجموع الفرعي</span>
                            <span className="font-medium">{subtotal.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        {discount > 0 && (
                            <div className="flex justify-between text-sm text-red-600">
                                <span>الخصم</span>
                                <span className="font-medium">- {discount.toLocaleString('ar-EG')} ج.م</span>
                            </div>
                        )}
                        <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
                            <span>الإجمالي</span>
                            <span className="text-emerald-700">{totalAmount.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-4 bg-gray-50 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                        disabled={loading}
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !customerId}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {isEdit ? 'حفظ التعديلات' : 'إنشاء الفاتورة'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default InvoiceFormModal
