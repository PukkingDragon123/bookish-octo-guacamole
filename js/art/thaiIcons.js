// ลายไทย icon kit — small, richly ornamented leather plaques for the
// chest thumbnails (weather, spells, ready-made scenes). Each icon is a
// hand-cut hide (leather() silhouette, punched dot rows that let the
// chest light through) painted in the mural palette of จิตรกรรมฝาผนัง:
// vermilion, lac red, gold leaf, indigo, malachite, cream.
//
// Everything here draws in world units on a paintSprite() context. The
// thumbnails are shown at ~100 px, so line weights are kept >= ~1 unit
// and every motif has a bold dark outline (the leather between dyes).

import { leather, hole, holes, dotLine, curve, poly, resample, rng, kanokPts, krajangPath } from './leather.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

export const M = {
  verm: '#d24a26', vermL: '#ec7a3e', red: '#a8251a', lac: '#6e130d',
  gold: '#e3b04a', goldL: '#fde9a6', goldD: '#a26d1f', goldDD: '#5e3a0d',
  indigo: '#25387d', indigoD: '#131b47', indigoL: '#5470bb', night: '#0e1336',
  jade: '#2e8c61', jadeD: '#165a3b', jadeL: '#86cf9f', teal: '#1f6f73',
  cream: '#f7ecd2', creamD: '#dcc394', ochre: '#c98b33', brown: '#6f4220', earth: '#7b4a26', earthD: '#4a2a14',
  pink: '#ec9ba0', rose: '#c65a6b', purple: '#63307d', purpleD: '#341448', sky: '#a8cde0',
  ink: '#1c0f07', inkL: '#3a2414',
};

// ------------------------------------------------------------ basics
export const P = (pts, closed = true, steps = 8, t = 0.5) => poly(pts.length > 2 ? curve(pts, closed, steps, t) : pts, closed);
export const lin = (pts) => poly(pts, false);

export function fill(ctx, p, style, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = style;
  ctx.fill(p);
  ctx.restore();
}
export function stroke(ctx, p, style, w = 1, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = style;
  ctx.lineWidth = w;
  ctx.stroke(p);
  ctx.restore();
}
// a painted shape with the dark leather edge showing round it
export function shape(ctx, p, style, { ink = M.ink, w = 1.1, alpha = 1 } = {}) {
  if (w) stroke(ctx, p, ink, w * 2);
  fill(ctx, p, style, alpha);
  return p;
}
export function goldG(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, M.goldL);
  g.addColorStop(0.3, '#f0c862');
  g.addColorStop(0.62, '#c08a2c');
  g.addColorStop(0.82, '#f2d47c');
  g.addColorStop(1, M.goldD);
  return g;
}
export function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
export function rgrad(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
export function clip(ctx, p, f) {
  ctx.save();
  ctx.clip(p);
  f();
  ctx.restore();
}
function circle(x, y, r) {
  const p = new Path2D();
  p.arc(x, y, r, 0, TAU);
  return p;
}
export function spiralPts(cx, cy, r, turns = 1.4, a0 = 0, dir = 1, n = 30) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = a0 + dir * u * turns * TAU;
    const rr = r * (1 - u * 0.85);
    out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return out;
}
const tf = (pts, x, y, s, a = 0, fx = 1) => {
  const c = Math.cos(a), si = Math.sin(a);
  return pts.map(([u, v]) => [x + (u * fx * c - v * si) * s, y + (u * fx * si + v * c) * s]);
};

// tapering tube outline around an open spine
export function tubePts(spine, radii) {
  const d = curve(spine, false, 8);
  const n = spine.length, m = d.length;
  const rs = d.map((_, i) => {
    const u = (i / (m - 1)) * (n - 1), k = Math.min(n - 2, Math.floor(u));
    return lerp(radii[k], radii[k + 1], u - k);
  });
  const L = [], R = [];
  for (let i = 0; i < m; i++) {
    const a = d[Math.max(0, i - 1)], b = d[Math.min(m - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    L.push([d[i][0] + nx * rs[i], d[i][1] + ny * rs[i]]);
    R.push([d[i][0] - nx * rs[i], d[i][1] - ny * rs[i]]);
  }
  return [...L, ...R.reverse()];
}

// ------------------------------------------------------------ ornaments
// กนก flame leaf, painted with a dark edge and a lighter tongue inside.
export function kanok(ctx, x, y, size, angle, flip = false, { fill: f = M.gold, inner = M.verm, w = 0.6 } = {}) {
  const p = poly(kanokPts(x, y, size, angle, flip));
  shape(ctx, p, f, { w });
  if (inner && size > 5) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const q = poly(kanokPts(x + c * size * 0.12, y + s * size * 0.12, size * 0.55, angle, flip));
    fill(ctx, q, inner, 0.95);
  }
  return p;
}

// ประจำยาม — four-petalled jewel.
export function prajam(ctx, x, y, s, { petal = M.gold, core = M.red, punch = true, ring = true } = {}) {
  const p = new Path2D();
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4 * 0;
    const c = Math.cos(a), si = Math.sin(a);
    const tip = [x + c * s, y + si * s];
    const l = [x + c * s * 0.42 - si * s * 0.42, y + si * s * 0.42 + c * s * 0.42];
    const r = [x + c * s * 0.42 + si * s * 0.42, y + si * s * 0.42 - c * s * 0.42];
    p.moveTo(x, y);
    p.quadraticCurveTo(l[0], l[1], tip[0], tip[1]);
    p.quadraticCurveTo(r[0], r[1], x, y);
  }
  shape(ctx, p, typeof petal === 'string' ? petal : petal, { w: Math.max(0.4, s * 0.09) });
  if (ring) shape(ctx, circle(x, y, s * 0.36), core, { w: Math.max(0.3, s * 0.06) });
  if (punch) hole(ctx, x, y, Math.max(0.5, s * 0.14));
}

