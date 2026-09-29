// Background realms, painted once into cached canvases:
//  - the night village (starry sky, moon with its rabbit, temple, palms,
//    fair lights) behind the booth;
//  - the heavenly realm above (golden sky, วิมาน palaces on clouds,
//    ดาวเพดาน stars, devas), in the manner of a Thai temple mural where
//    heaven is the top register separated by a band of clouds.

import { makeCanvas, rng, goldGrad, grain, thaiCloud, ceilingStar, krajang, prajam } from './paint.js';

export const NIGHT = { x0: -1500, y0: -700, x1: 3100, y1: 1500 };
export const HEAVEN = { x0: -1500, y0: -3400, x1: 3100, y1: -300 };

function region(R, k, draw) {
  const W = R.x1 - R.x0, H = R.y1 - R.y0;
  const c = makeCanvas(Math.ceil(W * k), Math.ceil(H * k));
  const ctx = c.getContext('2d');
  ctx.scale(k, k);
  ctx.translate(-R.x0, -R.y0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx, W, H);
  return { canvas: c, x0: R.x0, y0: R.y0, w: W, h: H };
}

// ---------------------------------------------------------------- night
export function paintNight(k = 0.4) {
  return region(NIGHT, k, (ctx) => {
    const r = rng(5);
    const { x0, y0, x1, y1 } = NIGHT;
    const g = ctx.createLinearGradient(0, y0, 0, 1250);
    g.addColorStop(0, '#0d1238');
    g.addColorStop(0.45, '#141a47');
    g.addColorStop(0.8, '#2a2550');
    g.addColorStop(1, '#4a2e3a');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // milky way haze
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 90; i++) {
      const t = r();
      const x = x0 + t * (x1 - x0), y = y0 + 150 + t * 700 + (r() - 0.5) * 260;
      const rr = 60 + r() * 160;
      const gg = ctx.createRadialGradient(x, y, 0, x, y, rr);
      gg.addColorStop(0, 'rgba(120,120,190,0.05)');
      gg.addColorStop(1, 'rgba(120,120,190,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    // stars
    for (let i = 0; i < 900; i++) {
      const x = x0 + r() * (x1 - x0), y = y0 + r() * 1700;
      const s = r() < 0.04 ? 3.2 : 0.8 + r() * 1.4;
      ctx.fillStyle = `rgba(255,${230 + r() * 25 | 0},${200 + r() * 55 | 0},${0.35 + r() * 0.6})`;
      ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
    }
    ctx.restore();
    // moon with rabbit (กระต่ายในดวงจันทร์)
    const mx = 2450, my = -80, mr = 120;
    const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 4);
    halo.addColorStop(0, 'rgba(255,236,190,0.35)');
    halo.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    const mg = ctx.createRadialGradient(mx - 30, my - 30, 10, mx, my, mr);
    mg.addColorStop(0, '#fff8e2'); mg.addColorStop(1, '#e8d49c');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(160,130,80,0.32)';
    ctx.beginPath();
    ctx.ellipse(mx + 10, my + 20, 42, 30, -0.3, 0, 7);
    ctx.ellipse(mx - 30, my - 25, 14, 40, -0.5, 0, 7);
    ctx.ellipse(mx - 8, my - 30, 12, 38, -0.2, 0, 7);
    ctx.ellipse(mx + 45, my + 5, 20, 16, 0, 0, 7);
    ctx.fill();
    // distant hills
    ctx.fillStyle = '#1a1d42';
    ctx.beginPath();
    ctx.moveTo(x0, 1150);
    for (let x = x0; x <= x1; x += 80) ctx.lineTo(x, 980 - Math.sin(x * 0.0021) * 110 - Math.sin(x * 0.007) * 40);
    ctx.lineTo(x1, 1500); ctx.lineTo(x0, 1500); ctx.fill();
    // temple silhouette left (โบสถ์ + เจดีย์), faintly lit
    temple(ctx, -900, 1060);
    // tree line
    ctx.fillStyle = '#0c0f24';
    ctx.beginPath();
    ctx.moveTo(x0, 1500);
    for (let x = x0; x <= x1; x += 30) ctx.lineTo(x, 1090 - Math.abs(Math.sin(x * 0.03)) * 50 - r() * 30);
    ctx.lineTo(x1, 1500); ctx.fill();
    // coconut palms
    for (const [x, h, lean] of [[-1150, 900, 0.1], [-600, 780, -0.15], [-420, 1020, 0.08], [2050, 960, -0.1], [2380, 820, 0.12], [2800, 1000, -0.05]]) palm(ctx, x, 1300, h, lean, r);
    // glowing fair stalls far away
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) {
      const x = (r() < 0.5 ? x0 + r() * 1300 : 1900 + r() * 1200), y = 1150 + r() * 120;
      const rr = 8 + r() * 26;
      const gg = ctx.createRadialGradient(x, y, 0, x, y, rr);
      const col = r() < 0.3 ? '255,120,80' : r() < 0.5 ? '120,200,255' : '255,200,120';
      gg.addColorStop(0, `rgba(${col},0.8)`); gg.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = gg;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.restore();
    // ground
    const gr = ctx.createLinearGradient(0, 1250, 0, 1500);
    gr.addColorStop(0, '#120c14'); gr.addColorStop(1, '#070508');
    ctx.fillStyle = gr;
    ctx.fillRect(x0, 1300, x1 - x0, 200);
    grain(ctx, x0, y0, x1 - x0, y1 - y0, 0.35);
  });
}

