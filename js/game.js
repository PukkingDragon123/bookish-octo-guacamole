// The sandbox: ties the scene, stage renderer, UI, audio, hand tracking,
// the khon-hand cursor and the stagehand flies together, and runs the
// cinematic intro.

import { Scene, FLOOR } from './scene/scene.js';
import { Camera, easeInOut, easeInOutSine } from './scene/camera.js';
import { Stage } from './render/stage.js';
import { UI, thumbnail } from './ui.js';
import { KhonHand, drawString } from './render/cursor.js';
import { Fly } from './sandbox/flies.js';
import { Puppet } from './puppet/puppet.js';
import { Pin } from './physics/world.js';
import { GESTURE_MOVES, KEY_MOVES } from './puppet/animations.js';
import { CLOTH_W, CLOTH_H } from './render/screen.js';

let audio = null;
let HandTracker = null;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const onCloth = (x, y, m = 0) => x > -m && x < CLOTH_W + m && y > -m && y < CLOTH_H + m;

export class Game {
  constructor(root, content) {
    this.root = root;
    this.content = content;
    this.scene = new Scene();
    this.cam = new Camera();
    this.stage = new Stage(root, this.cam);
    this.hand = new KhonHand();
    this.pointer = { x: -100, y: -100, down: false, moved: 0, inside: false };
    this.drag = null;
    this.selected = null;
    this.flies = Array.from({ length: 6 }, () => new Fly(700 + Math.random() * 200, 300));
    this.view = 'stage';
    this.showMode = false;
    this.soundOn = true;
    this.tracker = null;
    this.trackPrev = [];
    this.intro = null;
    this.time = 0;
    this.moodT = 0;
    this.keys = new Set();
  }

  async init() {
    await this.stage.build({ title: 'Chonburi, Srisakdi, serif' });
    this.stage.resize();
    this.ui = new UI(this.root.querySelector('#ui'), this);
    this.cam.set(this.cam.framing('stage'));
    this._wire();
    import('./audio/audio.js').then((m) => { audio = m.audio; this.audio = audio; }).catch((e) => console.warn('audio unavailable', e));
    this._handsP = import('./tracking/hands.js').then((m) => { HandTracker = m.HandTracker; }).catch((e) => console.warn('tracking unavailable', e));
    this.scene.on('hit', (h) => this._onHit(h));
    this.scene.on('animEvent', (p, ev) => { if (ev.sfx) audio?.sfx(ev.sfx, { pan: this._pan(p), vol: 0.8 }); });
    this.scene.on('removed', (a) => { if (this.selected === a) this.select(null); });
  }

  // ------------------------------------------------------------ spawning
  spawn(def, cx, cy, z = 0.02, opts = {}) {
    let a;
    if (def.rig && !def.cat) {
      a = this.scene.addPuppet(def.rig, { x: cx, z, facing: opts.facing ?? (cx > 800 ? -1 : 1) });
      a.def = def;
      for (const [hand, pid] of Object.entries(def.rig.holds || {})) {
        const pd = this.content.byId.get(pid);
        if (!pd || pd.rig) continue;
        const [hx, hy] = a.bodies[hand] ? this.scene.project(a.bodies[hand].x, a.bodies[hand].y, z) : [cx, cy];
        const p = this.scene.addProp(pd, { x: hx, y: hy, z });
        a.grab(p, hand);
      }
      if (def.rig.idle) a.idle = def.rig.idle;
    } else {
      a = this.scene.addProp(def, { x: cx, y: cy, z });
      if (a instanceof Puppet) a.def = def;
    }
    audio?.sfx('pop', { pan: (cx - 800) / 800 });
    return a;
  }

  removeActor(a) {
    const fly = this.flies.find((f) => f.actor === a);
    fly?.release();
    this.scene.remove(a);
    audio?.sfx('drop');
    this.ui.renderSide();
  }

  clearStage() {
    for (const f of this.flies) f.release();
    this.scene.clear();
    this.select(null);
  }

  select(a) {
    if (this.selected && this.selected.selected) this.selected.selected = false;
    this.selected = a;
    if (a) a.selected = true;
    this.ui?.renderSide();
  }

  freeFlies() { return this.flies.filter((f) => !f.actor).length; }

