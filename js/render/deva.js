// เทวดา — a small flying celestial in the manner of the Ramakien gallery
// murals at Wat Phra Kaew: profile face with a long almond eye, a tall
// tiered ชฎา crown with กรรเจียก ear flares, frontal torso hung with a
// กรองศอ collar and crossed สังวาล chains, jewelled belt, brocade
// trousers, pointed feet, a flame-edged ประภามณฑล halo, streaming
// ผ้าทิพย์ scarves and an optional little Thai cloud (เมฆ) to kneel on.
//
// Everything that does not move is painted once per (palette, pose,
// resolution) into cached sprites; per frame we only blit ~6 images and
// stroke a handful of animated ribbons.
//
//   drawDeva(ctx, { t, face, flap, pose, hue, active, cloud }) -> { hand }
//
// The figure is centred on (0,0) and is ~90 units tall in the current
// transform, facing +x (face = -1 mirrors; fractional values squash the
// figure through a turn like a flipped puppet). `hand` is the local
// point (in the caller's frame) where the golden strings leave.

import { makeCanvas, curve, resample } from '../art/leather.js';

const TAU = Math.PI * 2;

// ------------------------------------------------------------ palettes
// Mural pigments: vermilion, lac red, malachite, indigo, ochre, cream.
export const DEVA_PALETTES = [
  { // 0 vermilion & malachite — the classic
    skin: '#f4dcb6', skinD: '#d5a676', line: '#7b3419',
    robe: '#a9261b', robeD: '#5c110b', wrap: '#2c6c47', wrapD: '#143822',
    rib: ['#c8392a', '#2f7d4f'], flap: '#a9261b', gem: '#d42a1c', gem2: '#1f9a62',
  },
  { // 1 malachite coat, lac-red wrap, golden skin
    skin: '#f0cf93', skinD: '#c7964f', line: '#6e3615',
    robe: '#236249', robeD: '#0e3223', wrap: '#9f2518', wrapD: '#55100a',
    rib: ['#2d7f56', '#d0662e'], flap: '#9f2518', gem: '#cf2a1d', gem2: '#1a8d5e',
  },
  { // 2 indigo & vermilion, moon-pale skin
    skin: '#f7e8d0', skinD: '#d8b58c', line: '#6b3a22',
    robe: '#283a7a', robeD: '#101a42', wrap: '#b8321f', wrapD: '#621408',
    rib: ['#c0402a', '#3a5aa8'], flap: '#283a7a', gem: '#d42a1c', gem2: '#2a8fbf',
  },
  { // 3 rose & teal
    skin: '#f5d8b4', skinD: '#d6a07a', line: '#7a3420',
    robe: '#b1455f', robeD: '#5e1729', wrap: '#1c6868', wrapD: '#0a3434',
    rib: ['#d8758b', '#2f8a84'], flap: '#b1455f', gem: '#c8243a', gem2: '#18a0a0',
  },
  { // 4 green-skinned (Indra-like) in red and gold
    skin: '#86b58a', skinD: '#4d7d57', line: '#23452c',
    robe: '#8f1f17', robeD: '#4a0c07', wrap: '#c48a25', wrapD: '#6e4410',
    rib: ['#b3261c', '#e2b54c'], flap: '#8f1f17', gem: '#d42a1c', gem2: '#2fae6a',
  },
];

const G = { hi: '#fff4c8', lt: '#f3d27a', md: '#d9a741', dk: '#9b6520', dd: '#5a310b', line: '#4a2708' };

// ------------------------------------------------------------ geometry
// Catmull-Rom through pts into a path (ctx or Path2D).
function spline(p, pts, closed = false, move = true, k = 1 / 6) {
  const n = pts.length;
  if (move) p.moveTo(pts[0][0], pts[0][1]);
  if (n < 3) { for (let i = 1; i < n; i++) p.lineTo(pts[i][0], pts[i][1]); if (closed) p.closePath(); return p; }
  const get = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
  if (closed) p.closePath();
  return p;
}
const shape = (pts) => spline(new Path2D(), pts, true);
const open = (pts) => spline(new Path2D(), pts, false);
const lerp = (a, b, u) => a + (b - a) * u;
const lp = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
const polar = (p, a, r) => [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];

