// The โขน dancer's hand cursor: a gilded celestial hand whose long
// fingers bend back gracefully at rest (the Thai dance hyper-extension),
// wearing jewelled rings, golden dance nails (เล็บ), stacked กำไล
// bracelets and a brocade sleeve with a กระจัง edge. The fingers curl
// shut when grabbing and mirror your real fingers when hand tracking.
// Golden strings run from its fingertips down to the puppet.
//
// The sleeve, bracelets and palm never change shape, so they are painted
// once into a cached sprite; only the five fingers are drawn per frame.

import { goldGrad } from './paint.js';

// finger layout in hand space (hand points up, palm facing viewer,
// thumb on the left). [baseX, baseY, len, spreadAngle, width, nail]
const FINGERS = [
  [-19.5, -15, 31, -0.86, 7.2, 11],  // thumb
  [-13.6, -39.5, 43, -0.15, 6.2, 15],
  [-3.6, -43.5, 47, -0.035, 6.4, 16],
  [6.6, -42, 44, 0.085, 6, 15],
  [15.6, -37.2, 35, 0.22, 5.2, 12],
];
const SEGS = [0.44, 0.31, 0.25];
const TAU = Math.PI * 2;
const INK = '#3e1f05';

// Catmull-Rom through pts (open) into a path.
function spline(p, pts, move = true) {
  const n = pts.length;
  if (move) p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  return p;
}
function closed(pts) {
  const p = new Path2D(), n = pts.length;
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  p.closePath();
  return p;
}
const openP = (pts) => spline(new Path2D(), pts);

// ---------------------------------------------------------------- sprite
// Sleeve + bracelets + palm, painted once per resolution bucket.
const SPR = { x0: -36, y0: -50, x1: 36, y1: 116 };
const sprites = new Map();
function handSprite(R) {
  let c = sprites.get(R);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = Math.ceil((SPR.x1 - SPR.x0) * R); c.height = Math.ceil((SPR.y1 - SPR.y0) * R);
  const g = c.getContext('2d');
  g.setTransform(R, 0, 0, R, -SPR.x0 * R, -SPR.y0 * R);
  g.lineJoin = 'round'; g.lineCap = 'round';
  paintSleeve(g);
  paintBracelets(g);
  paintPalm(g);
  sprites.set(R, c);
  return c;
}

function gem(g, x, y, r, col) {
  g.beginPath(); g.arc(x, y, r * 1.45, 0, TAU); g.fillStyle = '#f3d27a'; g.fill();
  g.lineWidth = 0.7; g.strokeStyle = INK; g.stroke();
  const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  rg.addColorStop(0, '#fff'); rg.addColorStop(0.25, col); rg.addColorStop(1, '#2a0804');
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = rg; g.fill();
}

// band across the wrist, bowed like a cylinder seen from slightly above
function bandPath(y0, y1, hw0, hw1, bow = 2.4) {
  const p = new Path2D();
  p.moveTo(-hw0, y0); p.quadraticCurveTo(0, y0 + bow * 2, hw0, y0);
  p.lineTo(hw1, y1); p.quadraticCurveTo(0, y1 + bow * 2, -hw1, y1);
  p.closePath();
  return p;
}
const bandY = (x, y, hw, bow = 2.4) => y + bow * (1 - (x / hw) * (x / hw));

