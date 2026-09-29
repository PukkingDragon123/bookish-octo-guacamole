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
  // leaves: clouds around each cluster, hanging a little
  const leaves = [];
  clusters.forEach(([x, y, R], ci) => {
    const n = Math.round(R * 0.36);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + r() * 0.4;
      const rr = R * (0.35 + 0.65 * Math.sqrt(r()));
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
    dye(ctx, poly(inset(p, 1.6)), cols[(l.k * 7 + l.ci) % cols.length], 0.72);
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
// A faceted เขามอ rock block: angular stepped outline + inset contours.
function rockBlock(ctx, x0, x1, yb, h, { seed = 1, color = INK.teal, steps = 3, alpha = 0.4 } = {}) {
  const r = rng(seed);
  const w = x1 - x0;
  const pts = [[x0, yb]];
  // left side rising in steps
  pts.push([x0 + w * 0.04, yb - h * 0.55], [x0 + w * 0.12, yb - h * 0.62], [x0 + w * 0.1, yb - h * 0.82]);
  // top: angular bumps
  for (let k = 0; k < steps; k++) {
    const t0 = 0.18 + (k / steps) * 0.64, t1 = t0 + 0.64 / steps;
    const hh = h * (0.9 + r() * 0.1 - Math.abs(k - (steps - 1) / 2) * 0.06);
    pts.push([x0 + w * t0, yb - hh], [x0 + w * (t0 + t1) / 2, yb - hh - h * 0.06 - r() * h * 0.04], [x0 + w * t1, yb - hh + h * 0.04]);
  }
  pts.push([x0 + w * 0.9, yb - h * 0.8], [x0 + w * 0.88, yb - h * 0.6], [x0 + w * 0.96, yb - h * 0.52], [x1, yb]);
  const sm = curve(pts, true, 3, 0.25);
  hide(ctx, sm, 0.8, seed);
  dye(ctx, poly(inset(sm, 3)), color, alpha);
  gold(ctx, inset(sm, 3), 1.1, { closed: true, smoothIt: false });
  rimDots(ctx, sm, 6.5, { spacing: 4.2, r: 1, seed });
  if (h > 70) gold(ctx, inset(sm, 11), 0.8, { closed: true, smoothIt: false, alpha: 0.7 });
  // facet strokes (mural hatching)
  for (let k = 0; k < Math.floor(w / 24); k++) {
    const x = x0 + w * (0.2 + (k / Math.max(1, Math.floor(w / 24))) * 0.6);
    const y = yb - h * (0.3 + r() * 0.3);
    slit(ctx, [[x, y], [x - 6, y + h * 0.22]], 1, { smoothIt: false });
  }
  return sm;
}

function tuft(ctx, x, y, s, seed = 1) {
  const r = rng(seed);
  const list = [];
  for (let k = -2; k <= 2; k++) list.push(kanokPts(x + k * s * 0.18, y, s * (0.7 + r() * 0.4) * (1 - Math.abs(k) * 0.15), -Math.PI / 2 + k * 0.35, k > 0));
  hideMany(ctx, list);
  list.forEach((p) => dye(ctx, poly(p), INK.green, 0.6));
}

function drawMountain(ctx, { rng: r, w: W, h: H }) {
  // ภูเขาสินเทา — mural mountain: piled faceted blocks rising to a peak,
  // a cave at its foot, a waterfall and little trees on the crags.
  const G = H;
  const cols = [INK.teal, INK.green, INK.jade, INK.gold, INK.teal, INK.indigo];
  const blocks = [
    // back peaks
    [200, 420, G - 250, 270, 4], [120, 260, G - 170, 250, 3], [360, 520, G - 150, 250, 3],
    // middle
    [30, 190, G - 60, 250, 3], [420, 600, G - 50, 230, 3], [250, 370, G - 120, 180, 2],
    // front
    [0, 150, G, 150, 2], [150, 330, G, 160, 3], [330, 470, G, 140, 2], [470, 620, G, 120, 2],
  ];
  const outs = blocks.map(([x0, x1, yb, h, st], i) => rockBlock(ctx, x0, x1, yb, h, { seed: 20 + i, color: cols[i % cols.length], steps: st, alpha: 0.38 }));
  // summit crags
  rockBlock(ctx, 262, 350, G - 505, 70, { seed: 60, color: INK.gold, steps: 2, alpha: 0.4 });
  // trees on the crags
  for (const [x, y, s] of [[300, G - 572, 36], [168, G - 412, 26], [460, G - 390, 28], [90, G - 305, 22], [540, G - 278, 22]]) {
    hide(ctx, taper([[x, y + 14], [x, y - s * 0.3]], 4, 2), 0, 0);
    tuft(ctx, x, y - s * 0.2, s, x);
  }
  // cave at the foot of the middle block
  const cv = [[196, G], [196, G - 60], [206, G - 88], [230, G - 104], [256, G - 88], [266, G - 60], [266, G]];
  const cvp = curve(cv, false, 6);
  gold(ctx, cvp.map(([x, y]) => [lerp(x, 231, -0.12), y - 6]), 1.4);
  rimDots(ctx, [...cv.map(([x, y]) => [lerp(x, 231, -0.25), y - 10]), [266 + 8, G], [196 - 8, G]], 0, { spacing: 3.8, r: 0.9 });
  cut(ctx, poly(cvp));
  // waterfall from a notch down the right side
  const wf = [[420, G - 330], [440, G - 330], [446, G - 140], [452, G - 20], [414, G - 20], [418, G - 140]];
  const wfp = smooth(wf);
  ctx.save(); ctx.clip(wfp);
  dye(ctx, wfp, INK.cream, 0.5);
  for (let x = 412; x < 456; x += 5) slit(ctx, [[x, G - 330], [x + 1, G - 240], [x - 1, G - 140], [x + 2, G - 20]], 1.3);
  ctx.restore();
  for (let k = 0; k < 5; k++) hideMany(ctx, [kanokPts(418 + k * 8, G - 14, 14, -Math.PI / 2 + (k - 2) * 0.3, k > 2)]);
  void outs;
  age(ctx, W, H, 0.3);
}

function drawRock(ctx, { w: W, h: H }) {
  const G = H;
  rockBlock(ctx, 40, 150, G - 14, 86, { seed: 5, color: INK.teal, steps: 2, alpha: 0.4 });
  rockBlock(ctx, 0, 90, G, 70, { seed: 6, color: INK.green, steps: 2, alpha: 0.4 });
  rockBlock(ctx, 96, 170, G, 50, { seed: 7, color: INK.gold, steps: 1, alpha: 0.35 });
  tuft(ctx, 60, G - 60, 18, 2);
  tuft(ctx, 158, G - 46, 14, 3);
  age(ctx, W, H, 0.3);
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
  // เมฆลายไทย — a drifting scroll cloud: lobes that end in spiral curls.
  const base = H - 40;
  const lobes = [[64, base - 20, 38], [118, base - 50, 50], [186, base - 62, 58], [256, base - 44, 48], [310, base - 18, 36], [150, base - 6, 36], [226, base - 4, 40]];
  const p = new Path2D();
  lobes.forEach(([x, y, R], i) => addPts(p, blobPts(x, y, R, R * 0.86, { seed: i + 2, wobble: 0.05, n: 30 })));
  // curling tails
  const tails = [spiral(28, base - 4, 26, 3, Math.PI * 0.2, -1.05, 30), spiral(W - 26, base - 4, 26, 3, Math.PI * 0.8, 1.05, 30)];
  tails.forEach((sp) => addPts(p, taper(sp.slice().reverse(), 3, 16, { smoothIt: false })));
  addPts(p, [[40, base + 4], [W - 40, base + 4], [W - 60, base + 22], [60, base + 22]]);
  leather(ctx, p);
  // inner glow and spiral curls in every lobe
  lobes.forEach(([x, y, R], i) => {
    const inner = blobPts(x, y, R - 9, (R - 9) * 0.86, { seed: i + 2, wobble: 0.05, n: 30 });
    dye(ctx, smooth(inner), i % 2 ? INK.cream : INK.white, 0.8);
  });
  lobes.forEach(([x, y, R], i) => {
    const d = i % 2 ? 1 : -1;
    const sp = spiral(x + d * R * 0.1, y + R * 0.05, R * 0.62, R * 0.08, i * 1.3, 1.6 * d, 40);
    line(ctx, sp, INK.leather, 3.2);
    gold(ctx, sp, 1);
    dotLine(ctx, offsetLine(sp.slice(0, -8), 4 * d), { spacing: 3.8, r: 0.9, seed: i, smoothIt: false });
    line(ctx, blobPts(x, y, R - 9, (R - 9) * 0.86, { seed: i + 2, wobble: 0.05, n: 30 }), INK.leather, 2, { closed: true });
  });
  tails.forEach((sp, i) => { gold(ctx, sp.slice(4), 0.9); dotLine(ctx, sp.slice(2, -6), { spacing: 3.6, r: 0.9, seed: 20 + i, smoothIt: false }); });
  dotLine(ctx, [[56, base + 13], [W - 56, base + 13]], { spacing: 4, r: 1, smoothIt: false });
  age(ctx, W, H, 0.12);
}

function drawCampfire(ctx, { rng: r, w: W, h: H }) {
  const G = H, cx = W / 2;
  // flames: nested kanok tongues — vermilion outside, orange, yellow core
  const tongues = [[-34, 0.7, -0.5], [-18, 1.0, -0.22], [0, 1.25, 0], [18, 0.95, 0.24], [34, 0.68, 0.5]];
  const outer = tongues.map(([dx, s, a], i) => kanokPts(cx + dx, G - 46, 120 * s, -Math.PI / 2 + a, i % 2 === 0));
  hideMany(ctx, outer);
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
  outer.forEach((pp) => dotLine(ctx, inset(pp, 3), { closed: true, spacing: 4.4, r: 0.9, smoothIt: false }));
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
  const G = H, cx = W / 2;
  // ---- ground mound with roots and grass
  hide(ctx, [[cx - 170, G], [cx - 120, G - 22], [cx - 40, G - 30], [cx + 40, G - 30], [cx + 120, G - 22], [cx + 170, G]], 0.8, 1);
  for (const [a, b] of [[[cx - 20, G - 60], [cx - 110, G - 8]], [[cx + 20, G - 60], [cx + 118, G - 10]], [[cx - 8, G - 40], [cx - 52, G - 4]], [[cx + 10, G - 40], [cx + 60, G - 4]]]) hide(ctx, taper([a, mix(a, b, 0.5).map((v, i) => v + (i ? 6 : 0)), b], 22, 4), 0, 0);
  for (const [x, s] of [[cx - 150, 22], [cx - 96, 30], [cx + 104, 28], [cx + 150, 20]]) tuft(ctx, x, G - 10, s, x);
  // ---- trunk and main branches curling into kanok scrolls
  const trunkSpine = [[cx, G - 10], [cx - 6, G - 120], [cx + 8, G - 230], [cx, G - 330]];
  const trunk = taper(trunkSpine, 74, 44);
  hideS(ctx, trunk);
  const branches = [
    [[cx, G - 300], [cx - 70, G - 350], [cx - 150, G - 360], [cx - 190, G - 400]],
    [[cx, G - 300], [cx + 76, G - 350], [cx + 156, G - 362], [cx + 196, G - 404]],
    [[cx, G - 330], [cx - 40, G - 420], [cx - 96, G - 480], [cx - 120, G - 540]],
    [[cx, G - 330], [cx + 44, G - 424], [cx + 100, G - 484], [cx + 124, G - 546]],
    [[cx, G - 330], [cx - 6, G - 460], [cx + 4, G - 580], [cx, G - 650]],
  ];
  const brP = new Path2D();
  branches.forEach((b, i) => addPts(brP, taper(b, i < 2 ? 28 : 30, 10)));
  leather(ctx, brP);
  // curling branch tips (kanok scroll ends) peeking out
  for (const [x, y, d] of [[cx - 214, G - 330, -1], [cx + 214, G - 330, 1], [cx - 140, G - 268, -1], [cx + 142, G - 266, 1]]) {
    const sp = spiral(x, y, 22, 3, d < 0 ? 0 : Math.PI, 1.1 * d, 30);
    hide(ctx, taper(sp, 9, 3), 0, 0);
    hideMany(ctx, [kanokPts(x - d * 18, y - 16, 22, -Math.PI / 2 - d * 0.6, d > 0)]);
  }
  // hollow in the trunk with a little owl
  const hl = blobPts(cx + 4, G - 190, 14, 20, { seed: 4 });
  cut(ctx, smooth(hl));
  const owl = [[cx - 6, G - 174], [cx - 8, G - 192], [cx - 5, G - 202], [cx - 7, G - 210], [cx - 1, G - 204], [cx + 9, G - 204], [cx + 15, G - 210], [cx + 13, G - 202], [cx + 16, G - 192], [cx + 14, G - 174]];
  hideS(ctx, owl);
  holes(ctx, [[cx, G - 198], [cx + 8, G - 198]], 2.2);
  bark(ctx, trunkSpine, 70, 42, { seed: 5, lines: 4 });
  rimDots(ctx, hl, -3, { spacing: 3.4, r: 0.85 });
  // ---- foliage lobes, back to front
  const lobes = [
    // [x, y, len, wid, angle, colour]
    [cx, G - 640, 190, 170, -Math.PI / 2, INK.green],
    [cx - 118, G - 540, 170, 140, -Math.PI / 2 - 0.55, INK.jade],
    [cx + 122, G - 546, 170, 140, -Math.PI / 2 + 0.55, INK.jade],
    [cx - 190, G - 400, 150, 130, -Math.PI + 0.35, INK.green],
    [cx + 196, G - 404, 150, 130, -0.35, INK.green],
    [cx - 70, G - 470, 130, 116, -Math.PI / 2 - 0.2, INK.green],
    [cx + 74, G - 474, 130, 116, -Math.PI / 2 + 0.2, INK.green],
    [cx - 150, G - 330, 104, 92, Math.PI - 0.2, INK.jade],
    [cx + 154, G - 334, 104, 92, 0.2, INK.jade],
    [cx, G - 520, 120, 104, -Math.PI / 2, INK.gold],
  ];
  lobes.forEach(([x, y, len, wid, ang, col], i) => {
    const pts = lobePts(x, y, len, wid, ang, 30 + i);
    hide(ctx, pts, 0.8, 40 + i);
    const base = [x - Math.cos(ang) * len * 0.1, y - Math.sin(ang) * len * 0.1];
    laceLobe(ctx, pts, base, { seed: 50 + i, color: col, alpha: col === INK.gold ? 0.5 : 0.62, veins: len > 150 ? 7 : 5, leaf: len > 150 ? 8 : 7 });
  });
  // flowers (ดอก) and fruit clusters sprinkled over the crown
  for (const [x, y, s] of [[cx - 40, G - 600, 11], [cx + 60, G - 650, 10], [cx - 150, G - 470, 10], [cx + 160, G - 480, 10], [cx - 210, G - 380, 9], [cx + 200, G - 360, 9], [cx, G - 440, 12], [cx - 100, G - 360, 9], [cx + 100, G - 370, 9]]) {
    const f = [];
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU - Math.PI / 2; f.push(petalPts(x + Math.cos(a) * s * 0.2, y + Math.sin(a) * s * 0.2, s * 0.9, s * 1.1, a)); }
    hideMany(ctx, f);
    f.forEach((pp) => { dye(ctx, poly(pp), INK.vermilion, 0.92); gold(ctx, pp, 0.6, { closed: true, smoothIt: false }); });
    dye(ctx, smooth(ellipsePts(x, y, s * 0.35, s * 0.35, 10)), INK.yellow, 0.95);
    hole(ctx, x, y, Math.max(1, s * 0.12));
  }
  // hanging vines with little leaves under the side lobes
  for (const [x, y, len, d] of [[cx - 172, G - 300, 120, 1], [cx + 176, G - 304, 110, -1], [cx - 110, G - 300, 70, -1]]) {
    const v = [[x, y], [x + d * 10, y + len * 0.4], [x - d * 6, y + len * 0.75], [x + d * 4, y + len]];
    hide(ctx, taper(v, 3, 1.5), 0, 0);
    const vc = curve(v, false, 8);
    for (let k = 3; k < vc.length - 1; k += 4) {
      const lf = almondPts(vc[k][0], vc[k][1], 12, 6, Math.PI / 2 + (k % 8 < 4 ? 0.9 : -0.9));
      hideS(ctx, lf);
      dye(ctx, smooth(lf), INK.green, 0.7);
    }
  }
  // two birds perched on the curls
  bird(ctx, cx - 226, G - 350, 1);
  bird(ctx, cx + 232, G - 352, -1);
  age(ctx, W, H, 0.28);
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
  N('scroll-cloud', 'เมฆลายไทย', 'Thai scroll cloud', 380, 170, drawCloud, { static: true, mass: 0.5 }),
  N('campfire', 'กองไฟ', 'Campfire', 170, 190, drawCampfire, (w, h) => ({ glow: [w / 2, h - 60, 220], mass: 1.5 })),
  N('forest-tree', 'ต้นไม้ป่า', 'Forest tree (set piece)', 560, 780, drawForestTree, { static: true, mass: 4 }, { px: 1.6 }),
];
