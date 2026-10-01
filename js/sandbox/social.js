// ปฏิสัมพันธ์ — puppets meeting each other.
//
// Two figures walk to a polite distance, turn to face each other and do
// something together: shake hands (their front hands really meet and pump
// together), ไหว้ each other, hug, high-five, sit down for a chat with
// lines going back and forth, or dance side by side. Idle figures that
// nobody is working sometimes start one by themselves.

import { Puppet } from '../puppet/puppet.js';

export const INTERACTIONS = [
  ['handshake', 'จับมือ', 'Shake hands', 'M4 13l4-3 3 2 3-2 6 4M8 10l-3-3M16 10l3-3M10 15l2 2 2-2'],
  ['wai', 'ไหว้กัน', 'Wai each other', 'M12 3c-2 3-3 6-3 9l3 3 3-3c0-3-1-6-3-9zM9 12l-4 8M15 12l4 8'],
  ['hug', 'กอด', 'Hug', 'M7 6a2 2 0 1 0 0 .1M17 6a2 2 0 1 0 0 .1M4 20c0-6 3-9 8-9s8 3 8 9M8 13l4 3 4-3'],
  ['highfive', 'แปะมือ', 'High five', 'M8 21V9M8 9l-3-4M8 9l1-6M16 21V9M16 9l3-4M16 9l-1-6M10 4l2-2 2 2'],
  ['chat', 'คุยกัน', 'Chat', 'M4 5h11v7H8l-4 3zM10 14h6l4 3v-9h-3'],
  ['sit', 'นั่งคุย', 'Sit and talk', 'M6 20v-6h7l3 6M6 14V8a2 2 0 1 1 4 0v6M18 20v-8'],
  ['dance', 'รำคู่', 'Dance together', 'M12 21c-4-3-7-6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4-3 7-7 10z'],
];

const LINES = {
  greet: [['สวัสดีจ้า', 'Hello there!'], ['ไม่ได้เจอกันนานเลยนะ', "Haven't seen you in ages!"], ['สบายดีไหม', 'How are you?'], ['ไปไหนมาจ๊ะ', 'Where have you been?']],
  reply: [['สบายดีจ้า ขอบใจนะ', "I'm well, thank you!"], ['ไปตลาดมาจ้ะ', 'Just back from the market.'], ['ก็เรื่อยๆ นะ', 'Same as ever.'], ['คิดถึงจังเลย', 'I missed you!']],
  chat: [['วันนี้ฟ้าสวยจังนะ', 'Lovely sky today.'], ['ได้ข่าวว่าหมูเด้งหนีเที่ยวอีกแล้ว', 'Heard Moo Deng ran off again.'], ['คืนนี้มีหนังตะลุงนะ', "There's a shadow play tonight."], ['ข้าวปีนี้งามมาก', "This year's rice is beautiful."], ['ทุเรียนแพงขึ้นอีกแล้ว', 'Durian got pricier again.'], ['ลูกบ้านนั้นจะแต่งงานแล้ว', "That family's kid is getting married."]],
  laugh: [['ฮ่าๆ จริงเหรอ', 'Haha, really?'], ['ตายแล้ว!', 'Oh my!'], ['หรอยจังฮู้', 'So good!'], ['ว่าแล้วเชียว', 'I knew it!']],
  bye: [['ไว้เจอกันนะ', 'See you later!'], ['ไปก่อนนะจ๊ะ', "I'll be off now."], ['โชคดีนะ', 'Good luck!']],
  hug: [['คิดถึงที่สุดเลย', 'Missed you so much!']],
  five: [['เย้!', 'Yay!'], ['เยี่ยมไปเลย!', 'Awesome!']],
};
const isFemale = (p) => /female|woman|girl/.test(p.rig?.voice || '') || /nang|woman|thewada/.test(p.def?.id || p.rig?.id || '');
const pick = (a) => { const l = a[Math.floor(Math.random() * a.length)]; return { th: l[0], en: l[1] }; };

export class Social {
  constructor(game) {
    this.game = game;
    this.acts = [];
    this.cool = 6;
  }

  busy(p) { return this.acts.some((s) => s.a === p || s.b === p); }

