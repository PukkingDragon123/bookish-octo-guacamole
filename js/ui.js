// DOM user interface: toolbar, the puppet house (หีบหนัง) drawer, the
// stagehand-fly panel, camera picture-in-picture, help and titles.

import { CATEGORIES } from './content.js';
import { assemble, drawRig, rigBounds } from './puppet/rig.js';
import { ROLES } from './sandbox/flies.js';
import { ANIMS, KEY_MOVES } from './puppet/animations.js';

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
    const btn = (id, th, en, fn) => el('button', { class: 'tb', id, onclick: fn, title: en }, th, el('small', {}, en));
    this.top = el('div', { id: 'topbar', class: 'lacquer hidden' },
      btn('b-house', '🎭 หีบหนัง', 'Puppet house', () => this.toggleHouse()),
      btn('b-hand', '✋ ติดตามมือ', 'Hand tracking', () => g.toggleTracking()),
      btn('b-demo', '✨ สาธิตมือ', 'Hand demo', () => g.toggleDemo()),
      btn('b-lamp', '🔥 ตะเกียง', 'Lamp', () => g.toggleLamp()),
      btn('b-view', '☁ สวรรค์', 'Look up', () => g.toggleView()),
      btn('b-show', '🎬 แสดง', 'Show mode', () => g.toggleShow()),
      btn('b-sound', '🔊', 'Sound', () => g.toggleSound()),
      btn('b-clear', '🧹 ล้าง', 'Clear', () => g.clearStage()),
      btn('b-help', '?', 'Help', () => this.toggleHelp()),
    );
    this.house = el('div', { id: 'house', class: 'lacquer hidden' },
      el('h2', {}, 'หีบหนัง', el('small', {}, 'drag onto the screen')),
      this.tabs = el('div', { class: 'tabs' }),
      this.items = el('div', { class: 'items' }),
      el('div', { class: 'house-foot' }, 'ลากตัวหนังหรือฉากไปวางบนจอ · Drag onto the cloth. Drop a prop on a puppet’s hand to give it to them.'),
    );
    for (const [id, th, en] of CATEGORIES) {
      const count = id === 'puppets' ? g.content.puppets.length : g.content.props.filter((p) => p.cat === id).length;
      if (!count) continue;
      this.tabs.append(el('button', { class: 'tab' + (id === this.tab ? ' on' : ''), 'data-tab': id, title: en, onclick: (e) => this.showTab(id) }, th));
    }
    this.side = el('div', { id: 'side', class: 'lacquer hidden' });
    this.cam = el('div', { id: 'cam', class: 'lacquer hidden' }, this.camCanvas = el('canvas', { width: 440, height: 330 }), this.gest = el('div', { class: 'gest' }, ''));
    this.toastEl = el('div', { id: 'toast', class: 'lacquer hidden' });
    this.title = el('div', { id: 'title', class: 'hidden' }, el('div', {}, el('div', { class: 't1' }, 'หนังตะลุง'), el('div', { class: 't2' }, 'Nang Talung · Shadows of Heaven')));
    this.skip = el('button', { id: 'skip', class: 'tb hidden', onclick: () => g.skipIntro() }, 'ข้าม ›', el('small', {}, 'skip'));
    this.help = el('div', { id: 'help', class: 'lacquer hidden', onclick: () => this.toggleHelp(false) }, el('div', { html: HELP }));
    R.append(this.top, this.house, this.side, this.cam, this.toastEl, this.title, this.skip, this.help);
    this.showTab(this.tab);
    this.renderSide();
  }

  showTab(id) {
    this.tab = id;
    this.tabs.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === id));
    this.items.innerHTML = '';
    const list = id === 'puppets' ? this.game.content.puppets : this.game.content.props.filter((p) => p.cat === id);
    for (const def of list) {
      const it = el('div', { class: 'item', title: def.en || '' }, thumbnail(def), el('span', {}, def.name || def.id));
      it.addEventListener('pointerdown', (e) => { e.preventDefault(); this.game.beginSpawnDrag(def, e); });
      this.items.append(it);
    }
  }

  toggleHouse(on) {
    const c = this.house.classList.toggle('closed', on === undefined ? undefined : !on);
    return !c;
  }

  toggleHelp(on) { this.help.classList.toggle('hidden', on === undefined ? undefined : !on); }

  reveal(on = true) {
    for (const e of [this.top, this.house, this.side]) e.classList.toggle('hidden', !on);
  }

  setButton(id, on) { this.root.querySelector('#' + id)?.classList.toggle('on', !!on); }

  toast(msg, ms = 3200) {
    this.toastEl.innerHTML = msg;
    this.toastEl.classList.remove('hidden');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  // right panel: selected actor + fly roles + moves
  renderSide() {
    const g = this.game;
    const a = g.selected;
    const s = this.side;
    s.innerHTML = '';
    if (!a) {
      s.append(el('h3', {}, 'แมลงหวี่'), el('p', {}, `คลิกตัวหนังเพื่อเลือก แล้วมอบบทให้แมลงหวี่เชิดแทน · Select a puppet, then give a fruit fly a role and it will perform on its own. Flies free: ${g.freeFlies()}`));
      s.append(el('p', {}, 'ปุ่ม 1–0 = ท่าพิเศษ · F = กลับตัว · ล้อเมาส์ = ใกล้/ไกลจอ · Del = เก็บ'));
      return;
    }
    const def = a.def || a.rig || {};
    s.append(el('h3', {}, def.name || 'ตัวหนัง'), el('p', {}, def.en || ''));
    s.append(el('p', {}, 'ระยะจากจอ · distance from cloth'));
    const d = el('input', { id: 'depth', type: 'range', min: '0', max: '0.5', step: '0.005' });
    d.value = a.z;
    d.oninput = () => a.setDepth(+d.value);
    s.append(d);
    if (a.rig && a.isHumanoid) {
      const mv = el('div', { class: 'moves' });
      const keyOf = Object.fromEntries(Object.entries(KEY_MOVES).map(([k, v]) => [v, k.replace('Digit', '')]));
      for (const name of ['strike', 'lunge', 'block', 'dance', 'wai', 'leap', 'roar', 'laugh', 'wong', 'bow', 'wave', 'cheer']) {
        mv.append(el('button', { onclick: () => g.playMove(name) }, ANIMS[name].th, el('kbd', {}, keyOf[name] || '')));
      }
      s.append(mv);
    }
    if (a.rig) {
      s.append(el('p', {}, 'บทของแมลงหวี่ · fly role'));
      const row = el('div', { class: 'row' });
      for (const [id, th, en] of ROLES) row.append(el('button', { class: 'role' + (a.flyRole === id ? ' on' : ''), title: en, onclick: () => g.assignFly(a, id) }, th));
      if (a.controller && a.controller !== 'player') row.append(el('button', { class: 'role', onclick: () => g.assignFly(a, null) }, 'ปล่อย'));
      s.append(row);
    }
    const row2 = el('div', { class: 'row' },
      el('button', { class: 'role', onclick: () => a.flip() }, '⇆ กลับตัว'),
      el('button', { class: 'role', onclick: () => g.removeActor(a) }, '✕ เก็บ'));
    s.append(row2);
  }
}

