import { open, readFile, rename, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { applySuccess } from '../app/lib/engine.ts';
import { fetchIss, recordsState, SourceError } from '../app/lib/live.ts';

const defaultFile = fileURLToPath(new URL('../app/public/data/records.json', import.meta.url));

export async function atomicWrite(file, document) {
  const temp = `${file}.${process.pid}.tmp`;
  try {
    const handle = await open(temp, 'wx');
    try { await handle.writeFile(JSON.stringify(document, null, 2) + '\n', 'utf8'); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temp, file);
  } finally { await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}

export async function collect({ file = defaultFile, capture = fetchIss, clock = () => new Date() } = {}) {
  const lockFile = `${file}.lock`;
  // Refuse a concurrent collector. Never remove someone else's lock.
  const lock = await open(lockFile, 'wx');
  try {
    const document = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(document.records)) throw new Error('invalid_records_document');
    const state = recordsState(document.records);
    if (state.daily_readings.length !== document.records.length) throw new Error('duplicate_daily_records');
    if (document.records.length > 2) throw new Error('too_many_submission_records');
    // Freeze the two submission records so subsequent schedule runs cannot change evidence.
    if (document.records.length === 2) return { outcome: 'complete', count: 2, changed: false };
    const attemptedAt = clock().toISOString();
    let result;
    try { result = await capture(); }
    catch (error) {
      const code = error instanceof SourceError ? error.code : 'network';
      await atomicWrite(file, { ...document, collection_status: { freshness: document.records.length ? 'stale' : 'empty', error_code: code, attempted_at: attemptedAt, retry_after_seconds: error instanceof SourceError ? error.retryAfter : 0 } });
      throw error;
    }
    const next = applySuccess(state, result.record.reading, result.record.raw);
    const records = next.daily_readings.map(row => ({
      reading: row.reading, raw: row.raw,
      raw_response: row.reading.fetched_at === result.record.reading.fetched_at
        ? result.rawText : document.records.find(record => record.reading.record_date === row.reading.record_date)?.raw_response,
    }));
    await atomicWrite(file, { schema_version: 1, records,
      collection_status: { freshness: 'fresh', error_code: 'none', attempted_at: result.record.reading.fetched_at, retry_after_seconds: 0 },
      note: 'Actual public-source records. This file is not a platform-issued t04_day sealed receipt.' });
    return { outcome: 'success', count: records.length, changed: true, date: result.record.reading.record_date };
  } finally { await lock.close(); await unlink(lockFile); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  collect().then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error(`Collection did not complete: ${error instanceof SourceError ? error.code : error.message}`);
    process.exitCode = 1;
  });
}
