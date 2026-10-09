import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { LEVELS } from './levels.js';
import { loadBaseModels } from './characters.js';
import { Mascot, makeActor, makeToken } from './mascots.js';
import { NowShift, DayNight } from './timefx.js';
import { CameraShake, Haptics, SandParticles, DustPuffs } from './fx.js';
import { GameAudio } from './audio.js';
import { random, setSeed, reseed, getSeed } from './rng.js';
import { createGameApi } from './agent.js';
import { FIXED_DT } from './manifest.js';

// URL flags. Absent (the human default) leaves the realtime loop and Math.random stream alone.
const params = new URLSearchParams(location.search);
function flagOn(name) {
  if (!params.has(name)) return false;
  const v = (params.get(name) || '').toLowerCase();
  return v === '' || v === '1' || v === 'true' || v === 'yes' || v === 'on';
}
const agentMode = flagOn('agent');
const headless = flagOn('headless');
const autoBot = flagOn('bot');
if (params.has('seed')) setSeed(params.get('seed'));

// ---------- DOM ----------
const hud = document.getElementById('hud');
const ovTitle = document.getElementById('ovTitle');
const ovText = document.getElementById('ovText');
const overlay = document.getElementById('overlay');
const subtitle = document.getElementById('subtitle');
const powerbar = document.getElementById('powerbar');
const btnPlay = document.getElementById('btnPlay');

// ---------- game state ----------
let levelIndex = 0, score = 0, lives = 3, timeLeft = 120, spawned = 0, active = 0;
let knowledgeCount = 0, coinCount = 0;
let state = 'loading';
let yaw = 0;
let outcome = null;
let levelsCleared = 0;
let tick = 0;
let loadError = null;
let drive = (agentMode || headless) ? 'step' : 'realtime';
const events = [];
function pushEvent(type, data = {}) {
  events.push({ tick, type, ...data });
  if (events.length > 64) events.shift();
}
let resolveReady = () => {};
const ready = new Promise(resolve => { resolveReady = resolve; });

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: !headless });
renderer.setSize(headless ? 16 : innerWidth, headless ? 16 : innerHeight);
renderer.shadowMap.enabled = !headless;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 2.2, 6);
const hemi = new THREE.HemisphereLight(0xffffff, 0x8b6d45, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(50, 60, 20);
sun.castShadow = !headless;
sun.shadow.camera.left = sun.shadow.camera.bottom = -45;
sun.shadow.camera.right = sun.shadow.camera.top = 45;
sun.shadow.camera.far = 300;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshStandardMaterial({ color: 0xcfb385, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const world = new THREE.Group();
scene.add(world);
const portal = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.3, 64), new THREE.MeshBasicMaterial({ color: 0x8ad0ff, transparent: true, opacity: 0.9 }));
portal.visible = false;
scene.add(portal);
const muzzle = new THREE.PointLight(0xffe27a, 0, 7);
scene.add(muzzle);

let composer = null;
let bloomPass = null;
if (!headless) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.7, 0.9);
  composer.addPass(bloomPass);
}

// ---------- systems ----------
const nowShift = new NowShift();
const dayNight = new DayNight(scene, sun, hemi, bloomPass);
const shake = new CameraShake();
const haptics = new Haptics();
const sand = new SandParticles(scene);
const dust = new DustPuffs(scene);
const audio = new GameAudio();

// ---------- cast ----------
let models = null;
let hero = null, boss = null, bossSpec = null, zFigure = null;
let heroYawVisual = 0;
let motion = 0;
let activeAura = null;
const enemies = [], coins = [], knowledge = [], glitter = [], projectiles = [];
const cast = [];

class Enemy {
  constructor(pos) {
    // A Z: the gravitational fear from the legend. Dark gold, not a person.
    this.ch = new Mascot('z', {
      tint: 0xf0c247, emissive: 0x6a4a08, scale: 1.05, lightweight: headless
    });
    this.ch.group.position.set(pos.x, 0, pos.z);
    scene.add(this.ch.group);
    this.v = new THREE.Vector3();
    this.dead = false;
  }
  update(dt) {
    if (!this.dead) {
      const to = hero.group.position.clone().sub(this.ch.group.position);
      to.y = 0;
      if (to.length() > 0.001) to.normalize();
      const desired = to.multiplyScalar(6.2);
      this.v.add(desired.sub(this.v).clampLength(0, 10 * dt));
      this.ch.group.position.add(this.v.clone().multiplyScalar(dt));
      const zx = hero.group.position.x - this.ch.group.position.x;
      const zz = hero.group.position.z - this.ch.group.position.z;
      this.ch.group.rotation.y = Math.atan2(zx, zz);
      this.ch.setLocomotion(this.v.length());
      this.ch.lookHead(hero.group.position.clone().setY(1.6));
    }
    return this.ch.update(dt);
  }
  kill() {
    this.dead = true;
    this.ch.startDissolve();
  }
  remove() { scene.remove(this.ch.group); }
}

