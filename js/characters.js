import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Clip names differ in casing between the two rigs.
const CLIPS = {
  soldier: { idle: 'Idle', walk: 'Walk', run: 'Run' },
  xbot: { idle: 'idle', walk: 'walk', run: 'run', agree: 'agree', headShake: 'headShake', sad: 'sad_pose', sneak: 'sneak_pose' }
};

// Nominal forward speed (world units/s) each locomotion clip was authored for,
// used to scale playback so feet match ground speed.
const CLIP_SPEED = { walk: 1.8, run: 5.5 };

export async function loadBaseModels(path = './assets/models/') {
  const loader = new GLTFLoader();
  const [soldier, xbot] = await Promise.all([
    loader.loadAsync(path + 'Soldier.glb'),
    loader.loadAsync(path + 'Xbot.glb')
  ]);
  return {
    soldier: { scene: soldier.scene, animations: soldier.animations, clips: CLIPS.soldier },
    xbot: { scene: xbot.scene, animations: xbot.animations, clips: CLIPS.xbot }
  };
}

export function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const g = canvas.getContext('2d');
  g.fillStyle = 'rgba(10,10,14,0.55)';
  g.beginPath(); g.roundRect(4, 8, 248, 48, 12); g.fill();
  g.font = '700 26px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#f4d444';
  g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(2.2, 0.55, 1);
  return sprite;
}

