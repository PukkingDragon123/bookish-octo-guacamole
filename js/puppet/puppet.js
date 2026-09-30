// A physical puppet: every rig part is a rigid body, joints are XPBD
// revolute joints with limits and soft pose drives, the main rod is fixed
// to the torso and thin hand rods dangle from the hands.
//
// Control layers, blended every frame into joint drive targets:
//   rest pose  <  walk cycle + finger control  <  special animation
// and a root pin (the puppeteer's grip on the main rod) that holds the
// torso at a target position/lean.

import { Body, Joint, Pin, wrap } from '../physics/world.js';
import { spriteShape } from '../physics/shape.js';
import { assemble, M, rodLine, rigBounds } from './rig.js';
import { ANIMS, sampleAnim } from './animations.js';

let nextGroup = 1;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

export const JOINT_KEYS = ['shoulderF', 'elbowF', 'wristF', 'shoulderB', 'elbowB', 'wristB', 'hipF', 'kneeF', 'ankleF', 'hipB', 'kneeB', 'ankleB', 'neck', 'waist', 'jaw'];

export class Puppet {
  constructor(world, rig, { x = 800, y = 500, z = 0.02, facing = 1, id } = {}) {
    this.world = world;
    this.rig = rig;
    this.id = id ?? 'p' + nextGroup;
    this.group = nextGroup++;
    this.kind = rig.kind || 'hero';
    this.isHumanoid = !!(rig.limbs && rig.limbs.armF);
    this.facing = 1;
    this.z = z;
    this.bodies = {};
    this.joints = {};
    this.parts = [];
    this.handRods = [];
    this.held = {};         // hand part id -> Prop
    this.anim = null;
    this.animQueue = [];
    this.walkPhase = 0;
    this.walkAmt = 0;
    this.ctrl = {};         // finger-control joint targets (canonical, radians)
    this.ctrlW = 0;
    this.speech = null;
    this.mode = 'planted';  // 'planted' | 'held' | 'hung' | 'ragdoll'
    this.ragdollT = 0;
    this.flipAnim = 0;      // 0..1 visual flip squash progress
    this.hitCooldown = 0;
    this.attacking = 0;
    this.blocking = 0;
    this.stun = 0;
    this.selected = false;
    this.controller = null; // 'player' | fly
    this.breath = Math.random() * 10;
    this.jawOpen = 0;
    this.handSwap = null;
    this._build(x, y, z);
    if (facing < 0) this.flip(true);
  }

