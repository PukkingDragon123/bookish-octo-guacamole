// 2D rigid-body physics with XPBD (extended position based dynamics),
// after Müller et al., "Detailed Rigid Body Simulation with Extended
// Position Based Dynamics" (2020). Small, stable with many substeps, and
// natural for puppets: joints are exact, soft drives are just compliance.
//
// Every body lives in a plane at depth z (0 = pressed on the cloth,
// toward 1 = at the lamp). Bodies only collide with others at nearly the
// same depth, and the floor height depends on depth so every shadow's
// feet land on the same line on the screen.

const TAU = Math.PI * 2;
export const wrap = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);

export class Body {
  constructor({ x = 0, y = 0, a = 0, mass = 1, inertia = 1, z = 0, circles = [], group = 0, flip = 1 } = {}) {
    this.x = x; this.y = y; this.a = a;
    this.vx = 0; this.vy = 0; this.va = 0;
    this.px = x; this.py = y; this.pa = a;
    this.setMass(mass, inertia);
    this.z = z;
    this.circles = circles; // [{x, y, r}] in body-local (unflipped) coords
    this.group = group;     // bodies sharing a non-zero group never collide
    this.flip = flip;       // -1 mirrors local geometry (puppet turned around)
    this.linDamp = 1.2;
    this.angDamp = 2.5;
    this.gravity = 1;
    this.friction = 0.6;
    this.restitution = 0.05;
    this.collide = true;
    this.floor = true;      // collides with the floor
    this.kinematic = false;
    this.isWeapon = false;
    this.owner = null;      // Puppet / Prop that owns this body
    this.bound = { x0: 0, y0: 0, x1: 0, y1: 0 };
    this.radius = 0;        // bounding radius of circles around the COM
    this.sleep = 0;
    this.updateRadius();
  }
  setMass(mass, inertia) {
    this.mass = mass;
    this.invMass = mass > 0 ? 1 / mass : 0;
    this.inertia = inertia;
    this.invI = inertia > 0 ? 1 / inertia : 0;
  }
  updateRadius() {
    let r = 0;
    for (const c of this.circles) r = Math.max(r, Math.hypot(c.x, c.y) + c.r);
    this.radius = r;
  }
  // local (unflipped) -> world
  wx(lx, ly) {
    const c = Math.cos(this.a), s = Math.sin(this.a), fx = lx * this.flip;
    return this.x + fx * c - ly * s;
  }
  wy(lx, ly) {
    const c = Math.cos(this.a), s = Math.sin(this.a), fx = lx * this.flip;
    return this.y + fx * s + ly * c;
  }
  toWorld(lx, ly) {
    const c = Math.cos(this.a), s = Math.sin(this.a), fx = lx * this.flip;
    return [this.x + fx * c - ly * s, this.y + fx * s + ly * c];
  }
  toLocal(wx, wy) {
    const c = Math.cos(this.a), s = Math.sin(this.a);
    const dx = wx - this.x, dy = wy - this.y;
    return [(dx * c + dy * s) * this.flip, -dx * s + dy * c];
  }
  // world-space offset of a local point from the COM
  offset(lx, ly) {
    const c = Math.cos(this.a), s = Math.sin(this.a), fx = lx * this.flip;
    return [fx * c - ly * s, fx * s + ly * c];
  }
  velAt(rx, ry) {
    return [this.vx - this.va * ry, this.vy + this.va * rx];
  }
  applyImpulse(ix, iy, rx = 0, ry = 0) {
    this.vx += ix * this.invMass;
    this.vy += iy * this.invMass;
    this.va += (rx * iy - ry * ix) * this.invI;
  }
}

