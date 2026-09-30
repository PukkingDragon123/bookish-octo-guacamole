// Autonomous animals: every animal prop (a Puppet with isAnimal) gets a
// small brain — a state machine with a bit of personality — that grazes,
// wanders, herds, sleeps at night, flees from danger, hunts, plays, swims
// in floods and flies. All movement is done by easing the puppet's
// target (x, y, lean) so the physics rig and its gait animate by itself.
//
//   const ai = new AnimalAI(game);   // once
//   ai.update(dt);                   // every frame, before scene.update
//
// An animal is left alone while something else drives it: a controller
// (player drag / deva fly), 'held' or 'ragdoll' mode, stun, a.dead, or the
// player steering the selected animal with the keys / pad / tap-to-walk.

import { ANIMS } from '../puppet/animations.js';

// ------------------------------------------------------------ species
// speed/run: walk and burst speed (world units / s); size: rough body
// class (chick 0.25 … elephant 5); timid 0..1; herd: group id; mother:
// ids a baby follows; move: 'walk' | 'hop' (small hops while moving) |
// 'bound' (only moves while airborne: rabbits, frogs); fly: false |
// 'sometimes' | 'always' | 'float'; water: 'fish' | true (loves floods).
const BASE = {
  speed: 60, run: 200, size: 1, timid: 0.5, herd: null, mother: null, diet: 'grazer',
  move: 'walk', fly: false, water: false, nocturnal: false, monster: false, sound: [9, 22],
};

const SPECIES = {
  kwai: { speed: 42, run: 170, size: 3, timid: 0.2, herd: 'bovine', water: true, sound: [12, 28] },
  'wua-khao': { speed: 48, run: 170, size: 3, timid: 0.3, herd: 'bovine', sound: [12, 28] },
  'luk-kwai': { speed: 55, run: 200, size: 1.6, timid: 0.6, herd: 'bovine', mother: ['kwai', 'wua-khao'], water: true },
  chang: { speed: 42, run: 160, size: 5, timid: 0.1, herd: 'elephant', water: true, sound: [15, 32] },
  'chang-song': { speed: 38, run: 150, size: 5, timid: 0.05, herd: 'elephant', sound: [15, 32] },
  'chang-noi': { speed: 58, run: 190, size: 2.4, timid: 0.5, herd: 'elephant', mother: ['chang', 'chang-song'], water: true },
  mu: { speed: 52, run: 190, size: 1.5, timid: 0.6, herd: 'pig', diet: 'omnivore' },
  'moo-deng': { speed: 70, run: 270, size: 1.3, timid: 0.25, herd: 'hippo', mother: ['hippo'], diet: 'omnivore', water: true, sassy: true, sound: [7, 16] },
  hippo: { speed: 42, run: 210, size: 3.5, timid: 0.1, herd: 'hippo', water: true, sound: [14, 30] },
  pae: { speed: 60, run: 230, size: 1.2, timid: 0.55, herd: 'ovine', diet: 'grazer' },
  kae: { speed: 50, run: 210, size: 1.2, timid: 0.8, herd: 'ovine' },
  ma: { speed: 75, run: 330, size: 3, timid: 0.6, herd: 'horse' },
  'kwang-thong': { speed: 80, run: 370, size: 1.8, timid: 0.95, herd: 'deer', sound: [10, 20] },
  'kai-chon': { speed: 70, run: 240, size: 0.6, timid: 0.25, herd: 'chicken', diet: 'omnivore', fighter: true, sound: [8, 18] },
  'mae-kai': { speed: 55, run: 220, size: 0.6, timid: 0.8, herd: 'chicken', diet: 'omnivore' },
  'kai-jae': { speed: 60, run: 230, size: 0.5, timid: 0.7, herd: 'chicken', diet: 'omnivore', move: 'hop' },
  'luk-kai': { speed: 62, run: 230, size: 0.25, timid: 0.95, herd: 'chicken', mother: ['mae-kai', 'kai-jae'], move: 'hop', sound: [6, 14] },
  pet: { speed: 45, run: 180, size: 0.6, timid: 0.7, herd: 'waterfowl', diet: 'omnivore', water: true },
  han: { speed: 50, run: 200, size: 0.9, timid: 0.35, herd: 'waterfowl', diet: 'omnivore', water: true },
  'nok-yung': { speed: 50, run: 230, size: 1, timid: 0.75, herd: 'peafowl', move: 'hop' },
  'nok-ngueak': { speed: 60, run: 260, size: 1, timid: 0.6, move: 'hop', fly: 'sometimes', diet: 'omnivore' },
  'ma-thai': { speed: 90, run: 310, size: 1.2, timid: 0.1, diet: 'omnivore', dog: true, sound: [10, 22] },
  'maeo-wichianmat': { speed: 70, run: 300, size: 0.7, timid: 0.7, diet: 'predator', cat: true, nocturnal: true },
  ling: { speed: 90, run: 290, size: 0.8, timid: 0.45, diet: 'omnivore', move: 'hop', pester: true, sound: [8, 16] },
  kratai: { speed: 90, run: 340, size: 0.5, timid: 0.95, move: 'bound' },
  kop: { speed: 70, run: 220, size: 0.2, timid: 0.8, move: 'bound', water: true, nocturnal: true, sound: [8, 16] },
  tao: { speed: 12, run: 26, size: 0.6, timid: 0.4, water: true, sound: [30, 60] },
  pu: { speed: 40, run: 95, size: 0.3, timid: 0.6, sideways: true, water: true, sound: [20, 40] },
  'pla-chon': { speed: 80, run: 220, size: 0.6, timid: 0.5, water: 'fish', sound: [30, 60] },
  'pla-thong': { speed: 60, run: 180, size: 0.4, timid: 0.7, water: 'fish', sound: [30, 60] },
  suea: { speed: 58, run: 470, size: 3, timid: 0, diet: 'predator', stalker: true, nocturnal: true, sound: [14, 28] },
  jorakhe: { speed: 32, run: 390, size: 3, timid: 0, diet: 'predator', lurker: true, water: true, sound: [18, 36] },
  // monsters
  'phaya-nak': { speed: 50, run: 160, size: 5, timid: 0, monster: true, water: true, diet: 'predator', sound: [14, 30] },
  mangkon: { speed: 95, run: 260, size: 5, timid: 0, monster: true, fly: 'always', sound: [12, 26] },
  krasue: { speed: 45, run: 150, size: 1.5, timid: 0, monster: true, fly: 'float', nocturnal: true, sound: [9, 20] },
  khrut: { speed: 120, run: 320, size: 4, timid: 0, monster: true, fly: 'always', sound: [12, 26] },
  pret: { speed: 22, run: 70, size: 3, timid: 0, monster: true, nocturnal: true, sound: [12, 26] },
  'phi-ta-khon': { speed: 60, run: 200, size: 2, timid: 0, monster: true, move: 'hop', sound: [10, 22] },
};

