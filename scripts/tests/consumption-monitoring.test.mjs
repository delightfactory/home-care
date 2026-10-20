import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSnapshots } from '../compare-consumption.mjs';
const snapshot = (at, count) => ({ at, stat_reset: '2026-10-01', wal: { stats_reset: '2026-10-01', wal_bytes: count },
  database: { stats_reset: null, blks_read: count, blks_hit: count, temp_bytes: count, xact_commit: count, xact_rollback: count, deadlocks: count } });
test('compares interval deltas rather than cumulative lifetime totals', () => {
  const report = compareSnapshots([{ snapshot: snapshot('2026-10-20T10:00:00Z', 100000) }], [{ snapshot: snapshot('2026-10-20T10:02:00Z', 100020) }]);
  assert.deepEqual(report.counters.blks_read, { delta: 20, per_minute: 10 });
});
test('reset counters or reset windows cannot be reported as an improvement', () => {
  const before = snapshot('2026-10-20T10:00:00Z', 100);
  const after = snapshot('2026-10-20T10:02:00Z', 10);
  assert.throws(() => compareSnapshots(before, after), /reset counter/);
  after.wal.stats_reset = '2026-10-20';
  assert.throws(() => compareSnapshots(before, after), /Statistics reset/);
});
