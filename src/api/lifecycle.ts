import { supabase } from '../lib/supabase'
import { ApiResponse } from '../types'

export interface OrderSnapshot {
  epoch: string
  id: string
  status: string
  team_id: string | null
  updated_at: string
  history: boolean
  links: { id: string; route_id: string; sequence_order: number; team_id: string | null; status: string; updated_at: string }[]
}
export interface RouteSnapshot {
  epoch: string
  id: string
  team_id: string | null
  status: string
  updated_at: string
  links: { id: string; order_id: string; sequence_order: number; order: OrderSnapshot }[]
}
export interface EditOrderSnapshot extends OrderSnapshot {
  data: Record<string, any>
  total_amount: number
  items: { id: string; service_id: string | null; quantity: number; unit_price: number; total_price: number; [key: string]: any }[]
}
export interface DesiredLink {
  order_id: string
  sequence_order: number
  expected?: OrderSnapshot
  estimated_arrival_time?: string
  estimated_completion_time?: string
}
export interface ExtensionSnapshot extends RouteSnapshot {
  date: string
  actual_start_time: string | null
  actual_end_time: string | null
  leader_id: string | null
  team_name: string | null
  members: { id: string; worker_id: string; name: string; joined_at: string; left_at: string | null }[]
  attendance: { id: string; worker_id: string; check_in_time: string | null; check_out_time: string | null; check_out_method: string | null; auto_checkout_route_id: string | null }[]
}
interface LifecycleResult {
  committed: boolean
  replayed?: boolean
  snapshot?: RouteSnapshot
  route?: any
  order_id?: string
  order?: any
  started_at?: string
}

const messages: Record<string, string> = {
  LC_EXTENSION_CONFIRM: 'أكد أن الفريق ما زال يعمل ولم يغادر المنطقة',
  LC_EXTENSION_DAY: 'التمديد متاح لطلبات وخطوط اليوم فقط. تعذر تأكيد يوم العمل الحالي',
  LC_EXTENSION_CLOSED: 'التمديد متاح لخط انتهت جميع طلباته وسُجل إغلاقه',
  LC_EXTENSION_MEMBERS: 'تغير قائد الفريق أو عضوية عامل شارك في الخط أو سُجل انصرافه منه. يلزم مراجعة العمليات قبل التمديد',
  LC_EXTENSION_HISTORY: 'سجل المشاركين في طلبات الخط ناقص أو غير متسق. يلزم مراجعة العمليات قبل التمديد',
  LC_EXTENSION_ROUTES: 'للفريق أكثر من خط سير في هذا اليوم. يلزم مراجعة العمليات قبل التمديد',
  LC_EXTENSION_LEADER: 'لا يمكن تمديد الخط حتى يكون حساب قائد الفريق فعّالًا ولديه صلاحية بدء الطلبات. راجع حساب القائد وصلاحياته',
  LC_EXTENSION_ATTENDANCE: 'تعذر إثبات الانصراف الآلي لكل أعضاء الفريق من هذا الخط. لا يمكن تمديده تلقائيًا',
  LC_EXTENSION_AUDIT: 'تعذر تسجيل دليل التمديد. لم يتم حفظ أي تغيير؛ أعد المحاولة',
  LC_AUTO_CHECKOUT_ACTIVE: 'لا يمكن تسجيل انصراف آلي مع وجود طلب غير منتهٍ',
  LC_AUTO_CHECKOUT_SOURCE: 'تعذر تأكيد مصدر الانصراف الآلي',
  LC_DENIED: 'ليس لديك صلاحية تنفيذ هذا الإجراء على الطلب أو الفريق الحالي',
  LC_CONFLICT: 'تغيرت بيانات الطلب أو خط السير. حدّث البيانات وراجع التعديل قبل الحفظ',
  LC_REQUEST_CONFLICT: 'هذه المحاولة تخص عملية مختلفة. حدّث البيانات قبل المحاولة',
  LC_HISTORY: 'لا يمكن تعديل الجدولة لطلب له تاريخ تنفيذ. يلزم مراجعة العمليات',
  LC_AMBIGUOUS: 'الطلب غير مرتبط بخط واحد. يلزم مراجعة روابطه قبل المتابعة',
  LC_REFRESH: 'يلزم تحديث التطبيق قبل تنفيذ هذا الإجراء',
  LC_NOT_SCHEDULED: 'أضف الطلب إلى خط سير واعتمده كمجدول قبل بدء التنفيذ',
  LC_TEAM: 'راجع تعيين فريق الطلب وخط السير قبل بدء التنفيذ',
  LC_MEMBERS: 'الفريق لا يحتوي على أعضاء وقت بدء التنفيذ',
  LC_ROUTE_DELETE: 'لا يمكن حذف خط له طلبات أو تاريخ تنفيذ',
  LC_ORDER_DELETE: 'لا يمكن حذف طلب مرتبط بخط أو له تاريخ تنفيذ أو فاتورة. راجع العمليات',
  LC_TRANSFER_REQUIRED: 'الطلب مرتبط بخط آخر. استخدم النقل بين الخطوط',
  LC_NOT_FOUND: 'تعذر العثور على الطلب أو خط السير. حدّث البيانات',
  LC_INVALID: 'تعذر حفظ التعديل. راجع البيانات والترتيب',
  LC_EPOCH: 'تغيرت نسخة البيانات بعد استعادة أو تصفير. أعد تحميل التطبيق وراجع العملية',
}
export function lifecycleError(error: any): string {
  const message = String(error?.message || '')
  const key = Object.keys(messages).find(code => message.includes(code))
  if (key) return messages[key]
  if (error?.code === '40P01' || error?.code === '40001') return 'تعارضت العملية مع تعديل آخر. حدّث البيانات وراجعها قبل المحاولة'
  return 'تعذر تأكيد نتيجة العملية. أعد نفس المحاولة قبل إجراء تعديل جديد'
}

