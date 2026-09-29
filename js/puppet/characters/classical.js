// Classical หนังตะลุง figures from the Ramakien / royal repertoire:
// พระเอก (prince), ยักษ์ (demon), หนุมาน (Hanuman), พญา (king) and
// เทวดา (deva). Every part is cut and painted procedurally with the
// leather toolkit in the same style as the uploaded part sheets: near-black
// hide, vermilion / green / amber dyes, gold fine lines and dense rows of
// white perforation dots following every contour.
//
// Authoring convention: each part is drawn in shared FIGURE coordinates
// (the whole puppet standing in its neutral pose, facing +x, spire tip near
// y = 0), inside its own box [x0, y0, x1, y1]. Joints are given once in
// figure coords; `at` / `pivot` are derived from the two boxes so every
// rest rotation is 0.

import {
  INK, paintSprite, leather, dye, line, hole, holes, slit, cut, curve, smooth, poly,
  ellipsePts, blobPts, inset, resample, rng, krajangPath, kanokPts, rivet,
} from '../../art/leather.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

// ================================================================ geometry
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const T = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
function unit(x, y) {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

// Offset an open polyline sideways by d (positive = left of travel on
// screen, i.e. "up" for a left-to-right line).
function offset(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const [tx, ty] = unit(b[0] - a[0], b[1] - a[1]);
    return [p[0] + ty * d, p[1] - tx * d];
  });
}

// Densified smooth curve.
const C = (pts, closed = false, steps = 8) => curve(pts, closed, steps);

// Hand-cut irregularity.
function wob(pts, amt = 0.6, seed = 1) {
  const r = rng(seed);
  return pts.map(([x, y]) => [x + (r() - 0.5) * amt * 2, y + (r() - 0.5) * amt * 2]);
}

// Outline of a limb segment (paddle rounded at both ends) between joints.
function paddle(a, b, ra, rb, { bulge = 0.06, ext = 0, extA = 0, n = 10 } = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const A = [a[0] - ux * extA, a[1] - uy * extA], B = [b[0] + ux * ext, b[1] + uy * ext];
  const LL = L + ext + extA;
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, r = ra + (rb - ra) * t + Math.sin(t * Math.PI) * bulge * L;
    out.push([A[0] + ux * LL * t + nx * r, A[1] + uy * LL * t + ny * r]);
  }
  for (let i = 1; i < 8; i++) {
    const t = (i / 8) * Math.PI;
    out.push([B[0] + ux * Math.sin(t) * rb + nx * Math.cos(t) * rb, B[1] + uy * Math.sin(t) * rb + ny * Math.cos(t) * rb]);
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n, r = ra + (rb - ra) * t + Math.sin(t * Math.PI) * bulge * L;
    out.push([A[0] + ux * LL * t - nx * r, A[1] + uy * LL * t - ny * r]);
  }
  for (let i = 1; i < 8; i++) {
    const t = (i / 8) * Math.PI;
    out.push([A[0] - ux * Math.sin(t) * ra - nx * Math.cos(t) * ra, A[1] - uy * Math.sin(t) * ra - ny * Math.cos(t) * ra]);
  }
  return out;
}

// Point at fraction t across a paddle, and the local frame.
function frame(a, b) {
  const [ux, uy] = unit(b[0] - a[0], b[1] - a[1]);
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { ux, uy, nx: -uy, ny: ux, L, at: (t, s = 0) => [a[0] + (b[0] - a[0]) * t - uy * s, a[1] + (b[1] - a[1]) * t + ux * s] };
}

// Tapering curved horn / flame tongue / wing: centreline from `base` along
// angle `ang` (rad), turning by `bend` rad over its length, width w0 at the
// base narrowing to w1 at the tip. Returns a closed outline.
function hornPts(base, len, ang, bend, w0, { w1 = 0, n = 14, taper = 1, swell = 0 } = {}) {
  const c = [];
  let a = ang, [x, y] = base;
  for (let i = 0; i <= n; i++) {
    c.push([x, y]);
    a = ang + bend * ((i + 0.5) / n);
    x += (Math.cos(a) * len) / n; y += (Math.sin(a) * len) / n;
  }
  const L = [], R = [];
  c.forEach((p, i) => {
    const t = i / n;
    const q = c[Math.min(n, i + 1)], o = c[Math.max(0, i - 1)];
    const [tx, ty] = unit(q[0] - o[0], q[1] - o[1]);
    const hw = (lerp(w0, w1, Math.pow(t, taper)) + Math.sin(t * Math.PI) * swell) / 2;
    L.push([p[0] + ty * hw, p[1] - tx * hw]); R.push([p[0] - ty * hw, p[1] + tx * hw]);
  });
  return [...L, c[n], ...R.reverse()];
}

// Spiral curl (moustache, brow tail, hair lock) as a centreline.
function spiral(c, r0, a0, turns, dir = 1, n = 30) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + dir * t * turns * TAU, r = r0 * (1 - 0.8 * t);
    out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  return out;
}

// Stroke with a tapering width along a centreline (brush stroke), as an
// outline polygon.
function brush(pts, w0, w1 = 0.4) {
  const c = pts, n = c.length - 1, L = [], R = [];
  c.forEach((p, i) => {
    const q = c[Math.min(n, i + 1)], o = c[Math.max(0, i - 1)];
    const [tx, ty] = unit(q[0] - o[0], q[1] - o[1]);
    const hw = lerp(w0, w1, i / n) / 2;
    L.push([p[0] + ty * hw, p[1] - tx * hw]); R.push([p[0] - ty * hw, p[1] + tx * hw]);
  });
  return [...L, ...R.reverse()];
}

// Finishing for a flame/wing piece: gold edge, coloured heart, dotted rows.
function flameDeco(ctx, pts, { cols = [INK.gold, INK.red, INK.green], seed = 1, d = [1.2, 3.6, 6.6] } = {}) {
  cols.forEach((c, i) => dye(ctx, smooth(inset(pts, d[i]), true), c, 0.9));
  dots(ctx, inset(pts, (d[0] + d[1]) / 2), { sp: 2.7, r: 0.75, closed: true, seed, punch: 0.3 });
  if (cols.length > 2) dots(ctx, inset(pts, (d[1] + d[2]) / 2), { sp: 2.8, r: 0.7, closed: true, seed: seed + 1, punch: 0.3 });
}

// ================================================================ painting
// Painted cream dots (look like the sheets' white dotting both front- and
// back-lit); a fraction `punch` of them is punched right through instead.
function dots(ctx, pts, { sp = 3.7, r = 1.05, vary = 0.35, jit = 0.18, closed = false, seed = 1, col = INK.white, punch = 0.2, sm = true } = {}) {
  const rr = rng(seed);
  const src = sm && pts.length > 2 ? curve(pts, closed, 8) : pts;
  const s = resample(src, sp, closed);
  const paint = new Path2D(), pun = new Path2D();
  for (const [x, y] of s) {
    const q = r * (1 - vary / 2 + rr() * vary);
    const px = x + (rr() - 0.5) * jit * sp, py = y + (rr() - 0.5) * jit * sp;
    const P = rr() < punch ? pun : paint;
    P.moveTo(px + q, py);
    P.arc(px, py, q, 0, TAU);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = col;
  ctx.fill(paint);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(pun);
  ctx.restore();
  return s;
}

// Single painted dot / punched hole list.
function spots(ctx, list, r, { col = INK.white, punch = false } = {}) {
  const p = new Path2D();
  for (const [x, y, q] of list) {
    const rr = q ?? r;
    p.moveTo(x + rr, y);
    p.arc(x, y, rr, 0, TAU);
  }
  ctx.save();
  ctx.globalCompositeOperation = punch ? 'destination-out' : 'source-atop';
  ctx.fillStyle = col;
  ctx.fill(p);
  ctx.restore();
}

// Row of short cream dashes (the "rice grain" dotting of the sheets),
// oriented across (`across` = true) or along the path.
function grains(ctx, pts, { sp = 3.4, len = 2.6, w = 1.2, across = true, closed = false, col = INK.white, seed = 3, punch = 0 } = {}) {
  const rr = rng(seed);
  const s = resample(curve(pts, closed, 8), sp, closed);
  const p = new Path2D(), q = new Path2D();
  for (const [x, y, a] of s) {
    const ang = a + (across ? Math.PI / 2 : 0) + (rr() - 0.5) * 0.25;
    const l = len * (0.8 + rr() * 0.4);
    const c = Math.cos(ang) * l / 2, sn = Math.sin(ang) * l / 2;
    const P = rr() < punch ? q : p;
    P.moveTo(x - c, y - sn);
    P.lineTo(x + c, y + sn);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.stroke(p);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.stroke(q);
  ctx.restore();
}

// Painted stroke that stays on the hide.
function ink(ctx, pts, col, w, { closed = false, alpha = 1, sm = true } = {}) {
  return line(ctx, pts, col, w, { closed, alpha, smoothIt: sm });
}
const goldL = (ctx, pts, w = 1.1, o = {}) => ink(ctx, pts, INK.goldLine, w, o);

// Dyed field with the standard finishing: gold rule just inside the edge
// and a row of dots inside that.
function panel(ctx, pts, { fill, alpha = 0.9, edge = INK.goldLine, ew = 1, d1 = 1.6, d2 = 3.6, dotsOn = true, sp = 3.4, r = 0.85, seed = 5, punch = 0.15 } = {}) {
  const path = smooth(pts, true);
  if (fill) dye(ctx, path, fill, alpha);
  if (edge) ink(ctx, inset(pts, d1), edge, ew, { closed: true });
  if (dotsOn) dots(ctx, inset(pts, d2), { sp, r, closed: true, seed, punch });
  return path;
}

// Contour dotting for a whole silhouette.
function rim(ctx, pts, { d = 2.7, sp = 3.6, r = 1.05, seed = 2, gold = true, gd = 5, punch = 0.25 } = {}) {
  dots(ctx, inset(pts, d), { sp, r, closed: true, seed, punch });
  if (gold) ink(ctx, inset(pts, gd), INK.goldLine, 0.8, { closed: true, alpha: 0.9 });
}

// Band along a path: dyed stripe between two gold rules, dotted centre.
function stripe(ctx, pts, w, { fill = INK.red, alpha = 0.92, edge = INK.goldLine, ew = 0.9, dot = true, sp, r, seed = 7, grain = false } = {}) {
  const cp = C(pts, false, 8);
  ink(ctx, cp, fill, w, { sm: false, alpha });
  if (edge) {
    ink(ctx, offset(cp, w / 2 - ew / 2), edge, ew, { sm: false });
    ink(ctx, offset(cp, -w / 2 + ew / 2), edge, ew, { sm: false });
  }
  if (dot) {
    if (grain) grains(ctx, cp, { sp: sp ?? w * 0.7, len: w * 0.45, w: Math.max(0.8, w * 0.16), seed });
    else dots(ctx, cp, { sp: sp ?? Math.max(2.6, w * 0.8), r: r ?? Math.max(0.6, w * 0.17), seed, sm: false });
  }
}

// Teardrop petal Path2D, base at (x,y), pointing along ang.
function petalPath(x, y, len, wid, ang, P = new Path2D()) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const at = (u, v) => [x + c * u - s * v, y + s * u + c * v];
  const b = at(0, 0), l = at(len * 0.45, -wid), r2 = at(len * 0.45, wid), t = at(len, 0);
  const lc = at(len * 0.9, -wid * 0.6), rc = at(len * 0.9, wid * 0.6);
  P.moveTo(...b);
  P.bezierCurveTo(l[0], l[1], lc[0], lc[1], t[0], t[1]);
  P.bezierCurveTo(rc[0], rc[1], r2[0], r2[1], b[0], b[1]);
  return P;
}

// ดอกไม้ — the sheets' painted flower: red petals edged cream round a
// gold centre, punched eye.
function flower(ctx, x, y, R, { n = 8, fill = INK.red, edge = INK.white, core = INK.gold, rot = 0, punch = true, ew } = {}) {
  const P = new Path2D();
  for (let k = 0; k < n; k++) petalPath(x, y, R, R * (n > 6 ? 0.36 : 0.5), rot + (k / n) * TAU, P);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = fill;
  ctx.fill(P);
  ctx.strokeStyle = edge;
  ctx.lineWidth = ew ?? Math.max(0.55, R * 0.13);
  ctx.stroke(P);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, R * 0.36, 0, TAU);
  ctx.fill();
  ctx.fillStyle = INK.red;
  ctx.beginPath();
  ctx.arc(x, y, R * 0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (punch) hole(ctx, x, y, Math.max(0.5, R * 0.1));
}

// Jewel: gold ring, red (or green) stone, cream glint.
function gem(ctx, x, y, r, { col = INK.red, ring = INK.gold } = {}) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = ring;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, TAU); ctx.fill();
  ctx.fillStyle = INK.white;
  ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.2, 0, TAU); ctx.fill();
  ctx.restore();
}

// Row of กระจัง leaves standing on the LEFT normal of a path (flip to hang
// them on the other side).
function fringe(ctx, pts, size, { col = INK.gold, inner = INK.red, flip = false, gap = 0.95, h = 1.35, punch = true, edge = INK.white } = {}) {
  const s = resample(C(pts, false, 8), size * gap, false);
  const P = new Path2D(), Q = new Path2D();
  const holesL = [];
  for (const [x, y, a] of s) {
    const up = a + (flip ? Math.PI / 2 : -Math.PI / 2);
    P.addPath(krajangPath(x, y, size, size * h, up));
    Q.addPath(krajangPath(x + Math.cos(up) * size * 0.12, y + Math.sin(up) * size * 0.12, size * 0.5, size * h * 0.62, up));
    holesL.push([x + Math.cos(up) * size * 0.5, y + Math.sin(up) * size * 0.5]);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = col; ctx.fill(P);
  ctx.fillStyle = inner; ctx.fill(Q);
  if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 0.5; ctx.stroke(P); }
  ctx.restore();
  if (punch) holes(ctx, holesL, Math.max(0.45, size * 0.09));
  return s;
}

// Krajang leaves as silhouette: returns outline points of a band edge
// with pointed leaves along it (for cutting scalloped hems).
function scallopEdge(pts, size, { flip = false, h = 1, pointy = true } = {}) {
  const s = resample(C(pts, false, 8), size, false);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const [x, y, a] = s[i];
    const up = a + (flip ? Math.PI / 2 : -Math.PI / 2);
    out.push([x, y]);
    if (i < s.length - 1) {
      const [x2, y2] = s[i + 1];
      const mx = (x + x2) / 2, my = (y + y2) / 2;
      out.push([mx + Math.cos(up) * size * h * (pointy ? 1 : 0.6), my + Math.sin(up) * size * h * (pointy ? 1 : 0.6)]);
    }
  }
  return out;
}

// Lace: openwork field of the sheets — a hex lattice of cream dots and
// punched quatrefoils clipped to a region.
function lace(ctx, pts, { sp = 6, r = 0.9, style = 'quad', seed = 11, punch = 0.35, col = INK.white } = {}) {
  const path = smooth(pts, true);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const rr = rng(seed);
  const paint = new Path2D(), pun = new Path2D();
  const dot = (P, x, y, q) => { P.moveTo(x + q, y); P.arc(x, y, q, 0, TAU); };
  let row = 0;
  for (let y = y0; y <= y1 + sp; y += sp * 0.866, row++) {
    for (let x = x0 + (row % 2 ? sp / 2 : 0); x <= x1 + sp; x += sp) {
      const P = rr() < punch ? pun : paint;
      if (style === 'quad') {
        dot(P, x, y, r * 1.1);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * TAU + Math.PI / 4;
          dot(paint, x + Math.cos(a) * r * 2.2, y + Math.sin(a) * r * 2.2, r * 0.7);
        }
      } else if (style === 'grain') {
        P.moveTo(x - r * 1.4, y - r * 0.6);
        P.ellipse(x, y, r * 1.5, r * 0.75, 0.6, 0, TAU);
      } else if (style === 'diamond') {
        P.moveTo(x, y - r * 1.8); P.lineTo(x + r * 1.1, y); P.lineTo(x, y + r * 1.8); P.lineTo(x - r * 1.1, y); P.closePath();
      } else dot(P, x, y, r * (0.8 + rr() * 0.4));
    }
  }
  ctx.save();
  ctx.clip(path);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = col;
  ctx.fill(paint);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(pun);
  ctx.restore();
}

// Diamond lattice of gold lines with a dot in each cell (brocade).
function brocade(ctx, pts, { sp = 8, col = INK.goldLine, w = 0.6, dotR = 0.8, seed = 13, flowers = false } = {}) {
  const path = smooth(pts, true);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  ctx.save();
  ctx.clip(path);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath();
  const H = y1 - y0 + (x1 - x0);
  for (let k = -H; k < H; k += sp) {
    ctx.moveTo(x0 + k, y0); ctx.lineTo(x0 + k + H, y0 + H);
    ctx.moveTo(x0 + k, y0); ctx.lineTo(x0 + k - H, y0 + H);
  }
  ctx.stroke();
  ctx.restore();
  const cells = [];
  for (let y = y0 + sp / 2, row = 0; y < y1; y += sp / 2, row++) {
    for (let x = x0 + (row % 2 ? sp / 2 : 0); x < x1; x += sp) cells.push([x, y]);
  }
  ctx.save();
  ctx.clip(path);
  if (flowers) for (const [x, y] of cells) flower(ctx, x, y, sp * 0.26, { n: 4, punch: false, ew: 0.4 });
  else spots(ctx, cells, dotR);
  ctx.restore();
}

// Armour scales (เกล็ด): rows of gold arcs with a cream dot in each.
function scales(ctx, pts, { sp = 7, col = INK.goldLine, w = 0.9, dotR = 0.9, seed = 17 } = {}) {
  const path = smooth(pts, true);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const arcs = new Path2D(), cells = [];
  for (let y = y0, row = 0; y < y1 + sp; y += sp * 0.62, row++) {
    for (let x = x0 + (row % 2) * sp * 0.5; x < x1 + sp; x += sp) {
      arcs.moveTo(x + sp * 0.5, y);
      arcs.arc(x, y, sp * 0.5, 0, Math.PI);
      cells.push([x, y + sp * 0.2]);
    }
  }
  ctx.save();
  ctx.clip(path);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(arcs);
  ctx.restore();
  ctx.save(); ctx.clip(path); spots(ctx, cells, dotR); ctx.restore();
  void seed;
}

// Silhouette + finishing helper: leather + optional dye.
function hide(ctx, pts, fill, alpha = 0.9) {
  const p = leather(ctx, smooth(pts, true));
  if (fill) dye(ctx, inset(pts, 1.2), fill, alpha);
  return p;
}

// ================================================================ bodies
// Local frame for hands: u runs from the wrist toward the fingertips
// (along `dir`), v runs across; with side = +1 and dir pointing down, +v
// is +x (forward).
function handFrame(W, dir, side = 1, k = 1) {
  const [ux, uy] = dir;
  const nx = uy * side, ny = -ux * side;
  return (u, v) => [W[0] + (ux * u + nx * v) * k, W[1] + (uy * u + ny * v) * k];
}

// One finger as outline points: from `start` along angle `ang`, curling
// by `curl` radians toward the tip.
function fingerPts(start, ang, len, w, curl, n = 7) {
  const c = [start];
  let a = ang, [x, y] = start;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    a = ang + curl * Math.pow(t, 1.6);
    x += Math.cos(a) * len / n; y += Math.sin(a) * len / n;
    c.push([x, y]);
  }
  const L = [], R = [];
  c.forEach((p, i) => {
    const t = i / n;
    const q = c[Math.min(n, i + 1)], o = c[Math.max(0, i - 1)];
    const [tx, ty] = unit(q[0] - o[0], q[1] - o[1]);
    const hw = (w / 2) * (1 - 0.38 * t);
    L.push([p[0] - ty * hw, p[1] + tx * hw]); R.push([p[0] + ty * hw, p[1] - tx * hw]);
  });
  const tip = c[n], [tx, ty] = unit(tip[0] - c[n - 1][0], tip[1] - c[n - 1][1]);
  return [...L, [tip[0] + tx * w * 0.32, tip[1] + ty * w * 0.32], ...R.reverse()];
}

// Classical Thai hand hanging from the wrist: palm and four fingers as one
// blade whose tip flicks back (toward -v), fingers parted by knife slits,
// thumb apart. Local frame: u down the hand, +v forward (with side = 1).
function openHand(ctx, W, dir, { side = 1, seed = 4, skin = null, k = 1, curl = 0.6, len = 36 } = {}) {
  const P = handFrame(W, dir, side, k);
  const n = 12, c = [];
  let a = 0, u = 0, v = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    c.push([u, v, t]);
    const bend = t < 0.45 ? 0 : -curl * 1.5 * Math.pow((t - 0.45) / 0.55, 1.5);
    a = bend;
    u += (Math.cos(a) * len) / n; v += (Math.sin(a) * len) / n;
  }
  const wAt = (t) => (t < 0.45 ? lerp(13.5, 12.4, t / 0.45) : lerp(12.4, 3.4, Math.pow((t - 0.45) / 0.55, 0.9)));
  const L = [], R = [];
  c.forEach(([cu, cv, t], i) => {
    const q = c[Math.min(n, i + 1)], o = c[Math.max(0, i - 1)];
    const [tu, tv] = unit(q[0] - o[0], q[1] - o[1]);
    const hw = wAt(t) / 2;
    L.push([cu + tv * hw, cv - tu * hw]); // -v side
    R.push([cu - tv * hw, cv + tu * hw]); // +v side
  });
  const tipc = c[n];
  const blade = [...L.map(([x, y]) => P(x, y)), P(tipc[0] + 1.2, tipc[1] - 1.4), ...R.reverse().map(([x, y]) => P(x, y))];
  // thumb angle: aim from the palm toward +v, flick back toward +u
  const tb = (() => {
    const pts = [];
    const base = [5, 5.2];
    let tu = base[0], tv = base[1], ang = 0.75;
    const cl = [];
    for (let i = 0; i <= 6; i++) { cl.push([tu, tv, i / 6]); ang -= 0.1; tu += Math.cos(ang) * 2.4; tv += Math.sin(ang) * 2.4; }
    const Lh = [], Rh = [];
    cl.forEach(([x, y, t], i) => {
      const q = cl[Math.min(6, i + 1)], o = cl[Math.max(0, i - 1)];
      const [ux, uy] = unit(q[0] - o[0], q[1] - o[1]);
      const hw = 2.1 * (1 - 0.35 * t);
      Lh.push(P(x - uy * hw, y + ux * hw)); Rh.push(P(x + uy * hw, y - ux * hw));
    });
    const e = cl[6];
    return [...Lh, P(e[0] + 1, e[1] + 0.2), ...Rh.reverse()];
  })();
  const outline = wob(blade, 0.15 * k, seed);
  leather(ctx, smooth(tb, true, 0.4));
  leather(ctx, smooth(outline, true, 0.4));
  if (skin) { dye(ctx, smooth(inset(outline, 0.8), true), skin, 0.9); dye(ctx, smooth(inset(tb, 0.7), true), skin, 0.9); }
  // finger slits from the knuckles to the tip
  for (const f of [-0.5, 0, 0.5]) {
    const pts = [];
    for (let i = 7; i <= n - 1; i++) {
      const [cu, cv, t] = c[i];
      const hw = wAt(t) / 2;
      const q = c[Math.min(n, i + 1)], o = c[i - 1];
      const [tu, tv] = unit(q[0] - o[0], q[1] - o[1]);
      pts.push(P(cu + tv * hw * f * 0.9, cv - tu * hw * f * 0.9));
    }
    slit(ctx, pts, 0.55 * k);
  }
  const kn = c[6];
  goldL(ctx, [P(kn[0] - 1, kn[1] - 5.6), P(kn[0] + 0.6, kn[1]), P(kn[0] - 0.6, kn[1] + 5.6)], 0.55 * k);
  goldL(ctx, [P(-4, -3.2), P(5, -3.6), P(12, -3.2)], 0.5 * k, { alpha: 0.8 });
  goldL(ctx, [P(3, 3.6), P(8, 4.4), P(13, 3.8)], 0.5 * k, { alpha: 0.8 });
  spots(ctx, [P(tipc[0] - 1.2, tipc[1] + 0.2)], 0.65 * k);
  stripe(ctx, [P(0.5, -7), P(1.2, 0), P(0.5, 7)], 3 * k, { fill: INK.red, sp: 2, r: 0.55 });
  return outline;
}

