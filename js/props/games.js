// Games & sports (กีฬาพื้นบ้าน): ตะกร้อ, ปิงปอง, กระโดดเชือก — cut in hide.
// The behaviour (ball physics, rallies, the whirling rope) lives in
// js/sandbox/games.js; these defs carry the extra data it needs:
//   ball:     { r, e, drag, kind }       — a bouncy ball (single circle)
//   table:    { top, net, legs, e }      — ping-pong table geometry (box coords)
//   paddle:   { blade: [x, y, r], e }    — hitting face of a bat (box coords)
//   rope:     { handle, grip, tip, len } — jump rope, with a single-handle sprite

import {
  INK, paintSprite, leather, dye, line, gold, hole, holes, dotLine, dotFill, slit, cut,
  curve, poly, ellipsePts, inset, prajamYam,
} from '../art/leather.js';

const TAU = Math.PI * 2;

// ------------------------------------------------------------ helpers
// Closed outline of a strip of half-width hw (number or fn(t)) around an
// open centreline.
function ribbon(c, hw) {
  const n = c.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    const nx = -ty / l, ny = tx / l;
    const h = typeof hw === 'function' ? hw(n > 1 ? i / (n - 1) : 0) : hw;
    L.push([c[i][0] - nx * h, c[i][1] - ny * h]);
    R.push([c[i][0] + nx * h, c[i][1] + ny * h]);
  }
  return [...L, ...R.reverse()];
}

function panel(ctx, pts, { color, a = 0.9, border = 2, r = 0.7, sp = 3.2, seed = 1, g = true } = {}) {
  leather(ctx, poly(pts));
  const inner = inset(pts, border);
  if (color) dye(ctx, poly(inner), color, a);
  if (g && color) gold(ctx, inner, 0.5, { closed: true, smoothIt: false });
  if (r) dotLine(ctx, inset(pts, border * 0.5), { closed: true, spacing: sp, r, seed, smoothIt: false });
  return inner;
}

// ------------------------------------------------------------ ตะกร้อ
// A woven rattan sphere: the strips of a real ลูกตะกร้อ cross to leave a
// lattice of (mostly six-sided) holes. We build a frequency-2 geodesic
// sphere; its vertices are the hole centres and its triangle centroids the
// strip crossings (a Goldberg polyhedron), then project the front half.
function geodesic(freq = 2) {
  const t = (1 + Math.sqrt(5)) / 2;
  let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  V = V.map(nrm);
  for (let k = 1; k < freq; k++) {
    const mid = new Map(), NF = [];
    const m = (a, b) => {
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (!mid.has(key)) { mid.set(key, V.length); V.push(nrm([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2])); }
      return mid.get(key);
    };
    for (const [a, b, c] of F) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); NF.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    F = NF;
  }
  return { V, F };
}

