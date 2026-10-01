// Two royal panels: the move picker (ท่า) and the item card (รายละเอียด).
//
// Move picker: tabs by kind (ต่อสู้ fight · ท่ารำ dance · ท่าทาง gesture ·
// อิริยาบถ posture · ทักทาย social), a card per move with its icon, Thai
// and English names and a line on what it is. Tap to play; the panel stays
// open so you can chain moves.
//
// Item card: tap the small ⓘ on any chest item for a big lit preview, the
// story of the thing, gameplay tips, and a button to place it.

import { ANIMS } from './puppet/animations.js';

let INFO = { ITEM_INFO: {}, MOVE_INFO: {}, CAT_INFO: {} };
import('./descriptions.js').then((m) => { INFO = { ITEM_INFO: m.ITEM_INFO || {}, MOVE_INFO: m.MOVE_INFO || {}, CAT_INFO: m.CAT_INFO || {} }; }).catch(() => {});

const CATS = [
  ['fight', 'ต่อสู้', 'Fight'],
  ['dance', 'ท่ารำ', 'Dance'],
  ['gesture', 'ท่าทาง', 'Gestures'],
  ['posture', 'อิริยาบถ', 'Postures'],
  ['social', 'ทักทาย', 'Together'],
];

const GUESS = {
  fight: ['strike', 'lunge', 'block', 'leap', 'sweep', 'stab-down', 'evade', 'roar', 'hit'],
  posture: ['sit', 'kneel', 'look-around', 'bow', 'flee', 'hop'],
  social: ['handshake', 'hug', 'highfive', 'talk', 'wai'],
};
function catOf(name) {
  const mi = INFO.MOVE_INFO[name];
  if (mi && mi.cat && CATS.some((c) => c[0] === mi.cat)) return mi.cat;
  if (name.startsWith('ram-') || name === 'dance' || name === 'wong') return 'dance';
  for (const [k, list] of Object.entries(GUESS)) if (list.includes(name)) return k;
  return 'gesture';
}
const SKIP = (n) => n.startsWith('ai-') || ['hit', 'kick', 'knee', 'header', 'forehand'].includes(n);

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of kids) if (c) e.append(c);
  return e;
};

export class MovePanel {
  constructor(game, root, icons) {
    this.game = game;
    this.icons = icons;
    this.cat = 'dance';
    this.el = el('div', { id: 'movepanel', class: 'royal-panel hidden' });
    root.append(this.el);
  }

  toggle(actor) {
    const open = this.el.classList.contains('hidden');
    if (!open) return this.close();
    this.actor = actor;
    this.render();
    this.el.classList.remove('hidden');
    this.game.audio?.sfx('curtain', { vol: 0.25 });
  }

  close() { this.el.classList.add('hidden'); }

  render() {
    const E = this.el;
    E.innerHTML = '';
    const head = el('div', { class: 'rp-head' },
      el('div', { class: 'rp-title', html: 'ท่าเชิด <small>Moves</small>' }),
      el('button', { class: 'rp-x', title: 'ปิด · Close', onclick: () => this.close(), html: '×' }));
    const tabs = el('div', { class: 'rp-tabs' });
    for (const [id, th, en] of CATS) tabs.append(el('button', { class: 'rp-tab' + (id === this.cat ? ' on' : ''), onclick: () => { this.cat = id; this.render(); }, html: `${th}<small>${en}</small>` }));
    const grid = el('div', { class: 'rp-grid' });
    const names = Object.keys(ANIMS).filter((n) => !SKIP(n) && ANIMS[n].humanoid !== false && catOf(n) === this.cat);
    for (const n of names) {
      const A = ANIMS[n], mi = INFO.MOVE_INFO[n] || {};
      const icon = this.icons[n] || this.icons[this.cat === 'dance' ? 'dance' : this.cat === 'fight' ? 'strike' : 'wave'] || '';
      const card = el('button', { class: 'rp-card', onclick: () => this._play(n, card) },
        el('i', { class: 'rp-ico', html: `<svg viewBox="0 0 24 24"><path d="${icon}"/></svg>` }),
        el('b', {}, document.createTextNode(A.th || n)),
        el('em', {}, document.createTextNode(A.en || '')),
        el('span', {}, document.createTextNode(mi.th || (A.hold ? 'ค้างท่าไว้จนกว่าจะเดิน · held until you walk' : A.loop ? 'เล่นวนต่อเนื่อง · loops' : ''))),
        mi.en ? el('span', { class: 'rp-en' }, document.createTextNode(mi.en)) : null);
      grid.append(card);
    }
    if (!names.length) grid.append(el('div', { class: 'rp-empty', html: 'ยังไม่มีท่าในหมวดนี้ · nothing here yet' }));
    E.append(head, tabs, grid);
    if (this.cat === 'social') E.append(el('div', { class: 'rp-note', html: 'จับคู่กับตัวที่อยู่ใกล้ที่สุดด้วยปุ่ม ทักทายกัน ในวงแหวน · pair up with the nearest puppet via the Interact medallion' }));
  }

