-- ============================================================================
-- Maintenance Phase 3: create and verify the first Backup V2 snapshot
--
-- This file creates ONE internal application-data snapshot.
-- It does not create Cron, restore data, delete application rows, or touch
-- Storage objects. Run during low usage.
--
-- The snapshot excludes performance_logs, notifications, materialized views,
-- app_settings secrets, Supabase Auth internals, and Storage file bytes.
-- ============================================================================

-- D1) PRECHECK (READ ONLY)
-- Expected before the first run: runs_count=0, chunks_count=0.
select
  (select count(*) from internal_maintenance.backup_v2_runs) as runs_count,
  (select count(*) from internal_maintenance.backup_v2_chunks) as chunks_count,
  pg_size_pretty(pg_database_size(current_database())) as database_size_before;

-- D2) CREATE ONE SNAPSHOT
-- Expected JSON: success=true, tables_count=43, and a run_id.
select internal_maintenance.create_backup_v2(
  'Initial verified V2 snapshot'
) as result;

-- D3) VERIFY THE RUN SUMMARY (READ ONLY)
select
  id,
  label,
  status,
  started_at,
  completed_at,
  completed_at - started_at as duration,
  tables_count,
  total_rows,
  total_size_bytes,
  pg_size_pretty(total_size_bytes) as total_size,
  error_message
from internal_maintenance.backup_v2_runs
order by started_at desc;

-- D4) VERIFY EVERY TABLE CHUNK (READ ONLY)
select
  table_order,
  table_name,
  row_count,
  size_bytes,
  pg_size_pretty(size_bytes) as size,
  length(checksum_md5) = 32 as checksum_present,
  jsonb_typeof(payload) = 'array' as payload_is_array
from internal_maintenance.backup_v2_chunks
where run_id = (
  select id
  from internal_maintenance.backup_v2_runs
  where status = 'completed'
  order by completed_at desc
  limit 1
)
order by table_order;

-- D5) CROSS-CHECK TOTALS AND PHYSICAL DATABASE SIZE (READ ONLY)
select
  r.id as run_id,
  r.status,
  r.tables_count,
  count(c.table_name) as actual_chunks,
  r.total_rows,
  coalesce(sum(c.row_count), 0) as actual_rows,
  r.total_size_bytes,
  coalesce(sum(c.size_bytes), 0) as actual_size_bytes,
  pg_size_pretty(
    pg_total_relation_size('internal_maintenance.backup_v2_runs')
    + pg_total_relation_size('internal_maintenance.backup_v2_chunks')
  ) as backup_tables_physical_size,
  pg_size_pretty(pg_database_size(current_database())) as database_size_after
from internal_maintenance.backup_v2_runs r
left join internal_maintenance.backup_v2_chunks c on c.run_id = r.id
group by
  r.id,
  r.status,
  r.tables_count,
  r.total_rows,
  r.total_size_bytes
order by r.started_at desc;

-- Stop here. No Cron is created by this file.
