// จิตใจ — every character has a mind of its own.
//
// A Mind holds who the character is (persona), how they feel right now
// (mood: happiness, fear, anger, energy), what they remember (episodic
// memories of what they saw and what happened to them, fading with time
// unless they were important), and how they feel about everyone else
// (affinity, fear, respect). Events on stage write memories and shift
// relationships; the mind then decides small things for itself — keep
// clear of someone who hurt it, go to a friend who is wounded, grieve the
// dead, get chatty when lonely — and, above all, talks about what
// actually happened, in its own voice, with replies that answer what the
// other one said.

import { Puppet } from '../puppet/puppet.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ---------------------------------------------------------------- personas
// traits 0..1: brave, kind, funny, proud, wise, greedy, chatty
const P = {
  phra: { th: 'พระเอก', polite: 'ครับ', self: 'ข้า', you: 'ท่าน', t: { brave: 0.9, kind: 0.7, funny: 0.2, proud: 0.6, wise: 0.5, chatty: 0.5 }, likes: ['ความยุติธรรม', 'นางเอก'], fears: ['ยักษ์'], quirk: [['ข้าจะปกป้องบ้านเมืองนี้', "I'll protect this land."], ['ดาบนี้มีไว้เพื่อคนที่อ่อนแอกว่า', 'This sword is for those weaker than me.']] },
  nang: { th: 'นางเอก', polite: 'ค่ะ', self: 'ฉัน', you: 'เธอ', female: true, t: { brave: 0.4, kind: 0.9, funny: 0.3, proud: 0.4, wise: 0.6, chatty: 0.7 }, likes: ['การร่ายรำ', 'ดอกไม้'], fears: ['ยักษ์', 'ไฟ'], quirk: [['ท่ารำนี้แม่สอนฉันตั้งแต่เด็ก', 'My mother taught me this dance as a child.'], ['คืนนี้จันทร์สวยเหมือนในนิทาน', "Tonight's moon is like a fairy tale."]] },
  yak: { th: 'ยักษ์', polite: '', self: 'ข้า', you: 'เจ้า', t: { brave: 0.8, kind: 0.1, funny: 0.3, proud: 0.95, wise: 0.2, chatty: 0.5 }, likes: ['การต่อสู้', 'ของกิน'], fears: ['หนุมาน'], quirk: [['ฮ่า! ใครกล้าขวางทางข้า', 'Ha! Who dares block my way?'], ['ข้าหิวจนท้องร้องแล้ว', "I'm so hungry my belly roars."]] },
  hanuman: { th: 'หนุมาน', polite: '', self: 'ข้า', you: 'เจ้า', t: { brave: 1, kind: 0.6, funny: 0.8, proud: 0.7, wise: 0.5, chatty: 0.7 }, likes: ['ผลไม้', 'การผจญภัย'], fears: [], quirk: [['ข้าหาวเป็นดาวเป็นเดือนได้นะ รู้ไหม', 'I can yawn out stars and moons, you know.'], ['กระโดดทีเดียวข้ามทะเลได้สบาย', 'One leap and I cross the sea.']] },
  thewada: { th: 'เทวดา', polite: '', self: 'เรา', you: 'ท่าน', t: { brave: 0.6, kind: 0.9, funny: 0.2, proud: 0.4, wise: 0.95, chatty: 0.4 }, likes: ['ความสงบ', 'บุญ'], fears: [], quirk: [['ทุกสิ่งล้วนไม่เที่ยง', 'All things pass.'], ['ความเมตตาคือดาบที่คมที่สุด', 'Kindness is the sharpest sword.']] },
  reusi: { th: 'ฤๅษี', polite: '', self: 'อาตมา', you: 'โยม', t: { brave: 0.5, kind: 0.8, funny: 0.4, proud: 0.2, wise: 1, chatty: 0.5 }, likes: ['สมาธิ', 'สมุนไพร'], fears: [], quirk: [['ใจที่สงบ เห็นทุกสิ่งชัดเจน', 'A calm mind sees everything clearly.'], ['สมุนไพรต้นนี้แก้ได้ร้อยโรค', 'This herb cures a hundred ills.']] },
  teng: { th: 'ไอ้เท่ง', polite: 'หู้', self: 'ข้า', you: 'เอ็ง', t: { brave: 0.5, kind: 0.5, funny: 1, proud: 0.5, wise: 0.4, chatty: 0.9 }, likes: ['เรื่องตลก', 'เหล้าขาว'], fears: ['เมีย'], quirk: [['นิ้วข้างอเพราะชี้คนผิดมาทั้งชีวิต', 'My finger bent from pointing at the wrong people all my life.'], ['หรอยจังหู้!', 'Delicious, I tell you!']] },
  nunui: { th: 'หนูนุ้ย', polite: 'หู้', self: 'ข้า', you: 'เอ็ง', t: { brave: 0.3, kind: 0.6, funny: 0.9, proud: 0.3, wise: 0.3, chatty: 0.9 }, likes: ['ข้าวเหนียว', 'การนอน'], fears: ['ผี'], quirk: [['ท้องข้าใหญ่เพราะเก็บความลับไว้เยอะ', 'My belly is big from keeping secrets.']] },
  yodthong: { th: 'ยอดทอง', polite: 'ครับ', self: 'กระผม', you: 'คุณ', t: { brave: 0.2, kind: 0.4, funny: 0.8, proud: 0.9, wise: 0.3, chatty: 0.8 }, likes: ['ทองคำ', 'คำชม'], fears: ['การทำงาน'], quirk: [['กระผมนี่หล่อที่สุดในหมู่บ้าน', "I'm the handsomest man in the village."]] },
  samor: { th: 'สะหม้อ', polite: '', self: 'ข้า', you: 'เอ็ง', t: { brave: 0.4, kind: 0.4, funny: 0.6, proud: 0.5, wise: 0.6, chatty: 0.6 }, likes: ['ความเงียบ'], fears: ['เสียงดัง'], quirk: [['สมัยข้าหนุ่มๆ ไม่เห็นวุ่นวายแบบนี้', "In my young days it wasn't this chaotic."]] },
  srikaew: { th: 'ศรีแก้ว', polite: 'หู้', self: 'ข้า', you: 'เอ็ง', t: { brave: 0.3, kind: 0.6, funny: 0.8, proud: 0.3, wise: 0.2, greedy: 1, chatty: 0.7 }, likes: ['ของกินทุกชนิด'], fears: ['ความหิว'], quirk: [['มีอะไรกินบ้างไหม', 'Anything to eat around here?']] },
  khwanmuang: { th: 'ขวัญเมือง', polite: 'หู้', self: 'ข้า', you: 'เอ็ง', t: { brave: 0.5, kind: 0.5, funny: 0.9, proud: 0.4, wise: 0.7, chatty: 0.8 }, likes: ['การเถียง'], fears: [], quirk: [['ปากข้ายาวแต่ใจข้าดีนะ', 'Long mouth, kind heart.']] },
  phuyaiphoon: { th: 'ผู้ใหญ่พูน', polite: 'ครับ', self: 'ผม', you: 'พ่อหนุ่ม', t: { brave: 0.5, kind: 0.7, funny: 0.4, proud: 0.6, wise: 0.6, chatty: 0.7 }, likes: ['หมู่บ้าน', 'การประชุม'], fears: ['ความวุ่นวาย'], quirk: [['เดี๋ยวผมจะเรียกประชุมลูกบ้าน', "I'll call a village meeting."]] },
  aitho: { th: 'ไอ้โถ', polite: '', self: 'ข้า', you: 'เอ็ง', t: { brave: 0.3, kind: 0.6, funny: 0.7, proud: 0.3, wise: 0.2, chatty: 0.6 }, likes: ['การวิ่ง'], fears: ['ยักษ์', 'หมา'], quirk: [['วิ่งไวเท่านี้ไม่มีใครจับข้าได้', 'Nobody can catch me running this fast.']] },
  dek: { th: 'เด็ก', polite: 'ฮะ', self: 'หนู', you: 'พี่', t: { brave: 0.3, kind: 0.8, funny: 0.7, proud: 0.1, wise: 0.1, chatty: 0.8 }, likes: ['หมูเด้ง', 'ขนม'], fears: ['ยักษ์', 'ผี'], quirk: [['หนูอยากเลี้ยงหมูเด้งที่บ้าน', 'I want to keep Moo Deng at home!']] },
};
const DEFAULT = { th: 'ชาวบ้าน', polite: 'จ้ะ', self: 'ฉัน', you: 'เธอ', t: { brave: 0.4, kind: 0.6, funny: 0.5, proud: 0.4, wise: 0.4, chatty: 0.6 }, likes: ['ตลาด'], fears: ['ยักษ์'], quirk: [['ปีนี้ข้าวงามดีนะ', 'The rice is good this year.']] };