// ดาวเพดาน ceiling star: 4 long + 4 short petals.
export function star(ctx, x, y, r, { petal = M.gold, core = M.red, punch = true } = {}) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU - Math.PI / 2;
    const rr = i % 2 ? r * 0.28 : i % 4 === 0 ? r : r * 0.62;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  shape(ctx, poly(pts), petal, { w: Math.max(0.3, r * 0.07) });
  if (core && r > 3) fill(ctx, circle(x, y, r * 0.24), core);
  if (punch && r > 3) hole(ctx, x, y, r * 0.1);
}

// Row of gold krajang leaves (standing on the left normal of pts).
export function krajangs(ctx, pts, size, { gold = M.gold, inner = M.red, gap = 0.95, w = 0.5 } = {}) {
  for (const [x, y, a] of resample(curve(pts, false, 10), size * gap, false)) {
    const up = a - Math.PI / 2;
    const p = krajangPath(x, y, size, size * 1.3, up);
    shape(ctx, p, gold, { w });
    fill(ctx, krajangPath(x + Math.cos(up) * size * 0.12, y + Math.sin(up) * size * 0.12, size * 0.5, size * 0.72, up), inner);
  }
}

// Lotus petal band (กลีบบัว) — rounded petals pointing up.
export function lotusBand(ctx, x0, x1, y, h, { fill: f = M.gold, inner = M.verm, n } = {}) {
  const k = n || Math.max(3, Math.round((x1 - x0) / (h * 0.9)));
  const w = (x1 - x0) / k;
  for (let i = 0; i < k; i++) {
    const cx = x0 + w * (i + 0.5);
    const p = new Path2D();
    p.moveTo(cx - w * 0.5, y);
    p.bezierCurveTo(cx - w * 0.55, y - h * 0.6, cx - w * 0.15, y - h * 0.85, cx, y - h);
    p.bezierCurveTo(cx + w * 0.15, y - h * 0.85, cx + w * 0.55, y - h * 0.6, cx + w * 0.5, y);
    p.closePath();
    shape(ctx, p, f, { w: 0.45 });
    const q = new Path2D();
    q.moveTo(cx - w * 0.25, y);
    q.bezierCurveTo(cx - w * 0.28, y - h * 0.4, cx - w * 0.08, y - h * 0.55, cx, y - h * 0.62);
    q.bezierCurveTo(cx + w * 0.08, y - h * 0.55, cx + w * 0.28, y - h * 0.4, cx + w * 0.25, y);
    q.closePath();
    fill(ctx, q, inner);
  }
}

// ลายก้านขด — a running stem with curls alternating either side, painted
// in dark gold along a frame band.
export function scroll(ctx, pts, { amp = 1.6, step = 7, col = M.goldD, w = 0.55, curl = 1.5 } = {}) {
  const s = resample(curve(pts, false, 10), step / 4, false);
  const stem = s.map(([x, y, a], i) => { const o = Math.sin(i * Math.PI / 2) * amp; return [x - Math.sin(a) * o, y + Math.cos(a) * o]; });
  stroke(ctx, lin(stem), col, w);
  for (let i = 1; i < s.length - 1; i += 2) {
    const [x, y, a] = s[i], side = i % 4 === 1 ? 1 : -1;
    const cx = x - Math.sin(a) * side * amp * 1.6, cy = y + Math.cos(a) * side * amp * 1.6;
    stroke(ctx, lin(spiralPts(cx, cy, curl, 0.9, a + (side > 0 ? 0 : Math.PI), side, 10)), col, w * 0.9);
  }
}

// ------------------------------------------------------------ เมฆ clouds
// Thai mural cloud: a cluster of lobes, each winding into a ก้นหอย curl,
// with a flowing tail (เมฆไหล). tail: -1 / 0 / 1.
export function cloud(ctx, x, y, w, h, { top = M.cream, bot = M.creamD, line = M.goldD, ink = M.ink, tail = 0, seed = 1, lobes = 5, edge = 1.1, curls = true } = {}) {
  const r = rng(seed);
  const circles = [];
  for (let i = 0; i < lobes; i++) {
    const t = lobes === 1 ? 0.5 : i / (lobes - 1);
    const bump = Math.sin(t * Math.PI);
    const rr = h * (0.28 + 0.22 * bump) * (0.9 + r() * 0.2);
    circles.push([x + (t - 0.5) * w * 0.74, y - bump * h * 0.22 + h * 0.08, rr]);
  }
  const under = [];
  const nu = Math.max(3, lobes + 1);
  for (let i = 0; i < nu; i++) under.push([x + ((i + 0.5) / nu - 0.5) * w * 0.86, y + h * 0.3, h * 0.17]);
  const body = new Path2D();
  for (const [cx, cy, rr] of [...circles, ...under]) { body.moveTo(cx + rr, cy); body.arc(cx, cy, rr, 0, TAU); }
  body.rect(x - w * 0.42, y + h * 0.05, w * 0.84, h * 0.27);
  let tailP = null;
  if (tail) {
    const s = tail;
    const bx = x + s * w * 0.4, by = y + h * 0.3;
    const sp = [[bx, by - h * 0.05], [bx + s * w * 0.18, by + h * 0.05], [bx + s * w * 0.34, by - h * 0.04], [bx + s * w * 0.42, by - h * 0.22], [bx + s * w * 0.36, by - h * 0.34], [bx + s * w * 0.29, by - h * 0.27]];
    tailP = poly(tubePts(sp, [h * 0.18, h * 0.15, h * 0.12, h * 0.09, h * 0.06, h * 0.03]));
  }
  if (edge) { stroke(ctx, body, ink, edge * 2); if (tailP) stroke(ctx, tailP, ink, edge * 2); }
  const g = vgrad(ctx, y - h * 0.5, y + h * 0.48, [top, top, bot]);
  fill(ctx, body, g);
  if (tailP) fill(ctx, tailP, g);
  if (curls) {
    for (const [cx, cy, rr] of circles) {
      stroke(ctx, lin(spiralPts(cx + rr * 0.05, cy + rr * 0.08, rr * 0.72, 1.1, Math.PI * 1.05, -1, 20)), line, Math.max(0.5, rr * 0.13));
      stroke(ctx, lin(Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (1.15 + i * 0.07); return [cx + Math.cos(a) * rr * 0.86, cy + Math.sin(a) * rr * 0.86]; })), 'rgba(255,255,255,0.8)', Math.max(0.4, rr * 0.1));
    }
    for (const [cx, cy, rr] of under) stroke(ctx, lin(Array.from({ length: 7 }, (_, i) => { const a = Math.PI * (0.2 + i * 0.1); return [cx + Math.cos(a) * rr * 0.6, cy + Math.sin(a) * rr * 0.6]; })), line, Math.max(0.4, rr * 0.18), 0.8);
    if (tail) {
      const s = tail, bx = x + s * w * 0.4 + s * w * 0.33, by = y + h * 0.3 - h * 0.2;
      stroke(ctx, lin(spiralPts(bx, by, h * 0.11, 0.9, s > 0 ? 0 : Math.PI, -s, 12)), line, Math.max(0.4, h * 0.035));
    }
  }
  return body;
}

