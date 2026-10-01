// โหมดก่อสร้าง — Build mode: lay out the scenery like a stage carpenter.
//
// A gilded grid over the cloth (cells of 20 / 40 / 80 cloth units, the
// floor line picked out). Tap a prop to select it; drag to move it with
// its base snapping to the grid (hold Alt or Shift, or switch the magnet
// off, to place freely). A knob above the selection rotates it (15° steps),
// a corner handle sizes it (0.25×–4×), two fingers twist and pinch it.
// Layer buttons move it toward the lamp / the cloth (bigger, softer
// shadow) and forward / back among the things at the same depth (tiny z
// offsets, which decide who is "in front" when picking and posing).
// Duplicate, delete, flip, lock, physics on/off, and a saved layout.
//
// Puppets (and animals / trees, which are articulated) can be selected
// too, but only moved, flipped and re-layered.
//
// Input: while build mode is on, capture-phase pointer listeners on the
// fg canvas (and window for move/up of our own pointers) handle the event
// and stopImmediatePropagation(), so the game's own drag code never runs.
// When it's off nothing is intercepted.
//
// Sizing never resamples pixels: the clone shares the original canvas
// (and so the GL texture) with a larger `scale` (world units per pixel),
// and the collision circles / mass / inertia are the original shape's,
// scaled exactly (r·k, m·k², I·k⁴) — so pinching is free and smooth.

import { Puppet } from '../puppet/puppet.js';
import { Prop } from './prop.js';
import { FLOOR } from '../scene/scene.js';
import { CLOTH_W, CLOTH_H } from '../render/screen.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEG = Math.PI / 180;
const STEP_A = 15 * DEG;
const LSTEP = 0.0005;          // z offset between layers at one depth
const BAND = 0.012;            // actors closer than this in z share a depth
const DEPTH_STEP = 0.02;
const S_MIN = 0.25, S_MAX = 4;
const NICE = [0.25, 0.33, 0.5, 0.6, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4];
const CELLS = [20, 40, 80];
const LS_KEY = 'nangtalung.buildLayout.v1';
const tightCache = new WeakMap();

const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const IC = {
  build: 'M3 11l9-7 9 7M5 9.5V20h14V9.5M9 20v-6h6v6M2 20h20',
  rotL: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4 3.5v4h4',
  rotR: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M20 3.5v4h-4',
  smaller: 'M4 14h6v6M10 14l-6 6M20 10h-6V4M14 10l6-6',
  bigger: 'M14 4h6v6M20 4l-6 6M10 20H4v-6M4 20l6-6',
  flip: 'M7 7h11l-3-3M17 17H6l3 3',
  dup: 'M8 8h12v12H8zM4 16V4h12',
  del: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3M12 14.5v2',
  unlock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 7.6-1.8M12 14.5v2',
  phys: 'M12 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM12 13v6M9 16.5l3 3 3-3M5 21h14',
  lamp: 'M12 2.5c1.6 2.2 2.6 3.4 2.6 5a2.6 2.6 0 0 1-5.2 0c0-1.6 1-2.8 2.6-5zM7 18l5-4 5 4M7 22l5-4 5 4',
  cloth: 'M4 3h16v7H4zM7 14l5 4 5-4M7 18l5 4 5-4',
  front: 'M9 9h11v11H9zM4 15V4h11',
  back: 'M4 4h11v11H4zM9 15v5h11V9h-5',
  grid: 'M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16',
  magnet: 'M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4zM6 8h4M14 8h4',
  save: 'M5 4h11l3 3v13H5zM8 4v5h8V4M8 20v-6h8v6',
  load: 'M3 7h6l2 2h10v10H3zM12 11v6M9 14l3 3 3-3',
  close: 'M6 6l12 12M18 6L6 18',
};

export class Build {
  constructor(game) {
    this.game = game;
    this.on = false;
    this.cell = 40;
    this.snap = true;
    this.sel = null;
    this.g = null;            // current gesture
    this.ptrs = new Map();    // our pointers: id -> {x, y}
    this.fade = 0;
    this.shift = false;
    this._wacc = 0;
    this._sig = '';
    this._ui();
    const S = game.scene;
    S.on('removed', (a) => { if (a === this.sel) this._select(null); });
    // bound handlers (added only while on)
    this._h = {
      down: (e) => this._down(e),
      move: (e) => this._move(e),
      up: (e) => this._up(e),
      wheel: (e) => this._wheel(e),
      key: (e) => this._key(e),
      keyup: (e) => { if (e.key === 'Shift') this.shift = false; },
      ctx: (e) => { e.preventDefault(); e.stopImmediatePropagation(); },
    };
    // B toggles build mode (always listening, but only for that key)
    addEventListener('keydown', (e) => {
      if (e.code !== 'KeyB' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (isTyping(e) || game.menu || game.intro) return;
      e.stopImmediatePropagation(); e.preventDefault();
      this.toggle();
    }, { capture: true });
  }

  // ------------------------------------------------------------ DOM
  _ui() {
    if (!document.querySelector('link[data-build-css]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.dataset.buildCss = '1';
      l.href = new URL('../../css/build.css', import.meta.url).href;
      document.head.append(l);
    }
    const root = this.game.root.querySelector('#ui') || document.body;
    const top = this.game.root.querySelector('#topbar');
    if (top && !top.querySelector('#b-build')) {
      const b = document.createElement('button');
      b.className = 'medal'; b.id = 'b-build';
      b.title = 'โหมดก่อสร้าง (B) · Build mode: grid, rotate, size, layers';
      b.setAttribute('aria-label', b.title);
      b.innerHTML = '<i class="gem"></i>' + svg(IC.build);
      b.onclick = () => this.toggle();
      top.insertBefore(b, top.querySelector('#b-help'));
      this.btn = b;
    } else this.btn = top?.querySelector('#b-build');

    const mk = (icon, title, fn, cls = '') => {
      const b = document.createElement('button');
      b.className = 'bm ' + cls; b.title = title; b.setAttribute('aria-label', title);
      b.innerHTML = svg(icon);
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(e); this.game.audio?.sfx('click', { vol: 0.25 }); });
      return b;
    };
    // the global bar: grid size, magnet, save, load, close
    const bar = document.createElement('div');
    bar.id = 'build-bar'; bar.className = 'bpanel hidden';
    this.bGrid = mk(IC.grid, 'ขนาดตาราง · Grid size (G): 20 / 40 / 80', () => this.cycleGrid(), 'chip');
    this.bGrid.insertAdjacentHTML('beforeend', '<b class="num">40</b>');
    this.bSnap = mk(IC.magnet, 'ดูดติดตาราง · Snap to grid (N) — hold Alt/Shift to place freely', () => this.setSnap(!this.snap), 'on');
    const bSave = mk(IC.save, 'บันทึกผัง · Save layout', () => this.saveLayout());
    const bLoad = mk(IC.load, 'โหลดผัง · Load layout (replaces the stage — tap twice)', () => this.loadLayout());
    const bClose = mk(IC.close, 'ออกจากโหมดก่อสร้าง · Leave build mode (Esc)', () => this.toggle(false), 'close');
    const tag = document.createElement('span');
    tag.className = 'btag'; tag.innerHTML = '<i>ก่อสร้าง</i>';
    bar.append(tag, this.bGrid, this.bSnap, sep(), bSave, bLoad, sep(), bClose);
    // the selection tools
    const tools = document.createElement('div');
    tools.id = 'build-tools'; tools.className = 'bpanel hidden';
    const B = this.tb = {
      rotL: mk(IC.rotL, 'หมุนซ้าย 15° · Rotate −15° (Q) — Shift: 5°', (e) => this.rotateBy(-1, e.shiftKey || e.altKey)),
      rotR: mk(IC.rotR, 'หมุนขวา 15° · Rotate +15° (E) — Shift: 5°', (e) => this.rotateBy(1, e.shiftKey || e.altKey)),
      smaller: mk(IC.smaller, 'ย่อ · Smaller ([)', (e) => this.scaleStep(-1, e.shiftKey || e.altKey)),
      bigger: mk(IC.bigger, 'ขยาย · Bigger (])', (e) => this.scaleStep(1, e.shiftKey || e.altKey)),
      cloth: mk(IC.cloth, 'ชิดจอ · Toward the cloth: sharper shadow (PgDn)', () => this.depthBy(-1)),
      lamp: mk(IC.lamp, 'เข้าหาตะเกียง · Toward the lamp: bigger, softer shadow (PgUp)', () => this.depthBy(1)),
      back: mk(IC.back, 'ถอยไปข้างหลัง · Send backward within this depth (,)', () => this.layerBy(-1)),
      front: mk(IC.front, 'ยกมาข้างหน้า · Bring forward within this depth (.)', () => this.layerBy(1)),
      flip: mk(IC.flip, 'กลับด้าน · Flip (F)', () => this.flipSel()),
      dup: mk(IC.dup, 'ทำซ้ำ · Duplicate (D)', () => this.duplicate()),
      lock: mk(IC.lock, 'ล็อก · Lock in place (L) — locked scenery also ignores clicks while playing', () => this.toggleLock()),
      phys: mk(IC.phys, 'ฟิสิกส์ · Physics on: let it fall and tumble (P)', () => this.togglePhys()),
      del: mk(IC.del, 'ลบ · Delete (Del)', () => this.deleteSel(), 'warn'),
    };
    this.readout = document.createElement('div');
    this.readout.className = 'bread';
    const g1 = group(B.rotL, B.rotR, B.smaller, B.bigger);
    const g2 = group(B.cloth, B.lamp, B.back, B.front);
    const g3 = group(B.flip, B.dup, B.lock, B.phys, B.del);
    tools.append(this.readout, g1, g2, g3);
    this.toastEl = document.createElement('div');
    this.toastEl.id = 'build-toast';
    root.append(bar, tools, this.toastEl);
    this.bar = bar; this.tools = tools;
    for (const el of [bar, tools]) {
      // the panels are UI: keep their touches away from the stage
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('wheel', (e) => e.stopPropagation());
    }
  }

