// Scenery set pieces: Thai buildings cut from hide (หนังตะลุง ฉาก).
//
// Real Nang Talung scenery is a big, mostly near-black sheet of leather
// punched with rows of dots that follow every contour, lattice windows cut
// right through, roof tiles as scales, and a few panels of translucent dye
// (vermilion, green, gold) that glow when the lamp is behind the screen.
//
// The small architectural toolkit at the top (gables with ช่อฟ้า / ใบระกา
// / หางหงส์, lotus mouldings, columns, lattice, lace) is shared with the
// other scenery modules (boats, nature, vehicles).

import {
  INK, paintSprite, leather, dye, line, gold, hole, holes, dotLine, dotFill, slit, cut,
  poly, curve, smooth, ellipsePts, blobPts, inset, rng, kanokPts, krajangPath, prajamYam, dotFlower,
} from '../art/leather.js';

// =================================================================== kit
export const TAU = Math.PI * 2;
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
export const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// Subdivide a polygon and nudge the new points along the edge normal with
// smooth noise, so long straight cuts look knife-cut rather than ruled.
// Original vertices stay put (sharp corners survive).
export function hand(pts, amp = 0.6, seed = 1, step = 7, closed = true) {
  const r = rng(seed);
  const ph = [r() * TAU, r() * TAU, r() * TAU];
  const out = [];
  const n = pts.length;
  let s = 0;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const L = dist(a, b) || 1;
    const k = Math.max(1, Math.ceil(L / step));
    const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
    for (let j = 0; j < k; j++) {
      const t = j / k;
      const d = j === 0 ? 0 : amp * (Math.sin(s * 0.19 + ph[0]) * 0.5 + Math.sin(s * 0.061 + ph[1]) * 0.35 + Math.sin(s * 0.83 + ph[2]) * 0.15);
      out.push([a[0] + (b[0] - a[0]) * t + nx * d, a[1] + (b[1] - a[1]) * t + ny * d]);
      s += L / k;
    }
  }
  if (!closed) out.push(pts[n - 1].slice());
  return out;
}

// Offset an open polyline sideways (+d = right-hand side of travel).
export function offsetLine(pts, d) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const l = dist(a, b) || 1;
    return [p[0] - ((b[1] - a[1]) / l) * d, p[1] + ((b[0] - a[0]) / l) * d];
  });
}

// A stroke of varying width as a closed outline (branches, horns, oars,
// fronds...). w may be a number pair or a function of t in [0,1].
export function taper(pts, w0, w1 = w0, { smoothIt = true, steps = 8 } = {}) {
  const c = smoothIt && pts.length > 2 ? curve(pts, false, steps) : pts;
  const n = c.length;
  const acc = [0];
  for (let i = 1; i < n; i++) acc.push(acc[i - 1] + dist(c[i - 1], c[i]));
  const total = acc[n - 1] || 1;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)];
    const l = dist(a, b) || 1;
    const tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
    const t = acc[i] / total;
    const w = (typeof w0 === 'function' ? w0(t) : lerp(w0, w1, t)) / 2;
    L.push([c[i][0] - ty * w, c[i][1] + tx * w]);
    R.push([c[i][0] + ty * w, c[i][1] - tx * w]);
  }
  return [...L, ...R.reverse()];
}

export function arcPts(cx, cy, rx, ry, a0, a1, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n);
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

export function spiral(cx, cy, r0, r1, a0, turns, n = 40) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + turns * TAU * t;
    const r = lerp(r0, r1, Math.pow(t, 0.85));
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

// Hide shapes. `hide` = polygon (keeps corners), `hideS` = smoothed.
export const hide = (ctx, pts, amp = 0.5, seed = 1) => leather(ctx, poly(amp ? hand(pts, amp, seed) : pts));
export const hideS = (ctx, pts) => leather(ctx, smooth(pts));
export function hideMany(ctx, list, smoothIt = false) {
  const p = new Path2D();
  for (const pts of list) p.addPath(smoothIt ? smooth(pts) : poly(pts));
  leather(ctx, p);
  return p;
}

// Perforation row following a closed contour, d units inside it.
export function rimDots(ctx, pts, d = 3, o = {}) {
  return dotLine(ctx, inset(pts, d), { closed: true, smoothIt: false, spacing: 4.2, r: 1.05, ...o });
}
// ... and along an open line, offset d sideways.
export function edgeDots(ctx, pts, d = 0, o = {}) {
  return dotLine(ctx, d ? offsetLine(pts, d) : pts, { spacing: 4.2, r: 1.05, ...o });
}

// Decorated panel: dye inset d, gold border, dot row inside the border.
export function panel(ctx, pts, { color = INK.red, alpha = 0.88, d = 2.5, gw = 1.1, dotD = 3.4, spacing = 4, r = 0.95, dots = true, goldIt = true, seed = 3 } = {}) {
  const inner = inset(pts, d);
  if (color) dye(ctx, poly(inner), color, alpha);
  if (goldIt) gold(ctx, inner, gw, { closed: true, smoothIt: false });
  if (dots) rimDots(ctx, inner, dotD, { spacing, r, seed });
  return inner;
}

// Cut-through lattice (ช่องลม / หน้าต่างลูกกรง). kind: diamond | grid | bars | cross
export function lattice(ctx, x, y, w, h, { cell = 8, bar = 2, kind = 'diamond' } = {}) {
  const p = new Path2D();
  if (kind === 'bars') {
    const n = Math.max(1, Math.round(w / cell));
    const cw = w / n;
    for (let i = 0; i < n; i++) p.rect(x + i * cw + bar / 2, y, cw - bar, h);
  } else if (kind === 'grid') {
    const nx = Math.max(1, Math.round(w / cell)), ny = Math.max(1, Math.round(h / cell));
    const cw = w / nx, ch = h / ny;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) p.rect(x + i * cw + bar / 2, y + j * ch + bar / 2, cw - bar, ch - bar);
  } else {
    const nx = Math.max(1, Math.round(w / cell)), ny = Math.max(1, Math.round(h / cell));
    const cw = w / nx, ch = h / ny;
    const hx = cw / 2 - bar * 0.75, hy = ch / 2 - bar * 0.75;
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
      for (const [ox, oy] of kind === 'cross' ? [[0, 0]] : [[0, 0], [0.5, 0.5]]) {
        const cx = x + (i + ox) * cw, cy = y + (j + oy) * ch;
        p.moveTo(cx, cy - hy); p.lineTo(cx + hx, cy); p.lineTo(cx, cy + hy); p.lineTo(cx - hx, cy); p.closePath();
      }
    }
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(p);
  ctx.restore();
}

// Pointed petal (กลีบบัว / กลีบขนุน) as a Path2D; base centred at x,y.
export function petalPts(x, y, w, h, ang = -Math.PI / 2) {
  const c = Math.cos(ang + Math.PI / 2), s = Math.sin(ang + Math.PI / 2);
  const T = ([px, py]) => [x + px * c - py * s, y + px * s + py * c];
  return curve([[-w / 2, 0], [-w * 0.5, -h * 0.4], [-w * 0.26, -h * 0.8], [0, -h], [w * 0.26, -h * 0.8], [w * 0.5, -h * 0.4], [w / 2, 0]].map((p) => [p[0], p[1]]), false, 6).map(T);
}

// A row of lotus petals painted on a moulding (บัวหงาย up, บัวคว่ำ down).
// With `edge`, the petal tips also cut the silhouette (added as hide).
export function lotusBand(ctx, x0, x1, y, h, { up = true, w = h * 0.78, colors = [INK.green, INK.vermilion], edge = false, holesIt = true, seed = 1, gw = 0.8 } = {}) {
  const n = Math.max(2, Math.round((x1 - x0) / (w * 0.92)));
  const step = (x1 - x0) / n;
  const ang = up ? -Math.PI / 2 : Math.PI / 2;
  const list = [];
  for (let i = 0; i <= n; i++) list.push(petalPts(x0 + i * step, y, w, h, ang));
  if (edge) hideMany(ctx, list);
  list.forEach((pts, i) => {
    dye(ctx, poly(pts), colors[i % colors.length], 0.86);
    gold(ctx, pts, gw, { closed: true, smoothIt: false });
    const cx = x0 + i * step;
    gold(ctx, petalPts(cx, y, w * 0.5, h * 0.62, ang), gw * 0.8, { closed: true, smoothIt: false });
    if (holesIt) hole(ctx, cx, y + (up ? -1 : 1) * h * 0.38, Math.max(0.8, h * 0.085));
  });
}

// A moulding band across (x0..x1, y0..y1): hide, gold edges, dot rows.
export function moulding(ctx, x0, y0, x1, y1, { color = null, dots = 2, r = 1, seed = 2, slope = 0 } = {}) {
  const pts = [[x0 + slope, y0], [x1 - slope, y0], [x1, y1], [x0, y1]];
  hide(ctx, pts, 0.4, seed);
  if (color) dye(ctx, poly(inset(pts, 1.6)), color, 0.85);
  gold(ctx, [[x0 + slope + 1, y0 + 1.2], [x1 - slope - 1, y0 + 1.2]], 1, { smoothIt: false });
  gold(ctx, [[x0 + 1, y1 - 1.2], [x1 - 1, y1 - 1.2]], 1, { smoothIt: false });
  const hh = y1 - y0;
  for (let k = 0; k < dots; k++) {
    const yy = y0 + (hh * (k + 1)) / (dots + 1);
    dotLine(ctx, [[x0 + 3, yy], [x1 - 3, yy]], { spacing: 4.2, r, seed: seed + k, smoothIt: false });
  }
  return pts;
}

// ใบระกา — a row of flame fins standing on one side of a->b, leaning
// toward b. side: +1 = right-hand side of travel.
export function finRow(ctx, a, b, size, { side = -1, lean = 0.75, gap = 0.5, seed = 1, punch = true, from = 0, to = 1 } = {}) {
  const r = rng(seed);
  const L = dist(a, b);
  const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  const nx = -uy * side, ny = ux * side;
  const n = Math.max(1, Math.floor((L * (to - from)) / (size * gap)));
  const aN = Math.atan2(ny, nx);
  // rotate the normal toward travel direction
  const cross = nx * uy - ny * ux;
  const ang = aN + (cross > 0 ? lean : -lean);
  const lx = Math.cos(ang + Math.PI / 2), ly = Math.sin(ang + Math.PI / 2);
  const flip = lx * ux + ly * uy < 0;
  const list = [];
  const tips = [];
  for (let i = 0; i < n; i++) {
    const t = from + ((to - from) * (i + 0.5)) / n;
    const s = size * (0.9 + r() * 0.2);
    const bx = a[0] + (b[0] - a[0]) * t - nx * s * 0.15, by = a[1] + (b[1] - a[1]) * t - ny * s * 0.15;
    list.push(kanokPts(bx, by, s, ang + (r() - 0.5) * 0.08, flip));
    tips.push([bx + Math.cos(ang) * s * 0.42, by + Math.sin(ang) * s * 0.42, s]);
  }
  hideMany(ctx, list);
  if (punch) for (const [x, y, s] of tips) hole(ctx, x, y, Math.max(0.75, s * 0.09));
  return list;
}

// ช่อฟ้า — the slender bird-headed horn at a gable apex.
export function chofa(ctx, x, y, h, { dir = 1, w = 7, color = INK.gold } = {}) {
  const sp = [[x, y + h * 0.04], [x + dir * h * 0.015, y - h * 0.42], [x + dir * h * 0.07, y - h * 0.74], [x + dir * h * 0.17, y - h * 0.93], [x + dir * h * 0.3, y - h * 1.0], [x + dir * h * 0.42, y - h * 0.96]];
  const pts = taper(sp, (t) => w * (t < 0.72 ? 1 - t * 0.9 : 0.35 + (t - 0.72) * 0.6 - Math.max(0, t - 0.86) * 4.2) + 0.4);
  hide(ctx, pts, 0, 0);
  // throat flame at the base
  hideMany(ctx, [kanokPts(x - dir * w * 0.2, y - h * 0.18, h * 0.24, -Math.PI / 2 - dir * 0.5, dir < 0)]);
  const c = curve(sp, false, 8);
  dye(ctx, poly(pts), color, 0.55);
  gold(ctx, c.slice(2, Math.floor(c.length * 0.8)), 0.8);
  hole(ctx, ...mix(sp[3], sp[4], 0.5), Math.max(0.8, w * 0.12));
  return pts;
}

// หางหงส์ — the upturned curl at the lower end of a bargeboard, pointing
// outward (dir) and up, with little fins along its back.
export function hangHong(ctx, x, y, s, { dir = 1, w = 8, color = INK.gold } = {}) {
  const sp = [[x - dir * s * 0.3, y - s * 0.32], [x, y], [x + dir * s * 0.3, y + s * 0.1], [x + dir * s * 0.58, y - s * 0.05], [x + dir * s * 0.66, y - s * 0.38], [x + dir * s * 0.56, y - s * 0.62]];
  const pts = taper(sp, (t) => w * (1 - t * 0.85) + 0.5);
  hide(ctx, pts, 0, 0);
  const c = curve(sp, false, 8);
  finRow(ctx, c[Math.floor(c.length * 0.5)], c[c.length - 3], s * 0.26, { side: dir > 0 ? -1 : 1, lean: 0.4, gap: 0.55, seed: 5 });
  dye(ctx, poly(pts), color, 0.5);
  gold(ctx, c.slice(1, -3), 0.8);
  hole(ctx, ...c[Math.floor(c.length * 0.62)], Math.max(0.8, w * 0.12));
  return pts;
}

// Kanok scroll: a spiral stem with flame leaves along it, painted and
// punched. Used in gable panels and lace.
export function kanokScroll(ctx, cx, cy, r, { a0 = 0, turns = 1.1, dir = 1, color = INK.gold, leaf = INK.green, w = 1.3, seed = 1, leaves = 5, dots = true } = {}) {
  const sp = spiral(cx, cy, r, r * 0.12, a0, turns * dir, 36);
  gold(ctx, sp, w);
  const rr = rng(seed);
  for (let i = 1; i <= leaves; i++) {
    const k = Math.floor((i / (leaves + 1)) * (sp.length - 4));
    const p = sp[k], q = sp[k + 2];
    const tang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const out = tang - dir * Math.PI / 2 - dir * 0.6;
    const s = r * (0.45 - (i / leaves) * 0.25) * (0.9 + rr() * 0.2);
    const lp = kanokPts(p[0], p[1], s, out, dir < 0);
    dye(ctx, poly(lp), leaf, 0.8);
    gold(ctx, lp, w * 0.6, { closed: true, smoothIt: false });
  }
  if (dots) edgeDots(ctx, sp.slice(0, -6), -w * 2.4 * dir, { spacing: 3.6, r: 0.8, seed, smoothIt: false });
  hole(ctx, sp[sp.length - 1][0], sp[sp.length - 1][1], Math.max(0.8, r * 0.08));
  return sp;
}

// A full Thai gable end (หน้าจั่ว): panel + ลำยอง bargeboards with ใบระกา,
// ช่อฟ้า on top and หางหงส์ at both feet.
export function thaiGable(ctx, cx, yA, yB, hw, { board = 9, fin = 12, chofaH = 60, hhS = 34, panelColor = INK.red, motif = 'scroll', seed = 1, tone = 'gold', inner = true, hh = true, ch = true } = {}) {
  const A = [cx, yA], L = [cx - hw, yB], Rr = [cx + hw, yB];
  // bargeboards as one chevron slightly outside the panel
  const outA = [cx, yA - board * 1.2];
  const outL = [cx - hw - board * 0.9, yB + board * 0.25], outR = [cx + hw + board * 0.9, yB + board * 0.25];
  const chev = [outA, outR, [Rr[0] - board * 0.1, yB], A, [L[0] + board * 0.1, yB], outL];
  // fins first (they sit behind the board)
  finRow(ctx, outL, outA, fin, { side: -1, seed: seed + 1, to: 0.97 });
  finRow(ctx, outA, outR, fin, { side: -1, seed: seed + 2, from: 0.03 });
  hide(ctx, [A, L, Rr], 0.3, seed);
  hide(ctx, chev, 0.4, seed + 3);
  // gable panel
  const tri = [[cx, yA + board * 0.6], [cx + hw - board * 0.5, yB - 2], [cx - hw + board * 0.5, yB - 2]];
  if (inner) {
    const pi = inset(tri, 2.5);
    if (panelColor) dye(ctx, poly(pi), panelColor, 0.86);
    gold(ctx, pi, 1.2, { closed: true, smoothIt: false });
    rimDots(ctx, pi, 3.4, { spacing: 4, r: 0.95, seed: seed + 4 });
    const H = yB - yA;
    if (motif === 'scroll') {
      const my = yA + H * 0.64, rr = Math.min(hw * 0.2, H * 0.17);
      // central medallion
      prajamYam(ctx, cx, my, rr * 0.9, { color: INK.red, petal: INK.gold });
      for (const d of [-1, 1]) {
        kanokScroll(ctx, cx + d * rr * 1.9, my + rr * 0.2, rr * 0.9, { dir: -d, a0: d > 0 ? Math.PI : 0, seed: seed + 7 + d });
        if (hw > 90) kanokScroll(ctx, cx + d * rr * 3.5, my + rr * 0.5, rr * 0.6, { dir: -d, a0: d > 0 ? Math.PI * 0.8 : Math.PI * 0.2, seed: seed + 9 + d, leaves: 3 });
      }
      kanokScroll(ctx, cx, my - rr * 2.1, rr * 0.55, { dir: 1, a0: Math.PI / 2, seed: seed + 11, leaves: 3 });
    } else if (motif === 'sun') {
      sunburst(ctx, cx, yB - 4, tri, { seed });
    }
    // krajang teeth along the base
  }
  // board decoration: gold line + dots along the middle of each board
  for (const [p, q] of [[mix(outL, L, 0.5), mix(outA, A, 0.5)], [mix(outA, A, 0.5), mix(outR, Rr, 0.5)]]) {
    dye(ctx, poly(taper([p, q], board * 0.7)), tone === 'gold' ? INK.gold : INK.vermilion, 0.45);
    gold(ctx, [p, q], 0.9, { smoothIt: false });
    edgeDots(ctx, [p, q], 0, { spacing: 4.4, r: 1.05, seed: seed + 5, smoothIt: false });
  }
  if (ch) chofa(ctx, cx, outA[1] + board * 0.4, chofaH, { dir: 1, w: board * 0.85 });
  if (hh) {
    hangHong(ctx, outL[0] + board * 0.2, outL[1], hhS, { dir: -1, w: board * 0.9 });
    hangHong(ctx, outR[0] - board * 0.2, outR[1], hhS, { dir: 1, w: board * 0.9 });
  }
  return { tri, outL, outR, outA };
}

