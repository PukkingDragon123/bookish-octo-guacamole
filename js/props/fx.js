// Stage tools: effect emitters you place (fire, torch, smoke, water,
// fountain, coloured lights, magic) and weather you toggle (rain, storm,
// wind, flood, earthquake, dusk, night, dawn).

import { paintSprite, leather, dye, line, holes, dotLine, INK, ellipsePts, poly, curve } from '../art/leather.js';
import * as TIK from '../art/thaiIcons.js';

const TI = { ...TIK, poly };

const flame = (ctx, x, y, s, col = INK.orange) => {
  const p = poly(curve([[x - s * 0.5, y], [x - s * 0.55, y - s * 0.7], [x - s * 0.1, y - s * 1.1], [x, y - s * 1.8], [x + s * 0.2, y - s * 1.0], [x + s * 0.55, y - s * 0.6], [x + s * 0.5, y]], true, 8));
  leather(ctx, p, { edge: false });
  dye(ctx, p, col, 0.95);
  dye(ctx, poly(curve([[x - s * 0.25, y], [x - s * 0.2, y - s * 0.6], [x, y - s * 1.1], [x + s * 0.2, y - s * 0.55], [x + s * 0.25, y]], true, 8)), INK.yellow, 0.95);
};

const logs = (ctx, cx, cy, w) => {
  for (const [a, dx] of [[0.25, -1], [-0.25, 1]]) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    const p = poly(ellipsePts(0, 0, w * 0.5, w * 0.08, 20));
    leather(ctx, p); dye(ctx, p, INK.brown, 0.8);
    ctx.restore();
  }
  dotLine(ctx, [[cx - w * 0.4, cy + 6], [cx + w * 0.4, cy + 6]], { spacing: 5, r: 1.2 });
};

function icon(name, draw, w = 120, h = 120) {
  return paintSprite(w, h, draw, { name: 'fx-' + name });
}

export const PROPS = [
  { id: 'fx-fire', name: 'กองไฟลุก', en: 'Bonfire (live flames)', cat: 'tools', build() {
    return { icon: fxIcon('fire'), sprite: icon('fire', (ctx) => { logs(ctx, 60, 100, 110); flame(ctx, 60, 92, 40); }), fx: 'fire', fxAt: [60, 88], glow: [60, 70, 90], glowColor: [1, 0.55, 0.2], mass: 2 };
  } },
  { id: 'fx-torch', name: 'คบเพลิง', en: 'Torch (hold it!)', cat: 'tools', build() {
    const sprite = icon('torch', (ctx) => {
      const p = poly([[26, 44], [34, 44], [32, 160], [28, 160]]);
      leather(ctx, p); dye(ctx, p, INK.brown, 0.8);
      const c = poly(ellipsePts(30, 42, 12, 8, 16)); leather(ctx, c); dye(ctx, c, INK.gold, 0.8);
      flame(ctx, 30, 40, 22);
    }, 60, 160);
    return { sprite, icon: fxIcon('torch'), fx: 'fire', fxAt: [30, 30], glow: [30, 20, 70], glowColor: [1, 0.6, 0.25], grip: [30, 140], weapon: { kind: 'blunt', a: [30, 40], b: [30, 160] } };
  } },
  { id: 'fx-smoke', name: 'กระถางธูป', en: 'Incense burner (smoke)', cat: 'tools', build() {
    return { icon: fxIcon('smoke'), sprite: icon('smoke', (ctx) => {
      const p = poly(curve([[20, 70], [100, 70], [92, 110], [28, 110]], true, 6)); leather(ctx, p); dye(ctx, p, INK.gold, 0.7);
      dotLine(ctx, [[30, 84], [90, 84]], { spacing: 5, r: 1.3 });
      for (const x of [48, 60, 72]) { const s = poly([[x - 1.5, 30], [x + 1.5, 30], [x + 1.5, 72], [x - 1.5, 72]]); leather(ctx, s); dye(ctx, s, INK.red, 0.9); }
    }), fx: 'smoke', fxAt: [60, 28] };
  } },
  { id: 'fx-water', name: 'สายน้ำ', en: 'Rippling water', cat: 'tools', build() {
    return { icon: fxIcon('water'), sprite: paintSprite(700, 90, (ctx, { rng: r }) => {
      const top = [];
      for (let x = 0; x <= 700; x += 20) top.push([x, 20 + Math.sin(x * 0.03) * 10]);
      const p = poly([...top, [700, 90], [0, 90]]);
      leather(ctx, p, { edge: false }); dye(ctx, p, INK.blue, 0.85);
      for (let k = 0; k < 3; k++) dotLine(ctx, top.map(([x, y]) => [x, y + 18 + k * 20 + Math.sin(x * 0.05 + k) * 5]), { spacing: 6, r: 1.4, seed: k });
    }, { name: 'fx-water', px: 1 }), static: true, float: false };
  } },
  { id: 'fx-fountain', name: 'น้ำพุ', en: 'Fountain', cat: 'tools', build() {
    return { icon: fxIcon('fountain'), sprite: icon('fountain', (ctx) => {
      const b = poly(curve([[10, 90], [110, 90], [95, 118], [25, 118]], true, 6)); leather(ctx, b); dye(ctx, b, INK.jade, 0.7);
      const c = poly([[54, 60], [66, 60], [64, 92], [56, 92]]); leather(ctx, c); dye(ctx, c, INK.gold, 0.8);
      dotLine(ctx, [[20, 100], [100, 100]], { spacing: 5, r: 1.3 });
    }), fx: 'fountain', fxAt: [60, 58], static: true };
  } },
  ...[['gold', [1, 0.8, 0.4], INK.yellow, 'ไฟทอง', 'Golden light'], ['red', [1, 0.3, 0.2], INK.red, 'ไฟแดง', 'Red light'], ['blue', [0.35, 0.55, 1], INK.blue, 'ไฟฟ้าคราม', 'Blue light'], ['green', [0.4, 1, 0.5], INK.green, 'ไฟเขียว', 'Green light']].map(([k, c, ink, th, en]) => ({
    id: 'fx-light-' + k, name: th, en, cat: 'tools', build() {
      return { icon: fxIcon('light', { k, ...LIGHTS[k] }), sprite: icon('light-' + k, (ctx) => {
        const p = poly(ellipsePts(60, 60, 26, 30, 24)); leather(ctx, p); dye(ctx, p, ink, 0.95);
        holes(ctx, [[60, 60]], 8);
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; line(ctx, [[60 + Math.cos(a) * 34, 60 + Math.sin(a) * 38], [60 + Math.cos(a) * 50, 60 + Math.sin(a) * 54]], ink, 4, { smoothIt: false }); }
      }), glow: [60, 60, 220], glowColor: c, static: true };
    },
  })),
  { id: 'fx-magic', name: 'ประกายเวทย์', en: 'Magic sparkles', cat: 'tools', build() {
    return { icon: fxIcon('magic'), sprite: icon('magic', (ctx) => {
      const p = poly([[60, 10], [70, 50], [110, 60], [70, 70], [60, 110], [50, 70], [10, 60], [50, 50]]); leather(ctx, p); dye(ctx, p, INK.gold, 0.9); holes(ctx, [[60, 60]], 6);
    }), fx: 'sparkle', fxAt: [60, 60], glow: [60, 60, 120], glowColor: [1, 0.85, 0.5], static: true };
  } },
  // magic: drop one onto a puppet or animal
  ...[['soul', 'ปลุกเสกวิญญาณ', 'Give a soul (it can feel, bleed and die)'], ['ward', 'ลงยันต์คุ้มกัน', 'Yantra ward (reinforce against tearing)'], ['mend', 'ชุบชีวิต', 'Mend & revive (heal wounds, re-stitch limbs)'], ['summon', 'อัญเชิญ', 'Summon a random spirit or beast']].map(([k, th, en]) => ({
    id: 'mg-' + k, name: th, en, cat: 'magic', build() { return { sprite: spellIcon(k), spell: k }; },
  })),
  // weather: dropping one toggles it (no actor is created)
  ...[['rain', 'ฝนตก', 'Rain'], ['storm', 'พายุฟ้าผ่า', 'Thunderstorm'], ['wind', 'ลมพัด', 'Wind'], ['flood', 'น้ำท่วม', 'Flood'], ['quake', 'แผ่นดินไหว', 'Earthquake'], ['dawn', 'รุ่งอรุณ', 'Dawn light'], ['dusk', 'ยามเย็น', 'Dusk light'], ['night', 'ราตรี', 'Moonlight']].map(([k, th, en]) => ({
    id: 'wx-' + k, name: th, en, cat: 'weather', build() { return { sprite: weatherIcon(k), weather: k }; },
  })),
];

