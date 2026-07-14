// Node smoke test: proves all game modules parse and import without a browser.
// Creates a local node_modules/three shim pointing at the vendored lib so that
// bare `three` / `three/addons/*` specifiers resolve in Node (browsers use the
// importmap in index.html instead).
import { mkdirSync, writeFileSync, existsSync, symlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shim = join(root, 'node_modules', 'three');
if (!existsSync(shim)) {
  mkdirSync(shim, { recursive: true });
  writeFileSync(join(shim, 'package.json'), JSON.stringify({
    name: 'three', version: '0.158.0', type: 'module',
    exports: { '.': './build/three.module.js', './addons/*': './addons/*' }
  }));
  symlinkSync(join(root, 'lib', 'three'), join(shim, 'build'), 'dir');
  symlinkSync(join(root, 'lib', 'three', 'addons'), join(shim, 'addons'), 'dir');
}

const targets = [
  'three',
  'three/addons/utils/SkeletonUtils.js',
  'three/addons/loaders/GLTFLoader.js',
  'three/addons/postprocessing/EffectComposer.js',
  'three/addons/postprocessing/RenderPass.js',
  'three/addons/postprocessing/UnrealBloomPass.js',
  '../js/levels.js',
  '../js/characters.js',
  '../js/timefx.js',
  '../js/fx.js',
  '../js/audio.js'
];

let failed = 0;
for (const t of targets) {
  try {
    const mod = await import(t);
    const keys = Object.keys(mod).slice(0, 4).join(', ');
    console.log(`ok   ${t}  (${keys}${Object.keys(mod).length > 4 ? ', …' : ''})`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${t}: ${e.message}`);
  }
}
const three = await import('three');
console.log(`three REVISION ${three.REVISION}`);
if (failed) { console.error(`${failed} module(s) failed`); process.exit(1); }
console.log('smoke test passed');