export function personaOf(a) {
  const id = a.def?.id || a.rig?.id || '';
  const key = Object.keys(P).find((k) => id === k || id.startsWith(k));
  const base = P[key] || DEFAULT;
  const female = base.female || /female/.test(a.rig?.voice || '') || /woman|nang/.test(id);
  return { ...base, id, name: a.def?.name || a.rig?.name || base.th, female, polite: base.polite === 'ครับ' && female ? 'ค่ะ' : base.polite };
}

// ---------------------------------------------------------------- Mind
export class Mind {
  constructor(actor) {
    this.a = actor;
    this.p = personaOf(actor);
    this.mood = { joy: 0.55, fear: 0, anger: 0, energy: 0.8 };
    this.mem = [];     // {t, kind, who, other, th, en, w}
    this.rel = new Map(); // other actor -> {aff, fear, respect, met}
    this.goal = null;
    this.cool = 3 + Math.random() * 4;
    this.lonely = Math.random() * 0.4;
  }

  r(o) {
    let v = this.rel.get(o);
    if (!v) { v = { aff: 0.1 + (o.isAnimal ? 0.2 : 0), fear: 0, respect: 0.3, met: 0 }; this.rel.set(o, v); }
    return v;
  }

  remember(kind, o, th, en, w = 1) {
    this.mem.push({ t: performance.now() / 1000, kind, who: o, th, en, w });
    if (this.mem.length > 24) this.mem.sort((x, y) => y.w - x.w).length = 18;
  }

