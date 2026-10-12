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
insert into extension_request values(gen_random_uuid(),jsonb_build_object('op','extend','route_id','f7500000-0000-0000-0000-000000000001','order_id','f7600000-0000-0000-0000-000000000002',
 'expected',public.lifecycle_snapshot('extend','f7500000-0000-0000-0000-000000000001'),'order_expected',public.lifecycle_snapshot('order','f7600000-0000-0000-0000-000000000002'),'continuing_work',true));
-- The account may be disabled after preview; neither preview nor an old payload
-- may reopen the route. Restoring the account must preserve the normal flow.
reset role;
update public.users set is_active=false where id='f7100000-0000-0000-0000-000000000003';
set local role authenticated;
do $$ begin
 begin
  perform public.lifecycle_snapshot('extend','f7500000-0000-0000-0000-000000000001');
  raise exception 'QA_DISABLED_LEADER_PREVIEW';
 exception when others then if SQLERRM<>'LC_EXTENSION_LEADER' then raise; end if; end;
 begin
  perform public.lifecycle_mutate(gen_random_uuid(),(select payload from extension_request));
  raise exception 'QA_DISABLED_LEADER_EXTENSION';
 exception when others then if SQLERRM<>'LC_EXTENSION_LEADER' then raise; end if; end;
 if not exists(select 1 from public.routes where id='f7500000-0000-0000-0000-000000000001' and status='completed')
  or exists(select 1 from public.route_orders where order_id='f7600000-0000-0000-0000-000000000002')
  or not exists(select 1 from public.attendance_records where id='f7a00000-0000-0000-0000-000000000001' and check_out_time is not null)
 then raise exception 'QA_DISABLED_LEADER_PARTIAL'; end if;
end $$;
reset role;
update public.users set is_active=true where id='f7100000-0000-0000-0000-000000000003';
set local role authenticated;
do $$ declare v_payload jsonb; begin
 begin
  update public.attendance_records set check_out_time=check_out_time+interval '1 minute',check_in_time=check_in_time-interval '5 minutes',notes='QA administrative correction',status='late',late_minutes=1
   where id='f7a00000-0000-0000-0000-000000000001';
  if not exists(select 1 from public.attendance_records where id='f7a00000-0000-0000-0000-000000000001' and check_out_method='manual_admin' and auto_checkout_route_id is null and notes='QA administrative correction' and status='late') then raise exception 'QA_ADMIN_EDIT_DISCARDED'; end if;
  raise exception 'QA_ROLLBACK_ADMIN_EDIT';
 exception when others then if SQLERRM<>'QA_ROLLBACK_ADMIN_EDIT' then raise; end if; end;
 begin
  perform set_config('request.jwt.claim.sub','f7100000-0000-0000-0000-000000000002',true);
  update public.attendance_records set check_out_time=null where id='f7a00000-0000-0000-0000-000000000001';
  if not exists(select 1 from public.attendance_records where id='f7a00000-0000-0000-0000-000000000001' and check_out_time is null and check_out_method is null and auto_checkout_route_id is null) then raise exception 'QA_SUPERVISOR_CLEAR_DISCARDED'; end if;
  raise exception 'QA_ROLLBACK_SUPERVISOR_CLEAR';
 exception when others then if SQLERRM<>'QA_ROLLBACK_SUPERVISOR_CLEAR' then raise; end if; end;
 begin
  update public.attendance_records set check_out_method='manual_admin' where id='f7a00000-0000-0000-0000-000000000001';
  select payload||jsonb_build_object('expected',public.lifecycle_snapshot('extend','f7500000-0000-0000-0000-000000000001')) into v_payload from extension_request;
  perform public.lifecycle_mutate(gen_random_uuid(),v_payload);
  raise exception 'QA_MANUAL_CHECKOUT_EXTENDED';
 exception when others then if SQLERRM not like '%LC_EXTENSION_ATTENDANCE%' then raise; end if; end;
 begin
  update public.routes set date=current_date-1 where id='f7500000-0000-0000-0000-000000000001';
  select payload||jsonb_build_object('expected',public.lifecycle_snapshot('extend','f7500000-0000-0000-0000-000000000001')) into v_payload from extension_request;
  perform public.lifecycle_mutate(gen_random_uuid(),v_payload);
  raise exception 'QA_HISTORIC_DAY_EXTENDED';
 exception when others then if SQLERRM not like '%LC_EXTENSION_DAY%' then raise; end if; end;
 begin
  update public.attendance_records set auto_checkout_route_id=null where id='f7a00000-0000-0000-0000-000000000001';
  raise exception 'QA_SOURCE_CLEARED';
 exception when others then if SQLERRM not like '%LC_AUTO_CHECKOUT_SOURCE%' then raise; end if; end;
 begin
  insert into public.attendance_records(worker_id,date,check_in_time,status,auto_checkout_route_id)
   values('f7300000-0000-0000-0000-000000000001',current_date+1,clock_timestamp(),'present','f7500000-0000-0000-0000-000000000001');
  raise exception 'QA_SOURCE_FORGED';
 exception when others then if SQLERRM not like '%LC_AUTO_CHECKOUT_SOURCE%' then raise; end if; end;
 begin
  perform set_config('request.jwt.claim.sub','f7100000-0000-0000-0000-000000000003',true);
  perform public.lifecycle_mutate(gen_random_uuid(),(select payload from extension_request));
  raise exception 'QA_LEADER_EXTENDED_ROUTE';
 exception when others then if SQLERRM not like '%LC_DENIED%' then raise; end if; end;
 begin
  perform public.lifecycle_mutate(gen_random_uuid(),(select payload||jsonb_build_object('continuing_work',false) from extension_request));
  raise exception 'QA_CONFIRMATION_IGNORED';
 exception when others then if SQLERRM not like '%LC_EXTENSION_CONFIRM%' then raise; end if; end;
