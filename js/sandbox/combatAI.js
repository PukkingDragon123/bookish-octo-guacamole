// ศิลปะการต่อสู้ — how a deva-worked fighter thinks.
//
// Picks a worthy foe (other fighters, monsters, demons, whoever is
// attacking, the puppet you drive) instead of chopping at dancers; keeps
// to the reach of its weapon; reads the foe's wind-up to block or step out
// of range; punishes the moment after a foe's swing; chooses a target on
// the body — the head and neck first, then the trunk, or a limb that is
// already torn half through — picks the cut that reaches it (overhead chop,
// thrust, low sweep, downward stab at a fallen foe) and guides the weapon
// hand onto that point through the swing; backs off when badly hurt.

import { ANIMS, fill } from '../puppet/animations.js';
import { Puppet } from '../puppet/puppet.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const k = (t, j, root = {}) => ({ t, j, root });

function add(name, def) {
  if (ANIMS[name]) return;
  ANIMS[name] = def;
  fill(def);
}

// low sweeping cut at the legs
add('sweep', {
  th: 'ฟันต่ำ', en: 'Low sweep', duration: 0.9, fadeIn: 0.08, fadeOut: 0.3,
  attack: [0.3, 0.55], attackPower: 1.2, events: [{ t: 0.28, sfx: 'swish' }],
  keys: [
    k(0.0, { shoulderF: -100, elbowF: -60, shoulderB: 20, hipF: -30, kneeF: 40, hipB: 20, kneeB: 40, neck: 10 }, { dx: -10, dy: 20, lean: -6 }),
    k(0.25, { shoulderF: -150, elbowF: -40, shoulderB: 30, hipF: -40, kneeF: 60, hipB: 24, kneeB: 50, neck: 12 }, { dx: -18, dy: 40, lean: -10 }),
    k(0.42, { shoulderF: -20, elbowF: -5, shoulderB: 40, hipF: -55, kneeF: 70, hipB: 30, kneeB: 60, neck: 22 }, { dx: 40, dy: 70, lean: 26 }),
    k(0.6, { shoulderF: 10, elbowF: -5, shoulderB: 40, hipF: -52, kneeF: 66, hipB: 30, kneeB: 58, neck: 20 }, { dx: 44, dy: 66, lean: 24 }),
    k(0.9, { shoulderF: -12, elbowF: -12, shoulderB: 5, hipF: -5, kneeF: 5, hipB: 5, kneeB: 5, neck: 0 }, { dx: 0, dy: 0, lean: 0 }),
  ],
});
// downward stab at a foe on the ground
add('stab-down', {
  th: 'แทงลง', en: 'Finishing stab', duration: 1.0, fadeIn: 0.1, fadeOut: 0.3,
  attack: [0.38, 0.62], attackPower: 1.7, events: [{ t: 0.36, sfx: 'whoosh' }],
  keys: [
    k(0.0, { shoulderF: -150, elbowF: -80, shoulderB: 10, hipF: -20, kneeF: 20, hipB: 10, kneeB: 20, neck: 20 }, { dx: 0, dy: 10, lean: 10 }),
    k(0.3, { shoulderF: -175, elbowF: -100, shoulderB: 20, hipF: -30, kneeF: 30, hipB: 15, kneeB: 30, neck: 25 }, { dx: 10, dy: 20, lean: 14 }),
    k(0.46, { shoulderF: -60, elbowF: -10, shoulderB: 30, hipF: -60, kneeF: 80, hipB: 30, kneeB: 70, neck: 35 }, { dx: 50, dy: 90, lean: 38 }),
    k(0.66, { shoulderF: -50, elbowF: -8, shoulderB: 30, hipF: -60, kneeF: 80, hipB: 30, kneeB: 70, neck: 35 }, { dx: 52, dy: 92, lean: 40 }),
    k(1.0, { shoulderF: -12, elbowF: -12, shoulderB: 5, hipF: -5, kneeF: 5, hipB: 5, kneeB: 5, neck: 0 }, { dx: 0, dy: 0, lean: 0 }),
  ],
});
// quick step back out of reach
add('evade', {
  th: 'หลบ', en: 'Evade', duration: 0.55, fadeIn: 0.05, fadeOut: 0.2, commit: true,
  events: [{ t: 0.02, sfx: 'swish' }],
  keys: [
    k(0.0, { shoulderF: -40, elbowF: -60, shoulderB: 10, hipF: -10, kneeF: 20, hipB: 20, kneeB: 30, neck: -10 }, { dx: 0, dy: 10, lean: -12 }),
    k(0.25, { shoulderF: -60, elbowF: -80, shoulderB: 20, hipF: 10, kneeF: 40, hipB: 30, kneeB: 50, neck: -14 }, { dx: -70, dy: -20, lean: -18 }),
    k(0.55, { shoulderF: -20, elbowF: -30, shoulderB: 5, hipF: -5, kneeF: 10, hipB: 5, kneeB: 10, neck: 0 }, { dx: -90, dy: 0, lean: -4 }),
  ],
});

