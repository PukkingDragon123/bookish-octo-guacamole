// Playable folk sports for the stagehand devas: ตะกร้อ (sepak takraw),
// ปิงปอง (ping-pong) and กระโดดเชือก (jump rope).
//
//   const games = new Games(game);           // once (also sets game.games)
//   games.update(dt);                        // every frame, AFTER scene.update
//   scene items = [...scene.drawables(), ...games.drawables()]
//   in Fly._brain:  if (GAME_ROLE_IDS.has(this.role)) return driveRole(this, p, this.role, dt, game);
//
// Balls: the XPBD world has no restitution (contacts are positional, so
// every hit is perfectly inelastic). While a ball is free (not held, not
// dragged by a Pin) this module owns its motion: the world only carries
// it, and here it is integrated with its own substeps against the floor,
// the table/net, walls and every nearby body's collision circles, with a
// proper restitution + Coulomb friction impulse that also spins it, air
// drag and a little Magnus curve. Deva players get "assisted" touches:
// when the kicking foot / paddle reaches the ball during the swing, the
// ball is sent on a solved arc to the partner (so rallies actually last).

import { Puppet, dirWorld } from '../puppet/puppet.js';
import { Prop } from './prop.js';
import { Pin } from '../physics/world.js';
import { ANIMS } from '../puppet/animations.js';
import { PROPS as GAME_PROPS } from '../props/games.js';
import { paintSprite } from '../art/leather.js';

let BLANK = null; // an empty sprite stands in for a rope that is being turned

export const GAME_ROLES = [
  ['takraw', 'เตะตะกร้อ', 'Takraw player', '◎'],
  ['pingpong', 'ปิงปอง', 'Ping-pong player', '◑'],
  ['jumprope', 'กระโดดเชือก', 'Rope jumper', '∿'],
];
export const GAME_ROLE_IDS = new Set(GAME_ROLES.map((r) => r[0]));
// 24x24 stroke paths in the style of ui.js ROLE_ICONS
export const GAME_ROLE_ICONS = {
  takraw: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M9 5l-2 5 3 4h4l3-4-2-5M7 10H3.5M17 10h3.5M10 14l-2 5.5M14 14l2 5.5',
  pingpong: 'M10 3a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13M14.5 14.5L20 20M19 4.5h.01',
  jumprope: 'M6 3v6M18 3v6M6 9c0 13 12 13 12 0M12 12v3',
};

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wrapA = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);

// ------------------------------------------------------------ animations
const k = (t, j, root = {}) => ({ t, j, root });
const REST = { hipF: -4, kneeF: 5, hipB: 4, kneeB: 5, shoulderF: -10, elbowF: -12, shoulderB: 5, elbowB: -10, neck: 0 };
const NEW_ANIMS = {
  // เตะแป: the inside-of-the-foot kick, knee lifts and the foot swings up in front
  kick: {
    th: 'เตะตะกร้อ', en: 'Takraw kick', duration: 0.56, fadeIn: 0.05, fadeOut: 0.2, omega: 26, apex: 0.2,
    events: [{ t: 0.12, sfx: 'swish' }],
    keys: [
      k(0.0, { hipF: -20, kneeF: 40, hipB: 8, kneeB: 12, shoulderF: -40, elbowF: -30, shoulderB: 30, elbowB: -20, neck: 12 }, { dy: 8, lean: 2 }),
      k(0.2, { hipF: -84, kneeF: 64, hipB: 10, kneeB: 10, shoulderF: -70, elbowF: -20, shoulderB: 50, elbowB: -15, neck: 18 }, { dy: 2, lean: -6 }),
      k(0.32, { hipF: -76, kneeF: 58, hipB: 8, kneeB: 10, shoulderF: -60, elbowF: -25, shoulderB: 45, neck: 10 }, { dy: 4, lean: -4 }),
      k(0.56, REST, {}),
    ],
  },
  // เข่า: bounce it up off the knee
  knee: {
    th: 'เดาะเข่า', en: 'Knee juggle', duration: 0.6, fadeIn: 0.05, fadeOut: 0.2, omega: 24, apex: 0.22,
    keys: [
      k(0.0, { hipF: -30, kneeF: 50, hipB: 8, kneeB: 14, shoulderF: -30, elbowF: -40, shoulderB: 20, neck: 14 }, { dy: 10 }),
      k(0.22, { hipF: -104, kneeF: 112, hipB: 8, kneeB: 8, shoulderF: -60, elbowF: -30, shoulderB: 40, neck: 20 }, { dy: -6, lean: -3 }),
      k(0.36, { hipF: -96, kneeF: 104, hipB: 8, kneeB: 10, neck: 14 }, { dy: 0 }),
      k(0.6, REST, {}),
    ],
  },
  // โหม่ง: a little jump and a nod
  header: {
    th: 'โหม่ง', en: 'Header', duration: 0.72, fadeIn: 0.05, fadeOut: 0.22, omega: 22, apex: 0.3,
    events: [{ t: 0.08, sfx: 'jump' }],
    keys: [
      k(0.0, { hipF: -30, kneeF: 60, hipB: -10, kneeB: 60, shoulderF: 20, elbowF: -30, shoulderB: 25, neck: -24 }, { dy: 30, lean: -6 }),
      k(0.2, { hipF: -20, kneeF: 30, hipB: 0, kneeB: 36, shoulderF: -40, shoulderB: -30, neck: -30 }, { dy: -60, lean: -10 }),
      k(0.3, { hipF: -22, kneeF: 34, hipB: 2, kneeB: 36, shoulderF: -50, shoulderB: -40, neck: 24 }, { dy: -70, lean: 6 }),
      k(0.5, { hipF: -26, kneeF: 44, hipB: 0, kneeB: 44, shoulderF: -20, shoulderB: 0, neck: 8 }, { dy: 16, lean: 2 }),
      k(0.72, REST, {}),
    ],
  },
  // โฟร์แฮนด์: short forehand drive with a paddle in the front hand
  forehand: {
    th: 'ตีลูกปิงปอง', en: 'Forehand', duration: 0.5, fadeIn: 0.04, fadeOut: 0.18, omega: 28, apex: 0.15,
    events: [{ t: 0.08, sfx: 'swish' }],
    keys: [
      k(0.0, { shoulderF: -20, elbowF: -70, wristF: 10, shoulderB: -20, elbowB: -40, hipF: -14, kneeF: 20, hipB: 12, kneeB: 18 }, { dx: -6, dy: 10, lean: -4 }),
      k(0.15, { shoulderF: -86, elbowF: -34, wristF: -10, shoulderB: 10, elbowB: -30, hipF: -22, kneeF: 22, hipB: 16, kneeB: 18 }, { dx: 10, dy: 12, lean: 8 }),
      k(0.27, { shoulderF: -138, elbowF: -50, wristF: -20, shoulderB: 20, hipF: -20, kneeF: 20, hipB: 14, kneeB: 16 }, { dx: 12, dy: 10, lean: 6 }),
      k(0.5, { shoulderF: -55, elbowF: -50, wristF: 0, shoulderB: -10, elbowB: -30, hipF: -10, kneeF: 16, hipB: 10, kneeB: 14 }, { dy: 8, lean: 2 }),
    ],
  },
};
function fillAnim(def) {
  // same key filling as animations.js (not exported there)
  const joints = new Set();
  for (const key of def.keys) Object.keys(key.j).forEach((n) => joints.add(n));
  let prevJ = {}, prevRoot = { dx: 0, dy: 0, lean: 0 };
  for (const key of def.keys) {
    key.j = { ...prevJ, ...key.j };
    key.root = { ...prevRoot, ...key.root };
    prevJ = key.j; prevRoot = key.root;
  }
  let next = {};
  for (let i = def.keys.length - 1; i >= 0; i--) {
    const key = def.keys[i];
    for (const n of joints) if (key.j[n] == null && next[n] != null) key.j[n] = next[n];
    next = key.j;
  }
  def.joints = [...joints];
}
for (const [name, def] of Object.entries(NEW_ANIMS)) {
  fillAnim(def);
  ANIMS[name] = def;
}
export const GAME_ANIMS = Object.keys(NEW_ANIMS);

