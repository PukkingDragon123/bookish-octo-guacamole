// ฉากสำเร็จรูป — ready-made scenes. Choosing one clears the cloth, sets
// the light and the weather, then lays the scene out piece by piece:
// buildings rise in their scaffolding, trees and animals are summoned,
// and the cast arrives last and takes up their roles.

import { paintSprite, leather, dye, line, holes, dotLine, INK, poly, curve, ellipsePts } from '../art/leather.js';

// [id, x, z, opts] — x in cloth units (0..1600; wider scenes go beyond),
// opts: { f: facing, y, role, soul, ward, anim, dy }
export const SCENES = [
  {
    id: 'himmaphan', name: 'ป่าหิมพานต์', en: 'Himmaphan forest by moonlight', weather: ['night'], lamp: 'oil', icon: 'forest',
    items: [
      ['moon', 1320, 0.3, { y: 180 }],
      ['ton-yang', 150, 0.06], ['forest-tree', 330, 0.1], ['ton-sai', 1420, 0.08], ['bodhi-tree', 1180, 0.14],
      ['himmaphan-tree', 780, 0.12], ['bamboo-clump', 60, 0.04], ['fern', 520, 0.03], ['fern', 1060, 0.03],
      ['lotus-pond', 900, 0.02], ['hanging-vines', 460, 0.05, { y: 260 }], ['grass-tuft', 240, 0.02], ['grass-tuft', 1300, 0.02],
      ['kwang-thong', 640, 0.03], ['nok-yung', 1120, 0.03], ['kratai', 380, 0.02], ['khrut', 1000, 0.05, { y: 300 }],
      ['reusi', 300, 0.02, { f: 1, anim: 'wai' }], ['thewada', 760, 0.02, { f: -1, role: 'dancer' }],
    ],
  },
  {
    id: 'floating-market', name: 'ตลาดน้ำยามเช้า', en: 'Floating market at dawn', weather: ['dawn'], lamp: 'oil', icon: 'boat',
    items: [
      ['sun', 240, 0.3, { y: 200 }],
      ['coconut-palm', 90, 0.08], ['ton-maphrao', 1500, 0.06], ['banana-plant', 1330, 0.05], ['thai-house', 1200, 0.1],
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
      ['ubosot', 1160, 0.12], ['chedi', 380, 0.16], ['spirit-house', 90, 0.04], ['lilawadee', 1480, 0.05], ['ratchaphruek', 620, 0.1],
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
      ['ton-khao', 380, 0.02], ['ton-khao', 520, 0.02], ['ton-khao', 660, 0.02], ['rice-paddy', 820, 0.02], ['hun-lai-ka', 560, 0.03],
      ['kwai', 470, 0.04], ['luk-kwai', 330, 0.04], ['mae-kai', 1100, 0.02], ['luk-kai', 1160, 0.02], ['luk-kai', 1200, 0.02],
      ['ma-thai', 1320, 0.02], ['hippo', 760, 0.05], ['moo-deng', 880, 0.03],
      ['chaoban-man', 620, 0.02, { f: 1, role: 'wander' }], ['phuyaiphoon', 1040, 0.02, { f: -1, role: 'villager' }], ['dek', 1400, 0.02, { role: 'follower' }],
    ],
  },
  {
    id: 'moo-deng-pond', name: 'บึงหมูเด้ง', en: "Moo Deng's pond in the rain", weather: ['rain', 'flood'], lamp: 'oil', icon: 'hippo',
    items: [
      ['bodhi-tree', 1360, 0.12], ['banana-plant', 180, 0.05], ['bamboo-clump', 60, 0.08], ['lotus-pond', 700, 0.02], ['kok-bua', 1000, 0.02],
      ['grass-tuft', 420, 0.02], ['grass-tuft', 1180, 0.02], ['fern', 1480, 0.03],
      ['hippo', 620, 0.04], ['moo-deng', 820, 0.02], ['pet', 1000, 0.02], ['han', 1120, 0.03], ['kop', 300, 0.02], ['tao', 480, 0.02],
      ['jorakhe', 1300, 0.04], ['pla-thong', 900, 0.03], ['pla-chon', 540, 0.03],
      ['dek', 240, 0.02, { f: 1, role: 'coward' }],
    ],
  },
  {
    id: 'village-games', name: 'ลานกีฬาหมู่บ้าน', en: 'Village games', weather: [], lamp: 'electric', icon: 'ball',
    items: [
      ['sala', 1300, 0.12], ['ton-hukwang', 120, 0.08], ['ton-mamuang', 1520, 0.06], ['chaba-bush', 700, 0.03], ['bamboo-fence', 950, 0.05],
      ['takraw', 420, 0.02, { y: 700 }], ['pingpong-table', 1080, 0.02], ['pingpong-paddle', 980, 0.02, { y: 800 }], ['pingpong-paddle-blue', 1180, 0.02, { y: 800 }], ['pingpong-ball', 1080, 0.02, { y: 700 }], ['jump-rope', 1420, 0.02, { y: 820 }],
      ['aitho', 300, 0.02, { f: 1, role: 'takraw' }], ['dek', 540, 0.02, { f: -1, role: 'takraw' }],
      ['chaoban-man', 900, 0.02, { f: 1, role: 'pingpong' }], ['yodthong', 1260, 0.02, { f: -1, role: 'pingpong' }],
      ['chaoban-woman', 1450, 0.02, { f: -1, role: 'jumprope' }], ['ma-thai', 700, 0.03],
    ],
  },
];

