// สัตว์ในท้องทุ่งและสวนสัตว์ — more articulated animals cut as หนังตะลุง
// leather: หมูเด้ง and her mother, farm stock, Ramakien's golden deer and
// friends. Built with the figure-coordinate toolkit of animals.js (see its
// header): every creature is authored in one frame facing right with the
// ground at the bottom, near-side limbs z > 0, far-side limbs z < 0.

import {
  INK, dye, line, gold, hole, dotLine, dotFill, slit, cut, dotFlower, prajamYam, krajangRow, poly, inset, resample, rng,
} from '../art/leather.js';
import {
  shape, path, tube, offset, move, rotPts, scalePts, scaleFigure, piece, makeRig, hide, trim, field, dots, spiral,
  lozenges, strap, slits, flowers, beastEye, kanok, feather, knot, rosette, swirlFlames, tuftPts, tuft, ink, scales, flame,
} from './animals.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------ local kit
// (animals.js keeps its leg builders private, so the same cut is repeated
// here, with feet for every foot type.)
function grad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [t, c] of stops) g.addColorStop(t, c);
  return g;
}
const hem = (ctx, pts, size, o = {}) => krajangRow(ctx, pts.slice().reverse(), size, { color: INK.gold, inner: INK.red, ...o });

function hoof(ctx, x, y, w, h, { cloven = true, color } = {}) {
  const pts = shape([[x - w * 0.34, y - h], [x + w * 0.24, y - h], [x + w * 0.44, y - h * 0.45], [x + w * 0.58, y - 0.2], [x + w * 0.1, y + 0.4], [x - w * 0.46, y], [x - w * 0.5, y - h * 0.45]], { t: 0.28, wob: 0.15 });
  hide(ctx, pts);
  if (color) dye(ctx, poly(inset(pts, 0.8)), color, 0.7);
  if (cloven) {
    cut(ctx, poly([[x + w * 0.62, y + 1], [x + w * 0.2, y + 1], [x + w * 0.3, y - h * 0.4]]));
    hide(ctx, shape([[x - w * 0.34, y - h * 1.35], [x - w * 0.55, y - h * 0.95], [x - w * 0.36, y - h * 0.8]], { t: 0.4, wob: 0 }));
  }
  gold(ctx, [[x - w * 0.36, y - h + 1], [x + w * 0.26, y - h + 1]], 0.9, { smoothIt: false });
  dots(ctx, [[x - w * 0.3, y - h * 0.45], [x + w * 0.3, y - h * 0.45]], { spacing: 2.6, r: 0.5, smoothIt: false });
}
function paw(ctx, x, y, w, h, { color } = {}) {
  const pts = shape([[x - w * 0.42, y - h * 1.1], [x + w * 0.05, y - h * 1.15], [x + w * 0.45, y - h * 0.7], [x + w * 0.62, y - h * 0.15], [x + w * 0.45, y], [x - w * 0.45, y], [x - w * 0.55, y - h * 0.5]], { t: 0.45, wob: 0.1 });
  hide(ctx, pts);
  if (color) dye(ctx, poly(inset(pts, 0.8)), color, 0.8);
  slit(ctx, [[x + w * 0.3, y + 0.5], [x + w * 0.22, y - h * 0.45]], 0.6, { smoothIt: false });
  slit(ctx, [[x + w * 0.02, y + 0.5], [x - w * 0.02, y - h * 0.4]], 0.6, { smoothIt: false });
}
function birdFoot(ctx, x, y, s, { color = INK.yellow, spur = false } = {}) {
  const toes = [
    [[x, y - s * 0.22], [x + s * 0.5, y - s * 0.08], [x + s * 1.0, y - s * 0.02]],
    [[x, y - s * 0.2], [x + s * 0.35, y - s * 0.02], [x + s * 0.72, y + s * 0.02]],
    [[x, y - s * 0.22], [x - s * 0.3, y - s * 0.08], [x - s * 0.52, y]],
  ];
  for (const t of toes) {
    const o = tube(t, [s * 0.13, s * 0.1, s * 0.06]);
    hide(ctx, o);
    if (color) dye(ctx, poly(o), color, 0.75);
    const e = t[2], d = t[1];
    const a = Math.atan2(e[1] - d[1], e[0] - d[0]);
    hide(ctx, tube([e, [e[0] + Math.cos(a + 0.5) * s * 0.16, e[1] + Math.sin(a + 0.5) * s * 0.16]], [s * 0.06, s * 0.02]));
  }
  if (spur) hide(ctx, tube([[x - s * 0.02, y - s * 0.7], [x - s * 0.3, y - s * 0.76], [x - s * 0.42, y - s * 0.92]], [s * 0.1, s * 0.06, s * 0.02]));
}
function webFoot(ctx, x, y, s, { color = INK.orange } = {}) {
  const pts = shape([[x - s * 0.15, y - s * 0.35], [x + s * 0.2, y - s * 0.3], [x + s * 1.0, y - s * 0.05], [x + s * 0.9, y + s * 0.05], [x + s * 0.6, y - 0.1], [x + s * 0.35, y + s * 0.06], [x, y], [x - s * 0.4, y - s * 0.02]], { t: 0.3, wob: 0.1 });
  hide(ctx, pts);
  dye(ctx, poly(inset(pts, 0.6)), color, 0.85);
  slit(ctx, [[x + s * 0.05, y - s * 0.22], [x + s * 0.7, y - s * 0.05]], 0.5, { smoothIt: false });
}
// Broad round foot with pale toenails (hippo, elephant calf).
function padFoot(ctx, x, y, w, h, { nails = 4, color = INK.cream } = {}) {
  const pts = shape([[x - w * 0.5, y - h], [x + w * 0.5, y - h], [x + w * 0.62, y - h * 0.35], [x + w * 0.56, y], [x - w * 0.54, y], [x - w * 0.6, y - h * 0.4]], { t: 0.3, wob: 0.2 });
  hide(ctx, pts);
  for (let k = 0; k < nails; k++) {
    const cx = x + w * (-0.12 + k * (0.62 / Math.max(1, nails - 1)));
    const p = new Path2D();
    p.ellipse(cx, y - h * 0.34, w * 0.07, h * 0.3, 0, 0, TAU);
    dye(ctx, p, color, 0.9);
    gold(ctx, p, 0.4);
  }
  dots(ctx, [[x - w * 0.46, y - h + 1.6], [x + w * 0.46, y - h + 1.6]], { spacing: 2.8, r: 0.55, smoothIt: false });
}
// Reptile foot: splayed toes ending in hooked claws.
function clawFoot(ctx, x, y, w, h, { color } = {}) {
  const base = shape([[x - w * 0.4, y - h * 1.2], [x + w * 0.2, y - h * 1.2], [x + w * 0.4, y - h * 0.5], [x + w * 0.2, y], [x - w * 0.4, y], [x - w * 0.5, y - h * 0.5]], { t: 0.4, wob: 0.1 });
  hide(ctx, base);
  if (color) dye(ctx, poly(inset(base, 0.7)), color, 0.6);
  for (let k = 0; k < 4; k++) {
    const a = -0.5 + k * 0.32;
    const sx = x + w * 0.1, sy = y - h * 0.4;
    const L = w * (0.55 + (k === 1 || k === 2 ? 0.15 : 0));
    const e = [sx + Math.cos(a) * L, sy + Math.sin(a) * L * 0.6 + h * 0.3];
    hide(ctx, tube([[sx, sy], e, [e[0] + w * 0.12, e[1] + h * 0.35]], [h * 0.34, h * 0.22, 0.4]));
  }
}
function drawFoot(ctx, foot, x, y, w, h, o = {}) {
  if (foot === 'cloven' || foot === 'hoof') return hoof(ctx, x, y, w, h, { cloven: foot === 'cloven', color: o.color });
  if (foot === 'paw') return paw(ctx, x, y, w, h, o);
  if (foot === 'bird') return birdFoot(ctx, x, y, w, o);
  if (foot === 'web') return webFoot(ctx, x, y, w, o);
  if (foot === 'pad') return padFoot(ctx, x, y, w, h, o);
  if (foot === 'claw') return clawFoot(ctx, x, y, w, h, o);
}
function legBands(ctx, spine, radii, bands, seed) {
  const sp = path(spine);
  for (const t of bands) {
    const i = Math.min(sp.length - 2, Math.floor((sp.length - 1) * t));
    const p = sp[i], q = sp[i + 1];
    const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2;
    const rr = lerp(radii[0], radii[radii.length - 1], t) * 0.95;
    const A = [p[0] - Math.cos(a) * rr, p[1] - Math.sin(a) * rr], B = [p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr];
    gold(ctx, [A, B], Math.max(0.8, rr * 0.2), { smoothIt: false });
    const dx = Math.cos(a - Math.PI / 2) * rr * 0.4, dy = Math.sin(a - Math.PI / 2) * rr * 0.4;
    dots(ctx, move([A, B], -dx, -dy), { spacing: 2.6, r: 0.5, smoothIt: false, seed: seed + 9 });
  }
}
// Two-piece leg (upper hung from the belly line, lower with the foot).
function leg(name, { up, upR, lo, loR, foot = 'cloven', fw = 16, fh = 8, far = false, color, pale, footColor, bands = [0.3], seed = 1, dotR = 0.6 }) {
  const uo = tube(up, upR);
  const lo2 = tube(lo, loR);
  const end = lo[lo.length - 1];
  const gy = end[1] + loR[loR.length - 1] * 0.75;
  const joint = [up[0][0], up[0][1] + upR[0] * 0.45];
  const upper = piece(name + '-u', [uo], (ctx) => {
    hide(ctx, uo);
    if (color) field(ctx, uo, color, { d: Math.min(3.2, upR[0] * 0.3), alpha: 0.8 });
    else if (pale) field(ctx, uo, pale, { d: 1.6, alpha: 0.8, edge: false });
    trim(ctx, uo, { d: Math.min(3.1, upR[0] * 0.4), r: dotR, seed, g: Math.min(1.5, upR[0] * 0.2) });
    const sp = path(up);
    if (upR[0] > 7) dots(ctx, sp.slice(Math.floor(sp.length * 0.3), -3), { spacing: 3.1, r: dotR * 0.9, seed: seed + 3, smoothIt: false });
    if (far) dye(ctx, poly(uo), '#000', 0.3);
    else knot(ctx, joint[0], joint[1], Math.min(2.6, upR[0] * 0.25));
  });
  const lower = piece(name + '-l', [lo2, [[end[0] - fw * 0.8, gy - fh - 2], [end[0] + fw * 1.1, gy + 3]]], (ctx) => {
    hide(ctx, lo2);
    if (pale) field(ctx, lo2, pale, { d: 1.2, alpha: 0.8, edge: false });
    drawFoot(ctx, foot, end[0], gy, fw, fh, { color: footColor });
    trim(ctx, lo2, { d: Math.min(2.6, loR[0] * 0.45), r: dotR * 0.9, g: Math.min(1.2, loR[0] * 0.2), seed: seed + 5 });
    legBands(ctx, lo, loR, bands, seed);
    if (far) dye(ctx, poly(lo2), '#000', 0.3);
    else knot(ctx, lo[0][0], lo[0][1], Math.min(2.4, loR[0] * 0.33));
  });
  return { upper, lower, knee: lo[0], joint };
}
// Single-piece leg (short legs, birds, reptiles).
function leg1(name, { spine, radii, foot = 'cloven', fw = 12, fh = 7, far = false, seed = 1, pale, footColor, dotR = 0.6, bands = [], spur = false, perf = true, nails }) {
  const o = tube(spine, radii);
  const end = spine[spine.length - 1];
  const gy = end[1] + radii[radii.length - 1] * 0.75;
  const joint = [spine[0][0], spine[0][1] + radii[0] * 0.4];
  const box = [[end[0] - fw * 1.1, gy - fh - 3], [end[0] + fw * 1.2, gy + 3]];
  const pc = piece(name, [o, box], (ctx) => {
    hide(ctx, o);
    if (pale) field(ctx, o, pale, { d: 1.6, alpha: 0.8, edge: false });
    drawFoot(ctx, foot, end[0], gy, fw, fh, { color: footColor, spur, nails });
    if (perf) trim(ctx, o, { d: Math.min(2.6, radii[0] * 0.45), g: Math.min(1.2, radii[0] * 0.2), r: dotR, seed, sp: 3 });
    legBands(ctx, spine, radii, bands, seed);
    if (far) dye(ctx, poly(o), '#000', 0.3);
    else knot(ctx, joint[0], joint[1], Math.min(2.2, radii[0] * 0.3));
  });
  return { pc, joint };
}
function legJoints(id, L, z, zl, { lim = [-0.7, 0.7], stiff = 0.6, parent = 'body' } = {}) {
  return {
    [id]: { pc: L.upper, z, parent, j: L.joint, lim, stiff },
    [id + '2']: { pc: L.lower, z: zl, parent: id, j: L.knee, lim: [-0.9, 0.9], stiff },
  };
}
const J1 = (L, z, o = {}) => ({ pc: L.pc, z, parent: 'body', j: L.joint, lim: [-0.7, 0.7], stiff: 0.6, ...o });
function quadGait(amp = 0.32, lower = 0.25, extra = []) {
  const g = [];
  for (const [id, ph] of [['legFR', 0], ['legBL', 0], ['legFL', 0.5], ['legBR', 0.5]]) {
    g.push({ part: id, amp, phase: ph });
    if (lower) g.push({ part: id + '2', amp: lower, phase: ph + 0.25 });
  }
  return [...g, ...extra];
}
// Big round "cute" eye: punched white, leather pupil, punched highlight.
function cuteEye(ctx, x, y, r, { pupil = 0.62, look = [0.18, 0.06], ring = true } = {}) {
  if (ring) { const p = new Path2D(); p.arc(x, y, r * 1.28, 0, TAU); gold(ctx, p, 0.6); }
  hole(ctx, x, y, r);
  ctx.save();
  ctx.fillStyle = INK.leather;
  ctx.beginPath(); ctx.arc(x + look[0] * r, y + look[1] * r, r * pupil, 0, TAU); ctx.fill();
  ctx.restore();
  hole(ctx, x + look[0] * r + r * 0.26, y + look[1] * r - r * 0.26, r * 0.2);
}
// Jasmine string (มาลัย) painted along a path, with a red rose knot.
function jasmine(ctx, pts, { w = 3, r = 0.55 } = {}) {
  const p = path(pts);
  line(ctx, p, INK.green, w, { smoothIt: false, alpha: 0.85 });
  for (const [x, y] of resample(p, w * 1.35)) dotFlower(ctx, x, y, r, 4, 2.1);
}
// Ctx transform: rotate by `a` about P, then scale by k about C.
function xform(ctx, { C = [0, 0], k = 1, P = [0, 0], a = 0 } = {}) {
  ctx.translate(C[0], C[1]); ctx.scale(k, k); ctx.translate(-C[0], -C[1]);
  ctx.translate(P[0], P[1]); ctx.rotate(a); ctx.translate(-P[0], -P[1]);
}
const xpts = (pts, { C = [0, 0], k = 1, P = [0, 0], a = 0 } = {}) => scalePts(rotPts(pts, P[0], P[1], a), C[0], C[1], k);
const xpt = (p, o) => xpts([p], o)[0];

// ================================================================ HIPPOS

