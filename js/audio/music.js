// Generative Nang Talung ensemble (วงดนตรีหนังตะลุง).
//
// Timing: 16th-note steps on AudioContext time, scheduled ahead by the
// engine's lookahead (tick(until)). Thai metre: 4-beat bars whose LAST beat
// is the strong one — the ฉิ่ง marks it with a damped "chap", the low โหม่ง
// answers, phrases land their goal tone (ลูกตก) there.
//
// Melody: a Composer produces skeleton phrases (one pentatonic degree per
// beat, 2 bars) grouped in sentences A A' B A'' (repetition + variation);
// each instrument "realises" the skeleton in its own idiom — ปี่ with
// passing notes, turns, grace notes, slides and trills; ระนาด in running
// 16ths and octave tremolo; ซอ legato with portamento; ฆ้องวง on the beats.

import { degHz, TONIC, mulberry32, wpick, clamp, holdAt } from './dsp.js';
import { perc, pitched, playBuffer } from './perc.js';
import { LeadVoice, Drone } from './melodic.js';

const PAN = { thap: 0.18, klong: 0.36, ching: 0.3, mong: -0.3, pi: -0.08, ranat: -0.35, khong: 0.3, saw: -0.15, khlui: -0.1, krap: 0.45 };

// ---------------------------------------------------------------------------
// Composer: skeleton melodies with sentence-level repetition

class Composer {
  constructor(r, { lo = 0, hi = 10, home = 0, beats = 8 } = {}) {
    Object.assign(this, { r, lo, hi, home, beats });
    this.plan = [];
    this.A = null;
    this.last = home + 2;
    this.count = 0;
  }
  next() {
    if (!this.plan.length) this.sentence();
    const ph = this.plan.shift();
    this.last = ph[ph.length - 1];
    this.count++;
    return ph;
  }
  sentence() {
    const { r, home: H, beats: n } = this;
    const h = n >> 1;
    const g1 = H + wpick(r, [[3, 3], [2, 2], [5, 1], [1, 1]]);
    const A = this.A && r() < 0.55 ? this.vary(this.A, 0.25) : this.walk(this.last, g1, n);
    this.A = A;
    const A2 = [...A.slice(0, h), ...this.walk(A[h - 1], H + wpick(r, [[0, 2], [5, 1], [-2, 1]]), h)];
    const B = this.walk(clamp(A2[n - 1] + 2, this.lo, this.hi), H + wpick(r, [[2, 2], [3, 2], [4, 1], [6, 1]]), n);
    const A3 = [...A.slice(0, h), ...this.walk(A[h - 1], H + (r() < 0.7 ? 0 : 5), h)];
    this.plan = [A, A2, B, A3];
  }
  walk(from, goal, n) {
    const { r, lo, hi } = this;
    goal = clamp(goal, lo, hi);
    const out = [];
    let x = clamp(from, lo, hi);
    for (let i = 0; i < n; i++) {
      const remain = n - 1 - i;
      if (remain === 0) {
        out.push(goal);
        break;
      }
      let st = wpick(r, [[-2, 0.1], [-1, 0.3], [0, 0.1], [1, 0.3], [2, 0.12], [3, 0.04], [-3, 0.04]]);
      const pull = (goal - x) / (remain + 1);
      if (remain <= 2) st = Math.round(pull) || (x === goal ? (r() < 0.5 ? 1 : -1) : Math.sign(goal - x));
      else st += Math.round(pull * 0.5);
      let nx = x + st;
      if (nx > hi) nx = hi - (nx - hi);
      if (nx < lo) nx = lo + (lo - nx);
      nx = clamp(nx, lo, hi);
      if (out.length >= 2 && out[out.length - 1] === nx && out[out.length - 2] === nx) nx += nx < hi ? 1 : -1;
      out.push(nx);
      x = nx;
    }
    return out;
  }
  vary(A, amt) {
    return A.map((p, i) => (i < A.length - 1 && this.r() < amt ? clamp(p + (this.r() < 0.5 ? 1 : -1), this.lo, this.hi) : p));
  }
}

