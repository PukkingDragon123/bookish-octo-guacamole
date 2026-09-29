// Struck, plucked and percussive sounds baked into AudioBuffers with JS DSP
// (modal partials / pitched membranes / noise), cached, then played through
// a tiny gain+pan graph. Cheap at playback: 1 source + 2 nodes per hit.
//
//   ทับ thap strokes     'thap-tuk' (sharp damped), 'thap-ting' (open ring),
//                        'thap-tong' (deep bass), 'thap-pa' (muted slap)
//   กลองตุ๊ก klong tuk     'klong-hi', 'klong-lo'
//   ฉิ่ง ching             'ching' (open), 'chap' (damped)
//   กรับ krap              'krap'
//   pitched              mong(f), gong(f), khong(f), ranat(f), jakhe(f), bell(f)
//   foley                clang, hit, block, thud, step, click, hover, crackle, applause

import {
  makeBuffer, cachedBuffer, addModes, addMembrane, addNoise, addPluck,
  normalize, fadeEdges, mulberry32, clamp, Shot,
} from './dsp.js';

const LO = 24000; // render rate for low / mid sounds (saves memory)

// name -> { dur, rate?, variants, peak, render(ch, sr, rng, variantIndex) }
const DEFS = {
  'thap-tuk': {
    dur: 0.3, variants: 4, peak: 0.9,
    render([a], sr, r) {
      const j = 1 + (r() - 0.5) * 0.05;
      addMembrane(a, sr, { f0: 640 * j, f1: 470 * j, tp: 0.004, d: 0.045, modes: [[1.47, 0.35, 0.6], [2.08, 0.2, 0.4]] });
      addNoise(a, sr, { rng: r, a: 0.9, d: 0.0035, type: 'bandpass', f: 3300, Q: 0.8 });
      addNoise(a, sr, { rng: r, a: 0.35, d: 0.01, type: 'bandpass', f: 1250, Q: 1.4 });
    },
  },
  'thap-ting': {
    dur: 1.0, variants: 3, peak: 0.85,
    render([a], sr, r) {
      const j = 1 + (r() - 0.5) * 0.03;
      addMembrane(a, sr, { f0: 400 * j, f1: 352 * j, tp: 0.014, d: 0.22, modes: [[1.51, 0.2, 0.45], [1.99, 0.1, 0.35], [2.44, 0.05, 0.25]] });
      addNoise(a, sr, { rng: r, a: 0.55, d: 0.004, type: 'bandpass', f: 2100, Q: 1 });
    },
  },
  'thap-tong': {
    dur: 1.2, rate: LO, variants: 3, peak: 0.9,
    render([a], sr, r) {
      const j = 1 + (r() - 0.5) * 0.04;
      addMembrane(a, sr, { f0: 178 * j, f1: 106 * j, tp: 0.035, d: 0.3, modes: [[1.58, 0.2, 0.35], [2.3, 0.08, 0.25]] });
      addNoise(a, sr, { rng: r, a: 0.35, d: 0.012, type: 'lowpass', f: 900, Q: 0.7 });
    },
  },
  'thap-pa': {
    dur: 0.25, variants: 3, peak: 0.8,
    render([a], sr, r) {
      addMembrane(a, sr, { f0: 300, f1: 232, tp: 0.01, d: 0.04, modes: [[1.55, 0.3, 0.5]] });
      addNoise(a, sr, { rng: r, a: 0.8, d: 0.012, type: 'bandpass', f: 1500, Q: 0.9 });
    },
  },
  'klong-hi': {
    dur: 0.35, variants: 3, peak: 0.85,
    render([a], sr, r) {
      const j = 1 + (r() - 0.5) * 0.04;
      addMembrane(a, sr, { f0: 570 * j, f1: 478 * j, tp: 0.008, d: 0.065, modes: [[1.6, 0.3, 0.5], [2.2, 0.12, 0.35]] });
      addNoise(a, sr, { rng: r, a: 1, d: 0.0028, type: 'bandpass', f: 4500, Q: 0.7 });
      addNoise(a, sr, { rng: r, a: 0.3, d: 0.014, type: 'bandpass', f: 1800, Q: 1 });
    },
  },
  'klong-lo': {
    dur: 0.4, variants: 3, peak: 0.85,
    render([a], sr, r) {
      const j = 1 + (r() - 0.5) * 0.04;
      addMembrane(a, sr, { f0: 400 * j, f1: 322 * j, tp: 0.01, d: 0.085, modes: [[1.6, 0.28, 0.5]] });
      addNoise(a, sr, { rng: r, a: 0.9, d: 0.003, type: 'bandpass', f: 3800, Q: 0.7 });
      addNoise(a, sr, { rng: r, a: 0.3, d: 0.016, type: 'bandpass', f: 1400, Q: 1 });
    },
  },
  krap: {
    dur: 0.16, variants: 3, peak: 0.85,
    render([a], sr, r) {
      const j = 1 + (r() - 0.5) * 0.08;
      addNoise(a, sr, { rng: r, a: 1, d: 0.005, type: 'bandpass', f: 2400 * j, Q: 1.8 });
      addModes(a, sr, [{ f: 1250 * j, a: 0.45, d: 0.018 }, { f: 2950 * j, a: 0.28, d: 0.01 }]);
      addNoise(a, sr, { rng: r, t: 0.011, a: 0.4, d: 0.004, type: 'bandpass', f: 2700 * j, Q: 1.5 });
    },
  },
  ching: {
    dur: 2.2, variants: 3, peak: 0.8,
    render([a], sr, r) {
      addModes(a, sr, chingPartials(r, 1));
      addNoise(a, sr, { rng: r, a: 0.5, d: 0.005, type: 'bandpass', f: 7000, Q: 0.6 });
      addNoise(a, sr, { rng: r, a: 0.06, d: 0.09, type: 'bandpass', f: 4200, Q: 2 });
    },
  },
  chap: {
    dur: 0.35, variants: 3, peak: 0.8,
    render([a], sr, r) {
      addModes(a, sr, chingPartials(r, 0.05));
      addNoise(a, sr, { rng: r, a: 0.9, d: 0.028, type: 'bandpass', f: 3800, Q: 0.9 });
      addNoise(a, sr, { rng: r, a: 0.4, d: 0.004, type: 'bandpass', f: 7500, Q: 0.7 });
    },
  },
  clang: {
    dur: 2.0, variants: 4, peak: 0.9,
    render([a], sr, r) {
      const f = 560 + r() * 220;
      const rat = [1, 2.42, 3.87, 5.31, 6.83, 8.96, 11.4];
      const amp = [0.8, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
      const dec = [0.9, 0.6, 0.45, 0.35, 0.28, 0.2, 0.15];
      const P = [];
      rat.forEach((k, i) => {
        const jf = 1 + (r() - 0.5) * 0.04;
        P.push({ f: f * k * jf, a: amp[i], d: dec[i] * (0.8 + r() * 0.4), ph: r() * 6 });
        if (i < 3) P.push({ f: f * k * jf * 1.007, a: amp[i] * 0.5, d: dec[i], ph: r() * 6 });
      });
      addModes(a, sr, P);
      addNoise(a, sr, { rng: r, a: 1, d: 0.007, type: 'bandpass', f: 5000, Q: 0.5 });
      addNoise(a, sr, { rng: r, a: 0.3, d: 0.03, type: 'bandpass', f: 2500, Q: 1 });
    },
  },
  hit: {
    dur: 0.4, variants: 4, peak: 0.9,
    render([a], sr, r) {
      const j = 1 + (r() - 0.5) * 0.15;
      addMembrane(a, sr, { f0: 190 * j, f1: 72 * j, tp: 0.018, d: 0.08, modes: [[1.6, 0.25, 0.4]] });
      addNoise(a, sr, { rng: r, a: 0.8, d: 0.012, type: 'lowpass', f: 1400, Q: 0.7 });
      addNoise(a, sr, { rng: r, a: 0.6, d: 0.006, type: 'bandpass', f: 900 * j, Q: 1.2 });
    },
  },
  block: {
    dur: 0.3, variants: 3, peak: 0.85,
    render([a], sr, r) {
      const j = 1 + (r() - 0.5) * 0.1;
      addMembrane(a, sr, { f0: 480 * j, f1: 330 * j, tp: 0.006, d: 0.035 });
      addNoise(a, sr, { rng: r, a: 0.8, d: 0.006, type: 'bandpass', f: 2000, Q: 1 });
      addModes(a, sr, [{ f: 3300 * j, a: 0.15, d: 0.03 }, { f: 1100 * j, a: 0.3, d: 0.02 }]);
    },
  },
  thud: {
    dur: 0.6, rate: LO, variants: 3, peak: 0.9,
    render([a], sr, r) {
      const j = 1 + (r() - 0.5) * 0.15;
      addMembrane(a, sr, { f0: 115 * j, f1: 48 * j, tp: 0.03, d: 0.1 });
      addNoise(a, sr, { rng: r, a: 0.6, d: 0.025, type: 'lowpass', f: 450, Q: 0.7 });
      addMembrane(a, sr, { t: 0.085 + r() * 0.03, f0: 120 * j, f1: 60 * j, tp: 0.02, d: 0.05, a: 0.22 });
      addNoise(a, sr, { rng: r, a: 0.25, d: 0.006, type: 'bandpass', f: 1200, Q: 1 });
    },
  },
  step: {
    dur: 0.15, variants: 4, peak: 0.8,
    render([a], sr, r) {
      const j = 1 + (r() - 0.5) * 0.2;
      addMembrane(a, sr, { f0: 150 * j, f1: 95 * j, tp: 0.01, d: 0.025, a: 0.6 });
      addNoise(a, sr, { rng: r, a: 0.6, d: 0.012, type: 'lowpass', f: 1000, Q: 0.7 });
      addNoise(a, sr, { rng: r, a: 0.1, d: 0.004, type: 'bandpass', f: 3000, Q: 1 });
    },
  },
  click: {
    dur: 0.1, variants: 3, peak: 0.8,
    render([a], sr, r) {
      const j = 1 + (r() - 0.5) * 0.06;
      addModes(a, sr, [{ f: 1850 * j, a: 1, d: 0.012 }, { f: 3150 * j, a: 0.4, d: 0.007 }, { f: 5200 * j, a: 0.15, d: 0.004 }]);
      addNoise(a, sr, { rng: r, a: 0.5, d: 0.0015, type: 'bandpass', f: 2500, Q: 1 });
    },
  },
  hover: {
    dur: 0.05, variants: 2, peak: 0.6,
    render([a], sr, r) {
      addModes(a, sr, [{ f: 3400 * (1 + r() * 0.03), a: 1, d: 0.006, att: 0.001 }, { f: 5100, a: 0.3, d: 0.003 }]);
    },
  },
  sputter: {
    dur: 0.06, variants: 3, peak: 0.7,
    render([a], sr, r) {
      addNoise(a, sr, { rng: r, a: 1, d: 0.0015, type: 'bandpass', f: 2500 + r() * 2000, Q: 0.8 });
      addNoise(a, sr, { rng: r, t: 0.008, a: 0.5, d: 0.002, type: 'lowpass', f: 1200, Q: 0.7 });
    },
  },
  crackle: {
    dur: 1.1, variants: 3, peak: 0.85,
    render([a], sr, r) {
      const n = 14 + Math.floor(r() * 8);
      for (let i = 0; i < n; i++) {
        const t = r() * 0.95;
        addNoise(a, sr, { rng: r, t, a: 0.2 + r() * r() * 1, d: 0.0012 + r() * 0.003, type: 'bandpass', f: 1500 + r() * 4500, Q: 0.8 });
        if (r() < 0.25) addMembrane(a, sr, { t, f0: 260 + r() * 200, f1: 150, tp: 0.004, d: 0.008, a: 0.3 });
      }
      addNoise(a, sr, { rng: r, a: 0.12, att: 0.15, d: 0.45, dur: 1.05, type: 'lowpass', f: 380, Q: 0.7 });
    },
  },
  applause: {
    dur: 2.8, chans: 2, rate: 32000, variants: 2, peak: 0.85,
    render(ch, sr, r) {
      for (const a of ch) {
        const n = 900;
        for (let i = 0; i < n; i++) {
          // density: fast swell, sustain, tail
          let t;
          do t = r() * 2.7; while (r() > (t < 0.25 ? t / 0.25 : t < 1.7 ? 1 : Math.max(0, 1 - (t - 1.7) / 1.0)));
          addNoise(a, sr, { rng: r, t, a: 0.3 + r() * 0.7, d: 0.003 + r() * 0.004, dur: 0.03, type: 'bandpass', f: 900 + r() * 1800, Q: 1.3 });
        }
      }
    },
  },
};

function chingPartials(r, dmul) {
  const f = 2750 * (1 + (r() - 0.5) * 0.02);
  const P = [
    [1, 0.7, 1.1], [1.006, 0.5, 1.0], [1.5, 0.45, 0.8], [1.9, 0.45, 0.7],
    [2.38, 0.3, 0.55], [2.87, 0.25, 0.45], [3.4, 0.18, 0.35], [4.03, 0.12, 0.25],
  ];
  return P.map(([k, a, d]) => ({ f: f * k, a, d: d * dmul, ph: r() * 6 }));
}

/** fixed percussion buffer (random variant unless given) */
export function perc(ctx, kind, variant) {
  const def = DEFS[kind];
  if (!def) return null;
  const v = variant == null ? Math.floor(Math.random() * def.variants) : variant % def.variants;
  const rate = def.rate || ctx.sampleRate;
  return cachedBuffer(`perc|${kind}|${v}|${rate}`, () =>
    makeBuffer(ctx, def.chans || 1, def.dur, (ch, sr) => {
      def.render(ch, sr, mulberry32(1000 + v * 7919 + kind.length * 31), v);
      normalize(ch, def.peak);
      for (const a of ch) fadeEdges(a, sr, 0.0003, 0.02);
    }, rate),
  );
}
export const PERC_KINDS = Object.keys(DEFS);

// ---------------------------------------------------------------------------
// Pitched idiophones / strings (cached per frequency)

const PITCHED = {
  // โหม่ง: pair of bossed gongs — slow beating fundamental, long hum
  mong: {
    dur: 5.5, rate: 16000, peak: 0.85,
    render([a], sr, f, r) {
      addModes(a, sr, [
        { f, a: 1, d: 1.25, att: 0.004 },
        { f: f * 1.0045, a: 0.55, d: 1.15, att: 0.004 },
        { f: f * 2.005, a: 0.3, d: 0.7 },
        { f: f * 2.72, a: 0.1, d: 0.4 },
        { f: f * 3.35, a: 0.08, d: 0.3 },
        { f: f * 4.1, a: 0.05, d: 0.2 },
        { f: f * 5.4, a: 0.03, d: 0.12 },
      ]);
      addMembrane(a, sr, { f0: f * 1.12, f1: f, tp: 0.03, d: 0.05, a: 0.3 });
      addNoise(a, sr, { rng: r, a: 0.25, d: 0.015, type: 'lowpass', f: 700, Q: 0.7 });
    },
  },
  // big gong: blooming upper partials
  gong: {
    dur: 7.5, rate: 16000, peak: 0.85,
    render([a], sr, f, r) {
      addModes(a, sr, [
        { f, a: 1, d: 2.0, att: 0.006 },
        { f: f * 1.0035, a: 0.6, d: 1.8, att: 0.006 },
        { f: f * 2.01, a: 0.45, d: 1.3 },
        { f: f * 2.03, a: 0.2, d: 1.2 },
        { f: f * 2.93, a: 0.22, d: 0.9, att: 0.09 },
        { f: f * 3.61, a: 0.18, d: 0.7, att: 0.15 },
        { f: f * 4.67, a: 0.12, d: 0.5, att: 0.2 },
        { f: f * 5.9, a: 0.08, d: 0.35, att: 0.1 },
        { f: f * 7.2, a: 0.05, d: 0.25 },
      ]);
      addMembrane(a, sr, { f0: f * 1.25, f1: f, tp: 0.04, d: 0.08, a: 0.35 });
      addNoise(a, sr, { rng: r, a: 0.3, d: 0.02, type: 'lowpass', f: 600, Q: 0.7 });
    },
  },
  // ฆ้องวง khong wong: small bossed gong kettles in a circle
  khong: {
    dur: 2.0, rate: LO, peak: 0.85,
    render([a], sr, f, r) {
      const ds = Math.pow(440 / f, 0.35);
      addModes(a, sr, [
        { f, a: 1, d: 0.55 * ds, att: 0.002 },
        { f: f * 1.004, a: 0.35, d: 0.5 * ds, att: 0.002 },
        { f: f * 2.03, a: 0.2, d: 0.25 * ds },
        { f: f * 2.76, a: 0.12, d: 0.16 * ds },
        { f: f * 3.9, a: 0.07, d: 0.1 * ds },
        { f: f * 5.1, a: 0.04, d: 0.07 * ds },
      ]);
      addNoise(a, sr, { rng: r, a: 0.2, d: 0.003, type: 'lowpass', f: 2500, Q: 0.7 });
    },
  },
  // ระนาด ranat: hardwood bars, partials ~1 : 3.9 : 9.2, hard mallet
  ranat: {
    dur: 1.1, rate: 32000, peak: 0.85,
    render([a], sr, f, r) {
      const d1 = clamp(0.28 * Math.sqrt(500 / f), 0.1, 0.45);
      addModes(a, sr, [
        { f, a: 1, d: d1, att: 0.0008 },
        { f: f * 3.93, a: 0.3, d: d1 * 0.3 },
        { f: f * 9.2, a: 0.1, d: d1 * 0.12 },
        { f: f * 1.003, a: 0.12, d: d1 * 1.6 }, // resonator box hum
      ]);
      addNoise(a, sr, { rng: r, a: 0.4, d: 0.002, type: 'bandpass', f: Math.min(f * 4, 9000), Q: 1 });
      addNoise(a, sr, { rng: r, a: 0.15, d: 0.006, type: 'lowpass', f: 1500, Q: 0.7 });
    },
  },
  // จะเข้ jakhe: plucked floor zither, buzzy raised frets
  jakhe: {
    dur: 1.7, rate: LO, peak: 0.85,
    render([a], sr, f, r) {
      addPluck(a, sr, { f, d: 0.9 * Math.pow(300 / f, 0.3), bright: 0.75, buzz: 0.6, rng: r });
      addNoise(a, sr, { rng: r, a: 0.25, d: 0.002, type: 'bandpass', f: 3000, Q: 1 });
    },
  },
  // small bright bell (chime / sparkle / heaven)
  bell: {
    dur: 2.6, rate: 32000, peak: 0.8,
    render([a], sr, f, r) {
      addModes(a, sr, [
        { f, a: 1, d: 1.1, att: 0.001 },
        { f: f * 1.0025, a: 0.5, d: 1.0, att: 0.001 },
        { f: f * 2.76, a: 0.3, d: 0.42 },
        { f: f * 5.4, a: 0.14, d: 0.22 },
        { f: f * 8.93, a: 0.06, d: 0.12 },
      ]);
      addNoise(a, sr, { rng: r, a: 0.08, d: 0.0012, type: 'bandpass', f: Math.min(f * 3, 12000), Q: 1 });
    },
  },
};

export function pitched(ctx, kind, f) {
  const def = PITCHED[kind];
  if (!def) return null;
  const fr = Math.round(f * 10) / 10;
  const rate = def.rate || ctx.sampleRate;
  return cachedBuffer(`pitch|${kind}|${fr}|${rate}`, () =>
    makeBuffer(ctx, 1, def.dur, (ch, sr) => {
      def.render(ch, sr, fr, mulberry32(Math.floor(fr * 100)));
      normalize(ch, def.peak);
      fadeEdges(ch[0], sr, 0.0003, 0.05);
    }, rate),
  );
}

/** play a baked buffer: source -> gain -> pan -> dest (+ optional reverb send) */
export function playBuffer(ctx, dest, buf, t, { vol = 1, pan = 0, rate = 1, send = 0, sendDest = null, dur = 0 } = {}) {
  if (!buf) return null;
  const s = new Shot(ctx, dest, { pan, vol, t });
  const src = s.buffer(buf, { t, rate });
  src.connect(s.out);
  if (send) s.send(sendDest, send);
  if (dur) {
    // choke (e.g. damped hand on a drum) after dur seconds
    s.out.gain.setValueAtTime(vol, t + dur);
    s.out.gain.setTargetAtTime(0, t + dur, 0.02);
    s.end(t + dur + 0.15);
  } else s.end();
  return s;
}
