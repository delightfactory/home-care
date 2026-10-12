-- Ignore unrelated roster changes only; retain attendance and execution history protections.
begin;
create or replace function lifecycle_private.extend_route(p_route uuid,p_order uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,lifecycle_private,audit_private as $$
declare v_route public.routes%rowtype; v_count integer; v_sequence integer; v_item jsonb; v_order uuid;
 v_additions jsonb:=coalesce(p_payload->'additions',jsonb_build_array(jsonb_build_object('order_id',p_order,'expected',p_payload->'order_expected')));
begin
 if jsonb_typeof(v_additions) is distinct from 'array' then raise exception 'LC_INVALID'; end if;
 if jsonb_array_length(v_additions)=0 or exists(select 1 from jsonb_array_elements(v_additions) item where item->>'order_id' is null or jsonb_typeof(item->'expected') is distinct from 'object')
  or jsonb_array_length(v_additions)<>(select count(distinct (item->>'order_id')::uuid) from jsonb_array_elements(v_additions) item)
  or (v_additions->0->>'order_id')::uuid is distinct from p_order then raise exception 'LC_INVALID'; end if;
 if p_payload->'continuing_work' is distinct from 'true'::jsonb then raise exception 'LC_EXTENSION_CONFIRM'; end if;
 select * into v_route from public.routes where id=p_route;
 if v_route.date is distinct from CURRENT_DATE or CURRENT_DATE is distinct from (clock_timestamp() at time zone 'Africa/Cairo')::date
  then raise exception 'LC_EXTENSION_DAY'; end if;
 if v_route.status is distinct from 'completed' or v_route.actual_start_time is null or v_route.actual_end_time is null or v_route.team_id is null
  then raise exception 'LC_EXTENSION_CLOSED'; end if;
 if (select count(*) from public.routes where team_id=v_route.team_id and date=v_route.date)<>1 then raise exception 'LC_EXTENSION_ROUTES'; end if;
 perform 1 from public.teams where id=v_route.team_id for update;
 perform 1 from public.team_members where team_id=v_route.team_id order by id for update;
 perform lifecycle_private.assert_extension_leader(v_route.team_id);
 perform 1 from public.attendance_records where date=v_route.date and worker_id in
  (select worker_id from public.team_members where team_id=v_route.team_id and left_at is null) order by id for update;
 if lifecycle_private.extension_snapshot(p_route) is distinct from p_payload->'expected' then raise exception 'LC_CONFLICT'; end if;
 if not exists(select 1 from public.route_orders where route_id=p_route)
  or exists(select 1 from public.route_orders ro join public.orders o on o.id=ro.order_id where ro.route_id=p_route and o.status not in ('completed','cancelled'))
  then raise exception 'LC_EXTENSION_CLOSED'; end if;
 -- Completed orders must have a provable crew; absent history is not proof
 -- that a worker did not participate. Never repair that history here.
 if exists(select 1 from public.route_orders ro join public.orders o on o.id=ro.order_id
  where ro.route_id=p_route and o.status='completed'
   and not exists(select 1 from public.order_workers ow where ow.order_id=o.id))
  or exists(select 1 from public.order_workers ow join public.route_orders ro on ro.order_id=ow.order_id
   where ro.route_id=p_route and ow.team_id is distinct from v_route.team_id)
  then raise exception 'LC_EXTENSION_HISTORY'; end if;
 -- Membership changes matter for actual participants and workers whose
 -- automatic departure would be reopened, not unrelated roster cleanup.
 if exists(select 1 from public.team_members tm where tm.team_id=v_route.team_id
  and ((tm.left_at is null and tm.joined_at>v_route.actual_start_time)
    or (tm.left_at is not null and tm.left_at>=v_route.actual_start_time))
  and (exists(select 1 from public.order_workers ow join public.route_orders ro on ro.order_id=ow.order_id
    where ro.route_id=p_route and ow.worker_id=tm.worker_id)
   or exists(select 1 from public.attendance_records a
    where a.date=v_route.date and a.auto_checkout_route_id=p_route and a.worker_id=tm.worker_id)))
  or exists(select 1 from public.order_workers ow join public.route_orders ro on ro.order_id=ow.order_id
   where ro.route_id=p_route and not exists(select 1 from public.team_members tm
    where tm.team_id=v_route.team_id and tm.worker_id=ow.worker_id and tm.left_at is null
     and tm.joined_at<=clock_timestamp()))
  or not exists(select 1 from public.teams t join public.team_members tm on tm.team_id=t.id and tm.worker_id=t.leader_id
   where t.id=v_route.team_id and tm.left_at is null) then raise exception 'LC_EXTENSION_MEMBERS'; end if;
 -- A historical leader replacement is not continuous work with the original crew.
 if not exists(select 1 from public.order_workers ow join public.route_orders ro on ro.order_id=ow.order_id
  join public.teams t on t.id=v_route.team_id where ro.route_id=p_route and ow.role='leader' and ow.worker_id=t.leader_id)
  or exists(select 1 from public.order_workers ow join public.route_orders ro on ro.order_id=ow.order_id
   join public.teams t on t.id=v_route.team_id where ro.route_id=p_route and ow.role='leader' and ow.worker_id is distinct from t.leader_id)
  then raise exception 'LC_EXTENSION_MEMBERS'; end if;
 select count(*) into v_count from public.team_members where team_id=v_route.team_id and left_at is null;
 if v_count=0 or v_count<>(select count(*) from public.attendance_records where date=v_route.date and auto_checkout_route_id=p_route)
  or v_count<>(select count(*) from public.attendance_records a where a.date=v_route.date
  and a.worker_id in(select worker_id from public.team_members where team_id=v_route.team_id and left_at is null)
  and a.check_in_time is not null and a.check_out_time=v_route.actual_end_time and a.check_out_method='auto_route_complete'
  and a.auto_checkout_route_id=p_route) then raise exception 'LC_EXTENSION_ATTENDANCE'; end if;
 -- Validate every requested addition before changing any route or attendance.
 for v_item in select value from jsonb_array_elements(v_additions) loop
  v_order:=(v_item->>'order_id')::uuid;
  if lifecycle_private.order_snapshot(v_order) is distinct from v_item->'expected' then raise exception 'LC_CONFLICT'; end if;
  perform lifecycle_private.assert_schedulable(v_order);
  if not exists(select 1 from public.orders where id=v_order and scheduled_date=v_route.date) then raise exception 'LC_EXTENSION_DAY'; end if;
  if exists(select 1 from public.route_orders where order_id=v_order) then raise exception 'LC_TRANSFER_REQUIRED'; end if;
 end loop;
 select coalesce(max(sequence_order),0)+1 into v_sequence from public.route_orders where route_id=p_route;
 for v_item in select value from jsonb_array_elements(v_additions) loop
  v_order:=(v_item->>'order_id')::uuid;
  insert into public.route_orders(route_id,order_id,sequence_order) values(p_route,v_order,v_sequence);
  update public.orders set team_id=v_route.team_id,status='scheduled',updated_at=clock_timestamp() where id=v_order;
  v_sequence:=v_sequence+1;
 end loop;
 update public.routes set status='in_progress',actual_end_time=null,updated_at=clock_timestamp() where id=p_route;
 update public.attendance_records set check_out_time=null,check_out_method=null,check_out_location=null,auto_checkout_route_id=null,updated_at=clock_timestamp()
  where date=v_route.date and auto_checkout_route_id=p_route;
 -- Capture is normally best effort; this new operation alone requires its full evidence.
 if not exists(select 1 from audit_private.events where transaction_id=pg_current_xact_id()::text and table_name='routes'
   and entity_id=p_route::text and before_values->>'status'='completed' and after_values->>'status'='in_progress')
  or exists(select 1 from jsonb_array_elements(v_additions) item where
   not exists(select 1 from audit_private.events where transaction_id=pg_current_xact_id()::text and table_name='orders' and entity_id=(item->>'order_id')::uuid::text)
   or not exists(select 1 from audit_private.events where transaction_id=pg_current_xact_id()::text and table_name='route_orders' and after_values->>'order_id'=(item->>'order_id')::uuid::text))
  or v_count<>(select count(distinct entity_id) from audit_private.events where transaction_id=pg_current_xact_id()::text and table_name='attendance_records'
   and before_values->>'auto_checkout_route_id'=p_route::text and after_values->'check_out_time'='null'::jsonb)
  then raise exception 'LC_EXTENSION_AUDIT'; end if;
 return jsonb_build_object('committed',true,'route_id',p_route,'order_id',p_order,'order_count',jsonb_array_length(v_additions),'snapshot',lifecycle_private.route_snapshot(p_route));
end $$;
revoke all on function lifecycle_private.extend_route(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
commit;
