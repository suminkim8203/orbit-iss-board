// Synthetic T05 data only. Never copied into public observation evidence.
export const source = 'https://api.wheretheiss.at/v1/satellites/25544';
export function record(date, value, sourceTime, fetchedAt) {
  return {
    raw: { id: 25544, name: 'iss', altitude: value, latitude: 10, longitude: 20, velocity: 27000, timestamp: Date.parse(sourceTime) / 1000, units: 'kilometers', visibility: 'daylight' },
    reading: { signal_id: 'iss-altitude', normalized_value: value, unit: 'km', source_name: 'Where the ISS at?', source_url: source, source_time: sourceTime, fetched_at: fetchedAt, record_timezone: 'Asia/Seoul', record_date: date },
  };
}
export const R1 = record('2026-09-08', 420.123456789, '2026-09-07T14:59:55Z', '2026-09-07T15:00:05Z');
export const R2 = record('2026-09-09', 421.987654321, '2026-09-09T00:25:35Z', '2026-09-09T00:25:36Z');
export const cacheRecord = record('2026-09-10', 432, '2026-09-10T00:00:00Z', '2026-09-10T00:00:01.000Z');
export const currentRecord = record('2026-09-11', 430, '2026-09-11T00:00:00Z', '2026-09-11T00:00:01.000Z');
export const header = '관측날짜,고도(km),출처기준시각,조회시각,출처URL';
export const expected = '\uFEFF' + [header,
  `2026-09-08,420.123456789,2026-09-07T23:59:55+09:00,2026-09-08T00:00:05+09:00,${source}`,
  `2026-09-09,421.987654321,2026-09-09T09:25:35+09:00,2026-09-09T09:25:36+09:00,${source}`,
  '',
].join('\r\n');
