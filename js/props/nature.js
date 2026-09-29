// Nature scenery cut from hide: trees, water plants, mural rocks, sky.
//
// The centre-piece is ต้นไม้ป่า, the forest tree of Nang Talung: a tall
// ornamental tree whose foliage lobes are cut into dense lace, planted on
// the screen between episodes to say "we are in the forest now".

import {
  INK, paintSprite, leather, dye, line, gold, hole, holes, dotLine, dotFill, slit, cut,
  poly, curve, smooth, ellipsePts, blobPts, inset, rng, kanokPts, prajamYam, dotFlower, resample,
} from '../art/leather.js';
import {
  TAU, lerp, mix, rectPts, taper, hide, hideS, hideMany, rimDots, edgeDots, offsetLine, spiral,
  arcPts, age, petalPts, kanokScroll,
} from './buildings.js';

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// Almond / leaf outline (pointed both ends) from base (x,y) along ang.
function almondPts(x, y, len, wid, ang, bend = 0) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const T = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  const out = [];
  const n = 8;
  for (let i = 0; i <= n; i++) { const t = i / n; out.push(T(t * len, Math.sin(t * Math.PI) * wid * 0.5 + bend * Math.sin(t * Math.PI) * wid)); }
  for (let i = n - 1; i > 0; i--) { const t = i / n; out.push(T(t * len, -Math.sin(t * Math.PI) * wid * 0.5 + bend * Math.sin(t * Math.PI) * wid)); }
  return out;
}
function addPts(path, pts) {
  pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
}
function cutPath(ctx, p) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(p);
  ctx.restore();
}

// Point + tangent angle along a Catmull-Rom curve at parameter t in [0,1].
function along(c, t) {
  const i = Math.min(c.length - 2, Math.max(0, Math.floor(t * (c.length - 1))));
  const a = c[i], b = c[i + 1];
  const f = t * (c.length - 1) - i;
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), Math.atan2(b[1] - a[1], b[0] - a[0])];
}

// Bark: wavy knife slits and dot rows running up a trunk outline.
function bark(ctx, spine, w0, w1, { seed = 1, lines = 3 } = {}) {
  const c = curve(spine, false, 10);
  for (let k = 0; k < lines; k++) {
    const f = (k + 1) / (lines + 1) - 0.5;
    const pts = c.map((p, i) => {
      const t = i / (c.length - 1);
      const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
      const l = dist(a, b) || 1;
      const w = lerp(w0, w1, t) * 0.8;
      const wob = Math.sin(t * 22 + k * 2 + seed) * 1.6;
      return [p[0] - ((b[1] - a[1]) / l) * (f * w + wob), p[1] + ((b[0] - a[0]) / l) * (f * w + wob)];
    });
    if (k % 2) dotLine(ctx, pts, { spacing: 4.6, r: 1.05, seed: seed + k, smoothIt: false });
    else gold(ctx, pts, 1);
  }
}

// ============================================================ coconut
function drawCoconut(ctx, { rng: r, w: W, h: H }) {
  const G = H;
  const spine = [[170, G], [150, G - 140], [168, G - 300], [212, G - 450], [256, G - 548]];
  const crown = spine[spine.length - 1];
  // root flare
  const flare = [[128, G], [146, G - 20], [152, G - 44], [192, G - 44], [196, G - 18], [212, G]];
  hideS(ctx, flare);
  for (const [a, b] of [[[150, G - 8], [118, G]], [[190, G - 6], [224, G]], [[170, G - 4], [170, G]]]) hide(ctx, taper([a, b], 7, 3, { smoothIt: false }), 0, 0);
  const trunk = taper(spine, 40, 22);
  hide(ctx, trunk, 0, 0);
  dye(ctx, poly(inset(trunk, 3)), INK.brown, 0.35);
  // ring scars
  const c = curve(spine, false, 12);
  const acc = [0];
  for (let i = 1; i < c.length; i++) acc.push(acc[i - 1] + dist(c[i - 1], c[i]));
  const L = acc[acc.length - 1];
  for (let d = 16; d < L - 10; d += 13 + r() * 3) {
    const t = d / L;
    const [x, y, a] = along(c, t);
    const w = lerp(40, 22, t) / 2 - 3;
    const nx = -Math.sin(a), ny = Math.cos(a);
    const sag = 2.4;
    const pts = [[x - nx * w, y - ny * w], [x + Math.cos(a) * sag, y + Math.sin(a) * sag], [x + nx * w, y + ny * w]];
    slit(ctx, pts, 1.05);
    if ((d | 0) % 2) hole(ctx, x - Math.cos(a) * 5, y - Math.sin(a) * 5, 0.9);
  }
  gold(ctx, offsetLine(c.slice(4, -2), -8), 0.9);
  // dried hanging fronds (brown) beneath the crown
  const crownP = new Path2D();
  const ribs = [];
  const frond = (a0, len, droop, dry = false) => {
    const dir = [Math.cos(a0), Math.sin(a0)];
    const p0 = crown, p1 = [crown[0] + dir[0] * len * 0.5, crown[1] + dir[1] * len * 0.5 - len * 0.05];
    const p2 = [crown[0] + dir[0] * len, crown[1] + dir[1] * len + droop * len];
    const rib = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      rib.push([(1 - t) * (1 - t) * p0[0] + 2 * t * (1 - t) * p1[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * t * (1 - t) * p1[1] + t * t * p2[1]]);
    }
    const shape = [];
    shape.push(taper(rib, 7, 1.5, { smoothIt: false }));
    const rr = resample(rib, 6.5, false);
    rr.forEach(([x, y, a], i) => {
      const t = i / rr.length;
      if (t < 0.06) return;
      const lf = (dry ? 34 : 58) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.6) * (1 - t * 0.35) + 6;
      for (const side of [-1, 1]) {
        const la = a + side * 1.05 + (dry ? 0.6 * side : 0);
        const gx = Math.cos(la), gy = Math.sin(la) + 0.55; // gravity
        const gl = Math.hypot(gx, gy);
        const tip = [x + (gx / gl) * lf, y + (gy / gl) * lf];
        const mid = [x + (gx / gl) * lf * 0.5 + Math.cos(a) * 3, y + (gy / gl) * lf * 0.5 + Math.sin(a) * 3];
        shape.push(taper([[x, y], mid, tip], 3.6, 0.9, { smoothIt: false }));
      }
    });
    return { rib, shape };
  };
  for (const a of [2.2, 1.0]) {
    const f = frond(a, 120, 0.3, true);
    const p = new Path2D();
    f.shape.forEach((s) => addPts(p, s));
    leather(ctx, p);
    dye(ctx, p, INK.brown, 0.55);
  }
  const angles = [-3.0, -2.62, -2.25, -1.92, -1.62, -1.35, -1.08, -0.78, -0.45, -0.12, 0.25, -2.0, -1.2];
  angles.forEach((a, i) => {
    const len = 200 + r() * 60 - (i > 10 ? 70 : 0);
    const horiz = Math.abs(Math.cos(a));
    const droop = 0.25 + horiz * 0.55 + (a > -0.2 || a < -2.9 ? 0.25 : 0);
    const f = frond(a, len, droop);
    f.shape.forEach((s) => addPts(crownP, s));
    ribs.push(f.rib);
  });
  leather(ctx, crownP);
  dye(ctx, crownP, INK.green, 0.5);
  ribs.forEach((rib, i) => {
    gold(ctx, rib.slice(1), 1);
    dotLine(ctx, offsetLine(rib.slice(2, -3), 2.6), { spacing: 4.4, r: 0.9, seed: i, smoothIt: false });
  });
  // coconuts
  const nuts = [[-18, 18], [0, 26], [18, 16], [-8, 42], [12, 40], [-26, 34]];
  nuts.forEach(([dx, dy], i) => {
    const n = blobPts(crown[0] + dx, crown[1] + dy, 13, 14, { seed: i + 3, wobble: 0.05 });
    hideS(ctx, n);
    dye(ctx, smooth(inset(n, 2)), i % 2 ? INK.green : INK.jade, 0.75);
    gold(ctx, inset(n, 3.5), 0.8, { closed: true });
    holes(ctx, [[crown[0] + dx - 3, crown[1] + dy - 2], [crown[0] + dx + 3, crown[1] + dy - 2], [crown[0] + dx, crown[1] + dy + 3]], 1.1);
  });
  // crown boss
  hideS(ctx, blobPts(crown[0], crown[1], 18, 14, { seed: 11 }));
  dotFlower(ctx, crown[0], crown[1], 1.2, 5, 2.6);
  age(ctx, W, H, 0.3);
}

