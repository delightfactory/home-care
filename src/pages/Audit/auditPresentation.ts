import type { AuditEvent } from '../../types/audit'
import { fieldLabels, lifecycleOperationLabels, tableLabels } from './auditLabels'

const referenceTables: Record<string, string> = {
  team_id: 'teams', worker_id: 'workers', leader_id: 'workers', order_id: 'orders',
  route_id: 'routes', destination_id: 'routes', invoice_id: 'invoices', service_id: 'services',
  user_id: 'users', actor: 'users', created_by: 'users', updated_by: 'users', performed_by: 'users',
  collected_by: 'users', approved_by: 'users', cancelled_by: 'users', role_id: 'roles',
  customer_id: 'customers', vault_id: 'vaults', custody_id: 'custody_accounts',
  custody_account_id: 'custody_accounts', advance_id: 'salary_advances',
  payroll_item_id: 'payroll_items', period_id: 'payroll_periods', payroll_period_id: 'payroll_periods',
  expense_id: 'expenses',
}
const statuses: Record<string, string> = {
  pending: 'معلق', scheduled: 'مجدول', planned: 'مخطط', in_progress: 'قيد التنفيذ',
  completed: 'مكتمل', cancelled: 'ملغي', active: 'نشط', inactive: 'غير نشط',
  paid: 'مدفوع', unpaid: 'غير مدفوع', partially_paid: 'مدفوع جزئيًا',
  approved: 'معتمد', rejected: 'مرفوض', draft: 'مسودة',
}
export function referenceTable(source: string, field: string) {
  if (field === 'category_id') return source === 'expenses' ? 'expense_categories' : source === 'services' ? 'service_categories' : undefined
  return referenceTables[field]
}
export function referenceLabel(event: AuditEvent, table: string, id: string) {
  const reference = event.display_context?.labels[table + ':' + id]
  if (reference?.label) return reference.label + ' (الاسم الحالي)'
  return reference?.found ? 'سجل مرتبط دون اسم' : 'اسم المرجع غير متاح'
}
export function eventTitle(event: AuditEvent) {
  if (event.payload_redacted) return tableLabels[event.table_name] || 'سجل'
  const values = event.after_values || event.before_values || {}
  const captured = ['order_number', 'invoice_number', 'name_ar', 'full_name', 'name']
    .filter(field => !event.redacted_fields?.includes(field))
    .map(field => values[field]).find(value => typeof value === 'string' && value)
  if (typeof captured === 'string' && captured) return captured
  if (event.event_kind === 'committed_operation') {
    const operation = String(values.operation || '')
    return lifecycleOperationLabels[operation] || 'عملية محفوظة'
  }
  const nameHidden = event.redacted_fields?.some(field => ['name', 'name_ar', 'full_name', 'order_number', 'invoice_number'].includes(field))
  const current = !nameHidden && event.entity_id && event.display_context?.labels[event.table_name + ':' + event.entity_id]?.label
  return current ? current + ' (الاسم الحالي)' : tableLabels[event.table_name] || 'سجل'
}
export function displayValue(event: AuditEvent, field: string, value: unknown): string {
  if (value === undefined || value === null) return 'غير معيّن'
  const table = referenceTable(event.table_name, field)
  if (table && typeof value === 'string') return referenceLabel(event, table, value)
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا'
  if (typeof value === 'string' && /_at$/.test(field) && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })
  }
  if (field === 'operation' && typeof value === 'string') return lifecycleOperationLabels[value] || value
  if (field === 'status' && typeof value === 'string') return statuses[value] || value
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
export function changeSummary(event: AuditEvent) {
  const fields = event.changed_fields.filter(field => !['id', 'updated_at', 'created_at', 'epoch', 'token', 'request', 'actor'].includes(field))
  return fields.slice(0, 3).map(field => {
    const values = event.operation === 'DELETE' ? event.before_values : event.after_values
    if (event.redacted_fields?.includes(field) || !Object.prototype.hasOwnProperty.call(values || {}, field)) return (fieldLabels[field] || field) + ': تغيّر'
    if (event.operation === 'INSERT') return (fieldLabels[field] || field) + ': ' + displayValue(event, field, event.after_values?.[field])
    if (event.operation === 'DELETE') return (fieldLabels[field] || field) + ': ' + displayValue(event, field, event.before_values?.[field])
    return (fieldLabels[field] || field) + ': من ' + displayValue(event, field, event.before_values?.[field]) + ' إلى ' + displayValue(event, field, event.after_values?.[field])
  }).join(' · ')
}
export interface AuditRelation { table: string; id: string; label: string; current: boolean }
export function eventRelations(event: AuditEvent): AuditRelation[] {
  if (event.payload_redacted) return []
  const result: AuditRelation[] = []
  const stored = [event.before_values || {}, event.after_values || {}]
  const current = event.entity_id && event.display_context?.entities[event.table_name + ':' + event.entity_id]
  for (const [values, isCurrent] of [...stored.map(values => [values, false] as const), [current || {}, true] as const]) {
    for (const [field, value] of Object.entries(values)) {
      if (event.redacted_fields?.includes(field)) continue
      const table = referenceTable(event.table_name, field)
      if (!table || typeof value !== 'string' || !['orders', 'routes', 'invoices', 'services', 'workers', 'teams'].includes(table)) continue
      // Saved relationships take precedence; never substitute a changed current relationship.
      if (isCurrent && stored.some(row => Object.prototype.hasOwnProperty.call(row, field))) continue
      if (result.some(item => item.table === table && item.id === value)) continue
      result.push({ table, id: value, label: referenceLabel(event, table, value), current: isCurrent })
    }
  }
  return result
}
export function searchableEventText(event: AuditEvent) {
  return [eventTitle(event), changeSummary(event), event.actor_name || '',
    ...eventRelations(event).map(item => item.label)].join(' ').toLocaleLowerCase()
}

