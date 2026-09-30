// Painting helpers for the front-lit scenery (booth, heaven, village):
// Thai mural style — flat lacquer colours, gold leaf line work, grain.

import { rng, curve, poly, smooth, krajangPath, kanokPts, makeCanvas } from '../art/leather.js';

export { rng, curve, poly, smooth, krajangPath, kanokPts, makeCanvas };

export const GOLD = ['#f6dc8a', '#e0b04c', '#b27a25', '#6f4410'];

export function goldGrad(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#fff0b8');
  g.addColorStop(0.25, '#f0c865');
  g.addColorStop(0.55, '#c4902f');
  g.addColorStop(0.8, '#f2d27a');
  g.addColorStop(1, '#8f5e1c');
  return g;
}

export function jitterPts(pts, amt, seed = 1) {
  const r = rng(seed);
  return pts.map(([x, y]) => [x + (r() - 0.5) * amt, y + (r() - 0.5) * amt]);
}

// Fine film/paper grain over the current clip.
let _grain = null;
export function grainPattern(ctx) {
  if (!_grain) {
    const c = makeCanvas(160, 160);
    const g = c.getContext('2d');
    const d = g.createImageData(160, 160);
    const r = rng(99);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = r() * 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 22;
    }
    g.putImageData(d, 0, 0);
    _grain = c;
  }
  return ctx.createPattern(_grain, 'repeat');
}

export function grain(ctx, x, y, w, h, alpha = 0.5, op = 'overlay') {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = op;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// A gold kranok scroll (flame leaf) filled + outlined.
export function kanok(ctx, x, y, size, angle, flip, fill = '#e2b24e', stroke = '#5b3208') {
  const p = poly(kanokPts(x, y, size, angle, flip));
  ctx.fillStyle = fill;
  ctx.fill(p);
  ctx.lineWidth = Math.max(0.6, size * 0.05);
  ctx.strokeStyle = stroke;
  ctx.stroke(p);
}

export function krajang(ctx, x, y, w, h, angle = -Math.PI / 2, fill = '#e2b24e', stroke = '#5b3208', inner = '#a8201a') {
  const p = krajangPath(x, y, w, h, angle);
  ctx.fillStyle = fill;
  ctx.fill(p);
  ctx.lineWidth = Math.max(0.6, w * 0.06);
  ctx.strokeStyle = stroke;
  ctx.stroke(p);
  if (inner) {
    const q = krajangPath(x + Math.cos(angle) * h * 0.1, y + Math.sin(angle) * h * 0.1, w * 0.5, h * 0.62, angle);
    ctx.fillStyle = inner;
    ctx.fill(q);
  }
}

// Row of krajang leaves along a straight line from (x0,y0) to (x1,y1),
// standing on the left normal.
export function krajangLine(ctx, x0, y0, x1, y1, size, opts = {}) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.round(L / (size * 0.9)));
  const a = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    krajang(ctx, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, size, size * 1.35, a, opts.fill, opts.stroke, opts.inner);
  }
}

// Four-petal ประจำยาม medallion (front-lit, gold on red).
export function prajam(ctx, x, y, s, { petal = '#e8bf5c', center = '#a3201a', line = '#4e2a08' } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const c = Math.cos(a), si = Math.sin(a);
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(c * s * 0.35 - si * s * 0.34, si * s * 0.35 + c * s * 0.34, c * s, si * s);
    ctx.quadraticCurveTo(c * s * 0.35 + si * s * 0.34, si * s * 0.35 - c * s * 0.34, 0, 0);
  }
  ctx.fillStyle = petal;
  ctx.fill();
  ctx.lineWidth = s * 0.07;
  ctx.strokeStyle = line;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = center;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.11, 0, Math.PI * 2);
  ctx.fillStyle = petal;
  ctx.fill();
  ctx.restore();
}

// Handmade paper: fibrous tooth + faint mottling, generated once.
let _paper = null;
export function paperPattern(ctx) {
  if (!_paper) {
    const S = 256;
    const c = makeCanvas(S, S);
    const g = c.getContext('2d');
    const r = rng(41);
    const d = g.createImageData(S, S);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 200 + r() * 55;
      d.data[i] = v; d.data[i + 1] = v * 0.97; d.data[i + 2] = v * 0.9; d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    // long fibres
    for (let i = 0; i < 420; i++) {
      const x = r() * S, y = r() * S, a = r() * Math.PI, L = 6 + r() * 26;
      g.strokeStyle = r() < 0.5 ? 'rgba(120,95,60,0.18)' : 'rgba(255,255,245,0.35)';
      g.lineWidth = 0.6 + r() * 0.8;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * L * 0.5 + (r() - 0.5) * 6, x + Math.cos(a) * L, y + Math.sin(a) * L);
      g.stroke();
    }
    _paper = c;
  }
  return ctx.createPattern(_paper, 'repeat');
}

