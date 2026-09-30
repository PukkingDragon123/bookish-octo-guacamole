// ฤๅษี (hermit) and นาง (princess), drawn procedurally as faithful
// recreations of the two uploaded part sheets (4.jpg and 5.jpg).
//
// Every part is authored in the ORIGINAL SHEET'S PIXEL SPACE, so the rig
// joints below are exactly the ones measured on the sheets; a part's
// sprite is painted at `scale` world units per sheet pixel. Only the cut
// silhouettes are stored, as traced vector outlines (DATA at the end of the
// file); everything else -- hide texture, dyed cloth and its fold shading,
// gold rules, the dotted perforation rows that follow every fold, openwork
// lace, the hermit's curls, both faces, the crown and its flowers, collars,
// belts, cuffs, fingers and toes -- is painted with the leather toolkit at
// positions measured on the sheets.

import {
  INK, paintSprite, leather, line, hole, holes, curve, smooth, poly, inset, resample, rng, krajangPath, rivet, makeCanvas,
} from '../../art/leather.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

const COL = {
  red: '#a8241a',
  green: '#2c6a2e',
  gold: '#e2b85e',
  skin: '#f0d0a2',
  dot: '#f6ecd0',
  line: '#e8c46a',
};

// ================================================================ geometry
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
function unit(x, y) {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}
function offset(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const [tx, ty] = unit(b[0] - a[0], b[1] - a[1]);
    return [p[0] + ty * d, p[1] - tx * d];
  });
}
const C = (pts, closed = false, steps = 8) => curve(pts, closed, steps);

// Decode a delta-encoded outline string.
function decode(s) {
  const n = s.split(',').map(Number);
  const out = [[n[0], n[1]]];
  for (let i = 2; i < n.length; i += 2) {
    const [x, y] = out[out.length - 1];
    out.push([x + n[i], y + n[i + 1]]);
  }
  return out;
}

const _parts = new Map();
function partData(who, name) {
  const key = who + '/' + name;
  if (_parts.has(key)) return _parts.get(key);
  const d = DATA[who][name];
  const out = { box: d.box };
  for (const k of ['o', 'h']) out[k] = (d[k] || []).map(decode);
  _parts.set(key, out);
  return out;
}

// Path2D of several closed outlines, smoothed (fill with 'evenodd').
function multiPath(list, tension = 0.5) {
  const P = new Path2D();
  for (const pts of list) P.addPath(smooth(pts, true, tension));
  return P;
}

// ================================================================ painting
function ink(ctx, pts, col, w, { closed = false, alpha = 1, sm = true } = {}) {
  return line(ctx, pts, col, w, { closed, alpha, smoothIt: sm });
}
const goldL = (ctx, pts, w = 1.6, o = {}) => ink(ctx, pts, COL.line, w, o);

function fillOn(ctx, path, col, alpha = 0.92, rule = 'nonzero') {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col;
  ctx.fill(path, rule);
  ctx.restore();
}