  assignFly(a, role) {
    let fly = this.flies.find((f) => f.actor === a);
    if (!role) { fly?.release(); this.ui.renderSide(); return; }
    if (!fly) fly = this.flies.find((f) => !f.actor);
    if (!fly) { fly = new Fly(800, 300); this.flies.push(fly); }
    fly.assign(a, role);
    audio?.sfx('buzz', { pan: this._pan(a) });
    this.ui.toast(`แมลงหวี่รับบท · a fruit fly takes the strings`);
    this.ui.renderSide();
  }

  playMove(name) {
    const a = this.selected;
    if (!a || !a.play) return;
    const hold = name === 'block' || name === 'wong';
    if (a.play(name, { hold: false })) audio?.sfx('magic', { vol: 0.35, pan: this._pan(a) });
    if (hold && a.anim) a.anim.hold = false;
  }

  _pan(a) { return a && a.root ? clamp((this.scene.project(a.root.x, a.root.y, a.z)[0] - 800) / 800, -1, 1) : 0; }

  // ------------------------------------------------------------ toolbar
  toggleLamp() {
    const L = this.scene.lamp;
    if (L.kind === 'oil') { L.kind = 'electric'; L.color = [1, 0.93, 0.8]; this.ui.toast('ไฟฟ้า · electric bulb'); }
    else { L.kind = 'oil'; L.color = [1, 0.8, 0.52]; this.ui.toast('ตะเกียงน้ำมัน · oil lamp — Alt+drag the bright spot to move the light'); }
    audio?.sfx('click');
  }
  toggleView() {
    this.view = this.view === 'stage' ? 'heaven' : 'stage';
    this.cam.flyTo(this.cam.framing(this.view), 2.2, easeInOutSine);
    this.ui.setButton('b-view', this.view === 'heaven');
  }
  toggleShow() {
    this.showMode = !this.showMode;
    this.ui.reveal(!this.showMode);
    this.ui.top.classList.remove('hidden');
    this.ui.top.style.opacity = this.showMode ? '0.15' : '';
    this.ui.setButton('b-show', this.showMode);
  }
  toggleSound() {
    this.soundOn = !this.soundOn;
    audio?.setMuted(!this.soundOn);
    this.root.querySelector('#b-sound').firstChild.textContent = this.soundOn ? '🔊' : '🔇';
  }
  async toggleTracking() {
    if (this.tracker && this.tracker.running && this.tracker.mode !== 'synthetic') {
      this.tracker.stop();
      this.ui.setButton('b-hand', false);
      this.ui.cam.classList.add('hidden');
      return;
    }
    await this._handsP;
    if (!HandTracker) { this.ui.toast('ระบบติดตามมือยังไม่พร้อม · hand tracking unavailable'); return; }
    this.tracker?.stop();
    this.tracker = new HandTracker({ maxHands: 2 });
    this.ui.toast('กำลังเปิดกล้อง… · starting camera and hand model…', 6000);
    try {
      await this.tracker.start();
      this.ui.setButton('b-hand', true);
      this.ui.setButton('b-demo', false);
      this.ui.cam.classList.remove('hidden');
      this.ui.toast('ยกมือขึ้น! กำมือ = ฟันดาบ · ชี้ = แทง · จีบ = รำ · Raise your hand to take the strings', 5000);
      if (!this.selected) this.select(this.scene.puppets()[0] || null);
    } catch (e) {
      this.ui.toast(e.userMessage || e.message, 7000);
      this.ui.setButton('b-hand', false);
    }
  }
  async toggleDemo() {
    if (this.tracker && this.tracker.mode === 'synthetic') {
      this.tracker.stop();
      this.ui.setButton('b-demo', false);
      this.ui.cam.classList.add('hidden');
      return;
    }
    await this._handsP;
    if (!HandTracker) return;
    this.tracker?.stop();
    this.tracker = new HandTracker({ maxHands: 2 });
    this.tracker.startSynthetic();
    this.ui.setButton('b-demo', true);
    this.ui.setButton('b-hand', false);
    this.ui.cam.classList.remove('hidden');
    if (!this.selected) this.select(this.scene.puppets()[0] || null);
    this.ui.toast('สาธิต: มือจำลองเชิดหนัง · demo: a simulated hand shows each pose');
  }

