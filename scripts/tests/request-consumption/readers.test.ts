import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { EnhancedAPI } from '../../../src/api/enhanced-api';
import { CacheManager } from '../../../src/utils/query-cache';
import { eventBus } from '../../../src/utils/EventBus';
import { transport } from './supabase';
import { performanceMonitor } from '../../../src/utils/performance';
import { supabase as authClient } from '../../../src/lib/supabase';
import { authEvents } from './auth-sdk';

void authClient;

after(() => {
  for (const timer of (globalThis as unknown as { __qaIntervals: ReturnType<typeof setInterval>[] }).__qaIntervals) clearInterval(timer);
});

const response = (rows: unknown[] = [], status = 200) => new Response(JSON.stringify(rows), {
  status, headers: { 'content-type': 'application/json', 'content-range': `*/${rows.length}` },
});
const deferred = () => {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>(yes => { resolve = yes; });
  return { promise, resolve };
};
const untilRequests = async (count: number) => {
  for (let i = 0; i < 100 && transport.calls.length < count; i++) await nextTurn();
  assert.equal(transport.calls.length, count);
};
beforeEach(() => {
  CacheManager.setScope('synthetic-user-a');
  CacheManager.setProfileScope('synthetic-reader');
  CacheManager.clear();
  transport.calls = [];
  transport.reply = async () => response();
});

const readers = [
  ['orders', () => EnhancedAPI.getOrders()], ['customers', () => EnhancedAPI.getCustomers()],
  ['workers', () => EnhancedAPI.getWorkers()], ['teams', () => EnhancedAPI.getTeams()],
  ['routes', () => EnhancedAPI.getRoutes()], ['expenses', () => EnhancedAPI.getExpenses()],
  ['services', () => EnhancedAPI.getServices()],
] as const;

for (const [name, read] of readers) {
  test(`${name}: eight simultaneous consumers share one HTTP read and retain output`, async () => {
    const network = deferred();
    transport.reply = () => network.promise;
    const pending = Array.from({ length: 8 }, read);
    await untilRequests(1);
    network.resolve(response());
    const results = await Promise.all(pending);
    for (const result of results) assert.deepEqual(result, results[0]);
    await read();
    assert.equal(transport.calls.length, 1);
  });
}

test('filter, page, detail and salary variants remain distinct HTTP requests', async () => {
  await Promise.all([
    EnhancedAPI.getOrders({ status: ['pending'] }), EnhancedAPI.getOrders({ status: ['scheduled'] }),
    EnhancedAPI.getOrders(undefined, 2), EnhancedAPI.getOrders(undefined, 1, 20, true),
    EnhancedAPI.getWorkers(undefined, true, false), EnhancedAPI.getWorkers(undefined, true, true),
  ]);
  assert.equal(transport.calls.length, 6);
  const selections = transport.calls.filter(r => r.table === 'workers').map(r => r.url.searchParams.get('select')!);
  assert.equal(selections.filter(select => select.split(',').includes('salary')).length, 1);
});

test('manual no-cache reads do not join or populate a cached request', async () => {
  const network = deferred();
  transport.reply = () => transport.calls.length === 1 ? network.promise : Promise.resolve(response([{ id: 'fresh-service' }]));
  const cached = EnhancedAPI.getServices();
  await untilRequests(1);
  const bypass = await EnhancedAPI.getServices(false);
  assert.equal(bypass[0].id, 'fresh-service');
  assert.equal(transport.calls.length, 2);
  network.resolve(response());
  await cached;
  assert.deepEqual(await EnhancedAPI.getServices(), []);
});

for (const change of [() => CacheManager.setScope('synthetic-user-b'), () => CacheManager.setProfileScope('restricted')]) {
  test('session or permission change rejects a late shared read', async () => {
    const network = deferred();
    transport.reply = () => network.promise;
    const pending = EnhancedAPI.getServices();
    const rejected = assert.rejects(pending, /الجلسة السابقة/);
    await untilRequests(1);
    change();
    network.resolve(response([{ id: 'private-old-result' }]));
    await rejected;
    transport.reply = async () => response([{ id: 'new-scope-result' }]);
    const current = await EnhancedAPI.getServices();
    assert.equal(current[0].id, 'new-scope-result');
  });
}

test('mutation event detaches the old read and prevents stale cache refill', async () => {
  const oldNetwork = deferred(), newNetwork = deferred();
  transport.reply = () => transport.calls.length === 1 ? oldNetwork.promise : newNetwork.promise;
  const old = EnhancedAPI.getServices();
  await untilRequests(1);
  eventBus.emit('services:changed');
  const fresh = EnhancedAPI.getServices();
  await untilRequests(2);
  oldNetwork.resolve(response([{ id: 'before-write' }]));
  await old;
  newNetwork.resolve(response([{ id: 'after-write' }]));
  await fresh;
  assert.equal((await EnhancedAPI.getServices())[0].id, 'after-write');
  assert.equal(transport.calls.length, 2);
});

