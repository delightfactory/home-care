-- Backup V2 integrity verification. READ ONLY.

with latest_run as (
  select id
  from internal_maintenance.backup_v2_runs
  where status = 'completed'
  order by completed_at desc
  limit 1
),
checks as (
  select
    c.table_name,
    c.row_count,
    c.size_bytes,
    jsonb_array_length(c.payload) as payload_rows,
    pg_column_size(c.payload) as actual_size_bytes,
    c.checksum_md5,
    md5(c.payload::text) as actual_checksum_md5
  from internal_maintenance.backup_v2_chunks c
  join latest_run r on r.id = c.run_id
)
select
  count(*) as chunks_checked,
  count(*) filter (where row_count = payload_rows) as row_counts_valid,
  count(*) filter (where size_bytes = actual_size_bytes) as sizes_valid,
  count(*) filter (where checksum_md5 = actual_checksum_md5) as checksums_valid,
  count(*) filter (
    where row_count <> payload_rows
       or size_bytes <> actual_size_bytes
       or checksum_md5 <> actual_checksum_md5
  ) as invalid_chunks
from checks;

select
  id,
  status,
  tables_count,
  total_rows,
  pg_size_pretty(total_size_bytes) as logical_json_size,
  completed_at
from internal_maintenance.backup_v2_runs
where status = 'completed'
order by completed_at desc
limit 1;
