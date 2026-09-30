// ของในหมู่บ้าน — village, farm and temple things cut in hide: the rice
// barn and straw stack, pens and coops, the water wheel, Loy Krathong
// lights, temple flags, bell and scripture cabinet.

import {
  INK, paintSprite, leather, dye, line, gold, hole, dotLine, dotFill, slit, cut,
  curve, poly, ellipsePts, blobPts, inset, dotFlower, prajamYam, krajangPath, krajangRow, kanokPts, lotusRow, plaid,
} from '../art/leather.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------ helpers
const C = (pts, steps = 8) => (steps <= 2 ? pts.map((p) => p.slice()) : curve(pts, true, steps));
const Q = (pts, steps = 8) => curve(pts, false, steps);

function normals(c) {
  const n = c.length, N = [];
  for (let i = 0; i < n; i++) {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    N.push([-ty / l, tx / l]);
  }
  return N;
}
const hwAt = (hw, i, n) => (typeof hw === 'function' ? hw(n > 1 ? i / (n - 1) : 0) : hw);
// Closed outline of a strip of half-width hw around centreline c.
function ribbon(c, hw, caps = true) {
  const N = normals(c), n = c.length, L = [], R = [];
  c.forEach((p, i) => {
    const h = hwAt(hw, i, n);
    L.push([p[0] - N[i][0] * h, p[1] - N[i][1] * h]);
    R.push([p[0] + N[i][0] * h, p[1] + N[i][1] * h]);
  });
  const cap = (p, nn, h, dir) => {
    const out = [], t = [nn[1] * dir, -nn[0] * dir];
    for (let k = 1; k < 6; k++) {
      const a = (k / 6) * Math.PI;
      out.push([p[0] - nn[0] * h * Math.cos(a) + t[0] * h * Math.sin(a), p[1] - nn[1] * h * Math.cos(a) + t[1] * h * Math.sin(a)]);
    }
    return out;
  };
  const endCap = caps ? cap(c[n - 1], N[n - 1], hwAt(hw, n - 1, n), 1) : [];
  const startCap = caps ? cap(c[0], [-N[0][0], -N[0][1]], hwAt(hw, 0, n), -1) : [];
  return [...L, ...endCap, ...R.reverse(), ...startCap];
}
const edgeDots = (ctx, pts, d, { sp = 3.4, r = 0.7, seed = 1 } = {}) => dotLine(ctx, inset(pts, d), { closed: true, spacing: sp, r, seed, smoothIt: false });
// Hide with a black border carrying punched dots, a gold hairline and a
// dyed interior. Returns the inner outline.
function panel(ctx, pts, { color, a = 0.9, border = 2.4, r = 0.8, sp = 3.2, seed = 1, g = true } = {}) {
  leather(ctx, poly(pts));
  const inner = inset(pts, border);
  if (color) dye(ctx, poly(inner), color, a);
  if (g && color) gold(ctx, inner, 0.55, { closed: true, smoothIt: false });
  if (r) edgeDots(ctx, pts, border * 0.5, { sp, r, seed });
  return inner;
}
function pc(ctx, pts, { color, a = 0.9, dyeIn = 1.2 } = {}) {
  leather(ctx, poly(pts));
  if (color) dye(ctx, poly(inset(pts, dyeIn)), color, a);
  return pts;
}
function clipped(ctx, pts, fn) { ctx.save(); ctx.clip(poly(pts)); fn(); ctx.restore(); }
const seeder = (rng) => () => (rng() * 1e6) | 0;
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// Wooden / bamboo stick between two points.
function stick(ctx, a, b, hw, { color = '#9a5a26', nodes = 0, sd } = {}) {
  const o = ribbon([a, b], hw, true);
  pc(ctx, o, { color, dyeIn: Math.min(0.8, hw * 0.35) });
  for (let k = 1; k <= nodes; k++) {
    const t = k / (nodes + 1);
    const x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
    line(ctx, [[x - Math.cos(ang) * hw, y - Math.sin(ang) * hw], [x + Math.cos(ang) * hw, y + Math.sin(ang) * hw]], INK.leather, 1, { smoothIt: false });
  }
  if (sd && hw > 1.8) dotLine(ctx, [a, b], { spacing: 3.6, r: Math.min(0.6, hw * 0.22), seed: sd(), smoothIt: false });
  return o;
}
// Thatch (หลังคาจาก): dyed straw panel with rows of downward slits and a
// ragged lower fringe.
function thatch(ctx, pts, bbox, sd, { color = '#c9a24a' } = {}) {
  const inner = panel(ctx, pts, { color, border: 2.2, seed: sd(), r: 0.7 });
  const [x0, y0, x1, y1] = bbox;
  clipped(ctx, inner, () => {
    for (let y = y0 + 4, r = 0; y < y1; y += 6, r++) {
      line(ctx, [[x0, y + 4], [x1, y + 4]], INK.brown, 0.7, { smoothIt: false, alpha: 0.7 });
      for (let x = x0 + (r % 2) * 2; x < x1; x += 4) slit(ctx, [[x, y], [x + 0.6, y + 4]], 0.55, { smoothIt: false });
    }
  });
}
// Woven bamboo wall (ขัดแตะ) inside a region.
function weave(ctx, pts, bbox, sd, { color = '#c99c48', cell = 6 } = {}) {
  const inner = panel(ctx, pts, { color, border: 2, seed: sd(), r: 0.6 });
  const [x0, y0, x1, y1] = bbox;
  clipped(ctx, inner, () => {
    for (let y = y0, r = 0; y < y1; y += cell, r++) for (let x = x0 + (r % 2) * cell * 0.5; x < x1; x += cell) {
      slit(ctx, [[x, y + cell * 0.25], [x + cell * 0.45, y + cell * 0.25]], 0.6, { smoothIt: false });
      slit(ctx, [[x + cell * 0.6, y + cell * 0.1], [x + cell * 0.6, y + cell * 0.6]], 0.6, { smoothIt: false });
    }
  });
  return inner;
}
function flameAt(ctx, x, y, h) {
  const f = C([[x, y - h], [x + h * 0.32, y - h * 0.35], [x + h * 0.22, y], [x - h * 0.22, y], [x - h * 0.32, y - h * 0.35]], 4);
  pc(ctx, f, { color: INK.orange, a: 0.95, dyeIn: 0.5 });
  dye(ctx, poly(C([[x, y - h * 0.7], [x + h * 0.16, y - h * 0.2], [x, y - h * 0.05], [x - h * 0.16, y - h * 0.2]], 3)), INK.yellow, 1);
}
function flower(ctx, x, y, r, color, petals = 6) {
  const p = [];
  for (let i = 0; i < petals * 2; i++) { const a = (i / (petals * 2)) * TAU; const k = i % 2 ? 0.65 : 1; p.push([x + Math.cos(a) * r * k, y + Math.sin(a) * r * k]); }
  pc(ctx, C(p, 3), { color, a: 0.95, dyeIn: 0.5 });
  hole(ctx, x, y, r * 0.2);
}
function roofTop(ctx, pts, sd, color = INK.red) {
  const i = panel(ctx, pts, { color, border: 2.4, seed: sd() });
  return i;
}