  recent(kind) {
    const now = performance.now() / 1000;
    // most important first, fresher breaking ties
    return this.mem.filter((m) => (!kind || m.kind === kind) && now - m.t < 240 * m.w).sort((x, y) => (y.w - x.w) || (y.t - x.t));
  }

  // a compact description for an AI prompt
  brief() {
    const m = this.mood;
    const feel = m.fear > 0.5 ? 'scared' : m.anger > 0.5 ? 'angry' : m.joy > 0.7 ? 'happy' : m.joy < 0.3 ? 'sad' : 'calm';
    const rels = [...this.rel.entries()].filter(([o]) => !o.removed).map(([o, v]) => `${nameOf(o)}: ${v.aff > 0.4 ? 'friend' : v.aff < -0.3 ? 'enemy' : 'acquaintance'}${v.fear > 0.4 ? ', afraid of them' : ''}`).slice(0, 6);
    return { name: this.p.name, role: this.p.th, traits: this.p.t, mood: feel, hurt: !!this.a.dmg?.lost, likes: this.p.likes, fears: this.p.fears, memories: this.recent().slice(0, 6).map((m) => m.en), relations: rels };
  }
}

export const nameOf = (a) => a?.def?.name || a?.rig?.name || (a?.isAnimal ? 'สัตว์' : 'ใครบางคน');

