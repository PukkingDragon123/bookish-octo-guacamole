// Composes the whole view: heaven + night village (back canvas), the
// cloth (WebGL), and the booth, curtains, audience, strings and effects
// (front canvas). All layers share one camera in scene units (the cloth
// occupies 0..1600 x 0..1000).

import { createGL } from './gl.js';
import { ShadowScreen, CLOTH_W, CLOTH_H } from './screen.js';
import { paintBooth, bananaTrunkSprite, BAND } from './theatre.js';
import { paintNight, paintHeaven, paintCloudSprites } from './sky.js';
import { Curtain } from './curtain.js';
import { makeCanvas, rng, goldGrad, paperPiece, paperTexture } from './paint.js';

export class Stage {
  constructor(root, camera) {
    this.cam = camera;
    this.bg = root.querySelector('#bg');
    this.glc = root.querySelector('#gl');
    this.fg = root.querySelector('#fg');
    this.bctx = this.bg.getContext('2d');
    this.fctx = this.fg.getContext('2d');
    this.gl = createGL(this.glc);
    if (!this.gl) throw new Error('WebGL2 is required');
    this.screen = new ShadowScreen(this.gl);
    this.curtains = [new Curtain(-1), new Curtain(1)];
    this.time = 0;
    this.trunk = bananaTrunkSprite();
    this.flags = makeFlags();
    this.lanterns = [{ x: -330, y: -220, a: 0.2, v: 0 }, { x: 1930, y: -220, a: -0.1, v: 0 }];
    this.fireflies = Array.from({ length: 40 }, (_, i) => ({ x: -1400 + Math.random() * 4400, y: 700 + Math.random() * 600, p: Math.random() * 10 }));
    this.fx = [];
    this.cloudSprites = null;
    this.heavenAlpha = 1;
  }