const P = (id, name, en, cat, w, h, draw, meta = {}, opt = {}) => ({
  id, name, en, cat,
  build() {
    const sprite = paintSprite(w, h, draw, { name: 'vil/' + id, pad: opt.pad ?? 8, px: opt.px });
    return { sprite, ...(typeof meta === 'function' ? meta(w, h) : meta) };
  },
});

// ================================================================ MARKET
function drawEggBasket(ctx, { rng }) {
  const sd = seeder(rng);
  pc(ctx, ribbon(Q([[10, 30], [14, 8], [36, 1], [58, 8], [62, 30]]), 1.6, true), { color: INK.horn, dyeIn: 0.5 });
  for (const [x, y, r] of [[20, 26, 7], [33, 23, 7.5], [47, 24, 7], [27, 30, 6.5], [41, 30, 6.5], [55, 29, 6]]) {
    const e = ellipsePts(x, y, r * 0.8, r, 18);
    pc(ctx, e, { color: INK.cream, a: 0.95, dyeIn: 0.8 });
    gold(ctx, e, 0.4, { closed: true, smoothIt: false });
  }
  const b = C([[4, 30], [68, 30], [62, 54], [54, 60], [18, 60], [10, 54]], 4);
  weave(ctx, b, [4, 32, 68, 60], sd, { cell: 5 });
  const rim = C([[2, 28], [70, 28], [70, 35], [2, 35]], 2);
  pc(ctx, rim, { color: INK.brown, dyeIn: 0.8 });
  dotLine(ctx, [[5, 31.5], [67, 31.5]], { spacing: 2.8, r: 0.6, seed: sd(), smoothIt: false });
}

function drawGarland(ctx, { rng }) {
  const sd = seeder(rng);
  pc(ctx, ribbon(Q([[22, 2], [14, 10], [16, 22], [22, 28], [28, 22], [30, 10], [22, 2]], 6), 1, false), { color: INK.red, dyeIn: 0.2 });
  // the jasmine body with rings of rose and leaves
  const body = C([[22, 26], [34, 34], [38, 50], [34, 66], [22, 72], [10, 66], [6, 50], [10, 34]], 5);
  const bi = panel(ctx, body, { color: INK.cream, border: 1.6, seed: sd(), r: 0 });
  clipped(ctx, bi, () => {
    for (let y = 30; y < 72; y += 4.2) for (let x = 6 + ((y / 4.2) % 2) * 2; x < 40; x += 4.4) dotFlower(ctx, x, y, 0.55, 4, 2.1);
    for (const [y, c] of [[40, INK.red], [46, INK.green], [58, INK.purple]]) { line(ctx, [[0, y], [44, y]], c, 3.4, { smoothIt: false }); dotLine(ctx, [[0, y], [44, y]], { spacing: 2.6, r: 0.6, seed: sd(), smoothIt: false }); }
  });
  flower(ctx, 22, 52, 5, INK.red, 7);
  // tassels (อุบะ)
  for (const [x, len] of [[14, 36], [22, 42], [30, 36]]) {
    const s = [[x, 70], [x + (x - 22) * 0.2, 70 + len * 0.5], [x + (x - 22) * 0.3, 70 + len]];
    pc(ctx, ribbon(Q(s, 6), 1.8, true), { color: INK.cream, dyeIn: 0.4 });
    for (let k = 0; k < 4; k++) hole(ctx, lerp(s[0][0], s[2][0], (k + 0.5) / 5), 72 + k * len / 5, 0.6);
    flower(ctx, s[2][0], s[2][1], 3.4, INK.red, 5);
    pc(ctx, ribbon([[s[2][0], s[2][1] + 3], [s[2][0], s[2][1] + 8]], 1.4, true), { color: INK.green, dyeIn: 0.4 });
  }
}

// ================================================================ HOUSEHOLD / FARM
function drawPlough(ctx, { rng }) {
  const sd = seeder(rng);
  // beam (คันไถ) to the yoke, handle, wooden sole with an iron share
  const beam = ribbon(Q([[40, 70], [90, 46], [140, 34], [176, 30]], 6), 2.6, true);
  pc(ctx, beam, { color: '#9a5a26', dyeIn: 0.9 });
  dotLine(ctx, Q([[44, 68], [90, 46], [140, 34], [174, 30]]), { spacing: 3.2, r: 0.55, seed: sd() });
  for (const t of [[120, 38], [150, 32]]) { gold(ctx, [[t[0], t[1] - 3], [t[0] + 1, t[1] + 3]], 2, { smoothIt: false }); }
  pc(ctx, ribbon(Q([[176, 30], [180, 24], [176, 20]]), 1.4, true), { color: INK.red, dyeIn: 0.3 });
  const handle = ribbon(Q([[18, 8], [26, 30], [36, 60], [40, 78]], 6), 2.8, true);
  pc(ctx, handle, { color: '#9a5a26', dyeIn: 0.9 });
  pc(ctx, ribbon([[12, 10], [26, 6]], 2.2, true), { color: INK.brown, dyeIn: 0.7 });
  const sole = C([[30, 72], [70, 76], [104, 84], [124, 92], [100, 96], [40, 96], [28, 88]], 4);
  const si = panel(ctx, sole, { color: '#9a5a26', border: 2, seed: sd(), r: 0.6 });
  clipped(ctx, si, () => { gold(ctx, Q([[34, 80], [70, 82], [100, 88]]), 0.6); for (let k = 0; k < 4; k++) dotFlower(ctx, 44 + k * 14, 88, 0.6); });
  const share = C([[92, 84], [128, 92], [140, 98], [118, 99], [96, 96]], 2);
  pc(ctx, share, { color: '#8a8472', dyeIn: 0.8 });
  gold(ctx, [[98, 90], [126, 95]], 0.5, { smoothIt: false });
  pc(ctx, ribbon([[62, 58], [66, 76]], 2, true), { color: INK.brown, dyeIn: 0.6 });
  prajamYam(ctx, 60, 58, 4.5, { color: INK.red, petal: INK.gold });
}


