import type { AuditEvent } from '../../types/audit'
import { eventRelations } from './auditPresentation'
import { tableLabels } from './auditLabels'

interface Props {
  event: AuditEvent
  onTimeline: (event: AuditEvent, kind: 'entity' | 'transaction') => void
}
export default function AuditRelations({ event, onTimeline }: Props) {
  const relations = eventRelations(event)
  if (!relations.length) return null
  return <div className="mt-3 flex flex-wrap gap-2" aria-label="السجلات المرتبطة">
    {relations.map(item => <button key={item.table + ':' + item.id}
      onClick={() => onTimeline({ ...event, table_schema: 'public', table_name: item.table, entity_id: item.id }, 'entity')}
      className="max-w-full rounded-lg border bg-gray-50 px-3 py-2 text-right text-xs text-primary-700 hover:bg-primary-50 focus-visible:ring-2">
      <span className="block break-words"><bdi>{tableLabels[item.table]}: {item.label}</bdi></span>
      <span className="mt-1 block text-gray-500">{item.current ? 'علاقة حالية · عرض أحداث هذا السجل' : 'عرض أحداث هذا السجل'}</span>
    </button>)}
  </div>
}

