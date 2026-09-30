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
  leaf: '#4f9e38', leaf2: '#6fb540', lime: '#a6d152', jade: '#2e9a6c', deep: '#347a3b', moss: '#5f8f2c',
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
  if (spine[0][1] >= -0.5 && w0 > 12) capA = false; // planted in the ground: cut square
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
  obovate: [[0, 0], [0.2, 0.07], [0.45, 0.15], [0.7, 0.22], [0.88, 0.19], [0.98, 0.07], [1, 0]],
  paddle: [[0, 0], [0.2, 0.05], [0.5, 0.11], [0.75, 0.15], [0.9, 0.12], [0.99, 0.04], [1, 0]],
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
function bark(ctx, spine, w0, w1, { seed = 1, tone = C.bark, alpha = 0.45, grain = true, dots = true, capA = true, capB = true } = {}) {
  const out = limbPts(spine, w0, w1, capA, capB);
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
  const paths = list.map(([s, w0, w1, cA = true, cB = true]) => limbPts(s, w0, w1, cA, cB));
  leather(ctx, union(paths));
  list.forEach(([s, w0, w1, cA = true, cB = true], i) => bark(ctx, s, w0, w1, { ...opts, seed: (opts.seed || 1) + i * 7, capA: cA, capB: cB }));
  return paths;
}

