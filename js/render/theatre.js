// The โรงหนังตะลุง: a raised village show booth, dressed up like a little
// temple pavilion — tiled roof with a carved gable, ช่อฟ้า / ใบระกา /
// หางหงส์, a gold รวงผึ้ง valance, lacquered posts, woven bamboo walls
// and the red-bordered screen with the troupe's name in gold.
//
// Everything static is painted once into an offscreen canvas (scene
// units -> pixels at `k`), leaving the cloth area transparent.

import { makeCanvas, rng, goldGrad, grain, krajang, krajangLine, prajam, kanok, roundRect, jitterPts } from './paint.js';
import { paintSprite, leather, dotLine, dotFill, slit, INK, curve, poly } from '../art/leather.js';

export const BOOTH = { x0: -470, y0: -520, x1: 2070, y1: 1440 };
export const BAND = { top: 112, side: 54, bottom: 66, inset: 8 };
export const TROUPE = { th: 'หนังตะลุง', sub: 'คณะ ศรีสวรรค์ศิลป์' };

const RED = '#7d1712', RED_D = '#4a0c09', RED_L = '#a2261b';
const WOOD = '#3b1d10', WOOD_L = '#6a3a1e';

export function paintBooth(k = 0.75, fonts = {}) {
  const W = BOOTH.x1 - BOOTH.x0, H = BOOTH.y1 - BOOTH.y0;
  const c = makeCanvas(Math.ceil(W * k), Math.ceil(H * k));
  const ctx = c.getContext('2d');
  ctx.scale(k, k);
  ctx.translate(-BOOTH.x0, -BOOTH.y0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const r = rng(11);

  // ----------------------------------------------------------- side wings
  wovenWall(ctx, -380, -70, 215, 1255, 3);
  wovenWall(ctx, 1765, -70, 215, 1255, 4);
  wovenWall(ctx, -100, 1080, 1800, 110, 5);
  // wing skirting boards
  for (const [x, w] of [[-380, 215], [1765, 215]]) {
    ctx.fillStyle = RED_D;
    ctx.fillRect(x, 1100, w, 90);
    krajangLine(ctx, x + 10, 1100, x + w - 10, 1100, 18, { fill: '#c9953a', stroke: '#3d1f06', inner: RED });
  }
  // lower skirt board under the screen
  const skirt = ctx.createLinearGradient(0, 1080, 0, 1195);
  skirt.addColorStop(0, '#5a110d');
  skirt.addColorStop(1, '#2c0806');
  ctx.fillStyle = skirt;
  ctx.fillRect(-100, 1096, 1800, 100);
  for (let x = 40; x < 1600; x += 160) prajam(ctx, x + 40, 1146, 26, { petal: '#d7a948', center: RED_L, line: '#3a1c05' });
  krajangLine(ctx, -90, 1096, 1690, 1096, 22, { fill: '#d4a346', stroke: '#3a1c05', inner: RED });
  gildLine(ctx, [[-100, 1194], [1700, 1194]], 5);

  // stilts under the platform
  ctx.fillStyle = '#1b0e08';
  ctx.fillRect(-420, 1195, 2440, 16);
  for (const x of [-360, -150, 380, 800, 1220, 1740, 1950]) {
    const g = ctx.createLinearGradient(x - 16, 0, x + 16, 0);
    g.addColorStop(0, '#140a05'); g.addColorStop(0.5, '#3a2213'); g.addColorStop(1, '#0e0703');
    ctx.fillStyle = g;
    ctx.fillRect(x - 16, 1200, 32, 240);
  }
  // ladder at the side wing
  ctx.strokeStyle = '#2a170c';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(-440, 1440); ctx.lineTo(-395, 1200);
  ctx.moveTo(-360, 1440); ctx.lineTo(-322, 1200);
  ctx.stroke();
  ctx.lineWidth = 7;
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    ctx.beginPath();
    ctx.moveTo(-440 + 45 * t, 1440 - 240 * t);
    ctx.lineTo(-360 + 38 * t, 1440 - 240 * t);
    ctx.stroke();
  }

  // ------------------------------------------------------ frame & band
  // wooden frame
  ctx.fillStyle = WOOD;
  ctx.beginPath();
  ctx.rect(-100, -150, 1800, 1246);
  ctx.rect(-46 + 0, -BAND.top + 10, 1692, 1000 + BAND.top + BAND.bottom - 10 - 0);
  ctx.fill('evenodd');
  woodGrain(ctx, -100, -150, 1800, 1246);
  gildRect(ctx, -100, -150, 1800, 1246, 6);
  gildRect(ctx, -74, -128, 1748, 1200, 3);

  // red velvet border band (with the cloth hole)
  const band = new Path2D();
  band.rect(-BAND.side, -BAND.top, 1600 + BAND.side * 2, 1000 + BAND.top + BAND.bottom);
  band.rect(BAND.inset, BAND.inset, 1600 - BAND.inset * 2, 1000 - BAND.inset * 2);
  const bg = ctx.createLinearGradient(0, -BAND.top, 0, 1000 + BAND.bottom);
  bg.addColorStop(0, '#8c1a13');
  bg.addColorStop(0.5, '#761410');
  bg.addColorStop(1, '#5e0f0b');
  ctx.fillStyle = bg;
  ctx.fill(band, 'evenodd');
  ctx.save();
  ctx.clip(band, 'evenodd');
  velvet(ctx, -BAND.side, -BAND.top, 1600 + BAND.side * 2, 1000 + BAND.top + BAND.bottom);
  ctx.restore();
  // gold braid along the inner edge + stitches
  gildRect(ctx, BAND.inset - 4, BAND.inset - 4, 1600 - BAND.inset * 2 + 8, 1000 - BAND.inset * 2 + 8, 4);
  ctx.strokeStyle = 'rgba(255,236,190,0.55)';
  ctx.setLineDash([3, 5]);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(BAND.inset - 11, BAND.inset - 11, 1600 - BAND.inset * 2 + 22, 1000 - BAND.inset * 2 + 22);
  ctx.setLineDash([]);
  gildRect(ctx, -BAND.side + 5, -BAND.top + 5, 1600 + BAND.side * 2 - 10, 1000 + BAND.top + BAND.bottom - 10, 2.5);
  // medallions along sides & bottom band
  for (let y = 120; y < 960; y += 150) {
    prajam(ctx, -BAND.side / 2 + 4, y, 15);
    prajam(ctx, 1600 + BAND.side / 2 - 4, y, 15);
  }
  for (let x = 90; x < 1560; x += 140) prajam(ctx, x, 1000 + BAND.bottom / 2 - 4, 16);
  // top band: kranok flourishes + troupe name
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const x = 800 + side * (330 + i * 95);
      prajam(ctx, x, -BAND.top / 2 + 2, 18);
      kanok(ctx, x + side * 30, -BAND.top / 2 + 16, 30, -Math.PI / 2 - side * 0.9, side > 0, '#dcaa47', '#3b1d05');
    }
  }
  const titleFont = fonts.title || 'Chonburi, "Srisakdi", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `64px ${titleFont}`;
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#2a0703';
  ctx.strokeText(TROUPE.th, 800, -BAND.top / 2 - 12);
  ctx.fillStyle = goldGrad(ctx, 0, -BAND.top + 10, 0, -10);
  ctx.fillText(TROUPE.th, 800, -BAND.top / 2 - 12);
  ctx.font = `28px ${titleFont}`;
  ctx.lineWidth = 5;
  ctx.strokeText(TROUPE.sub, 800, -BAND.top / 2 + 34);
  ctx.fillStyle = '#f0cf7c';
  ctx.fillText(TROUPE.sub, 800, -BAND.top / 2 + 34);

  // ties lashing the cloth to the frame
  for (let x = 60; x < 1560; x += 120) { tie(ctx, x, BAND.inset - 2, 0, -1); tie(ctx, x + 30, 1000 - BAND.inset + 2, 0, 1); }
  for (let y = 70; y < 960; y += 120) { tie(ctx, BAND.inset - 2, y, -1, 0); tie(ctx, 1600 - BAND.inset + 2, y, 1, 0); }

  // ---------------------------------------------------------- posts
  for (const cx of [-135, 1735]) post(ctx, cx, -100, 1440);

  // ---------------------------------------------------------- roof
  roof(ctx, r);

  // gold รวงผึ้ง valance under the eave, above the frame
  valance(ctx, -100, -150, 1800, 72);

  // loudspeaker horn on the left post
  horn(ctx, -135, -40);

  grain(ctx, BOOTH.x0, BOOTH.y0, W, H, 0.55);
  // re-open the cloth hole cleanly (grain & strokes may have spilled)
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(BAND.inset, BAND.inset, 1600 - BAND.inset * 2, 1000 - BAND.inset * 2);
  ctx.restore();
  return { canvas: c, k, x0: BOOTH.x0, y0: BOOTH.y0, w: W, h: H };
}

