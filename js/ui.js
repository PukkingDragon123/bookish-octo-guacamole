// Royal, near-wordless interface: small gilded medallion buttons with
// gems, a carved wooden puppet chest that opens to a scrollable tray,
// a tiny self-view camera window, and a quiet ring of actions around
// the selected puppet. Words only live in tooltips and the help card.

import { CATEGORIES } from './content.js';
import { assemble, drawRig, rigBounds } from './puppet/rig.js';
import { ROLES } from './sandbox/flies.js';
import { ANIMS } from './puppet/animations.js';

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids) if (c != null) e.append(c);
  return e;
};

const P = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
export const ICONS = {
  chest: P('M3 10h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 10c0-4 4-6 9-6s9 2 9 6M10 12h4v3h-4zM3 14h7M14 14h7'),
  hand: P('M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V5.5a1.5 1.5 0 0 1 3 0V13M17 12v-2.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L4.6 14.9a1.6 1.6 0 0 1 2.4-2L8 14'),
  demo: P('M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z'),
  lamp: P('M12 3c2 3 3.5 4.6 3.5 7a3.5 3.5 0 0 1-7 0C8.5 7.6 10 6 12 3zM6 16h12l-1.5 4h-9zM9 13.5h6'),
  heaven: P('M6.5 18a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 16.8 9 4.5 4.5 0 0 1 17.5 18zM12 2v2M5 5l1.4 1.4M19 5l-1.4 1.4'),
  sound: P('M4 9h4l5-4v14l-5-4H4zM16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12'),
  mute: P('M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6'),
  clear: P('M14 3l-4 9M7 12h8l2 9H5zM9 16v5M13 16v5'),
  help: P('M9.2 9a3 3 0 1 1 4.3 2.7c-1 .5-1.5 1.2-1.5 2.3M12 18h.01'),
  show: P('M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z'),
  flip: P('M7 7h11l-3-3M17 17H6l3 3'),
  remove: P('M6 6l12 12M18 6L6 18'),
  deva: P('M12 2l1.4 3.4h-2.8zM12 6.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM7 21c0-4 2.2-7 5-7s5 3 5 7M4 11c2 1 3.5 1 5 0M20 11c-2 1-3.5 1-5 0'),
  pad: P('M6 9h12a4 4 0 0 1 3.8 5.2l-1.3 4a2 2 0 0 1-3.4.7L15 17H9l-2.1 1.9a2 2 0 0 1-3.4-.7l-1.3-4A4 4 0 0 1 6 9zM8 11v4M6 13h4M16 12h.01M18 14h.01'),
  film: P('M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4'),
  moves: P('M4 20L15 9M15 9l2-5 3 3-5 2M20 20L9 9M9 9L7 4 4 7l5 2'),
  release: P('M12 3v9M8 8l4 4 4-4M5 16c2 3 4 4 7 4s5-1 7-4'),
};

// move -> icon (tiny glyphs drawn as SVG)
const MOVE_ICONS = {
  strike: 'M4 20L16 8M16 8l2-4 2 2-4 2M7 13l4 4',
  lunge: 'M3 12h14M13 8l4 4-4 4M20 6v12',
  block: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z',
  dance: 'M12 21c-4-3-7-6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4-3 7-7 10zM12 8v13',
  wai: 'M12 3c1.5 3 2 6 2 10l2 8H8l2-8c0-4 .5-7 2-10z',
  leap: 'M12 20V5M6 11l6-6 6 6',
  roar: 'M12 2c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 0 2 1 3 2 3 0-3 0-5 1-8z',
  laugh: 'M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0M8 14c1 2 2.5 3 4 3s3-1 4-3M8.5 9.5h.01M15.5 9.5h.01',
  wong: 'M7 20v-8c0-3 1-7 3-9 1 3 1 6 1 8 1-3 3-5 5-5-1 3-2 5-2 8l-1 6',
  bow: 'M12 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM8 21l2-7c1-2 3-3 6-2l3 1',
  wave: 'M7 11V5.5a1.5 1.5 0 0 1 3 0V10M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V13a6 6 0 0 1-6 6 5 5 0 0 1-5-4l-1-3M19 4c1 1 2 3 2 5',
  cheer: 'M5 3l3 7M19 3l-3 7M8 10h8l-1 11H9z',
};
const ROLE_ICONS = {
  fighter: MOVE_ICONS.strike, dancer: MOVE_ICONS.dance, merchant: 'M4 9l2-5h12l2 5M4 9h16v11H4zM9 20v-6h6v6',
  villager: 'M3 11l9-7 9 7M6 10v10h12V10', comedian: MOVE_ICONS.laugh, monster: MOVE_ICONS.roar,
  coward: 'M12 3v11M12 18h.01M5 21h14', follower: 'M5 12h10M11 7l5 5-5 5M19 5v14', wander: 'M3 17c3-6 6 2 9-4s6 2 9-4',
};

