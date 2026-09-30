// Stage tools: effect emitters you place (fire, torch, smoke, water,
// fountain, coloured lights, magic) and weather you toggle (rain, storm,
// wind, flood, earthquake, dusk, night, dawn).

import { paintSprite, leather, dye, line, holes, dotLine, INK, ellipsePts, poly, curve } from '../art/leather.js';

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
    return { sprite: icon('fire', (ctx) => { logs(ctx, 60, 100, 110); flame(ctx, 60, 92, 40); }), fx: 'fire', fxAt: [60, 88], glow: [60, 70, 90], glowColor: [1, 0.55, 0.2], mass: 2 };
  } },
  { id: 'fx-torch', name: 'คบเพลิง', en: 'Torch (hold it!)', cat: 'tools', build() {
    const sprite = icon('torch', (ctx) => {
      const p = poly([[26, 44], [34, 44], [32, 160], [28, 160]]);
      leather(ctx, p); dye(ctx, p, INK.brown, 0.8);
      const c = poly(ellipsePts(30, 42, 12, 8, 16)); leather(ctx, c); dye(ctx, c, INK.gold, 0.8);
      flame(ctx, 30, 40, 22);
    }, 60, 160);
    return { sprite, fx: 'fire', fxAt: [30, 30], glow: [30, 20, 70], glowColor: [1, 0.6, 0.25], grip: [30, 140], weapon: { kind: 'blunt', a: [30, 40], b: [30, 160] } };
  } },
  { id: 'fx-smoke', name: 'กระถางธูป', en: 'Incense burner (smoke)', cat: 'tools', build() {
    return { sprite: icon('smoke', (ctx) => {
      const p = poly(curve([[20, 70], [100, 70], [92, 110], [28, 110]], true, 6)); leather(ctx, p); dye(ctx, p, INK.gold, 0.7);
      dotLine(ctx, [[30, 84], [90, 84]], { spacing: 5, r: 1.3 });
      for (const x of [48, 60, 72]) { const s = poly([[x - 1.5, 30], [x + 1.5, 30], [x + 1.5, 72], [x - 1.5, 72]]); leather(ctx, s); dye(ctx, s, INK.red, 0.9); }
    }), fx: 'smoke', fxAt: [60, 28] };
  } },
  { id: 'fx-water', name: 'สายน้ำ', en: 'Rippling water', cat: 'tools', build() {
    return { sprite: paintSprite(700, 90, (ctx, { rng: r }) => {
      const top = [];
      for (let x = 0; x <= 700; x += 20) top.push([x, 20 + Math.sin(x * 0.03) * 10]);
      const p = poly([...top, [700, 90], [0, 90]]);
      leather(ctx, p, { edge: false }); dye(ctx, p, INK.blue, 0.85);
      for (let k = 0; k < 3; k++) dotLine(ctx, top.map(([x, y]) => [x, y + 18 + k * 20 + Math.sin(x * 0.05 + k) * 5]), { spacing: 6, r: 1.4, seed: k });
    }, { name: 'fx-water', px: 1 }), static: true, float: false };
  } },
  { id: 'fx-fountain', name: 'น้ำพุ', en: 'Fountain', cat: 'tools', build() {
    return { sprite: icon('fountain', (ctx) => {
      const b = poly(curve([[10, 90], [110, 90], [95, 118], [25, 118]], true, 6)); leather(ctx, b); dye(ctx, b, INK.jade, 0.7);
      const c = poly([[54, 60], [66, 60], [64, 92], [56, 92]]); leather(ctx, c); dye(ctx, c, INK.gold, 0.8);
      dotLine(ctx, [[20, 100], [100, 100]], { spacing: 5, r: 1.3 });
    }), fx: 'fountain', fxAt: [60, 58], static: true };
  } },
  ...[['gold', [1, 0.8, 0.4], INK.yellow, 'ไฟทอง', 'Golden light'], ['red', [1, 0.3, 0.2], INK.red, 'ไฟแดง', 'Red light'], ['blue', [0.35, 0.55, 1], INK.blue, 'ไฟฟ้าคราม', 'Blue light'], ['green', [0.4, 1, 0.5], INK.green, 'ไฟเขียว', 'Green light']].map(([k, c, ink, th, en]) => ({
    id: 'fx-light-' + k, name: th, en, cat: 'tools', build() {
      return { sprite: icon('light-' + k, (ctx) => {
        const p = poly(ellipsePts(60, 60, 26, 30, 24)); leather(ctx, p); dye(ctx, p, ink, 0.95);
        holes(ctx, [[60, 60]], 8);
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; line(ctx, [[60 + Math.cos(a) * 34, 60 + Math.sin(a) * 38], [60 + Math.cos(a) * 50, 60 + Math.sin(a) * 54]], ink, 4, { smoothIt: false }); }
      }), glow: [60, 60, 220], glowColor: c, static: true };
    },
  })),
  { id: 'fx-magic', name: 'ประกายเวทย์', en: 'Magic sparkles', cat: 'tools', build() {
    return { sprite: icon('magic', (ctx) => {
      const p = poly([[60, 10], [70, 50], [110, 60], [70, 70], [60, 110], [50, 70], [10, 60], [50, 50]]); leather(ctx, p); dye(ctx, p, INK.gold, 0.9); holes(ctx, [[60, 60]], 6);
    }), fx: 'sparkle', fxAt: [60, 60], glow: [60, 60, 120], glowColor: [1, 0.85, 0.5], static: true };
  } },
  // weather: dropping one toggles it (no actor is created)
  ...[['rain', 'ฝนตก', 'Rain'], ['storm', 'พายุฟ้าผ่า', 'Thunderstorm'], ['wind', 'ลมพัด', 'Wind'], ['flood', 'น้ำท่วม', 'Flood'], ['quake', 'แผ่นดินไหว', 'Earthquake'], ['dawn', 'รุ่งอรุณ', 'Dawn light'], ['dusk', 'ยามเย็น', 'Dusk light'], ['night', 'ราตรี', 'Moonlight']].map(([k, th, en]) => ({
    id: 'wx-' + k, name: th, en, cat: 'weather', build() { return { sprite: weatherIcon(k), weather: k }; },
  })),
];

