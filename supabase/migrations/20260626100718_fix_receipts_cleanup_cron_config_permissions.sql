-- ============================================================================
-- Fix receipts cleanup cron configuration permissions
--
-- Previous version attempted to UPDATE cron.job directly to disable the old
-- cleanup-receipts-daily job. Supabase/pg_cron can reject direct writes to
-- cron.job from SECURITY DEFINER functions.
--
-- This version avoids direct UPDATE on cron.job. It only manages the v2 job via
-- cron.unschedule/cron.schedule and stores the HTTP token in the private
-- internal_maintenance.settings table.
-- ============================================================================

create or replace function internal_maintenance.configure_receipts_cleanup_cron(
  p_url text,
  p_bearer_token text,
  p_schedule text default '0 4 * * *'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_maintenance
as $$
declare
  v_existing_jobid bigint;
  v_new_jobid bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron is not installed';
  end if;

  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_net is not installed';
  end if;

  if nullif(p_url, '') is null or p_url not like 'https://%/functions/v1/cleanup-receipts%' then
    raise exception 'Invalid cleanup-receipts URL';
  end if;

  if nullif(p_bearer_token, '') is null or length(p_bearer_token) < 20 then
    raise exception 'Invalid bearer token';
  end if;

  insert into internal_maintenance.settings(key, value, updated_at)
  values
    ('receipts_cleanup_url', p_url, now()),
    ('receipts_cleanup_bearer_token', p_bearer_token, now())
  on conflict (key) do update
    set value = excluded.value,
        updated_at = now();

  -- Manage only the v2 job. Do not update cron.job directly.
  select jobid into v_existing_jobid
  from cron.job
  where jobname = 'cleanup-receipts-daily-v2';

  if v_existing_jobid is not null then
    perform cron.unschedule(v_existing_jobid);
  end if;

  perform cron.schedule(
    'cleanup-receipts-daily-v2',
    p_schedule,
    'SELECT internal_maintenance.run_receipts_cleanup_http()'
  );

  select jobid into v_new_jobid
  from cron.job
  where jobname = 'cleanup-receipts-daily-v2';

  return jsonb_build_object(
    'success', true,
    'jobname', 'cleanup-receipts-daily-v2',
    'jobid', v_new_jobid,
    'schedule', p_schedule,
    'command_exposes_authorization_header', false,
    'note', 'Old cleanup-receipts-daily job was not modified by this function'
  );
end;
$$;

revoke all on function internal_maintenance.configure_receipts_cleanup_cron(text, text, text) from public, anon, authenticated;
grant execute on function internal_maintenance.configure_receipts_cleanup_cron(text, text, text) to service_role;

comment on function internal_maintenance.configure_receipts_cleanup_cron(text, text, text) is
  'Configures cleanup-receipts-daily-v2 without direct cron.job updates or exposed Authorization headers.';
