// Hand feature extraction + gesture classification. Pure: no DOM, so it runs
// (and is unit-tested) in node: `node tools/test-gestures.mjs`.
//
// Coordinate convention for everything in this file ("iso" coords):
//   21 landmarks [x, y, z] in MediaPipe order, MIRRORED like a selfie
//   (the user's right hand appears on the right), isotropic units of the
//   image height: x = (1 - mpX) * aspect, y = mpY, z = mpZ * aspect.
//   y points down, z points away from the camera (smaller z = closer).
//
// Landmark indices: 0 wrist · thumb 1 CMC 2 MCP 3 IP 4 tip · index 5-8 ·
// middle 9-12 · ring 13-16 · pinky 17-20 (MCP, PIP, DIP, tip).

import { Hysteresis } from './filters.js';

export const GESTURES = ['fist', 'point', 'open', 'jeeb', 'wong', 'victory', 'horns', 'thumbsUp'];
export const GESTURE_LABELS = {
  fist: { th: 'กำหมัด', en: 'Fist' },
  point: { th: 'ชี้', en: 'Point' },
  open: { th: 'แบมือ', en: 'Open palm' },
  jeeb: { th: 'จีบ', en: 'Jeeb' },
  wong: { th: 'ตั้งวง', en: 'Wong' },
  victory: { th: 'ชูสองนิ้ว', en: 'Victory' },
  horns: { th: 'เขายักษ์', en: 'Horns' },
  thumbsUp: { th: 'ยกนิ้วโป้ง', en: 'Thumbs up' },
  none: { th: '—', en: 'none' },
};

export const FINGERS = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];
export const TIP_IDS = [4, 8, 12, 16, 20];
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

const DEG = Math.PI / 180;

export function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function dist3(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Angle between vectors (b - a) and (d - c), radians.
function angleBetween(a, b, c, d) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = d[0] - c[0], vy = d[1] - c[1], vz = d[2] - c[2];
  const lu = Math.sqrt(ux * ux + uy * uy + uz * uz);
  const lv = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (lu < 1e-9 || lv < 1e-9) return 0;
  let c0 = (ux * vx + uy * vy + uz * vz) / (lu * lv);
  c0 = c0 > 1 ? 1 : c0 < -1 ? -1 : c0;
  return Math.acos(c0);
}

// Mean splay angle (deg) between adjacent straight fingers mapped to spread 0..1.
const SPREAD_LO = 3;
const SPREAD_HI = 14;

// Fuzzy memberships on a curl value.
const straight = (c) => 1 - smoothstep(0.26, 0.48, c);
const curled = (c) => smoothstep(0.42, 0.62, c);

/** Preallocated feature record (reused by extractFeatures). */
export function createFeatures() {
  return {
    valid: false,
    palm: [0, 0, 0], // iso coords of palm centre (avg of wrist + 4 MCPs)
    size: 0, // palm size, iso units: 0.6 * (|wrist→middle MCP| + |index MCP→pinky MCP|) ≈ wrist→MCP length
    roll: 0, // radians, 0 = fingers up, + = clockwise on screen
    up: [0, -1], // unit 2D wrist→middle-MCP direction
    normal: [0, 0, -1], // unit palm-side normal (points out of the palm)
    facingRaw: 0, // -1..1: + palm toward camera, - back of hand toward camera
    facing: 'palm',
    curl: [0, 0, 0, 0, 0],
    gaps: [0, 0, 0], // splay angles (deg) index|middle, middle|ring, ring|pinky
    spread: 0,
    fan: 0, // splay of middle/ring/pinky only (for jeeb)
    pinch: 0,
    pinchDist: 1, // thumb tip ↔ index tip, palm sizes
    thumbLat: 0, // thumb tip offset from index MCP toward the thumb side, palm sizes
    thumbNrm: 0, // same, along the palm normal (in front of the palm)
    thumbOut: 0, // 0 = thumb tucked in / alongside, 1 = thumb clearly out
    thumbUp: 0, // cos(angle between thumb direction and screen up)
    thumbTop: 0, // how far the thumb tip is above every other finger landmark, palm sizes
    tips: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // hand-local fingertips
    tipIso: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // fingertips in iso screen coords
  };
}

