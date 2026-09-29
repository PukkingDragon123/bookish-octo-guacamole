// สัตว์ — articulated animals cut as หนังตะลุง leather.
//
// Every animal is authored in one "figure" coordinate frame (world units,
// facing right, ground at the bottom) and then cut into separate leather
// pieces. A piece's sprite box starts at (x0, y0) of that frame, so a joint
// given in figure coords converts to `at` / `pivot` box coords by simple
// subtraction. Near-side limbs are z > 0, far-side limbs z < 0.
//
// The small toolkit below (piece / tube / trim / spiral / lace ...) is also
// used by monsters.js.

import {
  INK, paintSprite, leather, dye, line, gold, hole, holes, dotLine, dotFill, slit, cut,
  dotFlower, prajamYam, krajangRow, krajangPath, kanokPts, band, eye, rivet,
  curve, poly, inset, resample, rng,
} from '../art/leather.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------ geometry
// Densified closed outline from control points, with a little hand-cut
// wobble so no two cuts are perfectly smooth.
export function shape(ctrl, { t = 0.5, steps = 6, wob = 0.5, seed = 1 } = {}) {
  const r = rng(seed);
  const c = wob ? ctrl.map(([x, y]) => [x + (r() - 0.5) * wob * 2, y + (r() - 0.5) * wob * 2]) : ctrl;
  return curve(c, true, steps, t);
}

// Open smooth polyline.
export function path(ctrl, steps = 8) {
  return ctrl.length > 2 ? curve(ctrl, false, steps) : ctrl.slice();
}

// Closed outline around a spine with per-control-point radii (legs,
// trunks, tails, snake bodies). Round caps unless capA/capB = false
// (then the end is cut square).
export function tube(spine, radii, { steps = 8, capA = true, capB = true } = {}) {
  const pts = [], rs = [];
  const n = spine.length;
  if (n > 2) {
    const d = curve(spine, false, steps);
    d.forEach((p, i) => {
      const u = i / steps, k = Math.min(n - 2, Math.floor(u)), f = u - k;
      pts.push(p);
      rs.push(lerp(radii[k], radii[k + 1], f));
    });
  } else {
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      pts.push([lerp(spine[0][0], spine[1][0], f), lerp(spine[0][1], spine[1][1], f)]);
      rs.push(lerp(radii[0], radii[1], f));
    }
  }
  const m = pts.length;
  const nr = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(m - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  });
  const L = [], R = [];
  for (let i = 0; i < m; i++) {
    L.push([pts[i][0] + nr[i][0] * rs[i], pts[i][1] + nr[i][1] * rs[i]]);
    R.push([pts[i][0] - nr[i][0] * rs[i], pts[i][1] - nr[i][1] * rs[i]]);
  }
  const cap = (p, n0, r, dir) => {
    const out = [];
    const tx = n0[1] * dir, ty = -n0[0] * dir; // forward (dir=1 at end)
    for (let k = 1; k < 8; k++) {
      const a = (k / 8) * Math.PI;
      out.push([p[0] + (n0[0] * Math.cos(a) * dir + tx * Math.sin(a)) * r * (dir > 0 ? 1 : 1),
        p[1] + (n0[1] * Math.cos(a) * dir + ty * Math.sin(a)) * r]);
    }
    return out;
  };
  const out = [...L];
  if (capB) out.push(...cap(pts[m - 1], nr[m - 1], rs[m - 1], 1));
  out.push(...R.reverse());
  if (capA) out.push(...cap(pts[0], nr[0], rs[0], -1));
  return out;
}

// Offset an open polyline sideways (+d = left of travel in screen space).
export function offset(pts, d) {
  const m = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(m - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [p[0] - (dy / l) * d, p[1] + (dx / l) * d];
  });
}

export const move = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
export function rotPts(pts, cx, cy, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
}
export function scalePts(pts, cx, cy, sx, sy = sx) {
  return pts.map(([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy]);
}

// ------------------------------------------------------------ pieces & rigs
// A leather piece painted directly in figure coordinates. `outlines` are
// point lists used to size the sprite box.
// Figure scale: builders author in convenient units and call scaleFigure()
// to size the whole creature (joints scale with it).
let FK = 1;
export function scaleFigure(k = 1) { FK = k; }

export function piece(name, outlines, draw, { margin = 3, px } = {}) {
  const k = FK;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const pts of outlines) for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  x0 = Math.floor((x0 - margin) * k); y0 = Math.floor((y0 - margin) * k);
  x1 = Math.ceil((x1 + margin) * k); y1 = Math.ceil((y1 + margin) * k);
  const sprite = paintSprite(x1 - x0, y1 - y0, (ctx, info) => {
    ctx.translate(-x0, -y0);
    ctx.scale(k, k);
    draw(ctx, info.rng);
  }, { name, px, pad: 3 });
  return { sprite, x0, y0, x1, y1, k };
}

// Rig from pieces. parts: { id: { pc, z, parent, j: [x, y] (figure coords),
// lim, stiff, mass } }.
export function makeRig(kind, parts, extra = {}) {
  const out = {};
  for (const [id, d] of Object.entries(parts)) {
    const o = { sprite: d.pc.sprite, z: d.z ?? 0 };
    if (d.parent) {
      const par = parts[d.parent].pc;
      o.parent = d.parent;
      const jx = d.j[0] * d.pc.k, jy = d.j[1] * d.pc.k;
      o.at = [jx - par.x0, jy - par.y0];
      o.pivot = [jx - d.pc.x0, jy - d.pc.y0];
      o.rot = 0;
      o.lim = d.lim === undefined ? null : d.lim;
      o.stiff = d.stiff ?? 0.5;
    }
    if (d.mass) o.mass = d.mass;
    out[id] = o;
  }
  const root = extra.root || Object.keys(parts).find((k) => !parts[k].parent);
  const rig = { kind, root, handle: root, parts: out, ...extra };
  FK = 1;
  if (extra.glowAt) {
    const b = parts[root].pc;
    rig.glow = [extra.glowAt[0] * b.k - b.x0, extra.glowAt[1] * b.k - b.y0, extra.glowAt[2] * b.k];
    out[root].glow = rig.glow;
    delete rig.glowAt;
  }
  return rig;
}

// ------------------------------------------------------------ decoration
export function hide(ctx, pts) {
  return leather(ctx, poly(pts));
}

// Gold contour + one or more punched dot rows following the outline.
export function trim(ctx, pts, { g = 1.5, gw = 0.6, d = 3.4, sp = 3.3, r = 0.66, rows = 1, gap = 2.7, seed = 1 } = {}) {
  if (g) gold(ctx, poly(inset(pts, g)), gw);
  if (d) for (let k = 0; k < rows; k++) {
    dotLine(ctx, inset(pts, d + k * gap), { closed: true, spacing: sp * (1 - k * 0.06), r: r * (1 - k * 0.12), seed: seed + k * 7, smoothIt: false });
  }
}

// Dyed field inset from an outline, with its own gold edge.
export function field(ctx, pts, color, { d = 3, alpha = 0.88, edge = true, gw = 0.55 } = {}) {
  const p = poly(inset(pts, d));
  dye(ctx, p, color, alpha);
  if (edge) gold(ctx, p, gw);
  return p;
}

export function dots(ctx, pts, o = {}) {
  return dotLine(ctx, pts, { spacing: 3.3, r: 0.66, jitter: 0.15, ...o });
}

// Spiral rosette (ก้นหอย) — the Thai-mural swirl at shoulders and haunches:
// a gold line with a punched row running between its arms.
export function spiral(ctx, cx, cy, R, { turns = 2.1, dir = 1, a0 = 0, seed = 3, w = 0.75, r = 0.62 } = {}) {
  const N = Math.ceil(40 * turns);
  const arm = (off) => {
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const rr = R * (0.1 + 0.9 * t) + off;
      const a = a0 + dir * t * turns * TAU;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return pts;
  };
  const pitch = (R * 0.9) / turns;
  gold(ctx, arm(0), w, { smoothIt: false });
  dotLine(ctx, arm(pitch * 0.5).slice(Math.ceil(N * 0.25)), { spacing: 3, r, seed, smoothIt: false });
  hole(ctx, cx, cy, r * 1.4);
}

// Row of small diamond cut-outs along a path, with dots between — the
// lace chain seen on harness straps and borders.
export function lozenges(ctx, pts, { size = 2.2, gap = 6, seed = 4, dotsToo = true, aspect = 0.55 } = {}) {
  const s = resample(path(pts), gap, false);
  s.forEach(([x, y, a], i) => {
    const c = Math.cos(a), si = Math.sin(a);
    const L = size, W = size * aspect;
    cut(ctx, poly([[x + c * L, y + si * L], [x - si * W, y + c * W], [x - c * L, y - si * L], [x + si * W, y - c * W]]));
    if (dotsToo && i < s.length - 1) hole(ctx, x + c * gap * 0.5, y + si * gap * 0.5, size * 0.28);
  });
}

// Decorative strap: dyed band with gold edges and a lozenge chain.
export function strap(ctx, pts, w, { color = INK.red, seed = 5, loz = true, alpha = 0.9 } = {}) {
  const p = path(pts);
  line(ctx, p, color, w, { alpha, smoothIt: false });
  gold(ctx, offset(p, w / 2), 0.55, { smoothIt: false });
  gold(ctx, offset(p, -w / 2), 0.55, { smoothIt: false });
  if (loz) lozenges(ctx, p, { size: w * 0.3, gap: w * 0.95, seed });
  else dots(ctx, p, { spacing: w * 0.6, r: w * 0.12, seed, smoothIt: false });
}

// Short knife slits along a path (hair, fur, feather barbs).
export function slits(ctx, pts, { len = 4, gap = 3, ang = 0.7, w = 0.65, seed = 6, jit = 0.25 } = {}) {
  const r = rng(seed);
  const s = resample(path(pts), gap, false);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [x, y, a] of s) {
    const aa = a + ang + (r() - 0.5) * jit;
    const l = len * (0.8 + r() * 0.4);
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(aa) * l, y + Math.sin(aa) * l);
  }
  ctx.stroke();
  ctx.restore();
}

// Scattered dot-flowers (ดอกจัน) inside a region.
export function flowers(ctx, pts, n, { r = 0.7, seed = 7, minD = 9, inner = 5 } = {}) {
  const rr = rng(seed);
  const ins = inset(pts, inner);
  const p = poly(ins);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ins) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const got = [];
  const m = ctx.getTransform();
  for (let tries = 0; tries < n * 30 && got.length < n; tries++) {
    const x = lerp(x0, x1, rr()), y = lerp(y0, y1, rr());
    const d = m.transformPoint({ x, y });
    if (!ctx.isPointInPath(p, d.x, d.y)) continue;
    if (got.some(([a, b]) => Math.hypot(a - x, b - y) < minD)) continue;
    got.push([x, y]);
  }
  for (const [x, y] of got) dotFlower(ctx, x, y, r, 5, 2.4);
  return got;
}

// Punched eye with a gold lid line.
export function beastEye(ctx, x, y, s, { angle = 0, style = 'almond', lid = true } = {}) {
  if (lid) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = INK.goldLine;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    if (style === 'round') ctx.arc(0, 0, s * 1.1, 0, TAU);
    else { ctx.moveTo(-s * 1.35, s * 0.1); ctx.quadraticCurveTo(-s * 0.2, -s * 1.05, s * 1.25, -s * 0.2); }
    ctx.stroke();
    ctx.restore();
  }
  eye(ctx, x, y, s, { style, angle });
}

// A kanok flame (กนก) added to the silhouette: leather, gold edge, a
// punched eye. Returns its outline.
export function kanok(ctx, x, y, size, angle, flip = false, { color, alpha = 0.85, punch = true } = {}) {
  const pts = kanokPts(x, y, size, angle, flip);
  hide(ctx, pts);
  if (color) dye(ctx, poly(inset(pts, size * 0.08)), color, alpha);
  if (size > 7) gold(ctx, poly(inset(pts, Math.min(1.2, size * 0.06))), 0.5);
  if (punch) {
    const c = Math.cos(angle), s = Math.sin(angle);
    hole(ctx, x + c * size * 0.3, y + s * size * 0.3, Math.max(0.5, size * 0.05));
  }
  return pts;
}

// A long cut feather: leather blade, dyed vane, gold rachis, slit barbs
// and a dot edge. spine runs root -> tip.
export function feather(ctx, spine, w, { color, alpha = 0.85, seed = 8, barbs = true, lace = false } = {}) {
  const n = spine.length;
  const radii = spine.map((_, i) => {
    const t = i / (n - 1);
    return Math.max(0.6, w * (0.55 + Math.sin(Math.min(1, t * 1.25) * Math.PI) * 0.45) * (1 - t * 0.55));
  });
  radii[n - 1] = 0.8;
  const o = tube(spine, radii, { steps: 8 });
  hide(ctx, o);
  if (color) dye(ctx, poly(inset(o, Math.min(1.4, w * 0.25))), color, alpha);
  const sp = path(spine, 8);
  gold(ctx, sp, Math.max(0.45, w * 0.12), { smoothIt: false });
  if (barbs && w > 2.4) {
    const cutLen = w * 0.55;
    slits(ctx, offset(sp, w * 0.2).slice(1, -3), { len: cutLen, gap: Math.max(2.2, w * 0.55), ang: -2.4, w: 0.55, seed });
    slits(ctx, offset(sp, -w * 0.2).slice(1, -3), { len: cutLen, gap: Math.max(2.2, w * 0.55), ang: 2.4, w: 0.55, seed: seed + 1 });
  }
  if (lace && w > 3) dotLine(ctx, inset(o, w * 0.28), { closed: true, spacing: 2.6, r: 0.5, seed: seed + 2, smoothIt: false });
  return o;
}

// Joint knot drawn over a joint on the child piece.
export const knot = (ctx, x, y, r = 2.2) => rivet(ctx, x, y, r);

// Radial lace rosette (ดอกพิกุล-style): petals of holes around a hole.
export function rosette(ctx, x, y, R, { petals = 8, color = INK.gold, inner = INK.red } = {}) {
  const p = new Path2D();
  p.arc(x, y, R, 0, TAU);
  dye(ctx, p, color, 0.9);
  const q = new Path2D();
  q.arc(x, y, R * 0.55, 0, TAU);
  dye(ctx, q, inner, 0.9);
  gold(ctx, poly(Array.from({ length: 40 }, (_, i) => [x + Math.cos(i / 40 * TAU) * R, y + Math.sin(i / 40 * TAU) * R])), 0.5, { closed: true });
  hole(ctx, x, y, R * 0.18);
  for (let k = 0; k < petals; k++) {
    const a = (k / petals) * TAU;
    hole(ctx, x + Math.cos(a) * R * 0.75, y + Math.sin(a) * R * 0.75, R * 0.11);
  }
}

// Hoof at the bottom of a leg: y = ground line, x = centre. Cloven hooves
// get a V notch at the toe and a dewclaw.
function hoof(ctx, x, y, w, h, { cloven = true } = {}) {
  const pts = shape([[x - w * 0.34, y - h], [x + w * 0.24, y - h], [x + w * 0.44, y - h * 0.45], [x + w * 0.58, y - 0.2], [x + w * 0.1, y + 0.4], [x - w * 0.46, y], [x - w * 0.5, y - h * 0.45]], { t: 0.28, wob: 0.15 });
  hide(ctx, pts);
  if (cloven) {
    cut(ctx, poly([[x + w * 0.62, y + 1], [x + w * 0.2, y + 1], [x + w * 0.3, y - h * 0.4]]));
    hide(ctx, shape([[x - w * 0.34, y - h * 1.35], [x - w * 0.55, y - h * 0.95], [x - w * 0.36, y - h * 0.8]], { t: 0.4, wob: 0 }));
  }
  gold(ctx, [[x - w * 0.36, y - h + 1], [x + w * 0.26, y - h + 1]], 1, { smoothIt: false });
  dots(ctx, [[x - w * 0.3, y - h * 0.45], [x + w * 0.3, y - h * 0.45]], { spacing: 2.6, r: 0.5, smoothIt: false });
  return pts;
}

