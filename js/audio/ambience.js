// Night village ambience: looping insect chorus + distant crowd murmur beds
// (baked once with JS DSP, seamless loops), plus random events scheduled
// from tick(): frogs (อึ่งอ่าง / กบ), a gecko calling "tukkae", distant
// chatter, a child laughing, a dog barking far away.

import {
  makeBuffer, cachedBuffer, addModes, filtLoop, normalize, mulberry32, TAU, Shot, rnd, pick, clamp, holdAt,
} from './dsp.js';
import { babble, laughVoice } from './vocal.js';
import { SFX } from './sfx.js';
import { playBuffer } from './perc.js';

const RATE = 22050;

/** Seamless cricket / katydid chorus, stereo. */
function insectLoop(ctx) {
  return cachedBuffer(`amb|insects|${RATE}`, () =>
    makeBuffer(ctx, 2, 12, ([L, R], sr, N) => {
      const r = mulberry32(4242);
      const LEN = N / sr;
      const put = (i, v, pan) => {
        const k = ((i % N) + N) % N;
        L[k] += v * (1 - pan) * 0.5;
        R[k] += v * (1 + pan) * 0.5;
      };
      // chirping crickets: pulses (12-18 ms) in chirps, chirps periodic
      const crickets = 6;
      for (let c = 0; c < crickets; c++) {
        const f = 3900 + r() * 1500;
        const pan = (r() - 0.5) * 1.6;
        const amp = (0.25 + r() * 0.75) * (c < 2 ? 1 : 0.6);
        const period = LEN / Math.round(LEN / (0.35 + r() * 0.6));
        const pulses = 2 + Math.floor(r() * 4);
        const prate = 1 / (0.028 + r() * 0.02);
        const pl = Math.floor((0.011 + r() * 0.008) * sr);
        const off = r() * period;
        const w = (TAU * f) / sr;
        for (let t = off; t < LEN + off; t += period) {
          const chirpAmp = amp * (0.7 + r() * 0.3);
          for (let p = 0; p < pulses; p++) {
            const i0 = Math.floor((t + p / prate) * sr);
            const ph = r() * TAU;
            for (let n = 0; n < pl; n++) {
              const e = Math.sin((Math.PI * n) / pl);
              put(i0 + n, Math.sin(w * n + ph) * e * e * chirpAmp, pan);
            }
          }
        }
      }
      // trilling tree crickets: continuous pulse train with slow swell
      for (let c = 0; c < 2; c++) {
        const f = 2600 + r() * 900;
        const pan = c ? 0.6 : -0.5;
        const T = LEN / Math.round(LEN / (0.022 + r() * 0.01));
        const pl = Math.floor(T * 0.55 * sr);
        const w = (TAU * f) / sr;
        const swellK = Math.round(1 + r() * 2);
        for (let t = 0; t < LEN; t += T) {
          const i0 = Math.floor(t * sr);
          const sw = 0.5 + 0.5 * Math.sin((TAU * swellK * t) / LEN + c * 2);
          const a = 0.22 * sw * sw;
          for (let n = 0; n < pl; n++) {
            const e = Math.sin((Math.PI * n) / pl);
            put(i0 + n, Math.sin(w * (i0 + n)) * e * a, pan);
          }
        }
      }
      // distant katydid buzz: band-limited noise, phrases
      const buzz = new Float32Array(N);
      for (let i = 0; i < N; i++) buzz[i] = r() * 2 - 1;
      filtLoop(buzz, 'bandpass', 6400, 3, sr);
      filtLoop(buzz, 'bandpass', 6400, 3, sr);
      for (let i = 0; i < N; i++) {
        const t = i / sr;
        const phrase = Math.max(0, Math.sin((TAU * 3 * t) / LEN)) ** 2;
        const am = 0.5 + 0.5 * Math.sin(TAU * 62 * t);
        const v = buzz[i] * phrase * am * 0.5;
        L[i] += v * 0.7;
        R[i] += v * 0.3;
      }
      normalize([L, R], 0.8);
    }, RATE),
  );
}