// ---------------------------------------------------------------- icons
// Weather plaques: each effect painted as a little mural inside a gilded
// ซุ้ม window (see art/thaiIcons.js for the ornament kit).
function weatherIcon(k) {
  return paintSprite(120, 120, (ctx) => {
    const T = TI;
    const skies = {
      rain: [T.M.indigoL, T.M.indigo, T.M.indigoD], storm: ['#3a2f6e', T.M.indigoD, '#0b0f2e'], wind: [T.M.sky, '#6f9fc0', T.M.indigo],
      flood: ['#8fb8d4', T.M.indigoL, T.M.indigo], quake: [T.M.vermL, T.M.verm, T.M.lac], dawn: [T.M.indigo, T.M.rose, T.M.vermL, T.M.goldL],
      dusk: [T.M.purpleD, T.M.rose, T.M.verm, T.M.gold], night: [T.M.night, T.M.indigoD, T.M.indigo],
    };
    T.weatherFrame(ctx, (g) => {
      T.fill(g, T.P([[0, 0], [120, 0], [120, 120], [0, 120]], true, 1), T.vgrad(g, 14, 104, skies[k]));
      WX[k](g, T);
    }, { band: k === 'quake' || k === 'dusk' ? T.M.indigo : T.M.red });
  }, { name: 'wx-' + k });
}

