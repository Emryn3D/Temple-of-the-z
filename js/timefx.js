import * as THREE from 'three';

// "Now-shift" — the player's time power. While active the world runs at 1/4
// speed but the player keeps ~90% speed; the level clock keeps draining at
// world rate, so stretching the Now spends it.
export class NowShift {
  constructor() {
    this.duration = 2.0;
    this.cooldown = 8.0;
    this.t = 0;
    this.cd = 0;
    this.active = false;
  }
  tryActivate() {
    if (this.active || this.cd > 0) return false;
    this.active = true;
    this.t = this.duration;
    return true;
  }
  // Returns true on the frame the shift ends (for audio/fx restore).
  update(dt) {
    if (this.active) {
      this.t -= dt;
      if (this.t <= 0) { this.active = false; this.cd = this.cooldown; return true; }
    } else if (this.cd > 0) {
      this.cd = Math.max(0, this.cd - dt);
    }
    return false;
  }
  get meter() { return this.active ? this.t / this.duration : 1 - this.cd / this.cooldown; }
  get worldScale() { return this.active ? 0.25 : 1; }
  get playerScale() { return this.active ? 0.9 : 1; }
}

function makeStarfield() {
  const n = 400;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // Upper hemisphere dome.
    const a = Math.random() * Math.PI * 2;
    const e = Math.asin(Math.random() * 0.95 + 0.05);
    const r = 280;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    pos[i * 3 + 1] = Math.sin(e) * r;
    pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xeef2ff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const stars = new THREE.Points(geo, mat);
  stars.frustumCulled = false;
  return stars;
}

const STOPS = [['dawn', 0], ['noon', 0.35], ['dusk', 0.7], ['night', 1]];

export class DayNight {
  constructor(scene, sun, hemi, bloomPass) {
    this.scene = scene;
    this.sun = sun;
    this.hemi = hemi;
    this.bloom = bloomPass;
    scene.add(sun.target);
    this.stars = makeStarfield();
    scene.add(this.stars);
    this._fog = new THREE.Color();
    this._sky = new THREE.Color();
    this._shiftTint = new THREE.Color(0xbfeaff);
    this._sunWarm = new THREE.Color(0xff8844);
    this._white = new THREE.Color(0xffffff);
  }

  setLevel(L) {
    this.palette = {};
    for (const [key] of STOPS) {
      this.palette[key] = { fog: new THREE.Color(L.palette[key].fog), sky: new THREE.Color(L.palette[key].sky) };
    }
    this.nightAmount = L.nightAmount;
    this.scene.fog = new THREE.Fog(L.palette.dawn.fog, L.fogRange[0], L.fogRange[1]);
    this.scene.background = new THREE.Color(L.palette.dawn.sky);
    this.update(0, false);
  }

  _samplePalette(a, field, out) {
    for (let i = 0; i < STOPS.length - 1; i++) {
      const [k0, s0] = STOPS[i];
      const [k1, s1] = STOPS[i + 1];
      if (a <= s1 || i === STOPS.length - 2) {
        const f = THREE.MathUtils.clamp((a - s0) / (s1 - s0), 0, 1);
        out.copy(this.palette[k0][field]).lerp(this.palette[k1][field], f);
        return out;
      }
    }
    return out;
  }

  // progress: 0..1 across the level timer. shiftActive: Now-shift visual grade.
  // focus: world point (the player) the sun's shadow camera should track.
  update(progress, shiftActive, focus) {
    const a = THREE.MathUtils.clamp(progress, 0, 1) * this.nightAmount;
    const nightF = THREE.MathUtils.smoothstep(a, 0.65, 1);
    const duskF = THREE.MathUtils.smoothstep(a, 0.35, 0.8);

    // Sun arcs across the sky and warms toward dusk.
    const az = -0.4 + a * 1.6;
    const elev = Math.max(0.06, Math.sin(Math.PI * (0.2 + 0.65 * (1 - a))));
    this.sun.position.set(Math.cos(az) * 70 * Math.cos(elev), Math.sin(elev) * 80 + 8, Math.sin(az) * 70 * Math.cos(elev));
    if (focus) {
      this.sun.position.add(focus);
      this.sun.target.position.copy(focus);
    }
    this.sun.intensity = THREE.MathUtils.lerp(1.0, 0.15, nightF);
    this.sun.color.copy(this._white).lerp(this._sunWarm, duskF * 0.8);
    this.hemi.intensity = THREE.MathUtils.lerp(0.55, 0.18, nightF);

    this._samplePalette(a, 'fog', this._fog);
    this._samplePalette(a, 'sky', this._sky);
    if (shiftActive) {
      this._fog.lerp(this._shiftTint, 0.35);
      this._sky.lerp(this._shiftTint, 0.25);
    }
    if (this.scene.fog) this.scene.fog.color.copy(this._fog);
    this.scene.background.copy(this._sky);

    this.stars.material.opacity = nightF * 0.9;
    if (this.bloom) this.bloom.strength = 0.5 + nightF * 0.3 + (shiftActive ? 0.35 : 0);
  }
}
