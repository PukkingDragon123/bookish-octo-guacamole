// ป่าไม้ใบหญ้า — trees and foliage cut as หนังตะลุง leather, articulated so
// the physics can sway them.
//
// Every tree is a Puppet rig of kind 'plant' (authored in the same figure
// coordinates as animals.js: facing right, ground at y = 0, up is -y). The
// trunk is the root body and is held by the Puppet's root pin (planted
// mode), so tall trees never fall over; branches, leaf clusters, fronds and
// hanging chains are child pieces on soft joints. swayFoliage() drives
// those joints every frame from the weather: a breath of motion when calm,
// a lean with gusts in 'wind', and a thrashing in 'storm'; hanging pieces
// (golden-shower chains, banyan roots, vines, fruit bunches) are free
// pendulums pushed by the wind.
//
// API
//   PROPS                      the prop defs (cat 'foliage')
//   onSpawnFoliage(actor, scene, { y }?)
//                              one-time setup after scene.addProp(); also
//                              available as def.onSpawn and def.rig.onSpawn.
//                              Marks actor.isPlant, turns collisions off
//                              (scenery), lightens branch gravity, hangs
//                              vines from the top of the cloth (or cloth y).
//   swayFoliage(scene, fx, dt, time)
//                              call once per frame (before or after
//                              scene.update). Lazily runs the setup on any
//                              plant it has not seen, so it also covers
//                              plants spawned without onSpawn.
//   isFoliage(actor)           true for plant rigs.

import {
  INK, leather, dye, line, gold, hole, holes, dotLine, slit, cut, curve, poly, smooth, inset, resample, rng,
  kanokPts, dotFlower, prajamYam, blobPts, ellipsePts, paintSprite, krajangRow,
} from '../art/leather.js';
import { piece, makeRig, tube, offset, spiral, lozenges } from './animals.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// Leaf-and-light palette: brighter than the stock dyes so the canopies glow
// like stained glass when the lamp shines through.
const C = {
  leaf: '#4f9e38', leaf2: '#6fb540', lime: '#a6d152', jade: '#2e9a6c', deep: '#2b6a35', moss: '#5f8f2c',
  olive: '#93a23a', teal: '#23867c', sun: '#f0c83e', amber: '#e7922d', rust: '#c9542b', copper: '#c86a34',
  ruby: '#d0283c', sapphire: '#2f64d0', emerald: '#1fa860', cream: '#f7eccb', white: '#fdf8ea',
  bark: '#7a4b27', grey: '#a89a80', pink: '#ec8ea3', plum: '#6e2c73', water: '#2a86a0', violet: '#8a4fc0',
};

// ------------------------------------------------------------ geometry
function area(pts) {
  let s = 0;
  for (let i = 0, n = pts.length; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; }
  return s;
}
// Append a closed outline to a Path2D with a consistent winding, so many
// overlapping shapes fill as one union.
function addPts(p, pts) {
  const q = area(pts) < 0 ? pts.slice().reverse() : pts;
  q.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}
function union(list) { const p = new Path2D(); list.forEach((q) => addPts(p, q)); return p; }
function addAlmond(p, x, y, len, wid, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const mx = x + c * len * 0.5, my = y + s * len * 0.5;
  p.moveTo(x, y);
  p.quadraticCurveTo(mx - s * wid, my + c * wid, x + c * len, y + s * len);
  p.quadraticCurveTo(mx + s * wid, my - c * wid, x, y);
  p.closePath();
}
function qbez(p0, p1, p2, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * t * u * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * t * u * p1[1] + t * t * p2[1]]);
  }
  return out;
}
function along(c, t) {
  const i = Math.min(c.length - 2, Math.max(0, Math.floor(t * (c.length - 1))));
  const a = c[i], b = c[i + 1], f = t * (c.length - 1) - i;
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), Math.atan2(b[1] - a[1], b[0] - a[0])];
}
function angMix(a, b, t) {
  let d = b - a;
  d -= TAU * Math.floor((d + Math.PI) / TAU);
  return a + d * t;
}
// Closed outline of a tapering limb along a spine (w = full width).
function limbPts(spine, w0, w1, capA = true, capB = true) {
  const n = spine.length;
  return tube(spine, spine.map((_, i) => Math.max(0.5, lerp(w0, w1, i / (n - 1)) / 2)), { steps: n > 2 ? 6 : 8, capA, capB });
}
const dense = (spine) => (spine.length > 2 ? curve(spine, false, 10) : resample(spine, 5).map(([x, y]) => [x, y]).concat([spine[1]]));
function pick(r, list) {
  let tot = 0;
  for (const [, w] of list) tot += w;
  let x = r() * tot;
  for (const [c, w] of list) { x -= w; if (x <= 0) return c; }
  return list[0][0];
}
const box = (x0, y0, x1, y1) => [[x0, y0], [x1, y1]];

// ------------------------------------------------------------ leaves
// Half outlines (u along the leaf 0..1 from the stalk, v across).
const HALF = {
  almond: [[0, 0], [0.12, 0.13], [0.35, 0.22], [0.62, 0.2], [0.85, 0.1], [1, 0]],
  lance: [[0, 0], [0.12, 0.08], [0.4, 0.13], [0.7, 0.11], [0.9, 0.05], [1, 0]],
  obovate: [[0, 0], [0.18, 0.1], [0.45, 0.22], [0.72, 0.31], [0.9, 0.25], [1, 0.07], [1.02, 0]],
  oval: [[0, 0], [0.1, 0.2], [0.35, 0.3], [0.7, 0.28], [0.92, 0.15], [1, 0]],
  heart: [[0, 0], [0.06, 0.24], [0.26, 0.42], [0.5, 0.44], [0.76, 0.31], [0.98, 0.13], [1.16, 0.04], [1.42, 0]],
  ovate: [[0, 0], [0.08, 0.26], [0.3, 0.37], [0.55, 0.31], [0.8, 0.16], [1, 0]],
  strap: [[0, 0], [0.05, 0.06], [0.3, 0.07], [0.7, 0.06], [0.95, 0.03], [1, 0]],
};
function leafPts(kind, x, y, s, ang, { bend = 0, flip = false, teeth = false } = {}) {
  if (kind === 'kanok') return kanokPts(x, y, s, ang, flip);
  const half = HALF[kind] || HALF.almond;
  const ctrl = [...half.map(([u, v]) => [u, v]), ...half.slice(1, -1).reverse().map(([u, v]) => [u, -v])];
  const c = Math.cos(ang), si = Math.sin(ang);
  let pts = curve(ctrl.map(([u, v]) => [u * s, (v + bend * Math.sin(Math.PI * Math.min(1, u))) * s]), true, 3, 0.5);
  if (teeth) {
    pts = pts.map(([u, v], i) => {
      const k = i % 2 ? 1 + 0.07 : 1;
      return [u, v * k];
    });
  }
  return pts.map(([u, v]) => [x + u * c - v * si, y + u * si + v * c]);
}
function leafLen(kind) { return kind === 'heart' ? 1.42 : 1; }

// Veins: a midrib and paired side veins cut clean through, so the lamp
// draws a bright line down every leaf.
function veinPath(P, l, kind, full = true) {
  const c = Math.cos(l.a), s = Math.sin(l.a), L = l.s * leafLen(kind);
  P.moveTo(l.x + c * L * 0.12, l.y + s * L * 0.12);
  P.lineTo(l.x + c * L * 0.84, l.y + s * L * 0.84);
  if (!full || l.s < 15) return;
  for (const t of [0.34, 0.56]) {
    const bx = l.x + c * L * t, by = l.y + s * L * t;
    for (const side of [-1, 1]) {
      const va = l.a + side * 0.72;
      const vl = l.s * (kind === 'lance' || kind === 'strap' ? 0.08 : 0.2);
      P.moveTo(bx, by);
      P.lineTo(bx + Math.cos(va) * vl, by + Math.sin(va) * vl);
    }
  }
}

// Scatter a lace of almond cut-outs through a clip region.
function laceCut(ctx, clipP, bb, base, size, seed = 1, keep = 0.85) {
  const r = rng(seed);
  const P = new Path2D();
  const [x0, y0, x1, y1] = bb;
  for (let y = y0, row = 0; y < y1; y += size * 0.78, row++) {
    for (let x = x0 + (row % 2) * size * 0.55; x < x1; x += size * 1.1) {
      if (r() > keep) continue;
      const a = Math.atan2(y - base[1], x - base[0]) + (row % 2 ? 0.55 : -0.55) + (r() - 0.5) * 0.3;
      addAlmond(P, x + (r() - 0.5) * size * 0.2, y + (r() - 0.5) * size * 0.2, size * 0.8, size * 0.24, a);
    }
  }
  ctx.save();
  ctx.clip(clipP);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(P);
  ctx.restore();
}

