// Mass properties and collision circles derived from a sprite's alpha.

const cache = new Map();

// Returns { area, mass, inertia, com: [x, y] (sprite-local world units),
//           circles: [{x, y, r}] relative to the COM }.
export function spriteShape(sprite, { maxCircles = 7, minR = 3, density = 1 / 9000, segment = null, cell = 4 } = {}) {
  const key = `${sprite.id}|${maxCircles}|${minR}|${density}|${segment ? segment.join(',') : ''}`;
  if (cache.has(key)) return cache.get(key);
  const g = sprite.alphaGrid(cell);
  const { cw, ch, a } = g;
  const cx = g.cell, cy = g.cellY;
  let area = 0, mx = 0, my = 0;
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const v = a[j * cw + i];
      if (v <= 0.02) continue;
      const w = v * cx * cy;
      area += w;
      mx += w * (i + 0.5) * cx;
      my += w * (j + 0.5) * cy;
    }
  }
  if (area <= 0) area = 1;
  const com = [mx / area, my / area];
  let I = 0;
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const v = a[j * cw + i];
      if (v <= 0.02) continue;
      const dx = (i + 0.5) * cx - com[0], dy = (j + 0.5) * cy - com[1];
      I += v * cx * cy * (dx * dx + dy * dy + (cx * cx + cy * cy) / 12);
    }
  }
  const mass = Math.max(0.02, area * density);
  const inertia = Math.max(1e-3, I * density);

  let circles = [];
  if (segment) {
    // thin items (weapons, rods): circles along the given segment
    const [[ax, ay], [bx, by]] = segment;
    const L = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.min(10, Math.ceil(L / 22)));
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      circles.push({ x: ax + (bx - ax) * t - com[0], y: ay + (by - ay) * t - com[1], r: 6 });
    }
  } else {
    // chamfer distance transform inside the silhouette
    const inside = new Uint8Array(cw * ch);
    for (let i = 0; i < inside.length; i++) inside[i] = a[i] > 0.45 ? 1 : 0;
    const D = new Float32Array(cw * ch);
    const BIG = 1e9;
    for (let i = 0; i < D.length; i++) D[i] = inside[i] ? BIG : 0;
    const at = (i, j) => (i < 0 || j < 0 || i >= cw || j >= ch ? 0 : D[j * cw + i]);
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
      const k = j * cw + i;
      if (!D[k]) continue;
      D[k] = Math.min(D[k], at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + 1.414, at(i + 1, j - 1) + 1.414);
    }
    for (let j = ch - 1; j >= 0; j--) for (let i = cw - 1; i >= 0; i--) {
      const k = j * cw + i;
      if (!D[k]) continue;
      D[k] = Math.min(D[k], at(i + 1, j) + 1, at(i, j + 1) + 1, at(i + 1, j + 1) + 1.414, at(i - 1, j + 1) + 1.414);
    }
    const covered = new Uint8Array(cw * ch);
    let total = 0;
    for (let i = 0; i < inside.length; i++) total += inside[i];
    let cov = 0;
    const cs = (cx + cy) / 2;
    while (circles.length < maxCircles) {
      let best = -1, bd = 0;
      for (let k = 0; k < D.length; k++) {
        if (!inside[k] || covered[k]) continue;
        if (D[k] > bd) { bd = D[k]; best = k; }
      }
      if (best < 0) break;
      const r = Math.max(bd * cs * 0.98, minR);
      if (bd * cs < minR && circles.length) break;
      const bi = best % cw, bj = (best / cw) | 0;
      const px = (bi + 0.5) * cx, py = (bj + 0.5) * cy;
      circles.push({ x: px - com[0], y: py - com[1], r });
      const rc = Math.ceil(r / cs) + 1;
      for (let j = Math.max(0, bj - rc); j < Math.min(ch, bj + rc + 1); j++) {
        for (let i = Math.max(0, bi - rc); i < Math.min(cw, bi + rc + 1); i++) {
          const k = j * cw + i;
          if (covered[k]) continue;
          const dx = (i + 0.5) * cx - px, dy = (j + 0.5) * cy - py;
          if (dx * dx + dy * dy <= r * r * 1.15) { covered[k] = 1; if (inside[k]) cov++; }
        }
      }
      if (cov / Math.max(1, total) > 0.9) break;
    }
    if (!circles.length) circles.push({ x: 0, y: 0, r: Math.max(minR, Math.sqrt(area / Math.PI) * 0.8) });
  }
  const out = { area, mass, inertia, com, circles };
  cache.set(key, out);
  return out;
}
