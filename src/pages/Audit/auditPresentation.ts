import type { AuditEvent } from '../../types/audit'
import { fieldLabels, lifecycleOperationLabels, tableLabels } from './auditLabels'
import { codedValue, technicalFields } from './auditValues'

const referenceTables: Record<string, string> = {
  auto_checkout_route_id: 'routes',
  team_id: 'teams', worker_id: 'workers', leader_id: 'workers', order_id: 'orders', route_id: 'routes', destination_id: 'routes',
  invoice_id: 'invoices', service_id: 'services', user_id: 'users', actor: 'users', created_by: 'users', updated_by: 'users',
  performed_by: 'users', collected_by: 'users', approved_by: 'users', cancelled_by: 'users', confirmed_by: 'users', modified_by: 'users',
  disbursed_by: 'users', caller_id: 'users', callee_id: 'users', conversation_id: 'conversations', role_id: 'roles', customer_id: 'customers',
  vault_id: 'vaults', target_vault_id: 'vaults', custody_id: 'custody_accounts', custody_account_id: 'custody_accounts',
  target_custody_id: 'custody_accounts', advance_id: 'salary_advances', payroll_item_id: 'payroll_items', period_id: 'payroll_periods',
  payroll_period_id: 'payroll_periods', expense_id: 'expenses',
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const money = /^(amount|balance|balance_after|price|unit_price|total_price|total_amount|paid_amount|subtotal|discount|transport_cost|salary|base_salary|daily_rate|net_salary|net_total|remaining_amount|installment_amount|approval_limit|disbursed_amount|total_disbursed|absence_deduction|calculated_bonus|manual_incentives|manual_deductions|manual_penalties|manual_bonuses|advance_deduction|late_penalty_amount|total_salaries|total_incentives|total_deductions|total_penalties|total_bonuses|total_advances|total_absence_deductions)$/
export function referenceTable(source: string, field: string, values: Record<string, unknown> = {}) {
  if (field === 'category_id') return source === 'expenses' ? 'expense_categories' : source === 'services' ? 'service_categories' : undefined
  if (field === 'reference_id' && ['vault_transactions', 'custody_transactions'].includes(source)) {
    return ({ invoice: 'invoices', expense: 'expenses', payroll: 'payroll_periods', salary_advance: 'salary_advances' } as Record<string, string>)[String(values.reference_type)]
  }
  return referenceTables[field]
}
// Labels with no natural name use a small, bounded description; no complete business rows are read.
function describe(event: AuditEvent, table: string, row: Record<string, unknown>, depth = 0): string | undefined {
  const parent = (field: string) => {
    const target = referenceTable(table, field, row), id = row[field]
    return target && typeof id === 'string' ? referenceLabel(event, target, id, depth + 1) : 'غير معيّن'
  }
  if (depth > 3) return undefined
  switch (table) {
    case 'custody_accounts': return 'عهدة · ' + (row.team_id ? parent('team_id') : parent('user_id'))
    case 'salary_advances': return 'سلفة · ' + parent('worker_id')
    case 'payroll_periods': return row.month && row.year ? `رواتب ${row.month} / ${row.year}` : undefined
    case 'payroll_items': return 'راتب · ' + parent('worker_id') + ' · ' + parent('payroll_period_id')
    case 'advance_installments': return 'قسط · ' + parent('advance_id') + ` · ${row.month || '—'} / ${row.year || '—'}`
    case 'expenses': return 'مصروف · ' + parent('category_id')
    case 'conversations': return row.team_id ? 'محادثة · ' + parent('team_id') : codedValue(table, 'type', String(row.type))
    case 'conversation_participants': return parent('user_id') + ' · ' + parent('conversation_id')
    case 'notification_preferences': return 'تفضيلات الإشعارات · ' + parent('user_id')
    case 'order_items': return 'بند طلب · ' + parent('order_id') + ' · ' + parent('service_id')
    case 'invoice_items': return 'بند فاتورة · ' + parent('invoice_id') + ' · ' + parent('service_id')
    case 'order_workers': return parent('worker_id') + ' · ' + parent('order_id')
    case 'team_members': return parent('worker_id') + ' · ' + parent('team_id')
    case 'route_orders': return parent('order_id') + ' · ' + parent('route_id')
    case 'order_status_logs': case 'customer_surveys': return tableLabels[table] + ' · ' + parent('order_id')
    case 'attendance_records': return parent('worker_id') + ' · ' + (formattedTime('date', String(row.date)) || 'تاريخ غير متاح')
    case 'hr_adjustments': return parent('worker_id') + ' · ' + codedValue(table, 'type', String(row.type))
    case 'payroll_disbursements': return 'صرف رواتب · ' + parent('payroll_period_id') + ' · ' + parent('vault_id')
    case 'vault_transactions': return (codedValue(table, 'type', String(row.type)) || 'حركة') + ' · ' + parent('vault_id')
    case 'custody_transactions': return (codedValue(table, 'type', String(row.type)) || 'حركة') + ' · ' + parent('custody_id')
    case 'call_logs': case 'voice_calls': return parent('caller_id') + ' ← ' + parent('callee_id')
    default: return undefined
  }
}
export function referenceLabel(event: AuditEvent, table: string, id: string, depth = 0): string {
  const key = table + ':' + id, reference = event.display_context?.labels[key]
  if (reference?.label) return reference.label + ' (الاسم الحالي)'
  const row = event.display_context?.entities[key]
  const description = row && describe(event, table, row, depth)
  if (description) return description + ' (بيانات حالية)'
  return reference?.found ? 'سجل مرتبط دون اسم' : 'اسم المرجع غير متاح'
}
export function eventTitle(event: AuditEvent) {
  if (event.payload_redacted) return tableLabels[event.table_name] || 'سجل'
  const values = event.after_values || event.before_values || {}
  const visible = Object.fromEntries(Object.entries(values).filter(([field]) => !event.redacted_fields?.includes(field)))
  const captured = ['order_number', 'invoice_number', 'name_ar', 'full_name', 'name'].map(field => visible[field]).find(value => typeof value === 'string' && value)
  if (typeof captured === 'string') return captured
  if (event.event_kind === 'committed_operation') return lifecycleOperationLabels[String(visible.operation)] || 'عملية محفوظة'
  if (event.event_kind === 'recovery_epoch_changed') return 'تغيّرت نسخة البيانات'
  if (['app_settings', 'system_settings'].includes(event.table_name)) return codedValue(event.table_name, 'key', String(visible.key)) || 'إعداد النظام'
  const description = describe(event, event.table_name, visible)
  if (description) return description
  const nameHidden = event.redacted_fields?.some(field => ['name', 'name_ar', 'full_name', 'order_number', 'invoice_number'].includes(field))
  const current = !nameHidden && event.entity_id && event.display_context?.labels[event.table_name + ':' + event.entity_id]?.label
  return current ? current + ' (الاسم الحالي)' : tableLabels[event.table_name] || 'سجل'
}
function formattedTime(field: string, value: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) && /(_at|_time|_until)$/.test(field)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && /(^date$|_date$)/.test(field)) {
    return new Date(value + 'T12:00:00Z').toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' })
  }
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(value) && /(_time|_start|_end)$/.test(field)) {
    return new Date('2000-01-01T' + value + (value.length === 5 ? ':00' : '') + 'Z').toLocaleTimeString('ar-EG', { timeZone: 'UTC' })
  }
  return undefined
}
export function displayValue(event: AuditEvent, field: string, value: unknown, values: Record<string, unknown> = event.after_values || event.before_values || {}): string {
  if (value === undefined || value === null) return 'غير معيّن'
  if (field === 'worker_ids' && Array.isArray(value)) {
    const names = value.slice(0, 100).map(id => typeof id === 'string' && uuid.test(id) ? referenceLabel(event, 'workers', id) : 'مرجع عامل غير صالح')
    return names.join('، ') + (value.length > 100 ? ` · ${value.length - 100} مراجع إضافية في مراجع التتبع` : '') || 'لا يوجد عمال'
  }
  const table = field === 'reference_id' && event.redacted_fields?.includes('reference_type') ? undefined : referenceTable(event.table_name, field, values)
  if (table && typeof value === 'string') return referenceLabel(event, table, value)
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا'
  if (typeof value === 'string') {
    const time = formattedTime(field, value)
    if (time) return time
    if (field === 'operation') return lifecycleOperationLabels[value] || 'عملية غير معروفة؛ راجع مراجع التتبع'
    const code = codedValue(event.table_name, field, value)
    if (code) return code
    if (field === 'key') return 'إعداد النظام؛ الاسم التقني في مراجع التتبع'
    if (uuid.test(value)) return 'مرجع تقني؛ راجع مراجع التتبع'
  }
  if (typeof value === 'number') {
    const number = value.toLocaleString('ar-EG', { maximumFractionDigits: 20 })
    if (money.test(field)) return number + ' ج.م'
    if (field === 'duration_seconds') return number + ' ثانية'
    if (event.table_name === 'services' && field === 'estimated_duration') return number + ' دقيقة'
    if (/minutes$/.test(field)) return number + ' دقيقة'
    if (field === 'work_hours') return number + ' ساعة'
    if (field === 'radius_meters') return number + ' متر'
    return number
  }
  if (typeof value === 'object') return 'بيانات مركبة؛ القيم الأصلية في مراجع التتبع'
  return String(value)
}
export function changeSummary(event: AuditEvent) {
  const values = event.operation === 'DELETE' ? event.before_values : event.after_values
  const fields = event.changed_fields.filter(field => !technicalFields.has(field) && !['updated_at', 'created_at', 'actor'].includes(field)
    && !(event.event_kind === 'committed_operation' && values?.[field] == null))
  const priority = ['status', 'team_id', 'order_id', 'worker_id', 'payment_status', 'confirmation_status', 'amount', 'type']
  const ranked = [...fields].sort((a, b) => (priority.includes(a) ? priority.indexOf(a) : 99) - (priority.includes(b) ? priority.indexOf(b) : 99))
  return ranked.slice(0, 3).map(field => {
    const label = fieldLabels[field] || 'حقل إضافي'
    if (event.redacted_fields?.includes(field) || !Object.prototype.hasOwnProperty.call(values || {}, field)) return label + ': تغيّر'
    if (event.operation === 'INSERT' || event.operation === 'DELETE') return label + ': ' + displayValue(event, field, values?.[field], values || {})
    return label + ': من ' + displayValue(event, field, event.before_values?.[field], event.before_values || {}) + ' إلى ' + displayValue(event, field, event.after_values?.[field], event.after_values || {})
  }).join(' · ') + (fields.length > 3 ? ` · ${fields.length - 3} تغييرات أخرى في التفاصيل` : '')
}
export interface AuditRelation { table: string; id: string; label: string; current: boolean }
export function eventRelations(event: AuditEvent): AuditRelation[] {
  if (event.payload_redacted) return []
  const result: AuditRelation[] = [], stored = [event.before_values || {}, event.after_values || {}]
  const current = event.entity_id && event.display_context?.entities[event.table_name + ':' + event.entity_id]
  for (const [values, isCurrent] of [...stored.map(values => [values, false] as const), [current || {}, true] as const]) {
    for (const [field, value] of Object.entries(values)) {
      if (event.redacted_fields?.includes(field)) continue
      const table = referenceTable(event.table_name, field, values)
      if (!table || typeof value !== 'string' || !tableLabels[table]) continue
      // Polymorphic reference_id is bound to the saved reference_type, including explicit nulls/redaction.
      if (field === 'reference_id' && (event.redacted_fields?.includes('reference_type') || isCurrent && stored.some(row => 'reference_type' in row))) continue
      if (isCurrent && stored.some(row => Object.prototype.hasOwnProperty.call(row, field))) continue
      if (result.some(item => item.table === table && item.id === value)) continue
      result.push({ table, id: value, label: referenceLabel(event, table, value), current: isCurrent })
    }
  }
  return result
}
export function searchableEventText(event: AuditEvent) {
  const fields = event.payload_redacted ? [] : [event.before_values || {}, event.after_values || {}].flatMap(values =>
    Object.entries(values).filter(([field]) => !technicalFields.has(field) && !event.redacted_fields?.includes(field))
      .map(([field, value]) => displayValue(event, field, value, values)))
  return [eventTitle(event), changeSummary(event), event.actor_name || '', ...fields, ...eventRelations(event).map(item => item.label)].join(' ').toLocaleLowerCase()
}