// ---------------------------------------------------------------- Minds
export class Minds {
  constructor(game) {
    this.game = game;
    this.map = new Map();
    this.t = 0;
    const S = game.scene;
    S.on('hit', (h) => this._hit(h));
    S.on('added', (a) => { if (a instanceof Puppet) queueMicrotask(() => { if (!a.isAnimal && !a.isPlant && !a.removed) this._arrive(a); }); });
    this._weather = '';
  }

  of(a) {
    if (!(a instanceof Puppet) || a.isPlant) return null;
    let m = this.map.get(a);
    if (!m) { m = new Mind(a); this.map.set(a, m); }
    return m;
  }

  _people() { return this.game.scene.actors.filter((a) => a instanceof Puppet && !a.isAnimal && !a.removed && !a.isPlant); }

  _arrive(a) {
    const m = this.of(a);
    for (const o of this._people()) {
      if (o === a) continue;
      const mo = this.of(o);
      mo.remember('arrive', a, `${nameOf(a)}มาถึงเวที`, `${nameOf(a)} arrived`, 0.6);
      // natural sympathies: heroes vs demons
      const enemy = (x, y) => /yak/.test(x.def?.id || '') && /phra|nang|hanuman|thewada/.test(y.def?.id || '');
      if (enemy(a, o) || enemy(o, a)) { m.r(o).aff = -0.5; mo.r(a).aff = -0.5; mo.r(a).fear = mo.p.t.brave < 0.5 ? 0.5 : 0.1; }
    }
  }

  _hit(h) {
    const A = h.attacker, T = h.target;
    if (!(T instanceof Puppet)) return;
    const mt = this.of(T);
    if (mt && A) {
      const v = mt.r(A);
      v.aff -= 0.35; v.fear += 0.25 * (1 - mt.p.t.brave); v.met++;
      mt.mood.anger = clamp(mt.mood.anger + 0.3 * mt.p.t.brave, 0, 1);
      mt.mood.fear = clamp(mt.mood.fear + 0.3 * (1 - mt.p.t.brave), 0, 1);
      mt.mood.joy = clamp(mt.mood.joy - 0.2, 0, 1);
      mt.remember('hurt', A, `${nameOf(A)}ทำร้ายฉัน`, `${nameOf(A)} hit me`, 1.6);
    }
    // witnesses
    for (const o of this._people()) {
      if (o === T || o === A) continue;
      if (Math.abs(o.root.x - T.root.x) > 900) continue;
      const mo = this.of(o);
      mo.remember('saw-fight', A, `เห็น${nameOf(A)}ตี${nameOf(T)}`, `saw ${nameOf(A)} strike ${nameOf(T)}`, 1);
      if (A) { const friend = mo.r(T).aff > 0.3; mo.r(A).aff -= friend ? 0.25 : 0.05; if (friend) mo.mood.anger = clamp(mo.mood.anger + 0.2, 0, 1); }
      mo.mood.fear = clamp(mo.mood.fear + 0.08 * (1 - mo.p.t.brave), 0, 1);
    }
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    this.t += dt;
    const g = this.game, S = g.scene;
    const people = this._people();
    // weather memories
    const w = [...g.fx.weather].sort().join(',');
    if (w !== this._weather) {
      this._weather = w;
      const th = w.includes('storm') ? 'พายุเข้า' : w.includes('rain') ? 'ฝนตก' : w.includes('night') ? 'ตกค่ำแล้ว' : w.includes('flood') ? 'น้ำท่วม' : '';
      if (th) for (const p of people) this.of(p).remember('weather', null, th, th === 'พายุเข้า' ? 'a storm came' : th === 'ฝนตก' ? 'it started raining' : th === 'น้ำท่วม' ? 'a flood came' : 'night fell', 0.8);
    }
    for (const a of people) {
      const m = this.of(a);
      // mood drifts back to the character's nature
      const M = m.mood;
      M.fear += (0 - M.fear) * dt * 0.05;
      M.anger += (0 - M.anger) * dt * 0.04;
      M.joy += (0.5 + 0.2 * m.p.t.funny - M.joy) * dt * 0.03;
      if (a.anim && (a.anim.name || '').startsWith('ram')) M.joy = Math.min(1, M.joy + dt * 0.05);
      m.lonely = Math.min(1, m.lonely + dt * 0.012 * (0.5 + m.p.t.chatty));
      // deaths become memories for everyone who cared
      if (a.dead && !m._mourned) {
        m._mourned = true;
        for (const o of people) if (o !== a) { const mo = this.of(o); const aff = mo.r(a).aff; mo.remember('death', a, `${nameOf(a)}ตายแล้ว`, `${nameOf(a)} died`, 2); mo.mood.joy = clamp(mo.mood.joy - (aff > 0 ? 0.5 : 0.05), 0, 1); }
      }
      if (a.dead || a.controller || a.mode !== 'planted' || g.selected === a && (g.drag || g.walkTo)) continue;
      m.cool -= dt;
      if (m.cool > 0) continue;
      m.cool = 3 + Math.random() * 5;
      this._decide(a, m, people);
    }
  }