// ------------------------------------------------------------ pieces
function gildLine(ctx, pts, w) {
  ctx.save();
  ctx.lineWidth = w + 2;
  ctx.strokeStyle = '#3a1d05';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.lineWidth = w;
  ctx.strokeStyle = goldGrad(ctx, pts[0][0], pts[0][1] - w, pts[0][0], pts[0][1] + w);
  ctx.stroke();
  ctx.restore();
}

function gildRect(ctx, x, y, w, h, lw) {
  ctx.save();
  ctx.lineWidth = lw + 2;
  ctx.strokeStyle = '#2e1604';
  ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = lw;
  ctx.strokeStyle = goldGrad(ctx, x, y, x + w * 0.3, y + h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function velvet(ctx, x, y, w, h) {
  const r = rng(21);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  for (let i = 0; i < 900; i++) {
    const px = x + r() * w, py = y + r() * h;
    ctx.fillStyle = r() < 0.5 ? 'rgba(255,120,90,0.06)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(px, py, 14 + r() * 40, 2 + r() * 3);
  }
  ctx.restore();
}

function woodGrain(ctx, x, y, w, h) {
  const r = rng(31);
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = WOOD_L;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 160; i++) {
    const yy = y + r() * h;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    for (let xx = x; xx < x + w; xx += 40) ctx.lineTo(xx, yy + Math.sin(xx * 0.01 + i) * 3);
    ctx.stroke();
  }
  ctx.restore();
}

// ขัดแตะ woven bamboo panel
function wovenWall(ctx, x, y, w, h, seed) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#6b4a26';
  ctx.fillRect(x, y, w, h);
  const s = 22;
  const r = rng(seed);
  for (let yy = y - s; yy < y + h + s; yy += s) {
    for (let xx = x - s; xx < x + w + s; xx += s) {
      const odd = (Math.round((xx - x) / s) + Math.round((yy - y) / s)) % 2;
      const tone = 0.75 + r() * 0.35;
      const g = odd ? ctx.createLinearGradient(xx, yy, xx + s, yy) : ctx.createLinearGradient(xx, yy, xx, yy + s);
      g.addColorStop(0, `rgba(${150 * tone | 0},${108 * tone | 0},${58 * tone | 0},1)`);
      g.addColorStop(0.5, `rgba(${196 * tone | 0},${150 * tone | 0},${86 * tone | 0},1)`);
      g.addColorStop(1, `rgba(${120 * tone | 0},${84 * tone | 0},${44 * tone | 0},1)`);
      ctx.fillStyle = g;
      ctx.fillRect(xx + 1, yy + 1, s - 2, s - 2);
      ctx.strokeStyle = 'rgba(40,24,10,0.5)';
      ctx.lineWidth = 1;
      if (odd) { ctx.beginPath(); ctx.moveTo(xx + 1, yy + s / 2); ctx.lineTo(xx + s - 1, yy + s / 2); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(xx + s / 2, yy + 1); ctx.lineTo(xx + s / 2, yy + s - 1); ctx.stroke(); }
    }
  }
  // soot / age toward the bottom
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(20,10,4,0.35)');
  g.addColorStop(0.5, 'rgba(20,10,4,0.1)');
  g.addColorStop(1, 'rgba(20,10,4,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = '#2a170a';
  ctx.lineWidth = 6;
  ctx.strokeRect(x, y, w, h);
}

function tie(ctx, x, y, nx, ny) {
  ctx.save();
  ctx.strokeStyle = '#d9c9a4';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x - ny * 4, y - nx * 4);
  ctx.lineTo(x + nx * 22 - ny * 5, y + ny * 22 - nx * 5);
  ctx.moveTo(x + ny * 4, y + nx * 4);
  ctx.lineTo(x + nx * 22 + ny * 5, y + ny * 22 + nx * 5);
  ctx.stroke();
  ctx.fillStyle = '#e8dcbc';
  ctx.beginPath();
  ctx.arc(x + nx * 22, y + ny * 22, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function post(ctx, cx, y0, y1) {
  const w = 70;
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, '#2e0806');
  g.addColorStop(0.35, '#8d2016');
  g.addColorStop(0.55, '#a8341f');
  g.addColorStop(1, '#250605');
  ctx.fillStyle = g;
  ctx.fillRect(cx - w / 2, y0, w, y1 - y0);
  // gold bands with lai
  for (let y = y0 + 140; y < 1150; y += 250) {
    ctx.fillStyle = goldGrad(ctx, cx - w / 2, y, cx + w / 2, y + 26);
    ctx.fillRect(cx - w / 2 - 2, y, w + 4, 26);
    ctx.strokeStyle = '#3d1f06';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - w / 2 - 2, y, w + 4, 26);
    for (let i = 0; i < 4; i++) prajam(ctx, cx - 26 + i * 17.5, y + 13, 7, { petal: '#7a1a12', center: '#f2d27a', line: '#3d1f06' });
    // hanging krajang below the band
    for (let i = 0; i < 5; i++) krajang(ctx, cx - 28 + i * 14, y + 26, 12, 18, Math.PI / 2, '#d8a847', '#3d1f06', null);
  }
  // lotus capital (บัวหัวเสา)
  const top = y0;
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    krajang(ctx, cx - w / 2 + 2 + t * (w - 4), top + 4, 16, 34, -Math.PI / 2, '#e2b24e', '#3d1f06', '#2f6d31');
  }
  ctx.fillStyle = goldGrad(ctx, cx - w, top - 30, cx + w, top);
  roundRect(ctx, cx - w / 2 - 14, top - 34, w + 28, 18, 5);
  ctx.fill();
  ctx.strokeStyle = '#3d1f06';
  ctx.stroke();
  // highlight
  ctx.fillStyle = 'rgba(255,210,160,0.08)';
  ctx.fillRect(cx - 6, y0, 6, y1 - y0);
}

