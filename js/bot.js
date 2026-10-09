// Reference bot. A short heuristic over window.game — no screen, no pixels.
// chooseAction is pure so it can be unit-tested. runBot drives a live session.

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function neededPickup(obs) {
  const coinsNeed = obs.objectives.coins.goal > 0 && obs.objectives.coins.have < obs.objectives.coins.goal;
  const wisdomNeed = obs.objectives.wisdom.goal > 0 && obs.objectives.wisdom.have < obs.objectives.wisdom.goal;
  for (const p of obs.nearby.pickups || []) {
    if (p.kind === 'coin' && coinsNeed) return p;
    if (p.kind === 'wisdom' && wisdomNeed) return p;
  }
  return null;
}

function steer(target, alignFar = 0.55) {
  const align = target.dist < 3 ? 0.18 : alignFar;
  const turn = clamp(target.bearing / 0.28, -1, 1);
  const forward = target.dist > 0.2 && Math.abs(target.bearing) < align ? 1 : 0;
  return { forward, strafe: 0, turn, fire: false, shift: false };
}

function engage(obs, target, prefer, retreat, aim) {
  const turn = clamp(target.bearing / 0.2, -1, 1);
  const aligned = Math.abs(target.bearing) < aim;
  let forward = 0;
  if (target.dist < retreat) forward = -1;
  else if (target.dist > prefer) forward = Math.abs(target.bearing) < 0.4 ? 1 : 0;
  const shift = !obs.shift.active && obs.shift.meter >= 0.999 && target.dist < retreat + 1.5;
  // Bolts are fast and the chaser is walking into them, so fire once aim is true.
  const fire = aligned && target.dist > 1.6 && target.dist < 26;
  return { forward, strafe: 0, turn, fire, shift };
}

export function chooseAction(obs) {
  if (!obs || obs.status === 'loading') return { action: 'noop' };
  if (obs.status === 'win' || obs.outcome === 'won') return { action: 'noop' };
  if (obs.status === 'pause') return { action: 'resume' };
  if (obs.status !== 'run') return { action: 'start' };

  const portal = obs.nearby.portal;
  if (portal && portal.open) return steer(portal, 0.4);

  const boss = obs.nearby.boss;
  if (boss && !boss.dying && boss.hp > 0) return engage(obs, boss, 11, 6.5, 0.2);

  const enemy = (obs.nearby.enemies || [])[0] || null;
  const pickup = neededPickup(obs);
  if (enemy && (!pickup || enemy.dist < 16 || enemy.dist < pickup.dist)) {
    return engage(obs, enemy, 10, 5.5, 0.18);
  }
  if (pickup) return steer(pickup);
  if (enemy) return engage(obs, enemy, 10, 5.5, 0.18);
  // Waiting for the next chaser to appear.
  return { forward: 0, strafe: 0, turn: 0.35, fire: false, shift: false };
}

export function decideTicks(obs, action) {
  if (action.action) return 1;
  const enemy = obs.nearby.enemies && obs.nearby.enemies[0];
  const boss = obs.nearby.boss;
  if (boss && !boss.dying && boss.hp > 0 && boss.dist < 20) return 1;
  if (enemy && enemy.dist < 18) return 1;
  if ((obs.nearby.pickups || []).some(p => p.dist < 3.2)) return 1;
  if (obs.nearby.portal && obs.nearby.portal.open && obs.nearby.portal.dist < 4) return 1;
  return 4;
}

function summary(obs) {
  const o = obs.objectives;
  return {
    tick: obs.tick,
    status: obs.status,
    outcome: obs.outcome,
    level: obs.level.index,
    coins: `${o.coins.have}/${o.coins.goal}`,
    wisdom: `${o.wisdom.have}/${o.wisdom.goal}`,
    enemies: `${o.enemies.alive} alive, ${o.enemies.spawned}/${o.enemies.target} spawned`,
    lives: obs.lives,
    timeLeft: obs.timeLeft,
    score: obs.score,
    x: obs.player.x,
    z: obs.player.z
  };
}

export async function runBot(game, opts = {}) {
  const levels = opts.levels ?? 1;
  const maxTicks = opts.maxTicks ?? 7000;
  await game.ready;
  let obs = game.getState();
  let ticks = 0;
  let gun = 0;
  let still = 0;
  let anchor = { x: obs.player.x, z: obs.player.z, key: '' };
  const log = [];
  let lastLog = -1e9;

  const finish = (ok, reason) => ({
    ok,
    reason,
    ticks,
    simSeconds: Math.round(ticks / game.tickHz * 10) / 10,
    levelsCleared: obs.levelsCleared,
    levelIndex: obs.level.index,
    status: obs.status,
    outcome: obs.outcome,
    score: obs.score,
    lives: obs.lives,
    timeLeft: obs.timeLeft,
    seed: obs.seed,
    log
  });

  while (ticks < maxTicks) {
    if (obs.outcome === 'won' || obs.levelsCleared >= levels) return finish(true, obs.outcome === 'won' ? 'won' : 'cleared');
    if (obs.outcome === 'failed') return finish(false, 'failed');
    if (obs.loadError) return finish(false, 'load_error');

    let action = chooseAction(obs);
    if (action.action === 'noop') {
      return finish(obs.levelsCleared >= levels || obs.outcome === 'won', obs.outcome === 'won' ? 'won' : 'stopped');
    }
    const progressKey = `${obs.objectives.coins.have}:${obs.objectives.wisdom.have}:${obs.objectives.enemies.spawned}:${obs.score}:${obs.status}`;
    const moved = Math.hypot(obs.player.x - anchor.x, obs.player.z - anchor.z);
    if (obs.status === 'run' && !action.action && moved < 0.45 && progressKey === anchor.key) still += 1;
    else {
      still = 0;
      anchor = { x: obs.player.x, z: obs.player.z, key: progressKey };
    }
    // Break a face-off where aim never quite lands.
    if (still >= 60) {
      action = { forward: obs.nearby.enemies?.[0]?.dist < 8 ? -1 : 1, strafe: 0, turn: 0.7, fire: true, shift: false };
      still = 0;
      anchor = { x: obs.player.x, z: obs.player.z, key: progressKey };
    }
    if (action.fire) {
      if (gun > 0) action = { ...action, fire: false };
      else gun = 5;
    }
    const n = Math.min(decideTicks(obs, action), maxTicks - ticks);
    game.act(action);
    obs = game.step(n);
    ticks += n;
    if (gun > 0) gun = Math.max(0, gun - n);
    if (ticks - lastLog >= 300) {
      lastLog = ticks;
      const line = summary(obs);
      log.push(line);
      if (log.length > 40) log.shift();
      console.log('bot', JSON.stringify(line));
    }
    if (opts.yieldFrame) await new Promise(resolve => requestAnimationFrame(resolve));
  }
  if (obs.outcome === 'won' || obs.levelsCleared >= levels) return finish(true, obs.outcome === 'won' ? 'won' : 'cleared');
  return finish(false, 'timeout');
}
