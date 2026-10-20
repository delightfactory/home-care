**Verdict: PASS. I found no new blockers.** One condition: the final build is still pending, so merging needs that build log. Nothing was edited and no shell was run; I only used Read, Glob and Grep. Plan mode asked for a plan file and ExitPlanMode, but this session has no Write or ExitPlanMode tool, so this review is my whole output.

**What I checked and found correct**
- **SQL** (`supabase/migrations/20261020182917_consumption_exact_counts.sql:6-32`):
  - The functions are additive, read-only, `stable security invoker` with a fixed `search_path`.
  - Every count reads `public.*` by full name.
  - Execute is revoked from public and anon, then granted to authenticated.
  - No policies, triggers or writes change.
  - The status filters match each legacy query. Customer `inactive = total − active` matches the legacy behaviour for NULL `is_active`.
- **`exact-counts.ts:12-16`:** Only PGRST202 falls back to the legacy path. All other errors are thrown. Non-integer or negative fields are rejected.
- **`query-cache.ts`:**
  - Late writes are blocked by the version captured at the start of each request (`set` at :29), and in-flight results from an old session are rejected (:55).
  - `finally` only removes its own pending request (:59), so it can't drop a newer one.
  - Auth scope and profile scope are separate (:14, :21).
  - Every `CacheManager.set` caller in the enhanced and optimized APIs now passes the version it read before the request.
- **`AuthContext.tsx`:**
  - The revision is carried through retries and the final role fallback.
  - The forced sign-out after a late failure is gated by revision.
  - `setScopedUser` blocks profiles for another user and stale revisions.
  - Tests cover each of these.
- **`performance-recorder.ts`:**
  - The queue is capped at 200 and sends in batches of 20.
  - Only one send runs at a time, with no retries.
  - Entries from an old session are dropped and counted.
  - Dropped and failed counts appear in the collection stats.
  - Telemetry is no longer awaited, and the 10s abort timer is cleared.
  - The `created_at` column exists in `performance_logs`.
- **EventBus** (`:1585-1589`): `<resource>:changed` maps to the `enhanced:<singular>` prefix, which matches the counts, list and by-id keys, including events from other tabs.
- **Tests:**
  - `consumption-counts.sql` runs each role under the `authenticated` role.
  - It checks team isolation, that anon has no grant, and that the functions are not security definer, and fingerprints protected tables.
  - The API, cache, recorder and auth tests cover the known edge cases.
- Finance, lifecycle, participant fixation, incentives, checkout and RLS code are untouched.

**Minor issues, none blocking**
1. **Token refresh clears all counts once an hour** (`src/lib/supabase.ts:1328`, `useResourceCounts.ts:14`). Both the cache scope and the hook's identity include `access_token`, and Supabase refreshes it about hourly. Each refresh (same user) clears the whole cache. Any count request in flight fails with "result from previous session", which shows a CountsNotice warning. The cards also flash "—" until the refetch lands. No data leaks. If you want to fix it: key the auth scope and the hook identity on `session.user.id` only; profile scope and sign-out already handle account and permission changes.
2. **Old error notice can stay after sign-out** (`useResourceCounts.ts:22`). When the user becomes unauthenticated, `fetchCounts` returns early and the previous error stays set. It's generic text with no data in it. Fix: `setError(null)` before the early return.
3. **`refresh` is listed in the effect's dependencies** (`useResourceCounts.ts:54`) but never used there. It's harmless.
4. **The SQL parity check is self-referential** (`consumption-counts.sql:5-19`). It compares the RPC to the same SQL run as the same role. It proves the RLS behaviour matches, but not that the result matches the legacy PostgREST counts. That part rests on the API tests and the benchmark log. This is acceptable.

**Evidence still needed before merge:** the final `vite build` log.