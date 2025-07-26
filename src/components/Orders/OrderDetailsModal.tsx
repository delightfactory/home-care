import React, { useEffect, useState, useRef } from 'react'
import SmartModal from '../UI/SmartModal'
import LoadingSpinner from '../UI/LoadingSpinner'
import { OrdersAPI } from '../../api'
import { OrderWithDetails } from '../../types'
import html2canvas from 'html2canvas'
import { FileText, Download, Printer, User, Calendar, Clock, MapPin, CreditCard, Truck, Users, Star, MessageSquare, FileCheck, History, Phone } from 'lucide-react'

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
      
      // Add mobile-friendly styles for export
      const exportStyles = document.createElement('style')
      exportStyles.innerHTML = `
        .mobile-export .grid-cols-2 {
          grid-template-columns: 1fr !important;
        }
        .mobile-export .lg\\:grid-cols-2 {
          grid-template-columns: 1fr !important;
        }
        .mobile-export {
          max-width: 400px !important;
          margin: 0 auto !important;
        }
        .mobile-export .text-xl {
           font-size: 1.25rem !important;
         }
         .mobile-export .text-lg {
           font-size: 1.125rem !important;
         }
        .mobile-export .p-4 {
          padding: 0.75rem !important;
        }
        .mobile-export .gap-4 {
          gap: 0.75rem !important;
        }
        .mobile-export table {
            font-size: 0.875rem !important;
          }
         .mobile-export .px-3 {
           padding-left: 0.5rem !important;
           padding-right: 0.5rem !important;
         }
         .mobile-export .py-2 {
           padding-top: 0.375rem !important;
           padding-bottom: 0.375rem !important;
         }
         .mobile-export .overflow-x-auto {
           overflow-x: visible !important;
         }
         .mobile-export .w-full {
           width: 100% !important;
         }
         .mobile-export .text-sm {
            font-size: 0.875rem !important;
          }
          .mobile-export .text-xs {
            font-size: 0.75rem !important;
          }
         .mobile-export .mb-3 {
           margin-bottom: 0.5rem !important;
         }
         .mobile-export .space-y-4 > * + * {
           margin-top: 0.75rem !important;
         }
         .mobile-export .space-y-2 > * + * {
           margin-top: 0.375rem !important;
         }
         .mobile-export .space-y-1 > * + * {
             margin-top: 0.25rem !important;
           }
           .mobile-export .font-semibold {
             font-size: 0.875rem !important;
           }
           .mobile-export .font-bold {
             font-size: 1rem !important;
           }
           .mobile-export .text-base {
             font-size: 0.875rem !important;
           }
           .mobile-export h2 {
             font-size: 1.125rem !important;
           }
           .mobile-export .text-2xl {
             font-size: 1.5rem !important;
           }
      `
      document.head.appendChild(exportStyles)
      
      // Add mobile export class
      printRef.current.classList.add('mobile-export')
      
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 400,
        height: printRef.current.scrollHeight
      })
      
      // Remove mobile export class and styles
      printRef.current.classList.remove('mobile-export')
      document.head.removeChild(exportStyles)
      
      const link = document.createElement('a')
      link.download = `order-${order?.order_number || orderId}-mobile.png`
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

  // Helper: calculate total expected execution duration (in minutes)
  const getOrderDuration = (order: OrderWithDetails): number => {
    if (!order.items) return 0
    return order.items.reduce((sum, item: any) => {
      const perUnit = item.service?.estimated_duration || 0
      const qty = (item as any)?.quantity ?? 1
      return sum + perUnit * qty
    }, 0)
  }

  // Format minutes to human-readable Arabic string e.g. "2 س 30 د" or "45 د"
  const formatDuration = (minutes: number): string => {
    if (!minutes) return '-'
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${h} س ${m} د` : `${m} د`
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
          <div className="flex justify-end gap-2 p-4 border-b border-gray-200 print:hidden bg-gray-50">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Printer className="w-4 h-4" />
              طباعة
            </button>
            <button
              onClick={handleExportAsImage}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'جاري التصدير...' : 'تصدير كصورة'}
            </button>
          </div>

          {/* Printable Content */}
          <div ref={printRef} className="bg-white">
            {/* Compact Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <FileText className="w-6 h-6" />
                <h1 className="text-xl font-bold">تفاصيل الطلب رقم: {order.order_number}</h1>
              </div>
              <p className="text-sm opacity-90">تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Customer & Order Info - Mobile Responsive */}
              <div className="grid grid-cols-1 gap-4 mobile-friendly-layout">
                {/* Customer Information */}
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-bold text-gray-800">بيانات العميل</h2>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 p-2 rounded bg-white border border-blue-100 hover:bg-blue-25 transition-colors">
                      <User className="w-4 h-4 text-blue-500" />
                      <span className="font-semibold text-gray-700">الاسم:</span>
                      <span className="text-gray-900">{order.customer?.name || 'غير محدد'}</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded bg-blue-25 border border-blue-100 hover:bg-white transition-colors">
                      <Phone className="w-4 h-4 text-blue-500" />
                      <span className="font-semibold text-gray-700">الهاتف:</span>
                      <span className="text-gray-900">{order.customer?.phone || 'غير محدد'}</span>
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded bg-white border border-blue-100 hover:bg-blue-25 transition-colors">
                      <MapPin className="w-4 h-4 text-blue-500 mt-0.5" />
                      <span className="font-semibold text-gray-700">العنوان:</span>
                      <span className="text-gray-900 flex-1">{order.customer?.address || 'غير محدد'}</span>
                    </div>
                    {order.customer?.area && (
                      <div className="flex items-center gap-2 p-2 rounded bg-blue-25 border border-blue-100 hover:bg-white transition-colors">
                        <MapPin className="w-4 h-4 text-blue-500" />
                        <span className="font-semibold text-gray-700">المنطقة:</span>
                        <span className="text-gray-900">{order.customer.area}</span>
                      </div>
                    )}
                    {order.customer?.notes && (
                      <div className="mt-2 p-2 bg-white rounded border">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="w-4 h-4 text-blue-500" />
                          <span className="font-semibold text-gray-700 text-xs">ملاحظات العميل:</span>
                        </div>
                        <p className="text-gray-600 text-xs leading-relaxed">{order.customer.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Information */}
                <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                  <div className="flex items-center gap-2 mb-3">
                    <FileCheck className="w-5 h-5 text-green-600" />
                    <h2 className="text-lg font-bold text-gray-800">بيانات الطلب</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-sm">
                    <div className="flex items-center justify-between p-2 rounded bg-white border border-green-100 hover:bg-green-25 transition-colors">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-green-500" />
                        <span className="font-semibold text-gray-700">التاريخ:</span>
                      </div>
                      <span className="text-gray-900">{formatDate(order.scheduled_date)}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-green-25 border border-green-100 hover:bg-white transition-colors">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-green-500" />
                        <span className="font-semibold text-gray-700">الوقت:</span>
                      </div>
                      <span className="text-gray-900">{formatTime(order.scheduled_time)}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-white border border-green-100 hover:bg-green-25 transition-colors">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-green-500" />
                        <span className="font-semibold text-gray-700">المدة:</span>
                      </div>
                      <span className="text-gray-900">{formatDuration(getOrderDuration(order))}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-green-25 border border-green-100 hover:bg-white transition-colors">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-green-500" />
                        <span className="font-semibold text-gray-700">الحالة:</span>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        order.status === 'completed' ? 'bg-green-100 text-green-800' :
                        order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {getStatusText(order.status)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-white border border-green-100 hover:bg-green-25 transition-colors">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-green-500" />
                        <span className="font-semibold text-gray-700">الدفع:</span>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        order.payment_status === 'paid_cash' || order.payment_status === 'paid_card' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {getPaymentStatusText(order.payment_status)}
                      </span>
                    </div>
                    {order.transport_method && (
                      <div className="flex items-center justify-between p-2 rounded bg-green-25 border border-green-100 hover:bg-white transition-colors">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-green-500" />
                          <span className="font-semibold text-gray-700">النقل:</span>
                        </div>
                        <span className="text-gray-900">{getTransportMethodText(order.transport_method)}</span>
                      </div>
                    )}
                    {order.transport_cost > 0 && (
                      <div className="flex items-center justify-between p-2 rounded bg-white border border-green-100 hover:bg-green-25 transition-colors">
                        <span className="font-semibold text-gray-700">تكلفة النقل:</span>
                        <span className="text-gray-900">{order.transport_cost} ج.م</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between p-2 rounded bg-green-25 border border-green-100 hover:bg-white transition-colors">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-green-500" />
                        <span className="font-semibold text-gray-700">الفريق:</span>
                      </div>
                      <span className={`text-gray-900 ${!order.team ? 'text-gray-500 italic' : ''}`}>
                        {order.team ? order.team.name : 'غير محدد'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-white border border-green-100 hover:bg-green-25 transition-colors">
                      <span className="font-semibold text-gray-700">تاريخ الإنشاء:</span>
                      <span className="text-gray-900">{formatDate(order.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Services Table */}
              <div className="border border-purple-200 rounded-lg bg-purple-50">
                <div className="flex items-center gap-2 p-3 border-b border-purple-200">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h2 className="text-lg font-bold text-gray-800">الخدمات المطلوبة</h2>
                </div>
                {order.items && order.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-purple-100">
                        <tr>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">الخدمة</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-700">الكمية</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-700">سعر الوحدة</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-700">الإجمالي</th>
                          {order.items?.some(item => item.notes) && (
                             <th className="px-3 py-2 text-right font-semibold text-gray-700">ملاحظات</th>
                           )}
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {order.items.map((item) => (
                          <tr key={item.id} className="border-b border-gray-100 bg-white">
                            <td className="px-3 py-2 text-right">
                              <div className="font-medium text-gray-900">{item.service?.name_ar || item.service?.name}</div>
                              {item.service?.description && (
                                <div className="text-gray-500 text-xs mt-1">{item.service.description}</div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">
                                {item.quantity}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center font-medium text-gray-900">{item.unit_price} ج.م</td>
                            <td className="px-3 py-2 text-center font-bold text-purple-600">{item.total_price} ج.م</td>
                            {order.items?.some(i => i.notes) && (
                               <td className="px-3 py-2 text-right text-gray-600 text-xs">{item.notes || '-'}</td>
                             )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-green-100">
                          <td colSpan={order.items?.some(item => item.notes) ? 4 : 3} className="px-3 py-2 text-right font-bold text-gray-800">
                             إجمالي المبلغ:
                           </td>
                          <td className="px-3 py-2 text-center font-bold text-xl text-green-700">{order.total_amount} ج.م</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    لا توجد خدمات مضافة لهذا الطلب
                  </div>
                )}
              </div>

              {/* Bottom Section: Rating, Notes, History - Mobile Responsive */}
              <div className="grid grid-cols-1 gap-4 mobile-friendly-layout">
                {/* Customer Rating & Feedback */}
                {(order.customer_rating || order.customer_feedback) && (
                  <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-5 h-5 text-yellow-600" />
                      <h2 className="text-lg font-bold text-gray-800">تقييم العميل</h2>
                    </div>
                    <div className="space-y-2">
                      {order.customer_rating && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-700 text-sm">التقييم:</span>
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${
                                    i < order.customer_rating! ? 'text-yellow-400 fill-current' : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">({order.customer_rating}/5)</span>
                          </div>
                        </div>
                      )}
                      {order.customer_feedback && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="w-4 h-4 text-yellow-500" />
                            <span className="font-semibold text-gray-700 text-sm">التعليق:</span>
                          </div>
                          <div className="bg-white rounded p-2 border border-yellow-200">
                            <p className="text-gray-700 text-sm leading-relaxed">{order.customer_feedback}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Order Notes */}
                {order.notes && (
                  <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="w-5 h-5 text-orange-600" />
                      <h2 className="text-lg font-bold text-gray-800">ملاحظات الطلب</h2>
                    </div>
                    <div className="bg-white rounded p-3 border border-orange-200">
                      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{order.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status History */}
              {order.status_logs && order.status_logs.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center gap-2 mb-3">
                    <History className="w-5 h-5 text-gray-600" />
                    <h2 className="text-lg font-bold text-gray-800">سجل حالات الطلب</h2>
                  </div>
                  <div className="space-y-2">
                    {order.status_logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 bg-white rounded p-3 border border-gray-200">
                        <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                          log.status === 'completed' ? 'bg-green-500' :
                          log.status === 'in_progress' ? 'bg-blue-500' :
                          log.status === 'cancelled' ? 'bg-red-500' :
                          'bg-yellow-500'
                        }`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-semibold px-2 py-1 rounded text-xs ${
                              log.status === 'completed' ? 'bg-green-100 text-green-800' :
                              log.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              log.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>{getStatusText(log.status)}</span>
                            <span className="text-xs text-gray-500">{formatDate(log.created_at)}</span>
                          </div>
                          {log.notes && (
                            <p className="text-gray-600 text-xs leading-relaxed">{log.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </SmartModal>
  )
}

export default OrderDetailsModal
