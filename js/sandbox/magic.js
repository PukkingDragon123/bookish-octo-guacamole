// อัญเชิญและปลูกสร้าง — how things arrive on the cloth.
//
// Summoning: a soft shaft of heavenly light drops onto the spot, sparkles
// stream in to draw the figure's outline, gilded ornaments bloom around
// it, and its shadow condenses out of the
// lamp's glare (it starts close to the lamp — big and blurry — and settles
// onto the cloth, sharp).
//
// Building: houses, sala and stalls rise from the ground up inside bamboo
// scaffolding, with sawdust, flying chips and mallet knocks.

import { Sprite, makeCanvas } from '../art/leather.js';
import { Puppet } from '../puppet/puppet.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a = 1) => (Math.random() - 0.5) * 2 * a;
const ease = (t) => 1 - (1 - t) ** 3;
const BUILD_CATS = new Set(['buildings', 'village']);

export class Magic {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.fx = game.fx;
    this.jobs = [];
  }

  get audio() { return this.game.audio; }

  // called for everything dropped from the chest
  arrive(a, def) {
    if (!a || !a.root) return;
    if (BUILD_CATS.has(def.cat) && a.body && !(a instanceof Puppet)) this.build(a);
    else this.summon(a, def.cat === 'monsters' ? 'violet' : 'gold');
  }

  summon(a, hue = 'gold', big = false) {
    const z0 = a.z;
    const r = a.root;
    const [cx, cy, s] = this.scene.project(r.x, r.y, a.z);
    const fy = this.scene.project(0, this.scene.world.floorY(a.z), a.z)[1];
    this.fx.emit({ k: 'beam', x: cx, y: fy, r: (big ? 150 : 110) * s, life: 1.3, h: hue });
    this._forge(a, hue, big);
    if (hue === 'violet') for (let i = 0; i < 10; i++) this.fx.emit({ k: 'smoke', x: cx + rnd(60), y: fy - 20, vx: rnd(30), vy: -30 - Math.random() * 30, r: 20 + Math.random() * 20, life: 2.4 });
    // condense out of the lamp's glare
    if (a.setDepth) {
      const zFar = Math.min(0.5, z0 + 0.34);
      a.setDepth(zFar);
      this.jobs.push({ type: 'summon', a, t: 0, dur: big ? 1.5 : 1.05, z0: zFar, z1: z0, hue, x: cx, y: fy, s });
    }
    this.audio?.sfx('summon', { pan: clamp((cx - 800) / 800, -1, 1), vol: big ? 0.9 : 0.6 });
  }

  // sparkles stream in from all around and assemble the figure's outline,
  // while gilded ornaments bloom and dissolve around it
  _forge(a, hue, big) {
    const S = this.scene, pts = [];
    for (const b of a.parts || [a.body]) {
      for (const c of b.circles) {
        const [wx, wy] = b.toWorld(c.x, c.y);
        const n = Math.max(1, Math.round(c.r / 9));
        for (let i = 0; i < n; i++) {
          const an = Math.random() * 6.28, rr = c.r * (0.6 + Math.random() * 0.4);
          pts.push(S.project(wx + Math.cos(an) * rr, wy + Math.sin(an) * rr, a.z));
        }
      }
    }
    const want = big ? 160 : 110;
    for (let i = 0; i < want && pts.length; i++) {
      const [tx, ty] = pts[Math.floor(Math.random() * pts.length)];
      const an = Math.random() * 6.28, d = 160 + Math.random() * 320;
      const arrive = 0.45 + Math.random() * 0.5;
      this.fx.emit({ k: 'forge', x: tx + Math.cos(an) * d, y: ty + Math.sin(an) * d * 0.7 - 120, x0: tx + Math.cos(an) * d, y0: ty + Math.sin(an) * d * 0.7 - 120, tx, ty, arrive, curl: rnd(0.35), r: 3.5 + Math.random() * 4, life: arrive + 0.5 + Math.random() * 0.5, h: hue });
    }
    const r = a.root;
    const [cx, cy, s] = S.project(r.x, r.y, a.z);
    const h = (a.height || (a.def?.sprite?.h ?? 200)) * s;
    for (let i = 0; i < (big ? 22 : 14); i++) {
      const an = Math.random() * 6.28, rr = h * (0.35 + Math.random() * 0.45);
      this.fx.emit({ k: 'motif', x: cx + Math.cos(an) * rr, y: cy + Math.sin(an) * rr * 0.9, vx: Math.cos(an) * 25, vy: -25 - Math.random() * 30, r: 16 + Math.random() * 20, life: 1 + Math.random() * 0.9, spin: Math.random() * 6, rot: rnd(2), h: Math.floor(Math.random() * 4) + (hue === 'violet' ? 10 : 0) });
    }
  }

  build(a) {
    const b = a.body;
    const orig = b.sprite;
    const c = makeCanvas(orig.canvas.width, orig.canvas.height);
    const sp = new Sprite(c, orig.scale, { ox: orig.ox, oy: orig.oy, name: orig.name + '~build' });
    sp._alpha = orig._alpha;
    sp.version = 1;
    b.sprite = sp;
    const size = Math.sqrt(orig.w * orig.h);
    this.jobs.push({ type: 'build', a, t: 0, dur: clamp(size / 180, 1.4, 3.2), orig, sp, knock: 0 });
  }

  // magic items dropped from the chest
  cast(def, cx, cy) {
    const S = this.scene, souls = this.game.souls;
    if (def.spell === 'summon') {
      const pool = this.game.content.props.filter((p) => p.cat === 'monsters' || p.cat === 'animals').concat(this.game.content.puppets);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const a = this.game.spawn(pick, cx, cy, 0.02, { quiet: true });
      if (a) this.summon(a, pick.cat === 'monsters' ? 'violet' : 'gold', true);
      return a;
    }
    let hit = S.pick(cx, cy, 40)?.actor;
    if (hit && hit.src) hit = hit.src; // a torn piece: its owner
    if (!(hit instanceof Puppet)) {
      let bd = 260;
      for (const a of S.actors) {
        if (!(a instanceof Puppet)) continue;
        const [x, y] = S.project(a.root.x, a.root.y, a.z);
        const d = Math.hypot(x - cx, y - cy);
        if (d < bd) { bd = d; hit = a; }
      }
    }
    if (!(hit instanceof Puppet)) { this.audio?.sfx('click'); return null; }
    if (def.spell === 'soul') {
      const on = souls.giveSoul(hit, !(hit.dmg && hit.dmg.soul));
      if (on) this.summon(hit, 'gold');
    } else if (def.spell === 'ward') souls.ward(hit);
    else if (def.spell === 'mend') souls.mend(hit);
    this.game.select(hit);
    return hit;
  }

  update(dt) {
    for (const j of this.jobs) {
      j.t += dt;
      const u = clamp(j.t / j.dur, 0, 1);
      const a = j.a;
      if (a.removed) { j.done = true; continue; }
      if (j.type === 'summon') {
        a.setDepth(j.z0 + (j.z1 - j.z0) * ease(u));
        this.scene.extraGlows.push({ x: j.x, y: j.y - 120 * j.s, r: 320 * j.s, i: Math.sin(Math.PI * u) * 0.9, c: j.hue === 'violet' ? [0.75, 0.5, 1] : [1, 0.86, 0.5] });
        if (u >= 1) j.done = true;
      } else if (j.type === 'build') this._buildStep(j, u, dt);
    }
    this.jobs = this.jobs.filter((j) => !j.done);
  }

  _buildStep(j, u, dt) {
    const { a, orig, sp } = j;
    const g = sp.canvas.getContext('2d');
    const W = sp.canvas.width, H = sp.canvas.height;
    const k = u < 1 ? 1 - (1 - u) ** 1.6 : 1;
    const yLine = H * (1 - k);
    g.clearRect(0, 0, W, H);
    g.save();
    g.beginPath(); g.rect(0, yLine, W, H - yLine); g.clip();
    g.drawImage(orig.canvas, 0, 0);
    g.restore();
    // bamboo scaffolding standing in front of the unfinished part
    const fade = u < 0.85 ? 1 : 1 - (u - 0.85) / 0.15;
    if (fade > 0) {
      g.save();
      g.globalAlpha = fade;
      g.strokeStyle = '#2a1a0c';
      g.lineCap = 'round';
      const px = 1 / sp.scale;
      g.lineWidth = 3 * px;
      const cols = Math.max(2, Math.round(W / (60 * px)));
      for (let i = 0; i <= cols; i++) {
        const x = (W * 0.08) + (W * 0.84 * i) / cols;
        g.beginPath(); g.moveTo(x, H * 0.02); g.lineTo(x + rnd(0.5), H); g.stroke();
      }
      g.lineWidth = 2.2 * px;
      for (let y = H; y > H * 0.02; y -= 42 * px) {
        g.beginPath(); g.moveTo(W * 0.06, y); g.lineTo(W * 0.94, y - 2 * px); g.stroke();
      }
      // lashings
      g.lineWidth = 1.2 * px;
      g.beginPath(); g.moveTo(W * 0.08, yLine); g.lineTo(W * 0.92, H * 0.02 + yLine * 0.3); g.stroke();
      g.restore();
    }
    sp.version++;
    // dust and chips along the rising edge
    const b = a.body;
    const edgeLocal = yLine * sp.scale;
    const [wx0, wy0] = b.toWorld(-orig.w * 0.4 + orig.w * Math.random() * 0.8 - b.com[0] + orig.w / 2, edgeLocal - b.com[1]);
    const [cx, cy] = this.scene.project(wx0, wy0, a.z);
    const fy = this.scene.project(0, this.scene.world.floorY(a.z), a.z)[1];
    if (u < 1) {
      if (Math.random() < dt * 30) this.fx.emit({ k: 'dust', x: cx, y: cy, vx: rnd(40), vy: -20 - Math.random() * 30, r: 8 + Math.random() * 10, life: 1.2 });
      if (Math.random() < dt * 14) this.fx.emit({ k: 'chip', x: cx, y: cy, vx: rnd(220), vy: -200 - Math.random() * 150, g: 1400, r: 2 + Math.random() * 2.5, life: 1.4, fy });
      j.knock -= dt;
      if (j.knock <= 0) {
        j.knock = 0.14 + Math.random() * 0.16;
        this.audio?.sfx('hammer', { pan: clamp((cx - 800) / 800, -1, 1), vol: 0.5, pitch: 0.8 + Math.random() * 0.5 });
      }
    }
    if (u >= 1) {
      b.sprite = orig;
      this.game.stage.screen?.dropTexture?.(sp);
      for (let i = 0; i < 12; i++) this.fx.emit({ k: 'dust', x: cx + rnd(orig.w * 0.4), y: fy - 10, vx: rnd(80), vy: -20, r: 16 + Math.random() * 14, life: 1.6 });
      this.audio?.sfx('chime', { vol: 0.5 });
      j.done = true;
    }
  }
}
