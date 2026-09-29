// ตัวตลกหนังตะลุง — the comic characters of southern Thai shadow play,
// plus a few everyday villagers (ชาวบ้าน).
//
// Comic puppets are almost entirely solid black hide. Their personality
// lives in the cut outline (noses, lips, bellies, fingers) and in a few
// punched details: eye holes, dotted collars and belts, a checked or
// striped sarong. Each has a separate jaw worked by a string so it can
// talk.
//
// Every figure is authored in one "figure space": x = 0 is the body's
// centre line, y = 0 the top of the head, +x is the way the puppet faces.
// Each part is painted into its own sprite whose box coordinates ARE
// figure coordinates (the sprite's ox/oy shift them into the canvas), so a
// joint's `at` and `pivot` are the same figure point and every rest `rot`
// is 0.

import {
  paintSprite, leather, dye, line, hole, holes, dotLine, dotFill, slit, cut, curve, smooth, poly,
  rivet, eye, plaid, INK, rng, hashStr, blobPts,
} from '../../art/leather.js';

const DEG = Math.PI / 180;

// ------------------------------------------------------------ geometry
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const rotP = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
// local -> figure: scale, rotate by `a`, then move to `o`
const xf = (pts, o, a = 0, s = 1) => pts.map((p) => { const q = rotP([p[0] * s, p[1] * s], a); return [q[0] + o[0], q[1] + o[1]]; });
// direction measured from straight down (+y) toward forward (+x), degrees
const dirD = (deg) => [Math.sin(deg * DEG), Math.cos(deg * DEG)];
const scaleAbout = (pts, c, k) => pts.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k]);

// Low-frequency wobble so outlines look knife-cut rather than drawn with
// a compass. Position based, so neighbouring parts wobble alike.
function wob(pts, amt, seed) {
  const r = rng(seed);
  const p = [r() * 6.3, r() * 6.3, r() * 6.3, r() * 6.3];
  return pts.map(([x, y]) => [
    x + amt * (Math.sin(0.23 * x + 0.17 * y + p[0]) + 0.5 * Math.sin(0.61 * x - 0.43 * y + p[1])) / 1.5,
    y + amt * (Math.sin(0.19 * x - 0.21 * y + p[2]) + 0.5 * Math.sin(-0.47 * x + 0.57 * y + p[3])) / 1.5,
  ]);
}

function bboxOf(shapes, m = 6) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of shapes) for (const [x, y] of s) {
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return [Math.floor(x0 - m), Math.floor(y0 - m), Math.ceil(x1 + m), Math.ceil(y1 + m)];
}

// Outline of a tapering stroke along `center`. hl / hr are the half widths
// on the left (-x for a downward stroke, i.e. the back) and right (front):
// a number, [start, end], or a function of t in 0..1. Ends are round caps.
function taper(center, hl, hr = hl, { steps = 6, smoothIt = true, caps = [true, true] } = {}) {
  const c = smoothIt && center.length > 2 ? curve(center, false, steps) : center.map((p) => p.slice());
  const n = c.length;
  const L = [0];
  for (let i = 1; i < n; i++) L.push(L[i - 1] + dist(c[i - 1], c[i]));
  const T = L[n - 1] || 1;
  const f = (w, t) => (typeof w === 'function' ? w(t) : Array.isArray(w) ? w[0] + (w[1] - w[0]) * t : w);
  const left = [], right = [], tan = [];
  for (let i = 0; i < n; i++) {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    tan.push([tx, ty]);
    const t = L[i] / T;
    const wl = f(hl, t), wr = f(hr, t);
    left.push([c[i][0] - ty * wl, c[i][1] + tx * wl]);
    right.push([c[i][0] + ty * wr, c[i][1] - tx * wr]);
  }
  const cap = (pa, pb, t, sign) => {
    const m = lerp(pa, pb, 0.5), r = dist(pa, pb) / 2 || 0.01;
    const nx = (pa[0] - m[0]) / r, ny = (pa[1] - m[1]) / r;
    const out = [];
    for (let k = 1; k < 8; k++) {
      const th = (k / 8) * Math.PI;
      out.push([m[0] + (nx * Math.cos(th) + sign * t[0] * Math.sin(th)) * r, m[1] + (ny * Math.cos(th) + sign * t[1] * Math.sin(th)) * r]);
    }
    return out;
  };
  const rgt = right.slice().reverse();
  const out = [...left];
  if (caps[1]) out.push(...cap(left[n - 1], right[n - 1], tan[n - 1], 1));
  out.push(...rgt);
  if (caps[0]) out.push(...cap(right[0], left[0], tan[0], -1));
  return out;
}

// A limb segment between two joints, with round ends centred on the joints
// so the pieces overlap cleanly however they rotate. `bl` / `br` bulge the
// back / front edge (muscle, calf); `pk` is where the bulge peaks (0..1).
function seg(a, b, ra, rb, { bl = 0, br = 0, pk = 0.5, mid = null } = {}) {
  const bump = (t) => Math.sin(Math.PI * (t < pk ? (t / pk) * 0.5 : 0.5 + ((t - pk) / (1 - pk)) * 0.5));
  const c = mid ? [a, mid, b] : [a, lerp(a, b, 0.5), b];
  return taper(c, (t) => ra + (rb - ra) * t + bl * bump(t), (t) => ra + (rb - ra) * t + br * bump(t), { steps: 5 });
}

// Closed scalloped ellipse (curly hair masses, cloth frills).
function scallop(cx, cy, rx, ry, { n = 14, depth = 0.12, a0 = 0, a1 = Math.PI * 2, seed = 1 } = {}) {
  const r = rng(seed);
  const out = [];
  const N = n * 4;
  for (let i = 0; i <= N; i++) {
    const a = a0 + ((a1 - a0) * i) / N;
    const ph = (i % 4) / 4;
    const k = 1 - depth * (0.5 - 0.5 * Math.cos(ph * Math.PI * 2)) * (0.8 + r() * 0.4);
    out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return out;
}

// ------------------------------------------------------------ painting
// A sprite whose box coordinates are figure coordinates.
function figSprite(name, box, draw, seed) {
  const [x0, y0, x1, y1] = box;
  const pad = 3;
  const s = paintSprite(x1 - x0, y1 - y0, (ctx, info) => {
    ctx.translate(-x0, -y0);
    draw(ctx, info);
  }, { pad, name, seed });
  s.ox = pad - x0;
  s.oy = pad - y0;
  return s;
}

// Dashed knife slits along a line (striped cloth, ribs).
function dashes(ctx, pts, { w = 1.3, dash = 5, gap = 3, smoothIt = true, off = 0 } = {}) {
  const p = smoothIt && pts.length > 2 ? smooth(pts, false) : poly(pts, false);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.setLineDash([dash, gap]);
  ctx.lineDashOffset = off;
  ctx.stroke(p);
  ctx.restore();
}

// Punch a polygon (square check, diamond ...) out of the hide.
function punch(ctx, pts, smoothIt = false) {
  cut(ctx, smoothIt ? smooth(pts) : poly(pts));
}

// Big checked lattice: square windows separated by thin leather bars,
// clipped to `clipPts` (ผ้าตาหมากรุก).
function lattice(ctx, clipPts, { cell = 12, bar = 3.4, ang = 0, seed = 3 } = {}) {
  const r = rng(seed);
  const b = bboxOf([clipPts], 0);
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  const R = Math.hypot(b[2] - b[0], b[3] - b[1]) / 2 + cell;
  ctx.save();
  ctx.clip(smooth(clipPts));
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  for (let i = -R; i < R; i += cell) {
    for (let j = -R; j < R; j += cell) {
      const s = cell - bar;
      const q = [[0, 0], [s, 0], [s, s], [0, s]].map(([u, v]) => {
        const t = rotP([i + u + (r() - 0.5) * 0.9, j + v + (r() - 0.5) * 0.9], ang);
        return [t[0] + cx, t[1] + cy];
      });
      ctx.moveTo(...q[0]);
      for (let k = 1; k < 4; k++) ctx.lineTo(...q[k]);
      ctx.closePath();
    }
  }
  ctx.fill();
  ctx.restore();
}

// C-shaped curl punched into hair (ผมหยิก).
function curlHole(ctx, x, y, r, a0 = 0.3) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = Math.max(0.9, r * 0.42);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, r, a0 * Math.PI, (a0 + 1.45) * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.8, r * 0.26), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Round comic eye (ตาตลก): a punched hole with a leather pupil; `lid`
// closes the top (sleepy / old).
function comicEye(ctx, x, y, r, { pupil = 0.5, look = [0.35, 0.1], lid = 0, ang = 0, ry = 0.86 } = {}) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * ry, ang, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = INK.leather;
  if (pupil) {
    ctx.beginPath();
    ctx.arc(x + look[0] * r, y + look[1] * r, r * pupil, 0, Math.PI * 2);
    ctx.fill();
  }
  if (lid) {
    ctx.beginPath();
    ctx.rect(x - r * 1.2, y - r * 1.2, r * 2.4, r * (0.2 + lid * 1.2));
    ctx.fill();
  }
  ctx.restore();
}

