// Market scenery and street-vending gear, cut in hide.

import {
  INK, paintSprite, leather, dye, line, gold, hole, holes, dotLine, dotFill, slit, cut,
  curve, poly, ellipsePts, blobPts, inset, dotFlower, prajamYam, krajangPath, krajangRow, kanokPts, lotusRow, plaid, band,
} from '../art/leather.js';

const TAU = Math.PI * 2;

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

function piece(ctx, pts, { color, a = 0.9, dyeIn = 1.2 } = {}) {
  leather(ctx, poly(pts));
  if (color) dye(ctx, poly(inset(pts, dyeIn)), color, a);
  return pts;
}

// ------------------------------------------------------------ props
// striped awning with a scalloped valance
function awning(ctx, x0, x1, y0, y1, sd, cols = [INK.vermilion, INK.cream]) {
  const n = Math.round((x1 - x0) / 12);
  const val = [];
  for (let i = 0; i <= n * 2; i++) { const x = x0 + ((x1 - x0) * i) / (n * 2); val.push([x, y1 + (i % 2 ? 7 : 0)]); }
  const A = [[x0 + 10, y0], [x1 - 10, y0], ...Q(val.slice().reverse(), 4).reverse().reverse()];
  const shape = [[x0 + 10, y0], [x1 - 10, y0], [x1, y1], ...Q(val, 4).reverse(), [x0, y1]];
  leather(ctx, poly(shape));
  clipped(ctx, inset(shape, 1.6), () => {
    for (let i = 0; i < n; i++) {
      const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n;
      dye(ctx, poly([[xa + (x0 + (x1 - x0) / 2 - xa) * 0.08, y0], [xb + (x0 + (x1 - x0) / 2 - xb) * 0.08, y0], [xb, y1 + 8], [xa, y1 + 8]]), cols[i % 2], 0.9);
    }
  });
  dotLine(ctx, [[x0 + 2, y1 + 1], [x1 - 2, y1 + 1]], { spacing: 3.2, r: 0.8, seed: sd(), smoothIt: false });
  gold(ctx, [[x0 + 10, y0 + 2], [x1 - 10, y0 + 2]], 0.8, { smoothIt: false });
  for (let i = 1; i < n * 2; i += 2) dotFlower(ctx, x0 + ((x1 - x0) * i) / (n * 2), y1 + 3.6, 0.6, 5, 2);
  void A;
}
function fruitPile(ctx, cx, base, sd, color = INK.orange) {
  for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) {
    const x = cx - (2 - r) * 6 + k * 12, y = base - 5 - r * 9;
    const b = blobPts(x, y, 6, 5.4, { seed: sd() });
    leather(ctx, poly(b)); dye(ctx, poly(inset(b, 1.1)), color, 0.9); hole(ctx, x - 1.5, y - 1.5, 0.7);
  }
}
function wheel(ctx, x, y, R, sd) {
  leather(ctx, poly(ellipsePts(x, y, R, R, 40)));
  cut(ctx, poly(ellipsePts(x, y, R - 3, R - 3, 40)));
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI; leather(ctx, poly(ribbon([[x - Math.cos(a) * (R - 2), y - Math.sin(a) * (R - 2)], [x + Math.cos(a) * (R - 2), y + Math.sin(a) * (R - 2)]], 0.9, false))); }
  piece(ctx, ellipsePts(x, y, 3.4, 3.4, 12), { color: INK.gold, dyeIn: 0.8 });
  dotLine(ctx, ellipsePts(x, y, R - 1.5, R - 1.5, 40), { closed: true, spacing: 3, r: 0.6, seed: sd(), smoothIt: false });
}

