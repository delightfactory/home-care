# Candidate qualification and review handoff

Base: deployed `ff224344eb0ff7dad34aa26eb8c0fc8b433acf6c`.
Migration: `supabase/migrations/20261006192545_order_lifecycle_safe_repair.sql`.
This worktree has not been committed, pushed, deployed or applied to production.
ORD010968 is deliberately untouched.

## Change map

| File | Necessary change |
| --- | --- |
| Migration | Atomic delta-save, transfer, route edit, empty-route delete, start; scoped journal/private context; direct-write guards and common history predicate |
| `src/api/lifecycle.ts` | Snapshot contract, meaningful Arabic errors, request UUID and exact payload retention after uncertain responses |
| `src/api/lifecycle-ordering.ts` | Displayed order allocation preserving protected historical sequence values |
| `src/api/routes.ts` | Replace multi-request writes with lifecycle RPCs; explicit transfer API; preserve original retry snapshot |
| `src/api/orders.ts` | Replace only in_progress status branch with atomic server start |
| `src/api/technician.ts` | Atomic authenticated start, remove client participant fallback, expose team for readiness |
| `src/api/enhanced-api.ts` | Invalidate route/order caches and emit success events only after confirmed success |
| Assignment/edit forms | Atomic desired delta and captured snapshot; real transfer action; truthful errors; preserve unresolved form through refresh |
| Operations/TechOrderCard | Scheduled/team readiness, clear rejected state rather than exposing completion for pending |
| `src/hooks/useTechnicianData.ts` | Link/route refresh, subscription lifecycle cleanup, authoritative reload after start |
| `src/pages/Routes/RoutesPage.tsx` | Keep open modals mounted through background loading; show deletion rejection reason |
| Database types | Add the two new RPC signatures |

No global order-link uniqueness, participant backfill, historical cleanup,
payroll/collection changes, publication change or service-worker redesign.
Existing function ACLs and security modes are retained; effective resync/populate
replacement for newly RPC-started orders is intentionally rejected by guards.

## Reproducible local checks executed

- `node scripts/test-lifecycle-ordering.mjs`: seven pure ordering behavior
  cases passed, including interleaved new rows and fixed protected anchors.
- `node scripts/test-order-lifecycle.mjs`: actual PostgreSQL 17.4 trigger/RLS
  suite passed. Uses real manager, supervisor, receptionist and team-leader
  roles with captured permissions. Every fixture, injected failure trigger,
  operation and journal entry rolls back.
- `node scripts/test-order-lifecycle-concurrency.mjs`: nine scenarios passed
  using separate actual PostgreSQL sessions. Three rollback serialization
  pairs, both commit orders for team/start and leave/start, an intentionally
  inverted row/advisory deadlock with victim rollback, and opposing transfers
  with snapshots captured before the winner committed.
- TypeScript check and the parent's full tsc/Vite build passed on the final
  source after the modal-refresh fixes and removal of unrelated stray lines.
- The parent installed the complete migration afresh in a second isolated
  database and passed the actual-role acceptance suite. It verified owner,
  SECURITY mode and ACL for all 28 original functions against the captured base.
- `git diff --check` passed.

The SQL suite proves stale delete retry cannot remove a replacement link;
request payload mismatch fails; log/worker failure rolls back start; late
legacy logs/fallbacks and moved participants cannot replace history; unchanged
executed/completed multi-link rows remain untouched; ambiguous changes, null
status, ended routes and cancelled orders fail closed; actual CASCADE deletion
is rejected. It compares complete nonzero vault/custody/paid invoice/item and
attendance rows across scheduling, and injects an actual invoice insertion
failure to prove completion remains committed with the existing WARNING
contract. Participant timestamps, leader identity and leave closure are checked,
and complete participant rows with nonzero ratings/scores are compared across
rejected scheduling, retries and late legacy writes.

The concurrency runner leaves synthetic committed fixtures in the dedicated
offline QA database for review. It does not remove production or historical
data. The parent owns retirement of the entire disposable QA environment.
Both runners refuse arbitrary DB URLs, require the named container with no
published DB ports, and allow only network-none or its dedicated internal
network. Local QA credentials in the runner are synthetic, not deployed keys.

The first default `npm ci --ignore-scripts` failed on the existing redux peer
lock mismatch. `npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund`
installed the locked dependencies without changing package files. No dependency
upgrade or unrelated lint cleanup was performed.
The parent lint attempt found the existing absence of an ESLint configuration;
this is an unavailable project gate, not evidence that the candidate passed lint.

