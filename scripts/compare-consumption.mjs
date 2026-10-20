import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const unpack = input => Array.isArray(input) ? input[0].snapshot : input.snapshot ?? input;
export function compareSnapshots(beforeInput, afterInput) {
  const before = unpack(beforeInput), after = unpack(afterInput);
  const seconds = (Date.parse(after.at) - Date.parse(before.at)) / 1000;
  if (!Number.isFinite(seconds) || seconds <= 0) throw Error('Snapshots must have increasing timestamps');
  for (const [first, last] of [[before.stat_reset, after.stat_reset], [before.wal.stats_reset, after.wal.stats_reset],
    [before.database.stats_reset, after.database.stats_reset]]) {
    if (first !== last) throw Error('Statistics reset: a fresh baseline is required');
  }
  if (before.instance_started_at && after.instance_started_at && before.instance_started_at !== after.instance_started_at) {
    throw Error('Database restarted: a fresh baseline is required');
  }
  const deltas = {};
  for (const [group, counters] of [['database', ['blks_read', 'blks_hit', 'temp_bytes', 'xact_commit', 'xact_rollback', 'deadlocks']], ['wal', ['wal_bytes']]]) {
    for (const counter of counters) {
      const first = Number(before[group][counter]), last = Number(after[group][counter]);
      if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) throw Error(`Invalid or reset counter: ${counter}`);
      deltas[counter] = { delta: last - first, per_minute: (last - first) * 60 / seconds };
    }
  }
  return { from: before.at, to: after.at, elapsed_seconds: seconds, counters: deltas,
    limitation: 'Postgres counters are not the physical disk IO budget. Compare matched workload windows and dashboard CPU/IO/swap/error metrics separately.' };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw Error('Usage: node scripts/compare-consumption.mjs before.json after.json');
  console.log(JSON.stringify(compareSnapshots(JSON.parse(readFileSync(process.argv[2], 'utf8')), JSON.parse(readFileSync(process.argv[3], 'utf8'))), null, 2));
}
