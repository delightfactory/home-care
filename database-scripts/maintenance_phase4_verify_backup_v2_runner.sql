-- Backup V2 scheduled-runner installation verification. READ ONLY.

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
where n.nspname = 'internal_maintenance'
  and p.proname = 'run_scheduled_backup_v2';

-- Installing the runner must not create another backup.
select
  count(*) as runs_count,
  count(*) filter (where status = 'completed') as completed_runs,
  max(completed_at) filter (where status = 'completed') as latest_completed_at
from internal_maintenance.backup_v2_runs;

-- No V2 Cron should exist yet.
select
  jobid,
  jobname,
  schedule,
  command,
  active
from cron.job
where jobname = 'weekly-backup-v2';