// Keep the exact original snapshot and request UUID on an uncertain transport
// failure. Never refresh the snapshot and silently retry a different operation.
const pending = new Map<string, { request: string; payload: Record<string, any> }>()
const prepared = new Map<string, Record<string, any>>()
// One epoch per signed-in browser session. A fresh snapshot must never silently
// convert a pre-recovery retry into a new write against restored data.
const sessionEpochs = new Map<string, string>()
function stable(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

export class LifecycleAPI {
  static async execute(intent: Record<string, any>, prepare: () => Promise<Record<string, any>>) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: messages.LC_DENIED } as ApiResponse<LifecycleResult>
    const key = `${user.id}:${stable(intent)}`
    const payload = prepared.get(key) ?? await prepare()
    prepared.set(key, payload)
    const result = await this.mutate(payload)
    if (!pending.has(`${user.id}:${stable(payload)}`)) prepared.delete(key)
    return result
  }
  static async snapshot(kind: 'route', id: string): Promise<RouteSnapshot>
  static async snapshot(kind: 'order', id: string): Promise<OrderSnapshot>
  static async snapshot(kind: 'edit_order', id: string): Promise<EditOrderSnapshot>
  static async snapshot(kind: 'extend', id: string): Promise<ExtensionSnapshot>
  static async snapshot(kind: 'route' | 'order' | 'edit_order' | 'extend', id: string): Promise<RouteSnapshot | OrderSnapshot | EditOrderSnapshot | ExtensionSnapshot> {
    const { data, error } = await supabase.rpc('lifecycle_snapshot', { p_kind: kind, p_id: id })
    if (error) throw new Error(lifecycleError(error))
    const { data: { user } } = await supabase.auth.getUser()
    const epoch = (data as any)?.epoch
    if (!user || !epoch) throw new Error(messages.LC_EPOCH)
    const retained = sessionEpochs.get(user.id)
    if (retained && retained !== epoch) throw new Error(messages.LC_EPOCH)
    sessionEpochs.set(user.id, epoch)
    return data as unknown as RouteSnapshot | OrderSnapshot
  }

  static async mutate(payload: Record<string, any>): Promise<ApiResponse<LifecycleResult>> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: messages.LC_DENIED }
    const epoch = payload.expected?.epoch
    const retained = sessionEpochs.get(user.id)
    if (!epoch || (retained && epoch !== retained)) return { success: false, error: messages.LC_EPOCH }
    if (!retained) sessionEpochs.set(user.id, epoch)
    const key = `${user.id}:${stable(payload)}`
    let operation = pending.get(key)
    if (!operation) {
      operation = { request: crypto.randomUUID(), payload }
      pending.set(key, operation)
    }
    try {
      const { data, error } = await supabase.rpc('lifecycle_mutate', { p_request: operation.request, p_payload: operation.payload })
      if (error) {
        // SQL error proves rollback; network/timeout does not prove non-commit.
        if (/^[0-9A-Z]{5}$/.test(error.code ?? '')) pending.delete(key)
        return { success: false, error: lifecycleError(error) }
      }
      pending.delete(key)
      const result = data as unknown as LifecycleResult
      if (!result?.committed) return { success: false, error: lifecycleError(null) }
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: lifecycleError(error) }
    }
  }

  static async save(snapshot: RouteSnapshot, desired: DesiredLink[]) {
    return this.mutate({ op: 'save', route_id: snapshot.id, expected: snapshot, desired })
  }

  static async start(orderId: string, technician = false, notes?: string, images: string[] = []) {
    return this.execute({ op: 'start', order_id: orderId, technician, notes: notes ?? null, images }, async () => ({
      op: 'start', order_id: orderId, technician, notes: notes ?? null, images,
      expected: await this.snapshot('order', orderId),
    }))
  }
}