  // small decisions of a free mind
  _decide(a, m, people) {
    const g = this.game;
    const near = people.filter((o) => o !== a && !o.dead && Math.abs(o.root.x - a.root.x) < 600 && Math.abs(o.z - a.z) < 0.15);
    // 1. keep clear of someone feared
    const scary = near.find((o) => m.r(o).fear > 0.35 && Math.abs(o.root.x - a.root.x) < 350);
    if (scary) {
      a.target.x = Math.max(80, a.target.x - Math.sign(scary.root.x - a.root.x) * 220);
      a.say(this.line(m, 'afraid', scary), 2.4);
      return;
    }
    // 2. a hurt friend: go to them and comfort
    const hurt = people.find((o) => o !== a && (o.dmg?.lost > 20 || o.dead) && m.r(o).aff > 0.2 && Math.abs(o.root.x - a.root.x) < 900);
    if (hurt && Math.random() < 0.7) {
      a.target.x = hurt.root.x - Math.sign(hurt.root.x - a.root.x) * 120;
      if (hurt.dead) { a.play('kneel', { hold: true }); a.say(this.line(m, 'grief', hurt), 3, { force: true }); }
      else a.say(this.line(m, 'comfort', hurt), 2.6);
      return;
    }
    // 3. lonely and someone friendly nearby: start a conversation
    const friendly = near.filter((o) => !o.controller && m.r(o).aff > -0.2 && !g.social?.busy(o)).sort((x, y) => m.r(y).aff - m.r(x).aff)[0];
    if (friendly && m.lonely > 0.45 && !g.social?.busy(a)) {
      m.lonely = 0;
      const aff = m.r(friendly).aff;
      const kind = aff > 0.5 ? pick(['chat', 'sit', 'hug', 'highfive']) : aff > 0.15 ? pick(['chat', 'handshake', 'wai']) : pick(['wai', 'chat']);
      g.social?.start(a, friendly, kind);
      return;
    }
    // 4. otherwise a thought aloud now and then
    if (Math.random() < 0.25 * m.p.t.chatty) a.say(this.line(m, 'muse'), 2.6);
  }