// Clenched fist (side view) for holding a weapon: knuckles toward +v.
function fist(ctx, W, dir, { side = 1, seed = 5, skin = null, k = 1 } = {}) {
  const P = handFrame(W, dir, side, k);
  const pts = wob([
    P(-9, -6.8), P(0, -7.2), P(7, -8.4), P(12, -10.2), P(16.5, -12.2), P(20, -11.2), P(21.4, -8), P(24.5, -5.4), P(26.2, -1),
    P(26, 4), P(24, 8.6), P(19.5, 10.8), P(13.5, 11.2), P(7.5, 10.6), P(2, 9), P(-9, 7),
  ], 0.15 * k, seed);
  leather(ctx, smooth(pts, true));
  if (skin) dye(ctx, inset(pts, 0.9), skin, 0.88);
  // curled fingers
  for (let i = 0; i < 4; i++) {
    const u = 11 + i * 3.7;
    goldL(ctx, [P(u - 0.5, 10.4), P(u + 1.2, 4.5), P(u + 0.4, -1.5)], 0.55 * k);
  }
  // thumb over the fingers
  goldL(ctx, [P(8, -8.6), P(13, -5.4), P(18.5, -3.2), P(22, -1)], 0.7 * k);
  spots(ctx, [P(22.4, -0.2)], 0.7 * k);
  goldL(ctx, [P(-5, 3.6), P(4, 4.6), P(9, 7.6)], 0.5 * k, { alpha: 0.8 });
  stripe(ctx, [P(0.5, -7), P(1.2, 0), P(0.5, 7)], 3 * k, { fill: INK.red, sp: 2, r: 0.55 });
  spots(ctx, [P(24, 2), P(24.4, -2.6), P(21.5, 7), P(16, 9.2)], 0.6 * k);
  return pts;
}

// Slender bare foot pointing along `fwd` (+1 = +x) from the ankle, toe
// tip slightly upturned as on the sheets.
function footPts(A, fwd = 1, { len = 40, h = 15, up = 1 } = {}) {
  const X = (u) => A[0] + u * fwd;
  const Y = (v) => A[1] + v;
  return [
    [X(-7.5), Y(-7)], [X(-9.5), Y(3)], [X(-10.5), Y(h * 0.8)], [X(-7.5), Y(h)], [X(4), Y(h + 1)],
    [X(len * 0.5), Y(h + 1.2)], [X(len * 0.8), Y(h + 0.2)], [X(len * 0.95), Y(h - 1.6 - up)], [X(len + 4), Y(h - 5 - up * 2.5)],
    [X(len - 0.5), Y(h - 5.6 - up)], [X(len * 0.78), Y(h - 7)], [X(len * 0.52), Y(h - 9.5)], [X(len * 0.26), Y(h - 12.5)],
    [X(8.5), Y(-2)], [X(8), Y(-7)],
  ];
}

function footDetail(ctx, A, fwd = 1, { len = 40, h = 15 } = {}) {
  const X = (u) => A[0] + u * fwd;
  for (let i = 0; i < 4; i++) {
    const u = len * (0.6 + i * 0.09);
    goldL(ctx, [[X(u - 1), A[1] + h - 8 + i * 0.9], [X(u + 2.6), A[1] + h - 3.5], [X(u + 1.4), A[1] + h + 0.3]], 0.55);
  }
  goldL(ctx, [[X(len * 0.2), A[1] + h - 9.4], [X(len * 0.5), A[1] + h - 6.5], [X(len * 0.86), A[1] + h - 4.2]], 0.6, { alpha: 0.75 });
  goldL(ctx, [[X(-4.5), A[1] + 5], [X(0.5), A[1] + 8.8], [X(-4.5), A[1] + 12]], 0.65);
  goldL(ctx, [[X(4), A[1] + h - 1], [X(len * 0.45), A[1] + h - 0.4]], 0.5, { alpha: 0.6 });
  spots(ctx, [[X(len + 1.6), A[1] + h - 6.4]], 0.7);
}

// Ornate anklet / bracelet band across a limb at point p (normal n).
function cuff(ctx, p, n, half, { w = 5, fill = INK.red, gem1 = true, seed = 3, fr = 0 } = {}) {
  const a = [p[0] - n[0] * half, p[1] - n[1] * half], b = [p[0] + n[0] * half, p[1] + n[1] * half];
  stripe(ctx, [a, mix(a, b, 0.5), b], w, { fill, seed, sp: 2.6, r: 0.7 });
  if (gem1) gem(ctx, p[0], p[1], w * 0.42);
  if (fr) fringe(ctx, [a, b], fr, { flip: false, h: 1.1 });
}

// Collar / epaulette flame (อินทรธนู) as outline points: a kanok leaf with
// base at p pointing along ang.
function flamePts(p, size, ang, flip = false) {
  return kanokPts(p[0], p[1], size, ang, flip);
}

// Face of a refined character (พระ / เทวดา) in profile facing +x. E is the
// eye centre, k the scale. Returns the face+neck outline points.
function refinedFace(ctx, E, { skin = INK.face, neck = 44, lip = INK.red, brow = 0, k = 1, blush = 0.1, line: lc = '#22140b' } = {}) {
  const P = (x, y) => [E[0] + x * k, E[1] + y * k];
  const face = [
    P(4, -21), P(9.5, -17), P(11.6, -10), P(13, -4.6), P(16.4, 2.4), P(19.8, 8.4), P(21.8, 11.4), P(20.6, 13), P(17.4, 13.6),
    P(16.4, 14.8), P(17.4, 16.8), P(15.4, 18), P(16.5, 19.8), P(14.6, 21.8), P(15.4, 25), P(13, 28.6), P(7.6, 30.4), P(4, 32),
    P(3.6, neck * 0.75), P(3.4, neck), P(-15, neck), P(-16, 26), P(-12, 16), P(-10, 6), P(-12, -8), P(-6, -19),
  ];
  leather(ctx, smooth(face, true, 0.45));
  dye(ctx, smooth(inset(face, 0.9 * k), true), skin, 0.95);
  if (blush) { const b = new Path2D(); b.ellipse(...P(4, 16), 6 * k, 4.2 * k, 0, 0, TAU); dye(ctx, b, INK.pink, blush); }
  // eyebrow: long fine arch
  ink(ctx, [P(9.4, -6.8 + brow), P(4, -9.4 + brow), P(-3, -9.2 + brow), P(-11, -6.4 + brow)], lc, 1.0 * k);
  // eye: long almond with a tail sweeping back, iris near the front
  const up = [P(7.2, -0.6), P(4, -3.2), P(-1.2, -3.5), P(-6.5, -1.8), P(-12, -1.2)];
  const lo = [P(7.2, -0.6), P(3.6, 1.5), P(-2, 1.8), P(-6.6, 0.4)];
  dye(ctx, smooth([...up.slice(0, 4), ...lo.slice(1).reverse()], true), INK.white, 0.95);
  ink(ctx, up, lc, 1.15 * k);
  ink(ctx, lo, lc, 0.65 * k);
  const iris = new Path2D(); iris.arc(...P(2.2, -0.9), 2.1 * k, 0, TAU);
  dye(ctx, iris, lc, 1);
  hole(ctx, ...P(2.8, -1.5), 0.55 * k);
  ink(ctx, [P(-1, -5.3), P(-6.5, -4.1), P(-10, -3.2)], lc, 0.45 * k, { alpha: 0.6 });
  // nostril, lips, chin, neck
  ink(ctx, [P(17, 10.8), P(15.5, 12.2), P(16.6, 12.9)], '#5a2c16', 0.6 * k);
  dye(ctx, smooth([P(16.6, 15.1), P(17.4, 16.8), P(15.2, 17.9), P(16.5, 19.7), P(14.5, 21), P(13.4, 18.3), P(14.2, 15.8)], true), lip, 0.95);
  ink(ctx, [P(13.2, 18.1), P(15.2, 18)], '#4a120c', 0.5 * k);
  ink(ctx, [P(8.5, 27), P(4, 28), P(-1.5, 26)], '#6a4424', 0.45 * k, { alpha: 0.5 });
  ink(ctx, [P(3.6, 36), P(-1, 38), P(-7, 37.5)], '#6a4424', 0.45 * k, { alpha: 0.45 });
  return face;
}

// Tall tiered ชฎา crown. base = centre of the crown base, top = where the
// tiers end, tip = spire tip, hw = half-width at the base. Returns the
// outline plus per-tier quads for decoration.
function chadaGeom(base, top, tip, hw, { tiers = 6, topW = 3, lip = 2, pw = 1 } = {}) {
  const [ax, ay] = unit(top[0] - base[0], top[1] - base[1]);
  const nx = -ay, ny = ax; // +x side when the axis points up
  const side = (c, w) => [c[0] + nx * w, c[1] + ny * w];
  const R = [], L = [], rings = [];
  for (let i = 0; i < tiers; i++) {
    const t0 = i / tiers, t1 = (i + 1) / tiers;
    const w0 = lerp(hw, topW, Math.pow(t0, 0.8)), w1 = lerp(hw, topW, Math.pow(t1, 0.8));
    const c0 = mix(base, top, t0), cm = mix(base, top, t0 + 0.035), c1 = mix(base, top, t1);
    const lw = w0 + lip * (1 - t0 * 0.5);
    R.push(side(c0, w0), side(cm, lw), side(mix(base, top, t0 + 0.08), w0 * 0.97 + (w1 - w0) * 0.1));
    L.push(side(c0, -w0), side(cm, -lw), side(mix(base, top, t0 + 0.08), -(w0 * 0.97 + (w1 - w0) * 0.1)));
    rings.push({ c0, c1, w0, w1, lw, a: side(cm, -lw), b: side(cm, lw), quad: [side(c0, -w0), side(c0, w0), side(c1, w1), side(c1, -w1)] });
  }
  R.push(side(top, topW)); L.push(side(top, -topW));
  const [bx, by] = unit(tip[0] - top[0], tip[1] - top[1]);
  const mx = -by, my = bx;
  const sAt = (t, w) => { const c = mix(top, tip, t); return [c[0] + mx * w, c[1] + my * w]; };
  const spR = [sAt(0.08, topW * 1.5 * pw), sAt(0.2, topW * 1.9 * pw), sAt(0.32, topW * 0.9 * pw), sAt(0.42, topW * 1.2 * pw), sAt(0.55, topW * 0.7 * pw), sAt(0.8, 0.9 * pw)];
  const spL = [sAt(0.08, -topW * 1.5 * pw), sAt(0.2, -topW * 1.9 * pw), sAt(0.32, -topW * 0.9 * pw), sAt(0.42, -topW * 1.2 * pw), sAt(0.55, -topW * 0.7 * pw), sAt(0.8, -0.9 * pw)];
  const outline = [...R, ...spR, tip, ...spL.reverse(), ...L.reverse()];
  return { outline, rings, spire: [top, tip], sAt, side };
}

// ================================================================ builder
// defs: { id: { box, z, parent?, joint?, lim?, stiff?, mass?, draw(ctx, r) } }
function buildRig(meta, defs, extra) {
  const parts = {};
  // rivet on whichever piece of a joint is drawn on top
  const riv = {};
  for (const id in defs) {
    const d = defs[id];
    if (!d.parent || d.noRivet) continue;
    const top = (d.z ?? 0) >= (defs[d.parent].z ?? 0) ? id : d.parent;
    (riv[top] ||= []).push([d.joint, d.rivetR ?? 3]);
  }
  for (const id in defs) {
    const d = defs[id];
    const [x0, y0, x1, y1] = d.box;
    const sprite = paintSprite(x1 - x0, y1 - y0, (ctx, info) => {
      ctx.translate(-x0, -y0);
      d.draw(ctx, info.rng);
      for (const [[x, y], r] of riv[id] || []) rivet(ctx, x, y, r);
    }, { pad: 4, name: `${meta.id}/${id}` });
    const p = { sprite, z: d.z ?? 0 };
    if (d.mass != null) p.mass = d.mass;
    if (d.stiff != null) p.stiff = d.stiff;
    if (d.parent) {
      const pb = defs[d.parent].box;
      p.parent = d.parent;
      p.at = [d.joint[0] - pb[0], d.joint[1] - pb[1]];
      p.pivot = [d.joint[0] - x0, d.joint[1] - y0];
      p.rot = 0;
      p.lim = d.lim ? [d.lim[0] * DEG, d.lim[1] * DEG] : null;
    }
    parts[id] = p;
  }
  const B = (id, pt) => [pt[0] - defs[id].box[0], pt[1] - defs[id].box[1]];
  const rig = { ...meta, root: 'torso', parts };
  if (extra.rod) rig.rod = { part: 'torso', a: B('torso', extra.rod[0]), b: B('torso', extra.rod[1]), extend: extra.rod[2] ?? 300 };
  rig.handRods = { handF: B('handF', extra.handRods.handF), handB: B('handB', extra.handRods.handB) };
  rig.grips = { handF: B('handF', extra.grips.handF), handB: B('handB', extra.grips.handB) };
  rig.holds = extra.holds || {};
  rig.limbs = extra.limbs;
  rig.lines = extra.lines;
  return rig;
}

function bb(pad, ...lists) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of lists) for (const [x, y] of l) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 + pad), Math.ceil(y1 + pad)];
}

const STD_LIMBS = (extra = {}) => ({
  torso: 'torso', head: 'head', pelvis: 'skirt',
  armF: ['upperArmF', 'forearmF', 'handF'], armB: ['upperArmB', 'forearmB', 'handB'],
  legF: ['thighF', 'shinF'], legB: ['thighB', 'shinB'],
  ...extra,
});


// ================================================================ shared parts
// Upper arm with อินทรธนู shoulder flame and พาหุรัด armlet. side = +1 for
// the near arm (flame flares toward +x), -1 for the far arm.
function upperArm(ctx, S, E, { ra = 11, rb = 8.5, seed = 1, fill = null, side = 1, flame = 26, band = INK.red, skin = null, lz = true } = {}) {
  const f = frame(S, E);
  const pts = wob(paddle(S, E, ra, rb, { bulge: 0.05, ext: 3, extA: 2 }), 0.3, seed);
  let fl = null;
  leather(ctx, smooth(pts, true));
  if (skin) dye(ctx, smooth(inset(pts, 1), true), skin, 0.9);
  if (fill) dye(ctx, smooth(inset(pts, 2.2), true), fill, 0.85);
  if (lz) lace(ctx, inset(pts, 4), { sp: 5.2, r: 0.85, style: 'dot', seed: seed + 3, punch: 0.3 });
  rim(ctx, pts, { seed });
  if (flame) {
    fl = hornPts([S[0] + side * ra * 0.2, S[1] + 5], flame, (-90 + 12 * side) * DEG, 62 * side * DEG, 15, { swell: 3 });
    leather(ctx, smooth(fl, true, 0.45));
    flameDeco(ctx, fl, { seed: seed + 9, cols: [INK.gold, INK.red], d: [1.2, 3.6] });
    const f2 = hornPts([S[0] + side * ra * 0.2, S[1] + 6], flame * 0.55, (-90 + 40 * side) * DEG, 50 * side * DEG, 8);
    leather(ctx, smooth(f2, true, 0.45));
    flameDeco(ctx, f2, { seed: seed + 19, cols: [INK.gold, INK.green], d: [1, 2.8] });
    // shoulder cap: gold boss with a flower
    const cap = [f.at(-0.1, -ra * 0.95), f.at(0.14, -ra * 1.1), f.at(0.27, 0), f.at(0.14, ra * 1.1), f.at(-0.1, ra * 0.95)];
    panel(ctx, cap, { fill: INK.red, sp: 2.6, r: 0.75, seed: seed + 4, d2: 2.4 });
    fringe(ctx, [f.at(0.24, -ra * 0.95), f.at(0.29, 0), f.at(0.24, ra * 0.95)], 3.8, { flip: true, h: 1.25 });
  }
  // armlet พาหุรัด
  const a1 = f.at(0.6, -ra * 1.05), a2 = f.at(0.6, ra * 1.05);
  stripe(ctx, [a1, f.at(0.62, 0), a2], 5.2, { fill: band, seed: seed + 1, sp: 2.6, r: 0.75 });
  fringe(ctx, [f.at(0.54, -ra * 0.95), f.at(0.55, 0), f.at(0.54, ra * 0.95)], 3.8, { flip: false, h: 1.5 });
  const g = f.at(0.62, 0);
  flower(ctx, g[0], g[1], 3.6, { n: 8 });
  stripe(ctx, [f.at(0.7, -rb * 1.1), f.at(0.71, rb * 1.1)], 2.2, { fill: INK.gold, dot: false });
  return pts;
}

// Forearm with the ornate ทองกร cuff at the wrist.
function forearm(ctx, E, W, { ra = 8.5, rb = 6.8, seed = 2, fill = null, skin = null, cuffCol = INK.red, lz = true } = {}) {
  const f = frame(E, W);
  const pts = wob(paddle(E, W, ra, rb, { bulge: 0.04, ext: 5, extA: 1 }), 0.3, seed);
  leather(ctx, smooth(pts, true));
  if (skin) dye(ctx, smooth(inset(pts, 1), true), skin, 0.9);
  if (fill) dye(ctx, smooth(inset(pts, 2.2), true), fill, 0.85);
  if (lz) lace(ctx, inset(pts, 4), { sp: 5.2, r: 0.8, style: 'dot', seed: seed + 3, punch: 0.3 });
  rim(ctx, pts, { seed });
  const q = (t, v) => f.at(t, v);
  // cuff: two bands and a fringe pointing up the arm
  const cuffP = [q(0.72, -rb * 1.2), q(0.7, 0), q(0.72, rb * 1.2), q(1.02, rb * 1.1), q(1.04, 0), q(1.02, -rb * 1.1)];
  panel(ctx, cuffP, { fill: cuffCol, sp: 2.4, r: 0.65, seed: seed + 6, d2: 2.2 });
  stripe(ctx, [q(0.8, -rb * 1.15), q(0.81, 0), q(0.8, rb * 1.15)], 3.6, { fill: INK.gold, seed: seed + 2, sp: 2.3, r: 0.6 });
  stripe(ctx, [q(0.94, -rb * 1.2), q(0.95, 0), q(0.94, rb * 1.2)], 3, { fill: INK.gold, seed: seed + 3, sp: 2.2, r: 0.55 });
  fringe(ctx, [q(0.72, -rb * 1.1), q(0.7, 0), q(0.72, rb * 1.1)], 3.4, { flip: false, h: 1.35 });
  flower(ctx, ...q(0.875, 0), 2.8, { n: 6 });
  return pts;
}

// Thigh in knee-length breeches (สนับเพลา) with a pointed hem at the knee.
function thigh(ctx, H, K, { ra = 15, rb = 11, seed = 3, fill = INK.green, fill2 = INK.red, hem = true } = {}) {
  const f = frame(H, K);
  const pts = wob(paddle(H, K, ra, rb, { bulge: 0.08, ext: 2, extA: 3 }), 0.35, seed);
  leather(ctx, smooth(pts, true));
  const body = inset(pts, 2.4);
  lace(ctx, body, { sp: 5.6, r: 0.9, style: 'quad', seed: seed + 9, punch: 0.3 });
  ctx.save(); ctx.clip(smooth(body, true));
  for (let i = 0; i < 3; i++) {
    const t = 0.1 + i * 0.26;
    const a = f.at(t, -ra * 1.4), b = f.at(t + 0.14, ra * 1.4);
    const band = [a, mix(a, b, 0.5), b];
    stripe(ctx, band, 8, { fill: i === 1 ? fill : fill2, seed: seed + i, sp: 3, r: 0.95 });
    fringe(ctx, offset(C(band), 4.2), 3.2, { h: 1.2 });
  }
  ctx.restore();
  rim(ctx, pts, { seed });
  if (hem) {
    const h1 = f.at(0.84, -rb * 1.3), h2 = f.at(0.84, rb * 1.3);
    stripe(ctx, [h1, f.at(0.86, 0), h2], 5.4, { fill: INK.red, seed: seed + 7, sp: 2.6 });
    fringe(ctx, [f.at(0.91, -rb * 1.1), f.at(0.93, 0), f.at(0.91, rb * 1.1)], 3.6, { flip: true, h: 1.2 });
  }
  return pts;
}

