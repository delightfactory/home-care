-- Additive filtered expense aggregate. Existing table policies and triggers stay authoritative.
begin;
set local lock_timeout='2s';
create function public.get_filtered_expense_stats(p_filters jsonb default '{}'::jsonb)
returns jsonb
language sql volatile security invoker
set search_path=pg_catalog,public,pg_temp
as $function$
 with f as (
  select coalesce(p_filters,'{}'::jsonb) as j
 ), parsed as (
  select j,
   nullif(j->>'category_id','')::uuid as category_id,
   nullif(j->>'team_id','')::uuid as team_id,
   case when nullif(j->>'date_from','') is not null then
    (case when position('T' in j->>'date_from')>0 then j->>'date_from' else (j->>'date_from')||'T00:00:00.000Z' end)::timestamptz end as date_from,
   case when nullif(j->>'date_to','') is not null then
    (case when position('T' in j->>'date_to')>0 then j->>'date_to' else (j->>'date_to')||'T23:59:59.999Z' end)::timestamptz end as date_to,
   (j->>'amount_min')::numeric as amount_min,
   (j->>'amount_max')::numeric as amount_max
  from f
 )
 select jsonb_build_object(
  'totalAmount',coalesce(sum(e.amount),0),
  'totalCount',count(*),
  'pendingCount',count(*) filter(where e.status='pending'),
  'approvedCount',count(*) filter(where e.status='approved'),
  'rejectedCount',count(*) filter(where e.status='rejected')
 )
 from public.expenses e cross join parsed p
 where (p.j->'status' is null or jsonb_array_length(p.j->'status')=0
        or e.status in (select jsonb_array_elements_text(p.j->'status')))
 and (p.category_id is null or e.category_id=p.category_id)
 and (p.team_id is null or e.team_id=p.team_id)
 and (p.date_from is null or e.created_at>=p.date_from)
 and (p.date_to is null or e.created_at<=p.date_to)
 and (p.amount_min is null or p.amount_min=0 or e.amount>=p.amount_min)
 and (p.amount_max is null or p.amount_max=0 or e.amount<=p.amount_max)
 and (coalesce(p.j->>'search','')='' or e.description ilike '%'||replace(p.j->>'search','*','%')||'%');
$function$;
revoke all on function public.get_filtered_expense_stats(jsonb) from public,anon;
grant execute on function public.get_filtered_expense_stats(jsonb) to authenticated;
commit;

