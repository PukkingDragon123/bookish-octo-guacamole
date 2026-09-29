// อมนุษย์ — articulated monsters and spirits cut as หนังตะลุง leather.
// Uses the figure-coordinate toolkit from animals.js.
import { INK, dye, gold, hole, dotLine, dotFill, slit, cut, prajamYam, krajangRow, eye, poly, inset } from '../art/leather.js';
import { shape, path, tube, offset, move, piece, makeRig, hide, trim, field, dots, spiral, lozenges, strap, slits, flowers, beastEye, kanok, feather, knot, rosette, flame, swirlFlames, tuftPts, tuft, ink, scales, scaleFigure } from './animals.js';

const TAU = Math.PI * 2;

// Chain of body segments along a polyline (naga / dragon / entrails).
function chain(name, pts, radii, deco) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const o = tube([a, m, b], [radii[i], (radii[i] + radii[i + 1]) / 2, radii[i + 1]]);
    out.push({ pc: piece(name + i, [o], (ctx) => { hide(ctx, o); deco(ctx, o, i, a, b); if (i) knot(ctx, a[0], a[1], Math.min(2.6, radii[i] * 0.25)); }), j: a });
  }
  return out;
}
function chainParts(prefix, segs, parent, parentJ, { z = 0, dz = -0.01, lim = [-0.5, 0.5], stiff = 0.35, soft = 0 } = {}) {
  const parts = {};
  segs.forEach((s, i) => {
    parts[prefix + (i + 1)] = { pc: s.pc, z: z + dz * i, parent: i ? prefix + i : parent, j: i ? s.j : parentJ, lim, stiff: Math.max(0.05, stiff - soft * i) };
  });
  return parts;
}

// พญานาค — five-headed naga with a flame-crested hood and a scaled body.
function naga() {
  const N = 'naga';
  scaleFigure(1.8);
  const pts = [];
  for (let i = 0; i <= 10; i++) pts.push([300 - i * 30, 250 + Math.sin(i * 0.9) * 16 - (i < 2 ? (2 - i) * 6 : 0)]);
  const radii = pts.map((_, i) => Math.max(4, 22 - i * 1.7));
  const segs = chain(N + '-s', pts, radii, (ctx, o, i, a, b) => {
    const belly = poly(inset(o, 3));
    dye(ctx, belly, INK.green, 0.55);
    scales(ctx, o, { d: 3.5, spacing: 4.6, w: 0.6 });
    dotLine(ctx, offset(path([a, b]), -radii[i] * 0.5), { spacing: 3, r: 0.6, smoothIt: false });
    trim(ctx, o, { d: 2.8, seed: 20 + i });
    gold(ctx, offset(path([a, b]), radii[i] * 0.55), 0.6, { smoothIt: false });
    const k = Math.max(7, radii[i] * 0.9);
    kanok(ctx, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - radii[i] * 0.9, k, -Math.PI / 2 - 0.5, false, { color: INK.red });
  });
  // neck rising into the hood
  const neckPts = shape([[292, 262], [300, 228], [312, 180], [330, 150], [350, 150], [346, 190], [330, 236], [322, 272], [300, 276]], { wob: 0.8, seed: 3 });
  const heads = [];
  for (let h = 0; h < 7; h++) {
    const a = -Math.PI / 2 + (h - 3) * 0.36 + 0.25;
    const cx = 352 + Math.cos(a) * 70, cy = 150 + Math.sin(a) * 70;
    heads.push([cx, cy, a]);
  }
  const hoodPts = shape([[296, 176], [292, 110], [318, 72], [360, 60], [404, 78], [424, 124], [410, 170], [370, 196], [330, 198]], { wob: 1, seed: 4 });
  const body = piece(N + '-hood', [neckPts, hoodPts, ...heads.map(([x, y]) => [[x - 36, y - 36], [x + 36, y + 26]])], (ctx) => {
    hide(ctx, neckPts);
    dye(ctx, poly(inset(neckPts, 3)), INK.green, 0.6);
    scales(ctx, neckPts, { d: 4, spacing: 7 });
    hide(ctx, hoodPts);
    field(ctx, hoodPts, INK.jade, { d: 3, alpha: 0.7 });
    trim(ctx, hoodPts, { rows: 2, seed: 5 });
    dotFill(ctx, poly(inset(hoodPts, 9)), [290, 56, 426, 200], { pattern: 'flowers', spacing: 8, r: 0.7, seed: 6 });
    for (let k = 0; k < 4; k++) dotLine(ctx, inset(hoodPts, 14 + k * 9), { closed: true, spacing: 3, r: 0.6, smoothIt: false, seed: k });
    krajangRow(ctx, [[300, 186], [340, 200], [406, 176]], 8, { color: INK.gold, inner: INK.red });
    prajamYam(ctx, 352, 138, 14, { color: INK.red, petal: INK.gold });
    heads.forEach(([x, y, a], h) => {
      const c = Math.cos(a), s = Math.sin(a);
      // crest flames
      for (let k = -1; k <= 1; k++) kanok(ctx, x - c * 4 + k * 5, y - 10, 16 + (k ? 0 : 6), a - 0.9 + k * 0.4, k > 0, { color: k ? INK.red : INK.gold });
      const hp = shape([[x - 14, y + 4], [x - 12, y - 10], [x, y - 14], [x + 16, y - 10], [x + 30, y - 2], [x + 32, y + 6], [x + 22, y + 10], [x + 4, y + 14], [x - 10, y + 12]], { wob: 0.4, seed: 10 + h });
      hide(ctx, hp);
      field(ctx, hp, INK.green, { d: 2, alpha: 0.75 });
      trim(ctx, hp, { d: 2.4, sp: 2.8, r: 0.55, g: 1 });
      beastEye(ctx, x + 10, y - 4, 3.2, { style: 'round' });
      slit(ctx, [[x + 31, y + 5], [x + 18, y + 7], [x + 8, y + 5]], 0.8);
      hide(ctx, tube([[x + 32, y + 6], [x + 40, y + 8], [x + 44, y + 4]], [1, 0.8, 0.5]));
      dye(ctx, poly([[x + 30, y + 4], [x + 46, y + 2], [x + 46, y + 12], [x + 30, y + 10]]), INK.red, 0.9);
    });
    strap(ctx, [[298, 200], [320, 196], [344, 190]], 6, { color: INK.gold, seed: 7 });
  });
  const tailTip = tube([pts[10], [pts[10][0] - 30, pts[10][1] - 12], [pts[10][0] - 50, pts[10][1] - 34]], [radii[10], 3, 0.8]);
  const tail = piece(N + '-tail', [tailTip], (ctx) => { hide(ctx, tailTip); dye(ctx, poly(inset(tailTip, 1.5)), INK.green, 0.6); dots(ctx, path([pts[10], [pts[10][0] - 30, pts[10][1] - 12]]), { r: 0.6 }); kanok(ctx, pts[10][0] - 50, pts[10][1] - 34, 14, -2.4, false, { color: INK.red }); });
  const parts = {
    body: { pc: body, z: 1 },
    ...chainParts('seg', segs, 'body', pts[0], { z: 0, stiff: 0.4, soft: 0.02 }),
  };
  parts.tail = { pc: tail, z: -0.2, parent: 'seg10', j: pts[10], lim: [-0.6, 0.6], stiff: 0.2 };
  const gait = segs.map((_, i) => ({ part: 'seg' + (i + 1), amp: 0.14 + i * 0.01, phase: i * 0.1 }));
  gait.push({ part: 'tail', amp: 0.3, phase: 1 });
  return makeRig('monster', parts, { sound: 'hiss', gait });
}

