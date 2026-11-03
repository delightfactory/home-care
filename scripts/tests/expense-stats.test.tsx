import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { ExpensesAPI } from '../../src/api/expenses';
import { EnhancedAPI } from '../../src/api/enhanced-api';
import { useFilteredExpenseStats } from '../../src/hooks/useEnhancedAPI';
import { CacheManager } from '../../src/utils/query-cache';
import { eventBus } from '../../src/utils/EventBus';
import { transport } from './request-consumption/supabase';
import type { ExpenseFilters } from '../../src/types';
import ExpensesPage from '../../src/pages/Expenses/ExpensesPage';
import { pageBoundary } from './expense-stats-page-boundary';

const totals = { totalAmount: 12.3, totalCount: 3, pendingCount: 1, approvedCount: 1, rejectedCount: 1 };
const json = (value: unknown, status = 200, total?: number) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json', ...(total === undefined ? {} : { 'content-range': `0-0/${total}` }) },
});
const missing = (code = 'PGRST202', name = 'get_filtered_expense_stats') => json({
  code, message: `Could not find the function public.${name}(p_filters) in the schema cache`,
}, 404);
const deferred = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>(yes => { resolve = yes; });
  return { promise, resolve };
};
const untilCalls = async (n: number) => {
  for (let i = 0; i < 100 && transport.calls.length < n; i++) await nextTurn();
  assert.equal(transport.calls.length, n);
};
beforeEach(() => {
  pageBoundary.auth = {
    user: { id: 'stats-user', role_id: 'reader', is_active: true, role: { name: 'manager', permissions: { expenses: { read: true } } } },
    session: { user: { id: 'stats-user' }, access_token: 'token-1' },
  };
  CacheManager.setScope('stats-user:token-1');
  CacheManager.setProfileScope('expense-reader');
  CacheManager.clear();
  transport.calls = [];
  transport.reply = async () => json(totals);
});
after(() => {
  for (const timer of (globalThis as unknown as { __qaIntervals: ReturnType<typeof setInterval>[] }).__qaIntervals) clearInterval(timer);
  // React's browser scheduler owns MessagePorts in this Node-hosted DOM fixture.
  for (const channel of (globalThis as unknown as { __qaChannels: MessageChannel[] }).__qaChannels) {
    channel.port1.close();
    channel.port2.close();
  }
});

test('infinite amount filters fail before serialization can broaden the search', async () => {
  await assert.rejects(ExpensesAPI.getFilteredStats({ amount_min: Infinity }), /مبلغًا صحيحًا/);
  await assert.rejects(ExpensesAPI.getFilteredStats({ amount_max: -Infinity }), /مبلغًا صحيحًا/);
  assert.equal(transport.calls.length, 0);
});

test('NaN amount filters keep the existing falsy-filter behavior', async () => {
  assert.deepEqual(await ExpensesAPI.getFilteredStats({ amount_max: NaN }), totals);
  assert.deepEqual(JSON.parse(transport.calls[0].body!), { p_filters: { amount_max: null } });
});

test('one aggregate RPC preserves the public statistics contract and UTC filter bounds', async () => {
  const filters: ExpenseFilters = { status: ['pending'], category_id: 'category-a', team_id: 'team-a', date_from: '2026-10-01', date_to: '2026-10-31', amount_min: 0, amount_max: 25, search: 'a_%' };
  assert.deepEqual(await ExpensesAPI.getFilteredStats(filters), totals);
  assert.equal(transport.calls.length, 1);
  assert.equal(transport.calls[0].table, 'get_filtered_expense_stats');
  assert.deepEqual(JSON.parse(transport.calls[0].body!), { p_filters: { ...filters, date_from: '2026-10-01T00:00:00.000Z', date_to: '2026-10-31T23:59:59.999Z' } });
  assert.equal(filters.date_from, '2026-10-01');
});

for (const payload of [null, {}, { ...totals, totalAmount: '12.3' }, { ...totals, totalCount: -1 }, { ...totals, totalCount: 0 }, { ...totals, pendingCount: 1.5 }]) {
  test(`invalid aggregate result is an error: ${JSON.stringify(payload)}`, async () => {
    transport.reply = async () => json(payload);
    await assert.rejects(ExpensesAPI.getFilteredStats(), /إحصائيات/);
    assert.equal(transport.calls.length, 1);
  });
}

