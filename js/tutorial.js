// น้องเมฆ (มณีเมฆ) — a cheeky little เทวดา who teaches the basics on the
// first visit, hands you a folding สมุดข่อย that documents everything else,
// and keeps a list of quests that unseal more of the chest.
//
//   import { Tutorial } from './tutorial.js';
//   this.tutorial = new Tutorial(this);                 // end of Game.init()
//   this.tutorial.update(dt);                           // Game.update
//   this.tutorial.draw(f, toScreen, dpr, cam.zoom);     // Game._overlay, after the flies
//
// Everything else is observed from the outside: a few game methods are
// wrapped (spawn, playMove, assignFly, toggleLamp, toggleDemo, equip,
// _endIntro, souls.giveSoul, editor.stopRec) and the rest is polled.
//
// Locks: LOCKS maps an unlockable key -> the quest that unseals it.
//   'cat:<category>'  a whole chest drawer
//   '<item id>'       one item (e.g. 'mg-summon', 'wx-flood', 'scene-lanka')
//   'fn:<name>'       a function (fn:editor, fn:export, fn:hand)
// isUnlocked(defOrKey) answers for a chest def ({id, cat}) or a key.
// `?unlock=all` (or localStorage 'nangtalung.unlockAll' = '1') opens all;
// `?tutorial=0` never auto-starts the tutorial, `?tutorial=1` always does.

import { drawDeva } from './render/deva.js';
import { CATEGORIES } from './content.js';
import { thumbnail } from './ui.js';
import { Book } from './book.js';

// ------------------------------------------------------------ storage
const KEY = 'nangtalung.tutorial.v1';
const UNLOCK_KEY = 'nangtalung.unlockAll';
const store = {
  get(k) { try { return globalThis.localStorage ? localStorage.getItem(k) : null; } catch (_) { return null; } },
  set(k, v) { try { globalThis.localStorage?.setItem(k, v); } catch (_) { /* storage unavailable */ } },
  del(k) { try { globalThis.localStorage?.removeItem(k); } catch (_) { /* */ } },
};
const fresh = () => ({ v: 1, tutDone: false, bookGiven: false, name: null, q: {} });
function loadState() {
  try {
    const s = JSON.parse(store.get(KEY) || 'null');
    if (s && typeof s === 'object') return { ...fresh(), ...s, q: { ...(s.q || {}) } };
  } catch (_) { /* corrupt: start over */ }
  return fresh();
}
export const state = loadState();
export function save() { store.set(KEY, JSON.stringify(state)); }

let params;
try { params = new URLSearchParams(globalThis.location?.search || ''); } catch (_) { params = new URLSearchParams(); }
let UNLOCK_ALL = params.get('unlock') === 'all' || store.get(UNLOCK_KEY) === '1';
export function setUnlockAll(on) { UNLOCK_ALL = !!on; if (on) store.set(UNLOCK_KEY, '1'); else store.del(UNLOCK_KEY); }
export const unlockAll = () => UNLOCK_ALL;

// ------------------------------------------------------------ quests
const DANCES = new Set(['dance', 'wong', 'ram-medley', 'ram-theppranom', 'ram-kinnorn', 'ram-chanee']);
const FIGHT_ROLES = new Set(['fighter', 'monster']);
const qd = (T, q) => (T.qs(q.id).d ||= {});
const chest = (e) => !!(e && e.chest);

// progress is the max ever reached; a quest is done when p >= need.
// poll(T, q) -> progress, on[event](T, q, data) -> progress | undefined
export const QUESTS = [
  {
    id: 'cast', th: 'คณะหนังครบโรง', en: 'Full Troupe', need: 4,
    goal: ['วางตัวหนังบนจอพร้อมกัน ๔ ตัว', 'Have 4 puppets on the cloth at once'],
    unlocks: ['fn:editor'],
    poll: (T) => T.game.scene.puppets().filter((p) => !p.removed).length,
  },
  {
    id: 'director', th: 'ผู้กำกับ', en: 'The Director', need: 1, after: 'cast',
    goal: ['อัดการแสดงหนึ่งเทคบนโต๊ะตัดต่อ', 'Record one take on the timeline'],
    unlocks: ['fn:export', 'cat:imports'],
    on: { rec: () => 1 },
  },
  {
    id: 'sword', th: 'ดาบแรก', en: 'First Blade', need: 1,
    goal: ['ฟันคู่ต่อสู้ด้วยอาวุธให้โดนหนึ่งครั้ง', 'Land one weapon hit on a rival'],
    unlocks: ['gada', 'trident', 'chakra', 'ngao', 'kris', 'hok', 'bow', 'arrow'],
    rewardText: ['อาวุธชั้นสูง: กระบอง ตรีศูล จักร ง้าว กริช หอก ธนู', 'Master weapons: mace, trident, chakra, glaive, kris, spear, bow'],
    on: { hit: (T, q, h) => (h.weapon && !h.blocked && h.attacker && !h.attacker.isAnimal ? 1 : undefined) },
  },
  {
    id: 'dancer', th: 'นักรำ', en: 'The Dancer', need: 3,
    goal: ['เล่นท่ารำต่างกัน ๓ ท่า', 'Perform 3 different dances'],
    unlocks: ['cat:tools'],
    rewardText: ['ลิ้นชักเอฟเฟกต์: ไฟสี ประกาย ควัน น้ำพุ', 'Effects drawer: coloured lights, sparkles, smoke, fountains'],
    on: { move: (T, q, e) => { const d = qd(T, q); d.set ||= []; if (DANCES.has(e.name) && !d.set.includes(e.name)) d.set.push(e.name); return d.set.length; } },
  },
  {
    id: 'jester', th: 'ตัวตลกประจำโรง', en: 'The Jester', need: 3,
    goal: ['ให้ตัวหนังหัวเราะ ๓ ครั้ง (หรือมอบบทตัวตลก)', 'Make puppets laugh 3 times (or cast a comedian)'],
    unlocks: ['scene-temple-fair'],
    on: {
      move: (T, q, e) => { if (e.name !== 'laugh') return; const d = qd(T, q); return (d.n = (d.n || 0) + 1); },
      assign: (T, q, e) => { if (e.role !== 'comedian') return; const d = qd(T, q); return (d.n = (d.n || 0) + 3); },
    },
  },
  {
    id: 'friends', th: 'เพื่อนสี่ขา', en: 'Four-legged Friends', need: 4,
    goal: ['เรียกสัตว์ ๓ ตัว แล้ววางอาหารใกล้หมูเด้ง', 'Summon 3 animals, then drop food next to Moo Deng'],
    unlocks: ['suea', 'jorakhe', 'chang-song', 'scene-moo-deng-pond'],
    rewardText: ['เสือ จระเข้ ช้างทรง และฉากบึงหมูเด้ง', 'Tiger, crocodile, royal elephant and Moo Deng\'s pond'],
    on: { spawn: (T, q, e) => { if (!chest(e) || e.def.cat !== 'animals') return; const d = qd(T, q); d.n = (d.n || 0) + 1; return Math.min(3, d.n) + (d.fed ? 1 : 0); },
      fed: (T, q) => { const d = qd(T, q); d.fed = 1; return Math.min(3, d.n || 0) + 1; } },
  },
  {
    id: 'lamp', th: 'ฟ้าลั่น', en: 'Thunderclap', need: 2,
    goal: ['สลับตะเกียง และย้ายแสง (Alt + ลาก)', 'Switch the lamp, and move the light (Alt + drag)'],
    unlocks: ['cat:weather'],
    rewardText: ['ลิ้นชักลมฟ้าอากาศ', 'The weather drawer'],
    on: { lamp: (T, q) => { const d = qd(T, q); d.t = 1; return (d.t || 0) + (d.m || 0); },
      lampMoved: (T, q) => { const d = qd(T, q); d.m = 1; return (d.t || 0) + (d.m || 0); } },
  },
  {
    id: 'storm', th: 'พายุเข้า', en: 'Storm Rising', need: 2, after: 'lamp',
    goal: ['เปิดลมฟ้าอากาศ ๒ อย่างพร้อมกัน', 'Have 2 kinds of weather at once'],
    unlocks: ['wx-flood', 'wx-quake', 'cat:boats'],
    rewardText: ['น้ำท่วม แผ่นดินไหว และลิ้นชักเรือ', 'Flood, earthquake and the boats drawer'],
    poll: (T) => T.game.fx?.weather?.size || 0,
  },
  {
    id: 'soul', th: 'ปลุกเสก', en: 'Awakening', need: 1,
    goal: ['มอบวิญญาณให้ตัวหนังหนึ่งตัว', 'Give a puppet a soul'],
    unlocks: ['mg-mend', 'mg-summon'],
    rewardText: ['เวทชุบชีวิต และเวทอัญเชิญ', 'The mend and summon spells'],
    on: { soul: () => 1 },
  },
  {
    id: 'battle', th: 'ศึกใหญ่', en: 'The Great Battle', need: 3,
    goal: ['ให้เทวดา ๒ องค์เชิดนักรบ แล้วปะทะกันให้โดน', 'Two devas play fighters and land a blow'],
    unlocks: ['cat:monsters', 'scene-lanka'],
    rewardText: ['ลิ้นชักปีศาจ และฉากศึกกรุงลงกา', 'The monsters drawer and the Battle of Lanka'],
    poll: (T, q) => Math.min(2, T.game.scene.actors.filter((a) => !a.removed && FIGHT_ROLES.has(a.flyRole)).length) + (qd(T, q).hit ? 1 : 0),
    on: { hit: (T, q, h) => { if (h.attacker && h.target && FIGHT_ROLES.has(h.attacker.flyRole) && FIGHT_ROLES.has(h.target.flyRole)) { qd(T, q).hit = 1; return 3; } } },
  },
  {
    id: 'market', th: 'ตลาดนัด', en: 'Market Day', need: 4,
    goal: ['มอบบทแม่ค้า แล้ววางอาหาร ๓ อย่างบนจอ', 'Cast a merchant and put 3 foods on the cloth'],
    unlocks: ['scene-floating-market'],
    poll: (T) => {
      const A = T.game.scene.actors.filter((a) => !a.removed);
      return (A.some((a) => a.flyRole === 'merchant') ? 1 : 0) + Math.min(3, A.filter((a) => a.def?.cat === 'food').length);
    },
  },
  {
    id: 'village', th: 'หมู่บ้านคึกคัก', en: 'Busy Village', need: 3,
    goal: ['ให้เทวดา ๓ องค์ทำงานพร้อมกัน', 'Keep 3 devas working at once'],
    unlocks: ['cat:games', 'cat:vehicles'],
    rewardText: ['ลิ้นชักกีฬา และลิ้นชักพาหนะ', 'The games and vehicles drawers'],
    poll: (T) => T.game.flies.filter((f) => f.actor && !f.actor.removed).length,
  },
  {
    id: 'sports', th: 'กีฬาสี', en: 'Sports Day', need: 5, after: 'village',
    goal: ['เตะตะกร้อต่อกันได้ ๕ ครั้งไม่ตก', 'A takraw rally of 5 without a drop'],
    unlocks: ['scene-village-games'],
    poll: (T) => T.game.games?.stats?.bestTakraw || 0,
  },
  {
    id: 'forest', th: 'ป่าหิมพานต์', en: 'Himmaphan Forest', need: 5,
    goal: ['ปลูกต้นไม้หรือของธรรมชาติต่างชนิด ๕ อย่าง', 'Plant 5 different trees or nature pieces'],
    unlocks: ['scene-himmaphan'],
    poll: (T) => new Set(T.game.scene.actors.filter((a) => !a.removed && (a.def?.cat === 'foliage' || a.def?.cat === 'nature')).map((a) => a.def.id)).size,
  },
  {
    id: 'demo', th: 'มือเทวดา', en: 'Deva\'s Hands', need: 1,
    goal: ['เปิดดูการสาธิตมือ', 'Watch the hand-puppetry demo'],
    unlocks: ['fn:hand'],
    rewardText: ['เชิดด้วยมือจริงผ่านกล้อง', 'Real hand tracking with your camera'],
    on: { demo: (T, q, e) => (e.on ? 1 : undefined) },
  },
];
export const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