// ------------------------------------------------------------ water ลายน้ำ
// Rows of Thai mural waves: scalloped crests each winding into a curl,
// light line on deepening blue. Paint inside a clip.
export function waves(ctx, x0, x1, y, { rows = 3, size = 12, cols = [M.indigoL, M.indigo, M.indigoD], line = M.cream, seed = 3, curl = true, foam = true } = {}) {
  const r = rng(seed);
  for (let k = 0; k < rows; k++) {
    const yy = y + k * size * 0.62;
    const off = (k % 2) * size * 0.5 + r() * 2;
    const col = cols[Math.min(cols.length - 1, k)];
    const p = new Path2D();
    p.moveTo(x0 - size, yy + size * 3);
    const crests = [];
    for (let x = x0 - size + off; x < x1 + size; x += size) {
      p.lineTo(x, yy);
      p.bezierCurveTo(x + size * 0.1, yy - size * 0.5, x + size * 0.62, yy - size * 0.72, x + size * 0.88, yy - size * 0.3);
      p.quadraticCurveTo(x + size * 0.98, yy - size * 0.08, x + size, yy);
      crests.push(x);
    }
    p.lineTo(x1 + size, yy + size * 3);
    p.closePath();
    stroke(ctx, p, M.ink, 1.6);
    fill(ctx, p, col);
    for (const x of crests) {
      stroke(ctx, lin([[x + size * 0.04, yy - size * 0.02], [x + size * 0.2, yy - size * 0.42], [x + size * 0.55, yy - size * 0.6], [x + size * 0.84, yy - size * 0.32]]), line, Math.max(0.6, size * 0.08));
      if (curl) stroke(ctx, lin(spiralPts(x + size * 0.58, yy - size * 0.26, size * 0.24, 0.85, -Math.PI * 0.2, 1, 12)), line, Math.max(0.5, size * 0.065), 0.9);
      if (foam && size > 7) fill(ctx, circle(x + size * 0.9, yy - size * 0.36, size * 0.06), line);
    }
  }
}

// ------------------------------------------------------------ สายฟ้า
// Thai lightning: a gold zigzag with flame barbs (ลายไฟ) at each turn.
export function bolt(ctx, pts, w = 4, { fill: f, core = M.verm } = {}) {
  const n = pts.length;
  const radii = pts.map((_, i) => w * (1 - (i / (n - 1)) * 0.85));
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    L.push([pts[i][0] - dy / l * radii[i], pts[i][1] + dx / l * radii[i]]);
    R.push([pts[i][0] + dy / l * radii[i], pts[i][1] - dx / l * radii[i]]);
  }
  const tip = pts[n - 1];
  const p = poly([...L, tip, ...R.reverse()]);
  // barbs at the corners
  for (let i = 1; i < n - 1; i++) {
    const a = pts[i - 1], b = pts[i + 1], c = pts[i];
    const out = Math.atan2(c[1] - (a[1] + b[1]) / 2, c[0] - (a[0] + b[0]) / 2);
    kanok(ctx, c[0], c[1], w * 2.1 * (1 - i / n * 0.5), out, out > -Math.PI / 2 && out < Math.PI / 2, { fill: M.goldL, inner: M.gold, w: 0.5 });
  }
  shape(ctx, p, f || goldG(ctx, pts[0][0] - 10, pts[0][1], tip[0] + 10, tip[1]), { w: 0.8 });
  stroke(ctx, lin(pts.slice(0, -1)), core, Math.max(0.6, w * 0.3));
  stroke(ctx, lin(pts.slice(0, -1).map(([x, y]) => [x - w * 0.25, y - w * 0.15])), '#fffbe6', Math.max(0.4, w * 0.14), 0.8);
  return p;
}