// Bark: toned hide, a gold line and a dot row down the limb, knife-cut
// grain slits.
function bark(ctx, spine, w0, w1, { seed = 1, tone = C.bark, alpha = 0.45, grain = true, dots = true } = {}) {
  const out = limbPts(spine, w0, w1);
  if (tone) dye(ctx, poly(inset(out, Math.min(3, w1 * 0.2))), tone, alpha);
  const c = dense(spine);
  const w = Math.min(w0, w1);
  if (w >= 6) gold(ctx, offset(c, w * 0.22).slice(1, -1), Math.min(1.1, w * 0.08), { smoothIt: false });
  if (dots && w >= 9) dotLine(ctx, offset(c, -w * 0.2).slice(1, -1), { spacing: 4.4, r: 0.85, seed, smoothIt: false });
  if (grain && w >= 14) {
    const r = rng(seed + 3);
    const rs = resample(c, 11);
    rs.forEach(([x, y, a], i) => {
      if (i < 1 || i > rs.length - 2) return;
      const t = i / rs.length, ww = lerp(w0, w1, t) * 0.5;
      const o = ((i % 3) - 1) * ww * 0.45 + (r() - 0.5) * 3;
      const nx = -Math.sin(a), ny = Math.cos(a), ca = Math.cos(a), sa = Math.sin(a);
      slit(ctx, [[x + nx * o, y + ny * o], [x + nx * (o + 1.2) + ca * 4, y + ny * (o + 1.2) + sa * 4], [x + nx * o + ca * 8, y + ny * o + sa * 8]], 0.8);
    });
  }
  return out;
}

// Leather limbs (trunks, boughs) cut as one piece and barked.
function limbs(ctx, list, opts = {}) {
  const paths = list.map(([s, w0, w1]) => limbPts(s, w0, w1));
  leather(ctx, union(paths));
  list.forEach(([s, w0, w1], i) => bark(ctx, s, w0, w1, { ...opts, seed: (opts.seed || 1) + i * 7 }));
  return paths;
}

// Palm-trunk ring scars.
function rings(ctx, spine, w0, w1, { step = 13, seed = 1, tone = '#8a6a44', alpha = 0.5 } = {}) {
  const out = limbPts(spine, w0, w1);
  leather(ctx, poly(out));
  dye(ctx, poly(inset(out, 2.5)), tone, alpha);
  const c = dense(spine);
  const acc = [0];
  for (let i = 1; i < c.length; i++) acc.push(acc[i - 1] + dist(c[i - 1], c[i]));
  const L = acc[acc.length - 1];
  const r = rng(seed);
  for (let d = step * 0.6; d < L - 4; d += step * (0.85 + r() * 0.3)) {
    const t = d / L;
    const [x, y, a] = along(c, t);
    const w = lerp(w0, w1, t) / 2 - 2.5;
    const nx = -Math.sin(a), ny = Math.cos(a);
    slit(ctx, [[x - nx * w, y - ny * w], [x + Math.cos(a) * 2.2, y + Math.sin(a) * 2.2], [x + nx * w, y + ny * w]], 1.05);
    if (r() < 0.5) hole(ctx, x - Math.cos(a) * step * 0.45 + nx * w * 0.3, y - Math.sin(a) * step * 0.45 + ny * w * 0.3, 0.9);
  }
  gold(ctx, offset(c, -lerp(w0, w1, 0.5) * 0.22).slice(2, -2), 0.8, { smoothIt: false });
  return out;
}

// Grass tuft of curving blades at a foot.
function tuft(ctx, x, y, s, seed = 1, color = C.leaf) {
  const r = rng(seed);
  const P = new Path2D();
  for (let k = -3; k <= 3; k++) {
    const a = -Math.PI / 2 + k * 0.3 + (r() - 0.5) * 0.2;
    const L = s * (0.6 + r() * 0.5) * (1 - Math.abs(k) * 0.09);
    const bx = x + k * s * 0.07;
    const tip = [bx + Math.cos(a) * L + k * 2, y + Math.sin(a) * L];
    const mid = [bx + Math.cos(a) * L * 0.5 + Math.sign(k) * L * 0.05, y + Math.sin(a) * L * 0.55];
    addPts(P, limbPts([[bx, y + 2], mid, tip], s * 0.11, 0.6, false, true));
  }
  leather(ctx, P);
  dye(ctx, P, color, 0.8);
}

// Grounding strip under a trunk: a mound with tufts.
function ground(ctx, x0, x1, seed = 1, h = 10) {
  const r = rng(seed);
  const pts = [[x0, 2], [x0 + 12, -h * 0.6], [lerp(x0, x1, 0.3), -h], [lerp(x0, x1, 0.7), -h], [x1 - 12, -h * 0.6], [x1, 2]];
  leather(ctx, smooth(pts));
  dotLine(ctx, [[x0 + 14, -h * 0.35], [lerp(x0, x1, 0.5), -h * 0.7], [x1 - 14, -h * 0.35]], { spacing: 4.4, r: 0.9, seed });
  for (let x = x0 + 10; x < x1 - 6; x += 26 + r() * 20) tuft(ctx, x, -h * 0.4, 16 + r() * 10, seed + x, r() < 0.5 ? C.leaf : C.moss);
}

// ------------------------------------------------------------ canopy
// A leaf cluster: a lace-cut backing mass (the dappled interior), the twigs
// that carry it, and a ruffle of individually cut, dyed, veined leaves.
//   lobes: [[x, y, rx, ry], ...]      base: [x, y] (the joint)
//   leaf: { kind, s, sj, droop, rim, inner, colors: [[col, w]...], alpha, veins, colorFn }
function canopy(ctx, r, sp) {
  const { lobes, base, leaf, back = C.deep, backA = 0.8, lace = 1, seed = 1 } = sp;
  const twigs = sp.twigs || lobes.map(([x, y]) => [[base, [lerp(base[0], x, 0.5) + (r() - 0.5) * 24, lerp(base[1], y, 0.6)], [x, y]], sp.tw0 ?? 12, sp.tw1 ?? 4]);
  const blobs = lobes.map(([x, y, rx, ry], i) => blobPts(x, y, rx * 0.9, ry * 0.88, { seed: seed * 13 + i, wobble: 0.14, n: 36 }));
  const backP = union(blobs);
  const twigP = union(twigs.map(([s, w0, w1]) => limbPts(s, w0, w1)));
  if (back) {
    leather(ctx, backP, { edge: false });
    dye(ctx, backP, back, backA);
    let bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y, rx, ry] of lobes) bb = [Math.min(bb[0], x - rx), Math.min(bb[1], y - ry), Math.max(bb[2], x + rx), Math.max(bb[3], y + ry)];
    if (lace) laceCut(ctx, union(blobs.map((b) => inset(b, 4))), bb, base, leaf.s * 0.52 * lace, seed);
    lobes.forEach(([x, y, rx, ry], i) => {
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.72 + (r() - 0.5) * 0.3;
        const e = [x + Math.cos(a) * rx * 0.72, y + Math.sin(a) * ry * 0.72];
        gold(ctx, [[x, y + ry * 0.2], [lerp(x, e[0], 0.5) + (r() - 0.5) * 10, lerp(y, e[1], 0.5)], e], 0.9);
      }
    });
  }
  leather(ctx, twigP);
  twigs.forEach(([s, w0, w1], i) => bark(ctx, s, w0, w1, { seed: seed + i, grain: false, alpha: 0.35 }));
  // leaves
  const list = [];
  const s0 = leaf.s, sj = leaf.sj ?? 0.2;
  const add = (px, py, out, li, rimLeaf) => {
    const up = Math.max(0, Math.sin(out));
    let ang = angMix(out, Math.PI / 2, (leaf.droop ?? 0.3) * (0.4 + 0.6 * up)) + (r() - 0.5) * 0.5;
    if (leaf.upright) ang = angMix(ang, -Math.PI / 2, leaf.upright);
    const s = s0 * (1 + (r() - 0.5) * 2 * sj) * (rimLeaf ? 1 : 0.92);
    const L = s * leafLen(leaf.kind);
    const l = { x: px - Math.cos(ang) * L * 0.3, y: py - Math.sin(ang) * L * 0.3, s, a: ang, li, out, flip: r() < 0.5 };
    l.col = (leaf.colorFn && leaf.colorFn(l, r)) || pick(r, leaf.colors);
    list.push(l);
  };
  lobes.forEach(([x, y, rx, ry], li) => {
    const nIn = Math.round((Math.PI * rx * ry) / (s0 * s0) * (leaf.inner ?? 0.3));
    for (let k = 0; k < nIn; k++) {
      const a = r() * TAU, q = Math.sqrt(r()) * 0.78;
      add(x + Math.cos(a) * rx * q, y + Math.sin(a) * ry * q, a, li, false);
    }
    const nRim = Math.round((Math.PI * (rx + ry)) / (s0 * (leaf.rim ?? 0.55)));
    for (let k = 0; k < nRim; k++) {
      const a = (k / nRim) * TAU + (r() - 0.5) * 0.25;
      const rr = 0.84 + r() * 0.22;
      add(x + Math.cos(a) * rx * rr, y + Math.sin(a) * ry * rr, a, li, true);
    }
  });
  const pts = list.map((l) => leafPts(leaf.kind, l.x, l.y, l.s, l.a, { bend: leaf.bend || 0, flip: l.flip, teeth: leaf.teeth }));
  const all = union(pts);
  leather(ctx, all, { edge: false });
  const by = new Map();
  list.forEach((l, i) => {
    if (!by.has(l.col)) by.set(l.col, new Path2D());
    addPts(by.get(l.col), inset(pts[i], Math.min(1.3, l.s * 0.06)));
  });
  by.forEach((p, col) => dye(ctx, p, col, leaf.alpha ?? 0.88));
  line(ctx, all, 'rgba(14,9,5,0.95)', 1.1);
  line(ctx, all, INK.goldLine, 0.5, { alpha: 0.75 });
  if (leaf.veins !== 'none') {
    const V = new Path2D();
    list.forEach((l) => (leaf.kind === 'kanok' ? null : veinPath(V, l, leaf.kind, leaf.veins !== 'mid')));
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = clamp(s0 * 0.035, 0.6, 1.05);
    ctx.lineCap = 'round';
    ctx.stroke(V);
    ctx.restore();
  }
  if (leaf.kind === 'kanok') list.forEach((l) => hole(ctx, l.x + Math.cos(l.a) * l.s * 0.35, l.y + Math.sin(l.a) * l.s * 0.35, Math.max(0.6, l.s * 0.05)));
  sp.extras && sp.extras(ctx, r, list);
  return { list, blobs };
}
// Bounding outline of a canopy spec for piece().
function canopyBox(sp, extra = []) {
  const e = sp.leaf.s * leafLen(sp.leaf.kind) * 1.05 + 4;
  const out = [[sp.base]];
  for (const [x, y, rx, ry] of sp.lobes) out.push(box(x - rx - e, y - ry - e, x + rx + e, y + ry + e));
  return out.concat(extra);
}
// A canopy cut as one rig piece.
function canopyPiece(name, sp, { px = 1.3, extra = [] } = {}) {
  return piece(name, canopyBox(sp, extra), (ctx, r) => canopy(ctx, r, sp), { px });
}

