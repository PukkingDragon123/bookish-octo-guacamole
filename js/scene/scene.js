// The world behind the cloth: physics, actors, the lamp, the membrane.

import { World } from '../physics/world.js';
import { Puppet } from '../puppet/puppet.js';
import { Prop } from '../sandbox/prop.js';
import { Membrane } from '../render/cloth.js';
import { CLOTH_W, CLOTH_H } from '../render/screen.js';

export const FLOOR = 930;

export class Scene {
  constructor() {
    this.world = new World({ gravity: 1800, substeps: 10 });
    this.lamp = {
      x: CLOTH_W / 2, y: 360, dist: 640, flame: 30,
      intensity: 1, target: 1, sx: 0, color: [1.0, 0.8, 0.52], kind: 'oil', flicker: 0,
    };
    this.world.lamp = this.lamp;
    this.world.floorY = (z) => this.lamp.y + (FLOOR - this.lamp.y) * (1 - z);
    this.actors = [];
    this.worldW = 1600; // stage length (cloth units); grows when the scene is expanded
    this.autoGrow = true; // extend the stage when someone walks or fights past its end
    this.membrane = new Membrane();
    this.time = 0;
    this.listeners = {};
    this.hitFx = [];
    this.extraGlows = []; // transient lights pushed each frame (souls, spells, summons)
    this.world.depthSlop = 0.06;
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }

  // ---- projection between the physics plane at depth z and the cloth
  project(x, y, z) {
    const L = this.lamp, s = 1 / (1 - z);
    return [L.x + (x - L.sx - L.x) * s, L.y + (y - L.y) * s, s];
  }
  unproject(cx, cy, z) {
    const L = this.lamp, k = 1 - z;
    return [L.x + L.sx + (cx - L.x) * k, L.y + (cy - L.y) * k];
  }

  // Move the lamp without making every shadow jump: shift the physics
  // planes so projections stay put, then let shadows re-cast naturally.
  moveLamp(x, y) {
    this.lamp.x = Math.max(120, Math.min(CLOTH_W - 120, x));
    this.lamp.y = Math.max(120, Math.min(FLOOR - 200, y));
    for (const a of this.actors) {
      if (a.mode === 'planted' && a.standY) a.target.y = a.standY();
    }
  }

  addPuppet(rig, { x = 800, z = 0.02, facing = 1, planted = true, y } = {}) {
    const [wx] = this.unproject(x, 0, z);
    const p = new Puppet(this.world, rig, { x: wx, y: 400, z, facing });
    const sy = y != null ? this.unproject(0, y, z)[1] : p.standY(z);
    p.teleport(wx, sy);
    if (planted) p.plantAt(wx);
    p.scene = this;
    p.onEvent = (pp, ev) => this.emit('animEvent', pp, ev);
    this.actors.push(p);
    this.emit('added', p);
    return p;
  }

  addProp(def, { x = 800, y = 600, z = 0.02, facing = 1 } = {}) {
    const [wx, wy] = this.unproject(x, y, z);
    let a;
    if (def.rig) {
      a = new Puppet(this.world, def.rig, { x: wx, y: wy, z, facing });
      a.def = def;
      a.isAnimal = true;
      a.teleport(wx, a.standY(z));
      a.plantAt(wx);
      a.gaitIdle = true;
      if (def.rig.kind === 'monster' && /krasue|garuda|naga|dragon/.test(def.id)) {
        a.target.y = wy; a.setMode('hung');
      }
    } else {
      a = new Prop(this.world, def, { x: wx, y: wy, z, facing });
    }
    a.scene = this;
    this.actors.push(a);
    this.emit('added', a);
    return a;
  }

  remove(a) {
    if (!a || a.removed) return;
    if (a.held) for (const h of Object.keys(a.held)) a.release(h);
    a.remove();
    this.actors = this.actors.filter((x) => x !== a);
    this.emit('removed', a);
  }

  clear() {
    for (const a of [...this.actors]) this.remove(a);
  }

  puppets() { return this.actors.filter((a) => a instanceof Puppet && !a.isAnimal); }

  // Topmost actor under a cloth-space point (nearest the lamp wins: it's
  // "in front" from the puppeteer's side).
  pick(cx, cy, pad = 8) {
    // puppets and loose things first; an item held in a hand only when
    // nothing else is under the finger (so grabbing an arm doesn't yank
    // the sword out of it)
    return this._pick(cx, cy, pad, false) || this._pick(cx, cy, pad, true);
  }

