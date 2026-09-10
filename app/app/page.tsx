'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowUpRight, Check, ChevronRight, Clock3, Database, ExternalLink, FlaskConical, Globe2, Info, MapPin, Orbit, Radio, RefreshCw, Satellite, ShieldCheck, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ERRORS, type Record as IssRecord, type IssData } from '@/lib/readings';
import { applyError, applySuccess, compare, kstDate, type ErrorCode } from '@/lib/engine';
import { fetchIss, restoreLive, SourceError } from '@/lib/live';
import { SignalLab } from '@/components/signal-lab';
import { RecordCsvDownload } from '@/components/record-csv-download';
import initial from '../public/data/records.json';
import land from '../lib/land.json';

type Coordinates = number[][][];
const landPaths = land.features.map(feature => {
  const geometry = feature.geometry;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return (polygons as Coordinates[]).map(polygon => polygon.map(ring => ring.map(([lon, lat], index) => `${index ? 'L' : 'M'}${((lon + 180) * 2.5).toFixed(2)},${((90 - lat) * 2.5).toFixed(2)}`).join(' ') + 'Z').join(' ')).join(' ');
});
const time = (iso: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(iso));
const coordinate = (value: number, pos: string, neg: string) => `${Math.abs(value).toFixed(3)}° ${value >= 0 ? pos : neg}`;
const number = (value: number, digits = 2) => value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function WorldMap({ raw, stale }: { raw: IssData; stale: boolean }) {
  const x = (raw.longitude + 180) * 2.5;
  const y = (90 - raw.latitude) * 2.5;
  const left = x > 740;
  return <div className="map-surface">
    <svg className="world-map" viewBox="0 0 900 450" aria-label={`저장된 ISS 위치: 위도 ${raw.latitude}, 경도 ${raw.longitude}`}>
      <defs>
        <pattern id="grid" width="75" height="75" patternUnits="userSpaceOnUse"><path d="M 75 0 L 0 0 0 75" fill="none" stroke="#203040" strokeWidth="0.6" /></pattern>
        <radialGradient id="signal"><stop stopColor="var(--mint)" stopOpacity="0.17" /><stop offset="1" stopColor="var(--mint)" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="900" height="450" fill="url(#grid)" />
      {landPaths.map((path, i) => <path key={i} d={path} fill="#203443" stroke="#375364" strokeWidth="0.65" />)}
      <line x1="0" y1="225" x2="900" y2="225" stroke="#3b5b65" strokeDasharray="4 7" strokeWidth="0.7" />
      <text x="12" y="218" className="map-text">EQUATOR 0°</text>
      <text x="180" y="175" className="ocean-text">PACIFIC OCEAN</text>
      <text x="405" y="250" className="ocean-text">ATLANTIC</text>
      <text x="647" y="315" className="ocean-text">INDIAN OCEAN</text>
      <circle cx={x} cy={y} r="75" fill="url(#signal)" />
      <line x1={x} y1="0" x2={x} y2="450" stroke="var(--mint)" strokeOpacity="0.19" strokeDasharray="3 6" />
      <line x1="0" y1={y} x2="900" y2={y} stroke="var(--mint)" strokeOpacity="0.19" strokeDasharray="3 6" />
      <circle cx={x} cy={y} r="19" stroke="var(--mint)" strokeOpacity="0.35" fill="none" />
      <circle cx={x} cy={y} r="9" fill="#102c32" stroke="var(--mint)" strokeWidth="1.5" />
      <circle cx={x} cy={y} r="3.5" fill="var(--mint)" />
      <g transform={`translate(${left ? x - 153 : x + 25},${y - 24})`}>
        <rect width="126" height="48" rx="5" fill="#0c191f" stroke="#34535d" />
        <text x="12" y="19" fill="var(--mint)" fontSize="12" fontFamily="monospace" fontWeight="700">ISS · 25544</text>
        <text x="12" y="36" fill="#b0c3c9" fontSize="11">{number(raw.altitude)} km</text>
      </g>
    </svg>
    <div className="map-scale"><span>180° W</span><span>90° W</span><span>0°</span><span>90° E</span><span>180° E</span></div>
    <div className="map-legend"><span><i className="dot" /> {stale ? '마지막 관측 위치' : '최근 조회 위치'}</span><span>지리 데이터 · Natural Earth</span></div>
  </div>;
}