// Shin + foot in one piece, with shin guard and anklet.
function shin(ctx, K, A, fwd, { ra = 10, rb = 6.6, seed = 4, guard = INK.red, footLen = 40, skin = null, lz = true } = {}) {
  const f = frame(K, A);
  const leg = wob(paddle(K, A, ra, rb, { bulge: 0.07, ext: 4, extA: 2 }), 0.3, seed);
  const foot = wob(footPts(A, fwd, { len: footLen, h: 15 }), 0.2, seed + 1);
  leather(ctx, smooth(leg, true));
  leather(ctx, smooth(foot, true, 0.45));
  if (skin) { dye(ctx, smooth(inset(leg, 1), true), skin, 0.9); dye(ctx, smooth(inset(foot, 0.8), true), skin, 0.9); }
  if (lz) lace(ctx, inset(leg, 3.5), { sp: 5.4, r: 0.8, style: 'dot', seed: seed + 5, punch: 0.3 });
  // shin guard (สนับแข้ง) plate over the front of the shin
  if (guard) {
    const g = [f.at(0.12, -ra * 0.8), f.at(0.05, 0), f.at(0.12, ra * 0.8), f.at(0.45, rb * 1.0), f.at(0.74, rb * 0.72), f.at(0.8, 0), f.at(0.74, -rb * 0.72), f.at(0.45, -rb * 1.0)];
    leather(ctx, smooth(g, true));
    panel(ctx, g, { fill: guard, sp: 3, r: 0.85, seed, d2: 2.6 });
    ink(ctx, [f.at(0.14, 0), f.at(0.72, 0)], INK.goldLine, 1.1);
    for (let t = 0.2; t < 0.72; t += 0.12) flower(ctx, ...f.at(t, 0), 2.7, { n: 6 });
    fringe(ctx, [f.at(0.1, -ra * 0.8), f.at(0.04, 0), f.at(0.1, ra * 0.8)], 3.2, { flip: false, h: 1.2 });
  }
  rim(ctx, leg, { seed, gold: false, d: 2.3 });
  rim(ctx, foot, { seed: seed + 3, gold: false, d: 2, sp: 3.2, r: 0.8 });
  cuff(ctx, f.at(0.93, 0), [f.nx, f.ny], rb * 1.2, { w: 4.4, fill: INK.red, seed });
  dots(ctx, [f.at(1.0, -rb * 1.15), f.at(1.02, 0), f.at(1.0, rb * 1.15)], { sp: 2, r: 0.7, seed: seed + 2, punch: 0 });
  footDetail(ctx, A, fwd, { len: footLen, h: 15 });
  return { leg, foot };
}

// Classical ชฎา head (prince / deva): face, ear, helmet with the
// กระบังหน้า band, tiered cone and spire, กรรเจียก ear flame, ear flower
// and tassel. Returns outlines for the bounding box via `geom`.
function chadaHeadGeom(E, k, { tiers = 7, spireTop = [-16, -80], tip = [-21, -102], hw = 13, karnSize = 40, karnAng = 188 } = {}) {
  const X = (x, y) => [E[0] + x * k, E[1] + y * k];
  const crown = chadaGeom(X(-11, -33), X(...spireTop), X(...tip), hw * k, { tiers, topW: 2.2 * k, lip: 1.5 * k });
  const helmet = [X(10, -17), X(11.4, -23.5), X(8.5, -30), X(-2, -34.8), X(-16, -35.8), X(-27, -31.5), X(-33.5, -22), X(-35.5, -9), X(-34.5, 4),
    X(-31, 14), X(-33, 22), X(-38, 28), X(-35, 31), X(-27, 28), X(-19, 24), X(-15, 14), X(-13, 2), X(-9, -13), X(2, -16.5)];
  const hair = [X(-30, 8), X(-31, 18), X(-26, 26), X(-16, 29), X(-13.5, 12), X(-17, 0)];
  const ear = [X(-3.5, -4), X(-1.8, 2), X(-2.6, 10), X(-4.6, 16.5), X(-7.6, 18.4), X(-10.2, 13), X(-10.4, 2), X(-8, -4.5)];
  const karn = hornPts([E[0] - 12 * k, E[1] + 10 * k], karnSize * k, karnAng * DEG, 70 * DEG, 17 * k, { swell: 6 * k, taper: 0.8 });
  return { X, crown, helmet, hair, ear, karn };
}

function chadaHead(ctx, E, k, G, { skin = INK.face, tierCols = [INK.red, INK.green], neck = 46, seed = 30, lip = INK.red } = {}) {
  const { X, crown, helmet, hair, ear, karn } = G;
  // hair at the nape: tight curls of dots
  leather(ctx, smooth(hair, true));
  lace(ctx, inset(hair, 1.6), { sp: 3.6, r: 0.85, style: 'dot', seed: seed + 3, punch: 0.25 });
  // face and neck
  refinedFace(ctx, E, { neck, k, skin, lip });
  // crown cone + spire
  leather(ctx, smooth(crown.outline, true, 0.4));
  crown.rings.forEach((g, i) => {
    dye(ctx, poly(g.quad), tierCols[i % tierCols.length], 0.9);
    dots(ctx, [mix(g.quad[0], g.quad[3], 0.55), mix(g.quad[1], g.quad[2], 0.55)], { sp: 2.4, r: 0.6, seed: seed + 10 + i, punch: 0.3 });
  });
  crown.rings.forEach((g, i) => {
    stripe(ctx, [g.a, mix(g.a, g.b, 0.5), g.b], Math.max(2, 3.4 - i * 0.2) * k, { fill: INK.gold, edge: INK.white, ew: 0.5, seed: seed + 20 + i, sp: 2.1, r: 0.55 });
    fringe(ctx, [mix(g.a, g.b, 0.04), mix(g.a, g.b, 0.96)], Math.max(2.2, g.w0 * 0.4), { h: 1.55, gap: 1, edge: INK.white });
  });
  const s = crown.sAt;
  dye(ctx, smooth([s(0.02, -3), s(0.02, 3), s(0.8, 0.8), s(1, 0), s(0.8, -0.8)], true), INK.gold, 0.9);
  gem(ctx, ...s(0.2, 0), 3 * k);
  gem(ctx, ...s(0.43, 0), 2 * k, { col: INK.green });
  dots(ctx, [s(0.5, 0), s(0.95, 0)], { sp: 2.2, r: 0.5, seed: seed + 5, punch: 0 });
  // helmet with the กระบังหน้า band
  leather(ctx, smooth(helmet, true));
  dye(ctx, smooth(inset(helmet, 1.4), true), INK.red, 0.88);
  lace(ctx, inset(helmet, 2.2), { sp: 4.4, r: 0.75, style: 'quad', seed: seed + 6, punch: 0.3 });
  const band = [X(10.4, -19.5), X(-2, -18.5), X(-16, -15.5), X(-27, -9), X(-31, 1)];
  stripe(ctx, band, 5.6 * k, { fill: INK.gold, seed: seed + 7, sp: 2.4, r: 0.7, edge: INK.white });
  for (const t of [0.08, 0.3, 0.52, 0.74]) { const p = C(band)[Math.floor(C(band).length * t)]; gem(ctx, p[0], p[1], 1.9 * k); }
  fringe(ctx, [X(9.6, -23), X(-3, -22.2), X(-17, -19.6), X(-29, -12.5)], 3.8 * k, { h: 1.5, edge: INK.white });
  goldL(ctx, [X(8, -30), X(-4, -34), X(-18, -34.5), X(-29, -29)], 0.8);
  // front peak of the band
  const pk = krajangPath(...X(9.8, -22.5), 7 * k, 13 * k, -96 * DEG);
  leather(ctx, pk); dye(ctx, pk, INK.gold, 0.9); hole(ctx, ...X(10.2, -28.5), 0.9);
  // กรรเจียก over the side of the helmet
  leather(ctx, smooth(karn, true, 0.45));
  dye(ctx, smooth(inset(karn, 1.3), true), INK.gold, 0.92);
  dye(ctx, smooth(inset(karn, 4.2), true), INK.red, 0.9);
  dye(ctx, smooth(inset(karn, 7.5), true), INK.green, 0.9);
  dots(ctx, inset(karn, 2.7), { sp: 2.8, r: 0.8, closed: true, seed: seed + 1, punch: 0.3 });
  dots(ctx, inset(karn, 5.8), { sp: 2.8, r: 0.7, closed: true, seed: seed + 2, punch: 0.3 });
  // ear
  leather(ctx, smooth(ear, true));
  dye(ctx, smooth(inset(ear, 0.8), true), skin, 0.95);
  ink(ctx, [X(-4.5, -1.5), X(-4, 6), X(-6.5, 13)], '#6a4424', 0.6);
  // ear flower + tassel (อุบะ)
  flower(ctx, ...X(-8.6, 1), 4.6 * k, { n: 8 });
  const tas = [X(-7.5, 7), X(-7.2, 12.5), X(-7.4, 18), X(-7.2, 23.5)];
  for (const [i, p] of tas.entries()) gem(ctx, p[0], p[1], (2.1 - i * 0.2) * k, { col: i % 2 ? INK.green : INK.red });
  const drop = [X(-7.2, 25), X(-4.6, 29.5), X(-7.2, 34.5), X(-9.8, 29.5)];
  leather(ctx, smooth(drop, true)); dye(ctx, smooth(drop, true), INK.gold, 0.9); hole(ctx, ...X(-7.2, 29.8), 0.9);
}

// ================================================================ พระ prince
function buildPhra() {
  const k = 1.12;
  const E = [20, 114];
  const J = {
    neck: [12, 154],
    shB: [-30, 166], elB: [-44, 226], wrB: [-40, 286],
    shF: [46, 166], elF: [61, 225], wrF: [66, 283],
    waist: [6, 250],
    hipB: [-12, 266], knB: [-40, 340], anB: [-46, 424],
    hipF: [24, 266], knF: [53, 340], anF: [60, 424],
  };
  const G = chadaHeadGeom(E, k);
  const head = {
    box: bb(3, G.crown.outline, G.helmet, G.hair, G.karn, [G.X(24, 0), G.X(0, 48)]), z: -1, parent: 'torso', joint: J.neck, lim: [-22, 22], stiff: 0.7, mass: 0.9,
    draw: (ctx) => chadaHead(ctx, E, k, G, { neck: 47 }),
  };

  // ---------------------------------------------------------------- torso
  const torsoPts = wob([
    [-6, 146], [-18, 150], [-30, 155], [-40, 164], [-42, 176], [-37, 190], [-31, 206], [-26, 224], [-24, 240], [-26, 262], [-10, 268],
    [8, 270], [24, 268], [36, 262], [35, 240], [38, 224], [44, 206], [51, 190], [57, 176], [58, 165], [48, 155], [34, 149], [22, 146], [8, 144],
  ], 0.4, 61);
  const collar = wob([[-43, 165], [-34, 155], [-21, 148], [-6, 143], [10, 142], [26, 145], [41, 151], [55, 159], [59, 169], [47, 180], [33, 190], [19, 196], [8, 198], [-4, 196], [-18, 190], [-31, 180], [-41, 172]], 0.3, 62);
  const torso = {
    box: bb(3, torsoPts, collar), z: 0, mass: 1.4,
    draw(ctx) {
      leather(ctx, smooth(torsoPts, true));
      const body = inset(torsoPts, 2.6);
      dye(ctx, smooth(body, true), INK.green, 0.82);
      brocade(ctx, body, { sp: 9.5, seed: 3, dotR: 1.05 });
      // red side panels hugging the ribs
      const sideB = [[-41, 172], [-31, 180], [-22, 206], [-18, 240], [-21, 258], [-23, 244], [-27, 222], [-32, 204], [-38, 188]];
      const sideF = [[57, 172], [46, 181], [37, 206], [31, 240], [34, 258], [35, 242], [39, 222], [46, 204], [53, 188]];
      for (const sp of [sideB, sideF]) panel(ctx, sp, { fill: INK.red, sp: 3.2, r: 0.9, seed: 70 + sp[0][0], d2: 2.8 });
      // centre placket
      const plk = [[1, 196], [13, 196], [12, 240], [7, 246], [2, 240]];
      panel(ctx, plk, { fill: INK.red, sp: 3, r: 0.85, seed: 72, d2: 2.6 });
      // crossed สังวาล chains
      for (const [a, b] of [[[-36, 168], [30, 238]], [[48, 168], [-18, 238]]]) {
        const m = mix(a, b, 0.5);
        const ch = [a, [m[0] + (a[0] < b[0] ? -2 : 2), m[1]], b];
        ink(ctx, ch, INK.leather, 4);
        ink(ctx, ch, INK.gold, 2.6);
        dots(ctx, ch, { sp: 3, r: 0.85, seed: 80, punch: 0 });
      }
      flower(ctx, 7, 214, 7, { n: 8 });
      // belly band รัดองค์
      stripe(ctx, [[-25, 238], [7, 242], [36, 238]], 7, { fill: INK.red, seed: 77, sp: 3, r: 0.95 });
      fringe(ctx, [[-23, 234.5], [7, 238.4], [34, 234.5]], 4.2, { h: 1.3 });
      // collar กรองศอ: bands + hanging krajang
      leather(ctx, smooth(collar, true));
      dye(ctx, smooth(inset(collar, 1.5), true), INK.red, 0.9);
      stripe(ctx, [[-40, 163], [-22, 153], [7, 148], [34, 152], [54, 162]], 5.2, { fill: INK.gold, seed: 91, sp: 2.5, r: 0.75, edge: INK.white });
      stripe(ctx, [[-38, 171], [-20, 180], [8, 186], [32, 180], [52, 169]], 5, { fill: INK.green, seed: 92, sp: 2.8, r: 0.8, edge: INK.white });
      for (const x of [-26, -10, 7, 24, 40]) flower(ctx, x, 165 + Math.abs(x - 7) * 0.08 + (x === 7 ? 3 : 0), 3.6, { n: 8 });
      fringe(ctx, [[-42, 176], [-26, 188], [-8, 197], [8, 199], [24, 196], [38, 188], [53, 175]], 5.6, { flip: true, h: 1.35, col: INK.gold, inner: INK.red });
      dots(ctx, inset(collar, 2.4), { sp: 3, r: 0.8, closed: true, seed: 93, punch: 0.2 });
      // ทับทรวง pendant
      const pend = [[8, 196], [16, 206], [8, 218], [0, 206]];
      leather(ctx, smooth(pend, true, 0.3));
      dye(ctx, smooth(pend, true, 0.3), INK.gold, 0.92);
      gem(ctx, 8, 207, 3.8);
      dots(ctx, inset(pend, 1.4), { sp: 2.2, r: 0.55, closed: true, seed: 94, punch: 0 });
      rim(ctx, torsoPts, { seed: 95, gold: false, d: 2.1 });
    },
  };

  // ---------------------------------------------------------------- skirt
  const flapF = hornPts([30, 280], 66, 42 * DEG, -92 * DEG, 22, { swell: 7, taper: 0.9 });
  const flapB = hornPts([-18, 280], 68, 138 * DEG, 92 * DEG, 22, { swell: 7, taper: 0.9 });
  const skirtCore = wob([
    [-27, 244], [7, 247], [38, 244], [42, 262], [44, 280], [38, 292], [24, 296], [18, 318], [8, 350], [-1, 318], [-6, 296],
    [-20, 294], [-28, 288], [-31, 274], [-31, 260],
  ], 0.4, 71);
  const skirt = {
    box: bb(3, skirtCore, flapF, flapB), z: 1, parent: 'torso', joint: J.waist, lim: [-14, 14], stiff: 0.75, mass: 1.2,
    draw(ctx) {
      leather(ctx, smooth(flapB, true, 0.45));
      leather(ctx, smooth(flapF, true, 0.45));
      for (const [fl, sd] of [[flapB, 5], [flapF, 6]]) flameDeco(ctx, fl, { seed: sd, cols: [INK.gold, INK.green, INK.red] });
      leather(ctx, smooth(skirtCore, true, 0.45));
      const hip = [[-26, 250], [38, 250], [42, 268], [38, 288], [6, 293], [-26, 286], [-30, 270]];
      dye(ctx, smooth(hip, true), INK.red, 0.86);
      lace(ctx, hip, { sp: 6.4, r: 0.95, style: 'quad', seed: 5, punch: 0.3 });
      stripe(ctx, [[-28, 284], [6, 291], [41, 285]], 5, { fill: INK.gold, seed: 12, sp: 2.6, r: 0.75, edge: INK.white });
      fringe(ctx, [[-27, 287.5], [6, 294.5], [40, 288.5]], 4, { flip: true, h: 1.2, inner: INK.green });
      // front apron ห้อยหน้า
      const apron = [[-2, 252], [17, 252], [18, 280], [17, 312], [13, 334], [8, 348], [3, 334], [-1, 312], [-3, 280]];
      leather(ctx, smooth(apron, true));
      panel(ctx, apron, { fill: INK.gold, alpha: 0.9, sp: 3, r: 0.8, seed: 8, d2: 2.2, edge: INK.white });
      dye(ctx, smooth(inset(apron, 4.2), true), INK.red, 0.88);
      for (let y = 264; y < 338; y += 13) flower(ctx, 8, y, 4.6 - (y - 264) * 0.015, { n: 8 });
      dots(ctx, [[8, 257], [8, 342]], { sp: 3, r: 0.7, seed: 9 });
      // belt with buckle
      stripe(ctx, [[-27, 249], [7, 252], [38, 249]], 8, { fill: INK.gold, seed: 10, sp: 3, r: 1, edge: INK.white });
      for (const x of [-16, 28]) gem(ctx, x, 250.5, 2.5, { col: INK.green });
      const buckle = [[8, 241], [18, 251], [8, 261], [-2, 251]];
      leather(ctx, smooth(buckle, true, 0.3));
      dye(ctx, smooth(buckle, true, 0.3), INK.gold, 0.95);
      flower(ctx, 8, 251, 6, { n: 8 });
      fringe(ctx, [[-24, 256], [7, 258.5], [36, 256]], 3.8, { flip: true, h: 1.2 });
      rim(ctx, skirtCore, { seed: 11, gold: false, d: 2 });
    },
  };

  // ---------------------------------------------------------------- limbs
  const dB = unit(J.wrB[0] - J.elB[0], J.wrB[1] - J.elB[1]);
  const dF = unit(J.wrF[0] - J.elF[0], J.wrF[1] - J.elF[1]);
  const hf = handFrame(J.wrF, dF, 1), hb = handFrame(J.wrB, dB, 1);
  const defs = {
    torso,
    head,
    skirt,
    upperArmB: { box: bb(4, paddle(J.shB, J.elB, 11, 8.5, { ext: 3, extA: 2 }), [add(J.shB, [-26, -26])]), z: -8, parent: 'torso', joint: J.shB, stiff: 0.12, draw: (ctx) => upperArm(ctx, J.shB, J.elB, { seed: 101, side: -1 }) },
    forearmB: { box: bb(4, paddle(J.elB, J.wrB, 8.5, 6.8, { ext: 5, extA: 1 })), z: -7, parent: 'upperArmB', joint: J.elB, lim: [-150, 12], stiff: 0.18, draw: (ctx) => forearm(ctx, J.elB, J.wrB, { seed: 102 }) },
    handB: { box: bb(3, [hb(-10, -8), hb(-10, 9), hb(38, -18), hb(34, 14), hb(18, 22)]), z: -9, parent: 'forearmB', joint: J.wrB, lim: [-55, 55], stiff: 0.3, mass: 0.6, draw: (ctx) => openHand(ctx, J.wrB, dB, { side: 1, seed: 103, curl: 0.7 }) },
    thighB: { box: bb(4, paddle(J.hipB, J.knB, 15, 11, { ext: 2, extA: 3 })), z: -6, parent: 'skirt', joint: J.hipB, lim: [-75, 75], stiff: 0.45, draw: (ctx) => thigh(ctx, J.hipB, J.knB, { seed: 104 }) },
    shinB: { box: bb(4, paddle(J.knB, J.anB, 10, 6.6, { ext: 4, extA: 2 }), footPts(J.anB, -1)), z: -7, parent: 'thighB', joint: J.knB, lim: [-8, 125], stiff: 0.5, draw: (ctx) => shin(ctx, J.knB, J.anB, -1, { seed: 105 }) },
    thighF: { box: bb(4, paddle(J.hipF, J.knF, 15, 11, { ext: 2, extA: 3 })), z: -4, parent: 'skirt', joint: J.hipF, lim: [-75, 75], stiff: 0.45, draw: (ctx) => thigh(ctx, J.hipF, J.knF, { seed: 106 }) },
    shinF: { box: bb(4, paddle(J.knF, J.anF, 10, 6.6, { ext: 4, extA: 2 }), footPts(J.anF, 1)), z: -5, parent: 'thighF', joint: J.knF, lim: [-8, 125], stiff: 0.5, draw: (ctx) => shin(ctx, J.knF, J.anF, 1, { seed: 107 }) },
    upperArmF: { box: bb(4, paddle(J.shF, J.elF, 11, 8.5, { ext: 3, extA: 2 }), [add(J.shF, [26, -26])]), z: 4, parent: 'torso', joint: J.shF, stiff: 0.12, draw: (ctx) => upperArm(ctx, J.shF, J.elF, { seed: 108, side: 1 }) },
    forearmF: { box: bb(4, paddle(J.elF, J.wrF, 8.5, 6.8, { ext: 5, extA: 1 })), z: 6, parent: 'upperArmF', joint: J.elF, lim: [-150, 12], stiff: 0.18, draw: (ctx) => forearm(ctx, J.elF, J.wrF, { seed: 109 }) },
    handF: { box: bb(3, [hf(-10, -8), hf(-10, 9), hf(28, -13), hf(28, 12)]), z: 5, parent: 'forearmF', joint: J.wrF, lim: [-55, 55], stiff: 0.3, mass: 0.6, draw: (ctx) => fist(ctx, J.wrF, dF, { side: 1, seed: 110 }) },
  };
  return buildRig(
    { id: 'phra', name: 'พระเอก', en: 'Phra — the Prince', kind: 'hero', voice: 'male', height: 440 },
    defs,
    {
      rod: [[8, 158], [7, 250], 320],
      handRods: { handF: hf(9, 0), handB: hb(10, 0) },
      grips: { handF: hf(15, 0.5), handB: hb(12, 0) },
      holds: { handF: 'dab' },
      limbs: STD_LIMBS(),
      lines: LINES.phra,
    },
  );
}