export class Character {
  constructor(base, spec = {}) {
    const rig = SkeletonUtils.clone(base.scene);
    this.materials = [];
    rig.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.material = o.material.clone();
      const m = o.material;
      if (spec.tint !== undefined) m.color = new THREE.Color(spec.tint);
      if (spec.emissive !== undefined) m.emissive = new THREE.Color(spec.emissive);
      if (spec.emissiveIntensity !== undefined) m.emissiveIntensity = spec.emissiveIntensity;
      if (spec.metalness !== undefined) m.metalness = spec.metalness;
      if (spec.roughness !== undefined) m.roughness = spec.roughness;
      if (spec.opacity !== undefined) { m.transparent = true; m.opacity = spec.opacity; }
      m.userData.baseEmissive = m.emissive.clone();
      m.userData.baseOpacity = m.opacity;
      this.materials.push(m);
    });
    if (spec.scale) rig.scale.setScalar(spec.scale);
    this.scaleFactor = spec.scale || 1;

    this.group = new THREE.Group();
    this.group.add(rig);
    this.rig = rig;

    this.mixer = new THREE.AnimationMixer(rig);
    this.actions = {};
    this._weights = {};
    this._targets = {};
    for (const [key, clipName] of Object.entries(base.clips)) {
      const clip = THREE.AnimationClip.findByName(base.animations, clipName);
      if (!clip) continue;
      if (key === 'sneak' && spec.sneakAdditive) {
        // Layered additively over run/walk for the Chasers' hunched creep.
        const add = THREE.AnimationUtils.makeClipAdditive(clip.clone());
        const a = this.mixer.clipAction(add);
        a.play(); a.setEffectiveWeight(0.6);
        continue;
      }
      const a = this.mixer.clipAction(clip);
      a.play(); a.setEffectiveWeight(0);
      this.actions[key] = a;
      this._weights[key] = 0;
      this._targets[key] = 0;
    }
    this._current = null;
    this.setAction('idle');
    this._weights.idle = 1;
    if (this.actions.idle) this.actions.idle.setEffectiveWeight(1);

    this.headBone = rig.getObjectByName('mixamorigHead');
    if (!this.headBone) rig.traverse(o => { if (!this.headBone && o.isBone && /head$/i.test(o.name)) this.headBone = o; });
    this._headYaw = 0; this._headPitch = 0;
    this._headTarget = null;
    this._headQ = new THREE.Quaternion();

    if (spec.label) {
      this.label = makeLabel(spec.label);
      this.label.position.y = 2.15 * this.scaleFactor;
      this.group.add(this.label);
    }

    this.hitFlash = 0;
    this.dying = null;
    this._emoteT = 0;
  }

  setAction(key, fade = 0.25) {
    if (!this.actions[key] || this._current === key) return;
    this._current = key;
    this._fade = fade;
    for (const k of Object.keys(this._targets)) this._targets[k] = (k === key) ? 1 : 0;
    this.actions[key].time = 0;
  }

  setLocomotion(speed) {
    if (this._emoteT > 0 || this.dying) return;
    const key = speed < 0.2 ? 'idle' : (speed < 3.5 && this.actions.walk) ? 'walk' : 'run';
    this.setAction(key);
    if (key !== 'idle' && this.actions[key]) {
      const nominal = CLIP_SPEED[key] * this.scaleFactor;
      this.actions[key].timeScale = THREE.MathUtils.clamp(speed / nominal, 0.6, 1.8);
    }
  }

  playEmote(key, loop = false) {
    if (!this.actions[key]) return;
    this.setAction(key, 0.2);
    this._emoteT = loop ? Infinity : this.actions[key].getClip().duration;
  }

  lookHead(worldTarget) { this._headTarget = worldTarget; }

  flashHit() { this.hitFlash = 0.3; }
  startDissolve() { if (!this.dying) this.dying = { type: 'dissolve', t: 0.6, dur: 0.6 }; }
  startFall() { if (!this.dying) this.dying = { type: 'fall', t: 0.8, dur: 0.8 }; }

  // Returns true once a death animation has fully finished.
  update(dt) {
    if (this._emoteT > 0 && this._emoteT !== Infinity) {
      this._emoteT -= dt;
      if (this._emoteT <= 0) { this._emoteT = 0; this.setAction('idle'); }
    }
    this.mixer.update(dt);

    const rate = dt / (this._fade || 0.25);
    for (const k of Object.keys(this._weights)) {
      const w = THREE.MathUtils.lerp(this._weights[k], this._targets[k], Math.min(1, rate));
      this._weights[k] = w;
      this.actions[k].setEffectiveWeight(w);
    }

    // Head look-at: applied after the mixer so it layers on the animated pose.
    if (this.headBone) {
      let ty = 0, tp = 0;
      if (this._headTarget && !this.dying) {
        const headPos = new THREE.Vector3();
        this.headBone.getWorldPosition(headPos);
        const to = this._headTarget.clone().sub(headPos);
        const dist = Math.hypot(to.x, to.z);
        // Yaw relative to the character's facing direction.
        const facing = this.group.rotation.y;
        let yaw = Math.atan2(to.x, to.z) - facing;
        yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
        ty = THREE.MathUtils.clamp(yaw, -Math.PI / 3, Math.PI / 3);
        tp = THREE.MathUtils.clamp(Math.atan2(to.y, dist), -Math.PI / 6, Math.PI / 6);
      }
      const s = Math.min(1, 5 * dt);
      this._headYaw += (ty - this._headYaw) * s;
      this._headPitch += (tp - this._headPitch) * s;
      this._headQ.setFromEuler(new THREE.Euler(-this._headPitch * 0.8, this._headYaw * 0.8, 0));
      this.headBone.quaternion.multiply(this._headQ);
    }

    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      const f = this.hitFlash / 0.3;
      for (const m of this.materials) m.emissive.copy(m.userData.baseEmissive).lerp(new THREE.Color(0xff2211), f);
    }

    if (this.dying) {
      this.dying.t -= dt;
      const p = 1 - Math.max(0, this.dying.t) / this.dying.dur;
      if (this.dying.type === 'dissolve') {
        for (const m of this.materials) { m.transparent = true; m.opacity = m.userData.baseOpacity * (1 - p); }
        this.rig.scale.y = this.scaleFactor * Math.max(0.1, 1 - p * 0.9);
      } else {
        this.rig.rotation.x = -Math.PI / 2 * Math.min(1, p * 1.4);
        if (p > 0.5) for (const m of this.materials) { m.transparent = true; m.opacity = m.userData.baseOpacity * (1 - (p - 0.5) * 2); }
      }
      if (this.dying.t <= 0) return true;
    }
    return false;
  }
}
