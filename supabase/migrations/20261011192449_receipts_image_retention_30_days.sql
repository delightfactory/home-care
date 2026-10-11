-- Company policy: receipts images are temporary verification evidence, retained for 30 days.
-- Explicit authorization permits removing old linked images; business rows and URLs are preserved.
-- Keep existing signature, owner, EXECUTE grants, SECURITY DEFINER and search_path.
-- Other buckets and non-image financial attachments retain existing link protection.
begin;
CREATE OR REPLACE FUNCTION public.get_files_for_cleanup(p_bucket_id text DEFAULT 'receipts'::text, p_older_than_days integer DEFAULT 90, p_max_files integer DEFAULT 100)
 RETURNS TABLE(file_id uuid, file_name text, file_path text, file_size_bytes bigint, created_at timestamp with time zone, age_days integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
    and o.created_at < now() - (greatest(
      case when p_bucket_id = 'receipts' then
        case when coalesce(o.metadata->>'mimetype', '') like 'image/%' then 30 else 90 end
      else 1 end,
      p_older_than_days
    ) || ' days')::interval
    and (
      (p_bucket_id = 'receipts' and coalesce(o.metadata->>'mimetype', '') like 'image/%')
      or (e.object_name is null and i.object_name is null)
    )
  order by o.created_at asc
  limit greatest(1, p_max_files);
end;
$function$
;
commit;
