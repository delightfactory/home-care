-- Defer retention pruning until the scheduled runner fully validates the new
-- snapshot. This preserves the previous completed snapshot on any failure.

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

    -- Retention pruning is intentionally performed by
    -- run_scheduled_backup_v2() only after full integrity validation.
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
    raise exception 'Expected % chunks, found %', v_expected_tables, v_chunks;
  end if;

  if v_invalid <> 0 then
    raise exception 'Found % invalid backup chunks', v_invalid;
  end if;

  if v_rows <> (v_result->>'total_rows')::bigint
     or v_size <> (v_result->>'total_size_bytes')::bigint then
    raise exception 'Backup V2 chunk totals do not match run totals';
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
    raise exception 'Backup V2 run summary is inconsistent';
  end if;

  -- Keep one completed internal snapshot only after the new snapshot passed
  -- every integrity check.
  delete from internal_maintenance.backup_v2_runs
  where status = 'completed'
    and id <> v_run_id;
end;
$function$;

revoke all on function internal_maintenance.create_backup_v2(text) from public;
revoke all on function internal_maintenance.create_backup_v2(text) from anon;
revoke all on function internal_maintenance.create_backup_v2(text) from authenticated;
grant execute on function internal_maintenance.create_backup_v2(text) to service_role;

revoke all on function internal_maintenance.run_scheduled_backup_v2() from public;
revoke all on function internal_maintenance.run_scheduled_backup_v2() from anon;
revoke all on function internal_maintenance.run_scheduled_backup_v2() from authenticated;
grant execute on function internal_maintenance.run_scheduled_backup_v2() to service_role;