// ------------------------------------------------------------ lines
const SAY = {
  kick: [{ th: 'ส่งมา!', en: 'Pass it!' }, { th: 'รับนะ!', en: 'Catch!' }, { th: 'สวย!', en: 'Nice!' }],
  miss: [{ th: 'โอ๊ย พลาด!', en: 'Oops, missed!' }, { th: 'อ้าว!', en: 'Aww!' }, { th: 'เกือบแล้ว', en: 'So close' }],
  rally: [{ th: 'เยี่ยมมาก!', en: 'Brilliant rally!' }, { th: 'ไม่ตกเลย!', en: "It hasn't dropped once!" }],
  serve: [{ th: 'เสิร์ฟนะ', en: 'Serving!' }, { th: 'พร้อมไหม', en: 'Ready?' }],
  rope: [{ th: 'นับด้วยนะ!', en: 'Count with me!' }],
  trip: [{ th: 'เชือกพันขา!', en: 'Tangled!' }, { th: 'สะดุด!', en: 'Tripped!' }],
};
const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const thaiNum = (n) => String(n).replace(/\d/g, (d) => THAI_DIGITS[+d]);

// ------------------------------------------------------------ Games
export class Games {
  constructor(game) {
    this.game = game;
    game.games = this;
    this.balls = new Map();   // Prop -> ball state
    this.takraw = new Map();  // ball Prop -> match
    this.pong = new Map();    // table Prop -> match
    this.ropes = new Map();   // rope Prop -> rope state
    this.roled = new Map();   // Puppet -> { role, seen }
    this.frame = 0;
    this.time = 0;
    this._built = new Map();
    this.debug = null; // set to [] to collect diagnostics
    this.stats = { kicks: 0, returns: 0, jumps: 0, trips: 0, bounces: 0, bestTakraw: 0, bestPong: 0, whiffs: 0, drops: 0 };
  }

  get scene() { return this.game.scene; }
  get world() { return this.game.scene.world; }

  sfx(name, x, opts = {}) {
    const sx = x != null ? (this.scene.project(x, 0, 0)[0] - 800) / 800 : 0;
    this.game.audio?.sfx(name, { pan: clamp(sx, -1, 1), ...opts });
  }

  // prop def by id: from the loaded content, or built from our own module
  def(id) {
    const c = this.game.content?.byId?.get(id);
    if (c) return c;
    if (this._built.has(id)) return this._built.get(id);
    const d = GAME_PROPS.find((p) => p.id === id);
    if (!d) return null;
    const def = { id: d.id, name: d.name, en: d.en, cat: d.cat, ...d.build() };
    this._built.set(id, def);
    return def;
  }

  // spawn a prop centred at WORLD (x, y) on plane z
  spawnProp(id, x, y, z) {
    const def = this.def(id);
    if (!def) return null;
    const [cx, cy] = this.scene.project(x, y, z);
    const a = this.scene.addProp(def, { x: cx, y: cy, z });
    a.placeAt(x, y);
    this.game.audio?.sfx('pop', { vol: 0.4 });
    return a;
  }

  // ---------------------------------------------------------- role driving
  drive(fly, p, role, dt) {
    if (!(p instanceof Puppet) || p.removed || p.dead) return;
    const r = this.roled.get(p);
    if (!r || r.role !== role) this._leaveRole(p);
    this.roled.set(p, { role, seen: this.frame, fly });
    p._gameRole = role;
    if (p.mode === 'ragdoll') return;
    if (role === 'takraw') this._driveTakraw(p, dt);
    else if (role === 'pingpong') this._drivePong(p, dt);
    else if (role === 'jumprope') this._driveRope(p, dt);
  }

  _leaveRole(p) {
    const r = this.roled.get(p);
    if (!r) return;
    this.roled.delete(p);
    p._gameRole = null;
    p._gk = null;
    if (p._gameCtrl) { p.ctrl = {}; p.ctrlW = 0; p._gameCtrl = false; }
    if (p.mode === 'planted') p.target.y = p.standY();
  }

  _players(role, near, z) {
    const out = [];
    for (const [p, r] of this.roled) {
      if (r.role !== role || p.removed || this.frame - r.seen > 3) continue;
      if (z != null && Math.abs(p.z - z) > 0.1) continue;
      out.push(p);
    }
    return out;
  }

  // walk the root toward x without turning (players face their partner)
  _step(p, x, speed, dt) {
    const d = x - p.target.x;
    p.target.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
    const W = this.scene.worldW || 1600;
    p.target.x = clamp(p.target.x, 40, W - 40);
    return Math.abs(d);
  }

  _face(p, x) {
    const want = Math.sign(x - p.root.x);
    if (want && want !== p.facing && !p.isBusy() && p.flipAnim <= 0) p.flip();
  }

  // ---------------------------------------------------------- per frame
  update(dt) {
    this.frame++;
    this.time += dt;
    const sc = this.scene;
    // roles that lapsed (fly released / reassigned)
    for (const [p, r] of [...this.roled]) {
      if (p.removed || this.frame - r.seen > 3 || !GAME_ROLE_IDS.has(p.flyRole) && this.frame - r.seen > 1) this._leaveRole(p);
    }
    // balls
    for (const a of sc.actors) {
      if (a instanceof Prop && a.def.ball && !a.removed && !this.balls.has(a)) this._adopt(a);
      if (a instanceof Prop && a.def.rope && !a.removed && !this.ropes.has(a)) this.ropes.set(a, this._newRope(a));
    }
    for (const [a, st] of [...this.balls]) {
      if (a.removed) { this.balls.delete(a); this.takraw.delete(a); continue; }
      this._ball(st, dt);
    }
    // matches
    for (const [ball, m] of [...this.takraw]) {
      if (ball.removed || !m.players.length || this.time - m.seen > 0.5) { this.takraw.delete(ball); continue; }
      this._takrawAssist(m, dt);
    }
    for (const [table, m] of [...this.pong]) {
      if (table.removed || this.time - m.seen > 0.5) { this.pong.delete(table); continue; }
      this._pongUpdate(m, dt);
    }
    // ropes
    for (const [rope, R] of [...this.ropes]) {
      if (rope.removed) { this.ropes.delete(rope); continue; }
      this._rope(R, dt);
    }
  }

  // ============================================================ BALLS
  _adopt(a) {
    const spec = a.def.ball;
    const b = a.body;
    b.circles = [{ x: 0, y: 0, r: spec.r }];
    b.updateRadius();
    const m = a.def.mass || 0.1;
    b.setMass(m, (2 / 3) * m * spec.r * spec.r);
    const st = { prop: a, b, spec, x: b.x, y: b.y, vx: b.vx, vy: b.vy, a: b.a, va: b.va, free: false, touch: null, ignore: null, lastFloor: -1, rest: 0, cool: 0 };
    this.balls.set(a, st);
    return st;
  }

  _isPinned(b) {
    for (const c of this.world.constraints) if (c.B === b && c.enabled && c instanceof Pin) return true;
    return false;
  }

  _env(z) {
    // static geometry at this depth: tables' top/net/legs
    const segs = [];
    for (const a of this.scene.actors) {
      const T = a.def && a.def.table;
      if (!T || a.removed || Math.abs(a.z - z) > 0.08) continue;
      const g = this._tableGeo(a);
      segs.push({ a: g.top[0], b: g.top[1], e: T.e, kind: 'table', table: a });
      segs.push({ a: g.net[0], b: g.net[1], e: 0.15, kind: 'net', table: a, mu: 0.9 });
      for (const L of g.legs) segs.push({ a: L[0], b: L[1], e: 0.5, kind: 'leg', table: a });
    }
    return { fy: this.world.floorY(z), segs, x0: 20, x1: (this.scene.worldW || 1600) - 20 };
  }

  _tableGeo(t) {
    const d = t.def, s = d.sprite, b = t.body;
    const W = (p) => { const l = s.local(p); return b.toWorld(l[0] - b.com[0], l[1] - b.com[1]); };
    const g = { top: d.table.top.map(W), net: d.table.net.map(W), legs: d.table.legs.map((L) => L.map(W)) };
    if (g.top[0][0] > g.top[1][0]) g.top.reverse();
    g.netX = (g.net[0][0] + g.net[1][0]) / 2;
    g.netTop = Math.min(g.net[0][1], g.net[1][1]);
    g.topY = (g.top[0][1] + g.top[1][1]) / 2;
    return g;
  }