// หมูเด้ง — the famous baby pygmy hippo of Khao Kheow Open Zoo: a round
// wet barrel with rosy cheeks, tiny flicking ears, a sassy brow and the
// cheeky open-mouthed chomp. mother = แม่โจนา, the grown-up version.
function hippo(baby = true) {
  const N = baby ? 'moo-deng' : 'hippo';
  scaleFigure(baby ? 1 : 1.65);
  const hk = baby ? 1.1 : 0.84; // grown-ups have relatively smaller heads
  const PINK = baby ? '#f4a7ac' : INK.pink;
  const ROSE = baby ? '#a8585e' : '#6e3a3a';
  const open = baby ? 0.24 : 0.1;
  const C = [122, 48];
  const bodyPts = shape([[14, 50], [22, 32], [44, 20], [76, 15], [104, 19], [122, 31], [132, 49], [132, 68], [124, 83], [104, 92], [76, 95], [48, 93], [26, 86], [12, 70]], { wob: 0.5, seed: 1401 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    dye(ctx, poly(inset(bodyPts, 2)), grad(ctx, 0, 22, 0, 94, [[0, 'rgba(217,115,127,0)'], [0.5, 'rgba(217,115,127,0.12)'], [1, `rgba(${baby ? '244,167,172' : '217,115,127'},${baby ? 0.9 : 0.5})`]]), 1);
    trim(ctx, bodyPts, { rows: 2, seed: 1402, d: 3, gap: 2.6 });
    const back = path([[22, 44], [46, 32], [76, 28], [104, 31], [122, 40]]);
    gold(ctx, back, 0.7, { smoothIt: false });
    dots(ctx, offset(back, 3.4), { spacing: 3, seed: 1403, smoothIt: false });
    // the wet shine of a freshly-bathed hippo
    for (const [x, y, l] of [[58, 36, 16], [84, 34, 12], [40, 44, 9]]) gold(ctx, [[x - l / 2, y + 2], [x, y - 1], [x + l / 2, y + 1.5]], 1.1);
    swirlFlames(ctx, 112, 62, 8, Math.PI - 0.4, { n: 3, len: 16, spin: -1, seed: 1404 });
    swirlFlames(ctx, 34, 60, 10, -0.3, { n: 3, len: 20, spin: 1, seed: 1405 });
    // belly folds
    for (let i = 0; i < 4; i++) dots(ctx, [[62 + i * 11, 56], [58 + i * 11, 70], [62 + i * 11, 84]], { spacing: 3, r: 0.55, seed: 1406 + i });
    gold(ctx, [[46, 86], [76, 89], [106, 84]], 0.5);
    if (baby) flowers(ctx, [[54, 38], [100, 36], [100, 52], [54, 54]], 4, { seed: 1410, inner: 0, minD: 12 });
    else {
      strap(ctx, [[70, 26], [74, 60], [70, 92]], 6, { color: INK.crimson, seed: 1411 });
      flowers(ctx, [[40, 38], [110, 36], [110, 56], [40, 56]], 7, { seed: 1412, inner: 0, minD: 13 });
    }
  });

  // head (drawn at baby proportions, shrunk about the neck for the mother)
  const headC = [[112, 44], [113, 28], [121, 17], [134, 11], [147, 12], [157, 18], [166, 23], [177, 24], [187, 29], [192, 38], [192, 50], [188, 59], [174, 62], [154, 62], [140, 64], [130, 70], [120, 66], [114, 56]];
  const headPts = shape(headC, { wob: 0.35, seed: 1420 });
  const farEar = shape([[134, 18], [133, 8], [139, 5], [144, 10], [143, 18]], { t: 0.45, wob: 0 });
  const HX = { C, k: hk };
  const head = piece(N + '-head', [xpts(headPts, HX), xpts(farEar, HX)], (ctx) => {
    xform(ctx, HX);
    hide(ctx, farEar);
    dye(ctx, poly(farEar), '#000', 0.3);
    hide(ctx, headPts);
    trim(ctx, headPts, { rows: 2, seed: 1421, d: 2.8, gap: 2.5, sp: 3 });
    // rosy cheek and muzzle
    const cheek = new Path2D(); cheek.ellipse(163, 48, 14, 9, -0.1, 0, TAU);
    dye(ctx, cheek, PINK, baby ? 0.8 : 0.45);
    gold(ctx, cheek, 0.5);
    dotFill(ctx, cheek, [148, 38, 178, 58], { pattern: 'flowers', spacing: 7, r: 0.5, seed: 1422 });
    // brow ridge and sassy brow
    gold(ctx, [[140, 22], [148, 19], [158, 22]], 1.2);
    ink(ctx, [[141, 18.5], [150, 17], [158, 20.5]], 1.4);
    cuteEye(ctx, 150, 26, baby ? 4.6 : 3.8, { look: [0.3, 0.1] });
    dotFlower(ctx, 134, 26, 0.7); dotFlower(ctx, 128, 38, 0.6);
    // nostril bump on top of the snout
    hole(ctx, 184, 29, 1.3); hole(ctx, 179, 27.6, 0.9);
    gold(ctx, [[174, 26], [182, 22.5], [190, 27]], 0.8);
    // lip line and neck wrinkles
    gold(ctx, [[142, 60], [160, 60.5], [184, 58]], 0.6);
    for (let i = 0; i < 3; i++) slit(ctx, [[122 + i * 5, 30 + i * 2], [120 + i * 5, 44], [123 + i * 5, 58 - i * 2]], 0.6);
    dots(ctx, [[130, 36], [138, 48], [134, 60]], { spacing: 2.8, r: 0.55, seed: 1423 });
    knot(ctx, 122, 48, 2.2);
  });
  const earPts = shape([[125, 20], [123, 10], [128, 4], [135, 6], [136, 14], [132, 21]], { t: 0.45, wob: 0.1 });
  const ear = piece(N + '-ear', [xpts(earPts, HX)], (ctx) => {
    xform(ctx, HX);
    hide(ctx, earPts);
    const inner = shape([[127, 16], [126, 10], [129, 7], [133, 9], [132, 15]], { t: 0.45, wob: 0 });
    dye(ctx, poly(inner), PINK, 0.85);
    knot(ctx, 130, 18, 1.5);
  });

  // lower jaw, drawn closed and hinged `open` at the mouth corner
  const P = [138, 64];
  const JX = { C, k: hk, P, a: open };
  const jawC = shape([[136, 62], [152, 62], [168, 62], [182, 61], [186, 64], [182, 72], [170, 79], [154, 82], [140, 79], [132, 72]], { t: 0.45, wob: 0.2, seed: 1430 });
  const jaw = piece(N + '-jaw', [xpts(jawC, JX)], (ctx) => {
    xform(ctx, JX);
    hide(ctx, jawC);
    dye(ctx, poly(inset(jawC, 1.6)), grad(ctx, 0, 62, 0, 82, [[0, PINK], [1, ROSE]]), baby ? 0.85 : 0.55);
    gold(ctx, poly(inset(jawC, 1.4)), 0.55);
    dots(ctx, inset(jawC, 3.4).slice(10, -6), { spacing: 2.8, r: 0.5, smoothIt: false, seed: 1431 });
    // little peg teeth
    for (const [x, h] of [[171, 3.4], [178, 4.2]]) {
      const t = shape([[x - 1.6, 63], [x - 1.2, 63 - h], [x + 0.6, 63 - h - 0.6], [x + 1.6, 63]], { t: 0.4, wob: 0 });
      hide(ctx, t); dye(ctx, poly(t), INK.cream, 0.95);
    }
    for (let k = 0; k < 3; k++) hole(ctx, 150 + k * 8, 72 + k * 1.2, 0.7);
    knot(ctx, P[0], P[1], 1.8);
  });
  // mouth: palate and tongue behind the lips, seen when the jaw opens
  const mouthPts = shape([[140, 57], [160, 57], [180, 57], [183, 64], [180, 70], [169, 76], [154, 78], [142, 76], [136, 70]], { t: 0.4, wob: 0 });
  const mouth = piece(N + '-mouth', [xpts(mouthPts, HX)], (ctx) => {
    xform(ctx, HX);
    hide(ctx, mouthPts);
    dye(ctx, poly(inset(mouthPts, 0.6)), INK.red, 0.9);
    const tongue = shape([[146, 72], [158, 66], [172, 65], [178, 70], [166, 75], [150, 76]], { t: 0.45, wob: 0 });
    dye(ctx, poly(tongue), PINK, 0.95);
    gold(ctx, poly(tongue), 0.45);
    line(ctx, [[152, 71], [170, 69]], INK.crimson, 0.6);
  });
  // a jasmine garland from her fans
  const malaiPts = shape([[118, 54], [124, 52], [132, 70], [134, 84], [130, 92], [124, 84], [118, 68]], { t: 0.4, wob: 0 });
  const malai = piece(N + '-malai', [xpts(malaiPts, HX), xpts([[120, 104], [134, 104]], HX)], (ctx) => {
    xform(ctx, HX);
    jasmineLoop(ctx);
  });
  function jasmineLoop(ctx) {
    const loop = [[119, 54], [124, 66], [130, 80], [128, 88]];
    hide(ctx, tube(loop, [3, 3, 3, 3]));
    line(ctx, path(loop), INK.cream, 4.4, { smoothIt: false, alpha: 0.9 });
    jasmine(ctx, loop, { w: 2.2, r: 0.7 });
    const rose = new Path2D(); rose.arc(128, 88, 4.2, 0, TAU);
    hide(ctx, [[124, 86], [132, 86], [132, 92], [124, 92]]);
    ctx.save(); ctx.fillStyle = INK.leather; ctx.fill(rose); ctx.restore();
    dye(ctx, rose, INK.red, 0.95);
    spiral(ctx, 128, 88, 3.4, { turns: 1.4, seed: 1440, w: 0.5, r: 0.4 });
    const tas = tuftPts(128, 91, 12, 5, Math.PI / 2, { teeth: 3, seed: 1441 });
    tuft(ctx, tas, 128, 91, 12, Math.PI / 2, { color: INK.gold });
  }

  const mk = (id, sp, r, far, seed) => leg1(N + id, { spine: sp, radii: r, foot: 'pad', fw: 15, fh: 6, far, seed, pale: baby ? '#7c4046' : '#5a3030', footColor: INK.cream, nails: 4 });
  const lFN = mk('-fn', [[108, 80], [109, 88], [110, 94]], [10.5, 10, 9.5], false, 1450);
  const lFF = mk('-ff', [[95, 80], [96, 88], [97, 94]], [10, 9.5, 9], true, 1452);
  const lBN = mk('-bn', [[32, 80], [31, 88], [32, 94]], [11, 10.5, 9.5], false, 1454);
  const lBF = mk('-bf', [[46, 80], [45, 88], [46, 94]], [10.5, 10, 9], true, 1456);
  const tailPts = tube([[16, 50], [8, 54], [4, 62]], [3.6, 2.6, 1.8]);
  const tP = tuftPts(4, 60, 11, 6, Math.PI / 2 + 0.3, { teeth: 3, seed: 1460 });
  const tail = piece(N + '-tail', [tailPts, tP], (ctx) => {
    hide(ctx, tailPts);
    tuft(ctx, tP, 4, 60, 11, Math.PI / 2 + 0.3);
  });
  const J = (p) => xpt(p, HX);
  return makeRig('animal', {
    body: { pc: body, z: 0, mass: baby ? 1.2 : 2.4 },
    head: { pc: head, z: 2, parent: 'body', j: [122, 48], lim: [-0.35, 0.3], stiff: 0.6 },
    ear: { pc: ear, z: 3, parent: 'head', j: J([130, 18]), lim: [-0.5, 0.5], stiff: 0.25 },
    mouth: { pc: mouth, z: 1.5, parent: 'head', j: J(P), lim: [-0.01, 0.01], stiff: 1 },
    jaw: { pc: jaw, z: 2.5, parent: 'head', j: J(P), lim: [-open - 0.02, 0.32], stiff: 0.55 },
    malai: { pc: malai, z: 2.6, parent: 'head', j: J([120, 54]), lim: null, stiff: 0.08 },
    tail: { pc: tail, z: -1, parent: 'body', j: [16, 50], lim: [-0.8, 0.8], stiff: 0.25 },
    legFR: J1(lFN, 4), legFL: J1(lFF, -3), legBR: J1(lBN, 4), legBL: J1(lBF, -3),
  }, {
    sound: baby ? 'animal-pig' : 'animal-buffalo',
    gait: quadGait(baby ? 0.42 : 0.32, 0, [{ part: 'ear', amp: 0.35, phase: 0 }, { part: 'jaw', amp: baby ? 0.14 : 0.06, phase: 0.2 }, { part: 'head', amp: 0.07, phase: 0.25 }, { part: 'tail', amp: 0.4, phase: 0.1 }]),
    limbs: { jaw: 'jaw', head: 'head' },
  });
}

// ================================================================ FARM

// แพะ — a Thai meat goat: piebald brown, swept-back horns, drooping ears,
// a beard and a flag of a tail.
function goat() {
  const N = 'pae';
  const bodyPts = shape([[24, 56], [40, 48], [80, 50], [110, 46], [124, 40], [133, 46], [136, 62], [130, 78], [114, 86], [80, 86], [52, 84], [34, 80], [22, 68]], { wob: 0.5, seed: 1501 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    field(ctx, bodyPts, INK.brown, { d: 2.4, alpha: 0.75, edge: false });
    const patch = shape([[60, 56], [84, 54], [100, 62], [94, 78], [70, 82], [56, 72]], { t: 0.5, wob: 1.5, seed: 1502 });
    dye(ctx, poly(patch), INK.cream, 0.85);
    gold(ctx, poly(patch), 0.5);
    trim(ctx, bodyPts, { rows: 2, seed: 1503, d: 3, gap: 2.5, sp: 3 });
    slits(ctx, offset(path([[30, 54], [60, 50], [90, 52], [118, 44], [130, 44]]), 2.6), { len: 3, gap: 2.6, ang: -2.6, seed: 1504 });
    swirlFlames(ctx, 120, 66, 8, Math.PI - 0.4, { n: 3, len: 16, spin: -1, seed: 1505 });
    swirlFlames(ctx, 40, 66, 9, -0.3, { n: 3, len: 18, spin: 1, seed: 1506 });
    for (let i = 0; i < 3; i++) dots(ctx, [[70 + i * 9, 60], [68 + i * 9, 70], [71 + i * 9, 80]], { spacing: 3, r: 0.5, seed: 1507 + i });
  });
  const headPts = shape([[114, 54], [118, 40], [128, 28], [136, 16], [146, 11], [156, 15], [164, 24], [171, 33], [170, 40], [161, 42], [150, 40], [142, 42], [134, 52], [128, 64], [118, 64]], { wob: 0.4, seed: 1510 });
  const hs = [[146, 13], [140, 3], [130, -4], [118, -3], [112, 3]];
  const hornN = tube(hs, [3.8, 3.4, 2.8, 1.8, 0.7]);
  const hornF = tube(move(hs, 5, 1), [3.4, 3, 2.4, 1.5, 0.6]);
  const beard = tuftPts(158, 40, 16, 7, Math.PI / 2 - 0.25, { teeth: 3, seed: 1511 });
  const head = piece(N + '-head', [headPts, hornN, hornF, beard], (ctx) => {
    hide(ctx, hornF); dye(ctx, poly(hornF), '#000', 0.3);
    tuft(ctx, beard, 158, 40, 16, Math.PI / 2 - 0.25);
    hide(ctx, headPts);
    field(ctx, headPts, INK.brown, { d: 2.2, alpha: 0.75, edge: false });
    const blaze = shape([[150, 14], [158, 18], [168, 32], [164, 38], [156, 26]], { t: 0.4, wob: 0.2 });
    dye(ctx, poly(blaze), INK.cream, 0.85);
    trim(ctx, headPts, { seed: 1512, d: 2.6, sp: 2.8, r: 0.55 });
    // goat eye: round with a bar pupil
    const e = new Path2D(); e.arc(150, 22, 3.6, 0, TAU); gold(ctx, e, 0.55);
    hole(ctx, 150, 22, 2.8);
    ctx.save(); ctx.fillStyle = INK.leather; ctx.fillRect(147.6, 21.1, 4.8, 1.8); ctx.restore();
    hole(ctx, 169, 34, 0.9);
    slit(ctx, [[169, 39], [163, 40]], 0.5, { smoothIt: false });
    strap(ctx, [[124, 32], [128, 48], [126, 62]], 4, { color: INK.red, seed: 1513 });
    const bell = new Path2D(); bell.arc(127, 66, 3, 0, TAU);
    dye(ctx, bell, INK.gold, 0.9); gold(ctx, bell, 0.45); hole(ctx, 127, 67, 0.7);
    hide(ctx, hornN);
    dye(ctx, poly(inset(hornN, 0.7)), INK.horn, 0.7);
    for (let i = 4; i < 30; i += 4) {
      const sp = path(hs), p = sp[i], q = sp[i + 1];
      const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2, r = 3.2 - i * 0.07;
      slit(ctx, [[p[0] - Math.cos(a) * r, p[1] - Math.sin(a) * r], [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r]], 0.55, { smoothIt: false });
    }
    knot(ctx, 122, 52, 2);
  });
  const earPts = shape([[142, 18], [132, 20], [120, 26], [118, 30], [128, 30], [142, 24]], { t: 0.45, wob: 0.2, seed: 1514 });
  const ear = piece(N + '-ear', [earPts], (ctx) => {
    hide(ctx, earPts);
    field(ctx, earPts, INK.pink, { d: 1.6, alpha: 0.7 });
    knot(ctx, 140, 21, 1.4);
  });
  const tP = tuftPts(25, 52, 17, 8, -2.35, { teeth: 3, seed: 1515 });
  const tail = piece(N + '-tail', [tP], (ctx) => { hide(ctx, tube([[27, 55], [24, 52]], [3, 2.6])); tuft(ctx, tP, 25, 52, 17, -2.35, { color: INK.brown }); });
  const mk = (id, up, upR, lo, far, seed) => leg(N + id, { up, upR, lo, loR: [3.4, 3, 3.2], foot: 'cloven', fw: 9, fh: 6, far, seed, bands: [0.25], pale: INK.brown });
  const lFN = mk('-fn', [[118, 78], [120, 96], [121, 110]], [8, 5.5, 4], [[121, 109], [121, 122], [121, 132]], false, 1520);
  const lFF = mk('-ff', [[108, 78], [109, 96], [110, 110]], [7.6, 5.2, 3.8], [[110, 109], [110, 122], [110, 132]], true, 1522);
  const lBN = mk('-bn', [[40, 76], [47, 94], [40, 110]], [11, 7, 4.2], [[40, 109], [42, 122], [43, 132]], false, 1524);
  const lBF = mk('-bf', [[52, 76], [59, 94], [52, 110]], [10.4, 6.6, 4], [[52, 109], [54, 122], [55, 132]], true, 1526);
  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 1.1 },
    head: { pc: head, z: 2, parent: 'body', j: [122, 52], lim: [-0.45, 0.4], stiff: 0.55 },
    ear: { pc: ear, z: 3, parent: 'head', j: [140, 21], lim: [-0.4, 0.4], stiff: 0.25 },
    tail: { pc: tail, z: -1, parent: 'body', j: [25, 52], lim: [-0.6, 0.6], stiff: 0.25 },
    ...legJoints('legFR', lFN, 4, 5), ...legJoints('legFL', lFF, -3, -2),
    ...legJoints('legBR', lBN, 4, 5), ...legJoints('legBL', lBF, -3, -2),
  }, { sound: 'animal-ox', gait: quadGait(0.36, 0.28, [{ part: 'tail', amp: 0.35, phase: 0 }, { part: 'ear', amp: 0.2, phase: 0.3 }]) });
}