// Radiating slats of a Thai house gable (จั่วรัศมี / ใบปรือ).
export function sunburst(ctx, cx, cy, tri, { n = 13, seed = 1 } = {}) {
  ctx.save();
  ctx.clip(poly(inset(tri, 5)));
  const R = 600;
  const halfCircle = new Path2D();
  halfCircle.arc(cx, cy, 16, Math.PI, TAU);
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + (i / n) * Math.PI, a1 = Math.PI + ((i + 1) / n) * Math.PI;
    const ray = poly([[cx, cy], [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R], [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R]]);
    if (i % 2 === 0) dye(ctx, ray, INK.vermilion, 0.8);
    else dye(ctx, ray, INK.gold, 0.55);
    const am = (a0 + a1) / 2;
    const s = [];
    for (let d = 26; d < 300; d += 6.5) s.push([cx + Math.cos(am) * d, cy + Math.sin(am) * d]);
    holes(ctx, s, 1.05);
    slit(ctx, [[cx + Math.cos(a0) * 20, cy + Math.sin(a0) * 20], [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R]], 1.1, { smoothIt: false });
  }
  ctx.restore();
  dye(ctx, halfCircle, INK.gold, 0.9);
  gold(ctx, arcPts(cx, cy, 16, 16, Math.PI, TAU, 16), 1.2);
  dotFlower(ctx, cx, cy - 7, 1, 5, 2.6);
}

// Column with lotus capital and base (เสา + บัวหัวเสา).
export function column(ctx, x, yTop, yBot, w, { cap = true, base = true, color = null, seed = 1, taperK = 0.88 } = {}) {
  const wt = w * taperK;
  const shaft = [[x - wt / 2, yTop], [x + wt / 2, yTop], [x + w / 2, yBot], [x - w / 2, yBot]];
  hide(ctx, shaft, 0.35, seed);
  if (color) dye(ctx, poly(inset(shaft, w * 0.2)), color, 0.75);
  gold(ctx, inset(shaft, w * 0.14), 0.8, { closed: true, smoothIt: false });
  dotLine(ctx, [[x, yTop + w * 1.2], [x, yBot - w * 0.8]], { spacing: 4.2, r: Math.min(1.1, w * 0.1), seed, smoothIt: false });
  if (cap) {
    const ch = w * 1.1;
    const cp = [[x - wt / 2, yTop + ch * 0.2], [x - wt * 0.95, yTop - ch * 0.5], [x - wt * 0.7, yTop - ch], [x + wt * 0.7, yTop - ch], [x + wt * 0.95, yTop - ch * 0.5], [x + wt / 2, yTop + ch * 0.2]];
    hideS(ctx, cp);
    for (let k = -1; k <= 1; k++) {
      const pp = petalPts(x + k * wt * 0.45, yTop + ch * 0.1, wt * 0.5, ch * 0.95);
      dye(ctx, poly(pp), k ? INK.green : INK.vermilion, 0.8);
      gold(ctx, pp, 0.6, { closed: true, smoothIt: false });
    }
  }
  if (base) {
    const bh = w * 0.8;
    hide(ctx, [[x - w * 0.65, yBot - bh], [x + w * 0.65, yBot - bh], [x + w * 0.75, yBot], [x - w * 0.75, yBot]], 0.2, seed + 1);
    gold(ctx, [[x - w * 0.6, yBot - bh * 0.5], [x + w * 0.6, yBot - bh * 0.5]], 0.8, { smoothIt: false });
  }
  return shaft;
}

// สาหร่ายรวงผึ้ง — lace valance hanging between two columns under a beam.
export function valance(ctx, x0, x1, y, h, { seed = 1, color = INK.gold } = {}) {
  const w = x1 - x0;
  const n = Math.max(3, Math.round(w / 22));
  const top = [[x1, y], [x0, y]];
  const bot = [];
  for (let i = 0; i <= n * 4; i++) {
    const t = i / (n * 4);
    const px = x0 + w * t;
    const sc = Math.abs(Math.sin(t * n * Math.PI));
    const drop = h * (0.55 + 0.45 * Math.sin(t * Math.PI)) * (0.75 + 0.25 * sc);
    bot.push([px, y + drop]);
  }
  const pts = [...top, ...bot];
  hideS(ctx, pts);
  // pendant tip
  hideMany(ctx, [kanokPts(x0 + w / 2 - 4, y + h * 0.95, h * 0.45, Math.PI / 2, false), kanokPts(x0 + w / 2 + 4, y + h * 0.95, h * 0.45, Math.PI / 2, true)]);
  dye(ctx, smooth(inset(pts, 3)), color, 0.4);
  // lace: rows of cut teardrops + dot flowers
  ctx.save();
  ctx.clip(smooth(inset(pts, 3.5)));
  const r = rng(seed);
  const p = new Path2D();
  for (let yy = y + 5, row = 0; yy < y + h * 1.1; yy += 7, row++) {
    for (let xx = x0 + 4 + (row % 2) * 4.5; xx < x1; xx += 9) {
      const q = 2.1 + r() * 0.4;
      p.moveTo(xx, yy - q * 1.4);
      p.quadraticCurveTo(xx + q, yy, xx, yy + q);
      p.quadraticCurveTo(xx - q, yy, xx, yy - q * 1.4);
    }
  }
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(p);
  ctx.restore();
  gold(ctx, [[x0 + 2, y + 2], [x1 - 2, y + 2]], 1, { smoothIt: false });
  rimDots(ctx, pts, 1.8, { spacing: 3.4, r: 0.75, seed: seed + 3 });
}

// คันทวย — S-shaped eave bracket from a column (x,y0) out to (x+dir*w, y1).
export function kantuay(ctx, x, y0, y1, w, dir = 1, { seed = 1 } = {}) {
  const sp = [[x, y1 + (y0 - y1) * 0.05], [x + dir * w * 0.1, y1 - (y1 - y0) * 0.45], [x + dir * w * 0.55, y0 + (y1 - y0) * 0.15], [x + dir * w, y0]];
  const pts = taper(sp, (t) => 5 + Math.sin(t * Math.PI) * 5);
  hideS(ctx, pts);
  const c = curve(sp, false, 8);
  gold(ctx, c, 0.8);
  finRow(ctx, c[2], c[c.length - 3], 7, { side: dir > 0 ? 1 : -1, lean: 0.5, gap: 0.6, seed });
  hole(ctx, ...c[Math.floor(c.length * 0.4)], 1);
}

// นาค — serpent balustrade down a stair, raised multi-headed hood at the foot.
export function nagaRail(ctx, top, foot, s, dir = 1, { seed = 1, color = INK.green } = {}) {
  const [x0, y0] = top, [x1, y1] = foot;
  const hx = x1 + dir * s * 0.12, hy = y1 - s * 0.66;
  const body = [[x0, y0], [lerp(x0, x1, 0.35), lerp(y0, y1, 0.35) - s * 0.03], [lerp(x0, x1, 0.72), lerp(y0, y1, 0.72)], [x1 - dir * s * 0.02, y1 - s * 0.1], [x1 + dir * s * 0.12, y1 - s * 0.32], [hx, hy + s * 0.08]];
  const pts = taper(body, (t) => s * (0.17 - t * 0.05));
  hide(ctx, pts, 0, 0);
  // the raised hood: a fan of five heads, the middle one tallest
  const R = s * 0.34, n = 5, spread = 2.1, tilt = dir * 0.18;
  const rim = [[hx - R * 0.42, hy + R * 0.4]];
  const tips = [];
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 - spread / 2 + (spread * (k + 0.5)) / n + tilt;
    const a1 = a + spread / (2 * n);
    const rr = R * (1 - Math.abs(k - 2) * 0.07);
    if (k === 0) rim.push([hx + Math.cos(a - spread / (2 * n)) * R * 0.7, hy + Math.sin(a - spread / (2 * n)) * R * 0.7]);
    rim.push([hx + Math.cos(a - 0.12) * rr * 0.92, hy + Math.sin(a - 0.12) * rr * 0.92]);
    rim.push([hx + Math.cos(a) * rr * 1.08, hy + Math.sin(a) * rr * 1.08]);
    rim.push([hx + Math.cos(a + 0.12) * rr * 0.92, hy + Math.sin(a + 0.12) * rr * 0.92]);
    if (k < n - 1) rim.push([hx + Math.cos(a1) * rr * 0.74, hy + Math.sin(a1) * rr * 0.74]);
    else rim.push([hx + Math.cos(a1) * R * 0.7, hy + Math.sin(a1) * R * 0.7]);
    tips.push([a, rr]);
  }
  rim.push([hx + R * 0.42, hy + R * 0.4]);
  const hood = curve(rim, true, 5, 0.35);
  leather(ctx, poly(hood));
  // flame crest behind the heads
  const crest = kanokPts(hx - dir * R * 0.1, hy - R * 0.95, R * 0.7, -Math.PI / 2 + tilt, dir < 0);
  hideMany(ctx, [crest]);
  dye(ctx, poly(pts), color, 0.72);
  dye(ctx, poly(inset(hood, 2.2)), INK.gold, 0.72);
  dye(ctx, poly(crest), INK.vermilion, 0.7);
  gold(ctx, inset(hood, 2.2), 0.8, { closed: true, smoothIt: false });
  for (const [a, rr] of tips) {
    const ex = hx + Math.cos(a) * rr * 0.86, ey = hy + Math.sin(a) * rr * 0.86;
    hole(ctx, ex, ey, Math.max(0.8, s * 0.016));
    line(ctx, [[hx + Math.cos(a) * rr * 0.35, hy + Math.sin(a) * rr * 0.35], [hx + Math.cos(a) * rr * 0.7, hy + Math.sin(a) * rr * 0.7]], INK.leather, 1.2, { smoothIt: false });
  }
  const c = curve(body, false, 8);
  edgeDots(ctx, c.slice(1, -3), 0, { spacing: 3.6, r: Math.max(0.8, s * 0.014), seed, smoothIt: false });
  gold(ctx, offsetLine(c, s * 0.055 * dir), 0.8);
  dotLine(ctx, curve([[hx - R * 0.3, hy + R * 0.2], [hx, hy + R * 0.02], [hx + R * 0.3, hy + R * 0.2]], false, 6), { spacing: 3, r: 0.75, smoothIt: false });
}

// Scales / roof tiles punched into a region (arc slits in rows).
export function tiles(ctx, path, bbox, { w = 10, rowH = 7, lw = 1.1, color = null, seed = 1 } = {}) {
  const [x0, y0, x1, y1] = bbox;
  ctx.save();
  ctx.clip(path);
  if (color) { ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = 0.6; ctx.fillStyle = color; ctx.fill(path); ctx.globalAlpha = 1; }
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = lw;
  const p = new Path2D();
  for (let y = y0, row = 0; y < y1 + rowH; y += rowH, row++) {
    for (let x = x0 - w + (row % 2) * w * 0.5; x < x1 + w; x += w) {
      p.moveTo(x + w / 2, y);
      p.arc(x, y, w / 2, 0, Math.PI);
    }
  }
  ctx.stroke(p);
  ctx.restore();
}

// A tiny marigold / jasmine garland (พวงมาลัย) hanging from p.
export function garland(ctx, x, y, len, { seed = 1, color = INK.orange } = {}) {
  const loop = [[x - len * 0.22, y], [x - len * 0.25, y + len * 0.45], [x, y + len * 0.7], [x + len * 0.25, y + len * 0.45], [x + len * 0.22, y]];
  const pts = taper(loop, len * 0.12);
  hide(ctx, pts, 0, 0);
  const tassel = [[x - len * 0.07, y + len * 0.68], [x + len * 0.07, y + len * 0.68], [x + len * 0.1, y + len], [x - len * 0.1, y + len]];
  hide(ctx, tassel, 0, 0);
  dye(ctx, poly(pts), color, 0.9);
  dye(ctx, poly(tassel), INK.red, 0.85);
  const c = curve(loop, false, 8);
  holes(ctx, c.filter((_, i) => i % 3 === 0), Math.max(0.6, len * 0.035));
  hole(ctx, x, y + len * 0.73, Math.max(0.6, len * 0.05));
}

// Bai sema (ใบเสมา) boundary marker / merlon.
export function semaPts(x, y, w, h) {
  return curve([[x - w / 2, y], [x - w * 0.52, y - h * 0.45], [x - w * 0.3, y - h * 0.82], [x, y - h], [x + w * 0.3, y - h * 0.82], [x + w * 0.52, y - h * 0.45], [x + w / 2, y]], false, 5);
}

// Seated Buddha / figure silhouette in a niche (solid hide inside a cut).
export function seatedFigure(ctx, cx, yb, h, { halo = true, color = INK.gold } = {}) {
  const s = h;
  const body = [
    [cx - s * 0.46, yb], [cx - s * 0.44, yb - s * 0.14], [cx - s * 0.24, yb - s * 0.22], [cx - s * 0.2, yb - s * 0.52],
    [cx - s * 0.1, yb - s * 0.6], [cx - s * 0.1, yb - s * 0.66], [cx - s * 0.13, yb - s * 0.78], [cx - s * 0.06, yb - s * 0.9],
    [cx, yb - s * 1.0], [cx + s * 0.06, yb - s * 0.9], [cx + s * 0.13, yb - s * 0.78], [cx + s * 0.1, yb - s * 0.66],
    [cx + s * 0.1, yb - s * 0.6], [cx + s * 0.2, yb - s * 0.52], [cx + s * 0.24, yb - s * 0.22], [cx + s * 0.44, yb - s * 0.14], [cx + s * 0.46, yb],
  ];
  if (halo) {
    const hp = ellipsePts(cx, yb - s * 0.7, s * 0.24, s * 0.26, 24);
    hideS(ctx, hp);
    dye(ctx, smooth(hp), color, 0.5);
    rimDots(ctx, hp, 2.2, { spacing: 3.2, r: 0.75 });
  }
  hideS(ctx, body);
  dye(ctx, smooth(inset(body, 2)), color, 0.65);
  gold(ctx, [[cx - s * 0.36, yb - s * 0.1], [cx, yb - s * 0.16], [cx + s * 0.36, yb - s * 0.1]], 0.9);
  gold(ctx, [[cx - s * 0.16, yb - s * 0.5], [cx + s * 0.02, yb - s * 0.22], [cx + s * 0.2, yb - s * 0.5]], 0.8);
  rimDots(ctx, body, 2.2, { spacing: 3.2, r: 0.7, seed: 4 });
}

// A mottled "aged hide" pass: darkens dyes and leather unevenly so the
// colour looks hand-rubbed rather than flat. One fill per sprite.
let _ageTex = null;
function ageTexture() {
  if (_ageTex) return _ageTex;
  const S = 192;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const r = rng(99);
  const grid = (n) => {
    const a = new Float32Array(n * n).map(() => r());
    return (x, y) => {
      const fx = (x / S) * n, fy = (y / S) * n;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (i, j) => a[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
      return lerp(lerp(at(x0, y0), at(x0 + 1, y0), sx), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), sx), sy);
    };
  };
  const n1 = grid(4), n2 = grid(11), n3 = grid(37);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = n1(x, y) * 0.55 + n2(x, y) * 0.3 + n3(x, y) * 0.15;
    const i = (y * S + x) * 4;
    img.data[i] = 20; img.data[i + 1] = 10; img.data[i + 2] = 4;
    img.data[i + 3] = Math.max(0, Math.min(255, (v - 0.35) * 2.2 * 255));
  }
  g.putImageData(img, 0, 0);
  _ageTex = c;
  return c;
}
export function age(ctx, w, h, k = 0.35, pad = 40) {
  ctx.save();
  const pat = ctx.createPattern(ageTexture(), 'repeat');
  pat.setTransform(new DOMMatrix().scaleSelf(1.3, 1.3));
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = k;
  ctx.fillStyle = pat;
  ctx.fillRect(-pad, -pad, w + pad * 2, h + pad * 2);
  ctx.restore();
}

// Brick / block courses as knife slits.
export function bricks(ctx, clipPath, x0, y0, x1, y1, { bw = 16, bh = 7, lw = 0.9, dots = false, r = 0.8, seed = 1 } = {}) {
  if (dots) {
    ctx.save();
    ctx.clip(clipPath);
    const pts = [];
    for (let y = y0, row = 0; y < y1; y += bh, row++) {
      for (let x = x0; x < x1; x += r * 3.6) pts.push([x, y]);
      for (let x = x0 + (row % 2) * bw * 0.5; x < x1; x += bw) pts.push([x, y + bh * 0.5]);
    }
    holes(ctx, pts, r);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.clip(clipPath);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = lw;
  const p = new Path2D();
  for (let y = y0, row = 0; y < y1; y += bh, row++) {
    p.moveTo(x0, y); p.lineTo(x1, y);
    for (let x = x0 + (row % 2) * bw * 0.5; x < x1; x += bw) { p.moveTo(x, y); p.lineTo(x, y + bh); }
  }
  ctx.stroke(p);
  ctx.restore();
}

// Steps seen from the front: widening bands with gold nosings.
export function stairs(ctx, cx, y0, y1, w0, w1, n = 5, { seed = 1, color = INK.vermilion } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, y = lerp(y0, y1, t), w = lerp(w0, w1, t) / 2;
    if (i) pts.push([cx - w, lerp(y0, y1, (i - 0.02) / n)]);
    pts.push([cx - w, y]);
  }
  const left = pts;
  const outline = [...left, ...left.slice().reverse().map(([x, y]) => [2 * cx - x, y])];
  hide(ctx, outline, 0.3, seed);
  for (let i = 1; i <= n; i++) {
    const t = i / n, y = lerp(y0, y1, t), w = lerp(w0, w1, t) / 2;
    const ya = lerp(y0, y1, (i - 1) / n);
    const st = [[cx - w + 3, ya + 2.5], [cx + w - 3, ya + 2.5], [cx + w - 3, y - 1.5], [cx - w + 3, y - 1.5]];
    if (color && i % 2) dye(ctx, poly(st), color, 0.55);
    gold(ctx, [[cx - w + 2, y - 0.8], [cx + w - 2, y - 0.8]], 1, { smoothIt: false });
    dotLine(ctx, [[cx - w + 5, (ya + y) / 2], [cx + w - 5, (ya + y) / 2]], { spacing: 4.4, r: 0.95, seed: seed + i, smoothIt: false });
  }
  return outline;
}