// ---------------------------------------------------------------------------
// Realisers: skeleton -> timed events on a track

function piLine(tr, s0, sk, { kind = 'pi', density = 0.5, orn = 0.5, oct = 0, vel = 1, legato = true, staccato = false, vol = 1 } = {}) {
  const r = tr.r;
  const L = tr.lead(kind, PAN[kind] ?? 0, vol);
  const note = (pos, p, o = {}) => tr.at(pos, (t) => L.note(t, tr.hz(p + oct), { vel, ...o }));
  const n = sk.length;
  for (let b = 0; b < n; b++) {
    const a = sk[b], nx = b + 1 < n ? sk[b + 1] : a;
    const s = s0 + b * 4;
    const goal = b % 4 === 3;
    const dir = Math.sign(nx - a) || (r() < 0.5 ? 1 : -1);
    let fig;
    if (staccato) fig = wpick(r, [['stab', 2], ['stab2', 1.5], ['scoop', 1], ['wah', goal ? 1.5 : 0.2], ['hic', 0.5]]);
    else if (goal) fig = wpick(r, [['long', 2.5 - orn], ['trill', 0.5 + orn * 1.5], ['turnlong', 0.6 + orn], ['slide', orn]]);
    else fig = wpick(r, [['long', 1.3 - density], ['two', 1.1], ['four', density * 1.4], ['run', density * 0.8], ['grace', orn * 0.7], ['slide', orn * 0.5]]);
    switch (fig) {
      case 'long':
        note(s, a, { vib: 1.2 });
        break;
      case 'two':
        note(s, a);
        note(s + 2, a === nx ? a + (r() < 0.5 ? 1 : -1) : a + dir);
        break;
      case 'four':
        note(s, a);
        note(s + 1, a + 1);
        note(s + 2, a);
        note(s + 3, nx - dir);
        break;
      case 'run':
        note(s, a);
        note(s + 1, a + dir);
        note(s + 2, a + 2 * dir);
        note(s + 3, nx - dir);
        break;
      case 'grace':
        note(s, a + 1, { glide: 0.004, accent: 0.1 });
        note(s + 0.35, a, { glide: 0.008 });
        break;
      case 'slide':
        note(s, a - 1);
        note(s + 0.7, a, { glide: 0.05 });
        break;
      case 'trill':
        tr.at(s, (t, D) => L.trill(t, tr.hz(a + oct), tr.hz(a + 1 + oct), D * 2.6, 12 + r() * 3, vel));
        tr.at(s + 2.8, (t) => L.note(t, tr.hz(a + oct), { vel, glide: 0.01, vib: 1.3 }));
        break;
      case 'turnlong':
        note(s, a + 1);
        note(s + 0.5, a);
        note(s + 1, a - 1);
        note(s + 1.5, a, { vib: 1.3 });
        break;
      case 'stab':
      case 'stab2':
      case 'scoop':
      case 'hic': {
        const hits = fig === 'stab' ? [0] : fig === 'stab2' ? [0, 2] : fig === 'scoop' ? [0] : [0, 1, 2];
        hits.forEach((h, k) => {
          const p = fig === 'hic' ? a + (k % 2 ? 5 : 0) : fig === 'stab2' && k ? nx : a;
          if (fig === 'scoop') note(s, p - 2, { accent: 0.1 });
          note(s + h + (fig === 'scoop' ? 0.4 : 0), p, { glide: fig === 'scoop' ? 0.045 : 0.008, accent: 0.5 });
          tr.at(s + h + (fig === 'scoop' ? 1.4 : 0.8), (t) => L.rest(t, 0.015));
        });
        break;
      }
      case 'wah':
        note(s, a + 1, { accent: 0.4 });
        note(s + 0.6, a - 2, { glide: 0.12, vib: 2 });
        tr.at(s + 3.2, (t) => L.rest(t, 0.03));
        break;
    }
  }
  if (!legato) tr.at(s0 + n * 4 - 0.4, (t) => L.rest(t, 0.08));
}

