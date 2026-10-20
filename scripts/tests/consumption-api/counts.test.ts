import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { OrdersAPI } from '../../../src/api/orders';
import { boundary } from './supabase';

beforeEach(() => {
  boundary.reads = [];
  boundary.rpcError = null;
  boundary.rpcData = { total: 7, pending: 1, scheduled: 1, in_progress: 1, completed: 1, cancelled: 1 };
});

test('aggregate response keeps the public count contract with one database request', async () => {
  assert.deepEqual(await OrdersAPI.getCounts(), boundary.rpcData);
  assert.deepEqual(boundary.reads, ['get_order_counts']);
});

test('old database uses exact legacy counts only when the new RPC is absent', async () => {
  boundary.rpcError = { code: 'PGRST202', message: 'function absent' };
  assert.deepEqual(await OrdersAPI.getCounts(), { total: 7, pending: 1, scheduled: 1, in_progress: 1, completed: 1, cancelled: 1 });
  assert.equal(boundary.reads.filter(name => name === 'orders').length, 6);
});

for (const code of ['42501', '57014', 'PGRST301', '']) {
  test(`permission/timeout/network error ${code || 'network'} is visible without fallback or fake zero`, async () => {
    boundary.rpcError = { code, message: 'unavailable' };
    await assert.rejects(OrdersAPI.getCounts(), /unavailable/);
    assert.deepEqual(boundary.reads, ['get_order_counts']);
  });
}

for (const payload of [null, {}, { total: -1 }, { total: 7, pending: '1', scheduled: 1, in_progress: 1, completed: 1, cancelled: 1 }]) {
  test(`invalid count payload ${JSON.stringify(payload)} is rejected`, async () => {
    boundary.rpcData = payload;
    await assert.rejects(OrdersAPI.getCounts(), /إحصائيات/);
    assert.deepEqual(boundary.reads, ['get_order_counts']);
  });
}
