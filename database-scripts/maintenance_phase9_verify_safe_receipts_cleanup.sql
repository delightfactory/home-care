-- ============================================================================
-- Phase 9: Verify safe receipts cleanup candidate selection
-- Run after applying:
--   20260626095636_harden_receipts_cleanup_candidates.sql
--
-- This file is read-only unless you intentionally run the final configure call.
-- ============================================================================

-- 1) Confirm get_files_for_cleanup is hardened and not executable by anon.
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
where n.nspname = 'public'
  and p.proname = 'get_files_for_cleanup';

-- 2) Current receipts footprint by linked/unlinked state.
with expense_refs as (
  select
    id,
    regexp_replace(
      split_part(receipt_image_url, '?', 1),
      '^.*/storage/v1/object/(public|sign)?/?receipts/',
      ''
    ) as object_name
  from public.expenses
  where nullif(receipt_image_url, '') is not null
),
invoice_refs as (
  select
    id,
    regexp_replace(
      split_part(payment_proof_url, '?', 1),
      '^.*/storage/v1/object/(public|sign)?/?receipts/',
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
  count(*) as files_count,
  round(coalesce(sum(o.size_bytes), 0)::numeric / 1024 / 1024, 2) as total_mb,
  count(*) filter (where o.created_at < now() - interval '90 days') as older_than_90_days,
  min(o.created_at) as oldest_file,
  max(o.created_at) as newest_file
from receipt_objects o
left join expense_refs e on e.object_name = o.name
left join invoice_refs i on i.object_name = o.name
group by reference_state
order by reference_state;

-- 3) Preview the exact candidates that cleanup-receipts can delete.
-- No deletion happens here.
select
  count(*) as safe_cleanup_candidates,
  round(coalesce(sum(file_size_bytes), 0)::numeric / 1024 / 1024, 2) as candidate_mb,
  min(created_at) as oldest_candidate,
  max(created_at) as newest_candidate
from public.get_files_for_cleanup('receipts', 90, 1000);

-- 4) Safety assertion: candidates must not be linked to expenses or invoices.
with candidates as (
  select file_name
  from public.get_files_for_cleanup('receipts', 90, 1000)
),
expense_refs as (
  select
    regexp_replace(
      split_part(receipt_image_url, '?', 1),
      '^.*/storage/v1/object/(public|sign)?/?receipts/',
      ''
    ) as object_name
  from public.expenses
  where nullif(receipt_image_url, '') is not null
),
invoice_refs as (
  select
    regexp_replace(
      split_part(payment_proof_url, '?', 1),
      '^.*/storage/v1/object/(public|sign)?/?receipts/',
      ''
    ) as object_name
  from public.invoices
  where nullif(payment_proof_url, '') is not null
)
select
  count(*) filter (where e.object_name is not null) as candidates_linked_to_expenses,
  count(*) filter (where i.object_name is not null) as candidates_linked_to_invoices
from candidates c
left join expense_refs e on e.object_name = c.file_name
left join invoice_refs i on i.object_name = c.file_name;

-- Expected result:
--   candidates_linked_to_expenses = 0
--   candidates_linked_to_invoices = 0

-- 5) Configure receipts cleanup v2 only after the safety assertion is zero/zero.
-- Replace <TOKEN_HERE> inside Supabase SQL Editor. Do not paste the token here.
/*
select internal_maintenance.configure_receipts_cleanup_cron(
  'https://gojvsvkleenaipzirhsm.supabase.co/functions/v1/cleanup-receipts',
  '<TOKEN_HERE>',
  '0 4 * * *'
) as result;
*/

-- 6) Verify cron command remains clean after configuration.
select
  jobid,
  jobname,
  schedule,
  active,
  command,
  command like '%Authorization%' as command_exposes_authorization_header
from cron.job
where jobname in ('cleanup-receipts-daily', 'cleanup-receipts-daily-v2')
order by jobid;
