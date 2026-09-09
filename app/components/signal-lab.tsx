import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowUpRight, FlaskConical, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { emptyState, compare, type State } from '../lib/engine';
import { fixtures, replayAction } from '../lib/fixtures';
import { ERRORS } from '../lib/readings';

const KEY = 'orbit:synthetic-sequence:v1';
function restoreActions(): string[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    return Array.isArray(value) && value.length <= 300 && value.every(v => typeof v === 'string' && (v === 'reset' || Object.hasOwn(fixtures, v))) ? value : [];
  } catch { return []; }
}
function summarize(state: State) {
  return { ...state.status, last_good_value: state.current_reading?.normalized_value ?? null,
    row_count: state.daily_readings.length, fixture_id: state.last_run.fixture_id,
    rows: state.daily_readings.map(row => ({ id: row.record_id, date: row.reading.record_date, value: row.reading.normalized_value, unit: row.reading.unit })) };
}

export function SignalLab() {
  const [actions, setActions] = useState(restoreActions);
  const [state, setState] = useState(() => actions.reduce(replayAction, emptyState()));
  const stateRef = useRef(state);
  const actionsRef = useRef(actions);
  const [storageError, setStorageError] = useState(false);
  function apply(action: string) {
    const next = replayAction(stateRef.current, action);
    const sequence = action === 'reset' ? [] : [...actionsRef.current, action];
    // Compact to a new failure baseline rather than grow a storage log indefinitely.
    if (sequence.length > 300) throw new Error('합성 초기화 후 다시 시험해 주세요.');
    stateRef.current = next; actionsRef.current = sequence;
    setActions(sequence); setState(next);
    try { sessionStorage.setItem(KEY, JSON.stringify(sequence)); setStorageError(false); }
    catch { setStorageError(true); }
    return summarize(next);
  }
  const applyRef = useRef(apply);
  useEffect(() => { applyRef.current = apply; });
  useEffect(() => {
    type Tool = { name: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean }; execute: (input: unknown) => unknown };
    const context = (document as Document & { modelContext?: { registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    for (const tool of [
      { name: 'read_signal_replay', description: 'Read the visible synthetic signal test state. No live ISS data is changed.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => summarize(stateRef.current) },
      { name: 'apply_signal_fixture', description: 'Apply one public synthetic fixture to the visible signal lab. Failure actions initialize D1-A then D1-B first. reset clears only synthetic state.',
        inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['reset', ...Object.keys(fixtures)] } }, required: ['action'], additionalProperties: false },
        annotations: { readOnlyHint: false }, execute: (input: unknown) => {
          if (!input || typeof input !== 'object' || Object.keys(input).length !== 1 || !('action' in input) || typeof input.action !== 'string' || !(input.action === 'reset' || Object.hasOwn(fixtures, input.action))) throw new Error('invalid_action');
          let result: unknown; flushSync(() => { result = applyRef.current((input as { action: string }).action); }); return result;
        } },
    ]) {
      try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Optional browser capability. */ }
    }
    return () => lifecycle.abort();
  }, []);
  const failed = state.status.error_code !== 'none';
  const rows = state.daily_readings;
  const delta = rows.length > 1 ? compare(rows[rows.length - 1].reading, rows[rows.length - 2].reading) : null;
  return <section className="panel test-panel" id="test">
    <div className="panel-heading"><div><span className="eyebrow">SIGNAL LAB</span><h2><FlaskConical size={17} />데이터가 오지 않는다면?</h2></div><span className="subtle-tag">합성 시험 · 실제 기록과 분리</span></div>
    <p className="test-intro">실패를 선택하면 합성 정상값 100 → 105를 저장한 뒤 해당 실패를 재생합니다. 실제 ISS 데이터는 바뀌지 않습니다.</p>
    <div className="failure-buttons">{[['timeout','느린 응답'],['auth','접근 거절'],['rate_limit','호출 제한'],['offline','오프라인'],['schema_error','형식 변경']].map(([key, label]) => <Button key={key} className={`failure-button ${state.status.error_code === key ? 'selected' : ''}`} onClick={() => apply(key)}>{label}<ArrowUpRight size={14} /></Button>)}</div>
    <div className={`test-result ${!failed ? 'recovered' : ''}`} aria-live="polite"><div>
      <strong>{failed ? ERRORS[state.status.error_code].title : state.current_reading ? '정상 응답을 저장했습니다' : '합성 시험을 시작해 보세요'}</strong>
      <p>{failed ? `${ERRORS[state.status.error_code].detail} ${ERRORS[state.status.error_code].action}` : state.current_reading ? '정상값과 일별 기록을 아래에서 확인할 수 있습니다.' : '정상 순서를 직접 재생하거나 위에서 실패 종류를 선택하세요.'}</p>
      {state.last_run.retry_after_seconds !== null && <p>원천이 안내한 대기 시간: {state.last_run.retry_after_seconds}초. 합성 복구 버튼은 실제 시간을 기다리지 않고 다음 날짜 응답을 재생합니다.</p>}
      <span className="small-copy">{state.last_run.fixture_id ?? '아직 재생한 fixture 없음'}</span>
    </div>{failed && <Button className="secondary-button" onClick={() => apply('recover-d2')}><RefreshCw size={14} />다시 시도 · 합성 복구</Button>}</div>
    <div className="replay-metrics"><div>마지막 정상값<strong>{state.current_reading ? `${state.current_reading.normalized_value} ${state.current_reading.unit}` : '없음'}</strong>{failed && state.current_reading && <span className="amber-text">오래된 값</span>}</div><div>데이터 상태<strong>{state.status.freshness}</strong><span>{state.status.error_code}</span></div><div>일별 기록<strong>{rows.length}건</strong><span>날짜 + 신호별 고유 기록</span></div><div>전일 대비<strong>{delta ? `${delta.signed > 0 ? '+' : ''}${delta.signed} ${delta.unit}` : '비교 대기'}</strong><span>저장값으로 재계산</span></div></div>
    <div className="replay-controls">{[['normal-d1-a','① 첫날 100'],['normal-d1-b','② 같은 날 105'],['normal-d2','③ 다음 날 120'],['recover-d2','복구 120 재실행']].map(([key, label]) => <Button key={key} className="secondary-button" onClick={() => apply(key)}>{label}</Button>)}<Button className="secondary-button" onClick={() => apply('reset')}><RotateCcw size={14} />합성 초기화</Button></div>
    <div className="replay-table-wrap"><table className="replay-table" aria-label="합성 일별 기록"><thead><tr><th scope="col">합성 날짜</th><th scope="col">저장값</th><th scope="col">고유 ID</th></tr></thead><tbody>{rows.map(row => <tr key={row.record_id}><td>{row.reading.record_date}</td><td>{row.reading.normalized_value} {row.reading.unit}</td><td>{row.record_id}</td></tr>)}</tbody></table></div>
    {storageError && <p className="test-intro">브라우저 저장이 차단되어 이번 시험은 현재 화면에서만 유지됩니다.</p>}
    <details className="replay-details"><summary>시험 상태 JSON 보기</summary><pre>{JSON.stringify(state, null, 2)}</pre></details>
  </section>;
}
