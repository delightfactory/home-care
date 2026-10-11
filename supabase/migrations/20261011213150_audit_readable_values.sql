-- Read-only enrichment. Existing capture triggers and reader contracts stay unchanged.
begin;
create or replace function audit_private.reference_table(p_source text,p_field text) returns text
language sql immutable set search_path=pg_catalog as $$
 select case p_field
 when 'team_id' then 'teams' when 'worker_id' then 'workers' when 'leader_id' then 'workers'
 when 'order_id' then 'orders' when 'route_id' then 'routes' when 'destination_id' then 'routes'
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
revoke all on function audit_private.reference_table(text,text) from public,anon,authenticated,service_role;
alter function audit_private.reference_table(text,text) owner to postgres;

create or replace function public.admin_audit_context(p_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,audit_private as $$
declare
 v_refs jsonb:='{}'; v_entities jsonb:='{}'; v_labels jsonb:='{}';
 v_event record; v_pair record; v_table text; v_key text; v_columns text; v_ids text[];
 v_rows jsonb; v_row jsonb; v_worker jsonb; v_ref jsonb; v_label text; v_pass integer;
 v_allowed text[]:=array['orders','order_items','order_status_logs','order_workers','routes','route_orders',
 'teams','team_members','workers','customers','services','service_categories','expense_categories',
 'users','roles','invoices','invoice_items','custody_accounts','custody_transactions','vaults','vault_transactions',
 'expenses','attendance_records','payroll_periods','payroll_items','payroll_disbursements','salary_advances',
 'advance_installments','hr_adjustments','public_holidays','penalty_rules','company_locations',
 'conversations','conversation_participants','call_logs','voice_calls','customer_surveys','notification_preferences'];
begin
 perform audit_private.assert_admin();
 if p_ids is null or cardinality(p_ids)>100 or array_position(p_ids,null) is not null then
  raise exception 'AUDIT_INVALID_CONTEXT';
 end if;
 -- Only stored events select lookup targets; the caller cannot request arbitrary rows/tables.
 for v_event in select * from audit_private.events where id=any(p_ids) loop
  -- Enrichment must never reconstruct a payload intentionally omitted by capture.
  if v_event.payload_redacted then continue; end if;
  if v_event.table_schema='public' and v_event.table_name=any(v_allowed)
   and v_event.entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   v_refs:=v_refs||jsonb_build_object(v_event.table_name||':'||v_event.entity_id,
    jsonb_build_object('table',v_event.table_name,'id',v_event.entity_id));
  end if;
  for v_row in select x from unnest(array[coalesce(v_event.before_values,'{}'),coalesce(v_event.after_values,'{}')]) x loop
   if v_event.table_name='payroll_disbursements' and not ('worker_ids'=any(v_event.redacted_fields)) and jsonb_typeof(v_row->'worker_ids')='array' then
    for v_worker in select value from jsonb_array_elements(v_row->'worker_ids') with ordinality a(value,n) where n<=100 loop
     if jsonb_typeof(v_worker)='string' and (v_worker#>>'{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_refs:=v_refs||jsonb_build_object('workers:'||(v_worker#>>'{}'),jsonb_build_object('table','workers','id',v_worker#>>'{}'));
     end if;
    end loop;
   end if;
   for v_pair in select key,value from jsonb_each(v_row) loop
    if v_pair.key=any(v_event.redacted_fields) then continue; end if;
    v_table:=audit_private.reference_table(v_event.table_name,v_pair.key);
    if v_pair.key='reference_id' and v_event.table_name in ('vault_transactions','custody_transactions') and not ('reference_type'=any(v_event.redacted_fields)) then
     v_table:=case v_row->>'reference_type' when 'invoice' then 'invoices' when 'expense' then 'expenses' when 'payroll' then 'payroll_periods' when 'salary_advance' then 'salary_advances' end;
    end if;
    if v_table is not null and jsonb_typeof(v_pair.value)='string'
     and (v_pair.value#>>'{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
     v_key:=v_table||':'||(v_pair.value#>>'{}');
     v_refs:=v_refs||jsonb_build_object(v_key,jsonb_build_object('table',v_table,'id',v_pair.value#>>'{}'));
    end if;
   end loop;
  end loop;
 end loop;
 -- Batched by allowlisted table, two levels resolve item -> invoice -> order.
 for v_pass in 1..3 loop
  if (select count(*) from jsonb_object_keys(v_refs))>4000 then raise exception 'AUDIT_CONTEXT_TOO_LARGE'; end if;
  for v_table in select distinct value->>'table' from jsonb_each(v_refs)
   where not v_entities ? key loop
   select array_agg(value->>'id') into v_ids from jsonb_each(v_refs)
    where value->>'table'=v_table and not v_entities ? key;
   -- Only display names/numbers and relationship keys, never complete rows or sensitive fields.
   select string_agg(format('%L,%I',column_name,column_name),',' order by ordinal_position)
    into v_columns from information_schema.columns where table_schema='public' and table_name=v_table
    and column_name=any(array['id','name','name_ar','full_name','order_number','invoice_number',
     'order_id','invoice_id','team_id','worker_id','service_id','route_id','user_id','leader_id',
     'customer_id','vault_id','custody_id','advance_id','period_id','payroll_period_id','payroll_item_id','month','year',
     'category_id','type','caller_id','callee_id','conversation_id','target_custody_id','target_vault_id']);
   if v_columns is null then continue; end if;
   execute format('select coalesce(jsonb_agg(jsonb_build_object(%s)),''[]''::jsonb) from public.%I where id=any($1::uuid[])',v_columns,v_table)
    into v_rows using v_ids;
   foreach v_key in array v_ids loop
    v_entities:=v_entities||jsonb_build_object(v_table||':'||v_key,null);
    v_labels:=v_labels||jsonb_build_object(v_table||':'||v_key,jsonb_build_object('label',null,'found',false));
   end loop;
   for v_row in select value from jsonb_array_elements(v_rows) loop
    v_key:=v_table||':'||(v_row->>'id');
    v_entities:=v_entities||jsonb_build_object(v_key,v_row);
    v_label:=coalesce(nullif(v_row->>'order_number',''),nullif(v_row->>'invoice_number',''),
     nullif(v_row->>'name_ar',''),nullif(v_row->>'full_name',''),nullif(v_row->>'name',''),
     case when v_table='payroll_periods' then (v_row->>'month')||' / '||(v_row->>'year') end);
    v_labels:=v_labels||jsonb_build_object(v_key,jsonb_build_object('label',left(v_label,160),'found',true));
    for v_pair in select key,value from jsonb_each(v_row) loop
     v_ref:=jsonb_build_object('table',audit_private.reference_table(v_table,v_pair.key),'id',v_pair.value#>>'{}');
     if v_ref->>'table' is not null and jsonb_typeof(v_pair.value)='string'
      and (v_ref->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_refs:=v_refs||jsonb_build_object((v_ref->>'table')||':'||(v_ref->>'id'),v_ref);
     end if;
    end loop;
   end loop;
  end loop;
 end loop;
 if (select count(*) from jsonb_object_keys(v_refs))>4000 then raise exception 'AUDIT_CONTEXT_TOO_LARGE'; end if;
 return jsonb_build_object('labels',v_labels,'entities',v_entities);
end $$;
revoke all on function public.admin_audit_context(uuid[]) from public,anon,authenticated,service_role;
alter function public.admin_audit_context(uuid[]) owner to postgres;
grant execute on function public.admin_audit_context(uuid[]) to authenticated;
commit;
