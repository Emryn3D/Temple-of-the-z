import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { LEVELS } from './levels.js';
import { loadBaseModels, Character } from './characters.js';
import { NowShift, DayNight } from './timefx.js';
import { CameraShake, Haptics, SandParticles, DustPuffs } from './fx.js';
import { GameAudio } from './audio.js';

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

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 2.2, 6);
const hemi = new THREE.HemisphereLight(0xffffff, 0x8b6d45, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(50, 60, 20);
sun.castShadow = true;
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

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.7, 0.9);
composer.addPass(bloomPass);

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
let hero = null, npc = null, npcSpec = null, boss = null, bossSpec = null, zFigure = null;
let heroYawVisual = 0;
const enemies = [], coins = [], knowledge = [], projectiles = [];

class Enemy {
  constructor(pos) {
    this.ch = new Character(models.xbot, {
      tint: 0x0a0a0a, emissive: 0x2a1640, opacity: 0.85, sneakAdditive: true
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
      this.ch.group.lookAt(hero.group.position.x, 0, hero.group.position.z);
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
  coinCount = 0;
  knowledgeCount = 0;
  for (let i = 0; i < 18; i++) {
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.08, 12, 24), new THREE.MeshStandardMaterial({ color: 0xf0c247, emissive: 0x443300 }));
    c.rotation.x = Math.PI / 2;
    c.position.set(Math.random() * 110 - 55, 0.6, -(12 + i * 5));
    c.castShadow = true;
    coins.push(c);
    scene.add(c);
  }
  for (let i = 0; i < 12; i++) {
    const k = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: 0xa285ff }));
    k.position.set(Math.random() * 115 - 57, 0.5, -(10 + i * 8));
    knowledge.push(k);
    scene.add(k);
  }
}

function spawnEnemy() {
  const a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 20;
  const p = new THREE.Vector3(hero.group.position.x + Math.cos(a) * d, 0, hero.group.position.z + Math.sin(a) * d);
  enemies.push(new Enemy(p));
  spawned++;
  active++;
}

function spawnNpc() {
  if (npc) { scene.remove(npc.group); npc = null; }
  npcSpec = LEVELS[levelIndex].npc;
  if (!npcSpec) return;
  npc = new Character(models[npcSpec.model], {
    tint: npcSpec.tint, emissive: npcSpec.emissive, label: npcSpec.name
  });
  npc.group.position.set(...npcSpec.pos);
  scene.add(npc.group);
  npc._lineIdx = 0;
  npc._near = false;
  npc._lineTimer = 0;
}

function spawnBoss() {
  bossSpec = LEVELS[levelIndex].boss;
  boss = new Character(models[bossSpec.model], {
    tint: bossSpec.tint, emissive: bossSpec.emissive, metalness: bossSpec.metalness,
    roughness: bossSpec.roughness, scale: bossSpec.scale, label: bossSpec.name
  });
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
  const spec = LEVELS[levelIndex].zFigure;
  if (!spec || zFigure) return;
  zFigure = new Character(models[spec.model], {
    tint: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9, label: spec.name
  });
  zFigure.group.position.set(portal.position.x, 0, portal.position.z + 1.2);
  scene.add(zFigure.group);
  zFigure.playEmote('agree', true);
  showSubtitle('Z: You stretched the Now and did not break. Come through.', 6);
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
    audio.setShift(true);
    haptics.pulse(80, 0.4, 0.7);
  }
}

// ---------- input ----------
const keys = {};
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
  const L = LEVELS[i];
  timeLeft = L.time;
  spawned = 0;
  active = 0;
  hero.group.position.set(0, 0, 0);
  yaw = 0;
  heroYawVisual = Math.PI;
  portal.visible = false;
  clearEnemies();
  clearMeshArr(projectiles);
  if (boss) { scene.remove(boss.group); boss = null; }
  if (zFigure) { scene.remove(zFigure.group); zFigure = null; }
  buildWorld();
  spawnCollectibles();
  spawnNpc();
  dayNight.setLevel(L);
  ovTitle.textContent = L.name;
  ovText.textContent = L.story;
}

