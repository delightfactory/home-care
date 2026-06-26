-- Read-only verification after installing the Backup V2 admin API.

select
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
    'admin_list_backup_v2',
    'admin_create_backup_v2',
    'admin_get_backup_v2_manifest',
    'admin_download_backup_v2_chunk'
  )
order by p.proname;

-- Expected for all four functions:
-- security_definer = true
-- function_config includes search_path=pg_catalog, public, internal_maintenance
-- anon_can_execute = false
-- authenticated_can_execute = true
-- service_role_can_execute is not used by the browser workflow.

select
  id,
  label,
  status,
  tables_count,
  total_rows,
  pg_size_pretty(total_size_bytes) as logical_size,
  completed_at
from internal_maintenance.backup_v2_runs
where status = 'completed'
order by completed_at desc;
