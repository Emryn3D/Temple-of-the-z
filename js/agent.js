// Browser agent facade. The game loop stays in main.js; this module only
// shapes observations and translates actions into latched input.

import { ACTIONS, FIXED_DT, MANIFEST, TICK_HZ } from './manifest.js';

function r3(n) { return Math.round(n * 1000) / 1000; }
function r4(n) { return Math.round(n * 10000) / 10000; }

function pose(px, pz, yaw, x, z, extra) {
  const dx = x - px;
  const dz = z - pz;
  const desired = Math.atan2(dx, -dz);
  let bearing = desired - yaw;
  bearing = Math.atan2(Math.sin(bearing), Math.cos(bearing));
  return {
    ...extra,
    x: r3(x),
    z: r3(z),
    dx: r3(dx),
    dz: r3(dz),
    dist: r3(Math.hypot(dx, dz)),
    bearing: r4(bearing)
  };
}

function goal(have, target) {
  return { have, goal: target, done: target === 0 || have >= target };
}

export function createGameApi(host) {
  function getState() {
    const s = host.sample();
    const yaw = s.yaw;
    const px = s.player.x;
    const pz = s.player.z;
    const coinsDone = s.coinGoal === 0 || s.coinCount >= s.coinGoal;
    const wisdomDone = s.wisdomGoal === 0 || s.knowledgeCount >= s.wisdomGoal;
    const alive = s.enemies.length;
    const enemiesDone = s.spawned >= s.enemyTarget && alive === 0;
    // Levels 1 and 2 complete on goals. The finale completes by entering the portal.
    const ready = s.levelIndex < s.levelCount - 1 && coinsDone && wisdomDone && enemiesDone;

    const pickups = [
      ...s.coins.map(c => pose(px, pz, yaw, c.x, c.z, { kind: 'coin' })),
      ...s.knowledge.map(k => pose(px, pz, yaw, k.x, k.z, { kind: 'wisdom' }))
    ].sort((a, b) => a.dist - b.dist);

    const enemies = s.enemies
      .map(e => pose(px, pz, yaw, e.x, e.z, {}))
      .sort((a, b) => a.dist - b.dist);

    return {
      version: 1,
      drive: s.drive,
      tick: s.tick,
      fixedDt: FIXED_DT,
      seed: s.seed,
      status: s.status,
      outcome: s.outcome,
      levelsCleared: s.levelsCleared,
      level: {
        index: s.levelIndex,
        count: s.levelCount,
        name: s.levelName,
        story: s.levelStory,
        terrain: s.terrain
      },
      objectives: {
        coins: goal(s.coinCount, s.coinGoal),
        wisdom: goal(s.knowledgeCount, s.wisdomGoal),
        enemies: {
          spawned: s.spawned,
          target: s.enemyTarget,
          alive,
          remaining: Math.max(0, s.enemyTarget - s.spawned + alive),
          done: enemiesDone
        },
        boss: s.boss ? { name: s.boss.name, hp: s.boss.hp, maxHp: s.boss.maxHp, dying: s.boss.dying } : null,
        portalOpen: s.portal.open,
        ready
      },
      score: s.score,
      lives: s.lives,
      timeLeft: r3(s.timeLeft),
      shift: {
        active: s.shift.active,
        meter: r3(s.shift.meter),
        cooldown: r3(s.shift.cooldown)
      },
      player: {
        x: r3(px),
        z: r3(pz),
        yaw: r4(yaw),
        heading: { x: r3(Math.sin(yaw)), z: r3(-Math.cos(yaw)) }
      },
      nearby: {
        enemies,
        pickups,
        portal: pose(px, pz, yaw, s.portal.x, s.portal.z, { open: s.portal.open }),
        npc: s.npc ? pose(px, pz, yaw, s.npc.x, s.npc.z, { name: s.npc.name }) : null,
        boss: s.boss ? pose(px, pz, yaw, s.boss.x, s.boss.z, {
          name: s.boss.name, hp: s.boss.hp, maxHp: s.boss.maxHp, dying: s.boss.dying
        }) : null
      },
      subtitle: s.subtitle || '',
      events: host.drainEvents(),
      loadError: s.loadError
    };
  }

  function applyNamed(name) {
    switch (name) {
      case 'start': return host.start();
      case 'restart': return host.restart();
      case 'pause': host.pause(); return { ok: true, action: 'pause' };
      case 'resume': host.resume(); return { ok: true, action: 'resume' };
      case 'noop': return { ok: true, action: 'noop' };
      case 'stop': host.setIntent({ forward: 0, strafe: 0, turn: 0 }); return { ok: true, action: 'stop' };
      case 'forward': host.setIntent({ forward: 1 }); return { ok: true, action: 'forward' };
      case 'back': host.setIntent({ forward: -1 }); return { ok: true, action: 'back' };
      case 'strafe_left': host.setIntent({ strafe: -1 }); return { ok: true, action: 'strafe_left' };
      case 'strafe_right': host.setIntent({ strafe: 1 }); return { ok: true, action: 'strafe_right' };
      case 'turn_left': host.setIntent({ turn: 1 }); return { ok: true, action: 'turn_left' };
      case 'turn_right': host.setIntent({ turn: -1 }); return { ok: true, action: 'turn_right' };
      case 'fire': host.setIntent({ fire: true }); return { ok: true, action: 'fire' };
      case 'now_shift':
      case 'now-shift':
      case 'shift': host.setIntent({ shift: true }); return { ok: true, action: 'now_shift' };
      default: return { ok: false, error: `unknown action "${name}"` };
    }
  }

  function applyMove(input) {
    const patch = {};
    for (const key of ['forward', 'strafe', 'turn']) {
      if (input[key] !== undefined) {
        const v = Number(input[key]);
        if (!Number.isFinite(v)) return { ok: false, error: `${key} must be a number` };
        patch[key] = Math.max(-1, Math.min(1, v));
      }
    }
    if (input.fire) patch.fire = true;
    if (input.shift || input.now_shift) patch.shift = true;
    if (!Object.keys(patch).length) return { ok: false, error: 'move needs forward, strafe, turn, fire, or shift' };
    host.setIntent(patch);
    return { ok: true, action: 'move', intent: patch };
  }

  function act(input) {
    if (typeof input === 'string') return applyNamed(input);
    if (!input || typeof input !== 'object') return { ok: false, error: 'action must be a string or object' };
    if (typeof input.action === 'string' && input.action !== 'move') return applyNamed(input.action);
    return applyMove(input.action && typeof input.action === 'object' ? input.action : input);
  }

  function step(n = 1) {
    if (arguments.length && n && typeof n === 'object') {
      if (n.action != null) act(n.action);
      n = n.n;
    }
    host.stepFrames(n);
    return getState();
  }

  return {
    version: 1,
    fixedDt: FIXED_DT,
    tickHz: TICK_HZ,
    manifest: MANIFEST,
    ready: host.ready,
    getState,
    listActions() { return ACTIONS.map(a => ({ ...a, args: a.args ? { ...a.args } : undefined })); },
    act,
    step,
    setSeed(seed, opts) { return host.setSeed(seed, opts || {}); },
    getSeed() { return host.getSeed(); },
    setDrive(mode) { return host.setDrive(mode); },
    get drive() { return host.getDrive(); },
    start() { return host.start(); },
    restart() { return host.restart(); },
    pause() { return host.pause(); },
    resume() { return host.resume(); }
  };
}