// Generic two-piece leg: upper (forearm / gaskin, hung from the belly
// line) and lower (shank + foot). Returns pieces plus joint points in
// figure coords.
function leg(name, { up, upR, lo, loR, foot = 'cloven', fw = 16, fh = 8, far = false, color, bands = [0.3], seed = 1, dotR = 0.66, footDir = 1, jointDy }) {
  const uo = tube(up, upR);
  const lo2 = tube(lo, loR);
  const end = lo[lo.length - 1];
  const joint = [up[0][0], up[0][1] + (jointDy ?? upR[0] * 0.45)];
  const upper = piece(name + '-u', [uo], (ctx) => {
    hide(ctx, uo);
    if (color) field(ctx, uo, color, { d: 3.2, alpha: 0.8 });
    trim(ctx, uo, { d: 3.1, r: dotR, seed });
    const sp = path(up);
    dots(ctx, sp.slice(Math.floor(sp.length * 0.3), -3), { spacing: 3.1, r: dotR * 0.9, seed: seed + 3, smoothIt: false });
    if (far) dye(ctx, poly(uo), '#000', 0.3);
    else knot(ctx, joint[0], joint[1], Math.min(2.6, upR[0] * 0.25));
  });
  const lower = piece(name + '-l', [lo2, [[end[0] - fw, end[1] - fh - 2], [end[0] + fw, end[1] + 4]]], (ctx) => {
    hide(ctx, lo2);
    if (foot === 'cloven' || foot === 'hoof') hoof(ctx, end[0], end[1] + loR[loR.length - 1] * 0.75, fw, fh, { cloven: foot === 'cloven' });
    trim(ctx, lo2, { d: 2.6, r: dotR * 0.9, g: 1.2, seed: seed + 5 });
    const sp = path(lo);
    for (const t of bands) {
      const i = Math.floor((sp.length - 1) * t);
      const p = sp[i], q = sp[i + 1];
      const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2;
      const rr = lerp(loR[0], loR[loR.length - 1], t) * 0.95;
      const A = [p[0] - Math.cos(a) * rr, p[1] - Math.sin(a) * rr], B = [p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr];
      gold(ctx, [A, B], 1.3, { smoothIt: false });
      const dx = Math.cos(a - Math.PI / 2) * 2.5, dy = Math.sin(a - Math.PI / 2) * 2.5;
      dots(ctx, move([A, B], -dx, -dy), { spacing: 2.6, r: 0.55, smoothIt: false, seed: seed + 9 });
    }
    if (far) dye(ctx, poly(lo2), '#000', 0.3);
    else knot(ctx, lo[0][0], lo[0][1], Math.min(2.4, loR[0] * 0.33));
  });
  return { upper, lower, knee: lo[0], joint };
}

// Kanok flame drawn INSIDE the hide (gold outline + punched dots) — used
// for the stylised flame-hair of Thai mural animals.
export function kanokMark(ctx, x, y, size, angle, flip = false, { seed = 1, fill } = {}) {
  const pts = kanokPts(x, y, size, angle, flip);
  if (fill) dye(ctx, poly(pts), fill, 0.85);
  gold(ctx, poly(pts), 0.5);
  dotLine(ctx, inset(pts, size * 0.12), { closed: true, spacing: 2.6, r: 0.5, seed, smoothIt: false });
}

// Flame-hair tongue (ลายไฟ) drawn inside the hide: a tapering S-curved
// flame outlined in gold with a dot row down its middle.
export function flame(ctx, x, y, angle, len, w, { curl = 0.25, seed = 1, fill, alpha = 0.8 } = {}) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const N = 14, A = [], B = [], mid = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const bend = Math.sin(u * Math.PI * 1.15) * curl * len * (u < 0.8 ? 1 : 1 + (u - 0.8) * 3);
    const hw = w * 0.5 * Math.pow(1 - u, 0.9) * (0.7 + 0.3 * Math.sin(Math.min(1, u * 3) * Math.PI * 0.5));
    const cx = x + c * u * len - s * bend, cy = y + s * u * len + c * bend;
    mid.push([cx, cy]);
    A.push([cx - s * hw, cy + c * hw]);
    B.push([cx + s * hw, cy - c * hw]);
  }
  const pts = [...A, ...B.reverse()];
  if (fill) dye(ctx, poly(pts), fill, alpha);
  gold(ctx, poly(pts), 0.5);
  if (w > 7) {
    dotLine(ctx, inset(pts, 1.8).slice(1, -1), { closed: false, spacing: 2.7, r: 0.5, seed, smoothIt: false });
    dotLine(ctx, mid.slice(1, Math.floor(N * 0.6)), { spacing: 3, r: 0.6, seed: seed + 1, smoothIt: false });
  } else dotLine(ctx, mid.slice(1, -2), { spacing: 2.8, r: 0.52, seed, smoothIt: false });
  return pts;
}

// A swirl with flame tongues streaming from it (joint ornament of
// Thai-mural beasts). `dir` is the direction the flames stream.
export function swirlFlames(ctx, cx, cy, R, dir, { n = 3, len = 26, spin = 1, seed = 5, fill } = {}) {
  for (let k = 0; k < n; k++) {
    const off = (k - (n - 1) / 2) * 0.42;
    const a = dir + off * 0.6;
    const bx = cx + Math.cos(dir + off * 2.2) * R * 0.8, by = cy + Math.sin(dir + off * 2.2) * R * 0.8;
    flame(ctx, bx, by, a, len * (1 - Math.abs(off) * 0.4), R * 0.95, { curl: 0.14 * spin, seed: seed + k, fill });
  }
  spiral(ctx, cx, cy, R, { seed, dir: spin, a0: dir });
}

// Tail tuft / hair lock: a teardrop with a toothed edge and hair slits,
// pointing along `angle` from (x, y).
export function tuftPts(x, y, len, w, angle, { teeth = 5, seed = 2 } = {}) {
  const r = rng(seed);
  const c = Math.cos(angle), s = Math.sin(angle);
  const T = (u, v) => [x + c * u - s * v, y + s * u + c * v];
  const side = (sg) => {
    const out = [];
    const n = teeth * 2;
    for (let i = 0; i <= n; i++) {
      const u = (i / n) * len * 0.92;
      const prof = Math.pow(Math.sin(Math.min(1, (u / len) * 1.35) * Math.PI * 0.5 + 0.05), 0.8) * (1 - (u / len) * 0.75);
      const tooth = i % 2 ? 1.25 : 0.72;
      out.push(T(u, sg * (w * 0.5 * prof * (i > 1 ? tooth : 1) + (r() - 0.5) * 0.4)));
    }
    return out;
  };
  const a = side(-1), b = side(1).reverse();
  return [...a, T(len, 0), ...b];
}
export function tuft(ctx, pts, x, y, len, angle, { color } = {}) {
  hide(ctx, pts);
  if (color) dye(ctx, poly(inset(pts, 1.2)), color, 0.8);
  gold(ctx, poly(inset(pts, 0.9)), 0.45);
  const c = Math.cos(angle), s = Math.sin(angle);
  for (let k = -1; k <= 1; k++) {
    const q = (u, v) => [x + c * u - s * v, y + s * u + c * v];
    slit(ctx, [q(len * 0.14, k * 1.6), q(len * 0.5, k * 2.4), q(len * 0.78, k * 1.6)], 0.6);
  }
}

// Single-piece leg (short legs, birds): tube + foot.
function leg1(name, { spine, radii, foot = 'cloven', fw = 12, fh = 7, far = false, seed = 1, pale, footColor, dotR = 0.6, bands = [], spur = false, perf = true }) {
  const o = tube(spine, radii);
  const end = spine[spine.length - 1];
  const gy = end[1] + radii[radii.length - 1] * 0.75;
  const joint = [spine[0][0], spine[0][1] + radii[0] * 0.4];
  const box = [[end[0] - fw * 1.1, gy - fh - 3], [end[0] + fw * 1.2, gy + 3]];
  const pc = piece(name, [o, box], (ctx) => {
    hide(ctx, o);
    if (pale) field(ctx, o, pale, { d: 1.6, alpha: 0.8, edge: false });
    drawFoot(ctx, foot, end[0], gy, fw, fh, { color: footColor, spur });
    if (perf) trim(ctx, o, { d: Math.min(2.6, radii[0] * 0.45), g: Math.min(1.2, radii[0] * 0.2), r: dotR, seed, sp: 3 });
    legBands(ctx, spine, radii, bands, seed);
    if (far) dye(ctx, poly(o), '#000', 0.3);
    else knot(ctx, joint[0], joint[1], Math.min(2.2, radii[0] * 0.3));
  });
  return { pc, joint };
}

function legBands(ctx, spine, radii, bands, seed) {
  const sp = path(spine);
  for (const t of bands) {
    const i = Math.floor((sp.length - 1) * t);
    const p = sp[i], q = sp[i + 1];
    const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2;
    const rr = lerp(radii[0], radii[radii.length - 1], t) * 0.95;
    const A = [p[0] - Math.cos(a) * rr, p[1] - Math.sin(a) * rr], B = [p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr];
    gold(ctx, [A, B], Math.max(0.8, rr * 0.2), { smoothIt: false });
    const dx = Math.cos(a - Math.PI / 2) * rr * 0.4, dy = Math.sin(a - Math.PI / 2) * rr * 0.4;
    dots(ctx, move([A, B], -dx, -dy), { spacing: 2.6, r: 0.5, smoothIt: false, seed: seed + 9 });
  }
}

function drawFoot(ctx, foot, x, y, w, h, { color, spur } = {}) {
  if (foot === 'cloven' || foot === 'hoof') return hoof(ctx, x, y, w, h, { cloven: foot === 'cloven' });
  if (foot === 'paw') return paw(ctx, x, y, w, h, { color });
  if (foot === 'bird') return birdFoot(ctx, x, y, w, { color, spur });
  if (foot === 'web') return webFoot(ctx, x, y, w, { color });
  if (foot === 'pad') return padFoot(ctx, x, y, w, h);
  if (foot === 'hand') return monkeyHand(ctx, x, y, w, h);
}

// Dog / cat paw with toe slits.
function paw(ctx, x, y, w, h, { color } = {}) {
  const pts = shape([[x - w * 0.42, y - h * 1.1], [x + w * 0.05, y - h * 1.15], [x + w * 0.45, y - h * 0.7], [x + w * 0.62, y - h * 0.15], [x + w * 0.45, y], [x - w * 0.45, y], [x - w * 0.55, y - h * 0.5]], { t: 0.45, wob: 0.1 });
  hide(ctx, pts);
  if (color) dye(ctx, poly(inset(pts, 0.8)), color, 0.8);
  slit(ctx, [[x + w * 0.3, y + 0.5], [x + w * 0.22, y - h * 0.45]], 0.6, { smoothIt: false });
  slit(ctx, [[x + w * 0.02, y + 0.5], [x - w * 0.02, y - h * 0.4]], 0.6, { smoothIt: false });
  return pts;
}

// Bird foot: three forward toes, a hind toe and (for cocks) a spur.
function birdFoot(ctx, x, y, s, { color = INK.yellow, spur = false } = {}) {
  const toes = [
    [[x, y - s * 0.22], [x + s * 0.5, y - s * 0.08], [x + s * 1.0, y - s * 0.02]],
    [[x, y - s * 0.2], [x + s * 0.35, y - s * 0.02], [x + s * 0.72, y + s * 0.02]],
    [[x, y - s * 0.22], [x - s * 0.3, y - s * 0.08], [x - s * 0.52, y]],
  ];
  for (const t of toes) {
    const o = tube(t, [s * 0.13, s * 0.1, s * 0.06]);
    hide(ctx, o);
    if (color) dye(ctx, poly(o), color, 0.75);
    const e = t[2], d = t[1];
    const a = Math.atan2(e[1] - d[1], e[0] - d[0]);
    hide(ctx, tube([e, [e[0] + Math.cos(a + 0.5) * s * 0.16, e[1] + Math.sin(a + 0.5) * s * 0.16]], [s * 0.06, s * 0.02]));
  }
  if (spur) hide(ctx, tube([[x - s * 0.02, y - s * 0.7], [x - s * 0.3, y - s * 0.76], [x - s * 0.42, y - s * 0.92]], [s * 0.1, s * 0.06, s * 0.02]));
}

function webFoot(ctx, x, y, s, { color = INK.orange } = {}) {
  const pts = shape([[x - s * 0.15, y - s * 0.35], [x + s * 0.2, y - s * 0.3], [x + s * 1.0, y - s * 0.05], [x + s * 0.9, y + s * 0.05], [x + s * 0.6, y - 0.1], [x + s * 0.35, y + s * 0.06], [x, y], [x - s * 0.4, y - s * 0.02]], { t: 0.3, wob: 0.1 });
  hide(ctx, pts);
  dye(ctx, poly(inset(pts, 0.6)), color, 0.85);
  slit(ctx, [[x + s * 0.05, y - s * 0.22], [x + s * 0.7, y - s * 0.05]], 0.5, { smoothIt: false });
}

// Elephant foot: broad pad with pale toenails.
function padFoot(ctx, x, y, w, h) {
  const pts = shape([[x - w * 0.5, y - h], [x + w * 0.52, y - h], [x + w * 0.62, y - h * 0.3], [x + w * 0.56, y], [x - w * 0.56, y], [x - w * 0.6, y - h * 0.35]], { t: 0.3, wob: 0.3 });
  hide(ctx, pts);
  for (let k = 0; k < 3; k++) {
    const cx = x + w * (0.05 + k * 0.2);
    const p = new Path2D();
    p.ellipse(cx, y - h * 0.3, w * 0.085, h * 0.3, 0, 0, TAU);
    dye(ctx, p, INK.cream, 0.85);
    gold(ctx, p, 0.5);
  }
  dots(ctx, [[x - w * 0.5, y - h + 2], [x + w * 0.5, y - h + 2]], { spacing: 3, r: 0.6, smoothIt: false });
}

function monkeyHand(ctx, x, y, w, h) {
  const pts = shape([[x - w * 0.35, y - h], [x + w * 0.2, y - h * 0.9], [x + w * 0.7, y - h * 0.3], [x + w * 0.8, y], [x - w * 0.4, y], [x - w * 0.5, y - h * 0.4]], { t: 0.4, wob: 0.1 });
  hide(ctx, pts);
  for (let k = 0; k < 3; k++) slit(ctx, [[x + w * (0.2 + k * 0.18), y + 0.4], [x + w * (0.1 + k * 0.14), y - h * 0.4]], 0.5, { smoothIt: false });
}

// Painted dark-ink line (blocks lamp light like hide).
export const ink = (ctx, pts, w = 0.9, alpha = 0.85) => line(ctx, pts, INK.leather, w, { alpha });

function grad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [t, c] of stops) g.addColorStop(t, c);
  return g;
}

// Scales (เกล็ด) punched as crescents inside an outline.
export function scales(ctx, pts, { d = 3, spacing = 6, w = 0.7 } = {}) {
  const ins = inset(pts, d);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ins) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  dotFill(ctx, poly(ins), [x0, y0, x1, y1], { pattern: 'scales', spacing, r: w });
}

// Krajang lace hem hanging DOWN from a baseline given left -> right.
function hem(ctx, pts, size, { color = INK.gold, inner = INK.red } = {}) {
  krajangRow(ctx, pts.slice().reverse(), size, { color, inner });
}

// ================================================================ ANIMALS

