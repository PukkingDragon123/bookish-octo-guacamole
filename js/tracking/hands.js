// Webcam hand tracker for the puppet game (MediaPipe Tasks Vision HandLandmarker).
//
//   import { HandTracker } from './tracking/hands.js';
//   const tracker = new HandTracker({ maxHands: 2 });
//   await tracker.start();           // or tracker.startSynthetic() for the no-camera demo
//   function frame(now) { tracker.update(now); for (const h of tracker.hands) ...; requestAnimationFrame(frame); }
//
// The MediaPipe bundle, its wasm and the model are fetched at runtime from
// public CDNs (pinned below). Everything the game reads is mirrored like a
// selfie and smoothed with 1€ filters; see HandState in the README comment of
// `_makeState()` and the feature definitions in gestures.js.
//
// This module can be imported in node (no DOM access at import time), which
// the unit tests use to drive the pipeline through `ingest()`.

import {
  createFeatures, createScores, extractFeatures, classifyGesture, GestureStabilizer, FacingFilter,
  TwoHandDetector, synthHand, POSES, HAND_CONNECTIONS, GESTURE_LABELS, TIP_IDS,
} from './gestures.js';
import { OneEuroFilter, RangeCalibrator } from './filters.js';

export const MEDIAPIPE_VERSION = '1.0.1';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
export const MEDIAPIPE_URLS = {
  vision: `${CDN}/vision_bundle.mjs`,
  wasm: `${CDN}/wasm`,
  model: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
};

const DEFAULTS = {
  maxHands: 2,
  width: 640,
  height: 480,
  maxFps: 30, // detection rate cap
  lostMs: 300, // a hand missing this long loses its slot
  delegate: 'GPU', // falls back to CPU automatically
  swapHandedness: false, // tasks-vision labels the real hand for unmirrored webcam frames
  minDetectionConfidence: 0.5,
  minPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  importTimeoutMs: 25000,
  modelTimeoutMs: 90000,
  visionUrl: MEDIAPIPE_URLS.vision,
  wasmUrl: MEDIAPIPE_URLS.wasm,
  modelUrl: MEDIAPIPE_URLS.model,
  // 1€ filter tuning (units: image heights, seconds)
  palmFilter: { minCutoff: 1.2, beta: 6, dCutoff: 1 },
  shapeFilter: { minCutoff: 1.6, beta: 3, dCutoff: 1 },
};

// ---------------------------------------------------------------------------
// Errors with friendly bilingual messages

const MESSAGES = {
  insecure: {
    th: 'ต้องเปิดเกมผ่าน https:// หรือ localhost จึงจะใช้กล้องได้',
    en: 'The camera only works on a secure page. Open the game via https:// or http://localhost.',
  },
  unsupported: {
    th: 'เบราว์เซอร์นี้ใช้กล้องไม่ได้ ลองเปิดด้วย Chrome, Edge, Firefox หรือ Safari รุ่นใหม่',
    en: "This browser can't use the camera. Try a recent Chrome, Edge, Firefox or Safari.",
  },
  'no-camera': {
    th: 'ไม่พบกล้อง กรุณาต่อเว็บแคมแล้วลองใหม่อีกครั้ง',
    en: 'No camera was found. Connect a webcam and try again.',
  },
  denied: {
    th: 'ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณากดอนุญาตที่ไอคอนกล้องบนแถบที่อยู่ แล้วลองใหม่',
    en: 'Camera access was blocked. Allow the camera (camera icon in the address bar) and try again.',
  },
  busy: {
    th: 'กล้องกำลังถูกใช้งานโดยโปรแกรมหรือแท็บอื่น กรุณาปิดแล้วลองใหม่',
    en: 'The camera is being used by another app or tab. Close it and try again.',
  },
  camera: {
    th: 'เปิดกล้องไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    en: "The camera couldn't be started. Please try again.",
  },
  ended: {
    th: 'กล้องถูกตัดการเชื่อมต่อ กรุณาต่อกล้องแล้วเริ่มใหม่',
    en: 'The camera was disconnected. Reconnect it and start again.',
  },
  model: {
    th: 'โหลดโมเดลตรวจจับมือไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
    en: "Couldn't load the hand-tracking model. Check your internet connection and try again.",
  },
  aborted: {
    th: 'หยุดการเริ่มกล้องแล้ว',
    en: 'Camera start was cancelled.',
  },
};

function trackerError(code, cause) {
  const m = MESSAGES[code] || MESSAGES.camera;
  const e = new Error(m.en);
  e.name = 'HandTrackerError';
  e.code = code;
  e.userMessage = `${m.th}\n${m.en}`;
  e.userMessageTh = m.th;
  e.userMessageEn = m.en;
  if (cause) e.cause = cause;
  return e;
}

function cameraError(e) {
  const n = (e && e.name) || '';
  if (n === 'NotAllowedError' || n === 'PermissionDeniedError') return trackerError('denied', e);
  if (n === 'SecurityError') {
    return trackerError(globalThis.isSecureContext === false ? 'insecure' : 'denied', e);
  }
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError' || n === 'ConstraintNotSatisfiedError') {
    return trackerError('no-camera', e);
  }
  if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') return trackerError('busy', e);
  if (n === 'TypeError') return trackerError(globalThis.isSecureContext === false ? 'insecure' : 'unsupported', e);
  return trackerError('camera', e);
}