// ------------------------------------------------------------ พญานาค
// Crowned naga head in profile on an arched, scaled neck. (x, y) is the
// neck base; s ~ 1 gives a head ~34 units long. dir 1 faces right.
export function naga(ctx, x, y, s, { dir = 1, body = M.jade, bodyD = M.jadeD, belly = M.cream, crest = M.gold, neck = [[0, 0], [-4, -16], [2, -32], [10, -42]], radii = [9, 8.5, 7.5, 7], mouth = true, punchEye = true } = {}) {
  const T = (pts) => tf(pts, x, y, s, 0, dir);
  const [hx, hy] = neck[neck.length - 1];
  // crest flames (หงอน) behind the head
  const crestPts = [[hx - 6, hy - 6, -2.3], [hx - 9, hy - 1, -2.65], [hx - 10, hy + 5, -2.95], [hx - 2, hy - 10, -1.95]];
  for (const [cx, cy, a] of crestPts) {
    const [q] = T([[cx, cy]]);
    const aa = dir > 0 ? a : Math.PI - a;
    kanok(ctx, q[0], q[1], 13 * s, aa, dir < 0, { fill: crest, inner: M.verm, w: 0.55 });
  }
  // neck
  const neckO = T(tubePts(neck, radii));
  shape(ctx, poly(neckO), vgrad(ctx, y - 44 * s, y, [body, bodyD]), { w: 0.9 });
  // belly plates on the front side
  const bellyS = neck.map(([u, v], i) => [u + radii[i] * 0.55, v + 1]);
  const bel = T(tubePts(bellyS, radii.map((r) => r * 0.42)));
  clip(ctx, poly(neckO), () => {
    fill(ctx, poly(bel), belly);
    for (let i = 1; i < 9; i++) {
      const t = i / 9, k = Math.floor(t * (neck.length - 1)), f = t * (neck.length - 1) - k;
      const u = lerp(bellyS[k][0], bellyS[k + 1][0], f), v = lerp(bellyS[k][1], bellyS[k + 1][1], f);
      const rr = lerp(radii[k], radii[k + 1], f) * 0.5;
      stroke(ctx, lin(T([[u - rr, v - 1], [u, v + 1.4], [u + rr, v - 1]])), M.goldD, 0.6 * s + 0.2);
    }
    // scales: rows of small arcs
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.5) / 7, k = Math.floor(t * (neck.length - 1)), f = t * (neck.length - 1) - k;
      const u = lerp(neck[k][0], neck[k + 1][0], f) - 2, v = lerp(neck[k][1], neck[k + 1][1], f);
      for (const du of [-3.5, 0.5]) {
        const [c] = T([[u + du, v]]);
        stroke(ctx, lin(Array.from({ length: 6 }, (_, j) => { const a = Math.PI * (0.1 + j * 0.16); return [c[0] + Math.cos(a) * 2.2 * s, c[1] + Math.sin(a) * 2.2 * s]; })), M.goldL, 0.45 * s + 0.15, 0.85);
      }
    }
  });
  // head (authored facing right, mouth open)
  const H = (pts) => T(pts.map(([u, v]) => [hx + u, hy + v]));
  const upper = H([[-8, 4], [-9, -4], [-4, -10], [4, -12], [12, -11], [19, -9], [25, -8], [29, -13], [32, -12], [32, -6], [29, -2], [21, -1], [12, 1], [4, 4]]);
  const lower = H([[-6, 4], [4, 4], [12, 4], [20, 6], [26, 9], [24, 12], [15, 11], [6, 11], [-3, 9]]);
  // beard flames under the jaw
  for (const [u, v, a] of [[6, 11, 2.1], [0, 10, 2.35], [12, 11, 1.85]]) {
    const [q] = H([[u, v]]);
    kanok(ctx, q[0], q[1], 8 * s, dir > 0 ? a : Math.PI - a, dir > 0, { fill: crest, inner: M.verm, w: 0.5 });
  }
  shape(ctx, P(lower, true, 6, 0.4), vgrad(ctx, y - 60 * s, y, [body, bodyD]), { w: 0.8 });
  if (mouth) {
    // fangs and a forked tongue
    for (const [a, b, c] of [[[20, -1], [22, 4], [24, -1]], [[13, 1], [14.5, 5], [16, 0.5]]]) shape(ctx, poly(H([a, b, c])), M.cream, { w: 0.35 });
    shape(ctx, lin(H([[16, 5], [26, 4], [31, 6]])), M.verm, { w: 0 });
    stroke(ctx, lin(H([[16, 5], [26, 4], [31, 6]])), M.red, 1.2 * s);
    stroke(ctx, lin(H([[31, 6], [34, 4]])), M.red, 0.8 * s);
    stroke(ctx, lin(H([[31, 6], [34, 8]])), M.red, 0.8 * s);
  }
  const head = P(upper, true, 6, 0.4);
  shape(ctx, head, vgrad(ctx, y - 60 * s, y - 30 * s, [M.jadeL, body]), { w: 0.85 });
  // gold brow ridge and snout curl
  stroke(ctx, lin(H([[2, -8], [10, -9], [18, -6], [24, -6]])), crest, 1.3 * s + 0.2);
  stroke(ctx, lin(H([[26, -7], [29, -11], [31, -9], [29.5, -8]])), crest, 1 * s + 0.2);
  // jewelled crown (มงกุฎ) — a little tiered spire tilted back
  const crown = H([[-3, -9], [-4, -15], [-6, -21], [-9, -30], [-4, -23], [1, -17], [6, -11]]);
  shape(ctx, P(crown, true, 5, 0.3), goldG(ctx, crown[0][0], crown[3][1], crown[6][0], crown[0][1]), { w: 0.6 });
  for (const [u, v] of [[-2.5, -13], [-4.5, -18.5]]) { const [q] = H([[u, v]]); stroke(ctx, lin([[q[0] - 3 * s * dir, q[1] + 1 * s], [q[0] + 3.5 * s * dir, q[1] - 0.5 * s]]), M.red, 1 * s); }
  // eye
  const [e] = H([[9, -5]]);
  shape(ctx, circle(e[0], e[1], 2.6 * s), M.goldL, { w: 0.5 });
  if (punchEye) hole(ctx, e[0], e[1], 1.3 * s);
  fill(ctx, circle(e[0] + 0.5 * s * dir, e[1], 0.7 * s), M.ink);
  return neckO;
}

// ------------------------------------------------------------ sun & moon
// Sun deity disc (สุริยเทพ): kanok-flame rays round a gold face.
export function sun(ctx, x, y, r, { rays = 16, ray = M.gold, ray2 = M.verm, face = true, disc = [M.goldL, M.gold, M.verm] } = {}) {
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * TAU - Math.PI / 2;
    const big = i % 2 === 0;
    kanok(ctx, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, r * (big ? 0.75 : 0.52), a, false, { fill: big ? ray : ray2, inner: big ? ray2 : M.goldL, w: 0.5 });
  }
  shape(ctx, circle(x, y, r), rgrad(ctx, x - r * 0.3, y - r * 0.3, r * 0.1, r * 1.1, disc), { w: 0.8 });
  stroke(ctx, circle(x, y, r * 0.84), M.goldD, Math.max(0.5, r * 0.05), 0.8);
  dotLine(ctx, Array.from({ length: 40 }, (_, i) => [x + Math.cos(i / 40 * TAU) * r * 0.92, y + Math.sin(i / 40 * TAU) * r * 0.92]), { closed: true, spacing: Math.max(2.2, r * 0.22), r: Math.max(0.45, r * 0.045), smoothIt: false, jitter: 0 });
  if (face) sunFace(ctx, x, y, r * 0.78);
}