/**
 * Compute hand features from 21 iso landmarks.
 * @param {number[][]} P  21 × [x, y, z] (see top of file)
 * @param {'Left'|'Right'} handedness  the user's actual hand
 * @param {object} [out]  record from createFeatures() to fill
 */
export function extractFeatures(P, handedness, out = createFeatures()) {
  out.valid = false;
  if (!P || P.length < 21) return out;
  for (let i = 0; i < 21; i++) {
    const p = P[i];
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) return out;
  }
  const W = P[0], I = P[5], M = P[9], R = P[13], K = P[17];

  // Palm centre and size.
  const pc = out.palm;
  pc[0] = (W[0] + I[0] + M[0] + R[0] + K[0]) / 5;
  pc[1] = (W[1] + I[1] + M[1] + R[1] + K[1]) / 5;
  pc[2] = (W[2] + I[2] + M[2] + R[2] + K[2]) / 5;
  const size = 0.6 * (dist3(W, M) + dist3(I, K));
  if (!(size > 1e-6)) return out;
  out.size = size;

  // Screen-space up vector and roll.
  let ux = M[0] - W[0], uy = M[1] - W[1];
  const ul = Math.hypot(ux, uy);
  if (ul > 1e-9) {
    ux /= ul;
    uy /= ul;
  } else {
    ux = 0;
    uy = -1;
  }
  out.up[0] = ux;
  out.up[1] = uy;
  out.roll = Math.atan2(ux, -uy);

  // Palm plane: n = (index MCP - wrist) × (pinky MCP - wrist).
  const ax = I[0] - W[0], ay = I[1] - W[1], az = I[2] - W[2];
  const bx = K[0] - W[0], by = K[1] - W[1], bz = K[2] - W[2];
  let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
  const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1e-9;
  nx /= nl;
  ny /= nl;
  nz /= nl;
  const hs = handedness === 'Left' ? -1 : 1;
  // In mirrored view a right hand showing its palm has n.z > 0.
  out.facingRaw = hs * nz;
  out.facing = out.facingRaw >= 0 ? 'palm' : 'back';
  // Palm-side normal (the side fingers curl toward).
  const pnx = -hs * nx, pny = -hs * ny, pnz = -hs * nz;
  out.normal[0] = pnx;
  out.normal[1] = pny;
  out.normal[2] = pnz;

  // Finger curls (index..pinky): joint angles, PIP weighted most, blended
  // with how far the tip reaches past the PIP (both rotation/scale invariant).
  const curl = out.curl;
  for (let f = 1; f < 5; f++) {
    const j = FINGERS[f];
    const mcp = P[j[0]], pip = P[j[1]], dip = P[j[2]], tip = P[j[3]];
    let a1 = angleBetween(W, mcp, mcp, pip);
    // Bending backwards at the knuckle (Thai dancers' fingers) is not a curl.
    const l1 = dist3(W, mcp) || 1e-9, l2 = dist3(mcp, pip) || 1e-9;
    const dx = (pip[0] - mcp[0]) / l2 - (mcp[0] - W[0]) / l1;
    const dy = (pip[1] - mcp[1]) / l2 - (mcp[1] - W[1]) / l1;
    const dz = (pip[2] - mcp[2]) / l2 - (mcp[2] - W[2]) / l1;
    if (dx * pnx + dy * pny + dz * pnz < 0) a1 *= 0.35;
    const a2 = angleBetween(mcp, pip, pip, dip);
    const a3 = angleBetween(pip, dip, dip, tip);
    const cA = (0.6 * a1 + a2 + 0.5 * a3) / (172 * DEG);
    const e = dist3(tip, W) / (dist3(pip, W) || 1e-9);
    const cE = (1.36 - e) / (1.36 - 0.7);
    curl[f] = clamp01(0.65 * clamp01(cA) + 0.35 * clamp01(cE));
  }
  // Thumb curl from its MCP and IP joints.
  {
    const a2 = angleBetween(P[1], P[2], P[2], P[3]);
    const a3 = angleBetween(P[2], P[3], P[3], P[4]);
    curl[0] = clamp01((a2 + a3 - 20 * DEG) / (90 * DEG));
  }

  // Splay: angles between adjacent fingers (MCP→DIP) projected on the palm
  // plane, weighted by how straight both fingers are.
  let wsum = 0, gsum = 0;
  const px = [0, 0, 0, 0, 0], py = [0, 0, 0, 0, 0], pz = [0, 0, 0, 0, 0];
  for (let f = 1; f < 5; f++) {
    const j = FINGERS[f];
    let vx = P[j[2]][0] - P[j[0]][0], vy = P[j[2]][1] - P[j[0]][1], vz = P[j[2]][2] - P[j[0]][2];
    const d = vx * pnx + vy * pny + vz * pnz;
    vx -= d * pnx;
    vy -= d * pny;
    vz -= d * pnz;
    const l = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1e-9;
    px[f] = vx / l;
    py[f] = vy / l;
    pz[f] = vz / l;
  }
  let fanW = 0, fanS = 0;
  for (let g = 0; g < 3; g++) {
    const a = g + 1, b = g + 2;
    let c = px[a] * px[b] + py[a] * py[b] + pz[a] * pz[b];
    c = c > 1 ? 1 : c < -1 ? -1 : c;
    const ang = Math.acos(c) / DEG;
    out.gaps[g] = ang;
    const w = straight(curl[a]) * straight(curl[b]) + 1e-3;
    const ga = ang > 40 ? 40 : ang;
    wsum += w;
    gsum += w * ga;
    if (g > 0) {
      fanW += w;
      fanS += w * ga;
    }
  }
  out.spread = clamp01((gsum / wsum - SPREAD_LO) / (SPREAD_HI - SPREAD_LO));
  out.fan = clamp01((fanS / fanW - SPREAD_LO) / (SPREAD_HI - SPREAD_LO));

  // Pinch: thumb tip to index tip.
  const pd = dist3(P[4], P[8]) / size;
  out.pinchDist = pd;
  out.pinch = clamp01((0.6 - pd) / (0.6 - 0.22));

  // Thumb placement relative to the index knuckle, in the palm frame.
  {
    // lateral axis: pinky MCP → index MCP, orthogonal to the palm normal
    let lx = I[0] - K[0], ly = I[1] - K[1], lz = I[2] - K[2];
    const d = lx * pnx + ly * pny + lz * pnz;
    lx -= d * pnx;
    ly -= d * pny;
    lz -= d * pnz;
    const ll = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1e-9;
    const rx = P[4][0] - I[0], ry = P[4][1] - I[1], rz = P[4][2] - I[2];
    out.thumbLat = (rx * lx + ry * ly + rz * lz) / ll / size;
    out.thumbNrm = (rx * pnx + ry * pny + rz * pnz) / size;
    // out to the side, or (less trusted: image z is shallow) sticking far forward
    const reach = Math.max(out.thumbLat, 0.8 * Math.abs(out.thumbNrm) - 0.25);
    out.thumbOut = smoothstep(0.1, 0.32, reach);
  }

  // Thumb pointing up on screen, and standing above the other fingers.
  {
    const tx = P[4][0] - P[2][0], ty = P[4][1] - P[2][1];
    const tl = Math.hypot(tx, ty) || 1e-9;
    out.thumbUp = -ty / tl;
    let minY = Infinity;
    for (let i = 5; i < 21; i++) if (P[i][1] < minY) minY = P[i][1];
    out.thumbTop = (minY - P[4][1]) / size;
  }

  // Fingertips in hand-local 2D coords (palm centre origin, fingers toward -y, palm-size units).
  for (let f = 0; f < 5; f++) {
    const t = P[TIP_IDS[f]];
    const dx = t[0] - pc[0], dy = t[1] - pc[1];
    out.tips[f][0] = (dx * -uy + dy * ux) / size;
    out.tips[f][1] = -(dx * ux + dy * uy) / size;
    out.tipIso[f][0] = t[0];
    out.tipIso[f][1] = t[1];
  }

  out.valid = true;
  return out;
}

