// Weapons (อาวุธ) of the heroes, demons and clowns, cut in hide.
//
// Convention: every weapon is drawn standing UP (tip / business end toward
// -y) with the hand grip near the bottom. `grip` is where the puppet's hand
// closes (box coords), `holdAngle: 0` lets the engine aim it, and `weapon`
// marks the striking edge (blade), point (thrust) or shaft (blunt) from a
// to b in box coords.

import {
  INK, paintSprite, leather, dye, line, gold, hole, holes, dotLine, slit, cut,
  curve, poly, ellipsePts, blobPts, inset, dotFlower, prajamYam, krajangPath, krajangRow, kanokPts,
} from '../art/leather.js';

const TAU = Math.PI * 2;
const K = {
  steel: '#dfe4df', edge: '#f4f0dc', wood: '#9a5a26', horn: '#a8742e', lacquer: '#8a1a12',
  demon: '#3f8a4a', tassel: '#d0301c',
};

// ------------------------------------------------------------ helpers
const C = (pts, steps = 8) => curve(pts, true, steps);
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

function sub(c, t0, t1) {
  const n = c.length - 1;
  return c.slice(Math.round(t0 * n), Math.round(t1 * n) + 1);
}

// Join open segments (each smoothed) into one outline; corners between
// segments stay sharp, like a knife cut.
function join(...segs) {
  const out = [];
  for (const s of segs) {
    const c = s.length > 2 ? Q(s, 8) : s;
    out.push(...(out.length ? c.slice(1) : c));
  }
  return out;
}

function edgeDots(ctx, pts, d, { sp = 3.4, r = 0.7, seed = 1 } = {}) {
  dotLine(ctx, inset(pts, d), { closed: true, spacing: sp, r, seed, smoothIt: false });
}

// Hide with a black border carrying punched dots, a gold hairline where
// the dye starts and a dyed interior. Returns the inner outline.
function panel(ctx, pts, { color, a = 0.9, border = 2.4, r = 0.8, sp = 3.2, seed = 1, g = true, hide = true } = {}) {
  if (hide) leather(ctx, poly(pts));
  const inner = inset(pts, border);
  if (color) dye(ctx, poly(inner), color, a);
  if (g && color) gold(ctx, inner, 0.55, { closed: true, smoothIt: false });
  if (r) edgeDots(ctx, pts, border * 0.5, { sp, r, seed });
  return inner;
}

function clipped(ctx, pts, fn) {
  ctx.save();
  ctx.clip(poly(pts));
  fn();
  ctx.restore();
}

const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const seeder = (rng) => () => (rng() * 1e6) | 0;
const mx = (pts, ax) => pts.map(([x, y]) => [2 * ax - x, y]);

// Ring band (ปลอก) across a shaft at y, drawn as a slightly proud collar.
function collar(ctx, cx, y, hw, h, sd, { color = INK.gold, dots = true } = {}) {
  const p = [[cx - hw, y - h / 2], [cx + hw, y - h / 2], [cx + hw + 0.4, y], [cx + hw, y + h / 2], [cx - hw, y + h / 2], [cx - hw - 0.4, y]];
  leather(ctx, poly(p));
  dye(ctx, poly(inset(p, 0.6)), color, 0.95);
  if (dots) dotLine(ctx, [[cx - hw + 1, y], [cx + hw - 1, y]], { spacing: 2.2, r: 0.45, seed: sd(), smoothIt: false });
}

// A wrapped hilt: vermilion cord with slanted slits between gold bands.
function hilt(ctx, cx, y0, y1, hw, sd, { color = INK.vermilion, bands = 4, bulge = 0.4 } = {}) {
  const c = [[cx, y0], [cx, y1]];
  const H = (t) => hw + Math.sin(Math.PI * t) * bulge;
  const out = ribbon(Q([[cx, y0], [cx, (y0 + y1) / 2], [cx, y1]], 6), H, false);
  leather(ctx, poly(out));
  dye(ctx, poly(inset(out, 0.9)), color, 0.9);
  clipped(ctx, inset(out, 0.9), () => {
    for (let y = y0 + 1.5; y < y1; y += 2.6) slit(ctx, [[cx - hw, y + 1.3], [cx + hw, y - 1.3]], 0.5, { smoothIt: false });
  });
  for (let k = 0; k <= bands; k++) {
    const y = y0 + ((y1 - y0) * k) / bands;
    collar(ctx, cx, y, H(k / bands) + 0.6, 2.4, sd);
  }
  void c;
}