  toast(text) {
    const el = this.toastEl;
    el.textContent = text;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  // ------------------------------------------------------------ on / off
  toggle(on) {
    on = on === undefined ? !this.on : !!on;
    if (on === this.on) return this.on;
    const g = this.game, fg = g.stage.fg;
    this.on = on;
    const H = this._h;
    if (on) {
      fg.addEventListener('pointerdown', H.down, { capture: true });
      addEventListener('pointermove', H.move, { capture: true });
      addEventListener('pointerup', H.up, { capture: true });
      addEventListener('pointercancel', H.up, { capture: true });
      fg.addEventListener('wheel', H.wheel, { capture: true, passive: false });
      addEventListener('keydown', H.key, { capture: true });
      addEventListener('keyup', H.keyup, { capture: true });
      fg.addEventListener('contextmenu', H.ctx, { capture: true });
      g._cancelDrag?.();
      document.body.classList.add('build-on');
      this.bar.classList.remove('hidden');
      const s = g.selected;
      this._select(s && !s.removed ? s : null);
      this.toast('โหมดก่อสร้าง · Build mode');
      g.audio?.sfx('ching', { vol: 0.4 });
    } else {
      this._endGesture();
      fg.removeEventListener('pointerdown', H.down, { capture: true });
      removeEventListener('pointermove', H.move, { capture: true });
      removeEventListener('pointerup', H.up, { capture: true });
      removeEventListener('pointercancel', H.up, { capture: true });
      fg.removeEventListener('wheel', H.wheel, { capture: true });
      removeEventListener('keydown', H.key, { capture: true });
      removeEventListener('keyup', H.keyup, { capture: true });
      fg.removeEventListener('contextmenu', H.ctx, { capture: true });
      for (const id of this.ptrs.keys()) g.touches?.delete(id);
      this.ptrs.clear();
      g.pinch = null;
      document.body.classList.remove('build-on');
      this.bar.classList.add('hidden');
      this.tools.classList.add('hidden');
      g.pointer.down = false;
      this.toast('เลิกก่อสร้าง · Build mode off');
    }
    g.ui?.setButton?.('b-build', on);
    this.btn?.classList.toggle('on', on);
    return on;
  }

  setSnap(on) {
    this.snap = on;
    this.bSnap.classList.toggle('on', on);
    this.toast(on ? 'ดูดติดตาราง · Snap on' : 'วางอิสระ · Free placement');
  }

  cycleGrid() {
    this.cell = CELLS[(CELLS.indexOf(this.cell) + 1) % CELLS.length];
    this.bGrid.querySelector('.num').textContent = this.cell;
    this.toast(`ตาราง ${this.cell} · Grid ${this.cell}`);
  }

  // ------------------------------------------------------------ geometry
  _proj(x, y, z) { return this.game.scene.project(x, y, z); }

  snapX(cx) { const c = this.cell, sx = this.game.scene.lamp.sx || 0; return Math.round((cx + sx) / c) * c - sx; }
  snapY(cy) { const c = this.cell; return FLOOR + Math.round((cy - FLOOR) / c) * c; }

  // alpha-tight box of a sprite, sprite-local units [x0, y0, x1, y1]
  tight(sp) {
    if (sp._bBase) { const t = this.tight(sp._bBase), k = sp._bS; return [t[0] * k, t[1] * k, t[2] * k, t[3] * k]; }
    let t = tightCache.get(sp);
    if (t) return t;
    const g = sp.alphaGrid(4);
    let i0 = g.cw, j0 = g.ch, i1 = -1, j1 = -1;
    for (let j = 0; j < g.ch; j++) for (let i = 0; i < g.cw; i++) {
      if (g.a[j * g.cw + i] > 0.3) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
    }
    t = i1 < 0 ? [0, 0, sp.w, sp.h] : [i0 * g.cell, j0 * g.cellY, (i1 + 1) * g.cell, (j1 + 1) * g.cellY];
    tightCache.set(sp, t);
    return t;
  }

  // world point of a sprite-local point on a prop body
  _lw(b, px, py) { return b.toWorld(px - b.com[0], py - b.com[1]); }

  // cloth-space corners of the selection [tl, tr, br, bl] (oriented for props)
  corners(a) {
    if (isProp(a)) {
      const b = a.body, t = this.tight(b.sprite);
      return [[t[0], t[1]], [t[2], t[1]], [t[2], t[3]], [t[0], t[3]]].map(([x, y]) => {
        const [wx, wy] = this._lw(b, x, y);
        const [cx, cy] = this._proj(wx, wy, b.z);
        return [cx, cy];
      });
    }
    const bb = a.screenBounds ? a.screenBounds((x, y, z) => this._proj(x, y, z)) : null;
    if (bb && isFinite(bb.x0 + bb.x1 + bb.y0 + bb.y1)) return [[bb.x0, bb.y0], [bb.x1, bb.y0], [bb.x1, bb.y1], [bb.x0, bb.y1]];
    const r = a.root, [cx, cy] = this._proj(r.x, r.y, a.z);
    return [[cx - 20, cy - 20], [cx + 20, cy - 20], [cx + 20, cy + 20], [cx - 20, cy + 20]];
  }

  aabb(a) {
    const c = this.corners(a);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of c) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1 };
  }

  // the point that snaps: bottom-centre of the (axis-aligned) silhouette;
  // a puppet's torso x and its feet
  anchor(a) {
    const bb = this.aabb(a);
    if (a instanceof Puppet) { const r = a.root; return [this._proj(r.x, r.y, a.z)[0], bb.y1]; }
    return [(bb.x0 + bb.x1) / 2, bb.y1];
  }

  // move an actor rigidly by a cloth-space offset
  translate(a, dcx, dcy) {
    const k = 1 - a.z;
    const dx = dcx * k, dy = dcy * k;
    if (!isFinite(dx) || !isFinite(dy)) return;
    if (a instanceof Puppet) {
      const r = a.root;
      const planted = a.mode === 'planted';
      a.teleport(r.x + dx, r.y + (planted ? 0 : dy));
      if (planted) a.plantAt(a.root.x);
      else { a.setMode('hung'); a.holdAt(a.root.x, a.root.y); }
      return;
    }
    const b = a.body || a.root;
    if (!b) return;
    b.x += dx; b.y += dy; b.px = b.x; b.py = b.y; b.vx = b.vy = b.va = 0; b.pa = b.a;
    if (a.float) { a.float.y += dy; if (a.floatPin) { a.floatPin.tx = b.x; a.floatPin.ty = a.float.y; } }
  }

  // rotate a prop about the centre of its silhouette
  setAngle(a, ang) {
    if (!isProp(a) || !isFinite(ang)) return;
    const b = a.body, t = this.tight(b.sprite);
    const pc = [(t[0] + t[2]) / 2, (t[1] + t[3]) / 2];
    const W = this._lw(b, pc[0], pc[1]);
    b.a = b.pa = ang; b.va = 0;
    const o = b.offset(pc[0] - b.com[0], pc[1] - b.com[1]);
    b.x = b.px = W[0] - o[0]; b.y = b.py = W[1] - o[1];
    b.vx = b.vy = 0;
  }

  // resize a prop (keeps its base where it is)
  setScale(a, s) {
    if (!isProp(a) || !isFinite(s)) return;
    s = clamp(s, S_MIN, S_MAX);
    this._settleMagic(a);
    if (a.heldBy) a.heldBy.puppet.release(a.heldBy.hand);
    const b = a.body;
    if (!a._bOrig) a._bOrig = { def: a.def, shape: a.shape, sprite: a.def.sprite };
    const O = a._bOrig;
    const cur = a._bS || 1;
    if (Math.abs(s - cur) < 1e-4) return;
    // the fixed point: bottom-centre of the silhouette
    const t = this.tight(b.sprite);
    const pb = [(t[0] + t[2]) / 2, t[3]];
    const W = this._lw(b, pb[0], pb[1]);
    const sp = scaledSprite(O.sprite, s);
    const k = s;
    const sh0 = O.shape;
    const sh = {
      area: sh0.area * k * k, mass: sh0.mass * k * k, inertia: sh0.inertia * k ** 4,
      com: [sh0.com[0] * k, sh0.com[1] * k],
      circles: sh0.circles.map((c) => ({ x: c.x * k, y: c.y * k, r: c.r * k })),
    };
    const d0 = O.def;
    const def = Object.assign({}, d0, { sprite: sp, _bBase: d0, _bS: s });
    const sc = (p) => (p ? [p[0] * k, p[1] * k] : p);
    if (d0.grip) def.grip = sc(d0.grip);
    if (d0.weapon) def.weapon = Object.assign({}, d0.weapon, { a: sc(d0.weapon.a), b: sc(d0.weapon.b) });
    if (d0.glow) def.glow = [d0.glow[0] * k, d0.glow[1] * k, d0.glow[2] * k];
    a.def = def;
    a.shape = sh;
    a._bS = s;
    b.sprite = sp;
    b.circles = sh.circles;
    b.com = sh.com;
    b.updateRadius();
    if (!a.isStatic) b.setMass(sh.mass, sh.inertia);
    const pbn = [pb[0] / cur * s, pb[1] / cur * s];
    const o = b.offset(pbn[0] - b.com[0], pbn[1] - b.com[1]);
    b.x = b.px = W[0] - o[0]; b.y = b.py = W[1] - o[1];
    b.vx = b.vy = b.va = 0;
  }

  // finish any arrival magic on this actor (its scaffold sprite / depth glide)
  _settleMagic(a) {
    const M = this.game.magic;
    if (!M || !M.jobs) return;
    for (const j of M.jobs) {
      if (j.a !== a || j.done) continue;
      if (j.type === 'build' && j.orig) { a.body.sprite = j.orig; this.game.stage.screen?.dropTexture?.(j.sp); }
      if (j.type === 'summon' && a.setDepth) a.setDepth(j.z1);
      j.done = true;
    }
  }

  // depth: z for setDepth, keeping every layer offset
  setZ(a, z) {
    if (!a.setDepth || !isFinite(z)) return;
    a.setDepth(clamp(z, 0.005, 0.55));
  }

  // actors sharing this depth, back to front
  band(a) {
    const S = this.game.scene;
    const list = S.actors.filter((o) => !o.removed && !o.heldBy && Math.abs(o.z - a.z) < BAND);
    const idx = new Map(S.actors.map((o, i) => [o, i]));
    list.sort((p, q) => (Math.abs(p.z - q.z) > 1e-4 ? p.z - q.z : idx.get(p) - idx.get(q)));
    return list;
  }

  layerInfo(a) {
    const b = this.band(a);
    return { n: b.indexOf(a) + 1, of: b.length };
  }

  // ------------------------------------------------------------ actions
  _need(cap) {
    const a = this.sel;
    if (!a || a.removed) return null;
    if (!caps(a)[cap]) { this.toast('ใช้กับสิ่งนี้ไม่ได้ · not for this one'); return null; }
    return a;
  }

  rotateBy(dir, free = false) {
    const a = this._need('rotate');
    if (!a || a._bLocked) return;
    const b = a.body;
    const na = free ? b.a + dir * 5 * DEG : Math.round((b.a + dir * STEP_A) / STEP_A) * STEP_A;
    this._freeze(a);
    this.setAngle(a, wrapA(na));
    this._release(a);
  }

  scaleStep(dir, free = false) {
    const a = this._need('scale');
    if (!a || a._bLocked) return;
    const s = a._bS || 1;
    let ns;
    if (free) ns = s * (dir > 0 ? 1.05 : 1 / 1.05);
    else if (dir > 0) ns = NICE.find((v) => v > s + 1e-3) ?? S_MAX;
    else ns = [...NICE].reverse().find((v) => v < s - 1e-3) ?? S_MIN;
    this._freeze(a);
    this.setScale(a, ns);
    this._release(a);
    this.toast(`×${fmtS(a._bS || 1)}`);
  }

  depthBy(dir) {
    const a = this._need('layer');
    if (!a) return;
    this._settleMagic(a);
    this.setZ(a, a.z + dir * DEPTH_STEP);
    this.game.audio?.sfx('whoosh', { vol: 0.15 });
  }

  // one step forward / back among the things at the same depth
  layerBy(dir) {
    const a = this._need('layer');
    if (!a) return;
    this._settleMagic(a);
    const list = this.band(a);
    const i = list.indexOf(a), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) { this.toast(dir > 0 ? 'อยู่หน้าสุดแล้ว · already in front' : 'อยู่หลังสุดแล้ว · already at the back'); return; }
    const n = list[j];
    const S = this.game.scene;
    if (Math.abs(n.z - a.z) < LSTEP * 0.8) {
      this.setZ(a, n.z + dir * LSTEP);
    } else {
      const za = a.z, zn = n.z;
      this.setZ(a, zn);
      if (n.setDepth && !n._bLocked) this.setZ(n, za);
      else this.setZ(a, zn + dir * LSTEP);
    }
    // keep array order in step too (ties are won by the later actor)
    const arr = S.actors;
    const ia = arr.indexOf(a), inn = arr.indexOf(n);
    if (ia >= 0 && inn >= 0 && (dir > 0) === (ia < inn)) { arr[ia] = n; arr[inn] = a; }
    const L = this.layerInfo(a);
    this.toast(`ชั้น ${L.n}/${L.of} · layer ${L.n} of ${L.of}`);
  }

  flipSel() {
    const a = this._need('flip');
    if (!a) return;
    if (isProp(a)) {
      // flip about the silhouette's centre (not the COM) so it stays put
      const [cx0] = this.anchor(a);
      a.flip();
      a.flipAnim = 0;
      const [cx1] = this.anchor(a);
      this.translate(a, cx0 - cx1, 0);
    } else a.flip();
    this.game.audio?.sfx('flip', { vol: 0.5 });
  }

  toggleLock() {
    const a = this._need('lock');
    if (!a) return;
    this.setLock(a, !a._bLocked);
    this.toast(a._bLocked ? 'ล็อกแล้ว · locked' : 'ปลดล็อก · unlocked');
  }

  setLock(a, on) {
    a._bLocked = !!on;
    if (on && !a._bHitWrapped) {
      // locked scenery is transparent to clicks while playing, so puppets
      // in front of a backdrop are easy to grab
      const orig = a.hitTest;
      const build = this;
      a.hitTest = function (wx, wy, pad) { return (build.on || !this._bLocked) ? orig.call(this, wx, wy, pad) : null; };
      a._bHitWrapped = true;
    }
    if (on && isProp(a) && !a.isStatic) { a.setStatic(true); a.frozen = true; a._bPhys = false; }
  }

  togglePhys() {
    const a = this._need('phys');
    if (!a) return;
    if (a.heldBy) a.heldBy.puppet.release(a.heldBy.hand);
    a._bPhys = !a._bPhys;
    if (a._bPhys && a._bLocked) a._bLocked = false;
    a.setStatic(!a._bPhys);
    a.frozen = a.isStatic;
    if (a._bPhys) { a.body.vy = 1; a.body.sleep = 0; }
    this.toast(a._bPhys ? 'ฟิสิกส์ · physics on' : 'ตรึงไว้ · held in place');
  }

  deleteSel() {
    const a = this.sel;
    if (!a) return;
    this._select(null);
    this.game.removeActor(a);
  }

  duplicate() {
    const a = this._need('dup');
    if (!a) return null;
    const st = this.state(a);
    if (!st) return null;
    const c = this.cell;
    st.x += c * (1 - st.z) * (a.facing < 0 ? -1 : 1);
    if (!(a instanceof Puppet) || a.mode !== 'planted') st.y -= 0;
    st.lock = false;
    const n = this.restore(st);
    if (n) {
      if (this.snap) this.snapActor(n);
      this._select(n);
      this.game.audio?.sfx('pop', { vol: 0.4 });
    }
    return n;
  }

  snapActor(a) {
    const [ax, ay] = this.anchor(a);
    const tx = this.snapX(ax), ty = a instanceof Puppet && a.mode === 'planted' ? ay : this.snapY(ay);
    this.translate(a, tx - ax, ty - ay);
  }

  // ------------------------------------------------------------ selection
  _select(a) {
    const prev = this.sel;
    if (prev && prev !== a && !prev.removed) this._release(prev);
    this.sel = a;
    if (a && isProp(a) && !a._bPhys && !a.heldBy) { this._settleMagic(a); if (!a.isStatic) a.setStatic(true); a.frozen = true; }
    if (this.game.selected !== a) this.game.select(a);
    this._sig = '';
    this._refresh();
  }

  _freeze(a) {
    if (isProp(a) && !a.heldBy && !a.isStatic) { a.setStatic(true); a._bTmp = true; }
  }

  _release(a) {
    if (isProp(a) && a._bPhys && a.isStatic) { a.setStatic(false); a.frozen = false; }
    a._bTmp = false;
  }

  _refresh() {
    const a = this.sel;
    if (!this.on || !a) { this.tools.classList.add('hidden'); return; }
    this.tools.classList.remove('hidden');
    const c = caps(a);
    const B = this.tb;
    for (const [k, b] of Object.entries(B)) {
      const cap = { rotL: 'rotate', rotR: 'rotate', smaller: 'scale', bigger: 'scale', cloth: 'layer', lamp: 'layer', back: 'layer', front: 'layer', flip: 'flip', dup: 'dup', lock: 'lock', phys: 'phys', del: 'del' }[k];
      const locked = a._bLocked && ['rotate', 'scale', 'phys'].includes(cap);
      b.disabled = !c[cap] || locked;
    }
    B.lock.classList.toggle('on', !!a._bLocked);
    B.lock.innerHTML = svg(a._bLocked ? IC.lock : IC.unlock);
    B.phys.classList.toggle('on', !!a._bPhys);
  }

  // ------------------------------------------------------------ input
  _pt(e) { return this.game.cam.toScene(e.clientX, e.clientY); }
  _free(e) { return !!(e && (e.altKey || e.shiftKey)) || this.shift || !this.snap; }

  _down(e) {
    const g = this.game;
    if (!this.on || g.menu || g.intro) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { g.stage.fg.setPointerCapture(e.pointerId); } catch (_) { /* */ }
    g.pointer.x = e.clientX; g.pointer.y = e.clientY; g.pointer.inside = true;
    if (this.ptrs.size === 2) { this._startTwo(); return; }
    if (this.ptrs.size > 2) return;
    g.pointer.down = true; g.pointer.moved = 0;
    const [x, y] = this._pt(e);
    const S = g.scene;
    if (e.button === 2) {
      const hit = S.pick(x, y, 8);
      if (hit) { this._select(hit.actor); this.flipSel(); }
      return;
    }
    // handles of the current selection first
    const a0 = this.sel;
    if (a0 && !a0.removed && !a0._bLocked) {
      const h = this._handleAt(e.clientX, e.clientY, touch ? 26 : 14);
      if (h === 'rotate') {
        const b = a0.body;
        const [cx, cy] = this._pivotC(a0);
        this._freeze(a0);
        this.g = { type: 'rotate', a: a0, id: e.pointerId, ang0: Math.atan2(y - cy, x - cx), a0: b.a };
        g.audio?.sfx('pick', { vol: 0.4 });
        return;
      }
      if (h === 'scale') {
        const [px, py] = this._scalePivotC(a0);
        this._freeze(a0);
        this.g = { type: 'scale', a: a0, id: e.pointerId, d0: Math.max(4, Math.hypot(x - px, y - py)), s0: a0._bS || 1, piv: [px, py] };
        g.audio?.sfx('pick', { vol: 0.4 });
        return;
      }
    }
    // the current selection wins over whatever lies in front of it
    const pad = touch ? 20 : 8;
    const sh = a0 && !a0.removed && a0.hitTest && a0.hitTest(...S.unproject(x, y, a0.z), pad);
    const hit = sh ? { actor: a0, body: sh } : S.pick(x, y, pad);
    if (!hit) {
      // deselect on release, so a second finger can still pinch the selection
      this.g = { type: 'none', id: e.pointerId, deselect: true };
      return;
    }
    const a = hit.actor;
    const wasSel = this.sel === a;
    this._select(a);
    if (a._bLocked) { this.g = { type: 'none', id: e.pointerId }; this.toast('ล็อกอยู่ · locked'); return; }
    if (a.heldBy) a.heldBy.puppet.release(a.heldBy.hand);
    this._settleMagic(a);
    this._freeze(a);
    if (a instanceof Puppet && a.mode === 'ragdoll') a.plantAt(a.root.x);
    this.g = { type: 'move', a, id: e.pointerId, p0: [x, y], anc0: this.anchor(a), moved: 0, wasSel, pad: touch ? 20 : 8 };
    g.audio?.sfx('pick', { vol: 0.5 });
  }

  _startTwo() {
    const g = this.game;
    const a = this.sel;
    const [p, q] = [...this.ptrs.values()];
    if (this.g && this.g.a && this.g.type !== 'pinch') this._release(this.g.a);
    if (a && !a.removed && !a._bLocked && caps(a).scale) {
      const P = g.cam.toScene(p.x, p.y), Q = g.cam.toScene(q.x, q.y);
      this._freeze(a);
      this.g = {
        type: 'pinch', a, d0: Math.max(8, Math.hypot(P[0] - Q[0], P[1] - Q[1])), ang0: Math.atan2(Q[1] - P[1], Q[0] - P[0]),
        s0: a._bS || 1, a0: a.body.a, mid0: [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2], anc0: this.anchor(a),
      };
    } else {
      // nothing to size: two fingers move the camera as usual
      g.touches = new Map(this.ptrs);
      g._startPinch?.();
      this.g = { type: 'campinch' };
    }
  }

  _move(e) {
    if (!this.ptrs.has(e.pointerId)) return; // not ours: let the game see it
    e.stopImmediatePropagation();
    const g = this.game;
    const prev = this.ptrs.get(e.pointerId);
    g.pointer.moved += Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y);
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    g.pointer.x = e.clientX; g.pointer.y = e.clientY;
    const G = this.g;
    if (!G) return;
    if (G.type === 'campinch') {
      g.touches?.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (g.pinch) g._updatePinch?.();
      return;
    }
    if (G.a && G.a.removed) { this.g = null; return; }
    if (G.type === 'pinch') {
      if (this.ptrs.size < 2) return;
      const [p, q] = [...this.ptrs.values()];
      const P = g.cam.toScene(p.x, p.y), Q = g.cam.toScene(q.x, q.y);
      const d = Math.hypot(P[0] - Q[0], P[1] - Q[1]);
      const ang = Math.atan2(Q[1] - P[1], Q[0] - P[0]);
      let s = clamp(G.s0 * d / G.d0, S_MIN, S_MAX);
      if (!this._free(e)) s = Math.round(s * 20) / 20;
      let na = G.a0 + wrapA(ang - G.ang0);
      if (!this._free(e)) na = Math.round(na / STEP_A) * STEP_A;
      this.setAngle(G.a, wrapA(na));
      this.setScale(G.a, s);
      G.live = true;
      return;
    }
    if (e.pointerId !== G.id) return;
    const [x, y] = this._pt(e);
    const free = this._free(e);
    if (G.type === 'move') {
      const a = G.a;
      let tx = clamp(G.anc0[0] + x - G.p0[0], -120, CLOTH_W + 120);
      let ty = clamp(G.anc0[1] + y - G.p0[1], -200, CLOTH_H + 200);
      if (!free) { tx = this.snapX(tx); ty = this.snapY(ty); }
      const [ax, ay] = this.anchor(a);
      if (a instanceof Puppet && a.mode === 'planted') ty = ay;
      this.translate(a, tx - ax, ty - ay);
      G.snapped = free ? null : [tx, ty];
      if (Math.abs(x - G.p0[0]) + Math.abs(y - G.p0[1]) > 0.5) G.moved += 1;
    } else if (G.type === 'rotate') {
      const [cx, cy] = this._pivotC(G.a);
      let na = G.a0 + wrapA(Math.atan2(y - cy, x - cx) - G.ang0);
      if (!free) na = Math.round(na / STEP_A) * STEP_A;
      this.setAngle(G.a, wrapA(na));
    } else if (G.type === 'scale') {
      const [px, py] = G.piv;
      let s = clamp(G.s0 * Math.hypot(x - px, y - py) / G.d0, S_MIN, S_MAX);
      if (!free) s = Math.round(s * 20) / 20;
      this.setScale(G.a, s);
    }
  }

  _up(e) {
    const g = this.game;
    if (!this.ptrs.has(e.pointerId)) {
      // a drop from the chest while building: place it on the grid
      if (this.on && g.drag && g.drag.type === 'spawn') {
        e.stopImmediatePropagation();
        this._drop(e);
      }
      return;
    }
    e.stopImmediatePropagation();
    this.ptrs.delete(e.pointerId);
    g.touches?.delete(e.pointerId);
    try { g.stage.fg.releasePointerCapture(e.pointerId); } catch (_) { /* */ }
    const G = this.g;
    if (!G) { if (!this.ptrs.size) g.pointer.down = false; return; }
    if (G.type === 'campinch') {
      g.touches?.delete(e.pointerId);
      if (this.ptrs.size < 2) { g.pinch = null; this.g = null; }
      if (!this.ptrs.size) g.pointer.down = false;
      return;
    }
    if (G.type === 'pinch') {
      if (this.ptrs.size < 2) {
        this._release(G.a);
        this.g = this.ptrs.size ? { type: 'none', id: [...this.ptrs.keys()][0] } : null;
        this.toast(`×${fmtS(G.a._bS || 1)} · ${fmtA(G.a.body.a)}`);
      }
      if (!this.ptrs.size) g.pointer.down = false;
      return;
    }
    if (e.pointerId !== G.id) return;
    this.g = null;
    g.pointer.down = false;
    if (G.deselect && g.pointer.moved < 8) this._select(null);
    if (G.a) {
      this._release(G.a);
      if (G.type === 'move' && G.moved && g.pointer.moved >= 4) g.audio?.sfx('drop', { vol: 0.35 });
      // a tap on what is already selected picks the next thing behind it
      else if (G.type === 'move' && G.wasSel && g.pointer.moved < 6) this._cycle(G.p0, G.a, G.pad);
    }
    this._refresh();
  }

  _cycle([x, y], cur, pad) {
    const S = this.game.scene;
    const under = S.actors.filter((o) => !o.removed && !o.heldBy && o.hitTest && o.hitTest(...S.unproject(x, y, o.z), pad));
    if (under.length < 2) return;
    under.sort((p, q) => q.z - p.z);
    const n = under[(under.indexOf(cur) + 1) % under.length];
    if (n && n !== cur) { this._select(n); this.toast(`${n.def?.name || ''} · ชิ้นข้างหลัง · picked the one behind`); }
  }

  _drop(e) {
    const g = this.game;
    const d = g.drag;
    g.drag = null;
    g.pointer.down = false;
    g.touches?.delete(e.pointerId);
    const [x, y] = this._pt(e);
    if (!(x > -10 && x < CLOTH_W + 10 && y > -10 && y < CLOTH_H + 10)) return;
    const a = g.spawn(d.def, clamp(x, 60, CLOTH_W - 60), clamp(y, 60, FLOOR), 0.02, { quiet: true });
    if (!a || !a.root) return;
    if (isProp(a)) {
      // sit it on the floor when dropped low; otherwise on the nearest line
      const [ax, ay] = this.anchor(a);
      let ty = ay > FLOOR - 70 ? FLOOR : ay;
      let tx = ax;
      if (this.snap) { tx = this.snapX(ax); ty = this.snapY(ty); }
      this.translate(a, tx - ax, ty - ay);
    } else if (this.snap) this.snapActor(a);
    this._select(a);
    g.audio?.sfx('pop', { vol: 0.5 });
  }

  _endGesture() {
    const G = this.g;
    if (G && G.a && !G.a.removed) this._release(G.a);
    if (G && G.type === 'campinch') this.game.pinch = null;
    this.g = null;
  }

  _wheel(e) {
    if (!this.on) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const [x, y] = this._pt(e);
    const a = this.sel || this.game.scene.pick(x, y)?.actor;
    if (!a) return;
    if (a !== this.sel) this._select(a);
    const dy = e.deltaY || e.deltaX;
    if ((e.ctrlKey || e.metaKey) && caps(a).scale && !a._bLocked) {
      this._freeze(a);
      this.setScale(a, clamp((a._bS || 1) * Math.exp(-dy * 0.004), S_MIN, S_MAX));
      this._release(a);
      return;
    }
    this._wacc += dy;
    if (Math.abs(this._wacc) < 40) return;
    const dir = Math.sign(this._wacc);
    this._wacc = 0;
    if (e.shiftKey || e.altKey) this.rotateBy(dir, e.altKey);
    else this.depthBy(dir);
  }

  _key(e) {
    if (!this.on || isTyping(e)) return;
    if (e.key === 'Shift') this.shift = true;
    const a = this.sel;
    const c = e.code, mod = e.ctrlKey || e.metaKey;
    let done = true;
    if (c === 'Escape') { if (a) this._select(null); else this.toggle(false); }
    else if (mod && c === 'KeyS') this.saveLayout();
    else if (mod && c === 'KeyO') this.loadLayout();
    else if (c === 'KeyG' && !mod) this.cycleGrid();
    else if (c === 'KeyN' && !mod) this.setSnap(!this.snap);
    else if (!a) done = false;
    else if (c.startsWith('Arrow') && !mod) {
      if (!a._bLocked) {
        const st = e.shiftKey || e.altKey || !this.snap ? 2 : this.cell;
        const dx = c === 'ArrowLeft' ? -st : c === 'ArrowRight' ? st : 0;
        const dy = c === 'ArrowUp' ? -st : c === 'ArrowDown' ? st : 0;
        this._freeze(a);
        if (st === this.cell) {
          const [ax, ay] = this.anchor(a);
          const tx = dx ? this.snapX(ax + dx) : ax;
          const ty = dy && !(a instanceof Puppet && a.mode === 'planted') ? this.snapY(ay + dy) : ay;
          this.translate(a, tx - ax, ty - ay);
        } else this.translate(a, dx, a instanceof Puppet && a.mode === 'planted' ? 0 : dy);
        this._release(a);
      }
    }
    else if (c === 'KeyQ') this.rotateBy(-1, e.shiftKey || e.altKey);
    else if (c === 'KeyE') this.rotateBy(1, e.shiftKey || e.altKey);
    else if (c === 'KeyR') this.rotateBy(e.shiftKey ? -1 : 1);
    else if (c === 'BracketLeft' || c === 'Minus') this.scaleStep(-1, e.altKey);
    else if (c === 'BracketRight' || c === 'Equal') this.scaleStep(1, e.altKey);
    else if (c === 'PageUp') this.depthBy(1);
    else if (c === 'PageDown') this.depthBy(-1);
    else if (c === 'Period') this.layerBy(1);
    else if (c === 'Comma') this.layerBy(-1);
    else if (c === 'KeyF') this.flipSel();
    else if (c === 'KeyD') this.duplicate();
    else if (c === 'KeyL') this.toggleLock();
    else if (c === 'KeyP') this.togglePhys();
    else if (c === 'Delete' || c === 'Backspace') this.deleteSel();
    else done = false;
    if (done) { e.preventDefault(); e.stopImmediatePropagation(); this._refresh(); }
  }

  // ------------------------------------------------------------ handles
  _screenCorners(a) { const cam = this.game.cam; return this.corners(a).map(([x, y]) => cam.toScreen(x, y)); }

  _handles(a) {
    if (!caps(a).rotate) return {};
    const C = this._screenCorners(a);
    const tm = mid(C[0], C[1]), bm = mid(C[3], C[2]);
    let ux = tm[0] - bm[0], uy = tm[1] - bm[1];
    const ul = Math.hypot(ux, uy) || 1;
    ux /= ul; uy /= ul;
    const rot = [tm[0] + ux * 30, tm[1] + uy * 30];
    // the outer bottom corner (bottom-right on screen)
    const br = C[2][0] + C[2][1] * 0.001 > C[3][0] + C[3][1] * 0.001 ? C[2] : C[3];
    const cx = (C[0][0] + C[2][0]) / 2, cy = (C[0][1] + C[2][1]) / 2;
    let dx = br[0] - cx, dy = br[1] - cy;
    const dl = Math.hypot(dx, dy) || 1;
    const sc = [br[0] + (dx / dl) * 10, br[1] + (dy / dl) * 10];
    return { rot, sc, tm };
  }

  _handleAt(sx, sy, r) {
    const a = this.sel;
    if (!a) return null;
    const H = this._handles(a);
    if (H.rot && Math.hypot(sx - H.rot[0], sy - H.rot[1]) < r) return 'rotate';
    if (H.sc && Math.hypot(sx - H.sc[0], sy - H.sc[1]) < r) return 'scale';
    return null;
  }

  _pivotC(a) {
    const C = this.corners(a);
    return [(C[0][0] + C[2][0]) / 2, (C[0][1] + C[2][1]) / 2];
  }

  _scalePivotC(a) {
    const C = this.corners(a);
    return mid(C[3], C[2]);
  }

  // ------------------------------------------------------------ frame
  update(dt) {
    const g = this.game;
    this.fade = clamp(this.fade + (this.on ? dt * 5 : -dt * 5), 0, 1);
    if (!this.on) return;
    if (this.sel && this.sel.removed) this._select(null);
    if (g.selected !== this.sel && !this.g) this._select(g.selected && !g.selected.removed ? g.selected : null);
    const hide = !!(g.menu || g.intro);
    this.bar.classList.toggle('hidden', hide);
    const a = this.sel;
    if (!a || hide) { this.tools.classList.add('hidden'); return; }
    this.tools.classList.remove('hidden');
    // readout
    const L = this.layerInfo(a);
    const p = isProp(a);
    const sig = `${p ? fmtS(a._bS || 1) : ''}|${p ? fmtA(a.body.a) : ''}|${a.z.toFixed(3)}|${L.n}/${L.of}|${!!a._bLocked}|${!!a._bPhys}`;
    if (sig !== this._sig) {
      this._sig = sig;
      const nm = a.def ? (a.def.name || a.def.id || '') : '';
      this.readout.innerHTML =
        `<span class="nm">${esc(nm)}</span>` +
        (p ? `<span title="ขนาด · size">×${fmtS(a._bS || 1)}</span><span title="มุม · angle">${fmtA(a.body.a)}</span>` : '') +
        `<span title="ระยะจากจอ · depth (0 = on the cloth)">z ${a.z.toFixed(2)}</span>` +
        `<span class="ly" title="ชั้นที่ระยะนี้ · layer at this depth (1 = back)">ชั้น ${L.n}<small>/${L.of}</small></span>`;
      this._refresh();
    }
    this._place(a);
  }

  // float the tools near the selection (desktop) or dock them (phones)
  _place(a) {
    const vw = innerWidth, vh = innerHeight;
    const dock = vw <= 640;
    const T = this.tools;
    T.classList.toggle('docked', dock);
    this.bar.classList.toggle('docked', dock);
    if (dock) { if (T.style.left) { T.style.left = ''; T.style.top = ''; } return; }
    const C = this._screenCorners(a);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of C) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const w = T.offsetWidth || 300, h = T.offsetHeight || 90;
    let left = (x0 + x1) / 2 - w / 2;
    let top = y1 + 22;
    if (top + h > vh - 12) top = y0 - h - 48;
    if (top < 64) top = Math.min(vh - h - 12, Math.max(64, y1 + 22));
    if (y1 - y0 > vh * 0.75) top = vh - h - 16;
    left = clamp(left, 8, vw - w - 72);
    top = clamp(top, 60, vh - h - 8);
    const L = Math.round(left) + 'px', Tp = Math.round(top) + 'px';
    if (T.style.left !== L) T.style.left = L;
    if (T.style.top !== Tp) T.style.top = Tp;
  }

  draw(f, cam, dpr) {
    if (this.fade <= 0.001) return;
    const g = this.game, S = g.scene;
    if (g.menu || g.intro) return;
    const al = this.fade;
    f.save();
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    // ---- the grid over the cloth
    const [X0, Y0] = cam.toScreen(0, 0), [X1, Y1] = cam.toScreen(CLOTH_W, CLOTH_H);
    f.save();
    f.beginPath(); f.rect(X0, Y0, X1 - X0, Y1 - Y0); f.clip();
    const c = this.cell, sx = S.lamp.sx || 0;
    const px = c * cam.zoom;
    if (px >= 5) {
      const majorEvery = c >= 80 ? 2 : c >= 40 ? 4 : 5;
      const kx0 = Math.ceil(sx / c), kx1 = Math.floor((CLOTH_W + sx) / c);
      for (let k = kx0; k <= kx1; k++) {
        const x = cam.toScreen(k * c - sx, 0)[0];
        const major = k % majorEvery === 0;
        f.strokeStyle = `rgba(231,181,69,${(major ? 0.3 : 0.14) * al})`;
        f.lineWidth = major ? 1 : 0.75;
        f.beginPath(); f.moveTo(Math.round(x) + 0.5, Y0); f.lineTo(Math.round(x) + 0.5, Y1); f.stroke();
      }
      const ky0 = Math.ceil((0 - FLOOR) / c), ky1 = Math.floor((CLOTH_H - FLOOR) / c);
      for (let k = ky0; k <= ky1; k++) {
        if (k === 0) continue;
        const y = cam.toScreen(0, FLOOR + k * c)[1];
        const major = k % majorEvery === 0;
        f.strokeStyle = `rgba(231,181,69,${(major ? 0.3 : 0.14) * al})`;
        f.lineWidth = major ? 1 : 0.75;
        f.beginPath(); f.moveTo(X0, Math.round(y) + 0.5); f.lineTo(X1, Math.round(y) + 0.5); f.stroke();
      }
    }
    // the floor line
    const fy = cam.toScreen(0, FLOOR)[1];
    f.shadowColor = `rgba(255,200,90,${0.8 * al})`; f.shadowBlur = 8;
    f.strokeStyle = `rgba(255,214,120,${0.75 * al})`; f.lineWidth = 1.6;
    f.setLineDash([10, 5]);
    f.beginPath(); f.moveTo(X0, fy); f.lineTo(X1, fy); f.stroke();
    f.setLineDash([]);
    f.shadowBlur = 0;
    f.font = '600 11px Sarabun, sans-serif';
    f.fillStyle = `rgba(255,226,150,${0.8 * al})`;
    f.textBaseline = 'bottom';
    f.fillText('พื้น · floor', X0 + 8, fy - 3);
    f.restore();

    // ---- every placeable thing gets a base marker
    for (const a of S.actors) {
      if (a.removed || a.heldBy || a === this.sel || !a.root) continue;
      const [ax, ay] = this.anchor(a);
      if (!isFinite(ax + ay)) continue;
      const [qx, qy] = cam.toScreen(ax, ay);
      diamond(f, qx, qy, 4, `rgba(255,214,120,${0.55 * al})`, `rgba(60,24,8,${0.6 * al})`);
      if (a._bLocked) lockGlyph(f, qx + 8, qy - 9, al * 0.7);
    }

    // ---- the selection
    const a = this.sel;
    if (a && !a.removed && a.root) {
      const C = this._screenCorners(a);
      if (C.every((p) => isFinite(p[0] + p[1]))) {
        const G = this.g;
        // snap guides
        if (G && G.type === 'move' && G.snapped) {
          const [gx, gy] = cam.toScreen(G.snapped[0], G.snapped[1]);
          f.strokeStyle = `rgba(255,236,170,${0.45 * al})`; f.lineWidth = 1;
          f.setLineDash([3, 4]);
          f.beginPath(); f.moveTo(gx, Y0); f.lineTo(gx, Y1); f.moveTo(X0, gy); f.lineTo(X1, gy); f.stroke();
          f.setLineDash([]);
        }
        // the frame
        f.shadowColor = 'rgba(0,0,0,0.6)'; f.shadowBlur = 4;
        f.strokeStyle = `rgba(255,222,140,${0.95 * al})`; f.lineWidth = 1.5;
        f.setLineDash(a._bLocked ? [4, 4] : []);
        f.beginPath(); C.forEach((p, i) => (i ? f.lineTo(p[0], p[1]) : f.moveTo(p[0], p[1]))); f.closePath(); f.stroke();
        f.setLineDash([]);
        f.shadowBlur = 0;
        // corner ticks
        for (const p of C) diamond(f, p[0], p[1], 3, `rgba(255,236,170,${al})`, null);
        // anchor
        const [ax, ay] = this.anchor(a);
        const [qx, qy] = cam.toScreen(ax, ay);
        diamond(f, qx, qy, 6, `rgba(255,214,120,${al})`, `rgba(60,24,8,${al})`);
        if (a._bLocked) lockGlyph(f, (C[0][0] + C[1][0]) / 2, (C[0][1] + C[1][1]) / 2 - 12, al);
        else {
          const H = this._handles(a);
          if (H.rot) {
            f.strokeStyle = `rgba(255,222,140,${0.8 * al})`; f.lineWidth = 1.2;
            f.beginPath(); f.moveTo(H.tm[0], H.tm[1]); f.lineTo(H.rot[0], H.rot[1]); f.stroke();
            knob(f, H.rot[0], H.rot[1], 9, al, G && (G.type === 'rotate' || G.type === 'pinch'));
            // rotate glyph
            f.strokeStyle = `rgba(60,24,8,${al})`; f.lineWidth = 1.6;
            f.beginPath(); f.arc(H.rot[0], H.rot[1], 4.2, -2.6, 1.4); f.stroke();
          }
          if (H.sc) {
            knob(f, H.sc[0], H.sc[1], 7.5, al, G && (G.type === 'scale' || G.type === 'pinch'), true);
          }
        }
        // live readout during a gesture
        if (G && G.a === a && (G.type === 'rotate' || G.type === 'scale' || G.type === 'pinch')) {
          const txt = `${fmtA(a.body.a)}  ×${fmtS(a._bS || 1)}`;
          const [cx, cy] = cam.toScreen(...this._pivotC(a));
          pill(f, cx, cy, txt, al);
        }
      }
    }
    f.restore();
  }

  // ------------------------------------------------------------ layouts
  state(a) {
    if (!a || a.removed || a.heldBy || !a.root) return null;
    const def = a._bOrig?.def || a.def;
    const id = def?.id;
    if (!id || !this.game.content.byId.get(id)) return null;
    if (isProp(a)) {
      const b = a.body;
      return { k: 'prop', id, x: r3(b.x), y: r3(b.y), z: r5(a.z), a: r5(b.a), scale: r3(a._bS || 1), flip: b.flip, static: !!a.isStatic, phys: !!a._bPhys, lock: !!a._bLocked };
    }
    if (a instanceof Puppet) {
      const r = a.root;
      return { k: 'puppet', id, x: r3(r.x), y: r3(r.y), z: r5(a.z), facing: a.facing, mode: a.mode === 'planted' ? 'planted' : 'hung', lock: !!a._bLocked };
    }
    return null;
  }

  restore(st) {
    const g = this.game;
    const def = g.content.byId.get(st.id);
    if (!def) return null;
    const [cx, cy] = g.scene.project(st.x, st.y, st.z);
    let a = null;
    try { a = g.spawn(def, cx, cy, st.z, { quiet: true, facing: st.facing }); } catch (e) { console.warn('build: restore failed', st.id, e); return null; }
    if (!a || !a.root) return a;
    if (isProp(a) && st.k === 'prop') {
      const b = a.body;
      if ((st.scale || 1) !== 1) this.setScale(a, st.scale);
      if (b.flip !== (st.flip || 1)) { a.flip(); a.flipAnim = 0; }
      if (a.z !== st.z) a.setDepth(st.z);
      b.a = b.pa = st.a || 0;
      b.x = b.px = st.x; b.y = b.py = st.y; b.vx = b.vy = b.va = 0;
      if (a.float) { a.float.y = st.y; if (a.floatPin) { a.floatPin.tx = st.x; a.floatPin.ty = st.y; } }
      a._bPhys = !!st.phys;
      a.setStatic(!!st.static && !st.phys);
      a.frozen = a.isStatic;
    } else if (a instanceof Puppet) {
      if (a.z !== st.z) a.setDepth(st.z);
      if (st.facing && a.facing !== st.facing) a.flip(true);
      a.teleport(st.x, st.y);
      if (st.mode === 'planted') a.plantAt(st.x); else { a.setMode('hung'); a.holdAt(st.x, st.y); }
    }
    if (st.lock) this.setLock(a, true);
    return a;
  }

  layout() {
    const S = this.game.scene;
    return {
      v: 1, cell: this.cell, worldW: S.worldW, sx: S.lamp.sx || 0,
      items: S.actors.map((a) => this.state(a)).filter(Boolean),
    };
  }

  saveLayout() {
    const L = this.layout();
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(L));
      this.toast(`บันทึกผังแล้ว · Layout saved (${L.items.length})`);
      this.game.audio?.sfx('ching', { vol: 0.4 });
      return true;
    } catch (e) {
      this.toast('บันทึกไม่ได้ · could not save');
      return false;
    }
  }

  loadLayout(force = false) {
    let L = null;
    try { L = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { L = null; }
    if (!L || !Array.isArray(L.items)) { this.toast('ยังไม่มีผังที่บันทึก · no saved layout'); return false; }
    const now = performance.now();
    if (!force && this.game.scene.actors.length && !(this._loadArm && now - this._loadArm < 2500)) {
      this._loadArm = now;
      this.toast('แตะอีกครั้งเพื่อแทนที่เวที · tap again to replace the stage');
      return false;
    }
    this._loadArm = 0;
    this.applyLayout(L);
    this.toast(`โหลดผังแล้ว · Layout loaded (${L.items.length})`);
    return true;
  }

  applyLayout(L) {
    const g = this.game, S = g.scene;
    this._select(null);
    g.clearStage();
    g.scenes && (g.scenes.queue = []);
    if (L.worldW) S.worldW = L.worldW;
    S.lamp.sx = L.sx || 0;
    if (L.cell && CELLS.includes(L.cell)) { this.cell = L.cell; this.bGrid.querySelector('.num').textContent = this.cell; }
    const out = [];
    for (const st of L.items) { const a = this.restore(st); if (a) out.push(a); }
    return out;
  }
}