// --------------------------------------------------------------- solver core
function applyPos(A, rAx, rAy, B, rBx, rBy, px, py) {
  // p is the positional impulse applied +p to A, -p to B
  if (A && A.invMass) {
    A.x += px * A.invMass;
    A.y += py * A.invMass;
    A.a += (rAx * py - rAy * px) * A.invI;
  }
  if (B && B.invMass) {
    B.x -= px * B.invMass;
    B.y -= py * B.invMass;
    B.a -= (rBx * py - rBy * px) * B.invI;
  }
}

function genInvMass(b, rx, ry, nx, ny) {
  if (!b || !b.invMass) return 0;
  const rn = rx * ny - ry * nx;
  return b.invMass + b.invI * rn * rn;
}

// Pull world point on A (offset rA from A's COM) toward the world point on
// B (or a fixed world point when B is null). Returns the correction length.
function solvePoint(A, rAx, rAy, B, rBx, rBy, tx, ty, alpha, h, maxCorr = Infinity) {
  const p1x = A.x + rAx, p1y = A.y + rAy;
  const p2x = B ? B.x + rBx : tx, p2y = B ? B.y + rBy : ty;
  let dx = p1x - p2x, dy = p1y - p2y;
  let c = Math.hypot(dx, dy);
  if (c < 1e-9) return 0;
  const nx = dx / c, ny = dy / c;
  if (c > maxCorr) c = maxCorr;
  const w = genInvMass(A, rAx, rAy, nx, ny) + genInvMass(B, rBx, rBy, nx, ny);
  const at = alpha / (h * h);
  if (w + at <= 0) return 0;
  const dl = -c / (w + at);
  applyPos(A, rAx, rAy, B, rBx, rBy, nx * dl, ny * dl);
  return c;
}

function solveAngle(A, B, C, alpha, h) {
  const w = (A ? A.invI : 0) + (B ? B.invI : 0);
  const at = alpha / (h * h);
  if (w + at <= 0) return;
  const dl = -C / (w + at);
  if (A) A.a -= A.invI * dl;
  if (B) B.a += B.invI * dl;
}

// ------------------------------------------------------------- constraints
// Revolute joint between parent A and child B with optional angle limits
// and a soft angular drive toward a target (relative angle B.a - A.a).
export class Joint {
  constructor(A, B, la, lb, { rest = 0, lim = null, compliance = 0, drive = 0, driveCompliance = 1e-3, damping = 0 } = {}) {
    this.A = A; this.B = B;
    this.la = la; this.lb = lb; // local anchor points (unflipped)
    this.rest = rest;           // rest relative angle (as seen facing right)
    this.lim = lim;             // [lo, hi] relative to rest, or null
    this.compliance = compliance;
    this.drive = drive;         // 0..1 weight of the angular drive
    this.target = 0;            // drive target relative to rest
    this.driveCompliance = driveCompliance;
    this.damping = damping;     // relative angular velocity damping (1/s)
    this.enabled = true;
    this.broken = false;
  }
  relAngle() {
    // angle of B relative to A in the "facing right" frame
    return (this.B.a - this.A.a) * this.A.flip;
  }
  solve(h) {
    const A = this.A, B = this.B;
    const [rAx, rAy] = A.offset(this.la[0], this.la[1]);
    const [rBx, rBy] = B.offset(this.lb[0], this.lb[1]);
    solvePoint(B, rBx, rBy, A, rAx, rAy, 0, 0, this.compliance, h);
    const f = A.flip;
    if (this.drive > 0) {
      const C = wrap(this.relAngle() - this.rest - this.target) * f;
      solveAngle(A, B, C, this.driveCompliance / this.drive, h);
    }
    if (this.lim) {
      const rel = wrap(this.relAngle() - this.rest);
      if (rel < this.lim[0]) solveAngle(A, B, (rel - this.lim[0]) * f, 2e-9, h);
      else if (rel > this.lim[1]) solveAngle(A, B, (rel - this.lim[1]) * f, 2e-9, h);
    }
  }
  solveVel(h) {
    if (!this.damping) return;
    const A = this.A, B = this.B;
    const w = A.invI + B.invI;
    if (w <= 0) return;
    const dw = (B.va - A.va) * Math.min(1, this.damping * h);
    A.va += (dw * A.invI) / w;
    B.va -= (dw * B.invI) / w;
  }
}

