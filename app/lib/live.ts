import { normalize, SOURCE_URL, type IssData, type Record as IssRecord } from './readings.ts';
import { applySuccess, emptyState, type ErrorCode, type State } from './engine.ts';

export class SourceError extends Error {
  code: ErrorCode;
  retryAfter: number;
  constructor(code: ErrorCode, retryAfter = 0) { super(code); this.code = code; this.retryAfter = retryAfter; }
}
export function retrySeconds(header: string | null, now = Date.now()) {
  if (!header) return 30;
  const seconds = /^\d+$/.test(header) ? Number(header) : Math.ceil((Date.parse(header) - now) / 1000);
  return Number.isFinite(seconds) ? Math.max(3, seconds) : 30;
}

export async function fetchIss(options: { fetcher?: typeof fetch; timeoutMs?: number; clock?: () => Date } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  const clock = options.clock ?? (() => new Date());
  try {
    const response = await (options.fetcher ?? fetch)(SOURCE_URL, { signal: controller.signal, cache: 'no-store' });
    if (response.status === 401 || response.status === 403) throw new SourceError('auth');
    if (response.status === 429) throw new SourceError('rate_limit', retrySeconds(response.headers.get('retry-after'), clock().getTime()));
    if (!response.ok) throw new SourceError('upstream');
    const rawText = await response.text();
    let raw: IssData;
    try { raw = JSON.parse(rawText); } catch { throw new SourceError('schema_error'); }
    const fetchedAt = clock().toISOString();
    try { return { record: { raw, reading: normalize(raw, fetchedAt) }, rawText }; }
    catch { throw new SourceError('schema_error'); }
  } catch (e) {
    if (controller.signal.aborted) throw new SourceError('timeout');
    if (e instanceof SourceError) throw e;
    throw new SourceError('network');
  } finally { clearTimeout(timer); }
}

export function recordsState(records: IssRecord[]): State {
  return records.reduce((state, record) => {
    const verified = normalize(record.raw, record.reading.fetched_at);
    for (const key of Object.keys(verified) as (keyof typeof verified)[]) {
      // Equivalent ISO timezone offsets are accepted without rewriting original timestamps.
      if (key === 'source_time' || key === 'fetched_at') {
        if (Date.parse(verified[key]!) !== Date.parse(record.reading[key]!)) throw new Error('stored_reading_mismatch');
      } else if (verified[key] !== record.reading[key]) throw new Error('stored_reading_mismatch');
    }
    return applySuccess(state, record.reading, record.raw);
  }, emptyState());
}

export function restoreLive(published: IssRecord[]): State {
  const baseline = recordsState(published);
  try {
    const cached: unknown = JSON.parse(localStorage.getItem('orbit:live-cache:v1') || 'null');
    if (!cached || typeof cached !== 'object' || !('daily_readings' in cached) || !Array.isArray(cached.daily_readings) || cached.daily_readings.length > 366) return baseline;
    const rows: IssRecord[] = cached.daily_readings.map(row => ({ raw: row.raw, reading: row.reading }));
    const verified = recordsState(rows);
    return verified.daily_readings.reduce((state, row) => applySuccess(state, row.reading, row.raw), baseline);
  } catch { return baseline; }
}
