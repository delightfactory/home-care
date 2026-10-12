-- LOCAL ONLY: apply all migrations to the isolated synthetic QA database first.
-- No fixture, audit event or business write survives this transaction.
begin;
insert into auth.users(id) values ('f7100000-0000-0000-0000-000000000001'),('f7100000-0000-0000-0000-000000000002'),('f7100000-0000-0000-0000-000000000003');
insert into public.users(id,role_id,full_name,is_active)
select 'f7100000-0000-0000-0000-000000000001',id,'Extension QA Manager',true from public.roles where name='manager';
insert into public.users(id,role_id,full_name,is_active)
select 'f7100000-0000-0000-0000-000000000002',id,'Extension QA Supervisor',true from public.roles where name='operations_supervisor';
insert into public.users(id,role_id,full_name,is_active)
select 'f7100000-0000-0000-0000-000000000003',id,'Extension QA Leader',true from public.roles where name='team_leader';
insert into public.customers(id,name,phone,address) values('f7200000-0000-0000-0000-000000000001','Extension QA Customer','extension-qa','QA');
insert into public.workers(id,user_id,name,phone,hire_date) values
 ('f7300000-0000-0000-0000-000000000001','f7100000-0000-0000-0000-000000000003','Extension QA Worker','synthetic',current_date);
insert into public.teams(id,name,leader_id) values('f7400000-0000-0000-0000-000000000001','Extension QA Team','f7300000-0000-0000-0000-000000000001');
insert into public.team_members(team_id,worker_id,joined_at) values('f7400000-0000-0000-0000-000000000001','f7300000-0000-0000-0000-000000000001',clock_timestamp()-interval '1 day');
insert into public.routes(id,name,date,team_id,status) values('f7500000-0000-0000-0000-000000000001','Extension QA Route',current_date,'f7400000-0000-0000-0000-000000000001','planned');
insert into public.orders(id,order_number,customer_id,status,scheduled_date,scheduled_time,total_amount) values
 ('f7600000-0000-0000-0000-000000000001','EXT-QA-OLD','f7200000-0000-0000-0000-000000000001','pending',current_date,'10:00',100),
 ('f7600000-0000-0000-0000-000000000002','EXT-QA-NEW','f7200000-0000-0000-0000-000000000001','pending',current_date,'11:00',100);
insert into public.attendance_records(id,worker_id,date,check_in_time,status) values
 ('f7a00000-0000-0000-0000-000000000001','f7300000-0000-0000-0000-000000000001',current_date,clock_timestamp()-interval '1 hour','present');
create temp table extension_request(request uuid,payload jsonb);
create temp table extension_frozen(value jsonb);
grant all on extension_request,extension_frozen to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','f7100000-0000-0000-0000-000000000001',true);
select public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','save','route_id','f7500000-0000-0000-0000-000000000001',
 'expected',public.lifecycle_snapshot('route','f7500000-0000-0000-0000-000000000001'),
 'desired',jsonb_build_array(jsonb_build_object('order_id','f7600000-0000-0000-0000-000000000001','sequence_order',1,'expected',public.lifecycle_snapshot('order','f7600000-0000-0000-0000-000000000001')))));
select public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','start','order_id','f7600000-0000-0000-0000-000000000001',
 'expected',public.lifecycle_snapshot('order','f7600000-0000-0000-0000-000000000001')));
update public.orders set status='completed' where id='f7600000-0000-0000-0000-000000000001';
do $$ begin
 if not exists(select 1 from public.attendance_records where id='f7a00000-0000-0000-0000-000000000001' and auto_checkout_route_id='f7500000-0000-0000-0000-000000000001' and check_out_time is not null) then raise exception 'QA_CLOSURE_NOT_DOCUMENTED'; end if;
end $$;