  _ball(st, dt) {
    const a = st.prop, b = st.b;
    st.cool = Math.max(0, st.cool - dt);
    const free = !a.heldBy && !this._isPinned(b);
    if (!free) {
      b.gravity = 1; b.floor = true; b.collide = true; b.linDamp = 0.8; b.angDamp = 1.8;
      Object.assign(st, { x: b.x, y: b.y, vx: b.vx, vy: b.vy, a: b.a, va: b.va, free: false });
      return;
    }
    if (!st.free || Math.abs(b.x - (st.x + st.vx * dt)) > 2 || Math.abs(b.y - (st.y + st.vy * dt)) > 2) {
      // (re)take the body state (just released, teleported or moved in depth)
      if (!st.free) Object.assign(st, { x: b.x, y: b.y, vx: b.vx, vy: b.vy, a: b.a, va: b.va });
      else Object.assign(st, { x: b.x, y: b.y });
    }
    st.free = true;
    b.gravity = 0; b.floor = false; b.collide = false; b.linDamp = 0; b.angDamp = 0;
    const z = b.z;
    const env = this._env(z);
    // bodies near the ball's path this frame
    const reach = st.spec.r + Math.hypot(st.vx, st.vy) * dt + 40;
    const near = [];
    for (const o of this.world.bodies) {
      if (o === b || !o.circles.length || o.isRod || o.collide === false && !o.follow) continue;
      if (Math.abs(o.z - z) > 0.08) continue;
      const ow = o.owner;
      if (ow && ow.def && (ow.def.table || ow.def.ball)) continue;
      if (st.ignore && ow && (ow === st.ignore.who || ow.heldBy?.puppet === st.ignore.who) && this.time < st.ignore.until) continue;
      if (Math.hypot(o.x - st.x, o.y - st.y) > o.radius + reach) continue;
      near.push(o);
    }
    const sp = Math.hypot(st.vx, st.vy);
    const n = clamp(Math.ceil((sp * dt) / (st.spec.r * 0.5)), 2, 16);
    const h = dt / n;
    for (let i = 0; i < n; i++) this._stepBall(st, h, env, near);
    b.x = b.px = st.x; b.y = b.py = st.y; b.a = b.pa = st.a;
    b.vx = st.vx; b.vy = st.vy; b.va = st.va;
    b.sleep = 0;
  }

  // One substep of free flight + collisions. `near` null = prediction only.
  _stepBall(s, h, env, near, quiet = false) {
    const spec = s.spec, R = spec.r, g = this.world.gravity;
    s.vy += g * h;
    const drag = Math.exp(-(spec.drag || 0.1) * h);
    s.vx *= drag; s.vy *= drag;
    // Magnus (spin curves the flight)
    const mg = 0.0009 * (spec.spin || 0.5);
    s.vx += -mg * s.va * s.vy * h;
    s.vy += mg * s.va * s.vx * h;
    s.va *= Math.exp(-0.25 * h);
    const vmax = spec.vmax || 1800, sp2 = s.vx * s.vx + s.vy * s.vy;
    if (sp2 > vmax * vmax) { const q = vmax / Math.sqrt(sp2); s.vx *= q; s.vy *= q; }
    s.x += s.vx * h; s.y += s.vy * h; s.a += s.va * h;
    // squeezed between a limb and the floor: no bounce (stops energy pumping)
    const wedged = s.onFloor || s.y + R > env.fy - 2;
    // bodies (limbs, paddles, props)
    if (near) {
      for (const o of near) {
        const pd = o.owner && o.owner.def && o.owner.def.paddle;
        if (pd) {
          const [cx, cy] = this._blade(o.owner);
          this._hitCircle(s, cx, cy, pd.blade[2] * 0.9, o, wedged ? 0.1 : pd.e, quiet);
          continue;
        }
        if (Math.hypot(o.x - s.x, o.y - s.y) > o.radius + R + 2) continue;
        const c = Math.cos(o.a), sn = Math.sin(o.a);
        for (const q of o.circles) {
          const lx = q.x * o.flip;
          const cx = o.x + lx * c - q.y * sn, cy = o.y + lx * sn + q.y * c;
          this._hitCircle(s, cx, cy, q.r, o, wedged ? 0.05 : o.isPuppet ? spec.e * 0.7 : spec.e * 0.6, quiet);
        }
      }
    }
    // table, net, legs
    for (const sg of env.segs) {
      const ax = sg.a[0], ay = sg.a[1], bx = sg.b[0], by = sg.b[1];
      const ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey || 1;
      const t = clamp(((s.x - ax) * ex + (s.y - ay) * ey) / L2, 0, 1);
      const px = ax + ex * t, py = ay + ey * t;
      let dx = s.x - px, dy = s.y - py;
      const d = Math.hypot(dx, dy);
      const rr = R + (sg.kind === 'table' ? 1 : 2);
      if (d >= rr) continue;
      let nx, ny;
      if (d > 1e-6) { nx = dx / d; ny = dy / d; } else { nx = 0; ny = -1; }
      // a ball that fell through the top from above stays on top
      if (sg.kind === 'table' && s.vy > 0 && ny > 0 && s.y - s.vy * h < py) { nx = 0; ny = -1; }
      s.x = px + nx * rr; s.y = py + ny * rr;
      this._impulse(s, nx, ny, 0, 0, sg.e, sg.mu ?? 0.25, quiet ? null : sg.kind, px, py);
    }
    // stage walls (the booth frame)
    if (s.x < env.x0 + R) { s.x = env.x0 + R; if (s.vx < 0) s.vx = -s.vx * 0.5; }
    if (s.x > env.x1 - R) { s.x = env.x1 - R; if (s.vx > 0) s.vx = -s.vx * 0.5; }
    // floor (authoritative)
    if (s.y + R > env.fy) {
      s.y = env.fy - R;
      if (s.vy > 0) {
        const imp = s.vy;
        this._impulse(s, 0, -1, 0, 0, imp < 70 ? 0 : spec.e, 0.35, quiet ? null : 'floor', s.x, env.fy);
      }
      // rolling resistance
      if (Math.abs(s.vy) < 1) {
        s.vx *= Math.exp(-1.2 * h);
        s.va = lerp(s.va, s.vx / R, 1 - Math.exp(-20 * h));
      }
      s.onFloor = true;
    } else s.onFloor = false;
  }

  _hitCircle(s, cx, cy, cr, o, e, quiet) {
    const R = s.spec.r;
    let dx = s.x - cx, dy = s.y - cy;
    const d = Math.hypot(dx, dy), rr = R + cr;
    if (d >= rr || d < 1e-6) return false;
    const nx = dx / d, ny = dy / d;
    s.x = cx + nx * rr; s.y = cy + ny * rr;
    // contact point velocity of the other body
    const rx = cx + nx * cr - o.x, ry = cy + ny * cr - o.y;
    const vbx = o.vx - o.va * ry, vby = o.vy + o.va * rx;
    const hit = this._impulse(s, nx, ny, vbx, vby, e, 0.4, quiet ? null : 'body', cx + nx * cr, cy + ny * cr, o);
    return hit;
  }

  // restitution along n + Coulomb friction that trades slide for spin
  // (hollow sphere, I = 2/3 m R^2)
  _impulse(s, nx, ny, vbx, vby, e, mu, kind, x, y, o) {
    const rvx = s.vx - vbx, rvy = s.vy - vby;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return false;
    const dvn = -(1 + e) * vn;
    s.vx += dvn * nx; s.vy += dvn * ny;
    const tx = -ny, ty = nx, R = s.spec.r;
    const slip = rvx * tx + rvy * ty - s.va * R;
    let j = slip / 2.5;
    const lim = mu * dvn;
    j = clamp(j, -lim, lim);
    s.vx -= j * tx; s.vy -= j * ty;
    s.va += (j * 1.5) / R;
    s.va = clamp(s.va, -50, 50);
    if (kind) this._onBounce(s, kind, -vn, x, y, o);
    return true;
  }

