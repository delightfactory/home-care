import { supabase } from '../lib/supabase'
import type { AuditContext, AuditCoverage, AuditCursor, AuditEvent, AuditFilters, AuditPage } from '../types/audit'

export class AuditReadError extends Error {
  constructor(public readonly denied: boolean) {
    super(denied ? 'ليس لديك صلاحية عرض سجل الأحداث.' : 'تعذر تحميل سجل الأحداث. يمكنك إعادة المحاولة.')
  }
}
async function read<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new AuditReadError(error.code === '42501' || String(error.message).includes('AUDIT_DENIED'))
  return data as T
}
async function enrich(events: AuditEvent[]): Promise<AuditEvent[]> {
  if (!events.length) return events
  try {
    const context = await read<AuditContext>('admin_audit_context', { p_ids: events.map(event => event.id) })
    if (!context || !context.labels || !context.entities) throw new Error('Invalid audit display context')
    return events.map(event => ({ ...event, display_context: context }))
  } catch (error) {
    if (error instanceof AuditReadError && error.denied) throw error
    // Old servers or an unavailable lookup must not hide the original audit evidence.
    return events.map(event => ({ ...event, context_unavailable: true }))
  }
}
export const AuditAPI = {
  coverage: () => read<AuditCoverage>('admin_audit_coverage'),
  detail: async (id: string) => {
    const event = await read<AuditEvent | null>('admin_audit_detail', { p_id: id })
    return event ? (await enrich([event]))[0] : null
  },
  list: async (filters: AuditFilters, cursor: AuditCursor | null = null) => {
    const page = await read<AuditPage>('admin_audit_list', {
    p_from_day: filters.from || null,
    p_to_day: filters.to || null,
    p_table: filters.table || null,
    p_actor: filters.actor || null,
    p_entity: filters.entity.trim() || null,
    p_kind: filters.kind || null,
    p_transaction: filters.transaction || null,
    p_generation: filters.generation || null,
    p_cursor_at: cursor?.occurred_at ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: 50,
    })
    return { ...page, events: await enrich(page.events) }
  },
}
