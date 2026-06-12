import * as THREE from 'three';

// All sound is generated at runtime — no audio asset files.
// Nothing here touches AudioContext until init() runs (called from the Start
// button click, which satisfies browser autoplay policy).

function makeNoise(ctx, seconds = 1, brown = false) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let lastV = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { lastV = (lastV + 0.02 * w) / 1.02; d[i] = lastV * 3.5; }
    else d[i] = w;
  }
  return buf;
}

function makeNoiseBurst(ctx, dur = 0.09, decay = 50) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const t = i / ctx.sampleRate;
    // Crude one-pole lowpass keeps the burst soft (footstep-like).
    last = last * 0.7 + (Math.random() * 2 - 1) * 0.3;
    d[i] = last * Math.exp(-decay * t);
  }
  return buf;
}

function makeTone(ctx, { freqs = [440], dur = 0.2, type = 'sine', decay = 8, sweepTo = null }) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const phases = freqs.map(() => 0);
  for (let i = 0; i < len; i++) {
    const t = i / ctx.sampleRate;
    const env = decay > 0 ? Math.exp(-decay * t) : 1;
    let v = 0;
    for (let k = 0; k < freqs.length; k++) {
      const f = sweepTo !== null ? freqs[k] + (sweepTo - freqs[k]) * (t / dur) : freqs[k];
      phases[k] += (2 * Math.PI * f) / ctx.sampleRate;
      v += type === 'saw' ? (2 * ((phases[k] / (2 * Math.PI)) % 1) - 1) : Math.sin(phases[k]);
    }
    d[i] = (v / freqs.length) * env;
  }
  return buf;
}

export class GameAudio {
  constructor() { this.ready = false; }

  init(camera) {
    if (this.ready) return;
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    const ctx = this.listener.context;
    this.ctx = ctx;
    if (ctx.state === 'suspended') ctx.resume();

    // Route everything through a master lowpass so Now-shift can muffle the world.
    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 20000;
    this.listener.gain.disconnect();
    this.listener.gain.connect(this.lowpass);
    this.lowpass.connect(ctx.destination);

    this.buffers = {
      step: makeNoiseBurst(ctx, 0.09, 45),
      fire: makeTone(ctx, { freqs: [880], dur: 0.18, type: 'saw', decay: 14, sweepTo: 220 }),
      thud: makeTone(ctx, { freqs: [82], dur: 0.35, decay: 11 }),
      coin: makeTone(ctx, { freqs: [880, 1318], dur: 0.14, decay: 16 }),
      crystal: makeTone(ctx, { freqs: [660, 834, 990], dur: 0.6, decay: 5 }),
      wind: makeNoise(ctx, 3, true),
      whisper: makeNoise(ctx, 2),
      growl: makeTone(ctx, { freqs: [52, 55], dur: 1.4, type: 'saw', decay: 0 })
    };

    // Ambient wind bed.
    this.wind = new THREE.Audio(this.listener);
    this.wind.setBuffer(this.buffers.wind);
    this.wind.setLoop(true);
    this.wind.setVolume(0.12);
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 480;
    this.wind.setFilter(windFilter);
    this.wind.play();

    // Pool of positional whisper loops, reassigned to the nearest chasers.
    this.whispers = [];
    for (let i = 0; i < 3; i++) {
      const w = new THREE.PositionalAudio(this.listener);
      w.setBuffer(this.buffers.whisper);
      w.setLoop(true);
      w.setVolume(0.4);
      w.setRefDistance(3);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900 + i * 350;
      bp.Q.value = 4;
      w.setFilter(bp);
      this.whispers.push(w);
    }
    this._whisperTimer = 0;
    this.ready = true;
  }

  _shot(buffer, vol = 0.5, rate = 1) {
    if (!this.ready) return;
    const a = new THREE.Audio(this.listener);
    a.setBuffer(buffer);
    a.setVolume(vol);
    a.setPlaybackRate(rate * (0.94 + Math.random() * 0.12));
    a.play();
    a.source.onended = () => a.disconnect();
  }

  step(speedFactor = 1) { this._shot(this.buffers.step, 0.25, speedFactor); }
  fire() { this._shot(this.buffers.fire, 0.4); }
  thud(vol = 0.6) { this._shot(this.buffers.thud, vol); }
  coin() { this._shot(this.buffers.coin, 0.45); }
  crystal() { this._shot(this.buffers.crystal, 0.5); }

  attachPortalHum(mesh) {
    if (!this.ready || this._hum) return;
    const hum = new THREE.PositionalAudio(this.listener);
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    for (const f of [110, 111.5, 164.8]) {
      const o = this.ctx.createOscillator();
      o.frequency.value = f;
      o.connect(g);
      o.start();
    }
    hum.setNodeSource(g);
    hum.setRefDistance(4);
    hum.setVolume(0.6);
    mesh.add(hum);
    this._hum = hum;
  }

  attachGrowl(object3d) {
    if (!this.ready) return;
    const growl = new THREE.PositionalAudio(this.listener);
    growl.setBuffer(this.buffers.growl);
    growl.setLoop(true);
    growl.setVolume(0.7);
    growl.setRefDistance(6);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    growl.setFilter(lp);
    growl.play();
    object3d.add(growl);
    return growl;
  }

  updateWhispers(dt, enemyGroups, playerPos) {
    if (!this.ready) return;
    this._whisperTimer -= dt;
    if (this._whisperTimer > 0) return;
    this._whisperTimer = 1;
    const sorted = enemyGroups
      .map(g => ({ g, d: g.position.distanceTo(playerPos) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.whispers.length);
    this.whispers.forEach((w, i) => {
      w.parent?.remove(w);
      const slot = sorted[i];
      if (slot && slot.d < 30) {
        slot.g.add(w);
        if (!w.isPlaying) w.play();
      } else if (w.isPlaying) {
        w.stop();
      }
    });
  }

  setShift(on) {
    if (!this.ready) return;
    this.lowpass.frequency.setTargetAtTime(on ? 600 : 20000, this.ctx.currentTime, 0.1);
    this.wind.setPlaybackRate(on ? 0.5 : 1);
  }
}
