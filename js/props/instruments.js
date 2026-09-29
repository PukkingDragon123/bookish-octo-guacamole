// Musical instruments of the Thai ensembles (and the Nang Talung band:
// ทับ, โหม่ง, ฉิ่ง, ปี่, กรับ) cut in hide. Each has a `sound`.

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
export const PROPS = [
  // ---------------------------------------------------------------- ranat
  {
    id: 'ranat-ek', name: 'ระนาดเอก', en: 'Ranat ek (xylophone)', cat: 'instruments',
    build() {
      const sprite = paintSprite(176, 92, (ctx, { rng }) => {
        const sd = seeder(rng);
        // bars hung on a cord in a sagging curve above the boat trough
        const bar = (i) => { const t = i / 20; return [22 + t * 132, 16 + Math.sin(t * Math.PI) * 8]; };
        for (let i = 0; i <= 20; i++) {
          const [x, y] = bar(i);
          const w = 5.4 - i * 0.05;
          const b = [[x - w / 2, y - 3], [x + w / 2, y - 3], [x + w / 2, y + 3], [x - w / 2, y + 3]];
          leather(ctx, poly(b));
          dye(ctx, poly(inset(b, 0.7)), i % 2 ? INK.horn : INK.gold, 0.9);
          hole(ctx, x, y, 0.6);
        }
        // boat-shaped trough (ราง) with upswept ends
        const trough = join(
          [[6, 8], [10, 20], [22, 30], [60, 38], [88, 40], [116, 38], [154, 30], [166, 20], [170, 8]],
          [[170, 8], [174, 14], [172, 30], [160, 46], [120, 56], [88, 58], [56, 56], [16, 46], [4, 30], [2, 14], [6, 8]],
        );
        const ti = panel(ctx, trough, { color: INK.crimson, border: 3, r: 0.9, sp: 3.4, seed: sd() });
        clipped(ctx, ti, () => {
          krajangRow(ctx, Q([[20, 52], [88, 57], [156, 52]]), 6.5, { color: INK.gold, inner: INK.vermilion });
          gold(ctx, Q([[14, 36], [88, 46], [162, 36]]), 0.8);
        });
        for (let k = 0; k < 9; k++) dotFlower(ctx, 36 + k * 13, 40 + Math.sin((k / 8) * Math.PI) * 4, 0.8, 5, 2.4);
        for (const x of [8, 168]) prajamYam(ctx, x, 20, 4.5, { color: INK.red, petal: INK.gold });
        // pedestal foot
        const foot = C([[62, 56], [114, 56], [110, 70], [124, 86], [124, 92], [52, 92], [52, 86], [66, 70]], 4);
        const fi = panel(ctx, foot, { color: INK.gold, border: 2.4, r: 0.8, seed: sd() });
        clipped(ctx, fi, () => lotusRow(ctx, [[56, 88], [120, 88]], 7, { color: INK.red }));
        // two mallets resting on the bars
        for (const [a, b] of [[[40, 2], [70, 14]], [[120, 14], [146, 2]]]) {
          leather(ctx, poly(ribbon([a, b], 1, true)));
          const h = b[0] > a[0] && a[1] < b[1] ? a : b;
          const m = blobPts(h[0], h[1], 3.6, 3.2, { seed: sd() });
          piece(ctx, m, { color: INK.red });
        }
      }, { name: 'inst/ranat' });
      return { sprite, sound: 'ranat', mass: 1.4 };
    },
  },

  // ---------------------------------------------------------------- khong wong
  {
    id: 'khong-wong', name: 'ฆ้องวง', en: 'Khong wong (gong circle)', cat: 'instruments',
    build() {
      const sprite = paintSprite(170, 96, (ctx, { rng }) => {
        const sd = seeder(rng);
        const cx = 85, cy = 52, rx = 76, ry = 26;
        const gong = (x, y, s, back) => {
          const g = join([[x - 7 * s, y], [x - 6 * s, y - 4 * s], [x - 2.5 * s, y - 5.4 * s]], [[x - 2.5 * s, y - 5.4 * s], [x - 2 * s, y - 8 * s], [x, y - 9.5 * s], [x + 2 * s, y - 8 * s], [x + 2.5 * s, y - 5.4 * s]], [[x + 2.5 * s, y - 5.4 * s], [x + 6 * s, y - 4 * s], [x + 7 * s, y]], [[x + 7 * s, y], [x - 7 * s, y]]);
          leather(ctx, poly(g));
          dye(ctx, poly(inset(g, 0.9)), back ? INK.horn : INK.gold, 0.92);
          hole(ctx, x, y - 7.6 * s, 0.7 * s);
          dotLine(ctx, [[x - 5 * s, y - 2], [x + 5 * s, y - 2]], { spacing: 2.4, r: 0.45, seed: sd(), smoothIt: false });
        };
        // back arc of gongs, then the rattan ring, then front gongs
        for (let k = 0; k < 8; k++) { const a = Math.PI + 0.25 + (k / 7) * (Math.PI - 0.5); gong(cx + Math.cos(a) * rx * 0.86, cy + Math.sin(a) * ry * 0.86, 0.8, true); }
        const outer = ellipsePts(cx, cy, rx, ry, 80), innerE = ellipsePts(cx, cy, rx - 7, ry - 5, 80);
        leather(ctx, poly(outer));
        cut(ctx, poly(innerE));
        dye(ctx, poly(outer), INK.crimson, 0.85);
        dotLine(ctx, ellipsePts(cx, cy, rx - 3.5, ry - 2.5, 80), { closed: true, spacing: 3.2, r: 0.8, seed: sd(), smoothIt: false });
        gold(ctx, ellipsePts(cx, cy, rx - 1.4, ry - 1, 80), 0.6, { closed: true, smoothIt: false });
        // posts down to the floor rail
        const base = join([[10, 60], [40, 76], [85, 80], [130, 76], [160, 60]], [[160, 60], [164, 66], [132, 84], [85, 90], [38, 84], [6, 66], [10, 60]]);
        for (let k = 0; k < 9; k++) {
          const a = 0.25 + (k / 8) * (Math.PI - 0.5), x = cx + Math.cos(a) * rx * 0.97;
          leather(ctx, poly(ribbon([[x, cy + Math.sin(a) * ry - 2], [x, cy + Math.sin(a) * ry + 12]], 1.6, false)));
        }
        const bi = panel(ctx, base, { color: INK.crimson, border: 2, r: 0.7, seed: sd() });
        clipped(ctx, bi, () => krajangRow(ctx, Q([[10, 70], [85, 86], [160, 70]]), 5, { color: INK.gold, inner: INK.vermilion }));
        for (let k = 0; k < 8; k++) { const a = 0.3 + (k / 7) * (Math.PI - 0.6); gong(cx + Math.cos(a) * rx * 0.9, cy + Math.sin(a) * ry * 0.9 + 2, 1, false); }
        // upturned ends of the ring by the player's gap
        for (const s of [-1, 1]) { const k = kanokPts(cx + s * 70, 42, 16, -Math.PI / 2 + s * 0.3, s > 0); piece(ctx, k, { color: INK.gold }); }
      }, { name: 'inst/khong' });
      return { sprite, sound: 'khong-wong', mass: 1.5 };
    },
  },

  // ---------------------------------------------------------------- klong that
  {
    id: 'klong-that', name: 'กลองทัด', en: 'Klong that (barrel drum)', cat: 'instruments',
    build() {
      const sprite = paintSprite(110, 112, (ctx, { rng }) => {
        const sd = seeder(rng);
        // stand legs
        for (const [a, b] of [[[30, 60], [12, 110]], [[80, 60], [98, 110]], [[55, 70], [55, 110]]]) {
          const l = ribbon([a, b], 2.4, true);
          piece(ctx, l, { color: '#9a5a26', dyeIn: 0.8 });
        }
        leather(ctx, poly(ribbon([[16, 96], [94, 96]], 1.8, true)));
        ctx.save(); ctx.translate(55, 48); ctx.rotate(-0.25);
        const body = C([[-40, -30], [0, -36], [40, -30], [44, 0], [40, 30], [0, 36], [-40, 30], [-44, 0]], 6);
        const bi = panel(ctx, body, { color: INK.red, border: 3, seed: sd(), r: 0.9 });
        clipped(ctx, bi, () => {
          for (const x of [-18, 18]) { line(ctx, [[x, -40], [x, 40]], INK.gold, 3); dotLine(ctx, [[x, -34], [x, 34]], { spacing: 2.6, r: 0.6, seed: sd(), smoothIt: false }); }
          for (let y = -24; y <= 24; y += 12) prajamYam(ctx, 0, y, 4.5, { color: INK.crimson, petal: INK.gold });
        });
        // heads with stud rows
        for (const s of [-1, 1]) {
          const h = ellipsePts(s * 41, 0, 7, 31, 40);
          leather(ctx, poly(h));
          dye(ctx, poly(inset(h, 1.2)), INK.cream, 0.8);
          dotLine(ctx, ellipsePts(s * 38, 0, 3, 29, 30), { closed: true, spacing: 3.2, r: 0.9, seed: sd(), smoothIt: false });
        }
        ctx.restore();
      }, { name: 'inst/klong' });
      return { sprite, sound: 'klong', mass: 1.3 };
    },
  },

  // ---------------------------------------------------------------- thap
  {
    id: 'thap', name: 'ทับ', en: 'Thap (Nang Talung goblet drum pair)', cat: 'instruments',
    build() {
      const sprite = paintSprite(104, 96, (ctx, { rng }) => {
        const sd = seeder(rng);
        const goblet = (cx, top, s, rot, cols) => {
          ctx.save(); ctx.translate(cx, top); ctx.rotate(rot); ctx.scale(s, s);
          const R = [[0, 0], [15, 0], [17, 6], [15, 18], [9, 30], [5, 38], [4.4, 50], [6, 58], [11, 66], [14, 70]];
          const body = [...R, ...mx(R, 0).reverse().slice(1, -1)];
          const bi = panel(ctx, C(body, 5), { color: cols[0], border: 2.2, seed: sd(), r: 0.75, sp: 3 });
          clipped(ctx, bi, () => {
            dye(ctx, poly([[-20, 36], [20, 36], [20, 52], [-20, 52]]), cols[1], 0.9);
            // lacing strings from head to waist ring
            for (let k = -6; k <= 6; k++) line(ctx, [[k * 2.4, 3], [k * 0.8, 34]], INK.cream, 0.7, { smoothIt: false });
            krajangRow(ctx, [[-14, 66], [14, 66]], 5, { color: INK.gold, inner: INK.red });
          });
          collar(ctx, 0, 35, 6.4, 3, sd);
          collar(ctx, 0, 52, 5.4, 3, sd);
          const head = [[-16, -3], [16, -3], [16.4, 2.6], [-16.4, 2.6]];
          piece(ctx, head, { color: INK.cream, a: 0.85, dyeIn: 0.8 });
          dotLine(ctx, [[-14, 0], [14, 0]], { spacing: 2.6, r: 0.6, seed: sd(), smoothIt: false });
          ctx.restore();
        };
        goblet(70, 22, 1, 0.12, [INK.crimson, INK.gold]);
        goblet(34, 14, 1.08, -0.1, [INK.indigo, INK.vermilion]);
      }, { name: 'inst/thap' });
      return { sprite, sound: 'thap', mass: 1.1 };
    },
  },

  // ---------------------------------------------------------------- mong
  {
    id: 'mong', name: 'โหม่ง', en: 'Mong (pair of gongs in a box frame)', cat: 'instruments',
    build() {
      const sprite = paintSprite(110, 70, (ctx, { rng }) => {
        const sd = seeder(rng);
        for (const x of [30, 78]) {
          const g = join([[x - 20, 30], [x - 18, 22], [x - 7, 18]], [[x - 7, 18], [x - 6, 11], [x, 7], [x + 6, 11], [x + 7, 18]], [[x + 7, 18], [x + 18, 22], [x + 20, 30]], [[x + 20, 30], [x - 20, 30]]);
          const gi = panel(ctx, g, { color: INK.gold, border: 1.6, r: 0.7, seed: sd() });
          void gi; hole(ctx, x, 11, 1.2);
          gold(ctx, [[x - 16, 25], [x + 16, 25]], 0.6, { smoothIt: false });
        }
        const box = C([[4, 30], [106, 30], [104, 60], [96, 66], [14, 66], [6, 60]], 3);
        const bi = panel(ctx, box, { color: INK.crimson, border: 2.6, seed: sd() });
        clipped(ctx, bi, () => {
          for (const x of [30, 78]) { const w = C([[x - 14, 38], [x + 14, 38], [x + 14, 58], [x - 14, 58]], 3); leather(ctx, poly(w)); dotFill(ctx, poly(w), [x - 14, 38, x + 14, 58], { pattern: 'flowers', spacing: 5, r: 0.8, seed: sd() }); gold(ctx, w, 0.6, { closed: true }); }
          prajamYam(ctx, 54, 48, 6, { color: INK.red, petal: INK.gold });
        });
        leather(ctx, poly(ribbon([[70, 2], [98, 26]], 1, true)));
        piece(ctx, blobPts(70, 3, 4, 3.4, { seed: 3 }), { color: INK.red });
      }, { name: 'inst/mong' });
      return { sprite, sound: 'mong', mass: 1.2 };
    },
  },

  // ---------------------------------------------------------------- ching
  {
    id: 'ching', name: 'ฉิ่ง', en: 'Ching (finger cymbals)', cat: 'instruments',
    build() {
      const sprite = paintSprite(44, 46, (ctx, { rng }) => {
        const sd = seeder(rng);
        leather(ctx, poly(ribbon(Q([[12, 30], [14, 10], [22, 2], [30, 10], [32, 30]]), 0.9, true)));
        piece(ctx, blobPts(22, 3, 3.4, 2.6, { seed: 2 }), { color: INK.red });
        for (const [x, y, r] of [[12, 34, -0.3], [32, 34, 0.3]]) {
          ctx.save(); ctx.translate(x, y); ctx.rotate(r);
          const c = C([[-10, 6], [-9, 0], [-4, -3], [-2, -6], [2, -6], [4, -3], [9, 0], [10, 6]], 4);
          panel(ctx, c, { color: INK.gold, border: 1.3, r: 0.55, sp: 2.4, seed: sd() });
          hole(ctx, 0, -3.5, 0.9);
          ctx.restore();
        }
      }, { name: 'inst/ching' });
      return { sprite, grip: [22, 4], holdAngle: 0, sound: 'ching' };
    },
  },

  // ---------------------------------------------------------------- khlui
  {
    id: 'khlui', name: 'ขลุ่ย', en: 'Khlui (bamboo flute)', cat: 'instruments',
    build() {
      const sprite = paintSprite(14, 96, (ctx, { rng }) => {
        const sd = seeder(rng);
        const f = ribbon([[7, 1], [7, 95]], 3.3, true);
        const fi = panel(ctx, f, { color: INK.horn, border: 1, r: 0, seed: sd() });
        clipped(ctx, fi, () => { for (let k = 0; k < 9; k++) dye(ctx, poly(blobPts(5 + (k % 2) * 4, 12 + k * 9, 2.2, 3.4, { seed: sd() })), INK.leather, 0.8); });
        for (const y of [3, 30, 60, 93]) collar(ctx, 7, y, 3.6, 2, sd, { dots: false });
        cut(ctx, poly([[5, 9], [9, 9], [9, 12], [5, 12]]));
        for (let k = 0; k < 7; k++) hole(ctx, 7, 38 + k * 7.5, 1.1);
      }, { name: 'inst/khlui' });
      return { sprite, grip: [7, 70], holdAngle: 0, sound: 'khlui' };
    },
  },

  // ---------------------------------------------------------------- khaen
  {
    id: 'khaen', name: 'แคน', en: 'Khaen (bamboo mouth organ)', cat: 'instruments',
    build() {
      const sprite = paintSprite(44, 156, (ctx, { rng }) => {
        const sd = seeder(rng);
        const lens = [150, 128, 104, 82, 70, 92, 116, 140];
        lens.forEach((L, i) => {
          const x = 6 + i * 4.4, top = 154 - L - 30;
          const p = ribbon([[x, Math.max(1, top)], [x, 150]], 2, true);
          piece(ctx, p, { color: i % 2 ? INK.horn : '#c99c48', dyeIn: 0.6 });
          collar(ctx, x, Math.max(4, top + 3), 2.3, 1.6, sd, { dots: false });
        });
        for (const y of [30, 60, 128]) { leather(ctx, poly(ribbon([[3, y], [41, y]], 1.4, true))); dye(ctx, poly(ribbon([[3, y], [41, y]], 0.8, false)), INK.vermilion, 0.9); }
        // wooden windchest (เต้า) with mouthpiece
        const w = C([[8, 92], [36, 92], [42, 104], [36, 116], [8, 116], [2, 104]], 5);
        const wi = panel(ctx, w, { color: INK.crimson, border: 2, seed: sd(), r: 0.7 });
        clipped(ctx, wi, () => prajamYam(ctx, 22, 104, 6, { color: INK.red, petal: INK.gold }));
        piece(ctx, C([[40, 100], [44, 100], [44, 108], [40, 108]], 2), { color: INK.gold });
      }, { name: 'inst/khaen' });
      return { sprite, grip: [22, 104], holdAngle: 0, sound: 'khaen' };
    },
  },

  // ---------------------------------------------------------------- saw
  {
    id: 'saw-duang', name: 'ซอด้วง', en: 'Saw duang (two-string fiddle)', cat: 'instruments',
    build() {
      const sprite = paintSprite(50, 132, (ctx, { rng }) => {
        const sd = seeder(rng);
        // neck curling back at the top, two big pegs
        const neck = ribbon(Q([[20, 108], [20, 40], [20, 14], [16, 5], [10, 4]]), (t) => 2 + t * 0.6, true);
        piece(ctx, neck, { color: INK.horn, dyeIn: 0.7 });
        for (const y of [20, 32]) { const p = ribbon([[10, y], [30, y - 2]], 1.8, true); piece(ctx, p, { color: INK.gold, dyeIn: 0.6 }); hole(ctx, 28, y - 2, 0.6); }
        // cylinder sound box
        const box = C([[10, 100], [30, 100], [31, 124], [9, 124]], 3);
        const bi = panel(ctx, box, { color: INK.crimson, border: 1.8, seed: sd(), r: 0.6 });
        clipped(ctx, bi, () => { for (const y of [106, 112, 118]) gold(ctx, [[9, y], [31, y]], 0.6, { smoothIt: false }); });
        piece(ctx, [[30, 102], [34, 102], [34, 122], [30, 122]], { color: INK.cream, dyeIn: 0.6 });
        leather(ctx, poly(ribbon([[20, 124], [20, 131]], 1.5, true)));
        // strings, and the bow passing across
        line(ctx, [[21, 22], [33, 110]], INK.cream, 0.6, { smoothIt: false });
        const bow = ribbon(Q([[2, 60], [26, 76], [48, 96]]), 1.1, true);
        leather(ctx, poly(bow));
        collar(ctx, 6, 63, 2.4, 3, sd);
      }, { name: 'inst/saw' });
      return { sprite, grip: [20, 96], holdAngle: 0, sound: 'saw' };
    },
  },

  // ---------------------------------------------------------------- pi
  {
    id: 'pi-nai', name: 'ปี่', en: 'Pi (Thai oboe)', cat: 'instruments',
    build() {
      const sprite = paintSprite(20, 76, (ctx, { rng }) => {
        const sd = seeder(rng);
        piece(ctx, ribbon([[10, 0], [10, 10]], 1, true), { color: INK.cream, dyeIn: 0.3 });
        piece(ctx, ellipsePts(10, 9, 5, 1.4, 16), { color: INK.gold, dyeIn: 0.4 });
        const R = [[10, 10], [12.5, 12], [14.5, 24], [16, 38], [14.5, 52], [12.5, 64], [13.5, 72], [10, 74]];
        const body = [...R, ...mx(R, 10).reverse().slice(1, -1)];
        panel(ctx, C(body, 5), { color: INK.horn, border: 1.4, r: 0, seed: sd() });
        for (let y = 16; y < 70; y += 6) line(ctx, [[3, y], [17, y]], INK.leather, 1.3, { smoothIt: false });
        for (let k = 0; k < 6; k++) hole(ctx, 10, 21 + k * 7.5, 1);
      }, { name: 'inst/pi' });
      return { sprite, grip: [10, 50], holdAngle: 0, sound: 'pi' };
    },
  },

  // ---------------------------------------------------------------- jakhe
  {
    id: 'jakhe', name: 'จะเข้', en: 'Jakhe (crocodile zither)', cat: 'instruments',
    build() {
      const sprite = paintSprite(170, 50, (ctx, { rng }) => {
        const sd = seeder(rng);
        for (const x of [14, 40, 70, 110, 150]) piece(ctx, [[x - 3, 30], [x + 3, 30], [x + 4, 48], [x - 4, 48]], { color: INK.horn, dyeIn: 0.8 });
        const body = join([[4, 20], [10, 8], [30, 4], [62, 8], [80, 14], [168, 16]], [[168, 16], [168, 26], [80, 28], [62, 36], [30, 40], [10, 36], [4, 20]]);
        const bi = panel(ctx, body, { color: '#3e7a3a', border: 2.6, seed: sd() });
        clipped(ctx, bi, () => {
          dotFill(ctx, poly(bi), [4, 4, 80, 40], { pattern: 'scales', spacing: 4.4, r: 0.8, seed: sd() });
          gold(ctx, Q([[8, 22], [60, 22], [166, 21]]), 0.6);
        });
        // frets and strings
        for (let k = 0; k < 11; k++) { const x = 84 + k * 7; piece(ctx, [[x - 1, 11], [x + 1, 11], [x + 1.4, 16], [x - 1.4, 16]], { color: INK.gold, dyeIn: 0.3 }); }
        for (const dy of [-1.5, 0, 1.5]) line(ctx, [[20, 12 + dy], [164, 13 + dy]], INK.cream, 0.4, { smoothIt: false });
        for (const y of [10, 18, 26]) piece(ctx, ribbon([[160, y], [168, y]], 1.4, true), { color: INK.gold, dyeIn: 0.3 });
        prajamYam(ctx, 30, 24, 6, { color: INK.red, petal: INK.gold });
      }, { name: 'inst/jakhe' });
      return { sprite, sound: 'jakhe', mass: 1.3 };
    },
  },

  // ---------------------------------------------------------------- krap
  {
    id: 'krap', name: 'กรับ', en: 'Krap phuang (bundle clapper)', cat: 'instruments',
    build() {
      const sprite = paintSprite(34, 94, (ctx, { rng }) => {
        const sd = seeder(rng);
        for (let k = 0; k < 6; k++) {
          const a = -0.18 + k * 0.07;
          const tip = [17 + Math.sin(a) * 76, 80 - Math.cos(a) * 76];
          const p = ribbon([[17, 80], tip], k === 0 || k === 5 ? 3.4 : 2.2, true);
          piece(ctx, p, { color: k === 0 || k === 5 ? INK.gold : INK.horn, dyeIn: 0.7 });
          if (k === 0 || k === 5) dotLine(ctx, [lerp2([17, 80], tip, 0.1), lerp2([17, 80], tip, 0.9)], { spacing: 3, r: 0.55, seed: sd(), smoothIt: false });
        }
        collar(ctx, 17, 78, 6, 4, sd);
        const tas = C([[13, 82], [21, 82], [24, 92], [17, 90], [10, 92]], 3);
        piece(ctx, tas, { color: INK.vermilion });
      }, { name: 'inst/krap' });
      return { sprite, grip: [17, 78], holdAngle: 0, sound: 'krap' };
    },
  },
];
