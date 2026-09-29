// Vehicles cut from hide. Each returns an articulated rig whose wheels are
// separate, freely spinning parts (lim: null) so they can roll.

import {
  INK, paintSprite, leather, dye, line, gold, hole, holes, dotLine, slit, cut,
  poly, curve, smooth, ellipsePts, blobPts, inset, kanokPts, prajamYam, dotFlower,
} from '../art/leather.js';
import { TAU, lerp, mix, rectPts, taper, hide, hideS, hideMany, rimDots, edgeDots, age, garland } from './buildings.js';

// A spoked wheel sprite, centre at box (R, R).
function wheelSprite(id, R, { spokes = 12, rim = 0.16, hub = 0.2, color = INK.vermilion, px = 2 } = {}) {
  return paintSprite(R * 2, R * 2, (ctx) => {
    const c = R;
    const outer = ellipsePts(c, c, R, R, 64);
    leather(ctx, smooth(outer));
    // cut the spaces between spokes
    const ri = R * (1 - rim), rh = R * hub;
    const sw = Math.max(2.2, R * 0.06);
    const p = new Path2D();
    for (let k = 0; k < spokes; k++) {
      const a0 = (k / spokes) * TAU, a1 = ((k + 1) / spokes) * TAU;
      const d0 = Math.asin(Math.min(0.9, sw / ri)), d1 = Math.asin(Math.min(0.9, sw / rh));
      const pts = [];
      for (let i = 0; i <= 8; i++) { const a = lerp(a0 + d0, a1 - d0, i / 8); pts.push([c + Math.cos(a) * ri, c + Math.sin(a) * ri]); }
      for (let i = 8; i >= 0; i--) { const a = lerp(a0 + d1, a1 - d1, i / 8); pts.push([c + Math.cos(a) * rh, c + Math.sin(a) * rh]); }
      pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
      p.closePath();
    }
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fill(p); ctx.restore();
    // rim decoration
    const band = new Path2D();
    band.arc(c, c, R - 1.5, 0, TAU); band.arc(c, c, ri + 1.5, 0, TAU, true);
    dye(ctx, band, color, 0.75);
    gold(ctx, ellipsePts(c, c, ri + 1, ri + 1, 48), 0.9, { closed: true });
    dotLine(ctx, ellipsePts(c, c, (R + ri) / 2, (R + ri) / 2, 64), { closed: true, spacing: Math.max(3.2, R * 0.09), r: Math.max(0.8, R * 0.022) });
    const hb = ellipsePts(c, c, rh + 1, rh + 1, 24);
    dye(ctx, smooth(inset(hb, 1.5)), INK.gold, 0.7);
    hole(ctx, c, c, Math.max(1.2, R * 0.05));
    if (rh > 8) dotLine(ctx, ellipsePts(c, c, rh * 0.62, rh * 0.62, 16), { closed: true, spacing: 3, r: 0.75 });
    for (let k = 0; k < spokes; k++) {
      const a = ((k + 0.5) / spokes) * TAU - TAU / spokes / 2;
      gold(ctx, [[c + Math.cos(a) * (rh + 2), c + Math.sin(a) * (rh + 2)], [c + Math.cos(a) * (ri - 2), c + Math.sin(a) * (ri - 2)]], 0.6, { smoothIt: false });
    }
  }, { name: id, pad: 3, px });
}

function vehicleRig(body, wheels) {
  const parts = { body: { sprite: body, z: 0 } };
  const ids = [];
  wheels.forEach(({ id, sprite, at, R, z = 1 }) => {
    parts[id] = { sprite, z, parent: 'body', at, pivot: [R, R], lim: null, stiff: 0 };
    ids.push(id);
  });
  return { kind: 'vehicle', root: 'body', parts, wheels: ids };
}

