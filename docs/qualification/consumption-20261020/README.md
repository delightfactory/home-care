# Home Care consumption qualification — 20 October 2026

Status: implementation and isolated qualification complete; production release and post-release IO acceptance are pending. No production migration, data deletion, permission change, subscription upgrade, commit, push or deployment was performed by this run.

## Source and production identity

- Source base: `be6887d329f7628b503e53309348c7f520afe6b5`.
- Verified published deployment: `dpl_HTxZ982ek4viajSwsaoDZXAhnQMB`, READY, main, same source SHA.
- Application: `https://homecare.delight-world.com`.
- Vercel project: `prj_ICr8yaoLNNbhxE6lhhVeHKoUivLv`, team `team_AYQTvxuQJ1EepKxDVhzjX1ew`.
- Supabase: `gojvsvkleenaipzirhsm`, home-care, organization `gncxzuipjoyqrjyhzwgf`.
- Active source/dependencies/evidence were kept outside OneDrive under `%LOCALAPPDATA%/ai-dev-workflow/runs/home-care-io-20261020/`.
- `source-manifest.json` identifies candidate source bytes; the source base SHA alone does not identify the uncommitted changes.

## Changes and protected contracts

| Area | Implemented change | Preserved / guarded behavior |
|---|---|---|
| Exact counts | One read-only RPC per resource: orders, routes, customers, expenses | Existing status fields, exact totals, NULL customer-active semantics, caller table grants/RLS |
| Old/new clients | Missing RPC `PGRST202` alone selects the legacy exact-count path | Permission, timeout, network and malformed-result failures remain failures |
| Cache | Existing cache extracted, concurrent count reads shared, versioned writes fenced | Existing TTLs; an invalidated result cannot refill the cache or remove a newer pending read |
| Auth/profile | Central cache scope reset on identity/profile changes; auth revision carried through retries/fallbacks | Late initial sessions, old accounts and stale same-account permissions cannot replace current state or sign out a newer session |
| Mutation refresh | Changed-resource events invalidate before notifying consumers, including cross-tab events | Manual refresh and the existing one-minute count refresh remain available; no slower polling policy introduced |
| Notifications | Shared provider/inbox, single subscription, burst reconciliation and idempotent local changes | Existing public hook shape, notification links/actions, authoritative unread count, reconnect/online recovery |
| Failure UI | Explicit retry notices; unavailable global counts use an em dash | No partial-page counts presented as global counts, no successful zero substituted for failed reads; filtered expense statistics remain intact |
| Performance records | Nonblocking delivery, batches of at most 20, bounded queue of 200, one send, ten-second send deadline | Existing individual record fields and slow-query threshold; collection exposes queued/written/dropped/failed counts; no audit/operational record policy changed |

No lifecycle, financial, attendance, participant, incentive, checkout or existing RLS policy SQL was changed. The new migration creates four additive `STABLE SECURITY INVOKER` functions and grants only authenticated execution. Its fixed `pg_catalog, public, pg_temp` search path also keeps existing permission helpers' unqualified `users`/`roles` references functional. An empty search path was rejected by isolated testing before production.

Notification startup is one shared source/subscription, not an unconditional single snapshot: if `SUBSCRIBED` arrives during the first snapshot, a second reconciliation closes the subscribe/read gap. Realtime delivery, Push infrastructure and service-worker Push handling were not redesigned.

Telemetry is best-effort diagnostics: queue overflow, failed sends or navigation can lose measurements. Bounded losses are visible in collection statistics; this mechanism does not carry financial or audit records. Auth-token refresh conservatively invalidates cache even for the same user.

## Executed qualification

| Gate | Result |
|---|---|
| Core cache/recorder/monitoring tests | 9 passed |
| Actual OrdersAPI / exact-count boundary tests | 10 passed, including missing-RPC fallback and permission/timeout/network/malformed-result failures |
| Actual AuthProvider tests | 6 passed, including same-account out-of-order permissions and stale final-RPC resolution/rejection |
| Actual notification provider/store tests | 11 passed |
| Exact SQL count parity | Seven roles, restricted-team isolation, anonymous execution denied, invoker mode, protected fingerprints passed |
| Existing DB regression suites | `order-lifecycle.sql`, `route-extension.sql`, `route-extension-membership.sql`, `order-edit-delete.sql` passed |
| Migration recovery | Candidate apply, explicit rollback, replay, enclosing rollback passed in the isolated database |
| Existing payload/presentation regression checks | Order edit payload and audit presentation checks passed |
| TypeScript | Full project typecheck passed |
| Vite production compilation | Passed; existing large-chunk/Browserslist warnings remain |
| Repository lint | Cannot run as configured: repository has no ESLint configuration; not reported as a pass |
| Focused React hooks lint | Zero errors; existing Auth effect dependency and non-DOM request-epoch cleanup warnings documented |
| Independent review | Fresh Codex review PASS after Auth fixes; fresh Claude read-only review PASS with final-build evidence condition subsequently satisfied; read-only mutation check false |

The synthetic database is `homecare_io_test`, cloned from the existing synthetic `homecare_lifecycle_test` inside `homecare-order-lifecycle-qa` (network `none`, no published ports). The original QA database was preserved. Its older synthetic schema required local owner-access repairs and missing already-published lifecycle/audit source before regression testing. Those preparations are restricted to the clone by the test runner. A separate namespace avoids old synthetic edit fixtures. No production data was used in tests. Every fixture/benchmark transaction rolls back.