// แกะ — a woolly sheep: scalloped cream fleece punched with curls,
// dark face and legs.
function sheep() {
  const N = 'kae';
  const r = rng(16);
  const fl = [];
  const n = 30;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = i % 2 ? 1.06 : 0.95;
    fl.push([76 + Math.cos(a) * 54 * k + (r() - 0.5), 58 + Math.sin(a) * 30 * k * (Math.sin(a) > 0 ? 1.05 : 1)]);
  }
  const bodyPts = shape(fl, { t: 0.45, steps: 4, wob: 0.3, seed: 1601 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    field(ctx, bodyPts, INK.cream, { d: 2.4, alpha: 0.86 });
    dye(ctx, poly(inset(bodyPts, 2.4)), grad(ctx, 0, 30, 0, 90, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(168,116,46,0.45)']]), 1);
    dotLine(ctx, inset(bodyPts, 4.6), { closed: true, spacing: 3, r: 0.6, seed: 1602, smoothIt: false });
    // fleece curls: little spirals and scallops
    const rr = rng(1603);
    for (let k = 0; k < 26; k++) {
      const a = rr() * TAU, d = Math.sqrt(rr());
      const x = 76 + Math.cos(a) * 42 * d, y = 58 + Math.sin(a) * 20 * d;
      spiral(ctx, x, y, 3.2 + rr() * 1.4, { turns: 1.4, seed: 1604 + k, dir: k % 2 ? 1 : -1, a0: rr() * TAU, w: 0.55, r: 0.45 });
    }
    gold(ctx, [[34, 74], [76, 84], [118, 74]], 0.5);
  });
  const headPts = shape([[118, 44], [124, 34], [134, 30], [144, 34], [152, 44], [158, 54], [157, 60], [150, 62], [140, 60], [130, 56], [122, 54]], { t: 0.45, wob: 0.3, seed: 1610 });
  const topknot = shape([[118, 42], [120, 30], [128, 24], [138, 26], [142, 34], [132, 36], [124, 44]], { t: 0.45, wob: 0.2, seed: 1611 });
  const head = piece(N + '-head', [headPts, topknot], (ctx) => {
    hide(ctx, headPts);
    trim(ctx, headPts, { seed: 1612, d: 2.4, sp: 2.8, r: 0.5, g: 1.1 });
    cuteEye(ctx, 142, 42, 2.4, { look: [0.25, 0.1] });
    ink(ctx, [[138, 38.5], [146, 38.5]], 0.9);
    hole(ctx, 156, 55, 0.8);
    slit(ctx, [[156, 59.5], [150, 60]], 0.5, { smoothIt: false });
    const muz = new Path2D(); muz.ellipse(152, 56, 5, 4, 0, 0, TAU); dye(ctx, muz, INK.pink, 0.5);
    hide(ctx, topknot);
    field(ctx, topknot, INK.cream, { d: 1.6, alpha: 0.86, edge: false });
    spiral(ctx, 129, 32, 3.2, { turns: 1.4, seed: 1613, w: 0.5, r: 0.45 });
    knot(ctx, 124, 48, 1.8);
  });
  const earPts = shape([[130, 38], [120, 40], [112, 46], [118, 48], [130, 44]], { t: 0.45, wob: 0.1 });
  const ear = piece(N + '-ear', [earPts], (ctx) => {
    hide(ctx, earPts); field(ctx, earPts, INK.pink, { d: 1.4, alpha: 0.7 }); knot(ctx, 128, 41, 1.3);
  });
  const tP = tuftPts(26, 54, 14, 9, 2.4, { teeth: 3, seed: 1614 });
  const tail = piece(N + '-tail', [tP], (ctx) => tuft(ctx, tP, 26, 54, 14, 2.4, { color: INK.cream }));
  const mk = (id, sp, far, seed) => leg1(N + id, { spine: sp, radii: [4.6, 3.6, 3.2], foot: 'cloven', fw: 8, fh: 5, far, seed, bands: [0.5] });
  const lFN = mk('-fn', [[110, 78], [111, 94], [112, 104]], false, 1620);
  const lFF = mk('-ff', [[100, 78], [101, 94], [102, 104]], true, 1622);
  const lBN = mk('-bn', [[42, 78], [41, 94], [42, 104]], false, 1624);
  const lBF = mk('-bf', [[54, 78], [53, 94], [54, 104]], true, 1626);
  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 1.1 },
    head: { pc: head, z: 2, parent: 'body', j: [124, 48], lim: [-0.4, 0.4], stiff: 0.55 },
    ear: { pc: ear, z: 3, parent: 'head', j: [128, 41], lim: [-0.4, 0.4], stiff: 0.25 },
    tail: { pc: tail, z: -1, parent: 'body', j: [26, 54], lim: [-0.5, 0.5], stiff: 0.3 },
    legFR: J1(lFN, 4), legFL: J1(lFF, -3), legBR: J1(lBN, 4), legBL: J1(lBF, -3),
  }, { sound: 'animal-ox', gait: quadGait(0.36, 0, [{ part: 'ear', amp: 0.2, phase: 0.2 }, { part: 'head', amp: 0.06, phase: 0.1 }]) });
}

// ลูกควาย — a buffalo calf: leggy, big-eared, horn buds, the pale
// chevron on the throat and a red cord with a little wooden bell.
function buffaloCalf() {
  const N = 'luk-kwai';
  const GREY = '#8c7c78';
  const bodyPts = shape([[30, 52], [48, 43], [90, 45], [122, 39], [140, 43], [150, 56], [150, 80], [140, 92], [110, 96], [80, 96], [52, 92], [34, 86], [24, 68]], { wob: 0.6, seed: 1701 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    field(ctx, bodyPts, GREY, { d: 2.4, alpha: 0.55, edge: false });
    trim(ctx, bodyPts, { rows: 2, seed: 1702, d: 3, gap: 2.6 });
    const back = path([[36, 54], [70, 50], [104, 50], [132, 46]]);
    gold(ctx, back, 0.6, { smoothIt: false });
    dots(ctx, offset(back, 3), { spacing: 3, seed: 1703, smoothIt: false });
    swirlFlames(ctx, 136, 74, 9, Math.PI - 0.3, { n: 3, len: 18, spin: -1, seed: 1704 });
    swirlFlames(ctx, 44, 70, 11, -0.3, { n: 3, len: 22, spin: 1, seed: 1705 });
    for (let i = 0; i < 4; i++) {
      const x = 72 + i * 11;
      dots(ctx, [[x + 5, 56], [x - 1, 74], [x + 3, 90]], { spacing: 3, seed: 1706 + i });
      gold(ctx, [[x + 8, 58], [x + 2, 74], [x + 6, 88]], 0.4);
    }
    flowers(ctx, [[60, 54], [120, 52], [120, 62], [60, 62]], 3, { seed: 1711, inner: 0, minD: 14 });
  });
  const headPts = shape([[132, 42], [144, 36], [158, 38], [170, 46], [178, 60], [184, 72], [184, 84], [176, 90], [164, 88], [154, 82], [146, 72], [136, 60]], { wob: 0.4, seed: 1712 });
  const hornN = tube([[160, 40], [157, 32], [152, 28]], [3.6, 2.6, 1]);
  const hornF = tube([[166, 42], [164, 34], [160, 30]], [3.2, 2.3, 0.9]);
  const head = piece(N + '-head', [headPts, hornN, hornF], (ctx) => {
    hide(ctx, hornF); dye(ctx, poly(hornF), '#000', 0.3);
    hide(ctx, headPts);
    field(ctx, headPts, GREY, { d: 2.2, alpha: 0.55, edge: false });
    trim(ctx, headPts, { rows: 2, seed: 1713, d: 2.8, gap: 2.4, sp: 3 });
    const muz = shape([[174, 70], [184, 74], [184, 84], [176, 89], [168, 84]], { t: 0.45, wob: 0 });
    dye(ctx, poly(muz), INK.pink, 0.55);
    gold(ctx, poly(muz), 0.45);
    hole(ctx, 181, 76, 1.1);
    slit(ctx, [[182, 86], [174, 87]], 0.6);
    cuteEye(ctx, 166, 56, 3.4, { look: [0.25, 0.05] });
    ink(ctx, [[160, 50], [166, 48.5], [172, 51]], 0.7);
    // the pale chevron (จุดขาวคอ) of Thai buffalo
    const chev = [[140, 66], [150, 80], [158, 86]];
    line(ctx, chev, INK.cream, 3.4, { alpha: 0.85 });
    dots(ctx, chev, { spacing: 2.6, r: 0.5 });
    hide(ctx, hornN); dye(ctx, poly(inset(hornN, 0.6)), INK.horn, 0.6);
    for (let i = 0; i < 3; i++) slits(ctx, [[140 + i * 5, 46 + i * 2], [142 + i * 4, 60], [146 + i * 3, 74]], { len: 2.6, gap: 3.4, ang: 2.5, seed: 1714 + i });
    knot(ctx, 142, 60, 2.2);
  });
  const earPts = shape([[158, 48], [146, 45], [134, 48], [128, 53], [136, 57], [150, 56], [158, 54]], { t: 0.45, wob: 0.2, seed: 1717 });
  const ear = piece(N + '-ear', [earPts], (ctx) => {
    hide(ctx, earPts); field(ctx, earPts, INK.pink, { d: 1.8, alpha: 0.7 });
    dots(ctx, inset(earPts, 3.2).slice(4, -4), { spacing: 2.6, r: 0.45, smoothIt: false });
    knot(ctx, 155, 51, 1.6);
  });
  const bellPts = shape([[150, 90], [160, 90], [161, 100], [158, 103], [152, 103], [149, 100]], { t: 0.3, wob: 0.1 });
  const bell = piece(N + '-bell', [bellPts, [[153, 80], [157, 106]]], (ctx) => {
    hide(ctx, tube([[155, 80], [155, 90]], [1.1, 1.1]));
    line(ctx, [[155, 80], [155, 90]], INK.red, 1.8);
    hide(ctx, bellPts);
    field(ctx, bellPts, INK.gold, { d: 1.4, alpha: 0.75 });
    hide(ctx, tube([[155, 101], [155, 106]], [1, 0.8]));
    dotFlower(ctx, 155, 96, 0.55);
    knot(ctx, 155, 81, 1.3);
  });
  const mk = (id, up, upR, lo, far, seed) => leg(N + id, { up, upR, lo, loR: [4.6, 3.9, 4.2], foot: 'cloven', fw: 12, fh: 7, far, seed, bands: [0.3], pale: GREY });
  const lFN = mk('-fn', [[138, 86], [140, 102], [141, 116]], [9, 6.5, 5], [[141, 115], [141, 130], [141, 141]], false, 1720);
  const lFF = mk('-ff', [[126, 86], [127, 102], [128, 116]], [8.6, 6.2, 4.8], [[128, 115], [128, 130], [128, 141]], true, 1722);
  const lBN = mk('-bn', [[44, 84], [51, 102], [44, 116]], [12, 8, 5], [[44, 115], [46, 130], [47, 141]], false, 1724);
  const lBF = mk('-bf', [[57, 84], [64, 102], [57, 116]], [11.4, 7.6, 4.8], [[57, 115], [59, 130], [60, 141]], true, 1726);
  const tailPts = tube([[28, 56], [20, 70], [18, 90]], [3, 2.4, 2]);
  const tP = tuftPts(18, 88, 16, 8, Math.PI / 2, { teeth: 3, seed: 1727 });
  const tail = piece(N + '-tail', [tailPts, tP], (ctx) => { hide(ctx, tailPts); tuft(ctx, tP, 18, 88, 16, Math.PI / 2); });
  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 1.4 },
    head: { pc: head, z: 2, parent: 'body', j: [142, 60], lim: [-0.4, 0.35], stiff: 0.6 },
    ear: { pc: ear, z: 3, parent: 'head', j: [155, 51], lim: [-0.4, 0.4], stiff: 0.25 },
    bell: { pc: bell, z: 3, parent: 'head', j: [155, 81], lim: null, stiff: 0.06 },
    tail: { pc: tail, z: -1, parent: 'body', j: [28, 56], lim: [-0.8, 0.8], stiff: 0.2 },
    ...legJoints('legFR', lFN, 4, 5), ...legJoints('legFL', lFF, -3, -2),
    ...legJoints('legBR', lBN, 4, 5), ...legJoints('legBL', lBF, -3, -2),
  }, { sound: 'animal-ox', gait: quadGait(0.36, 0.28, [{ part: 'tail', amp: 0.25, phase: 0.1 }, { part: 'ear', amp: 0.2, phase: 0.3 }]) });
}

// ================================================================ WILD