function ranatLine(tr, s0, sk, { oct = 5, vol = 0.3, density = 0.7 } = {}) {
  const r = tr.r;
  const play = (pos, p, v = vol) =>
    tr.at(pos, (t) => playBuffer(tr.ctx, tr.out, pitched(tr.ctx, 'ranat', tr.hz(p + oct)), t, { vol: v * (0.85 + r() * 0.3), pan: PAN.ranat }));
  sk.forEach((a, b) => {
    const nx = sk[b + 1] ?? a;
    const s = s0 + b * 4;
    const goal = b % 4 === 3;
    const fig = goal ? wpick(r, [['kro', 2], ['oct', 1]]) : wpick(r, [['oct', 1], ['scale', density], ['approach', 1], ['sparse', 1 - density]]);
    let ns;
    if (fig === 'oct') ns = [a, a + 5, a, a + 5];
    else if (fig === 'scale') ns = [a, a + 1, a + 2, a + 1];
    else if (fig === 'approach') ns = [a, a - 1, a, nx === a ? a + 1 : nx - Math.sign(nx - a)];
    else if (fig === 'sparse') ns = [a, null, a + 5, null];
    if (fig === 'kro') {
      // ระนาดเอก tremolo (กรอ) in octaves
      for (let i = 0; i < 8; i++) play(s + i * 0.5, a + (i % 2 ? 5 : 0), vol * 0.75);
    } else {
      ns.forEach((p, i) => {
        if (p == null) return;
        play(s + i, p);
        if (i === 0) play(s, p - 5, vol * 0.5); // left hand octave below
      });
    }
  });
}

function khongLine(tr, s0, sk, { oct = 0, vol = 0.3, every = 1, pass = 0.3 } = {}) {
  const r = tr.r;
  const play = (pos, p, v) =>
    tr.at(pos, (t) => playBuffer(tr.ctx, tr.out, pitched(tr.ctx, 'khong', tr.hz(p + oct)), t, { vol: v * (0.85 + r() * 0.3), pan: PAN.khong }));
  sk.forEach((a, b) => {
    if (b % every) return;
    const s = s0 + b * 4;
    play(s, a, vol);
    if (b % 4 === 3) play(s, a - 5, vol * 0.7); // octave on the goal tone
    else if (r() < pass) play(s + 2, (sk[b + 1] ?? a) + (r() < 0.5 ? 1 : -1), vol * 0.7);
  });
}

function sawLine(tr, s0, sk, { vol = 1, oct = 0 } = {}) {
  const r = tr.r;
  const L = tr.lead('saw', PAN.saw, vol);
  sk.forEach((a, b) => {
    const s = s0 + b * 4;
    const prev = b ? sk[b - 1] : null;
    if (a === prev && r() < 0.7) return; // sustain across the beat
    const fig = wpick(r, [['slide', 1.2], ['plain', 1], ['turn', b % 4 === 3 ? 1 : 0.3], ['scoop', 0.7]]);
    const f = (p) => tr.hz(p + oct);
    if (fig === 'slide') tr.at(s, (t) => L.note(t, f(a), { glide: 0.07, vib: 1.3 }));
    else if (fig === 'plain') tr.at(s, (t) => L.note(t, f(a), { glide: 0.02, vib: 1.2 }));
    else if (fig === 'scoop') {
      tr.at(s, (t) => L.note(t, f(a - 1), { glide: 0.03 }));
      tr.at(s + 1, (t) => L.note(t, f(a), { glide: 0.06, vib: 1.4 }));
    } else {
      tr.at(s, (t) => L.note(t, f(a + 1), { glide: 0.02 }));
      tr.at(s + 1, (t) => L.note(t, f(a), { glide: 0.03 }));
      tr.at(s + 2, (t) => L.note(t, f(a - 1), { glide: 0.03 }));
      tr.at(s + 3, (t) => L.note(t, f(a), { glide: 0.05, vib: 1.4 }));
    }
  });
}

