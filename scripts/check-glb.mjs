// Validates the vendored GLB models without a loader: checks the binary
// header and asserts the animation clips + head bone the game depends on.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseGlbJson(path) {
  const buf = readFileSync(path);
  if (buf.toString('utf8', 0, 4) !== 'glTF') throw new Error(`${path}: bad magic`);
  const jsonLen = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`${path}: first chunk is not JSON`);
  return JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
}

const expectations = {
  'assets/models/Soldier.glb': { clips: ['Idle', 'Walk', 'Run'] },
  'assets/models/Xbot.glb': { clips: ['idle', 'walk', 'run', 'agree', 'headShake', 'sad_pose', 'sneak_pose'] }
};

let failed = 0;
for (const [rel, exp] of Object.entries(expectations)) {
  try {
    const json = parseGlbJson(join(root, rel));
    const animNames = (json.animations || []).map(a => a.name);
    for (const clip of exp.clips) {
      if (!animNames.includes(clip)) throw new Error(`missing clip "${clip}" (has: ${animNames.join(', ')})`);
    }
    const nodeNames = (json.nodes || []).map(n => n.name || '');
    const head = nodeNames.find(n => /head/i.test(n));
    if (!head) throw new Error('no head bone found among nodes');
    console.log(`ok   ${rel}  clips=[${animNames.join(', ')}] head="${head}"`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${rel}: ${e.message}`);
  }
}
if (failed) process.exit(1);
console.log('glb check passed');