// จระเข้ — a crocodile: toothed snapping jaws, armoured scutes, a tail
// in three swinging segments and splayed clawed legs.
function crocodile() {
  const N = 'jorakhe';
  const OLIVE = '#4f6a2c';
  const deco = (ctx, o, sp, rad, seed) => {
    hide(ctx, o);
    field(ctx, o, OLIVE, { d: 1.8, alpha: 0.7, edge: false });
    dye(ctx, poly(inset(o, 1.8)), grad(ctx, 0, 20, 0, 56, [[0, 'rgba(0,0,0,0)'], [0.6, 'rgba(0,0,0,0)'], [1, 'rgba(230,187,63,0.7)']]), 1);
    trim(ctx, o, { d: 2.4, sp: 2.8, r: 0.55, seed, g: 1 });
    scales(ctx, o, { d: 4, spacing: 5, w: 0.5 });
    gold(ctx, offset(path(sp), -rad * 0.2), 0.5, { smoothIt: false });
    lozenges(ctx, offset(path(sp), rad * 0.35), { size: 1.6, gap: 5, seed });
  };
  // scute ridge along the top of a spine
  const ridge = (ctx, sp, rad, n0 = 0) => {
    const s = resample(path(sp), 7, false);
    s.forEach(([x, y, a], i) => {
      const r = typeof rad === 'function' ? rad(i / s.length) : rad;
      let nx = Math.sin(a), ny = -Math.cos(a);
      if (ny > 0) { nx = -nx; ny = -ny; }
      const bx = x + nx * r * 0.85, by = y + ny * r * 0.85;
      const tip = [bx + nx * 4.2 - Math.cos(a) * 1.5, by + ny * 4.2 - Math.sin(a) * 1.5];
      const p = [[bx - Math.cos(a) * 3, by - Math.sin(a) * 3], tip, [bx + Math.cos(a) * 3, by + Math.sin(a) * 3]];
      hide(ctx, p);
      if ((i + n0) % 2) hole(ctx, bx + nx * 1.4, by + ny * 1.4, 0.55);
    });
  };
  const bodySp = [[186, 36], [230, 34], [270, 33], [300, 34]];
  const bodyPts = shape([[186, 25], [220, 20], [260, 18], [290, 21], [306, 27], [308, 40], [298, 48], [260, 52], [220, 52], [188, 48], [180, 37]], { wob: 0.5, seed: 1801 });
  const body = piece(N + '-body', [bodyPts, offset(path(bodySp), 20)], (ctx) => {
    ridge(ctx, bodySp, 16);
    deco(ctx, bodyPts, bodySp, 16, 1802);
    gold(ctx, [[196, 46], [250, 50], [298, 44]], 0.6);
    dots(ctx, [[196, 30], [250, 26], [298, 30]], { spacing: 3, r: 0.6, seed: 1803 });
    knot(ctx, 190, 37, 2.2);
  });
  const tails = [
    { s: [[192, 37], [164, 39], [134, 41]], r: [13, 11.2, 9.6] },
    { s: [[136, 41], [104, 42], [72, 43]], r: [9.6, 8, 6.4] },
    { s: [[74, 43], [42, 43], [8, 40]], r: [6.4, 4.4, 1.4] },
  ];
  const tailPcs = tails.map((t, i) => {
    const o = tube(t.s, t.r, { capA: true });
    return piece(N + '-tail' + i, [o, offset(path(t.s), t.r[0] + 6)], (ctx) => {
      ridge(ctx, t.s, (u) => lerp(t.r[0], t.r[2], u), i);
      deco(ctx, o, t.s, t.r[1], 1810 + i);
      knot(ctx, t.s[0][0] - 2, t.s[0][1], Math.min(2, t.r[0] * 0.2));
    });
  });
  // head: skull and upper jaw with a row of teeth
  const headPts = shape([[294, 24], [310, 19], [322, 16], [332, 21], [352, 25], [372, 29], [385, 33], [388, 40], [378, 43], [350, 43], [326, 43], [306, 45], [296, 37]], { wob: 0.3, seed: 1820 });
  const teethUp = [];
  for (let x = 318; x < 382; x += 5.5) teethUp.push(x);
  const head = piece(N + '-head', [headPts, [[316, 48], [384, 48]]], (ctx) => {
    for (const x of teethUp) { const t = [[x - 1.6, 42], [x + 0.4, 47.5], [x + 1.6, 42]]; hide(ctx, t); dye(ctx, poly(t), INK.cream, 0.95); }
    hide(ctx, headPts);
    field(ctx, headPts, OLIVE, { d: 1.6, alpha: 0.7, edge: false });
    trim(ctx, headPts, { d: 2.4, sp: 2.8, r: 0.55, seed: 1821, g: 1 });
    dotFill(ctx, poly(inset(headPts, 5)), [300, 18, 386, 44], { pattern: 'diamond', spacing: 4.6, r: 0.6, seed: 1822 });
    // raised eye turret
    const tur = new Path2D(); tur.ellipse(322, 22, 7, 5, 0, 0, TAU);
    dye(ctx, tur, INK.yellow, 0.4);
    const e = new Path2D(); e.ellipse(323, 22, 3.6, 2.8, 0, 0, TAU);
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fill(e); ctx.restore();
    ctx.save(); ctx.fillStyle = INK.leather; ctx.fillRect(322.3, 19.4, 1.4, 5.2); ctx.restore();
    ink(ctx, [[314, 18], [322, 15.5], [330, 18]], 1);
    hole(ctx, 382, 33, 1); hole(ctx, 378, 32.4, 0.7);
    gold(ctx, [[300, 42], [340, 42.5], [384, 40]], 0.6);
    knot(ctx, 300, 36, 2.2);
  });
  const P = [308, 44];
  const jawPts = shape([[304, 42], [326, 43], [352, 43], [378, 43], [384, 45], [376, 50], [348, 53], [320, 53], [304, 50]], { t: 0.4, wob: 0.2, seed: 1823 });
  const jaw = piece(N + '-jaw', [jawPts, [[318, 38], [382, 38]]], (ctx) => {
    for (let x = 321; x < 378; x += 5.5) { const t = [[x - 1.5, 44], [x + 0.2, 38.8], [x + 1.5, 44]]; hide(ctx, t); dye(ctx, poly(t), INK.cream, 0.95); }
    hide(ctx, jawPts);
    field(ctx, jawPts, OLIVE, { d: 1.4, alpha: 0.6, edge: false });
    dye(ctx, poly(inset(jawPts, 1.4)), grad(ctx, 0, 44, 0, 54, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(230,187,63,0.8)']]), 1);
    dots(ctx, inset(jawPts, 2.6), { closed: true, spacing: 2.8, r: 0.5, smoothIt: false, seed: 1824 });
    knot(ctx, P[0], P[1], 1.8);
  });
  const mouthPts = shape([[306, 36], [340, 36], [380, 36], [380, 44], [360, 50], [330, 50], [308, 48]], { t: 0.3, wob: 0 });
  const mouth = piece(N + '-mouth', [mouthPts], (ctx) => {
    hide(ctx, mouthPts);
    dye(ctx, poly(inset(mouthPts, 0.6)), INK.pink, 0.85);
    line(ctx, [[312, 46], [350, 47]], INK.crimson, 1);
  });
  const mk = (id, sp, r, far, seed) => leg1(N + id, { spine: sp, radii: r, foot: 'claw', fw: 12, fh: 3.6, far, seed, pale: OLIVE });
  const lFN = mk('-fn', [[282, 46], [290, 54], [294, 60]], [6.4, 5, 4.2], false, 1830);
  const lFF = mk('-ff', [[270, 46], [276, 54], [279, 60]], [6, 4.6, 4], true, 1832);
  const lBN = mk('-bn', [[212, 46], [205, 54], [206, 60]], [8, 5.6, 4.4], false, 1834);
  const lBF = mk('-bf', [[226, 46], [220, 54], [221, 60]], [7.4, 5.2, 4.2], true, 1836);
  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 2 },
    head: { pc: head, z: 2, parent: 'body', j: [300, 36], lim: [-0.25, 0.25], stiff: 0.7 },
    mouth: { pc: mouth, z: 1.5, parent: 'head', j: P, lim: [-0.01, 0.01], stiff: 1 },
    jaw: { pc: jaw, z: 2.5, parent: 'head', j: P, lim: [-0.03, 0.55], stiff: 0.6 },
    tail: { pc: tailPcs[0], z: -1, parent: 'body', j: [190, 37], lim: [-0.35, 0.35], stiff: 0.45 },
    tail2: { pc: tailPcs[1], z: -1.1, parent: 'tail', j: [135, 41], lim: [-0.45, 0.45], stiff: 0.35 },
    tail3: { pc: tailPcs[2], z: -1.2, parent: 'tail2', j: [73, 43], lim: [-0.6, 0.6], stiff: 0.25 },
    legFR: J1(lFN, 4, { lim: [-0.6, 0.6] }), legFL: J1(lFF, -3, { lim: [-0.6, 0.6] }),
    legBR: J1(lBN, 4, { lim: [-0.6, 0.6] }), legBL: J1(lBF, -3, { lim: [-0.6, 0.6] }),
  }, {
    sound: 'hiss',
    gait: quadGait(0.3, 0, [{ part: 'tail', amp: 0.1, phase: 0 }, { part: 'tail2', amp: 0.16, phase: 0.15 }, { part: 'tail3', amp: 0.24, phase: 0.3 }, { part: 'jaw', amp: 0.08, phase: 0.5 }]),
    limbs: { jaw: 'jaw', head: 'head' },
  });
}

// เสือ — a Thai-mural tiger: vermilion-gold coat, flame-tongued black
// stripes, a white ruff, fanged jaw and a curling three-piece tail.
function tiger() {
  const N = 'suea';
  const COAT = INK.orange;
  const stripe = (ctx, x, y, a, len, w, seed) => {
    const pts = flameStripe(x, y, a, len, w);
    ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = INK.leather; ctx.globalAlpha = 0.95; ctx.fill(poly(pts)); ctx.restore();
    gold(ctx, poly(pts), 0.45);
    dots(ctx, path([[x + Math.cos(a) * 3, y + Math.sin(a) * 3], [x + Math.cos(a) * len * 0.6, y + Math.sin(a) * len * 0.6]]), { spacing: 2.8, r: 0.5, seed, smoothIt: false });
  };
  const HX = { C: [206, 62], k: 1.3 };
  const J = (p) => xpt(p, HX);
  const bodyPts = shape([[36, 58], [60, 46], [110, 50], [160, 46], [190, 40], [210, 48], [217, 70], [212, 98], [196, 113], [160, 115], [110, 113], [80, 109], [52, 110], [34, 96], [26, 72]], { wob: 0.6, seed: 1901 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    field(ctx, bodyPts, COAT, { d: 2.6, alpha: 0.88, edge: false });
    dye(ctx, poly(inset(bodyPts, 2.6)), grad(ctx, 0, 50, 0, 112, [[0, 'rgba(134,22,16,0.55)'], [0.5, 'rgba(0,0,0,0)'], [0.82, 'rgba(244,230,194,0)'], [1, 'rgba(244,230,194,0.9)']]), 1);
    for (let i = 0; i < 9; i++) {
      const x = 52 + i * 17;
      stripe(ctx, x, 50 - Math.sin(i * 0.4) * 2, Math.PI / 2 + 0.12 * Math.sin(i), 28 + (i % 2) * 8, 7, 1902 + i);
    }
    trim(ctx, bodyPts, { rows: 2, seed: 1912, d: 3 });
    swirlFlames(ctx, 196, 84, 10, Math.PI - 0.3, { n: 3, len: 22, spin: -1, seed: 1913, fill: INK.cream });
    swirlFlames(ctx, 50, 82, 12, -0.3, { n: 3, len: 26, spin: 1, seed: 1914, fill: INK.cream });
  });
  const headPts = shape([[194, 54], [202, 40], [214, 31], [228, 27], [244, 29], [256, 37], [266, 48], [271, 58], [268, 66], [256, 70], [242, 72], [228, 76], [214, 74], [202, 66]], { wob: 0.4, seed: 1920 });
  const ruff = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    ruff.push([lerp(204, 232, t) + Math.sin(t * Math.PI) * -6, lerp(56, 82, t) + (i % 2 ? 4 : 0)]);
  }
  const ruffPts = [...ruff, [238, 72], [222, 64], [210, 52]];
  const head = piece(N + '-head', [xpts(headPts, HX), xpts(ruffPts, HX)], (ctx) => {
    xform(ctx, HX);
    hide(ctx, ruffPts);
    dye(ctx, poly(inset(ruffPts, 0.8)), INK.cream, 0.9);
    slits(ctx, [[208, 58], [218, 70], [230, 78]], { len: 4, gap: 2.4, ang: -2.2, seed: 1921 });
    hide(ctx, headPts);
    field(ctx, headPts, COAT, { d: 2.2, alpha: 0.88, edge: false });
    const cheek = shape([[226, 50], [244, 48], [260, 54], [262, 64], [246, 70], [228, 70]], { t: 0.5, wob: 0.3 });
    dye(ctx, poly(cheek), INK.cream, 0.88);
    gold(ctx, poly(cheek), 0.5);
    for (const [x, y, a, l] of [[216, 34, 1.9, 14], [226, 30, 1.7, 12], [236, 30, 1.5, 10], [212, 48, 0.4, 12]]) stripe(ctx, x, y, a, l, 5, 1922 + x);
    trim(ctx, headPts, { seed: 1926, d: 2.6, sp: 2.8, r: 0.55 });
    // almond eye with a green-gold iris
    const e = new Path2D();
    e.moveTo(242, 42); e.quadraticCurveTo(248, 36, 256, 41); e.quadraticCurveTo(249, 45, 242, 42);
    dye(ctx, e, '#b8d24a', 1);
    gold(ctx, e, 0.6);
    ctx.save(); ctx.fillStyle = INK.leather; ctx.beginPath(); ctx.ellipse(249.5, 41, 1.2, 2.4, 0, 0, TAU); ctx.fill(); ctx.restore();
    hole(ctx, 251, 40.2, 0.45);
    ink(ctx, [[238, 38], [248, 33.5], [258, 37]], 1.2);
    const nose = shape([[262, 48], [270, 50], [271, 56], [266, 57]], { t: 0.4, wob: 0 });
    dye(ctx, nose, INK.pink, 0.9);
    for (const dy of [-1, 1.2, 3.4]) gold(ctx, [[256, 60 + dy], [274, 58 + dy * 2.2]], 0.35, { smoothIt: false });
    for (let k = 0; k < 4; k++) hole(ctx, 254 + (k % 2) * 3, 58 + Math.floor(k / 2) * 3, 0.5);
    knot(ctx, 206, 62, 2.4);
  });
  const earPts = shape([[212, 34], [210, 22], [218, 16], [226, 20], [226, 30]], { t: 0.45, wob: 0.1 });
  const ear = piece(N + '-ear', [xpts(earPts, HX)], (ctx) => {
    xform(ctx, HX);
    hide(ctx, earPts);
    const inner = shape([[214, 30], [214, 22], [219, 19], [223, 23], [222, 29]], { t: 0.45, wob: 0 });
    dye(ctx, poly(inner), INK.pink, 0.7);
    gold(ctx, poly(inner), 0.4);
    knot(ctx, 219, 31, 1.5);
  });
  const P = [232, 72];
  const jawPts = shape([[228, 72], [244, 71], [258, 68], [266, 69], [263, 76], [248, 82], [234, 80]], { t: 0.4, wob: 0.2, seed: 1927 });
  const jaw = piece(N + '-jaw', [xpts(jawPts, HX), xpts([[254, 64], [262, 64]], HX)], (ctx) => {
    xform(ctx, HX);
    for (const x of [256, 261]) { const t = [[x - 1.6, 70], [x, 64.5], [x + 1.4, 70]]; hide(ctx, t); dye(ctx, poly(t), INK.cream, 0.95); }
    hide(ctx, jawPts);
    field(ctx, jawPts, INK.cream, { d: 1.2, alpha: 0.85, edge: false });
    slits(ctx, [[236, 79], [250, 80], [260, 76]], { len: 2.6, gap: 2.4, ang: -2, seed: 1928 });
    knot(ctx, P[0], P[1], 1.8);
  });
  const mouthPts = shape([[232, 66], [250, 64], [266, 63], [266, 70], [252, 76], [236, 76]], { t: 0.3, wob: 0 });
  const mouth = piece(N + '-mouth', [xpts(mouthPts, HX), xpts([[250, 60], [262, 60]], HX)], (ctx) => {
    xform(ctx, HX);
    hide(ctx, mouthPts);
    dye(ctx, poly(inset(mouthPts, 0.6)), INK.red, 0.9);
    for (const x of [252, 262]) { const t = [[x - 1.6, 66], [x, 72.5], [x + 1.6, 66]]; hide(ctx, t); dye(ctx, poly(t), INK.cream, 0.95); }
  });
  const mk = (id, up, upR, lo, far, seed) => leg(N + id, { up, upR, lo, loR: [6.8, 6.2, 6.2], foot: 'paw', fw: 15, fh: 6, far, seed, bands: [], color: COAT, footColor: INK.cream });
  const lFN = mk('-fn', [[196, 100], [198, 118], [199, 130]], [14, 10, 7.6], [[199, 129], [200, 137], [201, 142]], false, 1930);
  const lFF = mk('-ff', [[182, 100], [183, 118], [184, 130]], [13.4, 9.6, 7.2], [[184, 129], [185, 137], [186, 142]], true, 1932);
  const lBN = mk('-bn', [[54, 96], [66, 116], [54, 130]], [19, 12, 7.4], [[54, 129], [57, 137], [60, 142]], false, 1934);
  const lBF = mk('-bf', [[70, 96], [82, 116], [70, 130]], [18, 11.4, 7], [[70, 129], [73, 137], [76, 142]], true, 1936);
  const tails = [
    { s: [[30, 62], [16, 76], [8, 94]], r: [5.4, 4.8, 4.4] },
    { s: [[8, 93], [4, 112], [10, 126]], r: [4.4, 4.2, 4] },
    { s: [[10, 125], [20, 134], [30, 128]], r: [4, 3.8, 3.4] },
  ];
  const tailPcs = tails.map((t, i) => {
    const o = tube(t.s, t.r);
    return piece(N + '-tail' + i, [o], (ctx) => {
      hide(ctx, o);
      dye(ctx, poly(inset(o, 1)), COAT, 0.85);
      const sp = path(t.s);
      for (let k = 4; k < sp.length - 2; k += 7) {
        const p = sp[k], q = sp[k + 1], a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2, rr = t.r[1];
        line(ctx, [[p[0] - Math.cos(a) * rr, p[1] - Math.sin(a) * rr], [p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr]], INK.leather, 2.6, { smoothIt: false });
      }
      dots(ctx, sp, { spacing: 2.8, r: 0.5, smoothIt: false, seed: 1940 + i });
      if (i) knot(ctx, t.s[0][0], t.s[0][1], 1.5);
    });
  });
  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 2 },
    head: { pc: head, z: 2, parent: 'body', j: [206, 62], lim: [-0.4, 0.35], stiff: 0.6 },
    ear: { pc: ear, z: 3, parent: 'head', j: J([219, 31]), lim: [-0.3, 0.3], stiff: 0.35 },
    mouth: { pc: mouth, z: 1.5, parent: 'head', j: J(P), lim: [-0.01, 0.01], stiff: 1 },
    jaw: { pc: jaw, z: 2.5, parent: 'head', j: J(P), lim: [-0.03, 0.6], stiff: 0.6 },
    tail: { pc: tailPcs[0], z: -1, parent: 'body', j: [30, 62], lim: [-0.7, 0.7], stiff: 0.25 },
    tail2: { pc: tailPcs[1], z: -1, parent: 'tail', j: [8, 93], lim: [-0.8, 0.8], stiff: 0.2 },
    tail3: { pc: tailPcs[2], z: -1, parent: 'tail2', j: [10, 125], lim: [-0.9, 0.9], stiff: 0.15 },
    ...legJoints('legFR', lFN, 4, 5), ...legJoints('legFL', lFF, -3, -2),
    ...legJoints('legBR', lBN, 4, 5), ...legJoints('legBL', lBF, -3, -2),
  }, {
    sound: 'roar',
    gait: quadGait(0.36, 0.28, [{ part: 'tail', amp: 0.12, phase: 0 }, { part: 'tail2', amp: 0.18, phase: 0.15 }, { part: 'tail3', amp: 0.25, phase: 0.3 }]),
    limbs: { jaw: 'jaw', head: 'head' },
  });
}
// Tapering, slightly S-curved stripe (a flame tongue) as points.
function flameStripe(x, y, a, len, w) {
  const c = Math.cos(a), s = Math.sin(a);
  const A = [], B = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const bend = Math.sin(u * Math.PI * 1.3) * len * 0.12;
    const hw = w * 0.5 * Math.pow(1 - u, 0.8);
    const cx = x + c * u * len - s * bend, cy = y + s * u * len + c * bend;
    A.push([cx - s * hw, cy + c * hw]);
    B.push([cx + s * hw, cy - c * hw]);
  }
  return [...A, ...B.reverse()];
}