  async build(fonts) {
    await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 2500))]);
    const T = (name, f) => { const t = performance.now(); const r = f(); console.log('build', name, Math.round(performance.now() - t)); return r; };
    this.booth = T('booth', () => paintBooth(0.8, fonts));
    this.night = T('night', () => paintNight(0.45));
    this.heaven = T('heaven', () => paintHeaven(0.4));
    this.cloudSprites = T('clouds', () => paintCloudSprites(0.4));
    this.audience = T('audience', () => paintAudience());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    for (const c of [this.bg, this.glc, this.fg]) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      c.style.width = w + 'px'; c.style.height = h + 'px';
    }
    this.dpr = dpr;
    this.cam.resize(w, h, dpr);
  }

  addFx(f) { this.fx.push(f); }

  // ------------------------------------------------------------ frame
  render(scene, dt, overlay, frame = null) {
    this.time += dt;
    const cam = this.cam, dpr = this.dpr;
    const lampS = frame ? frame.lamp : scene.lamp;
    const lampI = lampS.intensity * (1 + (lampS.flicker || 0)) + (lampS.fxBoost || 0);

    // ------------- back: heaven + night
    const b = this.bctx;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.fillStyle = '#070919';
    b.fillRect(0, 0, this.bg.width, this.bg.height);
    const view = this.viewRect();
    if (view.y0 < -250) this._layer(b, this.heaven, 0.85);
    this._layer(b, this.night, 0.9);
    // fireflies
    cam.apply(b, 0.9);
    b.globalCompositeOperation = 'lighter';
    for (const f of this.fireflies) {
      const t = this.time + f.p;
      const x = f.x + Math.sin(t * 0.4) * 40, y = f.y + Math.sin(t * 0.7) * 25;
      const a = Math.max(0, Math.sin(t * 2.1)) ** 3;
      b.fillStyle = `rgba(200,255,140,${a * 0.9})`;
      b.beginPath(); b.arc(x, y, 3.5, 0, 7); b.fill();
    }
    b.globalCompositeOperation = 'source-over';

    // ------------- cloth (GL)
    const items = frame ? frame.items.slice() : scene.drawables();
    if (frame && frame.fx) items.push(frame.fx);
    else if (!frame && this.fxLayer) items.push(this.fxLayer.render());
    this.lastItems = items;
    // banana trunk along the bottom, pressed on the cloth
    items.push({ sprite: this.trunk, m: [1, 0, 0, 1, -20 - this.trunk.ox, 936 - this.trunk.oy], z: 0.004 });
    const clothPx = CLOTH_W * cam.zoom * dpr;
    this.screen.setQuality(clothPx / CLOTH_W);
    this.screen.renderShadows(items, lampS);
    this.screen.uploadHeights(scene.membrane);
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.glc.width, this.glc.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.screen.drawCloth({
      cam: { x: cam.x + cam.shakeX, y: cam.y + cam.shakeY, zoom: cam.zoom * dpr },
      viewport: [this.glc.width, this.glc.height],
      rect: [0, 0, CLOTH_W, CLOTH_H],
      lamp: lampS, lampI, lampColor: lampS.color,
      ambient: [0.05 + (1 - lampS.intensity) * 0.05, 0.06, 0.1],
      glows: frame ? frame.glows : (this.lastGlows = scene.glows()), time: this.time, exposure: 1.4,
    });

    // ------------- front
    const f = this.fctx;
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.clearRect(0, 0, this.fg.width, this.fg.height);
    cam.apply(f, 1);
    const B = this.booth;
    f.drawImage(B.canvas, B.x0, B.y0, B.w, B.h);
    // night shading over the booth, lifted near the glowing screen
    const L = Math.min(1.2, lampI);
    f.save();
    f.globalCompositeOperation = 'source-atop';
    const dark = f.createRadialGradient(800, 500, 300, 800, 500, 1500);
    dark.addColorStop(0, `rgba(10,8,30,${0.62 - L * 0.5})`);
    dark.addColorStop(1, `rgba(6,6,22,${0.86 - L * 0.22})`);
    f.fillStyle = dark;
    f.fillRect(B.x0, B.y0, B.w, B.h);
    f.restore();
    // warm spill from the screen
    f.save();
    f.globalCompositeOperation = 'lighter';
    const spill = f.createRadialGradient(800, 560, 200, 800, 560, 1400);
    spill.addColorStop(0, `rgba(255,170,90,${0.16 * L})`);
    spill.addColorStop(1, 'rgba(255,170,90,0)');
    f.fillStyle = spill;
    f.fillRect(-1400, -800, 4400, 2600);
    f.restore();
    this._lanterns(f, dt, L);
    for (const c of this.curtains) c.draw(f, 0.35 + L * 0.6);
    // audience in front, rim-lit by the screen
    const A = this.audience;
    f.drawImage(A.dark, A.x0, A.y0, A.w, A.h);
    f.save();
    f.globalAlpha = Math.min(1, L);
    f.drawImage(A.rim, A.x0, A.y0, A.w, A.h);
    f.restore();
    if (overlay) overlay(f);
    this._fx(f, dt, scene);
  }

  _layer(ctx, L, parallax) {
    this.cam.apply(ctx, parallax);
    ctx.drawImage(L.canvas, L.x0, L.y0, L.w, L.h);
  }

  viewRect() {
    const c = this.cam;
    const hw = c.vw / 2 / c.zoom, hh = c.vh / 2 / c.zoom;
    return { x0: c.x - hw, x1: c.x + hw, y0: c.y - hh, y1: c.y + hh };
  }

  // Foreground heavenly clouds framing the view (and rushing past in the intro)
  drawCloudVeil(ctx, amount, drift = 0) {
    if (!this.cloudSprites || amount <= 0) return;
    const cam = this.cam;
    const rr = rng(3);
    ctx.save();
    for (let i = 0; i < 14; i++) {
      const s = this.cloudSprites[i % this.cloudSprites.length];
      const side = i % 2 ? 1 : -1;
      const px = 1.35 + (i % 4) * 0.15;
      const x = 800 + side * (900 + rr() * 900) - s.w / 2 + Math.sin(this.time * 0.05 + i) * 60;
      const y = cam.y + (rr() - 0.5) * 1800 + drift * px * 0.4;
      cam.apply(ctx, px);
      ctx.globalAlpha = amount * (0.55 + rr() * 0.45);
      ctx.drawImage(s.canvas, x, y - s.h / 2, s.w * 1.3, s.h * 1.3);
    }
    ctx.restore();
  }

  _lanterns(f, dt, L) {
    for (const l of this.lanterns) {
      l.v += (-l.a * 9 - l.v * 0.8 + Math.sin(this.time * 0.7 + l.x) * 0.6) * dt;
      l.a += l.v * dt;
      const len = 90;
      const x = l.x + Math.sin(l.a) * len, y = l.y + Math.cos(l.a) * len;
      f.strokeStyle = '#1b0f08'; f.lineWidth = 2;
      f.beginPath(); f.moveTo(l.x, l.y); f.lineTo(x, y); f.stroke();
      const g = f.createRadialGradient(x, y + 30, 5, x, y + 30, 160);
      g.addColorStop(0, `rgba(255,150,70,${0.45 * L + 0.2})`);
      g.addColorStop(1, 'rgba(255,120,50,0)');
      f.save(); f.globalCompositeOperation = 'lighter'; f.fillStyle = g; f.fillRect(x - 160, y - 130, 320, 320); f.restore();
      f.fillStyle = '#c0301f';
      f.beginPath(); f.ellipse(x, y + 32, 30, 38, 0, 0, 7); f.fill();
      f.fillStyle = 'rgba(255,200,120,0.55)';
      f.beginPath(); f.ellipse(x - 6, y + 26, 12, 22, 0, 0, 7); f.fill();
      f.fillStyle = goldGrad(f, x - 20, y, x + 20, y + 10);
      f.fillRect(x - 18, y - 8, 36, 8); f.fillRect(x - 14, y + 68, 28, 8);
      f.strokeStyle = '#e8b04a'; f.lineWidth = 2;
      for (let k = -2; k <= 2; k++) { f.beginPath(); f.moveTo(x + k * 5, y + 76); f.lineTo(x + k * 5, y + 100); f.stroke(); }
    }
  }

  _flags(f) {
    const F = this.flags, t = this.time;
    const x0 = -135, x1 = 1735, y0 = -232;
    f.strokeStyle = '#2a1a10'; f.lineWidth = 2;
    f.beginPath();
    for (let i = 0; i <= 40; i++) {
      const u = i / 40, x = x0 + (x1 - x0) * u, y = y0 + Math.sin(u * Math.PI) * 26;
      i ? f.lineTo(x, y) : f.moveTo(x, y);
    }
    f.stroke();
    F.forEach((c, i) => {
      const u = (i + 0.5) / F.length, x = x0 + (x1 - x0) * u, y = y0 + Math.sin(u * Math.PI) * 26;
      const sway = Math.sin(t * 2.3 + i * 0.9) * 6;
      f.fillStyle = c;
      f.beginPath(); f.moveTo(x - 16, y); f.lineTo(x + 16, y); f.lineTo(x + sway, y + 40); f.closePath(); f.fill();
    });
  }

  _fx(f, dt, scene) {
    this.cam.apply(f, 1);
    f.save();
    f.globalCompositeOperation = 'lighter';
    this.fx = this.fx.filter((p) => {
      p.t += dt;
      if (p.t > p.life) return false;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt;
      const a = 1 - p.t / p.life;
      f.fillStyle = `rgba(${p.c},${a})`;
      f.beginPath(); f.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, 7); f.fill();
      return true;
    });
    f.restore();
  }

  sparks(x, y, n = 18, c = '255,210,120') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 200 + Math.random() * 500;
      this.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 150, g: 900, t: 0, life: 0.3 + Math.random() * 0.5, r: 2 + Math.random() * 3, c });
    }
  }
}

