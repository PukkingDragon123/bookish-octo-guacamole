// Unit tests for the hand-tracking pipeline:  node tools/test-gestures.mjs [-v]
//
// Synthetic landmark sets come from a parametric hand model (per-finger curl,
// splay, thumb placement, pinch + global roll/pitch/yaw/scale), roughened here
// with noise, shallow MediaPipe-style depth and per-person finger proportions.
// Real MediaPipe HandLandmarker outputs (tasks-vision 1.0.1 on MediaPipe's own
// test photos) anchor the synthetic model to reality.

import v8 from 'node:v8';
import vm from 'node:vm';
import * as G from '../js/tracking/gestures.js';
import { OneEuroFilter, OneEuroVec, RangeCalibrator, Hysteresis } from '../js/tracking/filters.js';
import { HandTracker, DEMO_SEQ, DEMO_SEGMENT } from '../js/tracking/hands.js';

const VERBOSE = process.argv.includes('-v');
const DEG = Math.PI / 180;
let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    if (VERBOSE) console.log(`  ok  ${name}`);
  } catch (e) {
    failures.push([name, e]);
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
}
function ok(cond, msg = 'expected truthy') {
  if (!cond) throw new Error(msg);
}
function eq(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function near(a, b, eps, msg = '') {
  if (!(Math.abs(a - b) <= eps)) throw new Error(`${msg} expected ${b} ± ${eps}, got ${a}`);
}

// ---------------------------------------------------------------------------
// Synthetic hand generator helpers

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r) {
  return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
}

/**
 * Synthetic landmarks (iso, mirrored) for a pose preset + variations.
 * v: { hand, roll, pitch, yaw, size, x, y, zScale, noise (× palm size), prop (finger length jitter), seed, ...overrides }
 */
function hand(pose, v = {}) {
  const base = typeof pose === 'string' ? G.POSES[pose] : pose;
  const handed = v.hand || 'Right';
  const mirror = handed === 'Left' ? -1 : 1;
  const p = {
    ...base,
    ...v.override,
    handedness: handed,
    roll: ((base.roll || 0) + (v.roll || 0)) * mirror,
    pitch: v.pitch || 0,
    yaw: (v.yaw || 0) * mirror + (v.back ? Math.PI : 0),
    size: v.size || 0.22,
    x: v.x ?? 0.66,
    y: v.y ?? 0.5,
  };
  const P = G.synthHand(p);
  const r = rng(v.seed || 1);
  // per-person proportions: scale each finger chain about its base joint
  if (v.prop) {
    for (const f of G.FINGERS) {
      const k = 1 + (r() * 2 - 1) * v.prop;
      const b = f === G.FINGERS[0] ? P[1] : P[f[0]];
      for (const j of f.slice(f === G.FINGERS[0] ? 1 : 1)) for (let c = 0; c < 3; c++) P[j][c] = b[c] + (P[j][c] - b[c]) * k;
    }
  }
  // MediaPipe's image z is much shallower than true depth
  if (v.zScale != null) for (const q of P) q[2] *= v.zScale;
  if (v.noise) {
    const s = p.size * v.noise;
    for (const q of P) {
      q[0] += gauss(r) * s;
      q[1] += gauss(r) * s;
      q[2] += gauss(r) * s * 2;
    }
  }
  return P;
}

function classify(P, handed = 'Right') {
  const f = G.extractFeatures(P, handed);
  return { f, r: G.classifyGesture(f) };
}

// Raw MediaPipe-shaped result (unmirrored normalized coords) from iso landmarks.
function toResult(hands, aspect = 4 / 3) {
  return {
    landmarks: hands.map(({ P }) => P.map(([x, y, z]) => ({ x: 1 - x / aspect, y, z: z / aspect }))),
    handedness: hands.map(({ hand: h, score = 0.95 }) => [{ categoryName: h, displayName: h, score, index: 0 }]),
    worldLandmarks: [],
  };
}

// ---------------------------------------------------------------------------
// Real MediaPipe landmarks (tasks-vision 1.0.1, IMAGE mode) for MediaPipe's
// test photos: raw normalized [x,y,z] × 21, the model's handedness label and
// the expected result. The "hands" photos show the BACK of open hands, which
// is deliberately not 'open' (block needs the palm toward the camera).

