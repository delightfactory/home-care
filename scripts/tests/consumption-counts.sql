-- Synthetic offline clone only; the runner wraps migration and fixtures in one rollback.
create function pg_temp.assert_counts() returns void language plpgsql as $$
declare expected jsonb;
begin
  select jsonb_build_object('total',count(*),'pending',count(*) filter(where status='pending'),
    'scheduled',count(*) filter(where status='scheduled'),'in_progress',count(*) filter(where status='in_progress'),
    'completed',count(*) filter(where status='completed'),'cancelled',count(*) filter(where status='cancelled'))
    into expected from public.orders;
  if public.get_order_counts() is distinct from expected then raise exception 'order counts differ'; end if;
  select jsonb_build_object('total',count(*),'planned',count(*) filter(where status='planned'),
    'in_progress',count(*) filter(where status='in_progress'),'completed',count(*) filter(where status='completed'))
    into expected from public.routes;
  if public.get_route_counts() is distinct from expected then raise exception 'route counts differ'; end if;
  select jsonb_build_object('total',count(*),'active',count(*) filter(where is_active=true),
    'inactive',count(*)-count(*) filter(where is_active=true)) into expected from public.customers;
  if public.get_customer_counts() is distinct from expected then raise exception 'customer counts differ'; end if;
  select jsonb_build_object('total',count(*),'pending',count(*) filter(where status='pending'),
    'approved',count(*) filter(where status='approved'),'rejected',count(*) filter(where status='rejected'))
    into expected from public.expenses;
  if public.get_expense_counts() is distinct from expected then raise exception 'expense counts differ'; end if;
end $$;

create temp table protected_before as
select 'orders' as name, md5(string_agg(to_jsonb(t)::text,'' order by id)) as digest from public.orders t
union all select 'workers',md5(string_agg(to_jsonb(t)::text,'' order by id)) from public.order_workers t
union all select 'attendance',md5(string_agg(to_jsonb(t)::text,'' order by id)) from public.attendance_records t
union all select 'invoices',md5(string_agg(to_jsonb(t)::text,'' order by id)) from public.invoices t
union all select 'vaults',md5(string_agg(to_jsonb(t)::text,'' order by id)) from public.vaults t;

insert into auth.users(id)
select ('c1000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,7) n;
insert into public.users(id,role_id,full_name,is_active)
select ('c1000000-0000-0000-0000-'||lpad(row_number() over(order by name)::text,12,'0'))::uuid,
  id,'Consumption QA '||name,true from public.roles;
insert into public.roles(id,name,name_ar,permissions,is_active)
values('c2000000-0000-0000-0000-000000000001','consumption_team_only','QA restricted',
  '{"orders":{"team_only":true},"routes":{},"customers":{},"expenses":{}}',true);
insert into public.users(id,role_id,full_name,is_active)
values('c1000000-0000-0000-0000-000000000007','c2000000-0000-0000-0000-000000000001','Consumption QA restricted',true);

-- Each authenticated query runs under the actual RLS role, not a bypass administrator.
select format('select set_config(''request.jwt.claim.sub'',%L,true); set local role authenticated; select pg_temp.assert_counts(); reset role;',id::text)
from public.users where id::text like 'c1000000-%' order by id
\gexec

select set_config('request.jwt.claim.sub','c1000000-0000-0000-0000-000000000007',true);
set local role authenticated;
do $$ begin
  if (public.get_order_counts()->>'total')::bigint <> 0 then raise exception 'restricted caller saw other teams'; end if;
end $$;
reset role;

do $$ declare function_name text; begin
  foreach function_name in array array['get_order_counts','get_route_counts','get_customer_counts','get_expense_counts'] loop
    if has_function_privilege('anon','public.'||function_name||'()','execute') then raise exception 'anon RPC grant'; end if;
    if (select prosecdef from pg_proc where oid=('public.'||function_name||'()')::regprocedure) then raise exception 'RPC bypasses RLS'; end if;
  end loop;
end $$;

create temp table protected_after as
select 'orders' as name, md5(string_agg(to_jsonb(t)::text,'' order by id)) as digest from public.orders t
union all select 'workers',md5(string_agg(to_jsonb(t)::text,'' order by id)) from public.order_workers t
union all select 'attendance',md5(string_agg(to_jsonb(t)::text,'' order by id)) from public.attendance_records t
union all select 'invoices',md5(string_agg(to_jsonb(t)::text,'' order by id)) from public.invoices t
union all select 'vaults',md5(string_agg(to_jsonb(t)::text,'' order by id)) from public.vaults t;
do $$ begin
  if exists(select * from protected_before except select * from protected_after) then raise exception 'protected data changed'; end if;
end $$;
select 'PASS exact count parity for seven roles, team isolation, grants, and protected fingerprints' as verdict;
