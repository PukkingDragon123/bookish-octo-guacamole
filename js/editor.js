// A small video editor for shadow-play shorts: record takes of the live
// stage, arrange and trim them on a timeline, scrub and play back, then
// export the sequence as a video. Also imports your own images as props.

import { Sprite, makeCanvas } from './art/leather.js';

const FPS = 30;
const P = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const I = {
  rec: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>',
  play: P('M8 5l11 7-11 7z'),
  pause: P('M8 5v14M16 5v14'),
  stop: P('M6 6h12v12H6z'),
  cut: P('M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.1 7.9L20 20M8.1 16.1L20 4'),
  dup: P('M8 8h12v12H8zM4 16V4h12'),
  del: P('M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13'),
  left: P('M15 5l-7 7 7 7'),
  right: P('M9 5l7 7-7 7'),
  export: P('M12 3v12M7 10l5 5 5-5M5 21h14'),
  import: P('M12 21V9M7 14l5-5 5 5M5 3h14'),
  wide: P('M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4'),
  close: P('M6 6l12 12M18 6L6 18'),
};

export class Editor {
  constructor(game) {
    this.game = game;
    this.clips = [];
    this.sel = -1;
    this.rec = null;
    this.playT = 0;       // playhead (seconds into the sequence)
    this.playing = false;
    this.frame = null;    // frame being shown during playback
    this.acc = 0;
    this.exporting = null;
    this._build();
  }

  get open() { return !this.bar.classList.contains('hidden'); }
  toggle(on) {
    const v = on ?? !this.open;
    this.bar.classList.toggle('hidden', !v);
    if (!v) { this.stopPlay(); this.stopRec(); }
    this.draw();
  }