// ควาย — water buffalo with swept-back crescent horns and a wooden bell.
function buffalo() {
  const N = 'kwai';
  const bodyPts = shape([[40, 57], [62, 50], [108, 53], [150, 50], [180, 41], [206, 43], [222, 48], [233, 60], [237, 84], [236, 110], [231, 131], [220, 143], [206, 147], [176, 151], [140, 159], [104, 155], [86, 148], [70, 151], [48, 150], [32, 132], [22, 104], [26, 74]], { wob: 0.9, seed: 11 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    trim(ctx, bodyPts, { rows: 2, seed: 12 });
    const back = path([[46, 64], [90, 60], [140, 60], [178, 52], [212, 56], [226, 64]]);
    gold(ctx, back, 0.7, { smoothIt: false });
    dots(ctx, offset(back, 3.2), { spacing: 3, seed: 13, smoothIt: false });
    dots(ctx, offset(back, 7), { spacing: 3.4, r: 0.55, seed: 131, smoothIt: false });
    // shoulder & haunch swirls streaming flame-hair
    swirlFlames(ctx, 204, 106, 13, Math.PI - 0.3, { n: 3, len: 30, spin: -1, seed: 14 });
    swirlFlames(ctx, 52, 102, 15, -0.3, { n: 3, len: 32, spin: 1, seed: 15 });
    // rib arcs
    for (let i = 0; i < 5; i++) {
      const x = 104 + i * 13;
      dots(ctx, [[x + 7, 74], [x - 1, 104], [x + 4, 138]], { spacing: 3, seed: 20 + i });
      gold(ctx, [[x + 10.5, 76], [x + 3.5, 104], [x + 7.5, 136]], 0.45);
    }
    strap(ctx, [[82, 145], [120, 152], [160, 150], [196, 142]], 6.5, { color: INK.crimson, seed: 16 });
    flowers(ctx, [[104, 64], [176, 58], [176, 70], [104, 70]], 4, { seed: 17, inner: 0, minD: 14 });
  });

  const headPts = shape([[222, 52], [240, 54], [262, 59], [274, 65], [286, 79], [293, 99], [299, 116], [305, 128], [299, 139], [286, 142], [272, 137], [258, 131], [244, 136], [232, 131], [226, 110], [224, 80]], { wob: 0.6, seed: 16 });
  const hs = [[262, 64], [244, 51], [224, 43], [206, 33], [196, 19], [199, 4]];
  const hornN = tube(hs, [9, 8.4, 7.2, 5.4, 3.4, 1.1]);
  const hornF = tube(move(hs, 5, -3), [8, 7.4, 6.2, 4.6, 3, 1]);
  const earPts = shape([[258, 71], [245, 71], [231, 81], [244, 90], [258, 84]], { t: 0.45, wob: 0.3, seed: 17 });
  const head = piece(N + '-head', [headPts, hornN, hornF, earPts], (ctx) => {
    hide(ctx, hornF);
    dye(ctx, poly(hornF), '#000', 0.3);
    hide(ctx, headPts);
    trim(ctx, headPts, { rows: 2, seed: 18 });
    for (let i = 0; i < 3; i++) slits(ctx, [[236 + i * 6, 66 + i * 3], [238 + i * 5, 96], [236 + i * 4, 124 - i * 3]], { len: 3.4, gap: 4, ang: 2.5, seed: 30 + i });
    strap(ctx, [[258, 64], [262, 96], [252, 132]], 5.5, { color: INK.vermilion, seed: 32 });
    strap(ctx, [[264, 72], [278, 97], [290, 124]], 5.5, { color: INK.vermilion, seed: 19 });
    rosette(ctx, 264, 73, 4.6);
    beastEye(ctx, 279, 86, 4.4, { angle: 0.45 });
    hole(ctx, 301, 126, 1.4);
    slit(ctx, [[300, 137], [292, 137], [284, 134]], 0.8);
    dots(ctx, [[255, 100], [266, 118], [282, 132]], { spacing: 3, seed: 23 });
    hide(ctx, hornN);
    gold(ctx, poly(inset(hornN, 1.4)), 0.5);
    const sp = path(hs);
    for (let i = 3; i < sp.length - 8; i += 3) {
      const p = sp[i], q = sp[i + 1];
      const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2;
      const r = Math.max(1.2, 5.6 - i * 0.12);
      slit(ctx, [[p[0] - Math.cos(a) * r, p[1] - Math.sin(a) * r], [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r]], 0.75, { smoothIt: false });
    }
    hide(ctx, earPts);
    field(ctx, earPts, INK.crimson, { d: 2.2 });
    dots(ctx, inset(earPts, 4.2).slice(2, -2), { spacing: 2.8, r: 0.5, smoothIt: false });
    knot(ctx, 236, 96, 2.4);
  });

  const bellRope = tube([[248, 128], [248, 140], [249, 150]], [1.6, 1.4, 1.4]);
  const bellPts = shape([[237, 149], [260, 149], [264, 173], [258, 178], [239, 178], [233, 173]], { t: 0.3, wob: 0.3, seed: 22 });
  const bell = piece(N + '-bell', [bellRope, bellPts, [[244, 189]]], (ctx) => {
    hide(ctx, bellRope);
    hide(ctx, tube([[244, 175], [243, 187]], [1.6, 1.3]));
    hide(ctx, tube([[253, 175], [254, 187]], [1.6, 1.3]));
    hide(ctx, bellPts);
    field(ctx, bellPts, INK.gold, { d: 2, alpha: 0.75 });
    gold(ctx, [[236, 155], [262, 155]], 0.8, { smoothIt: false });
    dots(ctx, [[239, 161], [259, 161]], { spacing: 3, r: 0.7, smoothIt: false });
    dotFlower(ctx, 249, 169, 0.75);
    knot(ctx, 248, 129, 1.8);
  });

  const lFN = leg(N + '-fn', { up: [[211, 128], [213, 150], [214, 166]], upR: [12.5, 10, 7.5], lo: [[214, 165], [213, 180], [212, 191]], loR: [7.2, 6, 6.2], fw: 17, fh: 10, seed: 40 });
  const lFF = leg(N + '-ff', { up: [[196, 128], [197, 150], [197, 166]], upR: [12, 9.5, 7.2], lo: [[197, 165], [196, 180], [195, 191]], loR: [7, 5.8, 6], fw: 16, fh: 10, far: true, seed: 44 });
  const lBN = leg(N + '-bn', { up: [[56, 130], [62, 150], [53, 168]], upR: [14, 10.5, 7.2], lo: [[53, 167], [55, 180], [57, 191]], loR: [7, 6, 6.2], fw: 17, fh: 10, seed: 48 });
  const lBF = leg(N + '-bf', { up: [[72, 130], [78, 150], [69, 168]], upR: [13, 10, 7], lo: [[69, 167], [71, 180], [73, 191]], loR: [6.8, 5.8, 6], fw: 16, fh: 10, far: true, seed: 52 });

  const tailPts = tube([[30, 64], [20, 80], [15, 108], [16, 136]], [4.2, 3.2, 2.5, 2.2]);
  const tuftP = tuftPts(16, 130, 38, 15, Math.PI / 2 + 0.05);
  const tail = piece(N + '-tail', [tailPts, tuftP], (ctx) => {
    hide(ctx, tailPts);
    tuft(ctx, tuftP, 16, 130, 38, Math.PI / 2 + 0.05);
    dots(ctx, path([[28, 68], [18, 90], [16, 128]]), { spacing: 3.3, r: 0.55, smoothIt: false });
  });

  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 2 },
    head: { pc: head, z: 2, parent: 'body', j: [236, 96], lim: [-0.4, 0.35], stiff: 0.6 },
    bell: { pc: bell, z: 3, parent: 'head', j: [248, 129], lim: null, stiff: 0.06 },
    tail: { pc: tail, z: -1, parent: 'body', j: [30, 64], lim: [-0.9, 0.9], stiff: 0.2 },
    ...legJoints('legFR', lFN, 4, 5),
    ...legJoints('legFL', lFF, -3, -2),
    ...legJoints('legBR', lBN, 4, 5),
    ...legJoints('legBL', lBF, -3, -2),
  }, {
    sound: 'animal-buffalo',
    gait: quadGait(0.3, 0.25),
  });
}

function legJoints(id, L, z, zl, { lim = [-0.7, 0.7], stiff = 0.6, parent = 'body' } = {}) {
  return {
    [id]: { pc: L.upper, z, parent, j: L.joint, lim, stiff },
    [id + '2']: { pc: L.lower, z: zl, parent: id, j: L.knee, lim: [-0.9, 0.9], stiff },
  };
}


// วัวขาว — the white ox of the Royal Ploughing Ceremony (พระโค): pale
// translucent hide, red caparison with a krajang hem, jasmine garland.
function whiteOx() {
  const N = 'wua';
  const PALE = INK.cream;
  const bodyPts = shape([[30, 64], [52, 56], [100, 60], [140, 58], [160, 50], [172, 34], [190, 29], [204, 35], [214, 50], [222, 60], [228, 82], [227, 110], [221, 132], [206, 144], [170, 148], [130, 153], [100, 149], [82, 142], [66, 148], [46, 146], [30, 126], [20, 100], [22, 78]], { wob: 0.8, seed: 101 });
  const cloth = shape([[84, 60], [122, 59], [158, 55], [166, 72], [166, 116], [124, 124], [80, 116], [78, 72]], { t: 0.4, wob: 0.5, seed: 102 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    field(ctx, bodyPts, PALE, { d: 2.2, alpha: 0.84, edge: false });
    trim(ctx, bodyPts, { rows: 2, seed: 103 });
    ink(ctx, [[198, 44], [206, 72], [210, 104], [206, 128]], 0.8);
    ink(ctx, [[64, 70], [50, 96], [54, 128]], 0.8);
    swirlFlames(ctx, 202, 110, 11, Math.PI - 0.3, { n: 3, len: 24, spin: -1, seed: 104 });
    swirlFlames(ctx, 48, 104, 13, -0.2, { n: 3, len: 26, spin: 1, seed: 105 });
    // hump ridge
    dots(ctx, offset(path([[160, 56], [174, 40], [190, 35], [204, 42]]), 4), { spacing: 3, seed: 106, smoothIt: false });
    // caparison
    dye(ctx, poly(cloth), INK.red, 0.92);
    gold(ctx, poly(inset(cloth, 1.4)), 0.8);
    const inner = inset(cloth, 5.5);
    dye(ctx, poly(inner), INK.crimson, 0.6);
    gold(ctx, poly(inner), 0.6);
    dotLine(ctx, inset(cloth, 3.5), { closed: true, spacing: 3, r: 0.62, seed: 107, smoothIt: false });
    for (let y = 72; y < 112; y += 12) lozenges(ctx, [[88, y], [158, y - 2]], { size: 2.2, gap: 7, seed: y });
    prajamYam(ctx, 122, 88, 9, { color: INK.red, petal: INK.gold });
    hem(ctx, [[80, 116], [124, 124], [166, 116]], 7);
    flowers(ctx, [[150, 124], [210, 120], [210, 140], [150, 146]], 3, { seed: 108, inner: 0, minD: 14 });
  });

  const headPts = shape([[210, 56], [232, 60], [252, 64], [264, 68], [276, 84], [284, 108], [290, 128], [293, 139], [287, 147], [276, 145], [266, 134], [256, 122], [250, 128], [244, 146], [236, 157], [226, 154], [220, 138], [216, 112], [214, 84]], { wob: 0.6, seed: 104 });
  const hs = [[258, 66], [255, 54], [259, 42], [267, 33]];
  const hornN = tube(hs, [4.8, 4.2, 3.1, 1.1]);
  const hornF = tube(move(hs, 7, -1), [4.4, 3.8, 2.8, 1]);
  const earPts = shape([[259, 76], [247, 80], [233, 95], [240, 99], [257, 87]], { t: 0.45, wob: 0.3, seed: 105 });
  const head = piece(N + '-head', [headPts, hornN, hornF, earPts], (ctx) => {
    hide(ctx, hornF);
    dye(ctx, poly(hornF), INK.gold, 0.5);
    hide(ctx, headPts);
    field(ctx, headPts, PALE, { d: 2.2, alpha: 0.84, edge: false });
    trim(ctx, headPts, { rows: 2, seed: 109 });
    ink(ctx, [[262, 70], [276, 96], [288, 132]], 0.7);
    // forehead pendant
    const pend = shape([[258, 68], [268, 68], [279, 96], [273, 104], [268, 96]], { t: 0.35, wob: 0.2 });
    dye(ctx, poly(pend), INK.red, 0.92);
    gold(ctx, poly(pend), 0.6);
    hole(ctx, 272, 92, 1.1);
    rosette(ctx, 263, 70, 4);
    beastEye(ctx, 270, 86, 3.8, { angle: 0.5 });
    hole(ctx, 289, 135, 1.2);
    slit(ctx, [[290, 144], [282, 143], [276, 139]], 0.7);
    // jasmine garland across the neck with a red tassel
    const gar = path([[238, 62], [247, 96], [246, 126], [238, 148]]);
    line(ctx, gar, INK.green, 3.2, { smoothIt: false, alpha: 0.8 });
    for (const [x, y] of resample(gar, 4.2)) dotFlower(ctx, x, y, 0.55, 4, 2.2);
    for (let i = 0; i < 4; i++) slits(ctx, [[222 + i * 5, 70], [224 + i * 5, 104], [226 + i * 3, 136]], { len: 3, gap: 4, ang: 2.5, seed: 110 + i });
    hide(ctx, hornN);
    dye(ctx, poly(inset(hornN, 0.8)), INK.gold, 0.7);
    gold(ctx, [[252, 60], [260, 61]], 1, { smoothIt: false });
    hide(ctx, earPts);
    field(ctx, earPts, INK.pink, { d: 2, alpha: 0.8 });
    dots(ctx, inset(earPts, 3.6).slice(3, -3), { spacing: 2.6, r: 0.5, smoothIt: false });
    knot(ctx, 220, 96, 2.2);
  });
  const tassel = tuftPts(238, 148, 22, 8, Math.PI / 2 + 0.1, { teeth: 3 });
  const bell = piece(N + '-tassel', [tassel, [[232, 142], [244, 150]]], (ctx) => {
    tuft(ctx, tassel, 238, 148, 22, Math.PI / 2 + 0.1, { color: INK.red });
    rosette(ctx, 238, 148, 4.2);
  });

  const lFN = leg(N + '-fn', { up: [[212, 128], [214, 150], [215, 166]], upR: [11, 8.5, 6.4], lo: [[215, 165], [214, 180], [213, 191]], loR: [6, 5, 5.2], fw: 14, fh: 9, seed: 120, pale: PALE });
  const lFF = leg(N + '-ff', { up: [[198, 128], [199, 150], [199, 166]], upR: [10.5, 8, 6.2], lo: [[199, 165], [198, 180], [197, 191]], loR: [5.8, 4.8, 5], fw: 13, fh: 9, far: true, seed: 124, pale: PALE });
  const lBN = leg(N + '-bn', { up: [[58, 130], [64, 150], [54, 168]], upR: [13, 9.5, 6.4], lo: [[54, 167], [56, 180], [58, 191]], loR: [6, 5, 5.2], fw: 14, fh: 9, seed: 128, pale: PALE });
  const lBF = leg(N + '-bf', { up: [[74, 130], [79, 150], [70, 168]], upR: [12, 9, 6.2], lo: [[70, 167], [72, 180], [74, 191]], loR: [5.8, 4.8, 5], fw: 13, fh: 9, far: true, seed: 132, pale: PALE });

  const tailPts = tube([[28, 68], [18, 86], [14, 116], [15, 146]], [3.6, 2.8, 2.2, 2]);
  const tP = tuftPts(15, 144, 30, 11, Math.PI / 2);
  const tail = piece(N + '-tail', [tailPts, tP], (ctx) => {
    hide(ctx, tailPts);
    field(ctx, tailPts, PALE, { d: 0.9, alpha: 0.8, edge: false });
    tuft(ctx, tP, 15, 144, 30, Math.PI / 2);
  });

  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 2 },
    head: { pc: head, z: 2, parent: 'body', j: [220, 96], lim: [-0.4, 0.35], stiff: 0.6 },
    tassel: { pc: bell, z: 3, parent: 'head', j: [238, 148], lim: null, stiff: 0.08 },
    tail: { pc: tail, z: -1, parent: 'body', j: [28, 68], lim: [-0.9, 0.9], stiff: 0.2 },
    ...legJoints('legFR', lFN, 4, 5),
    ...legJoints('legFL', lFF, -3, -2),
    ...legJoints('legBR', lBN, 4, 5),
    ...legJoints('legBL', lBF, -3, -2),
  }, { sound: 'animal-ox', gait: quadGait(0.3, 0.25, [{ part: 'tail', amp: 0.2, phase: 0.1 }]) });
}

