// ฉากสำเร็จรูป — ready-made scenes. Choosing one clears the cloth, sets
// the light and the weather, then lays the scene out piece by piece:
// buildings rise in their scaffolding, trees and animals are summoned,
// and the cast arrives last and takes up their roles.

import { paintSprite, leather, dye, line, holes, dotLine, INK, poly, curve, ellipsePts } from '../art/leather.js';
import * as TIK from '../art/thaiIcons.js';

const TI = { ...TIK, poly };

// [id, x, z, opts] — x in cloth units (0..1600; wider scenes go beyond),
// opts: { f: facing, y, role, soul, ward, anim, dy }
export const SCENES = [
  {
    id: 'himmaphan', name: 'ป่าหิมพานต์', en: 'Himmaphan forest by moonlight', weather: ['night'], lamp: 'oil', icon: 'forest',
    items: [
      ['moon', 1320, 0.3, { y: 180 }],
      ['ton-yangna', 150, 0.06], ['forest-tree', 330, 0.1], ['ton-sai', 1420, 0.08], ['ton-pho', 1180, 0.14],
      ['ton-himmaphan', 780, 0.12], ['kor-phai', 60, 0.04], ['fern', 520, 0.03], ['fern', 1060, 0.03],
      ['lotus-pond', 900, 0.02], ['thao-wan', 460, 0.05, { y: 260 }], ['ya-kha', 240, 0.02], ['ya-kha', 1300, 0.02],
      ['kwang-thong', 640, 0.03], ['nok-yung', 1120, 0.03], ['kratai', 380, 0.02], ['khrut', 1000, 0.05, { y: 300 }],
      ['reusi', 300, 0.02, { f: 1, anim: 'wai' }], ['thewada', 760, 0.02, { f: -1, role: 'dancer' }],
    ],
  },
  {
    id: 'floating-market', name: 'ตลาดน้ำยามเช้า', en: 'Floating market at dawn', weather: ['dawn'], lamp: 'oil', icon: 'boat',
    items: [
      ['sun', 240, 0.3, { y: 200 }],
      ['ton-maphrao', 90, 0.08], ['ton-maphrao', 1500, 0.06], ['ton-kluai', 1330, 0.05], ['thai-house', 1200, 0.1],
      ['wave-band', 800, 0.015, { y: 900 }], ['rowing-boat', 420, 0.02, { y: 860 }], ['longtail-boat', 980, 0.025, { y: 870 }],
      ['banana-bunch', 400, 0.02, { y: 820 }], ['mango', 460, 0.02, { y: 820 }], ['durian', 1000, 0.02, { y: 830 }],
      ['rom-mae-kha', 640, 0.04],
      ['chaoban-woman', 360, 0.02, { f: 1, role: 'merchant' }], ['nang', 980, 0.02, { f: -1, role: 'merchant' }],
      ['chaoban-man', 700, 0.02, { f: -1, role: 'villager' }], ['dek', 1200, 0.02, { f: -1, role: 'wander' }],
      ['pet', 1400, 0.02], ['han', 150, 0.02],
    ],
  },
  {
    id: 'temple-fair', name: 'งานวัดยามค่ำ', en: 'Temple fair at dusk', weather: ['dusk'], lamp: 'oil', icon: 'temple',
    items: [
      ['ubosot', 1160, 0.12], ['chedi', 380, 0.16], ['spirit-house', 90, 0.04], ['ton-leelawadee', 1480, 0.05], ['ton-ratchaphruek', 620, 0.1],
      ['khom-loi', 300, 0.1, { y: 200 }], ['khom-loi', 900, 0.12, { y: 150 }], ['khom-loi', 1300, 0.1, { y: 230 }],
      ['fx-torch', 200, 0.02, { y: 800 }], ['fx-light-gold', 800, 0.25, { y: 380 }], ['fx-fire', 1440, 0.02, { y: 880 }],
      ['ranat-ek', 1330, 0.03, { y: 860 }], ['klong-that', 1220, 0.03, { y: 860 }],
      ['nang', 780, 0.02, { f: 1, role: 'dancer' }], ['phra', 560, 0.02, { f: 1, role: 'dancer' }],
      ['teng', 980, 0.02, { f: -1, role: 'comedian' }], ['nunui', 1100, 0.02, { f: -1, role: 'comedian' }],
      ['chaoban-woman', 250, 0.03, { role: 'merchant' }], ['dek', 440, 0.03, { role: 'villager' }], ['ma-thai', 1000, 0.03],
    ],
  },
  {
    id: 'lanka', name: 'ศึกกรุงลงกา', en: 'Battle of Lanka in the storm', weather: ['storm'], lamp: 'oil', icon: 'battle',
    items: [
      ['palace', 1250, 0.14], ['prang', 260, 0.18], ['forest-tree', 60, 0.06], ['ton-tan', 1540, 0.06],
      ['fx-fire', 520, 0.02, { y: 880 }], ['fx-fire', 1050, 0.03, { y: 880 }], ['fx-smoke', 800, 0.06, { y: 880 }],
      ['phra', 420, 0.02, { f: 1, role: 'fighter', soul: true, ward: true, hold: 'dab' }],
      ['hanuman', 640, 0.02, { f: 1, role: 'fighter', soul: true }],
      ['yak', 1080, 0.02, { f: -1, role: 'monster', soul: true, hold: 'ngao' }],
      ['phaya', 1300, 0.02, { f: -1, role: 'monster', soul: true, hold: 'dab-kap' }],
      ['krasue', 900, 0.06, { y: 300 }],
    ],
  },
  {
    id: 'rice-fields', name: 'ทุ่งนาบ้านเรา', en: 'Home in the rice fields', weather: [], lamp: 'oil', icon: 'buffalo',
    items: [
      ['sun', 1360, 0.3, { y: 190 }],
      ['thatched-hut', 1250, 0.1], ['yung-khao', 1480, 0.08], ['ton-tan', 120, 0.1], ['ton-tan', 260, 0.14], ['ton-mamuang', 960, 0.1],
      ['ton-khao', 380, 0.02], ['ton-khao', 520, 0.02], ['ton-khao', 660, 0.02], ['dong-ya', 820, 0.02], ['hun-lai-ka', 560, 0.03],
      ['kwai', 470, 0.04], ['luk-kwai', 330, 0.04], ['mae-kai', 1100, 0.02], ['luk-kai', 1160, 0.02], ['luk-kai', 1200, 0.02],
      ['ma-thai', 1320, 0.02], ['hippo', 760, 0.05], ['moo-deng', 880, 0.03],
      ['chaoban-man', 620, 0.02, { f: 1, role: 'wander' }], ['phuyaiphoon', 1040, 0.02, { f: -1, role: 'villager' }], ['dek', 1400, 0.02, { role: 'follower' }],
    ],
  },
  {
    id: 'moo-deng-pond', name: 'บึงหมูเด้ง', en: "Moo Deng's pond in the rain", weather: ['rain', 'flood'], lamp: 'oil', icon: 'hippo',
    items: [
      ['ton-pho', 1360, 0.12], ['ton-kluai', 180, 0.05], ['kor-phai', 60, 0.08], ['lotus-pond', 700, 0.02], ['kor-bua', 1000, 0.02],
      ['ya-kha', 420, 0.02], ['ya-kha', 1180, 0.02], ['fern', 1480, 0.03],
      ['hippo', 620, 0.04], ['moo-deng', 820, 0.02], ['pet', 1000, 0.02], ['han', 1120, 0.03], ['kop', 300, 0.02], ['tao', 480, 0.02],
      ['jorakhe', 1300, 0.04], ['pla-thong', 900, 0.03], ['pla-chon', 540, 0.03],
      ['dek', 240, 0.02, { f: 1, role: 'coward' }],
    ],
  },
  {
    id: 'village-games', name: 'ลานกีฬาหมู่บ้าน', en: 'Village games', weather: [], lamp: 'electric', icon: 'ball',
    items: [
      ['sala', 1480, 0.16], ['ton-hukwang', 60, 0.12], ['ton-mamuang', 1560, 0.1], ['phum-chaba', 820, 0.08], ['ya-kha', 380, 0.02], ['ya-kha', 1330, 0.02],
      ['jump-rope', 190, 0.02, { y: 820 }], ['takraw', 560, 0.02, { y: 700 }],
      ['pingpong-table', 1080, 0.02], ['pingpong-paddle', 960, 0.02, { y: 800 }], ['pingpong-paddle-blue', 1200, 0.02, { y: 800 }], ['pingpong-ball', 1080, 0.02, { y: 700 }],
      ['chaoban-woman', 190, 0.02, { f: 1, role: 'jumprope' }],
      ['aitho', 440, 0.02, { f: 1, role: 'takraw' }], ['dek', 680, 0.02, { f: -1, role: 'takraw' }],
      ['chaoban-man', 900, 0.02, { f: 1, role: 'pingpong' }], ['yodthong', 1260, 0.02, { f: -1, role: 'pingpong' }],
      ['ma-thai', 760, 0.04],
    ],
  },
];

