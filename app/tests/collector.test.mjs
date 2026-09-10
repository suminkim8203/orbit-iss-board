import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
async function removeTestDirectory(dir) {
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep + 'orbit-collector-test-')) throw new Error('unsafe_test_cleanup');
  await rm(dir, { recursive:true, force:true });
}
import { collect } from '../../scripts/collect.mjs';
import { normalize } from '../lib/readings.ts';
import { SourceError } from '../lib/live.ts';

function captured(date, altitude) {
  const raw = { id:25544,name:'iss',altitude,latitude:1,longitude:2,velocity:27500,timestamp:Date.parse(date)/1000,units:'kilometers',visibility:'daylight' };
  return { record:{ raw, reading:normalize(raw,date) },rawText:JSON.stringify(raw) };
}
void test('collector upserts same date, preserves errors, freezes exactly two days', async () => {
  const dir=await mkdtemp(join(tmpdir(),'orbit-collector-test-')); const file=join(dir,'records.json');
  try {
    await writeFile(file, JSON.stringify({ records:[] }));
    await collect({ file,capture:async()=>captured('2026-08-24T00:00:00Z',100) });
    await collect({ file,capture:async()=>captured('2026-08-24T02:00:00Z',105) });
    let doc=JSON.parse(await readFile(file,'utf8')); assert.equal(doc.records.length,1);assert.equal(doc.records[0].raw.altitude,105);
    const saved=structuredClone(doc.records);
    await assert.rejects(collect({ file,capture:async()=>{throw new SourceError('offline');} }));
    doc=JSON.parse(await readFile(file,'utf8'));assert.deepEqual(doc.records,saved);assert.equal(doc.collection_status.freshness,'stale');
    await collect({ file,capture:async()=>captured('2026-08-25T00:00:00Z',120) });
    doc=JSON.parse(await readFile(file,'utf8'));assert.equal(doc.records.length,2);assert.equal(doc.collection_status.error_code,'none');
    const before=await readFile(file,'utf8');
    const result=await collect({ file,capture:async()=>{throw new Error('must not call network after completion');} });
    assert.equal(result.outcome,'complete');assert.equal(await readFile(file,'utf8'),before);
  } finally { await removeTestDirectory(dir); }
});
void test('corruption and a competing collector do not erase records', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'orbit-collector-test-'));const file=join(dir,'records.json');
  try {
    await writeFile(file,'not JSON');await assert.rejects(collect({file}));assert.equal(await readFile(file,'utf8'),'not JSON');
    const lock=await open(file+'.lock','wx');
    try { await assert.rejects(collect({file}),{code:'EEXIST'}); } finally { await lock.close(); }
    assert.equal(await readFile(file,'utf8'),'not JSON');
  } finally { await removeTestDirectory(dir); }
});