## Independent browser gate

The parent independently tests real local Auth/PostgREST and old/new browser
clients. Its reported focused suite passed seven journeys, including response
loss after commit with exactly the same request UUID on retry even through
background routes:changed, and rejected ff224 legacy deletion while the new
client remained usable. The actual mobile technician start also passed. Retry
payload retention lasts within the same open page; it does not survive a full
reload or closing the tab. Treat the parent's captured evidence and final source
hash as authoritative for that gate; source mocks are not browser qualification.

## Production decisions and limits

1. Supervisor scheduling is intentionally authorized by routes.update plus
   orders.assign, while supervisor start remains denied by orders.update=false.
   This corrects a formerly ignored derived-write error but requires explicit
   business/permission acceptance before production. Team-only and active-user
   boundaries are explicit in the new RPC; no old helper/grant was rewritten.
2. Old context/start/link writes require refresh; no full backwards-compatibility
   claim. Existing administrative resync behavior on newly started orders is
   guarded and must be accepted or given a separate approved path.
3. Global serialization protects the slice but limits throughput; load/lock
   pressure qualification and a deployment/rollback rehearsal remain required.
   Transactions taking rows before the advisory lock can deadlock; the test
   proves rollback, and the client does not silently retry changed data.
4. No real Push/provider delivery, actual payroll run, financial collection/
   refund UAT, backup restoration or production device/PWA rollout was executed.
   The frozen financial checks preserve scheduling effects, not full finance UAT.
5. RPC journal retention, operational monitoring, final role decisions and the
   production release/rollback approval remain separate gates. Completion
   invoice WARNING and existing membership leave semantics are preserved.


## R1/R2 follow-up qualification

Additional files: order-edit-payload.ts; test-order-edit-payload.mjs;
scripts/tests/order-edit-delete.sql; OrderFormModal and shared OrderForm item IDs.
Existing orders/enhanced/lifecycle APIs, migration and contract are updated.
The implementer made no database writes. The SQL script covers rejection before legacy
partial edits/deletes, retained full item rows, replay, cross-order ownership,
expense FK rollback, injected insertion failure, and decimal precision.
Six pure payload cases and final TypeScript check passed. The subsequent
parent qualification below supersedes the earlier pending gate status;
the preceding sections remain chronological evidence of the original slice.
Existing test context insertion now names columns; the forced deadlock test uses
confirmation_notes because legacy notes writes intentionally require refresh.
Financial defects F1–F9 remain outside R1/R2. No commit/push/production action.

### Subsequent independent local qualification — 2026-10-07

Final SQL SHA256:
`65D97DC0DFAB9C1FBB1C57610A4F307B4FC92B62D634C09E1FBDF6BCD0F16796`.
Evidence resides in
`C:/Users/DELL/Documents/Codex/2026-10-07/home-care-r1-r2`.
The actual `build-final.log` confirms the final build passed. The parent
independently verified:

- Fresh complete installation as postgres: 13 new functions and 18 triggers;
  owner, ACL and SECURITY mode for 28 existing functions preserved; 24 checks
  of captured financial function definitions passed unchanged. All 56 captured
  financial constraints matched both the runtime and fresh-install databases.
- 22 acceptance cases, six additional boundary cases, the original SQL suite
  and nine concurrency cases passed. This repository's order-edit-delete.sql
  also passed, using only a QA fixture UUID prefix substitution b→c to avoid
  collision; its fixtures, operations and fault trigger rolled back.
- `ui-results.json`: eight clean browser cases passed with no page errors:
  six actual old/new form, failure and exact-retry journeys, plus manager and
  technician starts on pending routes.
- Three actual HTTP API delete cases passed, covering new/old clients and
  deletion replay after a lost response. These are API journeys, not a visible
  delete-button journey. Four additional real-session edit/start/delete cases
  passed.
- 18 financial cases passed across nine baseline/candidate comparisons.
  Two attendance/bonus cases passed with nonzero contribution 1000, base bonus
  93.75 and rated bonus 75, including automatic route checkout.

The independent reader found no local R1/R2 blocker in this tested scope.
Old forms intentionally require refresh at their first PATCH; even empty
legacy item DELETE is denied. Existing started/completed edits still do not
synchronize an invoice, an independent financial gap retained in this slice.
Financial findings F1–F9 remain outside R1/R2. This qualification does not claim
every application flow is safe.
Full payroll, provider delivery, Storage, Realtime, offline/reload recovery,
capacity, production release and rollback approval remain excluded gates.
