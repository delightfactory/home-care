-- Dedicated isolated DR database only; every fixture/epoch/backup change rolls back.
begin;
insert into auth.users(id) values('d1000000-0000-0000-0000-000000000001');
insert into public.users(id,role_id,full_name,is_active)
select 'd1000000-0000-0000-0000-000000000001',id,'QA DR Manager',true from public.roles where name='manager';
insert into public.customers(id,name,phone,address) values('d2000000-0000-0000-0000-000000000001','QA DR Customer','dr-qa-customer','QA');
insert into public.orders(id,order_number,customer_id,scheduled_date,scheduled_time,status,total_amount) values
 ('d6000000-0000-0000-0000-000000000001','QA-DR-DELETE','d2000000-0000-0000-0000-000000000001',current_date,'10:00','pending',100),
 ('d6000000-0000-0000-0000-000000000002','QA-DR-EDIT','d2000000-0000-0000-0000-000000000001',current_date,'11:00','pending',100);
insert into public.order_items(order_id,quantity,unit_price,total_price) values
 ('d6000000-0000-0000-0000-000000000001',2,50,100),('d6000000-0000-0000-0000-000000000002',2,50,100);
insert into public.order_status_logs(order_id,status,created_at) values
 ('d6000000-0000-0000-0000-000000000002','pending',clock_timestamp()-interval '2 years');
create temp table qa_dr_payload(request uuid,payload jsonb);
create temp table qa_dr_backup(run uuid);
grant all on qa_dr_payload,qa_dr_backup to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','d1000000-0000-0000-0000-000000000001',true);
insert into qa_dr_payload values('d8000000-0000-0000-0000-000000000001',jsonb_build_object(
 'op','delete_order','order_id','d6000000-0000-0000-0000-000000000001',
 'expected',public.lifecycle_snapshot('edit_order','d6000000-0000-0000-0000-000000000001')));
select public.lifecycle_mutate(request,payload) from qa_dr_payload;
reset role;
create temp table qa_dr_evidence as select to_jsonb(r) as row from lifecycle_private.requests r
where request='d8000000-0000-0000-0000-000000000001';
select public.finalize_lifecycle_recovery(lifecycle_private.current_epoch(),'QA rollback finalization');
set local role authenticated;
do $$ begin
 begin perform public.lifecycle_mutate((select request from qa_dr_payload),(select payload from qa_dr_payload));raise exception 'EXPECTED_OLD_EPOCH';
 exception when others then if SQLERRM<>'LC_EPOCH' then raise;end if;end;
 -- A new operator/client flow uses the current snapshot, never rewrites old payload.
 perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','edit_order',
 'order_id','d6000000-0000-0000-0000-000000000002',
 'expected',public.lifecycle_snapshot('edit_order','d6000000-0000-0000-0000-000000000002'),
 'data',jsonb_build_object('notes','New epoch edit'),'items',jsonb_build_array(jsonb_build_object('quantity',3,'unit_price',25))));
 if (select total_amount from public.orders where id='d6000000-0000-0000-0000-000000000002')<>75 then raise exception 'FRESH_EPOCH_WRITE_FAILED';end if;
end $$;
insert into qa_dr_backup select (public.admin_create_backup_v2('QA DR rollback')->>'run_id')::uuid;
reset role;
do $$ declare before_count bigint; begin
 if (select row from qa_dr_evidence) is distinct from (select to_jsonb(r) from lifecycle_private.requests r where request='d8000000-0000-0000-0000-000000000001') then raise exception 'FINALIZE_ALTERED_EVIDENCE';end if;
 if (select count(*) from internal_maintenance.backup_v2_chunks where run_id=(select run from qa_dr_backup))<>44 then raise exception 'BACKUP_NOT_44';end if;
 if exists(select 1 from internal_maintenance.backup_v2_chunks where run_id=(select run from qa_dr_backup) and (md5(payload::text)<>checksum_md5 or jsonb_array_length(payload)<>row_count)) then raise exception 'BACKUP_BAD_INTEGRITY';end if;
 if (select count(*) from internal_maintenance.backup_v2_chunks where run_id=(select run from qa_dr_backup) and table_name in ('lifecycle_private.epoch','lifecycle_private.requests'))<>2 then raise exception 'BACKUP_PRIVATE_STATE_MISSING';end if;
 if exists(select 1 from internal_maintenance.backup_v2_chunks where run_id=(select run from qa_dr_backup) and table_name='lifecycle_private.context') then raise exception 'BACKUP_TRANSIENT_STATE';end if;
 select count(*) into before_count from public.orders;
 begin perform public.restore_from_backup(gen_random_uuid());raise exception 'EXPECTED_LEGACY_RESTORE_REJECTION';
 exception when others then if SQLERRM not like '%LC_RECOVERY_FULL_DB%' then raise;end if;end;
 if before_count<>(select count(*) from public.orders) then raise exception 'LEGACY_RESTORE_MUTATED';end if;
end $$;
select public.cleanup_old_data();
do $$ begin
 if exists(select 1 from public.order_status_logs where order_id='d6000000-0000-0000-0000-000000000002' and status='pending' and created_at<clock_timestamp()-interval '1 year') then raise exception 'ELIGIBLE_LOG_NOT_CLEANED';end if;
end $$;
-- Failed persistence must return the original failure, retain the previous
-- completed snapshot, and leave no half-created chunks.
create function public.qa_dr_chunk_fault() returns trigger language plpgsql as $$begin raise exception 'QA_CHUNK_PERSIST';end$$;
create trigger qa_dr_chunk_fault before insert on internal_maintenance.backup_v2_chunks for each row execute function public.qa_dr_chunk_fault();
do $$ declare result jsonb; begin
 result:=internal_maintenance.create_backup_v2('QA persist failure');
 if (result->>'success')::boolean is distinct from false or result->>'error' not like '%QA_CHUNK_PERSIST%' then raise exception 'PERSIST_FAILURE_CONTRACT: %',result;end if;
 if (select count(*) from internal_maintenance.backup_v2_chunks where run_id=(select run from qa_dr_backup))<>44 then raise exception 'PERSIST_FAILURE_REMOVED_OLD_BACKUP';end if;
 if exists(select 1 from internal_maintenance.backup_v2_chunks where run_id=(result->>'run_id')::uuid) then raise exception 'PERSIST_FAILURE_LEFT_CHUNKS';end if;
end $$;
drop trigger qa_dr_chunk_fault on internal_maintenance.backup_v2_chunks;
-- Override the helper only within this rollback fixture transaction.
create or replace function lifecycle_private.backup_chunks() returns table(table_name text,table_order integer,row_count bigint,size_bytes bigint,checksum_md5 text,payload jsonb)
language plpgsql stable security definer set search_path=pg_catalog,public,lifecycle_private as $$begin raise exception 'QA_HELPER_SNAPSHOT';end$$;
do $$ declare result jsonb; begin
 result:=internal_maintenance.create_backup_v2('QA helper failure');
 if (result->>'success')::boolean is distinct from false or result->>'error' not like '%QA_HELPER_SNAPSHOT%' then raise exception 'HELPER_FAILURE_CONTRACT: %',result;end if;
 if (select count(*) from internal_maintenance.backup_v2_chunks where run_id=(select run from qa_dr_backup))<>44 then raise exception 'HELPER_FAILURE_REMOVED_OLD_BACKUP';end if;
 if exists(select 1 from internal_maintenance.backup_v2_chunks where run_id=(result->>'run_id')::uuid) then raise exception 'HELPER_FAILURE_LEFT_CHUNKS';end if;
end $$;
rollback;
