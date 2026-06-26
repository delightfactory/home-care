-- Read-only verification for the weekly V2 backup schedule.
-- Expected schedule: Friday at 01:00 UTC.

SELECT
  jobid,
  jobname,
  schedule,
  active,
  database,
  username,
  command
FROM cron.job
WHERE jobname IN (
  'weekly-backup-v2',
  'daily-backup',
  'cleanup-receipts-daily'
)
ORDER BY jobname;

-- Expected:
-- weekly-backup-v2: active = true, schedule = 0 1 * * 5
-- daily-backup: active = false
-- cleanup-receipts-daily: active = false

SELECT
  j.jobname,
  d.runid,
  d.status,
  d.return_message,
  d.start_time,
  d.end_time
FROM cron.job AS j
LEFT JOIN cron.job_run_details AS d
  ON d.jobid = j.jobid
WHERE j.jobname = 'weekly-backup-v2'
ORDER BY d.start_time DESC NULLS LAST
LIMIT 10;

-- It is normal for this result to have no completed run before the first Friday.

SELECT
  id,
  label,
  status,
  started_at,
  completed_at,
  tables_count,
  total_rows,
  pg_size_pretty(total_size_bytes) AS logical_size,
  error_message
FROM internal_maintenance.backup_v2_runs
ORDER BY started_at DESC
LIMIT 3;