export default function Home() {
  const records = initial.records as IssRecord[];
  const [liveState, setLiveState] = useState(() => restoreLive(records));
  const stateRef = useRef(liveState);
  const inFlight = useRef(false);
  const [cacheError, setCacheError] = useState(false);
  const [sourceRevision, setSourceRevision] = useState<string | null>(null);
  const collection = (initial as { collection_status?: { error_code: string; attempted_at: string } }).collection_status;
  useEffect(() => {
    const controller = new AbortController();
    fetch('./data/build.json', { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(data => {
      if (data && typeof data === 'object' && 'revision' in data && typeof data.revision === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(data.revision)) setSourceRevision(data.revision);
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  const current = { reading: liveState.current_reading!, raw: liveState.current_raw as IssData };
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const inspected = records.find(r => r.reading.record_date === selectedDate) ?? current;
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [live, setLive] = useState(false);
  const { reading, raw } = current;
  const age = Math.max(0, Math.floor((now - Date.parse(reading.source_time!)) / 1000));
  const stale = !!error || age > 120;
  const ageLabel = age < 60 ? `${age}초 전` : age < 3600 ? `${Math.floor(age / 60)}분 전` : `${Math.floor(age / 3600)}시간 전`;
  const latestSaved = records[records.length - 1];
  const previousSaved = records.length > 1 ? records[records.length - 2] : null;
  const savedDelta = compare(latestSaved.reading, previousSaved?.reading);
  const deltaLabel = savedDelta ? `${savedDelta.consecutive ? '저장 기록 전일 대비' : '이전 저장 기록 대비'} ${savedDelta.signed > 0 ? '+' : ''}${number(savedDelta.signed)} km` : '어제 대비 · 두 번째 기록 대기';
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  async function refresh() {
    if (inFlight.current || Date.now() < cooldown) return;
    inFlight.current = true; setBusy(true); setCooldown(Date.now() + 3000);
    try {
      if (!navigator.onLine) throw new SourceError('offline');
      const { record } = await fetchIss();
      const next = applySuccess(stateRef.current, record.reading, record.raw);
      stateRef.current = next; setLiveState(next); setLive(true); setError('');
      try { localStorage.setItem('orbit:live-cache:v1', JSON.stringify(next)); setCacheError(false); }
      catch { setCacheError(true); }
    } catch (e) {
      const code: ErrorCode = !navigator.onLine ? 'offline' : e instanceof SourceError ? e.code : 'network';
      const next = applyError(stateRef.current, code, new Date().toISOString());
      stateRef.current = next; setLiveState(next); setError(code);
      if (e instanceof SourceError && e.retryAfter) setCooldown(Date.now() + e.retryAfter * 1000);
    } finally { inFlight.current = false; setBusy(false); }
  }

  function download() {
    const blob = new Blob([JSON.stringify(inspected, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `iss-${inspected.reading.record_date}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="app-shell">
    <a href="#main" className="skip-link">본문으로 이동</a>
    <header className="topbar">
      <a className="brand" href="#main" aria-label="ORBIT 관제판 홈"><Orbit size={28} strokeWidth={1.6} /><span>ORBIT<span className="brand-caption">ISS OBSERVATORY</span></span></a>
      <nav aria-label="주요 메뉴"><a className="nav-active" href="#main"><Activity size={16} />관제판</a><a href="#records"><Database size={16} />관측 기록</a><a href="#test"><FlaskConical size={16} />수신 테스트</a></nav>
      <span className="top-time"><span className="dot" /> ASIA / SEOUL <strong>{new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now)}</strong></span>
    </header>

    <main id="main">
      <div className="page-heading"><div><p className="eyebrow">EARTH ORBIT / NORAD 25544</p><h1>지구 밖의 지금<span className="title-dot">.</span></h1><p className="intro">국제우주정거장, 오늘은 어디쯤 날고 있을까요?</p></div><Button className="refresh-button" onClick={refresh} disabled={busy || now < cooldown}><RefreshCw size={16} className={busy ? 'spinning' : ''} />{busy ? '신호 확인 중' : now < cooldown ? `${Math.ceil((cooldown - now) / 1000)}초 후 재조회` : error ? '다시 시도' : '새 데이터 조회'}</Button></div>
      <div className={`status-strip ${error ? 'has-error' : ''}`} aria-live="polite"><span className="status-main">{error ? <WifiOff size={16} /> : <Radio size={16} />}<strong>{error ? ERRORS[error].title : stale ? '저장된 관측 데이터' : live ? '새 데이터 수신 완료' : '첫날 관측 기록 확보'}</strong></span><span>{error ? ERRORS[error].action : `출처 기준 ${ageLabel} · ${stale ? '현재 위치와 다를 수 있습니다' : '공개 API 응답 기준'}`}</span><span className={`status-pill ${stale ? 'amber' : ''}`}><i className="dot" />{stale ? '오래된 값' : '최근 값'}</span></div>
      {error && <p className="error-detail">{ERRORS[error].detail} 이 표시는 앱의 데이터 수신 상태이며 ISS의 이상을 뜻하지 않습니다.</p>}

      <div className="observation-grid">
        <section className="panel map-panel" aria-labelledby="map-title"><div className="panel-heading"><div><span className="eyebrow">POSITION MONITOR</span><h2 id="map-title"><Globe2 size={17} />궤도 위의 한 점</h2></div><span className="subtle-tag">지상 위치</span></div><WorldMap raw={raw} stale={stale} /><div className="coordinates"><span><MapPin size={15} />관측 좌표</span><span>위도 <strong>{coordinate(raw.latitude, 'N', 'S')}</strong></span><span>경도 <strong>{coordinate(raw.longitude, 'E', 'W')}</strong></span></div></section>

        <section className="panel altitude-panel" aria-labelledby="altitude-title"><div className="panel-heading"><div><span className="eyebrow">PRIMARY SIGNAL</span><h2 id="altitude-title">지표면 위 고도</h2></div><Satellite size={22} className="mint" /></div><div className="altitude-number">{number(reading.normalized_value)}<span>km</span></div><p className="altitude-caption">ISS가 지구 표면에서 떨어진 높이</p><div className="comparison-chip"><Clock3 size={14} />{deltaLabel}</div><div className="height-diagram" aria-label="고도 개념도, 축척과 무관"><div className="diagram-level"><span>ISS</span><Satellite size={22} /><span>{number(raw.altitude)} km</span></div><div className="height-line"><i /><span>지구 저궤도</span></div><div className="earth-line"><span>지표면</span><span>0 km</span></div></div><div className="altitude-foot"><ShieldCheck size={15} /><span>마지막 정상값 보존</span><span className="tiny">개념도 · 축척 무관</span></div></section>
      </div>

      <div className="telemetry-row"><section><span className="metric-label"><Activity size={16} />비행 속도</span><p>{number(raw.velocity, 0)}<small>km/h</small></p><span className="metric-note">동일 응답의 순간 속도</span></section><section><span className="metric-label"><Clock3 size={16} />출처 기준 시각</span><p className="time-value">{new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(reading.source_time!))}</p><span className="metric-note">{kstDate(reading.source_time!)} · Asia/Seoul</span></section><section><span className="metric-label"><Radio size={16} />조회 시각</span><p className="time-value">{new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(reading.fetched_at))}</p><span className="metric-note">{reading.record_date} · Asia/Seoul</span></section><section><span className="metric-label"><Database size={16} />보존된 일별 기록</span><p>{String(records.length).padStart(2, '0')}<small>/ 02일</small></p><span className="metric-note">서로 다른 실제 한국 날짜</span></section></div>

      {collection && collection.error_code !== "none" && <p className="error-detail">공개 일별 수집 실패: {ERRORS[collection.error_code]?.title ?? "응답 확인 불가"}. 마지막 성공 기록은 보존했습니다. 수집 시도: {time(collection.attempted_at)} KST.</p>}
      <div className="lower-grid">
        <section className="panel records-panel" id="records"><div className="panel-heading"><div><span className="eyebrow">DAILY OBSERVATIONS</span><h2>하루, 하나의 기록</h2></div><span className="subtle-tag">KST 기준</span></div><RecordCsvDownload records={records} /><div className="record-table"><div className="table-row table-header"><span>관측 날짜</span><span>고도</span><span>전일 대비</span><span>상태</span></div>{records.map((record, i) => <div className="table-row" key={record.reading.record_date}><span className="mono">{record.reading.record_date}</span><strong className="mono">{number(record.reading.normalized_value)} <small>km</small></strong><span>{i && compare(record.reading, records[i-1].reading)?.consecutive ? `${number(record.reading.normalized_value - records[i - 1].reading.normalized_value)} km` : '—'}</span><button className="saved-tag record-inspect" onClick={() => { setSelectedDate(record.reading.record_date); const el = document.getElementById("evidence") as HTMLDetailsElement; el.open = true; el.scrollIntoView({ behavior: "smooth", block: "start" }); }}><Check size={13} />원자료 보기</button></div>)}{records.length < 2 && <div className="table-row pending-row"><span>다음 실제 날짜</span><span>—</span><span>—</span><span>수집 대기</span></div>}</div><div className="record-note"><Info size={15} /><p>각 날짜에 저장한 고도를 비교합니다. 두 순간의 차이이며, 하루 평균이나 궤도 상승량을 뜻하지 않습니다.</p></div></section>
        <aside className="panel source-panel"><span className="eyebrow">TRUST THE TIMESTAMP</span><h2>숫자보다 중요한 건,<br />언제 받은 숫자인지.</h2><p>새 데이터를 받지 못해도 마지막 정상 기록은 남습니다. 오래된 값은 오래되었다고 알려 드립니다.</p><a href="https://wheretheiss.at/w/developer" target="_blank" rel="noreferrer">Where the ISS at? <ArrowUpRight size={17} /></a><span className="source-note">공개 궤도 위치 API · 비밀키 없음</span></aside>
      </div>

      <details className="panel evidence-panel" id="evidence"><summary><span><ShieldCheck size={17} />데이터 출처와 원자료 대조</span><ChevronRight size={18} /></summary><div className="evidence-content"><div className="evidence-selector"><label htmlFor="reading-select">대조할 기록</label><select id="reading-select" value={selectedDate ?? "current"} onChange={e => setSelectedDate(e.target.value === "current" ? null : e.target.value)}><option value="current">현재 관측값</option>{records.map(r => <option key={r.reading.record_date} value={r.reading.record_date}>{r.reading.record_date} · 공개 보존 기록</option>)}</select></div><dl><div><dt>출처 URL</dt><dd><a href={inspected.reading.source_url} target="_blank" rel="noreferrer">{inspected.reading.source_url}<ExternalLink size={13} /></a></dd></div><div><dt>출처 기준 시각</dt><dd>{time(inspected.reading.source_time!)} KST</dd></div><div><dt>조회 시각</dt><dd>{time(inspected.reading.fetched_at)} KST</dd></div><div><dt>기준 시간대</dt><dd>Asia/Seoul</dd></div></dl><div className="reconcile"><div>원자료 altitude<strong>{inspected.raw.altitude}</strong></div><div>정규화·저장값<strong>{inspected.reading.normalized_value}</strong></div><div>화면 표시값<strong>{number(inspected.reading.normalized_value)} km</strong></div></div><p className="small-copy">원본 정밀도를 보존하고 화면에서만 소수 둘째 자리까지 반올림합니다. 새 조회는 이 브라우저에 날짜별로 보존합니다. 공개 일별 기록은 저장소의 수집 기능으로 별도 보존하며, 시크릿 창에서도 같은 기록을 볼 수 있습니다.</p><Button className="secondary-button" onClick={download}><ArrowDownToLine size={15} />선택한 원자료 내려받기</Button><pre>{JSON.stringify(inspected.raw, null, 2)}</pre></div></details>

      {cacheError && <p className="error-detail">브라우저 저장이 차단되어 최신 조회는 화면에서만 유지됩니다. 공개 보존 기록은 계속 볼 수 있습니다.</p>}
      <SignalLab />
      <footer><span><Orbit size={17} /> ORBIT <span className="footer-divider">/</span> 작은 창으로 보는 지구 밖</span><span>위치·고도는 공개 API 기준 · <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Made with Natural Earth</a> · <a href={sourceRevision ? `https://github.com/suminkim8203/orbit-iss-board/tree/${sourceRevision}` : "https://github.com/suminkim8203/orbit-iss-board"} target="_blank" rel="noreferrer">{sourceRevision ? "이 배포의 소스" : "소스 저장소"}</a></span></footer>
    </main>
  </div>;
}