function paintSleeve(g) {
  // brocade sleeve (ผ้ายก) rising to the heavens
  const sl = new Path2D();
  sl.moveTo(-21.5, 33); sl.quadraticCurveTo(0, 38, 21.5, 33);
  sl.lineTo(26, 116); sl.lineTo(-26, 116); sl.closePath();
  const bg = g.createLinearGradient(-26, 0, 26, 0);
  bg.addColorStop(0, '#3a0906'); bg.addColorStop(0.3, '#9b2317'); bg.addColorStop(0.55, '#b83322'); bg.addColorStop(1, '#420b07');
  g.fillStyle = bg; g.fill(sl);
  g.save(); g.clip(sl);
  // gold lattice with ดอกประจำยาม at the crossings
  g.strokeStyle = 'rgba(240,196,98,0.8)'; g.lineWidth = 0.8;
  for (let k = -12; k < 16; k++) {
    g.beginPath(); g.moveTo(-30 + k * 8, 30); g.lineTo(-30 + k * 8 + 90, 120); g.stroke();
    g.beginPath(); g.moveTo(30 - k * 8, 30); g.lineTo(30 - k * 8 - 90, 120); g.stroke();
  }
  for (let y = 42, r = 0; y < 118; y += 8, r++) {
    for (let x = -32 + (r % 2) * 4; x < 32; x += 8) {
      g.fillStyle = '#f2cf73';
      for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2; g.beginPath(); g.ellipse(x + Math.cos(a) * 1.3, y + Math.sin(a) * 1.3, 1.1, 0.7, a, 0, TAU); g.fill(); }
      g.fillStyle = r % 2 ? '#1f8a5a' : '#fff3c4'; g.beginPath(); g.arc(x, y, 0.75, 0, TAU); g.fill();
    }
  }
  // cylindrical shading
  const sh = g.createLinearGradient(-26, 0, 26, 0);
  sh.addColorStop(0, 'rgba(20,0,0,0.55)'); sh.addColorStop(0.35, 'rgba(0,0,0,0)'); sh.addColorStop(0.6, 'rgba(255,220,160,0.08)'); sh.addColorStop(1, 'rgba(20,0,0,0.6)');
  g.fillStyle = sh; g.fillRect(-27, 30, 54, 90);
  g.restore();
  g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke(sl);
  // cuff border: gold, green enamel, gems
  const cuff = bandPath(33, 43, 21.5, 22.6, 2.5);
  g.fillStyle = goldGrad(g, -22, 30, 22, 46); g.fill(cuff); g.lineWidth = 1; g.strokeStyle = INK; g.stroke(cuff);
  const en = bandPath(35.6, 40.4, 21.8, 22.3, 2.5);
  g.fillStyle = '#1d6b47'; g.fill(en); g.lineWidth = 0.6; g.stroke(en);
  for (let i = -3; i <= 3; i++) { const x = i * 6; gem(g, x, bandY(x, 38, 22) + 0.1, 1.25, i % 2 ? '#e0302a' : '#f4f0e0'); }
  // fade the sleeve into light further up
  g.save();
  g.globalCompositeOperation = 'destination-out';
  const fd = g.createLinearGradient(0, 70, 0, 116);
  fd.addColorStop(0, 'rgba(0,0,0,0)'); fd.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = fd; g.fillRect(-30, 60, 60, 58);
  g.restore();
  // กระจัง fringe hanging from the cuff over the bracelets
  for (let i = -5; i <= 5; i++) {
    const x = i * 3.9, y = bandY(x, 33, 21.5, 2.5) + 0.4;
    const p = new Path2D();
    p.moveTo(x - 2.1, y); p.quadraticCurveTo(x - 2, y - 2.6, x, y - 4.8); p.quadraticCurveTo(x + 2, y - 2.6, x + 2.1, y); p.closePath();
    g.fillStyle = goldGrad(g, x - 2, y - 5, x + 2, y); g.fill(p); g.lineWidth = 0.6; g.strokeStyle = INK; g.stroke(p);
    const q = new Path2D();
    q.moveTo(x - 0.9, y - 0.6); q.quadraticCurveTo(x - 0.8, y - 2, x, y - 3.2); q.quadraticCurveTo(x + 0.8, y - 2, x + 0.9, y - 0.6); q.closePath();
    g.fillStyle = '#b8261b'; g.fill(q);
  }
}

