// ผู้ชม — the audience in front of the booth.
//
// A big crowd of puppet devas (tinted เทวดา and นางฟ้า, with a few other
// troupe figures mixed in) on straw mats under lanterns. Each one is a real
// jointed rig posed every frame, so they can:
//   wait     sit / stand and watch, breathing, glancing about
//   chat     turn to a neighbour and talk (little bubbles)
//   walk     wander to a new spot, stroll to a friend
//   cheer    arms up, hop, "เย้!" — on hits, dances, rallies
//   boo      lean back, arm thrust down, "บู้~" — when nothing happens
//   crazy    a fight is on: jumping, waving, running back and forth
// Scroll down (wheel / drag below the stage / the ผู้ชม medallion) to see
// them up close.

import { assemble, drawRig, rigBounds } from '../puppet/rig.js';
import { makeCanvas, rng } from './paint.js';

const TAU = Math.PI * 2;
const AREA = { x0: -260, x1: 1860, y0: 1290, y1: 1820 }; // scene coords below the booth

const LINES = {
  cheer: ['เย้!', 'สุดยอด!', 'เก่งมาก!', 'ไชโย!', 'อีกๆ!', 'หรอยจัง!'],
  boo: ['บู้~', 'น่าเบื่อ!', 'เอาใหม่!', 'ง่วงแล้วนะ', 'ทำอะไรสักอย่างสิ!'],
  crazy: ['ฟันเลย!', 'สู้ๆ!', 'ระวังข้างหลัง!', 'โอ๊ย!', 'ยักษ์มาแล้ว!', 'หลบเร็ว!'],
  chat: ['คืนนี้สนุกนะ', 'ซื้อลูกชิ้นไหม', 'นายหนังเก่งจัง', 'ไอ้เท่งตลกมาก', 'ดูหมูเด้งสิ', 'ฟ้าสวยจัง', 'เมื่อไหร่จะรำอีก', 'ข้าวเหนียวหมดแล้ว'],
  gasp: ['ตายแล้ว!', 'ว้าย!', 'อุ๊ย!'],
};
const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];

export class Crowd {
  constructor(game) {
    this.game = game;
    this.people = [];
    this.t = 0;
    this.mood = { cheer: 0, fight: 0, bored: 0 };
    this.quiet = 0; // seconds since anything happened on stage
    this.bubbles = [];
    this.ground = null;
    game.scene.on('hit', (h) => { this.mood.cheer = Math.min(1, this.mood.cheer + (h.vital >= 1.6 ? 0.5 : 0.25)); this.quiet = 0; });
  }

  // cast: rigs to make the audience from; devas are tinted into a heavenly host
  setCast(rigs) {
    const devas = rigs.filter((r) => /thewada|nang/.test(r.id || ''));
    const others = rigs.filter((r) => !devas.includes(r) && r.limbs && r.limbs.armF);
    const tints = [0, 35, 150, 210, 290, 330];
    const variants = [];
    for (const r of devas) for (const h of tints) variants.push(tintRig(r, h));
    const R = rng(91);
    this.people = [];
    const rows = [
      { y: 1420, n: 14, s: 0.62 },
      { y: 1570, n: 12, s: 0.74 },
      { y: 1730, n: 10, s: 0.88 },
    ];
    for (const row of rows) {
      for (let i = 0; i < row.n; i++) {
        const rig = R() < 0.8 && variants.length ? variants[Math.floor(R() * variants.length)] : others[Math.floor(R() * others.length)] || variants[0];
        if (!rig) continue;
        const x = AREA.x0 + 80 + ((i + R() * 0.6) / row.n) * (AREA.x1 - AREA.x0 - 160);
        this.people.push(this._person(rig, x, row.y + (R() - 0.5) * 30, row.s * (0.92 + R() * 0.16), R));
      }
    }
    this.people.sort((a, b) => a.y - b.y);
  }

  _person(rig, x, y, s, R) {
    const T = assemble(rig), b = rigBounds(rig, T);
    return {
      rig, x, y, s, hx: x, b, face: x < 800 ? 1 : -1,
      state: 'wait', st: R() * 3, ph: R() * TAU, hop: 0, vy: 0, vx: 0, goal: null, mate: null,
      sit: R() < 0.45, ex: 0, // personal excitement
    };
  }