function clearMeshArr(arr) { while (arr.length) scene.remove(arr.pop()); }
function clearEnemies() { while (enemies.length) enemies.pop().remove(); }
function dist2D(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

function buildWorld() {
  while (world.children.length) world.remove(world.children[0]);
  const L = LEVELS[levelIndex];
  for (let i = 0; i < 55; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 4, 14, 10), new THREE.MeshStandardMaterial({ color: 0xc8ae7f, roughness: 0.97 }));
    d.scale.set(1.8, 0.3 + Math.random() * 0.2, 1.8);
    d.position.set(Math.random() * 340 - 170, -0.4, Math.random() * 340 - 170);
    if (d.position.length() < 16) continue;
    d.castShadow = d.receiveShadow = true;
    world.add(d);
  }
  if (L.terrain !== 'dunes') {
    for (let i = 0; i < 14; i++) {
      const z = -15 - i * 9;
      for (const x of [-4.6, 4.6]) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 4.6, 12), new THREE.MeshStandardMaterial({ color: 0xa09789 }));
        c.position.set(x, 2.3, z);
        c.castShadow = c.receiveShadow = true;
        world.add(c);
      }
    }
  }
  if (L.terrain === 'temple') {
    const temple = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 12), new THREE.MeshStandardMaterial({ color: 0x6f6759, roughness: 0.9 }));
    temple.position.set(0, 3.5, -140);
    temple.castShadow = temple.receiveShadow = true;
    world.add(temple);
    portal.position.set(0, 2.5, -134);
  } else {
    portal.position.set(0, 1.8, -145);
  }
}

function spawnCollectibles() {
  clearMeshArr(coins);
  clearMeshArr(knowledge);
  clearMeshArr(glitter);
  coinCount = 0;
  knowledgeCount = 0;
  for (let i = 0; i < 18; i++) {
    const c = makeToken('coin');
    c.position.x = random() * 110 - 55;
    c.position.z = -(12 + i * 5);
    coins.push(c);
    scene.add(c);
  }
  for (let i = 0; i < 12; i++) {
    const k = makeToken('passion');
    k.position.x = random() * 115 - 57;
    k.position.z = -(10 + i * 8);
    knowledge.push(k);
    scene.add(k);
  }
  // What glitters is the spend. It is not a coin, and taking it leaves you with less.
  for (let i = 0; i < 6; i++) {
    const g = makeToken('glitter');
    g.position.x = random() * 80 - 40;
    g.position.z = -(16 + i * 14);
    glitter.push(g);
    scene.add(g);
  }
}

function spawnEnemy() {
  const a = random() * Math.PI * 2, d = 20 + random() * 20;
  const p = new THREE.Vector3(hero.group.position.x + Math.cos(a) * d, 0, hero.group.position.z + Math.sin(a) * d);
  enemies.push(new Enemy(p));
  spawned++;
  active++;
}

function clearCast() {
  while (cast.length) scene.remove(cast.pop().actor.group);
}

function spawnCast() {
  clearCast();
  const list = LEVELS[levelIndex].cast || [];
  for (const spec of list) {
    const actor = makeActor(spec, models, headless);
    actor.group.position.set(spec.pos[0], spec.pos[1] || 0, spec.pos[2]);
    scene.add(actor.group);
    cast.push({ spec, actor, lineIdx: 0, near: false, lineTimer: 0 });
  }
}

function nearCast(role) {
  if (!hero) return null;
  for (const c of cast) {
    if (c.spec.role !== role) continue;
    const radius = c.spec.radius || 4;
    if (dist2D(c.actor.group.position, hero.group.position) < radius) return c;
  }
  return null;
}

function spawnBoss() {
  bossSpec = LEVELS[levelIndex].boss;
  boss = makeActor(bossSpec, models, headless);
  boss.group.position.set(...bossSpec.pos);
  scene.add(boss.group);
  boss.hp = bossSpec.hp;
  boss._stepT = 0;
  showSubtitle(bossSpec.line, 4);
  audio.attachGrowl(boss.group);
  shake.add(0.4);
  haptics.pulse(250, 1, 0.8);
}