  // ------------------------------------------------------------ language
  // A line in this character's voice about something real.
  line(m, intent, o = null) {
    const p = m.p, end = p.polite || '';
    const nm = o ? nameOf(o) : '';
    const mem = m.recent()[0];
    const L = {
      afraid: [[`อย่าเข้ามาใกล้นะ${nm}!`, `Stay away, ${nm}!`], [`${p.self}ยังจำได้ว่า${nm}ทำอะไรไว้`, `I remember what ${nm} did.`]],
      grief: [[`ไม่นะ... ${nm} ตื่นสิ`, `No... ${nm}, wake up.`], [`${p.self}จะไม่ลืม${nm}เลย`, `I'll never forget ${nm}.`]],
      comfort: [[`${nm} เจ็บมากไหม${end}`, `${nm}, does it hurt much?`], [`พักก่อนนะ ${p.self}อยู่ตรงนี้`, `Rest — I'm right here.`]],
      muse: [
        mem ? [`ยังคิดถึงตอนที่${mem.th}อยู่เลย`, `Still thinking about when ${mem.en}.`] : null,
        ...p.quirk,
        p.t.wise > 0.8 ? ['ความสงบอยู่ในใจเรา ไม่ได้อยู่ข้างนอก', 'Peace lives inside us, not outside.'] : null,
        p.t.greedy ? ['ได้กลิ่นลูกชิ้นปิ้งลอยมา...', 'I smell grilled meatballs...'] : null,
      ].filter(Boolean),
    }[intent] || p.quirk;
    const [th, en] = pick(L);
    return { th, en };
  }

  // One turn of a conversation between a and b: opening, then replies
  // that react to what was said, about shared memories and the scene.
  chatLine(a, b, turn, total, prev) {
    const ma = this.of(a), mb = this.of(b);
    if (!ma || !mb) return null;
    const p = ma.p, end = p.polite || '';
    const rel = ma.r(b), nm = nameOf(b);
    rel.met++;
    if (turn === 0) {
      const opens = rel.aff > 0.5 ? [[`${nm}! คิดถึงจังเลย`, `${nm}! I missed you!`]] : rel.aff < -0.2 ? [[`มีธุระอะไรกับ${p.self}${end}`, `What do you want with me?`]] : [[`สวัสดี${end} ${nm}`, `Hello, ${nm}.`], [`ไปไหนมาจ๊ะ ${nm}`, `Where have you been, ${nm}?`]];
      return { ...pickL(opens), topic: this._topic(ma, mb) };
    }
    if (turn === total - 1) {
      const byes = rel.aff > 0.3 ? [['ไว้เจอกันใหม่นะ ดูแลตัวเองด้วย', 'See you again — take care.']] : [['เอาล่ะ ไปก่อนนะ', 'Right, off I go.']];
      rel.aff = clamp(rel.aff + 0.12, -1, 1);
      return pickL(byes);
    }
    const topic = prev?.topic || this._topic(ma, mb);
    // reply to the previous line if it asked something
    if (prev && prev.ask) {
      const agree = rel.aff + p.t.kind * 0.5 > 0.4;
      return { ...pickL(agree ? [[`ใช่เลย ${p.self}ก็คิดอย่างนั้น`, 'Exactly — I think so too.'], ['จริงด้วย ไม่เคยคิดมาก่อนเลย', "True, I'd never thought of it."]] : [['ไม่หรอก ' + p.self + 'ว่าไม่ใช่', "Nah, I don't think so."], ['เอ็งพูดเกินไปแล้ว', "You're exaggerating."]]), topic };
    }
    return { ...this._onTopic(ma, mb, topic), topic };
  }

  _topic(ma, mb) {
    // something both of them lived through, the weightiest first (arrivals only as a last resort)
    const mine = ma.recent().filter((m) => m.kind !== 'arrive' && m.kind !== 'player');
    const shared = mine.find((m) => mb.recent().some((n) => n.who === m.who && n.kind !== 'arrive')) || (Math.random() < 0.3 && ma.recent().find((m) => m.kind === 'arrive'));
    if (shared) return { kind: 'memory', m: shared };
    const third = [...ma.rel.entries()].filter(([o]) => o !== mb.a && !o.removed).sort((x, y) => Math.abs(y[1].aff) - Math.abs(x[1].aff))[0];
    if (third && Math.random() < 0.5) return { kind: 'gossip', o: third[0], aff: third[1].aff };
    const S = this.game.scene;
    if (S.actors.some((x) => x.def?.id === 'moo-deng')) return { kind: 'moodeng' };
    if (this.game.fx.weather.size) return { kind: 'weather' };
    return { kind: pick(['show', 'food', 'life']) };
  }

