-- ============================================================================
-- Backup V2 scope inventory
-- READ ONLY: SELECT statements only.
-- Purpose: prove which production tables are omitted by the legacy backup and
-- collect dependency order before creating a replacement backup/restore pair.
-- ============================================================================

-- 1) All user tables with footprint and legacy-backup coverage
with legacy_backup_tables(table_name) as (
  values
    ('roles'),
    ('customers'),
    ('workers'),
    ('teams'),
    ('team_members'),
    ('service_categories'),
    ('services'),
    ('expense_categories'),
    ('system_settings'),
    ('orders'),
    ('order_items'),
    ('order_status_logs'),
    ('routes'),
    ('route_orders'),
    ('order_workers'),
    ('expenses'),
    ('daily_reports'),
    ('team_performance'),
    ('performance_logs')
)
select
  s.relname as table_name,
  s.n_live_tup as estimated_live_rows,
  pg_total_relation_size(s.relid) as total_size_bytes,
  pg_size_pretty(pg_total_relation_size(s.relid)) as total_size,
  (l.table_name is not null) as included_in_legacy_backup,
  case
    when s.relname in (
      'performance_logs',
      'notifications',
      'call_logs',
      'voice_calls'
    ) then 'retention_or_audit'
    when s.relname in (
      'storage_usage'
    ) then 'derived_or_tracking'
    else 'business_or_configuration'
  end as preliminary_classification
from pg_stat_user_tables s
left join legacy_backup_tables l on l.table_name = s.relname
where s.schemaname = 'public'
order by included_in_legacy_backup, total_size_bytes desc, table_name;

-- 2) Foreign-key dependency graph
select
  tc.table_name as child_table,
  kcu.column_name as child_column,
  ccu.table_name as parent_table,
  ccu.column_name as parent_column,
  rc.delete_rule,
  rc.update_rule,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name
 and kcu.constraint_schema = tc.constraint_schema
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name
 and rc.constraint_schema = tc.constraint_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = rc.unique_constraint_name
 and ccu.constraint_schema = rc.unique_constraint_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
order by parent_table, child_table, tc.constraint_name;

-- 3) Tables omitted from the legacy backup that currently contain rows
with legacy_backup_tables(table_name) as (
  values
    ('roles'),
    ('customers'),
    ('workers'),
    ('teams'),
    ('team_members'),
    ('service_categories'),
    ('services'),
    ('expense_categories'),
    ('system_settings'),
    ('orders'),
    ('order_items'),
    ('order_status_logs'),
    ('routes'),
    ('route_orders'),
    ('order_workers'),
    ('expenses'),
    ('daily_reports'),
    ('team_performance'),
    ('performance_logs')
)
select
  s.relname as omitted_table,
  s.n_live_tup as estimated_live_rows,
  pg_size_pretty(pg_total_relation_size(s.relid)) as total_size
from pg_stat_user_tables s
left join legacy_backup_tables l on l.table_name = s.relname
where s.schemaname = 'public'
  and l.table_name is null
  and s.n_live_tup > 0
order by pg_total_relation_size(s.relid) desc, omitted_table;

-- 4) Primary-key coverage. Restore validation needs a stable key per table.
select
  t.table_name,
  string_agg(k.column_name, ', ' order by k.ordinal_position) as primary_key_columns
from information_schema.tables t
left join information_schema.table_constraints c
  on c.table_schema = t.table_schema
 and c.table_name = t.table_name
 and c.constraint_type = 'PRIMARY KEY'
left join information_schema.key_column_usage k
  on k.constraint_schema = c.constraint_schema
 and k.constraint_name = c.constraint_name
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
group by t.table_name
order by t.table_name;

-- 5) Existing backup and restore function security configuration
select
  n.nspname as schema_name,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_backup_and_return',
    'create_scheduled_backup',
    'restore_from_backup',
    'reset_operational_data',
    'prune_old_backups'
  )
order by p.proname, arguments;
