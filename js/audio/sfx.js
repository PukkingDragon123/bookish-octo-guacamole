// One-shot sound effects. Each builder gets X = { ctx, dest, rev, t, pan, vol, p }
// (p = pitch multiplier) and returns the Shot(s) it created so the engine
// can count / steal voices.

import { Shot, curve, degHz, clamp, mulberry32 } from './dsp.js';
import { perc, pitched, playBuffer } from './perc.js';
import { vocalize, laughVoice } from './vocal.js';

// --- small generic builders -------------------------------------------------

/** noise through a filter with frequency + amplitude breakpoints */
function noiseSweep(X, { type = 'bandpass', f, Q = 1, a, vol = 1, at = 0, pan = X.pan, pre = null, send = 0 }) {
  const t = X.t + at;
  const s = new Shot(X.ctx, X.dest, { pan, vol: vol * X.vol, t });
  const n = s.noise(t);
  const fl = s.filter(type, f[0][1] * X.p, Q);
  const env = s.gain(0);
  let head = n;
  if (pre) {
    const pf = s.filter(pre[0], pre[1], pre[2] || 0.7);
    head.connect(pf);
    head = pf;
  }
  head.connect(fl);
  fl.connect(env);
  env.connect(s.out);
  curve(fl.frequency, t, f, X.p, true);
  curve(env.gain, t, a);
  if (send) s.send(X.rev, send);
  s.end(t + a[a.length - 1][0] + 0.02);
  return s;
}

/** oscillator with frequency + amplitude breakpoints */
function blip(X, { type = 'sine', f, a, vol = 1, at = 0, pan = X.pan, send = 0 }) {
  const t = X.t + at;
  const s = new Shot(X.ctx, X.dest, { pan, vol: vol * X.vol, t });
  const o = s.osc(type, f[0][1] * X.p, t);
  const env = s.gain(0);
  o.connect(env);
  env.connect(s.out);
  curve(o.frequency, t, f, X.p, true);
  curve(env.gain, t, a);
  if (send) s.send(X.rev, send);
  s.end(t + a[a.length - 1][0] + 0.02);
  return s;
}

function buf(X, b, { vol = 1, at = 0, rate = 1, pan = X.pan, send = 0 } = {}) {
  return playBuffer(X.ctx, X.dest, b, X.t + at, { vol: vol * X.vol, pan: clamp(pan, -1, 1), rate: rate * X.p, send, sendDest: X.rev });
}

function voc(X, spec, { at = 0, vol = 1, pan = X.pan } = {}) {
  return vocalize(X.ctx, X.dest, X.t + at, { ...spec, pitch: X.p * (spec.pitch || 1), vol: vol * X.vol, pan, sendDest: X.rev });
}

const jit = (x = 0.04) => 1 + (Math.random() - 0.5) * 2 * x;

// --- effects ----------------------------------------------------------------