// ================================================================ ยักษ์ demon
// Demon head: green face with bulging eye, heavy flame brows, tusks and a
// curled moustache, under a มงกุฎยอดกาบไผ่ (bamboo-sheath spire crown).
function yakGeom(E, k) {
  const X = (x, y) => [E[0] + x * k, E[1] + y * k];
  const face = [X(5, -20), X(11, -16.5), X(16.4, -11.5), X(15, -6), X(15.4, -1.5), X(19, 3), X(23, 7), X(25.6, 11), X(24.8, 15.2), X(21, 17),
    X(18, 16.2), X(17.6, 17.6), X(21.4, 18.6), X(21.2, 20.6), X(18.5, 21.4), X(4, 21.4), X(0, 20), X(-5, 22.5), X(-10, 19), X(-8, 26), X(-6, 36), X(-6, 44), X(-19, 44),
    X(-19, 26), X(-17, 6), X(-16, -8), X(-10, -19)];
  const jaw = [X(-14, 15), X(-6, 19.5), X(0, 21), X(4, 22.4), X(19, 23.6), X(20.4, 26.4), X(18.4, 31), X(14.5, 35), X(7, 37.2), X(-2, 35.6), X(-9, 30.5), X(-14, 23)];
  const helmet = [X(8.5, -18), X(10.5, -25), X(6, -32), X(-6, -37), X(-19, -36.5), X(-29, -30), X(-33, -18), X(-32, -4), X(-26, 2), X(-18, -8), X(-8, -15), X(2, -18)];
  const spBase = X(-8, -35), spTop = X(-12, -76), tip = X(-14, -94);
  const tiers = [];
  const leaves = [];
  const NT = 4;
  for (let i = 0; i < NT; i++) {
    const t = i / NT;
    const c = mix(spBase, spTop, t), c2 = mix(spBase, spTop, t + 1 / NT);
    const w = lerp(16, 4.5, Math.pow(t, 0.9)) * k, w2 = lerp(16, 4.5, Math.pow(t + 1 / NT, 0.9)) * k;
    tiers.push({ c, c2, w, w2, quad: [[c[0] - w, c[1]], [c[0] + w, c[1]], [c2[0] + w2 * 0.92, c2[1]], [c2[0] - w2 * 0.92, c2[1]]] });
    const L = lerp(19, 10, t) * k, W0 = lerp(9, 5, t) * k;
    leaves.push(hornPts([c[0] - w * 0.85, c[1] - 1 * k], L, -150 * DEG, 62 * DEG, W0, { swell: 2 * k }));
    leaves.push(hornPts([c[0] + w * 0.85, c[1] - 1 * k], L, -30 * DEG, -62 * DEG, W0, { swell: 2 * k }));
  }
  const top = tiers[NT - 1];
  const finial = [[top.c2[0] - 5 * k, top.c2[1] + 1], [top.c2[0] - 6.5 * k, top.c2[1] - 6 * k], [top.c2[0] - 2 * k, top.c2[1] - 12 * k], tip, [top.c2[0] + 2 * k, top.c2[1] - 12 * k], [top.c2[0] + 6.5 * k, top.c2[1] - 6 * k], [top.c2[0] + 5 * k, top.c2[1] + 1]];
  const cone = [...tiers.map((t) => [t.c[0] - t.w, t.c[1]]), [top.c2[0] - top.w2, top.c2[1]], [top.c2[0] + top.w2, top.c2[1]], ...tiers.map((t) => [t.c[0] + t.w, t.c[1]]).reverse()];
  const karn = hornPts(X(-15, 12), 44 * k, 194 * DEG, 88 * DEG, 20 * k, { swell: 7 * k, taper: 0.8 });
  const ear = [X(-8, -4), X(-6.5, 4), X(-8, 12), X(-11, 18), X(-14.5, 15), X(-15.5, 4), X(-13, -4)];
  return { X, face, jaw, helmet, tiers, leaves, finial, cone, karn, ear };
}

function yakHead(ctx, E, k, G, { skin = INK.jade, seed = 200 } = {}) {
  const { X, face, helmet, tiers, leaves, finial, cone, karn, ear } = G;
  // face & neck
  leather(ctx, smooth(face, true, 0.4));
  dye(ctx, smooth(inset(face, 1), true), skin, 0.95);
  // painted fierce lines: nose wings, cheek curl, forehead flame
  ink(ctx, [X(18.4, 5), X(21, 9.5), X(20, 13.6)], INK.leather, 0.9);
  ink(ctx, [X(19.6, 13.6), X(18.2, 15.4)], INK.leather, 1.1);
  goldL(ctx, [X(16.5, 12.5), X(13, 10), X(10, 12.5), X(11.5, 15.6), X(14, 14)], 0.8);
  goldL(ctx, spiral(X(6, 12), 4 * k, -0.4, 1.1, -1), 0.8);
  goldL(ctx, [X(10, -15.5), X(6, -12.5), X(2, -14.5), X(-2, -12)], 0.7, { alpha: 0.9 });
  dots(ctx, [X(13, -13.5), X(4, -16), X(-6, -15)], { sp: 2.4, r: 0.7, seed: seed + 9, punch: 0 });
  // grimace: gums, teeth in two rows
  const gum = smooth([X(3.5, 20.4), X(20.6, 20.4), X(20, 22), X(3.5, 22)], true);
  dye(ctx, gum, INK.red, 0.95);
  const teeth = new Path2D();
  for (let x = 5; x < 19; x += 2.4) { const a = X(x, 20.8), b = X(x + 2, 22.6); teeth.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]); }
  dye(ctx, teeth, INK.white, 0.98);
  // tusk curling up from the mouth corner, fang down at the front
  const tusk = hornPts(X(5, 21.8), 14 * k, -76 * DEG, 52 * DEG, 3.8 * k);
  leather(ctx, smooth(tusk, true)); dye(ctx, smooth(inset(tusk, 0.5), true), INK.white, 0.98);
  const fang = hornPts(X(17, 21.6), 8 * k, 92 * DEG, -24 * DEG, 3.2 * k);
  leather(ctx, smooth(fang, true)); dye(ctx, smooth(inset(fang, 0.4), true), INK.white, 0.98);
  // spiral moustache along the cheek
  const mc = [X(18, 17.4), X(13, 18.2), X(7, 17.4), X(2, 15.4), ...spiral(X(1.5, 11.2), 4.2 * k, Math.PI / 2, 1.05, 1, 16).slice(1)];
  const mous = brush(C(mc, false, 4), 3.6 * k, 0.8 * k);
  leather(ctx, smooth(mous, true, 0.3));
  goldL(ctx, C(mc, false, 4), 0.55, { alpha: 0.9 });
  // bulging eye with red rim, black pupil, curled corner lines
  const eyeP = new Path2D(); eyeP.ellipse(E[0] + 1 * k, E[1], 6.4 * k, 5.8 * k, 0, 0, TAU);
  dye(ctx, eyeP, INK.white, 0.98);
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.strokeStyle = INK.red; ctx.lineWidth = 1.4 * k; ctx.stroke(eyeP); ctx.restore();
  const pup = new Path2D(); pup.arc(E[0] + 3 * k, E[1] + 0.2 * k, 3.2 * k, 0, TAU);
  dye(ctx, pup, INK.leather, 1);
  hole(ctx, E[0] + 3.8 * k, E[1] - 0.9 * k, 0.95 * k);
  ink(ctx, [X(8, 0), X(11.5, 2.5), X(12.5, 6)], INK.leather, 1);
  ink(ctx, [X(-5.5, 1), X(-9, 3.4), X(-10.5, 1), X(-9, -1)], INK.leather, 1);
  goldL(ctx, [X(-4, 6.5), X(1, 7.8), X(6, 6.6)], 0.6);
  // heavy flame brow: a thick sweep with three flame tongues at the back
  const bc = [X(15.2, -8.4), X(9, -9.6), X(2, -10), X(-5, -9), X(-11, -7.6)];
  const brow = brush(C(bc, false, 6), 5.4 * k, 2.4 * k);
  leather(ctx, smooth(brow, true, 0.3));
  for (let i = 0; i < 3; i++) {
    const tg = hornPts(X(-2 - i * 4, -10 + i * 0.8), (8 + i * 2) * k, (-120 - i * 12) * DEG, -40 * DEG, 3.4 * k);
    leather(ctx, smooth(tg, true, 0.4));
    goldL(ctx, C(tg.slice(0, 15)), 0.5, { alpha: 0.9 });
  }
  dots(ctx, C(bc, false, 6), { sp: 2.3, r: 0.75, seed: seed + 1, punch: 0 });
  // ear
  leather(ctx, smooth(ear, true));
  dye(ctx, smooth(inset(ear, 0.8), true), skin, 0.95);
  ink(ctx, [X(-9.5, -1), X(-9.5, 6), X(-11.5, 13)], INK.leather, 0.8);
  // crown spire
  for (const l of leaves) { leather(ctx, smooth(l, true, 0.4)); flameDeco(ctx, l, { cols: [INK.gold, INK.red], d: [1, 2.8], seed: seed + 3 }); }
  leather(ctx, smooth(cone, true, 0.3));
  tiers.forEach((t, i) => {
    dye(ctx, poly(t.quad), i % 2 ? INK.red : INK.green, 0.9);
    lace(ctx, t.quad, { sp: 3.6, r: 0.7, style: 'dot', seed: seed + 10 + i, punch: 0.3 });
    stripe(ctx, [[t.c[0] - t.w, t.c[1]], t.c, [t.c[0] + t.w, t.c[1]]], 4 * k * (1 - i * 0.14), { fill: INK.gold, edge: INK.white, ew: 0.5, seed: seed + 20 + i, sp: 2.2, r: 0.65 });
    fringe(ctx, [[t.c[0] - t.w * 0.9, t.c[1] - 2 * k], [t.c[0] + t.w * 0.9, t.c[1] - 2 * k]], Math.max(2.4, t.w * 0.3), { h: 1.5, gap: 1, edge: INK.white });
  });
  leather(ctx, smooth(finial, true, 0.35));
  flameDeco(ctx, finial, { cols: [INK.gold, INK.red], d: [1, 3], seed: seed + 40 });
  gem(ctx, top0(finial)[0], top0(finial)[1], 2.6 * k);
  // helmet + band
  leather(ctx, smooth(helmet, true));
  dye(ctx, smooth(inset(helmet, 1.4), true), INK.red, 0.88);
  scales(ctx, inset(helmet, 2.4), { sp: 5.2, dotR: 0.8 });
  const band = [X(9.8, -20), X(-2, -19.5), X(-16, -15.5), X(-26, -7), X(-29, 0)];
  stripe(ctx, band, 6 * k, { fill: INK.gold, seed: seed + 7, sp: 2.5, r: 0.75, edge: INK.white });
  for (const t of [0.1, 0.35, 0.6]) { const q = C(band); const p = q[Math.floor(q.length * t)]; gem(ctx, p[0], p[1], 2.1 * k, { col: INK.green }); }
  fringe(ctx, [X(9, -24), X(-3, -24), X(-17, -20.5), X(-28, -12)], 4.2 * k, { h: 1.6, edge: INK.white });
  const pk = krajangPath(...X(9.4, -24), 8 * k, 15 * k, -98 * DEG);
  leather(ctx, pk); dye(ctx, pk, INK.gold, 0.9); hole(ctx, ...X(9.8, -31), 1);
  // กรรเจียก and ear pendant
  leather(ctx, smooth(karn, true, 0.45));
  flameDeco(ctx, karn, { seed: seed + 30, cols: [INK.gold, INK.red, INK.green], d: [1.4, 4.2, 7.8] });
  flower(ctx, ...X(-11, 2), 5 * k, { n: 8 });
  const drop = [X(-11.5, 17), X(-8.5, 23), X(-11.5, 30), X(-14.5, 23)];
  leather(ctx, smooth(drop, true)); dye(ctx, smooth(drop, true), INK.gold, 0.9); gem(ctx, ...X(-11.5, 23.4), 2 * k);
}
const top0 = (pts) => { const a = pts[0], b = pts[pts.length - 1]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 4]; };

function yakJaw(ctx, E, k, G, { skin = INK.jade, seed = 230 } = {}) {
  const { X, jaw } = G;
  leather(ctx, smooth(jaw, true, 0.4));
  dye(ctx, smooth(inset(jaw, 1), true), skin, 0.95);
  dye(ctx, smooth([X(4, 22.4), X(19.2, 23.6), X(19, 25.6), X(4, 24.8)], true), INK.red, 0.95);
  const teeth = new Path2D();
  for (let x = 5.5; x < 18.5; x += 2.4) { const a = X(x, 22.6), b = X(x + 2, 24.6); teeth.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]); }
  dye(ctx, teeth, INK.white, 0.98);
  // curly goatee
  for (let i = 0; i < 4; i++) {
    const c = hornPts(X(15 - i * 4, 34 - i * 0.6), (7 + i) * k, (110 + i * 12) * DEG, 120 * DEG, 2.4 * k);
    leather(ctx, smooth(c, true, 0.4));
    goldL(ctx, C(c.slice(0, 15)), 0.45, { alpha: 0.8 });
  }
  goldL(ctx, [X(17, 29), X(10, 33), X(0, 32)], 0.6, { alpha: 0.8 });
  goldL(ctx, spiral(X(7, 29), 3 * k, 0, 1, 1), 0.6);
}

function buildYak() {
  const k = 1.45;
  const E = [24, 138];
  const G = yakGeom(E, k);
  const X = G.X;
  const J = {
    neck: X(-12, 36), jaw: X(-10.5, 17),
    shB: [-38, 204], elB: [-55, 268], wrB: [-50, 330],
    shF: [60, 202], elF: [77, 266], wrF: [82, 327],
    waist: [12, 292],
    hipB: [-14, 312], knB: [-48, 388], anB: [-54, 454],
    hipF: [38, 312], knF: [70, 388], anF: [76, 454],
  };
  const skin = INK.jade;
  const head = {
    box: bb(3, G.face, G.helmet, G.leaves.flat(), G.finial, G.karn, [X(28, 0)]), z: -1, parent: 'torso', joint: J.neck, lim: [-20, 20], stiff: 0.7, mass: 1.1,
    draw: (ctx) => yakHead(ctx, E, k, G, { skin }),
  };
  const jaw = {
    box: bb(3, G.jaw, [X(-4, 44)]), z: -1.5, parent: 'head', joint: J.jaw, lim: [-3, 28], stiff: 0.6, mass: 0.3, noRivet: true,
    draw: (ctx) => yakJaw(ctx, E, k, G, { skin }),
  };
  // ---------------------------------------------------------------- torso
  const torsoPts = wob([[-10, 180], [-24, 184], [-38, 190], [-50, 199], [-53, 214], [-48, 232], [-41, 250], [-34, 270], [-31, 290], [-33, 312], [-12, 318],
    [12, 320], [34, 318], [50, 312], [48, 290], [50, 270], [57, 250], [66, 232], [72, 214], [70, 200], [58, 190], [42, 184], [26, 180], [10, 178]], 0.5, 301);
  const collar = wob([[-52, 202], [-42, 190], [-24, 182], [-4, 176], [14, 175], [32, 177], [50, 184], [66, 193], [73, 206], [60, 218], [44, 228], [26, 234], [12, 236], [-2, 234], [-20, 228], [-36, 218], [-49, 210]], 0.4, 302);
  const torso = {
    box: bb(3, torsoPts, collar), z: 0, mass: 1.6,
    draw(ctx) {
      leather(ctx, smooth(torsoPts, true));
      const body = inset(torsoPts, 2.6);
      dye(ctx, smooth(body, true), INK.red, 0.86);
      scales(ctx, body, { sp: 8, dotR: 1.05 });
      // straps crossing the chest and a central breastplate (ทับทรวง)
      for (const [a, b] of [[[-44, 214], [40, 282]], [[64, 212], [-18, 282]]]) {
        ink(ctx, [a, b], INK.leather, 6);
        stripe(ctx, [a, mix(a, b, 0.5), b], 4.4, { fill: INK.gold, edge: INK.white, ew: 0.5, seed: 311, sp: 2.6, r: 0.75 });
      }
      const pl = [[12, 222], [30, 240], [26, 262], [12, 276], [-2, 262], [-6, 240]];
      leather(ctx, smooth(pl, true, 0.3));
      panel(ctx, pl, { fill: INK.green, sp: 3.2, r: 0.9, seed: 312, d2: 2.8 });
      dye(ctx, smooth(inset(pl, 5.5), true, 0.3), INK.gold, 0.85);
      flower(ctx, 12, 249, 8, { n: 10 });
      fringe(ctx, C([[-2, 262], [12, 276], [26, 262]]), 3.6, { flip: false, h: 1.2 });
      // belly band with a kala-flower
      stripe(ctx, [[-32, 284], [12, 289], [49, 284]], 9, { fill: INK.gold, edge: INK.white, seed: 330, sp: 3.2, r: 1.05 });
      fringe(ctx, [[-30, 279], [12, 284], [47, 279]], 4.6, { h: 1.3 });
      flower(ctx, 12, 288, 7.5, { n: 10 });
      // big collar
      leather(ctx, smooth(collar, true));
      dye(ctx, smooth(inset(collar, 1.5), true), INK.green, 0.9);
      lace(ctx, inset(collar, 3), { sp: 5, r: 0.9, style: 'quad', seed: 340, punch: 0.3 });
      stripe(ctx, [[-44, 200], [-24, 189], [12, 183], [46, 188], [66, 200]], 6, { fill: INK.gold, seed: 341, sp: 2.6, r: 0.8, edge: INK.white });
      stripe(ctx, [[-44, 210], [-22, 222], [12, 228], [44, 222], [64, 208]], 6, { fill: INK.red, seed: 342, sp: 2.8, r: 0.85, edge: INK.white });
      for (const x of [-26, -6, 12, 30, 48]) flower(ctx, x, 204 + (x === 12 ? 4 : 0), 4.4, { n: 8 });
      fringe(ctx, [[-48, 214], [-30, 226], [-10, 234], [12, 237], [34, 234], [52, 226], [68, 212]], 6.5, { flip: true, h: 1.35, col: INK.gold, inner: INK.red });
      dots(ctx, inset(collar, 2.4), { sp: 3, r: 0.85, closed: true, seed: 343, punch: 0.2 });
      rim(ctx, torsoPts, { seed: 344, gold: false, d: 2.2 });
    },
  };
  // ---------------------------------------------------------------- skirt
  const tailB = hornPts([-26, 318], 88, 160 * DEG, 100 * DEG, 30, { swell: 10, taper: 0.9 });
  const tailB2 = hornPts([-22, 330], 62, 140 * DEG, 80 * DEG, 20, { swell: 6, taper: 0.9 });
  const flapF = hornPts([44, 318], 58, 36 * DEG, -88 * DEG, 22, { swell: 7, taper: 0.9 });
  const skirtCore = wob([[-33, 286], [12, 290], [50, 286], [54, 306], [55, 326], [46, 338], [30, 342], [24, 360], [13, 404], [2, 360], [-4, 342], [-24, 340], [-36, 330], [-38, 310]], 0.5, 351);
  const skirt = {
    box: bb(3, skirtCore, tailB, tailB2, flapF), z: 1, parent: 'torso', joint: J.waist, lim: [-14, 14], stiff: 0.75, mass: 1.3,
    draw(ctx) {
      for (const [fl, sd, cols] of [[tailB, 5, [INK.gold, INK.red, INK.green]], [tailB2, 6, [INK.gold, INK.green, INK.red]], [flapF, 7, [INK.gold, INK.red, INK.green]]]) {
        leather(ctx, smooth(fl, true, 0.45));
        flameDeco(ctx, fl, { seed: sd, cols, d: [1.4, 4.4, 8.2] });
      }
      leather(ctx, smooth(skirtCore, true, 0.45));
      const hip = [[-31, 294], [50, 294], [53, 316], [44, 334], [12, 338], [-24, 334], [-35, 316]];
      dye(ctx, smooth(hip, true), INK.green, 0.86);
      brocade(ctx, hip, { sp: 9, seed: 5, dotR: 1 });
      stripe(ctx, [[-34, 330], [12, 337], [52, 330]], 5.5, { fill: INK.gold, seed: 12, sp: 2.6, r: 0.8, edge: INK.white });
      fringe(ctx, [[-33, 334], [12, 341], [51, 334]], 4.4, { flip: true, h: 1.2, inner: INK.green });
      const apron = [[1, 296], [24, 296], [25, 330], [23, 364], [18, 388], [13, 402], [8, 388], [3, 364], [0, 330]];
      leather(ctx, smooth(apron, true));
      panel(ctx, apron, { fill: INK.gold, alpha: 0.9, sp: 3, r: 0.85, seed: 8, d2: 2.2, edge: INK.white });
      dye(ctx, smooth(inset(apron, 4.4), true), INK.red, 0.88);
      for (let y = 310; y < 394; y += 14) flower(ctx, 12.5, y, 5 - (y - 310) * 0.015, { n: 8 });
      stripe(ctx, [[-34, 292], [12, 296], [50, 292]], 9, { fill: INK.gold, seed: 10, sp: 3.2, r: 1.05, edge: INK.white });
      for (const x of [-20, 38]) gem(ctx, x, 293.5, 2.8, { col: INK.green });
      const buckle = blobPts(12.5, 295, 10, 9, { seed: 4, wobble: 0.05 });
      leather(ctx, smooth(buckle, true));
      dye(ctx, smooth(inset(buckle, 1), true), INK.gold, 0.95);
      flower(ctx, 12.5, 295, 7, { n: 10 });
      rim(ctx, skirtCore, { seed: 11, gold: false, d: 2 });
    },
  };
  // ---------------------------------------------------------------- limbs
  const dB = unit(J.wrB[0] - J.elB[0], J.wrB[1] - J.elB[1]);
  const dF = unit(J.wrF[0] - J.elF[0], J.wrF[1] - J.elF[1]);
  const hk = 1.25;
  const hf = handFrame(J.wrF, dF, 1, hk), hb = handFrame(J.wrB, dB, 1, hk);
  const UA = { ra: 13.5, rb: 11 }, FA = { ra: 11, rb: 9 }, TH = { ra: 18, rb: 13 }, SH = { ra: 13, rb: 8.5 };
  const defs = {
    torso, head, jaw, skirt,
    upperArmB: { box: bb(4, paddle(J.shB, J.elB, UA.ra, UA.rb, { ext: 3, extA: 2 }), [add(J.shB, [-30, -32])]), z: -8, parent: 'torso', joint: J.shB, stiff: 0.12, mass: 1.2, draw: (ctx) => upperArm(ctx, J.shB, J.elB, { ...UA, seed: 401, side: -1, skin, flame: 32, lz: false }) },
    forearmB: { box: bb(4, paddle(J.elB, J.wrB, FA.ra, FA.rb, { ext: 5, extA: 1 })), z: -7, parent: 'upperArmB', joint: J.elB, lim: [-150, 12], stiff: 0.18, mass: 1.1, draw: (ctx) => forearm(ctx, J.elB, J.wrB, { ...FA, seed: 402, skin, lz: false }) },
    handB: { box: bb(3, [hb(-10, -8), hb(-10, 9), hb(38, -18), hb(34, 14), hb(18, 22)]), z: -9, parent: 'forearmB', joint: J.wrB, lim: [-55, 55], stiff: 0.3, mass: 0.7, draw: (ctx) => openHand(ctx, J.wrB, dB, { side: 1, seed: 403, curl: 0.5, k: hk, skin }) },
    thighB: { box: bb(4, paddle(J.hipB, J.knB, TH.ra, TH.rb, { ext: 2, extA: 3 })), z: -6, parent: 'skirt', joint: J.hipB, lim: [-75, 75], stiff: 0.45, mass: 1.2, draw: (ctx) => thigh(ctx, J.hipB, J.knB, { ...TH, seed: 404, fill: INK.red, fill2: INK.green }) },
    shinB: { box: bb(4, paddle(J.knB, J.anB, SH.ra, SH.rb, { ext: 4, extA: 2 }), footPts(J.anB, -1, { len: 46 })), z: -7, parent: 'thighB', joint: J.knB, lim: [-8, 125], stiff: 0.5, draw: (ctx) => shin(ctx, J.knB, J.anB, -1, { ...SH, seed: 405, footLen: 46, skin, lz: false, guard: INK.red }) },
    thighF: { box: bb(4, paddle(J.hipF, J.knF, TH.ra, TH.rb, { ext: 2, extA: 3 })), z: -4, parent: 'skirt', joint: J.hipF, lim: [-75, 75], stiff: 0.45, mass: 1.2, draw: (ctx) => thigh(ctx, J.hipF, J.knF, { ...TH, seed: 406, fill: INK.red, fill2: INK.green }) },
    shinF: { box: bb(4, paddle(J.knF, J.anF, SH.ra, SH.rb, { ext: 4, extA: 2 }), footPts(J.anF, 1, { len: 46 })), z: -5, parent: 'thighF', joint: J.knF, lim: [-8, 125], stiff: 0.5, draw: (ctx) => shin(ctx, J.knF, J.anF, 1, { ...SH, seed: 407, footLen: 46, skin, lz: false, guard: INK.red }) },
    upperArmF: { box: bb(4, paddle(J.shF, J.elF, UA.ra, UA.rb, { ext: 3, extA: 2 }), [add(J.shF, [30, -32])]), z: 4, parent: 'torso', joint: J.shF, stiff: 0.12, mass: 1.2, draw: (ctx) => upperArm(ctx, J.shF, J.elF, { ...UA, seed: 408, side: 1, skin, flame: 32, lz: false }) },
    forearmF: { box: bb(4, paddle(J.elF, J.wrF, FA.ra, FA.rb, { ext: 5, extA: 1 })), z: 6, parent: 'upperArmF', joint: J.elF, lim: [-150, 12], stiff: 0.18, mass: 1.1, draw: (ctx) => forearm(ctx, J.elF, J.wrF, { ...FA, seed: 409, skin, lz: false }) },
    handF: { box: bb(3, [hf(-10, -8), hf(-10, 9), hf(28, -13), hf(28, 12)]), z: 5, parent: 'forearmF', joint: J.wrF, lim: [-55, 55], stiff: 0.3, mass: 0.7, draw: (ctx) => fist(ctx, J.wrF, dF, { side: 1, seed: 410, k: hk, skin }) },
  };
  return buildRig(
    { id: 'yak', name: 'ยักษ์', en: 'Yak — the Demon', kind: 'demon', voice: 'demon', height: 470 },
    defs,
    {
      rod: [[12, 190], [12, 292], 300],
      handRods: { handF: hf(9, 0), handB: hb(10, 0) },
      grips: { handF: hf(15, 0.5), handB: hb(12, 0) },
      holds: { handF: 'gada' },
      limbs: STD_LIMBS({ jaw: 'jaw' }),
      lines: LINES.yak,
    },
  );
}

