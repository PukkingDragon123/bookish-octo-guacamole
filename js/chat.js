// คุยกับตัวละคร — talk to a puppet, and it answers in character.
//
// With Claude available in this view (the artifact's `sample` capability)
// the character's reply is written by Claude from its persona, its mood,
// its memories, how it feels about the others and what is on stage right
// now — and it can act on what it says (wave, wai, dance, fight back…).
// "ให้คุยกันเอง" asks Claude for a whole conversation between this
// character and the nearest one, which they then act out. Without Claude
// (offline zip, consent declined) the character's own mind answers.
// Claude is only ever asked when you press Send or the dialogue button.

import { Puppet } from './puppet/puppet.js';
import { nameOf } from './sandbox/minds.js';

const ACTIONS = ['none', 'wave', 'wai', 'bow', 'laugh', 'cheer', 'point', 'beckon', 'dance', 'ram-theppranom', 'sit', 'kneel', 'block', 'strike', 'roar', 'flee', 'hop', 'look-around'];
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  for (const c of kids) if (c) e.append(c);
  return e;
};

export class Chat {
  constructor(game) {
    this.game = game;
    this.actor = null;
    this.turns = new WeakMap(); // actor -> [{role, content}]
    this.sample = null;
    this.busy = false;
    globalThis.claude?.use?.('sample').then((s) => { this.sample = s; this._status(); }).catch(() => {});
    this._build();
  }