// กวางทอง — มารีศ transformed into the golden deer of the Ramakien:
// gilded hide set with gem rosettes, branching antlers, lace saddle.
function goldenDeer() {
  const N = 'kwang-thong';
  scaleFigure(1.05);
  const GOLD = INK.gold;
  const bodyPts = shape([[40, 72], [60, 63], [100, 66], [138, 62], [154, 58], [164, 66], [166, 82], [158, 96], [136, 104], [100, 104], [70, 100], [48, 96], [34, 86]], { wob: 0.5, seed: 2001 });
  const saddle = shape([[84, 66], [120, 64], [126, 78], [124, 96], [100, 100], [80, 96], [78, 80]], { t: 0.4, wob: 0.3, seed: 2002 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    field(ctx, bodyPts, GOLD, { d: 2.2, alpha: 0.85, edge: false });
    dye(ctx, poly(inset(bodyPts, 2.2)), grad(ctx, 0, 60, 0, 106, [[0, 'rgba(210,69,31,0.35)'], [0.6, 'rgba(0,0,0,0)'], [1, 'rgba(244,230,194,0.7)']]), 1);
    trim(ctx, bodyPts, { rows: 2, seed: 2003, d: 3, gap: 2.5, sp: 3 });
    swirlFlames(ctx, 152, 84, 8, Math.PI - 0.3, { n: 3, len: 18, spin: -1, seed: 2004, fill: INK.vermilion });
    swirlFlames(ctx, 50, 82, 10, -0.3, { n: 3, len: 22, spin: 1, seed: 2005, fill: INK.vermilion });
    dye(ctx, poly(saddle), INK.red, 0.92);
    gold(ctx, poly(inset(saddle, 1.2)), 0.8);
    const s2 = inset(saddle, 5);
    dye(ctx, poly(s2), INK.green, 0.8);
    gold(ctx, poly(s2), 0.5);
    dotLine(ctx, inset(saddle, 3), { closed: true, spacing: 2.8, r: 0.55, seed: 2006, smoothIt: false });
    prajamYam(ctx, 102, 82, 8, { color: INK.red, petal: INK.gold });
    hem(ctx, [[80, 96], [100, 100], [124, 96]], 5.5);
    // gem spots
    for (const [x, y] of [[62, 74], [140, 74], [56, 90], [140, 92], [70, 86], [132, 84]]) rosette(ctx, x, y, 3.4, { petals: 6, color: INK.cream, inner: INK.red });
  });
  const neckPts = shape([[144, 66], [150, 48], [158, 32], [166, 20], [176, 16], [184, 22], [182, 36], [174, 50], [168, 68], [162, 82], [148, 80]], { wob: 0.4, seed: 2010 });
  const headPts = shape([[166, 18], [172, 8], [180, 5], [190, 8], [200, 15], [210, 22], [213, 28], [207, 33], [196, 33], [186, 30], [177, 27], [169, 25]], { t: 0.45, wob: 0.2, seed: 2011 });
  // antlers: main beams with tines
  const beamN = [[181, 7], [176, -8], [166, -24], [156, -36]];
  const beamF = [[186, 6], [192, -8], [198, -22], [208, -32]];
  const tines = [
    [[178, -2], [184, -14], [184, -26]], [[171, -16], [174, -30], [170, -44]], [[162, -30], [160, -42], [152, -50]], [[178, -4], [170, -6], [164, -2]],
  ];
  const tinesF = [
    [[190, -3], [196, -14], [202, -20]], [[195, -16], [192, -30], [194, -42]], [[202, -27], [210, -38], [218, -40]],
  ];
  const head = piece(N + '-head', [neckPts, headPts, tube(beamN, [2, 2, 2, 2]), tube(beamF, [2, 2, 2, 2]), ...tines.map((t) => tube(t, [2, 2, 2])), ...tinesF.map((t) => tube(t, [2, 2, 2]))], (ctx) => {
    const antler = (sp, far) => {
      const o = tube(sp, [2.4, 2.1, 1.6, 0.8].slice(0, sp.length));
      hide(ctx, o);
      dye(ctx, poly(inset(o, 0.5)), far ? INK.horn : INK.yellow, 0.75);
      if (far) dye(ctx, poly(o), '#000', 0.3);
    };
    antler(beamF, true);
    for (const t of tinesF) antler(t, true);
    antler(beamN, false);
    for (const t of tines) antler(t, false);
    for (const [x, y] of [[178, -8], [170, -24]]) hole(ctx, x, y, 0.6);
    hide(ctx, neckPts);
    field(ctx, neckPts, GOLD, { d: 2, alpha: 0.85, edge: false });
    dye(ctx, poly(inset(neckPts, 2)), grad(ctx, 150, 0, 184, 0, [[0, 'rgba(244,230,194,0)'], [1, 'rgba(244,230,194,0.6)']]), 1);
    trim(ctx, neckPts, { seed: 2012, d: 2.6, sp: 2.8, r: 0.55 });
    for (let i = 0; i < 3; i++) dots(ctx, [[158 + i * 4, 36 + i * 6], [156 + i * 4, 54], [156 + i * 3, 72]], { spacing: 2.8, r: 0.5, seed: 2013 + i });
    hide(ctx, headPts);
    field(ctx, headPts, GOLD, { d: 1.8, alpha: 0.85, edge: false });
    trim(ctx, headPts, { seed: 2016, d: 2.2, sp: 2.6, r: 0.5, g: 1 });
    beastEye(ctx, 187, 16, 3, { angle: 0.3 });
    ink(ctx, [[182, 12], [188, 10], [194, 13]], 0.7);
    hole(ctx, 210, 26, 0.8);
    slit(ctx, [[209, 31], [202, 31.5]], 0.5, { smoothIt: false });
    // jewelled collar with a pendant
    krajangRow(ctx, [[176, 36], [168, 52], [162, 66]].reverse(), 5, { color: INK.gold, inner: INK.red });
    strap(ctx, [[180, 32], [172, 50], [164, 70]], 4.2, { color: INK.red, seed: 2017 });
    rosette(ctx, 176, 44, 3.4, { petals: 6 });
    knot(ctx, 152, 72, 2.2);
  });
  const earPts = shape([[178, 12], [166, 5], [158, 6], [164, 12], [176, 16]], { t: 0.45, wob: 0.1 });
  const ear = piece(N + '-ear', [earPts], (ctx) => {
    hide(ctx, earPts); field(ctx, earPts, INK.vermilion, { d: 1.2, alpha: 0.8 }); knot(ctx, 176, 13, 1.3);
  });
  const tP = tuftPts(38, 72, 16, 8, -2.5, { teeth: 3, seed: 2018 });
  const tail = piece(N + '-tail', [tP], (ctx) => tuft(ctx, tP, 38, 72, 16, -2.5, { color: INK.cream }));
  const mk = (id, up, upR, lo, far, seed) => leg(N + id, { up, upR, lo, loR: [3.4, 2.9, 3.2], foot: 'cloven', fw: 8, fh: 6, far, seed, bands: [0.3], color: GOLD, footColor: INK.crimson });
  const lFN = mk('-fn', [[150, 96], [152, 118], [153, 138]], [8.4, 5.6, 4], [[153, 137], [153, 156], [153, 170]], false, 2020);
  const lFF = mk('-ff', [[140, 96], [141, 118], [142, 138]], [8, 5.2, 3.8], [[142, 137], [142, 156], [142, 170]], true, 2022);
  const lBN = mk('-bn', [[50, 92], [60, 116], [50, 140]], [13, 7.4, 4.2], [[50, 139], [52, 156], [54, 170]], false, 2024);
  const lBF = mk('-bf', [[62, 92], [72, 116], [62, 140]], [12.4, 7, 4], [[62, 139], [64, 156], [66, 170]], true, 2026);
  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 1.3 },
    head: { pc: head, z: 2, parent: 'body', j: [152, 72], lim: [-0.4, 0.3], stiff: 0.6 },
    ear: { pc: ear, z: 3, parent: 'head', j: [176, 13], lim: [-0.4, 0.4], stiff: 0.3 },
    tail: { pc: tail, z: -1, parent: 'body', j: [38, 72], lim: [-0.5, 0.5], stiff: 0.3 },
    ...legJoints('legFR', lFN, 4, 5), ...legJoints('legFL', lFF, -3, -2),
    ...legJoints('legBR', lBN, 4, 5), ...legJoints('legBL', lBF, -3, -2),
  }, { sound: 'sparkle', gait: quadGait(0.38, 0.3, [{ part: 'tail', amp: 0.3, phase: 0 }, { part: 'head', amp: 0.06, phase: 0.2 }]) });
}

// ช้างน้อย — an elephant calf: big domed head, floppy lace ear, a short
// curling trunk, a red saddle-cloth and a forehead pompom.
function babyElephant() {
  const N = 'chang-noi';
  const bodyPts = shape([[24, 72], [36, 54], [70, 42], [110, 40], [140, 46], [156, 60], [158, 88], [152, 112], [136, 124], [100, 128], [64, 126], [40, 118], [26, 100]], { wob: 0.8, seed: 2101 });
  const cloth = shape([[70, 46], [120, 44], [128, 70], [126, 100], [98, 106], [70, 100], [64, 70]], { t: 0.4, wob: 0.4, seed: 2102 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    field(ctx, bodyPts, '#8c7c78', { d: 2.6, alpha: 0.35, edge: false });
    trim(ctx, bodyPts, { rows: 2, seed: 2103, d: 3.2, gap: 2.8 });
    swirlFlames(ctx, 144, 98, 11, Math.PI + 0.1, { n: 3, len: 24, spin: -1, seed: 2104 });
    swirlFlames(ctx, 44, 94, 12, -0.1, { n: 3, len: 26, spin: 1, seed: 2105 });
    dye(ctx, poly(cloth), INK.red, 0.92);
    gold(ctx, poly(inset(cloth, 1.3)), 0.8);
    const c2 = inset(cloth, 6);
    dye(ctx, poly(c2), INK.green, 0.75);
    gold(ctx, poly(c2), 0.55);
    dotLine(ctx, inset(cloth, 3.6), { closed: true, spacing: 3, r: 0.6, seed: 2106, smoothIt: false });
    dotFill(ctx, poly(inset(c2, 3)), [64, 44, 130, 106], { pattern: 'flowers', spacing: 9, r: 0.62, seed: 2107 });
    prajamYam(ctx, 97, 74, 10, { color: INK.red, petal: INK.gold });
    hem(ctx, [[70, 100], [98, 106], [126, 100]], 6.5);
    for (let i = 0; i < 3; i++) dots(ctx, [[36 + i * 8, 70], [32 + i * 8, 90], [38 + i * 8, 110]], { spacing: 3, r: 0.6, seed: 2108 + i });
  });
  const headPts = shape([[140, 60], [148, 42], [164, 30], [186, 26], [206, 30], [220, 44], [228, 62], [229, 82], [222, 96], [208, 102], [194, 100], [180, 98], [166, 92], [152, 80]], { wob: 0.6, seed: 2110 });
  const earPts = shape([[186, 46], [168, 38], [150, 46], [142, 70], [146, 98], [158, 116], [174, 114], [184, 94], [190, 68]], { t: 0.45, wob: 0.6, seed: 2111 });
  const head = piece(N + '-head', [headPts], (ctx) => {
    hide(ctx, headPts);
    field(ctx, headPts, '#8c7c78', { d: 2.4, alpha: 0.35, edge: false });
    trim(ctx, headPts, { rows: 2, seed: 2112, d: 3, gap: 2.6 });
    spiral(ctx, 200, 44, 8, { seed: 2113 });
    cuteEye(ctx, 208, 64, 3.6, { look: [0.3, 0.1] });
    for (let k = 0; k < 3; k++) { const a = -2.3 + k * 0.35; ink(ctx, [[208 + Math.cos(a) * 4.6, 64 + Math.sin(a) * 4.6], [208 + Math.cos(a) * 7.4, 64 + Math.sin(a) * 7.4]], 0.7); }
    const pom = new Path2D(); pom.arc(186, 30, 5, 0, TAU);
    dye(ctx, pom, INK.red, 0.95); gold(ctx, pom, 0.5); dotFlower(ctx, 186, 30, 0.7);
    band(ctx, [[168, 36], [186, 30], [206, 32]], 3.2);
    slit(ctx, [[214, 98], [206, 96], [200, 99]], 0.8);
    cut(ctx, poly(inset(earPts, 9)));
    knot(ctx, 152, 78, 3);
  });
  const ear = piece(N + '-ear', [earPts], (ctx) => {
    hide(ctx, earPts);
    trim(ctx, earPts, { rows: 2, seed: 2114, d: 3, r: 0.65 });
    const inner = inset(earPts, 9);
    dye(ctx, poly(inner), INK.pink, 0.8);
    gold(ctx, poly(inner), 0.6);
    dotFill(ctx, poly(inset(earPts, 12)), [140, 36, 192, 118], { pattern: 'flowers', spacing: 8, r: 0.62, seed: 2115 });
    knot(ctx, 182, 50, 2.4);
  });
  const tr = [
    { s: [[218, 88], [226, 104], [229, 116]], r: [12, 10, 8.6] },
    { s: [[229, 114], [231, 126], [231, 136]], r: [8.6, 7.6, 6.6] },
    { s: [[231, 134], [231, 143], [236, 149], [243, 147], [244, 141]], r: [6.6, 5.6, 4.6, 3.8, 3] },
  ];
  const trunk = tr.map((t, i) => {
    const o = tube(t.s, t.r);
    return piece(N + '-trunk' + i, [o], (ctx) => {
      hide(ctx, o);
      field(ctx, o, '#8c7c78', { d: 1.4, alpha: 0.35, edge: false });
      trim(ctx, o, { d: 2.4, r: 0.55, seed: 2120 + i, g: 1 });
      const sp = path(t.s);
      for (let k = 3; k < sp.length - 3; k += 3) {
        const p = sp[k], q = sp[k + 1], a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2;
        const rr = lerp(t.r[0], t.r[t.r.length - 1], k / sp.length) * 0.6;
        slit(ctx, [[p[0] - Math.cos(a) * rr, p[1] - Math.sin(a) * rr], [p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr]], 0.6, { smoothIt: false });
      }
      knot(ctx, t.s[0][0], t.s[0][1] + 3, 2.2);
    });
  });
  const mk = (id, sp, r, far, seed) => leg1(N + id, { spine: sp, radii: r, foot: 'pad', fw: 30, fh: 9, far, seed, footColor: INK.cream, nails: 3, bands: [0.4], pale: '#4a403e' });
  const lFN = mk('-fn', [[140, 110], [141, 128], [142, 140]], [17, 15, 14], false, 2130);
  const lFF = mk('-ff', [[124, 110], [125, 128], [126, 140]], [16, 14, 13.4], true, 2132);
  const lBN = mk('-bn', [[46, 110], [50, 128], [48, 140]], [18, 15, 14], false, 2134);
  const lBF = mk('-bf', [[62, 110], [66, 128], [64, 140]], [17, 14.4, 13.4], true, 2136);
  const tailPts = tube([[26, 74], [18, 92], [16, 108]], [3.2, 2.4, 2]);
  const tP = tuftPts(16, 106, 14, 7, Math.PI / 2, { teeth: 3, seed: 2137 });
  const tail = piece(N + '-tail', [tailPts, tP], (ctx) => { hide(ctx, tailPts); tuft(ctx, tP, 16, 106, 14, Math.PI / 2, { color: INK.red }); });
  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 2.2 },
    head: { pc: head, z: 2, parent: 'body', j: [152, 78], lim: [-0.3, 0.3], stiff: 0.65 },
    ear: { pc: ear, z: 3, parent: 'head', j: [182, 50], lim: [-0.25, 0.25], stiff: 0.25 },
    trunk1: { pc: trunk[0], z: 3, parent: 'head', j: [218, 91], lim: [-0.4, 0.5], stiff: 0.45 },
    trunk2: { pc: trunk[1], z: 3, parent: 'trunk1', j: [229, 117], lim: [-0.6, 0.6], stiff: 0.35 },
    trunk3: { pc: trunk[2], z: 3, parent: 'trunk2', j: [231, 137], lim: [-0.8, 0.8], stiff: 0.25 },
    tail: { pc: tail, z: -1, parent: 'body', j: [26, 74], lim: [-0.8, 0.8], stiff: 0.2 },
    legFR: J1(lFN, 4, { lim: [-0.5, 0.5] }), legFL: J1(lFF, -3, { lim: [-0.5, 0.5] }),
    legBR: J1(lBN, 4, { lim: [-0.5, 0.5] }), legBL: J1(lBF, -3, { lim: [-0.5, 0.5] }),
  }, {
    sound: 'animal-elephant',
    gait: quadGait(0.3, 0, [{ part: 'trunk1', amp: 0.1, phase: 0 }, { part: 'trunk2', amp: 0.16, phase: 0.1 }, { part: 'trunk3', amp: 0.24, phase: 0.2 }, { part: 'ear', amp: 0.14, phase: 0.25 }, { part: 'tail', amp: 0.3, phase: 0.4 }]),
  });
}
function band(ctx, pts, w) { line(ctx, pts, INK.gold, w, { alpha: 0.9 }); dots(ctx, pts, { spacing: w, r: w * 0.18 }); }