// key -> quest id
export const LOCKS = {};
for (const q of QUESTS) for (const k of q.unlocks) LOCKS[k] = q.id;

export const FN_LABELS = {
  'fn:editor': ['โต๊ะตัดต่อ', 'Timeline editor'],
  'fn:export': ['ส่งออกวิดีโอ · นำเข้าภาพ', 'Video export · image import'],
  'fn:hand': ['เชิดด้วยมือผ่านกล้อง', 'Camera hand tracking'],
};

const questDone = (id) => !!state.q[id]?.done;

/** The quest that still seals this def or key, or null. */
export function lockOf(x) {
  if (UNLOCK_ALL || !x) return null;
  const keys = typeof x === 'string' ? [x] : ['cat:' + (x.cat || 'puppets'), x.id];
  for (const k of keys) {
    const id = LOCKS[k];
    if (id && !questDone(id)) return QUEST_BY_ID[id];
  }
  return null;
}
export const isUnlocked = (x) => !lockOf(x);
export function lockText(q) { return q ? `ปิดผนึก · ทำภารกิจ «${q.th}» เพื่อปลดล็อก · Sealed — quest “${q.en}” unlocks it` : ''; }

// hook the UI calls when a sealed thing is clicked (set by the Tutorial)
export const hooks = { onLocked: null };
export function notifyLocked(x) { try { hooks.onLocked?.(x); } catch (e) { console.warn(e); } }

// a tiny gilded เจดีย์ seal for locked things
export const SEAL_HTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5v3.2M10.3 4.7h3.4l-.4 2.6h-2.6zM9 7.3h6l1.3 4.2H7.7zM6.6 11.5h10.8v2.6H6.6zM5 14.1h14v2.4H5zM3.6 16.5h16.8v4.3H3.6z"/></svg>';

// ------------------------------------------------------------ helpers
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let SEG = null;
try { SEG = new Intl.Segmenter('th', { granularity: 'grapheme' }); } catch (_) { SEG = null; }
const graphemes = (s) => (SEG ? [...SEG.segment(s)].map((x) => x.segment) : [...s]);
const ABORT = Symbol('abort');
const NAME_TH = 'มณีเมฆ', NAME_EN = 'Maneemek';
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const ICON_NEXT = svg('M9 5l7 7-7 7');
const THAI_NUM = (n) => String(n).replace(/\d/g, (d) => '๐๑๒๓๔๕๖๗๘๙'[d]);
export { THAI_NUM };

// distance from a target's centre to its edge along (ux, uy)
function edgeR(tp, ux, uy) {
  if (!tp.rect) return tp.r;
  const hw = tp.rect.width / 2 + 6, hh = tp.rect.height / 2 + 6;
  return Math.min(Math.abs(ux) > 1e-3 ? hw / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-3 ? hh / Math.abs(uy) : 1e9);
}