// ---------------------------------------------------------------------------
// Classification

function min4(a, b, c, d) {
  return Math.min(a, b, c, d);
}

/** Per-gesture score record (reused). */
export function createScores() {
  const s = {};
  for (const g of GESTURES) s[g] = 0;
  return s;
}

/**
 * Score every gesture 0..1 from features and pick the best (≥ 0.5, else 'none').
 * `f.facing` is honoured, so pass a hysteresis-filtered value when you have one.
 */
export function classifyGesture(f, out = { name: 'none', score: 0, scores: createScores() }) {
  const s = out.scores;
  if (!f || !f.valid) {
    for (const g of GESTURES) s[g] = 0;
    out.name = 'none';
    out.score = 0;
    return out;
  }
  const c = f.curl;
  const sT = straight(c[0]), sI = straight(c[1]), sM = straight(c[2]), sR = straight(c[3]), sP = straight(c[4]);
  const cI = curled(c[1]), cM = curled(c[2]), cR = curled(c[3]), cP = curled(c[4]);

  const thumbUp = Math.min(
    1 - smoothstep(0.35, 0.6, c[0]), // thumb fairly straight
    smoothstep(0.45, 0.75, f.thumbUp), // pointing up (within ~50°)
    smoothstep(0.0, 0.2, f.thumbTop), // and standing above the fist
  );
  const four = min4(sI, sM, sR, sP);
  const fourCurled = min4(cI, cM, cR, cP);
  const pinchLo = 1 - smoothstep(0.35, 0.6, f.pinch);
  const pinchHi = smoothstep(0.5, 0.8, f.pinch);
  // open vs wong: one "openness" axis from finger splay and thumb abduction,
  // so a clearly-out thumb can make up for modest splay (and vice versa) but
  // conflicting cues land in the dead zone between the two.
  const openness = 0.45 * f.spread + 0.55 * f.thumbOut;
  const palm = f.facing === 'back' ? 0.2 : 1;

  s.fist = fourCurled * (1 - thumbUp);
  s.thumbsUp = Math.min(fourCurled, thumbUp);
  s.point = min4(sI, cM, cR, cP);
  s.victory = min4(sI, sM, cR, cP);
  s.horns = min4(sI, cM, cR, sP);
  s.open = Math.min(four, smoothstep(0.52, 0.72, openness), pinchLo, 1 - smoothstep(0.45, 0.75, c[0])) * palm;
  s.wong = Math.min(four, 1 - smoothstep(0.28, 0.46, openness), 1 - smoothstep(0.3, 0.6, f.thumbOut), pinchLo);
  s.jeeb = Math.min(pinchHi, sM, sR, sP) * (0.65 + 0.35 * smoothstep(0.1, 0.4, f.fan));
  void sT;

  let best = 'none', bs = 0;
  for (const g of GESTURES) {
    if (s[g] > bs) {
      bs = s[g];
      best = g;
    }
  }
  out.name = bs >= 0.5 ? best : 'none';
  out.score = bs;
  return out;
}