/** Distant crowd murmur: many soft pseudo-voices through vowel resonances. */
function murmurLoop(ctx) {
  const rate = 11025;
  return cachedBuffer(`amb|murmur|${rate}`, () =>
    makeBuffer(ctx, 2, 10, ([L, R], sr, N) => {
      const r = mulberry32(777);
      const LEN = N / sr;
      const tmp = new Float32Array(Math.ceil(sr * 0.4));
      for (let v = 0; v < 14; v++) {
        const pan = (r() - 0.5) * 1.6;
        const f0 = 95 + r() * 170;
        const amp = 0.3 + r() * 0.7;
        let t = r() * LEN;
        const talk = LEN * (0.35 + r() * 0.4);
        for (let el = 0; el < talk; ) {
          // one syllable: glottal pulse train through a single moving formant
          const d = 0.09 + r() * 0.12;
          const F = 350 + r() * 650;
          const n = Math.floor(d * sr);
          tmp.fill(0, 0, n);
          let ph = 0;
          const f = f0 * (0.9 + r() * 0.25);
          for (let i = 0; i < n; i++) {
            ph += f / sr;
            if (ph >= 1) ph -= 1;
            const e = Math.sin((Math.PI * i) / n);
            tmp[i] = (ph < 0.5 ? ph : 1 - ph) * 4 - 1;
            tmp[i] *= e;
          }
          let y1 = 0, y2 = 0;
          const w = (TAU * F) / sr, rr = Math.exp((-Math.PI * 120) / sr);
          const a1 = -2 * rr * Math.cos(w), a2 = rr * rr;
          const i0 = Math.floor(t * sr);
          for (let i = 0; i < n; i++) {
            const y = tmp[i] * (1 - rr) - a1 * y1 - a2 * y2;
            y2 = y1;
            y1 = y;
            const k = (i0 + i) % N;
            L[k] += y * amp * (1 - pan) * 0.5;
            R[k] += y * amp * (1 + pan) * 0.5;
          }
          const gap = r() < 0.15 ? 0.3 + r() * 0.6 : 0.02 + r() * 0.05;
          t += d + gap;
          el += d + gap;
        }
      }
      // soft pink-ish bed so it never drops out
      for (const ch of [L, R]) {
        const n = new Float32Array(N);
        for (let i = 0; i < N; i++) n[i] = (r() * 2 - 1) * 0.015;
        filtLoop(n, 'lowpass', 600, 0.7, sr);
        for (let i = 0; i < N; i++) ch[i] += n[i];
        filtLoop(ch, 'lowpass', 1300, 0.6, sr);
      }
      normalize([L, R], 0.7);
    }, rate),
  );
}

/** frog croak variants: pulse trains through a resonance */
function frogBuf(ctx, v) {
  return cachedBuffer(`amb|frog${v}|${RATE}`, () =>
    makeBuffer(ctx, 1, 1.2, ([a], sr) => {
      const r = mulberry32(900 + v);
      if (v === 0) {
        // อึ่งอ่าง "oong-aang": low, two-part
        [[0, 0.32, 330, 70], [0.4, 0.38, 520, 80]].forEach(([t0, d, F, rate]) => {
          for (let t = 0; t < d; t += 1 / rate) {
            const e = Math.sin((Math.PI * t) / d);
            addModes(a, sr, [{ f: F * (1 + t * 0.4), a: e, d: 0.006, t: t0 + t }, { f: F * 2.1, a: e * 0.3, d: 0.003, t: t0 + t }]);
          }
        });
      } else {
        // tree frog "gaeb-gaeb": short raspy croaks
        const reps = 2 + v;
        for (let k = 0; k < reps; k++) {
          const t0 = k * (0.16 + r() * 0.04), d = 0.08;
          for (let t = 0; t < d; t += 1 / 140) {
            const e = Math.sin((Math.PI * t) / d);
            addModes(a, sr, [{ f: 1100 + v * 250, a: e, d: 0.0025, t: t0 + t }, { f: 2300 + v * 300, a: e * 0.4, d: 0.0015, t: t0 + t }]);
          }
        }
      }
      normalize([a], 0.8);
    }, RATE),
  );
}

/** ตุ๊กแก gecko: rattle, then "tuk-KAE" x N, fading */
function geckoBuf(ctx) {
  return cachedBuffer(`amb|gecko|${RATE}`, () =>
    makeBuffer(ctx, 1, 7.5, ([a], sr) => {
      const r = mulberry32(31337);
      for (let t = 0; t < 0.55; t += 1 / 32) {
        addModes(a, sr, [{ f: 700 + r() * 60, a: 0.35 * Math.sin((Math.PI * t) / 0.55), d: 0.004, t }]);
      }
      const reps = 6;
      for (let k = 0; k < reps; k++) {
        const t0 = 0.9 + k * 0.95, fade = 1 - k * 0.1;
        for (let t = 0; t < 0.06; t += 1 / 300) addModes(a, sr, [{ f: 820, a: 0.7 * fade, d: 0.003, t: t0 + t }]);
        for (let t = 0; t < 0.2; t += 1 / 290) {
          const e = Math.sin((Math.PI * t) / 0.2);
          addModes(a, sr, [{ f: 1150 - t * 900, a: fade * e, d: 0.0035, t: t0 + 0.11 + t }, { f: 2300 - t * 1500, a: fade * e * 0.35, d: 0.002, t: t0 + 0.11 + t }]);
        }
      }
      normalize([a], 0.8);
    }, RATE),
  );
}