// ------------------------------------------------------------ palm fronds
// Pinnate frond (coconut, areca): a curved rib with leaflets hanging both
// sides; returns the geometry so the piece box can be sized first.
function frondGeom(p0, ang, len, { droop = 0.35, arch = 0.14, wid = 56, gap = 6.2, lw = 3.4, dry = false, spread = 0.95, seed = 1 } = {}) {
  const dir = [Math.cos(ang), Math.sin(ang)];
  const p1 = [p0[0] + dir[0] * len * 0.55, p0[1] + dir[1] * len * 0.55 - len * arch];
  const p2 = [p0[0] + dir[0] * len, p0[1] + dir[1] * len + droop * len];
  const rib = qbez(p0, p1, p2, 18);
  const r = rng(seed);
  const leaflets = [];
  resample(rib, gap).forEach(([x, y, a], i, arr) => {
    const t = i / arr.length;
    if (t < 0.07) return;
    const L = wid * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), 0.6) * (1 - t * 0.32) + 5;
    for (const side of [-1, 1]) {
      const la = a + side * (dry ? 1.5 : spread) + (r() - 0.5) * 0.12;
      let gx = Math.cos(la), gy = Math.sin(la) + (dry ? 0.9 : 0.5);
      const gl = Math.hypot(gx, gy); gx /= gl; gy /= gl;
      const tip = [x + gx * L, y + gy * L];
      const nx = -gy, ny = gx;
      const mid = [x + gx * L * 0.45 + Math.cos(a) * L * 0.1, y + gy * L * 0.45 + Math.sin(a) * L * 0.1];
      leaflets.push({ i, x, y, tip, mid, nx, ny, L, side });
    }
  });
  return { rib, leaflets, lw };
}
function frondOutline(g) { return [g.rib, g.leaflets.map((l) => l.tip)]; }
function drawFrond(ctx, g, { color = C.leaf, color2 = C.jade, seed = 1, dry = false } = {}) {
  const A = new Path2D(), B = new Path2D();
  addPts(A, limbPts(g.rib, 7, 1.4));
  for (const l of g.leaflets) {
    const w = g.lw * (dry ? 0.7 : 1);
    const q = [[l.x, l.y], [l.mid[0] + l.nx * w, l.mid[1] + l.ny * w], l.tip, [l.mid[0] - l.nx * w, l.mid[1] - l.ny * w]];
    addPts(((l.i >> 1) + (l.side > 0 ? 1 : 0)) % 2 ? A : B, q);
  }
  leather(ctx, A, { edge: false });
  leather(ctx, B, { edge: false });
  dye(ctx, B, dry ? C.bark : color2, 0.85);
  dye(ctx, A, dry ? C.amber : color, 0.85);
  const S = new Path2D();
  for (const l of g.leaflets) {
    if (l.L < 18) continue;
    S.moveTo(lerp(l.x, l.mid[0], 0.5), lerp(l.y, l.mid[1], 0.5));
    S.lineTo(lerp(l.mid[0], l.tip[0], 0.6), lerp(l.mid[1], l.tip[1], 0.6));
  }
  ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 0.75; ctx.stroke(S); ctx.restore();
  gold(ctx, g.rib.slice(1), 1.1);
  dotLine(ctx, offset(g.rib.slice(2, -3), 2.4), { spacing: 4.2, r: 0.85, seed, smoothIt: false });
}
// Several fronds cut as one piece pivoting at the crown.
function frondPiece(name, crown, specs, { px = 1.3, colors = [C.leaf, C.jade], extra } = {}) {
  const geoms = specs.map((s, i) => frondGeom(crown, s.a, s.len, { seed: i + 1, ...s }));
  return piece(name, [[crown], ...geoms.flatMap(frondOutline)], (ctx) => {
    geoms.forEach((g, i) => drawFrond(ctx, g, { color: specs[i].color || colors[i % 2], color2: specs[i].color2 || colors[(i + 1) % 2], seed: i + 3, dry: specs[i].dry }));
    extra && extra(ctx);
  }, { px });
}

// Palmate fan leaf (sugar palm): a petiole and a pleated fan whose
// segments are split and slit so light fans out through them.
function fanGeom(hub, a, pl, R, { spread = 3.3, n = 24, droop = 0.2, seed = 1 } = {}) {
  const r = rng(seed);
  const c = [hub[0] + Math.cos(a) * pl, hub[1] + Math.sin(a) * pl];
  const segs = [];
  for (let k = 0; k < n; k++) {
    const sa = a - spread / 2 + ((k + 0.5) / n) * spread;
    const len = R * (0.82 + 0.18 * Math.sin((k / (n - 1)) * Math.PI) + (r() - 0.5) * 0.08);
    const d = (spread / n) * 0.46;
    const P = (ang, rr) => {
      const x = c[0] + Math.cos(ang) * rr, y = c[1] + Math.sin(ang) * rr;
      return [x, y + droop * (rr * rr) / R * (0.5 + 0.5 * Math.abs(Math.cos(ang)))];
    };
    segs.push({ pts: [P(sa - d * 0.3, R * 0.12), P(sa - d, len * 0.78), P(sa - d * 0.35, len), P(sa, len * 0.9), P(sa + d * 0.35, len), P(sa + d, len * 0.78), P(sa + d * 0.3, R * 0.12)], mid: [P(sa, R * 0.16), P(sa, len * 0.5), P(sa, len * 0.86)], k });
  }
  return { hub, c, segs, a };
}
function drawFan(ctx, g, { color = C.jade, color2 = C.leaf, seed = 1, dry = false } = {}) {
  const stalk = limbPts([g.hub, g.c], 6, 4);
  leather(ctx, poly(stalk));
  const A = new Path2D(), B = new Path2D();
  g.segs.forEach((s) => addPts(s.k % 2 ? A : B, s.pts));
  const disk = ellipsePts(g.c[0], g.c[1], 9, 9, 16);
  addPts(A, disk);
  leather(ctx, A, { edge: false }); leather(ctx, B, { edge: false });
  dye(ctx, A, dry ? C.bark : color, 0.86); dye(ctx, B, dry ? C.amber : color2, 0.86);
  const all = new Path2D(); g.segs.forEach((s) => addPts(all, s.pts));
  line(ctx, all, 'rgba(14,9,5,0.9)', 0.9);
  g.segs.forEach((s, i) => {
    if (i % 2) gold(ctx, s.mid, 0.7);
    else slit(ctx, s.mid.slice(1), 0.8);
  });
  hole(ctx, g.c[0], g.c[1], 2.2);
  dotLine(ctx, ellipsePts(g.c[0], g.c[1], 6, 6, 12), { closed: true, spacing: 3.2, r: 0.7, seed, smoothIt: false });
}
function fanOutline(g) { return [[g.hub], g.segs.flatMap((s) => s.pts)]; }