function temple(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#151434';
  ctx.strokeStyle = 'rgba(230,180,90,0.35)';
  ctx.lineWidth = 3;
  const tiers = [[360, 90], [280, 80], [200, 70]];
  let yy = y;
  ctx.fillRect(x - 200, y - 10, 400, 60);
  for (const [w, h] of tiers) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, yy); ctx.lineTo(x - w / 4, yy - h); ctx.lineTo(x + w / 4, yy - h); ctx.lineTo(x + w / 2, yy);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // chofa hooks
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(x + s * w / 2, yy); ctx.quadraticCurveTo(x + s * (w / 2 + 20), yy - 10, x + s * (w / 2 + 10), yy - 36); ctx.stroke();
    }
    yy -= h * 0.8;
  }
  ctx.beginPath(); ctx.moveTo(x, yy - 60); ctx.lineTo(x - 8, yy); ctx.lineTo(x + 8, yy); ctx.fill(); ctx.stroke();
  // chedi
  const cx = x + 360;
  ctx.beginPath();
  ctx.moveTo(cx - 90, y + 40); ctx.lineTo(cx - 70, y - 60);
  ctx.quadraticCurveTo(cx - 80, y - 170, cx, y - 200);
  ctx.quadraticCurveTo(cx + 80, y - 170, cx + 70, y - 60);
  ctx.lineTo(cx + 90, y + 40); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 12, y - 195); ctx.lineTo(cx, y - 420); ctx.lineTo(cx + 12, y - 195); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function palm(ctx, x, y, h, lean, r) {
  ctx.save();
  ctx.strokeStyle = '#080a1a';
  ctx.fillStyle = '#080a1a';
  ctx.lineWidth = 16;
  const tx = x + lean * h, ty = y - h;
  ctx.beginPath();
  ctx.moveTo(x, y + 200);
  ctx.quadraticCurveTo(x + lean * h * 0.2, y - h * 0.5, tx, ty);
  ctx.stroke();
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + r() * 0.3;
    const L = 160 + r() * 90;
    const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.55 + L * 0.35;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + Math.cos(a) * L * 0.6, ty + Math.sin(a) * L * 0.3 - 40, ex, ey);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    for (let t = 0.15; t < 1; t += 0.07) {
      const px = tx + (ex - tx) * t, py = ty + (ey - ty) * t - Math.sin(t * Math.PI) * 40;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a + 1.3) * 30 * (1 - t), py + 34 * (1 - t) + 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a - 1.3) * 30 * (1 - t), py + 34 * (1 - t) + 6); ctx.stroke();
    }
  }
  ctx.restore();
}