const WX = {
  rain(g, T) {
    for (let i = 0; i < 9; i++) {
      const x = 14 + i * 10.5, y = 54 + (i % 3) * 7;
      T.stroke(g, T.lin([[x, y], [x - 6, y + 16]]), T.M.cream, 1.5);
      T.stroke(g, T.lin([[x - 1, y + 22], [x - 4, y + 30]]), T.M.sky, 1.2);
    }
    for (let i = 0; i < 5; i++) {
      const x = 22 + i * 18, y = 74 + (i % 2) * 6;
      const d = new Path2D(); d.moveTo(x, y - 4); d.quadraticCurveTo(x + 3, y + 1, x, y + 2.5); d.quadraticCurveTo(x - 3, y + 1, x, y - 4);
      T.shape(g, d, T.M.sky, { w: 0.4 });
    }
    T.cloud(g, 44, 42, 56, 26, { seed: 3, tail: -1, bot: '#b9c4cc' });
    T.cloud(g, 80, 34, 50, 24, { seed: 5, tail: 1, bot: '#b9c4cc' });
    T.waves(g, 10, 110, 92, { rows: 2, size: 11 });
  },
  storm(g, T) {
    for (let i = 0; i < 8; i++) { const x = 18 + i * 12; T.stroke(g, T.lin([[x, 56 + (i % 2) * 6], [x - 8, 78 + (i % 2) * 6]]), T.M.indigoL, 1.3); }
    T.cloud(g, 40, 38, 60, 28, { seed: 8, top: '#9aa0c4', bot: '#4a4f7e', line: '#262a52', tail: -1 });
    T.cloud(g, 84, 44, 54, 26, { seed: 9, top: '#8f95bd', bot: '#3f4472', line: '#262a52', tail: 1 });
    T.bolt(g, [[64, 46], [52, 64], [64, 66], [48, 88], [60, 88], [44, 106]], 4.2);
    T.bolt(g, [[88, 56], [96, 70], [88, 72], [96, 86]], 2.6);
    T.star(g, 24, 64, 4, { petal: T.M.goldL, core: null, punch: false });
  },
  wind(g, T) {
    // bending palm and streaming clouds (เมฆไหล) with flying bodhi leaves
    T.shape(g, T.poly(T.tubePts([[30, 104], [34, 84], [42, 66], [54, 54]], [2.6, 2.2, 1.8, 1.4])), T.M.brown, { w: 0.5 });
    for (let i = 0; i < 6; i++) {
      const a = -0.3 + i * 0.32, len = 18 + (i % 2) * 5;
      const sp = [[54, 54], [54 + Math.cos(a) * len * 0.5 + 3, 54 + Math.sin(a) * len * 0.5 - 4], [54 + Math.cos(a) * len + 6, 54 + Math.sin(a) * len]];
      T.shape(g, T.poly(T.tubePts(sp, [1.4, 2.6, 0.4])), i % 2 ? T.M.jade : T.M.jadeD, { w: 0.5 });
    }
    const streams = [[[8, 40], [40, 34], [70, 42], [96, 34], [108, 24]], [[10, 66], [44, 62], [76, 70], [100, 62]], [[20, 88], [56, 84], [88, 92], [104, 84]]];
    streams.forEach((s, i) => {
      const o = T.tubePts(s, [0.6, 3.4, 3.8, 2.6, 1]);
      T.shape(g, T.poly(o), T.vgrad(g, s[0][1] - 6, s[0][1] + 6, [T.M.cream, T.M.creamD]), { w: 0.7 });
      const e = s[s.length - 1];
      T.stroke(g, T.lin(T.spiralPts(e[0] - 3, e[1] + 4, 5, 1.1, -Math.PI / 2, 1, 16)), T.M.cream, 2.2);
      T.stroke(g, T.lin(T.spiralPts(e[0] - 3, e[1] + 4, 5, 1.1, -Math.PI / 2, 1, 16)), T.M.goldD, 0.6);
      T.stroke(g, T.lin(s.slice(1, -1)), T.M.goldD, 0.6, 0.7);
      void i;
    });
    for (const [x, y, a] of [[84, 50, 0.6], [70, 80, -0.4], [96, 76, 1.2]]) {
      const lf = new Path2D();
      g.save(); g.translate(x, y); g.rotate(a);
      lf.moveTo(0, 5); lf.bezierCurveTo(-6, 1, -5, -5, 0, -3); lf.bezierCurveTo(5, -5, 6, 1, 0, 5); lf.lineTo(0.5, 8);
      T.shape(g, lf, T.M.jadeL, { w: 0.45 });
      g.restore();
    }
  },
  flood(g, T) {
    T.cloud(g, 86, 34, 40, 18, { seed: 12, tail: 1 });
    // a drowned roof and a lotus bobbing
    T.shape(g, T.poly([[14, 70], [26, 58], [38, 70]]), T.M.verm, { w: 0.6 });
    T.stroke(g, T.lin([[14, 70], [26, 58], [38, 70]]), T.M.gold, 1);
    T.waves(g, 6, 114, 72, { rows: 4, size: 12, cols: ['#6f9fd0', T.M.indigoL, T.M.indigo, T.M.indigoD] });
    T.naga(g, 66, 112, 0.98, { dir: 1, neck: [[0, 0], [-6, -18], [2, -36], [12, -48]], radii: [9, 8, 7, 6.5] });
    T.waves(g, 6, 114, 96, { rows: 1, size: 12, cols: [T.M.indigoL] });
    T.lotus(g, 26, 92, 6);
  },
  quake(g, T) {
    // the earth splits and the naga beneath it rears up; a chedi topples
    const top = [[0, 70], [22, 67], [40, 72], [52, 64], [68, 70], [84, 64], [102, 69], [120, 66]];
    const ground = T.poly([...top, [120, 120], [0, 120]], true);
    T.fill(g, ground, T.vgrad(g, 62, 110, [T.M.ochre, T.M.earth, T.M.earthD]));
    for (let i = 0; i < 3; i++) T.stroke(g, T.lin([[0, 80 + i * 9], [40, 78 + i * 9], [80, 82 + i * 9], [120, 79 + i * 9]]), T.M.earthD, 0.9, 0.9);
    for (const [x, y] of [[14, 86], [96, 90], [30, 98], [80, 100]]) T.fill(g, T.circle(x, y, 1.6), T.M.ochre);
    // the gaping crack
    const crack = T.poly([[44, 70], [52, 82], [46, 90], [56, 100], [50, 108], [70, 108], [64, 98], [72, 88], [64, 80], [72, 68]], true);
    T.shape(g, crack, T.M.ink, { w: 0.4 });
    T.stroke(g, T.lin([[46, 72], [53, 82], [47, 90], [56, 100]]), T.M.vermL, 1);
    T.naga(g, 58, 108, 0.9, { dir: 1, body: '#e0b04a', bodyD: T.M.goldD, belly: T.M.cream, crest: T.M.verm, neck: [[0, 0], [-3, -16], [2, -32], [8, -44]], radii: [8, 7.5, 6.5, 6] });
    T.stroke(g, T.lin(top), T.M.ink, 1.4);
    // tilting chedi (left) and prang (right)
    g.save(); g.translate(22, 69); g.rotate(-0.28);
    T.shape(g, T.chediPath(0, 0, 36), T.vgrad(g, -36, 0, [T.M.cream, T.M.creamD]), { w: 0.6 });
    T.stroke(g, T.lin([[-6, -6.5], [6, -6.5]]), T.M.red, 1.1);
    g.restore();
    g.save(); g.translate(98, 69); g.rotate(0.2);
    T.shape(g, T.prangPath(0, 0, 32), T.vgrad(g, -32, 0, [T.M.cream, T.M.creamD]), { w: 0.6 });
    g.restore();
    // shock lines and flying rubble
    for (const [x, y, s] of [[10, 42, 1], [110, 40, -1]]) for (let k = 0; k < 3; k++) T.stroke(g, T.lin([[x + s * k * 4, y - 6 + k * 2], [x + s * (k * 4 + 3), y + k * 2], [x + s * k * 4, y + 6 + k * 2]]), T.M.goldL, 1.1);
    for (const [x, y, r] of [[38, 54, 2.2], [80, 50, 2.6], [88, 58, 1.6], [30, 60, 1.4]]) T.shape(g, T.poly([[x - r, y], [x, y - r], [x + r, y + r * 0.4]], true), T.M.earth, { w: 0.4 });
  },
  dawn(g, T) {
    g.fillStyle = T.rgrad(g, 60, 92, 4, 60, ['rgba(255,236,170,0.9)', 'rgba(255,190,110,0)']); g.fillRect(0, 30, 120, 90);
    T.sun(g, 60, 84, 21, { rays: 18 });
    T.cloud(g, 26, 88, 40, 20, { seed: 21, tail: -1, top: '#fff3dc', bot: '#e6a98a' });
    T.cloud(g, 96, 90, 40, 20, { seed: 22, tail: 1, top: '#fff3dc', bot: '#e6a98a' });
    T.waves(g, 6, 114, 98, { rows: 1, size: 10, cols: [T.M.indigo], line: T.M.goldL });
    for (const [x, y] of [[30, 44], [44, 36]]) T.stroke(g, T.lin([[x - 4, y - 2], [x, y], [x + 4, y - 2]]), T.M.ink, 1);
  },
  dusk(g, T) {
    g.fillStyle = T.rgrad(g, 60, 74, 4, 54, ['rgba(255,214,120,0.9)', 'rgba(255,150,80,0)']); g.fillRect(0, 20, 120, 100);
    T.sun(g, 60, 74, 20, { rays: 16, face: true, disc: [T.M.goldL, T.M.vermL, T.M.red] });
    // temple silhouette against the sun
    const p = new Path2D();
    p.addPath(T.prangPath(60, 104, 50));
    p.addPath(T.chediPath(26, 104, 32));
    p.addPath(T.chediPath(94, 104, 34));
    p.rect(0, 96, 120, 30);
    T.fill(g, p, T.M.ink);
    T.stroke(g, p, 'rgba(255,190,90,0.7)', 0.6);
    for (const [x, y, s] of [[28, 42, 1.2], [40, 50, 1], [86, 38, 1.1], [98, 46, 0.9]]) T.stroke(g, T.lin([[x - 5 * s, y - 2.5 * s], [x - 2 * s, y - 2.5 * s], [x, y], [x + 2 * s, y - 2.5 * s], [x + 5 * s, y - 2.5 * s]]), T.M.ink, 1.2);
  },
  night(g, T) {
    for (const [x, y, r] of [[24, 52, 4.5], [36, 76, 3], [92, 84, 3.5], [100, 56, 3], [64, 92, 2.6], [20, 92, 2.6], [76, 34, 2.4]]) T.star(g, x, y, r, { petal: T.M.goldL, core: T.M.red });
    T.moon(g, 62, 58, 20);
    T.cloud(g, 30, 98, 46, 18, { seed: 31, tail: -1, top: '#c9cfe8', bot: '#6f78a8', line: '#3a4170' });
    T.cloud(g, 96, 102, 42, 16, { seed: 32, tail: 1, top: '#c9cfe8', bot: '#6f78a8', line: '#3a4170' });
  },
};

