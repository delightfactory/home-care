import { LifecycleAPI, RouteSnapshot, OrderSnapshot, ExtensionSnapshot } from '../../api/lifecycle'
import { assignmentSequences } from '../../api/lifecycle-ordering'
import React, { useEffect, useState, useMemo, useRef } from 'react'
import { X, ArrowUp, ArrowDown, Plus, Minus, Save, ClipboardList, RefreshCw, Check, XCircle } from 'lucide-react'
import EnhancedAPI from '../../api/enhanced-api'
import { RoutesAPI } from '../../api'
import { OrderWithDetails, RouteWithOrders, ConfirmationStatus } from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
import SmartModal from '../UI/SmartModal'
import toast from 'react-hot-toast'

interface AssignOrdersModalProps {
  open: boolean
  onClose: () => void
  route: RouteWithOrders
  onSaved: () => void
  mode?: 'assign' | 'extend'
}

const AssignOrdersModal: React.FC<AssignOrdersModalProps> = ({ open, onClose, route, onSaved, mode = 'assign' }) => {
  // Helper to render confirmation badge
  const getConfirmationBadge = (status?: ConfirmationStatus | null) => {
    const statusClasses: Record<ConfirmationStatus, string> = {
      pending: 'bg-gray-200 text-gray-700',
      confirmed: 'bg-green-200 text-green-700',
      declined: 'bg-red-200 text-red-700'
    } as any;

    const statusTexts: Record<ConfirmationStatus, string> = {
      pending: 'غير مؤكد',
      confirmed: 'تم التأكيد',
      declined: 'مرفوضة'
    } as any;

    const iconMap: Record<ConfirmationStatus, JSX.Element> = {
      pending: <RefreshCw className="inline-block w-3 h-3" />,
      confirmed: <Check className="inline-block w-3 h-3" />,
      declined: <XCircle className="inline-block w-3 h-3" />
    } as any;

    const effectiveStatus: ConfirmationStatus = (status && status in statusTexts ? status : 'pending') as ConfirmationStatus;

    return (
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${statusClasses[effectiveStatus]} text-[10px]`}> 
        {iconMap[effectiveStatus]}
        {statusTexts[effectiveStatus]}
      </span>
    )
  }
  const [availableOrders, setAvailableOrders] = useState<OrderWithDetails[]>([])
  const [assignedOrders, setAssignedOrders] = useState<OrderWithDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [extensionError, setExtensionError] = useState('')
  const editingLocked = saving || (mode === 'extend' && attempted)
  const [snapshot, setSnapshot] = useState<RouteSnapshot | null>(null)
  const extensionSnapshot = mode === 'extend' ? snapshot as ExtensionSnapshot | null : null
  const filteredOrders = useMemo(() => availableOrders.filter(order =>
    [order.order_number, order.customer?.name, order.customer?.phone, order.customer?.area, order.customer?.address]
      .some(value => String(value || '').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))), [availableOrders, search])
  const [newOrderSnapshots, setNewOrderSnapshots] = useState<Record<string, OrderSnapshot>>({})
  const [destinations, setDestinations] = useState<RouteWithOrders[]>([])
  const [destinationId, setDestinationId] = useState('')
  const [destinationSnapshot, setDestinationSnapshot] = useState<RouteSnapshot | null>(null)
  const destinationRequest = useRef(0)
  const session = useRef(0)
  const currentModal = useRef({ open, routeId: route.id })
  currentModal.current = { open, routeId: route.id }
  const pendingAdditions = useRef(new Set<string>())
  const [addingOrders, setAddingOrders] = useState<string[]>([])
  const savingNow = useRef(false)
  const isCurrentSession = (version: number) => version === session.current &&
    currentModal.current.open && currentModal.current.routeId === route.id
  const closeModal = () => {
    if (mode === 'extend' && savingNow.current) return
    session.current++
    pendingAdditions.current.clear()
    setAddingOrders([])
    destinationRequest.current++
    onClose()
  }

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

  useEffect(() => {
    session.current++
    pendingAdditions.current.clear()
    setAddingOrders([])
    savingNow.current = false
    setSaving(false)
    setSearch('')
    setConfirmed(false)
    setAttempted(false)
    setExtensionError('')
    if (!open) return
    const version = session.current
    let cancelled = false

    const init = async () => {
      try {
        setLoading(true)
        setSnapshot(null)
        setNewOrderSnapshots({})
        destinationRequest.current++
        setDestinationId('')
        setDestinationSnapshot(null)
        const expected = mode === 'extend' ? await LifecycleAPI.snapshot('extend', route.id) : await LifecycleAPI.snapshot('route', route.id)
        const fresh = await RoutesAPI.getRoute(route.id)
        if (cancelled || !isCurrentSession(version)) return
        if (!fresh || fresh.route_orders?.length !== expected.links.length || expected.links.some(link => !fresh.route_orders?.some(ro =>
          ro.id === link.id && ro.sequence_order === link.sequence_order && ro.order?.status === link.order.status &&
          ro.order?.team_id === link.order.team_id && Date.parse(ro.order.updated_at) === Date.parse(link.order.updated_at))))
          throw new Error('تغيرت بيانات الخط أثناء التحميل. أغلق النموذج وافتحه مجدداً')
        const available = await RoutesAPI.getAvailableOrders(fresh.date as string)
        const nextDestinations = mode === 'extend' ? [] : (await RoutesAPI.getRoutesByDate(fresh.date)).filter(item => item.id !== route.id && item.status !== 'completed' && !item.actual_end_time)
        if (cancelled || !isCurrentSession(version)) return
        setSnapshot(expected)
        setDestinations(nextDestinations)
        // assigned orders
        const assigned = (fresh.route_orders || []).slice()
          .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
          .map((ro) => ro.order!)

        // Filter out assigned from available list
        const remaining = available.filter((o: OrderWithDetails) => !assigned.find((a) => a.id === o.id))

        setAssignedOrders(assigned)
        setAvailableOrders(remaining)
      } catch (error) {
        if (!cancelled && isCurrentSession(version)) toast.error(error instanceof Error ? error.message : 'تعذر تحميل الطلبات')
        if (!cancelled && isCurrentSession(version) && mode === 'extend') setExtensionError(error instanceof Error ? error.message : 'تعذر تحميل الخط')
        console.error(error)
      } finally {
        if (!cancelled && isCurrentSession(version)) setLoading(false)
      }
    }

    init()
    return () => { cancelled = true; session.current++; pendingAdditions.current.clear(); destinationRequest.current++ }
    // Capture once per modal session. Background refresh must never replace an
    // uncertain operation's original snapshot or discard unsaved edits.
  }, [open, route.id, mode])

  const addOrder = async (order: OrderWithDetails) => {
    if (!isCurrentSession(session.current) || !snapshot || savingNow.current || (mode === 'extend' && attempted) || pendingAdditions.current.has(order.id)) return
    const version = session.current
    pendingAdditions.current.add(order.id)
    setAddingOrders([...pendingAdditions.current])
    try {
      if (snapshot?.links.some(link => link.order_id === order.id)) {
        setAssignedOrders(prev => prev.some(item => item.id === order.id) ? prev : [...prev, order])
        setAvailableOrders(prev => prev.filter(item => item.id !== order.id))
        return
      }
      const expected = await LifecycleAPI.snapshot('order', order.id)
      if (!isCurrentSession(version)) return
      if (expected.links.length || expected.history || Date.parse(expected.updated_at) !== Date.parse(order.updated_at))
        throw new Error('تغيرت بيانات الطلب أو أصبح مرتبطاً بخط. حدّث القائمة قبل إضافته')
      setNewOrderSnapshots(prev => ({ ...prev, [order.id]: expected }))
      setAssignedOrders(prev => prev.some(item => item.id === order.id) ? prev : [...prev, order])
      setAvailableOrders(prev => prev.filter(item => item.id !== order.id))
    } catch (error) {
      if (isCurrentSession(version)) toast.error(error instanceof Error ? error.message : 'تعذر تحميل سياق الطلب')
    } finally {
      if (isCurrentSession(version)) {
        pendingAdditions.current.delete(order.id)
        setAddingOrders([...pendingAdditions.current])
      }
    }
  }
  const removeOrder = (order: OrderWithDetails) => {
    if (editingLocked) return
    setAvailableOrders([...availableOrders, order])
    setAssignedOrders(assignedOrders.filter((o) => o.id !== order.id))
  }

  const moveOrder = (index: number, direction: 'up' | 'down') => {
    if (editingLocked) return
    const newArr = [...assignedOrders]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newArr.length) return
    const temp = newArr[index]
    newArr[index] = newArr[targetIndex]
    newArr[targetIndex] = temp
    setAssignedOrders(newArr)
  }

  const canChange = (order: OrderWithDetails) => {
    if (mode === 'extend' && (attempted || snapshot?.links.some(link => link.order_id === order.id))) return false
    const original = snapshot?.links.find(link => link.order_id === order.id)?.order
    return (order.status === 'pending' || order.status === 'scheduled') &&
      (!original || (!original.history && original.links.length === 1))
  }
  const transferOrder = async (order: OrderWithDetails) => {
    if (savingNow.current || pendingAdditions.current.size || !isCurrentSession(session.current)) return
    if (!snapshot || !destinationSnapshot) return
    const originalIds = snapshot.links.slice().sort((a, b) => a.sequence_order - b.sequence_order).map(link => link.order_id)
    if (originalIds.length !== assignedOrders.length || originalIds.some((id, index) => assignedOrders[index]?.id !== id)) {
      toast.error('احفظ تعديلات القائمة أو أعد فتحها قبل نقل الطلب')
      return
    }
    const version = session.current
    savingNow.current = true
    setSaving(true)
    try {
      const result = await EnhancedAPI.transferOrder(snapshot, destinationSnapshot, order.id)
      if (!isCurrentSession(version)) return
      if (!result.success) throw new Error(result.error)
      toast.success('تم نقل الطلب وحفظ حالته وفريقه')
      onSaved()
      closeModal()
    } catch (error) { if (isCurrentSession(version)) toast.error(error instanceof Error ? error.message : 'تعذر نقل الطلب') }
    finally { if (isCurrentSession(version)) { savingNow.current = false; setSaving(false) } }
  }
  const chooseDestination = async (id: string) => {
    const request = ++destinationRequest.current
    setDestinationId(id)
    setDestinationSnapshot(null)
    if (!id) return
    try {
      const expected = await LifecycleAPI.snapshot('route', id)
      const displayed = destinations.find(item => item.id === id)
      if (!displayed || Date.parse(displayed.updated_at) !== Date.parse(expected.updated_at))
        throw new Error('تغير خط الوجهة. أعد تحميل القائمة قبل النقل')
      if (request === destinationRequest.current) setDestinationSnapshot(expected)
    } catch (error) {
      if (request === destinationRequest.current)
        toast.error(error instanceof Error ? error.message : 'تعذر تحميل خط الوجهة')
    }
  }

  const handleSave = async () => {
    if (savingNow.current || pendingAdditions.current.size || !isCurrentSession(session.current)) return
    const version = session.current
    savingNow.current = true
    setSaving(true)
    try {
      if (!snapshot) throw new Error('انتظر تحميل بيانات خط السير قبل الحفظ')
      let result
      if (mode === 'extend') {
        const additions = assignedOrders.filter(order => !snapshot.links.some(link => link.order_id === order.id))
        if (!confirmed || !additions.length) throw new Error('اختر طلبًا إضافيًا على الأقل وأكد استمرار عمل الفريق')
        const expected = additions.map(order => newOrderSnapshots[order.id])
        if (expected.some(order => !order)) throw new Error('انتظر تجهيز جميع الطلبات قبل الحفظ')
        setAttempted(true)
        setExtensionError('')
        result = await RoutesAPI.extendRoute(snapshot as ExtensionSnapshot, expected)
      } else {
        const sequences = assignmentSequences(snapshot, assignedOrders.map(order => order.id))
        const desired = assignedOrders.map((order, index) => ({
        order_id: order.id, sequence_order: sequences[index],
        ...(newOrderSnapshots[order.id] ? { expected: newOrderSnapshots[order.id] } : {}),
        }))
        result = await EnhancedAPI.saveRouteOrders(snapshot, desired)
      }
      if (!isCurrentSession(version)) return
      if (!result.success) throw new Error(result.error)

      toast.success(mode === 'extend' ? 'تم تمديد خط السير وإضافة الطلبات' : 'تم حفظ الطلبات')
      onSaved()
      savingNow.current = false
      closeModal()
    } catch (error) {
      if (isCurrentSession(version)) toast.error(error instanceof Error ? error.message : 'حدث خطأ أثناء الحفظ')
      if (isCurrentSession(version) && mode === 'extend') setExtensionError(error instanceof Error ? error.message : 'تعذر تأكيد التمديد')
      console.error(error)
    } finally {
      if (isCurrentSession(version)) { savingNow.current = false; setSaving(false) }
    }
  }

  

  return (
    <SmartModal
      isOpen={open}
      onClose={closeModal}
      title={`${mode === 'extend' ? 'تمديد خط السير' : 'إدارة طلبات خط السير'}: ${route.name}`}
      subtitle={`التاريخ: ${route.date}`}
      icon={<ClipboardList className="h-6 w-6 text-white" />}
      size="xl"
      headerGradient="from-blue-600 via-purple-600 to-indigo-700"
      closeOnOutsideClick={mode === 'extend' ? false : undefined}
      closeOnEscape={mode === 'extend' ? !saving : undefined}
      showCloseButton={mode === 'extend' ? !saving : undefined}
    >
      <div className="bg-white w-full max-w-4xl rounded-lg p-6 overflow-y-auto max-h-[90vh] pb-28">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{mode === 'extend' ? 'تمديد خط السير' : 'إدارة طلبات خط السير'}: {route.name}</h2>
          <button
            className="text-gray-400 hover:text-gray-600"
            onClick={closeModal}
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {extensionSnapshot && <div className="bg-blue-50 p-3 rounded text-sm space-y-1 mb-4">
          <p>الفريق: {extensionSnapshot.team_name || 'غير معين'}</p>
          <p>العمال: {extensionSnapshot.members.filter(member => !member.left_at).map(member => member.name).join('، ') || 'لا يوجد أعضاء'}</p>
          <p>الإغلاق السابق: {extensionSnapshot.actual_end_time ? new Date(extensionSnapshot.actual_end_time).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }) : 'غير مثبت'}</p>
        </div>}
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
              <input className="input mb-2 w-full" aria-label="بحث في الطلبات المتاحة" placeholder="ابحث برقم الطلب أو العميل أو المنطقة" value={search} onChange={event => setSearch(event.target.value)} />
                {filteredOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between p-2 border-b last:border-0">
                    <div>
                      <p className="font-medium flex items-center gap-1">{o.order_number} · {o.customer?.name || o.id} {getConfirmationBadge(o.confirmation_status as any)}</p>
                      <p className="text-xs text-gray-500">{o.scheduled_time} {o.customer?.area ? `- ${o.customer.area}` : ''}</p>
                      <p className="text-xs text-gray-500">مدة: {formatDuration(getOrderDuration(o))} • خدمات: {o.items?.length || 0}</p>
                    </div>
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => addOrder(o)}
                      disabled={editingLocked || !snapshot || addingOrders.includes(o.id)}
                      aria-label={addingOrders.includes(o.id) ? 'جاري تجهيز إضافة الطلب' : 'إضافة الطلب'}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {filteredOrders.length === 0 && (
                  <p className="text-center text-gray-500 mt-4">{search.trim() ? 'لا توجد طلبات تطابق البحث' : 'لا توجد طلبات'}</p>
                )}
              </div>
            </div>

            {/* Assigned orders */}
            <div>
              <h3 className="font-medium mb-2">الطلبات في الخط ({assignedOrders.length})</h3>
              {mode === 'assign' && <label className="block text-sm mb-2">
                نقل طلب إلى خط آخر
                <select className="input mt-1 w-full" value={destinationId} disabled={saving} onChange={event => { void chooseDestination(event.target.value) }}>
                  <option value="">اختر خط الوجهة</option>
                  {destinations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>}
              <div className="border rounded-lg p-2 h-96 overflow-y-auto">
                {assignedOrders.map((o, idx) => (
                  <div key={o.id} className="flex items-center justify-between p-2 border-b last:border-0">
                    <div>
                      <p className="font-medium flex items-center gap-1">#{idx + 1} - {o.order_number} · {o.customer?.name || o.id} {getConfirmationBadge(o.confirmation_status as any)}</p>
                      <p className="text-xs text-gray-500">{o.scheduled_time} {o.customer?.area ? `- ${o.customer.area}` : ''}</p>
                      <p className="text-xs text-gray-500">مدة: {formatDuration(getOrderDuration(o))} • خدمات: {o.items?.length || 0}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1 hover:bg-gray-100 rounded"
                        onClick={() => moveOrder(idx, 'up')}
                        aria-label="تقديم الطلب"
                        disabled={saving || idx === 0 || !canChange(o) || (idx > 0 && !canChange(assignedOrders[idx - 1]))}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        className="p-1 hover:bg-gray-100 rounded"
                        onClick={() => moveOrder(idx, 'down')}
                        aria-label="تأخير الطلب"
                        disabled={saving || idx === assignedOrders.length - 1 || !canChange(o) || (idx + 1 < assignedOrders.length && !canChange(assignedOrders[idx + 1]))}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        className="btn-danger btn-sm"
                        onClick={() => removeOrder(o)}
                        aria-label="إزالة الطلب من القائمة"
                        disabled={saving || !canChange(o)}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      {mode === 'assign' && snapshot?.links.some(link => link.order_id === o.id) && <button
                        className="btn-secondary btn-sm" onClick={() => transferOrder(o)}
                        disabled={saving || addingOrders.length > 0 || !destinationSnapshot || !canChange(o)}>نقل</button>}
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



        
        {mode === 'extend' && <div className="mt-4 space-y-2">
          <p className="text-sm text-gray-600">الطلبات السابقة ثابتة. أضف الطلبات الجديدة ورتّبها؛ تُحفظ جميعها معًا، ويُسجل الانصراف تلقائيًا بعد إنهاء آخر طلب.</p>
          <label className="flex gap-2"><input type="checkbox" checked={confirmed} disabled={editingLocked} onChange={event => setConfirmed(event.target.checked)} />أؤكد أن نفس الفريق والعمال ما زالوا يعملون ولم يغادروا، وأن الفترة جزء من يوم العمل المستمر.</label>
          <p className="text-sm text-amber-800">يُصحح الانصراف الآلي السابق وتُحتسب فترة استمرار العمل ضمن ساعات اليوم. الانصراف اليدوي أو القديم غير الموثق لا يُعدل.</p>
          {extensionError && <p role="alert" className="text-red-700">{extensionError}</p>}
          {attempted && extensionError && <p className="text-sm">المحاولة محفوظة بنفس الطلبات والترتيب؛ أعد نفس المحاولة لتأكيدها دون تكرار الإضافة.</p>}
        </div>}
        {addingOrders.length > 0 && <p role="status" className="mt-4 text-sm text-blue-700">جاري تجهيز إضافة الطلبات؛ انتظر قبل الحفظ أو النقل.</p>}
        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 bg-white sticky bottom-0 left-0 right-0 z-10">
          <button className="btn-secondary" onClick={closeModal} disabled={saving}>
            إلغاء
          </button>
          <button
            className="btn-primary flex items-center gap-1"
            onClick={handleSave}
            disabled={saving || addingOrders.length > 0 || loading || !snapshot || (mode === 'extend' && (!confirmed || !assignedOrders.some(order => !snapshot.links.some(link => link.order_id === order.id))))}
          >
            <Save className="h-4 w-4" /> {mode === 'extend' ? saving ? 'جارٍ تأكيد التمديد...' : attempted ? 'إعادة نفس المحاولة' : 'تمديد وإضافة الطلبات' : 'حفظ'}
          </button>
        </div>
      </div>
    </SmartModal>
  )
}

export default AssignOrdersModal