// Palm-trunk ring scars.
function rings(ctx, spine, w0, w1, { step = 13, seed = 1, tone = '#8a6a44', alpha = 0.5, capA = true, capB = true } = {}) {
  const out = limbPts(spine, w0, w1, capA, capB);
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
  const { lobes, base, leaf, back = C.deep, backA = 0.88, lace = 1, seed = 1 } = sp;
  const twigs = sp.twigs || lobes.map(([x, y]) => [[base, [lerp(base[0], x, 0.5) + (r() - 0.5) * 24, lerp(base[1], y, 0.6)], [x, y]], sp.tw0 ?? 12, sp.tw1 ?? 4]);
  const blobs = lobes.map(([x, y, rx, ry], i) => blobPts(x, y, rx * 0.9, ry * 0.88, { seed: seed * 13 + i, wobble: 0.14, n: 36 }));
  const backP = union(blobs);
  const twigP = union(twigs.map(([s, w0, w1]) => limbPts(s, w0, w1)));
  if (back) {
    leather(ctx, backP, { edge: false });
    dye(ctx, backP, back, backA);
    let bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y, rx, ry] of lobes) bb = [Math.min(bb[0], x - rx), Math.min(bb[1], y - ry), Math.max(bb[2], x + rx), Math.max(bb[3], y + ry)];
    if (lace) laceCut(ctx, union(blobs.map((b) => inset(b, 4))), bb, base, clamp(leaf.s * 0.42, 6.5, 10) * lace, seed, sp.laceKeep ?? 0.8);
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
        const push = (s.push ?? 1) * (lv * (220 + 260 * gust) + 30 * Math.sin(time * 1.1 + s.ph)) * (0.7 + 0.3 * Math.sin(time * 3.3 + s.ph * 2));
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
    rings(ctx, low, 46, 34, { seed: 3, step: 12, capB: false });
  }, { px: 1.4 });
  const top = piece('fo-coco-top', [limbPts(up, 35, 24), box(crown[0] - 70, crown[1] - 30, crown[0] + 70, crown[1] + 150)], (ctx) => {
    // old fronds hanging dry under the crown
    for (const [a, l] of [[2.0, 130], [1.15, 120]]) {
      const g = frondGeom(crown, a, l, { droop: 0.3, wid: 34, dry: true, seed: 9 + l });
      drawFrond(ctx, g, { dry: true, seed: 4 });
    }
    rings(ctx, up, 35, 24, { seed: 5, step: 11, capA: false });
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
    rings(ctx, low, 48, 40, { seed: 7, step: 26, tone: '#6d4a2c', alpha: 0.55, capB: false });
    ladder(ctx, 0, -424);
  }, { px: 1.4 });
  const top = piece('fo-tan-top', [limbPts(up, 41, 36), box(-100, hub[1] - 20, 100, hub[1] + 190), box(20, -730, 52, -415)], (ctx) => {
    // skirt of dead fans under the crown
    [[1.9, 60, 70], [1.25, 60, 72], [2.5, 50, 60], [0.65, 50, 60]].forEach(([a, pl, R], i) => drawFan(ctx, fanGeom(hub, a, pl, R, { droop: 0.5, spread: 2.2, n: 14, seed: 30 + i }), { dry: true }));
    rings(ctx, up, 41, 36, { seed: 8, step: 24, tone: '#6d4a2c', alpha: 0.55, capA: false });
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
    const gs = list.map(([a, pl, R, sp], i) => fanGeom(hub, a, pl, R, { spread: sp || 3.3, seed: hashId(id) + i, droop: 0.18, n: 17 }));
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
    fanL: { pc: fans('l', [[-2.85, 70, 100, 2.9], [-2.4, 84, 106, 3.0], [-3.3, 56, 92, 2.8]], [C.jade, C.leaf]), z: -1, parent: 'top', j: hub, lim: [-0.4, 0.4], stiff: 0.8, sway: { flex: 1.1, om: 7 } },
    fanT: { pc: fans('t', [[-1.98, 92, 106, 3.0], [-1.57, 100, 110, 3.0], [-1.16, 92, 106, 3.0]], [C.leaf, C.jade]), z: -2, parent: 'top', j: hub, lim: [-0.4, 0.4], stiff: 0.8, sway: { flex: 0.9, om: 7.5 } },
    fanR: { pc: fans('r', [[-0.74, 84, 106, 3.0], [-0.29, 70, 100, 2.9], [0.16, 56, 92, 2.8]], [C.jade, C.leaf2]), z: -1, parent: 'top', j: hub, lim: [-0.4, 0.4], stiff: 0.8, sway: { flex: 1.1, om: 7 } },
    fanF: { pc: fans('f', [[-2.1, 40, 84, 2.8], [-1.05, 40, 84, 2.8], [-1.57, 30, 70, 2.8]], [C.leaf2, C.lime]), z: 1, parent: 'top', j: hub, lim: [-0.3, 0.3], stiff: 0.8, sway: { flex: 0.8, om: 8 } },
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
function broadleaf(spec, more = []) {
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
  for (const m of more) parts[m.id] = { pc: m.pc, z: m.z ?? 1, parent: m.parent || 'trunk', j: m.j, lim: [-0.4, 0.4], stiff: 0.85, sway: m.sway || { flex: 1.2, om: 7.5 } };
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
    leaf: { kind: 'lance', s: 30, sj: 0.18, droop: 0.6, rim: 0.26, inner: 0.9, alpha: 0.9, colors: [[C.deep, 2], [C.leaf, 3], [C.jade, 2], [C.moss, 1.5], [C.leaf2, 1.5]] },
    back: C.deep,
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

// ต้นไทร — banyan: fused trunks, great level boughs, pillar roots already
// planted and curtains of young aerial roots swinging from the limbs.
function strands(name, x, y, list, { seed = 1, col = C.bark } = {}) {
  // list: [[dx, len, wob]...] strands hanging from (x + dx, y)
  const r = rng(seed);
  const geo = list.map(([dx, len, wob]) => {
    const pts = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push([x + dx + Math.sin(t * 5 + dx) * wob * t + (r() - 0.5) * 2, y + t * len]); }
    return pts;
  });
  return piece(name, [[[x, y - 4]], ...geo], (ctx) => {
    leather(ctx, poly(limbPts([[x + Math.min(...list.map((l) => l[0])) - 4, y], [x + Math.max(...list.map((l) => l[0])) + 4, y]], 7, 7)));
    geo.forEach((g, i) => {
      const o = limbPts(g, 4.2, 1.6);
      leather(ctx, poly(o));
      dye(ctx, poly(o), col, 0.45);
      dotLine(ctx, g.slice(1, -1), { spacing: 5, r: 0.7, seed: seed + i });
      const e = g[g.length - 1];
      for (const a of [1.2, 1.9]) leather(ctx, poly(limbPts([e, [e[0] + Math.cos(a) * 9, e[1] + Math.sin(a) * 9]], 1.6, 0.6)));
    });
  }, { px: 1.6 });
}
function banyan() {
  const L = [[[-8, -360], [-120, -410], [-250, -432], [-340, -428]], 38, 14];
  const R = [[[8, -360], [126, -412], [256, -432], [346, -426]], 38, 14];
  const bases = { k1: [-300, -432], k2: [-170, -424], k3: [-50, -470], k4: [60, -476], k5: [180, -424], k6: [306, -430] };
  const hangAt = [[-276, -432, 'h1', 'k1'], [-120, -416, 'h2', 'trunk'], [134, -418, 'h3', 'trunk'], [268, -432, 'h4', 'k6'], [-210, -428, 'h5', 'trunk'], [212, -428, 'h6', 'trunk']];
  return broadleaf({
    name: 'fo-sai', mass: 6,
    trunk: [
      [[[-34, 0], [-22, -190], [-10, -380]], 56, 36], [[[36, 0], [20, -200], [10, -380]], 56, 36], [[[0, 0], [6, -180], [0, -400]], 60, 40],
      L, R, [[[0, -390], [-26, -440], [-50, -470]], 30, 16], [[[0, -390], [30, -446], [60, -476]], 30, 16],
      [[[-50, -40], [-120, -10], [-170, 0]], 30, 6], [[[50, -40], [124, -10], [176, 0]], 30, 6],
      // pillar roots that have reached the ground
      [[[-236, -432], [-244, -220], [-240, 0]], 12, 16], [[[244, -432], [250, -210], [246, 0]], 12, 16], [[[-300, -430], [-296, -200], [-306, 0]], 8, 11],
    ],
    trunkBox: [box(-320, -40, 320, 6)],
    under: (ctx) => ground(ctx, -330, 330, 41, 9),
    decoTrunk: (ctx) => {
      // twisted fused-stem grooves
      for (const x of [-18, 18]) slit(ctx, [[x, -20], [x * 0.7, -140], [x * 1.1, -260], [x * 0.4, -370]], 1.3);
      // cloth ribbons tied round by the villagers
      [[-150, INK.red], [-138, C.sun], [-126, C.pink]].forEach(([y, col]) => {
        const b = [[-62, y - 4], [64, y - 8], [64, y + 4], [-62, y + 8]];
        leather(ctx, poly(b)); dye(ctx, poly(inset(b, 1)), col, 0.95);
      });
      for (const [dx, col] of [[0, INK.red], [10, C.sun], [20, C.pink]]) {
        const t = limbPts([[58, -140 + dx * 0.2], [70 + dx, -110], [62 + dx, -70]], 7, 4);
        leather(ctx, poly(t)); dye(ctx, poly(inset(t, 1)), col, 0.95);
      }
    },
    leaf: { kind: 'almond', s: 17, sj: 0.2, droop: 0.3, rim: 0.42, inner: 0.45, alpha: 0.9, colors: [[C.deep, 3], [C.leaf, 3], [C.jade, 3], [C.teal, 1], [C.leaf2, 1.5]] },
    back: C.deep, backA: 0.78,
    clusters: [
      L3(bases.k1, [[-330, -490, 96, 58], [-270, -520, 60, 42]], { id: 'k1', z: -1, extras: figs }),
      L3(bases.k2, [[-190, -540, 118, 72]], { id: 'k2', z: -2 }),
      L3(bases.k3, [[-44, -640, 126, 78]], { id: 'k3', z: -3, om: 10, extras: figs }),
      L3(bases.k4, [[92, -636, 118, 76]], { id: 'k4', z: -3, om: 10 }),
      L3(bases.k5, [[198, -540, 118, 72]], { id: 'k5', z: -2, extras: figs }),
      L3(bases.k6, [[334, -490, 96, 58], [276, -522, 60, 42]], { id: 'k6', z: -1 }),
    ],
    hang: hangAt.map(([x, y, id, parent], i) => ({
      id, parent, j: [x, y], push: 1.1, z: 2,
      pc: strands('fo-sai-' + id, x, y, [[-16, 150 + i * 20, 8], [-5, 220 + (i % 3) * 30, 10], [7, 180, 7], [17, 120 + i * 12, 6]], { seed: i + 3 }),
    })),
  });
}
function figs(ctx, r, list) {
  list.filter(() => r() < 0.12).forEach((l) => {
    const d = new Path2D(); d.arc(l.x, l.y, 3.4, 0, TAU);
    leather(ctx, d); dye(ctx, d, r() < 0.5 ? C.amber : C.rust, 0.95); hole(ctx, l.x, l.y, 0.8);
  });
}

// ต้นลีลาวดี — frangipani: a candelabra of blunt grey boughs, each tipped
// with a rosette of long leaves and a posy of pinwheel flowers.
function frangipaniTree() {
  const fork = [0, -150];
  const tips = [[-186, -300, 'r1'], [-92, -364, 'r2'], [14, -402, 'r3'], [112, -352, 'r4'], [192, -282, 'r5']];
  const boughs = tips.map(([x, y], i) => [[fork, [lerp(fork[0], x, 0.45) + (i % 2 ? 12 : -12), lerp(fork[1], y, 0.5) - 20], [x, y]], 26, 15]);
  const rosette = (x, y, id, i) => {
    const r = rng(hashId(id));
    const pink = id === 'r4';
    const leaves = [];
    for (let k = 0; k < 12; k++) {
      const a = -Math.PI / 2 + (k - 5.5) * 0.3 + (r() - 0.5) * 0.12;
      leaves.push({ a: angMix(a, Math.PI / 2, Math.abs(k - 5.5) > 3.5 ? 0.3 : 0), s: 66 + r() * 20 });
    }
    const flowers = [];
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI / 2 + (k - 4) * 0.42;
      const rr = k === 4 ? 4 : 22 + (k % 2) * 12;
      flowers.push([x + Math.cos(a) * rr + (r() - 0.5) * 6, y - 50 + Math.sin(a) * rr * 0.7 + (r() - 0.5) * 6, 17 + r() * 4, r() * TAU]);
    }
    return piece('fo-leela-' + id, [box(x - 105, y - 120, x + 105, y + 50)], (ctx) => {
      const lp = leaves.map((l) => leafPts('paddle', x, y, l.s, l.a));
      const P = union(lp);
      leather(ctx, P, { edge: false });
      lp.forEach((p, k) => dye(ctx, poly(inset(p, 1.2)), [C.leaf, C.jade, C.leaf2][k % 3], 0.9));
      line(ctx, P, 'rgba(14,9,5,0.95)', 1.1);
      const V = new Path2D();
      leaves.forEach((l) => {
        const c = Math.cos(l.a), s = Math.sin(l.a);
        V.moveTo(x + c * 8, y + s * 8); V.lineTo(x + c * l.s * 0.9, y + s * l.s * 0.9);
        for (let t = 0.3; t < 0.85; t += 0.13) for (const sd of [-1, 1]) {
          const va = l.a + sd * 1.05;
          V.moveTo(x + c * l.s * t, y + s * l.s * t);
          V.lineTo(x + c * l.s * t + Math.cos(va) * l.s * 0.14 * Math.sin(t * Math.PI + 0.3), y + s * l.s * t + Math.sin(va) * l.s * 0.14 * Math.sin(t * Math.PI + 0.3));
        }
      });
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 0.8; ctx.stroke(V); ctx.restore();
      leather(ctx, poly(limbPts([[x, y + 4], [x, y - 40]], 5, 3)));
      for (const [fx, fy] of flowers) leather(ctx, poly(limbPts([[x, y - 36], [fx, fy]], 2.2, 1.6)));
      flowers.forEach(([fx, fy, s, rot]) => frangipani(ctx, fx, fy, s, rot, pink ? { petal: C.pink, heart: C.sun } : { petal: C.white, heart: C.sun }));
      void i;
    }, { px: 1.6 });
  };
  return broadleaf({
    name: 'fo-leela', mass: 3,
    barkTone: C.grey, barkA: 0.4,
    trunk: [[[[0, 0], [5, -90], fork], 42, 32], ...boughs, [[[-12, -18], [-40, 0]], 16, 8], [[[12, -18], [42, 0]], 16, 8]],
    trunkBox: [box(-80, -20, 80, 6)],
    under: (ctx) => ground(ctx, -80, 80, 51, 8),
    decoTrunk: (ctx) => {
      // leaf-scar rings on the blunt branch tips
      boughs.forEach(([s]) => { const c = curve(s, false, 10); for (const t of [0.55, 0.72, 0.88]) { const [x, y, a] = along(c, t); const n = [-Math.sin(a) * 6, Math.cos(a) * 6]; slit(ctx, [[x - n[0], y - n[1]], [x + n[0], y + n[1]]], 0.9, { smoothIt: false }); } });
      for (const [x, y] of tips) { const k = blobPts(x, y, 10, 8, { seed: x }); leather(ctx, poly(k)); dye(ctx, poly(k), C.grey, 0.4); }
    },
    leaf: { kind: 'obovate', s: 10, colors: [[C.leaf, 1]] },
    clusters: [],
    hang: [],
    extra: {},
  }, tips.map(([x, y, id], i) => ({ id, j: [x, y], pc: rosette(x, y, id, i), z: i === 2 ? -1 : 1 })));
}

// ต้นราชพฤกษ์ — golden shower, Thailand's national tree: a light canopy
// hung with long chains of yellow blossom that swing in every breeze.
function chains(name, x, y, list, seed = 1) {
  // list: [[dx, len]...]
  const r = rng(seed);
  const geo = list.map(([dx, len]) => {
    const pts = [];
    for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([x + dx + Math.sin(t * 3 + dx) * 4 * t + (r() - 0.5), y + t * len]); }
    return pts;
  });
  return piece(name, [[[x, y - 4]], ...geo.map((g) => g.map(([px, py]) => [px - 13, py + 8])), ...geo.map((g) => g.map(([px, py]) => [px + 13, py + 8]))], (ctx) => {
    geo.forEach((g) => leather(ctx, poly(limbPts([[x, y], g[0]], 2.4, 1.8))));
    geo.forEach((g, gi) => {
      leather(ctx, poly(limbPts(g, 2.2, 1.2)));
      const pts = resample(curve(g, false, 6), 5.2);
      pts.forEach(([px, py], k) => {
        const t = k / pts.length;
        if (t < 0.08) return;
        const s = lerp(6.4, 2.6, t) * (0.85 + r() * 0.3);
        const side = k % 2 ? 1 : -1;
        const fx = px + side * s * 0.9, fy = py + s * 0.4;
        if (t > 0.86) { const b = ellipsePts(fx, fy, s * 0.6, s * 0.8, 8); leather(ctx, poly(b)); dye(ctx, poly(b), C.olive, 0.9); return; }
        leather(ctx, poly(limbPts([[px, py], [fx, fy]], 1, 0.8)));
        blossom(ctx, fx, fy, s, t < 0.5 ? C.sun : INK.yellow);
      });
      void gi;
    });
  }, { px: 1.7 });
}
function goldenShower() {
  const fork = [0, -276];
  const bases = { g1: [-196, -398], g2: [-60, -466], g3: [70, -476], g4: [206, -390], g5: [0, -470] };
  const boughs = [[[fork, [-110, -350], bases.g1], 22, 10], [[fork, [-40, -400], bases.g2], 22, 10], [[fork, [48, -410], bases.g3], 22, 10], [[fork, [120, -346], bases.g4], 22, 10], [[fork, [2, -390], bases.g5], 18, 9]];
  const ch = (id, parent, x, y, list, seed) => ({ id, parent, j: [x, y], z: 3, push: 1.3, om: 1.4, pc: chains('fo-rp-' + id, x, y, list, seed) });
  return broadleaf({
    name: 'fo-rp', mass: 3,
    trunk: [[[[0, 0], [6, -160], fork], 44, 30], ...boughs, [[[-12, -24], [-44, 0]], 18, 8], [[[12, -24], [46, 0]], 18, 8]],
    trunkBox: [box(-90, -20, 90, 6)],
    under: (ctx) => ground(ctx, -90, 90, 61, 8),
    leaf: { kind: 'oval', s: 15, sj: 0.2, droop: 0.35, rim: 0.4, inner: 0.35, alpha: 0.88, veins: 'mid', colors: [[C.leaf2, 3], [C.lime, 2], [C.leaf, 2], [C.sun, 0.6]] },
    back: C.leaf, backA: 0.7, lace: 1.3,
    clusters: [
      L3(bases.g1, [[-226, -440, 92, 56]], { id: 'g1', z: -1 }),
      L3(bases.g2, [[-82, -540, 100, 60]], { id: 'g2', z: -2 }),
      L3(bases.g3, [[84, -548, 100, 60]], { id: 'g3', z: -2 }),
      L3(bases.g4, [[238, -432, 92, 56]], { id: 'g4', z: -1 }),
      L3(bases.g5, [[2, -600, 82, 46]], { id: 'g5', z: -3, om: 10 }),
    ],
    hang: [
      ch('c1', 'g1', -236, -412, [[-18, 150], [0, 196], [18, 132]], 1),
      ch('c2', 'g2', -96, -506, [[-16, 170], [4, 214], [20, 150]], 2),
      ch('c3', 'g3', 96, -512, [[-18, 160], [0, 200], [16, 176]], 3),
      ch('c4', 'g4', 244, -404, [[-16, 140], [2, 186], [18, 150]], 4),
      ch('c5', 'trunk', -150, -372, [[-10, 130], [8, 164]], 5),
      ch('c6', 'trunk', 160, -366, [[-8, 150], [10, 118]], 6),
    ],
  });
}