const HOSTILE_ROLES = new Set(['fighter', 'monster']);
const partHp = (b) => (b.hp == null ? 1 : b.hp / b.hpMax);

function weaponOf(p) {
  const w = p.held && (p.held.handF || p.held.handB);
  return w && w.def && w.def.weapon ? w : null;
}

function reach(p) {
  const w = weaponOf(p);
  const len = w ? Math.hypot(w.def.sprite.w, w.def.sprite.h) * 0.8 : 0;
  return p.height * 0.28 + len;
}

// threat / worthiness of a foe for this fighter
function score(me, role, o, game) {
  if (o.dead || o.removed || !o.root) return -1;
  const d = Math.abs(o.root.x - me.root.x);
  let s = 0;
  if (HOSTILE_ROLES.has(o.flyRole)) s += 3;
  if (o.kind === 'demon' || o.kind === 'monster' || o.def?.cat === 'monsters') s += 2.5;
  if (o.attacking > 0 || (o.anim && o.anim.def.attack)) s += 2;
  if (o === game.selected && o.controller !== me.controller) s += 1.5;
  if (o._lastAttacker === me) s += 3; // it hit me: settle it
  if (role === 'monster') s += 1.2; // monsters attack anyone
  else if (s === 0) return -1;      // warriors don't cut down dancers and merchants
  if (o.isAnimal && role !== 'monster' && !o.def?.cat?.includes('monster')) s -= 1.5;
  if (o.mode === 'ragdoll' || o.stun > 0.5) s += 0.8; // press the advantage
  return s - d / 600;
}

// where on the foe to aim: [part body, world point, kind of cut]
function chooseAim(me, foe, souls) {
  const L = foe.rig.limbs || {};
  const head = foe.bodies[L.head || 'head'];
  const root = foe.root;
  const down = foe.mode === 'ragdoll' || foe.stun > 0.6;
  const cands = [];
  for (const b of foe.parts) {
    if (b.isRod) continue;
    let w = souls ? souls.vitality(foe, b) : b === head ? 1.8 : b === root ? 1.25 : 1;
    const hp = partHp(b);
    if (hp < 0.45) w += 1.2 * (1 - hp); // finish a half-torn limb
    if (foe.blocking > 0.4 && b.y < root.y - 20) w *= 0.35; // guarded high line: go low
    w *= 0.7 + Math.random() * 0.6;
    cands.push([w, b]);
  }
  cands.sort((a, b) => b[0] - a[0]);
  const b = (cands[0] || [0, head || root])[1];
  const pt = [b.x, b.y];
  const shoulder = me.root.y - me.height * 0.18;
  const cut = down ? 'stab-down' : pt[1] < shoulder - 20 ? 'strike' : pt[1] > me.root.y + me.height * 0.12 ? 'sweep' : 'lunge';
  return { body: b, pt, cut };
}

