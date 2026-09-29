// Special moves as keyframed, rig-independent joint targets.
//
// Angles are canonical degrees for a figure facing right:
//   shoulder/hip: limb axis vs the torso's down axis. 0 = hanging straight
//                 down, -90 = pointing forward, -180 = straight up,
//                 positive = swung backwards.
//   elbow: forearm vs upper arm, 0 straight, negative = flexed forward/up.
//   knee:  shin vs thigh, 0 straight, positive = bent (shin goes back).
//   wrist: negative = flexed forward, positive = bent back (Thai dance).
//   neck:  positive = nod forward/down, negative = look up.
//   jaw:   positive = open.
// root: { dx: forward offset, dy: down offset, lean: degrees, + = forward }
// The physics keeps running underneath: these are drive targets, so limbs
// lag, swing and collide naturally.

const k = (t, j, root = {}, extra = {}) => ({ t, j, root, ...extra });

export const ANIMS = {
  strike: {
    th: 'ฟันดาบ', en: 'Sword strike', duration: 0.95, fadeIn: 0.1, fadeOut: 0.3,
    attack: [0.3, 0.52], attackPower: 1.3,
    events: [{ t: 0.28, sfx: 'whoosh' }],
    keys: [
      k(0.0, { shoulderF: -140, elbowF: -45, wristF: 0, shoulderB: 20, elbowB: -30, hipF: -10, kneeF: 12, hipB: 10, kneeB: 12, neck: -5 }, { dx: -12, lean: -8 }),
      k(0.26, { shoulderF: -178, elbowF: -70, shoulderB: 30, hipF: -8, kneeF: 16, hipB: 14, kneeB: 18, neck: -10 }, { dx: -24, lean: -15 }),
      k(0.38, { shoulderF: -50, elbowF: -8, shoulderB: 40, hipF: -38, kneeF: 22, hipB: 22, kneeB: 26, neck: 10 }, { dx: 42, dy: 12, lean: 18 }),
      k(0.56, { shoulderF: -18, elbowF: 0, shoulderB: 35, hipF: -36, kneeF: 22, hipB: 24, kneeB: 26, neck: 12 }, { dx: 48, dy: 14, lean: 20 }),
      k(0.95, { shoulderF: -10, elbowF: -12, shoulderB: 5, hipF: -5, kneeF: 5, hipB: 5, kneeB: 5, neck: 0 }, { dx: 0, dy: 0, lean: 0 }),
    ],
  },
  lunge: {
    th: 'แทง', en: 'Lunge', duration: 1.05, fadeIn: 0.1, fadeOut: 0.3,
    attack: [0.28, 0.6], attackPower: 1.5,
    events: [{ t: 0.26, sfx: 'swish' }],
    keys: [
      k(0.0, { shoulderF: -70, elbowF: -85, shoulderB: 10, elbowB: -40, hipF: -30, kneeF: 45, hipB: 15, kneeB: 30, neck: 0 }, { dx: -18, dy: 22, lean: 5 }),
      k(0.2, { shoulderF: -75, elbowF: -95, shoulderB: 20, hipF: -34, kneeF: 55, hipB: 18, kneeB: 36 }, { dx: -26, dy: 30, lean: 6 }),
      k(0.36, { shoulderF: -94, elbowF: 0, wristF: 0, shoulderB: 45, elbowB: -10, hipF: -58, kneeF: 24, hipB: 48, kneeB: 5, neck: 6 }, { dx: 125, dy: 20, lean: 14 }),
      k(0.64, { shoulderF: -92, elbowF: -4, shoulderB: 45, hipF: -58, kneeF: 26, hipB: 46, kneeB: 6, neck: 6 }, { dx: 130, dy: 22, lean: 14 }),
      k(1.05, { shoulderF: -12, elbowF: -12, shoulderB: 5, elbowB: -10, hipF: -4, kneeF: 5, hipB: 4, kneeB: 5, neck: 0 }, { dx: 0, dy: 0, lean: 0 }),
    ],
  },
  block: {
    th: 'ปัดป้อง', en: 'Block', duration: 0.7, holdAt: 0.35, fadeIn: 0.07, fadeOut: 0.25, block: true,
    events: [{ t: 0.05, sfx: 'swish' }],
    keys: [
      k(0.0, { shoulderF: -100, elbowF: -80, shoulderB: -30, elbowB: -60, hipF: -12, kneeF: 16, hipB: 16, kneeB: 16, neck: -10 }, { dx: -14, lean: -10 }),
      k(0.35, { shoulderF: -118, elbowF: -96, shoulderB: -40, elbowB: -70, hipF: -14, kneeF: 20, hipB: 18, kneeB: 20, neck: -12 }, { dx: -20, dy: 6, lean: -12 }),
      k(0.7, { shoulderF: -20, elbowF: -20, shoulderB: 0, elbowB: -10, hipF: 0, kneeF: 5, hipB: 0, kneeB: 5, neck: 0 }, { dx: 0, lean: 0 }),
    ],
  },
  dance: {
    th: 'รำ', en: 'Thai dance', duration: 3.2, loop: true, fadeIn: 0.35, fadeOut: 0.5, swap: 'jeeb', stiffScale: 1.6,
    keys: [
      k(0.0, { shoulderF: -70, elbowF: -70, wristF: 35, shoulderB: -20, elbowB: -60, wristB: 35, hipF: -25, kneeF: 35, hipB: 22, kneeB: 35, neck: 8 }, { dy: 18, lean: 4 }),
      k(0.8, { shoulderF: -130, elbowF: -60, wristF: 45, shoulderB: 25, elbowB: -50, wristB: 30, hipF: -48, kneeF: 72, hipB: 20, kneeB: 30, neck: -6 }, { dx: 10, dy: 14, lean: -4 }),
      k(1.6, { shoulderF: -60, elbowF: -85, wristF: 30, shoulderB: -100, elbowB: -70, wristB: 40, hipF: -20, kneeF: 30, hipB: 26, kneeB: 42, neck: 10 }, { dx: 0, dy: 22, lean: 6 }),
      k(2.4, { shoulderF: -22, elbowF: -95, wristF: 40, shoulderB: -140, elbowB: -50, wristB: 45, hipF: -30, kneeF: 40, hipB: 38, kneeB: 64, neck: -8 }, { dx: -10, dy: 14, lean: -5 }),
      k(3.2, { shoulderF: -70, elbowF: -70, wristF: 35, shoulderB: -20, elbowB: -60, wristB: 35, hipF: -25, kneeF: 35, hipB: 22, kneeB: 35, neck: 8 }, { dy: 18, lean: 4 }),
    ],
  },
  wong: {
    th: 'ท่าตั้งวง ยกเท้า', en: 'Tang-wong pose', duration: 2.6, holdAt: 0.7, fadeIn: 0.3, fadeOut: 0.5, swap: 'wong',
    events: [{ t: 0.5, sfx: 'magic' }],
    keys: [
      k(0.0, { shoulderF: -80, elbowF: -70, wristF: 35, shoulderB: 20, elbowB: -35, wristB: 40, hipF: -35, kneeF: 55, hipB: 10, kneeB: 20, neck: 0 }, { dy: 10, lean: 2 }),
      k(0.7, { shoulderF: -98, elbowF: -78, wristF: 48, shoulderB: 32, elbowB: -42, wristB: 48, hipF: -62, kneeF: 90, hipB: 10, kneeB: 22, neck: -6 }, { dy: 12, lean: 3 }),
      k(2.0, { shoulderF: -98, elbowF: -78, wristF: 48, shoulderB: 32, elbowB: -42, wristB: 48, hipF: -62, kneeF: 90, hipB: 10, kneeB: 22, neck: -6 }, { dy: 12, lean: 3 }),
      k(2.6, { shoulderF: -10, elbowF: -15, wristF: 0, shoulderB: 5, elbowB: -10, wristB: 0, hipF: -4, kneeF: 5, hipB: 4, kneeB: 5, neck: 0 }, {}),
    ],
  },
  wai: {
    th: 'ไหว้', en: 'Wai (greeting)', duration: 2.3, holdAt: 0.6, fadeIn: 0.25, fadeOut: 0.4,
    keys: [
      k(0.0, { shoulderF: -40, elbowF: -110, wristF: -15, shoulderB: -40, elbowB: -110, wristB: -15, neck: 0 }, {}),
      k(0.6, { shoulderF: -52, elbowF: -122, wristF: -20, shoulderB: -52, elbowB: -122, wristB: -20, neck: 20, hipF: -8, kneeF: 12, hipB: 6, kneeB: 12 }, { lean: 10, dy: 10 }),
      k(1.7, { shoulderF: -52, elbowF: -122, wristF: -20, shoulderB: -52, elbowB: -122, wristB: -20, neck: 20, hipF: -8, kneeF: 12, hipB: 6, kneeB: 12 }, { lean: 10, dy: 10 }),
      k(2.3, { shoulderF: -10, elbowF: -20, wristF: 0, shoulderB: -8, elbowB: -18, wristB: 0, neck: 0, hipF: 0, kneeF: 4, hipB: 0, kneeB: 4 }, {}),
    ],
  },
  leap: {
    th: 'กระโดด', en: 'Leap', duration: 1.15, fadeIn: 0.08, fadeOut: 0.25, commit: true,
    events: [{ t: 0.22, sfx: 'jump' }, { t: 0.8, sfx: 'step' }],
    keys: [
      k(0.0, { hipF: -40, kneeF: 70, hipB: -15, kneeB: 70, shoulderF: 20, elbowF: -30, shoulderB: 25, elbowB: -30, neck: 8 }, { dy: 40, lean: 10 }),
      k(0.18, { hipF: -45, kneeF: 80, hipB: -18, kneeB: 80, shoulderF: 30, shoulderB: 35 }, { dy: 52, lean: 12 }),
      k(0.42, { hipF: -75, kneeF: 105, hipB: -40, kneeB: 95, shoulderF: -150, elbowF: -30, shoulderB: -120, elbowB: -30, neck: -8 }, { dx: 50, dy: -200, lean: -6 }),
      k(0.64, { hipF: -35, kneeF: 45, hipB: 10, kneeB: 30, shoulderF: -110, shoulderB: -60 }, { dx: 80, dy: -70, lean: 4 }),
      k(0.82, { hipF: -42, kneeF: 72, hipB: -10, kneeB: 62, shoulderF: -30, elbowF: -40, shoulderB: 10, elbowB: -30, neck: 10 }, { dx: 85, dy: 42, lean: 10 }),
      k(1.15, { hipF: -4, kneeF: 5, hipB: 4, kneeB: 5, shoulderF: -10, elbowF: -12, shoulderB: 5, elbowB: -10, neck: 0 }, { dx: 85, dy: 0, lean: 0 }),
    ],
  },
  roar: {
    th: 'คำราม', en: 'Demon roar', duration: 1.7, fadeIn: 0.15, fadeOut: 0.35, shake: [0.35, 1.25, 5],
    events: [{ t: 0.12, sfx: 'roar' }],
    keys: [
      k(0.0, { shoulderF: -120, elbowF: -60, shoulderB: -110, elbowB: -60, neck: -18, jaw: 30, hipF: -20, kneeF: 22, hipB: 26, kneeB: 22 }, { lean: -12, dy: 12 }),
      k(0.32, { shoulderF: -160, elbowF: -30, shoulderB: -150, elbowB: -30, neck: -26, jaw: 38, hipF: -26, kneeF: 26, hipB: 30, kneeB: 24 }, { lean: -18, dy: 6 }),
      k(1.25, { shoulderF: -160, elbowF: -35, shoulderB: -150, elbowB: -35, neck: -26, jaw: 38, hipF: -26, kneeF: 26, hipB: 30, kneeB: 24 }, { lean: -18, dy: 6 }),
      k(1.7, { shoulderF: -10, elbowF: -12, shoulderB: -5, elbowB: -10, neck: 0, jaw: 0, hipF: 0, kneeF: 4, hipB: 0, kneeB: 4 }, {}),
    ],
  },
  laugh: {
    th: 'หัวเราะ', en: 'Laugh', duration: 1.8, fadeIn: 0.12, fadeOut: 0.3,
    keys: [
      k(0.0, { shoulderF: -35, elbowF: -100, shoulderB: -30, elbowB: -90, neck: 18, jaw: 28 }, { lean: 16, dy: 10 }),
      k(0.18, { neck: 6, jaw: 10 }, { lean: 6, dy: 0 }),
      k(0.36, { neck: 22, jaw: 30 }, { lean: 20, dy: 12 }),
      k(0.54, { neck: 6, jaw: 10 }, { lean: 6, dy: 0 }),
      k(0.72, { neck: 22, jaw: 30 }, { lean: 20, dy: 12 }),
      k(0.9, { neck: 6, jaw: 10 }, { lean: 6, dy: 0 }),
      k(1.08, { neck: 22, jaw: 30 }, { lean: 22, dy: 12 }),
      k(1.8, { shoulderF: -10, elbowF: -15, shoulderB: -5, elbowB: -10, neck: 0, jaw: 0 }, {}),
    ],
  },
  bow: {
    th: 'คำนับ', en: 'Bow', duration: 1.7, fadeIn: 0.2, fadeOut: 0.35,
    keys: [
      k(0.0, { shoulderF: -25, elbowF: -50, shoulderB: -20, elbowB: -50, neck: 10 }, { lean: 8 }),
      k(0.55, { shoulderF: -35, elbowF: -70, shoulderB: -30, elbowB: -70, neck: 28, hipF: -12, kneeF: 14, hipB: 8, kneeB: 14 }, { lean: 32, dy: 14 }),
      k(1.15, { shoulderF: -35, elbowF: -70, shoulderB: -30, elbowB: -70, neck: 28, hipF: -12, kneeF: 14, hipB: 8, kneeB: 14 }, { lean: 32, dy: 14 }),
      k(1.7, { shoulderF: -10, elbowF: -15, shoulderB: -5, elbowB: -10, neck: 0, hipF: 0, kneeF: 4, hipB: 0, kneeB: 4 }, {}),
    ],
  },
  hit: {
    th: 'โดนตี', en: 'Hit reaction', duration: 0.65, fadeIn: 0.03, fadeOut: 0.3, commit: true,
    keys: [
      k(0.0, { shoulderF: 30, elbowF: -30, shoulderB: 45, elbowB: -20, neck: -22, hipF: -25, kneeF: 20, hipB: 10, kneeB: 25 }, { dx: -30, dy: 6, lean: -20 }),
      k(0.25, { shoulderF: 40, elbowF: -15, shoulderB: 55, elbowB: -10, neck: -25, hipF: -30, kneeF: 22, hipB: 12, kneeB: 28 }, { dx: -48, dy: 10, lean: -24 }),
      k(0.65, { shoulderF: -8, elbowF: -12, shoulderB: 5, elbowB: -10, neck: 0, hipF: -4, kneeF: 6, hipB: 4, kneeB: 6 }, { dx: -48, dy: 0, lean: 0 }),
    ],
  },
  wave: {
    th: 'โบกมือ', en: 'Wave', duration: 1.8, fadeIn: 0.2, fadeOut: 0.35,
    keys: [
      k(0.0, { shoulderF: -140, elbowF: -30, wristF: 10, neck: -5 }, { lean: -2 }),
      k(0.3, { shoulderF: -150, elbowF: -60, wristF: 30 }, {}),
      k(0.6, { shoulderF: -150, elbowF: -15, wristF: -10 }, {}),
      k(0.9, { shoulderF: -150, elbowF: -60, wristF: 30 }, {}),
      k(1.2, { shoulderF: -150, elbowF: -15, wristF: -10 }, {}),
      k(1.8, { shoulderF: -10, elbowF: -15, wristF: 0, neck: 0 }, {}),
    ],
  },
  point: {
    th: 'ชี้', en: 'Point', duration: 1.4, holdAt: 0.35, fadeIn: 0.15, fadeOut: 0.3,
    keys: [
      k(0.0, { shoulderF: -80, elbowF: -30, wristF: 0, neck: -4 }, { lean: 4 }),
      k(0.35, { shoulderF: -96, elbowF: -2, wristF: -5, neck: -6 }, { lean: 6, dx: 6 }),
      k(1.0, { shoulderF: -96, elbowF: -2, wristF: -5, neck: -6 }, { lean: 6, dx: 6 }),
      k(1.4, { shoulderF: -10, elbowF: -15, wristF: 0, neck: 0 }, {}),
    ],
  },
  cheer: {
    th: 'ดีใจ', en: 'Cheer', duration: 1.6, fadeIn: 0.15, fadeOut: 0.3,
    keys: [
      k(0.0, { shoulderF: -160, elbowF: -20, shoulderB: -150, elbowB: -20, neck: -12, jaw: 20 }, { dy: 0, lean: -4 }),
      k(0.25, { shoulderF: -170, elbowF: -40, shoulderB: -160, elbowB: -40, hipF: -20, kneeF: 30, hipB: -10, kneeB: 30 }, { dy: -40, lean: -6 }),
      k(0.5, { shoulderF: -155, elbowF: -15, shoulderB: -145, elbowB: -15, hipF: -10, kneeF: 25, hipB: 0, kneeB: 25 }, { dy: 14, lean: -2 }),
      k(0.75, { shoulderF: -170, elbowF: -40, shoulderB: -160, elbowB: -40, hipF: -20, kneeF: 30, hipB: -10, kneeB: 30 }, { dy: -40, lean: -6 }),
      k(1.0, { shoulderF: -155, elbowF: -15, shoulderB: -145, elbowB: -15, hipF: -10, kneeF: 25, hipB: 0, kneeB: 25 }, { dy: 14 }),
      k(1.6, { shoulderF: -10, elbowF: -12, shoulderB: -5, elbowB: -10, neck: 0, jaw: 0, hipF: 0, kneeF: 4, hipB: 0, kneeB: 4 }, {}),
    ],
  },
  flee: {
    th: 'วิ่งหนี', en: 'Panic', duration: 1.2, loop: true, fadeIn: 0.1, fadeOut: 0.3,
    keys: [
      k(0.0, { shoulderF: -160, elbowF: -40, shoulderB: -140, elbowB: -30, neck: -15, jaw: 30 }, { lean: 14 }),
      k(0.3, { shoulderF: -130, elbowF: -70, shoulderB: -170, elbowB: -20, neck: -10, jaw: 20 }, { lean: 16, dy: -6 }),
      k(0.6, { shoulderF: -170, elbowF: -30, shoulderB: -130, elbowB: -60, neck: -18, jaw: 32 }, { lean: 14 }),
      k(0.9, { shoulderF: -140, elbowF: -60, shoulderB: -160, elbowB: -25, neck: -12, jaw: 22 }, { lean: 16, dy: -6 }),
      k(1.2, { shoulderF: -160, elbowF: -40, shoulderB: -140, elbowB: -30, neck: -15, jaw: 30 }, { lean: 14 }),
    ],
  },
  beckon: {
    th: 'เรียกลูกค้า', en: 'Beckon', duration: 2.0, fadeIn: 0.2, fadeOut: 0.35,
    keys: [
      k(0.0, { shoulderF: -80, elbowF: -60, wristF: 0, neck: -4, jaw: 15 }, { lean: 6 }),
      k(0.35, { shoulderF: -85, elbowF: -115, wristF: -30 }, { lean: 8 }),
      k(0.7, { shoulderF: -80, elbowF: -60, wristF: 10 }, { lean: 6 }),
      k(1.05, { shoulderF: -85, elbowF: -115, wristF: -30 }, { lean: 8 }),
      k(1.4, { shoulderF: -80, elbowF: -60, wristF: 10 }, { lean: 6 }),
      k(2.0, { shoulderF: -10, elbowF: -15, wristF: 0, neck: 0, jaw: 0 }, {}),
    ],
  },
  hop: {
    th: 'กระโดดเล่น', en: 'Hop', duration: 0.7, any: true, humanoid: false, fadeIn: 0.05, fadeOut: 0.2,
    keys: [
      k(0.0, {}, { dy: 12 }),
      k(0.25, {}, { dy: -70, lean: -6 }),
      k(0.5, {}, { dy: 6 }),
      k(0.7, {}, { dy: 0 }),
    ],
  },
};