  // ------------------------------------------------------------ input
  _wire() {
    const fg = this.stage.fg;
    const wake = () => {
      if (!this._audioStarted && audio) {
        this._audioStarted = true;
        audio.init().then(() => {
          audio.ambience.start();
          audio.music.play(this.intro ? 'heaven' : 'calm');
          audio.lampHum(0.4);
        }).catch(() => {});
      }
    };
    addEventListener('pointerdown', wake, { capture: true });
    addEventListener('keydown', wake, { capture: true });
    addEventListener('resize', () => { this.stage.resize(); if (!this.intro) this.cam.set(this.cam.framing(this.view)); });
    fg.addEventListener('contextmenu', (e) => e.preventDefault());
    fg.addEventListener('pointerdown', (e) => this._down(e));
    addEventListener('pointermove', (e) => this._move(e));
    addEventListener('pointerup', (e) => this._up(e));
    fg.addEventListener('wheel', (e) => this._wheel(e), { passive: false });
    addEventListener('keydown', (e) => this._key(e, true));
    addEventListener('keyup', (e) => this._key(e, false));
  }

  _scenePt(e) { return this.cam.toScene(e.clientX, e.clientY); }

  _down(e) {
    if (this.intro) { if (this.intro.t > 1.5) this.skipIntro(); return; }
    const [x, y] = this._scenePt(e);
    this.pointer.down = true;
    this.pointer.moved = 0;
    this.pointer.sx = e.clientX; this.pointer.sy = e.clientY;
    fgCapture(this.stage.fg, e);
    const L = this.scene.lamp;
    if (e.altKey || (Math.hypot(x - L.x, y - L.y) < 24 && !this.scene.pick(x, y))) {
      this.drag = { type: 'lamp' };
      return;
    }
    if (!onCloth(x, y, 20)) return;
    if (e.button === 2) {
      const hit = this.scene.pick(x, y);
      if (hit) { hit.actor.flip(); audio?.sfx('flip', { pan: this._pan(hit.actor) }); }
      return;
    }
    // limb strings on the selected / hovered puppet first
    const cands = [this.selected, ...this.scene.actors].filter((a) => a && a.pins);
    for (const a of cands) {
      for (const key of Object.keys(a.pins)) {
        const w = a.limbWorld(key);
        if (!w) continue;
        const [cx, cy] = this.scene.project(w[0], w[1], a.z);
        if (Math.hypot(cx - x, cy - y) < 26) {
          this.drag = { type: 'limb', actor: a, key };
          this.select(a);
          audio?.sfx('pick', { vol: 0.5, pan: this._pan(a) });
          return;
        }
      }
    }
    const hit = this.scene.pick(x, y);
    if (!hit) { this.select(null); return; }
    let a = hit.actor;
    if (a.heldBy) { a.heldBy.puppet.release(a.heldBy.hand); }
    this.select(a);
    const [wx, wy] = this.scene.unproject(x, y, a.z);
    audio?.sfx('pick', { vol: 0.6, pan: this._pan(a) });
    if (a instanceof Puppet) {
      a.setMode('held');
      a.controller = a.controller && a.controller !== 'player' ? a.controller : 'player';
      this.drag = { type: 'puppet', actor: a, ox: a.target.x - wx, oy: a.target.y - wy };
      this.flies.find((f) => f.actor === a)?.release();
    } else if (a.isStatic) {
      this.drag = { type: 'static', actor: a, ox: a.body.x - wx, oy: a.body.y - wy };
    } else {
      const b = a.body;
      const lp = b.toLocal(wx, wy);
      const pin = new Pin(b, lp, wx, wy, { compliance: 1 / (b.mass * 900), angle: null, maxCorr: 40 });
      this.scene.world.addC(pin);
      this.drag = { type: 'prop', actor: a, pin };
      if (a.def.sound) audio?.instrument(a.def.sound, { pan: this._pan(a) });
    }
  }