function drawChair(ctx, { rng }) {
  const sd = seeder(rng);
  for (const x of [10, 62]) stick(ctx, [x, 4], [x, 118], 2.8, { sd });
  for (const x of [16, 56]) stick(ctx, [x, 70], [x, 118], 2.4, { color: '#7c4418' });
  const top = C([[4, 2], [36, -4], [68, 2], [68, 12], [4, 12]], 4);
  const ti = panel(ctx, top, { color: '#8a1a12', border: 1.6, seed: sd(), r: 0.6 });
  clipped(ctx, ti, () => krajangRow(ctx, [[6, 12], [66, 12]], 5, { color: INK.gold, inner: INK.red }));
  const splat = C([[26, 12], [46, 12], [44, 56], [28, 56]], 2);
  leather(ctx, poly(splat));
  dye(ctx, poly(inset(splat, 1)), '#9a5a26', 0.9);
  cut(ctx, poly(kanokPts(36, 50, 20, -Math.PI / 2, false)));
  gold(ctx, inset(splat, 0.8), 0.5, { closed: true, smoothIt: false });
  const seat = C([[0, 56], [72, 56], [72, 66], [0, 66]], 2);
  panel(ctx, seat, { color: '#9a5a26', border: 1.6, seed: sd(), r: 0.6 });
  stick(ctx, [10, 96], [62, 96], 1.6);
  stick(ctx, [8, 30], [26, 30], 1.4);
  stick(ctx, [46, 30], [64, 30], 1.4);
}

function drawBambooBench(ctx, { rng }) {
  const sd = seeder(rng);
  for (const x of [14, 40, 138, 164]) stick(ctx, [x, 20], [x + (x < 90 ? -4 : 4), 62], 3.2, { color: '#b99a4a', nodes: 1 });
  stick(ctx, [10, 44], [168, 44], 2, { color: '#b99a4a', nodes: 5 });
  stick(ctx, [14, 30], [40, 56], 1.4, { color: '#b99a4a' });
  stick(ctx, [164, 30], [138, 56], 1.4, { color: '#b99a4a' });
  // slatted top seen edge-on: two rails and the slat ends
  const top = C([[0, 10], [178, 10], [178, 22], [0, 22]], 2);
  const ti = panel(ctx, top, { color: '#c9a24a', border: 1.4, seed: sd(), r: 0 });
  clipped(ctx, ti, () => {
    for (let x = 6; x < 178; x += 11) line(ctx, [[x, 10], [x, 22]], INK.leather, 0.9, { smoothIt: false });
    for (let x = 1; x < 178; x += 5.5) slit(ctx, [[x, 12.5], [x + 3, 12.5]], 0.6, { smoothIt: false });
    for (let x = 3; x < 178; x += 5.5) slit(ctx, [[x, 19.5], [x + 3, 19.5]], 0.6, { smoothIt: false });
  });
  for (const x of [18, 60, 100, 140]) { const c = ellipsePts(x, 8, 5, 2.4, 12); pc(ctx, c, { color: '#d9b25a', dyeIn: 0.5 }); }
}

function drawCabinet(ctx, { rng }) {
  const sd = seeder(rng);
  // cornice
  const cap = C([[4, 12], [126, 12], [122, 24], [8, 24]], 2);
  panel(ctx, cap, { color: INK.red, border: 1.6, seed: sd(), r: 0.7 });
  krajangRow(ctx, [[8, 12], [122, 12]], 7, { color: INK.gold, inner: INK.red });
  // tapered body, black lacquer with gold (ลายรดน้ำ)
  const body = [[12, 24], [118, 24], [124, 158], [6, 158]];
  const bi = panel(ctx, body, { border: 3, seed: sd(), r: 0.8 });
  gold(ctx, inset(body, 2), 1.4, { closed: true, smoothIt: false });
  const doors = [[[20, 32], [64, 32], [64, 150], [16, 150]], [[66, 32], [110, 32], [114, 150], [66, 150]]];
  for (const [k, d] of doors.entries()) {
    gold(ctx, d, 0.9, { closed: true, smoothIt: false });
    clipped(ctx, d, () => {
      const cx = k ? 89 : 41;
      // tall flame-scroll tree of kanok in gold
      for (let i = 0; i < 6; i++) {
        const y = 140 - i * 18;
        for (const f of [false, true]) {
          const kp = kanokPts(cx + (f ? 3 : -3), y, 16, -Math.PI / 2 + (f ? 0.6 : -0.6), f);
          dye(ctx, poly(kp), INK.gold, 0.9);
          dotLine(ctx, inset(kp, 1.6), { closed: true, spacing: 2.4, r: 0.45, seed: sd(), smoothIt: false });
        }
      }
      line(ctx, [[cx, 36], [cx, 148]], INK.goldLine, 1.2, { smoothIt: false });
      prajamYam(ctx, cx, 90, 8, { color: INK.red, petal: INK.gold });
    });
  }
  void bi;
  hole(ctx, 62, 92, 1.2); hole(ctx, 68, 92, 1.2);
  // lion-paw base
  const base = C([[2, 158], [128, 158], [124, 170], [6, 170]], 2);
  panel(ctx, base, { color: INK.gold, border: 1.4, seed: sd(), r: 0.6 });
  for (const s of [-1, 1]) {
    const X = (x) => 65 + s * (x - 65);
    const leg = C([[X(8), 170], [X(22), 170], [X(20), 180], [X(12), 188], [X(2), 190], [X(4), 184], [X(10), 180]], 4);
    panel(ctx, leg, { color: INK.gold, border: 1.2, seed: sd(), r: 0.5 });
  }
  lotusRow(ctx, [[10, 170], [120, 170]], 6, { color: INK.red });
}

