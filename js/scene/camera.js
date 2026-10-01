// 2D camera over scene space (cloth units: the screen is 0..1600 x 0..1000).

export class Camera {
  constructor() {
    this.x = 800; this.y = 470; this.zoom = 0.6;
    this.vw = 1; this.vh = 1; this.dpr = 1;
    this.anim = null;
    this.shake = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.parallaxX = 0; this.parallaxY = 0;
  }

  resize(w, h, dpr) {
    this.vw = w; this.vh = h; this.dpr = dpr;
  }

  // Default play framing: the booth with a little heaven above.
  framing(mode = 'stage') {
    const w = this.vw, h = this.vh;
    if (mode === 'heaven') {
      const zoom = Math.min(w / 2600, h / 2300);
      return { x: 800, y: 150, zoom };
    }
    if (mode === 'close') {
      const zoom = Math.min(w / 1680, h / 1080);
      return { x: 800, y: 500, zoom };
    }
    // portrait phones: fill the width with the cloth, centred above the pad
    if (h > w * 1.15) {
      const zoom = w / 1700;
      const visH = h / zoom;
      return { x: 800, y: 470 + visH * 0.03, zoom };
    }
    // stage: cloth + frame + roof + a band of heaven; keep the cloth big
    const zoom = Math.min(w / 2000, h / 1760);
    const visH = h / zoom;
    return { x: 800, y: 1200 - visH / 2, zoom };
  }

  flyTo(t, dur = 1.2, ease = easeInOut) {
    this.anim = { from: { x: this.x, y: this.y, zoom: this.zoom }, to: t, t: 0, dur, ease };
  }

  set(t) { this.x = t.x; this.y = t.y; this.zoom = t.zoom; this.anim = null; }

  update(dt) {
    if (this.anim) {
      const a = this.anim;
      a.t += dt;
      const u = a.ease(Math.min(1, a.t / a.dur));
      this.x = a.from.x + (a.to.x - a.from.x) * u;
      this.y = a.from.y + (a.to.y - a.from.y) * u;
      // interpolate zoom geometrically
      this.zoom = a.from.zoom * Math.pow(a.to.zoom / a.from.zoom, u);
      if (a.t >= a.dur) this.anim = null;
    }
    this.shake *= Math.exp(-dt * 6);
    this.shakeX = (Math.random() - 0.5) * this.shake;
    this.shakeY = (Math.random() - 0.5) * this.shake;
  }

  // scene -> CSS pixels
  toScreen(x, y, parallax = 1) {
    const cx = this.x + this.shakeX, cy = this.y + this.shakeY;
    return [(x - cx * parallax) * this.zoom + this.vw / 2 - (1 - parallax) * 0, (y - cy * parallax) * this.zoom + this.vh / 2];
  }
  toScene(sx, sy) {
    return [(sx - this.vw / 2) / this.zoom + this.x + this.shakeX, (sy - this.vh / 2) / this.zoom + this.y + this.shakeY];
  }
  // Apply to a 2D context (in device pixels) with an optional parallax
  // factor (<1 = far layer moving slower, >1 = foreground).
  apply(ctx, parallax = 1, zoomK = 1) {
    const d = this.dpr;
    const z = this.zoom * zoomK;
    const cx = (this.x + this.shakeX) * parallax + 800 * (1 - parallax);
    const cy = (this.y + this.shakeY) * parallax + 470 * (1 - parallax);
    ctx.setTransform(z * d, 0, 0, z * d, (this.vw / 2 - cx * z) * d, (this.vh / 2 - cy * z) * d);
  }
}

export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
