-- R1/R2 acceptance: isolated database only; all fixtures and faults roll back.
begin;
insert into auth.users(id) values('b1000000-0000-0000-0000-000000000001');
insert into public.users(id,role_id,full_name,is_active) select 'b1000000-0000-0000-0000-000000000001',id,'QA R1 Manager',true from public.roles where name='manager';
insert into public.customers(id,name,phone,address) values('b2000000-0000-0000-0000-000000000001','QA R1 Customer','r1-qa-customer','QA');
insert into public.orders(id,order_number,customer_id,scheduled_date,scheduled_time,status,total_amount) values
 ('b6000000-0000-0000-0000-000000000001','QA-R1-EDIT','b2000000-0000-0000-0000-000000000001',current_date,'10:00','pending',100),
 ('b6000000-0000-0000-0000-000000000002','QA-R1-DELETE','b2000000-0000-0000-0000-000000000001',current_date,'11:00','pending',100),
 ('b6000000-0000-0000-0000-000000000003','QA-R1-FK','b2000000-0000-0000-0000-000000000001',current_date,'12:00','pending',100);
insert into public.order_items(id,order_id,quantity,unit_price,total_price) values
 ('b7000000-0000-0000-0000-000000000001','b6000000-0000-0000-0000-000000000001',2,50,100),
 ('b7000000-0000-0000-0000-000000000002','b6000000-0000-0000-0000-000000000002',2,50,100),
 ('b7000000-0000-0000-0000-000000000003','b6000000-0000-0000-0000-000000000003',2,50,100);
insert into public.expenses(order_id,amount,description,status,created_by) values('b6000000-0000-0000-0000-000000000003',10,'QA R1 Restrict','pending','b1000000-0000-0000-0000-000000000001');
create temp table qa_r1_payload(request uuid,payload jsonb);
grant all on qa_r1_payload to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-0000-0000-000000000001',true);
-- Both old first PATCH (even unchanged) and zero-row DELETE fail before effects.
do $$ declare before jsonb; begin
 before:=public.lifecycle_snapshot('edit_order','b6000000-0000-0000-0000-000000000001');
 begin update public.orders set notes=notes where id='b6000000-0000-0000-0000-000000000001'; raise exception 'EXPECTED_OLD_PATCH'; exception when others then if SQLERRM not like '%LC_REFRESH%' then raise; end if; end;
 begin delete from public.order_items where order_id='b6000000-0000-0000-0000-000000000001'; raise exception 'EXPECTED_OLD_DELETE'; exception when others then if SQLERRM not like '%LC_REFRESH%' then raise; end if; end;
 begin delete from public.order_items where order_id='b6000000-0000-0000-0000-000000000099'; raise exception 'EXPECTED_ZERO_DELETE'; exception when others then if SQLERRM not like '%LC_REFRESH%' then raise; end if; end;
 if before is distinct from public.lifecycle_snapshot('edit_order','b6000000-0000-0000-0000-000000000001') then raise exception 'LEGACY_PARTIAL_WRITE'; end if;