// Dyed cloth: colour plus the blotchy, uneven take-up of dye on hide.
let _mottle = null;
function mottleTile() {
  if (_mottle) return _mottle;
  const S = 160, c = makeCanvas(S, S), g = c.getContext('2d');
  const r = rng(77);
  for (let i = 0; i < 260; i++) {
    const x = r() * S, y = r() * S, rad = 2 + r() * r() * 12;
    const col = r() < 0.8 ? [20, 8, 4, 0.25 + r() * 0.4] : [235, 110, 70, 0.1 + r() * 0.15];
    for (const [dx, dy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${col[3]})`);
      gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      g.fillStyle = gr;
      g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    }
  }
  _mottle = c;
  return c;
}
function cloth(ctx, path, col, alpha = 0.9, rule = 'nonzero') {
  fillOn(ctx, path, col, alpha, rule);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.clip(path, rule);
  ctx.fillStyle = ctx.createPattern(mottleTile(), 'repeat');
  ctx.globalAlpha = 0.5;
  ctx.fill(path, rule);
  ctx.restore();
}

// Painted cream dots; a fraction `punch` is punched right through.
function spotsAt(ctx, list, { col = COL.dot, punch = 0.2, seed = 1 } = {}) {
  const rr = rng(seed);
  const paint = new Path2D(), pun = new Path2D();
  for (const [x, y, r] of list) {
    const P = rr() < punch ? pun : paint;
    P.moveTo(x + r, y);
    P.arc(x, y, r, 0, TAU);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = col;
  ctx.fill(paint);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(pun);
  ctx.restore();
}

function dots(ctx, pts, { sp = 5, r = 1.5, vary = 0.3, jit = 0.15, closed = false, seed = 1, col = COL.dot, punch = 0.2, sm = true } = {}) {
  const rr = rng(seed);
  const src = sm && pts.length > 2 ? curve(pts, closed, 8) : pts;
  const s = resample(src, sp, closed).map(([x, y]) => [x + (rr() - 0.5) * jit * sp, y + (rr() - 0.5) * jit * sp, r * (1 - vary / 2 + rr() * vary)]);
  spotsAt(ctx, s, { col, punch, seed: seed + 7 });
  return s;
}

// Row of short cream grains across a path (the sheets' rice-grain dotting).
function grains(ctx, pts, { sp = 5, len = 4, w = 1.8, across = true, col = COL.dot, seed = 3 } = {}) {
  const rr = rng(seed);
  const s = resample(curve(pts, false, 8), sp, false);
  const p = new Path2D();
  for (const [x, y, a] of s) {
    const ang = a + (across ? Math.PI / 2 : 0) + (rr() - 0.5) * 0.25;
    const l = len * (0.8 + rr() * 0.4);
    const c = (Math.cos(ang) * l) / 2, sn = (Math.sin(ang) * l) / 2;
    p.moveTo(x - c, y - sn);
    p.lineTo(x + c, y + sn);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.stroke(p);
  ctx.restore();
}

// Band along a path: dyed stripe between two gold rules, dotted centre.
function stripe(ctx, pts, w, { fill = COL.red, alpha = 0.92, edge = COL.line, ew = 1.3, dot = true, sp, r, seed = 7, grain = false } = {}) {
  const cp = C(pts, false, 8);
  if (fill) ink(ctx, cp, fill, w, { sm: false, alpha });
  if (edge) {
    ink(ctx, offset(cp, w / 2 - ew / 2), edge, ew, { sm: false });
    ink(ctx, offset(cp, -w / 2 + ew / 2), edge, ew, { sm: false });
  }
  if (dot) {
    if (grain) grains(ctx, cp, { sp: sp ?? w * 0.6, len: w * 0.5, w: Math.max(1.2, w * 0.16), seed });
    else dots(ctx, cp, { sp: sp ?? Math.max(4, w * 0.8), r: r ?? Math.max(1, w * 0.17), seed, sm: false });
  }
}

function petalPath(x, y, len, wid, ang, P = new Path2D()) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const at = (u, v) => [x + c * u - s * v, y + s * u + c * v];
  const b = at(0, 0), l = at(len * 0.45, -wid), r2 = at(len * 0.45, wid), t = at(len, 0);
  const lc = at(len * 0.9, -wid * 0.6), rc = at(len * 0.9, wid * 0.6);
  P.moveTo(...b);
  P.bezierCurveTo(l[0], l[1], lc[0], lc[1], t[0], t[1]);
  P.bezierCurveTo(rc[0], rc[1], r2[0], r2[1], b[0], b[1]);
  return P;
}

// ดอกไม้ — red petals edged cream round a gold centre, punched eye.
function flower(ctx, x, y, R, { n = 8, fill = COL.red, edge = COL.dot, core = COL.gold, rot = 0, punch = true, ew } = {}) {
  const P = new Path2D();
  for (let k = 0; k < n; k++) petalPath(x, y, R, R * (n > 6 ? 0.36 : 0.5), rot + (k / n) * TAU, P);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = fill;
  ctx.fill(P);
  ctx.strokeStyle = edge;
  ctx.lineWidth = ew ?? Math.max(0.8, R * 0.13);
  ctx.stroke(P);
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(x, y, R * 0.36, 0, TAU); ctx.fill();
  ctx.fillStyle = COL.red;
  ctx.beginPath(); ctx.arc(x, y, R * 0.18, 0, TAU); ctx.fill();
  ctx.restore();
  if (punch) hole(ctx, x, y, Math.max(0.8, R * 0.1));
}

function gem(ctx, x, y, r, { col = COL.red, ring = COL.gold } = {}) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = ring;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, y, r * 0.64, 0, TAU); ctx.fill();
  ctx.fillStyle = COL.dot;
  ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.2, 0, TAU); ctx.fill();
  ctx.restore();
}

// Row of กระจัง leaves on the left normal of a path (flip: other side).
function fringe(ctx, pts, size, { col = COL.gold, inner = COL.red, flip = false, gap = 0.95, h = 1.35, punch = true, edge = COL.dot } = {}) {
  const s = resample(C(pts, false, 8), size * gap, false);
  const P = new Path2D(), Q = new Path2D();
  const hl = [];
  for (const [x, y, a] of s) {
    const up = a + (flip ? Math.PI / 2 : -Math.PI / 2);
    P.addPath(krajangPath(x, y, size, size * h, up));
    Q.addPath(krajangPath(x + Math.cos(up) * size * 0.12, y + Math.sin(up) * size * 0.12, size * 0.5, size * h * 0.62, up));
    hl.push([x + Math.cos(up) * size * 0.5, y + Math.sin(up) * size * 0.5]);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = col; ctx.fill(P);
  ctx.fillStyle = inner; ctx.fill(Q);
  if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 0.8; ctx.stroke(P); }
  ctx.restore();
  if (punch) holes(ctx, hl, Math.max(0.7, size * 0.09));
}

// ================================================================ sprites
// Paint one sheet part as a Sprite whose box coordinates are sheet pixels
// times `s`, matching the rig spec below.
function sheetSprite(who, name, s, draw) {
  const D = partData(who, name);
  const [x, y, w, h] = D.box;
  const m = 10; // sheet-px margin round the traced crop
  const sprite = paintSprite((w + m * 2) * s, (h + m * 2) * s, (ctx, info) => {
    ctx.scale(s, s);
    ctx.translate(m - x, m - y);
    draw(ctx, D, info.rng);
  }, { pad: 1, name: `${who}/${name}` });
  sprite.ox = 1 + (m - x) * s;
  sprite.oy = 1 + (m - y) * s;
  return sprite;
}

// ================================================================ rig
function sheetRig(spec, sprites, s) {
  const S = (p) => [p[0] * s, p[1] * s];
  const world = {};
  const parts = {};
  const order = Object.keys(spec.parts);
  for (const id of order) {
    const d = spec.parts[id];
    const sprite = sprites[d.img || id];
    const axisAng = d.axis ? Math.atan2(d.axis[1][1] - d.axis[0][1], d.axis[1][0] - d.axis[0][0]) : 0;
    const R = d.aim != null ? d.aim * DEG - axisAng : (d.parent ? world[d.parent] : 0);
    world[id] = R;
    parts[id] = {
      sprite,
      z: d.z,
      mass: d.mass,
      stiff: d.stiff,
      ...(d.parent
        ? { parent: d.parent, at: S(d.at), pivot: S(d.pivot), rot: R - world[d.parent], lim: d.lim ? [d.lim[0] * DEG, d.lim[1] * DEG] : null }
        : {}),
    };
  }
  const conv = (o) => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, S(v)])) : undefined);
  return {
    ...spec.meta,
    root: order[0],
    parts,
    rod: spec.rod && { part: spec.rod.part, a: S(spec.rod.a), b: S(spec.rod.b), extend: spec.rod.extend },
    handRods: conv(spec.handRods),
    grips: conv(spec.grips),
    holds: spec.holds,
    limbs: spec.limbs,
    lines: spec.lines,
    hands: spec.hands && Object.fromEntries(Object.entries(spec.hands).map(([k, v]) => [k, { ...v, pivot: S(v.pivot), sprite: sprites[v.img] }])),
  };
}

// Joint rivets: drawn on whichever piece of each joint sits on top.
function rivetsFor(spec) {
  const out = {};
  for (const id in spec.parts) {
    const d = spec.parts[id];
    if (!d.parent) continue;
    const par = spec.parts[d.parent];
    if ((d.z ?? 0) >= (par.z ?? 0)) (out[id] ||= []).push(d.pivot);
    else (out[d.parent] ||= []).push(d.at);
  }
  return out;
}

function withRivets(draw, pts, r) {
  return (ctx, D, rr) => {
    draw(ctx, D, rr);
    for (const [x, y] of pts || []) rivet(ctx, x, y, r);
  };
}

// ================================================================ hide + ornament
// Cut the hide from the traced silhouette. Returns the body path, the
// outline and a coverage mask (for midlines and clipping tests).
function hidePart(ctx, D, s) {
  const body = multiPath(D.o, 0.5);
  leather(ctx, body, { tone: 1 / s });
  for (const h of D.h) { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fill(smooth(h, true)); ctx.restore(); }
  return { body, outline: D.o[0] };
}

// Local frame along a limb axis a -> b: at(u, v), u = 0..1 along the axis,
// v in sheet px across it (+v = right of travel for a downward axis).
function axis(a, b) {
  const [ux, uy] = unit(b[0] - a[0], b[1] - a[1]);
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { L, at: (u, v = 0) => [a[0] + (b[0] - a[0]) * u + uy * v, a[1] + (b[1] - a[1]) * u - ux * v] };
}

// Crease between two dyed folds: dark channel, gold rule each side and a
// row of cream dots down the middle (the sheets' main drapery device).
function crease(ctx, pts, o = {}) {
  creases(ctx, [[pts, o]]);
}

// Several creases: all the fold modelling first, then channels and dots,
// so no shading washes over a neighbour's dots.
function creases(ctx, list) {
  const cps = list.map(([pts]) => C(pts, false, 8));
  list.forEach(([, o], i) => { if ((o.shade ?? 1) && o.w !== 0) fold(ctx, cps[i], o.shade ?? 1, o.w ?? 6); });
  list.forEach(([, o], i) => {
    const { w = 6, sp, r, gold = true, dotsOn = true, seed = 1 + i, alpha = 0.92, punch = 0.18, ew = 1.3 } = o;
    const cp = cps[i];
    if (w > 3) ink(ctx, cp, INK.leather, w, { sm: false, alpha });
    if (gold) {
      if (w > 3) {
        ink(ctx, offset(cp, w / 2), COL.line, ew, { sm: false });
        ink(ctx, offset(cp, -w / 2), COL.line, ew, { sm: false });
      } else ink(ctx, cp, COL.line, ew, { sm: false });
    }
    if (dotsOn) dots(ctx, cp, { sp: sp ?? w * 0.85, r: r ?? w * 0.3, seed, sm: false, punch });
  });
}

// Soft modelling of a cloth fold beside a crease: shadow on `side`
// (+1 = left of travel), a warm highlight further out on the other side.
function fold(ctx, cp, side, w) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const sh = poly(offset(cp, side * w * 1.1), false), hi = poly(offset(cp, -side * w * 2.6), false);
  ctx.strokeStyle = INK.leather;
  for (const [k, a] of [[3.6, 0.2], [2.5, 0.24], [1.5, 0.3]]) { ctx.globalAlpha = a; ctx.lineWidth = w * k; ctx.stroke(sh); }
  ctx.strokeStyle = '#e0553a';
  for (const [k, a] of [[2.4, 0.08], [1.4, 0.1]]) { ctx.globalAlpha = a; ctx.lineWidth = w * k; ctx.stroke(hi); }
  ctx.restore();
}

// Hex lattice of cream dots clipped to a path.
function dotField(ctx, path, bbox, { sp = 7, r = 1.8, seed = 3, punch = 0.25, skip = 0, jit = 0.12, col = COL.dot } = {}) {
  const [x0, y0, x1, y1] = bbox;
  const rr = rng(seed);
  const list = [];
  for (let y = y0, row = 0; y <= y1; y += sp * 0.866, row++) {
    for (let x = x0 + (row % 2 ? sp / 2 : 0); x <= x1; x += sp) {
      if (skip && rr() < skip) continue;
      list.push([x + (rr() - 0.5) * jit * sp, y + (rr() - 0.5) * jit * sp, r * (0.8 + rr() * 0.4)]);
    }
  }
  ctx.save();
  ctx.clip(path);
  spotsAt(ctx, list, { punch, seed, col });
  ctx.restore();
}

// Little five-dot flower sprinkled on dyed cloth.
function speckles(ctx, path, bbox, { sp = 16, r = 1.3, seed = 5, col = COL.dot } = {}) {
  const [x0, y0, x1, y1] = bbox;
  const rr = rng(seed);
  const list = [];
  for (let y = y0, row = 0; y <= y1; y += sp * 0.866, row++) {
    for (let x = x0 + (row % 2 ? sp / 2 : 0); x <= x1; x += sp) {
      const cx = x + (rr() - 0.5) * sp * 0.6, cy = y + (rr() - 0.5) * sp * 0.6;
      const k = rr();
      if (k < 0.3) continue;
      list.push([cx, cy, r * (0.8 + rr() * 0.5)]);
      if (k > 0.8) {
        const a = rr() * TAU;
        list.push([cx + Math.cos(a) * r * 3, cy + Math.sin(a) * r * 3, r * 0.8]);
        list.push([cx - Math.cos(a) * r * 3, cy - Math.sin(a) * r * 3, r * 0.8]);
      }
    }
  }
  ctx.save();
  ctx.clip(path);
  spotsAt(ctx, list, { punch: 0, col });
  ctx.restore();
}

// Band of gold beads between two thin rules (armlets, anklets, garters).
function beadBand(ctx, a, b, { rows = 2, gap = 5.5, r = 1.9, sp = 5.6, rule = true, seed = 3, col = COL.gold, bow = 0 } = {}) {
  const m = mix(a, b, 0.5);
  const [tx, ty] = unit(b[0] - a[0], b[1] - a[1]);
  const mid = [m[0] - ty * bow, m[1] + tx * bow];
  for (let i = 0; i < rows; i++) {
    const o = (i - (rows - 1) / 2) * gap;
    const pts = offset(C([a, mid, b]), -o);
    dots(ctx, pts, { sp, r: r * (i % 2 ? 0.8 : 1), col, punch: 0, sm: false, seed: seed + i });
  }
  if (rule) {
    const h = ((rows - 1) / 2) * gap + gap * 0.55;
    ink(ctx, offset(C([a, mid, b]), h), COL.gold, 1, { sm: false, alpha: 0.8 });
    ink(ctx, offset(C([a, mid, b]), -h), COL.gold, 1, { sm: false, alpha: 0.8 });
  }
}

// Fill the side of a limb beyond the line `edge` (points), extending
// `reach` px toward the side given by `dir` (unit vector).
function sideFill(ctx, edge, dir, reach, col, alpha = 0.9) {
  const cp = C(edge, false, 8);
  const far = cp.map(([x, y]) => [x + dir[0] * reach, y + dir[1] * reach]).reverse();
  const P = poly([...cp, ...far]);
  cloth(ctx, P, col, alpha);
  return P;
}

// Painted gold line-work (face lines, fingers, toes).
function art(ctx, list, w = 1.8, col = COL.line) {
  for (const pts of list) ink(ctx, pts, col, w);
}

// ================================================================ ฤๅษี hermit
const RS = 0.47;

const REUSI_DRAW = {
  head(ctx, D) {
    const { body } = hidePart(ctx, D, RS);
    // curls: a lattice of cream dots over the scalp, behind the hairline
    const hairEdge = [[552, 38], [530, 40], [508, 47], [498, 56], [497, 70], [501, 80], [494, 83], [484, 82], [472, 88], [464, 104], [463, 124], [468, 146], [455, 160], [440, 150], [420, 100], [430, 0], [560, 0]];
    const hair = smooth(hairEdge, true, 0.35);
    ctx.save(); ctx.clip(body);
    dotField(ctx, hair, [425, 8, 560, 170], { sp: 7.6, r: 2.05, seed: 3, punch: 0.3, jit: 0.2 });
    ctx.restore();
    goldL(ctx, [[548, 40], [528, 44], [509, 50], [499, 60], [499, 72], [504, 82]], 1.7);
    // ear: long lobe
    const ear = [[491, 84], [480, 81], [470, 88], [465, 102], [466, 122], [472, 140], [477, 158], [480, 172], [486, 173], [489, 160], [488, 140], [491, 122], [494, 104], [494, 92]];
    const earP = smooth(ear, true, 0.5);
    fillOn(ctx, earP, INK.leather, 1);
    ink(ctx, earP, COL.line, 1.9);
    art(ctx, [[[486, 92], [477, 92], [472, 102], [474, 114], [481, 118], [485, 112]], [[478, 128], [480, 145], [482, 162]], [[486, 128], [484, 145], [483, 160]]], 1.5);
    // brow, eye, nose, lips, jaw and neck folds
    art(ctx, [
      [[504, 73], [516, 64], [530, 61], [543, 63], [555, 68]],
      [[511, 82], [520, 77], [529, 75.5], [540, 76], [553, 81]],
      [[514, 86], [524, 88], [536, 88], [552, 82.5]],
      [[511, 90], [526, 93], [540, 92.5], [553, 86]],
      [[557, 93], [552, 97], [552, 103], [558, 104]],
      [[540, 111], [548, 115.5], [557, 113]],
      [[548, 122], [555, 125], [560, 122]],
      [[497, 125], [502, 136], [514, 143], [530, 147], [548, 141]],
      [[511, 160], [520, 160], [528, 162]],
      [[510, 176], [520, 178], [529, 178]],
    ], 1.7);
    const eye = smooth([[514, 84], [524, 78.5], [538, 78], [551, 82], [538, 86.5], [524, 87]], true);
    fillOn(ctx, eye, COL.dot, 0.95);
    const iris = new Path2D(); iris.arc(538, 82.3, 3.4, 0, TAU);
    fillOn(ctx, iris, INK.leather, 1);
    hole(ctx, 539, 81.4, 0.9);
    ink(ctx, [[512, 82], [524, 77.5], [538, 77], [552, 82]], INK.leather, 1.4);
    fillOn(ctx, smooth([[556, 115], [566, 113.5], [568, 117], [561, 120], [555, 118]], true), COL.red, 0.95);
  },

  torso(ctx, D) {
    const { body } = hidePart(ctx, D, RS);
    // the sash (ผ้าจีวร) over the left shoulder, from the neck down to the hip
    const neck = [[420, 340], [458, 327], [485, 312], [502, 285], [512, 254], [518, 222]];
    const drape = poly([[360, 346], ...C(neck), [522, 196], [660, 196], [660, 520], [360, 520]]);
    cloth(ctx, drape, COL.red);
    ctx.save(); ctx.clip(drape);
    speckles(ctx, drape, [380, 220, 630, 490], { sp: 15, seed: 7 });
    // fan of folds sweeping from the shoulder to the far hip
    const A = [[426, 358], [482, 348], [522, 318], [538, 260], [543, 223]];
    const B = [[400, 474], [488, 490], [562, 456], [612, 374], [628, 262]];
    const n = 7;
    const list = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      list.push([A.map((p, j) => mix(p, B[j], t)), { w: i % 2 ? 7.5 : 6.5, seed: 20 + i, shade: -1 }]);
    }
    // folds hanging from the shoulder and the tail of the knot
    list.push([[[562, 226], [565, 300], [574, 380], [578, 450]], { w: 5.5, seed: 31 }]);
    list.push([[[592, 228], [596, 300], [606, 380], [610, 440]], { w: 5.5, seed: 32 }]);
    list.push([[[528, 360], [534, 392], [528, 430]], { w: 5.5, seed: 33 }]);
    list.push([[[544, 362], [552, 396], [550, 432]], { w: 5.5, seed: 34 }]);
    creases(ctx, list);
    ctx.restore();
    // knot: a dotted rosette with a red boss
    dots(ctx, C([[536, 340], [548, 348], [546, 362], [534, 366], [524, 356], [526, 344]], true), { sp: 4.6, r: 1.6, closed: true, seed: 35, sm: false, punch: 0 });
    gem(ctx, 536, 353, 4.5);
    // neckline: dots on the bare chest just outside the sash edge
    ink(ctx, C(neck), COL.line, 1.6, { sm: false });
    dots(ctx, offset(C(neck), -4.5), { sp: 5.4, r: 1.8, seed: 9, sm: false });
    // chest: nipple ring and the gold neck-cord tie
    const nip = new Path2D(); nip.arc(428, 312, 4.2, 0, TAU);
    ink(ctx, nip, COL.line, 1.5);
    art(ctx, [[[491, 231], [496, 238], [500, 241], [504, 238], [509, 231]], [[500, 241], [500, 252]]], 1.8);
    cloth(ctx, smooth([[580, 398], [592, 394], [604, 410], [598, 430], [584, 426]], true), COL.green, 0.75);
  },

  skirt(ctx, D) {
    const { body, outline } = hidePart(ctx, D, RS);
    const cl = smooth(inset(outline, 2.5), true);
    cloth(ctx, cl, COL.red);
    speckles(ctx, cl, [375, 520, 640, 890], { sp: 17, seed: 8 });
    // green under-panels: the front pleat and the fan at the lower left
    const pleat = smooth([[472, 590], [492, 590], [497, 736], [468, 740]], true);
    const fanG = smooth([[462, 730], [496, 736], [506, 790], [472, 832], [446, 862], [404, 856], [398, 830], [444, 790]], true);
    const fanR = smooth([[600, 842], [632, 836], [634, 870], [600, 874]], true);
    for (const p of [pleat, fanG, fanR]) cloth(ctx, p, COL.green, 0.85);
    ctx.save(); ctx.clip(body);
    dotField(ctx, fanG, [398, 730, 506, 866], { sp: 11, r: 1.4, seed: 4, punch: 0.1, skip: 0.3 });
    const L = [];
    // swags on the right
    for (const s of [
      [[508, 532], [540, 560], [572, 582], [604, 594], [632, 590]],
      [[505, 556], [520, 610], [550, 650], [595, 670], [630, 660]],
      [[508, 662], [535, 720], [580, 745], [630, 740]],
      [[520, 752], [550, 795], [595, 812], [634, 806]],
    ]) L.push([s, { w: 7, shade: -1 }]);
    L.push([[[540, 540], [566, 600], [606, 628], [634, 626]], { w: 3, dotsOn: false, shade: -1 }]);
    L.push([[[528, 690], [560, 760], [600, 776], [634, 772]], { w: 3, dotsOn: false, shade: -1 }]);
    // left swags and long folds
    for (const s of [
      [[398, 575], [430, 600], [462, 606]],
      [[398, 640], [430, 660], [463, 666]],
      [[403, 700], [435, 720], [462, 726]],
    ]) L.push([s, { w: 6, shade: -1 }]);
    for (const s of [
      [[398, 555], [428, 574], [460, 580]],
      [[398, 606], [428, 630], [462, 636]],
      [[400, 672], [432, 692], [462, 696]],
      [[404, 740], [424, 760], [446, 774]],
    ]) L.push([s, { w: 3, dotsOn: false, shade: -1 }]);
    // the front pleat edges and the fan's dotted borders
    L.push([[[464, 546], [463, 640], [462, 732]], { w: 6.5, shade: 1 }]);
    L.push([[[500, 544], [501, 640], [498, 734]], { w: 6.5, shade: -1 }]);
    L.push([[[496, 736], [506, 790], [472, 832], [446, 862]], { w: 6 }]);
    L.push([[[462, 730], [444, 790], [400, 830]], { w: 6, shade: -1 }]);
    L.push([[[520, 780], [540, 830], [560, 876]], { w: 5 }]);
    L.push([[[598, 700], [612, 780], [606, 840]], { w: 3, dotsOn: false }]);
    // hem: dotted border
    L.push([[[384, 858], [440, 868], [495, 876], [560, 870], [634, 856]], { w: 7, shade: 0 }]);
    creases(ctx, L);
    dots(ctx, [[386, 846], [440, 856], [495, 864], [560, 858], [632, 844]], { sp: 5.6, r: 1.7, seed: 77 });
    // dotted drop hanging in the right swag
    dots(ctx, [[574, 676], [580, 690], [584, 706], [578, 716], [572, 704], [574, 690]], { sp: 4.6, r: 1.5, closed: true, seed: 57, punch: 0 });
    ctx.restore();
    // waist: dark band under the torso
    ink(ctx, [[392, 540], [440, 526], [500, 522], [560, 526], [614, 540]], INK.leather, 9, { alpha: 0.8 });
  },
};

// Limbs: dark hide with the red cloth edge on one side, gold rules,
// beaded bands.
function reusiLimb(ctx, D, o) {
  const { body } = hidePart(ctx, D, RS);
  ctx.save(); ctx.clip(body);
  if (o.cloth) {
    const P = sideFill(ctx, o.cloth, o.dir, 80, COL.red, 0.9);
    speckles(ctx, P, o.bbox, { sp: 12, r: 1.1, seed: o.seed });
    goldL(ctx, o.cloth, 1.6);
    for (const [i, f] of (o.folds || []).entries()) crease(ctx, f, { w: 4.5, seed: o.seed + i, dotsOn: i % 2 === 0 });
  }
  for (const [a, b, opt] of o.bands || []) beadBand(ctx, a, b, { seed: o.seed + 9, ...opt });
  ctx.restore();
  if (o.art) art(ctx, o.art, 1.6);
}

const reusiLimbs = {
  upperArmF: { cloth: [[675, 185], [690, 220], [704, 250], [722, 280], [735, 300]], dir: [0.8, -0.6], bbox: [660, 180, 745, 320], seed: 101,
    folds: [[[686, 190], [705, 240], [728, 282]]],
    bands: [[[664, 274], [724, 256], { rows: 3, gap: 5 }]], art: [[[706, 278], [710, 284], [705, 288]]] },
  forearmF: { cloth: [[752, 352], [758, 380], [766, 410], [780, 432], [795, 446]], dir: [0.9, -0.4], bbox: [745, 330, 825, 470], seed: 102,
    folds: [[[762, 356], [772, 395], [790, 425]]],
    bands: [[[764, 452], [808, 440], { rows: 3, gap: 4.6, r: 1.7 }]] },
  upperArmB: { cloth: [[330, 190], [318, 206], [300, 228], [282, 252], [264, 290]], dir: [-0.8, -0.6], bbox: [240, 180, 340, 320], seed: 103,
    folds: [[[322, 198], [300, 222], [276, 256]]],
    bands: [[[282, 254], [324, 280], { rows: 3, gap: 5 }]], art: [[[278, 268], [276, 276], [282, 280]]] },
  forearmB: { cloth: [[258, 332], [240, 350], [218, 372], [204, 392], [192, 412]], dir: [-0.7, -0.7], bbox: [145, 320, 270, 480], seed: 104,
    folds: [[[250, 344], [228, 366], [208, 392]], [[240, 364], [220, 384], [205, 408]]],
    bands: [[[160, 440], [194, 454], { rows: 3, gap: 4.6, r: 1.7 }]], art: [[[196, 400], [192, 410], [198, 414]]] },
  thighF: { cloth: [[686, 486], [690, 520], [697, 546], [714, 572], [733, 593], [756, 624], [778, 656]], dir: [0.8, -0.55], bbox: [660, 480, 790, 700], seed: 105,
    folds: [[[702, 490], [712, 540], [740, 580], [770, 626]], [[718, 500], [730, 540], [760, 580], [782, 610]]],
    bands: [[[662, 590], [726, 574], { rows: 2, gap: 6 }], [[672, 624], [746, 594], { rows: 2, gap: 6 }]], art: [[[733, 614], [738, 622], [732, 626]]],
    green: [[680, 606], [744, 584], [748, 592], [682, 616]] },
  thighB: { cloth: [[310, 490], [305, 530], [295, 557], [284, 576], [272, 593], [256, 612], [238, 632]], dir: [-0.8, -0.55], bbox: [225, 480, 360, 700], seed: 106,
    folds: [[[296, 494], [288, 540], [266, 580], [240, 612]], [[282, 500], [272, 540], [250, 576]]],
    bands: [[[258, 540], [290, 552], { rows: 2, gap: 6 }], [[300, 574], [348, 594], { rows: 2, gap: 6 }], [[288, 604], [330, 622], { rows: 1, gap: 6 }]],
    art: [[[280, 612], [276, 620], [284, 624]]], green: [[294, 598], [330, 608], [328, 616], [292, 606]] },
};
for (const k in reusiLimbs) {
  const o = reusiLimbs[k];
  REUSI_DRAW[k] = (ctx, D) => {
    reusiLimb(ctx, D, o);
    if (o.green) fillOn(ctx, smooth(o.green, true), COL.green, 0.85);
  };
}

// Shins with feet: beaded garter below the knee, anklet, ankle curl, toes.
function reusiShin(ctx, D, o) {
  const { body } = hidePart(ctx, D, RS);
  ctx.save(); ctx.clip(body);
  beadBand(ctx, ...o.garter, { rows: 2, gap: 6, r: 1.9, bow: 5, seed: 3 });
  dots(ctx, o.tassel, { sp: 5, r: 1.8, col: COL.gold, punch: 0, seed: 4 });
  beadBand(ctx, ...o.anklet, { rows: 2, gap: 7, r: 2.1, seed: 5 });
  ctx.restore();
  art(ctx, o.art, 1.7);
}
REUSI_DRAW.shinF = (ctx, D) => reusiShin(ctx, D, {
  fwd: 1,
  garter: [[716, 800], [774, 794]], tassel: [[764, 760], [765, 772], [764, 784]], anklet: [[730, 883], [778, 880]],
  art: [
    [[738, 905], [741, 912], [737, 918]],
    [[726, 912], [728, 928], [740, 936], [756, 932], [764, 920]],
    [[800, 948], [818, 946], [838, 950], [852, 958]],
    [[806, 955], [822, 954], [840, 959], [850, 966]],
    [[810, 962], [826, 962], [842, 968]],
    [[818, 970], [832, 973], [846, 972]],
    [[852, 960], [858, 964], [854, 969]],
  ],
});
REUSI_DRAW.shinB = (ctx, D) => reusiShin(ctx, D, {
  fwd: -1,
  garter: [[252, 792], [302, 794]], tassel: [[256, 760], [255, 772], [256, 784]], anklet: [[254, 883], [298, 880]],
  art: [
    [[282, 906], [279, 913], [284, 918]],
    [[256, 912], [262, 928], [278, 934], [292, 928], [298, 918]],
    [[203, 940], [186, 939], [168, 942], [152, 950]],
    [[198, 948], [182, 948], [166, 952], [154, 958]],
    [[192, 956], [176, 957], [162, 962]],
    [[184, 964], [170, 967], [158, 967]],
    [[150, 952], [144, 956], [148, 961]],
  ],
});

REUSI_DRAW.handF = (ctx, D) => {
  hidePart(ctx, D, RS);
  art(ctx, [
    [[845, 489], [862, 495], [872, 500], [880, 512], [887, 527], [892, 545]],
    [[872, 495], [878, 503], [888, 513], [900, 525], [907, 540]],
    [[840, 511], [860, 512.5], [872, 516], [880, 532], [882, 547]],
    [[863, 515], [867, 525], [874, 540]],
    [[888, 512], [899, 516], [910, 528]],
  ], 1.5);
};
REUSI_DRAW.handB = (ctx, D) => {
  hidePart(ctx, D, RS);
  art(ctx, [
    [[120, 474], [107, 482], [95, 490], [88, 502], [83, 525]],
    [[127, 495], [112, 497], [100, 502], [90, 512], [90, 532]],
    [[100, 488], [95, 502], [97, 515], [100, 532]],
    [[76, 500], [68, 505], [62, 504]],
  ], 1.5);
};

// Staff: crook with gold streaks, ringed bands down the shaft.
REUSI_DRAW.cane = (ctx, D) => {
  const { body } = hidePart(ctx, D, RS);
  const mid = midline(D);
  ctx.save(); ctx.clip(body);
  art(ctx, [
    [[1022, 78], [1034, 70], [1046, 66]],
    [[1052, 60], [1058, 78], [1066, 98], [1070, 118]],
    [[1080, 92], [1092, 90], [1098, 100]],
    [[1072, 150], [1082, 140], [1090, 128]],
    [[1064, 190], [1070, 170], [1078, 160]],
  ], 2.2, COL.gold);
  dots(ctx, [[1080, 80], [1076, 92], [1078, 104]], { sp: 4.5, r: 1.5, punch: 0, seed: 3 });
  goldL(ctx, [[1074, 120], [1084, 112], [1096, 110]], 1.6);
  const ring = (y, cols, h = 12) => {
    const [x, hw] = mid(y);
    cols.forEach((c, i) => {
      const yy = y - h / 2 + (i + 0.5) * (h / cols.length);
      if (c === 'dots') dots(ctx, [[x - hw, yy], [x + hw, yy]], { sp: 4.2, r: 1.3, punch: 0, sm: false, seed: y + i });
      else ink(ctx, [[x - hw - 2, yy], [x + hw + 2, yy]], c, h / cols.length, { sm: false });
    });
  };
  ring(222, [COL.red, 'dots', COL.gold, 'dots', COL.green], 22);
  ring(305, [COL.red, 'dots', COL.gold], 13);
  for (const y of [428, 592, 706, 822]) ring(y, [COL.red, 'dots', COL.gold], 11);
  for (let y = 250; y < 880; y += 26) {
    if ([305, 428, 592, 706, 822].some((b) => Math.abs(b - y) < 14)) continue;
    const [x] = mid(y), [x2] = mid(y + 12);
    ink(ctx, [[x - 1, y], [x2 + 1, y + 12]], COL.gold, 1.6, { alpha: 0.85 });
  }
  ctx.restore();
};

// Horizontal extent of a thin upright part at height y: [centre, half-width].
function midline(D) {
  const pts = D.o[0];
  return (y) => {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    if (xs.length < 2) return [pts[0][0], 4];
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    return [(x0 + x1) / 2, (x1 - x0) / 2];
  };
}

// Holy-water pot: rim, dotted garlands, red stripe and a band of lotus
// petals round the belly.
REUSI_DRAW.pot = (ctx, D) => {
  const { body } = hidePart(ctx, D, RS);
  ctx.save(); ctx.clip(body);
  const inner = smooth([[862, 240], [930, 236], [996, 240], [990, 247], [930, 244], [866, 247]], true);
  fillOn(ctx, inner, '#8a6a3c', 0.9);
  goldL(ctx, [[858, 246], [930, 250], [1000, 246]], 1.6);
  const row = (y, bow, x0 = 826, x1 = 1034) => C([[x0, y - bow * 0.6], [(x0 + x1) / 2, y + bow * 0.4], [x1, y - bow * 0.6]]);
  dots(ctx, row(268, 4, 850, 1008), { sp: 6.6, r: 1.9, punch: 0.1, seed: 1, sm: false });
  // swags hanging from the garland, with dotted drops between them
  for (const [a, b] of [[836, 870], [870, 930], [940, 1000], [1000, 1030]]) {
    dots(ctx, [[a, 272], [(a + b) / 2, 300], [b, 272]], { sp: 6.2, r: 1.8, seed: a, punch: 0.1 });
  }
  for (const x of [870, 935, 1000]) dots(ctx, [[x, 276], [x - 4, 290], [x + 4, 290], [x, 276]], { sp: 4.2, r: 1.5, seed: x + 1, punch: 0 });
  dots(ctx, row(312, 6), { sp: 6.4, r: 2, punch: 0.1, seed: 2, sm: false });
  ink(ctx, row(320, 6), COL.red, 3, { sm: false });
  dots(ctx, row(320, 6), { sp: 5, r: 0.9, punch: 0, seed: 12, sm: false, col: COL.gold });
  dots(ctx, row(336, 6), { sp: 6.4, r: 2, punch: 0.1, seed: 3, sm: false });
  // lotus petals
  const s = resample(C([[836, 378], [930, 384], [1026, 378]]), 24, false);
  for (const [x, y] of s) {
    const pp = krajangPath(x, y, 21, 36, -Math.PI / 2);
    fillOn(ctx, pp, COL.red, 0.9);
    const q = krajangPath(x, y - 2, 15, 29, -Math.PI / 2);
    fillOn(ctx, q, '#5f8c3c', 0.9);
    ink(ctx, q, COL.line, 1.1);
    dots(ctx, [[x, y - 26], [x, y - 6]], { sp: 5, r: 1.3, seed: x, punch: 0, sm: false });
  }
  for (const [x, y] of s) fillOn(ctx, smooth([[x + 12, y - 6], [x + 15, y - 16], [x + 18, y - 6]], true), COL.red, 0.9);
  ctx.restore();
};

const reusiGeneric = (ctx, D) => hidePart(ctx, D, RS);

// ================================================================ นาง princess
const NS = 0.56;

// Openwork lace: a lattice of cream drops (some punched through) clipped
// to `path`.
function laceField(ctx, path, bbox, { sp = 7.5, r = 1.7, seed = 3, punch = 0.4, rule = 'nonzero', drop = 1.5 } = {}) {
  const [x0, y0, x1, y1] = bbox;
  const rr = rng(seed);
  const paint = new Path2D(), pun = new Path2D();
  for (let y = y0, row = 0; y <= y1; y += sp * 0.8, row++) {
    for (let x = x0 + (row % 2 ? sp / 2 : 0); x <= x1; x += sp) {
      if (rr() < 0.08) continue;
      const P = rr() < punch ? pun : paint;
      const cx = x + (rr() - 0.5) * sp * 0.25, cy = y + (rr() - 0.5) * sp * 0.25;
      const q = r * (0.75 + rr() * 0.5);
      P.moveTo(cx + q, cy);
      P.ellipse(cx, cy, q, q * drop, (rr() - 0.5) * 0.8, 0, TAU);
    }
  }
  ctx.save();
  ctx.clip(path, rule);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = COL.dot;
  ctx.fill(paint);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(pun);
  ctx.restore();
}

// Dyed panel: cloth colour, gold rule round the edge, inner dotted row.
function panelN(ctx, pts, col, { dotsOn = true, seed = 1, sp = 4.6, r = 1.25, sprinkle = 0 } = {}) {
  const P = smooth(pts, true);
  cloth(ctx, P, col, 0.93);
  ink(ctx, P, COL.line, 1.3);
  if (dotsOn) dots(ctx, inset(pts, 3.4), { sp, r, closed: true, seed, punch: 0.15 });
  if (sprinkle) {
    ctx.save(); ctx.clip(smooth(inset(pts, 6), true));
    dotField(ctx, P, bboxOf(pts), { sp: sprinkle, r: 1.2, seed: seed + 3, punch: 0.1, skip: 0.3, jit: 0.3 });
    ctx.restore();
  }
  return P;
}

// Ornamental band across a path: kinds 'red' (red with cream dots),
// 'cream' (row of cream beads), 'gold', 'green'.
function bandN(ctx, pts, kind, w = 7, seed = 1) {
  if (kind === 'cream') {
    ink(ctx, C(pts), INK.leather, w, { sm: false });
    dots(ctx, C(pts), { sp: w * 0.78, r: w * 0.3, seed, punch: 0.1, sm: false });
    return;
  }
  const fill = kind === 'red' ? COL.red : kind === 'green' ? COL.green : COL.gold;
  stripe(ctx, pts, w, { fill, seed, sp: Math.max(3.4, w * 0.7), r: Math.max(0.9, w * 0.16), edge: COL.line, ew: 1.1, dot: kind !== 'gold' });
}

function bboxOf(pts, pad = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

// Gold-and-red jewel flower with cream edging (the sheets' ดอกไม้).
const goldFlower = (ctx, x, y, R, rot = 0) => flower(ctx, x, y, R, { n: 8, fill: COL.gold, edge: INK.leather, core: COL.red, rot, ew: Math.max(0.8, R * 0.08) });
const redFlower = (ctx, x, y, R, rot = 0) => flower(ctx, x, y, R, { n: 8, fill: COL.red, edge: COL.dot, core: COL.gold, rot });
// Jewel rosette: gold petals behind a red flower (bracelets, anklets).
function rosette(ctx, x, y, R) {
  flower(ctx, x, y, R, { n: 10, fill: COL.gold, edge: INK.leather, core: COL.gold, ew: 0.7, punch: false });
  redFlower(ctx, x, y, R * 0.66, 0.3);
}

// Base for every princess part: hide, dotted contour, optional lace zones.
function nangBase(ctx, D, { lace = [], laceSp = 7.5, laceR = 1.7, rim = true, seed = 1 } = {}) {
  const { body, outline } = hidePart(ctx, D, NS);
  const [x0, y0, w, h] = D.box;
  for (const z of lace) {
    const zp = Array.isArray(z) ? smooth(z, true) : z;
    ctx.save(); ctx.clip(body);
    laceField(ctx, zp, [x0, y0, x0 + w, y0 + h], { sp: laceSp, r: laceR, seed: seed + 5, punch: 0.3 });
    ctx.restore();
  }
  if (rim) {
    ink(ctx, inset(outline, 1.6), COL.line, 1.1, { closed: true, alpha: 0.85 });
    dots(ctx, inset(outline, 4), { sp: 4.6, r: 1.15, closed: true, seed: seed + 11, punch: 0.2 });
  }
  return { body, outline };
}

// Hand with gold nail lines along each finger (fingers are in the traced
// outline) and the jewelled flower bracelet at the wrist.
function nangHand(ctx, D, wrist, R = 8.5) {
  const { outline } = nangBase(ctx, D, { rim: false });
  ink(ctx, inset(outline, 1.8), COL.line, 0.9, { closed: true, alpha: 0.7 });
  rosette(ctx, wrist[0], wrist[1], R * 1.3);
}

const NANG_DRAW = {
  head(ctx, D) {
    const { body } = hidePart(ctx, D, NS);
    // spire openwork: pairs of teardrop cut-outs up the centre
    const spine = C([[351, 8], [356, 30], [362, 52], [370, 72], [380, 92]]);
    const cut = new Path2D();
    resample(spine, 9, false).forEach(([x, y, a], i) => {
      const w = 1.1 + i * 0.22, off = (i % 2 ? 1 : -1) * (1 + i * 0.3);
      cut.moveTo(x, y);
      cut.ellipse(x - Math.sin(a) * off, y + Math.cos(a) * off, w * 1.9, w, a, 0, TAU);
    });
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fill(cut); ctx.restore();
    // back of the head: dark scalloped hair with lace drops
    const back = [[365, 150], [385, 180], [405, 200], [420, 235], [440, 262], [410, 270], [370, 250], [352, 190]];
    ctx.save(); ctx.clip(body);
    laceField(ctx, smooth(back, true), [350, 150, 445, 275], { sp: 8.5, r: 1.9, seed: 3, punch: 0.5 });
    ctx.restore();
    // face and neck
    const face = [[472, 150], [505, 150], [525, 200], [525, 268], [446, 268], [450, 236], [455, 212], [452, 192], [459, 172], [466, 160]];
    const faceP = smooth(face, true, 0.4);
    fillOn(ctx, faceP, COL.skin, 0.97);
    ink(ctx, [[466, 160], [459, 172], [452, 192], [455, 212], [450, 236], [446, 262]], INK.leather, 2.2);
    // hair lock over the temple and the ear
    const lock = [[450, 160], [466, 157], [460, 166], [455, 180], [452, 196], [447, 188]];
    fillOn(ctx, smooth(lock, true), INK.leather, 1);
    const ear = [[441, 186], [433, 187], [429, 196], [431, 207], [437, 215], [443, 216], [445, 204], [444, 193]];
    fillOn(ctx, smooth(ear, true), COL.skin, 0.97);
    ink(ctx, smooth(ear, true), INK.leather, 1.3);
    ink(ctx, [[439, 192], [435, 198], [437, 206], [441, 209]], '#6a4424', 1.1);
    // features
    const lc = '#22140b';
    ctx.save(); ctx.clip(faceP); ink(ctx, body, INK.leather, 2.6); ctx.restore();
    ink(ctx, [[464, 174], [471, 170], [478, 169], [485, 170.5], [489, 173.5]], lc, 1.2);
    const eye = smooth([[467, 183], [474, 180], [481, 179.4], [488, 181.6], [492, 184.2], [486, 185.6], [479, 186.6], [472, 185.6]], true);
    fillOn(ctx, eye, INK.white, 0.95);
    const iris = new Path2D(); iris.arc(482, 183, 2.1, 0, TAU);
    fillOn(ctx, iris, lc, 1);
    hole(ctx, 482.8, 182.2, 0.7);
    ink(ctx, [[462, 182], [467, 183], [474, 179.8], [481, 179], [488, 181.3], [493, 184.5]], lc, 1.1);
    ink(ctx, [[471, 186], [479, 187], [487, 185.8]], lc, 0.6);
    ink(ctx, [[468, 177], [476, 175.6], [486, 177]], lc, 0.5, { alpha: 0.6 });
    ink(ctx, [[498, 194], [495.5, 197], [498, 198.5]], '#5a2c16', 0.9);
    fillOn(ctx, smooth([[492.5, 206], [497, 204.6], [501.5, 206.4], [498.5, 208], [500.5, 210.6], [496, 213], [493.4, 210]], true), '#b3261c', 0.95);
    ink(ctx, [[492, 208.5], [499.5, 208.2]], '#4a120c', 0.7);
    ink(ctx, [[458, 216], [468, 229], [482, 229], [494, 222]], '#6a4424', 0.8, { alpha: 0.7 });
    // earring: flower and dangling gems
    redFlower(ctx, 446, 226, 6.5);
    for (const [i, y] of [236, 243, 250].entries()) gem(ctx, 447, y, 2.6 - i * 0.3, { col: i % 2 ? COL.green : COL.red });
    // hair band behind the ear
    stripe(ctx, [[424, 182], [416, 212], [418, 240], [428, 262]], 8, { fill: COL.dot, seed: 4, sp: 4.4, r: 1.3, edge: COL.gold });
    for (const [x, y] of [[419, 200], [416, 222], [420, 244]]) gem(ctx, x, y, 2.2);
    // diadem (กระบังหน้า) over the forehead with standing krajang
    const band = [[428, 186], [430, 166], [442, 154], [458, 149], [474, 147], [484, 149]];
    fringe(ctx, offset(C(band), 4), 6, { h: 1.6 });
    bandN(ctx, band, 'gold', 8, 5);
    for (const [x, y] of resample(C(band), 11, false).map((p) => p)) gem(ctx, x, y, 2.3);
    stripe(ctx, offset(C(band), -6), 4.5, { fill: COL.red, seed: 6, sp: 3.4, r: 0.9, edge: COL.gold });
    // crown: krajang spikes, tiers and the flower mass
    for (const [x, y, sz, a] of [[472, 138, 12, -70], [445, 116, 10, -95], [383, 74, 11, -60]]) {
      const k = krajangPath(x, y, sz, sz * 2, a * DEG);
      leather(ctx, k, { tone: 1 / NS });
      fillOn(ctx, k, COL.gold, 0.95);
      fillOn(ctx, krajangPath(x, y, sz * 0.55, sz * 1.3, a * DEG), COL.red, 0.95);
      ink(ctx, k, INK.leather, 0.9);
    }
    for (const r of [0, 1, 2]) {
      const arc = [[430 - r * 10, 145 - r * 8], [446 - r * 6, 134 - r * 10], [462 - r * 4, 132 - r * 12]];
      dots(ctx, arc, { sp: 5, r: 1.6, seed: 20 + r, punch: 0.1 });
    }
    ctx.save(); ctx.clip(body);
    laceField(ctx, smooth([[380, 95], [430, 110], [455, 140], [430, 160], [400, 200], [372, 190], [360, 140]], true), [355, 90, 460, 205], { sp: 7, r: 1.5, seed: 9, punch: 0.5 });
    for (const [x, y, R] of [[395, 150, 9], [425, 138, 8], [382, 108, 8]]) goldFlower(ctx, x, y, R);
    for (const [x, y, R] of [[392, 88, 12], [372, 138, 13], [369, 158, 9], [412, 175, 15], [395, 231, 9], [383, 198, 7], [432, 158, 6]]) redFlower(ctx, x, y, R);
    goldFlower(ctx, 410, 120, 17);
    redFlower(ctx, 410, 120, 8);
    for (const [x, y, a] of [[360, 101, -2.2], [391, 172, 2.6], [379, 118, -2.8]]) {
      const lf = new Path2D(); petalPath(x, y, 14, 5, a, lf);
      fillOn(ctx, lf, COL.green, 0.95); ink(ctx, lf, COL.gold, 0.8);
    }
    ctx.restore();
    // dotted contour round the crown (not the face)
    ctx.save();
    const nf = new Path2D(); nf.rect(330, -10, 200, 300); nf.addPath(faceP);
    ctx.clip(nf, 'evenodd');
    dots(ctx, inset(D.o[0], 3.6), { sp: 4.8, r: 1.3, closed: true, seed: 31, punch: 0.25 });
    ink(ctx, inset(D.o[0], 1.4), COL.line, 1, { closed: true, alpha: 0.8 });
    ctx.restore();
  },

  torso(ctx, D) {
    const { body } = nangBase(ctx, D, {
      lace: [
        [[395, 292], [440, 296], [450, 330], [436, 350], [412, 336]],
        [[556, 292], [606, 292], [598, 340], [575, 352], [560, 330]],
        [[455, 382], [480, 382], [480, 405], [458, 408]],
      ],
      seed: 3, rim: false,
    });
    ctx.save(); ctx.clip(body);
    // red side panels over the ribs, green under the collar
    panelN(ctx, [[438, 328], [456, 332], [462, 368], [452, 386], [440, 370]], COL.red, { seed: 1 });
    panelN(ctx, [[522, 334], [556, 330], [562, 356], [548, 380], [528, 372]], COL.red, { seed: 2 });
    panelN(ctx, [[536, 314], [566, 306], [568, 330], [548, 340]], COL.green, { seed: 3, dotsOn: false });
    panelN(ctx, [[432, 306], [462, 314], [452, 336], [434, 330]], COL.green, { seed: 4, dotsOn: false });
    // collar กรองคอ: concentric arcs of bands round the neck
    const arc = (rx, ry, a0 = 20, a1 = 160) => {
      const out = [];
      for (let a = a0; a <= a1; a += 10) out.push([504 - Math.cos(a * DEG) * rx, 262 + Math.sin(a * DEG) * ry]);
      return out;
    };
    const g1 = arc(82, 78, 18, 162), g0 = arc(66, 62, 14, 166);
    fillOn(ctx, poly([...C(g1), ...C(g0).reverse()]), COL.green, 0.92);
    bandN(ctx, arc(48, 44, 10, 170), 'red', 9, 5);
    bandN(ctx, arc(58, 53, 12, 168), 'cream', 7, 6);
    bandN(ctx, arc(67, 63, 14, 166), 'gold', 4, 7);
    dots(ctx, arc(74, 70, 16, 164), { sp: 5.2, r: 1.6, seed: 8, punch: 0.1 });
    fringe(ctx, arc(84, 80, 18, 162).reverse(), 7, { h: 1.3, flip: false, inner: COL.red });
    redFlower(ctx, 505, 335, 18);
    // sash (สไบ) from the near shoulder across the chest, looping at the hip
    stripe(ctx, [[430, 344], [470, 368], [512, 384], [552, 394]], 13, { fill: COL.green, seed: 9, sp: 4.4, r: 1.2 });
    stripe(ctx, [[552, 394], [566, 402], [578, 418], [570, 428], [556, 420]], 9, { fill: COL.red, seed: 10, sp: 4, r: 1.1 });
    // centre strap and belt
    stripe(ctx, [[505, 352], [505, 385], [505, 416]], 13, { fill: COL.red, seed: 11, sp: 4.4, r: 1.3 });
    bandN(ctx, [[448, 419], [478, 425], [505, 427], [532, 425], [560, 419]], 'red', 11, 12);
    bandN(ctx, [[450, 431], [478, 437], [505, 439], [532, 437], [558, 431]], 'cream', 7, 13);
    fringe(ctx, [[562, 444], [505, 450], [450, 444]], 6, { h: 1.2, inner: COL.red });
    ctx.restore();
    goldFlower(ctx, 507, 432, 15);
    redFlower(ctx, 507, 432, 6);
  },

  skirt(ctx, D) {
    const { body } = nangBase(ctx, D, { seed: 5 });
    ctx.save(); ctx.clip(body);
    // the two sash tails flying out on the far side: red, pierced
    const tails = [[300, 512], [432, 506], [430, 560], [441, 590], [436, 700], [300, 712]];
    cloth(ctx, smooth(tails, true), COL.red, 0.93);
    laceField(ctx, smooth(tails, true), [300, 500, 445, 715], { sp: 7.4, r: 1.5, seed: 8, punch: 0.3 });
    // green swags and red drapes, sprinkled with cream drops
    const G = [
      [[436, 505], [494, 506], [494, 520], [462, 536], [434, 544]],
      [[434, 560], [494, 534], [494, 572], [462, 594], [440, 606]],
      [[450, 626], [484, 604], [488, 640], [478, 690], [464, 696], [452, 662]],
      [[520, 500], [560, 505], [590, 532], [602, 556], [576, 556], [542, 528], [520, 518]],
      [[524, 566], [560, 584], [598, 608], [612, 628], [586, 628], [550, 612], [524, 596]],
      [[532, 616], [548, 642], [552, 690], [538, 698], [532, 660]],
    ];
    const Rd = [
      [[540, 538], [590, 566], [596, 584], [556, 574], [530, 552]],
      [[556, 638], [602, 648], [614, 690], [596, 700], [560, 670]],
    ];
    const panelsP = new Path2D();
    for (const p of [...G, ...Rd]) panelsP.addPath(smooth(p, true));
    G.forEach((p, i) => panelN(ctx, p, COL.green, { seed: 60 + i }));
    Rd.forEach((p, i) => panelN(ctx, p, COL.red, { seed: 70 + i }));
    for (const p of [...G, ...Rd]) laceField(ctx, smooth(inset(p, 6), true), bboxOf(p), { sp: 10, r: 1.25, seed: p[0][0], punch: 0 });
    // openwork in the dark cloth between the panels
    const notPanels = new Path2D();
    notPanels.rect(420, 480, 280, 280);
    notPanels.addPath(panelsP);
    ctx.save();
    ctx.clip(smooth([[452, 540], [548, 500], [560, 590], [676, 700], [640, 745], [440, 745], [446, 600]], true));
    laceField(ctx, notPanels, [440, 500, 680, 745], { sp: 6.6, r: 1.9, seed: 9, punch: 0.3, rule: 'evenodd' });
    ctx.restore();
    // centre panel ชายไหว: red / cream / red columns
    stripe(ctx, [[498, 500], [497, 600], [498, 700]], 10, { fill: COL.red, seed: 21, sp: 4.4, r: 1.2 });
    bandN(ctx, [[513, 502], [514, 600], [513, 705]], 'cream', 8, 22);
    stripe(ctx, [[528, 500], [530, 600], [528, 690]], 10, { fill: COL.red, seed: 23, sp: 4.4, r: 1.2 });
    // cream-beaded swag borders
    for (const [i, s] of [
      [[432, 548], [462, 538], [494, 522]], [[438, 614], [466, 598], [494, 578]],
      [[520, 522], [548, 540], [578, 562], [604, 562]], [[524, 602], [556, 620], [588, 634], [614, 634]],
    ].entries()) bandN(ctx, s, 'cream', 7, 30 + i);
    // waistband
    bandN(ctx, [[436, 462], [470, 468], [505, 470], [540, 468], [568, 462]], 'red', 10, 40);
    bandN(ctx, [[438, 476], [470, 482], [505, 484], [540, 482], [566, 476]], 'cream', 7, 41);
    bandN(ctx, [[440, 489], [470, 495], [505, 497], [540, 495], [564, 489]], 'red', 7, 42);
    fringe(ctx, [[564, 495], [505, 503], [442, 495]], 6, { h: 1.2, inner: COL.red });
    ctx.restore();
    redFlower(ctx, 510, 494, 13);
    for (const [x, y] of [[470, 650], [592, 680], [548, 712]]) rosette(ctx, x, y, 6);
  },
};

// Limbs: ornament bands across the axis frame, lace in between.
function nangLimb(ctx, D, o) {
  const f = axis(o.a, o.b);
  const lz = o.lace ? [o.lace.map(([u, v]) => f.at(u, v))] : [];
  const { body } = nangBase(ctx, D, { lace: lz, seed: o.seed, rim: false });
  ctx.save(); ctx.clip(body);
  for (const p of o.panels || []) panelN(ctx, p[1].map(([u, v]) => f.at(u, v)), p[0] === 'red' ? COL.red : COL.green, { seed: o.seed + 1, dotsOn: p[2] !== false });
  for (const [u, kind, w, du = 0] of o.bands || []) bandN(ctx, [f.at(u, -60), f.at(u + du / 2, 0), f.at(u + du, 60)], kind, w, o.seed + u * 100);
  for (const [u, kind, size, flip] of o.fringes || []) fringe(ctx, [f.at(u, -60), f.at(u, 60)], size, { h: 1.3, flip, inner: kind === 'green' ? COL.green : COL.red });
  for (const [u, v, len] of o.rows || []) dots(ctx, [f.at(u, v), f.at(u + len, v)], { sp: 4.6, r: 1.4, seed: o.seed + 7, sm: false });
  ctx.restore();
  for (const [u, v, R, gold] of o.flowers || []) (gold ? goldFlower : rosette)(ctx, ...f.at(u, v), R * 1.25);
  if (o.extra) o.extra(ctx, f);
}

const nangLimbs = {
  upperArmF: { a: [681, 240], b: [746, 329], seed: 201,
    bands: [[0.26, 'red', 8], [0.34, 'cream', 6], [0.42, 'red', 8], [0.5, 'gold', 4]], fringes: [[0.54, 'red', 6, true]],
    flowers: [[0.38, -14, 7], [0.36, 12, 6, true]],
    extra(ctx, f) {
      for (const [u, v] of [[0.34, -22], [0.44, -24], [0.26, -22]]) {
        const k = krajangPath(...f.at(u, v), 9, 16, Math.atan2(-0.6, 0.8) - 0.3);
        fillOn(ctx, k, COL.gold, 0.95); ink(ctx, k, INK.leather, 0.8);
      }
    } },
  upperArmB: { a: [328, 243], b: [262, 332], seed: 202,
    bands: [[0.26, 'red', 8], [0.34, 'cream', 6], [0.42, 'red', 8], [0.5, 'gold', 4]], fringes: [[0.54, 'red', 6, false]],
    flowers: [[0.38, 14, 7], [0.36, -12, 6, true]],
    extra(ctx, f) {
      for (const [u, v] of [[0.34, 22], [0.44, 24], [0.26, 22]]) {
        const k = krajangPath(...f.at(u, v), 9, 16, Math.PI + 0.9);
        fillOn(ctx, k, COL.gold, 0.95); ink(ctx, k, INK.leather, 0.8);
      }
    } },
  forearmF: { a: [762, 355], b: [848, 390], seed: 203, rows: [[0.3, 4, 0.6]], flowers: [[0.22, -6, 7], [1.03, 0, 9]],
    bands: [[0.93, 'red', 7]] },
  forearmB: { a: [243, 355], b: [150, 360], seed: 204, rows: [[0.3, -4, 0.55]], flowers: [[0.22, 6, 7], [1.03, 2, 9]],
    bands: [[0.93, 'red', 7]] },
  thighF: { a: [659, 375], b: [765, 496], seed: 205, lace: [[0.3, -30], [0.3, 30], [0.72, 30], [0.72, -30]],
    panels: [['green', [[0.12, -40], [0.1, 20], [0.28, 20], [0.3, -40]]]],
    bands: [[0.1, 'red', 9, 0.1], [0.18, 'cream', 6, 0.1], [0.78, 'red', 8], [0.86, 'cream', 5]], fringes: [[0.9, 'red', 5, true]],
    flowers: [[0.46, -4, 5], [0.24, 22, 5]] },
  thighB: { a: [341, 375], b: [233, 494], seed: 206, lace: [[0.3, -30], [0.3, 30], [0.72, 30], [0.72, -30]],
    panels: [['green', [[0.12, 40], [0.1, -20], [0.28, -20], [0.3, 40]]]],
    bands: [[0.1, 'red', 9, 0.1], [0.18, 'cream', 6, 0.1], [0.78, 'red', 8], [0.86, 'cream', 5]], fringes: [[0.9, 'red', 5, false]],
    flowers: [[0.46, 4, 5], [0.24, -22, 5]] },
  shinF: { a: [763, 525], b: [763, 690], seed: 207, lace: [[0.3, -14], [0.3, 14], [0.8, 12], [0.8, -12]],
    panels: [['green', [[0.25, -18], [0.25, -2], [0.42, -2], [0.42, -18]], false]],
    bands: [[0.05, 'red', 8, 0.04], [0.12, 'cream', 5, 0.04], [0.8, 'cream', 5], [0.87, 'red', 8]],
    flowers: [[0.3, 4, 9], [0.43, -12, 5], [0.87, 0, 7]],
    extra(ctx) { art(ctx, [[[808, 718], [818, 716], [814, 721], [826, 719]]], 1.4, COL.gold); } },
  shinB: { a: [241, 524], b: [240, 690], seed: 208, lace: [[0.3, -14], [0.3, 14], [0.8, 12], [0.8, -12]],
    panels: [['green', [[0.25, 18], [0.25, 2], [0.42, 2], [0.42, 18]], false]],
    bands: [[0.05, 'red', 8, -0.04], [0.12, 'cream', 5, -0.04], [0.8, 'cream', 5], [0.87, 'red', 8]],
    flowers: [[0.3, -6, 9], [0.43, 12, 5], [0.87, 0, 7]],
    extra(ctx) { art(ctx, [[[196, 718], [186, 716], [190, 721], [178, 719]]], 1.4, COL.gold); } },
};
for (const k in nangLimbs) NANG_DRAW[k] = (ctx, D) => nangLimb(ctx, D, nangLimbs[k]);

NANG_DRAW.handF = (ctx, D) => nangHand(ctx, D, [856, 385], 8);
NANG_DRAW.handJeeb = (ctx, D) => nangHand(ctx, D, [962, 275]);
NANG_DRAW.handWong = (ctx, D) => nangHand(ctx, D, [990, 355]);
NANG_DRAW.handPoint = (ctx, D) => nangHand(ctx, D, [1000, 427]);
NANG_DRAW.handCup = (ctx, D) => nangHand(ctx, D, [1015, 517]);

// Fan: pierced leaf with lotus flowers over open ribs; gilt guard stick.
NANG_DRAW.fan = (ctx, D) => {
  const { body } = hidePart(ctx, D, NS);
  const H = [1006, 694];
  const at = (a, r) => [H[0] + Math.cos(a * DEG) * r, H[1] + Math.sin(a * DEG) * r];
  // cut the gaps between the ribs
  const cutP = new Path2D();
  for (let a = -166; a < -30; a += 10) {
    const p = [at(a + 2.2, 16), at(a + 3.4, 68), at(a + 7.6, 68), at(a + 8.2, 16)];
    cutP.addPath(poly(p));
  }
  ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fill(cutP); ctx.restore();
  for (let a = -166; a <= -30; a += 10) ink(ctx, [at(a, 14), at(a, 66)], COL.gold, 1.1, { sm: false, alpha: 0.8 });
  // leaf: lace, scalloped dotted edge, lotus
  const leaf = new Path2D();
  const outer = [], inner = [];
  for (let a = -170; a <= -18; a += 4) { outer.push(at(a, 124)); inner.push(at(a, 66)); }
  leaf.addPath(poly([...outer, ...inner.reverse()]));
  ctx.save(); ctx.clip(body);
  laceField(ctx, leaf, [890, 560, 1125, 700], { sp: 10, r: 3, seed: 4, punch: 0.6, drop: 1.2 });
  for (const r of [72, 118]) dots(ctx, [...Array(40)].map((_, i) => at(-170 + i * 3.9, r)), { sp: 5, r: 1.6, col: COL.gold, punch: 0, seed: r });
  const lotus = (x, y, s) => {
    for (const [a, l, c] of [[-90, 1, COL.red], [-120, 0.8, COL.red], [-60, 0.8, COL.red], [-150, 0.6, COL.green], [-30, 0.6, COL.green]]) {
      const P = new Path2D(); petalPath(x, y, s * l, s * 0.32, a * DEG, P);
      fillOn(ctx, P, c, 0.95); ink(ctx, P, COL.dot, 0.9);
    }
    gem(ctx, x, y, s * 0.18, { col: COL.gold, ring: COL.red });
  };
  lotus(1006, 628, 30);
  lotus(944, 646, 18);
  lotus(1058, 638, 18);
  ctx.restore();
  // guard stick with gilt and dots
  const g = [at(-25, 20), at(-25, 128)];
  stripe(ctx, g, 7, { fill: COL.gold, seed: 8, sp: 7, r: 1.3, edge: INK.leather });
  rivet(ctx, H[0], H[1], 6);
};

const nangGeneric = (ctx, D) => nangBase(ctx, D);

// ================================================================ specs
const REUSI = {
  meta: { id: 'reusi', name: 'ฤๅษี', en: 'Ruesi — the Hermit', kind: 'hermit', voice: 'old', height: 430 },
  parts: {
    torso: { z: 0, mass: 1.4 },
    head: { z: 2, parent: 'torso', at: [499, 229], pivot: [499, 190], lim: [-22, 22], stiff: 0.7 },
    skirt: { z: 1, parent: 'torso', at: [498, 466], pivot: [498, 538], lim: [-14, 14], stiff: 0.75, mass: 1.2 },
    upperArmB: { z: -8, parent: 'torso', at: [401, 241], pivot: [347, 207], axis: [[347, 207], [258, 312]], aim: 98, stiff: 0.12 },
    forearmB: { z: -7, parent: 'upperArmB', at: [258, 313], pivot: [247, 347], axis: [[247, 347], [167, 463]], aim: 84, lim: [-150, 12], stiff: 0.18 },
    handB: { z: -9, parent: 'forearmB', at: [167, 463], pivot: [148, 478], lim: [-55, 55], stiff: 0.3 },
    thighB: { z: -6, parent: 'skirt', at: [434, 572], pivot: [326, 506], axis: [[326, 506], [262, 678]], aim: 100, lim: [-75, 75], stiff: 0.45 },
    shinB: { z: -7, parent: 'thighB', at: [262, 678], pivot: [285, 718], axis: [[285, 718], [275, 905]], aim: 92, lim: [-8, 125], stiff: 0.5 },
    thighF: { z: -4, parent: 'skirt', at: [579, 561], pivot: [682, 505], axis: [[682, 505], [747, 675]], aim: 80, lim: [-75, 75], stiff: 0.45 },
    shinF: { z: -5, parent: 'thighF', at: [747, 675], pivot: [730, 715], axis: [[730, 715], [745, 905]], aim: 89, lim: [-8, 125], stiff: 0.5 },
    upperArmF: { z: 3, parent: 'torso', at: [585, 245], pivot: [652, 206], axis: [[652, 206], [732, 315]], aim: 84, stiff: 0.12 },
    forearmF: { z: 5, parent: 'upperArmF', at: [732, 315], pivot: [737, 352], axis: [[737, 352], [803, 476]], aim: 70, lim: [-150, 12], stiff: 0.18 },
    handF: { z: 4, parent: 'forearmF', at: [803, 476], pivot: [822, 489], lim: [-55, 55], stiff: 0.3 },
  },
  rod: { part: 'torso', a: [499, 212], b: [498, 470], extend: 300 },
  handRods: { handF: [858, 506], handB: [110, 505] },
  grips: { handF: [852, 500], handB: [112, 500] },
  holds: { handF: 'reusi-cane' },
  limbs: {
    torso: 'torso', head: 'head', pelvis: 'skirt',
    armF: ['upperArmF', 'forearmF', 'handF'], armB: ['upperArmB', 'forearmB', 'handB'],
    legF: ['thighF', 'shinF'], legB: ['thighB', 'shinB'],
  },
};

const NANG = {
  meta: { id: 'nang', name: 'นางเอก', en: 'Nang — the Princess', kind: 'heroine', voice: 'female', height: 420 },
  parts: {
    torso: { z: 0, mass: 1.2 },
    head: { z: 3, parent: 'torso', at: [499, 293], pivot: [479, 256], lim: [-22, 22], stiff: 0.7 },
    skirt: { z: 1, parent: 'torso', at: [500, 455], pivot: [500, 472], lim: [-14, 14], stiff: 0.75, mass: 1.3 },
    upperArmB: { z: -8, parent: 'torso', at: [418, 298], pivot: [328, 243], axis: [[328, 243], [262, 332]], aim: 104, stiff: 0.14 },
    forearmB: { z: -7, parent: 'upperArmB', at: [262, 332], pivot: [243, 355], axis: [[243, 355], [150, 360]], aim: 150, lim: [-150, 20], stiff: 0.2 },
    thighB: { z: -6, parent: 'skirt', at: [445, 482], pivot: [341, 375], axis: [[341, 375], [233, 494]], aim: 116, lim: [-70, 70], stiff: 0.5 },
    shinB: { z: -7, parent: 'thighB', at: [233, 494], pivot: [241, 524], axis: [[241, 524], [240, 690]], aim: 90, lim: [-10, 125], stiff: 0.5 },
    thighF: { z: -4, parent: 'skirt', at: [555, 482], pivot: [659, 375], axis: [[659, 375], [765, 496]], aim: 64, lim: [-70, 70], stiff: 0.5 },
    shinF: { z: -5, parent: 'thighF', at: [765, 496], pivot: [763, 525], axis: [[763, 525], [763, 690]], aim: 90, lim: [-10, 125], stiff: 0.5 },
    upperArmF: { z: 4, parent: 'torso', at: [582, 298], pivot: [681, 240], axis: [[681, 240], [746, 329]], aim: 78, stiff: 0.14 },
    forearmF: { z: 6, parent: 'upperArmF', at: [746, 329], pivot: [762, 355], axis: [[762, 355], [848, 390]], aim: 40, lim: [-150, 20], stiff: 0.2 },
    handF: { z: 5, parent: 'forearmF', at: [846, 390], pivot: [852, 390], lim: [-60, 60], stiff: 0.3 },
  },
  // Alternate hand sprites (the four spare hands on the sheet) that dance
  // poses swap in for handF.
  hands: {
    jeeb: { img: 'handJeeb', pivot: [942, 288] },
    wong: { img: 'handWong', pivot: [969, 352] },
    point: { img: 'handPoint', pivot: [972, 419] },
    cup: { img: 'handCup', pivot: [991, 517] },
  },
  rod: { part: 'torso', a: [500, 285], b: [500, 455], extend: 330 },
  handRods: { handF: [900, 385], handB: [95, 345] },
  grips: { handF: [905, 380], handB: [90, 350] },
  limbs: {
    torso: 'torso', head: 'head', pelvis: 'skirt',
    armF: ['upperArmF', 'forearmF', 'handF'], armB: ['upperArmB', 'forearmB'],
    legF: ['thighF', 'shinF'], legB: ['thighB', 'shinB'],
  },
};

function buildSet(who, spec, s, drawers, generic, extra) {
  const riv = rivetsFor(spec);
  const sprites = {};
  const names = new Set([...Object.keys(spec.parts), ...Object.values(spec.hands || {}).map((h) => h.img), ...extra]);
  for (const name of names) {
    const draw = drawers[name] || generic;
    sprites[name] = sheetSprite(who, name, s, withRivets(draw, riv[name], 6.5));
  }
  return sprites;
}

export async function loadSheetPuppets() {
  const t0 = performance.now();
  const r = buildSet('reusi', REUSI, 0.47, REUSI_DRAW, reusiGeneric, ['cane', 'pot']);
  const t1 = performance.now();
  const n = buildSet('nang', NANG, 0.56, NANG_DRAW, nangGeneric, ['fan']);
  const t2 = performance.now();
  if (typeof location !== 'undefined' && /[?&]debug=1/.test(location.search)) console.log(`sheet puppets: reusi ${(t1 - t0).toFixed(0)}ms, nang ${(t2 - t1).toFixed(0)}ms`);
  const reusi = sheetRig({ ...REUSI, lines: LINES.reusi }, r, 0.47);
  const nang = sheetRig({ ...NANG, lines: LINES.nang }, n, 0.56);
  const props = [
    { id: 'reusi-cane', name: 'ไม้เท้าฤๅษี', en: "Hermit's staff", cat: 'weapons', sprite: r.cane, grip: [1068 * 0.47, 185 * 0.47], upright: true, weapon: { kind: 'blunt', a: [1075 * 0.47, 90 * 0.47], b: [1082 * 0.47, 890 * 0.47] } },
    { id: 'reusi-pot', name: 'หม้อน้ำมนต์', en: 'Holy-water pot', cat: 'household', sprite: r.pot, grip: [928 * 0.47, 240 * 0.47] },
    { id: 'nang-fan', name: 'พัดนาง', en: "Princess's fan", cat: 'household', sprite: n.fan, grip: [1000 * 0.56, 700 * 0.56] },
  ];
  return { puppets: [reusi, nang], props };
}

// ================================================================ lines
const LINES = {
  reusi: {
    greet: [
      { th: 'เจริญพรเถิดโยม', en: 'Blessings upon you, child.' },
      { th: 'มาจากป่าเขาลำเนาไพรใดเล่า', en: 'From which forest and hill have you come?' },
      { th: 'นั่งลงก่อนเถิด ดื่มน้ำมนต์สักขันหนึ่ง', en: 'Sit a while, and drink a bowl of holy water.' },
      { th: 'ตาเฒ่าบำเพ็ญพรตอยู่ที่นี่มาร้อยปี', en: 'This old man has meditated here for a hundred years.' },
    ],
    fight: [
      { th: 'ไม้เท้านี้มีมนต์ ระวังให้ดี!', en: 'This staff is charmed — take care!' },
      { th: 'โอม! จงสะท้อนกลับไป!', en: 'Om! Be turned back!' },
      { th: 'แก่แล้วก็จริง แต่วิชายังไม่เสื่อม', en: 'Old I may be, but my lore has not faded.' },
    ],
    taunt: [
      { th: 'ใจร้อนนัก ไปนั่งสมาธิเสียก่อนเถิด', en: 'So hot-headed! Go and meditate first.' },
      { th: 'ฤทธิ์เพียงนี้ ยังไม่พอให้ตาเฒ่าลืมตา', en: "That power isn't enough to open this old man's eyes." },
      { th: 'ไฟโทสะเผาตัวเองก่อนผู้อื่นนะหลาน', en: 'Anger burns its owner first, my child.' },
    ],
    dance: [
      { th: 'ตาเฒ่าขอรำถวายครูสักหน่อย', en: 'Let this old man dance in honour of the teachers.' },
      { th: 'ย่างช้า ๆ อย่างฤๅษีเดินดง', en: 'Slow steps, like a hermit walking the woods.' },
      { th: 'ทับกับโหม่งมา ขาแก่ก็ยังขยับ', en: 'When the drums and gong play, even old legs move.' },
    ],
    flee: [
      { th: 'ขอกลับอาศรมก่อนละ', en: "I'll return to my hermitage now." },
      { th: 'หายตัว! ...เอ๊ะ ทำไมยังเห็นอยู่', en: 'Vanish! ...Eh? Why can you still see me?' },
      { th: 'หลังตาเฒ่าไม่ดี ขอถอยก่อน', en: 'My old back aches — I must withdraw.' },
    ],
    idle: [
      { th: 'สาธุ ขอให้สัตว์ทั้งหลายเป็นสุขเถิด', en: 'Sadhu — may all beings be happy.' },
      { th: 'หม้อน้ำมนต์ใบนี้ ตักมาจากห้วยหิมพานต์', en: 'This holy water comes from a Himavanta stream.' },
      { th: 'หนวดเคราขาวไปหมดแล้ว หัวก็เหลือแต่ผมหยิก', en: 'My beard is all white, and only curls remain on top.' },
    ],
  },
  nang: {
    greet: [
      { th: 'สวัสดีเจ้าค่ะ ท่านมาจากเมืองใด', en: 'Greetings, sir. Which city do you come from?' },
      { th: 'น้อมไหว้ด้วยใจ ยินดีที่ได้พบเจ้าค่ะ', en: 'I bow with all my heart — how glad I am to meet you.' },
      { th: 'เชิญเข้ามาในสวนดอกไม้ก่อนเถิด', en: 'Please, come into the flower garden.' },
    ],
    fight: [
      { th: 'อย่าเข้ามาใกล้นะ ข้ามีพัดวิเศษ!', en: 'Stay back — I have a magic fan!' },
      { th: 'แม้เป็นหญิง ใจข้าก็กล้าหาญ', en: 'I may be a woman, but my heart is brave.' },
      { th: 'ช่วยด้วย! พระเอกอยู่ไหนกัน', en: 'Help! Where is my prince?' },
    ],
    taunt: [
      { th: 'หน้าตาเช่นนี้ ใครเขาจะรักเล่า', en: 'With a face like that, who could love you?' },
      { th: 'กิริยาหยาบคายนัก ไม่สมเป็นชายชาตรี', en: 'Such rude manners — hardly a gentleman.' },
      { th: 'ข้าไม่กลัวท่านหรอกเจ้าค่ะ', en: "I'm not afraid of you, sir." },
    ],
    dance: [
      { th: 'รำให้ชมนะเจ้าคะ ตั้งวงให้งาม', en: "I'll dance for you — hands held in a lovely curve." },
      { th: 'จีบนิ้วให้อ่อนช้อย ดั่งกลีบบัวบาน', en: 'Fingers curled softly, like lotus petals opening.' },
      { th: 'เสียงปี่เสียงกลองชวนให้ร่ายรำ', en: 'The pipes and drums invite me to dance.' },
    ],
    flee: [
      { th: 'กรี๊ด! หนีเร็ว!', en: 'Eek! Run!' },
      { th: 'ขอตัวกลับวังก่อนเจ้าค่ะ', en: 'Please excuse me, I must return to the palace.' },
      { th: 'ยักษ์มาแล้ว! ช่วยด้วย!', en: 'The demon is coming! Help!' },
    ],
    idle: [
      { th: 'ดอกมะลิบานหอมไปทั้งสวน', en: 'The jasmine perfumes the whole garden.' },
      { th: 'คิดถึงพระเอกเหลือเกิน', en: 'How I miss my prince.' },
      { th: 'พัดโบกเบา ๆ ลมเย็นสบาย', en: 'A gentle wave of the fan, such a cool breeze.' },
    ],
  },
};

// ================================================================ data
// Silhouettes traced from the sheets, in sheet pixels, delta-encoded
// "x,y,dx,dy,...":  box: [x, y, w, h] crop on the sheet · o: outline(s) ·
// h: cut-outs.
const DATA = {
  reusi: {
    head: {"box":[428,6,149,201],"o":["501,13,-18,3,-3,3,-8,1,-2,3,-3,-1,-5,5,-4,1,-2,3,-5,3,-1,3,-4,2,0,4,-5,3,0,4,-3,2,0,4,-2,2,0,5,-2,3,1,5,-1,1,1,7,-1,4,1,5,2,2,0,5,4,4,0,3,3,3,1,4,3,1,0,3,4,3,0,2,3,1,1,3,4,2,2,4,3,1,10,12,2,6,0,11,-4,10,-6,8,3,7,8,9,9,5,9,3,16,1,5,-1,10,-5,6,-8,0,-4,-3,-6,-2,1,-1,-1,1,-15,2,-7,6,-6,0,-2,11,-3,11,0,6,-4,2,-4,0,-4,-4,-6,0,-4,3,-2,0,-3,-2,-2,2,-5,-3,-5,2,-2,6,-1,2,-5,-14,-21,-4,-16,-4,-8,-8,-10,1,-3,-3,-7,-12,-11,-4,-1,-3,-3,-3,1,-3,-3,-6,-1,-3,1"]},
    cane: {"box":[1008,50,106,851],"o":["1048,57,-9,1,-13,8,-7,8,-3,6,0,4,-2,3,0,8,2,5,3,3,6,0,4,-2,10,-11,3,-1,7,1,8,7,6,11,1,17,-3,4,-5,14,1,2,-1,14,5,10,1,11,2,3,-1,18,-2,4,-3,18,0,17,2,3,-1,7,3,5,2,15,-1,7,1,8,-3,9,1,6,-1,15,2,3,-1,3,1,10,6,26,2,29,2,10,-1,3,2,10,0,45,-1,3,2,10,0,11,1,1,-1,5,2,19,-1,42,2,10,1,21,-1,1,-3,59,2,4,1,9,0,18,-2,8,1,1,0,10,4,17,-1,20,-1,1,1,100,-4,36,-5,17,-1,11,4,7,4,0,10,-5,5,-1,2,-3,1,-6,-2,-9,0,-96,3,-31,-1,-2,1,-1,0,-15,-1,-1,1,-3,-2,-5,0,-17,-1,-1,0,-14,1,-1,-1,-2,1,-7,0,-26,-1,-1,1,-9,-1,-2,1,-5,-1,-1,0,-22,-1,-1,1,-23,3,-14,0,-17,-1,-1,-1,-30,-1,-1,2,-68,-1,-1,0,-20,-2,-5,-1,-23,-2,-8,-1,-33,-2,-13,1,-1,-1,-46,-4,-20,0,-26,4,-22,0,-19,-4,-26,1,-1,0,-13,4,-15,0,-9,2,-9,11,-13,5,-9,0,-3,2,-3,0,-11,-4,-9,-12,-9,-7,-2,-19,-22,-5,-3"]},
    upperArmF: {"box":[631,181,113,163],"o":["649,191,-8,7,-3,6,1,20,3,9,15,26,7,17,15,27,0,2,6,10,9,11,13,10,5,2,9,0,8,-3,5,-6,2,-6,-2,-16,4,-5,1,-10,-8,-23,-7,-11,-5,-12,-25,-41,-11,-11,-18,-6,-7,0"]},
    upperArmB: {"box":[245,182,123,158],"o":["356,194,-7,-4,-6,-1,-18,2,-12,7,-20,22,-29,42,-10,21,-1,11,3,4,0,3,-4,9,-1,9,5,10,9,5,11,0,5,-2,9,-6,18,-19,5,-9,4,-4,11,-20,20,-27,11,-18,4,-11,0,-13,-2,-5"]},
    torso: {"box":[376,206,251,283],"o":["398,228,-7,5,-7,12,-2,8,1,17,6,12,17,18,11,22,1,11,6,16,1,32,-3,10,-6,9,-1,4,-2,1,-4,8,0,3,-4,3,-12,17,-1,4,17,12,21,12,31,12,26,5,13,-1,1,2,32,-1,2,-2,6,1,5,-2,9,-1,19,-8,4,-4,2,-14,5,-3,5,-1,14,-11,4,-8,1,-10,9,-7,3,-4,0,-10,-3,-11,0,-12,-2,-12,5,-6,0,-9,-3,-10,-3,-2,1,-4,-1,-1,-1,-20,-2,-6,-3,-2,2,-2,1,-10,-2,-23,-3,-12,-6,-12,-8,-8,-9,-4,-23,-4,-6,1,-2,-2,-13,-2,-4,-2,-15,-1,-7,2,-6,-7,-6,-3,-4,0,-4,2,-8,8,-8,3,-19,1,-20,-3,-21,0,-1,1,-4,-1"]},
    pot: {"box":[816,226,227,188],"o":["856,243,-3,4,-3,11,-15,16,-7,14,-5,17,-1,17,6,23,6,11,7,9,26,22,1,5,4,5,15,6,27,5,8,0,3,-2,5,2,2,-1,1,1,13,0,7,-2,9,0,24,-8,4,-4,2,-8,15,-10,15,-15,6,-9,7,-17,2,-10,0,-22,-4,-15,-4,-8,-8,-12,-11,-11,-3,-10,-4,-5,-11,-4,-19,-3,-51,-2,-1,1,-16,0,-27,3,-15,3"]},
    forearmB: {"box":[148,325,122,160],"o":["256,334,-6,-2,-11,0,-7,4,-19,19,-7,9,0,4,-1,1,-2,-1,-13,19,0,4,-4,4,-12,20,-7,16,-6,9,-2,7,-3,3,-2,16,4,9,8,4,7,0,6,-3,3,-5,1,-6,14,-19,15,-15,3,-6,4,-2,31,-35,11,-19,4,-13,0,-7,-2,-8"]},
    forearmF: {"box":[715,329,107,167],"o":["730,339,-7,8,-2,7,1,2,-1,4,4,17,10,21,17,24,0,4,10,12,4,1,0,4,5,8,5,4,0,3,11,15,3,12,6,5,13,-1,7,-9,1,-10,-2,-4,1,-4,-5,-10,-1,-7,-3,-5,-3,-10,-3,-2,1,-4,-4,-7,-2,-8,-4,-8,-3,-1,1,-4,-8,-18,-11,-19,-14,-17,-9,-5,-5,-1,-3,1,-2,-1"]},
    handB: {"box":[56,456,101,99],"o":["149,472,-5,-5,-8,-3,-16,-1,-15,4,-12,7,-8,8,-8,14,-8,7,-6,3,1,4,7,3,-4,29,3,1,4,-3,3,-6,1,-7,2,-2,2,2,3,11,0,9,2,2,5,-4,2,-10,2,3,0,3,3,1,3,-5,0,-13,2,-6,5,-5,6,-3,-1,-2,1,-1,11,1,14,-6,8,-8,4,-9,0,-6"]},
    handF: {"box":[810,470,113,94],"o":["819,487,-3,6,0,8,3,7,5,6,13,6,21,1,10,5,4,7,2,1,0,7,2,6,3,3,4,0,6,8,4,-1,-2,-11,2,-9,2,1,4,10,6,5,4,-1,-2,-8,-3,-3,1,-4,-4,-11,2,-1,4,5,4,2,6,0,0,-3,-5,-7,-3,-2,1,-2,-13,-17,-15,-13,-11,-6,-13,-4,-9,-1,-17,2,-10,5"]},
    thighF: {"box":[648,481,137,218],"o":["678,490,-7,3,-8,7,-6,12,-3,13,1,30,7,23,4,8,0,4,22,37,2,7,4,2,23,36,16,16,8,4,9,1,7,-2,7,-6,3,-8,4,-4,5,-9,3,-10,0,-21,-6,-22,-12,-21,0,-2,-3,-2,1,-2,-1,-15,-5,-21,-4,-9,-6,-6,-6,-3,-15,-23,-10,-12,-4,-3,-12,-4"]},
    thighB: {"box":[229,483,136,220],"o":["335,492,-18,-2,-10,3,-5,3,-8,8,-21,32,-8,4,-3,6,-9,29,0,6,3,4,-5,6,0,2,-10,16,-6,28,2,3,0,12,6,22,4,5,2,8,8,8,3,1,13,-1,6,-3,13,-12,30,-45,4,-1,1,-5,3,-2,20,-36,9,-29,1,-29,-3,-15,-6,-13,-10,-10"]},
    skirt: {"box":[374,516,268,377],"o":["590,543,-16,-5,-16,-2,-31,-8,-9,-1,-5,-3,-15,-1,-5,3,-5,-1,-14,4,-29,14,-3,5,-6,1,-5,4,-11,13,-9,20,-4,17,1,7,-3,5,0,13,3,11,-1,24,8,17,2,9,-11,21,-3,22,0,10,2,6,1,11,5,16,-9,13,-7,15,-7,19,-1,9,-2,2,0,6,-2,4,0,7,-2,8,0,11,4,4,22,9,5,0,11,3,16,1,19,-5,15,5,14,1,7,-5,-1,-17,2,-14,2,2,0,8,3,9,10,6,14,3,14,-1,10,-4,6,4,18,0,1,1,18,-1,20,-5,26,-14,-11,-32,-4,-3,0,-4,-11,-26,-2,-13,-2,-2,-1,-18,-2,-7,-2,-2,9,-30,0,-10,1,-1,-1,-20,-3,-8,0,-12,-1,-1,2,-2,0,-7,-2,-2,0,-3,2,-4,2,-11,-2,-6,-1,-29,-1,-1,0,-10,-2,-3,-2,-23,-5,-15,-4,-8"]},
    shinF: {"box":[693,689,175,306],"o":["720,697,-12,8,-5,10,-3,14,0,20,8,26,18,37,0,4,3,5,3,10,3,16,0,23,-1,5,-3,3,-1,19,-2,3,1,4,-7,14,1,4,-3,2,-1,4,0,10,2,7,7,11,10,7,7,2,21,2,16,6,19,10,9,2,11,-1,11,4,13,0,6,-6,9,-4,3,-3,0,-2,-7,-5,-1,-3,-6,-5,-1,-4,-8,-8,-12,-6,-13,-2,-19,-10,-8,-6,-13,-13,-4,-7,1,-2,-1,-10,4,-14,-2,-7,0,-23,2,-20,0,-41,-2,-8,-1,-16,-6,-30,-8,-21,-8,-9,-15,-7"]},
    shinB: {"box":[137,691,188,297],"o":["299,700,-17,-1,-12,5,-9,9,-7,16,-4,32,0,13,2,2,-2,1,-1,5,1,3,-1,17,1,1,1,25,4,41,-3,4,3,18,-2,6,2,3,-6,8,-6,5,-29,15,-26,6,-8,-1,-8,2,-12,7,-5,5,1,3,-9,4,-3,3,0,3,3,3,5,2,-1,1,1,4,4,2,4,0,2,6,5,3,9,1,5,-1,6,-4,7,2,17,-1,9,-3,11,-7,5,-1,5,-3,18,-3,1,1,2,-1,13,1,10,-2,12,-8,-1,-3,-2,2,-3,-2,3,-4,4,3,2,0,4,-9,0,-14,-2,-2,1,-2,-1,-5,-6,-12,1,-5,-2,-3,0,-10,-1,-1,1,-6,-3,-4,-1,-7,1,-29,9,-34,8,-17,8,-23,3,-16,-1,-17,-6,-19,-10,-11"]},
  },
  nang: {
    head: {"box":[344,1,168,279],"o":["351,9,2,21,-2,2,0,9,4,6,-2,9,1,5,3,5,1,9,4,4,-4,6,0,5,2,2,0,3,-4,2,-2,7,2,7,8,4,-4,10,1,4,-3,1,0,2,-5,3,2,5,-1,6,5,3,-2,6,0,6,3,3,6,0,2,6,3,3,3,-1,3,1,3,-6,3,3,5,2,1,6,-5,7,0,6,2,4,5,4,-2,2,1,8,2,3,6,4,1,5,-3,4,-4,-1,-2,2,1,5,-3,3,1,5,-6,2,2,5,-3,3,0,8,5,6,5,1,2,7,5,3,5,0,5,-3,2,2,6,0,4,-3,2,-4,6,2,4,-3,1,-7,2,0,13,8,16,3,13,-2,5,-5,0,-3,-4,-6,-2,-7,1,-11,4,-6,11,0,5,-1,4,-3,-1,-10,2,-9,-2,-3,5,-4,0,-3,-10,-9,-5,-8,0,-7,-10,-14,-2,-15,-3,-4,-5,-14,-3,-1,-5,13,-3,-3,-2,1,-2,-9,-4,-4,1,-2,-1,-4,-10,-14,-1,0,-3,12,-2,1,-6,-5,0,-3,-3,-4,-6,-4,-6,1,-3,-4,-2,0,-3,-3,1,-8,-1,-2,-4,-1,-2,-8,-7,1,-2,-4,-8,-7,0,-8,-5,-8,-10,-6,-3,-10,-5,-3,0,-3,-7,-14"],"h":["473,256,2,2,0,2,-4,4,-3,-4"]},
    handJeeb: {"box":[936,202,120,100],"o":["1046,249,-6,-3,-12,0,-9,2,-24,-2,-1,-4,8,-12,2,-6,0,-10,-1,-3,-2,-1,-1,11,-3,6,-18,20,-8,13,-3,0,-3,3,-5,-1,-4,6,-7,1,-1,2,1,2,-7,5,0,9,3,6,3,2,6,1,6,-3,4,2,4,-3,2,-4,7,0,3,-6,4,-3,10,-1,12,-5,12,0,10,4,8,7,7,4,7,0,-1,-2,-5,-2,-11,-10,0,-2,-7,-9,-12,-7,1,-2,23,-4,6,1"]},
    upperArmF: {"box":[664,225,102,125],"o":["677,233,-6,7,0,13,7,20,5,8,0,4,17,20,1,5,4,3,2,5,6,4,0,3,2,3,3,2,4,-1,17,15,8,0,6,-2,5,-5,3,-8,-16,-25,4,-4,0,-5,4,-4,0,-4,-3,-5,5,-7,0,-4,-3,-2,-1,-7,-3,-2,-5,3,-5,8,-3,2,-6,-4,0,-3,-4,-4,-6,-3,0,-3,-8,-9,-4,-3,-3,0,-7,-7,-10,-5"]},
    upperArmB: {"box":[242,227,103,125],"o":["335,237,-4,-2,-8,0,-7,3,-9,7,-4,0,-5,5,0,2,-3,1,0,2,-2,1,0,3,-10,6,-2,4,-5,3,-5,-9,-5,-4,-2,1,-2,7,-3,3,0,5,3,6,-3,4,0,6,3,3,-1,5,4,4,-17,26,1,7,6,7,7,3,5,0,5,-2,15,-14,5,0,4,-4,1,-5,7,-4,5,-10,9,-10,0,-2,3,-2,2,-4,4,-3,0,-4,8,-13,5,-19,-1,-7"]},
    torso: {"box":[397,269,211,198],"o":["416,292,-4,4,0,4,-2,1,-1,5,-6,10,2,1,3,7,4,2,-1,3,1,6,9,20,4,4,1,3,4,1,6,6,6,1,4,4,0,2,3,3,0,5,6,3,4,8,5,6,1,8,-4,7,-2,-1,-3,3,0,2,-7,10,1,4,6,6,18,8,18,1,2,2,0,8,4,4,6,0,4,-4,1,1,4,-1,5,-7,5,1,7,-6,11,-2,11,-6,6,-8,7,1,4,-2,6,-6,4,-6,0,-4,-3,-5,-21,-20,-2,1,1,2,-4,4,-4,-3,0,-2,3,-3,-2,-4,1,-2,-1,-5,5,-10,5,-6,5,-12,10,11,11,7,0,-11,4,-12,8,-16,8,-7,-13,-18,0,-7,-4,-4,-6,0,-2,2,-6,-3,-23,1,-3,-3,-3,1,-10,-10,-2,0,-3,10,-10,9,-5,2,-8,0,-1,-1,3,-3,0,-6,-4,-4,-6,0,-4,4,0,6,2,2,-3,1,-6,-2,-10,-7,-6,-7,-3,-7,-2,0,-1,3,-8,7,-4,0,-2,3,-23,3"]},
    forearmB: {"box":[49,294,210,115],"o":["56,356,5,5,13,7,18,18,10,4,8,0,12,4,-4,2,0,3,2,3,8,-1,7,-8,7,2,2,-2,7,1,3,-2,1,-3,3,0,2,-2,33,-3,7,-2,7,0,9,-3,6,1,8,-4,3,0,3,-3,10,-3,7,-9,0,-7,-4,-7,-6,-3,-8,0,-2,-2,-5,1,-4,-4,-3,0,-3,3,-8,1,-2,3,-17,4,-33,14,-7,1,-1,-3,-2,0,-1,2,-7,-1,-11,7,-8,-3,-6,5,-4,-1,-5,-6,-2,-7,-1,-13,-16,-22,-3,-11,0,-11,-2,1,-2,7,0,10,8,18,-1,1,-3,-1,-7,1,-8,-15,-1,9,4,8,-5,5,-3,8,-3,3,-1,-1"]},
    handWong: {"box":[962,304,121,85],"o":["971,350,-1,9,2,4,6,2,4,5,7,-2,4,1,3,3,4,0,1,-2,3,-1,12,1,7,-2,19,-12,8,20,3,4,5,3,2,-1,-4,-4,-3,-6,-6,-21,1,-1,4,1,12,6,13,-1,-2,-2,-10,-2,-31,-16,-8,-1,-1,-2,5,-9,0,-9,-2,-4,-1,0,-2,12,-17,22,-5,2,-1,2,-2,-5,-10,1,-3,-3,-3,0,-3,3,-6,-1"]},
    forearmF: {"box":[745,326,109,104],"o":["752,353,-1,9,2,5,5,5,10,5,2,3,3,0,5,4,8,1,27,9,7,1,9,4,4,0,5,3,1,3,4,4,3,-1,6,1,0,-27,-3,-4,-4,1,-4,-2,-4,-4,-20,-13,-20,-9,-2,-3,-3,0,-4,-4,-8,3,-3,-2,-2,2,-13,-2,-5,2"]},
    handF: {"box":[842,326,107,104],"o":["943,347,-8,11,-7,5,-13,1,-1,-2,4,-4,4,-9,-1,-12,-3,-3,0,11,-3,7,-18,18,-5,16,-6,6,-5,1,-1,-2,-3,0,-2,-2,-6,0,-5,-4,-3,0,-3,-5,-6,2,-3,-4,-3,1,0,28,2,2,3,0,2,3,3,-1,3,1,6,9,3,2,3,0,3,-4,-1,-5,1,-2,5,-1,16,1,11,-3,5,-3,10,-9,12,-6,8,-7,0,-2,-4,1,-4,-3,0,-5,-3,-6,8,-7,3,-6"]},
    thighB: {"box":[215,359,152,173],"o":["349,368,-4,-2,-9,0,-8,3,-22,16,-22,21,-17,21,-16,24,-6,3,-2,7,-6,8,-7,6,1,3,-10,15,1,9,5,6,5,2,17,-1,7,-2,16,-9,5,-1,42,-36,2,4,-2,6,0,12,-1,1,1,2,-2,23,2,4,-1,1,1,2,-1,8,12,-13,-1,-4,3,-3,5,-2,-2,-8,2,-2,7,-1,4,-5,0,-5,2,-3,-6,-4,-2,-10,9,-17,10,-34,-1,-28,-3,-8"]},
    thighF: {"box":[633,359,151,169],"o":["652,369,-5,5,-5,10,-3,13,1,9,-1,9,3,15,17,35,-2,2,0,6,-2,7,-4,4,0,3,3,4,0,5,3,3,4,0,5,4,-3,7,4,3,3,0,9,8,1,-2,-1,-8,2,-3,0,-37,-1,-1,1,-8,27,21,4,5,3,1,9,8,5,1,8,6,8,4,16,4,6,0,7,-3,5,-10,-1,-7,-9,-11,1,-4,-9,-10,-4,-7,-1,-5,-5,-2,-9,-15,-18,-23,-29,-30,-19,-15,-9,-4,-9,0"]},
    handPoint: {"box":[967,385,140,72],"o":["1102,429,-6,0,-16,5,-21,3,-1,-2,2,-3,0,-9,-1,-2,-3,-1,-3,1,-1,-2,2,-2,25,2,3,-1,1,-2,-11,-1,-11,-4,-14,1,-1,-1,2,-3,1,-8,-2,-5,-4,-3,1,11,-2,4,-8,7,1,2,-1,1,-3,-1,-10,6,-6,0,-2,-3,-4,-2,-5,2,-4,-1,-7,-8,-2,0,-4,5,-8,-1,-5,8,-1,9,7,5,-2,7,3,5,7,-1,6,-4,4,2,4,0,5,5,3,0,3,-4,10,2,14,0,41,-8,16,-5,7,-4"]},
    skirt: {"box":[317,447,353,288],"o":["324,594,-1,5,4,7,-3,5,0,5,9,9,3,0,9,-11,8,-2,12,-6,10,-7,12,-13,8,1,14,-15,19,-35,1,4,-2,2,-1,21,-2,6,-1,12,-5,19,-8,19,-6,9,-11,11,-8,4,-10,1,-5,-1,-3,-3,-3,1,0,4,2,4,-4,5,0,4,3,4,-3,2,-7,16,12,0,12,-3,3,-5,6,1,16,-10,11,-12,8,-12,11,-25,2,-10,2,-1,3,8,-2,7,2,2,1,7,3,3,3,-1,2,3,10,33,1,16,-3,5,1,13,2,3,4,2,3,0,3,-2,2,1,2,4,-1,10,3,5,7,6,6,0,9,-6,7,3,8,0,4,-2,5,-7,1,-7,-1,-7,4,-3,2,1,2,8,6,6,4,0,2,-4,0,-4,2,-2,5,0,3,5,0,9,8,-1,5,5,3,1,6,-2,4,-5,6,1,6,-1,5,-3,4,-8,6,-1,15,-10,0,-1,-13,0,-9,-2,-6,-9,1,-4,8,3,19,0,9,-2,13,-6,3,0,15,15,2,-1,1,-3,0,-9,-9,-9,1,-3,-1,-6,-11,-5,-4,-4,-2,0,-18,-17,-10,-15,2,-3,0,-4,-9,-9,-6,-9,1,-3,-4,-4,-1,-5,-3,-3,0,-3,2,-1,9,11,7,1,2,-3,-1,-4,2,-2,4,0,3,-6,-10,-6,-4,-6,-3,0,-7,-9,1,-4,-1,-3,-7,-6,-2,-4,-3,-1,-8,-23,-3,-13,-3,-6,0,-5,-7,-13,-4,-4,-5,-11,-2,0,-7,7,-8,4,-8,2,-8,-1,-4,2,-7,0,-4,-4,-6,0,-5,5,-5,0,-20,-5,-8,-4,-7,-7,-2,0,-1,4,-6,9,-10,11,1,2,-5,14,-25,44,-14,21,-12,11,1,4,-16,14,-13,7,-11,2,-6,-2,-4,-4,-3,0"]},
    handCup: {"box":[985,453,108,91],"o":["1080,493,-8,-4,-8,-1,-16,8,-1,-1,0,-7,8,-17,0,-8,-2,0,-2,6,1,3,-4,3,-8,14,-4,15,-6,9,-4,0,-2,-3,-6,1,-7,-8,-3,0,-4,8,-6,-1,-4,6,0,13,3,2,4,0,3,4,8,-1,5,1,3,3,3,-1,2,-5,1,2,3,1,11,-1,9,-4,12,-15,7,-5,0,-1,-6,0,-3,2,-3,-1,1,-3,5,-4,7,-2,4,2,3,5,3,2,0,-4,-3,-6,-10,-5,1,-1,7,1,10,7,3,0"]},
    shinB: {"box":[156,504,125,234],"o":["248,514,-13,0,-8,2,-3,3,-2,10,-2,21,2,4,-1,4,2,6,-3,3,0,4,4,6,-1,6,4,2,1,9,2,5,3,18,0,26,-4,3,1,3,-6,4,1,8,-6,3,0,6,1,1,8,-1,1,3,-4,7,-34,31,-13,6,-16,2,1,3,9,7,7,2,13,0,11,-4,14,-10,8,-4,7,-2,20,-1,4,-2,5,-6,1,-9,-6,-12,0,-7,7,-1,0,-4,-2,-4,3,-7,-3,-4,1,-5,-2,-3,3,-13,6,-15,6,-25,1,-28,-4,-16,-10,-22,-8,-10"],"h":["247,683,2,2,0,4,-2,3,-5,0,-3,-3,0,-2,1,-1,1,1,2,0"]},
    shinF: {"box":[718,508,142,227],"o":["748,516,-7,6,-4,6,-7,16,0,4,-5,16,0,15,3,15,5,14,19,39,-1,5,2,3,-2,3,0,5,2,3,-3,6,8,3,0,7,-5,10,1,12,9,7,5,1,16,-1,8,2,26,14,10,2,14,-2,7,-4,6,-7,-18,-2,-13,-6,-28,-22,-10,-11,-1,-3,1,-2,7,2,3,-1,0,-4,-2,-4,-6,-4,1,-6,-5,-4,0,-4,-4,-2,-3,-16,0,-11,-1,-1,2,-30,3,-2,-1,-8,2,-3,0,-8,-3,-2,1,-1,-1,-6,1,-9,-3,-11,0,-6,-5,-11,-10,-3"],"h":["772,682,3,3,0,3,-4,2,-1,2,-2,0,-3,-4,1,-1,3,0,2,-2,-1,-2"]},
    fan: {"box":[891,561,234,164],"o":["1031,570,-10,0,-7,4,-6,-4,-11,-2,-11,4,-4,5,-5,-2,-12,1,-6,3,-7,9,-7,-1,-8,3,-7,6,-3,6,0,3,-2,2,-3,0,-6,3,-5,5,-3,8,0,8,-4,2,-6,7,-1,6,2,7,-2,5,18,2,25,7,37,15,23,12,2,2,-9,3,-4,4,-1,5,1,5,4,4,9,2,6,-3,3,-6,-1,-8,-7,-6,3,-4,2,-1,4,1,1,7,2,0,55,-37,25,-15,25,-12,-6,-12,-6,-6,-2,-4,-14,-7,-1,-7,-5,-6,-8,-3,-8,0,-2,-4,-6,-6,-4,-2,-8,-1,-7,2,-5,-6"]},
  },
};
