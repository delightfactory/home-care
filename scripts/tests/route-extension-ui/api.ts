// Synthetic API boundary only; production modal is rendered unchanged.
const routeId = 'b5000000-0000-0000-0000-000000000001'
let mode = 'failure'
let resolveAttempt: ((value: unknown) => void) | null = null
let submits = 0
export const qa = {
  setMode(value: string) { mode = value },
  release() { resolveAttempt?.(undefined); resolveAttempt = null },
  get submits() { return submits },
}
export class LifecycleAPI {
  static async snapshot(kind: string, id: string) {
    if (kind === 'order') return { id, epoch: 'synthetic-epoch', status: 'pending', team_id: null, updated_at: '2026-10-12T10:00:00Z', history: false, links: [] }
    return { id: routeId, epoch: 'synthetic-epoch', team_id: 'synthetic-team', status: 'completed', updated_at: '2026-10-12T11:00:00Z', links: [], date: '2026-10-12', actual_start_time: '2026-10-12T07:00:00Z', actual_end_time: '2026-10-12T11:00:00Z', leader_id: 'synthetic-worker', team_name: 'فريق الاختبار', members: [{ id: 'synthetic-membership', worker_id: 'synthetic-worker', name: 'قائد الاختبار', joined_at: '2026-10-11T07:00:00Z', left_at: null }], attendance: [] }
  }
}
export class RoutesAPI {
  static async getAvailableOrders() {
    return [{ id: 'b6000000-0000-0000-0000-000000000002', order_number: 'QA-NEW-ORDER', scheduled_time: '17:00', customer: { name: 'عميل الاختبار' } }]
  }
  static async extendRoute() {
    submits++
    await new Promise(resolve => { resolveAttempt = resolve })
    return mode === 'failure' ? { success: false, error: 'تعذر تأكيد التمديد؛ بيانات المحاولة محفوظة' } : { success: true, data: { committed: true, replayed: mode === 'replay' } }
  }
}
