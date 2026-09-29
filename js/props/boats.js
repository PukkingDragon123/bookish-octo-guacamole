// Boats and water, cut from hide. Boats `float` (they bob on water); the
// wave band is static scenery they can sit in.

import {
  INK, paintSprite, leather, dye, line, gold, hole, holes, dotLine, slit, cut,
  poly, curve, smooth, ellipsePts, blobPts, inset, rng, kanokPts, prajamYam, dotFlower,
} from '../art/leather.js';
import {
  TAU, lerp, mix, rectPts, taper, hide, hideS, hideMany, rimDots, edgeDots, offsetLine, spiral,
  age, finRow, spire, umbrella, lotusBand, garland, kanokScroll,
} from './buildings.js';

// A hull in side view: deck line from stern (x0) to bow (x1) sagging
// amidships, both ends rising to points.
function hullPts(x0, x1, yDeck, yKeel, rise0, rise1, { sag = 6, n = 24 } = {}) {
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = lerp(x0, x1, t);
    const lift = Math.pow(1 - t, 6) * rise0 + Math.pow(t, 6) * rise1;
    top.push([x, yDeck + Math.sin(t * Math.PI) * sag - lift]);
    const depth = Math.pow(Math.sin(t * Math.PI), 0.55);
    bot.push([x, lerp(yDeck - lift * 0.9, yKeel, depth)]);
  }
  return { top, bot, outline: [...top, ...bot.reverse()] };
}

function hullDeco(ctx, h, { color = INK.vermilion, band = true, seed = 1 } = {}) {
  const { top, outline } = h;
  hideS(ctx, outline);
  if (band) {
    const b = offsetLine(top.slice(2, -2), 7);
    const b2 = offsetLine(top.slice(2, -2), 15);
    dye(ctx, poly([...b, ...b2.slice().reverse()]), color, 0.8);
    gold(ctx, b, 1.1);
    gold(ctx, b2, 1.1);
    dotLine(ctx, offsetLine(top.slice(2, -2), 11), { spacing: 4, r: 1, seed, smoothIt: false });
  }
  gold(ctx, offsetLine(top.slice(1, -1), 2.4), 1);
  rimDots(ctx, outline, 3.5, { spacing: 4.2, r: 1, seed: seed + 1 });
}

// ======================================================== rowing boat
function drawRowBoat(ctx, { w: W, h: H }) {
  const G = H;
  const h = hullPts(6, W - 6, G - 40, G - 2, 34, 40, { sag: 5 });
  // rower's oar behind
  hide(ctx, taper([[W * 0.62, G - 96], [W * 0.46, G + 2]], 4.5, 4, { smoothIt: false }), 0, 0);
  hideS(ctx, [[W * 0.47, G - 20], [W * 0.43, G + 4], [W * 0.46, G + 10], [W * 0.5, G - 16]]);
  hullDeco(ctx, h, { color: INK.vermilion });
  // planks
  for (let k = 1; k < 3; k++) {
    const pl = h.top.slice(3, -3).map(([x, y], i, a) => [x, lerp(y, G - 4, 0.3 + k * 0.22) + Math.sin((i / a.length) * Math.PI) * 2]);
    slit(ctx, pl, 0.9);
  }
  // prow garland (พวงมาลัยหัวเรือ) with ribbons
  const bx = W - 18, by = G - 76;
  for (const [dx, c] of [[-2, INK.red], [2, INK.yellow], [6, INK.green]]) {
    const rb = taper([[bx - 2, by + 6], [bx + dx - 8, by + 26], [bx + dx - 4, by + 40]], 4, 2.5);
    hideS(ctx, rb);
    dye(ctx, smooth(rb), c, 0.9);
  }
  garland(ctx, bx - 6, by + 4, 18, { color: INK.orange });
  // seats
  for (const x of [W * 0.3, W * 0.62]) hide(ctx, rectPts(x - 14, G - 44, 28, 5), 0, 0);
  // rower's hat on the seat? keep a woven basket
  const bk = [[W * 0.36, G - 38], [W * 0.36 + 34, G - 38], [W * 0.36 + 30, G - 62], [W * 0.36 + 4, G - 62]];
  hide(ctx, bk, 0, 0);
  dye(ctx, poly(inset(bk, 1.5)), INK.brown, 0.6);
  for (let y = G - 58; y < G - 40; y += 5) dotLine(ctx, [[W * 0.36 + 5, y], [W * 0.36 + 29, y]], { spacing: 3.4, r: 0.8, smoothIt: false });
  prajamYam(ctx, W * 0.14, G - 22, 8, { color: INK.red, petal: INK.gold });
  prajamYam(ctx, W * 0.86, G - 22, 8, { color: INK.red, petal: INK.gold });
  age(ctx, W, H, 0.25);
}