function makeFlags() {
  const cols = ['#c0301f', '#e6b33c', '#2f7d45', '#2a5aa8', '#f2e6cc', '#d76f22', '#8a2f8f'];
  return Array.from({ length: 38 }, (_, i) => cols[i % cols.length]);
}

// Seated villagers seen from behind, as dark silhouettes plus a separate
// rim-light layer (so the rim can breathe with the lamp).
function paintAudience() {
  const x0 = -600, y0 = 1080, w = 2800, h = 520, k = 0.6;
  const dark = makeCanvas(w * k, h * k), rim = makeCanvas(w * k, h * k);
  const d = dark.getContext('2d'), r = rim.getContext('2d');
  for (const g of [d, r]) { g.scale(k, k); g.translate(-x0, -y0); }
  const R = rng(17);
  const people = [];
  for (let row = 0; row < 3; row++) {
    for (let x = x0 + 40 + row * 30; x < x0 + w; x += 120 + R() * 90) {
      people.push({ x, y: 1230 + row * 110 + R() * 20, s: 0.9 + row * 0.22 + R() * 0.15, kind: R() });
    }
  }
  people.sort((a, b) => a.y - b.y);
  // cut-paper villagers: coloured sheets (shirt, head, hair) layered with
  // soft cast shadows, deepening toward the front row
  const shirts = ['#3b3560', '#5a2f45', '#6b4a2a', '#2f4a4f', '#4a3a60', '#6a3030', '#35503a'];
  for (const p of people) {
    const s = p.s, x = p.x, y = p.y;
    const dim = 0.55 + (p.y - 1230) / 900;
    const body = new Path2D();
    body.moveTo(x - 80 * s, y + 220 * s);
    body.bezierCurveTo(x - 86 * s, y + 40 * s, x - 50 * s, y + 20 * s, x, y + 18 * s);
    body.bezierCurveTo(x + 50 * s, y + 20 * s, x + 86 * s, y + 40 * s, x + 80 * s, y + 220 * s);
    body.closePath();
    const head = new Path2D();
    head.ellipse(x, y - 20 * s, 34 * s, 38 * s, 0, 0, Math.PI * 2);
    const hair = new Path2D();
    hair.ellipse(x, y - 30 * s, 35 * s, 32 * s, 0, Math.PI, Math.PI * 2.05);
    if (p.kind < 0.25) { hair.moveTo(x + 14 * s, y - 60 * s); hair.arc(x, y - 62 * s, 15 * s, 0, Math.PI * 2); }
    paperPiece(d, body, shade(shirts[Math.floor(R() * shirts.length)], dim * 0.7), { lift: 7 * s, edge: 'rgba(255,230,200,0.18)' });
    paperPiece(d, head, shade('#8a5a3a', dim * 0.55), { lift: 5 * s, edge: null });
    paperPiece(d, hair, shade('#1c1414', dim), { lift: 3 * s, edge: null, tex: 0.3 });
    if (p.kind >= 0.25 && p.kind < 0.35) {
      const hat = new Path2D();
      hat.moveTo(x - 74 * s, y - 34 * s); hat.quadraticCurveTo(x, y - 96 * s, x + 74 * s, y - 34 * s); hat.closePath();
      paperPiece(d, hat, shade('#b08a4a', dim * 0.7), { lift: 5 * s });
    } else if (p.kind >= 0.35 && p.kind < 0.45) {
      const fan = new Path2D();
      fan.moveTo(x + 50 * s, y + 20 * s); fan.arc(x + 50 * s, y + 20 * s, 60 * s, -2.1, -1.0); fan.closePath();
      paperPiece(d, fan, shade('#b8402a', dim * 0.7), { lift: 5 * s });
    }
    const all = new Path2D();
    all.addPath(body); all.addPath(head); all.addPath(hair);
    // nearer people hide the rim light of those behind them
    r.save();
    r.globalCompositeOperation = 'destination-out';
    r.fill(all);
    r.restore();
    // rim light: a warm crescent along the top edges (no blur)
    const tmp = rimTmp(r);
    const t2 = tmp.getContext('2d');
    t2.setTransform(r.getTransform());
    t2.clearRect(-1e4, -1e4, 2e4, 2e4);
    t2.fillStyle = 'rgba(255,175,100,0.85)';
    t2.fill(all);
    t2.globalCompositeOperation = 'destination-out';
    t2.translate(0, 7 * p.s);
    t2.fill(all);
    t2.globalCompositeOperation = 'source-over';
    r.save(); r.setTransform(1, 0, 0, 1, 0, 0); r.drawImage(tmp, 0, 0); r.restore();
  }
  return { dark, rim, x0, y0, w, h };
}