reset role;
insert into public.orders(id,order_number,customer_id,status,scheduled_date,scheduled_time,total_amount) values('f7600000-0000-0000-0000-000000000003','EXT-QA-NEW-2','f7200000-0000-0000-0000-000000000001','pending',current_date,'12:00',200);
set local role authenticated;
reset role;
insert into workers(id,name,phone,hire_date) values('f7300000-0000-0000-0000-000000000009','Unused QA worker','synthetic',current_date);
insert into team_members(team_id,worker_id,joined_at,left_at) values('f7400000-0000-0000-0000-000000000001','f7300000-0000-0000-0000-000000000009',clock_timestamp()-interval '1 day',clock_timestamp());
set local role authenticated;
insert into extension_request values(gen_random_uuid(),jsonb_build_object('op','extend','route_id','f7500000-0000-0000-0000-000000000001','order_id','f7600000-0000-0000-0000-000000000003','expected',public.lifecycle_snapshot('extend','f7500000-0000-0000-0000-000000000001'),'additions',jsonb_build_array(jsonb_build_object('order_id','f7600000-0000-0000-0000-000000000003','expected',public.lifecycle_snapshot('order','f7600000-0000-0000-0000-000000000003')),jsonb_build_object('order_id','f7600000-0000-0000-0000-000000000002','expected',public.lifecycle_snapshot('order','f7600000-0000-0000-0000-000000000002'))),'continuing_work',true));
reset role;
create function pg_temp.multi_state() returns jsonb language sql as $$select jsonb_build_object('route',(select to_jsonb(r) from routes r where id='f7500000-0000-0000-0000-000000000001'),'orders',(select jsonb_agg(to_jsonb(o) order by id) from orders o where id in ('f7600000-0000-0000-0000-000000000001','f7600000-0000-0000-0000-000000000002','f7600000-0000-0000-0000-000000000003')),'links',(select jsonb_agg(to_jsonb(ro) order by id) from route_orders ro where route_id='f7500000-0000-0000-0000-000000000001'),'attendance',(select to_jsonb(a) from attendance_records a where id='f7a00000-0000-0000-0000-000000000001'),'requests',(select count(*) from lifecycle_private.requests where payload->>'route_id'='f7500000-0000-0000-0000-000000000001'),'audit',(select count(*) from audit_private.events))$$;
insert into extension_frozen values(pg_temp.multi_state());
do $$declare v_payload jsonb;begin
 begin
 update team_members set left_at=clock_timestamp() where team_id='f7400000-0000-0000-0000-000000000001' and worker_id='f7300000-0000-0000-0000-000000000001';
 begin
 set local role authenticated;
 select payload into v_payload from extension_request;
 v_payload:=jsonb_set(v_payload,'{expected}',public.lifecycle_snapshot('extend','f7500000-0000-0000-0000-000000000001'));
 perform public.lifecycle_mutate(gen_random_uuid(),v_payload);raise exception 'QA_UNEXPECTED_SUCCESS';exception when others then if SQLERRM<>'LC_EXTENSION_LEADER' then raise;end if;end;
 raise exception 'QA_ROLLBACK_SCENARIO';
 exception when others then if SQLERRM<>'QA_ROLLBACK_SCENARIO' then raise;end if;end;
 if pg_temp.multi_state() is distinct from(select value from extension_frozen) then raise exception 'QA_REJECT_PARTIAL';end if;
 end$$;
 select 'PASS participant left';
do $$declare v_payload jsonb;begin
 begin
 update team_members set joined_at=clock_timestamp() where team_id='f7400000-0000-0000-0000-000000000001' and worker_id='f7300000-0000-0000-0000-000000000001';
 begin
 set local role authenticated;
 select payload into v_payload from extension_request;
 v_payload:=jsonb_set(v_payload,'{expected}',public.lifecycle_snapshot('extend','f7500000-0000-0000-0000-000000000001'));
 perform public.lifecycle_mutate(gen_random_uuid(),v_payload);raise exception 'QA_UNEXPECTED_SUCCESS';exception when others then if SQLERRM<>'LC_EXTENSION_MEMBERS' then raise;end if;end;
 raise exception 'QA_ROLLBACK_SCENARIO';
 exception when others then if SQLERRM<>'QA_ROLLBACK_SCENARIO' then raise;end if;end;
 if pg_temp.multi_state() is distinct from(select value from extension_frozen) then raise exception 'QA_REJECT_PARTIAL';end if;
 end$$;
 select 'PASS participant rejoined';
do $$declare v_payload jsonb;begin
 begin
 alter table order_workers disable trigger lifecycle_01_guard;insert into order_workers(order_id,worker_id,team_id,role,started_at,finished_at) select 'f7600000-0000-0000-0000-000000000001','f7300000-0000-0000-0000-000000000009','f7400000-0000-0000-0000-000000000001','member',actual_start_time,actual_end_time from routes where id='f7500000-0000-0000-0000-000000000001';alter table order_workers enable trigger lifecycle_01_guard;
 begin
 set local role authenticated;
 select payload into v_payload from extension_request;
 v_payload:=jsonb_set(v_payload,'{expected}',public.lifecycle_snapshot('extend','f7500000-0000-0000-0000-000000000001'));
 perform public.lifecycle_mutate(gen_random_uuid(),v_payload);raise exception 'QA_UNEXPECTED_SUCCESS';exception when others then if SQLERRM<>'LC_EXTENSION_MEMBERS' then raise;end if;end;
 raise exception 'QA_ROLLBACK_SCENARIO';
 exception when others then if SQLERRM<>'QA_ROLLBACK_SCENARIO' then raise;end if;end;
 if pg_temp.multi_state() is distinct from(select value from extension_frozen) then raise exception 'QA_REJECT_PARTIAL';end if;
 end$$;
 select 'PASS nonleader participant left';