const REAL = [
  { img: 'fist', w: 358, h: 354, label: 'Right', expect: 'fist', facing: 'palm', lm: [0.4758,0.662,0,0.6085,0.557,-0.0423,0.711,0.4315,-0.065,0.6864,0.3198,-0.0863,0.5628,0.3198,-0.0948,0.608,0.3013,-0.0171,0.6291,0.2124,-0.0648,0.6223,0.3319,-0.091,0.6074,0.3683,-0.1066,0.5131,0.3175,-0.023,0.5295,0.2451,-0.067,0.549,0.3809,-0.0775,0.5431,0.388,-0.0834,0.4292,0.3449,-0.0376,0.4486,0.2725,-0.0829,0.4772,0.3967,-0.0662,0.4671,0.4096,-0.05,0.3477,0.3729,-0.0564,0.3864,0.3272,-0.0713,0.4111,0.3978,-0.0465,0.3937,0.4105,-0.0285] },
  { img: 'victory', w: 342, h: 362, label: 'Right', expect: 'victory', facing: 'palm', lm: [0.518,0.8079,0,0.6061,0.7137,-0.0442,0.6272,0.5915,-0.0632,0.5273,0.5233,-0.087,0.4257,0.4989,-0.1101,0.5596,0.4508,-0.0179,0.5746,0.3225,-0.0523,0.5781,0.2436,-0.0767,0.5813,0.1705,-0.0946,0.4684,0.4611,-0.0341,0.4403,0.3159,-0.0796,0.424,0.2216,-0.1122,0.4042,0.1405,-0.131,0.3949,0.5073,-0.0572,0.361,0.4374,-0.1319,0.4174,0.5275,-0.1475,0.4537,0.5963,-0.1358,0.3319,0.5745,-0.0834,0.3095,0.5075,-0.1341,0.3563,0.5615,-0.1289,0.3948,0.6143,-0.1137] },
  { img: 'pointing_up', w: 358, h: 376, label: 'Right', expect: 'point', facing: 'palm', lm: [0.4803,0.7457,0,0.5421,0.6641,-0.0405,0.5782,0.5623,-0.0696,0.5271,0.5026,-0.098,0.4432,0.4983,-0.1264,0.4728,0.4416,-0.0565,0.4799,0.3285,-0.0978,0.4849,0.2607,-0.1238,0.477,0.1979,-0.1456,0.3935,0.4732,-0.0685,0.4203,0.4232,-0.13,0.4613,0.5211,-0.1426,0.4579,0.5575,-0.1414,0.3339,0.5189,-0.0836,0.3615,0.4882,-0.1484,0.4106,0.5732,-0.1326,0.4053,0.5968,-0.1096,0.2803,0.5743,-0.1018,0.3081,0.5387,-0.1422,0.3545,0.5911,-0.1215,0.3535,0.6133,-0.0999] },
  { img: 'pointing_up_rotated', w: 376, h: 358, label: 'Right', expect: 'point', facing: 'palm', lm: [0.2497,0.4794,0,0.3329,0.5404,-0.0347,0.4348,0.5768,-0.0606,0.4948,0.5298,-0.0872,0.4946,0.4463,-0.1134,0.5524,0.4748,-0.0484,0.6684,0.4817,-0.0861,0.7362,0.4861,-0.1094,0.7993,0.4767,-0.1299,0.5218,0.3962,-0.0617,0.5726,0.4192,-0.118,0.4734,0.4605,-0.1282,0.4406,0.4571,-0.1268,0.4769,0.3367,-0.0778,0.5097,0.3597,-0.1376,0.4237,0.4091,-0.1209,0.4021,0.4026,-0.0991,0.4221,0.2818,-0.0968,0.4545,0.3074,-0.1333,0.4041,0.3522,-0.1132,0.3859,0.3491,-0.0934] },
  { img: 'thumb_up', w: 382, h: 406, label: 'Right', expect: 'thumbsUp', facing: 'palm', lm: [0.6377,0.6725,0,0.6355,0.5367,-0.0646,0.5739,0.412,-0.0862,0.4985,0.3248,-0.0988,0.475,0.2507,-0.0954,0.4085,0.4719,-0.0445,0.3381,0.4679,-0.0955,0.4414,0.5082,-0.1053,0.4807,0.5157,-0.1039,0.3939,0.551,-0.0294,0.3418,0.5577,-0.0808,0.4623,0.5822,-0.0812,0.4727,0.5617,-0.0763,0.395,0.6205,-0.025,0.3425,0.6294,-0.0835,0.4499,0.6431,-0.0642,0.4651,0.6214,-0.0418,0.3961,0.6843,-0.0253,0.3582,0.702,-0.0578,0.4256,0.7019,-0.044,0.4421,0.6903,-0.028] },
  { img: 'right_hands', w: 720, h: 382, label: 'Right', expect: 'none', facing: 'back', lm: [0.8095,0.9249,0,0.7103,0.8816,-0.028,0.6406,0.7582,-0.05,0.5944,0.6213,-0.0669,0.5477,0.5352,-0.0858,0.6944,0.5714,-0.0662,0.6667,0.3696,-0.0939,0.6519,0.2418,-0.1092,0.6438,0.1346,-0.1196,0.7543,0.5456,-0.0665,0.7457,0.3177,-0.0927,0.7409,0.1693,-0.108,0.7379,0.0539,-0.1194,0.8091,0.558,-0.0671,0.8177,0.3493,-0.0956,0.8238,0.208,-0.1175,0.8262,0.1024,-0.1311,0.8574,0.5892,-0.0676,0.8801,0.4256,-0.0937,0.8938,0.3237,-0.1096,0.9051,0.2368,-0.1195] },
  { img: 'right_hands', w: 720, h: 382, label: 'Right', expect: 'none', facing: 'back', lm: [0.1906,0.0723,0,0.2888,0.117,-0.0291,0.3584,0.2378,-0.0528,0.4049,0.3749,-0.0704,0.4515,0.4636,-0.0895,0.3013,0.423,-0.0735,0.3313,0.6295,-0.1026,0.3481,0.7552,-0.1172,0.3576,0.8597,-0.1263,0.2416,0.4463,-0.0725,0.2516,0.6811,-0.102,0.2582,0.8309,-0.1167,0.2622,0.9462,-0.1266,0.1881,0.4353,-0.071,0.1794,0.6465,-0.1006,0.1743,0.7851,-0.1196,0.1724,0.8862,-0.1304,0.141,0.4071,-0.0696,0.1203,0.574,-0.0943,0.1073,0.676,-0.1074,0.0961,0.7615,-0.1147] },
  { img: 'left_hands', w: 720, h: 382, label: 'Left', expect: 'none', facing: 'back', lm: [0.8193,0.0681,0,0.7186,0.12,-0.0205,0.6426,0.2256,-0.0296,0.593,0.3702,-0.0323,0.5502,0.4588,-0.0369,0.6971,0.4265,-0.0475,0.6628,0.6351,-0.059,0.6476,0.7621,-0.0656,0.636,0.8682,-0.0728,0.7571,0.4509,-0.0443,0.7479,0.6845,-0.0658,0.7453,0.8282,-0.0856,0.747,0.9332,-0.1016,0.8109,0.4418,-0.0384,0.8225,0.6522,-0.0621,0.8285,0.7865,-0.0834,0.8365,0.889,-0.0977,0.8576,0.414,-0.0315,0.8793,0.5803,-0.0557,0.8963,0.6822,-0.0711,0.9058,0.7754,-0.0797] },
  { img: 'left_hands', w: 720, h: 382, label: 'Left', expect: 'none', facing: 'back', lm: [0.174,0.9302,0,0.2771,0.8724,-0.0222,0.354,0.768,-0.0327,0.4071,0.6293,-0.0357,0.4508,0.5358,-0.0405,0.2997,0.5669,-0.0517,0.3371,0.3662,-0.0646,0.3516,0.2386,-0.0735,0.362,0.1317,-0.0821,0.24,0.5465,-0.0467,0.2491,0.315,-0.0752,0.2539,0.1717,-0.1019,0.2544,0.0642,-0.1224,0.1863,0.5601,-0.0374,0.1783,0.3523,-0.0643,0.1765,0.2237,-0.0852,0.1711,0.1269,-0.0984,0.1388,0.591,-0.0268,0.1205,0.427,-0.0481,0.109,0.3304,-0.059,0.1024,0.2419,-0.0644] },
  { img: 'right_hands_rotated', w: 382, h: 720, label: 'Right', expect: 'none', facing: 'back', lm: [0.0653,0.8112,0,0.1159,0.7128,-0.0479,0.2374,0.6427,-0.0897,0.3746,0.5964,-0.1216,0.4637,0.5514,-0.1558,0.4204,0.6979,-0.1332,0.6285,0.6661,-0.1873,0.757,0.6506,-0.2141,0.8624,0.6423,-0.2305,0.4456,0.7561,-0.1332,0.6827,0.7468,-0.1877,0.8312,0.7426,-0.2148,0.9446,0.7399,-0.2332,0.4365,0.8097,-0.1317,0.6488,0.8195,-0.1845,0.7848,0.8259,-0.2193,0.8838,0.8275,-0.2386,0.409,0.8576,-0.1296,0.5764,0.8813,-0.1718,0.6798,0.8949,-0.1953,0.767,0.9061,-0.2081] },
  { img: 'right_hands_rotated', w: 382, h: 720, label: 'Right', expect: 'none', facing: 'back', lm: [0.9358,0.1874,0,0.883,0.2851,-0.0439,0.7605,0.3555,-0.082,0.6247,0.4011,-0.1119,0.5336,0.4442,-0.1438,0.5696,0.3006,-0.12,0.3649,0.3307,-0.1729,0.2401,0.3469,-0.2011,0.1356,0.3566,-0.2191,0.5463,0.2438,-0.1229,0.3128,0.2509,-0.1749,0.1659,0.2551,-0.2027,0.0522,0.2587,-0.2222,0.5578,0.1908,-0.1252,0.3487,0.1805,-0.1764,0.2136,0.1734,-0.2117,0.1137,0.1712,-0.232,0.5875,0.1426,-0.1272,0.4221,0.1176,-0.1692,0.3204,0.1033,-0.1933,0.234,0.0917,-0.207] },
  { img: 'left_hands_rotated', w: 382, h: 720, label: 'Left', expect: 'none', facing: 'back', lm: [0.9361,0.8286,0,0.871,0.7192,-0.03,0.7652,0.6424,-0.0441,0.6254,0.5886,-0.0463,0.538,0.5447,-0.0526,0.5655,0.6968,-0.0834,0.3648,0.6628,-0.103,0.2397,0.6497,-0.1158,0.1329,0.639,-0.1294,0.5452,0.7568,-0.0762,0.3149,0.7504,-0.1255,0.1721,0.7451,-0.1729,0.0648,0.7436,-0.2099,0.5604,0.8106,-0.0601,0.3528,0.8218,-0.1053,0.2244,0.8237,-0.1422,0.1283,0.8288,-0.1659,0.5905,0.8592,-0.0407,0.4249,0.8787,-0.0744,0.327,0.8907,-0.0921,0.24,0.8972,-0.1009] },
  { img: 'left_hands_rotated', w: 382, h: 720, label: 'Left', expect: 'none', facing: 'back', lm: [0.0611,0.168,0,0.1206,0.2728,-0.0293,0.2239,0.3525,-0.0406,0.3649,0.4096,-0.0396,0.4599,0.4519,-0.0432,0.4327,0.3026,-0.0804,0.637,0.337,-0.0969,0.7629,0.349,-0.1086,0.8712,0.3587,-0.1215,0.4533,0.2427,-0.0718,0.6852,0.2478,-0.1156,0.8316,0.2509,-0.1617,0.943,0.2504,-0.1989,0.4415,0.1894,-0.0546,0.6522,0.1788,-0.0939,0.7835,0.1767,-0.1312,0.8795,0.1708,-0.1567,0.4141,0.1417,-0.0344,0.5807,0.1216,-0.064,0.6809,0.1088,-0.0827,0.7692,0.102,-0.0934] },
  { img: 'male_full_height_hands', w: 638, h: 1000, label: 'Left', expect: 'none', facing: 'back', lm: [0.6033,0.3975,0,0.5868,0.3789,-0.0072,0.5683,0.3655,-0.0124,0.5531,0.3552,-0.0173,0.5431,0.3457,-0.0225,0.531,0.3871,-0.011,0.4972,0.3867,-0.0167,0.4779,0.3863,-0.0216,0.4621,0.3866,-0.0256,0.5302,0.3999,-0.0122,0.4957,0.4024,-0.0165,0.4747,0.4036,-0.0212,0.4588,0.4051,-0.0257,0.5358,0.4108,-0.0138,0.5047,0.4152,-0.0179,0.4858,0.4172,-0.0217,0.4712,0.4189,-0.0255,0.5456,0.4196,-0.016,0.5242,0.4255,-0.0208,0.5103,0.4293,-0.023,0.4989,0.4323,-0.0246] },
  { img: 'male_full_height_hands', w: 638, h: 1000, label: 'Right', expect: 'open', facing: 'palm', lm: [0.2433,0.4976,0,0.219,0.4911,-0.0139,0.1943,0.4898,-0.0199,0.1746,0.4898,-0.0253,0.1586,0.4881,-0.0312,0.1907,0.5223,-0.0131,0.1705,0.5343,-0.0204,0.1591,0.5421,-0.0268,0.1499,0.5496,-0.0321,0.2035,0.5308,-0.0129,0.1868,0.5456,-0.0192,0.1774,0.5558,-0.0256,0.1712,0.5646,-0.031,0.2192,0.5347,-0.0142,0.2061,0.5498,-0.0214,0.1999,0.5597,-0.0277,0.1953,0.568,-0.0326,0.2366,0.5347,-0.0169,0.2364,0.5477,-0.0252,0.2372,0.5564,-0.0295,0.238,0.5639,-0.0324] },
];