// ---------------------------------------------------------------------------
// Temporal stabilisation

/**
 * Turns noisy per-frame classifications into held gestures.
 * - a candidate must persist `minHold` seconds before it becomes the gesture
 * - the current gesture is sticky: it stays while its score ≥ `keepScore`
 *   unless another gesture beats it by `margin`
 * - `fresh` is true for exactly one update, when a (non-'none') gesture
 *   becomes stable. Since stability requires the previous gesture to have
 *   been replaced for a while, a held gesture must be released before it can
 *   fire again.
 */
export class GestureStabilizer {
  constructor({ minHold = 0.25, noneHold = 0.15, keepScore = 0.33, margin = 0.15 } = {}) {
    this.minHold = minHold;
    this.noneHold = noneHold;
    this.keepScore = keepScore;
    this.margin = margin;
    this.state = { name: 'none', held: 0, fresh: false, confidence: 0 };
    this.reset();
  }

  reset() {
    this.stable = 'none';
    this.since = -1;
    this.cand = 'none';
    this.candSince = -1;
    this.conf = 0;
    const st = this.state;
    st.name = 'none';
    st.held = 0;
    st.fresh = false;
    st.confidence = 0;
  }

  /** @param raw result of classifyGesture  @param t seconds */
  update(raw, t) {
    const st = this.state;
    st.fresh = false;
    if (this.since < 0) {
      this.since = t;
      this.candSince = t;
    }
    let cand = raw.name;
    const cur = this.stable;
    if (cur !== 'none' && cand !== cur) {
      const cs = raw.scores[cur] || 0;
      if (cs >= this.keepScore && (cand === 'none' || raw.score < cs + this.margin)) cand = cur;
    }
    if (cand !== this.cand) {
      this.cand = cand;
      this.candSince = t;
    }
    if (cand !== this.stable) {
      const need = cand === 'none' ? this.noneHold : this.minHold;
      if (t - this.candSince >= need - 1e-6) {
        this.stable = cand;
        this.since = this.candSince;
        if (cand !== 'none') st.fresh = true;
      }
    }
    const score = this.stable === 'none' ? 1 - raw.score : raw.scores[this.stable] || 0;
    this.conf += (score - this.conf) * 0.35;
    st.name = this.stable;
    st.held = Math.max(0, t - this.since);
    st.confidence = clamp01(this.conf);
    return st;
  }
}

