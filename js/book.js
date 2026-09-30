// สมุดข่อยของน้องเมฆ — the folding book the tutorial deva leaves behind.
// Accordion pages of cream khoi paper with a ประจำยาม border; you flip
// them with the arrows, a swipe, a click on the page edge or the arrow
// keys. Documents every function of the theatre, keeps the quest scroll
// and can call the tutorial back.

import { drawDeva } from './render/deva.js';
import { CATEGORIES } from './content.js';
import { ROLES } from './sandbox/flies.js';
import { SCENES } from './sandbox/scenes.js';
import { ANIMS, KEY_MOVES } from './puppet/animations.js';
import { GESTURES, GESTURE_LABELS } from './tracking/gestures.js';
import { thumbnail } from './ui.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TH = (n) => String(n).replace(/\d/g, (d) => '๐๑๒๓๔๕๖๗๘๙'[d]);
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

// 24×24 stroke glyphs (same hand as the game's medallions)
const I = {
  drag: 'M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V5.5a1.5 1.5 0 0 1 3 0V13M17 12v-2.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L4.6 14.9a1.6 1.6 0 0 1 2.4-2L8 14',
  string: 'M12 2v7M12 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 13l-5 8M12 13l5 8M4 2l5 11M20 2l-5 11',
  walk: 'M13 4a2 2 0 1 1 0 .1M9 21l2-6 3 3v3M10 11l1-3 4 2 3 1M11 8l-3 3-3-1',
  depth: 'M12 3c2 3 3.5 4.6 3.5 7a3.5 3.5 0 0 1-7 0C8.5 7.6 10 6 12 3zM3 21h18M6 17l3-3M18 17l-3-3',
  flip: 'M7 7h11l-3-3M17 17H6l3 3',
  chest: 'M3 10h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 10c0-4 4-6 9-6s9 2 9 6M10 12h4v3h-4zM3 14h7M14 14h7',
  hand: 'M9 12V5.5a1.5 1.5 0 0 1 3 0V11M12 10V4a1.5 1.5 0 0 1 3 0v7M15 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7 6 6 0 0 1-5-3l-2.4-4a1.5 1.5 0 0 1 2.5-1.6L9 15',
  deva: 'M12 2l1.4 3.4h-2.8zM12 6.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM7 21c0-4 2.2-7 5-7s5 3 5 7M4 11c2 1 3.5 1 5 0M20 11c-2 1-3.5 1-5 0',
  soul: 'M12 21c-4 0-6-3-6-6 0-4 3-6 4-10 1 3 4 4 4 7 1-1 1-2 1-3 2 2 3 4 3 6 0 3-2 6-6 6z',
  ward: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM9 9h6v6H9zM12 9v6M9 12h6',
  mend: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  summon: 'M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z',
  tear: 'M5 4l6 7-3 2 8 7M14 4l-2 5 4 1',
  lamp: 'M12 3c2 3 3.5 4.6 3.5 7a3.5 3.5 0 0 1-7 0C8.5 7.6 10 6 12 3zM6 16h12l-1.5 4h-9zM9 13.5h6',
  rain: 'M6.5 14a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 16.8 5 4.5 4.5 0 0 1 17.5 14zM8 17l-1 3M12 17l-1 3M16 17l-1 3',
  bolt: 'M13 2L5 13h6l-2 9 9-12h-6z',
  wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8',
  wave: 'M2 12c2-2 4-2 5 0s3 2 5 0 3-2 5 0 3 2 5 0M2 17c2-2 4-2 5 0s3 2 5 0 3-2 5 0 3 2 5 0',
  quake: 'M3 12h4l2-5 3 10 2-7 2 4h5',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  fire: 'M12 2c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 0 2 1 3 2 3 0-3 0-5 1-8z',
  animal: 'M5 14c0-4 3-7 7-7s7 3 7 7v3H5zM7 17v3M17 17v3M9 11h.01M15 11h.01M3 10l2 2M21 10l-2 2',
  herd: 'M3 16c0-3 2-5 5-5s5 2 5 5v2H3zM11 17c0-3 2-5 5-5s5 2 5 5v2h-8M6 11V9M15 12v-2',
  sleep: 'M4 12a8 8 0 1 0 8-8M15 3h5l-5 5h5M9 9h3l-3 3h3',
  run: 'M13 4a2 2 0 1 1 0 .1M4 20l4-5 3 2 2-5 5 2M9 9l3-2 3 2',
  hunt: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  swim: 'M2 18c2-2 4-2 5 0s3 2 5 0 3-2 5 0 3 2 5 0M8 13l3-5 4 2M15 5a2 2 0 1 1 0 .1',
  fly: 'M12 12c-3-5-7-6-10-5 2 3 5 5 10 5zM12 12c3-5 7-6 10-5-2 3-5 5-10 5zM12 12v6',
  scene: 'M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6',
  pad: 'M6 9h12a4 4 0 0 1 3.8 5.2l-1.3 4a2 2 0 0 1-3.4.7L15 17H9l-2.1 1.9a2 2 0 0 1-3.4-.7l-1.3-4A4 4 0 0 1 6 9z',
  joy: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  sword: 'M4 20L16 8M16 8l2-4 2 2-4 2M7 13l4 4',
  leap: 'M12 20V5M6 11l6-6 6 6',
  wheel: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18M3 12h18',
  next: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4',
  cam: 'M3 8h3l2-3h8l2 3h3v11H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4',
  rec: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  cut: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.1 7.9L20 20M8.1 16.1L20 4',
  export: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  import: 'M12 21V9M7 14l5-5 5 5M5 3h14',
  wide: 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4',
  show: 'M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  sound: 'M4 9h4l5-4v14l-5-4H4zM16 8.5a4.5 4.5 0 0 1 0 7',
  clear: 'M14 3l-4 9M7 12h8l2 9H5z',
  help: 'M9.2 9a3 3 0 1 1 4.3 2.7c-1 .5-1.5 1.2-1.5 2.3M12 18h.01',
  book: 'M3 5.5l4.5-2 4.5 2 4.5-2 4.5 2v14l-4.5-2-4.5 2-4.5-2L3 19.5zM7.5 3.5v14M12 5.5v14M16.5 3.5v14',
  quest: 'M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6M6 3a2 2 0 0 0-2 2v1h4V5a2 2 0 0 0-2-2zM6 21a2 2 0 0 1-2-2v-1h4v1a2 2 0 0 1-2 2zM10 8h6M10 12h6M10 16h4',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  build: 'M3 21h18M6 21V11h12v10M4 11l8-7 8 7M10 21v-5h4v5',
  ball: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 5l-2 5 3 4h4l3-4-2-5M7 10H3.5M17 10h3.5',
  pong: 'M10 3a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13M14.5 14.5L20 20M19 4.5h.01',
  rope: 'M6 3v6M18 3v6M6 9c0 13 12 13 12 0M12 12v3',
  lock: 'M12 1.5v3.2M10.3 4.7h3.4l-.4 2.6h-2.6zM9 7.3h6l1.3 4.2H7.7zM6.6 11.5h10.8v2.6H6.6zM5 14.1h14v2.4H5zM3.6 16.5h16.8v4.3H3.6z',
  check: 'M5 12l5 5 9-10',
  prop: 'M4 20l10-10M14 10l3-7 4 4-7 3M6 14l4 4',
  keys: 'M3 7h18v10H3zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10',
};
const ROLE_ICON = {
  fighter: I.sword, dancer: 'M12 21c-4-3-7-6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4-3 7-7 10zM12 8v13',
  merchant: 'M4 9l2-5h12l2 5M4 9h16v11H4zM9 20v-6h6v6', villager: 'M3 11l9-7 9 7M6 10v10h12V10',
  comedian: 'M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0M8 14c1 2 2.5 3 4 3s3-1 4-3M8.5 9.5h.01M15.5 9.5h.01', monster: I.fire,
  coward: 'M12 3v11M12 18h.01M5 21h14', follower: 'M5 12h10M11 7l5 5-5 5M19 5v14', wander: 'M3 17c3-6 6 2 9-4s6 2 9-4',
  takraw: I.ball, pingpong: I.pong, jumprope: I.rope,
};
const ROLE_TEXT = {
  fighter: ['หาคู่ต่อสู้แล้วฟันฟัน ป้อง หลบ เล็งจุดสำคัญ', 'Seeks a rival: strikes, blocks, dodges, aims for vitals'],
  dancer: ['รำท่าแม่บทต่อเนื่องไม่หยุด', 'Dances the classical suites without stopping'],
  merchant: ['ตั้งแผง เรียกลูกค้า ต่อรองราคา', 'Sets up shop, calls customers, haggles'],
  villager: ['เดินเล่น ทักทายเพื่อนบ้าน', 'Strolls about and greets the neighbours'],
  comedian: ['เล่นมุกตลก หัวเราะ แกล้งคนอื่น', 'Cracks jokes, laughs, teases the others'],
  monster: ['คำรามไล่ขย้ำทุกคน', 'Roars and attacks everyone'],
  coward: ['วิ่งหนีทุกอย่างที่น่ากลัว', 'Runs from anything scary'],
  follower: ['เดินตามตัวหนังที่เลือกอยู่', 'Follows the selected puppet'],
  wander: ['เดินเรื่อยเปื่อยไปทั่วจอ', 'Wanders aimlessly along the cloth'],
  takraw: ['เข้าวงเตะตะกร้อกับเพื่อนใกล้ลูก', 'Joins a takraw circle near a ball'],
  pingpong: ['ถือไม้ตีปิงปองข้ามโต๊ะ', 'Takes a paddle and plays across the table'],
  jumprope: ['แกว่งเชือกหรือกระโดดข้ามเชือก', 'Turns the rope or jumps it'],
};
const CAT_TEXT = {
  scenes: ['ล้างจอแล้วจัดฉากทั้งชุด พร้อมแสง อากาศ และนักแสดง', 'Clears the cloth and lays out a whole scene with light, weather and cast'],
  puppets: ['ตัวหนังพระ นาง ยักษ์ ตัวตลก ฤๅษี', 'Heroes, heroines, giants, clowns, the hermit'],
  tools: ['ไฟ ควัน น้ำพุ ประกาย ไฟสี', 'Fire, smoke, fountains, sparkles, coloured lights'],
  weather: ['วางแล้วสลับเปิดปิด ไม่มีตัวบนจอ', 'Dropping one toggles it — nothing appears'],
  magic: ['วางบนตัวหนังหรือสัตว์', 'Drop onto a puppet or animal'],
  imports: ['ภาพของท่านเองจากโต๊ะตัดต่อ', 'Your own images, from the editor'],
  weapons: ['ปล่อยใกล้มือให้ถือ', 'Drop near a hand to wield'],
  market: ['แผงลอย ตาชั่ง รถเข็น', 'Stalls, scales, carts'],
  food: ['ผลไม้ ขนม ของกิน', 'Fruit, snacks, dishes'],
  household: ['ของใช้ในบ้าน ตะเกียง โอ่ง', 'Household things, lamps, jars'],
  instruments: ['แตะเพื่อบรรเลง', 'Tap to play'],
  animals: ['มีนิสัยเป็นของตัวเอง', 'Each has its own mind'],
  monsters: ['นาค มังกร กระสือ ครุฑ', 'Naga, dragon, krasue, garuda'],
  buildings: ['สร้างขึ้นในนั่งร้านไม้ไผ่', 'Rise from bamboo scaffolding'],
  boats: ['เรือพายและเรือหางยาว', 'Rowing and long-tail boats'],
  nature: ['ภูเขา หิน บ่อบัว ดวงจันทร์', 'Hills, rocks, lotus ponds, the moon'],
  foliage: ['ต้นไม้ไหวตามลม', 'Trees that sway in the wind'],
  games: ['ตะกร้อ ปิงปอง เชือก', 'Takraw, ping-pong, jump rope'],
  vehicles: ['ตุ๊กตุ๊ก สามล้อ เกวียน', 'Tuk-tuk, samlor, ox cart'],
};