function realIso(fx) {
  const ar = fx.w / fx.h;
  const P = [];
  for (let i = 0; i < 21; i++) P.push([(1 - fx.lm[i * 3]) * ar, fx.lm[i * 3 + 1], fx.lm[i * 3 + 2] * ar]);
  return P;
}

// ===========================================================================
console.log('filters');

test('OneEuro: constant input stays constant', () => {
  const f = new OneEuroFilter({ minCutoff: 1, beta: 5 });
  for (let i = 0; i < 100; i++) eq(f.filter(0.42, i / 30), 0.42);
});

test('OneEuro: removes jitter from a still hand (>= 2.5x less noise at 30 Hz)', () => {
  const f = new OneEuroFilter({ minCutoff: 1.0, beta: 6 });
  const r = rng(7);
  let si = 0, so = 0;
  for (let i = 0; i < 600; i++) {
    const n = gauss(r) * 0.004;
    const o = f.filter(0.5 + n, i / 30);
    if (i > 30) {
      si += n * n;
      so += (o - 0.5) ** 2;
    }
  }
  ok(Math.sqrt(si / so) > 2.5, `noise ratio ${Math.sqrt(si / so).toFixed(2)}`);
});

test('OneEuro: fast motion has low lag (beta adapts the cutoff)', () => {
  const lag = (beta) => {
    const f = new OneEuroFilter({ minCutoff: 1.0, beta });
    let last = 0;
    for (let i = 0; i < 30; i++) last = f.filter(i * 0.05, i / 30); // 1.5 units/s
    return 29 * 0.05 - last;
  };
  const slow = lag(0), fast = lag(6);
  ok(fast < slow * 0.35, `lag with beta ${fast.toFixed(3)} vs without ${slow.toFixed(3)}`);
  ok(fast < 0.04, `lag ${fast.toFixed(3)} (should be < ~1 frame of motion)`);
});

