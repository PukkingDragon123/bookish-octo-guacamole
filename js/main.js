// Boot: build all the leather art, then the stage, then the intro.
import { loadContent } from './content.js';
import { Game } from './game.js';

const bar = document.querySelector('#loading .load-bar i');
const msg = document.querySelector('#loading .load-msg');
const progress = (p, m) => { bar.style.width = `${Math.round(p * 100)}%`; if (m) msg.textContent = m; };

async function boot() {
  try {
    const content = await loadContent(progress);
    progress(0.92, 'สร้างโรงหนัง · raising the booth');
    const game = new Game(document.getElementById('app'), content);
    window.game = game;
    await game.init();
    progress(1, '');
    const q = new URLSearchParams(location.search);
    if (q.get('intro') === '0') game._endIntro(); else game.startIntro();
    let last = performance.now();
    const frame = (now) => {
      const raw = (now - last) / 1000;
      const dt = Math.min(0.05, raw);
      last = now;
      game.wallDt = Math.min(0.25, raw);
      const t0 = performance.now();
      game.update(dt);
      game.render(dt);
      game.frameMs = performance.now() - t0;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    document.getElementById('loading').classList.add('hidden');
    window.__ready = true;
  } catch (e) {
    console.error(e);
    msg.textContent = 'เกิดข้อผิดพลาด · ' + e.message;
    window.__ready = true;
  }
}
boot();
