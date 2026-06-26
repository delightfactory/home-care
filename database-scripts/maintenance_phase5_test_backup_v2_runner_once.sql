-- ============================================================================
-- Manual one-time test of the scheduled runner.
-- Creates one new snapshot, validates it, and replaces the previous completed
-- snapshot only after success. It does not create Cron.
-- Run during low usage.
-- ============================================================================

-- E1) PRECHECK
select
  id,
  status,
  completed_at,
  tables_count,
  total_rows,
  pg_size_pretty(total_size_bytes) as logical_size
from internal_maintenance.backup_v2_runs
order by started_at desc;

-- E2) RUN AND VALIDATE ONCE
-- Success returns one row with a void/null value.
-- Any creation or validation problem raises an SQL error.
select internal_maintenance.run_scheduled_backup_v2();

-- E3) VERIFY THAT ONLY ONE COMPLETED SNAPSHOT REMAINS
select
  id,
  label,
  status,
  started_at,
  completed_at,
  completed_at - started_at as duration,
  tables_count,
  total_rows,
  pg_size_pretty(total_size_bytes) as logical_size,
  error_message
from internal_maintenance.backup_v2_runs
order by started_at desc;

select
  count(*) as chunks_count,
  count(*) filter (
    where jsonb_typeof(payload) = 'array'
      and jsonb_array_length(payload) = row_count
      and md5(payload::text) = checksum_md5
  ) as valid_chunks
from internal_maintenance.backup_v2_chunks;