  // start an interaction between a and b (b defaults to the nearest figure)
  start(a, b, kind = 'handshake', script = null) {
    const S = this.game.scene;
    if (!b) {
      let bd = 700;
      for (const o of S.actors) {
        if (o === a || !(o instanceof Puppet) || !o.isHumanoid || o.dead || o.removed || Math.abs(o.z - a.z) > 0.12) continue;
        const d = Math.abs(o.root.x - a.root.x);
        if (d < bd) { bd = d; b = o; }
      }
    }
    if (!b || !a.isHumanoid || !b.isHumanoid || a.dead || b.dead) return false;
    this.end(a); this.end(b);
    for (const p of [a, b]) {
      this.game.flies.find((f) => f.actor === p)?.release();
      if (p.mode !== 'planted') p.plantAt(p.root.x);
      p.stopAnim();
      p.controller = 'social';
    }
    if (Math.abs(b.z - a.z) > 0.005) b.setDepth(a.z);
    const gap = kind === 'hug' ? 0.32 : kind === 'sit' || kind === 'chat' ? 0.62 : kind === 'dance' ? 0.75 : 0.5;
    const dist = (a.height + b.height) * 0.5 * gap;
    this.acts.push({ a, b, kind, t: 0, phase: 'approach', dist, spoken: 0, script });
    return true;
  }

  end(p) {
    const i = this.acts.findIndex((s) => s.a === p || s.b === p);
    if (i < 0) return;
    const s = this.acts[i];
    for (const q of [s.a, s.b]) {
      if (q.controller === 'social') q.controller = null;
      if (q.anim && ['sit', 'talk', 'handshake', 'hug', 'dance', 'wai'].includes(q.anim.name)) q.stopAnim();
    }
    this.acts.splice(i, 1);
  }

  _face(p, x) {
    const want = Math.sign(x - p.root.x);
    if (want && want !== p.facing && p.flipAnim <= 0) p.flip();
  }

  update(dt) {
    const g = this.game;
    for (const s of [...this.acts]) {
      const { a, b } = s;
      if (a.removed || b.removed || a.dead || b.dead || a.mode === 'ragdoll' || b.mode === 'ragdoll' || a.controller !== 'social' || b.controller !== 'social') { this.end(a); continue; }
      s.t += dt;
      const mid = (a.target.x + b.target.x) / 2;
      const side = Math.sign(a.target.x - b.target.x) || -1;
      if (s.phase === 'approach') {
        // walk to the meeting spot (each moves half way)
        const ta = mid + side * s.dist / 2, tb = mid - side * s.dist / 2;
        let done = true;
        for (const [p, tx] of [[a, ta], [b, tb]]) {
          const d = tx - p.target.x;
          if (Math.abs(d) > 4) { done = false; p.target.x += Math.sign(d) * Math.min(Math.abs(d), 120 * dt); this._face(p, tx + Math.sign(d) * 50); }
        }
        if (done || s.t > 6) {
          this._face(a, b.root.x); this._face(b, a.root.x);
          s.phase = 'act'; s.t = 0;
          this._begin(s);
        }
        continue;
      }
      if (s.phase === 'act') this._act(s, dt);
    }
    // idle figures sometimes meet on their own
    this.cool -= dt;
    if (this.cool <= 0) {
      this.cool = 7 + Math.random() * 8;
      const idle = g.scene.actors.filter((p) => p instanceof Puppet && p.isHumanoid && !p.dead && !p.controller && p.mode === 'planted' && !p.anim && p !== g.selected && !this.busy(p));
      if (idle.length >= 2) {
        const a = idle[Math.floor(Math.random() * idle.length)];
        const near = idle.filter((o) => o !== a && Math.abs(o.root.x - a.root.x) < 520 && Math.abs(o.z - a.z) < 0.1);
        if (near.length) {
          const kinds = ['handshake', 'wai', 'chat', 'chat', 'highfive', 'sit'];
          this.start(a, near[0], kinds[Math.floor(Math.random() * kinds.length)]);
        }
      }
    }
  }

