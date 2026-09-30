// A single-sprite rigid prop: jars, food, weapons, instruments, scenery.
// (Articulated props — animals, monsters, vehicles — are Puppets.)

import { Body, Pin } from '../physics/world.js';
import { spriteShape } from '../physics/shape.js';

let nextPropGroup = 100000;

export class Prop {
  constructor(world, def, { x = 800, y = 600, z = 0.02, facing = 1, id } = {}) {
    this.world = world;
    this.def = def;
    this.id = id ?? 'o' + nextPropGroup;
    this.kind = 'prop';
    this.group = nextPropGroup++;
    const s = def.sprite;
    const seg = def.weapon ? [s.local(def.weapon.a), s.local(def.weapon.b)] : null;
    const big = s.w * s.h > 90000;
    const sh = spriteShape(s, { maxCircles: big ? 12 : def.weapon ? 8 : 7, density: (def.mass || 1) / 9000, segment: seg });
    this.shape = sh;
    const b = new Body({ x, y, a: 0, mass: sh.mass, inertia: sh.inertia, z, circles: sh.circles, group: this.group });
    b.owner = this;
    b.sprite = s;
    b.com = sh.com;
    b.zOrder = 0;
    b.linDamp = 0.8;
    b.angDamp = 1.8;
    b.friction = 0.8;
    b.softness = 4e-7;
    b.isWeapon = !!def.weapon;
    this.body = b;
    this.bodies = [b];
    this.parts = [b];
    world.add(b);
    this.z = z;
    this.facing = 1;
    this.heldBy = null;
    this.float = def.float ? { y, t: Math.random() * 10 } : null;
    this.floatPin = null;
    this.staticPin = null;
    this.flipAnim = 0;
    if (facing < 0) this.flip();
    if (def.static) this.setStatic(true);
    if (def.float) this._makeFloat(y);
  }

  get root() { return this.body; }

  gripLocal() {
    const d = this.def;
    const g = d.grip ? d.sprite.local(d.grip) : this.shape.com;
    return [g[0] - this.shape.com[0], g[1] - this.shape.com[1]];
  }

  // body-local angle from the grip toward the far end of the weapon
  farDir() {
    const d = this.def;
    if (!d.weapon) return -Math.PI / 2;
    const g = d.grip ? d.sprite.local(d.grip) : this.shape.com;
    const a = d.sprite.local(d.weapon.a), b = d.sprite.local(d.weapon.b);
    const da = Math.hypot(a[0] - g[0], a[1] - g[1]), db = Math.hypot(b[0] - g[0], b[1] - g[1]);
    const far = da > db ? a : b;
    return Math.atan2(far[1] - g[1], far[0] - g[0]);
  }

  setStatic(on) {
    const b = this.body;
    if (on && !this.heldBy) {
      b.kinematic = true;
      b.invMass = 0;
      b.invI = 0;
      b.vx = b.vy = b.va = 0;
      b.scenery = true;
      this.isStatic = true;
    } else if (!this.heldBy) {
      b.kinematic = false;
      b.setMass(this.shape.mass, this.shape.inertia);
      b.scenery = false;
      this.isStatic = false;
    }
  }

  _makeFloat(y) {
    this.float = { y, t: Math.random() * 10 };
    if (!this.floatPin) {
      this.floatPin = new Pin(this.body, [0, 0], this.body.x, y, { compliance: 2e-5, angle: 0, angCompliance: 6e-4, maxCorr: 10 });
      this.world.addC(this.floatPin);
    }
  }

  placeAt(x, y) {
    const b = this.body;
    b.x = x; b.y = y; b.px = x; b.py = y; b.vx = b.vy = b.va = 0;
    if (this.isStatic || this.def.static) { b.a = 0; b.pa = 0; }
    if (this.float) {
      this.float.y = y;
      this.floatPin.ty = y;
      this.floatPin.tx = x;
    }
  }

  setDepth(z) {
    z = Math.max(0.005, Math.min(0.55, z));
    const L = this.world.lamp;
    const b = this.body;
    const Lx = L.x + (L.sx || 0);
    const sx = Lx + (b.x - Lx) / (1 - this.z), sy = L.y + (b.y - L.y) / (1 - this.z);
    const nx = Lx + (sx - Lx) * (1 - z), ny = L.y + (sy - L.y) * (1 - z);
    b.px += nx - b.x; b.py += ny - b.y;
    b.x = nx; b.y = ny; b.z = z;
    if (this.float) { this.float.y = ny; this.floatPin.ty = ny; }
    this.z = z;
  }

  flip() {
    const b = this.body;
    b.flip = -b.flip;
    b.a = -b.a; b.pa = -b.pa; b.va = -b.va;
    this.facing = -this.facing;
    this.flipAnim = 1;
  }

  update(dt, time) {
    this.flipAnim = Math.max(0, this.flipAnim - dt * 5);
    if (this.float && !this.heldBy && this.floatPin) {
      this.float.t += dt;
      const t = this.float.t;
      this.floatPin.enabled = true;
      this.floatPin.tx = this.body.x;
      this.floatPin.ty = this.float.y + Math.sin(t * 1.3) * 5;
      this.floatPin.angle = Math.sin(t * 0.9) * 0.05;
    } else if (this.floatPin) this.floatPin.enabled = false;
  }

  hitTest(wx, wy, pad = 6) {
    const b = this.body;
    // precise alpha test on the sprite
    const [lx, ly] = b.toLocal(wx, wy);
    const sx = lx + this.shape.com[0], sy = ly + this.shape.com[1];
    const s = this.def.sprite;
    if (sx < -pad || sy < -pad || sx > s.w + pad || sy > s.h + pad) return null;
    const g = s.alphaGrid(4);
    const r = Math.ceil(pad / g.cell);
    const ci = Math.floor(sx / g.cell), cj = Math.floor(sy / g.cellY);
    for (let j = cj - r; j <= cj + r; j++) {
      for (let i = ci - r; i <= ci + r; i++) {
        if (i < 0 || j < 0 || i >= g.cw || j >= g.ch) continue;
        if (g.a[j * g.cw + i] > 0.3) return b;
      }
    }
    return null;
  }

  remove() {
    if (this.heldBy) this.heldBy.puppet.release(this.heldBy.hand);
    this.world.remove(this.body);
    if (this.floatPin) this.world.removeC(this.floatPin);
    this.removed = true;
  }
}
