-- DR1–DR4 recovery/retention follow-up. Application export is not full-DB recovery.
begin;
create table lifecycle_private.epoch (
 singleton boolean primary key default true check(singleton),
 token uuid not null default gen_random_uuid(), changed_at timestamptz not null default clock_timestamp(),
 reason text not null default 'initial lifecycle epoch'
);
alter table lifecycle_private.epoch enable row level security;
revoke all on lifecycle_private.epoch from public,anon,authenticated;
insert into lifecycle_private.epoch(singleton) values(true);
create function lifecycle_private.current_epoch() returns uuid language sql stable security definer
set search_path=pg_catalog,lifecycle_private as $$ select token from lifecycle_private.epoch where singleton $$;
revoke all on function lifecycle_private.current_epoch() from public,anon,authenticated;
alter table lifecycle_private.requests add column epoch uuid not null default lifecycle_private.current_epoch();

create function public.finalize_lifecycle_recovery(p_expected_epoch uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,lifecycle_private as $$
declare v_old uuid; v_new uuid:=gen_random_uuid(); begin
 perform pg_advisory_xact_lock(61006,1);
 select token into v_old from lifecycle_private.epoch where singleton for update;
 if p_expected_epoch is null or p_expected_epoch is distinct from v_old then raise exception 'LC_EPOCH'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'LC_INVALID'; end if;
 if exists(select 1 from lifecycle_private.context) then raise exception 'LC_RECOVERY_CONTEXT'; end if;
 update lifecycle_private.epoch set token=v_new,changed_at=clock_timestamp(),reason=p_reason where singleton;
 return jsonb_build_object('finalized',true,'previous_epoch',v_old,'epoch',v_new);
end $$;
revoke all on function public.finalize_lifecycle_recovery(uuid,text) from public,anon,authenticated;
grant execute on function public.finalize_lifecycle_recovery(uuid,text) to service_role;


create or replace function lifecycle_private.order_snapshot(p_order uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,public,lifecycle_private
as $$ select jsonb_build_object('epoch',lifecycle_private.current_epoch(),'id',o.id,'status',o.status,'team_id',o.team_id,'updated_at',o.updated_at,
 'history',lifecycle_private.history_conflict(o.id),'links',coalesce((select jsonb_agg(
 jsonb_build_object('id',ro.id,'route_id',ro.route_id,'sequence_order',ro.sequence_order,
 'team_id',r.team_id,'status',r.status,'updated_at',r.updated_at) order by ro.id)
 from public.route_orders ro join public.routes r on r.id=ro.route_id where ro.order_id=o.id),'[]'::jsonb))
 from public.orders o where o.id=p_order $$;

create or replace function lifecycle_private.route_snapshot(p_route uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,public,lifecycle_private
as $$ select jsonb_build_object('epoch',lifecycle_private.current_epoch(),'id',r.id,'team_id',r.team_id,'status',r.status,'updated_at',r.updated_at,
 'links',coalesce((select jsonb_agg(jsonb_build_object('id',ro.id,'order_id',ro.order_id,
 'sequence_order',ro.sequence_order,'order',lifecycle_private.order_snapshot(ro.order_id)) order by ro.id)
 from public.route_orders ro where ro.route_id=r.id),'[]'::jsonb)) from public.routes r where r.id=p_route $$;

create or replace function public.lifecycle_mutate(p_request uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,lifecycle_private
as $$
declare
 v_actor uuid:=auth.uid(); v_op text:=p_payload->>'op'; v_route uuid:=(p_payload->>'route_id')::uuid;
 v_order uuid:=(p_payload->>'order_id')::uuid; v_to uuid:=(p_payload->>'destination_id')::uuid;
 v_old lifecycle_private.requests%rowtype; v_result jsonb; v_item jsonb; v_id uuid; v_team uuid;
 v_ro record; v_order_row public.orders%rowtype; v_start timestamptz; v_desired jsonb;
 v_sequence integer; v_offset integer; v_data jsonb; v_count integer;
begin
 perform pg_advisory_xact_lock(61006,1);
 if p_payload->'expected'->>'epoch' is distinct from lifecycle_private.current_epoch()::text then raise exception 'LC_EPOCH'; end if;
 if v_actor is null or p_request is null or not exists(select 1 from public.users u join public.roles r on r.id=u.role_id
    where u.id=v_actor and u.is_active and r.is_active) then raise exception 'LC_DENIED' using errcode='42501'; end if;
 if v_op not in ('save','transfer','route_update','start','delete_route','edit_order','delete_order') then raise exception 'LC_INVALID'; end if;
 if jsonb_typeof(p_payload->'expected') is distinct from 'object' then raise exception 'LC_INVALID'; end if;
 select * into v_old from lifecycle_private.requests where actor=v_actor and request=p_request;
 if found and v_old.payload<>p_payload then raise exception 'LC_REQUEST_CONFLICT'; end if;
 -- Authorization is rechecked even on retry; no cached privilege.
 if v_op in ('start','edit_order','delete_order') then
  select team_id into v_team from public.orders where id=v_order;
  if not found and v_old.actor is not null then v_team:=(v_old.payload->'expected'->>'team_id')::uuid; end if;
  perform lifecycle_private.assert_actor('orders',case when v_op='delete_order' then 'delete' else 'update' end,v_team);
 else
  select team_id into v_team from public.routes where id=v_route;
  if not found then v_team:=(p_payload->'expected'->>'team_id')::uuid; end if;
  perform lifecycle_private.assert_actor('routes',case when v_op='delete_route' then 'delete' else 'update' end,v_team);
  if v_op in ('save','transfer') or (v_op='route_update' and p_payload->'data' ? 'team_id') then
   if not (public.check_user_permission('orders','assign') or public.check_user_permission('orders','update')) then raise exception 'LC_DENIED' using errcode='42501'; end if;
  end if;
  if v_to is not null then
   select team_id into v_team from public.routes where id=v_to;
   perform lifecycle_private.assert_actor('routes','update',v_team);
  end if;
 end if;
 select * into v_old from lifecycle_private.requests where actor=v_actor and request=p_request;
 if found then
  if v_old.payload<>p_payload then raise exception 'LC_REQUEST_CONFLICT'; end if;
  return v_old.result || jsonb_build_object('replayed',true);
 end if;
 if v_op in ('start','edit_order','delete_order') and not exists(select 1 from public.orders where id=v_order) then raise exception 'LC_NOT_FOUND'; end if;
 if v_op not in ('start','edit_order','delete_order') and not exists(select 1 from public.routes where id=v_route) then raise exception 'LC_NOT_FOUND'; end if;
 if v_op='transfer' and not exists(select 1 from public.routes where id=v_to) then raise exception 'LC_NOT_FOUND'; end if;
 -- Stable order across opposing transfers; statement lock precedes ALL rows.
 perform 1 from public.routes where id in(v_route,v_to) or id in(select route_id from public.route_orders where order_id=v_order) order by id for update;
 perform 1 from public.orders where id=v_order or id in(select order_id from public.route_orders where route_id in(v_route,v_to))
  or id in(select (value->>'order_id')::uuid from jsonb_array_elements(coalesce(p_payload->'desired','[]'::jsonb))) order by id for update;
 perform 1 from public.order_items where order_id=v_order order by id for update;
 if v_op in ('edit_order','delete_order') then
  if lifecycle_private.edit_snapshot(v_order) is distinct from p_payload->'expected' then raise exception 'LC_CONFLICT'; end if;
 elsif v_op='start' then
  if lifecycle_private.order_snapshot(v_order) is distinct from p_payload->'expected' then raise exception 'LC_CONFLICT'; end if;
 else
  if lifecycle_private.route_snapshot(v_route) is distinct from p_payload->'expected' then raise exception 'LC_CONFLICT'; end if;
  if v_to is not null and lifecycle_private.route_snapshot(v_to) is distinct from p_payload->'destination_expected' then raise exception 'LC_CONFLICT'; end if;
 end if;
 insert into lifecycle_private.context(backend,transaction,operation,order_id) values(pg_backend_pid(),txid_current(),v_op,v_order);
 if v_op='delete_order' then
  if lifecycle_private.history_conflict(v_order) or exists(select 1 from public.route_orders where order_id=v_order) then raise exception 'LC_ORDER_DELETE'; end if;
  delete from public.orders where id=v_order returning id into v_id;
  if v_id is null then raise exception 'LC_NOT_FOUND'; end if;
  v_result:=jsonb_build_object('committed',true,'order_id',v_id);
 elsif v_op='edit_order' then
  v_data:=p_payload->'data'; v_desired:=p_payload->'items';
  if jsonb_typeof(v_data) is distinct from 'object' or jsonb_typeof(v_desired) is distinct from 'array' then raise exception 'LC_INVALID'; end if;
  if exists(select 1 from jsonb_object_keys(v_data) k where k not in ('customer_id','scheduled_date','scheduled_time','payment_status','payment_method','transport_method','notes')) then raise exception 'LC_INVALID'; end if;
  if exists(select 1 from jsonb_array_elements(v_desired) x where jsonb_typeof(x.value) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(x.value) k where k not in ('id','service_id','quantity','unit_price','total_price'))
    or (x.value->>'quantity') is null or (x.value->>'unit_price') is null
    or (x.value->>'quantity')::numeric<=0 or (x.value->>'quantity')::numeric<>trunc((x.value->>'quantity')::numeric)
    or (x.value->>'unit_price')::numeric<0 or (x.value->>'unit_price')::numeric in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)
    or (x.value->>'unit_price')::numeric<>round((x.value->>'unit_price')::numeric,2)
    or (x.value->>'quantity')::numeric in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)
    or (x.value ? 'total_price' and round((x.value->>'total_price')::numeric,2) is distinct from round((x.value->>'quantity')::numeric*(x.value->>'unit_price')::numeric,2))) then raise exception 'LC_INVALID'; end if;
  if (select count(*) from jsonb_array_elements(v_desired) where value->>'id' is not null) <>
     (select count(distinct value->>'id') from jsonb_array_elements(v_desired) where value->>'id' is not null)
    or exists(select 1 from jsonb_array_elements(v_desired) x where x.value->>'id' is not null and not exists(select 1 from public.order_items i where i.id=(x.value->>'id')::uuid and i.order_id=v_order)) then raise exception 'LC_INVALID'; end if;
  delete from public.order_items i where i.order_id=v_order and not exists(select 1 from jsonb_array_elements(v_desired) x where (x.value->>'id')::uuid=i.id);
  for v_item in select value from jsonb_array_elements(v_desired) loop
   if v_item->>'id' is null then
    insert into public.order_items(order_id,service_id,quantity,unit_price,total_price) values(v_order,(v_item->>'service_id')::uuid,(v_item->>'quantity')::integer,(v_item->>'unit_price')::numeric,round((v_item->>'quantity')::numeric*(v_item->>'unit_price')::numeric,2));
   else
    update public.order_items set service_id=(v_item->>'service_id')::uuid,quantity=(v_item->>'quantity')::integer,unit_price=(v_item->>'unit_price')::numeric,total_price=round((v_item->>'quantity')::numeric*(v_item->>'unit_price')::numeric,2)
     where id=(v_item->>'id')::uuid and (service_id is distinct from (v_item->>'service_id')::uuid or quantity is distinct from (v_item->>'quantity')::integer or unit_price is distinct from (v_item->>'unit_price')::numeric or total_price is distinct from round((v_item->>'quantity')::numeric*(v_item->>'unit_price')::numeric,2));
   end if;
  end loop;
  update public.orders o set customer_id=case when v_data ? 'customer_id' then (v_data->>'customer_id')::uuid else o.customer_id end,
   scheduled_date=case when v_data ? 'scheduled_date' then (v_data->>'scheduled_date')::date else o.scheduled_date end,
   scheduled_time=case when v_data ? 'scheduled_time' then (v_data->>'scheduled_time')::time else o.scheduled_time end,
   payment_status=case when v_data ? 'payment_status' then v_data->>'payment_status' else o.payment_status end,
   payment_method=case when v_data ? 'payment_method' then v_data->>'payment_method' else o.payment_method end,
   transport_method=case when v_data ? 'transport_method' then v_data->>'transport_method' else o.transport_method end,
   notes=case when v_data ? 'notes' then v_data->>'notes' else o.notes end,
   total_amount=(select coalesce(sum(total_price),0) from public.order_items where order_id=v_order),updated_at=clock_timestamp()
   where o.id=v_order;
  v_result:=jsonb_build_object('committed',true,'order_id',v_order,'order',(select to_jsonb(o) from public.orders o where o.id=v_order));
 elsif v_op='save' then
  v_desired:=p_payload->'desired';
  if jsonb_typeof(v_desired) is distinct from 'array' then raise exception 'LC_INVALID'; end if;
  select count(*) into v_count from jsonb_array_elements(v_desired);
  if exists(select 1 from public.routes where id=v_route and (coalesce(status not in ('planned','in_progress'),true) or actual_end_time is not null))
   and (v_count<>(select count(*) from public.route_orders where route_id=v_route) or exists(
    select 1 from jsonb_array_elements(v_desired) x where not exists(select 1 from public.route_orders ro
     where ro.route_id=v_route and ro.order_id=(x.value->>'order_id')::uuid and ro.sequence_order=(x.value->>'sequence_order')::integer)))
   then raise exception 'LC_HISTORY'; end if;
  if v_count<>(select count(distinct value->>'order_id') from jsonb_array_elements(v_desired)) or
    v_count<>(select count(distinct (value->>'sequence_order')::integer) from jsonb_array_elements(v_desired)) or
    exists(select 1 from jsonb_array_elements(v_desired) where (value->>'sequence_order')::integer<1) then raise exception 'LC_INVALID'; end if;
  select team_id into v_team from public.routes where id=v_route;
  -- Validate the complete delta before the first mutation.
  for v_ro in select * from public.route_orders where route_id=v_route loop
   select value into v_item from jsonb_array_elements(v_desired) where (value->>'order_id')::uuid=v_ro.order_id;
   if v_item is null or (v_item->>'sequence_order')::integer<>v_ro.sequence_order then
    perform lifecycle_private.assert_schedulable(v_ro.order_id);
   end if;
  end loop;
  for v_item in select value from jsonb_array_elements(v_desired) loop
   v_id:=(v_item->>'order_id')::uuid;
   if not exists(select 1 from public.route_orders where route_id=v_route and order_id=v_id) then
    perform lifecycle_private.assert_schedulable(v_id);
    if exists(select 1 from public.route_orders where order_id=v_id) then raise exception 'LC_TRANSFER_REQUIRED'; end if;
    if lifecycle_private.order_snapshot(v_id) is distinct from v_item->'expected' then raise exception 'LC_CONFLICT'; end if;
   end if;
  end loop;
  for v_ro in select * from public.route_orders where route_id=v_route and not exists(
    select 1 from jsonb_array_elements(v_desired) where (value->>'order_id')::uuid=order_id) loop
   delete from public.route_orders where id=v_ro.id;
   update public.orders set status='pending',team_id=null,updated_at=clock_timestamp() where id=v_ro.order_id;
  end loop;
  -- Only changed sequences move temporarily; unchanged protected rows never touched.
  select greatest(coalesce((select max(sequence_order) from public.route_orders where route_id=v_route),0),
   coalesce((select max((value->>'sequence_order')::integer) from jsonb_array_elements(v_desired)),0))+v_count+1 into v_offset;
  for v_ro in select ro.* from public.route_orders ro join jsonb_array_elements(v_desired) x
    on (x.value->>'order_id')::uuid=ro.order_id where ro.route_id=v_route and ro.sequence_order<>(x.value->>'sequence_order')::integer order by ro.id loop
   v_offset:=v_offset+1; update public.route_orders set sequence_order=v_offset where id=v_ro.id;
  end loop;
  for v_item in select value from jsonb_array_elements(v_desired) loop
   v_id:=(v_item->>'order_id')::uuid; v_sequence:=(v_item->>'sequence_order')::integer;
   if exists(select 1 from public.route_orders where route_id=v_route and order_id=v_id) then
    update public.route_orders set sequence_order=v_sequence where route_id=v_route and order_id=v_id and sequence_order<>v_sequence;
   else
    insert into public.route_orders(route_id,order_id,sequence_order,estimated_arrival_time,estimated_completion_time)
    values(v_route,v_id,v_sequence,(v_item->>'estimated_arrival_time')::time,(v_item->>'estimated_completion_time')::time);
    update public.orders set status='scheduled',team_id=v_team,updated_at=clock_timestamp() where id=v_id;
   end if;
  end loop;
  v_result:=jsonb_build_object('committed',true,'snapshot',lifecycle_private.route_snapshot(v_route));
 elsif v_op='transfer' then
  if v_route=v_to then raise exception 'LC_INVALID'; end if;
  if exists(select 1 from public.routes where id in(v_route,v_to) and (coalesce(status not in ('planned','in_progress'),true) or actual_end_time is not null)) then raise exception 'LC_HISTORY'; end if;
  perform lifecycle_private.assert_schedulable(v_order);
  if lifecycle_private.order_snapshot(v_order) is distinct from p_payload->'order_expected' then raise exception 'LC_CONFLICT'; end if;
  if not exists(select 1 from public.route_orders where id=(p_payload->>'link_id')::uuid and route_id=v_route and order_id=v_order) then raise exception 'LC_CONFLICT'; end if;
  delete from public.route_orders where id=(p_payload->>'link_id')::uuid;
  select coalesce(max(sequence_order),0)+1 into v_sequence from public.route_orders where route_id=v_to;
  insert into public.route_orders(route_id,order_id,sequence_order) values(v_to,v_order,v_sequence);
  select team_id into v_team from public.routes where id=v_to;
  update public.orders set status='scheduled',team_id=v_team,updated_at=clock_timestamp() where id=v_order;
  v_result:=jsonb_build_object('committed',true,'order',lifecycle_private.order_snapshot(v_order));
 elsif v_op='route_update' then
  v_data:=p_payload->'data';
  if jsonb_typeof(v_data) is distinct from 'object' or exists(select 1 from jsonb_object_keys(v_data) k where k not in('name','date','start_time','estimated_end_time','notes','team_id','total_distance','total_estimated_time')) then raise exception 'LC_INVALID'; end if;
  select team_id into v_team from public.routes where id=v_route;
  if v_data ? 'team_id' and v_team is distinct from (v_data->>'team_id')::uuid then
   if exists(select 1 from public.routes where id=v_route and (status is distinct from 'planned' or actual_start_time is not null or actual_end_time is not null)) then raise exception 'LC_HISTORY'; end if;
   for v_id in select order_id from public.route_orders where route_id=v_route loop perform lifecycle_private.assert_schedulable(v_id); end loop;
   perform lifecycle_private.assert_actor('routes','update',(v_data->>'team_id')::uuid);
  end if;
  update public.routes set
   name=case when v_data?'name' then v_data->>'name' else name end,
   date=case when v_data?'date' then (v_data->>'date')::date else date end,
   start_time=case when v_data?'start_time' then (v_data->>'start_time')::time else start_time end,
   estimated_end_time=case when v_data?'estimated_end_time' then (v_data->>'estimated_end_time')::time else estimated_end_time end,
   notes=case when v_data?'notes' then v_data->>'notes' else notes end,
   team_id=case when v_data?'team_id' then (v_data->>'team_id')::uuid else team_id end,
   total_distance=case when v_data?'total_distance' then (v_data->>'total_distance')::numeric else total_distance end,
   total_estimated_time=case when v_data?'total_estimated_time' then (v_data->>'total_estimated_time')::integer else total_estimated_time end,
   updated_at=clock_timestamp() where id=v_route;
  v_result:=jsonb_build_object('committed',true,'route',(select to_jsonb(r) from public.routes r where id=v_route));
 elsif v_op='delete_route' then
  delete from public.routes where id=v_route; v_result:=jsonb_build_object('committed',true);
 elsif v_op='start' then
  perform lifecycle_private.assert_schedulable(v_order);
  select * into v_order_row from public.orders where id=v_order;
  if v_order_row.status<>'scheduled' then raise exception 'LC_NOT_SCHEDULED'; end if;
  if (select count(*) from public.route_orders where order_id=v_order)<>1 then raise exception 'LC_AMBIGUOUS'; end if;
  select r.team_id into v_team from public.routes r join public.route_orders ro on ro.route_id=r.id where ro.order_id=v_order;
  if v_team is null or v_team is distinct from v_order_row.team_id then raise exception 'LC_TEAM'; end if;
  if exists(select 1 from public.routes r join public.route_orders ro on ro.route_id=r.id where ro.order_id=v_order and (coalesce(r.status not in ('planned','pending','in_progress'),true) or r.actual_end_time is not null)) then raise exception 'LC_HISTORY'; end if;
  perform 1 from public.teams where id=v_team for update;
  perform 1 from public.team_members where team_id=v_team order by id for update;
  v_start:=clock_timestamp();
  if coalesce((p_payload->>'technician')::boolean,false) and not exists(select 1 from public.workers w
   join public.team_members tm on tm.worker_id=w.id where w.user_id=v_actor and tm.team_id=v_team and tm.joined_at<=v_start
   and (tm.left_at is null or tm.left_at>v_start)) then raise exception 'LC_DENIED' using errcode='42501'; end if;
  if not exists(select 1 from public.team_members where team_id=v_team and joined_at<=v_start and (left_at is null or left_at>v_start)) then raise exception 'LC_MEMBERS'; end if;
  update public.orders set status='in_progress',updated_at=v_start where id=v_order;
  insert into public.order_status_logs(order_id,status,notes,images,created_by,created_at)
  values(v_order,'in_progress',p_payload->>'notes',coalesce(p_payload->'images','[]'::jsonb),v_actor,v_start);
  v_result:=jsonb_build_object('committed',true,'order_id',v_order,'started_at',v_start);
 end if;
 insert into lifecycle_private.requests(actor,request,payload,result) values(v_actor,p_request,p_payload,v_result);
 delete from lifecycle_private.context where backend=pg_backend_pid() and transaction=txid_current();
 return v_result;
end $$;

CREATE OR REPLACE FUNCTION public.reset_operational_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  tbl text;
  v_trigger record;
  v_states jsonb;
  v_epoch uuid;
  op_tables text[] := array[
    'orders','order_items','order_status_logs',
    'routes','route_orders','order_workers',
    'expenses','daily_reports','team_performance','performance_logs'
  ];
begin
  perform pg_advisory_xact_lock(61006,1);
  select token into v_epoch from lifecycle_private.epoch where singleton;
  if exists(select 1 from lifecycle_private.context) then raise exception 'LC_RECOVERY_CONTEXT'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'trigger',t.tgname,'enabled',t.tgenabled)),'[]'::jsonb)
    into v_states from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=any(op_tables) and not t.tgisinternal;
  perform set_config('lock_timeout','5s',true);
  perform set_config('statement_timeout','120s',true);

  -- تعطيل التريغرات مؤقتًا
  foreach tbl in array op_tables loop
    execute format('alter table %I disable trigger user', tbl);
  end loop;

  begin
    -- تفريغ الجداول التشغيلية مع إعادة تسلسل الهويات
    execute 'truncate ' || array_to_string(op_tables, ',') || ' restart identity cascade';
  exception when others then
    -- إعادة التريغرات ثم إعادة الخطأ
    foreach tbl in array op_tables loop
      execute format('alter table %I enable trigger user', tbl);
    end loop;
    raise;
  end;

  -- إعادة التريغرات بعد النجاح
  foreach tbl in array op_tables loop
    execute format('alter table %I enable trigger user', tbl);
  end loop;
  for v_trigger in select value from jsonb_array_elements(v_states) loop
    execute format('alter table public.%I %s trigger %I',v_trigger.value->>'table',
      case v_trigger.value->>'enabled' when 'D' then 'disable' when 'A' then 'enable always' when 'R' then 'enable replica' else 'enable' end,
      v_trigger.value->>'trigger');
  end loop;
  perform public.finalize_lifecycle_recovery(v_epoch,'reset_operational_data');