  _pick(cx, cy, pad, held) {
    let best = null, bz = -1;
    for (const a of this.actors) {
      if (!!a.heldBy !== held) continue;
      const [wx, wy] = this.unproject(cx, cy, a.z);
      const b = a.hitTest(wx, wy, pad);
      if (b && a.z > bz - 1e-4) { best = { actor: a, body: b }; bz = a.z; }
    }
    return best;
  }

  update(dt) {
    this.time += dt;
    this.extraGlows = [];
    const L = this.lamp;
    // lamp flicker (oil) / hum (electric)
    L.intensity += (L.target - L.intensity) * Math.min(1, dt * 2.2);
    const t = this.time;
    if (L.kind === 'oil') {
      L.flicker = (Math.sin(t * 13.1) * 0.35 + Math.sin(t * 23.7 + 1.3) * 0.25 + Math.sin(t * 5.3) * 0.4) * 0.028 + (Math.random() - 0.5) * 0.012;
    } else L.flicker = Math.sin(t * 100 * Math.PI) * 0.004;
    this._personalSpace(dt);
    if (this.autoGrow) {
      for (const a of this.actors) {
        if (a.root && a.rootPin && a.root.x > this.worldW - 300 && this.worldW < 16000) { this.worldW += 800; break; }
      }
    }
    for (const a of this.actors) a.update(dt, t);
    // equal physics slices no longer than 1/60 s: steadier than one big step
    const n = Math.max(1, Math.ceil(dt * 60 - 1e-3));
    for (let i = 0; i < n; i++) {
      this.world.step(dt / n);
      this._combat();
    }
    // keyframed animation layered over the physics result
    for (const a of this.actors) a.animate?.(dt);
    this._pressCloth();
    this.membrane.step(dt);
  }