// ยันต์ spell medallions in a flame halo.
function spellIcon(k) {
  const T = TI;
  return paintSprite(120, 120, (ctx) => {
    const fields = { soul: [T.M.indigo, T.M.night], ward: [T.M.verm, T.M.lac], mend: [T.M.jade, T.M.jadeD], summon: [T.M.purple, T.M.purpleD] };
    const [f1, f2] = fields[k];
    T.medallion(ctx, (g) => SPELL[k](g, T), { field: f1, field2: f2, ring: k === 'ward' ? T.M.indigo : T.M.red });
  }, { name: 'mg-' + k });
}

const SPELL = {
  soul(g, T) {
    // ดวงวิญญาณ: a flame-soul rising from a lotus, with a punched heart-light
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; T.stroke(g, T.lin([[60 + Math.cos(a) * 20, 52 + Math.sin(a) * 20], [60 + Math.cos(a) * 30, 52 + Math.sin(a) * 30]]), 'rgba(253,233,166,0.5)', 1.2); }
    const fl = T.poly(T.tubePts([[60, 72], [56, 60], [62, 48], [58, 36], [64, 26]], [9, 10, 8, 4.5, 0.6]));
    T.shape(g, fl, T.vgrad(g, 26, 72, [T.M.cream, T.M.goldL, T.M.gold]), { w: 0.8 });
    T.fill(g, T.poly(T.tubePts([[60, 70], [58, 60], [61, 50], [60, 42]], [4.5, 5, 3.5, 0.6])), T.M.vermL);
    T.hole(g, 60, 60, 2.6);
    T.lotus(g, 60, 80, 11, { petal: T.M.pink, petalD: T.M.rose });
    T.kanok(g, 46, 46, 9, -2.2, true, { fill: T.M.goldL, inner: T.M.gold });
    T.kanok(g, 74, 46, 9, -0.9, false, { fill: T.M.goldL, inner: T.M.gold });
    T.stroke(g, T.lin([[50, 86], [70, 86]]), T.M.goldL, 1);
  },
  ward(g, T) {
    // square ยันต์ grid with อุณาโลม and khom-script ticks
    const sq = T.poly([[38, 40], [82, 40], [82, 84], [38, 84]]);
    T.shape(g, sq, T.M.cream, { w: 0.8 });
    for (const t of [52.7, 67.3]) { T.stroke(g, T.lin([[t, 40], [t, 84]]), T.M.lac, 1.2); T.stroke(g, T.lin([[38, t + 1.3], [82, t + 1.3]]), T.M.lac, 1.2); }
    T.stroke(g, T.lin([[38, 40], [82, 84]]), T.M.lac, 0.8, 0.8); T.stroke(g, T.lin([[82, 40], [38, 84]]), T.M.lac, 0.8, 0.8);
    const glyph = (x, y) => { T.stroke(g, T.lin([[x - 3, y + 2], [x - 2, y - 2], [x + 1, y - 1], [x + 2, y + 3], [x + 3.5, y + 1]]), T.M.ink, 1); T.fill(g, T.circle(x - 3, y + 2.6, 0.9), T.M.ink); };
    for (const x of [45.3, 60, 74.7]) for (const y of [46.5, 61.3, 76]) glyph(x, y);
    // unalom spiral on top
    T.stroke(g, T.lin(T.spiralPts(60, 32, 4.5, 1.6, Math.PI, -1, 22)), T.M.goldL, 1.6);
    T.stroke(g, T.lin([[60, 36.5], [64, 32], [66, 26], [62, 22]]), T.M.goldL, 1.6);
    T.fill(g, T.circle(60, 20, 1.6), T.M.goldL);
    T.lotusBand(g, 38, 82, 96, 7, { fill: T.M.gold, inner: T.M.verm });
  },
  mend(g, T) {
    // a heart-shaped bodhi leaf (ใบโพธิ์) re-stitched with golden thread
    const leaf = new Path2D();
    leaf.moveTo(60, 88); leaf.bezierCurveTo(46, 76, 30, 64, 34, 48); leaf.bezierCurveTo(37, 36, 52, 34, 60, 44);
    leaf.bezierCurveTo(68, 34, 83, 36, 86, 48); leaf.bezierCurveTo(90, 64, 74, 76, 60, 88); leaf.lineTo(62, 96);
    T.shape(g, leaf, T.vgrad(g, 34, 92, [T.M.vermL, T.M.red, T.M.lac]), { w: 0.9 });
    T.stroke(g, T.lin([[60, 46], [60, 86]]), T.M.goldL, 1.2);
    for (let i = 0; i < 4; i++) { const y = 52 + i * 8; T.stroke(g, T.lin([[60, y + 4], [47 + i * 2, y - 2]]), T.M.goldL, 0.8); T.stroke(g, T.lin([[60, y + 4], [73 - i * 2, y - 2]]), T.M.goldL, 0.8); }
    // the tear, cross-stitched
    T.stroke(g, T.lin([[42, 54], [50, 60], [46, 66], [54, 72]]), T.M.ink, 1.4);
    for (const [x, y] of [[44, 57], [48, 63], [50, 69]]) { T.stroke(g, T.lin([[x - 3, y - 2], [x + 3, y + 2]]), T.M.cream, 1.3); T.stroke(g, T.lin([[x - 3, y + 2], [x + 3, y - 2]]), T.M.cream, 1.3); }
    // needle with its eye punched
    T.shape(g, T.poly([[30, 92], [86, 28], [88, 30], [32, 94]]), T.goldG(g, 30, 30, 90, 90), { w: 0.4 });
    T.hole(g, 84.5, 31.5, 1.2);
    T.stroke(g, T.lin([[85, 31], [92, 40], [86, 50], [94, 58]]), T.M.goldL, 1, 0.9);
  },
  summon(g, T) {
    // ดาวเก้ายอด: a nine-pointed star of kanok flames round a spirit-eye
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
      T.kanok(g, 60 + Math.cos(a) * 12, 60 + Math.sin(a) * 12, 20, a, i % 2 === 1, { fill: T.M.goldL, inner: T.M.verm });
    }
    T.shape(g, T.circle(60, 60, 13), T.goldG(g, 47, 47, 73, 73), { w: 0.6 });
    const eye = new Path2D(); eye.moveTo(50, 60); eye.quadraticCurveTo(60, 50, 70, 60); eye.quadraticCurveTo(60, 70, 50, 60);
    T.shape(g, eye, T.M.cream, { w: 0.6 });
    T.fill(g, T.circle(60, 60, 4), T.M.purple);
    T.hole(g, 60, 60, 1.8);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 - Math.PI / 2 + Math.PI / 9; T.star(g, 60 + Math.cos(a) * 28, 60 + Math.sin(a) * 28, 3.2, { petal: T.M.goldL, core: null, punch: false }); }
  },
};

