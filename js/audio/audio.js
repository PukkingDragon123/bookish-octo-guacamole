// หนังตะลุง — procedural audio (Web Audio API, no audio files).
//
//   import { audio } from './audio/audio.js';
//   await audio.init();                 // from a user gesture; safe to repeat
//   audio.music.play('overture');       // heaven overture calm battle dance comic sad
//   audio.music.setIntensity(0.7);      // denser drums, faster tempo
//   audio.sfx('clang', { pan: -0.3 });
//   audio.instrument('ranat');          // melodic random walk on each click
//   const secs = audio.voice('สวัสดีครับ', { voice: 'comic' });
//   audio.update(dt);                   // every frame (lookahead scheduling)
//
// Before init() every call is a silent no-op (never throws). State calls
// (music.play / setIntensity, ambience.start / setLevel, lampHum, volume,
// mute) are remembered and applied once init() runs; one-shots are dropped.
// voice() always returns the babble duration, even before init or muted.
//
// Module layout (all under js/audio/):
//   dsp.js      tuning (Thai 7-TET), RNG, JS DSP renderers, reverb IR, Shot
//   perc.js     baked struck/percussive buffers (drums, gongs, ching, ranat…)
//   melodic.js  live lead voices (pi, saw, khlui), khaen, drones
//   vocal.js    formant synth, Thai-aware syllabifier, babble, laughter
//   sfx.js      the one-shot effect table
//   music.js    generative ensemble + lookahead sequencer + moods
//   ambience.js night village beds and random events
//   engine.js   buses, master chain, dispatch (works on any BaseAudioContext)

import { AudioEngine, SFX_NAMES, MOOD_NAMES, INSTRUMENT_NAMES } from './engine.js';
import { estimateBabble, VOICES } from './vocal.js';
import { holdAt, clamp } from './dsp.js';

const hasWindow = typeof window !== 'undefined';
const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

class AudioManager {
  constructor() {
    this.ctx = null;
    this.engine = null;
    this._muted = false;
    this._volume = 0.85;
    this._pending = { mood: null, intensity: 0, amb: false, ambLevel: null, lamp: 0 };
    this._warned = new Set();
    this._lastUpdate = 0;
    this._timer = null;
    this.names = { sfx: SFX_NAMES, moods: MOOD_NAMES, instruments: INSTRUMENT_NAMES, voices: Object.keys(VOICES) };

    const self = this;
    this.music = {
      play(mood) {
        self._safe('music.play', () => {
          if (!MOOD_NAMES.includes(mood)) return;
          self._pending.mood = mood;
          if (self.engine) {
            self.engine.music.play(mood);
            self._tick();
          }
        });
      },
      setIntensity(x) {
        self._safe('music.setIntensity', () => {
          self._pending.intensity = clamp(+x || 0, 0, 1);
          self.engine?.music.setIntensity(self._pending.intensity);
        });
      },
      stop(fadeSeconds = 1.5) {
        self._safe('music.stop', () => {
          self._pending.mood = null;
          self.engine?.music.stop(fadeSeconds);
        });
      },
      get mood() {
        return self.engine ? self.engine.music.mood : self._pending.mood;
      },
      get intensity() {
        return self._pending.intensity;
      },
    };
    this.ambience = {
      start() {
        self._safe('ambience.start', () => {
          self._pending.amb = true;
          self.engine?.ambience.start();
        });
      },
      stop(fadeSeconds = 2) {
        self._safe('ambience.stop', () => {
          self._pending.amb = false;
          self.engine?.ambience.stop(fadeSeconds);
        });
      },
      setLevel(x) {
        self._safe('ambience.setLevel', () => {
          self._pending.ambLevel = clamp(+x || 0, 0, 1);
          self.engine?.ambience.setLevel(self._pending.ambLevel);
        });
      },
      get level() {
        return self._pending.ambLevel ?? 0.7;
      },
    };
  }