// Serene mural face: arched brows meeting the nose, downcast lidded eyes,
// a small lac-red smile and an ุณาโลม dot.
export function sunFace(ctx, x, y, r, { ink = M.goldDD, lips = M.red } = {}) {
  const w = Math.max(0.5, r * 0.075);
  for (const s of [-1, 1]) {
    stroke(ctx, lin([[x - s * r * 0.08, y + r * 0.22], [x - s * r * 0.1, y - r * 0.12], [x + s * r * 0.18, y - r * 0.3], [x + s * r * 0.55, y - r * 0.24]]), ink, w);
    stroke(ctx, lin([[x + s * r * 0.18, y - r * 0.05], [x + s * r * 0.33, y + r * 0.03], [x + s * r * 0.52, y - r * 0.04]]), ink, w * 1.1);
    stroke(ctx, lin([[x + s * r * 0.2, y - r * 0.11], [x + s * r * 0.36, y - r * 0.17], [x + s * r * 0.5, y - r * 0.11]]), ink, w * 0.6, 0.7);
  }
  stroke(ctx, lin([[x - r * 0.1, y + r * 0.25], [x, y + r * 0.3], [x + r * 0.1, y + r * 0.25]]), ink, w * 0.8);
  const m = new Path2D();
  m.moveTo(x - r * 0.2, y + r * 0.45);
  m.quadraticCurveTo(x, y + r * 0.62, x + r * 0.2, y + r * 0.45);
  m.quadraticCurveTo(x, y + r * 0.5, x - r * 0.2, y + r * 0.45);
  fill(ctx, m, lips);
  stroke(ctx, m, ink, w * 0.5);
  fill(ctx, circle(x, y - r * 0.48, r * 0.07), lips);
}

// Full moon with the rabbit (กระต่ายในดวงจันทร์).
export function moon(ctx, x, y, r, { glow = true } = {}) {
  if (glow) fill(ctx, circle(x, y, r * 1.6), rgrad(ctx, x, y, r * 0.9, r * 1.6, ['rgba(255,240,200,0.55)', 'rgba(255,240,200,0)']));
  shape(ctx, circle(x, y, r), rgrad(ctx, x - r * 0.35, y - r * 0.35, r * 0.1, r * 1.05, ['#fffbea', '#f5e6b8', '#d9c084']), { w: 0.8 });
  // rabbit crouched facing left, ears up
  const rb = new Path2D();
  const s = r / 20;
  rb.ellipse(x + 2 * s, y + 5 * s, 8 * s, 6 * s, -0.15, 0, TAU);
  rb.moveTo(x - 3 * s, y - 2 * s);
  rb.ellipse(x - 5 * s, y - 1 * s, 4.4 * s, 3.8 * s, 0, 0, TAU);
  rb.moveTo(x - 4 * s, y - 4 * s);
  rb.ellipse(x - 3 * s, y - 10 * s, 1.5 * s, 6.5 * s, 0.35, 0, TAU);
  rb.moveTo(x - 1 * s, y - 4 * s);
  rb.ellipse(x - 0.5 * s, y - 9.5 * s, 1.4 * s, 6 * s, 0.6, 0, TAU);
  rb.moveTo(x + 10 * s, y + 4 * s);
  rb.arc(x + 9.6 * s, y + 3 * s, 2 * s, 0, TAU);
  fill(ctx, rb, 'rgba(176,132,64,0.75)');
  stroke(ctx, circle(x, y, r * 0.86), 'rgba(176,132,64,0.5)', Math.max(0.4, r * 0.04));
}

