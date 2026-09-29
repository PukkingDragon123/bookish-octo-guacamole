// Formant "vocal tract" synth used for dialogue babble, animals and crowds.
//
// Vocal: glottal source (saw/square [+ sub-octave, + chorus]) and breath noise
//   -> optional roughness AM + drive -> 3 parallel band-pass formants
//   -> amplitude envelope -> pan. All contours are automation, so one graph
//   speaks a whole sentence.
//
// babble(): Animal-Crossing-style speech. Thai text is split into syllables
// with a small orthographic parser and each syllable gets its real Thai tone
// (consonant class + tone mark + live/dead syllable), so contours follow the
// written line; Latin text gets vowel-group syllables and hashed tones.

import { Shot, driveCurve, mulberry32, hashStr, clamp } from './dsp.js';

// F1 F2 F3 (adult male)
export const VOWELS = {
  a: [730, 1090, 2440], e: [500, 1850, 2500], E: [650, 1720, 2410], i: [290, 2250, 3000],
  o: [540, 830, 2400], O: [600, 900, 2550], u: [320, 850, 2250], U: [360, 1450, 2400],
  m: [270, 1050, 2200], n: [300, 1550, 2550],
};

export class Vocal {
  constructor(ctx, dest, t, o = {}) {
    const {
      src = 'sawtooth', pan = 0, vol = 1, fs = 1, noise = 0.03, drive = 0, rough = null,
      sub = 0, chorus = 0, vib = null, Q = [7, 11, 14], send = 0, sendDest = null, f0 = 150, vowel = 'a',
    } = o;
    this.ctx = ctx;
    this.fs = fs;
    const s = (this.shot = new Shot(ctx, dest, { pan, vol, t }));
    this.t0 = t;
    const srcMix = s.gain(1);
    this.oscs = [];
    const addOsc = (type, det, g, mul = 1) => {
      const osc = s.osc(type, f0 * mul, t);
      osc.detune.value = det;
      const og = s.gain(g);
      osc.connect(og);
      og.connect(srcMix);
      this.oscs.push([osc, mul]);
      return osc;
    };
    addOsc(src, 0, 0.6);
    if (chorus) addOsc(src, chorus, 0.45);
    if (sub) addOsc('triangle', 0, sub * 0.8, 0.5);
    if (vib) {
      const lfo = s.osc('sine', vib.rate, t);
      const lg = s.gain(vib.depth);
      lfo.connect(lg);
      for (const [osc] of this.oscs) lg.connect(osc.detune);
    }
    let head = srcMix;
    if (rough) {
      // amplitude roughness (growl, rasp): AM by a low-audio-rate oscillator
      const am = s.gain(1 - rough.depth * 0.5);
      const lfo = s.osc(rough.type || 'triangle', rough.rate, t);
      const lg = s.gain(rough.depth * 0.5);
      lfo.connect(lg);
      lg.connect(am.gain);
      head.connect(am);
      head = am;
    }
    if (drive) {
      const pre = s.gain(1 + drive * 2);
      const sh = s.shaper(driveCurve(drive));
      head.connect(pre);
      pre.connect(sh);
      head = sh;
    }
    // breath / consonant noise
    const n = s.noise(t);
    const nhp = s.filter('highpass', 900, 0.7);
    this.ng = s.gain(noise);
    this.noiseBase = noise;
    n.connect(nhp);
    nhp.connect(this.ng);

    const v = VOWELS[vowel] || VOWELS.a;
    this.env = s.gain(0);
    this.forms = [];
    const fg = [1, 0.62, 0.26];
    for (let k = 0; k < 3; k++) {
      const bp = s.filter('bandpass', v[k] * fs, Q[k]);
      const g = s.gain(fg[k] * 3.2);
      head.connect(bp);
      this.ng.connect(bp);
      bp.connect(g);
      g.connect(this.env);
      this.forms.push(bp);
    }
    // a little direct body so low voices don't vanish
    const body = s.filter('lowpass', 520 * fs, 0.7);
    const bg = s.gain(0.1);
    head.connect(body);
    body.connect(bg);
    bg.connect(this.env);
    const ndir = s.gain(0.35);
    this.ng.connect(ndir);
    ndir.connect(this.env);
    this.env.connect(s.out);
    if (send) s.send(sendDest, send);
    this.lastF = f0;
    this.started = { f: false, v: false, a: false, n: false };
  }
  /** glide pitch to f (Hz) arriving at time t */
  f0(t, f) {
    f = clamp(f, 20, 4000);
    for (const [osc, mul] of this.oscs) {
      if (!this.started.f) osc.frequency.setValueAtTime(f * mul, t);
      else osc.frequency.linearRampToValueAtTime(f * mul, t);
    }
    this.started.f = true;
    this.lastF = f;
  }
  vowel(t, v, fsMul = 1) {
    const F = typeof v === 'string' ? VOWELS[v] || VOWELS.a : v;
    this.forms.forEach((bp, k) => {
      const f = clamp(F[k] * this.fs * fsMul, 80, 9000);
      if (!this.started.v) bp.frequency.setValueAtTime(f, t);
      else bp.frequency.linearRampToValueAtTime(f, t);
    });
    this.started.v = true;
  }
  amp(t, a) {
    if (!this.started.a) this.env.gain.setValueAtTime(a, t);
    else this.env.gain.linearRampToValueAtTime(a, t);
    this.started.a = true;
  }
  breath(t, a) {
    if (!this.started.n) this.ng.gain.setValueAtTime(a, t);
    else this.ng.gain.linearRampToValueAtTime(a, t);
    this.started.n = true;
  }
  end(t) {
    this.shot.end(t);
    return this.shot;
  }
}