function spawnZ() {
  const spec = LEVELS[levelIndex].finale;
  if (!spec || zFigure) return;
  zFigure = makeActor(spec, models, headless);
  zFigure.group.position.set(portal.position.x, 0, portal.position.z + 1.6);
  scene.add(zFigure.group);
  showSubtitle(spec.line, 6);
}

function fire() {
  if (state !== 'run') return;
  const p = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), new THREE.MeshBasicMaterial({ color: 0xf4d444 }));
  p.position.copy(hero.group.position);
  p.position.y = 1.2;
  p.userData.v = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw)).multiplyScalar(16);
  p.userData.life = 3;
  scene.add(p);
  projectiles.push(p);
  muzzle.position.copy(p.position);
  muzzle.intensity = 2.4;
  shake.add(0.08);
  haptics.pulse(40, 0.2, 0.5);
  audio.fire();
}

function tryShift() {
  if (state !== 'run') return;
  if (nowShift.tryActivate()) {
    pushEvent('now_shift', {});
    showSubtitle('Plus Energy. It cannot be bought. It comes from within.', 2.4);
    audio.setShift(true);
    haptics.pulse(80, 0.4, 0.7);
  }
}

// ---------- input ----------
const keys = {};
const intent = { forward: 0, strafe: 0, turn: 0 };
let edgeFire = false;
let edgeShift = false;
function clearIntent() {
  intent.forward = 0;
  intent.strafe = 0;
  intent.turn = 0;
  edgeFire = false;
  edgeShift = false;
}
function setIntent(patch) {
  if (patch.forward !== undefined) intent.forward = patch.forward;
  if (patch.strafe !== undefined) intent.strafe = patch.strafe;
  if (patch.turn !== undefined) intent.turn = patch.turn;
  if (patch.fire) edgeFire = true;
  if (patch.shift) edgeShift = true;
}
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyZ') fire();
  if (e.code === 'KeyX' || e.code === 'ShiftLeft') tryShift();
});
addEventListener('keyup', e => keys[e.code] = false);
for (const [id, key] of [['mvL', 'ArrowLeft'], ['mvR', 'ArrowRight'], ['mvF', 'ArrowUp'], ['mvB', 'ArrowDown']]) {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); keys[key] = true; });
  el.addEventListener('pointerup', () => keys[key] = false);
  el.addEventListener('pointerleave', () => keys[key] = false);
}
document.getElementById('btnFire').addEventListener('pointerdown', e => { e.preventDefault(); fire(); });
document.getElementById('btnShift').addEventListener('pointerdown', e => { e.preventDefault(); tryShift(); });
let gpPrev = { fire: false, shift: false };

// ---------- subtitles ----------
let subtitleT = 0;
function showSubtitle(text, seconds = 4) {
  subtitle.textContent = text;
  subtitle.style.opacity = '1';
  subtitleT = seconds;
}

// ---------- level flow ----------
function setLevel(i) {
  levelIndex = i;
  reseed(i);
  clearIntent();
  const L = LEVELS[i];
  timeLeft = L.time;
  spawned = 0;
  active = 0;
  hero.group.position.set(0, 0, 0);
  yaw = 0;
  heroYawVisual = Math.PI;
  motion = 0;
  activeAura = null;
  portal.visible = false;
  clearEnemies();
  clearMeshArr(projectiles);
  if (boss) { scene.remove(boss.group); boss = null; }
  if (zFigure) { scene.remove(zFigure.group); zFigure = null; }
  buildWorld();
  spawnCollectibles();
  spawnCast();
  dayNight.setLevel(L);
  ovTitle.textContent = L.name;
  ovText.textContent = L.story;
}

function completeLevel() {
  if (levelIndex < LEVELS.length - 1) {
    const cleared = levelIndex;
    outcome = 'cleared';
    levelsCleared = cleared + 1;
    pushEvent('level_cleared', { level: cleared });
    state = 'menu';
    setLevel(levelIndex + 1);
    overlay.style.display = 'flex';
    btnPlay.textContent = 'Next Level';
  } else {
    outcome = 'won';
    levelsCleared = LEVELS.length;
    pushEvent('game_won', { level: levelIndex });
    state = 'win';
    ovTitle.textContent = 'Legend Complete';
    ovText.textContent = 'You held what mattered, threw the Z away, and kept the energy that cannot be bought. The story is yours. Go beyond yourself.';
    overlay.style.display = 'flex';
  }
}