// Effect plaques for the chest (def.icon): the same gilded ซุ้ม window as
// the weather, each holding a little mural of the effect. The prop's
// `sprite` stays the plain leather cut-out the puppeteer holds on stage.
function fxIcon(k, arg) {
  const T = TI;
  const f = FXI[k];
  return paintSprite(120, 120, (ctx) => {
    T.weatherFrame(ctx, (g) => {
      T.fill(g, T.P([[0, 0], [120, 0], [120, 120], [0, 120]], true, 1), T.vgrad(g, 14, 104, f.sky(T, arg)));
      f.draw(g, T, arg);
    }, { band: f.band ? f.band(T, arg) : T.M.red });
  }, { name: 'fxi-' + k + (arg ? '-' + arg.k : '') });
}

const spark = (g, T, x, y, r, col) => {
  const p = T.poly([[x, y - r], [x + r * 0.28, y - r * 0.28], [x + r, y], [x + r * 0.28, y + r * 0.28], [x, y + r], [x - r * 0.28, y + r * 0.28], [x - r, y], [x - r * 0.28, y - r * 0.28]]);
  T.shape(g, p, col || T.M.goldL, { w: 0.35 });
};

const LIGHTS = {
  gold: { gem: '#f6c94a', gemL: '#fff3b8', gemD: '#a8701c', glow: 'rgba(255,214,120,', sky: ['#3a1d0c', '#5a2c10', '#2a1206'] },
  red: { gem: '#d8302a', gemL: '#ff9a7a', gemD: '#6e0f0c', glow: 'rgba(255,110,80,', sky: ['#2e0a10', '#4a1018', '#1c0508'] },
  blue: { gem: '#3a66d8', gemL: '#a8c8ff', gemD: '#122a7a', glow: 'rgba(120,170,255,', sky: ['#0b1236', '#16205a', '#070a24'] },
  green: { gem: '#2fae5e', gemL: '#b4f0c0', gemD: '#0f5a30', glow: 'rgba(120,240,150,', sky: ['#06231a', '#0d3a28', '#041610'] },
};