  // -------------------------------------------------------------- brain
  update(dt) {
    const g = this.game, S = g.scene;
    this.t += dt;
    const fighting = S.actors.some((a) => a.attacking > 0 || (a.anim && a.anim.def.attack));
    const dancing = S.actors.some((a) => a.anim && (a.anim.name || '').startsWith('ram') || a.flyRole === 'dancer');
    const busy = fighting || dancing || S.actors.some((a) => a.speech || (a.walkAmt || 0) > 0.3);
    this.quiet = busy ? 0 : this.quiet + dt;
    const M = this.mood;
    M.fight += ((fighting ? 1 : 0) - M.fight) * Math.min(1, dt * (fighting ? 2 : 0.4));
    M.cheer = Math.max(0, M.cheer - dt * 0.25) + (dancing ? dt * 0.08 : 0);
    M.bored = Math.min(1, Math.max(0, (this.quiet - 18) / 12));
    for (const p of this.people) this._think(p, dt);
    this.bubbles = this.bubbles.filter((b) => (b.t += dt) < b.life);
  }

  _say(p, cat) {
    if (this.bubbles.length > 6 || this.bubbles.some((b) => b.p === p)) return;
    this.bubbles.push({ p, text: pick(LINES[cat]), t: 0, life: 1.8 + Math.random() * 0.8 });
  }

  _think(p, dt) {
    const M = this.mood;
    p.st -= dt;
    p.ex += ((M.fight * 1.2 + M.cheer) - p.ex) * Math.min(1, dt * (1 + p.ph % 1));
    // gravity for hops
    if (p.hop > 0 || p.vy) { p.vy += 1800 * dt; p.hop -= p.vy * dt; if (p.hop <= 0) { p.hop = 0; p.vy = 0; } }
    const want = M.fight > 0.4 && p.ex > 0.5 ? 'crazy' : M.cheer > 0.35 + (p.ph % 0.3) ? 'cheer' : M.bored > 0.4 && (p.ph % 1) < M.bored ? 'boo' : null;
    if (want && p.state !== want && p.state !== 'walk') { p.state = want; p.st = 1 + Math.random() * 2; }
    if (!want && (p.state === 'cheer' || p.state === 'crazy' || p.state === 'boo') && p.st <= 0) p.state = 'wait';
    switch (p.state) {
      case 'wait':
        if (p.st <= 0) {
          const r = Math.random();
          if (r < 0.25) { p.state = 'walk'; p.goal = Math.max(AREA.x0 + 60, Math.min(AREA.x1 - 60, p.x + (Math.random() - 0.5) * 600)); p.sit = false; }
          else if (r < 0.55) { p.state = 'chat'; p.st = 3 + Math.random() * 3; p.mate = this._near(p); if (p.mate) { p.face = Math.sign(p.mate.x - p.x) || 1; this._say(p, 'chat'); } }
          else { p.st = 2 + Math.random() * 4; p.face = p.x < 800 ? 1 : -1; if (Math.random() < 0.3) p.sit = !p.sit; }
        }
        break;
      case 'chat':
        if (p.mate && Math.random() < dt * 0.5) this._say(Math.random() < 0.5 ? p : p.mate, 'chat');
        if (p.st <= 0) { p.state = 'wait'; p.st = 2 + Math.random() * 3; p.mate = null; }
        break;
      case 'walk': {
        const d = p.goal - p.x;
        p.face = Math.sign(d) || p.face;
        p.x += Math.sign(d) * Math.min(Math.abs(d), 70 * dt);
        if (Math.abs(d) < 4) { p.state = 'wait'; p.st = 2 + Math.random() * 3; p.face = p.x < 800 ? 1 : -1; }
        break;
      }
      case 'cheer':
        if (!p.hop && Math.random() < dt * 1.6) p.vy = -380 - Math.random() * 200, p.hop = 0.01;
        if (Math.random() < dt * 0.25) this._say(p, 'cheer');
        p.sit = false;
        break;
      case 'boo':
        if (Math.random() < dt * 0.2) this._say(p, 'boo');
        break;
      case 'crazy':
        p.sit = false;
        if (!p.hop && Math.random() < dt * 2.6) p.vy = -480 - Math.random() * 300, p.hop = 0.01;
        p.vx += (Math.random() - 0.5) * 900 * dt;
        p.vx *= Math.exp(-dt * 2);
        p.x = Math.max(AREA.x0 + 40, Math.min(AREA.x1 - 40, p.x + p.vx * dt));
        if (Math.abs(p.vx) > 20) p.face = Math.sign(p.vx);
        if (Math.random() < dt * 0.35) this._say(p, 'crazy');
        break;
    }
  }

