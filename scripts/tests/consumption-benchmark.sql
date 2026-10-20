-- Reproducible synthetic scale; every row and audit event rolls back in the runner.
insert into public.orders(id,order_number,customer_id,scheduled_date,scheduled_time,status)
select gen_random_uuid(),'QA-IO-BENCH-'||n,(select id from public.customers limit 1),current_date,'10:00',
  (array['pending','scheduled'])[1+n%2]
from generate_series(1,12000) n;
analyze public.orders;

select set_config('request.jwt.claim.sub',(select u.id::text from public.users u join public.roles r on r.id=u.role_id where r.name='manager' limit 1),true);
set local role authenticated;
do $$ declare started timestamptz; legacy_ms numeric; aggregate_ms numeric; count_result bigint; snapshot jsonb; loop_index int; status_name text;
begin
  -- Warm both paths, then measure the same authenticated caller and dataset five times each.
  perform public.get_order_counts();
  perform count(*) from public.orders;
  started:=clock_timestamp();
  for loop_index in 1..5 loop
    select count(*) into count_result from public.orders;
    foreach status_name in array array['pending','scheduled','in_progress','completed','cancelled'] loop
      select count(*) into count_result from public.orders where status=status_name;
    end loop;
  end loop;
  legacy_ms:=extract(epoch from clock_timestamp()-started)*1000/5;
  started:=clock_timestamp();
  for loop_index in 1..5 loop snapshot:=public.get_order_counts(); end loop;
  aggregate_ms:=extract(epoch from clock_timestamp()-started)*1000/5;
  raise notice 'BENCHMARK %',jsonb_build_object('rows',snapshot->'total','runs_per_path',5,
    'legacy_mean_ms',round(legacy_ms,2),'aggregate_mean_ms',round(aggregate_ms,2),
    'database_calls_before',6,'database_calls_after',1,'disk_io_reduction','not measured by this benchmark');
end $$;
reset role;