function paintBracelets(g) {
  // wrist under the bangles
  const wr = new Path2D();
  wr.moveTo(-15, 4); wr.lineTo(-16.5, 32); wr.lineTo(16.5, 32); wr.lineTo(15, 4); wr.closePath();
  g.fillStyle = goldGrad(g, -16, 0, 16, 30); g.fill(wr);
  // กำไล stack: twisted rope, jewelled band, bead row
  const hw = (y) => 16.2 + (y - 8) * 0.06;
  const rope = bandPath(25.5, 30.5, hw(25.5), hw(30.5), 2.2);
  g.fillStyle = goldGrad(g, -18, 24, 18, 32); g.fill(rope); g.lineWidth = 0.9; g.strokeStyle = INK; g.stroke(rope);
  g.save(); g.clip(rope); g.strokeStyle = 'rgba(80,40,6,0.75)'; g.lineWidth = 0.7;
  for (let x = -20; x < 20; x += 2.2) { g.beginPath(); g.moveTo(x, 34); g.lineTo(x + 5, 23); g.stroke(); }
  g.strokeStyle = 'rgba(255,245,200,0.6)'; g.lineWidth = 0.5;
  for (let x = -19.2; x < 20; x += 2.2) { g.beginPath(); g.moveTo(x, 34); g.lineTo(x + 5, 23); g.stroke(); }
  g.restore();
  const jb = bandPath(15.5, 24.5, hw(15.5), hw(24.5), 2.3);
  g.fillStyle = goldGrad(g, -18, 14, 18, 26); g.fill(jb); g.lineWidth = 1; g.strokeStyle = INK; g.stroke(jb);
  const red = bandPath(17.6, 22.4, hw(17.6) - 0.3, hw(22.4) - 0.3, 2.3);
  g.fillStyle = '#9e1f15'; g.fill(red); g.lineWidth = 0.5; g.stroke(red);
  for (let i = -3; i <= 3; i++) {
    const x = i * 4.6, y = bandY(x, 20, 16.8, 2.3);
    if (i % 2) gem(g, x, y, 1.45, '#1faa6a');
    else {
      g.fillStyle = '#f3d27a'; g.beginPath(); g.moveTo(x, y - 2.3); g.lineTo(x + 1.9, y); g.lineTo(x, y + 2.3); g.lineTo(x - 1.9, y); g.closePath(); g.fill(); g.lineWidth = 0.5; g.strokeStyle = INK; g.stroke();
      gem(g, x, y, 0.9, '#e0302a');
    }
  }
  // bead row
  for (let x = -15.5; x <= 15.6; x += 2.6) {
    const y = bandY(x, 12.2, 16.5, 2.3);
    g.beginPath(); g.arc(x, y, 1.45, 0, TAU); g.fillStyle = '#e9bd55'; g.fill(); g.lineWidth = 0.6; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.arc(x - 0.45, y - 0.5, 0.5, 0, TAU); g.fillStyle = '#fff8dc'; g.fill();
  }
}