// ช้าง — Asian elephant. royal = caparisoned royal elephant with a
// howdah (สัปคับ), netted headdress, saddle-cloth and gilded tusks.
function elephant(royal = false) {
  const N = royal ? 'chang-song' : 'chang';
  const bodyPts = shape([[40, 122], [58, 94], [100, 76], [160, 66], [220, 70], [256, 82], [270, 100], [273, 140], [271, 182], [266, 222], [252, 250], [220, 262], [170, 265], [124, 262], [98, 250], [76, 254], [52, 240], [36, 202], [32, 158]], { wob: 1.2, seed: 201 });
  const clothPts = shape([[120, 72], [180, 64], [240, 72], [248, 110], [246, 196], [184, 206], [124, 198], [112, 120]], { t: 0.4, wob: 0.6, seed: 202 });
  const howdah = shape([[124, 70], [120, 40], [112, 18], [122, 22], [134, 38], [186, 38], [236, 38], [248, 22], [258, 18], [250, 40], [246, 74]], { t: 0.35, wob: 0.3, seed: 203 });
  const body = piece(N + '-body', royal ? [bodyPts, howdah] : [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    trim(ctx, bodyPts, { rows: 3, seed: 204, d: 3.8, sp: 3.5, r: 0.8, gap: 3.2 });
    const back = path([[50, 110], [100, 86], [160, 78], [220, 82], [256, 96]]);
    gold(ctx, back, 0.8, { smoothIt: false });
    swirlFlames(ctx, 250, 214, 18, Math.PI + 0.1, { n: 3, len: 40, spin: -1, seed: 205 });
    swirlFlames(ctx, 66, 196, 20, -0.1, { n: 3, len: 42, spin: 1, seed: 206 });
    // skin wrinkles
    for (let i = 0; i < 6; i++) {
      const x = 118 + i * 20;
      dots(ctx, [[x + 6, 96], [x - 2, 160], [x + 4, 236]], { spacing: 3.4, r: 0.7, seed: 207 + i });
      gold(ctx, [[x + 11, 100], [x + 3, 160], [x + 9, 232]], 0.5);
    }
    if (royal) {
      // saddle cloth with krajang hem and medallions
      dye(ctx, poly(clothPts), INK.red, 0.93);
      const c2 = inset(clothPts, 7);
      gold(ctx, poly(inset(clothPts, 1.6)), 0.9);
      dye(ctx, poly(c2), INK.green, 0.75);
      gold(ctx, poly(c2), 0.7);
      dotLine(ctx, inset(clothPts, 4.2), { closed: true, spacing: 3.2, r: 0.75, seed: 208, smoothIt: false });
      const c3 = inset(clothPts, 16);
      dye(ctx, poly(c3), INK.red, 0.9);
      gold(ctx, poly(c3), 0.6);
      dotFill(ctx, poly(inset(c3, 3)), [120, 70, 250, 210], { pattern: 'flowers', spacing: 11, r: 0.75, seed: 209 });
      for (const [x, y] of [[150, 110], [212, 110], [150, 164], [212, 164]]) prajamYam(ctx, x, y, 10, { color: INK.red, petal: INK.gold });
      prajamYam(ctx, 181, 137, 15, { color: INK.green, petal: INK.gold });
      hem(ctx, [[124, 198], [184, 206], [246, 196]], 9);
      // tassels drawn as punched cords
      for (const x of [132, 160, 188, 216, 240]) dots(ctx, [[x, 204], [x, 226]], { spacing: 2.6, r: 0.7, smoothIt: false });
      // howdah
      hide(ctx, howdah);
      dye(ctx, poly(inset(howdah, 1.6)), INK.gold, 0.55);
      gold(ctx, poly(inset(howdah, 1.2)), 0.7);
      const rail = inset(howdah, 4);
      dotLine(ctx, rail, { closed: true, spacing: 3, r: 0.7, seed: 210, smoothIt: false });
      for (let x = 140; x < 236; x += 12) cut(ctx, poly(inset(shape([[x, 44], [x + 8, 44], [x + 8, 62], [x, 62]], { t: 0.2, wob: 0 }), 0.5)));
      for (let x = 146; x < 236; x += 12) hole(ctx, x, 53, 1.2);
      lozenges(ctx, [[126, 66], [244, 66]], { size: 2.2, gap: 7, seed: 211 });
      kanok(ctx, 114, 20, 14, -2.2, true, { color: INK.red });
      kanok(ctx, 257, 20, 14, -0.9, false, { color: INK.red });
    } else {
      flowers(ctx, [[110, 90], [250, 90], [250, 180], [110, 180]], 12, { seed: 212, inner: 0, minD: 18, r: 0.8 });
      strap(ctx, [[140, 72], [146, 140], [150, 250]], 7, { color: INK.crimson, seed: 213 });
    }
  });

  const headPts = shape([[258, 92], [274, 74], [296, 60], [320, 53], [343, 57], [361, 70], [375, 92], [385, 122], [390, 150], [391, 172], [383, 190], [370, 199], [354, 201], [342, 197], [330, 205], [312, 201], [294, 186], [276, 170], [262, 142]], { wob: 0.8, seed: 214 });
  const earPts = shape([[322, 94], [300, 88], [280, 96], [270, 120], [274, 156], [286, 186], [302, 212], [314, 214], [318, 196], [326, 160], [330, 122]], { t: 0.45, wob: 0.8, seed: 215 });
  const head = piece(N + '-head', [headPts], (ctx) => {
    hide(ctx, headPts);
    trim(ctx, headPts, { rows: 3, seed: 216, d: 3.6, sp: 3.4, r: 0.78, gap: 3.1 });
    beastEye(ctx, 348, 112, 5, { angle: 0.35 });
    ink(ctx, [[336, 104], [346, 102], [358, 108]], 0.8);
    // temple swirl & forehead
    spiral(ctx, 336, 82, 10, { seed: 217, dir: 1 });
    if (royal) {
      // gold net headdress over the domes
      const net = shape([[300, 66], [322, 58], [344, 62], [362, 76], [374, 100], [382, 128], [372, 132], [352, 96], [330, 78], [306, 80]], { t: 0.4, wob: 0.2 });
      dye(ctx, poly(net), INK.gold, 0.6);
      gold(ctx, poly(net), 0.8);
      ctx.save();
      ctx.clip(poly(inset(net, 1.5)));
      for (let k = -8; k < 12; k++) {
        gold(ctx, [[280 + k * 9, 40], [360 + k * 9, 140]], 0.6, { smoothIt: false });
        gold(ctx, [[380 + k * 9, 40], [300 + k * 9, 140]], 0.6, { smoothIt: false });
      }
      ctx.restore();
      dotFill(ctx, poly(inset(net, 2)), [296, 54, 384, 134], { pattern: 'diamond', spacing: 6.4, r: 0.9, seed: 218 });
      krajangRow(ctx, [[298, 62], [322, 52], [346, 56], [364, 70]], 8, { color: INK.gold, inner: INK.red });
      // neck band with bells
      strap(ctx, [[266, 96], [270, 140], [286, 184]], 8, { color: INK.red, seed: 219 });
    } else {
      for (let i = 0; i < 4; i++) dots(ctx, [[300 + i * 16, 66 + i * 2], [308 + i * 14, 110], [320 + i * 12, 150]], { spacing: 3.3, r: 0.72, seed: 220 + i });
    }
    // mouth
    slit(ctx, [[362, 196], [352, 192], [344, 196]], 0.8);
    // window under the ear (the ear's lace needs lamp light behind it)
    cut(ctx, poly(inset(earPts, 10)));
    knot(ctx, 270, 140, 3.4);
  });
  const ear = piece(N + '-ear', [earPts], (ctx) => {
    hide(ctx, earPts);
    trim(ctx, earPts, { rows: 2, seed: 222, d: 3.2, r: 0.75 });
    const inner = inset(earPts, 10);
    if (royal) dye(ctx, poly(inner), INK.red, 0.85);
    gold(ctx, poly(inner), 0.7);
    dotLine(ctx, inset(earPts, 12.5), { closed: true, spacing: 3, r: 0.65, seed: 223, smoothIt: false });
    // veins as lace
    for (let k = 0; k < 5; k++) {
      const a = 2.1 + k * 0.28;
      const L = 60 + k * 10;
      const pts = [[318, 104], [318 + Math.cos(a) * L * 0.5 + 6, 104 + Math.sin(a) * L * 0.5], [318 + Math.cos(a) * L, 104 + Math.sin(a) * L]];
      gold(ctx, pts, 0.6);
      dots(ctx, offset(path(pts), 2.2).slice(3), { spacing: 3, r: 0.62, seed: 224 + k, smoothIt: false });
    }
    dotFill(ctx, poly(inset(earPts, 16)), [270, 90, 330, 214], { pattern: 'flowers', spacing: 9, r: 0.7, seed: 229 });
    knot(ctx, 320, 102, 3);
  });

  const tr = [
    { s: [[376, 158], [388, 194], [396, 230]], r: [24, 20.5, 17.5] },
    { s: [[396, 226], [401, 246], [404, 266]], r: [17.5, 15.5, 14] },
    { s: [[404, 262], [406, 282], [406, 300]], r: [14, 12.5, 11] },
    { s: [[406, 296], [406, 318], [410, 336], [420, 344], [430, 338], [430, 330]], r: [11, 9.5, 8, 6.5, 5, 4] },
  ];
  const trunk = tr.map((t, i) => {
    const o = tube(t.s, t.r);
    return piece(N + '-trunk' + (i + 1), [o], (ctx) => {
      hide(ctx, o);
      trim(ctx, o, { d: 2.8, r: 0.66, seed: 230 + i });
      const sp = path(t.s);
      for (let k = 3; k < sp.length - 3; k += 3) {
        const p = sp[k], q = sp[k + 1];
        const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2;
        const rr = lerp(t.r[0], t.r[t.r.length - 1], k / sp.length) * 0.62;
        slit(ctx, [[p[0] - Math.cos(a) * rr, p[1] - Math.sin(a) * rr], [p[0] + Math.cos(a) * rr * 0.2, p[1] + Math.sin(a) * rr * 0.2 + 1.2], [p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr]], 0.7);
      }
      if (royal && i < 2) band(ctx, [[t.s[0][0] - t.r[0] * 0.9, t.s[0][1] + 8], [t.s[0][0] + t.r[0] * 0.9, t.s[0][1] + 12]], 3, { color: INK.gold, dots: true });
      if (i === 0) {
        hole(ctx, 0, 0, 0);
      }
      knot(ctx, t.s[0][0], t.s[0][1] + 4, 2.8);
    });
  });
  const ts = [[366, 190], [384, 205], [404, 211], [424, 203]];
  const tuskPts = tube(ts, [5.2, 4.8, 3.4, 1.1]);
  const tusk = piece(N + '-tusk', [tuskPts], (ctx) => {
    hide(ctx, tuskPts);
    dye(ctx, poly(inset(tuskPts, 0.9)), INK.cream, 0.9);
    if (royal) {
      for (const t of [0.18, 0.42]) {
        const sp = path(ts);
        const p = sp[Math.floor(t * sp.length)];
        gold(ctx, [[p[0] - 2, p[1] - 5], [p[0] + 1, p[1] + 5]], 2.2, { smoothIt: false });
      }
      dye(ctx, poly(tube([[410, 210], [424, 203]], [3, 1.1])), INK.gold, 0.9);
    }
  });

  const bands = royal ? [0.7] : [];
  const mk = (id, up, upR, lo, loR, far, seed) => leg(N + id, { up, upR, lo, loR, foot: 'pad', fw: 56, fh: 14, far, seed, bands, dotR: 0.75 });
  const lFN = mk('-fn', [[268, 226], [270, 262], [271, 300]], [30, 27, 24], [[271, 298], [270, 330], [269, 356]], [23.5, 24, 25], false, 240);
  const lFF = mk('-ff', [[246, 226], [247, 262], [248, 300]], [28, 25, 22], [[248, 298], [247, 330], [246, 356]], [22, 22.5, 23.5], true, 244);
  const lBN = mk('-bn', [[84, 226], [94, 264], [90, 300]], [34, 27, 23], [[90, 298], [88, 330], [87, 356]], [22.5, 23, 24.5], false, 248);
  const lBF = mk('-bf', [[106, 226], [115, 264], [111, 300]], [32, 25, 22], [[111, 298], [109, 330], [108, 356]], [21.5, 22, 23.5], true, 252);
  // pad feet are wider than the leg: use cloven-less custom foot
  const tailPts = tube([[40, 128], [30, 168], [25, 210], [26, 240]], [6, 4.4, 3.4, 3]);
  const tP = tuftPts(26, 238, 32, 12, Math.PI / 2 + 0.05, { teeth: 4 });
  const tail = piece(N + '-tail', [tailPts, tP], (ctx) => {
    hide(ctx, tailPts);
    dots(ctx, path([[38, 134], [29, 176], [26, 230]]), { spacing: 3.3, r: 0.6, smoothIt: false });
    tuft(ctx, tP, 26, 238, 32, Math.PI / 2 + 0.05, { color: royal ? INK.red : undefined });
  });

  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 3 },
    head: { pc: head, z: 2, parent: 'body', j: [270, 140], lim: [-0.25, 0.25], stiff: 0.7 },
    ear: { pc: ear, z: 3, parent: 'head', j: [320, 102], lim: [-0.1, 0.1], stiff: 0.3 },
    trunk1: { pc: trunk[0], z: 3, parent: 'head', j: [376, 162], lim: [-0.4, 0.5], stiff: 0.45 },
    trunk2: { pc: trunk[1], z: 3, parent: 'trunk1', j: [396, 230], lim: [-0.6, 0.6], stiff: 0.35 },
    trunk3: { pc: trunk[2], z: 3, parent: 'trunk2', j: [404, 266], lim: [-0.7, 0.7], stiff: 0.3 },
    trunk4: { pc: trunk[3], z: 3, parent: 'trunk3', j: [406, 300], lim: [-0.9, 0.9], stiff: 0.25 },
    tusk: { pc: tusk, z: 6, parent: 'head', j: [368, 191], lim: [-0.02, 0.02], stiff: 1 },
    tail: { pc: tail, z: -1, parent: 'body', j: [40, 128], lim: [-0.8, 0.8], stiff: 0.2 },
    ...legJoints('legFR', lFN, 4, 5, { lim: [-0.5, 0.5], stiff: 0.7 }),
    ...legJoints('legFL', lFF, -3, -2, { lim: [-0.5, 0.5], stiff: 0.7 }),
    ...legJoints('legBR', lBN, 4, 5, { lim: [-0.5, 0.5], stiff: 0.7 }),
    ...legJoints('legBL', lBF, -3, -2, { lim: [-0.5, 0.5], stiff: 0.7 }),
  }, {
    sound: 'animal-elephant',
    gait: quadGait(0.2, 0.16, [
      { part: 'trunk1', amp: 0.08, phase: 0 }, { part: 'trunk2', amp: 0.12, phase: 0.1 },
      { part: 'trunk3', amp: 0.16, phase: 0.2 }, { part: 'trunk4', amp: 0.22, phase: 0.3 },
      { part: 'ear', amp: 0.06, phase: 0.25 }, { part: 'tail', amp: 0.2, phase: 0.4 },
    ]),
  });
}