const ICONS = {};
function icon(kind) {
  if (ICONS[kind]) return ICONS[kind];
  ICONS[kind] = paintSprite(140, 100, (ctx) => {
    // a little proscenium: gilded arch with a lit cloth inside
    const arch = poly(curve([[6, 96], [6, 30], [30, 8], [70, 2], [110, 8], [134, 30], [134, 96]], false, 10).concat([[134, 96], [6, 96]]));
    leather(ctx, arch); dye(ctx, arch, INK.gold, 0.9);
    const cloth = poly([[16, 88], [16, 32], [36, 16], [70, 11], [104, 16], [124, 32], [124, 88]]);
    leather(ctx, cloth, { edge: false });
    dye(ctx, cloth, kind === 'battle' ? INK.crimson : kind === 'forest' ? INK.indigo : kind === 'temple' ? INK.vermilion : INK.cream, 0.85);
    dotLine(ctx, [[10, 92], [130, 92]], { spacing: 5, r: 1.2 });
    const ground = poly([[16, 88], [16, 74], [124, 74], [124, 88]]); leather(ctx, ground); dye(ctx, ground, INK.leather, 0.9);
    const s = (pts, col) => { const p = poly(pts); leather(ctx, p); dye(ctx, p, col, 0.95); return p; };
    if (kind === 'forest') {
      s(ellipsePts(100, 30, 8, 8, 16), INK.cream);
      s([[30, 74], [34, 40], [38, 74]], INK.leather); s(ellipsePts(34, 38, 16, 14, 16), INK.green);
      s([[74, 74], [78, 30], [82, 74]], INK.leather); s(ellipsePts(78, 30, 20, 16, 16), INK.jade); holes(ctx, [[72, 28], [84, 34]], 2.5);
    } else if (kind === 'boat') {
      s(ellipsePts(36, 32, 10, 10, 16), INK.orange);
      s(curve([[24, 70], [40, 78], [100, 78], [116, 68], [100, 72], [40, 72]], true, 6), INK.brown);
      s([[60, 70], [66, 48], [80, 48], [86, 70]], INK.gold);
    } else if (kind === 'temple') {
      s([[40, 74], [40, 52], [70, 26], [100, 52], [100, 74]], INK.red);
      s([[64, 30], [70, 10], [76, 30]], INK.gold); holes(ctx, [[70, 58]], 5);
    } else if (kind === 'battle') {
      line(ctx, [[36, 72], [76, 26]], INK.cream, 4, { smoothIt: false }); line(ctx, [[104, 72], [64, 26]], INK.cream, 4, { smoothIt: false });
      s([[60, 44], [70, 34], [80, 44], [70, 54]], INK.yellow);
    } else if (kind === 'buffalo') {
      s(ellipsePts(104, 30, 9, 9, 16), INK.orange);
      s(ellipsePts(62, 58, 26, 12, 20), INK.leather); s([[34, 50], [24, 42], [40, 46]], INK.leather);
      for (let i = 0; i < 5; i++) line(ctx, [[24 + i * 20, 74], [26 + i * 20, 64]], INK.green, 3, { smoothIt: false });
    } else if (kind === 'hippo') {
      s(ellipsePts(66, 60, 30, 16, 20), INK.pink); s(ellipsePts(94, 52, 14, 11, 16), INK.pink); holes(ctx, [[98, 48]], 2.2);
      for (let i = 0; i < 6; i++) line(ctx, [[22 + i * 18, 20 + (i % 2) * 8], [18 + i * 18, 34 + (i % 2) * 8]], INK.blue, 2.5, { smoothIt: false });
    } else {
      s(ellipsePts(70, 44, 16, 16, 20), INK.yellow); holes(ctx, [[64, 40], [76, 40], [70, 50], [62, 50], [78, 50]], 2.6);
    }
  }, { name: 'scene-' + kind });
  return ICONS[kind];
}

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
