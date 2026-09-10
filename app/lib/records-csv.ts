import type { Record as IssRecord } from './readings';

const HEADER = ['관측날짜', '고도(km)', '출처기준시각', '조회시각', '출처URL'];

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function kstTimestamp(iso: string | null): string {
  if (iso === null) return '';
  return new Date(Date.parse(iso) + 9 * 60 * 60 * 1000).toISOString().slice(0, 19) + '+09:00';
}

/** Exports published records without changing the caller's data or fetching new data. */
export function createRecordsCsv(records: readonly IssRecord[]): string {
  const ordered = [...records].sort((a, b) => a.reading.record_date.localeCompare(b.reading.record_date));
  const rows = ordered.map(({ reading }) => [
    reading.record_date,
    reading.normalized_value,
    kstTimestamp(reading.source_time),
    kstTimestamp(reading.fetched_at),
    reading.source_url,
  ]);
  return '\uFEFF' + [HEADER, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
