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
import { ANIMS, GESTURE_MOVES, KEY_MOVES } from './puppet/animations.js';
import { CLOTH_W, CLOTH_H } from './render/screen.js';
import { FX } from './render/fx.js';
import { Editor } from './editor.js';
import { Controls } from './controls.js';
import { Souls } from './sandbox/soul.js';
import { Magic } from './sandbox/magic.js';
import { AnimalAI } from './sandbox/animalAI.js';
import { Scenes } from './sandbox/scenes.js';
import { Games } from './sandbox/games.js';
import { Director } from './scene/director.js';
import { Tutorial } from './tutorial.js';
import { SpeechLayer } from './render/speech.js';
import { Social } from './sandbox/social.js';
import { Build } from './sandbox/build.js';
import { swayFoliage } from './props/foliage.js';

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
    this.fx = new FX(this.scene);
    this.stage.fxLayer = this.fx;
    this.animalAI = new AnimalAI(this);
    this.walkTo = null;
    this.hand = new KhonHand();
    this.pointer = { x: -100, y: -100, down: false, moved: 0, inside: false };
    this.drag = null;
    this.selected = null;
    this.flies = Array.from({ length: 6 }, (_, i) => new Fly(800 + Math.sin(i * 1.7) * 900, -330));
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
    this.editor = new Editor(this);
    this.controls = new Controls(this);
    this.souls = new Souls(this);
    this.magic = new Magic(this);
    this.scenes = new Scenes(this);
    this.games = new Games(this);
    this.director = new Director(this);
    this.social = new Social(this);
    {
      // camera-mode medallion next to the others
      const top = this.root.querySelector('#topbar');
      if (top) {
        const b = document.createElement('button');
        b.className = 'medal'; b.id = 'b-cam'; b.title = 'กล้อง (C) · Camera: free → follow → cinematic';
        b.innerHTML = '<i class="gem"></i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h3l2-3h8l2 3h3v11H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>';
        b.onclick = () => this.director.cycle();
        top.insertBefore(b, top.querySelector('#b-help'));
      }
    }
    this.scene.extraDrawables = () => this.games.drawables();
    this.fx.onThunder = () => audio?.sfx('thud', { vol: 1, pitch: 0.35 });
    this._wire();
    import('./audio/audio.js').then((m) => { audio = m.audio; this.audio = audio; }).catch((e) => console.warn('audio unavailable', e));
    this._handsP = import('./tracking/hands.js').then((m) => { HandTracker = m.HandTracker; }).catch((e) => console.warn('tracking unavailable', e));
    this.scene.on('hit', (h) => this._onHit(h));
    this.scene.on('speech', (p, s) => this.onSpeech(p, s));
    this.speechLayer = new SpeechLayer(this);
    this.scene.on('animEvent', (p, ev) => { if (ev.sfx) audio?.sfx(ev.sfx, { pan: this._pan(p), vol: 0.8 }); });
    this.scene.on('removed', (a) => { if (this.selected === a) this.select(null); });
    this.stage.heavenCrowd.usePuppets(this.content.puppets.map((p) => p.rig));
    this.stage.usePuppetAudience(this.content.puppets.filter((p) => ['comic', 'villager', 'child'].includes(p.kind) || /chaoban|dek|teng|nunui|yodthong|samor|srikaew|phuyai|aitho|khwan/.test(p.id)).map((p) => p.rig));
    this.tutorial = new Tutorial(this);
    this.build = new Build(this);
  }

  // ------------------------------------------------------------ spawning
  spawn(def, cx, cy, z = 0.02, opts = {}) {
    if (def.weather) {
      const on = this.fx.toggle(def.weather);
      audio?.sfx(on ? 'magic' : 'click', { vol: 0.6 });
      return null;
    }
    if (def.spell) return this.magic.cast(def, cx, cy);
    if (def.scene) { this.scenes.load(def.scene); return null; }
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
    (def.onSpawn || def.rig?.onSpawn)?.(a, this.scene);
    if (!opts.quiet && !this.intro && !this.menu) this.magic.arrive(a, def);
    else if (!opts.quiet) audio?.sfx('pop', { pan: (cx - 800) / 800 });
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
    if (a.play(name, { hold: !!ANIMS[name]?.hold })) audio?.sfx('magic', { vol: 0.35, pan: this._pan(a) });
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
  toggleEditor() {
    this.editor.toggle();
    this.ui.setButton('b-edit', this.editor.open);
  }
  togglePad() {
    this.padOn = !this.padOn;
    this.controls.show(this.padOn);
    this.ui.setButton('b-pad', this.padOn);
  }

  // side-scroller pad actions
  padAction(a) {
    const p = this.selected instanceof Puppet ? this.selected : this.scene.puppets()[0];
    if (!p) return;
    if (!this.selected) this.select(p);
    if (a === 'jump') this.playMove('leap');
    else if (a === 'strike') this.playMove(p.held.handF || p.held.handB ? (Math.random() < 0.7 ? 'strike' : 'lunge') : 'strike');
    else if (a === 'next') {
      const list = this.scene.actors.filter((x) => x instanceof Puppet);
      if (list.length) this.select(list[(list.indexOf(p) + 1) % list.length]);
    }
  }

  equip(id) {
    const p = this.selected instanceof Puppet ? this.selected : null;
    if (!p || !p.bodies.handF) return;
    const old = p.release('handF');
    if (old) this.scene.remove(old);
    if (id) {
      const def = this.content.byId.get(id);
      const hb = p.bodies.handF;
      const [hx, hy] = this.scene.project(hb.x, hb.y, p.z);
      const w = this.scene.addProp(def, { x: hx, y: hy, z: p.z });
      p.grab(w, 'handF');
      audio?.sfx('pick', { pan: this._pan(p) });
    }
  }

  expandStage() {
    const S = this.scene;
    S.worldW = S.worldW >= 6400 ? 1600 : S.worldW + 1600;
    S.lamp.sx = Math.min(S.lamp.sx, S.worldW - CLOTH_W);
    audio?.sfx('curtain', { vol: 0.4 });
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
    this.ui.setButton('b-sound', !this.soundOn);
  }
  async toggleTracking() {
    if (this.tracker && this.tracker.running && this.tracker.mode !== 'synthetic') {
      this.tracker.stop();
      this.ui.setButton('b-hand', false);
      this.ui.cam.classList.add('hidden');
      return;
    }
    await this._handsP;
    if (!HandTracker) { this.ui.toast('ระบบติดตามมือยังไม่พร้อม · hand tracking unavailable', 5000, { error: true }); return; }
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
      this.ui.toast(e.userMessage || e.message, 7000, { error: true });
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
    addEventListener('resize', () => { this.stage.resize(); if (!this.intro && !this.menu) { this.camManual = false; this.cam.set(this.cam.framing('stage')); } });
    fg.addEventListener('contextmenu', (e) => e.preventDefault());
    fg.addEventListener('pointerdown', (e) => this._down(e));
    addEventListener('pointermove', (e) => this._move(e));
    addEventListener('pointerup', (e) => this._up(e));
    addEventListener('pointercancel', (e) => this._up(e));
    fg.addEventListener('wheel', (e) => this._wheel(e), { passive: false });
    addEventListener('keydown', (e) => this._key(e, true));
    addEventListener('keyup', (e) => this._key(e, false));
  }

  _scenePt(e) { return this.cam.toScene(e.clientX, e.clientY); }

  _down(e) {
    if (this.menu) return;
    if (this.intro) { if (this.intro.t > 2) this.skipIntro(); return; }
    // two fingers: pinch to zoom / pan the camera (cancels any drag)
    (this.touches ||= new Map()).set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.touches.size === 2) { this._cancelDrag(); this._startPinch(); return; }
    if (this.touches.size > 2) return;
    const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
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
    // limb strings on the selected / hovered puppet first — unless the
    // finger is right on a body part, which is then grabbed directly
    const direct = this.scene.pick(x, y, 2);
    const onPart = direct && direct.actor.rootPin && direct.body !== direct.actor.root;
    const cands = onPart ? [] : [this.selected, ...this.scene.actors].filter((a) => a && a.pins);
    for (const a of cands) {
      for (const key of Object.keys(a.pins)) {
        const w = a.limbWorld(key);
        if (!w) continue;
        const [cx, cy] = this.scene.project(w[0], w[1], a.z);
        if (Math.hypot(cx - x, cy - y) < (touch ? 34 : 26)) {
          this.drag = { type: 'limb', actor: a, key };
          this.select(a);
          audio?.sfx('pick', { vol: 0.5, pan: this._pan(a) });
          return;
        }
      }
    }
    const hit = this.scene.pick(x, y, touch ? 20 : 8);
    if (!hit) {
      // double-tap empty cloth resets a pinched camera
      const now = performance.now();
      if (this._lastTap && now - this._lastTap < 320 && this.camManual) { this.camManual = false; this.cam.flyTo(this.cam.framing('stage'), 0.6); this._lastTap = 0; return; }
      this._lastTap = now;
      // click empty cloth: the selected puppet walks there
      if (this.selected instanceof Puppet && !this.selected.isPlant) this.walkTo = { actor: this.selected, x: this.scene.unproject(x, 0, this.selected.z)[0] };
      else this.select(null);
      return;
    }
    let a = hit.actor;
    if (a.heldBy) { a.heldBy.puppet.release(a.heldBy.hand); }
    this.select(a);
    const [wx, wy] = this.scene.unproject(x, y, a.z);
    audio?.sfx('pick', { vol: 0.6, pan: this._pan(a) });
    // long-press: select and show the ring (with a little buzz on phones)
    clearTimeout(this._lpTimer);
    this._lpTimer = setTimeout(() => {
      if (this.pointer.down && this.pointer.moved < 10 && this.drag && this.drag.actor === a) { this.select(a); navigator.vibrate?.(12); this.ui.renderSide(); }
    }, 450);
    if (a instanceof Puppet && hit.body && hit.body !== a.root && !hit.body.isRod && !a.isPlant) {
      // Melon-style: grab the very part you touched. Pulling sideways bends
      // the limb; lifting it lets the whole figure dangle from that point.
      const b = hit.body;
      const lp = b.toLocal(wx, wy);
      this.flies.find((f) => f.actor === a)?.release();
      if (a.mode === 'planted' && !a.dead && a.animW > 0.5) {
        // posing by hand: the limb bends at its joints toward the finger and
        // stays where you leave it
        a.controller = 'pose';
        a.stopAnim();
        this.drag = { type: 'pose', actor: a, body: b, lp, hist: [[performance.now(), wx, wy]] };
        this.select(a);
      } else {
        const pin = new Pin(b, lp, wx, wy, { compliance: 1 / (a.totalMass * 220), angle: null, maxCorr: 28 });
        this.scene.world.addC(pin);
        a.controller = 'drag';
        this.drag = { type: 'part', actor: a, pin, body: b, y0: wy, hist: [[performance.now(), wx, wy]] };
      }
    } else if (a instanceof Puppet) {
      a.setMode('held');
      a.controller = a.controller && a.controller !== 'player' ? a.controller : 'player';
      this.drag = { type: 'puppet', actor: a, ox: a.target.x - wx, oy: a.target.y - wy, hist: [[performance.now(), wx, wy]] };
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
    if (this.touches?.has(e.pointerId)) {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch) { this._updatePinch(); return; }
    }
    this.pointer.x = e.clientX; this.pointer.y = e.clientY;
    if (this.pointer.down) this.pointer.moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0);
    const d = this.drag;
    if (!d) return;
    const [x, y] = this._scenePt(e);
    if (d.type === 'lamp') { this.scene.moveLamp(x, y); return; }
    if (d.type === 'spawn') return;
    const a = d.actor;
    const [wx, wy] = this.scene.unproject(clamp(x, -80, CLOTH_W + 80), clamp(y, -60, CLOTH_H + 40), a.z);
    if (d.hist) { d.hist.push([performance.now(), wx, wy]); if (d.hist.length > 8) d.hist.shift(); }
    if (d.type === 'pose') {
      const n = 3;
      const miss = a.reach(d.body, d.lp, wx, wy, { n });
      // pulled far beyond what the limb can reach: the whole figure comes along
      if (miss > Math.max(140, a.chainReach(d.body, n) * 0.9)) {
        const pin = new Pin(d.body, d.lp, wx, wy, { compliance: 1 / (a.totalMass * 220), angle: null, maxCorr: 28 });
        this.scene.world.addC(pin);
        a.controller = 'drag';
        a.setMode('ragdoll');
        this.drag = { type: 'part', actor: a, pin, body: d.body, y0: wy + 100, hist: d.hist };
      }
      return;
    }
    if (d.type === 'part') {
      d.pin.tx = wx; d.pin.ty = wy;
      if (a.mode !== 'ragdoll' && d.y0 - wy > 70) a.setMode('ragdoll'); // lifted: dangle
      return;
    }
    if (d.type === 'puppet') a.holdAt(wx + d.ox, Math.min(wy + d.oy, a.standY() + 30));
    else if (d.type === 'limb') a.pullLimb(d.key, wx, wy);
    else if (d.type === 'static') a.placeAt(wx + d.ox, wy + d.oy);
    else if (d.type === 'prop') { d.pin.tx = wx; d.pin.ty = wy; }
  }

  _up(e) {
    this.touches?.delete(e.pointerId);
    if (this.pinch) { if ((this.touches?.size || 0) < 2) this.pinch = null; this.pointer.down = false; return; }
    clearTimeout(this._lpTimer);
    this.pointer.down = false;
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const [x, y] = this._scenePt(e);
    const fling = this._fling(d);
    if (d.type === 'spawn') {
      if (onCloth(x, y, 10)) {
        const a = this.spawn(d.def, clamp(x, 60, CLOTH_W - 60), clamp(y, 60, FLOOR), 0.02);
        if (a) this.select(a);
      }
      return;
    }
    const a = d.actor;
    if (d.type === 'pose') { a.controller = null; audio?.sfx('click', { vol: 0.3 }); this.ui.renderSide(); return; }
    if (d.type === 'part') {
      this.scene.world.removeC(d.pin);
      a.controller = null;
      if (a.mode === 'ragdoll') { a.ragdollT = 0; if (fling) this._throw(a, fling, 0.35); }
      else a.plantAt(a.root.x);
      return;
    }
    if (d.type === 'puppet') {
      a.controller = a.controller === 'player' ? null : a.controller;
      if (fling && Math.hypot(fling[0], fling[1]) > 750) {
        // thrown: let go as a ragdoll carrying the swing
        a.setMode('ragdoll');
        this._throw(a, fling, 0.8);
        audio?.sfx('whoosh', { vol: 0.5, pan: this._pan(a) });
        return;
      }
      if (a.target.y > a.standY() - 140) a.plantAt(a.target.x);
      else a.setMode('hung');
      audio?.sfx('step', { vol: 0.4 });
    } else if (d.type === 'limb') a.releaseLimb(d.key);
    else if (d.type === 'prop') {
      this.scene.world.removeC(d.pin);
      if (!a.gripLocal) return; // torn pieces can't be held
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

  // pointer velocity (world units/s) over the last ~90 ms of a drag
  _fling(d) {
    const H = d.hist;
    if (!H || H.length < 2) return null;
    const last = H[H.length - 1];
    let i = H.length - 2;
    while (i > 0 && last[0] - H[i][0] < 90) i--;
    const dt = (last[0] - H[i][0]) / 1000;
    if (dt <= 0.005 || performance.now() - last[0] > 120) return null;
    return [(last[1] - H[i][1]) / dt, (last[2] - H[i][2]) / dt];
  }

  _throw(a, [vx, vy], k) {
    const s = Math.hypot(vx, vy), cap = 1600;
    const m = s > cap ? cap / s : 1;
    for (const b of a.parts) { b.vx += vx * m * k; b.vy += vy * m * k; }
  }

  _cancelDrag() {
    const d = this.drag;
    this.drag = null;
    clearTimeout(this._lpTimer);
    if (!d) return;
    if (d.type === 'pose') { d.actor.controller = null; return; }
    if (d.type === 'part') { this.scene.world.removeC(d.pin); d.actor.controller = null; if (d.actor.mode !== 'ragdoll') d.actor.plantAt(d.actor.root.x); }
    else if (d.type === 'puppet') { d.actor.controller = null; d.actor.plantAt(d.actor.target.x); }
    else if (d.type === 'prop') this.scene.world.removeC(d.pin);
    else if (d.type === 'limb') d.actor.releaseLimb(d.key);
  }

  _startPinch() {
    const [p, q] = [...this.touches.values()];
    this.pinch = { d0: Math.hypot(p.x - q.x, p.y - q.y) || 1, z0: this.cam.zoom, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2, cx: this.cam.x, cy: this.cam.y };
    if (this.director.mode !== 'free') this.director.mode = 'free';
    this.cam.anim = null;
    this.camManual = true;
  }

  _updatePinch() {
    const P = this.pinch, [p, q] = [...this.touches.values()];
    if (!p || !q) return;
    const cam = this.cam;
    const base = cam.framing('stage').zoom;
    const z = clamp(P.z0 * (Math.hypot(p.x - q.x, p.y - q.y) / P.d0), base * 0.8, base * 4);
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    // keep the scene point under the starting midpoint under the fingers
    const sx = (P.mx - cam.vw / 2) / P.z0 + P.cx, sy = (P.my - cam.vh / 2) / P.z0 + P.cy;
    cam.zoom = z;
    cam.x = clamp(sx - (mx - cam.vw / 2) / z, -200, 1800);
    cam.y = clamp(sy - (my - cam.vh / 2) / z, -2600, 1300);
  }

  toggleFreeze(a) {
    if (!a) return;
    if (a.rootPin) {
      a.frozen = !a.frozen;
      if (a.frozen) { a.controller = 'frozen'; a.target.x = a.root.x; a.target.y = a.root.y; a.setMode('hung'); }
      else { a.controller = null; a.plantAt(a.root.x); }
    } else if (a.setStatic) { a.frozen = !a.isStatic; a.setStatic(a.frozen); }
    audio?.sfx(a.frozen ? 'ching' : 'pop', { vol: 0.5 });
    this.ui.renderSide();
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
    if (this.menu || this.intro) { if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') this.skipIntro(); return; }
    const a = this.selected;
    const mv = KEY_MOVES[e.code];
    if (mv && a) { this.playMove(mv); e.preventDefault(); }
    if (e.code === 'KeyF' && a) { a.flip(); audio?.sfx('flip'); }
    if (e.code === 'KeyC') this.director.cycle();
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
    this.stage.excitement = Math.min(1, this.stage.excitement + (h.vital >= 1.6 ? 0.6 : 0.3));
    if (h.target && h.attacker) h.target._lastAttacker = h.attacker;
    const [cx, cy] = this.scene.project(h.x, h.y, h.z);
    const alive = h.target?.dmg?.soul && !h.target.dead && !h.blocked;
    const warded = h.target?.dmg?.ward > 0.01;
    this.stage.sparks(cx, cy, h.blocked || warded ? 26 : alive ? 6 : 12, h.blocked || warded ? '255,230,150' : alive ? '160,10,14' : '255,140,80');
    this.scene.membrane.poke(cx, cy, 60, h.blocked ? 40 : 90);
    this.cam.shake = Math.max(this.cam.shake, h.result === 'fall' ? 14 : 6);
    const pan = (cx - 800) / 800;
    audio?.sfx(h.blocked ? 'clang' : h.weapon ? 'clang' : 'hit', { pan, vol: 0.9 });
    if (h.result === 'fall') audio?.sfx(Math.random() < 0.5 ? 'gasp' : 'cheer', { vol: 0.5 });
    else if (Math.random() < 0.15) audio?.sfx('laugh', { vol: 0.35 });
  }

  // voice a speech line (one voice at a time; the selected puppet may cut in)
  onSpeech(p, s) {
    if (!s || !audio || s.voiced) return;
    const now = performance.now() / 1000;
    if (now < (this._voiceUntil || 0) && p !== this.selected) return;
    s.voiced = true;
    const d = audio.voice(s.th, { voice: p.rig?.voice || 'male', pan: this._pan(p) }) || 0;
    if (d > 0) { s.speak = d; p.talk = d; s.dur = Math.max(s.dur, d + 1.2); }
    this._voiceUntil = now + Math.max(0.6, d * 0.85);
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
    T.drawPreview(ctx, 0, 0, 240, 180, { labels: false });
    const h0 = hands[0];
    this.ui.gest.style.opacity = h0 ? 1 : 0.2;
    return any;
  }

  // ------------------------------------------------------------ intro
  // main menu: only the heavens; play zooms into the light and drops you
  // through the clouds to the stage
  startIntro() {
    this.menu = true;
    this.scene.lamp.intensity = 0;
    this.scene.lamp.target = 0;
    for (const c of this.stage.curtains) { c.target = 0; c.open = 0; }
    const hz = this.cam.framing('heaven').zoom;
    this.cam.set({ x: 800, y: -2050, zoom: hz * 1.35 });
    this.menuEl = document.createElement('div');
    this.menuEl.id = 'menu';
    this.menuEl.innerHTML = '<div class="m-title">โรงละครหนังตะลุง<small>simulator</small></div><button class="medal big play" title="เริ่มการแสดง · Begin the show"><i class="gem"></i><svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg></button>';
    this.root.querySelector('#ui').append(this.menuEl);
    this.menuEl.querySelector('.play').addEventListener('click', () => this.beginPlay());
  }

  beginPlay() {
    if (!this.menu) return;
    this.menu = false;
    this.menuEl.classList.add('hidden');
    setTimeout(() => this.menuEl.remove(), 1200);
    this.intro = { t: 0, stage: 0 };
    this.cam.flyTo({ x: 800, y: -2050, zoom: this.cam.zoom * 6 }, 1.6, (u) => u * u * u);
    audio?.sfx('chime');
    this.ui.skip.classList.remove('hidden');
  }

  skipIntro() {
    if (this.menu) { this.beginPlay(); return; }
    if (!this.intro) return;
    if (this.intro.stage < 1) this.cam.set(this.cam.framing('stage'));
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
    this.padOn = true;
    this.controls.show(true);
    this.ui.setButton('b-pad', true);
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
    if (t > 1.6 && I.stage === 0) { I.stage = 1; this.cam.set(this.cam.framing('stage')); }
    if (t > 3.0 && I.stage === 1) { I.stage = 2; audio?.music.play('overture'); }
    if (t > 3.4 && I.stage === 2) { I.stage = 3; for (const c of this.stage.curtains) c.target = 1; audio?.sfx('curtain'); }
    if (t > 5.4 && I.stage === 3) { I.stage = 4; audio?.sfx('lamp-ignite'); this.scene.lamp.target = 1; this.scene.lamp.intensity = 0.25; }
    if (t > 6.8 && I.stage === 4) {
      I.stage = 5;
      I.spawned = this._introHermit(0.42);
      I.spawned.setMode('held');
    }
    if (I.stage === 5 && I.spawned) {
      const u = Math.min(1, (t - 6.8) / 4);
      const e = easeInOutSine(u);
      const p = I.spawned;
      p.setDepth(0.42 + (0.02 - 0.42) * e);
      const [wx] = this.scene.unproject(700 - 140 * e, 0, p.z);
      p.holdAt(wx, p.standY() - 30 * (1 - e));
      if (u >= 1) { I.stage = 6; p.plantAt(p.root.x); p.play('wai'); audio?.sfx('gong'); }
    }
    if (I.stage === 6 && t > 12.5) this._endIntro();
  }

  // ------------------------------------------------------------ frame
  update(dt) {
    this.time += dt;
    if (this.intro) this._updateIntro(this.wallDt || dt);
    // keyboard walking
    const a = this.selected;
    if (a && a instanceof Puppet && !a.isPlant && !this.drag) {
      const dir = (this.keys.has('ArrowRight') || this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('ArrowLeft') || this.keys.has('KeyA') ? 1 : 0);
      if (dir) {
        a.target.x = clamp(a.target.x + dir * 150 * dt, 60, this.scene.worldW - 60);
        this.walkTo = null;
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
    // on-screen pad + click-to-walk
    if (a && a instanceof Puppet && !a.isPlant && !this.drag && this.controls) {
      const mv = this.controls.move;
      if (mv) {
        if (a.mode !== 'planted') a.plantAt(a.target.x);
        a.target.x = clamp(a.target.x + mv * 185 * dt, 60, this.scene.worldW - 60);
        const dir = Math.sign(mv);
        if (dir !== a.facing && a.flipAnim <= 0 && !a.isBusy()) a.flip();
        this.walkTo = null;
      }
    }
    if (this.walkTo && !this.walkTo.actor.removed && !this.drag) {
      const w = this.walkTo, p = w.actor;
      if (p.mode !== 'planted') p.plantAt(p.target.x);
      const d = w.x - p.target.x;
      p.target.x += Math.sign(d) * Math.min(Math.abs(d), 165 * dt);
      if (Math.abs(d) > 6 && Math.sign(d) !== p.facing && p.flipAnim <= 0 && !p.isBusy()) p.flip();
      if (Math.abs(d) < 2) this.walkTo = null;
    }
    // side-scrolling: the screen follows the puppet you drive along a longer stage
    if (a && a instanceof Puppet && this.scene.worldW > CLOTH_W) {
      const [cx] = this.scene.project(a.root.x, a.root.y, a.z);
      const L = this.scene.lamp;
      if (cx > 1180) L.sx += (cx - 1180) * Math.min(1, dt * 4);
      if (cx < 420) L.sx -= (420 - cx) * Math.min(1, dt * 4);
      L.sx = clamp(L.sx, 0, this.scene.worldW - CLOTH_W);
    }
    const tracking = this._track(dt);
    this.trackingActive = tracking;
    for (const f of this.flies) f.update(dt, this);
    this.editor?.update(this.wallDt || dt);
    if (!this.editor?.playing) {
      this.animalAI.update(dt);
      this.social.update(dt);
      this.scene.update(dt);
      this.fx.update(dt);
      this.souls.update(dt);
      this.magic.update(dt);
      this.games.update(dt);
      swayFoliage(this.scene, this.fx, dt, this.scene.time);
      this.scenes.update(dt);
      if (this.fx.shake) this.cam.shake = Math.max(this.cam.shake, this.fx.shake);
    }
    for (const c of this.stage.curtains) c.step(dt, this.time);
    this.director.update(dt);
    this.tutorial?.update(this.wallDt || dt);
    this.build?.update(dt);
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
      if (roles.includes('dancer') || this.social?.acts.length) this.stage.excitement = Math.max(this.stage.excitement, 0.35);
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
    this.lastDt = dt;
    const frame = this.editor && this.editor.frame;
    this.stage.render(this.scene, dt, (f) => this._overlay(f, !!frame), frame);
    if (!frame) this.editor?.capture(this.wallDt || dt);
    this.editor?.composite();
  }

  _overlay(f, film = false) {
    const cam = this.cam, dpr = this.stage.dpr, S = this.scene;
    if (film) return; // playback / export: just the show
    const toScreen = (x, y) => cam.toScreen(x, y);
    const proj = (w, z) => { const [cx, cy] = S.project(w[0], w[1], z); return cam.toScreen(cx, cy); };
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    // menu / transition: clouds and heavenly light
    if (this.menu || this.intro) {
      const I = this.intro;
      const t = I ? I.t : 0;
      const veil = this.menu ? 0.55 : t < 1.6 ? 0.55 + t * 0.4 : Math.max(0, 1.2 - (t - 1.6) * 0.8);
      f.save(); this.stage.drawCloudVeil(f, veil, -(this.time * 30 + t * 900)); f.restore();
      f.setTransform(dpr, 0, 0, dpr, 0, 0);
      const light = this.menu ? 0 : t < 1.6 ? (t / 1.6) ** 2 : Math.max(0, 1 - (t - 1.6) / 1.4);
      if (light > 0) {
        const g = f.createRadialGradient(cam.vw / 2, cam.vh / 2, 0, cam.vw / 2, cam.vh / 2, Math.max(cam.vw, cam.vh) * 0.7);
        g.addColorStop(0, `rgba(255,252,235,${light})`);
        g.addColorStop(1, `rgba(255,214,140,${light * 0.9})`);
        f.fillStyle = g;
        f.fillRect(0, 0, cam.vw, cam.vh);
      }
      if (this.menu) return;
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
    // strings appear only while something holds the puppet, and fade away
    // when let go
    this.strA ||= new Map();
    const fdt = this.lastDt || 1 / 60;
    for (const a of S.actors) {
      if (!(a instanceof Puppet)) continue;
      const fly = this.flies.find((fl) => fl.actor === a);
      const mine = controlled.includes(a);
      const st = this.strA.get(a) || { p: 0, f: 0 };
      st.p = clamp(st.p + (mine ? fdt * 8 : -fdt * 2.2), 0, 1);
      st.f = clamp(st.f + (fly ? fdt * 3 : -fdt * 2), 0, 1);
      this.strA.set(a, st);
      if (st.p > 0) {
        const tips = this.hand.tips;
        const tgt = [a.handleWorld(), a.limbWorld('handB'), a.limbWorld('handF'), a.limbWorld('head'), a.limbWorld('footB'), a.limbWorld('footF')];
        const map = [[2, 0], [0, 1], [1, 2], [2, 3], [3, 4], [4, 5]];
        for (const [fi, ti] of map) {
          if (!tgt[ti] || !tips[fi]) continue;
          const s2 = proj(tgt[ti], a.z);
          drawString(f, tips[fi][0], tips[fi][1], s2[0], s2[1], { alpha: st.p * (ti === 0 ? 1 : 0.75), t: t + ti, width: ti === 0 ? 1.6 : 1.1 });
        }
      }
      if (st.f > 0 && fly && fly.hand) {
        const hw = proj(a.handleWorld(), a.z);
        const [fx, fy] = fly.hand;
        drawString(f, fx, fy, hw[0], hw[1], { alpha: st.f * 0.8, t, width: 1.1 });
        for (const k of ['handF', 'handB']) { const w = a.limbWorld(k); if (w) { const s2 = proj(w, a.z); drawString(f, fx, fy, s2[0], s2[1], { alpha: st.f * 0.45, t: t + 3, width: 0.8 }); } }
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
    this.tutorial?.draw(f, toScreen, dpr, cam.zoom);
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    // speech bubbles
    this.speechLayer.draw(f, cam, dpr, proj);
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
    this.build?.draw(f, cam, dpr);
    this.director.drawOverlay(f, cam, dpr);
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