// ต้นหูกวาง — Indian almond: pagoda tiers of level branches with big
// paddle leaves, a few turned red and amber.
function hukwang() {
  const tiers = [[-210, 250], [-330, 214], [-452, 168], [-560, 112]];
  const parts = {};
  const trunkSp = [[0, 0], [2, -300], [0, -620]];
  const trunk = piece('fo-hk-trunk', [limbPts(trunkSp, 36, 12), box(-90, -20, 90, 6)], (ctx) => {
    ground(ctx, -90, 90, 71, 8);
    limbs(ctx, [[trunkSp, 36, 12], [[[-10, -20], [-44, 0]], 18, 8], [[[10, -20], [46, 0]], 18, 8]], { seed: 71 });
  }, { px: 1.4 });
  parts.trunk = { pc: trunk, z: 0, mass: 3 };
  const tier = (id, y, W, dir, k) => {
    const x0 = dir * 6;
    const bough = [[x0, y], [dir * W * 0.45, y - 8], [dir * W, y - 22]];
    const ros = [[dir * W, y - 22, 1], [dir * W * 0.55, y - 12, 0.8]];
    const r = rng(hashId(id));
    const leaves = [];
    ros.forEach(([rx, ry, sc]) => {
      for (let n = 0; n < 13; n++) {
        const a = -Math.PI / 2 + (n - 6) * 0.3 + (r() - 0.5) * 0.12 + dir * 0.25;
        leaves.push({ x: rx, y: ry, s: (50 + r() * 14) * sc * (1 - k * 0.06), a: angMix(a, Math.PI / 2, Math.abs(n - 6) > 3 ? 0.3 : 0.05), col: r() < 0.16 ? pick(r, [[C.rust, 2], [C.amber, 2], [INK.red, 1]]) : pick(r, [[C.leaf, 3], [C.jade, 2], [C.leaf2, 2], [C.deep, 1]]) });
      }
    });
    const pc = piece('fo-hk-' + id, [bough, box(Math.min(x0, dir * W) - 70, y - 90, Math.max(x0, dir * W) + 70, y + 40)], (ctx) => {
      leather(ctx, poly(limbPts(bough, 12 - k, 6)));
      bark(ctx, bough, 12 - k, 6, { seed: k, grain: false });
      const lp = leaves.map((l) => leafPts('obovate', l.x, l.y, l.s, l.a));
      const P = union(lp);
      leather(ctx, P, { edge: false });
      lp.forEach((p, n) => dye(ctx, poly(inset(p, 1.3)), leaves[n].col, 0.9));
      line(ctx, P, 'rgba(14,9,5,0.95)', 1.1);
      line(ctx, P, INK.goldLine, 0.5, { alpha: 0.7 });
      const V = new Path2D();
      leaves.forEach((l) => veinPath(V, l, 'obovate', true));
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 0.9; ctx.stroke(V); ctx.restore();
      ros.forEach(([rx, ry]) => { dotFlower(ctx, rx, ry, 1, 5, 2.4); });
    }, { px: 1.4 });
    parts[id] = { pc, z: dir > 0 ? 1 : -1, parent: 'trunk', j: [x0, y], lim: [-0.35, 0.35], stiff: 0.85, sway: { flex: 1 + k * 0.15, om: 8.5 - k * 0.4 } };
  };
  tiers.forEach(([y, W], k) => { tier('t' + k + 'L', y, W, -1, k); tier('t' + k + 'R', y + 6, W * 0.94, 1, k); });
  const r = rng(77);
  const topL = [];
  for (let n = 0; n < 12; n++) topL.push({ x: 0, y: -618, s: 44 + r() * 8, a: -Math.PI / 2 + (n - 5.5) * 0.3, col: [C.leaf2, C.jade, C.leaf, C.amber][n % 4] });
  parts.top = {
    pc: piece('fo-hk-top', [box(-70, -690, 70, -600)], (ctx) => {
      const lp = topL.map((l) => leafPts('obovate', l.x, l.y, l.s, l.a));
      const P = union(lp); leather(ctx, P, { edge: false });
      lp.forEach((p, n) => dye(ctx, poly(inset(p, 1.3)), topL[n].col, 0.9));
      line(ctx, P, 'rgba(14,9,5,0.95)', 1.1);
      const V = new Path2D(); topL.forEach((l) => veinPath(V, l, 'obovate', true));
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 0.9; ctx.stroke(V); ctx.restore();
    }, { px: 1.4 }),
    z: 0, parent: 'trunk', j: [0, -612], lim: [-0.35, 0.35], stiff: 0.85, sway: { flex: 1.3, om: 7 },
  };
  return plant(parts);
}

// กอไผ่ — bamboo clump: every culm bends in two places, so in a gale the
// whole clump whips and bows with the gusts.
function bamboo() {
  const culms = [[-44, 520, -0.95], [-28, 690, -0.5], [-12, 800, -0.2], [4, 760, 0.12], [20, 700, 0.45], [36, 600, 0.8], [-58, 420, -1.25]];
  const parts = {};
  const geo = culms.map(([bx, h, lean], i) => {
    const c = qbez([bx, 0], [bx + lean * h * 0.08, -h * 0.5], [bx + lean * h * 0.45, -h], 40);
    const cut1 = c.findIndex(([, y]) => y < -210);
    const cut2 = Math.round(lerp(cut1, 40, 0.48));
    return { c, cut1, cut2, w: 15 - Math.abs(lean) * 3.5, i };
  });
  const culmDraw = (ctx, g, a, b) => {
    const seg = g.c.slice(a, b + 1);
    const t0 = a / 40, t1 = b / 40;
    const w0 = lerp(g.w, g.w * 0.45, t0), w1 = lerp(g.w, g.w * 0.45, t1);
    const o = limbPts(seg, w0, w1, false, b === 40);
    leather(ctx, poly(o));
    dye(ctx, poly(inset(o, 2)), g.i % 2 ? C.olive : C.jade, 0.55);
    const L = seg.length;
    for (let k = 3; k < L - 1; k += 5) {
      const [x, y] = seg[k], [x2, y2] = seg[k + 1];
      const an = Math.atan2(y2 - y, x2 - x), hw = lerp(w0, w1, k / L) / 2 + 1.5;
      const nx = -Math.sin(an), ny = Math.cos(an);
      leather(ctx, poly([[x - nx * hw, y - ny * hw], [x + nx * hw, y + ny * hw], [x + nx * hw + Math.cos(an) * 3, y + ny * hw + Math.sin(an) * 3], [x - nx * hw + Math.cos(an) * 3, y - ny * hw + Math.sin(an) * 3]]));
      slit(ctx, [[x - nx * (hw - 2.5), y - ny * (hw - 2.5)], [x + nx * (hw - 2.5), y + ny * (hw - 2.5)]], 0.9, { smoothIt: false });
    }
    if (w0 > 7) gold(ctx, offset(seg, -w0 * 0.2).slice(1, -1), 0.9, { smoothIt: false });
    if (w0 > 8) dotLine(ctx, offset(seg, w0 * 0.16).slice(1, -1), { spacing: 5, r: 0.8, seed: g.i, smoothIt: false });
  };
  const sprays = (g, a, b) => {
    const r = rng(g.i * 7 + a);
    const out = [];
    for (let k = a + 2; k < b; k += 3) {
      const t = k / 40;
      if (t < 0.3) continue;
      const [x, y] = g.c[k], [x2, y2] = g.c[k + 1];
      const an = Math.atan2(y2 - y, x2 - x);
      const side = k % 2 ? 1 : -1;
      const tw = an + side * 1.25, tl = 34 * (1.1 - t * 0.4);
      const tip = [x + Math.cos(tw) * tl, y + Math.sin(tw) * tl];
      const lv = [];
      for (let j = 0; j < 4 + (k % 2); j++) lv.push({ x: tip[0], y: tip[1], s: (42 + r() * 14) * (1.1 - t * 0.35), a: tw + side * (0.3 + j * 0.32) + 0.55, col: pick(r, [[C.leaf, 3], [C.lime, 1.5], [C.leaf2, 2], [C.jade, 2]]) });
      out.push({ x, y, tip, lv });
    }
    return out;
  };
  const drawSprays = (ctx, list) => {
    const T = new Path2D(), all = [];
    list.forEach((s) => { addPts(T, limbPts([[s.x, s.y], s.tip], 2.6, 1.3)); s.lv.forEach((l) => all.push(l)); });
    leather(ctx, T);
    const lp = all.map((l) => leafPts('lance', l.x, l.y, l.s, l.a, { bend: 0.06 }));
    const P = union(lp);
    leather(ctx, P, { edge: false });
    const by = new Map();
    all.forEach((l, i) => { if (!by.has(l.col)) by.set(l.col, new Path2D()); addPts(by.get(l.col), inset(lp[i], 0.8)); });
    by.forEach((p, c) => dye(ctx, p, c, 0.9));
    line(ctx, P, 'rgba(14,9,5,0.9)', 0.9);
    const V = new Path2D(); all.forEach((l) => veinPath(V, l, 'lance', false));
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 0.8; ctx.stroke(V); ctx.restore();
  };
  const outlineOf = (g, a, b, sp) => [g.c.slice(a, b + 1), ...sp.map((s) => [[s.tip[0] - 60, s.tip[1] - 60], [s.tip[0] + 60, s.tip[1] + 60]])];
  const base = piece('fo-phai-base', [box(-110, -250, 110, 6), ...geo.map((g) => g.c.slice(0, g.cut1 + 1))], (ctx) => {
    ground(ctx, -104, 104, 81, 10);
    geo.forEach((g) => culmDraw(ctx, g, 0, g.cut1));
    // young shoots (หน่อไม้)
    for (const [x, s] of [[-86, 1], [70, 0.8], [96, 0.6]]) {
      const sh = [[x - 14 * s, 0], [x - 10 * s, -22 * s], [x - 3 * s, -44 * s], [x + 2 * s, -58 * s], [x + 6 * s, -40 * s], [x + 12 * s, -20 * s], [x + 14 * s, 0]];
      leather(ctx, smooth(sh)); dye(ctx, smooth(inset(sh, 1.2)), C.sun, 0.6);
      for (let k = 1; k < 4; k++) gold(ctx, [[x - 12 * s + k * 2, -k * 12 * s], [x, -k * 12 * s - 6 * s], [x + 12 * s - k * 2, -k * 12 * s]], 0.8);
    }
  }, { px: 1.4 });
  parts.base = { pc: base, z: 0, mass: 3 };
  geo.forEach((g) => {
    const spB = sprays(g, g.cut1, g.cut2), spC = sprays(g, g.cut2, 40);
    const idB = 'c' + g.i, idC = 'c' + g.i + 'b';
    parts[idB] = {
      pc: piece('fo-phai-' + idB, outlineOf(g, g.cut1, g.cut2, spB), (ctx) => { culmDraw(ctx, g, g.cut1, g.cut2); drawSprays(ctx, spB); }, { px: 1.4 }),
      z: g.i % 2 ? -1 : 1, parent: 'base', j: g.c[g.cut1], lim: [-0.3, 0.3], stiff: 0.9, sway: { flex: 0.6, om: 7, freq: 0.7 + g.i * 0.05 },
    };
    parts[idC] = {
      pc: piece('fo-phai-' + idC, outlineOf(g, g.cut2, 40, spC), (ctx) => { culmDraw(ctx, g, g.cut2, 40); drawSprays(ctx, spC); }, { px: 1.4 }),
      z: g.i % 2 ? -1 : 1, parent: idB, j: g.c[g.cut2], lim: [-0.4, 0.4], stiff: 0.85, sway: { flex: 0.9, om: 6, freq: 0.9 + g.i * 0.05 },
    };
  });
  return plant(parts);
}