// ------------------------------------------------------------ flowers, fruit, gems
// ลีลาวดี — five twisted pinwheel petals.
function frangipani(ctx, x, y, s, rot, { petal = C.white, heart = C.sun } = {}) {
  const ps = [];
  for (let k = 0; k < 5; k++) {
    const a = rot + (k / 5) * TAU;
    const bx = x + Math.cos(a + 1.1) * s * 0.12, by = y + Math.sin(a + 1.1) * s * 0.12;
    ps.push(leafPts('obovate', bx, by, s, a, { bend: 0.12 }));
  }
  const P = union(ps);
  leather(ctx, P);
  dye(ctx, P, petal, 0.95);
  const h = new Path2D(); h.arc(x, y, s * 0.42, 0, TAU);
  dye(ctx, h, heart, 0.9);
  line(ctx, P, INK.goldLine, 0.5);
  for (let k = 0; k < 5; k++) {
    const a = rot + (k / 5) * TAU;
    slit(ctx, [[x + Math.cos(a) * s * 0.25, y + Math.sin(a) * s * 0.25], [x + Math.cos(a + 0.12) * s * 0.7, y + Math.sin(a + 0.12) * s * 0.7]], 0.7, { smoothIt: false });
  }
  hole(ctx, x, y, Math.max(0.8, s * 0.07));
}
// ชบา — five broad petals and the long staminal column.
function hibiscus(ctx, x, y, s, ang, { petal = '#e0302a', heart = INK.crimson } = {}) {
  const ps = [];
  for (let k = 0; k < 5; k++) {
    const a = ang + Math.PI + (k - 2) * 0.62;
    ps.push(leafPts('ovate', x, y, s, a));
  }
  const P = union(ps);
  leather(ctx, P);
  dye(ctx, P, petal, 0.95);
  const h = new Path2D(); h.arc(x, y, s * 0.3, 0, TAU);
  dye(ctx, h, heart, 0.9);
  line(ctx, P, 'rgba(14,9,5,0.9)', 0.9);
  for (let k = 0; k < 5; k++) {
    const a = ang + Math.PI + (k - 2) * 0.62;
    for (const d of [-0.18, 0, 0.18]) slit(ctx, [[x + Math.cos(a + d) * s * 0.3, y + Math.sin(a + d) * s * 0.3], [x + Math.cos(a + d * 1.3) * s * 0.78, y + Math.sin(a + d * 1.3) * s * 0.78]], 0.6, { smoothIt: false });
  }
  // staminal column reaching out of the flower
  const tip = [x + Math.cos(ang) * s * 1.05, y + Math.sin(ang) * s * 1.05];
  leather(ctx, poly(limbPts([[x, y], tip], 2.6, 1.6)));
  dye(ctx, poly(limbPts([[x, y], tip], 2.2, 1.2)), '#f06a3a', 0.9);
  for (let k = 0; k < 6; k++) {
    const t = 0.65 + k * 0.07;
    const px = lerp(x, tip[0], t), py = lerp(y, tip[1], t);
    const o = (k % 2 ? 1 : -1) * 4;
    const q = [px - Math.sin(ang) * o, py + Math.cos(ang) * o];
    const d = new Path2D(); d.arc(q[0], q[1], 1.8, 0, TAU);
    leather(ctx, d); dye(ctx, d, C.sun, 0.95);
  }
  hole(ctx, x, y, 1.1);
}
// A small five-dot flower (chains, vines, grass).
function blossom(ctx, x, y, s, col, { holeC = true } = {}) {
  const ps = [];
  for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU - Math.PI / 2; ps.push(ellipsePts(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.5, s * 0.5, 10)); }
  const P = union(ps);
  leather(ctx, P);
  dye(ctx, P, col, 0.95);
  if (holeC) hole(ctx, x, y, Math.max(0.6, s * 0.22));
  return P;
}
// Faceted jewel in a gold setting.
function gem(ctx, x, y, s, col) {
  const o = [];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + Math.PI / 8; o.push([x + Math.cos(a) * s * (k % 2 ? 0.92 : 1), y + Math.sin(a) * s * 1.18]); }
  const setting = ellipsePts(x, y, s * 1.25, s * 1.45, 24);
  leather(ctx, poly(setting));
  dye(ctx, poly(setting), INK.gold, 0.9);
  dotLine(ctx, ellipsePts(x, y, s * 1.12, s * 1.32, 24), { closed: true, spacing: 2.8, r: 0.6, smoothIt: false });
  dye(ctx, poly(o), col, 0.97);
  const t = [[x, y - s * 1.18], [x + s * 0.5, y - s * 0.2], [x, y + s * 1.18], [x - s * 0.5, y - s * 0.2]];
  dye(ctx, poly(t), '#ffffff', 0.25);
  for (const p of o) line(ctx, [[x, y - s * 0.2], p], INK.goldLine, 0.5, { smoothIt: false });
  line(ctx, poly(o), INK.goldLine, 0.8);
  hole(ctx, x - s * 0.3, y - s * 0.5, Math.max(0.7, s * 0.14));
}
// Round fruit with a gold rim.
function fruit(ctx, x, y, rx, ry, col, { seed = 1, stalk = null, blush = null } = {}) {
  if (stalk) leather(ctx, poly(limbPts([stalk, [x, y - ry * 0.8]], 2.4, 1.8)));
  const f = blobPts(x, y, rx, ry, { seed, wobble: 0.05, n: 20 });
  leather(ctx, poly(f));
  dye(ctx, smooth(inset(f, 1.3)), col, 0.9);
  if (blush) dye(ctx, smooth(blobPts(x + rx * 0.25, y + ry * 0.2, rx * 0.55, ry * 0.6, { seed: seed + 1 })), blush, 0.55);
  gold(ctx, inset(f, 2.4), 0.6, { closed: true });
  hole(ctx, x - rx * 0.35, y - ry * 0.35, Math.max(0.6, rx * 0.12));
  return f;
}

