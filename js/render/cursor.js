// The โขน dancer's hand cursor: a gilded celestial hand whose fingers
// bend back gracefully at rest (the Thai dance hyper-extension), curl
// shut when grabbing, and mirror your real fingers when hand tracking.
// Golden strings run from its fingertips down to the puppet.

import { goldGrad } from './paint.js';

// finger layout in hand space (hand points up, palm facing viewer,
// thumb on the left). [baseX, baseY, len, spreadAngle]
const FINGERS = [
  [-26, -6, 30, -0.95],  // thumb
  [-15, -44, 36, -0.16],
  [-3, -48, 40, -0.03],
  [9, -45, 37, 0.1],
  [19, -38, 29, 0.24],
];

export class KhonHand {
  constructor() {
    this.curl = [0, 0, 0, 0, 0];
    this.target = [0, 0, 0, 0, 0];
    this.tips = FINGERS.map(() => [0, 0]);
    this.x = 0; this.y = 0;
    this.angle = -0.12;
    this.scale = 1;
    this.glow = 0;
    this.t = 0;
  }

  // mode: 'idle' | 'hover' | 'press' | 'grab'; or explicit curls
  setPose(mode, curls) {
    if (curls) { this.target = curls.slice(); return; }
    const P = {
      idle: [-0.25, -0.3, -0.25, -0.2, -0.15],
      hover: [0.1, -0.1, 0.05, 0.1, 0.15],
      press: [0.45, 0.55, 0.5, 0.45, 0.4],
      grab: [0.85, 0.95, 1, 0.95, 0.9],
      jeeb: [0.55, 0.6, -0.3, -0.35, -0.4],
    };
    this.target = P[mode] || P.idle;
  }

  update(dt) {
    this.t += dt;
    for (let i = 0; i < 5; i++) {
      const breathe = Math.sin(this.t * 1.4 + i * 0.6) * 0.03;
      this.curl[i] += (this.target[i] + breathe - this.curl[i]) * Math.min(1, dt * 14);
    }
  }

  draw(ctx, x, y, s = 1, dpr = 1) {
    this.x = x; this.y = y;
    ctx.save();
    ctx.setTransform(dpr * s, 0, 0, dpr * s, x * dpr, y * dpr);
    ctx.rotate(this.angle);
    // the hand hangs from above: draw it pointing down, palm toward us,
    // like a deity reaching from the clouds
    ctx.rotate(Math.PI);
    ctx.translate(0, 34);
    const gold = goldGrad(ctx, -40, -90, 40, 20);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // halo
    const h = ctx.createRadialGradient(0, -20, 5, 0, -20, 90);
    h.addColorStop(0, `rgba(255,230,160,${0.25 + this.glow * 0.35})`);
    h.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = h;
    ctx.fillRect(-90, -110, 180, 180);
    // bracelet (กำไล) and wrist
    ctx.fillStyle = gold;
    ctx.strokeStyle = '#4b2806';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-17, 40); ctx.lineTo(-19, 8); ctx.lineTo(19, 8); ctx.lineTo(17, 40); ctx.closePath();
    ctx.fill(); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.ellipse(0, 14 + i * 9, 22, 5, 0, 0, 7);
      ctx.fillStyle = i === 1 ? '#a3261c' : gold; ctx.fill(); ctx.stroke();
    }
    // palm
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.moveTo(-20, 6);
    ctx.bezierCurveTo(-30, -14, -24, -40, -18, -46);
    ctx.lineTo(24, -40);
    ctx.bezierCurveTo(28, -20, 24, -4, 18, 6);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // palm lines & a ประจำยาม jewel
    ctx.strokeStyle = 'rgba(90,50,10,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-14, -18); ctx.quadraticCurveTo(0, -12, 16, -24); ctx.stroke();
    ctx.fillStyle = '#b8402a';
    ctx.beginPath(); ctx.arc(2, -8, 3.5, 0, 7); ctx.fill();
    // fingers: 3 phalanges each; positive curl folds toward the palm,
    // negative bends back (Thai dance)
    FINGERS.forEach(([bx, by, len, spread], i) => {
      const c = this.curl[i];
      const segs = i === 0 ? [0.5, 0.5] : [0.45, 0.32, 0.23];
      let px = bx, py = by;
      let a = -Math.PI / 2 + spread * (1 - Math.max(0, c) * 0.6);
      const w0 = i === 0 ? 7.5 : 6.5;
      ctx.strokeStyle = '#4b2806';
      segs.forEach((f, k) => {
        const bend = c * (i === 0 ? 0.9 : 1.25) * (k === 0 ? 0.8 : 1.1);
        a += bend * (i === 0 ? 1 : 1) * (i === 0 ? 1 : 1);
        const L = len * f;
        const nx = px + Math.cos(a) * L, ny = py + Math.sin(a) * L;
        const w = w0 * (1 - k * 0.18);
        ctx.lineWidth = w + 2.4;
        ctx.strokeStyle = '#4b2806';
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
        ctx.lineWidth = w;
        ctx.strokeStyle = gold;
        ctx.stroke();
        px = nx; py = ny;
      });
      // long golden nail (เล็บ) of the dancer
      const nail = 9 + (i === 0 ? 0 : 5);
      const tx = px + Math.cos(a) * nail, ty = py + Math.sin(a) * nail;
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = '#f7dc8c';
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke();
      // tip in screen space (for strings)
      const m = ctx.getTransform();
      this.tips[i] = [(m.a * tx + m.c * ty + m.e) / dpr, (m.b * tx + m.d * ty + m.f) / dpr];
    });
    ctx.restore();
  }
}

// Golden strings from the heavens: a softly swaying thread of light with
// motes of gold running down it toward the puppet.
export function drawString(ctx, ax, ay, bx, by, { alpha = 1, t = 0, width = 1.4 } = {}) {
  if (alpha <= 0.01) return;
  const L = Math.hypot(bx - ax, by - ay);
  const mx = (ax + bx) / 2 + Math.sin(t * 1.3 + ax * 0.01) * (4 + L * 0.02);
  const my = (ay + by) / 2 + L * 0.035;
  const at = (u) => {
    const v = 1 - u;
    return [v * v * ax + 2 * v * u * mx + u * u * bx, v * v * ay + 2 * v * u * my + u * u * by];
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(ax, ay, bx, by);
  g.addColorStop(0, 'rgba(255,245,210,0.9)');
  g.addColorStop(0.5, 'rgba(255,200,110,0.6)');
  g.addColorStop(1, 'rgba(255,230,170,0.25)');
  ctx.strokeStyle = 'rgba(255,190,90,0.12)';
  ctx.lineWidth = width * 7;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
  ctx.strokeStyle = g;
  ctx.lineWidth = width;
  ctx.stroke();
  // travelling motes
  const n = Math.max(3, Math.round(L / 60));
  for (let k = 0; k < n; k++) {
    const u = (t * 0.35 + k / n) % 1;
    const [x, y] = at(u);
    const tw = 0.5 + 0.5 * Math.sin(t * 9 + k * 2.3);
    const r = (1.2 + tw * 1.6) * width;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    rg.addColorStop(0, `rgba(255,250,225,${0.9 * tw})`);
    rg.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  }
  ctx.restore();
}