// ต้นหมาก — areca palm: a slender ringed stem with a green crownshaft,
// arching fronds and a bunch of ripe orange nuts; a betel vine (พลู)
// climbs its foot, the pair every Thai garden grows together.
function areca() {
  const low = [[0, 0], [-4, -200], [-6, -400]];
  const up = [[-6, -400], [0, -560], [10, -700]];
  const shaft = [[10, -700], [12, -772]];
  const crown = [12, -776];
  const trunk = piece('fo-mak-trunk', [limbPts(low, 19, 15), box(-60, -380, 60, 6)], (ctx) => {
    ground(ctx, -54, 54, 91, 8);
    rings(ctx, low, 19, 15, { seed: 9, step: 16, tone: C.grey, alpha: 0.45, capB: false });
    // betel vine spiralling up
    const vine = [];
    for (let y = -6; y > -360; y -= 8) vine.push([Math.sin(y * 0.045) * 14 - 2, y]);
    leather(ctx, poly(limbPts(vine, 2.6, 1.6)));
    const lf = [];
    vine.forEach(([x, y], i) => { if (i % 3 === 1) lf.push({ x, y, s: 17 - i * 0.12, a: (i % 2 ? -0.5 : Math.PI + 0.5) + (i % 4 ? 0.2 : -0.2) }); });
    const lp = lf.map((l) => leafPts('heart', l.x, l.y, l.s, l.a));
    const P = union(lp);
    leather(ctx, P, { edge: false });
    lp.forEach((p, i) => dye(ctx, poly(inset(p, 1)), [C.leaf2, C.leaf, C.lime][i % 3], 0.92));
    line(ctx, P, INK.goldLine, 0.5, { alpha: 0.8 });
    const V = new Path2D(); lf.forEach((l) => veinPath(V, l, 'heart', true));
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 0.7; ctx.stroke(V); ctx.restore();
  }, { px: 1.6 });
  const top = piece('fo-mak-top', [limbPts(up, 15, 13), limbPts(shaft, 19, 15), box(-30, -790, 50, -395)], (ctx) => {
    rings(ctx, up, 15, 13, { seed: 10, step: 15, tone: C.grey, alpha: 0.45, capA: false });
    const cs = limbPts([[10, -698], [13, -740], [12, -774]], 18, 15);
    leather(ctx, poly(cs));
    dye(ctx, poly(inset(cs, 1.5)), C.jade, 0.85);
    dye(ctx, poly(inset(cs, 5)), C.lime, 0.4);
    gold(ctx, [[8, -704], [10, -770]], 0.9);
    line(ctx, [[3, -702], [21, -702]], INK.goldLine, 1.6, { smoothIt: false });
  }, { px: 1.6 });
  const fr = (id, specs) => frondPiece('fo-mak-' + id, crown, specs.map((s) => ({ wid: 40, gap: 7, lw: 3.8, arch: 0.2, ...s })), { colors: [C.leaf2, C.jade], px: 1.5 });
  const nuts = piece('fo-mak-nuts', [box(-40, -712, 70, -600)], (ctx) => {
    const st = [[10, -708], [30, -690], [38, -660]];
    leather(ctx, poly(limbPts(st, 4, 2.5)));
    const r = rng(5);
    for (const [a, l] of [[1.2, 40], [0.7, 44], [1.7, 36], [0.3, 30]]) leather(ctx, poly(limbPts([[30, -690], [30 + Math.cos(a) * l, -690 + Math.sin(a) * l]], 2, 1.2)));
    for (let k = 0; k < 16; k++) {
      const a = 0.2 + r() * 1.6, l = 12 + r() * 32;
      const x = 30 + Math.cos(a) * l, y = -690 + Math.sin(a) * l + 6;
      fruit(ctx, x, y, 5.5, 7, pick(r, [[C.amber, 3], [C.sun, 1], [C.leaf2, 2], [C.rust, 1]]), { seed: k + 40 });
    }
  }, { px: 1.8 });
  return plant({
    trunk: { pc: trunk, z: 0, mass: 3 },
    top: { pc: top, z: 0, parent: 'trunk', j: low[2], lim: [-0.25, 0.25], stiff: 0.9, sway: { flex: 0.45, om: 8, freq: 0.5 } },
    fL: { pc: fr('fl', [{ a: -2.85, len: 175, droop: 0.5 }, { a: -2.45, len: 190, droop: 0.34 }]), z: -1, parent: 'top', j: crown, lim: [-0.5, 0.5], stiff: 0.8, sway: { flex: 1.5, om: 6.5 } },
    fU: { pc: fr('fu', [{ a: -2.0, len: 196, droop: 0.2 }, { a: -1.6, len: 180, droop: 0.08 }]), z: -2, parent: 'top', j: crown, lim: [-0.5, 0.5], stiff: 0.8, sway: { flex: 1.2, om: 7 } },
    fV: { pc: fr('fv', [{ a: -1.25, len: 188, droop: 0.12 }, { a: -0.9, len: 196, droop: 0.24 }]), z: -2, parent: 'top', j: crown, lim: [-0.5, 0.5], stiff: 0.8, sway: { flex: 1.2, om: 7 } },
    fR: { pc: fr('fr', [{ a: -0.55, len: 185, droop: 0.4 }, { a: -0.2, len: 170, droop: 0.55 }]), z: 1, parent: 'top', j: crown, lim: [-0.5, 0.5], stiff: 0.8, sway: { flex: 1.5, om: 6.5 } },
    nuts: { pc: nuts, z: 2, parent: 'top', j: [10, -708], lim: [-0.5, 0.5], stiff: 0.2, sway: { hang: true, push: 0.4, om: 3 } },
  });
}

// ต้นยางนา — the tall dipterocarp of the old forest: plank buttresses, a
// resin-tapping hollow glowing with its ember, a staghorn fern clinging
// high up, and a crown of clusters with winged seeds spinning below.
function yangna() {
  const low = [[0, 0], [2, -220], [0, -420]];
  const up = [[0, -420], [3, -560], [0, -660]];
  const bases = { y1: [-126, -716], y2: [-40, -748], y3: [48, -752], y4: [132, -712], y5: [0, -690] };
  const trunk = piece('fo-yang-trunk', [limbPts(low, 66, 50, true, false), box(-150, -130, 150, 6)], (ctx) => {
    ground(ctx, -150, 150, 101, 9);
    // plank buttresses
    for (const d of [-1, 1]) for (const [w, h] of [[130, 120], [84, 150]]) {
      const b = [[d * 20, -h], [d * 34, -h * 0.6], [d * w * 0.7, -h * 0.18], [d * w, 2], [d * 18, 2]];
      leather(ctx, smooth(b));
      dye(ctx, smooth(inset(b, 3)), C.bark, 0.4);
      gold(ctx, [[d * 24, -h * 0.92], [d * 40, -h * 0.5], [d * w * 0.8, -4]], 0.9);
    }
    limbs(ctx, [[low, 66, 50, true, false]], { seed: 101, tone: C.bark, alpha: 0.5 });
    // resin hollow with an ember (ขี้ไต้ / น้ำมันยาง)
    const hol = [[-12, -60], [-16, -96], [0, -122], [16, -96], [12, -60]];
    leather(ctx, smooth(inset(hol, -4)));
    dye(ctx, smooth(inset(hol, -3)), C.rust, 0.8);
    cut(ctx, smooth(hol));
    for (let k = 0; k < 3; k++) { const f = kanokPts(-4 + k * 4, -64, 16 - k * 3, -Math.PI / 2 + (k - 1) * 0.3, k === 2); leather(ctx, poly(f)); dye(ctx, poly(f), k === 1 ? C.sun : C.amber, 0.95); }
  }, { px: 1.3 });
  const top = piece('fo-yang-top', [limbPts(up, 50, 38), box(-160, -760, 160, -410)], (ctx) => {
    limbs(ctx, [[up, 50, 38, false, true], [[[0, -640], [-80, -690], bases.y1], 26, 12], [[[0, -646], [-20, -710], bases.y2], 22, 10], [[[0, -646], [24, -712], bases.y3], 22, 10], [[[0, -640], [84, -686], bases.y4], 26, 12]], { seed: 103 });
    // staghorn fern
    const sx = 20, sy = -560;
    const fr = [];
    for (let k = 0; k < 6; k++) { const a = -2.6 + k * 0.5; fr.push(kanokPts(sx, sy, 36 + (k % 2) * 10, a, k > 2)); }
    fr.forEach((p, k) => { leather(ctx, poly(p)); dye(ctx, poly(inset(p, 1)), k % 2 ? C.lime : C.leaf2, 0.9); gold(ctx, inset(p, 1.5), 0.5, { closed: true, smoothIt: false }); });
    const sh = blobPts(sx, sy, 18, 14, { seed: 3 });
    leather(ctx, poly(sh)); dye(ctx, poly(inset(sh, 1.5)), C.olive, 0.7); dotLine(ctx, inset(sh, 4), { closed: true, spacing: 3.4, r: 0.8 });
  }, { px: 1.3 });
  const seeds = (ctx, r, list) => {
    list.filter((l) => Math.sin(l.out) > 0.5 && r() < 0.14).forEach((l) => {
      const x = l.x, y = l.y + 30;
      for (const d of [-0.18, 0.18]) {
        const w = leafPts('strap', x, y, 34, -Math.PI / 2 + d);
        leather(ctx, poly(w)); dye(ctx, poly(inset(w, 0.8)), C.pink, 0.9); slit(ctx, [[x, y - 4], [x + Math.sin(d) * 26, y - 28]], 0.6, { smoothIt: false });
      }
      const n = ellipsePts(x, y + 3, 5, 6, 12); leather(ctx, poly(n)); dye(ctx, poly(n), C.rust, 0.9);
    });
  };
  const leaf = { kind: 'almond', s: 22, sj: 0.2, droop: 0.3, rim: 0.46, inner: 0.4, alpha: 0.9, colors: [[C.olive, 2], [C.leaf, 3], [C.moss, 2], [C.deep, 2], [C.lime, 1]] };
  const cl = (id, lobes, z, o = {}) => ({ pc: canopyPiece('fo-yang-' + id, { leaf, back: C.deep, backA: 0.78, lobes, base: bases[id], seed: hashId(id) % 97, ...o }), z, parent: 'top', j: bases[id], lim: [-0.4, 0.4], stiff: 0.85, sway: { flex: 1, om: 8.5 } });
  return plant({
    trunk: { pc: trunk, z: 0, mass: 5 },
    top: { pc: top, z: 0, parent: 'trunk', j: low[2], lim: [-0.15, 0.15], stiff: 0.95, sway: { flex: 0.25, om: 11, freq: 0.4 } },
    y1: cl('y1', [[-172, -770, 104, 66], [-120, -810, 60, 44]], -1, { extras: seeds }),
    y2: cl('y2', [[-58, -846, 104, 68]], -2),
    y3: cl('y3', [[66, -852, 104, 68]], -2, { extras: seeds }),
    y4: cl('y4', [[176, -766, 104, 66], [126, -806, 60, 44]], -1),
    y5: cl('y5', [[4, -758, 96, 50]], 1, { extras: seeds }),
  });
}