// ------------------------------------------------------------ rigs & sway
function hashId(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
// Build a 'plant' rig. Extra per-part field `sway`: { flex, om, grav,
// hang, push, freq } — flex scales how far wind bends it, om is the joint
// drive frequency (rad/s), hang marks a free pendulum (chains, roots).
function plant(parts, extra = {}) {
  const sway = {};
  for (const [id, d] of Object.entries(parts)) if (d.parent) sway[id] = { flex: 1, om: 9, ...(d.sway || {}), ph: (hashId(id) % 1000) / 159 };
  const rig = makeRig('plant', parts, extra);
  rig.sway = sway;
  rig.plant = true;
  rig.onSpawn = onSpawnFoliage;
  return rig;
}

export function isFoliage(a) {
  return !!(a && !a.removed && a.rig && (a.rig.plant || a.rig.kind === 'plant') && a.parts);
}

// One-time setup of a spawned plant (see header).
export function onSpawnFoliage(a, scene, opts = {}) {
  if (!isFoliage(a) || a._fol) return a;
  a._fol = { t: Math.random() * 10 };
  a.isPlant = true;
  a.gaitIdle = false;
  // animalAI leaves anything with a controller alone; a real guard on
  // isPlant in animalAI is still recommended (flies release -> null).
  if (!a.controller) a.controller = 'plant';
  const sway = a.rig.sway || {};
  for (const b of a.parts) {
    b.collide = false;   // scenery: nobody trips on a tree
    b.scenery = true;
    if (b === a.root) continue;
    b.floor = false;
    const s = sway[b.part] || {};
    b.gravity = s.hang ? 1 : s.grav ?? 0.3;
    b.angDamp = s.hang ? 1.2 : 2.2;
    b.linDamp = s.hang ? 0.9 : 1.6;
  }
  if (a.rig.hang && scene) {
    const z = a.z;
    let wy;
    if (opts.y != null) wy = scene.unproject(0, opts.y, z)[1];
    else wy = scene.unproject(0, 14, z)[1] + (a.headOffset || 0);
    a.teleport(a.root.x, wy);
    a.target.y = wy;
    a.setMode('hung');
  }
  return a;
}

const WIND = { level: 0, gust: 0 };
// Per-frame weather sway for every plant on stage.
export function swayFoliage(scene, fx, dt, time) {
  if (!scene || !scene.actors) return;
  dt = Math.min(Math.max(dt || 0, 0), 0.05);
  time = time ?? scene.time ?? 0;
  const W = fx && fx.weather;
  const want = W && W.has('storm') ? 2.2 : W && W.has('wind') ? 1 : 0;
  WIND.level += (want - WIND.level) * Math.min(1, dt * 0.9);
  const lv = WIND.level;
  let movers = null;
  for (const a of scene.actors) {
    if (!isFoliage(a)) continue;
    if (!a._fol) onSpawnFoliage(a, scene);
    const root = a.root;
    if (!root || !isFinite(root.x) || !isFinite(root.y)) continue;
    const sway = a.rig.sway || {};
    const f = a.facing || 1;
    const X = root.x * 0.0035;
    // gusts travel across the stage with the wind (+x)
    const gust = 0.55 + 0.3 * Math.sin(time * 0.83 - X) + 0.15 * Math.sin(time * 2.1 - X * 2.3 + 1.7);
    for (const [id, j] of Object.entries(a.joints)) {
      const s = sway[id];
      if (!s || !j.B) continue;
      const b = j.B;
      if (s.hang) {
        // free pendulum: tiny centring spring, pushed by the wind
        j.drive = 1;
        j.target = 0;
        j.driveCompliance = 1 / (j.ieff * (s.om ?? 1.6) ** 2);
        j.damping = 0.9;
        const push = (s.push ?? 1) * (lv * (140 + 160 * gust) + 20 * Math.sin(time * 1.1 + s.ph)) * (0.7 + 0.3 * Math.sin(time * 3.3 + s.ph * 2));
        b.vx += push * dt;
        if (lv > 1.5) b.vx += (Math.random() - 0.5) * 900 * dt * (s.push ?? 1);
        continue;
      }
      const flex = s.flex ?? 1, fr = s.freq ?? 1;
      const ph = time * (1.3 + 0.9 * fr) + s.ph + X * 2;
      const calm = (Math.sin(ph * 0.55) * 0.6 + Math.sin(ph * 0.31 + 1) * 0.4) * 0.018;
      const lean = lv * (0.05 + 0.07 * gust);
      const flutter = lv * (0.035 + 0.05 * gust) * Math.sin(ph * (1.6 + 0.4 * lv)) + (lv > 1.5 ? (Math.random() - 0.5) * 0.06 : 0);
      j.target = clamp((calm + lean + flutter) * flex, -0.6, 0.6) * f;
      const om = (s.om ?? 9) * (1 - Math.min(0.25, lv * 0.08));
      j.drive = 1;
      j.driveCompliance = 1 / (j.ieff * om * om);
      j.damping = s.damp ?? 2.5 + om * 0.15;
    }
    // rustle: things moving through the foliage brush the leaves aside
    if (!movers) movers = scene.actors.filter((o) => !isFoliage(o) && o.root && isFinite(o.root.vx) && Math.abs(o.root.vx) > 50);
    for (const o of movers) {
      const r = o.root;
      if (Math.abs(r.z - root.z) > 0.08 || Math.abs(r.x - root.x) > 700) continue;
      for (const b of a.parts) {
        if (b === root) continue;
        if (Math.abs(b.x - r.x) < b.radius * 0.8 + 20 && Math.abs(b.y - r.y) < b.radius + 160) b.vx += clamp(r.vx, -500, 500) * 1.6 * dt;
      }
    }
  }
}

// ================================================================ palms
// ต้นมะพร้าว — a leaning coconut palm; the upper trunk bends on its own
// joint so the whole crown rocks in a storm.
function coconut() {
  const low = [[0, 0], [-12, -120], [-10, -240], [4, -350]];
  const up = [[4, -350], [26, -460], [58, -565], [98, -660]];
  const crown = [98, -664];
  const trunk = piece('fo-coco-trunk', [limbPts(low, 46, 34), box(-70, -30, 70, 6)], (ctx) => {
    ground(ctx, -64, 64, 3, 9);
    for (const [a, b] of [[[-14, -12], [-40, 2]], [[14, -10], [42, 2]], [[0, -8], [2, 3]]]) leather(ctx, poly(limbPts([a, b], 10, 5)));
    leather(ctx, smooth([[-34, 2], [-24, -14], [-23, -34], [23, -34], [24, -12], [36, 2]]));
    rings(ctx, low, 46, 34, { seed: 3, step: 12 });
  }, { px: 1.4 });
  const top = piece('fo-coco-top', [limbPts(up, 35, 24), box(crown[0] - 70, crown[1] - 30, crown[0] + 70, crown[1] + 150)], (ctx) => {
    // old fronds hanging dry under the crown
    for (const [a, l] of [[2.0, 130], [1.15, 120]]) {
      const g = frondGeom(crown, a, l, { droop: 0.3, wid: 34, dry: true, seed: 9 + l });
      drawFrond(ctx, g, { dry: true, seed: 4 });
    }
    rings(ctx, up, 35, 24, { seed: 5, step: 11 });
    const boss = blobPts(crown[0], crown[1], 20, 15, { seed: 11 });
    leather(ctx, poly(boss));
    dye(ctx, smooth(inset(boss, 2)), C.olive, 0.6);
    dotLine(ctx, inset(boss, 4), { closed: true, spacing: 3.6, r: 0.8 });
    dotFlower(ctx, crown[0], crown[1], 1.3, 6, 2.6);
  }, { px: 1.4 });
  const fr = (id, specs) => frondPiece('fo-coco-' + id, crown, specs, { colors: [C.leaf, C.jade] });
  const nuts = piece('fo-coco-nuts', [box(crown[0] - 40, crown[1], crown[0] + 40, crown[1] + 70)], (ctx) => {
    const cx = crown[0], cy = crown[1];
    const spots = [[-18, 26], [0, 32], [18, 24], [-9, 50], [11, 48], [-26, 44], [26, 42]];
    spots.forEach(([dx, dy], i) => fruit(ctx, cx + dx, cy + dy, 13, 14, [C.leaf2, C.olive, C.sun][i % 3], { seed: i + 3, stalk: [cx + dx * 0.3, cy + 4] }));
  });
  return plant({
    trunk: { pc: trunk, z: 0, mass: 4 },
    top: { pc: top, z: 0, parent: 'trunk', j: low[3], lim: [-0.2, 0.2], stiff: 0.9, sway: { flex: 0.3, om: 11, freq: 0.5 } },
    fL: { pc: fr('fl', [{ a: -2.95, len: 245, droop: 0.6 }, { a: -2.6, len: 235, droop: 0.45 }]), z: -1, parent: 'top', j: crown, lim: [-0.5, 0.5], stiff: 0.8, sway: { flex: 1.5, om: 6.5 } },
    fUL: { pc: fr('ful', [{ a: -2.25, len: 262, droop: 0.3 }, { a: -1.95, len: 250, droop: 0.2 }]), z: -2, parent: 'top', j: crown, lim: [-0.5, 0.5], stiff: 0.8, sway: { flex: 1.3, om: 7 } },
    fU: { pc: fr('fu', [{ a: -1.62, len: 225, droop: 0.1 }, { a: -1.3, len: 240, droop: 0.14 }]), z: -1, parent: 'top', j: crown, lim: [-0.5, 0.5], stiff: 0.8, sway: { flex: 1.1, om: 7.5 } },
    fUR: { pc: fr('fur', [{ a: -1.0, len: 255, droop: 0.25 }, { a: -0.7, len: 262, droop: 0.36 }]), z: 1, parent: 'top', j: crown, lim: [-0.5, 0.5], stiff: 0.8, sway: { flex: 1.3, om: 7 } },
    fR: { pc: fr('fr', [{ a: -0.35, len: 245, droop: 0.52 }, { a: 0.0, len: 225, droop: 0.62 }]), z: 1, parent: 'top', j: crown, lim: [-0.5, 0.5], stiff: 0.8, sway: { flex: 1.5, om: 6.5 } },
    nuts: { pc: nuts, z: 2, parent: 'top', j: [crown[0], crown[1] + 4], lim: [-0.5, 0.5], stiff: 0.2, sway: { hang: true, push: 0.4, om: 3 } },
  });
}

// ต้นตาล — the sugar palm of the southern paddies, with its round crown of
// fan leaves, the tapper's bamboo ladder (พะอง) and sap tubes.
function sugarPalm() {
  const low = [[0, 0], [3, -210], [0, -420]];
  const up = [[0, -420], [-2, -600], [0, -728]];
  const hub = [0, -740];
  const ladder = (ctx, y0, y1) => {
    const pole = [[31, y0], [30, y1]];
    leather(ctx, poly(limbPts(pole, 7, 6, false, false)));
    dye(ctx, poly(limbPts(pole, 5, 4, false, false)), C.olive, 0.55);
    for (let y = y0 - 18; y > y1 + 6; y -= 44) {
      leather(ctx, poly(limbPts([[30, y], [48, y - 7]], 5, 4)));
      // lashing across trunk and pole
      line(ctx, [[-20, y + 8], [34, y + 5]], INK.goldLine, 2, { smoothIt: false });
      dotLine(ctx, [[-18, y + 12], [32, y + 9]], { spacing: 3.4, r: 0.8, smoothIt: false });
    }
  };
  const trunk = piece('fo-tan-trunk', [limbPts(low, 48, 40), box(-70, -30, 70, 6), box(20, -430, 52, 0)], (ctx) => {
    ground(ctx, -66, 66, 5, 10);
    leather(ctx, smooth([[-40, 2], [-28, -16], [-25, -44], [25, -44], [28, -16], [40, 2]]));
    rings(ctx, low, 48, 40, { seed: 7, step: 26, tone: '#6d4a2c', alpha: 0.55 });
    ladder(ctx, 0, -424);
  }, { px: 1.4 });
  const top = piece('fo-tan-top', [limbPts(up, 41, 36), box(-100, hub[1] - 20, 100, hub[1] + 190), box(20, -730, 52, -415)], (ctx) => {
    // skirt of dead fans under the crown
    [[1.9, 60, 70], [1.25, 60, 72], [2.5, 50, 60], [0.65, 50, 60]].forEach(([a, pl, R], i) => drawFan(ctx, fanGeom(hub, a, pl, R, { droop: 0.5, spread: 2.2, n: 14, seed: 30 + i }), { dry: true }));
    rings(ctx, up, 41, 36, { seed: 8, step: 24, tone: '#6d4a2c', alpha: 0.55 });
    // leaf-base stubs at the top of the trunk
    for (let k = 0; k < 7; k++) {
      const y = hub[1] + 30 + k * 11, s = k % 2 ? 1 : -1;
      leather(ctx, poly(limbPts([[s * 6, y], [s * 30, y - 16]], 9, 4)));
      gold(ctx, [[s * 8, y - 1], [s * 26, y - 13]], 0.8, { smoothIt: false });
    }
    ladder(ctx, -416, -700);
    // sap tubes (กระบอกตาล) hung at the crown
    for (const x of [-26, 22]) {
      const t = [[x - 7, hub[1] + 18], [x + 7, hub[1] + 18], [x + 7, hub[1] + 60], [x - 7, hub[1] + 60]];
      leather(ctx, poly(t));
      dye(ctx, poly(inset(t, 1.8)), C.olive, 0.6);
      for (const y of [hub[1] + 26, hub[1] + 52]) line(ctx, [[x - 6, y], [x + 6, y]], INK.goldLine, 1.4, { smoothIt: false });
      holes(ctx, [[x, hub[1] + 38], [x, hub[1] + 44]], 1);
    }
    const boss = blobPts(hub[0], hub[1] + 6, 26, 20, { seed: 4 });
    leather(ctx, poly(boss));
    dye(ctx, smooth(inset(boss, 2)), C.bark, 0.5);
    dotLine(ctx, inset(boss, 4), { closed: true, spacing: 3.6, r: 0.9 });
  }, { px: 1.4 });
  const fans = (id, list, cols) => {
    const gs = list.map(([a, pl, R, sp], i) => fanGeom(hub, a, pl, R, { spread: sp || 3.3, seed: hashId(id) + i, droop: 0.22 }));
    return piece('fo-tan-' + id, [[hub], ...gs.flatMap(fanOutline)], (ctx) => gs.forEach((g, i) => drawFan(ctx, g, { color: cols[i % cols.length], color2: cols[(i + 1) % cols.length], seed: i })), { px: 1.3 });
  };
  const fruitP = piece('fo-tan-fruit', [box(-36, hub[1], 60, hub[1] + 100)], (ctx) => {
    const st = [[4, hub[1] + 6], [22, hub[1] + 24], [26, hub[1] + 50]];
    leather(ctx, poly(limbPts(st, 6, 4)));
    [[14, 52], [34, 50], [24, 70], [4, 66], [42, 70], [16, 88], [34, 88]].forEach(([x, y], i) => {
      const f = fruit(ctx, x, hub[1] + y, 11, 11, C.plum, { seed: i + 20 });
      const cap = [[x - 8, hub[1] + y - 8], [x + 8, hub[1] + y - 8], [x + 5, hub[1] + y - 13], [x - 5, hub[1] + y - 13]];
      leather(ctx, poly(cap)); dye(ctx, poly(cap), C.sun, 0.8);
      void f;
    });
  });
  return plant({
    trunk: { pc: trunk, z: 0, mass: 4 },
    top: { pc: top, z: 0, parent: 'trunk', j: low[2], lim: [-0.15, 0.15], stiff: 0.95, sway: { flex: 0.2, om: 12, freq: 0.5 } },
    fanL: { pc: fans('l', [[-2.75, 78, 104], [-2.35, 86, 108], [-3.1, 66, 92]], [C.jade, C.leaf]), z: -1, parent: 'top', j: hub, lim: [-0.4, 0.4], stiff: 0.8, sway: { flex: 1.1, om: 7 } },
    fanT: { pc: fans('t', [[-1.95, 92, 108], [-1.55, 100, 112], [-1.2, 94, 108]], [C.leaf, C.jade]), z: -2, parent: 'top', j: hub, lim: [-0.4, 0.4], stiff: 0.8, sway: { flex: 0.9, om: 7.5 } },
    fanR: { pc: fans('r', [[-0.8, 88, 106], [-0.4, 80, 102], [-0.05, 66, 92]], [C.jade, C.leaf2]), z: -1, parent: 'top', j: hub, lim: [-0.4, 0.4], stiff: 0.8, sway: { flex: 1.1, om: 7 } },
    fanF: { pc: fans('f', [[1.57, 16, 80, 6.0]], [C.leaf2, C.jade]), z: 1, parent: 'top', j: hub, lim: [-0.3, 0.3], stiff: 0.8, sway: { flex: 0.6, om: 8 } },
    fruit: { pc: fruitP, z: 2, parent: 'top', j: [4, hub[1] + 6], lim: [-0.5, 0.5], stiff: 0.2, sway: { hang: true, push: 0.4, om: 3 } },
  });
}

// ต้นกล้วย — banana plant: great torn leaves on soft stalk joints and the
// bunch with its purple heart swinging free.
function bananaLeafGeom(top, a, len, droop, wid) {
  const dir = [Math.cos(a), Math.sin(a)];
  const p0 = [top[0] + dir[0] * 8, top[1] + dir[1] * 8];
  const p1 = [p0[0] + dir[0] * len * 0.5, p0[1] + dir[1] * len * 0.5 - len * 0.08];
  const p2 = [p0[0] + dir[0] * len + droop * len * 0.3 * Math.sign(dir[0] || 1), p0[1] + dir[1] * len + droop * len];
  const rib = qbez(p0, p1, p2, 22);
  const t0 = 0.2, L = [], R = [];
  rib.forEach((p, i) => {
    const t = i / 22;
    if (t < t0) return;
    const u = (t - t0) / (1 - t0);
    const a2 = rib[Math.max(0, i - 1)], b2 = rib[Math.min(22, i + 1)];
    const l = dist(a2, b2) || 1;
    const nx = -(b2[1] - a2[1]) / l, ny = (b2[0] - a2[0]) / l;
    const w = wid * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.05)), 0.55) * (1 - u * 0.2);
    L.push([p[0] + nx * w, p[1] + ny * w]);
    R.push([p[0] - nx * w, p[1] - ny * w]);
  });
  return { rib, blade: [...L, rib[22], ...R.reverse()], wid, t0 };
}
function drawBananaLeaf(ctx, g, { color = C.leaf, seed = 1, torn = 6 } = {}) {
  const r = rng(seed);
  leather(ctx, poly(limbPts(g.rib.slice(0, 7), 8, 5)));
  leather(ctx, smooth(g.blade));
  dye(ctx, smooth(inset(g.blade, 2)), color, 0.86);
  // a lighter band down each half
  dye(ctx, smooth(inset(g.blade, g.wid * 0.45)), C.lime, 0.3);
  gold(ctx, g.rib.slice(4), 1.4);
  dotLine(ctx, offset(g.rib.slice(6, -2), 3), { spacing: 3.8, r: 0.85, seed, smoothIt: false });
  resample(g.rib, 6.5).forEach(([x, y, ang], i, arr) => {
    const t = i / arr.length;
    if (t < g.t0 + 0.05 || t > 0.95) return;
    const w = g.wid * 0.84 * Math.pow(Math.sin(Math.PI * ((t - g.t0) / (1 - g.t0))), 0.55);
    for (const side of [-1, 1]) {
      const va = ang + side * 1.15;
      slit(ctx, [[x + Math.cos(va) * 4, y + Math.sin(va) * 4], [x + Math.cos(va) * w, y + Math.sin(va) * w]], 0.75, { smoothIt: false });
    }
  });
  for (let k = 0; k < torn; k++) {
    const [x, y, ang] = along(g.rib, 0.35 + r() * 0.58);
    const side = r() < 0.5 ? -1 : 1, va = ang + side * 1.25, w = g.wid * 1.15;
    const e = [x + Math.cos(va) * w, y + Math.sin(va) * w];
    cut(ctx, poly([[e[0] + Math.cos(ang) * 2.4, e[1] + Math.sin(ang) * 2.4], [e[0] - Math.cos(ang) * 2.4, e[1] - Math.sin(ang) * 2.4], [x + Math.cos(va) * 5, y + Math.sin(va) * 5]]));
  }
  line(ctx, smooth(g.blade), INK.goldLine, 0.6, { alpha: 0.8 });
}
function banana() {
  const top = [4, -262];
  const trunk = piece('fo-kluai-stem', [box(-110, -90, 110, 6), box(-30, top[1] - 10, 30, 0)], (ctx) => {
    ground(ctx, -100, 100, 11, 9);
    for (const [x, s] of [[-72, 0.55], [80, 0.42]]) {
      leather(ctx, poly(limbPts([[x, 0], [x + 2, -60 * s]], 14 * s, 9 * s)));
      for (const a of [-2.2, -1.1]) {
        const g = bananaLeafGeom([x + 2, -58 * s], a, 90 * s, 0.25, 16 * s);
        drawBananaLeaf(ctx, g, { color: C.leaf2, torn: 1, seed: x });
      }
    }
    const stem = [[0, 0], [-4, -130], [2, -222], top];
    const sp = limbPts(stem, 48, 30);
    leather(ctx, poly(sp));
    dye(ctx, poly(inset(sp, 3)), C.jade, 0.55);
    dye(ctx, poly(inset(sp, 12)), C.lime, 0.25);
    for (let y = -26; y > top[1] + 20; y -= 36) {
      const w = lerp(22, 14, -y / -top[1]);
      const sh = [[-w, y + 16], [-w * 0.2, y - 4], [w * 0.9, y - 26]];
      gold(ctx, sh, 1.2);
      dotLine(ctx, sh.map(([a, b]) => [a + 3, b + 5]), { spacing: 4, r: 0.9 });
    }
    // a dry old leaf clinging to the stem
    const dry = [[-12, -150], [-30, -120], [-34, -70], [-26, -40], [-18, -70], [-16, -110]];
    leather(ctx, smooth(dry)); dye(ctx, smooth(inset(dry, 1.5)), C.bark, 0.6);
    slit(ctx, [[-16, -140], [-28, -80]], 0.8);
  });
  const leafP = (id, a, len, droop, wid, col, torn) => {
    const g = bananaLeafGeom(top, a, len, droop, wid);
    return piece('fo-kluai-' + id, [g.blade, g.rib], (ctx) => drawBananaLeaf(ctx, g, { color: col, seed: hashId(id), torn }), { px: 1.6 });
  };
  const bunch = piece('fo-kluai-bunch', [box(top[0] - 4, top[1] - 6, top[0] + 100, top[1] + 220)], (ctx) => {
    const stalk = [[top[0] + 4, top[1] + 6], [top[0] + 46, top[1] + 10], [top[0] + 70, top[1] + 60], [top[0] + 72, top[1] + 150]];
    leather(ctx, poly(limbPts(stalk, 7, 4.5)));
    const sc = curve(stalk, false, 10);
    for (let k = 0; k < 4; k++) {
      const [x, y, a] = along(sc, 0.34 + k * 0.12);
      for (let f = -2; f <= 2; f++) {
        const fa = -Math.PI / 2 + f * 0.26 - 0.2;
        const bx = x + Math.cos(a + Math.PI / 2) * 3 + f * 3, by = y + 4;
        const fr = limbPts([[bx, by], [bx + Math.cos(fa) * 12 - 3, by + Math.sin(fa) * 12], [bx + Math.cos(fa) * 20 - 8, by + Math.sin(fa) * 22]], 7, 3.5);
        leather(ctx, poly(fr));
        dye(ctx, poly(inset(fr, 1)), k < 2 ? C.sun : C.leaf2, 0.9);
      }
      gold(ctx, [[x - 12, y + 5], [x + 12, y + 5]], 0.8, { smoothIt: false });
    }
    const hx = top[0] + 72, hy = top[1] + 150;
    const heart = [[hx, hy - 6], [hx + 12, hy + 10], [hx + 13, hy + 30], [hx + 4, hy + 50], [hx, hy + 58], [hx - 4, hy + 50], [hx - 13, hy + 30], [hx - 12, hy + 10]];
    leather(ctx, smooth(heart));
    dye(ctx, smooth(inset(heart, 1.5)), C.plum, 0.95);
    for (let k = 0; k < 4; k++) gold(ctx, [[hx - 10 + k * 1.5, hy + 8 + k * 11], [hx, hy + 14 + k * 11], [hx + 10 - k * 1.5, hy + 8 + k * 11]], 0.8);
    holes(ctx, [[hx, hy + 44], [hx - 5, hy + 22], [hx + 5, hy + 22]], 1);
  });
  return plant({
    trunk: { pc: trunk, z: 0, mass: 3 },
    l1: { pc: leafP('l1', -2.5, 188, 0.45, 32, C.jade, 5), z: -2, parent: 'trunk', j: top, lim: [-0.6, 0.6], stiff: 0.7, sway: { flex: 1.8, om: 5.5 } },
    l2: { pc: leafP('l2', -0.62, 195, 0.35, 32, C.jade, 6), z: -2, parent: 'trunk', j: top, lim: [-0.6, 0.6], stiff: 0.7, sway: { flex: 1.8, om: 5.5 } },
    l3: { pc: leafP('l3', -1.62, 165, -0.05, 27, C.leaf2, 3), z: -1, parent: 'trunk', j: top, lim: [-0.5, 0.5], stiff: 0.8, sway: { flex: 1.2, om: 6.5 } },
    l4: { pc: leafP('l4', -2.95, 168, 0.95, 29, C.leaf, 7), z: 1, parent: 'trunk', j: top, lim: [-0.6, 0.6], stiff: 0.7, sway: { flex: 2, om: 5 } },
    l5: { pc: leafP('l5', -0.18, 160, 1.0, 28, C.leaf, 7), z: 1, parent: 'trunk', j: top, lim: [-0.6, 0.6], stiff: 0.7, sway: { flex: 2, om: 5 } },
    bunch: { pc: bunch, z: 2, parent: 'trunk', j: [top[0] + 4, top[1] + 6], lim: [-0.5, 0.5], stiff: 0.2, sway: { hang: true, push: 0.35, om: 3 } },
  });
}

