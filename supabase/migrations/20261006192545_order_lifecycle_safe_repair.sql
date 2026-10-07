-- Candidate isolated lifecycle repair. No data backfill or old ACL changes.
begin;
create schema lifecycle_private;
revoke all on schema lifecycle_private from public, anon, authenticated;
create table lifecycle_private.context (
  backend integer not null, transaction bigint not null, operation text not null, order_id uuid,
  primary key(backend, transaction)
);
create table lifecycle_private.requests (
  actor uuid not null, request uuid not null, payload jsonb not null,
  result jsonb not null, created_at timestamptz not null default clock_timestamp(),
  primary key(actor, request)
);
create index lifecycle_started_order on lifecycle_private.requests ((payload->>'order_id')) where payload->>'op'='start';
alter table lifecycle_private.context enable row level security;
alter table lifecycle_private.requests enable row level security;
revoke all on all tables in schema lifecycle_private from public, anon, authenticated;

create function lifecycle_private.current_operation() returns text
language sql stable security definer set search_path = pg_catalog, lifecycle_private
as $$ select operation from lifecycle_private.context
 where backend=pg_backend_pid() and transaction=txid_current() $$;

create function lifecycle_private.current_order() returns uuid
language sql stable security definer set search_path=pg_catalog,lifecycle_private
as $$ select order_id from lifecycle_private.context where backend=pg_backend_pid() and transaction=txid_current() $$;

create function lifecycle_private.lock_statement() returns trigger
language plpgsql security definer set search_path = pg_catalog
as $$ begin perform pg_advisory_xact_lock(61006,1); return null; end $$;

-- Including INSERT/UPDATE/DELETE on teams and membership stabilizes membership
-- through participant insertion. Statement locks run before row/FK locks.
do $$ declare t text; begin
 foreach t in array array['routes','route_orders','orders','order_status_logs',
                         'order_workers','teams','team_members','workers','order_items'] loop
  execute format('create trigger lifecycle_00_statement before insert or update or delete on public.%I for each statement execute function lifecycle_private.lock_statement()',t);
 end loop;
end $$;

create function lifecycle_private.history_conflict(p_order uuid) returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$ select exists(select 1 from public.orders where id=p_order and coalesce(status not in ('pending','scheduled'),true))
 or exists(select 1 from public.order_status_logs where order_id=p_order and status in ('in_progress','completed'))
 or exists(select 1 from public.order_workers where order_id=p_order)
 or exists(select 1 from public.invoices where order_id=p_order) $$;

create function lifecycle_private.assert_actor(p_domain text,p_action text,p_team uuid default null)
returns void language plpgsql security definer set search_path=pg_catalog,public
as $$ declare v_permissions jsonb; begin
 select r.permissions into v_permissions from public.users u join public.roles r on r.id=u.role_id
 where u.id=auth.uid() and u.is_active and r.is_active;
 if v_permissions is null or not public.check_user_permission(p_domain,p_action) then
  raise exception 'LC_DENIED' using errcode='42501';
 end if;
 if coalesce((v_permissions->p_domain->>'team_only')::boolean,false)
 and not exists(select 1 from public.workers w join public.team_members tm on tm.worker_id=w.id
 where w.user_id=auth.uid() and tm.team_id=p_team and tm.joined_at<=clock_timestamp()
 and (tm.left_at is null or tm.left_at>clock_timestamp())) then
  raise exception 'LC_DENIED' using errcode='42501';
 end if;
end $$;

