-- Synthetic QA only. No business rows changed; fixture events roll back.
begin;
do $$ begin if current_database()<>'homecare_audit_readable_20261011' then raise exception 'ISOLATED_DATABASE_REQUIRED'; end if; end $$;
create temp table readable_values_fixture as select
 (select id from public.workers order by id limit 1) worker,
 (select id from public.users order by id limit 1) user_id,
 (select id from public.payroll_periods order by id limit 1) period,
 (select id from public.vaults order by id limit 1) vault;
do $$ begin if exists(select 1 from readable_values_fixture where worker is null or user_id is null) then raise exception 'QA_FIXTURE_MISSING'; end if; end $$;
insert into audit_private.events(id,table_schema,table_name,entity_id,operation,event_kind,actor_kind,transaction_id,database_generation,before_values,after_values,changed_fields)
select 'fa120000-0000-4000-8000-000000000001','public','orders','fa120000-0000-4000-8000-000000000099','UPDATE','committed_change','system','readable-values',generation,
 jsonb_build_object('confirmed_by',user_id),jsonb_build_object('confirmed_by',user_id),array['confirmed_by'] from audit_private.config cross join readable_values_fixture;
insert into audit_private.events(id,table_schema,table_name,entity_id,operation,event_kind,actor_kind,transaction_id,database_generation,before_values,after_values,changed_fields)
select 'fa120000-0000-4000-8000-000000000002','public','payroll_disbursements','fa120000-0000-4000-8000-000000000098','INSERT','committed_change','system','readable-values',generation,null,
 jsonb_build_object('disbursed_by',user_id,'worker_ids',jsonb_build_array(worker,'invalid-value',null)),array['disbursed_by','worker_ids'] from audit_private.config cross join readable_values_fixture;
insert into audit_private.events(id,table_schema,table_name,entity_id,operation,event_kind,actor_kind,transaction_id,database_generation,before_values,after_values,changed_fields)
select 'fa120000-0000-4000-8000-000000000003','public','vault_transactions','fa120000-0000-4000-8000-000000000097','UPDATE','committed_change','system','readable-values',generation,
 jsonb_build_object('reference_type','payroll','reference_id','fa120000-0000-4000-8000-000000000096'),
 jsonb_build_object('reference_type','salary_advance','reference_id','fa120000-0000-4000-8000-000000000096'),array['reference_id','reference_type'] from audit_private.config;
insert into audit_private.events(id,table_schema,table_name,entity_id,operation,event_kind,actor_kind,transaction_id,database_generation,before_values,after_values,changed_fields,redacted_fields)
select 'fa120000-0000-4000-8000-000000000004','public','payroll_disbursements','fa120000-0000-4000-8000-000000000095','INSERT','committed_change','system','readable-values',generation,null,
 jsonb_build_object('worker_ids',jsonb_build_array(worker)),array['worker_ids'],array['worker_ids'] from audit_private.config cross join readable_values_fixture;
create temp table readable_values_fingerprint as select md5(string_agg(to_jsonb(e)::text,'' order by id)) fingerprint from audit_private.events e;
-- The worker list is bounded at 100, and the whole lookup rejects more than 4000 references.
insert into audit_private.events(id,table_schema,table_name,entity_id,operation,event_kind,actor_kind,transaction_id,database_generation,after_values,changed_fields)
select ('fa130000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'public','payroll_disbursements','bounded-synthetic','INSERT','committed_change','system','readable-values-bound',generation,
 jsonb_build_object('worker_ids',(select jsonb_agg('fa140000-0000-4000-8000-'||lpad(((n-1)*101+i)::text,12,'0')) from generate_series(1,101) i)),array['worker_ids']
from audit_private.config cross join generate_series(1,41) n;
update readable_values_fingerprint set fingerprint=(select md5(string_agg(to_jsonb(e)::text,'' order by id)) from audit_private.events e);
grant select on readable_values_fixture to authenticated;
select set_config('request.jwt.claim.sub','a2291000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ declare c jsonb; w text; u text; begin
 select worker::text,user_id::text into w,u from readable_values_fixture;
 c:=public.admin_audit_context(array['fa120000-0000-4000-8000-000000000001'::uuid,'fa120000-0000-4000-8000-000000000002'::uuid,'fa120000-0000-4000-8000-000000000003'::uuid]);
 if c#>>array['labels','users:'||u,'found'] <> 'true' then raise exception 'USER_NAMES_MISSING'; end if;
 if c#>>array['labels','workers:'||w,'found'] <> 'true' then raise exception 'WORKER_ARRAY_NOT_RESOLVED'; end if;
 if not ((c->'labels') ? 'payroll_periods:fa120000-0000-4000-8000-000000000096') or not ((c->'labels') ? 'salary_advances:fa120000-0000-4000-8000-000000000096') then raise exception 'POLYMORPHIC_BEFORE_AFTER_LOST'; end if;
 if c->'labels' ? 'workers:invalid-value' then raise exception 'INVALID_WORKER_REFERENCE'; end if;
 if public.admin_audit_context(array['fa120000-0000-4000-8000-000000000004'::uuid])->'labels' ? ('workers:'||w) then raise exception 'HIDDEN_WORKERS_RECONSTRUCTED'; end if;
end $$;
do $$ declare c jsonb; ids uuid[]; begin
 c:=public.admin_audit_context(array['fa130000-0000-4000-8000-000000000001'::uuid]);
 if (select count(*) from jsonb_object_keys(c->'labels'))<>100 or c->'labels' ? 'workers:fa140000-0000-4000-8000-000000000101' then raise exception 'WORKER_LIST_LIMIT_BROKEN'; end if;
 select array_agg(('fa130000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid) into ids from generate_series(1,41) n;
 begin
  perform public.admin_audit_context(ids);
  raise exception 'TOTAL_CONTEXT_LIMIT_NOT_ENFORCED';
 exception when others then
  if sqlerrm<>'AUDIT_CONTEXT_TOO_LARGE' then raise; end if;
 end;
end $$;
reset role;
do $$ begin if has_function_privilege('anon','public.admin_audit_context(uuid[])','execute') or has_function_privilege('authenticated','audit_private.reference_table(text,text)','execute') then raise exception 'PERMISSIONS_EXPANDED'; end if; end $$;
do $$ begin if (select fingerprint from readable_values_fingerprint) <> (select md5(string_agg(to_jsonb(e)::text,'' order by id)) from audit_private.events e) then raise exception 'EVIDENCE_MODIFIED'; end if; end $$;
select 'PASS user names, worker arrays, polymorphic before/after, redaction, privileges and immutable events';
rollback;