// ------------------------------------------------------------ architecture
// Bell-shaped chedi silhouette path (base at y, height h).
export function chediPath(x, y, h) {
  const w = h * 0.42;
  const p = new Path2D();
  p.moveTo(x - w, y);
  p.lineTo(x - w, y - h * 0.06); p.lineTo(x - w * 0.85, y - h * 0.06); p.lineTo(x - w * 0.85, y - h * 0.12);
  p.lineTo(x - w * 0.7, y - h * 0.12); p.lineTo(x - w * 0.7, y - h * 0.18);
  p.bezierCurveTo(x - w * 0.72, y - h * 0.4, x - w * 0.45, y - h * 0.5, x - w * 0.22, y - h * 0.52);
  p.lineTo(x - w * 0.22, y - h * 0.58); p.lineTo(x - w * 0.12, y - h * 0.58);
  p.lineTo(x - w * 0.03, y - h); p.lineTo(x + w * 0.03, y - h);
  p.lineTo(x + w * 0.12, y - h * 0.58); p.lineTo(x + w * 0.22, y - h * 0.58); p.lineTo(x + w * 0.22, y - h * 0.52);
  p.bezierCurveTo(x + w * 0.45, y - h * 0.5, x + w * 0.72, y - h * 0.4, x + w * 0.7, y - h * 0.18);
  p.lineTo(x + w * 0.7, y - h * 0.12); p.lineTo(x + w * 0.85, y - h * 0.12); p.lineTo(x + w * 0.85, y - h * 0.06);
  p.lineTo(x + w, y - h * 0.06); p.lineTo(x + w, y);
  p.closePath();
  return p;
}
// Khmer-style prang (corn-cob tower).
export function prangPath(x, y, h) {
  const w = h * 0.24;
  const pts = [[x - w * 1.25, y], [x - w * 1.25, y - h * 0.08], [x - w, y - h * 0.08], [x - w, y - h * 0.38]];
  for (let k = 0; k < 4; k++) {
    const yy = y - h * (0.38 + k * 0.12), ww = w * (1 - k * 0.2);
    pts.push([x - ww * 1.08, yy], [x - ww * 0.92, yy - h * 0.1]);
  }
  pts.push([x - w * 0.12, y - h * 0.88], [x, y - h]);
  const right = pts.slice(0, -1).map(([px, py]) => [2 * x - px, py]).reverse();
  return poly([...pts, ...right]);
}
// Ubosot hall: tiered gable roof with ช่อฟ้า finials, columns, base.
export function ubosot(ctx, x, y, w, h, { roof = M.verm, roof2 = M.jade, gable = M.gold, wall = M.cream, ink = M.ink } = {}) {
  const hw = w / 2;
  // base
  shape(ctx, poly([[x - hw * 0.95, y], [x + hw * 0.95, y], [x + hw * 0.88, y - h * 0.08], [x - hw * 0.88, y - h * 0.08]]), M.creamD, { w: 0.6 });
  // walls & columns
  shape(ctx, poly([[x - hw * 0.8, y - h * 0.08], [x + hw * 0.8, y - h * 0.08], [x + hw * 0.8, y - h * 0.38], [x - hw * 0.8, y - h * 0.38]]), wall, { w: 0.6 });
  for (let i = -3; i <= 3; i++) shape(ctx, poly([[x + i * hw * 0.25 - 1.1, y - h * 0.08], [x + i * hw * 0.25 + 1.1, y - h * 0.08], [x + i * hw * 0.25 + 1.1, y - h * 0.38], [x + i * hw * 0.25 - 1.1, y - h * 0.38]]), M.red, { w: 0.3 });
  fill(ctx, poly([[x - 3, y - h * 0.08], [x + 3, y - h * 0.08], [x + 3, y - h * 0.26], [x, y - h * 0.3], [x - 3, y - h * 0.26]]), M.ink);
  // three roof tiers, back to front
  const tiers = [[0.98, 0.35, 0.95, roof2], [0.82, 0.42, 1.0, roof], [0.62, 0.5, 1.0, roof]];
  tiers.forEach(([k, base, top, col], i) => {
    const ww = hw * k * 1.15, by = y - h * (0.36 + i * 0.03), ty = y - h * top;
    const p = poly([[x - ww, by], [x - ww * 0.18, ty + h * 0.06], [x, ty], [x + ww * 0.18, ty + h * 0.06], [x + ww, by], [x + ww * 0.84, by + h * 0.04], [x - ww * 0.84, by + h * 0.04]]);
    shape(ctx, p, col, { w: 0.6 });
    stroke(ctx, lin([[x - ww, by], [x - ww * 0.18, ty + h * 0.06], [x, ty], [x + ww * 0.18, ty + h * 0.06], [x + ww, by]]), gable, 1.1);
    // ช่อฟ้า / hang hong hooks
    for (const s of [-1, 1]) stroke(ctx, lin([[x + s * ww, by], [x + s * ww * 1.06, by - h * 0.06], [x + s * ww * 1.0, by - h * 0.09]]), gable, 1);
    void base;
  });
  // gable triangle with a tiny prajam
  const gy = y - h * 0.42;
  shape(ctx, poly([[x - hw * 0.34, gy], [x, gy - h * 0.38], [x + hw * 0.34, gy]]), gable, { w: 0.5 });
  fill(ctx, circle(x, gy - h * 0.12, Math.max(0.8, h * 0.05)), M.red);
  stroke(ctx, lin([[x, y - h * 1.0], [x + 1.5, y - h * 1.1], [x + 0.5, y - h * 1.14]]), gable, 1);
}

// ------------------------------------------------------------ flora
// Mural tree: a trunk with rounded canopy clumps patterned with leaf ticks.
export function muralTree(ctx, x, y, h, { leaf = M.jade, leafD = M.jadeD, trunk = M.brown, seed = 4, flowers = null } = {}) {
  const r = rng(seed);
  shape(ctx, poly(tubePts([[x, y], [x - h * 0.03, y - h * 0.35], [x + h * 0.02, y - h * 0.62]], [h * 0.06, h * 0.045, h * 0.03])), trunk, { w: 0.6 });
  const clumps = [[0, -0.72, 0.3], [-0.24, -0.58, 0.22], [0.24, -0.6, 0.23], [-0.12, -0.9, 0.2], [0.14, -0.88, 0.2]];
  for (const [u, v, k] of clumps) {
    const cx = x + u * h, cy = y + v * h, rr = k * h;
    const p = new Path2D();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      p.moveTo(cx + Math.cos(a) * rr * 0.72 + rr * 0.3, cy + Math.sin(a) * rr * 0.72);
      p.arc(cx + Math.cos(a) * rr * 0.72, cy + Math.sin(a) * rr * 0.72, rr * 0.3, 0, TAU);
    }
    p.moveTo(cx + rr * 0.8, cy); p.arc(cx, cy, rr * 0.8, 0, TAU);
    stroke(ctx, p, M.ink, 1.6);
    fill(ctx, p, rgrad(ctx, cx - rr * 0.3, cy - rr * 0.4, rr * 0.1, rr * 1.1, [M.jadeL, leaf, leafD]));
  }
  for (const [u, v, k] of clumps) {
    const cx = x + u * h, cy = y + v * h, rr = k * h;
    for (let i = 0; i < 7; i++) {
      const a = r() * TAU, d = r() * rr * 0.75;
      const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
      if (flowers && r() < 0.35) fill(ctx, circle(px, py, Math.max(0.7, rr * 0.09)), flowers);
      else stroke(ctx, lin([[px - rr * 0.1, py + rr * 0.06], [px, py - rr * 0.06], [px + rr * 0.1, py + rr * 0.06]]), M.jadeL, Math.max(0.5, rr * 0.06), 0.9);
    }
  }
}

