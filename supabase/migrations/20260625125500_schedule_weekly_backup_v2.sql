-- Schedule one verified V2 backup every Friday at 01:00 UTC.
-- This migration does not execute a backup immediately and contains no secrets.

DO $$
DECLARE
  v_existing_job_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_cron'
  ) THEN
    RAISE EXCEPTION 'pg_cron is not installed';
  END IF;

  IF to_regprocedure('internal_maintenance.run_scheduled_backup_v2()') IS NULL THEN
    RAISE EXCEPTION
      'internal_maintenance.run_scheduled_backup_v2() is not installed';
  END IF;

  SELECT count(*)
  INTO v_existing_job_count
  FROM cron.job
  WHERE jobname = 'weekly-backup-v2';

  IF v_existing_job_count > 0 THEN
    RAISE EXCEPTION
      'Cron job weekly-backup-v2 already exists; inspect it before rescheduling';
  END IF;

  PERFORM cron.schedule(
    'weekly-backup-v2',
    '0 1 * * 5',
    'SELECT internal_maintenance.run_scheduled_backup_v2()'
  );
END;
$$;

