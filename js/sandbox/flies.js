// Little เทวดา stagehands: assign one to a puppet and give it a role, and
// it works the strings from above, walking, fighting, selling, joking and
// dancing by itself.

import { Puppet } from '../puppet/puppet.js';
import { drawDeva } from '../render/deva.js';
import { fight } from './combatAI.js';

export const ROLES = [
  ['fighter', 'นักดาบ', 'Sword fighter', '⚔'],
  ['dancer', 'นางรำ', 'Dancer', '❀'],
  ['merchant', 'แม่ค้า', 'Merchant', '฿'],
  ['villager', 'ชาวบ้าน', 'Villager', '⌂'],
  ['comedian', 'ตัวตลก', 'Comedian', '☺'],
  ['monster', 'ปีศาจ', 'Monster', '♆'],
  ['coward', 'ขี้ขลาด', 'Scaredy-cat', '!'],
  ['follower', 'ผู้ติดตาม', 'Follower', '→'],
  ['wander', 'เดินเล่น', 'Wanderer', '~'],
];

const GENERIC = {
  greet: [{ th: 'สวัสดีจ้า', en: 'Hello!' }, { th: 'ไปไหนมา', en: 'Where have you been?' }],
  fight: [{ th: 'เจอดาบข้าเสียเถิด!', en: 'Taste my blade!' }, { th: 'อย่าหนีนะ!', en: "Don't run!" }],
  taunt: [{ th: 'แค่นี้เองหรือ', en: 'Is that all?' }],
  sell: [{ th: 'ซื้อไหมจ๊ะ ของดีราคาถูก', en: 'Buy? Good stuff, cheap!' }, { th: 'หวานๆ จ้า', en: 'Sweet ones here!' }],
  buy: [{ th: 'อันนี้เท่าไหร่', en: 'How much is this?' }, { th: 'ลดได้ไหม', en: 'Any discount?' }],
  joke: [{ th: 'ฮ่าๆ ขำไม่ไหวแล้ว', en: "Haha, I can't stop laughing" }, { th: 'หรอยจังหู้', en: 'So tasty!' }],
  flee: [{ th: 'ช่วยด้วย!', en: 'Help!' }, { th: 'หนีเร็ว!', en: 'Run!' }],
  dance: [{ th: 'รำให้ดูนะ', en: "I'll dance for you" }],
  idle: [{ th: 'ฟ้าสวยจัง', en: 'Lovely sky tonight' }],
};

const pick = (a) => a[Math.floor(Math.random() * a.length)];
function line(p, cat) {
  const L = (p.rig && p.rig.lines) || {};
  const list = L[cat] && L[cat].length ? L[cat] : GENERIC[cat] || GENERIC.idle;
  return pick(list);
}

export class Fly {
  constructor(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.actor = null;
    this.role = null;
    this.t = Math.random() * 10;
    this.cool = 1 + Math.random() * 2;
    this.goal = null;
    this.wing = 0;
  }

  assign(actor, role) {
    if (this.actor) this.actor.controller = null;
    this.actor = actor;
    this.role = role;
    if (actor) {
      actor.controller = this;
      actor.flyRole = role;
      if (actor.mode === 'ragdoll' || actor.mode === 'hung') actor.plantAt(actor.root.x);
    }
  }

  release() {
    if (this.actor) {
      this.actor.controller = null;
      this.actor.flyRole = null;
      if (this.actor.anim && this.actor.anim.def.loop) this.actor.stopAnim();
    }
    this.actor = null;
    this.role = null;
  }