// A tapered tube along pts with per-point widths, round-capped.
function tube(pts, ws, capStart = true) {
  const n = pts.length, L = [], R = [];
  const dir = (i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
  };
  for (let i = 0; i < n; i++) {
    const [dx, dy] = dir(i), w = ws[i] / 2;
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  const p = new Path2D();
  spline(p, L);
  const [ex, ey] = dir(n - 1), we = ws[n - 1] / 2, e = pts[n - 1];
  p.bezierCurveTo(L[n - 1][0] + ex * we * 1.3, L[n - 1][1] + ey * we * 1.3, R[n - 1][0] + ex * we * 1.3, R[n - 1][1] + ey * we * 1.3, R[n - 1][0], R[n - 1][1]);
  spline(p, R.reverse(), false, false);
  if (capStart) {
    const [sx, sy] = dir(0), ws0 = ws[0] / 2;
    p.bezierCurveTo(R[n - 1][0] - sx * ws0 * 1.2, R[n - 1][1] - sy * ws0 * 1.2, L[0][0] - sx * ws0 * 1.2, L[0][1] - sy * ws0 * 1.2, L[0][0], L[0][1]);
  }
  p.closePath();
  void e;
  return p;
}

// ------------------------------------------------------------ painting helpers
function goldGrad(g, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, G.hi); gr.addColorStop(0.3, G.lt); gr.addColorStop(0.6, G.md);
  gr.addColorStop(0.82, G.lt); gr.addColorStop(1, G.dk);
  return gr;
}
function gold(g, path, bb, lw = 0.3) {
  g.fillStyle = goldGrad(g, bb[0], bb[1], bb[2], bb[3]);
  g.fill(path);
  g.lineWidth = lw; g.strokeStyle = G.line; g.stroke(path);
}
function ink(g, path, fill, stroke, lw = 0.3) {
  if (fill) { g.fillStyle = fill; g.fill(path); }
  if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(path); }
}
function gem(g, x, y, r, col) {
  g.beginPath(); g.arc(x, y, r * 1.5, 0, TAU); g.fillStyle = G.lt; g.fill();
  g.lineWidth = r * 0.3; g.strokeStyle = G.line; g.stroke();
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = col; g.fill();
  g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.38, 0, TAU); g.fillStyle = 'rgba(255,250,235,0.75)'; g.fill();
}
function beads(g, pts, r, gap, fill = G.lt) {
  const s = resample(curve(pts, false, 8), gap);
  g.fillStyle = fill; g.strokeStyle = G.line; g.lineWidth = r * 0.35;
  for (const [x, y] of s) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke(); }
  g.fillStyle = 'rgba(255,252,230,0.8)';
  for (const [x, y] of s) { g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU); g.fill(); }
}
// pointed กระจัง petals standing on the (side) normal of a polyline
function krajang(g, pts, size, side = 1, inner = '#b8321f', gap = 0.95) {
  const s = resample(curve(pts, false, 8), size * gap);
  for (const [x, y, a] of s) {
    const n = a + side * Math.PI / 2, c = Math.cos(n), sn = Math.sin(n), tc = Math.cos(a), ts = Math.sin(a);
    const P = (u, v) => [x + tc * u * size + c * v * size, y + ts * u * size + sn * v * size];
    const p = new Path2D();
    const a0 = P(-0.5, 0), a1 = P(-0.45, 0.55), tip = P(0, 1.25), b1 = P(0.45, 0.55), b0 = P(0.5, 0);
    p.moveTo(...a0); p.quadraticCurveTo(...a1, ...tip); p.quadraticCurveTo(...b1, ...b0); p.closePath();
    g.fillStyle = G.lt; g.fill(p); g.lineWidth = size * 0.1; g.strokeStyle = G.line; g.stroke(p);
    const q = new Path2D();
    const c0 = P(-0.22, 0.12), c1 = P(-0.2, 0.45), ct = P(0, 0.78), d1 = P(0.2, 0.45), d0 = P(0.22, 0.12);
    q.moveTo(...c0); q.quadraticCurveTo(...c1, ...ct); q.quadraticCurveTo(...d1, ...d0); q.closePath();
    g.fillStyle = inner; g.fill(q);
  }
}
// scattered gold ดอกลอย flowers clipped to a region
function sprinkle(g, path, bb, spacing, r, col = G.lt, alt = null) {
  g.save(); g.clip(path);
  let row = 0;
  for (let y = bb[1]; y < bb[3] + spacing; y += spacing * 0.8, row++) {
    for (let x = bb[0] + (row % 2) * spacing / 2; x < bb[2] + spacing; x += spacing) {
      g.fillStyle = alt && (row + Math.round(x / spacing)) % 3 === 0 ? alt : col;
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4;
        g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.62, 0, TAU); g.fill();
      }
      g.fillStyle = '#fff4c8'; g.beginPath(); g.arc(x, y, r * 0.45, 0, TAU); g.fill();
    }
  }
  g.restore();
}
// a small กนก flame leaf, base at p, pointing along a, hooking to `hook`
function kranok(size, p, a, hook = 1) {
  const c = Math.cos(a), s = Math.sin(a);
  const P = (u, v) => [p[0] + c * u * size - s * v * size * hook, p[1] + s * u * size + c * v * size * hook];
  const pts = [P(0, -0.32), P(0.35, -0.36), P(0.7, -0.22), P(0.92, 0.02), P(1.05, 0.28), P(0.86, 0.14), P(0.62, 0.12), P(0.38, 0.22), P(0.12, 0.3), P(0, 0.26)];
  return shape(pts);
}

// ------------------------------------------------------------ sprites
const cache = new Map();
function sprite(key, bb, R, paint) {
  const k = key + '|' + R;
  let s = cache.get(k);
  if (s) return s;
  const [x0, y0, x1, y1] = bb;
  const c = makeCanvas(Math.ceil((x1 - x0) * R), Math.ceil((y1 - y0) * R));
  const g = c.getContext('2d');
  g.setTransform(R, 0, 0, R, -x0 * R, -y0 * R);
  g.lineJoin = 'round'; g.lineCap = 'round';
  paint(g);
  s = { c, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  cache.set(k, s);
  return s;
}
const blit = (ctx, s) => ctx.drawImage(s.c, s.x, s.y, s.w, s.h);
const RES = [1.25, 1.9, 2.8, 4.2, 6.3];

// ------------------------------------------------------------ poses
const SL = [1.1, -14.6];  // near shoulder (gesture arm)
const SR = [14.4, -14.8]; // far shoulder (string arm)
const NECK = [7.6, -16.4];
const HEAD = [9.3, -31.2]; // halo centre
const POSES = {
  fly: {
    armS: [SR, [20.6, -7.9], [27.2, -4.6]], handS: 0.32,
    armG: [SL, [-5.4, -8.2], [-4.4, -17.6]], handG: -Math.PI / 2 - 0.3,
    legF: { hip: [5, 4.2], knee: [-6.8, 13.6], ankle: [-19.8, 9.4], foot: -Math.PI / 2 - 0.35, curl: -0.5 },
    legN: { hip: [9.6, 4.2], knee: [21.4, 11.6], ankle: [11.2, 20.4], foot: 2.95, curl: 0.45 },
    lean: 0.06,
  },
  kneel: {
    armS: [SR, [20.8, -7.4], [27.8, -6.4]], handS: 0.12,
    armG: [SL, [-5.4, -8.2], [-4.4, -17.6]], handG: -Math.PI / 2 - 0.3,
    legF: { hip: [5, 4.6], knee: [11.8, 18.6], ankle: [-3.4, 20.2], foot: -2.45, curl: -0.4 },
    legN: { hip: [9.6, 4.4], knee: [21.4, 5.4], ankle: [20.4, 19.4], foot: 0.02, curl: -0.25 },
    lean: 0,
  },
  wai: {
    armS: [SR, [18.9, -6.2], [15.8, -11.4]], handS: -1.2,
    armG: [SL, [5.2, -5.4], [13.6, -10.6]], handG: -Math.PI / 2 + 0.28, wai: true,
    legF: { hip: [5, 4.6], knee: [11.8, 18.6], ankle: [-3.4, 20.2], foot: -2.45, curl: -0.4 },
    legN: { hip: [9.6, 4.4], knee: [21.4, 5.4], ankle: [20.4, 19.4], foot: 0.02, curl: -0.25 },
    lean: 0,
  },
};

// ------------------------------------------------------------ parts
function paintHalo(g, P, active) {
  const [cx, cy] = HEAD;
  const glow = g.createRadialGradient(cx, cy, 4, cx, cy, 24);
  glow.addColorStop(0, 'rgba(255,236,170,0.55)');
  glow.addColorStop(0.55, 'rgba(255,200,110,0.18)');
  glow.addColorStop(1, 'rgba(255,190,90,0)');
  g.fillStyle = glow; g.fillRect(cx - 25, cy - 25, 50, 50);
  // flame tongues (เปลวรัศมี)
  const n = 20, r0 = 12.2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU - Math.PI / 2;
    const len = 3.6 + (i % 2) * 1.1;
    const f = kranok(len, polar([cx, cy], a, r0 - 0.6), a, 1);
    g.fillStyle = i % 2 ? G.lt : G.md; g.fill(f);
    g.lineWidth = 0.22; g.strokeStyle = G.line; g.stroke(f);
    const f2 = kranok(len * 0.55, polar([cx, cy], a, r0), a, 1);
    g.fillStyle = P.gem; g.fill(f2);
  }
  // disc
  const d = g.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, r0);
  d.addColorStop(0, 'rgba(255,250,228,0.95)');
  d.addColorStop(0.6, 'rgba(255,226,150,0.75)');
  d.addColorStop(1, 'rgba(236,178,80,0.85)');
  g.beginPath(); g.arc(cx, cy, r0, 0, TAU); g.fillStyle = d; g.fill();
  g.lineWidth = 0.9; g.strokeStyle = G.md; g.stroke();
  g.lineWidth = 0.25; g.strokeStyle = G.line; g.stroke();
  g.beginPath(); g.arc(cx, cy, r0 - 1.2, 0, TAU); g.lineWidth = 0.2; g.strokeStyle = 'rgba(120,70,20,0.6)'; g.stroke();
  // dotted inner ring
  g.fillStyle = 'rgba(200,120,40,0.55)';
  for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; g.beginPath(); g.arc(cx + Math.cos(a) * (r0 - 2), cy + Math.sin(a) * (r0 - 2), 0.22, 0, TAU); g.fill(); }
  void active;
}