  _build() {
    const root = this.game.root.querySelector('#ui');
    const b = (icon, title, fn, cls = '') => {
      const e = document.createElement('button');
      e.className = 'mini ' + cls;
      e.title = title;
      e.setAttribute('aria-label', title);
      e.innerHTML = icon;
      e.onclick = fn;
      return e;
    };
    this.bar = document.createElement('div');
    this.bar.id = 'timeline';
    this.bar.className = 'hidden';
    const tools = document.createElement('div');
    tools.className = 'tl-tools';
    this.recBtn = b(I.rec, 'อัด · Record a take', () => (this.rec ? this.stopRec() : this.startRec()), 'rec');
    this.playBtn = b(I.play, 'เล่น · Play', () => (this.playing ? this.stopPlay() : this.play()));
    tools.append(this.recBtn, this.playBtn,
      b(I.cut, 'ตัดที่หัวอ่าน · Split at playhead', () => this.split()),
      b(I.dup, 'ทำซ้ำ · Duplicate clip', () => this.dup()),
      b(I.left, 'เลื่อนซ้าย · Move clip earlier', () => this.move(-1)),
      b(I.right, 'เลื่อนขวา · Move clip later', () => this.move(1)),
      b(I.del, 'ลบ · Delete clip', () => this.remove()),
      b(I.wide, 'ขยายฉาก · Make the stage longer', () => this.game.expandStage()),
      b(I.import, 'นำเข้าภาพ · Import images as props', () => this.fileIn.click()),
      b(I.export, 'ส่งออกวิดีโอ · Export video', () => this.export()),
      b(I.close, 'ปิด · Close', () => this.toggle(false)));
    this.strip = document.createElement('canvas');
    this.strip.className = 'tl-strip';
    this.strip.height = 64;
    this.bar.append(tools, this.strip);
    this.fileIn = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    this.fileIn.onchange = () => this.importFiles([...this.fileIn.files]);
    this.modal = document.createElement('div');
    this.modal.id = 'export';
    this.modal.className = 'hidden';
    root.append(this.bar, this.fileIn, this.modal);
    // scrubbing / trimming on the strip
    let drag = null;
    this.strip.addEventListener('pointerdown', (e) => {
      const hit = this._hit(e.offsetX);
      this.strip.setPointerCapture(e.pointerId);
      if (hit && hit.edge) drag = { type: 'trim', ...hit };
      else { drag = { type: 'scrub' }; if (hit) this.sel = hit.i; this._scrub(e.offsetX); }
      this.draw();
    });
    this.strip.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (drag.type === 'scrub') this._scrub(e.offsetX);
      else {
        const c = this.clips[drag.i];
        const df = Math.round(((e.offsetX - drag.x0) / this.pxPerSec) * FPS);
        if (drag.edge === 'in') c.in = clamp(drag.v0 + df, 0, c.out - 5);
        else c.out = clamp(drag.v0 + df, c.in + 5, c.frames.length);
        this.draw();
      }
    });
    this.strip.addEventListener('pointerup', () => { drag = null; });
    addEventListener('resize', () => this.draw());
  }

  // ------------------------------------------------------------ recording
  startRec() {
    this.stopPlay();
    this.rec = { frames: [], name: 'take ' + (this.clips.length + 1) };
    this.acc = 0;
    this.recBtn.classList.add('on');
    this.game.audio?.sfx('click');
  }

  stopRec() {
    if (!this.rec) return;
    const r = this.rec;
    this.rec = null;
    this.recBtn.classList.remove('on');
    if (r.frames.length > 5) {
      this.clips.push({ frames: r.frames, in: 0, out: r.frames.length, name: r.name });
      this.sel = this.clips.length - 1;
    }
    this.draw();
  }

  // called by the game after each rendered live frame
  capture(dt) {
    if (!this.rec) return;
    this.acc += dt;
    if (this.acc < 1 / FPS) return;
    this.acc -= 1 / FPS;
    const st = this.game.stage, S = this.game.scene;
    const items = [];
    for (const it of st.lastItems || []) {
      if (it.sprite && it.sprite.dynamic) continue;
      if (it.line) items.push({ line: true, a: it.a.slice(), b: it.b.slice(), width: it.width, z: it.z, dark: it.dark });
      else items.push({ sprite: it.sprite, m: it.m.slice(), z: it.z, opacity: it.opacity, glow: it.glow });
    }
    const L = S.lamp;
    this.rec.frames.push({
      items,
      glows: (st.lastGlows || []).map((g) => ({ ...g })),
      lamp: { x: L.x, y: L.y, dist: L.dist, flame: L.flame, intensity: L.intensity, flicker: L.flicker, fxBoost: L.fxBoost || 0, color: L.color.slice(), sx: 0 },
      fx: this.game.fx ? this.game.fx.snapshot() : null,
    });
    if (this.rec.frames.length > FPS * 120) this.stopRec(); // 2 minute cap per take
    this.draw();
  }

  // ------------------------------------------------------------ sequence
  get total() { return this.clips.reduce((s, c) => s + (c.out - c.in), 0) / FPS; }

  frameAt(t) {
    let f = Math.floor(t * FPS);
    for (const c of this.clips) {
      const n = c.out - c.in;
      if (f < n) return c.frames[c.in + f];
      f -= n;
    }
    return null;
  }

  play() {
    if (!this.clips.length) return;
    this.stopRec();
    if (this.playT >= this.total - 0.05) this.playT = 0;
    this.playing = true;
    this.playBtn.innerHTML = I.pause;
  }

  stopPlay() {
    this.playing = false;
    this.frame = null;
    this.playBtn.innerHTML = I.play;
    if (this.exporting) this._finishExport();
  }

  update(dt) {
    if (!this.playing) { this.frame = this.scrubbing ? this.frame : null; return; }
    this.playT += dt;
    if (this.playT >= this.total) { this.playT = this.total; this.stopPlay(); this.draw(); return; }
    this._show(this.playT);
    this.draw();
  }

  _show(t) {
    const f = this.frameAt(t);
    if (!f) { this.frame = null; return; }
    this.frame = { ...f, fx: f.fx && this.game.fx ? this.game.fx.render(f.fx) : null };
  }

  _scrub(x) {
    this.playT = clamp((x - 8) / this.pxPerSec, 0, this.total);
    this.scrubbing = true;
    this._show(this.playT);
    clearTimeout(this._scrubT);
    this._scrubT = setTimeout(() => { this.scrubbing = false; if (!this.playing) this.frame = null; }, 1500);
    this.draw();
  }

  _clipStart(i) { let s = 0; for (let k = 0; k < i; k++) s += this.clips[k].out - this.clips[k].in; return s / FPS; }

  split() {
    const t = this.playT;
    let acc = 0;
    for (let i = 0; i < this.clips.length; i++) {
      const c = this.clips[i], n = (c.out - c.in) / FPS;
      if (t > acc + 0.1 && t < acc + n - 0.1) {
        const cut = c.in + Math.round((t - acc) * FPS);
        this.clips.splice(i + 1, 0, { frames: c.frames, in: cut, out: c.out, name: c.name + '′' });
        c.out = cut;
        this.sel = i + 1;
        break;
      }
      acc += n;
    }
    this.draw();
  }
  dup() { const c = this.clips[this.sel]; if (!c) return; this.clips.splice(this.sel + 1, 0, { ...c }); this.sel++; this.draw(); }
  move(d) {
    const i = this.sel, j = i + d;
    if (!this.clips[i] || !this.clips[j]) return;
    [this.clips[i], this.clips[j]] = [this.clips[j], this.clips[i]];
    this.sel = j;
    this.draw();
  }
  remove() { if (this.clips[this.sel]) { this.clips.splice(this.sel, 1); this.sel = Math.min(this.sel, this.clips.length - 1); this.playT = Math.min(this.playT, this.total); this.draw(); } }

  _hit(x) {
    let acc = 8;
    for (let i = 0; i < this.clips.length; i++) {
      const w = ((this.clips[i].out - this.clips[i].in) / FPS) * this.pxPerSec;
      if (x >= acc - 5 && x <= acc + w + 5) {
        const c = this.clips[i];
        if (Math.abs(x - acc) < 7) return { i, edge: 'in', x0: x, v0: c.in };
        if (Math.abs(x - (acc + w)) < 7) return { i, edge: 'out', x0: x, v0: c.out };
        return { i };
      }
      acc += w;
    }
    return null;
  }

  draw() {
    if (!this.open) return;
    const cv = this.strip;
    const w = Math.max(200, cv.clientWidth), h = cv.height;
    if (cv.width !== w) cv.width = w;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, w, h);
    const total = Math.max(this.total + (this.rec ? this.rec.frames.length / FPS : 0), 10);
    this.pxPerSec = (w - 16) / total;
    // ruler
    g.fillStyle = 'rgba(231,181,69,0.35)';
    for (let s = 0; s <= total; s++) g.fillRect(8 + s * this.pxPerSec, 0, 1, s % 5 ? 5 : 10);
    let x = 8;
    const lanes = [...this.clips, ...(this.rec ? [{ frames: this.rec.frames, in: 0, out: this.rec.frames.length, rec: true }] : [])];
    lanes.forEach((c, i) => {
      const cw = ((c.out - c.in) / FPS) * this.pxPerSec;
      const grad = g.createLinearGradient(0, 14, 0, h - 8);
      grad.addColorStop(0, c.rec ? '#d24a3a' : i === this.sel ? '#ffe39a' : '#d7a64a');
      grad.addColorStop(1, c.rec ? '#7a1a12' : '#7a4a12');
      g.fillStyle = grad;
      roundRect(g, x + 1, 14, Math.max(2, cw - 2), h - 22, 6);
      g.fill();
      g.strokeStyle = i === this.sel ? '#fff4c2' : 'rgba(60,30,8,0.9)';
      g.lineWidth = i === this.sel ? 2 : 1;
      g.stroke();
      // tiny keyframe ticks
      g.fillStyle = 'rgba(40,20,6,0.35)';
      for (let k = 0; k < cw; k += 12) g.fillRect(x + k, 20, 1, h - 34);
      g.fillStyle = 'rgba(40,20,6,0.8)';
      g.fillRect(x + 1, 14, 3, h - 22);
      g.fillRect(x + cw - 4, 14, 3, h - 22);
      x += cw;
    });
    const px = 8 + this.playT * this.pxPerSec;
    g.fillStyle = '#fff4c2';
    g.fillRect(px - 1, 0, 2, h);
    g.beginPath(); g.moveTo(px - 6, 0); g.lineTo(px + 6, 0); g.lineTo(px, 8); g.fill();
  }

  // ------------------------------------------------------------ export
  export() {
    if (!this.clips.length || this.exporting) return;
    const st = this.game.stage;
    const vw = st.bg.width, vh = st.bg.height;
    const k = Math.min(1, 1280 / vw);
    const out = makeCanvas(Math.round((vw * k) / 2) * 2, Math.round((vh * k) / 2) * 2);
    const stream = out.captureStream(FPS);
    const A = this.game.audio;
    try {
      if (A && A.ctx && A.engine) {
        const dest = A.ctx.createMediaStreamDestination();
        A.engine.master.connect(dest);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
        this._audioDest = dest;
      }
    } catch (_) { /* no audio track */ }
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
    if (!mime) { this.game.ui.toast('เบราว์เซอร์นี้อัดวิดีโอไม่ได้ · This browser cannot record video.', 5000, { error: true }); return; }
    const recr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6 });
    const chunks = [];
    recr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recr.onstop = () => this._showVideo(new Blob(chunks, { type: mime.split(';')[0] }));
    this.exporting = { recr, out, g: out.getContext('2d') };
    this.playT = 0;
    recr.start(250);
    this.play();
  }

  // copy the three stage layers into the export canvas (called after render)
  composite() {
    const E = this.exporting;
    if (!E) return;
    const st = this.game.stage;
    const g = E.g;
    g.fillStyle = '#050610';
    g.fillRect(0, 0, E.out.width, E.out.height);
    for (const c of [st.bg, st.glc, st.fg]) g.drawImage(c, 0, 0, E.out.width, E.out.height);
  }

  _finishExport() {
    const E = this.exporting;
    this.exporting = null;
    try { E.recr.stop(); } catch (_) { /* */ }
    try { this._audioDest && this.game.audio.engine.master.disconnect(this._audioDest); } catch (_) { /* */ }
  }

  _showVideo(blob) {
    const url = URL.createObjectURL(blob);
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    this.modal.innerHTML = '';
    const v = Object.assign(document.createElement('video'), { src: url, controls: true, loop: true, autoplay: true, playsInline: true });
    const a = Object.assign(document.createElement('a'), { href: url, download: `nang-talung-${Date.now()}.${ext}`, className: 'mini', title: 'บันทึก · Save video', innerHTML: I.export });
    const x = Object.assign(document.createElement('button'), { className: 'mini', title: 'ปิด · Close', innerHTML: I.close, onclick: () => { this.modal.classList.add('hidden'); v.pause(); } });
    const row = document.createElement('div');
    row.className = 'tl-tools';
    row.append(a, x);
    this.modal.append(v, row);
    this.modal.classList.remove('hidden');
  }

  // ------------------------------------------------------------ import
  async importFiles(files) {
    const G = this.game;
    for (const f of files) {
      try {
        const bmp = await createImageBitmap(f);
        const maxPx = 900;
        const k = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
        const c = makeCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(bmp, 0, 0, c.width, c.height);
        const d = g.getImageData(0, 0, c.width, c.height);
        // opaque photo? key out the background colour sampled at the corners
        const px = (i) => [d.data[i], d.data[i + 1], d.data[i + 2], d.data[i + 3]];
        const corners = [0, (c.width - 1) * 4, (c.height - 1) * c.width * 4, (c.height * c.width - 1) * 4].map(px);
        if (corners.every((q) => q[3] > 250)) {
          const bg = corners.reduce((s, q) => s.map((v, i) => v + q[i] / 4), [0, 0, 0, 0]);
          for (let i = 0; i < d.data.length; i += 4) {
            const dist = Math.abs(d.data[i] - bg[0]) + Math.abs(d.data[i + 1] - bg[1]) + Math.abs(d.data[i + 2] - bg[2]);
            if (dist < 60) d.data[i + 3] = Math.max(0, (dist - 30) * 8.5);
          }
          g.putImageData(d, 0, 0);
        }
        const h = 320; // world units tall
        const sprite = new Sprite(c, h / c.height, { name: 'import-' + f.name });
        const id = 'import-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        const def = { id, name: f.name.replace(/\.[^.]+$/, ''), en: 'Imported image', cat: 'imports', sprite, grip: [sprite.w / 2, sprite.h * 0.75] };
        G.content.props.push(def);
        G.content.byId.set(id, def);
      } catch (e) {
        G.ui.toast('นำเข้าไม่ได้ · Could not import ' + f.name, 4000, { error: true });
      }
    }
    G.ui.rebuildTabs();
    G.ui.showTab('imports');
    G.ui.toggleHouse(true);
    this.fileIn.value = '';
  }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
