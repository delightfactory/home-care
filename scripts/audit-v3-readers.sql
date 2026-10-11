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