export function thumbnail(def, size = 120) {
  const c = document.createElement('canvas');
  c.width = size; c.height = Math.round(size * 1.1);
  const g = c.getContext('2d');
  const rig = def.rig || { root: 'm', parts: { m: { sprite: def.sprite, z: 0 } } };
  try {
    const T = assemble(rig);
    const b = rigBounds(rig, T);
    const k = Math.min((c.width - 8) / b.w, (c.height - 8) / b.h);
    g.translate(c.width / 2 - (b.x0 + b.w / 2) * k, c.height / 2 - (b.y0 + b.h / 2) * k);
    g.scale(k, k);
    drawRig(g, rig, T);
  } catch (e) { /* ignore */ }
  return c;
}

function medal(icon, title, onclick, { id, cls = '' } = {}) {
  return el('button', { class: 'medal ' + cls, id, title, 'aria-label': title, onclick, html: `<i class="gem"></i>${icon}` });
}
const glyph = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

export class UI {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.tab = 'puppets';
    this._build();
  }

  _build() {
    const g = this.game;
    const R = this.root;
    // corner medallions
    this.top = el('div', { id: 'topbar', class: 'hidden' },
      medal(ICONS.hand, 'ติดตามมือ · Hand tracking', () => g.toggleTracking(), { id: 'b-hand' }),
      medal(ICONS.demo, 'สาธิตมือ · Hand demo', () => g.toggleDemo(), { id: 'b-demo' }),
      medal(ICONS.lamp, 'ตะเกียง · Lamp', () => g.toggleLamp(), { id: 'b-lamp' }),
      medal(ICONS.pad, 'ปุ่มควบคุม · Game pad', () => g.togglePad(), { id: 'b-pad' }),
      medal(ICONS.film, 'ตัดต่อ · Timeline editor', () => g.toggleEditor(), { id: 'b-edit' }),
      medal(ICONS.show, 'แสดง · Show mode', () => g.toggleShow(), { id: 'b-show' }),
      medal(ICONS.sound, 'เสียง · Sound', () => g.toggleSound(), { id: 'b-sound' }),
      medal(ICONS.clear, 'ล้างเวที · Clear stage', () => g.clearStage(), { id: 'b-clear' }),
      medal(ICONS.help, 'วิธีเล่น · Help', () => this.toggleHelp(), { id: 'b-help' }),
    );
    // the puppet chest
    this.chestBtn = medal(ICONS.chest, 'หีบหนัง · Puppet chest', () => this.toggleHouse(), { id: 'b-house', cls: 'big' });
    this.house = el('div', { id: 'house', class: 'closed hidden' },
      el('div', { class: 'lid' }, el('i', { class: 'clasp' })),
      el('div', { class: 'box' },
        this.tabs = el('div', { class: 'tabs' }),
        this.items = el('div', { class: 'items' }),
      ),
    );
    this.rebuildTabs();
    this.side = el('div', { id: 'side', class: 'hidden' });
    this.cam = el('div', { id: 'cam', class: 'hidden' }, this.camCanvas = el('canvas', { width: 240, height: 180 }), this.gest = el('i', { class: 'gest' }));
    this.toastEl = el('div', { id: 'toast', class: 'hidden' });
    this.title = el('div', { id: 'title', class: 'hidden' }, el('div', {}, el('div', { class: 't1' }, 'หนังตะลุง')));
    this.skip = el('button', { id: 'skip', class: 'medal hidden', title: 'ข้าม · Skip', onclick: () => g.skipIntro(), html: '<i class="gem"></i>' + glyph('M5 5l7 7-7 7M13 5l7 7-7 7') });
    this.help = el('div', { id: 'help', class: 'hidden', onclick: () => this.toggleHelp(false) }, el('div', { html: HELP }));
    R.append(this.top, this.chestBtn, this.house, this.side, this.cam, this.toastEl, this.title, this.skip, this.help);
    this.chestBtn.classList.add('hidden');
    this.showTab(this.tab);
    this.renderSide();
  }

  rebuildTabs() {
    const g = this.game;
    this.tabs.innerHTML = '';
    for (const [id, th, en] of CATEGORIES) {
      const list = id === 'puppets' ? g.content.puppets : g.content.props.filter((p) => p.cat === id);
      if (!list.length) continue;
      const b = el('button', { class: 'tab' + (id === this.tab ? ' on' : ''), 'data-tab': id, title: `${th} · ${en}`, onclick: () => this.showTab(id) });
      b.append(thumbnail(list[Math.min(1, list.length - 1)], 44));
      this.tabs.append(b);
    }
  }

  showTab(id) {
    this.tab = id;
    this.tabs.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === id));
    this.items.innerHTML = '';
    const list = id === 'puppets' ? this.game.content.puppets : this.game.content.props.filter((p) => p.cat === id);
    for (const def of list) {
      const it = el('div', { class: 'item', title: `${def.name || ''} · ${def.en || ''}` }, thumbnail(def));
      it.addEventListener('pointerdown', (e) => { e.preventDefault(); this.game.beginSpawnDrag(def, e); this.toggleHouse(false); });
      this.items.append(it);
    }
    this.items.scrollTop = 0;
  }

  toggleHouse(on) {
    const open = on === undefined ? this.house.classList.contains('closed') : on;
    this.house.classList.toggle('closed', !open);
    this.chestBtn.classList.toggle('on', open);
    this.game.audio?.sfx(open ? 'curtain' : 'thud', { vol: 0.35 });
    return open;
  }

  toggleHelp(on) { this.help.classList.toggle('hidden', on === undefined ? undefined : !on); }

  reveal(on = true) {
    for (const e of [this.top, this.chestBtn, this.side]) e.classList.toggle('hidden', !on);
    this.house.classList.toggle('hidden', !on);
  }

  setButton(id, on) {
    const b = this.root.querySelector('#' + id);
    if (!b) return;
    b.classList.toggle('on', !!on);
    if (id === 'b-sound') b.innerHTML = '<i class="gem"></i>' + (on ? ICONS.mute : ICONS.sound);
  }

  // errors only — the stage speaks for itself
  toast(msg, ms = 4200, { error = false } = {}) {
    if (!error) return;
    this.toastEl.innerHTML = msg;
    this.toastEl.classList.remove('hidden');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  // a quiet ring of medallions for the selected puppet
  renderSide() {
    const g = this.game;
    const a = g.selected;
    const s = this.side;
    s.innerHTML = '';
    s.classList.toggle('empty', !a);
    if (!a) return;
    const row = el('div', { class: 'ring' });
    row.append(medal(ICONS.flip, 'กลับตัว · Turn around', () => a.flip()));
    if (a.rig && a.isHumanoid) {
      const moves = el('div', { class: 'fan' });
      for (const name of ['strike', 'lunge', 'block', 'dance', 'wai', 'leap', 'roar', 'laugh', 'wong', 'bow', 'wave', 'cheer']) {
        moves.append(el('button', { class: 'mini', title: `${ANIMS[name].th} · ${ANIMS[name].en}`, onclick: () => g.playMove(name), html: glyph(MOVE_ICONS[name]) }));
      }
      const mb = medal(ICONS.moves, 'ท่า · Moves', () => { moves.classList.toggle('open'); roles.classList.remove('open'); });
      row.append(mb, moves);
    }
    const roles = el('div', { class: 'fan' });
    if (a.rig) {
      for (const [id, th, en] of ROLES) {
        roles.append(el('button', { class: 'mini' + (a.flyRole === id ? ' on' : ''), title: `${th} · ${en}`, onclick: () => g.assignFly(a, id), html: glyph(ROLE_ICONS[id]) }));
      }
      if (a.flyRole) roles.append(el('button', { class: 'mini', title: 'ปล่อย · Release', onclick: () => g.assignFly(a, null), html: ICONS.release }));
      row.append(medal(ICONS.deva, 'มอบให้เทวดาเชิด · Give to a deva', () => { roles.classList.toggle('open'); row.querySelector('.fan')?.classList.remove('open'); }, { cls: a.flyRole ? 'on' : '' }), roles);
    }
    const d = el('input', { id: 'depth', type: 'range', min: '0', max: '0.5', step: '0.005', title: 'ระยะจากจอ · Distance from cloth' });
    d.value = a.z;
    d.oninput = () => a.setDepth(+d.value);
    row.append(el('div', { class: 'depth' }, d));
    row.append(medal(ICONS.remove, 'เก็บ · Put away', () => g.removeActor(a)));
    s.append(row);
  }
}