// ---------------------------------------------------------------- helpers
function isProp(a) { return a instanceof Prop && !!a.body && !!a.def && !!a.def.sprite; }
function isHumanoid(a) { return a instanceof Puppet && !a.isAnimal && !a.isPlant; }

function caps(a) {
  const p = isProp(a);
  return {
    move: true, rotate: p, scale: p, phys: p,
    layer: !!a.setDepth, flip: !!a.flip,
    lock: !isHumanoid(a), dup: p || (a instanceof Puppet && !!a.def), del: true,
  };
}

// a resized view of a sprite: same pixels (same GL texture), bigger texels
function scaledSprite(base, s) {
  const sp = Object.create(Object.getPrototypeOf(base));
  Object.assign(sp, base);
  sp.scale = base.scale * s;
  sp.w = base.w * s; sp.h = base.h * s;
  sp.ox = base.ox * s; sp.oy = base.oy * s;
  sp._alpha = null;
  sp._bBase = base; sp._bS = s;
  Object.defineProperty(sp, 'version', { get: () => base.version, set: () => {}, enumerable: true });
  const grids = new Map();
  sp.alphaGrid = (cell = 4) => {
    let g = grids.get(cell);
    if (!g) { const b = base.alphaGrid(cell); g = { ...b, cell: b.cell * s, cellY: b.cellY * s }; grids.set(cell, g); }
    return g;
  };
  return sp;
}