// ============================================================= banana
function drawBanana(ctx, { rng: r, w: W, h: H }) {
  const G = H, cx = 170;
  const top = [cx + 6, 178];
  // leaves: petiole from the top of the stem, blade along a curved midrib
  const leaf = (a, len, droop, wid, torn, seed, color = INK.green) => {
    const dir = [Math.cos(a), Math.sin(a)];
    const p0 = [top[0] + dir[0] * 10, top[1] + dir[1] * 10];
    const p1 = [p0[0] + dir[0] * len * 0.5, p0[1] + dir[1] * len * 0.5];
    const p2 = [p0[0] + dir[0] * len + droop * len * 0.3 * Math.sign(dir[0]), p0[1] + dir[1] * len + droop * len];
    const rib = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      rib.push([(1 - t) * (1 - t) * p0[0] + 2 * t * (1 - t) * p1[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * t * (1 - t) * p1[1] + t * t * p2[1]]);
    }
    const t0 = 0.22;
    const L = [], R = [];
    rib.forEach((p, i) => {
      const t = i / 20;
      if (t < t0) return;
      const u = (t - t0) / (1 - t0);
      const a2 = rib[Math.max(0, i - 1)], b2 = rib[Math.min(20, i + 1)];
      const l = dist(a2, b2) || 1;
      const nx = -(b2[1] - a2[1]) / l, ny = (b2[0] - a2[0]) / l;
      const w = wid * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.04)), 0.55) * (1 - u * 0.25);
      L.push([p[0] + nx * w, p[1] + ny * w]);
      R.push([p[0] - nx * w, p[1] - ny * w]);
    });
    const blade = [...L, rib[20], ...R.reverse()];
    hide(ctx, taper(rib.slice(0, 6), 7, 5, { smoothIt: false }), 0, 0);
    hideS(ctx, blade);
    dye(ctx, smooth(inset(blade, 2)), color, 0.6);
    gold(ctx, rib.slice(3), 1.3);
    // veins: rows of fine slits angled off the midrib
    const rr = resample(rib, 7, false);
    const rng2 = rng(seed);
    rr.forEach(([x, y, ang], i) => {
      const t = i / rr.length;
      if (t < t0 + 0.04 || t > 0.95) return;
      const w = wid * 0.8 * Math.pow(Math.sin(Math.PI * ((t - t0) / (1 - t0))), 0.55);
      for (const side of [-1, 1]) {
        const va = ang + side * 1.2;
        slit(ctx, [[x + Math.cos(va) * 4, y + Math.sin(va) * 4], [x + Math.cos(va) * w, y + Math.sin(va) * w]], 0.7, { smoothIt: false });
      }
    });
    // tears: wedges cut in from the edges
    for (let k = 0; k < torn; k++) {
      const t = 0.35 + rng2() * 0.55;
      const [x, y, ang] = along(rib, t);
      const side = rng2() < 0.5 ? -1 : 1;
      const w = wid * 1.1;
      const va = ang + side * 1.35;
      const e = [x + Math.cos(va) * w, y + Math.sin(va) * w];
      const inn = [x + Math.cos(va) * 5, y + Math.sin(va) * 5];
      cut(ctx, poly([[e[0] + Math.cos(ang) * 2.2, e[1] + Math.sin(ang) * 2.2], [e[0] - Math.cos(ang) * 2.2, e[1] - Math.sin(ang) * 2.2], inn]));
    }
    rimDots(ctx, blade, 3.2, { spacing: 4.2, r: 0.9, seed });
    return rib;
  };
  // back leaves first
  leaf(-2.35, 170, 0.35, 30, 5, 1, INK.jade);
  leaf(-0.7, 176, 0.3, 30, 6, 2, INK.jade);
  // suckers at the foot
  for (const [x, s] of [[92, 0.55], [258, 0.45]]) {
    const st = [[x, G], [x + 2, G - 60 * s]];
    hide(ctx, taper(st, 14 * s, 9 * s, { smoothIt: false }), 0, 0);
    for (const a of [-2.2, -1.2]) {
      const lf = almondPts(x + 2, G - 58 * s, 90 * s, 34 * s, a, 0.15);
      hideS(ctx, lf);
      dye(ctx, smooth(inset(lf, 1.5)), INK.green, 0.6);
      gold(ctx, [[x + 2, G - 58 * s], [x + 2 + Math.cos(a) * 86 * s, G - 58 * s + Math.sin(a) * 86 * s]], 0.9, { smoothIt: false });
    }
  }
  // pseudostem of overlapping sheaths
  const stem = [[cx, G], [cx - 4, G - 120], [cx + 2, G - 220], [top[0], top[1]]];
  const sp = taper(stem, 48, 30);
  hideS(ctx, sp);
  dye(ctx, smooth(inset(sp, 3)), INK.jade, 0.45);
  for (let y = G - 30; y > top[1] + 20; y -= 38) {
    const w = lerp(22, 14, (G - y) / (G - top[1]));
    const sh = [[cx - w, y + 16], [cx - w * 0.2, y - 4], [cx + w * 0.9, y - 26]];
    gold(ctx, sh, 1.2);
    dotLine(ctx, sh.map(([a, b]) => [a + 3, b + 5]), { spacing: 4, r: 0.9 });
  }
  // front leaves
  leaf(-1.62, 150, -0.05, 26, 4, 3);
  leaf(-2.9, 150, 0.9, 28, 7, 4);
  leaf(-0.2, 144, 1.0, 27, 7, 5);
  // the bunch: stalk arcing out, hands of fruit, and the heart (หัวปลี)
  const stalk = [[top[0] + 4, top[1] + 6], [top[0] + 50, top[1] + 10], [top[0] + 74, top[1] + 60], [top[0] + 76, top[1] + 150]];
  hide(ctx, taper(stalk, 7, 4.5), 0, 0);
  const sc = curve(stalk, false, 10);
  for (let k = 0; k < 4; k++) {
    const [x, y, a] = along(sc, 0.34 + k * 0.12);
    for (let f = -2; f <= 2; f++) {
      const fa = -Math.PI / 2 + f * 0.26 - 0.2;
      const bx = x + Math.cos(a + Math.PI / 2) * 3 + f * 3, by = y + 4;
      const fruit = taper([[bx, by], [bx + Math.cos(fa) * 12 - 3, by + Math.sin(fa) * 12], [bx + Math.cos(fa) * 20 - 8, by + Math.sin(fa) * 22]], 6.5, 3);
      hideS(ctx, fruit);
      dye(ctx, smooth(inset(fruit, 1)), k < 2 ? INK.yellow : INK.green, 0.8);
    }
    gold(ctx, [[x - 12, y + 5], [x + 12, y + 5]], 0.8, { smoothIt: false });
  }
  const hx = top[0] + 76, hy = top[1] + 150;
  const heart = [[hx, hy - 6], [hx + 12, hy + 10], [hx + 13, hy + 30], [hx + 4, hy + 50], [hx, hy + 56], [hx - 4, hy + 50], [hx - 13, hy + 30], [hx - 12, hy + 10]];
  hideS(ctx, heart);
  dye(ctx, smooth(inset(heart, 1.5)), INK.purple, 0.9);
  for (let k = 0; k < 4; k++) gold(ctx, [[hx - 10 + k * 1.5, hy + 8 + k * 11], [hx, hy + 14 + k * 11], [hx + 10 - k * 1.5, hy + 8 + k * 11]], 0.8);
  holes(ctx, [[hx, hy + 44], [hx - 5, hy + 22], [hx + 5, hy + 22]], 1);
  age(ctx, W, H, 0.3);
}

// =============================================================== bodhi
// Heart-shaped pipal leaf with its long drip tip; base at (x,y).
function bodhiLeaf(x, y, s, ang) {
  const c = Math.cos(ang), si = Math.sin(ang);
  const T = ([u, v]) => [x + u * c - v * si, y + u * si + v * c];
  const base = [[0, 0], [0.12, 0.2], [0.3, 0.4], [0.55, 0.44], [0.8, 0.3], [1.0, 0.14], [1.2, 0.05], [1.45, 0], [1.2, -0.05], [1.0, -0.14], [0.8, -0.3], [0.55, -0.44], [0.3, -0.4], [0.12, -0.2]];
  return curve(base.map(([u, v]) => [u * s, v * s]), true, 4, 0.5).map(T);
}