do $$declare v_payload jsonb;begin
 begin
 alter table order_workers disable trigger lifecycle_01_guard;delete from order_workers where order_id='f7600000-0000-0000-0000-000000000001';alter table order_workers enable trigger lifecycle_01_guard;
 begin
 set local role authenticated;
 select payload into v_payload from extension_request;
 v_payload:=jsonb_set(v_payload,'{expected}',public.lifecycle_snapshot('extend','f7500000-0000-0000-0000-000000000001'));
 perform public.lifecycle_mutate(gen_random_uuid(),v_payload);raise exception 'QA_UNEXPECTED_SUCCESS';exception when others then if SQLERRM<>'LC_EXTENSION_HISTORY' then raise;end if;end;
 raise exception 'QA_ROLLBACK_SCENARIO';
 exception when others then if SQLERRM<>'QA_ROLLBACK_SCENARIO' then raise;end if;end;
 if pg_temp.multi_state() is distinct from(select value from extension_frozen) then raise exception 'QA_REJECT_PARTIAL';end if;
 end$$;
 select 'PASS missing completed crew';
do $$declare v_payload jsonb;begin
 begin
 update team_members set left_at=null where team_id='f7400000-0000-0000-0000-000000000001' and worker_id='f7300000-0000-0000-0000-000000000009';
 begin
 set local role authenticated;
 select payload into v_payload from extension_request;
 v_payload:=jsonb_set(v_payload,'{expected}',public.lifecycle_snapshot('extend','f7500000-0000-0000-0000-000000000001'));
 perform public.lifecycle_mutate(gen_random_uuid(),v_payload);raise exception 'QA_UNEXPECTED_SUCCESS';exception when others then if SQLERRM<>'LC_EXTENSION_ATTENDANCE' then raise;end if;end;
 raise exception 'QA_ROLLBACK_SCENARIO';
 exception when others then if SQLERRM<>'QA_ROLLBACK_SCENARIO' then raise;end if;end;
 if pg_temp.multi_state() is distinct from(select value from extension_frozen) then raise exception 'QA_REJECT_PARTIAL';end if;
 end$$;
 select 'PASS new current unsourced member';
do $$declare v_payload jsonb;begin
 begin
 insert into lifecycle_private.context(backend,transaction,operation,closing_route_id) values(pg_backend_pid(),txid_current(),'auto_checkout','f7500000-0000-0000-0000-000000000001');insert into attendance_records(worker_id,date,check_in_time,check_out_time,check_out_method,status) select 'f7300000-0000-0000-0000-000000000009',current_date,r.actual_start_time-interval '1 hour',r.actual_end_time,'auto_route_complete','present' from routes r where id='f7500000-0000-0000-0000-000000000001';delete from lifecycle_private.context where backend=pg_backend_pid() and transaction=txid_current();
 begin
 set local role authenticated;
 select payload into v_payload from extension_request;
 v_payload:=jsonb_set(v_payload,'{expected}',public.lifecycle_snapshot('extend','f7500000-0000-0000-0000-000000000001'));
 perform public.lifecycle_mutate(gen_random_uuid(),v_payload);raise exception 'QA_UNEXPECTED_SUCCESS';exception when others then if SQLERRM<>'LC_EXTENSION_MEMBERS' then raise;end if;end;
 raise exception 'QA_ROLLBACK_SCENARIO';
 exception when others then if SQLERRM<>'QA_ROLLBACK_SCENARIO' then raise;end if;end;
 if pg_temp.multi_state() is distinct from(select value from extension_frozen) then raise exception 'QA_REJECT_PARTIAL';end if;
 end$$;
 select 'PASS removed nonparticipant with sourced checkout';