/** Build a vocal from breakpoint lists (times relative to t). */
export function vocalize(ctx, dest, t, spec) {
  const v = new Vocal(ctx, dest, t, { ...spec, f0: spec.f[0][1] * (spec.pitch || 1), vowel: spec.v ? spec.v[0][1] : 'a' });
  const p = spec.pitch || 1;
  for (const [tt, f] of spec.f) v.f0(t + tt, f * p);
  if (spec.v) for (const [tt, vw] of spec.v) v.vowel(t + tt, vw);
  for (const [tt, a] of spec.a) v.amp(t + tt, a);
  if (spec.n) for (const [tt, a] of spec.n) v.breath(t + tt, a);
  const end = spec.a[spec.a.length - 1][0];
  return v.end(t + end + 0.05);
}

// ---------------------------------------------------------------------------
// Voices

export const VOICES = {
  male: { f0: 118, fs: 1.0, syl: 0.125, range: 1.0, src: 'sawtooth', noise: 0.03, vol: 1 },
  female: { f0: 215, fs: 1.17, syl: 0.115, range: 1.1, src: 'sawtooth', noise: 0.04, vol: 0.9 },
  old: { f0: 132, fs: 1.04, syl: 0.165, range: 0.8, src: 'sawtooth', noise: 0.16, vib: { rate: 6.3, depth: 38 }, vol: 1.2 },
  comic: { f0: 245, fs: 1.25, syl: 0.095, range: 2.1, src: 'square', noise: 0.03, bounce: 0.32, vol: 0.75 },
  demon: { f0: 64, fs: 0.78, syl: 0.165, range: 0.9, src: 'sawtooth', noise: 0.1, sub: 0.7, drive: 0.7, rough: { rate: 27, depth: 0.55 }, send: 0.35, vol: 1.35 },
  child: { f0: 300, fs: 1.35, syl: 0.105, range: 1.2, src: 'sawtooth', noise: 0.04, vol: 0.85 },
  monkey: { f0: 430, fs: 1.5, syl: 0.078, range: 2.4, src: 'sawtooth', noise: 0.05, bounce: 0.5, vowels: 'uuiiae', vol: 0.8 },
  god: { f0: 98, fs: 0.92, syl: 0.19, range: 0.7, src: 'sawtooth', noise: 0.05, chorus: 11, send: 0.6, vib: { rate: 4.5, depth: 9 }, vol: 0.9 },
};

// Thai tone contours: f0 ratio over normalised syllable time
const TONES = {
  M: [[0, 1.0], [1, 0.97]], // สามัญ mid
  L: [[0, 0.91], [1, 0.84]], // เอก low
  F: [[0, 1.1], [0.35, 1.17], [1, 0.82]], // โท falling
  H: [[0, 1.05], [0.6, 1.13], [1, 1.2]], // ตรี high
  R: [[0, 0.93], [0.45, 0.86], [1, 1.15]], // จัตวา rising
};