const ICONS = {};
// Scene plaques: a gilded proscenium (art/thaiIcons.js) framing a little
// mural of the scene in จิตรกรรมฝาผนัง colours.
function icon(kind) {
  if (ICONS[kind]) return ICONS[kind];
  const T = TI, M = T.M;
  const cloths = {
    forest: [M.night, M.indigo, '#2d4a7a'], boat: ['#f6c58a', '#f3dcae', '#9cc4cf'], temple: [M.purpleD, M.rose, M.vermL],
    battle: ['#3a0d10', M.lac, M.verm], buffalo: [M.sky, '#d9ecd0', '#bfdc9a'], hippo: ['#7f9cc0', '#a9c5d6', '#c5dbe0'], ball: [M.goldL, M.cream, '#e9cf98'],
  };
  ICONS[kind] = paintSprite(140, 100, (ctx) => {
    T.sceneFrame(ctx, (g) => SCENE_ART[kind](g, T, M), { cloth: cloths[kind], band: kind === 'battle' || kind === 'temple' ? M.indigo : M.red });
  }, { name: 'scene-' + kind });
  return ICONS[kind];
}

const SCENE_ART = {
  forest(g, T, M) {
    // ป่าหิมพานต์ by moonlight: เขามอ rocks, mural trees, a golden deer
    for (const [x, y, r] of [[30, 38, 2.6], [52, 34, 2], [118, 44, 2.2], [76, 40, 1.8]]) T.star(g, x, y, r, { petal: M.goldL, core: null, punch: false });
    T.moon(g, 100, 42, 10);
    T.khaoMo(g, 100, 88, 44, 26, { seed: 3 });
    T.muralTree(g, 34, 88, 52, { seed: 4, flowers: M.goldL });
    T.muralTree(g, 120, 90, 40, { seed: 7, leaf: M.teal });
    // golden deer (กวางทอง) grazing
    const d = new Path2D();
    d.ellipse(70, 74, 11, 5.5, 0, 0, Math.PI * 2);
    T.shape(g, d, T.goldG(g, 58, 68, 82, 80), { w: 0.6 });
    T.shape(g, T.poly(T.tubePts([[78, 72], [84, 64], [88, 60]], [3, 2.4, 2])), M.gold, { w: 0.5 });
    T.shape(g, T.poly([[86, 58], [93, 60], [90, 63], [86, 63]]), M.gold, { w: 0.5 });
    for (const x of [62, 66, 74, 78]) T.stroke(g, T.lin([[x, 78], [x + (x < 70 ? -1 : 1), 87]]), M.goldD, 1.4);
    T.stroke(g, T.lin([[86, 58], [84, 52], [81, 50]]), M.goldD, 0.9); T.stroke(g, T.lin([[84, 53], [87, 50]]), M.goldD, 0.8);
    for (const [x, y] of [[66, 72], [72, 75], [76, 72]]) T.fill(g, T.circle(x, y, 1), M.cream);
    T.fill(g, T.poly([[0, 86], [140, 86], [140, 100], [0, 100]]), M.jadeD);
    for (let x = 16; x < 130; x += 8) T.stroke(g, T.lin([[x, 88], [x + 2, 83], [x + 4, 88]]), M.jade, 1);
  },
  boat(g, T, M) {
    // ตลาดน้ำ at dawn: sun, stilt house, a sampan with a hat-wearing vendor
    T.sun(g, 34, 46, 9, { rays: 14 });
    T.shape(g, T.poly([[96, 62], [110, 50], [124, 62]]), M.verm, { w: 0.6 });
    T.shape(g, T.poly([[98, 62], [122, 62], [122, 72], [98, 72]]), M.creamD, { w: 0.5 });
    for (const x of [100, 110, 120]) T.stroke(g, T.lin([[x, 72], [x, 82]]), M.brown, 1.4);
    T.muralTree(g, 128, 82, 34, { seed: 9 });
    T.waves(g, 10, 130, 76, { rows: 3, size: 9, cols: ['#6aa8c4', '#3f7fa8', M.indigo] });
    // sampan
    const hull = new Path2D();
    hull.moveTo(30, 74); hull.quadraticCurveTo(40, 84, 66, 84); hull.quadraticCurveTo(92, 84, 102, 72); hull.quadraticCurveTo(86, 78, 66, 78); hull.quadraticCurveTo(44, 78, 30, 74);
    T.shape(g, hull, T.vgrad(g, 72, 84, [M.brown, M.earthD]), { w: 0.7 });
    T.stroke(g, T.lin([[36, 77], [66, 80.5], [96, 76]]), M.gold, 0.9);
    // fruit heaps
    for (const [x, c] of [[46, M.gold], [52, M.verm], [80, M.jade], [86, M.gold]]) T.shape(g, T.circle(x, 75, 3.4), c, { w: 0.4 });
    // vendor in a งอบ hat
    T.shape(g, T.poly([[60, 77], [62, 66], [70, 66], [72, 77]]), M.indigo, { w: 0.5 });
    T.shape(g, T.circle(66, 63, 3.2), '#e8c49a', { w: 0.4 });
    T.shape(g, T.poly([[56, 62], [66, 55], [76, 62]]), T.goldG(g, 56, 55, 76, 62), { w: 0.5 });
    T.stroke(g, T.lin([[72, 70], [86, 64], [96, 88]]), M.brown, 1.3);
  },
  temple(g, T, M) {
    // งานวัด at dusk: ubosot, chedi, floating khom loi
    T.ubosot(g, 82, 86, 64, 50);
    T.shape(g, T.chediPath(30, 86, 46), T.goldG(g, 20, 40, 40, 86), { w: 0.6 });
    T.stroke(g, T.lin([[22, 80], [38, 80]]), M.red, 1.2);
    for (const [x, y, s] of [[22, 40, 1], [52, 34, 0.8], [118, 38, 0.9], [104, 30, 0.7]]) {
      const l = T.poly([[x - 4 * s, y], [x + 4 * s, y], [x + 3 * s, y + 7 * s], [x - 3 * s, y + 7 * s]]);
      g.fillStyle = T.rgrad(g, x, y + 4 * s, 1, 10 * s, ['rgba(255,220,140,0.7)', 'rgba(255,200,120,0)']); g.fillRect(x - 12 * s, y - 8 * s, 24 * s, 24 * s);
      T.shape(g, l, M.goldL, { w: 0.4 });
      T.fill(g, T.circle(x, y + 7.5 * s, 1.1 * s), M.verm);
    }
    T.fill(g, T.poly([[0, 86], [140, 86], [140, 100], [0, 100]]), M.ink);
    for (let x = 18; x < 130; x += 14) { T.fill(g, T.circle(x, 85, 1.5), M.goldL); }
  },
  battle(g, T, M) {
    // ศึกลงกา: the city burns under lightning; crossed ดาบ and ตรีศูล
    T.bolt(g, [[104, 30], [96, 44], [104, 46], [92, 62]], 2.6);
    const city = new Path2D();
    city.addPath(T.prangPath(70, 86, 44)); city.addPath(T.prangPath(44, 86, 30)); city.addPath(T.prangPath(96, 86, 32)); city.rect(14, 76, 112, 14);
    for (let i = 0; i < 7; i++) { const x = 22 + i * 16; T.kanok(g, x, 80, 14 + (i % 3) * 4, -Math.PI / 2 + (i % 2 ? 0.2 : -0.2), i % 2 === 0, { fill: M.vermL, inner: M.goldL }); }
    T.fill(g, city, M.ink);
    T.stroke(g, city, 'rgba(255,150,60,0.8)', 0.6);
    // weapons crossed in front
    T.shape(g, T.poly([[34, 84], [36, 82], [92, 34], [96, 32], [94, 36], [38, 86]]), T.vgrad(g, 30, 86, [M.cream, '#b9b2a2']), { w: 0.5 });
    T.shape(g, T.poly([[30, 84], [42, 88], [40, 90], [28, 86]]), M.gold, { w: 0.4 });
    T.stroke(g, T.lin([[106, 86], [52, 38]]), M.goldD, 2.2);
    T.stroke(g, T.lin([[106, 86], [52, 38]]), M.gold, 1.1);
    const tri = [[52, 38], [45, 34], [47, 26], [50, 33], [52, 24], [54, 33], [58, 28], [57, 36]];
    T.shape(g, T.poly(tri.map(([x, y]) => [x + (y - 38) * 0.3, y])), T.goldG(g, 44, 24, 60, 40), { w: 0.4 });
    T.prajam(g, 72, 58, 6, { petal: M.goldL, core: M.red });
  },
  buffalo(g, T, M) {
    // ทุ่งนา: sugar palms, a stilt hut, a buffalo in the paddies
    T.sun(g, 112, 40, 8, { rays: 12 });
    for (const x of [24, 36]) {
      T.stroke(g, T.lin([[x, 86], [x + 1, 44]]), M.brown, 2);
      for (let i = 0; i < 7; i++) { const a = -Math.PI + i * (Math.PI / 6); T.stroke(g, T.lin([[x + 1, 44], [x + 1 + Math.cos(a) * 9, 44 + Math.sin(a) * 7]]), M.jadeD, 1.6); }
    }
    T.shape(g, T.poly([[100, 64], [112, 54], [124, 64]]), M.ochre, { w: 0.5 });
    T.shape(g, T.poly([[103, 64], [121, 64], [121, 72], [103, 72]]), M.brown, { w: 0.4 });
    for (let k = 0; k < 4; k++) T.fill(g, T.poly([[0, 76 + k * 5], [140, 74 + k * 5], [140, 77 + k * 5], [0, 79 + k * 5]]), k % 2 ? M.jade : '#9cc66f');
    for (let x = 12; x < 132; x += 7) for (let k = 0; k < 3; k++) T.stroke(g, T.lin([[x + k * 2, 80 + k * 5], [x + 1 + k * 2, 75 + k * 5]]), M.jadeD, 0.9);
    // buffalo with crescent horns
    const b = new Path2D();
    b.ellipse(66, 72, 16, 7.5, 0, 0, Math.PI * 2);
    b.moveTo(84, 70); b.ellipse(84, 70, 6, 4.5, 0.3, 0, Math.PI * 2);
    T.shape(g, b, T.vgrad(g, 64, 80, ['#4a4048', M.ink]), { w: 0.5 });
    for (const x of [56, 60, 72, 76]) T.stroke(g, T.lin([[x, 77], [x, 86]]), M.ink, 2.4);
    T.shape(g, T.poly(T.tubePts([[80, 67], [74, 62], [76, 56], [82, 56]], [1.6, 1.4, 1, 0.3])), M.cream, { w: 0.4 });
    T.shape(g, T.poly(T.tubePts([[86, 66], [90, 59], [96, 58], [98, 62]], [1.6, 1.4, 1, 0.3])), M.cream, { w: 0.4 });
    T.fill(g, T.circle(86, 69, 0.9), M.goldL);
    T.stroke(g, T.lin([[51, 70], [47, 76], [48, 80]]), M.ink, 1);
  },
  hippo(g, T, M) {
    // บึงหมูเด้ง in the rain: lotus pads and a pink hippo surfacing
    T.cloud(g, 40, 38, 40, 16, { seed: 41, tail: -1, top: '#e6ecf2', bot: '#9fb2c6' });
    T.cloud(g, 104, 36, 36, 14, { seed: 42, tail: 1, top: '#e6ecf2', bot: '#9fb2c6' });
    for (let i = 0; i < 11; i++) { const x = 20 + i * 10; T.stroke(g, T.lin([[x, 50 + (i % 2) * 5], [x - 4, 60 + (i % 2) * 5]]), M.indigoL, 1.1); }
    T.waves(g, 10, 130, 74, { rows: 3, size: 9, cols: ['#7fb2c8', '#4f8eae', M.teal] });
    // หมูเด้ง surfacing: wide wet head, tiny ears, sassy open chomp
    const back = new Path2D(); back.ellipse(92, 78, 22, 8, 0, Math.PI, Math.PI * 2);
    T.shape(g, back, T.vgrad(g, 70, 80, ['#f0aaa8', M.rose]), { w: 0.6 });
    const pink = T.vgrad(g, 52, 82, ['#f6c0bb', '#e58f93', M.rose]);
    for (const x of [56, 74]) T.shape(g, T.poly([[x - 3, 58], [x - 1, 52], [x + 3, 53], [x + 3, 58]]), '#e58f93', { w: 0.45 });
    const head = new Path2D(); head.ellipse(65, 66, 15, 11, 0, 0, Math.PI * 2);
    T.shape(g, head, pink, { w: 0.6 });
    const snout = new Path2D(); snout.ellipse(65, 74, 13, 7.5, 0, 0, Math.PI * 2);
    T.shape(g, snout, pink, { w: 0.6 });
    const mouth = new Path2D(); mouth.moveTo(56, 74); mouth.quadraticCurveTo(65, 84, 74, 74); mouth.quadraticCurveTo(65, 77, 56, 74);
    T.shape(g, mouth, M.lac, { w: 0.4 });
    T.fill(g, T.poly([[58, 75], [60, 79], [61.5, 75.6]]), M.cream); T.fill(g, T.poly([[72, 75], [70, 79], [68.5, 75.6]]), M.cream);
    for (const x of [60, 70]) { T.fill(g, T.circle(x, 62, 2.4), M.ink); T.hole(g, x + 0.7, 61.2, 0.8); }
    T.stroke(g, T.lin([[56, 58.5], [60, 57.5], [62, 58.5]]), M.ink, 0.8); T.stroke(g, T.lin([[68, 58.5], [70, 57.5], [74, 58.5]]), M.ink, 0.8);
    for (const x of [61, 69]) T.fill(g, T.circle(x, 70, 1.1), M.lac);
    for (const x of [53, 77]) T.fill(g, T.circle(x, 69, 2.4), '#ffd1cc', 0.8);
    T.waves(g, 10, 130, 84, { rows: 2, size: 9, cols: ['#4f8eae', M.teal] });
    // lotus pads + flowers
    for (const [x, y, r] of [[22, 82, 7], [116, 84, 8], [100, 90, 5]]) { const p = new Path2D(); p.ellipse(x, y, r, r * 0.35, 0, 0.3, Math.PI * 2); p.lineTo(x, y); T.shape(g, p, M.jade, { w: 0.4 }); }
    T.lotus(g, 26, 80, 6); T.lotus(g, 112, 82, 5);
  },
  ball(g, T, M) {
    // ลานกีฬา: a woven rattan takraw ball kicked high over the sala
    T.shape(g, T.poly([[96, 72], [110, 58], [124, 72]]), M.verm, { w: 0.5 });
    T.stroke(g, T.lin([[96, 72], [110, 58], [124, 72]]), M.gold, 1);
    for (const x of [99, 121]) T.stroke(g, T.lin([[x, 72], [x, 86]]), M.red, 1.6);
    T.muralTree(g, 26, 86, 44, { seed: 12 });
    T.fill(g, T.poly([[0, 84], [140, 84], [140, 100], [0, 100]]), M.ochre);
    T.stroke(g, T.lin([[10, 85], [130, 85]]), M.goldD, 0.8);
    // motion arcs
    for (const k of [0, 1, 2]) T.stroke(g, T.lin([[40 + k * 4, 80 - k * 2], [48 + k * 4, 62 - k * 3], [58, 52 + k * 2]]), M.goldD, 0.9, 0.6);
    // the ball: rattan weave cut through with holes
    const cx = 70, cy = 50, r = 15;
    T.shape(g, T.circle(cx, cy, r), T.rgrad(g, cx - 5, cy - 5, 2, r * 1.2, [M.goldL, M.gold, M.goldD]), { w: 0.8 });
    T.clip(g, T.circle(cx, cy, r), () => {
      for (let k = -3; k <= 3; k++) {
        T.stroke(g, T.lin([[cx - r + k * 7, cy - r], [cx + r + k * 7, cy + r]]), M.goldDD, 2.2);
        T.stroke(g, T.lin([[cx + r + k * 7, cy - r], [cx - r + k * 7, cy + r]]), M.goldDD, 2.2);
        T.stroke(g, T.lin([[cx - r, cy + k * 7], [cx + r, cy + k * 7]]), M.goldDD, 2.2);
      }
    });
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; T.hole(g, cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 2.2); }
    T.hole(g, cx, cy, 2.6);
    T.stroke(g, T.circle(cx, cy, r), M.ink, 1);
    // a villager in a high bicycle-kick (cut like a puppet silhouette)
    const body = T.poly(T.tubePts([[46, 66], [49, 74], [53, 80]], [3.2, 3.6, 3.2]));
    T.shape(g, body, M.indigo, { w: 0.5 });
    T.shape(g, T.poly(T.tubePts([[53, 80], [58, 72], [62, 62]], [2.2, 1.8, 1.4])), M.ink, { w: 0 });
    T.shape(g, T.poly(T.tubePts([[52, 81], [46, 84], [40, 86]], [2.2, 1.8, 1.4])), M.ink, { w: 0 });
    T.shape(g, T.poly(T.tubePts([[47, 68], [41, 64], [36, 58]], [1.4, 1.2, 1])), M.ink, { w: 0 });
    T.shape(g, T.poly(T.tubePts([[47, 68], [52, 70], [56, 66]], [1.4, 1.2, 1])), M.ink, { w: 0 });
    T.shape(g, T.circle(44, 62, 3.4), '#e8c49a', { w: 0.5 });
    T.fill(g, T.poly([[40.8, 61], [44, 57.6], [47.6, 60]]), M.ink);
    T.stroke(g, T.lin([[46, 76], [52, 76]]), M.verm, 1.4);
  },
};

