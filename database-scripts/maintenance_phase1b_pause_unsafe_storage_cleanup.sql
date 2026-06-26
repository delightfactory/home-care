-- ============================================================================
-- Maintenance Phase 1B
-- Pause the legacy receipts cleanup and remove the exposed service-role token
-- from cron.job.command.
--
-- This script does NOT delete Storage objects or application rows.
-- Run each block separately in Supabase SQL Editor.
-- ============================================================================

-- B1) PRECHECK (READ ONLY)
-- Expected: one active row with jobid 5 and a cleanup-receipts HTTP command.
select
  jobid,
  jobname,
  schedule,
  active,
  command like '%/functions/v1/cleanup-receipts%' as targets_cleanup_receipts,
  command like '%Authorization%' as contains_authorization_header
from cron.job
where jobname = 'cleanup-receipts-daily';

-- B2) PAUSE AND REDACT
-- Fail closed if the inspected production state changed.
do $$
declare
  v_jobid bigint;
  v_active boolean;
  v_command text;
begin
  select jobid, active, command
  into v_jobid, v_active, v_command
  from cron.job
  where jobname = 'cleanup-receipts-daily';

  if not found then
    raise exception 'Safety stop: cleanup-receipts-daily job was not found';
  end if;

  if v_jobid <> 5 then
    raise exception 'Safety stop: expected jobid 5, found %', v_jobid;
  end if;

  if v_command not like '%/functions/v1/cleanup-receipts%' then
    raise exception 'Safety stop: job command no longer targets cleanup-receipts';
  end if;

  perform cron.alter_job(
    v_jobid,
    command := 'SELECT 1',
    active := false
  );
end
$$;

-- B3) VERIFY
-- Expected: active=false, command=SELECT 1, contains_authorization_header=false.
select
  jobid,
  jobname,
  active,
  command,
  command like '%Authorization%' as contains_authorization_header
from cron.job
where jobname = 'cleanup-receipts-daily';

-- No automatic rollback is included because the legacy command contains a
-- compromised secret and uses an unsafe age-only deletion policy.