function paintCloud(g) {
  // puffs along the top and a scalloped underside
  const lobes = [[-17.5, 26, 4.4], [-10.5, 23.6, 5.6], [-1, 22.4, 6.4], [9, 23, 6], [17.6, 25.2, 4.8], [23.4, 27.4, 3.2]];
  const under = [[-19.5, 29.2, 2.6], [-14, 30, 2.8], [-8, 30.4, 2.9], [-2, 30.6, 3], [4, 30.5, 2.9], [10, 30.2, 2.8], [16, 29.6, 2.6], [21, 28.8, 2.2]];
  const body = new Path2D();
  for (const [x, y, r] of [...lobes, ...under]) { body.moveTo(x + r, y); body.arc(x, y, r, 0, TAU); }
  body.rect(-19, 25, 41, 4.5);
  // flowing tail (เมฆไหล) ending in a curl
  const tpts = [[-18, 29.6], [-23.4, 30.8], [-28.4, 30.4], [-31.8, 28.4], [-32.6, 25.8], [-31.2, 24.4], [-29.6, 25.2]];
  const tail = tube(tpts, [3.6, 3, 2.4, 1.9, 1.4, 1, 0.7]);
  g.lineWidth = 1.1; g.strokeStyle = '#4f7468'; g.stroke(body); g.stroke(tail);
  const cg = g.createLinearGradient(0, 16, 0, 33.5);
  cg.addColorStop(0, '#fbf6e8'); cg.addColorStop(0.5, '#e4ede0'); cg.addColorStop(1, '#9cc3b6');
  g.fillStyle = cg; g.fill(body); g.fill(tail);
  // inner curls: each puff winds into a spiral (teal line + gold)
  const curl = (x, y, r, turns, a0) => {
    const sp = [];
    for (let k = 0; k <= 18; k++) { const u = k / 18; const a = a0 + u * TAU * turns; const rr = r * (0.8 - u * 0.62); sp.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    return open(sp);
  };
  for (const [x, y, r] of lobes) {
    const c = curl(x, y + 0.5, r, 1.05, -Math.PI * 0.95);
    g.lineWidth = 0.45; g.strokeStyle = '#6f978a'; g.stroke(c);
    g.save(); g.translate(0.3, 0.25); g.lineWidth = 0.22; g.strokeStyle = '#c99c3c'; g.stroke(c); g.restore();
  }
  for (const [x, y, r] of under) {
    g.lineWidth = 0.3; g.strokeStyle = 'rgba(79,116,104,0.7)';
    g.beginPath(); g.arc(x, y, r * 0.6, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
  }
  g.lineWidth = 0.4; g.strokeStyle = '#6f978a'; g.stroke(curl(-30.4, 26.4, 2.2, 0.9, 0));
  // white rim light along the top
  g.lineWidth = 0.35; g.strokeStyle = 'rgba(255,255,255,0.9)';
  for (const [x, y, r] of lobes) { g.beginPath(); g.arc(x, y, r - 0.6, Math.PI * 1.1, Math.PI * 1.75); g.stroke(); }
}

function skinGrad(g, P, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, P.skin); gr.addColorStop(0.65, P.skin); gr.addColorStop(1, P.skinD);
  return gr;
}

// small Thai hand: palm plus fingers curling back (หักข้อ)
function devaHand(g, P, w, a, kind = 'open') {
  const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c; // +n = palm side
  const palmEnd = [w[0] + c * 2.7, w[1] + s * 2.7];
  const palm = tube([w, [w[0] + c * 1.4 + nx * 0.15, w[1] + s * 1.4 + ny * 0.15], palmEnd], [2.1, 2.6, 2.3]);
  // thumb on the palm side
  const tb = [w[0] + c * 0.9 + nx * 1, w[1] + s * 0.9 + ny * 1];
  const ta = a + 0.75;
  const thumb = tube([tb, polar(tb, ta, 1.4), polar(polar(tb, ta, 1.4), ta - 0.5, 1.4)], [1.1, 0.95, 0.65]);
  ink(g, thumb, P.skin, P.line, 0.22);
  ink(g, palm, skinGrad(g, P, w[0] - 2, w[1] - 2, w[0] + 3, w[1] + 3), P.line, 0.24);
  // fingers bend back (toward -n)
  for (let i = 2; i >= -1; i--) {
    let fa = a + i * 0.1;
    let p = [palmEnd[0] + nx * i * 0.62 - c * 0.3, palmEnd[1] + ny * i * 0.62 - s * 0.3];
    const pts = [p];
    const segs = kind === 'wai' ? [1.4, 1.1, 0.9] : [1.6, 1.3, 1.1];
    for (const L of segs) { fa -= kind === 'wai' ? 0.12 : 0.3; p = polar(p, fa, L * (i === 2 ? 0.78 : 1.12)); pts.push(p); }
    ink(g, tube(pts, [0.95, 0.85, 0.72, 0.5]), P.skin, P.line, 0.2);
  }
  // bracelet
  const b = open([[w[0] - nx * 1.3, w[1] - ny * 1.3], [w[0] + nx * 1.3, w[1] + ny * 1.3]]);
  g.lineWidth = 1; g.strokeStyle = G.line; g.stroke(b);
  g.lineWidth = 0.7; g.strokeStyle = G.lt; g.stroke(b);
}

function paintArm(g, P, pts, handA, which, pose) {
  const [S, E, W] = pts;
  const sm = [S, lp(S, E, 0.5), E, lp(E, W, 0.5), W];
  const arm = tube(sm, [4.4, 3.9, 3.1, 2.7, 2.2]);
  // wai: two palms pressed together into a lotus bud
  if (pose.wai && which === 'G') {
    ink(g, arm, skinGrad(g, P, S[0], S[1], W[0], W[1] + 3), P.line, 0.28);
    const tip = polar(W, handA, 8.4);
    const m = lp(W, tip, 0.45);
    const nrm = [Math.cos(handA + Math.PI / 2), Math.sin(handA + Math.PI / 2)];
    const bud = shape([
      [W[0] - nrm[0] * 1.2, W[1] - nrm[1] * 1.2], [m[0] - nrm[0] * 1.9, m[1] - nrm[1] * 1.9], tip,
      [m[0] + nrm[0] * 1.8, m[1] + nrm[1] * 1.8], [W[0] + nrm[0] * 1.4, W[1] + nrm[1] * 1.4],
    ]);
    ink(g, bud, skinGrad(g, P, W[0], W[1], tip[0], tip[1]), P.line, 0.26);
    g.lineWidth = 0.18; g.strokeStyle = P.line;
    g.stroke(open([lp(W, tip, 0.2), lp(W, tip, 0.93)]));
    for (const u of [0.55, 0.7]) { const q = lp(W, tip, u); g.stroke(open([[q[0] - nrm[0] * 1.2, q[1] - nrm[1] * 1.2], [q[0] - nrm[0] * 0.2, q[1] - nrm[1] * 0.2]])); }
    const th = lp(W, tip, 0.28);
    g.stroke(open([[th[0] + nrm[0] * 1.5, th[1] + nrm[1] * 1.5], [th[0] + nrm[0] * 0.5 + (tip[0] - W[0]) * 0.18, th[1] + nrm[1] * 0.5 + (tip[1] - W[1]) * 0.18]]));
    const bb = open([[W[0] - nrm[0] * 1.6, W[1] - nrm[1] * 1.6], [W[0] + nrm[0] * 1.6, W[1] + nrm[1] * 1.6]]);
    g.lineWidth = 1.1; g.strokeStyle = G.line; g.stroke(bb); g.lineWidth = 0.75; g.strokeStyle = G.lt; g.stroke(bb);
  } else {
    ink(g, arm, skinGrad(g, P, S[0], S[1], W[0], W[1] + 3), P.line, 0.28);
    if (!pose.wai) devaHand(g, P, W, handA);
  }
  // armlet (พาหุรัด) with a kranok flame, bracelets
  const ua = Math.atan2(E[1] - S[1], E[0] - S[0]);
  const am = lp(S, E, 0.42), nn = ua + Math.PI / 2;
  const band = open([polar(am, nn, 2.2), polar(am, nn, -2.2)]);
  g.lineWidth = 1.6; g.strokeStyle = G.line; g.stroke(band);
  g.lineWidth = 1.2; g.strokeStyle = G.lt; g.stroke(band);
  const fl = kranok(3.6, polar(am, nn, which === 'G' ? -1.4 : 1.4), ua + Math.PI + (which === 'G' ? -0.5 : 0.5), which === 'G' ? -1 : 1);
  gold(g, fl, [am[0] - 3, am[1] - 3, am[0] + 3, am[1] + 3], 0.22);
  gem(g, am[0], am[1], 0.42, P.gem);
  const fa = Math.atan2(W[1] - E[1], W[0] - E[0]);
  for (const u of [0.72, 0.84]) {
    const q = lp(E, W, u);
    const b = open([polar(q, fa + Math.PI / 2, 1.5), polar(q, fa - Math.PI / 2, 1.5)]);
    g.lineWidth = 0.95; g.strokeStyle = G.line; g.stroke(b); g.lineWidth = 0.65; g.strokeStyle = u > 0.8 ? G.lt : P.gem; g.stroke(b);
  }
  // shoulder flare (อินทรธนู) on the near shoulder
  if (which === 'G') {
    const f = kranok(4.4, [S[0] + 0.4, S[1] - 0.6], -Math.PI / 2 - 0.75, -1);
    gold(g, f, [S[0] - 4, S[1] - 5, S[0] + 2, S[1] + 1], 0.25);
    g.lineWidth = 0.3; g.strokeStyle = P.gem; g.stroke(kranok(3.2, [S[0] + 0.1, S[1] - 0.9], -Math.PI / 2 - 0.75, -1));
    // epaulette cap
    const cap = shape([[S[0] - 2.2, S[1] + 0.4], [S[0] - 1.5, S[1] - 1.5], [S[0] + 0.7, S[1] - 2], [S[0] + 2.2, S[1] - 0.8], [S[0] + 1.5, S[1] + 1.5], [S[0] - 0.8, S[1] + 1.9]]);
    gold(g, cap, [S[0] - 3, S[1] - 3, S[0] + 3, S[1] + 3], 0.25);
    gem(g, S[0], S[1] - 0.1, 0.45, P.gem2);
  }
}

function paintLeg(g, P, L, near) {
  const { hip, knee, ankle, foot, curl } = L;
  const skin = tube([hip, lp(hip, knee, 0.5), knee, lp(knee, ankle, 0.5), ankle], [8, 6.8, 5.2, 4, 2.6]);
  ink(g, skin, skinGrad(g, P, knee[0] - 4, knee[1] - 4, ankle[0] + 3, ankle[1] + 3), P.line, 0.28);
  // pointed foot
  const f1 = polar(ankle, foot, 2.6), f2 = polar(f1, foot + curl * 0.4, 2.4), f3 = polar(f2, foot + curl, 1.8);
  const heelA = Math.atan2(ankle[1] - knee[1], ankle[0] - knee[0]);
  const heel = polar(ankle, heelA, 0.9);
  const ft = tube([heel, ankle, f1, f2, f3], [2.4, 2.9, 2.5, 1.6, 0.6]);
  ink(g, ft, P.skin, P.line, 0.25);
  // anklet
  const aa = heelA + Math.PI / 2, ak = lp(knee, ankle, 0.9);
  const an = open([polar(ak, aa, 1.8), polar(ak, aa, -1.8)]);
  g.lineWidth = 1.2; g.strokeStyle = G.line; g.stroke(an); g.lineWidth = 0.85; g.strokeStyle = G.lt; g.stroke(an);
  // trousers (สนับเพลา) to mid-shin with an embroidered cuff
  const cuff = lp(knee, ankle, 0.4);
  const tr = tube([hip, lp(hip, knee, 0.5), knee, cuff], [9.6, 8.2, 6.6, 5.8], false);
  const bb = [Math.min(hip[0], knee[0], cuff[0]) - 5, Math.min(hip[1], knee[1], cuff[1]) - 5, Math.max(hip[0], knee[0], cuff[0]) + 5, Math.max(hip[1], knee[1], cuff[1]) + 5];
  const tg = g.createLinearGradient(bb[0], bb[1], bb[2], bb[3]);
  tg.addColorStop(0, near ? P.robe : P.robeD); tg.addColorStop(1, near ? P.robeD : P.robeD);
  ink(g, tr, tg, P.line, 0.3);
  sprinkle(g, tr, bb, 2.6, 0.32, near ? 'rgba(240,200,100,0.85)' : 'rgba(210,170,80,0.6)');
  // fold lines at knee
  g.lineWidth = 0.22; g.strokeStyle = 'rgba(0,0,0,0.35)';
  const ka = Math.atan2(cuff[1] - knee[1], cuff[0] - knee[0]);
  g.stroke(open([polar(knee, ka + 2.2, 2.4), polar(knee, ka + 1.4, 1.2), polar(knee, ka + 0.8, 2.2)]));
  const ca = ka + Math.PI / 2;
  const band = open([polar(cuff, ca, 3.2), polar(cuff, ca, -3.2)]);
  g.lineWidth = 1.7; g.strokeStyle = G.line; g.stroke(band); g.lineWidth = 1.3; g.strokeStyle = G.md; g.stroke(band);
  g.lineWidth = 0.35; g.strokeStyle = P.gem; g.stroke(band);
  krajang(g, [polar(cuff, ca, -2.9), polar(cuff, ca, 2.9)], 1.05, ka > -Math.PI / 2 && ka < Math.PI / 2 ? -1 : 1, P.gem, 0.95);
}

function paintBody(g, P, pose) {
  paintLeg(g, P, pose.legF, false);
  paintLeg(g, P, pose.legN, true);
  // torso: frontal chest, narrow waist (mural convention)
  const torso = shape([
    [5.4, -17.6], [2.6, -16.7], [0.2, -15.4], [-0.9, -13.2], [0.3, -10.6], [1.5, -6.8], [2.7, -2.6], [2.4, 1.8],
    [12.6, 1.8], [12, -2.6], [13, -6.8], [14.3, -10.6], [15.6, -13.2], [14.8, -15.5], [12.4, -16.7], [10.2, -17.6],
  ]);
  const tg = g.createLinearGradient(-1, -16, 16, 0);
  tg.addColorStop(0, P.skinD); tg.addColorStop(0.3, P.skin); tg.addColorStop(0.7, P.skin); tg.addColorStop(1, P.skinD);
  ink(g, torso, tg, P.line, 0.3);
  const hl = g.createRadialGradient(6.5, -11, 0.5, 6.5, -11, 6);
  hl.addColorStop(0, 'rgba(255,248,230,0.5)'); hl.addColorStop(1, 'rgba(255,248,230,0)');
  g.fillStyle = hl; g.fill(torso);
  g.lineWidth = 0.22; g.strokeStyle = P.skinD;
  g.stroke(open([[2.6, -10], [5, -8.4], [7.3, -9.6]]));
  g.stroke(open([[7.9, -9.6], [10.2, -8.4], [12.6, -10]]));
  g.beginPath(); g.arc(7.6, -3.2, 0.35, 0, TAU); g.fillStyle = P.skinD; g.fill();
  // crossed สังวาล chains with a flower boss
  beads(g, [[2, -15], [4.6, -9], [7.6, -5.6], [11.2, -0.6]], 0.42, 1.05);
  beads(g, [[13.4, -15], [10.6, -9], [7.6, -5.6], [3.8, -0.6]], 0.42, 1.05);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; const q = polar([7.6, -5.6], a, 0.95); gem(g, q[0], q[1], 0.42, k % 2 ? P.gem2 : P.gem); }
  gem(g, 7.6, -5.6, 0.62, P.gem);
  // hip wrap (ผ้านุ่ง) with side flares (ห้อยข้าง)
  const wrap = shape([[2.3, -0.8], [12.6, -0.8], [14.2, 3.2], [13.6, 7.4], [9.6, 8.6], [5, 8.6], [0.8, 7.6], [0.4, 3]]);
  const wg = g.createLinearGradient(0, -1, 0, 9);
  wg.addColorStop(0, P.wrap); wg.addColorStop(1, P.wrapD);
  ink(g, wrap, wg, P.line, 0.3);
  sprinkle(g, wrap, [0, -1, 15, 9], 2.4, 0.3, 'rgba(240,200,100,0.8)');
  g.save(); g.clip(wrap);
  g.lineWidth = 0.9; g.strokeStyle = G.md;
  g.stroke(open([[0.6, 7.2], [5, 8.2], [9.6, 8.2], [13.8, 7]]));
  g.restore();
  g.lineWidth = 0.22; g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.stroke(open([[4.2, 1.5], [4.8, 5], [4.4, 8]])); g.stroke(open([[10.6, 1.5], [10.2, 5], [10.8, 8]]));
  for (const [x, dir] of [[1.2, -1], [13.8, 1]]) {
    const f = kranok(4.6, [x, 1.2], Math.PI / 2 + dir * 0.5, dir);
    ink(g, f, P.robe, G.line, 0.26);
    g.lineWidth = 0.45; g.strokeStyle = G.lt; g.stroke(kranok(3.8, [x + dir * 0.25, 1.6], Math.PI / 2 + dir * 0.5, dir));
  }
  // belt with jewelled buckle (ปั้นเหน่ง)
  const belt = shape([[2.1, -1.9], [7.4, -1.2], [12.8, -1.9], [12.9, 0.9], [7.4, 1.6], [2.0, 0.9]]);
  gold(g, belt, [0, -2, 0, 2], 0.3);
  g.lineWidth = 0.55; g.strokeStyle = P.gem; g.stroke(open([[2.3, -0.5], [7.4, 0.2], [12.6, -0.5]]));
  const buckle = shape([[7.4, -2.4], [9.8, -0.1], [7.4, 2.6], [5, -0.1]]);
  gold(g, buckle, [5, -2.4, 9.8, 2.6], 0.3);
  gem(g, 7.4, 0.1, 0.9, P.gem);
  for (const [x, y] of [[7.4, -1.7], [7.4, 1.9], [5.8, 0], [9, 0]]) gem(g, x, y, 0.3, P.gem2);
}

