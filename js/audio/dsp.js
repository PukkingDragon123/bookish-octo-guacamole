// Shared DSP toolkit for the procedural audio engine.
//
// - Thai 7-tone equal temperament + pentatonic helpers
// - seeded RNG
// - JS-side renderers that bake struck / plucked sounds into AudioBuffers
//   (modal partials, pitched membranes, filtered noise bursts, Karplus-Strong)
// - procedural reverb impulse response
// - `Shot`: builds a one-shot node graph and disconnects it when it ends
//
// Every builder takes a BaseAudioContext so the same code renders in a
// realtime AudioContext and an OfflineAudioContext (self-test).

export const TAU = Math.PI * 2;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// Tuning: Thai 7-TET (every step = 1200/7 ≈ 171.4 cents). Melodies mostly move
// on a 5-note subset (steps 0 1 2 4 5 = the "pentatonic" of a thang/key).

export const TONIC = 293.66; // Hz of step 0 (roughly the pi's home note)
export const PENTA = [0, 1, 2, 4, 5];
const mod = (a, n) => ((a % n) + n) % n;

/** 7-TET step -> Hz */
export function stepHz(step, tonic = TONIC) {
  return tonic * Math.pow(2, step / 7);
}
/** pentatonic degree index (any integer, 5 per octave) -> 7-TET step */
export function pentaStep(p) {
  return PENTA[mod(p, 5)] + 7 * Math.floor(p / 5);
}
/** pentatonic degree -> Hz; `shift` transposes by 7-TET steps */
export function degHz(p, shift = 0, tonic = TONIC) {
  return stepHz(pentaStep(p) + shift, tonic);
}

// ---------------------------------------------------------------------------
// RNG

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}
export const rnd = (r, a, b) => a + (b - a) * r();
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
/** weighted choice: items [[value, weight], ...] */
export function wpick(r, items) {
  let tot = 0;
  for (const it of items) tot += it[1];
  let x = r() * tot;
  for (const it of items) if ((x -= it[1]) <= 0) return it[0];
  return items[items.length - 1][0];
}

// ---------------------------------------------------------------------------
// Buffer cache (AudioBuffers are not tied to a context; key by sample rate)

const bufCache = new Map();
export function cachedBuffer(key, make) {
  let b = bufCache.get(key);
  if (!b) {
    b = make();
    bufCache.set(key, b);
  }
  return b;
}
export function cacheSize() {
  let bytes = 0;
  for (const b of bufCache.values()) bytes += b.length * b.numberOfChannels * 4;
  return { count: bufCache.size, mb: +(bytes / 1048576).toFixed(1) };
}

/** Create a buffer and fill it with JS: fill(channels[], sampleRate, length) */
export function makeBuffer(ctx, chans, seconds, fill, rate = ctx.sampleRate) {
  const n = Math.max(2, Math.ceil(seconds * rate));
  const buf = ctx.createBuffer(chans, n, rate);
  const data = [];
  for (let c = 0; c < chans; c++) data.push(new Float32Array(n));
  fill(data, rate, n);
  for (let c = 0; c < chans; c++) {
    sanitize(data[c]);
    if (buf.copyToChannel) buf.copyToChannel(data[c], c);
    else buf.getChannelData(c).set(data[c]);
  }
  return buf;
}

function sanitize(a) {
  for (let i = 0; i < a.length; i++) if (!(a[i] === a[i]) || a[i] > 8 || a[i] < -8) a[i] = 0;
}

/** scale so the absolute peak equals `peak` */
export function normalize(chans, peak = 0.9) {
  let m = 0;
  for (const a of chans) for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
  if (m > 0) {
    const g = peak / m;
    for (const a of chans) for (let i = 0; i < a.length; i++) a[i] *= g;
  }
  return chans;
}

/** short linear fades at both ends to kill clicks */
export function fadeEdges(a, sr, inS = 0.0005, outS = 0.01) {
  const ni = Math.min(a.length, Math.floor(inS * sr));
  const no = Math.min(a.length, Math.floor(outS * sr));
  for (let i = 0; i < ni; i++) a[i] *= i / ni;
  for (let i = 0; i < no; i++) a[a.length - 1 - i] *= i / no;
}

// ---------------------------------------------------------------------------
// JS biquad (RBJ cookbook)

