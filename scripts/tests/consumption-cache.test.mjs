import test from 'node:test';
import assert from 'node:assert/strict';
import { CacheManager } from '../../src/utils/query-cache.ts';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('simultaneous consumers share one read; failures can be retried', async () => {
  CacheManager.clear();
  const response = deferred();
  let reads = 0;
  const query = () => { reads++; return response.promise; };
  const first = CacheManager.load('orders', query, 60000);
  const second = CacheManager.load('orders', query, 60000);
  response.resolve({ total: 7 });
  assert.deepEqual(await first, { total: 7 });
  assert.deepEqual(await second, { total: 7 });
  assert.equal(reads, 1);
  await CacheManager.load('orders', query, 60000);
  assert.equal(reads, 1);
  await assert.rejects(CacheManager.load('failed', () => Promise.reject(Error('offline')), 60000), /offline/);
  assert.equal(await CacheManager.load('failed', () => Promise.resolve(9), 60000), 9);
});

test('invalidated requests cannot repopulate cache or remove a newer pending read', async () => {
  CacheManager.clear();
  const oldResponse = deferred(), newResponse = deferred();
  const oldRead = CacheManager.load('orders', () => oldResponse.promise, 60000);
  CacheManager.invalidate('orders');
  const newRead = CacheManager.load('orders', () => newResponse.promise, 60000);
  oldResponse.resolve(1);
  await oldRead;
  assert.equal(CacheManager.get('orders'), null);
  const joined = CacheManager.load('orders', () => Promise.reject(Error('duplicate read')), 60000);
  newResponse.resolve(2);
  assert.equal(await joined, 2);
  assert.equal(await newRead, 2);
  assert.equal(CacheManager.get('orders'), 2);
});

test('account and permission changes reject late results and clear cached private data', async () => {
  for (const switchScope of [() => CacheManager.setScope('account-b'), () => CacheManager.setProfileScope('restricted-role')]) {
    CacheManager.setScope('account-a');
    CacheManager.setProfileScope('manager-role');
    CacheManager.set('private', { total: 100 });
    const delayed = deferred();
    const pending = CacheManager.load('private:pending', () => delayed.promise, 60000);
    const rejected = assert.rejects(pending, /الجلسة السابقة/);
    switchScope();
    delayed.resolve({ total: 100 });
    await rejected;
    assert.equal(CacheManager.get('private'), null);
    assert.equal(CacheManager.get('private:pending'), null);
  }
});

test('expired and pre-invalidation manual writes cannot return stale data', () => {
  CacheManager.clear();
  const previousVersion = CacheManager.version;
  CacheManager.invalidate('orders');
  CacheManager.set('orders', 3, 60000, previousVersion);
  assert.equal(CacheManager.get('orders'), null);
  CacheManager.set('orders', 4, 60000);
  CacheManager.set('orders', null, 0);
  assert.equal(CacheManager.get('orders'), null);
  assert.equal(CacheManager.getStats().keys.includes('orders'), false);
});
