import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const container = 'homecare-order-lifecycle-qa';
const database = 'homecare_io_test';
const inspection = spawnSync('docker', ['inspect', container], { encoding: 'utf8' });
if (inspection.status !== 0) throw Error('Dedicated offline QA database is required');
const configuration = JSON.parse(inspection.stdout)[0];
if (configuration.HostConfig.NetworkMode !== 'none' || Object.keys(configuration.HostConfig.PortBindings ?? {}).length) {
  throw Error('QA container must have network none and no published ports');
}
const read = name => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
const run = sql => {
  const response = spawnSync('docker', ['exec', '-i', '-e', 'PGPASSWORD=homecare-local-qa-only', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', database], {
    input: sql, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024
  });
  process.stdout.write(response.stdout ?? '');
  process.stderr.write(response.stderr ?? '');
  if (response.status !== 0) process.exit(response.status ?? 1);
};
const state = spawnSync('docker', ['exec', '-e', 'PGPASSWORD=homecare-local-qa-only', container, 'psql', '-X', '-At', '-U', 'supabase_admin', '-d', database,
  '-c', "select (to_regclass('lifecycle_private.epoch') is not null)::int || ',' || (to_regnamespace('audit_private') is not null)::int || ',' || exists(select 1 from information_schema.columns where table_schema='public' and table_name='attendance_records' and column_name='auto_checkout_route_id')::int"], { encoding: 'utf8' });
if (state.status !== 0) throw Error('Synthetic clone must be prepared first');
const [hasEpoch, hasAudit, hasExtension] = state.stdout.trim().split(',').map(Number);
// Bring this old, isolated synthetic baseline up to the already-published source before regressions.
if (!hasEpoch) run(read('../supabase/migrations/20261006230220_lifecycle_recovery_retention_epoch.sql'));
if (!hasAudit) {
  for (const name of ['20261007202014_order_audit_v3.sql', '20261011204242_audit_readable_context.sql', '20261011213150_audit_readable_values.sql']) {
    run(read('../supabase/migrations/' + name));
  }
}
if (!hasExtension) {
  run(read('../supabase/migrations/20261012130040_route_extension.sql'));
  run(read('../supabase/migrations/20261012192810_route_extension_relevant_members.sql'));
}
// The legacy clone has mixed function owners. Give its existing postgres-owned writers
// access to private objects installed by the local bootstrap administrator; never grant to API roles.
run('grant usage on schema lifecycle_private,audit_private to postgres; grant all privileges on all tables in schema lifecycle_private,audit_private to postgres; grant execute on all functions in schema lifecycle_private,audit_private to postgres;');
// This synthetic baseline predates the final edit-order repair. Install its missing source
// functions and guard before exercising the published lifecycle. No changes to the original QA DB.
const repairSource = read('../supabase/migrations/20261006192545_order_lifecycle_safe_repair.sql');
const repairFunctions = ['current_order', 'edit_snapshot', 'guard_edit_statement'].map(name => {
  const start = repairSource.indexOf('create function lifecycle_private.' + name + '(');
  const end = repairSource.indexOf('$;', repairSource.indexOf('as $', start)) + 3;
  if (start < 0 || end < 3) throw Error('Missing published repair function ' + name);
  return repairSource.slice(start, end).replace('create function', 'create or replace function');
}).join('\n');
run('alter table lifecycle_private.context add column if not exists order_id uuid;\n' + repairFunctions);
const repairTriggers = [...repairSource.matchAll(/^create trigger lifecycle_01_[^\r\n]+/gm)].map(match => {
  const statement = match[0];
  const [, trigger, table] = statement.match(/^create trigger (\w+).*? on public\.(\w+) /);
  return 'drop trigger if exists ' + trigger + ' on public.' + table + ';\n' + statement;
}).join('\n');
run(repairTriggers);
const extensionSource = read('../supabase/migrations/20261012130040_route_extension.sql');
const guardStart = extensionSource.indexOf('create or replace function lifecycle_private.guard_row(');
const guardEnd = extensionSource.indexOf('$;', extensionSource.indexOf('as $', guardStart)) + 3;
if (guardStart < 0) throw Error('Missing final lifecycle guard');
run(extensionSource.slice(guardStart, guardEnd));
run('grant execute on all functions in schema lifecycle_private to postgres;');
const migration = read('../supabase/migrations/20261020182917_consumption_exact_counts.sql').replace(/^\s*(begin|commit);\s*$/gmi, '');
run(`begin;\n${migration}\n${read('./tests/consumption-counts.sql')}\nrollback;`);
if (process.argv.includes('--benchmark')) {
  run(`begin;\n${migration}\n${read('./tests/consumption-benchmark.sql')}\nrollback;`);
}
for (const name of ['order-lifecycle.sql', 'route-extension.sql', 'route-extension-membership.sql', 'order-edit-delete.sql']) {
  console.log(`Regression: ${name}`);
  // The legacy synthetic clone contains an earlier b-prefixed edit fixture; use a separate namespace.
  const sql = read(`./tests/${name}`);
  run(name === 'order-edit-delete.sql' ? sql.replace(/b([0-9a-f]{7}-[0-9a-f-]{27,})/g, 'd$1') : sql);
}