test('HTTP failures reach all consumers and the next call retries', async () => {
  transport.reply = async () => new Response(JSON.stringify({ message: 'offline', code: '57014' }), { status: 503 });
  const result = await Promise.allSettled([EnhancedAPI.getServices(), EnhancedAPI.getServices()]);
  assert.ok(result.every(r => r.status === 'rejected'));
  assert.equal(transport.calls.length, 1);
  transport.reply = async () => response([{ id: 'retried' }]);
  assert.equal((await EnhancedAPI.getServices())[0].id, 'retried');
  assert.equal(transport.calls.length, 2);
});

test('expiry preserves the original ten-minute services refresh', async t => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  await EnhancedAPI.getServices();
  now += 599999;
  await EnhancedAPI.getServices();
  assert.equal(transport.calls.length, 1);
  now++;
  await EnhancedAPI.getServices();
  assert.equal(transport.calls.length, 2);
});

test('real auth binding renews a token during a shared read without exposing stale data or an error', async () => {
  authEvents.emit('SIGNED_IN', { user: { id: 'synthetic-user-a' }, access_token: 'token-1' });
  const oldNetwork = deferred(), freshNetwork = deferred();
  transport.reply = () => transport.calls.length === 1 ? oldNetwork.promise : freshNetwork.promise;
  const pending = Array.from({ length: 8 }, () => EnhancedAPI.getServices());
  await untilRequests(1);
  authEvents.emit('TOKEN_REFRESHED', { user: { id: 'synthetic-user-a' }, access_token: 'token-2' });
  const current = EnhancedAPI.getServices();
  await untilRequests(2);
  oldNetwork.resolve(response([{ id: 'old-token-data' }]));
  freshNetwork.resolve(response([{ id: 'current-token-data' }]));
  const results = await Promise.all([...pending, current]);
  assert.ok(results.every(rows => rows[0].id === 'current-token-data'));
  assert.equal(transport.calls.length, 2);
});

test('repeated token changes stop after one retry rather than looping', async () => {
  authEvents.emit('SIGNED_IN', { user: { id: 'synthetic-user-a' }, access_token: 'token-1' });
  const first = deferred(), second = deferred();
  transport.reply = () => transport.calls.length === 1 ? first.promise : second.promise;
  const pending = EnhancedAPI.getServices();
  const rejected = assert.rejects(pending, /الجلسة السابقة/);
  await untilRequests(1);
  authEvents.emit('TOKEN_REFRESHED', { user: { id: 'synthetic-user-a' }, access_token: 'token-2' });
  first.resolve(response([{ id: 'stale-1' }]));
  await untilRequests(2);
  authEvents.emit('TOKEN_REFRESHED', { user: { id: 'synthetic-user-a' }, access_token: 'token-3' });
  second.resolve(response([{ id: 'stale-2' }]));
  await rejected;
  assert.equal(transport.calls.length, 2);
});

test('signout and signin to the same account never retry the old session request', async () => {
  authEvents.emit('SIGNED_IN', { user: { id: 'synthetic-user-a' }, access_token: 'token-1' });
  const network = deferred();
  transport.reply = () => network.promise;
  const pending = EnhancedAPI.getServices();
  const rejected = assert.rejects(pending, /الجلسة السابقة/);
  await untilRequests(1);
  authEvents.emit('SIGNED_OUT', null);
  authEvents.emit('SIGNED_IN', { user: { id: 'synthetic-user-a' }, access_token: 'token-2' });
  network.resolve(response([{ id: 'previous-session' }]));
  await rejected;
  assert.equal(transport.calls.length, 1);
});

for (const lifecycle of ['pagehide', 'visibilitychange']) {
  test(`${lifecycle}: pending measurements flush without changing business results`, async t => {
    let clock = 0;
    t.mock.method(performance, 'now', () => clock);
    for (let i = 0; i < 3; i++) {
      const result = await performanceMonitor.monitorQuery(`synthetic.slow.${i}`, async () => { clock += 1500; return i; });
      assert.equal(result, i);
    }
    assert.equal(transport.calls.length, 0);
    if (lifecycle === 'pagehide') window.dispatchEvent(new Event('pagehide'));
    else {
      Object.assign(document, { visibilityState: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.assign(document, { visibilityState: 'visible' });
    }
    await untilRequests(1);
    assert.equal(transport.calls[0].table, 'performance_logs');
    assert.equal(transport.calls[0].method, 'POST');
    const entries = JSON.parse(transport.calls[0].body!);
    assert.equal(entries.length, 3);
    assert.deepEqual(entries.map((e: {execution_time_ms:number}) => e.execution_time_ms), [1500,1500,1500]);
    assert.ok(entries.every((e: {created_at:string; query_hash:string}) => e.created_at && e.query_hash));
    for (let turn = 0; performanceMonitor.getCollectionStats().sending && turn < 100; turn++) await nextTurn();
    assert.equal(performanceMonitor.getCollectionStats().sending, false);
  });
}