// ============================================================ water & ground
// กอบัว — a lotus clump standing out of a band of cut-water: every bloom,
// bud, pod and raised pad nods on its own stem.
function lotusBloom(ctx, x, y, s, a, { col = C.pink, open = true } = {}) {
  const c = Math.cos(a + Math.PI / 2), si = Math.sin(a + Math.PI / 2);
  const T = (u, v) => [x + u * c - v * si, y + u * si + v * c]; // v up along the stem direction
  if (open) {
    const cup = [T(-18 * s, -2 * s), T(18 * s, -2 * s), T(12 * s, 8 * s), T(-12 * s, 8 * s)];
    leather(ctx, poly(cup)); dye(ctx, poly(cup), C.leaf, 0.8);
    const layers = [[-1.1, 32, 0.8], [1.1, 32, 0.8], [-0.66, 38, 0.9], [0.66, 38, 0.9], [-0.24, 42, 1], [0.24, 42, 1], [0, 36, 1]];
    layers.forEach(([pa, l, k], i) => {
      const bx = T(Math.sin(pa) * 8 * s, 0);
      const p = leafPts('almond', bx[0], bx[1], l * s, a - Math.PI / 2 + pa).map((q) => q);
      const w = leafPts('oval', bx[0], bx[1], l * s, a - Math.PI / 2 + pa);
      leather(ctx, poly(w));
      dye(ctx, poly(inset(w, 1.2)), i === 6 ? C.white : col, 0.92 * k);
      dye(ctx, poly(leafPts('almond', bx[0], bx[1], l * s * 0.8, a - Math.PI / 2 + pa)), C.white, 0.35);
      gold(ctx, inset(w, 1.3), 0.6, { closed: true, smoothIt: false });
      void p;
    });
    const tip = T(0, -24 * s);
    hole(ctx, tip[0], tip[1], 1.2 * s);
    dotLine(ctx, [T(0, -4 * s), T(0, -30 * s)], { spacing: 3.2, r: 0.75, smoothIt: false });
  } else {
    const w = leafPts('oval', x, y, 46 * s, a - Math.PI / 2);
    leather(ctx, poly(w));
    dye(ctx, poly(inset(w, 1.3)), col, 0.92);
    dye(ctx, poly(leafPts('almond', x, y, 40 * s, a - Math.PI / 2 - 0.1)), C.white, 0.3);
    gold(ctx, leafPts('almond', x, y, 42 * s, a - Math.PI / 2 - 0.12), 0.8, { closed: true, smoothIt: false });
    const t = T(0, -44 * s);
    hole(ctx, t[0], t[1], 1);
  }
}
function lotus() {
  const wl = -44;
  const base = piece('fo-bua-water', [box(-210, -64, 210, 4)], (ctx) => {
    for (const [x, w] of [[-150, 70], [-30, 80], [110, 66], [180, 44]]) {
      const pad = [[x - w / 2, wl + 2], [x - w * 0.3, wl - 6], [x + w * 0.3, wl - 6], [x + w / 2, wl + 2], [x + w * 0.3, wl + 7], [x - w * 0.3, wl + 7]];
      leather(ctx, smooth(pad)); dye(ctx, smooth(inset(pad, 1.2)), C.jade, 0.85);
      dotLine(ctx, [[x - w * 0.4, wl], [x + w * 0.4, wl]], { spacing: 3.6, r: 0.8, smoothIt: false });
      slit(ctx, [[x, wl - 5], [x + w * 0.1, wl + 4]], 1.2, { smoothIt: false });
    }
    const water = [[-210, wl + 4], [210, wl + 4], [210, 0], [-210, 0]];
    leather(ctx, poly(water));
    dye(ctx, poly(inset(water, 2)), C.water, 0.85);
    ctx.save();
    ctx.clip(poly(inset(water, 2.5)));
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 1.1;
    for (let row = 0, y = wl + 14; y < 6; y += 10, row++) {
      ctx.beginPath();
      for (let x = -220 + (row % 2) * 10; x < 230; x += 20) { ctx.moveTo(x + 9, y); ctx.arc(x, y, 9, 0, Math.PI, true); }
      ctx.stroke();
    }
    ctx.restore();
    gold(ctx, [[-206, wl + 6], [206, wl + 6]], 1.1, { smoothIt: false });
  }, { px: 1.6 });
  const stem = (id, x0, tip, kind, o = {}) => {
    const mid = [lerp(x0, tip[0], 0.5) + (o.bow ?? 12), lerp(wl, tip[1], 0.5)];
    const sp = [[x0, wl + 4], mid, tip];
    const a = Math.atan2(tip[1] - mid[1], tip[0] - mid[0]) + Math.PI / 2; // bloom "up" tilt
    const pc = piece('fo-bua-' + id, [sp, box(tip[0] - 60, tip[1] - 70, tip[0] + 60, tip[1] + 30)], (ctx) => {
      const o2 = limbPts(sp, 5.5, 3.4);
      leather(ctx, poly(o2));
      dye(ctx, poly(o2), C.leaf, 0.55);
      dotLine(ctx, curve(sp, false, 8).slice(2, -2), { spacing: 6, r: 0.7, seed: x0 });
      if (kind === 'open') lotusBloom(ctx, tip[0], tip[1], o.s ?? 1, a, { col: o.col || C.pink });
      else if (kind === 'bud') lotusBloom(ctx, tip[0], tip[1] + 6, o.s ?? 0.8, a, { col: o.col || C.pink, open: false });
      else if (kind === 'pod') {
        const pod = [[tip[0] - 18, tip[1] - 22], [tip[0] + 18, tip[1] - 22], [tip[0] + 9, tip[1] + 2], [tip[0] - 9, tip[1] + 2]];
        leather(ctx, smooth(pod)); dye(ctx, smooth(inset(pod, 1)), C.olive, 0.8);
        gold(ctx, [[tip[0] - 16, tip[1] - 20], [tip[0] + 16, tip[1] - 20]], 1, { smoothIt: false });
        holes(ctx, [[tip[0] - 9, tip[1] - 16], [tip[0], tip[1] - 17], [tip[0] + 9, tip[1] - 16], [tip[0] - 4, tip[1] - 10], [tip[0] + 4, tip[1] - 10]], 2.2);
      } else if (kind === 'pad') {
        const R = o.R ?? 40, rot = o.rot ?? 0;
        const pts = [];
        for (let k = 0; k <= 30; k++) { const an = rot + 0.18 + (k / 30) * (TAU - 0.36); const rr = R * (1 + Math.sin(k * 1.7) * 0.03); pts.push([tip[0] + Math.cos(an) * rr, tip[1] + Math.sin(an) * rr * 0.5]); }
        pts.push(tip);
        leather(ctx, poly(pts)); dye(ctx, poly(inset(pts, 2)), C.leaf, 0.85);
        dye(ctx, poly(inset(pts, 9)), C.lime, 0.3);
        for (let k = 0; k < 11; k++) { const an = rot + 0.5 + (k / 11) * (TAU - 1); slit(ctx, [[tip[0] + Math.cos(an) * 5, tip[1] + Math.sin(an) * 2.5], [tip[0] + Math.cos(an) * R * 0.86, tip[1] + Math.sin(an) * R * 0.43]], 0.9, { smoothIt: false }); }
        dotLine(ctx, inset(pts, 3.2), { closed: true, spacing: 3.8, r: 0.8 });
        hole(ctx, tip[0], tip[1], 1.6);
      }
    }, { px: 1.7 });
    return { pc, z: o.z ?? 1, parent: 'water', j: [x0, wl + 2], lim: [-0.5, 0.5], stiff: 0.7, sway: { flex: o.flex ?? 1.5, om: o.om ?? 5, grav: 0.5 } };
  };
  return plant({
    water: { pc: base, z: 0, mass: 3 },
    pad1: stem('pad1', -140, [-172, -156], 'pad', { R: 44, rot: 0.3, z: -2, bow: -14, flex: 1.2 }),
    pad2: stem('pad2', 40, [30, -120], 'pad', { R: 36, rot: 2.4, z: -2, flex: 1.2 }),
    open1: stem('open1', -86, [-108, -252], 'open', { s: 1.05, z: 1, bow: 16 }),
    bud1: stem('bud1', -20, [-8, -298], 'bud', { z: 0, bow: -10, flex: 1.8, om: 4.5 }),
    open2: stem('open2', 72, [96, -224], 'open', { s: 0.95, col: C.cream, z: 1, bow: -14 }),
    pod: stem('pod', 132, [152, -176], 'pod', { z: 0, bow: 10 }),
    bud2: stem('bud2', -58, [-60, -176], 'bud', { s: 0.65, z: 2, bow: 8, col: '#e27a8e' }),
    bud3: stem('bud3', 170, [196, -140], 'bud', { s: 0.6, z: 2, bow: -8 }),
  });
}