end $$;
insert into qa_r1_payload values('b8000000-0000-0000-0000-000000000001',jsonb_build_object('op','edit_order','order_id','b6000000-0000-0000-0000-000000000001','expected',public.lifecycle_snapshot('edit_order','b6000000-0000-0000-0000-000000000001'),'data',jsonb_build_object('notes','QA edited'),'items',jsonb_build_array(jsonb_build_object('id','b7000000-0000-0000-0000-000000000001','quantity',2,'unit_price',50,'service_id',null))));
select public.lifecycle_mutate(request,payload) from qa_r1_payload;
do $$ declare before jsonb; result jsonb; begin
 before:=public.lifecycle_snapshot('edit_order','b6000000-0000-0000-0000-000000000001');
 if before->'items' is distinct from (select payload->'expected'->'items' from qa_r1_payload) then raise exception 'UNCHANGED_ITEM_ID_OR_ROW_CHANGED'; end if;
 result:=public.lifecycle_mutate((select request from qa_r1_payload),(select payload from qa_r1_payload));
 if not (result->>'replayed')::boolean or before is distinct from public.lifecycle_snapshot('edit_order','b6000000-0000-0000-0000-000000000001') then raise exception 'EDIT_RETRY_CHANGED_DATA'; end if;
 begin perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','edit_order','order_id','b6000000-0000-0000-0000-000000000001','expected',before,'data',jsonb_build_object('team_id',null),'items','[]'::jsonb)); raise exception 'EXPECTED_BAD_FIELD'; exception when others then if SQLERRM<>'LC_INVALID' then raise; end if; end;
 begin perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','edit_order','order_id','b6000000-0000-0000-0000-000000000001','expected',before,'data','{}'::jsonb,'items',jsonb_build_array(jsonb_build_object('id','b7000000-0000-0000-0000-000000000002','quantity',2,'unit_price',50)))); raise exception 'EXPECTED_WRONG_OWNER'; exception when others then if SQLERRM<>'LC_INVALID' then raise; end if; end;
 if before is distinct from public.lifecycle_snapshot('edit_order','b6000000-0000-0000-0000-000000000001') then raise exception 'INVALID_EDIT_PARTIAL'; end if;
 begin perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','delete_order','order_id','b6000000-0000-0000-0000-000000000003','expected',public.lifecycle_snapshot('edit_order','b6000000-0000-0000-0000-000000000003'))); raise exception 'EXPECTED_FK'; exception when foreign_key_violation then null; end;
 if (select count(*) from public.order_items where order_id='b6000000-0000-0000-0000-000000000003')<>1 then raise exception 'FK_DELETED_ITEMS'; end if;
end $$;
-- Accept ordinary JS floating totals; reject prices that cannot be stored in cents.
do $$ declare expected jsonb; begin
 expected:=public.lifecycle_snapshot('edit_order','b6000000-0000-0000-0000-000000000001');
 begin perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','edit_order','order_id','b6000000-0000-0000-0000-000000000001','expected',expected,'data','{}'::jsonb,'items',jsonb_build_array(jsonb_build_object('quantity',3,'unit_price',1.005))));raise exception 'EXPECTED_PRECISION';exception when others then if SQLERRM<>'LC_INVALID' then raise;end if;end;
 perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','edit_order','order_id','b6000000-0000-0000-0000-000000000001','expected',expected,'data','{}'::jsonb,'items',jsonb_build_array(jsonb_build_object('id','b7000000-0000-0000-0000-000000000001','quantity',3,'unit_price',0.1,'total_price',0.30000000000000004))));
 if (select total_amount from public.orders where id='b6000000-0000-0000-0000-000000000001')<>0.30 then raise exception 'JS_TOTAL_INCONSISTENT';end if;
end $$;
delete from qa_r1_payload;
insert into qa_r1_payload values('b8000000-0000-0000-0000-000000000002',jsonb_build_object('op','delete_order','order_id','b6000000-0000-0000-0000-000000000002','expected',public.lifecycle_snapshot('edit_order','b6000000-0000-0000-0000-000000000002')));
select public.lifecycle_mutate(request,payload) from qa_r1_payload;
do $$ declare result jsonb; begin
 result:=public.lifecycle_mutate((select request from qa_r1_payload),(select payload from qa_r1_payload));
 if not (result->>'replayed')::boolean or exists(select 1 from public.orders where id='b6000000-0000-0000-0000-000000000002') or exists(select 1 from public.order_items where order_id='b6000000-0000-0000-0000-000000000002') then raise exception 'DELETE_RETRY_FAILED'; end if;
end $$;
reset role;
create function public.qa_r1_fail_item() returns trigger language plpgsql as $$begin raise exception 'QA_R1_ITEM_FAULT';end$$;
create trigger qa_r1_fail before insert on public.order_items for each row execute function public.qa_r1_fail_item();
set local role authenticated;
do $$ declare before jsonb; begin
 before:=public.lifecycle_snapshot('edit_order','b6000000-0000-0000-0000-000000000001');
 begin perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','edit_order','order_id','b6000000-0000-0000-0000-000000000001','expected',before,'data',jsonb_build_object('notes','MUST ROLLBACK'),'items',jsonb_build_array(jsonb_build_object('quantity',3,'unit_price',25))));raise exception 'EXPECTED_ITEM_FAULT';exception when others then if SQLERRM<>'QA_R1_ITEM_FAULT' then raise;end if;end;
 if before is distinct from public.lifecycle_snapshot('edit_order','b6000000-0000-0000-0000-000000000001') then raise exception 'ITEM_FAILURE_PARTIAL';end if;
end $$;
reset role;
rollback;
