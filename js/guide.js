// คำแนะนำปุ่ม — น้องเมฆ explains every button the first time you press it.
//
// The press still does its job; she flies over, points at the button and
// says what it is for, in Thai with a small English line. After the first
// explanation (and every few after that) she asks whether you'd like her
// to keep explaining or to stop. Turned off, she stays away until you ask
// for her again from the help button (?).

import { state, save } from './tutorial.js';

// What each control does (Thai first, English small).
const G = {
  'b-house': ['หีบหนัง! ข้างในมีตัวหนัง พร็อพ สัตว์ เวทมนตร์ และฉากสำเร็จรูป ลากออกมาวางบนจอได้เลย แตะ ⓘ เพื่ออ่านรายละเอียด', 'The puppet chest: drag anything out onto the cloth. Tap ⓘ on an item to read about it.'],
  'b-hand': ['เปิดกล้องให้มือของเธอเชิดหนังจริง ๆ กำมือ = ฟัน ชี้ = แทง จีบ = รำ', 'Hand tracking: your real hand works the strings. Fist strikes, point lunges, จีบ dances.'],
  'b-demo': ['มือจำลองจะเชิดให้ดูเป็นตัวอย่าง ไม่ต้องใช้กล้อง', 'A simulated hand demonstrates every pose — no camera needed.'],
  'b-lamp': ['สลับตะเกียงน้ำมันกับหลอดไฟ กด Alt แล้วลากจุดสว่างเพื่อย้ายแสง เงาจะเปลี่ยนตาม', 'Swap oil lamp / bulb. Alt-drag the bright spot to move the light; every shadow follows.'],
  'b-pad': ['ปุ่มบังคับแบบเกม จอยเดิน ปุ่มดาบโจมตี วงล้อเลือกท่าและอาวุธ', 'Game pad: joystick to walk, sword to strike, wheels for moves and weapons.'],
  'b-edit': ['ไทม์ไลน์ตัดต่อ อัดการแสดง ตัด ต่อ เรียงคลิป แล้วส่งออกเป็นวิดีโอ', 'Timeline editor: record takes, cut, arrange and export a video.'],
  'b-show': ['โหมดแสดง ซ่อนปุ่มทั้งหมดให้เหลือแต่จอหนัง เหมาะกับการเล่นให้คนดู', 'Show mode hides the controls so only the shadow play is left.'],
  'b-sound': ['เปิด/ปิดเสียงดนตรีและเสียงพากย์', 'Sound and music on / off.'],
  'b-clear': ['ล้างเวที เก็บทุกอย่างกลับเข้าหีบ ระวังนะ!', 'Clear the stage — everything goes back in the chest!'],
  'b-help': ['ตารางวิธีเล่นและคีย์ลัดทั้งหมด', 'How to play, with every shortcut.'],
  'b-cam': ['กล้อง กดสลับ อิสระ → ติดตามตัวที่เลือก → กล้องภาพยนตร์ที่จับฉากต่อสู้ให้อัตโนมัติ (ปุ่ม C)', 'Camera: free → follow → cinematic fight camera (key C).'],
  'b-build': ['โหมดก่อสร้าง มีตาราง ช่วยวาง หมุน ย่อ ขยาย และจัดชั้นของพร็อพ (ปุ่ม B)', 'Build mode: grid, snap, rotate, resize and layer props (key B).'],
  'b-stage': ['ขนาดเวที กดสลับ ยาว 1–4 เท่า หรือให้เวทีขยายเองเวลามีคนเดินหรือต่อสู้ไปสุดขอบ กล้องจะเลื่อนตามให้', 'Stage size: 1–4× long, or let it grow by itself when someone walks or fights past the end; the view scrolls along.'],
  'b-book': ['สมุดข่อยของฉัน มีคู่มือทุกอย่างและรายการภารกิจที่ปลดล็อกของใหม่', 'My folding book: the full manual and the quests that unlock new things.'],
};
// side-ring / pad / timeline buttons, recognised by their tooltip text
const BY_TITLE = [
  [/กลับตัว/, ['หันตัวหนังกลับอีกด้าน (ปุ่ม F หรือคลิกขวา)', 'Turn the puppet around (F or right-click).']],
  [/^ท่า/, ['เปิดสมุดท่า เลือกท่าต่อสู้ ท่ารำ การทักทาย และอิริยาบถ แต่ละท่ามีคำอธิบาย', 'Opens the move book: fights, dances, greetings and postures, each described.']],
  [/เทวดาเชิด/, ['มอบตัวหนังให้เทวดาเชิดแทน เลือกบทบาท เช่น นักดาบ นางรำ แม่ค้า', 'Give the puppet to a deva and pick a role — fighter, dancer, merchant…']],
  [/ทักทายกัน/, ['ให้ตัวนี้ไปทักทายตัวที่อยู่ใกล้ที่สุด จับมือ ไหว้ กอด แปะมือ คุย หรือรำคู่', 'Meet the nearest puppet: handshake, wai, hug, high-five, chat or dance together.']],
  [/วิญญาณ/, ['ปลุกเสกให้มีชีวิต มีเลือดเนื้อ เจ็บได้ ร้องไห้ได้ และตายได้', 'Give it a soul: it bleeds, weeps and can die.']],
  [/ลงยันต์/, ['ยันต์คุ้มกัน ช่วยรับดาบไว้จนกว่าพลังจะหมด', 'A yantra ward that soaks up blows until its power runs out.']],
  [/ชุบชีวิต/, ['รักษาแผล เย็บแขนขาที่ขาดกลับคืน และชุบชีวิตคนที่ตายแล้ว', 'Heal wounds, stitch torn limbs back and revive the dead.']],
  [/ตรึง/, ['ตรึงไว้กลางอากาศ ไม่ขยับจนกว่าจะปลด', 'Freeze it in mid-air until released.']],
  [/ท่าเดิม/, ['คืนท่าที่จัดด้วยมือกลับเป็นท่ายืนปกติ', 'Undo the pose you set by hand.']],
  [/เก็บ/, ['เก็บกลับเข้าหีบ (ปุ่ม Delete)', 'Put it back in the chest (Delete).']],
  [/ระยะจากจอ|Distance/, ['เลื่อนเข้าหาตะเกียงเงาจะใหญ่และเบลอ เลื่อนชิดจอเงาจะคม', 'Toward the lamp the shadow grows and blurs; against the cloth it sharpens.']],
];

