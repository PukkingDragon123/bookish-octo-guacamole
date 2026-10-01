// เทวดา–นางฟ้า ชมการแสดง — the heavenly audience. Rows of small devas
// kneel on paper-cut Thai clouds in the band of heaven above the booth
// roof, watching the show: they sway and breathe, some wave jasmine
// garlands (มาลัย) or gilded fans (พัด), and when the show gets exciting
// (hits, dances, rallies) they bounce, raise their hands and shower the
// stage with flower petals (ดอกไม้ทิพย์).
//
//   const crowd = new HeavenCrowd();
//   crowd.update(dt, excitement);   // excitement 0..1, may spike
//   crowd.draw(ctx, cam);           // on the back canvas, after the night layer
//
// Cost: each figure is drawDeva() pre-rendered once per (pose, palette)
// into a small canvas (10 canvases, ~250 px), so a frame is one
// drawImage per visible deva plus a few garland/fan strokes and the
// petal particles. Clouds are pre-rendered paper-cut banks.

import { drawDeva } from './deva.js';
import { assemble, drawRig, rigBounds } from '../puppet/rig.js';
import { makeCanvas, rng, thaiCloud } from './paint.js';
import { paperize } from './sky.js';

const TAU = Math.PI * 2;
const PARALLAX = 0.9;
const BOX = [-64, -74, 48, 40]; // deva-local bounds of a pre-rendered figure (with its cloud)
const RES = 3; // canvas px per deva unit
const HUES = 5;
// gesture (raised) hand of the 'kneel' pose and its shoulder, deva units
const SL = [1.1, -14.6], GHAND = [-5.3, -20.5];

const PETAL_COLS = ['#f6a9b8', '#f3cf6a', '#fff4e2', '#e8653c', '#f8e6a0', '#d9737f'];

// [y of the figures' base, scale, x ranges, step]
// The front row kneels just above the roof ridge (y ~ -431) either side of
// the gable; the middle row sits on the seam where heaven meets the night
// sky (~ -700) and runs right across above the gable peak (~ -850).
const ROWS = [
  { y: -985, s: 1.9, xs: [[-520, 2120]], step: 180 },
  { y: -770, s: 2.2, xs: [[-700, 2300]], step: 214, bankXs: [[-1600, 3200]] },
  { y: -545, s: 2.5, xs: [[-660, 200], [1400, 2260]], step: 240 },
];

export class HeavenCrowd {
  constructor({ seed = 33 } = {}) {
    this.t = 0;
    this.ex = 0;        // smoothed excitement
    this.exIn = 0;      // last raw input (to detect spikes)
    this.petals = [];
    this.sprites = null;
    this.banks = null;
    const r = rng(seed);
    this.rows = ROWS.map((R, ri) => {
      const devas = [];
      for (const [a, b] of R.xs) {
        for (let x = a; x <= b + 1; x += R.step) {
          const kind = r();
          devas.push({
            x: x + (r() - 0.5) * R.step * 0.3,
            y: R.y + (r() - 0.5) * 18,
            s: R.s * (0.92 + r() * 0.16),
            hue: Math.floor(r() * HUES),
            face: x + R.step * 0.2 < 800 ? 1 : -1, // everyone faces the screen
            pose: kind < 0.3 ? 'wai' : 'kneel',
            prop: kind < 0.3 ? null : kind < 0.55 ? 'garland' : kind < 0.75 ? 'fan' : 'petals',
            ph: r() * TAU,
            thr: 0.12 + r() * 0.55,   // how excited before this one cheers
            cheer: 0,                 // 0..1 eased cheering amount
            hop: r() * TAU,
            toss: r() * 2,
            row: ri,
          });
        }
      }
      devas.sort((p, q) => p.x - q.x);
      const banks = [];
      for (const [a, b] of R.bankXs || R.xs) for (let x = a - 100; x <= b + 140; x += 250 + r() * 90) banks.push({ x, y: R.y + 34 * R.s + (r() - 0.5) * 16, k: (r() * 4) | 0, s: R.s * (0.85 + r() * 0.3), f: r() < 0.5 ? -1 : 1 });
      return { ...R, devas, banks };
    });
  }

  // The audience can be made of the show's own leather puppets: each one
  // cut out and lit from behind with a warm halo, seated in the clouds.
  usePuppets(rigs) {
    this.rigs = (rigs || []).filter((r) => r && r.parts);
    this.puppetSprites = null;
  }