// chest entries (cat 'scenes'): dropping one loads the scene
export const PROPS = SCENES.map((s) => ({ id: 'scene-' + s.id, name: s.name, en: s.en, cat: 'scenes', build: () => ({ sprite: icon(s.icon), scene: s.id }) }));

export class Scenes {
  constructor(game) {
    this.game = game;
    this.queue = [];
    this.t = 0;
  }

  load(id) {
    const g = this.game, S = g.scene, sc = SCENES.find((s) => s.id === id);
    if (!sc) return;
    g.clearStage();
    this.queue = [];
    // light & weather
    g.fx.weather.clear();
    for (const w of sc.weather) g.fx.toggle(w);
    if (!sc.weather.includes('flood')) g.fx.flood = 0;
    const L = S.lamp;
    L.kind = sc.lamp;
    L.color = sc.lamp === 'oil' ? [1, 0.8, 0.52] : [1, 0.93, 0.8];
    S.lamp.sx = 0;
    S.worldW = Math.max(1600, sc.worldW || 1600);
    // lay it out: scenery first, then animals, then the cast
    const rank = (it) => {
      const d = g.content.byId.get(it[0]);
      if (!d) return 9;
      if (d.cat === 'buildings' || d.cat === 'village' || d.cat === 'foliage' || d.cat === 'nature') return 0;
      if (d.cat === 'tools' || d.cat === 'boats' || !d.rig) return 1;
      if (d.cat === 'animals' || d.cat === 'monsters') return 2;
      return 3;
    };
    const items = sc.items.filter((it) => g.content.byId.get(it[0])).sort((a, b) => rank(a) - rank(b));
    let t = 0.2;
    for (const it of items) {
      this.queue.push({ at: t, it });
      t += rank(it) === 0 ? 0.28 : 0.16;
    }
    this.t = 0;
    g.audio?.sfx('curtain', { vol: 0.5 });
    g.audio?.music?.play?.(sc.id === 'lanka' ? 'battle' : sc.id === 'temple-fair' ? 'dance' : 'calm');
  }

