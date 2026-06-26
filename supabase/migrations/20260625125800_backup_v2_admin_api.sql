-- Admin-facing Backup V2 API.
-- Exposes metadata, verified manual creation, and chunked download only.
-- Restore, operational reset, and deletion are intentionally not exposed.

create or replace function public.admin_list_backup_v2()
returns table (
  id uuid,
  label text,
  status text,
  created_at timestamptz,
  completed_at timestamptz,
  tables_count integer,
  total_rows bigint,
  size_bytes bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, internal_maintenance
as $function$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and u.is_active is true
      and coalesce((r.permissions ->> 'admin')::boolean, false)
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select
    b.id,
    b.label,
    b.status,
    b.started_at,
    b.completed_at,
    b.tables_count,
    b.total_rows,
    b.total_size_bytes
  from internal_maintenance.backup_v2_runs b
  where b.status = 'completed'
  order by b.completed_at desc nulls last;
end;
$function$;

create or replace function public.admin_create_backup_v2(
  p_label text default null
)
returns jsonb
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
  if auth.uid() is null or not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and u.is_active is true
      and coalesce((r.permissions ->> 'admin')::boolean, false)
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  v_result := internal_maintenance.create_backup_v2(
    left(nullif(btrim(p_label), ''), 200)
  );

  if coalesce((v_result ->> 'success')::boolean, false) is not true then
    raise exception 'Backup V2 creation failed: %',
      coalesce(v_result ->> 'error', v_result::text);
  end if;

  v_run_id := (v_result ->> 'run_id')::uuid;

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

  if v_chunks <> v_expected_tables
     or v_invalid <> 0
     or v_rows <> (v_result ->> 'total_rows')::bigint
     or v_size <> (v_result ->> 'total_size_bytes')::bigint then
    raise exception 'Backup V2 integrity validation failed';
  end if;

  if not exists (
    select 1
    from internal_maintenance.backup_v2_runs b
    where b.id = v_run_id
      and b.status = 'completed'
      and b.tables_count = v_expected_tables
      and b.total_rows = v_rows
      and b.total_size_bytes = v_size
  ) then
    raise exception 'Backup V2 summary validation failed';
  end if;

  -- Keep the previous snapshot until the new one has passed every check.
  delete from internal_maintenance.backup_v2_runs
  where status = 'completed'
    and id <> v_run_id;

  return v_result;
end;
$function$;

create or replace function public.admin_get_backup_v2_manifest(
  p_run_id uuid
)
returns table (
  table_name text,
  table_order integer,
  row_count bigint,
  size_bytes bigint,
  checksum_md5 text
)
language plpgsql
security definer
set search_path = pg_catalog, public, internal_maintenance
as $function$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and u.is_active is true
      and coalesce((r.permissions ->> 'admin')::boolean, false)
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from internal_maintenance.backup_v2_runs b
    where b.id = p_run_id
      and b.status = 'completed'
  ) then
    raise exception 'Completed backup not found';
  end if;

  return query
  select
    c.table_name,
    c.table_order,
    c.row_count,
    c.size_bytes,
    c.checksum_md5
  from internal_maintenance.backup_v2_chunks c
  where c.run_id = p_run_id
  order by c.table_order;
end;
$function$;

create or replace function public.admin_download_backup_v2_chunk(
  p_run_id uuid,
  p_table_name text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_maintenance
as $function$
declare
  v_payload jsonb;
  v_expected_checksum text;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and u.is_active is true
      and coalesce((r.permissions ->> 'admin')::boolean, false)
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select c.payload, c.checksum_md5
  into v_payload, v_expected_checksum
  from internal_maintenance.backup_v2_chunks c
  join internal_maintenance.backup_v2_runs b on b.id = c.run_id
  where c.run_id = p_run_id
    and c.table_name = p_table_name
    and b.status = 'completed';

  if not found then
    raise exception 'Backup chunk not found';
  end if;

  if jsonb_typeof(v_payload) <> 'array'
     or md5(v_payload::text) <> v_expected_checksum then
    raise exception 'Backup chunk integrity validation failed';
  end if;

  return v_payload;
end;
$function$;

revoke all on function public.admin_list_backup_v2() from public, anon;
revoke all on function public.admin_create_backup_v2(text) from public, anon;
revoke all on function public.admin_get_backup_v2_manifest(uuid) from public, anon;
revoke all on function public.admin_download_backup_v2_chunk(uuid, text) from public, anon;

grant execute on function public.admin_list_backup_v2() to authenticated;
grant execute on function public.admin_create_backup_v2(text) to authenticated;
grant execute on function public.admin_get_backup_v2_manifest(uuid) to authenticated;
grant execute on function public.admin_download_backup_v2_chunk(uuid, text) to authenticated;
