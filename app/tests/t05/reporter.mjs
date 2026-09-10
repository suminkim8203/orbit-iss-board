import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
export default class Reporter {
  rows = [];
  onBegin() { this.startedAt = new Date().toISOString(); }
  onTestEnd(test, result) {
    this.rows.push({ id: test.title.match(/T05-F\d{2}/)?.[0], status: result.status === 'passed' ? 'PASS' : 'FAIL', runnerStatus: result.status, durationMs: result.duration, error: result.error?.message ? stripVTControlCharacters(result.error.message) : null });
    this.save('in-progress');
  }
  onEnd(result) {
    this.save(result.status);
  }
  save(status) {
    const output = process.env.T05_RESULT_DIR || '../evidence/t05';
    mkdirSync(output, { recursive: true });
    const tag = this.startedAt.replaceAll(':', '-').replaceAll('.', '-');
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
    const data = { startedAt: this.startedAt, observedAt: new Date().toISOString(), phase: process.env.T05_PHASE || 'unclassified', sourceRevision: revision, workingTreeDirty: dirty, runnerStatus: status, count: this.rows.length, passed: this.rows.filter(r => r.status === 'PASS').length, failed: this.rows.filter(r => r.status === 'FAIL').length, errorRound: this.rows.some(r => r.status === 'FAIL') ? 1 : 0, tests: this.rows };
    writeFileSync(resolve(output, `${data.phase}-${tag}.json`), JSON.stringify(data, null, 2) + '\n');
  }
}