// มังกร — Chinese-Thai dragon: horned head with open jaw, segmented body
// with dorsal flames, four clawed legs.
function dragon() {
  const N = 'mangkon';
  const pts = [];
  for (let i = 0; i <= 8; i++) pts.push([300 - i * 34, 150 + Math.sin(i * 1.1 + 0.4) * 22]);
  const radii = pts.map((_, i) => Math.max(5, 20 - i * 1.8));
  const segs = chain(N + '-s', pts, radii, (ctx, o, i, a, b) => {
    dye(ctx, poly(inset(o, 2.5)), INK.gold, 0.55);
    scales(ctx, o, { d: 4, spacing: 6.5 });
    trim(ctx, o, { d: 2.8, rows: 2, gap: 2.4, seed: 40 + i });
    for (let k = 0; k < 2; k++) {
      const t = 0.25 + k * 0.5;
      flame(ctx, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - radii[i] * 0.7, -Math.PI / 2 - 0.6, radii[i] * 1.3, 8, { fill: INK.red, seed: i * 3 + k });
    }
    kanok(ctx, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - radii[i] * 0.95, Math.max(8, radii[i]), -Math.PI / 2 - 0.6, false, { color: INK.red });
  });
  const headPts = shape([[290, 140], [300, 122], [322, 112], [346, 116], [366, 126], [380, 136], [372, 146], [346, 148], [320, 160], [296, 164]], { wob: 0.6, seed: 50 });
  const horns = [tube([[318, 116], [304, 96], [290, 84], [276, 82]], [4, 3.5, 2.5, 1]), tube([[330, 114], [322, 92], [312, 76]], [3.6, 3, 1])];
  const body = piece(N + '-head', [headPts, ...horns, [[270, 170], [390, 100]]], (ctx) => {
    for (const h of horns) { hide(ctx, h); dye(ctx, poly(inset(h, 0.8)), INK.gold, 0.7); }
    hide(ctx, headPts);
    field(ctx, headPts, INK.green, { d: 2.5, alpha: 0.7 });
    trim(ctx, headPts, { rows: 2, seed: 51 });
    scales(ctx, headPts, { d: 8, spacing: 5 });
    beastEye(ctx, 340, 124, 5, { style: 'bulge' });
    ink(ctx, [[330, 116], [342, 112], [354, 118]], 1.4);
    hole(ctx, 372, 134, 1.4);
    for (let k = 0; k < 4; k++) kanok(ctx, 300 - k * 2, 140 + k * 6, 14, Math.PI - 0.3 + k * 0.2, k % 2 === 1, { color: k % 2 ? INK.red : INK.gold });
    // whiskers
    hide(ctx, tube([[376, 140], [392, 150], [404, 146], [412, 132]], [1.4, 1.1, 0.9, 0.5]));
    for (let k = 0; k < 5; k++) hole(ctx, 350 + k * 5, 139, 0.8);
  });
  const jawPts = shape([[322, 152], [346, 148], [372, 148], [378, 156], [358, 164], [334, 166]], { wob: 0.4, seed: 52 });
  const jaw = piece(N + '-jaw', [jawPts], (ctx) => {
    hide(ctx, jawPts); field(ctx, jawPts, INK.red, { d: 2, alpha: 0.8 });
    for (let k = 0; k < 5; k++) cut(ctx, poly([[346 + k * 6, 148], [349 + k * 6, 148], [347.5 + k * 6, 153]]));
    kanok(ctx, 340, 166, 12, Math.PI / 2 + 0.4, false, { color: INK.gold });
  });
  const mkLeg = (id, at, far) => {
    const [x, y] = at;
    const o = tube([[x, y], [x + 4, y + 22], [x - 2, y + 40]], [9, 6, 4.5]);
    const claws = [0, 1, 2].map((k) => tube([[x - 2, y + 40], [x + 6 + k * 4, y + 46 - k], [x + 12 + k * 5, y + 44 - k * 3]], [2.2, 1.6, 0.5]));
    return piece(N + id, [o, ...claws], (ctx) => {
      hide(ctx, o); for (const c of claws) hide(ctx, c);
      dye(ctx, poly(inset(o, 1.5)), INK.gold, 0.55);
      trim(ctx, o, { d: 2.4, sp: 2.8, r: 0.55 });
      kanok(ctx, x - 6, y + 12, 12, Math.PI - 0.6, false, { color: INK.red });
      if (far) dye(ctx, poly(o), '#000', 0.3); else knot(ctx, x, y + 4, 2);
    });
  };
  const legs = { legFR: [pts[1], 3], legFL: [move([pts[1]], -12, 0)[0], -3], legBR: [pts[5], 3], legBL: [move([pts[5]], 12, 0)[0], -3] };
  const parts = {
    body: { pc: body, z: 2 },
    jaw: { pc: jaw, z: 1.5, parent: 'body', j: [326, 156], lim: [-0.05, 0.5], stiff: 0.6 },
    ...chainParts('seg', segs, 'body', pts[0], { z: 0, stiff: 0.45, soft: 0.02 }),
  };
  for (const [id, [p, z]] of Object.entries(legs)) {
    const seg = id.includes('F') ? 'seg2' : 'seg6';
    parts[id] = { pc: mkLeg('-' + id, [p[0], p[1] + 6], z < 0), z, parent: seg, j: [p[0], p[1] + 10], lim: [-0.7, 0.7], stiff: 0.5 };
  }
  const gait = segs.map((_, i) => ({ part: 'seg' + (i + 1), amp: 0.12, phase: i * 0.12 }));
  gait.push({ part: 'legFR', amp: 0.4, phase: 0 }, { part: 'legBL', amp: 0.4, phase: 0 }, { part: 'legFL', amp: 0.4, phase: 0.5 }, { part: 'legBR', amp: 0.4, phase: 0.5 }, { part: 'jaw', amp: 0.15, phase: 0 });
  return makeRig('monster', parts, { sound: 'roar', gait, limbs: { jaw: 'jaw', head: 'body' } });
}

