// Food props — market produce and street food, cut and dyed in hide.
// Small items are holdable (grip) so puppets can carry, offer or eat them.

import {
  INK, paintSprite, leather, dye, line, gold, hole, holes, dotLine, dotFill, slit, cut,
  curve, poly, ellipsePts, blobPts, inset, dotFlower, kanokPts,
} from '../art/leather.js';

const TAU = Math.PI * 2;
const K = {
  leaf: '#4c8a2c', leafHi: '#8fb83c', lime: '#b7c648', olive: '#7c8f2a',
  banana: '#e9bf3a', bamboo: '#c99c48', wood: '#a0602a', clay: '#b04e24',
  glaze: '#c4621c', roast: '#e39a3a', char: '#2a150a', plum: '#8a2f7c',
  steel: '#56779c', silver: '#e6e2cc', flesh: '#e0402f', rind: '#2f6f2a',
  pale: '#c7d98a', purple: '#9a2f55', porcelain: '#f3ecd4', chilli: '#d7301c',
};

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

// Polygon between signed offsets o0..o1 (in half-widths) along a centreline.
function side(c, hw, o0, o1) {
  const N = normals(c), A = [], B = [];
  c.forEach((p, i) => {
    const h = hwAt(hw, i, c.length);
    A.push([p[0] + N[i][0] * h * o0, p[1] + N[i][1] * h * o0]);
    B.push([p[0] + N[i][0] * h * o1, p[1] + N[i][1] * h * o1]);
  });
  return [...A, ...B.reverse()];
}

// Closed outline of a strip of half-width hw around centreline c, with
// round caps.
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

// Sub-range of a centreline by parameter.
function sub(c, t0, t1) {
  const n = c.length - 1;
  return c.slice(Math.round(t0 * n), Math.round(t1 * n) + 1);
}

function edgeDots(ctx, pts, d, { sp = 3.4, r = 0.7, seed = 1 } = {}) {
  dotLine(ctx, inset(pts, d), { closed: true, spacing: sp, r, seed, smoothIt: false });
}

// Leather piece: hide + optional dye (inset) + optional gold line + dot row.
function piece(ctx, pts, { color, a = 0.9, dyeIn = 1.4, goldIn = 0, gw = 0.7, dotsIn = 0, sp = 3.4, r = 0.7, seed = 1 } = {}) {
  leather(ctx, poly(pts));
  if (color) dye(ctx, poly(inset(pts, dyeIn)), color, a);
  if (goldIn) gold(ctx, inset(pts, goldIn), gw, { closed: true, smoothIt: false });
  if (dotsIn) edgeDots(ctx, pts, dotsIn, { sp, r, seed });
  return pts;
}

// The standard craft treatment: hide with a black border carrying a row of
// punched dots, a gold hairline where the dye starts, and a dyed interior.
// Returns the dyed (inner) outline.
function panel(ctx, pts, { color, a = 0.9, border = 2.6, r = 0.85, sp = 3.3, seed = 1, g = true, fine = 0, hide = true } = {}) {
  if (hide) leather(ctx, poly(pts));
  const inner = inset(pts, border);
  if (color) dye(ctx, poly(inner), color, a);
  if (g && color) gold(ctx, inner, 0.6, { closed: true, smoothIt: false });
  if (r) edgeDots(ctx, pts, border * 0.5, { sp, r, seed });
  if (fine) edgeDots(ctx, pts, border + fine, { sp: sp * 0.85, r: r * 0.6, seed: seed + 7 });
  return inner;
}

// A black leather strip with a row of dots laid over dyed work.
function rib(ctx, pts, w = 2.4, { r = 0.7, sp = 3, seed = 1, goldEdge = false } = {}) {
  if (goldEdge) line(ctx, pts, INK.goldLine, w + 1.2, { smoothIt: false });
  line(ctx, pts, INK.leather, w, { smoothIt: false });
  dotLine(ctx, pts, { spacing: sp, r, seed, smoothIt: false });
}

function clipped(ctx, pts, fn) {
  ctx.save();
  ctx.clip(poly(pts));
  fn();
  ctx.restore();
}