// Crescent eye (ตาเสี้ยว): a sliver of lamp light under a heavy lid.
function crescentEye(ctx, x, y, r, { off = [-0.25, -0.42] } = {}) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = INK.leather;
  ctx.beginPath();
  ctx.arc(x + off[0] * r, y + off[1] * r, r * 0.92, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function tintAll(ctx, box, color, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(box[0] - 5, box[1] - 5, box[2] - box[0] + 10, box[3] - box[1] + 10);
  ctx.restore();
}

const dots = (ctx, pts, r = 1.1, spacing = 4.2, seed = 1) => dotLine(ctx, pts, { spacing, r, seed });

// ------------------------------------------------------------ hands
// Hands are drawn in a local frame: wrist pivot at (0, 0), the arm coming
// from -y, fingers toward +y, thumb / pointing side toward +x (forward).
function finger(base, ang, len, w, curl = 0, w1 = 0.62) {
  const d1 = dirD(ang), d2 = dirD(ang + curl);
  const m = [base[0] + d1[0] * len * 0.55, base[1] + d1[1] * len * 0.55];
  const tip = [m[0] + d2[0] * len * 0.45, m[1] + d2[1] * len * 0.45];
  return taper([base, m, tip], [w / 2, (w / 2) * w1], [w / 2, (w / 2) * w1], { steps: 4 });
}

const PALM = [[-6, -8], [-7.5, 1], [-7.2, 10], [-5, 17], [0, 20.5], [5.5, 19.5], [8.2, 13], [8.5, 4], [6.5, -5], [0.5, -9.5]];

function handLocal(style, o = {}) {
  const k = o.k ?? 1;
  const L = o.fl ?? 1; // finger length factor
  const shapes = [PALM];
  let grip = [1, 13], rod = [0.5, 8];
  const deco = [];
  const fw = o.fw ?? 3.6;
  if (style === 'relaxed' || style === 'spread' || style === 'claw') {
    const spread = style === 'spread' ? 2.1 : style === 'claw' ? 1.3 : 1;
    const curl = style === 'claw' ? 40 : style === 'spread' ? 4 : 20;
    const bases = [[-5, 16], [-2, 19.5], [1.8, 20], [5.2, 18]];
    const angs = [-12, -3, 7, 17];
    const lens = [17, 21, 20, 15];
    bases.forEach((b, i) => shapes.push(finger(b, angs[i] * spread + (style === 'spread' ? 8 : 0), lens[i] * L, fw * (i === 3 ? 0.9 : 1), curl)));
    shapes.push(finger([6.5, 5], style === 'spread' ? 82 : 58, 14 * L, fw * 1.25, style === 'spread' ? 8 : -22));
    rod = [0.5, 9];
    grip = [1, 12];
  } else if (style === 'fist' || style === 'point' || style === 'index') {
    shapes.push(blobPts(1.5, 15, 9.2, 8, { seed: 11, wobble: 0.05 }));
    shapes.push(finger([6, 3], 40, 13, 5.2, -10)); // thumb over the fist
    deco.push((ctx) => {
      for (let i = 0; i < 3; i++) slit(ctx, [[-3 + i * 3.4, 22], [-1.6 + i * 3.4, 18.5]], 0.9);
    });
    grip = [1.5, 15];
    rod = [0.5, 8];
    if (style === 'point') {
      // ไอ้เท่ง's famous forefinger: long, knuckly and crooked.
      const P = o.finger ?? [[7, 13], [17, 17.5], [26, 15], [36, 16], [45, 22], [50, 30], [49, 36], [45, 38]];
      shapes.push(taper(P, [2.9, 1.6], [2.9, 1.6], { steps: 5 }));
      shapes.push(blobPts(26, 15.5, 3.4, 3.1, { seed: 5 }));
      shapes.push(blobPts(44.5, 22, 3, 2.8, { seed: 6 }));
      deco.push((ctx) => { slit(ctx, [[25, 13.5], [27.5, 16.8]], 0.7); slit(ctx, [[43.5, 20], [46, 23.5]], 0.7); });
    } else if (style === 'index') {
      // a straight, pompous forefinger along the hand
      shapes.push(finger([4.5, 18], 12, 22 * L, 4, 4, 0.7));
    }
  }
  return { shapes: shapes.map((s) => s.map((p) => [p[0] * k, p[1] * k])), grip: [grip[0] * k, grip[1] * k], rod: [rod[0] * k, rod[1] * k], deco, k };
}

// ------------------------------------------------------------ feet
// Local frame at the ankle pivot; sole at y = h, toes toward +x.
function footLocal({ len = 30, heel = 12, h = 22, toes = 0, w = 6, k = 1 } = {}) {
  const sole = h;
  const shapes = [[
    [-w, -10], [-w - 1.5, 2], [-heel + 1, 10], [-heel, sole - 5], [-heel + 3, sole], [4, sole + 0.6],
    [len * 0.55, sole + 0.6], [len * 0.85, sole], [len, sole - 2.5], [len * 0.97, sole - 6.5], [len * 0.72, sole - 9.5],
    [len * 0.42, sole - 13], [w + 2, -1], [w, -10],
  ]];
  if (toes) {
    // long splayed comic toes
    for (let i = 0; i < toes; i++) {
      const t = i / Math.max(1, toes - 1);
      const b = [len * (0.6 + 0.2 * t), sole - 4 - 3.5 * t];
      shapes.push(taper([b, [len + 3 + 5 * t, sole - 2 - 5 * t + 1.5], [len + 7 + 6 * t, sole - 6 * t + 2.5]], [2.5, 1.6], [2.5, 1.6], { steps: 3 }));
    }
  }
  return shapes.map((s) => s.map((p) => [p[0] * k, p[1] * k]));
}

// ------------------------------------------------------------ builder
const PARENT = {
  head: 'torso', jaw: 'head', skirt: 'torso',
  upperArmF: 'torso', forearmF: 'upperArmF', handF: 'forearmF',
  upperArmB: 'torso', forearmB: 'upperArmB', handB: 'forearmB',
  thighF: 'skirt', shinF: 'thighF', thighB: 'skirt', shinB: 'thighB',
};
const Z = {
  torso: 0, skirt: 1, jaw: 1.5, head: 2,
  upperArmF: 3, handF: 4, forearmF: 5,
  upperArmB: -8, forearmB: -7, handB: -9,
  thighF: -4, shinF: -5, thighB: -6, shinB: -7,
};
const JOINT = {
  head: { lim: [-22 * DEG, 22 * DEG], stiff: 0.7 },
  jaw: { lim: [0, 0.5], stiff: 0.55, mass: 0.25 },
  skirt: { lim: [-14 * DEG, 14 * DEG], stiff: 0.75, mass: 1.1 },
  upperArmF: { lim: null, stiff: 0.12 },
  upperArmB: { lim: null, stiff: 0.12 },
  forearmF: { lim: [-150 * DEG, 12 * DEG], stiff: 0.18 },
  forearmB: { lim: [-150 * DEG, 12 * DEG], stiff: 0.18 },
  handF: { lim: [-55 * DEG, 55 * DEG], stiff: 0.3 },
  handB: { lim: [-55 * DEG, 55 * DEG], stiff: 0.3 },
  thighF: { lim: [-75 * DEG, 75 * DEG], stiff: 0.45 },
  thighB: { lim: [-75 * DEG, 75 * DEG], stiff: 0.45 },
  shinF: { lim: [-8 * DEG, 125 * DEG], stiff: 0.5 },
  shinB: { lim: [-8 * DEG, 125 * DEG], stiff: 0.5 },
};

// Arm: S shoulder, E elbow, W wrist; r = [shoulder, elbow, wrist] half
// widths; hand style + handOpts.
function armParts(A) {
  const [r0, r1, r2] = A.r;
  const upper = seg(A.S, A.E, r0, r1, { bl: A.bl ?? 1.2, br: A.br ?? 1.6, pk: 0.4 });
  const fore = seg(A.E, A.W, r1 * 0.95, r2, { bl: A.fbl ?? 1.4, br: A.fbr ?? 0.8, pk: 0.3 });
  const d = [A.W[0] - A.E[0], A.W[1] - A.E[1]];
  const ang = Math.atan2(d[1], d[0]) - Math.PI / 2 + (A.handRot ?? 0) * DEG;
  const H = handLocal(A.hand, A.handOpts || {});
  const hand = {
    shapes: H.shapes.map((s) => xf(s, A.W, ang)),
    grip: xf([H.grip], A.W, ang)[0],
    rod: xf([H.rod], A.W, ang)[0],
    deco: (ctx) => {
      ctx.save(); ctx.translate(A.W[0], A.W[1]); ctx.rotate(ang); ctx.scale(H.k, H.k);
      H.deco.forEach((f) => f(ctx));
      ctx.restore();
      A.decoH && A.decoH(ctx);
    },
  };
  return { upper: [upper, ...(A.extraU || [])], fore: [fore], hand };
}

// Leg: H hip, K knee, A ankle; r = [hip, knee, ankle] half widths.
function legParts(G) {
  const [r0, r1, r2] = G.r;
  const thigh = seg(G.H, G.K, r0, r1, { bl: G.tbl ?? 1.5, br: G.tbr ?? 2, pk: 0.4 });
  const shin = seg(G.K, G.A, r1 * 0.92, r2, { bl: G.calf ?? 3.5, br: G.sbr ?? 0.6, pk: 0.3 });
  const foot = footLocal(G.foot || {}).map((s) => xf(s, G.A, (G.footRot ?? 0) * DEG));
  return { thigh: [thigh], shin: [shin, ...foot] };
}

// Assemble a rig from a figure spec. Every part: { shapes: [pts...],
// deco(ctx) }. Shapes are smoothed and cut from leather.
function buildFigure(meta, S) {
  const seed = hashStr(meta.id);
  S.headScale = (S.headScale ?? 1) * (meta.kind === 'comic' ? 1.1 : 1.04);
  if (S.headScale !== 1) {
    const k = S.headScale, c = S.neck;
    const wrap = (f) => f && ((ctx, info) => { ctx.save(); ctx.translate(c[0], c[1]); ctx.scale(k, k); ctx.translate(-c[0], -c[1]); f(ctx, info); ctx.restore(); });
    for (const part of [S.head, S.jaw]) {
      part.shapes = part.shapes.map((sh) => scaleAbout(sh, c, k));
      part.deco = wrap(part.deco);
    }
    S.jaw.pivot = scaleAbout([S.jaw.pivot], c, k)[0];
  }
  // quality pass: thinner limbs, arms swung clear of the body outline
  const swing = (A, deg, thin) => {
    const a = deg * DEG, rel = (p) => { const q = rotP([p[0] - A.S[0], p[1] - A.S[1]], a); return [q[0] + A.S[0], q[1] + A.S[1]]; };
    const E = rel(A.E), W = rel(A.W);
    const W2 = [W[0] + (W[0] - E[0]) * 0.12, W[1] + (W[1] - E[1]) * 0.12]; // longer forearm
    return { ...A, E, W: W2, r: A.r.map((v) => v * thin),
      decoF: A.decoF || ((ctx) => dots(ctx, [lerp(E, W2, 0.82), lerp(E, W2, 0.84)].map((q, i) => [q[0] + (i ? 5 : -5), q[1]]), 0.9, 3, 5)) };
  };
  S.armF = swing(S.armF, S.armOutF ?? -16, 0.82);
  S.armB = swing(S.armB, S.armOutB ?? 14, 0.82);
  for (const G of [S.legF, S.legB]) {
    G.r = G.r.map((v, i) => v * (i ? 0.85 : 0.95));
    G.decoS = G.decoS || ((ctx) => { dots(ctx, [[G.A[0] - 6, G.A[1] - 6], [G.A[0] + 6, G.A[1] - 7]], 1.0, 3, 7); dots(ctx, [[G.K[0] - 5, G.K[1] + 16], [G.K[0] + 5, G.K[1] + 15]], 0.9, 3.4, 8); });
  }
  const armF = armParts(S.armF), armB = armParts(S.armB);
  const legF = legParts(S.legF), legB = legParts(S.legB);
  const J = {
    head: S.neck, jaw: S.jaw.pivot,
    upperArmF: S.armF.S, forearmF: S.armF.E, handF: S.armF.W,
    upperArmB: S.armB.S, forearmB: S.armB.E, handB: S.armB.W,
    thighF: S.legF.H, shinF: S.legF.K, thighB: S.legB.H, shinB: S.legB.K,
  };
  if (S.skirt) J.skirt = S.skirt.pivot;
  const tints = S.tints || {};
  const defs = {
    torso: S.torso,
    head: S.head,
    jaw: S.jaw,
    upperArmF: { shapes: armF.upper, deco: S.armF.decoU },
    forearmF: { shapes: armF.fore, deco: S.armF.decoF },
    handF: { shapes: armF.hand.shapes, deco: armF.hand.deco },
    upperArmB: { shapes: armB.upper, deco: S.armB.decoU },
    forearmB: { shapes: armB.fore, deco: S.armB.decoF },
    handB: { shapes: armB.hand.shapes, deco: armB.hand.deco },
    thighF: { shapes: legF.thigh, deco: S.legF.decoT },
    shinF: { shapes: legF.shin, deco: S.legF.decoS },
    thighB: { shapes: legB.thigh, deco: S.legB.decoT },
    shinB: { shapes: legB.shin, deco: S.legB.decoS },
  };
  if (S.skirt) defs.skirt = S.skirt;
  const parentOf = (id) => (S.skirt || (id !== 'thighF' && id !== 'thighB') ? PARENT[id] : 'torso');
  const parts = {};
  const rr = S.rivet ?? 2.3;
  for (const id of Object.keys(defs)) {
    const d = defs[id];
    const shapes = d.shapes.map((s) => wob(s, d.wob ?? S.wob ?? 0.9, seed + id.length * 131));
    const box = bboxOf([...shapes, ...(d.extent || [])], 5);
    const riv = [];
    if (id !== 'jaw') riv.push(J[id]);
    for (const c of Object.keys(defs)) if (parentOf(c) === id && J[c]) riv.push(J[c]);
    const tint = tints[id] || S.tint;
    const sprite = figSprite(`${meta.id}/${id}`, box, (ctx, info) => {
      for (const s of shapes) leather(ctx, smooth(s, true, 0.5));
      if (tint) tintAll(ctx, box, tint[0], tint[1]);
      d.deco && d.deco(ctx, info);
      for (const p of riv) if (p) rivet(ctx, p[0], p[1], rr);
    }, seed + id.length * 7);
    const P = { sprite, z: d.z ?? Z[id] };
    if (id !== 'torso') {
      const jd = JOINT[id];
      Object.assign(P, { parent: parentOf(id), at: J[id].slice(), pivot: J[id].slice(), rot: 0, lim: d.lim ?? jd.lim, stiff: d.stiff ?? jd.stiff });
      const m = d.mass ?? jd.mass;
      if (m != null) P.mass = m;
    } else {
      P.mass = d.mass ?? 1.3;
    }
    parts[id] = P;
  }
  const H = meta.height;
  const rodB = S.rod?.b ?? [0, S.skirt ? S.skirt.pivot[1] : 220];
  const rodA = S.rod?.a ?? [rodB[0], S.neck[1] + 30];
  return {
    id: meta.id, name: meta.name, en: meta.en, kind: meta.kind, voice: meta.voice, height: H,
    root: 'torso',
    parts,
    rod: { part: 'torso', a: rodA, b: rodB, extend: S.rod?.extend ?? Math.round(H - rodB[1] + 110) },
    handRods: { handF: armF.hand.rod, handB: armB.hand.rod },
    grips: { handF: armF.hand.grip, handB: armB.hand.grip },
    holds: S.holds || {},
    limbs: {
      torso: 'torso', head: 'head', jaw: 'jaw', ...(S.skirt ? { pelvis: 'skirt' } : {}),
      armF: ['upperArmF', 'forearmF', 'handF'], armB: ['upperArmB', 'forearmB', 'handB'],
      legF: ['thighF', 'shinF'], legB: ['thighB', 'shinB'],
    },
    lines: meta.lines,
    ...(S.idle ? { idle: S.idle } : {}),
  };
}

// ============================================================ characters

// ------------------------------------------------------------ ไอ้เท่ง
// Beaky nose, blubbery lips, a curly bun, slim body with a low belly and
// THE finger: long, knuckly and crooked, always pointing at somebody.
function teng() {
  const S = { headScale: 0.9 };
  S.neck = [-2, 80];
  const skull = [
    [-12, 2], [6, -1], [21, 4], [31, 13], [36, 22], [37.5, 28], [33, 33.5], [37, 37], [46, 41], [56, 46], [63, 52],
    [64, 58], [59, 60], [51, 57], [45, 58], [52, 62.5], [53.5, 67.5], [49, 70.5], [38, 70], [24, 71], [12, 74],
    [4, 80], [-4, 86], [-14, 85], [-20, 74], [-27, 60], [-30, 44], [-29, 26], [-23, 11],
  ];
  const bun = blobPts(-31, 27, 17, 19, { seed: 21, wobble: 0.1 });
  S.head = {
    shapes: [skull, bun],
    deco(ctx) {
      comicEye(ctx, 25.5, 36, 4.8, { look: [0.32, 0.12], pupil: 0.55 });
      slit(ctx, [[17, 27], [25, 24.5], [33, 27.5]], 1.3); // heavy brow
      slit(ctx, [[20, 44], [28, 45]], 0.8); // eye bag
      slit(ctx, [[43, 52], [40, 58.5], [43, 64.5]], 1.0); // nostril / lip fold
      slit(ctx, [[9, 48], [4.5, 42], [5.5, 34], [11, 31.5]], 1.4); // ear
      hole(ctx, 8.5, 40.5, 1.4);
      for (const [x, y, r, a] of [[-31, 17, 5.4, 0.1], [-38, 29, 4.8, 0.7], [-26, 30, 4.6, 1.2], [-32, 41, 3.8, 0.4], [-42, 17, 3.6, 1.6], [-22, 18, 3.2, 0.9]]) curlHole(ctx, x, y, r, a);
    },
  };
  S.jaw = {
    pivot: [2, 66],
    shapes: [[
      [-8, 62], [8, 62], [22, 65], [36, 68.5], [45, 71.5], [53, 73.5], [53, 79.5], [44, 81], [40, 86], [34, 92],
      [24, 95], [13, 92], [5, 86], [-4, 80], [-10, 71],
    ]],
    deco(ctx) {
      dots(ctx, [[37, 85], [30, 90.5], [20, 91.5], [11, 87]], 0.95, 3.8, 6);
    },
  };
  S.torso = {
    shapes: [[
      [-17, 70], [-6, 68], [3, 80], [7, 92], [9, 104], [19, 111], [27, 124], [26, 146], [30, 170], [38, 192], [41, 210],
      [36, 226], [24, 238], [14, 256], [-4, 264], [-24, 258], [-33, 238], [-28, 208], [-24, 176], [-27, 146],
      [-31, 122], [-27, 106], [-20, 96], [-17, 82],
    ]],
    deco(ctx) {
      dots(ctx, [[-19, 98], [-7, 104], [4, 106], [11, 103]], 1.15, 4.2, 8);
      dots(ctx, [[-19, 104], [-7, 111], [5, 113], [14, 109]], 1.0, 4.2, 9);
      for (let i = 0; i < 3; i++) slit(ctx, [[10 + i * 1.5, 134 + i * 9], [18 + i * 1.5, 132 + i * 9]], 1.1);
      hole(ctx, 22, 127, 1.6);
      hole(ctx, 32, 203, 1.8);
    },
  };
  const skirt = [
    [-32, 220], [-12, 216], [10, 219], [30, 227], [38, 240], [37, 266], [35, 294], [34, 320], [18, 326], [-6, 328],
    [-30, 324], [-40, 300], [-45, 268], [-40, 236],
  ];
  // the knotted cloth end (ชายผ้า) curling out behind the hip
  const tail = taper([[-34, 234], [-54, 232], [-66, 244], [-64, 260], [-54, 266], [-50, 256]], [7.5, 3.5], [7.5, 3.5], { steps: 6 });
  S.skirt = {
    pivot: [0, 238],
    shapes: [skirt, tail],
    deco(ctx) {
      dots(ctx, [[-34, 228], [-12, 224], [12, 227], [34, 236]], 1.15, 4.2, 12);
      dots(ctx, [[-37, 240], [-12, 236], [12, 239], [37, 248]], 1.15, 4.2, 13);
      const rows = [[270, [-30, -12, 6, 24]], [298, [-21, -3, 15, 30]]];
      for (const [y, xs] of rows) for (const x of xs) punch(ctx, [[x, y - 11], [x + 7, y], [x, y + 11], [x - 7, y]]);
      dots(ctx, [[-37, 316], [-6, 322], [30, 314]], 1.1, 4.2, 14);
      dots(ctx, [[-40, 240], [-56, 238], [-61, 250], [-56, 258]], 0.95, 3.6, 15);
    },
  };
  S.armF = { S: [-6, 116], E: [4, 190], W: [38, 242], r: [8.5, 5.8, 4.3], hand: 'point',
    decoF: (ctx) => dots(ctx, [[27, 232], [34, 225]], 0.9, 3, 3) };
  S.armB = { S: [-14, 114], E: [-32, 184], W: [-40, 250], r: [8, 5.5, 4.1], hand: 'fist', handRot: -8 };
  S.legF = { H: [8, 266], K: [15, 338], A: [9, 398], r: [12, 7.5, 4.8], foot: { len: 30, toes: 4 } };
  S.legB = { H: [-12, 266], K: [-16, 338], A: [-23, 398], r: [12, 7.5, 4.8], foot: { len: 30, toes: 4 } };
  S.rod = { a: [-2, 112], b: [-2, 238] };
  S.holds = {};
  S.idle = { shoulderF: -150, elbowF: -50, wristF: 20, shoulderB: 10, elbowB: -30 }; // signature pose, canonical degrees
  return S;
}

// ------------------------------------------------------------ หนูนุ้ย
// Helmet of hair, snub snout, a wispy goatee, an enormous pot belly and a
// big knife in the back hand.
function nunui() {
  const S = { headScale: 0.95 };
  S.neck = [-4, 82];
  const skull = [
    [-8, -2], [6, -3], [18, 1], [27, 9], [31, 18], [32.5, 26], [30, 31], [35, 34], [45, 35], [53, 40], [56, 48],
    [53, 55], [45, 56], [49, 60], [49.5, 65], [42, 67.5], [30, 67], [18, 69], [8, 74], [0, 82], [-8, 90],
    [-18, 88], [-24, 76], [-31, 60], [-35, 42], [-32, 22], [-24, 7],
  ];
  // the crest of hair rising off the crown like a cock's comb
  const crest = [[-30, 24], [-26, 8], [-16, -4], [-2, -9], [12, -7], [22, -1], [14, 2], [0, 0], [-14, 6], [-24, 18]];
  S.head = {
    shapes: [skull, crest],
    deco(ctx) {
      comicEye(ctx, 22, 30, 5, { look: [0.3, 0.05], pupil: 0.5 });
      slit(ctx, [[14, 22], [22, 20], [29, 23]], 1.1);
      slit(ctx, [[40, 44], [42, 50], [40, 55]], 0.9); // nostril wing
      slit(ctx, [[4, 44], [0, 38], [2, 31], [7, 29]], 1.3); // ear
      hole(ctx, 4, 36, 1.3);
      dots(ctx, [[26, 11], [16, 3], [2, 1], [-12, 6], [-24, 18], [-29, 34], [-28, 52], [-22, 66]], 1.1, 4.2, 31); // hairline
      dots(ctx, [[18, -3], [4, -5], [-10, 0], [-22, 12], [-27, 28]], 0.9, 4.2, 32);
    },
  };
  S.jaw = {
    pivot: [0, 66],
    shapes: [
      [[-8, 62], [8, 62], [24, 65], [38, 67], [47, 68], [48.5, 72.5], [42, 75.5], [36, 79], [30, 86], [18, 88], [8, 84], [-4, 78], [-10, 70]],
      // wispy goatee
      taper([[34, 80], [40, 90], [46, 102], [48, 110]], [5, 1], [4, 0.8], { steps: 5 }),
    ],
    deco(ctx) {
      slit(ctx, [[37, 86], [42, 97]], 0.8);
      slit(ctx, [[32, 72], [40, 72.5]], 0.8);
    },
  };
  S.torso = {
    shapes: [[
      [-16, 72], [-6, 70], [2, 82], [6, 96], [16, 106], [26, 118], [36, 136], [48, 158], [58, 184], [61, 210],
      [55, 234], [40, 250], [20, 258], [-4, 262], [-26, 256], [-32, 232], [-28, 200], [-25, 170], [-27, 140],
      [-30, 118], [-26, 102], [-20, 92], [-17, 80],
    ]],
    deco(ctx) {
      dots(ctx, [[-20, 98], [-8, 104], [4, 106], [13, 103]], 1.15, 4.2, 8);
      hole(ctx, 20, 126, 1.6);
      hole(ctx, 50, 204, 2);
      slit(ctx, [[44, 212], [50, 214]], 0.9);
    },
  };
  const skirt = [
    [-32, 222], [-10, 226], [14, 236], [36, 246], [44, 260], [42, 292], [40, 326], [16, 333], [-10, 334],
    [-32, 329], [-40, 300], [-42, 262], [-38, 236],
  ];
  S.skirt = {
    pivot: [0, 240],
    shapes: [skirt],
    deco(ctx) {
      dots(ctx, [[-34, 232], [-12, 234], [12, 243], [36, 254]], 1.15, 4.2, 12);
      dots(ctx, [[-37, 322], [-10, 328], [38, 320]], 1.15, 4.2, 14);
      dots(ctx, [[30, 256], [30, 290], [32, 320]], 1.0, 4.2, 15);
      dots(ctx, [[-30, 250], [-33, 290], [-33, 320]], 1.0, 4.2, 16);
    },
  };
  S.armF = { S: [-6, 118], E: [6, 190], W: [44, 238], r: [8.5, 6, 4.5], hand: 'spread' };
  S.armB = { S: [-14, 116], E: [-32, 184], W: [-40, 250], r: [8.2, 5.8, 4.4], hand: 'fist', handRot: -14,
    decoF: (ctx) => dots(ctx, [[-44, 236], [-34, 238]], 0.9, 3, 4) };
  S.legF = { H: [8, 268], K: [14, 342], A: [10, 398], r: [12.5, 8, 5], foot: { len: 30, toes: 3 } };
  S.legB = { H: [-12, 268], K: [-15, 342], A: [-22, 398], r: [12.5, 8, 5], foot: { len: 30, toes: 3 } };
  S.rod = { a: [-2, 112], b: [0, 240] };
  S.holds = { handB: 'knife' };
  S.idle = { shoulderF: -120, elbowF: -30, wristF: -10, shoulderB: -25, elbowB: -60 }; // signature pose, canonical degrees
  return S;
}

// ------------------------------------------------------------ ยอดทอง
// Pompous and fat: a crown of snail curls, goggling eye, walrus
// moustache, huge round belly, short bowed legs, pointing finger raised.
function yodthong() {
  const S = { headScale: 0.9 };
  S.neck = [-2, 86];
  const hair = scallop(-10, 22, 38, 28, { n: 16, depth: 0.14, seed: 7 });
  const face = [
    [8, 10], [22, 16], [30, 24], [35, 32], [32, 37], [38, 40], [50, 44], [58, 51], [58, 58], [52, 61], [46, 60],
    [50, 64], [50, 70], [42, 72], [30, 71], [20, 74], [10, 80], [2, 86], [-8, 92], [-18, 88], [-24, 74], [-28, 50], [-10, 20],
  ];
  const tache = taper([[46, 61], [38, 65], [28, 66], [22, 62], [24, 58]], [3.2, 1.6], [3.2, 1.6], { steps: 5 });
  S.head = {
    shapes: [hair, face, tache],
    deco(ctx) {
      comicEye(ctx, 26, 34, 6, { look: [0.3, 0], pupil: 0.52, ry: 0.95 });
      slit(ctx, [[16, 25], [24, 22], [33, 26]], 1.5);
      slit(ctx, [[14, 30], [18, 28]], 1.0);
      slit(ctx, [[44, 46], [42, 53], [45, 57]], 1.0);
      for (let i = 0; i < 4; i++) punch(ctx, [[36 + i * 3.4, 68], [38.4 + i * 3.4, 68], [38.4 + i * 3.4, 71], [36 + i * 3.4, 71]]); // bared teeth
      slit(ctx, [[2, 50], [-2, 44], [-1, 37], [4, 35]], 1.3);
      // rows of curls
      for (let row = 0; row < 4; row++) {
        const ry = 2 + row * 11;
        for (let i = 0; i < 7 - row; i++) {
          const x = -40 + row * 3 + i * 10.5 + (row % 2) * 4;
          const y = ry + Math.abs(x + 8) * 0.12;
          if (x > 16 - row * 2) continue;
          curlHole(ctx, x, y, 3.3, 0.15 + (i % 3) * 0.3);
        }
      }
    },
  };
  S.jaw = {
    pivot: [2, 72],
    shapes: [[
      [-8, 68], [10, 68], [26, 70.5], [40, 71], [50, 72], [51, 77], [45, 80], [42, 88], [34, 96], [20, 100],
      [6, 96], [-4, 88], [-12, 78],
    ]],
    deco(ctx) {
      slit(ctx, [[28, 92], [36, 88]], 1.0); // double chin
      for (let i = 0; i < 3; i++) punch(ctx, [[38 + i * 3.4, 72], [40.2 + i * 3.4, 72], [40.2 + i * 3.4, 74.5], [38 + i * 3.4, 74.5]]);
    },
  };
  S.torso = {
    shapes: [[
      [-18, 76], [-6, 74], [4, 86], [8, 100], [22, 108], [34, 122], [40, 142], [54, 162], [64, 188], [67, 216],
      [60, 242], [44, 256], [20, 262], [-6, 264], [-30, 256], [-40, 234], [-36, 204], [-32, 172], [-36, 142],
      [-39, 118], [-33, 102], [-23, 94], [-18, 84],
    ]],
    deco(ctx) {
      dots(ctx, [[-24, 100], [-10, 108], [6, 110], [16, 106]], 1.2, 4.2, 8);
      dots(ctx, [[-23, 107], [-10, 116], [8, 118], [20, 113]], 1.0, 4.2, 9);
      hole(ctx, 28, 132, 1.8);
      slit(ctx, [[36, 146], [46, 158], [52, 176]], 1.0); // belly fold
      hole(ctx, 55, 212, 2.2);
    },
  };
  const skirt = [
    [-38, 228], [-14, 232], [10, 240], [34, 248], [48, 256], [46, 280], [40, 306], [26, 318], [4, 322], [-20, 320],
    [-42, 312], [-54, 292], [-56, 262], [-48, 238],
  ];
  const tail = taper([[-44, 244], [-62, 250], [-70, 268], [-64, 290], [-54, 300]], [8, 4], [8, 4], { steps: 5 });
  S.skirt = {
    pivot: [0, 244],
    shapes: [skirt, tail],
    deco(ctx) {
      dye(ctx, smooth([[4, 262], [22, 258], [34, 266], [30, 300], [14, 310], [2, 300]]), INK.red, 0.9);
      dotFill(ctx, smooth([[-44, 244], [0, 244], [42, 258], [36, 304], [-4, 314], [-44, 306], [-50, 270]]), [-56, 240, 50, 320], { pattern: 'rand', spacing: 6, r: 1.15, seed: 21 });
      dots(ctx, [[-40, 236], [-14, 240], [10, 247], [44, 262]], 1.2, 4.2, 12);
      dots(ctx, [[-44, 308], [-20, 316], [6, 318], [30, 310]], 1.1, 4.2, 14);
      dots(ctx, [[-50, 254], [-62, 262], [-64, 282], [-58, 294]], 1.0, 4, 15);
    },
  };
  S.armF = { S: [-8, 122], E: [6, 192], W: [44, 234], r: [10, 7, 5], hand: 'index' };
  S.armB = { S: [-16, 120], E: [-40, 182], W: [-50, 246], r: [9.5, 6.5, 4.8], hand: 'relaxed' };
  S.legF = { H: [10, 270], K: [24, 338], A: [16, 398], r: [14, 9, 5.5], calf: 4.5, foot: { len: 32, toes: 4 } };
  S.legB = { H: [-16, 270], K: [-26, 338], A: [-28, 398], r: [14, 9, 5.5], calf: 4.5, foot: { len: 32, toes: 4 } };
  S.rod = { a: [-2, 114], b: [0, 244] };
  S.holds = {};
  S.idle = { shoulderF: -140, elbowF: -40, shoulderB: 15, elbowB: -20, head: -8 }; // signature pose, canonical degrees
  return S;
}

// ------------------------------------------------------------ สะหม้อ
// The old man: striped headband, drooping nose and pursed lips, stringy
// neck, hunched back, striped sarong, a curved blade hanging in his hand.
function samor() {
  const S = { headScale: 0.9 };
  S.neck = [0, 82];
  const skull = [
    [-14, 4], [2, -1], [18, 2], [28, 10], [33, 20], [35, 30], [37, 34], [34, 38], [40, 41], [49, 47], [55, 55],
    [53, 61], [46, 60], [50, 64.5], [50, 69], [42, 71], [32, 70], [20, 72], [10, 76], [2, 82], [-6, 90],
    [-16, 86], [-22, 74], [-29, 58], [-32, 40], [-30, 22], [-24, 10],
  ];
  const knot = taper([[-28, 30], [-38, 36], [-44, 48], [-42, 58]], [4, 2.2], [4, 2.2], { steps: 4 });
  const knot2 = taper([[-28, 32], [-36, 44], [-35, 56]], [3.2, 1.8], [3.2, 1.8], { steps: 4 });
  S.head = {
    shapes: [skull, knot, knot2],
    deco(ctx) {
      comicEye(ctx, 25, 41, 4.4, { look: [0.35, 0.2], pupil: 0.5, lid: 0.45 });
      slit(ctx, [[18, 49], [27, 50]], 0.8);
      slit(ctx, [[20, 53], [28, 55]], 0.7);
      slit(ctx, [[42, 52], [40, 58], [42, 64]], 1.0);
      slit(ctx, [[34, 60], [36, 66]], 0.8);
      slit(ctx, [[6, 54], [2, 48], [3, 41], [8, 39]], 1.3);
      hole(ctx, 5.5, 46, 1.3);
      // striped headband ผ้าโพกหัว
      dots(ctx, [[-27, 14], [-10, 10], [10, 12], [27, 17], [33, 22]], 1.05, 3.6, 41);
      dashes(ctx, [[-29, 20], [-10, 16], [10, 18], [28, 23], [34, 28]], { w: 1.4, dash: 4, gap: 2.4 });
      dashes(ctx, [[-30, 26], [-10, 22], [10, 24], [28, 29], [35, 33]], { w: 1.4, dash: 4, gap: 2.4, off: 2 });
      dots(ctx, [[-30, 32], [-10, 28], [10, 30], [27, 34]], 1.05, 3.6, 42);
      dots(ctx, [[-36, 38], [-42, 50]], 0.9, 3.4, 43);
    },
  };
  S.jaw = {
    pivot: [4, 68],
    shapes: [[
      [-6, 64], [10, 65], [26, 68], [40, 70], [48, 71], [50, 75.5], [44, 78], [38, 79], [33, 86], [24, 91],
      [12, 90], [2, 84], [-8, 74],
    ]],
    deco(ctx) {
      slit(ctx, [[26, 84], [32, 80]], 0.8);
      dots(ctx, [[30, 88], [20, 89]], 0.9, 3.4, 44);
    },
  };
  S.torso = {
    shapes: [[
      [-14, 70], [-4, 70], [4, 82], [7, 96], [14, 106], [21, 122], [21, 146], [26, 170], [36, 192], [39, 212],
      [32, 230], [20, 244], [12, 258], [-6, 264], [-24, 258], [-30, 238], [-26, 206], [-26, 178], [-32, 150],
      [-38, 126], [-37, 106], [-29, 92], [-20, 82],
    ]],
    deco(ctx) {
      dots(ctx, [[-24, 96], [-12, 101], [0, 103], [9, 100]], 1.05, 4, 8);
      for (let i = 0; i < 4; i++) slit(ctx, [[6 + i, 124 + i * 8], [14 + i, 123 + i * 8]], 1.0);
      hole(ctx, 30, 204, 1.7);
    },
  };
  const skirt = [
    [-30, 222], [-8, 220], [14, 222], [30, 228], [40, 240], [40, 270], [39, 300], [38, 330], [16, 336], [-8, 337],
    [-32, 333], [-38, 300], [-40, 266], [-36, 236],
  ];
  S.skirt = {
    pivot: [0, 238],
    shapes: [skirt],
    deco(ctx) {
      for (const y of [232, 240]) dashes(ctx, [[-34, y - 4], [0, y - 5], [38, y + 4]], { w: 1.6, dash: 4.5, gap: 2.2 });
      for (const y of [316, 324]) dashes(ctx, [[-36, y], [0, y + 3], [38, y - 2]], { w: 1.6, dash: 4.5, gap: 2.2 });
      for (let x = -30; x <= 32; x += 8.5) dashes(ctx, [[x, 248], [x + 1, 280], [x + 1.5, 310]], { w: 1.6, dash: 5, gap: 2.4, off: (x * 7) % 5 });
    },
  };
  S.armF = { S: [-6, 116], E: [4, 190], W: [34, 244], r: [7.4, 5, 3.8], hand: 'relaxed' };
  S.armB = { S: [-14, 114], E: [-32, 182], W: [-38, 250], r: [7, 4.8, 3.7], hand: 'fist', handRot: -12 };
  S.legF = { H: [8, 268], K: [13, 344], A: [9, 400], r: [10.5, 6.5, 4.2], calf: 2.6, foot: { len: 30, toes: 4, h: 20 } };
  S.legB = { H: [-12, 268], K: [-15, 344], A: [-21, 400], r: [10.5, 6.5, 4.2], calf: 2.6, foot: { len: 30, toes: 4, h: 20 } };
  S.rod = { a: [-2, 112], b: [0, 238] };
  S.holds = { handB: 'knife' };
  S.idle = { shoulderF: -110, elbowF: -70, shoulderB: 5, elbowB: -20, head: 6 }; // signature pose, canonical degrees
  return S;
}

// ------------------------------------------------------------ ศรีแก้ว
// Plump and bald with a jug ear, a pouting mouth, a round belly and a
// big checked sarong with the cloth end hanging in front.
function srikaew() {
  const S = { headScale: 0.92 };
  S.neck = [-2, 84];
  const skull = [
    [-6, -1], [10, -1], [23, 5], [32, 15], [36, 25], [37.5, 31], [34, 36], [39, 39], [45, 44], [46, 49],
    [41, 51], [46, 55], [47, 60], [40, 63], [30, 63], [18, 66], [8, 72], [-2, 80], [-10, 88], [-22, 84],
    [-28, 70], [-32, 50], [-30, 28], [-22, 10],
  ];
  const ear = blobPts(-2, 42, 8, 10, { seed: 3 });
  S.head = {
    shapes: [skull, ear],
    deco(ctx) {
      comicEye(ctx, 25, 33, 5.6, { look: [0.35, 0.05], pupil: 0.5, ry: 0.92 });
      slit(ctx, [[16, 24], [25, 20], [34, 23]], 1.6);
      slit(ctx, [[4, 50], [-2, 49], [-6, 43], [-4, 36], [2, 34]], 1.3);
      hole(ctx, 0, 42, 1.4);
      slit(ctx, [[38, 44], [37, 50]], 0.9);
      slit(ctx, [[28, 44], [32, 52], [36, 58]], 0.8); // cheek
    },
  };
  S.jaw = {
    pivot: [0, 62],
    shapes: [[
      [-8, 58], [10, 60], [26, 63], [40, 64], [47, 66], [48, 71], [42, 74], [36, 76], [34, 82], [26, 90],
      [14, 92], [4, 88], [-6, 80], [-10, 68],
    ]],
    deco(ctx) {
      slit(ctx, [[20, 86], [30, 82]], 1.0);
      slit(ctx, [[36, 69], [42, 69]], 0.8);
    },
  };
  S.torso = {
    shapes: [[
      [-18, 74], [-4, 72], [4, 84], [8, 98], [22, 108], [34, 122], [38, 144], [48, 166], [56, 192], [57, 214],
      [48, 234], [34, 246], [16, 254], [-6, 258], [-30, 252], [-38, 230], [-34, 200], [-32, 168], [-36, 138],
      [-40, 116], [-34, 100], [-24, 92], [-18, 82],
    ]],
    deco(ctx) {
      dots(ctx, [[-22, 100], [-8, 107], [8, 109], [18, 104]], 1.1, 4.2, 8);
      hole(ctx, 26, 128, 1.7);
      hole(ctx, 48, 206, 2);
      slit(ctx, [[34, 148], [44, 164]], 0.9);
    },
  };
  const skirt = [
    [-40, 222], [-16, 224], [10, 232], [34, 240], [46, 252], [47, 280], [43, 310], [34, 326], [10, 330],
    [-16, 332], [-40, 326], [-52, 300], [-54, 268], [-49, 238],
  ];
  const inner = [[-42, 240], [-16, 242], [10, 248], [30, 254], [36, 270], [34, 300], [28, 316], [0, 320], [-36, 316], [-46, 296], [-48, 262]];
  const flap = [[18, 236], [30, 240], [34, 270], [34, 310], [36, 344], [24, 346], [20, 310], [16, 270]];
  S.skirt = {
    pivot: [0, 240],
    shapes: [skirt, flap],
    deco(ctx) {
      lattice(ctx, inner, { cell: 12.5, bar: 3.6, ang: -0.06, seed: 5 });
      dots(ctx, [[-44, 230], [-16, 232], [10, 240], [42, 252]], 1.2, 4.2, 12);
      dots(ctx, [[-46, 318], [-16, 324], [10, 324], [30, 320]], 1.1, 4.2, 14);
      dots(ctx, [[21, 244], [23, 280], [25, 320], [28, 340]], 1.0, 4, 15);
      dots(ctx, [[30, 246], [31, 280], [31, 320], [32, 340]], 1.0, 4, 16);
    },
  };
  S.armF = { S: [-6, 120], E: [6, 192], W: [42, 236], r: [9.5, 6.5, 4.8], hand: 'fist' };
  S.armB = { S: [-16, 118], E: [-40, 182], W: [-50, 244], r: [9, 6.2, 4.6], hand: 'spread', handRot: -10 };
  S.legF = { H: [10, 268], K: [22, 342], A: [20, 400], r: [13, 8.5, 5.2], calf: 4, foot: { len: 30, toes: 4 } };
  S.legB = { H: [-14, 268], K: [-24, 342], A: [-32, 400], r: [13, 8.5, 5.2], calf: 4, foot: { len: 30, toes: 4 } };
  S.rod = { a: [-2, 114], b: [0, 240] };
  S.holds = {};
  S.idle = { shoulderF: -125, elbowF: -55, shoulderB: 20, elbowB: -10 }; // signature pose, canonical degrees
  return S;
}

// ------------------------------------------------------------ ขวัญเมือง
// Dyed green, with a long crocodile snout curling up at the tip, a tuft of
// ringlets at the nape, a pale collar and belt and a striped sarong.
function khwanmuang() {
  const S = { headScale: 0.92, tint: [INK.jade, 0.88], tints: { shinF: [INK.green, 0.7], shinB: [INK.green, 0.6], skirt: [INK.green, 0.85] } };
  S.neck = [-4, 84];
  const skull = [
    [-16, 6], [-2, 1], [10, 3], [19, 10], [26, 10], [32, 13], [38, 18], [50, 21], [62, 23], [72, 23],
    [78, 18], [80, 10], [85, 6], [86, 13], [83, 22], [78, 30], [70, 34], [62, 36], [50, 39], [38, 44], [26, 48],
    [16, 52], [8, 60], [0, 72], [-8, 88], [-18, 86], [-24, 72], [-28, 52], [-28, 32], [-24, 16],
  ];
  const curls = [
    blobPts(-28, 22, 7, 7.5, { seed: 41 }), blobPts(-31, 35, 7, 7, { seed: 42 }),
    blobPts(-31, 48, 6.5, 6.5, { seed: 43 }), blobPts(-28, 60, 6, 6, { seed: 44 }),
  ];
  S.head = {
    shapes: [skull, ...curls],
    deco(ctx) {
      for (const [x, y, r] of [[-28, 22, 7], [-31, 35, 7], [-31, 48, 6.5], [-28, 60, 6]]) dye(ctx, blobPts(x, y, r, r, { seed: 9 }), INK.cream, 0.75);
      for (const [x, y, r, a] of [[-28, 22, 3.6, 0.2], [-31, 35, 3.6, 0.6], [-31, 48, 3.3, 1.1], [-28, 60, 3, 0.4]]) curlHole(ctx, x, y, r, a);
      comicEye(ctx, 26, 20, 4.4, { look: [0.3, 0.1], pupil: 0.52 });
      slit(ctx, [[18, 13], [26, 10.5], [33, 14]], 1.1);
      hole(ctx, 78, 24, 1.3); // nostril
      // upper teeth along the jaw line
      for (let i = 0; i < 7; i++) {
        const x = 34 + i * 6, y = 44 - i * 1.3;
        punch(ctx, [[x - 2.2, y - 2.4], [x + 2.2, y - 2.8], [x + 0.3, y + 0.6]]);
      }
      slit(ctx, [[4, 42], [0, 36], [2, 30], [6, 28]], 1.3);
      dots(ctx, [[20, 30], [42, 30], [64, 30]], 0.9, 5, 45);
    },
  };
  S.jaw = {
    pivot: [4, 52],
    shapes: [[
      [-6, 48], [10, 47], [26, 46], [42, 43], [56, 40], [68, 38], [74, 40], [72, 45], [60, 49], [46, 54],
      [34, 60], [22, 66], [10, 68], [0, 64], [-8, 56],
    ]],
    deco(ctx) {
      for (let i = 0; i < 6; i++) {
        const x = 36 + i * 6, y = 49 - i * 1.4;
        punch(ctx, [[x - 2, y + 2], [x + 2, y + 1.6], [x, y - 1.4]]);
      }
      dots(ctx, [[14, 62], [30, 58], [48, 50]], 0.9, 4.5, 46);
    },
  };
  S.torso = {
    shapes: [[
      [-16, 74], [-4, 72], [4, 86], [8, 100], [20, 110], [28, 126], [28, 150], [32, 176], [34, 200], [30, 220],
      [22, 240], [10, 256], [-8, 260], [-26, 254], [-30, 232], [-28, 200], [-26, 170], [-28, 140], [-30, 118],
      [-24, 102], [-18, 92], [-16, 82],
    ]],
    deco(ctx) {
      // pale beaded collar
      const col = taper([[-22, 96], [-8, 103], [6, 105], [16, 102]], 4, 4, { steps: 5 });
      dye(ctx, smooth(col), INK.cream, 0.6);
      dots(ctx, [[-22, 96], [-8, 103], [6, 105], [16, 102]], 1.2, 4, 8);
      hole(ctx, 18, 128, 1.6);
      hole(ctx, 26, 196, 1.8);
    },
  };
  const skirt = [
    [-32, 220], [-10, 218], [12, 220], [30, 226], [36, 238], [38, 270], [38, 302], [38, 334], [14, 338], [-10, 339],
    [-32, 335], [-38, 300], [-40, 264], [-36, 234],
  ];
  S.skirt = {
    pivot: [0, 236],
    shapes: [skirt],
    deco(ctx) {
      const belt = taper([[-36, 230], [-10, 228], [14, 231], [36, 238]], 5, 5, { steps: 5 });
      dye(ctx, smooth(belt), INK.cream, 0.55);
      dots(ctx, [[-36, 230], [-10, 228], [14, 231], [36, 238]], 1.1, 4, 12);
      for (let x = -30; x <= 32; x += 7) slit(ctx, [[x, 244 + Math.abs(x) * 0.05], [x + 0.6, 290], [x + 1, 330]], 1.7);
    },
  };
  S.armF = { S: [-6, 116], E: [4, 190], W: [32, 246], r: [8, 5.6, 4.2], hand: 'claw' };
  S.armB = { S: [-14, 114], E: [-30, 184], W: [-36, 250], r: [7.8, 5.4, 4.1], hand: 'fist', handRot: -6 };
  S.legF = { H: [8, 268], K: [11, 344], A: [7, 400], r: [11, 7.5, 5], foot: { len: 30 } };
  S.legB = { H: [-12, 268], K: [-13, 344], A: [-19, 400], r: [11, 7.5, 5], foot: { len: 30 } };
  S.rod = { a: [-2, 112], b: [0, 236] };
  S.holds = {};
  S.idle = { shoulderF: -40, elbowF: -40, shoulderB: -30, elbowB: -45, jaw: 10 }; // signature pose, canonical degrees
  return S;
}

// ------------------------------------------------------------ ผู้ใหญ่พูน
// The village headman: hunched, bottom stuck out, knees bent, a crescent
// eye and bulb nose; red collar and red sash of office.
function phuyaiphoon() {
  const S = { headScale: 0.92 };
  S.neck = [12, 92];
  const skull = [
    [-6, 18], [4, 10], [16, 6], [28, 6], [36, 1], [44, 2], [42, 8], [44, 16], [46, 26], [47, 32], [44, 37],
    [50, 39], [58, 44], [62, 52], [58, 58], [50, 57], [52, 62], [51, 67], [42, 68], [32, 67], [22, 70],
    [16, 78], [12, 88], [2, 96], [-8, 90], [-12, 72], [-14, 52], [-12, 32],
  ];
  S.head = {
    shapes: [skull],
    deco(ctx) {
      crescentEye(ctx, 34, 36, 5.2);
      slit(ctx, [[27, 27], [34, 25], [41, 28]], 1.3);
      slit(ctx, [[46, 46], [44, 52], [46, 57]], 1.0);
      slit(ctx, [[10, 52], [6, 46], [7, 39], [12, 37]], 1.3);
      hole(ctx, 9.5, 44, 1.3);
      dots(ctx, [[36, 8], [22, 10], [8, 14], [-4, 22]], 1.0, 4, 51);
    },
  };
  S.jaw = {
    pivot: [16, 66],
    shapes: [[
      [6, 62], [22, 64], [36, 67], [46, 68], [52, 70], [50, 76], [42, 78], [38, 85], [30, 90], [20, 88],
      [12, 82], [6, 72],
    ]],
    deco(ctx) { slit(ctx, [[40, 72], [46, 72.5]], 0.8); },
  };
  S.torso = {
    shapes: [[
      [2, 82], [14, 82], [20, 94], [24, 106], [36, 116], [42, 132], [42, 158], [44, 184], [42, 210], [32, 232],
      [14, 246], [-8, 252], [-32, 246], [-42, 222], [-46, 190], [-46, 160], [-42, 132], [-32, 110], [-18, 96],
      [-6, 88],
    ]],
    deco(ctx) {
      // red collar and a red sash across the chest
      const col = taper([[-12, 96], [2, 104], [16, 106], [26, 104]], 5.5, 5.5, { steps: 5 });
      dye(ctx, smooth(col), INK.red, 0.95);
      dots(ctx, [[-14, 90], [2, 98], [18, 100], [28, 98]], 1.0, 4, 8);
      const sash = taper([[-36, 120], [-12, 160], [14, 200], [34, 230]], 6, 6, { steps: 5 });
      dye(ctx, smooth(sash), INK.red, 0.95);
      dots(ctx, [[-38, 130], [-16, 168], [8, 204], [26, 232]], 0.9, 4, 9);
      dots(ctx, [[34, 136], [36, 170], [36, 200]], 1.0, 5, 10); // buttons
    },
  };
  const skirt = [
    [-38, 214], [-12, 220], [14, 226], [34, 234], [42, 254], [42, 288], [34, 316], [12, 326], [-20, 326],
    [-50, 318], [-72, 296], [-78, 262], [-68, 232], [-54, 216],
  ];
  S.skirt = {
    pivot: [0, 236],
    shapes: [skirt],
    deco(ctx) {
      dots(ctx, [[-50, 226], [-20, 228], [10, 234], [38, 246]], 1.1, 4.2, 12);
      dots(ctx, [[-58, 310], [-26, 320], [6, 320], [32, 310]], 1.1, 4.2, 14);
      slit(ctx, [[-10, 250], [-6, 290], [0, 316]], 1.1);
      slit(ctx, [[-40, 250], [-56, 270], [-60, 294]], 1.0);
    },
  };
  S.armF = { S: [2, 124], E: [18, 190], W: [34, 252], r: [9, 6.2, 4.6], hand: 'fist', handRot: -6 };
  S.armB = { S: [-8, 122], E: [-24, 186], W: [-20, 252], r: [8.6, 6, 4.4], hand: 'relaxed' };
  S.legF = { H: [8, 268], K: [34, 334], A: [16, 398], r: [13, 8.5, 5.2], calf: 4, foot: { len: 32, toes: 3 } };
  S.legB = { H: [-18, 268], K: [4, 336], A: [-14, 398], r: [13, 8.5, 5.2], calf: 4, foot: { len: 32, toes: 3 } };
  S.rod = { a: [4, 118], b: [-2, 236] };
  S.holds = {};
  S.idle = { shoulderF: -90, elbowF: -20, wristF: 20, shoulderB: 30, elbowB: -10, kneeF: 20, kneeB: 20 }; // signature pose, canonical degrees
  return S;
}

// ------------------------------------------------------------ ไอ้โถ
// The runner: wiry, forward-leaning, wild pale hair streaming back, a
// toothy grin and cross-eyed stare, long bony legs.
function aitho() {
  const S = { headScale: 0.9, tint: [INK.brown, 0.35] };
  S.neck = [6, 84];
  const skull = [
    [-10, 8], [4, 2], [18, 3], [28, 10], [34, 20], [36, 28], [34, 32], [40, 36], [48, 42], [48, 47], [42, 48],
    [44, 52], [40, 56], [28, 56], [16, 60], [10, 70], [6, 80], [-4, 88], [-14, 82], [-20, 66], [-22, 46], [-20, 24],
  ];
  const hair = [];
  const strands = [[[-6, 8], [-20, -4], [-36, -10], [-50, -8]], [[-12, 14], [-30, 8], [-46, 10], [-60, 16]], [[-16, 24], [-34, 24], [-50, 30], [-62, 38]], [[-18, 36], [-32, 42], [-44, 52], [-52, 62]], [[2, 4], [-6, -8], [-18, -18], [-30, -22]]];
  for (const st of strands) hair.push(taper(st, [5, 1], [5, 1], { steps: 5 }));
  S.head = {
    shapes: [skull, ...hair],
    deco(ctx) {
      for (const st of strands) dye(ctx, smooth(taper(st, [4.5, 1], [4.5, 1], { steps: 5 })), INK.cream, 0.85);
      slit(ctx, [[20, 26], [30, 36]], 1.8);
      slit(ctx, [[30, 26], [20, 36]], 1.8);
      slit(ctx, [[16, 20], [24, 18], [32, 21]], 1.2);
      for (let i = 0; i < 5; i++) punch(ctx, [[20 + i * 4, 53], [22.8 + i * 4, 53], [22.8 + i * 4, 56.5], [20 + i * 4, 56.5]]);
      slit(ctx, [[6, 44], [2, 38], [4, 31], [9, 29]], 1.3);
      slit(ctx, [[38, 40], [37, 46]], 0.9);
    },
  };
  S.jaw = {
    pivot: [8, 54],
    shapes: [[
      [0, 50], [14, 54], [28, 57], [38, 57], [46, 58], [45, 63], [40, 68], [34, 76], [24, 80], [14, 76],
      [6, 68], [0, 58],
    ]],
    deco(ctx) {
      for (let i = 0; i < 4; i++) punch(ctx, [[22 + i * 4, 58], [24.8 + i * 4, 58], [24.8 + i * 4, 61], [22 + i * 4, 61]]);
    },
  };
  S.torso = {
    shapes: [[
      [-8, 74], [4, 74], [12, 86], [16, 100], [28, 110], [34, 128], [30, 152], [30, 180], [28, 208], [20, 232],
      [10, 250], [-8, 256], [-24, 250], [-28, 228], [-24, 196], [-24, 166], [-28, 138], [-26, 114], [-18, 98],
      [-10, 86],
    ]],
    deco(ctx) {
      for (let i = 0; i < 5; i++) slit(ctx, [[2 + i * 0.5, 126 + i * 8], [16 + i * 0.5, 124 + i * 8 + 2]], 1.1);
      hole(ctx, 20, 200, 1.6);
      dots(ctx, [[-14, 100], [0, 106], [12, 104]], 1.0, 4, 8);
    },
  };
  const skirt = [
    [-28, 218], [-6, 216], [16, 220], [30, 228], [34, 246], [30, 272], [20, 290], [0, 296], [-22, 292],
    [-34, 276], [-36, 248], [-34, 228],
  ];
  const tail = taper([[-30, 240], [-44, 250], [-52, 268], [-48, 286]], [5, 2], [5, 2], { steps: 5 });
  S.skirt = {
    pivot: [0, 236],
    shapes: [skirt, tail],
    deco(ctx) {
      dots(ctx, [[-30, 226], [-6, 224], [16, 228], [32, 236]], 1.1, 4.2, 12);
      dotFill(ctx, smooth([[-30, 234], [30, 238], [26, 272], [0, 288], [-30, 282]]), [-36, 230, 34, 296], { pattern: 'diamond', spacing: 7, r: 1.1, seed: 5 });
      dots(ctx, [[-32, 282], [-10, 292], [18, 286]], 1.0, 4.2, 14);
    },
  };
  S.armF = { S: [-2, 114], E: [18, 184], W: [52, 228], r: [7.6, 5.2, 4], hand: 'spread', fbl: 1 };
  S.armB = { S: [-10, 112], E: [-34, 176], W: [-50, 234], r: [7.4, 5, 3.9], hand: 'claw' };
  S.legF = { H: [6, 262], K: [18, 338], A: [10, 400], r: [11, 7, 4.5], calf: 3, foot: { len: 32, toes: 4 } };
  S.legB = { H: [-12, 262], K: [-18, 338], A: [-26, 400], r: [11, 7, 4.5], calf: 3, foot: { len: 32, toes: 4 } };
  S.rod = { a: [2, 112], b: [0, 236] };
  S.holds = {};
  S.idle = { shoulderF: -70, elbowF: -15, shoulderB: 50, elbowB: -30, hipF: -35, kneeF: 30, hipB: 25, kneeB: 50 }; // signature pose, canonical degrees
  return S;
}

// ------------------------------------------------------------ ชาวบ้านชาย
// A farmer in a woven งอบ hat and indigo ม่อฮ่อม shirt, a checked ผ้าขาวม้า
// knotted at the waist, knee-length trousers, bare feet.
function chaobanMan() {
  const S = { headScale: 0.94, tints: { torso: [INK.blue, 0.9], upperArmF: [INK.blue, 0.9], upperArmB: [INK.blue, 0.8] } };
  S.neck = [-2, 92];
  const skull = [
    [-18, 30], [-4, 26], [12, 28], [26, 34], [32, 42], [34, 48], [33, 52], [38, 56], [44, 62], [44, 67],
    [38, 68], [40, 72], [39, 77], [32, 78], [22, 79], [12, 82], [4, 88], [-4, 96], [-16, 94], [-22, 80],
    [-26, 62], [-26, 44],
  ];
  const hat = [
    [0, 0], [12, 5], [28, 14], [44, 22], [58, 28], [61, 32], [44, 33], [22, 32], [0, 31], [-22, 32],
    [-44, 33], [-60, 32], [-58, 28], [-44, 22], [-28, 14], [-12, 5],
  ];
  const knob = blobPts(0, 1, 6, 4.5, { seed: 71 });
  S.head = {
    shapes: [skull, hat, knob],
    deco(ctx) {
      dye(ctx, smooth(hat), INK.yellow, 0.85);
      // woven palm leaf: radial ribs and rings
      for (let i = -5; i <= 5; i++) {
        const bx = i * 11.5;
        dashes(ctx, [[i * 1.2, 4], [bx * 0.55, 17 + Math.abs(i) * 0.2], [bx, 30.5]], { w: 1.1, dash: 2.6, gap: 2.2, off: i });
      }
      for (const k of [0.4, 0.7]) dots(ctx, [[-60 * k, 5 + 25 * k], [0, 3 + 26 * k], [60 * k, 5 + 25 * k]], 0.9, 3.4, 72);
      line(ctx, [[-60, 31.5], [0, 30.5], [61, 31.5]], INK.brown, 1.6);
      eye(ctx, 24, 55, 4.2, { style: 'almond' });
      slit(ctx, [[18, 47], [25, 45.5], [31, 48]], 1.0);
      slit(ctx, [[36, 60], [35, 66]], 0.8);
      slit(ctx, [[6, 62], [2, 56], [3, 49], [8, 47]], 1.3);
      hole(ctx, 5.5, 55, 1.2);
    },
  };
  S.jaw = {
    pivot: [0, 76],
    shapes: [[
      [-8, 72], [10, 73], [24, 76], [34, 77], [39, 78], [39, 83], [34, 85], [32, 92], [24, 98], [12, 96],
      [2, 90], [-6, 82],
    ]],
    deco(ctx) { slit(ctx, [[30, 81], [36, 81]], 0.8); },
  };
  S.torso = {
    shapes: [[
      [-16, 80], [-4, 80], [4, 94], [8, 106], [20, 114], [30, 128], [31, 152], [32, 180], [32, 206], [28, 228],
      [18, 246], [-2, 254], [-24, 250], [-32, 230], [-30, 200], [-28, 170], [-30, 140], [-32, 120], [-26, 106],
      [-18, 96],
    ]],
    deco(ctx) {
      dots(ctx, [[-18, 104], [-6, 110], [6, 112], [12, 108]], 1.0, 4, 8);
      dots(ctx, [[14, 114], [20, 150], [22, 190], [22, 222]], 1.0, 5, 9);
      for (const y of [130, 160, 190, 215]) hole(ctx, 24, y, 1.6);
      dots(ctx, [[-30, 226], [0, 232], [28, 224]], 1.0, 4, 10);
    },
  };
  const skirt = [
    [-32, 222], [-8, 222], [14, 224], [32, 230], [38, 246], [38, 280], [36, 318], [18, 322], [2, 314], [-4, 322],
    [-24, 324], [-38, 318], [-40, 280], [-38, 240],
  ];
  const cloth = taper([[-36, 234], [0, 238], [36, 240]], 8, 8, { steps: 5 });
  const knotEnd = [[26, 236], [36, 238], [40, 256], [44, 284], [34, 286], [28, 262]];
  S.skirt = {
    pivot: [0, 240],
    shapes: [skirt, cloth, knotEnd],
    deco(ctx) {
      const bb = [-42, 224, 46, 290];
      plaid(ctx, smooth(cloth), bb, { a: INK.red, b: INK.green, size: 7, seed: 3 });
      plaid(ctx, smooth(knotEnd), bb, { a: INK.red, b: INK.green, size: 7, seed: 4 });
      dots(ctx, [[-36, 312], [-20, 318], [-6, 316]], 1.0, 4, 14);
      dots(ctx, [[6, 310], [20, 316], [34, 312]], 1.0, 4, 15);
      slit(ctx, [[0, 262], [1, 300], [1, 312]], 1.1);
    },
  };
  S.armF = { S: [-6, 122], E: [4, 194], W: [30, 250], r: [9, 6, 4.4], hand: 'relaxed',
    extraU: [taper([[-6, 112], [-2, 150]], 12, 12, { steps: 3 })],
    decoU: (ctx) => dots(ctx, [[-14, 150], [-2, 156], [10, 152]], 1.0, 4, 3) };
  S.armB = { S: [-14, 120], E: [-30, 190], W: [-34, 254], r: [8.6, 5.8, 4.3], hand: 'fist',
    extraU: [taper([[-14, 110], [-18, 148]], 11, 11, { steps: 3 })] };
  S.legF = { H: [8, 268], K: [12, 344], A: [8, 400], r: [12, 7.6, 5], foot: { len: 28 } };
  S.legB = { H: [-12, 268], K: [-14, 344], A: [-20, 400], r: [12, 7.6, 5], foot: { len: 28 } };
  S.rod = { a: [-2, 122], b: [0, 240] };
  S.holds = {};
  return S;
}

// ------------------------------------------------------------ ชาวบ้านหญิง
// A market woman: hair in a bun with a flower, lace-edged blouse, a long
// striped ผ้าถุง.
function chaobanWoman() {
  const S = { headScale: 0.92, tints: { torso: [INK.pink, 0.9], upperArmF: [INK.pink, 0.9], upperArmB: [INK.pink, 0.8], skirt: [INK.vermilion, 0.95] } };
  S.neck = [-2, 80];
  const skull = [
    [-12, 4], [4, 0], [18, 3], [27, 11], [31, 20], [33, 28], [32, 32], [35, 36], [40, 42], [39, 46], [35, 47],
    [37, 51], [36, 55], [29, 56], [20, 57], [10, 61], [2, 68], [-4, 80], [-14, 78], [-20, 64], [-24, 46], [-22, 22],
  ];
  const bun = blobPts(-28, 20, 12, 11, { seed: 81 });
  const pin = taper([[-44, 10], [-28, 18], [-12, 22]], 1.4, 1.4, { steps: 3 });
  S.head = {
    shapes: [skull, bun, pin],
    deco(ctx) {
      eye(ctx, 21, 33, 4, { style: 'almond' });
      slit(ctx, [[14, 26], [21, 24], [28, 26.5]], 0.9);
      slit(ctx, [[33, 41], [32, 46]], 0.7);
      dots(ctx, [[26, 10], [14, 5], [0, 4], [-12, 8], [-20, 20], [-20, 34]], 0.95, 3.8, 81); // hairline
      slit(ctx, [[4, 40], [1, 35], [2, 30], [6, 28]], 1.1);
      hole(ctx, 3.5, 44, 1.6); // earring
      holes(ctx, [[3.5, 49]], 1.1);
      for (const [x, y, r, a] of [[-28, 20, 4.5, 0.3], [-33, 14, 2.8, 1.2], [-22, 26, 2.6, 0.8]]) curlHole(ctx, x, y, r, a);
      dye(ctx, smooth(blobPts(-16, 10, 4.5, 4.5, { seed: 2 })), INK.red, 0.95);
      hole(ctx, -16, 10, 1.2);
    },
  };
  S.jaw = {
    pivot: [0, 54],
    shapes: [[
      [-8, 52], [8, 53], [22, 55], [32, 56], [36, 57], [36, 61], [31, 63], [30, 68], [24, 74], [14, 76],
      [4, 72], [-4, 64],
    ]],
    deco(ctx) {},
  };
  S.torso = {
    shapes: [[
      [-14, 68], [-4, 66], [2, 78], [5, 92], [14, 102], [24, 112], [30, 126], [28, 146], [24, 166], [24, 190],
      [26, 212], [20, 230], [4, 240], [-16, 240], [-28, 228], [-26, 200], [-22, 176], [-24, 150], [-28, 124],
      [-24, 104], [-18, 92], [-15, 78],
    ]],
    deco(ctx) {
      dots(ctx, [[-18, 96], [-8, 104], [4, 108], [12, 104]], 1.1, 3.8, 8);
      dots(ctx, [[-18, 101], [-8, 110], [5, 114], [15, 110]], 0.9, 3.8, 9);
      dots(ctx, [[-26, 176], [0, 180], [24, 178]], 1.0, 4, 10);
      hole(ctx, 22, 136, 1.5);
    },
  };
  const skirt = [
    [-28, 196], [-6, 194], [16, 196], [28, 202], [32, 222], [32, 260], [30, 300], [30, 340], [28, 372], [6, 376],
    [-16, 377], [-34, 372], [-34, 330], [-32, 280], [-34, 236], [-32, 210],
  ];
  S.skirt = {
    pivot: [0, 214],
    shapes: [skirt],
    deco(ctx) {
      const band = (y0, y1, c) => dye(ctx, poly([[-40, y0], [40, y0 - 2], [40, y1 - 2], [-40, y1]]), c, 0.85);
      band(206, 216, INK.gold);
      band(338, 358, INK.gold);
      band(346, 352, INK.indigo);
      for (let y = 236; y < 330; y += 18) band(y, y + 4, INK.orange);
      dots(ctx, [[-34, 202], [0, 200], [30, 206]], 1.1, 4, 12);
      dots(ctx, [[-34, 366], [0, 370], [30, 366]], 1.1, 4, 14);
      for (let y = 245; y < 330; y += 18) dots(ctx, [[-32, y], [0, y - 1], [31, y - 2]], 0.9, 5, 20 + y);
      slit(ctx, [[20, 214], [22, 290], [22, 360]], 1.1); // fold
    },
  };
  S.armF = { S: [-6, 112], E: [2, 184], W: [22, 246], r: [7, 5, 3.8], hand: 'relaxed', handOpts: { k: 0.9 },
    extraU: [taper([[-6, 104], [-4, 136]], 9.5, 9.5, { steps: 3 })],
    decoU: (ctx) => dots(ctx, [[-14, 138], [-4, 144], [6, 140]], 0.9, 3.6, 3) };
  S.armB = { S: [-12, 110], E: [-26, 182], W: [-28, 246], r: [6.8, 4.8, 3.7], hand: 'relaxed', handOpts: { k: 0.9 },
    extraU: [taper([[-12, 102], [-14, 132]], 9, 9, { steps: 3 })] };
  S.legF = { H: [6, 250], K: [8, 328], A: [6, 392], r: [11, 7, 4.4], calf: 2.5, foot: { len: 25, h: 18, heel: 10 } };
  S.legB = { H: [-10, 250], K: [-12, 328], A: [-16, 392], r: [11, 7, 4.4], calf: 2.5, foot: { len: 25, h: 18, heel: 10 } };
  S.rod = { a: [-2, 110], b: [0, 214] };
  S.holds = {};
  return S;
}

// ------------------------------------------------------------ เด็ก
// A village child with a ผมจุก topknot, round belly, amulet necklace and
// a red loincloth.
function dek() {
  const S = { headScale: 1, wob: 0.6 };
  S.neck = [-2, 72];
  const skull = [
    [-14, 12], [0, 8], [14, 10], [24, 18], [30, 28], [32, 36], [30, 40], [35, 44], [37, 49], [33, 51], [34, 55],
    [30, 58], [22, 58], [12, 61], [4, 66], [-2, 72], [-12, 76], [-22, 70], [-28, 54], [-30, 36], [-26, 20],
  ];
  const knot = blobPts(-2, 3, 9, 8, { seed: 91 });
  S.head = {
    shapes: [skull, knot],
    deco(ctx) {
      comicEye(ctx, 19, 36, 4.4, { look: [0.3, 0.1], pupil: 0.55 });
      slit(ctx, [[13, 28], [19, 26.5], [25, 28]], 0.9);
      slit(ctx, [[2, 46], [-1, 41], [0, 36], [4, 34]], 1.2);
      slit(ctx, [[-10, 9], [-2, 11.5], [6, 9]], 1.3); // ring round the topknot
      for (const [x, y, r, a] of [[-2, 1, 3.5, 0.2]]) curlHole(ctx, x, y, r, a);
      dots(ctx, [[-14, 18], [-22, 28]], 0.8, 3.5, 92);
    },
  };
  S.jaw = {
    pivot: [0, 56],
    shapes: [[
      [-8, 54], [8, 55], [20, 57], [30, 57.5], [33, 60], [31, 64], [26, 66], [22, 71], [14, 74], [4, 72],
      [-4, 66],
    ]],
    deco(ctx) {},
  };
  S.torso = {
    shapes: [[
      [-14, 64], [-2, 62], [4, 72], [6, 82], [14, 88], [22, 98], [26, 114], [32, 132], [34, 150], [30, 166],
      [20, 176], [2, 182], [-16, 178], [-24, 162], [-22, 140], [-22, 118], [-24, 100], [-20, 88], [-15, 76],
    ]],
    deco(ctx) {
      dots(ctx, [[-16, 84], [-4, 92], [6, 96], [10, 104], [9, 110]], 0.9, 3.4, 8);
      dots(ctx, [[10, 96], [12, 88]], 0.9, 3.4, 9);
      punch(ctx, [[7, 112], [11, 112], [11, 120], [7, 120]]); // amulet ตะกรุด
      hole(ctx, 26, 146, 1.5);
    },
  };
  const skirt = [
    [-22, 160], [0, 160], [22, 164], [30, 172], [28, 190], [20, 204], [4, 208], [-12, 206], [-24, 196], [-26, 176],
  ];
  const flap = [[14, 170], [24, 172], [26, 196], [28, 218], [20, 220], [16, 196]];
  S.skirt = {
    pivot: [0, 172],
    tint: [INK.red, 0.9],
    shapes: [skirt, flap],
    deco(ctx) {
      dye(ctx, smooth(skirt), INK.vermilion, 1);
      dye(ctx, smooth(flap), INK.orange, 1);
      dots(ctx, [[-22, 168], [0, 167], [26, 172]], 1.0, 3.8, 12);
      dots(ctx, [[18, 176], [21, 200], [23, 214]], 0.9, 3.6, 13);
    },
  };
  S.armF = { S: [-4, 94], E: [4, 146], W: [22, 186], r: [7, 5, 3.8], hand: 'spread', handOpts: { k: 0.75 } };
  S.armB = { S: [-10, 92], E: [-22, 144], W: [-26, 190], r: [6.8, 4.8, 3.6], hand: 'relaxed', handOpts: { k: 0.75 } };
  S.legF = { H: [6, 190], K: [8, 232], A: [5, 264], r: [10, 7, 4.6], calf: 2.5, foot: { len: 20, h: 16, heel: 9, w: 5 } };
  S.legB = { H: [-10, 190], K: [-12, 232], A: [-16, 264], r: [10, 7, 4.6], calf: 2.5, foot: { len: 20, h: 16, heel: 9, w: 5 } };
  S.rod = { a: [-2, 96], b: [0, 172], extend: 200 };
  S.holds = {};
  return S;
}

// ============================================================ dialogue
// Comic characters speak southern Thai (ภาษาใต้); villagers everyday
// central Thai. Each line: { th, en }.
const L = (pairs) => pairs.map(([th, en]) => ({ th, en }));

const LINES = {
  teng: {
    greet: L([
      ['ว่าไหรเหอ พี่น้อง! ฉานเท่งมาแล้ว', "What's up, folks! Teng is here."],
      ['เป็นพรือบ้างเหอ? แลหนังคืนนี้หรอยม้าย', 'How are you? Enjoying the show tonight?'],
      ['หวัดดีเหอ บ่าวสาวทั้งหลาย', 'Hello there, lads and lasses.'],
      ['ไปไสมา? หน้าตาหรอยจังหู', "Where've you been? Looking tasty-fine!"],
    ]),
    joke: L([
      ['นิ้วฉานยาวจังหู ชี้ไปไสก็ถูกหมด', 'My finger is sooo long — whatever I point at, I hit.'],
      ['ฉานไม่หอนขี้หกนะ แค่แหลงเกินจริงนิดเดียว', "I never lie — I just stretch the truth a teeny bit."],
      ['เมียบอกให้หลบบ้านก่อนค่ำ ฉานก็หลบ...ไปหลาด', 'My wife said "come back before dark", so I came back... to the market.'],
      ['ชี้ขึ้นฟ้าทีเดียว ฝนตกทั้งหมู่บ้าน', 'One point at the sky and it rains on the whole village.'],
    ]),
    sell: L([
      ['สะตอฝักงาม ๆ หรอยแรง! ซื้อไปแลเหอ', 'Lovely stink-bean pods, super tasty! Take some.'],
      ['ของดีราคาถูก ไม่ได้โอ้ย ไม่ซื้อไม่ได้!', "Good stuff, cheap! No way — you can't not buy!"],
      ['ลดให้ครึ่งหนึ่ง เพราะหน้าเติ้นหรอยดี', "Half price for you, 'cos you've got a nice face."],
    ]),
    buy: L([
      ['อันนี้เท่าไหร่เหอ? แพงแรง!', 'How much is this? Way too pricey!'],
      ['ลดให้ฉานหน่อย ฉานคนดีนะ', "Knock a bit off, I'm a good guy."],
      ['เอาสองอัน จ่ายพรุ่งนี้ได้ม้าย?', 'Two of those — can I pay tomorrow?'],
    ]),
    fight: L([
      ['มาเลย! นิ้วฉานจิ้มตาแตก!', 'Come on then! My finger will poke your eye!'],
      ['อย่ามาเบ่ง ฉานไม่กลัวเหอ!', "Don't puff up at me, I'm not scared!"],
      ['ฉานนักมวยเก่านะ...เก่าจนลืมหมดแล้ว', "I'm a veteran boxer... so veteran I've forgotten it all."],
    ]),
    flee: L([
      ['ไม่ได้โอ้ย! หนีก่อนแล้ว!', 'No way! Running first!'],
      ['ถ้าก่อน ๆ ฉานลืมของไว้ที่บ้าน!', 'Wait, wait — I left something at home!'],
      ['หลบบ้านแล้วเหอ ไว้เจอกันใหม่!', "I'm off home — see ya!"],
    ]),
    dance: L([
      ['ตุ๊ง ตุ๊ง ทับ! โนราก็สู้ฉานไม่ได้', 'Tung tung thap! Even a Nora dancer can’t beat me.'],
      ['สะเอวเท่งพลิ้วจังหู', "Teng's hips are sooo swishy."],
      ['เต้นเสร็จแล้วขอข้าวยำสักจาน', 'After the dance, a plate of khao yam please.'],
    ]),
    idle: L([
      ['เหอ...ร้อนจังหู', 'Phew... so hot.'],
      ['ท้องร้องแล้ว ใครมีแกงไตปลาม้าย', 'Tummy’s rumbling — anyone got fish-kidney curry?'],
      ['ฉานแลอยู่นะ ใครทำไหรกัน', "I'm watching — what's everybody up to?"],
    ]),
  },
  nunui: {
    greet: L([
      ['หวัดดีเหอ ฉานนุ้ยเอง ใครไม่รู้จักบ้าง?', "Hello! It's me, Nui — who doesn't know me?"],
      ['มาแลหนังกันหลายจังหู', 'So many of you came to watch the show!'],
      ['เป็นพรือ สบายดีม้าย เหอ', 'How are you, doing well?'],
    ]),
    joke: L([
      ['พุงฉานไม่ใหญ่ แค่ข้าวยำมันอยู่เยอะ', "My belly isn't big, there's just a lot of khao yam in it."],
      ['มีดฉานคม...คมจนหั่นแตงโมได้เลยเหอ', 'My knife is sharp... sharp enough to slice a watermelon!'],
      ['เคราฉานนี่แหละ เสน่ห์ตรึงใจสาว ๆ', 'This beard is what charms all the girls.'],
      ['ฉานไม่กลัวผี ผีต่างหากกลัวฉาน', "I'm not scared of ghosts — the ghosts are scared of me."],
    ]),
    sell: L([
      ['ขนมจีนแกงไตปลา หรอยแรง! รับม้ายเหอ', 'Rice noodles with fish-kidney curry, super tasty! Want some?'],
      ['มีดพร้าคม ๆ ถางหญ้าได้ ถางทางไปหาสาวก็ได้', 'Sharp machetes: clear the grass, clear the path to your sweetheart.'],
      ['ซื้อหนึ่งแถมยิ้มนุ้ยฟรีหนึ่งที', 'Buy one, get one free smile from Nui.'],
    ]),
    buy: L([
      ['อันนี้เท่าไหร่? ฉานมีแค่ห้าบาทนะเหอ', 'How much? I only have five baht.'],
      ['แพงแรง! ลดให้นุ้ยคนจนหน่อย', 'So pricey! Give poor Nui a discount.'],
      ['เอาไปก่อน ค่อยจ่ายตอนหนังเลิก', "I'll take it now and pay when the show ends."],
    ]),
    fight: L([
      ['เข้ามา! มีดนุ้ยไม่เคยแพ้ใคร...ยกเว้นแม่', "Come on! Nui's knife never loses... except to Mum."],
      ['ถ้าก่อน! ขอลับมีดก่อน', 'Hold on! Let me sharpen my knife first.'],
      ['อย่าแหลงมาก เดี๋ยวโดนพุงกระแทก', "Talk too much and you'll get belly-bumped."],
    ]),
    flee: L([
      ['ไม่ได้โอ้ย! พุงมันหนัก วิ่งไม่ทัน!', "No way! My belly's too heavy to run!"],
      ['หนีก่อนเหอ แม่เรียกหลบบ้าน!', 'Running — Mum is calling me home!'],
      ['ฉานไม่ได้หนี ฉานไปเอามีดเล่มใหญ่กว่า!', "I'm not running, I'm fetching a bigger knife!"],
    ]),
    dance: L([
      ['ส่ายพุงแบบนุ้ย สาว ๆ ใจละลาย', 'Belly-wobble, Nui style — the girls melt.'],
      ['ทับ ทับ โหม่ง! พุงนุ้ยเต้นตามจังหวะ', "Thap thap mong! Nui's belly keeps the beat."],
      ['เต้นจนเหงื่อแตก หรอยจังหู', 'Dancing till I sweat — so good!'],
    ]),
    idle: L([
      ['หิวแล้วเหอ ข้าวยำอยู่ไส', "I'm hungry — where's the khao yam?"],
      ['ง่วงจังหู ขอแลหนังไปงีบไป', "So sleepy... I'll watch and nap."],
      ['มีดเล่มนี้ ฉานรักกว่าอะไรทั้งหมด', 'I love this knife more than anything.'],
    ]),
  },
  yodthong: {
    greet: L([
      ['ยอดทองมาแล้ว! คนใหญ่คนโตของบาง', 'Yodthong has arrived! The big shot of the district!'],
      ['ทักฉานก่อนสิเหอ ฉานเป็นคนสำคัญ', "Greet me first — I'm an important man."],
      ['พวกเติ้นมาต้อนรับฉานหรือ? ดีมาก ดีมาก', 'You came to welcome me? Very good, very good.'],
    ]),
    joke: L([
      ['พุงใหญ่คือบารมี ฉานบารมีล้นพุง', 'A big belly means prestige — mine overflows.'],
      ['ฉานไม่อ้วน ฉานแค่หล่อเยอะ', "I'm not fat, I just have a lot of handsome."],
      ['ผมหยิกฉานธรรมชาติแท้ ไม่ได้ดัดสักเส้น...มั้ง', "My curls are totally natural, not one permed... probably."],
      ['ฉานสู้ได้สิบคน...ทีละคนนะเหอ', 'I can take on ten men... one at a time.'],
    ]),
    sell: L([
      ['ของยอดทองต้องแพง เพราะเจ้าของหล่อ', "Yodthong's goods are pricey, because the owner is handsome."],
      ['รับรองหรอยแรง! ไม่หรอย...ก็ไม่คืนเงิน', "Guaranteed delicious! If not... no refunds."],
      ['แกงพุงปลาสูตรยอดทอง ของแท้', "Genuine fish-belly curry, Yodthong's recipe."],
    ]),
    buy: L([
      ['ฉานเป็นคนใหญ่ ต้องได้ของฟรีสิเหอ', "I'm a big man — I should get it free."],
      ['ลดให้ฉานครึ่ง ฉานจะชมให้ทั้งบางรู้', "Half off, and I'll praise you to the whole district."],
      ['ห่อให้ใหญ่ ๆ พุงฉานรออยู่', 'Wrap a big one, my belly is waiting.'],
    ]),
    fight: L([
      ['กล้าท้ายอดทองหรือ! แลพุงนี่ก่อน!', 'You dare challenge Yodthong? Look at this belly first!'],
      ['เข้ามาเลย ฉานจะนั่งทับให้แบน!', "Come on, I'll sit on you and squash you flat!"],
      ['ชี้นิ้วทีเดียว ศัตรูหงายหลัง!', 'One point of my finger and enemies fall flat!'],
    ]),
    flee: L([
      ['ถอยทัพ! ไม่ใช่กลัว แค่หิวข้าว', "Retreat! Not scared — just hungry."],
      ['ไม่ได้โอ้ย! คนสำคัญต้องรักษาตัว!', 'No way! Important people must stay safe!'],
      ['หลบก่อนเหอ พุงมันสั่งให้หนี', 'Heading back — my belly orders it.'],
    ]),
    dance: L([
      ['แลลีลายอดทอง พุงโยกเป็นคลื่น', "Watch Yodthong's moves — the belly rolls like waves."],
      ['เต้นแบบคนใหญ่ ต้องช้า ๆ อย่างสง่า', 'A big man dances slowly, with dignity.'],
      ['โนรายังต้องยกมือไหว้ฉาน', 'Even the Nora dancers bow to me.'],
    ]),
    idle: L([
      ['เติ้นว่าฉานหล่อม้าย?', "Don't you think I'm handsome?"],
      ['เหอ... ความใหญ่มันเหนื่อย', "Phew... being great is exhausting."],
      ['ใครเอาหมากมาให้ฉานเคี้ยวบ้าง', 'Somebody bring me betel nut to chew.'],
    ]),
  },
  samor: {
    greet: L([
      ['เหอ? ใครมาเหอ? ตาฉานแลไม่ค่อยเห็นแล้ว', "Eh? Who's there? My eyes aren't what they were."],
      ['หวัดดีลูกหลาน สะหม้อเฒ่ามาแล้ว', 'Hello, children — old Samor is here.'],
      ['มาใกล้ ๆ แหลงดัง ๆ หูฉานตึง', "Come closer and speak up — I'm hard of hearing."],
    ]),
    joke: L([
      ['สมัยฉานหนุ่ม ๆ สาวทั้งบางตามจีบ...บางนั้นมีสาวคนเดียว', 'When I was young every girl in the village chased me... there was only one girl.'],
      ['ฉานไม่แก่ ฉานแค่เกิดก่อนเติ้นนานหน่อย', "I'm not old, I was just born a while before you."],
      ['ฟันเหลือซี่เดียว แต่ยังเคี้ยวหมากได้หรอย', 'One tooth left, and it still chews betel just fine.'],
    ]),
    sell: L([
      ['หมากพลูสด ๆ จากสวนเฒ่า รับม้ายเหอ', "Fresh betel from the old man's garden — want some?"],
      ['ไม้เท้าอย่างดี ใช้มาห้าสิบปี ยังไม่หัก', 'Top-quality walking stick — fifty years and still not broken.'],
      ['ของเก่าเก็บ ยิ่งเก่ายิ่งหรอย', 'Vintage goods — the older, the better.'],
    ]),
    buy: L([
      ['เท่าไหร่นะ? แหลงดัง ๆ หน่อย', 'How much? Say it louder.'],
      ['สมัยก่อนอันนี้สลึงเดียวเหอ!', 'In my day this cost a quarter-baht!'],
      ['ลดให้คนเฒ่าหน่อย ฉานนับเงินช้า', "A discount for an old man — I count slowly."],
    ]),
    fight: L([
      ['อย่าคิดว่าฉานเฒ่า มีดพร้ายังคมอยู่!', "Don't think I'm too old — my blade is still sharp!"],
      ['เข้ามาเลยไอ้บ่าว หลังไม่ดี แต่มือยังไว', 'Come on, young fellow — bad back, quick hands.'],
      ['ฉานเคยสู้กับเสือ...เสือในหนังนะเหอ', 'I once fought a tiger... a shadow-play tiger.'],
    ]),
    flee: L([
      ['โอ้ยหลังฉาน! หนีไม่ไหว...ก็ต้องหนี!', "Ow, my back! Can't run... must run!"],
      ['ถ้าก่อน ๆ ถ้าเฒ่าด้วย!', 'Wait, wait for the old man!'],
      ['ไม่ได้โอ้ย หลบบ้านดีกว่า', "No way — better head home."],
    ]),
    dance: L([
      ['เต้นช้า ๆ แบบเฒ่า ๆ ข้อมันลั่น', 'Dancing slow, old-man style — the joints are creaking.'],
      ['สมัยก่อนฉานรำโนราเก่งที่สุดในบาง', 'Back then I was the best Nora dancer around.'],
      ['ทับมันดัง ตัวฉานมันสั่น', 'The drum is loud and I am wobbly.'],
    ]),
    idle: L([
      ['เหอ... ง่วงแล้ว ขอนั่งก่อน', 'Ahh... sleepy. Let me sit down.'],
      ['หมากแหม็ดแล้ว ใครมีหมากบ้าง', "Out of betel — anybody got some?"],
      ['ฉานลืมแล้วว่าออกมาทำไหร', "I've forgotten what I came out here for."],
    ]),
  },
  srikaew: {
    greet: L([
      ['หวัดดีจังหูพี่น้อง ศรีแก้วมาแล้วเหอ', 'A big hello, everyone — Srikaew is here!'],
      ['กินข้าวแล้วม้าย? ฉานยัง!', "Have you eaten yet? I haven't!"],
      ['หน้าเติ้นคุ้น ๆ เคยยืมเงินฉานม้าย?', 'You look familiar — did you borrow money from me?'],
    ]),
    joke: L([
      ['หัวฉานเกลี้ยงเพราะคิดเยอะ ผมเลยไม่มีที่อยู่', "My head's bald from thinking so hard — the hair had no room."],
      ['ผ้าฉานลายตาหมากรุก เพราะฉานเดินหมากเก่ง', 'My sarong is checkered because I play chess so well.'],
      ['พุงฉานเก็บข้าวยำไว้ได้สามวัน', 'My belly stores three days of khao yam.'],
    ]),
    sell: L([
      ['ข้าวยำน้ำบูดู หรอยแรง! ใส่ผักให้เต็ม', 'Khao yam with budu sauce, super tasty! Loaded with greens.'],
      ['ขนมโคลูกกลม ๆ เหมือนหัวฉาน', 'Khanom kho — round little balls, just like my head.'],
      ['มาเหอ มาชิมก่อน ไม่หรอยไม่ต้องซื้อ', "Come taste first — if it's not good, don't buy."],
    ]),
    buy: L([
      ['เท่าไหร่เหอ? ขอชิมก่อนสักสามคำ', 'How much? Let me taste three bites first.'],
      ['ลดให้หน่อย ฉานลูกค้าประจำ...ตั้งแต่เมื่อกี้', "Discount please, I'm a regular... since just now."],
      ['เอาสองห่อ อีกห่อไว้กินระหว่างทาง', 'Two packs — one for the road.'],
    ]),
    fight: L([
      ['มาเลย! หัวฉานแข็งเหมือนลูกมะพร้าว', 'Come on! My head is hard as a coconut!'],
      ['โขกหัวทีเดียว หลับไปสามวัน!', "One headbutt and you'll sleep three days!"],
      ['อย่ามาแย่งข้าวฉานนะเหอ!', "Don't you dare take my food!"],
    ]),
    flee: L([
      ['ไม่ได้โอ้ย ข้าวยังไม่ได้กินเลย!', "No way — I haven't even eaten yet!"],
      ['หนีก่อน ๆ หัวศรีแก้วแตกไม่ได้', "Run! Srikaew's head can't get cracked!"],
      ['ไปก่อนแล้ว ฝากจ่ายค่าข้าวด้วยเหอ', "I'm off — pay for my meal, would you?"],
    ]),
    dance: L([
      ['โยกพุงซ้าย โยกพุงขวา', 'Belly to the left, belly to the right.'],
      ['หัวฉานเงาจนสะท้อนตะเกียงเลยเหอ', 'My head shines so much it reflects the lamp!'],
      ['เต้นเสร็จแล้วไปกินต่อ', 'Dance done — back to eating.'],
    ]),
    idle: L([
      ['ท้องร้องอีกแล้ว', 'Tummy is rumbling again.'],
      ['ร้อนจังหู หัวจะไหม้แล้ว', 'So hot, my head is going to burn.'],
      ['ใครทำขนมหรอย ๆ ไว้ ฉานได้กลิ่น', 'Someone made tasty sweets — I can smell them.'],
    ]),
  },
  khwanmuang: {
    greet: L([
      ['ขวัญเมืองมาแล้ว อย่าตกใจปากฉานเหอ', "Khwan Muang is here — don't be scared of my snout!"],
      ['หวัดดีพี่น้อง ปากยาวแต่ใจดีนะ', 'Hello all — long mouth, kind heart.'],
      ['แลหนังกันให้หรอยเหอ คืนนี้ฉานมาแหลงเอง', "Enjoy the show — tonight I'm doing the talking."],
    ]),
    joke: L([
      ['ปากฉานยาวเพราะแหลงเก่ง แหลงทั้งวันไม่หยุด', 'My mouth is long from talking all day without a break.'],
      ['จระเข้ยังต้องเรียกฉานว่าพี่', 'Even crocodiles call me "big brother".'],
      ['ตัวฉานเขียวเพราะกินผักเยอะ ไม่ได้อิจฉาใคร', "I'm green from eating veggies, not from envy."],
    ]),
    sell: L([
      ['ปลาสด ๆ จากทะเลสาบ ฉานจับมากับปาก', 'Fresh fish from the lake — I caught them with my mouth.'],
      ['กะปิหรอยแรง! กลิ่นแรงกว่าปากฉานอีก', 'Shrimp paste, super tasty — smells stronger than my breath!'],
      ['ซื้อเหอ ๆ ขวัญเมืองไม่โกงใคร', "Buy, buy — Khwan Muang cheats nobody."],
    ]),
    buy: L([
      ['อันนี้เท่าไหร่? อย่าโก่งราคาคนหน้าเขียว', "How much? Don't overcharge the green guy."],
      ['ลดให้หน่อย ฉานยิ้มให้ฟรี', 'Give me a discount, I’ll smile for free.'],
      ['ห่อใหญ่ ๆ ปากฉานกว้าง', 'Wrap it big, my mouth is wide.'],
    ]),
    fight: L([
      ['ระวังนะ ฉานงับทีเดียวขาดเลย!', 'Careful — one snap and you’re in two!'],
      ['มาเลย ตะบองฉานรออยู่!', 'Come on, my club is waiting!'],
      ['จระเข้ขวางคลองก็คือฉานนี่แหละ!', "The crocodile blocking the canal? That's me!"],
    ]),
    flee: L([
      ['ไม่ได้โอ้ย! ว่ายน้ำหนีดีกว่า', 'No way! Better swim for it!'],
      ['หลบก่อนเหอ ฉานลืมปิดประตูบ้าน', 'Heading back — I forgot to shut my door.'],
      ['ถ้าก่อน ๆ ปากมันหนัก วิ่งไม่ไหว', "Wait, wait — my snout's too heavy to run."],
    ]),
    dance: L([
      ['เต้นแบบจระเข้ฟาดหาง', 'Dancing like a crocodile swishing its tail.'],
      ['อ้าปากหุบปาก ตามจังหวะทับ', 'Open wide, snap shut — to the beat of the drum.'],
      ['ขวัญเมืองเต้นแล้ว ทุกคนต้องปรบมือ', 'Khwan Muang is dancing — everybody clap!'],
    ]),
    idle: L([
      ['ปากเมื่อยแล้ว แหลงมากไป', 'My jaw is tired — too much talking.'],
      ['อยากลงน้ำจังหู', 'I really want a swim.'],
      ['ใครแลฉานอยู่ ยิ้มหน่อยเหอ', "Whoever's watching me — give us a smile."],
    ]),
  },
  phuyaiphoon: {
    greet: L([
      ['ประกาศ ๆ ผู้ใหญ่พูนมาแล้ว!', 'Announcement! Headman Phoon has arrived!'],
      ['ลูกบ้านทั้งหลาย อยู่ดีกินหรอยกันม้าย?', 'Villagers! Living well and eating well?'],
      ['หวัดดีเหอ มาประชุมหมู่บ้านกันหรือยัง?', 'Hello — coming to the village meeting?'],
    ]),
    joke: L([
      ['ก้นฉานใหญ่ เพราะนั่งประชุมมาสามสิบปี', 'My bottom is big from thirty years of sitting in meetings.'],
      ['ประชุมวันนี้มีเรื่องเดียว...ใครจะเลี้ยงข้าวผู้ใหญ่', "Today's agenda has one item... who's buying the headman lunch."],
      ['ผู้ใหญ่บ้านไม่เคยผิด ถ้าผิดก็ประชุมใหม่', 'The headman is never wrong — if he is, we hold another meeting.'],
    ]),
    sell: L([
      ['ของดีประจำหมู่บ้าน ผู้ใหญ่รับรอง!', "The village's best product — headman approved!"],
      ['ซื้อเหอ ๆ เงินเข้ากองทุนหมู่บ้าน...กระเป๋าฉานนี่แหละ', 'Buy, buy — money goes to the village fund... that is, my pocket.'],
      ['ลูกหยีหรอยแรง ของดีเมืองใต้', 'Tamarind sweets, super tasty — the pride of the south.'],
    ]),
    buy: L([
      ['ผู้ใหญ่บ้านต้องได้ราคาพิเศษ', 'The headman gets a special price.'],
      ['เขียนบิลไว้ก่อน เดี๋ยวหมู่บ้านจ่าย', 'Put it on the bill — the village will pay.'],
      ['อันนี้ฉานขอยึดไว้ตรวจสอบก่อนนะ', "I'll be confiscating this for inspection."],
    ]),
    fight: L([
      ['หยุด! ห้ามทะเลาะกันในหมู่บ้านฉาน!', 'Stop! No fighting in my village!'],
      ['จะเอาเรื่องหรือ! ฉานจะเรียกกำนัน!', "Want trouble? I'll call the district chief!"],
      ['ฉานนี่แหละกฎหมาย เข้ามาเลย!', 'I am the law — come on then!'],
    ]),
    flee: L([
      ['ไม่ได้โอ้ย! ผู้ใหญ่ต้องไปประชุมด่วน', 'No way! The headman has an urgent meeting!'],
      ['ถอยก่อน ๆ ก้นมันหนัก', 'Backing off — my bottom is heavy.'],
      ['ฝากดูแลหมู่บ้านด้วย ฉานไปก่อน!', 'Look after the village, I’m off!'],
    ]),
    dance: L([
      ['เต้นเปิดงานวัด ผู้ใหญ่ต้องนำ', 'Opening dance at the temple fair — the headman leads.'],
      ['ส่ายก้นแบบผู้ใหญ่ มีบารมี', 'A headman’s hip-shake — very dignified.'],
      ['ปรบมือให้ผู้ใหญ่หน่อยเหอ', 'A round of applause for the headman!'],
    ]),
    idle: L([
      ['เหอ...งานหมู่บ้านเยอะจังหู', 'Phew... so much village business.'],
      ['ใครเห็นตรายางฉานบ้าง', 'Has anyone seen my rubber stamp?'],
      ['เดี๋ยวต้องไปประกาศเสียงตามสาย', 'I need to go make a loudspeaker announcement.'],
    ]),
  },
  aitho: {
    greet: L([
      ['หวัดดี ๆ ๆ ฉานรีบนะเหอ!', "Hi hi hi — I'm in a hurry!"],
      ['ไอ้โถมาแล้ว...แล้วก็จะไปแล้ว!', "Ai Tho is here... and already leaving!"],
      ['มีไหรให้ช่วยม้าย เร็ว ๆ เหอ', "Need a hand? Quick, quick!"],
    ]),
    joke: L([
      ['ฉานวิ่งไวจนเงาตามไม่ทัน', 'I run so fast my shadow can’t keep up.'],
      ['ผมฉานตั้งเพราะลมมันแรง ฉานวิ่งไว', "My hair sticks up from the wind — I'm that fast."],
      ['ฉานไม่ได้กลัวนะ ฉานแค่ชอบออกกำลังกาย', "I'm not scared, I just love exercise."],
    ]),
    sell: L([
      ['ส่งด่วน! ของถึงก่อนสั่งอีก', 'Express delivery! It arrives before you order!'],
      ['ขนมจีนหรอยแรง! รีบซื้อก่อนฉานวิ่งหนี', 'Tasty rice noodles! Buy quick before I run off!'],
      ['ซื้อไว ๆ เหอ ฉานไม่มีเวลา', 'Buy fast, I have no time!'],
    ]),
    buy: L([
      ['เอาอันนี้! ไม่ต้องทอน ฉานรีบ!', 'This one! Keep the change, I’m in a rush!'],
      ['เท่าไหร่ ๆ แหลงไว ๆ', 'How much, how much — say it quick!'],
      ['ห่อไว ๆ เหอ เดี๋ยวหมาไล่มาแล้ว', 'Wrap it quick, the dog is chasing me again.'],
    ]),
    fight: L([
      ['เข้ามา! ...เอ้ย อย่าเข้ามา!', 'Come at me! ...uh, no, don’t!'],
      ['ฉานต่อยไวจนมองไม่เห็น...เพราะไม่ได้ต่อย', "My punch is too fast to see... because I didn't throw it."],
      ['ระวังนะ ฉานวิ่งชนแน่!', "Watch out — I'll run right into you!"],
    ]),
    flee: L([
      ['ไม่ได้โอ้ย! วิ่งเหอ!', 'No way! Run!'],
      ['หนีก่อนแล้วเหอ!', "I'm outta here!"],
      ['ไอ้โถไปแล้ว ไม่ต้องตาม!', "Ai Tho's gone — don't follow!"],
    ]),
    dance: L([
      ['เต้นไวแบบไอ้โถ ขาพันกัน', 'Fast dancing, Ai Tho style — legs in a tangle.'],
      ['ทับไวขึ้นอีกเหอ!', 'Faster on the drum!'],
      ['หมุน ๆ ๆ เวียนหัวแล้ว', 'Spin, spin, spin... I’m dizzy.'],
    ]),
    idle: L([
      ['ยืนนิ่ง ๆ ไม่เป็นเหอ', "I can't stand still."],
      ['มีใครตามฉานมาม้าย?', 'Is someone following me?'],
      ['ขามันคัน อยากวิ่ง', 'My legs are itching to run.'],
    ]),
  },
  'chaoban-man': {
    greet: L([
      ['สวัสดีครับ ไปไหนมาครับ', 'Hello! Where are you coming from?'],
      ['กินข้าวมาหรือยังพ่อหนุ่ม', 'Have you eaten yet, young man?'],
      ['ปีนี้ฝนดี ข้าวงามแน่', 'Good rain this year — the rice will be fine.'],
    ]),
    joke: L([
      ['ควายผมยังฉลาดกว่าผม...มันรู้จักพัก', 'My buffalo is smarter than me... it knows when to rest.'],
      ['งอบใบนี้กันแดดได้ แต่กันเมียบ่นไม่ได้', 'This hat keeps off the sun, but not my wife’s nagging.'],
      ['ผมไม่ได้ขี้เกียจ ผมแค่ประหยัดแรง', "I'm not lazy, I'm saving energy."],
    ]),
    sell: L([
      ['ข้าวใหม่หอม ๆ จากนาครับ', 'Fragrant new rice, straight from the paddy!'],
      ['ผักบุ้งสด ๆ เพิ่งเก็บเมื่อเช้า', 'Fresh morning glory, picked this morning.'],
      ['ไข่เป็ดฟองใหญ่ ถูก ๆ ครับ', 'Big duck eggs, cheap!'],
    ]),
    buy: L([
      ['ปุ๋ยกระสอบนี้เท่าไหร่ครับ', 'How much is this sack of fertiliser?'],
      ['ลดหน่อยได้ไหม ข้าวยังไม่ได้ขาย', "Can you knock it down? I haven't sold my rice yet."],
      ['ขอจอบเล่มใหม่สักเล่มครับ', "I'd like a new hoe, please."],
    ]),
    fight: L([
      ['อย่ามาเหยียบนาข้านะ!', "Don't you trample my rice field!"],
      ['ข้าไม่อยากมีเรื่อง แต่ถ้ามา ข้าก็สู้!', "I don't want trouble, but if you start it, I'll fight!"],
      ['ปล่อยควายข้าเดี๋ยวนี้!', 'Let go of my buffalo right now!'],
    ]),
    flee: L([
      ['หนีเร็ว! ควายตื่น!', 'Run! The buffalo’s spooked!'],
      ['ไม่เอาด้วยแล้ว กลับบ้านดีกว่า', "I'm out — better go home."],
      ['ฝนมาแล้ว รีบกลับ!', 'Rain’s coming — hurry home!'],
    ]),
    dance: L([
      ['รำวงกันเถอะพี่น้อง', "Let's do the ramwong, everyone!"],
      ['เกี่ยวข้าวเสร็จแล้ว มาฉลองกัน', 'Harvest is in — time to celebrate!'],
      ['หนังตะลุงคืนนี้สนุกจริง ๆ', 'The shadow play tonight is great fun.'],
    ]),
    idle: L([
      ['เหนื่อยจัง ขอพักใต้ต้นไม้หน่อย', "So tired — I'll rest under a tree."],
      ['ปีนี้ขอให้ข้าวได้ราคาดี ๆ', 'Hope rice fetches a good price this year.'],
      ['ควายหายไปไหนอีกแล้ว', 'Where has that buffalo wandered off to now?'],
    ]),
  },
  'chaoban-woman': {
    greet: L([
      ['สวัสดีจ้ะ แวะมาดูก่อนจ้ะ', 'Hello dear, come and have a look!'],
      ['มาแต่เช้าเลยนะจ๊ะ', "You're here bright and early!"],
      ['ไปตลาดด้วยกันไหมจ๊ะ', 'Shall we go to the market together?'],
    ]),
    joke: L([
      ['ผัวบอกจะมาช่วยขาย...ช่วยกินหมดแล้ว', 'My husband said he’d help sell... he helped eat it all.'],
      ['ขายของทั้งวัน ปากเหนื่อยกว่าขาอีก', 'Selling all day — my mouth is more tired than my legs.'],
      ['ลูกค้าชมว่าฉันหวาน เลยขึ้นราคาน้ำตาล', 'A customer said I’m sweet, so I raised the price of sugar.'],
    ]),
    sell: L([
      ['ขนมครกร้อน ๆ จ้า', 'Hot coconut pancakes!'],
      ['ผ้าถุงลายสวย ถูก ๆ จ้ะ', 'Pretty sarongs, cheap!'],
      ['มังคุด เงาะ ลองกอง หวานฉ่ำ ชิมก่อนได้จ้ะ', 'Mangosteen, rambutan, longkong — so sweet, try one!'],
    ]),
    buy: L([
      ['กิโลละเท่าไหร่จ๊ะ', 'How much per kilo?'],
      ['แถมหน่อยได้ไหมจ๊ะ ซื้อเยอะนะ', "Throw in a little extra? I'm buying a lot."],
      ['ขอดูลายอื่นอีกได้ไหม', 'Can I see some other patterns?'],
    ]),
    fight: L([
      ['อย่ามาโกงตาชั่งฉันนะ!', "Don't you cheat on my scales!"],
      ['ไปให้พ้นแผงฉันเลย!', 'Get away from my stall!'],
      ['เดี๋ยวเอาไม้กวาดฟาดเลย!', "I'll whack you with my broom!"],
    ]),
    flee: L([
      ['ตายแล้ว! ช่วยด้วย!', 'Oh my goodness! Help!'],
      ['เก็บของเร็ว ฝนมาแล้ว!', 'Pack up quick, rain is coming!'],
      ['ไม่ขายแล้ว กลับบ้านดีกว่า', "I'm closing up — going home."],
    ]),
    dance: L([
      ['รำวงรอบกองไฟกันจ้ะ', "Let's dance around the fire!"],
      ['จังหวะนี้ชอบจัง', 'I love this rhythm.'],
      ['มาเต้นด้วยกันสิจ๊ะ', 'Come dance with me!'],
    ]),
    idle: L([
      ['วันนี้ขายดีจัง', "Business is good today."],
      ['ร้อนจังเลย ขอพัดหน่อย', "It's so hot — let me fan myself."],
      ['เดี๋ยวต้องไปรับลูกที่โรงเรียน', 'I have to pick up the kids from school soon.'],
    ]),
  },
  dek: {
    greet: L([
      ['สวัสดีครับ!', 'Hello!'],
      ['พี่ ๆ มาดูหนังตะลุงเหรอฮะ', 'Did you come to see the shadow play?'],
      ['แม่ให้มาซื้อขนมฮะ', 'Mum sent me to buy snacks.'],
    ]),
    joke: L([
      ['จุกผมหนูไม่ใช่เขานะ!', "My topknot isn't a horn!"],
      ['หนูวิ่งเร็วกว่าไก่อีก', 'I run faster than a chicken!'],
      ['อะไรเอ่ย มีตาแต่มองไม่เห็น... สับปะรดไง!', 'What has eyes but can’t see? A pineapple!'],
    ]),
    sell: L([
      ['ลูกอมไหมฮะ เม็ดละบาท', 'Want a sweet? One baht each.'],
      ['ว่าวตัวนี้หนูทำเองนะ', 'I made this kite myself!'],
      ['ขนมแม่ทำ อร่อยมากเลย', 'Mum made these snacks — really yummy.'],
    ]),
    buy: L([
      ['อันนี้เท่าไหร่ฮะ หนูมีห้าบาท', 'How much is this? I have five baht.'],
      ['ขอลูกโป่งอันแดง ๆ ฮะ', 'The red balloon, please!'],
      ['แถมให้หนูหน่อยนะ', 'Give me a little extra, please?'],
    ]),
    fight: L([
      ['อย่าแกล้งหนูนะ!', "Don't pick on me!"],
      ['เดี๋ยวฟ้องแม่เลย!', "I'm telling Mum!"],
      ['หนูไม่กลัวหรอก!', "I'm not scared!"],
    ]),
    flee: L([
      ['แม่จ๋า!', 'Mummy!'],
      ['หนีเร็ว หมาไล่!', 'Run, the dog is chasing us!'],
      ['กลับบ้านก่อนนะ!', "I'm going home!"],
    ]),
    dance: L([
      ['เต้นแบบไอ้เท่งดีกว่า!', "I'll dance like Ai Teng!"],
      ['ดูหนูหมุนสิ!', 'Watch me spin!'],
      ['เย้ ๆ สนุกจัง!', 'Yay, this is fun!'],
    ]),
    idle: L([
      ['เบื่อจัง ไปเล่นว่าวดีกว่า', "I'm bored — let's go fly kites."],
      ['หิวขนมแล้ว', "I'm hungry for snacks."],
      ['หนังตะลุงเริ่มยังฮะ', 'Has the shadow play started yet?'],
    ]),
  },
};

// ============================================================ catalogue
const CAST = [
  ['teng', 'ไอ้เท่ง', 'Ai Teng — the crooked-finger joker', 'comic', 'comic', 420, teng],
  ['nunui', 'หนูนุ้ย', 'Nu Nui — the pot-bellied knife-waver', 'comic', 'comic', 415, nunui],
  ['yodthong', 'ยอดทอง', 'Yodthong — the pompous fat man', 'comic', 'male', 410, yodthong],
  ['samor', 'สะหม้อ', 'Samor — the old grumbler', 'comic', 'old', 420, samor],
  ['srikaew', 'ศรีแก้ว', 'Srikaew — the bald glutton', 'comic', 'comic', 420, srikaew],
  ['khwanmuang', 'ขวัญเมือง', 'Khwan Muang — the crocodile-snouted wit', 'comic', 'comic', 420, khwanmuang],
  ['phuyaiphoon', 'ผู้ใหญ่พูน', 'Phuyai Phoon — the village headman', 'comic', 'old', 405, phuyaiphoon],
  ['aitho', 'ไอ้โถ', 'Ai Tho — the runner', 'comic', 'comic', 420, aitho],
  ['chaoban-man', 'ชาวบ้านชาย', 'Villager — rice farmer', 'villager', 'male', 420, chaobanMan],
  ['chaoban-woman', 'ชาวบ้านหญิง', 'Villager — market woman', 'villager', 'female', 410, chaobanWoman],
  ['dek', 'เด็ก', 'Village child', 'villager', 'child', 280, dek],
];

export const PUPPETS = CAST.map(([id, name, en, kind, voice, height, spec]) => ({
  id, name, en, kind, voice, height, lines: LINES[id],
  build() {
    return buildFigure({ id, name, en, kind, voice, height, lines: LINES[id] }, spec());
  },
}));