// ผีกระสือ — floating Krasue: a lovely face with loose hair, trailing
// glowing entrails (heart, lungs, gut chain).
function krasue() {
  const N = 'krasue';
  const hairPts = shape([[40, 30], [52, 8], [78, 0], [102, 8], [112, 30], [110, 60], [100, 96], [86, 130], [76, 150], [68, 124], [58, 96], [44, 70]], { wob: 1.2, seed: 60 });
  const facePts = shape([[70, 28], [88, 24], [104, 34], [112, 50], [118, 60], [112, 66], [114, 74], [106, 82], [96, 90], [82, 88], [72, 72]], { t: 0.45, wob: 0.3, seed: 61 });
  const heart = shape([[72, 96], [84, 90], [94, 96], [92, 112], [82, 124], [72, 112]], { t: 0.5, wob: 0.4, seed: 62 });
  const body = piece(N + '-head', [hairPts, facePts, heart], (ctx) => {
    hide(ctx, hairPts);
    for (let k = 0; k < 7; k++) slit(ctx, [[60 + k * 6, 12], [54 + k * 7, 60], [62 + k * 4, 120 - k * 6]], 0.7);
    dotLine(ctx, inset(hairPts, 3), { closed: true, spacing: 3, r: 0.6, smoothIt: false });
    hide(ctx, facePts);
    field(ctx, facePts, INK.face, { d: 1.6, alpha: 0.9 });
    eye(ctx, 100, 50, 5, { style: 'almond', angle: 0.05 });
    gold(ctx, [[92, 43], [100, 41], [108, 44]], 0.8);
    dye(ctx, poly([[106, 72], [114, 71], [110, 75]]), INK.red, 0.95);
    ink(ctx, [[112, 58], [116, 62], [112, 64]], 0.6);
    // earring
    rosette(ctx, 80, 62, 4.2, { inner: INK.red });
    krajangRow(ctx, [[64, 30], [80, 22], [98, 22]], 6, { color: INK.gold, inner: INK.red });
    hide(ctx, heart);
    dye(ctx, poly(inset(heart, 1.2)), INK.crimson, 0.95);
    dye(ctx, poly(inset(heart, 4)), INK.red, 0.8);
    dotLine(ctx, inset(heart, 2.5), { closed: true, spacing: 2.8, r: 0.6, smoothIt: false });
    hole(ctx, 82, 104, 1.5);
  });
  const glowSeg = (ctx, o, i) => {
    dye(ctx, poly(inset(o, 1)), i % 2 ? INK.red : INK.vermilion, 0.92);
    dotLine(ctx, inset(o, 2.4), { closed: true, spacing: 2.8, r: 0.55, smoothIt: false, seed: i });
    gold(ctx, poly(inset(o, 0.8)), 0.4);
  };
  const gutA = [[82, 120], [86, 142], [78, 164], [86, 186], [80, 208], [88, 230], [82, 252]];
  const gutB = [[76, 116], [66, 138], [70, 160], [62, 180], [66, 200]];
  const sA = chain(N + '-a', gutA, gutA.map((_, i) => 6 - i * 0.5), glowSeg);
  const sB = chain(N + '-b', gutB, gutB.map((_, i) => 5 - i * 0.5), glowSeg);
  const parts = {
    body: { pc: body, z: 0 },
    ...chainParts('gut', sA, 'body', gutA[0], { z: -1, lim: [-0.9, 0.9], stiff: 0.1, soft: 0.01 }),
    ...chainParts('gutB', sB, 'body', gutB[0], { z: -2, lim: [-0.9, 0.9], stiff: 0.1, soft: 0.01 }),
  };
  const gait = [...sA.map((_, i) => ({ part: 'gut' + (i + 1), amp: 0.15, phase: i * 0.12 })), ...sB.map((_, i) => ({ part: 'gutB' + (i + 1), amp: 0.15, phase: 0.5 + i * 0.12 }))];
  return makeRig('monster', parts, { sound: 'ghost', gait, float: true, glowAt: [82, 108, 90] });
}