function drawBodhi(ctx, { rng: r, w: W, h: H }) {
  const G = H, cx = W / 2;
  // buttress roots + trunk
  const roots = [[[cx - 20, G - 60], [cx - 90, G - 10], [cx - 150, G]], [[cx + 20, G - 60], [cx + 96, G - 12], [cx + 160, G]], [[cx - 10, G - 40], [cx - 40, G]], [[cx + 12, G - 40], [cx + 46, G]]];
  for (const rt of roots) hide(ctx, taper(rt, 26, 4), 0, 0);
  const trunkSpine = [[cx, G], [cx - 8, G - 120], [cx + 6, G - 210], [cx - 2, G - 280]];
  const trunk = taper(trunkSpine, 96, 58);
  hideS(ctx, trunk);
  bark(ctx, trunkSpine, 90, 56, { seed: 3, lines: 5 });
  // branches out to the leaf clusters
  const fork = [cx - 2, G - 270];
  const clusters = [
    [cx - 190, 250, 92], [cx - 120, 150, 98], [cx - 10, 96, 104], [cx + 110, 140, 98], [cx + 190, 240, 90],
    [cx - 170, 360, 70], [cx + 170, 360, 72], [cx - 70, 250, 80], [cx + 60, 240, 84],
  ];
  const branchP = new Path2D();
  clusters.forEach(([x, y], i) => {
    const mid = [lerp(fork[0], x, 0.45) + (i % 2 ? 18 : -18), lerp(fork[1], y, 0.6)];
    addPts(branchP, taper([fork, mid, [x, y + 10]], 34 - (i > 4 ? 12 : 0), 7));
  });
  leather(ctx, branchP);
  // backing canopy: one lace-cut mass behind the leaves
  const canopy = new Path2D();
  clusters.forEach(([x, y, R], i) => addPts(canopy, blobPts(x, y, R * 0.95, R * 0.75, { seed: 70 + i, wobble: 0.1 })));
  leather(ctx, canopy);
  dye(ctx, canopy, INK.green, 0.55);
  const lace = new Path2D();
  for (let y = 40, row = 0; y < 460; y += 9, row++) {
    for (let x = 30 + (row % 2) * 5; x < W - 30; x += 10) {
      const a = Math.atan2(y - (G - 270), x - cx) + (row % 2 ? 0.6 : -0.6);
      addPts(lace, almondPts(x, y, 7.5, 3.4, a));
    }
  }
  ctx.save(); ctx.clip(canopy); ctx.globalCompositeOperation = 'destination-out'; ctx.fill(lace); ctx.restore();
  leather(ctx, branchP);
  // leaves: clouds around each cluster, hanging a little
  const leaves = [];
  clusters.forEach(([x, y, R], ci) => {
    const n = Math.round(R * 0.5);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + r() * 0.4;
      const rr = R * (0.45 + 0.6 * Math.sqrt(r()));
      const px = x + Math.cos(a) * rr * 1.1, py = y + Math.sin(a) * rr * 0.85;
      const la = Math.atan2(py - y, px - x) * 0.6 + Math.PI / 2 * 0.4 + (r() - 0.5) * 0.6;
      leaves.push({ x: px - Math.cos(la) * 10, y: py - Math.sin(la) * 10, s: 24 + r() * 8, a: la, ci, k });
    }
  });
  // ruffle leaves around the outer rim first so the silhouette reads leafy
  const leafP = new Path2D();
  const lpts = leaves.map((l) => bodhiLeaf(l.x, l.y, l.s, l.a));
  lpts.forEach((p) => addPts(leafP, p));
  leather(ctx, leafP);
  const cols = [INK.green, INK.jade, INK.green, INK.gold, INK.green, INK.jade, INK.vermilion];
  const slitP = new Path2D();
  leaves.forEach((l, i) => {
    const p = lpts[i];
    dye(ctx, poly(inset(p, 1.6)), r() < 0.06 ? INK.vermilion : cols[(l.k * 5 + l.ci * 3) % 6], 0.72);
    const c = Math.cos(l.a), s = Math.sin(l.a);
    slitP.moveTo(l.x + c * l.s * 0.1, l.y + s * l.s * 0.1);
    slitP.lineTo(l.x + c * l.s * 1.05, l.y + s * l.s * 1.05);
    for (const side of [-1, 1]) {
      slitP.moveTo(l.x + c * l.s * 0.45, l.y + s * l.s * 0.45);
      slitP.lineTo(l.x + c * l.s * 0.62 - s * side * l.s * 0.24, l.y + s * l.s * 0.62 + c * side * l.s * 0.24);
    }
  });
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = 1;
  ctx.stroke(slitP);
  ctx.restore();
  lpts.forEach((p) => gold(ctx, p, 0.55, { closed: true, smoothIt: false }));
  // sacred cloths wrapped round the trunk (ผ้าแพรสามสี)
  const bands = [[G - 190, INK.red], [G - 176, INK.yellow], [G - 162, INK.green]];
  bands.forEach(([y, col], i) => {
    const b = [[cx - 44, y - 5], [cx + 46, y - 9], [cx + 47, y + 5], [cx - 45, y + 9]];
    hide(ctx, b, 0.2, i);
    dye(ctx, poly(inset(b, 1)), col, 0.9);
    dotLine(ctx, [[cx - 40, y + 2], [cx + 42, y - 2]], { spacing: 3.6, r: 0.8, smoothIt: false });
  });
  for (const [dx, col] of [[-8, INK.red], [4, INK.yellow], [16, INK.green]]) {
    const tail = taper([[cx + 40, G - 176 + dx * 0.4], [cx + 58 + dx, G - 150], [cx + 52 + dx, G - 108]], 8, 5);
    hideS(ctx, tail);
    dye(ctx, smooth(inset(tail, 1)), col, 0.9);
  }
  // offering: a small clay spirit shrine with incense at the foot
  const sh = [[cx - 110, G], [cx - 108, G - 20], [cx - 84, G - 20], [cx - 82, G]];
  hide(ctx, sh, 0, 0);
  hideS(ctx, [[cx - 112, G - 20], [cx - 96, G - 44], [cx - 80, G - 20]]);
  dye(ctx, poly(inset(sh, 1.5)), INK.vermilion, 0.7);
  for (let k = -1; k <= 1; k++) { hide(ctx, taper([[cx - 96 + k * 3, G - 44], [cx - 96 + k * 6, G - 66]], 1, 0.7, { smoothIt: false }), 0, 0); hole(ctx, cx - 96 + k * 6, G - 66, 0.8); }
  age(ctx, W, H, 0.3);
}

// ============================================================= bamboo
function drawBamboo(ctx, { rng: r, w: W, h: H }) {
  const G = H, cx = W / 2;
  const culms = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1) - 0.5;
    const bx = cx + f * 90 + (r() - 0.5) * 8;
    const hgt = H * (0.72 + r() * 0.26) * (1 - Math.abs(f) * 0.35);
    const lean = f * 1.1 + (r() - 0.5) * 0.2;
    const topP = [bx + lean * hgt * 0.45, G - hgt];
    const midP = [bx + lean * hgt * 0.12, G - hgt * 0.5];
    culms.push({ spine: [[bx, G], midP, topP], w: 15 - Math.abs(f) * 6 + r() * 2, i });
  }
  // back culms darker (drawn first), leaves, then front culms
  const leafSprays = [];
  culms.forEach(({ spine, w, i }) => {
    const out = taper(spine, w, w * 0.45);
    hide(ctx, out, 0, 0);
    const c = curve(spine, false, 14);
    const acc = [0];
    for (let k = 1; k < c.length; k++) acc.push(acc[k - 1] + dist(c[k - 1], c[k]));
    const L = acc[acc.length - 1];
    for (let d = 40 + r() * 10; d < L - 20; d += 44 + r() * 8) {
      const t = d / L;
      const [x, y, a] = along(c, t);
      const hw = lerp(w, w * 0.45, t) / 2 + 1.5;
      const nx = -Math.sin(a), ny = Math.cos(a);
      hide(ctx, [[x - nx * hw, y - ny * hw], [x + nx * hw, y + ny * hw], [x + nx * hw + Math.cos(a) * 3, y + ny * hw + Math.sin(a) * 3], [x - nx * hw + Math.cos(a) * 3, y - ny * hw + Math.sin(a) * 3]], 0, 0);
      slit(ctx, [[x - nx * (hw - 2), y - ny * (hw - 2)], [x + nx * (hw - 2), y + ny * (hw - 2)]], 1, { smoothIt: false });
      if (t > 0.35) leafSprays.push({ x, y, a, side: i % 2 ? 1 : -1, t, s: 1 - t * 0.3 });
    }
    gold(ctx, offsetLine(c.slice(2, -4), -w * 0.18), 0.9);
    dotLine(ctx, offsetLine(c.slice(3, -6), w * 0.15), { spacing: 5, r: 0.9, seed: i, smoothIt: false });
    if (i % 2) dye(ctx, poly(inset(out, 2)), INK.jade, 0.35);
  });
  // leaf sprays at nodes: a twig with a fan of slender leaves
  const lp = new Path2D();
  const leafList = [];
  leafSprays.forEach(({ x, y, a, side, s }, k) => {
    if (k % 2) side = -side;
    const tw = a + side * 1.2;
    const tl = 30 * s;
    const tip = [x + Math.cos(tw) * tl, y + Math.sin(tw) * tl];
    addPts(lp, taper([[x, y], tip], 2.4, 1.2, { smoothIt: false }));
    const cnt = 3 + (k % 3);
    for (let j = 0; j < cnt; j++) {
      const la = tw + side * (0.4 + j * 0.35) + 0.5; // droop
      const lf = almondPts(tip[0], tip[1], (40 + r() * 12) * s, 8.5 * s, la, 0.12 * side);
      addPts(lp, lf);
      leafList.push({ pts: lf, x: tip[0], y: tip[1], a: la, l: (40) * s });
    }
  });
  leather(ctx, lp);
  dye(ctx, lp, INK.green, 0.55);
  const sl = new Path2D();
  leafList.forEach(({ x, y, a, l }) => { sl.moveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); sl.lineTo(x + Math.cos(a) * l * 0.85, y + Math.sin(a) * l * 0.85); });
  ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 0.9; ctx.stroke(sl); ctx.restore();
  // young shoots (หน่อไม้) at the foot
  for (const [x, s] of [[cx - 70, 1], [cx + 64, 0.8], [cx + 96, 0.6]]) {
    const sh = [[x - 14 * s, G], [x - 10 * s, G - 22 * s], [x - 3 * s, G - 44 * s], [x + 2 * s, G - 56 * s], [x + 6 * s, G - 40 * s], [x + 12 * s, G - 20 * s], [x + 14 * s, G]];
    hideS(ctx, sh);
    dye(ctx, smooth(inset(sh, 1.2)), INK.gold, 0.55);
    for (let k = 1; k < 4; k++) gold(ctx, [[x - 12 * s + k * 2, G - k * 12 * s], [x, G - k * 12 * s - 6 * s], [x + 12 * s - k * 2, G - k * 12 * s]], 0.8);
  }
  // ground tuft
  hide(ctx, [[cx - 80, G], [cx - 60, G - 10], [cx + 60, G - 10], [cx + 80, G]], 0.6, 5);
  age(ctx, W, H, 0.3);
}