// ================================================================ หนุมาน Hanuman
// White monkey warrior: cream-dyed, heavily punched hide so he glows white
// on the screen; open-mouthed monkey face with fangs under a small crown
// with a pointed top; long segmented tail.
function hanGeom(E, k) {
  const X = (x, y) => [E[0] + x * k, E[1] + y * k];
  const face = [X(3, -20), X(11, -16.5), X(16.5, -11), X(15, -6.5), X(16.4, -3), X(20.5, -1), X(24.8, 1.2), X(28, 1.6), X(29, 5), X(26.4, 7.6),
    X(27.8, 9.4), X(28.8, 12.6), X(27, 14.8), X(10, 14), X(4, 12.2), X(-2, 16), X(-10, 15), X(-8, 26), X(-6, 36), X(-6, 44), X(-19, 44), X(-19, 26), X(-18, 8),
    X(-17, -6), X(-10, -18)];
  const jaw = [X(-13, 11), X(-5, 14), X(3, 12.4), X(12, 14.2), X(24.5, 20.6), X(27, 23.8), X(24, 29.4), X(16.5, 33.6), X(6, 35), X(-4, 32), X(-11, 26), X(-14, 18)];
  const band = [X(8.6, -19), X(-2, -18.6), X(-15, -15.5), X(-25, -9), X(-28, 0)];
  const cap = [X(9, -17), X(11, -24), X(7, -31), X(-4, -36), X(-17, -35.5), X(-27, -29), X(-31, -18), X(-30, -6), X(-26, 0), X(-17, -8), X(-7, -14.5), X(2, -17.5)];
  const crown = chadaGeom(X(-9, -34), X(-11, -56), X(-12, -74), 9.5 * k, { tiers: 3, topW: 2.4 * k, lip: 2 * k, pw: 1.2 });
  const ear = [X(-7, -6), X(-3.5, -1), X(-4, 6), X(-7.5, 10.5), X(-12.6, 9), X(-14, 1), X(-11.5, -5)];
  const karn = hornPts(X(-17, 8), 30 * k, 200 * DEG, 76 * DEG, 14 * k, { swell: 5 * k, taper: 0.8 });
  return { X, face, jaw, band, cap, crown, spire: crown.outline, ear, karn };
}

// White fur: short cream crescents scattered in rows (ขน).
function fur(ctx, pts, { sp = 5, seed = 71, col = INK.cream, punch = 0.3 } = {}) {
  const path = smooth(pts, true);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const rr = rng(seed);
  const P = new Path2D(), H = [];
  for (let y = y0, row = 0; y < y1 + sp; y += sp * 0.8, row++) {
    for (let x = x0 + (row % 2) * sp * 0.5; x < x1 + sp; x += sp) {
      const jx = (rr() - 0.5) * sp * 0.4, jy = (rr() - 0.5) * sp * 0.4;
      if (rr() < punch) { H.push([x + jx, y + jy, 0.75]); continue; }
      const a = 1.1 + (rr() - 0.5) * 0.5;
      P.moveTo(x + jx + Math.cos(a - 0.9) * 2.2, y + jy + Math.sin(a - 0.9) * 2.2);
      P.arc(x + jx, y + jy, 2.2, a - 0.9, a + 0.9);
    }
  }
  ctx.save();
  ctx.clip(path);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.strokeStyle = '#b89a6a'; ctx.lineWidth = 0.7; ctx.stroke(P);
  ctx.restore();
  ctx.save(); ctx.clip(path); spots(ctx, H, 0.75, { punch: true }); ctx.restore();
  void col;
}

function hanHead(ctx, E, k, G, { skin = INK.white, seed = 500 } = {}) {
  const { X, face, band, cap, crown, ear, karn } = G;
  leather(ctx, smooth(karn, true, 0.45));
  flameDeco(ctx, karn, { seed: seed + 30, cols: [INK.gold, INK.red, INK.green], d: [1.3, 3.8, 6.8] });
  leather(ctx, smooth(face, true, 0.4));
  dye(ctx, smooth(inset(face, 1), true), skin, 0.96);
  // ลายหน้า: red and gold line-work over the muzzle and cheek
  ink(ctx, [X(16.4, -3), X(15.2, 3), X(16.5, 9), X(20, 13), X(26.5, 13.4)], INK.red, 0.9);
  goldL(ctx, [X(21, 0.6), X(24.5, 3.6), X(26.4, 7)], 0.9);
  ink(ctx, [X(26.6, 6.2), X(24.6, 7.4), X(26, 8.6)], INK.leather, 1.1);
  goldL(ctx, spiral(X(8, 6), 4.6 * k, -1.4, 1.15, 1), 0.95);
  ink(ctx, spiral(X(8, 6), 2.6 * k, -1.4, 0.9, 1), INK.red, 0.7);
  goldL(ctx, [X(-3, 10), X(2, 12.5), X(7, 10.5)], 0.7);
  goldL(ctx, [X(3, -17.5), X(8, -14.5), X(12.5, -12)], 0.7);
  // upper teeth and two fangs
  const teeth = new Path2D();
  for (let x = 9.6; x < 26; x += 2.3) { const a = X(x, 13.8 + (x - 9.6) * 0.04), b = X(x + 1.9, 16.2); teeth.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]); }
  leather(ctx, teeth); dye(ctx, teeth, INK.white, 1);
  ink(ctx, [X(9, 13.8), X(18, 13.9), X(27.2, 14.4)], INK.red, 1.2 * k);
  for (const [x, len] of [[22.5, 8.5], [11, 7]]) {
    const f = hornPts(X(x, 14.4), len * k, 92 * DEG, -16 * DEG, 3.2 * k);
    leather(ctx, smooth(f, true)); dye(ctx, smooth(inset(f, 0.4), true), INK.white, 1);
  }
  // big round eye: gold ring, black rim, glinting pupil
  const ring = new Path2D(); ring.ellipse(E[0] + 1 * k, E[1] - 0.6 * k, 6 * k, 5.4 * k, 0, 0, TAU);
  dye(ctx, ring, INK.gold, 0.96);
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.strokeStyle = INK.leather; ctx.lineWidth = 0.9 * k; ctx.stroke(ring); ctx.restore();
  const w = new Path2D(); w.ellipse(E[0] + 1.3 * k, E[1] - 0.6 * k, 4.1 * k, 3.6 * k, 0, 0, TAU);
  dye(ctx, w, INK.white, 1);
  const pup = new Path2D(); pup.arc(E[0] + 2.8 * k, E[1] - 0.4 * k, 2.5 * k, 0, TAU);
  dye(ctx, pup, INK.leather, 1);
  hole(ctx, E[0] + 3.4 * k, E[1] - 1.3 * k, 0.75 * k);
  ink(ctx, [X(7.4, 0.5), X(10.5, 3), X(11.2, 6.4)], INK.leather, 0.9);
  ink(ctx, [X(-4.6, -1), X(-8, 1.5), X(-9.4, -1)], INK.leather, 0.9);
  // flame brow: five curling hair-flames sweeping up and back
  for (let i = 0; i < 5; i++) {
    const c = hornPts(X(14.5 - i * 4.2, -9.5 - i * 0.9), (9 + i * 1.6) * k, (-100 - i * 13) * DEG, -64 * DEG, 4.2 * k, { swell: 0.8 * k });
    leather(ctx, smooth(c, true, 0.4));
    dye(ctx, smooth(inset(c, 0.5), true), skin, 0.96);
    goldL(ctx, C(c.slice(2, 14)), 0.55);
  }
  goldL(ctx, [X(15.5, -9), X(8, -12.5), X(0, -13.4), X(-8, -12)], 1, { alpha: 0.95 });
  dots(ctx, [X(13, -10.5), X(2, -12), X(-9, -10)], { sp: 2.4, r: 0.7, seed: seed + 3, punch: 0.4 });
  // fur on the head and cheek: punched dots
  lace(ctx, [X(-17, -6), X(-8, -12), X(-5, 0), X(-8, 14), X(-17, 20)], { sp: 3.4, r: 0.75, style: 'dot', seed: seed + 5, punch: 0.6 });
  // ear with a gold กุณฑล
  leather(ctx, smooth(ear, true));
  dye(ctx, smooth(inset(ear, 0.8), true), skin, 0.96);
  ink(ctx, [X(-6, -2), X(-6.5, 4), X(-9.5, 7)], '#8a6a3a', 0.7);
  const er = new Path2D(); er.arc(...X(-9, 13.5), 3.4 * k, 0, TAU);
  ctx.save(); ctx.strokeStyle = INK.leather; ctx.lineWidth = 2.4 * k; ctx.stroke(er); ctx.strokeStyle = INK.gold; ctx.lineWidth = 1.3 * k; ctx.stroke(er); ctx.restore();
  gem(ctx, ...X(-9, 17), 1.9 * k);
  // crown: skull cap, band and a short tiered spire (ยอด)
  leather(ctx, smooth(crown.outline, true, 0.4));
  crown.rings.forEach((g, i) => {
    dye(ctx, poly(g.quad), i % 2 ? INK.green : INK.red, 0.9);
    stripe(ctx, [g.a, mix(g.a, g.b, 0.5), g.b], 3 * k, { fill: INK.gold, edge: INK.white, ew: 0.5, seed: seed + 20 + i, sp: 2.1, r: 0.55 });
    fringe(ctx, [mix(g.a, g.b, 0.05), mix(g.a, g.b, 0.95)], Math.max(2.4, g.w0 * 0.4), { h: 1.55, gap: 1, edge: INK.white });
  });
  const sA = crown.sAt;
  dye(ctx, smooth([sA(0.02, -3), sA(0.02, 3), sA(0.8, 0.9), sA(1, 0), sA(0.8, -0.9)], true), INK.gold, 0.92);
  gem(ctx, ...sA(0.22, 0), 2.8 * k);
  leather(ctx, smooth(cap, true));
  dye(ctx, smooth(inset(cap, 1.3), true), INK.green, 0.9);
  lace(ctx, inset(cap, 2), { sp: 4.2, r: 0.8, style: 'quad', seed: seed + 6, punch: 0.35 });
  stripe(ctx, [X(8, -28), X(-4, -33), X(-18, -33), X(-28, -25)], 3.4 * k, { fill: INK.red, seed: seed + 8, sp: 2.4, r: 0.6, edge: INK.white });
  stripe(ctx, band, 5.6 * k, { fill: INK.gold, seed: seed + 7, sp: 2.4, r: 0.7, edge: INK.white });
  for (const t of [0.12, 0.4, 0.68]) { const q = C(band); const p = q[Math.floor(q.length * t)]; gem(ctx, p[0], p[1], 1.9 * k); }
  fringe(ctx, [X(8.6, -22.6), X(-3, -22.4), X(-16, -19.4), X(-26, -12.5)], 3.8 * k, { h: 1.5, edge: INK.white });
}

function hanJaw(ctx, E, k, G, { skin = INK.white } = {}) {
  const { X, jaw } = G;
  leather(ctx, smooth(jaw, true, 0.4));
  dye(ctx, smooth(inset(jaw, 1), true), skin, 0.96);
  // open mouth: red interior with a curled tongue, lower teeth and fangs
  dye(ctx, smooth([X(3, 12.6), X(12, 13), X(24.5, 20.2), X(22, 23.4), X(10, 20), X(2, 16)], true), INK.red, 0.96);
  ink(ctx, [X(8, 17), X(14, 16.5), X(18, 18.6), X(16, 20.4)], INK.pink, 1.4 * k);
  const teeth = new Path2D();
  for (let x = 13; x < 23.5; x += 2.3) {
    const y0 = 14.6 + (x - 12) * 0.52;
    const a = X(x, y0 + 0.2), b = X(x + 1.9, y0 + 2.2);
    teeth.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  }
  dye(ctx, teeth, INK.white, 1);
  for (const [x, y] of [[22.5, 20], [13.5, 15.4]]) {
    const f = hornPts(X(x, y), 7 * k, -100 * DEG, 16 * DEG, 3 * k);
    leather(ctx, smooth(f, true)); dye(ctx, smooth(inset(f, 0.4), true), INK.white, 1);
  }
  ink(ctx, [X(12, 14.5), X(25, 21.4)], INK.red, 1.1 * k);
  goldL(ctx, [X(24, 27), X(16, 31.5), X(5, 31.4)], 0.8);
  goldL(ctx, spiral(X(9, 27), 2.6 * k, 0, 1, 1), 0.6);
  lace(ctx, [X(-10, 20), X(0, 24), X(8, 32), X(0, 34), X(-10, 28)], { sp: 3.4, r: 0.7, style: 'dot', seed: 555, punch: 0.6 });
}

// Tail segment (tapering white tube with gold fur rings); `curl` adds the
// curled tuft at the tip.
function tailSeg(ctx, a, b, ra, rb, { seed = 1, skin = INK.white, curl = 0 } = {}) {
  const pts = wob(paddle(a, b, ra, rb, { bulge: 0.02, ext: 1, extA: 1 }), 0.25, seed);
  leather(ctx, smooth(pts, true));
  dye(ctx, smooth(inset(pts, 1), true), skin, 0.95);
  const f = frame(a, b);
  for (let t = 0.2; t < 1; t += 0.28) {
    const r = lerp(ra, rb, t);
    const band = [f.at(t - 0.06, -r * 1.05), f.at(t, 0), f.at(t - 0.06, r * 1.05)];
    ink(ctx, band, INK.goldLine, 1.1);
    dots(ctx, offset(C(band), 1.8), { sp: 2.4, r: 0.6, seed: seed + t * 10, punch: 0.5 });
  }
  rim(ctx, pts, { seed, gold: false, d: 1.8, sp: 3.2, r: 0.85, punch: 0.6 });
  if (curl) {
    const c = [b, ...spiral([b[0] + curl * 9, b[1] - 8], 12, curl > 0 ? Math.PI * 0.9 : 0.1, 1.05, curl, 22)];
    const tuft = brush(C(c, false, 3), rb * 2.2, 1.4);
    leather(ctx, smooth(tuft, true, 0.35));
    dye(ctx, smooth(inset(tuft, 0.8), true), skin, 0.95);
    dots(ctx, C(c, false, 3), { sp: 2.6, r: 0.8, seed: seed + 7, punch: 0.6 });
    return [...pts, ...tuft];
  }
  return pts;
}

