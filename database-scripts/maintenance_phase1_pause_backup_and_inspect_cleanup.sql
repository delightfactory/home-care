-- ============================================================================
-- Maintenance Phase 1
-- Part A changes ONLY the active flag of the known failing daily-backup Cron.
-- Part B is read-only inspection for the existing receipts cleanup job.
--
-- Run each marked block separately in Supabase SQL Editor.
-- ============================================================================

-- --------------------------------------------------------------------------
-- A1) PRECHECK (READ ONLY)
-- Expected: exactly one row, jobid = 3, active = true.
-- Stop if the result differs.
-- --------------------------------------------------------------------------
select
  jobid,
  jobname,
  schedule,
  command,
  active,
  database,
  username
from cron.job
where jobname = 'daily-backup';

-- --------------------------------------------------------------------------
-- A2) PAUSE THE FAILING JOB
-- This does not delete the job, function, backups, or application data.
-- Preconditions make the block fail closed if production no longer matches
-- the inspected state.
-- --------------------------------------------------------------------------
do $$
declare
  v_jobid bigint;
  v_active boolean;
  v_command text;
begin
  select jobid, active, command
  into v_jobid, v_active, v_command
  from cron.job
  where jobname = 'daily-backup';

  if not found then
    raise exception 'Safety stop: daily-backup job was not found';
  end if;

  if v_jobid <> 3 then
    raise exception 'Safety stop: expected jobid 3, found %', v_jobid;
  end if;

  if v_command <> 'SELECT create_scheduled_backup()' then
    raise exception 'Safety stop: daily-backup command changed: %', v_command;
  end if;

  if v_active is false then
    raise notice 'daily-backup is already inactive; no change made';
    return;
  end if;

  perform cron.alter_job(v_jobid, active := false);
end
$$;

-- --------------------------------------------------------------------------
-- A3) VERIFY
-- Expected: active = false.
-- --------------------------------------------------------------------------
select
  jobid,
  jobname,
  active,
  schedule,
  command
from cron.job
where jobname = 'daily-backup';

-- --------------------------------------------------------------------------
-- A4) ROLLBACK (DO NOT RUN NOW)
-- Run only if the old failing job must be reactivated before V2 is ready.
-- --------------------------------------------------------------------------
-- select cron.alter_job(3, active := true);

-- --------------------------------------------------------------------------
-- B1) INSPECT THE EXISTING RECEIPTS CLEANUP JOB (READ ONLY)
-- --------------------------------------------------------------------------
select
  jobid,
  jobname,
  schedule,
  command,
  active,
  database,
  username
from cron.job
where jobname = 'cleanup-receipts-daily';

-- --------------------------------------------------------------------------
-- B2) If B1 uses net.http_post, inspect recent pg_net outcomes (READ ONLY).
-- request_id is used because pg_net records async HTTP completion separately
-- from the Cron run that merely queued the request.
-- --------------------------------------------------------------------------
select
  id as request_id,
  status_code,
  timed_out,
  error_msg,
  created
from net._http_response
order by created desc
limit 50;