// หมู — Thai black pig: sway back, pot belly, snout disc, curly tail.
function pig() {
  const N = 'mu';
  const bodyPts = shape([[22, 42], [40, 33], [70, 38], [100, 42], [126, 32], [144, 32], [152, 40], [156, 60], [152, 78], [142, 88], [112, 96], [76, 95], [48, 88], [30, 80], [18, 62]], { wob: 0.6, seed: 301 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    trim(ctx, bodyPts, { rows: 2, seed: 302 });
    // bristle crest
    slits(ctx, offset(path([[34, 38], [70, 42], [100, 46], [130, 36], [148, 36]]), 2.5), { len: 3.4, gap: 2.4, ang: -2.6, seed: 303 });
    swirlFlames(ctx, 134, 60, 9, Math.PI - 0.4, { n: 3, len: 20, spin: -1, seed: 304 });
    swirlFlames(ctx, 38, 58, 10, -0.3, { n: 3, len: 22, spin: 1, seed: 305 });
    // teats
    dots(ctx, [[70, 90], [96, 92], [124, 88]], { spacing: 8, r: 1.1, seed: 306 });
    gold(ctx, [[60, 84], [96, 88], [132, 82]], 0.5);
    flowers(ctx, [[70, 50], [112, 50], [112, 76], [70, 76]], 4, { seed: 307, inner: 0, minD: 12 });
    dots(ctx, [[62, 54], [80, 60], [104, 58]], { spacing: 3, seed: 308 });
  });
  const headPts = shape([[144, 36], [156, 31], [170, 36], [184, 46], [196, 54], [203, 58], [205, 70], [197, 76], [184, 80], [170, 83], [156, 81], [148, 70], [145, 52]], { wob: 0.5, seed: 309 });
  const earPts = shape([[158, 38], [162, 17], [168, 22], [176, 34]], { t: 0.35, wob: 0.2, seed: 310 });
  const head = piece(N + '-head', [headPts, earPts], (ctx) => {
    hide(ctx, headPts);
    trim(ctx, headPts, { seed: 311 });
    hide(ctx, earPts);
    field(ctx, earPts, INK.pink, { d: 2, alpha: 0.75 });
    const disc = new Path2D();
    disc.ellipse(202, 65, 3.4, 7, 0, 0, TAU);
    dye(ctx, disc, INK.pink, 0.8);
    gold(ctx, disc, 0.6);
    hole(ctx, 202, 62, 0.9); hole(ctx, 202, 68, 0.9);
    beastEye(ctx, 176, 51, 3.2, { angle: 0.3 });
    ink(ctx, [[172, 44], [180, 42], [186, 46]], 0.6);
    slit(ctx, [[196, 76], [188, 78], [180, 76]], 0.7);
    for (let i = 0; i < 3; i++) slit(ctx, [[184 + i * 4, 52], [186 + i * 4, 60]], 0.55);
    dots(ctx, [[152, 58], [160, 72], [176, 78]], { spacing: 3, seed: 312 });
    knot(ctx, 152, 62, 2);
  });
  const mk = (id, sp, r, far, seed) => leg1(N + id, { spine: sp, radii: r, foot: 'cloven', fw: 11, fh: 7, far, seed });
  const lFN = mk('-fn', [[140, 80], [142, 94], [143, 103]], [9, 6.5, 5.5], false, 320);
  const lFF = mk('-ff', [[128, 80], [129, 94], [130, 103]], [8.5, 6.2, 5.3], true, 322);
  const lBN = mk('-bn', [[40, 76], [44, 92], [44, 103]], [11, 7, 5.5], false, 324);
  const lBF = mk('-bf', [[54, 76], [57, 92], [57, 103]], [10, 6.6, 5.3], true, 326);
  const tailPts = tube([[23, 46], [12, 42], [6, 50], [11, 58], [18, 53], [16, 47]], [3, 2.6, 2.3, 2, 1.8, 1.3]);
  const tail = piece(N + '-tail', [tailPts], (ctx) => { hide(ctx, tailPts); });
  const L = (L1, z) => ({ pc: L1.pc, z, parent: 'body', j: L1.joint, lim: [-0.7, 0.7], stiff: 0.6 });
  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 1.6 },
    head: { pc: head, z: 2, parent: 'body', j: [152, 62], lim: [-0.35, 0.35], stiff: 0.6 },
    tail: { pc: tail, z: -1, parent: 'body', j: [23, 46], lim: [-0.8, 0.8], stiff: 0.25 },
    legFR: L(lFN, 4), legFL: L(lFF, -3), legBR: L(lBN, 4), legBL: L(lBF, -3),
  }, { sound: 'animal-pig', gait: quadGait(0.4, 0, [{ part: 'tail', amp: 0.3, phase: 0 }, { part: 'head', amp: 0.08, phase: 0.25 }]) });
}

// ไก่ชน — fighting cock, the famous ไก่เหลืองหางขาว: golden hackles and
// saddle, black breast, white lace-cut sickle tail.
function rooster() {
  const N = 'kai-chon';
  const bodyPts = shape([[30, 60], [38, 52], [48, 50], [54, 45], [58, 36], [62, 27], [67, 21], [76, 22], [80, 32], [84, 46], [88, 62], [85, 77], [76, 88], [68, 95], [64, 102], [53, 102], [48, 93], [37, 84], [28, 71]], { wob: 0.4, seed: 401 });
  const wing = shape([[44, 58], [68, 55], [80, 64], [74, 76], [58, 82], [40, 80], [30, 74], [38, 66]], { t: 0.45, wob: 0.3, seed: 402 });
  const hackles = [];
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const root = [67 - 16 * t + 2, 23 + 25 * t];
    const a = 2.05 + t * 0.35;
    const L = 17 - 4 * t;
    hackles.push([root, [root[0] + Math.cos(a - 0.12) * L * 0.55, root[1] + Math.sin(a - 0.12) * L * 0.55], [root[0] + Math.cos(a) * L, root[1] + Math.sin(a) * L]]);
  }
  const saddle = [];
  for (let i = 0; i < 5; i++) {
    const root = [44 - i * 2.4, 56 + i * 2];
    saddle.push([root, [root[0] - 6, root[1] + 10], [root[0] - 8 + i, root[1] + 22 - i * 1.5]]);
  }
  const body = piece(N + '-body', [bodyPts, [[18, 40], [30, 90]]], (ctx) => {
    hide(ctx, bodyPts);
    trim(ctx, bodyPts, { seed: 403, d: 2.8, sp: 2.9, r: 0.55 });
    // breast scale-feathers
    ctx.save();
    ctx.clip(poly(inset(bodyPts, 3)));
    for (let y = 44; y < 96; y += 4.2) for (let x = 56 + ((y / 4.2) % 2) * 2.2; x < 90; x += 4.4) {
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 0.55;
      ctx.beginPath(); ctx.arc(x, y, 2, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    // wing
    dye(ctx, poly(wing), INK.orange, 0.55);
    gold(ctx, poly(wing), 0.55);
    for (let k = 0; k < 6; k++) slit(ctx, [[70 - k * 5, 60 + k * 1], [60 - k * 5, 72 + k * 1.2], [48 - k * 3.4, 80 - k * 0.4]], 0.55);
    dotLine(ctx, [[46, 62], [60, 59], [74, 62]], { spacing: 2.6, r: 0.55 });
    dotLine(ctx, [[44, 66], [60, 64], [76, 67]], { spacing: 2.6, r: 0.55, seed: 3 });
    // feathered thigh
    gold(ctx, [[66, 84], [60, 92], [54, 100]], 0.5);
    slits(ctx, [[70, 86], [62, 96]], { len: 3, gap: 2.4, ang: 2.2, seed: 404 });
    for (const h of saddle) feather(ctx, h, 3.6, { color: INK.yellow, alpha: 0.85, seed: 405 });
    for (const h of hackles) feather(ctx, h, 4.2, { color: INK.yellow, alpha: 0.88, seed: 406 });
    for (const h of hackles.slice(0, 6)) gold(ctx, h, 0.4);
    knot(ctx, 70, 23, 1.6);
  });
  const headPts = shape([[63, 25], [63, 16], [66, 10], [69, 5], [72, 7], [75, 3], [78, 6], [81, 7], [84, 10], [89, 12], [93, 16], [88, 18], [84, 18], [84, 23], [81, 28], [77, 29], [74, 26], [69, 27]], { t: 0.4, wob: 0.15, seed: 407 });
  const head = piece(N + '-head', [headPts], (ctx) => {
    hide(ctx, headPts);
    const comb = new Path2D(); comb.rect(60, 0, 26, 9.5);
    dye(ctx, comb, INK.red, 0.9);
    const wat = new Path2D(); wat.ellipse(81, 23, 3.2, 5, 0.2, 0, TAU);
    dye(ctx, wat, INK.red, 0.9);
    const lobe = new Path2D(); lobe.ellipse(72, 17, 2.4, 3, 0, 0, TAU);
    dye(ctx, lobe, INK.vermilion, 0.9);
    const beak = poly([[84, 10], [93, 16], [84, 18]]);
    dye(ctx, beak, INK.yellow, 0.8);
    beastEye(ctx, 78, 12, 2.2, { style: 'round' });
    slit(ctx, [[85, 15.5], [91, 16]], 0.45, { smoothIt: false });
    dots(ctx, [[66, 14], [67, 22]], { spacing: 2.4, r: 0.45 });
  });
  // white sickle tail
  const sick = [
    { s: [[33, 56], [24, 36], [12, 26], [-2, 30], [-12, 46], [-14, 70]], w: 5.4, c: INK.cream },
    { s: [[33, 58], [22, 42], [8, 38], [-4, 50], [-8, 70], [-6, 90]], w: 5, c: INK.cream },
    { s: [[33, 60], [22, 50], [10, 52], [0, 64], [-1, 86]], w: 4.4, c: INK.cream },
    { s: [[34, 58], [27, 42], [24, 24], [26, 10]], w: 4.4, c: INK.cream },
    { s: [[33, 62], [22, 62], [14, 72], [12, 92]], w: 4, c: INK.teal },
    { s: [[33, 64], [26, 70], [22, 84], [22, 100]], w: 3.6, c: INK.teal },
  ];
  const outl = sick.map((f) => f.s).flat();
  const tail = piece(N + '-tail', [outl.map(([x, y]) => [x - 6, y]), outl.map(([x, y]) => [x + 6, y + 4])], (ctx) => {
    for (let i = sick.length - 1; i >= 0; i--) feather(ctx, sick[i].s, sick[i].w, { color: sick[i].c, alpha: 0.8, seed: 410 + i, lace: true });
    knot(ctx, 33, 60, 1.8);
  });
  const mk = (id, dx, far, seed) => leg1(N + id, { spine: [[58 + dx, 96], [60 + dx, 106], [61 + dx, 114]], radii: [3.4, 2.6, 2.3], foot: 'bird', fw: 11, fh: 4, far, seed, footColor: INK.yellow, spur: true, perf: false, pale: INK.yellow });
  const legR = mk('-r', 0, false, 420);
  const legL = mk('-l', -8, true, 422);
  return makeRig('animal', {
    body: { pc: body, z: 0 },
    head: { pc: head, z: 2, parent: 'body', j: [70, 24], lim: [-0.4, 0.4], stiff: 0.55 },
    tail: { pc: tail, z: -1, parent: 'body', j: [33, 60], lim: [-0.5, 0.5], stiff: 0.3 },
    legR: { pc: legR.pc, z: 2, parent: 'body', j: legR.joint, lim: [-0.7, 0.7], stiff: 0.6 },
    legL: { pc: legL.pc, z: -2, parent: 'body', j: legL.joint, lim: [-0.7, 0.7], stiff: 0.6 },
  }, {
    sound: 'animal-rooster',
    gait: [{ part: 'legR', amp: 0.45, phase: 0 }, { part: 'legL', amp: 0.45, phase: 0.5 }, { part: 'head', amp: 0.15, phase: 0 }, { part: 'tail', amp: 0.08, phase: 0.25 }],
  });
}

// แม่ไก่ — a speckled brown hen.
function hen() {
  const N = 'mae-kai';
  scaleFigure(0.95);
  const bodyPts = shape([[26, 46], [34, 38], [46, 35], [55, 28], [60, 19], [67, 14], [74, 16], [76, 26], [80, 38], [82, 52], [76, 66], [64, 74], [58, 80], [48, 80], [44, 74], [34, 68], [26, 58]], { wob: 0.4, seed: 501 });
  const tailF = [
    { s: [[30, 46], [22, 32], [18, 18]], w: 4.6 },
    { s: [[30, 48], [18, 36], [10, 30]], w: 4.4 },
    { s: [[30, 50], [16, 44], [8, 42]], w: 4 },
    { s: [[30, 52], [18, 52], [10, 56]], w: 3.6 },
  ];
  const body = piece(N + '-body', [bodyPts, ...tailF.map((f) => f.s)], (ctx) => {
    for (const f of tailF) feather(ctx, f.s, f.w, { color: INK.brown, alpha: 0.8, seed: 502 });
    hide(ctx, bodyPts);
    dye(ctx, poly(inset(bodyPts, 2)), INK.brown, 0.7);
    trim(ctx, bodyPts, { seed: 503, d: 2.8, sp: 2.9, r: 0.55 });
    dotFill(ctx, poly(inset(bodyPts, 5)), [26, 14, 84, 82], { pattern: 'rand', spacing: 4.2, r: 0.55, seed: 504 });
    const wing = shape([[40, 48], [62, 46], [72, 56], [62, 68], [42, 68], [32, 60]], { t: 0.45, wob: 0.2 });
    dye(ctx, poly(wing), INK.orange, 0.5);
    gold(ctx, poly(wing), 0.5);
    for (let k = 0; k < 5; k++) slit(ctx, [[64 - k * 5, 52], [56 - k * 5, 62], [46 - k * 3, 67]], 0.5);
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      feather(ctx, [[70 - 14 * t, 18 + 22 * t], [66 - 14 * t, 25 + 22 * t], [62 - 14 * t, 30 + 22 * t]], 3.2, { color: INK.orange, alpha: 0.85, seed: 505 + i, barbs: false });
    }
    knot(ctx, 69, 17, 1.4);
  });
  const headPts = shape([[61, 20], [61, 12], [64, 7], [66, 3], [69, 4], [71, 1], [74, 3], [77, 6], [80, 8], [85, 11], [80, 13], [78, 17], [76, 21], [72, 21], [68, 20]], { t: 0.4, wob: 0.1, seed: 506 });
  const head = piece(N + '-head', [headPts], (ctx) => {
    hide(ctx, headPts);
    dye(ctx, poly(inset(headPts, 0.8)), INK.brown, 0.6);
    const comb = new Path2D(); comb.rect(60, -2, 22, 7.5); dye(ctx, comb, INK.red, 0.9);
    const wat = new Path2D(); wat.ellipse(77, 17, 2, 3.2, 0.2, 0, TAU); dye(ctx, wat, INK.red, 0.9);
    dye(ctx, poly([[79, 8], [85, 11], [79, 13]]), INK.yellow, 0.85);
    beastEye(ctx, 73, 9, 1.9, { style: 'round' });
  });
  const mk = (id, dx, far, seed) => leg1(N + id, { spine: [[52 + dx, 74], [53 + dx, 81], [54 + dx, 86]], radii: [3, 2.2, 2], foot: 'bird', fw: 8.5, fh: 3, far, seed, footColor: INK.yellow, perf: false, pale: INK.yellow });
  const legR = mk('-r', 0, false, 510);
  const legL = mk('-l', -7, true, 512);
  return makeRig('animal', {
    body: { pc: body, z: 0 },
    head: { pc: head, z: 2, parent: 'body', j: [68, 18], lim: [-0.4, 0.4], stiff: 0.55 },
    legR: { pc: legR.pc, z: 2, parent: 'body', j: legR.joint, lim: [-0.7, 0.7], stiff: 0.6 },
    legL: { pc: legL.pc, z: -2, parent: 'body', j: legL.joint, lim: [-0.7, 0.7], stiff: 0.6 },
  }, {
    sound: 'animal-hen',
    gait: [{ part: 'legR', amp: 0.45, phase: 0 }, { part: 'legL', amp: 0.45, phase: 0.5 }, { part: 'head', amp: 0.18, phase: 0 }],
  });
}

