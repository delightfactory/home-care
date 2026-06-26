-- Backup V2: private, chunked, resource-bounded application-data snapshots.
-- Installs storage and creation logic only. It does not run or schedule backup.

create schema if not exists internal_maintenance;

revoke all on schema internal_maintenance from public;
revoke all on schema internal_maintenance from anon;
revoke all on schema internal_maintenance from authenticated;

create table internal_maintenance.backup_v2_runs (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  tables_count integer not null default 0,
  total_rows bigint not null default 0,
  total_size_bytes bigint not null default 0,
  error_message text,
  format_version integer not null default 2
);

create table internal_maintenance.backup_v2_chunks (
  run_id uuid not null
    references internal_maintenance.backup_v2_runs(id) on delete cascade,
  table_name text not null,
  table_order integer not null,
  row_count bigint not null,
  size_bytes bigint not null,
  checksum_md5 text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (run_id, table_name),
  unique (run_id, table_order)
);

create index backup_v2_runs_completed_idx
  on internal_maintenance.backup_v2_runs(completed_at desc)
  where status = 'completed';

revoke all on table internal_maintenance.backup_v2_runs from public;
revoke all on table internal_maintenance.backup_v2_runs from anon;
revoke all on table internal_maintenance.backup_v2_runs from authenticated;
revoke all on table internal_maintenance.backup_v2_chunks from public;
revoke all on table internal_maintenance.backup_v2_chunks from anon;
revoke all on table internal_maintenance.backup_v2_chunks from authenticated;

grant usage on schema internal_maintenance to service_role;
grant select on internal_maintenance.backup_v2_runs to service_role;
grant select on internal_maintenance.backup_v2_chunks to service_role;

create or replace function internal_maintenance.create_backup_v2(
  p_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_maintenance
as $function$
declare
  v_run_id uuid;
  v_table text;
  v_order integer := 0;
  v_payload jsonb;
  v_rows bigint;
  v_size bigint;
  v_total_rows bigint := 0;
  v_total_size bigint := 0;
  v_max_table_bytes constant bigint := 32 * 1024 * 1024;
  v_max_total_bytes constant bigint := 64 * 1024 * 1024;
  v_tables constant text[] := array[
    'roles', 'users', 'service_categories', 'services',
    'expense_categories', 'system_settings', 'company_locations',
    'public_holidays', 'penalty_rules', 'customers', 'workers', 'teams',
    'team_members', 'orders', 'routes', 'order_items', 'route_orders',
    'order_workers', 'order_status_logs', 'expenses', 'daily_reports',
    'team_performance', 'customer_surveys', 'vaults',
    'vault_transactions', 'custody_accounts', 'custody_transactions',
    'invoices', 'invoice_items', 'attendance_records', 'payroll_periods',
    'payroll_items', 'payroll_disbursements', 'salary_advances',
    'advance_installments', 'hr_adjustments', 'conversations',
    'conversation_participants', 'messages', 'message_read_receipts',
    'notification_preferences', 'push_subscriptions'
  ];
begin
  perform set_config('lock_timeout', '2s', true);
  perform set_config('statement_timeout', '300s', true);

  if not pg_try_advisory_xact_lock(hashtext('home-care-backup-v2')) then
    raise exception 'Backup V2 is already running';
  end if;

  insert into internal_maintenance.backup_v2_runs(label)
  values (
    coalesce(
      nullif(btrim(p_label), ''),
      'Auto V2 ' || to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI')
    )
  )
  returning id into v_run_id;

  begin
    foreach v_table in array v_tables loop
      v_order := v_order + 1;

      if to_regclass(format('public.%I', v_table)) is null then
        raise exception 'Expected backup table public.% is missing', v_table;
      end if;

      execute format(
        'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb), count(*) from public.%I t',
        v_table
      )
      into v_payload, v_rows;

      v_size := pg_column_size(v_payload);

      if v_size > v_max_table_bytes then
        raise exception
          'Table % payload is % bytes, above the % byte safety limit',
          v_table, v_size, v_max_table_bytes;
      end if;

      v_total_rows := v_total_rows + v_rows;
      v_total_size := v_total_size + v_size;

      if v_total_size > v_max_total_bytes then
        raise exception
          'Backup payload reached % bytes, above the % byte safety limit',
          v_total_size, v_max_total_bytes;
      end if;

      insert into internal_maintenance.backup_v2_chunks(
        run_id, table_name, table_order, row_count, size_bytes,
        checksum_md5, payload
      )
      values (
        v_run_id, v_table, v_order, v_rows, v_size,
        md5(v_payload::text), v_payload
      );

      v_payload := null;
    end loop;

    update internal_maintenance.backup_v2_runs
    set status = 'completed',
        completed_at = clock_timestamp(),
        tables_count = v_order,
        total_rows = v_total_rows,
        total_size_bytes = v_total_size
    where id = v_run_id;

    -- Free-plan guard: keep only the newest completed internal snapshot.
    -- The previous snapshot is deleted only after the new one is complete.
    delete from internal_maintenance.backup_v2_runs
    where status = 'completed'
      and id <> v_run_id;

    return jsonb_build_object(
      'success', true,
      'run_id', v_run_id,
      'tables_count', v_order,
      'total_rows', v_total_rows,
      'total_size_bytes', v_total_size
    );
  exception
    when others then
      delete from internal_maintenance.backup_v2_chunks
      where run_id = v_run_id;

      update internal_maintenance.backup_v2_runs
      set status = 'failed',
          completed_at = clock_timestamp(),
          tables_count = v_order,
          total_rows = v_total_rows,
          total_size_bytes = v_total_size,
          error_message = left(sqlerrm, 2000)
      where id = v_run_id;

      return jsonb_build_object(
        'success', false,
        'run_id', v_run_id,
        'failed_table', v_table,
        'error', sqlerrm
      );
  end;
end;
$function$;

revoke all on function internal_maintenance.create_backup_v2(text) from public;
revoke all on function internal_maintenance.create_backup_v2(text) from anon;
revoke all on function internal_maintenance.create_backup_v2(text) from authenticated;
grant execute on function internal_maintenance.create_backup_v2(text) to service_role;

comment on schema internal_maintenance is
  'Private maintenance objects. Not intended for Data API exposure.';

comment on function internal_maintenance.create_backup_v2(text) is
  'Creates one private chunked application-data snapshot with resource limits. No Cron is installed.';