export function biquad(type, f, Q, sr, gainDb = 0) {
  f = clamp(f, 10, sr * 0.49);
  const w = (TAU * f) / sr, cs = Math.cos(w), sn = Math.sin(w);
  const al = sn / (2 * Q), A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lowpass': b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
    case 'highpass': b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
    case 'bandpass': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
    case 'peaking': b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; break;
    default: b0 = 1; b1 = 0; b2 = 0; a0 = 1; a1 = 0; a2 = 0;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
}
/** run a biquad over arr[from..to) in place (keeps state in q) */
export function runBiquad(q, arr, from = 0, to = arr.length) {
  let { x1, x2, y1, y2 } = q;
  const { b0, b1, b2, a1, a2 } = q;
  for (let i = from; i < to; i++) {
    const x = arr[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    arr[i] = y;
  }
  Object.assign(q, { x1, x2, y1, y2 });
  return arr;
}
export function filt(arr, type, f, Q, sr, gainDb) {
  return runBiquad(biquad(type, f, Q, sr, gainDb), arr);
}
/** filter a loop so its end flows into its start (warm the state on the tail first) */
export function filtLoop(arr, type, f, Q, sr) {
  const q = biquad(type, f, Q, sr);
  const tail = arr.slice(Math.max(0, arr.length - Math.floor(sr * 0.25)));
  runBiquad(q, tail);
  return runBiquad(q, arr);
}

// ---------------------------------------------------------------------------
// Additive / modal synthesis into Float32Arrays

/**
 * Sum exponentially decaying sinusoids.
 * partials: [{ f, a, d (tau seconds), t (onset s), att (attack s), ph }]
 */
export function addModes(out, sr, partials) {
  for (const p of partials) {
    if (!(p.f > 0) || p.f >= sr * 0.47 || !p.a) continue;
    const w = (TAU * p.f) / sr;
    const r = Math.exp(-1 / (Math.max(0.001, p.d) * sr));
    const cr = Math.cos(w) * r, si = Math.sin(w) * r;
    const ph = p.ph || 0;
    let re = p.a * Math.cos(ph), im = p.a * Math.sin(ph);
    const start = Math.floor((p.t || 0) * sr);
    const len = Math.min(out.length - start, Math.ceil(p.d * 7.5 * sr));
    const attN = Math.max(1, Math.floor((p.att || 0.0005) * sr));
    for (let n = 0; n < len; n++) {
      out[start + n] += n < attN ? (im * n) / attN : im;
      const nr = re * cr - im * si;
      im = re * si + im * cr;
      re = nr;
    }
  }
  return out;
}

/**
 * Pitched membrane (drum head): sine with an exponential pitch drop plus a
 * couple of inharmonic head modes. f(t) = f1 + (f0 - f1) e^(-t/tp)
 */
export function addMembrane(out, sr, { f0, f1, tp = 0.02, d = 0.2, a = 1, t = 0, modes = [], att = 0.0006 }) {
  const start = Math.floor(t * sr);
  const len = Math.min(out.length - start, Math.ceil(d * 7 * sr));
  let ph = 0;
  const attN = Math.max(1, Math.floor(att * sr));
  const kp = Math.exp(-1 / (tp * sr)), kd = Math.exp(-1 / (d * sr));
  const mk = modes.map((m) => Math.exp(-1 / (d * (m[2] || 0.5) * sr)));
  const me = modes.map(() => 1);
  let fe = 1, env = a;
  for (let n = 0; n < len; n++) {
    const f = f1 + (f0 - f1) * fe;
    ph += (TAU * f) / sr;
    let y = Math.sin(ph) * env;
    for (let k = 0; k < modes.length; k++) {
      y += Math.sin(ph * modes[k][0] + k) * modes[k][1] * a * me[k];
      me[k] *= mk[k];
    }
    out[start + n] += n < attN ? (y * n) / attN : y;
    fe *= kp;
    env *= kd;
  }
  return out;
}

/**
 * Filtered noise burst with exponential decay.
 * { t, a, d (tau), att, dur, type, f, Q, f2 (sweep target), rng }
 */
export function addNoise(out, sr, o) {
  const r = o.rng || Math.random;
  const start = Math.floor((o.t || 0) * sr);
  const len = Math.min(out.length - start, Math.ceil((o.dur || o.d * 7) * sr));
  if (len <= 0) return out;
  const tmp = new Float32Array(len);
  const attN = Math.max(1, Math.floor((o.att || 0.0004) * sr));
  const k = Math.exp(-1 / (Math.max(0.0005, o.d) * sr));
  let env = o.a;
  for (let n = 0; n < len; n++) {
    tmp[n] = (r() * 2 - 1) * env * (n < attN ? n / attN : 1);
    env *= k;
  }
  if (o.type) {
    if (o.f2) {
      // swept filter: update coefficients every 64 samples
      let q = biquad(o.type, o.f, o.Q || 1, sr);
      for (let i = 0; i < len; i += 64) {
        const f = o.f * Math.pow(o.f2 / o.f, i / len);
        const nq = biquad(o.type, f, o.Q || 1, sr);
        Object.assign(nq, { x1: q.x1, x2: q.x2, y1: q.y1, y2: q.y2 });
        q = nq;
        runBiquad(q, tmp, i, Math.min(len, i + 64));
      }
    } else {
      runBiquad(biquad(o.type, o.f, o.Q || 1, sr), tmp);
      if (o.twice) runBiquad(biquad(o.type, o.f, o.Q || 1, sr), tmp);
    }
  }
  for (let n = 0; n < len; n++) out[start + n] += tmp[n];
  return out;
}

/** Karplus-Strong plucked string (with optional bridge buzz) */
export function addPluck(out, sr, { f, d = 1.2, a = 1, t = 0, bright = 0.5, buzz = 0, rng = Math.random }) {
  const start = Math.floor(t * sr);
  const len = Math.min(out.length - start, Math.ceil(d * 6 * sr));
  const P = sr / f;
  const N = Math.max(2, Math.floor(P));
  const frac = P - N;
  const line = new Float32Array(N + 2);
  // excitation: noise shaped by brightness (lowpassed for dull plucks)
  let lp = 0;
  for (let i = 0; i < line.length; i++) {
    const x = rng() * 2 - 1;
    lp += (x - lp) * (0.25 + 0.75 * bright);
    line[i] = lp;
  }
  // per-period loss to reach -60 dB at d*6.9
  const loss = Math.pow(0.001, 1 / (d * 6.9 * f));
  const s = 0.5 * (0.35 + 0.6 * bright); // two-point average weight
  let idx = 0, prev = 0;
  for (let n = 0; n < len; n++) {
    const i0 = idx, i1 = (idx + 1) % line.length;
    const y = line[i0] * (1 - frac) + line[i1] * frac;
    let nv = (y * (1 - s) + prev * s) * loss;
    if (buzz) nv = nv + buzz * 0.2 * (Math.abs(nv) > 0.12 ? Math.sign(nv) * (Math.abs(nv) - 0.12) : 0);
    prev = y;
    line[idx] = nv;
    idx = (idx + 1) % line.length;
    let o = y * a;
    if (buzz) o = Math.tanh(o * (1 + buzz * 2)) / (1 + buzz * 0.6);
    out[start + n] += o;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shared noise + impulse response

export function noiseBuffer(ctx, seconds = 2.5) {
  return cachedBuffer(`noise|${ctx.sampleRate}`, () =>
    makeBuffer(ctx, 1, seconds, ([a]) => {
      const r = mulberry32(1234);
      for (let i = 0; i < a.length; i++) a[i] = r() * 2 - 1;
    }),
  );
}

/** pink-ish noise (Paul Kellet's economy filter), looped */
export function pinkBuffer(ctx, seconds = 4, rate = 22050) {
  return cachedBuffer(`pink|${rate}`, () =>
    makeBuffer(
      ctx,
      1,
      seconds,
      ([a]) => {
        const r = mulberry32(77);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < a.length; i++) {
            const w = r() * 2 - 1;
            b0 = 0.99765 * b0 + w * 0.099046;
            b1 = 0.963 * b1 + w * 0.2965164;
            b2 = 0.57 * b2 + w * 1.0526913;
            if (pass) a[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
          }
        }
      },
      rate,
    ),
  );
}

/**
 * Night-air reverb: sparse early reflections then a dark diffuse tail whose
 * brightness falls with time. Stereo-decorrelated.
 */
export function makeIR(ctx, { dur = 2.6, rt60 = 2.1, pre = 0.018 } = {}) {
  return cachedBuffer(`ir|${ctx.sampleRate}|${dur}|${rt60}`, () =>
    makeBuffer(ctx, 2, dur, (ch, sr, n) => {
      for (let c = 0; c < 2; c++) {
        const a = ch[c];
        const r = mulberry32(99 + c * 17);
        const k = 6.9 / rt60;
        let lp = 0, hp = 0;
        const preN = Math.floor(pre * sr);
        for (let i = preN; i < n; i++) {
          const t = (i - preN) / sr;
          const env = Math.exp(-k * t) * Math.min(1, t / 0.03);
          const cut = 0.55 * Math.exp(-t * 1.6) + 0.05; // one-pole coefficient: bright -> dark
          const x = (r() * 2 - 1) * env;
          lp += (x - lp) * cut;
          hp += (lp - hp) * 0.004;
          a[i] = lp - hp;
        }
        // a few early reflections (ground, walls of the booth, trees)
        const taps = c ? [0.021, 0.037, 0.058, 0.083, 0.117] : [0.017, 0.031, 0.049, 0.071, 0.104];
        taps.forEach((tt, j) => {
          const i = Math.floor((pre + tt) * sr);
          if (i < n) a[i] += (0.5 / (j + 1.5)) * (r() < 0.5 ? -1 : 1);
        });
      }
      normalize(ch, 0.5);
    }),
  );
}

// ---------------------------------------------------------------------------
// Web Audio helpers

export function panner(ctx, pan = 0) {
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    return p;
  }
  return ctx.createGain();
}

/** soft-clip curve: linear to `knee`, then tanh into ±1 */
export function softClipCurve(knee = 0.8, n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1, ax = Math.abs(x);
    c[i] = ax <= knee ? x : Math.sign(x) * (knee + (1 - knee) * Math.tanh((ax - knee) / (1 - knee)));
  }
  return c;
}
/** drive curve for growl/buzz (symmetric tanh) */
export function driveCurve(amount = 1, n = 1024) {
  const c = new Float32Array(n);
  const k = 1 + amount * 6;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * k) / Math.tanh(k);
  }
  return c;
}

