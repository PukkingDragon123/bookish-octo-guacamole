// ช้างเอราวัณ — Erawan (ไอราวัณ), Indra's white elephant of the
// Tavatimsa heaven, cut as หนังตะลุง leather. Of its thirty-three heads
// the leather shows three, fanned forward like the mural Erawans: each
// wears a gold net headdress and a tall ชฎา crown with กรรเจียก flares,
// carries a pair of gilded tusks and swings its own segmented trunk. The
// hide is pale cream (it glows white on the lamp-lit screen) under a gold
// and lac-red caparison (เครื่องทรง) with lotus medallions, krajang hems
// and lace cut-work, and on its back rides a gilded บุษบก pavilion.
//
// Built with the figure-coordinate toolkit of animals.js (see its header):
// authored facing right, ground at the bottom, near limbs z > 0, far z < 0.

import {
  INK, dye, line, gold, hole, holes, dotLine, dotFill, slit, cut, prajamYam, krajangRow, lotusRow, poly, inset, resample,
} from '../art/leather.js';
import {
  shape, path, tube, offset, move, piece, makeRig, hide, trim, field, dots, spiral, lozenges, strap, flowers,
  beastEye, kanok, knot, rosette, swirlFlames, tuftPts, tuft, ink,
} from './animals.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
// ivory hide: dense enough to read as a body on the lit cloth, glowing warm white
const PALE = '#f1e5c6';
const CREAM = INK.cream;

// krajang lace hem hanging down from a left -> right baseline
const hem = (ctx, pts, size, o = {}) => krajangRow(ctx, pts.slice().reverse(), size, { color: INK.gold, inner: INK.red, ...o });

// pale hide: leather, white dye, gold contour and lace rows
function paleHide(ctx, pts, { rows = 2, seed = 1, d = 3.4, gap = 3, r = 0.72, sp = 3.4, alpha = 0.86 } = {}) {
  hide(ctx, pts);
  field(ctx, pts, PALE, { d: 1.6, alpha, edge: false });
  trim(ctx, pts, { rows, seed, d, gap, r, sp });
}

// Broad elephant foot with pale toenails and a jewelled anklet.
function padFoot(ctx, x, y, w, h) {
  const pts = shape([[x - w * 0.5, y - h], [x + w * 0.52, y - h], [x + w * 0.62, y - h * 0.3], [x + w * 0.56, y], [x - w * 0.56, y], [x - w * 0.6, y - h * 0.35]], { t: 0.3, wob: 0.3 });
  hide(ctx, pts);
  dye(ctx, poly(inset(pts, 1)), PALE, 0.8);
  for (let k = 0; k < 3; k++) {
    const p = new Path2D();
    p.ellipse(x + w * (0.05 + k * 0.2), y - h * 0.32, w * 0.085, h * 0.3, 0, 0, TAU);
    dye(ctx, p, INK.goldLine, 0.9);
    gold(ctx, p, 0.5);
  }
}