function row(k, th, en) {
  let lead;
  if (k && typeof k === 'object' && k.key) lead = `<span class="bk-key">${esc(k.key)}</span>`;
  else if (k && typeof k === 'object' && k.node) lead = '<span class="bk-thumb" data-thumb="' + esc(k.node) + '"></span>';
  else lead = `<span class="bk-ic">${svg(k || I.help)}</span>`;
  return `<div class="bk-row">${lead}<div class="bk-tx"><p class="th">${th}</p><p class="en">${esc(en)}</p></div></div>`;
}
const head = (icon, th, en, n) => `<header class="bk-h"><span class="bk-hic">${svg(icon)}</span><div><h3>${th}</h3><small>${esc(en)}</small></div>${n != null ? `<b class="bk-n">${TH(n)}</b>` : ''}</header>`;
const para = (th, en) => `<p class="bk-p">${th}<small>${esc(en)}</small></p>`;

export class Book {
  constructor(tut) {
    this.tut = tut;
    this.game = tut.game;
    this.page = 0;
    this.isOpen = false;
    this._build();
  }

  // ---------------------------------------------------------- pages
  _pages() {
    const g = this.game;
    const P = [];
    const topics = [];
    const add = (id, th, en, icon, body, cls = '') => { P.push({ id, cls, html: body }); if (th) topics.push({ id, th, en, icon, i: P.length - 1 }); };

    // cover (the black lacquered board of a สมุดไทยดำ)
    add('cover', null, null, null, `<div class="bk-cover">
      <div class="bk-cv-title">สมุดข่อย<br><span>ของน้องเมฆ</span></div>
      <canvas class="bk-deva" width="260" height="220"></canvas>
      <div class="bk-cv-sub">ตำราเชิดหนังตะลุงฉบับเทวดา<small>Mek's folding book of the shadow theatre</small></div>
      <div class="bk-cv-hint">พลิกหน้า ➜<small>swipe, click the edge or use ← →</small></div></div>`, 'cover');
    add('contents', null, null, null, '', 'contents'); // filled below

    add('puppeteer', 'เชิดหนัง', 'Working a puppet', I.drag, head(I.drag, 'เชิดหนัง', 'Working a puppet') +
      row(I.drag, 'ลากตัวหนัง = ถือไม้ตับ พาไปทั่วจอ ยกสูงแล้วปล่อยจะห้อยเชือก', 'Drag a puppet to carry it by the main rod; lift high and let go and it hangs') +
      row(I.string, 'ลากใกล้มือ เท้า หรือหัว (จุดทอง) = ดึงเชือกแขนขา', 'Drag near a hand, foot or head (gold beads) to pull that string') +
      row(I.walk, 'แตะผ้าว่าง ตัวหนังที่เลือกจะเดินไปตรงนั้น', 'Tap empty cloth and the selected puppet walks there') +
      row(I.depth, 'ล้อเมาส์ · แถบเลื่อน · Q/E = เข้าใกล้ตะเกียงหรือแนบจอ ใกล้ตะเกียงเงาใหญ่และเบลอ แนบจอเงาคม', 'Wheel, slider or Q/E: toward the lamp (big, soft shadow) or onto the cloth (sharp)') +
      row({ key: 'F' }, 'กด F หรือคลิกขวา = หันกลับ', 'F or right-click turns it around') +
      row({ key: '← →' }, 'ลูกศร / A D เดิน · ↑ ↓ / W S ยกขึ้นลง', 'Arrows or A/D walk · ↑↓ or W/S lift and lower') +
      row({ key: 'Tab' }, 'สลับตัวหนังที่เลือก · Delete = เก็บเข้าหีบ', 'Next puppet · Delete puts it away'));

    const sideMoves = ['strike', 'lunge', 'block', 'dance', 'ram-medley', 'ram-theppranom', 'ram-kinnorn', 'wai', 'leap', 'roar', 'laugh', 'wong', 'bow', 'wave', 'cheer'];
    const keyOf = Object.fromEntries(Object.entries(KEY_MOVES).map(([k, v]) => [v, k.replace('Digit', '')]));
    add('moves', 'ท่ารำ ท่าสู้', 'Moves & dances', I.sword, head(I.sword, 'ท่ารำ ท่าสู้', 'Moves & dances') +
      para('กดปุ่มตัวเลข เหรียญ “ท่า” ในวงแหวน หรือวงล้อท่าบนแผงควบคุม', 'Number keys, the “moves” medallion in the ring, or the pad’s move wheel') +
      `<div class="bk-grid">${sideMoves.filter((m) => ANIMS[m]).map((m) => `<div class="bk-cell">${keyOf[m] ? `<span class="bk-key s">${keyOf[m]}</span>` : '<span class="bk-key s dim">·</span>'}<span>${esc(ANIMS[m].th)}<small>${esc(ANIMS[m].en)}</small></span></div>`).join('')}</div>` +
      para('ท่ารำชุดใช้ท่าแม่บท: เทพประนม ปฐมพรหม สอดสร้อยมาลา กินนรเลียบถ้ำ ชะนีร่ายไม้ …', 'The dance suites string classical mae-bot poses: Deva in prayer, Four-faced Brahma, Kinnari by the cave, Gibbon…'));

    const cats = CATEGORIES.filter(([id]) => id !== 'imports');
    add('chest', 'หีบหนัง', 'The puppet chest', I.chest, head(I.chest, 'หีบหนัง', 'The puppet chest') +
      para('แตะหีบ เลือกลิ้นชัก แล้วลากของไปวางบนจอ ของที่ปิดผนึกด้วยเจดีย์ทองต้องทำภารกิจก่อน', 'Tap the chest, pick a drawer, drag a piece onto the cloth. Pieces sealed with a gold chedi need a quest') +
      `<div class="bk-cats">${cats.map(([id, th, en]) => `<div class="bk-cat" title="${esc((CAT_TEXT[id] || ['', ''])[1])}"><span class="bk-thumb" data-cat="${id}"></span><span>${esc(th)}<small>${esc(en)}</small></span></div>`).join('')}</div>` +
      row(I.prop, 'ปล่อยของใกล้มือ ตัวหนังจะถือไว้ · แตะเครื่องดนตรีเพื่อเล่น', 'Drop a prop near a hand to give it · tap instruments to play them') +
      row(I.build, 'บ้านและวัดค่อยๆ สร้างขึ้นในนั่งร้าน ตัวละครถูกอัญเชิญลงมาจากแสง', 'Buildings rise in scaffolding; figures are summoned down a shaft of light'));

    add('devas', 'เทวดาช่วยเชิด', 'Devas take the strings', I.deva, head(I.deva, 'เทวดาช่วยเชิด', 'Devas take the strings') +
      para('เลือกตัวหนัง แตะเหรียญเทวดา แล้วเลือกบท เทวดาจะคุกเข่าบนเมฆแล้วเชิดให้เอง ลากตัวหนังเมื่อไหร่ ท่านก็รับเชือกคืน', 'Select a puppet, tap the deva medallion, choose a role. A deva kneels on a cloud and plays it; drag the puppet to take the strings back') +
      `<div class="bk-roles">${ROLES.map(([id, th, en]) => `<div class="bk-role"><span class="bk-ic s">${svg(ROLE_ICON[id] || I.deva)}</span><span><b>${esc(th)}</b> <i>${esc(en)}</i><small>${esc((ROLE_TEXT[id] || ['', ''])[0])}</small></span></div>`).join('')}</div>` +
      row(I.next, 'ปล่อย (ลูกศรลง) = เทวดาวางเชือก', 'Release (down arrow) — the deva lets go'));

    add('games', 'กีฬาพื้นบ้าน', 'Folk games', I.ball, head(I.ball, 'กีฬาพื้นบ้าน', 'Folk games') +
      row(I.ball, 'ตะกร้อ: วางลูกตะกร้อ แล้วมอบบท “เตะตะกร้อ” ให้ ๒–๔ ตัว เขาจะเตะเข่า ศอก ส้น ต่อกันเป็นวง', 'Takraw: drop a ball, cast 2–4 puppets as takraw players; they keep it up with knee, heel and header') +
      row(I.pong, 'ปิงปอง: วางโต๊ะกับไม้ปิงปองสองอัน แล้วมอบบท “ปิงปอง” ให้สองตัวคนละฝั่ง', 'Ping-pong: a table and two paddles, then cast one player on each side') +
      row(I.rope, 'กระโดดเชือก: วางเชือก สองตัวแกว่ง ที่เหลือกระโดด สะดุดก็ล้มได้นะ', 'Jump rope: two turn, the rest jump — and trip') +
      row(I.drag, 'ลากลูกบอลเองก็ได้ หรือเตะด้วยการดึงเชือกเท้า', 'You can throw the ball yourself or kick it by pulling a foot string') +
      para('ลูกบอลมีฟิสิกส์ของตัวเอง เด้ง หมุน เลี้ยว', 'The balls have their own physics: bounce, spin and curve'));

    add('magic', 'ขวัญและเวทมนตร์', 'Souls & magic', I.soul, head(I.soul, 'ขวัญและเวทมนตร์', 'Souls & magic') +
      row(I.tear, 'ตัวหนังคือหนังวัว ตีแรงๆ จะขาด แขนขาหลุดได้ แสงลอดรอยฉีก', 'Puppets are hide: hard blows rip them, limbs can fall off, light shines through the tears') +
      row(I.soul, 'ปลุกเสก: ให้วิญญาณ รู้สึกเจ็บ เลือดไหล ร้องไห้ และตายได้ วิญญาณลอยออกจากร่าง', 'Soul: it feels, bleeds, weeps and can die — the soul rises out') +
      row(I.ward, 'ลงยันต์: เกราะทองรับแรงฟันจนกว่าพลังจะหมด', 'Yantra ward: a golden shield soaks blows until its power fades') +
      row(I.mend, 'ชุบชีวิต: รักษาแผล เย็บแขนขาคืน เรียกวิญญาณกลับ', 'Mend: closes wounds, stitches limbs back, calls the soul home') +
      row(I.summon, 'อัญเชิญ: เรียกผีหรือสัตว์วิเศษแบบสุ่มลงจากฟ้า', 'Summon: a random spirit or beast descends') +
      row(I.fire, 'ไฟไหม้หนังได้ ตัวที่มีวิญญาณจะรู้สึกร้อน', 'Fire chars the hide; a souled puppet feels the heat') +
      para('ใช้จากลิ้นชักเวทมนตร์ หรือเหรียญข้างตัวหนังที่เลือก', 'From the magic drawer, or the medallions beside a selected puppet'));

    add('weather', 'ตะเกียง ลม ฟ้า', 'Lamp, weather & effects', I.lamp, head(I.lamp, 'ตะเกียง ลม ฟ้า', 'Lamp, weather & effects') +
      row(I.lamp, 'เหรียญตะเกียง: ตะเกียงน้ำมัน (ไหวระริก) ⇄ หลอดไฟฟ้า', 'Lamp medallion: flickering oil lamp ⇄ electric bulb') +
      row({ key: 'Alt' }, 'Alt + ลาก (หรือลากจุดสว่าง) = ย้ายแสง เงาทุกตัวเปลี่ยนตาม', 'Alt + drag (or drag the bright spot) moves the light; every shadow follows') +
      `<div class="bk-grid w">${[[I.rain, 'ฝนตก', 'Rain'], [I.bolt, 'พายุฟ้าผ่า', 'Thunderstorm'], [I.wind, 'ลมพัด', 'Wind (trees sway)'], [I.wave, 'น้ำท่วม', 'Flood (animals swim)'], [I.quake, 'แผ่นดินไหว', 'Earthquake'], [I.sun, 'รุ่งอรุณ · ยามเย็น', 'Dawn · dusk light'], [I.moon, 'ราตรี', 'Moonlight (animals sleep)'], [I.fire, 'ไฟ ควัน น้ำพุ ไฟสี', 'Fire, smoke, fountains, lights']].map(([ic, th, en]) => `<div class="bk-cell"><span class="bk-ic s">${svg(ic)}</span><span>${th}<small>${en}</small></span></div>`).join('')}</div>` +
      para('ลมฟ้าอากาศวางแล้วสลับเปิดปิด เปิดหลายอย่างพร้อมกันได้', 'Weather toggles when dropped; several can run at once'));

    add('animals', 'สัตว์ป่า สัตว์บ้าน', 'Animals', I.animal, head(I.animal, 'สัตว์ป่า สัตว์บ้าน', 'Animals') +
      row(I.animal, 'สัตว์ทุกตัวมีสมองเล็กๆ ของตัวเอง: เล็มหญ้า เดินเล่น เล่นกัน', 'Every animal has a little mind: grazes, wanders, plays') +
      row(I.herd, 'อยู่เป็นฝูง ลูกเดินตามแม่ (ลูกควาย ลูกช้าง ลูกเจี๊ยบ หมูเด้ง)', 'Herds stick together; babies follow their mothers (calf, elephant calf, chicks, Moo Deng)') +
      row(I.sleep, 'กลางคืนส่วนใหญ่หลับ แต่แมว กบ เสือ ออกหากิน', 'At night most sleep; cats, frogs and tigers prowl') +
      row(I.run, 'ตัวขี้ตกใจวิ่งหนีอันตราย ไฟ และการต่อสู้', 'Timid ones flee danger, fire and fights') +
      row(I.hunt, 'เสือซุ่มล่า จระเข้ดักรอ ไก่ชนตีกัน ลิงชอบแกล้ง', 'Tigers stalk, crocodiles lurk, fighting cocks spar, monkeys pester') +
      row(I.swim, 'น้ำท่วมแล้วควาย ช้าง เป็ด ปลา ว่ายน้ำ', 'In a flood buffalo, elephants, ducks and fish swim') +
      row(I.fly, 'นกบินได้บ้าง ครุฑกับมังกรบินตลอด กระสือลอย', 'Some birds fly; garuda and dragon always, krasue floats') +
      row({ key: '🦛' }, 'หมูเด้งแสบที่สุด วางอาหารใกล้ๆ เธอจะงับ!', 'Moo Deng is the sassiest — drop food near her and she chomps it'));

    add('scenes', 'ฉากสำเร็จรูป', 'Ready-made scenes', I.scene, head(I.scene, 'ฉากสำเร็จรูป', 'Ready-made scenes') +
      para('ลิ้นชักฉาก: ล้างจอ ตั้งแสงและอากาศ แล้วจัดฉากทีละชิ้น นักแสดงมาทีหลังพร้อมบทบาท', 'Scenes drawer: clears the cloth, sets light and weather, builds the set piece by piece; the cast arrives last with roles') +
      `<div class="bk-scenes">${SCENES.map((s) => `<div class="bk-scene"><span class="bk-thumb" data-thumb="scene-${s.id}"></span><span>${esc(s.name)}<small>${esc(s.en)}</small></span></div>`).join('')}</div>`);

    add('pad', 'แผงควบคุม', 'The game pad', I.pad, head(I.pad, 'แผงควบคุม', 'The game pad') +
      para('เหรียญแผงควบคุม เปิดปิดปุ่มแบบเกมเลื่อนข้าง ใช้ได้ทั้งจอสัมผัสและเมาส์', 'The pad medallion toggles side-scroller controls for touch and mouse') +
      row(I.joy, 'จอยสติ๊ก: เดินซ้ายขวา ดันขึ้น = กระโดด ฉากยาวจะเลื่อนตาม', 'Joystick walks; push up to leap; long stages scroll along') +
      row(I.sword, 'ปุ่มดาบใหญ่: โจมตี (ถืออาวุธจะฟันหรือแทง)', 'Big sword: attack (strike or lunge when armed)') +
      row(I.leap, 'ปุ่มลูกศรขึ้น: กระโดด', 'Up arrow: leap') +
      row(I.wheel, 'วงล้อท่า: ท่ารำและท่าสู้ทั้งหมดบานออกรอบนิ้ว', 'Move wheel: every move blooms around your thumb') +
      row(I.prop, 'วงล้ออาวุธ: เปลี่ยนอาวุธในมือ หรือมือเปล่า', 'Weapon wheel: swap the weapon in hand, or bare hands') +
      row(I.next, 'ลูกศรวน: สลับไปตัวหนังตัวถัดไป', 'Circle arrows: next puppet'));

    add('hands', 'เชิดด้วยมือ', 'Hand tracking', I.hand, head(I.hand, 'เชิดด้วยมือ', 'Hand tracking') +
      row(I.hand, 'เปิดกล้อง: ฝ่ามือ = ตัว · ขนาดมือ = ระยะจากจอ · เอียงมือ = โน้มตัว · พลิกมือ = หันกลับ', 'Camera: palm = body · hand size = depth · tilt = lean · flip hand = turn') +
      row(I.string, 'นิ้วโป้ง ชี้ กลาง นาง ก้อย = แขนหลัง แขนหน้า หัว ขาหลัง ขาหน้า', 'Thumb, index, middle, ring, pinky → back arm, front arm, head, back leg, front leg') +
      `<div class="bk-grid">${GESTURES.map((k) => { const mv = { fist: 'strike', point: 'lunge', open: 'block', jeeb: 'dance', wong: 'wong', victory: 'leap', horns: 'roar', thumbsUp: 'laugh' }[k]; return `<div class="bk-cell"><span class="bk-key s">${esc(GESTURE_LABELS[k].th)}</span><span>${esc(ANIMS[mv]?.th || '')}<small>${esc(GESTURE_LABELS[k].en)} → ${esc(ANIMS[mv]?.en || mv)}</small></span></div>`; }).join('')}</div>` +
      row(I.deva, 'สองมือ = สองตัวหนัง · พนมมือ 🙏 = ไหว้ทั้งคู่', 'Two hands work two puppets · palms together 🙏 = both wai') +
      row(I.summon, 'เหรียญสาธิต: มือจำลองเชิดให้ดูทีละท่า ไม่ต้องใช้กล้อง', 'Demo medallion: a simulated hand shows each pose, no camera needed'));

    add('editor', 'โต๊ะตัดต่อ', 'The timeline editor', I.film, head(I.film, 'โต๊ะตัดต่อ', 'The timeline editor') +
      row(I.rec, 'อัด: บันทึกเทคจากเวทีสด กดอีกครั้งเพื่อหยุด', 'Record a take of the live stage; press again to stop') +
      row(I.cut, 'ตัดที่หัวอ่าน · ทำซ้ำ · เลื่อนซ้ายขวา · ลบคลิป', 'Split at the playhead · duplicate · move earlier/later · delete') +
      row(I.drag, 'ลากบนแถบ = เลื่อนหัวอ่าน · ลากขอบคลิป = ตัดหัวท้าย', 'Drag the strip to scrub · drag a clip edge to trim') +
      row(I.wide, 'ขยายฉากให้ยาวขึ้น (สูงสุด ๔ เท่า) ฉากเลื่อนตามตัวหนัง', 'Make the stage longer (up to 4×); the view follows your puppet') +
      row(I.import, 'นำเข้าภาพของท่านเป็นตัวหนังใหม่', 'Import your own images as props') +
      row(I.export, 'ส่งออกทั้งเรื่องเป็นวิดีโอ ดาวน์โหลดได้', 'Export the whole sequence as a video to download'));

    add('camera', 'กล้องและปุ่มลัด', 'Camera & shortcuts', I.cam, head(I.cam, 'กล้องและปุ่มลัด', 'Camera & shortcuts') +
      row({ key: 'C' }, 'C / เหรียญกล้อง: สลับ อิสระ → ตามตัว → กล้องภาพยนตร์ตอนต่อสู้', 'C / camera medallion: cycle free → follow → cinematic fight camera') +
      row(I.show, 'โหมดแสดง: ซ่อนปุ่มทั้งหมด เหลือแต่เงา', 'Show mode hides the interface — only the shadows remain') +
      row(I.sound, 'เสียง: ปิดเปิดดนตรีและเสียงประกอบ', 'Sound: music and effects on/off') +
      row(I.clear, 'ล้างเวที: เก็บทุกอย่างเข้าหีบ', 'Clear the stage') +
      row({ key: 'H' }, 'H = บัตรวิธีเล่นย่อ', 'H shows the quick help card') +
      row({ key: '1–0' }, 'ฟัน แทง ป้อง รำ ไหว้ กระโดด คำราม หัวเราะ ตั้งวง คำนับ', 'Strike, lunge, block, dance, wai, leap, roar, laugh, pose, bow') +
      row({ key: 'Q E' }, 'ถอยเข้าตะเกียง / แนบจอ', 'Toward the lamp / onto the cloth') +
      row({ key: 'Esc' }, 'ข้ามฉากเปิด · ปิดสมุด', 'Skip the intro · close this book'));

    // quests: two pages
    const Q = this.tut.questList();
    const half = Math.ceil(Q.length / 2);
    const qrow = (q) => {
      const st = q.done ? 'done' : q.sealed ? 'sealed' : 'open';
      const pct = Math.round((q.p / q.need) * 100);
      const mark = q.done ? svg(I.check) : svg(I.lock);
      return `<div class="bk-q ${st}"><span class="bk-seal">${mark}</span><div class="bk-qt">
        <p class="th"><b>${esc(q.th)}</b> <i>${esc(q.en)}</i></p>
        <p class="goal">${esc(q.goal[0])}<small>${esc(q.goal[1])}</small></p>
        ${q.sealed ? `<p class="req">ต้องผ่าน «${esc(q.afterQ.th)}» ก่อน <small>after “${esc(q.afterQ.en)}”</small></p>` : `<div class="bk-bar"><i style="width:${q.done ? 100 : pct}%"></i><span>${TH(q.done ? q.need : q.p)}/${TH(q.need)}</span></div>`}
        <p class="rw">รางวัล: ${esc(q.rewards.th)}<small>Reward: ${esc(q.rewards.en)}</small></p></div></div>`;
    };
    const nDone = Q.filter((q) => q.done).length;
    add('quests', 'ภารกิจ', 'Quests', I.quest, head(I.quest, 'ภารกิจ', `Quests — ${nDone}/${Q.length} done`) + `<div class="bk-qs">${Q.slice(0, half).map(qrow).join('')}</div>`, 'quests');
    add('quests2', null, null, null, head(I.quest, 'ภารกิจ (ต่อ)', 'Quests, continued') + `<div class="bk-qs">${Q.slice(half).map(qrow).join('')}</div>`, 'quests');

    add('end', 'เรียกน้องเมฆ', 'Call Mek back', I.deva, `<div class="bk-end">
      ${head(I.deva, 'เรียกน้องเมฆ', 'Call Mek back')}
      <canvas class="bk-deva sm" width="200" height="170"></canvas>
      ${para('ลืมอะไรไป ข้ามาสอนใหม่ได้เสมอ ไม่คิดค่าเรียน (รับเป็นดอกมะลิก็ได้)', 'Forgot something? I will teach you again, free of charge (jasmine garlands accepted).')}
      <div class="bk-btns">
        <button class="bk-btn" data-act="restart">${svg(I.deva)}<span>เริ่มบทเรียนใหม่<small>Restart the tutorial</small></span></button>
        <button class="bk-btn ghost" data-act="reset">${svg(I.clear)}<span>ล้างความคืบหน้าภารกิจ<small>Reset quest progress</small></span></button>
      </div>
      <p class="bk-colo">— จบสมุด · ขอให้สนุกกับการเชิด —<small>the end · enjoy the show</small></p></div>`, 'end');

    // contents page
    const ct = P.find((p) => p.id === 'contents');
    ct.html = head(I.book, 'สารบัญ', 'Contents') + `<ol class="bk-toc">${topics.map((t) => `<li><button data-go="${t.i}"><span class="bk-ic s">${svg(t.icon)}</span><span class="t">${t.th}<small>${esc(t.en)}</small></span><b>${TH(t.i + 1)}</b></button></li>`).join('')}</ol>`;
    return P;
  }