test('OneEuro: NaN, duplicate timestamps and long gaps are safe', () => {
  const f = new OneEuroFilter({ minCutoff: 1, beta: 1 });
  f.filter(1, 0);
  eq(f.filter(NaN, 0.03), 1);
  ok(Number.isFinite(f.filter(1.1, 0.03)), 'duplicate t');
  ok(Number.isFinite(f.filter(1.2, 0.01)), 'backwards t');
  eq(f.filter(5, 10), 5, 'long gap resets');
  const v = new OneEuroVec(3, { minCutoff: 1 });
  const out = v.filterInto([1, 2, 3], 0, [0, 0, 0]);
  eq(out.join(), '1,2,3');
});

test('RangeCalibrator: bigger palm = closer, adapts slowly, keeps a minimum range', () => {
  const c = new RangeCalibrator({ lo: 0.12, hi: 0.34, minRatio: 1.7, decay: 0.03 });
  const a = c.update(0.14, 0.03), b = c.update(0.2, 0.03), d = c.update(0.3, 0.03);
  ok(a < b && b < d, `monotonic ${a} ${b} ${d}`);
  eq(c.update(0.5, 0.03), 1, 'new max expands immediately');
  // user who only ever moves between 0.18 and 0.24 for two minutes
  for (let i = 0; i < 3600 * 2; i++) c.update(0.18 + 0.06 * (0.5 + 0.5 * Math.sin(i / 60)), 1 / 30);
  ok(c.map(0.24) > 0.75 && c.map(0.18) < 0.3, `adapted: ${c.map(0.18).toFixed(2)}..${c.map(0.24).toFixed(2)}`);
  ok(Math.exp(c.hi - c.lo) >= 1.7 - 1e-9, 'min ratio');
  ok(Number.isFinite(c.update(NaN, 0.03)) && Number.isFinite(c.update(0, 0.03)), 'bad input');
});

test('Hysteresis latches between thresholds', () => {
  const h = new Hysteresis(0.6, 0.4);
  eq([0.5, 0.7, 0.5, 0.45, 0.3, 0.5, 0.65].map((x) => h.update(x)).join(), 'false,true,true,true,false,false,true');
});

// ===========================================================================
console.log('features');

test('features are invariant to position and scale', () => {
  const a = classify(hand('victory', { size: 0.08, x: 0.2, y: 0.3 })).f;
  const b = classify(hand('victory', { size: 0.5, x: 1.1, y: 0.7 })).f;
  for (let i = 0; i < 5; i++) {
    near(a.curl[i], b.curl[i], 1e-9, `curl ${i}`);
    near(a.tips[i][0], b.tips[i][0], 1e-9, `tip x ${i}`);
    near(a.tips[i][1], b.tips[i][1], 1e-9, `tip y ${i}`);
  }
  near(a.spread, b.spread, 1e-9, 'spread');
  near(a.pinch, b.pinch, 1e-9, 'pinch');
  near(b.size / a.size, 0.5 / 0.08, 1e-6, 'size scales');
});

test('roll follows the on-screen tilt; hand-local tips do not', () => {
  const up = classify(hand('open')).f;
  for (const deg of [-70, -30, 0, 25, 60]) {
    const f = classify(hand('open', { roll: deg * DEG })).f;
    near(f.roll / DEG, deg + up.roll / DEG, 0.5, `roll ${deg}`);
    for (let i = 0; i < 5; i++) near(f.tips[i][1], up.tips[i][1], 1e-6, `tip ${i} y at roll ${deg}`);
  }
  ok(up.tips[2][1] < -1.2, `upright hand's middle tip points to -y (${up.tips[2][1].toFixed(2)})`);
});

test('facing: palm vs back, both hands, with hysteresis at edge-on', () => {
  for (const h of ['Right', 'Left']) {
    for (const yaw of [-50, 0, 50]) {
      eq(classify(hand('open', { hand: h, yaw: yaw * DEG }), h).f.facing, 'palm', `${h} yaw ${yaw}`);
      eq(classify(hand('open', { hand: h, yaw: yaw * DEG, back: true }), h).f.facing, 'back', `${h} back yaw ${yaw}`);
    }
  }
  const ff = new G.FacingFilter();
  const seq = [0.9, 0.3, 0.1, -0.1, 0.05, -0.15, -0.3, -0.1, 0.1, 0.25].map((x) => ff.update(x));
  eq(seq.join(), 'palm,palm,palm,palm,palm,palm,back,back,back,palm');
});

test('curl tracks finger bend for every finger and orientation', () => {
  for (const [roll, yaw, pitch] of [[0, 0, 0], [40, 30, 20], [-60, -35, -20]]) {
    let prev = null;
    for (const c of [0, 0.25, 0.5, 0.75, 1]) {
      const f = classify(hand({ curl: [c, c, c, c, c], spread: 0.5, thumbOut: 0.3 }, { roll: roll * DEG, yaw: yaw * DEG, pitch: pitch * DEG })).f;
      for (let i = 1; i < 5; i++) {
        if (prev) ok(f.curl[i] >= prev[i] - 0.02, `finger ${i} monotonic at ${c}: ${prev[i].toFixed(2)} -> ${f.curl[i].toFixed(2)}`);
        if (c === 0) ok(f.curl[i] < 0.15, `straight finger ${i}: ${f.curl[i].toFixed(2)}`);
        if (c === 1) ok(f.curl[i] > 0.85, `curled finger ${i}: ${f.curl[i].toFixed(2)}`);
      }
      if (c === 0) ok(f.curl[0] < 0.15, 'straight thumb');
      if (c === 1) ok(f.curl[0] > 0.8, 'curled thumb');
      prev = f.curl.slice();
    }
  }
});