let _rimTmp = null;
function rimTmp(r) {
  if (!_rimTmp || _rimTmp.width !== r.canvas.width) _rimTmp = makeCanvas(r.canvas.width, r.canvas.height);
  return _rimTmp;
}

function shade(c, k) {
  const v = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  return `rgb(${v.map((x) => Math.round(Math.min(255, x * k))).join(',')})`;
}

function personPath(p, R) {
  const { x, y, s, kind } = p;
  const path = new Path2D();
  const hr = 34 * s;
  // shoulders
  path.moveTo(x - 80 * s, y + 200 * s);
  path.bezierCurveTo(x - 85 * s, y + 40 * s, x - 50 * s, y + 20 * s, x, y + 18 * s);
  path.bezierCurveTo(x + 50 * s, y + 20 * s, x + 85 * s, y + 40 * s, x + 80 * s, y + 200 * s);
  path.closePath();
  // head
  path.moveTo(x + hr, y - 20 * s);
  path.ellipse(x, y - 20 * s, hr, hr * 1.12, 0, 0, Math.PI * 2);
  if (kind < 0.25) { path.moveTo(x + 14 * s, y - 55 * s); path.arc(x, y - 58 * s, 14 * s, 0, Math.PI * 2); } // hair bun
  else if (kind < 0.35) { path.moveTo(x - 70 * s, y - 35 * s); path.lineTo(x, y - 75 * s); path.lineTo(x + 70 * s, y - 35 * s); path.closePath(); } // งอบ hat
  else if (kind < 0.45) { path.moveTo(x + 60 * s, y + 10 * s); path.ellipse(x + 70 * s, y - 20 * s, 26 * s, 34 * s, 0.4, 0, Math.PI * 2); } // fan
  return path;
}