// ------------------------------------------------------------ the tutorial
export class Tutorial {
  constructor(game) {
    this.game = game;
    game.tutorial = this;
    this.running = false;
    this.pending = null;
    this.line = null;          // what the box shows now
    this.quipT = 0;
    this.toasts = [];
    this.spawnLog = [];        // {def, a, t, chest}
    this.moveLog = [];
    this.assignLog = [];
    this.t = 0;
    this._pollT = 0;
    this._drawnAt = 0;
    this._lastUpd = 0;
    const L = game.scene.lamp;
    this._lamp0 = [L.x, L.y];
    this.deva = { x: -120, y: 70, vx: 0, vy: 0, t: 0, face: 1, pose: 'fly', prev: null, poseT: 1, alpha: 0, want: 0, hand: null, dust: [] };
    this.aim = null;           // { el | actor | limb | pt }
    this._buildDOM();
    this.book = new Book(this);
    this._hook();
    hooks.onLocked = (x) => this.explainLock(x);
    this.refreshLocks();
    this._showBookBtn(state.bookGiven || state.tutDone || !this._willAutostart(), false);
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // ---------------------------------------------------------- wiring
  _hook() {
    const g = this.game;
    const T2 = this;
    const wrap = (obj, name, after, before) => {
      const f = obj && obj[name];
      if (typeof f !== 'function' || f.__tut) return;
      const w = function (...args) {
        let pre;
        try { pre = before ? before.apply(this, args) : undefined; } catch (e) { console.warn(e); }
        if (pre === false) return undefined;
        const r = f.apply(this, args);
        try { after?.call(this, r, ...args); } catch (e) { console.warn('tutorial hook', name, e); }
        return r;
      };
      w.__tut = true; w.__orig = f;
      obj[name] = w;
    };
    wrap(g, 'beginSpawnDrag', (r, def) => { this._chestDef = def; });
    wrap(g, 'spawn', (a, def) => {
      const fromChest = def && def === this._chestDef;
      if (fromChest) this._chestDef = null;
      const e = { def, a, t: this.t, chest: fromChest };
      this.spawnLog.push(e);
      if (this.spawnLog.length > 200) this.spawnLog.shift();
      this._ev('spawn', e);
    }, (def) => {
      // anything still sealed that reaches spawn from the chest is refused
      if (def && def === this._chestDef && lockOf(def)) { this._chestDef = null; this.explainLock(def); return false; }
    });
    wrap(g, 'playMove', (r, name) => { const e = { name, a: g.selected, t: this.t }; this.moveLog.push(e); this._ev('move', e); });
    wrap(g, 'assignFly', (r, a, role) => { if (!role) return; const e = { a, role, t: this.t }; this.assignLog.push(e); this._ev('assign', e); });
    wrap(g, 'toggleLamp', () => this._ev('lamp', {}));
    wrap(g, 'toggleDemo', (p) => Promise.resolve(p).then(() => this._ev('demo', { on: !!(g.tracker && g.tracker.running && g.tracker.mode === 'synthetic') })).catch(() => {}));
    wrap(g, 'equip', null, (id) => { const def = id && g.content.byId.get(id); if (def && lockOf(def)) { this.explainLock(def); return false; } });
    wrap(g, '_endIntro', () => this._introEnded());
    if (g.souls) wrap(g.souls, 'giveSoul', (r, a, on = true) => { if (on) this._ev('soul', { a }); });
    if (g.editor) {
      wrap(g.editor, 'stopRec', function () { if (this.clips.length > (this._tutN ?? 0)) T2._ev('rec', {}); }, function () { this._tutN = this.clips.length; });
    }
    g.scene.on('hit', (h) => this._ev('hit', h));
    // sealed medallions and timeline buttons: stop the click before the button sees it
    const guard = (e) => {
      const k = this._fnKeyOf(e.target);
      if (!k || !lockOf(k)) return;
      e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
      if (e.type === 'click') this.explainLock(k);
    };
    addEventListener('click', guard, true);
    addEventListener('pointerdown', guard, true);
    // the book is modal for the arrow keys / Escape
    addEventListener('keydown', (e) => {
      this.book.onKey(e);
      if (e.defaultPrevented || this.book.isOpen) return;
      // Enter advances her lines (Escape skips the whole lesson)
      if (e.code === 'Enter' && !this.el.classList.contains('hidden') && (this.pending?.kind === 'say' || this.quipT > 0 || (this.line && !this.line.done))) { e.preventDefault(); e.stopImmediatePropagation(); this._advance(); }
      else if (e.code === 'Escape' && this.running && !this.game.menu && !this.game.intro) { e.preventDefault(); e.stopImmediatePropagation(); this.skip(); }
    }, true);
  }

  _fnKeyOf(t) {
    if (!t || !t.closest) return null;
    if (t.closest('#b-edit')) return 'fn:editor';
    if (t.closest('#b-hand')) return 'fn:hand';
    const b = t.closest('#timeline button');
    if (b && /Export video|Import images/.test(b.title || '')) return 'fn:export';
    return null;
  }

  _willAutostart() {
    if (params.get('tutorial') === '0') return false;
    if (params.get('tutorial') === '1') return true;
    return !state.tutDone && params.get('intro') !== '0';
  }

  _introEnded() {
    if (this.running || !this._willAutostart() || this._autoStarted) return;
    this._autoStarted = true;
    setTimeout(() => { if (!this.running && !this.game.menu && !this.game.intro) this.start(); }, 1700);
  }

  // ---------------------------------------------------------- DOM
  _buildDOM() {
    const R = this.game.root.querySelector('#ui') || document.body;
    const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
    this.el = mk('div', 'tut-box hidden');
    this.el.id = 'tut';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-live', 'polite');
    this.el.innerHTML = `
      <i class="tut-corner tl"></i><i class="tut-corner tr"></i><i class="tut-corner bl"></i><i class="tut-corner br"></i>
      <i class="tut-crest"></i>
      <div class="tut-plate"><b>${NAME_TH}</b><small>${NAME_EN} · เทวดาพี่เลี้ยง</small></div>
      <button class="tut-x" title="ข้ามบทเรียน · Skip the tutorial">ข้าม<small>skip</small></button>
      <div class="tut-tag"></div>
      <div class="tut-th"></div>
      <div class="tut-en"></div>
      <div class="tut-chips"></div>
      <button class="tut-next medal" title="ต่อไป · Next"><i class="gem"></i>${ICON_NEXT}</button>`;
    this.$th = this.el.querySelector('.tut-th');
    this.$en = this.el.querySelector('.tut-en');
    this.$tag = this.el.querySelector('.tut-tag');
    this.$chips = this.el.querySelector('.tut-chips');
    this.$next = this.el.querySelector('.tut-next');
    this.$x = this.el.querySelector('.tut-x');
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => {
      if (e.target.closest('.tut-x')) { this.skip(); return; }
      if (e.target.closest('.tut-chip')) return;
      this._advance();
    });
    this.ring = mk('div', 'tut-ring hidden');
    this.ring.id = 'tut-ring';
    this.unlockEl = mk('div', 'tut-unlock hidden');
    this.unlockEl.id = 'tut-unlock';
    this.unlockEl.addEventListener('click', () => this._closeToast());
    this.cv = null; // fallback canvas when the game does not call draw()
    R.append(this.el, this.ring, this.unlockEl);
  }

  _showBookBtn(on, pop = true) {
    const b = document.getElementById('b-book');
    if (!b) return;
    b.classList.toggle('tut-nobook', !on);
    if (on && pop) { b.classList.remove('tut-pop'); void b.offsetWidth; b.classList.add('tut-pop'); }
  }

  // ---------------------------------------------------------- locks
  refreshLocks() {
    const ui = this.game.ui;
    for (const [sel, key] of [['#b-edit', 'fn:editor'], ['#b-hand', 'fn:hand']]) this._sealEl(document.querySelector(sel), key);
    document.querySelectorAll('#timeline button').forEach((b) => { if (/Export video|Import images/.test(b.title || '')) this._sealEl(b, 'fn:export'); });
    if (ui && ui.tabs) {
      try { ui.rebuildTabs(); ui.showTab(ui.tab); } catch (e) { console.warn(e); }
    }
  }

  _sealEl(b, key) {
    if (!b) return;
    const q = lockOf(key);
    b.classList.toggle('tut-locked', !!q);
    let s = b.querySelector(':scope > .tut-seal');
    if (q && !s) { s = document.createElement('i'); s.className = 'tut-seal'; s.innerHTML = SEAL_HTML; b.append(s); }
    if (!q && s) s.remove();
    if (q) { b.dataset.tutTitle ??= b.title; b.title = `${b.dataset.tutTitle} — ${lockText(q)}`; } else if (b.dataset.tutTitle != null) { b.title = b.dataset.tutTitle; delete b.dataset.tutTitle; }
  }

  labelOf(key) {
    const g = this.game;
    if (key.startsWith('fn:')) return { th: FN_LABELS[key]?.[0] || key, en: FN_LABELS[key]?.[1] || '' };
    if (key.startsWith('cat:')) {
      const c = CATEGORIES.find((x) => x[0] === key.slice(4));
      const first = g.content.props.find((p) => p.cat === key.slice(4));
      return { th: 'ลิ้นชัก' + (c ? c[1] : key), en: (c ? c[2] : key) + ' drawer', def: first };
    }
    const d = g.content.byId.get(key);
    return { th: d?.name || key, en: d?.en || '', def: d };
  }

  explainLock(x) {
    const q = lockOf(x);
    if (!q) return;
    const key = typeof x === 'string' ? x : (lockOf('cat:' + (x.cat || 'puppets')) ? 'cat:' + x.cat : x.id);
    const lab = this.labelOf(key);
    const pre = q.after && !questDone(q.after) ? QUEST_BY_ID[q.after] : null;
    const th = `${lab.th} ยังปิดผนึกอยู่จ้า! ทำภารกิจ «${q.th}» ก่อนนะ — ${q.goal[0]}` + (pre ? ` (แต่ต้องผ่าน «${pre.th}» ก่อน)` : '');
    const en = `${lab.en || lab.th} is sealed! Finish “${q.en}”: ${q.goal[1]}` + (pre ? ` (after “${pre.en}”)` : '');
    this.game.audio?.sfx('click', { vol: 0.4 });
    this.quip(th, en, { tag: ['ปิดผนึก', 'Sealed'], ms: 6500 });
  }

  // ---------------------------------------------------------- quests
  qs(id) { return (state.q[id] ||= { p: 0, done: false }); }
  questList() {
    return QUESTS.map((q) => {
      const s = state.q[q.id] || { p: 0 };
      const sealed = q.after && !questDone(q.after);
      return { ...q, p: Math.min(q.need, s.p || 0), done: !!s.done, sealed, afterQ: q.after ? QUEST_BY_ID[q.after] : null, rewards: this.rewardLabels(q) };
    });
  }
  rewardLabels(q) {
    if (q.rewardText) return { th: q.rewardText[0], en: q.rewardText[1] };
    const labs = q.unlocks.map((k) => this.labelOf(k));
    return { th: labs.map((l) => l.th).join(' · '), en: labs.map((l) => l.en).join(' · ') };
  }

  _ev(type, data) {
    for (const q of QUESTS) {
      const fn = q.on && q.on[type];
      if (!fn) continue;
      this._progress(q, fn(this, q, data));
    }
    this._stepEvent?.(type, data);
  }

  _progress(q, v) {
    if (v == null || !isFinite(v)) return;
    const s = this.qs(q.id);
    if (s.done) return;
    if (q.after && !questDone(q.after)) return;
    if (v > (s.p || 0)) { s.p = v; this._dirty = true; }
    if (s.p >= q.need) this._complete(q);
  }

  _complete(q) {
    const s = this.qs(q.id);
    if (s.done) return;
    s.done = true;
    s.at = Date.now();
    save();
    this.refreshLocks();
    this.book?.refresh();
    this.toasts.push(q);
  }

  _pollQuests() {
    const g = this.game;
    for (const q of QUESTS) if (q.poll) { try { this._progress(q, q.poll(this, q)); } catch (e) { /* stage in flux */ } }
    // lamp moved from where it started
    const L = g.scene.lamp;
    if (Math.hypot(L.x - this._lamp0[0], L.y - this._lamp0[1]) > 40) this._ev('lampMoved', {});
    // หมูเด้ง eats food dropped next to her
    const S = g.scene;
    const moos = S.actors.filter((a) => !a.removed && a.def?.id === 'moo-deng' && a.root);
    if (moos.length) {
      const foods = S.actors.filter((a) => !a.removed && a.def?.cat === 'food' && a.root && !a.heldBy && this.spawnLog.some((e) => e.a === a && e.chest));
      for (const m of moos) {
        const [mx, my] = S.project(m.root.x, m.root.y, m.z);
        for (const f of foods) {
          if (g.drag && g.drag.actor === f) continue;
          const [fx, fy] = S.project(f.root.x, f.root.y, f.z);
          if (Math.hypot(fx - mx, fy - my) < 170) {
            m.say?.({ th: 'หงับ! อร่อยจัง', en: 'Chomp! Yummy!' });
            g.audio?.sfx('pop', { vol: 0.6 });
            g.stage?.sparks?.(fx, fy, 14, '255,200,210');
            try { S.remove(f); } catch (_) { /* */ }
            this._ev('fed', { moo: m, food: f });
            break;
          }
        }
      }
    }
    if (this._dirty) { this._dirty = false; save(); this.book?.refreshIfOpenOn('quests'); }
  }