// เขามอ — stepped mural rocks (stacked angular blocks with curled tops).
export function khaoMo(ctx, x, y, w, h, { col = M.teal, hi = '#7fb7a4', seed = 6 } = {}) {
  const r = rng(seed);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const bw = w * (0.32 + r() * 0.14), bh = h * (0.32 + Math.sin(t * Math.PI) * 0.6) * (0.8 + r() * 0.3);
    const bx = x - w / 2 + t * (w - bw) , by = y;
    const p = poly([[bx, by], [bx + bw * 0.05, by - bh * 0.8], [bx + bw * 0.3, by - bh], [bx + bw * 0.7, by - bh * 0.96], [bx + bw * 0.95, by - bh * 0.7], [bx + bw, by]]);
    shape(ctx, p, vgrad(ctx, by - bh, by, [hi, col, M.indigoD]), { w: 0.6 });
    stroke(ctx, lin([[bx + bw * 0.3, by - bh + 1], [bx + bw * 0.42, by - bh * 0.75], [bx + bw * 0.62, by - bh * 0.78]]), 'rgba(255,255,255,0.7)', 0.7);
  }
}

// Lotus flower (บัว) seen from the side.
export function lotus(ctx, x, y, s, { petal = M.pink, petalD = M.rose, leaf = M.jade } = {}) {
  const pet = (a, len, wid, col) => {
    const c = Math.cos(a), si = Math.sin(a);
    const tip = [x + c * len, y + si * len];
    const p = new Path2D();
    p.moveTo(x, y);
    p.quadraticCurveTo(x + c * len * 0.5 - si * wid, y + si * len * 0.5 + c * wid, tip[0], tip[1]);
    p.quadraticCurveTo(x + c * len * 0.5 + si * wid, y + si * len * 0.5 - c * wid, x, y);
    shape(ctx, p, col, { w: 0.45 });
  };
  for (const a of [-2.6, -0.54]) pet(a, s * 0.9, s * 0.35, petalD);
  for (const a of [-2.2, -0.94]) pet(a, s * 1.05, s * 0.38, petal);
  pet(-Math.PI / 2, s * 1.2, s * 0.4, petal);
  void leaf;
}

// ------------------------------------------------------------ frames
// Pointed Thai arch (ซุ้ม) outline from (x0, ySide) to (x1, ySide).
export function archPts(x0, x1, ySide, h, n = 22, R = 1.35) {
  const w = (x1 - x0) / 2, rr = R * w;
  const th = Math.acos(1 - w / rr);
  const yk = h / (rr * Math.sin(th));
  const left = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * th;
    left.push([x0 + rr - rr * Math.cos(a), ySide - rr * Math.sin(a) * yk]);
  }
  const right = left.slice(0, -1).map(([x, y]) => [x0 + x1 - x, y]).reverse();
  return [...left, ...right];
}

// The weather plaque: a gilded ซุ้ม window frame with kanok flames along
// its arch, a lotus base and ประจำยาม corners. `scene(ctx, inner)` paints
// the field (it is clipped). Returns the inner path.
export function weatherFrame(ctx, scene, { band = M.red, flame = M.gold, flameIn = M.verm, sky } = {}) {
  const outerArch = archPts(8, 112, 50, 40);
  const outer = [[8, 108], ...outerArch, [112, 108]];
  const innerArch = archPts(17, 103, 54, 33);
  const inner = [[17, 101], ...innerArch, [103, 101]];
  const outerP = poly(outer), innerP = poly(inner);
  // flames on the arch and the tall finial (cut into the same hide)
  const flames = resample(outerArch, 9.2, false).slice(1, -1).filter(([x]) => Math.abs(x - 60) > 9);
  leather(ctx, outerP, { edge: false });
  for (const [x, y, a] of flames) {
    const left = x < 60;
    const out = a - Math.PI / 2;
    kanok(ctx, x, y, 10.5, out + (left ? 0.35 : -0.35), !left, { fill: flame, inner: flameIn, w: 0.55 });
  }
  kanok(ctx, 60, 12, 17, -Math.PI / 2, false, { fill: flame, inner: flameIn, w: 0.6 });
  // base plinth with a lotus band
  const base = poly([[2, 106], [118, 106], [116, 118], [4, 118]]);
  leather(ctx, base, { edge: false });
  // frame band
  const bandP = new Path2D();
  bandP.addPath(outerP);
  bandP.addPath(innerP);
  ctx.save();
  ctx.fillStyle = goldG(ctx, 0, 0, 120, 120);
  ctx.fill(bandP, 'evenodd');
  ctx.restore();
  stroke(ctx, outerP, M.ink, 1.6);
  // field
  clip(ctx, innerP, () => {
    fill(ctx, innerP, sky || M.indigo);
    scene(ctx);
  });
  // inner red fillet with punched beads
  const fil = archPts(14, 106, 52, 36.5);
  const filP = [[14, 103], ...fil, [106, 103]];
  stroke(ctx, poly(filP, false), band, 3);
  stroke(ctx, poly(filP, false), M.ink, 0.5, 0.8);
  dotLine(ctx, filP, { spacing: 3.6, r: 0.75, smoothIt: false, jitter: 0, seed: 2 });
  stroke(ctx, innerP, M.ink, 1.3);
  krajangs(ctx, archPts(17.5, 102.5, 54.5, 33, 22).reverse(), 4.6, { gold: M.gold, inner: band, gap: 1.0, w: 0.4 });
  scroll(ctx, [[10.6, 106], ...archPts(10.6, 109.4, 50.4, 39), [109.4, 106]], { amp: 1.1, step: 6.5, curl: 1.1, w: 0.5 });
  // plinth
  fill(ctx, base, goldG(ctx, 0, 104, 0, 120));
  stroke(ctx, base, M.ink, 1);
  fill(ctx, poly([[8, 110], [112, 110], [111, 114.5], [9, 114.5]]), band);
  dotLine(ctx, [[10, 112.2], [110, 112.2]], { spacing: 3.6, r: 0.8, smoothIt: false, jitter: 0, seed: 4 });
  for (const x of [11, 109]) prajam(ctx, x, 104, 6, { petal: M.goldL, core: band });
  prajam(ctx, 60, 104.5, 5, { petal: M.goldL, core: band });
  return innerP;
}