// ============================================================ broadleaf
// Generic broadleaf tree: a trunk piece carrying boughs out to each
// cluster's joint, then one canopy piece per cluster.
//   spec: { name, trunk: [[spine, w0, w1]...], decoTrunk(ctx, r), clusters: [{ id, base, lobes, z, flex, om, ...canopy opts }], leaf, back, hang: [...] }
function broadleaf(spec) {
  const tb = spec.trunk.map(([s, w0, w1]) => limbPts(s, w0, w1));
  const trunk = piece(spec.name + '-trunk', [...tb, ...(spec.trunkBox || [])], (ctx, r) => {
    spec.under && spec.under(ctx, r);
    limbs(ctx, spec.trunk, { seed: 5, tone: spec.barkTone ?? C.bark, alpha: spec.barkA ?? 0.45 });
    spec.decoTrunk && spec.decoTrunk(ctx, r);
  }, { px: spec.px ?? 1.3 });
  const parts = { trunk: { pc: trunk, z: 0, mass: spec.mass ?? 4 } };
  for (const c of spec.clusters) {
    const sp = { leaf: spec.leaf, back: spec.back, backA: spec.backA, lace: spec.lace, ...c, seed: hashId(c.id) % 97 };
    if (c.leafOver) sp.leaf = { ...spec.leaf, ...c.leafOver };
    parts[c.id] = {
      pc: canopyPiece(spec.name + '-' + c.id, sp, { px: c.px ?? spec.cpx ?? 1.25 }),
      z: c.z ?? 0, parent: c.parent || 'trunk', j: c.base, lim: [-0.4, 0.4], stiff: 0.85,
      sway: { flex: c.flex ?? 1, om: c.om ?? 9, freq: c.freq ?? 1 },
    };
  }
  for (const h of spec.hang || []) {
    parts[h.id] = { pc: h.pc, z: h.z ?? 2, parent: h.parent || 'trunk', j: h.j, lim: h.lim || [-0.7, 0.7], stiff: 0.15, sway: { hang: true, push: h.push ?? 1, om: h.om ?? 1.6 } };
  }
  return plant(parts, spec.extra || {});
}
const L3 = (base, lobes, o = {}) => ({ base, lobes, ...o });

