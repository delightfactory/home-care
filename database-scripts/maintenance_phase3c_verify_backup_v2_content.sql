-- Backup V2 content integrity verification. READ ONLY.
-- PostgreSQL may TOAST-compress stored JSONB, so post-storage pg_column_size
-- is not compared with the in-memory size recorded during snapshot creation.

with latest_run as (
  select id
  from internal_maintenance.backup_v2_runs
  where status = 'completed'
  order by completed_at desc
  limit 1
),
checks as (
  select
    c.row_count,
    jsonb_array_length(c.payload) as payload_rows,
    c.checksum_md5,
    md5(c.payload::text) as actual_checksum_md5
  from internal_maintenance.backup_v2_chunks c
  join latest_run r on r.id = c.run_id
)
select
  count(*) as chunks_checked,
  count(*) filter (where row_count = payload_rows) as row_counts_valid,
  count(*) filter (
    where checksum_md5 = actual_checksum_md5
  ) as checksums_valid,
  count(*) filter (
    where row_count <> payload_rows
       or checksum_md5 <> actual_checksum_md5
  ) as invalid_chunks
from checks;