// ======================================================= long-tail boat
function drawLongTail(ctx, { w: W, h: H }) {
  const G = H;
  // engine on its long shaft at the stern
  const ex = 70, ey = G - 92;
  hide(ctx, taper([[ex + 10, ey + 12], [-2, G + 4]], 6, 4, { smoothIt: false }), 0, 0);
  const prop = [[4, G - 8], [-6, G - 20], [2, G - 10], [10, G - 20]];
  hide(ctx, prop, 0, 0);
  const eng = [[ex - 28, ey - 14], [ex + 22, ey - 18], [ex + 30, ey + 8], [ex - 24, ey + 14]];
  hideS(ctx, eng);
  dye(ctx, smooth(inset(eng, 2)), INK.gold, 0.4);
  for (let x = ex - 18; x < ex + 22; x += 6) slit(ctx, [[x, ey - 10], [x + 1, ey + 8]], 1.1, { smoothIt: false });
  hide(ctx, taper([[ex + 20, ey - 10], [ex + 64, ey - 40]], 3.5, 3, { smoothIt: false }), 0, 0); // tiller
  // hull
  const h = hullPts(40, W - 4, G - 44, G - 4, 10, 96, { sag: 8 });
  hullDeco(ctx, h, { color: INK.blue });
  for (let k = 1; k < 3; k++) slit(ctx, h.top.slice(4, -5).map(([x, y]) => [x, lerp(y, G - 6, 0.35 + k * 0.2)]), 0.9);
  // canopy on poles
  const c0 = 150, c1 = 330, cy = G - 118;
  for (const x of [c0 + 6, c1 - 6]) hide(ctx, rectPts(x - 3, cy, 6, 76), 0, 0);
  const can = [[c0 - 10, cy + 6], [c0, cy - 10], [c1, cy - 10], [c1 + 10, cy + 6]];
  hide(ctx, can, 0, 0);
  for (let x = c0 - 8; x <= c1 + 8; x += 10) hide(ctx, [[x - 5, cy + 5], [x + 5, cy + 5], [x, cy + 13]], 0, 0);
  dye(ctx, poly(inset(can, 1.5)), INK.vermilion, 0.8);
  dotLine(ctx, [[c0 + 2, cy - 2], [c1 - 2, cy - 2]], { spacing: 4, r: 1, smoothIt: false });
  // prow: tall, with a garland and ribbons
  const bx = W - 12, by = G - 138;
  for (const [dx, c] of [[-4, INK.red], [0, INK.pink], [4, INK.yellow], [8, INK.green]]) {
    const rb = taper([[bx - 4, by + 10], [bx + dx - 12, by + 34], [bx + dx - 6, by + 56]], 4, 2.5);
    hideS(ctx, rb);
    dye(ctx, smooth(rb), c, 0.9);
  }
  garland(ctx, bx - 8, by + 6, 20, { color: INK.orange });
  prajamYam(ctx, W - 70, G - 30, 9, { color: INK.red, petal: INK.gold });
  age(ctx, W, H, 0.25);
}

