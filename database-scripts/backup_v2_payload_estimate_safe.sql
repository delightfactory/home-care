-- ============================================================================
-- Backup V2 logical payload estimate
-- Production tables are SELECTed only. A temporary result table exists solely
-- inside this transaction and is removed by the final ROLLBACK.
-- No JSON aggregation is performed.
-- ============================================================================

begin;

create temporary table backup_v2_estimate_results (
  table_name text primary key,
  exact_rows bigint not null,
  logical_bytes numeric not null,
  measured_at timestamptz not null default now()
);

do $$
declare
  v_table text;
  v_rows bigint;
  v_bytes numeric;
  v_tables constant text[] := array[
    'roles',
    'users',
    'service_categories',
    'services',
    'expense_categories',
    'system_settings',
    'company_locations',
    'public_holidays',
    'penalty_rules',
    'customers',
    'workers',
    'teams',
    'team_members',
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
    'vaults',
    'vault_transactions',
    'custody_accounts',
    'custody_transactions',
    'invoices',
    'invoice_items',
    'attendance_records',
    'payroll_periods',
    'payroll_items',
    'payroll_disbursements',
    'salary_advances',
    'advance_installments',
    'hr_adjustments',
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
    values (v_table, v_rows, v_bytes);
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

rollback;