function wrapA(a) { return a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2)); }
function fmtA(a) { const d = Math.round(wrapA(a) / DEG); return `${d === -180 ? 180 : d}°`; }
function fmtS(s) { return (Math.round(s * 100) / 100).toString(); }
function r3(v) { return Math.round(v * 1000) / 1000; }
function r5(v) { return Math.round(v * 1e5) / 1e5; }
function mid(p, q) { return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function isTyping(e) { const t = e.target; return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)); }

function sep() { const s = document.createElement('i'); s.className = 'bsep'; return s; }
function group(...kids) { const d = document.createElement('div'); d.className = 'bgrp'; d.append(...kids); return d; }

function diamond(f, x, y, r, fill, stroke) {
  f.beginPath(); f.moveTo(x, y - r); f.lineTo(x + r, y); f.lineTo(x, y + r); f.lineTo(x - r, y); f.closePath();
  f.fillStyle = fill; f.fill();
  if (stroke) { f.strokeStyle = stroke; f.lineWidth = 1; f.stroke(); }
}

function knob(f, x, y, r, al, active, square = false) {
  const gr = f.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x, y, r);
  gr.addColorStop(0, `rgba(255,244,194,${al})`);
  gr.addColorStop(0.55, `rgba(231,181,69,${al})`);
  gr.addColorStop(1, `rgba(122,74,18,${al})`);
  f.fillStyle = gr;
  f.shadowColor = active ? `rgba(255,220,130,${al})` : 'rgba(0,0,0,0.6)';
  f.shadowBlur = active ? 12 : 4;
  f.beginPath();
  if (square) { f.moveTo(x, y - r * 1.2); f.lineTo(x + r * 1.2, y); f.lineTo(x, y + r * 1.2); f.lineTo(x - r * 1.2, y); f.closePath(); }
  else f.arc(x, y, r, 0, Math.PI * 2);
  f.fill();
  f.shadowBlur = 0;
  f.strokeStyle = `rgba(58,21,9,${al})`; f.lineWidth = 1.2; f.stroke();
}

function lockGlyph(f, x, y, al) {
  f.strokeStyle = `rgba(255,226,150,${al})`; f.fillStyle = `rgba(40,14,6,${0.8 * al})`; f.lineWidth = 1.3;
  f.beginPath(); f.rect(x - 4.5, y - 1, 9, 7); f.fill(); f.stroke();
  f.beginPath(); f.arc(x, y - 1, 3, Math.PI, 0); f.stroke();
}

function pill(f, x, y, txt, al) {
  f.font = '600 12px Sarabun, sans-serif';
  const w = f.measureText(txt).width + 16;
  f.fillStyle = `rgba(26,11,7,${0.85 * al})`;
  f.strokeStyle = `rgba(200,137,42,${al})`; f.lineWidth = 1;
  f.beginPath();
  if (f.roundRect) f.roundRect(x - w / 2, y - 11, w, 22, 11); else f.rect(x - w / 2, y - 11, w, 22);
  f.fill(); f.stroke();
  f.fillStyle = `rgba(255,236,190,${al})`; f.textAlign = 'center'; f.textBaseline = 'middle';
  f.fillText(txt, x, y + 0.5);
  f.textAlign = 'start';
}