// ================================================ royal swan barge
function drawSwanBarge(ctx, { rng: r, w: W, h: H }) {
  // เรือสุพรรณหงส์ — long gilded barge: the golden swan's head and arched
  // neck at the prow, a feathered tail at the stern, the royal pavilion
  // (บุษบก) amidships, a row of oars, flags and umbrellas.
  const G = H;
  const deck = G - 56;
  // oars (behind the hull) with gilded blades dipping into the water
  for (let x = 130; x < W - 170; x += 26) {
    hide(ctx, taper([[x + 8, deck - 20], [x - 14, G + 4]], 3, 2.6, { smoothIt: false }), 0, 0);
    hideS(ctx, [[x - 12, G - 16], [x - 20, G + 4], [x - 14, G + 8], [x - 8, G - 12]]);
  }
  // stern tail: rising, feather-cut
  const tail = [[70, deck + 10], [40, deck - 20], [22, deck - 70], [14, deck - 120], [30, deck - 108], [44, deck - 60], [70, deck - 30], [110, deck - 10]];
  hideS(ctx, tail);
  finRow(ctx, [16, deck - 118], [60, deck - 16], 13, { side: 1, lean: 0.6, seed: 3 });
  dye(ctx, smooth(inset(tail, 2)), INK.gold, 0.7);
  gold(ctx, curve([[24, deck - 100], [44, deck - 50], [80, deck - 14]], false, 8), 1);
  // hull
  const h = hullPts(60, W - 110, deck, G - 6, 0, 30, { sag: 4 });
  hideS(ctx, h.outline);
  dye(ctx, smooth(inset(h.outline, 2)), INK.gold, 0.6);
  // scale-feather pattern along the hull (painted scallops + dots)
  ctx.save(); ctx.clip(smooth(inset(h.outline, 4)));
  for (let row = 0; row < 4; row++) {
    const y = deck + 10 + row * 9;
    for (let x = 70 + (row % 2) * 8; x < W - 110; x += 16) {
      const arc = [[x - 8, y], [x - 5, y + 6], [x, y + 8], [x + 5, y + 6], [x + 8, y]];
      line(ctx, arc, row % 2 ? INK.red : INK.leather, 1.3);
      hole(ctx, x, y + 3, 0.9);
    }
  }
  ctx.restore();
  const bandT = offsetLine(h.top.slice(1, -1), 3);
  dye(ctx, poly([...bandT, ...offsetLine(h.top.slice(1, -1), 9).reverse()]), INK.red, 0.85);
  dotLine(ctx, offsetLine(h.top.slice(1, -1), 6), { spacing: 3.8, r: 1, smoothIt: false });
  rimDots(ctx, h.outline, 3, { spacing: 4, r: 1 });
  // swan neck and head at the prow
  const neck = [[W - 190, deck + 26], [W - 120, deck + 4], [W - 84, deck - 30], [W - 62, deck - 80], [W - 70, deck - 150], [W - 60, deck - 200], [W - 34, deck - 214]];
  const np = taper(neck, (t) => 50 * Math.pow(1 - t, 1.3) + 14);
  hideS(ctx, np);
  // crest flames down the back of the neck
  const nc = curve(neck, false, 10);
  for (let k = 0.3; k < 0.85; k += 0.07) { const a = nc[Math.floor(k * nc.length)], b = nc[Math.floor(k * nc.length) + 2]; const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const f = kanokPts(a[0] + Math.sin(ang) * 14, a[1] - Math.cos(ang) * 14, 22, ang - Math.PI / 2 - 0.5, false); hideMany(ctx, [f]); dye(ctx, poly(f), INK.gold, 0.7); }
  // head: beak, crest
  const hx = W - 34, hy = deck - 214;
  const head = [[hx - 20, hy + 12], [hx - 18, hy - 6], [hx - 4, hy - 16], [hx + 10, hy - 12], [hx + 34, hy - 2], [hx + 12, hy + 4], [hx + 2, hy + 16]];
  hideS(ctx, head);
  const crest = [kanokPts(hx - 8, hy - 12, 40, -Math.PI / 2 - 0.8, false), kanokPts(hx - 16, hy - 2, 30, -Math.PI + 0.5, false)];
  hideMany(ctx, crest);
  crest.forEach((c, i) => { dye(ctx, poly(inset(c, 1.5)), i ? INK.vermilion : INK.gold, 0.85); gold(ctx, inset(c, 1.5), 0.7, { closed: true, smoothIt: false }); hole(ctx, ...mix(c[0], c[Math.floor(c.length / 2)], 0.5), 1.2); });
  dye(ctx, smooth(inset(np, 2)), INK.gold, 0.85);
  dye(ctx, smooth(inset(head, 1.5)), INK.gold, 0.9);
  dye(ctx, poly([[hx + 8, hy - 8], [hx + 34, hy - 2], [hx + 10, hy + 3]]), INK.vermilion, 0.9);
  hole(ctx, hx + 2, hy - 6, 1.8);
  // neck ornament: bands, dotted scales, a jewel collar with tassel
  for (let k = 1; k < 8; k++) {
    const [x, y] = nc[Math.floor((k / 9) * nc.length)];
    gold(ctx, [[x - 12, y + 4], [x + 12, y - 4]], 1, { smoothIt: false });
    holes(ctx, [[x - 4, y + 3], [x + 4, y - 1]], 1);
  }
  const [cx0, cy0] = nc[Math.floor(nc.length * 0.62)];
  hideS(ctx, taper([[cx0 - 18, cy0 + 4], [cx0 + 18, cy0 - 6]], 9));
  dye(ctx, smooth(taper([[cx0 - 16, cy0 + 4], [cx0 + 16, cy0 - 6]], 6)), INK.red, 0.9);
  for (const dx of [-8, 4]) {
    const ts = taper([[cx0 + dx, cy0], [cx0 + dx - 6, cy0 + 30], [cx0 + dx - 2, cy0 + 50]], 5, 3);
    hideS(ctx, ts);
    dye(ctx, smooth(ts), dx < 0 ? INK.red : INK.green, 0.9);
  }
  gold(ctx, offsetLine(nc.slice(2, -3), 10), 1.1);
  dotLine(ctx, offsetLine(nc.slice(2, -4), -6), { spacing: 4, r: 1.1, smoothIt: false });
  // royal pavilion (บุษบก) amidships
  const px = W * 0.48, pb = deck - 6;
  hide(ctx, rectPts(px - 70, pb - 12, 140, 14), 0, 0);
  dye(ctx, poly(rectPts(px - 68, pb - 10, 136, 10)), INK.red, 0.85);
  lotusBand(ctx, px - 66, px + 66, pb - 1, 9, { up: true, colors: [INK.gold, INK.green], holesIt: false });
  for (const dx of [-58, -20, 20, 58]) {
    hide(ctx, rectPts(px + dx - 4, pb - 100, 8, 90), 0, 0);
    dye(ctx, poly(rectPts(px + dx - 2.5, pb - 98, 5, 86)), INK.gold, 0.6);
  }
  // curtains tied back + throne seat
  for (const d of [-1, 1]) {
    const cu = [[px + d * 54, pb - 100], [px + d * 30, pb - 96], [px + d * 44, pb - 60], [px + d * 54, pb - 30]];
    hideS(ctx, [...cu, [px + d * 58, pb - 60]]);
    dye(ctx, smooth(cu), INK.vermilion, 0.8);
  }
  hide(ctx, [[px - 24, pb - 12], [px - 20, pb - 36], [px + 20, pb - 36], [px + 24, pb - 12]], 0, 0);
  dye(ctx, poly([[px - 20, pb - 14], [px - 17, pb - 34], [px + 17, pb - 34], [px + 20, pb - 14]]), INK.gold, 0.7);
  hide(ctx, rectPts(px - 74, pb - 108, 148, 10), 0, 0);
  dotLine(ctx, [[px - 70, pb - 103], [px + 70, pb - 103]], { spacing: 4, r: 1, smoothIt: false });
  spire(ctx, px, pb - 106, 150, 150, { tiers: 4, seed: 12, finial: 0.36 });
  // flags and umbrellas fore and aft
  umbrella(ctx, px - 120, pb, 120, { tiers: 3, w: 30, seed: 4 });
  umbrella(ctx, px + 120, pb, 120, { tiers: 3, w: 30, seed: 5 });
  for (const [x, d] of [[118, 1], [W - 200, -1]]) {
    hide(ctx, taper([[x, deck], [x, deck - 150]], 3.5, 2.5, { smoothIt: false }), 0, 0);
    const fl = [[x, deck - 146], [x - d * 4 + 48, deck - 138], [x + 30, deck - 128], [x + 50, deck - 116], [x, deck - 112]];
    hideS(ctx, fl);
    dye(ctx, smooth(inset(fl, 1.5)), INK.red, 0.9);
    dotLine(ctx, [[x + 6, deck - 130], [x + 36, deck - 128]], { spacing: 3.6, r: 0.8, smoothIt: false });
  }
  // prow garland
  garland(ctx, W - 110, deck - 40, 24, { color: INK.orange });
  age(ctx, W, H, 0.22);
}

