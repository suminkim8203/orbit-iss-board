import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const revision = execFileSync('git', ['rev-parse','HEAD'], { encoding:'utf8' }).trim();
if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(revision)) throw new Error('invalid_git_revision');
await writeFile(new URL('../app/public/data/build.json', import.meta.url), JSON.stringify({
  revision, source_url: `https://github.com/suminkim8203/orbit-iss-board/tree/${revision}`,
  built_at: new Date().toISOString(),
}, null, 2) + '\n');