// ครุฑ — Garuda: red bird-man with a pointed crown, spread jointed wings,
// taloned legs.
function garuda() {
  const N = 'khrut';
  scaleFigure(1.25);
  const torso = shape([[190, 150], [214, 140], [232, 150], [236, 190], [230, 240], [236, 270], [196, 274], [186, 240], [182, 190]], { wob: 0.6, seed: 70 });
  const body = piece(N + '-torso', [torso], (ctx) => {
    hide(ctx, torso);
    field(ctx, torso, INK.red, { d: 2.5 });
    trim(ctx, torso, { rows: 2, seed: 71 });
    krajangRow(ctx, [[196, 160], [214, 154], [230, 160]], 7, { color: INK.gold, inner: INK.green });
    strap(ctx, [[188, 244], [212, 248], [234, 244]], 8, { color: INK.gold, seed: 72 });
    prajamYam(ctx, 210, 200, 11, { color: INK.green, petal: INK.gold });
    hem(ctx, [[190, 266], [214, 270], [236, 266]], 7);
  });
  const headPts = shape([[196, 146], [196, 120], [208, 106], [224, 106], [236, 118], [256, 128], [248, 134], [236, 136], [234, 148], [214, 152]], { wob: 0.4, seed: 73 });
  const crown = shape([[198, 112], [204, 80], [212, 40], [216, 20], [222, 44], [230, 82], [232, 112]], { t: 0.4, wob: 0.3, seed: 74 });
  const head = piece(N + '-head', [headPts, crown], (ctx) => {
    hide(ctx, crown);
    field(ctx, crown, INK.gold, { d: 2, alpha: 0.85 });
    for (let y = 100; y > 40; y -= 12) krajangRow(ctx, [[204 + (100 - y) * 0.12, y], [228 - (100 - y) * 0.12, y]], 6, { color: INK.gold, inner: INK.red });
    hide(ctx, headPts);
    field(ctx, headPts, INK.red, { d: 2 });
    trim(ctx, headPts, { d: 2.6, seed: 75 });
    dye(ctx, poly([[236, 118], [256, 128], [236, 136]]), INK.gold, 0.9);
    beastEye(ctx, 224, 122, 4.2, { style: 'bulge' });
    kanok(ctx, 206, 134, 16, Math.PI - 0.4, false, { color: INK.green });
  });
  const wing = (id, root, far) => {
    const [x, y] = root;
    const sg = far ? -1 : 1;
    const X = (d) => x - d * sg;
    const inner = shape([[x, y - 8], [X(60), y - 60], [X(100), y - 70], [X(90), y - 40], [X(40), y + 10], [x, y + 14]], { wob: 0.6, seed: far ? 80 : 81 });
    const fs = [];
    for (let k = 0; k < 7; k++) fs.push([[X(90 - k * 8), y - 50 + k * 8], [X(130 - k * 4), y - 70 + k * 16], [X(160 - k * 6), y - 60 + k * 22]]);
    const w1 = piece(N + id, [inner], (ctx) => {
      hide(ctx, inner);
      field(ctx, inner, far ? INK.green : INK.red, { d: 2.5 });
      trim(ctx, inner, { rows: 3, seed: 82 });
      dotFill(ctx, poly(inset(inner, 12)), [x - 110, y - 80, x + 110, y + 20], { pattern: 'flowers', spacing: 8, r: 0.65 });
      krajangRow(ctx, far ? [[X(4), y + 12], [X(92), y - 38]].reverse() : [[X(4), y + 12], [X(92), y - 38]], 7, { color: INK.gold, inner: far ? INK.red : INK.green });
      for (let k = 0; k < 4; k++) lozenges(ctx, [[X(10), y - 2 + k * 3], [X(80), y - 56 + k * 6]], { size: 2, gap: 7 });
      if (far) dye(ctx, poly(inner), '#000', 0.3); else knot(ctx, X(6), y, 2.4);
    });
    const outlines = fs.flat().map(([a, b]) => [[a - 14, b - 14], [a + 14, b + 14]]).flat();
    const w2 = piece(N + id + '2', [outlines], (ctx) => {
      for (const f of fs) feather(ctx, f, 9, { color: far ? INK.jade : INK.gold, lace: true, seed: 83 });
      if (!far) knot(ctx, X(88), y - 44, 2);
    });
    return { w1, w2, j2: [X(88), y - 44], j1: [X(4), y] };
  };
  const wF = wing('-wingF', [206, 168], false), wB = wing('-wingB', [220, 164], true);
  const leg = (id, x, far) => {
    const th = tube([[x, 256], [x + 10, 290], [x + 4, 318]], [13, 10, 6]);
    const sh = tube([[x + 4, 316], [x + 2, 346], [x + 4, 368]], [5, 4, 3.5]);
    const tal = [0, 1, 2].map((k) => tube([[x + 4, 368], [x + 12 + k * 5, 374], [x + 18 + k * 6, 380]], [2.6, 1.8, 0.6]));
    const t = piece(N + id, [th], (ctx) => { hide(ctx, th); trim(ctx, th, { d: 2.6, sp: 3, r: 0.55 }); spiral(ctx, x, 334, 6, { turns: 1.6 }); field(ctx, th, far ? INK.green : INK.red, { d: 2.4 }); trim(ctx, th, { seed: 84 }); for (let k = 0; k < 3; k++) kanok(ctx, x - 6, 272 + k * 12, 12, Math.PI - 0.4, false, { color: INK.gold }); if (far) dye(ctx, poly(th), '#000', 0.3); });
    const s = piece(N + id + '2', [sh, ...tal], (ctx) => { hide(ctx, sh); for (const c of tal) hide(ctx, c); dye(ctx, poly(inset(sh, 1)), INK.yellow, 0.7); slits(ctx, [[x + 4, 322], [x + 3, 360]], { len: 3, gap: 3, ang: 1.57 }); if (!far) knot(ctx, x + 4, 318, 1.8); });
    return { t, s, j: [x, 258], k: [x + 4, 318] };
  };
  const lF = leg('-legF', 214, false), lB = leg('-legB', 200, true);
  return makeRig('monster', {
    body: { pc: body, z: 0, mass: 1.4 },
    head: { pc: head, z: 3, parent: 'body', j: [214, 146], lim: [-0.3, 0.3], stiff: 0.7 },
    wingF: { pc: wF.w1, z: 4, parent: 'body', j: wF.j1, lim: [-0.6, 0.6], stiff: 0.4 },
    wingF2: { pc: wF.w2, z: 3.5, parent: 'wingF', j: wF.j2, lim: [-0.6, 0.6], stiff: 0.3 },
    wingB: { pc: wB.w1, z: -4, parent: 'body', j: wB.j1, lim: [-0.6, 0.6], stiff: 0.4 },
    wingB2: { pc: wB.w2, z: -5, parent: 'wingB', j: wB.j2, lim: [-0.6, 0.6], stiff: 0.3 },
    legF: { pc: lF.t, z: 2, parent: 'body', j: lF.j, lim: [-0.8, 0.8], stiff: 0.5 },
    legF2: { pc: lF.s, z: 2.5, parent: 'legF', j: lF.k, lim: [-0.9, 0.9], stiff: 0.5 },
    legB: { pc: lB.t, z: -2, parent: 'body', j: lB.j, lim: [-0.8, 0.8], stiff: 0.5 },
    legB2: { pc: lB.s, z: -2.5, parent: 'legB', j: lB.k, lim: [-0.9, 0.9], stiff: 0.5 },
  }, {
    sound: 'roar',
    gait: [{ part: 'wingF', amp: 0.35, phase: 0 }, { part: 'wingB', amp: 0.35, phase: 0.05 }, { part: 'wingF2', amp: 0.3, phase: 0.15 }, { part: 'wingB2', amp: 0.3, phase: 0.2 }, { part: 'legF', amp: 0.3, phase: 0 }, { part: 'legB', amp: 0.3, phase: 0.5 }],
  });
}