// Two-piece pale leg with a gold anklet (กำไลข้อเท้า) and lotus cuff.
function leg(name, { up, upR, lo, loR, far = false, seed = 1 }) {
  const uo = tube(up, upR);
  const lo2 = tube(lo, loR);
  const end = lo[lo.length - 1];
  const gy = end[1] + loR[loR.length - 1] * 0.75;
  const joint = [up[0][0], up[0][1] + upR[0] * 0.45];
  const fw = 56, fh = 14;
  const upper = piece(name + '-u', [uo], (ctx) => {
    paleHide(ctx, uo, { rows: 1, seed, d: 3.1 });
    const sp = path(up);
    dots(ctx, sp.slice(Math.floor(sp.length * 0.3), -3), { spacing: 3.2, r: 0.7, seed: seed + 3, smoothIt: false });
    for (let i = 0; i < 3; i++) gold(ctx, [[up[0][0] - upR[0] * 0.5 + i * 7, up[0][1] + 14], [up[1][0] - upR[1] * 0.5 + i * 7, up[1][1] + 6]], 0.5);
    if (far) dye(ctx, poly(uo), '#000', 0.26);
    else knot(ctx, joint[0], joint[1], 2.6);
  });
  const lower = piece(name + '-l', [lo2, [[end[0] - fw * 0.8, gy - fh - 2], [end[0] + fw * 0.7, gy + 3]]], (ctx) => {
    paleHide(ctx, lo2, { rows: 1, seed: seed + 5, d: 2.8 });
    padFoot(ctx, end[0], gy, fw, fh);
    // anklet: gold band with a bell fringe and a lotus cuff above
    const sp = path(lo);
    const at = (t) => sp[Math.min(sp.length - 2, Math.floor((sp.length - 1) * t))];
    const p = at(0.72), q = at(0.5);
    const rr = lerp(loR[0], loR[loR.length - 1], 0.72) * 0.98;
    const band = [[p[0] - rr, p[1] - 4], [p[0] + rr, p[1] - 2]];
    line(ctx, band, INK.gold, 7, { smoothIt: false });
    gold(ctx, move(band, 0, -3.6), 0.6, { smoothIt: false });
    gold(ctx, move(band, 0, 3.6), 0.6, { smoothIt: false });
    for (let i = 0; i < 5; i++) {
      const x = p[0] - rr * 0.8 + i * rr * 0.4;
      rosette(ctx, x, p[1] - 3 + i * 0.4, 2.2, { petals: 5, color: INK.gold, inner: INK.red });
      hole(ctx, x, p[1] + 4.5 + i * 0.4, 1.2);
    }
    lotusRow(ctx, [[q[0] - rr * 0.95, q[1] + 2], [q[0] + rr * 0.95, q[1] + 4]], 6, { color: INK.gold });
    if (far) dye(ctx, poly(lo2), '#000', 0.26);
    else knot(ctx, lo[0][0], lo[0][1], 2.4);
  });
  return { upper, lower, knee: lo[0], joint };
}

function legJoints(id, L, z, zl) {
  return {
    [id]: { pc: L.upper, z, parent: 'body', j: L.joint, lim: [-0.5, 0.5], stiff: 0.7 },
    [id + '2']: { pc: L.lower, z: zl, parent: id, j: L.knee, lim: [-0.9, 0.9], stiff: 0.7 },
  };
}

// ชฎา crown standing on the head dome (base centred at x, y): a jewelled
// diadem, five swelling tiers and a slender spire swept back, with
// กรรเจียก ear flares behind.
function chada(ctx, x, y, h, { lean = 0.2, seed = 1 } = {}) {
  const k = h / 72;
  const side = [[15, 0], [14, -7], [11.5, -10], [12, -16], [9.5, -19], [10, -25], [7.6, -28], [8, -34], [5.8, -37], [6, -43], [4, -46], [3.6, -54], [1.8, -62], [0, -72]];
  const P = (u, v) => [x + u * k + lean * v * k, y + v * k];
  const crown = [...side.map(([u, v]) => P(-u, v)), ...side.slice(0, -1).reverse().map(([u, v]) => P(u, v))];
  // กรรเจียก: a tall flame ear-flare sweeping back and down from the diadem
  kanok(ctx, ...P(-15, 12), 30 * k, Math.PI * 0.72, true, { color: INK.gold });
  kanok(ctx, ...P(-13, 6), 18 * k, Math.PI * 0.86, true, { color: INK.red });
  // little flames climbing both sides of the spire
  [[-10, 12], [-19, 10], [-28, 8], [-37, 6.2]].forEach(([v, w], i) => {
    const sz = (9 - i * 1.2) * k;
    kanok(ctx, ...P(-w - 1, v + 2), sz, -Math.PI / 2 - 0.9, true, { color: i % 2 ? INK.green : INK.red });
    kanok(ctx, ...P(w + 1, v + 2), sz, -Math.PI / 2 + 0.9, false, { color: i % 2 ? INK.green : INK.red });
  });
  hide(ctx, crown);
  dye(ctx, poly(inset(crown, 0.8)), INK.gold, 0.92);
  gold(ctx, poly(crown), 0.6, { smoothIt: false });
  // tier rings: alternating lac red and malachite, each with a bead row
  [[-10, 11.5], [-19, 9.5], [-28, 7.6], [-37, 5.8], [-46, 4]].forEach(([v, w], i) => {
    const a = P(-w, v), b = P(w, v);
    line(ctx, [a, b], i % 2 ? INK.green : INK.red, 3.2 * k, { smoothIt: false });
    gold(ctx, [P(-w, v - 1.8), P(w, v - 1.8)], 0.5, { smoothIt: false });
    dots(ctx, [P(-w + 2, v + 3), P(w - 2, v + 3)], { spacing: 2.8, r: 0.6, smoothIt: false, seed: seed + i });
  });
  // diadem with a ประจำยาม jewel
  const db = [P(-16, 3), P(0, -1), P(16, 3)];
  line(ctx, db, INK.gold, 6 * k);
  gold(ctx, db, 0.6);
  prajamYam(ctx, ...P(0, 1), 5 * k, { color: INK.red, petal: INK.goldLine });
  const [tx, ty] = P(0, -66);
  hole(ctx, tx, ty, 0.9);
  return crown;
}

