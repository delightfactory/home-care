import React, { useEffect, useState } from 'react'
import SmartModal from '../UI/SmartModal'
import LoadingSpinner from '../UI/LoadingSpinner'
import { OrdersAPI } from '../../api'
import { OrderWithDetails } from '../../types'

interface OrderDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  orderId?: string
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ isOpen, onClose, orderId }) => {
  const [order, setOrder] = useState<OrderWithDetails | null>(null)
  const [loading, setLoading] = useState(false)

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

  return (
    <SmartModal isOpen={isOpen} onClose={onClose} title="تفاصيل الطلب" size="lg">
      {loading || !order ? (
        <div className="p-6 flex justify-center">
          <LoadingSpinner text="جاري تحميل التفاصيل..." />
        </div>
      ) : (
        <div className="p-6 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4 text-gray-700">
            <div>
              <span className="font-semibold">رقم الطلب:</span> {order.order_number}
            </div>
            <div>
              <span className="font-semibold">العميل:</span> {(order as any).customer_name ?? order.customer?.name}
            </div>
            <div>
              <span className="font-semibold">التاريخ:</span> {order.scheduled_date}
            </div>
            <div>
              <span className="font-semibold">الوقت:</span> {order.scheduled_time}
            </div>
            <div>
              <span className="font-semibold">الحالة:</span> {order.status}
            </div>
            <div>
              <span className="font-semibold">إجمالي المبلغ:</span> {order.total_amount} ج.م
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">الخدمات</h3>
            {order.items && order.items.length > 0 ? (
              <table className="w-full text-left border rounded-lg overflow-hidden text-xs rtl:text-right">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-3 py-2">الخدمة</th>
                    <th className="px-3 py-2">الكمية</th>
                    <th className="px-3 py-2">سعر الوحدة</th>
                    <th className="px-3 py-2">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map(item => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">{item.service?.name_ar || item.service?.name}</td>
                      <td className="px-3 py-2">{item.quantity}</td>
                      <td className="px-3 py-2">{item.unit_price}</td>
                      <td className="px-3 py-2">{item.total_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500">لا توجد خدمات.</p>
            )}
          </div>

          {order.notes && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">ملاحظات</h3>
              <p className="text-gray-600 text-xs whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>
      )}
    </SmartModal>
  )
}

export default OrderDetailsModal