function paintPalm(g) {
  const palm = closed([
    [-14.6, 9], [-19.5, -2], [-22.8, -14], [-22, -26], [-18.6, -37.5], [-11, -43.2], [-2, -45.5],
    [8, -44], [15.4, -39.8], [20.6, -33], [21.6, -20], [19.6, -6], [14.6, 9],
  ]);
  g.fillStyle = goldGrad(g, -24, -46, 22, 10); g.fill(palm);
  // hollow of the palm and the raised pads
  const hol = g.createRadialGradient(2, -18, 2, 2, -18, 20);
  hol.addColorStop(0, 'rgba(110,60,10,0.35)'); hol.addColorStop(1, 'rgba(110,60,10,0)');
  g.fillStyle = hol; g.fill(palm);
  const pad = g.createRadialGradient(-15, -12, 1, -15, -12, 10);
  pad.addColorStop(0, 'rgba(255,248,210,0.55)'); pad.addColorStop(1, 'rgba(255,248,210,0)');
  g.fillStyle = pad; g.fill(palm);
  g.lineWidth = 1.3; g.strokeStyle = INK; g.stroke(palm);
  // engraved lines: dark cut + bright lip
  const engrave = (pts, w = 0.9) => {
    const p = openP(pts);
    g.lineWidth = w; g.strokeStyle = 'rgba(70,34,4,0.8)'; g.stroke(p);
    g.save(); g.translate(0.45, 0.5); g.lineWidth = w * 0.6; g.strokeStyle = 'rgba(255,246,205,0.7)'; g.stroke(p); g.restore();
  };
  engrave([[-15, -33], [-12, -20], [-10.5, -8], [-6.5, 4]]);
  engrave([[19, -29], [9, -33], [0, -34.4], [-7, -36.6]]);
  engrave([[-15.6, -28.4], [-4, -24.5], [9, -20.5]], 0.75);
  engrave([[-12, 6.5], [0, 7.4], [12, 6.2]], 0.6);
  // knuckle pads
  for (const [x, y] of [[-13.5, -37], [-3.6, -40.6], [6.6, -39.4], [15, -35]]) engrave([[x - 3.2, y + 0.6], [x, y + 1.6], [x + 3.2, y + 0.6]], 0.6);
  // ประจำยาม flower with a ruby heart, and kranok sprigs
  const fx = 2, fy = -15;
  for (let q = 0; q < 4; q++) {
    const a = q * Math.PI / 2 + Math.PI / 4;
    const tip = [fx + Math.cos(a) * 6.4, fy + Math.sin(a) * 6.4];
    const l = [fx + Math.cos(a - 0.6) * 3.2, fy + Math.sin(a - 0.6) * 3.2], r = [fx + Math.cos(a + 0.6) * 3.2, fy + Math.sin(a + 0.6) * 3.2];
    const p = new Path2D(); p.moveTo(fx, fy); p.quadraticCurveTo(l[0], l[1], tip[0], tip[1]); p.quadraticCurveTo(r[0], r[1], fx, fy); p.closePath();
    g.fillStyle = q % 2 ? '#f7dc8a' : '#e8b84e'; g.fill(p); g.lineWidth = 0.6; g.strokeStyle = INK; g.stroke(p);
  }
  g.beginPath(); g.arc(fx, fy, 4.6, 0, TAU); g.lineWidth = 0.5; g.strokeStyle = 'rgba(70,34,4,0.6)'; g.stroke();
  gem(g, fx, fy, 1.9, '#d42a1c');
  for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2; gem(g, fx + Math.cos(a) * 4.4, fy + Math.sin(a) * 4.4, 0.55, '#1faa6a'); }
  engrave([[-5, -2], [-2.5, 0.5], [0.6, -0.2], [0.8, -2.4], [-0.6, -2.8]], 0.55);
  engrave([[9, -2], [6.5, 0.5], [3.4, -0.2], [3.2, -2.4], [4.6, -2.8]], 0.55);
}

// ---------------------------------------------------------------- hand
export class KhonHand {
  constructor() {
    this.curl = [0, 0, 0, 0, 0];
    this.target = [0, 0, 0, 0, 0];
    this.tips = FINGERS.map(() => [0, 0]);
    this.x = 0; this.y = 0;
    this.angle = -0.12;
    this.scale = 1;
    this.glow = 0;
    this.t = 0;
  }

  // mode: 'idle' | 'hover' | 'press' | 'grab'; or explicit curls
  setPose(mode, curls) {
    if (curls) { this.target = curls.slice(); return; }
    const P = {
      idle: [-0.3, -0.34, -0.28, -0.24, -0.2],
      hover: [0.05, -0.12, 0.02, 0.08, 0.14],
      press: [0.42, 0.5, 0.46, 0.42, 0.38],
      grab: [0.85, 0.95, 1, 0.95, 0.9],
      jeeb: [0.55, 0.6, -0.3, -0.35, -0.4],
    };
    this.target = P[mode] || P.idle;
  }

