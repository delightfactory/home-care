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

create function audit_private.capture_advance_installments() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."advance_id" is distinct from NEW."advance_id" then 'advance_id' end,case when OLD."month" is distinct from NEW."month" then 'month' end,case when OLD."year" is distinct from NEW."year" then 'year' end,case when OLD."amount" is distinct from NEW."amount" then 'amount' end,case when OLD."status" is distinct from NEW."status" then 'status' end,case when OLD."payroll_item_id" is distinct from NEW."payroll_item_id" then 'payroll_item_id' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','advance_id','month','year','amount','status','payroll_item_id']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'advance_id',OLD."advance_id",'month',OLD."month",'year',OLD."year",'amount',OLD."amount",'status',left(OLD."status"::text,160),'payroll_item_id',OLD."payroll_item_id"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'advance_id',NEW."advance_id",'month',NEW."month",'year',NEW."year",'amount',NEW."amount",'status',left(NEW."status"::text,160),'payroll_item_id',NEW."payroll_item_id"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."status"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."status"::text)>160) then 'status' end]::text[],null);
  perform audit_private.append_event('public','advance_installments',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.advance_installments',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_advance_installments() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."advance_installments" for each row execute function audit_private.capture_advance_installments();


create function audit_private.capture_app_settings() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."key" is distinct from NEW."key" then 'key' end]::text[],null);
   v_markers := jsonb_build_object('value_changed',OLD."value" is distinct from NEW."value");
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['key']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('key',left(OLD."key"::text,160)); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('key',left(NEW."key"::text,160)); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."key"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."key"::text)>160) then 'key' end]::text[],null);
  perform audit_private.append_event('public','app_settings','key-sha256:'||encode(sha256(convert_to(case when TG_OP='DELETE' then OLD.key else NEW.key end,'UTF8')),'hex'),TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.app_settings',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_app_settings() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."app_settings" for each row execute function audit_private.capture_app_settings();


create function audit_private.capture_attendance_records() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."worker_id" is distinct from NEW."worker_id" then 'worker_id' end,case when OLD."date" is distinct from NEW."date" then 'date' end,case when OLD."check_in_time" is distinct from NEW."check_in_time" then 'check_in_time' end,case when OLD."check_out_time" is distinct from NEW."check_out_time" then 'check_out_time' end,case when OLD."check_in_method" is distinct from NEW."check_in_method" then 'check_in_method' end,case when OLD."check_out_method" is distinct from NEW."check_out_method" then 'check_out_method' end,case when OLD."status" is distinct from NEW."status" then 'status' end,case when OLD."work_hours" is distinct from NEW."work_hours" then 'work_hours' end,case when OLD."modified_by" is distinct from NEW."modified_by" then 'modified_by' end,case when OLD."late_minutes" is distinct from NEW."late_minutes" then 'late_minutes' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','worker_id','date','check_in_time','check_out_time','check_in_method','check_out_method','status','work_hours','modified_by','late_minutes']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'worker_id',OLD."worker_id",'date',OLD."date",'check_in_time',OLD."check_in_time",'check_out_time',OLD."check_out_time",'check_in_method',left(OLD."check_in_method"::text,160),'check_out_method',left(OLD."check_out_method"::text,160),'status',left(OLD."status"::text,160),'work_hours',OLD."work_hours",'modified_by',OLD."modified_by",'late_minutes',OLD."late_minutes"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'worker_id',NEW."worker_id",'date',NEW."date",'check_in_time',NEW."check_in_time",'check_out_time',NEW."check_out_time",'check_in_method',left(NEW."check_in_method"::text,160),'check_out_method',left(NEW."check_out_method"::text,160),'status',left(NEW."status"::text,160),'work_hours',NEW."work_hours",'modified_by',NEW."modified_by",'late_minutes',NEW."late_minutes"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."check_in_method"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."check_in_method"::text)>160) then 'check_in_method' end,case when (TG_OP <> 'INSERT' and char_length(OLD."check_out_method"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."check_out_method"::text)>160) then 'check_out_method' end,case when (TG_OP <> 'INSERT' and char_length(OLD."status"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."status"::text)>160) then 'status' end]::text[],null);
  perform audit_private.append_event('public','attendance_records',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.attendance_records',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_attendance_records() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."attendance_records" for each row execute function audit_private.capture_attendance_records();


create function audit_private.capture_call_logs() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."caller_id" is distinct from NEW."caller_id" then 'caller_id' end,case when OLD."callee_id" is distinct from NEW."callee_id" then 'callee_id' end,case when OLD."duration_seconds" is distinct from NEW."duration_seconds" then 'duration_seconds' end,case when OLD."status" is distinct from NEW."status" then 'status' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','caller_id','callee_id','duration_seconds','status']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'caller_id',OLD."caller_id",'callee_id',OLD."callee_id",'duration_seconds',OLD."duration_seconds",'status',left(OLD."status"::text,160)); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'caller_id',NEW."caller_id",'callee_id',NEW."callee_id",'duration_seconds',NEW."duration_seconds",'status',left(NEW."status"::text,160)); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."status"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."status"::text)>160) then 'status' end]::text[],null);
  perform audit_private.append_event('public','call_logs',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.call_logs',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_call_logs() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."call_logs" for each row execute function audit_private.capture_call_logs();


create function audit_private.capture_company_locations() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."name" is distinct from NEW."name" then 'name' end,case when OLD."name_ar" is distinct from NEW."name_ar" then 'name_ar' end,case when OLD."radius_meters" is distinct from NEW."radius_meters" then 'radius_meters' end,case when OLD."is_active" is distinct from NEW."is_active" then 'is_active' end,case when OLD."work_start_time" is distinct from NEW."work_start_time" then 'work_start_time' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','name','name_ar','radius_meters','is_active','work_start_time']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'name',left(OLD."name"::text,160),'name_ar',left(OLD."name_ar"::text,160),'radius_meters',OLD."radius_meters",'is_active',OLD."is_active",'work_start_time',OLD."work_start_time"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'name',left(NEW."name"::text,160),'name_ar',left(NEW."name_ar"::text,160),'radius_meters',NEW."radius_meters",'is_active',NEW."is_active",'work_start_time',NEW."work_start_time"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."name"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name"::text)>160) then 'name' end,case when (TG_OP <> 'INSERT' and char_length(OLD."name_ar"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name_ar"::text)>160) then 'name_ar' end]::text[],null);
  perform audit_private.append_event('public','company_locations',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.company_locations',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_company_locations() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."company_locations" for each row execute function audit_private.capture_company_locations();


create function audit_private.capture_conversation_participants() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."conversation_id" is distinct from NEW."conversation_id" then 'conversation_id' end,case when OLD."user_id" is distinct from NEW."user_id" then 'user_id' end,case when OLD."role" is distinct from NEW."role" then 'role' end,case when OLD."is_muted" is distinct from NEW."is_muted" then 'is_muted' end,case when OLD."muted_until" is distinct from NEW."muted_until" then 'muted_until' end,case when OLD."is_active" is distinct from NEW."is_active" then 'is_active' end,case when OLD."left_at" is distinct from NEW."left_at" then 'left_at' end,case when OLD."joined_at" is distinct from NEW."joined_at" then 'joined_at' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','conversation_id','user_id','role','is_muted','muted_until','is_active','left_at','joined_at']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'conversation_id',OLD."conversation_id",'user_id',OLD."user_id",'role',left(OLD."role"::text,160),'is_muted',OLD."is_muted",'muted_until',OLD."muted_until",'is_active',OLD."is_active",'left_at',OLD."left_at",'joined_at',OLD."joined_at"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'conversation_id',NEW."conversation_id",'user_id',NEW."user_id",'role',left(NEW."role"::text,160),'is_muted',NEW."is_muted",'muted_until',NEW."muted_until",'is_active',NEW."is_active",'left_at',NEW."left_at",'joined_at',NEW."joined_at"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."role"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."role"::text)>160) then 'role' end]::text[],null);
  perform audit_private.append_event('public','conversation_participants',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.conversation_participants',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_conversation_participants() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."conversation_participants" for each row execute function audit_private.capture_conversation_participants();


create function audit_private.capture_conversations() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."type" is distinct from NEW."type" then 'type' end,case when OLD."team_id" is distinct from NEW."team_id" then 'team_id' end,case when OLD."target_role" is distinct from NEW."target_role" then 'target_role' end,case when OLD."target_all" is distinct from NEW."target_all" then 'target_all' end,case when OLD."created_by" is distinct from NEW."created_by" then 'created_by' end,case when OLD."is_active" is distinct from NEW."is_active" then 'is_active' end,case when OLD."is_pinned" is distinct from NEW."is_pinned" then 'is_pinned' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','type','team_id','target_role','target_all','created_by','is_active','is_pinned']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'type',left(OLD."type"::text,160),'team_id',OLD."team_id",'target_role',left(OLD."target_role"::text,160),'target_all',OLD."target_all",'created_by',OLD."created_by",'is_active',OLD."is_active",'is_pinned',OLD."is_pinned"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'type',left(NEW."type"::text,160),'team_id',NEW."team_id",'target_role',left(NEW."target_role"::text,160),'target_all',NEW."target_all",'created_by',NEW."created_by",'is_active',NEW."is_active",'is_pinned',NEW."is_pinned"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."type"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."type"::text)>160) then 'type' end,case when (TG_OP <> 'INSERT' and char_length(OLD."target_role"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."target_role"::text)>160) then 'target_role' end]::text[],null);
  perform audit_private.append_event('public','conversations',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.conversations',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_conversations() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."conversations" for each row execute function audit_private.capture_conversations();


create function audit_private.capture_custody_accounts() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."user_id" is distinct from NEW."user_id" then 'user_id' end,case when OLD."holder_type" is distinct from NEW."holder_type" then 'holder_type' end,case when OLD."team_id" is distinct from NEW."team_id" then 'team_id' end,case when OLD."balance" is distinct from NEW."balance" then 'balance' end,case when OLD."is_active" is distinct from NEW."is_active" then 'is_active' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','user_id','holder_type','team_id','balance','is_active']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'user_id',OLD."user_id",'holder_type',left(OLD."holder_type"::text,160),'team_id',OLD."team_id",'balance',OLD."balance",'is_active',OLD."is_active"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'user_id',NEW."user_id",'holder_type',left(NEW."holder_type"::text,160),'team_id',NEW."team_id",'balance',NEW."balance",'is_active',NEW."is_active"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."holder_type"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."holder_type"::text)>160) then 'holder_type' end]::text[],null);
  perform audit_private.append_event('public','custody_accounts',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.custody_accounts',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_custody_accounts() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."custody_accounts" for each row execute function audit_private.capture_custody_accounts();


create function audit_private.capture_custody_transactions() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."custody_id" is distinct from NEW."custody_id" then 'custody_id' end,case when OLD."type" is distinct from NEW."type" then 'type' end,case when OLD."amount" is distinct from NEW."amount" then 'amount' end,case when OLD."balance_after" is distinct from NEW."balance_after" then 'balance_after' end,case when OLD."target_custody_id" is distinct from NEW."target_custody_id" then 'target_custody_id' end,case when OLD."target_vault_id" is distinct from NEW."target_vault_id" then 'target_vault_id' end,case when OLD."reference_type" is distinct from NEW."reference_type" then 'reference_type' end,case when OLD."reference_id" is distinct from NEW."reference_id" then 'reference_id' end,case when OLD."performed_by" is distinct from NEW."performed_by" then 'performed_by' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','custody_id','type','amount','balance_after','target_custody_id','target_vault_id','reference_type','reference_id','performed_by']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'custody_id',OLD."custody_id",'type',left(OLD."type"::text,160),'amount',OLD."amount",'balance_after',OLD."balance_after",'target_custody_id',OLD."target_custody_id",'target_vault_id',OLD."target_vault_id",'reference_type',left(OLD."reference_type"::text,160),'reference_id',OLD."reference_id",'performed_by',OLD."performed_by"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'custody_id',NEW."custody_id",'type',left(NEW."type"::text,160),'amount',NEW."amount",'balance_after',NEW."balance_after",'target_custody_id',NEW."target_custody_id",'target_vault_id',NEW."target_vault_id",'reference_type',left(NEW."reference_type"::text,160),'reference_id',NEW."reference_id",'performed_by',NEW."performed_by"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."type"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."type"::text)>160) then 'type' end,case when (TG_OP <> 'INSERT' and char_length(OLD."reference_type"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."reference_type"::text)>160) then 'reference_type' end]::text[],null);
  perform audit_private.append_event('public','custody_transactions',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.custody_transactions',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_custody_transactions() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."custody_transactions" for each row execute function audit_private.capture_custody_transactions();


create function audit_private.capture_customer_surveys() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."order_id" is distinct from NEW."order_id" then 'order_id' end,case when OLD."service_quality_rating" is distinct from NEW."service_quality_rating" then 'service_quality_rating' end,case when OLD."staff_professionalism_rating" is distinct from NEW."staff_professionalism_rating" then 'staff_professionalism_rating' end,case when OLD."punctuality_rating" is distinct from NEW."punctuality_rating" then 'punctuality_rating' end,case when OLD."cleanliness_rating" is distinct from NEW."cleanliness_rating" then 'cleanliness_rating' end,case when OLD."value_for_money_rating" is distinct from NEW."value_for_money_rating" then 'value_for_money_rating' end,case when OLD."overall_rating" is distinct from NEW."overall_rating" then 'overall_rating' end,case when OLD."would_recommend" is distinct from NEW."would_recommend" then 'would_recommend' end,case when OLD."submitted_at" is distinct from NEW."submitted_at" then 'submitted_at' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','order_id','service_quality_rating','staff_professionalism_rating','punctuality_rating','cleanliness_rating','value_for_money_rating','overall_rating','would_recommend','submitted_at']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'order_id',OLD."order_id",'service_quality_rating',OLD."service_quality_rating",'staff_professionalism_rating',OLD."staff_professionalism_rating",'punctuality_rating',OLD."punctuality_rating",'cleanliness_rating',OLD."cleanliness_rating",'value_for_money_rating',OLD."value_for_money_rating",'overall_rating',OLD."overall_rating",'would_recommend',OLD."would_recommend",'submitted_at',OLD."submitted_at"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'order_id',NEW."order_id",'service_quality_rating',NEW."service_quality_rating",'staff_professionalism_rating',NEW."staff_professionalism_rating",'punctuality_rating',NEW."punctuality_rating",'cleanliness_rating',NEW."cleanliness_rating",'value_for_money_rating',NEW."value_for_money_rating",'overall_rating',NEW."overall_rating",'would_recommend',NEW."would_recommend",'submitted_at',NEW."submitted_at"); end if;
  v_redacted := '{}'::text[];
  perform audit_private.append_event('public','customer_surveys',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.customer_surveys',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_customer_surveys() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."customer_surveys" for each row execute function audit_private.capture_customer_surveys();


create function audit_private.capture_customers() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."name" is distinct from NEW."name" then 'name' end,case when OLD."area" is distinct from NEW."area" then 'area' end,case when OLD."is_active" is distinct from NEW."is_active" then 'is_active' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','name','area','is_active']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'name',left(OLD."name"::text,160),'area',left(OLD."area"::text,160),'is_active',OLD."is_active"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'name',left(NEW."name"::text,160),'area',left(NEW."area"::text,160),'is_active',NEW."is_active"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."name"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name"::text)>160) then 'name' end,case when (TG_OP <> 'INSERT' and char_length(OLD."area"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."area"::text)>160) then 'area' end]::text[],null);
  perform audit_private.append_event('public','customers',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.customers',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_customers() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."customers" for each row execute function audit_private.capture_customers();


create function audit_private.capture_expense_categories() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."name" is distinct from NEW."name" then 'name' end,case when OLD."name_ar" is distinct from NEW."name_ar" then 'name_ar' end,case when OLD."requires_approval" is distinct from NEW."requires_approval" then 'requires_approval' end,case when OLD."approval_limit" is distinct from NEW."approval_limit" then 'approval_limit' end,case when OLD."is_active" is distinct from NEW."is_active" then 'is_active' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','name','name_ar','requires_approval','approval_limit','is_active']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'name',left(OLD."name"::text,160),'name_ar',left(OLD."name_ar"::text,160),'requires_approval',OLD."requires_approval",'approval_limit',OLD."approval_limit",'is_active',OLD."is_active"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'name',left(NEW."name"::text,160),'name_ar',left(NEW."name_ar"::text,160),'requires_approval',NEW."requires_approval",'approval_limit',NEW."approval_limit",'is_active',NEW."is_active"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."name"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name"::text)>160) then 'name' end,case when (TG_OP <> 'INSERT' and char_length(OLD."name_ar"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name_ar"::text)>160) then 'name_ar' end]::text[],null);
  perform audit_private.append_event('public','expense_categories',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.expense_categories',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_expense_categories() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."expense_categories" for each row execute function audit_private.capture_expense_categories();


create function audit_private.capture_expenses() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."category_id" is distinct from NEW."category_id" then 'category_id' end,case when OLD."order_id" is distinct from NEW."order_id" then 'order_id' end,case when OLD."route_id" is distinct from NEW."route_id" then 'route_id' end,case when OLD."team_id" is distinct from NEW."team_id" then 'team_id' end,case when OLD."amount" is distinct from NEW."amount" then 'amount' end,case when OLD."status" is distinct from NEW."status" then 'status' end,case when OLD."approved_by" is distinct from NEW."approved_by" then 'approved_by' end,case when OLD."approved_at" is distinct from NEW."approved_at" then 'approved_at' end,case when OLD."created_by" is distinct from NEW."created_by" then 'created_by' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','category_id','order_id','route_id','team_id','amount','status','approved_by','approved_at','created_by']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'category_id',OLD."category_id",'order_id',OLD."order_id",'route_id',OLD."route_id",'team_id',OLD."team_id",'amount',OLD."amount",'status',left(OLD."status"::text,160),'approved_by',OLD."approved_by",'approved_at',OLD."approved_at",'created_by',OLD."created_by"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'category_id',NEW."category_id",'order_id',NEW."order_id",'route_id',NEW."route_id",'team_id',NEW."team_id",'amount',NEW."amount",'status',left(NEW."status"::text,160),'approved_by',NEW."approved_by",'approved_at',NEW."approved_at",'created_by',NEW."created_by"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."status"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."status"::text)>160) then 'status' end]::text[],null);
  perform audit_private.append_event('public','expenses',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.expenses',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_expenses() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."expenses" for each row execute function audit_private.capture_expenses();


create function audit_private.capture_hr_adjustments() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."worker_id" is distinct from NEW."worker_id" then 'worker_id' end,case when OLD."type" is distinct from NEW."type" then 'type' end,case when OLD."amount" is distinct from NEW."amount" then 'amount' end,case when OLD."date" is distinct from NEW."date" then 'date' end,case when OLD."payroll_item_id" is distinct from NEW."payroll_item_id" then 'payroll_item_id' end,case when OLD."is_processed" is distinct from NEW."is_processed" then 'is_processed' end,case when OLD."created_by" is distinct from NEW."created_by" then 'created_by' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','worker_id','type','amount','date','payroll_item_id','is_processed','created_by']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'worker_id',OLD."worker_id",'type',left(OLD."type"::text,160),'amount',OLD."amount",'date',OLD."date",'payroll_item_id',OLD."payroll_item_id",'is_processed',OLD."is_processed",'created_by',OLD."created_by"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'worker_id',NEW."worker_id",'type',left(NEW."type"::text,160),'amount',NEW."amount",'date',NEW."date",'payroll_item_id',NEW."payroll_item_id",'is_processed',NEW."is_processed",'created_by',NEW."created_by"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."type"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."type"::text)>160) then 'type' end]::text[],null);
  perform audit_private.append_event('public','hr_adjustments',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.hr_adjustments',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_hr_adjustments() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."hr_adjustments" for each row execute function audit_private.capture_hr_adjustments();


create function audit_private.capture_invoice_items() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."invoice_id" is distinct from NEW."invoice_id" then 'invoice_id' end,case when OLD."service_id" is distinct from NEW."service_id" then 'service_id' end,case when OLD."quantity" is distinct from NEW."quantity" then 'quantity' end,case when OLD."unit_price" is distinct from NEW."unit_price" then 'unit_price' end,case when OLD."total_price" is distinct from NEW."total_price" then 'total_price' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','invoice_id','service_id','quantity','unit_price','total_price']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'invoice_id',OLD."invoice_id",'service_id',OLD."service_id",'quantity',OLD."quantity",'unit_price',OLD."unit_price",'total_price',OLD."total_price"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'invoice_id',NEW."invoice_id",'service_id',NEW."service_id",'quantity',NEW."quantity",'unit_price',NEW."unit_price",'total_price',NEW."total_price"); end if;
  v_redacted := '{}'::text[];
  perform audit_private.append_event('public','invoice_items',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.invoice_items',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_invoice_items() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."invoice_items" for each row execute function audit_private.capture_invoice_items();


create function audit_private.capture_invoices() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."invoice_number" is distinct from NEW."invoice_number" then 'invoice_number' end,case when OLD."order_id" is distinct from NEW."order_id" then 'order_id' end,case when OLD."customer_id" is distinct from NEW."customer_id" then 'customer_id' end,case when OLD."team_id" is distinct from NEW."team_id" then 'team_id' end,case when OLD."subtotal" is distinct from NEW."subtotal" then 'subtotal' end,case when OLD."discount" is distinct from NEW."discount" then 'discount' end,case when OLD."total_amount" is distinct from NEW."total_amount" then 'total_amount' end,case when OLD."paid_amount" is distinct from NEW."paid_amount" then 'paid_amount' end,case when OLD."status" is distinct from NEW."status" then 'status' end,case when OLD."payment_method" is distinct from NEW."payment_method" then 'payment_method' end,case when OLD."collected_by" is distinct from NEW."collected_by" then 'collected_by' end,case when OLD."collected_at" is distinct from NEW."collected_at" then 'collected_at' end,case when OLD."cancelled_by" is distinct from NEW."cancelled_by" then 'cancelled_by' end,case when OLD."cancelled_at" is distinct from NEW."cancelled_at" then 'cancelled_at' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','invoice_number','order_id','customer_id','team_id','subtotal','discount','total_amount','paid_amount','status','payment_method','collected_by','collected_at','cancelled_by','cancelled_at']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'invoice_number',left(OLD."invoice_number"::text,160),'order_id',OLD."order_id",'customer_id',OLD."customer_id",'team_id',OLD."team_id",'subtotal',OLD."subtotal",'discount',OLD."discount",'total_amount',OLD."total_amount",'paid_amount',OLD."paid_amount",'status',left(OLD."status"::text,160),'payment_method',left(OLD."payment_method"::text,160),'collected_by',OLD."collected_by",'collected_at',OLD."collected_at",'cancelled_by',OLD."cancelled_by",'cancelled_at',OLD."cancelled_at"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'invoice_number',left(NEW."invoice_number"::text,160),'order_id',NEW."order_id",'customer_id',NEW."customer_id",'team_id',NEW."team_id",'subtotal',NEW."subtotal",'discount',NEW."discount",'total_amount',NEW."total_amount",'paid_amount',NEW."paid_amount",'status',left(NEW."status"::text,160),'payment_method',left(NEW."payment_method"::text,160),'collected_by',NEW."collected_by",'collected_at',NEW."collected_at",'cancelled_by',NEW."cancelled_by",'cancelled_at',NEW."cancelled_at"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."invoice_number"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."invoice_number"::text)>160) then 'invoice_number' end,case when (TG_OP <> 'INSERT' and char_length(OLD."status"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."status"::text)>160) then 'status' end,case when (TG_OP <> 'INSERT' and char_length(OLD."payment_method"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."payment_method"::text)>160) then 'payment_method' end]::text[],null);
  perform audit_private.append_event('public','invoices',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.invoices',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_invoices() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."invoices" for each row execute function audit_private.capture_invoices();


create function audit_private.capture_notification_preferences() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."user_id" is distinct from NEW."user_id" then 'user_id' end,case when OLD."in_app_enabled" is distinct from NEW."in_app_enabled" then 'in_app_enabled' end,case when OLD."push_enabled" is distinct from NEW."push_enabled" then 'push_enabled' end,case when OLD."quiet_hours_enabled" is distinct from NEW."quiet_hours_enabled" then 'quiet_hours_enabled' end,case when OLD."quiet_hours_start" is distinct from NEW."quiet_hours_start" then 'quiet_hours_start' end,case when OLD."quiet_hours_end" is distinct from NEW."quiet_hours_end" then 'quiet_hours_end' end]::text[],null);
   v_markers := jsonb_build_object('categories_changed',OLD."categories" is distinct from NEW."categories");
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','user_id','in_app_enabled','push_enabled','quiet_hours_enabled','quiet_hours_start','quiet_hours_end']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'user_id',OLD."user_id",'in_app_enabled',OLD."in_app_enabled",'push_enabled',OLD."push_enabled",'quiet_hours_enabled',OLD."quiet_hours_enabled",'quiet_hours_start',OLD."quiet_hours_start",'quiet_hours_end',OLD."quiet_hours_end"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'user_id',NEW."user_id",'in_app_enabled',NEW."in_app_enabled",'push_enabled',NEW."push_enabled",'quiet_hours_enabled',NEW."quiet_hours_enabled",'quiet_hours_start',NEW."quiet_hours_start",'quiet_hours_end',NEW."quiet_hours_end"); end if;
  v_redacted := '{}'::text[];
  perform audit_private.append_event('public','notification_preferences',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.notification_preferences',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_notification_preferences() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."notification_preferences" for each row execute function audit_private.capture_notification_preferences();


create function audit_private.capture_order_items() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."order_id" is distinct from NEW."order_id" then 'order_id' end,case when OLD."service_id" is distinct from NEW."service_id" then 'service_id' end,case when OLD."quantity" is distinct from NEW."quantity" then 'quantity' end,case when OLD."unit_price" is distinct from NEW."unit_price" then 'unit_price' end,case when OLD."total_price" is distinct from NEW."total_price" then 'total_price' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','order_id','service_id','quantity','unit_price','total_price']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'order_id',OLD."order_id",'service_id',OLD."service_id",'quantity',OLD."quantity",'unit_price',OLD."unit_price",'total_price',OLD."total_price"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'order_id',NEW."order_id",'service_id',NEW."service_id",'quantity',NEW."quantity",'unit_price',NEW."unit_price",'total_price',NEW."total_price"); end if;
  v_redacted := '{}'::text[];
  perform audit_private.append_event('public','order_items',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.order_items',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_order_items() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."order_items" for each row execute function audit_private.capture_order_items();


create function audit_private.capture_order_status_logs() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."order_id" is distinct from NEW."order_id" then 'order_id' end,case when OLD."status" is distinct from NEW."status" then 'status' end,case when OLD."created_by" is distinct from NEW."created_by" then 'created_by' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','order_id','status','created_by']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'order_id',OLD."order_id",'status',left(OLD."status"::text,160),'created_by',OLD."created_by"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'order_id',NEW."order_id",'status',left(NEW."status"::text,160),'created_by',NEW."created_by"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."status"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."status"::text)>160) then 'status' end]::text[],null);
  perform audit_private.append_event('public','order_status_logs',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.order_status_logs',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_order_status_logs() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."order_status_logs" for each row execute function audit_private.capture_order_status_logs();


create function audit_private.capture_order_workers() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."order_id" is distinct from NEW."order_id" then 'order_id' end,case when OLD."worker_id" is distinct from NEW."worker_id" then 'worker_id' end,case when OLD."team_id" is distinct from NEW."team_id" then 'team_id' end,case when OLD."role" is distinct from NEW."role" then 'role' end,case when OLD."started_at" is distinct from NEW."started_at" then 'started_at' end,case when OLD."finished_at" is distinct from NEW."finished_at" then 'finished_at' end,case when OLD."customer_rating" is distinct from NEW."customer_rating" then 'customer_rating' end,case when OLD."performance_score" is distinct from NEW."performance_score" then 'performance_score' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','order_id','worker_id','team_id','role','started_at','finished_at','customer_rating','performance_score']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'order_id',OLD."order_id",'worker_id',OLD."worker_id",'team_id',OLD."team_id",'role',left(OLD."role"::text,160),'started_at',OLD."started_at",'finished_at',OLD."finished_at",'customer_rating',OLD."customer_rating",'performance_score',OLD."performance_score"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'order_id',NEW."order_id",'worker_id',NEW."worker_id",'team_id',NEW."team_id",'role',left(NEW."role"::text,160),'started_at',NEW."started_at",'finished_at',NEW."finished_at",'customer_rating',NEW."customer_rating",'performance_score',NEW."performance_score"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."role"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."role"::text)>160) then 'role' end]::text[],null);
  perform audit_private.append_event('public','order_workers',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.order_workers',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_order_workers() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."order_workers" for each row execute function audit_private.capture_order_workers();


create function audit_private.capture_orders() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  if TG_OP='UPDATE' then
   if OLD."id" is not distinct from NEW."id"
    and OLD."order_number" is not distinct from NEW."order_number"
    and OLD."customer_id" is not distinct from NEW."customer_id"
    and OLD."team_id" is not distinct from NEW."team_id"
    and OLD."scheduled_date" is not distinct from NEW."scheduled_date"
    and OLD."scheduled_time" is not distinct from NEW."scheduled_time"
    and OLD."status" is not distinct from NEW."status"
    and OLD."total_amount" is not distinct from NEW."total_amount"
    and OLD."transport_method" is not distinct from NEW."transport_method"
    and OLD."transport_cost" is not distinct from NEW."transport_cost"
    and OLD."payment_status" is not distinct from NEW."payment_status"
    and OLD."payment_method" is not distinct from NEW."payment_method"
    and OLD."customer_rating" is not distinct from NEW."customer_rating"
    and OLD."confirmation_status" is not distinct from NEW."confirmation_status"
    and OLD."confirmed_at" is not distinct from NEW."confirmed_at"
    and OLD."confirmed_by" is not distinct from NEW."confirmed_by" then return null; end if;
  end if;
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."order_number" is distinct from NEW."order_number" then 'order_number' end,case when OLD."customer_id" is distinct from NEW."customer_id" then 'customer_id' end,case when OLD."team_id" is distinct from NEW."team_id" then 'team_id' end,case when OLD."scheduled_date" is distinct from NEW."scheduled_date" then 'scheduled_date' end,case when OLD."scheduled_time" is distinct from NEW."scheduled_time" then 'scheduled_time' end,case when OLD."status" is distinct from NEW."status" then 'status' end,case when OLD."total_amount" is distinct from NEW."total_amount" then 'total_amount' end,case when OLD."transport_method" is distinct from NEW."transport_method" then 'transport_method' end,case when OLD."transport_cost" is distinct from NEW."transport_cost" then 'transport_cost' end,case when OLD."payment_status" is distinct from NEW."payment_status" then 'payment_status' end,case when OLD."payment_method" is distinct from NEW."payment_method" then 'payment_method' end,case when OLD."customer_rating" is distinct from NEW."customer_rating" then 'customer_rating' end,case when OLD."confirmation_status" is distinct from NEW."confirmation_status" then 'confirmation_status' end,case when OLD."confirmed_at" is distinct from NEW."confirmed_at" then 'confirmed_at' end,case when OLD."confirmed_by" is distinct from NEW."confirmed_by" then 'confirmed_by' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','order_number','customer_id','team_id','scheduled_date','scheduled_time','status','total_amount','transport_method','transport_cost','payment_status','payment_method','customer_rating','confirmation_status','confirmed_at','confirmed_by']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'order_number',left(OLD."order_number"::text,160),'customer_id',OLD."customer_id",'team_id',OLD."team_id",'scheduled_date',OLD."scheduled_date",'scheduled_time',OLD."scheduled_time",'status',left(OLD."status"::text,160),'total_amount',OLD."total_amount",'transport_method',left(OLD."transport_method"::text,160),'transport_cost',OLD."transport_cost",'payment_status',left(OLD."payment_status"::text,160),'payment_method',left(OLD."payment_method"::text,160),'customer_rating',OLD."customer_rating",'confirmation_status',left(OLD."confirmation_status"::text,160),'confirmed_at',OLD."confirmed_at",'confirmed_by',OLD."confirmed_by"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'order_number',left(NEW."order_number"::text,160),'customer_id',NEW."customer_id",'team_id',NEW."team_id",'scheduled_date',NEW."scheduled_date",'scheduled_time',NEW."scheduled_time",'status',left(NEW."status"::text,160),'total_amount',NEW."total_amount",'transport_method',left(NEW."transport_method"::text,160),'transport_cost',NEW."transport_cost",'payment_status',left(NEW."payment_status"::text,160),'payment_method',left(NEW."payment_method"::text,160),'customer_rating',NEW."customer_rating",'confirmation_status',left(NEW."confirmation_status"::text,160),'confirmed_at',NEW."confirmed_at",'confirmed_by',NEW."confirmed_by"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."order_number"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."order_number"::text)>160) then 'order_number' end,case when (TG_OP <> 'INSERT' and char_length(OLD."status"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."status"::text)>160) then 'status' end,case when (TG_OP <> 'INSERT' and char_length(OLD."transport_method"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."transport_method"::text)>160) then 'transport_method' end,case when (TG_OP <> 'INSERT' and char_length(OLD."payment_status"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."payment_status"::text)>160) then 'payment_status' end,case when (TG_OP <> 'INSERT' and char_length(OLD."payment_method"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."payment_method"::text)>160) then 'payment_method' end,case when (TG_OP <> 'INSERT' and char_length(OLD."confirmation_status"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."confirmation_status"::text)>160) then 'confirmation_status' end]::text[],null);
  perform audit_private.append_event('public','orders',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.orders',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_orders() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."orders" for each row execute function audit_private.capture_orders();


create function audit_private.capture_payroll_disbursements() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."payroll_period_id" is distinct from NEW."payroll_period_id" then 'payroll_period_id' end,case when OLD."vault_id" is distinct from NEW."vault_id" then 'vault_id' end,case when OLD."amount" is distinct from NEW."amount" then 'amount' end,case when OLD."expense_id" is distinct from NEW."expense_id" then 'expense_id' end,case when OLD."disbursed_by" is distinct from NEW."disbursed_by" then 'disbursed_by' end,case when OLD."worker_ids" is distinct from NEW."worker_ids" then 'worker_ids' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','payroll_period_id','vault_id','amount','expense_id','disbursed_by','worker_ids']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'payroll_period_id',OLD."payroll_period_id",'vault_id',OLD."vault_id",'amount',OLD."amount",'expense_id',OLD."expense_id",'disbursed_by',OLD."disbursed_by",'worker_ids',OLD."worker_ids"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'payroll_period_id',NEW."payroll_period_id",'vault_id',NEW."vault_id",'amount',NEW."amount",'expense_id',NEW."expense_id",'disbursed_by',NEW."disbursed_by",'worker_ids',NEW."worker_ids"); end if;
  v_redacted := '{}'::text[];
  perform audit_private.append_event('public','payroll_disbursements',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.payroll_disbursements',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_payroll_disbursements() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."payroll_disbursements" for each row execute function audit_private.capture_payroll_disbursements();


create function audit_private.capture_payroll_items() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."payroll_period_id" is distinct from NEW."payroll_period_id" then 'payroll_period_id' end,case when OLD."worker_id" is distinct from NEW."worker_id" then 'worker_id' end,case when OLD."base_salary" is distinct from NEW."base_salary" then 'base_salary' end,case when OLD."total_month_days" is distinct from NEW."total_month_days" then 'total_month_days' end,case when OLD."paid_leave_allowance" is distinct from NEW."paid_leave_allowance" then 'paid_leave_allowance' end,case when OLD."work_days" is distinct from NEW."work_days" then 'work_days' end,case when OLD."absent_days" is distinct from NEW."absent_days" then 'absent_days' end,case when OLD."leave_days" is distinct from NEW."leave_days" then 'leave_days' end,case when OLD."late_days" is distinct from NEW."late_days" then 'late_days' end,case when OLD."holiday_days" is distinct from NEW."holiday_days" then 'holiday_days' end,case when OLD."unpaid_absent_days" is distinct from NEW."unpaid_absent_days" then 'unpaid_absent_days' end,case when OLD."daily_rate" is distinct from NEW."daily_rate" then 'daily_rate' end,case when OLD."absence_deduction" is distinct from NEW."absence_deduction" then 'absence_deduction' end,case when OLD."calculated_bonus" is distinct from NEW."calculated_bonus" then 'calculated_bonus' end,case when OLD."manual_incentives" is distinct from NEW."manual_incentives" then 'manual_incentives' end,case when OLD."manual_deductions" is distinct from NEW."manual_deductions" then 'manual_deductions' end,case when OLD."manual_penalties" is distinct from NEW."manual_penalties" then 'manual_penalties' end,case when OLD."manual_bonuses" is distinct from NEW."manual_bonuses" then 'manual_bonuses' end,case when OLD."advance_deduction" is distinct from NEW."advance_deduction" then 'advance_deduction' end,case when OLD."net_salary" is distinct from NEW."net_salary" then 'net_salary' end,case when OLD."disbursed_amount" is distinct from NEW."disbursed_amount" then 'disbursed_amount' end,case when OLD."payment_status" is distinct from NEW."payment_status" then 'payment_status' end,case when OLD."effective_days" is distinct from NEW."effective_days" then 'effective_days' end,case when OLD."required_work_days" is distinct from NEW."required_work_days" then 'required_work_days' end,case when OLD."public_holiday_days" is distinct from NEW."public_holiday_days" then 'public_holiday_days' end,case when OLD."leave_balance" is distinct from NEW."leave_balance" then 'leave_balance' end,case when OLD."leave_used" is distinct from NEW."leave_used" then 'leave_used' end,case when OLD."late_penalty_days" is distinct from NEW."late_penalty_days" then 'late_penalty_days' end,case when OLD."late_penalty_amount" is distinct from NEW."late_penalty_amount" then 'late_penalty_amount' end,case when OLD."worker_start_date" is distinct from NEW."worker_start_date" then 'worker_start_date' end,case when OLD."worker_end_date" is distinct from NEW."worker_end_date" then 'worker_end_date' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','payroll_period_id','worker_id','base_salary','total_month_days','paid_leave_allowance','work_days','absent_days','leave_days','late_days','holiday_days','unpaid_absent_days','daily_rate','absence_deduction','calculated_bonus','manual_incentives','manual_deductions','manual_penalties','manual_bonuses','advance_deduction','net_salary','disbursed_amount','payment_status','effective_days','required_work_days','public_holiday_days','leave_balance','leave_used','late_penalty_days','late_penalty_amount','worker_start_date','worker_end_date']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'payroll_period_id',OLD."payroll_period_id",'worker_id',OLD."worker_id",'base_salary',OLD."base_salary",'total_month_days',OLD."total_month_days",'paid_leave_allowance',OLD."paid_leave_allowance",'work_days',OLD."work_days",'absent_days',OLD."absent_days",'leave_days',OLD."leave_days",'late_days',OLD."late_days",'holiday_days',OLD."holiday_days",'unpaid_absent_days',OLD."unpaid_absent_days",'daily_rate',OLD."daily_rate",'absence_deduction',OLD."absence_deduction",'calculated_bonus',OLD."calculated_bonus",'manual_incentives',OLD."manual_incentives",'manual_deductions',OLD."manual_deductions",'manual_penalties',OLD."manual_penalties",'manual_bonuses',OLD."manual_bonuses",'advance_deduction',OLD."advance_deduction",'net_salary',OLD."net_salary",'disbursed_amount',OLD."disbursed_amount",'payment_status',left(OLD."payment_status"::text,160),'effective_days',OLD."effective_days",'required_work_days',OLD."required_work_days",'public_holiday_days',OLD."public_holiday_days",'leave_balance',OLD."leave_balance",'leave_used',OLD."leave_used",'late_penalty_days',OLD."late_penalty_days",'late_penalty_amount',OLD."late_penalty_amount",'worker_start_date',OLD."worker_start_date",'worker_end_date',OLD."worker_end_date"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'payroll_period_id',NEW."payroll_period_id",'worker_id',NEW."worker_id",'base_salary',NEW."base_salary",'total_month_days',NEW."total_month_days",'paid_leave_allowance',NEW."paid_leave_allowance",'work_days',NEW."work_days",'absent_days',NEW."absent_days",'leave_days',NEW."leave_days",'late_days',NEW."late_days",'holiday_days',NEW."holiday_days",'unpaid_absent_days',NEW."unpaid_absent_days",'daily_rate',NEW."daily_rate",'absence_deduction',NEW."absence_deduction",'calculated_bonus',NEW."calculated_bonus",'manual_incentives',NEW."manual_incentives",'manual_deductions',NEW."manual_deductions",'manual_penalties',NEW."manual_penalties",'manual_bonuses',NEW."manual_bonuses",'advance_deduction',NEW."advance_deduction",'net_salary',NEW."net_salary",'disbursed_amount',NEW."disbursed_amount",'payment_status',left(NEW."payment_status"::text,160),'effective_days',NEW."effective_days",'required_work_days',NEW."required_work_days",'public_holiday_days',NEW."public_holiday_days",'leave_balance',NEW."leave_balance",'leave_used',NEW."leave_used",'late_penalty_days',NEW."late_penalty_days",'late_penalty_amount',NEW."late_penalty_amount",'worker_start_date',NEW."worker_start_date",'worker_end_date',NEW."worker_end_date"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."payment_status"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."payment_status"::text)>160) then 'payment_status' end]::text[],null);
  perform audit_private.append_event('public','payroll_items',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.payroll_items',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_payroll_items() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."payroll_items" for each row execute function audit_private.capture_payroll_items();


create function audit_private.capture_payroll_periods() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."month" is distinct from NEW."month" then 'month' end,case when OLD."year" is distinct from NEW."year" then 'year' end,case when OLD."status" is distinct from NEW."status" then 'status' end,case when OLD."total_salaries" is distinct from NEW."total_salaries" then 'total_salaries' end,case when OLD."total_incentives" is distinct from NEW."total_incentives" then 'total_incentives' end,case when OLD."total_deductions" is distinct from NEW."total_deductions" then 'total_deductions' end,case when OLD."total_penalties" is distinct from NEW."total_penalties" then 'total_penalties' end,case when OLD."total_bonuses" is distinct from NEW."total_bonuses" then 'total_bonuses' end,case when OLD."total_advances" is distinct from NEW."total_advances" then 'total_advances' end,case when OLD."total_absence_deductions" is distinct from NEW."total_absence_deductions" then 'total_absence_deductions' end,case when OLD."net_total" is distinct from NEW."net_total" then 'net_total' end,case when OLD."approved_by" is distinct from NEW."approved_by" then 'approved_by' end,case when OLD."approved_at" is distinct from NEW."approved_at" then 'approved_at' end,case when OLD."expense_id" is distinct from NEW."expense_id" then 'expense_id' end,case when OLD."created_by" is distinct from NEW."created_by" then 'created_by' end,case when OLD."total_disbursed" is distinct from NEW."total_disbursed" then 'total_disbursed' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','month','year','status','total_salaries','total_incentives','total_deductions','total_penalties','total_bonuses','total_advances','total_absence_deductions','net_total','approved_by','approved_at','expense_id','created_by','total_disbursed']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'month',OLD."month",'year',OLD."year",'status',left(OLD."status"::text,160),'total_salaries',OLD."total_salaries",'total_incentives',OLD."total_incentives",'total_deductions',OLD."total_deductions",'total_penalties',OLD."total_penalties",'total_bonuses',OLD."total_bonuses",'total_advances',OLD."total_advances",'total_absence_deductions',OLD."total_absence_deductions",'net_total',OLD."net_total",'approved_by',OLD."approved_by",'approved_at',OLD."approved_at",'expense_id',OLD."expense_id",'created_by',OLD."created_by",'total_disbursed',OLD."total_disbursed"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'month',NEW."month",'year',NEW."year",'status',left(NEW."status"::text,160),'total_salaries',NEW."total_salaries",'total_incentives',NEW."total_incentives",'total_deductions',NEW."total_deductions",'total_penalties',NEW."total_penalties",'total_bonuses',NEW."total_bonuses",'total_advances',NEW."total_advances",'total_absence_deductions',NEW."total_absence_deductions",'net_total',NEW."net_total",'approved_by',NEW."approved_by",'approved_at',NEW."approved_at",'expense_id',NEW."expense_id",'created_by',NEW."created_by",'total_disbursed',NEW."total_disbursed"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."status"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."status"::text)>160) then 'status' end]::text[],null);
  perform audit_private.append_event('public','payroll_periods',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.payroll_periods',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_payroll_periods() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."payroll_periods" for each row execute function audit_private.capture_payroll_periods();


create function audit_private.capture_penalty_rules() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."name" is distinct from NEW."name" then 'name' end,case when OLD."name_ar" is distinct from NEW."name_ar" then 'name_ar' end,case when OLD."type" is distinct from NEW."type" then 'type' end,case when OLD."min_minutes" is distinct from NEW."min_minutes" then 'min_minutes' end,case when OLD."max_minutes" is distinct from NEW."max_minutes" then 'max_minutes' end,case when OLD."deduction_days" is distinct from NEW."deduction_days" then 'deduction_days' end,case when OLD."grace_count" is distinct from NEW."grace_count" then 'grace_count' end,case when OLD."is_active" is distinct from NEW."is_active" then 'is_active' end,case when OLD."sort_order" is distinct from NEW."sort_order" then 'sort_order' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','name','name_ar','type','min_minutes','max_minutes','deduction_days','grace_count','is_active','sort_order']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'name',left(OLD."name"::text,160),'name_ar',left(OLD."name_ar"::text,160),'type',left(OLD."type"::text,160),'min_minutes',OLD."min_minutes",'max_minutes',OLD."max_minutes",'deduction_days',OLD."deduction_days",'grace_count',OLD."grace_count",'is_active',OLD."is_active",'sort_order',OLD."sort_order"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'name',left(NEW."name"::text,160),'name_ar',left(NEW."name_ar"::text,160),'type',left(NEW."type"::text,160),'min_minutes',NEW."min_minutes",'max_minutes',NEW."max_minutes",'deduction_days',NEW."deduction_days",'grace_count',NEW."grace_count",'is_active',NEW."is_active",'sort_order',NEW."sort_order"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."name"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name"::text)>160) then 'name' end,case when (TG_OP <> 'INSERT' and char_length(OLD."name_ar"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name_ar"::text)>160) then 'name_ar' end,case when (TG_OP <> 'INSERT' and char_length(OLD."type"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."type"::text)>160) then 'type' end]::text[],null);
  perform audit_private.append_event('public','penalty_rules',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.penalty_rules',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_penalty_rules() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."penalty_rules" for each row execute function audit_private.capture_penalty_rules();


create function audit_private.capture_public_holidays() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."name" is distinct from NEW."name" then 'name' end,case when OLD."date" is distinct from NEW."date" then 'date' end,case when OLD."year" is distinct from NEW."year" then 'year' end,case when OLD."is_active" is distinct from NEW."is_active" then 'is_active' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','name','date','year','is_active']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'name',left(OLD."name"::text,160),'date',OLD."date",'year',OLD."year",'is_active',OLD."is_active"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'name',left(NEW."name"::text,160),'date',NEW."date",'year',NEW."year",'is_active',NEW."is_active"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."name"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name"::text)>160) then 'name' end]::text[],null);
  perform audit_private.append_event('public','public_holidays',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.public_holidays',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_public_holidays() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."public_holidays" for each row execute function audit_private.capture_public_holidays();


create function audit_private.capture_roles() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."name" is distinct from NEW."name" then 'name' end,case when OLD."name_ar" is distinct from NEW."name_ar" then 'name_ar' end,case when OLD."is_active" is distinct from NEW."is_active" then 'is_active' end]::text[],null);
   v_markers := jsonb_build_object('permissions_changed',OLD."permissions" is distinct from NEW."permissions");
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','name','name_ar','is_active']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'name',left(OLD."name"::text,160),'name_ar',left(OLD."name_ar"::text,160),'is_active',OLD."is_active"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'name',left(NEW."name"::text,160),'name_ar',left(NEW."name_ar"::text,160),'is_active',NEW."is_active"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."name"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name"::text)>160) then 'name' end,case when (TG_OP <> 'INSERT' and char_length(OLD."name_ar"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name_ar"::text)>160) then 'name_ar' end]::text[],null);
  perform audit_private.append_event('public','roles',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.roles',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_roles() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."roles" for each row execute function audit_private.capture_roles();


create function audit_private.capture_route_orders() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."route_id" is distinct from NEW."route_id" then 'route_id' end,case when OLD."order_id" is distinct from NEW."order_id" then 'order_id' end,case when OLD."sequence_order" is distinct from NEW."sequence_order" then 'sequence_order' end,case when OLD."estimated_arrival_time" is distinct from NEW."estimated_arrival_time" then 'estimated_arrival_time' end,case when OLD."actual_arrival_time" is distinct from NEW."actual_arrival_time" then 'actual_arrival_time' end,case when OLD."estimated_completion_time" is distinct from NEW."estimated_completion_time" then 'estimated_completion_time' end,case when OLD."actual_completion_time" is distinct from NEW."actual_completion_time" then 'actual_completion_time' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','route_id','order_id','sequence_order','estimated_arrival_time','actual_arrival_time','estimated_completion_time','actual_completion_time']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'route_id',OLD."route_id",'order_id',OLD."order_id",'sequence_order',OLD."sequence_order",'estimated_arrival_time',OLD."estimated_arrival_time",'actual_arrival_time',OLD."actual_arrival_time",'estimated_completion_time',OLD."estimated_completion_time",'actual_completion_time',OLD."actual_completion_time"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'route_id',NEW."route_id",'order_id',NEW."order_id",'sequence_order',NEW."sequence_order",'estimated_arrival_time',NEW."estimated_arrival_time",'actual_arrival_time',NEW."actual_arrival_time",'estimated_completion_time',NEW."estimated_completion_time",'actual_completion_time',NEW."actual_completion_time"); end if;
  v_redacted := '{}'::text[];
  perform audit_private.append_event('public','route_orders',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.route_orders',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_route_orders() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."route_orders" for each row execute function audit_private.capture_route_orders();


create function audit_private.capture_routes() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."name" is distinct from NEW."name" then 'name' end,case when OLD."date" is distinct from NEW."date" then 'date' end,case when OLD."team_id" is distinct from NEW."team_id" then 'team_id' end,case when OLD."start_time" is distinct from NEW."start_time" then 'start_time' end,case when OLD."estimated_end_time" is distinct from NEW."estimated_end_time" then 'estimated_end_time' end,case when OLD."actual_start_time" is distinct from NEW."actual_start_time" then 'actual_start_time' end,case when OLD."actual_end_time" is distinct from NEW."actual_end_time" then 'actual_end_time' end,case when OLD."status" is distinct from NEW."status" then 'status' end,case when OLD."total_distance" is distinct from NEW."total_distance" then 'total_distance' end,case when OLD."total_estimated_time" is distinct from NEW."total_estimated_time" then 'total_estimated_time' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','name','date','team_id','start_time','estimated_end_time','actual_start_time','actual_end_time','status','total_distance','total_estimated_time']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'name',left(OLD."name"::text,160),'date',OLD."date",'team_id',OLD."team_id",'start_time',OLD."start_time",'estimated_end_time',OLD."estimated_end_time",'actual_start_time',OLD."actual_start_time",'actual_end_time',OLD."actual_end_time",'status',left(OLD."status"::text,160),'total_distance',OLD."total_distance",'total_estimated_time',OLD."total_estimated_time"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'name',left(NEW."name"::text,160),'date',NEW."date",'team_id',NEW."team_id",'start_time',NEW."start_time",'estimated_end_time',NEW."estimated_end_time",'actual_start_time',NEW."actual_start_time",'actual_end_time',NEW."actual_end_time",'status',left(NEW."status"::text,160),'total_distance',NEW."total_distance",'total_estimated_time',NEW."total_estimated_time"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."name"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name"::text)>160) then 'name' end,case when (TG_OP <> 'INSERT' and char_length(OLD."status"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."status"::text)>160) then 'status' end]::text[],null);
  perform audit_private.append_event('public','routes',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.routes',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_routes() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."routes" for each row execute function audit_private.capture_routes();


create function audit_private.capture_salary_advances() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."worker_id" is distinct from NEW."worker_id" then 'worker_id' end,case when OLD."advance_type" is distinct from NEW."advance_type" then 'advance_type' end,case when OLD."total_amount" is distinct from NEW."total_amount" then 'total_amount' end,case when OLD."installments_count" is distinct from NEW."installments_count" then 'installments_count' end,case when OLD."installment_amount" is distinct from NEW."installment_amount" then 'installment_amount' end,case when OLD."remaining_amount" is distinct from NEW."remaining_amount" then 'remaining_amount' end,case when OLD."start_month" is distinct from NEW."start_month" then 'start_month' end,case when OLD."start_year" is distinct from NEW."start_year" then 'start_year' end,case when OLD."status" is distinct from NEW."status" then 'status' end,case when OLD."approved_by" is distinct from NEW."approved_by" then 'approved_by' end,case when OLD."created_by" is distinct from NEW."created_by" then 'created_by' end,case when OLD."vault_id" is distinct from NEW."vault_id" then 'vault_id' end,case when OLD."custody_id" is distinct from NEW."custody_id" then 'custody_id' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','worker_id','advance_type','total_amount','installments_count','installment_amount','remaining_amount','start_month','start_year','status','approved_by','created_by','vault_id','custody_id']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'worker_id',OLD."worker_id",'advance_type',left(OLD."advance_type"::text,160),'total_amount',OLD."total_amount",'installments_count',OLD."installments_count",'installment_amount',OLD."installment_amount",'remaining_amount',OLD."remaining_amount",'start_month',OLD."start_month",'start_year',OLD."start_year",'status',left(OLD."status"::text,160),'approved_by',OLD."approved_by",'created_by',OLD."created_by",'vault_id',OLD."vault_id",'custody_id',OLD."custody_id"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'worker_id',NEW."worker_id",'advance_type',left(NEW."advance_type"::text,160),'total_amount',NEW."total_amount",'installments_count',NEW."installments_count",'installment_amount',NEW."installment_amount",'remaining_amount',NEW."remaining_amount",'start_month',NEW."start_month",'start_year',NEW."start_year",'status',left(NEW."status"::text,160),'approved_by',NEW."approved_by",'created_by',NEW."created_by",'vault_id',NEW."vault_id",'custody_id',NEW."custody_id"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."advance_type"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."advance_type"::text)>160) then 'advance_type' end,case when (TG_OP <> 'INSERT' and char_length(OLD."status"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."status"::text)>160) then 'status' end]::text[],null);
  perform audit_private.append_event('public','salary_advances',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.salary_advances',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_salary_advances() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."salary_advances" for each row execute function audit_private.capture_salary_advances();


create function audit_private.capture_service_categories() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."name" is distinct from NEW."name" then 'name' end,case when OLD."name_ar" is distinct from NEW."name_ar" then 'name_ar' end,case when OLD."is_active" is distinct from NEW."is_active" then 'is_active' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','name','name_ar','is_active']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'name',left(OLD."name"::text,160),'name_ar',left(OLD."name_ar"::text,160),'is_active',OLD."is_active"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'name',left(NEW."name"::text,160),'name_ar',left(NEW."name_ar"::text,160),'is_active',NEW."is_active"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."name"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name"::text)>160) then 'name' end,case when (TG_OP <> 'INSERT' and char_length(OLD."name_ar"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name_ar"::text)>160) then 'name_ar' end]::text[],null);
  perform audit_private.append_event('public','service_categories',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.service_categories',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_service_categories() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."service_categories" for each row execute function audit_private.capture_service_categories();


create function audit_private.capture_services() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."category_id" is distinct from NEW."category_id" then 'category_id' end,case when OLD."name" is distinct from NEW."name" then 'name' end,case when OLD."name_ar" is distinct from NEW."name_ar" then 'name_ar' end,case when OLD."price" is distinct from NEW."price" then 'price' end,case when OLD."unit" is distinct from NEW."unit" then 'unit' end,case when OLD."estimated_duration" is distinct from NEW."estimated_duration" then 'estimated_duration' end,case when OLD."is_active" is distinct from NEW."is_active" then 'is_active' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','category_id','name','name_ar','price','unit','estimated_duration','is_active']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'category_id',OLD."category_id",'name',left(OLD."name"::text,160),'name_ar',left(OLD."name_ar"::text,160),'price',OLD."price",'unit',left(OLD."unit"::text,160),'estimated_duration',OLD."estimated_duration",'is_active',OLD."is_active"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'category_id',NEW."category_id",'name',left(NEW."name"::text,160),'name_ar',left(NEW."name_ar"::text,160),'price',NEW."price",'unit',left(NEW."unit"::text,160),'estimated_duration',NEW."estimated_duration",'is_active',NEW."is_active"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."name"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name"::text)>160) then 'name' end,case when (TG_OP <> 'INSERT' and char_length(OLD."name_ar"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name_ar"::text)>160) then 'name_ar' end,case when (TG_OP <> 'INSERT' and char_length(OLD."unit"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."unit"::text)>160) then 'unit' end]::text[],null);
  perform audit_private.append_event('public','services',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.services',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_services() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."services" for each row execute function audit_private.capture_services();


create function audit_private.capture_system_settings() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."key" is distinct from NEW."key" then 'key' end,case when OLD."updated_by" is distinct from NEW."updated_by" then 'updated_by' end]::text[],null);
   v_markers := jsonb_build_object('value_changed',OLD."value" is distinct from NEW."value");
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','key','updated_by']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'key',left(OLD."key"::text,160),'updated_by',OLD."updated_by"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'key',left(NEW."key"::text,160),'updated_by',NEW."updated_by"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."key"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."key"::text)>160) then 'key' end]::text[],null);
  perform audit_private.append_event('public','system_settings',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.system_settings',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_system_settings() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."system_settings" for each row execute function audit_private.capture_system_settings();


create function audit_private.capture_team_members() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."team_id" is distinct from NEW."team_id" then 'team_id' end,case when OLD."worker_id" is distinct from NEW."worker_id" then 'worker_id' end,case when OLD."joined_at" is distinct from NEW."joined_at" then 'joined_at' end,case when OLD."left_at" is distinct from NEW."left_at" then 'left_at' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','team_id','worker_id','joined_at','left_at']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'team_id',OLD."team_id",'worker_id',OLD."worker_id",'joined_at',OLD."joined_at",'left_at',OLD."left_at"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'team_id',NEW."team_id",'worker_id',NEW."worker_id",'joined_at',NEW."joined_at",'left_at',NEW."left_at"); end if;
  v_redacted := '{}'::text[];
  perform audit_private.append_event('public','team_members',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.team_members',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_team_members() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."team_members" for each row execute function audit_private.capture_team_members();


create function audit_private.capture_teams() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."name" is distinct from NEW."name" then 'name' end,case when OLD."leader_id" is distinct from NEW."leader_id" then 'leader_id' end,case when OLD."is_active" is distinct from NEW."is_active" then 'is_active' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','name','leader_id','is_active']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'name',left(OLD."name"::text,160),'leader_id',OLD."leader_id",'is_active',OLD."is_active"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'name',left(NEW."name"::text,160),'leader_id',NEW."leader_id",'is_active',NEW."is_active"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."name"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name"::text)>160) then 'name' end]::text[],null);
  perform audit_private.append_event('public','teams',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.teams',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_teams() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."teams" for each row execute function audit_private.capture_teams();


create function audit_private.capture_users() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."role_id" is distinct from NEW."role_id" then 'role_id' end,case when OLD."full_name" is distinct from NEW."full_name" then 'full_name' end,case when OLD."is_active" is distinct from NEW."is_active" then 'is_active' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','role_id','full_name','is_active']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'role_id',OLD."role_id",'full_name',left(OLD."full_name"::text,160),'is_active',OLD."is_active"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'role_id',NEW."role_id",'full_name',left(NEW."full_name"::text,160),'is_active',NEW."is_active"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."full_name"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."full_name"::text)>160) then 'full_name' end]::text[],null);
  perform audit_private.append_event('public','users',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.users',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_users() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."users" for each row execute function audit_private.capture_users();


create function audit_private.capture_vault_transactions() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."vault_id" is distinct from NEW."vault_id" then 'vault_id' end,case when OLD."target_vault_id" is distinct from NEW."target_vault_id" then 'target_vault_id' end,case when OLD."type" is distinct from NEW."type" then 'type' end,case when OLD."amount" is distinct from NEW."amount" then 'amount' end,case when OLD."balance_after" is distinct from NEW."balance_after" then 'balance_after' end,case when OLD."reference_type" is distinct from NEW."reference_type" then 'reference_type' end,case when OLD."reference_id" is distinct from NEW."reference_id" then 'reference_id' end,case when OLD."performed_by" is distinct from NEW."performed_by" then 'performed_by' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','vault_id','target_vault_id','type','amount','balance_after','reference_type','reference_id','performed_by']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'vault_id',OLD."vault_id",'target_vault_id',OLD."target_vault_id",'type',left(OLD."type"::text,160),'amount',OLD."amount",'balance_after',OLD."balance_after",'reference_type',left(OLD."reference_type"::text,160),'reference_id',OLD."reference_id",'performed_by',OLD."performed_by"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'vault_id',NEW."vault_id",'target_vault_id',NEW."target_vault_id",'type',left(NEW."type"::text,160),'amount',NEW."amount",'balance_after',NEW."balance_after",'reference_type',left(NEW."reference_type"::text,160),'reference_id',NEW."reference_id",'performed_by',NEW."performed_by"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."type"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."type"::text)>160) then 'type' end,case when (TG_OP <> 'INSERT' and char_length(OLD."reference_type"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."reference_type"::text)>160) then 'reference_type' end]::text[],null);
  perform audit_private.append_event('public','vault_transactions',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.vault_transactions',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_vault_transactions() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."vault_transactions" for each row execute function audit_private.capture_vault_transactions();


create function audit_private.capture_vaults() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."name" is distinct from NEW."name" then 'name' end,case when OLD."name_ar" is distinct from NEW."name_ar" then 'name_ar' end,case when OLD."type" is distinct from NEW."type" then 'type' end,case when OLD."balance" is distinct from NEW."balance" then 'balance' end,case when OLD."is_active" is distinct from NEW."is_active" then 'is_active' end,case when OLD."created_by" is distinct from NEW."created_by" then 'created_by' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','name','name_ar','type','balance','is_active','created_by']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'name',left(OLD."name"::text,160),'name_ar',left(OLD."name_ar"::text,160),'type',left(OLD."type"::text,160),'balance',OLD."balance",'is_active',OLD."is_active",'created_by',OLD."created_by"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'name',left(NEW."name"::text,160),'name_ar',left(NEW."name_ar"::text,160),'type',left(NEW."type"::text,160),'balance',NEW."balance",'is_active',NEW."is_active",'created_by',NEW."created_by"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."name"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name"::text)>160) then 'name' end,case when (TG_OP <> 'INSERT' and char_length(OLD."name_ar"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name_ar"::text)>160) then 'name_ar' end,case when (TG_OP <> 'INSERT' and char_length(OLD."type"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."type"::text)>160) then 'type' end]::text[],null);
  perform audit_private.append_event('public','vaults',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.vaults',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_vaults() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."vaults" for each row execute function audit_private.capture_vaults();


create function audit_private.capture_voice_calls() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."caller_id" is distinct from NEW."caller_id" then 'caller_id' end,case when OLD."callee_id" is distinct from NEW."callee_id" then 'callee_id' end,case when OLD."status" is distinct from NEW."status" then 'status' end,case when OLD."answered_at" is distinct from NEW."answered_at" then 'answered_at' end,case when OLD."ended_at" is distinct from NEW."ended_at" then 'ended_at' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','caller_id','callee_id','status','answered_at','ended_at']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'caller_id',OLD."caller_id",'callee_id',OLD."callee_id",'status',left(OLD."status"::text,160),'answered_at',OLD."answered_at",'ended_at',OLD."ended_at"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'caller_id',NEW."caller_id",'callee_id',NEW."callee_id",'status',left(NEW."status"::text,160),'answered_at',NEW."answered_at",'ended_at',NEW."ended_at"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."status"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."status"::text)>160) then 'status' end]::text[],null);
  perform audit_private.append_event('public','voice_calls',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.voice_calls',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_voice_calls() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."voice_calls" for each row execute function audit_private.capture_voice_calls();


create function audit_private.capture_workers() returns trigger
language plpgsql security definer set search_path=pg_catalog,audit_private as $$
declare v_before jsonb; v_after jsonb; v_changed text[]; v_markers jsonb := '{}'::jsonb; v_redacted text[]; v_enabled boolean; v_generation uuid;
begin
 -- Catch only this capture block: business exceptions outside it remain business exceptions.
 begin
  lock table audit_private.config in access share mode nowait;
  select enabled,generation into v_enabled,v_generation from audit_private.config where singleton;
  if v_enabled is not true then return null; end if;
  if TG_OP='UPDATE' then
   v_changed := array_remove(array[case when OLD."id" is distinct from NEW."id" then 'id' end,case when OLD."user_id" is distinct from NEW."user_id" then 'user_id' end,case when OLD."name" is distinct from NEW."name" then 'name' end,case when OLD."hire_date" is distinct from NEW."hire_date" then 'hire_date' end,case when OLD."salary" is distinct from NEW."salary" then 'salary' end,case when OLD."can_drive" is distinct from NEW."can_drive" then 'can_drive' end,case when OLD."status" is distinct from NEW."status" then 'status' end,case when OLD."rating" is distinct from NEW."rating" then 'rating' end,case when OLD."total_orders" is distinct from NEW."total_orders" then 'total_orders' end,case when OLD."paid_leave_days" is distinct from NEW."paid_leave_days" then 'paid_leave_days' end,case when OLD."termination_date" is distinct from NEW."termination_date" then 'termination_date' end]::text[],null);
   v_markers := '{}'::jsonb;
   if cardinality(v_changed)=0 and not exists(select 1 from jsonb_each(v_markers) x where x.value='true'::jsonb) then return null; end if;
  else v_changed := array['id','user_id','name','hire_date','salary','can_drive','status','rating','total_orders','paid_leave_days','termination_date']::text[]; end if;
  -- Build the same allowlisted snapshots only after proving a relevant change.
  -- Nested business triggers can touch a row without changing audited fields.
  if TG_OP <> 'INSERT' then v_before := jsonb_build_object('id',OLD."id",'user_id',OLD."user_id",'name',left(OLD."name"::text,160),'hire_date',OLD."hire_date",'salary',OLD."salary",'can_drive',OLD."can_drive",'status',left(OLD."status"::text,160),'rating',OLD."rating",'total_orders',OLD."total_orders",'paid_leave_days',OLD."paid_leave_days",'termination_date',OLD."termination_date"); end if;
  if TG_OP <> 'DELETE' then v_after := jsonb_build_object('id',NEW."id",'user_id',NEW."user_id",'name',left(NEW."name"::text,160),'hire_date',NEW."hire_date",'salary',NEW."salary",'can_drive',NEW."can_drive",'status',left(NEW."status"::text,160),'rating',NEW."rating",'total_orders',NEW."total_orders",'paid_leave_days',NEW."paid_leave_days",'termination_date',NEW."termination_date"); end if;
  v_redacted := array_remove(array[case when (TG_OP <> 'INSERT' and char_length(OLD."name"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."name"::text)>160) then 'name' end,case when (TG_OP <> 'INSERT' and char_length(OLD."status"::text)>160) or (TG_OP <> 'DELETE' and char_length(NEW."status"::text)>160) then 'status' end]::text[],null);
  perform audit_private.append_event('public','workers',case when TG_OP='DELETE' then OLD.id::text else NEW.id::text end,TG_OP,'committed_change',v_before,v_after,v_changed,v_markers,v_redacted,v_generation);
 exception when others then
  raise warning 'AUDIT_CAPTURE_GAP table=% operation=% sqlstate=%','public.workers',TG_OP,SQLSTATE;
 end;
 return null;
end $$;
revoke all on function audit_private.capture_workers() from public,anon,authenticated,service_role;
create trigger audit_v3_capture after insert or update or delete on "public"."workers" for each row execute function audit_private.capture_workers();

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

create function public.admin_audit_list(
 p_from timestamptz default null,p_to timestamptz default null,p_table text default null,
 p_actor uuid default null,p_entity text default null,p_kind text default null,p_transaction text default null,
 p_cursor_at timestamptz default null,p_cursor_id uuid default null,p_limit integer default 50,p_generation uuid default null,
 p_from_day date default null,p_to_day date default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,audit_private as $$
declare v_limit integer:=greatest(1,least(coalesce(p_limit,50),100)); v_rows jsonb; v_next jsonb;
 v_table_schema text; v_table_name text; v_separator integer; v_transaction_generation uuid; v_transaction_id text;
begin
 perform audit_private.assert_admin();
 if (p_cursor_at is null)<>(p_cursor_id is null) then raise exception 'AUDIT_INVALID_CURSOR'; end if;
 if p_from is not null and p_to is not null and p_from>p_to then raise exception 'AUDIT_INVALID_RANGE'; end if;
 if p_from_day is not null and p_to_day is not null and p_from_day>p_to_day then raise exception 'AUDIT_INVALID_RANGE'; end if;
 if (p_from_day is not null or p_to_day is not null) and (p_from is not null or p_to is not null) then raise exception 'AUDIT_MIXED_DATE_RANGE'; end if;
 -- Parse after authorization and existing validation, preserving error precedence.
 -- Fixed capture sources have dot-free schema names. Keep case/whitespace exact;
 -- do not normalize text, trim tokens, or cast transaction IDs to numeric types.
 if p_table is not null then
  v_separator:=strpos(p_table,'.');
  if v_separator=0 then return jsonb_build_object('events','[]'::jsonb,'next_cursor',null); end if;
  v_table_schema:=left(p_table,v_separator-1);
  v_table_name:=substring(p_table from v_separator+1);
 end if;
 if p_transaction is not null then
  -- UUID::text emits canonical lower-case spelling; accepted UUID alternatives
  -- previously matched no row and must remain empty, without a cast exception.
  if left(p_transaction,37) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:$' then
   return jsonb_build_object('events','[]'::jsonb,'next_cursor',null);
  end if;
  v_transaction_generation:=left(p_transaction,36)::uuid;
  v_transaction_id:=substring(p_transaction from 38);
 end if;
 with page as (
  select e.*,left(u.full_name,160) as actor_name from audit_private.events e left join public.users u on u.id=e.actor_id
  where (p_from is null or e.occurred_at>=p_from) and (p_to is null or e.occurred_at<=p_to)
  and (p_from_day is null or e.occurred_at >= (p_from_day::timestamp at time zone 'Africa/Cairo'))
  and (p_to_day is null or e.occurred_at < ((p_to_day+1)::timestamp at time zone 'Africa/Cairo'))
  and (p_table is null or (e.table_schema=v_table_schema and e.table_name=v_table_name))
  and (p_actor is null or e.actor_id=p_actor) and (p_entity is null or e.entity_id=p_entity)
  and (p_kind is null or e.event_kind=p_kind or e.operation=p_kind) and (p_transaction is null or (e.database_generation=v_transaction_generation and e.transaction_id=v_transaction_id))
  and (p_generation is null or e.database_generation=p_generation)
  and (p_cursor_at is null or (e.occurred_at,e.id)<(p_cursor_at,p_cursor_id))
  order by e.occurred_at desc,e.id desc limit v_limit+1
 ), numbered as (select page.*,row_number() over(order by occurred_at desc,id desc) as n from page)
 select coalesce(jsonb_agg(to_jsonb(numbered)-'n' order by occurred_at desc,id desc) filter(where n<=v_limit),'[]'::jsonb),
 case when count(*)>v_limit then (jsonb_agg(jsonb_build_object('occurred_at',occurred_at,'id',id) order by occurred_at desc,id desc)->(v_limit-1)) else null end
 into v_rows,v_next from numbered;
 return jsonb_build_object('events',v_rows,'next_cursor',v_next);
end $$;
revoke all on function public.admin_audit_list(timestamptz,timestamptz,text,uuid,text,text,text,timestamptz,uuid,integer,uuid,date,date) from public,anon,authenticated,service_role;
grant execute on function public.admin_audit_list(timestamptz,timestamptz,text,uuid,text,text,text,timestamptz,uuid,integer,uuid,date,date) to authenticated;

create function public.admin_audit_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,audit_private as $$
declare v_result jsonb;
begin
 perform audit_private.assert_admin();
 select to_jsonb(e)||jsonb_build_object('actor_name',left(u.full_name,160)) into v_result from audit_private.events e left join public.users u on u.id=e.actor_id where e.id=p_id;
 return v_result;
end $$;
revoke all on function public.admin_audit_detail(uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_audit_detail(uuid) to authenticated;

create function public.admin_audit_coverage() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,audit_private as $$
declare v_result jsonb;
begin
 perform audit_private.assert_admin();
 select jsonb_build_object('enabled',c.enabled,'generation',c.generation,
 'sources',(select coalesce(jsonb_agg(jsonb_build_object('table',n.nspname||'.'||t.relname,'enabled',g.tgenabled in ('O','A')) order by n.nspname,t.relname),'[]'::jsonb)
 from pg_trigger g join pg_class t on t.oid=g.tgrelid join pg_namespace n on n.oid=t.relnamespace where g.tgname='audit_v3_capture' and not g.tgisinternal),
 'limitations',jsonb_build_array('Committed database changes only; rejected transactions leave no event.','Attributed user fields do not establish the caller.','Current actor name is not a historical identity snapshot.','Application Backup44 excludes this audit schema.','Capture gaps can occur during qualified faults; latest event does not prove completeness.','Full database restore rewinds audit to the backup point.','Unallowlisted fields are not captured; settings/permissions/categories use change markers only.'))
 into v_result from audit_private.config c where c.singleton;
 return v_result;
end $$;
revoke all on function public.admin_audit_coverage() from public,anon,authenticated,service_role;
grant execute on function public.admin_audit_coverage() to authenticated;


commit;
