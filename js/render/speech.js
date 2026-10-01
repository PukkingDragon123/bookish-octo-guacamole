// คำพูด — speech bubbles for the puppets.
//
// Cut-paper bubbles in the booth's style: a cream palm-leaf card with a
// thin gold rule and a curved tail down to the speaker's head. Thai text
// is wrapped on real word boundaries (Intl.Segmenter), revealed a word at
// a time while the voice speaks, and the English gloss sits small below.
// Bubbles never leave the screen, never pile on top of each other (they
// stack upward around their speakers), and pop in / fade out softly.

const SEG = (() => {
  try { return new Intl.Segmenter('th', { granularity: 'word' }); } catch (_) { return null; }
})();

function words(text) {
  if (!text) return [];
  if (SEG) return [...SEG.segment(text)].map((s) => s.segment);
  return text.split(/(\s+)/);
}

// greedy wrap of segments into lines no wider than maxW
function wrap(f, text, maxW) {
  const out = [];
  let line = '';
  for (const w of words(text)) {
    const test = line + w;
    if (line && f.measureText(test).width > maxW) {
      out.push(line.trimEnd());
      line = w.trimStart();
    } else line = test;
  }
  if (line.trim()) out.push(line.trimEnd());
  return out;
}

const ease = (t) => 1 - (1 - t) ** 3;

export class SpeechLayer {
  constructor(game) {
    this.game = game;
    this.cache = new WeakMap(); // speech object -> layout
  }

  // screen-space anchor above the speaker's head
  _anchor(a, proj) {
    let top = null;
    for (const b of a.parts) {
      if (b.isRod) continue;
      const y = b.y - b.radius;
      if (!top || y < top[1]) top = [b.x, y];
    }
    if (!top) top = [a.root.x, a.root.y];
    const [hx] = a.handleWorld ? a.handleWorld() : [a.root.x];
    return proj([hx * 0.6 + top[0] * 0.4, top[1] - 12], a.z);
  }

  draw(f, cam, dpr, proj) {
    const S = this.game.scene;
    const talkers = S.actors.filter((a) => a.speech && a.parts && !a.removed);
    if (!talkers.length) return;
    f.save();
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vw = cam.vw, vh = cam.vh;
    const scale = Math.max(0.78, Math.min(1.1, vw / 1300));
    const maxW = Math.min(300, vw * 0.62) * scale;
    const boxes = [];
    for (const a of talkers) {
      const s = a.speech;
      // laid out every frame: the web font may arrive after the first
      // measurement, and a stale width pushed the text off its card
      let L = null;
      {
        f.font = `600 ${Math.round(17 * scale)}px Sarabun, sans-serif`;
        const th = wrap(f, s.th, maxW - 28 * scale).slice(0, 4);
        f.font = `${Math.round(12 * scale)}px Sarabun, sans-serif`;
        const en = s.en ? wrap(f, s.en, maxW - 28 * scale).slice(0, 2) : [];
        f.font = `600 ${Math.round(17 * scale)}px Sarabun, sans-serif`;
        let w = 0;
        const thW = th.map((l) => f.measureText(l).width);
        for (const v of thW) w = Math.max(w, v);
        f.font = `${Math.round(12 * scale)}px Sarabun, sans-serif`;
        const enW = en.map((l) => f.measureText(l).width);
        for (const v of enW) w = Math.max(w, v);
        const lh = 23 * scale, le = 15 * scale;
        L = { th, en, thW, enW, w: w + 28 * scale, h: th.length * lh + en.length * le + 18 * scale, lh, le, n: words(s.th).length };
      }
      const [ax, ay] = this._anchor(a, proj);
      boxes.push({ a, s, L, ax, ay, x: ax - L.w / 2, y: ay - L.h - 16 * scale });
    }
    // keep on screen, then push apart overlapping bubbles (upward)
    boxes.sort((p, q) => q.ay - p.ay);
    for (const b of boxes) {
      const right = vw < 700 ? 64 : 76; // keep clear of the medallion column
      b.x = Math.max(8, Math.min(vw - b.L.w - right, b.x));
      b.y = Math.max(8, Math.min(vh - b.L.h - 60, b.y));
    }
    for (let it = 0; it < 4; it++) {
      for (let i = 0; i < boxes.length; i++) for (let j = 0; j < i; j++) {
        const p = boxes[i], q = boxes[j];
        if (p.x < q.x + q.L.w + 6 && q.x < p.x + p.L.w + 6 && p.y < q.y + q.L.h + 6 && q.y < p.y + p.L.h + 6) {
          p.y = Math.max(8, q.y - p.L.h - 8);
        }
      }
    }
    for (const b of boxes) this._bubble(f, b, scale);
    f.restore();
  }