// ---------------------------------------------------------------------------
// Percussion helpers

const THAP = { o: ['thap-tong', 0.62], g: ['thap-ting', 0.46], t: ['thap-tuk', 0.44], p: ['thap-pa', 0.4] };

function thap(tr, ch, t, vol = 1) {
  if (!ch || ch === '.') return;
  const lc = ch.toLowerCase();
  const d = THAP[lc];
  if (!d) return;
  const acc = ch !== lc ? 1.25 : 1;
  tr.hit(d[0], t + (tr.r() - 0.5) * 0.006, vol * d[1] * acc * (0.85 + tr.r() * 0.3), PAN.thap);
}
function klong(tr, ch, t, vol = 1) {
  if (!ch || ch === '.') return;
  tr.hit(ch === 'K' ? 'klong-lo' : 'klong-hi', t + (tr.r() - 0.5) * 0.006, vol * 0.3 * (0.8 + tr.r() * 0.4), PAN.klong);
}
/** ฉิ่ง: 'sam' (slow, 2-bar cycle), 'song' (1 bar), 'diao' (half bar) */
function ching(tr, s, t, mode, vol = 1) {
  const period = mode === 'sam' ? 32 : mode === 'song' ? 16 : 8;
  const ph = s % period;
  if (ph === period / 2 - 4 || (mode === 'diao' && ph === 0)) tr.hit('ching', t, 0.2 * vol, PAN.ching, 1, 0.12);
  else if (ph === period - 4 || (mode === 'diao' && ph === 4)) tr.hit('chap', t, 0.26 * vol, PAN.ching);
}
function mong(tr, which, t, vol = 1) {
  const f = which === 'hi' ? tr.hz(tr.def.mong?.[1] ?? -5) : tr.hz(tr.def.mong?.[0] ?? -7);
  playBuffer(tr.ctx, tr.out, pitched(tr.ctx, 'mong', f), t, { vol: vol * 0.36 * (0.9 + tr.r() * 0.2), pan: PAN.mong, send: 0.12, sendDest: tr.wet });
}
function bell(tr, p, t, vol, pan = 0, send = 0.6) {
  playBuffer(tr.ctx, tr.out, pitched(tr.ctx, 'bell', tr.hz(p)), t, { vol, pan, send, sendDest: tr.wet });
}

// ---------------------------------------------------------------------------
// Moods

const PAT = {
  overture: { thap: ['o.t.g.t.o.tgO.t.', 'o.tgg.t.o.t.O.tt'], fill: 'tttgtttgttgtO.tt', klong: '..k...k...k.K...' },
  battle: { thap: ['o.t.g.t.o.t.O.t.', 'o.tgo.t.o.tgO.tg'], fill: 'tgtgtgtgoo.oO.tt', klong: 'k.k.K.k.k.kkK.k.' },
  dance: { thap: ['o..g..t.o.g.O.t.', 'o..g..tgo.g.O.tg'], fill: 'o..g..t.tgtgO.tt', klong: '..k.....k.k...k.', krap: '..x...x...x...x.' },
  comic: { thap: ['t..t.g..t.t.o...', 't..t.g.tt.t.o.g.'], fill: 't.t.t.gggg..O...', krap: 'x...x.x.x...x.x.' },
  calm: { thap: ['g.......o...t...', 'g.......o.t.t...'] },
};

function drumBar(tr, s, t, P, { fillEvery = 4, add = 0, vol = 1 } = {}) {
  const pos = s % 16, bar = Math.floor(s / 16);
  const pat = bar % fillEvery === fillEvery - 1 && pos >= 8 && P.fill ? P.fill : P.thap[(bar >> 1) % P.thap.length];
  let ch = pat[pos];
  if (ch === '.' && add && pos % 2 === 1 && tr.r() < add) ch = tr.r() < 0.7 ? 't' : 'g';
  thap(tr, ch, t, vol);
}

