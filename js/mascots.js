import * as THREE from 'three';
import { Character, makeLabel } from './characters.js';

// Graphic stand-ins for the No Rest cast. The legend slides are the owner's
// posters (text baked into the art), so these are drawn in that same flat
// language: a yellow stick figure, a gold coin face, a smiley, a bear, a
// balloon, a grey alien with black eyes, and a gold Z with a face.

function paint(color, emissive = 0x000000, extra = {}) {
  const m = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: extra.emissiveIntensity ?? 0.4,
    roughness: extra.roughness ?? 0.48,
    metalness: extra.metalness ?? 0.08
  });
  m.userData.baseEmissive = m.emissive.clone();
  return m;
}

function mesh(geo, material, parent, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function eyes(parent, material, y, z, spread, r) {
  mesh(new THREE.SphereGeometry(r, 8, 8), material, parent, -spread, y, z);
  mesh(new THREE.SphereGeometry(r, 8, 8), material, parent, spread, y, z);
}

function billboard(draw, width, height, y) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  draw(g);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(width, height, 1);
  sprite.position.y = y;
  return sprite;
}

function drawStickman(g) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#111111';
  g.lineWidth = 22;
  g.fillStyle = '#ffe14a';
  g.beginPath();
  g.arc(128, 58, 34, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 8;
  g.stroke();
  g.fillStyle = '#1a1408';
  g.beginPath();
  g.arc(116, 54, 5, 0, Math.PI * 2);
  g.arc(140, 54, 5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffe14a';
  g.lineWidth = 16;
  g.beginPath();
  g.moveTo(128, 92); g.lineTo(128, 168);
  g.moveTo(128, 112); g.lineTo(78, 150);
  g.moveTo(128, 112); g.lineTo(178, 150);
  g.moveTo(128, 168); g.lineTo(90, 230);
  g.moveTo(128, 168); g.lineTo(166, 230);
  g.stroke();
  g.strokeStyle = '#111111';
  g.lineWidth = 3;
  g.stroke();
}

function drawCoinFace(g) {
  g.fillStyle = '#f0c247';
  g.beginPath();
  g.arc(128, 128, 108, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#fff3b0';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(128, 128, 88, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#2a1c08';
  g.beginPath();
  g.arc(96, 112, 11, 0, Math.PI * 2);
  g.arc(160, 112, 11, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#2a1c08';
  g.lineWidth = 8;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(128, 138, 34, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
}

function drawSmiley(g) {
  g.fillStyle = '#ffe14a';
  g.beginPath();
  g.arc(128, 128, 108, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#111111';
  g.lineWidth = 8;
  g.stroke();
  g.fillStyle = '#1a1408';
  g.beginPath();
  g.ellipse(90, 112, 14, 18, 0, 0, Math.PI * 2);
  g.ellipse(166, 112, 14, 18, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#1a1408';
  g.lineWidth = 10;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(128, 142, 48, 0.12 * Math.PI, 0.88 * Math.PI);
  g.stroke();
}

function drawBear(g) {
  g.fillStyle = '#6b4423';
  g.beginPath();
  g.arc(78, 70, 28, 0, Math.PI * 2);
  g.arc(178, 70, 28, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#8a5a32';
  g.beginPath();
  g.arc(128, 148, 78, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f0c247';
  g.beginPath();
  g.ellipse(128, 168, 28, 22, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d8b48a';
  g.beginPath();
  g.ellipse(128, 150, 22, 16, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1a120c';
  g.beginPath();
  g.arc(104, 132, 7, 0, Math.PI * 2);
  g.arc(152, 132, 7, 0, Math.PI * 2);
  g.arc(128, 152, 5, 0, Math.PI * 2);
  g.fill();
}

function drawAlien(g) {
  g.fillStyle = '#c5c5d2';
  g.beginPath();
  g.ellipse(128, 118, 78, 96, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#0c0c12';
  g.beginPath();
  g.ellipse(96, 118, 22, 32, 0, 0, Math.PI * 2);
  g.ellipse(160, 118, 22, 32, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#9aa0b0';
  g.lineWidth = 8;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(128, 210); g.lineTo(128, 236);
  g.moveTo(128, 220); g.lineTo(96, 236);
  g.moveTo(128, 220); g.lineTo(160, 236);
  g.stroke();
}

function drawZed(g, tint) {
  const hex = '#' + new THREE.Color(tint).getHexString();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#2a1c08';
  g.lineWidth = 36;
  g.beginPath();
  g.moveTo(48, 56); g.lineTo(208, 56); g.lineTo(48, 188); g.lineTo(208, 188);
  g.stroke();
  g.strokeStyle = hex;
  g.lineWidth = 22;
  g.stroke();
  g.fillStyle = '#1a1208';
  g.beginPath();
  g.arc(78, 78, 8, 0, Math.PI * 2);
  g.arc(108, 78, 8, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#1a1208';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(93, 96, 16, 0.2 * Math.PI, 0.8 * Math.PI);
  g.stroke();
}

function drawHeart(g) {
  g.fillStyle = '#ff4d88';
  g.beginPath();
  g.moveTo(128, 210);
  g.bezierCurveTo(16, 130, 48, 36, 128, 84);
  g.bezierCurveTo(208, 36, 240, 130, 128, 210);
  g.fill();
}

function drawSpark(g) {
  g.fillStyle = '#f4f4ff';
  g.strokeStyle = '#9aa0c0';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(128, 28); g.lineTo(148, 108); g.lineTo(228, 128); g.lineTo(148, 148);
  g.lineTo(128, 228); g.lineTo(108, 148); g.lineTo(28, 128); g.lineTo(108, 108);
  g.closePath();
  g.fill();
  g.stroke();
}

export function makeToken(kind) {
  const draw = kind === 'passion' ? drawHeart : kind === 'glitter' ? drawSpark : drawCoinFace;
  const size = kind === 'passion' ? 0.52 : 0.58;
  return billboard(draw, size, size, 0.45);
}

export class Mascot {
  static _phaseN = 0;
  constructor(kind, spec = {}) {
    this.kind = kind;
    this.group = new THREE.Group();
    this.pivot = new THREE.Group();
    this.group.add(this.pivot);
    this.materials = [];
    this.limbs = null;
    this.scaleFactor = spec.scale || 1;
    if (spec.scale) this.group.scale.setScalar(spec.scale);
    this._build(kind, spec);
    if (spec.label) {
      this.label = makeLabel(spec.label);
      this.label.position.y = 2.15 * this.scaleFactor;
      this.group.add(this.label);
    }
    this.hitFlash = 0;
    this.dying = null;
    this.lightweight = !!spec.lightweight;
    this._loco = 0;
    this._phase = (Mascot._phaseN++ % 8) * 0.7;
  }

  _mat(color, emissive, extra) {
    const m = paint(color, emissive, extra);
    this.materials.push(m);
    return m;
  }

  _build(kind, spec) {
    const tint = spec.tint ?? 0xf4d444;
    const glow = spec.emissive ?? 0x000000;
    if (kind === 'stickman') this._stickman(tint, glow);
    else if (kind === 'z') this._zed(tint);
    else if (kind === 'coin') this._coin(tint, glow);
    else if (kind === 'smiley') this._smiley(tint, glow);
    else if (kind === 'bear') this._bear(tint, glow);
    else if (kind === 'balloon') this._balloon(tint, glow);
    else if (kind === 'alien') this._alien(tint, glow);
    else this._stickman(tint, glow);
  }

  _stickman() {
    this.sprite = billboard(drawStickman, 1.15, 1.9, 0.95);
    this.pivot.add(this.sprite);
  }

  _zed(tint) {
    this.sprite = billboard(g => drawZed(g, tint), 1.45, 1.45, 0.85);
    this.pivot.add(this.sprite);
  }

  _coin() {
    this.sprite = billboard(drawCoinFace, 1.35, 1.35, 1.05);
    this.pivot.add(this.sprite);
  }

  _smiley() {
    this.sprite = billboard(drawSmiley, 1.5, 1.5, 0.9);
    this.pivot.add(this.sprite);
  }

  _bear() {
    this.sprite = billboard(drawBear, 1.55, 1.55, 0.95);
    this.pivot.add(this.sprite);
  }

  _balloon(tint) {
    const skin = new THREE.MeshBasicMaterial({ color: tint });
    const string = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const plus = new THREE.MeshBasicMaterial({ color: 0xfff6c2 });
    this.materials.push(skin, string, plus);
    mesh(new THREE.SphereGeometry(0.42, 18, 14), skin, this.pivot, 0, 1.55, 0);
    mesh(new THREE.ConeGeometry(0.08, 0.16, 8), skin, this.pivot, 0, 1.08, 0);
    const rope = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 5), string, this.pivot, 0, 0.55, 0);
    rope.castShadow = false;
    mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), plus, this.pivot, 0, 1.55, 0.4);
    mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), plus, this.pivot, 0, 1.55, 0.4);
  }

  _alien() {
    this.sprite = billboard(drawAlien, 1.7, 1.7, 1.0);
    this.pivot.add(this.sprite);
  }

  setLocomotion(speed) { this._loco = speed || 0; }
  lookHead() {}
  playEmote() {}
  flashHit() { this.hitFlash = 0.3; }
  startDissolve() { if (!this.dying) this.dying = { type: 'dissolve', t: 0.6, dur: 0.6 }; }
  startFall() { if (!this.dying) this.dying = { type: 'fall', t: 0.8, dur: 0.8 }; }

  update(dt) {
    this._phase += dt;
    if (this.dying) {
      this.dying.t -= dt;
      if (!this.lightweight) {
        const p = 1 - Math.max(0, this.dying.t) / this.dying.dur;
        if (this.dying.type === 'fall') this.pivot.rotation.x = -Math.PI / 2 * Math.min(1, p * 1.2);
        else this.pivot.scale.y = Math.max(0.08, 1 - p * 0.9);
        for (const m of this.materials) {
          m.transparent = true;
          m.opacity = 1 - p;
        }
        if (this.sprite) this.sprite.material.opacity = 1 - p;
      }
      return this.dying.t <= 0;
    }
    if (this.lightweight) return false;

    const bob = Math.sin(this._phase * (this.kind === 'coin' ? 2.2 : 1.6)) * (this.kind === 'balloon' ? 0.12 : 0.05);
    this.pivot.position.y = bob;

    if (this.sprite && this.sprite.material) {
      const sway = this._loco > 0.2 ? Math.sin(this._phase * 8) * 0.12 : Math.sin(this._phase * 1.5) * 0.03;
      this.sprite.material.rotation = sway;
    }

    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      const f = this.hitFlash / 0.3;
      for (const m of this.materials) {
        if (!m.emissive) continue;
        const base = m.userData.baseEmissive || new THREE.Color(0x000000);
        m.emissive.copy(base).lerp(new THREE.Color(0xff2211), f);
      }
      if (this.sprite) this.sprite.material.color.setHex(f > 0.02 ? 0xff8877 : 0xffffff);
    }
    return false;
  }
}

export function makeActor(spec, models, headless) {
  let actor;
  if (spec.mascot) {
    actor = new Mascot(spec.mascot, {
      scale: spec.scale,
      tint: spec.tint,
      emissive: spec.emissive,
      label: spec.name,
      lightweight: headless
    });
  } else {
    actor = new Character(models[spec.model || 'xbot'], {
      tint: spec.tint,
      emissive: spec.emissive,
      emissiveIntensity: spec.emissiveIntensity,
      metalness: spec.metalness,
      roughness: spec.roughness,
      scale: spec.scale,
      opacity: spec.opacity,
      sneakAdditive: spec.sneakAdditive,
      label: spec.name,
      lightweight: headless
    });
  }
  if (spec.chains) {
    const metal = new THREE.MeshBasicMaterial({ color: 0xe8e8f0 });
    const neck = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 8, 16), metal);
    neck.rotation.x = Math.PI / 2;
    neck.position.y = 1.48;
    actor.group.add(neck);
    for (let i = 0; i < 5; i++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.028, 6, 12), metal);
      link.position.set(0.05, 1.28 - i * 0.16, 0.2);
      link.rotation.x = Math.PI / 2;
      actor.group.add(link);
    }
  }
  return actor;
}