// ============================================================== lotus
function drawLotus(ctx, { rng: r, w: W, h: H }) {
  const G = H, wl = G - 44; // water line
  // stems first
  const flowers = [[120, 70, 'open'], [236, 40, 'open'], [300, 120, 'bud'], [60, 130, 'bud'], [190, 104, 'pod']];
  flowers.forEach(([x, y], i) => {
    const bx = x + (i % 2 ? -14 : 12);
    hide(ctx, taper([[bx, wl + 6], [lerp(bx, x, 0.5) + (i % 2 ? 10 : -10), lerp(wl, y, 0.5)], [x, y + 20]], 5, 3.2), 0, 0);
  });
  // raised pads on stalks, facing out
  const pads = [[300, 200, 38, 0.3], [40, 190, 30, -0.4], [180, 160, 30, 0.9]];
  pads.forEach(([x, y, R, rot], i) => {
    hide(ctx, taper([[x + (i ? 6 : -6), wl + 6], [x, y + R * 0.6]], 4.5, 3.5), 0, 0);
    const pts = [];
    const n = 30;
    for (let k = 0; k <= n; k++) {
      const a = rot + 0.18 + (k / n) * (TAU - 0.36);
      const rr = R * (1 + Math.sin(k * 1.7 + i) * 0.03);
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.92]);
    }
    pts.push([x, y]);
    hide(ctx, pts, 0, 0);
    dye(ctx, poly(inset(pts, 2)), INK.green, 0.7);
    for (let k = 0; k < 9; k++) {
      const a = rot + 0.5 + (k / 9) * (TAU - 0.9);
      slit(ctx, [[x + Math.cos(a) * 5, y + Math.sin(a) * 5], [x + Math.cos(a) * R * 0.86, y + Math.sin(a) * R * 0.8]], 0.9, { smoothIt: false });
    }
    rimDots(ctx, pts, 3, { spacing: 3.8, r: 0.85, seed: i });
    hole(ctx, x, y, 1.6);
  });
  // flowers
  flowers.forEach(([x, y, kind], i) => {
    if (kind === 'open') {
      const layers = [[-1.05, 34, 18, INK.pink], [1.05, 34, 18, INK.pink], [-0.62, 38, 20, INK.pink], [0.62, 38, 20, INK.pink], [-0.22, 40, 20, INK.pink], [0.22, 40, 20, INK.pink]];
      const cup = [[x - 20, y + 18], [x + 20, y + 18], [x + 14, y + 28], [x - 14, y + 28]];
      hide(ctx, cup, 0, 0);
      dye(ctx, poly(cup), INK.green, 0.7);
      layers.forEach(([a, l, w, col], k) => {
        const p = petalPts(x + Math.sin(a) * 8, y + 22, w, l, -Math.PI / 2 + a);
        hide(ctx, p, 0, 0);
        dye(ctx, poly(inset(p, 1.2)), col, 0.85);
        dye(ctx, poly(petalPts(x + Math.sin(a) * 8, y + 22, w * 0.5, l * 0.8, -Math.PI / 2 + a)), INK.white, 0.35);
        gold(ctx, inset(p, 1.2), 0.7, { closed: true, smoothIt: false });
        hole(ctx, x + Math.sin(a) * 8 + Math.sin(a) * l * 0.55, y + 22 - Math.cos(a) * l * 0.55, 1);
      });
      const front = petalPts(x, y + 26, 24, 34, -Math.PI / 2);
      hide(ctx, front, 0, 0);
      dye(ctx, poly(inset(front, 1.2)), INK.pink, 0.9);
      gold(ctx, inset(front, 1.2), 0.8, { closed: true, smoothIt: false });
      dotLine(ctx, [[x, y + 20], [x, y - 2]], { spacing: 3.2, r: 0.8, smoothIt: false });
    } else if (kind === 'bud') {
      const p = petalPts(x, y + 26, 22, 44, -Math.PI / 2);
      hide(ctx, p, 0, 0);
      dye(ctx, poly(inset(p, 1.2)), INK.pink, 0.85);
      const p2 = petalPts(x - 3, y + 26, 13, 38, -Math.PI / 2 - 0.12);
      gold(ctx, p2, 0.8, { closed: true, smoothIt: false });
      dotLine(ctx, [[x + 5, y + 20], [x + 2, y - 6]], { spacing: 3.2, r: 0.8, smoothIt: false });
    } else {
      const pod = [[x - 16, y], [x + 16, y], [x + 8, y + 22], [x - 8, y + 22]];
      hideS(ctx, pod);
      dye(ctx, smooth(inset(pod, 1)), INK.gold, 0.6);
      holes(ctx, [[x - 8, y + 5], [x, y + 4], [x + 8, y + 5], [x - 4, y + 11], [x + 4, y + 11]], 2);
    }
  });
  // floating pads on the water
  for (const [x, w] of [[80, 60], [210, 70], [330, 50]]) {
    const pad = [[x - w / 2, wl + 2], [x - w * 0.3, wl - 5], [x + w * 0.3, wl - 5], [x + w / 2, wl + 2], [x + w * 0.3, wl + 6], [x - w * 0.3, wl + 6]];
    hideS(ctx, pad);
    dye(ctx, smooth(inset(pad, 1)), INK.jade, 0.7);
    dotLine(ctx, [[x - w * 0.4, wl], [x + w * 0.4, wl]], { spacing: 3.6, r: 0.8, smoothIt: false });
  }
  // water band: stylised wave scallops (ลายน้ำ)
  const water = [[0, wl + 4], [W, wl + 4], [W, G], [0, G]];
  hide(ctx, water, 0.6, 7);
  dye(ctx, poly(inset(water, 2)), INK.teal, 0.7);
  ctx.save();
  ctx.clip(poly(inset(water, 2.5)));
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = 1.1;
  for (let row = 0, y = wl + 14; y < G + 6; y += 10, row++) {
    ctx.beginPath();
    for (let x = -10 + (row % 2) * 10; x < W + 20; x += 20) { ctx.moveTo(x + 9, y); ctx.arc(x, y, 9, 0, Math.PI, true); }
    ctx.stroke();
  }
  ctx.restore();
  // a leaping fish
  const fx = 346, fy = wl - 20;
  const fish = [[fx - 20, fy + 8], [fx - 8, fy - 4], [fx + 6, fy - 6], [fx + 16, fy - 2], [fx + 20, fy + 2], [fx + 14, fy + 6], [fx, fy + 8], [fx - 12, fy + 12], [fx - 24, fy + 20], [fx - 22, fy + 10], [fx - 28, fy + 2]];
  hideS(ctx, fish);
  dye(ctx, smooth(inset(fish, 1.2)), INK.gold, 0.6);
  dotLine(ctx, [[fx - 10, fy + 4], [fx + 8, fy]], { spacing: 3, r: 0.7 });
  hole(ctx, fx + 13, fy, 1);
  age(ctx, W, H, 0.25);
}

// ======================================================= mural rocks
// เขามอ — Thai mural rocks are piles of faceted blocks seen a little from
// above: a pale top face, a dyed front face streaked with fine lines and a
// dark side face. Stacked back to front they make a stepped mountain.
function prism(ctx, x, yb, w, h, { seed = 1, front = INK.teal, top = INK.cream, depth = 0.3, slant = 0 } = {}) {
  const r = rng(seed);
  const dx = w * depth, dy = w * depth * 0.62;
  const yt = yb - h;
  const sl = slant * h; // right corner lower by sl
  const j = () => (r() - 0.5) * 3;
  const bul = w * 0.05;
  const fr = [[x + j(), yb], [x - bul, yb - h * 0.5], [x + j(), yt + 6], [x + 5, yt + j() * 0.3], [x + w - 5, yt + sl], [x + w + j() * 0.3, yt + sl + 6], [x + w + bul, yb - (h - sl) * 0.5], [x + w, yb]];
  const tp = [[x + 5, yt], [x + w - 5, yt + sl], [x + w + dx - 3, yt + sl - dy], [x + dx + 3, yt - dy]];
  const sd = [[x + w - 1, yt + sl + 6], [x + w + dx - 3, yt + sl - dy + 2], [x + w + dx + bul * 0.5, yb - dy - (h - sl) * 0.5], [x + w + dx, yb - dy - 2], [x + w, yb]];
  const all = [fr[0], fr[1], fr[2], fr[3], tp[3], tp[2], sd[1], sd[2], sd[3], fr[7]];
  leather(ctx, poly(curve(all, true, 4, 0.2)));
  dye(ctx, poly(inset(fr, 2.5)), front, 0.5);
  dye(ctx, poly(inset(tp, 2)), top, 0.78);
  dye(ctx, poly(inset(sd, 2)), INK.indigo, 0.25);
  gold(ctx, inset(tp, 2), 1, { closed: true, smoothIt: false });
  gold(ctx, [[x + 3, yb - 2], [x + 2, yb - h * 0.5], [x + 3, yt + 7], [x + w - 3, yt + sl + 4], [x + w - 2, yb - (h - sl) * 0.5], [x + w - 3, yb - 2]], 0.9);
  dotLine(ctx, [[x + 8, yt + 8], [x + w - 8, yt + sl + 7]], { spacing: 4.2, r: 1, seed, smoothIt: false });
  // streaks down the front face
  const n = Math.max(1, Math.floor(w / 13));
  for (let k = 1; k <= n; k++) {
    const sx = x + (k / (n + 1)) * w + j();
    const len = h * (0.35 + r() * 0.45);
    slit(ctx, [[sx, yt + 12 + r() * 6], [sx + j() * 0.6, yt + 12 + len]], 0.9, { smoothIt: false });
    if (k % 2) dotLine(ctx, [[sx + 4, yt + 16], [sx + 4, yt + 12 + len * 0.6]], { spacing: 4.4, r: 0.75, seed: seed + k, smoothIt: false });
  }
  dotLine(ctx, [[x + w + dx * 0.5, yt - dy * 0.5 + 8], [x + w + dx * 0.5, yb - dy * 0.5 - 8]], { spacing: 5, r: 0.8, seed: seed + 9, smoothIt: false });
  return { top: [x + w / 2 + dx / 2, yt + sl / 2 - dy / 2], w };
}

