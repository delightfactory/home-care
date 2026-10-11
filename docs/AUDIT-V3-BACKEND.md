# Bounded audit V3 backend

The migration is generated from reviewed static scalar fields. `node scripts/generate-audit-v3.cjs core` selects eleven core sources; `all` selects the forty approved public sources and the two approved private sources. Following the user's explicit instruction to continue the approved plan after the RPC6 held report, the bounded remaining sources are now implemented locally for qualification. This continuation does not waive the failed performance criterion or authorize production. The generator is a build tool, not a database configuration framework. No existing business writer or lifecycle function is modified.

The pre-fix FULL42 baseline has SHA-256 `f02e1d74525cd296622f41b13cf9483e18545a13850aa5b2cb4b582e3a1a252d`; its eleven core capture definitions matched CORE5, SHA-256 `c3de6fc0a7a249fdd354b850076ee5499a07f45234bf4ac2de151b25ecc28da8`. The current review-fix SQL has SHA-256 `21e9ddfb0b900dd1a34d3fc097e4145025c07d65762c7e8f234f17b41feba9f1`. Only capture_orders differs from the baseline capture functions; the other forty-one are byte-identical. The current wrapper builds allowlisted snapshots after relevant-change detection, preserving the config lock and failure boundary. Historical performance failures remain failures. The company has no stated latency SLA; the 25-ms budget is an internal conservative engineering criterion. The new frozen 104-pair sweep also failed the save and team-change tail criteria; functional qualification alone does not close the performance gate.

Before RPC6 measurement, an independent review accepted an explicit applicability decision to test actual lifecycle operations at the observed live bounds (ten orders per route and eleven eligible members), using PostgreSQL EXPLAIN planning plus execution timing and actual COMMIT. Numeric budgets stayed unchanged; the previous synthetic load failures were preserved as cost/load signals rather than reclassified as success. RPC6 ran once: four scenarios, each with two warmups and twenty-four measured baseline/candidate pairs, alternating pair order, with no removed observations. Manager start and team change passed; technician start and assignment save failed the fixed performance gate. Paired p95 additional RPC-plus-COMMIT time was respectively 16.082, 32.459, 27.690 and 8.671 ms against 25 ms. No business assertion failed; exact retry, participant identities/times, assignment differences, destination-team start, and twelve unchanged financial-table fingerprints passed within this bounded fixture scope. This does not qualify the forty-source feature, financial writers, full system or production load, and does not prove the latency failures were caused by the host.

The forty public sources use the unchanged static projection mechanism, including four typed change markers. `app_settings` uses `key-sha256:` plus the hexadecimal SHA-256 of its full UTF-8 key, computed by PostgreSQL built-ins. This bounded identity applies to every key and avoids grouping distinct long keys by their first 160 characters; approved key display stays limited to 160 characters with redaction. Every other public source uses `id`. The receipt and epoch wrappers are implemented in `scripts/audit-v3-special.sql`. The frozen FULL42 SQL has passed isolated forty-source rollback and committed matrices, actual-value/type comparisons for 333 approved public fields, two special-source cases, and an authenticated committed lifecycle receipt with exact retry. Separate baseline/candidate checks cover bounded collection, settlement, expense, order completion/invoicing, payroll/advances, nonzero worker bonus and automatic attendance checkout. Existing financial defects remain classified as defects, not acceptance successes. These checks do not qualify every business operation, production load, storage growth or performance; prior performance failures remain release holds.

Receipt capture is AFTER INSERT only. The composite entity is `actor:request`; the snapshot contains the attributed receipt actor, request UUID, timestamp, lifecycle epoch, one of the seven existing operation names, and three fixed top-level UUID references (`order_id`, `route_id`, `destination_id`). JSON references require string type and canonical UUID syntax. Raw payload/result, expected snapshots, desired lists, item lists and notes are excluded. The append helper independently obtains the verified caller from `auth.uid()`; receipt actor never overrides caller. No added lifecycle lookup or receipt mutation is performed. An unknown operation emits the existing bounded capture warning instead of claiming a proved operation.

Epoch capture is AFTER UPDATE only and requires an actual token change. Its constant entity is `singleton`; before/after contain only token and changed_at. The raw maintenance reason is excluded; a reason-only or timestamp-only write creates no token-change event. This evidences changed data version, not completed reset/restore. Both special wrappers use the existing config NOWAIT lock, append helper, snapshot budget, restricted privileges and bounded exception warning; business errors outside capture remain unchanged.

## Capture and trust

Each AFTER row trigger contains its projection, fixed typed markers, and audit append within one exception block. It serializes only explicitly selected columns. Unknown/new columns are excluded. Known unrestricted JSON (permissions, preferences categories, setting values) is compared only for change and never serialized. No actor/name/profile/epoch lookups or external calls happen inside capture.

`actor_id` is `auth.uid()` from the database request session. An actor absent from a service/direct database writer is represented as service/system/anonymous/unknown. Row fields such as `created_by` or `performed_by` remain attributed identities within snapshots and never override actor. Current actor names are joined only in authorized read APIs; the current name is not a historical identity snapshot.

Fields of textual type, including bounded labels/statuses, are limited to 160 characters before JSON construction. `redacted_fields` identifies these shortened values. The stored event as a whole is limited to 16 KiB; if it exceeds that budget, both value snapshots are withheld and `payload_redacted=true`, while identity, operation, field names and fixed markers remain. There is no raw payload fallback. Truncation is a size bound, not a guarantee that human-entered approved labels contain no sensitive text.

`changed_fields` uses typed comparisons rather than comparing already-truncated labels: a change beyond the 160-character prefix is still a change. True no-ops generate no event. Events roll back with the enclosing business transaction; they do not evidence rejected attempts or full completion of a multi-transaction workflow. Nested business-trigger changes on enabled audited sources are included; unlisted or excluded tables are not captured.