// ---------------------------------------------------------------------------
// Syllabification

const isC = (c) => c >= 0x0e01 && c <= 0x0e2e;
const isLV = (c) => c >= 0x0e40 && c <= 0x0e44;
const isV = (c) => c === 0x0e30 || c === 0x0e31 || (c >= 0x0e32 && c <= 0x0e39) || c === 0x0e47 || c === 0x0e45;
const isT = (c) => c >= 0x0e48 && c <= 0x0e4b;
const isMark = (c) => c === 0x0e4c || c === 0x0e4d || c === 0x0e4e || c === 0x0e3a;
const MID = 'กจฎฏดตบปอ';
const HIGH = 'ขฃฉฐถผฝศษสห';
const SONOR = 'งญนมยรลว';
const PLOS = 'กขคฆจฉชฌฎฏฐฑฒดตถทธบปผพภ';
const FRIC = 'ฝฟซศษสหฮ';
const NAS = 'งญณนม';
const STOPF = 'กขคฆดตถทธฎฏฐฑฒจชซศษสบปพฟภ';

function thaiSyllables(word) {
  const out = [];
  const cs = [...word];
  let i = 0;
  while (i < cs.length) {
    const code = (k) => (k < cs.length ? cs[k].codePointAt(0) : 0);
    let lead = null;
    if (isLV(code(i))) lead = cs[i++];
    if (!isC(code(i))) {
      // stray vowel / mark
      if (lead) out.push({ init: 'อ', lead, vow: [], tone: null, fin: null });
      i++;
      continue;
    }
    const init = cs[i++];
    let init2 = null;
    // cluster (กร-, หน-, สว-): second consonant directly carries the vowel
    if (isC(code(i)) && (isV(code(i + 1)) || isT(code(i + 1)))) {
      init2 = cs[i++];
    }
    const vow = [];
    let tone = null;
    while (i < cs.length && (isV(code(i)) || isT(code(i)) || isMark(code(i)))) {
      if (isT(code(i))) tone = cs[i];
      else if (isV(code(i))) vow.push(cs[i]);
      i++;
    }
    let fin = null;
    // final consonant: a consonant not itself starting a vowel-bearing syllable
    if (isC(code(i)) && !(isV(code(i + 1)) || isT(code(i + 1)))) {
      fin = cs[i++];
      while (i < cs.length && isMark(code(i))) i++;
      // silent letters with thanthakhat already skipped; อ/ย/ว as vowel parts
      if (isC(code(i)) && 'อยว'.includes(cs[i]) && !(isV(code(i + 1)) || isT(code(i + 1)))) i++;
    }
    out.push({ init, init2, lead, vow, tone, fin });
    if (i < cs.length && cs[i] === 'ๆ') {
      out.push(out[out.length - 1]);
      i++;
    }
  }
  return out.map(thaiInfo);
}

function thaiInfo(s) {
  const { init, init2, lead, vow, tone, fin } = s;
  // consonant class (ห / อ leading a sonorant makes it high / mid)
  let cls = MID.includes(init) ? 'mid' : HIGH.includes(init) ? 'high' : 'low';
  if (init === 'ห' && init2 && SONOR.includes(init2)) cls = 'high';
  const v = vow.join('');
  let vowel = 'o';
  let short = false;
  if (lead === 'ใ' || lead === 'ไ') vowel = 'a';
  else if (lead === 'เ') vowel = v.includes('า') ? 'a' : v.includes('ี') || v.includes('ื') ? 'U' : 'e';
  else if (lead === 'แ') vowel = 'E';
  else if (lead === 'โ') vowel = 'o';
  else if (/[ิี]/.test(v)) vowel = 'i';
  else if (/[ึื]/.test(v)) vowel = 'U';
  else if (/[ุู]/.test(v)) vowel = 'u';
  else if (/[าะัำ]/.test(v)) vowel = 'a';
  else if (fin === 'อ') vowel = 'O';
  if (/[ะัิึุ็]/.test(v) || (!v && !lead && fin)) short = true;
  const dead = (!fin && short) || (fin && STOPF.includes(fin));
  let T;
  if (tone === '่') T = cls === 'low' ? 'F' : 'L';
  else if (tone === '้') T = cls === 'low' ? 'H' : 'F';
  else if (tone === '๊') T = 'H';
  else if (tone === '๋') T = 'R';
  else if (dead) T = cls === 'low' ? (short ? 'H' : 'F') : 'L';
  else T = cls === 'high' ? 'R' : 'M';
  const c = init2 && init === 'ห' ? init2 : init;
  const cons = PLOS.includes(c) ? 'p' : FRIC.includes(c) ? 'f' : NAS.includes(c) ? 'n' : 'l';
  return { v: vowel, tone: T, cons, glide: lead === 'ใ' || lead === 'ไ' ? 'i' : null, stop: fin && STOPF.includes(fin), nasal: fin && NAS.includes(fin) };
}