  update(dt, game) {
    this.t += dt;
    this.wing += dt * 60;
    const a = this.actor;
    if (a && a.removed) this.release();
    let tx, ty;
    if (this.actor) {
      const [hx, hy] = this.actor.handleWorld();
      const [cx, cy] = game.scene.project(hx, hy, this.actor.z);
      tx = cx + Math.sin(this.t * 2.3) * 14;
      ty = cy - 170 - Math.sin(this.t * 1.7) * 10;
      this._brain(dt, game);
    } else {
      // buzz around the lamp
      const i = game.flies.indexOf(this);
      tx = 800 + Math.sin(this.t * 0.23 + i * 1.7) * 900;
      ty = -330 + Math.sin(this.t * 0.4 + i) * 60;
    }
    this.vx += ((tx - this.x) * 4 - this.vx * 2.6) * dt;
    this.vy += ((ty - this.y) * 4 - this.vy * 2.6) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  _walk(p, x, speed = 120, dt) {
    const d = x - p.target.x;
    const step = Math.sign(d) * Math.min(Math.abs(d), speed * dt);
    p.target.x += step;
    const want = Math.sign(d);
    if (Math.abs(d) > 8 && want && want !== p.facing && !p.isBusy()) p.flip();
    return Math.abs(d) < 10;
  }

  _face(p, x) {
    const want = Math.sign(x - p.root.x);
    if (want && want !== p.facing && !p.isBusy() && p.flipAnim <= 0) p.flip();
  }

  _brain(dt, game) {
    const p = this.actor;
    if (!(p instanceof Puppet)) return;
    if (p.mode === 'ragdoll' || p.dead) return;
    if (p.mode !== 'planted') p.plantAt(p.root.x);
    this.cool -= dt;
    const others = game.scene.actors.filter((o) => o !== p && o instanceof Puppet && !o.removed && Math.abs(o.z - p.z) < 0.08);
    const nearest = (f = () => true) => {
      let best = null, bd = Infinity;
      for (const o of others) {
        if (!f(o)) continue;
        const d = Math.abs(o.root.x - p.root.x);
        if (d < bd) { bd = d; best = o; }
      }
      return best ? { o: best, d: bd } : null;
    };
    const minX = 120, maxX = 1480;
    const wander = (speed = 70) => {
      if (this.goal == null || this._walk(p, this.goal, speed, dt)) {
        if (Math.random() < dt * 0.6 || this.goal == null) this.goal = minX + Math.random() * (maxX - minX);
      }
    };
    const say = (cat) => { p.say(line(p, cat)); game.onSpeech?.(p, p.speech); };

    switch (this.role) {
      case 'fighter':
      case 'monster':
        fight(this, p, dt, game, say);
        break;
      case 'dancer': {
        // a นางรำ works through the ท่ารำ repertoire in random order, one or
        // two loops of each, with the odd ตั้งวง pose between, drifting softly
        const REP = ['ram-theppranom', 'ram-phromsina', 'ram-sodsoi', 'ram-kinnorn', 'ram-chanee', 'ram-kwang', 'ram-phala', 'ram-nakha', 'ram-lokaew', 'ram-mangkorn', 'dance'];
        const cur = p.anim && !p.anim.stopping ? p.anim.name : null;
        const dancing = cur && (REP.includes(cur) || cur === 'wong');
        if (!dancing || (this.danceUntil != null && this.t > this.danceUntil)) {
          if (dancing && cur !== 'wong' && Math.random() < 0.2) {
            p.play('wong');
            this.danceUntil = this.t + 2.4; // move on as it lowers from the pose
          } else {
            let next = pick(REP);
            if (next === this.lastDance) next = REP[(REP.indexOf(next) + 1) % REP.length];
            if (p.play(next, { loop: true })) {
              this.lastDance = next;
              this.danceUntil = this.t + p.anim.def.duration * (Math.random() < 0.5 ? 1 : 2);
              if (!cur || Math.random() < 0.3) say('dance');
            }
          }
        }
        if (this.goal == null || this._walk(p, this.goal, 30, dt)) this.goal = 300 + Math.random() * 1000;
        break;
      }
      case 'merchant': {
        const stall = game.scene.actors.find((o) => o.def && ['market', 'food'].includes(o.def.cat) && Math.abs(o.z - p.z) < 0.1);
        if (stall) {
          const [sx] = game.scene.project(stall.root.x, 0, stall.z);
          this._walk(p, game.scene.unproject(sx + 150, 0, p.z)[0], 80, dt);
        }
        if (this.cool <= 0 && !p.isBusy()) {
          p.play(Math.random() < 0.7 ? 'beckon' : 'wave');
          say('sell');
          this.cool = 4 + Math.random() * 4;
        }
        break;
      }
      case 'villager': {
        const n = nearest();
        if (n && n.d < 200 && this.cool <= 0 && !p.isBusy()) {
          this._face(p, n.o.root.x);
          const merchant = n.o.flyRole === 'merchant';
          p.play(merchant ? 'point' : Math.random() < 0.5 ? 'wai' : 'wave');
          say(merchant ? 'buy' : 'greet');
          this.cool = 5 + Math.random() * 5;
        } else wander(70);
        break;
      }
      case 'comedian': {
        wander(90);
        if (this.cool <= 0 && !p.isBusy()) {
          const n = nearest();
          const r = Math.random();
          if (n && n.d < 180 && r < 0.3) { this._face(p, n.o.root.x); p.play('strike'); say('joke'); }
          else if (r < 0.7) { p.play('laugh'); say('joke'); }
          else p.play('leap');
          this.cool = 3 + Math.random() * 3;
        }
        break;
      }
      case 'coward': {
        const threat = nearest((o) => o.flyRole === 'monster' || o.flyRole === 'fighter' || o.kind === 'demon');
        if (threat && threat.d < 420) {
          const away = p.root.x - Math.sign(threat.o.root.x - p.root.x) * 300;
          this._walk(p, Math.max(minX, Math.min(maxX, away)), 220, dt);
          if (!p.anim || p.anim.name !== 'flee') { p.play('flee', { loop: true }); say('flee'); }
        } else {
          if (p.anim && p.anim.name === 'flee') p.stopAnim();
          wander(50);
        }
        break;
      }
      case 'follower': {
        const lead = game.selected && game.selected !== p && game.selected instanceof Puppet ? game.selected : nearest()?.o;
        if (lead) {
          const side = Math.sign(p.root.x - lead.root.x) || -1;
          this._walk(p, lead.root.x + side * lead.height * 0.45, 140, dt);
          if (this.cool <= 0 && !p.isBusy()) { if (Math.random() < 0.3) say('greet'); this.cool = 6; }
        } else wander();
        break;
      }
      default: {
        wander(60);
        if (this.cool <= 0) {
          if (p.def?.sound) game.audio?.sfx(p.def.sound, { pan: (p.root.x - 800) / 800, vol: 0.6 });
          if (!p.isHumanoid) p.play('hop');
          this.cool = 3 + Math.random() * 6;
        }
      }
    }
  }

  // A little mural เทวดา (see render/deva.js): flies freely between jobs,
  // kneels on a small cloud while working a puppet's strings.
  draw(ctx, toScreen, dpr, zoom) {
    const [sx, sy] = toScreen(this.x, this.y);
    const s = Math.max(0.9, zoom * 2.1) * (this.actor ? 1 : 0.85) * 0.6;
    const t = this.t;
    const face = this.actor ? Math.sign(((this.actor.root && this.actor.root.x) || 0) - this.x + 0.001) || 1 : Math.sign(this.vx) || 1;
    this.face = this.face == null ? face : this.face + (face - this.face) * 0.1;
    this.hue ??= Math.floor(Math.random() * 5);
    const pose = this.actor ? 'kneel' : 'fly';
    if (pose !== this.pose) { this.prevPose = this.pose; this.pose = pose; this.poseT = 0; }
    this.poseT = (this.poseT || 0) + 1 / 60;
    const k = this.prevPose ? Math.min(1, this.poseT / 0.35) : 1;
    const flap = Math.min(1, Math.hypot(this.vx, this.vy) / 350);
    const fs = Math.sign(this.face) || 1;
    const f = fs * Math.max(0.08, Math.min(1, Math.abs(this.face) * 1.6));
    ctx.save();
    ctx.setTransform(dpr * s, 0, 0, dpr * s, sx * dpr, sy * dpr);
    ctx.rotate(Math.sin(t * 1.3) * 0.05 + this.vx * 0.0003);
    const a0 = ctx.globalAlpha;
    if (k < 1) {
      ctx.globalAlpha = a0 * (1 - k);
      drawDeva(ctx, { t, face: f, flap, pose: this.prevPose, hue: this.hue, active: !!this.actor });
      ctx.globalAlpha = a0 * k;
    } else this.prevPose = null;
    const { hand } = drawDeva(ctx, { t, face: f, flap, pose, hue: this.hue, active: !!this.actor });
    ctx.globalAlpha = a0;
    const m = ctx.getTransform();
    ctx.restore();
    this.handOff = hand;
    // hand position in screen space (strings leave from here)
    const fx = fs;
    this.hand = [(m.a * hand[0] + m.c * hand[1] + m.e) / dpr, (m.b * hand[0] + m.d * hand[1] + m.f) / dpr];
    // sparkle dust behind
    if (Math.random() < 0.35) (this.dust ||= []).push({ x: sx, y: sy, t: 0, vx: -fx * (10 + Math.random() * 20), vy: 10 + Math.random() * 15 });
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    this.dust = (this.dust || []).filter((d) => {
      d.t += 1 / 60; d.x += d.vx / 60; d.y += d.vy / 60;
      if (d.t > 1.2) return false;
      ctx.fillStyle = `rgba(255,225,150,${(1 - d.t / 1.2) * 0.8})`;
      ctx.beginPath(); ctx.arc(d.x, d.y, 1.6, 0, 7); ctx.fill();
      return true;
    });
    ctx.restore();
    return [sx, sy];
  }
}