// ครุฑ — Garuda with spread wings, painted and dotted (gable centre-piece).
export function garuda(ctx, cx, cy, s, { seed = 1, body = INK.red, wing = INK.gold } = {}) {
  const list = [];
  for (const d of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 - d * (0.28 + k * 0.27);
      const L = s * (0.66 - k * 0.055);
      const bx = cx + d * s * 0.12, by = cy - s * 0.02;
      list.push({ pts: kanokPts(bx + Math.cos(a) * s * 0.06, by + Math.sin(a) * s * 0.06, L, a, d > 0), c: k % 2 ? INK.vermilion : wing });
    }
    // raised arm
    list.push({ pts: taper([[cx + d * s * 0.12, cy - s * 0.1], [cx + d * s * 0.26, cy - s * 0.28], [cx + d * s * 0.18, cy - s * 0.46]], s * 0.07, s * 0.05), c: INK.green });
    // legs, knees out
    list.push({ pts: taper([[cx + d * s * 0.06, cy + s * 0.28], [cx + d * s * 0.24, cy + s * 0.36], [cx + d * s * 0.16, cy + s * 0.5], [cx + d * s * 0.26, cy + s * 0.54]], s * 0.08, s * 0.05), c: INK.green });
  }
  const torso = blobPts(cx, cy + s * 0.08, s * 0.13, s * 0.24, { seed, wobble: 0.03 });
  const head = blobPts(cx, cy - s * 0.26, s * 0.095, s * 0.1, { seed: seed + 1, wobble: 0.02 });
  const crown = kanokPts(cx, cy - s * 0.33, s * 0.26, -Math.PI / 2, false);
  const beak = [[cx - s * 0.05, cy - s * 0.24], [cx + s * 0.05, cy - s * 0.24], [cx, cy - s * 0.12]];
  list.push({ pts: torso, c: body }, { pts: head, c: INK.green }, { pts: crown, c: wing }, { pts: beak, c: INK.gold });
  for (const { pts, c } of list) {
    dye(ctx, poly(pts), c, 0.92);
    line(ctx, pts, INK.leather, 1.6, { closed: true, smoothIt: false });
    gold(ctx, pts, 0.7, { closed: true, smoothIt: false });
  }
  for (const { pts } of list) {
    if (pts.length > 20) hole(ctx, ...mix(pts[0], pts[Math.floor(pts.length / 2)], 0.55), Math.max(0.8, s * 0.018));
  }
  rimDots(ctx, torso, s * 0.035, { spacing: 3.2, r: 0.75, seed });
  eyeDot(ctx, cx - s * 0.035, cy - s * 0.27, s * 0.02);
  eyeDot(ctx, cx + s * 0.035, cy - s * 0.27, s * 0.02);
}
const eyeDot = (ctx, x, y, r) => hole(ctx, x, y, Math.max(0.7, r));

// Tiered spire (ยอดปราสาท / บุษบก): stacked cornice tiers with little
// gables and horns, then a lotus bell, rings and a slender finial.
export function spire(ctx, cx, yb, w, h, { tiers = 5, seed = 1, colors = [INK.vermilion, INK.green], finial = 0.34, bell = true } = {}) {
  const r = rng(seed);
  const tierH = (h * (1 - finial - (bell ? 0.12 : 0))) / tiers;
  let y = yb;
  let hw = w / 2;
  for (let i = 0; i < tiers; i++) {
    const nw = hw * 0.8;
    const band = [[cx - hw, y], [cx - hw * 0.92, y - tierH * 0.28], [cx - nw, y - tierH * 0.3], [cx - nw, y - tierH], [cx + nw, y - tierH], [cx + nw, y - tierH * 0.3], [cx + hw * 0.92, y - tierH * 0.28], [cx + hw, y]];
    hide(ctx, band, 0.3, seed + i);
    // horns at the tier corners
    const hs = tierH * 0.85;
    const horns = [-1, 1].map((d) => {
      const hx = cx + d * hw * 0.95, hy = y - tierH * 0.2;
      return taper([[hx, hy], [hx + d * hs * 0.06, hy - hs * 0.45], [hx + d * hs * 0.24, hy - hs * 0.86], [hx + d * hs * 0.44, hy - hs * 0.98]], (t) => tierH * 0.3 * (1 - t) + 0.7);
    });
    hideMany(ctx, horns);
    horns.forEach((hp) => dye(ctx, poly(hp), INK.gold, 0.6));
    // บันแถลง little gable in the middle of the tier
    const gw = Math.min(nw * 0.9, tierH * 1.1);
    const bt = [[cx - gw, y - tierH * 0.3], [cx - gw * 0.5, y - tierH * 0.85], [cx, y - tierH * 1.4], [cx + gw * 0.5, y - tierH * 0.85], [cx + gw, y - tierH * 0.3]];
    hideS(ctx, [...bt, [cx, y - tierH * 0.2]]);
    dye(ctx, poly(inset(band, 1.6)), colors[i % 2], 0.6);
    gold(ctx, [[cx - hw + 2, y - 1.5], [cx + hw - 2, y - 1.5]], 1, { smoothIt: false });
    gold(ctx, [[cx - nw + 1.5, y - tierH * 0.3], [cx + nw - 1.5, y - tierH * 0.3]], 0.8, { smoothIt: false });
    dye(ctx, smooth([...inset(bt, 2), [cx, y - tierH * 0.3]]), INK.gold, 0.8);
    hole(ctx, cx, y - tierH * 0.72, Math.max(0.8, tierH * 0.1));
    dotLine(ctx, [[cx - hw + 4, y - tierH * 0.14], [cx + hw - 4, y - tierH * 0.14]], { spacing: 3.8, r: Math.min(1, tierH * 0.09), seed: seed + i, smoothIt: false });
    dotLine(ctx, [[cx - nw + 3, y - tierH * 0.66], [cx - gw - 2, y - tierH * 0.66]], { spacing: 3.8, r: 0.85, seed: seed + i + 9, smoothIt: false });
    dotLine(ctx, [[cx + gw + 2, y - tierH * 0.66], [cx + nw - 3, y - tierH * 0.66]], { spacing: 3.8, r: 0.85, seed: seed + i + 19, smoothIt: false });
    y -= tierH;
    hw = nw * (0.92 - r() * 0.02);
  }
  // lotus bell (บัวกลุ่ม)
  let top = y;
  if (bell) {
    const bh = h * 0.12;
    const bw = hw * 0.9;
    const bp = [[cx - bw, y], [cx - bw * 1.05, y - bh * 0.35], [cx - bw * 0.7, y - bh * 0.8], [cx - bw * 0.25, y - bh], [cx + bw * 0.25, y - bh], [cx + bw * 0.7, y - bh * 0.8], [cx + bw * 1.05, y - bh * 0.35], [cx + bw, y]];
    hideS(ctx, bp);
    lotusBand(ctx, cx - bw * 0.8, cx + bw * 0.8, y - 1, bh * 0.55, { up: true, colors: [INK.gold, INK.vermilion], holesIt: false });
    dotLine(ctx, [[cx - bw * 0.6, y - bh * 0.78], [cx + bw * 0.6, y - bh * 0.78]], { spacing: 3.6, r: 0.8, smoothIt: false });
    top = y - bh;
    hw = bw * 0.3;
  }
  // rings + finial
  const fh = h * finial;
  const fin = [[cx - hw, top], [cx - hw * 0.6, top - fh * 0.3], [cx - 1.2, top - fh * 0.92], [cx, top - fh], [cx + 1.2, top - fh * 0.92], [cx + hw * 0.6, top - fh * 0.3], [cx + hw, top]];
  hideS(ctx, fin);
  dye(ctx, smooth(inset(fin, 1)), INK.gold, 0.55);
  const nRing = 7;
  for (let i = 1; i <= nRing; i++) {
    const t = (i / (nRing + 1)) * 0.55, yy = top - fh * t, ww = lerp(hw, hw * 0.5, t / 0.55) - 1;
    gold(ctx, [[cx - ww, yy], [cx + ww, yy]], 0.8, { smoothIt: false });
    if (ww > 4) hole(ctx, cx, yy - fh * 0.03, 0.8);
  }
  hole(ctx, cx, top - fh * 0.78, 0.9);
  return top - fh;
}

// ฉัตร — tiered royal umbrella on a pole.
export function umbrella(ctx, x, yb, h, { tiers = 5, w = 44, seed = 1 } = {}) {
  hide(ctx, taper([[x, yb], [x, yb - h]], 4, 2.5, { smoothIt: false }), 0, 0);
  hide(ctx, rectPts(x - 8, yb - 8, 16, 8), 0, 0);
  const top = yb - h;
  const step = (h * 0.55) / tiers;
  for (let i = 0; i < tiers; i++) {
    const y = top + h * 0.12 + i * step;
    const hw = (w / 2) * (0.45 + (i / (tiers - 1)) * 0.55);
    const th = step * 0.5;
    const pts = [[x - hw * 0.72, y - th], [x + hw * 0.72, y - th], [x + hw, y]];
    const n = Math.max(4, Math.round(hw / 3.5));
    for (let k = 0; k <= n * 2; k++) {
      const t = k / (n * 2);
      pts.push([x + hw - 2 * hw * t, y + (k % 2 ? 4.5 : 1.2)]);
    }
    hide(ctx, pts, 0, 0);
    dye(ctx, poly(inset(pts.slice(0, 3).concat([[x - hw, y]]), 1.3)), i % 2 ? INK.vermilion : INK.gold, 0.8);
    dotLine(ctx, [[x - hw * 0.7, y - th * 0.45], [x + hw * 0.7, y - th * 0.45]], { spacing: 3.4, r: 0.8, seed: seed + i, smoothIt: false });
  }
  const tip = kanokPts(x, top + h * 0.12 - step * 0.5, h * 0.12, -Math.PI / 2, false);
  hideMany(ctx, [tip]);
}

// ======================================================= house pieces