function drawHolyWater(ctx, { rng }) {
  const sd = seeder(rng);
  // lotus stems, buds and a leaf rising from the jar
  for (const [x0, x1, y1, open] of [[42, 26, 18, true], [56, 62, 4, false], [66, 86, 22, true], [50, 44, 30, false]]) {
    stick(ctx, [x0, 64], [x1, y1 + 8], 1.2, { color: INK.green });
    if (open) {
      for (let k = -2; k <= 2; k++) { const p = krajangPath(x1 + k * 3, y1 + 10, 6, 14, -Math.PI / 2 + k * 0.35); leather(ctx, p); dye(ctx, p, INK.pink, 0.9); gold(ctx, p, 0.4); }
      dye(ctx, poly(ellipsePts(x1, y1 + 8, 3, 2, 10)), INK.yellow, 0.95);
    } else {
      const b = C([[x1, y1 - 2], [x1 + 5, y1 + 6], [x1, y1 + 12], [x1 - 5, y1 + 6]], 4);
      pc(ctx, b, { color: INK.pink, dyeIn: 0.8 });
      gold(ctx, [[x1, y1], [x1, y1 + 11]], 0.5, { smoothIt: false });
    }
  }
  const leaf = C([[74, 40], [100, 36], [106, 48], [90, 56], [70, 54]], 5);
  pc(ctx, leaf, { color: INK.jade, dyeIn: 1 });
  for (let k = 0; k < 5; k++) gold(ctx, [[82, 48], [74 + k * 8, k % 2 ? 38 : 54]], 0.5, { smoothIt: false });
  // brass bowl-jar on a pedestal
  const jar = C([[18, 60], [92, 60], [96, 68], [104, 84], [96, 104], [72, 116], [38, 116], [14, 104], [6, 84], [14, 68]], 6);
  const ji = panel(ctx, jar, { color: INK.gold, border: 3, seed: sd(), r: 0.9 });
  clipped(ctx, ji, () => {
    lotusRow(ctx, [[4, 112], [106, 112]], 9, { color: INK.red });
    band(ctx, [[4, 74], [106, 74]], 4, INK.red, sd);
    for (let k = 0; k < 4; k++) prajamYam(ctx, 22 + k * 22, 90, 6, { color: INK.green, petal: INK.gold });
  });
  const rim = C([[12, 56], [98, 56], [100, 64], [10, 64]], 2);
  panel(ctx, rim, { color: INK.gold, border: 1.2, seed: sd(), r: 0.5 });
  const foot = C([[40, 116], [70, 116], [74, 124], [86, 132], [24, 132], [36, 124]], 3);
  panel(ctx, foot, { color: INK.gold, border: 1.2, seed: sd(), r: 0.55 });
  // สายสิญจน์: white cotton thread trailing out
  line(ctx, Q([[96, 62], [104, 56], [110, 60]]), INK.cream, 1, {});
  leather(ctx, poly(ribbon(Q([[96, 60], [106, 54], [112, 60], [116, 76]]), 0.7, true)));
  dye(ctx, poly(ribbon(Q([[96, 60], [106, 54], [112, 60], [116, 76]]), 0.7, true)), INK.cream, 0.95);
}
function band(ctx, pts, w, color, sd) { line(ctx, pts, color, w, { smoothIt: false }); dotLine(ctx, pts, { spacing: w * 0.9, r: w * 0.16, seed: sd(), smoothIt: false }); }

function drawSkyLantern(ctx, { rng }) {
  const sd = seeder(rng);
  const b = C([[36, 0], [56, 5], [67, 24], [66, 52], [58, 72], [14, 72], [6, 52], [5, 24], [16, 5]], 6);
  leather(ctx, poly(b));
  const inner = inset(b, 1.6);
  dye(ctx, poly(inner), INK.yellow, 0.95);
  clipped(ctx, inner, () => {
    const g = ctx.createLinearGradient(0, 0, 0, 74);
    g.addColorStop(0, 'rgba(210,69,31,0.7)'); g.addColorStop(0.55, 'rgba(230,187,63,0)'); g.addColorStop(1, 'rgba(251,245,230,0.6)');
    dye(ctx, poly(inner), g, 1);
    for (const x of [14, 25, 36, 47, 58]) line(ctx, Q([[36, 0], [x + (x - 36) * 0.25, 36], [x, 72]]), INK.leather, 0.8, {});
    for (let k = 0; k < 5; k++) dotFlower(ctx, 14 + k * 11, 34 + (k % 2) * 8, 0.8, 5, 2.4);
    lotusRow(ctx, [[6, 70], [66, 70]], 6, { color: INK.red });
  });
  gold(ctx, inner, 0.6, { closed: true, smoothIt: false });
  pc(ctx, ribbon([[12, 72], [60, 72]], 1.6, true), { color: INK.gold, dyeIn: 0.4 });
  for (const x of [16, 56]) stick(ctx, [x, 72], [36, 86], 0.7, { color: INK.horn });
  const fuel = rect(30, 84, 42, 90);
  pc(ctx, fuel, { color: INK.brown, dyeIn: 0.6 });
  flameAt(ctx, 36, 84, 12);
  void sd;
}

function drawKrathong(ctx, { rng }) {
  const sd = seeder(rng);
  // incense, candle and flame
  for (const x of [38, 42, 46]) { stick(ctx, [x + (x - 42) * 0.8, 4], [x, 34], 0.6, { color: INK.crimson }); hole(ctx, x + (x - 42) * 0.8, 4, 0.5); }
  const candle = rect(51, 16, 57, 38);
  pc(ctx, candle, { color: INK.cream, dyeIn: 0.8 });
  flameAt(ctx, 54, 16, 10);
  // flowers crowning the float
  for (const [x, y, r, c] of [[30, 36, 6, INK.orange], [48, 34, 5.5, INK.yellow], [66, 36, 6, INK.orange], [22, 44, 5, INK.purple], [74, 44, 5, INK.purple], [58, 42, 4.6, INK.pink]]) flower(ctx, x, y, r, c, 7);
  // folded banana-leaf petals (กลีบกระทง)
  for (let row = 0; row < 2; row++) {
    const n = row ? 7 : 8;
    for (let k = 0; k < n; k++) {
      const x = 10 + (k + (row ? 0.5 : 0)) * (76 / (n - 1)) * (row ? 0.95 : 1);
      const y = row ? 62 : 54;
      const p = krajangPath(x, y + 10, 11, row ? 18 : 22, -Math.PI / 2 + (x - 48) * 0.012);
      leather(ctx, p); dye(ctx, p, row ? INK.jade : INK.green, 0.9); gold(ctx, p, 0.5);
      hole(ctx, x, y - 2, 0.7);
    }
  }
  // banana-trunk slice base
  const base = C([[2, 66], [94, 66], [90, 80], [6, 80]], 3);
  const bi = panel(ctx, base, { color: '#b8c27a', border: 1.6, seed: sd(), r: 0.6 });
  clipped(ctx, bi, () => { for (let x = 4; x < 94; x += 5) slit(ctx, [[x, 69], [x + 1, 78]], 0.5, { smoothIt: false }); });
}

function drawBell(ctx, { rng }) {
  const sd = seeder(rng);
  const loop = ribbon(Q([[36, 18], [34, 6], [45, 0], [56, 6], [54, 18]], 6), 2.6, true);
  pc(ctx, loop, { color: INK.gold, dyeIn: 0.8 });
  const bell = C([[30, 16], [60, 16], [66, 30], [68, 60], [76, 90], [84, 104], [6, 104], [14, 90], [22, 60], [24, 30]], 5);
  const bi = panel(ctx, bell, { color: '#c89a3a', border: 2.6, seed: sd(), r: 0.8 });
  clipped(ctx, bi, () => {
    const g = ctx.createLinearGradient(6, 0, 84, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.4, 'rgba(255,240,200,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.4)');
    dye(ctx, poly(bi), g, 1);
    band(ctx, [[0, 34], [90, 34]], 3.4, INK.red, sd);
    band(ctx, [[0, 88], [90, 88]], 3.4, INK.red, sd);
    prajamYam(ctx, 45, 60, 11, { color: INK.red, petal: INK.gold });
    for (const x of [28, 62]) prajamYam(ctx, x, 60, 5, { color: INK.green, petal: INK.gold });
    lotusRow(ctx, [[0, 102], [90, 102]], 7, { color: INK.green });
    krajangRow(ctx, [[90, 36], [0, 36]].reverse(), 5, { color: INK.gold, inner: INK.red });
  });
  // lip and clapper
  pc(ctx, C([[4, 102], [86, 102], [86, 108], [4, 108]], 2), { color: INK.gold, dyeIn: 0.8 });
  stick(ctx, [45, 106], [45, 116], 1.2, { color: INK.horn });
  pc(ctx, ellipsePts(45, 118, 4, 4.4, 14), { color: INK.gold, dyeIn: 0.8 });
}

