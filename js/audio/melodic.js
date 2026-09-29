// Sustained / continuous melodic instruments built from live Web Audio nodes.
//
//   LeadVoice  persistent monophonic voice with portamento, vibrato and
//              articulation — ปี่ pi (quadruple reed, nasal & buzzy, circular
//              breathing), ซอ saw (fiddle), ขลุ่ย khlui (breathy flute)
//   khaen()    แคน free-reed mouth organ chord with drones
//   Drone      soft sustained pad for heaven / sad moods

import { Shot, driveCurve, holdAt } from './dsp.js';

const LEADS = {
  pi: {
    oscs: [['sawtooth', 0, 1], ['square', 7, 0.5]],
    drive: 0.45,
    chain: [['highpass', 420, 0.8], ['peaking', 1180, 1.3, 9], ['peaking', 2750, 2.2, 5], ['lowpass', 5200, 0.7]],
    vib: { rate: 5.7, depth: 16 },
    level: 0.2,
    attack: 0.02,
    noise: { level: 0.02, f: 2600, Q: 1.2 },
  },
  saw: {
    oscs: [['sawtooth', 0, 1], ['sawtooth', -6, 0.45]],
    drive: 0.1,
    chain: [['highpass', 280, 0.7], ['peaking', 850, 1.6, 7], ['peaking', 2200, 1.8, 4], ['lowpass', 3700, 0.7]],
    vib: { rate: 5.3, depth: 24 },
    level: 0.2,
    attack: 0.07,
    noise: { level: 0.025, f: 3600, Q: 0.8 },
  },
  khlui: {
    oscs: [['sine', 0, 1], ['triangle', 4, 0.3]],
    drive: 0,
    chain: [['lowpass', 3800, 0.7]],
    vib: { rate: 4.9, depth: 11 },
    level: 0.26,
    attack: 0.05,
    noise: { level: 0.09, f: 0, Q: 2.2, track: 2 },
  },
};
export const LEAD_KINDS = Object.keys(LEADS);

export class LeadVoice {
  constructor(ctx, dest, kind, t, { pan = 0, vol = 1 } = {}) {
    const def = (this.def = LEADS[kind] || LEADS.pi);
    this.ctx = ctx;
    const s = (this.shot = new Shot(ctx, dest, { pan, vol, t }));
    this.amp = s.gain(0);
    const mix = s.gain(1);
    let head = mix;
    if (def.drive) {
      const sh = s.shaper(driveCurve(def.drive));
      head.connect(sh);
      head = sh;
    }
    for (const [type, f, Q, g] of def.chain) {
      const fl = s.filter(type, f, Q, g);
      head.connect(fl);
      head = fl;
    }
    head.connect(this.amp);
    this.amp.connect(s.out);

    this.oscs = def.oscs.map(([type, det, g]) => {
      const o = s.osc(type, 440, t);
      o.detune.value = det;
      const og = s.gain(g * 0.5);
      o.connect(og);
      og.connect(mix);
      return o;
    });
    const lfo = s.osc('sine', def.vib.rate * (0.95 + Math.random() * 0.1), t);
    this.vib = s.gain(0);
    lfo.connect(this.vib);
    for (const o of this.oscs) this.vib.connect(o.detune);

    if (def.noise) {
      const n = s.noise(t);
      this.nf = s.filter('bandpass', def.noise.f || 1000, def.noise.Q);
      const ng = s.gain(def.noise.level);
      n.connect(this.nf);
      this.nf.connect(ng);
      ng.connect(this.amp);
    }
    this.last = t;
    this.cur = 0;
    this.silent = true;
  }

  _t(t) {
    t = Math.max(t, this.last + 0.003);
    this.last = t;
    return t;
  }

  /** move to frequency f at t. glide = portamento time-constant (s) */
  note(t, f, { glide = 0.012, vel = 1, vib = 1, accent = 0.25 } = {}) {
    t = this._t(t);
    const def = this.def;
    for (const o of this.oscs) {
      if (!this.cur || this.silent) {
        o.frequency.setValueAtTime(glide > 0.03 && this.cur ? this.cur : f, t);
        if (glide > 0.03 && this.cur) o.frequency.setTargetAtTime(f, t, glide);
      } else o.frequency.setTargetAtTime(f, t, glide);
    }
    if (this.nf && def.noise.track) {
      if (this.silent) this.nf.frequency.setValueAtTime(f * def.noise.track, t);
      else this.nf.frequency.setTargetAtTime(f * def.noise.track, t, glide);
    }
    const L = def.level * vel;
    const g = this.amp.gain;
    g.setTargetAtTime(L * (1 + accent), t, this.silent ? def.attack / 2.5 : 0.008);
    g.setTargetAtTime(L, t + 0.06, 0.09);
    const vd = this.vib.gain;
    vd.setTargetAtTime(def.vib.depth * 0.2 * vib, t, 0.02);
    vd.setTargetAtTime(def.vib.depth * vib, t + 0.14, 0.18);
    this.cur = f;
    this.silent = false;
  }