  _onTopic(ma, mb, T) {
    const p = ma.p, end = p.polite || '';
    switch (T.kind) {
      case 'memory': {
        const m = T.m;
        if (m.kind === 'hurt' || m.kind === 'saw-fight') return pickL([[`เห็นไหมตอนที่${m.th}`, `Did you see when ${m.en}?`, 1], [`${p.self}ยังใจสั่นอยู่เลยกับเรื่อง${m.th}`, `My heart still pounds about it — ${m.en}.`], [p.t.brave > 0.7 ? 'ถ้ามาอีก ข้าจะสู้เอง!' : 'ถ้ามาอีก วิ่งเลยนะ', p.t.brave > 0.7 ? "If it comes again, I'll fight!" : 'If it comes again, we run!']]);
        if (m.kind === 'death') return pickL([[`${nameOf(m.who)}... ${p.self}ยังไม่อยากเชื่อเลย`, `${nameOf(m.who)}... I still can't believe it.`], ['ชีวิตนี้สั้นนัก', 'Life is so short.', 1]]);
        if (m.kind === 'weather') return pickL([[`${m.th}แบบนี้ ระวังเปียกนะ`, `${m.en} — careful not to get soaked.`], ['ฟ้าฝนแบบนี้ คิดถึงบ้านจัง', 'Weather like this makes me homesick.', 1]]);
        return pickL([[`จำตอนที่${m.th}ได้ไหม`, `Remember when ${m.en}?`, 1]]);
      }
      case 'gossip': {
        const n = nameOf(T.o);
        return T.aff < 0 ? pickL([[`${n}น่ะ ${p.self}ไม่ไว้ใจเลย`, `I don't trust ${n} one bit.`, 1], [`ระวัง${n}ไว้นะ`, `Watch out for ${n}.`]]) : pickL([[`${n}เป็นคนดีนะ ว่าไหม`, `${n} is a good soul, don't you think?`, 1], [`${p.self}ชอบ${n}มาก`, `I really like ${n}.`]]);
      }
      case 'moodeng': return pickL([['หมูเด้งน่ารักจนอยากหยิกแก้ม', 'Moo Deng is so cute I want to pinch her cheeks.', 1], ['ระวังนะ หมูเด้งงับขาแล้วเจ็บมาก', 'Careful, Moo Deng bites ankles hard!']]);
      case 'weather': return pickL([['อากาศแบบนี้ เหมาะกับนั่งกินข้าวต้มร้อนๆ', 'Perfect weather for hot rice soup.', 1], ['เทวดาบนฟ้าคงอารมณ์ไม่ดี', 'The gods up there must be in a mood.']]);
      case 'food': return pickL([[p.t.greedy ? 'หิวอีกแล้ว ไปหาอะไรกินกัน' : 'ตลาดคืนนี้มีขนมครกนะ', p.t.greedy ? 'Hungry again — let\'s find food.' : 'The market has khanom krok tonight.', 1], ['ส้มตำร้านป้าแม่นหรอยจัง', "Auntie's som tam is delicious."]]);
      case 'life': return pickL([['เคยคิดไหมว่าเราเป็นแค่เงาบนผ้า', 'Ever think we\'re just shadows on a cloth?', 1], [`${p.self}อยากออกไปเห็นโลกกว้าง`, 'I want to see the wide world.'], ...p.quirk.map((q) => [q[0], q[1]])]);
      default: return pickL([['หนังตะลุงคืนนี้สนุกนะ', "Tonight's show is fun.", 1], ['นายหนังเชิดเก่งจริงๆ', 'The puppeteer is so skilled.']]);
    }
  }
}

const _said = new Set();
function pickL(list) {
  let l = pick(list);
  for (let i = 0; i < 4 && _said.has(l[0]); i++) l = pick(list);
  _said.add(l[0]); if (_said.size > 40) _said.clear();
  return { th: l[0], en: l[1], ask: !!l[2] };
}
