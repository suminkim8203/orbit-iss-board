import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../reference/t04-real-information-board-public-v1/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('asset-manifest.json', root), 'utf8'));
const checks = [];
for (const item of manifest.files) {
  const bytes = await readFile(new URL(item.path, root));
  const actual = createHash('sha256').update(bytes).digest('hex');
  const match = actual === item.sha256 && bytes.length === item.bytes;
  if (!match) throw new Error(`Asset integrity failed: ${item.path}`);
  if (item.path.startsWith('fixtures/')) {
    const bundled = await readFile(new URL(`../app/public/${item.path}`, import.meta.url));
    if (!bytes.equals(bundled)) throw new Error(`Bundled fixture mismatch: ${item.path}`);
  }
  checks.push({ path: item.path, sha256: actual, bytes: bytes.length, match });
}
const report = { package_id: manifest.package_id, checked_at: new Date().toISOString(), files: checks };
if (process.argv.includes('--save')) await writeFile(new URL('../evidence/asset-verification.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(`${checks.length} source files and 9 bundled fixtures verified (${manifest.package_id}).`);