end $$;
reset role;
do $$ begin
 begin
  update audit_private.config set enabled=false where singleton;
  perform public.lifecycle_mutate(gen_random_uuid(),(select payload from extension_request));
  raise exception 'QA_UNAUDITED_EXTENSION_ACCEPTED';
 exception when others then if SQLERRM not like '%LC_EXTENSION_AUDIT%' then raise; end if; end;
end $$;
set local role authenticated;
insert into extension_frozen select jsonb_build_object('order',(select to_jsonb(o) from public.orders o where id='f7600000-0000-0000-0000-000000000001'),
 'participants',(select jsonb_agg(to_jsonb(w) order by id) from public.order_workers w where order_id='f7600000-0000-0000-0000-000000000001'),
 'invoices',(select jsonb_agg(to_jsonb(i) order by id) from public.invoices i where order_id='f7600000-0000-0000-0000-000000000001'));
select public.lifecycle_mutate(request,payload) from extension_request;
select public.lifecycle_mutate(request,payload) from extension_request;
do $$ declare v_frozen jsonb; v_manual timestamptz; begin
 if not exists(select 1 from public.routes where id='f7500000-0000-0000-0000-000000000001' and status='in_progress' and actual_end_time is null) then raise exception 'QA_ROUTE_NOT_REOPENED'; end if;
 if not exists(select 1 from public.attendance_records where id='f7a00000-0000-0000-0000-000000000001' and check_out_time is null and auto_checkout_route_id is null) then raise exception 'QA_ATTENDANCE_NOT_RESTORED'; end if;
 if (select count(*) from public.route_orders where order_id='f7600000-0000-0000-0000-000000000002')<>1 then raise exception 'QA_DUPLICATE_ADD'; end if;
 select jsonb_build_object('order',(select to_jsonb(o) from public.orders o where id='f7600000-0000-0000-0000-000000000001'),
 'participants',(select jsonb_agg(to_jsonb(w) order by id) from public.order_workers w where order_id='f7600000-0000-0000-0000-000000000001'),
 'invoices',(select jsonb_agg(to_jsonb(i) order by id) from public.invoices i where order_id='f7600000-0000-0000-0000-000000000001')) into v_frozen;
 if v_frozen is distinct from (select value from extension_frozen) then raise exception 'QA_HISTORY_CHANGED'; end if;
 begin
  update public.attendance_records set check_out_time=clock_timestamp(),check_out_method='auto_route_complete' where id='f7a00000-0000-0000-0000-000000000001';
  raise exception 'QA_LATE_AUTO_ACCEPTED';
 exception when others then if SQLERRM not like '%LC_AUTO_CHECKOUT_ACTIVE%' then raise; end if; end;
 begin
  v_manual:=clock_timestamp();
  update public.attendance_records set check_out_time=v_manual,check_out_method='manual_gps',check_out_location='{"lat":30,"lng":31}'::jsonb where id='f7a00000-0000-0000-0000-000000000001';
  perform set_config('request.jwt.claim.sub','f7100000-0000-0000-0000-000000000003',true);
  update public.attendance_records set check_out_time=clock_timestamp()+interval '1 minute',check_out_method='auto_route_complete',check_out_location=null where id='f7a00000-0000-0000-0000-000000000001';
  if not exists(select 1 from public.attendance_records where id='f7a00000-0000-0000-0000-000000000001' and check_out_time=v_manual and check_out_method='manual_gps' and check_out_location='{"lat":30,"lng":31}'::jsonb) then raise exception 'QA_LEGACY_RETRY_ERASED_MANUAL'; end if;
  raise exception 'QA_ROLLBACK_MANUAL_RETRY';
 exception when others then if SQLERRM<>'QA_ROLLBACK_MANUAL_RETRY' then raise; end if; end;