function tuft(ctx, x, y, s, seed = 1) {
  const r = rng(seed);
  const list = [];
  for (let k = -2; k <= 2; k++) list.push(kanokPts(x + k * s * 0.18, y, s * (0.7 + r() * 0.4) * (1 - Math.abs(k) * 0.15), -Math.PI / 2 + k * 0.35, k > 0));
  hideMany(ctx, list);
  list.forEach((p) => dye(ctx, poly(p), INK.green, 0.6));
}

function crag(ctx, cx, W, G, H, { seed = 1, rows = 5, rowStep = 64, cave = true, trees = true } = {}) {
  const r = rng(seed);
  const fronts = [INK.teal, INK.green, INK.jade, INK.teal, INK.brown, INK.green];
  const tops = [INK.cream, INK.gold, INK.cream, INK.yellow];
  const env = (x) => H * Math.max(Math.pow(Math.max(0, 1 - Math.abs(x - cx + W * 0.06) / (W * 0.5)), 1.1), 0.8 * Math.pow(Math.max(0, 1 - Math.abs(x - cx - W * 0.24) / (W * 0.3)), 1.1));
  const perched = [];
  for (let row = 0; row < rows; row++) {
    const yb = G - (rows - 1 - row) * rowStep;
    let x = 4 + (row % 2) * 14 + r() * 10;
    while (x < W - 30) {
      const w = 34 + r() * 40;
      const hmax = Math.min(rowStep * 2.2, env(x + w / 2) - (G - yb));
      if (hmax > 26) {
        const h = Math.max(26, hmax * (0.65 + r() * 0.35));
        const k = Math.floor(r() * 99);
        const pr = prism(ctx, x, yb, Math.min(w, W - 20 - x), h, { seed: seed * 100 + row * 20 + k, front: fronts[k % fronts.length], top: tops[k % tops.length], slant: (r() - 0.5) * 0.35, depth: 0.26 });
        if (row < rows - 1 && r() < 0.45) perched.push(pr);
      }
      x += w - 6 + r() * 4;
    }
  }
  if (trees) perched.slice(0, 7).forEach(({ top, w }, i) => {
    hide(ctx, taper([[top[0], top[1] + 4], [top[0], top[1] - 12]], 4, 2.4, { smoothIt: false }), 0, 0);
    tuft(ctx, top[0], top[1] - 8, 18 + (w % 12), seed + i);
  });
  return perched;
}

function drawMountain(ctx, { rng: r, w: W, h: H }) {
  // ภูเขาสินเทา — a mural mountain of stacked faceted blocks rising to a
  // central peak, with a hermit's cave at the foot and a waterfall.
  const G = H, cx = W / 2;
  crag(ctx, cx, W, G, H - 30, { seed: 7, rows: 13, rowStep: 44 });
  // cave (ถ้ำ) at the foot
  const cv = curve([[cx - 44, G], [cx - 44, G - 60], [cx - 30, G - 94], [cx, G - 110], [cx + 30, G - 94], [cx + 44, G - 60], [cx + 44, G]], false, 6);
  const rim = curve([[cx - 58, G], [cx - 58, G - 64], [cx - 40, G - 106], [cx, G - 126], [cx + 40, G - 106], [cx + 58, G - 64], [cx + 58, G]], false, 6);
  hide(ctx, [...rim, [cx + 58, G]], 0, 0);
  dye(ctx, poly(rim), INK.brown, 0.4);
  gold(ctx, rim.slice(1, -1).map(([x, y]) => [lerp(x, cx, 0.1), y + 6]), 1.2);
  dotLine(ctx, rim.slice(1, -1).map(([x, y]) => [lerp(x, cx, 0.18), y + 11]), { spacing: 3.8, r: 0.95, smoothIt: false });
  cut(ctx, poly(cv));
  // stalactite teeth
  for (let k = -3; k <= 3; k++) hide(ctx, [[cx + k * 10 - 4, G - 104 + Math.abs(k) * 4], [cx + k * 10 + 4, G - 104 + Math.abs(k) * 4], [cx + k * 10, G - 90 + Math.abs(k) * 4]], 0, 0);
  // waterfall ribbon from a notch on the right
  const wf = [[cx + 128, G - 370], [cx + 150, G - 370], [cx + 160, G - 200], [cx + 170, G - 18], [cx + 124, G - 18], [cx + 128, G - 200]];
  const wfp = smooth(wf);
  leather(ctx, wfp);
  dye(ctx, wfp, INK.cream, 0.5);
  ctx.save(); ctx.clip(wfp);
  for (let x = cx + 120; x < cx + 172; x += 5) slit(ctx, [[x, G - 370], [x + 2, G - 280], [x - 1, G - 160], [x + 3, G - 18]], 1.4);
  ctx.restore();
  for (let k = 0; k < 6; k++) hideMany(ctx, [kanokPts(cx + 126 + k * 9, G - 8, 16, -Math.PI / 2 + (k - 2.5) * 0.3, k > 2)]);
  age(ctx, W, H, 0.28);
}

function drawRock(ctx, { w: W, h: H }) {
  const G = H;
  prism(ctx, 38, G - 20, 72, 66, { seed: 3, front: INK.teal, top: INK.cream, slant: 0.18, depth: 0.26 });
  prism(ctx, 4, G, 64, 52, { seed: 4, front: INK.green, top: INK.gold, slant: -0.14, depth: 0.26 });
  prism(ctx, 84, G, 60, 40, { seed: 5, front: INK.jade, top: INK.cream, slant: 0.22, depth: 0.26 });
  tuft(ctx, 70, G - 100, 18, 2);
  tuft(ctx, 128, G - 52, 13, 3);
  age(ctx, W, H, 0.28);
}

// =============================================================== sky
function drawMoon(ctx, { w: W, h: H }) {
  const cx = W / 2, cy = H / 2, R = 100;
  const disk = ellipsePts(cx, cy, R, R, 72);
  hideS(ctx, disk);
  // bright face
  const face = ellipsePts(cx, cy, R - 13, R - 13, 64);
  dye(ctx, smooth(face), INK.cream, 0.95);
  // soft maria
  for (const [x, y, rx, ry] of [[cx - 34, cy - 30, 26, 18], [cx + 38, cy + 26, 30, 22], [cx - 10, cy + 52, 20, 12], [cx + 44, cy - 40, 14, 10]]) dye(ctx, smooth(blobPts(x, y, rx, ry, { seed: x })), INK.gold, 0.25);
  // rim band: gold ring, punched dot rows, little flowers
  gold(ctx, ellipsePts(cx, cy, R - 12, R - 12, 64), 1.6, { closed: true });
  dotLine(ctx, ellipsePts(cx, cy, R - 6.5, R - 6.5, 64), { closed: true, spacing: 4, r: 1.2 });
  dotLine(ctx, ellipsePts(cx, cy, R - 17, R - 17, 64), { closed: true, spacing: 4.6, r: 0.8 });
  // the rabbit (กระต่ายในดวงจันทร์), sitting, ears back
  const rb = [
    [cx - 44, cy + 46], [cx - 52, cy + 30], [cx - 50, cy + 8], [cx - 38, cy - 8], [cx - 18, cy - 14], [cx - 2, cy - 12],
    [cx + 10, cy - 24], [cx + 8, cy - 44], [cx + 2, cy - 64], [cx + 8, cy - 70], [cx + 18, cy - 50], [cx + 22, cy - 34],
    [cx + 26, cy - 52], [cx + 34, cy - 70], [cx + 40, cy - 64], [cx + 34, cy - 36], [cx + 32, cy - 26],
    [cx + 44, cy - 18], [cx + 50, cy - 8], [cx + 44, cy], [cx + 30, cy + 2], [cx + 26, cy + 14], [cx + 30, cy + 30],
    [cx + 24, cy + 36], [cx + 14, cy + 30], [cx + 10, cy + 42], [cx + 16, cy + 48], [cx - 20, cy + 50],
  ];
  hideS(ctx, rb);
  dye(ctx, smooth(inset(rb, 2.2)), INK.brown, 0.35);
  hole(ctx, cx + 34, cy - 14, 1.8);
  rimDots(ctx, rb, 3.2, { spacing: 3.4, r: 0.85 });
  gold(ctx, [[cx - 30, cy + 20], [cx - 10, cy + 6], [cx + 12, cy + 12]], 1);
  gold(ctx, [[cx + 12, cy - 60], [cx + 18, cy - 36]], 0.8);
  gold(ctx, [[cx + 32, cy - 62], [cx + 30, cy - 36]], 0.8);
  // a scroll-cloud wisp across the bottom
  const cl = [[cx - 90, cy + 70], [cx - 60, cy + 54], [cx - 30, cy + 62], [cx, cy + 50], [cx + 30, cy + 62], [cx + 60, cy + 56], [cx + 92, cy + 74], [cx + 60, cy + 84], [cx - 60, cy + 84]];
  hideS(ctx, cl);
  dye(ctx, smooth(inset(cl, 2)), INK.indigo, 0.55);
  for (const [x, d] of [[cx - 46, 1], [cx + 14, -1], [cx + 58, 1]]) kanokScroll(ctx, x, cy + 70, 9, { dir: d, a0: 0, leaves: 0, color: INK.goldLine, w: 1 });
  age(ctx, W, H, 0.15);
}