// ดงหญ้า — a low strip of grass and weed flowers (a single static cut).
function drawGrass(ctx, { rng: r, w: W, h: H }) {
  const G = H;
  const P = new Path2D(), Q = new Path2D();
  for (let x = 6; x < W - 6; x += 5 + r() * 5) {
    const L = 24 + r() * (H - 36), a = -Math.PI / 2 + (r() - 0.5) * 0.9;
    const tip = [x + Math.cos(a) * L, G + Math.sin(a) * L];
    const mid = [x + Math.cos(a) * L * 0.5 + (r() - 0.5) * 8, G + Math.sin(a) * L * 0.55];
    addPts(r() < 0.5 ? P : Q, limbPts([[x, G + 2], mid, tip], 4 + r() * 2, 0.6, false, true));
  }
  leather(ctx, P); leather(ctx, Q);
  dye(ctx, P, C.leaf, 0.85); dye(ctx, Q, C.moss, 0.85);
  const band = [[0, G - 8], [W, G - 8], [W, G], [0, G]];
  leather(ctx, poly(band));
  dotLine(ctx, [[4, G - 4], [W - 4, G - 4]], { spacing: 4.2, r: 0.9, smoothIt: false });
  for (let k = 0; k < 7; k++) {
    const x = 20 + (k / 6) * (W - 40) + (r() - 0.5) * 20, h = 30 + r() * 30;
    leather(ctx, poly(limbPts([[x, G - 4], [x + (r() - 0.5) * 12, G - h]], 2, 1.2)));
    blossom(ctx, x, G - h - 4, 6, [C.sun, C.white, C.violet][k % 3]);
  }
  for (let k = 0; k < 4; k++) kanokTuft(ctx, 30 + k * (W - 60) / 3, G - 6, 26, k);
}
function kanokTuft(ctx, x, y, s, seed) {
  const list = [];
  for (let k = -2; k <= 2; k++) list.push(kanokPts(x + k * s * 0.2, y, s * (1 - Math.abs(k) * 0.15), -Math.PI / 2 + k * 0.38, k > 0));
  list.forEach((p, i) => { leather(ctx, poly(p)); dye(ctx, poly(inset(p, 1)), i % 2 ? C.lime : C.leaf2, 0.9); gold(ctx, inset(p, 1.4), 0.5, { closed: true, smoothIt: false }); });
  void seed;
}

// หญ้าคา — cogon grass: long blades and silky white plumes that stream
// with the wind.
function yaKha() {
  const base = piece('fo-yakha-base', [box(-80, -60, 80, 4)], (ctx) => {
    const P = new Path2D(); const r = rng(3);
    for (let k = 0; k < 16; k++) {
      const x = -60 + k * 8 + (r() - 0.5) * 4, a = -Math.PI / 2 + (k - 8) * 0.08, L = 30 + r() * 26;
      addPts(P, limbPts([[x, 2], [x + Math.cos(a) * L * 0.5, -L * 0.55], [x + Math.cos(a) * L + (k - 8) * 1.5, -L]], 4.5, 0.6, false, true));
    }
    leather(ctx, P); dye(ctx, P, C.olive, 0.85);
  }, { px: 1.8 });
  const stalk = (id, x, h, lean) => {
    const top = [x + lean * h * 0.3, -h];
    const sp = [[x, -10], [x + lean * h * 0.1, -h * 0.5], top];
    const r = rng(hashId(id));
    const blades = [];
    for (let k = 0; k < 4; k++) {
      const s0 = [x + (k - 1.5) * 3, -8];
      const L = h * (0.45 + r() * 0.3), a = -Math.PI / 2 + (k - 1.5) * 0.22 + lean * 0.3;
      blades.push([s0, [s0[0] + Math.cos(a) * L * 0.5, s0[1] + Math.sin(a) * L * 0.5], [s0[0] + Math.cos(a) * L + (k - 1.5) * 8, s0[1] + Math.sin(a) * L * 0.9 + L * 0.08]]);
    }
    const plumeA = Math.atan2(top[1] - sp[1][1], top[0] - sp[1][0]);
    return {
      pc: piece('fo-yakha-' + id, [sp, ...blades, box(top[0] - 30, top[1] - 80, top[0] + 30, top[1] + 10)], (ctx) => {
        const P = union(blades.map((b) => limbPts(b, 5, 0.6, false, true)));
        leather(ctx, P); dye(ctx, P, C.leaf2, 0.85);
        leather(ctx, poly(limbPts(sp, 2.6, 1.8)));
        dye(ctx, poly(limbPts(sp, 2.6, 1.8)), C.olive, 0.7);
        const pl = leafPts('lance', top[0], top[1] + 4, 74, plumeA, { bend: 0.05 });
        const plP = poly(pl);
        leather(ctx, plP);
        dye(ctx, plP, C.cream, 0.95);
        ctx.save(); ctx.clip(plP);
        for (let k = 0; k < 22; k++) {
          const t = k / 22, px = top[0] + Math.cos(plumeA) * 74 * t, py = top[1] + 4 + Math.sin(plumeA) * 74 * t;
          for (const sd of [-1, 1]) slit(ctx, [[px, py], [px + Math.cos(plumeA + sd * 0.5) * 9, py + Math.sin(plumeA + sd * 0.5) * 9]], 0.7, { smoothIt: false });
        }
        ctx.restore();
        gold(ctx, [[top[0], top[1] + 2], [top[0] + Math.cos(plumeA) * 66, top[1] + Math.sin(plumeA) * 66]], 0.7, { smoothIt: false });
      }, { px: 1.8 }),
      z: 1, parent: 'base', j: [x, -8], lim: [-0.6, 0.6], stiff: 0.7, sway: { flex: 2.2, om: 5, grav: 0.4 },
    };
  };
  return plant({ base: { pc: base, z: 0, mass: 2 }, s1: stalk('s1', -36, 170, -0.25), s2: stalk('s2', -4, 214, 0.05), s3: stalk('s3', 30, 186, 0.3), s4: stalk('s4', 58, 140, 0.5) });
}

// พุ่มชบา — a hibiscus bush in full flower.
function hibiscusBush() {
  const leaf = { kind: 'ovate', s: 24, sj: 0.2, droop: 0.25, rim: 0.5, inner: 0.5, alpha: 0.9, teeth: true, colors: [[C.leaf, 3], [C.deep, 2], [C.jade, 2], [C.leaf2, 1]] };
  const blooms = (list) => (ctx) => list.forEach(([x, y, s, a]) => hibiscus(ctx, x, y, s, a));
  const base = piece('fo-chaba-base', [box(-170, -150, 170, 6)], (ctx, r) => {
    ground(ctx, -150, 150, 111, 8);
    limbs(ctx, [[[[0, 0], [-4, -60], [-40, -120]], 16, 8], [[[0, 0], [6, -70], [44, -126]], 16, 8], [[[0, -20], [0, -130]], 12, 6]], { seed: 111, alpha: 0.4 });
    canopy(ctx, r, { lobes: [[-80, -70, 80, 56], [70, -72, 84, 58], [0, -100, 90, 56]], base: [0, -20], leaf, back: C.deep, seed: 11, twigs: [] });
    blooms([[-120, -84, 24, 2.6], [110, -60, 24, 0.4], [20, -40, 22, 1.2]])(ctx);
  }, { px: 1.5 });
  const sprig = (id, j, lobes, fl, z) => ({
    pc: canopyPiece('fo-chaba-' + id, { lobes, base: j, leaf, back: C.deep, seed: hashId(id) % 97, extras: blooms(fl), tw0: 7, tw1: 3 }, { px: 1.5 }),
    z, parent: 'base', j, lim: [-0.45, 0.45], stiff: 0.8, sway: { flex: 1.3, om: 7 },
  });
  return plant({
    base: { pc: base, z: 0, mass: 3 },
    s1: sprig('s1', [-40, -120], [[-110, -178, 54, 40]], [[-132, -196, 26, -2.3], [-84, -214, 22, -1.9]], 1),
    s2: sprig('s2', [0, -130], [[-8, -220, 50, 44]], [[6, -250, 27, -1.5], [-30, -226, 20, -2.2]], -1),
    s3: sprig('s3', [44, -126], [[112, -182, 56, 42]], [[132, -200, 26, -0.7], [96, -222, 21, -1.2]], 1),
    s4: sprig('s4', [-60, -80], [[-168, -104, 44, 34]], [[-190, -112, 22, 3.0]], 2),
    s5: sprig('s5', [60, -84], [[166, -108, 44, 34]], [[190, -118, 22, 0.0]], 2),
  });
}

