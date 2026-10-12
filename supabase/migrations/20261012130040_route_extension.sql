-- Same-day continuous work only. Historical attendance is deliberately not backfilled.
begin;
-- A route FK would make the existing operational TRUNCATE CASCADE erase
-- attendance history. The private trigger proves this historical reference.
alter table public.attendance_records add column auto_checkout_route_id uuid;
alter table lifecycle_private.context add column closing_route_id uuid;
create trigger lifecycle_00_statement before insert or update or delete on public.attendance_records
for each statement execute function lifecycle_private.lock_statement();

create function lifecycle_private.assert_extension_actor(p_team uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public,lifecycle_private as $$
begin
 perform lifecycle_private.assert_actor('routes','update',p_team);
 if not (public.check_user_permission('orders','assign') or public.check_user_permission('orders','update'))
  or exists(select 1 from public.users u join public.roles r on r.id=u.role_id where u.id=auth.uid()
   and coalesce((r.permissions->>'admin')::boolean,false) is not true
   and (coalesce((r.permissions->'routes'->>'team_only')::boolean,false)
    or coalesce((r.permissions->'orders'->>'team_only')::boolean,false))) then
  raise exception 'LC_DENIED' using errcode='42501';
 end if;
end $$;
revoke all on function lifecycle_private.assert_extension_actor(uuid) from public,anon,authenticated,service_role;

create function lifecycle_private.assert_extension_leader(p_team uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public,lifecycle_private as $$
begin
 -- Keep account and role eligibility stable until the extension commits.
 perform 1 from public.users u join public.workers w on w.user_id=u.id
 join public.teams t on t.leader_id=w.id where t.id=p_team for share of u;
 perform 1 from public.roles r join public.users u on u.role_id=r.id
 join public.workers w on w.user_id=u.id join public.teams t on t.leader_id=w.id
 where t.id=p_team for share of r;
 if not exists(select 1 from public.teams t join public.workers w on w.id=t.leader_id
  join public.users u on u.id=w.user_id join public.roles r on r.id=u.role_id
  join public.team_members tm on tm.team_id=t.id and tm.worker_id=w.id
  where t.id=p_team and u.is_active and r.is_active and tm.left_at is null
   and tm.joined_at<=clock_timestamp()
   and coalesce((r.permissions->'orders'->>'update')::boolean,
    (r.permissions->>'admin')::boolean,false)) then
  raise exception 'LC_EXTENSION_LEADER';
 end if;
end $$;
revoke all on function lifecycle_private.assert_extension_leader(uuid) from public,anon,authenticated,service_role;

create function lifecycle_private.extension_snapshot(p_route uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,public,lifecycle_private as $$
 select lifecycle_private.route_snapshot(r.id) || jsonb_build_object(
 'date',r.date,'actual_start_time',r.actual_start_time,'actual_end_time',r.actual_end_time,
 'leader_id',t.leader_id,'team_name',t.name,
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',tm.id,'worker_id',tm.worker_id,
 'name',w.name,'joined_at',tm.joined_at,'left_at',tm.left_at) order by tm.id)
 from public.team_members tm join public.workers w on w.id=tm.worker_id
 where tm.team_id=r.team_id and (tm.left_at is null or tm.left_at>=r.actual_start_time)),'[]'::jsonb),
 'attendance',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'worker_id',a.worker_id,
 'check_in_time',a.check_in_time,'check_out_time',a.check_out_time,'check_out_method',a.check_out_method,
 'auto_checkout_route_id',a.auto_checkout_route_id) order by a.id)
 from public.attendance_records a where a.date=r.date and a.worker_id in
 (select worker_id from public.team_members where team_id=r.team_id and left_at is null)),'[]'::jsonb))
 from public.routes r left join public.teams t on t.id=r.team_id where r.id=p_route
$$;
revoke all on function lifecycle_private.extension_snapshot(uuid) from public,anon,authenticated,service_role;

