import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AuthProvider, useAuth } from '../../../src/contexts/AuthContext';
import { CacheManager } from '../../../src/utils/query-cache';
import { authBoundary, sessionFor, emitSession, completeProfile, failProfile, resetAuthBoundary } from './auth-supabase';

const win = Object.assign(new EventTarget(), { HTMLIFrameElement: class {}, document: { activeElement: null } });
Object.assign(globalThis, { window: win, document: win.document, IS_REACT_ACT_ENVIRONMENT: true });
const container: any = { nodeType: 1, tagName: 'DIV', ownerDocument: { addEventListener() {}, removeEventListener() {} }, addEventListener() {}, removeEventListener() {} };
let snapshot: ReturnType<typeof useAuth>;
const Probe = () => { snapshot = useAuth(); return null; };
let root: Root;
const flush = () => act(async () => { await new Promise(resolve => setImmediate(resolve)); });
beforeEach(async () => {
  resetAuthBoundary();
  CacheManager.clear();
  root = createRoot(container);
  await act(async () => root.render(<AuthProvider><Probe /></AuthProvider>));
});
afterEach(async () => {
  await act(async () => root.unmount());
  assert.equal(authBoundary.listeners.size, 0);
  assert.equal(authBoundary.profiles.length, 0);
  assert.equal(authBoundary.roleRequests.length, 0);
});

test('a late initial session cannot replace a newer sign-in', async () => {
  await act(async () => emitSession('b'));
  await act(async () => completeProfile('b'));
  await act(async () => authBoundary.initial.resolve({ data: { session: sessionFor('a') } }));
  await flush();
  assert.equal(snapshot.user?.id, 'b');
  assert.equal(snapshot.session?.user.id, 'b');
  assert.equal(authBoundary.profiles.some(request => request.id === 'a'), false);
});

test('a previous account profile cannot reinstall its cache scope or user after switching', async () => {
  await act(async () => authBoundary.initial.resolve({ data: { session: sessionFor('a') } }));
  await act(async () => emitSession('b'));
  await act(async () => completeProfile('b'));
  CacheManager.set('enhanced:reports', { confidential: 'b' });
  const version = CacheManager.scopeVersion;
  await act(async () => completeProfile('a'));
  assert.equal(snapshot.user?.id, 'b');
  assert.equal(CacheManager.scopeVersion, version);
  assert.deepEqual(CacheManager.get('enhanced:reports'), { confidential: 'b' });
});

test('same-account permission changes clear reports even without a mounted count hook', async () => {
  await act(async () => authBoundary.initial.resolve({ data: { session: sessionFor('a') } }));
  await act(async () => completeProfile('a'));
  CacheManager.set('enhanced:reports', { total: 99 });
  await act(async () => emitSession('a'));
  await act(async () => completeProfile('a', { orders: { read: false } }));
  assert.equal(CacheManager.get('enhanced:reports'), null);
  assert.equal(snapshot.user?.id, 'a');
});

test('an older same-account permission response cannot replace a newer profile', async () => {
  await act(async () => authBoundary.initial.resolve({ data: { session: sessionFor('a') } }));
  await act(async () => emitSession('a'));
  await act(async () => completeProfile('a', { orders: { read: false } }, true));
  const version = CacheManager.scopeVersion;
  await act(async () => completeProfile('a', { orders: { read: true } }));
  assert.equal((snapshot.user as any).role.permissions.orders.read, false);
  assert.equal(CacheManager.scopeVersion, version);
});

for (const outcome of ['resolve', 'reject'] as const) {
  test(`a stale final role fallback cannot install or sign out another account on ${outcome}`, async () => {
    await act(async () => authBoundary.initial.resolve({ data: { session: sessionFor('a') } }));
    authBoundary.holdRole = true;
    for (let attempt = 0; attempt < 3; attempt++) {
      await act(async () => failProfile('a'));
      if (attempt < 2) await act(async () => { await new Promise(resolve => setTimeout(resolve, 320)); });
    }
    assert.equal(authBoundary.roleRequests.length, 1);
    await act(async () => emitSession('b'));
    await act(async () => completeProfile('b'));
    const roleRequest = authBoundary.roleRequests.shift()!;
    await act(async () => {
      if (outcome === 'resolve') roleRequest.resolve({ data: 'manager', error: null });
      else roleRequest.reject(Error('role offline'));
    });
    assert.equal(snapshot.user?.id, 'b');
    assert.equal(snapshot.session?.user.id, 'b');
    assert.equal(authBoundary.signOuts, 0);
  });
}