const cache = new Map();
export function animalTraits(id) {
  let t = cache.get(id);
  if (!t) {
    t = Object.freeze({ id, ...BASE, ...(SPECIES[id] || {}) });
    cache.set(id, t);
  }
  return t;
}

// ------------------------------------------------------------ moves
// Extra rig-independent moves (root motion only, plus neck/jaw where the
// rig has them). The attack windows make scene._combat count contacts.
function addAnim(name, def) {
  if (ANIMS[name]) return;
  const joints = new Set();
  for (const k of def.keys) Object.keys(k.j || (k.j = {})).forEach((n) => joints.add(n));
  let pj = {}, pr = { dx: 0, dy: 0, lean: 0 };
  for (const k of def.keys) { k.j = { ...pj, ...k.j }; k.root = { ...pr, ...k.root }; pj = k.j; pr = k.root; }
  let next = {};
  for (let i = def.keys.length - 1; i >= 0; i--) {
    for (const n of joints) if (def.keys[i].j[n] == null && next[n] != null) def.keys[i].j[n] = next[n];
    next = def.keys[i].j;
  }
  def.joints = [...joints];
  def.any = true;
  def.humanoid = false;
  ANIMS[name] = def;
}
addAnim('ai-pounce', {
  th: 'ตะปบ', en: 'Pounce', duration: 0.7, fadeIn: 0.05, fadeOut: 0.2, attack: [0.12, 0.5], attackPower: 1.1,
  keys: [
    { t: 0, j: { neck: 10, jaw: 0 }, root: { dy: 16, lean: 6 } },
    { t: 0.14, j: { jaw: 30 }, root: { dy: -55, dx: 30, lean: -12 } },
    { t: 0.38, j: { neck: 16, jaw: 34 }, root: { dy: 4, dx: 50, lean: 10 } },
    { t: 0.7, j: { neck: 0, jaw: 0 }, root: { dy: 0, dx: 0, lean: 0 } },
  ],
});
addAnim('ai-lunge', {
  th: 'งับ', en: 'Snap', duration: 0.55, fadeIn: 0.04, fadeOut: 0.2, attack: [0.08, 0.34], attackPower: 1.2,
  keys: [
    { t: 0, j: { jaw: 0 }, root: { dy: 4, lean: 0 } },
    { t: 0.1, j: { jaw: 40 }, root: { dx: 60, dy: -8, lean: -4 } },
    { t: 0.28, j: { jaw: 0 }, root: { dx: 70, dy: 0, lean: 6 } },
    { t: 0.55, root: { dx: 0, dy: 0, lean: 0 } },
  ],
});
addAnim('ai-bite', {
  th: 'งับเล่น', en: 'Playful bite', duration: 0.5, fadeIn: 0.04, fadeOut: 0.2, attack: [0.1, 0.32], attackPower: 0.55,
  keys: [
    { t: 0, j: { neck: 0, jaw: 0 }, root: { dy: 0, lean: 0 } },
    { t: 0.12, j: { neck: 14, jaw: 35 }, root: { dx: 28, dy: -6, lean: 8 } },
    { t: 0.3, j: { neck: 6, jaw: 0 }, root: { dx: 18, dy: 0, lean: 4 } },
    { t: 0.5, j: { neck: 0 }, root: { dx: 0, lean: 0 } },
  ],
});
addAnim('ai-peck', {
  th: 'ตีกัน', en: 'Cock-fight kick', duration: 0.55, fadeIn: 0.04, fadeOut: 0.15, attack: [0.12, 0.36], attackPower: 0.7,
  keys: [
    { t: 0, j: { neck: 0 }, root: { dy: 6, lean: 0 } },
    { t: 0.16, j: { neck: 12 }, root: { dy: -55, dx: 26, lean: -14 } },
    { t: 0.36, j: { neck: 4 }, root: { dy: -10, dx: 20, lean: 6 } },
    { t: 0.55, j: { neck: 0 }, root: { dy: 0, dx: 0, lean: 0 } },
  ],
});

// ------------------------------------------------------------ helpers
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (cur, want, k, dt) => cur + (want - cur) * (1 - Math.exp(-k * dt));
const halfW = (a) => ((a.bounds && a.bounds.w) || 200) * 0.5;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const SASS = [{ th: 'ฮึ่ย!', en: 'Hmph!' }, { th: 'งับ!', en: 'Chomp!' }, { th: 'เด้ง!', en: 'Boing!' }, { th: 'ไม่!', en: 'No!' }];
const ZZZ = { th: 'ครอก…', en: 'zzz' };
const BARK = [{ th: 'โฮ่ง!', en: 'Woof!' }, { th: 'โฮ่งๆ!', en: 'Woof woof!' }];
const HOOT = { th: 'เจี๊ยกๆ', en: 'Ook ook!' };

const PREDATOR_PREY = {
  suea: (t) => !t.monster && t.size <= 3.2 && t.id !== 'suea' && t.water !== 'fish',
  jorakhe: (t) => !t.monster && t.size <= 3.2 && t.id !== 'jorakhe',
  'phaya-nak': () => false,
  'maeo-wichianmat': (t) => t.id === 'luk-kai' || t.id === 'kop' || t.water === 'fish',
};