// ================================================================ NATURE
function drawStrawStack(ctx, { rng }) {
  const sd = seeder(rng);
  stick(ctx, [100, 0], [100, 30], 2.4, { color: INK.brown });
  const fringe = [];
  for (let i = 0; i <= 24; i++) fringe.push([196 - i * 8, 184 - (i % 2) * 5]);
  const stack = [...Q([[100, 12], [126, 22], [152, 50], [172, 94], [186, 146], [196, 180]], 6), ...fringe.slice(1, -1), ...Q([[4, 180], [14, 146], [28, 94], [48, 50], [74, 22], [100, 12]], 6)];
  const si = panel(ctx, stack, { color: '#d9b25a', border: 2.6, seed: sd(), r: 0.8 });
  clipped(ctx, si, () => {
    const r = rng;
    for (let y = 22; y < 186; y += 5) {
      const half = Math.min(96, 8 + (y - 12) * 0.62);
      for (let x = 100 - half; x < 100 + half; x += 5 + r() * 2) {
        const a = Math.atan2(y - 10, x - 100) - 0.2 * Math.sign(x - 100);
        slit(ctx, [[x, y], [x + Math.cos(a) * 4, y + Math.sin(a) * 4]], 0.55, { smoothIt: false });
      }
    }
    for (const y of [66, 122]) {
      line(ctx, [[0, y], [200, y + 4]], INK.brown, 4, { smoothIt: false });
      dotLine(ctx, [[0, y], [200, y + 4]], { spacing: 3.2, r: 0.7, seed: sd(), smoothIt: false });
    }
  });
  // top knot
  const knot = C([[92, 10], [100, 2], [108, 10], [104, 22], [96, 22]], 3);
  pc(ctx, knot, { color: INK.horn, dyeIn: 0.8 });
}

function drawPaddy(ctx, { rng }) {
  const sd = seeder(rng);
  const n = 13;
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    const a = -Math.PI / 2 + (t - 0.5) * 1.5;
    const L = 90 + Math.sin(t * Math.PI) * 30;
    const bx = 60 + (t - 0.5) * 20, by = 118;
    const tip = [bx + Math.cos(a) * L + (t - 0.5) * 20, by + Math.sin(a) * L];
    const mid = [bx + Math.cos(a) * L * 0.5, by + Math.sin(a) * L * 0.55];
    const blade = ribbon(Q([[bx, by], mid, tip], 6), (u) => 2.6 * (1 - u * 0.85) + 0.3, false);
    pc(ctx, blade, { color: k % 3 ? INK.green : INK.jade, dyeIn: 0.6 });
    if (k % 2) {
      // drooping golden panicle
      const pan = Q([mid, [mid[0] + (t - 0.5) * 30, mid[1] - 14], [mid[0] + (t - 0.5) * 50 + (t < 0.5 ? -6 : 6), mid[1] + 6]], 6);
      pc(ctx, ribbon(pan, 0.8, true), { color: INK.horn, dyeIn: 0.3 });
      for (let i = 2; i < pan.length; i += 2) {
        const [x, y] = pan[i];
        const g = ellipsePts(x, y, 1.8, 2.8, 8, Math.atan2(pan[i][1] - pan[i - 1][1], pan[i][0] - pan[i - 1][0]));
        pc(ctx, g, { color: INK.yellow, a: 0.95, dyeIn: 0.4 });
      }
    }
  }
  // paddy water and mud
  const water = C([[0, 112], [120, 112], [120, 132], [0, 132]], 2);
  const wi = panel(ctx, water, { color: INK.teal, border: 1.6, seed: sd(), r: 0 });
  clipped(ctx, wi, () => {
    for (const y of [118, 125]) { const w = []; for (let x = 0; x <= 120; x += 2) w.push([x, y + Math.sin(x * 0.3 + y) * 1.4]); gold(ctx, w, 0.6, { smoothIt: false }); dotLine(ctx, w.map(([x, yy]) => [x, yy + 3]), { spacing: 3.4, r: 0.55, seed: sd(), smoothIt: false }); }
  });
}

function drawScarecrow(ctx, { rng }) {
  const sd = seeder(rng);
  stick(ctx, [70, 60], [70, 230], 3.2, { color: '#b99a4a', nodes: 4 });
  stick(ctx, [6, 94], [134, 94], 2.4, { color: '#b99a4a', nodes: 3 });
  // straw poking from sleeves and hem
  for (const [x, y, dir] of [[12, 96, -1], [128, 96, 1]]) for (let k = -2; k <= 2; k++) stick(ctx, [x, y], [x + dir * 10, y + k * 4 + 6], 0.8, { color: INK.yellow });
  for (let k = 0; k < 9; k++) stick(ctx, [42 + k * 7, 156], [40 + k * 7.5, 168 + (k % 2) * 4], 0.9, { color: INK.yellow });
  // indigo ม่อฮ่อม shirt with a ผ้าขาวม้า sash
  const shirt = C([[36, 78], [104, 78], [126, 86], [128, 104], [106, 104], [104, 158], [36, 158], [34, 104], [12, 104], [14, 86]], 2);
  const si = panel(ctx, shirt, { color: INK.indigo, border: 2.2, seed: sd(), r: 0.7 });
  clipped(ctx, si, () => {
    for (let k = 0; k < 4; k++) hole(ctx, 70, 90 + k * 12, 1.2);
    gold(ctx, [[70, 80], [70, 156]], 0.6, { smoothIt: false });
    for (const x of [44, 96]) { gold(ctx, [[x - 8, 116], [x + 8, 116], [x + 8, 128], [x - 8, 128]], 0.6, { closed: true, smoothIt: false }); }
  });
  const sash = C([[34, 130], [106, 130], [106, 142], [34, 142]], 2);
  leather(ctx, poly(sash));
  plaid(ctx, poly(inset(sash, 0.8)), [34, 130, 106, 142], { a: INK.red, b: INK.green, size: 5 });
  pc(ctx, C([[98, 140], [108, 140], [112, 164], [100, 162]], 3), { color: INK.red, dyeIn: 0.8 });
  // clay-pot head with a painted face
  const head = C([[70, 32], [88, 40], [92, 56], [84, 72], [56, 72], [48, 56], [52, 40]], 5);
  const hi = panel(ctx, head, { color: '#b4532a', border: 2, seed: sd(), r: 0.6 });
  clipped(ctx, hi, () => {
    for (const x of [62, 78]) { hole(ctx, x, 52, 3); ctx.save(); ctx.fillStyle = INK.leather; ctx.beginPath(); ctx.arc(x + 0.8, 52.5, 1.6, 0, TAU); ctx.fill(); ctx.restore(); }
    line(ctx, [[58, 46], [66, 44]], INK.leather, 1.4); line(ctx, [[74, 44], [82, 46]], INK.leather, 1.4);
    slit(ctx, [[60, 62], [70, 66], [80, 62]], 1.4);
    dotLine(ctx, [[50, 68], [90, 68]], { spacing: 3, r: 0.6, seed: sd(), smoothIt: false });
  });
  // งอบ palm-leaf hat
  const hat = C([[20, 40], [48, 28], [62, 12], [70, 4], [78, 12], [92, 28], [120, 40], [110, 44], [30, 44]], 3);
  const hti = panel(ctx, hat, { color: '#d9b25a', border: 1.8, seed: sd(), r: 0.6 });
  clipped(ctx, hti, () => { for (let k = -6; k <= 6; k++) line(ctx, [[70, 4], [70 + k * 8, 44]], INK.brown, 0.7, { smoothIt: false }); band(ctx, [[30, 34], [110, 34]], 2.4, INK.red, sd); });
}