// ================================================================ BIRDS

// นกยูง — the green peafowl (นกยูงไทย): scaled jade neck, upright crest
// and a raised fan of eyed train feathers.
function peacock() {
  const N = 'nok-yung';
  const bodyPts = shape([[44, 72], [60, 60], [82, 55], [95, 50], [99, 38], [101, 24], [105, 13], [113, 9], [118, 15], [116, 30], [113, 46], [116, 60], [110, 76], [95, 88], [74, 92], [56, 88]], { wob: 0.35, seed: 2201 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    field(ctx, bodyPts, INK.jade, { d: 1.8, alpha: 0.85, edge: false });
    dye(ctx, poly(inset(bodyPts, 1.8)), grad(ctx, 0, 10, 0, 92, [[0, 'rgba(43,81,153,0.55)'], [0.45, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]), 1);
    trim(ctx, bodyPts, { seed: 2202, d: 2.6, sp: 2.8, r: 0.55 });
    dotFill(ctx, poly(inset(bodyPts, 4)), [60, 8, 120, 92], { pattern: 'scales', spacing: 4, r: 0.5 });
    const wing = shape([[56, 66], [84, 60], [100, 66], [96, 80], [76, 88], [54, 82]], { t: 0.45, wob: 0.2, seed: 2203 });
    dye(ctx, poly(wing), INK.orange, 0.7);
    gold(ctx, poly(wing), 0.6);
    for (let k = 0; k < 6; k++) slit(ctx, [[92 - k * 6, 66 + k * 0.6], [84 - k * 6, 78], [72 - k * 4, 86]], 0.55);
    dotLine(ctx, [[60, 70], [80, 64], [96, 68]], { spacing: 2.6, r: 0.55 });
    knot(ctx, 110, 14, 1.6);
  });
  const headPts = shape([[105, 13], [106, 5], [112, 0], [119, 1], [124, 5], [133, 9], [125, 12], [119, 15], [110, 17]], { t: 0.4, wob: 0.1, seed: 2204 });
  const crest = [];
  for (let k = 0; k < 6; k++) crest.push([[111 + k * 0.8, 2], [109 + k * 1.4, -7], [106 + k * 2.2, -15 - (k % 2) * 2]]);
  const head = piece(N + '-head', [headPts, ...crest.map((c) => move(c, 0, -3)), ...crest], (ctx) => {
    for (const c of crest) {
      hide(ctx, tube(c, [0.7, 0.55, 0.4]));
      const t = c[2];
      const fp = Array.from({ length: 12 }, (_, i) => [t[0] + Math.cos(i / 12 * TAU) * 1.7, t[1] - 1.4 + Math.sin(i / 12 * TAU) * 2.7]);
      hide(ctx, fp);
      dye(ctx, poly(fp), INK.teal, 0.9);
      hole(ctx, t[0], t[1] - 1.4, 0.5);
    }
    hide(ctx, headPts);
    field(ctx, headPts, INK.jade, { d: 1, alpha: 0.85, edge: false });
    const face = shape([[113, 4], [120, 3], [123, 7], [118, 11], [113, 10]], { t: 0.45, wob: 0 });
    dye(ctx, poly(face), INK.yellow, 0.7);
    dye(ctx, poly([[124, 5], [133, 9], [124, 11]]), INK.horn, 0.8);
    beastEye(ctx, 117, 7, 1.7, { style: 'round' });
  });
  // the fan: a lace-cut backing and radiating eyed feathers
  const root = [52, 70];
  const R = 112;
  const fanA0 = -Math.PI * 1.02, fanA1 = -Math.PI * 0.2;
  const fanPts = [root];
  for (let i = 0; i <= 24; i++) {
    const a = lerp(fanA0, fanA1, i / 24);
    fanPts.push([root[0] + Math.cos(a) * R * 0.84, root[1] + Math.sin(a) * R * 0.84]);
  }
  const feathers = [];
  const nF = 23;
  for (let i = 0; i < nF; i++) {
    const a = lerp(fanA0 + 0.02, fanA1 - 0.02, i / (nF - 1));
    const L = R * (0.9 + 0.1 * Math.sin((i / (nF - 1)) * Math.PI));
    feathers.push({ a, L, tip: [root[0] + Math.cos(a) * L, root[1] + Math.sin(a) * L] });
  }
  const fan = piece(N + '-fan', [fanPts, ...feathers.map((f) => [[f.tip[0] - 9, f.tip[1] - 9], [f.tip[0] + 9, f.tip[1] + 9]])], (ctx) => {
    hide(ctx, fanPts);
    field(ctx, fanPts, INK.green, { d: 2, alpha: 0.75 });
    dotFill(ctx, poly(inset(fanPts, 5)), [root[0] - R, root[1] - R, root[0] + R, root[1]], { pattern: 'flowers', spacing: 7, r: 0.55, seed: 2205 });
    for (const [k, f] of feathers.entries()) {
      const sp = [root, [root[0] + Math.cos(f.a) * f.L * 0.5, root[1] + Math.sin(f.a) * f.L * 0.5], [root[0] + Math.cos(f.a) * (f.L - 6), root[1] + Math.sin(f.a) * (f.L - 6)]];
      feather(ctx, sp, 5.4, { color: k % 2 ? INK.jade : INK.teal, alpha: 0.8, seed: 2206 + k, barbs: true });
      // eye-spot (ocellus)
      const [x, y] = f.tip;
      const o = [];
      for (let i = 0; i < 16; i++) { const t = (i / 16) * TAU; o.push([x + Math.cos(t) * 6.6 * (1 - 0.18 * Math.cos(t - f.a)), y + Math.sin(t) * 6.6 * (1 - 0.18 * Math.cos(t - f.a))]); }
      hide(ctx, o);
      const ring = (r, c, al = 0.95) => { const p = new Path2D(); p.ellipse(x, y, r, r * 1.05, f.a, 0, TAU); dye(ctx, p, c, al); return p; };
      ring(5.6, INK.gold);
      gold(ctx, ring(4.2, INK.teal), 0.4);
      ring(2.5, INK.indigo);
      hole(ctx, x - Math.cos(f.a) * 0.6, y - Math.sin(f.a) * 0.6, 1.1);
      dotLine(ctx, inset(o, 0.9), { closed: true, spacing: 2.2, r: 0.4, seed: 2230 + k, smoothIt: false });
    }
    rosette(ctx, root[0], root[1] - 3, 5, { petals: 8 });
  });
  const mk = (id, dx, far, seed) => leg1(N + id, { spine: [[84 + dx, 86], [86 + dx, 100], [88 + dx, 112]], radii: [3.8, 2.6, 2.2], foot: 'bird', fw: 13, fh: 4, far, seed, footColor: INK.horn, perf: false, pale: INK.horn, spur: true });
  const legR = mk('-r', 0, false, 2240);
  const legL = mk('-l', -9, true, 2242);
  return makeRig('animal', {
    body: { pc: body, z: 0 },
    head: { pc: head, z: 2, parent: 'body', j: [110, 14], lim: [-0.4, 0.4], stiff: 0.55 },
    fan: { pc: fan, z: -1, parent: 'body', j: root, lim: [-0.3, 0.3], stiff: 0.45 },
    legR: { pc: legR.pc, z: 2, parent: 'body', j: legR.joint, lim: [-0.7, 0.7], stiff: 0.6 },
    legL: { pc: legL.pc, z: -2, parent: 'body', j: legL.joint, lim: [-0.7, 0.7], stiff: 0.6 },
  }, {
    sound: 'animal-cat',
    gait: [{ part: 'legR', amp: 0.42, phase: 0 }, { part: 'legL', amp: 0.42, phase: 0.5 }, { part: 'head', amp: 0.14, phase: 0 }, { part: 'fan', amp: 0.08, phase: 0.25 }],
  });
}

// ไก่แจ้ — a bantam cockerel: tiny, puffed, with a big serrated comb and
// an upright fan of black sickles.
function bantam() {
  const N = 'kai-jae';
  const bodyPts = shape([[26, 42], [36, 34], [48, 32], [54, 24], [58, 14], [64, 9], [70, 12], [72, 24], [75, 36], [74, 48], [66, 58], [54, 63], [40, 62], [28, 54]], { wob: 0.3, seed: 2301 });
  const hackles = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 6, rt = [64 - 12 * t, 12 + 22 * t], a = 2.1 + t * 0.4, L = 12 - 3 * t;
    hackles.push([rt, [rt[0] + Math.cos(a - 0.1) * L * 0.55, rt[1] + Math.sin(a - 0.1) * L * 0.55], [rt[0] + Math.cos(a) * L, rt[1] + Math.sin(a) * L]]);
  }
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    field(ctx, bodyPts, INK.yellow, { d: 1.6, alpha: 0.8, edge: false });
    trim(ctx, bodyPts, { seed: 2302, d: 2.4, sp: 2.6, r: 0.5 });
    dotFill(ctx, poly(inset(bodyPts, 4)), [30, 20, 76, 62], { pattern: 'scales', spacing: 3.8, r: 0.5 });
    const wing = shape([[36, 44], [56, 40], [66, 48], [60, 56], [44, 58], [32, 52]], { t: 0.45, wob: 0.2 });
    dye(ctx, poly(wing), INK.orange, 0.8);
    gold(ctx, poly(wing), 0.5);
    for (let k = 0; k < 5; k++) slit(ctx, [[60 - k * 5, 45], [54 - k * 5, 52], [44 - k * 3, 56]], 0.5);
    for (const h of hackles) feather(ctx, h, 3.4, { color: INK.orange, alpha: 0.85, seed: 2303, barbs: false });
    knot(ctx, 65, 12, 1.3);
  });
  const headPts = shape([[58, 14], [58, 7], [62, 3], [68, 2], [72, 4], [77, 7], [72, 9], [71, 13], [68, 16], [62, 16]], { t: 0.4, wob: 0.1, seed: 2304 });
  const comb = shape([[58, 4], [58, -2], [61, 0], [62, -6], [65, -1], [67, -7], [69, -1], [72, -5], [72, 1], [75, 0], [72, 4]], { t: 0.2, wob: 0 });
  const head = piece(N + '-head', [headPts, comb, [[66, 22], [72, 22]]], (ctx) => {
    hide(ctx, comb); dye(ctx, poly(inset(comb, 0.4)), INK.red, 0.95);
    hide(ctx, headPts);
    field(ctx, headPts, INK.orange, { d: 0.8, alpha: 0.8, edge: false });
    const watP = Array.from({ length: 14 }, (_, i) => [70 + Math.cos(i / 14 * TAU) * 2.4, 17.5 + Math.sin(i / 14 * TAU) * 3.8]);
    hide(ctx, watP);
    dye(ctx, poly(watP), INK.red, 0.95);
    dye(ctx, poly([[72, 5], [78, 7.5], [72, 9]]), INK.yellow, 0.85);
    beastEye(ctx, 67, 7, 1.6, { style: 'round' });
    const lobe = new Path2D(); lobe.ellipse(63, 11, 1.8, 2.2, 0, 0, TAU); dye(ctx, lobe, INK.cream, 0.9);
  });
  const sick = [
    { s: [[30, 40], [22, 24], [20, 8], [26, -6]], w: 4.2 },
    { s: [[30, 41], [18, 28], [12, 12], [14, -2]], w: 4 },
    { s: [[30, 42], [16, 34], [6, 22], [4, 8]], w: 3.8 },
    { s: [[31, 40], [28, 22], [32, 6], [40, -4]], w: 3.6 },
    { s: [[30, 44], [18, 44], [8, 38]], w: 3.4 },
  ];
  const outl = sick.map((f) => f.s).flat();
  const tail = piece(N + '-tail', [move(outl, -5, -5), move(outl, 5, 5)], (ctx) => {
    for (let i = sick.length - 1; i >= 0; i--) {
      const o = feather(ctx, sick[i].s, sick[i].w, { color: i % 2 ? INK.green : INK.teal, alpha: 0.6, seed: 2310 + i });
      gold(ctx, poly(inset(o, 0.4)), 0.35);
    }
    knot(ctx, 30, 42, 1.4);
  });
  const mk = (id, dx, far, seed) => leg1(N + id, { spine: [[52 + dx, 58], [53 + dx, 64], [54 + dx, 69]], radii: [3.4, 2, 1.8], foot: 'bird', fw: 8, fh: 3, far, seed, footColor: INK.yellow, perf: false, pale: INK.yellow, spur: true });
  const legR = mk('-r', 0, false, 2320);
  const legL = mk('-l', -6, true, 2322);
  return makeRig('animal', {
    body: { pc: body, z: 0 },
    head: { pc: head, z: 2, parent: 'body', j: [63, 13], lim: [-0.4, 0.4], stiff: 0.55 },
    tail: { pc: tail, z: -1, parent: 'body', j: [30, 42], lim: [-0.4, 0.4], stiff: 0.35 },
    legR: { pc: legR.pc, z: 2, parent: 'body', j: legR.joint, lim: [-0.7, 0.7], stiff: 0.6 },
    legL: { pc: legL.pc, z: -2, parent: 'body', j: legL.joint, lim: [-0.7, 0.7], stiff: 0.6 },
  }, {
    sound: 'animal-rooster',
    gait: [{ part: 'legR', amp: 0.5, phase: 0 }, { part: 'legL', amp: 0.5, phase: 0.5 }, { part: 'head', amp: 0.18, phase: 0 }, { part: 'tail', amp: 0.1, phase: 0.25 }],
  });
}