  update(dt) {
    this.t += dt;
    for (let i = 0; i < 5; i++) {
      const breathe = Math.sin(this.t * 1.4 + i * 0.6) * 0.03;
      this.curl[i] += (this.target[i] + breathe - this.curl[i]) * Math.min(1, dt * 14);
    }
  }

  draw(ctx, x, y, s = 1, dpr = 1) {
    this.x = x; this.y = y;
    ctx.save();
    ctx.setTransform(dpr * s, 0, 0, dpr * s, x * dpr, y * dpr);
    ctx.rotate(this.angle + Math.sin(this.t * 0.9) * 0.02);
    // the hand hangs from above: draw it pointing down, palm toward us,
    // like a deity reaching from the clouds
    ctx.rotate(Math.PI);
    ctx.translate(0, 34);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const avg = (this.curl[0] + this.curl[1] + this.curl[2] + this.curl[3] + this.curl[4]) / 5;
    // soft glow
    const ga = 0.2 + this.glow * 0.35 + Math.max(0, avg) * 0.12;
    const h = ctx.createRadialGradient(0, -24, 6, 0, -24, 86);
    h.addColorStop(0, `rgba(255,228,150,${ga})`);
    h.addColorStop(0.5, `rgba(255,205,110,${ga * 0.35})`);
    h.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = h;
    ctx.fillRect(-86, -110, 172, 172);
    // sleeve, bracelets, palm (cached)
    const sc = dpr * s;
    const R = sc <= 1 ? 1 : sc <= 1.5 ? 1.5 : sc <= 2.25 ? 2.25 : 3.2;
    ctx.drawImage(handSprite(R), SPR.x0, SPR.y0, SPR.x1 - SPR.x0, SPR.y1 - SPR.y0);
    // fingers, pinky first so the index and thumb overlap on top
    const m = ctx.getTransform();
    const gold = goldGrad(ctx, -40, -95, 40, 10);
    for (let i = 4; i >= 0; i--) this._finger(ctx, i, gold, m, dpr);
    ctx.restore();
  }