  _onBounce(s, kind, speed, x, y, o) {
    if (speed < 60) return;
    const pp = s.spec.kind === 'pingpong';
    const v = clamp(speed / 900, 0.12, 1);
    if (kind === 'floor') {
      this.stats.bounces++;
      s.lastFloor = this.time;
      this.sfx(pp ? 'click' : 'thap', x, { vol: v * (pp ? 0.7 : 0.6), pitch: pp ? rnd(1.7, 2.1) : rnd(0.6, 0.75) });
    } else if (kind === 'table') {
      s.lastTable = this.time; s.tableX = x;
      this.sfx('click', x, { vol: v * 0.9, pitch: rnd(1.9, 2.3) });
    } else if (kind === 'net') {
      this.sfx('thap', x, { vol: v * 0.3, pitch: 1.6 });
    } else if (kind === 'body') {
      const ow = o && (o.owner?.heldBy?.puppet || o.owner);
      s.touch = { who: ow, body: o, t: this.time };
      if (pp) this.sfx('chap', x, { vol: v * 0.8, pitch: rnd(1.5, 1.9) });
      else this.sfx('thap', x, { vol: v * 0.7, pitch: rnd(0.9, 1.2) });
      // a keyboard / pad driven puppet (not a deva player) kicks the ball up
      // when it touches their foot or head
      if (this.debug) this.debug.push(['touch', ow?.rig?.id, o.part, Math.round(speed), s.cool]);
      if (!pp && ow instanceof Puppet && ow._gameRole !== 'takraw' && s.cool <= 0 && !ow.isAnimal) {
        const L = ow.rig.limbs || {};
        const foot = [...(L.legF || []), ...(L.legB || [])].includes(o.part);
        const head = o.part === (L.head || 'head');
        if (foot || head) {
          s.vy = Math.min(s.vy, -rnd(700, 900));
          s.vx = s.vx * 0.4 + ow.facing * rnd(60, 200);
          s.va = rnd(-4, 4);
          s.cool = 0.3;
          this.stats.kicks++;
          this.sfx('thap', x, { vol: 0.9, pitch: rnd(1, 1.25) });
          if (foot && !ow.isBusy()) ow.play('kick');
        }
      }
    }
  }

  // pure flight (no collisions) for aiming
  _fly(s0, T, steps = 60) {
    const s = { ...s0 };
    const h = T / steps, g = this.world.gravity, spec = s.spec;
    const mg = 0.0009 * (spec.spin || 0.5);
    for (let i = 0; i < steps; i++) {
      s.vy += g * h;
      const drag = Math.exp(-(spec.drag || 0.1) * h);
      s.vx *= drag; s.vy *= drag;
      s.vx += -mg * s.va * s.vy * h;
      s.vy += mg * s.va * s.vx * h;
      s.va *= Math.exp(-0.25 * h);
      s.x += s.vx * h; s.y += s.vy * h;
    }
    return s;
  }

  // velocity that carries the ball from its position to Q in T seconds
  _aim(st, Q, T, spin = 0) {
    const kd = st.spec.drag || 0.1, g = this.world.gravity;
    const f = kd > 1e-3 ? kd / (1 - Math.exp(-kd * T)) : 1 / T;
    let vx = (Q[0] - st.x) * f;
    let vy = kd > 1e-3 ? (Q[1] - st.y + (g * T) / kd) * f - g / kd : (Q[1] - st.y - 0.5 * g * T * T) / T;
    for (let it = 0; it < 3; it++) {
      const e = this._fly({ ...st, vx, vy, va: spin }, T);
      vx += ((Q[0] - e.x) / T) * 0.9;
      vy += ((Q[1] - e.y) / T) * 0.9;
    }
    return [vx, vy];
  }

  // trajectory prediction with the table/floor (no bodies), sampled
  _predict(st, T = 1.6, h = 1 / 120) {
    if (st._pred && st._predF === this.frame) return st._pred;
    const env = this._env(st.b.z);
    const s = { x: st.x, y: st.y, vx: st.vx, vy: st.vy, a: st.a, va: st.va, spec: st.spec };
    const out = [];
    let bounceTable = 0, floorAt = -1;
    const lt = s.lastTable;
    for (let t = 0; t < T; t += h) {
      const vy0 = s.vy;
      this._stepBall(s, h, env, null, true);
      if (vy0 > 0 && s.vy < 0) {
        if (s.onFloor) { if (floorAt < 0) floorAt = t; } else bounceTable++;
      }
      out.push({ t: t + h, x: s.x, y: s.y, vx: s.vx, vy: s.vy, tb: bounceTable, fl: floorAt >= 0 });
      if (floorAt >= 0 && t - floorAt > 0.3) break;
    }
    void lt;
    st._pred = out; st._predF = this.frame;
    return out;
  }

  _launch(st, vx, vy, va, who, ignoreFor = 0.22) {
    st.vx = vx; st.vy = vy; st.va = va;
    st.ignore = { who, until: this.time + ignoreFor };
    st.cool = 0.25;
  }

  _blade(paddle) {
    const d = paddle.def, s = d.sprite, b = paddle.body;
    const l = s.local([d.paddle.blade[0], d.paddle.blade[1]]);
    return b.toWorld(l[0] - b.com[0], l[1] - b.com[1]);
  }