  _build() {
    this.el = el('div', { id: 'chatpanel', class: 'royal-panel hidden' });
    this.$head = el('div', { class: 'cp-head' });
    this.$log = el('div', { class: 'cp-log' });
    this.$in = el('input', { class: 'cp-in', type: 'text', placeholder: 'พิมพ์คุยกับตัวละคร… · say something', maxlength: '200' });
    this.$in.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.send(); });
    this.$send = el('button', { class: 'cp-send', title: 'ส่ง · Send', onclick: () => this.send(), html: 'ส่ง' });
    this.$duo = el('button', { class: 'cp-duo', title: 'ให้คุยกับตัวที่อยู่ใกล้ที่สุด · Let them talk to the nearest character', onclick: () => this.dialogue(), html: 'ให้คุยกันเอง <small>let them talk</small>' });
    this.$status = el('div', { class: 'cp-status' });
    this.el.append(
      el('button', { class: 'rp-x', title: 'ปิด · Close', onclick: () => this.close(), html: '×' }),
      this.$head, this.$log,
      el('div', { class: 'cp-row' }, this.$in, this.$send),
      el('div', { class: 'cp-row2' }, this.$duo, this.$status));
    this.game.root.querySelector('#ui').append(this.el);
  }

  _status() {
    this.$status.textContent = this.sample ? '✦ AI: Claude' : '✦ ใจของตัวละคร · local mind';
    this.$status.title = this.sample ? 'Replies are written by Claude, using your Claude usage' : 'Claude is not available here; the character\'s own mind answers';
  }

  open(a) {
    if (!(a instanceof Puppet)) return;
    this.actor = a;
    const m = this.game.minds.of(a);
    const mood = m.mood.fear > 0.5 ? 'กลัว 😨' : m.mood.anger > 0.5 ? 'โกรธ 😠' : m.mood.joy > 0.7 ? 'อารมณ์ดี 😊' : m.mood.joy < 0.3 ? 'เศร้า 😢' : 'สงบ 🙂';
    this.$head.innerHTML = `<b>${esc(m.p.name)}</b><small>${esc(m.p.th)} · ${mood}</small>`;
    this.$log.innerHTML = '';
    for (const t of this.turns.get(a) || []) this._bubble(t.role === 'user' ? 'me' : 'them', t.view || t.content);
    if (!(this.turns.get(a) || []).length) this._bubble('sys', 'ลองทักทาย ถามเรื่องที่เกิดขึ้น หรือขอให้รำให้ดูสิ · Say hi, ask what happened, or ask for a dance.');
    this._status();
    this.el.classList.remove('hidden');
    setTimeout(() => this.$in.focus(), 50);
  }

  close() { this.el.classList.add('hidden'); this.actor = null; }

  _bubble(who, text, en) {
    const b = el('div', { class: 'cp-b ' + who });
    b.textContent = text;
    if (en) b.append(el('small', {}, document.createTextNode(en)));
    this.$log.append(b);
    this.$log.scrollTop = 1e9;
    return b;
  }

  // what the stage looks like right now, for the prompt
  _scene() {
    const g = this.game, S = g.scene;
    const people = S.actors.filter((x) => x instanceof Puppet && !x.removed && !x.isPlant).map((x) => `${nameOf(x)}${x.dead ? ' (dead)' : x.dmg?.soul ? ' (has a soul)' : ''}${x.flyRole ? ' [' + x.flyRole + ']' : ''}`);
    return { onStage: people.slice(0, 14), weather: [...g.fx.weather], lamp: S.lamp.kind };
  }

  _prompt(m) {
    return `You are role-playing ONE character in a Thai shadow-puppet (หนังตะลุง) sandbox game, speaking to the player (the puppeteer deva above the stage). Stay fully in character: southern-Thai folk theatre flavour, warm, witty, short. Use your own pronouns (${m.p.self}/${m.p.you}) and polite particle "${m.p.polite || '-'}".
CHARACTER: ${JSON.stringify(m.brief())}
STAGE NOW: ${JSON.stringify(this._scene())}
Reply with ONLY a JSON object: {"th": "<your reply in Thai, max 25 words>", "en": "<short English translation>", "action": "<one of ${ACTIONS.join('|')}>", "mood": "<happy|sad|angry|scared|calm>", "feel": <number -1..1, how this exchange changed your liking of the player>}. React to what the player says and to your memories; if asked to do something you'd do, pick that action.`;
  }

  async send() {
    const a = this.actor, text = this.$in.value.trim();
    if (!a || !text || this.busy) return;
    this.$in.value = '';
    const turns = this.turns.get(a) || [];
    this.turns.set(a, turns);
    turns.push({ role: 'user', content: text, view: text });
    this._bubble('me', text);
    const m = this.game.minds.of(a);
    m.remember('player', null, `ผู้เชิดพูดว่า "${text.slice(0, 40)}"`, `the puppeteer said "${text.slice(0, 60)}"`, 1.2);
    let reply = null;
    if (this.sample) {
      this.busy = true;
      const wait = this._bubble('them thinking', '…');
      try {
        const hist = turns.slice(-10).map((t) => ({ role: t.role, content: t.content }));
        reply = await this.sample.json([{ role: 'user', content: this._prompt(m) }, ...hist], { modelTier: 'quick', cache: false });
      } catch (e) {
        if (e?.code === 'not_granted' || e?.code === 'sampling_disabled' || e?.code === 'not_declared' || e?.code === 'capability_disabled') { this.sample = null; this._status(); }
        reply = null;
      } finally { wait.remove(); this.busy = false; }
    }
    if (!reply || typeof reply.th !== 'string') reply = this._local(m, text);
    turns.push({ role: 'assistant', content: JSON.stringify(reply), view: reply.th });
    this._bubble('them', reply.th, reply.en);
    this._act(a, m, reply);
  }

  _act(a, m, r) {
    a.say({ th: String(r.th).slice(0, 120), en: String(r.en || '').slice(0, 160) }, 3.5, { force: true });
    const act = ACTIONS.includes(r.action) ? r.action : 'none';
    if (act !== 'none' && !a.dead) a.play(act, { loop: act.startsWith('ram') || act === 'dance' ? false : undefined, hold: act === 'sit' || act === 'kneel' });
    const M = m.mood;
    if (r.mood === 'happy') M.joy = Math.min(1, M.joy + 0.2);
    if (r.mood === 'sad') M.joy = Math.max(0, M.joy - 0.2);
    if (r.mood === 'angry') M.anger = Math.min(1, M.anger + 0.3);
    if (r.mood === 'scared') M.fear = Math.min(1, M.fear + 0.3);
    m.lonely = 0;
  }

  // the character's own mind when Claude isn't here
  _local(m, text) {
    const p = m.p, end = p.polite || '';
    const t = text.toLowerCase();
    const mem = m.recent()[0];
    const M = m.mood;
    const has = (...w) => w.some((x) => t.includes(x));
    for (const [o, r] of m.rel) {
      if (o.removed || !t.includes(String(nameOf(o)).slice(0, 3))) continue;
      const ev = m.recent().find((e) => e.who === o && (e.kind === 'hurt' || e.kind === 'saw-fight' || e.kind === 'death'));
      if (ev) return { th: ev.kind === 'hurt' ? `${nameOf(o)}ทำร้าย${p.self}${end} ยังเจ็บใจไม่หาย` : ev.kind === 'death' ? `${nameOf(o)}จากไปแล้ว...` : `${p.self}เห็นตอนที่${ev.th}`, en: ev.kind === 'hurt' ? `${nameOf(o)} hurt me — it still stings.` : ev.kind === 'death' ? `${nameOf(o)} is gone...` : `I saw it — ${ev.en}.`, action: ev.kind === 'hurt' ? (p.t.brave > 0.6 ? 'block' : 'flee') : 'none', mood: ev.kind === 'hurt' ? (p.t.brave > 0.6 ? 'angry' : 'scared') : 'sad' };
    }
    if (has('สวัสดี', 'hello', 'hi', 'หวัดดี')) return { th: `สวัสดี${end} ${p.self}คือ${p.name}`, en: `Hello! I'm ${p.name}.`, action: 'wai', mood: 'happy' };
    if (has('ชื่อ', 'name', 'ใคร', 'who')) return { th: `${p.self}ชื่อ${p.name} เป็น${p.th}ในโรงหนังนี้${end}`, en: `I'm ${p.name}, the ${p.th} of this troupe.`, action: 'bow', mood: 'calm' };
    if (has('รำ', 'dance')) return { th: p.t.proud > 0.8 && !p.female ? 'ข้าไม่รำหรอก! ...ก็ได้ ทีเดียวนะ' : `ได้เลย${end} ดูนะ`, en: p.t.proud > 0.8 && !p.female ? "I don't dance! ...fine, just once." : 'Sure — watch this.', action: 'ram-theppranom', mood: 'happy' };
    if (has('สู้', 'fight', 'ตี', 'attack')) return p.t.brave > 0.6 ? { th: 'มาเลย! ใครเป็นศัตรู ชี้มา', en: 'Bring it! Point me to the enemy.', action: 'strike', mood: 'angry' } : { th: 'อย่าเลย ข้ากลัว...', en: "Please no, I'm scared...", action: 'flee', mood: 'scared' };
    if (has('เป็นไง', 'สบายดี', 'how are', 'feel', 'รู้สึก')) {
      if (M.fear > 0.4) return { th: `ยังกลัวอยู่เลย${mem ? ' ตั้งแต่' + mem.th : ''}`, en: `Still scared${mem ? ' since ' + mem.en : ''}.`, action: 'look-around', mood: 'scared' };
      if (M.joy < 0.35) return { th: `ไม่ค่อยดีนัก${end} ${mem ? mem.th + ' ทำให้ใจหาย' : 'ใจมันเหงาๆ'}`, en: `Not great. ${mem ? mem.en + ' — it shook me.' : "I'm a bit lonely."}`, action: 'none', mood: 'sad' };
      return { th: `สบายดี${end} ขอบใจที่ถามนะ`, en: "I'm well, thanks for asking!", action: 'wave', mood: 'happy' };
    }
    if (has('เกิดอะไร', 'what happened', 'เรื่อง')) return mem ? { th: `เมื่อกี้${mem.th}ไง ยังจำได้ไม่ลืม`, en: `Just now ${mem.en} — I won't forget it.`, action: 'point', mood: 'calm' } : { th: 'ยังไม่มีอะไรเกิดขึ้นเลย เงียบสงบดี', en: 'Nothing much yet — all calm.', action: 'none', mood: 'calm' };
    for (const [o, r] of m.rel) if (!o.removed && t.includes(String(nameOf(o)).slice(0, 4))) return r.aff > 0.3 ? { th: `${nameOf(o)}น่ะเหรอ เป็นเพื่อนที่ดีที่สุดเลย`, en: `${nameOf(o)}? A dear friend.`, action: 'cheer', mood: 'happy' } : r.aff < -0.2 ? { th: `อย่าพูดถึง${nameOf(o)}เลย ${p.self}ไม่ชอบ`, en: `Don't mention ${nameOf(o)} — I don't like them.`, action: 'none', mood: 'angry' } : { th: `${nameOf(o)}เหรอ ยังไม่ค่อยรู้จักเท่าไหร่`, en: `${nameOf(o)}? I barely know them.`, action: 'none', mood: 'calm' };
    if (has('กิน', 'หิว', 'food', 'eat')) return { th: p.t.greedy ? 'พูดถึงของกินทำไม ท้องร้องเลย!' : 'ไปตลาดกันไหม มีลูกชิ้นปิ้ง', en: p.t.greedy ? "Why mention food? Now my belly's roaring!" : 'Shall we go to the market? Grilled meatballs!', action: 'laugh', mood: 'happy' };
    const q = p.quirk[Math.floor(Math.random() * p.quirk.length)];
    return { th: t.includes('?') || t.includes('ไหม') ? (p.t.wise > 0.8 ? 'คำถามที่ดี... คำตอบอยู่ในใจโยมแล้ว' : 'อืม ไม่รู้สิ แล้วเธอว่าไงล่ะ') : q[0], en: t.includes('?') || t.includes('ไหม') ? (p.t.wise > 0.8 ? 'A good question... the answer is already in your heart.' : 'Hmm, not sure — what do you think?') : q[1], action: p.t.funny > 0.7 ? 'laugh' : 'none', mood: 'calm' };
  }

  // a whole conversation between this character and the nearest one
  async dialogue() {
    const a = this.actor;
    if (!a || this.busy) return;
    const S = this.game.scene;
    let b = null, bd = 900;
    for (const o of S.actors) if (o !== a && o instanceof Puppet && o.isHumanoid && !o.dead && !o.removed) { const d = Math.abs(o.root.x - a.root.x); if (d < bd) { bd = d; b = o; } }
    if (!b) { this._bubble('sys', 'ไม่มีใครอยู่ใกล้ๆ เลย · nobody nearby to talk to'); return; }
    const ma = this.game.minds.of(a), mb = this.game.minds.of(b);
    let script = null;
    if (this.sample) {
      this.busy = true;
      const wait = this._bubble('sys thinking', `กำลังเขียนบทสนทนาระหว่าง ${ma.p.name} กับ ${mb.p.name}…`);
      try {
        const lines = await this.sample.json(`Write a short, lively conversation (6 lines, alternating, starting with A) between two characters in a Thai shadow-puppet (หนังตะลุง) sandbox, in character, reacting to their memories, their feelings about each other and what is on stage. Southern-Thai folk-theatre humour welcome; each line max 20 Thai words.
A: ${JSON.stringify(ma.brief())}
B: ${JSON.stringify(mb.brief())}
How A feels about B: ${JSON.stringify(ma.r(b))}; how B feels about A: ${JSON.stringify(mb.r(a))}
STAGE NOW: ${JSON.stringify(this._scene())}
Reply with ONLY a JSON array of 6 objects: {"who":"a"|"b","th":"<Thai line>","en":"<English>","action":"<one of ${ACTIONS.join('|')}>"}.`, { modelTier: 'quick', cache: false });
        if (Array.isArray(lines)) script = lines.filter((l) => l && typeof l.th === 'string').slice(0, 8).map((l) => ({ who: l.who === 'b' ? 'b' : 'a', th: l.th, en: l.en || '', action: ACTIONS.includes(l.action) && l.action !== 'none' ? l.action : null }));
      } catch (e) {
        if (e?.code === 'not_granted' || e?.code === 'sampling_disabled') { this.sample = null; this._status(); }
      } finally { wait.remove(); this.busy = false; }
    }
    if (script && script.length) for (const l of script) this._bubble(l.who === 'a' ? 'them' : 'other', `${l.who === 'a' ? ma.p.name : mb.p.name}: ${l.th}`, l.en);
    else this._bubble('sys', `${ma.p.name} เดินไปคุยกับ ${mb.p.name} · they head off to talk`);
    this.game.social.start(a, b, 'chat', script && script.length ? script : null);
  }
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