// Rigidly glue B to A (held items).
export class Weld {
  constructor(A, B, la, lb, relAngle = 0, { compliance = 0, angCompliance = 0 } = {}) {
    this.A = A; this.B = B; this.la = la; this.lb = lb;
    this.relA = relAngle; this.compliance = compliance; this.angCompliance = angCompliance;
    this.enabled = true;
  }
  solve(h) {
    const A = this.A, B = this.B;
    const [rAx, rAy] = A.offset(this.la[0], this.la[1]);
    const [rBx, rBy] = B.offset(this.lb[0], this.lb[1]);
    solvePoint(B, rBx, rBy, A, rAx, rAy, 0, 0, this.compliance, h);
    const target = A.a + this.relA * A.flip;
    solveAngle(null, B, wrap(B.a - target), this.angCompliance, h);
    // keep A consistent (reaction) through the positional part only
  }
  solveVel() {}
}

// Drag a body's local point toward a world target (mouse / strings /
// planted rod). Optional angle target keeps the body upright.
export class Pin {
  constructor(B, lp, tx, ty, { compliance = 1e-6, angle = null, angCompliance = 1e-4, maxCorr = 60 } = {}) {
    this.B = B; this.lp = lp; this.tx = tx; this.ty = ty;
    this.compliance = compliance; this.angle = angle; this.angCompliance = angCompliance;
    this.maxCorr = maxCorr; this.weight = 1; this.enabled = true;
  }
  solve(h) {
    if (this.weight <= 0) return;
    const B = this.B;
    const [rx, ry] = B.offset(this.lp[0], this.lp[1]);
    solvePoint(B, rx, ry, null, 0, 0, this.tx, this.ty, this.compliance / this.weight, h, this.maxCorr);
    if (this.angle != null) solveAngle(null, B, wrap(B.a - this.angle), this.angCompliance / this.weight, h);
  }
  solveVel() {}
}

// ------------------------------------------------------------------- world
export class World {
  constructor({ gravity = 1800, substeps = 10 } = {}) {
    this.gravity = gravity;
    this.substeps = substeps;
    this.bodies = [];
    this.constraints = [];
    this.floorY = () => 930;
    this.floorFriction = 0.7;
    this.depthSlop = 0.07;
    this.contacts = [];     // significant contacts from the last step (for gameplay)
    this.onContact = null;
    this.time = 0;
    this._pairs = [];
  }
  add(b) { this.bodies.push(b); return b; }
  remove(b) {
    const i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
    this.constraints = this.constraints.filter((c) => c.A !== b && c.B !== b);
  }
  addC(c) { this.constraints.push(c); return c; }
  removeC(c) {
    const i = this.constraints.indexOf(c);
    if (i >= 0) this.constraints.splice(i, 1);
  }

  _bounds() {
    for (const b of this.bodies) {
      const r = b.radius + 2;
      b.bound.x0 = b.x - r; b.bound.x1 = b.x + r;
      b.bound.y0 = b.y - r; b.bound.y1 = b.y + r;
    }
  }

