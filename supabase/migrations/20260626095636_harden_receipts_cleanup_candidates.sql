-- ============================================================================
-- Harden receipts cleanup candidates
--
-- The existing cleanup-receipts Edge Function calls public.get_files_for_cleanup.
-- This migration keeps the same function signature so the deployed Edge Function
-- does not need to change, but makes candidate selection safe:
--
--   Only unreferenced files in storage.objects are returned.
--
-- A file is protected when it is referenced by:
--   - public.expenses.receipt_image_url
--   - public.invoices.payment_proof_url
-- ============================================================================

create or replace function public.get_files_for_cleanup(
  p_bucket_id text default 'receipts',
  p_older_than_days integer default 90,
  p_max_files integer default 100
)
returns table (
  file_id uuid,
  file_name text,
  file_path text,
  file_size_bytes bigint,
  created_at timestamptz,
  age_days integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform set_config('statement_timeout', '30s', true);
  perform set_config('lock_timeout', '2s', true);

  return query
  with expense_refs as (
    select distinct
      case
        when receipt_image_url like '%/storage/v1/object/%/receipts/%' then
          regexp_replace(
            split_part(receipt_image_url, '?', 1),
            '^.*/storage/v1/object/(public|sign)/receipts/',
            ''
          )
        when receipt_image_url like '%/storage/v1/object/receipts/%' then
          regexp_replace(
            split_part(receipt_image_url, '?', 1),
            '^.*/storage/v1/object/receipts/',
            ''
          )
        else
          regexp_replace(split_part(receipt_image_url, '?', 1), '^receipts/', '')
      end as object_name
    from public.expenses
    where nullif(receipt_image_url, '') is not null
  ),
  invoice_refs as (
    select distinct
      case
        when payment_proof_url like '%/storage/v1/object/%/receipts/%' then
          regexp_replace(
            split_part(payment_proof_url, '?', 1),
            '^.*/storage/v1/object/(public|sign)/receipts/',
            ''
          )
        when payment_proof_url like '%/storage/v1/object/receipts/%' then
          regexp_replace(
            split_part(payment_proof_url, '?', 1),
            '^.*/storage/v1/object/receipts/',
            ''
          )
        else
          regexp_replace(split_part(payment_proof_url, '?', 1), '^receipts/', '')
      end as object_name
    from public.invoices
    where nullif(payment_proof_url, '') is not null
  )
  select
    o.id as file_id,
    o.name as file_name,
    p_bucket_id || '/' || o.name as file_path,
    coalesce((o.metadata->>'size')::bigint, 0) as file_size_bytes,
    o.created_at,
    extract(day from (now() - o.created_at))::integer as age_days
  from storage.objects o
  left join expense_refs e on e.object_name = o.name
  left join invoice_refs i on i.object_name = o.name
  where o.bucket_id = p_bucket_id
    and o.created_at < now() - (greatest(1, p_older_than_days) || ' days')::interval
    and e.object_name is null
    and i.object_name is null
  order by o.created_at asc
  limit greatest(1, p_max_files);
end;
$$;

revoke all on function public.get_files_for_cleanup(text, integer, integer) from public, anon;
grant execute on function public.get_files_for_cleanup(text, integer, integer) to authenticated;
grant execute on function public.get_files_for_cleanup(text, integer, integer) to service_role;

comment on function public.get_files_for_cleanup(text, integer, integer) is
  'Safe receipts cleanup candidate selector. Returns only old storage files not referenced by expenses or invoices.';