## Locks and failure boundary

The wrapper acquires ACCESS SHARE NOWAIT on audit config before reading it/projection, and append acquires ROW EXCLUSIVE NOWAIT on audit events before inserting. Qualified capture failures emit `AUDIT_CAPTURE_GAP` with table/operation/SQLSTATE only, never error details or row values. The capture error block is a subtransaction; business errors outside it are not swallowed.

NOWAIT prevents waiting on conflicting config/event maintenance table locks. It does not prove immunity to every index/row/catalog/I/O resource stall, statement cancellation, crash, or out-of-memory condition. PostgreSQL OTHERS does not catch query cancellation; cancellation can abort the business statement. Runtime fault/latency tests and the documented frozen acceptance budget are required before any production claim. A latest event is not evidence of complete capture.

## Security and read contract

Private schema/table/functions have privileges revoked from PUBLIC, anon, authenticated and service_role. Tables use RLS with no client policy. Trigger functions are SECURITY DEFINER with fixed search paths. There are no business foreign keys, writable event APIs, or audit UPDATE/DELETE APIs. Database owners can maintain the schema; this is not owner-proof archival.

The three public SECURITY DEFINER readers explicitly require an active user, active role and JSON boolean `permissions.admin=true`, then bound/filter their reads. EXECUTE is granted only to authenticated. No existing permission helper or grants are changed.

- `admin_audit_list(p_from, p_to, p_table, p_actor, p_entity, p_kind, p_transaction, p_cursor_at, p_cursor_id, p_limit, p_generation, p_from_day, p_to_day)` returns `{events,next_cursor}`. `p_table` is `schema.table`; transaction filter is `generation:full_xid`, and optional `p_generation` further restricts the database generation. `p_kind` matches either the event kind or INSERT/UPDATE/DELETE. Page size clamps to 1..100. Both cursor fields must be present together. Cursor order is descending `(occurred_at,id)`.
- `admin_audit_detail(p_id)` returns the event or null.
- `admin_audit_coverage()` returns enabled/generation, actual installed trigger sources and declared limitations. Source enablement metadata is not evidence that every event was captured.

## Audit-only operational control

Run as the qualified database maintenance owner; never grant this operation to the application:

```sql
update audit_private.config set enabled=false where singleton;
-- Verify business guard/receipt/epoch behavior remains active.
update audit_private.config set enabled=true where singleton;
```

No business trigger disablement or migration rollback is needed. Existing captured events remain. Disablement cannot cancel capture already running within an older transaction snapshot.

The correlation key combines a fixed random installation/recovery generation and `pg_current_xact_id()` (full XID, not wrapping 32-bit XID). After a full database restore/clone, while application writes remain quiesced, the maintenance procedure must run:

```sql
update audit_private.config set generation=gen_random_uuid() where singleton;
```

This rotates only the audit generation and never the lifecycle epoch/receipts. Without the quiesced restore step, correlation across restored timelines is not qualified. An application Backup44 omits audit; the existing backup/reset/restore implementation is unchanged. Full-DB backup/restore preservation and reset survival have separate local qualification records; provider bootstrap, retention/volume and production recovery assumptions must be reviewed before release. No cron retention/queue/worker is added.

## Reproducibility

The wrapper reads enabled/generation once while holding the config table lock, then supplies that generation to the private append helper. The helper cannot be invoked by application/service roles, and does not re-read configuration or look up lifecycle state. Actor role extraction is performed once and only when the session has no actor ID. These bounded optimizations preserve the capture error boundary and the complete-event size check.

The size precheck uses serialized snapshot/marker byte lengths plus a conservative 6,144-byte fixed metadata reserve. The reviewed forty-source manifest has at most 32 selected fields; the static proof includes both full field-name arrays, UUIDs, full 64-bit XID, timestamp, all envelope keys and a 160-character entity made of maximally escaped control characters, plus a PostgreSQL-spacing reserve. The exact complete-event 16-KiB table CHECK is unchanged. As a result, snapshots may be withheld conservatively even when the eventual full event would fit; this is explicit `payload_redacted`, never a raw fallback. Any new source/field affecting the metadata bound must pass this proof before generation. Current actor names from read APIs are also limited to 160 characters.

`scripts/audit-v3-coverage.json` freezes forty reviewed public target sources and field/marker rules. `scripts/audit-v3-active-sources.json` records the generated subset. The kernel and readers are SQL templates; changes require regenerating and reviewing the migration, followed by `node scripts/tests/test-audit-v3-static.cjs` and real isolated runtime tests. Static PASS is not runtime acceptance or production authorization.

Calendar-day filters p_from_day/p_to_day use Africa/Cairo on PostgreSQL, with exclusive next-day midnight (microsecond-safe and DST-aware). Legacy timestamp bounds remain optional; mixing day and instant ranges is rejected. The frontend sends dates without converting through browser timezone and renders Cairo time.

## Bounded review fixes

For UPDATE on orders only, the generated wrapper compares all sixteen selected fields before reading audit configuration. This early no-op return remains inside the original capture exception boundary. INSERT, DELETE and relevant updates retain the same configuration lock, private append function and exact size CHECK. The other forty-one capture functions are unchanged.

The list reader parses schema/table and generation/transaction once and compares the scalar columns directly. Parsing follows administrator authorization and existing cursor/date validation. UUID text must retain canonical lowercase spelling; malformed filters still return an empty page, without changing validation error precedence. No additional write index is introduced.

Assignment preparation now blocks Save and Transfer synchronously while any addition snapshot is pending. Closing or replacing a modal session invalidates delayed display callbacks without clearing the lifecycle retry journal or changing its original request UUID. These checks supplement the server transaction and history guards.
