-- ============================================================================
-- Maintenance Phase 2: verify Backup V2 installation
-- READ ONLY. Do not invoke create_backup_v2 in this phase.
-- ============================================================================

-- 1) Private schema and tables exist
select
  to_regnamespace('internal_maintenance') is not null as schema_exists,
  to_regclass('internal_maintenance.backup_v2_runs') is not null as runs_table_exists,
  to_regclass('internal_maintenance.backup_v2_chunks') is not null as chunks_table_exists;

-- 2) No backup has been run merely by installing the migration
select
  (select count(*) from internal_maintenance.backup_v2_runs) as runs_count,
  (select count(*) from internal_maintenance.backup_v2_chunks) as chunks_count;

-- 3) Function exists and is locked to service_role
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
  and p.proname = 'create_backup_v2';

-- 4) The private schema is not part of exposed API schemas
select
  current_setting('pgrst.db_schemas', true) as exposed_schemas;

-- 5) Legacy jobs remain disabled
select
  jobid,
  jobname,
  active,
  command
from cron.job
where jobname in ('daily-backup', 'cleanup-receipts-daily')
order by jobid;