const CHATTER = [
  'ไปไหนมา', 'กินข้าวหรือยัง', 'หนังจะเริ่มแล้ว', 'นั่งตรงนี้สิ', 'ใช่ ใช่', 'ฮ่า ฮ่า', 'สนุกจังเลย',
  'เอาน้ำไหม', 'คืนนี้เรื่องอะไร', 'ลูกไปไหน', 'หนาวนะ', 'มานี่มา', 'ดูสิ ดูสิ',
];

export class Ambience {
  constructor(eng) {
    this.eng = eng;
    this.ctx = eng.ctx;
    const ctx = this.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(eng.buses.amb);
    // distant sources: dull + extra reverb
    this.far = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    this.far.connect(lp);
    lp.connect(this.out);
    const fs = ctx.createGain();
    fs.gain.value = 0.5;
    lp.connect(fs);
    fs.connect(eng.revIn);
    this.on = false;
    this.level = 0.7;
    this.beds = [];
    this.next = {};
    this.r = Math.random;
  }
  start() {
    if (this.on) return;
    this.on = true;
    const ctx = this.ctx, t = ctx.currentTime + 0.05;
    const ins = new Shot(ctx, this.out, { vol: 0.5, t });
    const b1 = ins.buffer(insectLoop(ctx), { t, loop: true, offset: Math.random() * 12 });
    b1.connect(ins.out);
    const mur = new Shot(ctx, this.far, { vol: 0.9, t });
    const b2 = mur.buffer(murmurLoop(ctx), { t, loop: true, offset: Math.random() * 10 });
    b2.connect(mur.out);
    this.beds = [ins, mur];
    holdAt(this.out.gain, t);
    this.out.gain.linearRampToValueAtTime(this.level, t + 3);
    const now = ctx.currentTime;
    this.next = { frog: now + 1, gecko: now + rnd(Math.random, 12, 30), chat: now + 3, child: now + rnd(Math.random, 10, 25), dog: now + rnd(Math.random, 8, 30) };
  }
  stop(fade = 2) {
    if (!this.on) return;
    this.on = false;
    const t = this.ctx.currentTime;
    holdAt(this.out.gain, t);
    this.out.gain.setTargetAtTime(0, t, fade / 3);
    for (const b of this.beds) b.end(t + fade * 1.5);
    this.beds = [];
  }
  setLevel(x) {
    this.level = clamp(+x || 0, 0, 1);
    if (!this.on) return;
    const t = this.ctx.currentTime;
    holdAt(this.out.gain, t);
    this.out.gain.setTargetAtTime(this.level, t, 0.25);
  }
  tick(now) {
    if (!this.on) return;
    const r = Math.random, n = this.next, ctx = this.ctx, t = now + 0.05;
    if (now >= n.frog) {
      const v = Math.floor(r() * 3);
      const k = 1 + Math.floor(r() * 3);
      for (let i = 0; i < k; i++)
        playBuffer(ctx, i % 2 ? this.far : this.out, frogBuf(ctx, v), t + i * rnd(r, 0.5, 0.9), { vol: rnd(r, 0.12, 0.3), pan: rnd(r, -0.9, 0.9), rate: rnd(r, 0.9, 1.1) });
      n.frog = now + rnd(r, 0.6, 3.5);
    }
    if (now >= n.gecko) {
      playBuffer(ctx, this.out, geckoBuf(ctx), t, { vol: 0.3, pan: rnd(r, -0.8, 0.8), rate: rnd(r, 0.95, 1.05) });
      n.gecko = now + rnd(r, 35, 80);
    }
    if (now >= n.chat) {
      babble(ctx, this.far, t, pick(r, CHATTER), { voice: pick(r, ['male', 'female', 'old', 'male', 'female']), pan: rnd(r, -0.9, 0.9), vol: rnd(r, 0.12, 0.22), rate: rnd(r, 0.9, 1.15) });
      n.chat = now + rnd(r, 2.5, 8);
    }
    if (now >= n.child) {
      laughVoice(ctx, this.far, t, { f0: rnd(r, 300, 380), n: 5 + Math.floor(r() * 3), gap: 0.12, fs: 1.35, pan: rnd(r, -0.9, 0.9), vol: 0.22, vowel: r() < 0.5 ? 'i' : 'a' });
      n.child = now + rnd(r, 18, 45);
    }
    if (now >= n.dog) {
      const k = 1 + Math.floor(r() * 3), pan = rnd(r, -1, 1), p = rnd(r, 0.85, 1.15);
      for (let i = 0; i < k; i++) SFX['animal-dog']({ ctx, dest: this.far, rev: this.eng.revIn, t: t + i * rnd(r, 0.7, 1.1), pan, vol: 0.28, p });
      n.dog = now + rnd(r, 25, 60);
    }
  }
}