  _begin(s) {
    const { a, b, kind } = s;
    const say = (p, cat, force = true) => p.say(pick(LINES[cat]), 2.4, { force });
    if (kind === 'handshake') { a.play('handshake'); b.play('handshake'); say(a, 'greet'); s.reply = 1.3; }
    else if (kind === 'wai') {
      // polite particle by who is speaking: ครับ for men, ค่ะ for women
      const hello = (p) => { const per = this.game.minds?.of(p)?.p; return { th: 'สวัสดี' + (per ? per.polite || '' : isFemale(p) ? 'ค่ะ' : 'ครับ'), en: 'Sawasdee!' }; };
      a.play('wai'); setTimeout(() => !b.removed && b.play('wai'), 350);
      a.say(hello(a), 2, { force: true }); s.reply = 1.2; s.replyLine = hello(b);
    }
    else if (kind === 'hug') { a.play('hug'); b.play('hug'); say(a, 'hug'); }
    else if (kind === 'highfive') { a.play('highfive'); b.play('highfive'); setTimeout(() => !a.removed && say(b, 'five'), 600); }
    else if (kind === 'chat' || kind === 'sit') {
      if (kind === 'sit') { a.play('sit', { hold: true }); b.play('sit', { hold: true }); }
      else { a.play('talk', { loop: true }); b.play('talk', { loop: true }); }
      s.turn = 0; s.next = 0.6; s.lines = 0; s.maxLines = s.script ? s.script.length : 4 + Math.floor(Math.random() * 3);
    } else if (kind === 'dance') {
      const d = ['ram-theppranom', 'ram-sodsoi', 'dance', 'ram-chanee'][Math.floor(Math.random() * 4)];
      a.play(d, { loop: true }); b.play(d, { loop: true });
      s.until = 9;
    }
    this.game.audio?.sfx('chime', { vol: 0.25 });
  }

  _act(s, dt) {
    const { a, b, kind } = s;
    if (s.reply != null && s.t > s.reply) { b.say(s.replyLine || pick(LINES.reply), 2.4, { force: true }); s.reply = null; }
    // hands that actually meet
    const hf = (p) => p.bodies.handF;
    if ((kind === 'handshake' && s.t > 0.35 && s.t < 2.0) || (kind === 'highfive' && s.t > 0.35 && s.t < 0.75)) {
      const A = hf(a), B = hf(b);
      if (A && B) {
        const sa = a.root.toWorld(...a.handle), sb = b.root.toWorld(...b.handle);
        const up = kind === 'highfive' ? -Math.max(a.height, b.height) * 0.42 : Math.max(a.height, b.height) * 0.12;
        const pump = kind === 'handshake' ? Math.sin(s.t * 13) * 7 : 0;
        const tx = (sa[0] + sb[0]) / 2, ty = (sa[1] + sb[1]) / 2 + up + pump;
        for (const [p, h] of [[a, A], [b, B]]) {
          const ik = {};
          p.reach(h, [0, 0], tx, ty, { n: 3, into: ik, iters: 4 });
          p.ik = ik;
        }
      }
    }
    if (kind === 'hug' && s.t > 0.5 && s.t < 2) {
      const L = (p) => p.rig.limbs;
      for (const [p, o] of [[a, b], [b, a]]) {
        const ik = {};
        const [ox, oy] = o.root.toWorld(...o.handle);
        for (const k of ['handF', 'handB']) { const h = p.bodies[k]; if (h) p.reach(h, [0, 0], ox, oy + o.height * 0.05, { n: 3, into: ik, iters: 3 }); }
        if (L(p)) p.ik = ik;
      }
    }
    if (kind === 'chat' || kind === 'sit') {
      s.next -= dt;
      if (s.next <= 0) {
        const p = s.turn % 2 ? b : a;
        const other = p === a ? b : a;
        // a scripted AI dialogue (if one was written for this pair) comes first
        const scripted = s.script && s.script[s.lines];
        const ml = scripted || this.game.minds?.chatLine(p, other, s.lines, s.maxLines, s.prev);
        const cat = s.lines === 0 ? 'greet' : s.lines === s.maxLines - 1 ? 'bye' : s.lines % 3 === 2 ? 'laugh' : s.lines === 1 ? 'reply' : 'chat';
        const said = ml || pick(LINES[cat]);
        const speaker = scripted && scripted.who === 'b' ? b : scripted && scripted.who === 'a' ? a : p;
        if (speaker.say(said, 3, { force: true })) { s.prev = said; s.lines++; s.turn++; if (scripted?.action) speaker.play(scripted.action); }
        s.next = 2.8 + Math.random() * 0.8;
        if (cat === 'laugh' && Math.random() < 0.5) { (p === a ? b : a).play('laugh'); }
        if (s.lines >= s.maxLines) s.done = s.t + 2.5;
      }
      if (s.done && s.t > s.done) return this.end(a);
      return;
    }
    if (kind === 'dance') { if (s.t > s.until) this.end(a); return; }
    const dur = { handshake: 2.6, wai: 2.6, hug: 2.8, highfive: 1.6 }[kind] || 2.5;
    if (s.t > dur) {
      if (Math.random() < 0.5) a.say(pick(LINES.bye), 2, { force: true });
      this.end(a);
    }
  }
}