export function fight(fly, p, dt, game, say = () => {}) {
  const S = game.scene;
  const c = (fly.combat ||= { aim: null, guideT: 0, feint: 0 });
  const others = S.actors.filter((o) => o !== p && o instanceof Puppet && !o.removed && Math.abs(o.z - p.z) < 0.08);
  let foe = null, best = -0.5;
  for (const o of others) {
    const s = score(p, fly.role, o, game);
    if (s > best) { best = s; foe = o; }
  }
  // stickiness: keep the current foe unless a much better one appears
  if (c.foe && c.foe !== foe && !c.foe.dead && !c.foe.removed && others.includes(c.foe) && score(p, fly.role, c.foe, game) > best - 1) foe = c.foe;
  c.foe = foe;
  if (!foe) {
    // on guard: patrol slowly, weapon ready
    releaseGuide(p, c);
    if (fly.goal == null || fly._walk(p, fly.goal, 60, dt)) fly.goal = 200 + Math.random() * (S.worldW - 400);
    return;
  }
  const dx = foe.root.x - p.root.x, dist = Math.abs(dx), dir = Math.sign(dx) || 1;
  const R = reach(p), foeR = reach(foe);
  fly._face(p, foe.root.x);
  const myHp = partHp(p.root);
  const hurt = (p.dmg?.soul && (p.dmg.lost > 80 || myHp < 0.4)) || myHp < 0.25;

  // --- read the foe
  const fa = foe.anim && !foe.anim.stopping ? foe.anim : null;
  const winding = fa && fa.def.attack && fa.t < fa.def.attack[0];
  const recovering = fa && fa.def.attack && fa.t > fa.def.attack[1] + 0.05; // just swung: open
  const threatened = winding && dist < foeR * 1.25;

  // --- footwork: hold at the edge of my reach (or further when hurt)
  const want = hurt ? Math.max(R, foeR) * 1.5 : R * (fly.cool > 0.3 ? 1.05 : 0.85);
  if (!p.isBusy()) {
    if (dist > want + 25) fly._walk(p, foe.root.x - dir * want, fly.role === 'monster' ? 170 : 150, dt);
    else if (dist < want * 0.6) fly._walk(p, p.root.x - dir * 60, 110, dt);
  }

  // --- defence
  if (threatened && !p.isBusy()) {
    const r = Math.random();
    if (r < (hurt ? 0.45 : 0.55)) { p.play('block', { hold: false }); fly.cool = Math.max(fly.cool, 0.25); }
    else if (r < 0.85 && ANIMS.evade) { p.play('evade'); fly.cool = Math.max(fly.cool, 0.3); }
    c.guideT = 0;
    releaseGuide(p, c);
    return;
  }

  // --- attack: punish a foe that just swung, or when my timer allows
  const inRange = dist <= R * 1.15;
  if (!p.isBusy() && inRange && (recovering || fly.cool <= 0) && !hurt) {
    c.aim = chooseAim(p, foe, game.souls);
    // occasional feint: start high, then cut low
    if (Math.random() < 0.15 && c.aim.cut === 'strike' && foe.blocking < 0.3) { p.play('block'); c.feint = 0.35; }
    else {
      p.play(c.aim.cut);
      c.guideT = ANIMS[c.aim.cut]?.duration || 1;
    }
    fly.cool = (fly.role === 'monster' ? 0.6 : 0.8) + Math.random() * 0.9;
    if (Math.random() < 0.25) say('fight');
  } else if (!p.isBusy() && hurt && fly.cool <= 0) {
    // wounded: keep the guard up, lash out only when cornered
    if (dist < foeR) p.play(Math.random() < 0.5 ? 'block' : 'lunge');
    if (Math.random() < 0.3) say('flee');
    fly.cool = 1 + Math.random();
  } else if (!p.isBusy() && dist > R * 2.2 && fly.cool <= 0 && Math.random() < dt * 1.5 && !hurt) {
    // closing leap
    p.play('leap');
    fly.cool = 1.2;
  } else if (fly.role === 'monster' && !p.isBusy() && fly.cool <= 0 && Math.random() < dt * 0.4) {
    p.play('roar');
    fly.cool = 1;
  }
  if (c.feint > 0) {
    c.feint -= dt;
    if (c.feint <= 0 && !p.isBusy()) { p.stopAnim(); c.aim = { ...chooseAim(p, foe, game.souls), cut: 'sweep' }; p.play('sweep'); c.guideT = 0.9; }
  }

  // --- guide the weapon hand onto the aimed point through the swing
  if (c.guideT > 0 && c.aim && p.anim && p.anim.def.attack && p.pins.handF) {
    c.guideT -= dt;
    const an = p.anim, [a0, a1] = an.def.attack;
    const b = c.aim.body;
    if (b && foe.parts.includes(b)) { c.aim.pt[0] = b.x; c.aim.pt[1] = b.y; }
    const w = weaponOf(p);
    const ext = w ? Math.hypot(w.def.sprite.w, w.def.sprite.h) * 0.55 : 0;
    const tx = c.aim.pt[0] - dir * ext, ty = c.aim.pt[1] - (c.aim.cut === 'stab-down' ? ext * 0.6 : 0);
    const u = an.t < a0 - 0.12 ? 0 : an.t < a1 ? clamp((an.t - (a0 - 0.12)) / 0.15, 0, 1) : 0;
    if (u > 0) p.pullLimb('handF', tx, ty, 0.55 * u);
    else releaseGuide(p, c);
  } else releaseGuide(p, c);
}

function releaseGuide(p, c) {
  if (p.pins?.handF?.enabled && !p.pins.handF.fade) p.releaseLimb('handF');
}