  // ------------------------------------------------------------ building
  _build(x, y, z) {
    const rig = this.rig;
    const T = assemble(rig);
    this.bounds = rigBounds(rig, T);
    const rootId = rig.root || Object.keys(rig.parts)[0];
    this.rootId = rootId;
    const info = {};
    for (const id of Object.keys(rig.parts)) {
      const p = rig.parts[id];
      const sh = spriteShape(p.sprite, { maxCircles: id === rootId ? 9 : 5, density: 1 / 9000 });
      const [cx, cy] = M.apply(T[id], sh.com);
      info[id] = { sh, cx, cy, ang: M.angle(T[id]) };
    }
    // Place so the root COM is at the origin, then move to (x, y).
    const r0 = info[rootId];
    this.footOffset = this.bounds.y1 - r0.cy; // root COM -> lowest point
    this.headOffset = r0.cy - this.bounds.y0;
    for (const id of Object.keys(rig.parts)) {
      const p = rig.parts[id];
      const { sh, cx, cy, ang } = info[id];
      const m = (p.mass || 1) * sh.mass;
      const b = new Body({
        x: x + cx - r0.cx, y: y + cy - r0.cy, a: ang, mass: m, inertia: (p.mass || 1) * sh.inertia,
        z, circles: sh.circles, group: this.group,
      });
      b.owner = this;
      b.part = id;
      b.com = sh.com;
      b.sprite = p.sprite;
      b.zOrder = p.z || 0;
      b.linDamp = 1.6;
      b.angDamp = 3.2;
      b.friction = 0.9;
      b.softness = 2e-7;
      b.isPuppet = !rig.gait || !!rig.limbs?.armF;
      this.bodies[id] = b;
      this.parts.push(b);
      this.world.add(b);
    }
    // canonical axis angles (for rig independent animation targets)
    const axis = {};
    const childOf = {};
    for (const id of Object.keys(rig.parts)) {
      const p = rig.parts[id];
      if (p.parent) (childOf[p.parent] ||= []).push(id);
    }
    const worldPt = (id, pt) => M.apply(T[id], rig.parts[id].sprite.local(pt));
    for (const id of Object.keys(rig.parts)) {
      const p = rig.parts[id];
      if (!p.parent) { axis[id] = Math.PI / 2 + info[id].ang; continue; }
      const piv = worldPt(id, p.pivot);
      const kids = (childOf[id] || []).filter((k) => !['head', 'jaw'].includes(k));
      let tip;
      if (kids.length === 1) tip = worldPt(kids[0], rig.parts[kids[0]].pivot);
      else tip = [info[id].cx, info[id].cy];
      axis[id] = Math.atan2(tip[1] - piv[1], tip[0] - piv[0]);
    }
    this.axis = axis;
    this._neutral = Object.fromEntries(Object.entries(info).map(([k, v]) => [k, v.ang]));
    // joints
    for (const id of Object.keys(rig.parts)) {
      const p = rig.parts[id];
      if (!p.parent) continue;
      const A = this.bodies[p.parent], B = this.bodies[id];
      const la = sub(rig.parts[p.parent].sprite.local(p.at), A.com);
      const lb = sub(p.sprite.local(p.pivot), B.com);
      const stiff = p.stiff ?? 0.3;
      const j = new Joint(A, B, la, lb, {
        rest: p.rot || 0,
        lim: p.lim || null,
        drive: stiff > 0 ? 1 : 0,
        driveCompliance: 1,
        damping: 4,
      });
      j.stiff = stiff;
      j.omegaRest = stiff > 0 ? 1 + 14 * stiff : 0;
      j.part = id;
      // canonical rest: limb axis relative to the parent's axis (0 for
      // head/pelvis/jaw style joints that sit "in line" with the parent)
      const inline = ['head', 'jaw', 'skirt', 'pelvis'].includes(id) || id === rig.limbs?.pelvis || id === rig.limbs?.head || id === rig.limbs?.jaw;
      j.canonRest = inline ? 0 : wrap(axis[id] - axis[p.parent]);
      this.joints[id] = j;
      this.world.addC(j);
    }
    // effective inertia of each joint's subtree about the joint pivot
    const subtree = (id) => [id, ...(childOf[id] || []).flatMap(subtree)];
    for (const [id, j] of Object.entries(this.joints)) {
      const [jx, jy] = j.B.toWorld(j.lb[0], j.lb[1]);
      let I = 0;
      for (const k of subtree(id)) {
        const b = this.bodies[k];
        I += b.inertia + b.mass * ((b.x - jx) ** 2 + (b.y - jy) ** 2);
      }
      j.ieff = Math.max(I, 1);
      j.driveCompliance = j.omegaRest ? 1 / (j.ieff * j.omegaRest ** 2) : 1;
    }
    {
      const r = this.bodies[rootId];
      let M = 0, I = 0;
      for (const b of this.parts) {
        M += b.mass;
        I += b.inertia + b.mass * ((b.x - r.x) ** 2 + (b.y - r.y) ** 2);
      }
      this.totalMass = M;
      this.totalI = I;
    }
    // semantic joint lookup
    const L = rig.limbs || {};
    const sem = {};
    const arm = (k, list) => {
      if (!list) return;
      sem['shoulder' + k] = this.joints[list[0]];
      sem['elbow' + k] = this.joints[list[1]];
      sem['wrist' + k] = this.joints[list[2]];
    };
    const leg = (k, list) => {
      if (!list) return;
      sem['hip' + k] = this.joints[list[0]];
      sem['knee' + k] = this.joints[list[1]];
      sem['ankle' + k] = this.joints[list[2]];
    };
    arm('F', L.armF); arm('B', L.armB); leg('F', L.legF); leg('B', L.legB);
    sem.neck = this.joints[L.head || 'head'];
    sem.waist = this.joints[L.pelvis];
    sem.jaw = this.joints[L.jaw || 'jaw'];
    this.sem = sem;
    this.tail = (L.tail || []).map((id) => this.joints[id]).filter(Boolean);
    this.gait = (rig.gait || []).map((g) => ({ ...g, j: this.joints[g.part] })).filter((g) => g.j);

    // main rod (drawn with the torso)
    const root = this.bodies[rootId];
    const rl = rodLine(rig, T);
    if (rl) {
      this.rod = {
        a: sub(sub(rl[0], [r0.cx - 0, r0.cy - 0]), [0, 0]),
        b: sub(rl[1], [r0.cx, r0.cy]),
      };
      // convert from rig space (relative to root COM, neutral angle) to root local
      const ang = -info[rootId].ang;
      this.rod.a = rot(this.rod.a, ang);
      this.rod.b = rot(this.rod.b, ang);
    }
    // grab handle: upper torso (where the main string ties on)
    const handleY = -Math.min(this.headOffset * 0.45, 60);
    this.handle = [0, handleY];
    this.rootPin = new Pin(root, [0, 0], root.x, root.y, { compliance: 1 / (this.totalMass * 144), angle: root.a, angCompliance: 1 / (this.totalI * 144), maxCorr: 25 });
    this.world.addC(this.rootPin);
    this.target = { x: root.x, y: root.y, lean: 0 };
    this.baseAngle = root.a;
    this.vel = { x: 0, y: 0 };

    // hand rods (ไม้มือ)
    const height = this.bounds.h;
    this.height = height;
    for (const [hid, pt] of Object.entries(rig.handRods || {})) {
      const hb = this.bodies[hid];
      if (!hb) continue;
      const attach = sub(rig.parts[hid].sprite.local(pt), hb.com);
      const len = height * 0.62;
      const [wx, wy] = hb.toWorld(attach[0], attach[1]);
      const rb = new Body({ x: wx + len * 0.12, y: wy + len / 2, a: -0.22, mass: 0.02, inertia: (0.02 * len * len) / 12, z, circles: [], group: this.group });
      rb.floor = false;
      rb.collide = false;
      rb.linDamp = 2.5;
      rb.angDamp = 3;
      rb.owner = this;
      rb.isRod = true;
      rb.rodLen = len;
      this.world.add(rb);
      const j = new Joint(hb, rb, attach, [0, -len / 2], { damping: 1.5 });
      this.world.addC(j);
      this.handRods.push({ body: rb, hand: hid, joint: j, len });
    }
    // limb string pins (disabled until used)
    this.pins = {};
    const endPoint = (id, fallback) => {
      const b = this.bodies[id];
      if (!b) return null;
      const g = rig.grips && rig.grips[id];
      if (g) return sub(rig.parts[id].sprite.local(g), b.com);
      return fallback(b);
    };
    const farthest = (b, dir) => {
      // point of the circle set farthest along a world direction at neutral
      let best = null, bd = -Infinity;
      for (const c of b.circles) {
        const [ox, oy] = b.offset(c.x, c.y);
        const d = ox * dir[0] + oy * dir[1];
        if (d > bd) { bd = d; best = [c.x, c.y]; }
      }
      return best || [0, 0];
    };
    const addPin = (key, id, pt) => {
      if (!id || !pt) return;
      const b = this.bodies[id];
      const pin = new Pin(b, pt, b.x, b.y, { compliance: 2e-6, maxCorr: 30 });
      pin.weight = 0;
      pin.enabled = false;
      this.world.addC(pin);
      this.pins[key] = pin;
    };
    if (this.isHumanoid) {
      const hf = L.armF[L.armF.length - 1], hb = L.armB[L.armB.length - 1];
      addPin('handF', hf, endPoint(hf, (b) => farthest(b, [0, 1])));
      addPin('handB', hb, endPoint(hb, (b) => farthest(b, [0, 1])));
      if (L.legF) addPin('footF', L.legF[L.legF.length - 1], farthest(this.bodies[L.legF[L.legF.length - 1]], [0, 1]));
      if (L.legB) addPin('footB', L.legB[L.legB.length - 1], farthest(this.bodies[L.legB[L.legB.length - 1]], [0, 1]));
      const hd = L.head || 'head';
      if (this.bodies[hd]) addPin('head', hd, farthest(this.bodies[hd], [0.3, -1]));
    }
    // swap-able hand sprites (the princess's alternate hands)
    this.handSprites = rig.hands || null;
  }