function withTimeout(p, ms, code, onLate) {
  let timer;
  return new Promise((resolve, reject) => {
    let done = false;
    timer = setTimeout(() => {
      done = true;
      reject(trackerError(code, new Error(`timed out after ${ms} ms`)));
    }, ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        if (done) {
          if (onLate) onLate(v);
        } else resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        if (!done) reject(e);
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Per-hand slot

const POINTS = 21;
const SUPPRESSED = Object.freeze({ name: 'none', score: 0, scores: Object.freeze(createScores()) });

function makeLandmarks() {
  const a = [];
  for (let i = 0; i < POINTS; i++) a.push([0, 0, 0]);
  return a;
}

class Detection {
  constructor() {
    this.P = makeLandmarks(); // iso, mirrored
    this.palm = [0, 0, 0];
    this.size = 0.1;
    this.label = 'Right';
    this.score = 0;
    this.used = false;
  }
}

class Slot {
  constructor(id, opts) {
    this.id = id;
    this.active = false;
    this.lastSeen = -1e9;
    this.firstSeen = 0;
    this.hVote = 0;
    this.palmF = [0, 1, 2].map(() => new OneEuroFilter(opts.palmFilter));
    this.shapeF = [];
    for (let i = 0; i < POINTS * 3; i++) this.shapeF.push(new OneEuroFilter(opts.shapeFilter));
    this.P = makeLandmarks();
    this.pending = false;
    this.f = createFeatures();
    this.cls = classifyGesture(null);
    this.stab = new GestureStabilizer();
    this.facing = new FacingFilter();
    this.state = {
      id,
      handedness: 'Right',
      lost: false,
      confidence: 0,
      landmarks: makeLandmarks(),
      palm: { x: 0.5, y: 0.5 },
      size: 0,
      depth: 0.5,
      roll: 0,
      facing: 'palm',
      curl: [0, 0, 0, 0, 0],
      spread: 0,
      pinch: 0,
      tips: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      gesture: this.stab.state,
      // extras (not part of the core contract, handy for debugging/UI)
      features: this.f,
      scores: this.cls.scores,
      rawGesture: 'none',
      velocity: { x: 0, y: 0 }, // palm speed, normalized units per second
    };
  }

  reset() {
    this.active = false;
    this.hVote = 0;
    for (const f of this.palmF) f.reset();
    for (const f of this.shapeF) f.reset();
    this.stab.reset();
    this.facing.reset();
    this.state.lost = false;
    this.state.confidence = 0;
  }

  /** Feed one matched detection. */
  observe(det, nowMs, aspect, tracker) {
    const t = nowMs / 1000;
    const st = this.state;
    const fresh = !this.active;
    if (fresh) {
      this.reset();
      this.active = true;
      this.firstSeen = nowMs;
    }
    this.lastSeen = nowMs;
    st.lost = false;

    // handedness: confidence-weighted vote with hysteresis
    const v = (det.label === 'Left' ? -1 : 1) * Math.max(0.05, det.score);
    this.hVote = fresh ? v : this.hVote * 0.8 + v * 0.2;
    if (fresh) st.handedness = this.hVote < 0 ? 'Left' : 'Right';
    else if (this.hVote > 0.15) st.handedness = 'Right';
    else if (this.hVote < -0.15) st.handedness = 'Left';
    st.confidence = fresh ? det.score : st.confidence * 0.7 + det.score * 0.3;

    // 1€ filtering: responsive for the palm position, steadier for hand shape
    const pc = det.palm;
    const fx = this.palmF[0].filter(pc[0], t);
    const fy = this.palmF[1].filter(pc[1], t);
    const fz = this.palmF[2].filter(pc[2], t);
    const P = this.P;
    const sf = this.shapeF;
    for (let i = 0; i < POINTS; i++) {
      const s = det.P[i];
      P[i][0] = fx + sf[i * 3].filter(s[0] - pc[0], t);
      P[i][1] = fy + sf[i * 3 + 1].filter(s[1] - pc[1], t);
      P[i][2] = fz + sf[i * 3 + 2].filter(s[2] - pc[2], t);
    }

    const f = extractFeatures(P, st.handedness, this.f);
    this.pending = f.valid;
    if (!f.valid) return;
    f.facing = this.facing.update(f.facingRaw);
    st.facing = f.facing;
    st.size = f.size;
    st.depth = tracker._depthUpdate(f.size, t);
    st.roll = f.roll;
    for (let k = 0; k < 5; k++) {
      st.curl[k] = f.curl[k];
      st.tips[k][0] = f.tips[k][0];
      st.tips[k][1] = f.tips[k][1];
    }
    st.spread = f.spread;
    st.pinch = f.pinch;
    // palm = filtered centre (same definition as the features)
    st.palm.x = f.palm[0] / aspect;
    st.palm.y = f.palm[1];
    st.velocity.x = this.palmF[0].velocity / aspect;
    st.velocity.y = this.palmF[1].velocity;
    const L = st.landmarks;
    for (let i = 0; i < POINTS; i++) {
      L[i][0] = P[i][0] / aspect;
      L[i][1] = P[i][1];
      L[i][2] = P[i][2] / aspect;
    }
  }

  /** Second phase of an observation: gesture classification + stabilisation. */
  classify(nowMs, suppress) {
    if (!this.pending) return;
    this.pending = false;
    classifyGesture(this.f, this.cls);
    // while both hands are busy with a two-hand gesture (wai) they hold no pose
    const raw = suppress ? SUPPRESSED : this.cls;
    this.state.rawGesture = raw.name;
    this.stab.update(raw, nowMs / 1000);
  }
}

// ---------------------------------------------------------------------------
// Synthetic demo choreography

export const DEMO_SEGMENT = 2.6; // seconds per pose pair
const DEMO_BLEND = 0.5;
export const DEMO_SEQ = [
  ['open', 'open'],
  ['fist', 'fist'],
  ['point', 'victory'],
  ['victory', 'point'],
  ['horns', 'horns'],
  ['thumbsUp', 'thumbsUp'],
  ['jeeb', 'wong'],
  ['wong', 'jeeb'],
  ['wai', 'wai'],
  ['relaxed', 'relaxed'],
];
const WAI_POSE = { curl: [0.1, 0.03, 0.03, 0.03, 0.03], spread: 0.05, thumbOut: 0 };

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Deterministic noise so the demo looks like a (steady) real tracker.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5;
  };
}

function demoParams(name, hand, t, aspect, out) {
  const right = hand === 'Right';
  const sgn = right ? 1 : -1;
  if (name === 'wai') {
    const s = 0.2;
    out.curl = WAI_POSE.curl;
    out.spread = WAI_POSE.spread;
    out.thumbOut = WAI_POSE.thumbOut;
    out.pinch = 0;
    out.roll = 0;
    out.pitch = 0;
    out.yaw = sgn * (Math.PI / 2 - 0.12);
    out.size = s + 0.01 * Math.sin(t * 0.8);
    out.x = aspect / 2 + sgn * 0.07 * s;
    out.y = 0.52 + 0.015 * Math.sin(t * 1.1);
    return out;
  }
  const P = POSES[name] || POSES.relaxed;
  out.curl = P.curl;
  out.spread = P.spread;
  out.thumbOut = P.thumbOut;
  out.pinch = P.pinch || 0;
  out.roll = (P.roll || 0) * sgn + 0.22 * Math.sin(t * 0.7 + (right ? 0 : 2));
  out.pitch = 0.15 * Math.sin(t * 0.53 + (right ? 1 : 0));
  out.yaw = 0.35 * Math.sin(t * 0.41 + (right ? 0 : 1.5));
  out.size = 0.19 + 0.05 * Math.sin(t * 0.37 + (right ? 0 : 1));
  out.x = aspect * (right ? 0.68 : 0.32) + 0.09 * Math.sin(t * 0.9 + (right ? 0 : 1.2));
  out.y = 0.55 + 0.1 * Math.sin(t * 1.27 + (right ? 0.5 : 0));
  return out;
}

function blendParams(a, b, k, out) {
  for (const key of ['spread', 'thumbOut', 'pinch', 'roll', 'pitch', 'yaw', 'size', 'x', 'y']) out[key] = lerp(a[key], b[key], k);
  if (!out.curl || out.curl === a.curl || out.curl === b.curl) out.curl = [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; i++) out.curl[i] = lerp(a.curl[i], b.curl[i], k);
  return out;
}

// ---------------------------------------------------------------------------

const hasDOM = typeof document !== 'undefined';

export class HandTracker extends EventTarget {
  constructor(options = {}) {
    super();
    const o = { ...DEFAULTS, ...options };
    o.maxHands = Math.max(1, Math.min(2, Math.round(o.maxHands || 2)));
    this.opts = o;
    this.maxHands = o.maxHands;

    /** 'idle' | 'loading' | 'running' | 'error' */
    this.status = 'idle';
    this.running = false;
    /** 'camera' | 'synthetic' | null */
    this.mode = null;
    /** last Error (with .code and .userMessage) or null */
    this.error = null;
    /** 'GPU' | 'CPU' | null once the model is loaded */
    this.delegate = null;
    /** detections per second (smoothed) */
    this.fps = 0;
    /** performance.now() of the last detection that produced data */
    this.lastDetectionMs = 0;
    this.detections = 0;
    this.onstatuschange = null;

    this.video = null;
    if (hasDOM) {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.autoplay = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('muted', '');
      this.video = v;
    }

    this.hands = [];
    this._two = new TwoHandDetector();
    this.twoHands = this._two.state;

    this._slots = [new Slot(0, o), new Slot(1, o)];
    this._dets = [new Detection(), new Detection()];
    this._depth = new RangeCalibrator();
    this._depthT = -1;
    this._aspect = o.width / o.height;
    this._minInterval = 1000 / o.maxFps - 4;
    this._lastDetectAt = -1e9;
    this._lastVideoTime = -1;
    this._lastVideoAdvance = 0;
    this._lastTs = 0;
    this._detectErrors = 0;
    this._updateErrors = 0;
    this._lastWarn = -1e9;
    this._startToken = 0;
    this._starting = null;
    this._stream = null;
    this._landmarker = null;
    this._modelP = null;
    this._switching = false;
    this._onTrackEnded = () => this._fail('ended');
    this._synthRes = null;
    this._synthT0 = null;
    this._synthOffset = 0;
  }

  // ---- lifecycle ---------------------------------------------------------

  /** Open the webcam and load the model. Resolves to this tracker. */
  start() {
    if (this.running && this.mode === 'camera') return Promise.resolve(this);
    if (this._starting) return this._starting;
    this._starting = this._start().finally(() => {
      this._starting = null;
    });
    return this._starting;
  }

  async _start() {
    if (this.running) this.stop();
    const token = ++this._startToken;
    this.error = null;
    this._setStatus('loading');
    let stream = null;
    try {
      if (!hasDOM || typeof navigator === 'undefined') throw trackerError('unsupported');
      if (globalThis.isSecureContext === false) throw trackerError('insecure');
      const md = navigator.mediaDevices;
      if (!md || typeof md.getUserMedia !== 'function') throw trackerError('unsupported');

      const modelP = this._loadModel();
      modelP.catch(() => {}); // reported below, after the camera
      stream = await this._openCamera(md);
      if (token !== this._startToken) throw trackerError('aborted');
      await this._attachVideo(stream);
      if (token !== this._startToken) throw trackerError('aborted');
      await modelP;
      if (token !== this._startToken) throw trackerError('aborted');

      this._stream = stream;
      for (const tr of stream.getVideoTracks()) tr.addEventListener('ended', this._onTrackEnded);
      this.mode = 'camera';
      this.running = true;
      this._resetTracking();
      this._setStatus('running');
      return this;
    } catch (e) {
      const err = e && e.userMessage ? e : trackerError('camera', e);
      if (stream && stream !== this._stream) stopStream(stream);
      if (token === this._startToken) {
        this._releaseCamera();
        this.running = false;
        this.mode = null;
        this.error = err;
        this._setStatus(err.code === 'aborted' ? 'idle' : 'error');
      }
      throw err;
    }
  }

  /**
   * Demo mode: animated synthetic hands through the same pipeline (no camera,
   * no model download). Cycles through every gesture and a wai
   * (DEMO_SEGMENT seconds per pose pair).
   * @param {object} [o]
   * @param {number} [o.at=0]  start this many seconds into the choreography
   */
  startSynthetic({ at = 0 } = {}) {
    if (this.running) this.stop();
    this._startToken++;
    this.error = null;
    this.mode = 'synthetic';
    this.running = true;
    this._aspect = this.opts.width / this.opts.height;
    this._synthT0 = null;
    this._synthOffset = Number.isFinite(at) && at > 0 ? at : 0;
    this._rng = makeRng(1234);
    this._resetTracking();
    this._setStatus('running');
    return Promise.resolve(this);
  }

  /** Release the camera (the loaded model is kept for a quick restart). */
  stop() {
    this._startToken++;
    this._releaseCamera();
    this.running = false;
    this.mode = null;
    this._resetTracking();
    if (this.status !== 'idle') this._setStatus('idle');
  }

  /** stop() and free the model. */
  dispose() {
    this.stop();
    try {
      if (this._landmarker) this._landmarker.close();
    } catch {
      /* ignore */
    }
    this._landmarker = null;
    this._modelP = null;
  }

  /** Seconds of demo time elapsed (synthetic mode), or 0. */
  get demoTime() {
    return this._synthT0 == null ? this._synthOffset : (this._lastDetectAt - this._synthT0) / 1000 + this._synthOffset;
  }

  /** Name of the pose pair the synthetic demo is showing, e.g. ['point', 'victory']. */
  demoPoses(atSeconds = this.demoTime) {
    const i = Math.floor(atSeconds / DEMO_SEGMENT) % DEMO_SEQ.length;
    return DEMO_SEQ[i];
  }

  _setStatus(s) {
    if (this.status === s) return;
    this.status = s;
    try {
      if (typeof this.onstatuschange === 'function') this.onstatuschange(s, this.error);
      if (typeof Event === 'function') this.dispatchEvent(new Event('statuschange'));
    } catch (e) {
      this._warn('statuschange handler threw', e);
    }
  }

  _fail(code, cause) {
    const err = trackerError(code, cause);
    this._startToken++;
    this._releaseCamera();
    this.running = false;
    this.mode = null;
    this._resetTracking();
    this.error = err;
    this._setStatus('error');
  }

  async _openCamera(md) {
    const o = this.opts;
    const constraints = {
      audio: false,
      video: { facingMode: 'user', width: { ideal: o.width }, height: { ideal: o.height }, frameRate: { ideal: 30 } },
    };
    try {
      return await md.getUserMedia(constraints);
    } catch (e) {
      if (e && (e.name === 'OverconstrainedError' || e.name === 'ConstraintNotSatisfiedError')) {
        try {
          return await md.getUserMedia({ audio: false, video: true });
        } catch (e2) {
          throw cameraError(e2);
        }
      }
      throw cameraError(e);
    }
  }

  async _attachVideo(stream) {
    const v = this.video;
    v.srcObject = stream;
    await withTimeout(
      new Promise((resolve, reject) => {
        if (v.readyState >= 1 && v.videoWidth > 0) return resolve();
        v.onloadedmetadata = () => resolve();
        v.onerror = () => reject(trackerError('camera'));
      }),
      10000,
      'camera',
    );
    v.onloadedmetadata = null;
    v.onerror = null;
    try {
      await v.play();
    } catch (e) {
      // Autoplay of a muted inline video should be allowed; if not, frames still
      // arrive once the page gets a user gesture, so do not fail hard.
      this._warn('video.play() was refused', e);
    }
    if (v.videoWidth && v.videoHeight) this._aspect = v.videoWidth / v.videoHeight;
  }

  _releaseCamera() {
    const s = this._stream;
    this._stream = null;
    if (s) {
      for (const tr of s.getVideoTracks()) tr.removeEventListener('ended', this._onTrackEnded);
      stopStream(s);
    }
    const v = this.video;
    if (v) {
      try {
        v.pause();
      } catch {
        /* ignore */
      }
      if (v.srcObject) {
        if (v.srcObject !== s) stopStream(v.srcObject);
        v.srcObject = null;
      }
    }
  }

  _loadModel() {
    if (this._landmarker) return Promise.resolve(this._landmarker);
    if (this._modelP) return this._modelP;
    const o = this.opts;
    this._modelP = (async () => {
      let vision;
      try {
        vision = await withTimeout(import(/* @vite-ignore */ o.visionUrl), o.importTimeoutMs, 'model');
      } catch (e) {
        throw e && e.userMessage ? e : trackerError('model', e);
      }
      const fileset = await withTimeout(vision.FilesetResolver.forVisionTasks(o.wasmUrl), o.importTimeoutMs, 'model');
      const make = (delegate) =>
        withTimeout(
          vision.HandLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: o.modelUrl, delegate },
            runningMode: 'VIDEO',
            numHands: this.maxHands,
            minHandDetectionConfidence: o.minDetectionConfidence,
            minHandPresenceConfidence: o.minPresenceConfidence,
            minTrackingConfidence: o.minTrackingConfidence,
          }),
          o.modelTimeoutMs,
          'model',
          (late) => late && late.close && late.close(),
        );
      let delegate = o.delegate === 'CPU' ? 'CPU' : 'GPU';
      let lm;
      try {
        lm = await make(delegate);
      } catch (e) {
        if (delegate !== 'GPU') throw e;
        this._warn('GPU delegate failed, using CPU', e);
        delegate = 'CPU';
        lm = await make('CPU');
      }
      this._vision = vision;
      this._fileset = fileset;
      this._landmarker = lm;
      this.delegate = delegate;
      return lm;
    })().catch((e) => {
      this._modelP = null;
      throw e && e.userMessage ? e : trackerError('model', e);
    });
    return this._modelP;
  }

  async _fallbackToCpu() {
    if (this._switching || !this._vision) return;
    this._switching = true;
    this._warn('GPU inference failing, switching to CPU');
    try {
      const o = this.opts;
      const lm = await this._vision.HandLandmarker.createFromOptions(this._fileset, {
        baseOptions: { modelAssetPath: o.modelUrl, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numHands: this.maxHands,
        minHandDetectionConfidence: o.minDetectionConfidence,
        minHandPresenceConfidence: o.minPresenceConfidence,
        minTrackingConfidence: o.minTrackingConfidence,
      });
      const old = this._landmarker;
      this._landmarker = lm;
      this._modelP = Promise.resolve(lm);
      this.delegate = 'CPU';
      this._detectErrors = 0;
      try {
        if (old) old.close();
      } catch {
        /* ignore */
      }
    } catch (e) {
      this._fail('model', e);
    } finally {
      this._switching = false;
    }
  }

  // ---- per frame ---------------------------------------------------------

  /**
   * Call once per animation frame. Runs detection only when the camera has a
   * new frame (capped at maxFps); otherwise it only expires lost hands.
   * Never throws.
   */
  update(nowMs) {
    try {
      if (!Number.isFinite(nowMs)) nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      // one-shot flags last exactly one update
      this.twoHands.waiFresh = false;
      this.twoHands.clap = false;
      for (const s of this._slots) s.stab.state.fresh = false;
      if (this.running) {
        if (this.mode === 'synthetic') this._synthTick(nowMs);
        else if (this.mode === 'camera') this._cameraTick(nowMs);
      }
      this._expire(nowMs);
    } catch (e) {
      this._updateErrors++;
      this._warn('update() error (ignored)', e);
    }
    return this.hands;
  }

  _cameraTick(nowMs) {
    const v = this.video;
    const lm = this._landmarker;
    if (!lm || !v || this._switching) return;
    if (hasDOM && document.hidden) return;
    if (v.readyState < 2 || !v.videoWidth) return;
    if (nowMs - this._lastDetectAt < this._minInterval) return;
    const vt = v.currentTime;
    if (vt === this._lastVideoTime) {
      // camera frozen (unplugged without an 'ended' event, OS suspended it, ...)
      if (nowMs - this._lastVideoAdvance > 4000 && this._stream) {
        const live = this._stream.getVideoTracks().some((tr) => tr.readyState === 'live');
        if (!live) this._fail('ended');
      }
      return;
    }
    this._lastVideoTime = vt;
    this._lastVideoAdvance = nowMs;
    this._lastDetectAt = nowMs;
    const ts = Math.max(Math.round(nowMs), this._lastTs + 1);
    this._lastTs = ts;
    let res;
    try {
      res = lm.detectForVideo(v, ts);
      this._detectErrors = 0;
    } catch (e) {
      this._detectErrors++;
      this._warn('detectForVideo failed', e);
      if (this._detectErrors >= 3 && this.delegate === 'GPU') this._fallbackToCpu();
      else if (this._detectErrors >= 30) this._fail('model', e);
      return;
    }
    this._aspect = v.videoWidth / v.videoHeight;
    this.ingest(res, nowMs);
  }

  _synthTick(nowMs) {
    if (nowMs - this._lastDetectAt < this._minInterval) return;
    if (this._synthT0 == null) this._synthT0 = nowMs;
    this._lastDetectAt = nowMs;
    const t = (nowMs - this._synthT0) / 1000 + this._synthOffset;
    this.ingest(this._synthResult(t), nowMs);
  }

  _synthResult(t) {
    const ar = this._aspect;
    if (!this._synthRes) {
      const mk = () => {
        const a = [];
        for (let i = 0; i < POINTS; i++) a.push({ x: 0, y: 0, z: 0 });
        return a;
      };
      this._synthRes = {
        landmarks: [mk(), mk()],
        worldLandmarks: [],
        handedness: [[{ categoryName: 'Right', displayName: 'Right', score: 0.97, index: 0 }], [{ categoryName: 'Left', displayName: 'Left', score: 0.96, index: 1 }]],
        _iso: [makeLandmarks(), makeLandmarks()],
        _pa: {},
        _pb: {},
        _p: {},
      };
    }
    const R = this._synthRes;
    const seg = Math.floor(t / DEMO_SEGMENT);
    const local = t - seg * DEMO_SEGMENT;
    const cur = DEMO_SEQ[seg % DEMO_SEQ.length];
    const prev = DEMO_SEQ[(seg + DEMO_SEQ.length - 1) % DEMO_SEQ.length];
    const k = seg === 0 ? 1 : Math.min(1, local / DEMO_BLEND);
    const ks = k * k * (3 - 2 * k);
    const hands = this.maxHands === 1 ? ['Right'] : ['Right', 'Left'];
    R.landmarks.length = hands.length;
    R.handedness.length = hands.length;
    for (let h = 0; h < hands.length; h++) {
      const hand = hands[h];
      const a = demoParams(prev[h], hand, t, ar, R._pa);
      const b = demoParams(cur[h], hand, t, ar, R._pb);
      const p = blendParams(a, b, ks, R._p);
      p.handedness = hand;
      const iso = synthHand(p, R._iso[h]);
      const lms = R.landmarks[h] || (R.landmarks[h] = R._iso[h].map(() => ({ x: 0, y: 0, z: 0 })));
      const n = 0.0035;
      for (let i = 0; i < POINTS; i++) {
        lms[i].x = 1 - (iso[i][0] + this._rng() * n) / ar; // back to raw (unmirrored) camera coords
        lms[i].y = iso[i][1] + this._rng() * n;
        lms[i].z = (iso[i][2] + this._rng() * n * 2) / ar;
      }
      const label = this.opts.swapHandedness ? (hand === 'Right' ? 'Left' : 'Right') : hand;
      R.handedness[h] = [{ categoryName: label, displayName: label, score: 0.97, index: h }];
    }
    return R;
  }

  /**
   * Feed one HandLandmarkerResult-shaped object
   * ({ landmarks: [[{x,y,z}×21]], handedness: [[{categoryName, score}]] },
   * raw unmirrored normalized coords) taken at `nowMs`. Used internally for
   * camera + demo frames; public so tests/tools can drive the pipeline.
   */
  ingest(result, nowMs, aspect = this._aspect) {
    if (Number.isFinite(aspect) && aspect > 0) this._aspect = aspect;
    const ar = this._aspect;
    const t = nowMs / 1000;
    const lms = (result && result.landmarks) || [];
    const hd = (result && (result.handedness || result.handednesses)) || [];

    // 1. parse detections
    let n = 0;
    for (let i = 0; i < lms.length && n < this.maxHands; i++) {
      const src = lms[i];
      if (!src || src.length < POINTS) continue;
      const d = this._dets[n];
      let ok = true;
      for (let j = 0; j < POINTS; j++) {
        const p = src[j];
        const x = p && p.x, y = p && p.y, z = (p && p.z) || 0;
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          ok = false;
          break;
        }
        d.P[j][0] = (1 - x) * ar;
        d.P[j][1] = y;
        d.P[j][2] = z * ar;
      }
      if (!ok) continue;
      const cat = hd[i] && hd[i][0];
      let label = cat && (cat.categoryName || cat.displayName) === 'Left' ? 'Left' : 'Right';
      if (this.opts.swapHandedness) label = label === 'Left' ? 'Right' : 'Left';
      d.label = label;
      d.score = cat && Number.isFinite(cat.score) ? cat.score : 0.5;
      const P = d.P;
      for (let k = 0; k < 3; k++) d.palm[k] = (P[0][k] + P[5][k] + P[9][k] + P[13][k] + P[17][k]) / 5;
      d.size = Math.max(0.02, 0.6 * (Math.hypot(P[9][0] - P[0][0], P[9][1] - P[0][1], P[9][2] - P[0][2]) + Math.hypot(P[5][0] - P[17][0], P[5][1] - P[17][1], P[5][2] - P[17][2])));
      d.used = false;
      n++;
    }
    // drop a duplicate detection of the same hand (same label, same shape
    // and place; two different hands pressed together in a wai are kept)
    if (n === 2) {
      const a = this._dets[0], b = this._dets[1];
      if (a.label === b.label) {
        let sum = 0;
        for (let j = 0; j < POINTS; j++) sum += Math.hypot(a.P[j][0] - b.P[j][0], a.P[j][1] - b.P[j][1]);
        if (sum / POINTS < 0.3 * Math.max(a.size, b.size)) {
          if (b.score > a.score) this._swapDets();
          n = 1;
        }
      }
    }

    // 2. match detections to slots by nearest palm (+ handedness as tie-breaker)
    const slots = this._slots;
    const s0 = slots[0], s1 = slots[1];
    let m0 = -1, m1 = -1; // detection index matched to slot 0 / 1
    const cost = (s, d) => {
      if (!s.active) return Infinity;
      const sz = Math.max(s.state.size, d.size, 0.03);
      const dd = Math.hypot(s.f.palm[0] - d.palm[0], s.f.palm[1] - d.palm[1]) / sz;
      return dd + (s.state.handedness === d.label ? 0 : 0.6);
    };
    const MAXC = 3.5;
    if (n > 0) {
      const d0 = this._dets[0], d1 = this._dets[1];
      if (n === 1) {
        const c0 = cost(s0, d0), c1 = cost(s1, d0);
        if (c0 <= c1 && c0 < MAXC) m0 = 0;
        else if (c1 < MAXC) m1 = 0;
      } else if (s0.active && s1.active) {
        const c00 = cost(s0, d0), c11 = cost(s1, d1), c01 = cost(s0, d1), c10 = cost(s1, d0);
        if (c00 + c11 <= c01 + c10) {
          if (c00 < MAXC) m0 = 0;
          if (c11 < MAXC) m1 = 1;
        } else {
          if (c01 < MAXC) m0 = 1;
          if (c10 < MAXC) m1 = 0;
        }
      } else if (s0.active || s1.active) {
        // one known hand: it keeps the nearer detection
        const act = s0.active ? s0 : s1;
        const ca = cost(act, d0), cb = cost(act, d1);
        const pick = ca <= cb ? 0 : 1;
        if (Math.min(ca, cb) < MAXC) {
          if (act === s0) m0 = pick;
          else m1 = pick;
        }
      }
    }
    if (m0 >= 0) this._dets[m0].used = true;
    if (m1 >= 0) this._dets[m1].used = true;

    // 3. new hands take a free slot (or replace a lost, unmatched one)
    for (let i = 0; i < n; i++) {
      const d = this._dets[i];
      if (d.used) continue;
      let target = -1;
      if (!s0.active && m0 < 0) target = 0;
      else if (!s1.active && m1 < 0) target = 1;
      else if (m0 < 0 && s0.state.lost) target = 0;
      else if (m1 < 0 && s1.state.lost) target = 1;
      if (target < 0) continue;
      slots[target].reset();
      if (target === 0) m0 = i;
      else m1 = i;
      d.used = true;
    }

    // 4. update
    if (m0 >= 0) s0.observe(this._dets[m0], nowMs, ar, this);
    else if (s0.active) s0.state.lost = true;
    if (m1 >= 0) s1.observe(this._dets[m1], nowMs, ar, this);
    else if (s1.active) s1.state.lost = true;

    // 5. two-hand gestures, then per-hand gestures (suppressed during a wai)
    if (s0.active && s1.active) {
      this._two.update(s0.f, s1.f, t, s0.state.lost || s1.state.lost);
    } else this._two.update(null, null, t);
    const busy = this.twoHands.wai || this._two.waiScore > 0.45;
    s0.classify(nowMs, busy);
    s1.classify(nowMs, busy);

    if (n > 0) {
      const dt = nowMs - this.lastDetectionMs;
      if (dt > 0 && dt < 1000) this.fps += (1000 / dt - this.fps) * 0.1;
      this.lastDetectionMs = nowMs;
    }
    this.detections++;
    this._rebuildHands();
  }

  _swapDets() {
    const d = this._dets;
    const tmp = d[0];
    d[0] = d[1];
    d[1] = tmp;
  }

  _depthUpdate(size, t) {
    const dt = this._depthT < 0 ? 0 : Math.max(0, t - this._depthT);
    this._depthT = t;
    return this._depth.update(size, dt);
  }

  _expire(nowMs) {
    let changed = false;
    const stale = Math.max(120, 2.5 * (1000 / this.opts.maxFps));
    for (const s of this._slots) {
      if (!s.active) continue;
      const age = nowMs - s.lastSeen;
      if (age > this.opts.lostMs || age < -1000) {
        s.reset();
        changed = true;
      } else if (age > stale && !s.state.lost) {
        s.state.lost = true;
      }
    }
    if (changed) this._rebuildHands();
    if (this.twoHands.wai && !(this._slots[0].active && this._slots[1].active)) this._two.update(null, null, nowMs / 1000);
  }

  _rebuildHands() {
    const h = this.hands;
    h.length = 0;
    for (const s of this._slots) if (s.active) h.push(s.state);
  }

  _resetTracking() {
    for (const s of this._slots) s.reset();
    this._two.reset();
    this.hands.length = 0;
    this._lastDetectAt = -1e9;
    this._lastVideoTime = -1;
    this._lastVideoAdvance = typeof performance !== 'undefined' ? performance.now() : 0;
    this.fps = 0;
  }

  _warn(msg, e) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this._lastWarn < 5000) return;
    this._lastWarn = now;
    if (typeof console !== 'undefined') console.warn(`[HandTracker] ${msg}`, e ? e.message || e : '');
  }

  // ---- drawing -----------------------------------------------------------

  /**
   * Picture-in-picture: sepia/gold camera image (or a dark stage in demo
   * mode) with a gold skeleton overlay, clipped to a rounded rectangle.
   */
  drawPreview(ctx, x, y, w, h, { mirrored = true, radius = Math.min(w, h) * 0.08, labels = true, video = true } = {}) {
    if (!ctx || !(w > 0) || !(h > 0)) return;
    ctx.save();
    try {
      roundRect(ctx, x, y, w, h, radius);
      ctx.clip();
      const v = this.video;
      const hasVideo = video && this.mode === 'camera' && v && v.readyState >= 2 && v.videoWidth > 0;
      const vw = hasVideo ? v.videoWidth : this._aspect * 480;
      const vh = hasVideo ? v.videoHeight : 480;
      const k = Math.max(w / vw, h / vh);
      const dw = vw * k, dh = vh * k;
      const ox = x + (w - dw) / 2, oy = y + (h - dh) / 2;

      if (hasVideo) {
        ctx.save();
        if (mirrored) {
          ctx.translate(2 * x + w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(v, ox, oy, dw, dh);
        ctx.restore();
        // sepia/gold tone: take hue+saturation from gold, keep the luminance
        ctx.globalCompositeOperation = 'color';
        ctx.fillStyle = '#b8894a';
        ctx.fillRect(x, y, w, h);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgba(120, 86, 52, 0.55)';
        ctx.fillRect(x, y, w, h);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        const g = ctx.createRadialGradient(x + w * 0.5, y + h * 0.42, 0, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.75);
        g.addColorStop(0, '#3b2a18');
        g.addColorStop(1, '#120c07');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
      }
      // vignette
      const vg = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.35, x + w / 2, y + h / 2, Math.max(w, h) * 0.72);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(10,5,0,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(x, y, w, h);

      const lw = Math.max(1.2, Math.min(w, h) / 180);
      for (const hand of this.hands) this._drawHand(ctx, hand, ox, oy, dw, dh, mirrored, lw, labels);

      if (this.mode === 'synthetic') {
        ctx.font = `${Math.round(Math.max(10, h * 0.045))}px system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(232, 193, 112, 0.7)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('DEMO · สาธิต', x + radius * 0.6 + 4, y + 6);
      }
    } catch (e) {
      this._warn('drawPreview error', e);
    }
    ctx.restore();
    // frame
    ctx.save();
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius);
    ctx.strokeStyle = 'rgba(232, 193, 112, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  _drawHand(ctx, hand, ox, oy, dw, dh, mirrored, lw, labels) {
    const L = hand.landmarks;
    const sx = (i) => ox + (mirrored ? L[i][0] : 1 - L[i][0]) * dw;
    const sy = (i) => oy + L[i][1] * dh;
    ctx.save();
    ctx.globalAlpha = hand.lost ? 0.35 : 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // palm plate
    ctx.beginPath();
    for (const [n, i] of [0, 1, 5, 9, 13, 17].entries()) {
      if (n === 0) ctx.moveTo(sx(i), sy(i));
      else ctx.lineTo(sx(i), sy(i));
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(232, 193, 112, 0.13)';
    ctx.fill();
    // bones: dark under-stroke, then gold
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.moveTo(sx(a), sy(a));
      ctx.lineTo(sx(b), sy(b));
    }
    ctx.strokeStyle = 'rgba(25, 14, 4, 0.6)';
    ctx.lineWidth = lw * 3.2;
    ctx.stroke();
    ctx.strokeStyle = '#d9b061';
    ctx.lineWidth = lw * 1.5;
    ctx.stroke();
    // joints
    ctx.fillStyle = '#f3dc9f';
    ctx.beginPath();
    for (let i = 0; i < POINTS; i++) {
      if (TIP_IDS.includes(i)) continue;
      ctx.moveTo(sx(i) + lw * 1.4, sy(i));
      ctx.arc(sx(i), sy(i), lw * 1.4, 0, Math.PI * 2);
    }
    ctx.fill();
    // fingertips: jewel dots
    for (const i of TIP_IDS) {
      ctx.beginPath();
      ctx.arc(sx(i), sy(i), lw * 2.6, 0, Math.PI * 2);
      ctx.fillStyle = '#2a1a08';
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = '#f0c96a';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx(i), sy(i), lw * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe9b0';
      ctx.fill();
    }
    if (labels) {
      const g = hand.gesture;
      const px = ox + (mirrored ? hand.palm.x : 1 - hand.palm.x) * dw;
      const py = Math.max(sy(0), sy(9)) + lw * 10;
      const text = g.name !== 'none' ? `${GESTURE_LABELS[g.name].th} · ${GESTURE_LABELS[g.name].en}` : hand.handedness === 'Left' ? 'ซ้าย L' : 'ขวา R';
      ctx.font = `600 ${Math.round(lw * 7)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.lineWidth = lw * 2.5;
      ctx.strokeStyle = 'rgba(20, 10, 2, 0.8)';
      ctx.strokeText(text, px, py);
      ctx.fillStyle = g.name !== 'none' ? '#ffd98a' : 'rgba(243, 220, 159, 0.75)';
      ctx.fillText(text, px, py);
    }
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function stopStream(s) {
  try {
    for (const tr of s.getTracks()) tr.stop();
  } catch {
    /* ignore */
  }
}

export { trackerError, GESTURE_LABELS, HAND_CONNECTIONS };
