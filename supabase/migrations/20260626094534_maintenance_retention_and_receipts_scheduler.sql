-- ============================================================================
-- Production maintenance retention and receipts scheduler
-- Safe for a live Supabase free-plan project:
-- - Deletes only retention/diagnostic data, never operational business rows.
-- - Uses small batches and short lock/statement timeouts.
-- - Keeps the receipts cleanup credential out of cron.job.command.
-- ============================================================================

create schema if not exists internal_maintenance;

create table if not exists internal_maintenance.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

revoke all on table internal_maintenance.settings from public, anon, authenticated;

create or replace function internal_maintenance.run_retention_cleanup(
  p_notification_batch integer default 2000,
  p_performance_batch integer default 5000
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_maintenance
as $$
declare
  v_notifications_deleted integer := 0;
  v_performance_deleted integer := 0;
  v_step_count integer := 0;
  v_has_notifications boolean;
  v_has_performance_logs boolean;
begin
  perform set_config('lock_timeout', '2s', true);
  perform set_config('statement_timeout', '45s', true);

  select to_regclass('public.notifications') is not null
    into v_has_notifications;

  select to_regclass('public.performance_logs') is not null
    into v_has_performance_logs;

  if v_has_notifications then
    with doomed as (
      select id
      from public.notifications
      where expires_at is not null
        and expires_at < now() - interval '7 days'
      order by created_at asc
      limit greatest(1, p_notification_batch)
      for update skip locked
    )
    delete from public.notifications n
    using doomed d
    where n.id = d.id;

    get diagnostics v_step_count = row_count;
    v_notifications_deleted := v_notifications_deleted + v_step_count;

    with doomed as (
      select id
      from public.notifications
      where is_read = true
        and priority in ('low', 'medium')
        and created_at < now() - interval '30 days'
      order by created_at asc
      limit greatest(1, p_notification_batch)
      for update skip locked
    )
    delete from public.notifications n
    using doomed d
    where n.id = d.id;

    get diagnostics v_step_count = row_count;
    v_notifications_deleted := v_notifications_deleted + v_step_count;

    with doomed as (
      select id
      from public.notifications
      where is_read = true
        and priority = 'high'
        and created_at < now() - interval '90 days'
      order by created_at asc
      limit greatest(1, p_notification_batch)
      for update skip locked
    )
    delete from public.notifications n
    using doomed d
    where n.id = d.id;

    get diagnostics v_step_count = row_count;
    v_notifications_deleted := v_notifications_deleted + v_step_count;

    with doomed as (
      select id
      from public.notifications
      where is_read = false
        and priority in ('low', 'medium')
        and created_at < now() - interval '90 days'
      order by created_at asc
      limit greatest(1, p_notification_batch)
      for update skip locked
    )
    delete from public.notifications n
    using doomed d
    where n.id = d.id;

    get diagnostics v_step_count = row_count;
    v_notifications_deleted := v_notifications_deleted + v_step_count;
  end if;

  if v_has_performance_logs then
    with doomed as (
      select id
      from public.performance_logs
      where created_at < now() - interval '14 days'
      order by created_at asc
      limit greatest(1, p_performance_batch)
      for update skip locked
    )
    delete from public.performance_logs p
    using doomed d
    where p.id = d.id;

    get diagnostics v_performance_deleted = row_count;
  end if;

  return jsonb_build_object(
    'success', true,
    'notifications_deleted', v_notifications_deleted,
    'performance_logs_deleted', v_performance_deleted,
    'ran_at', now()
  );
end;
$$;

revoke all on function internal_maintenance.run_retention_cleanup(integer, integer) from public, anon, authenticated;
grant execute on function internal_maintenance.run_retention_cleanup(integer, integer) to service_role;

comment on function internal_maintenance.run_retention_cleanup(integer, integer) is
  'Deletes bounded batches of expired/old notifications and old performance logs. Intended for pg_cron.';

do $$
declare
  v_existing_jobid bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron is not installed';
  end if;

  select jobid into v_existing_jobid
  from cron.job
  where jobname = 'maintenance-retention-daily';

  if v_existing_jobid is not null then
    perform cron.unschedule(v_existing_jobid);
  end if;

  perform cron.schedule(
    'maintenance-retention-daily',
    '15 2 * * *',
    'SELECT internal_maintenance.run_retention_cleanup()'
  );
end $$;

create or replace function internal_maintenance.run_receipts_cleanup_http()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, internal_maintenance
as $$
declare
  v_url text;
  v_token text;
  v_request_id bigint;
begin
  perform set_config('statement_timeout', '15s', true);

  select value into v_url
  from internal_maintenance.settings
  where key = 'receipts_cleanup_url';

  select value into v_token
  from internal_maintenance.settings
  where key = 'receipts_cleanup_bearer_token';

  if nullif(v_url, '') is null then
    raise exception 'receipts_cleanup_url is not configured';
  end if;

  if nullif(v_token, '') is null then
    raise exception 'receipts_cleanup_bearer_token is not configured';
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_token,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function internal_maintenance.run_receipts_cleanup_http() from public, anon, authenticated;
grant execute on function internal_maintenance.run_receipts_cleanup_http() to service_role;

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

  update cron.job
  set active = false,
      command = 'SELECT 1'
  where jobname = 'cleanup-receipts-daily'
    and command <> 'SELECT 1';

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
    'command_exposes_authorization_header', false
  );
end;
$$;

revoke all on function internal_maintenance.configure_receipts_cleanup_cron(text, text, text) from public, anon, authenticated;
grant execute on function internal_maintenance.configure_receipts_cleanup_cron(text, text, text) to service_role;

comment on function internal_maintenance.configure_receipts_cleanup_cron(text, text, text) is
  'Configures cleanup-receipts-daily-v2 without exposing Authorization headers in cron.job.command.';