export const SFX = {
  whoosh(X) {
    const f = jit(0.08);
    return [
      noiseSweep(X, { f: [[0, 350 * f], [0.12, 2000 * f], [0.34, 600 * f]], Q: 1.4, a: [[0, 0], [0.1, 1], [0.2, 0.5], [0.34, 0]], vol: 0.9 }),
      noiseSweep(X, { f: [[0, 800 * f], [0.12, 4400 * f], [0.3, 1300 * f]], Q: 3, a: [[0, 0], [0.11, 0.35], [0.28, 0]], vol: 0.8 }),
      blip(X, { f: [[0, 700 * f], [0.12, 1300 * f], [0.32, 650 * f]], a: [[0, 0], [0.12, 0.04], [0.3, 0]] }),
    ];
  },
  swish(X) {
    const f = jit(0.1);
    return noiseSweep(X, { f: [[0, 900 * f], [0.08, 3200 * f], [0.2, 1400 * f]], Q: 1.2, a: [[0, 0], [0.06, 0.8], [0.2, 0]], vol: 0.65 });
  },
  jump(X) {
    return [
      noiseSweep(X, { f: [[0, 400], [0.22, 2400]], Q: 1, a: [[0, 0], [0.05, 0.6], [0.22, 0]], vol: 0.7 }),
      blip(X, { type: 'triangle', f: [[0, 190], [0.14, 480]], a: [[0, 0], [0.02, 0.25], [0.14, 0]], vol: 0.8 }),
    ];
  },
  pop(X) {
    const f = jit(0.06);
    return [
      blip(X, { f: [[0, 380 * f], [0.03, 1050 * f], [0.1, 900 * f]], a: [[0, 0], [0.003, 1], [0.1, 0]], vol: 0.55 }),
      noiseSweep(X, { f: [[0, 2000], [0.01, 2000]], a: [[0, 0], [0.001, 0.4], [0.012, 0]], vol: 0.6 }),
    ];
  },
  pick(X) {
    return [
      blip(X, { type: 'triangle', f: [[0, 700], [0.035, 1250]], a: [[0, 0], [0.004, 0.8], [0.06, 0]], vol: 0.55 }),
      blip(X, { f: [[0, 1400], [0.05, 1600]], a: [[0, 0], [0.004, 0.5], [0.06, 0]], at: 0.045, vol: 0.55 }),
    ];
  },
  drop(X) {
    return [
      blip(X, { type: 'triangle', f: [[0, 800], [0.12, 260]], a: [[0, 0], [0.005, 0.7], [0.13, 0]], vol: 0.6 }),
      buf(X, perc(X.ctx, 'thud'), { at: 0.1, vol: 0.3 }),
    ];
  },
  flip(X) {
    const f = jit(0.08);
    return [
      noiseSweep(X, {
        f: [[0, 2200 * f], [0.09, 800 * f]], Q: 0.9,
        a: [[0, 0], [0.006, 1], [0.025, 0.1], [0.035, 0.65], [0.055, 0.08], [0.065, 0.35], [0.09, 0]], vol: 0.65,
      }),
      blip(X, { f: [[0, 220], [0.05, 130]], a: [[0, 0], [0.004, 0.3], [0.06, 0]], vol: 0.8 }),
    ];
  },
  step(X) {
    return buf(X, perc(X.ctx, 'step'), { vol: 0.4, rate: jit(0.05) });
  },
  hit(X) {
    return buf(X, perc(X.ctx, 'hit'), { vol: 1, rate: jit(0.04) });
  },
  block(X) {
    return [buf(X, perc(X.ctx, 'block'), { vol: 0.85, rate: jit(0.04) }), buf(X, perc(X.ctx, 'clang'), { vol: 0.12, rate: 1.4 })];
  },
  thud(X) {
    return buf(X, perc(X.ctx, 'thud'), { vol: 1, rate: jit(0.05) });
  },
  clang(X) {
    return buf(X, perc(X.ctx, 'clang'), { vol: 0.75, rate: jit(0.03), send: 0.25 });
  },
  gong(X) {
    return buf(X, pitched(X.ctx, 'gong', 82), { vol: 0.95, send: 0.35 });
  },
  ching(X) {
    return buf(X, perc(X.ctx, 'ching'), { vol: 0.5, send: 0.15 });
  },
  chap(X) {
    return buf(X, perc(X.ctx, 'chap'), { vol: 0.6 });
  },
  thap(X) {
    return buf(X, perc(X.ctx, 'thap-ting'), { vol: 0.8 });
  },
  curtain(X) {
    const s = new Shot(X.ctx, X.dest, { pan: X.pan, vol: 0.75 * X.vol, t: X.t });
    const t = X.t;
    const n = s.noise(t);
    const lp = s.filter('lowpass', 1500, 0.7);
    const bp = s.filter('bandpass', 400, 0.6);
    const env = s.gain(0);
    const mod = s.gain(1);
    n.connect(lp);
    lp.connect(bp);
    bp.connect(env);
    env.connect(mod);
    mod.connect(s.out);
    // rustle: slow random amplitude wobble
    const n2 = s.noise(t);
    const r = s.filter('lowpass', 22, 0.7);
    const rg = s.gain(6);
    n2.connect(r);
    r.connect(rg);
    rg.connect(mod.gain);
    curve(bp.frequency, t, [[0, 350], [0.5, 750], [1.2, 450], [1.5, 300]], X.p, true);
    curve(env.gain, t, [[0, 0], [0.25, 0.7], [0.5, 1], [1.0, 0.8], [1.5, 0]]);
    s.end(t + 1.55);
    const out = [s];
    const R = mulberry32((Math.random() * 1e9) | 0);
    for (let i = 0; i < 5; i++) out.push(buf(X, pitched(X.ctx, 'bell', 2600 + R() * 1400), { at: 0.1 + R() * 0.9, vol: 0.05 + R() * 0.05, rate: 1 }));
    return out;
  },
  'lamp-ignite'(X) {
    return [
      noiseSweep(X, { f: [[0, 2800], [0.1, 4200]], Q: 1.6, a: [[0, 0], [0.005, 0.9], [0.03, 0.35], [0.05, 0.85], [0.08, 0.25], [0.1, 0.6], [0.14, 0]], vol: 0.6 }),
      buf(X, perc(X.ctx, 'crackle'), { at: 0.05, vol: 0.25 }),
      noiseSweep(X, { type: 'lowpass', f: [[0, 250], [0.22, 1500], [0.8, 500]], Q: 0.8, a: [[0, 0], [0.17, 1], [0.42, 0.55], [1.0, 0]], at: 0.08, vol: 0.9 }),
      blip(X, { f: [[0, 90], [0.25, 55]], a: [[0, 0], [0.06, 0.45], [0.35, 0]], at: 0.1, vol: 0.9 }),
    ];
  },
  chime(X) {
    const ps = [10, 11, 12, 13, 15];
    return ps.map((p, i) => buf(X, pitched(X.ctx, 'bell', degHz(p)), { at: i * 0.075, vol: 0.45 + (i === 4 ? 0.1 : 0), pan: X.pan + (i - 2) * 0.12, send: 0.6 }));
  },
  sparkle(X) {
    const out = [];
    const ts = Array.from({ length: 8 }, () => Math.random() * 0.45).sort();
    ts.forEach((at, i) => {
      const p = 12 + Math.floor(Math.random() * 7);
      out.push(buf(X, pitched(X.ctx, 'bell', degHz(p)), { at, vol: 0.2 + Math.random() * 0.2, pan: X.pan + (Math.random() - 0.5) * 0.7, send: 0.45, rate: jit(0.004) }));
    });
    return out;
  },
  click(X) {
    return buf(X, perc(X.ctx, 'click'), { vol: 0.45 });
  },
  hover(X) {
    return buf(X, perc(X.ctx, 'hover'), { vol: 0.13 });
  },
  buzz(X) {
    const t = X.t, s = new Shot(X.ctx, X.dest, { pan: X.pan, vol: 0.3 * X.vol, t });
    const bp = s.filter('bandpass', 1400, 0.8);
    const hp = s.filter('highpass', 400, 0.7);
    const env = s.gain(0);
    const f0 = 255 * X.p * jit(0.05);
    for (const m of [1, 1.013]) {
      const o = s.osc('sawtooth', f0 * m, t);
      o.frequency.setValueAtTime(f0 * m, t);
      for (let k = 1; k <= 14; k++) o.frequency.linearRampToValueAtTime(f0 * m * (1 + (Math.random() - 0.5) * 0.18), t + k * 0.065);
      const g = s.gain(0.5);
      o.connect(g);
      g.connect(bp);
    }
    bp.connect(hp);
    hp.connect(env);
    env.connect(s.out);
    curve(env.gain, t, [[0, 0], [0.15, 0.6], [0.45, 1], [0.7, 0.5], [0.92, 0]]);
    if (s.pan.pan) curve(s.pan.pan, t, [[0, clamp(X.pan - 0.3, -1, 1)], [0.92, clamp(X.pan + 0.3, -1, 1)]]);
    s.end(t + 0.95);
    return s;
  },
  splash(X) {
    const out = [
      noiseSweep(X, { f: [[0, 2500], [0.25, 900], [0.6, 500]], Q: 0.8, a: [[0, 0], [0.01, 1], [0.12, 0.5], [0.6, 0]], vol: 0.9 }),
      blip(X, { f: [[0, 180], [0.12, 70]], a: [[0, 0], [0.01, 0.5], [0.15, 0]], vol: 0.9 }),
    ];
    for (let i = 0; i < 9; i++) {
      const f = 700 + Math.random() * 1500;
      out.push(blip(X, { f: [[0, f], [0.03, f * 1.35]], a: [[0, 0], [0.003, 0.15 + Math.random() * 0.2], [0.035, 0]], at: 0.05 + Math.random() * 0.6, pan: X.pan + (Math.random() - 0.5) * 0.5 }));
    }
    return out;
  },
  'fire-crackle'(X) {
    return buf(X, perc(X.ctx, 'crackle'), { vol: 0.7, rate: jit(0.05) });
  },
  magic(X) {
    const out = [buf(X, pitched(X.ctx, 'khong', degHz(-5)), { vol: 0.55, send: 0.3 })];
    for (let i = 0; i <= 10; i++) {
      out.push(buf(X, pitched(X.ctx, 'bell', degHz(5 + i)), { at: i * 0.055, vol: 0.22 + i * 0.022, pan: X.pan - 0.4 + i * 0.08, send: 0.6 }));
    }
    [15, 17, 20].forEach((p) => out.push(buf(X, pitched(X.ctx, 'bell', degHz(p)), { at: 0.66, vol: 0.35, send: 0.7 })));
    out.push(noiseSweep(X, { f: [[0, 500], [0.7, 6000]], Q: 2, a: [[0, 0], [0.5, 0.3], [0.8, 0]], vol: 0.8, send: 0.4 }));
    return out;
  },
  laugh(X) {
    const f0s = [110, 130, 150, 190, 220, 250, 280];
    return f0s.map((f0) =>
      laughVoice(X.ctx, X.dest, X.t + Math.random() * 0.25, {
        f0: f0 * X.p * jit(0.06), n: 4 + Math.floor(Math.random() * 4), gap: 0.13 + Math.random() * 0.05,
        vowel: Math.random() < 0.6 ? 'a' : 'e', pan: clamp(X.pan + (Math.random() - 0.5) * 1.3, -1, 1),
        vol: 0.33 * X.vol, fs: f0 > 180 ? 1.18 : 1.0, sendDest: X.rev, send: 0.15,
      }),
    );
  },
  cheer(X) {
    const out = [buf(X, perc(X.ctx, 'applause'), { vol: 0.55, rate: 1 })];
    for (let i = 0; i < 4; i++) {
      const f = (200 + Math.random() * 130) * X.p;
      out.push(voc(X, {
        fs: f > 250 ? 1.18 : 1.0, noise: 0.15,
        f: [[0, f], [0.3, f * 1.25], [1.0, f * 1.1]], v: [[0, 'e'], [0.3, 'a'], [1, 'o']],
        a: [[0, 0], [0.1, 0.6], [0.7, 0.5], [1.1, 0]], pitch: 1 / X.p,
      }, { at: Math.random() * 0.3, vol: 0.28, pan: clamp(X.pan + (Math.random() - 0.5) * 1.2, -1, 1) }));
    }
    out.push(blip(X, { f: [[0, 1900], [0.15, 2500], [0.35, 2300], [0.5, 2600]], a: [[0, 0], [0.05, 0.1], [0.45, 0.08], [0.55, 0]], at: 0.2 + Math.random() * 0.3 }));
    return out;
  },
  gasp(X) {
    const out = [];
    for (let i = 0; i < 6; i++) {
      const f = 150 + Math.random() * 150;
      out.push(voc(X, {
        fs: f > 220 ? 1.18 : 1, noise: 0.9,
        f: [[0, f], [0.3, f * 1.3]], v: [[0, 'a'], [0.15, 'a'], [0.5, 'o']],
        a: [[0, 0], [0.06, 0.55], [0.25, 0.35], [0.6, 0]], n: [[0, 0.9], [0.3, 0.5], [0.6, 0.2]],
      }, { at: Math.random() * 0.08, vol: 0.4, pan: clamp(X.pan + (Math.random() - 0.5) * 1.2, -1, 1) }));
    }
    return out;
  },
  roar(X) {
    return voc(X, {
      src: 'sawtooth', sub: 0.8, drive: 0.9, rough: { rate: 31, depth: 0.7 }, noise: 0.3, fs: 0.7, send: 0.35,
      f: [[0, 70], [0.25, 98], [0.9, 86], [1.6, 52]], v: [[0, 'o'], [0.3, 'a'], [1.1, 'a'], [1.6, 'u']],
      a: [[0, 0], [0.12, 0.8], [0.4, 1], [1.2, 0.8], [1.65, 0]], n: [[0, 0.3], [0.5, 0.2], [1.6, 0.4]],
    }, { vol: 0.95 });
  },
  ghost(X) {
    return voc(X, {
      src: 'sine', noise: 0.35, fs: 1.0, vib: { rate: 4.3, depth: 70 }, chorus: 14, send: 0.8,
      f: [[0, 380], [0.6, 540], [1.2, 470], [1.9, 330]], v: [[0, 'u'], [0.8, 'o'], [1.9, 'u']],
      a: [[0, 0], [0.5, 0.7], [1.3, 0.6], [2.0, 0]],
    }, { vol: 0.9 });
  },
  hiss(X) {
    return noiseSweep(X, { f: [[0, 5200], [0.8, 6800]], Q: 0.9, pre: ['highpass', 2800], a: [[0, 0], [0.06, 1], [0.55, 0.8], [0.85, 0]], vol: 0.55 });
  },

  // --- animals ------------------------------------------------------------
  'animal-buffalo'(X) {
    return voc(X, {
      fs: 0.8, drive: 0.35, rough: { rate: 42, depth: 0.3 }, noise: 0.08,
      f: [[0, 92], [0.3, 104], [1.0, 97], [1.45, 78]], v: [[0, 'm'], [0.18, 'o'], [0.55, 'a'], [1.2, 'U'], [1.45, 'u']],
      a: [[0, 0], [0.12, 0.45], [0.35, 1], [1.1, 0.85], [1.5, 0]],
    }, { vol: 0.9 });
  },
  'animal-ox'(X) {
    return voc(X, {
      fs: 0.9, drive: 0.25, rough: { rate: 36, depth: 0.2 }, noise: 0.06,
      f: [[0, 135], [0.25, 150], [0.8, 140], [1.1, 112]], v: [[0, 'm'], [0.15, 'u'], [0.5, 'o'], [1.1, 'u']],
      a: [[0, 0], [0.1, 0.5], [0.3, 1], [0.85, 0.8], [1.15, 0]],
    }, { vol: 0.85 });
  },
  'animal-elephant'(X) {
    return [
      voc(X, {
        fs: 1.35, drive: 0.9, rough: { rate: 55, depth: 0.35 }, noise: 0.15, Q: [4, 6, 8],
        f: [[0, 420], [0.12, 860], [0.45, 960], [0.85, 790], [1.15, 600]], v: [[0, 'E'], [0.3, 'a'], [1.15, 'E']],
        a: [[0, 0], [0.06, 0.9], [0.3, 1], [0.9, 0.8], [1.2, 0]],
      }, { vol: 0.7 }),
      blip(X, { f: [[0, 45], [0.6, 38]], a: [[0, 0], [0.1, 0.4], [0.6, 0]], vol: 0.8 }),
    ];
  },
  'animal-pig'(X) {
    return voc(X, {
      rough: { rate: 72, depth: 0.75 }, drive: 0.5, noise: 0.25,
      f: [[0, 170], [0.07, 250], [0.2, 150], [0.32, 160], [0.4, 240], [0.55, 140]],
      v: [[0, 'o'], [0.1, 'i'], [0.2, 'n'], [0.32, 'o'], [0.43, 'i'], [0.55, 'n']],
      a: [[0, 0], [0.03, 0.9], [0.15, 0.7], [0.21, 0], [0.32, 0], [0.35, 0.9], [0.48, 0.6], [0.56, 0]],
    }, { vol: 0.8 });
  },
  'animal-rooster'(X) {
    return voc(X, {
      fs: 1.45, drive: 0.75, rough: { rate: 95, depth: 0.45 }, noise: 0.12,
      f: [[0, 520], [0.15, 650], [0.2, 640], [0.24, 720], [0.38, 880], [0.43, 850], [0.47, 820], [0.6, 880], [0.66, 900], [0.8, 1020], [1.15, 960], [1.4, 720]],
      v: [[0, 'e'], [0.16, 'e'], [0.22, 'i'], [0.4, 'i'], [0.46, 'e'], [0.62, 'e'], [0.68, 'e'], [1.1, 'o'], [1.4, 'u']],
      a: [[0, 0], [0.03, 0.8], [0.15, 0.7], [0.19, 0.05], [0.23, 0.8], [0.38, 0.7], [0.43, 0.05], [0.47, 0.85], [0.6, 0.8], [0.645, 0.05], [0.69, 1], [1.2, 0.85], [1.42, 0]],
    }, { vol: 0.7 });
  },
  'animal-hen'(X) {
    const f = [], a = [], v = [];
    [0, 0.16, 0.3, 0.42].forEach((t0, i) => {
      const p = 430 + i * 20;
      f.push([t0, p], [t0 + 0.05, p * 1.1]);
      v.push([t0, 'o'], [t0 + 0.05, 'O']);
      a.push([t0, 0], [t0 + 0.01, 0.7], [t0 + 0.05, 0.4], [t0 + 0.065, 0]);
    });
    f.push([0.56, 550], [0.68, 720], [0.9, 480]);
    v.push([0.56, 'E'], [0.68, 'a'], [0.9, 'O']);
    a.push([0.56, 0], [0.58, 0.9], [0.8, 0.7], [0.92, 0]);
    return voc(X, { fs: 1.4, drive: 0.4, rough: { rate: 60, depth: 0.4 }, noise: 0.1, f, v, a }, { vol: 0.7 });
  },
  'animal-duck'(X) {
    const f = [], a = [], v = [];
    [0, 0.24].forEach((t0) => {
      f.push([t0, 300], [t0 + 0.04, 350], [t0 + 0.18, 250]);
      v.push([t0, 'E'], [t0 + 0.1, 'a']);
      a.push([t0, 0], [t0 + 0.02, 1], [t0 + 0.12, 0.7], [t0 + 0.19, 0]);
    });
    return voc(X, { src: 'square', fs: 1.2, drive: 0.6, rough: { rate: 44, depth: 0.6 }, Q: [10, 14, 16], noise: 0.05, f, v, a }, { vol: 0.7 });
  },
  'animal-dog'(X) {
    const f = [], a = [], v = [], n = [];
    [0, 0.26].forEach((t0) => {
      f.push([t0, 330], [t0 + 0.035, 430], [t0 + 0.15, 240]);
      v.push([t0, 'a'], [t0 + 0.12, 'u']);
      a.push([t0, 0], [t0 + 0.012, 1], [t0 + 0.07, 0.6], [t0 + 0.15, 0]);
      n.push([t0, 0.6], [t0 + 0.05, 0.25], [t0 + 0.15, 0.1]);
    });
    return voc(X, { fs: 1.1, drive: 0.5, rough: { rate: 28, depth: 0.25 }, noise: 0.1, f, v, a, n }, { vol: 0.8 });
  },
  'animal-cat'(X) {
    return voc(X, {
      fs: 1.55, vib: { rate: 6, depth: 22 }, noise: 0.05,
      f: [[0, 470], [0.22, 720], [0.5, 700], [0.8, 430]], v: [[0, 'i'], [0.12, 'e'], [0.3, 'a'], [0.6, 'o'], [0.8, 'u']],
      a: [[0, 0], [0.08, 0.8], [0.5, 0.9], [0.8, 0]],
    }, { vol: 0.6 });
  },
  'animal-horse'(X) {
    return [
      voc(X, {
        fs: 1.3, vib: { rate: 11, depth: 220 }, drive: 0.5, noise: 0.15,
        f: [[0, 850], [0.12, 1150], [0.7, 780], [1.3, 420]], v: [[0, 'i'], [0.3, 'e'], [0.9, 'a'], [1.3, 'a']],
        a: [[0, 0], [0.08, 0.9], [0.8, 0.7], [1.3, 0]],
      }, { vol: 0.6 }),
      noiseSweep(X, { type: 'lowpass', f: [[0, 900], [0.2, 500]], Q: 0.7, a: [[0, 0], [0.02, 0.6], [0.2, 0]], at: 1.35, vol: 0.6 }),
    ];
  },
  'animal-monkey'(X) {
    const f = [], a = [], v = [];
    [[0, 'u'], [0.11, 'u'], [0.24, 'i'], [0.34, 'i'], [0.44, 'i']].forEach(([t0, vw]) => {
      const lo = vw === 'u' ? 360 : 700, hi = vw === 'u' ? 460 : 950;
      f.push([t0, lo], [t0 + 0.07, hi]);
      v.push([t0, vw]);
      a.push([t0, 0], [t0 + 0.01, 0.9], [t0 + 0.06, 0.6], [t0 + 0.08, 0]);
    });
    return voc(X, { fs: 1.5, drive: 0.3, noise: 0.1, f, v, a }, { vol: 0.6 });
  },
};

export const SFX_NAMES = Object.keys(SFX);

// Loudness calibration (from the offline self-test: short-term levels of
// combat ~-16 dBFS, UI ticks ~-30..-40, animals/crowd ~-17..-20).
export const SFX_TRIM = {
  whoosh: 1.7, swish: 2, jump: 2.2, pop: 1.35, pick: 1.4, flip: 4.3, step: 3, hit: 2, block: 4, thud: 1.2,
  clang: 1.5, ching: 1.4, chap: 4, thap: 1.15, curtain: 1.2, 'lamp-ignite': 0.8, chime: 0.9, sparkle: 0.67,
  click: 5.6, hover: 9, buzz: 1.5, splash: 1.3, 'fire-crackle': 1.4, laugh: 1.65, cheer: 1.4, gasp: 1.25,
  roar: 2, ghost: 0.34, 'animal-buffalo': 0.9, 'animal-ox': 0.73, 'animal-elephant': 0.35, 'animal-pig': 0.9,
  'animal-rooster': 0.55, 'animal-duck': 0.8, 'animal-cat': 1.45, 'animal-horse': 0.5, 'animal-monkey': 0.62,
};