function takrawSprite(R, { tilt = 0.5, spin = 0.3, name = 'games/takraw', tone = INK.horn } = {}) {
  const S = R * 2 + 2;
  return paintSprite(S, S, (ctx, { rng }) => {
    const cx = S / 2, cy = S / 2;
    const { V, F } = geodesic(2);
    // orient: tilt about x, spin about y
    const ca = Math.cos(tilt), sa = Math.sin(tilt), cb = Math.cos(spin), sb = Math.sin(spin);
    const P = V.map(([x, y, z]) => {
      const x1 = x * cb + z * sb, z1 = -x * sb + z * cb;
      const y2 = y * ca - z1 * sa, z2 = y * sa + z1 * ca;
      return [x1, y2, z2];
    });
    const disc = poly(ellipsePts(cx, cy, R, R, 48));
    leather(ctx, disc);
    dye(ctx, disc, tone, 0.8);
    // shading: a paler band round the belly so it reads as a sphere
    dye(ctx, poly(ellipsePts(cx - R * 0.18, cy - R * 0.2, R * 0.62, R * 0.58, 32)), INK.gold, 0.45);
    // centroids of every face (strip crossings)
    const cen = F.map(([a, b, c]) => {
      const x = P[a][0] + P[b][0] + P[c][0], y = P[a][1] + P[b][1] + P[c][1], z = P[a][2] + P[b][2] + P[c][2];
      const l = Math.hypot(x, y, z);
      return [x / l, y / l, z / l];
    });
    const faceOf = V.map(() => []);
    F.forEach((f, i) => f.forEach((v) => faceOf[v].push(i)));
    const proj = ([x, y]) => [cx + x * R, cy + y * R];
    // woven strips: the Goldberg edges (between adjacent face centroids)
    const edges = new Set();
    F.forEach((f, i) => {
      for (let k = 0; k < 3; k++) {
        const a = f[k], b = f[(k + 1) % 3];
        const j = F.findIndex((g, gi) => gi !== i && g.includes(a) && g.includes(b));
        if (j < 0) continue;
        const key = i < j ? i + '_' + j : j + '_' + i;
        if (edges.has(key)) continue;
        edges.add(key);
        const A = cen[i], B = cen[j];
        if (A[2] < -0.05 && B[2] < -0.05) continue;
        // strip centre line, drawn as a curve on the sphere
        const pts = [];
        for (let s = 0; s <= 4; s++) {
          const u = s / 4;
          const x = A[0] + (B[0] - A[0]) * u, y = A[1] + (B[1] - A[1]) * u, z = A[2] + (B[2] - A[2]) * u;
          const l = Math.hypot(x, y, z);
          pts.push(proj([x / l, y / l]));
        }
        line(ctx, pts, INK.goldLine, 0.9, { alpha: 0.7 });
        line(ctx, pts, INK.brown, 0.3, { alpha: 0.9 }); // two rattan strands per strip
      }
    });
    // holes: each vertex's dual face, shrunk toward its centre and
    // foreshortened by the projection
    for (let v = 0; v < P.length; v++) {
      const n = P[v];
      if (n[2] < 0.12) continue;
      const ring = faceOf[v].map((fi) => cen[fi]);
      // order the ring around the vertex
      const ax = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      const u = norm3(cross(n, ax)), w = cross(n, u);
      ring.sort((p, q) => Math.atan2(dot(p, w), dot(p, u)) - Math.atan2(dot(q, w), dot(q, u)));
      const k = 0.5; // strip width vs hole
      const pts = ring.map((c) => proj([n[0] + (c[0] - n[0]) * k, n[1] + (c[1] - n[1]) * k]));
      const edgeFade = Math.min(1, (n[2] - 0.12) / 0.35);
      if (edgeFade < 0.35) {
        // near the rim the hole is a thin sliver: punch a slit instead
        slit(ctx, [pts[0], pts[Math.floor(pts.length / 2)]], 0.7, { smoothIt: false });
        continue;
      }
      // dark edge of the strip around each hole, then the cut
      line(ctx, [...pts, pts[0]], INK.leather, 1.1, { smoothIt: false, alpha: 0.8 });
      cut(ctx, poly(pts));
    }
    // crossing knots (over-under ticks) at the front crossings
    for (const c of cen) {
      if (c[2] < 0.3) continue;
      const [x, y] = proj(c);
      const p = new Path2D();
      p.arc(x, y, 0.9, 0, TAU);
      dye(ctx, p, INK.brown, 0.9);
    }
    // rim: dark edge with a punched pepper-dot ring (hand-cut look)
    line(ctx, ellipsePts(cx, cy, R - 0.6, R - 0.6, 48), INK.leather, 1.4, { closed: true });
    void rng;
  }, { name, pad: 3 });
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// ------------------------------------------------------------ ปิงปอง
const TW = 560, TH = 186, TOP = 44; // table sprite box; tabletop surface at y = TOP
const NET_H = 34;

function tableSprite() {
  return paintSprite(TW, TH, (ctx, { rng }) => {
    const sd = () => (rng() * 1e6) | 0;
    // legs (drawn first; the apron overlaps them)
    for (const x of [70, TW - 70]) {
      for (const dx of [-1, 1]) {
        const leg = [[x - 7 + dx * 16, TOP + 14], [x + 7 + dx * 16, TOP + 14], [x + 5 + dx * 30, TH - 8], [x - 5 + dx * 30, TH - 8]];
        panel(ctx, leg, { color: INK.brown, border: 2, r: 0.6, sp: 3.4, seed: sd(), g: false });
        // little foot
        leather(ctx, poly(ellipsePts(x + dx * 30, TH - 5, 10, 5, 16)));
      }
      // cross brace (กากบาท) between the pair, with a punched ประจำยาม
      const brace = (a, b) => leather(ctx, poly(ribbon([a, b], 2.4)));
      brace([x - 22, TOP + 30], [x + 26, TH - 36]);
      brace([x + 22, TOP + 30], [x - 26, TH - 36]);
      const m = poly(ellipsePts(x, TOP + 60, 9, 9, 20));
      leather(ctx, m);
      prajamYam(ctx, x, TOP + 60, 8, { color: INK.red, petal: INK.gold });
      // stretcher bar along the floor
    }
    leather(ctx, poly(ribbon([[70, TH - 30], [TW - 70, TH - 30]], 2.6)));
    dotLine(ctx, [[84, TH - 30], [TW - 84, TH - 30]], { spacing: 4, r: 0.55, seed: sd(), smoothIt: false });
    // apron under the top: gold band with a krajang-like scallop
    const apron = [[14, TOP + 6], [TW - 14, TOP + 6], [TW - 18, TOP + 18], [TW - 30, TOP + 22], [30, TOP + 22], [18, TOP + 18]];
    const ai = panel(ctx, apron, { color: INK.crimson, border: 1.8, r: 0.6, seed: sd() });
    void ai;
    for (let x = 42; x < TW - 36; x += 16) {
      const p = new Path2D();
      p.arc(x, TOP + 22, 5.5, 0, Math.PI);
      leather(ctx, p, { edge: false });
      dye(ctx, p, INK.gold, 0.9);
      hole(ctx, x, TOP + 24, 1.1);
    }
    // the playing top: a green slab with the white edge line
    const top = [[0, TOP], [TW, TOP], [TW, TOP + 8], [0, TOP + 8]];
    leather(ctx, poly(top));
    dye(ctx, poly([[1, TOP + 1], [TW - 1, TOP + 1], [TW - 1, TOP + 7], [1, TOP + 7]]), INK.green, 0.95);
    line(ctx, [[1, TOP + 1.4], [TW - 1, TOP + 1.4]], INK.white, 1.4, { smoothIt: false });
    line(ctx, [[1, TOP + 6.6], [TW - 1, TOP + 6.6]], INK.goldLine, 0.6, { smoothIt: false });
    dotLine(ctx, [[6, TOP + 4], [TW - 6, TOP + 4]], { spacing: 5, r: 0.6, seed: sd(), smoothIt: false });
    // net: posts + a mesh panel (the mesh holes let the lamp through)
    const nx = TW / 2;
    for (const px of [nx - 7, nx + 7]) {
      const post = [[px - 1.6, TOP - NET_H - 3], [px + 1.6, TOP - NET_H - 3], [px + 1.6, TOP + 6], [px - 1.6, TOP + 6]];
      leather(ctx, poly(post));
      dye(ctx, poly(inset(post, 0.5)), INK.gold, 0.9);
      leather(ctx, poly(ellipsePts(px, TOP - NET_H - 3, 2.4, 2.4, 10)));
    }
    const mesh = [[nx - 6, TOP - NET_H], [nx + 6, TOP - NET_H], [nx + 6, TOP], [nx - 6, TOP]];
    leather(ctx, poly(mesh));
    dye(ctx, poly(mesh), INK.indigo, 0.5);
    dotFill(ctx, poly(inset(mesh, 0.6)), [nx - 6, TOP - NET_H + 4, nx + 6, TOP], { pattern: 'grid', spacing: 2.6, r: 0.8, jitter: 0, seed: sd() });
    // white tape along the top of the net
    const tape = [[nx - 6.5, TOP - NET_H - 0.5], [nx + 6.5, TOP - NET_H - 0.5], [nx + 6.5, TOP - NET_H + 3], [nx - 6.5, TOP - NET_H + 3]];
    leather(ctx, poly(tape));
    dye(ctx, poly(tape), INK.white, 0.95);
  }, { name: 'games/pingpong-table', pad: 6 });
}

function paddleSprite(rubber, name) {
  return paintSprite(46, 84, (ctx, { rng }) => {
    const sd = () => (rng() * 1e6) | 0;
    const cx = 23, cy = 25;
    // handle: flared turned wood
    const hc = curve([[cx, 44], [cx, 60], [cx, 82]], false, 6);
    const hw = (t) => 4 + Math.sin(t * Math.PI) * 0.8 + t * 1.6;
    const H = ribbon(hc, hw);
    leather(ctx, poly(H));
    dye(ctx, poly(inset(H, 0.9)), '#9a5a26', 0.9);
    ctx.save();
    ctx.clip(poly(inset(H, 1)));
    for (let y = 56; y < 82; y += 3) slit(ctx, [[cx - 6, y + 1.4], [cx + 6, y - 1.4]], 0.45, { smoothIt: false });
    ctx.restore();
    for (const y of [50, 81]) {
      const c = [[cx - 5.5, y - 1.5], [cx + 5.5, y - 1.5], [cx + 5.5, y + 1.5], [cx - 5.5, y + 1.5]];
      leather(ctx, poly(c)); dye(ctx, poly(inset(c, 0.5)), INK.gold, 0.95);
    }
    // blade
    const B = ellipsePts(cx, cy, 21, 23.5, 44);
    leather(ctx, poly(B));
    const inner = inset(B, 2.2);
    dye(ctx, poly(inner), rubber, 0.95);
    gold(ctx, inner, 0.6, { closed: true, smoothIt: false });
    dotLine(ctx, inset(B, 1.1), { closed: true, spacing: 3, r: 0.55, seed: sd(), smoothIt: false });
    // pimpled rubber: a fine hex of pin-pricks
    dotFill(ctx, poly(inset(B, 5)), [cx - 20, cy - 22, cx + 20, cy + 22], { pattern: 'hex', spacing: 3.6, r: 0.42, jitter: 0.05, seed: sd() });
    // throat piece where the blade meets the handle
    const th = [[cx - 7, 44], [cx - 4, 39], [cx + 4, 39], [cx + 7, 44], [cx + 4.5, 51], [cx - 4.5, 51]];
    leather(ctx, poly(th));
    dye(ctx, poly(inset(th, 0.8)), INK.gold, 0.9);
    hole(ctx, cx, 45, 1.2);
  }, { name, pad: 4 });
}

function ppBallSprite() {
  return paintSprite(14, 14, (ctx) => {
    const c = poly(ellipsePts(7, 7, 7, 7, 24));
    leather(ctx, c);
    dye(ctx, c, INK.cream, 0.95);
    dye(ctx, poly(ellipsePts(5.6, 5.4, 3.6, 3.2, 16)), INK.white, 0.9);
    hole(ctx, 8.6, 8.4, 0.8); // a pin-prick "logo" star
    line(ctx, ellipsePts(7, 7, 6.4, 6.4, 24), INK.leather, 0.8, { closed: true });
  }, { name: 'games/pingpong-ball', pad: 2 });
}

// ------------------------------------------------------------ กระโดดเชือก
const HANDLE = { w: 14, h: 46, grip: [7, 30], tip: [7, 3] };

function drawHandle(ctx, x0, y0, sd, color = INK.red) {
  // a turned wooden handle, rope end at the top
  const c = curve([[x0 + 7, y0 + 4], [x0 + 7, y0 + 24], [x0 + 7, y0 + 44]], false, 8);
  const hw = (t) => 3.4 + Math.sin(t * Math.PI) * 1.6 + (t > 0.85 ? (t - 0.85) * 12 : 0);
  const H = ribbon(c, hw);
  leather(ctx, poly(H));
  dye(ctx, poly(inset(H, 0.8)), color, 0.9);
  gold(ctx, inset(H, 0.8), 0.45, { closed: true, smoothIt: false });
  for (const y of [y0 + 9, y0 + 38]) {
    const k = [[x0 + 1.6, y - 1.4], [x0 + 12.4, y - 1.4], [x0 + 12.4, y + 1.4], [x0 + 1.6, y + 1.4]];
    leather(ctx, poly(k)); dye(ctx, poly(inset(k, 0.5)), INK.gold, 0.95);
  }
  dotLine(ctx, [[x0 + 7, y0 + 13], [x0 + 7, y0 + 34]], { spacing: 3, r: 0.6, seed: sd(), smoothIt: false });
  // brass cap where the rope goes in
  leather(ctx, poly(ellipsePts(x0 + 7, y0 + 3, 3.4, 2.6, 12)));
  dye(ctx, poly(ellipsePts(x0 + 7, y0 + 3, 2.6, 1.8, 12)), INK.gold, 0.95);
}

function ropeSprite() {
  return paintSprite(170, 120, (ctx, { rng }) => {
    const sd = () => (rng() * 1e6) | 0;
    // the rope drooping between the two handle tips, twisted jute
    const A = [22, 50], B = [148, 50];
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push([A[0] + (B[0] - A[0]) * t - Math.sin(t * TAU) * 16, A[1] + Math.sin(t * Math.PI) * 64 + Math.sin(t * TAU * 2) * 3]);
    }
    const R = ribbon(pts, 2.2);
    leather(ctx, poly(R));
    dye(ctx, poly(R), INK.yellow, 0.55);
    // twist: short slanted slits along the rope
    for (let i = 1; i < pts.length - 1; i++) {
      for (let s = 0; s < 3; s++) {
        const u = s / 3;
        const p = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u];
        const d = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) + 0.9;
        slit(ctx, [[p[0] - Math.cos(d) * 1.8, p[1] - Math.sin(d) * 1.8], [p[0] + Math.cos(d) * 1.8, p[1] + Math.sin(d) * 1.8]], 0.4, { smoothIt: false });
      }
    }
    // handles stand up out of the rope ends, splayed a little
    for (const [P, ang] of [[A, Math.PI + 0.35], [B, Math.PI - 0.35]]) {
      ctx.save();
      ctx.translate(P[0], P[1]);
      ctx.rotate(ang);
      drawHandle(ctx, -7, -3, sd);
      ctx.restore();
    }
  }, { name: 'games/jump-rope', pad: 5 });
}