  // ============================================================ TAKRAW
  _nearestProp(p, test, maxD = Infinity) {
    let best = null, bd = maxD;
    for (const a of this.scene.actors) {
      if (!(a instanceof Prop) || a.removed || !test(a)) continue;
      const d = Math.abs(a.body.x - p.root.x) + Math.abs(a.z - p.z) * 3000;
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  _zone(p, kind) {
    // where on the puppet the ball is met, as learnt from its own swings
    const Z = (p._kz ||= { kick: [0.2, 0.3], knee: [0.16, 0.44], header: [0.04, 1.04] });
    const [fw, up] = Z[kind];
    const h = p.height;
    return [p.root.x + p.facing * fw * h, this.world.floorY(p.z) - up * h];
  }

  _limbPoint(p, kind) {
    if (kind === 'header') return p.limbWorld('head');
    if (kind === 'knee') {
      const j = p.sem.kneeF;
      if (j) return j.B.toWorld(j.lb[0], j.lb[1]);
    }
    return p.limbWorld('footF');
  }

  // lay down whatever is in the hands (a trident is no good for takraw)
  _freeHands(p, keep) {
    for (const h of ['handF', 'handB']) {
      const it = p.held[h];
      if (it && !(keep && keep(it))) { p.release(h); it.body.vx = p.facing * 40; }
    }
  }

  _driveTakraw(p, dt) {
    this._freeHands(p);
    // the ball: nearest takraw ball on stage, or bring one
    let ball = this._nearestProp(p, (a) => a.def.ball && a.def.ball.kind === 'takraw');
    if (!ball) {
      if (this.frame - (this._lastSpawn || -999) < 30) return;
      this._lastSpawn = this.frame;
      ball = this.spawnProp('takraw', p.root.x + p.facing * 60, p.standY() - p.height * 0.6, p.z);
      if (!ball) return;
      this._adopt(ball);
    }
    const st = this.balls.get(ball) || this._adopt(ball);
    let m = this.takraw.get(ball);
    if (!m) {
      m = { ball, st, players: [], receiver: null, rally: 0, nextKind: 'kick', seen: this.time, cx: null };
      this.takraw.set(ball, m);
    }
    m.seen = this.time;
    m.players = this._players('takraw', ball, ball.z).filter((q) => (this._nearestProp(q, (a) => a.def.ball && a.def.ball.kind === 'takraw') === ball));
    if (!m.players.includes(p)) m.players.push(p);
    if (Math.abs(ball.z - p.z) > 0.03 && ball.heldBy == null && p === m.players[0]) ball.setDepth(p.z);
    const players = m.players.slice().sort((a, b) => a.root.x - b.root.x);
    const n = players.length;
    if (m.cx == null || m.n !== n) {
      m.n = n;
      const W = this.scene.worldW || 1600;
      m.cx = clamp(players.reduce((s, q) => s + q.root.x, 0) / n, 380, W - 380);
    }
    const spacing = n > 1 ? clamp(900 / (n - 1), 260, 380) : 0;
    const idx = players.indexOf(p);
    const home = m.cx + (idx - (n - 1) / 2) * spacing;
    p._home = home;
    if (!st.free) { this._step(p, home, 120, dt); return; }

    // who's receiving
    if (!m.receiver || m.receiver.removed || !m.players.includes(m.receiver)) {
      let best = null, bd = Infinity;
      for (const q of players) { const d = Math.abs(q.root.x - st.x); if (d < bd) { bd = d; best = q; } }
      m.receiver = best;
    }
    // face the partner (or the centre when alone)
    let partner = null;
    if (n > 1) {
      // the one I'll pass to (or got it from), else my nearest neighbour
      const cand = m.receiver === p && m.lastKicker && m.lastKicker !== p && players.includes(m.lastKicker) ? m.lastKicker : null;
      partner = cand || players.filter((q) => q !== p).sort((a, b) => Math.abs(a.root.x - p.root.x) - Math.abs(b.root.x - p.root.x))[0];
    }
    const lookX = partner ? partner.root.x : m.cx + (p.root.x < m.cx ? 1 : -1) * 0.1;

    if (m.receiver !== p) {
      if (!p.isBusy()) this._face(p, lookX);
      this._step(p, home, 160, dt);
      return;
    }
    // --- receiver: get under the ball
    const kind = m.nextKind || 'kick';
    const resting = st.onFloor && Math.abs(st.vy) < 40;
    if (resting || (st.onFloor && Math.hypot(st.vx, st.vy) < 160)) {
      // scoop it up off the floor
      if (!p.isBusy()) this._face(p, lookX);
      const [zx] = this._zone(p, 'kick');
      const want = p.root.x + (st.x + st.vx * 0.25 - zx);
      const gap = this._step(p, want, 260, dt);
      if (gap < 26 && !p.isBusy() && !p._gk) this._startKick(p, 'kick', true);
      return;
    }
    const pred = this._predict(st);
    const zy = this._zone(p, kind)[1];
    let hit = null;
    for (const q of pred) {
      if (q.vy > 0 && q.y >= zy) { hit = q; break; }
      if (q.fl) break;
    }
    if (!hit) hit = pred.find((q) => q.fl) || pred[pred.length - 1];
    if (!hit) return;
    if (!p.isBusy() && hit.t > 0.45) this._face(p, lookX);
    const [zx] = this._zone(p, kind);
    const want = p.root.x + (hit.x - zx);
    this._step(p, want, p.isBusy() ? 60 : 420, dt);
    const apex = ANIMS[kind].apex;
    if (!p._gk && !p.isBusy() && hit.t <= apex + 0.03 && Math.abs(hit.x - zx) < 90) this._startKick(p, kind, false);
  }

  _startKick(p, kind, forced) {
    if (!p.play(kind)) return;
    p._gk = { kind, t0: this.time, apex: ANIMS[kind].apex, forced, done: false };
  }

  _takrawAssist(m, dt) {
    const st = m.st;
    for (const p of m.players) {
      const gk = p._gk;
      if (!gk) continue;
      const t = this.time - gk.t0;
      // learn where this puppet actually meets the ball
      if (Math.abs(t - gk.apex) < dt * 0.6) {
        const L = this._limbPoint(p, gk.kind);
        if (L) {
          const fy = this.world.floorY(p.z), h = p.height;
          const Z = p._kz;
          const fw = ((L[0] - p.root.x) * p.facing) / h, up = (fy - L[1]) / h;
          if (Number.isFinite(fw) && Number.isFinite(up)) Z[gk.kind] = [lerp(Z[gk.kind][0], clamp(fw, -0.1, 0.5), 0.5), lerp(Z[gk.kind][1], clamp(up, 0.1, 1.3), 0.5)];
        }
      }
      if (gk.done) { if (t > gk.apex + 0.3) p._gk = null; continue; }
      if (t > gk.apex + 0.16) {
        // whiffed
        this.stats.whiffs++;
        if (this.debug) { const L = this._limbPoint(p, gk.kind), Z = this._zone(p, gk.kind); this.debug.push(['whiff', p.rig.id, gk.kind, gk.forced, Math.round(st.x - L[0]), Math.round(st.y - L[1]), Math.round(st.x - Z[0]), Math.round(st.y - Z[1]), st.onFloor]); }
        p._gk = null;
        continue;
      }
      if (t < gk.apex - 0.12 || !st.free) continue;
      const L = this._limbPoint(p, gk.kind) || this._zone(p, gk.kind);
      const Z = this._zone(p, gk.kind);
      const R = st.spec.r;
      const close = Math.hypot(st.x - L[0], st.y - L[1]) < R + 55 || Math.hypot(st.x - Z[0], st.y - Z[1]) < R + 70 || (gk.forced && Math.abs(st.x - Z[0]) < 80 && st.onFloor)
        || (st.touch && st.touch.who === p && this.time - st.touch.t < 0.12 && this.time - st.touch.t <= t);
      if (!close) continue;
      gk.done = true;
      this._kickTo(m, p, gk.kind);
    }
    // ball on the floor ends the rally
    if (st.free && st.lastFloor > 0 && st.lastFloor !== m.lastFloorSeen) {
      m.lastFloorSeen = st.lastFloor;
      if (m.rally >= 3) {
        this.sfx(Math.random() < 0.5 ? 'gasp' : 'laugh', st.x, { vol: 0.4 });
        const who = m.lastKicker && !m.lastKicker.removed ? m.lastKicker : m.players[0];
        if (Math.random() < 0.6) who?.say(pick(SAY.miss));
      }
      if (m.rally > 0) this.stats.drops++;
      m.best = Math.max(m.best || 0, m.rally);
      this.stats.bestTakraw = Math.max(this.stats.bestTakraw, m.rally);
      m.rally = 0;
      m.receiver = null;
      m.nextKind = 'kick';
    }
  }

  _kickTo(m, p, kind) {
    const st = m.st;
    const others = m.players.filter((q) => q !== p && !q.removed && q.mode !== 'ragdoll');
    let to = p;
    if (others.length) {
      // pass along: prefer the neighbour we didn't just get it from
      const pool = others.length > 1 ? others.filter((q) => q !== m.lastKicker) : others;
      to = pick(pool.length ? pool : others);
    }
    const r = Math.random();
    let next = to === p ? (r < 0.55 ? 'kick' : r < 0.85 ? 'knee' : 'header') : (r < 0.75 ? 'kick' : r < 0.9 ? 'knee' : 'header');
    const Q = this._zone(to, next);
    if (to === p) Q[0] += rnd(-25, 25);
    else if (to._home != null) Q[0] += (to._home - to.root.x) * 0.6; // spread out again
    const d = Math.abs(Q[0] - st.x);
    const T = to === p ? rnd(0.75, 1.0) : clamp(0.8 + d / 1100, 0.95, 1.55);
    const spin = rnd(-3, 3);
    const [vx, vy] = this._aim(st, Q, T, spin);
    if (!Number.isFinite(vx) || !Number.isFinite(vy)) return;
    // juggling alone: don't let my own head/arms knock it on the way down
    this._launch(st, vx, vy, spin, p, to === p ? T * 0.7 : 0.3);
    m.receiver = to;
    m.nextKind = next;
    m.lastKicker = p;
    m.nextFor = to;
    m.rally++;
    this.stats.kicks++;
    this.sfx('thap', st.x, { vol: 0.95, pitch: kind === 'header' ? rnd(0.8, 0.9) : rnd(1.0, 1.25) });
    if (m.rally > 0 && m.rally % 8 === 0) {
      this.sfx('cheer', st.x, { vol: 0.55 });
      p.say(pick(SAY.rally));
    } else if (to !== p && Math.random() < 0.08) p.say(pick(SAY.kick));
  }

  // ============================================================ PING-PONG
  _drivePong(p, dt) {
    // the table
    let table = this._nearestProp(p, (a) => !!a.def.table);
    if (!table) {
      if (this.frame - (this._lastTable || -999) < 30) return;
      this._lastTable = this.frame;
      const W = this.scene.worldW || 1600;
      // centred between everyone who wants to play
      const ps = this._players('pingpong', null, p.z);
      if (!ps.includes(p)) ps.push(p);
      const mx = ps.reduce((a, q) => a + this.scene.project(q.root.x, 0, q.z)[0], 0) / ps.length;
      const [wx] = this.scene.unproject(clamp(mx, 620, W - 620), 0, p.z);
      const def = this.def('pingpong-table');
      table = this.spawnProp('pingpong-table', wx, this.world.floorY(p.z) - 100, p.z);
      if (!table) return;
      // stand it on the floor
      const s = def.sprite, bottom = s.local([0, s.h - s.oy * 2])[1] - table.body.com[1];
      table.placeAt(wx, this.world.floorY(p.z) + 2 - bottom);
    }
    let m = this.pong.get(table);
    if (!m) {
      m = { table, players: [], rally: 0, state: 'wait', t: 0.8, server: null, ball: null, seen: this.time, lastHit: 0, hitter: null };
      this.pong.set(table, m);
    }
    m.seen = this.time;
    m.players = this._players('pingpong', table, table.z).filter((q) => this._nearestProp(q, (a) => !!a.def.table) === table).sort((a, b) => a.root.x - b.root.x);
    if (!m.players.includes(p)) m.players.push(p);
    const g = this._tableGeo(table);
    const L = g.top[0][0], Rt = g.top[1][0];
    const two = m.players.slice(0, 2);
    let side;
    if (two.length === 2) side = p === two[0] ? -1 : p === two[1] ? 1 : 0;
    else side = p.root.x < g.netX ? -1 : 1;
    p._pongSide = side;
    if (!side) {
      // spectators: stand back and cheer the long rallies
      const x = p.root.x < g.netX ? L - p.height * 0.9 : Rt + p.height * 0.9;
      this._step(p, x, 120, dt);
      this._face(p, g.netX);
      if (m.rally >= 6 && Math.random() < dt * 0.2 && !p.isBusy()) p.play('cheer');
      return;
    }
    // --- a paddle in the front hand
    const held = p.held.handF;
    if (!held || !held.def.paddle) {
      const pad = this._nearestProp(p, (a) => a.def.paddle && !a.heldBy && !a.removed, 700);
      if (pad) {
        const d = this._step(p, pad.body.x - p.facing * p.height * 0.1, 220, dt);
        this._face(p, pad.body.x);
        if (d < 90 || Math.abs(pad.body.x - p.root.x) < 70) { if (held) p.release('handF'); p.grab(pad, 'handF'); this.game.audio?.sfx('pick', { vol: 0.5 }); }
        return;
      }
      if (this.frame - (p._padSpawn || -999) < 30) return;
      p._padSpawn = this.frame;
      const hb = p.bodies.handF;
      if (!hb) return;
      const np = this.spawnProp(side < 0 ? 'pingpong-paddle' : 'pingpong-paddle-blue', hb.x, hb.y, p.z);
      if (np) { if (held) p.release('handF'); p.grab(np, 'handF'); }
      return;
    }
    // ready stance: paddle forward at waist height
    if (!p.anim) {
      p.ctrl = { shoulderF: -55 * DEG, elbowF: -50 * DEG, wristF: 0, shoulderB: -20 * DEG, elbowB: -40 * DEG };
      p.ctrlW = Math.min(0.9, (p.ctrlW || 0) + dt * 3);
      p._gameCtrl = true;
    }
    // learn the blade's reach in the ready pose and at the swing's apex
    const blade = this._blade(held);
    const fw = ((blade[0] - p.root.x) * p.facing), up = blade[1] - p.root.y;
    if (!p.anim && Number.isFinite(fw)) p._bladeReady = [lerp(p._bladeReady?.[0] ?? fw, fw, 0.2), lerp(p._bladeReady?.[1] ?? up, up, 0.2)];
    if (p._gk && Math.abs(this.time - p._gk.t0 - p._gk.apex) < 0.012 && Number.isFinite(fw)) p._bladeApex = [lerp(p._bladeApex?.[0] ?? fw, fw, 0.5), lerp(p._bladeApex?.[1] ?? up, up, 0.5)];
    const BA = p._bladeApex || [(p._bladeReady?.[0] ?? p.height * 0.25) + p.height * 0.05, (p._bladeReady?.[1] ?? 0) - 10];
    p._BA = BA;
    const endX = side < 0 ? L : Rt;
    const faceDir = -side; // look at the net
    if (p.facing !== faceDir && !p.isBusy() && p.flipAnim <= 0) p.flip();
    // home: just behind my end of the table
    const homeX = endX + side * 30 - faceDir * BA[0];
    const st = m.ball && !m.ball.removed ? this.balls.get(m.ball) : null;
    let want = homeX;
    if (st && st.free && m.state === 'play' && st.vx * side > 0) {
      // ball on its way to me: find where I can meet it
      const pred = this._predict(st);
      const reachY = p.root.y + BA[1];
      let hit = null;
      for (const q of pred) {
        if (q.fl) break;
        if ((q.x - g.netX) * side < 60) continue;           // still on the far side
        if (q.vx * side <= 0) continue;
        const bounced = q.tb >= 1 || st.lastTable > m.lastHit;
        if (!bounced && (q.x - endX) * side < 0) continue; // let it bounce on my half first
        if (Math.abs(q.y - reachY) < 55 && (q.x - endX) * side > -110) { hit = q; break; }
      }
      if (hit) {
        want = clamp(hit.x - faceDir * BA[0], side < 0 ? -1e9 : Rt + BA[0] * 0.3, side < 0 ? L - BA[0] * 0.3 : 1e9);
        m.plan = m.plan || {};
        m.plan[side] = hit;
        if (!p._gk && !p.isBusy() && hit.t <= ANIMS.forehand.apex + 0.02) this._swing(p);
      }
    } else if (st && m.state === 'toss' && m.server === p) {
      const pred = this._predict(st);
      const reachY = p.root.y + BA[1];
      const hit = pred.find((q) => q.vy > 0 && q.y >= reachY - 10);
      if (hit && !p._gk && !p.isBusy() && hit.t <= ANIMS.forehand.apex + 0.02) this._swing(p);
    }
    this._step(p, want, p.isBusy() ? 90 : 380, dt);
  }

  _swing(p) {
    if (!p.play('forehand')) return;
    p._gk = { kind: 'pong', t0: this.time, apex: ANIMS.forehand.apex, done: false };
  }

  _pongUpdate(m, dt) {
    const two = m.players.filter((q) => !q.removed && q._pongSide);
    if (!two.length) return;
    const g = this._tableGeo(m.table);
    const z = m.table.z;
    // the ball in play
    if (!m.ball || m.ball.removed) {
      m.ball = null;
      const b = this._nearestProp({ root: { x: g.netX }, z }, (a) => a.def.ball && a.def.ball.kind === 'pingpong' && !a.heldBy, 900);
      if (b) { m.ball = b; if (!this.balls.has(b)) this._adopt(b); }
    }
    const st = m.ball ? this.balls.get(m.ball) : null;
    m.t -= dt;
    if (m.state === 'wait' || m.state === 'dead') {
      if (m.t > 0) return;
      // serve
      const server = m.nextServer && two.includes(m.nextServer) ? m.nextServer : two[0];
      const pad = server.held.handF;
      if (!pad || !pad.def.paddle || !server._bladeReady) { m.t = 0.3; return; }
      const bx = server.root.x + server.facing * (server._BA ? server._BA[0] : this._blade(pad)[0] - server.root.x);
      const by = Math.min(server.root.y + (server._BA ? server._BA[1] : 0), this._blade(pad)[1]);
      let ball = m.ball;
      if (!ball) {
        ball = this.spawnProp('pingpong-ball', bx, by - 60, z);
        if (!ball) return;
        m.ball = ball;
      }
      if (Math.abs(ball.z - z) > 0.02) ball.setDepth(z);
      const s = this.balls.get(ball) || this._adopt(ball);
      ball.placeAt(bx, by - 50);
      Object.assign(s, { x: ball.body.x, y: ball.body.y, vx: 0, vy: -330, va: 0, free: true, lastTable: -1, lastFloor: -1 });
      ball.body.vx = 0; ball.body.vy = -330;
      s.ignore = { who: server, until: this.time + 0.3 }; // don't knock the toss with the resting paddle
      m.server = server;
      m.hitter = null;
      m.state = 'toss';
      m.t = 1.6;
      m.nextServer = two.find((q) => q !== server) || server;
      if (Math.random() < 0.25) server.say(pick(SAY.serve));
      return;
    }
    if (!st) { m.state = 'dead'; m.t = 1; return; }
    // assisted returns
    for (const p of two) {
      const gk = p._gk;
      if (!gk || gk.kind !== 'pong') continue;
      const t = this.time - gk.t0;
      if (gk.done || t > gk.apex + 0.14) { if (t > gk.apex + 0.35) p._gk = null; continue; }
      if (t < gk.apex - 0.1 || !st.free) continue;
      const pad = p.held.handF;
      if (!pad || !pad.def.paddle) continue;
      const [bx, by] = this._blade(pad);
      const plan = m.plan?.[p._pongSide];
      const near = Math.hypot(st.x - bx, st.y - by) < st.spec.r + 42 || (plan && Math.hypot(st.x - plan.x, st.y - plan.y) < 40 && this.time - gk.t0 > gk.apex - 0.05);
      if (!near) continue;
      if (m.state === 'play' && m.hitter === p) continue;
      gk.done = true;
      this._returnShot(m, p, st, g);
    }
    // dead ball: on the floor, gone astray, or nobody hit it for a while
    const dead = (st.lastFloor > m.lastHit && st.lastFloor > 0) || (st.onFloor && st.free && m.state === 'play' && this.time - m.lastHit > 0.1) || !st.free && m.state !== 'toss' || this.time - m.lastHit > 3.5 && m.state === 'play' || m.state === 'toss' && m.t < 0;
    if (dead) {
      if (this.debug) this.debug.push(['pongdead', m.state, m.rally, Math.round(st.x), Math.round(st.y), Math.round(st.vx), Math.round(st.vy), st.lastFloor > m.lastHit, !st.free, +(this.time - m.lastHit).toFixed(2)]);
      if (m.rally >= 4) this.sfx(m.rally >= 10 ? 'cheer' : 'gasp', g.netX, { vol: 0.4 });
      m.best = Math.max(m.best || 0, m.rally);
      this.stats.bestPong = Math.max(this.stats.bestPong, m.rally);
      m.rally = 0;
      m.state = 'dead';
      m.t = 1.2;
      m.plan = null;
    }
  }

  _returnShot(m, p, st, g) {
    const side = p._pongSide;
    const L = g.top[0][0], R = g.top[1][0];
    const half = (R - L) / 2;
    const tx = g.netX - side * half * rnd(0.35, 0.8);
    const Q = [tx, g.topY - st.spec.r - 1];
    const spin = rnd(4, 10) * -side; // a touch of topspin
    // lowest arc that clears the net AND drops steeply enough to kick back
    // up into the other player's reach after the bounce
    let best = null;
    for (let T = 0.5; T <= 1.4; T += 0.05) {
      const [vx, vy] = this._aim(st, Q, T, spin);
      if (!Number.isFinite(vx) || !Number.isFinite(vy)) continue;
      const tn = Math.abs((g.netX - st.x) / (vx || 1e-3));
      const e = this._fly({ ...st, vx, vy, va: spin }, Math.min(tn, T), 30);
      const land = this._fly({ ...st, vx, vy, va: spin }, T, 40);
      best = [vx, vy];
      if (e.y < g.netTop - st.spec.r - 8 && land.vy > 760) break;
    }
    if (!best) return;
    if (this.debug) this.debug.push(['return', p.rig.id, Math.round(st.x), Math.round(st.y), Math.round(tx), best.map(Math.round)]);
    this._launch(st, best[0], best[1], spin, p);
    st.lastTable = -1;
    m.hitter = p;
    m.lastHit = this.time;
    m.state = 'play';
    m.rally++;
    this.stats.returns++;
    this.sfx('chap', st.x, { vol: 0.9, pitch: rnd(1.4, 1.7) });
    if (m.rally % 10 === 0) { this.sfx('cheer', st.x, { vol: 0.5 }); p.say(pick(SAY.rally)); }
  }

  // ============================================================ JUMP ROPE
  _newRope(prop) {
    const N = prop.def.rope.segs || 16;
    const b = prop.body;
    const pts = [], prev = [];
    for (let i = 0; i <= N; i++) { pts.push([b.x, b.y]); prev.push([b.x, b.y]); }
    return { prop, N, pts, prev, phase: -Math.PI / 2, omega: 0, count: 0, best: 0, rest: 18, R: 240, snag: 0, pause: 0, lastBottom: 0, active: false, holder: null, floorTap: false, tips: null, hidden: false };
  }

  _driveRope(p, dt) {
    if (p.held.handB) this._freeHands(p, (it) => it === p.held.handF);
    const held = p.held.handF;
    if (!held || !held.def.rope) {
      const rope = this._nearestProp(p, (a) => a.def.rope && !a.heldBy && !a.removed, 700);
      if (rope) {
        const d = Math.abs(rope.body.x - p.root.x);
        this._face(p, rope.body.x);
        this._step(p, rope.body.x, 200, dt);
        if (d < 80) { if (held) p.release('handF'); p.grab(rope, 'handF'); this.game.audio?.sfx('pick', { vol: 0.5 }); }
        return;
      }
      if (this.frame - (p._ropeSpawn || -999) < 30) return;
      p._ropeSpawn = this.frame;
      const hb = p.bodies.handF;
      if (!hb) return;
      const np = this.spawnProp('jump-rope', hb.x, hb.y, p.z);
      if (np) { if (held) p.release('handF'); p.grab(np, 'handF'); this.ropes.set(np, this._newRope(np)); }
      return;
    }
    const R = this.ropes.get(held) || (this.ropes.set(held, this._newRope(held)), this.ropes.get(held));
    R.ai = p;
    R.aiSeen = this.frame;
    // arms: both hands low and forward, circling with the rope
    const ph = R.phase;
    const w = Math.min(1, R.omega / 7);
    const lift = this._ropeLift(p, R);
    const tuck = lift / (p.height * 0.13);
    p.ctrl = {
      shoulderF: (-30 + Math.sin(ph) * 10 * w) * DEG, elbowF: (-58 + Math.cos(ph) * 12 * w) * DEG, wristF: 0,
      shoulderB: (-30 + Math.sin(ph) * 10 * w) * DEG, elbowB: (-58 + Math.cos(ph) * 12 * w) * DEG, wristB: 0,
      hipF: (-6 - 22 * tuck) * DEG, kneeF: (6 + 48 * tuck) * DEG, hipB: (4 - 16 * tuck) * DEG, kneeB: (6 + 52 * tuck) * DEG,
      neck: 6 * DEG,
    };
    p.ctrlW = Math.min(0.95, (p.ctrlW || 0) + dt * 3);
    p._gameCtrl = true;
    if (p.anim && !p.anim.stopping && p.anim.name !== 'cheer') p.stopAnim();
    // hop: lift the root so the feet clear the rope as it sweeps under
    if (p.mode === 'planted') p.target.y = p.standY() - lift;
  }

  // how high to be off the floor right now (a parabola around the moment
  // the rope sweeps under the feet, led a little for the drive lag)
  _ropeLift(p, R) {
    if (R.pause > 0 || R.omega < 2.5) return 0;
    const lead = 0.07;
    const phi = R.apexAng ?? R.phase;
    const d = wrapA(phi + R.omega * lead - Math.PI / 2);
    const win = clamp(R.omega * 0.17, 0.7, 1.4);
    if (Math.abs(d) >= win) return 0;
    const u = d / win;
    return p.height * 0.13 * (1 - u * u);
  }

  _handInfo(p, hand) {
    const g = p.limbWorld(hand);
    const L = p.rig.limbs || {};
    const arm = hand === 'handF' ? L.armF : L.armB;
    if (!g || !arm || arm.length < 2) return null;
    const fore = p.bodies[arm[arm.length - 2]];
    const ang = dirWorld(fore, p.axis[fore.part] - p._neutral[fore.part]);
    // held like a hammer: the handle stands up out of the fist, forward
    const da = ang - 1.25 * p.facing;
    return { grip: g, dir: [Math.cos(da), Math.sin(da)], z: p.bodies[hand].z };
  }

  _rope(R, dt) {
    const prop = R.prop;
    const holder = prop.heldBy && prop.heldBy.puppet;
    const b = prop.body;
    if (holder !== R.holder) {
      R.holder = holder;
      if (holder) {
        if (!R.hidden) { R.sprite = b.sprite; b.sprite = BLANK ||= paintSprite(1, 1, () => {}, { pad: 0, name: 'games/blank' }); R.hidden = true; }
        b.collide = false;
      } else if (R.hidden) {
        b.sprite = R.sprite; R.hidden = false; b.collide = true;
      }
      R.omega = 0; R.count = 0;
    }
    if (!holder || holder.removed) { R.active = false; return; }
    const hf = this._handInfo(holder, 'handF'), hb = this._handInfo(holder, 'handB') || hf;
    if (!hf) { R.active = false; return; }
    const spec = prop.def.rope, hs = spec.handle;
    const tipLen = Math.hypot(spec.tip[0] - spec.grip[0], spec.tip[1] - spec.grip[1]);
    const tip = (H) => [H.grip[0] + H.dir[0] * tipLen, H.grip[1] + H.dir[1] * tipLen];
    const A = tip(hf), B = tip(hb);
    R.tips = [hf, hb];
    R.z = hf.z;
    const wasActive = R.active;
    R.active = true;
    const N = R.N, P = R.pts, Pv = R.prev;
    const fy = this.world.floorY(R.z);
    const p = holder;
    const turning = R.ai === p && this.frame - R.aiSeen < 3;
    // rotation speed: the deva turns it steadily, faster as the count grows
    const wantW = turning && R.pause <= 0 ? TAU / clamp(0.95 - R.count * 0.004, 0.72, 0.95) : 0;
    R.omega = lerp(R.omega, wantW, 1 - Math.exp(-dt * (wantW ? 4 : 2.5)));
    R.pause = Math.max(0, R.pause - dt);
    R.phase += R.omega * dt;
    const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const headTop = p.root.y - p.headOffset;
    const wantR = Math.max(fy - mid[1] + 26, mid[1] - headTop + 34);
    R.R = lerp(R.R, wantR, 1 - Math.exp(-dt * 4));
    const f = p.facing;
    const u = [f * Math.cos(R.phase), Math.sin(R.phase)], v = [-u[1], u[0]];
    const W = R.R * 0.16;
    const target = (i) => {
      // a slim ellipse through the hands, reaching R.R out along u
      const s = i / N, e = 0.5 - 0.5 * Math.cos(TAU * s), w = Math.sin(TAU * s);
      return [A[0] + (B[0] - A[0]) * s + u[0] * R.R * e + v[0] * W * w, A[1] + (B[1] - A[1]) * s + u[1] * R.R * e + v[1] * W * w];
    };
    if (!wasActive) {
      for (let i = 0; i <= N; i++) { const t = target(i); P[i] = [t[0], Math.min(t[1], fy - 2)]; Pv[i] = P[i].slice(); }
      let L = 0;
      for (let i = 0; i < N; i++) L += Math.hypot(target(i + 1)[0] - target(i)[0], target(i + 1)[1] - target(i)[1]);
      R.rest = L / N;
    }
    // rest length follows the loop size (the rope is as long as it needs)
    {
      let L = 0;
      let prevT = target(0);
      for (let i = 1; i <= N; i++) { const t = target(i); L += Math.hypot(t[0] - prevT[0], t[1] - prevT[1]); prevT = t; }
      R.rest = lerp(R.rest, L / N, 0.05);
    }
    // legs of the holder (the rope catches on them)
    const L = p.rig.limbs || {};
    // only the shins/feet: in side view the rope passes the rest of the body
    // round its sides, and only the bottom of the loop sweeps under the feet
    const legs = [L.legF?.[L.legF.length - 1], L.legB?.[L.legB.length - 1]].map((id) => p.bodies[id]).filter(Boolean);
    const i0 = Math.floor(N * 0.3), i1 = Math.ceil(N * 0.7);
    const sub = 4, h = dt / sub, g = this.world.gravity;
    const att = R.omega > 1 ? 0.3 * Math.min(1, R.omega / 5) : 0;
    let pushed = 0, floorHit = false;
    for (let sI = 0; sI < sub; sI++) {
      for (let i = 1; i < N; i++) {
        const q = P[i], o = Pv[i];
        const vx = (q[0] - o[0]) * 0.985, vy = (q[1] - o[1]) * 0.985;
        o[0] = q[0]; o[1] = q[1];
        q[0] += vx; q[1] += vy + g * h * h;
        if (att) { const t = target(i); q[0] += (t[0] - q[0]) * att; q[1] += (t[1] - q[1]) * att; }
      }
      for (let it = 0; it < 6; it++) {
        P[0][0] = A[0]; P[0][1] = A[1]; P[N][0] = B[0]; P[N][1] = B[1];
        for (let i = 0; i < N; i++) {
          const a = P[i], c = P[i + 1];
          let dx = c[0] - a[0], dy = c[1] - a[1];
          const d = Math.hypot(dx, dy) || 1e-6;
          if (d <= R.rest && R.omega < 1) continue; // slack rope doesn't push
          const diff = (d - R.rest) / d;
          const wa = i === 0 ? 0 : 0.5, wc = i + 1 === N ? 0 : 0.5;
          const s2 = 1 / Math.max(1e-6, wa + wc);
          a[0] += dx * diff * wa * s2; a[1] += dy * diff * wa * s2;
          c[0] -= dx * diff * wc * s2; c[1] -= dy * diff * wc * s2;
        }
      }
      for (let i = 1; i < N; i++) {
        const q = P[i], o = Pv[i];
        if (q[1] > fy - 1.5) {
          q[1] = fy - 1.5;
          o[0] = lerp(o[0], q[0], 0.4); // floor friction
          floorHit = true;
        }
        for (const lb of i >= i0 && i <= i1 ? legs : []) {
          if (Math.hypot(lb.x - q[0], lb.y - q[1]) > lb.radius + 4) continue;
          const c = Math.cos(lb.a), sn = Math.sin(lb.a);
          for (const k2 of lb.circles) {
            const lx = k2.x * lb.flip;
            const cx = lb.x + lx * c - k2.y * sn, cy = lb.y + lx * sn + k2.y * c;
            const dx = q[0] - cx, dy = q[1] - cy, d = Math.hypot(dx, dy), rr = k2.r + 2;
            if (d < rr && d > 1e-6) { q[0] = cx + (dx / d) * rr; q[1] = cy + (dy / d) * rr; pushed++; }
          }
        }
      }
    }
    // where the loop actually is (apex angle), for the jumper's timing
    let far = 0, fi = N >> 1;
    for (let i = 1; i < N; i++) { const d = Math.hypot(P[i][0] - mid[0], P[i][1] - mid[1]); if (d > far) { far = d; fi = i; } }
    const apex = P[fi];
    const ang = Math.atan2(apex[1] - mid[1], (apex[0] - mid[0]) * f);
    R.apexAng = R.apexAng == null ? ang : R.apexAng + wrapA(ang - R.apexAng);
    // counting and tripping at each sweep under the feet
    const d = wrapA(R.apexAng - Math.PI / 2);
    if (R.omega > 4 && R.pause <= 0) {
      if (Math.abs(d) < 0.9 && pushed > 0 && R.omega > 5) R.snag++;
      if (this.debug && Math.abs(d) < 0.12) { let lowFoot = 1e9; for (const lb of legs) for (const k2 of lb.circles) { const [cx, cy] = lb.toWorld(k2.x, k2.y); lowFoot = Math.min(lowFoot, fy - cy - k2.r); } this.debug.push(['rope', +d.toFixed(2), Math.round(lowFoot), Math.round(this._ropeLift(p, R)), pushed, R.snag]); }
      if (R.prevD != null && R.prevD < 0 && d >= 0 && Math.abs(d) < 1) {
        if (R.snag > 4) {
          // tangled
          R.pause = 1.4; R.omega = 0; this.stats.trips++;
          R.best = Math.max(R.best, R.count);
          if (R.count >= 3) p.say(pick(SAY.trip));
          this.sfx('laugh', p.root.x, { vol: 0.35 });
          R.count = 0;
        } else {
          R.count++;
          this.stats.jumps++;
          if (R.count % 10 === 0) { this.sfx('cheer', p.root.x, { vol: 0.5 }); p.say({ th: thaiNum(R.count) + '!', en: R.count + '!' }); }
          else if (R.count === 1 && Math.random() < 0.3) p.say(pick(SAY.rope));
        }
        R.snag = 0;
      }
    }
    R.prevD = d;
    if (floorHit && !R.floorTap && R.omega > 3) this.sfx('chap', apex[0], { vol: 0.25, pitch: rnd(0.55, 0.7) });
    R.floorTap = floorHit;
  }

  // ---------------------------------------------------------- rendering
  // Extra shadow items in the format of scene.drawables().
  drawables() {
    const out = [];
    const sx = this.scene.lamp.sx || 0;
    for (const R of this.ropes.values()) {
      if (!R.active || !R.tips) continue;
      const P = R.pts, z = R.z;
      for (let i = 0; i < R.N; i++) {
        out.push({ line: true, a: [P[i][0] - sx, P[i][1]], b: [P[i + 1][0] - sx, P[i + 1][1]], width: 3.4, z, dark: 0.02 });
      }
      const spec = R.prop.def.rope, hs = spec.handle;
      if (!hs) continue;
      const g = hs.local(spec.grip);
      for (const H of R.tips) {
        // sprite "up" (0,-1) along the handle direction, grip on the hand
        const th = Math.atan2(H.dir[0], -H.dir[1]);
        const c = Math.cos(th) * 1.25, s = Math.sin(th) * 1.25; // a touch bigger than life, to read
        const m = [c, s, -s, c, 0, 0];
        m[4] = H.grip[0] - (c * g[0] - s * g[1]) - sx;
        m[5] = H.grip[1] - (s * g[0] + c * g[1]);
        out.push({ sprite: hs, m, z: H.z + 0.0005 });
      }
    }
    return out;
  }
}

// Entry point for the deva stagehands (flies.js): drives a puppet for one
// of the GAME_ROLES. Creates the Games system on first use.
export function driveRole(fly, puppet, role, dt, game) {
  const G = game.games || new Games(game);
  G.drive(fly, puppet, role, dt);
}
