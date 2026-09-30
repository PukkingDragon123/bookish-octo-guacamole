// Stage effects painted onto the screen as moving "shadow gels": fire,
// smoke, water, fountains, rain, wind-blown leaves, floods, lightning,
// earthquakes and the colour of the day. Everything is drawn into one
// cloth-sized canvas each frame and multiplied in with the shadows, so it
// behaves exactly like cut hide and dyed film held against the lamp.

import { Sprite, makeCanvas } from '../art/leather.js';
import { FLOOR } from '../scene/scene.js';

const W = 1600, H = 1000, K = 0.5; // canvas is half-resolution

export const WEATHER = ['rain', 'storm', 'wind', 'flood', 'quake', 'dusk', 'night', 'dawn'];

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.canvas = makeCanvas(W * K, H * K);
    this.ctx = this.canvas.getContext('2d');
    this.sprite = new Sprite(this.canvas, 1 / K, { name: 'fx' });
    this.sprite.dynamic = true;
    this.p = [];
    this.weather = new Set();
    this.flood = 0;       // 0..1 water level
    this.flash = 0;       // lightning flash
    this.nextBolt = 3;
    this.bolt = null;
    this.t = 0;
    this.baseLamp = null;
  }

  toggle(w) {
    if (this.weather.has(w)) this.weather.delete(w);
    else {
      if (['dusk', 'night', 'dawn'].includes(w)) ['dusk', 'night', 'dawn'].forEach((x) => this.weather.delete(x));
      this.weather.add(w);
    }
    return this.weather.has(w);
  }

  _emit(o) { if (this.p.length < 1400) this.p.push(o); }
  // public: other systems (wounds, magic, building) add gel particles here
  emit(o) { if (this.p.length < 1600) this.p.push({ t: 0, vx: 0, vy: 0, ...o }); }

  update(dt) {
    this.t += dt;
    const S = this.scene, W_ = this.weather;
    // emitters carried by props (fire, torch, smoke, fountain, sparkle)
    for (const a of S.actors) {
      const fx = a.def && a.def.fx;
      if (!fx) continue;
      const b = a.root;
      const sp = a.def.sprite;
      const pt = a.def.fxAt ? sp.local(a.def.fxAt) : [sp.w / 2, sp.h * 0.3];
      const [wx, wy] = b.toWorld(pt[0] - b.com[0], pt[1] - b.com[1]);
      const [cx, cy, s] = S.project(wx, wy, b.z);
      const rate = dt * 60;
      if (fx === 'fire') {
        for (let i = 0; i < 2 * rate; i++) this._emit({ k: 'flame', x: cx + (Math.random() - 0.5) * 34 * s, y: cy, vx: (Math.random() - 0.5) * 30, vy: -90 - Math.random() * 90, r: (14 + Math.random() * 14) * s, t: 0, life: 0.5 + Math.random() * 0.4 });
        if (Math.random() < 0.4 * rate) this._emit({ k: 'smoke', x: cx, y: cy - 40 * s, vx: (Math.random() - 0.5) * 20, vy: -50, r: 18 * s, t: 0, life: 2.5 });
        if (Math.random() < 0.15 * rate) this._emit({ k: 'ember', x: cx, y: cy, vx: (Math.random() - 0.5) * 80, vy: -160 - Math.random() * 120, r: 2.2 * s, t: 0, life: 1.2 });
      } else if (fx === 'smoke') {
        if (Math.random() < 0.5 * rate) this._emit({ k: 'smoke', x: cx + (Math.random() - 0.5) * 6, y: cy, vx: Math.sin(this.t) * 10, vy: -40, r: 8 * s, t: 0, life: 3.5, curl: Math.random() * 6 });
      } else if (fx === 'fountain') {
        for (let i = 0; i < 3 * rate; i++) this._emit({ k: 'drop', x: cx, y: cy, vx: (Math.random() - 0.5) * 160, vy: -380 - Math.random() * 120, r: 3 * s, t: 0, life: 1.6, g: 700 });
      } else if (fx === 'sparkle') {
        if (Math.random() < 0.6 * rate) { const a2 = Math.random() * 6.28, rr = Math.random() * 60 * s; this._emit({ k: 'spark', x: cx + Math.cos(a2) * rr, y: cy + Math.sin(a2) * rr, vx: 0, vy: -20, r: 4 * s, t: 0, life: 1 }); }
      }
    }
    // weather
    const wind = W_.has('wind') || W_.has('storm') ? 1 : 0;
    if (W_.has('rain') || W_.has('storm')) {
      const n = (W_.has('storm') ? 9 : 5) * dt * 60;
      for (let i = 0; i < n; i++) this._emit({ k: 'rain', x: Math.random() * (W + 400) - 200, y: -20, vx: 120 + wind * 260, vy: 1300 + Math.random() * 300, r: 1, t: 0, life: 1.2 });
    }
    if (wind && Math.random() < dt * 8) this._emit({ k: 'leaf', x: -30, y: 100 + Math.random() * 700, vx: 300 + Math.random() * 200, vy: 20, r: 7 + Math.random() * 5, t: 0, life: 7, spin: Math.random() * 6 });
    S.membrane.wind = 1 + wind * 4;
    this.flood += ((W_.has('flood') ? 1 : 0) - this.flood) * Math.min(1, dt * 0.25);
    // lightning
    this.flash *= Math.exp(-dt * 7);
    if (W_.has('storm')) {
      this.nextBolt -= dt;
      if (this.nextBolt < 0) {
        this.nextBolt = 2.5 + Math.random() * 5;
        this.flash = 1;
        this.bolt = { x: 200 + Math.random() * 1200, t: 0, seed: Math.random() };
        this.onThunder && this.onThunder();
      }
    }
    if (this.bolt) { this.bolt.t += dt; if (this.bolt.t > 0.35) this.bolt = null; }
    if (W_.has('quake')) {
      for (const a of S.actors) for (const b of a.parts || []) if (b.invMass) b.vx += Math.sin(this.t * 40) * 40;
      S.membrane.poke(Math.random() * W, Math.random() * H, 200, 25);
      this.shake = 8;
    } else this.shake = 0;
    // floating props rise with the flood
    const lvl = this.waterLevel();
    for (const a of S.actors) if (a.float && a.floatPin) {
      const [, wy] = S.unproject(0, lvl - 20, a.z);
      if (this.flood > 0.05) a.float.y = Math.min(a.float.base ?? (a.float.base = a.float.y), wy);
      else if (a.float.base != null) { a.float.y = a.float.base; a.float.base = null; }
    }
    // particles
    const sx = S.lamp.sx || 0;
    let pools = 0;
    for (const q of this.p) {
      q.t += dt;
      if (q.k === 'blood' || q.k === 'tear') {
        if (q.fy != null && q.y >= q.fy && q.vy > 0) {
          q.t = q.life;
          if (q.k === 'blood') {
            this.emit({ k: 'pool', x: q.x, y: q.fy + (Math.random() - 0.5) * 3, r: 2 + q.r * 0.8, rm: q.r * (2.4 + Math.random() * 2.4), life: 28 + Math.random() * 10, wx: q.x + sx });
            if (q.r > 2.4 && Math.random() < 0.5) for (let i = 0; i < 2; i++) this.emit({ k: 'blood', x: q.x, y: q.fy - 1, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80, g: 1500, r: q.r * 0.35, life: 0.6, fy: q.fy });
          }
          continue;
        }
      } else if (q.k === 'pool') {
        pools++;
        q.r = Math.min(q.rm, q.r + dt * 3.5);
        q.x = q.wx - sx;
      } else if (q.k === 'wisp') {
        q.vx = Math.sin(this.t * 2.2 + (q.spin || 0)) * 30;
        q.r += dt * 5;
      } else if (q.k === 'chip') {
        q.spin = (q.spin || 0) + dt * 12;
        if (q.fy != null && q.y > q.fy) { q.y = q.fy; q.vy *= -0.3; q.vx *= 0.5; }
      }
      q.x += (q.vx + (q.k === 'smoke' || q.k === 'leaf' ? wind * 120 : 0)) * dt;
      q.y += q.vy * dt;
      if (q.g) q.vy += q.g * dt;
      if (q.k === 'flame') { q.vy *= 0.98; q.r *= 0.985; }
      if (q.k === 'smoke') { q.r += dt * 16; q.vx += Math.sin(this.t * 1.3 + (q.curl || 0)) * 6 * dt; }
      if (q.k === 'leaf') { q.vy = Math.sin(this.t * 2 + q.spin) * 60; }
      if (q.k === 'rain' && q.y > FLOOR + 30) { q.t = q.life; this._emit({ k: 'splash', x: q.x, y: FLOOR + 30, vx: 0, vy: 0, r: 5, t: 0, life: 0.2 }); }
    }
    this.p = this.p.filter((q) => q.t < q.life && q.x > -300 && q.x < W + 300 && q.y < H + 60);
    if (pools > 260) { let n = pools - 260; this.p = this.p.filter((q) => !(q.k === 'pool' && n-- > 0)); }
    this._lampTint(dt);
  }

  waterLevel() { return FLOOR + 40 - this.flood * 420; }

  _lampTint(dt) {
    const L = this.scene.lamp;
    if (!this.baseLamp) this.baseLamp = L.color.slice();
    const W_ = this.weather;
    const tgt = W_.has('night') ? [0.55, 0.62, 1.0] : W_.has('dusk') ? [1.0, 0.55, 0.42] : W_.has('dawn') ? [1.0, 0.78, 0.7] : L.kind === 'oil' ? [1.0, 0.8, 0.52] : [1, 0.93, 0.8];
    for (let i = 0; i < 3; i++) L.color[i] += (tgt[i] - L.color[i]) * Math.min(1, dt * 1.5);
    L.fxBoost = this.flash * 1.6;
  }

  // Repaint the gel canvas; returns the shadow-pass item.
  snapshot() {
    return { p: this.p.map((q) => ({ k: q.k, x: q.x, y: q.y, r: q.r, t: q.t, life: q.life, vx: q.vx, vy: q.vy, spin: q.spin, h: q.h })), flood: this.flood, bolt: this.bolt && { ...this.bolt }, t: this.t, level: this.waterLevel(), wards: (this.wards || []).map((w) => ({ ...w })) };
  }

  render(state = null) {
    const S = state || { p: this.p, flood: this.flood, bolt: this.bolt, t: this.t, level: this.waterLevel(), wards: this.wards };
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(K, 0, 0, K, 0, 0);
    const t = S.t;
    // flood water
    if (S.flood > 0.01) {
      const lvl = S.level;
      g.fillStyle = 'rgba(70,120,190,0.62)';
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) g.lineTo(x, lvl + Math.sin(x * 0.015 + t * 2) * 10 + Math.sin(x * 0.041 - t * 3) * 5);
      g.lineTo(W, H);
      g.fill();
      g.strokeStyle = 'rgba(20,40,80,0.8)';
      g.lineWidth = 5;
      for (let row = 0; row < 4; row++) {
        g.beginPath();
        for (let x = 0; x <= W; x += 20) {
          const y = lvl + 30 + row * 55 + Math.sin(x * 0.02 + t * (1.5 + row * 0.3) + row) * 8;
          x ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
      }
    }
    // blood pools under everything else
    for (const q of S.p) {
      if (q.k !== 'pool') continue;
      const u = q.t / q.life;
      const a = Math.min(1, (1 - u) * 3) * 0.72;
      g.fillStyle = `rgba(92,0,6,${a})`;
      g.beginPath(); g.ellipse(q.x, q.y, q.r, q.r * 0.3, 0, 0, 7); g.fill();
    }
    for (const w of S.wards || []) drawWard(g, w, t);
    for (const q of S.p) {
      const u = q.t / q.life;
      if (q.k === 'pool') continue;
      if (q.k === 'blood') {
        const sp = Math.hypot(q.vx, q.vy), len = q.r * (1 + Math.min(3, sp * 0.004));
        g.save(); g.translate(q.x, q.y); g.rotate(Math.atan2(q.vy, q.vx));
        g.fillStyle = `rgba(118,0,8,${0.92 * Math.min(1, (1 - u) * 4)})`;
        g.beginPath(); g.ellipse(0, 0, len, q.r, 0, 0, 7); g.fill();
        g.restore();
      } else if (q.k === 'tear') {
        g.fillStyle = `rgba(80,130,215,${0.85 * (1 - u * 0.5)})`;
        g.beginPath(); g.moveTo(q.x, q.y - q.r * 2.2); g.quadraticCurveTo(q.x + q.r, q.y, q.x, q.y + q.r); g.quadraticCurveTo(q.x - q.r, q.y, q.x, q.y - q.r * 2.2); g.fill();
      } else if (q.k === 'wisp') {
        const a = Math.sin(Math.PI * u) * 0.55;
        const gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r);
        gr.addColorStop(0, `rgba(150,190,255,${a})`); gr.addColorStop(1, 'rgba(150,190,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(q.x, q.y, q.r, 0, 7); g.fill();
      } else if (q.k === 'gold' || q.k === 'heal' || q.k === 'violet') {
        const c = q.k === 'gold' ? '235,180,60' : q.k === 'heal' ? '110,210,130' : '170,90,220';
        g.fillStyle = `rgba(${c},${Math.min(1, (1 - u) * 1.5)})`;
        const r = q.r * (1 - u * 0.4);
        g.beginPath(); g.moveTo(q.x, q.y - r * 2); g.lineTo(q.x + r * 0.5, q.y); g.lineTo(q.x, q.y + r * 2); g.lineTo(q.x - r * 0.5, q.y); g.closePath();
        g.moveTo(q.x - r * 2, q.y); g.lineTo(q.x, q.y + r * 0.5); g.lineTo(q.x + r * 2, q.y); g.lineTo(q.x, q.y - r * 0.5); g.closePath();
        g.fill();
      } else if (q.k === 'beam') {
        const a = Math.sin(Math.PI * Math.min(1, u * 1.2)) * 0.6;
        const w = q.r * (0.6 + 0.4 * Math.sin(Math.PI * u));
        const gr = g.createLinearGradient(q.x - w, 0, q.x + w, 0);
        const c = q.h === 'violet' ? '150,80,210' : '255,205,110';
        gr.addColorStop(0, `rgba(${c},0)`); gr.addColorStop(0.5, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr; g.fillRect(q.x - w, -40, w * 2, q.y + 40);
      } else if (q.k === 'ring') {
        const a = (1 - u) * 0.8, r = q.r * (0.3 + u * 0.9);
        g.strokeStyle = q.h === 'violet' ? `rgba(120,50,170,${a})` : `rgba(200,140,40,${a})`;
        g.lineWidth = 5;
        g.beginPath(); g.ellipse(q.x, q.y, r, r * 0.26, 0, 0, 7); g.stroke();
        g.lineWidth = 3;
        for (let i = 0; i < 12; i++) {
          const an = (i / 12) * Math.PI * 2 + t * 1.5, c2 = Math.cos(an), s2 = Math.sin(an);
          g.beginPath(); g.moveTo(q.x + c2 * r * 0.8, q.y + s2 * r * 0.21); g.lineTo(q.x + c2 * r * 1.12, q.y + s2 * r * 0.29); g.stroke();
        }
      } else if (q.k === 'dust') {
        g.fillStyle = `rgba(120,95,70,${0.35 * (1 - u) * Math.min(1, u * 8)})`;
        g.beginPath(); g.arc(q.x, q.y, q.r * (1 + u * 1.5), 0, 7); g.fill();
      } else if (q.k === 'chip') {
        g.save(); g.translate(q.x, q.y); g.rotate(q.spin || 0);
        g.fillStyle = `rgba(40,25,12,${Math.min(1, (1 - u) * 3)})`;
        g.fillRect(-q.r, -q.r * 0.3, q.r * 2, q.r * 0.6);
        g.restore();
      } else if (q.k === 'flame') {
        const col = u < 0.3 ? '255,220,120' : u < 0.6 ? '240,120,40' : '170,40,20';
        g.fillStyle = `rgba(${col},${0.75 * (1 - u)})`;
        g.beginPath();
        g.moveTo(q.x - q.r * 0.6, q.y);
        g.quadraticCurveTo(q.x - q.r * 0.4, q.y - q.r * 1.4, q.x + Math.sin(t * 20 + q.x) * q.r * 0.3, q.y - q.r * 2.2);
        g.quadraticCurveTo(q.x + q.r * 0.5, q.y - q.r * 1.2, q.x + q.r * 0.6, q.y);
        g.fill();
      } else if (q.k === 'smoke') {
        g.fillStyle = `rgba(90,85,80,${0.32 * (1 - u) * Math.min(1, u * 6)})`;
        g.beginPath(); g.arc(q.x, q.y, q.r, 0, 7); g.fill();
      } else if (q.k === 'ember' || q.k === 'spark') {
        g.fillStyle = q.k === 'ember' ? `rgba(200,60,20,${1 - u})` : `rgba(230,170,60,${1 - u})`;
        g.beginPath(); g.arc(q.x, q.y, q.r, 0, 7); g.fill();
      } else if (q.k === 'drop') {
        g.fillStyle = `rgba(60,110,190,${0.8 * (1 - u)})`;
        g.beginPath(); g.arc(q.x, q.y, q.r, 0, 7); g.fill();
      } else if (q.k === 'rain') {
        g.strokeStyle = 'rgba(40,60,100,0.45)';
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); g.stroke();
      } else if (q.k === 'splash') {
        g.strokeStyle = `rgba(40,60,100,${0.5 * (1 - u)})`;
        g.lineWidth = 2;
        g.beginPath(); g.arc(q.x, q.y, q.r * (1 + u * 2), Math.PI, 0); g.stroke();
      } else if (q.k === 'leaf') {
        g.save();
        g.translate(q.x, q.y); g.rotate(t * 3 + q.spin);
        g.fillStyle = 'rgba(30,40,20,0.85)';
        g.beginPath(); g.ellipse(0, 0, q.r, q.r * 0.45, 0, 0, 7); g.fill();
        g.restore();
      }
    }
    if (S.bolt) {
      const r = mulberry(S.bolt.seed);
      g.strokeStyle = `rgba(30,30,70,${1 - S.bolt.t / 0.35})`;
      g.lineWidth = 7;
      g.beginPath();
      let x = S.bolt.x, y = -10;
      g.moveTo(x, y);
      while (y < FLOOR) { x += (r() - 0.5) * 120; y += 50 + r() * 60; g.lineTo(x, y); }
      g.stroke();
    }
    return { sprite: this.sprite, m: [1, 0, 0, 1, 0, 0], z: 0.002 };
  }
}

// ลงยันต์: a slowly turning ring of sacred script around a warded figure
function drawWard(g, w, t) {
  const a = w.a;
  if (a <= 0.01) return;
  g.save();
  g.translate(w.x, w.y);
  g.rotate(t * 0.6);
  g.strokeStyle = `rgba(210,150,40,${0.45 * a})`;
  g.lineWidth = 2.5;
  g.setLineDash([2, 7]);
  g.beginPath(); g.arc(0, 0, w.r, 0, 7); g.stroke();
  g.setLineDash([]);
  g.beginPath(); g.arc(0, 0, w.r * 0.86, 0, 7); g.stroke();
  for (let i = 0; i < 8; i++) {
    g.rotate(Math.PI / 4);
    // unalom glyph
    g.beginPath();
    g.moveTo(0, -w.r * 0.9); g.lineTo(0, -w.r * 1.08);
    g.arc(-3, -w.r * 1.1, 3, 0, Math.PI * 1.6);
    g.stroke();
  }
  g.restore();
}

function mulberry(seed) {
  let a = (seed * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
