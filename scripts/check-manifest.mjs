// agent.json must stay a byte-for-byte logical copy of js/manifest.js.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST } from '../js/manifest.js';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'agent.json');
const disk = JSON.parse(readFileSync(file, 'utf8'));
const live = JSON.stringify(MANIFEST);
const saved = JSON.stringify(disk);
if (live !== saved) {
  console.error('agent.json does not match js/manifest.js. Regenerate with: node scripts/write-manifest.mjs');
  process.exit(1);
}
console.log('manifest ok');