create function lifecycle_private.assert_schedulable(p_order uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public,lifecycle_private
as $$ begin
 if not exists(select 1 from public.orders where id=p_order) then raise exception 'LC_NOT_FOUND'; end if;
 if lifecycle_private.history_conflict(p_order) then raise exception 'LC_HISTORY'; end if;
 if (select count(*) from public.route_orders where order_id=p_order)>1 then raise exception 'LC_AMBIGUOUS'; end if;
end $$;

create function lifecycle_private.order_snapshot(p_order uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,public,lifecycle_private
as $$ select jsonb_build_object('id',o.id,'status',o.status,'team_id',o.team_id,'updated_at',o.updated_at,
 'history',lifecycle_private.history_conflict(o.id),'links',coalesce((select jsonb_agg(
 jsonb_build_object('id',ro.id,'route_id',ro.route_id,'sequence_order',ro.sequence_order,
 'team_id',r.team_id,'status',r.status,'updated_at',r.updated_at) order by ro.id)
 from public.route_orders ro join public.routes r on r.id=ro.route_id where ro.order_id=o.id),'[]'::jsonb))
 from public.orders o where o.id=p_order $$;

create function lifecycle_private.route_snapshot(p_route uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,public,lifecycle_private
as $$ select jsonb_build_object('id',r.id,'team_id',r.team_id,'status',r.status,'updated_at',r.updated_at,
 'links',coalesce((select jsonb_agg(jsonb_build_object('id',ro.id,'order_id',ro.order_id,
 'sequence_order',ro.sequence_order,'order',lifecycle_private.order_snapshot(ro.order_id)) order by ro.id)
 from public.route_orders ro where ro.route_id=r.id),'[]'::jsonb)) from public.routes r where r.id=p_route $$;

-- Separate edit version: item changes invalidate editing without changing the
-- established scheduling snapshot contract.
create function lifecycle_private.edit_snapshot(p_order uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,public,lifecycle_private
as $$ select lifecycle_private.order_snapshot(o.id) || jsonb_build_object(
 'data',jsonb_build_object('customer_id',o.customer_id,'scheduled_date',o.scheduled_date,
 'scheduled_time',o.scheduled_time,'payment_status',o.payment_status,'payment_method',o.payment_method,
 'transport_method',o.transport_method,'notes',o.notes),'total_amount',o.total_amount,
 'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.order_items i where i.order_id=o.id),'[]'::jsonb))
 from public.orders o where o.id=p_order $$;

create function public.lifecycle_snapshot(p_kind text,p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,lifecycle_private
as $$ declare v_result jsonb; v_team uuid; begin
 perform pg_advisory_xact_lock(61006,1);
 if p_kind='route' then
  select team_id into v_team from public.routes where id=p_id;
  perform lifecycle_private.assert_actor('routes','read',v_team);
  v_result:=lifecycle_private.route_snapshot(p_id);
 elsif p_kind in ('order','edit_order') then
  select team_id into v_team from public.orders where id=p_id;
  perform lifecycle_private.assert_actor('orders','read',v_team);
  v_result:=case when p_kind='edit_order' then lifecycle_private.edit_snapshot(p_id) else lifecycle_private.order_snapshot(p_id) end;
 else raise exception 'LC_INVALID'; end if;
 if v_result is null then raise exception 'LC_NOT_FOUND'; end if;
 return v_result;
end $$;

-- Narrow server boundary: old clients must refresh for relationship/context/start.
create function lifecycle_private.guard_row() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,lifecycle_private
as $$ declare v_op text:=lifecycle_private.current_operation(); v_order uuid; begin
 if v_op in ('edit_order','delete_order') and TG_TABLE_NAME in ('orders','order_items','order_status_logs','order_workers','route_orders') then
  if TG_TABLE_NAME='orders' then v_order:=case when TG_OP='DELETE' then OLD.id else NEW.id end;
  else v_order:=case when TG_OP='DELETE' then OLD.order_id else NEW.order_id end; end if;
  if v_order is distinct from lifecycle_private.current_order() then raise exception 'LC_INVALID'; end if;
  if TG_OP='UPDATE' and TG_TABLE_NAME<>'orders' then
   if OLD.order_id is distinct from lifecycle_private.current_order() then raise exception 'LC_INVALID'; end if;
  end if;
 end if;
 if TG_TABLE_NAME='order_items' then
  if TG_OP='DELETE' and v_op not in ('edit_order','delete_order') or (TG_OP='DELETE' and v_op is null) then raise exception 'LC_REFRESH'; end if;
 elsif TG_TABLE_NAME='route_orders' then
  if v_op not in ('save','transfer') or v_op is null then raise exception 'LC_REFRESH'; end if;
 elsif TG_TABLE_NAME='orders' then
  if TG_OP='DELETE' and v_op is distinct from 'delete_order' then raise exception 'LC_REFRESH'; end if;
  if TG_OP='UPDATE' and NEW.total_amount is distinct from OLD.total_amount and v_op is distinct from 'edit_order' then raise exception 'LC_REFRESH'; end if;
  if TG_OP='UPDATE' and (NEW.team_id is distinct from OLD.team_id or
      (NEW.status is distinct from OLD.status and coalesce(NEW.status not in ('completed','cancelled'),true))) then
   if v_op is null then raise exception 'LC_REFRESH'; end if;
  end if;
 elsif TG_TABLE_NAME='routes' then
  if TG_OP='DELETE' and (OLD.status is distinct from 'planned' or OLD.actual_start_time is not null or OLD.actual_end_time is not null or
    exists(select 1 from public.route_orders where route_id=OLD.id)) then raise exception 'LC_ROUTE_DELETE'; end if;
  if TG_OP='UPDATE' and NEW.team_id is distinct from OLD.team_id and v_op is distinct from 'route_update' then raise exception 'LC_REFRESH'; end if;
 elsif TG_TABLE_NAME='order_status_logs' then
  if (TG_OP='INSERT' and NEW.status='in_progress' and v_op is distinct from 'start')
   or (TG_OP='UPDATE' and NEW.status='in_progress' and (OLD.status<>'in_progress' or NEW.order_id is distinct from OLD.order_id))
   or (TG_OP in ('UPDATE','DELETE') and OLD.status='in_progress' and exists(
    select 1 from lifecycle_private.requests where payload->>'op'='start' and payload->>'order_id'=OLD.order_id::text)) then raise exception 'LC_REFRESH'; end if;
 elsif TG_TABLE_NAME='order_workers' then
  v_order:=case when TG_OP='DELETE' then OLD.order_id else NEW.order_id end;
  if TG_OP in ('INSERT','DELETE') and v_op is distinct from 'start' and exists(
   select 1 from lifecycle_private.requests where payload->>'op'='start' and payload->>'order_id'=v_order::text)
   then raise exception 'LC_REFRESH'; end if;
  if TG_OP='UPDATE' and (NEW.order_id is distinct from OLD.order_id or NEW.worker_id is distinct from OLD.worker_id
   or NEW.team_id is distinct from OLD.team_id or NEW.started_at is distinct from OLD.started_at or NEW.role is distinct from OLD.role)
   and exists(select 1 from lifecycle_private.requests where payload->>'op'='start' and payload->>'order_id' in(OLD.order_id::text,NEW.order_id::text))
   then raise exception 'LC_HISTORY'; end if;
 end if;
 if TG_OP='DELETE' then return OLD; end if; return NEW;
end $$;
create trigger lifecycle_01_guard before insert or update or delete on public.route_orders for each row execute function lifecycle_private.guard_row();
create trigger lifecycle_01_guard before update or delete on public.orders for each row execute function lifecycle_private.guard_row();
create trigger lifecycle_01_guard before update or delete on public.routes for each row execute function lifecycle_private.guard_row();
create trigger lifecycle_01_guard before insert or update or delete on public.order_status_logs for each row execute function lifecycle_private.guard_row();
create trigger lifecycle_01_guard before insert or update or delete on public.order_workers for each row execute function lifecycle_private.guard_row();
create trigger lifecycle_01_guard before insert or update or delete on public.order_items for each row execute function lifecycle_private.guard_row();
-- Statement guard also rejects zero-row legacy deletes before any effect.
create function lifecycle_private.guard_edit_statement() returns trigger
language plpgsql security definer set search_path=pg_catalog,lifecycle_private
as $$ begin
 if TG_TABLE_NAME='orders' and TG_OP='DELETE' then
  if lifecycle_private.current_operation() is distinct from 'delete_order' then raise exception 'يلزم تحديث التطبيق قبل تعديل الطلب أو حذفه (LC_REFRESH)'; end if;
 elsif lifecycle_private.current_operation() is distinct from 'edit_order' and
    (TG_TABLE_NAME='orders' or lifecycle_private.current_operation() is distinct from 'delete_order') then raise exception 'يلزم تحديث التطبيق قبل تعديل الطلب أو حذفه (LC_REFRESH)'; end if;
 return null;
end $$;
create trigger lifecycle_01_edit_statement before update of customer_id,scheduled_date,scheduled_time,transport_method,notes,total_amount on public.orders for each statement execute function lifecycle_private.guard_edit_statement();
create trigger lifecycle_01_delete_statement before delete on public.order_items for each statement execute function lifecycle_private.guard_edit_statement();
create trigger lifecycle_01_delete_statement before delete on public.orders for each statement execute function lifecycle_private.guard_edit_statement();

-- Preserve existing security modes and ACLs. No destructive population on start.
create or replace function public.trg_ow_status_log() returns trigger language plpgsql
as $$ begin
 if NEW.status='in_progress' then
  if lifecycle_private.current_operation() is distinct from 'start' then raise exception 'LC_REFRESH'; end if;
  insert into public.order_workers(order_id,worker_id,team_id,role,started_at)
  select o.id,tm.worker_id,o.team_id,case when tm.worker_id=t.leader_id then 'leader' else 'member' end,NEW.created_at
  from public.orders o join public.team_members tm on tm.team_id=o.team_id join public.teams t on t.id=o.team_id
  where o.id=NEW.order_id and tm.joined_at<=NEW.created_at and (tm.left_at is null or tm.left_at>NEW.created_at);
 elsif NEW.status='completed' then perform public.close_order_workers(NEW.order_id,NEW.created_at); end if;
 return NEW;
end $$;

-- Same-team saves no longer rewrite historical orders.
create or replace function public.trg_routes_team_change() returns trigger language plpgsql
as $$ begin
 if NEW.team_id is distinct from OLD.team_id then
  if lifecycle_private.current_operation() is distinct from 'route_update' then raise exception 'LC_REFRESH'; end if;
  update public.orders set team_id=NEW.team_id where id in(select order_id from public.route_orders where route_id=NEW.id);
 end if; return NEW;
end $$;

create function public.lifecycle_mutate(p_request uuid,p_payload jsonb) returns jsonb
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

revoke all on all functions in schema lifecycle_private from public,anon,authenticated;
revoke all on function public.lifecycle_snapshot(text,uuid) from public,anon;
revoke all on function public.lifecycle_mutate(uuid,jsonb) from public,anon;
grant execute on function public.lifecycle_snapshot(text,uuid),public.lifecycle_mutate(uuid,jsonb) to authenticated;
commit;
