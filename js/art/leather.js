// Hand-cut leather art toolkit for หนังตะลุง puppets and props.
//
// Everything that appears on the shadow screen is a "leather" sprite: an
// RGBA canvas where
//   - alpha is the silhouette (cut-out) of the hide,
//   - RGB acts as the *transmittance* of the hide once the lamp shines
//     through it: near-black leather blocks the light, translucent dyes
//     glow in their colour, and punched perforations (alpha = 0) let the
//     lamp through as bright specks, exactly like the real ฉลุลาย work.
//
// Drawing functions work in WORLD UNITS (the shadow screen is 1600 x 1000
// units; a standing puppet is ~420 units tall). paintSprite() scales the
// canvas so one world unit = PX canvas pixels.

export const PX = 2;

// Dye palette. These read well both front-lit (UI thumbnails) and
// back-lit (on the screen), where they are raised to a power to get the
// deep glowing look of dyed hide.
export const INK = {
  leather: '#16100b',
  leather2: '#22170f',
  leatherHi: '#3a2718',
  red: '#b3261c',
  crimson: '#861610',
  vermilion: '#d2451f',
  orange: '#d77a22',
  yellow: '#e6bb3f',
  gold: '#d9a43b',
  goldLine: '#e8c46a',
  green: '#2f6d31',
  jade: '#3e8f5c',
  teal: '#1f6b6b',
  blue: '#2b5199',
  indigo: '#1c2e68',
  purple: '#6c3a7c',
  pink: '#d9737f',
  skin: '#ecc99a',
  face: '#f1d3a6',
  cream: '#f4e6c2',
  white: '#fbf5e6',
  brown: '#6e4121',
  horn: '#a8742e',
};

// ---------------------------------------------------------------- random
export function rng(seed = 1) {
  let a = (seed * 2654435761) >>> 0 || 1;
  const f = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------------------------------------------------------------- canvas
export function makeCanvas(w, h) {
  return Object.assign(document.createElement('canvas'), { width: Math.max(1, w | 0), height: Math.max(1, h | 0) });
}

let _leatherTex = null;
// A mottled, slightly fibrous hide texture tile, generated once.
function leatherTexture() {
  if (_leatherTex) return _leatherTex;
  const S = 256;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const r = rng(7);
  // value noise at 3 octaves, tileable
  const grid = (n) => {
    const a = new Float32Array(n * n);
    for (let i = 0; i < a.length; i++) a[i] = r();
    return (x, y) => {
      const fx = (x / S) * n, fy = (y / S) * n;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (i, j) => a[((j % n + n) % n) * n + ((i % n + n) % n)];
      const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
      const bot = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
      return top * (1 - sy) + bot * sy;
    };
  };
  const n1 = grid(6), n2 = grid(17), n3 = grid(53);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const v = n1(x, y) * 0.5 + n2(x, y) * 0.32 + n3(x, y) * 0.18;
      const fib = Math.sin((x * 0.9 + y * 0.35) * 0.35 + n2(x, y) * 6) * 0.5 + 0.5;
      const k = 0.75 + v * 0.45 + fib * 0.08;
      const i = (y * S + x) * 4;
      img.data[i] = 22 * k + 2;
      img.data[i + 1] = 15 * k + 1;
      img.data[i + 2] = 10 * k;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  _leatherTex = c;
  return c;
}

// ---------------------------------------------------------------- sprite
export class Sprite {
  // canvas: the pixels. scale: world units per canvas pixel.
  // ox, oy: world-unit offset added to "box" coordinates to get sprite
  // coordinates (so rigs can be authored in the coordinates they were
  // drawn in).
  constructor(canvas, scale, { ox = 0, oy = 0, name = '' } = {}) {
    this.canvas = canvas;
    this.scale = scale;
    this.w = canvas.width * scale;
    this.h = canvas.height * scale;
    this.ox = ox;
    this.oy = oy;
    this.name = name;
    this.id = Sprite._next++;
    this._alpha = null;
  }
  // box coords -> sprite-local world coords
  local(p) {
    return [p[0] + this.ox, p[1] + this.oy];
  }
  // Downsampled alpha grid used for mass properties and collision circles.
  alphaGrid(cell = 4) {
    if (this._alpha && this._alpha.cell === cell) return this._alpha;
    const cw = Math.max(1, Math.round(this.w / cell));
    const ch = Math.max(1, Math.round(this.h / cell));
    const c = makeCanvas(cw, ch);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high';
    g.drawImage(this.canvas, 0, 0, cw, ch);
    const d = g.getImageData(0, 0, cw, ch).data;
    const a = new Float32Array(cw * ch);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255;
    this._alpha = { cell: this.w / cw, cellY: this.h / ch, cw, ch, a };
    return this._alpha;
  }
}
Sprite._next = 1;

// Draw a sprite in world units. `w`,`h` is the drawing box; `pad` world
// units of transparent margin are added around it (drawings may spill
// into the pad). The draw callback receives (ctx, info) with ctx already
// transformed so (0,0) is the box's top-left.
export function paintSprite(w, h, draw, { pad = 6, px = PX, name = '', seed } = {}) {
  const cw = Math.ceil((w + pad * 2) * px);
  const ch = Math.ceil((h + pad * 2) * px);
  const canvas = makeCanvas(cw, ch);
  const ctx = canvas.getContext('2d');
  ctx.scale(px, px);
  ctx.translate(pad, pad);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const r = rng(seed ?? hashStr(name || String(w * 131 + h)));
  draw(ctx, { w, h, rng: r, px });
  return new Sprite(canvas, 1 / px, { ox: pad, oy: pad, name });
}

// ---------------------------------------------------------------- paths
export function poly(pts, closed = true) {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  if (closed) p.closePath();
  return p;
}

// Catmull-Rom densified points (so a shape and its perforation rows share
// the exact same curve).
export function curve(pts, closed = true, steps = 8, tension = 0.5) {
  const out = [];
  const n = pts.length;
  if (n < 3) return pts.slice();
  const get = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const m1x = (p2[0] - p0[0]) * tension, m1y = (p2[1] - p0[1]) * tension;
      const m2x = (p3[0] - p1[0]) * tension, m2y = (p3[1] - p1[1]) * tension;
      const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      out.push([
        h00 * p1[0] + h10 * m1x + h01 * p2[0] + h11 * m2x,
        h00 * p1[1] + h10 * m1y + h01 * p2[1] + h11 * m2y,
      ]);
    }
  }
  if (!closed) out.push(pts[n - 1].slice());
  return out;
}

