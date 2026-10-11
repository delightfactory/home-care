import { supabase } from '../lib/supabase'
import type { AuditCoverage, AuditCursor, AuditEvent, AuditFilters, AuditPage } from '../types/audit'

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
export const AuditAPI = {
  coverage: () => read<AuditCoverage>('admin_audit_coverage'),
  detail: (id: string) => read<AuditEvent | null>('admin_audit_detail', { p_id: id }),
  list: (filters: AuditFilters, cursor: AuditCursor | null = null) => read<AuditPage>('admin_audit_list', {
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
  }),
}