do $$declare v_payload jsonb;begin
 begin
 update attendance_records set check_out_method='manual_admin' where worker_id='f7300000-0000-0000-0000-000000000001' and date=current_date;
 begin
 set local role authenticated;
 select payload into v_payload from extension_request;
 v_payload:=jsonb_set(v_payload,'{expected}',public.lifecycle_snapshot('extend','f7500000-0000-0000-0000-000000000001'));
 perform public.lifecycle_mutate(gen_random_uuid(),v_payload);raise exception 'QA_UNEXPECTED_SUCCESS';exception when others then if SQLERRM<>'LC_EXTENSION_ATTENDANCE' then raise;end if;end;
 raise exception 'QA_ROLLBACK_SCENARIO';
 exception when others then if SQLERRM<>'QA_ROLLBACK_SCENARIO' then raise;end if;end;
 if pg_temp.multi_state() is distinct from(select value from extension_frozen) then raise exception 'QA_REJECT_PARTIAL';end if;
 end$$;
 select 'PASS manual checkout';
do $$declare v_payload jsonb;begin
 begin
 insert into routes(name,date,team_id,status) values('Other QA line',current_date,'f7400000-0000-0000-0000-000000000001','planned');
 begin
 set local role authenticated;
 select payload into v_payload from extension_request;
 v_payload:=jsonb_set(v_payload,'{expected}',public.lifecycle_snapshot('extend','f7500000-0000-0000-0000-000000000001'));
 perform public.lifecycle_mutate(gen_random_uuid(),v_payload);raise exception 'QA_UNEXPECTED_SUCCESS';exception when others then if SQLERRM<>'LC_EXTENSION_ROUTES' then raise;end if;end;
 raise exception 'QA_ROLLBACK_SCENARIO';
 exception when others then if SQLERRM<>'QA_ROLLBACK_SCENARIO' then raise;end if;end;
 if pg_temp.multi_state() is distinct from(select value from extension_frozen) then raise exception 'QA_REJECT_PARTIAL';end if;
 end$$;
 select 'PASS second same day route';
do $$declare v_payload jsonb;begin
 begin
 update team_members set left_at=clock_timestamp()-interval '1 second' where team_id='f7400000-0000-0000-0000-000000000001' and worker_id='f7300000-0000-0000-0000-000000000009';
 begin
 set local role authenticated;
 select payload into v_payload from extension_request;
 
 perform public.lifecycle_mutate(gen_random_uuid(),v_payload);raise exception 'QA_UNEXPECTED_SUCCESS';exception when others then if SQLERRM<>'LC_CONFLICT' then raise;end if;end;
 raise exception 'QA_ROLLBACK_SCENARIO';
 exception when others then if SQLERRM<>'QA_ROLLBACK_SCENARIO' then raise;end if;end;
 if pg_temp.multi_state() is distinct from(select value from extension_frozen) then raise exception 'QA_REJECT_PARTIAL';end if;
 end$$;
 select 'PASS stale membership snapshot';