// เฟิร์น — a fern: arching fronds of lobed pinnae, a fiddlehead curling.
function fern() {
  const hub = [0, -22];
  const base = piece('fo-fern-base', [box(-70, -60, 70, 4)], (ctx) => {
    ground(ctx, -64, 64, 121, 8);
    const b = blobPts(0, -18, 26, 16, { seed: 5 });
    leather(ctx, poly(b)); dye(ctx, poly(inset(b, 2)), C.bark, 0.5); dotLine(ctx, inset(b, 5), { closed: true, spacing: 3.6, r: 0.8 });
    // fiddleheads
    for (const [x, d] of [[-14, -1], [16, 1]]) {
      const st = [[x, -24], [x + d * 4, -44], [x + d * 10, -54]];
      leather(ctx, poly(limbPts(st, 4, 3)));
      const c = ellipsePts(x + d * 14, -56, 7, 7, 16);
      leather(ctx, poly(c)); dye(ctx, poly(c), C.lime, 0.9);
      spiral(ctx, x + d * 14, -56, 6, { turns: 1.6, dir: d });
    }
  }, { px: 1.8 });
  const frond = (id, a, len, droop, z) => {
    const dir = [Math.cos(a), Math.sin(a)];
    const p1 = [hub[0] + dir[0] * len * 0.5, hub[1] + dir[1] * len * 0.5 - len * 0.16];
    const p2 = [hub[0] + dir[0] * len, hub[1] + dir[1] * len + droop * len];
    const rib = qbez(hub, p1, p2, 20);
    const pin = [];
    resample(rib, 7).forEach(([x, y, an], i, arr) => {
      const t = i / arr.length;
      if (t < 0.08) return;
      const L = 34 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.7) * (1 - t * 0.3) + 3;
      for (const sd of [-1, 1]) pin.push({ x, y, s: L, a: an + sd * 1.1 + 0.25 * Math.sign(Math.cos(an)) * 0, sd, t });
    });
    return {
      pc: piece('fo-fern-' + id, [rib, ...pin.map((p) => [[p.x + Math.cos(p.a) * p.s, p.y + Math.sin(p.a) * p.s]]), [[p2[0] - 10, p2[1] - 10], [p2[0] + 10, p2[1] + 10]]], (ctx) => {
        leather(ctx, poly(limbPts(rib, 3.4, 1.2)));
        const P = new Path2D();
        pin.forEach((p) => {
          // lobed pinna: a chain of small ovals along its own axis
          const n = Math.max(1, Math.round(p.s / 6));
          for (let k = 0; k < n; k++) {
            const u = (k + 0.5) / n;
            const cx = p.x + Math.cos(p.a) * p.s * u, cy = p.y + Math.sin(p.a) * p.s * u;
            const w = (1 - u * 0.6) * 4.2;
            addPts(P, ellipsePts(cx, cy, p.s / n * 0.7, w, 10, p.a));
          }
        });
        leather(ctx, P, { edge: false });
        dye(ctx, P, id.length % 2 ? C.jade : C.leaf2, 0.9);
        line(ctx, P, 'rgba(14,9,5,0.85)', 0.7);
        const S = new Path2D();
        pin.forEach((p) => { if (p.s > 12) { S.moveTo(p.x + Math.cos(p.a) * 3, p.y + Math.sin(p.a) * 3); S.lineTo(p.x + Math.cos(p.a) * p.s * 0.8, p.y + Math.sin(p.a) * p.s * 0.8); } });
        ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 0.7; ctx.stroke(S); ctx.restore();
        gold(ctx, rib.slice(1), 0.8);
      }, { px: 1.8 }),
      z, parent: 'base', j: hub, lim: [-0.5, 0.5], stiff: 0.75, sway: { flex: 1.6, om: 6 },
    };
  };
  return plant({
    base: { pc: base, z: 0, mass: 2 },
    f1: frond('f1', -2.85, 150, 0.7, -1), f2: frond('f2', -2.4, 176, 0.45, -2), f3: frond('f3', -1.95, 190, 0.22, -3),
    f4: frond('f4', -1.5, 170, 0.1, -3), f5: frond('f5', -1.05, 188, 0.25, -2), f6: frond('f6', -0.62, 176, 0.5, -1), f7: frond('f7', -0.25, 150, 0.75, 1),
  });
}

// เถาวัลย์ — hanging vines: a mossy bough across the top of the cloth with
// strands of heart leaves and bell flowers; every strand is a two-link
// pendulum. Spawns hung ('hung' mode) from the top edge.
function vines() {
  const bough = [[-290, 6], [-180, -8], [-60, 4], [60, -6], [180, 6], [290, -4]];
  const r0 = rng(131);
  const base = piece('fo-thao-bough', [box(-310, -60, 310, 40)], (ctx, r) => {
    limbs(ctx, [[bough, 30, 18]], { seed: 131, alpha: 0.5 });
    for (let k = 0; k < 9; k++) {
      const x = -260 + k * 65, y = -6 + Math.sin(k) * 6;
      const lf = [];
      for (let n = 0; n < 7; n++) lf.push({ x: x + (r() - 0.5) * 30, y: y - 6 + (r() - 0.5) * 10, s: 18 + r() * 6, a: -Math.PI / 2 + (n - 3) * 0.45 });
      const lp = lf.map((l) => leafPts('heart', l.x, l.y, l.s, l.a));
      const P = union(lp);
      leather(ctx, P, { edge: false });
      lp.forEach((p, i) => dye(ctx, poly(inset(p, 1)), [C.leaf, C.jade, C.leaf2, C.moss][(i + k) % 4], 0.9));
      line(ctx, P, INK.goldLine, 0.5, { alpha: 0.8 });
      const V = new Path2D(); lf.forEach((l) => veinPath(V, l, 'heart', false));
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 0.7; ctx.stroke(V); ctx.restore();
    }
  }, { px: 1.5 });
  const parts = { bough: { pc: base, z: 0, mass: 4 } };
  const seg = (id, x, y, len, seed, last) => {
    const r = rng(seed);
    const pts = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push([x + Math.sin(t * 4 + seed) * 8 * t, y + t * len]); }
    const e = pts[8];
    const lf = [];
    resample(curve(pts, false, 6), 15).forEach(([px, py], i) => lf.push({ x: px, y: py, s: 15 + r() * 5, a: (i % 2 ? 0.4 : Math.PI - 0.4) + (r() - 0.5) * 0.3 }));
    const bells = lf.filter((_, i) => i % 3 === 2);
    return piece('fo-thao-' + id, [pts, box(x - 40, y - 4, x + 40, y + len + (last ? 34 : 12))], (ctx) => {
      leather(ctx, poly(limbPts(pts, 3.6, 2.6)));
      const lp = lf.map((l) => leafPts('heart', l.x, l.y, l.s, l.a));
      const P = union(lp);
      leather(ctx, P, { edge: false });
      lp.forEach((p, i) => dye(ctx, poly(inset(p, 1)), [C.leaf2, C.leaf, C.jade][i % 3], 0.9));
      line(ctx, P, INK.goldLine, 0.5, { alpha: 0.8 });
      const V = new Path2D(); lf.forEach((l) => veinPath(V, l, 'heart', false));
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 0.7; ctx.stroke(V); ctx.restore();
      bells.forEach((b) => {
        const bx = b.x + Math.cos(b.a) * 6, by = b.y + 12;
        leather(ctx, poly(limbPts([[b.x, b.y], [bx, by - 6]], 1.4, 1)));
        const bell = [[bx - 5, by - 6], [bx + 5, by - 6], [bx + 7, by + 6], [bx + 3, by + 4], [bx, by + 8], [bx - 3, by + 4], [bx - 7, by + 6]];
        leather(ctx, smooth(bell)); dye(ctx, smooth(inset(bell, 0.8)), seed % 2 ? C.violet : C.pink, 0.95);
        hole(ctx, bx, by, 0.9);
      });
      if (last) { leather(ctx, poly(limbPts([e, [e[0] + 3, e[1] + 12]], 2.4, 1.4))); spiral(ctx, e[0] + 7, e[1] + 18, 7, { turns: 1.5, dir: seed % 2 ? 1 : -1, w: 1 }); const sp = []; for (let k = 0; k <= 24; k++) { const t = k / 24, a = t * 3 * Math.PI, rr = 8 * (1 - t); sp.push([e[0] + 7 + Math.cos(a) * rr, e[1] + 18 + Math.sin(a) * rr]); } leather(ctx, poly(limbPts(sp, 2, 0.8))); }
    }, { px: 1.7 });
  };
  [-250, -170, -95, -20, 55, 130, 205, 270].forEach((x, i) => {
    const y = 6 + Math.sin(i * 1.3) * 5;
    const l1 = 110 + r0() * 60, l2 = 80 + r0() * 70;
    const e1 = [x + Math.sin(4 + i) * 8, y + l1];
    parts['v' + i] = { pc: seg('v' + i, x, y, l1, i + 1, false), z: i % 2 ? 1 : -1, parent: 'bough', j: [x, y], lim: [-0.8, 0.8], stiff: 0.1, sway: { hang: true, push: 0.9, om: 1.4 } };
    parts['v' + i + 'b'] = { pc: seg('v' + i + 'b', e1[0], e1[1], l2, i + 11, true), z: i % 2 ? 1 : -1, parent: 'v' + i, j: e1, lim: [-0.9, 0.9], stiff: 0.1, sway: { hang: true, push: 1.1, om: 1.2 } };
  });
  return plant(parts, { hang: true });
}

// ต้นข้าว — a clump of ripening rice standing in paddy water.
function rice() {
  const base = piece('fo-khao-base', [box(-110, -30, 110, 4)], (ctx) => {
    const water = [[-110, -12], [110, -12], [110, 0], [-110, 0]];
    leather(ctx, poly(water)); dye(ctx, poly(inset(water, 1.5)), C.water, 0.8);
    ctx.save(); ctx.clip(poly(inset(water, 2))); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 0.9;
    ctx.beginPath(); for (let x = -110; x < 120; x += 14) { ctx.moveTo(x + 6, -4); ctx.arc(x, -4, 6, 0, Math.PI, true); } ctx.stroke(); ctx.restore();
    const P = new Path2D();
    for (let k = 0; k < 14; k++) { const x = -34 + k * 5; addPts(P, limbPts([[x, -8], [x + (k - 7) * 1.2, -34]], 4, 3, false, true)); }
    leather(ctx, P); dye(ctx, P, C.olive, 0.8);
  }, { px: 1.8 });
  const tiller = (id, x, h, lean, z) => {
    const r = rng(hashId(id));
    const top = [x + lean * h * 0.25, -h];
    const st = [[x, -30], [x + lean * h * 0.08, -h * 0.55], top];
    const nod = [top, [top[0] + lean * 20 + 16, top[1] - 4], [top[0] + lean * 30 + 30, top[1] + 44]];
    const blades = [];
    for (let k = 0; k < 4; k++) {
      const s0 = [x + (k - 1.5) * 3, -30], L = h * (0.5 + r() * 0.3), a = -Math.PI / 2 + (k - 1.5) * 0.24 + lean * 0.3;
      blades.push([s0, [s0[0] + Math.cos(a) * L * 0.5, s0[1] + Math.sin(a) * L * 0.5], [s0[0] + Math.cos(a) * L + (k - 1.5) * 12, s0[1] + Math.sin(a) * L * 0.9 + L * 0.12]]);
    }
    return {
      pc: piece('fo-khao-' + id, [st, nod, ...blades, box(top[0] - 20, top[1] - 16, top[0] + 70, top[1] + 60)], (ctx) => {
        const P = union(blades.map((b) => limbPts(b, 5.5, 0.6, false, true)));
        leather(ctx, P); dye(ctx, P, [C.leaf2, C.olive, C.lime][hashId(id) % 3], 0.85);
        blades.forEach((b) => gold(ctx, b, 0.5));
        leather(ctx, poly(limbPts(st, 2.6, 1.8)));
        dye(ctx, poly(limbPts(st, 2.6, 1.8)), C.olive, 0.7);
        const nc = curve(nod, false, 8);
        leather(ctx, poly(limbPts(nod, 1.8, 1)));
        resample(nc, 5).forEach(([gx, gy, a], i) => {
          for (const sd of [-1, 1]) {
            const g = leafPts('almond', gx, gy, 9, a + sd * 0.6);
            leather(ctx, poly(g)); dye(ctx, poly(g), i % 3 ? C.sun : INK.gold, 0.95);
            hole(ctx, gx + Math.cos(a + sd * 0.6) * 5, gy + Math.sin(a + sd * 0.6) * 5, 0.6);
          }
        });
      }, { px: 1.9 }),
      z, parent: 'base', j: [x, -30], lim: [-0.5, 0.5], stiff: 0.7, sway: { flex: 1.8, om: 5.5, grav: 0.45 },
    };
  };
  return plant({
    base: { pc: base, z: 0, mass: 2 },
    t1: tiller('t1', -26, 150, -0.6, -1), t2: tiller('t2', -12, 190, -0.2, 1), t3: tiller('t3', 2, 206, 0.1, -1), t4: tiller('t4', 16, 180, 0.4, 1), t5: tiller('t5', 30, 140, 0.8, 2),
  });
}