// ================================================================ ox cart
function drawCart(ctx, { w: W, h: H }) {
  // เกวียน — the bed with slatted sides under an arched woven hood, the
  // long shaft forward to the yoke, carved bow-shaped end boards.
  const axY = H - 76, cx = 170;
  // shaft (แอก/คานเกวียน) forward and down to the yoke
  hide(ctx, taper([[cx + 60, axY - 24], [W - 30, axY + 10]], 10, 7, { smoothIt: false }), 0, 0);
  const yoke = [[W - 44, axY + 2], [W - 4, axY - 8], [W, axY], [W - 40, axY + 14]];
  hide(ctx, yoke, 0, 0);
  for (const x of [W - 36, W - 14]) hide(ctx, taper([[x, axY + 4], [x + 2, axY + 34]], 4, 3, { smoothIt: false }), 0, 0);
  // rest stick at the front
  hide(ctx, taper([[W - 70, axY + 2], [W - 76, H]], 4, 4, { smoothIt: false }), 0, 0);
  // bed
  const bed = [[20, axY - 30], [cx + 110, axY - 30], [cx + 104, axY - 12], [26, axY - 12]];
  hide(ctx, bed, 0.4, 2);
  dye(ctx, poly(inset(bed, 2)), INK.vermilion, 0.7);
  dotLine(ctx, [[28, axY - 21], [cx + 100, axY - 21]], { spacing: 4, r: 1.05, smoothIt: false });
  // slatted side rails
  hide(ctx, rectPts(26, axY - 84, cx + 70, 7), 0.3, 3);
  for (let x = 32; x < cx + 96; x += 16) hide(ctx, rectPts(x - 2.5, axY - 84, 5, 56), 0, 0);
  hide(ctx, taper([[30, axY - 58], [cx + 90, axY - 58]], 3, 3, { smoothIt: false }), 0, 0);
  // arched woven hood (ประทุน)
  const hood = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20; hood.push([lerp(16, cx + 96, t), axY - 82 - Math.sin(t * Math.PI) * 64]); }
  const hoodIn = [[cx + 96, axY - 80], [16, axY - 80]];
  const hp = [...hood, ...hoodIn];
  hideS(ctx, hp);
  dye(ctx, smooth(inset(hp, 2)), INK.brown, 0.55);
  // woven matting: rows of short slits following the arch
  for (let i = 1; i < 20; i++) {
    const [x, y] = hood[i];
    for (let yy = y + 5, k = 0; yy < axY - 86; yy += 9, k++) slit(ctx, [[x + (k % 2) * 3, yy], [x + (k % 2) * 3, yy + 5]], 1, { smoothIt: false });
    if (i % 2) hole(ctx, x + 4, y + 8, 0.9);
  }
  gold(ctx, hood.slice(1, -1).map(([x, y]) => [x, y + 2]), 1.1);
  // bow-shaped end boards (หางเกวียน) with a curl at the back
  const tail = [[20, axY - 30], [4, axY - 44], [-2, axY - 66], [10, axY - 70], [12, axY - 52], [26, axY - 40]];
  hideS(ctx, tail);
  dye(ctx, smooth(inset(tail, 1.5)), INK.gold, 0.7);
  hole(ctx, 8, axY - 62, 1.3);
  // sacks inside
  for (const [x, s] of [[70, 1], [118, 0.9], [160, 0.8]]) {
    const sk = blobPts(x, axY - 44, 22 * s, 16 * s, { seed: x });
    hideS(ctx, sk);
    dye(ctx, smooth(inset(sk, 2)), INK.cream, 0.5);
    dotLine(ctx, [[x - 10 * s, axY - 50], [x + 10 * s, axY - 50]], { spacing: 3.4, r: 0.8, smoothIt: false });
  }
  prajamYam(ctx, cx + 80, axY - 21, 7, { color: INK.red, petal: INK.gold });
  // axle block
  hide(ctx, rectPts(cx - 14, axY - 14, 28, 20), 0, 0);
  age(ctx, W, H, 0.25);
}