// The spell medallion: a disc in a flame halo (ประภามณฑล) with a gold
// beaded ring. `motif(ctx)` paints inside the field (clipped, r = 34).
export function medallion(ctx, motif, { field = M.indigo, field2 = M.indigoD, ring = M.red, flame = M.gold, flameIn = M.verm } = {}) {
  const cx = 60, cy = 60;
  const disc = circle(cx, cy, 47);
  leather(ctx, disc, { edge: false });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU - Math.PI / 2;
    kanok(ctx, cx + Math.cos(a) * 44, cy + Math.sin(a) * 44, i % 2 ? 9 : 12.5, a + 0.25, false, { fill: i % 2 ? flameIn : flame, inner: i % 2 ? M.goldL : flameIn, w: 0.55 });
  }
  shape(ctx, disc, goldG(ctx, 14, 14, 106, 106), { w: 0.9 });
  const rb = circle(cx, cy, 41);
  shape(ctx, rb, ring, { w: 0.5 });
  dotLine(ctx, Array.from({ length: 64 }, (_, i) => [cx + Math.cos(i / 64 * TAU) * 41, cy + Math.sin(i / 64 * TAU) * 41]), { closed: true, spacing: 3.7, r: 0.85, smoothIt: false, jitter: 0 });
  const inner = circle(cx, cy, 36);
  shape(ctx, inner, goldG(ctx, 30, 30, 90, 90), { w: 0.5 });
  const fieldP = circle(cx, cy, 34);
  shape(ctx, fieldP, rgrad(ctx, cx, cy - 6, 4, 36, [field, field2]), { w: 0.6 });
  clip(ctx, fieldP, () => motif(ctx));
  stroke(ctx, fieldP, M.ink, 0.9);
  // four ประจำยาม on the ring at the diagonals
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4;
    prajam(ctx, cx + Math.cos(a) * 41, cy + Math.sin(a) * 41, 5.2, { petal: M.goldL, core: ring });
  }
}

// The scene plaque (140 x 100): a gilded proscenium with a flame crest,
// ช่อฟ้า hooks, columns and a lotus base; scene(ctx) paints the cloth.
export function sceneFrame(ctx, scene, { cloth = [M.cream, M.creamD], band = M.red } = {}) {
  const outer = [[4, 98], [4, 24], ...archPts(4, 136, 24, 18, 24, 2.2), [136, 24], [136, 98]];
  const outerP = poly(outer);
  const innerP = poly([[15, 87], [15, 31], ...archPts(15, 125, 31, 13, 24, 2.2), [125, 31], [125, 87]]);
  leather(ctx, outerP, { edge: false });
  // crest flames along the lintel, a central finial and corner hooks
  const crest = archPts(4, 136, 24, 18, 24, 2.2);
  for (const [x, y, a] of resample(crest, 10, false).slice(1, -1).filter(([x]) => Math.abs(x - 70) > 10)) {
    const left = x < 70;
    kanok(ctx, x, y, 9.5, a - Math.PI / 2 + (left ? 0.45 : -0.45), !left, { fill: M.gold, inner: M.verm, w: 0.5 });
  }
  kanok(ctx, 70, 8, 13, -Math.PI / 2, false, { fill: M.gold, inner: M.verm, w: 0.55 });
  for (const s of [-1, 1]) {
    const x = 70 + s * 66;
    kanok(ctx, x, 24, 11, -Math.PI / 2 - s * 0.9, s > 0, { fill: M.gold, inner: M.verm, w: 0.5 });
  }
  const bandP = new Path2D();
  bandP.addPath(outerP); bandP.addPath(innerP);
  ctx.save(); ctx.fillStyle = goldG(ctx, 0, 0, 140, 100); ctx.fill(bandP, 'evenodd'); ctx.restore();
  stroke(ctx, outerP, M.ink, 1.5);
  clip(ctx, innerP, () => {
    fill(ctx, innerP, Array.isArray(cloth) ? vgrad(ctx, 26, 88, cloth) : cloth);
    scene(ctx);
    // warm lamp vignette on the cloth
    fill(ctx, innerP, rgrad(ctx, 70, 56, 20, 72, ['rgba(255,230,170,0)', 'rgba(60,20,0,0.35)']));
  });
  // red fillet with beads
  const fil = [[11, 90], [11, 28], ...archPts(11, 129, 28, 15.5, 24, 2.2), [129, 28], [129, 90]];
  stroke(ctx, poly(fil, false), band, 2.8);
  dotLine(ctx, fil, { spacing: 3.6, r: 0.72, smoothIt: false, jitter: 0, seed: 6 });
  stroke(ctx, innerP, M.ink, 1.2);
  krajangs(ctx, archPts(15.5, 124.5, 31.5, 13, 24, 2.2).reverse(), 4.4, { gold: M.gold, inner: band, gap: 1.0, w: 0.4 });
  scroll(ctx, [[7.2, 86], [7.2, 26], ...archPts(7.2, 132.8, 26, 17, 24, 2.2), [132.8, 26], [132.8, 86]], { amp: 1, step: 6.5, curl: 1, w: 0.5 });
  // base
  const base = poly([[0, 88], [140, 88], [138, 100], [2, 100]]);
  leather(ctx, base, { edge: false });
  fill(ctx, base, goldG(ctx, 0, 88, 0, 100));
  stroke(ctx, base, M.ink, 1);
  fill(ctx, poly([[5, 92.5], [135, 92.5], [134.5, 96.5], [5.5, 96.5]]), band);
  dotLine(ctx, [[7, 94.5], [133, 94.5]], { spacing: 3.6, r: 0.8, smoothIt: false, jitter: 0, seed: 7 });
  for (const x of [8, 70, 132]) prajam(ctx, x, 88.5, 5.2, { petal: M.goldL, core: band });
  return innerP;
}

export { hole, holes, dotLine, circle };