function completeLevel() {
  if (levelIndex < LEVELS.length - 1) {
    state = 'menu';
    setLevel(levelIndex + 1);
    overlay.style.display = 'flex';
    btnPlay.textContent = 'Next Level';
  } else {
    state = 'win';
    ovTitle.textContent = 'Legend Complete';
    ovText.textContent = 'You crossed Now and entered the Temple of Z.';
    overlay.style.display = 'flex';
  }
}

function failLevel() {
  state = 'menu';
  ovTitle.textContent = 'You fell out of Now';
  ovText.textContent = 'The Now reshapes itself. Try this passage again.';
  overlay.style.display = 'flex';
  btnPlay.textContent = 'Retry Level';
  lives = 3;
  setLevel(levelIndex);
}

btnPlay.onclick = () => {
  if (state === 'loading') return;
  audio.init(camera);
  audio.attachPortalHum(portal);
  if (state === 'win') { score = 0; lives = 3; setLevel(0); btnPlay.textContent = 'Start Story'; state = 'menu'; return; }
  state = 'run';
  overlay.style.display = 'none';
};
document.getElementById('btnRestart').onclick = () => {
  if (state === 'loading') return;
  score = 0; lives = 3;
  setLevel(0);
  state = 'menu';
  btnPlay.textContent = 'Start Story';
  overlay.style.display = 'flex';
};
document.getElementById('btnPause').onclick = () => { if (state === 'run') state = 'pause'; };
document.getElementById('btnResume').onclick = () => { if (state === 'pause') state = 'run'; };

// ---------- boot ----------
ovTitle.textContent = 'Temple of Z';
ovText.textContent = 'Awakening the Now…';
btnPlay.disabled = true;
loadBaseModels().then(m => {
  models = m;
  hero = new Character(models.soldier, { tint: 0xfff2e2, emissive: 0x33240f, emissiveIntensity: 0.4 });
  scene.add(hero.group);
  setLevel(0);
  btnPlay.disabled = false;
  btnPlay.textContent = 'Start Story';
  state = 'menu';
}).catch(err => {
  ovText.textContent = 'Failed to load characters: ' + err.message;
});

// ---------- main loop ----------
let last = performance.now();
let stepTimer = 0;
let npcEmoteCooldown = 0;

