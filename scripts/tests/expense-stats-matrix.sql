\set ON_ERROR_STOP on
begin;
set local statement_timeout='120s';
-- Qualify a dataset larger than both ordinary API caps and the old 10k request.
do $large$
declare actual jsonb; expected numeric;
begin
 select sum(amount) into expected from expenses;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',md5('manager-user')::uuid,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select get_filtered_expense_stats('{}') into actual;
 execute 'reset role';
 perform qa_assert((actual->>'totalCount')::int=12050,'no 1000/10000 row truncation');
 perform qa_assert((actual->>'totalAmount')::numeric=expected,'exact monetary total for 12050 rows');
 raise notice 'PASS 12050-row exact count and financial total';
end $large$;
-- A representative deterministic slice keeps the exhaustive role matrix bounded.
delete from expenses where id not in (select id from expenses order by id limit 600);
delete from qa_events;
do $test$
declare who record; c record; expected jsonb; actual jsonb; n integer:=0;
begin
 for who in select u.id,r.name from users u join roles r on r.id=u.role_id loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',who.id,'role','authenticated')::text,true);
  for c in select * from (values
   ('{}'::jsonb,'true'),
   ('{"status":[]}'::jsonb,'true'),
   ('{"status":["pending","approved"]}'::jsonb,$q$status in ('pending','approved')$q$),
   (jsonb_build_object('category_id',md5('category-1')::uuid),$q$category_id=md5('category-1')::uuid$q$),
   (jsonb_build_object('team_id',md5('team-1')::uuid),$q$team_id=md5('team-1')::uuid$q$),
   ('{"date_from":"2026-10-05","date_to":"2026-10-06"}'::jsonb,$q$created_at>='2026-10-05T00:00:00Z'::timestamptz and created_at<='2026-10-06T23:59:59.999Z'::timestamptz$q$),
   ('{"date_from":"2026-10-05T12:00:00+02:00","date_to":"2026-10-06T11:00:00Z"}'::jsonb,$q$created_at>='2026-10-05T10:00:00Z'::timestamptz and created_at<='2026-10-06T11:00:00Z'::timestamptz$q$),
   ('{"amount_min":3.21,"amount_max":20.10}'::jsonb,'amount>=3.21 and amount<=20.10'),
   ('{"amount_min":0,"amount_max":0}'::jsonb,'true'),
   ('{"search":"fuel"}'::jsonb,$q$description ilike '%fuel%'$q$),
   ('{"search":"f%receipt"}'::jsonb,$q$description ilike '%f%receipt%'$q$),
   ('{"search":"fu*l"}'::jsonb,$q$description ilike '%fu%l%'$q$),
   ('{"search":"absent-result"}'::jsonb,'false'),
   ('{"status":["approved"],"date_from":"2026-10-05","amount_min":3.21,"search":"fuel"}'::jsonb,$q$status='approved' and created_at>='2026-10-05T00:00:00Z'::timestamptz and amount>=3.21 and description ilike '%fuel%'$q$)
  ) x(filters,predicate) loop
   execute 'set local role authenticated';
   execute format($q$select jsonb_build_object('totalAmount',coalesce(sum(amount),0),'totalCount',count(*),'pendingCount',count(*) filter(where status='pending'),'approvedCount',count(*) filter(where status='approved'),'rejectedCount',count(*) filter(where status='rejected')) from public.expenses where %s$q$,c.predicate) into expected;
   select get_filtered_expense_stats(c.filters) into actual;
   execute 'reset role';
   perform qa_assert(actual=expected,who.name||' filter '||c.filters);
   n:=n+1;
  end loop;
 end loop;
 perform qa_assert(n=84,'all six roles and fourteen filter cases');
 raise notice 'PASS 84 role/filter exact aggregate parity cases';
end $test$;
do $test$
declare blocked boolean:=false;
begin
 execute 'set local role anon';
 begin perform get_filtered_expense_stats('{}'); exception when insufficient_privilege then blocked:=true; end;
 execute 'reset role';
 perform qa_assert(blocked,'anonymous RPC execute denied');
 perform qa_assert((select prosecdef=false and provolatile='v' from pg_proc where oid='public.get_filtered_expense_stats(jsonb)'::regprocedure),'invoker volatility contract');
 perform qa_assert((select count(*)=4 from pg_policies where tablename='expenses'),'four original policies retained');
 raise notice 'PASS anon denial, invoker volatility, policy inventory';
end $test$;
do $test$
declare who record; inserted boolean; changed integer; removed integer; wanted uuid; allowed boolean;
begin
 for who in select u.id,r.name from users u join roles r on r.id=u.role_id loop
  wanted:=md5('crud-'||who.name)::uuid;
  allowed:=who.name not in ('receptionist','pending');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',who.id,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  inserted:=false;
  begin
   insert into expenses(id,amount,status,created_at,description) values(wanted,12.34,'pending',now(),'qa');
   inserted:=true;
  exception when insufficient_privilege then null; end;
  update expenses set amount=23.45,status='approved' where id=wanted;
  get diagnostics changed=row_count;
  delete from expenses where id=wanted;
  get diagnostics removed=row_count;
  execute 'reset role';
  perform qa_assert(inserted=allowed,who.name||' create');
  perform qa_assert(changed=(case when allowed then 1 else 0 end),who.name||' edit/status approval');
  perform qa_assert(removed=(case when who.name='manager' then 1 else 0 end),who.name||' delete');
  if allowed then
   perform qa_assert((select count(*)=4+(case when who.name='manager' then 1 else 0 end) from qa_events where expense_id=wanted),who.name||' audit+notification observers');
  end if;
  delete from expenses where id=wanted;
 end loop;
 raise notice 'PASS six-role create/edit/status/delete with audit/notification observers';
end $test$;
rollback;