create function lifecycle_private.guard_attendance_checkout() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,lifecycle_private as $$
declare v_route uuid; v_end timestamptz; v_count integer; v_hr_admin boolean;
begin
 if lifecycle_private.current_operation()='extend' then
  if TG_OP<>'UPDATE' or NEW.check_out_time is not null or NEW.check_out_method is not null
   or NEW.auto_checkout_route_id is not null or OLD.check_out_method is distinct from 'auto_route_complete'
   or OLD.auto_checkout_route_id is null or NEW.worker_id is distinct from OLD.worker_id
   or NEW.date is distinct from OLD.date or NEW.check_in_time is distinct from OLD.check_in_time
   then raise exception 'LC_EXTENSION_ATTENDANCE'; end if;
  return NEW;
 end if;
 select closing_route_id into v_route from lifecycle_private.context where backend=pg_backend_pid() and transaction=txid_current();
 -- Existing HR screens allow these roles to correct attendance. An old screen
 -- sends only the edited time, so mark that actual correction as administrative.
 select exists(select 1 from public.users u join public.roles r on r.id=u.role_id
  where u.id=auth.uid() and u.is_active and r.is_active and r.name in ('manager','operations_supervisor','admin')) into v_hr_admin;
 if TG_OP='UPDATE' and v_route is null and v_hr_admin and OLD.check_out_time is not null
  and OLD.check_out_method='auto_route_complete' and NEW.check_out_method='auto_route_complete'
  and NEW.worker_id=OLD.worker_id and NEW.date=OLD.date
  and NEW.check_out_time is distinct from OLD.check_out_time then
  NEW.check_out_method:=case when NEW.check_out_time is null then null else 'manual_admin' end;
  NEW.auto_checkout_route_id:=null;
  return NEW;
 end if;
 if (TG_OP='INSERT' and NEW.auto_checkout_route_id is not null) or
  (TG_OP='UPDATE' and NEW.check_out_method='auto_route_complete' and NEW.auto_checkout_route_id is distinct from OLD.auto_checkout_route_id) then
  raise exception 'LC_AUTO_CHECKOUT_SOURCE';
 end if;
 if TG_OP='UPDATE' and OLD.auto_checkout_route_id is not null and NEW.check_out_time is null then
  raise exception 'LC_AUTO_CHECKOUT_SOURCE';
 end if;
 if TG_OP='UPDATE' and NEW.auto_checkout_route_id is distinct from OLD.auto_checkout_route_id
  and NEW.check_out_method is distinct from 'auto_route_complete' then
  NEW.auto_checkout_route_id:=null;
 end if;
 if NEW.check_out_time is not null and NEW.check_out_method='auto_route_complete' then
  -- Legacy retries must not replace a previously recorded automatic or manual departure.
  if TG_OP='UPDATE' and OLD.check_out_time is not null then
   NEW.check_out_time:=OLD.check_out_time; NEW.check_out_method:=OLD.check_out_method;
   NEW.check_out_location:=OLD.check_out_location;
   NEW.auto_checkout_route_id:=OLD.auto_checkout_route_id; return NEW;
  end if;
  if v_route is not null then
   -- Trusted route closure retains the pre-existing attendance behavior even for
   -- historic/multiple routes. Only a matching workday has extension provenance.
   select actual_end_time into v_end from public.routes where id=v_route and date=NEW.date and status='completed';
   if v_end is not null then NEW.auto_checkout_route_id:=v_route; NEW.check_out_time:=v_end;
   else NEW.auto_checkout_route_id:=null; end if;
   return NEW;
  end if;
  if exists(select 1 from public.routes r join public.team_members tm on tm.team_id=r.team_id
    join public.route_orders ro on ro.route_id=r.id join public.orders o on o.id=ro.order_id
    where tm.worker_id=NEW.worker_id and tm.left_at is null and r.date=NEW.date
     and o.status not in ('completed','cancelled')) then raise exception 'LC_AUTO_CHECKOUT_ACTIVE'; end if;
  select count(*),min(r.id::text)::uuid,min(r.actual_end_time) into v_count,v_route,v_end
   from public.routes r where r.date=NEW.date and r.status='completed' and r.actual_end_time is not null
    and exists(select 1 from public.team_members tm where tm.team_id=r.team_id and tm.worker_id=NEW.worker_id and tm.left_at is null);
  if v_count<>1 then raise exception 'LC_AUTO_CHECKOUT_SOURCE'; end if;
  if NEW.auto_checkout_route_id is not null and NEW.auto_checkout_route_id is distinct from v_route then
   raise exception 'LC_AUTO_CHECKOUT_SOURCE'; end if;
  NEW.auto_checkout_route_id:=v_route; NEW.check_out_time:=v_end;
 elsif NEW.check_out_method is distinct from 'auto_route_complete' then NEW.auto_checkout_route_id:=null;
 elsif TG_OP='INSERT' or NEW.auto_checkout_route_id is distinct from OLD.auto_checkout_route_id then
  raise exception 'LC_AUTO_CHECKOUT_SOURCE';
 end if;
 return NEW;