  _play(n, card) {
    const g = this.game;
    const a = g.selected || this.actor;
    if (!a) return;
    if (['handshake', 'hug', 'highfive'].includes(n) && g.social) g.social.start(a, null, n);
    else if (n === 'talk' && g.social) g.social.start(a, null, 'chat');
    else g.playMove(n);
    card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
  }
}

export class InfoCard {
  constructor(game, root, thumbnail, categories) {
    this.game = game;
    this.thumbnail = thumbnail;
    this.cats = Object.fromEntries(categories.map(([id, th, en]) => [id, [th, en]]));
    this.el = el('div', { id: 'infocard', class: 'hidden', onpointerdown: (e) => { if (e.target === this.el) this.close(); } });
    root.append(this.el);
  }

  open(def) {
    const E = this.el, g = this.game;
    const ii = INFO.ITEM_INFO[def.id] || {};
    const cat = def.cat ? this.cats[def.cat] : ['ตัวหนัง', 'Puppet'];
    E.innerHTML = '';
    const card = el('div', { class: 'royal-panel ic-card' });
    const pic = el('div', { class: 'ic-pic' }, this.thumbnail(def, 260));
    const facts = [];
    if (def.rig?.limbs?.armF) facts.push('เชิดได้ทุกส่วน · fully jointed puppet');
    if (def.weapon) facts.push(`อาวุธ ${({ blade: 'คม', point: 'ปลายแหลม', blunt: 'ทุบ' })[def.weapon.kind] || ''} · ${def.weapon.kind} weapon`);
    if (def.sound) facts.push('มีเสียง · makes a sound when touched');
    if (def.fx) facts.push(`เอฟเฟกต์ ${def.fx} · live effect`);
    if (def.weather) facts.push('สลับลมฟ้าอากาศ · toggles weather');
    if (def.spell) facts.push('วางบนตัวหนังเพื่อร่ายเวท · drop on a puppet to cast');
    if (def.scene) facts.push('วางเพื่อจัดฉากทั้งเวที · drop to set the whole stage');
    if (def.static) facts.push('ตั้งอยู่กับที่ · stays put');
    const tips = (ii.tips || []).concat(facts);
    card.append(
      el('button', { class: 'rp-x', title: 'ปิด · Close', onclick: () => this.close(), html: '×' }),
      pic,
      el('div', { class: 'ic-body' },
        el('div', { class: 'ic-cat' }, document.createTextNode(cat ? `${cat[0]} · ${cat[1]}` : '')),
        el('h3', {}, document.createTextNode(def.name || def.id)),
        el('div', { class: 'ic-en' }, document.createTextNode(def.en || '')),
        ii.th ? el('p', {}, document.createTextNode(ii.th)) : el('p', {}, document.createTextNode(INFO.CAT_INFO[def.cat]?.th || '')),
        ii.en ? el('p', { class: 'ic-p-en' }, document.createTextNode(ii.en)) : null,
        tips.length ? el('ul', {}, ...tips.map((t) => el('li', {}, document.createTextNode(t)))) : null,
        el('button', { class: 'ic-place', onclick: () => { this.close(); g.ui?.toggleHouse(false); const a = g.spawn(def, 800, 600, 0.02); if (a) g.select(a); }, html: 'วางบนเวที <small>Place on stage</small>' }),
      ),
    );
    E.append(card);
    E.classList.remove('hidden');
    g.audio?.sfx('chime', { vol: 0.3 });
  }

  close() { this.el.classList.add('hidden'); }
}