// ลูกไก่ — a fluffy yellow chick.
function chick() {
  const N = 'luk-kai';
  const r = rng(5);
  const fluff = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
    const k = i % 2 ? 1.08 : 0.94;
    fluff.push([16 + Math.cos(a) * 11 * k, 17 + Math.sin(a) * 9 * k + (r() - 0.5)]);
  }
  const bodyPts = curve(fluff, true, 3, 0.4);
  const body = piece(N + '-body', [bodyPts, [[2, 12], [8, 14]]], (ctx) => {
    hide(ctx, poly([[7, 14], [1, 12], [6, 18]]) && [[7, 14], [1, 12], [6, 18]]);
    hide(ctx, bodyPts);
    dye(ctx, poly(inset(bodyPts, 1.2)), INK.yellow, 0.88);
    gold(ctx, poly(inset(bodyPts, 1)), 0.4);
    const wing = shape([[10, 16], [20, 15], [22, 20], [14, 23]], { t: 0.4, wob: 0 });
    dye(ctx, poly(wing), INK.orange, 0.6);
    dots(ctx, inset(bodyPts, 2.6), { closed: true, spacing: 2.4, r: 0.45, smoothIt: false });
  });
  const headPts = shape([[20, 8], [22, 3], [27, 1], [31, 3], [33, 6], [37, 7], [33, 9], [31, 12], [25, 13], [21, 12]], { t: 0.45, wob: 0.1 });
  const head = piece(N + '-head', [headPts], (ctx) => {
    hide(ctx, headPts);
    dye(ctx, poly(inset(headPts, 0.8)), INK.yellow, 0.88);
    dye(ctx, poly([[32, 5], [37, 7], [32, 9]]), INK.orange, 0.9);
    hole(ctx, 29, 5.5, 0.9);
  });
  const mk = (id, dx, far) => leg1(N + id, { spine: [[17 + dx, 24], [17.5 + dx, 28], [18 + dx, 30]], radii: [1.3, 1, 0.9], foot: 'bird', fw: 4.5, fh: 2, far, footColor: INK.orange, perf: false, pale: INK.orange });
  const legR = mk('-r', 0, false);
  const legL = mk('-l', -4, true);
  return makeRig('animal', {
    body: { pc: body, z: 0 },
    head: { pc: head, z: 2, parent: 'body', j: [23, 11], lim: [-0.4, 0.4], stiff: 0.5 },
    legR: { pc: legR.pc, z: 2, parent: 'body', j: [17, 24], lim: [-0.7, 0.7], stiff: 0.6 },
    legL: { pc: legL.pc, z: -2, parent: 'body', j: [13, 24], lim: [-0.7, 0.7], stiff: 0.6 },
  }, {
    sound: 'animal-hen',
    gait: [{ part: 'legR', amp: 0.5, phase: 0 }, { part: 'legL', amp: 0.5, phase: 0.5 }, { part: 'head', amp: 0.2, phase: 0 }],
  });
}

// เป็ด — a field duck (เป็ดไล่ทุ่ง): green-sheened head, white collar,
// blue speculum, orange bill and webbed feet.
function duck() {
  const N = 'pet';
  scaleFigure(1.05);
  const bodyPts = shape([[8, 36], [20, 43], [40, 44], [54, 41], [58, 32], [58, 21], [60, 13], [68, 13], [69, 23], [67, 33], [73, 46], [71, 59], [60, 67], [40, 69], [24, 64], [14, 52]], { wob: 0.35, seed: 601 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    trim(ctx, bodyPts, { seed: 602, d: 2.8, sp: 2.9, r: 0.55 });
    const wing = shape([[26, 48], [54, 46], [64, 53], [54, 61], [30, 60], [16, 52]], { t: 0.45, wob: 0.2, seed: 603 });
    dye(ctx, poly(wing), INK.brown, 0.6);
    gold(ctx, poly(wing), 0.55);
    const spec = shape([[30, 52], [46, 51], [48, 56], [30, 57]], { t: 0.3, wob: 0 });
    dye(ctx, poly(spec), INK.blue, 0.9);
    dots(ctx, [[30, 50], [48, 49]], { spacing: 2.4, r: 0.5 });
    dots(ctx, [[30, 58.5], [48, 58]], { spacing: 2.4, r: 0.5 });
    for (let k = 0; k < 5; k++) slit(ctx, [[54 - k * 6, 48], [48 - k * 6, 55], [38 - k * 4.6, 59]], 0.5);
    // white collar ring
    dots(ctx, [[58, 22], [63, 23], [69, 22]], { spacing: 1.8, r: 0.65 });
    const neck = shape([[58, 11], [69, 11], [69, 21], [58, 21]], { t: 0.2, wob: 0 });
    dye(ctx, poly(neck), INK.jade, 0.75);
    dotFill(ctx, poly(inset(bodyPts, 4)), [20, 28, 74, 68], { pattern: 'scales', spacing: 5, r: 0.5 });
    knot(ctx, 63, 15, 1.4);
  });
  const headPts = shape([[57, 15], [57, 7], [62, 1], [70, 0], [74, 4], [76, 8], [88, 11], [89, 14.5], [77, 16], [70, 17], [62, 17]], { t: 0.45, wob: 0.15, seed: 604 });
  const head = piece(N + '-head', [headPts], (ctx) => {
    hide(ctx, headPts);
    dye(ctx, poly(inset(headPts, 0.8)), INK.jade, 0.8);
    const bill = shape([[74, 7], [88, 11], [89, 14.5], [76, 15.5]], { t: 0.3, wob: 0 });
    dye(ctx, poly(bill), INK.orange, 0.9);
    slit(ctx, [[77, 12.5], [88, 13]], 0.45, { smoothIt: false });
    hole(ctx, 80, 10.5, 0.5);
    beastEye(ctx, 67, 6.5, 1.8, { style: 'round' });
    gold(ctx, [[60, 11], [70, 12]], 0.4);
  });
  const mk = (id, dx, far) => leg1(N + id, { spine: [[46 + dx, 64], [47 + dx, 72], [48 + dx, 77]], radii: [3.2, 2.2, 1.9], foot: 'web', fw: 11, fh: 3, far, footColor: INK.orange, perf: false, pale: INK.orange });
  const legR = mk('-r', 0, false);
  const legL = mk('-l', -9, true);
  return makeRig('animal', {
    body: { pc: body, z: 0 },
    head: { pc: head, z: 2, parent: 'body', j: [63, 15], lim: [-0.4, 0.4], stiff: 0.55 },
    legR: { pc: legR.pc, z: 2, parent: 'body', j: legR.joint, lim: [-0.7, 0.7], stiff: 0.6 },
    legL: { pc: legL.pc, z: -2, parent: 'body', j: legL.joint, lim: [-0.7, 0.7], stiff: 0.6 },
  }, {
    sound: 'animal-duck',
    gait: [{ part: 'legR', amp: 0.5, phase: 0 }, { part: 'legL', amp: 0.5, phase: 0.5 }, { part: 'head', amp: 0.12, phase: 0.25 }],
  });
}

// หมาไทย — Thai ridgeback: prick ears, lean body, reverse-hair ridge with
// twin crowns, sickle tail, red collar with a bell.
function dog() {
  const N = 'ma-thai';
  scaleFigure(1.05);
  const bodyPts = shape([[30, 50], [50, 44], [90, 48], [114, 42], [128, 34], [140, 24], [150, 17], [158, 24], [155, 40], [147, 56], [141, 70], [131, 84], [116, 88], [96, 82], [76, 75], [62, 80], [44, 82], [30, 74], [25, 60]], { wob: 0.5, seed: 701 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    trim(ctx, bodyPts, { rows: 2, seed: 702, d: 3, gap: 2.5, sp: 3, r: 0.6 });
    // ridge: reversed hair with two crowns
    const ridge = path([[56, 50], [80, 52], [104, 48], [118, 44]]);
    line(ctx, offset(ridge, 3.5), INK.crimson, 4, { smoothIt: false, alpha: 0.75 });
    slits(ctx, offset(ridge, 3.5), { len: 3, gap: 2.2, ang: -2.7, seed: 703, w: 0.55 });
    spiral(ctx, 108, 50, 3.5, { turns: 1.5, seed: 704 });
    spiral(ctx, 116, 47, 3.5, { turns: 1.5, seed: 705, dir: -1 });
    swirlFlames(ctx, 128, 64, 8, Math.PI - 0.4, { n: 3, len: 18, spin: -1, seed: 706 });
    swirlFlames(ctx, 48, 62, 10, -0.2, { n: 3, len: 22, spin: 1, seed: 707 });
    for (let i = 0; i < 4; i++) dots(ctx, [[86 + i * 8, 58], [84 + i * 8, 70], [88 + i * 7, 80]], { spacing: 3, r: 0.55, seed: 708 + i });
    strap(ctx, [[146, 22], [150, 38], [144, 54]], 4.6, { color: INK.red, seed: 712 });
    const bell = new Path2D(); bell.arc(146, 58, 3.2, 0, TAU);
    dye(ctx, bell, INK.gold, 0.9); gold(ctx, bell, 0.5); hole(ctx, 146, 59, 0.8);
    knot(ctx, 152, 24, 1.8);
  });
  const headPts = shape([[146, 16], [148, 8], [151, -7], [156, 0], [160, 8], [167, 10], [178, 15], [188, 21], [194, 25], [194, 30], [187, 33], [176, 34], [166, 36], [158, 33], [151, 28]], { t: 0.45, wob: 0.3, seed: 713 });
  const head = piece(N + '-head', [headPts], (ctx) => {
    hide(ctx, headPts);
    trim(ctx, headPts, { seed: 714, d: 2.6, sp: 2.8, r: 0.55 });
    const earIn = shape([[150, 7], [152, -3], [157, 6]], { t: 0.3, wob: 0 });
    dye(ctx, poly(earIn), INK.pink, 0.8);
    beastEye(ctx, 172, 17, 2.8, { angle: 0.25 });
    ink(ctx, [[166, 12], [174, 11], [180, 14]], 0.55);
    const nose = new Path2D(); nose.ellipse(192, 26.5, 2.6, 2.2, 0, 0, TAU);
    dye(ctx, nose, '#000', 0.6); hole(ctx, 192.5, 27, 0.6);
    dots(ctx, [[160, 24], [174, 26], [186, 28]], { spacing: 2.8, r: 0.5 });
    slit(ctx, [[176, 32], [186, 31.5]], 0.5, { smoothIt: false });
  });
  const jawPts = shape([[164, 33], [176, 33], [188, 32], [186, 36], [176, 40], [166, 39]], { t: 0.4, wob: 0.1, seed: 715 });
  const jaw = piece(N + '-jaw', [jawPts], (ctx) => {
    hide(ctx, jawPts);
    dots(ctx, [[170, 36], [182, 35]], { spacing: 2.6, r: 0.45 });
  });
  const mk = (id, up, upR, lo, far, seed) => leg(N + id, { up, upR, lo, loR: [3.8, 3.3, 3.2], foot: 'paw', fw: 10, fh: 4.5, far, seed, bands: [], dotR: 0.55 });
  const lFN = mk('-fn', [[124, 78], [126, 92], [127, 102]], [7.5, 5.5, 4.2], [[127, 101], [128, 109], [130, 115]], false, 720);
  const lFF = mk('-ff', [[116, 78], [117, 92], [118, 102]], [7, 5.2, 4], [[118, 101], [119, 109], [121, 115]], true, 722);
  const lBN = mk('-bn', [[52, 72], [47, 90], [40, 100]], [11, 6.5, 4.2], [[40, 99], [42, 108], [44, 115]], false, 724);
  const lBF = mk('-bf', [[62, 72], [57, 90], [50, 100]], [10, 6.2, 4], [[50, 99], [52, 108], [54, 115]], true, 726);
  const tailPts = tube([[29, 53], [17, 45], [11, 31], [14, 17], [22, 10]], [3.8, 3.4, 2.8, 2.1, 1.1]);
  const tail = piece(N + '-tail', [tailPts], (ctx) => {
    hide(ctx, tailPts);
    dots(ctx, path([[27, 51], [17, 42], [13, 28], [17, 16]]), { spacing: 2.8, r: 0.5, smoothIt: false });
  });
  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 1.2 },
    head: { pc: head, z: 2, parent: 'body', j: [152, 24], lim: [-0.45, 0.4], stiff: 0.55 },
    jaw: { pc: jaw, z: 1, parent: 'head', j: [165, 35], lim: [-0.05, 0.5], stiff: 0.7 },
    tail: { pc: tail, z: -1, parent: 'body', j: [29, 53], lim: [-0.6, 0.6], stiff: 0.3 },
    ...legJoints('legFR', lFN, 4, 5),
    ...legJoints('legFL', lFF, -3, -2),
    ...legJoints('legBR', lBN, 4, 5),
    ...legJoints('legBL', lBF, -3, -2),
  }, { sound: 'animal-dog', gait: quadGait(0.42, 0.3, [{ part: 'tail', amp: 0.3, phase: 0 }]), limbs: { jaw: 'jaw', head: 'head' } });
}