test('bending fingers backward (Thai dance) does not read as curl', () => {
  const f = classify(hand({ curl: [0.2, -0.4, -0.4, -0.4, -0.4], spread: 0, thumbOut: -0.2 })).f;
  for (let i = 1; i < 5; i++) ok(f.curl[i] < 0.2, `finger ${i}: ${f.curl[i].toFixed(2)}`);
});

test('spread and pinch respond to their parameters', () => {
  let prev = -1;
  for (const s of [0, 0.25, 0.5, 0.75, 1]) {
    const f = classify(hand({ ...G.POSES.open, spread: s })).f;
    ok(f.spread > prev, `spread ${s}: ${f.spread.toFixed(2)}`);
    prev = f.spread;
  }
  ok(classify(hand('open', { override: { spread: 0 } })).f.spread < 0.1, 'fingers together');
  ok(classify(hand('jeeb')).f.pinch > 0.85, 'jeeb pinch');
  ok(classify(hand('open')).f.pinch < 0.05, 'open no pinch');
});

test('degenerate input never throws and yields none', () => {
  const bad = [null, [], G.synthHand().slice(0, 10), Array.from({ length: 21 }, () => [0, 0, 0]), Array.from({ length: 21 }, () => [NaN, 1, 1]), Array.from({ length: 21 }, () => null)];
  for (const P of bad) {
    const f = G.extractFeatures(P, 'Right');
    eq(f.valid, false);
    eq(G.classifyGesture(f).name, 'none');
  }
  eq(G.classifyGesture(null).name, 'none');
});

test('extractFeatures / classifyGesture reuse their output objects', () => {
  const out = G.createFeatures();
  const curl = out.curl, tips = out.tips;
  const r = G.extractFeatures(hand('fist'), 'Right', out);
  ok(r === out && out.curl === curl && out.tips === tips, 'same objects');
  const cls = { name: 'none', score: 0, scores: G.createScores() };
  ok(G.classifyGesture(out, cls) === cls, 'same result object');
});

// ===========================================================================
console.log('classifier');

// Rotations each gesture must survive (degrees): [roll, yaw, pitch]
const ROTS = [];
for (const roll of [-35, 0, 35]) for (const yaw of [-40, 0, 40]) for (const pitch of [-25, 0, 25]) ROTS.push([roll, yaw, pitch]);
const ROTS_THUMB = [];
for (const roll of [-20, 0, 20]) for (const yaw of [-40, 0, 40]) for (const pitch of [-20, 0, 20]) ROTS_THUMB.push([roll, yaw, pitch]);
const SIZES = [0.07, 0.2, 0.45];

function sweep(name, rots, extra = {}) {
  let n = 0;
  const bad = [];
  for (const h of ['Right', 'Left']) {
    for (const [roll, yaw, pitch] of rots) {
      for (const size of SIZES) {
        for (const zScale of [1, 0.45]) {
          const P = hand(name, { hand: h, roll: roll * DEG, yaw: yaw * DEG, pitch: pitch * DEG, size, zScale, prop: 0.12, noise: 0.012, seed: ++n, ...extra });
          const { r } = classify(P, h);
          if (r.name !== name) bad.push(`${h} r${roll} y${yaw} p${pitch} s${size} z${zScale} → ${r.name} (${name} ${r.scores[name].toFixed(2)})`);
        }
      }
    }
  }
  return { n, bad };
}

for (const name of G.GESTURES) {
  test(`${name}: recognised at ${name === 'thumbsUp' ? ROTS_THUMB.length : ROTS.length} rotations × ${SIZES.length} sizes × 2 hands × 2 depth scales (noisy)`, () => {
    const { n, bad } = sweep(name, name === 'thumbsUp' ? ROTS_THUMB : ROTS);
    ok(bad.length === 0, `${bad.length}/${n} misclassified, e.g.\n       ${bad.slice(0, 6).join('\n       ')}`);
  });
}

test('thumbsUp also works with the fist upright (thumb straight up beside the knuckles)', () => {
  for (const h of ['Right', 'Left']) {
    for (const roll of [-10, 0, 10]) {
      const { r } = classify(hand({ curl: [0.05, 1, 1, 1, 1], spread: 0.2, thumbOut: 0.1 }, { hand: h, roll: roll * DEG }), h);
      eq(r.name, 'thumbsUp', `${h} roll ${roll}`);
    }
  }
});

test('confusable pairs are separated', () => {
  const c = (pose, v) => classify(hand(pose, v), (v && v.hand) || 'Right').r;
  // point vs victory: the middle finger decides
  eq(c({ ...G.POSES.point, curl: [0.7, 0.02, 0.05, 1, 1] }).name, 'victory');
  eq(c({ ...G.POSES.victory, curl: [0.7, 0.02, 1, 1, 1] }).name, 'point');
  // open vs wong: splay + thumb
  eq(c({ ...G.POSES.open }).name, 'open');
  eq(c({ ...G.POSES.open, spread: 0, thumbOut: -0.3, curl: [0.5, 0, 0, 0, 0] }).name, 'wong');
  eq(c({ ...G.POSES.wong, spread: 1, thumbOut: 1, curl: [0.05, 0, 0, 0, 0] }).name, 'open');
  // moderately spread fingers + clearly-out thumb is still a block
  eq(c({ ...G.POSES.open, spread: 0.55 }).name, 'open');
  // jeeb vs open: the pinch decides
  eq(c({ ...G.POSES.jeeb, pinch: 0, curl: [0.05, 0.03, 0.02, 0.04, 0.06], thumbOut: 1 }).name, 'open');
  eq(c({ ...G.POSES.open, pinch: 1, curl: [0.3, 0.45, 0.02, 0.03, 0.05] }).name, 'jeeb');
  // horns vs point vs victory
  eq(c({ ...G.POSES.horns }).name, 'horns');
  eq(c({ ...G.POSES.horns, curl: [0.7, 0.03, 1, 1, 1] }).name, 'point');
  // fist vs thumbsUp: a thumb sticking out sideways/down is still a fist
  eq(c({ ...G.POSES.thumbsUp, roll: -40 * DEG }).name, 'fist', 'thumb sideways');
  eq(c({ ...G.POSES.thumbsUp, roll: 180 * DEG }).name, 'fist', 'thumbs down');
});

