import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const excluded = new Set(['node_modules','.git','.wrangler','.vinext','.next']);
const patterns = [
  ['GitHub credential', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/],
  ['OpenAI credential', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Embedded credential URL', /https?:\/\/[^\s/"']+:[^\s/"']+@/],
];
const findings=[];let checked=0;
function scan(text,path) { for(const [rule,pattern] of patterns) if(pattern.test(text)) findings.push({path,rule}); }
async function walk(dir) {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    if(excluded.has(entry.name) || entry.isSymbolicLink()) continue;
    const path=join(dir,entry.name);
    if(entry.isDirectory()) await walk(path);
    else if(/\.(?:json|[cm]?[jt]sx?|html|css|ya?ml|md|txt)$/.test(entry.name) || entry.name==='.gitignore') {
      scan(await readFile(path,'utf8'),relative(root,path));checked++;
    }
  }
}
await walk(root);
let history='not_initialized';
try {
  const text=execFileSync('git',['log','--all','-p','--no-ext-diff'],{cwd:root,encoding:'utf8',maxBuffer:30*1024*1024,stdio:['ignore','pipe','pipe']});
  scan(text,'Git history');history='checked';
} catch { /* Before the first local commit there is no history to scan. */ }
const report={checked_at:new Date().toISOString(),files_checked:checked,git_history:history,findings,
  limitation:'Pattern-based scan of common credential formats; no external API credentials are used by the app.'};
if(process.argv.includes('--save')) await writeFile(new URL('../evidence/secret-scan.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
if(findings.length) process.exitCode=1;