export const MOODS = {
  heaven: {
    level: 1.5, bpm: 56, push: 0, xfade: 3, mong: [-7, -5],
    melody: { lo: 5, hi: 15, home: 5 },
    init(tr) {
      tr.drone = new Drone(tr.ctx, tr.out, tr.t, [tr.hz(-5), tr.hz(-2), tr.hz(0)], { vol: 0.5, bright: 900, fadeIn: 4 });
    },
    phrase(tr, s) {
      const sk = tr.comp.next();
      // slow rising arpeggio at the phrase start, then sparse skeleton bells
      const start = sk[0] - 3;
      for (let i = 0; i < 5; i++) tr.at(s + i * 0.75, (t) => bell(tr, start + i, t, 0.12 + i * 0.02, -0.5 + i * 0.25, 0.75));
      sk.forEach((p, b) => b % 2 === 1 && tr.at(s + b * 4, (t) => bell(tr, p, t, 0.14, (tr.r() - 0.5) * 1.2, 0.75)));
    },
    step(tr, s, t) {
      const r = tr.r;
      if (s % 64 === 0) playBuffer(tr.ctx, tr.out, pitched(tr.ctx, 'gong', tr.hz(-10)), t, { vol: 0.3, pan: -0.1, send: 0.5, sendDest: tr.wet });
      if (s % 64 === 32) mong(tr, 'hi', t, 0.45);
      if (r() < 0.14) bell(tr, 7 + Math.floor(r() * 9), t + r() * 0.1, 0.05 + r() * 0.1, (r() - 0.5) * 1.4, 0.8);
      if (s % 8 === 4 && r() < 0.25) playBuffer(tr.ctx, tr.out, pitched(tr.ctx, 'khong', tr.hz(5 + Math.floor(r() * 6))), t, { vol: 0.12, pan: (r() - 0.5), send: 0.6, sendDest: tr.wet });
    },
    finish(tr, t, fade) {
      tr.drone?.stop(t, fade);
    },
  },

  overture: {
    level: 0.77, bpm: 128, push: 0.14, mong: [-7, -5],
    melody: { lo: 2, hi: 11, home: 5 },
    phrase(tr, s) {
      if (s < 32) return; // intro: gongs + drums call first
      const sk = tr.comp.next();
      if (s === 32) sk[0] = sk[1] = 10; // the pi's opening call, high
      piLine(tr, s, sk, { density: 0.45 + tr.I * 0.4, orn: 0.6, vol: 1 });
      if (tr.I > 0.4 || tr.comp.count % 2 === 0) khongLine(tr, s, sk, { vol: 0.22, pass: 0.4 });
    },
    step(tr, s, t) {
      const pos = s % 16, I = tr.I, r = tr.r;
      if (s < 32) {
        // opening: mong-mong, rolling thap, ching joins in bar 2
        if (pos === 0) mong(tr, 'lo', t, 1.1);
        if (pos === 8) mong(tr, 'hi', t, 1);
        if (s < 16) {
          if (pos % 4 === 0) thap(tr, pos === 0 ? 'O' : 'g', t);
        } else {
          const roll = 'o.t.t.tttttttttO';
          thap(tr, roll[pos], t, 0.6 + pos / 30);
          ching(tr, s, t, 'song');
        }
        return;
      }
      drumBar(tr, s, t, PAT.overture, { add: I * 0.45 });
      const kc = PAT.overture.klong[pos];
      if (kc !== '.') klong(tr, kc, t);
      else if (pos % 2 === 1 && r() < I * 0.3) klong(tr, 'k', t, 0.7);
      if (pos === 4 || pos === 12) mong(tr, pos === 4 ? 'hi' : 'lo', t);
      else if (I > 0.6 && (pos === 0 || pos === 8)) mong(tr, pos === 0 ? 'hi' : 'lo', t, 0.7);
      ching(tr, s, t, I > 0.5 ? 'diao' : 'song');
    },
  },

  calm: {
    level: 1.6, bpm: 72, push: 0.06, mong: [-7, -5],
    melody: { lo: 0, hi: 8, home: 2 },
    phrase(tr, s) {
      const sk = tr.comp.next();
      piLine(tr, s, sk, { kind: 'khlui', density: 0.2 + tr.I * 0.3, orn: 0.55, oct: 5, vol: 0.9, legato: tr.comp.count % 4 !== 0 });
      khongLine(tr, s, sk, { vol: 0.18, every: tr.I > 0.4 ? 1 : 2, pass: 0.2 });
    },
    step(tr, s, t) {
      const pos = s % 16, bar = Math.floor(s / 16);
      drumBar(tr, s, t, PAT.calm, { fillEvery: 99, vol: 0.55 + tr.I * 0.3 });
      if (pos === 12 && bar % 2 === 1) mong(tr, 'lo', t, 0.75);
      if (pos === 12 && bar % 2 === 0 && tr.I > 0.3) mong(tr, 'hi', t, 0.5);
      ching(tr, s, t, 'song', 0.7);
    },
  },

  battle: {
    level: 0.68, bpm: 150, push: 0.2, mong: [-7, -5],
    melody: { lo: 2, hi: 11, home: 5 },
    phrase(tr, s) {
      const sk = tr.comp.next();
      const hiReg = tr.I > 0.7 ? 2 : 0;
      piLine(tr, s, sk.map((p) => p + hiReg), { density: 0.55 + tr.I * 0.4, orn: 0.6 + tr.I * 0.3, vol: 1.05 });
      if (tr.I > 0.3) khongLine(tr, s, sk, { vol: 0.2, pass: 0.5 });
    },
    step(tr, s, t) {
      const pos = s % 16, I = tr.I, r = tr.r;
      drumBar(tr, s, t, PAT.battle, { add: 0.1 + I * 0.55, fillEvery: I > 0.6 ? 2 : 4 });
      const kc = PAT.battle.klong[pos];
      if (kc !== '.' && r() < 0.55 + I * 0.45) klong(tr, kc, t);
      else if (pos % 2 === 1 && r() < I * 0.3) klong(tr, 'k', t, 0.7);
      if (pos === 4 || pos === 12) mong(tr, pos === 4 ? 'hi' : 'lo', t);
      else if (I > 0.5 && (pos === 0 || pos === 8)) mong(tr, pos === 0 ? 'hi' : 'lo', t, 0.75);
      ching(tr, s, t, I > 0.35 ? 'diao' : 'song');
    },
  },

  dance: {
    level: 0.9, bpm: 108, push: 0.1, mong: [-7, -5],
    melody: { lo: 0, hi: 9, home: 2 },
    phrase(tr, s) {
      const sk = tr.comp.next();
      ranatLine(tr, s, sk, { vol: 0.28, density: 0.6 + tr.I * 0.3 });
      if (tr.comp.count % 4 >= 2 || tr.I > 0.5) piLine(tr, s, sk, { density: 0.25, orn: 0.6, oct: 2, vol: 0.75 });
      else if (tr.leads.pi) tr.at(s, (t) => tr.leads.pi.rest(t, 0.15));
    },
    step(tr, s, t) {
      const pos = s % 16, I = tr.I, r = tr.r;
      drumBar(tr, s, t, PAT.dance, { add: I * 0.3 });
      const kc = PAT.dance.klong[pos];
      if (kc !== '.' && r() < 0.6 + I * 0.4) klong(tr, kc, t, 0.8);
      if (PAT.dance.krap[pos] !== '.' && r() < 0.5 + I * 0.5) tr.hit('krap', t, 0.2, PAN.krap);
      if (pos === 4) mong(tr, 'hi', t, 0.8);
      if (pos === 12) mong(tr, 'lo', t, 0.9);
      ching(tr, s, t, 'song');
    },
  },

  comic: {
    level: 1.0, bpm: 126, push: 0.1, mong: [-7, -5],
    melody: { lo: 1, hi: 10, home: 5 },
    phrase(tr, s) {
      const sk = tr.comp.next();
      piLine(tr, s, sk, { staccato: true, orn: 0.8, vol: 0.9 });
    },
    step(tr, s, t) {
      const pos = s % 16, r = tr.r;
      drumBar(tr, s, t, PAT.comic, { add: tr.I * 0.3 });
      if (PAT.comic.krap[pos] !== '.') tr.hit('krap', t, 0.26 * (0.8 + r() * 0.4), PAN.krap);
      if (pos === 0) mong(tr, 'hi', t, 0.7);
      if (pos === 6) mong(tr, 'lo', t, 0.6);
      if (pos === 12) mong(tr, 'hi', t, 0.8);
      ching(tr, s, t, 'diao', 0.8);
    },
  },

  sad: {
    level: 1.1, bpm: 56, push: 0.04, mong: [-6, -3],
    melody: { lo: 0, hi: 9, home: 4 },
    init(tr) {
      tr.drone = new Drone(tr.ctx, tr.out, tr.t, [tr.hz(-6), tr.hz(-1)], { vol: 0.35, bright: 520, fadeIn: 4 });
    },
    phrase(tr, s) {
      const sk = tr.comp.next();
      sawLine(tr, s, sk, { vol: 1 });
      khongLine(tr, s, sk, { vol: 0.12, every: 4, pass: 0 });
      if (tr.comp.count % 4 === 0) tr.at(s + 31, (t) => tr.leads.saw && tr.leads.saw.rest(t, 0.2));
    },
    step(tr, s, t) {
      if (s % 32 === 28) mong(tr, 'lo', t, 0.6);
      if (s % 32 === 12) thap(tr, 'o', t, 0.35);
      ching(tr, s, t, 'sam', 0.55);
    },
    finish(tr, t, fade) {
      tr.drone?.stop(t, fade);
    },
  },
};
export const MOOD_NAMES = Object.keys(MOODS);