/** Palm/back latch so `facing` does not flicker when the hand is edge-on. */
export class FacingFilter {
  constructor(threshold = 0.18) {
    this.h = new Hysteresis(threshold, -threshold, true);
    this.primed = false;
  }

  reset() {
    this.primed = false;
  }

  update(facingRaw) {
    if (!this.primed) {
      this.h.state = facingRaw >= 0;
      this.primed = true;
    }
    return this.h.update(facingRaw) ? 'palm' : 'back';
  }
}

// ---------------------------------------------------------------------------
// Two-hand gestures

/**
 * wai (ไหว้): both palms pressed together, upright, fingers extended.
 * clap: palms that were apart slam together fast (true for one update).
 * Feed features (iso) of the two hands each detection frame.
 */
export class TwoHandDetector {
  constructor({ waiHold = 0.3, waiRelease = 0.2 } = {}) {
    this.waiHold = waiHold;
    this.waiRelease = waiRelease;
    this.state = { wai: false, waiFresh: false, clap: false };
    this.hist = new Float64Array(32); // ring buffer of (t, d)
    this.reset();
  }

  reset() {
    this.hn = 0;
    this.hi = 0;
    this.waiSince = -1;
    this.waiOffSince = -1;
    this.clapArmed = true;
    this.lastClap = -10;
    this.state.wai = false;
    this.state.waiFresh = false;
    this.state.clap = false;
    this.waiScore = 0;
  }

  /** Score 0..1 of how wai-like the pair is. */
  static waiScore(a, b) {
    if (!a || !b || !a.valid || !b.valid) return 0;
    const s = (a.size + b.size) / 2;
    if (!(s > 0)) return 0;
    const dx = Math.abs(a.palm[0] - b.palm[0]) / s;
    const dy = Math.abs(a.palm[1] - b.palm[1]) / s;
    // index/middle fingertips of the two hands should meet
    const tipD = Math.min(
      Math.hypot(a.tipIso[1][0] - b.tipIso[1][0], a.tipIso[1][1] - b.tipIso[1][1]),
      Math.hypot(a.tipIso[2][0] - b.tipIso[2][0], a.tipIso[2][1] - b.tipIso[2][1]),
    ) / s;
    const ext = (f) => (f.curl[1] + f.curl[2] + f.curl[3] + f.curl[4]) / 4;
    const sizeRatio = Math.min(a.size, b.size) / Math.max(a.size, b.size);
    return Math.min(
      1 - smoothstep(0.7, 1.2, dx),
      1 - smoothstep(0.4, 0.8, dy),
      1 - smoothstep(0.5, 0.95, tipD),
      1 - smoothstep(35 * DEG, 55 * DEG, Math.abs(a.roll)),
      1 - smoothstep(35 * DEG, 55 * DEG, Math.abs(b.roll)),
      1 - smoothstep(0.35, 0.55, ext(a)),
      1 - smoothstep(0.35, 0.55, ext(b)),
      smoothstep(0.45, 0.65, sizeRatio),
    );
  }