function roof(ctx, r) {
  // lower wide roof (tiles), seen from the front
  const eave = -64, top = -262;
  const L0 = -470, R0 = 2070, L1 = -210, R1 = 1810;
  const roofPath = new Path2D();
  roofPath.moveTo(L0, eave);
  roofPath.lineTo(L1, top);
  roofPath.lineTo(R1, top);
  roofPath.lineTo(R0, eave);
  roofPath.closePath();
  ctx.save();
  ctx.clip(roofPath);
  const tg = ctx.createLinearGradient(0, top, 0, eave);
  tg.addColorStop(0, '#6b2a12');
  tg.addColorStop(1, '#a8471b');
  ctx.fillStyle = tg;
  ctx.fill(roofPath);
  // tile rows
  for (let y = top + 8, row = 0; y < eave + 10; y += 22, row++) {
    const t = (y - top) / (eave - top);
    const xl = L1 + (L0 - L1) * t, xr = R1 + (R0 - R1) * t;
    const green = row < 1 || y > eave - 26;
    for (let x = xl + (row % 2) * 16; x < xr; x += 32) {
      const edge = x < xl + 70 || x > xr - 70;
      ctx.fillStyle = green || edge ? (r() < 0.5 ? '#2f5d3c' : '#284f33') : r() < 0.5 ? '#b8541f' : '#a34a1b';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30, y);
      ctx.quadraticCurveTo(x + 32, y + 18, x + 15, y + 24);
      ctx.quadraticCurveTo(x - 2, y + 18, x, y);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,10,4,0.55)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,170,0.12)';
      ctx.fillRect(x + 4, y + 2, 10, 3);
    }
  }
  ctx.restore();
  // roof edge boards (ป้านลม) & eave fascia
  ctx.strokeStyle = '#2b1206';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(L0 - 10, eave + 4); ctx.lineTo(L1, top); ctx.lineTo(R1, top); ctx.lineTo(R0 + 10, eave + 4);
  ctx.stroke();
  ctx.lineWidth = 8;
  ctx.strokeStyle = goldGrad(ctx, 0, top - 8, 0, eave + 8);
  ctx.stroke();
  // eave fascia (เชิงชาย) with hanging lace
  ctx.fillStyle = '#3a130a';
  ctx.fillRect(L0, eave - 4, R0 - L0, 26);
  gildLine(ctx, [[L0, eave + 22], [R0, eave + 22]], 4);
  for (let x = L0 + 18; x < R0; x += 36) krajang(ctx, x, eave + 22, 20, 30, Math.PI / 2, '#d8a847', '#3a1c05', RED);
  // hang hong at the eave corners
  hangHong(ctx, L0 - 6, eave + 2, -1);
  hangHong(ctx, R0 + 6, eave + 2, 1);

  // central gable (มุข) — หน้าบัน
  const ax = 800, ay = -520, bl = 380, br = 1220, by = -150;
  const gable = new Path2D();
  gable.moveTo(bl, by); gable.lineTo(ax, ay); gable.lineTo(br, by); gable.closePath();
  // roof slopes of the gable (tiles, darker)
  ctx.save();
  const slope = new Path2D();
  slope.moveTo(bl - 70, by + 30); slope.lineTo(ax, ay - 34); slope.lineTo(br + 70, by + 30);
  slope.lineTo(br + 30, by + 30); slope.lineTo(ax, ay + 10); slope.lineTo(bl - 30, by + 30); slope.closePath();
  ctx.fillStyle = '#2f5d3c';
  ctx.fill(slope);
  ctx.restore();
  // panel
  ctx.save();
  ctx.clip(gable);
  const pg = ctx.createLinearGradient(0, ay, 0, by);
  pg.addColorStop(0, '#6e120d');
  pg.addColorStop(1, '#8f1d14');
  ctx.fillStyle = pg;
  ctx.fill(gable);
  // gold kranok infill (หน้าบันลายก้านขด)
  for (let i = 0; i < 70; i++) {
    const t = r(), u = r();
    const y = ay + 60 + t * (by - ay - 70);
    const half = ((y - ay) / (by - ay)) * (br - bl) / 2 - 20;
    const x = ax + (u * 2 - 1) * half;
    if (Math.hypot(x - ax, y - (by - 150)) < 118) continue;
    kanok(ctx, x, y, 22 + r() * 14, -Math.PI / 2 + (r() - 0.5) * 2.2, r() < 0.5, '#d8a847', '#3a1c05');
  }
  // spiral scrolls
  ctx.strokeStyle = '#e1b453';
  ctx.lineWidth = 4;
  for (const side of [-1, 1]) {
    for (let s = 0; s < 3; s++) {
      const cx = ax + side * (150 + s * 95), cy = by - 55 - s * 18;
      ctx.beginPath();
      for (let k = 0; k < 60; k++) {
        const a = k * 0.22, rr = 34 * (1 - k / 64);
        const px = cx + side * Math.cos(a) * rr, py = cy - Math.sin(a) * rr;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
  // central medallion: golden hermit face in a lotus halo (the patron of the show)
  const mx = ax, my = by - 150;
  const halo = ctx.createRadialGradient(mx, my, 10, mx, my, 120);
  halo.addColorStop(0, '#ffe7a0');
  halo.addColorStop(0.6, '#d49a36');
  halo.addColorStop(1, '#7a4610');
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    krajang(ctx, mx + Math.cos(a) * 84, my + Math.sin(a) * 84, 30, 46, a, '#e7bb57', '#3a1c05', '#a3201a');
  }
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(mx, my, 90, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a1c05'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(mx, my, 74, 0, Math.PI * 2); ctx.strokeStyle = '#8a1a12'; ctx.lineWidth = 6; ctx.stroke();
  prajam(ctx, mx, my, 56, { petal: '#fbe2a0', center: '#9a1d15', line: '#5a3208' });
  // gable frame boards + ใบระกา blades
  ctx.strokeStyle = '#2b1206';
  ctx.lineWidth = 20;
  ctx.beginPath(); ctx.moveTo(bl - 40, by + 16); ctx.lineTo(ax, ay - 10); ctx.lineTo(br + 40, by + 16); ctx.stroke();
  ctx.lineWidth = 12;
  ctx.strokeStyle = goldGrad(ctx, bl, ay, br, by);
  ctx.stroke();
  for (const side of [-1, 1]) {
    const x0 = ax, y0 = ay - 10, x1 = side < 0 ? bl - 40 : br + 40, y1 = by + 16;
    const n = 15;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const a = Math.atan2(y1 - y0, x1 - x0) + (side < 0 ? Math.PI / 2 : -Math.PI / 2);
      baiRaka(ctx, x, y, 34, a, side);
    }
  }
  hangHong(ctx, bl - 44, by + 16, -1, 1.3);
  hangHong(ctx, br + 44, by + 16, 1, 1.3);
  chofa(ctx, ax, ay - 12);
}

// ใบระกา: a serrated blade standing out from the gable edge
function baiRaka(ctx, x, y, s, a, side) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(-s * 0.18, 0);
  ctx.quadraticCurveTo(-s * 0.2, -s * 0.6, s * 0.12 * side, -s * 1.05);
  ctx.quadraticCurveTo(s * 0.26 * side, -s * 0.55, s * 0.2, 0);
  ctx.closePath();
  ctx.fillStyle = goldGrad(ctx, 0, -s, 0, 0);
  ctx.fill();
  ctx.strokeStyle = '#3a1c05';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

// ช่อฟ้า: slender hooked finial like a bird's head at the gable apex
function chofa(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  const p = new Path2D();
  p.moveTo(-9, 10);
  p.bezierCurveTo(-14, -40, -2, -80, 10, -110);
  p.bezierCurveTo(22, -140, 46, -150, 58, -134);
  p.bezierCurveTo(62, -126, 54, -120, 44, -124);
  p.bezierCurveTo(30, -128, 24, -110, 22, -92);
  p.bezierCurveTo(18, -60, 10, -30, 10, 10);
  p.closePath();
  ctx.fillStyle = goldGrad(ctx, -10, -150, 60, 10);
  ctx.fill(p);
  ctx.strokeStyle = '#3a1c05';
  ctx.lineWidth = 2.4;
  ctx.stroke(p);
  ctx.restore();
}

// หางหงส์: the swan-tail curl at the lower ends of the gable boards
function hangHong(ctx, x, y, side, k = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side * k, k);
  const p = new Path2D();
  p.moveTo(0, -6);
  p.bezierCurveTo(26, -8, 44, -28, 44, -52);
  p.bezierCurveTo(44, -68, 30, -74, 22, -66);
  p.bezierCurveTo(16, -60, 22, -50, 30, -52);
  p.bezierCurveTo(28, -30, 14, -14, 0, 8);
  p.closePath();
  ctx.fillStyle = goldGrad(ctx, 0, -70, 40, 10);
  ctx.fill(p);
  ctx.strokeStyle = '#3a1c05';
  ctx.lineWidth = 2;
  ctx.stroke(p);
  ctx.restore();
}

