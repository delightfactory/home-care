-- Isolated homecare_audit_readable_20261011 only. All synthetic fixtures roll back.
begin;
do $$ begin if current_database()<>'homecare_audit_readable_20261011' then raise exception 'ISOLATED_DATABASE_REQUIRED'; end if; end $$;
delete from audit_private.events where id in ('fa110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000002');
create temp table readable_fixture(id uuid);
insert into readable_fixture values ('fa110000-0000-4000-8000-000000000001'),('fa110000-0000-4000-8000-000000000002');
insert into audit_private.events(id,table_schema,table_name,entity_id,operation,event_kind,actor_id,actor_kind,transaction_id,database_generation,before_values,after_values,changed_fields)
select 'fa110000-0000-4000-8000-000000000001','public','routes','447b5000-0000-0000-0000-000000000001','UPDATE','committed_change',
'a2291000-0000-0000-0000-000000000001','authenticated','readable-fixture',generation,
'{"name":"اسم الخط وقت التغيير","team_id":"447b4000-0000-0000-0000-000000000001"}',
'{"name":"اسم الخط وقت التغيير","team_id":"447b4000-0000-0000-0000-000000000002"}',array['team_id'] from audit_private.config;
insert into audit_private.events(id,table_schema,table_name,entity_id,operation,event_kind,actor_kind,transaction_id,database_generation,before_values,after_values,changed_fields)
select 'fa110000-0000-4000-8000-000000000002','public','order_items','fa110000-0000-4000-8000-000000000099','DELETE','committed_change','system','readable-fixture',generation,
'{"order_id":"447b6000-0000-0000-0000-000000000001","service_id":"79000000-0000-4000-8000-000000000030","customer_id":"invalid-input"}',
null,array['order_id','service_id'] from audit_private.config;
create temp table evidence_before as select md5(string_agg(to_jsonb(e)::text,'' order by id)) fingerprint from audit_private.events e;
insert into audit_private.events(id,table_schema,table_name,entity_id,operation,event_kind,actor_kind,transaction_id,database_generation,before_values,after_values,changed_fields,payload_redacted)
select 'fa110000-0000-4000-8000-000000000003','public','routes','447b5000-0000-0000-0000-000000000001','UPDATE','committed_change','system','redacted-fixture',generation,null,null,array['team_id'],true from audit_private.config;
update evidence_before set fingerprint=(select md5(string_agg(to_jsonb(e)::text,'' order by id)) from audit_private.events e);
grant select on readable_fixture to authenticated;
select set_config('request.jwt.claim.sub','a2291000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ declare c jsonb; d jsonb; begin
 c:=public.admin_audit_context((select array_agg(id) from readable_fixture));
 if public.admin_audit_context(array['fa110000-0000-4000-8000-000000000003'::uuid]) <> '{"labels":{},"entities":{}}'::jsonb then raise exception 'REDACTED_PAYLOAD_RECONSTRUCTED'; end if;
 if c#>>'{labels,teams:447b4000-0000-0000-0000-000000000001,label}' <> 'QA Team'
  or c#>>'{labels,teams:447b4000-0000-0000-0000-000000000002,label}' <> 'QA Other Team' then raise exception 'OLD_NEW_TEAMS_NOT_RESOLVED'; end if;
 if c#>>'{labels,orders:447b6000-0000-0000-0000-000000000001,label}' <> 'QA-COMMIT-447b-1' then raise exception 'DELETED_ITEM_PARENT_NOT_RESOLVED'; end if;
 if c#>>'{labels,order_items:fa110000-0000-4000-8000-000000000099,found}' <> 'false' then raise exception 'DELETED_REFERENCE_NOT_EXPLICIT'; end if;
 if c->'labels' ? 'customers:invalid-input' then raise exception 'MALFORMED_REFERENCE_NOT_IGNORED'; end if;
 d:=public.admin_audit_detail('fa110000-0000-4000-8000-000000000001');
 if d#>>'{before_values,team_id}' <> '447b4000-0000-0000-0000-000000000001' then raise exception 'RAW_EVIDENCE_CHANGED'; end if;
 if public.admin_audit_context(array['fa110000-0000-4000-8000-000000000098'::uuid]) <> '{"labels":{},"entities":{}}'::jsonb then raise exception 'UNKNOWN_EVENT_LEAK'; end if;
 begin perform public.admin_audit_context(array_fill('fa110000-0000-4000-8000-000000000001'::uuid,array[101])); raise exception 'EXPECTED_LIMIT'; exception when others then if SQLERRM <> 'AUDIT_INVALID_CONTEXT' then raise; end if; end;
 begin perform public.admin_audit_context(array[null::uuid]); raise exception 'EXPECTED_INVALID'; exception when others then if SQLERRM <> 'AUDIT_INVALID_CONTEXT' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','447b1000-0000-0000-0000-000000000003',true);
do $$ begin
 begin perform public.admin_audit_context('{}'::uuid[]); raise exception 'NONADMIN_ACCEPTED'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.admin_audit_context('{}'::uuid[]); raise exception 'ANON_ACCEPTED'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if (select fingerprint from evidence_before) is distinct from (select md5(string_agg(to_jsonb(e)::text,'' order by id)) from audit_private.events e) then raise exception 'ENRICHMENT_WROTE_EVENTS'; end if;
end $$;
select 'PASS admin, old/new teams, deleted item parent, malformed key, limits, nonadmin, anon, raw evidence unchanged';
rollback;
begin read only;
select set_config('request.jwt.claim.sub','a2291000-0000-0000-0000-000000000001',true);
set local role authenticated;
select jsonb_object_length from (select count(*) jsonb_object_length from jsonb_each(public.admin_audit_context(array(select (value->>'id')::uuid from jsonb_array_elements(public.admin_audit_list(p_limit=>50)->'events')))->'labels')) e;
rollback;