function paintHead(g, P) {
  // face features are drawn a touch compressed under the crown band so
  // the face reads as a neat mural oval
  g.save();
  g.translate(0, -34); g.scale(0.97, 0.86); g.translate(0, 34);
  // neck + face (profile facing +x)
  const face = new Path2D();
  face.moveTo(4.4, -34);
  face.lineTo(13.4, -34.2);
  face.quadraticCurveTo(15.1, -32.6, 15.2, -30.7);
  face.quadraticCurveTo(15.4, -29.4, 16.3, -27.7);
  face.quadraticCurveTo(17.2, -26.1, 17.45, -25.45);
  face.quadraticCurveTo(17.35, -24.9, 16.35, -24.95);
  face.quadraticCurveTo(16.55, -24.35, 16.62, -23.95);
  face.quadraticCurveTo(16.25, -23.45, 15.85, -23.35);
  face.quadraticCurveTo(16.4, -22.9, 16.1, -22.25);
  face.quadraticCurveTo(15.6, -21.95, 15.6, -21.45);
  face.quadraticCurveTo(15.95, -20.4, 15.1, -19.85);
  face.quadraticCurveTo(13.7, -19.3, 11.9, -19.4);
  face.quadraticCurveTo(10.7, -19.2, 10.5, -17.4);
  face.lineTo(10.8, -12.5);
  face.lineTo(5.6, -12.5);
  face.quadraticCurveTo(5.4, -19, 4.9, -22.4);
  face.quadraticCurveTo(3, -27, 4.4, -34);
  face.closePath();
  const fg = g.createLinearGradient(3, -30, 17, -24);
  fg.addColorStop(0, P.skinD); fg.addColorStop(0.35, P.skin); fg.addColorStop(1, P.skin);
  ink(g, face, fg, P.line, 0.3);
  // soft cheek
  const ch = g.createRadialGradient(13.2, -24.4, 0.2, 13.2, -24.4, 2.4);
  ch.addColorStop(0, 'rgba(230,120,90,0.22)'); ch.addColorStop(1, 'rgba(230,120,90,0)');
  g.fillStyle = ch; g.fill(face);
  // jaw line
  g.lineWidth = 0.18; g.strokeStyle = P.skinD;
  g.stroke(open([[14.2, -20], [11.8, -20.6], [9.8, -22.6]]));
  // lips
  g.fillStyle = '#b8453a';
  g.beginPath(); g.moveTo(16.55, -24); g.quadraticCurveTo(16.2, -23.45, 15.85, -23.35); g.quadraticCurveTo(16.35, -22.9, 16.1, -22.3); g.quadraticCurveTo(15.4, -22.8, 15.1, -23.25); g.closePath(); g.fill();
  g.lineWidth = 0.2; g.strokeStyle = '#5a1a10';
  g.stroke(open([[15.85, -23.35], [15.4, -23.3], [14.9, -23.6]]));
  // nostril
  g.lineWidth = 0.16; g.strokeStyle = P.line;
  g.stroke(open([[16.9, -25.3], [16.4, -25.45], [16.2, -25.9]]));
  // long almond eye with upswept outer corner
  const eye = new Path2D();
  eye.moveTo(14.5, -28.25);
  eye.quadraticCurveTo(12.4, -29.7, 10, -29.2);
  eye.quadraticCurveTo(12.4, -27.8, 14.5, -28.25);
  eye.closePath();
  g.fillStyle = '#f6eedb'; g.fill(eye);
  g.save(); g.clip(eye);
  g.fillStyle = '#1b0f0a'; g.beginPath(); g.ellipse(13.1, -28.6, 0.6, 0.62, 0, 0, TAU); g.fill();
  g.restore();
  const lid = new Path2D();
  lid.moveTo(14.75, -28.15); lid.quadraticCurveTo(12.4, -30.05, 10, -29.25); lid.quadraticCurveTo(9.1, -29.35, 8.5, -30.2);
  lid.quadraticCurveTo(9.6, -29.62, 10.2, -29.5); lid.quadraticCurveTo(12.4, -29.75, 14.75, -28.15); lid.closePath();
  g.fillStyle = '#1b0f0a'; g.fill(lid);
  g.lineWidth = 0.13; g.strokeStyle = '#3a2016';
  g.stroke(open([[14.4, -28.15], [12.4, -27.9], [10.3, -29.05]]));
  // brow: a long thin arch drawn toward the temple
  const brow = new Path2D();
  brow.moveTo(15.05, -30.35); brow.quadraticCurveTo(12.2, -31.75, 8.4, -30.9);
  brow.quadraticCurveTo(12.2, -31.25, 15.05, -30.35); brow.closePath();
  g.fillStyle = '#1b0f0a'; g.fill(brow);
  g.lineWidth = 0.12; g.strokeStyle = '#1b0f0a'; g.stroke(brow);
  // hair line & pointed sideburn (จอนหู)
  const hair = shape([[3.8, -34], [9.4, -34.2], [11.4, -33.9], [11, -32], [10.4, -29.6], [9.7, -31.4], [8.4, -31.8], [7.6, -29], [6.6, -26.4], [5, -24.6], [3.9, -27.6]]);
  ink(g, hair, '#1a100c');
  // long-lobed ear with a drop earring (ตุ้มหู)
  const ear = shape([[8.4, -29.8], [9.6, -29.2], [9.8, -27.4], [9.2, -25.6], [9.3, -23.6], [8.7, -22.3], [7.9, -22.8], [7.9, -25], [7.5, -27.6]]);
  ink(g, ear, P.skin, P.line, 0.24);
  g.lineWidth = 0.18; g.strokeStyle = P.skinD; g.stroke(open([[9, -28.6], [9.1, -26.8], [8.6, -25.4]]));
  const drop = shape([[8.3, -22.4], [9.2, -21.2], [8.9, -19.4], [8.3, -18.4], [7.7, -19.4], [7.5, -21.2]]);
  gold(g, drop, [7.5, -22.4, 9.2, -18.6], 0.2);
  gem(g, 8.3, -20.2, 0.42, P.gem);
  g.restore();
  // ---- ชฎา crown
  // tiers (ชั้น) rising to a slender spire, leaning slightly back
  const base = [9.4, -40.6], top = [7.1, -52.4];
  const tipP = [5.2, -63];
  const core = shape([[3.4, -36.2], [4.2, -39.8], [5.9, -46.4], [6.7, -52.2], [6.3, -56.8], [tipP[0], tipP[1]], [7.1, -57], [8.2, -52.4], [10.4, -46.6], [13.6, -40], [15.1, -35.4]]);
  gold(g, core, [3, -60, 16, -36], 0.3);
  const N = 6;
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const c = lp(base, top, u);
    const hw = lerp(5.6, 1.5, u), hh = lerp(0.95, 0.5, u);
    const ring = new Path2D();
    ring.ellipse(c[0], c[1], hw, hh, -0.12, 0, TAU);
    gold(g, ring, [c[0] - hw, c[1] - hh, c[0] + hw, c[1] + hh], 0.22);
    g.save(); g.clip(ring);
    g.fillStyle = i % 2 ? P.gem : P.gem2;
    g.fillRect(c[0] - hw, c[1] - hh * 0.25, hw * 2, hh * 0.5);
    g.restore();
    // bead row under each ring and petals above
    const bp = [];
    for (let k = 0; k <= 8; k++) { const a = Math.PI * (0.05 + 0.9 * k / 8); bp.push([c[0] - Math.cos(a) * hw * 0.95, c[1] + Math.sin(a) * hh * 1.05 + 0.05]); }
    if (hw > 2) beads(g, bp, 0.22 + hw * 0.02, 0.62 + hw * 0.05);
    if (i < N - 1) {
      const pp = [];
      for (let k = 0; k <= 6; k++) { const a = Math.PI * (1.08 + 0.84 * k / 6); pp.push([c[0] + Math.cos(a) * hw * 0.82, c[1] + Math.sin(a) * hh * 0.8]); }
      if (hw > 2.2) krajang(g, pp, lerp(1.25, 0.7, u), -1, i % 2 ? P.gem2 : P.gem, 1.05);
    }
  }
  // spire finial
  const sp = shape([[6.3, -56.6], [6.9, -58.6], [5.2, -63], [5.9, -58.6]]);
  gold(g, sp, [5, -63, 7, -56], 0.2);
  gem(g, 6.6, -55.2, 0.5, P.gem);
  // lower crown body (ตัวชฎา) with engraved ribs, gems and a petal crest
  const bowl = shape([[3.3, -35.8], [3.7, -38.6], [6, -41.4], [9.8, -41.8], [13.4, -40.4], [15.2, -37.6], [15.3, -35.2]]);
  gold(g, bowl, [3, -42, 15, -35], 0.3);
  g.save(); g.clip(bowl);
  g.lineWidth = 0.22; g.strokeStyle = 'rgba(110,62,14,0.8)';
  for (let k = 0; k < 7; k++) { const x = 3.8 + k * 1.9; g.stroke(open([[x, -35.6], [lerp(x, 9.4, 0.25), -38.8], [lerp(x, 9.4, 0.5), -42]])); }
  g.restore();
  krajang(g, [[4.4, -38.6], [7, -40.2], [10, -40.7], [13.6, -39.6]], 1.25, -1, P.gem, 0.92);
  gem(g, 13.4, -37.2, 0.6, P.gem);
  gem(g, 9.2, -37.8, 0.5, P.gem2);
  gem(g, 5.4, -37.4, 0.45, P.gem);
  // band (กระบังหน้า) with gems and a petal crest along its top
  const band = shape([[3.2, -33.6], [8, -33.9], [13.2, -34.4], [15.5, -32.6], [15.6, -35.4], [13.4, -36.5], [8, -36.4], [3, -36.8]]);
  gold(g, band, [3, -37, 15, -32], 0.3);
  g.lineWidth = 0.7; g.strokeStyle = P.gem; g.stroke(open([[3.4, -35.1], [8, -35.2], [13.4, -35.4], [15.2, -34]]));
  for (let k = 0; k < 6; k++) { const x = 4.4 + k * 2.1; gem(g, x, lerp(-35.1, -35.4, k / 5), 0.3, k % 2 ? P.gem2 : '#f5f0e0'); }
  // forehead point (ไรจุก)
  const pt = shape([[13.8, -34.3], [15.2, -32.5], [15.7, -31.2], [15.6, -33.4], [15.5, -35.2]]);
  gold(g, pt, [13.8, -35, 15.7, -31], 0.2);
  // กรรเจียก ear flare: over the ear, sweeping back and up like a flame
  const kj = shape([[10.9, -34], [11, -31.4], [10.2, -29], [9, -27.6], [7.8, -28.2], [6.8, -30.2], [4.8, -32.2], [2.2, -33.6], [-0.8, -35.6], [-3, -38.6], [-3.4, -40.4], [-1.9, -39], [0.2, -37.6], [3, -36.6], [6.4, -35.7]]);
  gold(g, kj, [-3, -41, 11, -27], 0.3);
  const kj2 = shape([[9.6, -33.2], [9.5, -31.4], [8.9, -30.2], [8.1, -30.8], [6.3, -32.7], [3.4, -34.6], [1, -36.2], [3.4, -35.4], [6.6, -34.5]]);
  ink(g, kj2, P.gem, null);
  g.lineWidth = 0.28; g.strokeStyle = G.lt;
  g.stroke(open([[9.1, -32.4], [7, -33.4], [4, -35], [0.8, -36.9], [-2.4, -39.2]]));
  beads(g, [[10.6, -33.6], [10.6, -31.2], [9.6, -28.8], [8.4, -27.9]], 0.2, 0.6);
  gem(g, 8.9, -31.6, 0.5, P.gem2);
  const hook = kranok(2.2, [8.6, -28.2], Math.PI * 0.62, -1);
  gold(g, hook, [6, -29, 10, -25], 0.2);
  // ---- กรองศอ collar, pendant (ทับทรวง)
  const outer = [[-0.2, -15.2], [2.6, -12.2], [7.6, -10.4], [12.6, -12.2], [15.4, -15.3]];
  const collar = spline(new Path2D(), [[10.4, -17.4], [12.8, -16.6], [15.4, -15.3]], false);
  spline(collar, outer.slice().reverse().slice(1), false, false);
  spline(collar, [[-0.2, -15.2], [2.4, -16.6], [4.9, -17.4]], false, false);
  collar.quadraticCurveTo(7.6, -14.4, 10.4, -17.4);
  collar.closePath();
  krajang(g, outer.slice(0, 5), 1.15, 1, P.gem, 0.9);
  gold(g, collar, [0, -18, 15, -10], 0.3);
  g.lineWidth = 0.9; g.strokeStyle = P.gem;
  g.stroke(open([[1.2, -15.1], [3.6, -13.4], [7.6, -12.2], [11.6, -13.4], [14.2, -15.2]]));
  beads(g, [[1.4, -15.1], [3.6, -13.4], [7.6, -12.2], [11.6, -13.4], [14, -15.1]], 0.26, 0.85, '#fff0c0');
  const pend = shape([[7.6, -11.2], [8.9, -9.4], [7.6, -7.2], [6.3, -9.4]]);
  gold(g, pend, [6.3, -11.2, 8.9, -7.2], 0.25);
  gem(g, 7.6, -9.3, 0.62, P.gem);
  gem(g, 7.6, -6.7, 0.32, P.gem2);
}

