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

// Leg vocabulary for the classical dances (canonical degrees).
const STANCE = { hipF: -22, kneeF: 28, hipB: 16, kneeB: -2 };     // ย่อ: soft knees, feet under the body
const HEEL = { hipF: -40, kneeF: 16, hipB: 18, kneeB: 4 };        // ก้าวเท้า: heel placed forward
const KRADOK = { hipF: -16, kneeF: 26, hipB: 26, kneeB: 80 };     // กระดกเท้า: back foot flicked up
const YOK = { hipF: -60, kneeF: 84, hipB: 14, kneeB: 0 };         // ยกเท้า: front knee raised
const DIP = { hipF: -38, kneeF: 56, hipB: 4, kneeB: 30 };         // ยุบ: deep knee dip
const JARD = { hipF: -30, kneeF: 20, hipB: 12, kneeB: 8 };        // จรดเท้า: front toe touches
// Classical dance defaults: spline keys, soft drives (follow-through lag
// without letting arms sag: droop ~ g / (r w^2) ~ 5 deg at w = 12).
const RAM = { loop: true, fadeIn: 0.5, fadeOut: 0.6, smooth: true, omega: 12 };

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
    th: 'รำ', en: 'Thai dance', duration: 4.0, loop: true, fadeIn: 0.5, fadeOut: 0.6, swap: 'jeeb', smooth: true, omega: 12,
    sway: { period: 1.0, dy: 5, knee: 6, lean: 2, neck: 3 },
    keys: [
      k(0.0, { shoulderF: -75, elbowF: -65, wristF: 35, shoulderB: -20, elbowB: -55, wristB: 35, ...STANCE, neck: 8 }, { dy: 16, lean: 4 }),
      k(1.0, { shoulderF: -130, elbowF: -55, wristF: 42, shoulderB: 30, elbowB: -30, wristB: 35, ...YOK, neck: -6 }, { dx: 8, dy: 12, lean: -3 }),
      k(2.0, { shoulderF: -65, elbowF: -80, wristF: 30, shoulderB: -95, elbowB: -60, wristB: 40, ...DIP, neck: 10 }, { dx: 0, dy: 24, lean: 5 }),
      k(3.0, { shoulderF: -30, elbowF: -70, wristF: 38, shoulderB: -140, elbowB: -50, wristB: 45, ...KRADOK, neck: -8 }, { dx: -8, dy: 12, lean: -4 }),
      k(4.0, { shoulderF: -75, elbowF: -65, wristF: 35, shoulderB: -20, elbowB: -55, wristB: 35, ...STANCE, neck: 8 }, { dy: 16, lean: 4 }),
    ],
  },
  wong: {
    th: 'ท่าตั้งวง ยกเท้า', en: 'Tang-wong pose', duration: 3.0, holdAt: 1.0, fadeIn: 0.45, fadeOut: 0.6, swap: 'wong', smooth: true, omega: 12,
    events: [{ t: 0.7, sfx: 'magic' }],
    keys: [
      k(0.0, { shoulderF: -70, elbowF: -60, wristF: 30, shoulderB: 20, elbowB: -30, wristB: 35, ...STANCE, neck: 4 }, { dy: 10, lean: 2 }),
      k(1.0, { shoulderF: -98, elbowF: -70, wristF: 45, shoulderB: 45, elbowB: -15, wristB: 45, hipF: -60, kneeF: 90, hipB: 12, kneeB: 24, neck: -6 }, { dy: 14, lean: 4 }),
      k(2.2, { shoulderF: -98, elbowF: -70, wristF: 45, shoulderB: 45, elbowB: -15, wristB: 45, hipF: -60, kneeF: 90, hipB: 12, kneeB: 24, neck: -6 }, { dy: 14, lean: 4 }),
      k(3.0, { shoulderF: -10, elbowF: -18, wristF: 0, shoulderB: 5, elbowB: -12, wristB: 0, hipF: -4, kneeF: 5, hipB: 4, kneeB: 5, neck: 0 }, {}),
    ],
  },
  // ---------------------------------------------------------- ท่ารำ
  // Classical Thai dance (แม่ท่า / ท่ารำ). Wrists bent back (ตั้งวง),
  // elbows never locked, arms rising through วงล่าง / วงกลาง / วงบน,
  // ยืดยุบ knee-dips on the beat (sway), heel steps and กระดกเท้า.
  'ram-theppranom': {
    th: 'เทพประนม', en: 'Deva in prayer', duration: 4.8, ...RAM,
    sway: { period: 1.2, dy: 6, knee: 8, lean: 2, neck: 3 },
    keys: [
      k(0.0, { shoulderF: -40, elbowF: -112, wristF: 10, shoulderB: -38, elbowB: -105, wristB: 10, ...STANCE, neck: 10 }, { dy: 16, lean: 3 }),
      k(1.2, { shoulderF: -50, elbowF: -116, wristF: 16, shoulderB: -48, elbowB: -106, wristB: 16, hipF: -16, kneeF: 22, hipB: 14, kneeB: 24, neck: -4 }, { dy: 6, lean: -2 }),
      k(2.4, { shoulderF: -36, elbowF: -108, wristF: 8, shoulderB: -34, elbowB: -102, wristB: 8, ...HEEL, neck: 14 }, { dx: 8, dy: 22, lean: 8 }),
      k(3.6, { shoulderF: -46, elbowF: -114, wristF: 14, shoulderB: -44, elbowB: -105, wristB: 14, ...KRADOK, neck: 2 }, { dx: 4, dy: 10, lean: 5 }),
      k(4.8, { shoulderF: -40, elbowF: -112, wristF: 10, shoulderB: -38, elbowB: -105, wristB: 10, ...STANCE, neck: 10 }, { dy: 16, lean: 3 }),
    ],
  },
  'ram-phromsina': {
    th: 'ปฐมพรหมสี่หน้า', en: 'Four-faced Brahma', duration: 5.6, ...RAM,
    sway: { period: 1.4, dy: 5, knee: 6, lean: 2, neck: 3 },
    keys: [
      k(0.0, { shoulderF: -100, elbowF: -60, wristF: 40, shoulderB: -92, elbowB: -62, wristB: 40, ...STANCE, neck: 6 }, { dy: 14, lean: 3 }),
      k(1.4, { shoulderF: -150, elbowF: -55, wristF: 42, shoulderB: -140, elbowB: -60, wristB: 45, ...JARD, neck: -8 }, { dx: 6, dy: 6, lean: -3 }),
      k(2.8, { shoulderF: -148, elbowF: -60, wristF: 40, shoulderB: -138, elbowB: -64, wristB: 42, ...DIP, neck: 8 }, { dx: 0, dy: 30, lean: 4 }),
      k(4.2, { shoulderF: -145, elbowF: -58, wristF: 42, shoulderB: -50, elbowB: -45, wristB: 45, ...KRADOK, neck: -6 }, { dx: -4, dy: 10, lean: -2 }),
      k(5.6, { shoulderF: -100, elbowF: -60, wristF: 40, shoulderB: -92, elbowB: -62, wristB: 40, ...STANCE, neck: 6 }, { dy: 14, lean: 3 }),
    ],
  },
  'ram-sodsoi': {
    th: 'สอดสร้อยมาลา', en: 'Threading the garland', duration: 5.2, ...RAM, swap: 'jeeb',
    sway: { period: 1.3, dy: 5, knee: 6, lean: 2, neck: 3 },
    keys: [
      k(0.0, { shoulderF: -40, elbowF: -118, wristF: 30, shoulderB: -150, elbowB: -55, wristB: 40, ...HEEL, neck: 8 }, { dy: 16, lean: 4 }),
      k(1.3, { shoulderF: -95, elbowF: -80, wristF: 12, shoulderB: -110, elbowB: -70, wristB: 35, ...STANCE, neck: 2 }, { dx: 4, dy: 20, lean: 2 }),
      k(2.6, { shoulderF: -150, elbowF: -50, wristF: 36, shoulderB: 42, elbowB: -18, wristB: 35, ...KRADOK, neck: -8 }, { dx: 8, dy: 10, lean: -4 }),
      k(3.9, { shoulderF: -100, elbowF: -70, wristF: 38, shoulderB: -30, elbowB: -60, wristB: 30, ...DIP, neck: 6 }, { dx: 4, dy: 26, lean: 5 }),
      k(5.2, { shoulderF: -40, elbowF: -118, wristF: 30, shoulderB: -150, elbowB: -55, wristB: 40, ...HEEL, neck: 8 }, { dy: 16, lean: 4 }),
    ],
  },
  'ram-kinnorn': {
    th: 'กินนรเลียบถ้ำ', en: 'Kinnari by the cave', duration: 5.0, ...RAM,
    sway: { period: 1.25, dy: 5, knee: 6, lean: 2, neck: 3 },
    keys: [
      k(0.0, { shoulderF: -85, elbowF: -32, wristF: 40, shoulderB: 38, elbowB: -22, wristB: 42, ...STANCE, neck: -4 }, { dy: 14, lean: 6 }),
      k(1.25, { shoulderF: -112, elbowF: -38, wristF: 45, shoulderB: 58, elbowB: -26, wristB: 45, ...HEEL, neck: -8 }, { dx: 10, dy: 8, lean: 4 }),
      k(2.5, { shoulderF: -70, elbowF: -42, wristF: 36, shoulderB: 26, elbowB: -32, wristB: 38, ...KRADOK, neck: 6 }, { dx: 20, dy: 24, lean: 9 }),
      k(3.75, { shoulderF: -110, elbowF: -36, wristF: 45, shoulderB: 55, elbowB: -24, wristB: 45, ...JARD, neck: -6 }, { dx: 10, dy: 10, lean: 5 }),
      k(5.0, { shoulderF: -85, elbowF: -32, wristF: 40, shoulderB: 38, elbowB: -22, wristB: 42, ...STANCE, neck: -4 }, { dy: 14, lean: 6 }),
    ],
  },
  'ram-chanee': {
    th: 'ชะนีร่ายไม้', en: 'Gibbon swinging through the trees', duration: 4.4, ...RAM, swap: 'jeeb',
    sway: { period: 1.1, dy: 5, knee: 6, lean: 2, neck: 3 },
    keys: [
      k(0.0, { shoulderF: -158, elbowF: -38, wristF: 40, shoulderB: 45, elbowB: -16, wristB: 28, ...KRADOK, neck: -10 }, { dy: 10, lean: -3 }),
      k(1.1, { shoulderF: -115, elbowF: -62, wristF: 32, shoulderB: -35, elbowB: -50, wristB: 30, ...DIP, neck: 6 }, { dx: 6, dy: 24, lean: 4 }),
      k(2.2, { shoulderF: 38, elbowF: -24, wristF: 30, shoulderB: -158, elbowB: -38, wristB: 42, ...HEEL, neck: -10 }, { dx: 10, dy: 12, lean: -3 }),
      k(3.3, { shoulderF: -60, elbowF: -80, wristF: 32, shoulderB: -110, elbowB: -60, wristB: 38, ...DIP, neck: 6 }, { dx: 4, dy: 24, lean: 4 }),
      k(4.4, { shoulderF: -158, elbowF: -38, wristF: 40, shoulderB: 45, elbowB: -16, wristB: 28, ...KRADOK, neck: -10 }, { dy: 10, lean: -3 }),
    ],
  },
  'ram-kwang': {
    th: 'กวางเดินดง', en: 'Deer walking the forest', duration: 4.0, ...RAM, swap: 'jeeb',
    sway: { period: 1.0, dy: 4, knee: 5, lean: 2, neck: 2 },
    keys: [
      k(0.0, { shoulderF: -120, elbowF: -70, wristF: 28, shoulderB: 30, elbowB: -36, wristB: 40, ...YOK, neck: -4 }, { dy: 10, lean: 6 }),
      k(1.0, { shoulderF: -104, elbowF: -80, wristF: 34, shoulderB: 22, elbowB: -40, wristB: 42, ...DIP, neck: 8 }, { dx: 10, dy: 24, lean: 5 }),
      k(2.0, { shoulderF: -126, elbowF: -64, wristF: 26, shoulderB: 36, elbowB: -30, wristB: 40, ...KRADOK, neck: -4 }, { dx: 18, dy: 12, lean: 8 }),
      k(3.0, { shoulderF: -104, elbowF: -80, wristF: 34, shoulderB: 22, elbowB: -40, wristB: 42, ...DIP, neck: 8 }, { dx: 8, dy: 24, lean: 5 }),
      k(4.0, { shoulderF: -120, elbowF: -70, wristF: 28, shoulderB: 30, elbowB: -36, wristB: 40, ...YOK, neck: -4 }, { dy: 10, lean: 6 }),
    ],
  },
  'ram-phala': {
    th: 'ผาลาเพียงไหล่', en: 'Plough at shoulder height', duration: 4.8, ...RAM,
    sway: { period: 1.2, dy: 5, knee: 6, lean: 2, neck: 3 },
    keys: [
      k(0.0, { shoulderF: -95, elbowF: -60, wristF: 40, shoulderB: 72, elbowB: 4, wristB: 45, ...STANCE, neck: 2 }, { dy: 14, lean: 2 }),
      k(1.2, { shoulderF: -78, elbowF: -30, wristF: 45, shoulderB: 58, elbowB: -6, wristB: 42, ...HEEL, neck: 10 }, { dx: 12, dy: 22, lean: 8 }),
      k(2.4, { shoulderF: -110, elbowF: -86, wristF: 34, shoulderB: 82, elbowB: 8, wristB: 45, ...KRADOK, neck: -6 }, { dx: 4, dy: 8, lean: -2 }),
      k(3.6, { shoulderF: -90, elbowF: -45, wristF: 42, shoulderB: 66, elbowB: 0, wristB: 44, ...JARD, neck: 6 }, { dx: 8, dy: 20, lean: 5 }),
      k(4.8, { shoulderF: -95, elbowF: -60, wristF: 40, shoulderB: 72, elbowB: 4, wristB: 45, ...STANCE, neck: 2 }, { dy: 14, lean: 2 }),
    ],
  },
  'ram-nakha': {
    th: 'นาคาม้วนหาง', en: 'Naga curling its tail', duration: 5.6, ...RAM,
    sway: { period: 1.4, dy: 5, knee: 6, lean: 3, neck: 3 },
    keys: [
      k(0.0, { shoulderF: -80, elbowF: -40, wristF: 40, shoulderB: 30, elbowB: -30, wristB: 32, ...STANCE, neck: 2 }, { dy: 14, lean: 2 }),
      k(1.4, { shoulderF: -130, elbowF: -30, wristF: 22, shoulderB: -20, elbowB: -60, wristB: 36, ...JARD, neck: -10 }, { dx: 6, dy: 6, lean: -6 }),
      k(2.8, { shoulderF: -150, elbowF: -90, wristF: 45, shoulderB: 20, elbowB: -40, wristB: 36, ...STANCE, neck: 4 }, { dx: 4, dy: 20, lean: 2 }),
      k(4.2, { shoulderF: -60, elbowF: -100, wristF: 32, shoulderB: 45, elbowB: -20, wristB: 40, ...KRADOK, neck: 12 }, { dx: 10, dy: 26, lean: 8 }),
      k(5.6, { shoulderF: -80, elbowF: -40, wristF: 40, shoulderB: 30, elbowB: -30, wristB: 32, ...STANCE, neck: 2 }, { dy: 14, lean: 2 }),
    ],
  },
  'ram-lokaew': {
    th: 'ล่อแก้ว', en: 'Luring the crystal', duration: 4.6, ...RAM, swap: 'jeeb',
    sway: { period: 1.15, dy: 4, knee: 5, lean: 2, neck: 3 },
    keys: [
      k(0.0, { shoulderF: -86, elbowF: -26, wristF: 20, shoulderB: -150, elbowB: -50, wristB: 40, ...HEEL, neck: 6 }, { dx: 12, dy: 16, lean: 8 }),
      k(1.15, { shoulderF: -58, elbowF: -112, wristF: 30, shoulderB: -140, elbowB: -58, wristB: 42, ...KRADOK, neck: -8 }, { dx: -8, dy: 8, lean: -4 }),
      k(2.3, { shoulderF: -66, elbowF: -26, wristF: 12, shoulderB: -150, elbowB: -50, wristB: 40, ...JARD, neck: 8 }, { dx: 14, dy: 22, lean: 10 }),
      k(3.45, { shoulderF: -120, elbowF: -90, wristF: 34, shoulderB: -135, elbowB: -60, wristB: 42, ...STANCE, neck: -6 }, { dx: -4, dy: 8, lean: -3 }),
      k(4.6, { shoulderF: -86, elbowF: -26, wristF: 20, shoulderB: -150, elbowB: -50, wristB: 40, ...HEEL, neck: 6 }, { dx: 12, dy: 16, lean: 8 }),
    ],
  },
  'ram-mangkorn': {
    th: 'มังกรเรียงหาง', en: 'Dragon aligning its tail', duration: 5.2, ...RAM,
    sway: { period: 1.3, dy: 5, knee: 6, lean: 3, neck: 3 },
    keys: [
      k(0.0, { shoulderF: -100, elbowF: -32, wristF: 40, shoulderB: -72, elbowB: -32, wristB: 40, ...STANCE, neck: 4 }, { dy: 20, lean: 10 }),
      k(1.3, { shoulderF: -122, elbowF: -45, wristF: 44, shoulderB: -92, elbowB: -42, wristB: 44, ...HEEL, neck: -6 }, { dx: 12, dy: 10, lean: 4 }),
      k(2.6, { shoulderF: -80, elbowF: -26, wristF: 36, shoulderB: -56, elbowB: -26, wristB: 38, ...KRADOK, neck: 10 }, { dx: 20, dy: 28, lean: 14 }),
      k(3.9, { shoulderF: -112, elbowF: -40, wristF: 44, shoulderB: -86, elbowB: -38, wristB: 44, ...JARD, neck: -4 }, { dx: 8, dy: 12, lean: 6 }),
      k(5.2, { shoulderF: -100, elbowF: -32, wristF: 40, shoulderB: -72, elbowB: -32, wristB: 40, ...STANCE, neck: 4 }, { dy: 20, lean: 10 }),
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
// forward, then backward for joints first mentioned later). A loop's
// closing key inherits anything it leaves out from the opening key, so the
// seam matches.
function fill(def) {
  const joints = new Set();
  for (const key of def.keys) Object.keys(key.j).forEach((n) => joints.add(n));
  if (def.loop && def.keys.length > 1) {
    const f = def.keys[0], l = def.keys[def.keys.length - 1];
    l.j = { ...f.j, ...l.j };
    l.root = { dx: 0, dy: 0, lean: 0, ...f.root, ...l.root };
  }
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
for (const def of Object.values(ANIMS)) fill(def);

// รำชุด: a long loop chaining several แม่ท่า (each dance's keys minus its
// seam key, back to back, closing on the first dance's opening pose).
function chain(ids, extra) {
  const keys = [];
  let t0 = 0;
  for (const id of ids) {
    const d = ANIMS[id];
    for (const key of d.keys.slice(0, -1)) keys.push({ ...key, t: key.t + t0, j: { ...key.j }, root: { ...key.root } });
    t0 += d.duration;
  }
  const f = keys[0];
  keys.push({ ...f, t: t0, j: { ...f.j }, root: { ...f.root } });
  return { ...RAM, ...extra, duration: t0, keys };
}
ANIMS['ram-medley'] = chain(['ram-theppranom', 'ram-sodsoi', 'ram-chanee', 'ram-phromsina', 'ram-kinnorn', 'ram-lokaew', 'ram-nakha'], {
  th: 'รำชุด', en: 'Dance suite', swap: 'jeeb',
});
{
  // a whole number of sway cycles so the long loop's seam is seamless
  const M = ANIMS['ram-medley'];
  M.sway = { period: M.duration / (2 * Math.round(M.duration / 2.4)), dy: 5, knee: 6, lean: 2, neck: 3 };
  fill(M);
}

// Dance repertoire (for the dancer stagehand and menus).
export const RAM_DANCES = Object.keys(ANIMS).filter((n) => n.startsWith('ram-') && n !== 'ram-medley');


const ease = (t) => t * t * (3 - 2 * t);

// Smooth (def.smooth) sampling: a time-parameterised Catmull-Rom spline
// through the keys (cubic Hermite, tangent at key i = slope between its two
// neighbours), so a dance flows through its poses instead of easing to a
// stop at every key. Loops wrap their neighbours across the seam (the last
// key is expected to repeat the first); one-shots start and end at rest.
// A key whose value equals a neighbour's (a held pose) gets a flat tangent
// so holds don't overshoot.
function splineSetup(def) {
  const keys = def.keys, n = keys.length, dur = def.duration;
  const loop = !!def.loop && n > 2;
  const neighbour = (i, d) => {
    // key i+d with time, wrapping for loops (skipping the duplicate seam key)
    let m = i + d, off = 0;
    if (loop) {
      if (m < 0) { m += n - 1; off = -dur; }
      else if (m > n - 1) { m -= n - 1; off = dur; }
    }
    if (m < 0 || m > n - 1) return null;
    return { key: keys[m], t: keys[m].t + off };
  };
  const tangent = (i, get) => {
    const a = neighbour(i, -1), b = neighbour(i, 1), v = get(keys[i]);
    if (!a || !b) return 0;
    const va = get(a.key), vb = get(b.key);
    if (va == null || vb == null || v == null) return 0;
    if (Math.abs(va - v) < 1e-6 || Math.abs(vb - v) < 1e-6 || keys[i].hold) return 0;
    // monotone-ish: flat at local extrema would stall; keep Catmull-Rom but
    // limit the slope so a segment never overshoots by more than ~25%
    let m = (vb - va) / Math.max(1e-6, b.t - a.t);
    const s1 = (v - va) / Math.max(1e-6, keys[i].t - a.t), s2 = (vb - v) / Math.max(1e-6, b.t - keys[i].t);
    const lim = 3 * Math.max(Math.abs(s1), Math.abs(s2));
    return Math.max(-lim, Math.min(lim, m));
  };
  const chans = [...def.joints.map((jn) => [jn, (k) => k.j[jn]]), ...['dx', 'dy', 'lean'].map((r) => ['@' + r, (k) => k.root[r]])];
  def._tan = keys.map((_, i) => Object.fromEntries(chans.map(([c, g]) => [c, tangent(i, g)])));
  // a loop's seam keys share one tangent
  if (loop) def._tan[n - 1] = def._tan[0];
}

const hermite = (va, vb, ma, mb, u, h) => {
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * va + (u3 - 2 * u2 + u) * h * ma + (-2 * u3 + 3 * u2) * vb + (u3 - u2) * h * mb;
};

// def.sway: a continuous rhythmic overlay on top of the keys
//   period: seconds per beat (ยืดยุบ knee-dip once per beat)
//   dy / knee: dip depth (root down, both knees bend, thighs come forward)
//   lean / neck / dx: ยักตัว side-sway, once per 2 beats (leanPeriod)
function applySway(def, t, j, root) {
  const S = def.sway;
  const T = S.period || 1;
  // one-shots ease the rhythm in and out so they still end at rest
  const env = def.loop ? 1 : ease(Math.min(1, t / 0.6, Math.max(0, def.duration - t) / 0.8));
  const dip = env * (0.5 - 0.5 * Math.cos((2 * Math.PI * (t + (S.phase || 0))) / T)); // 0..1..0 per beat
  const ph = (2 * Math.PI * (t + (S.phase || 0))) / (S.leanPeriod || T * 2);
  root.dy += dip * (S.dy || 0);
  const sw = env * Math.sin(ph);
  root.lean += sw * (S.lean || 0);
  root.dx += sw * (S.dx || 0);
  if (S.knee) {
    for (const [kn, hn] of [['kneeF', 'hipF'], ['kneeB', 'hipB']]) {
      if (j[kn] != null) j[kn] += dip * S.knee;
      if (j[hn] != null) j[hn] -= dip * S.knee * 0.5;
    }
  }
  if (S.neck && j.neck != null) j.neck -= sw * S.neck; // head tilts against the lean
}

export function sampleAnim(def, t) {
  const keys = def.keys;
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const lin = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
  const j = {};
  let root;
  if (def.smooth) {
    if (!def._tan) splineSetup(def);
    const ib = Math.min(i + 1, keys.length - 1);
    const ta = def._tan[i], tb = def._tan[ib], h = b.t - a.t;
    for (const n of def.joints) {
      const va = a.j[n], vb = b.j[n];
      if (va == null && vb == null) continue;
      j[n] = va == null ? vb : vb == null ? va : hermite(va, vb, ta[n], tb[n], lin, h);
    }
    root = {
      dx: hermite(a.root.dx, b.root.dx, ta['@dx'], tb['@dx'], lin, h),
      dy: hermite(a.root.dy, b.root.dy, ta['@dy'], tb['@dy'], lin, h),
      lean: hermite(a.root.lean, b.root.lean, ta['@lean'], tb['@lean'], lin, h),
    };
  } else {
    const u = ease(lin);
    for (const n of def.joints) {
      const va = a.j[n], vb = b.j[n];
      if (va == null && vb == null) continue;
      j[n] = va == null ? vb : vb == null ? va : va + (vb - va) * u;
    }
    root = {
      dx: a.root.dx + (b.root.dx - a.root.dx) * u,
      dy: a.root.dy + (b.root.dy - a.root.dy) * u,
      lean: a.root.lean + (b.root.lean - a.root.lean) * u,
    };
  }
  if (def.sway) applySway(def, t, j, root);
  if (def.shake && t > def.shake[0] && t < def.shake[1]) {
    root.lean += Math.sin(t * 70) * def.shake[2];
    root.dx += Math.sin(t * 53) * def.shake[2] * 0.6;
  }
  // per-key hand sprite (e.g. 'jeeb' / 'wong' / null) for rigs that swap hands
  const sw = t - a.t < (b.t - a.t) * 0.5 ? a : b;
  const swap = 'swap' in sw ? sw.swap : undefined;
  return swap === undefined ? { j, root } : { j, root, swap };
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