export const PROPS = [
  // ---------------------------------------------------------------- stall
  {
    id: 'phaeng-loi', name: 'แผงลอย', en: 'Market stall', cat: 'market',
    build() {
      const sprite = paintSprite(300, 260, (ctx, { rng }) => {
        const sd = seeder(rng);
        for (const x of [16, 284]) piece(ctx, ribbon([[x, 30], [x, 258]], 2.6, false), { color: '#9a5a26', dyeIn: 0.8 });
        // table legs and cloth skirt
        for (const x of [30, 270]) piece(ctx, ribbon([[x, 170], [x, 258]], 3, false), { color: '#9a5a26', dyeIn: 0.8 });
        const skirt = C([[20, 168], [280, 168], [278, 222], [22, 222]], 2);
        leather(ctx, poly(skirt));
        plaid(ctx, poly(inset(skirt, 2)), [20, 168, 280, 222], { a: INK.red, b: INK.indigo, size: 12, seed: sd() });
        dotLine(ctx, inset(skirt, 1), { closed: true, spacing: 3.4, r: 0.8, seed: sd(), smoothIt: false });
        const top = C([[12, 160], [288, 160], [288, 170], [12, 170]], 2);
        piece(ctx, top, { color: '#9a5a26' });
        dotLine(ctx, [[16, 165], [284, 165]], { spacing: 3.4, r: 0.8, seed: sd(), smoothIt: false });
        // goods: fruit piles, a bunch of bananas, a basket, a jar
        fruitPile(ctx, 60, 160, sd, INK.orange);
        fruitPile(ctx, 130, 160, sd, '#5f8f3a');
        fruitPile(ctx, 240, 160, sd, INK.red);
        const bk = C([[160, 160], [200, 160], [206, 138], [154, 138]], 2);
        const bi = panel(ctx, bk, { color: '#c99c48', border: 1.6, r: 0.6, seed: sd() });
        clipped(ctx, bi, () => { for (let x = 154; x < 206; x += 4) slit(ctx, [[x, 140], [x + 3, 158]], 0.6, { smoothIt: false }); });
        for (let k = 0; k < 6; k++) { const c = Q([[180, 138], [168 + k * 5, 124], [166 + k * 5.4, 116]]); piece(ctx, ribbon(c, 1.4), { color: INK.red, dyeIn: 0.4 }); }
        // hanging bananas
        piece(ctx, ribbon([[96, 44], [96, 70]], 1, false));
        for (let t = 0; t < 3; t++) for (let k = 0; k < 5; k++) {
          const c = Q([[96, 70 + t * 12], [90 + k * 3, 64 + t * 12], [86 + k * 4, 56 + t * 12]]);
          const b = ribbon(c, 2.2); leather(ctx, poly(b)); dye(ctx, poly(ribbon(c, 1.1)), INK.yellow, 0.9);
        }
        // awning and gable crest
        awning(ctx, 4, 296, 24, 44, sd);
        krajangRow(ctx, [[40, 24], [260, 24]], 10, { color: INK.gold, inner: INK.red });
      }, { name: 'mk/stall' });
      return { sprite, static: true };
    },
  },

  // ---------------------------------------------------------------- umbrella stall
  {
    id: 'rom-mae-kha', name: 'ร่มแม่ค้า', en: 'Big-umbrella vendor stall', cat: 'market',
    build() {
      const sprite = paintSprite(230, 250, (ctx, { rng }) => {
        const sd = seeder(rng);
        piece(ctx, ribbon([[115, 10], [115, 248]], 2.4, false), { color: '#9a5a26', dyeIn: 0.7 });
        const can = [];
        for (let i = 0; i <= 16; i++) { const x = 4 + i * 13.9; can.push([x, 78 + (i % 2 ? 0 : 8)]); }
        const dome = Q([[4, 86], [30, 44], [70, 18], [115, 10], [160, 18], [200, 44], [226, 86]]);
        const canopy = [...dome, ...can.slice().reverse().slice(1, -1)];
        leather(ctx, poly(canopy));
        const ci = inset(canopy, 2.6);
        clipped(ctx, ci, () => {
          const cols = [INK.vermilion, INK.yellow, INK.jade, INK.blue];
          for (let k = 0; k < 8; k++) dye(ctx, poly([[115, 8], [4 + k * 27.8, 90], [4 + (k + 1) * 27.8, 90]]), cols[k % 4], 0.9);
          for (let k = 0; k <= 8; k++) line(ctx, [[115, 8], [4 + k * 27.8, 90]], INK.leather, 1.8, { smoothIt: false });
        });
        edgeDots(ctx, canopy, 1.3, { sp: 3.2, r: 0.8, seed: sd() });
        piece(ctx, ellipsePts(115, 8, 5, 4, 14), { color: INK.gold });
        // table with a glass cabinet of goods
        for (const x of [60, 170]) piece(ctx, ribbon([[x, 180], [x, 248]], 2.6, false), { color: '#9a5a26', dyeIn: 0.7 });
        const tbl = C([[40, 172], [190, 172], [190, 184], [40, 184]], 2);
        piece(ctx, tbl, { color: INK.crimson });
        dotLine(ctx, [[44, 178], [186, 178]], { spacing: 3.2, r: 0.7, seed: sd(), smoothIt: false });
        const cab = C([[60, 128], [170, 128], [170, 172], [60, 172]], 2);
        leather(ctx, poly(cab));
        cut(ctx, poly(C([[64, 132], [166, 132], [166, 168], [64, 168]], 2)));
        for (let k = 0; k < 6; k++) { const x = 72 + k * 17; piece(ctx, blobPts(x, 160, 6, 6, { seed: sd() }), { color: k % 2 ? INK.orange : INK.yellow }); }
        for (const x of [98, 132]) leather(ctx, poly(ribbon([[x, 130], [x, 170]], 0.8, false)));
        const stool = [[190, 220], [214, 220], [212, 226], [208, 248], [205, 248], [202, 226], [196, 248], [193, 248]];
        piece(ctx, stool, { color: INK.blue });
      }, { name: 'mk/umbrella' });
      return { sprite, static: true };
    },
  },

  // ---------------------------------------------------------------- haap
  {
    id: 'haap-re', name: 'หาบเร่', en: 'Carrying pole with two baskets', cat: 'market',
    build() {
      const sprite = paintSprite(200, 112, (ctx, { rng }) => {
        const sd = seeder(rng);
        const pole = Q([[2, 6], [100, 12], [198, 6]]);
        piece(ctx, ribbon(pole, 2.4, true), { color: '#c99c48', dyeIn: 0.7 });
        for (const x of [20, 180]) {
          for (const dx of [-14, 0, 14]) leather(ctx, poly(ribbon([[x, 9], [x + dx, 62]], 0.6, false)));
          const b = C([[x - 20, 60], [x + 20, 60], [x + 16, 100], [x + 10, 108], [x - 10, 108], [x - 16, 100]], 4);
          const bi = panel(ctx, b, { color: '#c99c48', border: 2, seed: sd(), r: 0.7 });
          clipped(ctx, bi, () => { for (let y = 66, r = 0; y < 108; y += 5, r++) for (let xx = x - 20 + (r % 2) * 2.5; xx < x + 20; xx += 5) slit(ctx, [[xx, y], [xx + 2.4, y + 2.4]], 0.7, { smoothIt: false }); });
          piece(ctx, C([[x - 22, 58], [x + 22, 58], [x + 22, 64], [x - 22, 64]], 2), { color: INK.brown });
          for (let k = 0; k < 3; k++) piece(ctx, blobPts(x - 10 + k * 10, 55, 6, 5, { seed: sd() }), { color: x < 100 ? INK.orange : '#5f8f3a' });
        }
        collar(ctx, 100, 12, 3.6, 8, sd, { color: INK.vermilion });
      }, { name: 'mk/haap' });
      return { sprite, grip: [100, 12], holdAngle: 0, mass: 1.2 };
    },
  },

  // ---------------------------------------------------------------- noodle cart
  {
    id: 'rot-khen-kuaytiao', name: 'รถเข็นก๋วยเตี๋ยว', en: 'Noodle cart', cat: 'market',
    build() {
      const sprite = paintSprite(240, 190, (ctx, { rng }) => {
        const sd = seeder(rng);
        // handle bar
        piece(ctx, ribbon([[200, 120], [238, 104]], 2, true), { color: '#9a5a26', dyeIn: 0.5 });
        // glass cabinet with hanging noodles
        const cab = C([[20, 40], [150, 40], [150, 92], [20, 92]], 2);
        leather(ctx, poly(cab));
        cut(ctx, poly(C([[25, 46], [145, 46], [145, 88], [25, 88]], 2)));
        leather(ctx, poly(ribbon([[25, 52], [145, 52]], 0.8, false)));
        for (let k = 0; k < 8; k++) { const x = 34 + k * 14; const n = C([[x - 4, 52], [x + 4, 52], [x + 5, 72], [x, 76], [x - 5, 72]], 3); piece(ctx, n, { color: k % 3 ? INK.cream : INK.red, a: 0.85, dyeIn: 0.8 }); }
        const roof = C([[10, 30], [160, 30], [160, 40], [10, 40]], 2);
        piece(ctx, roof, { color: INK.crimson });
        krajangRow(ctx, [[16, 30], [154, 30]], 7, { color: INK.gold, inner: INK.red });
        // cooking pot with steam
        const pot = C([[160, 56], [204, 56], [202, 92], [162, 92]], 2);
        piece(ctx, pot, { color: '#b8b8a8', a: 0.8 });
        gold(ctx, [[162, 64], [202, 64]], 0.8, { smoothIt: false });
        for (const x of [170, 186]) {
          const c = Q([[x, 56], [x - 5, 44], [x + 3, 32], [x - 2, 20], [x + 4, 14]]);
          leather(ctx, poly(ribbon(c, (t) => 0.9 + 2.2 * Math.sin(Math.PI * Math.min(1, 0.1 + t)))));
          dye(ctx, poly(ribbon(c, (t) => Math.max(0.1, 2.2 * Math.sin(Math.PI * Math.min(1, 0.1 + t)) - 0.4))), INK.white, 0.85);
        }
        // body with the cut-out sign ก๋วยเตี๋ยว
        const body = C([[10, 92], [210, 92], [210, 140], [10, 140]], 2);
        const bi = panel(ctx, body, { color: INK.vermilion, border: 2.6, seed: sd() });
        clipped(ctx, bi, () => {
          ctx.save();
          ctx.font = 'bold 26px Loma, "Noto Sans Thai", "Leelawadee UI", Thonburi, Tahoma, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.globalCompositeOperation = 'source-atop';
          ctx.strokeStyle = INK.leather; ctx.lineWidth = 5; ctx.strokeText('ก๋วยเตี๋ยว', 105, 118, 180);
          ctx.globalCompositeOperation = 'destination-out'; ctx.fillText('ก๋วยเตี๋ยว', 105, 118, 180);
          ctx.restore();
        });
        wheel(ctx, 50, 158, 28, sd);
        wheel(ctx, 175, 158, 28, sd);
      }, { name: 'mk/cart' });
      return { sprite, mass: 2.5 };
    },
  },

  // ---------------------------------------------------------------- scale
  {
    id: 'tachang-jin', name: 'ตาชั่งจีน', en: 'Chinese steelyard scale', cat: 'market',
    build() {
      const sprite = paintSprite(150, 110, (ctx, { rng }) => {
        const sd = seeder(rng);
        leather(ctx, poly(ribbon(Q([[30, 14], [26, 6], [30, 1], [34, 6], [30, 14]]), 1, false)));
        const beam = ribbon([[8, 16], [148, 18]], (t) => 2.8 - t * 1.2, true);
        piece(ctx, beam, { color: INK.horn, dyeIn: 0.7 });
        for (let x = 40; x < 144; x += 5) hole(ctx, x, 17 + (x - 8) / 70, 0.6);
        // pan on three strings
        for (const dx of [-18, 0, 18]) leather(ctx, poly(ribbon([[12, 18], [12 + dx, 84]], 0.5, false)));
        const pan = C([[-8, 84], [32, 84], [26, 92], [-2, 92]], 3).map(([x, y]) => [x + 2, y]);
        piece(ctx, pan, { color: INK.gold });
        for (let k = 0; k < 3; k++) piece(ctx, blobPts(4 + k * 9, 79, 5, 4.4, { seed: sd() }), { color: INK.orange });
        // sliding weight on its cord
        leather(ctx, poly(ribbon([[118, 18], [118, 62]], 0.5, false)));
        const w = C([[110, 62], [126, 62], [128, 80], [118, 88], [108, 80]], 4);
        const wi = panel(ctx, w, { color: INK.gold, border: 1.4, r: 0.55, seed: sd() });
        void wi; hole(ctx, 118, 72, 1.2);
      }, { name: 'mk/scale' });
      return { sprite, grip: [30, 2], holdAngle: 0 };
    },
  },

  // ---------------------------------------------------------------- tray
  {
    id: 'krachat', name: 'กระจาด', en: 'Flat tray of goods', cat: 'market',
    build() {
      const sprite = paintSprite(110, 52, (ctx, { rng }) => {
        const sd = seeder(rng);
        for (let k = 0; k < 9; k++) piece(ctx, blobPts(20 + k * 9, 26 - Math.sin((k / 8) * Math.PI) * 10, 6, 5, { seed: sd() }), { color: [INK.red, '#6aa63a', INK.yellow][k % 3] });
        for (let k = 0; k < 5; k++) piece(ctx, ribbon(Q([[30 + k * 12, 26], [34 + k * 12, 14], [30 + k * 12, 8]]), 1.6), { color: INK.red, dyeIn: 0.5 });
        const t = C([[2, 30], [108, 30], [100, 46], [90, 50], [20, 50], [10, 46]], 3);
        const ti = panel(ctx, t, { color: '#c99c48', border: 2, seed: sd() });
        clipped(ctx, ti, () => { for (let x = 4; x < 108; x += 4) slit(ctx, [[x, 33], [x - 3, 48]], 0.6, { smoothIt: false }); });
        piece(ctx, C([[0, 28], [110, 28], [110, 34], [0, 34]], 2), { color: INK.brown });
      }, { name: 'mk/tray' });
      return { sprite, grip: [55, 48], holdAngle: 0 };
    },
  },

  // ---------------------------------------------------------------- sign
  {
    id: 'pai-raan', name: 'ป้ายร้าน', en: 'Shop sign “ของดี ราคาถูก”', cat: 'market',
    build() {
      const sprite = paintSprite(190, 130, (ctx, { rng }) => {
        const sd = seeder(rng);
        for (const x of [20, 170]) piece(ctx, ribbon([[x, 60], [x, 128]], 3, false), { color: '#9a5a26', dyeIn: 0.8 });
        const board = C([[4, 26], [186, 26], [186, 90], [4, 90]], 2);
        leather(ctx, poly(board));
        band(ctx, inset(board, 3), 3, { color: INK.vermilion, closed: true, seed: sd() });
        gold(ctx, inset(board, 6.5), 0.7, { closed: true, smoothIt: false });
        // gable crest
        const crest = join([[20, 26], [95, 2], [170, 26]], [[170, 26], [20, 26]]);
        const ci = panel(ctx, crest, { color: INK.crimson, border: 2, seed: sd() });
        clipped(ctx, ci, () => prajamYam(ctx, 95, 16, 7, { color: INK.red, petal: INK.gold }));
        for (const s of [-1, 1]) { const k = kanokPts(95 + s * 78, 26, 14, -Math.PI / 2 - s * 0.6, s > 0); piece(ctx, k, { color: INK.gold }); }
        // lettering cut out of the hide so the lamp shines through
        ctx.save();
        ctx.font = 'bold 27px Loma, "Noto Sans Thai", "Leelawadee UI", Thonburi, Tahoma, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalCompositeOperation = 'source-atop';
        ctx.strokeStyle = INK.goldLine; ctx.lineWidth = 1.6;
        ctx.strokeText('ของดี ราคาถูก', 95, 58, 160);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillText('ของดี ราคาถูก', 95, 58, 160);
        ctx.restore();
      }, { name: 'mk/sign' });
      return { sprite, mass: 1.2 };
    },
  },

  // ---------------------------------------------------------------- kheng
  {
    id: 'kheng', name: 'เข่ง', en: 'Bamboo crate (kheng)', cat: 'market',
    build() {
      const sprite = paintSprite(84, 76, (ctx, { rng }) => {
        const sd = seeder(rng);
        for (let k = 0; k < 4; k++) piece(ctx, blobPts(20 + k * 14, 12, 8, 7, { seed: sd() }), { color: '#6aa63a' });
        const b = C([[2, 10], [82, 10], [70, 66], [60, 74], [24, 74], [14, 66]], 4);
        leather(ctx, poly(b));
        dye(ctx, poly(inset(b, 1)), '#c99c48', 0.85);
        clipped(ctx, inset(b, 3), () => {
          for (let y = 18, r = 0; y < 74; y += 7, r++) for (let x = 2 + (r % 2) * 4; x < 84; x += 8) cut(ctx, poly([[x, y - 2.8], [x + 3, y], [x, y + 2.8], [x - 3, y]]));
        });
        piece(ctx, C([[0, 8], [84, 8], [84, 14], [0, 14]], 2), { color: INK.brown });
        dotLine(ctx, [[3, 11], [81, 11]], { spacing: 3, r: 0.6, seed: sd(), smoothIt: false });
      }, { name: 'mk/kheng' });
      return { sprite, mass: 1.1 };
    },
  },
];