  // ---------------------------------------------------------- unlock toast
  _showToast(q) {
    const E = this.unlockEl;
    const items = q.unlocks.map((k) => this.labelOf(k)).slice(0, 8);
    E.innerHTML = `<div class="tu-rays"></div><div class="tu-card">
      <div class="tu-k">ปลดผนึกแล้ว!<small>Unlocked</small></div>
      <div class="tu-q">ภารกิจ «${esc(q.th)}» สำเร็จ<small>Quest complete — ${esc(q.en)}</small></div>
      <div class="tu-items"></div></div>`;
    const box = E.querySelector('.tu-items');
    for (const l of items) {
      const it = document.createElement('div');
      it.className = 'tu-it';
      if (l.def) { try { it.append(thumbnail(l.def, 64)); } catch (_) { /* */ } } else it.innerHTML = `<i class="tu-fn">${SEAL_HTML}</i>`;
      const cap = document.createElement('span');
      cap.innerHTML = `${esc(l.th)}<small>${esc(l.en)}</small>`;
      it.append(cap);
      box.append(it);
    }
    E.classList.remove('hidden', 'out');
    E.classList.remove('in'); void E.offsetWidth; E.classList.add('in');
    this.game.audio?.sfx('chime', { vol: 0.7 });
    setTimeout(() => this.game.audio?.sfx('sparkle', { vol: 0.6 }), 250);
    clearTimeout(this._tuT);
    this._tuT = setTimeout(() => this._closeToast(), 5200);
    this._toastOn = true;
    // a little cheer from Mek if she is around
    if (!this.running) this.quip(`เย่! ปลดผนึก «${q.th}» แล้ว เปิดหีบดูของใหม่สิ`, `Yay! “${q.en}” done — check the chest for new things.`, { ms: 4200, tag: ['ภารกิจสำเร็จ', 'Quest done'], silent: true });
  }
  _closeToast() {
    clearTimeout(this._tuT);
    this.unlockEl.classList.add('out');
    setTimeout(() => { this.unlockEl.classList.add('hidden'); this._toastOn = false; }, 450);
  }

  // ---------------------------------------------------------- dialogue primitives
  _await(kind, setup) {
    return new Promise((resolve, reject) => {
      if (this._aborted) { reject(ABORT); return; }
      this.pending = { kind, resolve, reject, t0: this.t, idle: 0, hintI: 0, ...setup };
    });
  }

  _show({ th, en, tag = null, chips = null, next = true, point, pose, voice = true, sfx }) {
    this.line = { th, en, g: graphemes(th), shown: 0, acc: 0, done: false };
    this.$tag.innerHTML = tag ? `${esc(tag[0])}<small>${esc(tag[1])}</small>` : '';
    this.$tag.classList.toggle('on', !!tag);
    this.$en.textContent = en || '';
    this.$en.classList.remove('on');
    this.$chips.innerHTML = '';
    this.$chips.classList.remove('on');
    this._chips = chips;
    this._wantNext = next;
    this.$next.classList.remove('on');
    this.el.classList.toggle('tasking', !!tag && !chips && !next);
    this._renderLine();
    this.aim = point || null;
    if (pose) this._pose(pose, 2.2);
    if (sfx) this.game.audio?.sfx(sfx, { vol: 0.5 });
    if (voice) this.game.audio?.voice?.(th, { voice: 'female', pan: clamp((this.deva.x / Math.max(1, innerWidth)) * 2 - 1, -1, 1) });
    this._open();
  }

  _renderLine() {
    const L = this.line;
    if (!L) return;
    const a = L.g.slice(0, L.shown).join(''), b = L.g.slice(L.shown).join('');
    this.$th.innerHTML = `${esc(a)}<span class="ghost">${esc(b)}</span>`;
  }

  _finishTyping() {
    const L = this.line;
    if (!L || L.done) return;
    L.shown = L.g.length; L.done = true;
    this._renderLine();
    this.$en.classList.add('on');
    if (this._chips) this._buildChips();
    if (this._wantNext) this.$next.classList.add('on');
  }

