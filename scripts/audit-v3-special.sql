-- Only the existing committed receipt and changed recovery token are evidence.
create function audit_private.capture_requests() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_enabled boolean; v_generation uuid; v_operation text; v_order uuid; v_route uuid; v_destination uuid; v_after jsonb;
begin
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if jsonb_typeof(NEW.payload->'op') is distinct from 'string' then raise exception 'AUDIT_RECEIPT_INVALID'; end if;
  v_operation := NEW.payload->>'op';
  if v_operation not in ('save','transfer','route_update','start','delete_route','edit_order','delete_order') then raise exception 'AUDIT_RECEIPT_INVALID'; end if;
  -- Extract only three fixed scalar UUIDs, with no payload/result snapshot.
  if jsonb_typeof(NEW.payload->'order_id')='string' and (NEW.payload->>'order_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_order := (NEW.payload->>'order_id')::uuid; end if;
  if jsonb_typeof(NEW.payload->'route_id')='string' and (NEW.payload->>'route_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_route := (NEW.payload->>'route_id')::uuid; end if;
  if jsonb_typeof(NEW.payload->'destination_id')='string' and (NEW.payload->>'destination_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_destination := (NEW.payload->>'destination_id')::uuid; end if;
  v_after := jsonb_build_object('actor',NEW.actor,'request',NEW.request,'created_at',NEW.created_at,'operation',v_operation,'epoch',NEW.epoch,'order_id',v_order,'route_id',v_route,'destination_id',v_destination);
  perform audit_private.append_event('lifecycle_private','requests',NEW.actor::text||':'||NEW.request::text,'INSERT','committed_operation',null,v_after,array['actor','request','created_at','operation','epoch','order_id','route_id','destination_id']::text[],'{}'::jsonb,'{}'::text[],v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','lifecycle_private.requests',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_requests() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert on lifecycle_private.requests for each row execute function audit_private.capture_requests();

create function audit_private.capture_epoch() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_enabled boolean; v_generation uuid; v_changed text[];
begin
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true or OLD.token is not distinct from NEW.token then return null; end if;
  v_changed := array_remove(array['token',case when OLD.changed_at is distinct from NEW.changed_at then 'changed_at' end]::text[],null);
  perform audit_private.append_event('lifecycle_private','epoch','singleton','UPDATE','recovery_epoch_changed',jsonb_build_object('token',OLD.token,'changed_at',OLD.changed_at),jsonb_build_object('token',NEW.token,'changed_at',NEW.changed_at),v_changed,'{}'::jsonb,'{}'::text[],v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','lifecycle_private.epoch',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_epoch() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after update on lifecycle_private.epoch for each row execute function audit_private.capture_epoch();