// One of the three heads, with its trunk segments and tusks. dx, dy shift
// the authored near-head drawing; depth 0 = near, 1 = middle, 2 = far.
function head(N, dx, dy, depth) {
  const tag = ['', '-b', '-c'][depth];
  const shade = [0, 0.07, 0.14][depth];
  const headPts = shape([[258, 92], [274, 74], [296, 60], [320, 53], [343, 57], [361, 70], [375, 92], [385, 122], [390, 150], [391, 172], [383, 190], [370, 199], [354, 201], [342, 197], [330, 205], [312, 201], [294, 186], [276, 170], [262, 142]], { wob: 0.8, seed: 300 + depth });
  const earPts = shape([[322, 94], [300, 88], [280, 96], [270, 120], [274, 156], [286, 186], [302, 212], [314, 214], [318, 196], [326, 160], [330, 122]], { t: 0.45, wob: 0.8, seed: 315 });
  const crownBox = [[284, -24], [352, 66]];
  const M = (pts) => move(pts, dx, dy);
  const hd = piece(N + '-head' + tag, [M(headPts), M(crownBox)], (ctx) => {
    ctx.translate(dx, dy);
    paleHide(ctx, headPts, { rows: 3, seed: 316 + depth, d: 3.6, gap: 3.1, r: 0.78 });
    beastEye(ctx, 348, 112, 5, { angle: 0.35 });
    ink(ctx, [[336, 104], [346, 102], [358, 108]], 0.8);
    spiral(ctx, 334, 132, 9, { seed: 317, dir: 1 });
    // gold net headdress over the domes
    const net = shape([[296, 66], [322, 56], [344, 60], [362, 74], [374, 98], [382, 126], [372, 130], [352, 96], [330, 78], [304, 80]], { t: 0.4, wob: 0.2 });
    dye(ctx, poly(net), INK.gold, 0.7);
    gold(ctx, poly(net), 0.8);
    ctx.save();
    ctx.clip(poly(inset(net, 1.5)));
    for (let k = -8; k < 12; k++) {
      gold(ctx, [[280 + k * 9, 40], [360 + k * 9, 140]], 0.6, { smoothIt: false });
      gold(ctx, [[380 + k * 9, 40], [300 + k * 9, 140]], 0.6, { smoothIt: false });
    }
    ctx.restore();
    dotFill(ctx, poly(inset(net, 2)), [292, 52, 384, 134], { pattern: 'diamond', spacing: 6.4, r: 0.95, seed: 318 });
    krajangRow(ctx, [[372, 132], [352, 98], [330, 80], [302, 82]], 6, { color: INK.gold, inner: INK.red });
    // forehead pendant (red jewel drop) down the trunk root
    const pend = shape([[364, 120], [374, 118], [384, 150], [378, 166], [370, 152]], { t: 0.35, wob: 0.2 });
    dye(ctx, poly(pend), INK.red, 0.92);
    gold(ctx, poly(pend), 0.7);
    rosette(ctx, 371, 124, 4.4);
    hole(ctx, 377, 152, 1.3);
    // cheek strap with bells
    strap(ctx, [[300, 84], [318, 140], [334, 196]], 7, { color: INK.red, seed: 319 });
    for (const [x, y] of [[306, 104], [314, 128], [322, 152], [330, 176]]) rosette(ctx, x, y, 2.8, { petals: 6 });
    slit(ctx, [[362, 196], [352, 192], [344, 196]], 0.8);
    chada(ctx, 332, 58, 74 - depth * 4, { seed: 320 + depth });
    if (depth === 0) cut(ctx, poly(inset(earPts, 10)));
    else dye(ctx, poly(headPts), '#000', shade);
    knot(ctx, 270, 140, 3.4);
  });

  const tr = [
    { s: [[376, 158], [388, 194], [396, 230]], r: [24, 20.5, 17.5] },
    { s: [[396, 226], [401, 246], [404, 266]], r: [17.5, 15.5, 14] },
    { s: [[404, 262], [406, 282], [406, 300]], r: [14, 12.5, 11] },
    { s: [[406, 296], [406, 318], [410, 336], [420, 344], [430, 338], [430, 330]], r: [11, 9.5, 8, 6.5, 5, 4] },
  ];
  // back heads have a shorter cascade: three segments ending in a curl
  if (depth) {
    tr.length = 3;
    tr[2] = { s: [[404, 262], [405, 282], [410, 298], [420, 304], [428, 298], [427, 290]], r: [14, 12, 10, 8, 6, 4.5] };
  }
  const trunk = tr.map((t, i) => {
    const o = tube(t.s, t.r);
    return piece(N + '-trunk' + tag + (i + 1), [M(o)], (ctx) => {
      ctx.translate(dx, dy);
      paleHide(ctx, o, { rows: 1, seed: 330 + i + depth * 9, d: 2.8, r: 0.66 });
      const sp = path(t.s);
      for (let k = 3; k < sp.length - 3; k += 3) {
        const p = sp[k], q = sp[k + 1];
        const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2;
        const rr = lerp(t.r[0], t.r[t.r.length - 1], k / sp.length) * 0.62;
        slit(ctx, [[p[0] - Math.cos(a) * rr, p[1] - Math.sin(a) * rr], [p[0] + Math.cos(a) * rr * 0.2, p[1] + Math.sin(a) * rr * 0.2 + 1.2], [p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr]], 0.7);
      }
      // gold trunk rings with a bead row
      if (i < 2) {
        const p0 = t.s[0], r0 = t.r[0];
        const b = [[p0[0] - r0 * 0.9, p0[1] + 9], [p0[0] + r0 * 0.9, p0[1] + 13]];
        line(ctx, b, INK.gold, 4.4, { smoothIt: false });
        gold(ctx, move(b, 0, -2.4), 0.5, { smoothIt: false });
        dots(ctx, b, { spacing: 3, r: 0.8, smoothIt: false });
      }
      if (depth) dye(ctx, poly(o), '#000', shade);
      knot(ctx, t.s[0][0], t.s[0][1] + 4, 2.8);
    });
  });

  // a pair of tusks per head: near one bright, the far one behind it
  const ts = [[366, 190], [384, 205], [404, 211], [424, 203]];
  const ts2 = move(ts, -7, -5).map(([x, y], i) => [x - i * 1.5, y - i * 1.2]);
  const tuskN = tube(ts, [5.2, 4.8, 3.4, 1.1]);
  const tuskF = tube(ts2, [4.6, 4.2, 3, 1]);
  const tusk = piece(N + '-tusk' + tag, [M(tuskN), M(tuskF)], (ctx) => {
    ctx.translate(dx, dy);
    for (const [o, spine, dim] of [[tuskF, ts2, 0.25], [tuskN, ts, 0]]) {
      hide(ctx, o);
      dye(ctx, poly(inset(o, 0.9)), CREAM, 0.92);
      const sp = path(spine);
      for (const t of [0.16, 0.4]) {
        const p = sp[Math.floor(t * sp.length)];
        gold(ctx, [[p[0] - 2, p[1] - 5], [p[0] + 1, p[1] + 5]], 2.2, { smoothIt: false });
        hole(ctx, p[0] + 3.4, p[1], 0.7);
      }
      const e = spine[spine.length - 2], f = spine[spine.length - 1];
      dye(ctx, poly(tube([[lerp(e[0], f[0], 0.3), lerp(e[1], f[1], 0.3)], f], [3, 1.1])), INK.gold, 0.95);
      if (dim || depth) dye(ctx, poly(o), '#000', dim + shade);
    }
  });

  const J = (p) => [p[0] + dx, p[1] + dy];
  return {
    head: hd, trunk, tusk, ear: depth === 0 ? earPts : null,
    joints: { head: J([270, 140]), trunk: [J([376, 162]), J([396, 230]), J([404, 266]), J([406, 300])], tusk: J([368, 191]) },
  };
}

