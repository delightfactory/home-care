# DR1–DR4 conservative local recovery contract

This follow-up does not authorize production recovery or release. It changes
the explicit application recovery boundary and must be accepted before release.

## Recovery authority and complete state

The supported recovery procedure is full-database restoration, including
`lifecycle_private.requests` and `lifecycle_private.epoch`, into a maintenance
environment. Preserve exact participant IDs, start/finish times, role, ratings
and scores; never replay status logs to regenerate participants. Apply the
approved lifecycle migrations if the restored database predates them. Keep
all application and background-writer traffic closed until validation and epoch
finalization complete. Invalidate old sessions and reload clients before reopening
traffic; epoch checks are a lifecycle protocol boundary, not a universal client
admission gate. An older R1 bundle can fetch a new epoch in a fresh snapshot, so
epoch rotation alone cannot prevent every old client from writing.
This is not a tested provider PITR procedure and does not restore Storage bytes,
external provider state or users' cached application state.

`restore_from_backup(uuid)` keeps its existing owner/SECURITY DEFINER/ACL, but
now rejects every legacy application restore before reading data, reset or DDL.
These partial application payloads cannot reconstruct financial/auth-dependent
state reliably. Older exports remain downloadable; they are not silently
converted into recoverable full-database snapshots. No new restore engine or
authenticated reset/restore endpoint is added.

`finalize_lifecycle_recovery(expected_epoch, reason)` is an explicitly
service_role-only new API with a private singleton epoch. Under the lifecycle
advisory transaction lock it verifies the expected token and absence of durable
transient context, rotates the UUID, and returns old/new tokens. Run it in the
controlled restored database before admitting clients. A failed transaction
preserves the old epoch and state. Its receipt is evidence of invalidation,
not proof of a complete external restoration.

## Reset and retained evidence

`reset_operational_data()` retains its old service_role-only ACL and original
public TRUNCATE/CASCADE scope. This can include dependent financial/public
tables through existing foreign keys; it is not an innocuous UI cleanup.
It acquires the lifecycle lock before DDL, captures and restores each existing
user trigger's enabled/disabled/replica/always state, keeps the durable journal,
and rotates the epoch at the end of the same transaction. It refuses an
unexpected persisted transient context. No public guard bypass is available.

Historical request evidence is not filtered to the new epoch. It continues
protecting surviving participant identities and start logs after finalization;
there is no casual journal clearing or historical uniqueness migration.
Do not reuse previously deleted order UUIDs as new entities. Reset and restore
transactions and entry privileges must be exercised with actual roles/owners.

## Retry protocol

Route/order/edit snapshots include `epoch`. `lifecycle_mutate` requires
`payload.expected.epoch` to match the current token before journal replay.
Missing tokens, pre-upgrade requests and previous-dataset requests fail
`LC_EPOCH`; no obsolete committed success is returned after reset/restoration.
The client retains its first epoch per signed-in actor in the open page. It
does not adopt a newer snapshot epoch to turn an old operation into a new one.
After a dataset change, reload and explicitly review the operation again.
Ordinary uncertain responses still retain their original UUID and payload.

## Application Backup V2 export

The original 42 public chunks remain, followed by the durable epoch and request
chunks (44 total). Transient context is excluded. Creation takes the lifecycle
lock, then reads all chunks through one calling SELECT into a private read-only
STABLE helper. Every helper SELECT uses that calling query's MVCC snapshot;
the volatile creator persists the returned chunks. No SHARE locks impose a
new lock order on financial writers. This follows the [PostgreSQL 17 volatility
contract](https://www.postgresql.org/docs/17/xfunc-volatility.html).
Resource bounds and prior-completed-backup retention remain. Operational load
qualification is separate; concurrent financial-write tests must verify the
complete old/new snapshot behavior rather than rely on volatility declaration.

Admin and scheduled creation validators now require 44 chunks and preserve
row/size/MD5 checks. Existing stored 42-chunk exports still list/download using
their own manifest and count. Export format/version stays compatible; additive
coverage/scope metadata distinguishes private-state inclusion from full-DB
recovery. Server-side checksums verify chunks; the browser also checks row
counts. Auth records, schema/configuration, omitted public tables and Storage
bytes remain outside this application export.

## Retention and display refresh

Cleanup retains every `in_progress` status log, including legacy ones, as the
conservative history policy. It removes other eligible old status/performance
logs in one transaction under the lifecycle lock and preserves its invoker
mode/ACL. It does not prune participant rows or durable requests.

A rejected/uncertain start invalidates display caches and requests a read refresh
from Operations/Orders. It emits no mutation-success event and never changes
the retained retry UUID/snapshot or automatically retries a write. Refresh
failure remains a visible read limitation, not a successful synchronization.

## Qualification responsibility

The implementer writes candidate files only. The parent executes isolated
fresh/upgrade, snapshot/restore/finalize, reset rollback, protected-history
cleanup, consistent backup/validator and two-window UI tests. Provider PITR,
Storage/provider delivery, production rollback, full payroll, offline/reload
recovery and load acceptance are separate gates. F1–F9 and financial ACL
changes remain outside this package. No commit/push/deploy is authorized here.