function lerp2(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function seeder(rng) {
  return () => (rng() * 1e6) | 0;
}

// A curved banana finger from base, bending up. s = side (+1 right).
function banana(ctx, base, L, w, s, spread, sd) {
  const [bx, by] = base;
  const p1 = [bx + s * (2 + L * 0.42 * spread), by - L * (0.28 - 0.2 * spread)];
  const p2 = [bx + s * (3 + L * 0.66 * spread), by - L * (0.62 - 0.22 * spread)];
  const p3 = [bx + s * (2 + L * 0.66 * spread), by - L * (0.98 - 0.26 * spread)];
  const c = Q([base, p1, p2, p3], 8);
  const hw = (t) => w * (t < 0.14 ? 0.45 + (t / 0.14) * 0.55 : t > 0.82 ? Math.max(0.28, 1 - ((t - 0.82) / 0.18) * 0.72) : 1);
  const out = ribbon(c, hw);
  leather(ctx, poly(out));
  const body = ribbon(sub(c, 0.1, 0.9), (t) => hw(0.1 + t * 0.8) * 0.72, false);
  dye(ctx, poly(body), K.banana, 0.92);
  dye(ctx, poly(ribbon(sub(c, 0.1, 0.35), (t) => hw(0.1 + t * 0.25) * 0.6, false)), K.leafHi, 0.45);
  // ridge highlight and punched row along the finger
  line(ctx, side(sub(c, 0.16, 0.84), hw, 0.35, 0.36).slice(0, 12), INK.goldLine, 0.5, { alpha: 0.8 });
  dotLine(ctx, sub(c, 0.18, 0.8), { spacing: 3.1, r: 0.5, seed: sd(), smoothIt: false });
}

// A small fish (pla-tu) along spine (tail -> head). belly = side sign.
function fish(ctx, spine, belly, sd) {
  const c = Q(spine, 10);
  const n = c.length;
  const hw = (t) => (t < 0.1 ? 1.4 + t * 4 : t < 0.55 ? 1.8 + ((t - 0.1) / 0.45) * 3.9 : t < 0.86 ? 5.7 - ((t - 0.55) / 0.31) * 0.9 : 4.8 * Math.sqrt(Math.max(0.02, (1 - t) / 0.14)));
  // tail fin
  const N = normals(c);
  const p0 = c[0], d = [c[0][0] - c[3][0], c[0][1] - c[3][1]];
  const dl = Math.hypot(d[0], d[1]) || 1, u = [d[0] / dl, d[1] / dl], nn = N[0];
  const tail = [
    [p0[0] + nn[0] * 1.6, p0[1] + nn[1] * 1.6],
    [p0[0] + u[0] * 9 + nn[0] * 6.5, p0[1] + u[1] * 9 + nn[1] * 6.5],
    [p0[0] + u[0] * 5.5, p0[1] + u[1] * 5.5],
    [p0[0] + u[0] * 9 - nn[0] * 6.5, p0[1] + u[1] * 9 - nn[1] * 6.5],
    [p0[0] - nn[0] * 1.6, p0[1] - nn[1] * 1.6],
  ];
  leather(ctx, poly(tail));
  line(ctx, [tail[0], tail[1]], INK.goldLine, 0.5, { smoothIt: false });
  line(ctx, [tail[4], tail[3]], INK.goldLine, 0.5, { smoothIt: false });
  slit(ctx, [lerp2(p0, tail[1], 0.3), lerp2(p0, tail[1], 0.75)], 0.6, { smoothIt: false });
  slit(ctx, [lerp2(p0, tail[3], 0.3), lerp2(p0, tail[3], 0.75)], 0.6, { smoothIt: false });
  // dorsal fin on the back
  const di = Math.round(n * 0.5), dj = Math.round(n * 0.66);
  const bs = -belly;
  const fin = [];
  for (let i = di; i <= dj; i++) {
    const h = hw(i / (n - 1)) * 0.9 + Math.sin(((i - di) / (dj - di)) * Math.PI) * 3.4;
    fin.push([c[i][0] + N[i][0] * h * bs, c[i][1] + N[i][1] * h * bs]);
  }
  fin.push([c[di][0] + N[di][0] * 2 * bs, c[di][1] + N[di][1] * 2 * bs]);
  leather(ctx, poly(fin));
  const body = ribbon(c, hw);
  leather(ctx, poly(body));
  dye(ctx, poly(side(c, (t) => hw(t) * 0.82, -1, 1)), K.steel, 0.9);
  dye(ctx, poly(side(c, (t) => hw(t) * 0.82, belly * 0.05, belly * 1)), K.silver, 0.85);
  line(ctx, side(sub(c, 0.12, 0.8), hw, belly * 0.02, belly * 0.03).slice(0, 14), INK.goldLine, 0.55);
  // gill arc and eye
  const g = c[Math.round(n * 0.8)], gN = N[Math.round(n * 0.8)];
  const gt = [gN[1], -gN[0]];
  line(ctx, [
    [g[0] + gN[0] * 4, g[1] + gN[1] * 4],
    [g[0] + gt[0] * 1.5, g[1] + gt[1] * 1.5],
    [g[0] - gN[0] * 4, g[1] - gN[1] * 4],
  ], INK.goldLine, 0.7);
  const e = c[Math.round(n * 0.9)], eN = N[Math.round(n * 0.9)];
  const ex = e[0] + eN[0] * bs * 1.3, ey = e[1] + eN[1] * bs * 1.3;
  hole(ctx, ex, ey, 1.5);
  ctx.fillStyle = INK.leather;
  ctx.beginPath();
  ctx.arc(ex, ey, 0.7, 0, TAU);
  ctx.fill();
  dotLine(ctx, side(sub(c, 0.15, 0.72), hw, bs * 0.5, bs * 0.52).slice(0, 20), { spacing: 2.6, r: 0.45, seed: sd(), smoothIt: false });
  dotLine(ctx, side(sub(c, 0.2, 0.72), hw, belly * 0.55, belly * 0.56).slice(0, 20), { spacing: 3, r: 0.4, seed: sd(), smoothIt: false });
}

// ------------------------------------------------------------ props
export const PROPS = [
  // ---------------------------------------------------------------- banana
  {
    id: 'banana-bunch', name: 'เครือกล้วย', en: 'Banana bunch', cat: 'food',
    build() {
      const sprite = paintSprite(94, 138, (ctx, { rng }) => {
        const sd = seeder(rng);
        const stalk = Q([[47, 0], [45, 12], [46, 40], [47, 72], [46, 104], [46, 112]]);
        const S = ribbon(stalk, (t) => 4.6 - t * 1.6);
        piece(ctx, S, { color: K.leaf, a: 0.75, dyeIn: 1.2 });
        // banana flower (ปลี) hanging below the last hand
        const bud = C([[46, 100], [53, 105], [57, 116], [54, 127], [47, 138], [40, 127], [36, 116], [39, 105]]);
        piece(ctx, bud, { color: K.purple, dyeIn: 1.3 });
        for (let k = 0; k < 4; k++) {
          const y = 108 + k * 7;
          gold(ctx, [[39 + k * 1.6, y + 4], [46.5, y - 3], [54 - k * 1.6, y + 4]], 0.7);
        }
        dotLine(ctx, [[46.5, 104], [46.5, 132]], { spacing: 3, r: 0.6, seed: sd() });
        edgeDots(ctx, bud, 2.2, { sp: 3, r: 0.55, seed: sd() });
        const tiers = [
          { y: 24, n: 7, L: 31, w: 4.4 },
          { y: 46, n: 7, L: 29, w: 4.3 },
          { y: 67, n: 6, L: 27, w: 4.1 },
          { y: 87, n: 6, L: 23, w: 3.9 },
        ];
        for (const T of tiers) {
          const order = [];
          for (let k = 0; k < T.n; k++) order.push(k);
          // middle fingers are behind, outer fingers in front
          order.sort((a, b) => Math.abs(a - (T.n - 1) / 2) - Math.abs(b - (T.n - 1) / 2));
          for (const k of order) {
            const u = k / (T.n - 1) - 0.5;
            const s = u < 0 ? -1 : 1;
            const spread = Math.min(1, Math.abs(u) * 2.1);
            const bx = 46 + u * 11, by = T.y + spread * 5;
            banana(ctx, [bx, by], T.L * (1 - spread * 0.08), T.w, s, spread, sd);
          }
          // the crown (hand base) where fingers join the stalk
          const crown = C([[38, T.y + 2], [46, T.y - 1.5], [54, T.y + 2], [53, T.y + 7], [46, T.y + 8.5], [39, T.y + 7]]);
          piece(ctx, crown, { color: K.leaf, a: 0.7, dyeIn: 1.2 });
          dotLine(ctx, [[40, T.y + 4], [46, T.y + 5.5], [52, T.y + 4]], { spacing: 2.8, r: 0.55, seed: sd() });
        }
        // cut end of the stalk
        gold(ctx, [[43, 4], [51, 4]], 1.1, { smoothIt: false });
        dotLine(ctx, [[46, 8], [46, 18]], { spacing: 3, r: 0.6, seed: sd() });
      }, { name: 'food/banana-bunch' });
      return { sprite, grip: [47, 5], holdAngle: 0 };
    },
  },

  // ---------------------------------------------------------------- coconut
  {
    id: 'coconut', name: 'มะพร้าว', en: 'Coconut', cat: 'food',
    build() {
      const sprite = paintSprite(64, 72, (ctx, { rng }) => {
        const sd = seeder(rng);
        const stem = ribbon(Q([[32, 12], [32.5, 6], [34, 1]]), 2.6);
        piece(ctx, stem, { color: K.wood, a: 0.8, dyeIn: 0.9 });
        const B = C([[32, 11], [47, 13], [57, 23], [61, 39], [57, 55], [46, 66], [33, 71], [20, 67], [9, 56], [4, 39], [8, 23], [18, 14]]);
        const inner = panel(ctx, B, { color: '#3a7a2c', border: 3, seed: sd(), r: 0.95, sp: 3.5 });
        // three faces of the nut: light, mid and shadow greens
        const r1 = Q([[29, 16], [18, 38], [22, 58], [30, 69]]);
        const r2 = Q([[35, 16], [47, 38], [43, 58], [34, 69]]);
        clipped(ctx, inner, () => {
          dye(ctx, poly([...r1, [0, 70], [0, 10]]), K.leafHi, 0.75);
          dye(ctx, poly([...r2, [64, 70], [64, 10]]), '#24561f', 0.7);
        });
        for (const r of [r1, r2]) rib(ctx, r, 2.6, { r: 0.72, sp: 3, seed: sd(), goldEdge: true });
        // punched ดอกจัน down each face
        for (const [x, y] of [[32, 30], [32, 42], [32.5, 54], [13, 34], [11.5, 46], [51, 34], [52, 46]]) dotFlower(ctx, x, y, 0.8, 5, 2.4);
        dotLine(ctx, Q([[24, 22], [20, 40], [24, 60]]).map(([x, y]) => [x - 4, y]), { spacing: 3.4, r: 0.5, seed: sd(), smoothIt: false });
        dotLine(ctx, Q([[40, 22], [44, 40], [40, 60]]).map(([x, y]) => [x + 4, y]), { spacing: 3.4, r: 0.5, seed: sd(), smoothIt: false });
        // calyx (ขั้ว) star cap
        const cal = [[16, 17.5], [21, 9.5], [26, 12.5], [32, 4], [38, 12.5], [43, 9.5], [48, 17.5], [39, 20], [32, 18], [25, 20]];
        leather(ctx, poly(cal));
        dye(ctx, poly(inset(cal, 1.1)), INK.gold, 0.95);
        gold(ctx, inset(cal, 1.1), 0.5, { closed: true, smoothIt: false });
        holes(ctx, [[32, 13.5], [24.5, 16], [39.5, 16]], 0.85);
        dotLine(ctx, [[20, 18.5], [32, 16.8], [44, 18.5]], { spacing: 2.6, r: 0.45, seed: sd() });
      }, { name: 'food/coconut' });
      return { sprite, grip: [32, 44], holdAngle: 0 };
    },
  },

  // ---------------------------------------------------------------- durian
  {
    id: 'durian', name: 'ทุเรียน', en: 'Durian', cat: 'food',
    build() {
      const sprite = paintSprite(88, 104, (ctx, { rng }) => {
        const sd = seeder(rng);
        const cx = 44, cy = 61, rx = 37, ry = 40;
        const stem = ribbon(Q([[44, 24], [43, 12], [41, 1]]), (t) => 3.8 - t * 1.3);
        piece(ctx, stem, { color: K.wood, a: 0.85, dyeIn: 1 });
        gold(ctx, [[38.5, 3], [44, 2]], 0.9, { smoothIt: false });
        const N = 38, spikes = [];
        const R = rng;
        for (let i = 0; i < N * 2; i++) {
          const a = -Math.PI / 2 + (i / (N * 2)) * TAU;
          const wob = 1 + 0.03 * Math.sin(a * 3 + 1.2) + 0.02 * Math.sin(a * 5 + 0.3);
          const nearStem = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.2;
          const r = i % 2 === 0 && !nearStem ? 1.13 + R() * 0.05 : 0.985;
          spikes.push([cx + Math.cos(a) * rx * r * wob, cy + Math.sin(a) * ry * r * wob]);
        }
        leather(ctx, poly(spikes));
        const core = ellipsePts(cx, cy, rx - 2.5, ry - 2.5, 60);
        dye(ctx, poly(core), K.olive, 0.9);
        dye(ctx, poly(blobPts(cx - 12, cy - 12, 16, 18, { seed: 3 })), K.lime, 0.4);
        // tiny pyramids of the husk
        clipped(ctx, ellipsePts(cx, cy, rx - 4.5, ry - 4.5, 50), () => {
          const sp = 7.2;
          for (let y = cy - ry, row = 0; y < cy + ry; y += sp * 0.8, row++) {
            for (let x = cx - rx + (row % 2) * sp * 0.5; x < cx + rx; x += sp) {
              const jx = (R() - 0.5) * 1.2, jy = (R() - 0.5) * 1.2;
              line(ctx, [[x + jx - 2.4, y + jy + 1.7], [x + jx, y + jy - 2], [x + jx + 2.4, y + jy + 1.7]], INK.goldLine, 0.55, { smoothIt: false, alpha: 0.85 });
              hole(ctx, x + jx, y + jy + 0.2, 0.75);
            }
          }
        });
        // seams between the lobes
        for (const s of [-1, 1]) {
          const seam = Q([[cx + s * 3, cy - ry + 4], [cx + s * 19, cy - 10], [cx + s * 16, cy + 18], [cx + s * 3, cy + ry - 3]]);
          line(ctx, seam, INK.leather, 2.2);
          dotLine(ctx, seam, { spacing: 2.8, r: 0.6, seed: sd(), smoothIt: false });
        }
        edgeDots(ctx, core, 1.5, { sp: 3, r: 0.7, seed: sd() });
        // collar where the stalk meets the husk
        const col = C([[36, 22], [44, 19], [52, 22], [50, 26], [44, 27], [38, 26]]);
        piece(ctx, col, { color: K.wood, a: 0.8, dyeIn: 1 });
        dotLine(ctx, [[39, 23.5], [44, 22.5], [49, 23.5]], { spacing: 2.5, r: 0.5, seed: sd() });
      }, { name: 'food/durian' });
      return { sprite, grip: [44, 4], holdAngle: 0, mass: 1.3 };
    },
  },

  // ---------------------------------------------------------------- mango
  {
    id: 'mango', name: 'มะม่วง', en: 'Mango', cat: 'food',
    build() {
      const sprite = paintSprite(62, 86, (ctx, { rng }) => {
        const sd = seeder(rng);
        // leaf on the stem
        const lc = Q([[29, 10], [38, 5], [50, 3], [60, 6]]);
        const leaf = ribbon(lc, (t) => 6.4 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.75) + 0.3);
        leather(ctx, poly(leaf));
        dye(ctx, poly(side(lc, (t) => 6.4 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.75) * 0.72, -1, -0.12)), K.leaf, 0.9);
        dye(ctx, poly(side(lc, (t) => 6.4 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.75) * 0.72, 0.12, 1)), K.leafHi, 0.85);
        gold(ctx, sub(lc, 0.05, 0.92), 0.5);
        const N = normals(lc);
        for (let i = 4; i < lc.length - 3; i += 3) {
          const p = lc[i];
          for (const s of [-1, 1]) hole(ctx, p[0] + N[i][0] * s * 2.6, p[1] + N[i][1] * s * 2.6, 0.55);
        }
        const stem = ribbon(Q([[27, 17], [28, 11], [30, 8]]), 1.6);
        piece(ctx, stem, { color: K.wood, dyeIn: 0.6 });
        const B = C([[27, 15], [37, 15], [46, 22], [51, 35], [52, 49], [48, 63], [40, 74], [30, 80], [23, 83], [17, 78], [16, 71], [11, 60], [8, 45], [10, 30], [17, 19]]);
        const inner = panel(ctx, B, { color: K.banana, border: 3, seed: sd(), r: 0.95, sp: 3.5 });
        // blush on the belly and green shoulder, each bounded by a gold line
        const blush = Q([[50, 36], [40, 46], [34, 62], [26, 80]]);
        const shoulder = Q([[11, 32], [22, 26], [36, 24], [48, 28]]);
        clipped(ctx, inner, () => {
          dye(ctx, poly([...blush, [60, 90], [60, 30]]), INK.orange, 0.8);
          dye(ctx, poly([...shoulder, [60, 0], [0, 0]]), K.leafHi, 0.8);
          gold(ctx, blush, 0.7);
          gold(ctx, shoulder, 0.7);
        });
        dotLine(ctx, blush.map(([x, y]) => [x - 3, y - 1]), { spacing: 3, r: 0.6, seed: sd(), smoothIt: false });
        dotLine(ctx, shoulder.map(([x, y]) => [x, y + 3]), { spacing: 3, r: 0.6, seed: sd(), smoothIt: false });
        // glossy highlight: a crescent of slits, and punched flowers
        for (let k = 0; k < 4; k++) slit(ctx, [[17 + k * 0.4, 36 + k * 6], [18.5 + k * 0.2, 40 + k * 6]], 0.9, { smoothIt: false });
        for (const [x, y] of [[29, 42], [34, 54], [42, 64], [24, 30]]) dotFlower(ctx, x, y, 0.8, 5, 2.4);
      }, { name: 'food/mango' });
      return { sprite, grip: [30, 50], holdAngle: 0 };
    },
  },

  // ---------------------------------------------------------------- mangosteen
  {
    id: 'mangosteen', name: 'มังคุด', en: 'Mangosteen', cat: 'food',
    build() {
      const sprite = paintSprite(56, 62, (ctx, { rng }) => {
        const sd = seeder(rng);
        const stem = ribbon(Q([[28, 14], [28.5, 7], [31, 1]]), 1.9);
        piece(ctx, stem, { color: K.wood, dyeIn: 0.7 });
        const B = blobPts(28, 38, 23, 22, { seed: 11, wobble: 0.03, n: 40 });
        const inner = panel(ctx, B, { color: K.plum, border: 3, seed: sd(), r: 0.95, sp: 3.4 });
        clipped(ctx, inner, () => {
          const hl = Q([[8, 44], [12, 30], [22, 22], [34, 20]]);
          dye(ctx, poly([...hl, [0, 0], [0, 50]]), '#b8508f', 0.8);
          gold(ctx, hl, 0.6);
        });
        // zig-zag band where a carver would open the rind
        const zz = [];
        for (let k = 0; k <= 12; k++) zz.push([10 + k * 3, 43 + (k % 2 ? -3 : 2)]);
        line(ctx, zz, INK.leather, 2.4, { smoothIt: false });
        gold(ctx, zz.map(([x, y]) => [x, y - 2]), 0.5, { smoothIt: false });
        holes(ctx, zz.map(([x, y]) => [x, y]), 0.7);
        for (const [x, y] of [[28, 31], [18, 52], [38, 52], [28, 56]]) dotFlower(ctx, x, y, 0.75, 5, 2.4);
        // fleshy calyx lobes
        const lobes = [
          blobPts(16.5, 18.5, 9.5, 5, { seed: 21, rot: -0.35 }),
          blobPts(39.5, 18.5, 9.5, 5, { seed: 22, rot: 0.35 }),
          blobPts(28, 16, 7, 6, { seed: 23 }),
        ];
        for (const L of lobes) panel(ctx, L, { color: '#5d8c34', border: 1.6, r: 0, seed: sd() });
        holes(ctx, [[16.5, 18.5], [39.5, 18.5], [28, 16]], 0.9);
      }, { name: 'food/mangosteen' });
      return { sprite, grip: [28, 40], holdAngle: 0 };
    },
  },

  // ---------------------------------------------------------------- pineapple
  {
    id: 'pineapple', name: 'สับปะรด', en: 'Pineapple', cat: 'food',
    build() {
      const sprite = paintSprite(64, 122, (ctx, { rng }) => {
        const sd = seeder(rng);
        const cx = 32, cy = 86, rx = 22.5, ry = 33;
        // crown of spiky leaves
        const leaves = [
          [-160, 22, 3.2, -1], [-20, 22, 3.2, 1], [-140, 30, 3.4, -1], [-40, 30, 3.4, 1],
          [-122, 40, 3.6, -1], [-58, 40, 3.6, 1], [-104, 48, 3.6, -1], [-76, 47, 3.6, 1], [-90, 56, 3.8, 1],
        ];
        for (const [deg, L, w, s] of leaves) {
          const a = (deg * Math.PI) / 180;
          const b = [cx + Math.cos(a) * 3, 56];
          const mid = [b[0] + Math.cos(a) * L * 0.55 + s * 1.5, b[1] + Math.sin(a) * L * 0.55];
          const tip = [b[0] + Math.cos(a + s * 0.12) * L, b[1] + Math.sin(a + s * 0.12) * L];
          const c = Q([b, mid, tip], 8);
          const out = ribbon(c, (t) => w * Math.pow(1 - t, 0.85) + 0.15);
          leather(ctx, poly(out));
          dye(ctx, poly(ribbon(sub(c, 0, 0.85), (t) => (w * Math.pow(1 - t * 0.85, 0.85)) * 0.6, false)), K.leaf, 0.9);
          dye(ctx, poly(ribbon(sub(c, 0.45, 0.85), (t) => (w * Math.pow(1 - (0.45 + t * 0.4), 0.85)) * 0.5, false)), K.leafHi, 0.6);
          gold(ctx, sub(c, 0.08, 0.8), 0.45);
        }
        // scalloped body
        const B = [];
        for (let i = 0; i < 72; i++) {
          const a = (i / 72) * TAU;
          const k = 1 + 0.035 * Math.abs(Math.sin(a * 9));
          B.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
        }
        piece(ctx, B, { color: '#d98a1e', dyeIn: 1.6 });
        dye(ctx, poly(blobPts(cx - 7, cy - 6, 9, 18, { seed: 5 })), INK.yellow, 0.5);
        const inner = ellipsePts(cx, cy, rx - 1.6, ry - 1.6, 60);
        const sx = 8.4, sy = 6.6;
        clipped(ctx, inner, () => {
          for (let k = -12; k <= 12; k++) {
            for (const f of [1, -1]) {
              const pts = [];
              for (let t = -8; t <= 8; t += 0.5) pts.push([cx + sx * (k / 2 + t) * f, cy + sy * (k / 2 - t)]);
              line(ctx, pts, '#3a1f0c', 1.3, { smoothIt: false });
            }
          }
          for (let u = -12.5; u <= 12.5; u += 1) {
            for (let v = -12.5; v <= 12.5; v += 1) {
              const x = cx + (sx * (u - v)) / 2, y = cy + (sy * (u + v)) / 2;
              if (((x - cx) / (rx - 4)) ** 2 + ((y - cy) / (ry - 4)) ** 2 > 1) continue;
              line(ctx, [[x - 1.3, y + 0.9], [x, y - 1.3], [x + 1.3, y + 0.9]], INK.goldLine, 0.5, { smoothIt: false });
              hole(ctx, x, y + 0.9, 0.62);
            }
          }
        });
        edgeDots(ctx, B, 1.2, { sp: 3, r: 0.55, seed: sd() });
      }, { name: 'food/pineapple' });
      return { sprite, grip: [32, 118], holdAngle: 0, mass: 1.1 };
    },
  },

  // ---------------------------------------------------------------- pla-tu
  {
    id: 'pla-tu-basket', name: 'เข่งปลาทู', en: 'Basket of pla-tu mackerel', cat: 'food',
    build() {
      const sprite = paintSprite(96, 72, (ctx, { rng }) => {
        const sd = seeder(rng);
        // three bent-neck pla-tu, tails up, heads tucked into the basket
        fish(ctx, [[12, 10], [16, 20], [24, 30], [33, 36], [40, 44]], 1, sd);
        fish(ctx, [[84, 8], [80, 18], [72, 29], [63, 36], [57, 44]], -1, sd);
        fish(ctx, [[47, 2], [44, 14], [44, 26], [48, 36], [50, 44]], 1, sd);
        // basket
        const B = C([[7, 41], [89, 41], [86, 54], [80, 66], [72, 70], [24, 70], [16, 66], [10, 54]]);
        piece(ctx, B, { color: K.bamboo, a: 0.85, dyeIn: 1.2 });
        clipped(ctx, inset(B, 3), () => {
          for (let y = 50, row = 0; y < 68; y += 5.2, row++) {
            for (let x = 8 + (row % 2) * 3.3; x < 90; x += 6.6) {
              ctx.save();
              ctx.globalCompositeOperation = 'destination-out';
              ctx.beginPath();
              ctx.moveTo(x, y - 1.9); ctx.lineTo(x + 2.2, y); ctx.lineTo(x, y + 1.9); ctx.lineTo(x - 2.2, y);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            }
          }
        });
        const rim = C([[4, 40], [6, 37], [90, 37], [92, 40], [91, 45], [89, 46], [7, 46], [5, 45]]);
        piece(ctx, rim, { color: INK.horn, a: 0.8, dyeIn: 1 });
        dotLine(ctx, [[8, 41.5], [88, 41.5]], { spacing: 3, r: 0.65, seed: sd() });
        gold(ctx, Q([[12, 66.5], [48, 68], [84, 66.5]]), 0.7);
      }, { name: 'food/pla-tu' });
      return { sprite, grip: [48, 40], holdAngle: 0 };
    },
  },

  // ---------------------------------------------------------------- grilled chicken
  {
    id: 'kai-yang', name: 'ไก่ย่าง', en: 'Grilled chicken on a bamboo clamp', cat: 'food',
    build() {
      const sprite = paintSprite(64, 160, (ctx, { rng }) => {
        const sd = seeder(rng);
        // folded wings behind the body
        for (const s of [-1, 1]) {
          const X = (x) => 32 + s * (x - 32);
          const w = C([[X(16), 74], [X(6), 86], [X(3), 100], [X(7), 110], [X(12), 104], [X(15), 108], [X(20), 96]], 6);
          const wi = panel(ctx, w, { color: K.glaze, border: 1.8, r: 0.6, sp: 2.8, seed: sd() });
          for (let k = 0; k < 3; k++) gold(ctx, [[X(16 - k * 3), 80 + k * 3], [X(8 - k * 1.5), 96 + k * 4]], 0.5, { smoothIt: false });
          void wi;
        }
        // body: breast with the keel down the middle
        const body = C([[20, 46], [32, 42], [44, 46], [52, 58], [54, 76], [50, 94], [42, 107], [32, 113], [22, 107], [14, 94], [10, 76], [12, 58]], 6);
        const bi = panel(ctx, body, { color: K.glaze, border: 2.6, r: 0.85, sp: 3.2, seed: sd() });
        clipped(ctx, bi, () => {
          dye(ctx, poly(blobPts(25, 70, 9, 18, { seed: 3 })), K.roast, 0.75);
          dye(ctx, poly(blobPts(39, 70, 9, 18, { seed: 4 })), K.roast, 0.75);
          for (let k = 0; k < 7; k++) {
            const y = 54 + k * 9;
            line(ctx, [[8, y + 4], [56, y - 4]], K.char, 1.1, { alpha: 0.7, smoothIt: false });
          }
        });
        rib(ctx, Q([[32, 46], [32, 80], [32, 110]]), 2.2, { r: 0.6, sp: 2.8, seed: sd() });
        for (const [x, y] of [[22, 60], [42, 60], [22, 92], [42, 92]]) dotFlower(ctx, x, y, 0.75, 5, 2.3);
        // splayed legs: thigh, knee, drumstick, bone knob
        for (const s of [-1, 1]) {
          const X = (x) => 32 + s * (x - 32);
          const c = Q([[X(24), 58], [X(19), 46], [X(13), 36], [X(9), 26], [X(6), 15]], 8);
          // thigh, knee, meaty drumstick, then the thin ankle
          const hw = (t) => (t < 0.35 ? 8 - t * 6 : t < 0.62 ? 5.9 + Math.sin(((t - 0.35) / 0.27) * Math.PI) * 1.4 : t < 0.86 ? 5.9 - ((t - 0.62) / 0.24) * 3.8 : 2.1);
          const L = ribbon(c, hw);
          const li = panel(ctx, L, { color: K.glaze, border: 2, r: 0.7, sp: 3, seed: sd() });
          clipped(ctx, li, () => {
            dye(ctx, poly(blobPts(X(19), 46, 4.5, 9, { seed: 7 + s })), K.roast, 0.8);
            for (let k = 0; k < 4; k++) line(ctx, [[X(6), 30 + k * 8], [X(30), 24 + k * 8]], K.char, 1, { alpha: 0.7, smoothIt: false });
          });
          // knee crease
          const ki = Math.round(0.47 * (c.length - 1)), kn = normals(c)[ki];
          gold(ctx, [[c[ki][0] - kn[0] * 5, c[ki][1] - kn[1] * 5], [c[ki][0] + kn[0] * 5, c[ki][1] + kn[1] * 5]], 0.7, { smoothIt: false });
          const knob = blobPts(X(5.2), 11.5, 4.3, 3.3, { seed: 30 + s, rot: s * 0.9 });
          piece(ctx, knob, { color: INK.cream, a: 0.9, dyeIn: 1 });
          hole(ctx, X(5.2), 11.5, 0.8);
        }
        // bamboo clamp: split cane down the middle, two cross splints
        for (const y of [56, 98]) {
          const cb = ribbon([[1, y + 1], [63, y - 1]], 1.4);
          piece(ctx, cb, { color: K.bamboo, a: 0.9, dyeIn: 0.5 });
          for (const x of [3, 61]) line(ctx, [[x, y - 2], [x, y + 2]], K.char, 0.8, { smoothIt: false });
        }
        const cane = ribbon(Q([[32, 158], [32, 110], [32, 40], [32, 1]]), 2.3);
        piece(ctx, cane, { color: K.bamboo, a: 0.9, dyeIn: 0.7 });
        for (const y of [126, 148]) line(ctx, [[29.5, y], [34.5, y]], K.char, 1, { smoothIt: false });
        for (let k = 0; k < 4; k++) gold(ctx, [[29.2, 4 + k * 1.8], [34.8, 5 + k * 1.8]], 0.7, { smoothIt: false });
        dotLine(ctx, [[32, 116], [32, 156]], { spacing: 3.4, r: 0.6, seed: sd() });
        dotLine(ctx, [[32, 14], [32, 40]], { spacing: 3.4, r: 0.6, seed: sd() });
      }, { name: 'food/kai-yang' });
      return { sprite, grip: [32, 140], holdAngle: 0 };
    },
  },

  // ---------------------------------------------------------------- sticky rice basket
  {
    id: 'krathip', name: 'กระติ๊บข้าวเหนียว', en: 'Sticky-rice basket', cat: 'food',
    build() {
      const sprite = paintSprite(48, 84, (ctx, { rng }) => {
        const sd = seeder(rng);
        const strap = ribbon(Q([[8, 44], [5, 24], [13, 8], [24, 2], [35, 8], [43, 24], [40, 44]], 8), 1.3);
        piece(ctx, strap, { color: INK.vermilion, a: 0.8, dyeIn: 0.4 });
        const body = C([[8, 33], [40, 33], [42.5, 48], [40.5, 63], [35, 67], [13, 67], [7.5, 63], [5.5, 48]]);
        const foot = C([[13, 65], [35, 65], [39, 77], [36, 80], [12, 80], [9, 77]]);
        const lid = C([[4.5, 33], [6, 25], [13, 19.5], [24, 17.5], [35, 19.5], [42, 25], [43.5, 33]]);
        piece(ctx, foot, { color: K.bamboo, a: 0.85, dyeIn: 1 });
        piece(ctx, body, { color: K.bamboo, a: 0.88, dyeIn: 1.2 });
        piece(ctx, lid, { color: K.bamboo, a: 0.88, dyeIn: 1.1 });
        // twill weave: rows of slanted slits alternating direction
        clipped(ctx, inset(body, 2.4), () => {
          for (let y = 38, row = 0; y < 64; y += 4.6, row++) {
            for (let x = 5 + (row % 2) * 1.8; x < 44; x += 3.6) {
              const d = row % 2 ? 1 : -1;
              slit(ctx, [[x - 1.3 * d, y - 1.5], [x + 1.3 * d, y + 1.5]], 0.75, { smoothIt: false });
            }
          }
        });
        clipped(ctx, inset(lid, 2), () => {
          for (let k = -6; k <= 6; k++) slit(ctx, [[24 + k * 2.2, 22], [24 + k * 3.8, 32]], 0.6, { smoothIt: false });
        });
        clipped(ctx, inset(foot, 1.5), () => {
          for (let x = 12; x < 38; x += 3) slit(ctx, [[x, 68], [x + 1.5, 78]], 0.6, { smoothIt: false });
        });
        // lashing bands
        for (const y of [34, 50, 65]) {
          line(ctx, [[5, y], [43, y]], INK.leather, 2.6, { smoothIt: false });
          dotLine(ctx, [[6, y], [42, y]], { spacing: 2.6, r: 0.55, seed: sd(), smoothIt: false });
        }
        gold(ctx, inset(lid, 1.8).slice(4, 50), 0.5);
        const knot = blobPts(24, 17, 3.2, 2.4, { seed: 2 });
        piece(ctx, knot, { color: INK.vermilion, a: 0.9, dyeIn: 0.6 });
      }, { name: 'food/krathip' });
      return { sprite, grip: [24, 3], holdAngle: 0 };
    },
  },

  // ---------------------------------------------------------------- som tam mortar
  {
    id: 'krok-somtam', name: 'ครกส้มตำ', en: 'Som-tam mortar and pestle', cat: 'food',
    build() {
      const sprite = paintSprite(72, 100, (ctx, { rng }) => {
        const sd = seeder(rng);
        // pestle (สาก) behind the rim
        const pc = Q([[28, 58], [44, 26], [57, 3]]);
        const pestle = ribbon(pc, (t) => 3.9 - t * 1.1);
        piece(ctx, pestle, { color: K.wood, dyeIn: 1 });
        gold(ctx, side(sub(pc, 0.3, 0.95), (t) => 3.3 - t, 0.3, 0.31).slice(0, 10), 0.5);
        for (const t of [0.72, 0.78]) {
          const i = Math.round(t * (pc.length - 1)), N = normals(pc)[i];
          line(ctx, [[pc[i][0] - N[0] * 3.4, pc[i][1] - N[1] * 3.4], [pc[i][0] + N[0] * 3.4, pc[i][1] + N[1] * 3.4]], INK.goldLine, 0.8, { smoothIt: false });
        }
        // papaya shreds, chillies and a long bean poking out
        const bean = ribbon(Q([[42, 46], [50, 34], [55, 22], [52, 14], [47, 16]]), 1.5);
        piece(ctx, bean, { color: K.leaf, dyeIn: 0.5 });
        for (const [x0, x1, y1] of [[18, 12, 30], [23, 22, 27], [51, 60, 31]]) {
          const ch = ribbon(Q([[x0, 46], [(x0 + x1) / 2 + 1, (46 + y1) / 2], [x1, y1]]), (t) => 2.4 - t * 1.6);
          piece(ctx, ch, { color: K.chilli, dyeIn: 0.6 });
        }
        const shred = [];
        for (let i = 0; i <= 24; i++) {
          const x = 8 + i * 2.33;
          shred.push([x, 44 - (i % 2 ? 7 + Math.sin(i) * 2 : 2.5)]);
        }
        shred.push([62, 47], [8, 47]);
        leather(ctx, poly(shred));
        dye(ctx, poly(inset(shred, 0.6)), K.lime, 0.9);
        // mortar
        const bowl = C([[7, 50], [63, 50], [61, 62], [53, 74], [49, 80], [51, 86], [58, 93], [58, 98], [12, 98], [12, 93], [19, 86], [21, 80], [17, 74], [9, 62]], 6);
        piece(ctx, bowl, { color: K.clay, dyeIn: 1.4 });
        const rim = C([[3, 45], [5, 41.5], [65, 41.5], [67, 45], [67, 49], [65, 52], [5, 52], [3, 49]]);
        piece(ctx, rim, { color: K.clay, dyeIn: 1.1 });
        line(ctx, [[5, 46.8], [65, 46.8]], INK.leather, 1.8, { smoothIt: false });
        dotLine(ctx, [[6, 46.8], [64, 46.8]], { spacing: 2.8, r: 0.6, seed: sd(), smoothIt: false });
        gold(ctx, Q([[9, 56], [35, 57.5], [61, 56]]), 0.7);
        for (let k = 0; k < 7; k++) dotFlower(ctx, 14 + k * 7, 62 - Math.abs(k - 3) * 0.4, 0.75, 5, 2.3);
        gold(ctx, Q([[15, 69], [35, 70.5], [55, 69]]), 0.7);
        // lotus petals round the waist
        for (let k = 0; k < 5; k++) {
          const x = 23 + k * 6;
          const pet = [[x - 3, 79], [x - 3, 75], [x, 71.5], [x + 3, 75], [x + 3, 79]];
          line(ctx, pet, INK.goldLine, 0.6);
          hole(ctx, x, 76, 0.7);
        }
        line(ctx, [[20, 81], [50, 81]], INK.leather, 2.2, { smoothIt: false });
        gold(ctx, Q([[14, 94], [35, 95], [56, 94]]), 0.8);
        dotLine(ctx, Q([[19, 90], [35, 91], [51, 90]]), { spacing: 2.8, r: 0.6, seed: sd() });
        edgeDots(ctx, bowl, 2.2, { sp: 3.2, r: 0.62, seed: sd() });
      }, { name: 'food/krok' });
      return { sprite, mass: 1.4 };
    },
  },

  // ---------------------------------------------------------------- noodle bowl
  {
    id: 'noodle-bowl', name: 'ชามก๋วยเตี๋ยว', en: 'Bowl of noodles (rooster bowl)', cat: 'food',
    build() {
      const sprite = paintSprite(96, 122, (ctx, { rng }) => {
        const sd = seeder(rng);
        // steam curls rising from the soup
        // steam: swaying wisps of pale, almost clear hide that end in a curl
        const curls = [
          [[24, 60], [19, 48], [25, 36], [19, 24], [15, 15], [19, 9], [24, 12]],
          [[45, 58], [50, 46], [43, 32], [48, 18], [54, 9], [60, 12], [57, 18]],
          [[66, 58], [71, 48], [65, 38], [70, 28], [76, 24], [80, 29], [76, 32]],
        ];
        for (const cpts of curls) {
          const c = Q(cpts, 10);
          const hw = (t) => 0.9 + 2.7 * Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.9)) * (1 - t * 0.45);
          const w = ribbon(c, hw);
          leather(ctx, poly(w));
          dye(ctx, poly(ribbon(c, (t) => Math.max(0.1, hw(t) - 1.1))), INK.white, 0.85);
          dotLine(ctx, sub(c, 0.15, 0.7), { spacing: 3.6, r: 0.5, seed: sd(), smoothIt: false });
        }
        // chopsticks
        for (const [a, b] of [[[40, 64], [86, 12]], [[46, 64], [93, 20]]]) {
          const cs = ribbon([a, b], 1.25);
          piece(ctx, cs, { color: K.wood, dyeIn: 0.4 });
          const tip = lerp2(a, b, 0.86);
          line(ctx, [tip, b], INK.vermilion, 1.6, { smoothIt: false });
        }
        // noodles, meatball and greens heaped over the rim
        const heap = C([[8, 66], [12, 59], [22, 56], [34, 57.5], [46, 54], [58, 55.5], [70, 54], [82, 58], [88, 66]], 6);
        piece(ctx, heap, { color: INK.cream, a: 0.8, dyeIn: 1 });
        clipped(ctx, heap, () => {
          for (let k = 0; k < 6; k++) {
            const y = 58 + k * 1.6;
            line(ctx, Q([[6, y + 1], [26, y - 1], [46, y + 1.5], [66, y - 1], [90, y + 1]]), INK.leather, 0.6, { alpha: 0.9 });
          }
        });
        const ball = blobPts(62, 57, 5.2, 4.6, { seed: 4 });
        piece(ctx, ball, { color: K.wood, dyeIn: 0.9 });
        dotFlower(ctx, 62, 57, 0.6, 5, 2.2);
        for (const [x, y, r] of [[28, 57, 3], [34, 56, 2.6], [76, 57, 2.8]]) {
          const g = ellipsePts(x, y, r, r * 0.8, 14);
          piece(ctx, g, { color: K.leafHi, dyeIn: 0.6 });
          hole(ctx, x, y, r * 0.4);
        }
        // the bowl
        const bowl = C([[2, 64], [94, 64], [92, 71], [86, 82], [76, 92], [63, 98], [34, 98], [20, 92], [10, 82], [4, 71]], 6);
        piece(ctx, bowl, { color: K.porcelain, a: 0.92, dyeIn: 1.6 });
        const foot = C([[33, 96], [63, 96], [65, 106], [31, 106]], 3);
        piece(ctx, foot, { color: K.porcelain, a: 0.9, dyeIn: 1.2 });
        line(ctx, [[32, 102], [64, 102]], INK.blue, 1.2, { smoothIt: false });
        // dark rim band with perforations
        line(ctx, [[3, 66.5], [93, 66.5]], INK.leather, 3.2, { smoothIt: false });
        dotLine(ctx, [[5, 66.5], [91, 66.5]], { spacing: 2.8, r: 0.65, seed: sd(), smoothIt: false });
        line(ctx, Q([[6, 71], [48, 72], [90, 71]]), INK.blue, 0.9);
        // the rooster (ไก่) painted on the bowl
        ctx.save();
        ctx.translate(58, 72);
        const rooster = C([[4, 6], [8, 2], [11, 3], [12, 7], [15, 10], [22, 11], [26, 7], [25, 13], [22, 18], [15, 20], [9, 18], [6, 13], [4, 9]], 5);
        dye(ctx, poly(rooster), INK.leather, 0.95);
        dye(ctx, poly(C([[7, 2.5], [8.5, -0.5], [10, 1], [11.5, -0.2], [12, 3.5], [9, 3.5]], 3)), INK.red, 1);
        dye(ctx, poly(C([[5, 8], [3.5, 11], [6, 11]], 3)), INK.red, 1);
        dye(ctx, poly([[4.2, 5.4], [1.5, 6.8], [4.4, 7.4]]), INK.yellow, 1);
        for (const [a, b, cc] of [[[22, 11], [30, 1], [27, -2]], [[23, 13], [32, 6], [31, 2]], [[22, 15], [31, 13], [33, 9]]]) {
          line(ctx, [a, b, cc], INK.jade, 1.3);
        }
        line(ctx, [[13, 19], [12, 24]], INK.yellow, 0.8, { smoothIt: false });
        line(ctx, [[17, 19.5], [18, 24]], INK.yellow, 0.8, { smoothIt: false });
        dye(ctx, poly(C([[12, 11], [18, 12], [21, 15], [15, 16]], 3)), INK.vermilion, 0.9);
        ctx.restore();
        // banana plant and peony
        for (const [a, b, c2] of [[[20, 92], [14, 78], [22, 70]], [[22, 92], [28, 80], [36, 76]], [[21, 92], [19, 82], [9, 74]]]) {
          const lf = ribbon(Q([a, b, c2]), (t) => 2.4 * Math.sin(Math.PI * Math.min(0.98, t)) + 0.3);
          dye(ctx, poly(lf), INK.green, 0.95);
        }
        dye(ctx, poly(blobPts(42, 86, 4, 3.4, { seed: 7 })), INK.pink, 1);
        dye(ctx, poly(blobPts(42, 86, 1.8, 1.5, { seed: 8 })), INK.red, 1);
        line(ctx, Q([[42, 89], [44, 93], [48, 95]]), INK.green, 0.8);
        edgeDots(ctx, bowl, 1.2, { sp: 3, r: 0.5, seed: sd() });
      }, { name: 'food/noodle-bowl' });
      return { sprite, grip: [48, 100], holdAngle: 0 };
    },
  },

  // ---------------------------------------------------------------- watermelon
  {
    id: 'watermelon', name: 'แตงโม', en: 'Watermelon slice', cat: 'food',
    build() {
      const sprite = paintSprite(84, 52, (ctx, { rng }) => {
        const sd = seeder(rng);
        const cx = 42, cy = 7;
        const half = (rx, ry, n = 40) => {
          const pts = [];
          for (let i = 0; i <= n; i++) {
            const a = (i / n) * Math.PI;
            pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
          }
          return pts;
        };
        const top = [];
        for (let i = 1; i < 12; i++) top.push([cx - 39 + i * 6.5, cy + (i % 2 ? -0.8 : 0.4)]);
        const O = [...half(39, 43), ...top];
        leather(ctx, poly(O));
        dye(ctx, poly(inset(O, 0.8)), K.rind, 0.95);
        const pale = [...half(35, 38.5), [cx - 35, cy - 0.5], [cx + 35, cy - 0.5]].slice(0, -2);
        dye(ctx, poly(pale), K.pale, 0.9);
        const flesh = half(31.5, 35);
        dye(ctx, poly(flesh), K.flesh, 0.95);
        dye(ctx, poly(blobPts(cx, cy + 10, 22, 11, { seed: 3 })), INK.pink, 0.35);
        // rind stripes
        for (let i = 1; i < 18; i++) {
          const a = (i / 18) * Math.PI;
          const p = (r) => [cx + Math.cos(a) * 39 * r, cy + Math.sin(a) * 43 * r];
          line(ctx, [p(0.99), p(0.955)], '#173d15', 1.4, { smoothIt: false });
        }
        dotLine(ctx, half(33.3, 36.8), { spacing: 2.6, r: 0.55, seed: sd(), smoothIt: false });
        dotLine(ctx, half(37.2, 41), { spacing: 3, r: 0.55, seed: sd(), smoothIt: false });
        clipped(ctx, flesh, () => {
          dotFill(ctx, poly(flesh), [cx - 32, cy, cx + 32, cy + 35], { pattern: 'rand', spacing: 4.6, r: 0.42, seed: sd() });
        });
        // black seeds, set in a ring
        const seeds = [];
        for (let i = 0; i < 9; i++) seeds.push([0.18 + i * 0.08, 0.62]);
        for (let i = 0; i < 5; i++) seeds.push([0.3 + i * 0.1, 0.35]);
        for (const [f, rr] of seeds) {
          const a = f * Math.PI;
          const x = cx + Math.cos(a) * 31 * rr, y = cy + Math.sin(a) * 34 * rr;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(a + Math.PI / 2);
          const s = new Path2D();
          s.moveTo(0, -2.2);
          s.quadraticCurveTo(1.6, 0.4, 0, 1.6);
          s.quadraticCurveTo(-1.6, 0.4, 0, -2.2);
          dye(ctx, s, INK.leather, 1);
          ctx.restore();
          hole(ctx, x + Math.cos(a + 1.7) * 1.7, y + Math.sin(a + 1.7) * 1.7, 0.35);
        }
        gold(ctx, top.slice(1, -1), 0.6);
      }, { name: 'food/watermelon' });
      return { sprite, grip: [42, 47], holdAngle: 0 };
    },
  },

  // ---------------------------------------------------------------- meatball skewers
  {
    id: 'luk-chin-ping', name: 'ลูกชิ้นปิ้ง', en: 'Grilled meatball skewers', cat: 'food',
    build() {
      const sprite = paintSprite(52, 126, (ctx, { rng }) => {
        const sd = seeder(rng);
        const base = [26, 124];
        const tops = [[9, 5], [26, 0], [43, 6]];
        for (const t of tops) {
          const st = ribbon([t, base], 1.15);
          piece(ctx, st, { color: K.bamboo, a: 0.9, dyeIn: 0.35 });
        }
        for (const t of tops) {
          const L = Math.hypot(base[0] - t[0], base[1] - t[1]);
          const u = [(base[0] - t[0]) / L, (base[1] - t[1]) / L];
          for (let k = 0; k < 4; k++) {
            const d = 9 + k * 10.6;
            const x = t[0] + u[0] * d, y = t[1] + u[1] * d;
            const b = blobPts(x, y, 5.4, 5.1, { seed: sd(), wobble: 0.08, n: 22 });
            piece(ctx, b, { color: '#b0662a', dyeIn: 1 });
            dye(ctx, poly(blobPts(x - 1.6, y - 1.6, 2.6, 2.2, { seed: sd() })), K.roast, 0.7);
            // sweet chilli sauce
            dye(ctx, poly(C([[x - 5, y - 1.5], [x - 1, y - 3.6], [x + 5, y - 1], [x + 3, y + 1], [x - 2, y + 0.4]], 4)), INK.red, 0.85);
            line(ctx, [[x - 3.5, y + 2.6], [x + 3.5, y + 1.4]], K.char, 0.8, { smoothIt: false });
            hole(ctx, x + 1.4, y - 1.4, 0.55);
            dotLine(ctx, ellipsePts(x, y, 3.6, 3.4, 12), { spacing: 2.3, r: 0.38, closed: true, seed: sd(), smoothIt: false });
          }
        }
        for (let k = 0; k < 3; k++) gold(ctx, [[22, 104 + k * 2], [30, 104 + k * 2]], 0.7, { smoothIt: false });
      }, { name: 'food/luk-chin' });
      return { sprite, grip: [26, 112], holdAngle: 0 };
    },
  },
];