const HELP = `
<h2>วิธีเชิดหนัง</h2>
<table>
<tr><td>ลาก</td><td>Drag a puppet to move it; drag near a hand, foot or head to pull that string.</td></tr>
<tr><td>ล้อเมาส์</td><td>Toward the lamp / back onto the cloth.</td></tr>
<tr><td>F · คลิกขวา</td><td>Turn around.</td></tr>
<tr><td>1–0</td><td>Strike · lunge · block · dance · wai · leap · roar · laugh · ตั้งวง · bow</td></tr>
<tr><td>← → ↑ ↓ Q E</td><td>Walk · lift · depth</td></tr>
<tr><td>หีบหนัง</td><td>Open the chest, pick a drawer, drag a puppet or prop onto the cloth. Drop props on a hand to give them.</td></tr>
<tr><td>เทวดา</td><td>Select a puppet, tap the deva medallion and choose a role; a deva takes the strings.</td></tr>
<tr><td>ติดตามมือ</td><td>Palm = body · hand size = depth · tilt = lean · flip hand = turn. Thumb, index, middle, ring, pinky → back arm, front arm, head, back leg, front leg. ✊ strike · ☝ lunge · ✋ block · จีบ dance · ตั้งวง pose · ✌ leap · 🤘 roar · 👍 laugh · 🙏 wai.</td></tr>
<tr><td>ปุ่มควบคุม</td><td>Joystick walks (the stage scrolls on a longer scene), up = leap; sword = attack; wheels = moves and weapons; circle arrows = next puppet. Tap the cloth and the selected puppet walks there.</td></tr>
<tr><td>ตัดต่อ</td><td>Record takes, split/trim/reorder them on the timeline, widen the stage, import images as props, and export a video.</td></tr>
<tr><td>Alt + ลาก</td><td>Move the lamp.</td></tr>
</table>`;