// Fill every key with every joint the animation touches (carrying values
// forward, then backward for joints first mentioned later).
for (const def of Object.values(ANIMS)) {
  const joints = new Set();
  for (const key of def.keys) Object.keys(key.j).forEach((n) => joints.add(n));
  let prevJ = {}, prevRoot = { dx: 0, dy: 0, lean: 0 };
  for (const key of def.keys) {
    key.j = { ...prevJ, ...key.j };
    key.root = { ...prevRoot, ...key.root };
    prevJ = key.j;
    prevRoot = key.root;
  }
  let next = {};
  for (let i = def.keys.length - 1; i >= 0; i--) {
    const key = def.keys[i];
    for (const n of joints) if (key.j[n] == null && next[n] != null) key.j[n] = next[n];
    next = key.j;
  }
  def.joints = [...joints];
}

const ease = (t) => t * t * (3 - 2 * t);

export function sampleAnim(def, t) {
  const keys = def.keys;
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const u = b.t > a.t ? ease(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)))) : 0;
  const j = {};
  for (const n of def.joints) {
    const va = a.j[n], vb = b.j[n];
    if (va == null && vb == null) continue;
    j[n] = va == null ? vb : vb == null ? va : va + (vb - va) * u;
  }
  const root = {
    dx: a.root.dx + (b.root.dx - a.root.dx) * u,
    dy: a.root.dy + (b.root.dy - a.root.dy) * u,
    lean: a.root.lean + (b.root.lean - a.root.lean) * u,
  };
  if (def.shake && t > def.shake[0] && t < def.shake[1]) {
    root.lean += Math.sin(t * 70) * def.shake[2];
    root.dx += Math.sin(t * 53) * def.shake[2] * 0.6;
  }
  return { j, root };
}

// Which move each hand gesture triggers.
export const GESTURE_MOVES = {
  fist: 'strike',
  point: 'lunge',
  open: 'block',
  jeeb: 'dance',
  wong: 'wong',
  victory: 'leap',
  horns: 'roar',
  thumbsUp: 'laugh',
};

// Keyboard shortcuts.
export const KEY_MOVES = {
  Digit1: 'strike', Digit2: 'lunge', Digit3: 'block', Digit4: 'dance', Digit5: 'wai',
  Digit6: 'leap', Digit7: 'roar', Digit8: 'laugh', Digit9: 'wong', Digit0: 'bow',
};