// ================================================================ samlor
function drawSamlor(ctx, { w: W, h: H }) {
  // สามล้อ — pedal rickshaw: rider's bicycle at the front, the passenger
  // bench behind under a folding hood with a scalloped fringe.
  const rearX = 70, frontX = 250, axY = H - 34;
  // frame: seat post, down tube, handlebar, pedal crank
  const frame = [
    taper([[frontX, axY], [frontX - 12, axY - 88]], 5, 4, { smoothIt: false }),
    taper([[frontX - 12, axY - 88], [frontX - 22, axY - 100], [frontX - 8, axY - 104]], 3.5, 3),
    taper([[frontX - 10, axY - 70], [frontX - 70, axY - 40], [rearX + 60, axY - 20]], 5, 5, { smoothIt: false }),
    taper([[frontX - 70, axY - 40], [frontX - 74, axY - 82]], 4.5, 4, { smoothIt: false }),
    taper([[frontX - 70, axY - 22], [frontX - 70, axY - 40]], 4, 4, { smoothIt: false }),
  ];
  hideMany(ctx, frame);
  hideS(ctx, [[frontX - 90, axY - 82], [frontX - 64, axY - 86], [frontX - 60, axY - 80], [frontX - 88, axY - 78]]);
  hideS(ctx, ellipsePts(frontX - 70, axY - 26, 8, 8, 12));
  hole(ctx, frontX - 70, axY - 26, 3);
  // passenger body
  const body = [[rearX - 50, axY - 30], [rearX + 70, axY - 30], [rearX + 76, axY - 12], [rearX + 60, axY - 4], [rearX - 44, axY - 4], [rearX - 56, axY - 14]];
  hide(ctx, body, 0.3, 2);
  dye(ctx, poly(inset(body, 2)), INK.vermilion, 0.8);
  dotLine(ctx, [[rearX - 46, axY - 17], [rearX + 66, axY - 17]], { spacing: 4, r: 1, smoothIt: false });
  prajamYam(ctx, rearX + 10, axY - 17, 6, { color: INK.gold, petal: INK.green });
  const seat = [[rearX - 46, axY - 30], [rearX - 44, axY - 70], [rearX - 34, axY - 76], [rearX - 30, axY - 44], [rearX + 60, axY - 44], [rearX + 62, axY - 30]];
  hide(ctx, seat, 0.2, 3);
  dye(ctx, poly(inset(seat, 2)), INK.green, 0.7);
  gold(ctx, inset(seat, 2), 0.8, { closed: true, smoothIt: false });
  // hood
  const hood = [[rearX - 52, axY - 70], [rearX - 44, axY - 130], [rearX + 10, axY - 150], [rearX + 60, axY - 140], [rearX + 66, axY - 128], [rearX + 20, axY - 128], [rearX - 30, axY - 110], [rearX - 36, axY - 70]];
  hideS(ctx, hood);
  dye(ctx, smooth(inset(hood, 2)), INK.red, 0.75);
  for (let k = 0; k < 4; k++) gold(ctx, [[rearX - 44 + k * 4, axY - 76 - k * 6], [rearX - 36 + k * 10, axY - 128 - k * 4]], 0.9, { smoothIt: false });
  for (let x = rearX - 26; x < rearX + 62; x += 8) hide(ctx, [[x - 4, axY - 129], [x + 4, axY - 129], [x, axY - 120]], 0, 0);
  dotLine(ctx, [[rearX - 38, axY - 128], [rearX + 56, axY - 138]], { spacing: 3.6, r: 0.9 });
  // front mudguard
  hide(ctx, taper([[frontX - 34, axY - 20], [frontX - 20, axY - 36], [frontX, axY - 40], [frontX + 20, axY - 34]], 5, 3), 0, 0);
  hide(ctx, taper([[rearX - 40, axY - 28], [rearX, axY - 44], [rearX + 40, axY - 28]], 5, 5), 0, 0);
  age(ctx, W, H, 0.25);
}