// ------------------------------------------------------------ live bits
// A fluttering ribbon from (x,y) along dir; returns nothing. The ribbon
// is filled in `col` and edged with a gold line.
function ribbon(ctx, x, y, dir, len, w, t, ph, flap, col, n = 12, wav = 1) {
  const step = len / n, om = 2.4 + flap * 4.2;
  const L = [], R = [];
  let a = dir, px = x, py = y;
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    a = dir + Math.sin(t * om - u * 4.4 + ph) * (0.16 + 0.55 * u) * (0.55 + 0.45 * flap) * wav + u * u * 0.5 * Math.sin(ph * 3.1);
    const tw = 0.55 + 0.45 * Math.abs(Math.cos(u * 3.2 - t * om * 0.5 + ph));
    const ww = w * tw * (u < 0.12 ? 0.55 + u * 3.7 : u > 0.72 ? Math.max(0.02, (1 - u) / 0.28) : 1);
    const nx = -Math.sin(a) * ww, ny = Math.cos(a) * ww;
    L.push(px + nx, py + ny); R.push(px - nx, py - ny);
    px += Math.cos(a) * step; py += Math.sin(a) * step;
  }
  ctx.beginPath();
  ctx.moveTo(L[0], L[1]);
  for (let i = 2; i < L.length - 2; i += 2) ctx.quadraticCurveTo(L[i], L[i + 1], (L[i] + L[i + 2]) / 2, (L[i + 1] + L[i + 3]) / 2);
  ctx.lineTo(px, py);
  for (let i = R.length - 2; i >= 2; i -= 2) ctx.quadraticCurveTo(R[i], R[i + 1], (R[i] + R[i - 2]) / 2, (R[i + 1] + R[i - 1]) / 2);
  ctx.lineTo(R[0], R[1]);
  ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.lineWidth = 0.42; ctx.strokeStyle = G.lt; ctx.stroke();
}

