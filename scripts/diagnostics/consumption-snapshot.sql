-- Read-only, bounded metadata. Do not reset statistics or scan application rows.
select jsonb_build_object(
  'at',now(),
  'instance_started_at',pg_postmaster_start_time(),
  'database',(select to_jsonb(d) from pg_stat_database d where datname=current_database()),
  'wal',(select to_jsonb(w) from pg_stat_wal w),
  'stat_reset',(select stats_reset from extensions.pg_stat_statements_info),
  'workload',(select jsonb_agg(x) from (
    select queryid::text,calls,total_exec_time,shared_blks_hit,shared_blks_read,
      shared_blks_dirtied,shared_blks_written,temp_blks_written,wal_bytes
    from extensions.pg_stat_statements order by total_exec_time desc limit 20
  ) x)
) as snapshot;
