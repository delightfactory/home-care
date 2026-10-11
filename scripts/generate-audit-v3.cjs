// Fixed reviewed source manifest, not runtime-configurable capture rules.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifest = require('./audit-v3-coverage.json');
const mode = process.argv[2] || 'core';
if (!['core', 'all'].includes(mode)) throw new Error('Expected core or all');
const core = new Set(['orders', 'order_items', 'order_status_logs', 'order_workers', 'routes', 'route_orders', 'teams', 'team_members', 'workers', 'users', 'roles']);
const targets = manifest.publicTargets.filter(t => mode === 'all' || core.has(t.table.split('.')[1]));
const ident = s => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error('Invalid identifier'); return '"' + s + '"'; };
const lit = s => "'" + s.replaceAll("'", "''") + "'";
function projection(t, alias) {
  return 'jsonb_build_object(' + t.fields.flatMap(f => [lit(f.field), ['text','varchar','confirmation_status_enum'].includes(f.type) ? `left(${alias}.${ident(f.field)}::text,160)` : `${alias}.${ident(f.field)}`]).join(',') + ')';
}
function capture(t) {
  const [schema, table] = t.table.split('.');
  const entityField = table === 'app_settings' ? 'key' : 'id';
  const entity = table === 'app_settings'
    ? "'key-sha256:'||encode(sha256(convert_to(case when TG_OP='DELETE' then OLD.key else NEW.key end,'UTF8')),'hex')"
    : `case when TG_OP='DELETE' then OLD.${entityField}::text else NEW.${entityField}::text end`;
  const markers = t.changeMarkers || [];
  // Orders can be touched by nested business triggers without audited changes.
  // Keep comparison errors inside the same fail-open capture boundary.
  if (table === 'orders' && (t.fields.length !== 16 || markers.length !== 0)) throw new Error('Re-review orders no-op scope');
  const ordersNoop = table === 'orders' ? `
  if TG_OP='UPDATE' then
   if ${t.fields.map(f => `OLD.${ident(f.field)} is not distinct from NEW.${ident(f.field)}`).join('\n    and ')} then return null; end if;
  end if;` : '';
  const changed = t.fields.map(f => `case when OLD.${ident(f.field)} is distinct from NEW.${ident(f.field)} then ${lit(f.field)} end`).join(',');
  const markerSql = markers.length ? 'jsonb_build_object(' + markers.flatMap(m => [lit(m.marker), `OLD.${ident(m.field)} is distinct from NEW.${ident(m.field)}`]).join(',') + ')' : "'{}'::jsonb";
  const textFields = t.fields.filter(f => ['text','varchar','confirmation_status_enum'].includes(f.type));
  const redactions = textFields.map(f => `case when (TG_OP <> 'INSERT' and char_length(OLD.${ident(f.field)}::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW.${ident(f.field)}::text)>160) then ${lit(f.field)} end`).join(',');
  return `
create function audit_private.capture_${table}() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin${ordersNoop}
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[${changed}]::text[],null);
   v_markers := ${markerSql};
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array[${t.fields.map(f=>lit(f.field)).join(',')}]::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := ${projection(t,'OLD')}; end if;
  if TG_OP <> 'DELETE' then v_after := ${projection(t,'NEW')}; end if;
  v_redacted := ${redactions ? `array_remove(array[${redactions}]::text[],null)` : "'{}'::text[]"};
  perform audit_private.append_event(${lit(schema)},${lit(table)},${entity},TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%',${lit(t.table)},TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_${table}() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on ${ident(schema)}.${ident(table)} for each row execute function audit_private.capture_${table}();
`;
}
const prelude = fs.readFileSync(path.join(__dirname,'audit-v3-kernel.sql'),'utf8');
const readers = fs.readFileSync(path.join(__dirname,'audit-v3-readers.sql'),'utf8');
const special = mode === 'all' ? fs.readFileSync(path.join(__dirname,'audit-v3-special.sql'),'utf8') : '';
const extraSources = mode === 'all' ? [
  {table:'lifecycle_private.requests',operations:['INSERT'],eventKind:'committed_operation',fields:['actor','request','created_at','operation','epoch','order_id','route_id','destination_id'],markers:[]},
  {table:'lifecycle_private.epoch',operations:['UPDATE'],eventKind:'recovery_epoch_changed',fields:['token','changed_at'],markers:[]}
] : [];
const sql = prelude + targets.map(capture).join('\n') + '\n' + special + '\n' + readers + '\ncommit;\n';
fs.writeFileSync(path.join(root,'supabase/migrations/20261007202014_order_audit_v3.sql'), sql);
fs.writeFileSync(path.join(root,'scripts/audit-v3-active-sources.json'),JSON.stringify({mode,sources:targets.map(t=>({table:t.table,fields:t.fields.map(f=>f.field),markers:(t.changeMarkers||[]).map(m=>m.marker)})),extraSources,targetCount:40,totalSources:targets.length+extraSources.length,qualificationStatus:'NOT_RELEASE_QUALIFIED'},null,2)+'\n');
console.log(`Generated ${targets.length} fixed sources (${mode}).`);