do $$declare v_payload jsonb;begin
select payload into v_payload from extension_request;
begin perform public.lifecycle_mutate(gen_random_uuid(),jsonb_set(v_payload,'{additions}',jsonb_build_array(v_payload->'additions'->0,v_payload->'additions'->0)));raise exception 'QA_DUPLICATE_ALLOWED';exception when others then if SQLERRM<>'LC_INVALID' then raise;end if;end;
begin perform public.lifecycle_mutate(gen_random_uuid(),jsonb_set(v_payload,'{additions}','[]'::jsonb));raise exception 'QA_EMPTY_ALLOWED';exception when others then if SQLERRM<>'LC_INVALID' then raise;end if;end;
begin v_payload:=jsonb_set(v_payload,'{additions,1,expected,updated_at}',to_jsonb('2000-01-01T00:00:00Z'::text));begin perform public.lifecycle_mutate(gen_random_uuid(),v_payload);raise exception 'QA_STALE_ALLOWED';exception when others then if SQLERRM<>'LC_CONFLICT' then raise;end if;end;raise exception 'QA_UNDO_STALE';exception when others then if SQLERRM<>'QA_UNDO_STALE' then raise;end if;end;
select payload into v_payload from extension_request;
begin perform public.lifecycle_mutate(gen_random_uuid(),jsonb_set(v_payload,'{additions,1,order_id}',to_jsonb('f7600000-0000-0000-0000-000000000099'::text)));raise exception 'QA_MISSING_ALLOWED';exception when others then if SQLERRM<>'LC_CONFLICT' then raise;end if;end;
begin perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','edit_order','order_id','f7600000-0000-0000-0000-000000000002','expected',public.lifecycle_snapshot('edit_order','f7600000-0000-0000-0000-000000000002'),'data',jsonb_build_object('scheduled_date',current_date+1),'items','[]'::jsonb));begin perform public.lifecycle_mutate(gen_random_uuid(),v_payload);raise exception 'QA_OTHER_DAY_ALLOWED';exception when others then if SQLERRM<>'LC_EXTENSION_DAY' then raise;end if;end;raise exception 'QA_UNDO_DAY';exception when others then if SQLERRM<>'QA_UNDO_DAY' then raise;end if;end;
if pg_temp.multi_state() is distinct from (select value from extension_frozen) then raise exception 'QA_VALIDATION_PARTIAL';end if;
end $$;
create function pg_temp.fail_second_addition() returns trigger language plpgsql as $$begin if NEW.order_id='f7600000-0000-0000-0000-000000000002' then raise exception 'QA_FORCED_SECOND_ADDITION';end if;return NEW;end$$;
create trigger qa_fail_multi before insert on public.route_orders for each row execute function pg_temp.fail_second_addition();
do $$begin begin perform public.lifecycle_mutate((select request from extension_request),(select payload from extension_request));raise exception 'QA_FAIL_NOT_INJECTED';exception when others then if SQLERRM<>'QA_FORCED_SECOND_ADDITION' then raise;end if;end;if pg_temp.multi_state() is distinct from (select value from extension_frozen) then raise exception 'QA_SECOND_ADDITION_PARTIAL';end if;end$$;
drop trigger qa_fail_multi on public.route_orders;
set local role authenticated;
select public.lifecycle_mutate(request,payload) from extension_request;
do $$declare v_result jsonb;begin select public.lifecycle_mutate(request,payload) into v_result from extension_request;if v_result->>'replayed'<>'true' then raise exception 'QA_REPLAY';end if;
begin perform public.lifecycle_mutate((select request from extension_request),jsonb_set((select payload from extension_request),'{additions}',jsonb_build_array((select payload->'additions'->1 from extension_request),(select payload->'additions'->0 from extension_request))));raise exception 'QA_CHANGED_RETRY_ALLOWED';exception when others then if SQLERRM<>'LC_REQUEST_CONFLICT' then raise;end if;end;
if not exists(select 1 from route_orders where order_id='f7600000-0000-0000-0000-000000000003' and sequence_order=2) or not exists(select 1 from route_orders where order_id='f7600000-0000-0000-0000-000000000002' and sequence_order=3) or (select count(*) from route_orders where route_id='f7500000-0000-0000-0000-000000000001')<>3 then raise exception 'QA_ORDERING';end if;end$$;
reset role;
do $$begin if not exists(select 1 from audit_private.events where table_name='requests' and after_values->>'route_id'='f7500000-0000-0000-0000-000000000001' and after_values->>'operation'='extend' and after_values->>'order_count'='2') then raise exception 'QA_BATCH_RECEIPT';end if;
if (select to_jsonb(o) from orders o where id='f7600000-0000-0000-0000-000000000001') is distinct from (select value->'orders'->0 from extension_frozen) then raise exception 'QA_OLD_ORDER_CHANGED';end if;end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','f7100000-0000-0000-0000-000000000003',true);
select public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','start','order_id','f7600000-0000-0000-0000-000000000003','expected',public.lifecycle_snapshot('order','f7600000-0000-0000-0000-000000000003')));
update orders set status='completed' where id='f7600000-0000-0000-0000-000000000003';
do $$begin if not exists(select 1 from routes where id='f7500000-0000-0000-0000-000000000001' and status='in_progress') or exists(select 1 from attendance_records where id='f7a00000-0000-0000-0000-000000000001' and check_out_time is not null) then raise exception 'QA_EARLY_CLOSE';end if;end$$;
select public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','start','order_id','f7600000-0000-0000-0000-000000000002','expected',public.lifecycle_snapshot('order','f7600000-0000-0000-0000-000000000002')));
update orders set status='completed' where id='f7600000-0000-0000-0000-000000000002';
do $$begin if not exists(select 1 from routes where id='f7500000-0000-0000-0000-000000000001' and status='completed') or not exists(select 1 from attendance_records where id='f7a00000-0000-0000-0000-000000000001' and check_out_time is not null and auto_checkout_route_id='f7500000-0000-0000-0000-000000000001') then raise exception 'QA_FINAL_CLOSE';end if;end$$;
select 'PASS batch ordering, validation rollback, second insert failure rollback, replay, audit count, old history and final automatic checkout';
rollback;