  _finger(ctx, i, gold, m, dpr) {
    const [bx, by, len, spread, w0, nailLen] = FINGERS[i];
    const c = this.curl[i];
    const cp = Math.max(0, c);
    const pts = [[bx, by]];
    let px = bx, py = by;
    let th = 0, dx = 0, dy = -1;
    if (i === 0) {
      // thumb: swings across the palm in the picture plane as it folds
      let a = -Math.PI / 2 + spread + (c < 0 ? c * 0.35 : 0);
      for (let k = 0; k < 2; k++) {
        a += c > 0 ? c * (k ? 1.15 : 0.85) : c * (k ? -0.4 : 0.1);
        const L = len * 0.5 * (1 - cp * 0.28);
        dx = Math.cos(a); dy = Math.sin(a);
        px += dx * L; py += dy * L;
        pts.push([px, py]);
      }
      th = a;
    } else {
      // long fingers: joint angles out of the picture plane, projected
      // with a three-quarter view so bending back reads as a curve
      const a0 = -Math.PI / 2 + spread * (1 - cp * 0.55);
      const Fx = Math.cos(a0), Fy = Math.sin(a0), Px = -Fy, Py = Fx;
      const J = c >= 0 ? [1.35 * c, 1.6 * c, 1.0 * c] : [1.05 * c, 0.6 * c, 1.35 * c];
      for (let k = 0; k < 3; k++) {
        th += J[k];
        const kk = th < 0 ? 0.95 : 0.5;
        const L = len * SEGS[k];
        dx = Math.cos(th) * Fx - kk * Math.sin(th) * Px;
        dy = Math.cos(th) * Fy - kk * Math.sin(th) * Py;
        px += dx * L; py += dy * L;
        pts.push([px, py]);
      }
    }
    // nail (เล็บ) continues the curve a little further
    const dl = Math.hypot(dx, dy) || 1;
    let ndx = dx / dl, ndy = dy / dl;
    const bend = c < 0 ? 0.32 : -0.22 * c;
    const cb = Math.cos(bend), sb = Math.sin(bend);
    const nd = [ndx * cb - ndy * sb, ndx * sb + ndy * cb];
    const nl = nailLen * (0.55 + 0.45 * Math.min(1, dl * 1.2)) * (1 - cp * 0.3);
    const tip = [px + nd[0] * nl, py + nd[1] * nl];
    // outline of the finger from the widths at each joint
    const n = pts.length, ws = i === 0 ? [w0, w0 * 0.88, w0 * 0.7] : [w0, w0 * 0.9, w0 * 0.8, w0 * 0.66];
    const Lp = [], Rp = [];
    for (let k = 0; k < n; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
      let ux = b[0] - a[0], uy = b[1] - a[1];
      const d = Math.hypot(ux, uy) || 1; ux /= d; uy /= d;
      const hw = ws[k] / 2;
      Lp.push([pts[k][0] - uy * hw, pts[k][1] + ux * hw]);
      Rp.push([pts[k][0] + uy * hw, pts[k][1] - ux * hw]);
    }
    const f = new Path2D();
    spline(f, Lp);
    const e = pts[n - 1], hw = ws[n - 1] / 2;
    f.bezierCurveTo(Lp[n - 1][0] + ndx * hw * 1.4, Lp[n - 1][1] + ndy * hw * 1.4, Rp[n - 1][0] + ndx * hw * 1.4, Rp[n - 1][1] + ndy * hw * 1.4, Rp[n - 1][0], Rp[n - 1][1]);
    spline(f, Rp.reverse(), false);
    f.closePath();
    ctx.fillStyle = gold; ctx.fill(f);
    ctx.lineWidth = 1.15; ctx.strokeStyle = INK; ctx.stroke(f);
    // polished highlight along the finger
    ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(255,246,206,0.75)';
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const q = Rp[n - 1 - k], o = pts[k];
      const hx = o[0] + (q[0] - o[0]) * 0.45, hy = o[1] + (q[1] - o[1]) * 0.45;
      k ? ctx.lineTo(hx, hy) : ctx.moveTo(hx, hy);
    }
    ctx.stroke();
    // engraved joint creases
    ctx.lineWidth = 0.75; ctx.strokeStyle = 'rgba(62,31,5,0.85)';
    ctx.beginPath();
    for (let k = 1; k < n - 1; k++) {
      const l = Lp[k], r = Rp[n - 1 - k], o = pts[k];
      ctx.moveTo(l[0] * 0.7 + o[0] * 0.3, l[1] * 0.7 + o[1] * 0.3);
      ctx.quadraticCurveTo(o[0] + (pts[k + 1][0] - o[0]) * 0.12, o[1] + (pts[k + 1][1] - o[1]) * 0.12, r[0] * 0.7 + o[0] * 0.3, r[1] * 0.7 + o[1] * 0.3);
    }
    ctx.stroke();
    // jewelled ring on index and ring finger, a plain band on the thumb
    if (i === 1 || i === 3 || i === 0) {
      const k = i === 0 ? 0.55 : 0.6;
      const a = pts[0], b = pts[1];
      const rx = a[0] + (b[0] - a[0]) * k, ry = a[1] + (b[1] - a[1]) * k;
      const ux = b[0] - a[0], uy = b[1] - a[1], d = Math.hypot(ux, uy) || 1;
      const nx = -uy / d * (w0 * 0.58), ny = ux / d * (w0 * 0.58);
      ctx.lineCap = 'butt';
      ctx.lineWidth = 3.4; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.moveTo(rx - nx, ry - ny); ctx.lineTo(rx + nx, ry + ny); ctx.stroke();
      ctx.lineWidth = 2.2; ctx.strokeStyle = '#fbe39a'; ctx.stroke();
      ctx.lineCap = 'round';
      if (i) {
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(rx, ry, 2.3, 0, TAU); ctx.fill();
        ctx.fillStyle = i === 1 ? '#d42a1c' : '#1faa6a'; ctx.beginPath(); ctx.arc(rx, ry, 1.6, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(rx - 0.5, ry - 0.5, 0.55, 0, TAU); ctx.fill();
      }
    }
    // golden dance nail: a tapered, slightly curving sheath
    const bw = ws[n - 1] * 0.42, nx = -nd[1], ny = nd[0];
    const mid = [px + nd[0] * nl * 0.55 + ndx * 0.4, py + nd[1] * nl * 0.55 + ndy * 0.4];
    const nail = new Path2D();
    nail.moveTo(e[0] + nx * bw - ndx * 1.2, e[1] + ny * bw - ndy * 1.2);
    nail.quadraticCurveTo(mid[0] + nx * bw * 0.8, mid[1] + ny * bw * 0.8, tip[0], tip[1]);
    nail.quadraticCurveTo(mid[0] - nx * bw * 0.55, mid[1] - ny * bw * 0.55, e[0] - nx * bw - ndx * 1.2, e[1] - ny * bw - ndy * 1.2);
    nail.closePath();
    ctx.fillStyle = '#f6d67c'; ctx.fill(nail);
    ctx.lineWidth = 0.8; ctx.strokeStyle = INK; ctx.stroke(nail);
    ctx.lineWidth = 0.55; ctx.strokeStyle = 'rgba(255,252,228,0.9)';
    ctx.beginPath(); ctx.moveTo(e[0] + nx * bw * 0.2, e[1] + ny * bw * 0.2); ctx.quadraticCurveTo(mid[0] + nx * bw * 0.25, mid[1] + ny * bw * 0.25, tip[0], tip[1]); ctx.stroke();
    // collar where the nail sheath meets the fingertip
    ctx.lineCap = 'butt';
    ctx.lineWidth = 2; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(e[0] + nx * bw * 1.25, e[1] + ny * bw * 1.25); ctx.lineTo(e[0] - nx * bw * 1.25, e[1] - ny * bw * 1.25); ctx.stroke();
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#fbe39a'; ctx.stroke();
    ctx.lineCap = 'round';
    // tip in screen space (for strings)
    this.tips[i] = [(m.a * tip[0] + m.c * tip[1] + m.e) / dpr, (m.b * tip[0] + m.d * tip[1] + m.f) / dpr];
  }
}