  /**
   * @param a,b  features (from extractFeatures, plus `tipIso`) or null
   * @param t    seconds
   * @param lost true if either hand is only remembered (not seen this frame)
   */
  update(a, b, t, lost = false) {
    const st = this.state;
    st.waiFresh = false;
    st.clap = false;
    const both = a && b && a.valid && b.valid;
    const score = both ? TwoHandDetector.waiScore(a, b) : 0;
    this.waiScore = score;

    // wai with hold + release hysteresis; a briefly lost hand keeps it alive
    const on = st.wai ? score > 0.3 || (lost && both) : score > 0.55 && !lost;
    if (on) {
      this.waiOffSince = -1;
      if (this.waiSince < 0) this.waiSince = t;
      if (!st.wai && t - this.waiSince >= this.waiHold) {
        st.wai = true;
        st.waiFresh = true;
      }
    } else {
      this.waiSince = -1;
      if (st.wai) {
        if (this.waiOffSince < 0) this.waiOffSince = t;
        if (t - this.waiOffSince >= this.waiRelease) st.wai = false;
      }
    }

    // clap: palm distance collapses fast
    if (both && !lost) {
      const s = (a.size + b.size) / 2;
      const d = Math.hypot(a.palm[0] - b.palm[0], a.palm[1] - b.palm[1]) / s;
      const h = this.hist;
      h[this.hi * 2] = t;
      h[this.hi * 2 + 1] = d;
      this.hi = (this.hi + 1) % 16;
      if (this.hn < 16) this.hn++;
      let maxD = 0;
      for (let k = 0; k < this.hn; k++) {
        const tk = h[k * 2], dk = h[k * 2 + 1];
        if (t - tk <= 0.3 && dk > maxD) maxD = dk;
      }
      if (d > 1.7) this.clapArmed = true;
      if (this.clapArmed && d < 1.0 && maxD - d > 1.2 && t - this.lastClap > 0.35) {
        st.clap = true;
        this.clapArmed = false;
        this.lastClap = t;
      }
    } else if (!both) {
      this.hn = 0;
    }
    return st;
  }
}

// ---------------------------------------------------------------------------
// Synthetic hand model (tests + demo mode)
//
// A simple articulated right hand in its own frame (palm-length units, wrist
// at the origin, fingers toward -y, palm facing the camera = palm-side normal
// -z), mirrored in x for a left hand, then rotated, scaled and placed.

const CANON = {
  cmc: [-0.3, -0.36, -0.05],
  mcp: [null, [-0.32, -0.99, 0], [-0.05, -1.0, 0], [0.19, -0.92, 0.01], [0.4, -0.8, 0.03]],
  len: [[0.45, 0.4, 0.31], [0.52, 0.32, 0.27], [0.57, 0.37, 0.28], [0.52, 0.35, 0.26], [0.43, 0.26, 0.22]],
  base: [0, -2, 0, 3, 7], // resting fan, degrees toward the pinky side
  fan: [0, -15, -2, 11, 24], // extra fan at spread = 1
};

const THUMB_ALONG = [-0.12, -0.98, -0.12];
const THUMB_OUT = [-0.78, -0.6, -0.15];
const THUMB_IN = [0.7, -0.55, -0.12];
const THUMB_BEND = [0.8, 0.1, -0.15];

function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  v[0] /= l;
  v[1] /= l;
  v[2] /= l;
  return v;
}

