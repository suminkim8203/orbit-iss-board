export const SOURCE_URL = 'https://api.wheretheiss.at/v1/satellites/25544';
export const TIMEZONE = 'Asia/Seoul';
export type IssData = { id: number; name: string; altitude: number; latitude: number; longitude: number; velocity: number; timestamp: number; units: string; visibility: string };
export { kstDate } from './engine.ts';
import { kstDate, validateReading, type Reading } from './engine.ts';
export type { Reading } from './engine.ts';
export type Record = { reading: Reading; raw: IssData };
export function normalize(raw: IssData, fetchedAt: string): Reading {
  if (!raw || raw.id !== 25544 || raw.units !== 'kilometers' ||
      !['altitude','latitude','longitude','velocity','timestamp'].every(key => typeof raw[key as keyof IssData] === 'number' && Number.isFinite(raw[key as keyof IssData])) ||
      raw.altitude <= 0 || Math.abs(raw.latitude) > 90 || Math.abs(raw.longitude) > 180 || raw.timestamp <= 0) {
    throw new Error('schema_error');
  }
  const reading: Reading = { signal_id: 'iss-altitude', normalized_value: raw.altitude, unit: 'km', source_name: 'Where the ISS at?', source_url: SOURCE_URL,
    source_time: new Date(raw.timestamp * 1000).toISOString(), fetched_at: fetchedAt, record_timezone: TIMEZONE, record_date: kstDate(fetchedAt) };
  validateReading(reading);
  return reading;
}
export const ERRORS: { [key: string]: { title: string; detail: string; action: string } } = {
  timeout: { title: '응답이 늦어지고 있습니다', detail: '제한 시간 안에 데이터를 받지 못했습니다. 마지막 정상값을 유지합니다.', action: '잠시 후 다시 시도해 주세요.' },
  auth: { title: '데이터 원천이 접근을 거절했습니다', detail: '외부 원천의 401/403 응답입니다. 이 관제판에 로그인할 필요는 없습니다.', action: '출처의 서비스 공지를 확인하고 다시 시도해 주세요.' },
  rate_limit: { title: '조회 요청이 너무 많습니다', detail: '외부 원천의 호출 제한에 도달했습니다. 마지막 정상값을 유지합니다.', action: '호출을 멈추고 대기한 뒤 다시 시도해 주세요.' },
  offline: { title: '인터넷에 연결되어 있지 않습니다', detail: '연결을 확인할 때까지 마지막 정상값을 표시합니다.', action: '인터넷 연결을 복구한 뒤 다시 시도해 주세요.' },
  schema_error: { title: '데이터 형식을 확인할 수 없습니다', detail: '필수 값이나 단위가 예상과 달라 새 값을 저장하지 않았습니다.', action: '출처 응답과 연동 형식을 확인한 뒤 다시 시도해 주세요.' },
  network: { title: '데이터 원천에 연결하지 못했습니다', detail: '네트워크 또는 브라우저 접근 제한으로 응답을 확인하지 못했습니다.', action: '연결과 출처의 상태를 확인하고 다시 시도해 주세요.' },
  upstream: { title: '외부 서비스에서 오류가 발생했습니다', detail: '새 값을 확인하지 못해 마지막 정상값을 유지합니다.', action: '출처의 서비스 상태를 확인하고 잠시 후 다시 시도해 주세요.' },
};
