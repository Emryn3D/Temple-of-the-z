import * as THREE from 'three';

// Trauma-based camera shake: impacts add trauma, shake amplitude is trauma².
export class CameraShake {
  constructor() {
    this.trauma = 0;
    this._t = 0;
    this.offset = new THREE.Vector3();
    this.roll = 0;
  }
  add(a) { this.trauma = Math.min(1, this.trauma + a); }
  update(dt) {
    this._t += dt;
    this.trauma = Math.max(0, this.trauma - 1.5 * dt);
    const s = this.trauma * this.trauma;
    const T = this._t;
    this.offset.set(
      Math.sin(T * 43.7) * 0.25 * s,
      Math.sin(T * 38.1 + 1.3) * 0.2 * s,
      Math.sin(T * 31.7 + 2.1) * 0.15 * s
    );
    this.roll = Math.sin(T * 29.3) * 0.04 * s;
  }
}

// Mobile vibration + gamepad rumble, plus gamepad stick/button polling.
export class Haptics {
  pulse(ms, strong = 0.8, weak = 0.5) {
    try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
    for (const gp of (navigator.getGamepads?.() || [])) {
      try {
        gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak });
      } catch { /* unsupported */ }
    }
  }
  poll() {
    const out = { x: 0, y: 0, fire: false, shift: false, connected: false };
    for (const gp of (navigator.getGamepads?.() || [])) {
      if (!gp) continue;
      out.connected = true;
      const dz = v => Math.abs(v) > 0.18 ? v : 0;
      out.x = dz(gp.axes[0] || 0);
      out.y = dz(gp.axes[1] || 0);
      out.fire = out.fire || !!gp.buttons[0]?.pressed;
      out.shift = out.shift || !!gp.buttons[1]?.pressed || !!gp.buttons[5]?.pressed;
    }
    return out;
  }
}

// Ambient wind-blown sand: one Points cloud wrapped in a box around the player.
export class SandParticles {
  constructor(scene, count = 800) {
    this.size = new THREE.Vector3(60, 18, 60);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * this.size.x;
      pos[i * 3 + 1] = Math.random() * this.size.y;
      pos[i * 3 + 2] = (Math.random() - 0.5) * this.size.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.PointsMaterial({ color: 0xd8c08a, size: 0.07, transparent: true, opacity: 0.4, depthWrite: false });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.count = count;
    scene.add(this.points);
  }
  update(dt, center, windSpeed, opacity) {
    this.mat.opacity += (opacity - this.mat.opacity) * Math.min(1, dt * 2);
    const p = this.points.geometry.attributes.position.array;
    const hx = this.size.x / 2, hz = this.size.z / 2;
    for (let i = 0; i < this.count; i++) {
      const j = i * 3;
      const jitter = 0.5 + ((i * 2654435761) % 1000) / 1000;
      p[j] += windSpeed * jitter * dt;
      p[j + 1] += Math.sin(i + p[j] * 0.2) * 0.3 * dt;
      p[j + 2] += windSpeed * 0.3 * jitter * dt;
      // Wrap into the box centered on the player.
      let rx = p[j] - center.x, rz = p[j + 2] - center.z;
      if (rx > hx) rx -= this.size.x; else if (rx < -hx) rx += this.size.x;
      if (rz > hz) rz -= this.size.z; else if (rz < -hz) rz += this.size.z;
      p[j] = center.x + rx;
      p[j + 2] = center.z + rz;
      if (p[j + 1] > this.size.y) p[j + 1] -= this.size.y;
      if (p[j + 1] < 0) p[j + 1] += this.size.y;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// Pooled dust bursts at the hero's feet, fired on the footstep timer.
export class DustPuffs {
  constructor(scene, poolSize = 8) {
    this.pool = [];
    for (let i = 0; i < poolSize; i++) {
      const pos = new Float32Array(8 * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color: 0xcbb188, size: 0.09, transparent: true, opacity: 0, depthWrite: false });
      const pts = new THREE.Points(geo, mat);
      pts.visible = false;
      pts.frustumCulled = false;
      scene.add(pts);
      this.pool.push({ pts, life: 0 });
    }
  }
  spawn(pos) {
    const slot = this.pool.find(s => s.life <= 0);
    if (!slot) return;
    const arr = slot.pts.geometry.attributes.position.array;
    for (let i = 0; i < 8; i++) {
      arr[i * 3] = pos.x + (Math.random() - 0.5) * 0.4;
      arr[i * 3 + 1] = 0.05 + Math.random() * 0.15;
      arr[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.4;
    }
    slot.pts.geometry.attributes.position.needsUpdate = true;
    slot.life = 0.4;
    slot.pts.visible = true;
  }
  update(dt) {
    for (const s of this.pool) {
      if (s.life <= 0) continue;
      s.life -= dt;
      const arr = s.pts.geometry.attributes.position.array;
      for (let i = 0; i < 8; i++) arr[i * 3 + 1] += dt * 1.2;
      s.pts.geometry.attributes.position.needsUpdate = true;
      s.pts.material.opacity = Math.max(0, s.life / 0.4) * 0.6;
      if (s.life <= 0) s.pts.visible = false;
    }
  }
}