function drawSun(ctx, { w: W, h: H }) {
  const cx = W / 2, cy = H / 2, R = 62;
  // flame rays (รัศมี) — alternate long and short kanok flames
  const rays = [];
  const n = 16;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU - Math.PI / 2;
    const long = k % 2 === 0;
    const L = long ? 72 : 50;
    rays.push({ pts: kanokPts(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8), L, a, k % 4 < 2), a, long });
  }
  hideMany(ctx, rays.map((r) => r.pts));
  rays.forEach(({ pts, a, long }) => {
    dye(ctx, poly(inset(pts, 1.6)), long ? INK.vermilion : INK.gold, 0.85);
    gold(ctx, inset(pts, 1.6), 0.8, { closed: true, smoothIt: false });
    dotLine(ctx, [[cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4)], [cx + Math.cos(a) * (R + (long ? 40 : 26)), cy + Math.sin(a) * (R + (long ? 40 : 26))]], { spacing: 4, r: 1, smoothIt: false });
  });
  const disk = ellipsePts(cx, cy, R, R, 60);
  hideS(ctx, disk);
  dye(ctx, smooth(inset(disk, 2)), INK.orange, 0.9);
  dye(ctx, smooth(ellipsePts(cx, cy, R * 0.72, R * 0.72, 48)), INK.yellow, 0.9);
  gold(ctx, ellipsePts(cx, cy, R - 4, R - 4, 60), 1.4, { closed: true });
  dotLine(ctx, ellipsePts(cx, cy, R - 9, R - 9, 60), { closed: true, spacing: 4, r: 1.1 });
  // lotus rosette at the heart
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    const p = petalPts(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, 14, 26, a);
    dye(ctx, poly(p), k % 2 ? INK.vermilion : INK.gold, 0.85);
    gold(ctx, p, 0.7, { closed: true, smoothIt: false });
    hole(ctx, cx + Math.cos(a) * 28, cy + Math.sin(a) * 28, 1.1);
  }
  prajamYam(ctx, cx, cy, 13, { color: INK.red, petal: INK.gold });
  age(ctx, W, H, 0.12);
}

function drawCloud(ctx, { rng: r, w: W, h: H }) {
  // เมฆลายไทย — a mural cloud: a row of humps whose outline is echoed by
  // nested scallop lines, a spiral curl at the head and a trailing tail.
  const base = H - 40;
  const humps = [[92, base - 12, 34], [150, base - 22, 42], [214, base - 26, 46], [276, base - 14, 36], [326, base - 2, 26]];
  const topAt = (x) => {
    let y = base - 4;
    for (const [hx, hy, R] of humps) if (Math.abs(x - hx) < R) y = Math.min(y, hy - Math.sqrt(R * R - (x - hx) * (x - hx)) * 0.92);
    return y;
  };
  const p = new Path2D();
  humps.forEach(([x, y, R], i) => addPts(p, blobPts(x, y, R, R * 0.92, { seed: i + 2, wobble: 0.03, n: 32 })));
  addPts(p, [[58, base - 10], [340, base - 10], [352, base + 10], [58, base + 14]]);
  // head curl (left) and tail (right)
  const head = spiral(56, base - 6, 26, 4, Math.PI * 0.5, -1.15, 34);
  addPts(p, taper(head, 20, 5));
  const tail = [[330, base + 8], [356, base + 10], [376, base], [384, base - 16], [374, base - 26], [364, base - 18], [370, base - 10]];
  addPts(p, taper(tail, 12, 3));
  leather(ctx, p);
  // glowing body inside a leather rim
  const body = new Path2D();
  humps.forEach(([x, y, R], i) => addPts(body, blobPts(x, y, R - 7, (R - 7) * 0.92, { seed: i + 2, wobble: 0.03, n: 32 })));
  addPts(body, [[62, base - 12], [336, base - 12], [340, base + 3], [62, base + 5]]);
  dye(ctx, body, INK.cream, 0.9);
  // nested scallop lines following the top edge
  for (const [d, kind] of [[10, 'dark'], [16, 'gold'], [23, 'dots'], [30, 'dark'], [37, 'gold']]) {
    const pts = [];
    for (let x = 64; x <= 336; x += 3) {
      const y = topAt(x) + d;
      if (y < base - 2) pts.push([x, y]); else if (pts.length) { drawRun(ctx, pts.splice(0), kind, d); }
    }
    if (pts.length) drawRun(ctx, pts, kind, d);
  }
  // little curls in the valleys between humps
  for (let k = 0; k < humps.length - 1; k++) {
    const x = (humps[k][0] + humps[k][2] + humps[k + 1][0] - humps[k + 1][2]) / 2;
    const y = topAt(x) + 6;
    const sp = spiral(x, y + 6, 7, 1.5, -Math.PI / 2, 1, 18);
    line(ctx, sp, INK.leather, 2);
    hole(ctx, x, y + 6, 1);
  }
  // head spiral detail
  const hc = spiral(56, base - 6, 18, 3, Math.PI * 0.5, -1.1, 30);
  gold(ctx, hc, 1.1);
  dotLine(ctx, spiral(56, base - 6, 24, 8, Math.PI * 0.5, -0.9, 30), { spacing: 3.6, r: 0.9, smoothIt: false });
  gold(ctx, curve(tail, false, 8).slice(2, -2), 0.9);
  // underside: flat band with a dot row
  gold(ctx, [[62, base + 2], [338, base + 2]], 1, { smoothIt: false });
  dotLine(ctx, [[62, base + 8], [344, base + 8]], { spacing: 4, r: 1, smoothIt: false });
  age(ctx, W, H, 0.1);
}

function drawRun(ctx, pts, kind, d) {
  if (pts.length < 3) return;
  if (kind === 'dots') dotLine(ctx, pts, { spacing: 3.6, r: 0.9, seed: d, smoothIt: false });
  else if (kind === 'gold') gold(ctx, pts, 1.1, { smoothIt: false });
  else line(ctx, pts, INK.leather, 2.2, { smoothIt: false });
}

function drawCampfire(ctx, { rng: r, w: W, h: H }) {
  const G = H, cx = W / 2;
  // flames: nested kanok tongues — vermilion outside, orange, yellow core
  const tongues = [[-40, 0.55, -0.62], [-26, 0.82, -0.36], [-10, 1.08, -0.14], [4, 1.28, 0.02], [18, 1.0, 0.2], [32, 0.78, 0.42], [44, 0.52, 0.66]];
  const outer = tongues.map(([dx, s, a], i) => kanokPts(cx + dx, G - 40, 118 * s, -Math.PI / 2 + a, i % 2 === 0));
  const bed = blobPts(cx, G - 48, 54, 30, { seed: 3, wobble: 0.08 });
  hideMany(ctx, [...outer, bed], false);
  dye(ctx, smooth(bed), INK.vermilion, 0.92);
  outer.forEach((pp) => dye(ctx, poly(pp), INK.vermilion, 0.92));
  tongues.forEach(([dx, s, a], i) => {
    const mid = kanokPts(cx + dx * 0.8, G - 48, 90 * s, -Math.PI / 2 + a * 0.8, i % 2 === 0);
    dye(ctx, poly(mid), INK.orange, 0.95);
    const core = kanokPts(cx + dx * 0.6, G - 50, 58 * s, -Math.PI / 2 + a * 0.6, i % 2 === 1);
    dye(ctx, poly(core), INK.yellow, 0.95);
    hole(ctx, cx + dx * 0.6 + Math.sin(a) * 40 * s, G - 50 - Math.cos(a) * 40 * s, 1.6);
  });
  // spark holes rising
  const sp = [];
  for (let k = 0; k < 14; k++) sp.push([cx + (r() - 0.5) * 60, G - 60 - r() * 90]);
  ctx.save(); ctx.clip(poly(outer.flat()));
  ctx.restore();
  holes(ctx, sp, 1.3);
  // logs crossed
  const logs = [[[cx - 62, G - 8], [cx + 50, G - 46]], [[cx + 62, G - 8], [cx - 50, G - 46]], [[cx - 70, G - 18], [cx + 70, G - 20]]];
  logs.forEach(([a, b], i) => {
    const lg = taper([a, b], 17, 15, { smoothIt: false });
    hide(ctx, lg, 0.5, i);
    dye(ctx, poly(inset(lg, 2)), INK.brown, 0.5);
    for (let t = 0.15; t < 0.9; t += 0.14) {
      const p = mix(a, b, t);
      slit(ctx, [[p[0] - 3, p[1] - 4], [p[0] + 3, p[1] + 4]], 0.9, { smoothIt: false });
    }
    // cut ends with rings
    for (const e of [a, b]) {
      hideS(ctx, ellipsePts(e[0], e[1], 7.5, 7.5, 14));
      dye(ctx, smooth(ellipsePts(e[0], e[1], 6, 6, 14)), INK.gold, 0.7);
      hole(ctx, e[0], e[1], 1.3);
    }
  });
  // ring of stones
  for (let k = -3; k <= 3; k++) {
    const st = blobPts(cx + k * 24, G - 7, 12, 8, { seed: k + 9, wobble: 0.12 });
    hideS(ctx, st);
    dye(ctx, smooth(inset(st, 1.5)), INK.leatherHi, 0.6);
    rimDots(ctx, st, 2.4, { spacing: 3.4, r: 0.7, seed: k + 20 });
  }
  age(ctx, W, H, 0.1);
}

