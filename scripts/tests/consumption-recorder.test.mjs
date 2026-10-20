import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { PerformanceRecorder } from '../../src/utils/performance-recorder.ts';

const entry = index => ({ query_type: `query-${index}`, execution_time_ms: 1200, query_hash: String(index), created_at: '2026-10-20T18:00:00.000Z' });

test('slow measurements batch without blocking the caller or losing report fields', async () => {
  const batches = [];
  const recorder = new PerformanceRecorder(async entries => { batches.push(entries); }, () => 1);
  for (let index = 0; index < 45; index++) recorder.record(entry(index));
  assert.equal(batches.length, 0);
  for (let attempt = 0; recorder.getStats().queued && attempt < 100; attempt++) await delay(2);
  assert.deepEqual(batches.flat(), Array.from({ length: 45 }, (_, index) => entry(index)));
  assert.equal(batches.length, 3);
  assert.equal(recorder.getStats().written, 45);
});

test('unavailable sink has bounded memory, one outstanding send, and visible losses', async () => {
  let rejectSend;
  let calls = 0;
  const recorder = new PerformanceRecorder(() => { calls++; return new Promise((_, reject) => { rejectSend = reject; }); }, () => 1);
  recorder.record(entry(0));
  await delay(5);
  for (let index = 1; index <= 250; index++) recorder.record(entry(index));
  assert.equal(calls, 1);
  assert.equal(recorder.getStats().queued, 200);
  assert.equal(recorder.getStats().dropped, 50);
  rejectSend(Error('offline'));
  await delay(5);
  assert.equal(recorder.getStats().failed, 1);
  assert.equal(calls, 2);
  // Resolve every subsequent batch as a rejected boundary call; no retries or unhandled rejections.
  while (recorder.getStats().sending || recorder.getStats().queued) {
    rejectSend(Error('offline'));
    await delay(2);
  }
  assert.equal(recorder.getStats().failed, 201);
});

test('queued diagnostics from a previous session are discarded rather than sent as another user', async () => {
  let scope = 1;
  const sent = [];
  const recorder = new PerformanceRecorder(async entries => sent.push(...entries), () => scope);
  recorder.record(entry(1));
  scope = 2;
  recorder.record(entry(2));
  await delay(10);
  assert.deepEqual(sent, [entry(2)]);
  assert.equal(recorder.getStats().dropped, 1);
});
