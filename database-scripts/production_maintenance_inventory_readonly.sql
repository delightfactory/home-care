-- ============================================================================
-- Home Care production maintenance inventory
-- READ ONLY: this file contains SELECT statements only.
-- It does not create, update, delete, schedule, or invoke maintenance jobs.
-- Run section-by-section in Supabase SQL Editor and export each result.
-- ============================================================================

-- 1) Database footprint and installed maintenance extensions
select
  now() as inspected_at_utc,
  current_database() as database_name,
  pg_size_pretty(pg_database_size(current_database())) as database_size;

select extname, extversion
from pg_extension
where extname in ('pg_cron', 'pg_net', 'pgcrypto')
order by extname;

-- 2) Current Cron jobs and recent execution outcomes
select
  jobid,
  jobname,
  schedule,
  command,
  active,
  database,
  username
from cron.job
order by jobid;

select
  j.jobname,
  r.runid,
  r.status,
  r.return_message,
  r.start_time,
  r.end_time,
  r.end_time - r.start_time as duration
from cron.job_run_details r
left join cron.job j on j.jobid = r.jobid
order by r.start_time desc
limit 100;

-- 3) Actual production columns. This avoids assuming timestamp column names.
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'backups',
    'performance_logs',
    'notifications',
    'expenses',
    'invoices'
  )
order by table_name, ordinal_position;

-- 4) Footprint of maintenance and operational tables
select
  relname as table_name,
  n_live_tup as estimated_live_rows,
  n_dead_tup as estimated_dead_rows,
  last_analyze,
  last_autoanalyze,
  pg_size_pretty(pg_relation_size(relid)) as table_only_size,
  pg_size_pretty(pg_indexes_size(relid)) as indexes_size,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size,
  pg_total_relation_size(relid) as total_size_bytes
from pg_stat_user_tables
where schemaname = 'public'
order by pg_total_relation_size(relid) desc;

-- 5) Backup table footprint without assuming a created_at column
select
  count(*) as backup_count,
  coalesce(sum(size_bytes), 0) as payload_size_bytes,
  pg_size_pretty(pg_total_relation_size('public.backups')) as physical_table_size
from public.backups;

-- 6) Performance-log retention preview. No rows are deleted.
select
  count(*) as total_rows,
  count(*) filter (where created_at < now() - interval '30 days') as older_than_30_days,
  count(*) filter (where created_at >= now() - interval '24 hours') as created_last_24_hours,
  min(created_at) as oldest_row,
  max(created_at) as newest_row,
  pg_size_pretty(pg_total_relation_size('public.performance_logs')) as physical_table_size
from public.performance_logs;

select
  date_trunc('day', created_at) as day,
  count(*) as rows_created
from public.performance_logs
where created_at >= now() - interval '30 days'
group by 1
order by 1 desc;

select
  query_type,
  count(*) as rows_count,
  round(avg(execution_time_ms), 2) as average_ms,
  max(execution_time_ms) as maximum_ms
from public.performance_logs
group by query_type
order by rows_count desc;

-- 7) Notification retention preview. No rows are deleted.
select
  count(*) as total_rows,
  count(*) filter (
    where expires_at is not null
      and expires_at < now() - interval '7 days'
  ) as expired_over_7_days,
  count(*) filter (
    where is_read = true
      and created_at < now() - interval '30 days'
  ) as read_over_30_days,
  count(*) filter (
    where is_read = false
      and created_at < now() - interval '90 days'
  ) as unread_over_90_days,
  count(*) filter (
    where priority = 'urgent'
  ) as urgent_total,
  min(created_at) as oldest_row,
  max(created_at) as newest_row,
  pg_size_pretty(pg_total_relation_size('public.notifications')) as physical_table_size
from public.notifications;

select
  is_read,
  priority,
  category,
  count(*) as rows_count,
  min(created_at) as oldest_row,
  max(created_at) as newest_row
from public.notifications
group by is_read, priority, category
order by is_read, priority, category;

-- 8) Storage footprint and age distribution
select
  bucket_id,
  case
    when name like 'payment-proofs/%' then 'payment_proof'
    when name like 'expense_%' then 'expense_receipt'
    else 'other'
  end as object_type,
  count(*) as files_count,
  round(coalesce(sum((metadata->>'size')::numeric), 0) / 1024 / 1024, 2) as total_mb,
  count(*) filter (where created_at < now() - interval '30 days') as older_than_30_days,
  count(*) filter (where created_at < now() - interval '90 days') as older_than_90_days,
  count(*) filter (where created_at < now() - interval '365 days') as older_than_365_days,
  min(created_at) as oldest_file,
  max(created_at) as newest_file
