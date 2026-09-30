// ขวัญและบาดแผล — wounds, souls and the magic that protects them.
//
// Every puppet and animal is cut from hide, so a hard enough blow tears
// it: the cut is punched out of that part's sprite (light shines through
// the rip), cracks spread from blunt blows, and a part torn through drops
// off as a loose piece.
//
// Give a figure a soul (ปลุกเสก) and it becomes alive: wounds bleed red
// gel that drips, spatters and pools on the floor, it weeps when hurt,
// feels fire, and when its body gives out the soul rises out of it.
//
// A yantra ward (ลงยันต์) soaks up blows until its power runs out, and
// mending (ชุบชีวิต) closes wounds, stitches limbs back on and calls a
// departed soul home.

import { Sprite, makeCanvas } from '../art/leather.js';
import { Puppet } from '../puppet/puppet.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a = 1) => (Math.random() - 0.5) * 2 * a;

// A limb (and whatever hangs off it) torn from its puppet.
export class Debris {
  constructor(src, ids, joint) {
    this.kind = 'debris';
    this.src = src;
    this.world = src.world;
    this.joint = joint;
    this.ids = ids;
    this.bodies = {};
    this.parts = [];
    for (const id of ids) {
      const b = src.bodies[id];
      if (!b) continue;
      this.bodies[id] = b;
      this.parts.push(b);
      b.owner = this;
    }
    this.body = this.bodies[ids[0]];
    this.z = src.z;
    this.facing = 1;
    this.flipAnim = 0;
    this.def = { id: 'debris', name: 'ชิ้นหนังขาด', en: 'Torn-off piece' };
  }
  get root() { return this.body; }
  update(dt) { this.flipAnim = Math.max(0, this.flipAnim - dt * 5); }
  hitTest(wx, wy, pad) { return Puppet.prototype.hitTest.call(this, wx, wy, pad); }
  handleWorld() { return [this.body.x, this.body.y]; }
  flip() {
    const x0 = this.body.x;
    for (const b of this.parts) { b.x = 2 * x0 - b.x; b.px = 2 * x0 - b.px; b.a = -b.a; b.pa = -b.pa; b.va = -b.va; b.flip = -b.flip; }
    this.facing = -this.facing;
    this.flipAnim = 1;
  }
  setDepth(z) {
    z = clamp(z, 0.005, 0.55);
    const L = this.world.lamp, r = this.body, Lx = L.x + (L.sx || 0);
    const sx = Lx + (r.x - Lx) / (1 - this.z), sy = L.y + (r.y - L.y) / (1 - this.z);
    const dx = Lx + (sx - Lx) * (1 - z) - r.x, dy = L.y + (sy - L.y) * (1 - z) - r.y;
    for (const b of this.parts) { b.x += dx; b.y += dy; b.px += dx; b.py += dy; b.z = z; }
    this.z = z;
  }
  remove() {
    for (const b of this.parts) this.world.remove(b);
    this.removed = true;
  }
}