function erawan() {
  const N = 'erawan';
  const bodyPts = shape([[40, 122], [58, 94], [100, 76], [160, 66], [220, 70], [256, 82], [270, 100], [273, 140], [271, 182], [266, 222], [252, 250], [220, 262], [170, 265], [124, 262], [98, 250], [76, 254], [52, 240], [36, 202], [32, 158]], { wob: 1.2, seed: 401 });
  const clothPts = shape([[116, 70], [180, 62], [244, 70], [252, 110], [250, 200], [184, 212], [120, 202], [108, 120]], { t: 0.4, wob: 0.6, seed: 402 });
  const body = piece(N + '-body', [bodyPts], (ctx) => {
    paleHide(ctx, bodyPts, { rows: 3, seed: 404, d: 3.8, sp: 3.5, r: 0.8, gap: 3.2 });
    const back = path([[50, 110], [100, 86], [160, 78], [220, 82], [256, 96]]);
    gold(ctx, back, 0.8, { smoothIt: false });
    swirlFlames(ctx, 250, 222, 17, Math.PI + 0.1, { n: 3, len: 38, spin: -1, seed: 405 });
    swirlFlames(ctx, 66, 196, 20, -0.1, { n: 3, len: 42, spin: 1, seed: 406 });
    for (let i = 0; i < 3; i++) gold(ctx, [[50 + i * 9, 140], [46 + i * 9, 190], [56 + i * 9, 236]], 0.5);
    // lace cut-work flowers over the haunch and belly
    flowers(ctx, [[44, 120], [104, 96], [104, 232], [44, 226]], 9, { seed: 414, inner: 4, minD: 15, r: 0.85 });
    // breast collar (กรองศอ) at the chest
    const collar = shape([[252, 86], [272, 110], [276, 160], [268, 214], [258, 210], [262, 160], [256, 112], [240, 92]], { t: 0.4, wob: 0.2 });
    dye(ctx, poly(collar), INK.gold, 0.9);
    gold(ctx, poly(collar), 0.7);
    dotLine(ctx, inset(collar, 2.4), { closed: true, spacing: 3, r: 0.7, seed: 407, smoothIt: false });
    for (const y of [120, 150, 180]) rosette(ctx, 266, y, 3.6);
    // saddle cloth: gold border, lac-red field, malachite panel, lotus medallions
    dye(ctx, poly(clothPts), INK.gold, 0.95);
    gold(ctx, poly(inset(clothPts, 1.6)), 0.9);
    const c2 = inset(clothPts, 6);
    dye(ctx, poly(c2), INK.crimson, 0.9);
    gold(ctx, poly(c2), 0.7);
    dotLine(ctx, inset(clothPts, 3.4), { closed: true, spacing: 3.2, r: 0.8, seed: 408, smoothIt: false });
    const c3 = inset(clothPts, 15);
    dye(ctx, poly(c3), INK.green, 0.8);
    gold(ctx, poly(c3), 0.6);
    const c4 = inset(clothPts, 20);
    dye(ctx, poly(c4), INK.red, 0.88);
    gold(ctx, poly(c4), 0.5);
    dotFill(ctx, poly(inset(c4, 3)), [120, 70, 250, 210], { pattern: 'flowers', spacing: 11, r: 0.8, seed: 409 });
    for (const [x, y] of [[148, 108], [214, 108], [148, 170], [214, 170]]) prajamYam(ctx, x, y, 10, { color: INK.red, petal: INK.gold });
    // central lotus medallion: a ring of petals cut round a gold jewel
    const lc = [181, 139];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      const p = new Path2D();
      p.ellipse(lc[0] + Math.cos(a) * 13, lc[1] + Math.sin(a) * 13, 7, 3.4, a, 0, TAU);
      dye(ctx, p, k % 2 ? INK.pink : INK.gold, 0.95);
      gold(ctx, p, 0.4);
    }
    prajamYam(ctx, lc[0], lc[1], 12, { color: INK.green, petal: INK.goldLine });
    dotLine(ctx, Array.from({ length: 48 }, (_, i) => [lc[0] + Math.cos(i / 48 * TAU) * 22, lc[1] + Math.sin(i / 48 * TAU) * 22]), { closed: true, spacing: 3.4, r: 0.8, smoothIt: false });
    hem(ctx, [[120, 202], [184, 212], [250, 200]], 10);
    // jewelled tassels below the hem
    for (const x of [130, 158, 186, 214, 240]) {
      dots(ctx, [[x, 214], [x, 236]], { spacing: 2.8, r: 0.75, smoothIt: false });
      rosette(ctx, x, 240, 3);
    }
    // girth strap and crupper
    strap(ctx, [[110, 120], [100, 180], [96, 246]], 7, { color: INK.red, seed: 410 });
    strap(ctx, [[110, 104], [76, 112], [46, 128]], 6, { color: INK.red, seed: 411 });
    lotusRow(ctx, [[120, 72], [180, 64], [242, 72]], 9, { color: INK.gold });
    knot(ctx, 270, 140, 3);
  });

  // บุษบก — gilded pavilion on the back, with a seated green Indra
  const bsPts = shape([[124, 74], [128, 58], [140, 54], [140, 20], [132, 14], [150, 4], [160, -16], [170, -40], [180, -60], [184, -80], [186, -98], [188, -80], [192, -60], [204, -40], [214, -16], [224, 4], [242, 14], [234, 20], [234, 54], [246, 58], [250, 74]], { t: 0.3, wob: 0.2, seed: 412 });
  const busabok = piece(N + '-busabok', [bsPts], (ctx) => {
    hide(ctx, bsPts);
    dye(ctx, poly(inset(bsPts, 1.2)), INK.gold, 0.85);
    trim(ctx, bsPts, { d: 3, r: 0.7, seed: 413 });
    // base (ฐานสิงห์) with lotus petals
    line(ctx, [[130, 64], [244, 64]], INK.red, 6, { smoothIt: false });
    dots(ctx, [[132, 64], [242, 64]], { spacing: 3.4, r: 0.85, smoothIt: false });
    lotusRow(ctx, [[134, 58], [240, 58]], 8, { color: INK.green });
    // columns and the cut-out bays between them (lamp light shows through)
    for (const x of [144, 184, 224]) {
      line(ctx, [[x + 4, 54], [x + 4, 22]], INK.red, 5, { smoothIt: false });
      gold(ctx, [[x + 1.5, 54], [x + 1.5, 22]], 0.5, { smoothIt: false });
      gold(ctx, [[x + 6.5, 54], [x + 6.5, 22]], 0.5, { smoothIt: false });
    }
    for (const [x0, x1] of [[150, 186], [190, 226]]) {
      const bay = [[x0, 54], [x0, 30], [x0 + 6, 26], [(x0 + x1) / 2, 22], [x1 - 6, 26], [x1, 30], [x1, 54]];
      cut(ctx, poly(bay));
    }
    // seated Indra (พระอินทร์), green-skinned, crowned, inside the left bay
    const indra = shape([[156, 54], [160, 44], [164, 40], [166, 34], [170, 31], [171, 24], [168, 18], [170, 6], [172, 18], [176, 24], [177, 31], [182, 35], [184, 42], [182, 48], [186, 54]], { t: 0.35, wob: 0 });
    hide(ctx, indra);
    dye(ctx, poly(inset(indra, 0.8)), INK.green, 0.9);
    dye(ctx, poly([[166, 34], [178, 34], [182, 48], [162, 48]]), INK.red, 0.8);
    gold(ctx, poly(indra), 0.5, { smoothIt: false });
    hole(ctx, 175, 27, 0.7);
    // vajra-like flame jewel in the right bay
    kanok(ctx, 208, 52, 22, -Math.PI / 2, false, { color: INK.red });
    // tiered roof: three tiers with krajang crests and ช่อฟ้า hooks
    for (let i = 0; i < 3; i++) {
      const y = 14 - i * 20, w = 50 - i * 12;
      const tier = [[187 - w, y + 6], [187 - w * 0.7, y - 8], [187 + w * 0.7, y - 8], [187 + w, y + 6]];
      line(ctx, tier, i % 2 ? INK.green : INK.red, 6, { smoothIt: false });
      gold(ctx, tier, 0.6, { smoothIt: false });
      krajangRow(ctx, [[187 - w * 0.62, y - 9], [187 + w * 0.62, y - 9]], 6, { color: INK.gold, inner: INK.red });
      kanok(ctx, 187 - w - 2, y + 4, 8, -2.4, true, { color: INK.gold });
      kanok(ctx, 187 + w + 2, y + 4, 8, -0.7, false, { color: INK.gold });
    }
    // spire rings and the gem at the tip
    for (let i = 0; i < 4; i++) {
      const y = -46 - i * 10, w = 8 - i * 1.4;
      gold(ctx, [[186 - w, y], [186 + w, y]], 1.2, { smoothIt: false });
      if (i % 2) dots(ctx, [[186 - w + 1.5, y - 4], [186 + w - 1.5, y - 4]], { spacing: 2.6, r: 0.55, smoothIt: false });
    }
    hole(ctx, 186, -88, 1.2);
    knot(ctx, 187, 66, 2.6);
  });

  const H = [head(N, 64, -36, 2), head(N, 32, -18, 1), head(N, 0, 0, 0)];
  const near = H[2];
  const ear = piece(N + '-ear', [near.ear], (ctx) => {
    const earPts = near.ear;
    paleHide(ctx, earPts, { rows: 2, seed: 422, d: 3.2, r: 0.75 });
    const inner = inset(earPts, 10);
    dye(ctx, poly(inner), INK.red, 0.85);
    gold(ctx, poly(inner), 0.7);
    dotLine(ctx, inset(earPts, 12.5), { closed: true, spacing: 3, r: 0.65, seed: 423, smoothIt: false });
    for (let k = 0; k < 5; k++) {
      const a = 2.1 + k * 0.28;
      const L = 60 + k * 10;
      const pts = [[318, 104], [318 + Math.cos(a) * L * 0.5 + 6, 104 + Math.sin(a) * L * 0.5], [318 + Math.cos(a) * L, 104 + Math.sin(a) * L]];
      gold(ctx, pts, 0.7);
      dots(ctx, offset(path(pts), 2.2).slice(3), { spacing: 3, r: 0.62, seed: 424 + k, smoothIt: false });
    }
    dotFill(ctx, poly(inset(earPts, 16)), [270, 90, 330, 214], { pattern: 'flowers', spacing: 9, r: 0.72, seed: 429 });
    // gold ear ornament (ตุ้มหู) with a lotus drop
    prajamYam(ctx, 296, 182, 8, { color: INK.red, petal: INK.gold });
    rosette(ctx, 304, 204, 4);
    knot(ctx, 320, 102, 3);
  });

  const mk = (id, up, upR, lo, loR, far, seed) => leg(N + id, { up, upR, lo, loR, far, seed });
  const lFN = mk('-fn', [[268, 226], [270, 262], [271, 300]], [30, 27, 24], [[271, 298], [270, 330], [269, 356]], [23.5, 24, 25], false, 440);
  const lFF = mk('-ff', [[246, 226], [247, 262], [248, 300]], [28, 25, 22], [[248, 298], [247, 330], [246, 356]], [22, 22.5, 23.5], true, 444);
  const lBN = mk('-bn', [[84, 226], [94, 264], [90, 300]], [34, 27, 23], [[90, 298], [88, 330], [87, 356]], [22.5, 23, 24.5], false, 448);
  const lBF = mk('-bf', [[106, 226], [115, 264], [111, 300]], [32, 25, 22], [[111, 298], [109, 330], [108, 356]], [21.5, 22, 23.5], true, 452);

  const tailPts = tube([[40, 128], [30, 168], [25, 210], [26, 240]], [6, 4.4, 3.4, 3]);
  const tP = tuftPts(26, 238, 32, 12, Math.PI / 2 + 0.05, { teeth: 4 });
  const tail = piece(N + '-tail', [tailPts, tP], (ctx) => {
    hide(ctx, tailPts);
    field(ctx, tailPts, PALE, { d: 1, alpha: 0.85, edge: false });
    dots(ctx, path([[38, 134], [29, 176], [26, 230]]), { spacing: 3.3, r: 0.6, smoothIt: false });
    tuft(ctx, tP, 26, 238, 32, Math.PI / 2 + 0.05, { color: INK.red });
    rosette(ctx, 26, 232, 3.6);
  });

  // a jewelled pendant swinging from the collar
  const pend = shape([[272, 214], [282, 214], [286, 236], [277, 256], [268, 236]], { t: 0.4, wob: 0.2, seed: 455 });
  const pendant = piece(N + '-pendant', [pend], (ctx) => {
    hide(ctx, pend);
    dye(ctx, poly(inset(pend, 1)), INK.gold, 0.9);
    gold(ctx, poly(pend), 0.6);
    prajamYam(ctx, 277, 232, 6.5, { color: INK.red, petal: INK.goldLine });
    hole(ctx, 277, 248, 1.3);
  });

  const parts = {
    body: { pc: body, z: 0, mass: 3.4 },
    busabok: { pc: busabok, z: 1, parent: 'body', j: [187, 66], lim: [-0.06, 0.06], stiff: 0.85 },
    pendant: { pc: pendant, z: 1, parent: 'body', j: [277, 216], lim: [-0.5, 0.5], stiff: 0.1 },
    tail: { pc: tail, z: -1, parent: 'body', j: [40, 128], lim: [-0.8, 0.8], stiff: 0.2 },
    ...legJoints('legFR', lFN, 6, 7),
    ...legJoints('legFL', lFF, -3, -2),
    ...legJoints('legBR', lBN, 6, 7),
    ...legJoints('legBL', lBF, -3, -2),
  };
  const gait = [];
  // the three heads: far ones behind the near one, each a little lower in z
  H.forEach((h, i) => {
    const depth = 2 - i; // H[0] is the far head
    const tag = ['', 'B', 'C'][depth];
    const zb = 2 + (2 - depth) * 0.6; // near head on top
    const hid = 'head' + tag;
    parts[hid] = depth === 0
      ? { pc: h.head, z: zb + 0.4, parent: 'body', j: h.joints.head, lim: [-0.25, 0.25], stiff: 0.7 }
      : { pc: h.head, z: zb, parent: 'head', j: h.joints.head, lim: [-0.08, 0.08], stiff: 0.6 };
    let par = hid;
    h.trunk.forEach((pc, k) => {
      const id = 'trunk' + tag + (k + 1);
      parts[id] = { pc, z: zb + 0.45, parent: par, j: h.joints.trunk[k], lim: [[-0.4, 0.5], [-0.6, 0.6], [-0.7, 0.7], [-0.9, 0.9]][k], stiff: [0.45, 0.35, 0.3, 0.25][k] };
      gait.push({ part: id, amp: 0.07 + k * 0.05, phase: k * 0.1 + depth * 0.33 });
      par = id;
    });
    parts['tusk' + tag] = { pc: h.tusk, z: zb + 0.5, parent: hid, j: h.joints.tusk, lim: [-0.02, 0.02], stiff: 1 };
  });
  parts.ear = { pc: ear, z: 3.6, parent: 'head', j: [320, 102], lim: [-0.1, 0.1], stiff: 0.3 };
  gait.push({ part: 'ear', amp: 0.07, phase: 0.25 }, { part: 'tail', amp: 0.2, phase: 0.4 }, { part: 'pendant', amp: 0.12, phase: 0.15 }, { part: 'busabok', amp: 0.02, phase: 0.5 });

  return makeRig('animal', parts, { sound: 'animal-elephant', gait: quadGait(0.18, 0.14, gait) });
}

// Diagonal-pair walk (FR+BL, then FL+BR); lower segments lag a quarter.
function quadGait(amp = 0.32, lower = 0.25, extra = []) {
  const g = [];
  for (const [id, ph] of [['legFR', 0], ['legBL', 0], ['legFL', 0.5], ['legBR', 0.5]]) {
    g.push({ part: id, amp, phase: ph });
    if (lower) g.push({ part: id + '2', amp: lower, phase: ph + 0.25 });
  }
  return [...g, ...extra];
}

export const PROPS = [
  { id: 'erawan', name: 'ช้างเอราวัณ', en: "Erawan, Indra's three-headed elephant", cat: 'animals', build: erawan },
];

void holes; void resample; void lozenges;