// ========================================================== bamboo raft
function drawRaft(ctx, { rng: r, w: W, h: H }) {
  const G = H;
  // shelter (ร้าน) with a thatched roof
  const s0 = 120, s1 = 250, sy = G - 110;
  for (const x of [s0 + 6, s1 - 6]) hide(ctx, rectPts(x - 3, sy, 6, 86), 0, 0);
  const roof = [[s0 - 16, sy + 8], [(s0 + s1) / 2, sy - 34], [s1 + 16, sy + 8]];
  const edge = [];
  for (let x = s1 + 16; x >= s0 - 16; x -= 5) edge.push([x, sy + 8 + ((x / 5) % 2 ? 6 : 1)]);
  hide(ctx, [...roof, ...edge], 0.6, 2);
  for (let k = 0; k < 3; k++) for (let x = s0; x < s1; x += 6) slit(ctx, [[x, sy - 20 + k * 10 + Math.abs(x - (s0 + s1) / 2) * 0.28], [x + 1, sy - 12 + k * 10 + Math.abs(x - (s0 + s1) / 2) * 0.28]], 0.8, { smoothIt: false });
  dye(ctx, poly(roof), INK.orange, 0.18);
  // a clay pot and a coiled rope on deck
  const pot = blobPts(80, G - 40, 14, 12, { seed: 3 });
  hideS(ctx, pot);
  dye(ctx, smooth(inset(pot, 2)), INK.brown, 0.6);
  dotLine(ctx, [[68, G - 42], [92, G - 42]], { spacing: 3.4, r: 0.8, smoothIt: false });
  // punting pole leaning
  hide(ctx, taper([[W - 60, G - 150], [W - 20, G + 4]], 4, 4, { smoothIt: false }), 0, 0);
  // bundled poles, seen end-on-ish: long bars with node slits
  for (let k = 0; k < 3; k++) {
    const y = G - 30 + k * 9;
    const bar = [[4 + k * 3, y], [W - 4 - k * 3, y], [W - 4 - k * 3, y + 10], [4 + k * 3, y + 10]];
    hide(ctx, bar, 0.5, 5 + k);
    if (k % 2) dye(ctx, poly(inset(bar, 1.5)), INK.jade, 0.4);
    for (let x = 30 + k * 13; x < W - 20; x += 44) slit(ctx, [[x, y + 1.5], [x, y + 8.5]], 1.1, { smoothIt: false });
    for (const x of [4 + k * 3, W - 4 - k * 3]) { hideS(ctx, ellipsePts(x, y + 5, 4, 5.5, 10)); hole(ctx, x, y + 5, 1.6); }
  }
  // cross lashings
  for (const x of [40, W / 2, W - 40]) {
    hide(ctx, rectPts(x - 4, G - 34, 8, 34), 0, 0);
    for (let y = G - 30; y < G - 2; y += 6) slit(ctx, [[x - 3, y], [x + 3, y + 3]], 0.9, { smoothIt: false });
  }
  dotLine(ctx, [[10, G - 25], [W - 10, G - 25]], { spacing: 4.4, r: 0.9, smoothIt: false });
  age(ctx, W, H, 0.25);
}