function latinSyllables(word, r) {
  const groups = word.toLowerCase().match(/[^aeiouy]*[aeiouy]+/g) || [word];
  return groups.map((g) => {
    const vch = g.match(/[aeiouy]/)?.[0] || 'a';
    const c = g[0];
    const cons = /[pbtdkgcq]/.test(c) ? 'p' : /[sfhzxjv]/.test(c) ? 'f' : /[mn]/.test(c) ? 'n' : 'l';
    const v = { a: 'a', e: 'e', i: 'i', o: 'o', u: 'u', y: 'i' }[vch];
    const x = r();
    const tone = x < 0.45 ? 'M' : x < 0.6 ? 'L' : x < 0.75 ? 'F' : x < 0.88 ? 'H' : 'R';
    return { v, tone, cons };
  });
}

/** text -> [{v, tone, cons, pause, end}] */
export function syllabify(text, r = mulberry32(hashStr(String(text)))) {
  const out = [];
  const tokens = String(text || '').match(/[฀-๿]+|[A-Za-zÀ-ɏ']+|\d|[,;:、，]|[.!?…。！？]+|\s+|./gu) || [];
  for (const tk of tokens) {
    const c0 = tk.codePointAt(0);
    let syl = null;
    if (c0 >= 0x0e00 && c0 <= 0x0e7f) {
      if (/^[๐-๙]$/.test(tk)) syl = [{ v: 'a', tone: 'M', cons: 'l' }];
      else syl = thaiSyllables(tk);
    } else if (/[A-Za-zÀ-ɏ]/.test(tk)) syl = latinSyllables(tk.replace(/'/g, ''), r);
    else if (/\d/.test(tk)) syl = [{ v: pick5(r), tone: 'M', cons: 'p' }];
    else if (/[,;:、，]/.test(tk)) addPause(out, 0.13);
    else if (/[.!?…。！？]/.test(tk)) {
      addPause(out, 0.26);
      if (out.length) {
        if (tk.includes('?') || tk.includes('？')) out[out.length - 1].q = true;
        if (tk.includes('!') || tk.includes('！')) out[out.length - 1].ex = true;
        out[out.length - 1].end = true;
      }
    } else if (/\s/.test(tk)) addPause(out, 0.035);
    if (syl) for (const s of syl) out.push({ ...s, pause: 0 });
  }
  return out;
}
function addPause(out, p) {
  if (out.length) out[out.length - 1].pause = Math.max(out[out.length - 1].pause, p);
}
function pick5(r) {
  return 'aeiou'[Math.floor(r() * 5)];
}

/** Duration without building anything (also used before init). */
export function estimateBabble(text, { voice = 'male', rate = 1 } = {}) {
  const P = VOICES[voice] || VOICES.male;
  const syl = syllabify(text).slice(0, MAX_SYL);
  let d = 0.02;
  for (const s of syl) d += (P.syl * 1.0 * (s.end ? 1.35 : 1)) / rate + 0.022 / rate + s.pause / rate;
  return syl.length ? d + 0.06 : 0;
}

const MAX_SYL = 60;

/**
 * Speak `text` as tonal babble into dest at t. Returns [shot, duration].
 */
export function babble(ctx, dest, t, text, { voice = 'male', pan = 0, rate = 1, vol = 1, sendDest = null, pitch = 1 } = {}) {
  const P = VOICES[voice] || VOICES.male;
  const r = mulberry32(hashStr(voice + '|' + text));
  const syl = syllabify(text, r).slice(0, MAX_SYL);
  if (!syl.length) return [null, 0];
  rate = clamp(rate || 1, 0.3, 3);
  const f0 = P.f0 * pitch * (0.97 + r() * 0.06);
  const v = new Vocal(ctx, dest, t, {
    src: P.src, pan, vol: vol * P.vol, fs: P.fs, noise: P.noise, drive: P.drive, rough: P.rough,
    sub: P.sub, chorus: P.chorus, vib: P.vib, send: P.send, sendDest, f0, vowel: syl[0].v,
  });
  let tt = t + 0.02;
  v.amp(t, 0);
  v.breath(t, P.noise);
  v.f0(t, f0);
  v.vowel(t, syl[0].v);
  const n = syl.length;
  syl.forEach((s, i) => {
    const d = (P.syl * (0.85 + r() * 0.3) * (s.end ? 1.35 : 1)) / rate;
    const decl = 1 - 0.1 * (i / Math.max(1, n - 1)); // sentence declination
    let bounce = 1;
    if (P.bounce) bounce = 1 + P.bounce * (i % 2 ? 0.8 : -0.35) * (0.6 + r() * 0.8);
    const base = f0 * decl * bounce * (s.ex ? 1.12 : 1);
    const contour = TONES[s.q ? 'R' : s.tone] || TONES.M;
    const range = P.range * (s.q ? 1.4 : 1);
    // consonant onset
    const att = s.cons === 'p' ? 0.008 : s.cons === 'n' ? 0.03 : 0.018;
    if (s.cons === 'p' || s.cons === 'f') {
      v.breath(tt, P.noise);
      v.breath(tt + 0.004, s.cons === 'f' ? 0.55 : 0.4);
      v.breath(tt + (s.cons === 'f' ? 0.045 : 0.018), P.noise);
    }
    if (s.cons === 'n') v.vowel(tt, 'm');
    const vw = P.vowels ? P.vowels[Math.floor(r() * P.vowels.length)] : s.v;
    v.vowel(tt + att + 0.01, vw);
    if (s.glide) v.vowel(tt + d * 0.85, s.glide);
    for (const [x, k] of contour) v.f0(tt + x * d, base * (1 + (k - 1) * range));
    const peak = s.ex ? 1 : 0.8 + r() * 0.2;
    v.amp(tt + att, peak);
    v.amp(tt + d * 0.75, peak * 0.85);
    if (s.nasal) v.vowel(tt + d * 0.8, 'n');
    v.amp(tt + d, s.stop ? 0.0 : 0.08);
    tt += d + 0.022 / rate + s.pause / rate;
    if (s.pause) v.amp(tt - 0.01, 0);
  });
  v.amp(tt + 0.02, 0);
  const shot = v.end(tt + 0.08);
  return [shot, tt + 0.06 - t];
}

/** crowd / character laughter: 'ha-ha-ha' with falling pitch */
export function laughVoice(ctx, dest, t, { f0 = 180, n = 5, gap = 0.15, vowel = 'a', pan = 0, vol = 1, fs = 1.1, sendDest = null, send = 0 } = {}) {
  const v = new Vocal(ctx, dest, t, { pan, vol, fs, noise: 0.05, f0, vowel, sendDest, send });
  v.amp(t, 0);
  v.breath(t, 0.05);
  v.f0(t, f0);
  for (let i = 0; i < n; i++) {
    const tt = t + i * gap * (0.9 + Math.random() * 0.2);
    const f = f0 * (1.15 - (0.35 * i) / n);
    v.breath(tt, 0.6);
    v.amp(tt + 0.012, 0.25);
    v.breath(tt + 0.035, 0.08);
    v.f0(tt + 0.03, f * 1.05);
    v.amp(tt + 0.045, 0.95 - i * 0.08);
    v.f0(tt + gap * 0.6, f * 0.92);
    v.amp(tt + gap * 0.65, 0.05);
  }
  const end = t + n * gap + 0.05;
  v.amp(end, 0);
  return v.end(end + 0.05);
}
