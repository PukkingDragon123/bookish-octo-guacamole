// AudioEngine: the whole mix graph for one BaseAudioContext (realtime or
// offline). The `audio` singleton in audio.js wraps one of these.
//
//   music ─┐                       ┌─> reverb (procedural IR) ─┐
//   sfx   ─┼─> (bus gains) ──┬─────┘ sends                      │
//   amb   ─┤                 └──────────────> pre <─────────────┘
//   voice ─┘                                   │
//              pre -> compressor -> limiter -> soft clip -> master(vol/mute) -> out

import {
  clamp, degHz, makeIR, softClipCurve, holdAt, Shot, pinkBuffer, makeBuffer, cachedBuffer,
  mulberry32, wpick, TONIC,
} from './dsp.js';
import { Music, MOOD_NAMES } from './music.js';
import { Ambience } from './ambience.js';
import { SFX, SFX_NAMES } from './sfx.js';
import { perc, pitched, playBuffer, PERC_KINDS } from './perc.js';
import { leadNote, khaen } from './melodic.js';
import { babble } from './vocal.js';

const MAX_SHOTS = 56; // concurrent one-shot sfx / instrument graphs
const MAX_VOICES = 4; // concurrent speech babbles
const MIN_GAP = { hover: 0.04, step: 0.045, click: 0.03 }; // same-name retrigger guard

const mod = (a, n) => ((a % n) + n) % n;

// playable prop instruments. note = scale degree relative to the current home
export const INSTRUMENTS = {
  ranat: { base: 5, lo: -5, hi: 10 },
  'khong-wong': { base: 0, lo: -4, hi: 9 },
  klong: { alt: true },
  thap: {},
  mong: { alt: true },
  ching: { alt: true },
  khlui: { base: 5, lo: -3, hi: 8 },
  khaen: { base: 0, lo: -2, hi: 7 },
  saw: { base: 2, lo: -3, hi: 8 },
  pi: { base: 3, lo: -2, hi: 8 },
  jakhe: { base: -2, lo: -3, hi: 9 },
  krap: { alt: true },
};
export const INSTRUMENT_NAMES = Object.keys(INSTRUMENTS);
export { SFX_NAMES, MOOD_NAMES };

function flickerBuffer(ctx) {
  return cachedBuffer('flicker|8000', () =>
    makeBuffer(ctx, 1, 7, ([a], sr, n) => {
      const r = mulberry32(5150);
      let i = 0, v = 0;
      while (i < n) {
        const seg = Math.floor(sr * (0.05 + r() * 0.12));
        const target = r() < 0.08 ? -0.9 : (r() - 0.5) * 1.2;
        for (let k = 0; k < seg && i < n; k++, i++) {
          v += (target - v) * 0.004;
          a[i] = v;
        }
      }
      // close the loop smoothly
      const m = Math.floor(sr * 0.3);
      for (let k = 0; k < m; k++) a[n - m + k] = a[n - m + k] * (1 - k / m) + a[0] * (k / m);
    }, 8000),
  );
}

class LampHum {
  constructor(eng) {
    this.eng = eng;
    this.level = 0;
    this.shot = null;
    this.nextTick = 0;
  }
  set(level) {
    level = clamp(+level || 0, 0, 1);
    const ctx = this.eng.ctx, t = ctx.currentTime;
    if (level > 0 && !this.shot) this.build(t);
    this.level = level;
    if (!this.shot) return;
    holdAt(this.gain.gain, t);
    this.gain.gain.setTargetAtTime(0.32 * level * level, t, 0.25);
    if (level === 0) {
      const s = this.shot;
      this.shot = null;
      s.end(t + 1.6);
    }
  }
  build(t) {
    const ctx = this.eng.ctx;
    const s = (this.shot = new Shot(ctx, this.eng.buses.sfx, { t }));
    this.gain = s.gain(0);
    const src = s.buffer(pinkBuffer(ctx), { t, loop: true, offset: Math.random() * 4 });
    const bp = s.filter('bandpass', 780, 0.45);
    const lp = s.filter('lowpass', 2800, 0.7);
    const low = s.filter('lowpass', 170, 0.7);
    const lowG = s.gain(0.9);
    const flick = s.gain(1);
    const mSrc = s.buffer(flickerBuffer(ctx), { t, loop: true, offset: Math.random() * 7 });
    const mg = s.gain(0.3);
    mSrc.connect(mg);
    mg.connect(flick.gain);
    src.connect(bp);
    bp.connect(lp);
    lp.connect(flick);
    src.connect(low);
    low.connect(lowG);
    lowG.connect(flick);
    flick.connect(this.gain);
    this.gain.connect(s.out);
    this.nextTick = t + 1;
  }
  tick(now) {
    if (!this.shot || this.level <= 0 || now < this.nextTick) return;
    // occasional wick sputter
    const e = this.eng;
    e.track(playBuffer(e.ctx, e.buses.sfx, perc(e.ctx, 'sputter'), now + 0.03, { vol: 0.06 * this.level, pan: (Math.random() - 0.5) * 0.3, rate: 0.8 + Math.random() * 0.4 }));
    this.nextTick = now + (0.4 + Math.random() * 3) / Math.max(0.2, this.level);
  }
}