// Lay paper texture over the shape just filled (multiply keeps colour).
export function paperTexture(ctx, path, alpha = 0.55) {
  ctx.save();
  ctx.clip(path);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = paperPattern(ctx);
  ctx.fill(path);
  ctx.restore();
}

// Fill a path as a cut piece of paper: soft cast shadow, flat colour,
// fibre texture and a bright deckled top edge where it catches the light.
export function paperPiece(ctx, path, color, { shadow = 'rgba(40,20,10,0.35)', lift = 6, edge = 'rgba(255,248,230,0.55)', tex = 0.5 } = {}) {
  // stacked offset copies fake a soft cast shadow without shadowBlur
  ctx.save();
  ctx.fillStyle = shadow;
  ctx.globalAlpha = 0.45;
  for (const k of [1, 0.6]) {
    ctx.save();
    ctx.translate(lift * 0.35 * k, lift * k);
    ctx.fill(path);
    ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = color;
  ctx.fill(path);
  paperTexture(ctx, path, tex);
  if (edge) {
    ctx.save();
    ctx.clip(path);
    ctx.translate(0, Math.max(1, lift * 0.25));
    ctx.strokeStyle = edge;
    ctx.lineWidth = Math.max(1, lift * 0.35);
    ctx.stroke(path);
    ctx.restore();
  }
}

function cloudPath(w, h, r, lobes) {
  const circles = [];
  for (let i = 0; i < lobes; i++) {
    const t = lobes === 1 ? 0.5 : i / (lobes - 1);
    const bump = Math.sin(t * Math.PI);
    circles.push([(t - 0.5) * w * 0.82, h * 0.18 - bump * h * 0.28 + (r() - 0.5) * h * 0.1, h * (0.3 + bump * 0.32) * (0.85 + r() * 0.3)]);
  }
  const p = new Path2D();
  for (const [cx, cy, rr] of circles) { p.moveTo(cx + rr, cy); p.arc(cx, cy, rr, 0, Math.PI * 2); }
  p.rect(-w * 0.41, h * 0.05, w * 0.82, h * 0.3);
  // curled tails (Thai cloud spirals), cut as part of the paper
  for (const side of [-1, 1]) {
    const sx = side * w * 0.43, sy = h * 0.22;
    p.moveTo(sx, sy);
    p.arc(sx, sy, h * 0.16, 0, Math.PI * 2);
  }
  return { p, circles };
}

// Thai mural cloud (เมฆ) as layered cut paper: three stacked sheets in
// deepening tones, each casting a soft shadow, with a cut spiral line.
export function thaiCloud(ctx, x, y, w, h, { seed = 1, fill = '#f4e7c8', shade = '#d9b98a', line = '#b0772c', glow = null, lobes = 7, curls = true, alpha = 1 } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (glow) {
    const g = ctx.createRadialGradient(0, 0, h * 0.2, 0, 0, w * 0.6);
    g.addColorStop(0, glow.replace(/[\d.]+\)$/, '0.35)'));
    g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-w * 0.7, -h * 1.2, w * 1.4, h * 2.2);
  }
  const tones = [shade, mix(shade, fill, 0.5), fill];
  const lift = Math.max(2, h * 0.05);
  tones.forEach((col, k) => {
    const s = 1 - k * 0.16;
    ctx.save();
    ctx.translate((r() - 0.5) * w * 0.05, -k * h * 0.12);
    ctx.scale(s, s);
    const { p, circles } = cloudPath(w, h, r, lobes);
    paperPiece(ctx, p, col, { lift: lift / s, tex: 0.45 });
    if (curls && k === tones.length - 1) {
      ctx.strokeStyle = line;
      ctx.globalAlpha = alpha * 0.55;
      ctx.lineWidth = Math.max(1, h * 0.025);
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        const sx = side * w * 0.43, sy = h * 0.22;
        ctx.beginPath();
        for (let q = 0; q < 34; q++) {
          const a = q * 0.3, rr = h * 0.13 * (1 - q / 38);
          const px = sx + side * Math.cos(a) * rr, py = sy - Math.sin(a) * rr;
          q ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      for (const [cx, cy, rr] of circles.filter((_, i) => i % 2)) {
        ctx.beginPath(); ctx.arc(cx, cy + rr * 0.15, rr * 0.62, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
      }
    }
    ctx.restore();
  });
  ctx.restore();
}

function mix(a, b, t) {
  const pa = hex(a), pb = hex(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
}
function hex(c) {
  const m = c.match(/^#(..)(..)(..)$/);
  return m ? m.slice(1).map((x) => parseInt(x, 16)) : [230, 210, 180];
}

// Eight-pointed golden star (ดาวเพดาน, temple ceiling star).
export function ceilingStar(ctx, x, y, s, color = '#e9c060', core = '#a02a1c') {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? s * 0.42 : s;
    i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
