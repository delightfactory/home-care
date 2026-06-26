-- ============================================================================
-- Phase 8: Retention cleanup and receipts scheduler verification
-- Run section-by-section in Supabase SQL Editor.
-- Sections 1, 2, 4 are read-only.
-- Section 3 runs one bounded cleanup batch for notifications/performance_logs.
-- Section 5 configures receipts cleanup only after you paste the token.
-- ============================================================================

-- 1) Verify installed maintenance functions and grants.
select
  n.nspname as schema_name,
  p.proname,
  pg_get_function_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'internal_maintenance'
  and p.proname in (
    'run_retention_cleanup',
    'run_receipts_cleanup_http',
    'configure_receipts_cleanup_cron'
  )
order by p.proname;

-- 2) Preview what is eligible for cleanup right now. No rows are deleted here.
select
  count(*) as notifications_total,
  count(*) filter (
    where expires_at is not null
      and expires_at < now() - interval '7 days'
  ) as expired_over_7_days,
  count(*) filter (
    where is_read = true
      and priority in ('low', 'medium')
      and created_at < now() - interval '30 days'
  ) as read_low_medium_over_30_days,
  count(*) filter (
    where is_read = true
      and priority = 'high'
      and created_at < now() - interval '90 days'
  ) as read_high_over_90_days,
  count(*) filter (
    where is_read = false
      and priority in ('low', 'medium')
      and created_at < now() - interval '90 days'
  ) as unread_low_medium_over_90_days,
  pg_size_pretty(pg_total_relation_size('public.notifications')) as notifications_size
from public.notifications;

select
  count(*) as performance_logs_total,
  count(*) filter (
    where created_at < now() - interval '14 days'
  ) as older_than_14_days,
  min(created_at) as oldest_row,
  max(created_at) as newest_row,
  pg_size_pretty(pg_total_relation_size('public.performance_logs')) as performance_logs_size
from public.performance_logs;

-- 3) Run one bounded cleanup batch manually.
-- Safe limits:
--   notifications: up to 2,000 rows per retention rule
--   performance_logs: up to 5,000 old diagnostic rows
select internal_maintenance.run_retention_cleanup(2000, 5000) as result;

-- 4) Verify jobs and post-cleanup footprint.
select
  jobid,
  jobname,
  schedule,
  active,
  command,
  command like '%Authorization%' as command_exposes_authorization_header
from cron.job
where jobname in (
  'weekly-backup-v2',
  'maintenance-retention-daily',
  'cleanup-receipts-daily',
  'cleanup-receipts-daily-v2'
)
order by jobid;

select
  'notifications' as table_name,
  count(*) as rows_count,
  pg_size_pretty(pg_total_relation_size('public.notifications')) as total_size
from public.notifications
union all
select
  'performance_logs' as table_name,
  count(*) as rows_count,
  pg_size_pretty(pg_total_relation_size('public.performance_logs')) as total_size
from public.performance_logs;

-- 5) Configure receipts cleanup v2.
-- IMPORTANT:
-- Do not run this section until you paste a valid token.
-- The cron command will NOT expose the token; it will show only:
--   SELECT internal_maintenance.run_receipts_cleanup_http()
--
-- Replace <TOKEN_HERE> before running.
/*
select internal_maintenance.configure_receipts_cleanup_cron(
  'https://gojvsvkleenaipzirhsm.supabase.co/functions/v1/cleanup-receipts',
  '<TOKEN_HERE>',
  '0 4 * * *'
) as result;
*/

-- 6) After section 5, verify the receipts cleanup HTTP request outcome.
-- pg_net is async, so wait a few seconds after running the job/test.
select
  request_id,
  status_code,
  timed_out,
  error_msg,
  created
from net._http_response
order by created desc
limit 20;