// ---------------------------------------------------------------------------
// Track: one running mood

let seedCounter = 1;

class Track {
  constructor(music, mood, t0, fadeIn) {
    this.music = music;
    this.eng = music.eng;
    this.ctx = music.ctx;
    this.mood = mood;
    this.def = MOODS[mood];
    this.out = this.ctx.createGain();
    this.out.gain.setValueAtTime(0.0001, t0);
    this.out.gain.linearRampToValueAtTime(this.def.level ?? 1, t0 + fadeIn);
    this.out.connect(music.out);
    // per-track reverb send (faded together with the track)
    this.wet = this.ctx.createGain();
    this.wet.gain.setValueAtTime(0.0001, t0);
    this.wet.gain.linearRampToValueAtTime(1, t0 + fadeIn);
    this.wet.connect(this.eng.revIn);
    this.r = mulberry32((Date.now() & 0xffff) * 31 + seedCounter++ * 7919);
    this.t = t0;
    this.s = 0;
    this.I = music.target;
    this.q = [];
    this.dirty = false;
    this.leads = {};
    this.stopAt = null;
    this.finished = false;
    this.dead = false;
    this.tonic = TONIC;
    this.comp = new Composer(this.r, this.def.melody);
    this.def.init?.(this);
  }
  hz(p) {
    return degHz(p, 0, this.tonic);
  }
  stepDur() {
    return 60 / (this.def.bpm * (1 + (this.def.push || 0) * this.I)) / 4;
  }
  nextBeatTime() {
    const k = (4 - (this.s % 4)) % 4;
    return this.t + k * this.stepDur();
  }
  at(pos, fn) {
    this.q.push({ s: pos, fn });
    this.dirty = true;
  }
  hit(kind, t, vol = 1, pan = 0, rate = 1, send = 0) {
    this.music.hitCount++;
    return playBuffer(this.ctx, this.out, perc(this.ctx, kind), t, { vol, pan, rate, send, sendDest: this.wet });
  }
  lead(kind, pan = 0, vol = 1) {
    return (this.leads[kind] ||= new LeadVoice(this.ctx, this.out, kind, this.t, { pan, vol }));
  }
  schedule(until) {
    if (this.dead) return;
    const now = this.ctx.currentTime;
    const end = this.stopAt ?? Infinity;
    // fell far behind (tab was hidden / long stall): skip instead of bursting
    while (this.t < now - 0.08 && this.t < end) {
      this.t += this.stepDur();
      this.s++;
    }
    if (this.q.length && this.q[0].s < this.s) this.q = this.q.filter((e) => e.s >= this.s - 0.001);
    while (this.t < until && this.t < end) {
      this.I += (this.music.target - this.I) * 0.1;
      const D = this.stepDur();
      const s = this.s;
      if (this.def.phrase && s % 32 === 0) this.def.phrase(this, s);
      if (this.dirty) {
        this.q.sort((a, b) => a.s - b.s);
        this.dirty = false;
      }
      this.def.step(this, s, this.t, D);
      while (this.q.length && this.q[0].s < s + 1) {
        const e = this.q.shift();
        try {
          e.fn(this.t + Math.max(0, e.s - s) * D, D);
        } catch (err) {
          console.warn('[audio] music event', err);
        }
      }
      this.t += D;
      this.s++;
    }
    if (this.stopAt != null && this.t >= end && !this.finished) this.finish();
    if (this.finished && now > this.stopAt + 0.3) this.dispose();
  }
  fadeOut(t, dur) {
    if (this.stopAt != null) return;
    for (const g of [this.out.gain, this.wet.gain]) {
      holdAt(g, t);
      g.linearRampToValueAtTime(0, t + dur);
    }
    this.stopAt = t + dur;
    this.def.finish?.(this, t, dur);
  }
  finish() {
    this.finished = true;
    for (const L of Object.values(this.leads)) L.stop(this.stopAt, 0.05);
  }
  dispose() {
    this.dead = true;
    this.q.length = 0;
    const { out, wet } = this;
    // let decaying hits die inside the silent gains, then detach
    setTimeoutSafe(() => {
      out.disconnect();
      wet.disconnect();
    }, 6000);
  }
}