for (const code of ['42501', '57014', 'PGRST301', '42883']) {
  test(`permission/network/internal missing-function error ${code} never falls back`, async () => {
    transport.reply = async () => json({ code, message: 'nested_helper() failed' }, 503);
    await assert.rejects(ExpensesAPI.getFilteredStats(), /nested_helper/);
    assert.equal(transport.calls.length, 1);
  });
}

for (const code of ['PGRST202', '42883']) {
  test(`missing aggregate RPC ${code} remains an error without downloading partial rows`, async () => {
    transport.reply = async () => missing(code);
    await assert.rejects(ExpensesAPI.getFilteredStats(), /get_filtered_expense_stats/);
    assert.equal(transport.calls.length, 1);
    assert.equal(transport.calls[0].table, 'get_filtered_expense_stats');
  });
}

test('an empty aggregate remains a valid zero rather than unavailable data', async () => {
  const zero = { totalAmount: 0, totalCount: 0, pendingCount: 0, approvedCount: 0, rejectedCount: 0 };
  transport.reply = async () => json(zero);
  assert.deepEqual(await ExpensesAPI.getFilteredStats(), zero);
});

test('aggregate cache shares identical reads, separates filters and invalidates on expense events', async () => {
  await Promise.all(Array.from({ length: 8 }, () => EnhancedAPI.getFilteredExpenseStats({ status: ['pending'] })));
  assert.equal(transport.calls.length, 1);
  await EnhancedAPI.getFilteredExpenseStats({ status: ['approved'] });
  assert.equal(transport.calls.length, 2);
  eventBus.emit('expenses:changed');
  await EnhancedAPI.getFilteredExpenseStats({ status: ['pending'] });
  assert.equal(transport.calls.length, 3);
  await EnhancedAPI.getFilteredExpenseStats({ status: ['pending'] }, false);
  assert.equal(transport.calls.length, 4);
});

test('aggregate cache rejects an old account result and refetches current-account data', async () => {
  const pending = deferred();
  transport.reply = () => pending.promise;
  const result = EnhancedAPI.getFilteredExpenseStats();
  const rejected = assert.rejects(result, /الجلسة السابقة/);
  await untilCalls(1);
  CacheManager.setScope('different-user:token-1');
  pending.resolve(json(totals));
  await rejected;
  transport.reply = async () => json({ ...totals, totalAmount: 99 });
  assert.equal((await EnhancedAPI.getFilteredExpenseStats()).totalAmount, 99);
});

const container: any = { nodeType: 1, tagName: 'DIV', ownerDocument: { addEventListener() {}, removeEventListener() {} }, addEventListener() {}, removeEventListener() {} };
let hook: ReturnType<typeof useFilteredExpenseStats>;
const Probe = ({ filters }: { filters?: ExpenseFilters }) => { hook = useFilteredExpenseStats(filters); return null; };
const flush = () => act(async () => { await nextTurn(); });

test('hook keeps the latest filters when an older request resolves later', async () => {
  const slow = deferred();
  transport.reply = request => JSON.parse(request.body!).p_filters.team_id === 'old' ? slow.promise : Promise.resolve(json({ ...totals, totalAmount: 77 }));
  const root: Root = createRoot(container);
  try {
    await act(async () => root.render(<Probe filters={{ team_id: 'old' }} />));
    await untilCalls(1);
    await act(async () => root.render(<Probe filters={{ team_id: 'new' }} />));
    await flush();
    assert.equal(hook.stats?.totalAmount, 77);
    await act(async () => slow.resolve(json(totals)));
    await flush();
    assert.equal(hook.stats?.totalAmount, 77);
    assert.equal(hook.loading, false);
  } finally { await act(async () => root.unmount()); }
});

test('hook event refresh reads newly invalidated totals and surfaces real failures', async () => {
  const root: Root = createRoot(container);
  try {
    await act(async () => root.render(<Probe />));
    await flush();
    assert.equal(hook.stats?.totalAmount, 12.3);
    transport.reply = async () => json({ ...totals, totalAmount: 88 });
    await act(async () => eventBus.emit('expenses:changed'));
    await flush();
    assert.equal(hook.stats?.totalAmount, 88);
    transport.reply = async () => json({ code: '42501', message: 'denied' }, 403);
    await act(async () => eventBus.emit('expenses:changed'));
    await flush();
    assert.match(hook.error!, /denied/);
  } finally { await act(async () => root.unmount()); }
});