end;
$function$;


create or replace function public.restore_from_backup(p_backup_id uuid) returns void language plpgsql security definer as $$
begin raise exception 'النسخة التطبيقية القديمة لا تصلح لاستعادة هذا الإصدار. استخدم استعادة كاملة لقاعدة البيانات ثم إنهاء الاستعادة (LC_RECOVERY_FULL_DB)'; end $$;

CREATE OR REPLACE FUNCTION public.cleanup_old_data()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    PERFORM pg_advisory_xact_lock(61006,1);
    -- حذف سجلات الأداء الأقدم من 30 يوم
    DELETE FROM performance_logs 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- حذف سجلات حالة الطلبات الأقدم من سنة
    DELETE FROM order_status_logs 
    WHERE created_at < NOW() - INTERVAL '1 year' AND status IS DISTINCT FROM 'in_progress';
    
    -- تحديث إحصائيات الجداول
    ANALYZE orders;
    ANALYZE customers;
    ANALYZE workers;
    ANALYZE teams;
    ANALYZE expenses;
END;
$function$;


-- One calling SELECT owns one MVCC snapshot for every covered relation.
-- No SHARE locks on financial tables: collection/settlement lock order is untouched.
create function lifecycle_private.backup_chunks() returns table(
 table_name text,table_order integer,row_count bigint,size_bytes bigint,checksum_md5 text,payload jsonb
) language plpgsql stable security definer set search_path=pg_catalog,public,lifecycle_private as $$
declare
 v_table text; v_relation text; v_total bigint:=0;
 v_max_table_bytes constant bigint:=32*1024*1024;
 v_max_total_bytes constant bigint:=64*1024*1024;
  v_tables constant text[] := array[
    'roles', 'users', 'service_categories', 'services',
    'expense_categories', 'system_settings', 'company_locations',
    'public_holidays', 'penalty_rules', 'customers', 'workers', 'teams',
    'team_members', 'orders', 'routes', 'order_items', 'route_orders',
    'order_workers', 'order_status_logs', 'expenses', 'daily_reports',
    'team_performance', 'customer_surveys', 'vaults',
    'vault_transactions', 'custody_accounts', 'custody_transactions',
    'invoices', 'invoice_items', 'attendance_records', 'payroll_periods',
    'payroll_items', 'payroll_disbursements', 'salary_advances',
    'advance_installments', 'hr_adjustments', 'conversations',
    'conversation_participants', 'messages', 'message_read_receipts',
    'notification_preferences', 'push_subscriptions', 'lifecycle_private.epoch', 'lifecycle_private.requests'
  ];