// ============================================================ waves
function drawWaves(ctx, { rng: r, w: W, h: H }) {
  // คลื่นน้ำ — Thai mural water: rows of curling crests (ลายน้ำ) over a
  // dyed band, flecks of foam punched through.
  const G = H;
  const crestY = 34;
  const top = [];
  const period = 64;
  for (let x = 0; x <= W; x += 2) {
    const ph = (x % period) / period;
    top.push([x, crestY + (ph < 0.62 ? Math.pow(ph / 0.62, 1.6) * 0 + (1 - Math.sin((ph / 0.62) * Math.PI * 0.5)) * -10 + 10 : 10 - Math.sin(((ph - 0.62) / 0.38) * Math.PI) * 18)]);
  }
  const band = [...top, [W, G], [0, G]];
  hide(ctx, band, 0, 0);
  // curling crest heads (hooks curling forward)
  const curls = [];
  for (let x = period * 0.62; x < W; x += period) curls.push(taper(spiral(x + 14, crestY - 8, 19, 3, Math.PI, 1.15, 26), 9, 2));
  hideMany(ctx, curls);
  dye(ctx, poly(inset(band, 2)), INK.teal, 0.72);
  ctx.save();
  ctx.clip(poly(band));
  dye(ctx, poly(rectPts(0, G - 40, W, 40)), INK.indigo, 0.6);
  ctx.restore();
  curls.forEach((c) => dye(ctx, poly(c), INK.cream, 0.7));
  // nested lines echoing the crests, alternating gold / dots / dark
  const echo = (d) => top.map(([x, y]) => [x, y + d]);
  line(ctx, echo(5), INK.cream, 2.2, { smoothIt: false, alpha: 0.8 });
  dotLine(ctx, echo(11), { spacing: 4, r: 1.1, smoothIt: false });
  gold(ctx, echo(17), 1.2, { smoothIt: false });
  // lower rows of scallop waves
  ctx.save();
  ctx.clip(poly(inset(band, 3)));
  for (let row = 0, y = crestY + 34; y < G + 10; y += 13, row++) {
    const p = new Path2D();
    for (let x = -20 + (row % 2) * 13; x < W + 26; x += 26) { p.moveTo(x + 13, y); p.arc(x, y, 13, 0, Math.PI, true); }
    ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.strokeStyle = row % 2 ? INK.goldLine : INK.cream; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.9; ctx.stroke(p); ctx.restore();
    const dots = [];
    for (let x = -20 + (row % 2) * 13; x < W + 26; x += 26) dots.push([x, y - 7]);
    holes(ctx, dots, 1.2);
  }
  ctx.restore();
  // foam flecks
  const f = [];
  for (let i = 0; i < 40; i++) f.push([r() * W, crestY + 20 + r() * (G - crestY - 30)]);
  holes(ctx, f, 0.9);
  age(ctx, W, H, 0.15);
}

// ============================================================== PROPS
const Bt = (id, name, en, w, h, draw, meta, opt = {}) => ({
  id, name, en, cat: 'boats',
  build() {
    const sprite = paintSprite(w, h, draw, { name: id, pad: 16, ...opt });
    return { sprite, ...meta };
  },
});

export const PROPS = [
  Bt('rowing-boat', 'เรือพาย', 'Rowing boat', 420, 130, drawRowBoat, { float: true, mass: 1.5 }),
  Bt('longtail-boat', 'เรือหางยาว', 'Long-tail boat', 500, 170, drawLongTail, { float: true, mass: 2 }),
  Bt('swan-barge', 'เรือสุพรรณหงส์', 'Royal swan barge (Suphannahong)', 800, 330, drawSwanBarge, { float: true, mass: 4 }, { px: 1.8 }),
  Bt('bamboo-raft', 'แพไม้ไผ่', 'Bamboo raft', 360, 160, drawRaft, { float: true, mass: 1.5 }),
  Bt('wave-band', 'คลื่นน้ำ', 'Mural wave band', 800, 130, drawWaves, { static: true, mass: 3 }, { px: 1.8 }),
];
