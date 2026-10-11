import React, { useEffect, useRef, useState } from 'react'
import { History, RefreshCw } from 'lucide-react'
import { AuditAPI, AuditReadError } from '../../api/audit'
import type { AuditCoverage, AuditCursor, AuditEvent, AuditFilters } from '../../types/audit'
import AuditDetail from './AuditDetail'
import AuditEventCard from './AuditEventCard'
import { searchableEventText } from './auditPresentation'
import { actorLabel, tableLabels } from './auditLabels'

const emptyFilters: AuditFilters = { from: '', to: '', table: '', actor: '', entity: '', kind: '', transaction: '', generation: '' }
const control = 'mt-1 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'
function sourceName(source: AuditCoverage['sources'][number]) {
  const table = source.table_name || source.table || ''
  return table.includes('.') ? table : `${source.schema || 'public'}.${table}`
}
export default function AuditPage() {
  const [draft, setDraft] = useState<AuditFilters>(emptyFilters)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<AuditFilters>(emptyFilters)
  const [coverage, setCoverage] = useState<AuditCoverage | null>(null)
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [cursor, setCursor] = useState<AuditCursor | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [validation, setValidation] = useState('')
  const [reload, setReload] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const sequence = useRef(0)
  const pendingMore = useRef(false)
  useEffect(() => {
    const current = ++sequence.current
    pendingMore.current = false
    setLoading(true); setLoadingMore(false); setError(''); setDenied(false); setEvents([]); setCursor(null); setCoverage(null)
    Promise.all([AuditAPI.coverage(), AuditAPI.list(filters)]).then(([scope, page]) => {
      if (sequence.current !== current) return
      setCoverage(scope); setEvents(page.events); setCursor(page.next_cursor)
    }).catch(error => {
      if (sequence.current !== current) return
      setError(error instanceof AuditReadError ? error.message : 'تعذر تحميل سجل الأحداث. يمكنك إعادة المحاولة.')
      setDenied(error instanceof AuditReadError && error.denied)
    }).finally(() => { if (sequence.current === current) setLoading(false) })
    return () => { sequence.current = current + 1 }
  }, [filters, reload])
  async function more() {
    if (!cursor || pendingMore.current) return
    pendingMore.current = true
    const current = sequence.current
    setLoadingMore(true); setError('')
    try {
      const page = await AuditAPI.list(filters, cursor)
      if (current !== sequence.current) return
      setEvents(previous => {
        const ids = new Set(previous.map(event => event.id))
        return [...previous, ...page.events.filter(event => !ids.has(event.id))]
      })
      setCursor(page.next_cursor)
    } catch (error) {
      if (current !== sequence.current) return
      const forbidden = error instanceof AuditReadError && error.denied
      setError(error instanceof AuditReadError ? error.message : 'تعذر تحميل المزيد. يمكنك إعادة المحاولة.')
      setDenied(forbidden)
      if (forbidden) { setEvents([]); setCoverage(null); setCursor(null) }
    } finally {
      if (current === sequence.current) { pendingMore.current = false; setLoadingMore(false) }
    }
  }
  function apply(event: React.FormEvent) {
    event.preventDefault()
    if (draft.from && draft.to && draft.from > draft.to) { setValidation('تاريخ البداية يجب ألا يأتي بعد تاريخ النهاية.'); return }
    setValidation(''); setSelected(null); setFilters({ ...draft, transaction: '', generation: '' })
  }
  function timeline(event: AuditEvent, kind: 'entity' | 'transaction') {
    const next = { ...emptyFilters, generation: event.database_generation,
      table: kind === 'entity' ? `${event.table_schema}.${event.table_name}` : '',
      entity: kind === 'entity' ? event.entity_id || '' : '',
      transaction: kind === 'transaction' ? `${event.database_generation}:${event.transaction_id}` : '',
    }
    setSelected(null); setDraft(next); setFilters(next); setValidation('')
  }
  const actorOptions = new Map<string, string>()
  const visibleEvents = events.filter(event => searchableEventText(event).includes(search.trim().toLocaleLowerCase()))
  events.forEach(event => { if (event.actor_id) actorOptions.set(event.actor_id, actorLabel(event)) })
  if (draft.actor && !actorOptions.has(draft.actor)) actorOptions.set(draft.actor, draft.actor)
  return <div className="min-w-0 space-y-5" dir="rtl">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl"><History className="h-6 w-6 shrink-0" />سجل الأحداث</h1><p className="mt-1 text-sm text-gray-600">اعرف من غيّر البيانات ومتى وما الذي تغيّر. الأوقات والفلاتر بتوقيت القاهرة.</p></div>
      <button onClick={() => setReload(value => value + 1)} disabled={loading || loadingMore} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50 focus-visible:ring-2 disabled:opacity-50"><RefreshCw size={16} />تحديث السجل</button>
    </header>
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
      <p>يعرض السجل التغييرات المحفوظة في المصادر المشمولة؛ لا يثبت اكتمال العمليات الخارجية أو جميع المحاولات المرفوضة.</p>
      <details className="mt-2"><summary className="cursor-pointer font-medium">نطاق التسجيل وحفظ السجل</summary>
        <p className="mt-2">النسخة الاحتياطية التطبيقية لا تشمل سجل الأحداث؛ استعادته تحتاج نسخة قاعدة كاملة.</p>
        <p className="mt-2">أحدث حدث لا يثبت اكتمال التسجيل. هوية المنفذ قد تكون غير مثبتة في بعض المصادر.</p>
        {coverage && <><p className="mt-2">{coverage.enabled ? 'التسجيل مفعّل في المصادر التالية:' : 'التسجيل متوقف حاليًا؛ الوقائع السابقة متاحة للقراءة.'}</p><ul className="mt-2 grid gap-1 sm:grid-cols-2">{coverage.sources.map(source => <li key={sourceName(source)}>{tableLabels[sourceName(source).split('.')[1]] || sourceName(source)} — {source.enabled && source.attached !== false ? 'مشمول' : 'غير مفعّل'}</li>)}</ul></>}
      </details>
    </div>
    <form onSubmit={apply} className="rounded-xl border bg-white p-4">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="min-w-0 text-sm">من تاريخ<input type="date" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} className={control} /></label>
        <label className="min-w-0 text-sm">إلى تاريخ<input type="date" value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} className={control} /></label>
        <label className="min-w-0 text-sm">مجموعة البيانات<select value={draft.table} onChange={event => setDraft({ ...draft, table: event.target.value })} className={control}><option value="">كل المجموعات</option>{coverage?.sources.map(source => <option key={sourceName(source)} value={sourceName(source)}>{tableLabels[sourceName(source).split('.')[1]] || sourceName(source)}</option>)}</select></label>
        <label className="min-w-0 text-sm">المستخدم<select value={draft.actor} onChange={event => setDraft({ ...draft, actor: event.target.value })} className={control}><option value="">كل المنفذين</option>{Array.from(actorOptions).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><span className="mt-1 block text-xs text-gray-500">المستخدمون الظاهرون في النتائج الحالية.</span></label>
        <label className="min-w-0 text-sm">مرجع الكيان<input value={draft.entity} onChange={event => setDraft({ ...draft, entity: event.target.value })} className={control} dir="ltr" placeholder="معرف الطلب أو السجل" /></label>
        <label className="min-w-0 text-sm">نوع التغيير<select value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value })} className={control}><option value="">كل الأنواع</option><option value="INSERT">إضافة</option><option value="UPDATE">تعديل</option><option value="DELETE">حذف</option><option value="committed_operation">عملية طلب مثبتة</option><option value="recovery_epoch_changed">تغيّر نسخة البيانات</option></select></label>
      </div>
      {validation && <p role="alert" className="mt-3 text-sm text-red-700">{validation}</p>}
      <div className="mt-4 flex flex-wrap gap-2"><button type="submit" disabled={loading || loadingMore} className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white focus-visible:ring-2 disabled:opacity-50">عرض النتائج</button><button type="button" onClick={() => { setDraft(emptyFilters); setFilters({ ...emptyFilters }); setValidation('') }} className="rounded-lg border px-4 py-2 text-sm focus-visible:ring-2">مسح الفلاتر</button></div>
    </form>
    {filters.generation && <div className="rounded-lg border bg-gray-50 p-3 text-sm">{filters.transaction ? 'يعرض تغييرات المعاملة المثبتة في نسخة البيانات نفسها.' : 'يعرض تسلسل الكيان في نسخة البيانات نفسها.'} <button onClick={() => { setDraft(emptyFilters); setFilters({ ...emptyFilters }) }} className="mr-2 font-medium text-primary-700 underline">العودة إلى كل الأحداث</button></div>}
    {loading && <p role="status" className="rounded-xl border bg-white p-6">جاري تحميل سجل الأحداث…</p>}
    <label className="block rounded-xl border bg-white p-4 text-sm">بحث في الأحداث المحمّلة<input value={search} onChange={event => setSearch(event.target.value)} placeholder="رقم الطلب، اسم الخط، الفريق أو المنفذ" className={control} /><span className="mt-2 block text-xs text-gray-500">البحث في النتائج المحمّلة فقط؛ استخدم الفلاتر وعرض المزيد للوصول إلى أحداث أخرى.</span></label>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"><p>{error}</p>{!denied && <button onClick={() => events.length ? more() : setReload(value => value + 1)} className="mt-3 rounded border border-red-300 bg-white px-3 py-2 text-sm focus-visible:ring-2">إعادة المحاولة</button>}</div>}
    {!loading && !error && !events.length && <div className="rounded-xl border bg-white p-6 text-center text-gray-600">لا توجد أحداث مطابقة للفلاتر الحالية.</div>}
    {!loading && !denied && events.length > 0 && <section aria-label="الأحداث المسجلة" className="space-y-3">
      {visibleEvents.map(event => <AuditEventCard key={event.id} event={event} onDetail={setSelected} onTimeline={timeline} />)}
      {!visibleEvents.length && <p className="rounded-lg border bg-white p-4 text-gray-600">لا توجد أحداث محمّلة مطابقة للبحث.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500"><span>عدد الأحداث المعروضة: {visibleEvents.length} من {events.length} حدث محمّل</span>{cursor && <button onClick={more} disabled={loadingMore} className="rounded-lg border bg-white px-4 py-2 text-gray-800 focus-visible:ring-2 disabled:opacity-50">{loadingMore ? 'جاري تحميل المزيد…' : 'عرض المزيد'}</button>}</div>
    </section>}
    {selected && <AuditDetail id={selected} onClose={() => setSelected(null)} onTimeline={timeline} />}
  </div>
}