// เปรต — a towering, emaciated Pret with a needle-eye mouth and rib lace.
function pret() {
  const N = 'pret';
  const torso = shape([[94, 150], [124, 144], [132, 200], [138, 250], [134, 300], [138, 328], [84, 330], [82, 300], [80, 250], [84, 200]], { wob: 0.8, seed: 90 });
  const body = piece(N + '-torso', [torso], (ctx) => {
    hide(ctx, torso);
    trim(ctx, torso, { seed: 91 });
    for (let k = 0; k < 7; k++) { const y = 166 + k * 13; cut(ctx, poly(tube([[90, y], [108, y + 5], [126, y]], [2, 2.4, 1.8]))); dots(ctx, [[92, y + 6], [108, y + 11], [124, y + 6]], { spacing: 2.8, r: 0.5 }); }
    krajangRow(ctx, [[138, 300], [110, 296], [82, 300]], 7, { color: INK.gold, inner: INK.crimson });
    swirlFlames(ctx, 108, 272, 10, Math.PI / 2, { n: 3, len: 22, seed: 3 });
    dots(ctx, [[108, 150], [108, 270]], { spacing: 3.4, r: 0.8 });
    dye(ctx, poly(inset(torso, 3)), INK.teal, 0.3);
    slits(ctx, [[98, 290], [122, 292]], { len: 10, gap: 4, ang: 1.6 });
  });
  const neck = tube([[108, 150], [112, 110], [114, 80]], [7, 6, 6]);
  const headPts = shape([[94, 72], [100, 46], [118, 38], [134, 48], [140, 66], [134, 86], [118, 94], [102, 88]], { wob: 0.6, seed: 92 });
  const hair = [0, 1, 2, 3, 4].map((k) => tube([[104 + k * 6, 50 - k], [100 + k * 6, 32 - k * 2], [96 + k * 8, 20 - k]], [1.4, 1, 0.4]));
  const head = piece(N + '-head', [neck, headPts, ...hair], (ctx) => {
    hide(ctx, neck); for (const h of hair) hide(ctx, h);
    hide(ctx, headPts);
    dye(ctx, poly(inset(headPts, 2)), INK.teal, 0.35);
    trim(ctx, headPts, { d: 2.4, seed: 93 });
    eye(ctx, 124, 62, 4.5, { style: 'round' });
    ink(ctx, [[116, 56], [124, 55], [132, 58]], 1);
    hole(ctx, 133, 76, 0.6);
    dots(ctx, [[112, 108], [112, 140]], { spacing: 3, r: 0.6 });
    slits(ctx, [[104, 60], [106, 80]], { len: 3, gap: 3, ang: 2.6 });
  });
  const arm = (id, x, far) => {
    const d = far ? -1 : 1;
    const up = tube([[x, 160], [x + 26 * d, 212], [x + 44 * d, 262]], [9, 6.5, 5.5]);
    const fo = tube([[x + 44 * d, 260], [x + 74 * d, 300], [x + 100 * d, 330]], [5.5, 4.4, 4.2]);
    const fingers = [0, 1, 2, 3].map((k) => tube([[x + 100 * d, 330], [x + (112 + k * 2) * d, 344 + k * 4], [x + (118 + k * 3) * d, 360 + k * 6]], [2.4, 1.8, 0.7]));
    const a = piece(N + id, [up], (ctx) => { hide(ctx, up); trim(ctx, up, { d: 2.4, sp: 3, r: 0.55 }); spiral(ctx, x + 2, 172, 5, { turns: 1.6 }); dots(ctx, [[x + 4 * d, 172], [x + 40 * d, 254]], { spacing: 3.2, r: 0.55 }); if (far) dye(ctx, poly(up), '#000', 0.3); else knot(ctx, x, 164, 2); });
    const b = piece(N + id + '2', [fo, ...fingers], (ctx) => { hide(ctx, fo); trim(ctx, fo, { d: 2, g: 1, sp: 3, r: 0.5 }); for (const f of fingers) hide(ctx, f); dots(ctx, [[x + 50 * d, 268], [x + 96 * d, 326]], { spacing: 3.2, r: 0.55 }); if (!far) knot(ctx, x + 44 * d, 262, 1.8); });
    return { a, b, j: [x, 164], k: [x + 44 * d, 262] };
  };
  const leg = (id, x, far) => {
    const th = tube([[x, 316], [x + 2, 400], [x + 2, 470]], [11, 7.5, 6]);
    const sh = tube([[x + 2, 468], [x, 540], [x + 2, 596]], [6, 4.8, 4.6]);
    const foot = tube([[x - 4, 598], [x + 14, 600], [x + 30, 602]], [5, 4, 2]);
    const t = piece(N + id, [th], (ctx) => { hide(ctx, th); trim(ctx, th, { d: 2.6, sp: 3, r: 0.55 }); spiral(ctx, x, 334, 6, { turns: 1.6 }); dots(ctx, [[x + 1, 330], [x + 2, 460]], { spacing: 3.4, r: 0.55 }); if (far) dye(ctx, poly(th), '#000', 0.3); else knot(ctx, x, 320, 2); });
    const s = piece(N + id + '2', [sh, foot], (ctx) => { hide(ctx, sh); trim(ctx, sh, { d: 2, g: 1, sp: 3, r: 0.5 }); hide(ctx, foot); dots(ctx, [[x + 1, 480], [x + 1, 590]], { spacing: 3.4, r: 0.55 }); if (!far) knot(ctx, x + 2, 470, 1.8); });
    return { t, s, j: [x, 320], k: [x + 2, 470] };
  };
  const aF = arm('-armF', 114, false), aB = arm('-armB', 98, true), lF = leg('-legF', 116, false), lB = leg('-legB', 102, true);
  return makeRig('monster', {
    body: { pc: body, z: 0 },
    head: { pc: head, z: 2, parent: 'body', j: [108, 150], lim: [-0.3, 0.3], stiff: 0.5 },
    armF: { pc: aF.a, z: 4, parent: 'body', j: aF.j, lim: null, stiff: 0.15 },
    armF2: { pc: aF.b, z: 5, parent: 'armF', j: aF.k, lim: [-1.8, 0.2], stiff: 0.2 },
    armB: { pc: aB.a, z: -4, parent: 'body', j: aB.j, lim: null, stiff: 0.15 },
    armB2: { pc: aB.b, z: -5, parent: 'armB', j: aB.k, lim: [-1.8, 0.2], stiff: 0.2 },
    legF: { pc: lF.t, z: 2, parent: 'body', j: lF.j, lim: [-0.8, 0.8], stiff: 0.5 },
    legF2: { pc: lF.s, z: 3, parent: 'legF', j: lF.k, lim: [-0.1, 1.8], stiff: 0.5 },
    legB: { pc: lB.t, z: -2, parent: 'body', j: lB.j, lim: [-0.8, 0.8], stiff: 0.5 },
    legB2: { pc: lB.s, z: -3, parent: 'legB', j: lB.k, lim: [-0.1, 1.8], stiff: 0.5 },
  }, {
    sound: 'ghost',
    gait: [{ part: 'legF', amp: 0.25, phase: 0 }, { part: 'legB', amp: 0.25, phase: 0.5 }, { part: 'armF', amp: 0.2, phase: 0.5 }, { part: 'armB', amp: 0.2, phase: 0 }, { part: 'head', amp: 0.1, phase: 0.25 }],
    limbs: { head: 'head', torso: 'body', armF: ['armF', 'armF2'], armB: ['armB', 'armB2'], legF: ['legF', 'legF2'], legB: ['legB', 'legB2'] },
  });
}

