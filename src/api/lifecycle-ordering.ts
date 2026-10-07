import type { RouteSnapshot } from './lifecycle'

// Preserve fixed historical sequence values. Allocate only as much room as the
// displayed list needs; never silently append an interleaved new order.
export function assignmentSequences(snapshot: RouteSnapshot, ids: string[]): number[] {
  const original = new Map(snapshot.links.map(link => [link.order_id, link]))
  const fixed = ids.map(id => {
    const link = original.get(id)
    return link && (link.order.history || !['pending', 'scheduled'].includes(link.order.status))
      ? link.sequence_order : null
  })
  let previous = 0
  return ids.map((id, index) => {
    const anchor = fixed[index]
    if (anchor !== null) {
      if (anchor <= previous) throw new Error('هذا الترتيب يغيّر موضع طلب له تاريخ تنفيذ. راجع ترتيب القائمة')
      previous = anchor
      return anchor
    }
    const nextAnchorIndex = fixed.findIndex((value, candidate) => candidate > index && value !== null)
    const maximum = nextAnchorIndex < 0 ? Number.MAX_SAFE_INTEGER : fixed[nextAnchorIndex]! - (nextAnchorIndex - index)
    if (previous + 1 > maximum) throw new Error('لا توجد مساحة لهذا الترتيب دون تغيير موضع طلب منفذ. راجع القائمة')
    const oldSequence = original.get(id)?.sequence_order
    previous = oldSequence && oldSequence > previous && oldSequence <= maximum ? oldSequence : previous + 1
    return previous
  })
}