end $$;
revoke all on function lifecycle_private.guard_attendance_checkout() from public,anon,authenticated,service_role;
create trigger lifecycle_01_checkout before insert or update on public.attendance_records
for each row execute function lifecycle_private.guard_attendance_checkout();

create or replace function public.auto_check_out_on_route_complete() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_worker record; v_context boolean; v_previous uuid;
begin
 if NEW.status<>'completed' or OLD.status='completed' or NEW.team_id is null then return NEW; end if;
 begin
  select closing_route_id into v_previous from lifecycle_private.context where backend=pg_backend_pid() and transaction=txid_current();
  v_context:=found;
  insert into lifecycle_private.context(backend,transaction,operation,closing_route_id)
   values(pg_backend_pid(),txid_current(),'auto_checkout',NEW.id)
   on conflict(backend,transaction) do update set closing_route_id=excluded.closing_route_id;
  for v_worker in select ar.id as attendance_id from attendance_records ar
   join team_members tm on tm.worker_id=ar.worker_id where tm.team_id=NEW.team_id
    and tm.left_at is null and ar.date=CURRENT_DATE and ar.check_in_time is not null and ar.check_out_time is null
  loop
   update attendance_records set check_out_time=NOW(),check_out_method='auto_route_complete',updated_at=NOW()
    where id=v_worker.attendance_id;
  end loop;
  if v_context then update lifecycle_private.context set closing_route_id=v_previous where backend=pg_backend_pid() and transaction=txid_current();
  else delete from lifecycle_private.context where backend=pg_backend_pid() and transaction=txid_current(); end if;
 exception when others then raise warning 'auto_check_out failed for route %: %',NEW.id,SQLERRM;
 end;
 return NEW;
end $$;

create function lifecycle_private.extend_route(p_route uuid,p_order uuid,p_payload jsonb) returns jsonb
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
 if (select count(*) from public.routes where team_id=v_route.team_id and date=v_route.date)<>1 then raise exception 'LC_AMBIGUOUS'; end if;
 perform 1 from public.teams where id=v_route.team_id for update;
 perform 1 from public.team_members where team_id=v_route.team_id order by id for update;
 perform lifecycle_private.assert_extension_leader(v_route.team_id);
 perform 1 from public.attendance_records where date=v_route.date and worker_id in
  (select worker_id from public.team_members where team_id=v_route.team_id and left_at is null) order by id for update;
 if lifecycle_private.extension_snapshot(p_route) is distinct from p_payload->'expected' then raise exception 'LC_CONFLICT'; end if;
 if not exists(select 1 from public.route_orders where route_id=p_route)
  or exists(select 1 from public.route_orders ro join public.orders o on o.id=ro.order_id where ro.route_id=p_route and o.status not in ('completed','cancelled'))
  then raise exception 'LC_EXTENSION_CLOSED'; end if;
 if exists(select 1 from public.team_members where team_id=v_route.team_id and
  ((left_at is null and joined_at>v_route.actual_start_time) or (left_at is not null and left_at>=v_route.actual_start_time)))
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


