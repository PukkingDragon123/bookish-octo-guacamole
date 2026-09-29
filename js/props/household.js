// Household things of a Thai village home, cut in hide. Lamps carry a
// `glow`; small things carried in the hand have a `grip`.

import {
  INK, paintSprite, leather, dye, line, gold, hole, holes, dotLine, dotFill, slit, cut,
  curve, poly, ellipsePts, blobPts, inset, dotFlower, prajamYam, krajangPath, krajangRow, kanokPts, lotusRow,
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
const jar = (cx, top, w, h) => C([[cx - w * 0.2, top], [cx + w * 0.2, top], [cx + w * 0.22, top + h * 0.08], [cx + w * 0.46, top + h * 0.3], [cx + w * 0.5, top + h * 0.5], [cx + w * 0.4, top + h * 0.78], [cx + w * 0.26, top + h], [cx - w * 0.26, top + h], [cx - w * 0.4, top + h * 0.78], [cx - w * 0.5, top + h * 0.5], [cx - w * 0.46, top + h * 0.3], [cx - w * 0.22, top + h * 0.08]], 8);

export const PROPS = [
  // ---------------------------------------------------------------- ong mangkon
  {
    id: 'ong-mangkon', name: 'โอ่งมังกร', en: 'Dragon water jar (Ratchaburi)', cat: 'household',
    build() {
      const sprite = paintSprite(104, 112, (ctx, { rng }) => {
        const sd = seeder(rng);
        const J = jar(52, 2, 96, 110);
        const ji = panel(ctx, J, { color: INK.brown, border: 3, seed: sd(), r: 0.9 });
        clipped(ctx, ji, () => {
          // the coiling dragon in relief, scaled body snaking round the jar
          const d = Q([[8, 80], [26, 92], [48, 84], [60, 64], [78, 52], [96, 60], [90, 80], [70, 90]], 10);
          const hw = (t) => 5.5 * Math.sin(Math.PI * Math.min(0.97, 0.08 + t * 0.92)) + 0.6;
          const body = ribbon(d, hw);
          dye(ctx, poly(body), INK.gold, 0.95);
          dotFill(ctx, poly(body), [0, 40, 104, 100], { pattern: 'scales', spacing: 3.2, r: 0.6, seed: sd() });
          line(ctx, side(d, hw, 1, 1.01).slice(0, d.length), INK.leather, 0.9);
          for (const t of [0.3, 0.55, 0.8]) {
            const i = Math.round(t * (d.length - 1)), p = d[i];
            for (let k = -1; k <= 1; k++) line(ctx, [[p[0], p[1] + 4], [p[0] + k * 3, p[1] + 9]], INK.goldLine, 1, { smoothIt: false });
          }
          // clouds
          for (const [x, y] of [[26, 44], [70, 34], [40, 64]]) { gold(ctx, [[x - 6, y], [x - 3, y - 3], [x, y], [x + 3, y - 3], [x + 6, y]], 0.8); hole(ctx, x, y + 2, 0.8); }
        });
        // dragon head breaking the silhouette, with horns and whiskers
        const head = C([[4, 76], [10, 66], [20, 64], [24, 70], [18, 78], [8, 82]], 5);
        panel(ctx, head, { color: INK.gold, border: 1.4, r: 0, seed: sd() });
        for (const k of [kanokPts(14, 66, 10, -Math.PI * 0.75, false), kanokPts(19, 65, 9, -Math.PI * 0.55, true)]) { leather(ctx, poly(k)); dye(ctx, poly(inset(k, 0.8)), INK.vermilion, 0.9); }
        hole(ctx, 13, 71, 1.2);
        leather(ctx, poly(ribbon(Q([[5, 78], [0, 84], [2, 90]]), 0.8, true)));
        // rim
        const rim = C([[28, 0], [76, 0], [78, 6], [26, 6]], 2);
        piece(ctx, rim, { color: INK.gold, dyeIn: 1 });
        dotLine(ctx, [[30, 3], [74, 3]], { spacing: 2.8, r: 0.6, seed: sd(), smoothIt: false });
        krajangRow(ctx, Q([[24, 22], [52, 16], [80, 22]]), 6, { color: INK.gold, inner: INK.red });
      }, { name: 'hh/ong-mangkon' });
      return { sprite, mass: 2 };
    },
  },

  // ---------------------------------------------------------------- ong din
  {
    id: 'ong-din', name: 'โอ่งดิน', en: 'Earthen water jar with dipper', cat: 'household',
    build() {
      const sprite = paintSprite(96, 106, (ctx, { rng }) => {
        const sd = seeder(rng);
        const J = jar(48, 10, 88, 96);
        const ji = panel(ctx, J, { color: '#b4532a', border: 3, seed: sd(), r: 0.9 });
        clipped(ctx, ji, () => {
          for (const y of [34, 70]) { line(ctx, [[0, y], [96, y]], INK.leather, 2.4, { smoothIt: false }); dotLine(ctx, [[0, y], [96, y]], { spacing: 3, r: 0.6, seed: sd(), smoothIt: false }); }
          const w = []; for (let x = 4; x < 94; x += 2) w.push([x, 52 + Math.sin(x * 0.35) * 3]);
          gold(ctx, w, 0.8, { smoothIt: false });
        });
        // wooden lid and coconut-shell dipper
        piece(ctx, C([[20, 6], [76, 6], [78, 12], [18, 12]], 2), { color: '#9a5a26', dyeIn: 1 });
        const dip = C([[38, 0], [52, -1], [54, 6], [36, 6]], 3);
        leather(ctx, poly(ribbon([[52, 2], [80, -4]], 1.3, true)));
        piece(ctx, dip, { color: INK.brown, dyeIn: 0.8 });
      }, { name: 'hh/ong-din' });
      return { sprite, mass: 1.8 };
    },
  },

  // ---------------------------------------------------------------- lantern
  {
    id: 'takiang-jaophayu', name: 'ตะเกียงเจ้าพายุ', en: 'Pressure lantern', cat: 'household',
    build() {
      const sprite = paintSprite(50, 104, (ctx, { rng }) => {
        const sd = seeder(rng);
        leather(ctx, poly(ribbon(Q([[16, 18], [14, 6], [25, 0], [36, 6], [34, 18]]), 1.4, true)));
        const hood = C([[8, 26], [18, 16], [32, 16], [42, 26], [38, 30], [12, 30]], 4);
        panel(ctx, hood, { color: INK.gold, border: 1.6, r: 0.6, seed: sd() });
        // glass globe: open window with the glowing mantle and cage bars
        const glass = C([[12, 30], [38, 30], [40, 44], [38, 58], [12, 58], [10, 44]], 4);
        leather(ctx, poly(glass));
        cut(ctx, poly(inset(glass, 1.6)));
        for (const x of [17, 25, 33]) leather(ctx, poly(ribbon([[x, 30], [x, 58]], 0.7, false)));
        piece(ctx, blobPts(25, 44, 5, 7, { seed: 2 }), { color: INK.cream, a: 0.95, dyeIn: 0.8 });
        // fuel tank with pump and gauge
        const tank = C([[12, 58], [38, 58], [46, 74], [42, 92], [8, 92], [4, 74]], 5);
        const ti = panel(ctx, tank, { color: INK.gold, border: 2.2, seed: sd() });
        clipped(ctx, ti, () => lotusRow(ctx, [[6, 90], [44, 90]], 6, { color: INK.red }));
        piece(ctx, ellipsePts(25, 74, 5, 5, 20), { color: INK.cream, dyeIn: 1 });
        line(ctx, [[25, 74], [28, 71]], INK.leather, 0.8, { smoothIt: false });
        piece(ctx, ribbon([[44, 72], [49, 68]], 1.6, true), { color: INK.gold, dyeIn: 0.4 });
        piece(ctx, C([[10, 92], [40, 92], [42, 102], [8, 102]], 2), { color: INK.brown, dyeIn: 0.9 });
      }, { name: 'hh/lantern' });
      return { sprite, grip: [25, 1], holdAngle: 0, glow: [25, 44, 150] };
    },
  },

  // ---------------------------------------------------------------- oil lamp
  {
    id: 'takiang-namman', name: 'ตะเกียงน้ำมัน', en: 'Kerosene oil lamp', cat: 'household',
    build() {
      const sprite = paintSprite(40, 92, (ctx, { rng }) => {
        const sd = seeder(rng);
        const chim = C([[14, 2], [26, 2], [25, 14], [31, 26], [31, 36], [26, 44], [14, 44], [9, 36], [9, 26], [15, 14]], 5);
        leather(ctx, poly(chim));
        cut(ctx, poly(inset(chim, 1.4)));
        const flame = C([[20, 16], [23, 28], [22, 36], [18, 36], [17, 28]], 4);
        piece(ctx, flame, { color: INK.yellow, a: 0.95, dyeIn: 0.8 });
        dye(ctx, poly(C([[20, 24], [21.5, 31], [20, 34.5], [18.5, 31]], 3)), INK.cream, 1);
        piece(ctx, C([[12, 44], [28, 44], [30, 50], [10, 50]], 2), { color: INK.gold, dyeIn: 0.8 });
        piece(ctx, ribbon([[30, 47], [36, 47]], 1.4, true), { color: INK.gold, dyeIn: 0.4 });
        const font = C([[10, 50], [30, 50], [37, 60], [32, 70], [8, 70], [3, 60]], 5);
        const fi = panel(ctx, font, { color: INK.orange, border: 2, seed: sd(), r: 0.7 });
        clipped(ctx, fi, () => prajamYam(ctx, 20, 60, 5, { color: INK.red, petal: INK.gold }));
        const foot = C([[16, 70], [24, 70], [26, 80], [34, 88], [6, 88], [14, 80]], 3);
        panel(ctx, foot, { color: INK.gold, border: 1.4, r: 0.6, seed: sd() });
      }, { name: 'hh/oil-lamp' });
      return { sprite, glow: [20, 28, 110] };
    },
  },

  // ---------------------------------------------------------------- stove
  {
    id: 'tao-than', name: 'เตาถ่าน', en: 'Charcoal stove (tao ang-lo)', cat: 'household',
    build() {
      const sprite = paintSprite(74, 80, (ctx, { rng }) => {
        const sd = seeder(rng);
        for (let k = 0; k < 5; k++) {
          const f = kanokPts(15 + k * 11, 20, 12 + (k % 2) * 6, -Math.PI / 2 + (k - 2) * 0.12, k % 2 === 0);
          leather(ctx, poly(f));
          dye(ctx, poly(inset(f, 0.8)), INK.vermilion, 0.95);
          dye(ctx, poly(inset(f, 2.4)), INK.yellow, 0.95);
        }
        const body = C([[4, 22], [70, 22], [64, 72], [58, 78], [16, 78], [10, 72]], 4);
        const bi = panel(ctx, body, { color: '#8a8472', border: 2.6, seed: sd() });
        clipped(ctx, bi, () => {
          line(ctx, [[0, 30], [74, 30]], INK.leather, 4, { smoothIt: false });
          dotLine(ctx, [[4, 30], [70, 30]], { spacing: 3, r: 0.7, seed: sd(), smoothIt: false });
          dye(ctx, poly(C([[26, 52], [48, 52], [48, 70], [26, 70]], 2)), INK.leather, 1);
          const door = C([[28, 54], [46, 54], [46, 68], [28, 68]], 2);
          dye(ctx, poly(door), INK.orange, 0.95);
          dotFill(ctx, poly(door), [28, 54, 46, 68], { pattern: 'rand', spacing: 3.4, r: 0.7, seed: sd() });
        });
        for (const x of [12, 37, 62]) piece(ctx, blobPts(x, 21, 4, 3, { seed: x }), { color: '#8a8472' });
        const coals = C([[10, 22], [20, 17], [37, 16], [54, 17], [64, 22]], 4);
        piece(ctx, coals, { color: INK.red, dyeIn: 0.8 });
      }, { name: 'hh/stove' });
      return { sprite, glow: [37, 16, 90], mass: 1.5 };
    },
  },

  // ---------------------------------------------------------------- clay pot
  {
    id: 'mo-din', name: 'หม้อดิน', en: 'Clay cooking pot on a rattan ring', cat: 'household',
    build() {
      const sprite = paintSprite(74, 66, (ctx, { rng }) => {
        const sd = seeder(rng);
        const ring = C([[14, 54], [60, 54], [64, 60], [58, 66], [16, 66], [10, 60]], 3);
        piece(ctx, ring, { color: '#c99c48', dyeIn: 1 });
        for (let x = 14; x < 62; x += 3.4) slit(ctx, [[x, 56], [x + 2, 64]], 0.6, { smoothIt: false });
        const pot = C([[22, 6], [52, 6], [50, 12], [66, 24], [70, 38], [60, 52], [37, 58], [14, 52], [4, 38], [8, 24], [24, 12]], 6);
        const pi = panel(ctx, pot, { color: '#b4532a', border: 2.8, seed: sd() });
        clipped(ctx, pi, () => {
          for (let k = 0; k < 7; k++) { const x = 14 + k * 8; dye(ctx, krajangPath(x, 50, 6, 12), INK.green, 0.9); gold(ctx, krajangPath(x, 50, 6, 12), 0.5); }
          gold(ctx, Q([[6, 26], [37, 22], [68, 26]]), 0.8);
          for (let k = 0; k < 8; k++) dotFlower(ctx, 10 + k * 7.6, 32, 0.8, 5, 2.3);
        });
        const lip = C([[18, 2], [56, 2], [58, 8], [16, 8]], 2);
        piece(ctx, lip, { color: '#b4532a', dyeIn: 1 });
        dotLine(ctx, [[20, 5], [54, 5]], { spacing: 2.8, r: 0.6, seed: sd(), smoothIt: false });
      }, { name: 'hh/mo-din' });
      return { sprite, grip: [37, 3], holdAngle: 0 };
    },
  },

  // ---------------------------------------------------------------- broom
  {
    id: 'mai-kwat', name: 'ไม้กวาด', en: 'Grass-flower broom', cat: 'household',
    build() {
      const sprite = paintSprite(44, 130, (ctx, { rng }) => {
        const sd = seeder(rng);
        piece(ctx, ribbon([[22, 1], [22, 76]], 2.2, true), { color: '#c99c48', dyeIn: 0.7 });
        for (const y of [20, 40, 60]) collar(ctx, 22, y, 2.6, 1.6, sd, { dots: false });
        // bushy grass-flower head, fanning out
        const head = [];
        for (let i = 0; i <= 20; i++) { const t = i / 20; const x = 4 + t * 36; head.push([x, 128 - (i % 2 ? 4 : 0) - Math.abs(t - 0.5) * 6]); }
        const H = [[17, 76], [27, 76], ...head.slice().reverse().map(([x, y]) => [x, y]).reverse().reverse()];
        const poly2 = [[17, 76], [27, 76], [30, 90], ...head.slice().reverse(), [14, 90]];
        leather(ctx, poly(poly2));
        dye(ctx, poly(inset(poly2, 1)), INK.horn, 0.85);
        for (let k = -8; k <= 8; k++) slit(ctx, [[22 + k * 0.5, 92], [22 + k * 2, 124]], 0.6, { smoothIt: false });
        const band = C([[15, 80], [29, 80], [31, 92], [13, 92]], 2);
        panel(ctx, band, { color: INK.vermilion, border: 1, r: 0, seed: sd() });
        plaidless(ctx);
        void H;
        function plaidless() { for (let y = 83; y < 91; y += 3) gold(ctx, [[14, y], [30, y]], 0.6, { smoothIt: false }); }
      }, { name: 'hh/broom' });
      return { sprite, grip: [22, 24], holdAngle: 0 };
    },
  },

  // ---------------------------------------------------------------- tang
  {
    id: 'tang', name: 'ตั่ง', en: 'Low carved table (tang)', cat: 'household',
    build() {
      const sprite = paintSprite(130, 52, (ctx, { rng }) => {
        const sd = seeder(rng);
        // lion-paw legs (ขาสิงห์) curling outward
        for (const s of [-1, 1]) {
          const X = (x) => 65 + s * (x - 65);
          const leg = C([[X(10), 14], [X(20), 14], [X(18), 30], [X(14), 42], [X(6), 48], [X(2), 44], [X(6), 40], [X(10), 30]], 5);
          panel(ctx, leg, { color: INK.gold, border: 1.4, r: 0.55, seed: sd() });
        }
        const top = C([[2, 4], [128, 4], [128, 12], [2, 12]], 2);
        piece(ctx, top, { color: '#8a1a12', dyeIn: 1.2 });
        dotLine(ctx, [[5, 8], [125, 8]], { spacing: 3, r: 0.7, seed: sd(), smoothIt: false });
        // apron with openwork กนก
        const apron = join([[18, 12], [112, 12]], [[112, 12], [108, 24], [65, 28], [22, 24], [18, 12]]);
        leather(ctx, poly(apron));
        for (let k = 0; k < 6; k++) { const x = 30 + k * 14; cut(ctx, poly(kanokPts(x, 25, 10, -Math.PI / 2, k % 2 === 0).map(([a, b]) => [a, b]))); }
        gold(ctx, inset(apron, 1), 0.6, { closed: true, smoothIt: false });
      }, { name: 'hh/tang' });
      return { sprite, mass: 1.5 };
    },
  },

  // ---------------------------------------------------------------- bench
  {
    id: 'ma-nang', name: 'ม้านั่ง', en: 'Wooden bench', cat: 'household',
    build() {
      const sprite = paintSprite(150, 56, (ctx, { rng }) => {
        const sd = seeder(rng);
        for (const x of [16, 134]) {
          const legs = [[x - 12, 56], [x - 7, 56], [x, 18], [x + 7, 56], [x + 12, 56], [x + 4, 10], [x - 4, 10]];
          piece(ctx, legs, { color: '#9a5a26', dyeIn: 1 });
        }
        piece(ctx, ribbon([[16, 40], [134, 40]], 1.8, false), { color: '#9a5a26', dyeIn: 0.6 });
        const seat = C([[0, 4], [150, 4], [150, 12], [0, 12]], 2);
        const si = panel(ctx, seat, { color: '#9a5a26', border: 1.6, r: 0.6, seed: sd() });
        clipped(ctx, si, () => { for (let x = 6; x < 150; x += 12) gold(ctx, Q([[x, 6], [x + 4, 8], [x + 8, 10]]), 0.4); });
        for (let x = 30; x < 125; x += 16) hole(ctx, x, 12.5, 0);
      }, { name: 'hh/bench' });
      return { sprite, mass: 1.4 };
    },
  },

  // ---------------------------------------------------------------- palm fan
  {
    id: 'phat-bai-tan', name: 'พัดใบตาล', en: 'Palm-leaf fan', cat: 'household',
    build() {
      const sprite = paintSprite(72, 104, (ctx, { rng }) => {
        const sd = seeder(rng);
        piece(ctx, ribbon([[36, 60], [36, 103]], 2.4, true), { color: INK.horn, dyeIn: 0.8 });
        const F = [];
        for (let i = 0; i <= 40; i++) { const a = Math.PI * (0.95 + (i / 40) * 1.1); F.push([36 + Math.cos(a) * 34, 38 + Math.sin(a) * 36 * (1 + 0.02 * (i % 2))]); }
        F.push([46, 64], [36, 70], [26, 64]);
        const fi = panel(ctx, F, { color: '#d9b25a', border: 2.8, seed: sd(), r: 0.85 });
        clipped(ctx, fi, () => {
          for (let k = 0; k < 15; k++) { const a = Math.PI * (1 + k / 14); line(ctx, [[36, 64], [36 + Math.cos(a) * 36, 40 + Math.sin(a) * 38]], INK.brown, 0.9, { smoothIt: false }); }
          dye(ctx, poly(ellipsePts(36, 58, 16, 10, 24)), INK.vermilion, 0.9);
          prajamYam(ctx, 36, 56, 7, { color: INK.red, petal: INK.gold });
        });
      }, { name: 'hh/palm-fan' });
      return { sprite, grip: [36, 92], holdAngle: 0 };
    },
  },

  // ---------------------------------------------------------------- umbrella
  {
    id: 'rom-kradat', name: 'ร่มกระดาษ', en: 'Paper umbrella (Bo Sang)', cat: 'household',
    build() {
      const sprite = paintSprite(140, 136, (ctx, { rng }) => {
        const sd = seeder(rng);
        piece(ctx, ribbon([[70, 2], [70, 118]], 1.6, true), { color: INK.horn, dyeIn: 0.5 });
        const hk = ribbon(Q([[70, 118], [70, 130], [64, 134], [60, 128]]), 2, true);
        piece(ctx, hk, { color: INK.gold, dyeIn: 0.6 });
        // stretchers under the canopy (openwork)
        for (let k = 0; k < 7; k++) { const x = 8 + k * 20.6; leather(ctx, poly(ribbon([[x, 44], [70, 76]], 0.8, false))); }
        const can = [];
        for (let i = 0; i <= 14; i++) { const x = 2 + i * 9.7; can.push([x, 46 + (i % 2 ? 3 : 0)]); }
        const canopy = [...can.reverse(), ...Q([[2, 46], [20, 22], [48, 9], [70, 6], [92, 9], [120, 22], [138, 46]]).slice(1, -1)];
        const ci = panel(ctx, canopy.reverse(), { color: INK.vermilion, border: 2.4, seed: sd() });
        clipped(ctx, ci, () => {
          for (let k = 0; k < 13; k++) { const x = 8 + k * 10.3; line(ctx, [[70, 6], [x, 46]], INK.leather, 0.9, { smoothIt: false }); }
          for (const [x, y, s] of [[42, 30, 7], [70, 26, 9], [98, 30, 7]]) { dye(ctx, poly(blobPts(x, y, s, s * 0.8, { seed: x })), INK.gold, 0.9); dotFlower(ctx, x, y, 1, 6, 2.6); }
          for (const [x, y] of [[54, 22], [86, 22], [26, 38], [114, 38]]) dye(ctx, poly(ellipsePts(x, y, 4, 2, 10, 0.5)), INK.green, 0.9);
        });
        piece(ctx, ellipsePts(70, 5, 3.5, 3, 12), { color: INK.gold, dyeIn: 0.6 });
      }, { name: 'hh/umbrella' });
      return { sprite, grip: [70, 110], holdAngle: 0 };
    },
  },

  // ---------------------------------------------------------------- krabung
  {
    id: 'krabung', name: 'กระบุง', en: 'Woven krabung basket', cat: 'household',
    build() {
      const sprite = paintSprite(72, 74, (ctx, { rng }) => {
        const sd = seeder(rng);
        leather(ctx, poly(ribbon(Q([[8, 14], [20, 2], [52, 2], [64, 14]]), 1.2, true)));
        const b = C([[4, 12], [68, 12], [62, 56], [58, 68], [52, 72], [20, 72], [14, 68], [10, 56]], 4);
        const bi = panel(ctx, b, { color: '#c99c48', border: 2, seed: sd(), r: 0.7 });
        clipped(ctx, bi, () => {
          for (let y = 18, r = 0; y < 72; y += 5, r++) for (let x = 4 + (r % 2) * 2.5; x < 70; x += 5) slit(ctx, [[x, y], [x + 2.4, y + 2.4]], 0.7, { smoothIt: false });
        });
        piece(ctx, C([[2, 10], [70, 10], [70, 16], [2, 16]], 2), { color: INK.brown, dyeIn: 0.8 });
        dotLine(ctx, [[4, 13], [68, 13]], { spacing: 2.8, r: 0.6, seed: sd(), smoothIt: false });
        for (const [x, y] of [[14, 70], [58, 70]]) piece(ctx, [[x - 4, y - 2], [x + 4, y - 2], [x + 4, y + 3], [x - 4, y + 3]], { color: INK.brown });
      }, { name: 'hh/krabung' });
      return { sprite, grip: [36, 2], holdAngle: 0 };
    },
  },
];
