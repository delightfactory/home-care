-- Run only through test-order-lifecycle.mjs against isolated synthetic QA.
-- Transaction rolls back fixtures, operations and journal after every run.
begin;
insert into auth.users(id) values
 ('a1000000-0000-0000-0000-000000000001'),
 ('a1000000-0000-0000-0000-000000000002'),
 ('a1000000-0000-0000-0000-000000000003'),
 ('a1000000-0000-0000-0000-000000000004');
insert into public.users(id,role_id,full_name,is_active)
select 'a1000000-0000-0000-0000-000000000001',id,'QA Manager',true from public.roles where name='manager';
insert into public.users(id,role_id,full_name,is_active)
select 'a1000000-0000-0000-0000-000000000002',id,'QA Supervisor',true from public.roles where name='operations_supervisor';
insert into public.users(id,role_id,full_name,is_active)
select 'a1000000-0000-0000-0000-000000000003',id,'QA Leader',true from public.roles where name='team_leader';
insert into public.users(id,role_id,full_name,is_active)
select 'a1000000-0000-0000-0000-000000000004',id,'QA Receptionist',true from public.roles where name='receptionist';
insert into public.customers(id,name,phone,address) values('a2000000-0000-0000-0000-000000000001','QA Customer','a-qa-customer','QA');
insert into public.workers(id,user_id,name,phone,hire_date) values
 ('a3000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003','QA Worker','synthetic',current_date);
insert into public.teams(id,name,leader_id) values
 ('a4000000-0000-0000-0000-000000000001','QA Team','a3000000-0000-0000-0000-000000000001'),
 ('a4000000-0000-0000-0000-000000000002','QA Other Team',null);
insert into public.team_members(team_id,worker_id,joined_at) values
 ('a4000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001',clock_timestamp()-interval '1 day');
insert into public.routes(id,name,date,team_id,status) values
 ('a5000000-0000-0000-0000-000000000001','QA Route',current_date,'a4000000-0000-0000-0000-000000000001','planned'),
 ('a5000000-0000-0000-0000-000000000002','QA Other Route',current_date,'a4000000-0000-0000-0000-000000000002','planned'),
 ('a5000000-0000-0000-0000-000000000003','QA Empty Route',current_date,null,'planned');
insert into public.orders(id,order_number,customer_id,scheduled_date,scheduled_time,status) values
 ('a6000000-0000-0000-0000-000000000001','QA-LIFECYCLE-1','a2000000-0000-0000-0000-000000000001',current_date,'10:00','pending'),
 ('a6000000-0000-0000-0000-000000000002','QA-LIFECYCLE-2','a2000000-0000-0000-0000-000000000001',current_date,'11:00','pending'),
 ('a6000000-0000-0000-0000-000000000003','QA-LIFECYCLE-3','a2000000-0000-0000-0000-000000000001',current_date,'12:00','pending');
-- Legacy conflicting history with no start log must not be auto-repaired.
insert into public.order_workers(order_id,worker_id,team_id,started_at,finished_at,customer_rating,performance_score) values
 ('a6000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001',clock_timestamp()-interval '1 hour',clock_timestamp()-interval '30 minutes',4,90);
create temp table qa_legacy_history as select to_jsonb(w) as value from public.order_workers w where order_id='a6000000-0000-0000-0000-000000000002';
grant select on qa_legacy_history to authenticated;
insert into public.vaults(id,name,name_ar,balance) values('a7000000-0000-0000-0000-000000000001','QA Frozen Vault','QA Frozen Vault',1234.56);
insert into public.vault_transactions(id,vault_id,type,amount,balance_after,performed_by) values
 ('a7000000-0000-0000-0000-000000000002','a7000000-0000-0000-0000-000000000001','collection',25,1234.56,'a1000000-0000-0000-0000-000000000001');
insert into public.custody_accounts(id,user_id,holder_type,team_id,balance,is_active) values
 ('a8000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003','team_leader','a4000000-0000-0000-0000-000000000001',789.12,true);
insert into public.custody_transactions(id,custody_id,type,amount,balance_after,performed_by) values
 ('a8000000-0000-0000-0000-000000000002','a8000000-0000-0000-0000-000000000001','collection',10,789.12,'a1000000-0000-0000-0000-000000000001');