function failLevel() {
  outcome = 'failed';
  pushEvent('level_failed', { level: levelIndex });
  state = 'menu';
  ovTitle.textContent = 'A fear pulled you down';
  ovText.textContent = 'The Zs will still be there. Throw them away and walk it again. It is still your movie.';
  overlay.style.display = 'flex';
  btnPlay.textContent = 'Retry Level';
  lives = 3;
  setLevel(levelIndex);
}

function startGame() {
  if (state === 'loading') return { ok: false, error: 'loading' };
  audio.init(camera);
  audio.attachPortalHum(portal);
  if (state === 'win') {
    score = 0; lives = 3; outcome = null; levelsCleared = 0;
    setLevel(0);
    btnPlay.textContent = 'Start Story';
    state = 'menu';
    return { ok: true, action: 'start', status: state };
  }
  outcome = null;
  state = 'run';
  overlay.style.display = 'none';
  return { ok: true, action: 'start', status: state };
}

function restartGame() {
  if (state === 'loading') return { ok: false, error: 'loading' };
  score = 0; lives = 3;
  outcome = null;
  levelsCleared = 0;
  setLevel(0);
  state = 'menu';
  btnPlay.textContent = 'Start Story';
  overlay.style.display = 'flex';
  return { ok: true, action: 'restart', status: state };
}

function pauseGame() { if (state === 'run') state = 'pause'; return { ok: true, status: state }; }
function resumeGame() { if (state === 'pause') state = 'run'; return { ok: true, status: state }; }

btnPlay.onclick = () => { startGame(); };
document.getElementById('btnRestart').onclick = () => { restartGame(); };
document.getElementById('btnPause').onclick = () => { pauseGame(); };
document.getElementById('btnResume').onclick = () => { resumeGame(); };

// ---------- boot ----------
ovTitle.textContent = 'The Legend of Now';
ovText.textContent = 'You are the Stickman. Throw away the Zs.';
btnPlay.disabled = true;
loadBaseModels().then(m => {
  models = m;
  hero = new Mascot('stickman', {
    tint: 0xf4d444, emissive: 0x6a5208, label: 'Stickman', lightweight: headless
  });
  scene.add(hero.group);
  setLevel(0);
  btnPlay.disabled = false;
  btnPlay.textContent = 'Start Story';
  state = 'menu';
  resolveReady();
}).catch(err => {
  loadError = err.message;
  ovText.textContent = 'Failed to load characters: ' + err.message;
  resolveReady();
});

// ---------- main loop ----------
let last = performance.now();
let stepTimer = 0;
let npcEmoteCooldown = 0;

