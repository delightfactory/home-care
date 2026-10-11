const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const manifest = require('../audit-v3-coverage.json');
const active = require('../audit-v3-active-sources.json');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261007202014_order_audit_v3.sql'), 'utf8');
assert.equal(manifest.publicTargets.length, 40);
assert.equal(new Set(manifest.publicTargets.map(t => t.table)).size, 40);
const extraSources = active.extraSources || [];
assert.equal((sql.match(/create trigger audit_v3_capture /g) || []).length, active.sources.length + extraSources.length);
assert.equal(active.sources.length, active.mode === 'all' ? 40 : 11);
assert.equal(extraSources.length, active.mode === 'all' ? 2 : 0);
assert(!/to_jsonb\s*\(\s*(old|new)\s*\)/i.test(sql), 'Never serialize a complete business row');
assert(!/\b(references|pg_advisory|http_|pg_sleep|set\s+statement_timeout)\b/i.test(sql));
assert(sql.includes('lock table audit_private.events in row exclusive mode nowait'));
assert(sql.includes('lock table audit_private.config in access share mode nowait'));
assert(sql.includes('pg_current_xact_id()::text'));
assert(sql.includes('<=16384'));
// Upper bound for the fixed metadata envelope. JSON escapes can expand a code
// point to six bytes. Use the worst escaped entity, and duplicate every known
// field name into both metadata arrays (larger than any actual wrapper output).
const uuid='f'.repeat(8)+'-'+ 'f'.repeat(4)+'-'+ 'f'.repeat(4)+'-'+ 'f'.repeat(4)+'-'+ 'f'.repeat(12);
const boundedTargets = manifest.publicTargets.concat(extraSources.map(t=>({table:t.table,fields:t.fields.map(field=>({field}))})));
const overheads=boundedTargets.map(t=>Buffer.byteLength(JSON.stringify({
 id:uuid,occurred_at:'9999-12-31T23:59:59.999999+14:00',table_schema:t.table.split('.')[0],table_name:t.table.split('.')[1],
 entity_id:'\u0001'.repeat(160),operation:'UPDATE',event_kind:'recovery_epoch_changed',actor_id:uuid,actor_kind:'authenticated',
 transaction_id:'18446744073709551615',database_generation:uuid,before_values:null,after_values:null,
 changed_fields:t.fields.map(f=>f.field),change_markers:{},redacted_fields:t.fields.map(f=>f.field),payload_redacted:false
}))+256); // PostgreSQL JSONB spacing plus fixed expansion reserve.
assert(Math.max(...overheads)<6144, 'Metadata overhead proof invalid: revisit the bound before adding sources');
for (const target of manifest.publicTargets) {
  const fields = target.fields.map(f => f.field);
  assert(!fields.some(f => /password|token|secret|message|notes|latitude|longitude|dump|payload|result/.test(f)), target.table);
  assert(target.fields.every(f => !['json','jsonb','bytea'].includes(f.type)), target.table);
  if (['public.roles','public.notification_preferences','public.app_settings','public.system_settings'].includes(target.table)) {
    assert((target.changeMarkers || []).length > 0, target.table + ' must retain value-only change markers');
  }
}
for (const s of active.sources) {
  assert(sql.includes(`create function audit_private.capture_${s.table.split('.')[1]}()`));
  assert(sql.includes(`from public,anon,authenticated,service_role`));
}
if (active.mode === 'all') {
  assert(sql.includes("'key-sha256:'||encode(sha256(convert_to(case when TG_OP='DELETE' then OLD.key else NEW.key end,'UTF8')),'hex')"));
  const special = fs.readFileSync(path.join(root,'scripts/audit-v3-special.sql'),'utf8');
  assert(!/NEW\.(result|reason)|to_jsonb|jsonb_each|jsonb_array_elements|NEW\.payload\s*[,)]/i.test(special), 'No unrestricted receipt/result/reason projection');
  assert.deepEqual([...special.matchAll(/NEW\.payload->>?\s*'([^']+)'/g)].map(m=>m[1]).filter((v,i,a)=>a.indexOf(v)===i).sort(), ['destination_id','op','order_id','route_id']);
  assert(special.includes("jsonb_typeof(NEW.payload->'op')"));
  for (const key of ['order_id','route_id','destination_id']) assert(special.includes(`jsonb_typeof(NEW.payload->'${key}')='string'`));
  assert(special.includes("if v_operation not in ('save','transfer','route_update','start','delete_route','edit_order','delete_order')"));
  assert(special.includes('OLD.token is not distinct from NEW.token'));
  assert(special.includes("'requests',NEW.actor::text||':'||NEW.request::text"));
  for (const source of extraSources) {
    const table = source.table.split('.')[1];
    assert(sql.includes(`create function audit_private.capture_${table}()`));
    assert(sql.includes(`create trigger audit_v3_capture after ${source.operations[0].toLowerCase()} on ${source.table}`));
  }
}
console.log(JSON.stringify({status:'PASS_STATIC_ONLY',sources:active.sources.length,extraSources:extraSources.length,mode:active.mode,maximumConservativeMetadataBytes:Math.max(...overheads),metadataReserve:6144,limitations:'Does not qualify runtime locking, permissions, performance or business equivalence.'}));