Node React tests render real providers with null consumers and a minimal DOM; they mock the Supabase/Auth boundary, not the store. React scheduler ports require the harness's forced test-process exit; listener/pending-request cleanup is asserted explicitly. They do not replace a complete production-browser or mobile UAT.

## Browser observations

The real browser loaded `scripts/tests/consumption-ui/index.html` through a loopback-only Vite server, using real NotificationBell, provider, count hook, OrdersAPI and cache with a synthetic Supabase boundary.

- Two count consumers displayed 13 from one count RPC. Bell/panel shared one inbox and channel; opening the panel did not duplicate reads.
- Marking one of two notifications read changed both badge/list to one.
- Simulated read failure retained the last-good counts and showed retry/error states.
- Switching accounts while offline hid the previous user's counts and notifications immediately.
- Recovery displayed only the second account's count (2) and notification (1).
- Unmount reduced subscriptions to zero; subsequent INSERT/online events made no reads.

This browser fixture does not test a live PostgREST HTTP connection or a full application role journey. SQL role tests cover persistence/RLS separately. No claim of complete regression coverage for every unchanged application screen is made.

## Measured result and evidence limits

`scripts/tests/consumption-benchmark.sql` tested 12,087 synthetic orders under an authenticated manager with five warm runs per path:

- Legacy order counts: six database requests, mean 65.07 ms.
- Aggregated order counts: one database request, mean 30.99 ms.
- Database-request reduction for this operation: 83.3%; local execution-time reduction: about 52.4%.

These are local measurements, not production latency or physical IO savings. The production Disk IO Budget percentage, IOPS and throughput charts were unavailable during diagnosis. Do not state that the warning is resolved or estimate time-to-exhaustion from these tests.

`prechange-metrics.json` contains read-only production statistics at 18:31:24 UTC. Counters are cumulative since June; compare deltas and reset identities, not lifetime totals. `scripts/diagnostics/consumption-snapshot.sql` captures bounded metadata without resetting statistics or scanning operational tables. Export two results as JSON and run:

```text
node scripts/compare-consumption.mjs before.json after.json
```

Compare matched workload/peak windows and dashboard IO budget/IOWait/swap alongside API p95/p99, timeout rate, count request rate and telemetry writes. The comparison script rejects reset/decreasing counters. A PostgreSQL block hit/read counter is not physical-disk utilization or a burst-credit balance.

## Release and rollback gate

1. Revalidate current production SHA/project/schema and candidate source manifest. Reconcile any intervening changes before release.
2. Verify a fresh independent database backup and required Storage originals, plus restore evidence, before production migration. No new independent production backup was created in this implementation-only run.
3. After release authorization, apply only `20261020182917_consumption_exact_counts.sql` to the verified project. It is additive/transactional with a two-second lock timeout; do not edit existing policies or operational rows. Verify invoker ownership/configuration, grants and role parity.
4. Publish the qualified frontend through the project's normal Git/Vercel release path. Confirm the new deployment SHA, Supabase ref and service-worker version. Keep old/new browser compatibility; do not force-clear application data or interrupt in-progress work.
5. Perform authorized production smoke checks with controlled roles and reconcile persisted outcomes. Observe a matched peak window and a full operating day before closing production IO acceptance.
6. Roll back immediately on authorization leakage, changed counts under a stable snapshot, duplicated financial/operational effects or broken lifecycle transitions. First restore the previous frontend deployment and retain the additive read-only RPCs. If function removal is required, `scripts/diagnostics/consumption-rollback.sql` removes only the four new functions; the new client handles a missing RPC. Never restore the entire database over live orders for a frontend regression.

No load testing, broad data hashing, VACUUM FULL, speculative indexes, retention-period changes, service disabling or paid compute upgrade is included in this release. Inspect plans first if further SQL/index optimization is justified. Larger compute remains a separate cost decision if measured sustained load or burst-credit depletion persists.

## Separate quota finding

The Supabase Usage page was rechecked on 20 October: organization grace warning still says prior-cycle **Storage Size Exceeded**, with possible `402` restrictions from **12 November 2026 if over quota persists**. Current displayed Storage is 0.332/1 GB (33%), current overage zero. Database quota is separate: summary 0.352/0.5 GB (70%), with Home Care listed at 335.79 MB. This is also distinct from the provisioned physical disk and IO budget. No deletion/upgrade or assertion that the grace warning cleared was made.

Recheck the warning before its deadline; if it persists despite below-quota Storage, resolve the status through Supabase support/account administration. Sending a support message is not authorized by this task. The upcoming log-ingestion allowance is displayed separately and is not the stated cause of the current Storage grace warning.

## Existing concerns outside this change

- The existing `get_unread_notifications_count(p_user_id)` is SECURITY DEFINER and does not visibly verify the parameter against the caller. New provider reads verify their own user, but server-side enforcement needs a separate scoped security repair and caller review.
- Existing `performance_logs` has a disabled-RLS advisor finding. This run did not broaden grants or alter existing clients' access.
- Service-worker Push and in-app browser notifications have different tags; eliminating that existing duplicate-delivery possibility requires a separate Push delivery review.

Do not weaken permissions or remove evidence to make these findings disappear.
