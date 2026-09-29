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

// Thai mural cloud (เมฆ): a cluster of scalloped lobes with curled
// spiral ends, cream fill and gold/ochre outlines.
export function thaiCloud(ctx, x, y, w, h, { seed = 1, fill = '#f4e7c8', shade = '#d9b98a', line = '#b0772c', glow = null, lobes = 7, curls = true, alpha = 1 } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  const circles = [];
  for (let i = 0; i < lobes; i++) {
    const t = lobes === 1 ? 0.5 : i / (lobes - 1);
    const cx = (t - 0.5) * w * 0.82;
    const bump = Math.sin(t * Math.PI);
    const rr = h * (0.3 + bump * 0.32) * (0.85 + r() * 0.3);
    circles.push([cx, h * 0.18 - bump * h * 0.28 + (r() - 0.5) * h * 0.1, rr]);
  }
  const path = new Path2D();
  for (const [cx, cy, rr] of circles) {
    path.moveTo(cx + rr, cy);
    path.arc(cx, cy, rr, 0, Math.PI * 2);
  }
  // flat base
  path.rect(-w * 0.41, h * 0.05, w * 0.82, h * 0.3);
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = h * 0.5;
  }
  const g = ctx.createLinearGradient(0, -h * 0.6, 0, h * 0.4);
  g.addColorStop(0, fill);
  g.addColorStop(1, shade);
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.shadowBlur = 0;
  // outlines: arcs on the upper half of each lobe
  ctx.strokeStyle = line;
  ctx.lineWidth = Math.max(1, h * 0.035);
  ctx.lineCap = 'round';
  for (const [cx, cy, rr] of circles) {
    ctx.beginPath();
    ctx.arc(cx, cy, rr, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    // inner echo line
    ctx.globalAlpha = alpha * 0.45;
    ctx.beginPath();
    ctx.arc(cx, cy + rr * 0.12, rr * 0.72, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }
  if (curls) {
    // spiral tails at both ends
    for (const side of [-1, 1]) {
      const sx = side * w * 0.44, sy = h * 0.2;
      ctx.beginPath();
      for (let k = 0; k < 40; k++) {
        const a = k * 0.28;
        const rr = h * 0.22 * (1 - k / 44);
        const px = sx + side * Math.cos(a) * rr, py = sy - Math.sin(a) * rr;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
  }
  // base line
  ctx.beginPath();
  ctx.moveTo(-w * 0.42, h * 0.35);
  ctx.bezierCurveTo(-w * 0.2, h * 0.42, w * 0.2, h * 0.28, w * 0.42, h * 0.35);
  ctx.stroke();
  ctx.restore();
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