function weatherIcon(k) {
  return paintSprite(120, 120, (ctx) => {
    const cloud = () => { const p = poly(curve([[20, 60], [28, 38], [50, 34], [62, 22], [84, 28], [96, 44], [104, 62]], false, 8).concat([[104, 66], [20, 66]])); leather(ctx, p); dye(ctx, p, INK.indigo, 0.6); dotLine(ctx, [[30, 58], [96, 58]], { spacing: 5, r: 1.2 }); };
    if (k === 'rain' || k === 'storm') {
      cloud();
      for (let i = 0; i < 5; i++) line(ctx, [[30 + i * 15, 76], [24 + i * 15, 100]], INK.blue, 4, { smoothIt: false });
      if (k === 'storm') { const b = poly([[64, 66], [52, 92], [62, 92], [54, 116], [76, 86], [66, 86], [74, 66]]); leather(ctx, b); dye(ctx, b, INK.yellow, 0.95); }
    } else if (k === 'wind') {
      for (let i = 0; i < 3; i++) line(ctx, [[14, 40 + i * 20], [70, 38 + i * 20], [96, 30 + i * 20], [90, 18 + i * 20]], INK.leather, 6);
    } else if (k === 'flood') {
      for (let i = 0; i < 3; i++) { const top = []; for (let x = 10; x <= 110; x += 10) top.push([x, 40 + i * 24 + Math.sin(x * 0.12 + i) * 6]); const p = poly([...top, [110, 40 + i * 24 + 14], [10, 40 + i * 24 + 14]]); leather(ctx, p); dye(ctx, p, INK.blue, 0.85); }
    } else if (k === 'quake') {
      const p = poly([[10, 80], [40, 70], [55, 90], [70, 64], [85, 86], [110, 76], [110, 110], [10, 110]]); leather(ctx, p); dye(ctx, p, INK.brown, 0.8);
      line(ctx, [[60, 20], [52, 40], [66, 50], [56, 72]], INK.leather, 5, { smoothIt: false });
    } else {
      const col = k === 'night' ? INK.cream : k === 'dusk' ? INK.vermilion : INK.orange;
      const p = poly(ellipsePts(60, 60, 34, 34, 28)); leather(ctx, p); dye(ctx, p, col, 0.9);
      if (k === 'night') holes(ctx, [[72, 50]], 26);
      else for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; line(ctx, [[60 + Math.cos(a) * 42, 60 + Math.sin(a) * 42], [60 + Math.cos(a) * 56, 60 + Math.sin(a) * 56]], col, 5, { smoothIt: false }); }
    }
  }, { name: 'wx-' + k });
}