// รวงผึ้ง: carved golden lace valance
function valance(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#4b0f0a';
  ctx.fillRect(x, y - h + 10, w, h);
  const n = Math.round(w / 64);
  for (let i = 0; i < n; i++) {
    const cx = x + (i + 0.5) * (w / n);
    // scalloped lace drop
    ctx.beginPath();
    ctx.moveTo(cx - w / n / 2, y - 8);
    ctx.quadraticCurveTo(cx, y + 34, cx + w / n / 2, y - 8);
    ctx.lineTo(cx + w / n / 2, y - h + 14);
    ctx.lineTo(cx - w / n / 2, y - h + 14);
    ctx.closePath();
    ctx.fillStyle = goldGrad(ctx, cx - 30, y - h, cx + 30, y + 30);
    ctx.fill();
    ctx.strokeStyle = '#3a1c05';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // cut-outs
    ctx.fillStyle = '#3d0c08';
    ctx.beginPath(); ctx.arc(cx, y - h / 2 + 4, 11, 0, Math.PI * 2); ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * 18, y - h / 2 + 8, 5, 10, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(cx - 6, y + 6); ctx.lineTo(cx, y + 20); ctx.lineTo(cx + 6, y + 6); ctx.fill();
    prajam(ctx, cx, y - h / 2 + 4, 8, { petal: '#f1cf78', center: '#a3201a', line: '#3a1c05' });
  }
  gildLine(ctx, [[x, y - h + 12], [x + w, y - h + 12]], 5);
  ctx.restore();
}