// แมววิเชียรมาศ — Siamese cat: pale body, seal-brown points, sapphire eyes.
function cat() {
  const N = 'maeo';
  scaleFigure(1.05);
  const SEAL = '#3b2616';
  const bodyPts = shape([[22, 42], [40, 35], [70, 37], [92, 32], [102, 35], [107, 44], [105, 56], [96, 64], [70, 68], [46, 66], [30, 61], [20, 51]], { wob: 0.4, seed: 801 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    dye(ctx, poly(inset(bodyPts, 1.8)), grad(ctx, 0, 32, 0, 70, [[0, INK.cream], [0.75, '#e9d3a6'], [1, '#b89468']]), 0.88);
    dye(ctx, poly(inset(bodyPts, 1.8)), grad(ctx, 16, 0, 110, 0, [[0, 'rgba(59,38,22,0.7)'], [0.18, 'rgba(59,38,22,0)'], [0.82, 'rgba(59,38,22,0)'], [1, 'rgba(59,38,22,0.55)']]), 1);
    trim(ctx, bodyPts, { seed: 802, d: 2.6, sp: 2.8, r: 0.55 });
    ink(ctx, [[94, 38], [98, 50], [96, 60]], 0.6);
    ink(ctx, [[40, 42], [32, 52], [36, 62]], 0.6);
    spiral(ctx, 36, 52, 6, { seed: 803, turns: 1.6 });
    spiral(ctx, 94, 50, 5, { seed: 804, turns: 1.6, dir: -1 });
    for (let i = 0; i < 5; i++) dots(ctx, [[52 + i * 8, 42], [50 + i * 8, 52], [53 + i * 8, 62]], { spacing: 3, r: 0.5, seed: 805 + i });
  });
  const headPts = shape([[98, 36], [97, 26], [100, 19], [103, 6], [110, 15], [115, 18], [121, 23], [125, 29], [127, 33], [124, 36], [118, 39], [110, 41], [103, 41]], { t: 0.45, wob: 0.2, seed: 810 });
  const farEar = shape([[108, 16], [114, 4], [117, 17]], { t: 0.3, wob: 0 });
  const head = piece(N + '-head', [headPts, farEar], (ctx) => {
    hide(ctx, farEar);
    hide(ctx, headPts);
    dye(ctx, poly(inset(headPts, 1.4)), grad(ctx, 97, 0, 126, 0, [[0, INK.cream], [0.35, '#d9bb8a'], [0.62, SEAL], [1, SEAL]]), 0.9);
    const earIn = shape([[102, 20], [104, 9], [108, 17]], { t: 0.3, wob: 0 });
    dye(ctx, poly(earIn), INK.pink, 0.55);
    // sapphire almond eye with a slit pupil
    const e = new Path2D();
    e.moveTo(112, 25); e.quadraticCurveTo(115.5, 21.5, 119.5, 23.6); e.quadraticCurveTo(116, 27.2, 112, 25);
    dye(ctx, e, '#5aa0e0', 1);
    gold(ctx, e, 0.5);
    ink(ctx, [[116, 22.5], [116.2, 26.4]], 0.9, 1);
    hole(ctx, 118.3, 24, 0.45);
    slit(ctx, [[121, 37], [124, 35.5]], 0.45, { smoothIt: false });
    dots(ctx, [[102, 30], [108, 36]], { spacing: 2.4, r: 0.45 });
    for (const dy of [-1.2, 0.6, 2.2]) gold(ctx, [[122, 33], [130, 32 + dy * 1.6]], 0.3, { smoothIt: false });
  });
  const mk = (id, up, upR, lo, far, seed) => leg(N + id, { up, upR, lo, loR: [3.2, 2.9, 2.8], foot: 'paw', fw: 8, fh: 3.6, far, seed, bands: [], dotR: 0.5 });
  const lFN = mk('-fn', [[96, 58], [98, 70], [99, 78]], [6, 4.5, 3.6], [[99, 77], [100, 83], [101, 87]], false, 820);
  const lFF = mk('-ff', [[88, 58], [89, 70], [90, 78]], [5.6, 4.2, 3.4], [[90, 77], [91, 83], [92, 87]], true, 822);
  const lBN = mk('-bn', [[36, 56], [31, 70], [27, 78]], [9, 5.5, 3.6], [[27, 77], [28, 83], [29, 87]], false, 824);
  const lBF = mk('-bf', [[46, 56], [41, 70], [37, 78]], [8.4, 5.2, 3.4], [[37, 77], [38, 83], [39, 87]], true, 826);
  const tails = [
    { s: [[22, 44], [12, 38], [6, 27]], r: [3.6, 3.3, 3.1] },
    { s: [[6, 28], [3, 16], [7, 5]], r: [3.1, 2.9, 2.7] },
    { s: [[7, 6], [13, -3], [21, -5]], r: [2.7, 2.3, 1.5] },
  ];
  const tailPcs = tails.map((t, i) => {
    const o = tube(t.s, t.r);
    return piece(N + '-tail' + i, [o], (ctx) => {
      hide(ctx, o);
      if (i === 0) dye(ctx, poly(inset(o, 0.8)), grad(ctx, 22, 0, 6, 0, [[0, '#caa577'], [1, 'rgba(0,0,0,0)']]), 0.7);
      dots(ctx, path(t.s), { spacing: 2.6, r: 0.45, smoothIt: false, seed: 830 + i });
      if (i) knot(ctx, t.s[0][0], t.s[0][1], 1.2);
    });
  });
  return makeRig('animal', {
    body: { pc: body, z: 0 },
    head: { pc: head, z: 2, parent: 'body', j: [102, 38], lim: [-0.45, 0.4], stiff: 0.55 },
    tail: { pc: tailPcs[0], z: -1, parent: 'body', j: [22, 44], lim: [-0.7, 0.7], stiff: 0.25 },
    tail2: { pc: tailPcs[1], z: -1, parent: 'tail', j: [6, 28], lim: [-0.8, 0.8], stiff: 0.2 },
    tail3: { pc: tailPcs[2], z: -1, parent: 'tail2', j: [7, 6], lim: [-0.9, 0.9], stiff: 0.15 },
    ...legJoints('legFR', lFN, 4, 5),
    ...legJoints('legFL', lFF, -3, -2),
    ...legJoints('legBR', lBN, 4, 5),
    ...legJoints('legBL', lBF, -3, -2),
  }, { sound: 'animal-cat', gait: quadGait(0.38, 0.28, [{ part: 'tail', amp: 0.12, phase: 0 }, { part: 'tail2', amp: 0.18, phase: 0.15 }, { part: 'tail3', amp: 0.25, phase: 0.3 }]) });
}

// ม้า — a royal Thai horse: flame-cut mane, red harness with bells,
// saddle-cloth with krajang lace, tall plume and flowing lace tail.
function horse() {
  const N = 'ma';
  const bodyPts = shape([[48, 96], [70, 88], [110, 98], [150, 94], [168, 86], [182, 90], [190, 110], [190, 140], [184, 160], [160, 168], [112, 170], [82, 162], [66, 166], [44, 152], [32, 126], [36, 104]], { wob: 0.7, seed: 901 });
  const saddle = shape([[104, 94], [128, 96], [156, 90], [164, 104], [164, 146], [132, 152], [100, 146], [98, 108]], { t: 0.4, wob: 0.4, seed: 902 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    trim(ctx, bodyPts, { rows: 2, seed: 903 });
    swirlFlames(ctx, 56, 124, 14, -0.25, { n: 3, len: 30, spin: 1, seed: 904 });
    ink(ctx, [[70, 110], [58, 140], [66, 160]], 0.7);
    dye(ctx, poly(saddle), INK.red, 0.92);
    gold(ctx, poly(inset(saddle, 1.3)), 0.8);
    const s2 = inset(saddle, 6);
    dye(ctx, poly(s2), INK.green, 0.8);
    gold(ctx, poly(s2), 0.6);
    dotLine(ctx, inset(saddle, 3.6), { closed: true, spacing: 3, r: 0.62, seed: 905, smoothIt: false });
    dotFill(ctx, poly(inset(s2, 3)), [98, 88, 166, 152], { pattern: 'flowers', spacing: 9, r: 0.65, seed: 906 });
    prajamYam(ctx, 132, 122, 10, { color: INK.red, petal: INK.gold });
    hem(ctx, [[100, 146], [132, 152], [164, 146]], 7);
    // seat
    const seat = shape([[112, 90], [150, 86], [148, 96], [114, 98]], { t: 0.4, wob: 0.2 });
    hide(ctx, seat);
    gold(ctx, poly(inset(seat, 1)), 0.6);
    strap(ctx, [[104, 100], [74, 92], [48, 102]], 4.2, { color: INK.red, seed: 907 });
    strap(ctx, [[162, 150], [168, 160], [172, 166]], 3.5, { color: INK.red, seed: 908, loz: false });
  });
  const neckPts = shape([[164, 86], [176, 66], [192, 46], [208, 31], [221, 21], [232, 26], [236, 40], [230, 58], [218, 80], [210, 104], [208, 130], [200, 154], [188, 160], [180, 140], [176, 112], [168, 98]], { wob: 0.6, seed: 910 });
  const crest = path([[221, 22], [208, 31], [192, 46], [176, 66], [166, 84]]);
  const mane = resample(crest, 9).slice(0, 7);
  const neck = piece(N + '-neck', [neckPts, ...mane.map(([x, y]) => [[x - 24, y - 20], [x, y]])], (ctx) => {
    mane.forEach(([x, y, a], i) => kanok(ctx, x - 2, y + 4, 22 - i * 0.8, a - Math.PI / 2 - 0.55, false, { color: i % 2 ? INK.red : INK.gold }));
    hide(ctx, neckPts);
    trim(ctx, neckPts, { rows: 2, seed: 911 });
    swirlFlames(ctx, 194, 130, 11, Math.PI - 0.2, { n: 3, len: 24, spin: -1, seed: 912 });
    strap(ctx, [[216, 40], [226, 58], [224, 74], [212, 100], [204, 130], [196, 152]], 5.5, { color: INK.red, seed: 913 });
    for (const [x, y] of [[222, 70], [212, 96], [205, 122], [198, 146]]) {
      const b = new Path2D(); b.arc(x + 4.5, y + 3, 3, 0, TAU);
      dye(ctx, b, INK.gold, 0.9); gold(ctx, b, 0.45); hole(ctx, x + 4.5, y + 4, 0.8);
    }
    for (let i = 0; i < 4; i++) dots(ctx, [[196 + i * 4, 52 + i * 8], [186 + i * 6, 80], [184 + i * 5, 110]], { spacing: 3, r: 0.55, seed: 914 + i });
    knot(ctx, 228, 32, 2);
  });
  const headPts = shape([[222, 20], [224, 8], [228, 0], [233, 10], [240, 16], [250, 30], [262, 50], [270, 63], [272, 74], [266, 80], [256, 80], [246, 74], [238, 62], [230, 50], [224, 36]], { t: 0.45, wob: 0.4, seed: 920 });
  const plume = tuftPts(229, 9, 32, 11, -1.95, { teeth: 4, seed: 921 });
  const head = piece(N + '-head', [headPts, plume], (ctx) => {
    tuft(ctx, plume, 229, 9, 32, -1.95, { color: INK.red });
    hide(ctx, headPts);
    trim(ctx, headPts, { seed: 922, d: 2.8 });
    beastEye(ctx, 242, 34, 3.4, { angle: 0.8 });
    hole(ctx, 267, 70, 1.1);
    slit(ctx, [[268, 78], [260, 77]], 0.6);
    // bridle
    strap(ctx, [[232, 24], [236, 44], [246, 66], [258, 76]], 3.4, { color: INK.red, seed: 923, loz: false });
    strap(ctx, [[252, 44], [268, 62]], 3.4, { color: INK.red, seed: 924, loz: false });
    rosette(ctx, 252, 60, 3.4);
    rosette(ctx, 232, 26, 3);
    dots(ctx, [[244, 26], [258, 44], [266, 58]], { spacing: 2.8, r: 0.55 });
  });
  const mk = (id, up, upR, lo, far, seed) => leg(N + id, { up, upR, lo, loR: [5.6, 4.6, 5.4], foot: 'hoof', fw: 14, fh: 10, far, seed, bands: [0.62] });
  const lFN = mk('-fn', [[186, 146], [188, 172], [190, 196]], [12, 8.5, 6.5], [[190, 195], [191, 222], [191, 242]], false, 930);
  const lFF = mk('-ff', [[172, 146], [174, 172], [176, 196]], [11.5, 8, 6.2], [[176, 195], [177, 222], [177, 242]], true, 932);
  const lBN = mk('-bn', [[62, 148], [70, 172], [56, 198]], [16, 10, 6.5], [[56, 197], [58, 222], [60, 242]], false, 934);
  const lBF = mk('-bf', [[76, 148], [84, 172], [70, 198]], [15, 9.5, 6.2], [[70, 197], [72, 222], [74, 242]], true, 936);
  const tP = tuftPts(38, 104, 112, 30, 1.92, { teeth: 6, seed: 940 });
  const tail = piece(N + '-tail', [tP], (ctx) => {
    tuft(ctx, tP, 38, 104, 112, 1.92);
    const c = Math.cos(1.92), s2 = Math.sin(1.92);
    for (let k = -2; k <= 2; k++) {
      const q = (u, v) => [38 + c * u - s2 * v, 104 + s2 * u + c * v];
      dots(ctx, [q(18, k * 3.2), q(56, k * 5.2), q(94, k * 3.4)], { spacing: 3, r: 0.55, seed: 941 + k });
    }
    band(ctx, [[30, 108], [46, 112]], 5, { color: INK.red });
  });
  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 2 },
    neck: { pc: neck, z: 1, parent: 'body', j: [176, 110], lim: [-0.3, 0.25], stiff: 0.7 },
    head: { pc: head, z: 2, parent: 'neck', j: [228, 32], lim: [-0.4, 0.4], stiff: 0.6 },
    tail: { pc: tail, z: -1, parent: 'body', j: [40, 104], lim: [-0.6, 0.6], stiff: 0.2 },
    ...legJoints('legFR', lFN, 4, 5),
    ...legJoints('legFL', lFF, -3, -2),
    ...legJoints('legBR', lBN, 4, 5),
    ...legJoints('legBL', lBF, -3, -2),
  }, { sound: 'animal-horse', gait: quadGait(0.34, 0.3, [{ part: 'head', amp: 0.08, phase: 0.1 }, { part: 'tail', amp: 0.15, phase: 0.3 }]) });
}

// ลิง — a small macaque on all fours, tail curled high.
function monkey() {
  const N = 'ling';
  scaleFigure(1.1);
  const bodyPts = shape([[24, 46], [34, 36], [54, 30], [76, 31], [88, 37], [95, 47], [93, 58], [82, 64], [60, 66], [40, 63], [26, 57]], { wob: 0.4, seed: 1001 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    trim(ctx, bodyPts, { seed: 1002, d: 2.8, sp: 2.9, r: 0.55 });
    for (let i = 0; i < 4; i++) slits(ctx, offset(path([[30, 42], [54, 34], [80, 36], [92, 44]]), 3 + i * 4), { len: 2.8, gap: 3, ang: 2.6, seed: 1003 + i });
    swirlFlames(ctx, 38, 52, 7, -0.3, { n: 3, len: 14, spin: 1, seed: 1008 });
    const belly = shape([[48, 60], [80, 58], [86, 62], [60, 64]], { t: 0.4, wob: 0 });
    dye(ctx, poly(belly), INK.skin, 0.4);
  });
  const headPts = shape([[88, 35], [88, 25], [94, 16], [104, 13], [112, 17], [118, 23], [122, 31], [120, 40], [112, 44], [102, 46], [94, 43]], { t: 0.5, wob: 0.2, seed: 1010 });
  const head = piece(N + '-head', [headPts], (ctx) => {
    hide(ctx, headPts);
    const face = shape([[106, 19], [114, 20], [120, 28], [121, 36], [114, 42], [104, 42], [102, 32]], { t: 0.5, wob: 0.1 });
    dye(ctx, poly(face), INK.skin, 0.85);
    gold(ctx, poly(face), 0.45);
    ink(ctx, [[105, 23], [111, 21], [118, 25]], 0.9);
    beastEye(ctx, 112, 27, 2.2, { style: 'round' });
    hole(ctx, 120.5, 32, 0.6);
    // grin with teeth
    slit(ctx, [[110, 38], [115, 39], [120, 37]], 1.1);
    ink(ctx, [[111, 38.4], [111, 39.4]], 0.4, 1); ink(ctx, [[114, 38.8], [114, 39.8]], 0.4, 1); ink(ctx, [[117, 38.6], [117, 39.6]], 0.4, 1);
    const ear = new Path2D(); ear.arc(98, 29, 3.4, 0, TAU);
    gold(ctx, ear, 0.5); hole(ctx, 98, 29, 1.2);
    slits(ctx, [[92, 20], [100, 15], [108, 15]], { len: 3, gap: 2.2, ang: -2.2, seed: 1011 });
    dots(ctx, inset(headPts, 2).slice(26, 60), { spacing: 2.6, r: 0.45, smoothIt: false });
  });
  const mkA = (id, up, lo, far, seed) => leg(N + id, { up, upR: [5.6, 4.4, 3.6], lo, loR: [3.4, 3.1, 3], foot: 'hand', fw: 8, fh: 3.5, far, seed, bands: [], dotR: 0.5 });
  const aN = mkA('-an', [[86, 56], [89, 66], [92, 74]], [[92, 73], [93, 80], [94, 84]], false, 1020);
  const aF = mkA('-af', [[78, 56], [80, 66], [82, 74]], [[82, 73], [83, 80], [84, 84]], true, 1022);
  const mkL = (id, up, lo, far, seed) => leg(N + id, { up, upR: [8.5, 6.5, 4.6], lo, loR: [4.2, 3.6, 3.2], foot: 'hand', fw: 10, fh: 3.5, far, seed, bands: [], dotR: 0.5 });
  const lN = mkL('-ln', [[36, 52], [44, 62], [49, 70]], [[49, 69], [45, 77], [41, 84]], false, 1024);
  const lF = mkL('-lf', [[46, 52], [54, 62], [59, 70]], [[59, 69], [55, 77], [51, 84]], true, 1026);
  const tails = [
    { s: [[25, 46], [16, 36], [12, 24]], r: [3, 2.7, 2.4] },
    { s: [[12, 25], [12, 13], [19, 5]], r: [2.4, 2.2, 2] },
    { s: [[18, 6], [26, 3], [29, 10], [23, 13], [21, 9]], r: [2, 1.8, 1.6, 1.3, 1] },
  ];
  const tailPcs = tails.map((t, i) => {
    const o = tube(t.s, t.r);
    return piece(N + '-tail' + i, [o], (ctx) => {
      hide(ctx, o);
      dots(ctx, path(t.s), { spacing: 2.5, r: 0.42, smoothIt: false, seed: 1030 + i });
    });
  });
  return makeRig('animal', {
    body: { pc: body, z: 0 },
    head: { pc: head, z: 2, parent: 'body', j: [92, 40], lim: [-0.5, 0.5], stiff: 0.5 },
    tail: { pc: tailPcs[0], z: -1, parent: 'body', j: [25, 46], lim: [-0.7, 0.7], stiff: 0.25 },
    tail2: { pc: tailPcs[1], z: -1, parent: 'tail', j: [12, 25], lim: [-0.8, 0.8], stiff: 0.2 },
    tail3: { pc: tailPcs[2], z: -1, parent: 'tail2', j: [18, 6], lim: [-0.9, 0.9], stiff: 0.15 },
    ...legJoints('legFR', aN, 4, 5),
    ...legJoints('legFL', aF, -3, -2),
    ...legJoints('legBR', lN, 4, 5),
    ...legJoints('legBL', lF, -3, -2),
  }, { sound: 'animal-monkey', gait: quadGait(0.45, 0.3, [{ part: 'tail2', amp: 0.2, phase: 0.1 }, { part: 'tail3', amp: 0.3, phase: 0.25 }, { part: 'head', amp: 0.1, phase: 0.5 }]) });
}