function drawWaterWheel(ctx, { rng }) {
  const sd = seeder(rng);
  const cx = 130, cy = 128, R = 112;
  // A-frame legs and the channel
  for (const s of [-1, 1]) stick(ctx, [cx, cy], [cx + s * 70, 284], 4, { color: '#9a5a26', sd });
  stick(ctx, [cx - 60, 230], [cx + 60, 230], 2.6, { color: '#9a5a26' });
  const ch = C([[0, 10], [80, 18], [80, 28], [0, 22]], 2);
  pc(ctx, ch, { color: '#b99a4a', dyeIn: 0.8 });
  stick(ctx, [20, 20], [16, 120], 2.2, { color: '#9a5a26' });
  // spokes
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    stick(ctx, [cx, cy], [cx + Math.cos(a) * R * 0.94, cy + Math.sin(a) * R * 0.94], 2.2, { color: '#b99a4a' });
  }
  // rim ring
  const outer = ellipsePts(cx, cy, R, R, 72), innerR = ellipsePts(cx, cy, R - 10, R - 10, 72);
  const ring = new Path2D();
  ring.addPath(poly(outer)); ring.addPath(poly(innerR.slice().reverse()));
  leather(ctx, ring);
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = '#b99a4a'; ctx.globalAlpha = 0.85; ctx.fill(ring, 'evenodd'); ctx.restore();
  dotLine(ctx, ellipsePts(cx, cy, R - 5, R - 5, 72), { closed: true, spacing: 3.4, r: 0.8, seed: sd(), smoothIt: false });
  gold(ctx, ellipsePts(cx, cy, R - 1.5, R - 1.5, 72), 0.6, { closed: true, smoothIt: false });
  gold(ctx, ellipsePts(cx, cy, R - 8.5, R - 8.5, 72), 0.6, { closed: true, smoothIt: false });
  // bamboo buckets and paddles on the rim
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU + 0.1;
    const p = [cx + Math.cos(a) * (R + 2), cy + Math.sin(a) * (R + 2)];
    const t = [-Math.sin(a), Math.cos(a)];
    const b = [p[0] + t[0] * 12 + Math.cos(a) * 6, p[1] + t[1] * 12 + Math.sin(a) * 6];
    pc(ctx, ribbon([p, b], 3.2, true), { color: INK.green, dyeIn: 0.9 });
    hole(ctx, b[0], b[1], 1);
    const q1 = [cx + Math.cos(a + 0.2) * (R - 4), cy + Math.sin(a + 0.2) * (R - 4)], q2 = [cx + Math.cos(a + 0.2) * (R + 12), cy + Math.sin(a + 0.2) * (R + 12)];
    pc(ctx, ribbon([q1, q2], 1.6, false), { color: '#9a5a26', dyeIn: 0.5 });
  }
  // hub rosette
  const hub = ellipsePts(cx, cy, 14, 14, 24);
  panel(ctx, hub, { color: INK.red, border: 2, seed: sd(), r: 0.6 });
  prajamYam(ctx, cx, cy, 9, { color: INK.red, petal: INK.gold });
  // falling water drops
  for (let k = 0; k < 7; k++) hole(ctx, 76 + k * 2, 30 + k * 6, 1.2);
  // stream at the foot
  const water = C([[0, 262], [260, 262], [260, 288], [0, 288]], 2);
  const wi = panel(ctx, water, { color: INK.teal, border: 1.6, seed: sd(), r: 0 });
  clipped(ctx, wi, () => { for (const y of [268, 278]) { const w = []; for (let x = 0; x <= 260; x += 3) w.push([x, y + Math.sin(x * 0.12 + y) * 2]); gold(ctx, w, 0.7, { smoothIt: false }); dotLine(ctx, w.map(([x, yy]) => [x, yy + 4]), { spacing: 3.4, r: 0.6, seed: sd(), smoothIt: false }); } });
}

// ================================================================ BUILDINGS
function drawPigPen(ctx, { rng }) {
  const sd = seeder(rng);
  // lean-to shelter over the left end
  for (const x of [12, 150]) stick(ctx, [x, 36], [x, 170], 3, { color: '#7c4418', sd });
  thatch(ctx, C([[0, 36], [170, 18], [178, 30], [4, 54]], 2), [0, 14, 180, 56], sd);
  // fence posts and rails
  for (let x = 16; x <= 296; x += 28) stick(ctx, [x, 84], [x, 170], 3, { color: '#9a5a26' });
  for (const y of [100, 134]) stick(ctx, [8, y], [300, y + 2], 2.4, { color: '#b99a4a', nodes: 6, sd });
  // gate with a cross brace
  stick(ctx, [212, 102], [264, 134], 1.8, { color: '#b99a4a' });
  stick(ctx, [212, 134], [264, 102], 1.8, { color: '#b99a4a' });
  // trough
  const tr = C([[176, 150], [254, 150], [248, 168], [182, 168]], 2);
  const ti = panel(ctx, tr, { color: '#8a8472', border: 1.8, seed: sd(), r: 0.6 });
  clipped(ctx, ti, () => dye(ctx, poly(rect(170, 150, 260, 155)), INK.green, 0.8));
  // straw on the floor under the shelter
  for (let k = 0; k < 16; k++) stick(ctx, [20 + k * 8, 170], [26 + k * 8, 164 - (k % 3) * 2], 0.8, { color: INK.yellow });
}

