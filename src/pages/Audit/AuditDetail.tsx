import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { AuditAPI, AuditReadError } from '../../api/audit'
import type { AuditEvent } from '../../types/audit'
import { actorLabel, eventLabel, fieldLabels, lifecycleOperationLabels, tableLabels } from './auditLabels'

const renderValue = (field: string, value: unknown) => value === undefined || value === null ? '—' : typeof value === 'boolean' ? (value ? 'نعم' : 'لا') : field === 'operation' && typeof value === 'string' ? lifecycleOperationLabels[value] || value : typeof value === 'object' ? JSON.stringify(value) : String(value)
interface Props {
  id: string
  onClose: () => void
  onTimeline: (event: AuditEvent, kind: 'entity' | 'transaction') => void
}
export default function AuditDetail({ id, onClose, onTimeline }: Props) {
  const [event, setEvent] = useState<AuditEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const dialog = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setEvent(null)
    AuditAPI.detail(id).then(value => { if (active) setEvent(value) }).catch(error => {
      if (active) setError(error instanceof AuditReadError ? error.message : 'تعذر تحميل تفاصيل الحدث. يمكنك إعادة المحاولة.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, retry])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeButton.current?.focus()
    const keydown = (key: KeyboardEvent) => {
      if (key.key === 'Escape') close.current()
      if (key.key === 'Tab') {
        const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, summary, [tabindex], [contenteditable="true"]',
        ) || []).filter(element => element.tabIndex >= 0 && !element.matches(':disabled') &&
          !element.closest('[inert]') && element.getClientRects().length > 0)
        if (!focusable.length) return
        const first = focusable[0], last = focusable[focusable.length - 1]
        const outside = !dialog.current?.contains(document.activeElement)
        if (key.shiftKey && (outside || document.activeElement === first)) { key.preventDefault(); last.focus() }
        else if (!key.shiftKey && (outside || document.activeElement === last)) { key.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus() }
  }, [])
  const markerFields = event ? Array.isArray(event.change_markers) ? event.change_markers : Object.entries(event.change_markers || {}).filter(([, changed]) => changed).map(([field]) => field) : []
  const fields = event ? Array.from(new Set([...event.changed_fields, ...markerFields])) : []
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3" dir="rtl">
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 id="audit-detail-title" className="text-lg font-bold">تفاصيل الحدث</h2><button ref={closeButton} onClick={onClose} aria-label="إغلاق تفاصيل الحدث" className="rounded p-2 hover:bg-gray-100 focus-visible:ring-2"><X size={20} /></button></div>
      {loading && <p role="status">جاري تحميل تفاصيل الحدث…</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)} className="mt-3 rounded border px-3 py-2">إعادة المحاولة</button></div>}
      {!loading && !error && !event && <p>تعذر العثور على هذا الحدث. قد تكون نسخة البيانات قد تغيّرت.</p>}
      {event && <>
        <dl className="grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500">التغيير</dt><dd>{eventLabel(event.event_kind, event.operation)} · {tableLabels[event.table_name] || event.table_name}</dd></div>
          <div><dt className="text-gray-500">الوقت</dt><dd>{new Date(event.occurred_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}</dd></div>
          <div className="min-w-0"><dt className="text-gray-500">المنفذ</dt><dd className="break-words"><bdi>{actorLabel(event)}</bdi></dd></div>
          <div className="min-w-0"><dt className="text-gray-500">مرجع الكيان</dt><dd className="break-all"><bdi>{event.entity_id || '—'}</bdi></dd></div>
        </dl>
        <p className="my-4 text-sm text-gray-600">المصدر: تغيير محفوظ في قاعدة البيانات. لا يثبت هذا الحدث وحده اكتمال عملية متعددة الخطوات أو نتيجة خارج النظام.</p>
        <p className="mb-4 text-sm text-gray-600">قد يتغير السجل أكثر من مرة داخل المعاملة نفسها؛ القيم المعروضة تخص هذا الحدث، وليست بالضرورة الحالة النهائية أو الحالية للسجل.</p>
        {event.payload_redacted && <p className="mb-3 rounded bg-amber-50 p-3 text-sm text-amber-900">حُجبت بعض التفاصيل ضمن حدود حفظ البيانات. لا يعني ذلك أن العملية لم تحدث.</p>}
        <div className="space-y-3">{fields.map(field => {
          const marker = markerFields.includes(field)
          const redacted = event.redacted_fields?.includes(field) || event.payload_redacted && !Object.prototype.hasOwnProperty.call(event.before_values || {}, field) && !Object.prototype.hasOwnProperty.call(event.after_values || {}, field)
          return <div key={field} className="rounded-lg border p-3">
            <h3 className="mb-2 text-sm font-semibold"><bdi>{fieldLabels[field] || field}</bdi></h3>
            {marker || redacted ? <p className="text-sm text-gray-600">تغيّر الحقل؛ قيمته محجوبة</p> : <div className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2"><div className="min-w-0"><span className="text-gray-500">قبل</span><p className="mt-1 whitespace-pre-wrap break-all"><bdi>{renderValue(field, event.before_values?.[field])}</bdi></p></div><div className="min-w-0"><span className="text-gray-500">بعد</span><p className="mt-1 whitespace-pre-wrap break-all"><bdi>{renderValue(field, event.after_values?.[field])}</bdi></p></div></div>}
          </div>
        })}</div>
        {!fields.length && <p className="rounded border p-3 text-sm">لا توجد تفاصيل حقول متاحة لهذا الحدث.</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          {event.entity_id && <button onClick={() => onTimeline(event, 'entity')} className="rounded border px-3 py-2 text-sm focus-visible:ring-2">عرض تسلسل الكيان</button>}
          <button onClick={() => onTimeline(event, 'transaction')} className="rounded border px-3 py-2 text-sm focus-visible:ring-2">عرض تغييرات المعاملة</button>
        </div>
        <details className="mt-4 text-xs text-gray-500"><summary className="cursor-pointer">مراجع التتبع</summary><dl className="mt-2 space-y-2 break-all"><div><dt>الحدث</dt><dd><bdi>{event.id}</bdi></dd></div><div><dt>نسخة البيانات</dt><dd><bdi>{event.database_generation}</bdi></dd></div><div><dt>المعاملة</dt><dd><bdi>{event.transaction_id}</bdi></dd></div><div><dt>المصدر</dt><dd><bdi>{event.table_schema}.{event.table_name}</bdi></dd></div></dl></details>
      </>}
    </div>
  </div>
}