// ======================================================= forest tree
// A lobe of foliage cut into lace: veins fan from the lobe's base, tiny
// leaves are punched out along each vein, gold runs along the veins and
// the rim carries a row of dots.
function laceLobe(ctx, outline, base, { seed = 1, color = INK.green, alpha = 0.6, veins = 6, leaf = 7.5 } = {}) {
  const r = rng(seed);
  const path = poly(outline);
  dye(ctx, poly(inset(outline, 2)), color, alpha);
  const rim = inset(outline, 7);
  // pick vein ends on the far part of the rim
  const pts = resample(rim, 6, true);
  const far = pts.map((p) => [p, dist(p, base)]).sort((a, b) => b[1] - a[1]);
  const ends = [];
  for (const [p] of far) {
    if (ends.length >= veins) break;
    if (ends.every((e) => dist(e, p) > 30)) ends.push(p);
  }
  const cutP = new Path2D();
  const goldList = [];
  ends.forEach((e, i) => {
    const m = [lerp(base[0], e[0], 0.5) + (r() - 0.5) * 18, lerp(base[1], e[1], 0.5) + (r() - 0.5) * 18];
    const v = curve([base, m, e], false, 10);
    goldList.push(v);
    const rr = resample(v, leaf * 1.15, false);
    rr.forEach(([x, y, a], k) => {
      if (k < 2) return;
      const side = k % 2 ? 1 : -1;
      const la = a + side * 0.75;
      const s = leaf * (0.75 + 0.25 * Math.sin((k / rr.length) * Math.PI));
      addPts(cutP, almondPts(x + Math.cos(la) * 1.6, y + Math.sin(la) * 1.6, s, s * 0.46, la));
    });
    // a curl at the end of alternate veins
    if (i % 2 === 0) goldList.push(spiral(e[0], e[1], 7, 1.5, Math.atan2(e[1] - m[1], e[0] - m[0]) + Math.PI / 2, 0.9, 16));
  });
  // fill the gaps between veins with punched dots
  ctx.save();
  ctx.clip(poly(inset(outline, 6)));
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(cutP);
  ctx.restore();
  goldList.forEach((v) => gold(ctx, v, 1.05));
  gold(ctx, inset(outline, 3), 1.1, { closed: true, smoothIt: false });
  rimDots(ctx, outline, 5.5, { spacing: 4, r: 0.95, seed });
  void path;
}

// Outline of a foliage lobe: a fat flame/leaf shape with a scalloped edge.
function lobePts(x, y, len, wid, ang, seed = 1) {
  const r = rng(seed);
  const c = Math.cos(ang), s = Math.sin(ang);
  const out = [];
  const n = 26;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    // teardrop: round at the base, pointed tip at u=1
    const u = (1 - Math.cos(t)) / 2; // 0..1 along the length
    const half = Math.sin(t) * wid * 0.5 * Math.pow(Math.sin(Math.PI * Math.min(0.999, u * 0.8 + 0.1)), 0.7);
    const sc = 1 + 0.07 * Math.sin(i * 2.1 + r() * 0.5) * (i % 2 ? 1 : -1);
    const X = u * len * sc - len * 0.18, Y = half * sc;
    out.push([x + X * c - Y * s, y + X * s + Y * c]);
  }
  return curve(out, true, 4, 0.5);
}

function drawForestTree(ctx, { rng: r, w: W, h: H }) {
  // ต้นไม้ป่า — tall pointed crown (like a pipal leaf) bordered with flame
  // fins, its body cut into dense lace of little leaves, with curling kanok
  // branches, flowers, birds and a monkey over the lace; trunk, roots and a
  // golden deer at the foot.
  const G = H, cx = W / 2;
  const cb = 612; // crown base
  const half = [[cx, 18], [cx + 36, 70], [cx + 96, 150], [cx + 162, 250], [cx + 214, 350], [cx + 232, 432], [cx + 214, 510], [cx + 162, 570], [cx + 88, 606], [cx + 30, cb]];
  const crown = curve([...half, [cx - 30, cb], ...half.slice(1, -1).reverse().map(([x, y]) => [2 * cx - x, y])], true, 6, 0.5);
  // flame fins all round the crown edge, leaning up toward the tip
  const edge = resample(crown, 21, true);
  const fins = [];
  edge.forEach(([x, y, a], i) => {
    if (y > cb - 26) return;
    const out = a - Math.PI / 2; // outward normal for a clockwise outline
    const up = x < cx ? 0.55 : -0.55;
    fins.push(kanokPts(x, y, 22 + (i % 2) * 6, out + up * (y < 120 ? 0.3 : 1), x > cx));
  });
  hideMany(ctx, fins);
  fins.forEach((f, i) => { dye(ctx, poly(inset(f, 1.2)), i % 2 ? INK.vermilion : INK.gold, 0.8); gold(ctx, inset(f, 1.2), 0.6, { closed: true, smoothIt: false }); hole(ctx, ...mix(f[0], f[Math.floor(f.length / 2)], 0.45), 1.1); });
  // ---- trunk and roots
  hide(ctx, [[cx - 170, G], [cx - 120, G - 22], [cx - 40, G - 30], [cx + 40, G - 30], [cx + 120, G - 22], [cx + 170, G]], 0.8, 1);
  for (const [a, b] of [[[cx - 18, G - 70], [cx - 118, G - 6]], [[cx + 18, G - 70], [cx + 124, G - 8]], [[cx - 8, G - 44], [cx - 54, G - 2]], [[cx + 10, G - 44], [cx + 62, G - 2]]]) hide(ctx, taper([a, mix(a, b, 0.5).map((v, i) => v + (i ? 8 : 0)), b], 24, 4), 0, 0);
  const trunkSpine = [[cx, G - 12], [cx - 8, G - 90], [cx + 6, G - 150], [cx, cb - 10]];
  hideS(ctx, taper(trunkSpine, 70, 44));
  // ---- the crown sheet
  hide(ctx, crown, 0.6, 3);
  // dye: green body, jade and gold zones
  dye(ctx, poly(inset(crown, 3)), INK.green, 0.6);
  ctx.save(); ctx.clip(poly(crown));
  dye(ctx, smooth(blobPts(cx, 300, 90, 170, { seed: 5 })), INK.jade, 0.5);
  dye(ctx, smooth(blobPts(cx, 120, 50, 80, { seed: 6 })), INK.gold, 0.45);
  ctx.restore();
  // lace: herringbone of little leaves radiating from the crown base
  const inner = inset(crown, 13);
  const src = [cx, cb + 40];
  const lace = new Path2D();
  for (let y = 36, row = 0; y < cb; y += 8.6, row++) {
    for (let x = cx - 240 + (row % 2) * 5; x < cx + 240; x += 10) {
      const jx = x + (r() - 0.5) * 1.6, jy = y + (r() - 0.5) * 1.6;
      const base = Math.atan2(jy - src[1], jx - src[0]);
      const la = base + ((row + Math.round(x / 10)) % 2 ? 0.62 : -0.62);
      const s = 7.4 + r() * 1.2;
      addPts(lace, almondPts(jx - Math.cos(la) * s * 0.5, jy - Math.sin(la) * s * 0.5, s, s * 0.44, la));
    }
  }
  ctx.save();
  ctx.clip(poly(inner));
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(lace);
  ctx.restore();
  gold(ctx, inset(crown, 4), 1.3, { closed: true, smoothIt: false });
  rimDots(ctx, crown, 8, { spacing: 4, r: 1.05, seed: 7 });
  gold(ctx, inset(crown, 11.5), 1, { closed: true, smoothIt: false });
  // ---- kanok branches curling over the lace
  const br = [];
  const branch = (pts, w0, w1, curl, d) => {
    const end = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const a = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
    const R0 = curl;
    // continue into a spiral that turns inward
    const c0 = [end[0] + Math.cos(a + d * Math.PI / 2) * R0, end[1] + Math.sin(a + d * Math.PI / 2) * R0];
    const sp = spiral(c0[0], c0[1], R0, R0 * 0.15, a - d * Math.PI / 2, 1.15 * d, 26);
    const all = [...curve(pts, false, 10), ...sp.slice(1)];
    br.push({ pts: all, w0, w1, d });
  };
  const B2 = (pts, w0, w1, curl) => { branch(pts, w0, w1, curl, -1); branch(pts.map(([x, y]) => [2 * cx - x, y]), w0, w1, curl, 1); };
  branch([[cx, cb], [cx - 4, 470], [cx + 4, 330], [cx, 200], [cx - 6, 120]], 20, 5, 14, 1);
  B2([[cx - 4, cb - 10], [cx - 60, 560], [cx - 128, 520], [cx - 176, 452]], 18, 6, 22);
  B2([[cx - 2, 520], [cx - 50, 450], [cx - 110, 380], [cx - 150, 300]], 15, 5, 20);
  B2([[cx, 400], [cx - 42, 330], [cx - 86, 250], [cx - 96, 176]], 13, 4, 16);
  B2([[cx, 260], [cx - 30, 200], [cx - 46, 130]], 10, 3.5, 11);
  const brP = new Path2D();
  br.forEach(({ pts, w0, w1 }) => addPts(brP, taper(pts, w0, w1, { smoothIt: false })));
  leather(ctx, brP);
  dye(ctx, brP, INK.brown, 0.5);
  br.forEach(({ pts, w0, d }, i) => {
    gold(ctx, pts.slice(1, -4), Math.max(0.8, w0 * 0.07));
    if (w0 > 12) dotLine(ctx, offsetLine(pts.slice(2, -12), w0 * 0.22 * d), { spacing: 4.2, r: 0.9, seed: i, smoothIt: false });
    // kanok leaves budding off the outer side of each branch
    const rr = resample(pts, 26, false);
    rr.forEach(([x, y, a], k) => {
      if (k === 0 || k > rr.length - 3) return;
      const side = k % 2 ? 1 : -1;
      const la = a + side * 1.0;
      const lf = kanokPts(x, y, 16 - k * 0.4, la, side > 0);
      hideMany(ctx, [lf]);
      dye(ctx, poly(lf), k % 3 ? INK.jade : INK.gold, 0.8);
      gold(ctx, inset(lf, 1.2), 0.6, { closed: true, smoothIt: false });
    });
  });
  // ---- flowers and fruit over the lace
  const flowers = [[cx - 60, 540], [cx + 62, 540], [cx - 150, 430], [cx + 150, 430], [cx - 70, 360], [cx + 72, 356], [cx - 130, 290], [cx + 132, 292], [cx - 40, 230], [cx + 40, 230], [cx, 150], [cx - 60, 170], [cx + 60, 172], [cx, 450]];
  flowers.forEach(([x, y], i) => {
    const s = 9 + (i % 3) * 1.5;
    const f = [];
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU - Math.PI / 2 + i; f.push(petalPts(x + Math.cos(a) * s * 0.2, y + Math.sin(a) * s * 0.2, s * 0.95, s * 1.15, a)); }
    hideMany(ctx, f);
    f.forEach((pp) => { dye(ctx, poly(pp), i % 4 === 3 ? INK.gold : INK.vermilion, 0.92); gold(ctx, pp, 0.6, { closed: true, smoothIt: false }); });
    dye(ctx, smooth(ellipsePts(x, y, s * 0.36, s * 0.36, 10)), INK.yellow, 0.95);
    hole(ctx, x, y, 1.2);
  });
  for (const [x, y] of [[cx - 100, 500], [cx + 100, 500], [cx - 186, 380], [cx + 186, 380]]) {
    for (const [dx, dy] of [[0, 0], [-6, 8], [6, 8], [0, 15]]) {
      const f = ellipsePts(x + dx, y + dy, 4.6, 4.6, 10);
      hideS(ctx, f);
      dye(ctx, smooth(f), INK.orange, 0.95);
    }
    hide(ctx, taper([[x, y - 8], [x, y]], 1.5), 0, 0);
  }
  // ---- creatures: two birds, a monkey
  bird(ctx, cx - 196, 424, 1);
  bird(ctx, cx + 202, 426, -1);
  bird(ctx, cx + 118, 262, -1);
  monkey(ctx, cx - 104, 520, 1);
  // ---- golden deer (กวางทอง) grazing at the foot
  goldenDeer(ctx, cx + 170, G - 6, 1);
  for (const [x, s] of [[cx - 150, 22], [cx - 96, 28], [cx + 100, 24], [cx + 230, 18], [cx - 210, 18]]) tuft(ctx, x, G - 8, s, x);
  bark(ctx, trunkSpine, 66, 44, { seed: 5, lines: 4 });
  age(ctx, W, H, 0.26);
}

