import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('docs/t05/frozen-manifest.json', root), 'utf8'));
for (const item of manifest.files) {
  const path = new URL(item.path, root);
  const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (hash !== item.sha256) throw new Error(`Frozen file changed: ${fileURLToPath(path)}`);
}
const text = readFileSync(new URL('app/tests/t05/csv.spec.mjs', root), 'utf8');
const ids = [...text.matchAll(/test\('(?:T05-F\d{2})/g)].map(match => match[0].slice(6));
if (ids.length !== 10 || new Set(ids).size !== 10 || /test\.(skip|fixme|only)/.test(text)) throw new Error('Expected 10 unchanged runnable tests');
console.log(`PASS: ${manifest.files.length} frozen files, exactly 10 test IDs`);