function renderScene() {
  const w = headless ? 16 : innerWidth;
  const h = headless ? 16 : innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (composer) {
    composer.setSize(w, h);
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

function frame(dtRaw, doPaint = true) {
  tick++;

  const shiftEnded = nowShift.update(dtRaw);
  if (shiftEnded) audio.setShift(false);
  const worldDt = dtRaw * nowShift.worldScale;
  const playerDt = dtRaw * nowShift.playerScale;

  const gp = haptics.poll();
  if (gp.fire && !gpPrev.fire) fire();
  if (gp.shift && !gpPrev.shift) tryShift();
  gpPrev = gp;
  if (edgeFire) { edgeFire = false; fire(); }
  if (edgeShift) { edgeShift = false; tryShift(); }

  if (keys.ArrowLeft || keys.KeyQ) yaw += 2.4 * playerDt;
  if (keys.ArrowRight || keys.KeyE) yaw -= 2.4 * playerDt;
  if (gp.connected) yaw -= gp.x * 2.4 * playerDt;
  if (intent.turn) yaw += 2.4 * intent.turn * playerDt;
  const forward = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3().copy(forward).cross(new THREE.Vector3(0, 1, 0));

  if (state === 'run' && hero) {
    timeLeft -= worldDt;
    if (timeLeft <= 0 || lives <= 0) failLevel();

    const L = LEVELS[levelIndex];

    // --- player ---
    const move = new THREE.Vector3();
    if (keys.KeyW || keys.ArrowUp) move.add(forward);
    if (keys.KeyS || keys.ArrowDown) move.add(forward.clone().multiplyScalar(-1));
    if (keys.KeyA) move.add(right.clone().multiplyScalar(-1));
    if (keys.KeyD) move.add(right);
    if (gp.connected && gp.y) move.add(forward.clone().multiplyScalar(-gp.y));
    if (intent.forward > 0) move.add(forward);
    else if (intent.forward < 0) move.add(forward.clone().multiplyScalar(-1));
    if (intent.strafe < 0) move.add(right.clone().multiplyScalar(-1));
    else if (intent.strafe > 0) move.add(right);
    // Stickman stays in motion. Balloon's vibration lifts. The Alien eats Plus Energy.
    const lift = nearCast('lift');
    const shelter = nearCast('shelter');
    const bear = nearCast('vibrate');
    const alien = nearCast('consume');
    const tags = [];
    if (lift) tags.push('Lift');
    if (bear) { nowShift.hasten(playerDt); tags.push('Vibration'); }
    if (shelter) tags.push('Shelter');
    if (alien) {
      if (nowShift.consume(playerDt)) {
        audio.setShift(false);
        pushEvent('consumed', {});
        showSubtitle('The Alien consumes the force.', 2.2);
      }
      tags.push('Consumed');
    }
    activeAura = tags.length ? tags.join(' ') : null;

    let speed = 0;
    if (move.length()) {
      move.normalize();
      // An object in motion stays in motion: a small bonus while you keep walking.
      motion = Math.min(1, motion + playerDt * 0.85);
      speed = 8 * (1 + 0.18 * motion) * (lift ? 1.22 : 1);
      hero.group.position.add(move.clone().multiplyScalar(speed * playerDt));
      // Turn the hero toward the direction of travel (model faces +Z).
      const targetYaw = Math.atan2(move.x, move.z);
      let d = targetYaw - heroYawVisual;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      heroYawVisual += d * Math.min(1, 12 * playerDt);
    } else {
      motion = Math.max(0, motion - playerDt * 1.1);
    }
    hero.group.rotation.y = heroYawVisual;
    hero.setLocomotion(speed);
    hero.lookHead(speed > 0
      ? hero.group.position.clone().add(move.clone().multiplyScalar(6)).setY(1.5)
      : hero.group.position.clone().add(forward.clone().multiplyScalar(6)).setY(1.5));
    hero.update(playerDt);

    // Footsteps drive sound + dust.
    if (speed > 0.2) {
      stepTimer -= playerDt;
      if (stepTimer <= 0) {
        stepTimer = 0.32;
        audio.step();
        if (!headless) dust.spawn(hero.group.position);
      }
    } else stepTimer = 0;

    // --- enemies ---
    if (spawned < L.enemyTarget && enemies.filter(e => !e.dead).length < 10) {
      if (random() < worldDt * 1.4) spawnEnemy();
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const done = e.update(worldDt);
      if (done) { e.remove(); enemies.splice(i, 1); continue; }
      if (e.dead) continue;
      let killed = false;
      for (let j = projectiles.length - 1; j >= 0; j--) {
        // The bolt is held at chest height (y=1.2) while a chaser's origin is on
        // the ground, so a 3D radius of 1.2 can never connect. Test the ground plane.
        if (dist2D(e.ch.group.position, projectiles[j].position) < 1.2) {
          e.kill();
          active--;
          scene.remove(projectiles[j]);
          projectiles.splice(j, 1);
          score += 50;
          pushEvent('enemy_down', { by: 'shot', score });
          shake.add(0.15);
          haptics.pulse(60, 0.5, 0.4);
          audio.thud(0.4);
          killed = true;
          break;
        }
      }
      if (killed) continue;
      if (e.ch.group.position.distanceTo(hero.group.position) < 1.2) {
        lives--;
        pushEvent('hurt', { lives });
        e.kill();
        active--;
        hero.flashHit();
        shake.add(0.45);
        haptics.pulse(200, 1, 0.6);
        audio.thud(0.8);
      }
    }
    // Zs are a gravitational fear. They tug. Anti-Social is a pocket where they cannot.
    if (!shelter) {
      const pull = new THREE.Vector3();
      for (const e of enemies) {
        if (e.dead) continue;
        const toZ = e.ch.group.position.clone().sub(hero.group.position);
        toZ.y = 0;
        const d = toZ.length();
        const radius = 5.2;
        if (d > 0.35 && d < radius) pull.add(toZ.multiplyScalar((2.2 * (1 - d / radius)) / d));
      }
      if (pull.length() > 2.2) pull.setLength(2.2);
      hero.group.position.add(pull.multiplyScalar(worldDt));
    }
    audio.updateWhispers(dtRaw, enemies.filter(e => !e.dead).map(e => e.ch.group), hero.group.position);

    // --- projectiles ---
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.position.add(p.userData.v.clone().multiplyScalar(worldDt));
      p.userData.life -= worldDt;
      if (p.userData.life <= 0) { scene.remove(p); projectiles.splice(i, 1); }
    }
    muzzle.intensity = Math.max(0, muzzle.intensity - dtRaw * 14);

    // --- collectibles ---
    for (const c of coins) {
      if (c.material) c.material.rotation += worldDt * 0.8;
      if (c.visible && hero.group.position.distanceTo(c.position) < 1.15) {
        c.visible = false; coinCount++; score += 10;
        pushEvent('coin', { count: coinCount, score });
        audio.coin(); haptics.pulse(25, 0.1, 0.3);
      }
    }
    for (const k of knowledge) {
      if (k.material) k.material.rotation += worldDt;
      if (k.visible && hero.group.position.distanceTo(k.position) < 1.15) {
        k.visible = false; knowledgeCount++; score += 25;
        pushEvent('wisdom', { count: knowledgeCount, score });
        audio.crystal(); haptics.pulse(35, 0.15, 0.4);
      }
    }
    for (const g of glitter) {
      if (g.material) g.material.rotation += worldDt * 1.4;
      if (g.visible && hero.group.position.distanceTo(g.position) < 1.15) {
        g.visible = false;
        score = Math.max(0, score - 15);
        const spendingLand = LEVELS[levelIndex].coinGoal > 0 && coinCount > 0;
        if (spendingLand) coinCount--;
        pushEvent('glitter', { score, count: coinCount });
        showSubtitle(spendingLand
          ? 'You spent it. The more you spend, the less you have.'
          : 'All that glitters is not gold. Break the distraction.', 2.4);
        audio.thud(0.25);
      }
    }

    // --- cast dialogue ---
    npcEmoteCooldown = Math.max(0, npcEmoteCooldown - dtRaw);
    for (const c of cast) {
      const actor = c.actor;
      const fx = hero.group.position.x - actor.group.position.x;
      const fz = hero.group.position.z - actor.group.position.z;
      actor.group.rotation.y = Math.atan2(fx, fz);
      actor.lookHead(hero.group.position.clone().setY(1.6));
      actor.update(worldDt);
      if (!c.spec.lines) continue;
      const near = dist2D(actor.group.position, hero.group.position) < (c.spec.talk || 3.5);
      if (near && (!c.near || c.lineTimer <= 0)) {
        showSubtitle(c.spec.lines[c.lineIdx % c.spec.lines.length], 4.5);
        c.lineIdx++;
        c.lineTimer = 5;
        if (c.spec.emote && npcEmoteCooldown <= 0) { actor.playEmote(c.spec.emote); npcEmoteCooldown = 6; }
      }
      if (near) c.lineTimer -= dtRaw;
      c.near = near;
    }

    // --- boss & portal (final level) ---
    const aliveEnemies = enemies.filter(e => !e.dead).length;
    if (levelIndex === LEVELS.length - 1) {
      if (spawned >= L.enemyTarget && aliveEnemies === 0 && !boss && !portal.visible) spawnBoss();
      if (boss) {
        if (!boss.dying) {
          const to = hero.group.position.clone().sub(boss.group.position);
          to.y = 0;
          const dist = to.length();
          if (dist > 0.001) to.normalize();
          boss.group.position.add(to.multiplyScalar(bossSpec.speed * worldDt));
          boss.group.rotation.y = Math.atan2(hero.group.position.x - boss.group.position.x, hero.group.position.z - boss.group.position.z);
          boss.setLocomotion(bossSpec.speed);
          boss.lookHead(hero.group.position.clone().setY(1.6));
          // Heavy footsteps: shake + thud, attenuated by distance.
          boss._stepT -= worldDt;
          if (boss._stepT <= 0) {
            boss._stepT = 0.55;
            const att = THREE.MathUtils.clamp(1 - dist / 40, 0, 1);
            shake.add(0.25 * att);
            audio.thud(0.5 * att);
            if (att > 0.5) haptics.pulse(70, 0.6 * att, 0.3);
          }
          for (let j = projectiles.length - 1; j >= 0; j--) {
            if (boss.group.position.distanceTo(projectiles[j].position) < 1.8) {
              scene.remove(projectiles[j]);
              projectiles.splice(j, 1);
              boss.hp--;
              pushEvent('boss_hit', { hp: boss.hp });
              boss.flashHit();
              shake.add(0.2);
              audio.thud(0.7);
              haptics.pulse(90, 0.7, 0.4);
              if (boss.hp <= 0) {
                boss.startFall();
                score += 250;
                pushEvent('boss_down', { score });
                shake.add(0.6);
                haptics.pulse(350, 1, 1);
              }
              break;
            }
          }
          // The last Z pulls harder than the small ones. Shelter still cancels it.
          if (!nearCast('shelter') && dist < 9 && dist > 0.4) {
            const tug = 3.0 * (1 - dist / 9) * worldDt;
            hero.group.position.add(to.clone().multiplyScalar(-tug));
          }
          if (boss.group.position.distanceTo(hero.group.position) < 2.0) {
            lives--;
            pushEvent('hurt', { lives, by: 'boss' });
            hero.flashHit();
            const back = hero.group.position.clone().sub(boss.group.position).setY(0).normalize().multiplyScalar(4);
            hero.group.position.add(back);
            shake.add(0.5);
            haptics.pulse(250, 1, 0.7);
            audio.thud(0.9);
          }
        }
        if (boss.update(worldDt)) {
          scene.remove(boss.group);
          boss = null;
          portal.visible = true;
          spawnZ();
        }
      }
      if (portal.visible) {
        portal.rotation.z += worldDt * 2;
        if (zFigure) { zFigure.lookHead(hero.group.position.clone().setY(1.6)); zFigure.update(worldDt); }
        // The ring is drawn above the ground. Measure the walk on the ground plane,
        // or a hero standing in the ring can never be close enough in 3D.
        if (dist2D(hero.group.position, portal.position) < 1.7) completeLevel();
      }
    } else {
      if ((L.coinGoal === 0 || coinCount >= L.coinGoal) && (L.wisdomGoal === 0 || knowledgeCount >= L.wisdomGoal) && spawned >= L.enemyTarget && aliveEnemies === 0) completeLevel();
    }

    // --- 4D systems ---
    const progress = 1 - timeLeft / L.time;
    dayNight.update(progress, nowShift.active, hero.group.position);
    if (!headless) {
      sand.update(worldDt, hero.group.position, L.windSpeed, L.sandOpacity * (1 + dayNight.stars.material.opacity));
      dust.update(worldDt);
    }
  } else if (hero) {
    hero.setLocomotion(0);
    hero.update(dtRaw);
  }

  // --- camera, shake, FOV ---
  shake.update(dtRaw);
  const focus = hero ? hero.group.position : new THREE.Vector3();
  camera.position.copy(focus).add(forward.clone().multiplyScalar(-6)).add(new THREE.Vector3(0, 2.6, 0)).add(shake.offset);
  camera.lookAt(focus.x, focus.y + 1.5, focus.z);
  camera.rotation.z += shake.roll;
  const targetFov = nowShift.active ? 62 : 70;
  camera.fov += (targetFov - camera.fov) * Math.min(1, 6 * dtRaw);

  // --- subtitles ---
  if (subtitleT > 0) {
    subtitleT -= dtRaw;
    if (subtitleT <= 0) subtitle.style.opacity = '0';
  }

  // --- HUD ---
  const L = LEVELS[levelIndex];
  const aliveNow = enemies.filter(e => !e.dead).length;
  const clock = `${Math.max(0, Math.floor(timeLeft / 60))}:${Math.max(0, Math.floor(timeLeft % 60)).toString().padStart(2, '0')}`;
  let line = `${L.name} · Time ${clock} · Zs ${Math.max(0, L.enemyTarget - spawned + aliveNow)} · Score ${score} · Lives ${lives}`;
  if (L.coinGoal) line += ` · Coins ${coinCount}/${L.coinGoal}`;
  if (L.wisdomGoal) line += ` · Passion ${knowledgeCount}/${L.wisdomGoal}`;
  if (boss && !boss.dying) line += ` · ${bossSpec.name} ${'♥'.repeat(Math.max(0, boss.hp))}`;
  if (activeAura) line += ` · ${activeAura}`;
  hud.textContent = line;
  powerbar.style.width = (nowShift.meter * 100).toFixed(0) + '%';
  powerbar.style.background = nowShift.active ? '#8ad0ff' : (nowShift.meter >= 1 ? '#f4d444' : '#777');

  if (doPaint) renderScene();
}

function loop(t) {
  if (drive === 'realtime') {
    const dtRaw = Math.min(0.033, (t - last) / 1000);
    last = t;
    frame(dtRaw, true);
  }
  // Step mode paints from step(), not from this clock. Re-rendering the bloom
  // pass on every refresh while the sim is idle pegs the CPU and stalls the page.
  requestAnimationFrame(loop);
}

let loopStarted = false;
function ensureLoop() {
  if (loopStarted) return;
  loopStarted = true;
  requestAnimationFrame(loop);
}
if (!headless) ensureLoop();

function stepFrames(n = 1) {
  let count = Math.floor(Number(n));
  if (!Number.isFinite(count)) count = 1;
  count = Math.max(0, Math.min(5000, count));
  if (drive !== 'step') {
    drive = 'step';
    last = performance.now();
  }
  for (let i = 0; i < count; i++) frame(FIXED_DT, false);
  if (!headless) renderScene();
}

function applySeed(seed, opts) {
  if (seed == null || seed === '') return { ok: false, error: 'seed required' };
  setSeed(seed);
  if (opts && opts.restart) return { ...restartGame(), seed: getSeed() };
  return { ok: true, seed: getSeed(), status: state };
}

function setDrive(mode) {
  if (mode !== 'realtime' && mode !== 'step') return { ok: false, error: 'drive must be realtime or step' };
  drive = mode;
  last = performance.now();
  if (mode === 'realtime') ensureLoop();
  return { ok: true, drive };
}

function sample() {
  const L = LEVELS[levelIndex];
  const px = hero ? hero.group.position.x : 0;
  const pz = hero ? hero.group.position.z : 0;
  return {
    status: state,
    loadError,
    levelIndex,
    levelCount: LEVELS.length,
    levelName: L.name,
    levelStory: L.story,
    terrain: L.terrain,
    score, lives, timeLeft, yaw,
    player: { x: px, z: pz },
    coins: coins.filter(c => c.visible).map(c => ({ x: c.position.x, z: c.position.z })),
    knowledge: knowledge.filter(k => k.visible).map(k => ({ x: k.position.x, z: k.position.z })),
    glitter: glitter.filter(g => g.visible).map(g => ({ x: g.position.x, z: g.position.z })),
    enemies: enemies.filter(e => !e.dead).map(e => ({ name: 'Z', x: e.ch.group.position.x, z: e.ch.group.position.z })),
    portal: { x: portal.position.x, z: portal.position.z, open: portal.visible },
    cast: cast.map(c => ({
      name: c.spec.name,
      role: c.spec.role,
      x: c.actor.group.position.x,
      z: c.actor.group.position.z
    })),
    npc: (() => {
      const guide = cast.find(c => c.spec.role === 'guide') || cast[0];
      return guide ? { name: guide.spec.name, x: guide.actor.group.position.x, z: guide.actor.group.position.z } : null;
    })(),
    motion,
    aura: activeAura,
    boss: boss ? {
      name: bossSpec?.name || 'Guardian',
      x: boss.group.position.x,
      z: boss.group.position.z,
      hp: boss.hp,
      maxHp: bossSpec?.hp ?? boss.hp,
      dying: !!boss.dying
    } : null,
    shift: { active: nowShift.active, meter: nowShift.meter, cooldown: nowShift.cd },
    subtitle: subtitleT > 0 ? subtitle.textContent : '',
    outcome,
    levelsCleared,
    seed: getSeed(),
    tick,
    drive,
    spawned,
    coinCount,
    knowledgeCount,
    enemyTarget: L.enemyTarget,
    coinGoal: L.coinGoal,
    wisdomGoal: L.wisdomGoal
  };
}

if (agentMode && !headless) {
  const hint = document.getElementById('hint');
  if (hint) hint.textContent = 'Agent step mode — window.game.step(n) advances time';
}

window.game = createGameApi({
  ready,
  sample,
  drainEvents() { return events.splice(0, events.length); },
  setIntent,
  start: startGame,
  restart: restartGame,
  pause: pauseGame,
  resume: resumeGame,
  stepFrames,
  setSeed: applySeed,
  getSeed,
  setDrive,
  getDrive() { return drive; }
});

if (autoBot) {
  ready.then(async () => {
    try {
      const { runBot } = await import('./bot.js');
      const levels = Number(params.get('levels') || 1);
      const maxTicks = Number(params.get('maxTicks') || (levels > 1 ? 16000 : 7000));
      const result = await runBot(window.game, { levels, maxTicks, yieldFrame: !headless });
      window.game.lastBotResult = result;
      console.log('BOT_RESULT ' + JSON.stringify(result));
    } catch (err) {
      console.error('BOT_ERROR', err);
      window.game.lastBotResult = { ok: false, reason: String(err && err.message || err) };
    }
  });
}