// ------------------------------------------------------------ the AI
export class AnimalAI {
  constructor(game) {
    this.game = game;
    this.brains = new WeakMap();
    this.t = 0;
    this.soundCool = 0;
    this.hits = [];         // recent hits: { x, z, t, attacker, target }
    this.stats = { attacks: 0, flees: 0, sounds: 0 };
    this.enabled = true;
    game.scene.on('hit', (h) => {
      const tg = h.target;
      this.hits.push({ x: tg && tg.root ? tg.root.x : h.x, z: h.z ?? 0, t: this.t, attacker: h.attacker, target: tg });
      if (this.hits.length > 16) this.hits.shift();
      if (h.attacker && this.brains.has(h.attacker)) {
        const b = this.brains.get(h.attacker);
        b.landed = (b.landed || 0) + 1;
        // one bite per pounce: skip the rest of the attack window
        const an = h.attacker.anim;
        if (an && an.name && an.name.startsWith('ai-') && an.def.attack) an.t = Math.max(an.t, an.def.attack[1] + 0.01);
        if (b.tr.stalker || b.tr.lurker) b.fed = 6 + Math.random() * 6;
      }
    });
  }

  _brain(a) {
    let b = this.brains.get(a);
    if (!b) {
      const tr = animalTraits(a.def && a.def.id);
      b = {
        tr, st: 'idle', t: rnd(0.5, 2), think: 0, goal: null, other: null, lock: 0, cool: rnd(1, 4),
        pers: { speed: rnd(0.85, 1.2), curious: Math.random(), lazy: Math.random(), bold: Math.random() },
        sndT: rnd(tr.sound[0], tr.sound[1]) * 0.5, yOff: 0, hop: null, lean: 0, neck: 0, neckW: 0,
        flyY: null, flying: tr.fly === 'always' || tr.fly === 'float', swimY: null, phase: Math.random() * 10,
        skipped: false, userT: 0, fleeX: null,
      };
      this.brains.set(a, b);
    }
    return b;
  }

  // Environment shared by all brains this frame.
  _env() {
    const g = this.game, S = g.scene, fx = g.fx;
    const W = (fx && fx.weather) || new Set();
    const flood = (fx && fx.flood) || 0;
    const env = this._envObj || (this._envObj = { fires: [], things: [], puppets: [] });
    env.night = W.has('night');
    env.storm = W.has('storm');
    env.quake = W.has('quake');
    env.rain = W.has('rain');
    env.flood = flood;
    env.waterCloth = fx && fx.waterLevel ? fx.waterLevel() : 1e9;
    env.minX = 80;
    env.maxX = (S.worldW || 1600) - 80;
    env.fires.length = 0;
    env.puppets.length = 0;
    for (const o of S.actors) {
      if (o.removed || !o.root) continue;
      if (o.def && o.def.fx === 'fire') env.fires.push(o);
      else if (!o.isAnimal && o.rig && o.parts && !o.def?.cat) env.puppets.push(o);
    }
    return env;
  }

  update(dt) {
    if (!this.enabled) return;
    const g = this.game, S = g && g.scene;
    if (!S) return;
    dt = Math.min(dt, 0.05);
    this.t += dt;
    this.soundCool -= dt;
    while (this.hits.length && this.t - this.hits[0].t > 2.5) this.hits.shift();
    const env = this._env();
    const animals = S.actors.filter((a) => a.isAnimal && !a.isPlant && !a.removed && a.root);
    this.animals = animals;
    for (const a of animals) {
      const b = this._brain(a);
      if (this._skip(a, b, dt)) {
        if (!b.skipped) { b.skipped = true; this._release(a, b); }
        continue;
      }
      if (b.skipped) { b.skipped = false; b.st = 'idle'; b.t = rnd(0.5, 1.5); b.lock = 0; b.think = 0; if (b.tr.fly !== 'always' && b.tr.fly !== 'float') b.flying = false; }
      try {
        this._rescue(a, env);
        this._think(a, b, dt, env, animals);
        this._body(a, b, dt, env);
      } catch (e) {
        // never let one confused animal take the show down
        if (!this._warned) { this._warned = true; console.warn('animalAI', e); }
      }
    }
  }

  // A rig that got flung far off by the physics (bad contact, explosion)
  // is put back on its feet instead of wandering the void forever.
  _rescue(a, env) {
    const r = a.root;
    const sy = a.standY();
    const lost = !isFinite(r.x) || !isFinite(r.y) || Math.abs(r.x - a.target.x) > 900 || r.y < sy - 1400 || r.y > sy + 600
      || r.x < env.minX - 600 || r.x > env.maxX + 600;
    if (!lost) return;
    const x = clamp(isFinite(a.target.x) ? a.target.x : (env.minX + env.maxX) / 2, env.minX, env.maxX);
    a.teleport(x, a.mode === 'hung' ? a.target.y : sy);
    this.stats.rescues = (this.stats.rescues || 0) + 1;
  }