// --------------------------------------------------------------- heaven
export function paintHeaven(k = 0.35) {
  return region(HEAVEN, k, (ctx) => {
    const r = rng(8);
    const { x0, y0, x1, y1 } = HEAVEN;
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#2b1446');
    g.addColorStop(0.25, '#7a3a5a');
    g.addColorStop(0.5, '#e0a458');
    g.addColorStop(0.7, '#f6d993');
    g.addColorStop(0.88, '#8c6a8a');
    g.addColorStop(1, '#0d1238');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // radiant halo of the heavenly realm
    const hx = 800, hy = -2050;
    const halo = ctx.createRadialGradient(hx, hy, 40, hx, hy, 1500);
    halo.addColorStop(0, 'rgba(255,250,215,0.95)');
    halo.addColorStop(0.25, 'rgba(255,220,140,0.55)');
    halo.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // rays
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 + r() * 0.05;
      ctx.fillStyle = `rgba(255,230,160,${0.03 + r() * 0.05})`;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(a - 0.03) * 3000, hy + Math.sin(a - 0.03) * 3000);
      ctx.lineTo(hx + Math.cos(a + 0.03) * 3000, hy + Math.sin(a + 0.03) * 3000);
      ctx.fill();
    }
    ctx.restore();
    // ดาวเพดาน ceiling stars in the upper register
    for (let y = y0 + 100; y < -2500; y += 150) {
      for (let x = x0 + ((y / 150) % 2) * 75; x < x1; x += 150) {
        ceilingStar(ctx, x + (r() - 0.5) * 20, y, 18 + r() * 6, 'rgba(240,196,96,0.85)', 'rgba(150,30,30,0.9)');
      }
    }
    // central wheel / lotus throne of light
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      krajang(ctx, hx + Math.cos(a) * 230, hy + Math.sin(a) * 230, 70, 110, a, 'rgba(250,215,120,0.9)', '#7a4a10', '#b8402a');
    }
    ctx.fillStyle = goldGrad(ctx, hx - 200, hy - 200, hx + 200, hy + 200);
    ctx.beginPath(); ctx.arc(hx, hy, 200, 0, 7); ctx.fill();
    ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 6; ctx.stroke();
    prajam(ctx, hx, hy, 150, { petal: '#fff0b8', center: '#b8402a', line: '#7a4a10' });
    // palaces (วิมาน) on clouds
    for (const [x, y, s] of [[-700, -1500, 1.1], [2300, -1550, 1.15], [120, -1150, 0.75], [1500, -1120, 0.8], [800, -1650, 0.6]]) {
      vimana(ctx, x, y, s);
      for (let i = 0; i < 4; i++) thaiCloud(ctx, x + (i - 1.5) * 190 * s, y + 70 * s, 360 * s, 120 * s, { seed: x + i, glow: 'rgba(255,220,150,0.6)' });
    }
    // devas seated on clouds
    for (const [x, y] of [[-250, -1850], [1850, -1880], [-1100, -2250], [2700, -2200], [450, -2500], [1150, -2550]]) {
      deva(ctx, x, y, 0.9 + r() * 0.3);
      thaiCloud(ctx, x, y + 60, 260, 90, { seed: y, glow: 'rgba(255,220,150,0.5)' });
    }
    // lower cloud register (สินเทา band) separating heaven from earth
    for (let i = 0; i < 26; i++) {
      const x = x0 + i * 190 + r() * 60;
      thaiCloud(ctx, x, -560 + r() * 140, 420 + r() * 200, 150 + r() * 70, { seed: i * 7, fill: '#f7ecd2', shade: '#caa77e', glow: 'rgba(255,215,150,0.5)' });
    }
    grain(ctx, x0, y0, x1 - x0, y1 - y0, 0.4);
  });
}

