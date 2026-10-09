import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST } from '../js/manifest.js';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'agent.json');
writeFileSync(file, JSON.stringify(MANIFEST, null, 2) + '\n');
console.log('wrote', file);