// ต้นโพธิ์ — the sacred fig: heart leaves with long drip tips, buttressed
// trunk wound with three-coloured cloth, a spirit shrine at the foot.
function bodhi() {
  const fork = [0, -300];
  const bases = { cA: [-128, -372], cB: [-66, -452], cC: [0, -478], cD: [66, -452], cE: [128, -372], cF: [-50, -350], cG: [52, -350] };
  const boughs = Object.values(bases).map((b, i) => [[fork, [lerp(fork[0], b[0], 0.5) + (i % 2 ? 10 : -10), lerp(fork[1], b[1], 0.55)], b], 30, 14]);
  return broadleaf({
    name: 'fo-pho', mass: 5,
    trunk: [[[[0, 0], [-8, -120], [5, -215], fork], 104, 62], ...boughs,
      [[[-24, -60], [-96, -14], [-156, 0]], 30, 6], [[[24, -60], [100, -14], [164, 0]], 30, 6], [[[-10, -40], [-44, 0]], 22, 8], [[[12, -40], [50, 0]], 22, 8]],
    trunkBox: [box(-170, -40, 170, 6)],
    under: (ctx) => ground(ctx, -175, 175, 21, 8),
    decoTrunk: (ctx) => {
      const bands = [[-190, INK.red], [-176, INK.yellow], [-162, C.leaf]];
      bands.forEach(([y, col], i) => {
        const b = [[-46, y - 5], [48, y - 9], [49, y + 5], [-47, y + 9]];
        leather(ctx, poly(b)); dye(ctx, poly(inset(b, 1)), col, 0.95);
        dotLine(ctx, [[-42, y + 2], [44, y - 2]], { spacing: 3.6, r: 0.8, smoothIt: false, seed: i });
      });
      for (const [dx, col] of [[-8, INK.red], [4, INK.yellow], [16, C.leaf]]) {
        const t = limbPts([[42, -176 + dx * 0.4], [60 + dx, -150], [54 + dx, -106]], 8, 5);
        leather(ctx, poly(t)); dye(ctx, poly(inset(t, 1)), col, 0.95);
      }
      // hollow in the trunk and the little shrine
      cut(ctx, smooth([[-8, -250], [4, -262], [12, -240], [4, -220], [-6, -226]]));
      const sh = [[-118, 0], [-116, -22], [-90, -22], [-88, 0]];
      leather(ctx, poly(sh)); dye(ctx, poly(inset(sh, 1.5)), C.rust, 0.8);
      leather(ctx, poly([[-122, -22], [-103, -48], [-84, -22]])); dye(ctx, poly(inset([[-122, -22], [-103, -48], [-84, -22]], 2)), C.sun, 0.7);
      hole(ctx, -103, -12, 3);
      for (let k = -1; k <= 1; k++) { leather(ctx, poly(limbPts([[-103 + k * 3, -48], [-103 + k * 6, -70]], 1.2, 0.8))); hole(ctx, -103 + k * 6, -70, 0.9); }
    },
    leaf: {
      kind: 'heart', s: 22, sj: 0.2, droop: 0.4, rim: 0.5, inner: 0.32, alpha: 0.9,
      colors: [[C.leaf, 4], [C.jade, 3], [C.leaf2, 3], [C.lime, 1.5], [C.sun, 0.5], [C.rust, 0.25]],
    },
    back: C.deep,
    clusters: [
      L3(bases.cA, [[-205, -430, 100, 78], [-148, -478, 70, 58]], { id: 'cA', z: -1, flex: 1.1 }),
      L3(bases.cB, [[-118, -575, 112, 84]], { id: 'cB', z: -2, flex: 1 }),
      L3(bases.cC, [[8, -640, 122, 84], [-40, -596, 60, 48]], { id: 'cC', z: -3, flex: 0.9, om: 10 }),
      L3(bases.cD, [[128, -572, 112, 84]], { id: 'cD', z: -2, flex: 1 }),
      L3(bases.cE, [[212, -428, 98, 76], [158, -470, 64, 54]], { id: 'cE', z: -1, flex: 1.1 }),
      L3(bases.cF, [[-92, -418, 84, 58]], { id: 'cF', z: 1, flex: 1.2, om: 8 }),
      L3(bases.cG, [[96, -422, 84, 58]], { id: 'cG', z: 1, flex: 1.2, om: 8 }),
    ],
  });
}