// ================================================================ tuk-tuk
function drawTukTuk(ctx, { w: W, h: H }) {
  // ตุ๊กตุ๊ก — cab with the driver's bench in front, passenger bench behind,
  // a roof with a scalloped fringe and garlands, all in leather and dye.
  const axY = H - 30;
  const body = [[16, axY - 12], [18, axY - 60], [60, axY - 64], [210, axY - 64], [240, axY - 90], [276, axY - 92], [300, axY - 60], [306, axY - 20], [286, axY - 10], [30, axY - 6]];
  hide(ctx, body, 0.4, 1);
  dye(ctx, poly(inset(body, 2.5)), INK.blue, 0.7);
  const stripe = [[20, axY - 40], [300, axY - 40], [302, axY - 32], [20, axY - 32]];
  dye(ctx, poly(stripe), INK.yellow, 0.85);
  dotLine(ctx, [[24, axY - 36], [298, axY - 36]], { spacing: 4, r: 1, smoothIt: false });
  // cut the passenger opening and the front screen
  cut(ctx, poly([[44, axY - 64], [44, axY - 110], [190, axY - 110], [190, axY - 64]]));
  // pillars + roof
  for (const x of [30, 200, 262]) hide(ctx, rectPts(x - 4, axY - 150, 8, 90), 0, 0);
  const roof = [[10, axY - 150], [300, axY - 150], [310, axY - 138], [4, axY - 138]];
  hide(ctx, [...roof.slice(0, 2), [296, axY - 170], [30, axY - 170]].concat([]), 0, 0);
  hide(ctx, roof, 0.3, 3);
  dye(ctx, poly(inset(roof, 1.5)), INK.vermilion, 0.85);
  dye(ctx, poly([[34, axY - 166], [292, axY - 166], [298, axY - 152], [14, axY - 152]]), INK.green, 0.7);
  for (let x = 8; x < 306; x += 9) hide(ctx, [[x - 4.5, axY - 139], [x + 4.5, axY - 139], [x, axY - 130]], 0, 0);
  dotLine(ctx, [[14, axY - 144], [300, axY - 144]], { spacing: 4, r: 1, smoothIt: false });
  gold(ctx, [[34, axY - 160], [292, axY - 160]], 1.1, { smoothIt: false });
  // windscreen frame + mirror + headlamp
  cut(ctx, poly([[210, axY - 70], [240, axY - 98], [258, axY - 132], [206, axY - 132]]));
  hide(ctx, taper([[258, axY - 132], [276, axY - 92]], 4, 4, { smoothIt: false }), 0, 0);
  hide(ctx, taper([[270, axY - 118], [288, axY - 128]], 2, 2, { smoothIt: false }), 0, 0);
  hideS(ctx, ellipsePts(290, axY - 128, 5, 4, 10));
  hideS(ctx, ellipsePts(302, axY - 66, 7, 9, 12));
  dye(ctx, smooth(ellipsePts(302, axY - 66, 5, 7, 12)), INK.yellow, 0.95);
  hole(ctx, 302, axY - 66, 2);
  // benches: passenger (with a sitting passenger's silhouette space) and driver
  hide(ctx, rectPts(50, axY - 80, 134, 16), 0.2, 5);
  dye(ctx, poly(rectPts(52, axY - 78, 130, 12)), INK.red, 0.8);
  hide(ctx, rectPts(48, axY - 112, 14, 48), 0, 0);
  hide(ctx, rectPts(196, axY - 88, 36, 10), 0, 0);
  hide(ctx, taper([[236, axY - 96], [250, axY - 110], [262, axY - 108]], 4, 3), 0, 0); // handlebar
  // garlands from the roof front, lucky cloth on the pillar
  garland(ctx, 250, axY - 130, 22, { color: INK.orange });
  garland(ctx, 226, axY - 130, 18, { color: INK.yellow });
  const cl = taper([[262, axY - 146], [258, axY - 120], [264, axY - 104]], 5, 3);
  hideS(ctx, cl);
  dye(ctx, smooth(cl), INK.pink, 0.9);
  // fender arches over the wheels
  for (const [x, R] of [[70, 30], [270, 26]]) hide(ctx, taper([[x - R - 6, axY - 4], [x - R + 4, axY - R - 4], [x, axY - R - 8], [x + R - 4, axY - R - 4], [x + R + 6, axY - 4]], 6, 6), 0, 0);
  rimDots(ctx, body, 3.5, { spacing: 4, r: 1 });
  age(ctx, W, H, 0.22);
}