export function smooth(pts, closed = true, tension = 0.5) {
  return poly(curve(pts, closed, 10, tension), closed);
}

export function ellipsePts(cx, cy, rx, ry, n = 32, rot = 0) {
  const out = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

// Organic, hand-cut looking ellipse.
export function blobPts(cx, cy, rx, ry, { wobble = 0.06, n = 28, seed = 3, rot = 0 } = {}) {
  const r = rng(seed);
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  return ellipsePts(0, 0, 1, 1, n).map(([x, y], i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + wobble * (Math.sin(a * 2 + ph[0]) * 0.5 + Math.sin(a * 3 + ph[1]) * 0.3 + Math.sin(a * 5 + ph[2]) * 0.2);
    const px = x * rx * k, py = y * ry * k;
    const c = Math.cos(rot), s = Math.sin(rot);
    return [cx + px * c - py * s, cy + px * s + py * c];
  });
}

export function mirrorX(pts, axisX) {
  return pts.map(([x, y]) => [2 * axisX - x, y]).reverse();
}

// Resample a polyline at a fixed spacing.
export function resample(pts, spacing, closed = false) {
  const src = closed ? [...pts, pts[0]] : pts;
  const out = [];
  let carry = 0;
  for (let i = 0; i < src.length - 1; i++) {
    const [x0, y0] = src[i], [x1, y1] = src[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    let d = carry;
    while (d <= len) {
      const t = len ? d / len : 0;
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, Math.atan2(y1 - y0, x1 - x0)]);
      d += spacing;
    }
    carry = d - len;
  }
  return out;
}