function handleSprite() {
  return paintSprite(HANDLE.w, HANDLE.h, (ctx, { rng }) => {
    drawHandle(ctx, 0, 0, () => (rng() * 1e6) | 0);
  }, { name: 'games/jump-rope-handle', pad: 3 });
}

// ------------------------------------------------------------ defs
export const PROPS = [
  {
    id: 'takraw', name: 'ลูกตะกร้อ', en: 'Takraw ball (woven rattan)', cat: 'games',
    build() {
      const R = 22;
      return { sprite: takrawSprite(R), grip: [R + 1, R + 1], mass: 0.12, ball: { r: R, e: 0.74, drag: 0.12, spin: 0.5, kind: 'takraw' } };
    },
  },
  {
    id: 'pingpong-table', name: 'โต๊ะปิงปอง', en: 'Ping-pong table', cat: 'games',
    build() {
      // surfaces in box coords (the behaviour module turns them into world segments)
      return {
        sprite: tableSprite(), static: true, mass: 20,
        table: { top: [[2, TOP], [TW - 2, TOP]], net: [[TW / 2, TOP - NET_H - 1], [TW / 2, TOP]], legs: [[[56, TOP + 14], [40, TH - 6]], [[TW - 56, TOP + 14], [TW - 40, TH - 6]]], e: 0.88 },
      };
    },
  },
  {
    id: 'pingpong-paddle', name: 'ไม้ปิงปอง (แดง)', en: 'Ping-pong paddle (red)', cat: 'games',
    build() {
      return { sprite: paddleSprite(INK.red, 'games/paddle-red'), grip: [23, 68], weapon: { kind: 'blunt', a: [23, 72], b: [23, 6] }, mass: 0.35, paddle: { blade: [23, 25, 22], e: 0.8 } };
    },
  },
  {
    id: 'pingpong-paddle-blue', name: 'ไม้ปิงปอง (คราม)', en: 'Ping-pong paddle (indigo)', cat: 'games',
    build() {
      return { sprite: paddleSprite(INK.indigo, 'games/paddle-blue'), grip: [23, 68], weapon: { kind: 'blunt', a: [23, 72], b: [23, 6] }, mass: 0.35, paddle: { blade: [23, 25, 22], e: 0.8 } };
    },
  },
  {
    id: 'pingpong-ball', name: 'ลูกปิงปอง', en: 'Ping-pong ball', cat: 'games',
    build() {
      return { sprite: ppBallSprite(), mass: 0.02, ball: { r: 7, e: 0.9, drag: 0.35, spin: 1, kind: 'pingpong' } };
    },
  },
  {
    id: 'jump-rope', name: 'เชือกกระโดด', en: 'Jump rope (hand it to a puppet)', cat: 'games',
    build() {
      return { sprite: ropeSprite(), grip: [16, 26], mass: 0.4, rope: { handle: handleSprite(), grip: HANDLE.grip, tip: HANDLE.tip, segs: 16 } };
    },
  },
];