test('ambiguous poses give none', () => {
  const cases = {
    'relaxed half-curl': { ...G.POSES.relaxed },
    'claw (all half bent)': { curl: [0.4, 0.4, 0.4, 0.4, 0.4], spread: 0.6, thumbOut: 0.5 },
    'point with middle half bent': { ...G.POSES.point, curl: [0.7, 0.02, 0.5, 1, 1] },
    'horns with pinky half bent': { ...G.POSES.horns, curl: [0.7, 0.03, 1, 1, 0.5] },
    'victory with index half bent': { ...G.POSES.victory, curl: [0.7, 0.5, 0.02, 1, 1] },
    'flat hand, fingers together, thumb out': { curl: [0.05, 0, 0, 0, 0], spread: 0, thumbOut: 1 },
    'fingers splayed, thumb tucked': { curl: [0.5, 0, 0, 0, 0], spread: 1, thumbOut: -0.3 },
    'half pinch': { ...G.POSES.jeeb, pinch: 0.45 },
    'fist half open': { curl: [0.5, 0.45, 0.45, 0.45, 0.45], spread: 0.2, thumbOut: -0.3 },
  };
  for (const [k, pose] of Object.entries(cases)) {
    for (const h of ['Right', 'Left']) {
      const { r } = classify(hand(pose, { hand: h }), h);
      eq(r.name, 'none', `${k} (${h}): got ${r.name} ${r.score.toFixed(2)}`);
    }
  }
});

test('open palm shown from the back is not a block', () => {
  for (const h of ['Right', 'Left']) eq(classify(hand('open', { hand: h, back: true }), h).r.name, 'none', h);
});

test('wrong handedness from the model does not break curl-based gestures', () => {
  // If MediaPipe mislabels a hand, facing flips but fist/point/victory/horns survive.
  for (const name of ['fist', 'point', 'victory', 'horns']) eq(classify(hand(name), 'Left').r.name, name, name);
});

// ===========================================================================
console.log('real MediaPipe landmarks');

test(`all ${REAL.length} real detections classify as expected (gesture, facing)`, () => {
  for (const fx of REAL) {
    const { f, r } = classify(realIso(fx), fx.label);
    eq(r.name, fx.expect, `${fx.img} ${fx.label}:`);
    eq(f.facing, fx.facing, `${fx.img} ${fx.label} facing:`);
  }
});

test('real open hands (back view) read as straight fingers with the thumb out', () => {
  for (const fx of REAL.filter((x) => /hands/.test(x.img))) {
    const { f } = classify(realIso(fx), fx.label);
    for (let i = 1; i < 5; i++) ok(f.curl[i] < 0.2, `${fx.img} finger ${i} ${f.curl[i].toFixed(2)}`);
    ok(f.thumbOut > 0.8, `${fx.img} thumbOut ${f.thumbOut.toFixed(2)}`);
    ok(f.spread > 0.3, `${fx.img} spread ${f.spread.toFixed(2)}`);
  }
});

// ===========================================================================
console.log('stabiliser');

function feed(stab, seq, dt = 1 / 30) {
  // seq: [[name, seconds, score?], ...]
  const events = [];
  let t = stab._t || 0;
  for (const [name, dur, score = 0.9] of seq) {
    const steps = Math.round(dur / dt);
    for (let i = 0; i < steps; i++) {
      const scores = G.createScores();
      if (name !== 'none') scores[name] = score;
      const raw = { name: score >= 0.5 ? name : 'none', score: name === 'none' ? 0 : score, scores };
      const st = stab.update(raw, t);
      if (st.fresh) events.push([st.name, +t.toFixed(3)]);
      t += dt;
    }
  }
  stab._t = t;
  return events;
}

test('a gesture becomes stable after ~0.25 s and fires once', () => {
  const s = new G.GestureStabilizer();
  const ev = feed(s, [['fist', 0.2]]);
  eq(ev.length, 0, 'not before 0.25 s');
  eq(s.state.name, 'none');
  const ev2 = feed(s, [['fist', 1.0]]);
  eq(ev2.length, 1, 'exactly one fresh');
  near(ev2[0][1], 0.25, 0.04, 'fires at ~0.25 s');
  ok(s.state.held > 1.1 && s.state.held < 1.3, `held ${s.state.held}`);
  ok(s.state.confidence > 0.8, 'confidence');
});

test('brief dropouts do not re-fire; a real release does', () => {
  const s = new G.GestureStabilizer();
  let ev = feed(s, [['fist', 0.5], ['none', 0.1], ['fist', 0.5], ['point', 0.1], ['fist', 0.5]]);
  eq(ev.map((e) => e[0]).join(), 'fist', 'flicker ignored');
  ev = feed(s, [['none', 0.4], ['fist', 0.5]]);
  eq(ev.map((e) => e[0]).join(), 'fist', 'fires again after release');
  ev = feed(s, [['point', 0.5]]);
  eq(ev.map((e) => e[0]).join(), 'point', 'switching fires the new gesture');
});

test('hysteresis: a held gesture survives a dip in score', () => {
  const s = new G.GestureStabilizer();
  feed(s, [['fist', 0.5]]);
  const ev = feed(s, [['fist', 1.0, 0.4]]); // raw says none (score < 0.5) but still fist-like
  eq(ev.length, 0);
  eq(s.state.name, 'fist');
  feed(s, [['fist', 0.5, 0.1]]);
  eq(s.state.name, 'none', 'released once the score really drops');
});

test('rapidly alternating raw labels do not spam fresh events', () => {
  const s = new G.GestureStabilizer();
  const seq = [];
  for (let i = 0; i < 60; i++) seq.push([i % 2 ? 'fist' : 'point', 1 / 30]);
  const ev = feed(s, seq);
  ok(ev.length <= 1, `${ev.length} events`);
});

// ===========================================================================
console.log('two hands');