// ต้นมะม่วง — mango: a dark dome of lance leaves, coppery new flushes at
// the crown and ripe fruit hanging on long stalks.
function mango() {
  const fork = [0, -200];
  const bases = { m1: [-150, -318], m2: [-60, -372], m3: [62, -380], m4: [152, -318], m5: [0, -392], m6: [0, -300] };
  const boughs = Object.entries(bases).map(([k, b], i) => [[fork, [lerp(fork[0], b[0], 0.45) + (i % 2 ? 14 : -14), lerp(fork[1], b[1], 0.6)], b], 26, 12]);
  const mangoes = (n, seed) => (ctx, r, list) => {
    const lows = list.filter((l) => Math.sin(l.out) > 0.35).sort(() => r() - 0.5).slice(0, n);
    lows.forEach((l, i) => {
      const x = l.x + (r() - 0.5) * 8, y = l.y + 26 + r() * 12;
      leather(ctx, poly(limbPts([[l.x, l.y - 6], [x, y - 12]], 2.6, 1.8)));
      const f = [[x - 2, y - 14], [x + 9, y - 10], [x + 12, y + 4], [x + 6, y + 16], [x - 2, y + 18], [x - 9, y + 8], [x - 9, y - 6]];
      leather(ctx, smooth(f));
      const col = [C.sun, C.leaf2, C.amber][(i + seed) % 3];
      dye(ctx, smooth(inset(f, 1.4)), col, 0.93);
      dye(ctx, smooth(inset(f, 5)), i % 2 ? C.amber : C.sun, 0.35);
      gold(ctx, inset(f, 2.6), 0.6, { closed: true });
      hole(ctx, x - 3, y - 4, 1);
    });
  };
  const copper = (l, r) => (Math.sin(l.out) < -0.45 && r() < 0.55 ? (r() < 0.5 ? C.copper : C.rust) : null);
  return broadleaf({
    name: 'fo-mamuang', mass: 4,
    trunk: [[[[0, 0], [-6, -110], [4, -170], fork], 64, 46], ...boughs, [[[-16, -30], [-60, 0]], 24, 8], [[[16, -30], [64, 0]], 24, 8]],
    trunkBox: [box(-120, -30, 120, 6)],
    under: (ctx) => ground(ctx, -120, 120, 31, 8),
    leaf: { kind: 'lance', s: 30, sj: 0.18, droop: 0.65, rim: 0.4, inner: 0.35, alpha: 0.9, colors: [[C.deep, 3], [C.leaf, 3], [C.jade, 2], [C.moss, 1.5]] },
    back: '#24592d',
    clusters: [
      L3(bases.m1, [[-196, -392, 92, 72]], { id: 'm1', z: -1, extras: mangoes(3, 0) }),
      L3(bases.m2, [[-92, -498, 104, 80]], { id: 'm2', z: -2, leafOver: { colorFn: copper } }),
      L3(bases.m3, [[88, -505, 104, 82]], { id: 'm3', z: -2, leafOver: { colorFn: copper }, extras: mangoes(2, 1) }),
      L3(bases.m4, [[200, -392, 92, 72]], { id: 'm4', z: -1, extras: mangoes(3, 2) }),
      L3(bases.m5, [[0, -575, 92, 62]], { id: 'm5', z: -3, om: 10, leafOver: { colorFn: copper } }),
      L3(bases.m6, [[-6, -360, 116, 56]], { id: 'm6', z: 1, flex: 1.2, extras: mangoes(4, 0) }),
    ],
  });
}

const F = (id, name, en, build) => ({ id, name, en, cat: 'foliage', build, onSpawn: onSpawnFoliage });
export const PROPS = [
  F('ton-maphrao', 'ต้นมะพร้าว', 'Coconut palm (swaying)', coconut),
  F('ton-tan', 'ต้นตาล', 'Sugar palm', sugarPalm),
  F('ton-kluai', 'ต้นกล้วย', 'Banana plant (swaying)', banana),
  F('ton-pho', 'ต้นโพธิ์', 'Bodhi tree (swaying)', bodhi),
  F('ton-mamuang', 'ต้นมะม่วง', 'Mango tree', mango),
];
