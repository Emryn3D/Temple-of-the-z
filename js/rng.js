// Gameplay RNG. Unseeded calls defer to Math.random so a normal playthrough
// keeps the historical random stream. setSeed() + reseed(level) makes
// collectible placement and chaser spawns replayable in step mode.

let seedValue = null;
let rngState = 1;

function fnv1a(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function setSeed(seed) {
  seedValue = String(seed);
}

export function clearSeed() {
  seedValue = null;
}

export function getSeed() {
  return seedValue;
}

// Restart the stream for a level load. Same seed + level always replays.
export function reseed(levelIndex = 0) {
  if (seedValue == null) return;
  rngState = fnv1a(seedValue + ':' + levelIndex) || 1;
}

export function random() {
  if (seedValue == null) return Math.random();
  // mulberry32
  rngState = (rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