begin
 table_order:=0;
 foreach v_table in array v_tables loop
  v_relation:=case when v_table like 'lifecycle_private.%' then v_table else format('public.%I',v_table) end;
  if to_regclass(v_relation) is null then raise exception 'Expected backup relation % is missing',v_relation; end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb),count(*) from %s t',v_relation) into payload,row_count;
  size_bytes:=pg_column_size(payload);v_total:=v_total+size_bytes;
  if size_bytes>v_max_table_bytes or v_total>v_max_total_bytes then raise exception 'Backup V2 payload exceeds safety limits'; end if;
  table_name:=v_table;table_order:=table_order+1;checksum_md5:=md5(payload::text);
  return next;
 end loop;
end $$;
revoke all on function lifecycle_private.backup_chunks() from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION internal_maintenance.create_backup_v2(p_label text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'internal_maintenance'
AS $function$
declare
  v_run_id uuid;
  v_chunk record;
  v_order integer := 0;
  v_total_rows bigint := 0;
  v_total_size bigint := 0;

begin
  perform pg_advisory_xact_lock(61006,1);
  perform set_config('lock_timeout', '2s', true);
  perform set_config('statement_timeout', '300s', true);

  if not pg_try_advisory_xact_lock(hashtext('home-care-backup-v2')) then
    raise exception 'Backup V2 is already running';
  end if;

  insert into internal_maintenance.backup_v2_runs(label)
  values (
    coalesce(
      nullif(btrim(p_label), ''),
      'Auto V2 ' || to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI')
    )
  )
  returning id into v_run_id;

  begin
    -- Exactly one SELECT into a STABLE read-only function, not one fresh
    -- snapshot per chunk. The global lifecycle lock was acquired before it.
    for v_chunk in select * from lifecycle_private.backup_chunks() loop
      v_order:=v_chunk.table_order;
      v_total_rows:=v_total_rows+v_chunk.row_count;
      v_total_size:=v_total_size+v_chunk.size_bytes;
      insert into internal_maintenance.backup_v2_chunks(run_id,table_name,table_order,row_count,size_bytes,checksum_md5,payload)
      values(v_run_id,v_chunk.table_name,v_chunk.table_order,v_chunk.row_count,v_chunk.size_bytes,v_chunk.checksum_md5,v_chunk.payload);
    end loop;

    update internal_maintenance.backup_v2_runs
    set status = 'completed',
        completed_at = clock_timestamp(),
        tables_count = v_order,
        total_rows = v_total_rows,
        total_size_bytes = v_total_size
    where id = v_run_id;

    -- Retention pruning is intentionally performed by
    -- run_scheduled_backup_v2() only after full integrity validation.
    return jsonb_build_object(
      'success', true,
      'run_id', v_run_id,
      'tables_count', v_order,
      'total_rows', v_total_rows,
      'total_size_bytes', v_total_size
    );
  exception
    when others then
      delete from internal_maintenance.backup_v2_chunks
      where run_id = v_run_id;

      update internal_maintenance.backup_v2_runs
      set status = 'failed',
          completed_at = clock_timestamp(),
          tables_count = v_order,
          total_rows = v_total_rows,
          total_size_bytes = v_total_size,
          error_message = left(sqlerrm, 2000)
      where id = v_run_id;

      return jsonb_build_object(
        'success', false,
        'run_id', v_run_id,
      'failed_table', null,
        'error', sqlerrm
      );
  end;
end;
$function$;


CREATE OR REPLACE FUNCTION public.admin_create_backup_v2(p_label text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'internal_maintenance'
AS $function$
declare
  v_result jsonb;
  v_run_id uuid;
  v_expected_tables constant integer := 44;
  v_chunks bigint;
  v_rows bigint;
  v_size bigint;
  v_invalid bigint;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and u.is_active is true
      and coalesce((r.permissions ->> 'admin')::boolean, false)
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  v_result := internal_maintenance.create_backup_v2(
    left(nullif(btrim(p_label), ''), 200)
  );

  if coalesce((v_result ->> 'success')::boolean, false) is not true then
    raise exception 'Backup V2 creation failed: %',
      coalesce(v_result ->> 'error', v_result::text);
  end if;

  v_run_id := (v_result ->> 'run_id')::uuid;

  select
    count(*),
    coalesce(sum(c.row_count), 0),
    coalesce(sum(c.size_bytes), 0),
    count(*) filter (
      where jsonb_typeof(c.payload) <> 'array'
         or jsonb_array_length(c.payload) <> c.row_count
         or md5(c.payload::text) <> c.checksum_md5
    )
  into v_chunks, v_rows, v_size, v_invalid
  from internal_maintenance.backup_v2_chunks c
  where c.run_id = v_run_id;

  if v_chunks <> v_expected_tables
     or v_invalid <> 0
     or v_rows <> (v_result ->> 'total_rows')::bigint
     or v_size <> (v_result ->> 'total_size_bytes')::bigint then
    raise exception 'Backup V2 integrity validation failed';
  end if;

  if not exists (
    select 1
    from internal_maintenance.backup_v2_runs b
    where b.id = v_run_id
      and b.status = 'completed'
      and b.tables_count = v_expected_tables
      and b.total_rows = v_rows
      and b.total_size_bytes = v_size
  ) then
    raise exception 'Backup V2 summary validation failed';
  end if;

  -- Keep the previous snapshot until the new one has passed every check.
  delete from internal_maintenance.backup_v2_runs
  where status = 'completed'
    and id <> v_run_id;

  return v_result;
end;
$function$;


create or replace function internal_maintenance.run_scheduled_backup_v2()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, internal_maintenance
as $function$
declare
  v_result jsonb;
  v_run_id uuid;
  v_expected_tables constant integer := 44;
  v_chunks bigint;
  v_rows bigint;
  v_size bigint;
  v_invalid bigint;
begin
  v_result := internal_maintenance.create_backup_v2(null);

  if coalesce((v_result->>'success')::boolean, false) is not true then
    raise exception 'Backup V2 creation failed: %', coalesce(v_result->>'error', v_result::text);
  end if;

  v_run_id := (v_result->>'run_id')::uuid;

  select
    count(*),
    coalesce(sum(c.row_count), 0),
    coalesce(sum(c.size_bytes), 0),
    count(*) filter (
      where jsonb_typeof(c.payload) <> 'array'
         or jsonb_array_length(c.payload) <> c.row_count
         or md5(c.payload::text) <> c.checksum_md5
    )
  into v_chunks, v_rows, v_size, v_invalid
  from internal_maintenance.backup_v2_chunks c
  where c.run_id = v_run_id;

  if v_chunks <> v_expected_tables then
    raise exception 'Expected % chunks, found %', v_expected_tables, v_chunks;
  end if;

  if v_invalid <> 0 then
    raise exception 'Found % invalid backup chunks', v_invalid;
  end if;

  if v_rows <> (v_result->>'total_rows')::bigint
     or v_size <> (v_result->>'total_size_bytes')::bigint then
    raise exception 'Backup V2 chunk totals do not match run totals';
  end if;

  if not exists (
    select 1
    from internal_maintenance.backup_v2_runs r
    where r.id = v_run_id
      and r.status = 'completed'
      and r.tables_count = v_expected_tables
      and r.total_rows = v_rows
      and r.total_size_bytes = v_size
  ) then
    raise exception 'Backup V2 run summary is inconsistent';
  end if;

  -- Keep one completed internal snapshot only after the new snapshot passed
  -- every integrity check.
  delete from internal_maintenance.backup_v2_runs
  where status = 'completed'
    and id <> v_run_id;
end;
$function$;

commit;