insert into public.invoices(id,customer_id,subtotal,total_amount,paid_amount,status) values
 ('a9000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001',100,100,100,'paid');
insert into public.invoice_items(id,invoice_id,description,quantity,unit_price,total_price) values
 ('a9000000-0000-0000-0000-000000000002','a9000000-0000-0000-0000-000000000001','QA Frozen Item',1,100,100);
insert into public.attendance_records(id,worker_id,date,check_in_time,status) values
 ('aa000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001',current_date,clock_timestamp()-interval '1 hour','present');
create function pg_temp.financial_fingerprint() returns jsonb language sql security definer set search_path=pg_catalog,public as $$
 select jsonb_build_object('vault',(select to_jsonb(x) from public.vaults x where id='a7000000-0000-0000-0000-000000000001'),
 'vault_transaction',(select to_jsonb(x) from public.vault_transactions x where id='a7000000-0000-0000-0000-000000000002'),
 'custody',(select to_jsonb(x) from public.custody_accounts x where id='a8000000-0000-0000-0000-000000000001'),
 'custody_transaction',(select to_jsonb(x) from public.custody_transactions x where id='a8000000-0000-0000-0000-000000000002'),
 'invoice',(select to_jsonb(x) from public.invoices x where id='a9000000-0000-0000-0000-000000000001'),
 'invoice_item',(select to_jsonb(x) from public.invoice_items x where id='a9000000-0000-0000-0000-000000000002'),
 'attendance',(select to_jsonb(x) from public.attendance_records x where id='aa000000-0000-0000-0000-000000000001')) $$;
create temp table qa_frozen as select pg_temp.financial_fingerprint() as value;
grant select on qa_frozen to authenticated;
create temp table qa_payload(request uuid,payload jsonb);
create temp table qa_failures(order_id uuid);
create function pg_temp.fail_start_log() returns trigger language plpgsql as $$ begin
 if NEW.status='in_progress' and exists(select 1 from qa_failures where order_id=NEW.order_id) then raise exception 'QA_FORCED_LOG_FAILURE'; end if;
 return NEW; end $$;
create trigger qa_forced_failure before insert on public.order_status_logs for each row execute function pg_temp.fail_start_log();
create temp table qa_invoice_failures(order_id uuid);
create function pg_temp.fail_invoice() returns trigger language plpgsql as $$ begin
 if exists(select 1 from qa_invoice_failures where order_id=NEW.order_id) then raise exception 'QA_FORCED_INVOICE_FAILURE'; end if;
 return NEW; end $$;
create trigger qa_forced_invoice_failure before insert on public.invoices for each row execute function pg_temp.fail_invoice();
grant all on qa_payload to authenticated;
grant all on qa_failures to authenticated;
grant all on qa_invoice_failures to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000002',true);