const FXI = {
  fire: {
    sky: (T) => ['#1a1440', T.M.indigoD, '#3a1006'],
    draw(g, T) {
      g.fillStyle = T.rgrad(g, 60, 78, 4, 56, ['rgba(255,190,90,0.95)', 'rgba(230,90,30,0.45)', 'rgba(120,20,10,0)']); g.fillRect(0, 0, 120, 120);
      // ground and ring of stones
      T.shape(g, T.P([[10, 92], [40, 86], [80, 86], [110, 92], [110, 120], [10, 120]], true, 6), T.vgrad(g, 86, 104, [T.M.earth, T.M.earthD]), { w: 0.6 });
      // flames
      T.flames(g, 60, 88, 52);
      // crossed logs in front
      for (const s of [-1, 1]) {
        const sp = [[60 - s * 30, 98], [60 + s * 26, 84]];
        T.shape(g, T.poly(T.tubePts(sp, [4.2, 3.4])), T.vgrad(g, 82, 100, [T.M.ochre, T.M.brown]), { w: 0.7 });
        T.stroke(g, T.lin([[60 - s * 24, 94.5], [60 + s * 18, 85.5]]), T.M.goldD, 0.8);
        T.shape(g, T.circle(60 - s * 30, 98, 3.6), T.M.creamD, { w: 0.5 });
        T.stroke(g, T.circle(60 - s * 30, 98, 1.8), T.M.brown, 0.6);
      }
      for (const [x, y] of [[26, 98], [38, 96], [82, 96], [94, 98], [50, 99], [70, 99]]) T.shape(g, T.P([[x - 5, y + 2], [x - 4, y - 2], [x, y - 3.5], [x + 4, y - 2], [x + 5, y + 2]], true, 4), T.vgrad(g, y - 4, y + 2, ['#a08870', '#5a4434']), { w: 0.5 });
      // sparks drifting up
      for (const [x, y, r] of [[34, 50, 3.2], [86, 44, 3.6], [44, 34, 2.4], [78, 30, 2.6], [28, 70, 2.2], [92, 66, 2.4], [62, 26, 2]]) spark(g, T, x, y, r, r > 3 ? T.M.goldL : '#ffd27a');
      for (const [x, y] of [[40, 60], [80, 56], [52, 40], [70, 42], [96, 54], [24, 58]]) T.fill(g, T.circle(x, y, 1), T.M.goldL);
    },
  },
  torch: {
    sky: (T) => [T.M.night, T.M.indigoD, T.M.indigo],
    draw(g, T) {
      g.fillStyle = T.rgrad(g, 64, 44, 4, 54, ['rgba(255,200,110,0.9)', 'rgba(230,110,40,0.35)', 'rgba(120,30,10,0)']); g.fillRect(0, 0, 120, 120);
      for (const [x, y, r] of [[28, 36, 3], [96, 50, 2.6], [30, 82, 2.2], [98, 84, 2.4]]) T.star(g, x, y, r, { petal: T.M.goldL, core: null, punch: false });
      // shaft (tilted) wrapped with cord
      g.save(); g.translate(64, 60); g.rotate(0.22);
      const shaft = T.poly([[-3.4, -8], [3.4, -8], [2.6, 56], [-2.6, 56]]);
      T.shape(g, shaft, T.vgrad(g, -8, 56, [T.M.ochre, T.M.brown]), { w: 0.7 });
      for (let yy = 0; yy < 50; yy += 5) T.stroke(g, T.lin([[-3.2, yy], [3.2, yy + 2.2]]), T.M.earthD, 0.7);
      // gold head cup
      const cup = T.P([[-9, -10], [9, -10], [5, 0], [-5, 0]], true, 3, 0.2);
      T.shape(g, cup, T.goldG(g, -10, -10, 10, 0), { w: 0.6 });
      T.lotusBand(g, -9, 9, -9, 5, { fill: T.M.gold, inner: T.M.verm, n: 4 });
      T.stroke(g, T.lin([[-6, -4], [6, -4]]), T.M.red, 1.6);
      T.dotLine(g, [[-5, -4], [5, -4]], { spacing: 2.6, r: 0.55, smoothIt: false, jitter: 0 });
      g.restore();
      T.flames(g, 61.5, 50, 36, { spread: 0.8 });
      // the hand: a mural fist gripping the shaft, with a gold bracelet
      g.save(); g.translate(70, 92); g.rotate(0.22);
      const skin = T.vgrad(g, -10, 12, ['#f3cf98', '#d9a668']);
      T.shape(g, T.poly(T.tubePts([[2, 6], [10, 18], [16, 34]], [7, 8, 8.5])), skin, { w: 0.7 });
      T.shape(g, T.poly([[3, 16], [13, 11], [16, 17], [6, 22]]), T.goldG(g, 0, 10, 16, 22), { w: 0.5 });
      T.stroke(g, T.lin([[4.5, 18.5], [14.5, 13.5]]), T.M.red, 1.3);
      const fist = T.P([[-9, -9], [3, -11], [10, -7], [11, 4], [6, 10], [-8, 9], [-11, 2]], true, 6, 0.4);
      T.shape(g, fist, skin, { w: 0.75 });
      for (const yy of [-5, -0.5, 4]) T.stroke(g, T.lin([[-9.5, yy], [-4, yy + 0.6], [1, yy]]), '#9a6a38', 0.8);
      T.shape(g, T.P([[-2, -11], [6, -12], [10, -8], [4, -6], [-1, -7.5]], true, 4, 0.4), '#f6d8a8', { w: 0.5 });
      g.restore();
    },
  },
  smoke: {
    sky: (T) => [T.M.rose, '#8a3a50', T.M.purpleD],
    band: (T) => T.M.indigo,
    draw(g, T) {
      // curling smoke scrolls (ควันธูป)
      const streams = [[[48, 62], [44, 50], [52, 40], [44, 30], [50, 22]], [[60, 60], [64, 48], [56, 38], [64, 28], [60, 18]], [[72, 62], [78, 52], [70, 42], [80, 34], [76, 24]]];
      for (const s of streams) {
        T.shape(g, T.poly(T.tubePts(s, [0.6, 2.4, 3.2, 2.6, 1.2])), T.vgrad(g, 20, 62, [T.M.cream, '#e6d6c4', '#cdb6b0']), { w: 0.5 });
        const e = s[s.length - 1];
        T.stroke(g, T.lin(T.spiralPts(e[0] + 2, e[1] + 2, 4.5, 1.1, Math.PI / 2, 1, 16)), T.M.cream, 2);
        T.stroke(g, T.lin(T.spiralPts(e[0] + 2, e[1] + 2, 4.5, 1.1, Math.PI / 2, 1, 16)), T.M.rose, 0.5);
      }
      T.cloud(g, 30, 38, 28, 14, { seed: 41, tail: -1, lobes: 3, top: T.M.cream, bot: '#d8c2bc' });
      T.cloud(g, 92, 32, 26, 13, { seed: 42, tail: 1, lobes: 3, top: T.M.cream, bot: '#d8c2bc' });
      // three incense sticks with glowing tips
      for (const [x, a] of [[51, -0.18], [60, 0], [69, 0.18]]) {
        const tip = [x + Math.sin(a) * 4, 62];
        T.stroke(g, T.lin([[x - Math.sin(a) * 12, 86], tip]), T.M.ink, 3.2);
        T.stroke(g, T.lin([[x - Math.sin(a) * 12, 86], tip]), T.M.red, 1.8);
        T.fill(g, T.circle(tip[0], tip[1], 2.8), 'rgba(255,170,80,0.6)');
        T.shape(g, T.circle(tip[0], tip[1], 1.5), T.M.goldL, { w: 0.3 });
      }
      // the gold burner on lion feet, a lotus band round its belly
      const bowl = T.P([[30, 78], [90, 78], [86, 92], [74, 98], [46, 98], [34, 92]], true, 6, 0.4);
      T.shape(g, bowl, T.goldG(g, 30, 76, 90, 100), { w: 0.8 });
      T.shape(g, T.poly([[27, 74], [93, 74], [91, 80], [29, 80]]), T.goldG(g, 0, 72, 0, 82), { w: 0.6 });
      T.dotLine(g, [[31, 77], [89, 77]], { spacing: 3.4, r: 0.65, smoothIt: false, jitter: 0 });
      T.clip(g, bowl, () => { T.lotusBand(g, 30, 90, 94, 9, { fill: T.M.goldL, inner: T.M.verm, n: 7 }); T.fill(g, T.poly([[20, 81], [100, 81], [100, 85], [20, 85]]), T.M.red); });
      T.prajam(g, 60, 87, 4.4, { petal: T.M.goldL, core: T.M.indigo });
      for (const s of [-1, 1]) T.kanok(g, 60 + s * 20, 97, 8, Math.PI / 2 - s * 0.4, s < 0, { fill: T.M.gold, inner: T.M.verm, w: 0.5 });
      T.shape(g, T.poly([[22, 100], [98, 100], [96, 104], [24, 104]]), T.M.lac, { w: 0.5 });
    },
  },
  water: {
    sky: (T) => [T.M.sky, '#7fb2d4', T.M.indigoL],
    band: (T) => T.M.indigo,
    draw(g, T) {
      T.cloud(g, 36, 34, 40, 18, { seed: 51, tail: -1 });
      T.cloud(g, 88, 42, 34, 15, { seed: 52, tail: 1, lobes: 4 });
      T.waves(g, 6, 114, 60, { rows: 5, size: 13, cols: ['#7ab0dc', T.M.indigoL, '#3f5aa6', T.M.indigo, T.M.indigoD] });
      // a leaping fish (ปลา) arcing over the crests
      g.save(); g.translate(64, 54); g.rotate(-0.35);
      const body = T.P([[-16, 0], [-8, -6], [4, -6.5], [13, -2], [15, 1], [6, 5], [-8, 5]], true, 6, 0.45);
      const tail = T.poly([[-14, 0], [-23, -7], [-20, 0], [-23, 7]]);
      T.shape(g, tail, T.M.vermL, { w: 0.5 });
      T.shape(g, body, T.vgrad(g, -7, 5, [T.M.goldL, T.M.gold, T.M.vermL]), { w: 0.6 });
      T.kanok(g, -2, -5.5, 7, -Math.PI / 2 - 0.6, true, { fill: T.M.verm, inner: T.M.goldL, w: 0.4 });
      for (const x of [-8, -3, 2]) T.stroke(g, T.lin([[x, -4], [x + 2.5, 0], [x, 4]]), T.M.goldD, 0.6);
      T.shape(g, T.circle(9, -1.5, 1.6), T.M.cream, { w: 0.3 }); T.fill(g, T.circle(9.4, -1.5, 0.8), T.M.ink);
      g.restore();
      for (const [x, y] of [[44, 50], [40, 44], [86, 60], [90, 54]]) { const d = new Path2D(); d.moveTo(x, y - 3.5); d.quadraticCurveTo(x + 2.6, y + 1, x, y + 2); d.quadraticCurveTo(x - 2.6, y + 1, x, y - 3.5); T.shape(g, d, T.M.cream, { w: 0.35 }); }
      // lotus pad and bud riding the water
      T.shape(g, T.P([[16, 86], [24, 82], [36, 84], [38, 88], [26, 90]], true, 4), T.M.jade, { w: 0.5 });
      T.lotus(g, 28, 84, 6.5);
      T.shape(g, T.P([[86, 92], [94, 89], [104, 91], [100, 95], [90, 95]], true, 4), T.M.jade, { w: 0.5 });
    },
  },
  fountain: {
    sky: (T) => ['#bfe0e6', T.M.sky, '#5e9cb8'],
    band: (T) => T.M.jadeD,
    draw(g, T) {
      T.cloud(g, 92, 34, 30, 14, { seed: 61, tail: 1, lobes: 3 });
      // garden: rock and shrubs behind
      T.khaoMo(g, 22, 84, 26, 40);
      T.muralTree(g, 98, 86, 30, { seed: 7 });
      // basin (อ่าง) with a lotus rim
      // jets: a naga rises from the basin, spouting an arc of water
      T.naga(g, 46, 86, 0.78, { dir: 1, neck: [[0, 0], [-6, -14], [-2, -30], [6, -40]], radii: [9, 8, 7, 6.5] });
      const jet = [[70, 52], [82, 44], [92, 50], [96, 66], [96, 80]];
      T.shape(g, T.poly(T.tubePts(jet, [2, 3, 3.4, 3, 2.4])), T.vgrad(g, 44, 80, ['#ffffff', '#cfeefb', '#8cc8ec']), { w: 0.6 });
      T.stroke(g, T.lin(jet.slice(0, -1)), '#5aa0d0', 0.7);
      for (const [x, y, r] of [[102, 58, 1.6], [88, 40, 1.4], [104, 72, 1.3], [80, 60, 1.2], [100, 46, 1.1]]) T.shape(g, T.circle(x, y, r), '#e6f6ff', { w: 0.3 });
      const basin = T.P([[18, 86], [104, 86], [96, 100], [26, 100]], true, 3, 0.25);
      T.shape(g, basin, T.vgrad(g, 84, 100, [T.M.cream, T.M.creamD, '#a8906a']), { w: 0.8 });
      T.lotusBand(g, 22, 100, 100, 9, { fill: T.M.jade, inner: T.M.jadeL, n: 8 });
      T.shape(g, T.poly([[14, 82], [108, 82], [106, 87], [16, 87]]), T.goldG(g, 0, 80, 0, 88), { w: 0.6 });
      T.dotLine(g, [[18, 84.5], [104, 84.5]], { spacing: 3.4, r: 0.65, smoothIt: false, jitter: 0 });
      T.clip(g, T.poly([[16, 70], [106, 70], [106, 82.5], [16, 82.5]]), () => T.waves(g, 16, 106, 82, { rows: 1, size: 8, cols: ['#7ab0dc'] }));
      T.prajam(g, 61, 92.5, 4.4, { petal: T.M.goldL, core: T.M.red });
    },
  },
  light: {
    sky: (T, L) => L.sky,
    band: (T, L) => (L.k === 'red' ? T.M.indigo : T.M.red),
    draw(g, T, L) {
      // a cloud-scroll canopy the lantern hangs from
      T.lantern(g, 60, 62, 13, { ...L, top: 16 });
      for (const [x, y, r] of [[28, 44, 3], [92, 42, 3.4], [30, 88, 2.6], [90, 90, 2.6]]) T.star(g, x, y, r, { petal: L.gemL, core: null, punch: false });
      T.cloud(g, 34, 26, 34, 14, { seed: 71, tail: -1, lobes: 3, top: T.M.goldL, bot: T.M.gold });
      T.cloud(g, 86, 26, 34, 14, { seed: 72, tail: 1, lobes: 3, top: T.M.goldL, bot: T.M.gold });
    },
  },
  magic: {
    sky: (T) => ['#4a1c6e', T.M.purple, T.M.purpleD],
    band: (T) => T.M.indigo,
    draw(g, T) {
      g.fillStyle = T.rgrad(g, 60, 62, 2, 48, ['rgba(255,240,190,0.95)', 'rgba(240,170,255,0.35)', 'rgba(120,40,160,0)']); g.fillRect(0, 0, 120, 120);
      // long sparkle rays between the petals
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + Math.PI / 16, r1 = i % 2 ? 34 : 44;
        T.fill(g, T.poly([[60 + Math.cos(a - 0.05) * 14, 62 + Math.sin(a - 0.05) * 14], [60 + Math.cos(a) * r1, 62 + Math.sin(a) * r1], [60 + Math.cos(a + 0.05) * 14, 62 + Math.sin(a + 0.05) * 14]]), 'rgba(255,240,200,0.75)');
      }
      // ring of kanok flames, then the ดาวเพดาน star
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2 + Math.PI / 8; T.kanok(g, 60 + Math.cos(a) * 14, 62 + Math.sin(a) * 14, 13, a, i % 2 === 1, { fill: T.M.vermL, inner: T.M.goldL, w: 0.5 }); }
      T.star(g, 60, 62, 30, { petal: T.goldG(g, 30, 32, 90, 92), core: T.M.red });
      T.star(g, 60, 62, 13, { petal: T.M.goldL, core: T.M.purple, punch: false });
      T.prajam(g, 60, 62, 5, { petal: T.M.cream, core: T.M.red });
      for (const [x, y, r] of [[26, 34, 4.4], [94, 32, 4], [24, 90, 3.6], [96, 88, 4.2], [60, 24, 3], [100, 62, 2.6], [20, 62, 2.6]]) spark(g, T, x, y, r);
      for (const [x, y] of [[36, 46], [86, 50], [40, 80], [82, 78], [70, 30], [48, 98], [74, 96]]) T.fill(g, T.circle(x, y, 1.1), T.M.goldL);
    },
  },
};
