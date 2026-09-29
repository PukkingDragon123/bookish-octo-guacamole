// The screen cloth (จอหนัง) as a taut membrane: a damped 2D wave equation
// on the displacement field, tied at the frame. Puppets pressed against
// it bulge it toward the audience, hits send ripples, a night breeze
// breathes through it.

export class Membrane {
  constructor(nx = 100, ny = 64, W = 1600, H = 1000) {
    this.nx = nx; this.ny = ny; this.W = W; this.H = H;
    this.h = new Float32Array(nx * ny);
    this.v = new Float32Array(nx * ny);
    this.f = new Float32Array(nx * ny);
    this.target = new Float32Array(nx * ny);
    this.press = new Float32Array(nx * ny);
    this.t = 0;
    this.wind = 1;
    this.gust = 0;
    this.gustT = 3;
  }

  // Bulge toward the audience under a disc (cloth coords).
  pressDisc(x, y, r, amount) {
    const { nx, ny, W, H } = this;
    const gx = (x / W) * (nx - 1), gy = (y / H) * (ny - 1), gr = (r / W) * (nx - 1);
    const i0 = Math.max(1, Math.floor(gx - gr - 1)), i1 = Math.min(nx - 2, Math.ceil(gx + gr + 1));
    const j0 = Math.max(1, Math.floor(gy - gr - 1)), j1 = Math.min(ny - 2, Math.ceil(gy + gr + 1));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(i - gx, j - gy) / Math.max(gr, 0.7);
        if (d > 1.3) continue;
        const w = d < 1 ? 1 : 1 - (d - 1) / 0.3;
        const k = j * nx + i;
        this.target[k] = Math.max(this.target[k], amount * w);
        this.press[k] = Math.max(this.press[k], w);
      }
    }
  }

  // Ripple impulse (hits, drops).
  poke(x, y, r, strength) {
    const { nx, ny, W, H } = this;
    const gx = (x / W) * (nx - 1), gy = (y / H) * (ny - 1), gr = Math.max(1, (r / W) * (nx - 1));
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const d2 = ((i - gx) ** 2 + (j - gy) ** 2) / (gr * gr);
        if (d2 > 4) continue;
        this.v[j * nx + i] += strength * Math.exp(-d2);
      }
    }
  }

  step(dt) {
    const { nx, ny, h, v, target, press } = this;
    this.t += dt;
    this.gustT -= dt;
    if (this.gustT < 0) {
      this.gustT = 4 + Math.random() * 7;
      this.gust = 0.6 + Math.random() * 1.2;
    }
    this.gust *= Math.exp(-dt * 0.7);
    const sub = 2;
    const h2 = dt / sub;
    const c2 = 150, damp = 2.2, k = 3.5;
    const t = this.t;
    const windA = (0.35 + this.gust) * this.wind;
    for (let s = 0; s < sub; s++) {
      for (let j = 1; j < ny - 1; j++) {
        const row = j * nx;
        const fy = j / ny;
        for (let i = 1; i < nx - 1; i++) {
          const q = row + i;
          const lap = h[q - 1] + h[q + 1] + h[q - nx] + h[q + nx] - 4 * h[q];
          const fx = i / nx;
          // slow travelling breeze pattern
          const breeze = windA * (Math.sin(fx * 5.1 + t * 0.9) * Math.sin(fy * 3.7 - t * 0.6) + 0.6 * Math.sin(fx * 9.3 - t * 1.7 + fy * 4.1));
          let a = c2 * lap - k * h[q] - damp * v[q] + breeze * 6;
          if (press[q] > 0) a += (target[q] - h[q]) * 220 * press[q] - v[q] * 14 * press[q];
          v[q] += a * h2;
        }
      }
      for (let q = 0; q < h.length; q++) h[q] += v[q] * h2;
    }
    target.fill(0);
    press.fill(0);
  }
}
