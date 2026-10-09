// Browser checks that do not require beating a level:
// human keyboard play still moves the hero, step mode does not advance on its own,
// a seeded run replays, and a bolt can defeat a chaser.
import { launchBrowser, openGame, startStaticServer, gameUrl } from './session.mjs';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const server = await startStaticServer();
const browser = await launchBrowser();
try {
  const human = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await openGame(human, gameUrl(server.origin));
  const booted = await human.evaluate(() => {
    const s = window.game.getState();
    return {
      drive: s.drive,
      status: s.status,
      seed: s.seed,
      button: document.getElementById('btnPlay').textContent,
      disabled: document.getElementById('btnPlay').disabled
    };
  });
  assert(booted.drive === 'realtime', 'flag-off page should stay on the realtime clock, got ' + booted.drive);
  assert(booted.status === 'menu', 'game should boot to the menu, got ' + booted.status);
  assert(booted.seed == null, 'flag-off page should not force a seed');
  assert(!booted.disabled && /start/i.test(booted.button), 'Start Story should be enabled');

  await human.click('#btnPlay');
  await human.keyboard.down('ArrowUp');
  await human.waitForFunction(() => window.game.getState().player.z < -0.8, null, { timeout: 8000 });
  await human.keyboard.up('ArrowUp');
  const moved = await human.evaluate(() => window.game.getState());
  assert(moved.status === 'run', 'clicking Start Story should run the level');
  assert(moved.drive === 'realtime', 'keyboard play should keep the realtime clock');
  assert(moved.player.z < -0.8, 'holding forward should walk toward -Z');
  console.log(`human ok  z=${moved.player.z} drive=${moved.drive}`);
  await human.close();

  const agent = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await openGame(agent, gameUrl(server.origin, { agent: true, headless: true, seed: 1 }));
  const frozen = await agent.evaluate(async () => {
    const g = window.game;
    const names = g.listActions().map(a => a.name);
    g.act('start');
    const before = g.getState();
    await new Promise(r => setTimeout(r, 250));
    const afterWait = g.getState();
    const stepped = g.step(30);
    return {
      names,
      drive: before.drive,
      seed: before.seed,
      t0: before.timeLeft,
      tWait: afterWait.timeLeft,
      tStep: stepped.timeLeft,
      tick: stepped.tick,
      bad: g.act('not-an-action'),
      coins: before.nearby.pickups.filter(p => p.kind === 'coin').map(p => [p.x, p.z])
    };
  });
  assert(frozen.drive === 'step', 'agent flag should start in step mode');
  assert(frozen.seed === '1', 'seed query should stick, got ' + frozen.seed);
  assert(frozen.tWait === frozen.t0, 'step mode must not drain the clock while the page sits idle');
  assert(frozen.t0 - frozen.tStep > 0.9 && frozen.t0 - frozen.tStep < 1.15, `30 ticks should cost about 1s, dropped ${frozen.t0 - frozen.tStep}`);
  assert(frozen.names.includes('fire') && frozen.names.includes('now_shift') && frozen.names.includes('start'), 'action catalog is missing a required action');
  assert(frozen.bad.ok === false, 'unknown actions should be rejected');
  console.log(`step ok  clock ${frozen.t0} -> ${frozen.tStep} after 30 ticks`);

  const shot = await agent.evaluate(() => {
    const g = window.game;
    g.restart();
    g.act('start');
    g.step(1);
    let guard = 0;
    while (guard < 900 && g.getState().nearby.enemies.length === 0) {
      g.step(5);
      guard += 5;
    }
    const startLives = g.getState().lives;
    let score = g.getState().score;
    for (let i = 0; i < 500 && g.getState().nearby.enemies.length; i++) {
      const e = g.getState().nearby.enemies[0];
      g.act({
        turn: Math.max(-1, Math.min(1, e.bearing / 0.2)),
        forward: e.dist > 12 ? 1 : (e.dist < 5.5 ? -1 : 0),
        strafe: 0,
        fire: Math.abs(e.bearing) < 0.18
      });
      g.step(1);
      score = g.getState().score;
      if (score >= 50) break;
    }
    const end = g.getState();
    return { score: end.score, lives: end.lives, startLives, status: end.status, outcome: end.outcome };
  });
  assert(shot.score >= 50, `a bolt should defeat a chaser (score ${shot.score}, lives ${shot.lives}, outcome ${shot.outcome})`);
  assert(shot.lives === shot.startLives, 'the chaser should die to a bolt, not to a touch');
  console.log(`shot ok  score=${shot.score} lives=${shot.lives}`);

  const replay = await agent.evaluate(() => {
    const g = window.game;
    function layout() {
      g.setSeed(1, { restart: true });
      g.act('start');
      g.act({ forward: 1, strafe: 0, turn: 0 });
      g.step(45);
      const s = g.getState();
      return {
        coins: s.nearby.pickups.filter(p => p.kind === 'coin').map(p => [p.x, p.z]),
        player: [s.player.x, s.player.z],
        spawned: s.objectives.enemies.spawned
      };
    }
    const a = layout();
    const b = layout();
    return { a, b, same: JSON.stringify(a) === JSON.stringify(b) };
  });
  assert(replay.same, 'the same seed and inputs should replay the same layout and pose');
  assert(replay.a.player[1] < -1, 'replay walk should move toward -Z, z=' + replay.a.player[1]);
  console.log(`replay ok  spawned=${replay.a.spawned} z=${replay.a.player[1]}`);
  await agent.close();
  console.log('agent check passed');
} finally {
  await browser.close();
  await server.close();
}