function drawCoop(ctx, { rng }) {
  const sd = seeder(rng);
  for (const x of [40, 160]) stick(ctx, [x, 140], [x, 220], 3.4, { color: '#7c4418' });
  for (const x of [70, 130]) stick(ctx, [x, 140], [x, 220], 2.8, { color: '#5a3212' });
  // slatted box
  const box = rect(30, 84, 170, 152);
  leather(ctx, poly(box));
  dye(ctx, poly(inset(box, 1.4)), '#b99a4a', 0.85);
  for (let x = 38; x < 166; x += 9) cut(ctx, poly(rect(x, 94, x + 4, 142)));
  for (const y of [90, 146]) { line(ctx, [[30, y], [170, y]], INK.leather, 1, { smoothIt: false }); dotLine(ctx, [[34, y], [166, y]], { spacing: 3, r: 0.6, seed: sd(), smoothIt: false }); }
  // doorway and the ramp with rungs
  const door = rect(118, 108, 146, 146);
  pc(ctx, door, { color: INK.brown, dyeIn: 1 });
  cut(ctx, poly(C([[122, 112], [142, 112], [142, 144], [122, 144]], 2)));
  stick(ctx, [132, 150], [196, 216], 2, { color: '#b99a4a' });
  for (let k = 1; k < 7; k++) { const x = lerp(132, 196, k / 7), y = lerp(150, 216, k / 7); stick(ctx, [x - 4, y + 4], [x + 4, y - 4], 1.2, { color: '#7c4418' }); }
  // thatched roof with a vermilion ridge
  thatch(ctx, C([[6, 92], [100, 22], [194, 92], [184, 98], [100, 36], [16, 98]], 2), [6, 20, 194, 100], sd);
  const ridge = ribbon([[40, 66], [100, 22], [160, 66]], 2.4, true);
  pc(ctx, ridge, { color: INK.vermilion, dyeIn: 0.8 });
  for (const s of [-1, 1]) { const k = kanokPts(100 + s * 4, 22, 14, -Math.PI / 2 + s * 0.5, s > 0); leather(ctx, poly(k)); dye(ctx, poly(inset(k, 0.8)), INK.gold, 0.9); }
}

function drawRiceBarn(ctx, { rng }) {
  const sd = seeder(rng);
  // stilts on stone footings
  for (const x of [40, 100, 160, 220, 280]) {
    stick(ctx, [x, 250], [x, 340], 4.6, { color: '#7c4418', sd });
    pc(ctx, C([[x - 9, 336], [x + 9, 336], [x + 11, 350], [x - 11, 350]], 2), { color: '#8a8472', dyeIn: 1 });
  }
  stick(ctx, [30, 300], [290, 300], 2.4, { color: '#9a5a26' });
  // floor
  const floor = rect(18, 244, 302, 256);
  panel(ctx, floor, { color: '#9a5a26', border: 1.6, seed: sd(), r: 0.7 });
  // woven walls leaning in (ผนังสอบ)
  const wall = [[40, 140], [280, 140], [292, 246], [28, 246]];
  weave(ctx, wall, [28, 140, 292, 246], sd, { cell: 8 });
  for (const x of [40, 100, 160, 220, 280]) stick(ctx, [x, 142], [x + (x - 160) * 0.1, 244], 2.6, { color: '#7c4418' });
  // small hatch door and a ladder
  pc(ctx, rect(144, 176, 176, 230), { color: INK.brown, dyeIn: 1.2 });
  gold(ctx, rect(147, 179, 173, 227), 0.6, { closed: true, smoothIt: false });
  prajamYam(ctx, 160, 203, 7, { color: INK.red, petal: INK.gold });
  for (const x of [150, 172]) stick(ctx, [x, 256], [x + 36, 350], 2.2, { color: '#b99a4a' });
  for (let k = 1; k < 7; k++) { const t = k / 7; stick(ctx, [150 + t * 36, 256 + t * 94], [172 + t * 36, 256 + t * 94], 1.4, { color: '#7c4418' }); }
  // steep gable roof with the กาแล crossed bargeboards
  const roof = C([[4, 150], [160, 22], [316, 150], [300, 156], [160, 44], [20, 156]], 2);
  thatch(ctx, roof, [4, 18, 316, 158], sd);
  const gable = [[160, 46], [262, 132], [58, 132]];
  const gi = panel(ctx, gable, { color: INK.red, border: 2.4, seed: sd() });
  clipped(ctx, gi, () => {
    for (let k = 0; k < 13; k++) { const a = Math.PI + (k / 12) * Math.PI; line(ctx, [[160, 132], [160 + Math.cos(a) * 110, 132 + Math.sin(a) * 110]], INK.gold, 1.2, { smoothIt: false }); }
    const sun = ellipsePts(160, 132, 20, 20, 24);
    dye(ctx, poly(sun), INK.gold, 0.95);
    prajamYam(ctx, 160, 118, 7, { color: INK.red, petal: INK.gold });
  });
  krajangRow(ctx, [[64, 132], [256, 132]], 7, { color: INK.gold, inner: INK.red });
  for (const s of [-1, 1]) {
    const board = ribbon(Q([[160 - s * 130, 146], [160 - s * 30, 60], [160 + s * 10, 22], [160 + s * 26, 2]], 6), 4, true);
    pc(ctx, board, { color: '#9a5a26', dyeIn: 1.2 });
    dotLine(ctx, Q([[160 - s * 126, 144], [160 - s * 30, 60], [160 + s * 10, 22]]), { spacing: 3.4, r: 0.7, seed: sd() });
    const k = kanokPts(160 + s * 26, 4, 18, -Math.PI / 2 + s * 0.7, s > 0);
    leather(ctx, poly(k)); dye(ctx, poly(inset(k, 1)), INK.gold, 0.9); hole(ctx, 160 + s * 28, -2, 1);
  }
}