// ห่าน — a white Chinese goose with the knob on its bill; the long neck
// bobs as it waddles.
function goose() {
  const N = 'han';
  const bodyPts = shape([[6, 50], [18, 50], [30, 44], [54, 40], [76, 41], [90, 47], [97, 60], [92, 73], [74, 82], [46, 82], [26, 75], [16, 64]], { wob: 0.35, seed: 2401 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    field(ctx, bodyPts, INK.cream, { d: 1.8, alpha: 0.86, edge: false });
    trim(ctx, bodyPts, { seed: 2402, d: 2.6, sp: 2.8, r: 0.55 });
    const wing = shape([[22, 54], [50, 48], [78, 52], [84, 62], [66, 70], [36, 68], [16, 58]], { t: 0.45, wob: 0.2, seed: 2403 });
    dye(ctx, poly(wing), '#c9b690', 0.8);
    gold(ctx, poly(wing), 0.6);
    for (let k = 0; k < 7; k++) slit(ctx, [[78 - k * 7, 54], [70 - k * 7, 62], [58 - k * 6, 68]], 0.55);
    dotLine(ctx, [[24, 56], [50, 51], [76, 55]], { spacing: 2.6, r: 0.55 });
    dotFill(ctx, poly(inset(bodyPts, 5)), [40, 60, 96, 82], { pattern: 'scales', spacing: 5, r: 0.5 });
  });
  const neckSp = [[82, 56], [91, 40], [94, 26], [98, 12]];
  const neckPts = tube(neckSp, [8, 6, 5, 5]);
  const headPts = shape([[93, 12], [95, 4], [102, 0], [110, 2], [114, 6], [124, 10], [127, 14], [117, 16], [106, 17], [97, 18]], { t: 0.45, wob: 0.1, seed: 2404 });
  const head = piece(N + '-neck', [neckPts, headPts], (ctx) => {
    hide(ctx, neckPts);
    field(ctx, neckPts, INK.cream, { d: 1.6, alpha: 0.86, edge: false });
    dots(ctx, offset(path(neckSp), -2), { spacing: 2.6, r: 0.5, smoothIt: false });
    gold(ctx, offset(path(neckSp), 2), 0.5, { smoothIt: false });
    hide(ctx, headPts);
    field(ctx, headPts, INK.cream, { d: 1, alpha: 0.86, edge: false });
    const bill = shape([[110, 3], [115, -1], [118, 4], [126, 10], [127, 14], [116, 15], [111, 10]], { t: 0.4, wob: 0 });
    hide(ctx, bill);
    dye(ctx, poly(bill), INK.orange, 0.92);
    slit(ctx, [[114, 12.5], [125, 12.5]], 0.45, { smoothIt: false });
    hole(ctx, 118, 8, 0.6);
    cuteEye(ctx, 104, 7, 1.9, { look: [0.3, 0], ring: false });
    gold(ctx, [[98, 12], [106, 13]], 0.4);
    knot(ctx, 88, 52, 2);
  });
  const mk = (id, dx, far) => leg1(N + id, { spine: [[60 + dx, 78], [61 + dx, 86], [62 + dx, 91]], radii: [3.6, 2.4, 2.1], foot: 'web', fw: 13, fh: 3, far, footColor: INK.orange, perf: false, pale: INK.orange });
  const legR = mk('-r', 0, false);
  const legL = mk('-l', -10, true);
  return makeRig('animal', {
    body: { pc: body, z: 0 },
    neck: { pc: head, z: 2, parent: 'body', j: [88, 52], lim: [-0.4, 0.5], stiff: 0.5 },
    legR: { pc: legR.pc, z: 2, parent: 'body', j: legR.joint, lim: [-0.7, 0.7], stiff: 0.6 },
    legL: { pc: legL.pc, z: -2, parent: 'body', j: legL.joint, lim: [-0.7, 0.7], stiff: 0.6 },
  }, {
    sound: 'animal-duck',
    gait: [{ part: 'legR', amp: 0.5, phase: 0 }, { part: 'legL', amp: 0.5, phase: 0.5 }, { part: 'neck', amp: 0.14, phase: 0.25 }],
  });
}

// นกเงือก — a great hornbill: black and cream plumage, the huge yellow
// bill with its casque, and a white tail with a black band.
function hornbill() {
  const N = 'nok-ngueak';
  const bodyPts = shape([[30, 52], [44, 40], [68, 35], [86, 37], [95, 46], [96, 60], [86, 72], [66, 78], [46, 76], [32, 66]], { wob: 0.4, seed: 2501 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    trim(ctx, bodyPts, { seed: 2502, d: 2.6, sp: 2.8, r: 0.55 });
    const wing = shape([[38, 50], [66, 42], [88, 48], [84, 62], [60, 70], [36, 64]], { t: 0.45, wob: 0.2, seed: 2503 });
    gold(ctx, poly(wing), 0.6);
    const bar = shape([[44, 52], [74, 46], [80, 52], [50, 58]], { t: 0.4, wob: 0 });
    dye(ctx, poly(bar), INK.cream, 0.88);
    gold(ctx, poly(bar), 0.4);
    for (let k = 0; k < 7; k++) slit(ctx, [[84 - k * 7, 52], [76 - k * 7, 60], [64 - k * 5, 66]], 0.55);
    dotFill(ctx, poly(inset(bodyPts, 5)), [40, 60, 96, 78], { pattern: 'scales', spacing: 4.4, r: 0.5 });
    const thigh = shape([[64, 66], [80, 64], [82, 74], [66, 76]], { t: 0.4, wob: 0 });
    dye(ctx, poly(thigh), INK.cream, 0.7);
  });
  const neckPts = shape([[82, 44], [86, 30], [92, 18], [102, 12], [112, 14], [114, 26], [106, 36], [100, 48], [92, 54]], { wob: 0.3, seed: 2504 });
  const headPts = shape([[98, 18], [102, 8], [110, 4], [118, 6], [120, 14], [116, 22], [106, 24]], { t: 0.45, wob: 0.1 });
  const billPts = shape([[114, 10], [126, 12], [140, 18], [152, 28], [158, 38], [150, 34], [138, 28], [124, 24], [116, 20]], { t: 0.45, wob: 0.1, seed: 2505 });
  const casque = shape([[108, 4], [116, -2], [132, 0], [146, 8], [152, 16], [140, 14], [126, 10], [114, 10]], { t: 0.4, wob: 0.1, seed: 2506 });
  const head = piece(N + '-head', [neckPts, headPts, billPts, casque], (ctx) => {
    hide(ctx, neckPts);
    field(ctx, neckPts, INK.cream, { d: 1.6, alpha: 0.85, edge: false });
    dye(ctx, poly(inset(neckPts, 1.6)), grad(ctx, 0, 10, 0, 50, [[0, 'rgba(230,187,63,0.6)'], [1, 'rgba(0,0,0,0)']]), 1);
    slits(ctx, [[88, 44], [92, 30], [100, 20]], { len: 3, gap: 2.4, ang: 2.5, seed: 2507 });
    hide(ctx, headPts);
    hide(ctx, casque);
    dye(ctx, poly(inset(casque, 0.8)), grad(ctx, 108, 0, 152, 0, [[0, INK.orange], [0.4, INK.yellow], [1, INK.yellow]]), 0.92);
    gold(ctx, poly(inset(casque, 0.8)), 0.5);
    dots(ctx, [[116, 4], [132, 4], [144, 10]], { spacing: 2.6, r: 0.5 });
    hide(ctx, billPts);
    dye(ctx, poly(inset(billPts, 0.8)), grad(ctx, 114, 0, 158, 0, [[0, INK.cream], [0.35, INK.yellow], [1, INK.orange]]), 0.92);
    slit(ctx, [[118, 18], [134, 24], [150, 32]], 0.55);
    beastEye(ctx, 110, 12, 2.2, { style: 'round' });
    const iris = new Path2D(); iris.arc(110, 12, 3, 0, TAU); gold(ctx, iris, 0.5);
    ink(ctx, [[106, 9], [114, 8]], 0.7);
    knot(ctx, 88, 48, 1.8);
  });
  const tailPts = shape([[34, 50], [20, 58], [4, 72], [-4, 86], [4, 90], [18, 80], [36, 64]], { t: 0.4, wob: 0.2, seed: 2508 });
  const tail = piece(N + '-tail', [tailPts], (ctx) => {
    hide(ctx, tailPts);
    field(ctx, tailPts, INK.cream, { d: 1.4, alpha: 0.9, edge: false });
    for (let k = 0; k < 6; k++) slit(ctx, [[30, 58], [2 + k * 4, 84 - k * 3]], 0.5, { smoothIt: false });
    line(ctx, [[10, 66], [24, 76]], INK.leather, 6, { smoothIt: false });
    dots(ctx, [[10, 66], [24, 76]], { spacing: 2.6, r: 0.55 });
    knot(ctx, 33, 55, 1.6);
  });
  const mk = (id, dx, far, seed) => leg1(N + id, { spine: [[70 + dx, 74], [71 + dx, 82], [72 + dx, 88]], radii: [3.4, 2.4, 2.1], foot: 'bird', fw: 10, fh: 3, far, seed, footColor: INK.horn, perf: false });
  const legR = mk('-r', 0, false, 2510);
  const legL = mk('-l', -8, true, 2512);
  return makeRig('animal', {
    body: { pc: body, z: 0 },
    head: { pc: head, z: 2, parent: 'body', j: [88, 48], lim: [-0.4, 0.4], stiff: 0.55 },
    tail: { pc: tail, z: -1, parent: 'body', j: [33, 55], lim: [-0.5, 0.5], stiff: 0.3 },
    legR: { pc: legR.pc, z: 2, parent: 'body', j: legR.joint, lim: [-0.7, 0.7], stiff: 0.6 },
    legL: { pc: legL.pc, z: -2, parent: 'body', j: legL.joint, lim: [-0.7, 0.7], stiff: 0.6 },
  }, {
    sound: 'animal-duck',
    gait: [{ part: 'legR', amp: 0.4, phase: 0 }, { part: 'legL', amp: 0.4, phase: 0.5 }, { part: 'head', amp: 0.1, phase: 0.2 }, { part: 'tail', amp: 0.12, phase: 0.4 }],
  });
}

// ================================================================ SMALL

// กระต่าย — a crouching white rabbit (the one in the moon): long ears on
// their own joint, a big hind foot for hopping, a pompom tail.
function rabbit() {
  const N = 'kratai';
  scaleFigure(1.1);
  const bodyPts = shape([[14, 42], [20, 27], [36, 18], [54, 19], [66, 27], [72, 40], [68, 52], [56, 58], [30, 58], [16, 52]], { wob: 0.3, seed: 2601 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    field(ctx, bodyPts, INK.cream, { d: 1.6, alpha: 0.88, edge: false });
    trim(ctx, bodyPts, { seed: 2602, d: 2.4, sp: 2.6, r: 0.5 });
    spiral(ctx, 30, 42, 7, { seed: 2603, turns: 1.6 });
    slits(ctx, offset(path([[22, 30], [36, 22], [54, 22], [64, 30]]), 3), { len: 2.4, gap: 2.8, ang: 2.6, seed: 2604 });
    dots(ctx, [[42, 36], [50, 44], [48, 54]], { spacing: 2.6, r: 0.5 });
  });
  const headPts = shape([[60, 24], [63, 15], [72, 10], [82, 12], [89, 19], [92, 27], [89, 33], [80, 35], [70, 34], [63, 31]], { t: 0.5, wob: 0.2, seed: 2605 });
  const farEar = shape([[74, 13], [72, -6], [74, -20], [79, -18], [80, -4], [79, 12]], { t: 0.45, wob: 0 });
  const head = piece(N + '-head', [headPts, farEar], (ctx) => {
    hide(ctx, farEar); dye(ctx, poly(inset(farEar, 1)), INK.pink, 0.5); dye(ctx, poly(farEar), '#000', 0.3);
    hide(ctx, headPts);
    field(ctx, headPts, INK.cream, { d: 1.2, alpha: 0.88, edge: false });
    cuteEye(ctx, 80, 20, 2.6, { look: [0.25, 0.05] });
    const nose = new Path2D(); nose.arc(91, 27, 1.4, 0, TAU); dye(ctx, nose, INK.pink, 0.95);
    slit(ctx, [[91, 29], [89, 31.5], [86, 31]], 0.45);
    for (const dy of [-1.2, 0.8]) gold(ctx, [[86, 28 + dy], [98, 27 + dy * 2.4]], 0.3, { smoothIt: false });
    const cheek = new Path2D(); cheek.ellipse(82, 28, 3.4, 2.2, 0, 0, TAU); dye(ctx, cheek, INK.pink, 0.45);
    knot(ctx, 66, 28, 1.6);
  });
  const earPts = shape([[68, 14], [62, -2], [56, -18], [60, -22], [68, -12], [75, 2], [75, 12]], { t: 0.45, wob: 0.2, seed: 2606 });
  const ear = piece(N + '-ear', [earPts], (ctx) => {
    hide(ctx, earPts);
    field(ctx, earPts, INK.cream, { d: 1, alpha: 0.88, edge: false });
    const inner = shape([[68, 8], [63, -4], [59, -16], [62, -18], [67, -8], [72, 4]], { t: 0.45, wob: 0 });
    dye(ctx, poly(inner), INK.pink, 0.8);
    gold(ctx, poly(inner), 0.4);
    knot(ctx, 72, 11, 1.3);
  });
  const tailPts = shape([[10, 36], [16, 32], [20, 38], [18, 46], [11, 46], [7, 41]], { t: 0.5, wob: 0.3 });
  const tail = piece(N + '-tail', [tailPts], (ctx) => {
    hide(ctx, tailPts); field(ctx, tailPts, INK.white, { d: 0.8, alpha: 0.9, edge: false });
    dotFlower(ctx, 13.5, 40, 0.5);
  });
  const fore = (id, dx, far) => leg1(N + id, { spine: [[62 + dx, 48], [64 + dx, 55], [66 + dx, 60]], radii: [3.6, 2.8, 2.4], foot: 'paw', fw: 6, fh: 2.6, far, pale: INK.cream, perf: false });
  const hind = (id, dx, far) => leg1(N + id, { spine: [[24 + dx, 50], [30 + dx, 57], [40 + dx, 60]], radii: [5, 3.2, 2.6], foot: 'paw', fw: 7, fh: 2.6, far, pale: INK.cream, perf: false });
  const lFN = fore('-fn', 0, false), lFF = fore('-ff', -6, true), lBN = hind('-bn', 0, false), lBF = hind('-bf', 6, true);
  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 0.6 },
    head: { pc: head, z: 2, parent: 'body', j: [66, 28], lim: [-0.4, 0.4], stiff: 0.55 },
    ear: { pc: ear, z: 3, parent: 'head', j: [72, 11], lim: [-0.5, 0.35], stiff: 0.25 },
    tail: { pc: tail, z: -1, parent: 'body', j: [16, 40], lim: [-0.3, 0.3], stiff: 0.5 },
    legFR: J1(lFN, 4), legFL: J1(lFF, -3), legBR: J1(lBN, 4), legBL: J1(lBF, -3),
  }, {
    sound: 'pop',
    // a hop: fore and hind pairs together
    gait: [{ part: 'legFR', amp: 0.4, phase: 0 }, { part: 'legFL', amp: 0.4, phase: 0.05 }, { part: 'legBR', amp: 0.5, phase: 0.5 }, { part: 'legBL', amp: 0.5, phase: 0.55 }, { part: 'ear', amp: 0.25, phase: 0.3 }],
  });
}