function drawThaiHouse(ctx, { rng: r, w: W, h: H }) {
  // เรือนไทย — gable end of the main house on the left, open veranda
  // (ชาน) with railing on the right, ladder down to the ground.
  const G = H;
  const floorY = 300, floorH = 14;
  const hx0 = 30, hx1 = 300;
  const wallTop = 176;
  const lean = 13; // walls lean in (ล้มสอบ)
  // ---- stilts
  const posts = [48, 110, 176, 240, 292, 362, 430, 494];
  posts.forEach((x, i) => {
    const pw = 14 + r() * 2.5;
    const lx = (x - 260) * 0.012; // posts lean in slightly too
    hide(ctx, [[x - pw / 2 + 1.5 + lx, floorY + 4], [x + pw / 2 - 1.5 + lx, floorY + 4], [x + pw / 2, G - 9], [x - pw / 2, G - 9]], 0.5, 10 + i);
    hide(ctx, [[x - pw * 0.8, G - 11], [x + pw * 0.8, G - 11], [x + pw, G], [x - pw, G]], 0.4, 30 + i);
    dotLine(ctx, [[x + lx * 0.5, floorY + 24], [x, G - 22]], { spacing: 5, r: 1.05, seed: i, smoothIt: false });
  });
  // tie beams under the floor (รอด) and a hammock (เปล) between two posts
  hide(ctx, rectPts(40, floorY + 42, 262, 7), 0.4, 60);
  hide(ctx, rectPts(354, floorY + 42, 146, 7), 0.4, 61);
  dotLine(ctx, [[44, floorY + 45.5], [298, floorY + 45.5]], { spacing: 6, r: 0.9, smoothIt: false });
  const ham = [[110, floorY + 50], [140, floorY + 100], [176, floorY + 50]];
  hide(ctx, taper([[110, floorY + 49], [128, floorY + 92], [158, floorY + 92], [176, floorY + 49]], 3.2), 0, 0);
  const cloth = [[118, floorY + 72], [130, floorY + 98], [156, floorY + 98], [168, floorY + 72], [143, floorY + 88]];
  hideS(ctx, cloth);
  plaidLite(ctx, cloth, [112, floorY + 70, 172, floorY + 102]);
  void ham;
  // water jars under the house (โอ่ง)
  for (const [jx, js] of [[222, 1], [262, 0.8]]) {
    const jar = [[jx - 20 * js, G], [jx - 28 * js, G - 16 * js], [jx - 30 * js, G - 36 * js], [jx - 24 * js, G - 52 * js], [jx - 12 * js, G - 60 * js], [jx + 12 * js, G - 60 * js], [jx + 24 * js, G - 52 * js], [jx + 30 * js, G - 36 * js], [jx + 28 * js, G - 16 * js], [jx + 20 * js, G]];
    hideS(ctx, jar);
    dye(ctx, smooth(inset(jar, 3)), INK.brown, 0.55);
    gold(ctx, [[jx - 28 * js, G - 38 * js], [jx + 28 * js, G - 38 * js]], 1, { smoothIt: false });
    dotLine(ctx, [[jx - 24 * js, G - 30 * js], [jx, G - 20 * js], [jx + 24 * js, G - 30 * js]], { spacing: 4, r: 1 });
    dotLine(ctx, [[jx - 20 * js, G - 50 * js], [jx + 20 * js, G - 50 * js]], { spacing: 4, r: 0.9, smoothIt: false });
    hide(ctx, rectPts(jx - 14 * js, G - 66 * js, 28 * js, 7 * js), 0, 0);
  }
  // ---- floor beam
  const beam = [[16, floorY], [W - 10, floorY], [W - 10, floorY + floorH], [16, floorY + floorH]];
  hide(ctx, beam, 0.4, 3);
  dye(ctx, poly(inset(beam, 2.5)), INK.vermilion, 0.7);
  dotLine(ctx, [[22, floorY + floorH / 2], [W - 16, floorY + floorH / 2]], { spacing: 4.5, r: 1.3, seed: 4, smoothIt: false });
  // ---- walls (ฝาปะกน) leaning in
  const wall = [[hx0 + lean, wallTop], [hx1 - lean, wallTop], [hx1, floorY], [hx0, floorY]];
  hide(ctx, wall, 0.5, 5);
  const xl = (y) => lerp(hx0 + lean, hx0, (y - wallTop) / (floorY - wallTop)) + 8;
  const xr = (y) => lerp(hx1 - lean, hx1, (y - wallTop) / (floorY - wallTop)) - 8;
  const rows = [[wallTop + 8, 208], [216, floorY - 8]];
  for (const [ri, [ya, yb]] of rows.entries()) {
    for (let c = 0; c < 4; c++) {
      if (ri === 1 && (c === 1 || c === 2)) continue;
      const xa0 = lerp(xl(ya), xr(ya), c / 4) + 3, xa1 = lerp(xl(ya), xr(ya), (c + 1) / 4) - 3;
      const xb0 = lerp(xl(yb), xr(yb), c / 4) + 3, xb1 = lerp(xl(yb), xr(yb), (c + 1) / 4) - 3;
      const pp = [[xa0, ya], [xa1, ya], [xb1, yb], [xb0, yb]];
      gold(ctx, pp, 1.1, { closed: true, smoothIt: false });
      const pi = inset(pp, 5);
      dye(ctx, poly(pi), (c + ri) % 2 ? INK.green : INK.vermilion, 0.6);
      rimDots(ctx, pi, 2.6, { spacing: 4, r: 0.95, seed: ri * 5 + c });
      const mx = (xa0 + xa1 + xb0 + xb1) / 4, my = (ya + yb) / 2;
      if (yb - ya > 40) {
        prajamYam(ctx, mx, my, 10, { color: INK.red, petal: INK.gold });
        for (const s of [-1, 1]) dotFlower(ctx, mx, my + s * 26, 1, 4, 2.4);
      } else dotFlower(ctx, mx, my, 1.1, 5, 2.6);
    }
  }
  // window with turned balusters (ลูกมะหวด), open shutters
  const wx0 = 106, wx1 = 222, wy0 = 218, wy1 = 286;
  cut(ctx, poly(rectPts(wx0, wy0, wx1 - wx0, wy1 - wy0)));
  for (let x = wx0 + 9; x < wx1 - 4; x += 13.5) {
    const bal = [[x - 2, wy0], [x + 2, wy0], [x + 2.4, wy0 + 12], [x + 4.2, wy0 + 20], [x + 2.4, wy0 + 28], [x + 2, wy1], [x - 2, wy1], [x - 2.4, wy0 + 28], [x - 4.2, wy0 + 20], [x - 2.4, wy0 + 12]];
    hide(ctx, bal, 0, 0);
    hole(ctx, x, wy0 + 20, 1.1);
  }
  hide(ctx, rectPts(wx0 - 5, wy1 - 2, wx1 - wx0 + 10, 8), 0, 0);
  hide(ctx, rectPts(wx0 - 5, wy0 - 7, wx1 - wx0 + 10, 8), 0, 0);
  dotLine(ctx, [[wx0 - 2, wy1 + 2], [wx1 + 2, wy1 + 2]], { spacing: 4, r: 0.9, smoothIt: false });
  gold(ctx, [[wx0 - 3, wy0 - 3], [wx1 + 3, wy0 - 3]], 1, { smoothIt: false });
  // ---- roof: steep gable (จั่ว) with sunburst panel
  const apex = [165, 34];
  const eL = [hx0 - 18, wallTop + 4], eR = [hx1 + 18, wallTop + 4];
  // under-eave shadow boards (roof planes seen edge-on) left and right
  for (const d of [-1, 1]) {
    const e = d < 0 ? eL : eR;
    const eave = [[e[0] - d * 2, e[1] - 6], [e[0] + d * 22, e[1] + 20], [e[0] + d * 16, e[1] + 26], [e[0] - d * 14, e[1] + 6]];
    hide(ctx, eave, 0.3, 70 + d);
    dotLine(ctx, [mix(eave[0], eave[1], 0.2), mix(eave[0], eave[1], 0.8)], { spacing: 4, r: 0.9, smoothIt: false });
  }
  const tri = [apex, eR, eL];
  hide(ctx, tri, 0.4, 7);
  const triIn = [[apex[0], apex[1] + 18], [eR[0] - 24, eR[1] - 5], [eL[0] + 24, eL[1] - 5]];
  gold(ctx, triIn, 1.2, { closed: true, smoothIt: false });
  sunburst(ctx, apex[0], eL[1] - 7, triIn, { n: 11, seed: 8 });
  // gable base beam with a row of hanging teeth
  hide(ctx, rectPts(eL[0] + 14, eL[1] - 6, eR[0] - eL[0] - 28, 8), 0, 0);
  dotLine(ctx, [[eL[0] + 18, eL[1] - 2], [eR[0] - 18, eL[1] - 2]], { spacing: 4, r: 1, smoothIt: false });
  // bargeboards (ป้านลม) crossing into a fish-tail (หางปลา) at the top
  for (const d of [-1, 1]) {
    const foot = d < 0 ? [eL[0] - 8, eL[1] + 8] : [eR[0] + 8, eR[1] + 8];
    const top = [apex[0] - d * 20, apex[1] - 30];
    const board = taper([foot, top], 12, 8, { smoothIt: false });
    hide(ctx, board, 0.3, 20 + d);
    const midA = mix(foot, top, 0.04), midB = mix(foot, top, 0.96);
    dye(ctx, poly(taper([midA, midB], 6.5, 4, { smoothIt: false })), INK.vermilion, 0.65);
    edgeDots(ctx, [midA, midB], 0, { spacing: 4.6, r: 1.15, seed: 21 + d, smoothIt: false });
    // flared tip beyond the crossing
    hideMany(ctx, [kanokPts(top[0] + d * 1, top[1] + 4, 20, Math.atan2(top[1] - foot[1], top[0] - foot[0]), d > 0)]);
    // เหงา: hooked foot
    const hook = taper([[foot[0] - d * 4, foot[1] - 6], [foot[0] + d * 6, foot[1] + 4], [foot[0] + d * 16, foot[1] + 2], [foot[0] + d * 20, foot[1] - 9]], (t) => 12 - t * 9);
    hide(ctx, hook, 0, 0);
    hole(ctx, foot[0] + d * 8, foot[1], 1.4);
  }
  // ---- veranda railing (ราวระเบียง)
  const vx0 = 308, vx1 = W - 14, ry0 = floorY - 48;
  hide(ctx, rectPts(vx0, ry0, vx1 - vx0, 7), 0.3, 40);
  hide(ctx, rectPts(vx0, floorY - 12, vx1 - vx0, 6), 0.3, 41);
  gold(ctx, [[vx0 + 2, ry0 + 3.5], [vx1 - 2, ry0 + 3.5]], 1, { smoothIt: false });
  for (let x = vx0 + 4; x <= vx1 - 2; x += 32) hide(ctx, rectPts(x - 3.5, ry0 - 7, 7, floorY - ry0 + 7), 0, 0);
  for (let x = vx0 + 4; x < vx1 - 20; x += 32) {
    for (let k = 1; k < 5; k++) {
      const bx = x + k * 6.4;
      const bal = [[bx - 1.4, ry0 + 7], [bx + 1.4, ry0 + 7], [bx + 2.6, ry0 + 20], [bx + 1.4, floorY - 12], [bx - 1.4, floorY - 12], [bx - 2.6, ry0 + 20]];
      hide(ctx, bal, 0, 0);
    }
  }
  // bird cage (กรงนกเขา) hanging from a tall pole on the veranda — the
  // southern village touch
  const px = 470;
  hide(ctx, taper([[px, ry0], [px, 96]], 4.5, 3, { smoothIt: false }), 0, 0);
  hide(ctx, taper([[px - 2, 104], [px + 26, 98]], 3, 2.5, { smoothIt: false }), 0, 0);
  hide(ctx, taper([[px + 24, 100], [px + 24, 118]], 1.4, 1.4, { smoothIt: false }), 0, 0);
  const cage = [[px + 24, 116], [px + 12, 124], [px + 6, 140], [px + 6, 166], [px + 42, 166], [px + 42, 140], [px + 36, 124]];
  hideS(ctx, cage);
  dye(ctx, smooth(inset(cage, 2)), INK.gold, 0.45);
  ctx.save(); ctx.clip(smooth(inset(cage, 2.5)));
  for (let x = px + 8; x < px + 42; x += 4.2) cut(ctx, poly(rectPts(x, 118, 2.4, 42)));
  ctx.restore();
  hide(ctx, rectPts(px + 4, 164, 40, 6), 0, 0);
  hide(ctx, rectPts(px + 6, 138, 36, 3), 0, 0);
  // the dove inside
  const bird = [[px + 16, 156], [px + 20, 148], [px + 27, 146], [px + 31, 149], [px + 35, 147], [px + 32, 152], [px + 30, 157], [px + 22, 160]];
  hideS(ctx, bird);
  hide(ctx, [[px + 44 - 18, 170], [px + 25, 177], [px + 23, 170]], 0, 0);
  // ---- ladder (บันได)
  const la = [W - 34, floorY + floorH], lb = [W - 72, G - 2];
  for (const off of [-12, 12]) hide(ctx, taper([[la[0] + off, la[1] - 8], [lb[0] + off, lb[1]]], 6, 6.5, { smoothIt: false }), 0.3, 50 + off);
  for (let t = 0.12; t < 0.98; t += 0.17) {
    const p = mix(la, lb, t);
    hide(ctx, rectPts(p[0] - 13, p[1] - 2.5, 26, 5), 0, 0);
  }
  edgeDots(ctx, [[la[0] - 12, la[1]], [lb[0] - 12, lb[1] - 4]], 0, { spacing: 5, r: 0.95, smoothIt: false });
  edgeDots(ctx, [[la[0] + 12, la[1]], [lb[0] + 12, lb[1] - 4]], 0, { spacing: 5, r: 0.95, smoothIt: false });
  rimDots(ctx, wall, 3.5, { spacing: 4.4, r: 1.1, seed: 9 });
  age(ctx, W, H);
}

// A quick painted check (ผ้าขาวม้า) for small cloths.
function plaidLite(ctx, pts, bbox) {
  const p = smooth(pts);
  ctx.save();
  ctx.clip(p);
  const [x0, y0, x1, y1] = bbox;
  ctx.globalCompositeOperation = 'source-atop';
  for (let x = x0, i = 0; x < x1; x += 6, i++) { ctx.globalAlpha = 0.8; ctx.fillStyle = i % 2 ? INK.red : INK.green; ctx.fillRect(x, y0, 3, y1 - y0); }
  for (let y = y0, i = 0; y < y1; y += 6, i++) { ctx.globalAlpha = 0.5; ctx.fillStyle = i % 2 ? INK.yellow : INK.red; ctx.fillRect(x0, y, x1 - x0, 3); }
  ctx.restore();
  dotFill(ctx, p, bbox, { pattern: 'grid', spacing: 6, r: 0.7 });
}

function drawHut(ctx, { rng: r, w: W, h: H }) {
  // กระท่อมมุงจาก — nipa-thatched hut on short bamboo stilts: a big steep
  // shaggy roof over woven bamboo walls.
  const G = H, cx = W / 2;
  const floorY = 226;
  [46, 98, 150, 202, 254].forEach((x, i) => {
    hide(ctx, rectPts(x - 6, floorY, 12, G - floorY), 0.6, i);
    for (let y = floorY + 22; y < G - 6; y += 26) slit(ctx, [[x - 5, y], [x + 5, y + 1]], 1, { smoothIt: false });
  });
  hide(ctx, taper([[46, floorY + 30], [150, G - 14]], 4.5), 0, 0);
  hide(ctx, taper([[254, floorY + 30], [150, G - 14]], 4.5), 0, 0);
  for (const off of [-9, 9]) hide(ctx, taper([[270 + off, floorY + 4], [292 + off, G]], 5, 5, { smoothIt: false }), 0, 0);
  for (let t = 0.22; t < 0.95; t += 0.26) { const p = mix([270, floorY], [292, G], t); hide(ctx, rectPts(p[0] - 11, p[1] - 2, 22, 4.5), 0, 0); }
  hide(ctx, rectPts(26, floorY - 9, 256, 13), 0.5, 8);
  for (let x = 30; x < 280; x += 7) slit(ctx, [[x, floorY - 7], [x, floorY + 2]], 0.8, { smoothIt: false });
  // woven walls (ฝาขัดแตะ)
  const wall = [[58, 130], [242, 130], [250, floorY - 9], [50, floorY - 9]];
  hide(ctx, wall, 0.6, 11);
  dye(ctx, poly(inset(wall, 3)), INK.brown, 0.45);
  ctx.save();
  ctx.clip(poly(inset(wall, 4)));
  const weave = new Path2D();
  for (let y = 134, row = 0; y < floorY; y += 8, row++) {
    for (let x = 46 + (row % 2) * 8; x < 256; x += 16) {
      weave.rect(x, y, 5, 1.3);
      weave.rect(x + 9, y - 2.5, 1.3, 5);
    }
  }
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(weave);
  ctx.restore();
  // door with a rolled-up mat, window propped open
  cut(ctx, poly(rectPts(172, 150, 44, floorY - 158)));
  hide(ctx, rectPts(168, 145, 52, 8), 0, 0);
  hide(ctx, rectPts(172, 152, 44, 14), 0, 0);
  for (let x = 174; x < 216; x += 5) slit(ctx, [[x, 154], [x + 2, 164]], 0.8, { smoothIt: false });
  for (const x of [182, 206]) hide(ctx, taper([[x, 152], [x, 176]], 1.6), 0, 0);
  cut(ctx, poly(rectPts(82, 158, 40, 30)));
  for (let x = 88; x < 120; x += 9) hide(ctx, rectPts(x, 158, 2.6, 30), 0, 0);
  hide(ctx, taper([[76, 156], [128, 136]], 6, 5, { smoothIt: false }), 0, 0);
  // the roof: steep, overhanging, with a ragged fringe
  const apex = [cx, 8];
  const eaveY = 150;
  const edge = [];
  const n = 50;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    edge.push([lerp(W + 4, -4, t), eaveY + (i % 2 ? 9 + r() * 8 : 1 + r() * 3)]);
  }
  const roof = [apex, [W - 2, eaveY - 12], ...edge, [2, eaveY - 12]];
  hide(ctx, roof, 0.9, 12);
  dye(ctx, poly(roof), INK.orange, 0.16);
  // thatch courses: rows of short slits following the slopes
  for (let row = 0; row < 8; row++) {
    const y = 34 + row * 15;
    const half = ((y - apex[1]) / (eaveY - apex[1])) * (W / 2 + 2);
    for (let x = cx - half + 6; x < cx + half - 6; x += 5.2) {
      const len = 6 + r() * 5;
      slit(ctx, [[x, y + r() * 2], [x + (x - cx) * 0.05, y + len]], 0.9, { smoothIt: false });
    }
    dotLine(ctx, [[cx - half + 8, y - 2], [cx + half - 8, y - 2]], { spacing: 9, r: 0.8, seed: row, smoothIt: false });
  }
  gold(ctx, [[cx, 10], [W - 6, eaveY - 12]], 1.2, { smoothIt: false });
  gold(ctx, [[cx, 10], [6, eaveY - 12]], 1.2, { smoothIt: false });
  // ridge cap + crossed sticks (ไม้ขี่)
  for (const d of [-1, 1]) hide(ctx, taper([[cx - d * 12, 30], [cx + d * 18, -10]], 5, 3, { smoothIt: false }), 0, 0);
  // hanging fish trap (ไซ) and a gourd under the eaves
  hide(ctx, taper([[30, 156], [30, 166]], 1.4), 0, 0);
  const trap = [[30, 166], [38, 176], [40, 206], [30, 214], [20, 206], [22, 176]];
  hideS(ctx, trap);
  ctx.save(); ctx.clip(smooth(inset(trap, 2.2)));
  for (let y = 170; y < 214; y += 5) slit(ctx, [[16, y], [44, y + 2]], 1.1, { smoothIt: false });
  ctx.restore();
  gold(ctx, [[30, 168], [30, 212]], 0.8, { smoothIt: false });
  hide(ctx, taper([[268, 156], [268, 172]], 1.4), 0, 0);
  const gourd = blobPts(268, 186, 9, 11, { seed: 4 });
  hideS(ctx, gourd);
  hideS(ctx, blobPts(268, 172, 5, 6, { seed: 5 }));
  dye(ctx, smooth(inset(gourd, 2)), INK.orange, 0.7);
  dotLine(ctx, ellipsePts(268, 187, 5, 7, 16), { closed: true, spacing: 3.2, r: 0.8, smoothIt: false });
  rimDots(ctx, wall, 3.5, { spacing: 4.4, r: 1, seed: 3 });
  age(ctx, W, H, 0.3);
}

// Roof in side (long) elevation, as Thai murals draw it: a tall tiled
// trapezoid with ช่อฟ้า at both ends of the ridge, ใบระกา along the sloping
// gable edges and หางหงส์ curling off the eave corners.
export function roofSide(ctx, x0, x1, yT, yB, over, { fin = 13, chofaH = 54, hhS = 30, board = 8, seed = 1, color = null, tileW = 11 } = {}) {
  const bl = [x0 - over, yB], br = [x1 + over, yB];
  finRow(ctx, bl, [x0, yT], fin, { side: -1, seed: seed + 1, to: 0.96, lean: 0.8 });
  finRow(ctx, [x1, yT], br, fin, { side: -1, seed: seed + 2, from: 0.04, lean: 0.8 });
  const face = [[x0, yT], [x1, yT], br, bl];
  hide(ctx, face, 0.4, seed);
  const inner = [[x0 + board * 0.5, yT + board], [x1 - board * 0.5, yT + board], [br[0] - board * 1.2, yB - 3], [bl[0] + board * 1.2, yB - 3]];
  if (color) dye(ctx, poly(inner), color, 0.5);
  tiles(ctx, poly(inner), [x0 - over, yT, x1 + over, yB], { w: tileW, rowH: tileW * 0.62, lw: 1.1 });
  gold(ctx, inner, 1.1, { closed: true, smoothIt: false });
  // gable end boards
  for (const [a, b] of [[bl, [x0, yT]], [[x1, yT], br]]) {
    dye(ctx, poly(taper([a, b], board * 0.9, board * 0.9, { smoothIt: false })), INK.gold, 0.55);
    edgeDots(ctx, [a, b], 0, { spacing: 4.2, r: 1, smoothIt: false, seed });
  }
  // ridge
  hide(ctx, rectPts(x0 - 2, yT - 5, x1 - x0 + 4, 7), 0, 0);
  dotLine(ctx, [[x0 + 4, yT - 1.5], [x1 - 4, yT - 1.5]], { spacing: 4.4, r: 1, smoothIt: false });
  chofa(ctx, x0, yT - 2, chofaH, { dir: -1, w: board * 0.95 });
  chofa(ctx, x1, yT - 2, chofaH, { dir: 1, w: board * 0.95 });
  hangHong(ctx, bl[0] + 2, yB, hhS, { dir: -1, w: board });
  hangHong(ctx, br[0] - 2, yB, hhS, { dir: 1, w: board });
  return face;
}