/** Freeze a param at time t (cancelAndHold where supported). */
export function holdAt(param, t) {
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
  else {
    const v = param.value;
    param.cancelScheduledValues(t);
    param.setValueAtTime(v, t);
  }
}

/** piecewise-linear automation from [[time, value], ...] relative to t0 */
export function curve(param, t0, pts, scale = 1, exp = false) {
  param.setValueAtTime(pts[0][1] * scale, t0 + pts[0][0]);
  for (let i = 1; i < pts.length; i++) {
    const v = pts[i][1] * scale;
    if (exp && v > 0) param.exponentialRampToValueAtTime(v, t0 + pts[i][0]);
    else param.linearRampToValueAtTime(v, t0 + pts[i][0]);
  }
}

/**
 * One-shot node graph. Create nodes through it, then call end(t): every
 * source is stopped at t and the whole graph is disconnected once the last
 * source has ended (or the voice is stolen).
 */
export class Shot {
  constructor(ctx, dest, { pan = 0, vol = 1, t = ctx.currentTime } = {}) {
    this.ctx = ctx;
    this.t = t;
    this.nodes = [];
    this.srcs = [];
    this.out = this.add(ctx.createGain());
    this.out.gain.value = vol;
    this.pan = this.add(panner(ctx, pan));
    this.out.connect(this.pan);
    this.pan.connect(dest);
    this.done = false;
    this.endT = t;
    this.onDone = null;
  }
  add(n) {
    this.nodes.push(n);
    return n;
  }
  gain(v = 1) {
    const g = this.add(this.ctx.createGain());
    g.gain.value = v;
    return g;
  }
  filter(type, f, Q = 1, gain = 0) {
    const b = this.add(this.ctx.createBiquadFilter());
    b.type = type;
    b.frequency.value = f;
    b.Q.value = Q;
    if (gain) b.gain.value = gain;
    return b;
  }
  osc(type, f, t = this.t) {
    const o = this.add(this.ctx.createOscillator());
    o.type = type;
    o.frequency.value = f;
    o.start(t);
    this.srcs.push(o);
    return o;
  }
  buffer(buf, { t = this.t, rate = 1, loop = false, offset = 0 } = {}) {
    const s = this.add(this.ctx.createBufferSource());
    s.buffer = buf;
    s.playbackRate.value = rate;
    s.loop = loop;
    s.start(t, loop ? offset % buf.duration : Math.min(offset, buf.duration - 0.001));
    this.srcs.push(s);
    this.endT = Math.max(this.endT, t + (loop ? 0 : (buf.duration - offset) / rate));
    return s;
  }
  noise(t = this.t) {
    const buf = noiseBuffer(this.ctx);
    return this.buffer(buf, { t, loop: true, offset: Math.random() * buf.duration });
  }
  shaper(curveArr) {
    const w = this.add(this.ctx.createWaveShaper());
    w.curve = curveArr;
    return w;
  }
  /** extra reverb send from the panned output */
  send(dest, amount) {
    if (!dest || !amount) return;
    const g = this.gain(amount);
    this.pan.connect(g);
    g.connect(dest);
  }
  /** stop all sources at t (default: when the longest buffer finishes) */
  end(t) {
    t = t == null ? this.endT : t;
    this.endT = t;
    let last = null;
    for (const s of this.srcs) {
      try {
        s.stop(t);
      } catch (e) {
        /* already stopped */
      }
      last = s;
    }
    if (last) last.onended = () => this.dispose();
    else this.dispose();
    return this;
  }
  /** fade out quickly and stop early (voice stealing) */
  kill(now = this.ctx.currentTime) {
    if (this.done) return;
    holdAt(this.out.gain, now);
    this.out.gain.setTargetAtTime(0, now, 0.012);
    for (const s of this.srcs) {
      try {
        s.stop(now + 0.07);
      } catch (e) {
        /* ignore */
      }
    }
  }
  dispose() {
    if (this.done) return;
    this.done = true;
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch (e) {
        /* ignore */
      }
    }
    this.nodes.length = 0;
    this.srcs.length = 0;
    if (this.onDone) this.onDone(this);
  }
}