export class Souls {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.fx = game.fx;
    this.t = 0;
    this.scene.on('hit', (h) => this.onHit(h));
  }

  get audio() { return this.game.audio; }

  st(a) {
    return (a.dmg ||= { soul: false, ward: 0, wardFlash: 0, bleeds: [], pain: 0, cry: 0, lost: 0, beat: Math.random(), burnT: 0 });
  }

  // ------------------------------------------------------------ spells
  giveSoul(a, on = true) {
    const s = this.st(a);
    s.soul = on;
    if (on) {
      a.alive = true;
      this._burst(a, 'wisp', 16, -1);
      this.audio?.sfx('magic', { vol: 0.5 });
    } else {
      this._burst(a, 'wisp', 10, 1);
      this.audio?.sfx('ghost', { vol: 0.4 });
    }
    return on;
  }

  ward(a) {
    const s = this.st(a);
    s.ward = 1;
    s.wardFlash = 1;
    this._burst(a, 'gold', 26);
    this.audio?.sfx('magic', { vol: 0.5, pitch: 1.2 });
  }

  mend(a) {
    const s = this.st(a);
    // stitch torn pieces back on (parents first)
    const mine = this.scene.actors.filter((d) => d instanceof Debris && d.src === a && !d.removed);
    let guard = 12;
    while (mine.length && guard-- > 0) {
      for (let i = mine.length - 1; i >= 0; i--) if (this._reattach(a, mine[i])) mine.splice(i, 1);
    }
    for (const b of a.parts) this._restore(b);
    s.bleeds = [];
    s.lost = 0;
    s.pain = 0;
    if (a.dead) {
      a.dead = false;
      a.stun = 0.4;
      a.setMode('planted');
      a.plantAt(a.root.x);
      a._rise = 1;
      this.audio?.sfx('cheer', { vol: 0.35 });
    }
    this._burst(a, 'heal', 30);
    this.audio?.sfx('sparkle', { vol: 0.6 });
  }

  // ------------------------------------------------------------ damage
  onHit(h) {
    const a = h.target;
    if (!(a instanceof Puppet) || a.removed) return;
    const s = this.st(a);
    let b = h.body && h.body.owner === a ? h.body : this._nearestPart(a, h.x, h.y);
    if (!b || b.isRod) b = a.root;
    const kind = h.kind || 'blunt';
    let dmg = (h.weapon ? 30 : kind === 'bite' ? 18 : 13) * (h.power || 1) * (0.8 + Math.random() * 0.4);
    if (h.blocked) dmg *= 0.3;
    if (s.ward > 0) {
      const absorbed = Math.min(s.ward * 260, dmg * 0.9);
      s.ward = Math.max(0, s.ward - absorbed / 260);
      s.wardFlash = 1;
      dmg -= absorbed;
      const [cx, cy] = this.scene.project(h.x, h.y, a.z);
      for (let i = 0; i < 14; i++) { const an = Math.random() * 6.28, sp = 150 + Math.random() * 250; this.fx.emit({ k: 'gold', x: cx, y: cy, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, r: 4, life: 0.6 }); }
      this.audio?.sfx('ching', { vol: 0.5 });
      if (dmg < 6) return;
    }
    this.wound(a, b, h.x, h.y, dmg, kind, h.nx || 1);
  }

  _nearestPart(a, x, y) {
    let best = null, bd = Infinity;
    for (const b of a.parts) {
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  _maxHp(a, b) {
    const L = a.rig.limbs || {};
    const size = clamp(Math.sqrt(b.sprite.w * b.sprite.h) / 90, 0.6, 2.2);
    if (b === a.root) return 150 * size;
    if (b.part === (L.head || 'head')) return 85 * size;
    return 70 * size;
  }

  wound(a, b, wx, wy, dmg, kind = 'blade', dir = 1) {
    const s = this.st(a);
    if (b.hp == null) b.hp = b.hpMax = this._maxHp(a, b);
    b.hp -= dmg;
    const soul = s.soul && !a.dead;
    this._cut(b, wx, wy, dmg, kind, soul, dir);
    const [cx, cy] = this.scene.project(wx, wy, a.z);
    if (soul) {
      const n = Math.round(clamp(dmg * (kind === 'blunt' ? 0.25 : 0.6), 3, 26));
      this._spray(cx, cy, a.z, n, dir, kind === 'blunt' ? 0.6 : 1);
      const [lx, ly] = b.toLocal(wx, wy);
      s.bleeds.push({ body: b, lx, ly, t: 2.5 + dmg * 0.08, rate: clamp(dmg / 12, 0.6, 3.5) });
      s.pain = 1;
      s.cry = Math.max(s.cry, 3 + dmg * 0.05);
      s.lost += dmg * 0.25;
      if (Math.random() < 0.6) this.audio?.sfx('gasp', { vol: 0.45, pan: this.game._pan(a), pitch: 1.1 + Math.random() * 0.3 });
    } else {
      // leather scraps
      for (let i = 0; i < Math.min(10, 2 + dmg * 0.15); i++) this.fx.emit({ k: 'chip', x: cx, y: cy, vx: dir * (80 + Math.random() * 200), vy: -150 - Math.random() * 200, g: 1400, r: 2 + Math.random() * 3, life: 1.6, fy: this._floorCloth(a.z) });
      this.audio?.sfx('rip', { vol: 0.5, pan: this.game._pan(a) });
    }
    if (b.hp <= 0) {
      if (b !== a.root && b.part) this.sever(a, b, dir);
      else if (soul) this.die(a);
      else { b.hp = 1; a.setMode('ragdoll'); a.stun = 1.6; }
    }
    if (soul && (s.lost > 120 || (a.root.hp != null && a.root.hp <= 0))) this.die(a);
  }

  sever(a, b, dir = 1) {
    const id = b.part;
    const j = a.joints[id];
    if (!j) return;
    const rig = a.rig;
    const ids = [];
    const walk = (k) => { ids.push(k); for (const [c, p] of Object.entries(rig.parts)) if (p.parent === k && a.bodies[c]) walk(c); };
    walk(id);
    this.scene.world.removeC(j);
    delete a.joints[id];
    const bodies = new Set(ids.map((k) => a.bodies[k]).filter(Boolean));
    a._semBak ||= { ...a.sem };
    for (const k of Object.keys(a.sem)) if (a.sem[k] && bodies.has(a.sem[k].B)) a.sem[k] = null;
    a._tailBak ||= a.tail.slice();
    a._gaitBak ||= a.gait.slice();
    a.tail = a.tail.filter((t) => !bodies.has(t.B));
    a.gait = a.gait.filter((g) => !bodies.has(g.j.B));
    a._cutPins ||= {};
    for (const [k, pin] of Object.entries(a.pins)) if (bodies.has(pin.B)) { pin.enabled = false; a._cutPins[k] = pin; delete a.pins[k]; }
    const d = new Debris(a, ids, j);
    for (const k of ids) delete a.bodies[k];
    a.parts = a.parts.filter((x) => !bodies.has(x));
    // the piece flies off
    for (const pb of d.parts) { pb.vx += dir * 220 + rnd(60); pb.vy -= 260; pb.va += rnd(9); }
    this.scene.actors.push(d);
    this.scene.emit('added', d);
    const s = this.st(a);
    if (s.soul && !a.dead) {
      s.bleeds.push({ body: j.A, lx: j.la[0], ly: j.la[1], t: 4, rate: 4, spurt: true });
      s.bleeds.push({ body: b, lx: j.lb[0], ly: j.lb[1], t: 2.5, rate: 2.5, spurt: true });
      s.lost += 30;
      this.audio?.sfx('gasp', { vol: 0.7, pan: this.game._pan(a) });
      if (id === (rig.limbs?.head || 'head')) this.die(a);
    } else this.audio?.sfx('rip', { vol: 0.9, pan: this.game._pan(a), pitch: 0.7 });
    this.game.cam.shake = Math.max(this.game.cam.shake, 8);
    return d;
  }

  die(a) {
    if (a.dead) return;
    a.dead = true;
    a.alive = false;
    const fly = this.game.flies.find((f) => f.actor === a);
    fly?.release();
    a.setMode('ragdoll');
    a.stopAnim?.();
    const s = this.st(a);
    s.soulOut = 3;
    this.audio?.sfx('ghost', { vol: 0.8, pan: this.game._pan(a) });
  }

  _reattach(a, d) {
    const j = d.joint, A = j.A, B = j.B;
    if (!a.parts.includes(A)) return false;
    // match mirroring, then rotate & move the piece so the joint closes
    if (B.flip !== A.flip) {
      const x0 = B.x;
      for (const b of d.parts) { b.x = 2 * x0 - b.x; b.a = -b.a; b.flip = -b.flip; }
    }
    const [pbx, pby] = B.toWorld(j.lb[0], j.lb[1]);
    const da = A.a + (j.rest + (j.target || 0)) * A.flip - B.a;
    const c = Math.cos(da), sn = Math.sin(da);
    for (const b of d.parts) {
      const rx = b.x - pbx, ry = b.y - pby;
      b.x = pbx + rx * c - ry * sn; b.y = pby + rx * sn + ry * c; b.a += da;
    }
    const [pax, pay] = A.toWorld(j.la[0], j.la[1]);
    const [qbx, qby] = B.toWorld(j.lb[0], j.lb[1]);
    for (const b of d.parts) {
      b.x += pax - qbx; b.y += pay - qby;
      b.px = b.x; b.py = b.y; b.pa = b.a; b.vx = b.vy = b.va = 0;
      b.z = a.z; b.owner = a;
    }
    for (const [id, b] of Object.entries(d.bodies)) { a.bodies[id] = b; a.parts.push(b); }
    a.joints[B.part] = j;
    this.scene.world.addC(j);
    for (const [k, pin] of Object.entries(a._cutPins || {})) if (d.parts.includes(pin.B)) { a.pins[k] = pin; delete a._cutPins[k]; }
    if (a._semBak) for (const [k, jj] of Object.entries(a._semBak)) if (jj && a.parts.includes(jj.B) && a.parts.includes(jj.A)) a.sem[k] = jj;
    if (a._tailBak) a.tail = a._tailBak.filter((t) => a.parts.includes(t.B));
    if (a._gaitBak) a.gait = a._gaitBak.filter((g) => a.parts.includes(g.j.B));
    // pull it out of the scene without destroying the bodies
    d.removed = true;
    this.scene.actors = this.scene.actors.filter((x) => x !== d);
    this.scene.emit('removed', d);
    if (this.game.selected === d) this.game.select(a);
    return true;
  }

  // ------------------------------------------------------------ art
  _own(b) {
    if (b._origSprite) return b.sprite;
    const o = b.sprite;
    const c = makeCanvas(o.canvas.width, o.canvas.height);
    c.getContext('2d').drawImage(o.canvas, 0, 0);
    const sp = new Sprite(c, o.scale, { ox: o.ox, oy: o.oy, name: o.name + '~cut' });
    sp._alpha = o._alpha;
    sp.version = 1;
    b._origSprite = o;
    b.sprite = sp;
    return sp;
  }

  _restore(b) {
    if (b._origSprite) {
      this.game.stage.screen?.dropTexture?.(b.sprite);
      b.sprite = b._origSprite;
      b._origSprite = null;
    }
    if (b.hpMax) b.hp = b.hpMax;
  }

  // paint the wound into the part's own copy of its sprite
  _cut(b, wx, wy, dmg, kind, soul, dir) {
    const sp = this._own(b);
    const g = sp.canvas.getContext('2d');
    const [lx, ly] = b.toLocal(wx, wy);
    const k = 1 / sp.scale;
    let px = (lx + b.com[0]) * k, py = (ly + b.com[1]) * k;
    // pull the point inside the silhouette a little so the cut shows
    px = px * 0.85 + (b.com[0] * k) * 0.15;
    py = py * 0.85 + (b.com[1] * k) * 0.15;
    const len = clamp(dmg * 1.25, 10, 60) * k;
    const ang = (kind === 'point' ? 0.3 : -0.6 + rnd(0.5)) * (dir * b.flip > 0 ? 1 : -1) - b.a * b.flip;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    g.save();
    if (kind === 'blunt' || kind === 'bite') {
      // cracks radiating from a bruise
      g.globalCompositeOperation = 'source-atop';
      const br = g.createRadialGradient(px, py, 0, px, py, len * 0.8);
      br.addColorStop(0, soul ? 'rgba(90,10,30,0.55)' : 'rgba(0,0,0,0.35)');
      br.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = br;
      g.fillRect(px - len, py - len, len * 2, len * 2);
      g.globalCompositeOperation = 'destination-out';
      g.lineWidth = 1.2 * k;
      g.lineCap = 'round';
      const n = kind === 'bite' ? 4 : 3 + Math.round(dmg / 12);
      for (let i = 0; i < n; i++) {
        let x = px, y = py, a2 = Math.random() * 6.28;
        g.beginPath(); g.moveTo(x, y);
        for (let s2 = 0; s2 < 4; s2++) { a2 += rnd(0.6); x += Math.cos(a2) * len * 0.22; y += Math.sin(a2) * len * 0.22; g.lineTo(x, y); }
        g.stroke();
      }
      if (kind === 'bite') for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(px + (i - 2) * len * 0.16, py + (i % 2 ? 1 : -1) * len * 0.1, 1.4 * k, 0, 7); g.fill(); }
    } else {
      // a ragged rip: a thin lens with torn, fibrous edges
      const pts = [], back = [];
      const N = 9;
      for (let i = 0; i <= N; i++) {
        const u = i / N - 0.5, w = Math.sin((i / N) * Math.PI) * len * (kind === 'point' ? 0.26 : 0.17);
        const x = px + ca * u * len, y = py + sa * u * len;
        pts.push([x - sa * (w + rnd(w * 0.6)), y + ca * (w + rnd(w * 0.6))]);
        back.push([x + sa * (w + rnd(w * 0.6)), y - ca * (w + rnd(w * 0.6))]);
      }
      const path = new Path2D();
      [...pts, ...back.reverse()].forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
      path.closePath();
      g.globalCompositeOperation = 'source-atop';
      if (soul) {
        // blood soaks into the hide around the wound and runs downward
        const rg = g.createRadialGradient(px, py, 0, px, py, len * 0.75);
        rg.addColorStop(0, 'rgba(120,0,8,0.9)');
        rg.addColorStop(0.6, 'rgba(120,0,8,0.45)');
        rg.addColorStop(1, 'rgba(120,0,8,0)');
        g.fillStyle = rg;
        g.fillRect(px - len, py - len, len * 2, len * 2);
        const dx = Math.sin(b.a) * b.flip, dy = Math.cos(b.a); // world-down in sprite space
        g.strokeStyle = 'rgba(110,0,8,0.8)';
        g.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const ox = px + rnd(len * 0.35), oy = py + rnd(len * 0.1), L = len * (0.4 + Math.random() * 0.9);
          g.lineWidth = (1 + Math.random() * 1.6) * k;
          g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + dx * L, oy + dy * L); g.stroke();
          g.beginPath(); g.arc(ox + dx * L, oy + dy * L, g.lineWidth * 0.7, 0, 7); g.fillStyle = 'rgba(110,0,8,0.85)'; g.fill();
        }
      } else {
        // pale, thinned hide at the torn lip
        g.strokeStyle = 'rgba(235,205,150,0.55)';
        g.lineWidth = 2.2 * k;
        g.stroke(path);
      }
      g.globalCompositeOperation = 'destination-out';
      g.fill(path);
    }
    g.restore();
    sp.version = (sp.version | 0) + 1;
  }

  _char(b, amt) {
    const sp = this._own(b);
    const g = sp.canvas.getContext('2d');
    const w = sp.canvas.width, h = sp.canvas.height;
    const x = Math.random() * w, y = Math.random() * h, r = (0.1 + Math.random() * 0.15) * Math.min(w, h);
    g.save();
    g.globalCompositeOperation = 'source-atop';
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(10,5,2,${0.5 * amt})`);
    rg.addColorStop(1, 'rgba(10,5,2,0)');
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    if (Math.random() < 0.35) {
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(x + rnd(r * 0.3), y + rnd(r * 0.3), r * 0.18, 0, 7); g.fill();
    }
    g.restore();
    sp.version = (sp.version | 0) + 1;
  }

  // ------------------------------------------------------------ fx helpers
  _floorCloth(z) {
    return this.scene.project(0, this.scene.world.floorY(z), z)[1];
  }

  _spray(cx, cy, z, n, dir, force = 1) {
    const fy = this._floorCloth(z);
    for (let i = 0; i < n; i++) {
      const sp = (120 + Math.random() * 420) * force;
      const an = -Math.PI / 2 + dir * (0.5 + Math.random() * 0.9) + rnd(0.3);
      this.fx.emit({ k: 'blood', x: cx + rnd(4), y: cy + rnd(4), vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: 1500, r: 2.4 + Math.random() * 3.4, life: 2.5, fy: fy + rnd(6) });
    }
  }

  _burst(a, k, n, vdir = 0) {
    const r = a.root;
    const [cx, cy, s] = this.scene.project(r.x, r.y, a.z);
    const h = (a.height || 200) * s;
    for (let i = 0; i < n; i++) {
      const an = Math.random() * 6.28, rr = Math.random() * h * 0.45;
      if (k === 'wisp') this.fx.emit({ k, x: cx + rnd(20), y: cy + (vdir < 0 ? -h * 0.8 : 0) + rnd(20), vx: 0, vy: vdir < 0 ? 90 + Math.random() * 60 : -90 - Math.random() * 60, r: 10 + Math.random() * 14, life: 1.4, spin: Math.random() * 6 });
      else this.fx.emit({ k, x: cx + Math.cos(an) * rr, y: cy + Math.sin(an) * rr * 1.4, vx: Math.cos(an) * 40, vy: -60 - Math.random() * 80, r: 3 + Math.random() * 3, life: 1 + Math.random() * 0.6 });
    }
    this.scene.extraGlows.push({ x: cx, y: cy, r: h * 1.2, i: 0.8, c: k === 'heal' ? [0.6, 1, 0.7] : k === 'gold' ? [1, 0.85, 0.45] : [0.7, 0.8, 1] });
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    this.t += dt;
    const S = this.scene;
    const fires = S.actors.filter((x) => x.def && x.def.fx === 'fire' && x.root);
    const wards = [];
    for (const a of S.actors) {
      if (!(a instanceof Puppet) || !a.dmg) { if (a instanceof Puppet && fires.length) this._burn(a, fires, dt); continue; }
      const s = a.dmg;
      this._burn(a, fires, dt);
      const r = a.root;
      const [cx, cy, sc] = S.project(r.x, r.y, a.z);
      // bleeding wounds
      if (s.bleeds.length) {
        const fy = this._floorCloth(a.z);
        for (const w of s.bleeds) {
          w.t -= dt;
          if (!w.body || w.body.removed) continue;
          const [wx, wy] = w.body.toWorld(w.lx, w.ly);
          const [bx, by] = S.project(wx, wy, a.z);
          const pulse = w.spurt ? Math.max(0, Math.sin(this.t * 7.5)) ** 3 : 1;
          if (Math.random() < w.rate * dt * 18 * pulse) {
            const sp = w.spurt ? 250 + Math.random() * 250 : 10 + Math.random() * 40;
            const an = w.spurt ? -Math.PI / 2 + rnd(1.1) : Math.PI / 2 + rnd(0.4);
            this.fx.emit({ k: 'blood', x: bx, y: by, vx: Math.cos(an) * sp + (w.body.vx || 0) * 0.3, vy: Math.sin(an) * sp, g: 1500, r: 2 + Math.random() * (w.spurt ? 3.4 : 2), life: 3, fy: fy + rnd(6) });
            if (!a.dead) s.lost += dt * w.rate * 2.2;
          }
        }
        s.bleeds = s.bleeds.filter((w) => w.t > 0);
      }
      if (s.soul && !a.dead && s.lost > 150) this.die(a);
      // tears
      s.cry = Math.max(0, s.cry - dt);
      if (s.soul && !a.dead && s.cry > 0 && Math.random() < dt * 3.2) {
        const hb = a.sem.neck?.B || null;
        if (hb) {
          const [ex, ey] = hb.toWorld(hb.radius * 0.25, -hb.radius * 0.05);
          const [tx, ty] = S.project(ex, ey, a.z);
          this.fx.emit({ k: 'tear', x: tx, y: ty, vx: a.facing * 12, vy: 20, g: 700, r: 2.4, life: 2, fy: this._floorCloth(a.z) });
        }
      }
      s.pain = Math.max(0, s.pain - dt * 0.8);
      // the soul leaves a dead body
      if (s.soulOut > 0) {
        s.soulOut -= dt;
        if (Math.random() < dt * 14) this.fx.emit({ k: 'wisp', x: cx + rnd(25 * sc), y: cy - 30 * sc, vx: 0, vy: -70 - Math.random() * 60, r: 12 + Math.random() * 16, life: 2.4, spin: Math.random() * 6 });
        S.extraGlows.push({ x: cx, y: cy - (3 - s.soulOut) * 120, r: 220 * sc, i: 0.35 * Math.min(1, s.soulOut), c: [0.65, 0.78, 1] });
      }
      // a living heart glows faintly
      if (s.soul && !a.dead) {
        s.beat += dt * (1.1 + s.pain * 1.3);
        const ph = s.beat % 1, beat = Math.exp(-((ph - 0.1) ** 2) / 0.003) + 0.6 * Math.exp(-((ph - 0.28) ** 2) / 0.003);
        const [hx, hy] = S.project(...a.handleWorld(), a.z);
        S.extraGlows.push({ x: hx, y: hy + 20 * sc, r: 90 * sc, i: 0.12 + beat * 0.22, c: [1, 0.55, 0.45] });
      }
      // yantra ward
      s.wardFlash = Math.max(0, s.wardFlash - dt * 1.5);
      if (s.ward > 0.01) {
        const [hx, hy] = S.project(...a.handleWorld(), a.z);
        wards.push({ x: hx, y: hy + 40 * sc, r: clamp(a.height * 0.42, 50, 220) * sc, a: 0.25 + s.ward * 0.35 + s.wardFlash * 0.6 });
        if (s.wardFlash > 0.05) S.extraGlows.push({ x: hx, y: hy, r: 200 * sc, i: s.wardFlash * 0.5, c: [1, 0.85, 0.45] });
      }
    }
    this.fx.wards = wards;
  }

  _burn(a, fires, dt) {
    if (!fires.length || a.dead && !a.dmg) return;
    const s = this.st(a);
    if (s.ward > 0.05) return;
    for (const f of fires) {
      if (f.heldBy && f.heldBy.puppet === a) continue;
      if (Math.abs(f.z - a.z) > 0.08) continue;
      const sp = f.def.sprite, pt = f.def.fxAt ? sp.local(f.def.fxAt) : [sp.w / 2, sp.h * 0.3];
      const [fx, fy] = f.root.toWorld(pt[0] - f.root.com[0], pt[1] - f.root.com[1]);
      for (const b of a.parts) {
        if (Math.hypot(b.x - fx, b.y - (fy - 40)) > 70 + b.radius * 0.5) continue;
        if (b.hp == null) b.hp = b.hpMax = this._maxHp(a, b);
        b.hp -= dt * 14;
        s.burnT -= dt;
        if (s.burnT <= 0) {
          s.burnT = 0.25;
          this._char(b, 0.9);
          const [cx, cy] = this.scene.project(b.x, b.y, a.z);
          this.fx.emit({ k: 'smoke', x: cx, y: cy, vx: rnd(10), vy: -40, r: 10, life: 2 });
          if (s.soul && !a.dead) {
            s.pain = 1; s.cry = Math.max(s.cry, 2); s.lost += 1.5;
            if (Math.random() < 0.25) this.audio?.sfx('gasp', { vol: 0.35, pan: this.game._pan(a) });
            if (Math.random() < 0.3 && a.play && !a.isBusy()) a.play('flee');
          }
        }
        if (b.hp <= 0) {
          if (b !== a.root && b.part) this.sever(a, b, Math.sign(b.x - fx) || 1);
          else if (s.soul) this.die(a);
          else b.hp = 1;
        }
      }
    }
  }
}