function drawSala(ctx, { rng: r, w: W, h: H }) {
  // ศาลาไทย — open pavilion, long side: lotus base, five columns with
  // brackets and lace valances, two-tier tiled roof with chofa.
  const G = H, cx = W / 2;
  const floorY = G - 50;
  // base
  moulding(ctx, 36, G - 22, W - 36, G, { dots: 1, r: 1.1, seed: 1 });
  lotusBand(ctx, 44, W - 44, G - 21, 13, { up: true, seed: 2 });
  moulding(ctx, 46, floorY, W - 46, G - 22, { color: INK.vermilion, dots: 1, seed: 3 });
  stairs(ctx, cx, floorY, G, 70, 96, 4, { seed: 4 });
  // columns
  const colX = [74, 167, 260, 353, 446];
  const capY = 206;
  // balustrade between columns (ลูกกรง)
  for (let i = 0; i < colX.length - 1; i++) {
    if (i === 1 || i === 2) {
      // bench seats in the middle bays
      hide(ctx, rectPts(colX[i] + 12, floorY - 26, colX[i + 1] - colX[i] - 24, 6), 0, 0);
      for (const x of [colX[i] + 20, colX[i + 1] - 20]) hide(ctx, rectPts(x - 2.5, floorY - 22, 5, 22), 0, 0);
      continue;
    }
    const x0 = colX[i] + 10, x1 = colX[i + 1] - 10;
    hide(ctx, rectPts(x0, floorY - 40, x1 - x0, 6), 0, 0);
    gold(ctx, [[x0 + 1, floorY - 37], [x1 - 1, floorY - 37]], 0.8, { smoothIt: false });
    for (let x = x0 + 6; x < x1 - 2; x += 9) {
      hide(ctx, [[x - 1.5, floorY - 34], [x + 1.5, floorY - 34], [x + 3, floorY - 18], [x + 1.5, floorY], [x - 1.5, floorY], [x - 3, floorY - 18]], 0, 0);
    }
  }
  colX.forEach((x, i) => column(ctx, x, capY, floorY, 17, { seed: i, color: i % 2 ? INK.vermilion : INK.green }));
  // beam + valances
  const beam = [[46, 186], [W - 46, 186], [W - 46, 200], [46, 200]];
  hide(ctx, beam, 0.3, 9);
  dye(ctx, poly(inset(beam, 2)), INK.red, 0.8);
  dotLine(ctx, [[50, 193], [W - 50, 193]], { spacing: 4.2, r: 1.1, smoothIt: false });
  for (let i = 0; i < colX.length - 1; i++) valance(ctx, colX[i] + 11, colX[i + 1] - 11, 198, 30, { seed: 10 + i });
  kantuay(ctx, colX[0] - 6, 176, 238, 34, -1, { seed: 3 });
  kantuay(ctx, colX[4] + 6, 176, 238, 34, 1, { seed: 4 });
  // roofs: lower tier (ปีกนก) then main roof over it
  roofSide(ctx, 70, W - 70, 142, 190, 40, { fin: 11, chofaH: 0.1, hhS: 26, board: 7, seed: 20, tileW: 10 });
  roofSide(ctx, 150, W - 150, 58, 158, 58, { fin: 14, chofaH: 58, hhS: 30, board: 9, seed: 30, color: INK.red, tileW: 12 });
  age(ctx, W, H, 0.3);
}

function drawSpiritHouse(ctx, { rng: r, w: W, h: H }) {
  // ศาลพระภูมิ — gilded miniature prasat on a post, garlands hanging.
  const G = H, cx = W / 2;
  // post + foot
  hide(ctx, [[cx - 26, G], [cx - 20, G - 16], [cx + 20, G - 16], [cx + 26, G]], 0, 0);
  lotusBand(ctx, cx - 20, cx + 20, G - 15, 10, { up: true, colors: [INK.gold, INK.vermilion], holesIt: false });
  const post = [[cx - 8, 214], [cx + 8, 214], [cx + 10, G - 16], [cx - 10, G - 16]];
  hide(ctx, post, 0.3, 1);
  dye(ctx, poly(inset(post, 2)), INK.vermilion, 0.75);
  gold(ctx, inset(post, 2), 0.8, { closed: true, smoothIt: false });
  dotLine(ctx, [[cx, 230], [cx, G - 26]], { spacing: 4, r: 1, smoothIt: false });
  // capital + platform (ชาน)
  lotusBand(ctx, cx - 20, cx + 20, 216, 16, { up: false, colors: [INK.gold, INK.green], edge: true, holesIt: false });
  hide(ctx, [[cx - 22, 214], [cx + 22, 214], [cx + 56, 200], [cx - 56, 200]], 0, 0);
  const plat = [[cx - 64, 190], [cx + 64, 190], [cx + 64, 201], [cx - 64, 201]];
  hide(ctx, plat, 0.2, 2);
  dye(ctx, poly(inset(plat, 1.5)), INK.gold, 0.6);
  dotLine(ctx, [[cx - 60, 195.5], [cx + 60, 195.5]], { spacing: 3.6, r: 0.95, smoothIt: false });
  // railing with posts
  hide(ctx, rectPts(cx - 64, 172, 128, 4), 0, 0);
  for (let x = cx - 62; x <= cx + 62; x += 8.9) hide(ctx, [[x - 1.2, 176], [x + 1.2, 176], [x + 2.2, 183], [x + 1.2, 190], [x - 1.2, 190], [x - 2.2, 183]], 0, 0);
  for (const x of [cx - 64, cx + 64]) { hide(ctx, rectPts(x - 3, 168, 6, 22), 0, 0); hideS(ctx, [[x - 4, 169], [x - 3, 163], [x, 158], [x + 3, 163], [x + 4, 169]]); }
  // garlands along the platform front
  for (const x of [cx - 46, cx - 16, cx + 16, cx + 46]) garland(ctx, x, 201, 26, { color: x % 2 ? INK.orange : INK.yellow });
  // house body with a doorway and the guardian figure inside
  const body = [[cx - 36, 108], [cx + 36, 108], [cx + 38, 172], [cx - 38, 172]];
  hide(ctx, body, 0.3, 4);
  dye(ctx, poly(inset(body, 2)), INK.red, 0.8);
  gold(ctx, inset(body, 2.2), 0.9, { closed: true, smoothIt: false });
  const door = [[cx - 13, 170], [cx - 13, 134], [cx - 6, 126], [cx, 116], [cx + 6, 126], [cx + 13, 134], [cx + 13, 170]];
  dye(ctx, poly(inset([[cx - 21, 172], [cx - 21, 130], [cx - 10, 118], [cx, 102], [cx + 10, 118], [cx + 21, 130], [cx + 21, 172]], 0)), INK.gold, 0.85);
  cut(ctx, poly(door));
  // Phra Phum: a little standing figure with a tall crown
  const fig = [[cx - 7, 170], [cx - 6, 154], [cx - 8, 146], [cx - 4, 140], [cx - 3.5, 134], [cx - 1.5, 124], [cx, 118], [cx + 1.5, 124], [cx + 3.5, 134], [cx + 4, 140], [cx + 8, 146], [cx + 6, 154], [cx + 7, 170]];
  hide(ctx, fig, 0, 0);
  dye(ctx, poly(inset(fig, 0.8)), INK.gold, 0.8);
  // flanking pillars
  for (const x of [cx - 32, cx + 32]) {
    const pl = rectPts(x - 4, 116, 8, 56);
    dye(ctx, poly(pl), INK.green, 0.8);
    gold(ctx, pl, 0.7, { closed: true, smoothIt: false });
    dotLine(ctx, [[x, 120], [x, 168]], { spacing: 3.4, r: 0.75, smoothIt: false });
  }
  // gable + side eaves
  for (const d of [-1, 1]) {
    const wing = [[cx + d * 30, 84], [cx + d * 58, 110], [cx + d * 54, 115], [cx + d * 30, 110]];
    finRow(ctx, wing[0], wing[1], 7, { side: d < 0 ? 1 : -1, seed: 7 + d, gap: 0.55 });
    hide(ctx, wing, 0, 0);
    dye(ctx, poly(inset(wing, 1)), INK.gold, 0.6);
    hangHong(ctx, cx + d * 58, 112, 16, { dir: d, w: 4.5 });
  }
  spire(ctx, cx, 72, 60, 84, { tiers: 3, seed: 9 });
  thaiGable(ctx, cx, 50, 110, 44, { board: 6, fin: 8, chofaH: 26, hhS: 16, panelColor: INK.red, motif: 'none', seed: 11 });
  prajamYam(ctx, cx, 92, 8, { color: INK.red, petal: INK.gold });
  // incense + candles on the platform
  for (const x of [cx - 52, cx + 52]) {
    for (let k = -1; k <= 1; k++) {
      hide(ctx, taper([[x + k * 1.6, 184], [x + k * 4, 156]], 1, 0.7, { smoothIt: false }), 0, 0);
      hole(ctx, x + k * 4, 157, 0.7);
    }
    hide(ctx, [[x - 6, 190], [x + 6, 190], [x + 4, 182], [x - 4, 182]], 0, 0);
  }
  // tiny elephants offered at the corners
  for (const [x, d] of [[cx - 42, 1], [cx + 42, -1]]) elephantling(ctx, x, 189, 13, d);
  age(ctx, W, H, 0.25);
}

function elephantling(ctx, x, y, s, d) {
  const pts = [[x - d * s * 0.6, y], [x - d * s * 0.62, y - s * 0.55], [x - d * s * 0.3, y - s * 0.8], [x + d * s * 0.3, y - s * 0.78], [x + d * s * 0.62, y - s * 0.6], [x + d * s * 0.8, y - s * 0.2], [x + d * s * 0.9, y], [x + d * s * 0.72, y], [x + d * s * 0.6, y - s * 0.3], [x + d * s * 0.4, y - s * 0.3], [x + d * s * 0.35, y], [x - d * s * 0.2, y], [x - d * s * 0.25, y - s * 0.25], [x - d * s * 0.4, y]];
  hideS(ctx, pts);
  dye(ctx, smooth(pts), INK.gold, 0.4);
  hole(ctx, x + d * s * 0.42, y - s * 0.58, 0.7);
}

function drawChedi(ctx, { w: W, h: H }) {
  // เจดีย์ทรงระฆัง — bell stupa: square terraces, lotus rings, the bell with
  // a garland band, the harmika, rings (ปล้องไฉน) and the finial.
  const G = H, cx = W / 2;
  const terr = [[G, 262, 26], [G - 26, 232, 22], [G - 48, 204, 20]];
  terr.forEach(([y, w, h], i) => {
    moulding(ctx, cx - w / 2, y - h, cx + w / 2, y, { dots: 1, seed: i, color: i === 1 ? INK.vermilion : null, r: 1.05 });
  });
  lotusBand(ctx, cx - 96, cx + 96, G - 49, 14, { up: true, seed: 3 });
  // lotus rings (บัวถลา)
  const rings = [[G - 68, 180, 16], [G - 84, 160, 14], [G - 98, 142, 12]];
  rings.forEach(([y, w, h], i) => {
    const pts = [[cx - w / 2 + 6, y - h], [cx + w / 2 - 6, y - h], [cx + w / 2, y - h * 0.4], [cx + w / 2 - 2, y], [cx - w / 2 + 2, y], [cx - w / 2, y - h * 0.4]];
    hideS(ctx, pts);
    gold(ctx, [[cx - w / 2 + 3, y - h * 0.45], [cx + w / 2 - 3, y - h * 0.45]], 1, { smoothIt: false });
    dotLine(ctx, [[cx - w / 2 + 6, y - h * 0.75], [cx + w / 2 - 6, y - h * 0.75]], { spacing: 4, r: 1, seed: 10 + i, smoothIt: false });
  });
  // the bell (องค์ระฆัง)
  const yb = G - 110, yt = yb - 158;
  const bell = [[cx - 74, yb], [cx - 72, yb - 30], [cx - 62, yb - 78], [cx - 44, yb - 122], [cx - 26, yb - 148], [cx - 14, yt], [cx + 14, yt], [cx + 26, yb - 148], [cx + 44, yb - 122], [cx + 62, yb - 78], [cx + 72, yb - 30], [cx + 74, yb]];
  hideS(ctx, bell);
  const bp = smooth(bell);
  dye(ctx, bp, INK.gold, 0.26);
  // half-width of the bell at height y (from the profile)
  const bprof = curve(bell.slice(0, 6), false, 10);
  const halfAt = (y) => {
    for (let k = 1; k < bprof.length; k++) if (bprof[k][1] <= y) return cx - lerp(bprof[k - 1][0], bprof[k][0], (bprof[k - 1][1] - y) / (bprof[k - 1][1] - bprof[k][1] || 1));
    return 14;
  };
  // skirt below the garland: vermilion with prajam-yam flowers
  ctx.save(); ctx.clip(bp);
  dye(ctx, poly(rectPts(cx - 80, yb - 46, 160, 46)), INK.vermilion, 0.72);
  ctx.restore();
  // garland band (ลายรัดอก) with hanging swags
  const band = (y, ww) => [[cx - ww, y], [cx + ww, y]];
  gold(ctx, band(yb - 56, halfAt(yb - 56) - 2), 1.5, { smoothIt: false });
  gold(ctx, band(yb - 46, halfAt(yb - 46) - 2), 1.5, { smoothIt: false });
  dotLine(ctx, band(yb - 51, halfAt(yb - 51) - 4), { spacing: 3.4, r: 1.1, smoothIt: false });
  for (let k = -3; k <= 3; k++) {
    const x = cx + k * 19;
    const sw = [[x - 9.5, yb - 44], [x, yb - 30], [x + 9.5, yb - 44]];
    gold(ctx, sw, 1.1);
    dotLine(ctx, sw.map(([a, b]) => [a, b + 4]), { spacing: 3, r: 0.8 });
    if (Math.abs(k) < 3) prajamYam(ctx, x + 9.5, yb - 20, 6, { color: INK.gold, petal: INK.green });
    hole(ctx, x, yb - 22, 1.2);
  }
  // gadroon dot rows sweeping up the bell, dot-flowers between them
  for (let k = -5; k <= 5; k++) {
    const pts = [];
    for (let y = yb - 64; y > yt + 16; y -= 6) pts.push([cx + (k / 6) * (halfAt(y) - 4), y]);
    dotLine(ctx, pts, { spacing: 4.2, r: 1.05, seed: 40 + k, smoothIt: false });
    if (k < 5) {
      for (let y = yb - 76; y > yt + 30; y -= 22) {
        const x = cx + ((k + 0.5) / 6) * (halfAt(y) - 4);
        dotFlower(ctx, x, y, 0.8, 4, 2.2);
      }
    }
  }
  // lotus collar (บัวคว่ำ) at the neck
  lotusBand(ctx, cx - 26, cx + 26, yt + 2, 14, { up: false, colors: [INK.gold, INK.vermilion], holesIt: true });
  rimDots(ctx, bell, 3.5, { spacing: 4, r: 1.1, seed: 5 });
  // lotus petals at the bell's foot
  lotusBand(ctx, cx - 70, cx + 70, yb, 14, { up: true, colors: [INK.gold, INK.green], holesIt: false });
  // harmika (บัลลังก์)
  const hy = yt;
  hide(ctx, [[cx - 20, hy + 2], [cx + 20, hy + 2], [cx + 22, hy - 6], [cx + 22, hy - 30], [cx + 26, hy - 34], [cx - 26, hy - 34], [cx - 22, hy - 30], [cx - 22, hy - 6]], 0, 0);
  lattice(ctx, cx - 16, hy - 26, 32, 18, { cell: 8, bar: 2, kind: 'diamond' });
  gold(ctx, [[cx - 24, hy - 32], [cx + 24, hy - 32]], 1, { smoothIt: false });
  // ก้านฉัตร + ปล้องไฉน (rings)
  const r0 = hy - 34;
  hide(ctx, rectPts(cx - 7, r0 - 14, 14, 14), 0, 0);
  const ringTop = r0 - 130;
  const prof = [];
  const nR = 10;
  for (let i = 0; i <= nR; i++) {
    const t = i / nR, y = lerp(r0 - 14, ringTop, t), w = lerp(20, 7, t);
    prof.push([cx - w, y], [cx - w - 2.2, y - 6], [cx - w * 0.96, y - (r0 - 14 - ringTop) / nR + 0.5]);
  }
  const ringPts = [...prof, [cx, ringTop - 2], ...prof.slice().reverse().map(([x, y]) => [2 * cx - x, y])];
  hide(ctx, ringPts, 0, 0);
  for (let i = 0; i < nR; i++) {
    const t = (i + 0.5) / nR, y = lerp(r0 - 14, ringTop, t) - 3, w = lerp(20, 7, t);
    gold(ctx, [[cx - w + 1, y], [cx + w - 1, y]], 0.9, { smoothIt: false });
    if (w > 10) holes(ctx, [[cx - w * 0.5, y + 3], [cx, y + 3], [cx + w * 0.5, y + 3]], 0.9);
    else hole(ctx, cx, y + 3, 0.8);
  }
  // ปลียอด + dew drop
  const pli = [[cx - 7, ringTop + 1], [cx - 4, ringTop - 50], [cx - 1.2, ringTop - 104], [cx + 1.2, ringTop - 104], [cx + 4, ringTop - 50], [cx + 7, ringTop + 1]];
  hideS(ctx, pli);
  dye(ctx, smooth(inset(pli, 1.2)), INK.gold, 0.55);
  hideS(ctx, ellipsePts(cx, ringTop - 108, 3.6, 4.8, 12));
  hide(ctx, taper([[cx, ringTop - 110], [cx, ringTop - 126]], 1.8, 0.4, { smoothIt: false }), 0, 0);
  hole(ctx, cx, ringTop - 108, 1.2);
  for (let y = ringTop - 12; y > ringTop - 90; y -= 12) hole(ctx, cx, y, 0.9);
  age(ctx, W, H, 0.3);
}