// Golden strings from the heavens: a softly swaying thread of light with
// motes of gold running down it toward the puppet.
export function drawString(ctx, ax, ay, bx, by, { alpha = 1, t = 0, width = 1.4 } = {}) {
  if (alpha <= 0.01) return;
  const L = Math.hypot(bx - ax, by - ay);
  const mx = (ax + bx) / 2 + Math.sin(t * 1.3 + ax * 0.01) * (4 + L * 0.02);
  const my = (ay + by) / 2 + L * 0.035;
  const at = (u) => {
    const v = 1 - u;
    return [v * v * ax + 2 * v * u * mx + u * u * bx, v * v * ay + 2 * v * u * my + u * u * by];
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(ax, ay, bx, by);
  g.addColorStop(0, 'rgba(255,245,210,0.9)');
  g.addColorStop(0.5, 'rgba(255,200,110,0.6)');
  g.addColorStop(1, 'rgba(255,230,170,0.25)');
  ctx.strokeStyle = 'rgba(255,190,90,0.12)';
  ctx.lineWidth = width * 7;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
  ctx.strokeStyle = g;
  ctx.lineWidth = width;
  ctx.stroke();
  // travelling motes
  const n = Math.max(3, Math.round(L / 60));
  for (let k = 0; k < n; k++) {
    const u = (t * 0.35 + k / n) % 1;
    const [x, y] = at(u);
    const tw = 0.5 + 0.5 * Math.sin(t * 9 + k * 2.3);
    const r = (1.2 + tw * 1.6) * width;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    rg.addColorStop(0, `rgba(255,250,225,${0.9 * tw})`);
    rg.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  }
  ctx.restore();
}