-- Supervisor assignment permission works, direct orders.update remains denied.
insert into qa_payload values(gen_random_uuid(),jsonb_build_object('op','save','route_id','a5000000-0000-0000-0000-000000000001',
 'expected',public.lifecycle_snapshot('route','a5000000-0000-0000-0000-000000000001'),
 'desired',jsonb_build_array(jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000001','sequence_order',1,
 'expected',public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000001')))));
select public.lifecycle_mutate(request,payload) from qa_payload;
-- A removal of a missing link is represented by an unchanged desired set.
do $$ declare v_before jsonb; begin
 v_before:=public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000001');
 perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','save','route_id','a5000000-0000-0000-0000-000000000001',
  'expected',public.lifecycle_snapshot('route','a5000000-0000-0000-0000-000000000001'),
  'desired',jsonb_build_array(jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000001','sequence_order',1))));
 if v_before is distinct from public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000001') then raise exception 'TEST missing removal changed context'; end if;
end $$;
do $$ begin
 if not exists(select 1 from public.orders where id='a6000000-0000-0000-0000-000000000001' and status='scheduled' and team_id='a4000000-0000-0000-0000-000000000001') then raise exception 'TEST assignment consistency'; end if;
 begin
  perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','start','order_id','a6000000-0000-0000-0000-000000000001',
   'expected',public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000001')));
  raise exception 'TEST supervisor start unexpectedly allowed';
 exception when insufficient_privilege then if SQLERRM<>'LC_DENIED' then raise; end if; end;
end $$;

select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
truncate qa_payload;
-- Remove last link, re-add, then replay old removal; new link must survive.
insert into qa_payload values(gen_random_uuid(),jsonb_build_object('op','save','route_id','a5000000-0000-0000-0000-000000000001',
 'expected',public.lifecycle_snapshot('route','a5000000-0000-0000-0000-000000000001'),'desired','[]'::jsonb));
select public.lifecycle_mutate(request,payload) from qa_payload;
do $$ begin
 if not exists(select 1 from public.orders where id='a6000000-0000-0000-0000-000000000001' and status='pending' and team_id is null) then raise exception 'TEST remove consistency'; end if;
 perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','save','route_id','a5000000-0000-0000-0000-000000000001',
  'expected',public.lifecycle_snapshot('route','a5000000-0000-0000-0000-000000000001'),
  'desired',jsonb_build_array(jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000001','sequence_order',1,
  'expected',public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000001')))));
end $$;
select public.lifecycle_mutate(request,payload) from qa_payload;
do $$ begin
 if (select count(*) from public.route_orders where order_id='a6000000-0000-0000-0000-000000000001')<>1 then raise exception 'TEST stale retry removed new link'; end if;
 begin
  delete from public.route_orders where order_id='a6000000-0000-0000-0000-000000000001';
  raise exception 'TEST legacy delete unexpectedly allowed';
 exception when others then if SQLERRM<>'LC_REFRESH' then raise; end if; end;
 begin
  delete from public.routes where id='a5000000-0000-0000-0000-000000000001';
  raise exception 'TEST cascade unexpectedly allowed';
 exception when others then if SQLERRM<>'LC_ROUTE_DELETE' then raise; end if; end;
end $$;

-- Real technician identity and one atomic start/participant timestamp.
do $$ begin
 if (select value from qa_frozen) is distinct from pg_temp.financial_fingerprint() then raise exception 'TEST scheduling changed nonzero finance/attendance history'; end if;
 begin
  perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','save','route_id','a5000000-0000-0000-0000-000000000002',
   'expected',public.lifecycle_snapshot('route','a5000000-0000-0000-0000-000000000002'),
   'desired',jsonb_build_array(jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000002','sequence_order',1,
    'expected',public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000002')))));
  raise exception 'TEST legacy participants without log scheduled';
 exception when others then if SQLERRM<>'LC_HISTORY' then raise; end if; end;
 if (select value from qa_legacy_history) is distinct from(select to_jsonb(w) from public.order_workers w where order_id='a6000000-0000-0000-0000-000000000002') then raise exception 'TEST legacy nonzero ratings/history changed'; end if;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000003',true);
truncate qa_payload;
insert into qa_payload values(gen_random_uuid(),jsonb_build_object('op','start','technician',true,
 'order_id','a6000000-0000-0000-0000-000000000001',
 'expected',public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000001')));
select public.lifecycle_mutate(request,payload) from qa_payload;
select public.lifecycle_mutate(request,payload) from qa_payload;
update public.order_workers set customer_rating=4,performance_score=80 where order_id='a6000000-0000-0000-0000-000000000001';
do $$ declare v_workers jsonb; begin
 if (select count(*) from public.order_status_logs where order_id='a6000000-0000-0000-0000-000000000001' and status='in_progress')<>1 then raise exception 'TEST duplicate start'; end if;
 if not exists(select 1 from public.order_workers w join public.order_status_logs l on l.order_id=w.order_id
 where w.order_id='a6000000-0000-0000-0000-000000000001' and l.status='in_progress' and w.started_at=l.created_at and w.role='leader') then raise exception 'TEST participants timestamp/role'; end if;
 select jsonb_agg(to_jsonb(w) order by w.id) into v_workers from public.order_workers w where order_id='a6000000-0000-0000-0000-000000000001';
 begin
  insert into public.order_status_logs(order_id,status) values('a6000000-0000-0000-0000-000000000001','in_progress');
  raise exception 'TEST delayed legacy log allowed';
 exception when others then if SQLERRM<>'LC_REFRESH' then raise; end if; end;
 begin
  insert into public.order_workers(order_id,worker_id,team_id,started_at) values
   ('a6000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001',clock_timestamp());
  raise exception 'TEST delayed fallback allowed';
 exception when others then if SQLERRM<>'LC_REFRESH' then raise; end if; end;
 begin
  update public.order_workers set order_id='a6000000-0000-0000-0000-000000000001'
   where order_id='a6000000-0000-0000-0000-000000000002';
  raise exception 'TEST moved legacy participant into started context';
 exception when others then if SQLERRM<>'LC_HISTORY' then raise; end if; end;
 begin
  perform public.lifecycle_mutate((select request from qa_payload),(select payload || jsonb_build_object('notes','Different request') from qa_payload));
  raise exception 'TEST same request accepted changed payload';
 exception when others then if SQLERRM<>'LC_REQUEST_CONFLICT' then raise; end if; end;
 if v_workers is distinct from(select jsonb_agg(to_jsonb(w) order by w.id) from public.order_workers w where order_id='a6000000-0000-0000-0000-000000000001') then raise exception 'TEST participant history changed'; end if;
end $$;

select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
insert into public.order_status_logs(order_id,status) values('a6000000-0000-0000-0000-000000000002','pending');
do $$ begin
 begin
  update public.order_status_logs set status='in_progress',order_id='a6000000-0000-0000-0000-000000000001'
   where order_id='a6000000-0000-0000-0000-000000000002' and status='pending';
  raise exception 'TEST old log update bypassed start guard';
 exception when others then if SQLERRM<>'LC_REFRESH' then raise; end if; end;
 begin
  perform public.resync_order_workers('a6000000-0000-0000-0000-000000000001');
  raise exception 'TEST resync replaced RPC participants';
 exception when others then if SQLERRM<>'LC_REFRESH' then raise; end if; end;
end $$;
-- Unchanged executed row stays intact; reordering it rolls back entire batch.
do $$ declare v_before jsonb; v_links jsonb; begin
 select to_jsonb(o) into v_before from public.orders o where id='a6000000-0000-0000-0000-000000000001';
 perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','save','route_id','a5000000-0000-0000-0000-000000000001',
 'expected',public.lifecycle_snapshot('route','a5000000-0000-0000-0000-000000000001'),
 'desired',jsonb_build_array(jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000001','sequence_order',1))));
 if v_before is distinct from(select to_jsonb(o) from public.orders o where id='a6000000-0000-0000-0000-000000000001') then raise exception 'TEST unchanged row touched'; end if;
 v_links:=public.lifecycle_snapshot('route','a5000000-0000-0000-0000-000000000001');
 begin
  perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','save','route_id','a5000000-0000-0000-0000-000000000001','expected',v_links,
   'desired',jsonb_build_array(jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000001','sequence_order',2))));
  raise exception 'TEST protected reorder allowed';
 exception when others then if SQLERRM<>'LC_HISTORY' then raise; end if; end;
 if v_links is distinct from public.lifecycle_snapshot('route','a5000000-0000-0000-0000-000000000001') then raise exception 'TEST protected rollback'; end if;
end $$;
-- Real receptionist allowed start, including complete rollback on log failure.
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000004',true);
do $$ begin
 perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','save','route_id','a5000000-0000-0000-0000-000000000001',
  'expected',public.lifecycle_snapshot('route','a5000000-0000-0000-0000-000000000001'),
  'desired',jsonb_build_array(jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000001','sequence_order',1),
   jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000003','sequence_order',2,
    'expected',public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000003')))));
end $$;
truncate qa_payload;
insert into qa_failures values('a6000000-0000-0000-0000-000000000003');
insert into qa_payload values(gen_random_uuid(),jsonb_build_object('op','start','order_id','a6000000-0000-0000-0000-000000000003',
 'expected',public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000003')));
do $$ declare v_before jsonb; v_req uuid; v_payload jsonb; begin
 v_before:=public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000003');
 select request,payload into v_req,v_payload from qa_payload;
 begin
  perform public.lifecycle_mutate(v_req,v_payload);
  raise exception 'TEST forced log failure not propagated';
 exception when others then if SQLERRM<>'QA_FORCED_LOG_FAILURE' then raise; end if; end;
 if v_before is distinct from public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000003')
  or exists(select 1 from public.order_workers where order_id='a6000000-0000-0000-0000-000000000003')
  or exists(select 1 from public.order_status_logs where order_id='a6000000-0000-0000-0000-000000000003' and status='in_progress') then raise exception 'TEST atomic start rollback'; end if;
end $$;
delete from qa_failures;
select public.lifecycle_mutate(request,payload) from qa_payload;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);

-- Empty route deletion retry succeeds from journal after route no longer exists.
truncate qa_payload;
insert into qa_payload values(gen_random_uuid(),jsonb_build_object('op','delete_route','route_id','a5000000-0000-0000-0000-000000000003',
 'expected',public.lifecycle_snapshot('route','a5000000-0000-0000-0000-000000000003')));
select public.lifecycle_mutate(request,payload) from qa_payload;
select public.lifecycle_mutate(request,payload) from qa_payload;
-- Original invoice failure contract must remain WARNING, not rollback.
insert into qa_invoice_failures values('a6000000-0000-0000-0000-000000000003');
update public.orders set status='completed' where id='a6000000-0000-0000-0000-000000000003';
insert into public.order_status_logs(order_id,status,created_by) values
 ('a6000000-0000-0000-0000-000000000003','completed','a1000000-0000-0000-0000-000000000001');
do $$ begin
 if not exists(select 1 from public.orders where id='a6000000-0000-0000-0000-000000000003' and status='completed')
  or exists(select 1 from public.invoices where order_id='a6000000-0000-0000-0000-000000000003')
  or not exists(select 1 from public.order_workers where order_id='a6000000-0000-0000-0000-000000000003' and finished_at is not null)
  or exists(select 1 from public.order_workers where order_id='a6000000-0000-0000-0000-000000000003' and finished_at is null) then raise exception 'TEST invoice WARNING contract changed'; end if;
 if (select value from qa_frozen) is distinct from pg_temp.financial_fingerprint() then raise exception 'TEST unrelated financial/attendance history changed'; end if;
end $$;
-- Construct historical ambiguous/null cases as the fixture owner only. The
-- authenticated actor never has access to the private context or journal.
reset role;
insert into public.orders(id,order_number,customer_id,scheduled_date,scheduled_time,status) values
 ('a6000000-0000-0000-0000-000000000004','QA-LIFECYCLE-4','a2000000-0000-0000-0000-000000000001',current_date,'13:00','pending'),
 ('a6000000-0000-0000-0000-000000000005','QA-LIFECYCLE-5','a2000000-0000-0000-0000-000000000001',current_date,'14:00','completed'),
 ('a6000000-0000-0000-0000-000000000006','QA-LIFECYCLE-6','a2000000-0000-0000-0000-000000000001',current_date,'15:00',null),
 ('a6000000-0000-0000-0000-000000000007','QA-LIFECYCLE-7','a2000000-0000-0000-0000-000000000001',current_date,'16:00','scheduled'),
 ('a6000000-0000-0000-0000-000000000008','QA-LIFECYCLE-8','a2000000-0000-0000-0000-000000000001',current_date,'17:00','scheduled'),
 ('a6000000-0000-0000-0000-000000000009','QA-LIFECYCLE-9','a2000000-0000-0000-0000-000000000001',current_date,'18:00','cancelled');
insert into public.routes(id,name,date,status,team_id,actual_end_time) values
 ('a5000000-0000-0000-0000-000000000004','QA Unknown Route',current_date,null,'a4000000-0000-0000-0000-000000000001',null),
 ('a5000000-0000-0000-0000-000000000005','QA Ended Route',current_date,'planned','a4000000-0000-0000-0000-000000000001',clock_timestamp()),
 ('a5000000-0000-0000-0000-000000000006','QA Empty Unknown Route',current_date,null,null,null);
insert into lifecycle_private.context(backend,transaction,operation) values(pg_backend_pid(),txid_current(),'save');
insert into public.route_orders(route_id,order_id,sequence_order) values
 ('a5000000-0000-0000-0000-000000000001','a6000000-0000-0000-0000-000000000004',10),
 ('a5000000-0000-0000-0000-000000000002','a6000000-0000-0000-0000-000000000004',10),
 ('a5000000-0000-0000-0000-000000000001','a6000000-0000-0000-0000-000000000005',11),
 ('a5000000-0000-0000-0000-000000000002','a6000000-0000-0000-0000-000000000005',11),
 ('a5000000-0000-0000-0000-000000000004','a6000000-0000-0000-0000-000000000007',1),
 ('a5000000-0000-0000-0000-000000000005','a6000000-0000-0000-0000-000000000008',1);
delete from lifecycle_private.context where backend=pg_backend_pid() and transaction=txid_current();
set local role authenticated;
do $$ declare v_before jsonb; v_history jsonb; begin
 v_before:=public.lifecycle_snapshot('route','a5000000-0000-0000-0000-000000000002');
 v_history:=public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000005');
 begin
  perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','save','route_id','a5000000-0000-0000-0000-000000000002','expected',v_before,
   'desired',jsonb_build_array(jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000005','sequence_order',11))));
  raise exception 'TEST multiple-link removal allowed';
 exception when others then if SQLERRM<>'LC_AMBIGUOUS' then raise; end if; end;
 if v_before is distinct from public.lifecycle_snapshot('route','a5000000-0000-0000-0000-000000000002') then raise exception 'TEST ambiguous removal changed history'; end if;
 perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','save','route_id','a5000000-0000-0000-0000-000000000002','expected',v_before,
  'desired',jsonb_build_array(jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000004','sequence_order',10),
   jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000005','sequence_order',11))));
 if v_history is distinct from public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000005') then raise exception 'TEST unchanged completed multi-link row touched'; end if;
 begin
  perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','save','route_id','a5000000-0000-0000-0000-000000000002',
   'expected',public.lifecycle_snapshot('route','a5000000-0000-0000-0000-000000000002'),
   'desired',jsonb_build_array(jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000004','sequence_order',10),
    jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000005','sequence_order',11),
    jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000006','sequence_order',12,
     'expected',public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000006')))));
  raise exception 'TEST unknown order status scheduled';
 exception when others then if SQLERRM<>'LC_HISTORY' then raise; end if; end;
 begin
  perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','delete_route','route_id','a5000000-0000-0000-0000-000000000006',
   'expected',public.lifecycle_snapshot('route','a5000000-0000-0000-0000-000000000006')));
  raise exception 'TEST unknown route deleted';
 exception when others then if SQLERRM<>'LC_ROUTE_DELETE' then raise; end if; end;
 begin
  perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','route_update','route_id','a5000000-0000-0000-0000-000000000004',
   'expected',public.lifecycle_snapshot('route','a5000000-0000-0000-0000-000000000004'),'data',jsonb_build_object('team_id','a4000000-0000-0000-0000-000000000002')));
  raise exception 'TEST unknown route team changed';
 exception when others then if SQLERRM<>'LC_HISTORY' then raise; end if; end;
 begin
  perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','start','order_id','a6000000-0000-0000-0000-000000000007',
   'expected',public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000007')));
  raise exception 'TEST started unknown route';
 exception when others then if SQLERRM<>'LC_HISTORY' then raise; end if; end;
 begin
  perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','start','order_id','a6000000-0000-0000-0000-000000000008',
   'expected',public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000008')));
  raise exception 'TEST started ended route';
 exception when others then if SQLERRM<>'LC_HISTORY' then raise; end if; end;
 begin
  perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','save','route_id','a5000000-0000-0000-0000-000000000002',
   'expected',public.lifecycle_snapshot('route','a5000000-0000-0000-0000-000000000002'),
   'desired',jsonb_build_array(jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000004','sequence_order',10),
    jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000005','sequence_order',11),
    jsonb_build_object('order_id','a6000000-0000-0000-0000-000000000009','sequence_order',12,
     'expected',public.lifecycle_snapshot('order','a6000000-0000-0000-0000-000000000009')))));
  raise exception 'TEST cancelled order scheduled';
 exception when others then if SQLERRM<>'LC_HISTORY' then raise; end if; end;
end $$;
select 'PASS local real role/trigger/retry/participant/finance/history acceptance checks' as result;
rollback;