  update(dt) {
    if (!this.queue.length) return;
    this.t += dt;
    const g = this.game;
    while (this.queue.length && this.queue[0].at <= this.t) {
      const { it } = this.queue.shift();
      const [id, x, z, o = {}] = it;
      const def = g.content.byId.get(id);
      const y = o.y ?? 900;
      let a = null;
      try { a = g.spawn(def, x, y, z, { facing: o.f }); } catch (e) { console.warn('scene item failed', id, e); }
      if (!a) continue;
      if (o.f && a.facing !== o.f && a.flip) a.flip(true);
      if (o.hold && a.bodies?.handF) {
        const w = g.content.byId.get(o.hold);
        if (w) {
          const old = a.release('handF'); if (old) g.scene.remove(old);
          const hb = a.bodies.handF, [hx, hy] = g.scene.project(hb.x, hb.y, a.z);
          a.grab(g.scene.addProp(w, { x: hx, y: hy, z: a.z }), 'handF');
        }
      }
      if (o.soul) g.souls.giveSoul(a, true);
      if (o.ward) g.souls.ward(a);
      if (o.anim) setTimeout(() => a.removed || a.play?.(o.anim), 900);
      if (o.role) setTimeout(() => { if (!a.removed) g.assignFly(a, o.role); }, 700 + Math.random() * 500);
    }
  }
}