/**
 * Pose parameters (all optional):
 *   handedness 'Right'|'Left'
 *   curl [t,i,m,r,p]  0 straight .. 1 curled; negative bends fingers backward
 *   spread 0..1       finger splay
 *   thumbOut -1..1    -1 folded across the palm, 0 alongside the index, 1 out to the side
 *   pinch 0..1        pull thumb tip and index tip together
 *   roll, pitch, yaw  radians (roll = on-screen clockwise; yaw π = back of hand to camera)
 *   x, y              palm-centre position (iso units)
 *   size              palm length wrist→middle MCP (iso units)
 * Returns 21 × [x,y,z] iso landmarks (z relative to the wrist, like MediaPipe).
 */
export function synthHand(p = {}, out) {
  const {
    handedness = 'Right', curl = [0, 0, 0, 0, 0], spread = 0.5, thumbOut = 0.6, pinch = 0,
    roll = 0, pitch = 0, yaw = 0, x = 0.66, y = 0.5, size = 0.22,
  } = p;
  if (!out) {
    out = [];
    for (let i = 0; i < 21; i++) out.push([0, 0, 0]);
  }
  const L = out;
  L[0][0] = 0; L[0][1] = 0; L[0][2] = 0;

  // Fingers.
  for (let f = 1; f < 5; f++) {
    const m = CANON.mcp[f];
    const j = FINGERS[f];
    L[j[0]][0] = m[0]; L[j[0]][1] = m[1]; L[j[0]][2] = m[2];
    const a = (CANON.base[f] + spread * CANON.fan[f]) * DEG;
    const dx = Math.sin(a), dy = -Math.cos(a); // finger direction in the palm plane
    const c = curl[f] || 0;
    const flex = c >= 0 ? [c * 80, c * 100, c * 65] : [c * 60, c * 15, c * 8];
    let th = 0;
    let px = m[0], py = m[1], pz = m[2];
    for (let k = 0; k < 3; k++) {
      th += flex[k] * DEG;
      const ln = CANON.len[f][k];
      // bend toward the palm side (-z)
      px += ln * dx * Math.cos(th);
      py += ln * dy * Math.cos(th);
      pz += -ln * Math.sin(th);
      L[j[k + 1]][0] = px; L[j[k + 1]][1] = py; L[j[k + 1]][2] = pz;
    }
  }

  // Thumb.
  {
    const cmc = CANON.cmc;
    L[1][0] = cmc[0]; L[1][1] = cmc[1]; L[1][2] = cmc[2];
    const t = Math.max(-1, Math.min(1, thumbOut));
    const dAlong = THUMB_ALONG;
    const dTo = t >= 0 ? THUMB_OUT : THUMB_IN;
    const k = Math.abs(t);
    const d = norm3([dAlong[0] + (dTo[0] - dAlong[0]) * k, dAlong[1] + (dTo[1] - dAlong[1]) * k, dAlong[2] + (dTo[2] - dAlong[2]) * k]);
    // bend direction: toward the palm and the pinky side, orthogonal to d
    const b = THUMB_BEND.slice();
    const bd = b[0] * d[0] + b[1] * d[1] + b[2] * d[2];
    b[0] -= bd * d[0]; b[1] -= bd * d[1]; b[2] -= bd * d[2];
    norm3(b);
    const c = curl[0] || 0;
    const flex = [0, c * 50, c * 70];
    let th = 0;
    let px = cmc[0], py = cmc[1], pz = cmc[2];
    for (let s = 0; s < 3; s++) {
      th += flex[s] * DEG;
      const ln = CANON.len[0][s];
      const cs = Math.cos(th), sn = Math.sin(th);
      px += ln * (d[0] * cs + b[0] * sn);
      py += ln * (d[1] * cs + b[1] * sn);
      pz += ln * (d[2] * cs + b[2] * sn);
      L[2 + s][0] = px; L[2 + s][1] = py; L[2 + s][2] = pz;
    }
  }

  // Pinch: draw thumb tip and index tip to their meeting point.
  if (pinch > 0) {
    const k = Math.min(1, pinch);
    const T = L[4], X = L[8];
    const mx = (T[0] + X[0]) / 2, my = (T[1] + X[1]) / 2, mz = (T[2] + X[2]) / 2;
    // tips end ~0.12 apart (finger pads touching)
    const gx = X[0] - T[0], gy = X[1] - T[1], gz = X[2] - T[2];
    const gl = Math.hypot(gx, gy, gz) || 1;
    const hx = (gx / gl) * 0.06, hy = (gy / gl) * 0.06, hz = (gz / gl) * 0.06;
    const move = (P, tx, ty, tz, w) => {
      P[0] += (tx - P[0]) * w;
      P[1] += (ty - P[1]) * w;
      P[2] += (tz - P[2]) * w;
    };
    const dT = [mx - hx - T[0], my - hy - T[1], mz - hz - T[2]];
    const dX = [mx + hx - X[0], my + hy - X[1], mz + hz - X[2]];
    for (const [id, w] of [[3, 0.45], [4, 1]]) move(L[id], L[id][0] + dT[0], L[id][1] + dT[1], L[id][2] + dT[2], w * k);
    for (const [id, w] of [[6, 0.15], [7, 0.5], [8, 1]]) move(L[id], L[id][0] + dX[0], L[id][1] + dX[1], L[id][2] + dX[2], w * k);
  }

  // Left hand = mirror image.
  if (handedness === 'Left') for (let i = 0; i < 21; i++) L[i][0] = -L[i][0];

  // Rotate about the palm centre: R = Rz(roll) · Rx(pitch) · Ry(yaw).
  let cx = 0, cy = 0, cz = 0;
  for (const i of [0, 5, 9, 13, 17]) {
    cx += L[i][0] / 5;
    cy += L[i][1] / 5;
    cz += L[i][2] / 5;
  }
  const cyw = Math.cos(yaw), syw = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  for (let i = 0; i < 21; i++) {
    let X = L[i][0] - cx, Y = L[i][1] - cy, Z = L[i][2] - cz;
    // yaw (about y)
    let x1 = X * cyw + Z * syw, z1 = -X * syw + Z * cyw, y1 = Y;
    // pitch (about x)
    const y2 = y1 * cp - z1 * sp, z2 = y1 * sp + z1 * cp;
    y1 = y2;
    z1 = z2;
    // roll (about z; + = clockwise with y down)
    const x3 = x1 * cr - y1 * sr, y3 = x1 * sr + y1 * cr;
    L[i][0] = x + x3 * size;
    L[i][1] = y + y3 * size;
    L[i][2] = z1 * size;
  }
  const wz = L[0][2];
  for (let i = 0; i < 21; i++) L[i][2] -= wz;
  return L;
}

/** Synthetic pose presets for each gesture (used by tests and the demo). */
export const POSES = {
  open: { curl: [0.05, 0.03, 0.02, 0.03, 0.05], spread: 1, thumbOut: 1 },
  fist: { curl: [0.75, 1, 1, 1, 1], spread: 0.2, thumbOut: -0.35 },
  point: { curl: [0.7, 0.02, 1, 1, 1], spread: 0.3, thumbOut: -0.4 },
  victory: { curl: [0.75, 0.02, 0.03, 1, 1], spread: 0.9, thumbOut: -0.5 },
  horns: { curl: [0.7, 0.03, 1, 1, 0.04], spread: 0.6, thumbOut: -0.5 },
  thumbsUp: { curl: [0.05, 1, 1, 1, 1], spread: 0.2, thumbOut: 0.75, roll: 55 * DEG },
  jeeb: { curl: [0.3, 0.45, 0.02, 0.04, 0.06], spread: 0.9, thumbOut: 0.1, pinch: 1 },
  wong: { curl: [0.6, -0.25, -0.25, -0.25, -0.25], spread: 0, thumbOut: -0.2 },
  relaxed: { curl: [0.35, 0.35, 0.4, 0.45, 0.5], spread: 0.4, thumbOut: 0.2 },
};