  _skip(a, b, dt) {
    if (a.controller || a.mode === 'held' || a.mode === 'ragdoll' || a.dead || a.stun > 0) return true;
    const g = this.game;
    if (g.selected === a) {
      const k = g.keys;
      const steering = (k && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyQ', 'KeyE'].some((c) => k.has(c)))
        || (g.controls && g.controls.move) || (g.walkTo && g.walkTo.actor === a);
      if (steering) b.userT = 2.5;
    }
    if (b.userT > 0) { b.userT -= dt; return true; }
    return false;
  }

  _release(a, b) {
    b.yOff = 0; b.hop = null; b.neck = 0; b.neckW = 0; b.lean = 0;
    if (a.ctrl && 'neck' in a.ctrl) { delete a.ctrl.neck; a.ctrlW = 0; }
    a.target.lean = 0;
  }

  // ---------------------------------------------------------- primitives
  _walk(a, b, x, speed, dt, env) {
    x = clamp(x, env.minX, env.maxX);
    const d = x - a.target.x;
    const lag = a.target.x - a.root.x;
    // don't let the target run away from a heavy body
    if (Math.abs(lag) > 110) {
      // blocked (another body in the way, or being shoved): give up after
      // a moment and let the brain pick something else
      b.stuck = (b.stuck || 0) + dt;
      if (b.stuck > 1.2) {
        b.stuck = 0;
        a.target.x = clamp(a.root.x + Math.sign(lag) * 30, env.minX, env.maxX);
        b.goal = null;
        if (b.lock <= 0) b.t = 0;
        return true;
      }
      if (Math.sign(lag) === Math.sign(d)) return false;
    } else b.stuck = 0;
    let v = speed * b.pers.speed;
    if (b.tr.move === 'bound') {
      if (Math.abs(d) > 10 && !b.hop) this._hop(b, clamp(26 + b.tr.size * 30, 20, 60), 0.34);
      v = b.hop ? v * 2.2 : 0;
    } else if (b.tr.move === 'hop' && Math.abs(d) > 10 && !b.hop) this._hop(b, 8 + b.tr.size * 8, 0.24);
    const step = Math.sign(d) * Math.min(Math.abs(d), v * dt);
    a.target.x = clamp(a.target.x + step, env.minX, env.maxX);
    const want = Math.sign(d);
    if (Math.abs(d) > 12 && want && want !== a.facing && !b.tr.sideways) this._face(a, a.root.x + want);
    return Math.abs(d) < 10;
  }

  _face(a, x) {
    const want = Math.sign(x - a.root.x);
    if (want && want !== a.facing && a.flipAnim <= 0 && !a.isBusy()) a.flip();
  }

  _hop(b, h, dur) { b.hop = { t: 0, dur, h }; }

  _sound(a, b, vol = 0.5, name) {
    if (this.soundCool > 0) return false;
    const n = name || (a.rig && a.rig.sound) || (a.def && a.def.sound);
    if (!n) return false;
    const g = this.game;
    const pan = g._pan ? g._pan(a) : 0;
    g.audio?.sfx(n, { pan, vol });
    this.soundCool = 1.5;
    this.stats.sounds++;
    b.sndT = rnd(b.tr.sound[0], b.tr.sound[1]);
    return true;
  }

  _say(a, line, force = false) {
    if (!a.say || (a.speech && !force)) return;
    a.say(line, 1.6);
  }

  _play(a, name) {
    if (a.isBusy()) return false;
    return a.play(name);
  }

  _nearest(a, list, f, maxD = Infinity) {
    let best = null, bd = maxD;
    const x = a.root.x;
    for (const o of list) {
      if (o === a || o.removed || !o.root) continue;
      if (Math.abs(o.z - a.z) > 0.25) continue;
      if (f && !f(o)) continue;
      const d = Math.abs(o.root.x - x);
      if (d < bd) { bd = d; best = o; }
    }
    return best ? (this._nr = { o: best, d: bd }) : null;
  }

  _worldY(cy, z) { return this.game.scene.unproject(0, cy, z)[1]; }

  // Something scary nearby? Returns the x to run away from (or null).
  _threat(a, b, env, animals) {
    const tr = b.tr;
    const timid = tr.timid * (1.25 - b.pers.bold * 0.5);
    if (timid < 0.15) return null;
    const R = 220 + 380 * timid;
    const x = a.root.x;
    let best = null, bd = R;
    for (const o of animals) {
      if (o === a || Math.abs(o.z - a.z) > 0.3) continue;
      const ot = this._brain(o).tr;
      const ob = this.brains.get(o);
      let scary = false;
      if (ot.monster) scary = Math.abs(o.root.y - a.root.y) < 380;
      else if (ot.diet === 'predator' && PREDATOR_PREY[ot.id] && PREDATOR_PREY[ot.id](tr)) scary = !(ob && ob.st === 'sleep');
      else if (ot.dog && (tr.cat || tr.herd === 'chicken' || tr.id === 'kratai')) scary = ob && (ob.st === 'chase' || ob.st === 'bark') || Math.abs(o.root.x - x) < 200;
      if (!scary) continue;
      const d = Math.abs(o.root.x - x);
      if (d < bd) { bd = d; best = o.root.x; }
    }
    for (const f of env.fires) {
      const d = Math.abs(f.root.x - x);
      if (d < Math.min(bd, 260 + 200 * timid)) { bd = d; best = f.root.x; }
    }
    for (const h of this.hits) {
      if (h.target === a && h.attacker && h.attacker.root) { best = h.attacker.root.x; bd = 0; break; }
      const d = Math.abs(h.x - x);
      if (d < Math.min(bd, 380) && Math.abs(h.z - a.z) < 0.3) { bd = d; best = h.x; }
    }
    // puppets swinging weapons about
    for (const p of env.puppets) {
      if (p.attacking > 0 || p.flyRole === 'monster' || p.kind === 'demon') {
        const d = Math.abs(p.root.x - x);
        if (d < Math.min(bd, p.kind === 'demon' ? 300 : 260)) { bd = d; best = p.root.x; }
      }
    }
    return best;
  }

  _set(b, st, t, extra) {
    b.st = st; b.t = t; b.lock = 0;
    if (extra) Object.assign(b, extra);
  }

  // ---------------------------------------------------------- the brain
  _think(a, b, dt, env, animals) {
    const tr = b.tr;
    b.t -= dt;
    b.think -= dt;
    b.cool -= dt;
    b.lock -= dt;
    b.sndT -= dt;
    b.phase += dt;
    let neck = 0, neckW = 0, lean = 0;

    if (tr.water === 'fish') return this._fish(a, b, dt, env);

    // ------------- urgent: danger
    if (b.lock <= 0 && b.think <= 0) {
      b.think = rnd(0.15, 0.35);
      const tx = this._threat(a, b, env, animals);
      if (tx != null && b.st !== 'flee') {
        this._set(b, 'flee', rnd(2.2, 4), { fleeX: tx });
        this.stats.flees++;
        if (tr.move !== 'bound' && !b.hop) this._hop(b, 18 + tr.size * 6, 0.28);
        if (Math.random() < 0.5) this._sound(a, b, 0.55);
        if (tr.fly === 'sometimes' && Math.random() < 0.6) this._takeOff(a, b);
      } else if (tx != null) b.fleeX = tx;
      else if ((env.storm || env.quake) && tr.timid > 0.35 && !tr.monster && b.st !== 'panic' && b.st !== 'flee' && Math.random() < 0.25) {
        this._set(b, 'panic', rnd(2, 4), { goal: rnd(env.minX, env.maxX) });
        if (Math.random() < 0.4) this._sound(a, b, 0.5);
      }
    }

    // ------------- choose a new activity when the current one ran out
    if (b.t <= 0 && b.lock <= 0) this._decide(a, b, env, animals);

    const sp = tr.speed, run = tr.run;
    switch (b.st) {
      case 'flee': {
        const dir = Math.sign(a.root.x - (b.fleeX ?? a.root.x)) || (a.facing || 1);
        let goal = a.root.x + dir * 300;
        if ((dir > 0 && a.root.x > env.maxX - 40) || (dir < 0 && a.root.x < env.minX + 40)) goal = a.root.x; // cornered
        this._walk(a, b, goal, run, dt, env);
        lean = 0.05;
        if (b.t < 0) b.t = 0;
        break;
      }
      case 'panic': {
        if (this._walk(a, b, b.goal, run * 0.8, dt, env) || Math.random() < dt * 0.5) b.goal = rnd(env.minX, env.maxX);
        if (!b.hop && Math.random() < dt * 1.2) this._hop(b, 16 + tr.size * 5, 0.26);
        break;
      }
      case 'idle': {
        neck = Math.sin(b.phase * 0.7) * 0.06; neckW = 0.3;
        this._separate(a, b, dt, env, animals);
        break;
      }
      case 'graze': {
        // head down, nibbling bob, the odd step forward
        neck = 0.45 + Math.sin(b.phase * 6) * 0.12; neckW = 0.7; lean = 0.03;
        if (Math.random() < dt * 0.4) b.goal = a.root.x + a.facing * rnd(10, 40);
        if (b.goal != null) this._walk(a, b, b.goal, sp * 0.4, dt, env);
        this._separate(a, b, dt, env, animals);
        break;
      }
      case 'wander': {
        if (b.goal == null || this._walk(a, b, b.goal, sp, dt, env)) { b.goal = null; b.t = Math.min(b.t, rnd(0, 1)); }
        break;
      }
      case 'swim': {
        // paddle about lazily in the flood
        if (b.goal == null || this._walk(a, b, b.goal, sp * (tr.sassy ? 1.1 : 0.7), dt, env)) b.goal = clamp(a.root.x + rnd(-400, 400), env.minX, env.maxX);
        neck = -0.1; neckW = 0.3;
        if (tr.sassy && !b.hop && Math.random() < dt * 0.6) this._hop(b, 22, 0.35);
        break;
      }
      case 'shore': {
        // non-swimmers crowd to the stage edges while it floods
        if (b.goal == null) b.goal = a.root.x < (env.minX + env.maxX) / 2 ? env.minX + rnd(0, 120) : env.maxX - rnd(0, 120);
        this._walk(a, b, b.goal, sp * 1.4, dt, env);
        break;
      }
      case 'rest': {
        neck = 0.2; neckW = 0.4; lean = 0.02;
        break;
      }
      case 'sleep': {
        neck = 0.5; neckW = 0.6; lean = 0.05;
        if (Math.random() < dt * 0.05) this._say(a, ZZZ);
        break;
      }
      case 'follow': {
        const m = b.other;
        if (!m || m.removed) { b.t = 0; break; }
        const side = -(m.facing || 1);
        const want = m.root.x + side * (halfW(m) * 0.9 + halfW(a) * 0.7) + Math.sin(b.phase * 0.5) * 30;
        const d = Math.abs(want - a.root.x);
        if (d > 40) this._walk(a, b, want, d > 350 ? run * 0.8 : sp * 1.3, dt, env);
        else { this._face(a, m.root.x); neck = 0.3; neckW = 0.4; }
        break;
      }
      case 'herd': {
        if (b.goal == null || this._walk(a, b, b.goal, sp, dt, env)) { b.t = Math.min(b.t, 0.5); b.goal = null; }
        break;
      }
      case 'curious': {
        const o = b.other;
        if (!o || o.removed) { b.t = 0; break; }
        const side = Math.sign(a.root.x - o.root.x) || 1;
        const want = o.root.x + side * (halfW(o) * 0.35 + halfW(a) * 0.8 + 20);
        if (Math.abs(want - a.root.x) > 25) this._walk(a, b, want, sp, dt, env);
        else { this._face(a, o.root.x); neck = 0.25 + Math.sin(b.phase * 9) * 0.1; neckW = 0.6; }
        if (o.walkAmt > 0.3 && Math.random() < dt) b.t = 0; // it moved: lose interest
        break;
      }
      case 'pester': {
        const o = b.other;
        if (!o || o.removed) { b.t = 0; break; }
        if (b.goal == null || this._walk(a, b, b.goal, run * 0.7, dt, env)) {
          const side = Math.random() < 0.5 ? -1 : 1;
          b.goal = o.root.x + side * (halfW(o) * 0.5 + rnd(20, 90));
          if (!b.hop) this._hop(b, rnd(30, 60), 0.4);
          if (Math.random() < 0.25) { this._sound(a, b, 0.5); this._say(a, HOOT); }
        }
        if (!b.hop && Math.random() < dt * 1.5) this._hop(b, rnd(20, 50), 0.35);
        break;
      }
      case 'stalk': {
        const p = b.other;
        if (!p || p.removed || p.dead) { b.t = 0; break; }
        const d = Math.abs(p.root.x - a.root.x);
        const reach = halfW(a) * 0.6 + halfW(p) * 0.5 + 140;
        this._face(a, p.root.x);
        lean = 0.1; b.yOff = ease(b.yOff, 10, 4, dt); neck = 0.2; neckW = 0.5;
        if (d > reach) this._walk(a, b, p.root.x, sp * 0.8, dt, env);
        else if (b.cool <= 0) this._pounce(a, b, p, 'ai-pounce', 0.6);
        break;
      }
      case 'lurk': {
        // crocodile: lie still, drift a little, snap when something comes close
        lean = 0.02;
        const p = this._nearest(a, animals, (o) => PREDATOR_PREY.jorakhe(this._brain(o).tr), env.flood > 0.2 ? 520 : 330);
        if (p && b.cool <= 0) {
          const reach = halfW(a) * 0.6 + halfW(p.o) * 0.5 + 90;
          this._face(a, p.o.root.x);
          if (p.d > reach) this._walk(a, b, p.o.root.x, env.flood > 0.2 ? sp * 3 : sp, dt, env);
          else this._pounce(a, b, p.o, 'ai-lunge', 0.35);
        } else if (b.goal != null && this._walk(a, b, b.goal, sp * 0.6, dt, env)) b.goal = null;
        else if (Math.random() < dt * 0.1) b.goal = a.root.x + rnd(-200, 200);
        break;
      }
      case 'pounce': {
        const dir = b.dir;
        this._walk(a, b, a.root.x + dir * 200, run, dt, env);
        lean = -0.05;
        if (b.lock <= 0) {
          // a predator that caught something is satisfied for a while
          const fed = b.fed || 0; b.fed = 0;
          this._set(b, 'rest', fed ? fed * 0.5 : rnd(1.5, 3));
          b.cool = fed || rnd(2.5, 4.5);
        }
        break;
      }
      case 'bark': {
        const o = b.other;
        if (!o || o.removed) { b.t = 0; break; }
        const d = Math.abs(o.root.x - a.root.x);
        const keep = halfW(o) * 0.6 + halfW(a) + 90;
        if (d > keep + 60) this._walk(a, b, o.root.x, run * 0.6, dt, env);
        else if (d < keep - 40) this._walk(a, b, a.root.x - Math.sign(o.root.x - a.root.x) * 80, sp, dt, env);
        this._face(a, o.root.x);
        lean = -0.04; neck = -0.2; neckW = 0.5;
        if (b.cool <= 0) {
          b.cool = rnd(0.7, 1.4);
          if (!b.hop) this._hop(b, 18, 0.25);
          if (this._sound(a, b, 0.7) && Math.random() < 0.4) this._say(a, pick(BARK));
        }
        break;
      }
      case 'chase': {
        const o = b.other;
        if (!o || o.removed) { b.t = 0; break; }
        this._walk(a, b, o.root.x, run * 0.75, dt, env);
        if (!b.hop && Math.random() < dt * 1.5) this._hop(b, 16, 0.25);
        if (Math.abs(o.root.x - a.root.x) < halfW(a) && Math.random() < dt * 2) this._sound(a, b, 0.5);
        break;
      }
      case 'fight': {
        const o = b.other;
        if (!o || o.removed) { b.t = 0; break; }
        const d = Math.abs(o.root.x - a.root.x);
        const reach = halfW(a) + halfW(o) * 0.6 + 10;
        this._face(a, o.root.x);
        lean = 0.08; neck = 0.2; neckW = 0.5;
        if (d > reach) this._walk(a, b, o.root.x, sp * 1.6, dt, env);
        else if (b.cool <= 0 && this._play(a, 'ai-peck')) {
          b.cool = rnd(0.7, 1.6); this.stats.attacks++;
          a.target.x += Math.sign(o.root.x - a.root.x) * 20;
          if (Math.random() < 0.3) this._sound(a, b, 0.6);
        } else if (d < reach * 0.5) this._walk(a, b, a.root.x - Math.sign(o.root.x - a.root.x) * 60, sp, dt, env);
        break;
      }
      case 'zoomies': {
        if (b.goal == null || this._walk(a, b, b.goal, run * 1.1, dt, env)) {
          b.goal = a.root.x < (env.minX + env.maxX) / 2 ? clamp(a.root.x + rnd(250, 600), env.minX, env.maxX) : clamp(a.root.x - rnd(250, 600), env.minX, env.maxX);
          if (Math.random() < 0.4) this._sound(a, b, 0.6);
        }
        if (!b.hop && Math.random() < dt * 2) this._hop(b, rnd(18, 34), 0.28);
        lean = 0.06;
        break;
      }
      case 'bounce': {
        if (!b.hop) {
          this._hop(b, rnd(30, 55), rnd(0.32, 0.45));
          if (Math.random() < 0.3) a.target.x = clamp(a.target.x + rnd(-30, 30), env.minX, env.maxX);
        }
        break;
      }
      case 'bite': {
        const o = b.other;
        if (!o || o.removed) { b.t = 0; break; }
        const d = Math.abs(o.root.x - a.root.x);
        const reach = halfW(a) * 0.9 + halfW(o) * 0.25;
        if (d > reach) this._walk(a, b, o.root.x, sp * 1.5, dt, env);
        else {
          this._face(a, o.root.x);
          if (b.cool <= 0 && this._play(a, 'ai-bite')) {
            b.cool = rnd(1.2, 2.4); this.stats.attacks++;
            a.target.x += Math.sign(o.root.x - a.root.x) * 25;
            if (Math.random() < 0.5) { this._sound(a, b, 0.6); this._say(a, pick(SASS)); }
            if (Math.random() < 0.35) { this._set(b, 'bounce', rnd(1, 2)); }
          }
        }
        break;
      }
      case 'fly': {
        this._flyBrain(a, b, dt, env, animals);
        break;
      }
    }

    if (b.st === 'wander' || b.st === 'herd' || b.st === 'rest' || b.st === 'sleep' || b.st === 'swim' || b.st === 'shore') this._separate(a, b, dt, env, animals);

    // ambient calls
    if (b.sndT <= 0 && this.soundCool < -1.5) {
      const asleep = b.st === 'sleep';
      if (tr.id === 'krasue' && env.night) { if (this._sound(a, b, 0.55, 'ghost')) b.sndT = rnd(5, 10); }
      else if (!asleep && this._sound(a, b, 0.4)) {
        if (tr.sassy && Math.random() < 0.5) this._say(a, pick(SASS));
      } else b.sndT = rnd(1, 3);
    }

    b.neck = neck; b.neckW = neckW; b.lean = lean;
  }

  _decide(a, b, env, animals) {
    const tr = b.tr, P = b.pers;
    b.goal = null;
    b.other = null;
    // flyers in the air keep flying
    if (tr.fly === 'always' || tr.fly === 'float') {
      if (tr.fly === 'always' && b.flying && Math.random() < 0.12) { this._land(a, b); this._set(b, 'rest', rnd(3, 6)); return; }
      if (!b.flying) this._takeOff(a, b);
      this._set(b, 'fly', rnd(4, 9));
      return;
    }
    if (b.flying) {
      if (Math.random() < 0.5) { this._set(b, 'fly', rnd(3, 6)); return; }
      this._land(a, b);
    }
    // flood
    if (env.flood > 0.2) {
      if (tr.water) { this._set(b, 'swim', rnd(3, 7)); return; }
      if (!tr.monster && tr.fly !== 'sometimes') { this._set(b, 'shore', rnd(3, 6)); return; }
      if (tr.fly === 'sometimes') { this._takeOff(a, b); this._set(b, 'fly', rnd(4, 8)); return; }
    }
    // night: most things sleep, night creatures prowl
    if (env.night && !tr.nocturnal && !tr.monster && Math.random() < 0.8 - P.bold * 0.2) {
      this._set(b, 'sleep', rnd(5, 12));
      return;
    }
    const r = Math.random();
    // --- species specials
    if (tr.stalker && b.cool <= 0) {
      const p = this._nearest(a, animals, (o) => PREDATOR_PREY.suea(this._brain(o).tr) && !o.dead, 1600);
      if (p && r < 0.75) { this._set(b, 'stalk', rnd(6, 12), { other: p.o }); return; }
    }
    if (tr.lurker) {
      if (env.flood > 0.2 || r < 0.7) { this._set(b, 'lurk', rnd(4, 9)); return; }
    }
    if (tr.dog) {
      const m = this._nearest(a, animals, (o) => this._brain(o).tr.monster, 700)
        || this._nearest(a, env.puppets, (o) => o.kind === 'demon' || o.flyRole === 'monster', 600);
      if (m && r < 0.85) { this._set(b, 'bark', rnd(3, 6), { other: m.o, cool: 0 }); return; }
      const c = this._nearest(a, animals, (o) => { const t = this._brain(o).tr; return t.cat || t.herd === 'chicken'; }, 600);
      if (c && r < 0.25) { this._set(b, 'chase', rnd(2.5, 5), { other: c.o }); return; }
    }
    if (tr.fighter) {
      const f = this._nearest(a, animals, (o) => this._brain(o).tr.fighter, 450);
      if (f && r < 0.6 && b.cool <= 0) {
        const fb = this._brain(f.o);
        this._set(b, 'fight', rnd(5, 9), { other: f.o, cool: rnd(0.2, 0.8) });
        if (fb.st !== 'fight' && fb.st !== 'flee') this._set(fb, 'fight', rnd(5, 9), { other: a, cool: rnd(0.4, 1) });
        this._sound(a, b, 0.6);
        return;
      }
    }
    if (tr.sassy) {
      const pup = this._nearest(a, env.puppets, (o) => o.mode === 'planted', 450);
      if (pup && r < 0.2) { this._set(b, 'bite', rnd(3, 5), { other: pup.o, cool: 0 }); return; }
      if (r < 0.35) { this._set(b, 'zoomies', rnd(2.5, 4.5)); this._sound(a, b, 0.6); return; }
      if (r < 0.55) { this._set(b, 'bounce', rnd(1.5, 3)); if (Math.random() < 0.5) { this._sound(a, b, 0.55); this._say(a, pick(SASS)); } return; }
    }
    if (tr.pester) {
      const pup = this._nearest(a, env.puppets, null, 650);
      if (pup && r < 0.4) { this._set(b, 'pester', rnd(5, 9), { other: pup.o }); return; }
    }
    if (tr.fly === 'sometimes' && r < 0.12) { this._takeOff(a, b); this._set(b, 'fly', rnd(4, 8)); return; }
    // babies stay close to mum
    if (tr.mother) {
      const m = this._nearest(a, animals, (o) => tr.mother.includes(o.def && o.def.id));
      if (m && (m.d > 160 || Math.random() < 0.6)) { this._set(b, 'follow', rnd(3, 7), { other: m.o }); return; }
    }
    // herd cohesion
    if (tr.herd) {
      let n = 0, sx = 0;
      for (const o of animals) {
        if (o === a || Math.abs(o.z - a.z) > 0.3) continue;
        if (this._brain(o).tr.herd !== tr.herd) continue;
        n++; sx += o.root.x;
      }
      if (n) {
        const cx = sx / n;
        const spread = 120 + 60 * n;
        if (Math.abs(cx - a.root.x) > spread && Math.random() < 0.8) {
          // head for the near side of the group, not into the middle of it
          const side = Math.sign(a.root.x - cx) || 1;
          this._set(b, 'herd', rnd(2, 5), { goal: cx + side * (halfW(a) + 60 + rnd(0, spread * 0.5)) });
          return;
        }
      }
    }
    // curiosity: sniff at a puppet that's standing still
    if (P.curious > 0.35 && Math.random() < 0.25 * P.curious && !tr.monster && tr.diet !== 'predator') {
      const pup = this._nearest(a, env.puppets, (o) => o.walkAmt < 0.1 && o.mode === 'planted', 550);
      if (pup) { this._set(b, 'curious', rnd(3, 6), { other: pup.o }); return; }
    }
    // everyday life
    const lazy = P.lazy;
    const q = Math.random();
    if (env.storm || env.rain) {
      if (q < 0.6) { this._set(b, 'rest', rnd(2, 5)); return; }
    }
    if (tr.diet === 'grazer' && q < 0.45) { this._set(b, 'graze', rnd(3, 8)); return; }
    if (tr.diet === 'omnivore' && q < 0.3) { this._set(b, 'graze', rnd(2, 5)); return; }
    if (q < 0.45 + lazy * 0.2) { this._set(b, Math.random() < lazy * 0.5 ? 'rest' : 'idle', rnd(1.5, 4)); return; }
    let goal = a.root.x + rnd(-450, 450) * (tr.speed < 30 ? 0.3 : 1);
    if (tr.herd) {
      // wander, but not away from the herd
      const m = this._nearest(a, animals, (o) => this._brain(o).tr.herd === tr.herd);
      if (m && Math.abs(goal - m.o.root.x) > 400) goal = m.o.root.x + rnd(-200, 200);
    }
    this._set(b, 'wander', rnd(3, 8), { goal: clamp(goal, env.minX, env.maxX) });
  }

  _pounce(a, b, prey, anim, dash) {
    if (!this._play(a, anim)) return;
    b.dir = Math.sign(prey.root.x - a.root.x) || a.facing;
    this._set(b, 'pounce', 9);
    b.lock = dash;
    b.other = prey;
    this.stats.attacks++;
    this._sound(a, b, 0.8);
    // the prey notices
    const pb = this.brains.get(prey);
    if (pb && pb.tr.timid > 0.05 && pb.st !== 'flee') { this._set(pb, 'flee', rnd(2, 4), { fleeX: a.root.x }); this.stats.flees++; }
  }

  // Keep a little personal space inside a herd.
  _separate(a, b, dt, env, animals) {
    const n = this._nearest(a, animals, (o) => o.mode !== 'hung');
    if (!n) return;
    const minD = (halfW(a) + halfW(n.o)) * 0.75;
    if (n.d < minD) {
      const dir = Math.sign(a.root.x - n.o.root.x) || (Math.random() < 0.5 ? -1 : 1);
      a.target.x = clamp(a.target.x + dir * b.tr.speed * 0.8 * dt, env.minX, env.maxX);
    }
  }

  // ---------------------------------------------------------- flying
  _takeOff(a, b) {
    if (b.flying && a.mode === 'hung') return;
    b.flying = true;
    const tr = b.tr;
    const alt = tr.fly === 'float' ? rnd(120, 240) : tr.fly === 'always' ? rnd(220, 420) : rnd(180, 340);
    b.flyY = a.standY() - alt;
    if (a.mode !== 'hung') { a.target.y = a.root.y; a.setMode('hung'); }
  }

  _land(a, b) { b.flying = false; b.flyY = null; }

  _flyBrain(a, b, dt, env, animals) {
    const tr = b.tr;
    if (!b.flying) this._takeOff(a, b);
    if (b.goal == null || this._walk(a, b, b.goal, tr.fly === 'float' ? tr.speed : tr.speed * 1.4, dt, env)) {
      b.goal = clamp(a.root.x + rnd(-700, 700), env.minX, env.maxX);
      const alt = tr.fly === 'float' ? rnd(110, 240) : rnd(200, 440);
      b.flyY = a.standY() - alt;
    }
    // garuda hunts nagas; the dragon just shows off
    if (tr.id === 'khrut') {
      const n = this._nearest(a, animals, (o) => o.def && o.def.id === 'phaya-nak', 900);
      if (n) { b.goal = n.o.root.x; if (n.d < 200) b.flyY = n.o.root.y - 80; }
    }
  }

  // ---------------------------------------------------------- fish
  _fish(a, b, dt, env) {
    const inWater = env.flood > 0.2;
    if (inWater) {
      const surf = this._worldY(env.waterCloth, a.z);
      const bottom = a.standY();
      const top = Math.min(bottom, surf + 25 + halfW(a) * 0.2);
      if (a.mode !== 'hung') { a.target.y = a.root.y; a.setMode('hung'); }
      if (b.st !== 'swimf' || b.t <= 0) {
        this._set(b, 'swimf', rnd(2, 6), { goal: clamp(a.root.x + rnd(-500, 500), env.minX, env.maxX), swimY: rnd(top, bottom) });
      }
      const threat = this._threat(a, b, env, this.animals || []);
      const fast = threat != null;
      if (fast) b.goal = clamp(a.root.x + Math.sign(a.root.x - threat) * 300, env.minX, env.maxX);
      if (this._walk(a, b, b.goal, fast ? b.tr.run : b.tr.speed, dt, env)) b.t = 0;
      b.swimY = clamp(b.swimY, top, bottom);
      const want = b.swimY + Math.sin(b.phase * 2.2) * 10;
      const prevY = a.target.y;
      a.target.y = ease(a.target.y, want, 1.5, dt);
      a.target.lean = ease(a.target.lean, clamp((a.target.y - prevY) / Math.max(dt, 1e-3) * 0.004, -0.3, 0.3) + Math.sin(b.phase * 5) * 0.04, 5, dt);
      b.yOff = 0; b.hop = null;
      if (b.sndT <= 0) { if (Math.random() < 0.3) this._sound(a, b, 0.3, 'splash'); else b.sndT = rnd(10, 20); }
      return;
    }
    // stranded: flop about
    if (a.mode === 'hung') {
      a.target.y += 500 * dt;
      if (a.target.y >= a.standY() - 2) a.plantAt(a.target.x);
      return;
    }
    if (b.st !== 'flop') this._set(b, 'flop', 0, {});
    if (!b.hop && b.t <= 0) {
      this._hop(b, rnd(18, 36), rnd(0.25, 0.35));
      b.t = rnd(0.5, 1.6);
      b.flopLean = rnd(-0.5, 0.5);
      a.target.x = clamp(a.target.x + rnd(-25, 25), env.minX, env.maxX);
      if (Math.random() < 0.3) this._face(a, a.root.x - a.facing);
    }
    b.lean = b.hop ? b.flopLean || 0 : 0;
    b.neck = 0; b.neckW = 0;
  }

  // ---------------------------------------------------------- the body
  // Turn the brain's wishes (hop, crouch, lean, head, swim, flight) into
  // puppet targets.
  _body(a, b, dt, env) {
    const tr = b.tr;
    // hop arc
    let yOff = b.st === 'stalk' ? b.yOff : 0;
    if (b.hop) {
      b.hop.t += dt;
      const u = b.hop.t / b.hop.dur;
      if (u >= 1) b.hop = null;
      else yOff -= Math.sin(u * Math.PI) * b.hop.h;
    }
    if (b.st !== 'stalk') b.yOff = 0;
    a.target.lean = ease(a.target.lean || 0, b.lean, 6, dt);
    // head / neck drive through the finger-control layer
    if (a.sem && a.sem.neck) {
      a.ctrl.neck = ease(a.ctrl.neck || 0, b.neck, 4, dt);
      a.ctrlW = ease(a.ctrlW || 0, b.neckW, 3, dt);
    }
    if (tr.water === 'fish') {
      if (a.mode === 'planted') a.target.y = a.standY() + yOff;
      return;
    }
    if (b.flying) {
      if (a.mode !== 'hung') a.setMode('hung');
      const bob = Math.sin(b.phase * (tr.fly === 'float' ? 1.3 : 2.1)) * (tr.fly === 'float' ? 22 : 14);
      const want = (b.flyY ?? a.standY() - 250) + bob;
      a.target.y = ease(a.target.y, want, 1.4, dt);
      if (tr.fly === 'float') a.target.lean = Math.sin(b.phase * 0.9) * 0.08;
      return;
    }
    // non-flyers left dangling (dropped high): drift back down
    if (a.mode === 'hung') {
      a.target.y += 420 * dt;
      if (a.target.y >= a.standY() - 2) a.plantAt(a.target.x);
      return;
    }
    let y = a.standY() + yOff;
    // swimming: float at the water surface when the flood is deep enough
    if (tr.water && env.flood > 0.2) {
      const surf = this._worldY(env.waterCloth, a.z);
      const bob = Math.sin(b.phase * (tr.sassy ? 3.2 : 2)) * (tr.sassy ? 8 : 5);
      const fy = surf + 4 + bob + yOff * 0.5;
      if (fy < y) y = ease(a.target.y, fy, 3, dt);
    }
    a.target.y = y;
  }
}
