import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applySuccess, applyError, compare, emptyState, kstDate, runFixture, validateReading } from '../lib/engine.ts';
import { normalize } from '../lib/readings.ts';
import { fetchIss, recordsState, retrySeconds, SourceError } from '../lib/live.ts';

const fixture = async name => JSON.parse(await readFile(new URL(`../public/fixtures/${name}.json`, import.meta.url), 'utf8'));
const [a, b, d2, recover] = await Promise.all(['normal-d1-a', 'normal-d1-b', 'normal-d2', 'recover-d2'].map(fixture));
const baseline = () => runFixture(runFixture(emptyState(), a), b);
function expected(state, f) {
  assert.equal(state.status.freshness, f.expected.freshness);
  assert.equal(state.status.error_code, f.expected.error_code);
  assert.equal(state.daily_readings.length, f.expected.row_count);
  assert.equal(state.current_reading.normalized_value, f.expected.stored_value);
  const rows = state.daily_readings;
  const delta = rows.length > 1 ? Math.abs(compare(rows.at(-1).reading, rows.at(-2).reading).signed) : null;
  assert.equal(delta, f.expected.delta);
}
void test('public normal sequence matches every expected state and stable IDs', () => {
  let state = emptyState();
  state = runFixture(state, a); expected(state, a);
  const id = state.daily_readings[0].record_id;
  state = runFixture(state, b); expected(state, b);
  assert.equal(state.daily_readings[0].record_id, id);
  state = runFixture(state, b); assert.equal(state.daily_readings.length, 1);
  state = runFixture(state, d2); expected(state, d2);
  assert.equal(state.daily_readings[0].reading.normalized_value, 105);
});
for (const name of ['timeout', 'auth-401', 'rate-429', 'offline', 'schema-break']) {
  void test(`${name}: preserves last good row and recovers exactly once`, async () => {
    const f = await fixture(name); const before = baseline(); const snapshot = structuredClone(before);
    const failed = runFixture(before, f); expected(failed, f);
    assert.deepEqual(before, snapshot, 'does not mutate caller');
    assert.deepEqual(failed.daily_readings, before.daily_readings);
    assert.deepEqual(failed.current_reading, before.current_reading);
    const restored = runFixture(failed, recover); expected(restored, recover);
    assert.equal(restored.daily_readings.filter(r => r.reading.record_date === '2026-08-25').length, 1);
    assert.deepEqual(runFixture(restored, recover).daily_readings, restored.daily_readings);
    if (name === 'rate-429') assert.equal(failed.last_run.retry_after_seconds, 60);
  });
}
void test('KST midnight, not UTC midnight, controls the unique date', () => {
  assert.equal(kstDate('2026-09-09T14:59:59Z'), '2026-09-09');
  assert.equal(kstDate('2026-09-09T15:00:00Z'), '2026-09-10');
  let state = emptyState();
  for (const fetched_at of ['2026-09-09T00:00:00Z','2026-09-09T04:00:00Z','2026-09-09T14:59:59Z','2026-09-09T15:00:00Z']) {
    state = applySuccess(state, { ...a.payload, fetched_at, record_date: kstDate(fetched_at) });
  }
  assert.equal(state.daily_readings.length, 2);
});
void test('invalid normalized values are never stored', () => {
  for (const mutation of [{ normalized_value: null },{ normalized_value: '100' },{ normalized_value: Infinity },{ unit: '' },{ source_time: 'yesterday' },{ fetched_at: '2026-09-09' },{ record_timezone: 'UTC' },{ source_url: 'http://example.com' },{ secret: 'synthetic-extra' },{ record_date: '2026-01-01' }]) {
    assert.throws(() => validateReading({ ...a.payload, ...mutation }));
  }
});
void test('earlier response cannot overwrite newer same-day data', () => {
  assert.equal(runFixture(baseline(), a).current_reading.normalized_value, 105);
});
void test('comparisons retain sign and flag missing yesterday or incompatible units', () => {
  assert.equal(compare(d2.payload, b.payload).signed, 15);
  assert.equal(compare({ ...d2.payload, normalized_value: 90 }, b.payload).signed, -15);
  assert.equal(compare({ ...d2.payload, unit: 'km' }, b.payload), null);
  assert.equal(compare({ ...d2.payload, record_date: '2026-08-27' }, b.payload).consecutive, false);
});
const syntheticRaw = { id:25544,name:'iss',altitude:422.123456,latitude:12,longitude:24,velocity:27500,timestamp:1788912000,units:'kilometers',visibility:'daylight' };
const fetcher = body => async () => new Response(JSON.stringify(body), { status: 200 });
void test('live pipeline preserves source precision and distinct source/fetch times', async () => {
  const result = await fetchIss({ fetcher: fetcher(syntheticRaw), clock: () => new Date('2026-09-09T00:10:00Z') });
  assert.equal(result.record.reading.normalized_value, 422.123456);
  assert.equal(result.record.reading.source_time, new Date(syntheticRaw.timestamp * 1000).toISOString());
  assert.equal(result.record.reading.fetched_at, '2026-09-09T00:10:00.000Z');
  assert.equal(recordsState([result.record]).daily_readings.length, 1);
  assert.throws(() => recordsState([{ ...result.record, reading: { ...result.record.reading, normalized_value: 999 } }]));
});
void test('live HTTP and parse failures have distinct codes', async () => {
  for (const [status, code] of [[401,'auth'],[403,'auth'],[429,'rate_limit'],[503,'upstream']]) {
    await assert.rejects(fetchIss({ fetcher: async () => new Response('{}', { status }) }), e => e instanceof SourceError && e.code === code);
  }
  await assert.rejects(fetchIss({ fetcher: async () => new Response('invalid json') }), { code:'schema_error' });
  await assert.rejects(fetchIss({ fetcher: fetcher({ ...syntheticRaw, altitude: null }) }), { code:'schema_error' });
  await assert.rejects(fetchIss({ fetcher: async () => { throw new TypeError('synthetic network failure'); } }), { code:'network' });
  await assert.rejects(fetchIss({ timeoutMs: 5, fetcher: async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once:true })) }), { code:'timeout' });
});
void test('Retry-After handles seconds, dates and malformed values', () => {
  assert.equal(retrySeconds('60', 0), 60);
  assert.equal(retrySeconds('Thu, 01 Jan 1970 00:01:00 GMT', 0), 60);
  assert.equal(retrySeconds('invalid', 0), 30);
});
void test('synthetic errors cannot alter the real ISS store', () => {
  const reading = normalize(syntheticRaw, '2026-09-09T00:10:00Z');
  const real = applySuccess(emptyState(), reading, syntheticRaw);
  const copy = structuredClone(real); applyError(baseline(), 'offline');
  assert.deepEqual(real, copy);
});