function drawPrang(ctx, { rng: r, w: W, h: H }) {
  // พระปรางค์ — corn-cob tower: stepped terraces with a stair, redented
  // body with a niche and guardian, seven petalled tiers, นภศูล trident.
  const G = H, cx = W / 2;
  moulding(ctx, 10, G - 26, W - 10, G, { dots: 1, seed: 1, r: 1.1 });
  moulding(ctx, 26, G - 50, W - 26, G - 26, { dots: 1, seed: 2, color: INK.vermilion });
  lotusBand(ctx, 30, W - 30, G - 50, 14, { up: true, seed: 3 });
  moulding(ctx, 46, G - 84, W - 46, G - 60, { dots: 1, seed: 4 });
  hide(ctx, rectPts(50, G - 64, W - 100, 14), 0, 0);
  lotusBand(ctx, 52, W - 52, G - 50 - 14, 10, { up: false, colors: [INK.gold, INK.green], holesIt: false });
  stairs(ctx, cx, G - 150, G, 36, 64, 7, { seed: 5 });
  // redented body (เรือนธาตุ)
  const by0 = G - 276, by1 = G - 84;
  const bw = 74;
  const body = [[cx - bw, by1], [cx - bw, by0 + 20], [cx - bw + 7, by0 + 20], [cx - bw + 7, by0 + 8], [cx - bw + 14, by0 + 8], [cx - bw + 14, by0], [cx + bw - 14, by0], [cx + bw - 14, by0 + 8], [cx + bw - 7, by0 + 8], [cx + bw - 7, by0 + 20], [cx + bw, by0 + 20], [cx + bw, by1]];
  hide(ctx, body, 0.4, 6);
  for (const d of [-1, 1]) {
    const x = cx + d * (bw - 12);
    gold(ctx, [[x, by0 + 24], [x, by1 - 4]], 1, { smoothIt: false });
    dotLine(ctx, [[x + d * 5, by0 + 26], [x + d * 5, by1 - 6]], { spacing: 4.2, r: 1, smoothIt: false });
    dye(ctx, poly(rectPts(Math.min(x + d * 2, x + d * 10), by0 + 24, 8, by1 - by0 - 30)), INK.green, 0.6);
  }
  // niche (ซุ้มจระนำ) with a pointed flame arch and a standing deity
  const niche = [[cx - 30, by1 - 2], [cx - 30, by0 + 62], [cx - 22, by0 + 44], [cx - 26, by0 + 30], [cx - 12, by0 + 20], [cx, by0 - 8], [cx + 12, by0 + 20], [cx + 26, by0 + 30], [cx + 22, by0 + 44], [cx + 30, by0 + 62], [cx + 30, by1 - 2]];
  dye(ctx, poly(niche), INK.gold, 0.6);
  gold(ctx, niche, 1.2, { closed: true, smoothIt: false });
  rimDots(ctx, niche, 3.2, { spacing: 3.6, r: 0.9 });
  const open = [[cx - 18, by1 - 6], [cx - 18, by0 + 66], [cx - 10, by0 + 52], [cx, by0 + 40], [cx + 10, by0 + 52], [cx + 18, by0 + 66], [cx + 18, by1 - 6]];
  cut(ctx, poly(open));
  const god = [[cx - 8, by1 - 6], [cx - 6, by1 - 36], [cx - 12, by1 - 56], [cx - 10, by1 - 66], [cx - 5, by1 - 68], [cx - 4, by1 - 76], [cx - 2, by1 - 90], [cx, by1 - 100], [cx + 2, by1 - 90], [cx + 4, by1 - 76], [cx + 5, by1 - 68], [cx + 10, by1 - 66], [cx + 12, by1 - 56], [cx + 6, by1 - 36], [cx + 8, by1 - 6]];
  hide(ctx, god, 0, 0);
  dye(ctx, poly(inset(god, 1)), INK.gold, 0.6);
  hide(ctx, taper([[cx + 12, by1 - 58], [cx + 15, by1 - 100]], 2, 1.2, { smoothIt: false }), 0, 0); // vajra staff
  // lotus waist
  moulding(ctx, cx - bw - 6, by0 - 14, cx + bw + 6, by0 + 2, { dots: 1, seed: 7, color: INK.vermilion });
  // the prang crown: tiers narrowing in a bullet curve
  const tiers = 7;
  const y0 = by0 - 14, yTop = 132;
  const prof = (t) => (bw - 2) * Math.pow(Math.cos(t * Math.PI * 0.46), 0.75) + 8 * (1 - t);
  const tierList = [];
  for (let i = 0; i < tiers; i++) {
    const ta = i / tiers, tb = (i + 1) / tiers;
    tierList.push([lerp(y0, yTop, ta), lerp(y0, yTop, tb), prof(ta), prof(tb)]);
  }
  // silhouette of the cob
  const side = [];
  tierList.forEach(([ya, yb, wa, wb]) => {
    side.push([cx - wa, ya], [cx - wa * 0.97, lerp(ya, yb, 0.35)], [cx - wb * 1.02, lerp(ya, yb, 0.62)], [cx - wb * 0.95, yb]);
  });
  const cob = [...side, [cx - 8, yTop - 12], [cx + 8, yTop - 12], ...side.slice().reverse().map(([x, y]) => [2 * cx - x, y])];
  hide(ctx, cob, 0.4, 8);
  tierList.forEach(([ya, yb, wa, wb], i) => {
    // petals (กลีบขนุน) at the corners and middle, protruding
    const ph = (ya - yb) * 1.05;
    const pet = [];
    for (const d of [-1, 1]) pet.push(petalPts(cx + d * wa * 0.93, ya - ph * 0.15, ph * 0.72, ph, -Math.PI / 2 + d * 0.32));
    pet.push(petalPts(cx, ya - ph * 0.1, ph * 0.7, ph * 0.95));
    for (const d of [-1, 1]) pet.push(petalPts(cx + d * wa * 0.5, ya - ph * 0.12, ph * 0.66, ph * 0.9, -Math.PI / 2 + d * 0.1));
    hideMany(ctx, pet);
    pet.forEach((p, k) => {
      dye(ctx, poly(p), [INK.gold, INK.gold, INK.vermilion, INK.green, INK.green][k], 0.8);
      gold(ctx, inset(p, 1.4), 0.7, { closed: true, smoothIt: false });
      hole(ctx, ...mix(p[0], p[Math.floor(p.length / 2)], 0.5), Math.max(0.8, ph * 0.05));
    });
    // band between petal rows: porcelain dot-flowers
    const my = lerp(ya, yb, 0.62);
    const hw = lerp(wa, wb, 0.62) - 8;
    for (let x = cx - hw + 8; x < cx + hw - 6; x += 12) dotFlower(ctx, x, my, 0.8, 4, 2.3);
    gold(ctx, [[cx - lerp(wa, wb, 0.3) + 4, lerp(ya, yb, 0.3)], [cx + lerp(wa, wb, 0.3) - 4, lerp(ya, yb, 0.3)]], 1, { smoothIt: false });
    if (i % 2) dye(ctx, poly(rectPts(cx - hw, lerp(ya, yb, 0.4), hw * 2, (ya - yb) * -0.45)), INK.vermilion, 0.35);
  });
  // cap + นภศูล
  const cap = ellipsePts(cx, yTop - 12, 12, 9, 18);
  hideS(ctx, cap);
  lotusBand(ctx, cx - 10, cx + 10, yTop - 10, 8, { up: true, colors: [INK.gold], holesIt: false });
  hide(ctx, taper([[cx, yTop - 16], [cx, 24]], 4.2, 2.2, { smoothIt: false }), 0, 0);
  for (const d of [-1, 1]) hide(ctx, taper([[cx, 48], [cx + d * 10, 40], [cx + d * 11, 22]], 2.4, 1), 0, 0);
  hide(ctx, rectPts(cx - 12, 50, 24, 4), 0, 0);
  hide(ctx, taper([[cx, 26], [cx, 8]], 2.6, 0.4, { smoothIt: false }), 0, 0);
  for (let y = yTop - 26; y > 60; y -= 11) hole(ctx, cx, y, 0.8);
  rimDots(ctx, body, 3.4, { spacing: 4.2, r: 1.05, seed: 9 });
  age(ctx, W, H, 0.3);
}

function drawWell(ctx, { rng: r, w: W, h: H }) {
  // บ่อน้ำ — brick well with a little tiled roof, pulley, rope and bucket.
  const G = H, cx = 120;
  // posts
  for (const x of [58, 182]) {
    hide(ctx, [[x - 5, 70], [x + 5, 70], [x + 6, 196], [x - 6, 196]], 0.4, x);
    dotLine(ctx, [[x, 80], [x, 190]], { spacing: 5, r: 1, smoothIt: false });
  }
  hide(ctx, rectPts(40, 76, 160, 8), 0.3, 3);
  dotLine(ctx, [[44, 80], [196, 80]], { spacing: 4.4, r: 0.95, smoothIt: false });
  // roof
  const roof = [[cx, 8], [cx + 104, 70], [cx + 94, 78], [cx - 94, 78], [cx - 104, 70]];
  finRow(ctx, [cx - 104, 70], [cx, 8], 9, { side: -1, seed: 4, to: 0.95 });
  finRow(ctx, [cx, 8], [cx + 104, 70], 9, { side: -1, seed: 5, from: 0.05 });
  hide(ctx, roof, 0.4, 5);
  const ri = inset(roof.slice(0, 4).concat([[cx - 94, 78]]), 5);
  tiles(ctx, poly(inset([[cx, 8], [cx + 104, 70], [cx - 104, 70]], 7)), [10, 0, 230, 80], { w: 9, rowH: 6 });
  void ri;
  gold(ctx, [[cx - 100, 71], [cx, 11], [cx + 100, 71]], 1.2, { smoothIt: false });
  hangHong(ctx, cx - 104, 72, 18, { dir: -1, w: 5 });
  hangHong(ctx, cx + 104, 72, 18, { dir: 1, w: 5 });
  chofa(ctx, cx, 10, 26, { dir: 1, w: 5 });
  // pulley + rope + bucket
  hide(ctx, rectPts(cx - 2, 84, 4, 8), 0, 0);
  const pul = ellipsePts(cx, 100, 11, 11, 20);
  hideS(ctx, pul);
  hole(ctx, cx, 100, 7);
  hide(ctx, taper([[cx - 11, 100], [cx + 11, 100]], 2), 0, 0);
  hide(ctx, taper([[cx, 89], [cx, 111]], 2), 0, 0);
  hideS(ctx, ellipsePts(cx, 100, 3, 3, 10));
  hide(ctx, taper([[cx + 10.5, 102], [cx + 10, 146]], 1.5), 0, 0);
  hide(ctx, taper([[cx - 10.5, 102], [cx - 14, 150], [cx - 24, 176], [cx - 40, 192]], 1.3), 0, 0);
  const bucket = [[cx - 4, 150], [cx + 24, 150], [cx + 21, 176], [cx - 1, 176]];
  hide(ctx, taper([[cx - 3, 151], [cx + 10, 140], [cx + 23, 151]], 1.6), 0, 0);
  hide(ctx, bucket, 0.2, 6);
  dye(ctx, poly(inset(bucket, 1.5)), INK.brown, 0.6);
  for (const y of [155, 170]) gold(ctx, [[cx - 3, y], [cx + 23, y]], 1, { smoothIt: false });
  dotLine(ctx, [[cx + 1, 162.5], [cx + 20, 162.5]], { spacing: 3.4, r: 0.8, smoothIt: false });
  // the well: brick drum with a thick lip
  const drum = [[40, G], [40, 206], [200, 206], [200, G]];
  hide(ctx, drum, 0.5, 7);
  bricks(ctx, poly(inset(drum, 2)), 40, 212, 200, G - 4, { bw: 18, bh: 9 });
  dye(ctx, poly(rectPts(40, G - 22, 160, 22)), INK.green, 0.45);
  const lip = [[32, 196], [208, 196], [210, 204], [204, 210], [36, 210], [30, 204]];
  hideS(ctx, lip);
  dye(ctx, smooth(inset(lip, 1.5)), INK.vermilion, 0.7);
  dotLine(ctx, [[36, 203], [204, 203]], { spacing: 4, r: 1.05, smoothIt: false });
  // moss tufts at the base
  for (let x = 44; x < 200; x += 14 + r() * 6) hideMany(ctx, [kanokPts(x, G, 8 + r() * 5, -Math.PI / 2 + (r() - 0.5) * 0.8, r() < 0.5)]);
  // water jar with a coconut-shell dipper (กะลา)
  const jx = 226;
  const jar = [[jx - 14, G], [jx - 20, G - 12], [jx - 22, G - 28], [jx - 16, G - 40], [jx - 8, G - 45], [jx + 8, G - 45], [jx + 16, G - 40], [jx + 22, G - 28], [jx + 20, G - 12], [jx + 14, G]];
  hideS(ctx, jar);
  dye(ctx, smooth(inset(jar, 2.5)), INK.brown, 0.6);
  gold(ctx, [[jx - 20, G - 28], [jx + 20, G - 28]], 1, { smoothIt: false });
  dotLine(ctx, [[jx - 16, G - 20], [jx, G - 14], [jx + 16, G - 20]], { spacing: 3.4, r: 0.9 });
  hide(ctx, taper([[jx - 4, G - 46], [jx + 18, G - 64]], 2), 0, 0);
  hideS(ctx, [[jx + 12, G - 64], [jx + 26, G - 64], [jx + 22, G - 56], [jx + 16, G - 56]]);
  age(ctx, W, H, 0.3);
}

function drawBridge(ctx, { rng: r, w: W, h: H }) {
  // สะพานไม้ — humped plank footbridge on posts with X-braced railings.
  const G = H, cx = W / 2;
  const deckY = (x) => 150 - 58 * Math.pow(Math.sin((x / W) * Math.PI), 1.3);
  const top = [], bot = [];
  for (let x = 6; x <= W - 6; x += 10) { top.push([x, deckY(x)]); bot.push([x, deckY(x) + 19]); }
  // posts into the water/ground
  for (const x of [70, 150, 230, 410, 490, 570]) {
    const y = deckY(x) + 10;
    hide(ctx, [[x - 8, y], [x + 8, y], [x + 9, G], [x - 9, G]], 0.5, x);
    dotLine(ctx, [[x, y + 12], [x, G - 8]], { spacing: 5, r: 1, smoothIt: false });
    for (let yy = y + 30; yy < G - 10; yy += 34) slit(ctx, [[x - 5, yy], [x + 5, yy + 2]], 1, { smoothIt: false });
  }
  for (const [a, b] of [[70, 150], [150, 230], [410, 490], [490, 570]]) {
    hide(ctx, taper([[a, deckY(a) + 24], [b, G - 30]], 4.5), 0, 0);
    hide(ctx, taper([[b, deckY(b) + 24], [a, G - 30]], 4.5), 0, 0);
  }
  // deck
  const deck = [...top, ...bot.slice().reverse()];
  hideS(ctx, deck);
  dye(ctx, smooth(inset(deck, 2.5)), INK.vermilion, 0.6);
  for (let x = 12; x < W - 10; x += 8) slit(ctx, [[x, deckY(x) + 4], [x, deckY(x) + 15]], 0.9, { smoothIt: false });
  gold(ctx, top.map(([x, y]) => [x, y + 1.2]), 1);
  // railing
  const railH = 44;
  const rail = top.map(([x, y]) => [x, y - railH]);
  const railTop = [...rail.map(([x, y]) => [x, y - 5]), ...rail.slice().reverse().map(([x, y]) => [x, y + 5])];
  hideS(ctx, railTop);
  gold(ctx, rail, 1);
  const pxs = [];
  for (let x = 20; x <= W - 20; x += 50) pxs.push(x);
  pxs.forEach((x) => {
    const y = deckY(x);
    hide(ctx, [[x - 5, y - railH - 8], [x + 5, y - railH - 8], [x + 5, y], [x - 5, y]], 0.2, x);
    // lotus-bud finial (หัวเม็ด)
    hideS(ctx, [[x - 6, y - railH - 6], [x - 7, y - railH - 13], [x - 3, y - railH - 20], [x, y - railH - 27], [x + 3, y - railH - 20], [x + 7, y - railH - 13], [x + 6, y - railH - 6]]);
    dye(ctx, smooth([[x - 4, y - railH - 8], [x - 4.5, y - railH - 13], [x, y - railH - 23], [x + 4.5, y - railH - 13], [x + 4, y - railH - 8]]), INK.gold, 0.7);
    hole(ctx, x, y - railH - 14, 1);
  });
  for (let i = 0; i < pxs.length - 1; i++) {
    const a = pxs[i], b = pxs[i + 1];
    hide(ctx, taper([[a + 3, deckY(a) - railH + 4], [b - 3, deckY(b) - 3]], 4), 0, 0);
    hide(ctx, taper([[b - 3, deckY(b) - railH + 4], [a + 3, deckY(a) - 3]], 4), 0, 0);
    const m = (a + b) / 2;
    hole(ctx, m, deckY(m) - railH / 2 - 1, 1.3);
  }
  edgeDots(ctx, rail.slice(1, -1), 0, { spacing: 4.4, r: 0.95, smoothIt: true });
  // small lanterns hung at the crown
  for (const x of [cx - 25, cx + 25]) {
    const y = deckY(x) - railH;
    hide(ctx, taper([[x, y], [x, y + 10]], 1.2), 0, 0);
    const lan = blobPts(x, y + 17, 6, 8, { seed: x });
    hideS(ctx, lan);
    dye(ctx, smooth(inset(lan, 1)), INK.vermilion, 0.85);
    gold(ctx, [[x - 5, y + 17], [x + 5, y + 17]], 0.7, { smoothIt: false });
    hide(ctx, taper([[x, y + 25], [x, y + 32]], 1.4, 0.6), 0, 0);
  }
  age(ctx, W, H, 0.3);
}