function vimana(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.shadowColor = 'rgba(255,220,140,0.9)';
  ctx.shadowBlur = 40;
  const gold = goldGrad(ctx, -200, -500, 200, 0);
  ctx.fillStyle = gold;
  ctx.strokeStyle = '#6e3f0c';
  ctx.lineWidth = 4;
  ctx.fillRect(-220, -80, 440, 80);
  ctx.strokeRect(-220, -80, 440, 80);
  ctx.shadowBlur = 0;
  // columns
  ctx.fillStyle = '#a3261c';
  for (let i = -3; i <= 3; i++) ctx.fillRect(i * 60 - 8, -200, 16, 120);
  ctx.fillStyle = gold;
  // tiered roofs + spires
  const spire = (cx, base, w, h) => {
    for (let t = 0; t < 4; t++) {
      const ww = w * (1 - t * 0.2), yy = base - t * h * 0.18;
      ctx.beginPath();
      ctx.moveTo(cx - ww / 2, yy); ctx.lineTo(cx - ww / 4, yy - h * 0.2); ctx.lineTo(cx + ww / 4, yy - h * 0.2); ctx.lineTo(cx + ww / 2, yy);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.12, base - h * 0.7); ctx.lineTo(cx, base - h * 1.35); ctx.lineTo(cx + w * 0.12, base - h * 0.7);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  };
  spire(-170, -200, 110, 220);
  spire(170, -200, 110, 220);
  spire(0, -200, 260, 380);
  ctx.restore();
}

function deva(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // halo
  const h = ctx.createRadialGradient(0, -80, 5, 0, -80, 70);
  h.addColorStop(0, 'rgba(255,245,200,0.9)'); h.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = h;
  ctx.beginPath(); ctx.arc(0, -80, 70, 0, 7); ctx.fill();
  ctx.fillStyle = '#b8402a';
  ctx.strokeStyle = '#6e3f0c';
  ctx.lineWidth = 3;
  // body kneeling in wai, simple mural silhouette
  ctx.beginPath();
  ctx.moveTo(-40, 40); ctx.quadraticCurveTo(-45, -20, -18, -45);
  ctx.lineTo(18, -45); ctx.quadraticCurveTo(45, -20, 40, 40); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f1d3a6';
  ctx.beginPath(); ctx.ellipse(0, -68, 16, 20, 0, 0, 7); ctx.fill(); ctx.stroke();
  // chada crown
  ctx.fillStyle = goldGrad(ctx, -15, -150, 15, -80);
  ctx.beginPath(); ctx.moveTo(-16, -80); ctx.lineTo(0, -150); ctx.lineTo(16, -80); ctx.closePath(); ctx.fill(); ctx.stroke();
  // hands in wai
  ctx.fillStyle = '#f1d3a6';
  ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(0, -44); ctx.lineTo(6, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
  // floating sash
  ctx.strokeStyle = '#2f6d31';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-40, 0); ctx.bezierCurveTo(-90, -10, -80, 40, -130, 30); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(40, 0); ctx.bezierCurveTo(90, -10, 80, 40, 130, 30); ctx.stroke();
  ctx.restore();
}

// Individual cloud sprites for parallax layers (intro fly-through and
// the framing clouds around the stage).
export function paintCloudSprites(k = 0.5) {
  const out = [];
  for (let i = 0; i < 8; i++) {
    const w = 900 + (i % 3) * 250, h = 300 + (i % 2) * 80;
    const c = makeCanvas(Math.ceil((w + 200) * k), Math.ceil((h + 200) * k));
    const ctx = c.getContext('2d');
    ctx.scale(k, k);
    for (let j = 0; j < 3; j++) {
      thaiCloud(ctx, (w + 200) / 2 + (j - 1) * w * 0.25, (h + 200) / 2 + (j % 2) * 30, w * 0.7, h * 0.8, { seed: i * 13 + j, fill: '#fbf2dc', shade: '#d9b98a', line: '#b0772c', glow: 'rgba(255,220,160,0.7)' });
    }
    out.push({ canvas: c, w: w + 200, h: h + 200 });
  }
  return out;
}
