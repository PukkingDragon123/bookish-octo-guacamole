// ผู้กำกับกล้อง — the camera director.
//
//   free       the whole booth, as before (you can still pan by dragging
//              the lamp etc.)
//   follow     glides after the selected puppet, a little ahead of where
//              it is going, framing it with room above for the strings
//   cinematic  a fight-aware director: finds where the action is (who is
//              swinging, who just got hit, who is dying), frames the two
//              combatants, cuts between wide / medium / close shots, punches
//              in and slows time on a vital hit, a severed limb or a death,
//              and drifts slowly over the scene when nothing is happening.
//              Letterbox bars slide in while it's running.
//
// All motion is critically damped springs toward a target framing, so the
// camera never snaps (except for deliberate cuts).

import { Puppet } from '../puppet/puppet.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const MODES = ['free', 'follow', 'cinematic'];

function spring(cur, vel, target, omega, dt) {
  // critically damped spring step; returns [pos, vel]
  const x = cur - target;
  const e = Math.exp(-omega * dt);
  const nx = (x + (vel + omega * x) * dt) * e;
  const nv = (vel - omega * (vel + omega * x) * dt) * e;
  return [target + nx, nv];
}

export class Director {
  constructor(game) {
    this.game = game;
    this.mode = 'free';
    this.v = { x: 0, y: 0, z: 0 };
    this.bars = 0;          // letterbox amount 0..1
    this.shot = 'wide';
    this.shotT = 0;
    this.punch = 0;         // punch-in zoom boost
    this.focus = null;      // actor / point of interest
    this.slow = 0;          // slow-motion time left (s)
    this.drift = 0;
    this.lastHit = null;
    game.scene.on('hit', (h) => this._onHit(h));
  }

  get timeScale() {
    return this.mode === 'cinematic' && this.slow > 0 ? 0.3 : 1;
  }

  setMode(m) {
    this.mode = m;
    this.shotT = 0;
    this.v = { x: 0, y: 0, z: 0 };
    if (m === 'free') this.game.cam.flyTo(this.game.cam.framing('stage'), 0.9);
    this.game.ui?.setButton?.('b-cam', m !== 'free');
    const names = { free: 'กล้องอิสระ · Free camera', follow: 'กล้องติดตาม · Follow camera', cinematic: 'กล้องภาพยนตร์ · Cinematic fight camera' };
    this.toastMode(names[m]);
  }

  cycle() { this.setMode(MODES[(MODES.indexOf(this.mode) + 1) % MODES.length]); }

  toastMode(text) {
    let el = document.getElementById('cam-mode');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cam-mode';
      document.querySelector('#ui')?.append(el);
    }
    el.textContent = text;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  _onHit(h) {
    if (this.mode !== 'cinematic') return;
    const big = h.vital >= 1.6 || h.result === 'fall' || (h.target?.dmg?.soul && (h.power || 0) > 1.2);
    this.lastHit = { x: h.x, y: h.y, z: h.z, t: 0, a: h.attacker, b: h.target, big };
    if (big) {
      this.punch = Math.max(this.punch, 0.55);
      this.slow = Math.max(this.slow, 0.55);
      this.shot = 'close';
      this.shotT = 0;
    } else this.punch = Math.max(this.punch, 0.18);
  }

  // cloth-space centre of an actor (its torso)
  _pt(a) {
    const r = a.handleWorld ? a.handleWorld() : [a.root.x, a.root.y];
    const [x, y] = this.game.scene.project(r[0], r[1], a.z);
    return [x, y, (a.height || 300) / (1 - a.z)];
  }