  _move(e) {
    this.pointer.x = e.clientX; this.pointer.y = e.clientY;
    if (this.pointer.down) this.pointer.moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0);
    const d = this.drag;
    if (!d) return;
    const [x, y] = this._scenePt(e);
    if (d.type === 'lamp') { this.scene.moveLamp(x, y); return; }
    if (d.type === 'spawn') return;
    const a = d.actor;
    const [wx, wy] = this.scene.unproject(clamp(x, -80, CLOTH_W + 80), clamp(y, -60, CLOTH_H + 40), a.z);
    if (d.type === 'puppet') a.holdAt(wx + d.ox, Math.min(wy + d.oy, a.standY() + 30));
    else if (d.type === 'limb') a.pullLimb(d.key, wx, wy);
    else if (d.type === 'static') a.placeAt(wx + d.ox, wy + d.oy);
    else if (d.type === 'prop') { d.pin.tx = wx; d.pin.ty = wy; }
  }

  _up(e) {
    this.pointer.down = false;
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const [x, y] = this._scenePt(e);
    if (d.type === 'spawn') {
      if (onCloth(x, y, 10)) {
        const a = this.spawn(d.def, clamp(x, 60, CLOTH_W - 60), clamp(y, 60, FLOOR), 0.02);
        this.select(a);
      }
      return;
    }
    const a = d.actor;
    if (d.type === 'puppet') {
      a.controller = a.controller === 'player' ? null : a.controller;
      if (a.target.y > a.standY() - 140) a.plantAt(a.target.x);
      else a.setMode('hung');
      audio?.sfx('step', { vol: 0.4 });
    } else if (d.type === 'limb') a.releaseLimb(d.key);
    else if (d.type === 'prop') {
      this.scene.world.removeC(d.pin);
      // dropped onto a hand?
      const b = a.body;
      for (const p of this.scene.puppets()) {
        for (const hand of ['handF', 'handB']) {
          const hb = p.bodies[hand];
          if (!hb || p.held[hand]) continue;
          if (Math.abs(hb.z - b.z) > 0.1) continue;
          const [hx, hy] = this.scene.project(hb.x, hb.y, hb.z);
          const [px, py] = this.scene.project(b.x, b.y, b.z);
          if (Math.hypot(hx - px, hy - py) < 70) { p.grab(a, hand); audio?.sfx('pick'); return; }
        }
      }
      if (this.pointer.moved < 4 && a.def.sound) return;
      audio?.sfx('drop', { vol: 0.5 });
    }
  }

  beginSpawnDrag(def, e) {
    this.drag = { type: 'spawn', def, thumb: thumbnail(def, 140) };
    this.pointer.down = true;
    this.pointer.x = e.clientX; this.pointer.y = e.clientY;
    audio?.sfx('pick', { vol: 0.5 });
  }

  _wheel(e) {
    e.preventDefault();
    const [x, y] = this._scenePt(e);
    const hit = this.drag?.actor || this.scene.pick(x, y)?.actor || this.selected;
    if (!hit || !hit.setDepth) return;
    hit.setDepth(hit.z + Math.sign(e.deltaY) * 0.02);
    this.ui.renderSide();
  }

  _key(e, down) {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (down) this.keys.add(e.code); else this.keys.delete(e.code);
    if (!down) {
      if (this.selected?.anim?.hold) this.selected.anim.hold = false;
      return;
    }
    if (this.intro) { if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') this.skipIntro(); return; }
    const a = this.selected;
    const mv = KEY_MOVES[e.code];
    if (mv && a) { this.playMove(mv); e.preventDefault(); }
    if (e.code === 'KeyF' && a) { a.flip(); audio?.sfx('flip'); }
    if ((e.code === 'Delete' || e.code === 'Backspace') && a) this.removeActor(a);
    if (e.code === 'KeyH') this.ui.toggleHelp();
    if (e.code === 'Tab') {
      e.preventDefault();
      const list = this.scene.actors.filter((x) => x instanceof Puppet);
      if (list.length) this.select(list[(list.indexOf(a) + 1) % list.length]);
    }
  }

  // ------------------------------------------------------------ events
  _onHit(h) {
    const [cx, cy] = this.scene.project(h.x, h.y, h.z);
    this.stage.sparks(cx, cy, h.blocked ? 26 : 12, h.blocked ? '255,230,150' : '255,140,80');
    this.scene.membrane.poke(cx, cy, 60, h.blocked ? 40 : 90);
    this.cam.shake = Math.max(this.cam.shake, h.result === 'fall' ? 14 : 6);
    const pan = (cx - 800) / 800;
    audio?.sfx(h.blocked ? 'clang' : h.weapon ? 'clang' : 'hit', { pan, vol: 0.9 });
    if (h.result === 'fall') audio?.sfx(Math.random() < 0.5 ? 'gasp' : 'cheer', { vol: 0.5 });
    else if (Math.random() < 0.15) audio?.sfx('laugh', { vol: 0.35 });
  }

  onSpeech(p, s) {
    if (!s || !audio) return;
    audio.voice(s.th, { voice: p.rig?.voice || 'male', pan: this._pan(p) });
  }

  // ------------------------------------------------------------ tracking
  _track(dt) {
    const T = this.tracker;
    if (!T || !T.running) return false;
    T.update(performance.now());
    const hands = T.hands || [];
    const puppets = this.scene.puppets();
    if (!this.selected && puppets.length) this.select(puppets[0]);
    const targets = [this.selected, puppets.find((p) => p !== this.selected)];
    let any = false;
    hands.forEach((h, i) => {
      const p = targets[i];
      if (!p || h.lost) return;
      any = any || i === 0;
      const cx = 120 + h.palm.x * (CLOTH_W - 240), cy = 60 + h.palm.y * (CLOTH_H - 80);
      const zWant = clamp(0.02 + (1 - h.depth) * 0.32, 0.01, 0.4);
      p.setDepth(p.z + (zWant - p.z) * Math.min(1, dt * 4));
      const [wx, wy] = this.scene.unproject(cx, cy, p.z);
      if (p.mode !== 'held') p.setMode('held');
      p.holdAt(wx, Math.min(wy + 120, p.standY() + 20));
      p.target.lean = clamp(h.roll * 0.7, -0.6, 0.6) * p.facing;
      const c = h.curl;
      p.ctrl = {
        shoulderB: -c[0] * 2.4, elbowB: -c[0] * 0.8,
        shoulderF: -c[1] * 2.7, elbowF: -c[1] * 0.7,
        neck: c[2] * 0.5,
        hipB: -c[3] * 1.2, kneeB: c[3] * 1.4,
        hipF: -c[4] * 1.2, kneeF: c[4] * 1.4,
      };
      p.ctrlW = 0.85;
      const prev = this.trackPrev[i] || {};
      if (prev.facing && prev.facing !== h.facing) { p.flip(); audio?.sfx('flip', { vol: 0.6 }); }
      prev.facing = h.facing;
      this.trackPrev[i] = prev;
      const g = h.gesture;
      if (g && g.fresh && GESTURE_MOVES[g.name]) {
        const hold = ['block', 'wong', 'dance'].includes(GESTURE_MOVES[g.name]);
        p.play(GESTURE_MOVES[g.name], { hold });
        audio?.sfx('magic', { vol: 0.3 });
      }
      if (p.anim && p.anim.hold && (!g || !GESTURE_MOVES[g.name] || GESTURE_MOVES[g.name] !== p.anim.name)) p.anim.hold = false;
      if (i === 0) {
        this.hand.setPose(null, c.map((v) => v * 1.1 - 0.15));
        this.handScreen = this.cam.toScreen(cx, cy - 140);
      }
    });
    if (T.twoHands && T.twoHands.waiFresh) for (const p of targets) p?.play('wai');
    for (let i = hands.length; i < 2; i++) {
      const p = targets[i];
      if (p && p.ctrlW > 0) { p.ctrlW = 0; if (p.mode === 'held') p.plantAt(p.root.x); }
    }
    // camera preview
    const ctx = this.ui.camCanvas.getContext('2d');
    T.drawPreview(ctx, 0, 0, 440, 330);
    const h0 = hands[0];
    this.ui.gest.textContent = h0 ? `${h0.gesture?.name || '—'}  ${GESTURE_MOVES[h0.gesture?.name] || ''}` : 'ยกมือขึ้น · raise your hand';
    return any;
  }

  // ------------------------------------------------------------ intro
  startIntro() {
    const hermit = this.content.byId.get('reusi');
    this.intro = { t: 0, hermit, spawned: null, stage: 0 };
    this.scene.lamp.intensity = 0;
    this.scene.lamp.target = 0;
    for (const c of this.stage.curtains) { c.target = 0; c.open = 0; }
    this.cam.set({ x: 800, y: -2150, zoom: this.cam.framing('heaven').zoom * 0.9 });
    this.ui.title.classList.remove('hidden');
    this.ui.skip.classList.remove('hidden');
  }

  skipIntro() {
    if (!this.intro) return;
    const I = this.intro;
    for (const c of this.stage.curtains) { c.target = 1; }
    this.scene.lamp.target = 1;
    if (!I.spawned) I.spawned = this._introHermit(0.02);
    else { I.spawned.setDepth(0.02); I.spawned.plantAt(this.scene.unproject(560, 0, 0.02)[0]); }
    this._endIntro();
  }

  _introHermit(z) {
    const p = this.spawn(this.content.byId.get('reusi'), 560, 600, z, { facing: 1 });
    return p;
  }

  _endIntro() {
    this.intro = null;
    for (const c of this.stage.curtains) c.target = 1;
    this.scene.lamp.target = 1;
    if (this.scene.lamp.intensity < 0.3) this.scene.lamp.intensity = 0.3;
    this.ui.title.classList.add('hidden');
    this.ui.skip.classList.add('hidden');
    this.cam.flyTo(this.cam.framing('stage'), 1.2);
    this.ui.reveal(true);
    this.ui.toggleHouse(true);
    audio?.music.play('calm');
    this.ui.toast('ลากตัวหนังจากหีบมาวางบนจอ · Drag puppets from the chest onto the screen. Press H for help.', 6000);
    if (!this.scene.puppets().length) this._introHermit(0.02);
    const princess = this.content.byId.get('nang');
    if (princess && this.scene.puppets().length < 2) {
      const n = this.spawn(princess, 1060, 600, 0.02, { facing: -1 });
      n.play('wai');
    }
  }

  _updateIntro(dt) {
    const I = this.intro;
    I.t += dt;
    const t = I.t;
    const final = this.cam.framing('stage');
    // 0-3.5: heaven, title. 3.5-12: descend. 12-14 curtains. 14.5-16.5 lamp. 16.5-21 hermit appears.
    if (t > 3.2 && I.stage === 0) {
      I.stage = 1;
      this.ui.title.classList.add('hidden');
      this.cam.flyTo(final, 9, easeInOut);
      audio?.sfx('chime');
    }
    if (t > 11.5 && I.stage === 1) { I.stage = 2; audio?.music.play('overture'); }
    if (t > 12.5 && I.stage === 2) { I.stage = 3; for (const c of this.stage.curtains) c.target = 1; audio?.sfx('curtain'); }
    if (t > 15 && I.stage === 3) { I.stage = 4; audio?.sfx('lamp-ignite'); this.scene.lamp.target = 1; this.scene.lamp.intensity = 0.25; }
    if (t > 16.8 && I.stage === 4) {
      I.stage = 5;
      I.spawned = this._introHermit(0.42);
      I.spawned.setMode('held');
      I.z0 = 0.42;
    }
    if (I.stage === 5 && I.spawned) {
      const u = Math.min(1, (t - 16.8) / 4.2);
      const e = easeInOutSine(u);
      const p = I.spawned;
      p.setDepth(0.42 + (0.02 - 0.42) * e);
      const [wx] = this.scene.unproject(700 - 140 * e, 0, p.z);
      p.holdAt(wx, p.standY() - 30 * (1 - e));
      if (u >= 1) { I.stage = 6; p.plantAt(p.root.x); p.play('wai'); audio?.sfx('gong'); }
    }
    if (I.stage === 6 && t > 23) this._endIntro();
  }

  // ------------------------------------------------------------ frame
  update(dt) {
    this.time += dt;
    if (this.intro) this._updateIntro(this.wallDt || dt);
    // keyboard walking
    const a = this.selected;
    if (a && a instanceof Puppet && !this.drag) {
      const dir = (this.keys.has('ArrowRight') || this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('ArrowLeft') || this.keys.has('KeyA') ? 1 : 0);
      if (dir) {
        a.target.x = clamp(a.target.x + dir * 190 * dt, 60, CLOTH_W - 60);
        if (dir !== a.facing && a.flipAnim <= 0 && !a.isBusy()) a.flip();
      }
      if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) { a.setMode('hung'); a.target.y -= 220 * dt; }
      if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) { a.target.y = Math.min(a.standY(), a.target.y + 220 * dt); if (a.target.y >= a.standY() - 2) a.plantAt(a.target.x); }
      if (this.keys.has('KeyQ')) a.setDepth(a.z - 0.25 * dt);
      if (this.keys.has('KeyE')) a.setDepth(a.z + 0.25 * dt);
    }
    // idle signature poses (comic puppets) when nothing else drives them
    for (const p of this.scene.actors) {
      if (p.idle && !p.anim && p.ctrlW < 0.05 && p.mode === 'planted' && p.walkAmt < 0.1) {
        p.ctrl = Object.fromEntries(Object.entries(p.idle).map(([k, v]) => [k === 'head' ? 'neck' : k, v * Math.PI / 180]));
        p._idleW = Math.min(0.6, (p._idleW || 0) + dt * 0.5);
        p.ctrlW = p._idleW;
        p._idling = true;
      } else if (p._idling && (p.anim || p.walkAmt >= 0.1 || p.mode !== 'planted')) {
        p._idling = false; p._idleW = 0; p.ctrlW = 0;
      }
    }
    const tracking = this._track(dt);
    this.trackingActive = tracking;
    for (const f of this.flies) f.update(dt, this);
    this.scene.update(dt);
    for (const c of this.stage.curtains) c.step(dt, this.time);
    this.cam.update(this.intro ? this.wallDt || dt : dt);
    // hand cursor pose
    if (!tracking) {
      const d = this.drag;
      this.hand.setPose(d ? 'grab' : this.pointer.down ? 'press' : this._hovering() ? 'hover' : 'idle');
    }
    this.hand.update(dt);
    // music mood
    this.moodT -= dt;
    if (audio && !this.intro && this.moodT <= 0) {
      this.moodT = 3;
      const roles = this.scene.actors.map((x) => x.flyRole);
      const fighting = roles.includes('fighter') || roles.includes('monster') || this.scene.actors.some((x) => x.attacking > 0);
      const mood = fighting ? 'battle' : roles.includes('dancer') ? 'dance' : roles.includes('comedian') ? 'comic' : 'calm';
      if (audio.music.mood !== mood) audio.music.play(mood);
      audio.music.setIntensity(clamp(this.scene.actors.filter((x) => x.attacking > 0).length * 0.5, 0, 1));
      audio.lampHum(this.scene.lamp.intensity * 0.5);
    }
  }

  _hovering() {
    const [x, y] = this.cam.toScene(this.pointer.x, this.pointer.y);
    return onCloth(x, y) && !!this.scene.pick(x, y);
  }

  render(dt) {
    this.stage.render(this.scene, dt, (f) => this._overlay(f));
  }

  _overlay(f) {
    const cam = this.cam, dpr = this.stage.dpr, S = this.scene;
    const toScreen = (x, y) => cam.toScreen(x, y);
    const proj = (w, z) => { const [cx, cy] = S.project(w[0], w[1], z); return cam.toScreen(cx, cy); };
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    // intro veil of clouds
    if (this.intro) {
      const t = this.intro.t;
      const k = t < 3.2 ? 0.9 : t < 12 ? Math.max(0, 1 - (t - 3.2) / 8.8) : 0;
      f.save(); this.stage.drawCloudVeil(f, k, -t * 400); f.restore();
      f.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (t < 1.6) { f.fillStyle = `rgba(0,0,0,${1 - t / 1.6})`; f.fillRect(0, 0, cam.vw, cam.vh); }
    } else if (this.view === 'heaven') {
      f.save(); this.stage.drawCloudVeil(f, 0.5); f.restore();
      f.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // top-of-view heavenly glow where strings descend from
    const glow = f.createLinearGradient(0, 0, 0, cam.vh * 0.25);
    glow.addColorStop(0, 'rgba(255,215,140,0.22)');
    glow.addColorStop(1, 'rgba(255,215,140,0)');
    f.fillStyle = glow;
    f.fillRect(0, 0, cam.vw, cam.vh * 0.25);

    const t = this.time;
    const hs = this.handScreen && this.trackingActive ? this.handScreen : [this.pointer.x, this.pointer.y];
    const controlled = this.trackingActive ? [this.selected] : this.drag && this.drag.actor instanceof Puppet ? [this.drag.actor] : [];
    // strings: puppets not held by the player hang from heaven or a fly
    for (const a of S.actors) {
      if (!(a instanceof Puppet)) continue;
      const hw = proj(a.handleWorld(), a.z);
      const fly = this.flies.find((fl) => fl.actor === a);
      if (controlled.includes(a)) continue;
      if (fly) {
        const [fx, fy] = toScreen(fly.x, fly.y);
        drawString(f, fx, fy, hw[0], hw[1], { alpha: 0.7, t, width: 1 });
        for (const k of ['handF', 'handB']) { const w = a.limbWorld(k); if (w) { const s2 = proj(w, a.z); drawString(f, fx, fy, s2[0], s2[1], { alpha: 0.35, t, width: 0.7 }); } }
      } else {
        drawString(f, hw[0] + Math.sin(t * 0.5 + hw[0]) * 3, -10, hw[0], hw[1], { alpha: a.selected ? 0.55 : 0.18, t, width: a.selected ? 1.2 : 0.8 });
      }
    }
    // player's strings from the khon hand's fingertips
    if (controlled[0]) {
      const a = controlled[0];
      const tips = this.hand.tips;
      const tgt = [a.handleWorld(), a.limbWorld('handB'), a.limbWorld('handF'), a.limbWorld('head'), a.limbWorld('footB'), a.limbWorld('footF')];
      const map = [[2, 0], [0, 1], [1, 2], [2, 3], [3, 4], [4, 5]];
      for (const [fi, ti] of map) {
        if (!tgt[ti] || !tips[fi]) continue;
        const s2 = proj(tgt[ti], a.z);
        drawString(f, tips[fi][0], tips[fi][1], s2[0], s2[1], { alpha: ti === 0 ? 1 : 0.7, t, width: ti === 0 ? 1.6 : 1 });
      }
    }
    // selection marker + limb beads
    const sel = this.selected;
    if (sel && sel.root && !this.intro && !this.showMode) {
      if (sel.pins) {
        for (const key of Object.keys(sel.pins)) {
          const w = sel.limbWorld(key);
          if (!w) continue;
          const [sx, sy] = proj(w, sel.z);
          f.fillStyle = 'rgba(255,220,130,0.55)';
          f.beginPath(); f.arc(sx, sy, 4, 0, 7); f.fill();
        }
      }
      const [bx, by] = proj(sel.handleWorld ? sel.handleWorld() : [sel.root.x, sel.root.y], sel.z);
      f.strokeStyle = 'rgba(255,220,130,0.8)'; f.lineWidth = 1.5;
      f.beginPath(); f.arc(bx, by, 7 + Math.sin(t * 4) * 1.5, 0, 7); f.stroke();
    }
    // flies
    for (const fl of this.flies) fl.draw(f, toScreen, dpr, cam.zoom);
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    // speech bubbles
    for (const a of S.actors) {
      if (!a.speech) continue;
      const [hx, hy] = proj(a.handleWorld(), a.z);
      bubble(f, hx, hy - a.headOffset * cam.zoom * 1.1 / (1 - a.z) - 20, a.speech);
    }
    // spawn ghost
    if (this.drag && this.drag.type === 'spawn') {
      f.globalAlpha = 0.8;
      f.drawImage(this.drag.thumb, this.pointer.x - 70, this.pointer.y - 77);
      f.globalAlpha = 1;
    }
    // lamp handle hint when alt held
    if (this.drag?.type === 'lamp' || this.keys.has('AltLeft')) {
      const [lx, ly] = toScreen(S.lamp.x, S.lamp.y);
      f.strokeStyle = 'rgba(255,230,160,0.9)'; f.lineWidth = 2;
      f.beginPath(); f.arc(lx, ly, 18, 0, 7); f.stroke();
    }
    // the khon hand cursor
    if (!this.intro || this.intro.t > 20) {
      const s = clamp(cam.zoom * 1.25, 0.6, 1.3);
      this.hand.draw(f, hs[0], hs[1], s, dpr);
    }
  }
}