// Offset a closed polygon inward by d (positive = inward for a clockwise
// polygon in screen space; the function auto-detects winding).
export function inset(pts, d) {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n];
    area += x0 * y1 - x1 * y0;
  }
  const sgn = area > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const t1 = norm([p[0] - a[0], p[1] - a[1]]);
    const t2 = norm([b[0] - p[0], b[1] - p[1]]);
    const n1 = [-t1[1] * sgn, t1[0] * sgn];
    const n2 = [-t2[1] * sgn, t2[0] * sgn];
    const m = norm([n1[0] + n2[0], n1[1] + n2[1]]);
    const cos = Math.max(0.35, m[0] * n1[0] + m[1] * n1[1]);
    return [p[0] + (m[0] * d) / cos, p[1] + (m[1] * d) / cos];
  });
}

function norm([x, y]) {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

export function lerpPts(a, b, t) {
  return a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]);
}

// ---------------------------------------------------------------- paint
// Base hide. `path` is a Path2D (or an array of points, smoothed).
export function leather(ctx, path, { tone = 1, edge = true } = {}) {
  const p = Array.isArray(path) ? smooth(path) : path;
  ctx.save();
  const tex = leatherTexture();
  const pat = ctx.createPattern(tex, 'repeat');
  const m = new DOMMatrix();
  pat.setTransform(m.scaleSelf(0.5 * tone, 0.5 * tone));
  ctx.fillStyle = pat;
  ctx.fill(p);
  if (edge) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.6;
    ctx.stroke(p);
  }
  ctx.restore();
  return p;
}

// Translucent dye laid onto existing leather only.
export function dye(ctx, path, color, alpha = 0.9) {
  const p = Array.isArray(path) ? smooth(path) : path;
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill(p);
  ctx.restore();
  return p;
}

// Painted line (on leather only). pts is an array of points or a Path2D.
export function line(ctx, pts, color = INK.goldLine, width = 1.4, { closed = false, alpha = 1, smoothIt = true, dash } = {}) {
  const p = pts instanceof Path2D ? pts : smoothIt && pts.length > 2 ? smooth(pts, closed) : poly(pts, closed);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.stroke(p);
  ctx.restore();
  return p;
}

export const gold = (ctx, pts, width = 1.4, opts) => line(ctx, pts, INK.goldLine, width, opts);

// ------------------------------------------------------------ perforation
export function hole(ctx, x, y, r) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function holes(ctx, pts, r) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  for (const [x, y] of pts) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