test('a filter change hides previous totals until its own aggregate arrives', async () => {
  const slow = deferred();
  const root: Root = createRoot(container);
  try {
    await act(async () => root.render(<Probe filters={{ team_id: 'old' }} />));
    await flush();
    assert.equal(hook.stats?.totalAmount, 12.3);
    transport.reply = () => slow.promise;
    await act(async () => root.render(<Probe filters={{ team_id: 'new' }} />));
    assert.equal(hook.stats, null);
    assert.equal(hook.loading, true);
    await act(async () => slow.resolve(json({ ...totals, totalAmount: 66 })));
    await flush();
    assert.equal(hook.stats?.totalAmount, 66);
  } finally { await act(async () => root.unmount()); }
});

for (const state of ['loading', 'error', 'zero']) {
  test(`expense page ${state} state never substitutes first-page or unfiltered totals`, () => {
    pageBoundary.stats = {
      stats: { totalAmount: 0, totalCount: 0, pendingCount: 0, approvedCount: 0, rejectedCount: 0 },
      loading: state === 'loading', error: state === 'error' ? 'RPC unavailable' : null, refresh: async () => {},
    };
    const markup = renderToStaticMarkup(<ExpensesPage />);
    assert.match(markup, /existing expense row/);
    const cards = Array.from(markup.matchAll(/class="text-2xl font-bold">([^<]*)<\/p>/g), match => match[1]);
    assert.deepEqual(cards, state === 'zero' ? ['0', '0 ج.م', '0', '0'] : ['—', '—', '—', '—']);
    assert.equal(markup.includes('تعذّر تحديث إحصائيات المصروفات'), state === 'error');
  });
}

for (const change of ['account', 'permissions', 'signout']) {
  test(`mounted aggregate state hides old totals immediately on ${change}`, async () => {
    const slow = deferred();
    const root: Root = createRoot(container);
    try {
      await act(async () => root.render(<Probe />));
      await flush();
      assert.equal(hook.stats?.totalAmount, 12.3);
      transport.reply = () => slow.promise;
      if (change === 'account') {
        pageBoundary.auth.user = { ...pageBoundary.auth.user, id: 'other-user' };
        pageBoundary.auth.session = { user: { id: 'other-user' }, access_token: 'other-token' };
        CacheManager.setScope('other-user:other-token');
      } else if (change === 'permissions') {
        pageBoundary.auth.user = { ...pageBoundary.auth.user, role: { permissions: { expenses: { read: false } } } };
        CacheManager.setProfileScope('expense-denied');
      } else {
        pageBoundary.auth = { user: null, session: null };
        CacheManager.setScope(null);
      }
      await act(async () => root.render(<Probe />));
      assert.equal(hook.stats, null);
      assert.equal(hook.error, null);
      if (change !== 'signout') {
        await act(async () => slow.resolve(json({ ...totals, totalAmount: 99 })));
        await flush();
        assert.equal(hook.stats?.totalAmount, 99);
      }
    } finally { await act(async () => root.unmount()); }
  });
}

test('a late old-account aggregate cannot replace the mounted current-account result', async () => {
  const slow = deferred();
  transport.reply = () => transport.calls.length === 1 ? slow.promise : Promise.resolve(json({ ...totals, totalAmount: 99 }));
  const root: Root = createRoot(container);
  try {
    await act(async () => root.render(<Probe />));
    await untilCalls(1);
    pageBoundary.auth.user = { ...pageBoundary.auth.user, id: 'other-user' };
    pageBoundary.auth.session = { user: { id: 'other-user' }, access_token: 'other-token' };
    CacheManager.setScope('other-user:other-token');
    await act(async () => root.render(<Probe />));
    await flush();
    assert.equal(hook.stats?.totalAmount, 99);
    await act(async () => slow.resolve(json(totals)));
    await flush();
    assert.equal(hook.stats?.totalAmount, 99);
    assert.equal(hook.error, null);
  } finally { await act(async () => root.unmount()); }
});
