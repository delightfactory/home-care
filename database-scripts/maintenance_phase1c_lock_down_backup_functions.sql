-- ============================================================================
-- Maintenance Phase 1C: emergency privilege containment
--
-- Risk being contained:
-- SECURITY DEFINER backup/reset/restore functions are executable by PUBLIC,
-- anon, and authenticated. This permits database export or destructive reset
-- without a database-enforced admin check.
--
-- Impact:
-- - Core application operations are unchanged.
-- - The admin Backups page create/reset/restore actions are temporarily blocked.
-- - Backup metadata listing remains unchanged.
--
-- Run each block separately in Supabase SQL Editor.
-- ============================================================================

-- C1) PRECHECK (READ ONLY)
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
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

-- C2) APPLY PRIVILEGE CONTAINMENT
begin;

revoke all on function public.create_backup_and_return(text) from public;
revoke all on function public.create_backup_and_return(text) from anon;
revoke all on function public.create_backup_and_return(text) from authenticated;
grant execute on function public.create_backup_and_return(text) to service_role;

revoke all on function public.create_scheduled_backup() from public;
revoke all on function public.create_scheduled_backup() from anon;
revoke all on function public.create_scheduled_backup() from authenticated;
grant execute on function public.create_scheduled_backup() to service_role;

revoke all on function public.restore_from_backup(uuid) from public;
revoke all on function public.restore_from_backup(uuid) from anon;
revoke all on function public.restore_from_backup(uuid) from authenticated;
grant execute on function public.restore_from_backup(uuid) to service_role;

revoke all on function public.reset_operational_data() from public;
revoke all on function public.reset_operational_data() from anon;
revoke all on function public.reset_operational_data() from authenticated;
grant execute on function public.reset_operational_data() to service_role;

revoke all on function public.prune_old_backups(integer, numeric) from public;
revoke all on function public.prune_old_backups(integer, numeric) from anon;
revoke all on function public.prune_old_backups(integer, numeric) from authenticated;
grant execute on function public.prune_old_backups(integer, numeric) to service_role;

commit;

-- C3) VERIFY
-- Expected: anon=false, authenticated=false, service_role=true for every row.
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
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

-- C4) ROLLBACK (DO NOT RUN NOW)
-- This restores the previous broad permissions and should only be used in an
-- emergency while the exposure is understood and accepted.
--
-- grant execute on function public.create_backup_and_return(text) to anon, authenticated;
-- grant execute on function public.create_scheduled_backup() to anon, authenticated;
-- grant execute on function public.restore_from_backup(uuid) to anon, authenticated;
-- grant execute on function public.reset_operational_data() to anon, authenticated;
-- grant execute on function public.prune_old_backups(integer, numeric) to anon, authenticated;