// เต่า — a pond turtle: domed shell cut with gold scutes, a head that
// peeps out on a neck joint, stubby clawed legs.
function turtle() {
  const N = 'tao';
  const shellPts = shape([[16, 46], [22, 32], [36, 20], [58, 14], [80, 16], [98, 26], [108, 40], [108, 48], [16, 50]], { t: 0.45, wob: 0.4, seed: 2701 });
  const body = piece(N + '-shell', [shellPts, [[12, 44], [112, 54]]], (ctx) => {
    const rim = shape([[12, 44], [60, 42], [110, 44], [112, 50], [60, 54], [12, 50]], { t: 0.3, wob: 0 });
    hide(ctx, rim);
    field(ctx, rim, INK.yellow, { d: 1, alpha: 0.75, edge: false });
    for (let x = 18; x < 110; x += 8) slit(ctx, [[x, 44], [x - 1, 52]], 0.55, { smoothIt: false });
    hide(ctx, shellPts);
    field(ctx, shellPts, INK.green, { d: 1.8, alpha: 0.8 });
    dotLine(ctx, inset(shellPts, 3.4), { closed: true, spacing: 2.8, r: 0.55, seed: 2702, smoothIt: false });
    // scutes: central row of hexagons and marginals
    const hex = (cx, cy, rx, ry, c) => {
      const p = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
      dye(ctx, poly(p), c, 0.75); gold(ctx, poly(p), 0.7, { closed: true, smoothIt: false });
      dotLine(ctx, inset(p, 2.2), { closed: true, spacing: 2.6, r: 0.45, smoothIt: false });
      hole(ctx, cx, cy, 0.9);
    };
    for (const [cx, cy] of [[40, 32], [62, 26], [84, 32]]) hex(cx, cy, 11, 9, INK.jade);
    for (const [cx, cy] of [[28, 42], [50, 40], [72, 40], [94, 42]]) hex(cx, cy, 8, 5, INK.teal);
    knot(ctx, 100, 42, 1.8);
  });
  const headSp = [[96, 42], [108, 40], [118, 36]];
  const neck = tube(headSp, [6.4, 5.4, 5.4]);
  const headPts = shape([[112, 30], [122, 27], [131, 30], [134, 36], [128, 41], [116, 42]], { t: 0.45, wob: 0.1 });
  const head = piece(N + '-head', [neck, headPts], (ctx) => {
    hide(ctx, neck);
    field(ctx, neck, INK.jade, { d: 1.2, alpha: 0.6, edge: false });
    for (let k = 0; k < 3; k++) slit(ctx, [[102 + k * 4, 37], [101 + k * 4, 46]], 0.5, { smoothIt: false });
    hide(ctx, headPts);
    field(ctx, headPts, INK.jade, { d: 1, alpha: 0.7, edge: false });
    line(ctx, [[114, 34], [126, 32.5]], INK.yellow, 1.2);
    line(ctx, [[116, 39], [130, 37]], INK.yellow, 1);
    cuteEye(ctx, 124, 32.5, 2.2, { look: [0.3, 0], ring: false });
    slit(ctx, [[133, 37], [126, 38.5]], 0.5);
    knot(ctx, 100, 42, 1.8);
  });
  const mk = (id, sp, far, seed) => leg1(N + id, { spine: sp, radii: [6.4, 5.4, 4.8], foot: 'claw', fw: 9, fh: 3.4, far, seed, pale: INK.jade });
  const lFN = mk('-fn', [[88, 46], [91, 52], [93, 57]], false, 2710);
  const lFF = mk('-ff', [[76, 46], [78, 52], [80, 57]], true, 2712);
  const lBN = mk('-bn', [[32, 46], [29, 52], [28, 57]], false, 2714);
  const lBF = mk('-bf', [[44, 46], [42, 52], [41, 57]], true, 2716);
  const tailPts = tube([[20, 46], [12, 48], [6, 50]], [3.2, 2, 0.6]);
  const tail = piece(N + '-tail', [tailPts], (ctx) => { hide(ctx, tailPts); field(ctx, tailPts, INK.jade, { d: 0.6, alpha: 0.6, edge: false }); });
  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 1.4 },
    head: { pc: head, z: -0.5, parent: 'body', j: [100, 42], lim: [-0.3, 0.4], stiff: 0.5 },
    tail: { pc: tail, z: -1, parent: 'body', j: [20, 46], lim: [-0.4, 0.4], stiff: 0.3 },
    legFR: J1(lFN, 4, { lim: [-0.5, 0.5] }), legFL: J1(lFF, -3, { lim: [-0.5, 0.5] }),
    legBR: J1(lBN, 4, { lim: [-0.5, 0.5] }), legBL: J1(lBF, -3, { lim: [-0.5, 0.5] }),
  }, { sound: 'thud', gait: quadGait(0.22, 0, [{ part: 'head', amp: 0.12, phase: 0.25 }]) });
}

// ปูทะเล — a mud crab seen from the front: toothed carapace, eyes on
// stalks, two big pincers and three walking legs a side.
function crab() {
  const N = 'pu';
  const RED = INK.vermilion;
  const cara = [];
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI + (i / 20) * Math.PI;
    const tooth = i > 1 && i < 19 && i % 2 ? 1.1 : 1;
    cara.push([60 + Math.cos(a) * 36 * tooth, 40 + Math.sin(a) * 18 * tooth]);
  }
  const caraPts = shape([...cara, [92, 44], [80, 54], [60, 58], [40, 54], [28, 44]], { t: 0.4, wob: 0.2, seed: 2801 });
  const body = piece(N + '-body', [caraPts, [[46, 10], [74, 10]]], (ctx) => {
    for (const x of [52, 68]) {
      hide(ctx, tube([[x, 26], [x - (x < 60 ? 2 : -2), 14]], [1.6, 1.3]));
      const e = new Path2D(); e.arc(x - (x < 60 ? 2 : -2), 13, 3, 0, TAU);
      hide(ctx, Array.from({ length: 12 }, (_, i) => [x - (x < 60 ? 2 : -2) + Math.cos(i / 12 * TAU) * 3, 13 + Math.sin(i / 12 * TAU) * 3]));
      hole(ctx, x - (x < 60 ? 2 : -2) + 0.6, 12.4, 1.3);
      void e;
    }
    hide(ctx, caraPts);
    field(ctx, caraPts, RED, { d: 2, alpha: 0.88 });
    dye(ctx, poly(inset(caraPts, 2)), grad(ctx, 0, 22, 0, 58, [[0, 'rgba(230,187,63,0.5)'], [1, 'rgba(0,0,0,0)']]), 1);
    dotLine(ctx, inset(caraPts, 3.8), { closed: true, spacing: 2.8, r: 0.55, seed: 2802, smoothIt: false });
    // H-groove and gastric lace of the shell
    gold(ctx, [[44, 34], [52, 40], [60, 38], [68, 40], [76, 34]], 0.8);
    gold(ctx, [[60, 38], [60, 52]], 0.8, { smoothIt: false });
    prajamYam(ctx, 60, 44, 6, { color: INK.red, petal: INK.gold });
    dotFill(ctx, poly(inset(caraPts, 6)), [26, 22, 94, 56], { pattern: 'flowers', spacing: 8, r: 0.5, seed: 2803 });
    slit(ctx, [[54, 52], [60, 54], [66, 52]], 0.6);
  });
  const claw = (side) => {
    const S = (p) => [60 + side * (p[0] - 60), p[1]];
    const armSp = [[30, 42], [20, 36], [14, 26]].map(S);
    const arm = tube(armSp, [4.4, 4, 4.2]);
    const armPc = piece(N + '-arm' + side, [arm], (ctx) => {
      hide(ctx, arm);
      field(ctx, arm, RED, { d: 1.2, alpha: 0.88, edge: false });
      dots(ctx, path(armSp), { spacing: 2.6, r: 0.5, smoothIt: false });
      knot(ctx, armSp[0][0], armSp[0][1], 1.6);
    });
    const palm = shape([[8, 30], [6, 20], [8, 8], [12, 0], [18, 4], [20, 14], [22, 24], [20, 30], [14, 32]].map(S), { t: 0.45, wob: 0.1 });
    const finger = shape([[4, 12], [0, 4], [2, -6], [6, -4], [8, 6], [9, 12]].map(S), { t: 0.45, wob: 0.1 });
    const pinPc = piece(N + '-pincer' + side, [palm, finger], (ctx) => {
      hide(ctx, finger);
      dye(ctx, poly(inset(finger, 0.6)), INK.leather, 0.6);
      hide(ctx, palm);
      field(ctx, palm, RED, { d: 1.4, alpha: 0.9 });
      cut(ctx, poly([[9, 2], [8.4, 12], [10, 10]].map(S)));
      dots(ctx, [[10, 26], [12, 14], [14, 4]].map(S), { spacing: 2.4, r: 0.5 });
      hole(ctx, S([16, 18])[0], 18, 0.8);
      knot(ctx, S([14, 27])[0], 27, 1.5);
    });
    return { armPc, pinPc, j0: S([30, 42]), j1: S([14, 27]) };
  };
  const cL = claw(-1), cR = claw(1);
  const legs = {};
  const gait = [];
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const S = (p) => [60 + side * (p[0] - 60), p[1]];
      const sp = [[32 + k * 3, 46 + k * 2], [18 - k * 2, 44 + k * 4], [10 - k * 2, 54 + k * 3], [8 - k * 3, 66]].map(S);
      const o = tube(sp, [2.6, 2.4, 2, 0.6]);
      const id = (side < 0 ? 'legL' : 'legR') + k;
      const pc = piece(N + '-' + id, [o], (ctx) => {
        hide(ctx, o);
        field(ctx, o, RED, { d: 0.9, alpha: 0.85, edge: false });
        const d = path(sp);
        dots(ctx, d.slice(2, -4), { spacing: 2.6, r: 0.4, smoothIt: false });
        knot(ctx, sp[0][0], sp[0][1], 1.2);
      });
      legs[id] = { pc, z: side < 0 ? -1 - k * 0.1 : -1 - k * 0.1, parent: 'body', j: sp[0], lim: [-0.4, 0.4], stiff: 0.55 };
      gait.push({ part: id, amp: 0.25, phase: (k * 0.33 + (side > 0 ? 0.5 : 0)) % 1 });
    }
  }
  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 0.8 },
    armL: { pc: cL.armPc, z: 1, parent: 'body', j: cL.j0, lim: [-0.5, 0.5], stiff: 0.5 },
    pincerL: { pc: cL.pinPc, z: 2, parent: 'armL', j: cL.j1, lim: [-0.6, 0.6], stiff: 0.45 },
    armR: { pc: cR.armPc, z: 1, parent: 'body', j: cR.j0, lim: [-0.5, 0.5], stiff: 0.5 },
    pincerR: { pc: cR.pinPc, z: 2, parent: 'armR', j: cR.j1, lim: [-0.6, 0.6], stiff: 0.45 },
    ...legs,
  }, { sound: 'click', gait: [...gait, { part: 'pincerL', amp: 0.2, phase: 0 }, { part: 'pincerR', amp: 0.2, phase: 0.5 }] });
}

// กบนา — a paddy frog squatting to leap: goggle eye, spotted back,
// folded hind leg in two pieces.
function frog() {
  const N = 'kop';
  scaleFigure(1.2);
  const bodyPts = shape([[16, 40], [22, 28], [34, 20], [48, 17], [56, 12], [64, 13], [70, 20], [76, 28], [74, 34], [64, 40], [50, 46], [30, 48]], { wob: 0.3, seed: 2901 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    hide(ctx, bodyPts);
    field(ctx, bodyPts, INK.green, { d: 1.6, alpha: 0.85, edge: false });
    dye(ctx, poly(inset(bodyPts, 1.6)), grad(ctx, 0, 14, 0, 48, [[0, 'rgba(0,0,0,0)'], [0.6, 'rgba(0,0,0,0)'], [1, 'rgba(230,187,63,0.8)']]), 1);
    trim(ctx, bodyPts, { seed: 2902, d: 2.2, sp: 2.6, r: 0.5, g: 1 });
    // goggle eye on its bump
    cuteEye(ctx, 60, 17, 3.2, { look: [0.25, 0], pupil: 0.55 });
    gold(ctx, [[22, 32], [40, 24], [56, 22]], 0.6);
    for (const [x, y, r] of [[30, 34, 1.6], [40, 30, 1.3], [46, 38, 1.5], [34, 42, 1.1], [52, 30, 1.1]]) { const p = new Path2D(); p.arc(x, y, r + 1, 0, TAU); dye(ctx, p, INK.leather, 0.7); hole(ctx, x, y, r * 0.5); }
    slit(ctx, [[76, 30], [68, 32], [60, 30]], 0.6);
    const ear = new Path2D(); ear.arc(52, 26, 2.6, 0, TAU); gold(ctx, ear, 0.45);
  });
  const fore = (id, dx, far) => leg1(N + id, { spine: [[58 + dx, 38], [61 + dx, 45], [62 + dx, 50]], radii: [2.8, 2.2, 1.8], foot: 'web', fw: 8, fh: 2, far, pale: INK.green, footColor: INK.jade, perf: false });
  const hind = (id, dx, far, seed) => leg(N + id, { up: [[28 + dx, 36], [40 + dx, 42], [36 + dx, 48]], upR: [8, 6, 4], lo: [[36 + dx, 47], [28 + dx, 49], [22 + dx, 50]], loR: [3, 2.4, 2], foot: 'web', fw: 12, fh: 2, far, seed, bands: [], pale: INK.green, footColor: INK.jade, dotR: 0.45 });
  const lFN = fore('-fn', 0, false), lFF = fore('-ff', -5, true);
  const lBN = hind('-bn', 0, false, 2910), lBF = hind('-bf', 5, true, 2912);
  return makeRig('animal', {
    body: { pc: body, z: 0, mass: 0.5 },
    legFR: J1(lFN, 4), legFL: J1(lFF, -3),
    ...legJoints('legBR', lBN, 4, 5, { lim: [-0.8, 0.5] }), ...legJoints('legBL', lBF, -3, -2, { lim: [-0.8, 0.5] }),
  }, {
    sound: 'pop',
    gait: [{ part: 'legBR', amp: 0.5, phase: 0 }, { part: 'legBL', amp: 0.5, phase: 0.05 }, { part: 'legBR2', amp: 0.5, phase: 0.2 }, { part: 'legBL2', amp: 0.5, phase: 0.25 }, { part: 'legFR', amp: 0.3, phase: 0.5 }, { part: 'legFL', amp: 0.3, phase: 0.55 }],
  });
}

export const PROPS = [
  { id: 'moo-deng', name: 'หมูเด้ง', en: 'Moo Deng, the baby pygmy hippo', cat: 'animals', build: () => hippo(true) },
  { id: 'hippo', name: 'แม่ฮิปโป', en: 'Mother pygmy hippo', cat: 'animals', build: () => hippo(false) },
  { id: 'pae', name: 'แพะ', en: 'Goat', cat: 'animals', build: goat },
  { id: 'kae', name: 'แกะ', en: 'Sheep', cat: 'animals', build: sheep },
  { id: 'luk-kwai', name: 'ลูกควาย', en: 'Buffalo calf', cat: 'animals', build: buffaloCalf },
  { id: 'jorakhe', name: 'จระเข้', en: 'Crocodile', cat: 'animals', build: crocodile },
  { id: 'suea', name: 'เสือ', en: 'Tiger', cat: 'animals', build: tiger },
  { id: 'kwang-thong', name: 'กวางทอง', en: 'Golden deer (Ramakien)', cat: 'animals', build: goldenDeer },
  { id: 'chang-noi', name: 'ช้างน้อย', en: 'Baby elephant', cat: 'animals', build: babyElephant },
  { id: 'nok-yung', name: 'นกยูง', en: 'Green peafowl', cat: 'animals', build: peacock },
  { id: 'kai-jae', name: 'ไก่แจ้', en: 'Bantam', cat: 'animals', build: bantam },
  { id: 'han', name: 'ห่าน', en: 'Goose', cat: 'animals', build: goose },
  { id: 'nok-ngueak', name: 'นกเงือก', en: 'Great hornbill', cat: 'animals', build: hornbill },
  { id: 'kratai', name: 'กระต่าย', en: 'Rabbit', cat: 'animals', build: rabbit },
  { id: 'tao', name: 'เต่า', en: 'Turtle', cat: 'animals', build: turtle },
  { id: 'pu', name: 'ปูทะเล', en: 'Mud crab', cat: 'animals', build: crab },
  { id: 'kop', name: 'กบ', en: 'Frog', cat: 'animals', build: frog },
];