function setTimeoutSafe(fn, ms) {
  try {
    setTimeout(fn, ms);
  } catch (e) {
    fn();
  }
}

// ---------------------------------------------------------------------------

export class Music {
  constructor(eng) {
    this.eng = eng;
    this.ctx = eng.ctx;
    this.out = this.ctx.createGain();
    this.out.connect(eng.buses.music);
    this.tracks = [];
    this.cur = null;
    this.target = 0;
    this.hitCount = 0; // drum/cymbal strokes scheduled (diagnostics)
  }
  get mood() {
    return this.cur ? this.cur.mood : null;
  }
  /** current melodic context for playable instruments */
  get scale() {
    const tr = this.cur;
    return tr ? { home: tr.def.melody.home, tonic: tr.tonic } : { home: 0, tonic: TONIC };
  }
  play(mood) {
    if (!MOODS[mood]) return;
    if (this.cur && this.cur.mood === mood) return;
    const now = this.ctx.currentTime;
    let t = now + 0.06;
    const old = this.cur;
    if (old) {
      const nb = old.nextBeatTime();
      if (nb > t && nb - now < 0.7) t = nb;
      old.fadeOut(t, MOODS[mood].xfade ?? 2.2);
    }
    this.cur = new Track(this, mood, t, old ? 1.6 : 0.5);
    this.tracks.push(this.cur);
  }
  setIntensity(x) {
    this.target = clamp(+x || 0, 0, 1);
  }
  stop(fade = 1.5) {
    if (!this.cur) return;
    this.cur.fadeOut(this.ctx.currentTime + 0.02, Math.max(0.05, +fade || 0));
    this.cur = null;
  }
  tick(until) {
    for (const tr of this.tracks) tr.schedule(until);
    if (this.tracks.some((t) => t.dead)) this.tracks = this.tracks.filter((t) => !t.dead);
  }
}
