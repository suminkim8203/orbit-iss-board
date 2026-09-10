import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { R1, R2, source, header, expected, cacheRecord, currentRecord } from './fixtures.mjs';

const button = page => page.getByRole('button', { name: '관측 기록 CSV 다운로드', exact: true });
async function open(page, scenario = 'normal') {
  await page.route(source, route => route.abort('failed'));
  await page.goto(`/?case=${scenario}#records`);
}
async function download(page) {
  await expect(button(page)).toBeVisible();
  const event = page.waitForEvent('download');
  await button(page).click();
  const file = await event;
  expect(await file.failure()).toBeNull();
  const bytes = await readFile(await file.path());
  return { name: file.suggestedFilename(), bytes, text: bytes.toString('utf8') };
}
function rows(text) { return text.replace(/^\uFEFF/, '').trimEnd().split('\r\n').map(line => line.split(',')); }
test('T05-F01 single click downloads named CSV', async ({ page }) => {
  await open(page); const downloads = []; page.on('download', file => downloads.push(file));
  const file = await download(page); expect(file.name).toBe('orbit-iss-records.csv'); expect(downloads).toHaveLength(1);
});
test('T05-F02 UTF-8 BOM, five Korean headers and CRLF', async ({ page }) => {
  await open(page); const file = await download(page);
  expect([...file.bytes.subarray(0, 3)]).toEqual([239, 187, 191]);
  expect(rows(file.text)[0]).toEqual(header.split(','));
  expect(file.text.endsWith('\r\n')).toBe(true);
  expect(file.text.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/);
});
test('T05-F03 exactly two records, five columns, no pending row', async ({ page }) => {
  await open(page); const file = await download(page); const data = rows(file.text).slice(1);
  expect(data).toHaveLength(2); expect(data.map(row => row.length)).toEqual([5, 5]);
  expect(data.map(row => row[0])).toEqual(['2026-09-08', '2026-09-09']); expect(file.text).not.toContain('수집 대기');
});
test('T05-F04 reversed input exports ascending dates', async ({ page }) => {
  await open(page, 'reverse'); expect((await download(page)).text).toBe(expected);
});
test('T05-F05 original numeric precision without unit suffix', async ({ page }) => {
  await open(page); expect(rows((await download(page)).text).slice(1).map(row => row[1])).toEqual(['420.123456789', '421.987654321']);
});
test('T05-F06 KST midnight boundary and provenance', async ({ page }) => {
  await open(page); expect(rows((await download(page)).text).slice(1).map(row => [row[0], ...row.slice(2)])).toEqual(rows(expected).slice(1).map(row => [row[0], ...row.slice(2)]));
});
test('T05-F07 empty records show disabled button and explanation', async ({ page }) => {
  await open(page, 'empty'); const downloads = []; page.on('download', file => downloads.push(file));
  await expect(button(page)).toBeVisible(); await expect(button(page)).toBeDisabled();
  await expect(page.getByText('내려받을 관측 기록이 없습니다.', { exact: true })).toBeVisible();
  await button(page).evaluate(el => el.click()); expect(downloads).toHaveLength(0);
});
test('T05-F08 exclude current value, browser cache and synthetic data', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-11T00:00:01.000Z'));
  await page.addInitScript(cache => localStorage.setItem('orbit:live-cache:v1', JSON.stringify({ daily_readings: [cache] })), cacheRecord);
  await open(page);
  await page.unroute(source);
  await page.route(source, route => route.fulfill({ json: currentRecord.raw }));
  await page.getByRole('button', { name: '새 데이터 조회', exact: true }).click();
  await expect(page.locator('.altitude-number')).toContainText('430.00');
  await page.getByRole('button', { name: '① 첫날 100', exact: true }).click();
  await expect(page.locator('.replay-metrics')).toContainText('999 pt');
  expect((await download(page)).text).toBe(expected);
});
test('T05-F09 failed live request preserves downloadable records', async ({ page }) => {
  await open(page); const before = await download(page);
  await page.getByRole('button', { name: '새 데이터 조회', exact: true }).click();
  await expect(page.locator('.status-main')).toContainText('데이터 원천에 연결하지 못했습니다');
  expect((await download(page)).bytes.equals(before.bytes)).toBe(true);
  await expect(page.locator('#records .record-inspect')).toHaveCount(2);
});
test('T05-F10 repeated downloads are identical and do not mutate records', async ({ page }) => {
  await open(page); const before = await page.evaluate(() => JSON.stringify(window.__T05_records));
  expect(JSON.parse(before)).toEqual([R1, R2]);
  const events = []; page.on('download', file => events.push(file));
  const first = await download(page); const second = await download(page);
  expect(events).toHaveLength(2); expect(second.bytes.equals(first.bytes)).toBe(true);
  expect(await page.evaluate(() => JSON.stringify(window.__T05_records))).toBe(before);
  await expect(page.locator('#records .record-inspect')).toHaveCount(2);
});