// ผีตาโขน — Phi Ta Khon: huge painted mask with a hooked nose and horns,
// patchwork costume, dangling cowbells.
function phiTaKhon() {
  const N = 'phi-ta-khon';
  const cost = shape([[80, 160], [130, 156], [150, 200], [150, 280], [60, 284], [60, 200]], { wob: 1.5, seed: 100 });
  const body = piece(N + '-body', [cost], (ctx) => {
    hide(ctx, cost);
    const cols = [INK.red, INK.green, INK.yellow, INK.blue, INK.orange];
    for (let k = 0; k < 9; k++) {
      const x = 60 + k * 10;
      dye(ctx, poly([[x, 160], [x + 10, 160], [x + 12, 286], [x - 2, 286]]), cols[k % 5], 0.75);
      dotLine(ctx, [[x + 1, 170], [x + 4, 280]], { spacing: 3, r: 0.6 });
    }
    trim(ctx, cost, { rows: 2, seed: 101 });
    for (let x = 64; x < 150; x += 6) cut(ctx, poly([[x, 284], [x + 3, 294], [x + 6, 284]]));
    strap(ctx, [[60, 240], [105, 246], [150, 240]], 7, { color: INK.gold, seed: 102 });
  });
  const mask = shape([[40, 150], [30, 100], [44, 60], [80, 40], [120, 44], [150, 70], [160, 110], [150, 150], [120, 170], [80, 170]], { wob: 1.2, seed: 103 });
  const hat = shape([[50, 56], [80, 0], [96, -20], [110, 2], [130, 48]], { t: 0.4, wob: 0.6, seed: 104 });
  const nose = tube([[140, 96], [168, 104], [188, 124], [184, 142]], [9, 8, 5, 2]);
  const horns = [tube([[60, 60], [30, 40], [14, 12]], [8, 5, 1]), tube([[130, 56], [150, 30], [160, 6]], [7, 4, 1])];
  const head = piece(N + '-mask', [mask, hat, nose, ...horns], (ctx) => {
    for (const h of horns) { hide(ctx, h); dye(ctx, poly(inset(h, 1)), INK.cream, 0.8); }
    hide(ctx, hat);
    dye(ctx, poly(inset(hat, 1.5)), INK.orange, 0.7);
    for (let y = 50; y > -10; y -= 7) slits(ctx, [[60 + (50 - y) * 0.4, y], [124 - (50 - y) * 0.4, y]], { len: 3, gap: 3, ang: 1.2 });
    hide(ctx, mask);
    field(ctx, mask, INK.red, { d: 3 });
    // swirling painted patterns
    swirlFlames(ctx, 70, 120, 14, Math.PI * 0.8, { n: 3, len: 30, spin: 1, seed: 105, fill: INK.green });
    swirlFlames(ctx, 120, 70, 11, -1.2, { n: 3, len: 24, spin: -1, seed: 106, fill: INK.yellow });
    trim(ctx, mask, { rows: 2, seed: 107 });
    eye(ctx, 118, 96, 10, { style: 'bulge' });
    gold(ctx, [[102, 82], [118, 78], [136, 84]], 1.4);
    const mouth = shape([[110, 140], [146, 134], [140, 150], [114, 152]], { t: 0.3, wob: 0.3 });
    cut(ctx, poly(mouth));
    for (let k = 0; k < 5; k++) dye(ctx, poly([[116 + k * 6, 139], [121 + k * 6, 139], [118 + k * 6, 146]]), INK.cream, 1);
    hide(ctx, nose);
    field(ctx, nose, INK.yellow, { d: 1.6, alpha: 0.8 });
    dots(ctx, path([[144, 96], [168, 102], [184, 122]]), { r: 0.7 });
    knot(ctx, 104, 164, 3);
  });
  const arm = (id, x, far, hold) => {
    const a = tube([[x, 176], [x + 22, 206], [x + 30, 232]], [9, 7, 6]);
    const b = tube([[x + 30, 230], [x + 50, 214], [x + 64, 196]], [6, 5, 5]);
    const sword = hold ? tube([[x + 64, 196], [x + 90, 150], [x + 110, 110]], [3, 2.6, 1]) : null;
    const pa = piece(N + id, [a], (ctx) => { hide(ctx, a); dye(ctx, poly(inset(a, 1.5)), INK.green, 0.7); trim(ctx, a, { seed: 108 }); if (far) dye(ctx, poly(a), '#000', 0.3); else knot(ctx, x, 180, 2.4); });
    const pb = piece(N + id + '2', sword ? [b, sword] : [b], (ctx) => {
      if (sword) { hide(ctx, sword); dye(ctx, poly(inset(sword, 0.6)), INK.brown, 0.7); gold(ctx, path([[x + 66, 192], [x + 108, 112]]), 0.5); }
      hide(ctx, b); dye(ctx, poly(inset(b, 1.2)), INK.red, 0.7); dots(ctx, path([[x + 32, 228], [x + 62, 198]]), { r: 0.6 });
      if (!far) knot(ctx, x + 30, 232, 2);
    });
    return { pa, pb, j: [x, 180], k: [x + 30, 232] };
  };
  const aF = arm('-armF', 120, false, true), aB = arm('-armB', 80, true, false);
  const leg = (id, x, far) => {
    const o = tube([[x, 276], [x + 2, 330], [x, 372]], [11, 8, 7]);
    const foot = tube([[x - 6, 376], [x + 20, 378]], [5, 4]);
    return { pc: piece(N + id, [o, foot], (ctx) => { hide(ctx, o); hide(ctx, foot); dye(ctx, poly(inset(o, 1.5)), INK.blue, 0.6); trim(ctx, o, { seed: 109 }); if (far) dye(ctx, poly(o), '#000', 0.3); else knot(ctx, x, 280, 2.4); }), j: [x, 280] };
  };
  const lF = leg('-legF', 118, false), lB = leg('-legB', 90, true);
  const bell = (id, x) => {
    const rope = tube([[x, 244], [x, 262]], [1.2, 1.2]);
    const b = shape([[x - 7, 262], [x + 7, 262], [x + 9, 280], [x - 9, 280]], { t: 0.3, wob: 0.2 });
    return { pc: piece(N + id, [rope, b], (ctx) => { hide(ctx, rope); hide(ctx, b); field(ctx, b, INK.gold, { d: 1.5, alpha: 0.8 }); hole(ctx, x, 272, 1.2); knot(ctx, x, 245, 1.4); }), j: [x, 245] };
  };
  const b1 = bell('-bell1', 76), b2 = bell('-bell2', 136);
  return makeRig('monster', {
    body: { pc: body, z: 0 },
    head: { pc: head, z: 3, parent: 'body', j: [104, 164], lim: [-0.3, 0.3], stiff: 0.6 },
    armF: { pc: aF.pa, z: 4, parent: 'body', j: aF.j, lim: null, stiff: 0.2 },
    armF2: { pc: aF.pb, z: 5, parent: 'armF', j: aF.k, lim: [-1.8, 0.4], stiff: 0.25 },
    armB: { pc: aB.pa, z: -4, parent: 'body', j: aB.j, lim: null, stiff: 0.2 },
    armB2: { pc: aB.pb, z: -5, parent: 'armB', j: aB.k, lim: [-1.8, 0.4], stiff: 0.25 },
    legF: { pc: lF.pc, z: 1, parent: 'body', j: lF.j, lim: [-0.8, 0.8], stiff: 0.5 },
    legB: { pc: lB.pc, z: -1, parent: 'body', j: lB.j, lim: [-0.8, 0.8], stiff: 0.5 },
    bell1: { pc: b1.pc, z: 2, parent: 'body', j: b1.j, lim: null, stiff: 0.05 },
    bell2: { pc: b2.pc, z: 2, parent: 'body', j: b2.j, lim: null, stiff: 0.05 },
  }, {
    sound: 'ghost',
    gait: [{ part: 'legF', amp: 0.35, phase: 0 }, { part: 'legB', amp: 0.35, phase: 0.5 }, { part: 'armF', amp: 0.3, phase: 0.5 }, { part: 'armB', amp: 0.3, phase: 0 }, { part: 'head', amp: 0.12, phase: 0 }],
    limbs: { head: 'head', torso: 'body', armF: ['armF', 'armF2'], armB: ['armB', 'armB2'], legF: ['legF'], legB: ['legB'] },
  });
}

function hem(ctx, pts, size) { krajangRow(ctx, pts.slice().reverse(), size, { color: INK.gold, inner: INK.red }); }

export const PROPS = [
  { id: 'phaya-nak', name: 'พญานาค', en: 'Five-headed naga', cat: 'monsters', build: naga },
  { id: 'mangkon', name: 'มังกร', en: 'Dragon', cat: 'monsters', build: dragon },
  { id: 'krasue', name: 'ผีกระสือ', en: 'Krasue — floating head spirit', cat: 'monsters', build: krasue },
  { id: 'khrut', name: 'ครุฑ', en: 'Garuda', cat: 'monsters', build: garuda },
  { id: 'pret', name: 'เปรต', en: 'Pret — hungry ghost', cat: 'monsters', build: pret },
  { id: 'phi-ta-khon', name: 'ผีตาโขน', en: 'Phi Ta Khon spirit', cat: 'monsters', build: phiTaKhon },
];