// ============================================================ fantasy
// ต้นไม้ป่าหิมพานต์ — a tree of the Himmaphan forest: a gilded twisted
// trunk sprouting กนก flames, spiral boughs, a canopy of flame-leaves in
// the mural colours and jewels hanging like fruit.
function himmaphan() {
  const fork = [0, -300];
  const bases = { j1: [-150, -392], j2: [-80, -470], j3: [0, -500], j4: [82, -470], j5: [152, -390] };
  const gildTrunk = (ctx) => {
    const a = [[-24, 0], [18, -100], [-16, -200], [10, -300]];
    const b = [[24, 0], [-18, -100], [16, -200], [-10, -300]];
    for (const s of [a, b]) { const o = limbPts(s, 40, 26); leather(ctx, poly(o)); dye(ctx, poly(inset(o, 2)), C.amber, 0.8); dotLine(ctx, curve(s, false, 10), { spacing: 4, r: 1, seed: 2 }); gold(ctx, offset(curve(s, false, 10), 8), 1); gold(ctx, offset(curve(s, false, 10), -8), 1); }
    krajangRow(ctx, [[-30, -160], [30, -162]], 12, { color: INK.gold, inner: INK.red });
  };
  const flourish = (ctx) => {
    [[-26, -60, -2.5, false], [26, -80, -0.6, true], [-22, -170, -2.3, false], [24, -210, -0.8, true], [-20, -260, -2.0, false]].forEach(([x, y, a, f], i) => {
      const p = kanokPts(x, y, 46 - i * 3, a, f);
      leather(ctx, poly(p));
      dye(ctx, poly(inset(p, 2)), i % 2 ? INK.red : C.emerald, 0.9);
      gold(ctx, inset(p, 2), 0.8, { closed: true, smoothIt: false });
      hole(ctx, x + Math.cos(a) * 14, y + Math.sin(a) * 14, 1.4);
    });
  };
  const boughs = Object.values(bases).map((b, i) => [[fork, [lerp(fork[0], b[0], 0.5) + (i % 2 ? 20 : -20), lerp(fork[1], b[1], 0.5)], b], 26, 12]);
  const colorFn = (l, r) => pick(r, [[C.emerald, 3], [INK.red, 2], [C.sun, 2], [C.jade, 2], [C.sapphire, 0.6]]);
  const jewel = (id, parent, x, y, col, len) => ({
    id, parent, j: [x, y], z: 3, push: 0.7, om: 1.8,
    pc: piece('fo-him-' + id, [box(x - 20, y - 4, x + 20, y + len + 50)], (ctx) => {
      const ch = [[x, y], [x + 1, y + len * 0.5], [x, y + len]];
      leather(ctx, poly(limbPts(ch, 4, 3)));
      dye(ctx, poly(limbPts(ch, 3, 2)), INK.gold, 0.9);
      lozenges(ctx, ch, { size: 1.8, gap: 5 });
      gem(ctx, x, y + len + 14, 11, col);
      const t = [[x - 6, y + len + 30], [x + 6, y + len + 30], [x + 3, y + len + 46], [x, y + len + 50], [x - 3, y + len + 46]];
      leather(ctx, smooth(t)); dye(ctx, smooth(t), INK.red, 0.9);
      for (let k = -1; k <= 1; k++) slit(ctx, [[x + k * 2.4, y + len + 32], [x + k * 2.4, y + len + 46]], 0.6, { smoothIt: false });
    }, { px: 1.8 }),
  });
  return broadleaf({
    name: 'fo-him', mass: 4,
    barkTone: C.amber, barkA: 0.6,
    trunk: [...boughs, [[[-20, -30], [-70, -6], [-110, 0]], 24, 6], [[[20, -30], [72, -6], [112, 0]], 24, 6]],
    trunkBox: [box(-120, -310, 120, 6)],
    under: (ctx) => {
      // a lotus plinth for the tree to rise from
      const pl = [[-120, 0], [-100, -22], [100, -22], [120, 0]];
      leather(ctx, poly(pl)); dye(ctx, poly(inset(pl, 2)), INK.red, 0.8);
      for (let k = 0; k < 9; k++) { const x = -96 + k * 24; const p = leafPts('oval', x, -18, 22, -Math.PI / 2); leather(ctx, poly(p)); dye(ctx, poly(inset(p, 1)), C.sun, 0.9); gold(ctx, inset(p, 1.5), 0.6, { closed: true }); }
      gildTrunk(ctx);
    },
    decoTrunk: (ctx) => {
      flourish(ctx);
      Object.values(bases).forEach(([x, y], i) => spiral(ctx, x, y + 14, 9, { turns: 1.8, dir: i % 2 ? 1 : -1, w: 1 }));
      prajamYam(ctx, fork[0], fork[1] + 4, 12, { color: INK.red, petal: C.sun });
    },
    leaf: { kind: 'kanok', s: 22, sj: 0.2, droop: 0.1, rim: 0.42, inner: 0.35, alpha: 0.92, colorFn, colors: [[C.emerald, 1]] },
    back: C.teal, backA: 0.9, laceKeep: 0.9,
    clusters: [
      L3(bases.j1, [[-196, -440, 92, 70]], { id: 'j1', z: -1 }),
      L3(bases.j2, [[-104, -560, 100, 76]], { id: 'j2', z: -2 }),
      L3(bases.j3, [[0, -636, 96, 72], [0, -700, 40, 40]], { id: 'j3', z: -3, om: 10, extras: (ctx) => { const p = kanokPts(0, -728, 60, -Math.PI / 2); leather(ctx, poly(p)); dye(ctx, poly(inset(p, 2)), C.sun, 0.95); gold(ctx, inset(p, 2), 0.9, { closed: true }); hole(ctx, 0, -750, 2); } }),
      L3(bases.j4, [[106, -560, 100, 76]], { id: 'j4', z: -2 }),
      L3(bases.j5, [[198, -440, 92, 70]], { id: 'j5', z: -1 }),
    ].map((c) => ({ ...c, extras: c.extras || ((ctx, r, list) => list.filter(() => r() < 0.07).forEach((l) => dotFlower(ctx, l.x, l.y, 1.1, 6, 2.4))) })),
    hang: [
      jewel('g1', 'j1', -206, -392, C.ruby, 30),
      jewel('g2', 'j2', -118, -500, C.sapphire, 34),
      jewel('g3', 'j4', 118, -500, C.emerald, 30),
      jewel('g4', 'j5', 206, -392, C.ruby, 38),
      jewel('g5', 'trunk', -60, -350, C.amber, 24),
      jewel('g6', 'trunk', 64, -352, C.violet, 26),
    ],
    extra: { glowAt: [0, -520, 170] },
  });
}

// ============================================================== PROPS
const F = (id, name, en, build) => ({ id, name, en, cat: 'foliage', build, onSpawn: onSpawnFoliage });
export const PROPS = [
  F('ton-maphrao', 'ต้นมะพร้าวลู่ลม', 'Coconut palm (swaying)', coconut),
  F('ton-tan', 'ต้นตาล', 'Sugar palm with tapper\'s ladder', sugarPalm),
  F('ton-mak', 'ต้นหมากพลู', 'Areca palm with betel vine', areca),
  F('ton-kluai', 'กอกล้วย', 'Banana plant (swaying)', banana),
  F('ton-pho', 'ต้นโพธิ์ใหญ่', 'Bodhi tree (swaying)', bodhi),
  F('ton-sai', 'ต้นไทร', 'Banyan with aerial roots', banyan),
  F('ton-mamuang', 'ต้นมะม่วง', 'Mango tree in fruit', mango),
  F('ton-leelawadee', 'ต้นลีลาวดี', 'Frangipani', frangipaniTree),
  F('ton-ratchaphruek', 'ต้นราชพฤกษ์', 'Golden shower tree', goldenShower),
  F('ton-hukwang', 'ต้นหูกวาง', 'Indian almond (tiered)', hukwang),
  F('ton-yangna', 'ต้นยางนา', 'Yang-na forest giant', yangna),
  F('kor-phai', 'กอไผ่ลู่ลม', 'Bamboo clump (swaying)', bamboo),
  F('kor-bua', 'กอบัว', 'Lotus clump (swaying)', lotus),
  F('ton-khao', 'ต้นข้าว', 'Rice clump', rice),
  F('ya-kha', 'หญ้าคา', 'Cogon grass', yaKha),
  { id: 'dong-ya', name: 'ดงหญ้า', en: 'Grass tufts', cat: 'foliage', build: () => ({ sprite: paintSprite(320, 90, drawGrass, { name: 'dong-ya', pad: 12, px: 1.8 }), static: true, mass: 1 }) },
  F('phum-chaba', 'พุ่มชบา', 'Hibiscus bush', hibiscusBush),
  F('fern', 'เฟิร์น', 'Fern', fern),
  F('thao-wan', 'เถาวัลย์', 'Hanging vines', vines),
  F('ton-himmaphan', 'ต้นไม้ป่าหิมพานต์', 'Himmaphan jewel tree', himmaphan),
];