  _buildPuppets() {
    this.puppetSprites = [];
    const H = 150, R = 2.2; // figure height in crowd units, px per unit
    for (const rig of this.rigs) {
      try {
        const T = assemble(rig);
        const b = rigBounds(rig, T);
        const k = (H / b.h) * R;
        const pad = 18 * R;
        const c = makeCanvas(Math.ceil(b.w * k + pad * 2), Math.ceil(b.h * k + pad * 2));
        const g = c.getContext('2d');
        // halo of lamplight behind the hide
        g.save();
        g.translate(pad - b.x0 * k, pad - b.y0 * k);
        g.scale(k, k);
        g.shadowColor = 'rgba(255,205,120,0.85)';
        g.shadowBlur = 14 * R;
        drawRig(g, rig, T);
        g.restore();
        g.save();
        g.translate(pad - b.x0 * k, pad - b.y0 * k);
        g.scale(k, k);
        drawRig(g, rig, T);
        g.restore();
        this.puppetSprites.push({ c, w: c.width / R, h: c.height / R, face: rig.kind === 'demon' ? -1 : 1 });
      } catch (e) { /* skip a rig that can't draw */ }
    }
  }

  // ------------------------------------------------------------ assets
  _build() {
    this.sprites = {};
    const [x0, y0, x1, y1] = BOX;
    for (const pose of ['kneel', 'wai']) {
      for (let h = 0; h < HUES; h++) {
        const c = makeCanvas((x1 - x0) * RES, (y1 - y0) * RES);
        const g = c.getContext('2d');
        g.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES);
        const t = 0.7 + h * 1.9 + (pose === 'wai' ? 0.8 : 0);
        drawDeva(g, { t, face: 1, flap: 0.12, pose, hue: h, cloud: true });
        this.sprites[pose + h] = { c, t };
      }
    }
    // paper-cut cloud banks the rows kneel along
    this.banks = [];
    const W = 620, H = 150, k = 0.45;
    for (let i = 0; i < 4; i++) {
      const c = makeCanvas((W + 160) * k, (H + 130) * k);
      const g = c.getContext('2d');
      g.scale(k, k);
      for (let j = 0; j < 3; j++) {
        thaiCloud(g, (W + 160) / 2 + (j - 1) * W * 0.3, (H + 130) / 2 + (j % 2) * 16, W * 0.5, H * 0.7, {
          seed: 70 + i * 11 + j, fill: '#fbf2dc', shade: '#d6b183', line: '#b0772c', glow: 'rgba(255,214,140,0.7)', lobes: 6,
        });
      }
      paperize(c, 0.35);
      this.banks.push({ c, w: W + 160, h: H + 130 });
    }
  }

  // ------------------------------------------------------------ update
  update(dt, excitement = 0) {
    dt = Math.min(0.05, Math.max(0, dt || 0));
    this.t += dt;
    const e = Math.max(0, Math.min(1, excitement || 0));
    // rise fast, settle slowly
    this.ex += (e - this.ex) * (1 - Math.exp(-dt * (e > this.ex ? 9 : 0.9)));
    const spike = e - this.exIn > 0.3;
    this.exIn = e;
    for (const row of this.rows) {
      for (const d of row.devas) {
        const want = this.ex > d.thr ? Math.min(1, (this.ex - d.thr) / 0.25 + 0.35) : 0;
        d.cheer += (want - d.cheer) * (1 - Math.exp(-dt * (want > d.cheer ? 6 : 1.5)));
        d.hop += dt * (5 + d.cheer * 4.5);
        // petal tossing
        const rate = (d.prop === 'petals' ? 2.4 : 0.9) * d.cheer * d.cheer + (d.prop === 'petals' ? 0.05 : 0);
        d.toss -= dt * rate;
        if (d.toss <= 0 || (spike && d.cheer > 0.1)) {
          d.toss = 0.6 + Math.random() * 1.2;
          this._toss(d, spike ? 7 : 3 + Math.round(d.cheer * 4));
        }
      }
    }
    // petals: thrown up, then flutter down
    const P = this.petals;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) { P[i] = P[P.length - 1]; P.pop(); continue; }
      p.vy += 70 * dt;
      p.vx *= Math.exp(-dt * 0.9);
      p.vy *= Math.exp(-dt * (p.vy > 0 ? 2.2 : 0.4));
      p.x += (p.vx + Math.sin(this.t * p.fw + p.ph) * 14) * dt;
      p.y += p.vy * dt;
      p.a += p.va * dt;
    }
  }

  _toss(d, n) {
    const [hx, hy] = this._hand(d);
    for (let k = 0; k < n && this.petals.length < 200; k++) {
      this.petals.push({
        x: hx, y: hy,
        vx: d.face * (30 + Math.random() * 90) + (Math.random() - 0.5) * 60,
        vy: -(70 + Math.random() * 110),
        a: Math.random() * TAU, va: (Math.random() - 0.5) * 8,
        fw: 1.5 + Math.random() * 2.5, ph: Math.random() * TAU,
        r: (2.2 + Math.random() * 2) * d.s, c: PETAL_COLS[(Math.random() * PETAL_COLS.length) | 0],
        flower: Math.random() < 0.2,
        life: 3 + Math.random() * 2.5, max: 5.5,
      });
    }
  }

  // world position of a deva's raised hand
  _hand(d) {
    const { bob, sway } = this._pose(d);
    const s = d.s;
    return [d.x + (GHAND[0] * Math.cos(sway) - GHAND[1] * Math.sin(sway)) * s * d.face, d.y + bob + (GHAND[0] * Math.sin(sway) * d.face + GHAND[1] * Math.cos(sway)) * s];
  }

  _pose(d) {
    const t = this.t, c = d.cheer;
    const idle = Math.sin(t * 0.9 + d.ph);
    const bob = -Math.abs(Math.sin(d.hop)) * c * 9 * d.s + Math.sin(t * 1.3 + d.ph) * 1.2 * d.s;
    const sway = idle * (0.025 + c * 0.04) + Math.sin(d.hop * 0.5) * c * 0.06;
    return { bob, sway };
  }

  // ------------------------------------------------------------ draw
  draw(ctx, cam) {
    if (!this.sprites) this._build();
    if (this.rigs && this.rigs.length && !this.puppetSprites) this._buildPuppets();
    cam.apply(ctx, PARALLAX);
    // visible rect in this layer's space
    const cx = (cam.x + cam.shakeX) * PARALLAX + 800 * (1 - PARALLAX);
    const cy = (cam.y + cam.shakeY) * PARALLAX + 470 * (1 - PARALLAX);
    const hw = cam.vw / 2 / cam.zoom + 80, hh = cam.vh / 2 / cam.zoom + 80;
    const vx0 = cx - hw, vx1 = cx + hw, vy0 = cy - hh, vy1 = cy + hh;
    const [bx0, by0, bx1, by1] = BOX;
    const t = this.t;
    ctx.save();
    for (const row of this.rows) {
      if (row.y + 100 * row.s < vy0 || row.y - 80 * row.s > vy1) continue;
      const banksFront = !!(this.puppetSprites && this.puppetSprites.length);
      const drawBanks = () => { for (const b of row.banks) {
        const B = this.banks[b.k];
        const w = B.w * b.s * 0.36, h = B.h * b.s * 0.36;
        if (b.x + w / 2 < vx0 || b.x - w / 2 > vx1) continue;
        const dx = Math.sin(t * 0.13 + b.x) * 6;
        ctx.save();
        ctx.translate(b.x + dx, b.y);
        ctx.scale(b.f, 1);
        ctx.drawImage(B.c, -w / 2, -h / 2, w, h);
        ctx.restore();
      } };
      if (!banksFront) drawBanks();
      // the devas
      for (const d of row.devas) {
        const s = d.s;
        if (d.x + bx1 * s < vx0 || d.x + bx0 * s > vx1) continue;
        const pose = d.cheer > 0.45 || d.prop ? 'kneel' : d.pose;
        const S = this.sprites[pose + d.hue];
        const { bob, sway } = this._pose(d);
        if (banksFront) {
          // a leather puppet of the troupe, seated in the cloud, on its rod
          const P = this.puppetSprites[(d.pi ??= Math.floor((d.ph / TAU) * 997) % this.puppetSprites.length)];
          const ps = s * 0.62;
          ctx.save();
          ctx.translate(d.x, d.y + 40 * s + bob);
          ctx.rotate(sway * d.face * 1.4);
          ctx.scale(ps * d.face * P.face, ps * (1 + Math.sin(d.hop * 2) * d.cheer * 0.03));
          ctx.drawImage(P.c, -P.w / 2, -P.h * 0.86, P.w, P.h);
          ctx.strokeStyle = 'rgba(40,24,10,0.75)';
          ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.moveTo(0, -P.h * 0.45); ctx.lineTo(4, P.h * 0.1); ctx.stroke();
          ctx.restore();
          continue;
        }
        ctx.save();
        ctx.translate(d.x, d.y + 30 * s);
        ctx.rotate(sway * d.face);
        ctx.translate(0, -30 * s + bob);
        ctx.scale(s * d.face, s * (1 + Math.sin(d.hop * 2) * d.cheer * 0.02));
        ctx.drawImage(S.c, bx0, by0, bx1 - bx0, by1 - by0);
        if (pose === 'kneel') this._prop(ctx, d, t);
        ctx.restore();
      }
      if (banksFront) drawBanks();
    }
    // petals in front of everything
    const m = ctx.getTransform();
    for (const p of this.petals) {
      if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
      ctx.globalAlpha = Math.min(1, p.life / 0.8);
      ctx.fillStyle = p.c;
      const c = Math.cos(p.a), si = Math.sin(p.a), f = 0.45 + 0.55 * Math.abs(Math.sin(t * p.fw * 2 + p.ph));
      ctx.setTransform(m.a * c + m.c * si, m.b * c + m.d * si, (-m.a * si + m.c * c) * f, (-m.b * si + m.d * c) * f, m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f);
      ctx.beginPath();
      if (p.flower) {
        for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU, ex = Math.cos(a) * p.r * 0.8, ey = Math.sin(a) * p.r * 0.8; ctx.moveTo(ex + Math.cos(a) * p.r * 0.75, ey + Math.sin(a) * p.r * 0.75); ctx.ellipse(ex, ey, p.r * 0.75, p.r * 0.45, a, 0, TAU); }
      } else ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, TAU);
      ctx.fill();
    }
    ctx.setTransform(m);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // garland / fan in the raised hand (deva-local units, face +1)
  _prop(ctx, d, t) {
    if (!d.prop || d.prop === 'petals') {
      if (d.cheer > 0.3) {
        // a little burst of light at the open hand
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,230,160,${0.25 * d.cheer})`;
        ctx.beginPath(); ctx.arc(GHAND[0], GHAND[1] - 2, 5, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      return;
    }
    const c = d.cheer;
    // the raised arm swings a little more when cheering
    const wave = Math.sin(t * (2 + c * 5) + d.ph) * (0.12 + c * 0.45);
    ctx.save();
    ctx.translate(GHAND[0], GHAND[1]);
    ctx.lineCap = 'round';
    if (d.prop === 'garland') {
      // มาลัย: a jasmine loop with a rose and a red tassel, swinging
      ctx.rotate(wave * 0.8);
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * TAU;
        pts.push([Math.sin(a) * 4.6, (1 - Math.cos(a)) * 6.4]);
      }
      ctx.strokeStyle = '#2f6d31'; ctx.lineWidth = 1.6;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.fillStyle = '#fff8ea';
      for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(x, y, 1.05, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#c8243a';
      ctx.beginPath(); ctx.arc(0, 12.8, 2, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#e2b54c'; ctx.lineWidth = 0.5; ctx.stroke();
      ctx.strokeStyle = '#c8243a'; ctx.lineWidth = 1.1;
      const sw = Math.sin(t * 4 + d.ph) * 2;
      for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(k * 0.8, 14); ctx.quadraticCurveTo(k * 1.2 + sw * 0.5, 17, k * 1.4 + sw, 20); ctx.stroke(); }
    } else {
      // พัด: a round gilded fan on a slim handle
      ctx.rotate(-0.25 + wave);
      ctx.strokeStyle = '#6e3f0c'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(0, -8); ctx.stroke();
      const g = ctx.createRadialGradient(-1, -13, 0.5, 0, -12, 6.5);
      g.addColorStop(0, '#fff0b8'); g.addColorStop(0.6, '#e0b04c'); g.addColorStop(1, '#9b6520');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, -12.5, 5.2, 6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#5a310b'; ctx.lineWidth = 0.45; ctx.stroke();
      ctx.fillStyle = d.hue % 2 ? '#a9261b' : '#236249';
      ctx.beginPath(); ctx.ellipse(0, -12.5, 2.6, 3, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#f3d27a'; ctx.lineWidth = 0.35;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 2.8, -12.5 + Math.sin(a) * 3.2); ctx.lineTo(Math.cos(a) * 4.8, -12.5 + Math.sin(a) * 5.6); ctx.stroke(); }
    }
    ctx.restore();
    void SL;
  }
}