from storage.objects
where bucket_id in ('receipts', 'voice_messages')
group by bucket_id, object_type
order by bucket_id, total_mb desc;

-- 9) Normalize application URLs to Storage object paths.
-- This is a diagnostic comparison only.
with expense_refs as (
  select
    id,
    status,
    created_at,
    receipt_image_url,
    regexp_replace(
      split_part(receipt_image_url, '?', 1),
      '^.*/storage/v1/object/(public/)?receipts/',
      ''
    ) as object_name
  from public.expenses
  where nullif(receipt_image_url, '') is not null
),
invoice_refs as (
  select
    id,
    status,
    created_at,
    collected_at,
    payment_proof_url,
    regexp_replace(
      split_part(payment_proof_url, '?', 1),
      '^.*/storage/v1/object/(public/)?receipts/',
      ''
    ) as object_name
  from public.invoices
  where nullif(payment_proof_url, '') is not null
),
receipt_objects as (
  select
    id,
    name,
    created_at,
    coalesce((metadata->>'size')::bigint, 0) as size_bytes
  from storage.objects
  where bucket_id = 'receipts'
)
select
  case
    when e.id is not null then 'linked_expense'
    when i.id is not null then 'linked_invoice'
    else 'unreferenced'
  end as reference_state,
  case
    when o.name like 'payment-proofs/%' then 'payment_proof'
    when o.name like 'expense_%' then 'expense_receipt'
    else 'other'
  end as object_type,
  count(*) as files_count,
  round(sum(o.size_bytes)::numeric / 1024 / 1024, 2) as total_mb,
  count(*) filter (where o.created_at < now() - interval '90 days') as older_than_90_days,
  count(*) filter (where o.created_at < now() - interval '365 days') as older_than_365_days
from receipt_objects o
left join expense_refs e on e.object_name = o.name
left join invoice_refs i on i.object_name = o.name
group by reference_state, object_type
order by reference_state, total_mb desc;

-- 10) References whose Storage object is already missing.
-- These are broken links that must be understood before automated cleanup.
with receipt_objects as (
  select name
  from storage.objects
  where bucket_id = 'receipts'
),
expense_refs as (
  select
    id,
    status,
    created_at,
    receipt_image_url,
    regexp_replace(
      split_part(receipt_image_url, '?', 1),
      '^.*/storage/v1/object/(public/)?receipts/',
      ''
    ) as object_name
  from public.expenses
  where nullif(receipt_image_url, '') is not null
),
invoice_refs as (
  select
    id,
    status,
    created_at,
    payment_proof_url,
    regexp_replace(
      split_part(payment_proof_url, '?', 1),
      '^.*/storage/v1/object/(public/)?receipts/',
      ''
    ) as object_name
  from public.invoices
  where nullif(payment_proof_url, '') is not null
)
select
  'expense' as source_table,
  e.status,
  count(*) as missing_files
from expense_refs e
left join receipt_objects o on o.name = e.object_name
where o.name is null
group by e.status
union all
select
  'invoice' as source_table,
  i.status,
  count(*) as missing_files
from invoice_refs i
left join receipt_objects o on o.name = i.object_name
where o.name is null
group by i.status
order by source_table, status;

-- 11) Candidate profiles only. These queries do not authorize deletion.
-- Expense receipts: grouped by business status and age.
select
  status,
  count(*) filter (
    where nullif(receipt_image_url, '') is not null
  ) as records_with_receipt,
  count(*) filter (
    where nullif(receipt_image_url, '') is not null
      and created_at < now() - interval '90 days'
  ) as receipts_over_90_days,
  min(created_at) filter (
    where nullif(receipt_image_url, '') is not null
  ) as oldest_receipt_record
from public.expenses
group by status
order by status;

-- Payment proofs: grouped by financial status and age.
select
  status,
  count(*) filter (
    where nullif(payment_proof_url, '') is not null
  ) as records_with_proof,
  count(*) filter (
    where nullif(payment_proof_url, '') is not null
      and created_at < now() - interval '365 days'
  ) as proofs_over_365_days,
  min(created_at) filter (
    where nullif(payment_proof_url, '') is not null
  ) as oldest_proof_record
from public.invoices
group by status
order by status;