  /** fast alternation between two pitches (trill / ornament) */
  trill(t, f1, f2, dur, rate = 13, vel = 1) {
    this.note(t, f1, { vel, accent: 0.2, vib: 0.3 });
    const n = Math.max(2, Math.floor(dur * rate));
    let f = f1;
    for (let i = 1; i < n; i++) {
      const tt = this._t(t + i / rate);
      f = i % 2 ? f2 : f1;
      for (const o of this.oscs) o.frequency.setTargetAtTime(f, tt, 0.006);
    }
    this.cur = f;
  }

  rest(t, tc = 0.025) {
    t = this._t(t);
    this.amp.gain.setTargetAtTime(0, t, tc);
    this.silent = true;
  }

  stop(t, fade = 0.08) {
    t = Math.max(t, this.last + 0.003);
    holdAt(this.amp.gain, t);
    this.amp.gain.setTargetAtTime(0, t, fade / 3);
    this.shot.end(t + fade * 2 + 0.1);
  }
  kill(now) {
    this.shot.kill(now);
  }
}

/** One short note on a lead instrument (prop clicks). */
export function leadNote(ctx, dest, kind, t, f, dur, { vol = 1, pan = 0, scoop = 0 } = {}) {
  const v = new LeadVoice(ctx, dest, kind, t, { pan, vol });
  if (scoop) {
    v.note(t, f * scoop, { accent: 0.2 });
    v.note(t + 0.045, f, { glide: 0.02, accent: 0.1 });
  } else v.note(t, f, { accent: 0.35 });
  v.rest(t + dur, 0.05);
  v.shot.end(t + dur + 0.35);
  return v.shot;
}

/** แคน khaen: free reeds — melody note(s) over drones, bellows tremolo */
export function khaen(ctx, dest, t, freqs, dur, { vol = 1, pan = 0 } = {}) {
  const s = new Shot(ctx, dest, { pan, vol, t });
  const bus = s.gain(0.3 / Math.sqrt(freqs.length));
  const pk = s.filter('peaking', 1250, 1.1, 5);
  const lp = s.filter('lowpass', 2700, 0.7);
  const env = s.gain(0);
  const trem = s.gain(1);
  bus.connect(pk);
  pk.connect(lp);
  lp.connect(env);
  env.connect(trem);
  trem.connect(s.out);
  const lfo = s.osc('sine', 4.4 + Math.random() * 0.6, t);
  const lg = s.gain(0.12);
  lfo.connect(lg);
  lg.connect(trem.gain);
  for (const f of freqs) {
    for (const [type, g, det] of [['square', 0.55, 3], ['sawtooth', 0.4, -3]]) {
      const o = s.osc(type, f * 0.985, t);
      o.detune.value = det;
      o.frequency.setTargetAtTime(f, t, 0.035);
      const og = s.gain(g);
      o.connect(og);
      og.connect(bus);
    }
  }
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1, t + 0.05);
  env.gain.setTargetAtTime(0.85, t + 0.05, 0.2);
  env.gain.setTargetAtTime(0, t + dur, 0.07);
  s.end(t + dur + 0.45);
  return s;
}

/** Soft sustained pad: detuned triangles + sines, slow filter breathing. */
export class Drone {
  constructor(ctx, dest, t, freqs, { vol = 1, bright = 700, fadeIn = 3 } = {}) {
    const s = (this.shot = new Shot(ctx, dest, { vol, t }));
    this.env = s.gain(0);
    const lp = s.filter('lowpass', bright, 0.6);
    const lfo = s.osc('sine', 0.06 + Math.random() * 0.03, t);
    const lg = s.gain(bright * 0.45);
    lfo.connect(lg);
    lg.connect(lp.frequency);
    lp.connect(this.env);
    this.env.connect(s.out);
    freqs.forEach((f, i) => {
      for (const [type, det, g] of [['triangle', -5, 0.5], ['triangle', 5, 0.5], ['sine', 1200, 0.18]]) {
        const o = s.osc(type, f, t);
        o.detune.value = det + (Math.random() - 0.5) * 3;
        const og = s.gain((g * 0.35) / (1 + i * 0.5));
        o.connect(og);
        og.connect(lp);
      }
    });
    this.env.gain.setValueAtTime(0, t);
    this.env.gain.linearRampToValueAtTime(1, t + fadeIn);
  }
  stop(t, fade = 2) {
    holdAt(this.env.gain, t);
    this.env.gain.setTargetAtTime(0, t, fade / 3);
    this.shot.end(t + fade * 1.6);
  }
}