  _buildChips() {
    const C = this.$chips;
    C.innerHTML = '';
    this._chips.forEach(([th, en], i) => {
      const b = document.createElement('button');
      b.className = 'tut-chip';
      b.style.animationDelay = `${i * 70}ms`;
      b.innerHTML = `<i></i><span>${esc(th)}<small>${esc(en)}</small></span>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); this.game.audio?.sfx('click', { vol: 0.5 }); this._choose(i); });
      C.append(b);
    });
    C.classList.add('on');
  }

  _choose(i) {
    const P = this.pending;
    if (!P || P.kind !== 'ask') return;
    this.pending = null;
    P.resolve(i);
  }

  _advance() {
    if (this.line && !this.line.done) { this._finishTyping(); return; }
    const P = this.pending;
    if (this.quipT > 0) { this._endQuip(); return; }
    if (P && P.kind === 'say') { this.pending = null; this.game.audio?.sfx('click', { vol: 0.25 }); P.resolve(); }
  }

  say(th, en, o = {}) { this._show({ th, en, ...o }); return this._await('say'); }
  ask(th, en, choices, o = {}) { this._show({ th, en, chips: choices, next: false, ...o }); return this._await('ask'); }
  task(th, en, check, o = {}) {
    const P = this._await('task', { check, hints: o.hints || [], every: o.every || 15, th, en, o });
    this._show({ th, en, tag: o.tag || ['ลองทำดู', 'Your turn'], next: false, ...o });
    return P;
  }
  wait(s) { return this._await('wait', { until: this.t + s }); }

  // a short aside that does not disturb the script (locks, cheers)
  quip(th, en, { ms = 5000, tag = null, silent = false } = {}) {
    if (this.book?.isOpen) this.book.close();
    const P = this.pending;
    if (this.quipT <= 0) this._saved = this.running && this.line ? { line: this.line, tag: this.$tag.innerHTML, en: this.$en.textContent, chips: this._chips, next: this._wantNext, aim: this.aim, tasking: this.el.classList.contains('tasking') } : null;
    if (P && P.kind === 'ask') { this._saved = null; return; } // never cover a question
    this._show({ th, en, tag, next: true, voice: !silent });
    this.quipT = ms / 1000;
    if (!this.running) { this.deva.want = 1; }
  }

  _endQuip() {
    this.quipT = 0;
    const S = this._saved;
    this._saved = null;
    if (S) {
      this.line = S.line;
      this.$tag.innerHTML = S.tag; this.$tag.classList.toggle('on', !!S.tag);
      this.$en.textContent = S.en; this.$en.classList.toggle('on', S.line.done);
      this._chips = S.chips; this._wantNext = S.next; this.aim = S.aim;
      this.$chips.innerHTML = ''; if (S.chips && S.line.done) this._buildChips();
      this.$next.classList.toggle('on', S.next && S.line.done);
      this.el.classList.toggle('tasking', S.tasking);
      this._renderLine();
    } else if (!this.running) this._close();
  }

  _open() {
    this.el.classList.remove('hidden');
    this.deva.want = 1;
  }
  _close() {
    this.el.classList.add('hidden');
    this.aim = null;
    this.line = null;
    this.deva.want = 0;
  }

  _pose(p, dur = 0) { this._posed = p; this._poseUntil = this.t + dur; }

  // ---------------------------------------------------------- run / skip
  start(force = false) {
    if (this.running) return;
    this._aborted = false;
    this.running = true;
    this.el.classList.add('running');
    this._showBookBtn(state.bookGiven, false);
    const D = this.deva;
    if (D.alpha < 0.05) { D.x = -90; D.y = 40; D.vx = 260; D.vy = 60; }
    this._script().catch((e) => { if (e !== ABORT) console.warn('tutorial', e); }).finally(() => {
      this.running = false;
      this.pending = null;
      this.el.classList.remove('running', 'tasking');
      this._stepEvent = null;
      if (this.quipT <= 0) this._close();
    });
  }

  skip() {
    if (!this.running) { this._close(); this.quipT = 0; return; }
    this._aborted = true;
    const P = this.pending;
    this.pending = null;
    P?.reject(ABORT);
    this._finishTutorial(true);
    this.running = false;
    this.el.classList.remove('running', 'tasking');
    this.quip('ก็ได้จ้า ข้าวางสมุดข่อยไว้ให้ตรงมุมขวาบนนะ อยากรู้อะไรเปิดดูได้เลย แล้วมีภารกิจรอด้วย!', "Fine, fine! I left my folding book up in the top-right corner — everything's in it, quests too!", { ms: 6000, tag: ['ข้ามบทเรียน', 'Tutorial skipped'] });
    this.aim = { el: '#b-book' };
  }

  _finishTutorial(skipped) {
    state.tutDone = true;
    state.bookGiven = true;
    save();
    this._showBookBtn(true, true);
    this.refreshLocks();
  }

  // ---------------------------------------------------------- the lesson
  hero() {
    const g = this.game;
    const h = this._hero;
    if (h && !h.removed) return h;
    const s = g.selected;
    if (s && s.pins && !s.removed) return s;
    return g.scene.puppets().filter((p) => !p.removed).slice(-1)[0] || null;
  }

  async _script() {
    const g = this.game, S = g.scene, T = this;
    const since = (log, t0, f) => log.some((e) => e.t >= t0 && f(e));
    const snap = (f) => new Map(S.actors.filter((a) => a.root).map((a) => [a, f(a)]));
    const heroTarget = () => ({ actor: () => T.hero() });

    // -- greeting & banter
    await this.wait(0.6);
    await this.say('สวัสดีจ้า! ข้าชื่อ “มณีเมฆ” เทวดาประจำโรงหนังนี้ เรียกสั้นๆ ว่าน้องเมฆก็ได้', "Hello! I'm Maneemek, the deva of this theatre. Just call me Mek.", { pose: 'wai', sfx: 'chime' });
    const who = await this.ask('แล้วท่านล่ะ เป็นใคร มาจากไหน?', 'And who might you be?', [
      ['นายหนังมือใหม่', 'A brand-new puppet master'],
      ['เทวดาตกสวรรค์', 'A deva who fell out of heaven'],
      ['แค่เดินผ่านมาเฉยๆ', 'Just passing by'],
    ]);
    state.name = ['nai-nang', 'deva', 'passer'][who]; save();
    if (who === 0) await this.say('นายหนังมือใหม่! ดีจัง มือยังนุ่มอยู่ เชิดเบาๆ นะ หนังวัวมันจั๊กจี้', 'A new master! Your hands are still soft — go gently, cowhide is ticklish.');
    else if (who === 1) await this.say('ตกลงมาเหมือนกันเหรอ! ข้าก็ตกเมฆมาตอนงีบ… อย่าไปบอกพระอินทร์นะ', "You fell too? I rolled off a cloud during a nap… don't tell Indra.", { sfx: 'laugh' });
    else await this.say('“ผ่านมาเฉยๆ” ไม่มีหรอก! ใครเข้าโรงหนังแล้ว ต้องได้เชิดทุกคน', "Nobody 'just passes by'! Whoever enters the theatre has to play.", { sfx: 'laugh' });
    const ex = await this.ask('เคยเชิดหนังตะลุงมาก่อนไหม?', 'Ever worked a shadow puppet before?', [
      ['เคยสิ เก่งด้วย', "Of course. I'm brilliant"],
      ['ไม่เคยเลย', 'Never'],
      ['หนังตะลุงคืออะไร?', 'What is nang talung?'],
    ]);
    if (ex === 0) await this.say('โห มั่นใจ! งั้นถ้าหนังร่วงจากจอ ข้าจะแกล้งทำเป็นไม่เห็นนะ', "Ooh, confident! If a puppet falls off the cloth, I'll pretend I didn't see.");
    else if (ex === 1) await this.say('ดีเลย! มีผ้าขาวผืนหนึ่งกับตะเกียงดวงหนึ่ง ก็เล่าได้ทั้งเรื่องแล้ว', 'Perfect! One white cloth and one lamp — that is all a story needs.');
    else await this.say('หนังตะลุงคือละครเงาของปักษ์ใต้ ตัวหนังฉลุจากหนังวัว เชิดหน้าตะเกียงหลังจอผ้า ส่วนพวกเราเชิดจากบนสวรรค์!', 'Nang talung is the shadow play of the South: cowhide puppets, a white cloth and one lamp. And we work them from heaven!');

    // -- 1 chest
    await this.say('ตัวหนังทั้งหมดนอนอยู่ในหีบหนังใบนี้', 'All the puppets sleep in this chest.', { point: { el: '#b-house' } });
    await this.task('แตะหีบหนังที่มุมซ้ายล่างเพื่อเปิด', 'Tap the chest in the bottom-left corner to open it', () => g.ui.house && !g.ui.house.classList.contains('closed'), {
      point: { el: '#b-house' },
      hints: [['หีบไม้แกะสลักสีทองตรงมุมซ้ายล่างนั่นไง', 'The carved golden chest, bottom-left!'], ['ไม่ต้องกลัว ไม่มีผีอยู่ข้างใน… น่าจะนะ', "Don't worry, no ghosts inside… probably."]],
    });
    await this.say('ฝุ่นเยอะหน่อยนะ ไม่มีใครปัดมาสามร้อยปีแล้ว แถวบนคือลิ้นชัก แถวล่างคือของในลิ้นชัก', "A bit dusty — nobody's dusted it in three hundred years. The round tabs are drawers; below are the pieces.", { point: { el: '#house .tabs' } });

    // -- 2 drag a puppet out
    let t0 = this.t;
    await this.task('ลากตัวหนังสักตัวจากหีบ มาวางบนจอผ้า', 'Drag any puppet out of the chest onto the cloth', () => since(this.spawnLog, t0, (e) => e.a && e.def && e.def.rig && !e.def.cat && e.chest), {
      point: { el: () => (g.ui.house.classList.contains('closed') ? '#b-house' : '#house .items .item') },
      hints: [['กดค้างที่ตัวหนัง แล้วลากออกมาปล่อยบนผ้าขาว', 'Press and hold a puppet, drag it out and let go over the cloth'], ['หีบปิดไปแล้ว? แตะหีบเปิดใหม่ได้เลย', 'Chest closed? Tap it to open again']],
    });
    const sp = this.spawnLog.filter((e) => e.t >= t0 && e.a && e.def.rig && !e.def.cat).pop();
    this._hero = sp?.a || null;
    const nm = sp?.def?.name;
    await this.say(`${nm ? `«${nm}» ` : ''}ตื่นแล้ว! ดูสิ เงาลงมาจากแสงตะเกียงเลย`, `${sp?.def?.en ? sp.def.en + ' ' : ''}is awake! See how the shadow condenses out of the lamplight.`, { point: heroTarget(), sfx: 'sparkle' });

    // -- 3 move it
    let hero = this.hero();
    let x0 = hero ? hero.root.x : 0, y0 = hero ? hero.root.y : 0;
    t0 = this.t;
    await this.task('ลากตัวหนังไปมา หรือแตะที่ว่างบนผ้าให้เดินไป', 'Drag the puppet around — or tap an empty spot and it walks there', () => {
      const h = this.hero();
      if (h !== hero) { hero = h; x0 = h ? h.root.x : 0; y0 = h ? h.root.y : 0; }
      return !!h && (Math.abs(h.root.x - x0) > 110 || Math.abs(h.root.y - y0) > 110);
    }, {
      point: heroTarget(),
      hints: [['จับที่ลำตัวแล้วลาก เหมือนถือไม้ตับ', 'Grab the body and drag, like holding the main rod'], ['หรือแตะผ้าว่างๆ แล้วเขาจะเดินไปเอง ขี้เกียจดี', 'Or tap empty cloth and it strolls there by itself. Lazy and effective.']],
    });
    await this.say('เก่งมาก! เดินได้สง่ากว่าข้าอีก', 'Lovely! More graceful than me, honestly.');

    // -- 4 limb string
    t0 = this.t;
    let pulled = 0;
    await this.task('ลากใกล้ๆ มือหรือเท้า (จุดทองเล็กๆ) เพื่อดึงเชือกแขนขา', 'Drag near a hand or foot (the little gold beads) to pull that string', () => {
      if (g.drag && g.drag.type === 'limb') pulled += 1 / 60;
      return pulled > 0.35;
    }, {
      point: { limb: () => { const h = this.hero(); return h && h.pins ? [h, h.pins.handF ? 'handF' : Object.keys(h.pins)[0]] : null; } },
      hints: [['จุดทองเล็กๆ ที่มือคือปลายไม้มือ จับตรงนั้นเลย', 'The small gold beads are the hand rods — grab right on one'], ['ต้องเลือกตัวหนังก่อนนะ จุดทองถึงจะขึ้น', 'Select the puppet first, then the beads show up']],
    });
    await this.say('โบกมือทักทายได้แล้ว! ในโรงหนังจริง นายหนังใช้ไม้ตับคุมตัว และไม้มือคุมแขน', 'Now it can wave! Real masters hold the body rod in one hand and the arm rods in the other.');

    // -- 5 depth
    const zs = snap((a) => a.z);
    await this.task('หมุนล้อเมาส์บนตัวหนัง หรือเลื่อนแถบด้านล่าง ให้ถอยเข้าหาตะเกียง', 'Scroll the wheel over the puppet, or use the slider below, to move it toward the lamp', () => S.actors.some((a) => a.pins && zs.has(a) && Math.abs(a.z - zs.get(a)) > 0.09), {
      point: { el: '#depth', actor: () => T.hero() },
      hints: [['บนมือถือใช้แถบเลื่อนใต้จอ ส่วนคีย์บอร์ดใช้ Q กับ E', 'On a phone use the slider; on a keyboard, Q and E'], ['ยิ่งถอยไกล เงายิ่งใหญ่ ยิ่งเบลอ ลองดูสิ', 'The further back, the bigger and blurrier. Try it!']],
    });
    await this.say('เห็นไหม ยิ่งห่างจอเข้าใกล้ตะเกียง เงายิ่งโตและฟุ้ง ยิ่งแนบจอ เงายิ่งคมกริบ นายหนังใช้แบบนี้ทำฉากผีโผล่!', 'See? Near the lamp the shadow grows huge and soft; pressed to the cloth it is razor sharp. Masters use it for ghosts appearing!', { point: heroTarget() });

    // -- 6 turn around
    const fs = snap((a) => a.facing);
    await this.task('กด F หรือคลิกขวาที่ตัวหนัง ให้หันกลับ', 'Press F or right-click the puppet to turn it around', () => S.actors.some((a) => a.pins && fs.has(a) && a.facing !== fs.get(a)), {
      point: { el: () => (document.querySelector('#side .ring .medal') ? '#side .ring .medal' : null), actor: () => T.hero() },
      hints: [['หรือกดเหรียญลูกศรวนที่วงแหวนด้านล่าง', 'Or tap the turning-arrows medallion in the ring below'], ['ตัวหนังมีสองหน้า เหมือนคนสองใจ', 'A puppet has two faces. Like some people I know.']],
    });
    await this.say('หันขวับ! แบบนี้ถึงจะดูมีเรื่องมีราว', 'Swish! Now there is drama.');

    // -- 7 a move
    t0 = this.t;
    await this.task('ลองเล่นท่า: กดปุ่ม 1–0 บนคีย์บอร์ด ปุ่มดาบบนแผงควบคุม หรือเหรียญท่าทาง', 'Play a move: keys 1–0, the sword button on the pad, or the moves medallion', () => since(this.moveLog, t0, () => true), {
      point: { el: () => document.querySelector('#side .medal[title^="ท่า"]') ? '#side .medal[title^="ท่า"]' : '#pad .act.big' },
      hints: [['1 ฟัน 2 แทง 3 ป้อง 4 รำ 5 ไหว้ … ลองกด 4 สิ', '1 strike, 2 lunge, 3 block, 4 dance, 5 wai… try 4!'], ['ไม่มีคีย์บอร์ด? กดปุ่มดาบใหญ่มุมขวาล่าง', 'No keyboard? Tap the big sword button bottom-right']],
    });
    const mv = this.moveLog.filter((e) => e.t >= t0).pop()?.name;
    if (mv && DANCES.has(mv)) await this.say('สวยงาม! แม่ครูที่วังยังต้องอาย', 'Gorgeous! The palace dance teacher would blush.', { pose: 'wai' });
    else if (mv === 'strike' || mv === 'lunge') await this.say('ฮึ่ย! ดุจัง ข้าขอหลบหลังเมฆก่อนนะ', 'Yikes, fierce! Let me hide behind my cloud.', { sfx: 'laugh' });
    else await this.say('ท่าสวย! ในสมุดข่อยมีท่าอีกเพียบ ทั้งรำชุดและท่าตลก', 'Nice move! My book lists plenty more — dance suites and silly ones too.');

    // -- 8 give it to a deva
    t0 = this.t;
    await this.task('เลือกตัวหนัง แตะเหรียญเทวดาในวงแหวน แล้วเลือกบทบาท', 'Select a puppet, tap the deva medallion in the ring and pick a role', () => since(this.assignLog, t0, () => true), {
      point: { el: () => (document.querySelector('#side .fan.open') ? '#side .fan.open' : document.querySelector('#side .medal[title^="มอบให้"]') ? '#side .medal[title^="มอบให้"]' : null), actor: () => T.hero() },
      hints: [['เหรียญรูปเทวดาตัวจิ๋วมีรัศมี อยู่ในแถวด้านล่าง', 'The medallion with a tiny haloed deva, in the row below'], ['เพื่อนๆ ข้าว่างงานกันอยู่ ช่วยหางานให้หน่อย', 'My friends up here are bored. Give them a job!']],
    });
    const role = this.assignLog.filter((e) => e.t >= t0).pop()?.role;
    const ROLE_JOKE = {
      fighter: ['นักดาบ! เพื่อนข้าคนนี้ฟันไม่ค่อยยั้งมือ ระวังหัวด้วยนะ', 'A fighter! That friend of mine never holds back — mind your head.'],
      dancer: ['นางรำ! คนนี้รำเก่งที่สุดในสวรรค์ชั้นดาวดึงส์ (ชั้นเดียวที่เขาเคยไป)', 'A dancer! Best on the whole Tavatimsa heaven (the only one she has visited).'],
      merchant: ['แม่ค้า! ระวังนะ ขายเก่งจนเทวดายังต้องซื้อ', 'A merchant! She could sell clouds to devas.'],
      comedian: ['ตัวตลก! มุกเขาเก่ากว่าตัวข้าอีก แต่ขำทุกที', 'A comedian! His jokes are older than me, and still funny.'],
      monster: ['ปีศาจ!? ตายแล้ว ข้าไปแอบก่อนนะ', 'A monster?! Oh no, I am hiding.'],
      coward: ['ขี้ขลาด… เหมาะกับข้าที่สุด', 'A scaredy-cat… a role made for me.'],
    };
    const rj = ROLE_JOKE[role] || ['เทวดาอีกองค์รับเชือกไปแล้ว ดูเขาเชิดเองสิ!', 'Another deva has taken the strings — watch it play by itself!'];
    await this.say(rj[0], rj[1], { sfx: 'sparkle' });

    // -- 9 a prop in hand
    const held0 = new Set(S.puppets().flatMap((p) => Object.values(p.held || {})).filter(Boolean));
    const t9 = this.t;
    const propOut = () => since(this.spawnLog, t9, (e) => e.chest && e.a && e.def.cat && !e.def.rig && !e.def.weather && !e.def.spell && !e.def.scene);
    await this.task('หยิบอาวุธหรือของจากหีบมาวางบนจอ แล้วลากไปปล่อยที่มือตัวหนัง', 'Take a weapon or prop out of the chest, then drag it onto a puppet\'s hand', () => S.puppets().some((p) => Object.values(p.held || {}).some((x) => x && !held0.has(x))), {
      point: { el: () => (propOut() ? null : g.ui.house.classList.contains('closed') ? '#b-house' : g.ui.tab !== 'weapons' ? '#house .tab[data-tab="weapons"]' : '#house .items .item'), limb: () => { if (!propOut()) return null; const h = this.hero(); return h && h.pins && h.pins.handF ? [h, 'handF'] : null; } },
      hints: [['ลิ้นชักอาวุธมีดาบรออยู่ วางบนจอก่อน แล้วลากไปชนมือ', 'Swords wait in the weapons drawer — put one on the cloth, then drag it to a hand'], ['ปล่อยใกล้ๆ มือพอ ไม่ต้องเล็งเป๊ะ · หรือใช้วงล้ออาวุธบนแผงควบคุม', 'Close to the hand is enough · or use the weapon wheel on the pad']],
    });
    await this.say('ถือของแล้วดูเท่ขึ้นสามเท่า! ของที่ปล่อยบนมือ ตัวหนังจะถือไว้เอง', 'Three times cooler already! Anything dropped on a hand gets held.', { sfx: 'sparkle' });

    // -- finale: the book and the quests
    await this.say('แย่แล้ว ได้เวลาเข้าเฝ้าพระอินทร์ ข้าต้องกลับก่อน แต่ข้าจะทิ้งสมุดข่อยวิเศษไว้ให้', 'Oh no, Indra is expecting me! I must go — but I will leave you my magic folding book.', { pose: 'wai' });
    this.line && this._finishTyping();
    await this._dropBook();
    await this.say('ในสมุดมีทุกอย่างที่ข้าไม่ได้สอน: เวทมนตร์ สัตว์ กีฬา ฉาก กล้อง ติดตามมือ ตัดต่อวิดีโอ…', 'It holds everything I skipped: magic, animals, games, scenes, the camera, hand tracking, video editing…', { point: { el: '#b-book' } });
    await this.say('ของบางอย่างในหีบยังปิดผนึกด้วยเจดีย์ทองอยู่ ทำภารกิจในสมุดให้สำเร็จ ผนึกจะหลุดเอง', 'Some things in the chest are still sealed with a little golden chedi. Finish the quests in the book and the seals fall away.', { point: { el: '#b-house' } });
    const bye = await this.ask('ข้าไปแล้วนะ จะคิดถึงข้าไหม?', 'I am off. Will you miss me?', [
      ['คิดถึงแน่นอน', 'Of course I will'],
      ['ขอกอดก่อนไป', 'A hug before you go?'],
      ['ไปเถอะ ข้าจะเชิดแล้ว', 'Go on, I want to play!'],
    ]);
    this._finishTutorial(false);
    if (bye === 0) await this.say('ฮือๆ ซึ้งจัง! เรียกข้าได้จากสมุดข่อยหน้าสุดท้ายนะ', 'Aww! You can call me back from the last page of the book.', { pose: 'wai' });
    else if (bye === 1) await this.say('กอดเทวดาไม่ได้หรอก ตัวเป็นแสง… แต่ข้าส่งประกายให้แทนนะ!', "You can't hug a deva, we're made of light… have some sparkles instead!", { sfx: 'sparkle' });
    else await this.say('ใจร้าย! แต่ข้าชอบ ไปเชิดให้สนุกนะ นายหนัง!', 'Rude! I like it. Go and have fun, puppet master!', { sfx: 'laugh' });
    this.aim = null;
  }

  // the book drops from Mek's hands into the medallion column
  _dropBook() {
    return new Promise((resolve) => {
      const b = document.getElementById('b-book');
      const D = this.deva;
      if (!b) { resolve(); return; }
      b.classList.remove('tut-nobook');
      b.classList.add('tut-await');
      const r = b.getBoundingClientRect();
      const x1 = r.left + r.width / 2, y1 = r.top + r.height / 2;
      const [x0, y0] = D.hand || [D.x, D.y];
      const fly = document.createElement('div');
      fly.className = 'tut-flybook';
      fly.innerHTML = `<i class="gem"></i>${svg('M3 5.5l4.5-2 4.5 2 4.5-2 4.5 2v14l-4.5-2-4.5 2-4.5-2L3 19.5zM7.5 3.5v14M12 5.5v14M16.5 3.5v14')}`;
      (this.game.root.querySelector('#ui') || document.body).append(fly);
      const N = 24, kf = [];
      const peak = Math.min(y0, y1) - 120;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const x = x0 + (x1 - x0) * u;
        const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * peak + u * u * y1;
        kf.push({ transform: `translate(${x - 26}px, ${y - 26}px) rotate(${u * 720}deg) scale(${0.5 + Math.sin(u * Math.PI) * 0.9 + u * 0.1})`, opacity: u < 0.1 ? u * 10 : 1 });
      }
      this.game.audio?.sfx('magic', { vol: 0.6 });
      this._pose('fly', 1.4);
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        fly.remove();
        b.classList.remove('tut-await');
        this._showBookBtn(true, true);
        this.game.audio?.sfx('chime', { vol: 0.8 });
        this.game.audio?.sfx('sparkle', { vol: 0.6 });
        state.bookGiven = true; save();
        resolve();
      };
      try { fly.animate(kf, { duration: 1400, easing: 'ease-in-out', fill: 'forwards' }).onfinish = finish; } catch (_) { finish(); }
      setTimeout(finish, 1700);
    });
  }

  // ---------------------------------------------------------- frame
  update(dt) {
    this._lastUpd = performance.now();
    this._tick(dt);
  }

  _loop(now) {
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, (now - (this._lt || now)) / 1000);
    this._lt = now;
    if (now - this._lastUpd > 250) this._tick(dt); // the game is not calling update()
    // fallback overlay when the game does not call draw()
    const need = this.deva.alpha > 0.01 && now - this._drawnAt > 400;
    if (need) {
      if (!this.cv) {
        this.cv = document.createElement('canvas');
        this.cv.id = 'tut-cv';
        this.cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none';
        const R = this.game.root.querySelector('#ui') || document.body;
        R.prepend(this.cv);
      }
      const dpr = Math.min(2, devicePixelRatio || 1);
      const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
      if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
      const c = this.cv.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, W, H);
      this._paint(c, dpr);
    } else if (this.cv && now - this._drawnAt <= 400) { this.cv.remove(); this.cv = null; }
    else if (this.cv && this.deva.alpha <= 0.01) { const c = this.cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height); }
  }

  _tick(dt) {
    const g = this.game;
    this.t += dt;
    // typewriter
    const L = this.line;
    if (L && !L.done) {
      L.acc += dt * 34;
      const n = Math.min(L.g.length, Math.floor(L.acc));
      if (n !== L.shown) { L.shown = n; this._renderLine(); }
      if (L.shown >= L.g.length) this._finishTyping();
    }
    // pending waits / tasks
    const P = this.pending;
    if (P && P.kind === 'wait' && this.t >= P.until) { this.pending = null; P.resolve(); }
    if (P && P.kind === 'task') {
      let ok = false;
      try { ok = !!P.check(); } catch (_) { ok = false; }
      if (ok) {
        this.pending = null;
        this.quipT = 0; this._saved = null;
        g.audio?.sfx('sparkle', { vol: 0.7 });
        this._pose('wai', 1.2);
        P.resolve();
      } else {
        const busy = g.drag || g.pointer?.down;
        P.idle = busy ? 0 : P.idle + dt;
        if (P.idle > P.every && P.hints.length && this.quipT <= 0) {
          P.idle = 0;
          const [th, en] = P.hints[P.hintI++ % P.hints.length];
          this.quip(th, en, { ms: 6500, tag: ['คำใบ้', 'Hint'] });
        }
      }
    }
    if (this.quipT > 0) { this.quipT -= dt; if (this.quipT <= 0) this._endQuip(); }
    // quests
    this._pollT -= dt;
    if (this._pollT <= 0) { this._pollT = 0.3; this._pollQuests(); }
    if (this.book?.isOpen && this._toastOn) this._closeToast();
    if (this.toasts.length && !this._toastOn && !this.running && !this.book?.isOpen) this._showToast(this.toasts.shift());
    // hide with show mode / editor playback
    const quiet = g.showMode || g.menu || g.intro;
    this.el.classList.toggle('tut-quiet', !!quiet);
    this._updDeva(dt, quiet);
    this._updRing();
  }

  // ---------------------------------------------------------- deva & pointing
  _boxRect() {
    const r = this.el.getBoundingClientRect();
    return r.width ? r : { left: 120, top: 14, right: 560, bottom: 150, width: 440, height: 136 };
  }

  _targetPt() {
    const A = this.aim;
    if (!A) return null;
    const g = this.game;
    let el = A.el;
    if (typeof el === 'function') el = el();
    if (typeof el === 'string') el = document.querySelector(el);
    if (el && el.getBoundingClientRect) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width > 0 && cs.visibility !== 'hidden' && !el.closest('.hidden') && !el.classList.contains('tut-nobook')) return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.max(r.width, r.height) / 2 + 6, el, rect: r };
    }
    const S = g.scene, cam = g.cam;
    if (A.limb) {
      const L = A.limb();
      if (L && L[0] && !L[0].removed) {
        const w = L[0].limbWorld(L[1]);
        if (w) { const [cx, cy] = S.project(w[0], w[1], L[0].z); const [x, y] = cam.toScreen(cx, cy); return { x, y, r: 16 }; }
      }
    }
    if (A.actor) {
      const a = A.actor();
      if (a && !a.removed && a.root) {
        const hw = a.handleWorld ? a.handleWorld() : [a.root.x, a.root.y];
        const [cx, cy] = S.project(hw[0], hw[1] + 60, a.z);
        const [x, y] = cam.toScreen(cx, cy);
        return { x, y, r: 34 * Math.max(0.6, cam.zoom) };
      }
    }
    return null;
  }

  _updDeva(dt, quiet) {
    const D = this.deva;
    D.t += dt;
    if (D.alpha <= 0 && this.el.classList.contains('hidden')) { this._tp = null; return; }
    const vw = innerWidth, vh = innerHeight;
    const small = vw < 640;
    D.scale = small ? 0.8 : clamp(vw / 1400, 0.85, 1.2) * 1.18;
    const B = this._boxRect();
    const tp = this._targetPt();
    this._tp = tp;
    let hx, hy;
    const onBox = !this.el.classList.contains('hidden');
    if (small) { hx = B.left + 40; hy = B.bottom + 74 * D.scale + 14; } else { hx = B.left - 64 * D.scale; hy = B.top + 86 * D.scale; }
    let tx = hx, ty = hy;
    if (tp && !(tp.y < B.bottom + 30 && tp.x > B.left - 30 && tp.x < B.right + 30)) {
      // hover beside the target: prefer the side facing the middle of the
      // screen, but never inside the chest / box / timeline (the canvas is
      // under the DOM, she would vanish behind them)
      const obst = [B];
      const hb = !this.game.ui?.house?.classList.contains('closed') && document.querySelector('#house .box');
      if (hb) obst.push(hb.getBoundingClientRect());
      for (const sel of ['#timeline', '#pad .stick', '#pad .acts', '#side .ring', '#topbar', '#b-house', '#cam']) {
        const e = document.querySelector(sel);
        if (!e || e.closest('.hidden') || e === tp.el || e.contains(tp.el)) continue;
        const r = e.getBoundingClientRect();
        if (r.width) obst.push(r);
      }
      const bw = 44 * D.scale * 1.35, bh = 62 * D.scale * 1.35;
      const free = (x, y) => x > bw * 0.6 && x < vw - bw * 0.6 && y > bh * 0.7 && y < vh - bh * 0.5 &&
        !obst.some((r) => x + bw * 0.5 > r.left && x - bw * 0.5 < r.right && y + bh * 0.5 > r.top && y - bh * 0.8 < r.bottom);
      // on the stage (a puppet or a limb) she hovers above, out of the way
      const scene = !tp.el;
      const c0 = scene ? -Math.PI / 2 + clamp((vw / 2 - tp.x) / vw, -0.5, 0.5) : Math.atan2(vh / 2 - tp.y, vw / 2 - tp.x);
      let best = null;
      for (const da of [0, -0.6, 0.6, -1.2, 1.2, -1.8, 1.8, Math.PI]) {
        const a = c0 + da, ux = Math.cos(a), uy = Math.sin(a);
        const off = edgeR(tp, ux, uy) + (scene ? 150 : 62) * D.scale + 16;
        const x = tp.x + ux * off, y = tp.y + uy * off - 10;
        if (free(x, y)) { best = [x, y]; break; }
      }
      if (!best) best = [hx, hy]; // no room: point from beside the speech box
      tx = clamp(best[0], 50, vw - 50); ty = clamp(best[1], 60, vh - 70);
    }
    const want = onBox && !quiet ? 1 : 0;
    if (!want) { tx = D.x + (D.x < vw / 2 ? -40 : 40); ty = -160; }
    const k = want ? 5 : 3;
    D.vx += ((tx - D.x) * k - D.vx * 3.2) * dt;
    D.vy += ((ty - D.y) * k - D.vy * 3.2) * dt;
    D.x += D.vx * dt; D.y += D.vy * dt;
    D.alpha = clamp(D.alpha + (want ? dt * 2.5 : -dt * 1.6), 0, 1);
    const moving = Math.hypot(D.vx, D.vy) > 60;
    let pose = this._posed && this.t < this._poseUntil ? this._posed : moving ? 'fly' : (tp ? 'fly' : 'kneel');
    if (pose !== D.pose) { D.prev = D.pose; D.pose = pose; D.poseT = 0; }
    D.poseT += dt;
    const faceWant = tp ? Math.sign(tp.x - D.x) || 1 : moving ? Math.sign(D.vx) || 1 : small ? 1 : 1;
    D.face += (faceWant - D.face) * Math.min(1, dt * 6);
  }

  _updRing() {
    const R = this.ring, tp = this._tp;
    const show = !!(tp && tp.el && this.deva.alpha > 0.5 && !this.el.classList.contains('tut-quiet'));
    R.classList.toggle('hidden', !show);
    if (show) {
      const r = tp.rect;
      const w = r.width + 12, h = r.height + 12;
      const round = Math.abs(w - h) < 0.3 * Math.max(w, h);
      const W = round ? Math.max(w, h) : w, H = round ? Math.max(w, h) : h;
      R.style.width = `${W}px`; R.style.height = `${H}px`;
      R.style.borderRadius = round ? '50%' : '16px';
      R.classList.toggle('box', !round);
      R.style.transform = `translate(${tp.x - W / 2}px, ${tp.y - H / 2}px)`;
    }
  }

  draw(ctx, toScreen, dpr) {
    this._drawnAt = performance.now();
    if (this.cv) { this.cv.remove(); this.cv = null; }
    ctx.save();
    this._paint(ctx, dpr);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _paint(ctx, dpr) {
    const D = this.deva;
    if (D.alpha <= 0.01) return;
    const tp = this._tp;
    const s = D.scale * 1.35;
    // body
    ctx.save();
    ctx.setTransform(dpr * s, 0, 0, dpr * s, D.x * dpr, D.y * dpr);
    ctx.rotate(Math.sin(D.t * 1.3) * 0.05 + clamp(D.vx * 0.0004, -0.25, 0.25));
    const fs = Math.sign(D.face) || 1;
    const face = fs * Math.max(0.08, Math.min(1, Math.abs(D.face) * 1.6));
    const flap = Math.min(1, Math.hypot(D.vx, D.vy) / 320 + 0.15);
    const k = D.prev ? Math.min(1, D.poseT / 0.35) : 1;
    // soft heavenly glow behind her
    const gl = ctx.createRadialGradient(8, -20, 4, 8, -20, 70);
    gl.addColorStop(0, `rgba(255,236,170,${0.32 * D.alpha})`); gl.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = gl; ctx.fillRect(-70, -95, 160, 150);
    let out;
    if (k < 1) {
      ctx.globalAlpha = D.alpha * (1 - k);
      drawDeva(ctx, { t: D.t, face, flap, pose: D.prev, hue: 3, active: true });
    } else D.prev = null;
    ctx.globalAlpha = D.alpha * k;
    out = drawDeva(ctx, { t: D.t, face, flap, pose: D.pose, hue: 3, active: true });
    const m = ctx.getTransform();
    ctx.restore();
    const h = out.hand;
    D.hand = [(m.a * h[0] + m.c * h[1] + m.e) / dpr, (m.b * h[0] + m.d * h[1] + m.f) / dpr];
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    // sparkle trail
    if (Math.random() < 0.5) D.dust.push({ x: D.x + (Math.random() - 0.5) * 20, y: D.y + 10, t: 0, vx: -D.vx * 0.1 + (Math.random() - 0.5) * 20, vy: 12 + Math.random() * 18 });
    D.dust = D.dust.filter((p) => {
      p.t += 1 / 60; p.x += p.vx / 60; p.y += p.vy / 60;
      if (p.t > 1.1) return false;
      ctx.fillStyle = `rgba(255,225,150,${(1 - p.t / 1.1) * 0.85 * D.alpha})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.7, 0, 7); ctx.fill();
      return true;
    });
    // golden pointing arc from her hand to the target
    if (tp && D.alpha > 0.3) this._arrow(ctx, D.hand[0], D.hand[1], tp);
    // a glowing ring on the stage for puppets / limbs (DOM targets get #tut-ring)
    if (tp && !tp.el && D.alpha > 0.3) {
      const t = this.t, r = tp.r + Math.sin(t * 4) * 2;
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(tp.x, tp.y, r * 0.6, tp.x, tp.y, r * 1.5);
      gr.addColorStop(0, 'rgba(255,220,140,0)'); gr.addColorStop(0.5, `rgba(255,220,140,${0.28 * D.alpha})`); gr.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(tp.x, tp.y, r * 1.5, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(90,44,8,${0.55 * D.alpha})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(tp.x, tp.y, r, 0, 7); ctx.stroke();
      ctx.strokeStyle = `rgba(255,226,140,${0.95 * D.alpha})`; ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 20;
      ctx.beginPath(); ctx.arc(tp.x, tp.y, r, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      const u = (t * 0.8) % 1;
      ctx.strokeStyle = `rgba(255,236,170,${(1 - u) * 0.8 * D.alpha})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(tp.x, tp.y, r * (1 + u * 0.6), 0, 7); ctx.stroke();
    }
    ctx.restore();
  }

  _arrow(ctx, x0, y0, tp) {
    const dx = tp.x - x0, dy = tp.y - y0, d = Math.hypot(dx, dy);
    const ux = dx / d, uy = dy / d;
    const er = edgeR(tp, -ux, -uy) + 10;
    if (d < er + 24) return;
    const x1 = tp.x - ux * er, y1 = tp.y - uy * er;
    const bend = Math.min(90, d * 0.25);
    const cx = (x0 + x1) / 2 - uy * bend, cy = (y0 + y1) / 2 + ux * bend;
    const t = this.t;
    const A = this.deva.alpha;
    const pt = (u) => [(1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1];
    const n = Math.max(8, Math.round(d / 16));
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = 'rgba(255,200,100,0.8)'; ctx.shadowBlur = 6;
    ctx.strokeStyle = `rgba(90,44,8,${0.7 * A})`; ctx.lineWidth = 0.9;
    for (let i = 0; i < n; i++) {
      const u = ((i + (t * 1.6) % 1) / n);
      const [px, py] = pt(u);
      const r = 1.3 + u * 2;
      ctx.fillStyle = `rgba(255,${205 + u * 35 | 0},${110 + u * 60 | 0},${(0.35 + u * 0.65) * A})`;
      ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    // arrow head: a little gilded flame (กระหนก) pointing at the target
    const [ax, ay] = pt(0.97);
    const hx = x1 - ax, hy = y1 - ay, hl = Math.hypot(hx, hy) || 1;
    const bx = hx / hl, by = hy / hl;
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(Math.atan2(by, bx));
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(255,226,140,${A})`;
    ctx.strokeStyle = `rgba(122,74,18,${A})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(2, 0); ctx.quadraticCurveTo(-6, -3, -14, -9); ctx.quadraticCurveTo(-10, -2, -12, 0); ctx.quadraticCurveTo(-10, 2, -14, 9); ctx.quadraticCurveTo(-6, 3, 2, 0);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // twinkles around the target
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = 'rgba(255,190,90,0.9)'; ctx.shadowBlur = 5;
    for (let i = 0; i < 3; i++) {
      const a = t * 2.2 + i * 2.09, rr = tp.r + 6 + Math.sin(t * 5 + i) * 3;
      const sx = tp.x + Math.cos(a) * rr, sy = tp.y + Math.sin(a) * rr;
      const s = 3 + Math.sin(t * 7 + i * 2) * 1.5;
      ctx.fillStyle = `rgba(255,240,190,${0.9 * A})`;
      ctx.beginPath(); ctx.moveTo(sx, sy - s * 1.6); ctx.lineTo(sx + s * 0.4, sy); ctx.lineTo(sx, sy + s * 1.6); ctx.lineTo(sx - s * 0.4, sy); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx - s * 1.6, sy); ctx.lineTo(sx, sy + s * 0.4); ctx.lineTo(sx + s * 1.6, sy); ctx.lineTo(sx, sy - s * 0.4); ctx.closePath(); ctx.fill();
    }
  }

  // ---------------------------------------------------------- for the book
  resetProgress() {
    for (const k of Object.keys(state.q)) delete state.q[k];
    save();
    this.refreshLocks();
    this.book?.refresh();
  }
}
