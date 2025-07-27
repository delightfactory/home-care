import React, { useEffect, useState } from 'react'
import SmartModal from '../UI/SmartModal'
import LoadingSpinner from '../UI/LoadingSpinner'
import EnhancedAPI from '../../api/enhanced-api'
import { CustomerWithOrders } from '../../types'

interface CustomerDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  customerId?: string
}

const CustomerDetailsModal: React.FC<CustomerDetailsModalProps> = ({ isOpen, onClose, customerId }) => {
  const [customer, setCustomer] = useState<CustomerWithOrders | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchDetails = async () => {
      if (!isOpen || !customerId) return
      try {
        setLoading(true)
        const data = await EnhancedAPI.getCustomerById(customerId)
        if (data) setCustomer(data)
      } catch (error) {
        console.error('Fetch customer details error:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchDetails()
  }, [isOpen, customerId])

  return (
    <SmartModal isOpen={isOpen} onClose={onClose} title="تفاصيل العميل" size="lg">
      {loading || !customer ? (
        <div className="p-6 flex justify-center">
          <LoadingSpinner text="جاري تحميل التفاصيل..." />
        </div>
      ) : (
        <div className="p-6 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4 text-gray-700">
            <div>
              <span className="font-semibold">الاسم:</span> {customer.name}
            </div>
            <div>
              <span className="font-semibold">رقم الهاتف:</span> {customer.phone}
            </div>
            {customer.extra_phone && (
              <div>
                <span className="font-semibold">رقم هاتف إضافي:</span> {customer.extra_phone}
              </div>
            )}
            <div>
              <span className="font-semibold">المنطقة:</span> {customer.area || 'غير محدد'}
            </div>
            {customer.referral_source && (
              <div>
                <span className="font-semibold">مصدر الإحالة:</span> {customer.referral_source}
              </div>
            )}
            <div>
              <span className="font-semibold">الحالة:</span> {customer.is_active ? 'نشط' : 'موقوف'}
            </div>
            <div>
              <span className="font-semibold">عدد الطلبات:</span> {customer.total_orders ?? 0}
            </div>
            {customer.last_order_date && (
              <div>
                <span className="font-semibold">آخر طلب:</span> {new Date(customer.last_order_date).toLocaleDateString('ar-AE')}
              </div>
            )}
            <div>
              <span className="font-semibold">تاريخ التسجيل:</span> {new Date(customer.created_at).toLocaleDateString('ar-AE')}
            </div>
          </div>

          {customer.notes && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">ملاحظات</h3>
              <p className="text-gray-600 text-xs whitespace-pre-wrap">{customer.notes}</p>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-gray-800 mb-2">سجل الطلبات</h3>
            {customer.orders && customer.orders.length > 0 ? (
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left border rounded-lg overflow-hidden text-xs rtl:text-right">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">التاريخ</th>
                      <th className="px-3 py-2">المبلغ</th>
                      <th className="px-3 py-2">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.orders.map(order => (
                      <tr key={order.id} className="border-t">
                        <td className="px-3 py-2 whitespace-nowrap">{order.order_number}</td>
                        <td className="px-3 py-2">{new Date(order.created_at).toLocaleDateString('ar-AE')}</td>
                        <td className="px-3 py-2">{order.total_amount}</td>
                        <td className="px-3 py-2">{order.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">لا توجد طلبات.</p>
            )}
          </div>
        </div>
      )}
    </SmartModal>
  )
}

export default CustomerDetailsModal