function drawTempleFlag(ctx, { rng }) {
  const sd = seeder(rng);
  stick(ctx, [10, 18], [10, 420], 3.2, { color: '#b99a4a', nodes: 10 });
  stick(ctx, [10, 22], [70, 22], 1.8, { color: '#b99a4a' });
  // หงส์ swan finial
  const hong = C([[6, 20], [8, 8], [14, 0], [22, 2], [18, 6], [14, 8], [16, 20]], 4);
  pc(ctx, hong, { color: INK.gold, dyeIn: 0.8 });
  const tip = kanokPts(12, 14, 12, -Math.PI * 0.8, false);
  leather(ctx, poly(tip)); dye(ctx, poly(inset(tip, 0.6)), INK.red, 0.9);
  hole(ctx, 18, 4, 0.8);
  // the centipede: a long cloth crossed by slats with tassels
  const x0 = 46, x1 = 70;
  const cloth = C([[x0, 24], [x1, 24], [x1 + 2, 360], [58 + 4, 390], [x0 - 2, 360]], 2);
  const ci = panel(ctx, cloth, { color: INK.red, border: 2, seed: sd(), r: 0.7 });
  clipped(ctx, ci, () => {
    for (let y = 30; y < 380; y += 28) { prajamYam(ctx, 58, y + 14, 7, { color: INK.green, petal: INK.gold }); dotFlower(ctx, 58, y + 3, 0.6); }
    line(ctx, [[x0 + 3, 24], [x0 + 2, 370]], INK.gold, 1.4, { smoothIt: false });
    line(ctx, [[x1 - 3, 24], [x1 - 2, 370]], INK.gold, 1.4, { smoothIt: false });
  });
  for (let y = 44; y < 370; y += 28) {
    stick(ctx, [30, y], [88, y], 1.5, { color: '#b99a4a' });
    for (const x of [30, 88]) {
      const t = C([[x - 2, y], [x + 2, y], [x + 3, y + 12], [x, y + 16], [x - 3, y + 12]], 3);
      pc(ctx, t, { color: y % 56 < 28 ? INK.gold : INK.green, dyeIn: 0.6 });
    }
  }
  const tail = C([[50, 386], [66, 386], [64, 412], [58, 420], [52, 412]], 3);
  pc(ctx, tail, { color: INK.gold, dyeIn: 0.8 });
}

function drawRoyalUmbrella(ctx, { rng }) {
  const sd = seeder(rng);
  stick(ctx, [50, 20], [50, 268], 2.4, { color: INK.gold });
  for (const y of [236, 250]) pc(ctx, rect(46, y, 54, y + 4), { color: INK.red, dyeIn: 0.6 });
  // spire finial
  const sp = C([[50, 0], [54, 14], [53, 22], [47, 22], [46, 14]], 3);
  pc(ctx, sp, { color: INK.gold, dyeIn: 0.6 });
  // five tiers, widest at the bottom (ฉัตร ๕ ชั้น)
  for (let k = 0; k < 5; k++) {
    const y = 34 + k * 38, hw = 16 + k * 8;
    const tier = [[50 - hw * 0.7, y], [50 + hw * 0.7, y], [50 + hw, y + 14], [50 - hw, y + 14]];
    const ti = panel(ctx, tier, { color: INK.cream, border: 1.6, seed: sd(), r: 0.6 });
    clipped(ctx, ti, () => { band(ctx, [[0, y + 7], [100, y + 7]], 2.6, INK.gold, sd); });
    // scalloped hem hanging below each tier
    const hem = [];
    const n = 5 + k * 2;
    for (let i = 0; i <= n; i++) {
      const x = 50 - hw + (i / n) * hw * 2;
      hem.push([x, y + 14]);
      if (i < n) hem.push([x + hw / n, y + 22]);
    }
    const hp = [...hem, [50 + hw, y + 14]];
    pc(ctx, [[50 - hw, y + 13], ...hp.slice(1), [50 + hw, y + 13]], { color: INK.gold, dyeIn: 0.6 });
    for (let i = 0; i < n; i++) hole(ctx, 50 - hw + ((i + 0.5) / n) * hw * 2, y + 17, 0.7);
  }
}

export const PROPS = [
  P('takra-khai', 'ตะกร้าไข่', 'Egg basket', 'market', 72, 62, drawEggBasket, { grip: [36, 2], holdAngle: 0 }),
  P('phuang-malai', 'พวงมาลัย', 'Jasmine garland', 'market', 44, 124, drawGarland, { grip: [22, 3], holdAngle: 0, mass: 0.4 }),
  P('khan-thai', 'คันไถ', 'Wooden plough', 'household', 184, 100, drawPlough, { grip: [18, 8], holdAngle: 0, mass: 1.4 }),
  P('kao-i-mai', 'เก้าอี้ไม้', 'Wooden chair', 'household', 72, 120, drawChair, { mass: 1.2 }),
  P('khrae-mai-phai', 'แคร่ไม้ไผ่', 'Bamboo bench (khrae)', 'household', 178, 64, drawBambooBench, { mass: 1.4 }),
  P('tu-phra-tham', 'ตู้พระธรรม', 'Lacquered scripture cabinet', 'household', 130, 192, drawCabinet, { mass: 2 }),
  P('ong-nam-mon', 'โอ่งน้ำมนต์', 'Holy-water jar with lotus', 'household', 118, 132, drawHolyWater, { mass: 1.6 }),
  P('khom-loi', 'โคมลอย', 'Sky lantern', 'household', 72, 98, drawSkyLantern, { glow: [36, 60, 170], float: true, mass: 0.3, grip: [36, 90] }),
  P('krathong', 'กระทง', 'Krathong float', 'household', 96, 82, drawKrathong, { glow: [54, 12, 120], float: true, mass: 0.6 }),
  P('rom-chat', 'ร่มฉัตร', 'Royal tiered umbrella (chat)', 'household', 100, 270, drawRoyalUmbrella, { grip: [50, 244], holdAngle: 0, mass: 0.8 }),
  P('rakhang', 'ระฆัง', 'Temple bell', 'instruments', 90, 124, drawBell, { sound: 'mong', grip: [45, 3], holdAngle: 0, mass: 1.5 }),
  P('fang-khao', 'ลอมฟางข้าว', 'Rice straw stack', 'nature', 200, 188, drawStrawStack, { static: true, mass: 2 }),
  P('ton-khao', 'ต้นข้าว', 'Rice paddy clump', 'nature', 120, 132, drawPaddy, { mass: 0.8 }),
  P('hun-lai-ka', 'หุ่นไล่กา', 'Scarecrow', 'nature', 140, 230, drawScarecrow, { mass: 1 }),
  P('kanghan-nam', 'กังหันน้ำ', 'Water wheel', 'nature', 260, 288, drawWaterWheel, { static: true, mass: 3 }, { pad: 12 }),
  P('khok-mu', 'คอกหมู', 'Pig pen', 'buildings', 304, 172, drawPigPen, { static: true, mass: 2.5 }),
  P('lao-kai', 'เล้าไก่', 'Chicken coop on stilts', 'buildings', 200, 222, drawCoop, { static: true, mass: 2 }),
  P('yung-khao', 'ยุ้งข้าว', 'Rice barn (granary)', 'buildings', 320, 352, drawRiceBarn, { static: true, mass: 4 }, { pad: 14, px: 1.8 }),
  P('thong-takhab', 'ธงตะขาบ', 'Centipede temple flag', 'buildings', 96, 422, drawTempleFlag, { static: true, mass: 1.5 }, { px: 1.8 }),
];
void blobPts;
