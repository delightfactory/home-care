-- ============================================================================
-- Backup V2 logical payload estimate
-- READ ONLY. No JSON aggregation, no writes, no locks beyond normal SELECT.
--
-- This measures live row payload instead of physical table size/bloat.
-- Run once in Supabase SQL Editor during normal/low traffic.
-- ============================================================================

create temporary table if not exists backup_v2_estimate_results (
  table_name text primary key,
  exact_rows bigint not null,
  logical_bytes numeric not null,
  measured_at timestamptz not null default now()
) on commit drop;

do $$
declare
  v_table text;
  v_rows bigint;
  v_bytes numeric;
  v_tables constant text[] := array[
    -- Identity and configuration
    'roles',
    'users',
    'service_categories',
    'services',
    'expense_categories',
    'system_settings',
    'company_locations',
    'public_holidays',
    'penalty_rules',

    -- Customers and workforce
    'customers',
    'workers',
    'teams',
    'team_members',

    -- Operations
    'orders',
    'routes',
    'order_items',
    'route_orders',
    'order_workers',
    'order_status_logs',
    'expenses',
    'daily_reports',
    'team_performance',
    'customer_surveys',

    -- Finance and custody
    'vaults',
    'vault_transactions',
    'custody_accounts',
    'custody_transactions',
    'invoices',
    'invoice_items',

    -- HR and payroll
    'attendance_records',
    'payroll_periods',
    'payroll_items',
    'payroll_disbursements',
    'salary_advances',
    'advance_installments',
    'hr_adjustments',

    -- Messaging configuration/data
    'conversations',
    'conversation_participants',
    'messages',
    'message_read_receipts',
    'notification_preferences',
    'push_subscriptions'
  ];
begin
  perform set_config('statement_timeout', '60s', true);
  perform set_config('lock_timeout', '2s', true);

  foreach v_table in array v_tables loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'Safety stop: expected table public.% is missing', v_table;
    end if;

    execute format(
      'select count(*), coalesce(sum(pg_column_size(t)), 0) from public.%I t',
      v_table
    )
    into v_rows, v_bytes;

    insert into backup_v2_estimate_results(table_name, exact_rows, logical_bytes)
    values (v_table, v_rows, v_bytes)
    on conflict (table_name) do update
      set exact_rows = excluded.exact_rows,
          logical_bytes = excluded.logical_bytes,
          measured_at = now();
  end loop;
end
$$;

select
  table_name,
  exact_rows,
  logical_bytes::bigint as logical_bytes,
  pg_size_pretty(logical_bytes::bigint) as logical_size
from backup_v2_estimate_results
order by logical_bytes desc, table_name;

select
  sum(exact_rows) as total_rows,
  sum(logical_bytes)::bigint as total_logical_bytes,
  pg_size_pretty(sum(logical_bytes)::bigint) as total_logical_size
from backup_v2_estimate_results;
