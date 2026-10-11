import type { AuditEvent } from '../../types/audit'
import AuditRelations from './AuditRelations'
import { actorLabel, eventLabel, tableLabels } from './auditLabels'
import { changeSummary, eventTitle } from './auditPresentation'

interface Props {
  event: AuditEvent
  onDetail: (id: string) => void
  onTimeline: (event: AuditEvent, kind: 'entity' | 'transaction') => void
}
export default function AuditEventCard({ event, onDetail, onTimeline }: Props) {
  return <article className="min-w-0 rounded-xl border bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="mb-1 text-xs text-gray-500">{eventLabel(event.event_kind, event.operation)} · {tableLabels[event.table_name] || event.table_name}</p>
        <h2 className="font-semibold text-gray-900"><bdi>{eventTitle(event)}</bdi></h2>
        <p className="mt-1 break-words text-sm text-gray-600"><bdi>{actorLabel(event)}</bdi></p>
      </div>
      <time dateTime={event.occurred_at} className="text-xs text-gray-500">
        {new Date(event.occurred_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}
      </time>
    </div>
    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
      <p className="min-w-0 break-words text-sm text-gray-700"><bdi>{changeSummary(event)}</bdi></p>
      <button onClick={() => onDetail(event.id)} className="shrink-0 rounded-lg border px-3 py-2 text-sm text-primary-700 focus-visible:ring-2">عرض التفاصيل</button>
    </div>
    <AuditRelations event={event} onTimeline={onTimeline} />
    {event.context_unavailable && <p className="mt-2 text-xs text-amber-800">تعذر تحميل أسماء المراجع؛ تفاصيل الحدث الأصلية ما زالت متاحة.</p>}
  </article>
}

