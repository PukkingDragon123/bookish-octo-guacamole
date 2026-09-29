// Signal filters for hand tracking. Pure (no DOM), allocation-free per sample.
//
//   OneEuroFilter   - the 1€ filter (Casiez et al. 2012): an adaptive low-pass
//                     whose cutoff rises with speed, so a still hand is steady
//                     and a fast hand has little lag. Times are in SECONDS.
//   OneEuroVec      - N independent 1€ filters sharing parameters.
//   RangeCalibrator - auto-calibrating running min/max (log domain) with slow
//                     decay, mapping a value to 0..1 (used for hand depth).
//   Hysteresis      - two-threshold boolean latch.

const TAU = Math.PI * 2;

function smoothingFactor(dt, cutoff) {
  const r = TAU * cutoff * dt;
  return r / (r + 1);
}

export class OneEuroFilter {
  /**
   * @param {object} [o]
   * @param {number} [o.minCutoff=1]  Hz, cutoff when still (lower = steadier)
   * @param {number} [o.beta=0]       cutoff gain per unit/s of speed (higher = less lag)
   * @param {number} [o.dCutoff=1]    Hz, cutoff of the speed estimate
   */
  constructor({ minCutoff = 1, beta = 0, dCutoff = 1 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.reset();
  }

  reset() {
    this.x = 0;
    this.dx = 0;
    this.t = -1;
    this.ready = false;
  }

  /** Filter sample `v` taken at time `t` (seconds). Returns the filtered value. */
  filter(v, t) {
    if (!Number.isFinite(v)) return this.ready ? this.x : 0;
    if (!this.ready) {
      this.x = v;
      this.dx = 0;
      this.t = t;
      this.ready = true;
      return v;
    }
    let dt = t - this.t;
    // Out-of-order or duplicate timestamps: treat as one nominal 60 Hz step.
    if (!(dt > 1e-4)) dt = 1 / 60;
    // After a long gap (tab hidden, hand re-found) the old state is meaningless.
    if (dt > 1) {
      this.x = v;
      this.dx = 0;
      this.t = t;
      return v;
    }
    this.t = t;
    const rawDx = (v - this.x) / dt;
    const ad = smoothingFactor(dt, this.dCutoff);
    this.dx += ad * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    const a = smoothingFactor(dt, cutoff);
    this.x += a * (v - this.x);
    return this.x;
  }

  get value() {
    return this.x;
  }

  /** Filtered derivative (units per second). */
  get velocity() {
    return this.dx;
  }
}

export class OneEuroVec {
  constructor(n, opts) {
    this.filters = [];
    for (let i = 0; i < n; i++) this.filters.push(new OneEuroFilter(opts));
  }

  reset() {
    for (const f of this.filters) f.reset();
  }

  /** Filters src[i] into out[i] (out may be src). */
  filterInto(src, t, out = src) {
    const fs = this.filters;
    for (let i = 0; i < fs.length; i++) out[i] = fs[i].filter(src[i], t);
    return out;
  }
}

export class RangeCalibrator {
  /**
   * Maps a positive value (e.g. palm size) to 0..1 relative to the range seen
   * recently. Works in the log domain because apparent size ~ 1/distance.
   * @param {object} [o]
   * @param {number} [o.lo=0.12]       initial "far" value
   * @param {number} [o.hi=0.34]       initial "near" value
   * @param {number} [o.minRatio=1.7]  the range never shrinks below hi/lo = minRatio
   * @param {number} [o.decay=0.03]    per-second rate at which the extremes relax toward the current value
   */
  constructor({ lo = 0.12, hi = 0.34, minRatio = 1.7, decay = 0.03 } = {}) {
    this.init = { lo, hi };
    this.minSpan = Math.log(minRatio);
    this.decay = decay;
    this.reset();
  }

  reset() {
    this.lo = Math.log(this.init.lo);
    this.hi = Math.log(this.init.hi);
  }

  update(v, dt) {
    if (!(v > 0) || !Number.isFinite(v)) return this.map(Math.exp((this.lo + this.hi) / 2));
    const x = Math.log(v);
    if (x < this.lo) this.lo = x;
    if (x > this.hi) this.hi = x;
    const k = dt > 0 ? 1 - Math.exp(-Math.min(dt, 1) * this.decay) : 0;
    this.lo += (x - this.lo) * k;
    this.hi += (x - this.hi) * k;
    const span = this.hi - this.lo;
    if (span < this.minSpan) {
      const mid = (this.hi + this.lo) / 2;
      this.lo = mid - this.minSpan / 2;
      this.hi = mid + this.minSpan / 2;
    }
    return this.map(v);
  }

  /** Map without updating the calibration. */
  map(v) {
    if (!(v > 0)) return 0;
    const t = (Math.log(v) - this.lo) / (this.hi - this.lo);
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }
}

export class Hysteresis {
  /** Latches true above `on`, false below `off` (on > off). */
  constructor(on, off, initial = false) {
    this.on = on;
    this.off = off;
    this.state = initial;
  }

  update(v) {
    if (this.state) {
      if (v < this.off) this.state = false;
    } else if (v > this.on) this.state = true;
    return this.state;
  }
}