function loop(t) {
  const dtRaw = Math.min(0.033, (t - last) / 1000);
  last = t;

  const shiftEnded = nowShift.update(dtRaw);
  if (shiftEnded) audio.setShift(false);
  const worldDt = dtRaw * nowShift.worldScale;
  const playerDt = dtRaw * nowShift.playerScale;

  const gp = haptics.poll();
  if (gp.fire && !gpPrev.fire) fire();
  if (gp.shift && !gpPrev.shift) tryShift();
  gpPrev = gp;

  if (keys.ArrowLeft || keys.KeyQ) yaw += 2.4 * playerDt;
  if (keys.ArrowRight || keys.KeyE) yaw -= 2.4 * playerDt;
  if (gp.connected) yaw -= gp.x * 2.4 * playerDt;
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
    let speed = 0;
    if (move.length()) {
      move.normalize();
      speed = 8;
      hero.group.position.add(move.clone().multiplyScalar(speed * playerDt));
      // Turn the hero toward the direction of travel (model faces +Z).
      const targetYaw = Math.atan2(move.x, move.z);
      let d = targetYaw - heroYawVisual;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      heroYawVisual += d * Math.min(1, 12 * playerDt);
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
        dust.spawn(hero.group.position);
      }
    } else stepTimer = 0;

    // --- enemies ---
    if (spawned < L.enemyTarget && enemies.filter(e => !e.dead).length < 10) {
      if (Math.random() < worldDt * 1.4) spawnEnemy();
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const done = e.update(worldDt);
      if (done) { e.remove(); enemies.splice(i, 1); continue; }
      if (e.dead) continue;
      let killed = false;
      for (let j = projectiles.length - 1; j >= 0; j--) {
        if (e.ch.group.position.distanceTo(projectiles[j].position) < 1.2) {
          e.kill();
          active--;
          scene.remove(projectiles[j]);
          projectiles.splice(j, 1);
          score += 50;
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
        e.kill();
        active--;
        hero.flashHit();
        shake.add(0.45);
        haptics.pulse(200, 1, 0.6);
        audio.thud(0.8);
      }
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
      c.rotation.z += worldDt * 2;
      if (c.visible && hero.group.position.distanceTo(c.position) < 1) {
        c.visible = false; coinCount++; score += 10;
        audio.coin(); haptics.pulse(25, 0.1, 0.3);
      }
    }
    for (const k of knowledge) {
      k.rotation.y += worldDt * 2.5;
      if (k.visible && hero.group.position.distanceTo(k.position) < 1) {
        k.visible = false; knowledgeCount++; score += 25;
        audio.crystal(); haptics.pulse(35, 0.15, 0.4);
      }
    }

    // --- NPC dialogue ---
    npcEmoteCooldown = Math.max(0, npcEmoteCooldown - dtRaw);
    if (npc) {
      npc.lookHead(hero.group.position.clone().setY(1.6));
      npc.update(worldDt);
      const near = npc.group.position.distanceTo(hero.group.position) < 3.5;
      if (near && (!npc._near || npc._lineTimer <= 0)) {
        showSubtitle(npcSpec.lines[npc._lineIdx % npcSpec.lines.length], 4.5);
        npc._lineIdx++;
        npc._lineTimer = 5;
        if (npcSpec.emote && npcEmoteCooldown <= 0) { npc.playEmote(npcSpec.emote); npcEmoteCooldown = 6; }
      }
      if (near) npc._lineTimer -= dtRaw;
      npc._near = near;
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
          boss.group.lookAt(hero.group.position.x, 0, hero.group.position.z);
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
              boss.flashHit();
              shake.add(0.2);
              audio.thud(0.7);
              haptics.pulse(90, 0.7, 0.4);
              if (boss.hp <= 0) {
                boss.startFall();
                score += 250;
                shake.add(0.6);
                haptics.pulse(350, 1, 1);
              }
              break;
            }
          }
          if (boss.group.position.distanceTo(hero.group.position) < 2.0) {
            lives--;
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
        if (hero.group.position.distanceTo(portal.position) < 1.7) completeLevel();
      }
    } else {
      if ((L.coinGoal === 0 || coinCount >= L.coinGoal) && (L.wisdomGoal === 0 || knowledgeCount >= L.wisdomGoal) && spawned >= L.enemyTarget && aliveEnemies === 0) completeLevel();
    }

    // --- 4D systems ---
    const progress = 1 - timeLeft / L.time;
    dayNight.update(progress, nowShift.active, hero.group.position);
    sand.update(worldDt, hero.group.position, L.windSpeed, L.sandOpacity * (1 + dayNight.stars.material.opacity));
    dust.update(worldDt);
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
  let line = `${L.name} · Time ${Math.max(0, Math.floor(timeLeft / 60))}:${Math.max(0, Math.floor(timeLeft % 60)).toString().padStart(2, '0')} · Enemies ${Math.max(0, L.enemyTarget - spawned + aliveNow)} · Coins ${coinCount}/${L.coinGoal || '-'} · Wisdom ${knowledgeCount}/${L.wisdomGoal || '-'} · Score ${score} · Lives ${lives}`;
  if (boss && !boss.dying) line += ` · Guardian ${'♥'.repeat(Math.max(0, boss.hp))}`;
  hud.textContent = line;
  powerbar.style.width = (nowShift.meter * 100).toFixed(0) + '%';
  powerbar.style.background = nowShift.active ? '#8ad0ff' : (nowShift.meter >= 1 ? '#f4d444' : '#777');

  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  composer.setSize(innerWidth, innerHeight);
  composer.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
