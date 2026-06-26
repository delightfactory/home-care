-- Backup V2 scheduled runner.
-- Installs verification logic only. No Cron job is created by this migration.

create or replace function internal_maintenance.run_scheduled_backup_v2()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, internal_maintenance
as $function$
declare
  v_result jsonb;
  v_run_id uuid;
  v_expected_tables constant integer := 42;
  v_chunks bigint;
  v_rows bigint;
  v_size bigint;
  v_invalid bigint;
begin
  v_result := internal_maintenance.create_backup_v2(null);

  if coalesce((v_result->>'success')::boolean, false) is not true then
    raise exception 'Backup V2 creation failed: %', coalesce(v_result->>'error', v_result::text);
  end if;

  v_run_id := (v_result->>'run_id')::uuid;

  select
    count(*),
    coalesce(sum(c.row_count), 0),
    coalesce(sum(c.size_bytes), 0),
    count(*) filter (
      where jsonb_typeof(c.payload) <> 'array'
         or jsonb_array_length(c.payload) <> c.row_count
         or md5(c.payload::text) <> c.checksum_md5
    )
  into v_chunks, v_rows, v_size, v_invalid
  from internal_maintenance.backup_v2_chunks c
  where c.run_id = v_run_id;

  if v_chunks <> v_expected_tables then
    raise exception
      'Backup V2 validation failed: expected % chunks, found %',
      v_expected_tables, v_chunks;
  end if;

  if v_invalid <> 0 then
    raise exception
      'Backup V2 validation failed: % invalid chunks',
      v_invalid;
  end if;

  if v_rows <> (v_result->>'total_rows')::bigint then
    raise exception
      'Backup V2 validation failed: summary rows %, chunk rows %',
      v_result->>'total_rows', v_rows;
  end if;

  if v_size <> (v_result->>'total_size_bytes')::bigint then
    raise exception
      'Backup V2 validation failed: summary size %, chunk size %',
      v_result->>'total_size_bytes', v_size;
  end if;

  if not exists (
    select 1
    from internal_maintenance.backup_v2_runs r
    where r.id = v_run_id
      and r.status = 'completed'
      and r.tables_count = v_expected_tables
      and r.total_rows = v_rows
      and r.total_size_bytes = v_size
  ) then
    raise exception 'Backup V2 validation failed: run summary is inconsistent';
  end if;
end;
$function$;

revoke all on function internal_maintenance.run_scheduled_backup_v2() from public;
revoke all on function internal_maintenance.run_scheduled_backup_v2() from anon;
revoke all on function internal_maintenance.run_scheduled_backup_v2() from authenticated;
grant execute on function internal_maintenance.run_scheduled_backup_v2() to service_role;

comment on function internal_maintenance.run_scheduled_backup_v2() is
  'Creates and fully validates one Backup V2 snapshot. Raises on any failure so pg_cron records a failed run.';
