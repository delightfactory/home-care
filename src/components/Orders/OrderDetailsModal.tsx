import React, { useEffect, useState, useRef } from 'react'
import SmartModal from '../UI/SmartModal'
import LoadingSpinner from '../UI/LoadingSpinner'
import { OrdersAPI } from '../../api'
import { OrderWithDetails } from '../../types'
import html2canvas from 'html2canvas'

interface OrderDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  orderId?: string
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ isOpen, onClose, orderId }) => {
  const [order, setOrder] = useState<OrderWithDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchDetails = async () => {
      if (!isOpen || !orderId) return
      try {
        setLoading(true)
        const data = await OrdersAPI.getOrderById(orderId)
        if (data) setOrder(data)
      } catch (error) {
        console.error('Fetch order details error:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchDetails()
  }, [isOpen, orderId])

  const handlePrint = () => {
    window.print()
  }

  const handleExportAsImage = async () => {
    if (!printRef.current) return
    
    try {
      setIsExporting(true)
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      })
      
      const link = document.createElement('a')
      link.download = `order-${order?.order_number || orderId}.png`
      link.href = canvas.toDataURL()
      link.click()
    } catch (error) {
      console.error('Export error:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  const formatTime = (timeStr: string) => {
    try {
      const [hours, minutes] = timeStr.split(':')
      const date = new Date()
      date.setHours(parseInt(hours), parseInt(minutes))
      return date.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return timeStr
    }
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'في الانتظار',
      'scheduled': 'مجدول',
      'in_progress': 'قيد التنفيذ',
      'completed': 'مكتمل',
      'cancelled': 'ملغي'
    }
    return statusMap[status] || status
  }

  const getPaymentStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'unpaid': 'غير مدفوع',
      'paid_cash': 'مدفوع نقداً',
      'paid_card': 'مدفوع بالبطاقة'
    }
    return statusMap[status] || status
  }

  const getTransportMethodText = (method: string) => {
    const methodMap: Record<string, string> = {
      'company_car': 'سيارة الشركة',
      'taxi': 'تاكسي',
      'uber': 'أوبر',
      'public_transport': 'مواصلات عامة'
    }
    return methodMap[method] || method
  }

  return (
    <SmartModal isOpen={isOpen} onClose={onClose} title="تفاصيل الطلب" size="xl">
      {loading || !order ? (
        <div className="p-6 flex justify-center">
          <LoadingSpinner text="جاري تحميل التفاصيل..." />
        </div>
      ) : (
        <>
          {/* Action Buttons */}
          <div className="flex justify-end gap-2 p-4 border-b print:hidden">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              طباعة
            </button>
            <button
              onClick={handleExportAsImage}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {isExporting ? 'جاري التصدير...' : 'تصدير كصورة'}
            </button>
          </div>

          {/* Printable Content */}
          <div ref={printRef} className="p-6 space-y-6 text-sm bg-white">
            {/* Header */}
            <div className="text-center border-b pb-4">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">تفاصيل الطلب</h1>
              <p className="text-gray-600">رقم الطلب: {order.order_number}</p>
              <p className="text-xs text-gray-500 mt-2">تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
            </div>

            {/* Customer Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                بيانات العميل
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-gray-700">الاسم:</span>
                  <span className="mr-2">{order.customer?.name || 'غير محدد'}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">رقم الهاتف:</span>
                  <span className="mr-2">{order.customer?.phone || 'غير محدد'}</span>
                </div>
                <div className="md:col-span-2">
                  <span className="font-semibold text-gray-700">العنوان:</span>
                  <span className="mr-2">{order.customer?.address || 'غير محدد'}</span>
                </div>
                {order.customer?.area && (
                  <div>
                    <span className="font-semibold text-gray-700">المنطقة:</span>
                    <span className="mr-2">{order.customer.area}</span>
                  </div>
                )}
                {order.customer?.notes && (
                  <div className="md:col-span-2">
                    <span className="font-semibold text-gray-700">ملاحظات العميل:</span>
                    <p className="text-gray-600 mt-1 text-xs">{order.customer.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Order Information */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                بيانات الطلب
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <span className="font-semibold text-gray-700">التاريخ المجدول:</span>
                  <span className="mr-2">{formatDate(order.scheduled_date)}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">الوقت المجدول:</span>
                  <span className="mr-2">{formatTime(order.scheduled_time)}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">حالة الطلب:</span>
                  <span className={`mr-2 px-2 py-1 rounded text-xs ${
                    order.status === 'completed' ? 'bg-green-100 text-green-800' :
                    order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {getStatusText(order.status)}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">حالة الدفع:</span>
                  <span className={`mr-2 px-2 py-1 rounded text-xs ${
                    order.payment_status === 'paid_cash' || order.payment_status === 'paid_card' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {getPaymentStatusText(order.payment_status)}
                  </span>
                </div>
                {order.payment_method && (
                  <div>
                    <span className="font-semibold text-gray-700">طريقة الدفع:</span>
                    <span className="mr-2">{order.payment_method === 'cash' ? 'نقداً' : 'بطاقة'}</span>
                  </div>
                )}
                {order.transport_method && (
                  <div>
                    <span className="font-semibold text-gray-700">وسيلة النقل:</span>
                    <span className="mr-2">{getTransportMethodText(order.transport_method)}</span>
                  </div>
                )}
                {order.transport_cost > 0 && (
                  <div>
                    <span className="font-semibold text-gray-700">تكلفة النقل:</span>
                    <span className="mr-2">{order.transport_cost} ج.م</span>
                  </div>
                )}
                {order.team && (
                  <div>
                    <span className="font-semibold text-gray-700">الفريق المكلف:</span>
                    <span className="mr-2">{order.team.name}</span>
                  </div>
                )}
                <div>
                  <span className="font-semibold text-gray-700">تاريخ الإنشاء:</span>
                  <span className="mr-2">{formatDate(order.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Services */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                الخدمات المطلوبة
              </h2>
              {order.items && order.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border rounded-lg overflow-hidden text-xs">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-right">الخدمة</th>
                        <th className="px-4 py-3 text-center">الكمية</th>
                        <th className="px-4 py-3 text-center">سعر الوحدة</th>
                        <th className="px-4 py-3 text-center">الإجمالي</th>
                        {order.items?.some(item => item.notes) && (
                           <th className="px-4 py-3 text-right">ملاحظات</th>
                         )}
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map(item => (
                        <tr key={item.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3 text-right">
                            <div>
                              <div className="font-medium">{item.service?.name_ar || item.service?.name}</div>
                              {item.service?.description && (
                                <div className="text-gray-500 text-xs mt-1">{item.service.description}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">{item.quantity}</td>
                          <td className="px-4 py-3 text-center">{item.unit_price} ج.م</td>
                          <td className="px-4 py-3 text-center font-semibold">{item.total_price} ج.م</td>
                          {order.items?.some(i => i.notes) && (
                             <td className="px-4 py-3 text-right text-gray-600">{item.notes || '-'}</td>
                           )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={order.items?.some(item => item.notes) ? 4 : 3} className="px-4 py-3 text-right font-semibold">
                           إجمالي المبلغ:
                         </td>
                        <td className="px-4 py-3 text-center font-bold text-lg text-green-600">
                          {order.total_amount} ج.م
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">لا توجد خدمات مضافة لهذا الطلب.</p>
              )}
            </div>

            {/* Customer Rating & Feedback */}
            {(order.customer_rating || order.customer_feedback) && (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  تقييم العميل
                </h2>
                {order.customer_rating && (
                  <div className="mb-2">
                    <span className="font-semibold text-gray-700">التقييم:</span>
                    <div className="flex items-center gap-1 mr-2">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-4 h-4 ${
                            i < order.customer_rating! ? 'text-yellow-400' : 'text-gray-300'
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                      <span className="mr-2 text-sm">({order.customer_rating}/5)</span>
                    </div>
                  </div>
                )}
                {order.customer_feedback && (
                  <div>
                    <span className="font-semibold text-gray-700">تعليق العميل:</span>
                    <p className="text-gray-600 mt-1 text-sm bg-white p-3 rounded border">{order.customer_feedback}</p>
                  </div>
                )}
              </div>
            )}

            {/* Order Notes */}
            {order.notes && (
              <div className="bg-orange-50 p-4 rounded-lg">
                <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  ملاحظات الطلب
                </h2>
                <p className="text-gray-600 text-sm whitespace-pre-wrap bg-white p-3 rounded border">{order.notes}</p>
              </div>
            )}

            {/* Status History */}
            {order.status_logs && order.status_logs.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  سجل حالات الطلب
                </h2>
                <div className="space-y-3">
                  {order.status_logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-3 h-3 rounded-full mt-1 ${
                        log.status === 'completed' ? 'bg-green-500' :
                        log.status === 'in_progress' ? 'bg-blue-500' :
                        log.status === 'cancelled' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`}></div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{getStatusText(log.status)}</span>
                          <span className="text-xs text-gray-500">{formatDate(log.created_at)}</span>
                        </div>
                        {log.notes && (
                          <p className="text-gray-600 text-xs mt-1">{log.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </SmartModal>
  )
}

export default OrderDetailsModal
