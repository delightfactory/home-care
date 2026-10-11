export interface AuditEvent {
  id: string
  occurred_at: string
  table_schema: string
  table_name: string
  entity_id: string | null
  operation: string
  event_kind: string
  actor_id: string | null
  actor_kind: string
  actor_name: string | null
  transaction_id: string
  database_generation: string
  before_values: Record<string, unknown> | null
  after_values: Record<string, unknown> | null
  changed_fields: string[]
  change_markers: Record<string, boolean> | string[]
  redacted_fields: string[]
  payload_redacted: boolean
}
export interface AuditCursor { occurred_at: string; id: string }
export interface AuditPage { events: AuditEvent[]; next_cursor: AuditCursor | null }
export interface AuditSource {
  schema?: string
  table_name?: string
  table?: string
  fields?: string[]
  markers?: string[]
  attached?: boolean
  enabled: boolean
}
export interface AuditCoverage { enabled: boolean; generation: string; sources: AuditSource[]; limitations: string[] }
export interface AuditFilters {
  from: string
  to: string
  table: string
  actor: string
  entity: string
  kind: string
  transaction: string
  generation: string
}