function monkey(ctx, x, y, d) {
  // sitting on a branch, tail hanging
  const b = [[x - d * 8, y], [x - d * 12, y - 12], [x - d * 8, y - 24], [x - d * 2, y - 28], [x - d * 4, y - 34], [x - d * 1, y - 42], [x + d * 7, y - 44], [x + d * 13, y - 38], [x + d * 12, y - 32], [x + d * 6, y - 28], [x + d * 12, y - 20], [x + d * 22, y - 14], [x + d * 22, y - 10], [x + d * 10, y - 12], [x + d * 10, y - 2], [x + d * 16, y + 8], [x + d * 10, y + 10], [x + d * 2, y + 2]];
  hideS(ctx, b);
  hide(ctx, taper([[x - d * 8, y - 4], [x - d * 18, y + 14], [x - d * 10, y + 34], [x - d * 20, y + 44]], 4, 1.5), 0, 0);
  dye(ctx, smooth(inset(b, 1.5)), INK.brown, 0.4);
  hole(ctx, x + d * 7, y - 38, 0.9);
  hole(ctx, x + d * 10, y - 34, 0.6);
}

function goldenDeer(ctx, x, yb, d) {
  const s = 1;
  const b = [
    [x - d * 36, yb], [x - d * 34, yb - 22], [x - d * 40, yb - 36], [x - d * 36, yb - 48], [x - d * 20, yb - 52], [x + d * 8, yb - 52],
    [x + d * 20, yb - 58], [x + d * 26, yb - 76], [x + d * 30, yb - 84], [x + d * 40, yb - 84], [x + d * 46, yb - 78], [x + d * 40, yb - 74],
    [x + d * 34, yb - 70], [x + d * 28, yb - 50], [x + d * 24, yb - 40], [x + d * 26, yb - 22], [x + d * 28, yb], [x + d * 22, yb],
    [x + d * 18, yb - 26], [x + d * 10, yb - 34], [x - d * 16, yb - 34], [x - d * 22, yb - 20], [x - d * 20, yb], [x - d * 26, yb], [x - d * 28, yb - 24], [x - d * 30, yb],
  ].map(([px, py]) => [x + (px - x) * s, yb + (py - yb) * s]);
  hide(ctx, b, 0, 0);
  // antlers
  for (const k of [0, 5]) {
    const ax = x + d * (30 + k), ay = yb - 84;
    hide(ctx, taper([[ax, ay], [ax - d * 4, ay - 14], [ax + d * 4, ay - 26]], 2.4, 1), 0, 0);
    hide(ctx, taper([[ax - d * 3, ay - 10], [ax - d * 12, ay - 18]], 1.8, 0.8, { smoothIt: false }), 0, 0);
  }
  dye(ctx, poly(inset(b, 1.4)), INK.gold, 0.85);
  const spots = [];
  for (let k = 0; k < 9; k++) spots.push([x + d * (-26 + (k % 5) * 10 + (k > 4 ? 5 : 0)), yb - 46 + (k > 4 ? 7 : 0)]);
  holes(ctx, spots, 1.2);
  hole(ctx, x + d * 36, yb - 79, 1);
  gold(ctx, [[x - d * 30, yb - 38], [x - d * 10, yb - 40], [x + d * 18, yb - 44]], 0.8);
}

function bird(ctx, x, y, d) {
  const b = [[x - d * 14, y - 2], [x - d * 8, y - 10], [x + d * 2, y - 12], [x + d * 8, y - 18], [x + d * 14, y - 18], [x + d * 20, y - 15], [x + d * 14, y - 12], [x + d * 12, y - 4], [x + d * 4, y + 2], [x - d * 10, y + 4], [x - d * 26, y + 10], [x - d * 22, y + 2]];
  hideS(ctx, b);
  dye(ctx, smooth([[x - d * 10, y - 4], [x - d * 2, y - 10], [x + d * 6, y - 6], [x, y]]), INK.vermilion, 0.9);
  hole(ctx, x + d * 13, y - 15, 0.9);
  hide(ctx, taper([[x, y + 2], [x + d * 2, y + 10]], 1.6, 1.2, { smoothIt: false }), 0, 0);
}

// ============================================================== PROPS
const N = (id, name, en, w, h, draw, meta = {}, opt = {}) => ({
  id, name, en, cat: 'nature',
  build() {
    const sprite = paintSprite(w, h, draw, { name: id, pad: 20, ...opt });
    const m = typeof meta === 'function' ? meta(w, h) : meta;
    return { sprite, ...m };
  },
});

export const PROPS = [
  N('coconut-palm', 'ต้นมะพร้าว', 'Coconut palm', 460, 700, drawCoconut, { static: true, mass: 3 }, { px: 1.75 }),
  N('banana-plant', 'ต้นกล้วย', 'Banana plant', 340, 440, drawBanana, { static: true, mass: 2 }),
  N('bodhi-tree', 'ต้นโพธิ์', 'Bodhi tree', 600, 660, drawBodhi, { static: true, mass: 4 }, { px: 1.6 }),
  N('bamboo-clump', 'กอไผ่', 'Bamboo clump', 400, 640, drawBamboo, { static: true, mass: 3 }, { px: 1.75 }),
  N('lotus-pond', 'บัว', 'Lotus pond cluster', 380, 280, drawLotus, { mass: 0.8 }),
  N('mural-mountain', 'ภูเขาสินเทา', 'Mural mountain (Sinthao)', 620, 620, drawMountain, { static: true, mass: 6 }, { px: 1.6 }),
  N('rock', 'ก้อนหิน', 'Rock', 170, 110, drawRock, { mass: 2.5 }),
  N('moon', 'พระจันทร์', 'Moon with the rabbit', 220, 220, drawMoon, (w, h) => ({ static: true, glow: [w / 2, h / 2, 170], mass: 1 })),
  N('sun', 'พระอาทิตย์', 'Sun', 280, 280, drawSun, (w, h) => ({ static: true, glow: [w / 2, h / 2, 260], mass: 1 })),
  N('scroll-cloud', 'เมฆลายไทย', 'Thai scroll cloud', 396, 150, drawCloud, { static: true, mass: 0.5 }),
  N('campfire', 'กองไฟ', 'Campfire', 170, 190, drawCampfire, (w, h) => ({ glow: [w / 2, h - 60, 220], mass: 1.5 })),
  N('forest-tree', 'ต้นไม้ป่า', 'Forest tree (set piece)', 560, 780, drawForestTree, { static: true, mass: 4 }, { px: 1.6 }),
];