const HELP = `
<h2>วิธีเชิดหนัง · How to play</h2>
<p>You are a deva in the heavens above a village หนังตะลุง show. Golden strings run from your hand to the leather puppets behind the cloth. Everything you see on the screen is their shadow: push a puppet toward the lamp and it grows and blurs; press it against the cloth and its dyed hide glows in colour.</p>
<table>
<tr><td>ลาก / Drag</td><td>Drag a puppet's body to move it (it walks when near the ground). Drag near a hand, foot or head to pull that limb's string.</td></tr>
<tr><td>ล้อเมาส์ / Wheel</td><td>Move the puppet toward the lamp or back onto the cloth.</td></tr>
<tr><td>F · คลิกขวา</td><td>Turn the puppet around.</td></tr>
<tr><td>1–0</td><td>Special moves: strike, lunge, block, dance, wai, leap, roar, laugh, ตั้งวง pose, bow.</td></tr>
<tr><td>← → ↑ ↓ · Q E</td><td>Walk / lift the selected puppet · change depth.</td></tr>
<tr><td>หีบหนัง</td><td>Drag puppets and props from the puppet house. Drop weapons, food or instruments on a hand to hand them over. Click an instrument to play it.</td></tr>
<tr><td>แมลงหวี่</td><td>Select a puppet and give it a role (fighter, dancer, merchant, villager, comedian, monster…). A fruit fly takes over its strings.</td></tr>
<tr><td>✋ ติดตามมือ</td><td>Your webcam hand becomes the puppeteer's hand. Palm = body, hand size = distance from the cloth, tilt = lean, flip your hand = turn around. Thumb → back arm, index → front arm, middle → head, ring → back leg, pinky → front leg.</td></tr>
<tr><td>ท่ามือ / Hand poses</td><td>✊ fist = sword strike · ☝ point = lunge · ✋ open palm = block · 🤌 จีบ = Thai dance · ตั้งวง (fingers together, thumb in) = classic pose · ✌ = leap · 🤘 = demon roar · 👍 = laugh · 🙏 two hands = wai. A second hand controls a second puppet.</td></tr>
<tr><td>🔥 ตะเกียง</td><td>Drag the lamp's bright spot on the cloth to move the light (hold Alt). Toggle oil lamp / electric bulb.</td></tr>
</table>
<p style="opacity:.6">คลิกเพื่อปิด · click to close</p>`;