  get root() { return this.bodies[this.rootId]; }

  // ------------------------------------------------------------ control
  // Position of the torso target for standing on the floor at depth z.
  standY(z = this.z) {
    return this.world.floorY(z) - this.footOffset + 4;
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === 'ragdoll') {
      this.rootPin.enabled = false;
      this.ragdollT = 0;
    } else {
      this.rootPin.enabled = true;
    }
  }

  // Held by the player / a fly at a world target.
  holdAt(x, y) {
    this.target.x = x;
    this.target.y = y;
  }

  plantAt(x, snap = false) {
    this.target.x = x;
    this.target.y = this.standY();
    this.setMode('planted');
    if (snap) this.teleport(x, this.target.y);
  }

  // Move every body rigidly so the root sits at (x, y).
  teleport(x, y) {
    const r = this.root;
    const dx = x - r.x, dy = y - r.y;
    const all = [...this.parts, ...this.handRods.map((h) => h.body), ...Object.values(this.held).flatMap((p) => (p ? p.bodies : []))];
    for (const b of all) { b.x += dx; b.y += dy; b.px += dx; b.py += dy; b.vx = 0; b.vy = 0; b.va = 0; }
    this.target.x = x; this.target.y = y;
    this._ptx = x;
  }

  setDepth(z) {
    z = clamp(z, 0.005, 0.55);
    if (Math.abs(z - this.z) < 1e-5) return;
    // keep the projected position of the torso fixed while moving in depth
    const L = this.world.lamp;
    const r = this.root;
    const Lx = L.x + (L.sx || 0);
    const sx = Lx + (r.x - Lx) / (1 - this.z), sy = L.y + (r.y - L.y) / (1 - this.z);
    const nx = Lx + (sx - Lx) * (1 - z), ny = L.y + (sy - L.y) * (1 - z);
    const dx = nx - r.x, dy = ny - r.y;
    const moveAll = (b) => { b.x += dx; b.y += dy; b.px += dx; b.py += dy; b.z = z; };
    for (const b of this.parts) moveAll(b);
    for (const h of this.handRods) moveAll(h.body);
    for (const p of Object.values(this.held)) if (p) p.bodies.forEach(moveAll);
    this.target.x += dx;
    this.target.y += dy;
    if (this.mode === 'planted') this.target.y = this.standY(z);
    this.z = z;
  }

  // Mirror the whole puppet about its rod (turning the leather around).
  flip(instant = false) {
    const r = this.root;
    const x0 = r.x;
    const all = [...this.parts, ...this.handRods.map((h) => h.body), ...Object.values(this.held).flatMap((p) => (p ? p.bodies : []))];
    for (const b of all) {
      b.x = 2 * x0 - b.x; b.px = 2 * x0 - b.px;
      b.a = -b.a; b.pa = -b.pa;
      b.vx = -b.vx; b.va = -b.va;
      b.flip = -b.flip;
    }
    this.facing = -this.facing;
    this.target.x = 2 * x0 - this.target.x;
    this.baseAngle = -this.baseAngle;
    if (!instant) this.flipAnim = 1;
  }

  // ------------------------------------------------------------ held items
  grab(prop, hand = 'handF') {
    const hb = this.bodies[hand];
    if (!hb || !prop) return false;
    this.release(hand);
    const pb = prop.body;
    const rig = this.rig;
    const g = rig.grips && rig.grips[hand] ? sub(rig.parts[hand].sprite.local(rig.grips[hand]), hb.com) : [0, 0];
    const pg = prop.gripLocal();
    // orientation: weapons extend along the forearm, other items stay upright
    const f = hb.flip;
    const L = rig.limbs || {};
    const arm = hand === 'handF' ? L.armF : L.armB;
    let targetA = 0;
    if (prop.def.weapon && !prop.def.upright && arm && arm.length >= 2) {
      const fore = this.bodies[arm[arm.length - 2]];
      const axisLocal = this.axis[fore.part] - this._neutral[fore.part];
      const foreWorld = dirWorld(fore, axisLocal);
      const far = prop.farDir();
      targetA = f > 0 ? foreWorld - far : foreWorld - Math.PI + far;
    }
    let rel = wrap(targetA - hb.a) * f + (prop.def.holdAngle || 0);
    // ride rigidly on the hand; the hand feels the item's weight
    pb.flip = f;
    const [gx, gy] = hb.toWorld(g[0], g[1]);
    pb.a = hb.a + rel * f;
    const [ox, oy] = pb.offset(pg[0], pg[1]);
    pb.x = gx - ox; pb.y = gy - oy; pb.px = pb.x; pb.py = pb.y; pb.pa = pb.a;
    pb.z = hb.z;
    pb.group = this.group;
    pb.floor = false;
    const [lx, ly] = hb.toLocal(pb.x, pb.y);
    pb.follow = { body: hb, lx, ly, rel };
    pb.kinematic = true;
    pb.invMass = 0; pb.invI = 0;
    const m = prop.shape.mass * 0.35, I = prop.shape.inertia * 0.35;
    const d2 = lx * lx + ly * ly;
    prop._handMass = [hb.mass, hb.inertia];
    hb.setMass(hb.mass + m, hb.inertia + I + m * d2);
    this.held[hand] = prop;
    prop.heldBy = { puppet: this, hand };
    return true;
  }

  release(hand) {
    const p = this.held[hand];
    if (!p) return null;
    const hb = this.bodies[hand];
    if (p._handMass) hb.setMass(p._handMass[0], p._handMass[1]);
    const b = p.body;
    b.follow = null;
    b.kinematic = false;
    b.group = p.group;
    b.floor = true;
    p.heldBy = null;
    this.held[hand] = null;
    p.setStatic(false);
    return p;
  }

  // ------------------------------------------------------------ animation
  play(name, { hold = false, loop, speed = 1 } = {}) {
    const def = ANIMS[name];
    if (!def) return false;
    if (def.humanoid !== false && !this.isHumanoid && !def.any) return false;
    if (this.stun > 0 && name !== 'hit' && name !== 'fall') return false;
    if (this.anim && this.anim.def === def && def.loop) { this.anim.hold = hold; this.anim.until = null; return true; }
    this.anim = { name, def, t: 0, w: this.anim ? this.anim.w * 0.5 : 0, hold, loop: loop ?? !!def.loop, speed, fired: new Set() };
    if (def.swap && this.handSprites) this.handSwap = def.swap;
    return true;
  }

  stopAnim() {
    if (this.anim) this.anim.stopping = true;
  }

  isBusy() {
    return !!(this.anim && !this.anim.stopping && !this.anim.def.loop);
  }

  say(line, dur = 2.6) {
    if (!line) return;
    this.speech = { th: line.th || line, en: line.en || '', t: 0, dur: Math.max(dur, 1.4 + (line.th || line).length * 0.06) };
    this.talk = this.speech.dur * 0.8;
  }

  // ------------------------------------------------------------ per frame
  update(dt, time) {
    const r = this.root;
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.flipAnim = Math.max(0, this.flipAnim - dt * 5);
    if (this.speech) {
      this.speech.t += dt;
      if (this.speech.t > this.speech.dur) this.speech = null;
    }
    this.talk = Math.max(0, (this.talk || 0) - dt);

    // ragdoll recovery
    if (this.mode === 'ragdoll') {
      this.ragdollT += dt;
      if (this.ragdollT > 1.6 && this.controller !== 'drag') {
        this.target.x = r.x;
        this.target.y = this.standY();
        this.target.lean = 0;
        this.setMode('planted');
        this._rise = 0.8;
      }
    }
    this._rise = Math.max(0, (this._rise || 0) - dt);

    // --- animation sample
    let A = null, aw = 0, root = { dx: 0, dy: 0, lean: 0 };
    const an = this.anim;
    if (an) {
      const def = an.def;
      an.t += dt * an.speed * (def.speed || 1);
      const dur = def.duration;
      let t = an.t;
      if (an.loop) {
        const hold = def.holdAt;
        t = hold != null && an.hold ? Math.min(t, hold) : t % dur;
      } else if (def.holdAt != null && an.hold) t = Math.min(t, def.holdAt);
      const ended = !an.loop && !an.hold && an.t >= dur;
      if (ended && def.commit && !an.committed) {
        // root motion that should stick (leaps, knock-backs)
        const last = def.keys[def.keys.length - 1].root;
        this.target.x += last.dx * this.facing;
        an.committed = true;
      }
      const fadeIn = def.fadeIn ?? 0.12, fadeOut = def.fadeOut ?? 0.25;
      if (ended || an.stopping) {
        an.w -= dt / fadeOut;
        if (an.w <= 0) { this.anim = null; this.handSwap = null; }
      } else an.w = Math.min(1, an.w + dt / fadeIn);
      if (this.anim) {
        A = sampleAnim(def, Math.min(t, dur));
        aw = smooth01(an.w);
        root = A.root;
        if (an.committed) root = { ...root, dx: 0 };
        // events (hit windows, sounds)
        for (const ev of def.events || []) {
          if (an.t >= ev.t && !an.fired.has(ev)) {
            an.fired.add(ev);
            this.onEvent && this.onEvent(this, ev);
          }
        }
        this.attacking = def.attack && an.t >= def.attack[0] && an.t <= def.attack[1] ? def.attackPower || 1 : 0;
        this.blocking = def.block && (an.hold || an.t < dur - 0.2) ? aw : 0;
      }
    }
    if (!this.anim) { this.attacking = 0; this.blocking = 0; }

    // --- walking (from target motion)
    const tvx = (this.target.x - (this._ptx ?? this.target.x)) / Math.max(dt, 1e-3);
    this._ptx = this.target.x;
    this.vel.x = lerp(this.vel.x, tvx, 1 - Math.exp(-dt * 8));
    const onGround = this.mode !== 'ragdoll' && Math.abs(this.target.y - this.standY()) < 70;
    const speed = Math.abs(this.vel.x);
    const wantWalk = onGround && speed > 25 ? clamp(speed / 160, 0.35, 1) : 0;
    this.walkAmt = lerp(this.walkAmt, wantWalk, 1 - Math.exp(-dt * 6));
    const stride = Math.max(60, this.height * 0.32);
    this.walkPhase += (speed * dt) / stride;
    const ph = this.walkPhase * Math.PI * 2;
    const W = {};
    if (this.walkAmt > 0.01) {
      const k = this.walkAmt;
      const dir = Math.sign(this.vel.x) * this.facing; // forward (+1) or backwards
      W.hipF = -Math.sin(ph) * 0.42 * k * dir;
      W.hipB = Math.sin(ph) * 0.42 * k * dir;
      W.kneeF = Math.max(0, Math.cos(ph)) * 0.55 * k;
      W.kneeB = Math.max(0, -Math.cos(ph)) * 0.55 * k;
      W.shoulderF = Math.sin(ph) * 0.25 * k;
      W.shoulderB = -Math.sin(ph) * 0.25 * k;
    }

    // --- joint targets
    this.breath += dt;
    const idle = Math.sin(this.breath * 1.7) * 0.03;
    for (const key of JOINT_KEYS) {
      const j = this.sem[key];
      if (!j) continue;
      const hasA = A && A.j[key] != null;
      const walk = W[key] || 0;
      const ctrl = this.ctrl[key];
      let tgt = walk + (key === 'neck' ? idle : 0);
      let om = j.omegaRest;
      if (this.walkAmt > 0.05 && W[key] != null) om = lerp(om, Math.max(om, 9), this.walkAmt);
      if (ctrl != null && this.ctrlW > 0) {
        const want = ctrl - j.canonRest;
        tgt = lerp(tgt, want, this.ctrlW);
        om = lerp(om, 13, this.ctrlW);
      }
      if (hasA) {
        const want = A.j[key] * DEG - j.canonRest;
        tgt = lerp(tgt, want, aw);
        om = lerp(om, an.def.omega || 20, aw);
      }
      if (key === 'jaw') {
        const flap = this.talk > 0 ? (Math.sin(time * 22) * 0.5 + 0.5) * 0.45 : 0;
        tgt = Math.max(tgt, flap + this.jawOpen);
        om = Math.max(om, 14);
      }
      j.target = tgt;
      j.drive = om > 0 ? 1 : 0;
      j.driveCompliance = om > 0 ? 1 / (j.ieff * om * om) : 1;
      j.damping = 2 + om * 0.9;
    }
    // tails and animal gaits
    if (this.tail.length) {
      this.tail.forEach((j, i) => {
        j.target = Math.sin(time * 2.2 - i * 0.7) * 0.18 * (1 + this.walkAmt);
        j.drive = 1;
        j.driveCompliance = 1 / (j.ieff * 36);
      });
    }
    if (this.gait.length) {
      const moving = this.walkAmt;
      for (const g of this.gait) {
        g.j.target = Math.sin(ph + g.phase * Math.PI * 2) * g.amp * Math.max(moving, g.idle ? 0.25 : 0);
        g.j.drive = 1;
        const om = Math.max(g.j.omegaRest, 8);
        g.j.driveCompliance = 1 / (g.j.ieff * om * om);
      }
      if (this.gaitIdle) {
        for (const g of this.gait) g.j.target += Math.sin(time * 1.3 + g.phase * 6) * 0.04;
      }
    }

    // --- root pin
    const bob = this.walkAmt * Math.abs(Math.sin(ph)) * -5;
    const f = this.facing;
    let tx = this.target.x + root.dx * aw * f;
    let ty = this.target.y + root.dy * aw + bob;
    if (this.mode === 'planted' || this.mode === 'hung') {
      const sway = Math.sin(this.breath * 0.9) * (this.mode === 'hung' ? 6 : 1.2);
      tx += sway;
      ty += Math.sin(this.breath * 1.7) * 1.2;
    }
    if (this._rise > 0) ty += this._rise * 90;
    this.rootPin.tx = tx;
    this.rootPin.ty = ty;
    const lean = (this.target.lean + root.lean * DEG * aw) * f + (this.walkAmt * 0.06 * Math.sign(this.vel.x));
    this.rootPin.angle = this.baseAngle + lean;
    const held = this.mode === 'held';
    const wp = held ? 30 : this.mode === 'hung' ? 9 : 26;
    const wa = held ? 24 : this.mode === 'hung' ? 9 : 22;
    this.rootPin.compliance = 1 / (this.totalMass * wp * wp);
    this.rootPin.angCompliance = 1 / (this.totalI * wa * wa) * (this.stun > 0 ? 25 : 1);

    // limb pins weights fade
    for (const pin of Object.values(this.pins)) {
      if (!pin.enabled) continue;
      if (pin.fade) {
        pin.weight -= dt * 3;
        if (pin.weight <= 0) { pin.weight = 0; pin.enabled = false; pin.fade = false; }
      }
    }
  }

  // Drive a limb end toward a world point (mouse drag / hand-tracking).
  pullLimb(key, x, y, weight = 1) {
    const pin = this.pins[key];
    if (!pin) return;
    pin.enabled = true;
    pin.fade = false;
    pin.weight = weight;
    pin.tx = x;
    pin.ty = y;
  }

  releaseLimb(key) {
    const pin = this.pins[key];
    if (pin && pin.enabled) pin.fade = true;
  }

  limbWorld(key) {
    const pin = this.pins[key];
    if (!pin) return null;
    return pin.B.toWorld(pin.lp[0], pin.lp[1]);
  }

  handleWorld() {
    return this.root.toWorld(this.handle[0], this.handle[1]);
  }

  // Hit by a weapon / body: impulse + reaction
  hit(power, nx, ny, x, y) {
    if (this.hitCooldown > 0) return false;
    this.hitCooldown = 0.35;
    const r = this.root;
    const imp = 260 * power;
    for (const b of this.parts) b.applyImpulse(nx * imp * b.mass * 0.9, ny * imp * b.mass * 0.6 - 40 * b.mass);
    if (power > 1.6 && this.mode !== 'held') {
      this.setMode('ragdoll');
      this.stun = 1.6;
      return 'fall';
    }
    this.stun = 0.45;
    this.play('hit');
    return 'hit';
  }

  remove() {
    for (const h of Object.keys(this.held)) this.release(h);
    for (const b of this.parts) this.world.remove(b);
    for (const h of this.handRods) this.world.remove(h.body);
    this.world.removeC(this.rootPin);
    for (const p of Object.values(this.pins)) this.world.removeC(p);
    this.removed = true;
  }

  // Screen-space bounding box (projected) for picking.
  screenBounds(project) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const b of this.parts) {
      const [sx, sy, s] = project(b.x, b.y, b.z);
      const r = b.radius * s;
      x0 = Math.min(x0, sx - r); y0 = Math.min(y0, sy - r);
      x1 = Math.max(x1, sx + r); y1 = Math.max(y1, sy + r);
    }
    return { x0, y0, x1, y1 };
  }

  // Point-in-silhouette test in world space (circle approximation).
  hitTest(wx, wy, pad = 6) {
    let best = null, bd = Infinity;
    for (const b of this.parts) {
      for (const c of b.circles) {
        const [cx, cy] = b.toWorld(c.x, c.y);
        const d = Math.hypot(wx - cx, wy - cy) - c.r - pad;
        if (d < bd) { bd = d; best = b; }
      }
    }
    return bd <= 0 ? best : null;
  }
}

// world angle of a body-local direction (handles mirrored bodies)
export function dirWorld(b, localAng) {
  return b.a + (b.flip > 0 ? localAng : Math.PI - localAng);
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}
function rot([x, y], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}
function smooth01(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}