  update(dt) {
    const g = this.game, cam = g.cam;
    this.slow = Math.max(0, this.slow - (g.wallDt || dt));
    this.punch *= Math.exp(-dt * 1.6);
    const cinematic = this.mode === 'cinematic';
    this.bars += ((cinematic ? 1 : 0) - this.bars) * Math.min(1, dt * 3);
    if (this.mode === 'free' || g.intro || g.menu || cam.anim) return;
    const base = cam.framing('close');
    let tx = 800, ty = 520, tz = base.zoom, om = 3.2;
    if (this.mode === 'follow') {
      const a = g.selected && g.selected.root ? g.selected : g.scene.puppets()[0];
      if (a) {
        const [x, y, h] = this._pt(a);
        const lead = clamp((a.vel?.x || 0) * 0.35, -160, 160);
        tx = x + lead;
        ty = y - h * 0.05;
        tz = clamp(cam.vh / (h * 2.3), base.zoom, base.zoom * 2.1);
      }
      om = 3;
    } else {
      // --- cinematic: find the action
      const S = g.scene;
      const fighters = S.actors.filter((a) => a instanceof Puppet && !a.removed && (a.attacking > 0 || a.flyRole === 'fighter' || a.flyRole === 'monster' || a.dead || (a.anim && a.anim.def.attack)));
      this.shotT += g.wallDt || dt;
      let pts;
      const lh = this.lastHit;
      if (lh) lh.t += g.wallDt || dt;
      if (lh && lh.t < 1.4 && lh.a && lh.b && !lh.a.removed && !lh.b.removed) pts = [this._pt(lh.a), this._pt(lh.b)];
      else if (fighters.length) {
        // pair the most active fighter with its nearest opponent
        const act = fighters.slice().sort((a, b) => (b.attacking + (b.anim?.def.attack ? 1 : 0)) - (a.attacking + (a.anim?.def.attack ? 1 : 0)))[0];
        let foe = null, bd = Infinity;
        for (const o of fighters) { if (o === act) continue; const d = Math.abs(o.root.x - act.root.x); if (d < bd) { bd = d; foe = o; } }
        pts = foe ? [this._pt(act), this._pt(foe)] : [this._pt(act)];
      } else {
        // nothing fighting: slow establishing drift over whoever is on stage
        const ps = S.puppets().filter((p) => !p.removed);
        this.drift += dt * 0.08;
        if (ps.length) {
          const p = ps[Math.floor(this.drift) % ps.length];
          pts = [this._pt(p)];
          if (this.shotT > 5) { this.shot = this.shot === 'wide' ? 'medium' : 'wide'; this.shotT = 0; }
        } else pts = [[800, 560, 400]];
      }
      // shot changes during a fight: wide → medium → close, cut every few s
      if (this.shotT > (this.shot === 'close' ? 1.8 : 3.6) && fighters.length) {
        this.shot = this.shot === 'wide' ? 'medium' : this.shot === 'medium' ? (Math.random() < 0.5 ? 'close' : 'wide') : 'medium';
        this.shotT = 0;
        this.cut = true; // hard cut to the new framing
      }
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, hmax = 0;
      for (const [x, y, h] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y - h * 0.45); y1 = Math.max(y1, y + h * 0.4); hmax = Math.max(hmax, h); }
      const pad = this.shot === 'wide' ? 1.9 : this.shot === 'medium' ? 1.35 : 1.05;
      const w = (x1 - x0) + hmax * 0.8, hh = (y1 - y0);
      tz = Math.min(cam.vw / (w * pad), cam.vh * (1 - 0.18 * this.bars) / (hh * pad));
      tz = clamp(tz * (1 + this.punch), base.zoom * 0.95, base.zoom * 3.2);
      tx = (x0 + x1) / 2;
      ty = (y0 + y1) / 2 + (this.shot === 'close' ? -hmax * 0.05 : 0);
      if (lh && lh.big && lh.t < 0.5) { const [hx, hy] = S.project(lh.x, lh.y, lh.z); tx = tx * 0.5 + hx * 0.5; ty = ty * 0.5 + hy * 0.5; }
      om = this.shot === 'close' ? 5 : 3.2;
    }
    // keep the frame inside the booth
    const hw = cam.vw / tz / 2, hh2 = cam.vh / tz / 2;
    tx = clamp(tx, -150 + hw, 1750 - hw);
    ty = clamp(ty, -120 + hh2, 1080 - hh2);
    if (hw * 2 > 1900) tx = 800;
    if (this.cut) {
      this.cut = false;
      cam.x = tx; cam.y = ty; cam.zoom = tz; this.v = { x: 0, y: 0, z: 0 };
      return;
    }
    const d = g.wallDt || dt;
    [cam.x, this.v.x] = spring(cam.x, this.v.x, tx, om, d);
    [cam.y, this.v.y] = spring(cam.y, this.v.y, ty, om, d);
    const lz = Math.log(cam.zoom);
    let nz;
    [nz, this.v.z] = spring(lz, this.v.z, Math.log(tz), om * 0.8, d);
    cam.zoom = Math.exp(nz);
  }

  // Scroll the stage (lamp.sx) so the action stays on the cloth: a fight
  // that runs off the edge is followed, otherwise the puppet you drive.
  scroll(dt) {
    const g = this.game, S = g.scene, L = S.lamp;
    const maxSx = Math.max(0, S.worldW - 1600);
    let focus = null;
    const fighters = S.actors.filter((a) => a instanceof Puppet && !a.removed && !a.dead && (a.attacking > 0 || (a.anim && a.anim.def.attack) || a.flyRole === 'fighter' || a.flyRole === 'monster'));
    const visible = (x) => x > 220 && x < 1380;
    if (fighters.length) {
      let x0 = Infinity, x1 = -Infinity;
      for (const a of fighters) { x0 = Math.min(x0, a.root.x); x1 = Math.max(x1, a.root.x); }
      const mid = (x0 + x1) / 2;
      const cx = mid - L.sx;
      if (this.mode === 'cinematic' || !visible(cx)) focus = mid;
    }
    const a = g.selected;
    if (focus == null && a && a.root && a.rootPin && !a.isPlant) {
      const cx = a.root.x - L.sx;
      if (cx > 1180) focus = a.root.x - 380;
      else if (cx < 420) focus = a.root.x + 380;
      if (this.mode === 'follow') focus = a.root.x;
    }
    if (focus == null) { L.sx = Math.max(0, Math.min(maxSx, L.sx)); return; }
    const want = Math.max(0, Math.min(maxSx, focus - 800));
    L.sx += (want - L.sx) * Math.min(1, dt * 2.5);
  }

  // where the view sits along a long stage (drawn as a thin gold rail)
  drawRail(f, cam, dpr) {
    const S = this.game.scene;
    if (S.worldW <= 1600) return;
    const [x0, y0] = cam.toScreen(0, 1012), [x1] = cam.toScreen(1600, 1012);
    const w = x1 - x0, k = 1600 / S.worldW;
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    f.fillStyle = 'rgba(20,8,3,0.55)';
    f.fillRect(x0, y0, w, 5);
    f.fillStyle = 'rgba(231,181,69,0.9)';
    f.fillRect(x0 + (S.lamp.sx / S.worldW) * w, y0, w * k, 5);
    // where the puppets are
    f.fillStyle = 'rgba(255,240,200,0.9)';
    for (const a of S.actors) if (a.rootPin && !a.isPlant && a.root) f.fillRect(x0 + (a.root.x / S.worldW) * w - 1, y0 - 2, 2, 9);
  }

  // letterbox bars + slow-motion vignette on the fg overlay (CSS px)
  drawOverlay(f, cam, dpr) {
    if (this.bars < 0.01) return;
    const h = cam.vh * 0.085 * this.bars;
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    f.fillStyle = 'rgba(8,4,2,0.92)';
    f.fillRect(0, 0, cam.vw, h);
    f.fillRect(0, cam.vh - h, cam.vw, h);
    // thin gold rules on the bars
    f.fillStyle = `rgba(231,181,69,${0.55 * this.bars})`;
    f.fillRect(0, h - 1.5, cam.vw, 1.5);
    f.fillRect(0, cam.vh - h, cam.vw, 1.5);
    if (this.slow > 0) {
      const a = Math.min(1, this.slow * 3) * 0.35;
      const gr = f.createRadialGradient(cam.vw / 2, cam.vh / 2, Math.min(cam.vw, cam.vh) * 0.3, cam.vw / 2, cam.vh / 2, Math.max(cam.vw, cam.vh) * 0.7);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, `rgba(40,0,0,${a})`);
      f.fillStyle = gr;
      f.fillRect(0, 0, cam.vw, cam.vh);
    }
  }
}
