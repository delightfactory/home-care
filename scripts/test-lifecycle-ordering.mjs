import assert from 'node:assert/strict'
import { assignmentSequences } from '../src/api/lifecycle-ordering.ts'

function snapshot(rows) {
  return { links: rows.map(([id, sequence, protectedHistory = false]) => ({ order_id: id,
    sequence_order: sequence, order: { status: protectedHistory ? 'completed' : 'scheduled', history: protectedHistory } })) }
}
assert.deepEqual(assignmentSequences(snapshot([['a', 1], ['b', 2]]), ['a', 'new', 'b']), [1, 2, 3])
assert.deepEqual(assignmentSequences(snapshot([['a', 1], ['b', 2]]), ['new', 'a', 'b']), [1, 2, 3])
assert.deepEqual(assignmentSequences(snapshot([['a', 2], ['b', 6, true]]), ['a', 'new', 'b']), [2, 3, 6])
assert.deepEqual(assignmentSequences(snapshot([['a', 2], ['b', 6, true]]), ['b']), [6])
assert.deepEqual(assignmentSequences(snapshot([['a', 2], ['b', 6, true]]), ['a', 'b']), [2, 6])
assert.throws(() => assignmentSequences(snapshot([['a', 1, true]]), ['new', 'a']), /تاريخ تنفيذ|دون تغيير/)
assert.throws(() => assignmentSequences(snapshot([['a', 1, true], ['b', 2, true]]), ['b', 'a']), /تاريخ تنفيذ|دون تغيير/)
console.log('PASS 7 displayed ordering/history anchor cases (pure UI contract; not SQL qualification)')