function fgCapture(el, e) { try { el.setPointerCapture(e.pointerId); } catch (_) { /* */ } }

function bubble(f, x, y, s) {
  const a = Math.min(1, s.t * 4, (s.dur - s.t) * 3);
  if (a <= 0) return;
  f.save();
  f.globalAlpha = a;
  f.font = '600 17px Sarabun, sans-serif';
  const w1 = f.measureText(s.th).width;
  f.font = '12px Sarabun, sans-serif';
  const w2 = s.en ? f.measureText(s.en).width : 0;
  const w = Math.max(w1, w2) + 24, h = s.en ? 50 : 32;
  const bx = x - w / 2, by = y - h;
  f.fillStyle = 'rgba(22,10,6,0.88)';
  f.strokeStyle = 'rgba(232,196,106,0.8)';
  f.lineWidth = 1.5;
  f.beginPath();
  f.roundRect ? f.roundRect(bx, by, w, h, 10) : f.rect(bx, by, w, h);
  f.moveTo(x - 8, by + h); f.lineTo(x, by + h + 10); f.lineTo(x + 8, by + h);
  f.fill(); f.stroke();
  f.fillStyle = '#f7e6bd';
  f.textAlign = 'center';
  f.font = '600 17px Sarabun, sans-serif';
  f.fillText(s.th, x, by + 22);
  if (s.en) { f.font = '12px Sarabun, sans-serif'; f.fillStyle = 'rgba(247,230,189,0.65)'; f.fillText(s.en, x, by + 40); }
  f.restore();
}
