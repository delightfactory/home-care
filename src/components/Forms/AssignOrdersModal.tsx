import React, { useEffect, useState, useMemo } from 'react'
import { X, ArrowUp, ArrowDown, Plus, Minus, Save, ClipboardList } from 'lucide-react'
import { RoutesAPI } from '../../api'
import { OrderWithDetails, RouteWithOrders } from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
import SmartModal from '../UI/SmartModal'
import toast from 'react-hot-toast'

interface AssignOrdersModalProps {
  open: boolean
  onClose: () => void
  route: RouteWithOrders
  onSaved: () => void
}

const AssignOrdersModal: React.FC<AssignOrdersModalProps> = ({ open, onClose, route, onSaved }) => {
  const [availableOrders, setAvailableOrders] = useState<OrderWithDetails[]>([])
  const [assignedOrders, setAssignedOrders] = useState<OrderWithDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Helper: calculate total expected execution duration (in minutes) for an order
  const getOrderDuration = (order: OrderWithDetails): number => {
    if (!order.items) return 0
    return order.items.reduce((sum, item) => {
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

  // Total duration across assigned orders
  const totalDuration = useMemo(() => assignedOrders.reduce((sum, o) => sum + getOrderDuration(o), 0), [assignedOrders])
  const hours = Math.floor(totalDuration / 60)
  const minutes = totalDuration % 60

  // Original ids for diff
  const originalAssignedIds = route.route_orders?.map((ro) => ro.order_id) || []

  useEffect(() => {
    if (!open) return

    const init = async () => {
      try {
        setLoading(true)
        // Fetch available orders for the route date
        const available = await RoutesAPI.getAvailableOrders(route.date as string)
        // assigned orders
        const assigned = (route.route_orders || [])
          .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
          .map((ro) => ro.order!)

        // Filter out assigned from available list
        const remaining = available.filter((o) => !assigned.find((a) => a.id === o.id))

        setAssignedOrders(assigned)
        setAvailableOrders(remaining)
      } catch (error) {
        toast.error('تعذر تحميل الطلبات')
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [open, route])

  const addOrder = (order: OrderWithDetails) => {
    setAssignedOrders([...assignedOrders, order])
    setAvailableOrders(availableOrders.filter((o) => o.id !== order.id))
  }
  const removeOrder = (order: OrderWithDetails) => {
    setAvailableOrders([...availableOrders, order])
    setAssignedOrders(assignedOrders.filter((o) => o.id !== order.id))
  }

  const moveOrder = (index: number, direction: 'up' | 'down') => {
    const newArr = [...assignedOrders]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newArr.length) return
    const temp = newArr[index]
    newArr[index] = newArr[targetIndex]
    newArr[targetIndex] = temp
    setAssignedOrders(newArr)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const assignedIds = assignedOrders.map((o) => o.id)

      // Determine removals and additions
      const toRemove = originalAssignedIds.filter((id) => !assignedIds.includes(id))
      const toAdd = assignedIds.filter((id) => !originalAssignedIds.includes(id))

      // Perform removals
      await Promise.all(toRemove.map((id) => RoutesAPI.removeOrderFromRoute(route.id, id)))

      // Perform additions
      await Promise.all(
        toAdd.map((id) => {
          const seq = assignedIds.indexOf(id) + 1
          return RoutesAPI.addOrderToRoute(route.id, id, seq)
        })
      )

      // Reorder sequence for remaining orders
      const sequences = assignedIds.map((id, idx) => ({ order_id: id, sequence_order: idx + 1 }))
      await RoutesAPI.reorderRouteOrders(route.id, sequences)

      toast.success('تم حفظ الطلبات')
      onSaved()
      onClose()
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  

  return (
    <SmartModal
      isOpen={open}
      onClose={onClose}
      title={`إدارة طلبات خط السير: ${route.name}`}
      subtitle={`التاريخ: ${route.date}`}
      icon={<ClipboardList className="h-6 w-6 text-white" />}
      size="xl"
      headerGradient="from-blue-600 via-purple-600 to-indigo-700"
    >
      <div className="bg-white w-full max-w-4xl rounded-lg p-6 overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">إدارة طلبات خط السير: {route.name}</h2>
          <button
            className="text-gray-400 hover:text-gray-600"
            onClick={onClose}
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <LoadingSpinner size="large" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Available orders */}
            <div>
              <h3 className="font-medium mb-2">الطلبات المتاحة ({availableOrders.length})</h3>
              <div className="border rounded-lg p-2 h-96 overflow-y-auto">
                {availableOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between p-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{o.customer?.name || o.id}</p>
                      <p className="text-xs text-gray-500">{o.scheduled_time} {o.customer?.area ? `- ${o.customer.area}` : ''}</p>
                      <p className="text-xs text-gray-500">مدة: {formatDuration(getOrderDuration(o))} • خدمات: {o.items?.length || 0}</p>
                    </div>
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => addOrder(o)}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {availableOrders.length === 0 && (
                  <p className="text-center text-gray-500 mt-4">لا توجد طلبات</p>
                )}
              </div>
            </div>

            {/* Assigned orders */}
            <div>
              <h3 className="font-medium mb-2">الطلبات في الخط ({assignedOrders.length})</h3>
              <div className="border rounded-lg p-2 h-96 overflow-y-auto">
                {assignedOrders.map((o, idx) => (
                  <div key={o.id} className="flex items-center justify-between p-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">#{idx + 1} - {o.customer?.name || o.id}</p>
                      <p className="text-xs text-gray-500">{o.scheduled_time} {o.customer?.area ? `- ${o.customer.area}` : ''}</p>
                      <p className="text-xs text-gray-500">مدة: {formatDuration(getOrderDuration(o))} • خدمات: {o.items?.length || 0}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1 hover:bg-gray-100 rounded"
                        onClick={() => moveOrder(idx, 'up')}
                        disabled={idx === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        className="p-1 hover:bg-gray-100 rounded"
                        onClick={() => moveOrder(idx, 'down')}
                        disabled={idx === assignedOrders.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        className="btn-danger btn-sm"
                        onClick={() => removeOrder(o)}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {assignedOrders.length === 0 && (
                  <p className="text-center text-gray-500 mt-4">لا توجد طلبات مضافة</p>
                )}
              </div>
              {(hours > 0 || minutes > 0) && (
                <div className="mt-2 flex gap-2 text-xs font-semibold">
                  {hours > 0 && (
                    <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{hours} س</span>
                  )}
                  {minutes > 0 && (
                    <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{minutes} د</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}



        
        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            إلغاء
          </button>
          <button
            className="btn-primary flex items-center gap-1"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-4 w-4" /> حفظ
          </button>
        </div>
      </div>
    </SmartModal>
  )
}

export default AssignOrdersModal