  // Broad phase once per step (bodies don't move far within a frame).
  _broad() {
    const list = this.bodies.filter((b) => b.collide && b.circles.length);
    list.sort((a, b) => a.bound.x0 - b.bound.x0);
    const pairs = this._pairs;
    pairs.length = 0;
    const margin = 30;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.bound.x0 > a.bound.x1 + margin) break;
        if (a.group && a.group === b.group) continue;
        if (!a.invMass && !b.invMass) continue;
        if (Math.abs(a.z - b.z) > this.depthSlop) continue;
        if (b.bound.y0 > a.bound.y1 + margin || a.bound.y0 > b.bound.y1 + margin) continue;
        if ((a.scenery && b.isPuppet) || (b.scenery && a.isPuppet)) continue;
        if (a.ignore && a.ignore.has(b)) continue;
        if (b.ignore && b.ignore.has(a)) continue;
        pairs.push(a, b);
      }
    }
  }

  step(dt) {
    dt = Math.min(dt, 1 / 30);
    const n = this.substeps;
    const h = dt / n;
    this.contacts.length = 0;
    this._bounds();
    this._broad();
    const g = this.gravity;
    for (let s = 0; s < n; s++) {
      for (const b of this.bodies) {
        if (!b.invMass || b.kinematic) { b.px = b.x; b.py = b.y; b.pa = b.a; continue; }
        b.vy += g * b.gravity * h;
        const ld = Math.exp(-b.linDamp * h), ad = Math.exp(-b.angDamp * h);
        b.vx *= ld; b.vy *= ld; b.va *= ad;
        b.px = b.x; b.py = b.y; b.pa = b.a;
        b.x += b.vx * h; b.y += b.vy * h; b.a += b.va * h;
      }
      for (const c of this.constraints) if (c.enabled) c.solve(h);
      for (const b of this.bodies) if (b.follow) this._follow(b, h);
      this._contacts(h, s === n - 1);
      for (const b of this.bodies) {
        if (!b.invMass || b.kinematic) continue;
        b.vx = (b.x - b.px) / h;
        b.vy = (b.y - b.py) / h;
        b.va = (b.a - b.pa) / h;
        // guard against explosions
        const sp = b.vx * b.vx + b.vy * b.vy;
        if (sp > 5.8e6) { const k = 2400 / Math.sqrt(sp); b.vx *= k; b.vy *= k; }
        if (Math.abs(b.va) > 40) b.va = Math.sign(b.va) * 40;
        // settle: bodies resting on the floor stop trembling
        if (b._onFloor && sp < 400 && Math.abs(b.va) < 0.6) { b.vx *= 0.85; b.vy *= 0.85; b.va *= 0.8; }
      }
      for (const c of this.constraints) if (c.enabled && c.solveVel) c.solveVel(h);
    }
    // last-resort guard: never let a NaN spread through a puppet
    for (const b of this.bodies) {
      if (Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.a)) { b._ok = [b.x, b.y, b.a]; continue; }
      const o = b._ok || [800, 500, 0];
      b.x = b.px = o[0]; b.y = b.py = o[1]; b.a = b.pa = o[2]; b.vx = b.vy = b.va = 0;
    }
    this.time += dt;
  }

  // Held items ride rigidly on the holding body.
  _follow(b, h) {
    const f = b.follow, H = f.body;
    const [x, y] = H.toWorld(f.lx, f.ly);
    const a = H.a + f.rel * H.flip;
    b.flip = H.flip;
    b.vx = (x - b.px) / h; b.vy = (y - b.py) / h; b.va = (a - b.pa) / h;
    b.x = x; b.y = y; b.a = a; b.z = H.z;
  }

  _contacts(h, record) {
    // floor
    for (const b of this.bodies) {
      if (!b.invMass || !b.floor || !b.circles.length) continue;
      const fy = this.floorY(b.z);
      b._onFloor = false;
      if (b.y + b.radius < fy) continue;
      const c = Math.cos(b.a), s = Math.sin(b.a);
      for (const k of b.circles) {
        const lx = k.x * b.flip;
        const rx = lx * c - k.y * s, ry = lx * s + k.y * c;
        let pen = b.y + ry + k.r - fy;
        if (pen <= 0) continue;
        b._onFloor = true;
        pen = Math.min(pen, 5); // resolve deep overlaps over several substeps (no pops)
        // contact point at the bottom of the circle; normal n = (0, -1)
        const cx = rx, cy = ry + k.r;
        const w = genInvMass(b, cx, cy, 0, -1);
        const dl = pen / w;
        b.y -= dl * b.invMass;
        b.a -= cx * dl * b.invI;
        // Coulomb friction: cancel the contact point's tangential slide,
        // limited by mu * normal correction.
        const pc = Math.cos(b.pa), ps = Math.sin(b.pa);
        const prevX = b.px + lx * pc - k.y * ps;
        const c2 = Math.cos(b.a), s2 = Math.sin(b.a);
        const curX = b.x + lx * c2 - k.y * s2;
        const slide = curX - prevX;
        const mu = this.floorFriction * b.friction;
        const corr = Math.max(-mu * pen, Math.min(mu * pen, slide));
        const wt = genInvMass(b, cx, cy, 1, 0);
        const fl = corr / wt;
        b.x -= fl * b.invMass;
        b.a += cy * fl * b.invI;
      }
    }
    // body-body
    const P = this._pairs;
    for (let i = 0; i < P.length; i += 2) {
      const A = P[i], B = P[i + 1];
      const dxAB = A.x - B.x, dyAB = A.y - B.y;
      const rr = A.radius + B.radius;
      if (dxAB * dxAB + dyAB * dyAB > rr * rr) continue;
      const ca = Math.cos(A.a), sa = Math.sin(A.a), cb = Math.cos(B.a), sb = Math.sin(B.a);
      for (const ka of A.circles) {
        const ax = ka.x * A.flip;
        const rAx = ax * ca - ka.y * sa, rAy = ax * sa + ka.y * ca;
        const pax = A.x + rAx, pay = A.y + rAy;
        for (const kb of B.circles) {
          const bx = kb.x * B.flip;
          const rBx = bx * cb - kb.y * sb, rBy = bx * sb + kb.y * cb;
          const pbx = B.x + rBx, pby = B.y + rBy;
          let dx = pax - pbx, dy = pay - pby;
          const d2 = dx * dx + dy * dy, R = ka.r + kb.r;
          if (d2 >= R * R || d2 < 1e-8) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d, ny = dy / d;
          const pen = Math.min(R - d, 2.5);
          // contact points on each surface (offsets from COM)
          const cAx = rAx - nx * ka.r, cAy = rAy - ny * ka.r;
          const cBx = rBx + nx * kb.r, cBy = rBy + ny * kb.r;
          const w = genInvMass(A, cAx, cAy, nx, ny) + genInvMass(B, cBx, cBy, nx, ny);
          if (w <= 0) continue;
          const soft = (A.softness || 0) + (B.softness || 0);
          const at = soft / (h * h);
          const dl = (pen * 0.6) / (w + at); // relaxed: overlaps melt apart instead of kicking
          applyPos(A, cAx, cAy, B, cBx, cBy, nx * dl, ny * dl);
          // a little friction between bodies so stacked parts settle instead of skating
          {
            const tx = -ny, ty = nx;
            const [vax, vay] = A.velAt(cAx, cAy), [vbx, vby] = B.velAt(cBx, cBy);
            const slide = ((vax - vbx) * tx + (vay - vby) * ty) * h;
            const wt = genInvMass(A, cAx, cAy, tx, ty) + genInvMass(B, cBx, cBy, tx, ty);
            if (wt > 0) {
              const mu = 0.35 * pen * 0.6;
              const f = Math.max(-mu, Math.min(mu, slide)) / wt;
              applyPos(A, cAx, cAy, B, cBx, cBy, -tx * f, -ty * f);
            }
          }
          if (record) {
            const [vax, vay] = A.velAt(cAx, cAy);
            const [vbx, vby] = B.velAt(cBx, cBy);
            const vn = (vax - vbx) * nx + (vay - vby) * ny;
            this.contacts.push({ A, B, x: pax - nx * ka.r, y: pay - ny * ka.r, nx, ny, vn, pen });
          }
        }
      }
    }
  }
}