  // Standing puppets that overlap step apart a little instead of shoving
  // their bodies through each other (which made their grips fight the
  // contacts and jitter). Fighters mid-swing are left alone.
  _personalSpace(dt) {
    const ps = this.actors.filter((a) => a.rootPin && a.mode === 'planted' && !a.isPlant && !a.dead && a.bounds);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const A = ps[i], B = ps[j];
      if (Math.abs(A.z - B.z) > 0.05) continue;
      if (A.attacking > 0 || B.attacking > 0) continue;
      if (A.controller === 'social' && B.controller === 'social') continue;
      const dx = B.target.x - A.target.x;
      const need = (A.bounds.w + B.bounds.w) * 0.36;
      if (Math.abs(dx) >= need) continue;
      const push = Math.min(need - Math.abs(dx), 120 * dt) * 0.5;
      const s = Math.sign(dx) || (A.id < B.id ? 1 : -1);
      const lock = (p) => p.controller === 'player' || p.controller === 'drag' || p === this.selectedByPlayer;
      if (!lock(A)) A.target.x -= s * push;
      if (!lock(B)) B.target.x += s * push;
    }
  }

  _combat() {
    for (const c of this.world.contacts) {
      const A = c.A.owner, B = c.B.owner;
      if (!A || !B || A === B) continue;
      // who is the attacker?
      for (const [att, def, wb] of [[A, B, c.A], [B, A, c.B]]) {
        const wielder = att.heldBy ? att.heldBy.puppet : att;
        if (!wielder || wielder === def || !(wielder.attacking > 0)) continue;
        if (!isFinite(c.x) || !isFinite(c.y)) continue;
        if (def.heldBy && def.heldBy.puppet === wielder) continue;
        const isWeapon = wb.isWeapon || (wb.owner && wb.owner.def && wb.owner.def.weapon);
        const speed = Math.abs(c.vn);
        if (speed < 120 && !isWeapon) continue;
        const target = def.heldBy ? def.heldBy.puppet : def;
        if (!target.hit) continue;
        const blocked = target.blocking > 0.4;
        const nx = (target.root.x - wielder.root.x) >= 0 ? 1 : -1;
        const power = (isWeapon ? 1.2 : 0.8) * wielder.attacking * (blocked ? 0.25 : 1);
        const res = target.hit(power, nx, -0.3, c.x, c.y);
        if (res) {
          const body = wb === c.A ? c.B : c.A;
          const kind = isWeapon ? (wb.owner?.def?.weapon?.kind || 'blade') : wielder.isAnimal ? 'bite' : 'blunt';
          this.emit('hit', { attacker: wielder, target, body, x: c.x, y: c.y, z: target.z, nx, blocked, weapon: isWeapon, kind, power, result: res });
          wielder.attacking = 0;
        }
      }
    }
  }

  _pressCloth() {
    const m = this.membrane;
    for (const a of this.actors) {
      if (a.z > 0.05) continue;
      const k = (0.05 - a.z) / 0.05;
      for (const b of a.parts) {
        if (b.isRod) continue;
        for (const c of b.circles) {
          const [wx, wy] = b.toWorld(c.x, c.y);
          const [cx, cy, s] = this.project(wx, wy, b.z);
          m.pressDisc(cx, cy, c.r * s * 0.9, 3.2 * k);
        }
      }
    }
  }

  // Everything that casts a shadow, as render items for ShadowScreen.
  drawables() {
    const out = [];
    for (const a of this.actors) {
      const squash = a.flipAnim ? Math.max(0.06, Math.abs(Math.cos((a.flipAnim * Math.PI) / 2))) : 1;
      const r = a.root;
      const addBody = (b, extra = {}) => {
        if (!b.sprite) return;
        const c = Math.cos(b.a), s = Math.sin(b.a), f = b.flip;
        // world = T(x,y) R(a) S(f,1) T(-com)
        let m = [c * f, s * f, -s, c, 0, 0];
        m[4] = b.x - (m[0] * b.com[0] + m[2] * b.com[1]);
        m[5] = b.y - (m[1] * b.com[0] + m[3] * b.com[1]);
        if (squash !== 1) {
          m = [m[0] * squash, m[1], m[2] * squash, m[3], r.x + (m[4] - r.x) * squash, m[5]];
        }
        m[4] -= this.lamp.sx;
        out.push({ sprite: b.sprite, m, z: b.z, ...extra });
      };
      for (const b of a.parts) addBody(b);
      if (a.handRods) {
        for (const h of a.handRods) {
          const b = h.body;
          const p0 = b.toWorld(0, -h.len / 2), p1 = b.toWorld(0, h.len / 2);
          out.push({ line: true, a: sh(sq(p0, r.x, squash), this.lamp.sx), b: sh(sq(p1, r.x, squash), this.lamp.sx), width: 2.2, z: b.z, dark: 0.06 });
        }
      }
      if (a.rod) {
        const p0 = r.toWorld(a.rod.a[0], a.rod.a[1]), p1 = r.toWorld(a.rod.b[0], a.rod.b[1]);
        out.push({ line: true, a: sh(sq(p0, r.x, squash), this.lamp.sx), b: sh(sq(p1, r.x, squash), this.lamp.sx), width: 4.2, z: r.z, dark: 0.03 });
      }
    }
    if (this.extraDrawables) for (const it of this.extraDrawables()) out.push(it);
    // one NaN reaching the GL pass blanks the whole cloth: drop bad items
    return out.filter((it) => (it.line ? isFinite(it.a[0] + it.a[1] + it.b[0] + it.b[1]) : it.m.every(isFinite)) && isFinite(it.z));
  }

  glows() {
    const out = [];
    for (const a of this.actors) {
      const g = a.def && a.def.glow;
      if (!g) continue;
      const b = a.root;
      const sp = a.def.sprite || (a.def.rig && a.def.rig.parts[a.def.rig.root].sprite);
      if (!sp) continue;
      const lp = sp.local([g[0], g[1]]);
      const [wx, wy] = b.toWorld(lp[0] - b.com[0], lp[1] - b.com[1]);
      const [cx, cy, s] = this.project(wx, wy, b.z);
      const fl = 0.85 + Math.sin(this.time * 17 + cx) * 0.08 + Math.sin(this.time * 7.3 + cy) * 0.07;
      out.push({ x: cx, y: cy, r: g[2] * s * 1.6, i: 0.9 * fl, c: a.def.glowColor || [1.0, 0.62, 0.25] });
    }
    for (const g of this.extraGlows || []) out.push(g);
    return out.filter((g) => isFinite(g.x + g.y + g.r + g.i) && g.r > 0);
  }
}

function sh(p, dx) { return [p[0] - dx, p[1]]; }

function sq(p, x0, k) {
  return k === 1 ? p : [x0 + (p[0] - x0) * k, p[1]];
}
