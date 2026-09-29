// Velvet stage curtains as Verlet cloth: a particle grid hanging from the
// rail. Opening slides the top pins to the sides where the cloth bunches
// into folds; a tie-back gathers it at the waist.

export class Curtain {
  constructor(side, { x0 = -60, x1 = 1660, top = -150, bottom = 1090, cols = 18, rows = 26 } = {}) {
    this.side = side; // -1 left, +1 right
    this.cols = cols; this.rows = rows;
    this.top = top;
    const half = (x1 - x0) / 2 + 30;
    this.width = half;
    this.edgeOpen = side < 0 ? x0 - 150 : x1 + 150; // where it bunches
    this.closedFrom = side < 0 ? x0 : x1;
    this.closedTo = side < 0 ? x0 + half : x1 - half;
    this.restX = half / (cols - 1);
    this.restY = (bottom - top) / (rows - 1);
    this.p = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = this.closedFrom + (this.closedTo - this.closedFrom) * (i / (cols - 1));
      const y = top + j * this.restY;
      this.p.push({ x, y, px: x, py: y });
    }
    this.open = 0;
    this.target = 0;
    this.tie = 0;
    this.wind = 0;
  }

  pinX(i) {
    const t = i / (this.cols - 1);
    const closed = this.closedFrom + (this.closedTo - this.closedFrom) * t;
    const opened = this.edgeOpen - this.side * (t * 190 - 130);
    const o = this.open;
    return closed + (opened - closed) * o;
  }

  step(dt, time) {
    this.open += (this.target - this.open) * Math.min(1, dt * 1.6);
    this.tie += ((this.open > 0.8 ? 1 : 0) - this.tie) * Math.min(1, dt * 1.5);
    const { cols, rows, p } = this;
    const g = 1400 * dt * dt;
    for (let k = cols; k < p.length; k++) {
      const q = p[k];
      const vx = (q.x - q.px) * 0.985, vy = (q.y - q.py) * 0.985;
      q.px = q.x; q.py = q.y;
      const j = (k / cols) | 0;
      q.x += vx + Math.sin(time * 0.8 + j * 0.3 + k) * 0.02 * this.wind;
      q.y += vy + g;
    }
    for (let i = 0; i < cols; i++) {
      const q = p[i];
      q.x = q.px = this.pinX(i);
      q.y = q.py = this.top;
    }
    const tieRow = Math.round(rows * 0.62);
    const tieX = this.edgeOpen - this.side * 30;
    for (let it = 0; it < 6; it++) {
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        if (i < cols - 1) this._link(k, k + 1, this.restX * (1 - this.open * 0.82), 0.5);
        if (j < rows - 1) this._link(k, k + cols, this.restY, 1);
      }
      if (this.tie > 0.01) {
        for (let j = tieRow; j < rows; j++) {
          const k = j === tieRow ? 0.45 : 0.06 * (1 + (j - tieRow) * 0.25);
          for (let i = 0; i < cols; i++) {
            const q = p[j * cols + i];
            const tx = tieX + (i / cols) * -this.side * (18 + (j - tieRow) * 14);
            if ((q.x - tx) * this.side < 0) q.x += (tx - q.x) * k * this.tie;
          }
        }
      }
      for (let i = 0; i < cols; i++) { const q = p[i]; q.x = this.pinX(i); q.y = this.top; }
    }
  }

  _link(a, b, rest, stiff) {
    const A = this.p[a], B = this.p[b];
    const dx = B.x - A.x, dy = B.y - A.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    // cloth resists stretching strongly, bunching (compression) weakly
    const diff = (d - rest) / d * (d > rest ? 0.5 : 0.18) * stiff;
    const top = a < this.cols;
    if (top) { B.x -= dx * diff * 2; B.y -= dy * diff * 2; return; }
    A.x += dx * diff; A.y += dy * diff;
    B.x -= dx * diff; B.y -= dy * diff;
  }

  draw(ctx, light = 1) {
    const { cols, rows, p } = this;
    for (let i = 0; i < cols - 1; i++) {
      for (let j = 0; j < rows - 1; j++) {
        const a = p[j * cols + i], b = p[j * cols + i + 1], c = p[(j + 1) * cols + i + 1], d = p[(j + 1) * cols + i];
        const span = Math.abs(b.x - a.x) / this.restX;
        const fold = Math.sin(i * 1.7 + span * 3) * 0.5 + 0.5;
        const shade = Math.max(0.18, Math.min(1.25, (0.45 + fold * 0.55) * (0.6 + Math.min(1, span) * 0.5)));
        const L = shade * light;
        ctx.fillStyle = `rgb(${Math.min(255, 150 * L + 12) | 0},${(22 * L + 4) | 0},${(18 * L + 6) | 0})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + 0.6, b.y); ctx.lineTo(c.x + 0.6, c.y + 0.6); ctx.lineTo(d.x, d.y + 0.6);
        ctx.fill();
      }
    }
    // gold fringe along the hem and the inner edge
    ctx.strokeStyle = `rgba(${(230 * light) | 0},${(178 * light) | 0},${(80 * light) | 0},1)`;
    ctx.lineWidth = 14;
    ctx.beginPath();
    for (let i = 0; i < cols; i++) { const q = p[(rows - 1) * cols + i]; i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
    ctx.stroke();
    ctx.lineWidth = 3;
    for (let i = 0; i < cols; i++) {
      const q = p[(rows - 1) * cols + i];
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(q.x + k * 4, q.y); ctx.lineTo(q.x + k * 4, q.y + 22); ctx.stroke(); }
    }
    ctx.lineWidth = 9;
    ctx.beginPath();
    const ie = cols - 1;
    for (let j = 0; j < rows; j++) { const q = p[j * cols + ie]; j ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
    ctx.stroke();
    // tie-back tassel
    if (this.tie > 0.2) {
      const q = p[Math.round(rows * 0.62) * cols + (cols >> 1)];
      ctx.fillStyle = `rgba(240,190,90,${this.tie})`;
      ctx.beginPath(); ctx.ellipse(q.x, q.y, 16, 12, 0, 0, 7); ctx.fill();
      ctx.fillRect(q.x - 5, q.y, 10, 60);
    }
  }
}