function horn(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#9ea39b';
  ctx.strokeStyle = '#2c2f2a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, 0); ctx.lineTo(-48, -52); ctx.quadraticCurveTo(-62, -62, -70, -44); ctx.lineTo(-10, 12); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5b5f58';
  ctx.beginPath(); ctx.ellipse(-60, -52, 16, 7, -0.85, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// The banana trunk (หยวกกล้วย) laid along the bottom of the screen behind
// the cloth — puppets not in use are stuck into it. Returns a leather
// Sprite for the shadow pass (spanning the full width).
export function bananaTrunkSprite() {
  return paintSprite(1640, 70, (ctx, { rng: r }) => {
    const pts = [];
    for (let x = 0; x <= 1640; x += 40) pts.push([x, 12 + Math.sin(x * 0.013) * 4 + r() * 3]);
    pts.push([1640, 70], [0, 70]);
    leather(ctx, poly(pts), { edge: false });
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(70,64,40,0.5)';
    ctx.fillRect(0, 0, 1640, 70);
    ctx.restore();
    // fibrous leaf-sheath lines let a little light through
    for (let i = 0; i < 18; i++) {
      const y = 24 + i * 2.6;
      slit(ctx, [[0, y + r() * 2], [410, y + r() * 3], [820, y + r() * 2], [1230, y + r() * 3], [1640, y + r() * 2]], 0.35);
    }
  }, { name: 'banana-trunk', pad: 4, px: 1 });
}