function buildHanuman() {
  const k = 1.25;
  const E = [24, 94];
  const G = hanGeom(E, k);
  const X = G.X;
  const J = {
    neck: X(-12, 36), jaw: X(-11, 15),
    shB: [-30, 150], elB: [-46, 210], wrB: [-44, 268],
    shF: [44, 148], elF: [62, 207], wrF: [70, 264],
    waist: [6, 232],
    hipB: [-12, 252], knB: [-46, 318], anB: [-50, 404],
    hipF: [24, 252], knF: [60, 318], anF: [64, 404],
    tail: [[-22, 268], [-60, 266], [-94, 240], [-106, 198], [-92, 160]],
  };
  const skin = INK.white;
  const head = {
    box: bb(3, G.face, G.cap, G.spire, G.karn, [X(30, 0)]), z: -1, parent: 'torso', joint: J.neck, lim: [-22, 22], stiff: 0.65, mass: 0.9,
    draw: (ctx) => hanHead(ctx, E, k, G, { skin }),
  };
  const jaw = {
    box: bb(3, G.jaw), z: -1.5, parent: 'head', joint: J.jaw, lim: [-6, 26], stiff: 0.55, mass: 0.25, noRivet: true,
    draw: (ctx) => hanJaw(ctx, E, k, G, { skin }),
  };
  // ---------------------------------------------------------------- torso
  const torsoPts = wob([[-8, 132], [-20, 136], [-32, 142], [-40, 151], [-41, 164], [-35, 180], [-28, 198], [-23, 216], [-22, 232], [-23, 250], [-8, 256],
    [8, 258], [24, 256], [36, 250], [35, 232], [38, 216], [44, 198], [50, 180], [55, 164], [54, 151], [44, 141], [30, 135], [18, 132], [6, 130]], 0.4, 601);
  const collar = wob([[-41, 152], [-32, 142], [-18, 135], [-2, 131], [12, 130], [28, 133], [42, 139], [53, 147], [56, 158], [44, 168], [30, 175], [16, 179], [6, 180], [-6, 178], [-20, 172], [-32, 164], [-40, 158]], 0.3, 602);
  const torso = {
    box: bb(3, torsoPts, collar), z: 0, mass: 1.3,
    draw(ctx) {
      leather(ctx, smooth(torsoPts, true));
      const body = inset(torsoPts, 1.4);
      dye(ctx, smooth(body, true), skin, 0.95);
      fur(ctx, body, { seed: 603 });
      // chest muscles and belly lines in gold
      goldL(ctx, [[-14, 196], [-4, 204], [8, 200]], 0.9);
      goldL(ctx, [[14, 200], [26, 204], [38, 196]], 0.9);
      goldL(ctx, [[2, 214], [6, 222], [10, 214]], 0.7);
      // sash (สไบ) across the chest: red with gold edges
      const sash = [[-40, 160], [-30, 158], [42, 238], [36, 250], [26, 246]];
      leather(ctx, smooth(sash, true, 0.3));
      panel(ctx, sash, { fill: INK.red, sp: 3, r: 0.85, seed: 604, d2: 2.4 });
      for (let t = 0.15; t < 0.95; t += 0.18) flower(ctx, ...mix([-33, 162], [34, 244], t), 3.4, { n: 6 });
      // belly band
      stripe(ctx, [[-22, 228], [6, 232], [35, 228]], 7, { fill: INK.gold, edge: INK.white, seed: 605, sp: 3, r: 0.9 });
      fringe(ctx, [[-20, 224.5], [6, 228.5], [33, 224.5]], 4, { h: 1.3 });
      // collar
      leather(ctx, smooth(collar, true));
      dye(ctx, smooth(inset(collar, 1.5), true), INK.green, 0.9);
      lace(ctx, inset(collar, 3), { sp: 4.6, r: 0.85, style: 'quad', seed: 606, punch: 0.35 });
      stripe(ctx, [[-34, 150], [-18, 141], [6, 137], [30, 140], [49, 149]], 5, { fill: INK.gold, seed: 607, sp: 2.5, r: 0.75, edge: INK.white });
      for (const x of [-22, -6, 10, 26, 40]) flower(ctx, x, 156 + (x === 10 ? 4 : 0) + Math.abs(x - 10) * 0.04, 3.8, { n: 8 });
      fringe(ctx, [[-38, 162], [-24, 172], [-6, 180], [8, 182], [24, 178], [38, 170], [52, 160]], 5.4, { flip: true, h: 1.35, col: INK.gold, inner: INK.red });
      dots(ctx, inset(collar, 2.3), { sp: 3, r: 0.8, closed: true, seed: 608, punch: 0.2 });
      rim(ctx, torsoPts, { seed: 609, gold: false, d: 2, punch: 0.5 });
    },
  };
  // ---------------------------------------------------------------- skirt
  const flapF = hornPts([28, 262], 50, 36 * DEG, -96 * DEG, 20, { swell: 6, taper: 0.9 });
  const flapB = hornPts([-16, 262], 52, 144 * DEG, 96 * DEG, 20, { swell: 6, taper: 0.9 });
  const skirtCore = wob([[-24, 226], [6, 229], [36, 226], [39, 244], [40, 262], [34, 274], [22, 278], [16, 296], [7, 322], [0, 296], [-5, 278], [-18, 276], [-26, 268], [-27, 246]], 0.4, 651);
  const skirt = {
    box: bb(3, skirtCore, flapF, flapB), z: 1, parent: 'torso', joint: J.waist, lim: [-14, 14], stiff: 0.75, mass: 1.1,
    draw(ctx) {
      for (const [fl, sd] of [[flapB, 5], [flapF, 6]]) { leather(ctx, smooth(fl, true, 0.45)); flameDeco(ctx, fl, { seed: sd, cols: [INK.gold, INK.red, INK.green] }); }
      leather(ctx, smooth(skirtCore, true, 0.45));
      const hip = [[-23, 232], [36, 232], [38, 252], [33, 270], [6, 274], [-20, 270], [-25, 252]];
      dye(ctx, smooth(hip, true), INK.red, 0.86);
      brocade(ctx, hip, { sp: 8, seed: 5, dotR: 1 });
      stripe(ctx, [[-25, 266], [6, 272], [37, 266]], 5, { fill: INK.gold, seed: 12, sp: 2.6, r: 0.75, edge: INK.white });
      fringe(ctx, [[-24, 269.5], [6, 275.5], [36, 269.5]], 4, { flip: true, h: 1.2, inner: INK.green });
      const apron = [[-2, 234], [16, 234], [17, 262], [15, 290], [11, 308], [7, 320], [3, 308], [-1, 290], [-3, 262]];
      leather(ctx, smooth(apron, true));
      panel(ctx, apron, { fill: INK.gold, alpha: 0.9, sp: 3, r: 0.8, seed: 8, d2: 2.2, edge: INK.white });
      dye(ctx, smooth(inset(apron, 4), true), INK.green, 0.88);
      for (let y = 246; y < 312; y += 12.5) flower(ctx, 7, y, 4.4 - (y - 246) * 0.015, { n: 8 });
      stripe(ctx, [[-25, 231], [6, 234], [37, 231]], 7.5, { fill: INK.gold, seed: 10, sp: 3, r: 1, edge: INK.white });
      const buckle = [[7, 224], [16, 233], [7, 242], [-2, 233]];
      leather(ctx, smooth(buckle, true, 0.3));
      dye(ctx, smooth(buckle, true, 0.3), INK.gold, 0.95);
      flower(ctx, 7, 233, 5.6, { n: 8 });
      rim(ctx, skirtCore, { seed: 11, gold: false, d: 2 });
    },
  };
  // ---------------------------------------------------------------- limbs
  const dB = unit(J.wrB[0] - J.elB[0], J.wrB[1] - J.elB[1]);
  const dF = unit(J.wrF[0] - J.elF[0], J.wrF[1] - J.elF[1]);
  const hf = handFrame(J.wrF, dF, 1), hb = handFrame(J.wrB, dB, 1);
  const whiteLimb = (fn) => (ctx) => { fn(ctx); };
  const tl = J.tail;
  const tailR = [9, 8, 6.8, 5.6, 4.4];
  const tailDefs = {};
  for (let i = 0; i < 4; i++) {
    const a = tl[i], b = tl[i + 1];
    const last = i === 3;
    const outline = paddle(a, b, tailR[i] + 1, tailR[i + 1] + 1, { ext: 1, extA: 1 });
    const extraPts = last ? [[b[0] + 30, b[1] - 30], [b[0] - 8, b[1] - 30], [b[0] + 30, b[1] + 10]] : [];
    tailDefs['tail' + i] = {
      box: bb(4, outline, extraPts), z: -12 + i * 0.1, parent: i ? 'tail' + (i - 1) : 'skirt', joint: a, lim: i ? [-38, 38] : [-30, 30],
      stiff: 0.3 - i * 0.04, mass: 0.45 - i * 0.07,
      draw: (ctx) => tailSeg(ctx, a, b, tailR[i], tailR[i + 1], { seed: 700 + i, skin, curl: last ? 1 : 0 }),
    };
  }
  const defs = {
    torso, head, jaw, skirt, ...tailDefs,
    upperArmB: { box: bb(4, paddle(J.shB, J.elB, 11, 8.5, { ext: 3, extA: 2 }), [add(J.shB, [-26, -26])]), z: -8, parent: 'torso', joint: J.shB, stiff: 0.12, draw: whiteLimb((ctx) => upperArm(ctx, J.shB, J.elB, { seed: 801, side: -1, skin, lz: false })) },
    forearmB: { box: bb(4, paddle(J.elB, J.wrB, 8.5, 6.8, { ext: 5, extA: 1 })), z: -7, parent: 'upperArmB', joint: J.elB, lim: [-150, 12], stiff: 0.18, draw: (ctx) => forearm(ctx, J.elB, J.wrB, { seed: 802, skin, lz: false }) },
    handB: { box: bb(3, [hb(-10, -8), hb(-10, 9), hb(38, -18), hb(34, 14), hb(18, 22)]), z: -9, parent: 'forearmB', joint: J.wrB, lim: [-55, 55], stiff: 0.3, mass: 0.6, draw: (ctx) => openHand(ctx, J.wrB, dB, { side: 1, seed: 803, curl: 0.8, skin }) },
    thighB: { box: bb(4, paddle(J.hipB, J.knB, 14, 10.5, { ext: 2, extA: 3 })), z: -6, parent: 'skirt', joint: J.hipB, lim: [-80, 80], stiff: 0.45, draw: (ctx) => thigh(ctx, J.hipB, J.knB, { ra: 14, rb: 10.5, seed: 804, fill: INK.green, fill2: INK.red }) },
    shinB: { box: bb(4, paddle(J.knB, J.anB, 9.5, 6.4, { ext: 4, extA: 2 }), footPts(J.anB, -1)), z: -7, parent: 'thighB', joint: J.knB, lim: [-8, 130], stiff: 0.5, draw: (ctx) => shin(ctx, J.knB, J.anB, -1, { ra: 9.5, rb: 6.4, seed: 805, skin, lz: false, guard: INK.green }) },
    thighF: { box: bb(4, paddle(J.hipF, J.knF, 14, 10.5, { ext: 2, extA: 3 })), z: -4, parent: 'skirt', joint: J.hipF, lim: [-80, 80], stiff: 0.45, draw: (ctx) => thigh(ctx, J.hipF, J.knF, { ra: 14, rb: 10.5, seed: 806, fill: INK.green, fill2: INK.red }) },
    shinF: { box: bb(4, paddle(J.knF, J.anF, 9.5, 6.4, { ext: 4, extA: 2 }), footPts(J.anF, 1)), z: -5, parent: 'thighF', joint: J.knF, lim: [-8, 130], stiff: 0.5, draw: (ctx) => shin(ctx, J.knF, J.anF, 1, { ra: 9.5, rb: 6.4, seed: 807, skin, lz: false, guard: INK.green }) },
    upperArmF: { box: bb(4, paddle(J.shF, J.elF, 11, 8.5, { ext: 3, extA: 2 }), [add(J.shF, [26, -26])]), z: 4, parent: 'torso', joint: J.shF, stiff: 0.12, draw: (ctx) => upperArm(ctx, J.shF, J.elF, { seed: 808, side: 1, skin, lz: false }) },
    forearmF: { box: bb(4, paddle(J.elF, J.wrF, 8.5, 6.8, { ext: 5, extA: 1 })), z: 6, parent: 'upperArmF', joint: J.elF, lim: [-150, 12], stiff: 0.18, draw: (ctx) => forearm(ctx, J.elF, J.wrF, { seed: 809, skin, lz: false }) },
    handF: { box: bb(3, [hf(-10, -8), hf(-10, 9), hf(28, -13), hf(28, 12)]), z: 5, parent: 'forearmF', joint: J.wrF, lim: [-55, 55], stiff: 0.3, mass: 0.6, draw: (ctx) => fist(ctx, J.wrF, dF, { side: 1, seed: 810, skin }) },
  };
  return buildRig(
    { id: 'hanuman', name: 'หนุมาน', en: 'Hanuman — the White Monkey', kind: 'monkey', voice: 'monkey', height: 424 },
    defs,
    {
      rod: [[6, 138], [6, 232], 320],
      handRods: { handF: hf(9, 0), handB: hb(10, 0) },
      grips: { handF: hf(15, 0.5), handB: hb(12, 0) },
      holds: { handF: 'trident' },
      limbs: STD_LIMBS({ jaw: 'jaw', tail: ['tail0', 'tail1', 'tail2', 'tail3'] }),
      lines: LINES.hanuman,
    },
  );
}

// ================================================================ พญา king
// The city lord of 2.jpg: dark leather face with gold line-work, hooked
// nose, moustache and pointed beard, a มงกุฎ flaring into a fan of flames,
// a tall pointed back ornament over the far shoulder, green apron over a
// red chevron sarong, walking cane in the near hand.
function kingGeom(E, k) {
  const X = (x, y) => [E[0] + x * k, E[1] + y * k];
  const face = [X(4, -20), X(10, -16.5), X(13.2, -9.5), X(14.2, -4), X(17.6, 1.6), X(21.6, 7.6), X(23, 11.6), X(21, 13.6), X(17.2, 13.4),
    X(16, 15), X(17.4, 16.8), X(15.6, 18), X(12, 18.4), X(4, 17.6), X(-2, 18.6), X(-10, 16), X(-8, 26), X(-6, 36), X(-6, 44), X(-19, 44), X(-19, 26), X(-17, 8),
    X(-15, -6), X(-9, -18)];
  const jaw = [X(-12, 14), X(-4, 17.4), X(4, 17.8), X(12, 18.6), X(16.4, 18.8), X(17, 21.4), X(15.6, 24.8), X(17, 30), X(14, 38), X(9, 44), X(5, 36), X(-2, 33), X(-10, 27), X(-14, 21)];
  const helmet = [X(8.5, -17), X(10.5, -24), X(6, -31), X(-6, -35.5), X(-19, -35), X(-28, -29), X(-32, -18), X(-31, -4), X(-26, 2), X(-18, -7), X(-8, -14), X(2, -17)];
  // fan crest: seven flame tongues radiating from the crown top
  const fan = [];
  const fc = X(-10, -34);
  for (let i = 0; i < 7; i++) {
    const a = (-150 + i * 18) * DEG;
    const len = (30 + Math.sin((i / 6) * Math.PI) * 14) * k;
    fan.push(hornPts([fc[0] + Math.cos(a) * 4, fc[1] + Math.sin(a) * 4], len, a, (i < 3 ? -18 : i > 3 ? 18 : 0) * DEG, 9 * k, { swell: 3 * k }));
  }
  const fanBack = [];
  for (let i = 0; i <= 16; i++) {
    const a = (-162 + i * 11.2) * DEG;
    const r = (34 + Math.sin((i / 16) * Math.PI) * 14) * k * 0.92;
    fanBack.push([fc[0] + Math.cos(a) * r, fc[1] + Math.sin(a) * r]);
  }
  fanBack.push([fc[0] + 12 * k, fc[1] + 4 * k], [fc[0] - 14 * k, fc[1] + 4 * k]);
  const karn = hornPts(X(-15, 10), 34 * k, 196 * DEG, 80 * DEG, 16 * k, { swell: 6 * k, taper: 0.8 });
  const ear = [X(-6.5, -5), X(-4, 2), X(-5, 11), X(-8, 17), X(-12, 14), X(-13, 3), X(-11, -5)];
  return { X, face, jaw, helmet, fan, fanBack, fc, karn, ear };
}

function kingHead(ctx, E, k, G, { seed = 900 } = {}) {
  const { X, face, helmet, fan, fanBack, fc, karn, ear } = G;
  // fan crest behind the helmet
  leather(ctx, smooth(fanBack, true, 0.4));
  dye(ctx, smooth(inset(fanBack, 1.6), true), INK.red, 0.88);
  lace(ctx, inset(fanBack, 3), { sp: 4.4, r: 0.85, style: 'quad', seed: seed + 1, punch: 0.35 });
  fan.forEach((f, i) => { leather(ctx, smooth(f, true, 0.4)); flameDeco(ctx, f, { seed: seed + 10 + i, cols: [INK.gold, i % 2 ? INK.green : INK.red], d: [1.1, 3.2] }); });
  for (let i = 1; i <= 3; i++) {
    const arc = [];
    for (let j = 0; j <= 12; j++) { const a = (-160 + j * 13.3) * DEG; const r = (8 + i * 7) * k; arc.push([fc[0] + Math.cos(a) * r, fc[1] + Math.sin(a) * r]); }
    stripe(ctx, arc, 3 * k, { fill: INK.gold, edge: INK.white, ew: 0.5, seed: seed + 20 + i, sp: 2.2, r: 0.6 });
  }
  gem(ctx, fc[0], fc[1] - 6 * k, 3.4 * k);
  // dark face with gold line-work (like the hermit of the sheet)
  leather(ctx, smooth(face, true, 0.4));
  goldL(ctx, [X(10.5, -6.8), X(4.5, -9.2), X(-3, -9.4), X(-10, -7)], 1.3);
  goldL(ctx, [X(9.5, -5), X(3.5, -7.2), X(-3, -7.4)], 0.6, { alpha: 0.8 });
  const up = [X(7.2, -0.5), X(3.8, -3), X(-1.4, -3.3), X(-6.5, -1.8), X(-11, -1.4)];
  const lo = [X(7.2, -0.5), X(3.4, 1.6), X(-2, 1.8), X(-6.6, 0.5)];
  dye(ctx, smooth([...up.slice(0, 4), ...lo.slice(1).reverse()], true), INK.white, 0.95);
  ink(ctx, up, INK.leather, 1.1); ink(ctx, lo, INK.leather, 0.6);
  const iris = new Path2D(); iris.arc(E[0] + 2.2 * k, E[1] - 0.8 * k, 2.1 * k, 0, TAU); dye(ctx, iris, INK.leather, 1);
  hole(ctx, E[0] + 2.8 * k, E[1] - 1.4 * k, 0.55 * k);
  goldL(ctx, [X(-1, -4.8), X(-6.5, -3.8), X(-10.5, -2.6)], 0.5, { alpha: 0.8 });
  goldL(ctx, [X(14, -3), X(17.8, 3), X(21, 9), X(20.4, 12.4), X(17.4, 12.8)], 0.9); // nose line
  goldL(ctx, [X(16.4, 10.4), X(14.8, 12), X(16.2, 12.8)], 0.7);
  goldL(ctx, [X(8, 4), X(4, 9), X(6, 14)], 0.6, { alpha: 0.7 }); // cheek fold
  dye(ctx, smooth([X(15.6, 15.4), X(17, 16.8), X(15.2, 17.8), X(12.6, 17.4), X(13.4, 15.6)], true), INK.red, 0.9);
  // moustache sweeping back with a curl
  const mc = [X(16.4, 14.6), X(12, 15), X(6, 14.4), X(1, 12.6), ...spiral(X(0, 9.4), 3.2 * k, Math.PI / 2, 1, 1, 12).slice(1)];
  const mous = brush(C(mc, false, 4), 3.4 * k, 0.8 * k);
  leather(ctx, smooth(mous, true, 0.3));
  dots(ctx, C(mc.slice(0, 5), false, 4), { sp: 2, r: 0.6, seed: seed + 3, punch: 0 });
  goldL(ctx, [X(-4, 23), X(-2, 30), X(-4, 38)], 0.6, { alpha: 0.7 });
  // ear
  leather(ctx, smooth(ear, true));
  goldL(ctx, C(inset(ear, 1.4), true), 0.6, { closed: true });
  goldL(ctx, [X(-7, -1.5), X(-7, 6), X(-9.5, 12)], 0.6);
  // helmet + band
  leather(ctx, smooth(helmet, true));
  dye(ctx, smooth(inset(helmet, 1.4), true), INK.green, 0.88);
  lace(ctx, inset(helmet, 2.2), { sp: 4.4, r: 0.8, style: 'quad', seed: seed + 6, punch: 0.3 });
  const band = [X(9.8, -19.5), X(-2, -18.8), X(-16, -15.5), X(-26, -7), X(-29, 1)];
  stripe(ctx, band, 6 * k, { fill: INK.gold, seed: seed + 7, sp: 2.5, r: 0.75, edge: INK.white });
  for (const t of [0.1, 0.35, 0.6]) { const q = C(band); const p = q[Math.floor(q.length * t)]; gem(ctx, p[0], p[1], 2.1 * k); }
  fringe(ctx, [X(9, -23.5), X(-3, -23.6), X(-17, -20.5), X(-28, -12)], 4 * k, { h: 1.6, edge: INK.white });
  stripe(ctx, [X(7, -29), X(-5, -33.5), X(-19, -33), X(-28, -26)], 3.4 * k, { fill: INK.red, seed: seed + 8, sp: 2.4, r: 0.6, edge: INK.white });
  const pk = krajangPath(...X(9.4, -23.5), 8 * k, 15 * k, -98 * DEG);
  leather(ctx, pk); dye(ctx, pk, INK.gold, 0.9); hole(ctx, ...X(9.8, -30.5), 1);
  // กรรเจียก, ear flower and pendant
  leather(ctx, smooth(karn, true, 0.45));
  flameDeco(ctx, karn, { seed: seed + 30, cols: [INK.gold, INK.red, INK.green], d: [1.3, 3.8, 6.8] });
  flower(ctx, ...X(-9, 1), 4.6 * k, { n: 8 });
  const drop = [X(-9, 16), X(-6.4, 21), X(-9, 27), X(-11.6, 21)];
  leather(ctx, smooth(drop, true)); dye(ctx, smooth(drop, true), INK.gold, 0.9); gem(ctx, ...X(-9, 21.4), 1.8 * k);
}

function kingJaw(ctx, E, k, G, { seed = 950 } = {}) {
  const { X, jaw } = G;
  leather(ctx, smooth(jaw, true, 0.4));
  // pointed beard of white dotted locks
  for (let i = 0; i < 5; i++) {
    const c = [X(15 - i * 3.6, 22 + i * 0.4), X(14 - i * 3.4, 30 + i * 0.4), X(11 - i * 2.2, 38 - i * 1.6)];
    dots(ctx, c, { sp: 2.1, r: 0.72, seed: seed + i, punch: 0.25 });
  }
  goldL(ctx, [X(16, 20), X(8, 21), X(0, 19.6)], 0.6);
  dye(ctx, smooth([X(12, 18.8), X(16, 19), X(15.6, 20.6), X(12, 20.4)], true), INK.red, 0.85);
}