end $$;
select public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','start','order_id','f7600000-0000-0000-0000-000000000002',
 'expected',public.lifecycle_snapshot('order','f7600000-0000-0000-0000-000000000002')));
update public.orders set status='completed' where id='f7600000-0000-0000-0000-000000000002';
select public.lifecycle_mutate(request,payload) from extension_request;
do $$ begin
 if not exists(select 1 from public.routes where id='f7500000-0000-0000-0000-000000000001' and status='completed' and actual_end_time is not null) then raise exception 'QA_STALE_RETRY_REOPENED'; end if;
 if not exists(select 1 from public.attendance_records where id='f7a00000-0000-0000-0000-000000000001' and check_out_method='auto_route_complete' and auto_checkout_route_id='f7500000-0000-0000-0000-000000000001' and check_out_time is not null) then raise exception 'QA_RECLOSE_MISSING'; end if;
end $$;
reset role;
-- Ordinary server-trigger logout keeps working for historic/multiple routes.
insert into public.workers(id,name,phone,hire_date) values('f7300000-0000-0000-0000-000000000002','Extension compatibility worker','synthetic-2',current_date);
insert into public.teams(id,name,leader_id) values('f7400000-0000-0000-0000-000000000002','Extension compatibility team','f7300000-0000-0000-0000-000000000002');
insert into public.team_members(team_id,worker_id,joined_at) values('f7400000-0000-0000-0000-000000000002','f7300000-0000-0000-0000-000000000002',clock_timestamp()-interval '2 days');
insert into public.attendance_records(id,worker_id,date,check_in_time,status) values('f7a00000-0000-0000-0000-000000000002','f7300000-0000-0000-0000-000000000002',current_date,clock_timestamp()-interval '1 hour','present');
insert into public.routes(id,name,date,team_id,status,actual_start_time) values
 ('f7500000-0000-0000-0000-000000000002','Compatibility historic',current_date-1,'f7400000-0000-0000-0000-000000000002','in_progress',clock_timestamp()-interval '1 day'),
 ('f7500000-0000-0000-0000-000000000003','Compatibility active',current_date,'f7400000-0000-0000-0000-000000000002','in_progress',clock_timestamp()-interval '1 hour');
set local role authenticated;
update public.routes set status='completed',actual_end_time=clock_timestamp() where id='f7500000-0000-0000-0000-000000000002';
do $$ begin
 if not exists(select 1 from public.attendance_records where id='f7a00000-0000-0000-0000-000000000002' and check_out_time is not null and auto_checkout_route_id is null) then raise exception 'QA_HISTORIC_CLOSE_REGRESSION'; end if;
end $$;
-- Reset only this synthetic, unprovenanced attendance for the second scenario.
update public.attendance_records set check_out_time=null,check_out_method=null where id='f7a00000-0000-0000-0000-000000000002';
reset role;
insert into public.routes(id,name,date,team_id,status,actual_end_time) values
 ('f7500000-0000-0000-0000-000000000004','Compatibility previous completed',current_date,'f7400000-0000-0000-0000-000000000002','completed',clock_timestamp()-interval '30 minutes');
set local role authenticated;
update public.routes set status='completed',actual_end_time=clock_timestamp() where id='f7500000-0000-0000-0000-000000000003';
do $$ begin
 if not exists(select 1 from public.attendance_records where id='f7a00000-0000-0000-0000-000000000002' and check_out_time is not null and auto_checkout_route_id='f7500000-0000-0000-0000-000000000003') then raise exception 'QA_MULTIPLE_CLOSE_REGRESSION'; end if;
end $$;
reset role;
rollback;