export class Guide {
  constructor(game) {
    this.game = game;
    this.count = 0;
    state.guideSeen ||= {};
    document.addEventListener('click', (e) => this._onClick(e), true);
  }

  get tut() { return this.game.tutorial; }
  get off() { return !!state.guideOff; }

  _key(el) {
    if (el.id) return el.id;
    const t = el.getAttribute('title') || el.getAttribute('aria-label') || '';
    return t ? 't:' + t.split('·')[0].trim() : null;
  }

  _text(el) {
    if (el.id && G[el.id]) return G[el.id];
    const t = el.getAttribute('title') || el.getAttribute('aria-label') || '';
    for (const [re, v] of BY_TITLE) if (re.test(t)) return v;
    if (!t) return null;
    const [th, en] = t.split('·').map((x) => x.trim());
    return [th + ' — ลองกดดูสิ', en || ''];
  }

  _onClick(e) {
    const el = e.target.closest?.('button, .medal, input[type=range]');
    const T = this.tut;
    if (!el || !T || T.running) return;
    if (el.classList.contains('tab') || el.classList.contains('mini') || el.classList.contains('info-btn') || el.classList.contains('rp-card') || el.classList.contains('rp-tab')) return;
    if (el.closest('#tut, .tut-box, #book, .book, #infocard, #movepanel')) return; // her own UI and panels
    if (el.id === 'b-help' && this.off) { setTimeout(() => this._askBack(), 50); return; }
    if (this.off) return;
    const key = this._key(el);
    if (!key || state.guideSeen[key]) return;
    const txt = this._text(el);
    if (!txt) return;
    state.guideSeen[key] = 1;
    save();
    this.count++;
    // let the button do its thing first, then explain it
    setTimeout(() => this._explain(el, txt), 120);
  }

  async _explain(el, [th, en]) {
    const T = this.tut;
    if (!T || T.running || T.pending) return;
    const first = this.count === 1, every = this.count % 6 === 0;
    if (first || every) {
      T._show({ th, en, next: false, point: { el }, pose: 'point', sfx: 'sparkle' });
      await T.wait(Math.min(5, 1.6 + th.length * 0.05)).catch(() => {});
      if (T.running) return;
      const i = await T.ask(first ? 'ให้ฉันคอยอธิบายทุกปุ่มที่กดครั้งแรกไหมจ๊ะ?' : 'ยังอยากให้ฉันอธิบายปุ่มอยู่ไหม?', first ? 'Shall I explain every button the first time you press it?' : 'Still want me explaining buttons?',
        [['อธิบายต่อเลย', 'Yes, keep explaining'], ['ปิดคำแนะนำ', 'Turn the guide off']]).catch(() => 0);
      if (i === 1) {
        state.guideOff = true; save();
        T.quip('ได้จ้า ถ้าอยากให้ฉันกลับมา กดปุ่ม ? ได้เสมอนะ', "Okay! Press the ? button any time to call me back.", { ms: 4000 });
      } else T.quip('เย้! งั้นฉันจะคอยอยู่ใกล้ ๆ นะ', "Yay! I'll stay close.", { ms: 2500 });
      return;
    }
    T.quip(th, en, { ms: Math.min(7000, 2600 + th.length * 50) });
    T.aim = { el };
  }

  async _askBack() {
    const T = this.tut;
    if (!T || T.running || T.pending) return;
    const i = await T.ask('อยากให้ฉันกลับมาอธิบายปุ่มต่าง ๆ อีกไหมจ๊ะ?', 'Want me back explaining the buttons?', [['เปิดคำแนะนำ', 'Turn the guide on'], ['ไม่เป็นไร', 'No thanks']]).catch(() => 1);
    if (i === 0) { state.guideOff = false; state.guideSeen = {}; save(); this.count = 0; T.quip('มาแล้วจ้า! กดปุ่มไหนก็ได้ เดี๋ยวฉันเล่าให้ฟัง', "I'm back! Press any button and I'll tell you about it.", { ms: 3500 }); }
    else T._close();
  }
}