  // ---------------------------------------------------------- DOM
  _build() {
    const R = this.game.root.querySelector('#ui') || document.body;
    const el = document.createElement('div');
    el.id = 'book';
    el.className = 'hidden';
    el.innerHTML = `<div class="bk-veil"></div>
      <div class="bk-wrap">
        <div class="bk-book">
          <div class="bk-pleat l"></div>
          <div class="bk-page bk-L"></div><div class="bk-page bk-R"></div>
          <div class="bk-pleat r"></div>
        </div>
        <nav class="bk-nav">
          <button class="medal bk-prev" title="หน้าก่อน · Previous"><i class="gem"></i>${svg('M15 5l-7 7 7 7')}</button>
          <div class="bk-dots"></div>
          <button class="medal bk-next" title="หน้าถัดไป · Next"><i class="gem"></i>${svg('M9 5l7 7-7 7')}</button>
          <button class="medal bk-close" title="ปิดสมุด · Close"><i class="gem"></i>${svg('M6 6l12 12M18 6L6 18')}</button>
        </nav>
      </div>`;
    R.append(el);
    this.el = el;
    this.$book = el.querySelector('.bk-book');
    this.$L = el.querySelector('.bk-L');
    this.$R = el.querySelector('.bk-R');
    this.$dots = el.querySelector('.bk-dots');
    el.querySelector('.bk-veil').addEventListener('click', () => this.close());
    el.querySelector('.bk-prev').addEventListener('click', () => this.flip(-1));
    el.querySelector('.bk-next').addEventListener('click', () => this.flip(1));
    el.querySelector('.bk-close').addEventListener('click', () => this.close());
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    el.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) { this.go(+go.dataset.go); return; }
      const act = e.target.closest('[data-act]');
      if (act) { this._act(act.dataset.act, act); return; }
      const pg = e.target.closest('.bk-page');
      if (pg && !e.target.closest('button, a, .bk-qs, .bk-toc')) {
        const r = pg.getBoundingClientRect();
        const u = (e.clientX - r.left) / r.width;
        if (this.single ? u > 0.7 : pg === this.$R && u > 0.6) this.flip(1);
        else if (this.single ? u < 0.3 : pg === this.$L && u < 0.4) this.flip(-1);
      }
    });
    // swipe
    let sx = null, sy = 0;
    this.$book.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
    this.$book.addEventListener('pointerup', (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) { this._swiped = performance.now(); this.flip(dx < 0 ? 1 : -1); }
    });
    addEventListener('resize', () => { if (this.isOpen) this._render(); });
  }

  _act(a, btn) {
    if (a === 'restart') { this.close(); setTimeout(() => this.tut.start(true), 350); }
    if (a === 'reset') {
      if (btn.dataset.armed) { this.tut.resetProgress(); btn.dataset.armed = ''; btn.querySelector('small').textContent = 'Done — quests reset'; }
      else { btn.dataset.armed = '1'; btn.querySelector('small').textContent = 'Tap again to confirm'; }
    }
  }

  get single() { return innerWidth < 760 || innerHeight < 480; }
  get step() { return this.single ? 1 : 2; }

  open(page) {
    this.pages = this._pages();
    if (page != null) this.page = typeof page === 'string' ? Math.max(0, this.pages.findIndex((p) => p.id === page)) : page;
    this.isOpen = true;
    this.el.classList.remove('hidden');
    this.el.classList.add('opening');
    setTimeout(() => this.el.classList.remove('opening'), 700);
    document.getElementById('b-book')?.classList.add('on');
    this.game.audio?.sfx('curtain', { vol: 0.3, pitch: 1.6 });
    this._render();
  }
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.add('hidden');
    document.getElementById('b-book')?.classList.remove('on');
    this.game.audio?.sfx('thud', { vol: 0.25, pitch: 1.4 });
  }
  toggle() { if (this.isOpen) this.close(); else this.open(); }
  refresh() { if (this.isOpen) { this.pages = this._pages(); this._render(); } }
  refreshIfOpenOn(id) { if (this.isOpen && this._visibleIds().some((x) => x.startsWith(id))) this.refresh(); }
  _visibleIds() { const s = this._spreadStart(); return [this.pages?.[s]?.id, this.pages?.[s + 1]?.id].filter(Boolean); }

  _spreadStart(p = this.page) { return this.single ? p : p - (p % 2); }

  go(i) {
    const n = this.pages.length;
    i = Math.max(0, Math.min(n - 1, i));
    const dir = Math.sign(this._spreadStart(i) - this._spreadStart());
    if (!dir) return;
    this._turn(dir, i);
  }
  flip(d) { this.go(this._spreadStart() + d * this.step); }

  onKey(e) {
    if (!this.isOpen) return;
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft' || e.code === 'Escape' || e.code === 'PageDown' || e.code === 'PageUp') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.code === 'Escape') this.close();
      else this.flip(e.code === 'ArrowRight' || e.code === 'PageDown' ? 1 : -1);
    }
  }

  // ---------------------------------------------------------- render
  _fill(el, i) {
    const p = this.pages[i];
    el.className = `bk-page ${el === this.$L ? 'bk-L' : el === this.$R ? 'bk-R' : ''} ${p ? p.cls : 'blank'}`;
    el.dataset.page = i;
    el.innerHTML = p ? `<div class="bk-in">${p.html}</div>${p.id !== 'cover' ? `<span class="bk-folio">${TH(i + 1)}</span>` : ''}` : '<div class="bk-in"></div>';
    this._hydrate(el);
  }

  _hydrate(el) {
    const g = this.game;
    el.querySelectorAll('.bk-thumb').forEach((s) => {
      let def = s.dataset.thumb ? g.content.byId.get(s.dataset.thumb) : null;
      if (s.dataset.cat) {
        const id = s.dataset.cat;
        const list = id === 'puppets' ? g.content.puppets : g.content.props.filter((p) => p.cat === id);
        def = list[Math.min(1, list.length - 1)];
      }
      if (!def) { s.classList.add('none'); return; }
      try { s.append(thumbnail(def, 56)); } catch (_) { /* */ }
    });
    el.querySelectorAll('canvas.bk-deva').forEach((c) => {
      const x = c.getContext('2d');
      const dpr = 1;
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.clearRect(0, 0, c.width, c.height);
      const s = c.width / 150;
      x.setTransform(s * 1.1 * dpr, 0, 0, s * 1.1 * dpr, c.width * 0.5, c.height * 0.62);
      try { drawDeva(x, { t: 1.3, face: 1, flap: 0.5, pose: 'wai', hue: 3, active: true, cloud: true }); } catch (_) { /* */ }
    });
  }

  _render() {
    if (!this.pages) this.pages = this._pages();
    const s = this._spreadStart();
    this.page = s;
    this.el.classList.toggle('single', this.single);
    this._fill(this.$L, s);
    if (!this.single) this._fill(this.$R, s + 1);
    this._pleats();
    this._dotsRender();
  }

  _pleats() {
    const n = this.pages.length, s = this._spreadStart();
    const left = s, right = Math.max(0, n - s - this.step);
    this.$book.style.setProperty('--pl', Math.min(10, left));
    this.$book.style.setProperty('--pr', Math.min(10, right));
    this.el.querySelector('.bk-prev').classList.toggle('dim', s <= 0);
    this.el.querySelector('.bk-next').classList.toggle('dim', s + this.step >= n);
  }

  _dotsRender() {
    const n = this.pages.length, st = this.step, D = this.$dots;
    D.innerHTML = '';
    for (let i = 0; i < n; i += st) {
      const b = document.createElement('button');
      b.className = 'bk-dot' + (i === this._spreadStart() ? ' on' : '');
      b.title = this.pages[i]?.id || '';
      b.dataset.go = i;
      D.append(b);
    }
  }

  // an accordion fold: the turning leaf swings about the crease
  _turn(dir, to) {
    if (this._turning) { this._turning.finish(); }
    const from = this._spreadStart();
    const tgt = this._spreadStart(to);
    this.game.audio?.sfx('swish', { vol: 0.35, pitch: 1.3 });
    const leaf = document.createElement('div');
    leaf.className = 'bk-leaf ' + (this.single ? 'one ' : '') + (dir > 0 ? 'fwd' : 'back');
    const front = document.createElement('div'), back = document.createElement('div');
    front.className = 'bk-page face front'; back.className = 'bk-page face back';
    leaf.append(front, back);
    if (this.single) {
      if (dir > 0) { this._fillFace(front, from); this._fill(this.$L, tgt); } else this._fillFace(front, tgt);
    } else if (dir > 0) {
      this._fillFace(front, from + 1);
      this._fillFace(back, tgt);
      this._fill(this.$R, tgt + 1);
    } else {
      this._fillFace(front, from);
      this._fillFace(back, tgt + 1);
      this._fill(this.$L, tgt);
    }
    this.$book.append(leaf);
    const fin = () => {
      if (!leaf.isConnected) return;
      leaf.remove();
      this._turning = null;
      this.page = tgt;
      this._render();
    };
    this._turning = { finish: fin };
    requestAnimationFrame(() => requestAnimationFrame(() => leaf.classList.add('go')));
    leaf.addEventListener('transitionend', (e) => { if (e.target === leaf) fin(); });
    setTimeout(fin, 900);
    this.page = tgt;
    this._pleats();
    this._dotsRender();
  }

  _fillFace(el, i) {
    const p = this.pages[i];
    el.classList.add(...(p && p.cls ? p.cls.split(' ') : ['blank']));
    el.innerHTML = p ? `<div class="bk-in">${p.html}</div>${p.id !== 'cover' ? `<span class="bk-folio">${TH(i + 1)}</span>` : ''}` : '<div class="bk-in"></div>';
    this._hydrate(el);
  }
}
