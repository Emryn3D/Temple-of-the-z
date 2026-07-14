// Asserts every URL the game references (importmap, script src, asset string
// literals in js/) resolves: on disk always, and over HTTP when a local
// server is running (PORT env, default 8000).
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORT || '8000';

const html = readFileSync(join(root, 'index.html'), 'utf8');
const paths = new Set();

const importmap = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]);
for (const v of Object.values(importmap.imports)) paths.add(v);
for (const m of html.matchAll(/src="([^"]+)"/g)) paths.add(m[1]);

for (const f of readdirSync(join(root, 'js'))) {
  const src = readFileSync(join(root, 'js', f), 'utf8');
  for (const m of src.matchAll(/['"](\.\/)?(assets\/[\w./-]+|lib\/[\w./-]+)['"]/g)) paths.add('./' + m[2]);
  // Asset directory prefixes used with string concatenation (e.g. GLB loads).
  if (src.includes("assets/models/")) { paths.add('./assets/models/Soldier.glb'); paths.add('./assets/models/Xbot.glb'); }
}

let failed = 0;
for (const p of [...paths].sort()) {
  const rel = p.replace(/^\.\//, '');
  const fsPath = join(root, rel);
  const isDirPrefix = p.endsWith('/');
  if (!existsSync(fsPath) || (!isDirPrefix && statSync(fsPath).isDirectory())) {
    if (!(isDirPrefix && existsSync(fsPath))) { failed++; console.error(`FAIL missing on disk: ${p}`); continue; }
  }
  if (!isDirPrefix) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/${rel}`, { method: 'HEAD' });
      if (!res.ok) { failed++; console.error(`FAIL HTTP ${res.status}: ${p}`); continue; }
      console.log(`ok   ${p}`);
    } catch {
      console.log(`ok   ${p} (disk only — no server on :${port})`);
    }
  } else {
    console.log(`ok   ${p} (directory)`);
  }
}
if (failed) process.exit(1);
console.log('path check passed');