function drawFence(ctx, { rng: r, w: W, h: H }) {
  // รั้วไม้ไผ่ — bamboo pickets with slanted cut tops, two lashed rails.
  const G = H;
  const poles = [];
  for (let x = 10; x < W - 4; x += 19 + r() * 3) poles.push(x);
  poles.forEach((x, i) => {
    const h = 118 + (i % 3 === 1 ? 22 : 0) + r() * 12;
    const w = 11 + r() * 2;
    const yt = G - h;
    const slant = (r() < 0.5 ? -1 : 1) * 9;
    const pts = [[x - w / 2, G], [x - w / 2, yt + (slant > 0 ? slant : 0)], [x + w / 2, yt + (slant < 0 ? -slant : 0)], [x + w / 2, G]];
    hide(ctx, pts, 0.4, i);
    // hollow cut end
    hideS(ctx, ellipsePts(x, yt + Math.abs(slant) / 2, w * 0.36, 2, 10));
    // nodes
    for (let y = G - 28 - r() * 8; y > yt + 20; y -= 34 + r() * 6) {
      slit(ctx, [[x - w / 2 + 1.5, y], [x + w / 2 - 1.5, y - 1]], 1.1, { smoothIt: false });
      hole(ctx, x - w * 0.18, y - 4, 0.8);
    }
    dotLine(ctx, [[x + w * 0.2, yt + 14], [x + w * 0.2, G - 8]], { spacing: 6, r: 0.8, seed: i, smoothIt: false });
    if (i % 2) dye(ctx, poly(inset(pts, 2)), INK.green, 0.28);
  });
  // rails in front
  for (const y of [G - 44, G - 104]) {
    const rail = [[0, y - 5], [W, y - 6], [W, y + 5], [0, y + 6]];
    hide(ctx, rail, 0.5, y);
    for (let x = 30; x < W; x += 58) slit(ctx, [[x, y - 4], [x + 1, y + 4]], 1, { smoothIt: false });
    gold(ctx, [[2, y], [W - 2, y - 1]], 0.8, { smoothIt: false });
    // lashings
    poles.forEach((x) => {
      hide(ctx, [[x - 4, y - 8], [x + 4, y - 8], [x + 4, y + 8], [x - 4, y + 8]], 0, 0);
      slit(ctx, [[x - 3.5, y - 6], [x + 3.5, y + 6]], 1, { smoothIt: false });
      slit(ctx, [[x + 3.5, y - 6], [x - 3.5, y + 6]], 1, { smoothIt: false });
    });
  }
  // a morning glory vine (ผักบุ้ง) winding along the top rail
  const vine = [];
  for (let x = 0; x <= W; x += 12) vine.push([x, G - 104 + Math.sin(x * 0.05) * 12]);
  hide(ctx, taper(vine, 2), 0, 0);
  for (let i = 2; i < vine.length - 1; i += 3) {
    const [x, y] = vine[i];
    const up = i % 2 ? -1 : 1;
    const lf = kanokPts(x, y, 11, up < 0 ? -Math.PI / 2 - 0.5 : Math.PI / 2 + 0.4, i % 4 === 0);
    hideMany(ctx, [lf]);
    dye(ctx, poly(lf), INK.green, 0.7);
    if (i % 6 === 2) {
      const f = ellipsePts(x + 6, y + up * 10, 6, 6, 5);
      hideS(ctx, f);
      dye(ctx, smooth(f), INK.pink, 0.9);
      hole(ctx, x + 6, y + up * 10, 1.4);
    }
  }
  age(ctx, W, H, 0.25);
}

function drawUbosot(ctx, { rng: r, w: W, h: H }) {
  // โบสถ์ — gable front: three overlapping tiers (ซ้อน), side eave wings
  // (ลด), porch columns with valances, a crowned doorway with the seated
  // Buddha, lotus base, naga stair rails and bai sema at the corners.
  const G = H, cx = W / 2;
  const baseTop = G - 76;
  // ---- base (ฐานบัว)
  moulding(ctx, 64, G - 30, W - 64, G, { dots: 2, r: 1.2, seed: 1 });
  moulding(ctx, 84, G - 56, W - 84, G - 30, { color: INK.vermilion, dots: 1, seed: 2 });
  lotusBand(ctx, 88, W - 88, G - 31, 18, { up: true, seed: 3 });
  moulding(ctx, 96, baseTop, W - 96, G - 56, { dots: 1, seed: 4, r: 0.95 });
  lotusBand(ctx, 100, W - 100, baseTop + 2, 13, { up: false, colors: [INK.gold, INK.green], seed: 5, holesIt: false });
  for (const x of [34, W - 34]) {
    const sp = semaPts(x, G - 12, 38, 78);
    hide(ctx, sp, 0, 0);
    hide(ctx, [[x - 26, G], [x - 22, G - 14], [x + 22, G - 14], [x + 26, G]], 0, 0);
    lotusBand(ctx, x - 20, x + 20, G - 13, 8, { up: true, colors: [INK.gold, INK.green], holesIt: false, edge: true });
    dye(ctx, poly(inset(sp, 3)), INK.gold, 0.45);
    gold(ctx, inset(sp, 3), 0.9, { closed: true, smoothIt: false });
    prajamYam(ctx, x, G - 46, 9, { color: INK.red, petal: INK.gold });
    rimDots(ctx, sp, 6, { spacing: 3.8, r: 0.85 });
    dotLine(ctx, [[x, G - 76], [x, G - 60]], { spacing: 3.6, r: 0.8, smoothIt: false });
  }
  // ---- main hall body
  const eaveY = 332;
  const bodyL = 140, bodyR = W - 140;
  const body = [[bodyL, eaveY], [bodyR, eaveY], [bodyR + 4, baseTop], [bodyL - 4, baseTop]];
  hide(ctx, body, 0.5, 6);
  // wall panels: tall gold frames with dotted lozenges between bays
  const colX = [206, 290, W - 290, W - 206];
  for (const [x0, x1] of [[bodyL + 6, colX[0] - 13], [colX[3] + 13, bodyR - 6]]) {
    const pp = [[x0, eaveY + 58], [x1, eaveY + 58], [x1, baseTop - 14], [x0, baseTop - 14]];
    panel(ctx, pp, { color: INK.green, alpha: 0.4, d: 2, spacing: 3.8, r: 0.9 });
    for (let y = eaveY + 86; y < baseTop - 30; y += 34) prajamYam(ctx, (x0 + x1) / 2, y, 7, { color: INK.red, petal: INK.gold });
  }
  // windows in the bays between the outer and inner columns
  for (const x of [(colX[0] + colX[1]) / 2, (colX[2] + colX[3]) / 2]) {
    const wy0 = 440, wy1 = 540;
    const fr = [[x - 25, wy1 + 8], [x - 25, wy0], [x - 16, wy0 - 12], [x - 21, wy0 - 28], [x - 9, wy0 - 42], [x, wy0 - 76], [x + 9, wy0 - 42], [x + 21, wy0 - 28], [x + 16, wy0 - 12], [x + 25, wy0], [x + 25, wy1 + 8]];
    dye(ctx, poly(fr), INK.gold, 0.55);
    gold(ctx, fr, 1.2, { closed: true, smoothIt: false });
    rimDots(ctx, fr, 3.2, { spacing: 3.6, r: 0.9 });
    dotFill(ctx, poly(inset(fr.slice(2, 9), 5)), [x - 20, wy0 - 70, x + 20, wy0 - 8], { pattern: 'hex', spacing: 5, r: 0.8 });
    cut(ctx, poly(rectPts(x - 15, wy0, 30, wy1 - wy0)));
    for (let bx = x - 9; bx <= x + 9; bx += 9) hide(ctx, [[bx - 1.4, wy0], [bx + 1.4, wy0], [bx + 2.8, wy0 + 50], [bx + 1.4, wy1], [bx - 1.4, wy1], [bx - 2.8, wy0 + 50]], 0, 0);
    hide(ctx, rectPts(x - 17, wy1 - 2, 34, 6), 0, 0);
  }
  // ---- crowned doorway (ซุ้มประตูทรงมงกุฎ)
  const dx0 = cx - 42, dx1 = cx + 42, dy0 = 450;
  const arch = [[dx0 - 16, baseTop], [dx0 - 16, dy0 - 4], [dx0 - 4, dy0 - 20], [dx0 - 10, dy0 - 36], [cx - 30, dy0 - 50], [cx - 22, dy0 - 70], [cx - 10, dy0 - 82], [cx, dy0 - 124], [cx + 10, dy0 - 82], [cx + 22, dy0 - 70], [cx + 30, dy0 - 50], [dx1 + 10, dy0 - 36], [dx1 + 4, dy0 - 20], [dx1 + 16, dy0 - 4], [dx1 + 16, baseTop]];
  dye(ctx, poly(arch), INK.gold, 0.6);
  gold(ctx, arch, 1.3, { closed: true, smoothIt: false });
  rimDots(ctx, arch, 3.4, { spacing: 3.8, r: 0.95, seed: 11 });
  dotFill(ctx, poly(inset(arch.slice(3, 12), 7)), [cx - 60, dy0 - 120, cx + 60, dy0], { pattern: 'flowers', spacing: 9, r: 0.9, seed: 12 });
  cut(ctx, poly([[dx0, baseTop], [dx0, dy0], [cx - 30, dy0 - 18], [cx, dy0 - 28], [cx + 30, dy0 - 18], [dx1, dy0], [dx1, baseTop]]));
  // the Buddha on a lotus pedestal, glowing gold in the doorway
  hide(ctx, [[cx - 32, baseTop], [cx - 26, baseTop - 12], [cx + 26, baseTop - 12], [cx + 32, baseTop]], 0, 0);
  lotusBand(ctx, cx - 26, cx + 26, baseTop - 10, 10, { up: true, colors: [INK.gold, INK.vermilion], holesIt: false, edge: true });
  buddha(ctx, cx, baseTop - 20, 118);
  for (const d of [-1, 1]) {
    const x = d < 0 ? dx0 : dx1;
    const leaf = [[x, dy0 + 2], [x + d * 13, dy0 + 8], [x + d * 13, baseTop - 4], [x, baseTop]];
    hide(ctx, leaf, 0, 0);
    dye(ctx, poly(inset(leaf, 2)), INK.vermilion, 0.8);
    dotLine(ctx, inset(leaf, 3.6), { closed: true, spacing: 3.6, r: 0.8, smoothIt: false });
  }
  colX.forEach((x, i) => column(ctx, x, eaveY + 30, baseTop, 20, { seed: i, color: INK.green }));
  valance(ctx, colX[0] + 12, colX[1] - 12, eaveY + 16, 36, { seed: 21 });
  valance(ctx, colX[2] + 12, colX[3] - 12, eaveY + 16, 36, { seed: 22 });
  // ---- stairs with naga balustrades
  stairs(ctx, cx, baseTop + 4, G, 92, 120, 5, { seed: 30 });
  nagaRail(ctx, [cx - 52, baseTop - 2], [cx - 74, G - 2], 74, -1, { seed: 31 });
  nagaRail(ctx, [cx + 52, baseTop - 2], [cx + 74, G - 2], 74, 1, { seed: 32 });
  // ---- beam under the gables
  const beamPts = [[124, eaveY], [W - 124, eaveY], [W - 130, eaveY + 18], [130, eaveY + 18]];
  hide(ctx, beamPts, 0.3, 30);
  dye(ctx, poly(inset(beamPts, 2)), INK.red, 0.8);
  dotLine(ctx, [[134, eaveY + 9], [W - 134, eaveY + 9]], { spacing: 4, r: 1.15, smoothIt: false });
  // ---- side wings (ลด), with brackets
  for (const d of [-1, 1]) {
    const inner = [cx + d * 160, 262], outer = [cx + d * 334, 362];
    const wing = [inner, outer, [outer[0] - d * 8, outer[1] + 12], [cx + d * 150, eaveY + 14]];
    finRow(ctx, inner, outer, 14, { side: d < 0 ? 1 : -1, seed: 40 + d, gap: 0.5, lean: 0.8, to: 0.94 });
    hide(ctx, wing, 0.4, 41 + d);
    tiles(ctx, poly(inset(wing, 4)), [cx - 340, 250, cx + 340, 380], { w: 12, rowH: 7.5, lw: 1.2 });
    const eb = [mix(inner, outer, 0.02), outer];
    dye(ctx, poly(taper(eb, 7, 7, { smoothIt: false })), INK.gold, 0.5);
    edgeDots(ctx, eb, 0, { spacing: 4.4, r: 1.05, smoothIt: false, seed: 43 + d });
    hangHong(ctx, outer[0] - d * 2, outer[1] + 4, 40, { dir: d, w: 9 });
    kantuay(ctx, cx + d * (bodyR - cx + 2), eaveY + 12, eaveY + 80, 50, d, { seed: 44 + d });
  }
  // ---- roof tiers, back to front (steep: Thai gables rise ~55°)
  thaiGable(ctx, cx, 70, 262, 128, { board: 13, fin: 17, chofaH: 76, hhS: 30, panelColor: INK.red, motif: 'none', seed: 50 });
  thaiGable(ctx, cx, 120, 300, 142, { board: 13, fin: 17, chofaH: 70, hhS: 34, panelColor: INK.red, motif: 'none', seed: 60 });
  const g = thaiGable(ctx, cx, 164, 338, 158, { board: 14, fin: 18, chofaH: 68, hhS: 38, panelColor: INK.vermilion, motif: 'none', seed: 70 });
  // gable centre: Narai's Garuda among kanok scrolls
  garuda(ctx, cx, 270, 82, { seed: 71 });
  for (const d of [-1, 1]) {
    kanokScroll(ctx, cx + d * 70, 306, 20, { dir: -d, a0: d > 0 ? Math.PI : 0, seed: 72 + d });
    kanokScroll(ctx, cx + d * 108, 318, 13, { dir: -d, a0: d > 0 ? Math.PI * 0.8 : Math.PI * 0.2, seed: 74 + d, leaves: 3 });
  }
  void g;
  age(ctx, W, H, 0.3);
}

// Seated Buddha in meditation, with flame ushnisha and a pointed nimbus.
function buddha(ctx, cx, yb, s) {
  const nim = [[cx - s * 0.36, yb - s * 0.2], [cx - s * 0.36, yb - s * 0.62], [cx - s * 0.22, yb - s * 0.86], [cx, yb - s * 1.08], [cx + s * 0.22, yb - s * 0.86], [cx + s * 0.36, yb - s * 0.62], [cx + s * 0.36, yb - s * 0.2]];
  hideS(ctx, nim);
  dye(ctx, smooth(nim), INK.vermilion, 0.55);
  rimDots(ctx, nim, 3, { spacing: 3.4, r: 0.85 });
  const b = [
    [cx - s * 0.46, yb], [cx - s * 0.47, yb - s * 0.1], [cx - s * 0.34, yb - s * 0.2], [cx - s * 0.24, yb - s * 0.24],
    [cx - s * 0.23, yb - s * 0.46], [cx - s * 0.17, yb - s * 0.54], [cx - s * 0.07, yb - s * 0.57], [cx - s * 0.06, yb - s * 0.62],
    [cx - s * 0.11, yb - s * 0.7], [cx - s * 0.1, yb - s * 0.8], [cx - s * 0.05, yb - s * 0.86], [cx - s * 0.02, yb - s * 0.9],
    [cx, yb - s * 1.02], [cx + s * 0.02, yb - s * 0.9], [cx + s * 0.05, yb - s * 0.86], [cx + s * 0.1, yb - s * 0.8],
    [cx + s * 0.11, yb - s * 0.7], [cx + s * 0.06, yb - s * 0.62], [cx + s * 0.07, yb - s * 0.57], [cx + s * 0.17, yb - s * 0.54],
    [cx + s * 0.23, yb - s * 0.46], [cx + s * 0.24, yb - s * 0.24], [cx + s * 0.34, yb - s * 0.2], [cx + s * 0.47, yb - s * 0.1], [cx + s * 0.46, yb],
  ];
  hideS(ctx, b);
  dye(ctx, smooth(inset(b, 1.6)), INK.gold, 0.8);
  // robe line, crossed legs, hands in the lap, ears
  gold(ctx, [[cx - s * 0.4, yb - s * 0.08], [cx - s * 0.1, yb - s * 0.16], [cx + s * 0.4, yb - s * 0.08]], 1);
  line(ctx, [[cx - s * 0.2, yb - s * 0.24], [cx, yb - s * 0.2], [cx + s * 0.2, yb - s * 0.24]], INK.leather, 1.4);
  line(ctx, [[cx - s * 0.17, yb - s * 0.52], [cx - s * 0.04, yb - s * 0.3], [cx + s * 0.1, yb - s * 0.5]], INK.leather, 1.2);
  for (const d of [-1, 1]) line(ctx, [[cx + d * s * 0.08, yb - s * 0.76], [cx + d * s * 0.1, yb - s * 0.66]], INK.leather, 1.2, { smoothIt: false });
  hole(ctx, cx - s * 0.035, yb - s * 0.745, 0.8);
  hole(ctx, cx + s * 0.035, yb - s * 0.745, 0.8);
  dotLine(ctx, [[cx - s * 0.06, yb - s * 0.84], [cx + s * 0.06, yb - s * 0.84]], { spacing: 2.6, r: 0.6, smoothIt: false });
}