  /** Create / resume the AudioContext. Call from a user gesture. */
  async init() {
    try {
      if (!this.ctx) {
        const AC = hasWindow && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return false;
        let ctx;
        try {
          ctx = new AC({ latencyHint: 'interactive' });
        } catch (e) {
          ctx = new AC();
        }
        this.ctx = ctx;
        this.engine = new AudioEngine(ctx);
        this._applyGain(true);
        const p = this._pending;
        if (p.mood) this.engine.music.play(p.mood);
        this.engine.music.setIntensity(p.intensity);
        if (p.ambLevel != null) this.engine.ambience.setLevel(p.ambLevel);
        if (p.amb) this.engine.ambience.start();
        if (p.lamp) this.engine.lampHum(p.lamp);
        this._installUnlock();
        this._timer = setInterval(() => {
          if (perfNow() - this._lastUpdate > 70) this._tick();
        }, 50);
        this.engine.prewarm();
      }
      if (!this._muted && this.ctx.state !== 'running') {
        await Promise.race([this.ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 300))]);
      }
      this._tick();
      return this.ctx.state === 'running';
    } catch (e) {
      this._warn('init', e);
      return false;
    }
  }

  get ready() {
    return !!this.engine;
  }
  get context() {
    return this.ctx;
  }
  get muted() {
    return this._muted;
  }
  get volume() {
    return this._volume;
  }

  setMuted(b) {
    this._safe('setMuted', () => {
      this._muted = !!b;
      this._applyGain();
    });
  }

  setVolume(v) {
    this._safe('setVolume', () => {
      this._volume = clamp(+v || 0, 0, 1);
      this._applyGain();
    });
  }

  sfx(name, opts) {
    if (!this._live()) return;
    this._safe('sfx', () => this.engine.sfx(name, opts || {}));
  }

  instrument(name, opts) {
    if (!this._live()) return;
    this._safe('instrument', () => this.engine.instrument(name, opts || {}));
  }

  /** Speech babble. Returns its duration in seconds (always). */
  voice(text, opts = {}) {
    let d = 0;
    this._safe('voice', () => {
      d = this._live() ? this.engine.voice(text, opts || {}) : estimateBabble(String(text ?? ''), opts || {});
    });
    return d;
  }

  lampHum(level) {
    this._safe('lampHum', () => {
      this._pending.lamp = clamp(+level || 0, 0, 1);
      this.engine?.lampHum(this._pending.lamp);
    });
  }

  update(dt) {
    this._lastUpdate = perfNow();
    this._tick();
  }

  // --- internals -------------------------------------------------------

  _live() {
    return !!this.engine && !this._muted && this.ctx.state === 'running';
  }
  _tick() {
    if (!this.engine || this.ctx.state !== 'running') return;
    const hidden = typeof document !== 'undefined' && document.hidden;
    this._safe('update', () => this.engine.update(hidden ? 1.6 : 0.3));
  }
  _gain() {
    return this._muted ? 0 : this._volume * this._volume;
  }
  _applyGain(immediate = false) {
    if (!this.engine) return;
    const g = this.engine.master.gain, ctx = this.ctx, t = ctx.currentTime;
    if (immediate) g.setValueAtTime(this._gain(), t);
    else {
      holdAt(g, t);
      g.setTargetAtTime(this._gain(), t, 0.04);
    }
    clearTimeout(this._suspendT);
    if (this._muted) {
      // save CPU while muted; one-shots are skipped, music resumes in place
      this._suspendT = setTimeout(() => {
        if (this._muted && ctx.state === 'running') ctx.suspend().catch(() => {});
      }, 350);
    } else if (ctx.state !== 'running' && ctx.state !== 'closed') {
      ctx.resume().catch(() => {});
    }
  }
  _installUnlock() {
    if (!hasWindow || this._unlock) return;
    this._unlock = () => {
      if (this.ctx && !this._muted && this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => {});
    };
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, this._unlock, { capture: true, passive: true });
  }
  _safe(where, fn) {
    try {
      fn();
    } catch (e) {
      this._warn(where, e);
    }
  }
  _warn(where, e) {
    if (this._warned.has(where)) return;
    this._warned.add(where);
    console.warn(`[audio] ${where} failed:`, e);
  }
}

export const audio = new AudioManager();
export { AudioEngine, SFX_NAMES, MOOD_NAMES, INSTRUMENT_NAMES };
export default audio;