// ปลาช่อน — striped snakehead, swimming: three body segments and a tail.
function snakehead() {
  const N = 'pla-chon';
  const segs = [
    { id: 'body', ctrl: [[96, 16], [118, 14], [134, 16], [146, 21], [153, 28], [151, 34], [144, 38], [130, 43], [112, 45], [96, 45], [92, 30]] },
    { id: 'body2', ctrl: [[60, 17], [80, 15], [102, 15], [106, 30], [102, 45], [80, 45], [60, 43], [56, 30]] },
    { id: 'body3', ctrl: [[28, 20], [46, 18], [66, 17], [70, 30], [66, 43], [46, 42], [28, 40], [24, 30]] },
  ];
  const fins = [
    [[62, 16], [80, 14], [104, 14], [104, 8], [82, 8], [62, 10]],
    [[28, 20], [48, 17], [66, 16], [66, 10], [46, 12], [28, 15]],
    [[30, 40], [48, 42], [62, 42], [62, 48], [46, 48], [30, 45]],
  ];
  const pcs = {};
  segs.forEach((sg, i) => {
    const o = shape(sg.ctrl, { t: 0.45, wob: 0.3, seed: 1101 + i });
    const f1 = i > 0 ? shape(fins[i - 1], { t: 0.3, wob: 0.2, seed: 1110 + i }) : null;
    const f2 = i === 2 ? shape(fins[2], { t: 0.3, wob: 0.2, seed: 1115 }) : null;
    const extra = [f1, f2].filter(Boolean);
    pcs[sg.id] = piece(N + '-' + sg.id, [o, ...extra], (ctx) => {
      for (const f of extra) {
        hide(ctx, f);
        dye(ctx, poly(inset(f, 0.8)), INK.teal, 0.5);
        const [a, b] = [f[0], f[Math.floor(f.length / 2)]];
        for (let k = 0; k < 7; k++) slit(ctx, [[lerp(a[0], b[0], (k + 0.5) / 7), a[1] + (f === f2 ? 1 : -1)], [lerp(a[0], b[0], (k + 0.5) / 7) - 2, a[1] + (f === f2 ? 5 : -5)]], 0.5, { smoothIt: false });
      }
      hide(ctx, o);
      const belly = poly(inset(o, 2));
      dye(ctx, belly, grad(ctx, 0, 14, 0, 46, [[0, 'rgba(0,0,0,0)'], [0.45, 'rgba(62,143,92,0.35)'], [1, 'rgba(230,187,63,0.7)']]), 1);
      trim(ctx, o, { seed: 1120 + i, d: 2.6, sp: 2.8, r: 0.55 });
      scales(ctx, o, { d: 4.5, spacing: 5.2, w: 0.55 });
      // dark blotch bands
      for (let x = 30 + i * 36; x < 150; x += 14) ink(ctx, [[x, 18], [x - 4, 26], [x + 1, 34]], 3.4, 0.55);
      gold(ctx, [[sg.ctrl[0][0], 30], [sg.ctrl[2][0], 29]], 0.5, { smoothIt: false });
      if (i === 0) {
        beastEye(ctx, 138, 25, 2.8, { style: 'round' });
        slit(ctx, [[152, 30], [145, 31], [140, 30]], 0.6);
        gold(ctx, [[124, 17], [120, 30], [124, 42]], 0.7);
        dots(ctx, [[121, 19], [117, 30], [121, 41]], { spacing: 2.6, r: 0.5 });
      } else knot(ctx, sg.ctrl[2][0] - 4, 30, 1.8);
    });
  });
  const tailPts = shape([[30, 22], [20, 24], [10, 16], [2, 14], [-2, 30], [2, 46], [10, 44], [20, 36], [30, 38]], { t: 0.4, wob: 0.3, seed: 1130 });
  pcs.tail = piece(N + '-tail', [tailPts], (ctx) => {
    hide(ctx, tailPts);
    dye(ctx, poly(inset(tailPts, 1.2)), INK.teal, 0.45);
    trim(ctx, tailPts, { seed: 1131, d: 2.2, sp: 2.6, r: 0.5 });
    for (let k = 0; k < 7; k++) slit(ctx, [[22, 30], [8, 18 + k * 4]], 0.5, { smoothIt: false });
    knot(ctx, 26, 30, 1.6);
  });
  const finPts = shape([[118, 38], [124, 40], [118, 52], [108, 56], [110, 46]], { t: 0.4, wob: 0.2, seed: 1132 });
  pcs.fin = piece(N + '-fin', [finPts], (ctx) => {
    hide(ctx, finPts);
    dye(ctx, poly(inset(finPts, 0.8)), INK.yellow, 0.45);
    for (let k = 0; k < 4; k++) slit(ctx, [[118, 41], [110 + k * 2.5, 52 - k]], 0.45, { smoothIt: false });
  });
  return makeRig('animal', {
    body: { pc: pcs.body, z: 0 },
    body2: { pc: pcs.body2, z: -1, parent: 'body', j: [100, 30], lim: [-0.35, 0.35], stiff: 0.45 },
    body3: { pc: pcs.body3, z: -2, parent: 'body2', j: [64, 30], lim: [-0.4, 0.4], stiff: 0.4 },
    tail: { pc: pcs.tail, z: -3, parent: 'body3', j: [28, 30], lim: [-0.6, 0.6], stiff: 0.3 },
    fin: { pc: pcs.fin, z: 1, parent: 'body', j: [118, 40], lim: [-0.5, 0.5], stiff: 0.3 },
  }, {
    float: true,
    gait: [{ part: 'body2', amp: 0.12, phase: 0 }, { part: 'body3', amp: 0.18, phase: 0.14 }, { part: 'tail', amp: 0.32, phase: 0.28 }, { part: 'fin', amp: 0.35, phase: 0.5 }],
  });
}

// ปลาทอง — a fancy goldfish with flowing lace fins.
function goldfish() {
  const N = 'pla-thong';
  const bodyPts = shape([[40, 30], [50, 17], [68, 10], [86, 13], [99, 23], [104, 33], [98, 44], [84, 52], [64, 54], [48, 48]], { t: 0.5, wob: 0.3, seed: 1201 });
  const dorsal = shape([[56, 16], [60, 2], [70, -6], [76, -2], [74, 6], [82, 12]], { t: 0.4, wob: 0.2, seed: 1202 });
  const body = piece(N + '-body', [bodyPts, dorsal], (ctx) => {
    hide(ctx, dorsal);
    dye(ctx, poly(inset(dorsal, 0.8)), INK.orange, 0.8);
    for (let k = 0; k < 6; k++) slit(ctx, [[60 + k * 3.6, 14], [62 + k * 2.4, 2 + k * 0.8]], 0.5, { smoothIt: false });
    hide(ctx, bodyPts);
    dye(ctx, poly(inset(bodyPts, 1.6)), INK.orange, 0.92);
    const patch = shape([[60, 18], [80, 16], [86, 30], [70, 36], [56, 30]], { t: 0.5, wob: 0.8, seed: 1203 });
    dye(ctx, poly(patch), INK.vermilion, 0.75);
    trim(ctx, bodyPts, { seed: 1204, d: 2.8, sp: 2.8, r: 0.55 });
    scales(ctx, bodyPts, { d: 4.5, spacing: 5, w: 0.55 });
    const gill = path([[88, 18], [84, 32], [88, 46]]);
    gold(ctx, gill, 0.7);
    dots(ctx, offset(gill, -2), { spacing: 2.4, r: 0.5, smoothIt: false });
    beastEye(ctx, 94, 27, 3.4, { style: 'round' });
    slit(ctx, [[103, 36], [99, 37]], 0.6, { smoothIt: false });
  });
  const tailPts = shape([[44, 28], [34, 20], [22, 10], [14, 8], [18, 20], [22, 32], [18, 46], [14, 58], [24, 54], [34, 44], [44, 38]], { t: 0.4, wob: 0.3, seed: 1210 });
  const tail = piece(N + '-tail', [tailPts], (ctx) => {
    hide(ctx, tailPts);
    dye(ctx, poly(inset(tailPts, 1)), INK.orange, 0.85);
    for (let k = 0; k < 9; k++) slit(ctx, [[40, 33], [18 + (k % 2) * 2, 12 + k * 5.2]], 0.5, { smoothIt: false });
    dotLine(ctx, inset(tailPts, 2.4), { closed: true, spacing: 2.6, r: 0.5, smoothIt: false });
    knot(ctx, 42, 33, 1.8);
  });
  const t2 = shape([[22, 12], [8, 0], [-6, -2], [-12, 8], [-4, 18], [-10, 30], [-6, 46], [-12, 58], [-4, 68], [8, 64], [20, 54], [22, 32]], { t: 0.45, wob: 0.6, seed: 1211 });
  const tail2 = piece(N + '-tail2', [t2], (ctx) => {
    hide(ctx, t2);
    dye(ctx, poly(inset(t2, 1)), grad(ctx, 22, 0, -12, 0, [[0, INK.orange], [1, INK.yellow]]), 0.85);
    for (let k = 0; k < 12; k++) slit(ctx, [[20, 33], [-4 + (k % 3) * 2, -1 + k * 5.6]], 0.5, { smoothIt: false });
    dotFill(ctx, poly(inset(t2, 3)), [-12, -2, 22, 68], { pattern: 'rand', spacing: 4, r: 0.55, seed: 1212 });
    gold(ctx, poly(inset(t2, 1)), 0.45);
  });
  const finPts = shape([[80, 46], [86, 50], [80, 62], [70, 66], [72, 54]], { t: 0.4, wob: 0.2, seed: 1213 });
  const fin = piece(N + '-fin', [finPts], (ctx) => {
    hide(ctx, finPts);
    dye(ctx, poly(inset(finPts, 0.8)), INK.orange, 0.8);
    for (let k = 0; k < 4; k++) slit(ctx, [[80, 49], [72 + k * 2.5, 62 - k]], 0.45, { smoothIt: false });
  });
  return makeRig('animal', {
    body: { pc: body, z: 0 },
    tail: { pc: tail, z: -1, parent: 'body', j: [42, 33], lim: [-0.45, 0.45], stiff: 0.3 },
    tail2: { pc: tail2, z: -2, parent: 'tail', j: [20, 33], lim: [-0.6, 0.6], stiff: 0.2 },
    fin: { pc: fin, z: 1, parent: 'body', j: [80, 48], lim: [-0.5, 0.5], stiff: 0.3 },
  }, {
    float: true,
    gait: [{ part: 'tail', amp: 0.28, phase: 0 }, { part: 'tail2', amp: 0.35, phase: 0.2 }, { part: 'fin', amp: 0.35, phase: 0.5 }],
  });
}

// Diagonal-pair walk: FR+BL together, FL+BR half a cycle later; lower
// segments lag a quarter cycle so the knees flex.
function quadGait(amp = 0.32, lower = 0.25, extra = []) {
  const g = [];
  const legs = [['legFR', 0], ['legBL', 0], ['legFL', 0.5], ['legBR', 0.5]];
  for (const [id, ph] of legs) {
    g.push({ part: id, amp, phase: ph });
    if (lower) g.push({ part: id + '2', amp: lower, phase: ph + 0.25 });
  }
  return [...g, ...extra];
}

export const PROPS = [
  { id: 'kwai', name: 'ควาย', en: 'Water buffalo', cat: 'animals', build: buffalo },
  { id: 'wua-khao', name: 'วัวขาว', en: 'White ox (Royal Ploughing)', cat: 'animals', build: whiteOx },
  { id: 'chang', name: 'ช้าง', en: 'Elephant', cat: 'animals', build: () => elephant(false) },
  { id: 'chang-song', name: 'ช้างทรง', en: 'Royal caparisoned elephant', cat: 'animals', build: () => elephant(true) },
  { id: 'mu', name: 'หมู', en: 'Pig', cat: 'animals', build: pig },
  { id: 'kai-chon', name: 'ไก่ชน', en: 'Fighting cock', cat: 'animals', build: rooster },
  { id: 'mae-kai', name: 'แม่ไก่', en: 'Hen', cat: 'animals', build: hen },
  { id: 'luk-kai', name: 'ลูกไก่', en: 'Chick', cat: 'animals', build: chick },
  { id: 'pet', name: 'เป็ด', en: 'Duck', cat: 'animals', build: duck },
  { id: 'ma-thai', name: 'หมาไทย', en: 'Thai ridgeback dog', cat: 'animals', build: dog },
  { id: 'maeo-wichianmat', name: 'แมววิเชียรมาศ', en: 'Siamese cat', cat: 'animals', build: cat },
  { id: 'ma', name: 'ม้า', en: 'Royal horse', cat: 'animals', build: horse },
  { id: 'ling', name: 'ลิง', en: 'Monkey', cat: 'animals', build: monkey },
  { id: 'pla-chon', name: 'ปลาช่อน', en: 'Snakehead fish', cat: 'animals', build: snakehead },
  { id: 'pla-thong', name: 'ปลาทอง', en: 'Goldfish', cat: 'animals', build: goldfish },
];