// ------------------------------------------------------------ main
export function drawDeva(ctx, { t = 0, face = 1, flap = 0.35, pose = 'fly', hue = 0, active = false, cloud } = {}) {
  const P = DEVA_PALETTES[((hue | 0) % DEVA_PALETTES.length + DEVA_PALETTES.length) % DEVA_PALETTES.length];
  const Q = POSES[pose] || POSES.fly;
  const pn = POSES[pose] ? pose : 'fly';
  const hk = (hue | 0) % DEVA_PALETTES.length;
  if (cloud == null) cloud = pn !== 'fly';
  flap = Math.max(0, Math.min(1, flap));
  const m = ctx.getTransform();
  const sc = Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d));
  const R = RES.find((r) => r >= sc * 1.05) || RES[RES.length - 1];
  const fs = Math.sign(face) || 1, fa = Math.max(0.06, Math.min(1, Math.abs(face)));

  const breath = Math.sin(t * 2.1);
  const bob = Math.sin(t * 1.6) * 1.3;
  const a0 = ctx.globalAlpha;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.scale(fs * fa, 1);

  // cloud first (it bobs a little out of phase)
  if (cloud) {
    const cs = sprite('cloud', [-38, 15, 31, 34], R, paintCloud);
    ctx.save(); ctx.translate(0, Math.sin(t * 1.6 - 0.7) * 0.9 + 1); blit(ctx, cs); ctx.restore();
  }
  ctx.translate(0, bob);
  ctx.rotate(Q.lean + Math.sin(t * 1.1) * 0.02);

  // halo
  const hs = sprite('halo' + hk, [HEAD[0] - 25, HEAD[1] - 25, HEAD[0] + 25, HEAD[1] + 25], Math.min(R, 2.8), (g) => paintHalo(g, P, active));
  ctx.globalAlpha = a0 * (active ? 0.95 : 0.78) * (0.92 + 0.08 * Math.sin(t * 3.3));
  ctx.save(); ctx.translate(0, -breath * 0.3); blit(ctx, hs); ctx.restore();
  ctx.globalAlpha = a0;

  // back ribbons: scarf ends, sash tails
  const dirBack = lerp(2.0, 3.0, flap);
  const legBias = pn === 'fly' ? 0 : -0.25;
  ribbon(ctx, Q.armG[1][0] + 0.5, Q.armG[1][1] + 1, dirBack - 0.1 + legBias * 0.4, 30 + flap * 16, 1.9, t, 0, flap, P.rib[0], 12);
  ribbon(ctx, 1.6, -9, dirBack + 0.18, 24 + flap * 14, 1.6, t, 1.9, flap, P.rib[1], 11);
  ribbon(ctx, 1.2, 4.6, dirBack - 0.35 + legBias, 16 + flap * 8, 1.4, t, 3.3, flap, P.wrap, 9);
  ribbon(ctx, 2.2, 6.2, dirBack - 0.65 + legBias, 13 + flap * 6, 1.2, t, 4.6, flap, P.robe, 8);

  // string arm (behind torso)
  const sa = Math.sin(t * 1.9) * 0.045;
  const armS = sprite(`aS${hk}${pn}`, [-2, -25, 34, 6], R, (g) => paintArm(g, P, Q.armS, Q.handS, 'S', Q));
  ctx.save();
  ctx.translate(SR[0], SR[1] - breath * 0.2); ctx.rotate(sa); ctx.translate(-SR[0], -SR[1]);
  blit(ctx, armS);
  ctx.restore();

  // body (breathes around the waist)
  const body = sprite(`b${hk}${pn}`, [-30, -20, 30, 28], R, (g) => paintBody(g, P, Q));
  ctx.save();
  ctx.translate(0, 2); ctx.scale(1, 1 + breath * 0.012); ctx.translate(0, -2);
  blit(ctx, body);
  ctx.restore();

  // ชายไหว front flap hanging from the buckle
  ribbon(ctx, 7.4, 2.2, lerp(1.62, 2.1, flap), 11 + flap * 3, 1.5, t, 0.6, flap * 0.6, P.flap, 7, 0.45);

  // head + crown + collar
  const head = sprite(`h${hk}`, [-3, -64, 18.5, -6], R, (g) => paintHead(g, P));
  ctx.save();
  ctx.translate(NECK[0], NECK[1] - breath * 0.28);
  ctx.rotate(Math.sin(t * 0.9 + 0.5) * 0.025);
  ctx.translate(-NECK[0], -NECK[1]);
  blit(ctx, head);
  ctx.restore();

  // gesture arm (near) + a scarf end looped over its elbow
  const ga = Math.sin(t * 1.3 + 1) * 0.05;
  const armG = sprite(`aG${hk}${pn}`, [-12, -30, 24, 4], R, (g) => paintArm(g, P, Q.armG, Q.handG, 'G', Q));
  ctx.save();
  ctx.translate(SL[0], SL[1] - breath * 0.2); ctx.rotate(Q.wai ? ga * 0.2 : ga); ctx.translate(-SL[0], -SL[1]);
  blit(ctx, armG);
  ctx.restore();
  ribbon(ctx, Q.armS[1][0] - 0.4, Q.armS[1][1] + 1.2, lerp(1.75, 2.6, flap), 12 + flap * 7, 1.3, t, 2.4, flap, P.rib[0], 8, 0.7);

  // a warm spark where the strings leave the hand
  let hx, hy;
  if (Q.wai) { const tip = polar(Q.armG[2], Q.handG, 8.4); hx = tip[0]; hy = tip[1]; } else {
    const w = Q.armS[2];
    const p = polar(w, Q.handS, 4.2);
    // rotate by the arm sway around the shoulder
    const dx = p[0] - SR[0], dy = p[1] - SR[1], c = Math.cos(sa), s = Math.sin(sa);
    hx = SR[0] + dx * c - dy * s; hy = SR[1] - breath * 0.2 + dx * s + dy * c;
  }
  if (active) {
    const r = 3.2 + Math.sin(t * 6) * 0.6;
    const sg = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
    sg.addColorStop(0, 'rgba(255,250,220,0.85)'); sg.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = sg; ctx.fillRect(hx - r, hy - r, r * 2, r * 2);
  }
  ctx.restore();
  // back to the caller's frame: bob + lean + face scale
  const lean = Q.lean + Math.sin(t * 1.1) * 0.02, c = Math.cos(lean), s = Math.sin(lean);
  const lx = hx * c - hy * s, ly = hx * s + hy * c + bob;
  return { hand: [lx * fs * fa, ly] };
}
