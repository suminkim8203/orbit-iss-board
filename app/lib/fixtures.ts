import a from '../public/fixtures/normal-d1-a.json';
import b from '../public/fixtures/normal-d1-b.json';
import d2 from '../public/fixtures/normal-d2.json';
import timeout from '../public/fixtures/timeout.json';
import auth from '../public/fixtures/auth-401.json';
import rate from '../public/fixtures/rate-429.json';
import offline from '../public/fixtures/offline.json';
import schema from '../public/fixtures/schema-break.json';
import recover from '../public/fixtures/recover-d2.json';
import { emptyState, runFixture, type Fixture, type State } from './engine.ts';

export const fixtures: { [key: string]: Fixture } = {
  'normal-d1-a': a, 'normal-d1-b': b, 'normal-d2': d2, timeout, auth,
  rate_limit: rate, offline, schema_error: schema, 'recover-d2': recover,
};
export const failureKeys = ['timeout', 'auth', 'rate_limit', 'offline', 'schema_error'];
export function baseline(): State {
  return runFixture(runFixture(emptyState(), fixtures['normal-d1-a']), fixtures['normal-d1-b']);
}
export function replayAction(state: State, action: string): State {
  if (action === 'reset') return emptyState();
  if (!Object.hasOwn(fixtures, action)) throw new Error('unknown_fixture');
  return runFixture(failureKeys.includes(action) ? baseline() : state, fixtures[action]);
}