function waiPair(v = {}) {
  const s = v.size || 0.2;
  const pose = v.pose || { curl: [0.1, 0.03, 0.03, 0.03, 0.03], spread: 0.05, thumbOut: 0 };
  const cx = v.cx ?? 0.66, gap = v.gap ?? 0.07;
  const R = G.synthHand({ ...pose, handedness: 'Right', yaw: 83 * DEG, roll: (v.roll || 0) * DEG, size: s, x: cx + gap * s, y: 0.5 });
  const L = G.synthHand({ ...pose, handedness: 'Left', yaw: -83 * DEG, roll: -(v.roll || 0) * DEG, size: s, x: cx - gap * s, y: 0.5 });
  return [G.extractFeatures(R, 'Right'), G.extractFeatures(L, 'Left'), R, L];
}

test('wai: palms together, upright → wai after 0.3 s, waiFresh once', () => {
  const d = new G.TwoHandDetector();
  const [a, b] = waiPair();
  ok(G.TwoHandDetector.waiScore(a, b) > 0.8, `score ${G.TwoHandDetector.waiScore(a, b)}`);
  let fresh = 0, firstOn = -1;
  for (let i = 0; i < 40; i++) {
    const st = d.update(a, b, i / 30);
    if (st.waiFresh) fresh++;
    if (st.wai && firstOn < 0) firstOn = i / 30;
  }
  eq(fresh, 1);
  near(firstOn, 0.3, 0.04);
  // a briefly lost hand keeps the wai
  ok(d.update(a, b, 40 / 30, true).wai, 'lost hand keeps wai');
  // apart → released after ~0.2 s
  const [c, e] = waiPair({ gap: 3 });
  for (let i = 41; i < 60; i++) d.update(c, e, i / 30);
  eq(d.state.wai, false);
});

test('not a wai: hands apart, fists together, hands tilted, one hand', () => {
  const s = (v) => G.TwoHandDetector.waiScore(...waiPair(v).slice(0, 2));
  ok(s({ gap: 2.5 }) < 0.3, 'apart');
  ok(s({ pose: G.POSES.fist }) < 0.3, 'fists');
  ok(s({ roll: 75 }) < 0.3, 'tilted');
  ok(G.TwoHandDetector.waiScore(waiPair()[0], null) === 0, 'one hand');
});

test('clap: fast collision fires once; slow approach does not', () => {
  const run = (seconds) => {
    const d = new G.TwoHandDetector();
    let claps = 0;
    const steps = Math.round(seconds * 30) + 15;
    for (let i = 0; i <= steps; i++) {
      const k = Math.min(1, i / (seconds * 30));
      const gap = 3.2 * (1 - k) + 0.3 * k;
      const [a, b] = waiPair({ gap, pose: G.POSES.open });
      if (d.update(a, b, i / 30).clap) claps++;
    }
    return claps;
  };
  eq(run(0.15), 1, 'fast');
  eq(run(2.0), 0, 'slow');
});

// ===========================================================================
console.log('tracker pipeline (node, no camera)');

function runTracker(tr, seconds, fn, fps = 60, t0 = 0) {
  for (let i = 0; i < seconds * fps; i++) {
    const now = t0 + (i * 1000) / fps;
    tr.update(now);
    if (fn) fn(now, tr);
  }
}

test('demo mode: every gesture and the wai fire, slots never swap, update never throws', () => {
  const tr = new HandTracker();
  tr.startSynthetic();
  eq(tr.status, 'running');
  const fired = { Right: new Set(), Left: new Set() };
  let wai = 0, maxHands = 0;
  const idHand = {};
  const cycle = DEMO_SEQ.length * DEMO_SEGMENT;
  runTracker(tr, cycle + 1, (now, t) => {
    maxHands = Math.max(maxHands, t.hands.length);
    for (const h of t.hands) {
      if (idHand[h.id] && idHand[h.id] !== h.handedness) throw new Error(`slot ${h.id} changed hands`);
      idHand[h.id] = h.handedness;
      if (h.gesture.fresh) fired[h.handedness].add(h.gesture.name);
    }
    if (t.twoHands.waiFresh) wai++;
  });
  eq(maxHands, 2);
  for (const [i, hnd] of [[0, 'Right'], [1, 'Left']]) {
    const want = new Set(DEMO_SEQ.map((p) => p[i]).filter((g) => G.GESTURES.includes(g)));
    for (const g of want) ok(fired[hnd].has(g), `${hnd} never fired ${g} (fired: ${[...fired[hnd]].join(',')})`);
  }
  ok(wai >= 1, 'wai fired');
  eq(tr._updateErrors, 0, 'update errors');
  tr.stop();
  eq(tr.status, 'idle');
  eq(tr.hands.length, 0);
});

test('real MediaPipe results through ingest(): mirrored, handedness, gesture after hold', () => {
  for (const fx of REAL) {
    const tr = new HandTracker();
    const res = { landmarks: [[]], handedness: [[{ categoryName: fx.label, score: 0.95 }]] };
    for (let i = 0; i < 21; i++) res.landmarks[0].push({ x: fx.lm[i * 3], y: fx.lm[i * 3 + 1], z: fx.lm[i * 3 + 2] });
    for (let k = 0; k < 20; k++) tr.ingest(res, 1000 + k * 33, fx.w / fx.h);
    eq(tr.hands.length, 1, fx.img);
    const h = tr.hands[0];
    eq(h.handedness, fx.label, `${fx.img} handedness`);
    eq(h.gesture.name, fx.expect, `${fx.img} gesture`);
    eq(h.facing, fx.facing, `${fx.img} facing`);
    near(h.palm.x, 1 - (fx.lm[0] + fx.lm[15] + fx.lm[27] + fx.lm[39] + fx.lm[51]) / 5, 1e-6, `${fx.img} mirrored palm.x`);
    ok(h.landmarks.length === 21 && h.tips.length === 5 && h.curl.length === 5, 'shape');
  }
});

test('a hand lost for < 300 ms keeps its slot (lost=true); longer frees it', () => {
  const tr = new HandTracker();
  const R = hand('open', { hand: 'Right', x: 0.95 }), L = hand('fist', { hand: 'Left', x: 0.4 });
  const both = toResult([{ P: R, hand: 'Right' }, { P: L, hand: 'Left' }]);
  const onlyR = toResult([{ P: R, hand: 'Right' }]);
  let t = 0;
  const step = (res) => {
    tr.ingest(res, t);
    tr.update(t);
    t += 33;
  };
  for (let i = 0; i < 15; i++) step(both);
  const idL = tr.hands.find((h) => h.handedness === 'Left').id;
  for (let i = 0; i < 6; i++) step(onlyR); // ~200 ms
  let l = tr.hands.find((h) => h.id === idL);
  ok(l && l.lost, 'left hand remembered as lost');
  eq(l.gesture.name, 'fist', 'gesture kept while lost');
  for (let i = 0; i < 6; i++) step(both);
  l = tr.hands.find((h) => h.id === idL);
  ok(l && !l.lost && l.handedness === 'Left', 'same slot when it returns');
  for (let i = 0; i < 12; i++) step(onlyR); // ~400 ms
  eq(tr.hands.length, 1, 'freed after 300 ms');
  eq(tr.hands[0].handedness, 'Right');
});