export class AudioEngine {
  constructor(ctx) {
    this.ctx = ctx;
    const g = (v) => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    // master chain
    this.master = g(1);
    this.pre = g(1);
    const comp = (this.comp = ctx.createDynamicsCompressor());
    comp.threshold.value = -20;
    comp.knee.value = 10;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    this.post = g(0.8);
    const lim = (this.limiter = ctx.createDynamicsCompressor());
    lim.threshold.value = -4;
    lim.knee.value = 2;
    lim.ratio.value = 16;
    lim.attack.value = 0.0015;
    lim.release.value = 0.12;
    this.clip = ctx.createWaveShaper();
    this.clip.curve = softClipCurve(0.88);
    this.pre.connect(comp);
    comp.connect(this.post);
    this.post.connect(lim);
    lim.connect(this.clip);
    this.clip.connect(this.master);
    this.master.connect(ctx.destination);

    // reverb
    this.revIn = g(1);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeIR(ctx);
    const revLP = ctx.createBiquadFilter();
    revLP.type = 'lowpass';
    revLP.frequency.value = 5200;
    this.revOut = g(0.5);
    this.revIn.connect(this.reverb);
    this.reverb.connect(revLP);
    revLP.connect(this.revOut);
    this.revOut.connect(this.pre);

    // buses
    const levels = { music: 0.5, sfx: 0.95, amb: 0.55, voice: 0.9 };
    const sends = { music: 0.26, sfx: 0.12, amb: 0.4, voice: 0.1 };
    this.buses = {};
    this.busSends = {};
    for (const k of Object.keys(levels)) {
      const b = (this.buses[k] = g(levels[k]));
      b.connect(this.pre);
      const sg = (this.busSends[k] = g(sends[k]));
      b.connect(sg);
      sg.connect(this.revIn);
    }

    this.music = new Music(this);
    this.ambience = new Ambience(this);
    this.lamp = new LampHum(this);
    this.active = new Set();
    this.voices = new Set();
    this.lastSfx = new Map();
    this.instLast = {};
  }

  get now() {
    return this.ctx.currentTime;
  }

  /** register shots for polyphony limiting + cleanup */
  track(shots, set = this.active, max = MAX_SHOTS) {
    if (!shots) return;
    const list = Array.isArray(shots) ? shots : [shots];
    for (const s of list) {
      if (!s || s.done) continue;
      set.add(s);
      const prev = s.onDone;
      s.onDone = (x) => {
        set.delete(x);
        if (prev) prev(x);
      };
    }
    while (set.size > max) {
      const oldest = set.values().next().value;
      set.delete(oldest);
      oldest.kill(this.ctx.currentTime);
    }
  }

  sfx(name, { pan = 0, vol = 1, pitch = 1 } = {}) {
    const fn = SFX[name];
    if (!fn) return;
    const now = this.ctx.currentTime;
    const last = this.lastSfx.get(name);
    if (last != null && now - last < (MIN_GAP[name] ?? 0.02)) return;
    this.lastSfx.set(name, now);
    const X = {
      ctx: this.ctx, dest: this.buses.sfx, rev: this.revIn, t: now + 0.005,
      pan: clamp(+pan || 0, -1, 1), vol: clamp(vol == null ? 1 : +vol, 0, 2), p: clamp(+pitch || 1, 0.25, 4),
    };
    this.track(fn(X));
  }

  /** melodic context from the running music (so prop instruments fit in) */
  scale() {
    return this.music.scale;
  }