// Row of punched dots along a (smoothed) polyline — ลายเม็ดพริกไทย.
export function dotLine(ctx, pts, { spacing = 4.2, r = 1.1, jitter = 0.18, closed = false, seed = 1, smoothIt = true } = {}) {
  const rr = rng(seed);
  const src = smoothIt && pts.length > 2 ? curve(pts, closed, 10) : pts;
  const s = resample(src, spacing, closed).map(([x, y]) => [
    x + (rr() - 0.5) * jitter * spacing,
    y + (rr() - 0.5) * jitter * spacing,
  ]);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  for (const [x, y] of s) {
    const q = r * (0.85 + rr() * 0.3);
    ctx.moveTo(x + q, y);
    ctx.arc(x, y, q, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
  return s;
}

// Fill a region with a perforation pattern, clipped to `path`.
// pattern: 'grid' | 'hex' | 'rand' | 'flowers' | 'diamond' | 'scales'
export function dotFill(ctx, path, bbox, { pattern = 'hex', spacing = 5, r = 1.1, jitter = 0.15, seed = 2 } = {}) {
  const p = Array.isArray(path) ? smooth(path) : path;
  const [x0, y0, x1, y1] = bbox;
  const rr = rng(seed);
  ctx.save();
  ctx.clip(p);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  const dot = (x, y, q = r) => {
    ctx.moveTo(x + q, y);
    ctx.arc(x, y, q, 0, Math.PI * 2);
  };
  if (pattern === 'scales') {
    ctx.restore();
    ctx.save();
    ctx.clip(p);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = r * 1.1;
    for (let y = y0, row = 0; y < y1 + spacing; y += spacing * 0.7, row++) {
      for (let x = x0 + (row % 2) * spacing * 0.5; x < x1 + spacing; x += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, spacing * 0.5, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }
  for (let y = y0, row = 0; y <= y1; y += pattern === 'hex' ? spacing * 0.866 : spacing, row++) {
    for (let x = x0 + (pattern === 'hex' && row % 2 ? spacing / 2 : 0); x <= x1; x += spacing) {
      const jx = (rr() - 0.5) * jitter * spacing, jy = (rr() - 0.5) * jitter * spacing;
      if (pattern === 'rand' && rr() < 0.45) continue;
      if (pattern === 'flowers') {
        if ((row + Math.round(x / spacing)) % 2) continue;
        const q = r * 0.8;
        dot(x + jx, y + jy, q * 1.1);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
          dot(x + jx + Math.cos(a) * r * 2.3, y + jy + Math.sin(a) * r * 2.3, q);
        }
      } else if (pattern === 'diamond') {
        if ((row + Math.round(x / spacing)) % 2) continue;
        dot(x + jx, y + jy);
      } else dot(x + jx, y + jy, r * (0.85 + rr() * 0.3));
    }
  }
  ctx.fill();
  ctx.restore();
}

// Punched slit along a polyline (knife-cut line).
export function slit(ctx, pts, width = 0.9, { smoothIt = true } = {}) {
  const p = smoothIt && pts.length > 2 ? smooth(pts, false) : poly(pts, false);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = width;
  ctx.stroke(p);
  ctx.restore();
}

// Cut out an arbitrary region entirely (e.g. the gap between an arm and a
// body, a window in a house).
export function cut(ctx, path) {
  const p = Array.isArray(path) ? smooth(path) : path;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(p);
  ctx.restore();
}

// ---------------------------------------------------------------- motifs
// ดอกจัน — a little punched dot-flower.
export function dotFlower(ctx, x, y, r = 1.2, petals = 5, spread = 2.4) {
  const pts = [[x, y]];
  for (let k = 0; k < petals; k++) {
    const a = (k / petals) * Math.PI * 2 - Math.PI / 2;
    pts.push([x + Math.cos(a) * r * spread, y + Math.sin(a) * r * spread]);
  }
  holes(ctx, pts.slice(0, 1), r * 1.15);
  holes(ctx, pts.slice(1), r * 0.9);
}

// ประจำยาม — four-petalled diamond flower, painted (color) with a
// punched centre. s = half-size.
export function prajamYam(ctx, x, y, s, { color = INK.red, petal = INK.gold, punch = true } = {}) {
  const petalPath = new Path2D();
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const c = Math.cos(a), si = Math.sin(a);
    const tip = [x + c * s, y + si * s];
    const l = [x + c * s * 0.35 - si * s * 0.32, y + si * s * 0.35 + c * s * 0.32];
    const r = [x + c * s * 0.35 + si * s * 0.32, y + si * s * 0.35 - c * s * 0.32];
    petalPath.moveTo(x, y);
    petalPath.quadraticCurveTo(l[0], l[1], tip[0], tip[1]);
    petalPath.quadraticCurveTo(r[0], r[1], x, y);
  }
  dye(ctx, petalPath, petal, 0.95);
  const inner = new Path2D();
  inner.arc(x, y, s * 0.34, 0, Math.PI * 2);
  dye(ctx, inner, color, 0.95);
  if (punch) {
    hole(ctx, x, y, s * 0.13);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      hole(ctx, x + Math.cos(a) * s * 0.62, y + Math.sin(a) * s * 0.62, s * 0.08);
    }
  }
}

// กระจัง — pointed leaf with inward curls, as a Path2D. Base centred at
// (x,y), tip pointing along `angle` (default up).
export function krajangPath(x, y, w, h, angle = -Math.PI / 2) {
  const pts = [
    [-0.5, 0], [-0.52, -0.22], [-0.36, -0.42], [-0.18, -0.52], [-0.28, -0.66],
    [-0.12, -0.78], [0, -1], [0.12, -0.78], [0.28, -0.66], [0.18, -0.52],
    [0.36, -0.42], [0.52, -0.22], [0.5, 0],
  ];
  const c = Math.cos(angle + Math.PI / 2), s = Math.sin(angle + Math.PI / 2);
  return smooth(pts.map(([px, py]) => {
    const X = px * w, Y = py * h;
    return [x + X * c - Y * s, y + X * s + Y * c];
  }), true, 0.45);
}

// A row of กระจัง along a baseline, painted then outlined with a punched
// centre dot. `pts` is a polyline; leaves stand on its left normal
// (i.e. "up" for a left-to-right baseline).
export function krajangRow(ctx, pts, size, { color = INK.gold, inner = INK.red, punch = true, gap = 0.92 } = {}) {
  const s = resample(curve(pts, false, 10), size * gap, false);
  for (const [x, y, a] of s) {
    const up = a - Math.PI / 2;
    const p = krajangPath(x, y, size, size * 1.35, up);
    dye(ctx, p, color, 0.95);
    const q = krajangPath(x + Math.cos(up) * size * 0.1, y + Math.sin(up) * size * 0.1, size * 0.55, size * 0.8, up);
    dye(ctx, q, inner, 0.9);
    if (punch) hole(ctx, x + Math.cos(up) * size * 0.45, y + Math.sin(up) * size * 0.45, size * 0.1);
  }
}

// กนก — flame-like leaf with a hooked tip, as points (for cutting a
// silhouette edge or painting). flip mirrors the hook.
export function kanokPts(x, y, size, angle = -Math.PI / 2, flip = false) {
  const base = [
    [0, 0], [0.22, -0.08], [0.34, -0.3], [0.3, -0.55], [0.18, -0.74], [0.3, -0.84],
    [0.12, -1.0], [0.02, -0.86], [-0.1, -0.7], [-0.05, -0.5], [-0.2, -0.36], [-0.26, -0.14],
  ];
  const c = Math.cos(angle + Math.PI / 2), s = Math.sin(angle + Math.PI / 2);
  return curve(base.map(([px, py]) => {
    const X = (flip ? -px : px) * size, Y = py * size;
    return [x + X * c - Y * s, y + X * s + Y * c];
  }), true, 6, 0.45);
}

// Band of lotus petals (กลีบบัว) along a baseline.
export function lotusRow(ctx, pts, size, { color = INK.green, edge = INK.goldLine } = {}) {
  const s = resample(curve(pts, false, 10), size * 0.8, false);
  for (const [x, y, a] of s) {
    const up = a - Math.PI / 2;
    const p = krajangPath(x, y, size * 0.9, size * 1.0, up);
    dye(ctx, p, color, 0.9);
    line(ctx, p, edge, 0.6);
  }
}

// Plaid / checked sarong (ผ้าขาวม้า, โสร่ง) painted into a region.
export function plaid(ctx, path, bbox, { a = INK.red, b = INK.indigo, size = 10, punch = true, seed = 4 } = {}) {
  const p = Array.isArray(path) ? smooth(path) : path;
  const [x0, y0, x1, y1] = bbox;
  ctx.save();
  ctx.clip(p);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = 0.85;
  for (let x = x0, i = 0; x < x1; x += size, i++) {
    ctx.fillStyle = i % 2 ? a : b;
    ctx.fillRect(x, y0, size * 0.5, y1 - y0);
  }
  ctx.globalAlpha = 0.55;
  for (let y = y0, i = 0; y < y1; y += size, i++) {
    ctx.fillStyle = i % 2 ? b : a;
    ctx.fillRect(x0, y, x1 - x0, size * 0.5);
  }
  ctx.restore();
  if (punch) dotFill(ctx, p, bbox, { pattern: 'grid', spacing: size, r: size * 0.1, seed });
}

// Punched almond eye (ตานาง / ตาพระ) or round eye (ตาตลก / ตายักษ์).
export function eye(ctx, x, y, size, { style = 'almond', angle = 0, pupil = true } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const p = new Path2D();
  if (style === 'almond') {
    p.moveTo(-size, 0);
    p.quadraticCurveTo(-size * 0.2, -size * 0.62, size * 0.9, -size * 0.1);
    p.quadraticCurveTo(size * 0.2, size * 0.42, -size, 0);
  } else if (style === 'bulge') {
    p.ellipse(0, 0, size, size * 0.8, 0, 0, Math.PI * 2);
  } else {
    p.arc(0, 0, size * 0.7, 0, Math.PI * 2);
  }
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(p);
  ctx.globalCompositeOperation = 'source-over';
  if (pupil) {
    ctx.fillStyle = INK.leather;
    ctx.beginPath();
    ctx.arc(style === 'almond' ? size * 0.1 : 0, style === 'almond' ? -size * 0.05 : 0, size * (style === 'bulge' ? 0.42 : 0.3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Border band along a path: a painted stripe with punched dots each side.
export function band(ctx, pts, width, { color = INK.red, dots = true, closed = false, seed = 5 } = {}) {
  line(ctx, pts, color, width, { closed });
  if (dots) {
    const d = curve(pts, closed, 10);
    const offs = (sign) => d.map((p, i) => {
      const a = d[Math.max(0, i - 1)], b = d[Math.min(d.length - 1, i + 1)];
      const t = norm([b[0] - a[0], b[1] - a[1]]);
      return [p[0] - t[1] * sign * width * 0.75, p[1] + t[0] * sign * width * 0.75];
    });
    dotLine(ctx, offs(1), { spacing: width * 0.9, r: width * 0.16, smoothIt: false, closed, seed });
    dotLine(ctx, offs(-1), { spacing: width * 0.9, r: width * 0.16, smoothIt: false, closed, seed: seed + 1 });
  }
}

// Convenience: cut, colour and decorate a simple limb segment between two
// joints (upper arm, forearm, thigh...). Returns its outline points.
export function limb(ctx, a, b, ra, rb, { color, bands = [], perf = true, seed = 9, bulge = 0.08 } = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const pts = [];
  const N = 10;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = ra + (rb - ra) * t + Math.sin(t * Math.PI) * bulge * L;
    pts.push([a[0] + dx * t + nx * r, a[1] + dy * t + ny * r]);
  }
  for (let i = 0; i <= 8; i++) {
    const t = (i / 8) * Math.PI;
    pts.push([b[0] + ux * Math.sin(t) * rb + nx * Math.cos(t) * rb, b[1] + uy * Math.sin(t) * rb + ny * Math.cos(t) * rb]);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const r = ra + (rb - ra) * t + Math.sin(t * Math.PI) * bulge * L;
    pts.push([a[0] + dx * t - nx * r, a[1] + dy * t - ny * r]);
  }
  for (let i = 0; i <= 8; i++) {
    const t = (i / 8) * Math.PI;
    pts.push([a[0] - ux * Math.sin(t) * ra - nx * Math.cos(t) * ra, a[1] - uy * Math.sin(t) * ra - ny * Math.cos(t) * ra]);
  }
  const path = poly(pts, true);
  leather(ctx, path);
  if (color) {
    const inner = inset(pts, Math.min(ra, rb) * 0.28);
    dye(ctx, poly(inner), color, 0.85);
  }
  for (const t of bands) {
    const cx = a[0] + dx * t, cy = a[1] + dy * t;
    const r = ra + (rb - ra) * t + Math.sin(t * Math.PI) * bulge * L;
    const p1 = [cx + nx * r * 0.95, cy + ny * r * 0.95], p2 = [cx - nx * r * 0.95, cy - ny * r * 0.95];
    line(ctx, [p1, p2], INK.goldLine, 2.2, { smoothIt: false });
    dotLine(ctx, [[p1[0] + ux * 2.4, p1[1] + uy * 2.4], [p2[0] + ux * 2.4, p2[1] + uy * 2.4]], { spacing: 3, r: 0.75, smoothIt: false, seed: seed + t * 10 });
  }
  if (perf) {
    const inner = inset(pts, Math.min(ra, rb) * 0.16);
    dotLine(ctx, inner, { closed: true, spacing: 3.6, r: 0.75, seed, smoothIt: false });
  }
  return pts;
}

// Joint rivet / knot, drawn after cutting so it sits over the hide.
export function rivet(ctx, x, y, r = 3.2) {
  ctx.save();
  ctx.fillStyle = '#231a14';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a5c30';
  ctx.lineWidth = r * 0.35;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
