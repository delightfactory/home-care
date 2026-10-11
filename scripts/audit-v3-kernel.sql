-- Generated bounded V3 audit. No changes to business writers or lifecycle guards.
begin;
create schema audit_private;
revoke all on schema audit_private from public,anon,authenticated,service_role;
create table audit_private.config (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default true,
 generation uuid not null default gen_random_uuid()
);
insert into audit_private.config(singleton) values(true);
create table audit_private.events (
 id uuid primary key default gen_random_uuid(),
 occurred_at timestamptz not null default clock_timestamp(),
 table_schema text not null, table_name text not null, entity_id text not null,
 operation text not null check(operation in ('INSERT','UPDATE','DELETE')),
 event_kind text not null check(event_kind in ('committed_change','committed_operation','recovery_epoch_changed')),
 actor_id uuid, actor_kind text not null,
 transaction_id text not null, database_generation uuid not null,
 before_values jsonb, after_values jsonb, changed_fields text[] not null,
 change_markers jsonb not null default '{}'::jsonb,
 redacted_fields text[] not null default '{}', payload_redacted boolean not null default false,
 check(octet_length(jsonb_build_object('id',id,'occurred_at',occurred_at,'table_schema',table_schema,'table_name',table_name,'entity_id',entity_id,'operation',operation,'event_kind',event_kind,'actor_id',actor_id,'actor_kind',actor_kind,'transaction_id',transaction_id,'database_generation',database_generation,'before_values',before_values,'after_values',after_values,'changed_fields',changed_fields,'change_markers',change_markers,'redacted_fields',redacted_fields,'payload_redacted',payload_redacted)::text)<=16384)
);
create index audit_events_time on audit_private.events(occurred_at desc,id desc);
create index audit_events_entity on audit_private.events(table_schema,table_name,entity_id,occurred_at desc,id desc);
create index audit_events_actor on audit_private.events(actor_id,occurred_at desc,id desc);
create index audit_events_transaction on audit_private.events(database_generation,transaction_id,occurred_at desc,id desc);
alter table audit_private.config enable row level security;
alter table audit_private.events enable row level security;
revoke all on all tables in schema audit_private from public,anon,authenticated,service_role;

create function audit_private.append_event(p_schema text,p_table text,p_entity text,p_operation text,p_kind text,p_before jsonb,p_after jsonb,p_changed text[],p_markers jsonb,p_redacted text[],p_generation uuid)
returns void language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_actor uuid; v_kind text; v_role text; v_generation uuid:=p_generation; v_hidden boolean:=false;
 v_id uuid:=gen_random_uuid(); v_at timestamptz:=clock_timestamp(); v_transaction text:=pg_current_xact_id()::text; v_size integer;
begin
 -- NOWAIT protects ordinary writers from incompatible maintenance locks on audit.
 lock table audit_private.events in row exclusive mode nowait;
 -- The private wrapper holds the config lock and supplies its trusted generation.
 v_actor:=auth.uid();
 if v_actor is null then v_role:=auth.role(); end if;
 v_kind:=case when v_actor is not null then 'authenticated' when v_role='service_role' then 'service' when session_user in ('postgres','supabase_admin') then 'system' when v_role='anon' then 'anonymous' else 'unknown' end;
 -- Fixed-schema metadata overhead is proven <=6144 bytes in static tests.
 -- The exact stored CHECK remains authoritative; this conservative precheck avoids
 -- building/serializing the complete event twice for every ordinary business row.
 p_entity:=left(p_entity,160);
 v_size:=octet_length(coalesce(p_before::text,'null'))+octet_length(coalesce(p_after::text,'null'))+octet_length(p_markers::text)+6144;
 if v_size>16384 then
  p_before:=null; p_after:=null; v_hidden:=true;
 end if;
 insert into audit_private.events(id,occurred_at,table_schema,table_name,entity_id,operation,event_kind,actor_id,actor_kind,transaction_id,database_generation,before_values,after_values,changed_fields,change_markers,redacted_fields,payload_redacted)
 values(v_id,v_at,p_schema,p_table,p_entity,p_operation,p_kind,v_actor,v_kind,v_transaction,v_generation,p_before,p_after,p_changed,p_markers,p_redacted,v_hidden);
end $$;
revoke all on function audit_private.append_event(text,text,text,text,text,jsonb,jsonb,text[],jsonb,text[],uuid) from public,anon,authenticated,service_role;

create function audit_private.assert_admin() returns void
language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.users u join public.roles r on r.id=u.role_id
 where u.id=auth.uid() and u.is_active is true and r.is_active is true and r.permissions->'admin'='true'::jsonb)
 then raise exception 'AUDIT_DENIED' using errcode='42501'; end if;
end $$;
revoke all on function audit_private.assert_admin() from public,anon,authenticated,service_role;
