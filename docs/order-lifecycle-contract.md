# Isolated lifecycle repair contract

This migration is a candidate for local qualification only. No production repair,
backfill, financial change or published release is authorized by this document.

## Serialization and retry

All affected table writes take advisory transaction lock `(61006, 1)` in a
BEFORE STATEMENT trigger, before row locks. The RPC takes that same lock first,
then locks routes in UUID order and orders in UUID order; start additionally
locks the selected team row, then its membership rows in UUID order. Team and
membership writes take the same lock before their rows;
the start timestamp is chosen only after these locks. This deliberately
serializes lifecycle and membership writes across the application; throughput
must be measured before production acceptance. Transactions already holding
row locks (including lifecycle rows via SELECT FOR UPDATE) and subsequently entering lifecycle writes can still
deadlock; PostgreSQL aborts them, never silently retries a changed payload.

The private context is a table keyed by backend PID and transaction ID, writable
only by the migration owner, not a caller-set configuration flag. Request IDs
are journaled with actor and the complete JSON payload. Only the same actor,
request ID and payload can replay the stored result. A replay never executes
again, even if a deleted link has since been replaced. Different IDs require a
matching captured snapshot. Route snapshots include link IDs, sequence, order
status/team/version and execution evidence, as well as the route team/state.

## History and compatibility

The shared history predicate includes protected statuses, start/completion logs,
any participants, and invoices linked to the order. It deliberately does not
classify an ordinary pre-execution expense as execution. Attendance is route/
worker based rather than order based and is not proof of a particular order's
execution. Route actual-start/end and status guard team change/deletion and
completed-route assignment separately; an active shared route does not prevent
starting later scheduled orders. Ambiguous multi-link orders fail.
Protected rows left unchanged by a modal remain untouched; changing their
sequence is conservatively rejected. Route deletion is restricted to empty
planned routes in this slice. There is no historical cleanup or global unique
order constraint.

Legacy direct relationship/context/start writes are rejected and require a
client refresh. Delayed start logs are rejected before the existing destructive
population trigger; participant INSERT/DELETE for RPC-started orders is blocked
outside the private start context. Completion/rating updates remain available.
Old function grants/security modes remain unchanged. This is safe rejection,
not full backwards compatibility. It includes rejection of resync/populate participant replacement for
orders started through this RPC; those administrative paths need independent
review before production, although their ACLs and security modes are unchanged.
The unchanged invoice WARNING completion
contract and unrelated financial paths are not modified.

## Authorization and qualification

New helpers/RPCs have explicit ACLs, fixed search paths and explicit active-user
checks. Scheduling requires routes.update and either orders.assign or
orders.update. Live operations_supervisor has assign=true/update=false: allowing
only derived pending/scheduled/team changes is a deliberate narrow permission
decision, requiring explicit production review, not proof of existing effective
RLS write equivalence. Start still requires orders.update, so this role cannot
start unless a separate permission decision is approved. Actual-role tests must
prove this split. Neither unrelated ACLs nor the old permission helper change.
Technician start is constrained by auth.uid(), worker and temporal membership;
caller-supplied user IDs are never used as identity. The live policy predicate
and team-only constraints are based on the captured live role catalog; the new
RPC additionally rejects inactive users/roles and constrains team-only actors.
These necessary RPC boundaries must be disclosed for production review. No
unrelated old EXECUTE grant is revoked.

Acceptance must include real role contexts, trigger chain, zero-row delete,
stale retry after re-add, opposing transfers, team/member mutation versus start,
unchanged completed modal row, protected reorder rollback, failure in start log,
delayed legacy log/fallback, CASCADE route deletion, financial/attendance value
comparison, and old/new clients. Mock source reproductions do not qualify SQL.

The assignment and edit modals capture the original snapshot once per open
session. Cache events and background loading must not unmount an unresolved
modal or replace its state. Failed/uncertain operations do not emit mutation
success events. A retry retains UUID, actor and payload in memory; a full page
reload does not claim to resume that lost client operation. The database still
rejects stale snapshots and legacy writes after a reload.

The publication is not modified. Technician route/link subscriptions rebuild
order filters and refresh on focus; existing order/invoice subscriptions are
not claimed to work cross-device when their tables are absent from publication.
Guaranteed realtime delivery for those tables remains a separate review gate.


## R1/R2 bounded follow-up

R1 adds edit_order/read snapshots and edit_order/delete_order operations to the
same actor/request journal. The edit snapshot includes base fields and complete
ordered item rows; scheduling snapshots retain their prior shape. Edit applies
only customer/date/time/payment fields, transport_method and notes plus item
changes and a server-calculated total. Retained unchanged item rows keep their
IDs and timestamps. Finite nonnegative prices must fit cents; quantities are
positive integers. Supplied totals are compared after rounding to cents, then
SQL computes stored totals. Empty item lists remain supported by the API's old
replacement contract; the existing form requires a service. Started/completed
edits retain the old business policy. Invoices and collections are untouched;
editing an order does not synchronize an existing invoice.

Delete accepts only unlinked preexecution orders with no invoice/participants
or execution history. It deletes the parent once, relies on existing cascades,
and journals the result; expense restrictions roll back the complete operation.
Deleted retries recheck role/team authorization using the stored original
journal context. Private edit/delete context is restricted to its target order.

Old forms must refresh: statement guards reject their first core-field PATCH,
even unchanged, and reject direct item DELETE even when it matches zero rows.
Direct parent DELETE is also rejected outside the delete_order operation.
Completion/cancellation, payment-only updates, ratings, feedback and confirmation
columns retain their paths. Creating orders/items retains its INSERT flow.
Legacy item replacement wrappers now execute one atomic edit operation.
This intentionally restricts raw item deletion: no trigger-depth or version-header
bypass exists. It does not change financial RPCs or their ACLs.

R2 recognizes legacy route pending only during order start, retaining scheduled
order, team, membership, history, snapshot and ended-route conditions. Save,
transfer, team change and route deletion do not gain pending compatibility.