// ------------------------------------------------------------ props
export const PROPS = [
  // ---------------------------------------------------------------- dab
  {
    id: 'dab', name: 'ดาบ', en: 'Thai sword (daab)', cat: 'weapons',
    build() {
      const sprite = paintSprite(30, 176, (ctx, { rng }) => {
        const sd = seeder(rng);
        // single-edged blade, gently curved, edge forward (+x)
        const edge = Q([[19.5, 113], [20.2, 80], [19.6, 50], [17.4, 24], [13.8, 9], [9, 1.5]]);
        const back = Q([[9, 1.5], [9.2, 12], [8.5, 40], [9.6, 76], [11, 113]]);
        const blade = [...edge, ...back.slice(1)];
        leather(ctx, poly(blade));
        dye(ctx, poly(side(edge, 2.2, 0, -1)), K.edge, 0.95);
        gold(ctx, edge.map(([x, y]) => [x - 2.4, y]).slice(2, -4), 0.55);
        // fuller and a punched row along the spine
        slit(ctx, Q([[15, 104], [15.2, 76], [14.4, 46], [12.6, 26]]), 1, { smoothIt: true });
        dotLine(ctx, Q([[11.5, 106], [11.2, 76], [10.8, 44], [11.4, 22], [11.6, 12]]), { spacing: 3.1, r: 0.62, seed: sd() });
        for (const y of [60, 84]) dotFlower(ctx, 15.4, y, 0.6, 5, 2.2);
        // blade root: a กระจัง leaf in gold and red
        dye(ctx, krajangPath(15, 113, 9, 14), INK.gold, 0.95);
        dye(ctx, krajangPath(15, 112, 5, 8), INK.red, 0.95);
        hole(ctx, 15, 107, 0.8);
        // guard with curling ends
        const guard = C([[3, 115], [1.5, 111], [4.5, 110.5], [7.5, 113], [22.5, 113], [25.5, 110.5], [28.5, 111], [27, 115], [22.5, 118.5], [7.5, 118.5]], 5);
        panel(ctx, guard, { color: INK.gold, border: 1.2, r: 0, seed: sd() });
        dotLine(ctx, [[8, 116], [22, 116]], { spacing: 2.4, r: 0.5, seed: sd(), smoothIt: false });
        hilt(ctx, 15, 119, 162, 3.3, sd, { bands: 4 });
        // lotus-bud pommel
        const pom = C([[10.5, 162], [19.5, 162], [20.5, 166], [17.5, 171], [15, 175], [12.5, 171], [9.5, 166]], 5);
        panel(ctx, pom, { color: INK.gold, border: 1.2, r: 0, seed: sd() });
        hole(ctx, 15, 167, 0.9);
      }, { name: 'weapons/dab' });
      return { sprite, grip: [15, 142], holdAngle: 0, weapon: { kind: 'blade', a: [20, 108], b: [10, 3] } };
    },
  },

  // ---------------------------------------------------------------- dab-kap
  {
    id: 'dab-kap', name: 'ดาบสองมือ', en: 'Long-hilted sword', cat: 'weapons',
    build() {
      const sprite = paintSprite(38, 204, (ctx, { rng }) => {
        const sd = seeder(rng);
        const edge = Q([[25.5, 122], [26.4, 84], [25.6, 46], [23.4, 20], [20, 6], [17, 0.5]]);
        const back = Q([[17, 0.5], [13.2, 8], [11.2, 28], [11, 70], [12.4, 122]]);
        const blade = [...edge, ...back.slice(1)];
        leather(ctx, poly(blade));
        const inner = inset(blade, 2.6);
        dye(ctx, poly(inner), K.lacquer, 0.9);
        gold(ctx, inner, 0.55, { closed: true, smoothIt: false });
        dye(ctx, poly(side(edge, 1.9, 0, -1)), K.edge, 0.95);
        edgeDots(ctx, blade, 1.3, { sp: 3, r: 0.6, seed: sd() });
        // twin fullers with a chain of ดอกจัน between
        slit(ctx, Q([[16.2, 112], [15.6, 70], [15.6, 36], [16.6, 22]]), 0.9);
        slit(ctx, Q([[21.6, 112], [21.8, 70], [21, 36], [19.6, 20]]), 0.9);
        for (let y = 34; y < 108; y += 9) dotFlower(ctx, 18.8, y, 0.62, 5, 2.1);
        prajamYam(ctx, 18.8, 115, 5, { color: INK.red, petal: INK.gold });
        // wide guard with flame ends curling toward the hand
        const gL = kanokPts(9, 127, 9, Math.PI * 0.62, true);
        const gR = kanokPts(29, 127, 9, Math.PI * 0.38, false);
        for (const g of [gL, gR]) {
          leather(ctx, poly(g));
          dye(ctx, poly(inset(g, 0.9)), INK.gold, 0.95);
        }
        const bar = C([[4, 124], [34, 124], [35, 128], [30, 131], [8, 131], [3, 128]], 4);
        panel(ctx, bar, { color: INK.gold, border: 1.1, r: 0, seed: sd() });
        dotLine(ctx, [[7, 127.5], [31, 127.5]], { spacing: 2.4, r: 0.55, seed: sd(), smoothIt: false });
        hilt(ctx, 19, 131, 190, 3.5, sd, { bands: 6, color: INK.indigo });
        const pom = C([[13, 190], [25, 190], [27.5, 195], [23, 199], [19, 203], [15, 199], [10.5, 195]], 5);
        panel(ctx, pom, { color: INK.gold, border: 1.2, r: 0, seed: sd() });
        holes(ctx, [[19, 196], [15.5, 194], [22.5, 194]], 0.7);
      }, { name: 'weapons/dab-kap' });
      return { sprite, grip: [19, 172], holdAngle: 0, weapon: { kind: 'blade', a: [26, 118], b: [17.5, 2] } };
    },
  },

  // ---------------------------------------------------------------- ngao
  {
    id: 'ngao', name: 'ง้าว', en: 'Glaive (ngao)', cat: 'weapons',
    build() {
      const sprite = paintSprite(50, 300, (ctx, { rng }) => {
        const sd = seeder(rng);
        const cx = 25;
        // pole with a pointed butt cap
        const pole = ribbon([[cx, 116], [cx, 290]], 2.5, false);
        leather(ctx, poly(pole));
        dye(ctx, poly(inset(pole, 0.7)), K.wood, 0.85);
        dotLine(ctx, [[cx, 130], [cx, 284]], { spacing: 3.4, r: 0.55, seed: sd(), smoothIt: false });
        for (const y of [170, 196, 250]) collar(ctx, cx, y, 3.3, 2.6, sd);
        const butt = [[cx - 3, 288], [cx + 3, 288], [cx + 2, 294], [cx, 300], [cx - 2, 294]];
        leather(ctx, poly(butt));
        dye(ctx, poly(inset(butt, 0.7)), INK.gold, 0.95);
        // red horsehair tassel under the socket
        const tas = C([[cx - 5.5, 100], [cx + 5.5, 100], [cx + 10.5, 113], [cx + 9.5, 124], [cx + 4.5, 121], [cx, 126], [cx - 4.5, 121], [cx - 9.5, 124], [cx - 10.5, 113]], 5);
        leather(ctx, poly(tas));
        dye(ctx, poly(inset(tas, 1)), K.tassel, 0.92);
        for (let k = -4; k <= 4; k++) slit(ctx, [[cx + k * 1.1, 104], [cx + k * 2.3, 121]], 0.55, { smoothIt: false });
        // big crescent blade, edge forward, tip sweeping back, a flame
        // hook (กนก) springing from its back
        const edgeSeg = [[cx - 2.5, 0], [cx + 7.5, 6], [cx + 14.5, 18], [cx + 17.5, 34], [cx + 16.5, 52], [cx + 11.5, 70], [cx + 4.5, 86]];
        const blade = join(
          [[cx - 5, 86], [cx - 5.6, 74], [cx - 6.6, 62]],
          [[cx - 6.6, 62], [cx - 11, 60], [cx - 17, 55], [cx - 21.5, 46], [cx - 21, 37]],
          [[cx - 21, 37], [cx - 17.6, 43.5], [cx - 12.6, 47.5], [cx - 7.6, 48.6]],
          [[cx - 7.6, 48.6], [cx - 6.4, 36], [cx - 5.4, 22], [cx - 4.6, 10], [cx - 2.5, 0]],
          edgeSeg,
          [[cx + 4.5, 86], [cx - 5, 86]],
        );
        leather(ctx, poly(blade));
        const bi = inset(blade, 2.6);
        dye(ctx, poly(bi), K.lacquer, 0.85);
        gold(ctx, bi, 0.6, { closed: true, smoothIt: false });
        dye(ctx, poly(side(Q(edgeSeg), 2.5, 0, 1)), K.edge, 0.95);
        edgeDots(ctx, blade, 1.3, { sp: 3, r: 0.65, seed: sd() });
        // painted flame and ดอกจัน inside the blade
        const flame = kanokPts(cx + 2, 80, 62, -Math.PI / 2 - 0.06, true);
        dye(ctx, poly(flame), INK.gold, 0.95);
        dye(ctx, poly(inset(flame, 2.6)), INK.vermilion, 0.9);
        dotLine(ctx, inset(flame, 1.3), { closed: true, spacing: 2.7, r: 0.55, seed: sd(), smoothIt: false });
        for (const [x, y] of [[cx + 3, 64], [cx + 4, 46], [cx + 3, 30], [cx + 1, 16]]) dotFlower(ctx, x, y, 0.7, 5, 2.3);
        const hook = kanokPts(cx - 10, 56, 17, -Math.PI * 0.72, false);
        dye(ctx, poly(inset(hook, 2.2)), INK.gold, 0.9);
        // socket: ring, lotus bulb, ring
        const bulb = C([[cx - 6.5, 89], [cx + 6.5, 89], [cx + 8.5, 94], [cx + 6, 100], [cx - 6, 100], [cx - 8.5, 94]], 5);
        panel(ctx, bulb, { color: INK.gold, border: 1.2, r: 0, seed: sd() });
        dye(ctx, poly(C([[cx - 3, 91], [cx + 3, 91], [cx + 4.5, 94.5], [cx + 2.5, 98], [cx - 2.5, 98], [cx - 4.5, 94.5]], 4)), INK.red, 0.9);
        hole(ctx, cx, 94.5, 0.9);
        collar(ctx, cx, 87.5, 7.2, 2.8, sd);
        collar(ctx, cx, 101.5, 5, 2.6, sd);
      }, { name: 'weapons/ngao' });
      return { sprite, grip: [25, 214], holdAngle: 0, weapon: { kind: 'blade', a: [36, 70], b: [30, 6] } };
    },
  },

  // ---------------------------------------------------------------- hok
  {
    id: 'hok', name: 'หอก', en: 'Spear (hok)', cat: 'weapons',
    build() {
      const sprite = paintSprite(28, 264, (ctx, { rng }) => {
        const sd = seeder(rng);
        const shaft = ribbon([[14, 84], [14, 256]], 2, false);
        leather(ctx, poly(shaft));
        dye(ctx, poly(inset(shaft, 0.6)), K.wood, 0.85);
        dotLine(ctx, [[14, 100], [14, 250]], { spacing: 3.4, r: 0.5, seed: sd(), smoothIt: false });
        for (const y of [140, 190, 240]) collar(ctx, 14, y, 2.8, 2.4, sd);
        const butt = [[11.5, 255], [16.5, 255], [15.5, 260], [14, 264], [12.5, 260]];
        leather(ctx, poly(butt));
        dye(ctx, poly(inset(butt, 0.6)), INK.gold, 0.95);
        // tassel (พู่)
        const tas = C([[9, 62], [19, 62], [22.5, 72], [23.5, 84], [19, 89], [14, 86], [9, 89], [4.5, 84], [5.5, 72]], 5);
        leather(ctx, poly(tas));
        dye(ctx, poly(inset(tas, 1)), K.tassel, 0.92);
        for (let k = -4; k <= 4; k++) slit(ctx, [[14 + k * 1, 65], [14 + k * 2.1, 85]], 0.5, { smoothIt: false });
        // leaf-shaped head with a gold midrib
        const R = Q([[14, 0], [18.4, 10], [21, 22], [21, 34], [18.4, 44], [16.2, 52]]);
        const head = [...R, ...mx(R, 14).reverse().slice(0, -1)];
        leather(ctx, poly(head));
        const hi = inset(head, 2.2);
        dye(ctx, poly(hi), K.lacquer, 0.85);
        gold(ctx, hi, 0.55, { closed: true, smoothIt: false });
        dye(ctx, poly(side(R, 1.8, 0, -1)), K.edge, 0.9);
        dye(ctx, poly(side(mx(R, 14), 1.8, 0, 1)), K.edge, 0.9);
        line(ctx, [[14, 4], [14, 50]], INK.leather, 2.2, { smoothIt: false });
        gold(ctx, [[14, 5], [14, 49]], 0.6, { smoothIt: false });
        dotLine(ctx, Q([[11.8, 14], [10.6, 28], [11.6, 42]]), { spacing: 2.8, r: 0.55, seed: sd() });
        dotLine(ctx, Q([[16.2, 14], [17.4, 28], [16.4, 42]]), { spacing: 2.8, r: 0.55, seed: sd() });
        // socket with lotus collar
        const sock = C([[11, 51], [17, 51], [18.5, 56], [17, 62], [11, 62], [9.5, 56]], 4);
        panel(ctx, sock, { color: INK.gold, border: 1, r: 0, seed: sd() });
        hole(ctx, 14, 56.5, 0.8);
        collar(ctx, 14, 62.5, 4.4, 2.2, sd);
      }, { name: 'weapons/hok' });
      return { sprite, grip: [14, 196], holdAngle: 0, weapon: { kind: 'point', a: [14, 44], b: [14, 0] } };
    },
  },

  // ---------------------------------------------------------------- kris
  {
    id: 'kris', name: 'กริช', en: 'Kris (wavy dagger)', cat: 'weapons',
    build() {
      const sprite = paintSprite(34, 92, (ctx, { rng }) => {
        const sd = seeder(rng);
        // wavy blade: seven luk
        const c = [];
        for (let i = 0; i <= 60; i++) {
          const u = i / 60;
          c.push([16 + Math.sin(u * 3.5 * TAU) * 2.3 * (1 - u * 0.55), 58 - u * 58]);
        }
        const hw = (t) => 4.3 * Math.pow(1 - t, 0.55) + 0.25;
        const blade = ribbon(c, hw, false);
        leather(ctx, poly(blade));
        dye(ctx, poly(ribbon(sub(c, 0.02, 0.92), (t) => hw(0.02 + t * 0.9) * 0.62, false)), K.lacquer, 0.8);
        gold(ctx, sub(c, 0.02, 0.94), 0.6);
        // pamor: faint wavy gold grain
        for (const o of [-0.4, 0.4]) gold(ctx, side(sub(c, 0.05, 0.85), hw, o, o + 0.01).slice(0, 52), 0.35, { alpha: 0.8 });
        dotLine(ctx, side(sub(c, 0.04, 0.8), hw, 0.72, 0.73).slice(0, 49), { spacing: 2.6, r: 0.45, seed: sd(), smoothIt: false });
        dotLine(ctx, side(sub(c, 0.04, 0.8), hw, -0.72, -0.71).slice(0, 49), { spacing: 2.6, r: 0.45, seed: sd(), smoothIt: false });
        // ganja (guard) with the elephant-trunk hook in front
        const ganja = join(
          [[5.5, 63], [5, 60], [8, 57.2], [16, 56.6]],
          [[16, 56.6], [22, 56], [24.5, 52.5], [26.5, 53.5], [25.5, 57], [28, 59.5], [27, 63]],
          [[27, 63], [5.5, 63]],
        );
        panel(ctx, ganja, { color: INK.gold, border: 1.1, r: 0, seed: sd() });
        dotLine(ctx, [[8, 60.5], [25, 60.5]], { spacing: 2.2, r: 0.5, seed: sd(), smoothIt: false });
        collar(ctx, 16, 64.5, 4, 2.4, sd);
        // tajong hilt (Pattani style): a slim grip bowing forward into a
        // hooked bird's beak
        const hc = Q([[16, 66], [15.2, 72], [15.6, 78], [17.4, 83], [20.6, 86.4]], 8);
        const hilt = ribbon(hc, (t) => 3.1 + Math.sin(t * Math.PI) * 0.7 - t * 0.5, true);
        leather(ctx, poly(hilt));
        const beak = C([[19.5, 83.2], [24, 83.6], [28, 85.8], [30.2, 89.4], [28.6, 92.6], [27.2, 90], [24.4, 88.6], [20.4, 89]], 4);
        leather(ctx, poly(beak));
        dye(ctx, poly(inset(hilt, 0.9)), INK.horn, 0.9);
        dye(ctx, poly(inset(beak, 0.8)), INK.gold, 0.9);
        gold(ctx, Q([[13.6, 70], [13.4, 77], [15.4, 82], [18.6, 85.6]]), 0.5);
        for (let k = 0; k < 4; k++) slit(ctx, [[14.2, 69 + k * 3], [17.6, 68 + k * 3]], 0.5, { smoothIt: false });
        hole(ctx, 22.4, 85.8, 0.9);
        slit(ctx, [[24.5, 87.6], [28.2, 88.6]], 0.5, { smoothIt: false });
      }, { name: 'weapons/kris' });
      return { sprite, grip: [15.5, 74], holdAngle: 0, weapon: { kind: 'point', a: [16, 50], b: [16, 0] } };
    },
  },

  // ---------------------------------------------------------------- knife
  {
    id: 'knife', name: 'มีดพร้า', en: 'Machete (meed prah)', cat: 'weapons',
    build() {
      const sprite = paintSprite(30, 100, (ctx, { rng }) => {
        const sd = seeder(rng);
        // narrow at the heel, broad at the front, squared off with a
        // hooked beak (ปลายงุ้ม) on the edge side
        const edgeSeg = [[23.4, 9.4], [22.2, 18], [20.4, 32], [18.8, 46], [17.6, 60]];
        const blade = join(
          [[11.6, 60], [11, 44], [10, 28], [8.8, 12], [8.4, 5]],
          [[8.4, 5], [15, 2.2], [21, 1.2]],
          [[21, 1.2], [25, 2.4], [26.8, 6], [25.6, 10.5], [23.4, 9.4]],
          edgeSeg,
          [[17.6, 60], [11.6, 60]],
        );
        leather(ctx, poly(blade));
        const E = Q(edgeSeg);
        dye(ctx, poly(side(E, 2.8, 0, -1)), K.edge, 0.95);
        dye(ctx, poly(C([[20, 2.6], [24.6, 3.4], [26, 6.4], [25, 9.2], [22.6, 8], [19.6, 5.4]], 3)), K.edge, 0.95);
        gold(ctx, E.map(([x, y]) => [x - 3.1, y]).slice(1, -2), 0.55);
        gold(ctx, [[10.4, 7.4], [15.4, 5.2], [20.2, 4.6]], 0.5, { smoothIt: false });
        dotLine(ctx, Q([[12.8, 56], [12.3, 42], [11.4, 26], [10.8, 11]]), { spacing: 2.9, r: 0.62, seed: sd() });
        dotFlower(ctx, 15.8, 18, 0.72, 5, 2.3);
        dotFlower(ctx, 15.4, 32, 0.62, 5, 2.1);
        dye(ctx, krajangPath(14.6, 60, 6, 9), INK.gold, 0.95);
        hole(ctx, 14.6, 56.4, 0.6);
        // ferrule and wooden handle
        const fer = C([[10, 59.5], [19.2, 59.5], [19.6, 66], [9.6, 66]], 3);
        panel(ctx, fer, { color: INK.gold, border: 0.9, r: 0, seed: sd() });
        dotLine(ctx, [[11.4, 62.8], [18, 62.8]], { spacing: 2.2, r: 0.5, seed: sd(), smoothIt: false });
        const hc = Q([[14.8, 66], [14.4, 81], [15.2, 96]], 6);
        const handle = ribbon(hc, (t) => 3.4 + Math.sin(t * Math.PI) * 0.6 + (t > 0.9 ? 0.6 : 0), true);
        leather(ctx, poly(handle));
        dye(ctx, poly(inset(handle, 1)), K.wood, 0.9);
        for (let y = 70; y < 94; y += 4.4) gold(ctx, [[11.6, y], [18, y - 0.8]], 0.5, { smoothIt: false });
        hole(ctx, 15, 94, 0.9);
      }, { name: 'weapons/knife' });
      return { sprite, grip: [14.8, 80], holdAngle: 0, weapon: { kind: 'blade', a: [18, 57], b: [25.5, 8] } };
    },
  },

  // ---------------------------------------------------------------- bow
  {
    id: 'bow', name: 'ธนู', en: 'Thai recurved bow', cat: 'weapons',
    build() {
      const sprite = paintSprite(54, 184, (ctx, { rng }) => {
        const sd = seeder(rng);
        const cy = 92;
        // string (drawn first, behind the stave)
        leather(ctx, poly(ribbon([[24, 13], [24, cy], [24, 171]], 0.6, false)));
        // stave: grip farthest from the string, limbs back, tips recurving
        const upper = Q([[40, cy], [38, 70], [32, 42], [26.5, 20], [25.6, 12], [28.5, 6]], 10);
        const lower = mxy(upper, cy);
        const stave = [...lower.slice().reverse(), ...upper.slice(1)];
        const hw = (t) => {
          const d = Math.abs(t - 0.5) * 2;
          return d < 0.12 ? 3.4 : 3.4 - (d - 0.12) * 2.2;
        };
        const out = ribbon(stave, hw, true);
        leather(ctx, poly(out));
        gold(ctx, sub(stave, 0.06, 0.94), 0.6);
        dotLine(ctx, side(sub(stave, 0.08, 0.42), hw, 0.55, 0.56).slice(0, 40), { spacing: 3, r: 0.55, seed: sd(), smoothIt: false });
        dotLine(ctx, side(sub(stave, 0.58, 0.92), hw, 0.55, 0.56).slice(0, 40), { spacing: 3, r: 0.55, seed: sd(), smoothIt: false });
        // wrapped grip
        const g = ribbon([[40, cy - 11], [40, cy + 11]], 4.2, false);
        leather(ctx, poly(g));
        dye(ctx, poly(inset(g, 0.9)), INK.vermilion, 0.9);
        for (let y = cy - 9; y < cy + 10; y += 2.4) slit(ctx, [[37, y + 1], [43, y - 1]], 0.5, { smoothIt: false });
        for (const y of [cy - 11.5, cy + 11.5]) collar(ctx, 40, y, 4.4, 2.4, sd);
        // ornate กนก tips (nāga-flame finials)
        for (const [tip, ang, flip] of [[[28.5, 6], -Math.PI * 0.2, false], [[28.5, 2 * cy - 6], Math.PI * 0.2, true]]) {
          const k = kanokPts(tip[0] - 2, tip[1], 13, ang, flip);
          leather(ctx, poly(k));
          dye(ctx, poly(inset(k, 1)), INK.gold, 0.95);
          dye(ctx, poly(inset(k, 2.6)), INK.red, 0.9);
          hole(ctx, tip[0] + 1.4, tip[1] + (flip ? 2 : -2), 0.7);
        }
        for (const y of [cy - 45, cy + 45]) dotFlower(ctx, y < cy ? 33 : 33, y, 0.6, 5, 2.1);
      }, { name: 'weapons/bow' });
      return { sprite, grip: [40, 92], holdAngle: 0, weapon: { kind: 'blunt', a: [30, 32], b: [30, 152] } };
    },
  },

  // ---------------------------------------------------------------- arrow
  {
    id: 'arrow', name: 'ศร', en: 'Arrow (sorn)', cat: 'weapons',
    build() {
      const sprite = paintSprite(20, 152, (ctx, { rng }) => {
        const sd = seeder(rng);
        const shaft = ribbon([[10, 26], [10, 150]], 1.15, false);
        leather(ctx, poly(shaft));
        dye(ctx, poly(inset(shaft, 0.4)), INK.horn, 0.85);
        // fletching: two vanes
        for (const s of [-1, 1]) {
          const X = (x) => 10 + s * (x - 10);
          const vane = C([[X(10.8), 118], [X(15), 124], [X(18.5), 140], [X(17), 146], [X(11), 141]], 5);
          leather(ctx, poly(vane));
          dye(ctx, poly(inset(vane, 0.9)), s < 0 ? INK.red : INK.gold, 0.9);
          for (let k = 0; k < 5; k++) slit(ctx, [[X(11.4), 124 + k * 4], [X(16.5), 128 + k * 4]], 0.5, { smoothIt: false });
        }
        const nock = [[8.2, 146], [11.8, 146], [12.4, 151], [10.8, 152], [10, 149.5], [9.2, 152], [7.6, 151]];
        leather(ctx, poly(nock));
        dye(ctx, poly(inset(nock, 0.5)), INK.gold, 0.9);
        dotLine(ctx, [[10, 40], [10, 112]], { spacing: 3.6, r: 0.45, seed: sd(), smoothIt: false });
        // barbed flame-leaf head
        const R = [[10, 0], [13.2, 6.5], [15.4, 13], [17.8, 20.5], [16.4, 24.5], [13.6, 20.5], [12, 22], [11.4, 27]];
        const head = [...R, ...mx(R, 10).reverse()];
        leather(ctx, poly(head));
        dye(ctx, poly(inset(head, 1.1)), INK.gold, 0.95);
        dye(ctx, poly(C([[10, 5], [12, 11], [12.2, 17], [10, 20], [7.8, 17], [8, 11]], 4)), INK.red, 0.9);
        hole(ctx, 10, 14, 0.8);
        for (const y of [28, 31]) collar(ctx, 10, y, 2, 1.8, sd, { dots: false });
      }, { name: 'weapons/arrow' });
      return { sprite, grip: [10, 128], holdAngle: 0, weapon: { kind: 'point', a: [10, 20], b: [10, 0] } };
    },
  },

  // ---------------------------------------------------------------- shield
  {
    id: 'shield', name: 'โล่', en: 'Round shield', cat: 'weapons',
    build() {
      const sprite = paintSprite(78, 78, (ctx, { rng }) => {
        const sd = seeder(rng);
        const cx = 39, cy = 39, R = 38;
        const O = [];
        for (let i = 0; i < 96; i++) {
          const a = (i / 96) * TAU;
          O.push([cx + Math.cos(a) * R * (0.975 + 0.025 * Math.abs(Math.cos(a * 12))), cy + Math.sin(a) * R * (0.975 + 0.025 * Math.abs(Math.cos(a * 12)))]);
        }
        leather(ctx, poly(O));
        const ring = (r) => ellipsePts(cx, cy, r, r, 72);
        dotLine(ctx, ring(35.4), { closed: true, spacing: 3.2, r: 0.85, seed: sd(), smoothIt: false });
        dye(ctx, poly(ring(33)), INK.crimson, 0.9);
        gold(ctx, ring(33), 0.7, { closed: true, smoothIt: false });
        krajangRow(ctx, [...ring(23.5), ring(23.5)[0]], 7.2, { color: INK.gold, inner: INK.vermilion });
        dye(ctx, poly(ring(22.6)), '#2f7040', 0.92);
        gold(ctx, ring(22.6), 0.7, { closed: true, smoothIt: false });
        dotLine(ctx, ring(21), { closed: true, spacing: 2.8, r: 0.6, seed: sd(), smoothIt: false });
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU + Math.PI / 8;
          dotFlower(ctx, cx + Math.cos(a) * 16.5, cy + Math.sin(a) * 16.5, 0.8, 5, 2.4);
        }
        // boss
        leather(ctx, poly(ring(11.5)));
        dye(ctx, poly(ring(10.6)), INK.gold, 0.95);
        dotLine(ctx, ring(9.2), { closed: true, spacing: 2.4, r: 0.5, seed: sd(), smoothIt: false });
        prajamYam(ctx, cx, cy, 7.5, { color: INK.red, petal: INK.vermilion });
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * TAU;
          const x = cx + Math.cos(a) * 29, y = cy + Math.sin(a) * 29;
          ctx.fillStyle = INK.leather;
          ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fill();
          dye(ctx, poly(ellipsePts(x, y, 1.7, 1.7, 12)), INK.goldLine, 1);
          hole(ctx, x, y, 0.6);
        }
      }, { name: 'weapons/shield' });
      return { sprite, grip: [39, 39], holdAngle: 0, weapon: { kind: 'blunt', a: [39, 2], b: [39, 76] } };
    },
  },

  // ---------------------------------------------------------------- gada
  {
    id: 'gada', name: 'กระบอง', en: "Demon's club (krabong)", cat: 'weapons',
    build() {
      const sprite = paintSprite(44, 166, (ctx, { rng }) => {
        const sd = seeder(rng);
        const cx = 22;
        // profile: finial, spiked bulb head, flaring shaft, handle
        const prof = (y) => {
          if (y < 12) return 0.6 + (y / 12) * 4;
          if (y < 44) return 5.5 + Math.sin(((y - 12) / 32) * Math.PI) * 8.5;
          if (y < 114) return 9 - ((y - 44) / 70) * 5.2;
          return 3.6;
        };
        const Rt = [];
        for (let y = 0; y <= 150; y += 2) Rt.push([cx + prof(y), y]);
        // spikes on the bulb
        const withSpikes = [];
        for (const p of Rt) {
          withSpikes.push(p);
          for (const sy of [20, 30, 40]) if (Math.abs(p[1] - sy) < 1) withSpikes.push([p[0] + 4.2, sy + 1], [p[0], sy + 2.2]);
        }
        const body = [...withSpikes, ...mx(withSpikes, cx).reverse()];
        leather(ctx, poly(body));
        const bi = inset(body, 1.6);
        clipped(ctx, bi, () => {
          dye(ctx, poly([[0, 12], [44, 12], [44, 46], [0, 46]]), INK.red, 0.9);
          dye(ctx, poly([[0, 46], [44, 46], [44, 112], [0, 112]]), K.demon, 0.9);
          dye(ctx, poly([[0, 0], [44, 0], [44, 12], [0, 12]]), INK.gold, 0.95);
          // fluting on the head
          for (const o of [-6, -2, 2, 6]) gold(ctx, Q([[cx + o * 0.5, 14], [cx + o * 1.25, 29], [cx + o * 0.7, 44]]), 0.55);
          for (const o of [-4, 0, 4]) dotLine(ctx, Q([[cx + o * 0.5, 16], [cx + o * 1.25, 29], [cx + o * 0.7, 42]]), { spacing: 2.6, r: 0.55, seed: sd(), smoothIt: false });
          // diamond lattice on the shaft
          for (let k = -12; k < 12; k++) {
            gold(ctx, [[cx - 12, 48 + k * 7], [cx + 12, 72 + k * 7]], 0.5, { smoothIt: false });
            gold(ctx, [[cx + 12, 48 + k * 7], [cx - 12, 72 + k * 7]], 0.5, { smoothIt: false });
          }
        });
        for (let y = 55; y < 110; y += 7) hole(ctx, cx, y + 3.5, 0.7);
        edgeDots(ctx, body.filter(([, y]) => y > 46 && y < 112), 0.2, { sp: 99, r: 0 });
        // proud gold rings
        for (const y of [12, 46, 66, 88, 112]) collar(ctx, cx, y, prof(y) + 1, 3, sd);
        hilt(ctx, cx, 114, 150, 3.4, sd, { bands: 3, color: INK.vermilion, bulge: 0.2 });
        const pom = C([[cx - 5, 150], [cx + 5, 150], [cx + 6.5, 155], [cx + 3, 161], [cx, 165], [cx - 3, 161], [cx - 6.5, 155]], 4);
        panel(ctx, pom, { color: INK.gold, border: 1.1, r: 0, seed: sd() });
        hole(ctx, cx, 156, 0.9);
        hole(ctx, cx, 5, 0.6);
      }, { name: 'weapons/gada' });
      return { sprite, grip: [22, 134], holdAngle: 0, weapon: { kind: 'blunt', a: [22, 72], b: [22, 6] }, mass: 1.6 };
    },
  },

  // ---------------------------------------------------------------- staff
  {
    id: 'staff', name: 'ไม้พลอง', en: 'Fighting staff (plong)', cat: 'weapons',
    build() {
      const sprite = paintSprite(14, 214, (ctx, { rng }) => {
        const sd = seeder(rng);
        const c = Q([[7, 1], [7.3, 107], [7, 213]], 8);
        const hw = (t) => 2.7 + Math.sin(t * Math.PI) * 0.4;
        const pole = ribbon(c, hw, true);
        leather(ctx, poly(pole));
        const pi = inset(pole, 0.8);
        dye(ctx, poly(pi), K.wood, 0.9);
        clipped(ctx, pi, () => {
          for (let y = 22; y < 190; y += 9) {
            line(ctx, [[2, y + 3], [12, y - 3]], INK.goldLine, 0.9, { smoothIt: false });
            line(ctx, [[2, y + 7.5], [12, y + 1.5]], INK.leather, 1.6, { smoothIt: false });
          }
        });
        dotLine(ctx, [[7.1, 24], [7.1, 190]], { spacing: 4.5, r: 0.5, seed: sd(), smoothIt: false });
        for (const [y0, y1] of [[4, 20], [194, 210]]) {
          const w = ribbon([[7, y0], [7, y1]], 3.4, false);
          leather(ctx, poly(w));
          dye(ctx, poly(inset(w, 0.7)), INK.vermilion, 0.9);
          for (let y = y0 + 1.5; y < y1; y += 2.4) slit(ctx, [[4, y + 1], [10, y - 1]], 0.45, { smoothIt: false });
          collar(ctx, 7, y0, 3.6, 2.2, sd, { dots: false });
          collar(ctx, 7, y1, 3.6, 2.2, sd, { dots: false });
        }
        for (const y of [1.5, 212.5]) {
          ctx.fillStyle = INK.leather;
          ctx.beginPath(); ctx.arc(7, y, 2.8, 0, TAU); ctx.fill();
          dye(ctx, poly(ellipsePts(7, y, 2, 1.8, 12)), INK.gold, 0.95);
        }
      }, { name: 'weapons/staff' });
      return { sprite, grip: [7, 142], holdAngle: 0, weapon: { kind: 'blunt', a: [7, 2], b: [7, 212] } };
    },
  },

  // ---------------------------------------------------------------- trident
  {
    id: 'trident', name: 'ตรีศูล', en: 'Trident (trisula)', cat: 'weapons',
    build() {
      const sprite = paintSprite(46, 234, (ctx, { rng }) => {
        const sd = seeder(rng);
        const cx = 23;
        const shaft = ribbon([[cx, 76], [cx, 226]], 2.2, false);
        leather(ctx, poly(shaft));
        dye(ctx, poly(inset(shaft, 0.6)), K.wood, 0.85);
        dotLine(ctx, [[cx, 96], [cx, 222]], { spacing: 3.4, r: 0.5, seed: sd(), smoothIt: false });
        for (const y of [130, 176, 222]) collar(ctx, cx, y, 3, 2.4, sd);
        const butt = C([[cx - 3.5, 224], [cx + 3.5, 224], [cx + 4, 229], [cx, 234], [cx - 4, 229]], 3);
        panel(ctx, butt, { color: INK.gold, border: 0.8, r: 0, seed: sd() });
        // side prongs: flame-curved, hooking outward at the tips
        for (const s of [-1, 1]) {
          const X = (x) => cx + s * (x - cx);
          const pc = Q([[X(19), 58], [X(11), 52], [X(6.4), 42], [X(6), 30], [X(7.4), 20], [X(6.6), 12], [X(3.6), 8]], 8);
          const pr = ribbon(pc, (t) => 3.3 * (1 - t) + 0.35, true);
          leather(ctx, poly(pr));
          dye(ctx, poly(ribbon(sub(pc, 0.05, 0.8), (t) => (3.3 * (1 - (0.05 + t * 0.75)) + 0.35) * 0.5, false)), INK.gold, 0.95);
          dotLine(ctx, sub(pc, 0.1, 0.6), { spacing: 2.8, r: 0.45, seed: sd(), smoothIt: false });
          const barb = kanokPts(X(9), 40, 8, s < 0 ? -Math.PI * 0.2 : -Math.PI * 0.8, s > 0);
          leather(ctx, poly(barb));
          dye(ctx, poly(inset(barb, 0.8)), INK.vermilion, 0.9);
        }
        // central leaf blade
        const R = Q([[cx, 0], [cx + 3, 8], [cx + 4.8, 20], [cx + 4.2, 36], [cx + 2.6, 52]]);
        const head = [...R, ...mx(R, cx).reverse().slice(0, -1)];
        leather(ctx, poly(head));
        const hi = inset(head, 1.6);
        dye(ctx, poly(hi), INK.gold, 0.95);
        line(ctx, [[cx, 6], [cx, 50]], INK.leather, 1.8, { smoothIt: false });
        dotLine(ctx, [[cx, 8], [cx, 48]], { spacing: 2.6, r: 0.5, seed: sd(), smoothIt: false });
        // crescent cup and lotus collar
        const cres = join([[5, 55], [14, 58.5], [cx, 59.5], [32, 58.5], [41, 55]], [[41, 55], [37.5, 62.5], [cx, 66], [8.5, 62.5], [5, 55]]);
        panel(ctx, cres, { color: INK.gold, border: 1.1, r: 0, seed: sd() });
        dotLine(ctx, Q([[10, 60.5], [cx, 62.6], [36, 60.5]]), { spacing: 2.4, r: 0.55, seed: sd() });
        const bulb = C([[cx - 5, 66], [cx + 5, 66], [cx + 7, 71], [cx + 4, 77], [cx - 4, 77], [cx - 7, 71]], 4);
        panel(ctx, bulb, { color: INK.gold, border: 1.1, r: 0, seed: sd() });
        dye(ctx, poly(C([[cx - 2.6, 68], [cx + 2.6, 68], [cx + 4, 71.5], [cx + 2, 75], [cx - 2, 75], [cx - 4, 71.5]], 3)), INK.red, 0.9);
        hole(ctx, cx, 71.5, 0.8);
      }, { name: 'weapons/trident' });
      return { sprite, grip: [23, 176], holdAngle: 0, weapon: { kind: 'point', a: [23, 36], b: [23, 0] } };
    },
  },

  // ---------------------------------------------------------------- chakra
  {
    id: 'chakra', name: 'จักร', en: 'Discus (chakra)', cat: 'weapons',
    build() {
      const sprite = paintSprite(70, 90, (ctx, { rng }) => {
        const sd = seeder(rng);
        const cx = 35, cy = 34;
        // short handle below
        const h = ribbon([[cx, 56], [cx, 82]], 2.6, false);
        leather(ctx, poly(h));
        dye(ctx, poly(inset(h, 0.7)), INK.vermilion, 0.9);
        for (const y of [64, 72, 80]) collar(ctx, cx, y, 3.2, 2.2, sd, { dots: false });
        const knob = blobPts(cx, 85, 4, 3.4, { seed: 5 });
        panel(ctx, knob, { color: INK.gold, border: 0.9, r: 0, seed: sd() });
        // flame teeth all round, all curling the same way (spinning)
        const flames = [];
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * TAU;
          flames.push(kanokPts(cx + Math.cos(a) * 21, cy + Math.sin(a) * 21, 13, a, false));
        }
        for (const f of flames) leather(ctx, poly(f));
        const ring = (r) => ellipsePts(cx, cy, r, r, 60);
        leather(ctx, poly(ring(25)));
        for (const f of flames) {
          dye(ctx, poly(inset(f, 0.9)), INK.vermilion, 0.9);
          gold(ctx, inset(f, 0.9), 0.45, { closed: true, smoothIt: false });
        }
        dye(ctx, poly(ring(24)), INK.gold, 0.95);
        dye(ctx, poly(ring(20.5)), INK.leather, 1);
        dotLine(ctx, ring(22.3), { closed: true, spacing: 2.6, r: 0.62, seed: sd(), smoothIt: false });
        // spokes: openwork windows between eight spokes
        for (let k = 0; k < 8; k++) {
          const a0 = (k / 8) * TAU + 0.2, a1 = ((k + 1) / 8) * TAU - 0.2;
          const w = [];
          for (let i = 0; i <= 6; i++) { const a = a0 + ((a1 - a0) * i) / 6; w.push([cx + Math.cos(a) * 18.5, cy + Math.sin(a) * 18.5]); }
          for (let i = 6; i >= 0; i--) { const a = a0 + 0.1 + ((a1 - a0 - 0.2) * i) / 6; w.push([cx + Math.cos(a) * 10, cy + Math.sin(a) * 10]); }
          cut(ctx, poly(w));
          const sa = (k / 8) * TAU;
          gold(ctx, [[cx + Math.cos(sa) * 10, cy + Math.sin(sa) * 10], [cx + Math.cos(sa) * 19, cy + Math.sin(sa) * 19]], 0.7, { smoothIt: false });
        }
        dye(ctx, poly(ring(8.8)), INK.gold, 0.95);
        prajamYam(ctx, cx, cy, 6.4, { color: INK.red, petal: INK.vermilion });
      }, { name: 'weapons/chakra' });
      return { sprite, grip: [35, 74], holdAngle: 0, weapon: { kind: 'blade', a: [2, 34], b: [68, 34] } };
    },
  },
];

// mirror a polyline vertically about y = ay
function mxy(pts, ay) {
  return pts.map(([x, y]) => [x, 2 * ay - y]);
}