function buildPhaya() {
  const k = 1.18;
  const E = [22, 98];
  const G = kingGeom(E, k);
  const X = G.X;
  const J = {
    neck: X(-12, 36), jaw: X(-10.5, 15),
    shB: [-32, 156], elB: [-46, 218], wrB: [-42, 278],
    shF: [46, 154], elF: [62, 214], wrF: [72, 270],
    waist: [6, 240],
    hipB: [-14, 262], knB: [-40, 338], anB: [-46, 418],
    hipF: [26, 262], knF: [54, 338], anF: [60, 418],
  };
  const head = {
    box: bb(3, G.face, G.helmet, G.fanBack, G.fan.flat(), G.karn, [X(26, 0)]), z: -1, parent: 'torso', joint: J.neck, lim: [-20, 20], stiff: 0.75, mass: 1,
    draw: (ctx) => kingHead(ctx, E, k, G),
  };
  const jaw = {
    box: bb(3, G.jaw), z: -1.5, parent: 'head', joint: J.jaw, lim: [-4, 18], stiff: 0.7, mass: 0.25, noRivet: true,
    draw: (ctx) => kingJaw(ctx, E, k, G),
  };
  // ---------------------------------------------------------------- torso
  const torsoPts = wob([[-8, 138], [-20, 142], [-32, 147], [-42, 156], [-44, 170], [-38, 188], [-31, 206], [-26, 224], [-24, 240], [-25, 262], [-10, 266],
    [8, 268], [24, 266], [37, 262], [36, 240], [39, 224], [45, 206], [51, 188], [56, 170], [55, 157], [46, 147], [32, 141], [20, 138], [6, 136]], 0.4, 901);
  const collar = wob([[-43, 158], [-34, 148], [-20, 141], [-4, 137], [12, 136], [28, 139], [42, 145], [54, 153], [57, 163], [45, 173], [31, 181], [17, 186], [7, 187], [-5, 185], [-19, 179], [-32, 170], [-41, 164]], 0.3, 902);
  // tall pointed back ornament over the far shoulder (like 2.jpg)
  const arch = wob([[-50, 178], [-58, 150], [-58, 118], [-50, 92], [-38, 72], [-28, 60], [-19, 72], [-10, 92], [-4, 118], [-6, 150], [-14, 176]], 0.4, 903);
  const torso = {
    box: bb(3, torsoPts, collar, arch), z: 0, mass: 1.4,
    draw(ctx) {
      leather(ctx, smooth(arch, true, 0.4));
      dye(ctx, smooth(inset(arch, 1.4), true), INK.gold, 0.9);
      dots(ctx, inset(arch, 2.6), { sp: 2.8, r: 0.85, closed: true, seed: 904, punch: 0.3 });
      dye(ctx, smooth(inset(arch, 4.4), true), INK.red, 0.9);
      dye(ctx, smooth(inset(arch, 8.5), true), INK.green, 0.9);
      dots(ctx, inset(arch, 6.4), { sp: 3, r: 0.8, closed: true, seed: 905, punch: 0.3 });
      lace(ctx, inset(arch, 10), { sp: 5, r: 0.8, style: 'quad', seed: 906, punch: 0.4 });
      const dm = [[-31, 96], [-19, 116], [-31, 138], [-43, 116]];
      leather(ctx, smooth(dm, true, 0.3));
      panel(ctx, dm, { fill: INK.gold, sp: 2.6, r: 0.7, seed: 907, d2: 2.2, edge: INK.white });
      flower(ctx, -31, 117, 7, { n: 8 });
      fringe(ctx, [[-48, 150], [-31, 157], [-10, 150]], 4, { h: 1.3 });
      leather(ctx, smooth(torsoPts, true));
      const body = inset(torsoPts, 2.6);
      lace(ctx, body, { sp: 5.4, r: 0.9, style: 'dot', seed: 908, punch: 0.35 });
      // sash of office (สังวาล) and a jewelled belt band
      for (const [a, b] of [[[-38, 162], [34, 236]], [[50, 160], [-20, 236]]]) {
        ink(ctx, [a, b], INK.leather, 5);
        stripe(ctx, [a, mix(a, b, 0.5), b], 3.8, { fill: INK.gold, edge: INK.white, ew: 0.5, seed: 909, sp: 2.4, r: 0.7 });
      }
      flower(ctx, 7, 202, 6.4, { n: 8 });
      stripe(ctx, [[-24, 234], [6, 238], [36, 234]], 7, { fill: INK.red, seed: 910, sp: 3, r: 0.95 });
      fringe(ctx, [[-22, 230.5], [6, 234.4], [34, 230.5]], 4.2, { h: 1.3 });
      // collar
      leather(ctx, smooth(collar, true));
      dye(ctx, smooth(inset(collar, 1.5), true), INK.red, 0.9);
      lace(ctx, inset(collar, 3), { sp: 4.8, r: 0.85, style: 'quad', seed: 911, punch: 0.3 });
      stripe(ctx, [[-36, 156], [-19, 147], [7, 143], [32, 146], [50, 155]], 5, { fill: INK.gold, seed: 912, sp: 2.5, r: 0.75, edge: INK.white });
      for (const x of [-24, -8, 8, 24, 40]) flower(ctx, x, 162 + (x === 8 ? 4 : 0) + Math.abs(x - 8) * 0.04, 3.8, { n: 8 });
      fringe(ctx, [[-39, 168], [-24, 178], [-6, 186], [8, 188], [24, 184], [38, 176], [53, 165]], 5.4, { flip: true, h: 1.35, col: INK.gold, inner: INK.green });
      dots(ctx, inset(collar, 2.3), { sp: 3, r: 0.8, closed: true, seed: 913, punch: 0.2 });
      rim(ctx, torsoPts, { seed: 914, gold: false, d: 2.1 });
    },
  };
  // ---------------------------------------------------------------- skirt
  const sarong = wob([[-26, 234], [6, 237], [38, 234], [44, 256], [52, 282], [60, 306], [70, 322], [56, 326], [40, 322], [24, 326], [6, 330], [-12, 326],
    [-30, 328], [-50, 336], [-68, 332], [-52, 318], [-40, 298], [-32, 270], [-29, 250]], 0.5, 951);
  const skirt = {
    box: bb(3, sarong, [[6, 372]]), z: 1, parent: 'torso', joint: J.waist, lim: [-12, 12], stiff: 0.75, mass: 1.3,
    draw(ctx) {
      leather(ctx, smooth(sarong, true, 0.4));
      dye(ctx, smooth(inset(sarong, 1.6), true), INK.red, 0.9);
      // white chevrons (ลายฟันปลา) in rows down the sarong
      ctx.save(); ctx.clip(smooth(inset(sarong, 2.5), true));
      for (let y = 262; y < 330; y += 12) {
        const row = [];
        for (let x = -70, j = 0; x < 76; x += 6, j++) row.push([x, y + (j % 2 ? 0 : 5)]);
        const P = new Path2D(); row.forEach(([x, yy], i) => (i ? P.lineTo(x, yy) : P.moveTo(x, yy)));
        ink(ctx, P, INK.white, 1.6);
        dots(ctx, offset(row, -4), { sp: 4, r: 0.8, seed: y, sm: false, punch: 0.3 });
      }
      ctx.restore();
      const hem = [[-66, 330], [-48, 330], [-30, 324], [-12, 322], [6, 326], [24, 322], [40, 318], [58, 322], [68, 320]];
      stripe(ctx, hem.map(([x, y]) => [x, y - 4]), 5, { fill: INK.gold, edge: INK.white, seed: 952, sp: 2.6, r: 0.75 });
      rim(ctx, sarong, { seed: 953, gold: false, d: 2 });
      // green triangular apron (ผ้าห้อย) over the belly, as in 2.jpg
      const apron = wob([[-22, 244], [36, 244], [30, 280], [18, 306], [8, 330], [-4, 306], [-14, 280]], 0.3, 954);
      leather(ctx, smooth(apron, true, 0.35));
      dye(ctx, smooth(inset(apron, 1.4), true), INK.gold, 0.9);
      dots(ctx, inset(apron, 2.6), { sp: 2.8, r: 0.85, closed: true, seed: 955, punch: 0.3 });
      dye(ctx, smooth(inset(apron, 4.6), true), INK.green, 0.9);
      dots(ctx, inset(apron, 6.2), { sp: 3, r: 0.8, closed: true, seed: 956, punch: 0.3 });
      lace(ctx, inset(apron, 8), { sp: 5.4, r: 0.85, style: 'quad', seed: 957, punch: 0.35 });
      flower(ctx, 8, 270, 8.5, { n: 10, fill: INK.red });
      const tip = [[8, 326], [14, 346], [8, 372], [2, 346]];
      leather(ctx, smooth(tip, true, 0.35));
      dye(ctx, smooth(inset(tip, 1), true), INK.gold, 0.9);
      gem(ctx, 8, 346, 3);
      stripe(ctx, [[-26, 239], [6, 242], [38, 239]], 8, { fill: INK.gold, seed: 958, sp: 3, r: 1, edge: INK.white });
      for (const x of [-14, 26]) gem(ctx, x, 240.4, 2.5, { col: INK.green });
      const buckle = [[7, 231], [17, 241], [7, 251], [-3, 241]];
      leather(ctx, smooth(buckle, true, 0.3));
      dye(ctx, smooth(buckle, true, 0.3), INK.gold, 0.95);
      flower(ctx, 7, 241, 6, { n: 8 });
    },
  };
  // ---------------------------------------------------------------- limbs
  const dB = unit(J.wrB[0] - J.elB[0], J.wrB[1] - J.elB[1]);
  const dF = unit(J.wrF[0] - J.elF[0], J.wrF[1] - J.elF[1]);
  const hf = handFrame(J.wrF, dF, 1), hb = handFrame(J.wrB, dB, 1);
  const legShin = (K, A, fwd, seed) => (ctx) => shin(ctx, K, A, fwd, { seed, guard: null });
  const plainThigh = (H, K, seed) => (ctx) => {
    const pts = wob(paddle(H, K, 14, 10.5, { bulge: 0.08, ext: 2, extA: 3 }), 0.35, seed);
    leather(ctx, smooth(pts, true));
    dye(ctx, smooth(inset(pts, 2), true), INK.red, 0.88);
    const f = frame(H, K);
    ctx.save(); ctx.clip(smooth(inset(pts, 2.5), true));
    for (let t = 0.1; t < 1; t += 0.16) {
      const row = [f.at(t, -16), f.at(t + 0.05, -8), f.at(t, 0), f.at(t + 0.05, 8), f.at(t, 16)];
      ink(ctx, row, INK.white, 1.4, { sm: false });
    }
    ctx.restore();
    rim(ctx, pts, { seed });
    stripe(ctx, [f.at(0.88, -12), f.at(0.9, 0), f.at(0.88, 12)], 5, { fill: INK.gold, edge: INK.white, seed: seed + 1, sp: 2.6, r: 0.7 });
    fringe(ctx, [f.at(0.94, -10.5), f.at(0.96, 0), f.at(0.94, 10.5)], 3.4, { flip: true, h: 1.2 });
  };
  const defs = {
    torso, head, jaw, skirt,
    upperArmB: { box: bb(4, paddle(J.shB, J.elB, 11, 8.5, { ext: 3, extA: 2 }), [add(J.shB, [-26, -26])]), z: -8, parent: 'torso', joint: J.shB, stiff: 0.12, draw: (ctx) => upperArm(ctx, J.shB, J.elB, { seed: 1001, side: -1, flame: 0 }) },
    forearmB: { box: bb(4, paddle(J.elB, J.wrB, 8.5, 6.8, { ext: 5, extA: 1 })), z: -7, parent: 'upperArmB', joint: J.elB, lim: [-150, 12], stiff: 0.18, draw: (ctx) => forearm(ctx, J.elB, J.wrB, { seed: 1002 }) },
    handB: { box: bb(3, [hb(-10, -8), hb(-10, 9), hb(38, -18), hb(34, 14), hb(18, 22)]), z: -9, parent: 'forearmB', joint: J.wrB, lim: [-55, 55], stiff: 0.3, mass: 0.6, draw: (ctx) => openHand(ctx, J.wrB, dB, { side: 1, seed: 1003, curl: 0.45 }) },
    thighB: { box: bb(4, paddle(J.hipB, J.knB, 14, 10.5, { ext: 2, extA: 3 })), z: -6, parent: 'skirt', joint: J.hipB, lim: [-70, 70], stiff: 0.5, draw: plainThigh(J.hipB, J.knB, 1004) },
    shinB: { box: bb(4, paddle(J.knB, J.anB, 10, 6.6, { ext: 4, extA: 2 }), footPts(J.anB, -1)), z: -7, parent: 'thighB', joint: J.knB, lim: [-8, 120], stiff: 0.5, draw: legShin(J.knB, J.anB, -1, 1005) },
    thighF: { box: bb(4, paddle(J.hipF, J.knF, 14, 10.5, { ext: 2, extA: 3 })), z: -4, parent: 'skirt', joint: J.hipF, lim: [-70, 70], stiff: 0.5, draw: plainThigh(J.hipF, J.knF, 1006) },
    shinF: { box: bb(4, paddle(J.knF, J.anF, 10, 6.6, { ext: 4, extA: 2 }), footPts(J.anF, 1)), z: -5, parent: 'thighF', joint: J.knF, lim: [-8, 120], stiff: 0.5, draw: legShin(J.knF, J.anF, 1, 1007) },
    upperArmF: { box: bb(4, paddle(J.shF, J.elF, 11, 8.5, { ext: 3, extA: 2 }), [add(J.shF, [26, -26])]), z: 4, parent: 'torso', joint: J.shF, stiff: 0.12, draw: (ctx) => upperArm(ctx, J.shF, J.elF, { seed: 1008, side: 1, flame: 0 }) },
    forearmF: { box: bb(4, paddle(J.elF, J.wrF, 8.5, 6.8, { ext: 5, extA: 1 })), z: 6, parent: 'upperArmF', joint: J.elF, lim: [-150, 12], stiff: 0.18, draw: (ctx) => forearm(ctx, J.elF, J.wrF, { seed: 1009 }) },
    handF: { box: bb(3, [hf(-10, -8), hf(-10, 9), hf(28, -13), hf(28, 12)]), z: 5, parent: 'forearmF', joint: J.wrF, lim: [-55, 55], stiff: 0.3, mass: 0.6, draw: (ctx) => fist(ctx, J.wrF, dF, { side: 1, seed: 1010 }) },
  };
  return buildRig(
    { id: 'phaya', name: 'พญา', en: 'Phaya — the King', kind: 'hero', voice: 'old', height: 432 },
    defs,
    {
      rod: [[6, 144], [6, 240], 320],
      handRods: { handF: hf(9, 0), handB: hb(10, 0) },
      grips: { handF: hf(15, 0.5), handB: hb(12, 0) },
      holds: { handF: 'staff' },
      limbs: STD_LIMBS({ jaw: 'jaw' }),
      lines: LINES.phaya,
    },
  );
}

// ================================================================ เทวดา deva
// Celestial being: golden refined face under a flame-tipped ชฎา with a
// flaming halo (ประภามณฑล), flame wings rising behind the shoulders, long
// flame-hemmed skirt and floating ribbons (ผ้าทิพย์) as loose parts.
function ribbonSeg(ctx, a, b, w0, w1, { seed = 1, col = INK.red, tip = 0 } = {}) {
  const pts = wob(paddle(a, b, w0, w1, { bulge: 0.12, ext: 1, extA: 1 }), 0.3, seed);
  leather(ctx, smooth(pts, true));
  dye(ctx, smooth(inset(pts, 1.2), true), INK.gold, 0.9);
  dye(ctx, smooth(inset(pts, 3), true), col, 0.9);
  dots(ctx, inset(pts, 2.1), { sp: 2.8, r: 0.75, closed: true, seed, punch: 0.35 });
  const f = frame(a, b);
  for (let t = 0.25; t < 1; t += 0.3) flower(ctx, ...f.at(t, 0), Math.min(w0, w1) * 0.55, { n: 6 });
  if (tip) {
    const fl = hornPts(b, 26, Math.atan2(b[1] - a[1], b[0] - a[0]), tip * 110 * DEG, w1 * 2.2, { swell: 3 });
    leather(ctx, smooth(fl, true, 0.4));
    flameDeco(ctx, fl, { seed: seed + 5, cols: [INK.gold, col], d: [1, 3] });
    return [...pts, ...fl];
  }
  return pts;
}

function buildThewada() {
  const k = 1.12;
  const E = [20, 118];
  const G = chadaHeadGeom(E, k, { tiers: 7, spireTop: [-15, -82], tip: [-19, -104], hw: 12.5, karnSize: 42 });
  const X = G.X;
  const J = {
    neck: [12, 158],
    shB: [-30, 170], elB: [-44, 230], wrB: [-42, 290],
    shF: [46, 170], elF: [62, 228], wrF: [70, 286],
    waist: [6, 254],
    hipB: [-12, 270], knB: [-36, 344], anB: [-42, 426],
    hipF: [24, 270], knF: [50, 344], anF: [56, 426],
  };
  const skin = INK.gold;
  // flame halo: disc with kanok tongues round its rim
  const hc = X(-6, -8);
  const halo = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU, r = (i % 2 ? 44 : 50) * k;
    halo.push([hc[0] + Math.cos(a) * r, hc[1] + Math.sin(a) * r * 0.98]);
  }
  const head = {
    box: bb(3, G.crown.outline, G.helmet, G.karn, halo, [X(24, 0), X(0, 48)]), z: -1, parent: 'torso', joint: J.neck, lim: [-22, 22], stiff: 0.7, mass: 0.9,
    draw(ctx) {
      leather(ctx, smooth(halo, true, 0.35));
      dye(ctx, smooth(inset(halo, 1.4), true), INK.gold, 0.9);
      dye(ctx, smooth(ellipsePts(hc[0], hc[1], 40 * k, 39 * k, 40), true), INK.red, 0.85);
      dye(ctx, smooth(ellipsePts(hc[0], hc[1], 33 * k, 32 * k, 40), true), INK.leather, 0.8);
      for (const [r, sd] of [[46, 1], [37, 2], [30, 3]]) dots(ctx, ellipsePts(hc[0], hc[1], r * k, r * k * 0.98, 60), { sp: 3, r: 0.85, closed: true, seed: 1100 + sd, punch: 0.4 });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        const p = [hc[0] + Math.cos(a) * 24 * k, hc[1] + Math.sin(a) * 24 * k];
        spots(ctx, [p], 1.3, { punch: true });
      }
      chadaHead(ctx, E, k, G, { skin, tierCols: [INK.green, INK.red], neck: 47, seed: 1130, lip: INK.crimson });
    },
  };
  // ---------------------------------------------------------------- torso
  const torsoPts = wob([[-6, 150], [-18, 154], [-30, 159], [-40, 168], [-42, 180], [-37, 194], [-31, 210], [-26, 228], [-24, 244], [-26, 266], [-10, 272],
    [8, 274], [24, 272], [36, 266], [35, 244], [38, 228], [44, 210], [51, 194], [57, 180], [58, 169], [48, 159], [34, 153], [22, 150], [8, 148]], 0.4, 1201);
  const collar = wob([[-43, 169], [-34, 159], [-21, 152], [-6, 147], [10, 146], [26, 149], [41, 155], [55, 163], [59, 173], [47, 184], [33, 194], [19, 200], [8, 202], [-4, 200], [-18, 194], [-31, 184], [-41, 176]], 0.3, 1202);
  const wingB = [hornPts([-24, 176], 92, -150 * DEG, 60 * DEG, 26, { swell: 10, taper: 0.9 }), hornPts([-26, 186], 70, -170 * DEG, 50 * DEG, 18, { swell: 6 }), hornPts([-22, 196], 50, 170 * DEG, 40 * DEG, 13, { swell: 4 })];
  const wingF = [hornPts([38, 176], 88, -30 * DEG, -60 * DEG, 24, { swell: 9, taper: 0.9 }), hornPts([40, 186], 64, -10 * DEG, -50 * DEG, 16, { swell: 5 })];
  const torso = {
    box: bb(3, torsoPts, collar, ...wingB, ...wingF), z: 0, mass: 1.3,
    draw(ctx) {
      [...wingB, ...wingF].forEach((w, i) => { leather(ctx, smooth(w, true, 0.4)); flameDeco(ctx, w, { seed: 1210 + i, cols: [INK.gold, i % 2 ? INK.green : INK.red, i % 2 ? INK.red : INK.green], d: [1.4, 4.2, 7.8] }); });
      leather(ctx, smooth(torsoPts, true));
      const body = inset(torsoPts, 2.6);
      dye(ctx, smooth(body, true), INK.gold, 0.55);
      brocade(ctx, body, { sp: 9, seed: 3, dotR: 1.05 });
      const plk = [[1, 200], [13, 200], [12, 246], [7, 252], [2, 246]];
      panel(ctx, plk, { fill: INK.red, sp: 3, r: 0.85, seed: 1220, d2: 2.6 });
      for (const [a, b] of [[[-34, 172], [30, 246]], [[48, 172], [-18, 246]]]) {
        ink(ctx, [a, b], INK.leather, 4);
        stripe(ctx, [a, mix(a, b, 0.5), b], 3.2, { fill: INK.gold, edge: INK.white, ew: 0.5, seed: 1221, sp: 2.4, r: 0.7 });
      }
      flower(ctx, 7, 220, 7, { n: 10 });
      stripe(ctx, [[-24, 244], [7, 248], [36, 244]], 7, { fill: INK.green, seed: 1222, sp: 3, r: 0.95, edge: INK.white });
      fringe(ctx, [[-22, 240.5], [7, 244.4], [34, 240.5]], 4.2, { h: 1.3 });
      leather(ctx, smooth(collar, true));
      dye(ctx, smooth(inset(collar, 1.5), true), INK.green, 0.9);
      lace(ctx, inset(collar, 3), { sp: 4.8, r: 0.85, style: 'quad', seed: 1223, punch: 0.3 });
      stripe(ctx, [[-36, 167], [-20, 157], [7, 152], [32, 155], [52, 165]], 5, { fill: INK.gold, seed: 1224, sp: 2.5, r: 0.75, edge: INK.white });
      for (const x of [-24, -8, 8, 24, 40]) flower(ctx, x, 174 + (x === 8 ? 4 : 0) + Math.abs(x - 8) * 0.04, 3.8, { n: 8 });
      fringe(ctx, [[-39, 180], [-24, 190], [-6, 199], [8, 202], [24, 198], [38, 190], [54, 177]], 5.4, { flip: true, h: 1.35, col: INK.gold, inner: INK.red });
      dots(ctx, inset(collar, 2.3), { sp: 3, r: 0.8, closed: true, seed: 1225, punch: 0.2 });
      rim(ctx, torsoPts, { seed: 1226, gold: false, d: 2.1 });
    },
  };
  // ---------------------------------------------------------------- skirt (knee-length, flame hem)
  const hemPts = [];
  const skirtTop = [[-27, 248], [6, 251], [38, 248]];
  const hemL = [-50, 348], hemR = [66, 348];
  for (let i = 0; i <= 9; i++) {
    const t = i / 9, x = lerp(hemR[0], hemL[0], t), y = 344 + Math.sin(t * Math.PI) * 10;
    hemPts.push([x, y]);
    if (i < 9) hemPts.push([x - 6.4, y + 11 + (i % 2) * 3]);
  }
  const skirtPts = wob([...skirtTop, [44, 270], [52, 300], [60, 326], ...hemPts, [-44, 326], [-38, 300], [-31, 270]], 0.4, 1251);
  const skirt = {
    box: bb(3, skirtPts), z: 1, parent: 'torso', joint: J.waist, lim: [-12, 12], stiff: 0.75, mass: 1.2,
    draw(ctx) {
      leather(ctx, smooth(skirtPts, true, 0.5));
      const body = inset(skirtPts, 2.4);
      dye(ctx, smooth(body, true), INK.red, 0.86);
      lace(ctx, body, { sp: 6.4, r: 0.95, style: 'quad', seed: 1252, punch: 0.3 });
      // pleats (จีบ) falling from the belt
      for (const x of [-18, -4, 20, 34]) {
        const pl = [[x, 256], [x + (x - 8) * 0.25, 300], [x + (x - 8) * 0.45, 342]];
        stripe(ctx, pl, 5, { fill: INK.green, edge: INK.goldLine, seed: 1253 + x, sp: 2.8, r: 0.75 });
      }
      stripe(ctx, hemPts.filter((_, i) => i % 2 === 0).map(([x, y]) => [x, y - 5]), 6, { fill: INK.gold, edge: INK.white, seed: 1260, sp: 2.8, r: 0.8 });
      const apron = [[-2, 254], [17, 254], [18, 290], [16, 330], [8, 360], [0, 330], [-2, 290]];
      leather(ctx, smooth(apron, true));
      panel(ctx, apron, { fill: INK.gold, sp: 3, r: 0.8, seed: 1261, d2: 2.2, edge: INK.white });
      dye(ctx, smooth(inset(apron, 4.2), true), INK.green, 0.88);
      for (let y = 266; y < 350; y += 14) flower(ctx, 8, y, 4.6 - (y - 266) * 0.015, { n: 8 });
      stripe(ctx, [[-27, 253], [7, 256], [38, 253]], 8, { fill: INK.gold, seed: 1262, sp: 3, r: 1, edge: INK.white });
      const buckle = [[8, 245], [18, 255], [8, 265], [-2, 255]];
      leather(ctx, smooth(buckle, true, 0.3));
      dye(ctx, smooth(buckle, true, 0.3), INK.gold, 0.95);
      flower(ctx, 8, 255, 6, { n: 8 });
      rim(ctx, skirtPts, { seed: 1263, gold: false, d: 2 });
    },
  };
  // ---------------------------------------------------------------- ribbons (ผ้าทิพย์), loose low-stiffness parts
  const rb = [[-28, 186], [-62, 236], [-84, 300]];
  const rf = [[36, 262], [78, 292], [96, 350]];
  const ribbons = {
    ribbonB0: { box: bb(4, paddle(rb[0], rb[1], 7, 6, { ext: 1, extA: 1 })), z: -11, parent: 'torso', joint: rb[0], lim: [-50, 50], stiff: 0.08, mass: 0.2, draw: (ctx) => ribbonSeg(ctx, rb[0], rb[1], 6, 5, { seed: 1301, col: INK.red }) },
    ribbonB1: { box: bb(4, paddle(rb[1], rb[2], 6, 5, { ext: 1, extA: 1 }), [add(rb[2], [-30, -10]), add(rb[2], [20, 30])]), z: -10.9, parent: 'ribbonB0', joint: rb[1], lim: [-60, 60], stiff: 0.06, mass: 0.15, draw: (ctx) => ribbonSeg(ctx, rb[1], rb[2], 5, 4.2, { seed: 1302, col: INK.red, tip: 1 }) },
    ribbonF0: { box: bb(4, paddle(rf[0], rf[1], 7, 6, { ext: 1, extA: 1 })), z: 1.5, parent: 'skirt', joint: rf[0], lim: [-50, 50], stiff: 0.08, mass: 0.2, draw: (ctx) => ribbonSeg(ctx, rf[0], rf[1], 6, 5, { seed: 1303, col: INK.green }) },
    ribbonF1: { box: bb(4, paddle(rf[1], rf[2], 6, 5, { ext: 1, extA: 1 }), [add(rf[2], [30, -10]), add(rf[2], [-20, 30])]), z: 1.6, parent: 'ribbonF0', joint: rf[1], lim: [-60, 60], stiff: 0.06, mass: 0.15, draw: (ctx) => ribbonSeg(ctx, rf[1], rf[2], 5, 4.2, { seed: 1304, col: INK.green, tip: -1 }) },
  };
  // ---------------------------------------------------------------- limbs
  const dB = unit(J.wrB[0] - J.elB[0], J.wrB[1] - J.elB[1]);
  const dF = unit(J.wrF[0] - J.elF[0], J.wrF[1] - J.elF[1]);
  const hf = handFrame(J.wrF, dF, 1), hb = handFrame(J.wrB, dB, 1);
  const defs = {
    torso, head, skirt, ...ribbons,
    upperArmB: { box: bb(4, paddle(J.shB, J.elB, 10.5, 8, { ext: 3, extA: 2 }), [add(J.shB, [-26, -26])]), z: -8, parent: 'torso', joint: J.shB, stiff: 0.12, draw: (ctx) => upperArm(ctx, J.shB, J.elB, { ra: 10.5, rb: 8, seed: 1401, side: -1, band: INK.green }) },
    forearmB: { box: bb(4, paddle(J.elB, J.wrB, 8, 6.4, { ext: 5, extA: 1 })), z: -7, parent: 'upperArmB', joint: J.elB, lim: [-150, 12], stiff: 0.18, draw: (ctx) => forearm(ctx, J.elB, J.wrB, { ra: 8, rb: 6.4, seed: 1402, cuffCol: INK.green }) },
    handB: { box: bb(3, [hb(-10, -8), hb(-10, 9), hb(38, -18), hb(34, 14), hb(18, 22)]), z: -9, parent: 'forearmB', joint: J.wrB, lim: [-60, 60], stiff: 0.3, mass: 0.6, draw: (ctx) => openHand(ctx, J.wrB, dB, { side: 1, seed: 1403, curl: 0.9, skin }) },
    thighB: { box: bb(4, paddle(J.hipB, J.knB, 14, 10.5, { ext: 2, extA: 3 })), z: -6, parent: 'skirt', joint: J.hipB, lim: [-70, 70], stiff: 0.45, draw: (ctx) => thigh(ctx, J.hipB, J.knB, { ra: 14, rb: 10.5, seed: 1404, hem: false }) },
    shinB: { box: bb(4, paddle(J.knB, J.anB, 9.5, 6.4, { ext: 4, extA: 2 }), footPts(J.anB, -1)), z: -7, parent: 'thighB', joint: J.knB, lim: [-8, 125], stiff: 0.5, draw: (ctx) => shin(ctx, J.knB, J.anB, -1, { ra: 9.5, rb: 6.4, seed: 1405, guard: INK.green, skin }) },
    thighF: { box: bb(4, paddle(J.hipF, J.knF, 14, 10.5, { ext: 2, extA: 3 })), z: -4, parent: 'skirt', joint: J.hipF, lim: [-70, 70], stiff: 0.45, draw: (ctx) => thigh(ctx, J.hipF, J.knF, { ra: 14, rb: 10.5, seed: 1406, hem: false }) },
    shinF: { box: bb(4, paddle(J.knF, J.anF, 9.5, 6.4, { ext: 4, extA: 2 }), footPts(J.anF, 1)), z: -5, parent: 'thighF', joint: J.knF, lim: [-8, 125], stiff: 0.5, draw: (ctx) => shin(ctx, J.knF, J.anF, 1, { ra: 9.5, rb: 6.4, seed: 1407, guard: INK.green, skin }) },
    upperArmF: { box: bb(4, paddle(J.shF, J.elF, 10.5, 8, { ext: 3, extA: 2 }), [add(J.shF, [26, -26])]), z: 4, parent: 'torso', joint: J.shF, stiff: 0.12, draw: (ctx) => upperArm(ctx, J.shF, J.elF, { ra: 10.5, rb: 8, seed: 1408, side: 1, band: INK.green }) },
    forearmF: { box: bb(4, paddle(J.elF, J.wrF, 8, 6.4, { ext: 5, extA: 1 })), z: 6, parent: 'upperArmF', joint: J.elF, lim: [-150, 12], stiff: 0.18, draw: (ctx) => forearm(ctx, J.elF, J.wrF, { ra: 8, rb: 6.4, seed: 1409, cuffCol: INK.green }) },
    handF: { box: bb(3, [hf(-10, -18), hf(-10, 9), hf(38, -18), hf(34, 14), hf(18, 22)]), z: 5, parent: 'forearmF', joint: J.wrF, lim: [-60, 60], stiff: 0.3, mass: 0.6, draw: (ctx) => openHand(ctx, J.wrF, dF, { side: -1, seed: 1410, curl: 0.9, skin }) },
  };
  const hff = handFrame(J.wrF, dF, -1);
  return buildRig(
    { id: 'thewada', name: 'เทวดา', en: 'Thewada — the Deva', kind: 'god', voice: 'god', height: 440 },
    defs,
    {
      rod: [[8, 156], [7, 254], 320],
      handRods: { handF: hff(10, 0), handB: hb(10, 0) },
      grips: { handF: hff(12, 0), handB: hb(12, 0) },
      holds: {},
      limbs: STD_LIMBS({ ribbons: ['ribbonB0', 'ribbonB1', 'ribbonF0', 'ribbonF1'] }),
      lines: LINES.thewada,
    },
  );
}