create or replace function lifecycle_private.guard_row() returns trigger
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
  if v_op not in ('save','transfer','extend') or v_op is null then raise exception 'LC_REFRESH'; end if;
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

create or replace function audit_private.capture_attendance_records() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD.auto_checkout_route_id is distinct from NEW.auto_checkout_route_id then 'auto_checkout_route_id' end,case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."worker_id" is distinct from NEW."worker_id" then 'worker_id' end,case when OLD."date" is distinct from NEW."date" then 'date' end,case when OLD."check_in_time" is distinct from NEW."check_in_time" then 'check_in_time' end,case when OLD."check_out_time" is distinct from NEW."check_out_time" then 'check_out_time' end,case when OLD."check_in_method" is distinct from NEW."check_in_method" then 'check_in_method' end,case when OLD."check_out_method" is distinct from NEW."check_out_method" then 'check_out_method' end,case when OLD."status" is distinct from NEW."status" then 'status' end,case when OLD."work_hours" is distinct from NEW."work_hours" then 'work_hours' end,case when OLD."modified_by" is distinct from NEW."modified_by" then 'modified_by' end,case when OLD."late_minutes" is distinct from NEW."late_minutes" then 'late_minutes' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['auto_checkout_route_id','id','worker_id','date','check_in_time','check_out_time','check_in_method','check_out_method','status','work_hours','modified_by','late_minutes']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('auto_checkout_route_id',OLD.auto_checkout_route_id,'id',OLD."id",'worker_id',OLD."worker_id",'date',OLD."date",'check_in_time',OLD."check_in_time",'check_out_time',OLD."check_out_time",'check_in_method',left(OLD."check_in_method"::text,160),'check_out_method',left(OLD."check_out_method"::text,160),'status',left(OLD."status"::text,160),'work_hours',OLD."work_hours",'modified_by',OLD."modified_by",'late_minutes',OLD."late_minutes"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('auto_checkout_route_id',NEW.auto_checkout_route_id,'id',NEW."id",'worker_id',NEW."worker_id",'date',NEW."date",'check_in_time',NEW."check_in_time",'check_out_time',NEW."check_out_time",'check_in_method',left(NEW."check_in_method"::text,160),'check_out_method',left(NEW."check_out_method"::text,160),'status',left(NEW."status"::text,160),'work_hours',NEW."work_hours",'modified_by',NEW."modified_by",'late_minutes',NEW."late_minutes"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."check_in_method"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."check_in_method"::text)>160) then 'check_in_method' end,case when (TG_OP <> 'INSERT' and char_length(OLD."check_out_method"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."check_out_method"::text)>160) then 'check_out_method' end,case when (TG_OP <> 'INSERT' and char_length(OLD."status"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."status"::text)>160) then 'status' end]::text[],null);
  perform audit_private.append_event('public','attendance_records',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.attendance_records',TG_OP,SQLSTATE;
 end;
 return null;
end $$;

create or replace function audit_private.capture_requests() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_enabled boolean; v_generation uuid; v_operation text; v_order uuid; v_route uuid; v_destination uuid; v_after jsonb;
begin
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if jsonb_typeof(NEW.payload->'op') is distinct from 'string' then raise exception 'AUDIT_RECEIPT_INVALID'; end if;
  v_operation := NEW.payload->>'op';
  if v_operation not in ('save','transfer','route_update','start','delete_route','edit_order','delete_order','extend') then raise exception 'AUDIT_RECEIPT_INVALID'; end if;
  -- Extract only three fixed scalar UUIDs, with no payload/result snapshot.
  if jsonb_typeof(NEW.payload->'order_id')='string' and (NEW.payload->>'order_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_order := (NEW.payload->>'order_id')::uuid; end if;
  if jsonb_typeof(NEW.payload->'route_id')='string' and (NEW.payload->>'route_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_route := (NEW.payload->>'route_id')::uuid; end if;
  if jsonb_typeof(NEW.payload->'destination_id')='string' and (NEW.payload->>'destination_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_destination := (NEW.payload->>'destination_id')::uuid; end if;
  v_after := jsonb_build_object('actor',NEW.actor,'request',NEW.request,'created_at',NEW.created_at,'operation',v_operation,'epoch',NEW.epoch,'order_id',v_order,'route_id',v_route,'destination_id',v_destination)||case when v_operation='extend' then jsonb_build_object('reason','continuing_work','order_count',coalesce(NEW.result->'order_count','1'::jsonb)) else '{}'::jsonb end;
  perform audit_private.append_event('lifecycle_private','requests',NEW.actor::text||':'||NEW.request::text,'INSERT','committed_operation',null,v_after,array['actor','request','created_at','operation','epoch','order_id','route_id','destination_id']::text[] || case when v_operation='extend' then array['reason','order_count']::text[] else '{}'::text[] end,'{}'::jsonb,'{}'::text[],v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','lifecycle_private.requests',TG_OP,SQLSTATE;
 end;
 return null;
end $$;

create or replace function audit_private.reference_table(p_source text,p_field text) returns text
language sql immutable set search_path=pg_catalog as $$
 select case p_field
 when 'team_id' then 'teams' when 'worker_id' then 'workers' when 'leader_id' then 'workers'
 when 'order_id' then 'orders' when 'auto_checkout_route_id' then 'routes' when 'route_id' then 'routes' when 'destination_id' then 'routes'
 when 'invoice_id' then 'invoices' when 'service_id' then 'services'
 when 'user_id' then 'users' when 'actor' then 'users' when 'created_by' then 'users'
 when 'updated_by' then 'users' when 'performed_by' then 'users' when 'collected_by' then 'users'
 when 'approved_by' then 'users' when 'cancelled_by' then 'users' when 'role_id' then 'roles'
 when 'customer_id' then 'customers' when 'vault_id' then 'vaults'
 when 'custody_id' then 'custody_accounts' when 'custody_account_id' then 'custody_accounts'
 when 'advance_id' then 'salary_advances' when 'payroll_item_id' then 'payroll_items'
 when 'period_id' then 'payroll_periods' when 'payroll_period_id' then 'payroll_periods'
 when 'expense_id' then 'expenses'
 when 'confirmed_by' then 'users' when 'modified_by' then 'users' when 'disbursed_by' then 'users'
 when 'caller_id' then 'users' when 'callee_id' then 'users' when 'conversation_id' then 'conversations'
 when 'target_vault_id' then 'vaults' when 'target_custody_id' then 'custody_accounts'
 when 'category_id' then case when p_source='expenses' then 'expense_categories' when p_source='services' then 'service_categories' end
 end
$$;

CREATE OR REPLACE FUNCTION public.lifecycle_snapshot(p_kind text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'lifecycle_private'
AS $function$ declare v_result jsonb; v_team uuid; begin
 perform pg_advisory_xact_lock(61006,1);
 if p_kind in ('route','extend') then
  select team_id into v_team from public.routes where id=p_id;
  perform lifecycle_private.assert_actor('routes','read',v_team);
  if p_kind='extend' then
   perform lifecycle_private.assert_extension_actor(v_team);
   perform lifecycle_private.assert_extension_leader(v_team);
  end if;
  v_result:=case when p_kind='extend' then lifecycle_private.extension_snapshot(p_id) else lifecycle_private.route_snapshot(p_id) end;
 elsif p_kind in ('order','edit_order') then
  select team_id into v_team from public.orders where id=p_id;
  perform lifecycle_private.assert_actor('orders','read',v_team);
  v_result:=case when p_kind='edit_order' then lifecycle_private.edit_snapshot(p_id) else lifecycle_private.order_snapshot(p_id) end;
 else raise exception 'LC_INVALID'; end if;
 if v_result is null then raise exception 'LC_NOT_FOUND'; end if;
 return v_result;
end $function$
;

CREATE OR REPLACE FUNCTION public.lifecycle_mutate(p_request uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'lifecycle_private'
AS $function$
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
 if v_op not in ('save','transfer','route_update','start','delete_route','edit_order','delete_order','extend') then raise exception 'LC_INVALID'; end if;
 if jsonb_typeof(p_payload->'expected') is distinct from 'object' then raise exception 'LC_INVALID'; end if;
 if v_op='extend' and p_payload ? 'additions' and jsonb_typeof(p_payload->'additions') is distinct from 'array' then raise exception 'LC_INVALID'; end if;
 if v_op='extend' then perform lifecycle_private.assert_extension_actor((select team_id from public.routes where id=v_route)); end if;
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
  if v_op in ('save','transfer','extend') or (v_op='route_update' and p_payload->'data' ? 'team_id') then
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
  or (v_op='extend' and id in(select (value->>'order_id')::uuid from jsonb_array_elements(coalesce(p_payload->'additions','[]'::jsonb))))
  or id in(select (value->>'order_id')::uuid from jsonb_array_elements(coalesce(p_payload->'desired','[]'::jsonb))) order by id for update;
 perform 1 from public.order_items where order_id=v_order order by id for update;
 if v_op in ('edit_order','delete_order') then
  if lifecycle_private.edit_snapshot(v_order) is distinct from p_payload->'expected' then raise exception 'LC_CONFLICT'; end if;
 elsif v_op='start' then
  if lifecycle_private.order_snapshot(v_order) is distinct from p_payload->'expected' then raise exception 'LC_CONFLICT'; end if;
 elsif v_op='extend' then
  if lifecycle_private.extension_snapshot(v_route) is distinct from p_payload->'expected' then raise exception 'LC_CONFLICT'; end if;
 else
  if lifecycle_private.route_snapshot(v_route) is distinct from p_payload->'expected' then raise exception 'LC_CONFLICT'; end if;
  if v_to is not null and lifecycle_private.route_snapshot(v_to) is distinct from p_payload->'destination_expected' then raise exception 'LC_CONFLICT'; end if;
 end if;
 insert into lifecycle_private.context(backend,transaction,operation,order_id) values(pg_backend_pid(),txid_current(),v_op,v_order);
 if v_op='extend' then
  v_result:=lifecycle_private.extend_route(v_route,v_order,p_payload);
 elsif v_op='delete_order' then
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
 if v_op='extend' and not exists(select 1 from audit_private.events where transaction_id=pg_current_xact_id()::text and database_generation=(select generation from audit_private.config where singleton) and actor_id=v_actor and table_schema='lifecycle_private' and table_name='requests' and after_values->>'request'=p_request::text and after_values->>'operation'='extend') then raise exception 'LC_EXTENSION_AUDIT'; end if;
 delete from lifecycle_private.context where backend=pg_backend_pid() and transaction=txid_current();
 return v_result;
end $function$
;

-- Existing public lifecycle wrappers are owned by postgres; private callees must
-- share that owner rather than broadening EXECUTE to application roles.
alter function lifecycle_private.extension_snapshot(uuid) owner to postgres;
alter function lifecycle_private.assert_extension_actor(uuid) owner to postgres;
alter function lifecycle_private.assert_extension_leader(uuid) owner to postgres;
alter function lifecycle_private.extend_route(uuid,uuid,jsonb) owner to postgres;
alter function lifecycle_private.guard_attendance_checkout() owner to postgres;
commit;