  _near(p) {
    let best = null, bd = 260;
    for (const o of this.people) {
      if (o === p || Math.abs(o.y - p.y) > 60) continue;
      const d = Math.abs(o.x - p.x);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // -------------------------------------------------------------- pose
  _angles(p) {
    const L = p.rig.limbs || {}, t = this.t + p.ph, A = {};
    const set = (id, v) => { if (id) A[id] = (A[id] || 0) + v; };
    const aF = L.armF || [], aB = L.armB || [], lF = L.legF || [], lB = L.legB || [];
    // breathing
    set(L.head || 'head', Math.sin(t * 1.3) * 0.04);
    if (p.state === 'walk') {
      const w = Math.sin(t * 7);
      set(lF[0], w * 0.45); set(lB[0], -w * 0.45); set(lF[1], Math.max(0, -w) * 0.5); set(lB[1], Math.max(0, w) * 0.5);
      set(aF[0], -w * 0.35); set(aB[0], w * 0.35);
    } else if (p.state === 'cheer' || p.state === 'crazy') {
      const wv = Math.sin(t * (p.state === 'crazy' ? 14 : 9));
      set(aF[0], -2.6 + wv * 0.35); set(aF[1], -0.3 + wv * 0.3);
      set(aB[0], -2.4 - wv * 0.35); set(aB[1], -0.3 - wv * 0.3);
      set(L.head || 'head', -0.15);
      if (p.hop > 0) { set(lF[0], -0.5); set(lF[1], 0.8); set(lB[0], 0.3); set(lB[1], 0.7); }
    } else if (p.state === 'boo') {
      set(aF[0], -0.9); set(aF[1], 0.6); set(aB[0], 0.3); set(L.head || 'head', 0.2);
    } else if (p.state === 'chat') {
      const g = Math.sin(t * 3);
      set(aF[0], -0.8 + g * 0.25); set(aF[1], -0.9 + g * 0.2);
    }
    if (p.sit && (p.state === 'wait' || p.state === 'chat' || p.state === 'boo')) {
      set(lF[0], -1.45); set(lF[1], 1.5); set(lB[0], -1.35); set(lB[1], 1.55);
    }
    return A;
  }

  // -------------------------------------------------------------- draw
  draw(f, cam) {
    if (!this.people.length) return;
    // visible?
    const vy1 = cam.y + cam.vh / 2 / cam.zoom;
    if (vy1 < AREA.y0 - 220) return;
    if (!this.ground) this.ground = paintGround();
    const G = this.ground;
    f.drawImage(G.c, G.x0, G.y0, G.w, G.h);
    const L = Math.min(1.2, this.game.scene.lamp.intensity);
    for (const p of this.people) {
      const A = this._angles(p);
      const T = assemble(p.rig, undefined, A);
      const b = p.b, s = p.s;
      const sitDrop = p.sit && p.state !== 'walk' ? b.h * 0.22 : 0;
      const breath = Math.sin(this.t * 1.7 + p.ph) * 2;
      f.save();
      f.translate(p.x, p.y - p.hop + sitDrop * s + breath);
      f.scale(s * p.face, s);
      if (p.state === 'boo') f.rotate(-0.08 * p.face);
      if (p.state === 'crazy') f.rotate(Math.sin(this.t * 11 + p.ph) * 0.08);
      f.translate(-(b.x0 + b.w / 2), -b.y1);
      drawRig(f, p.rig, T);
      f.restore();
      // a soft contact shadow on the mat
      f.fillStyle = 'rgba(10,4,2,0.35)';
      f.beginPath(); f.ellipse(p.x, p.y + 4, b.w * s * 0.32 * (1 - Math.min(0.6, p.hop / 300)), 9 * s, 0, 0, TAU); f.fill();
    }
    // night over the crowd, warm toward the stage
    f.save();
    f.globalCompositeOperation = 'source-atop';
    f.restore();
    const shade = f.createLinearGradient(0, AREA.y0 - 150, 0, AREA.y1 + 80);
    shade.addColorStop(0, `rgba(255,170,90,${0.08 * L})`);
    shade.addColorStop(0.4, 'rgba(10,6,20,0.0)');
    shade.addColorStop(1, 'rgba(8,4,16,0.35)');
    f.fillStyle = shade;
    f.fillRect(AREA.x0 - 300, AREA.y0 - 150, AREA.x1 - AREA.x0 + 600, AREA.y1 - AREA.y0 + 260);
    // bubbles
    for (const bb of this.bubbles) {
      const p = bb.p, a = Math.min(1, bb.t * 5, (bb.life - bb.t) * 4);
      const hy = p.y - p.b.h * p.s - p.hop - 18;
      f.save();
      f.globalAlpha = a;
      f.font = '600 30px Sarabun, sans-serif';
      const w = f.measureText(bb.text).width + 28;
      const x = p.x - w / 2, y = hy - 44;
      f.fillStyle = '#f6e8c6';
      f.strokeStyle = '#b8862e';
      f.lineWidth = 3;
      f.beginPath();
      f.roundRect ? f.roundRect(x, y, w, 46, 16) : f.rect(x, y, w, 46);
      f.moveTo(p.x - 10, y + 46); f.lineTo(p.x, y + 60); f.lineTo(p.x + 10, y + 46);
      f.fill(); f.stroke();
      f.fillStyle = '#3a1a08';
      f.textAlign = 'left';
      f.fillText(bb.text, x + 14, y + 33);
      f.restore();
    }
  }
}

// pre-tinted copy of a rig (hue-rotated sprites) so each deva looks different
function tintRig(rig, hue) {
  if (!hue) return rig;
  const parts = {};
  for (const [id, p] of Object.entries(rig.parts)) {
    const s = p.sprite;
    const c = makeCanvas(s.canvas.width, s.canvas.height);
    const g = c.getContext('2d');
    g.filter = `hue-rotate(${hue}deg) saturate(1.15)`;
    g.drawImage(s.canvas, 0, 0);
    const sp = Object.create(Object.getPrototypeOf(s));
    Object.assign(sp, s, { canvas: c, _alpha: s._alpha });
    parts[id] = { ...p, sprite: sp };
  }
  return { ...rig, parts };
}

// straw mats, the earth and a row of lanterns on poles
function paintGround() {
  const x0 = AREA.x0 - 400, y0 = AREA.y0 - 120, w = AREA.x1 - AREA.x0 + 800, h = AREA.y1 - AREA.y0 + 900, k = 0.5;
  const c = makeCanvas(w * k, h * k), g = c.getContext('2d');
  g.scale(k, k); g.translate(-x0, -y0);
  const R = rng(5);
  const earth = g.createLinearGradient(0, y0, 0, y0 + h);
  earth.addColorStop(0, '#2a1810'); earth.addColorStop(1, '#120a08');
  g.fillStyle = earth; g.fillRect(x0, y0, w, h);
  for (let i = 0; i < 22; i++) {
    const mx = x0 + R() * w, my = AREA.y0 + 40 + R() * (AREA.y1 - AREA.y0), mw = 160 + R() * 160, mh = 40 + R() * 20;
    g.save(); g.translate(mx, my); g.rotate((R() - 0.5) * 0.1);
    g.fillStyle = ['#6b4a22', '#7a5426', '#5c3d1c'][i % 3];
    g.fillRect(-mw / 2, -mh / 2, mw, mh);
    g.strokeStyle = 'rgba(30,15,5,0.45)'; g.lineWidth = 2;
    for (let x = -mw / 2 + 8; x < mw / 2; x += 10) { g.beginPath(); g.moveTo(x, -mh / 2); g.lineTo(x, mh / 2); g.stroke(); }
    g.strokeStyle = ['#b3261c', '#2f6d31', '#2b5199'][i % 3]; g.lineWidth = 4;
    g.strokeRect(-mw / 2 + 4, -mh / 2 + 4, mw - 8, mh - 8);
    g.restore();
  }
  for (let x = x0 + 120; x < x0 + w; x += 420) {
    g.strokeStyle = '#1a0f08'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(x, AREA.y0 + 40); g.lineTo(x, AREA.y0 - 110); g.stroke();
    const glow = g.createRadialGradient(x, AREA.y0 - 120, 4, x, AREA.y0 - 120, 120);
    glow.addColorStop(0, 'rgba(255,200,110,0.55)'); glow.addColorStop(1, 'rgba(255,200,110,0)');
    g.fillStyle = glow; g.fillRect(x - 130, AREA.y0 - 250, 260, 260);
    g.fillStyle = '#c0301f'; g.beginPath(); g.ellipse(x, AREA.y0 - 120, 18, 24, 0, 0, TAU); g.fill();
  }
  return { c, x0, y0, w, h };
}