// =============================================================== bicycle
function drawBicycle(ctx, { w: W, h: H }) {
  const rx = 40, fx = W - 40, axY = H - 38;
  const bb = [W * 0.46, axY - 4];
  const seat = [W * 0.38, axY - 62], head = [fx - 22, axY - 66];
  const tubes = [[[rx, axY], bb], [[rx, axY], seat], [bb, seat], [seat, head], [bb, head], [head, [fx, axY]], [head, [fx - 30, axY - 88]]];
  hideMany(ctx, tubes.map(([a, b]) => taper([a, b], 5, 5, { smoothIt: false })));
  tubes.slice(0, 5).forEach(([a, b]) => gold(ctx, [a, b], 0.7, { smoothIt: false }));
  // saddle, handlebar, basket, pedal crank
  hideS(ctx, [[seat[0] - 16, seat[1] - 4], [seat[0] + 10, seat[1] - 8], [seat[0] + 12, seat[1] - 2], [seat[0] - 14, seat[1] + 2]]);
  hide(ctx, taper([[fx - 30, axY - 88], [fx - 14, axY - 92], [fx - 4, axY - 84]], 4, 3), 0, 0);
  const bk = [[fx - 20, axY - 82], [fx + 16, axY - 82], [fx + 12, axY - 58], [fx - 16, axY - 58]];
  hide(ctx, bk, 0, 0);
  dye(ctx, poly(inset(bk, 1.2)), INK.brown, 0.6);
  for (let y = axY - 78; y < axY - 60; y += 5) dotLine(ctx, [[fx - 14, y], [fx + 10, y]], { spacing: 3.2, r: 0.8, smoothIt: false });
  hideS(ctx, ellipsePts(bb[0], bb[1], 9, 9, 14));
  hole(ctx, bb[0], bb[1], 3);
  hide(ctx, taper([bb, [bb[0] + 10, bb[1] + 16]], 4, 3, { smoothIt: false }), 0, 0);
  hide(ctx, rectPts(bb[0] + 4, bb[1] + 14, 14, 4), 0, 0);
  // flowers in the basket
  for (const [dx, c] of [[-8, INK.pink], [2, INK.yellow], [10, INK.vermilion]]) {
    const f = ellipsePts(fx + dx, axY - 88, 5, 5, 5);
    hideS(ctx, f); dye(ctx, smooth(f), c, 0.9); hole(ctx, fx + dx, axY - 88, 1);
  }
  age(ctx, W, H, 0.22);
}

// ================================================================ PROPS
function build(id, w, h, draw, wheels, px = 2) {
  const body = paintSprite(w, h, draw, { name: id, pad: 16, px });
  return vehicleRig(body, wheels.map((wh) => ({ ...wh, sprite: wheelSprite(id + '-' + wh.id, wh.R, wh.opt) })));
}

export const PROPS = [
  {
    id: 'ox-cart', name: 'เกวียน', en: 'Ox cart', cat: 'vehicles',
    build() {
      return { ...build('ox-cart', 420, 250, drawCart, [{ id: 'wheel', at: [170, 174], R: 72, opt: { spokes: 14, rim: 0.14, hub: 0.2, color: INK.vermilion } }]), mass: 3 };
    },
  },
  {
    id: 'samlor', name: 'สามล้อ', en: 'Samlor pedicab', cat: 'vehicles',
    build() {
      return { ...build('samlor', 290, 200, drawSamlor, [
        { id: 'wheelB', at: [70, 166], R: 32, opt: { spokes: 16, rim: 0.12, hub: 0.14, color: INK.gold } },
        { id: 'wheelF', at: [250, 166], R: 32, opt: { spokes: 16, rim: 0.12, hub: 0.14, color: INK.gold } },
      ]), mass: 1.5 };
    },
  },
  {
    id: 'tuk-tuk', name: 'ตุ๊กตุ๊ก', en: 'Tuk-tuk', cat: 'vehicles',
    build() {
      return { ...build('tuk-tuk', 320, 220, drawTukTuk, [
        { id: 'wheelB', at: [70, 190], R: 26, opt: { spokes: 8, rim: 0.3, hub: 0.3, color: INK.leatherHi } },
        { id: 'wheelF', at: [270, 190], R: 22, opt: { spokes: 8, rim: 0.3, hub: 0.3, color: INK.leatherHi } },
      ]), mass: 2 };
    },
  },
  {
    id: 'bicycle', name: 'จักรยาน', en: 'Bicycle', cat: 'vehicles',
    build() {
      return { ...build('bicycle', 220, 140, drawBicycle, [
        { id: 'wheelB', at: [40, 102], R: 34, opt: { spokes: 18, rim: 0.1, hub: 0.12, color: INK.red } },
        { id: 'wheelF', at: [180, 102], R: 34, opt: { spokes: 18, rim: 0.1, hub: 0.12, color: INK.red } },
      ]), mass: 1 };
    },
  },
];
