// Pure checks: seeded RNG replays, and the reference bot's decisions point the right way.
import { clearSeed, getSeed, random, reseed, setSeed } from '../js/rng.js';
import { chooseAction } from '../js/bot.js';

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL', message);
    process.exitCode = 1;
    throw new Error(message);
  }
}

setSeed('temple');
reseed(0);
const first = [random(), random(), random(), random()];
setSeed('temple');
reseed(0);
const second = [random(), random(), random(), random()];
assert(first.every((n, i) => n === second[i]), 'same seed replays the same stream');
assert(first.every(n => n >= 0 && n < 1), 'seeded values stay inside [0, 1)');

setSeed('temple');
reseed(1);
const otherLevel = random();
setSeed('temple');
reseed(0);
assert(otherLevel !== random(), 'each level gets its own stream');

clearSeed();
assert(getSeed() === null, 'clearSeed removes the seed');
const unseeded = random();
assert(unseeded >= 0 && unseeded < 1, 'unseeded random stays inside [0, 1)');

function obs(partial) {
  return {
    status: 'run',
    outcome: null,
    levelsCleared: 0,
    loadError: null,
    shift: { active: false, meter: 1, cooldown: 0 },
    objectives: {
      coins: { have: 0, goal: 10, done: false },
      wisdom: { have: 0, goal: 0, done: true },
      enemies: { spawned: 1, target: 10, alive: 1, remaining: 10, done: false }
    },
    nearby: { enemies: [], pickups: [], portal: { open: false, dist: 100, bearing: 0 }, npc: null, boss: null },
    ...partial
  };
}

assert(chooseAction({ status: 'menu', outcome: null, nearby: {} }).action === 'start', 'menu starts the story');
assert(chooseAction({ status: 'pause', outcome: null, nearby: {} }).action === 'resume', 'pause resumes');
assert(chooseAction({ status: 'win', outcome: 'won', nearby: {} }).action === 'noop', 'a finished legend does not restart itself');

const aimed = chooseAction(obs({
  nearby: {
    enemies: [{ dist: 10, bearing: 0 }],
    pickups: [{ kind: 'coin', dist: 4, bearing: 1 }],
    portal: { open: false, dist: 80, bearing: 0 },
    boss: null
  }
}));
assert(aimed.fire === true, 'a chaser dead ahead is shot');
assert(aimed.forward === 0, 'a chaser at the preferred range is not chased');

const left = chooseAction(obs({
  nearby: {
    enemies: [{ dist: 12, bearing: 0.8 }],
    pickups: [],
    portal: { open: false, dist: 80, bearing: 0 },
    boss: null
  }
}));
assert(left.turn > 0, 'positive bearing turns left');
assert(left.fire !== true, 'a chaser off to the side is not fired at yet');

const close = chooseAction(obs({
  nearby: {
    enemies: [{ dist: 3, bearing: 0.05 }],
    pickups: [],
    portal: { open: false, dist: 80, bearing: 0 },
    boss: null
  }
}));
assert(close.forward < 0, 'a chaser inside the retreat range is kited');
assert(close.shift === true, 'Now-shift is spent when a chaser is on top of the player');

const collect = chooseAction(obs({
  nearby: {
    enemies: [{ dist: 30, bearing: 1 }],
    pickups: [{ kind: 'coin', dist: 6, bearing: 0 }],
    portal: { open: false, dist: 80, bearing: 0 },
    boss: null
  }
}));
assert(collect.fire !== true && collect.forward === 1, 'a far chaser is ignored in favor of a coin dead ahead');

const portal = chooseAction(obs({
  level: { index: 2 },
  nearby: {
    enemies: [],
    pickups: [],
    portal: { open: true, dist: 8, bearing: 0.1 },
    boss: null
  }
}));
assert(portal.forward === 1 && portal.fire !== true, 'an open portal is walked into');

if (process.exitCode) process.exit(process.exitCode);
console.log('logic ok');
