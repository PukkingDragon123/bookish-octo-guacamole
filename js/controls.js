// Play without a camera: a 2D side-scroller pad for touch and mouse — a
// gilded joystick to walk, buttons to leap and strike, and two radial
// wheels (moves and weapons) that bloom around your thumb.

import { thumbnail } from './ui.js';

const P = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const MOVE_WHEEL = [
  ['strike', 'M4 20L16 8M16 8l2-4 2 2-4 2M7 13l4 4', 'ฟันดาบ · Strike'],
  ['lunge', 'M3 12h14M13 8l4 4-4 4M20 6v12', 'แทง · Lunge'],
  ['block', 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z', 'ป้อง · Block'],
  ['roar', 'M12 2c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 0 2 1 3 2 3 0-3 0-5 1-8z', 'คำราม · Roar'],
  ['dance', 'M12 21c-4-3-7-6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4-3 7-7 10zM12 8v13', 'รำ · Dance'],
  ['wong', 'M7 20v-8c0-3 1-7 3-9 1 3 1 6 1 8 1-3 3-5 5-5-1 3-2 5-2 8l-1 6', 'ตั้งวง · Pose'],
  ['wai', 'M12 3c1.5 3 2 6 2 10l2 8H8l2-8c0-4 .5-7 2-10z', 'ไหว้ · Wai'],
  ['laugh', 'M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0M8 14c1 2 2.5 3 4 3s3-1 4-3', 'หัวเราะ · Laugh'],
  ['bow', 'M12 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM8 21l2-7c1-2 3-3 6-2l3 1', 'คำนับ · Bow'],
  ['wave', 'M7 11V5.5a1.5 1.5 0 0 1 3 0V10M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V13a6 6 0 0 1-6 6 5 5 0 0 1-5-4l-1-3', 'โบกมือ · Wave'],
];

export class Controls {
  constructor(game) {
    this.game = game;
    this.move = 0;
    this.vert = 0;
    const root = game.root.querySelector('#ui');
    this.el = document.createElement('div');
    this.el.id = 'pad';
    this.el.className = 'hidden';
    this.el.innerHTML = `
      <div class="stick" title="เดิน · Walk"><i class="knob"></i></div>
      <div class="acts">
        <button class="medal act" data-a="jump" title="กระโดด · Leap"><i class="gem"></i>${P('M12 20V5M6 11l6-6 6 6')}</button>
        <button class="medal act big" data-a="strike" title="โจมตี · Attack"><i class="gem"></i>${P('M4 20L16 8M16 8l2-4 2 2-4 2M7 13l4 4')}</button>
        <button class="medal act" data-a="moves" title="วงล้อท่า · Move wheel"><i class="gem"></i>${P('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18M3 12h18')}</button>
        <button class="medal act" data-a="weapons" title="วงล้ออาวุธ · Weapon wheel"><i class="gem"></i>${P('M14.5 3l6.5 6.5-11 11L3.5 14zM5 19l-2 2M8 8l8 8')}</button>
        <button class="medal act" data-a="next" title="สลับตัวหนัง · Next puppet"><i class="gem"></i>${P('M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4')}</button>
      </div>
      <div class="wheel hidden"></div>`;
    root.append(this.el);
    this.stick = this.el.querySelector('.stick');
    this.knob = this.el.querySelector('.knob');
    this.wheel = this.el.querySelector('.wheel');
    this._stick();
    this.el.querySelectorAll('.act').forEach((b) => {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this._act(b.dataset.a, b); });
    });
  }

  show(on) { this.el.classList.toggle('hidden', !on); }

  _stick() {
    let id = null, cx = 0, cy = 0;
    const R = 46;
    const upd = (e) => {
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.move = Math.abs(dx) > 8 ? dx / R : 0;
      const v = dy / R;
      if (v < -0.7 && this.vert >= -0.7) this.game.padAction('jump');
      this.vert = v;
    };
    this.stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      id = e.pointerId;
      const r = this.stick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      this.stick.setPointerCapture(id);
      upd(e);
    });
    this.stick.addEventListener('pointermove', (e) => { if (e.pointerId === id) upd(e); });
    const end = () => { id = null; this.move = 0; this.vert = 0; this.knob.style.transform = ''; };
    this.stick.addEventListener('pointerup', end);
    this.stick.addEventListener('pointercancel', end);
  }

  _act(a, btn) {
    if (a === 'moves') return this.openWheel(MOVE_WHEEL.map(([id, d, t]) => ({ id, html: P(d), title: t })), (id) => this.game.playMove(id), btn);
    if (a === 'weapons') {
      const ws = this.game.content.props.filter((p) => p.cat === 'weapons' || (p.fx === 'fire' && p.grip)).slice(0, 14);
      return this.openWheel([{ id: '', html: P('M6 6l12 12M18 6L6 18'), title: 'มือเปล่า · Bare hands' }, ...ws.map((w) => ({ id: w.id, node: thumbnail(w, 60), title: `${w.name} · ${w.en}` }))], (id) => this.game.equip(id), btn);
    }
    this.game.padAction(a);
  }

  // radial menu around the button that opened it
  openWheel(items, pick, btn) {
    const W = this.wheel;
    if (!W.classList.contains('hidden') && W._from === btn) { W.classList.add('hidden'); return; }
    W._from = btn;
    W.innerHTML = '';
    const r = btn.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const n = items.length, R = Math.max(96, n * 13);
    // fan open toward the upper-left (away from the screen edge)
    const a0 = Math.PI * 0.95, a1 = Math.PI * 1.55;
    items.forEach((it, i) => {
      const a = n === 1 ? (a0 + a1) / 2 : a0 + ((a1 - a0) * i) / (n - 1) + (n > 8 ? (i % 2) * 0.0 : 0);
      const rr = R * (n > 9 ? (i % 2 ? 1.45 : 1) : 1);
      const b = document.createElement('button');
      b.className = 'mini wheel-item';
      b.title = it.title;
      if (it.node) b.append(it.node); else b.innerHTML = it.html;
      b.style.left = `${cx + Math.cos(a) * rr - 22}px`;
      b.style.top = `${cy + Math.sin(a) * rr - 22}px`;
      b.style.transitionDelay = `${i * 18}ms`;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); pick(it.id); W.classList.add('hidden'); });
      W.append(b);
    });
    W.classList.remove('hidden');
    requestAnimationFrame(() => W.classList.add('bloom'));
    const close = (e) => { if (!W.contains(e.target) && e.target !== btn && !btn.contains(e.target)) { W.classList.add('hidden'); W.classList.remove('bloom'); removeEventListener('pointerdown', close, true); } };
    addEventListener('pointerdown', close, true);
  }
}