test('hands keep their ids while crossing over', () => {
  const tr = new HandTracker();
  let t = 0;
  const ids = {};
  for (let i = 0; i <= 60; i++) {
    const k = i / 60;
    const xr = 0.95 - 0.5 * k, xl = 0.4 + 0.5 * k; // they pass each other
    const res = toResult([{ P: hand('open', { hand: 'Right', x: xr, y: 0.45 }), hand: 'Right' }, { P: hand('point', { hand: 'Left', x: xl, y: 0.6 }), hand: 'Left' }]);
    // MediaPipe's output order is arbitrary: flip it every other frame
    if (i % 2) {
      res.landmarks.reverse();
      res.handedness.reverse();
    }
    tr.ingest(res, t);
    t += 33;
    for (const h of tr.hands) {
      if (ids[h.handedness] != null && ids[h.handedness] !== h.id) throw new Error(`${h.handedness} moved from slot ${ids[h.handedness]} to ${h.id} at frame ${i}`);
      ids[h.handedness] = h.id;
    }
  }
  eq(tr.hands.length, 2);
});

test('garbage results never throw', () => {
  const tr = new HandTracker();
  const P = hand('fist');
  const good = toResult([{ P, hand: 'Right' }]);
  const nan = toResult([{ P, hand: 'Right' }]);
  nan.landmarks[0][5].x = NaN;
  const inputs = [
    null, undefined, {}, { landmarks: null }, { landmarks: [[]] }, { landmarks: [null] },
    { landmarks: [good.landmarks[0].slice(0, 5)] }, nan,
    { landmarks: good.landmarks }, // no handedness
    { landmarks: [good.landmarks[0], good.landmarks[0], good.landmarks[0]], handedness: [] }, // 3 hands, duplicates
    { landmarks: [good.landmarks[0].map(() => ({}))], handedness: [[{}]] },
  ];
  let t = 0;
  for (let round = 0; round < 3; round++) {
    for (const r of inputs) {
      tr.ingest(r, (t += 33));
      tr.update(t);
      ok(tr.hands.length <= 2);
    }
  }
  tr.update(NaN);
  tr.update(undefined);
  tr.ingest(good, (t += 33));
  ok(tr.hands.length === 1 && Number.isFinite(tr.hands[0].palm.x), 'recovers');
  eq(tr._updateErrors, 0);
});

test('one-shot flags last one update even without a new detection', () => {
  const tr = new HandTracker();
  const res = toResult([{ P: hand('victory'), hand: 'Right' }]);
  let t = 0, seen = 0;
  for (let i = 0; i < 20; i++) {
    tr.update(t);
    tr.ingest(res, t);
    if (tr.hands[0].gesture.fresh) {
      seen++;
      tr.update(t + 8); // next animation frame, no detection
      eq(tr.hands[0].gesture.fresh, false);
    }
    t += 33;
  }
  eq(seen, 1);
});

test('depth rises as the hand comes closer; swapHandedness option', () => {
  const tr = new HandTracker();
  let t = 0, d0 = 0, d1 = 0;
  for (let i = 0; i < 30; i++) {
    tr.ingest(toResult([{ P: hand('open', { size: 0.12 }), hand: 'Right' }]), (t += 33));
    d0 = tr.hands[0].depth;
  }
  for (let i = 0; i < 30; i++) {
    tr.ingest(toResult([{ P: hand('open', { size: 0.3 }), hand: 'Right' }]), (t += 33));
    d1 = tr.hands[0].depth;
  }
  ok(d1 > d0 + 0.4, `depth ${d0.toFixed(2)} → ${d1.toFixed(2)}`);
  const sw = new HandTracker({ swapHandedness: true });
  sw.ingest(toResult([{ P: hand('open', { hand: 'Left' }), hand: 'Right' }]), 0);
  eq(sw.hands[0].handedness, 'Left');
});

test('no memory growth per frame (20k frames)', () => {
  v8.setFlagsFromString('--expose-gc');
  const gc = vm.runInNewContext('gc');
  const tr = new HandTracker();
  tr.startSynthetic();
  runTracker(tr, 20, null); // warm up
  gc();
  const before = process.memoryUsage().heapUsed;
  runTracker(tr, 333, null, 60, 20000); // 20k updates, ~10k detections
  gc();
  const grew = process.memoryUsage().heapUsed - before;
  ok(grew < 1.5e6, `heap grew ${(grew / 1e6).toFixed(2)} MB`);
});

test('drawPreview on a stub context does not throw', () => {
  const tr = new HandTracker();
  tr.startSynthetic();
  runTracker(tr, 1, null);
  const calls = [];
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => grad : (...a) => calls.push(k)),
    set: (o, k, v) => ((o[k] = v), true),
  });
  tr.drawPreview(ctx, 10, 10, 240, 180);
  ok(calls.includes('stroke') && calls.includes('arc'), 'drew something');
  tr.drawPreview(null, 0, 0, 10, 10);
  tr.drawPreview(ctx, 0, 0, 0, 0);
});

// async tests
const asyncTests = [
  ['start() without a browser rejects with a friendly bilingual error', async () => {
    const tr = new HandTracker();
    let err = null;
    try {
      await tr.start();
    } catch (e) {
      err = e;
    }
    ok(err, 'rejected');
    ok(/[฀-๿]/.test(err.userMessage) && /[A-Za-z]{4}/.test(err.userMessage), `bilingual: ${err.userMessage}`);
    eq(err.code, 'unsupported');
    eq(tr.status, 'error');
    eq(tr.running, false);
  }],
];

for (const [name, fn] of asyncTests) {
  try {
    await fn();
    passed++;
    if (VERBOSE) console.log(`  ok  ${name}`);
  } catch (e) {
    failures.push([name, e]);
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