// ================================================================ dialogue
const LINES = {
  phra: {
    greet: [
      { th: 'สวัสดีเถิดท่านผู้เจริญ ข้าคือโอรสแห่งนครนี้', en: 'Greetings, honoured one. I am a son of this kingdom.' },
      { th: 'ยินดีที่ได้พบพาน ขอความสุขจงมีแด่ท่าน', en: 'Well met — may happiness be yours.' },
      { th: 'ข้าน้อมคำนับ ท่านมาจากแดนไกลหรือไร', en: 'I bow to you. Have you come from a distant land?' },
      { th: 'เชิญเถิด เมืองเรายินดีต้อนรับผู้มาดี', en: 'Please come — our city welcomes those who come in peace.' },
    ],
    fight: [
      { th: 'จงระวังเถิด ดาบนี้ปกป้องธรรม', en: 'Beware — this sword defends what is right.' },
      { th: 'เข้ามาเถิด ข้าไม่หวั่นเกรง', en: 'Come, then. I do not fear you.' },
      { th: 'เพื่อบ้านเมือง ข้าจะสู้จนสุดกำลัง', en: 'For the realm, I will fight with all my strength.' },
      { th: 'ยักษ์ร้ายจงถอยไป!', en: 'Wicked demon, fall back!' },
    ],
    taunt: [
      { th: 'ฝีมือเพียงนี้หรือ จะมาต่อกรกับข้า', en: 'Is that all your skill, to stand against me?' },
      { th: 'ช้าเสียจริง ลมยังเร็วกว่าท่าน', en: 'So slow! Even the wind is quicker than you.' },
      { th: 'กลับไปฝึกมาใหม่เถิดสหาย', en: 'Go back and train some more, friend.' },
    ],
    dance: [
      { th: 'รำเถิดรำ ให้สมศักดิ์ศรีชาวใต้', en: 'Let us dance, worthy of the southern folk.' },
      { th: 'เสียงทับเสียงโหม่งช่างไพเราะ', en: 'How sweetly the drums and gongs sound!' },
      { th: 'ย่างก้าวอย่างพระเอก งามสง่านัก', en: "A hero's step — graceful and proud." },
    ],
    flee: [
      { th: 'ถอยก่อน ถอยก่อน! แล้วข้าจะกลับมา', en: 'Fall back, fall back! I shall return.' },
      { th: 'ศึกนี้หนักนัก ขอพักสักครู่', en: 'This battle is hard — I must rest a moment.' },
      { th: 'ปัญญาดีกว่ากำลัง ข้าขอหลีกไปก่อน', en: 'Wisdom beats strength — I withdraw for now.' },
    ],
    idle: [
      { th: 'ฟ้าวันนี้ช่างแจ่มใส', en: 'How clear the sky is today.' },
      { th: 'คิดถึงนางผู้เป็นที่รักยิ่งนัก', en: 'How I long for my beloved.' },
      { th: 'บ้านเมืองสงบสุข ข้าก็สุขใจ', en: 'When the realm is at peace, my heart is glad.' },
    ],
  },
};

LINES.yak = {
  greet: [
    { th: 'ฮ่า ฮ่า ฮ่า! ผู้ใดบังอาจย่างกรายมาถึงถิ่นข้า', en: 'Ha ha ha! Who dares set foot in my domain?' },
    { th: 'ข้าคือพญายักษ์ผู้เกรียงไกร', en: 'I am the mighty lord of demons.' },
    { th: 'มนุษย์ตัวน้อย มาหาข้าด้วยเหตุใด', en: 'Little human, why have you come to me?' },
    { th: 'เอาละ วันนี้ข้าอารมณ์ดี จะไม่ทำอะไรเจ้า', en: 'Well now, I am in a good mood today. I shall spare you.' },
  ],
  fight: [
    { th: 'กระบองข้าหนักนัก รับไปเถิด!', en: 'My mace is heavy — take this!' },
    { th: 'โฮก! ข้าจะจับเจ้าโยนข้ามภูเขา', en: "Roar! I'll toss you over the mountains!" },
    { th: 'สู้กับข้าเถิด ถ้าแน่จริง', en: 'Fight me, if you truly dare.' },
    { th: 'ธรณีจงสะเทือน!', en: 'Let the earth tremble!' },
  ],
  taunt: [
    { th: 'เจ้าตัวเล็กเท่ามดแดง', en: 'You are no bigger than a red ant.' },
    { th: 'ฮ่า! ดาบของเจ้าเหมือนไม้จิ้มฟัน', en: 'Ha! Your sword is like a toothpick.' },
    { th: 'มาเถิด มาให้ข้าหัวเราะเล่น', en: 'Come, give me a good laugh.' },
  ],
  dance: [
    { th: 'ยักษ์ก็รำเป็นนะเจ้า', en: 'Even demons can dance, you know.' },
    { th: 'ย่ำเท้าให้ธรณีสะเทือน!', en: 'Stamp until the earth shakes!' },
    { th: 'โฮ่ โฮ่ รำอย่างยักษ์ ใหญ่โตมโหฬาร', en: "Ho ho, a demon's dance — grand and enormous!" },
  ],
  flee: [
    { th: 'ไม่นะ! ข้าจะกลับไปเรียกพวกพ้อง', en: "No! I'll go and fetch my kin." },
    { th: 'วันนี้ข้ายอมก่อน แต่ข้าจะกลับมา', en: 'I yield today, but I will return.' },
    { th: 'โอ๊ย เจ็บนัก หนีก่อนดีกว่า', en: 'Ouch, that stings! Better run.' },
  ],
  idle: [
    { th: 'หิวจัง อยากกินขนมสักร้อยถาด', en: 'So hungry — I could eat a hundred trays of sweets.' },
    { th: 'ครอก... ยักษ์ก็ต้องงีบบ้าง', en: 'Snore... even demons need a nap.' },
    { th: 'ทองในวังของข้ามากมายนัก', en: 'Oh, the gold in my palace is plentiful.' },
  ],
};

LINES.hanuman = {
  greet: [
    { th: 'ข้าคือหนุมาน ทหารเอกแห่งพระราม', en: 'I am Hanuman, chief warrior of Lord Rama.' },
    { th: 'สวัสดีขอรับ! วานรขาวมาแล้ว', en: 'Greetings! The white monkey has arrived.' },
    { th: 'ลมพัดมาทางใด ข้าก็มาทางนั้น', en: 'Wherever the wind blows, there I come.' },
    { th: 'ยินดีที่ได้พบ ขอให้มีโชคดีเถิด', en: 'Glad to meet you — may fortune be with you.' },
  ],
  fight: [
    { th: 'ตรีเพชรของข้าไม่เคยพลาดเป้า', en: 'My trident never misses its mark.' },
    { th: 'เจ๊ะ! หลบให้ทันนะ', en: 'Hup! Dodge if you can!' },
    { th: 'ข้าเป็นบุตรพระพาย ไม่มีวันยอมแพ้', en: 'I am the son of the Wind — I never give up.' },
    { th: 'รับฝ่ามือวานรไปเสีย!', en: 'Here comes the monkey paw!' },
  ],
  taunt: [
    { th: 'จับข้าให้ได้สิ ช้าเหมือนเต่า', en: 'Catch me if you can — slow as a turtle!' },
    { th: 'แฮ่! หางข้ายาวกว่าความอดทนของเจ้า', en: 'Heh! My tail is longer than your patience.' },
    { th: 'หาวทีเป็นดาวเป็นเดือน ข้าจะกลัวใคร', en: 'I yawn out stars and moons — whom should I fear?' },
  ],
  dance: [
    { th: 'ตีลังกาสักทีเถิด!', en: "Let's do a somersault!" },
    { th: 'รำลิงให้ดู สนุกนักหนา', en: 'Watch my monkey dance — what fun!' },
    { th: 'โหน โหน โยน โยน หางแกว่งไปมา', en: 'Swing, swing, the tail sways to and fro.' },
  ],
  flee: [
    { th: 'ขึ้นต้นไม้ก่อนดีกว่า!', en: 'Up a tree, quickly!' },
    { th: 'เหาะหนีไปก่อนละขอรับ', en: "I'll fly off for now!" },
    { th: 'ไม่ได้หนีนะ แค่ถอยไปตั้งหลัก', en: "Not fleeing — just regrouping!" },
  ],
  idle: [
    { th: 'กล้วยสักหวีคงดีไม่น้อย', en: 'A bunch of bananas would be rather nice.' },
    { th: 'คิดถึงพระรามจังเลย', en: 'How I miss Lord Rama.' },
    { th: 'เกาหัวแกรก แกรก', en: 'Scratch, scratch.' },
  ],
};

LINES.phaya = {
  greet: [
    { th: 'เราคือเจ้าเมืองแห่งนี้ ยินดีต้อนรับ', en: 'We are the lord of this city. You are welcome.' },
    { th: 'ท่านผู้มาเยือน ขอจงมีความสุขในเมืองเรา', en: 'Visitor, may you find happiness in our city.' },
    { th: 'ราษฎรของเราอยู่ดีกินดีหรือไม่', en: 'Tell us — are our people well and well fed?' },
    { th: 'มาเถิด นั่งพักใต้ร่มไม้ก่อน', en: 'Come, rest a while in the shade.' },
  ],
  fight: [
    { th: 'ทหารทั้งหลาย จงปกป้องเมือง!', en: 'Soldiers, defend the city!' },
    { th: 'แม้เราชราแล้ว แต่ใจยังกล้าหาญ', en: 'Though we are old, our heart is still brave.' },
    { th: 'ไม้เท้านี้ยังมีแรงอยู่นะ', en: 'This cane still has some strength in it!' },
  ],
  taunt: [
    { th: 'เจ้าช่างไม่รู้จักที่ต่ำที่สูง', en: 'You know nothing of your place.' },
    { th: 'อวดดีนัก ระวังจะถูกขังคุก', en: 'Such arrogance — mind you are not locked away.' },
    { th: 'หนุ่มเอ๋ย ใจร้อนนักมักเสียการ', en: 'Young one, a hot temper spoils everything.' },
  ],
  dance: [
    { th: 'งานวัดปีนี้ครึกครื้นนัก', en: 'The temple fair is so lively this year.' },
    { th: 'เราขอร่ายรำให้ราษฎรชม', en: 'We shall dance for the people to see.' },
    { th: 'ช้า ๆ ได้พร้าเล่มงาม', en: 'Slowly, slowly — that is how a fine blade is made.' },
  ],
  flee: [
    { th: 'ปิดประตูเมือง! เร็วเข้า!', en: 'Close the city gates! Hurry!' },
    { th: 'เราขอกลับเข้าวังก่อน', en: 'We shall retire to the palace.' },
    { th: 'โอย หลังเราไม่ดี ขอถอยก่อน', en: 'Oh, our poor back — we must withdraw.' },
  ],
  idle: [
    { th: 'อากาศวันนี้ร้อนนัก ใครก็ได้พัดให้ที', en: 'It is so hot today — will someone fan us?' },
    { th: 'ข้าวในนาปีนี้งามนัก', en: 'The rice in the fields is fine this year.' },
    { th: 'เฮ้อ ภาระเจ้าเมืองนี้หนักหนา', en: 'Sigh — the duties of a ruler are heavy.' },
  ],
};

LINES.thewada = {
  greet: [
    { th: 'สุขีภวันตุ ขอให้ท่านเป็นสุขเถิด', en: 'Sukhi bhavantu — may you be happy.' },
    { th: 'เราลงมาจากสรวงสวรรค์', en: 'We have descended from the heavens.' },
    { th: 'ผู้ใจบุญเอ๋ย ปรารถนาพรใดจงกล่าวมา', en: 'Kind soul, speak whatever blessing you wish.' },
  ],
  fight: [
    { th: 'จงหยุดเถิด อธรรมย่อมแพ้แก่ธรรม', en: 'Cease! Wrong always yields to right.' },
    { th: 'แสงสวรรค์จงส่องนำทาง', en: "Let heaven's light show the way!" },
    { th: 'เราจะปกปักรักษาผู้ทำความดี', en: 'We protect those who do good.' },
  ],
  taunt: [
    { th: 'ความโกรธทำให้ใจมืดมัว', en: 'Anger clouds the heart.' },
    { th: 'สงบใจเสียเถิด แล้วจะเห็นทาง', en: 'Calm your heart, and you will see the way.' },
    { th: 'แม้มีฤทธิ์มากเพียงใด ก็หนีกรรมไม่พ้น', en: 'However mighty, none escape their own deeds.' },
  ],
  dance: [
    { th: 'ร่ายรำดั่งนางฟ้าบนหมู่เมฆ', en: 'We dance like celestials upon the clouds.' },
    { th: 'ดอกไม้สวรรค์จงโปรยปราย', en: 'Let heavenly flowers rain down.' },
    { th: 'ระบำเทวาให้โลกชื่นบาน', en: 'A dance of the gods to gladden the world.' },
  ],
  flee: [
    { th: 'ถึงเวลาที่เราต้องกลับสู่สวรรค์', en: 'It is time we returned to heaven.' },
    { th: 'ขอลาก่อน หมู่เมฆรอเราอยู่', en: 'Farewell — the clouds await us.' },
    { th: 'เราจะจางหายไปดั่งสายลม', en: 'We fade away like the breeze.' },
  ],
  idle: [
    { th: 'โลกมนุษย์ช่างงดงามนัก', en: 'How beautiful the human world is.' },
    { th: 'ได้ยินเสียงสวดมนต์แว่วมา', en: 'We hear chanting drifting on the wind.' },
    { th: 'ดวงดาวคือตะเกียงของเหล่าเทวดา', en: 'The stars are the lamps of the gods.' },
  ],
};

export const PUPPETS = [
  { id: 'phra', name: 'พระเอก', en: 'Phra — the Prince', kind: 'hero', build: buildPhra },
  { id: 'yak', name: 'ยักษ์', en: 'Yak — the Demon', kind: 'demon', build: buildYak },
  { id: 'hanuman', name: 'หนุมาน', en: 'Hanuman — the White Monkey', kind: 'monkey', build: buildHanuman },
  { id: 'phaya', name: 'พญา', en: 'Phaya — the King', kind: 'hero', build: buildPhaya },
  { id: 'thewada', name: 'เทวดา', en: 'Thewada — the Deva', kind: 'god', build: buildThewada },
];