  _bubble(f, { s, L, ax, ay, x, y }, k) {
    const tIn = Math.min(1, s.t / 0.22), tOut = Math.min(1, (s.dur - s.t) / 0.35);
    const a = Math.max(0, Math.min(tIn, tOut));
    if (a <= 0) return;
    const pop = 0.86 + 0.14 * ease(tIn);
    const cx = x + L.w / 2, cy = y + L.h;
    f.save();
    f.globalAlpha = a;
    f.translate(cx, cy);
    f.scale(pop, pop);
    f.translate(-cx, -cy);
    const r = 12 * k;
    // tail: a curved leaf-tip toward the speaker's head
    const tx = Math.max(x + r * 1.5, Math.min(x + L.w - r * 1.5, ax));
    const tail = new Path2D();
    tail.moveTo(tx - 9 * k, y + L.h - 1);
    tail.quadraticCurveTo(tx - 2 * k, y + L.h + 8 * k, ax, Math.min(ay, y + L.h + 16 * k));
    tail.quadraticCurveTo(tx + 3 * k, y + L.h + 6 * k, tx + 9 * k, y + L.h - 1);
    // card
    const card = new Path2D();
    if (card.roundRect) card.roundRect(x, y, L.w, L.h, r); else card.rect(x, y, L.w, L.h);
    f.shadowColor = 'rgba(20,8,2,0.45)';
    f.shadowBlur = 10 * k;
    f.shadowOffsetY = 3 * k;
    f.fillStyle = '#f6e8c6';
    f.fill(card);
    f.fill(tail);
    f.shadowColor = 'transparent';
    // palm-leaf grain
    f.save();
    f.clip(card);
    f.strokeStyle = 'rgba(150,110,50,0.12)';
    f.lineWidth = 1;
    for (let gy = y + 5 * k; gy < y + L.h; gy += 5 * k) { f.beginPath(); f.moveTo(x, gy); f.lineTo(x + L.w, gy + 1); f.stroke(); }
    f.restore();
    // gold rule + inner hairline
    f.strokeStyle = '#b8862e';
    f.lineWidth = 1.6 * k;
    f.stroke(card);
    f.strokeStyle = 'rgba(184,134,46,0.45)';
    f.lineWidth = 0.8;
    const inner = new Path2D();
    if (inner.roundRect) inner.roundRect(x + 3.5 * k, y + 3.5 * k, L.w - 7 * k, L.h - 7 * k, r * 0.7); else inner.rect(x + 3.5 * k, y + 3.5 * k, L.w - 7 * k, L.h - 7 * k);
    f.stroke(inner);
    f.fillStyle = '#b8862e';
    for (const px of [x + 7 * k, x + L.w - 7 * k]) { f.beginPath(); f.arc(px, y + L.h / 2, 1.8 * k, 0, 7); f.fill(); }
    // text: Thai revealed word by word while it's being spoken
    const shown = Math.min(1, s.t / Math.max(0.4, s.speak || s.dur * 0.55));
    let budget = Math.ceil(L.n * shown);
    // explicit left-aligned placement (centre computed from measured widths)
    // so every browser lays it out the same and the reveal grows in place
    f.textAlign = 'left';
    f.direction = 'ltr';
    f.textBaseline = 'alphabetic';
    f.font = `600 ${Math.round(17 * k)}px Sarabun, sans-serif`;
    f.fillStyle = '#3a1a08';
    let yy = y + 9 * k + L.lh * 0.8;
    L.th.forEach((line, i) => {
      const ws = words(line);
      const part = budget >= ws.length ? line : ws.slice(0, Math.max(0, budget)).join('');
      budget -= ws.length;
      if (part) f.fillText(part, x + (L.w - L.thW[i]) / 2, yy);
      yy += L.lh;
    });
    if (L.en.length && shown >= 1) {
      f.font = `${Math.round(12 * k)}px Sarabun, sans-serif`;
      f.fillStyle = 'rgba(90,55,20,0.7)';
      L.en.forEach((line, i) => { f.fillText(line, x + (L.w - L.enW[i]) / 2, yy - 4 * k); yy += L.le; });
    }
    f.restore();
  }
}