  instrument(name, { note, pan = 0, vol = 1 } = {}) {
    const def = INSTRUMENTS[name];
    if (!def) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.005;
    const dest = this.buses.sfx;
    vol = clamp(vol == null ? 1 : +vol, 0, 2);
    pan = clamp(+pan || 0, -1, 1);
    // choose the note: given, or a melodic random walk from the last one
    let n;
    const last = this.instLast[name];
    if (Number.isFinite(+note) && note !== null && note !== undefined) n = Math.round(+note);
    else if (def.alt) n = last == null ? 0 : last + 1;
    else if (last == null) n = Math.floor(Math.random() * 5);
    else {
      n = last + wpick(Math.random, [[-2, 0.12], [-1, 0.3], [1, 0.3], [2, 0.15], [0, 0.05], [3, 0.04], [-3, 0.04]]);
      if (def.hi != null && n > def.hi) n = def.hi - 1;
      if (def.lo != null && n < def.lo) n = def.lo + 1;
    }
    this.instLast[name] = n;
    const { home, tonic } = this.scale();
    const hz = (k) => degHz(home + (def.base || 0) + k, 0, tonic);
    const shot = (buf, v, o = {}) => playBuffer(ctx, dest, buf, t, { vol: v * vol, pan, sendDest: this.revIn, ...o });
    let s;
    switch (name) {
      case 'ranat': s = shot(pitched(ctx, 'ranat', hz(n)), 0.6); break;
      case 'khong-wong': s = shot(pitched(ctx, 'khong', hz(n)), 0.62, { send: 0.12 }); break;
      case 'jakhe': s = shot(pitched(ctx, 'jakhe', hz(n)), 0.6); break;
      case 'klong': s = shot(perc(ctx, mod(n, 2) ? 'klong-lo' : 'klong-hi'), 0.75); break;
      case 'thap': s = shot(perc(ctx, ['thap-tong', 'thap-ting', 'thap-tuk'][mod(n, 3)]), 0.85); break;
      case 'ching': s = shot(perc(ctx, mod(n, 2) ? 'chap' : 'ching'), 0.5, { send: 0.12 }); break;
      case 'krap': s = shot(perc(ctx, 'krap'), 0.7, { rate: 1 + mod(n, 3) * 0.07 }); break;
      case 'mong': s = shot(pitched(ctx, 'mong', degHz(mod(n, 2) ? -7 : -5, 0, tonic)), 0.75, { send: 0.15 }); break;
      case 'pi': s = leadNote(ctx, dest, 'pi', t, hz(n), 0.42, { vol: vol * 0.9, pan, scoop: 0.95 }); break;
      case 'saw': s = leadNote(ctx, dest, 'saw', t, hz(n), 0.6, { vol: vol * 1.0, pan, scoop: 0.97 }); break;
      case 'khlui': s = leadNote(ctx, dest, 'khlui', t, hz(n), 0.55, { vol: vol * 0.9, pan }); break;
      case 'khaen': {
        const fr = [hz(n), hz(n - 2), hz(-5 - (def.base || 0)), hz(5 - (def.base || 0))];
        s = khaen(ctx, dest, t, fr, 0.7, { vol: vol * 0.8, pan });
        break;
      }
    }
    this.track(s);
  }

  voice(text, { voice = 'male', pan = 0, rate = 1 } = {}) {
    const [shot, dur] = babble(this.ctx, this.buses.voice, this.ctx.currentTime + 0.01, String(text ?? ''), {
      voice, pan: clamp(+pan || 0, -1, 1), rate: +rate || 1, sendDest: this.revIn,
    });
    if (shot) this.track(shot, this.voices, MAX_VOICES);
    return dur;
  }

  lampHum(level) {
    this.lamp.set(level);
  }

  /** schedule everything up to now + horizon (call every frame) */
  update(horizon = 0.3) {
    const now = this.ctx.currentTime;
    this.music.tick(now + horizon);
    this.ambience.tick(now);
    this.lamp.tick(now);
  }

  /** bake common buffers in small slices so first plays don't hitch */
  prewarm(sliceMs = 5) {
    const ctx = this.ctx;
    const jobs = [];
    for (const k of PERC_KINDS) for (let v = 0; v < 4; v++) jobs.push(() => perc(ctx, k, v));
    for (const p of [-10, -7, -6, -5, -3]) jobs.push(() => pitched(ctx, 'mong', degHz(p)));
    jobs.push(() => pitched(ctx, 'gong', 82), () => pitched(ctx, 'gong', degHz(-10)));
    for (let p = -3; p <= 16; p++) jobs.push(() => pitched(ctx, 'ranat', degHz(p)));
    for (let p = -8; p <= 12; p++) jobs.push(() => pitched(ctx, 'khong', degHz(p)));
    for (let p = 3; p <= 18; p++) jobs.push(() => pitched(ctx, 'bell', degHz(p)));
    for (let p = -6; p <= 9; p++) jobs.push(() => pitched(ctx, 'jakhe', degHz(p)));
    const run = () => {
      const t0 = performance.now();
      try {
        while (jobs.length && performance.now() - t0 < sliceMs) jobs.shift()();
      } catch (e) {
        console.warn('[audio] prewarm', e);
        return;
      }
      if (jobs.length) setTimeout(run, 24);
    };
    setTimeout(run, 150);
  }

  stats() {
    return { shots: this.active.size, voices: this.voices.size, tracks: this.music.tracks.length, mood: this.music.mood };
  }
}

export { TONIC };