function drawPalace(ctx, { rng: r, w: W, h: H }) {
  // ปราสาทราชวัง — the palace backdrop, after the Chakri Maha Prasat
  // scheme: three halls each crowned by a tiered spire, the central throne
  // hall tallest, raised on a lotus plinth behind a crenellated wall with a
  // gate. Royal umbrellas stand at both ends.
  const G = H, cx = W / 2;
  const F = G - 146; // hall floor
  const wy = G - 100; // wall top
  // ---- royal umbrellas at the ends (behind the wall)
  umbrella(ctx, 38, wy + 10, 330, { tiers: 5, w: 54, seed: 1 });
  umbrella(ctx, W - 38, wy + 10, 330, { tiers: 5, w: 54, seed: 2 });
  // ---- spires (behind the gables)
  spire(ctx, cx, 350, 214, 334, { tiers: 6, seed: 3, finial: 0.36 });
  for (const d of [-1, 1]) spire(ctx, cx + d * 262, 370, 124, 210, { tiers: 4, seed: 4 + d, finial: 0.38 });
  // ---- plinth (ฐานไพที) behind the wall
  moulding(ctx, 60, F, W - 60, F + 16, { dots: 1, seed: 5, color: INK.vermilion });
  lotusBand(ctx, 64, W - 64, F + 15, 12, { up: false, colors: [INK.gold, INK.green], holesIt: false });
  moulding(ctx, 50, F + 16, W - 50, wy + 10, { dots: 2, seed: 6 });
  // ---- side wings
  for (const d of [-1, 1]) {
    const wx = cx + d * 262;
    const wTop = 506;
    const wb = [[wx - 104, wTop], [wx + 104, wTop], [wx + 108, F], [wx - 108, F]];
    hide(ctx, wb, 0.5, 10 + d);
    for (const k of [-1, 1]) {
      const x = wx + k * 50;
      const y0 = wTop + 70, y1 = F - 34;
      const fr = [[x - 20, y1 + 6], [x - 20, y0], [x - 13, y0 - 10], [x - 16, y0 - 22], [x - 6, y0 - 32], [x, y0 - 56], [x + 6, y0 - 32], [x + 16, y0 - 22], [x + 13, y0 - 10], [x + 20, y0], [x + 20, y1 + 6]];
      dye(ctx, poly(fr), INK.gold, 0.55);
      gold(ctx, fr, 1.1, { closed: true, smoothIt: false });
      rimDots(ctx, fr, 3, { spacing: 3.6, r: 0.85 });
      dotFill(ctx, poly(inset(fr.slice(2, 9), 4)), [x - 16, y0 - 52, x + 16, y0 - 8], { pattern: 'hex', spacing: 4.6, r: 0.75 });
      cut(ctx, poly(rectPts(x - 12, y0, 24, y1 - y0)));
      hide(ctx, rectPts(x - 12, y0 + 34, 24, 3), 0, 0);
      hide(ctx, rectPts(x - 1.4, y0, 2.8, y1 - y0), 0, 0);
      lattice(ctx, x - 12, y0, 24, 33, { cell: 6, bar: 1.6, kind: 'diamond' });
      hide(ctx, rectPts(x - 15, y1, 30, 5), 0, 0);
    }
    // wing door with a crowned frame
    const df = [[wx - 26, F], [wx - 26, wTop + 96], [wx - 12, wTop + 76], [wx - 16, wTop + 62], [wx, wTop + 36], [wx + 16, wTop + 62], [wx + 12, wTop + 76], [wx + 26, wTop + 96], [wx + 26, F]];
    dye(ctx, poly(df), INK.vermilion, 0.75);
    gold(ctx, df, 1, { closed: true, smoothIt: false });
    rimDots(ctx, df, 3, { spacing: 3.6, r: 0.9 });
    cut(ctx, poly([[wx - 15, F], [wx - 15, wTop + 104], [wx, wTop + 90], [wx + 15, wTop + 104], [wx + 15, F]]));
    // a guard with a spear at the door
    guard(ctx, wx, F, 70, d);
    for (const k of [-1, 1]) column(ctx, wx + k * 88, wTop + 30, F, 15, { seed: 12 + k, color: INK.green });
    const beam = [[wx - 112, wTop], [wx + 112, wTop], [wx + 110, wTop + 14], [wx - 110, wTop + 14]];
    hide(ctx, beam, 0.2, 13);
    dye(ctx, poly(inset(beam, 2)), INK.red, 0.8);
    dotLine(ctx, [[wx - 106, wTop + 7], [wx + 106, wTop + 7]], { spacing: 4, r: 1.05, smoothIt: false });
    valance(ctx, wx - 80, wx - 30, wTop + 13, 24, { seed: 14 + d });
    valance(ctx, wx + 30, wx + 80, wTop + 13, 24, { seed: 15 + d });
    // outer eave wing
    const inner = [wx + d * 70, 470], outer = [wx + d * 150, 530];
    const wing = [inner, outer, [outer[0] - d * 6, outer[1] + 10], [wx + d * 70, wTop + 12]];
    finRow(ctx, inner, outer, 12, { side: d < 0 ? 1 : -1, seed: 16 + d, lean: 0.8, to: 0.94 });
    hide(ctx, wing, 0.3, 17);
    tiles(ctx, poly(inset(wing, 3)), [wx - 160, 460, wx + 160, 540], { w: 10, rowH: 6.5 });
    dye(ctx, poly(taper([mix(inner, outer, 0.03), outer], 6, 6, { smoothIt: false })), INK.gold, 0.5);
    hangHong(ctx, outer[0] - d * 2, outer[1] + 4, 32, { dir: d, w: 8 });
    kantuay(ctx, wx + d * 106, wTop + 8, wTop + 64, 36, d, { seed: 18 + d });
    thaiGable(ctx, wx, 336, 470, 96, { board: 11, fin: 14, chofaH: 58, hhS: 28, panelColor: INK.red, motif: 'none', seed: 18 + d });
    thaiGable(ctx, wx, 376, 506, 112, { board: 11, fin: 14, chofaH: 54, hhS: 30, panelColor: INK.vermilion, motif: 'scroll', seed: 20 + d });
  }
  // ---- central throne hall
  const hb = [[cx - 150, 470], [cx + 150, 470], [cx + 156, F], [cx - 156, F]];
  hide(ctx, hb, 0.5, 30);
  const colX = [cx - 130, cx - 70, cx + 70, cx + 130];
  const tA = [[cx - 56, F], [cx - 56, 566], [cx - 44, 546], [cx - 50, 530], [cx - 30, 514], [cx - 20, 494], [cx, 446], [cx + 20, 494], [cx + 30, 514], [cx + 50, 530], [cx + 44, 546], [cx + 56, 566], [cx + 56, F]];
  dye(ctx, poly(tA), INK.gold, 0.6);
  gold(ctx, tA, 1.3, { closed: true, smoothIt: false });
  rimDots(ctx, tA, 3.4, { spacing: 3.6, r: 0.95 });
  dotFill(ctx, poly(inset(tA.slice(3, 10), 6)), [cx - 50, 446, cx + 50, 546], { pattern: 'flowers', spacing: 9, r: 0.9, seed: 31 });
  cut(ctx, poly([[cx - 40, F], [cx - 40, 568], [cx - 26, 554], [cx, 542], [cx + 26, 554], [cx + 40, 568], [cx + 40, F]]));
  // throne (บัลลังก์) + seated king under two small umbrellas
  const thr = [[cx - 34, F], [cx - 29, F - 16], [cx - 36, F - 24], [cx + 36, F - 24], [cx + 29, F - 16], [cx + 34, F]];
  hide(ctx, thr, 0, 0);
  dye(ctx, poly(inset(thr, 1.5)), INK.gold, 0.7);
  dotLine(ctx, [[cx - 27, F - 10], [cx + 27, F - 10]], { spacing: 3.4, r: 0.85, smoothIt: false });
  king(ctx, cx, F - 22, 104);
  umbrella(ctx, cx - 31, F - 26, 116, { tiers: 3, w: 22, seed: 32 });
  umbrella(ctx, cx + 31, F - 26, 116, { tiers: 3, w: 22, seed: 33 });
  colX.forEach((x, i) => column(ctx, x, 500, F, 17, { seed: 34 + i, color: i % 3 ? INK.vermilion : INK.green }));
  for (const k of [-1, 1]) {
    const x0 = k < 0 ? colX[0] + 10 : colX[2] + 10, x1 = k < 0 ? colX[1] - 10 : colX[3] - 10;
    const pp = [[x0, 540], [x1, 540], [x1, F - 14], [x0, F - 14]];
    panel(ctx, pp, { color: INK.green, alpha: 0.5, d: 1.5, spacing: 3.6, r: 0.85 });
    lattice(ctx, x0 + 8, 556, x1 - x0 - 16, 90, { cell: 7, bar: 1.8, kind: 'diamond' });
    prajamYam(ctx, (x0 + x1) / 2, F - 44, 8, { color: INK.red, petal: INK.gold });
  }
  const beam = [[cx - 160, 470], [cx + 160, 470], [cx + 156, 488], [cx - 156, 488]];
  hide(ctx, beam, 0.2, 36);
  dye(ctx, poly(inset(beam, 2)), INK.red, 0.8);
  dotLine(ctx, [[cx - 152, 479], [cx + 152, 479]], { spacing: 4, r: 1.15, smoothIt: false });
  valance(ctx, colX[0] + 11, colX[1] - 11, 486, 30, { seed: 37 });
  valance(ctx, colX[2] + 11, colX[3] - 11, 486, 30, { seed: 38 });
  for (const d of [-1, 1]) kantuay(ctx, cx + d * 148, 470, 540, 40, d, { seed: 39 + d });
  thaiGable(ctx, cx, 262, 404, 126, { board: 12, fin: 16, chofaH: 70, hhS: 30, panelColor: INK.red, motif: 'none', seed: 40 });
  thaiGable(ctx, cx, 300, 440, 142, { board: 12, fin: 16, chofaH: 64, hhS: 34, panelColor: INK.red, motif: 'none', seed: 41 });
  thaiGable(ctx, cx, 336, 472, 160, { board: 13, fin: 17, chofaH: 62, hhS: 38, panelColor: INK.vermilion, motif: 'none', seed: 42 });
  garuda(ctx, cx, 418, 76, { seed: 43 });
  for (const d of [-1, 1]) {
    kanokScroll(ctx, cx + d * 66, 448, 16, { dir: -d, a0: d > 0 ? Math.PI : 0, seed: 44 + d });
    kanokScroll(ctx, cx + d * 102, 458, 11, { dir: -d, a0: d > 0 ? Math.PI * 0.8 : Math.PI * 0.2, seed: 46 + d, leaves: 3 });
  }
  // ---- front wall with ใบเสมา crenellations and the gate
  const gw = 62;
  const wall = [[0, wy], [W, wy], [W, G], [0, G]];
  const merlons = [];
  for (let x = 16; x < W - 6; x += 30) if (Math.abs(x - cx) > gw + 14) merlons.push(semaPts(x, wy + 2, 20, 30));
  hideMany(ctx, merlons);
  merlons.forEach((m, i) => { dye(ctx, poly(inset(m, 2.2)), i % 2 ? INK.gold : INK.vermilion, 0.6); hole(ctx, m[Math.floor(m.length / 2)][0], wy - 14, 1.1); });
  hide(ctx, wall, 0.5, 50);
  bricks(ctx, poly(inset(wall, 3)), 0, wy + 26, W, G - 18, { bw: 26, bh: 12, dots: true, r: 0.85 });
  moulding(ctx, 0, wy, W, wy + 20, { dots: 1, seed: 51, color: INK.vermilion });
  moulding(ctx, 0, G - 18, W, G, { dots: 1, seed: 52 });
  for (let x = 60; x < W - 40; x += 96) if (Math.abs(x - cx) > 110) prajamYam(ctx, x, wy + 50, 11, { color: INK.red, petal: INK.gold });
  // gate: pillars with lotus-bud tops and a flame arch
  for (const d of [-1, 1]) {
    const px = cx + d * (gw - 6);
    hide(ctx, rectPts(px - 12, wy - 24, 24, G - wy + 24), 0.3, 55 + d);
    const bud = [[px - 12, wy - 22], [px - 13, wy - 34], [px - 7, wy - 46], [px, wy - 62], [px + 7, wy - 46], [px + 13, wy - 34], [px + 12, wy - 22]];
    hideS(ctx, bud);
    dye(ctx, smooth(inset(bud, 2)), INK.gold, 0.7);
    dye(ctx, poly(rectPts(px - 8, wy - 18, 16, G - wy + 4)), INK.green, 0.55);
    dotLine(ctx, [[px, wy - 14], [px, G - 22]], { spacing: 4, r: 1, smoothIt: false });
  }
  const arch = [[cx - gw + 6, wy + 8], [cx - 36, wy - 8], [cx - 18, wy - 16], [cx, wy - 34], [cx + 18, wy - 16], [cx + 36, wy - 8], [cx + gw - 6, wy + 8], [cx + gw - 6, wy + 22], [cx - gw + 6, wy + 22]];
  hide(ctx, arch, 0, 0);
  dye(ctx, poly(inset(arch, 2)), INK.gold, 0.65);
  rimDots(ctx, arch, 2.6, { spacing: 3.4, r: 0.85 });
  const gin = [[cx - gw + 18, G], [cx - gw + 18, wy + 22], [cx + gw - 18, wy + 22], [cx + gw - 18, G]];
  cut(ctx, poly(gin));
  for (const d of [-1, 1]) {
    const x = cx + d * (gw - 18);
    const leaf = [[x, wy + 24], [x - d * 14, wy + 30], [x - d * 14, G - 4], [x, G]];
    hide(ctx, leaf, 0, 0);
    dye(ctx, poly(inset(leaf, 2)), INK.vermilion, 0.8);
    for (let y = wy + 38; y < G - 8; y += 10) hole(ctx, x - d * 7, y, 1);
  }
  age(ctx, W, H, 0.3);
}

// A palace guard (ทหารยาม) with a spear, small.
function guard(ctx, x, yb, s, d) {
  const p = [[x - s * 0.1, yb], [x - s * 0.09, yb - s * 0.4], [x - s * 0.14, yb - s * 0.46], [x - s * 0.13, yb - s * 0.66], [x - s * 0.06, yb - s * 0.72], [x - s * 0.06, yb - s * 0.78], [x - s * 0.04, yb - s * 0.86], [x, yb - s], [x + s * 0.04, yb - s * 0.86], [x + s * 0.06, yb - s * 0.78], [x + s * 0.06, yb - s * 0.72], [x + s * 0.13, yb - s * 0.66], [x + s * 0.14, yb - s * 0.46], [x + s * 0.09, yb - s * 0.4], [x + s * 0.1, yb]];
  hide(ctx, p, 0, 0);
  dye(ctx, poly(inset(p, 1)), INK.red, 0.55);
  hide(ctx, taper([[x + d * s * 0.16, yb], [x + d * s * 0.16, yb - s * 1.12]], 2, 1.5, { smoothIt: false }), 0, 0);
  hideMany(ctx, [kanokPts(x + d * s * 0.16, yb - s * 1.1, s * 0.16, -Math.PI / 2, d > 0)]);
  hole(ctx, x, yb - s * 0.82, 0.7);
}

// A seated king in a tall ชฎา crown (small, for the throne).
function king(ctx, cx, yb, s) {
  const b = [
    [cx - s * 0.4, yb], [cx - s * 0.42, yb - s * 0.1], [cx - s * 0.28, yb - s * 0.2], [cx - s * 0.22, yb - s * 0.24],
    [cx - s * 0.22, yb - s * 0.44], [cx - s * 0.15, yb - s * 0.52], [cx - s * 0.06, yb - s * 0.55], [cx - s * 0.06, yb - s * 0.6],
    [cx - s * 0.1, yb - s * 0.68], [cx - s * 0.09, yb - s * 0.76], [cx - s * 0.08, yb - s * 0.8], [cx - s * 0.05, yb - s * 0.9],
    [cx - s * 0.02, yb - s * 1.02], [cx, yb - s * 1.12], [cx + s * 0.02, yb - s * 1.02], [cx + s * 0.05, yb - s * 0.9],
    [cx + s * 0.08, yb - s * 0.8], [cx + s * 0.09, yb - s * 0.76], [cx + s * 0.1, yb - s * 0.68], [cx + s * 0.06, yb - s * 0.6],
    [cx + s * 0.06, yb - s * 0.55], [cx + s * 0.15, yb - s * 0.52], [cx + s * 0.22, yb - s * 0.44], [cx + s * 0.22, yb - s * 0.24],
    [cx + s * 0.28, yb - s * 0.2], [cx + s * 0.42, yb - s * 0.1], [cx + s * 0.4, yb],
  ];
  hide(ctx, b, 0, 0);
  dye(ctx, poly(inset(b, 1.2)), INK.gold, 0.35);
  dye(ctx, poly([[cx - s * 0.4, yb], [cx - s * 0.3, yb - s * 0.2], [cx + s * 0.3, yb - s * 0.2], [cx + s * 0.4, yb]]), INK.red, 0.8);
  dye(ctx, poly([[cx - s * 0.08, yb - s * 0.8], [cx, yb - s * 1.12], [cx + s * 0.08, yb - s * 0.8]]), INK.gold, 0.85);
  gold(ctx, [[cx - s * 0.09, yb - s * 0.79], [cx + s * 0.09, yb - s * 0.79]], 0.9, { smoothIt: false });
  gold(ctx, [[cx - s * 0.2, yb - s * 0.46], [cx, yb - s * 0.38], [cx + s * 0.2, yb - s * 0.46]], 0.9);
  // sword across the lap
  line(ctx, [[cx - s * 0.36, yb - s * 0.2], [cx + s * 0.34, yb - s * 0.3]], INK.goldLine, 1.4, { smoothIt: false });
  hole(ctx, cx - s * 0.03, yb - s * 0.69, 0.75);
  hole(ctx, cx + s * 0.03, yb - s * 0.69, 0.75);
  dotLine(ctx, [[cx - s * 0.06, yb - s * 0.88], [cx, yb - s * 1.0], [cx + s * 0.06, yb - s * 0.88]], { spacing: 2.6, r: 0.6 });
  dotLine(ctx, [[cx - s * 0.34, yb - s * 0.06], [cx + s * 0.34, yb - s * 0.06]], { spacing: 3, r: 0.75, smoothIt: false });
}

// ================================================================ PROPS
const B = (id, name, en, w, h, draw, meta = {}, opt = {}) => ({
  id, name, en, cat: 'buildings',
  build() {
    const sprite = paintSprite(w, h, draw, { name: id, px: 2, pad: 24, ...opt });
    return { sprite, static: true, mass: 3, ...meta };
  },
});

export const PROPS = [
  B('thai-house', 'เรือนไทย', 'Thai house on stilts', 520, 480, drawThaiHouse, {}, { px: 2 }),
  B('thatched-hut', 'กระท่อมมุงจาก', 'Thatched hut', 300, 320, drawHut),
  B('sala', 'ศาลาไทย', 'Open Thai pavilion', 520, 420, drawSala),
  B('spirit-house', 'ศาลพระภูมิ', 'Spirit house on a post', 150, 340, drawSpiritHouse, { mass: 1.2 }),
  B('ubosot', 'โบสถ์', 'Temple ordination hall', 720, 740, drawUbosot, { mass: 5 }, { px: 1.6, pad: 30 }),
  B('chedi', 'เจดีย์', 'Bell-shaped stupa', 270, 600, drawChedi, { mass: 4 }),
  B('prang', 'พระปรางค์', 'Prang tower', 300, 640, drawPrang, { mass: 4 }, { px: 1.8 }),
  B('palace', 'ปราสาทราชวัง', 'Royal palace', 900, 920, drawPalace, { mass: 6 }, { px: 1.5, pad: 30 }),
  B('village-well', 'บ่อน้ำ', 'Village well', 250, 280, drawWell),
  B('wooden-bridge', 'สะพานไม้', 'Wooden footbridge', 640, 230, drawBridge),
  B('bamboo-fence', 'รั้วไม้ไผ่', 'Bamboo fence', 420, 170, drawFence, { mass: 1.5 }),
];
