// Puppets cut from the uploaded part sheets: ฤๅษี (hermit) and นาง
// (princess). Coordinates below are pixels in the original sheet images;
// they're scaled into world units when the rig is built.

import { loadSheet } from '../../art/sheet.js';

const DEG = Math.PI / 180;

// Build a rig from sheet-space joint descriptions.
//  aim: desired world angle (deg, 90 = straight down) of the part axis
//       [from, to] in the neutral pose. Parts without aim keep their sheet
//       orientation relative to the parent.
function sheetRig(spec, sprites, s) {
  const S = (p) => [p[0] * s, p[1] * s];
  const world = {}; // absolute neutral rotation per part
  const parts = {};
  const order = Object.keys(spec.parts);
  for (const id of order) {
    const d = spec.parts[id];
    const sprite = sprites[d.img || id];
    const axisAng = d.axis ? Math.atan2(d.axis[1][1] - d.axis[0][1], d.axis[1][0] - d.axis[0][0]) : 0;
    const R = d.aim != null ? d.aim * DEG - axisAng : (d.parent ? world[d.parent] : 0);
    world[id] = R;
    parts[id] = {
      sprite,
      z: d.z,
      mass: d.mass,
      stiff: d.stiff,
      ...(d.parent
        ? {
            parent: d.parent,
            at: S(d.at),
            pivot: S(d.pivot),
            rot: R - world[d.parent],
            lim: d.lim ? [d.lim[0] * DEG, d.lim[1] * DEG] : null,
          }
        : {}),
    };
  }
  const conv = (o) => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, S(v)])) : undefined);
  return {
    ...spec.meta,
    root: order[0],
    parts,
    rod: spec.rod && { part: spec.rod.part, a: S(spec.rod.a), b: S(spec.rod.b), extend: spec.rod.extend },
    handRods: conv(spec.handRods),
    grips: conv(spec.grips),
    holds: spec.holds,
    limbs: spec.limbs,
    hands: spec.hands && Object.fromEntries(Object.entries(spec.hands).map(([k, v]) => [k, { ...v, pivot: S(v.pivot), sprite: sprites[v.img] }])),
  };
}

const REUSI = {
  meta: { id: 'reusi', name: 'ฤๅษี', en: 'Ruesi — the Hermit', kind: 'hermit', voice: 'old', height: 430 },
  parts: {
    torso: { z: 0, mass: 1.4 },
    head: { z: 2, parent: 'torso', at: [499, 229], pivot: [499, 190], lim: [-22, 22], stiff: 0.7 },
    skirt: { z: 1, parent: 'torso', at: [498, 466], pivot: [498, 538], lim: [-14, 14], stiff: 0.75, mass: 1.2 },
    upperArmB: { z: -8, parent: 'torso', at: [401, 241], pivot: [347, 207], axis: [[347, 207], [258, 312]], aim: 98, stiff: 0.12 },
    forearmB: { z: -7, parent: 'upperArmB', at: [258, 313], pivot: [247, 347], axis: [[247, 347], [167, 463]], aim: 84, lim: [-150, 12], stiff: 0.18 },
    handB: { z: -9, parent: 'forearmB', at: [167, 463], pivot: [148, 478], lim: [-55, 55], stiff: 0.3 },
    thighB: { z: -6, parent: 'skirt', at: [434, 572], pivot: [326, 506], axis: [[326, 506], [262, 678]], aim: 100, lim: [-75, 75], stiff: 0.45 },
    shinB: { z: -7, parent: 'thighB', at: [262, 678], pivot: [285, 718], axis: [[285, 718], [275, 905]], aim: 92, lim: [-8, 125], stiff: 0.5 },
    thighF: { z: -4, parent: 'skirt', at: [579, 561], pivot: [682, 505], axis: [[682, 505], [747, 675]], aim: 80, lim: [-75, 75], stiff: 0.45 },
    shinF: { z: -5, parent: 'thighF', at: [747, 675], pivot: [730, 715], axis: [[730, 715], [745, 905]], aim: 89, lim: [-8, 125], stiff: 0.5 },
    upperArmF: { z: 3, parent: 'torso', at: [585, 245], pivot: [652, 206], axis: [[652, 206], [732, 315]], aim: 84, stiff: 0.12 },
    forearmF: { z: 5, parent: 'upperArmF', at: [732, 315], pivot: [737, 352], axis: [[737, 352], [803, 476]], aim: 70, lim: [-150, 12], stiff: 0.18 },
    handF: { z: 4, parent: 'forearmF', at: [803, 476], pivot: [822, 489], lim: [-55, 55], stiff: 0.3 },
  },
  rod: { part: 'torso', a: [499, 212], b: [498, 470], extend: 300 },
  handRods: { handF: [858, 506], handB: [110, 505] },
  grips: { handF: [852, 500], handB: [112, 500] },
  holds: { handF: 'reusi-cane' },
  limbs: {
    torso: 'torso', head: 'head', pelvis: 'skirt',
    armF: ['upperArmF', 'forearmF', 'handF'], armB: ['upperArmB', 'forearmB', 'handB'],
    legF: ['thighF', 'shinF'], legB: ['thighB', 'shinB'],
  },
};

const NANG = {
  meta: { id: 'nang', name: 'นางเอก', en: 'Nang — the Princess', kind: 'heroine', voice: 'female', height: 420 },
  parts: {
    torso: { z: 0, mass: 1.2 },
    head: { z: 3, parent: 'torso', at: [499, 293], pivot: [479, 256], lim: [-22, 22], stiff: 0.7 },
    skirt: { z: 1, parent: 'torso', at: [500, 455], pivot: [500, 472], lim: [-14, 14], stiff: 0.75, mass: 1.3 },
    upperArmB: { z: -8, parent: 'torso', at: [418, 298], pivot: [328, 243], axis: [[328, 243], [262, 332]], aim: 104, stiff: 0.14 },
    forearmB: { z: -7, parent: 'upperArmB', at: [262, 332], pivot: [243, 355], axis: [[243, 355], [150, 360]], aim: 150, lim: [-150, 20], stiff: 0.2 },
    thighB: { z: -6, parent: 'skirt', at: [445, 482], pivot: [341, 375], axis: [[341, 375], [233, 494]], aim: 116, lim: [-70, 70], stiff: 0.5 },
    shinB: { z: -7, parent: 'thighB', at: [233, 494], pivot: [241, 524], axis: [[241, 524], [240, 690]], aim: 90, lim: [-10, 125], stiff: 0.5 },
    thighF: { z: -4, parent: 'skirt', at: [555, 482], pivot: [659, 375], axis: [[659, 375], [765, 496]], aim: 64, lim: [-70, 70], stiff: 0.5 },
    shinF: { z: -5, parent: 'thighF', at: [765, 496], pivot: [763, 525], axis: [[763, 525], [763, 690]], aim: 90, lim: [-10, 125], stiff: 0.5 },
    upperArmF: { z: 4, parent: 'torso', at: [582, 298], pivot: [681, 240], axis: [[681, 240], [746, 329]], aim: 78, stiff: 0.14 },
    forearmF: { z: 6, parent: 'upperArmF', at: [746, 329], pivot: [762, 355], axis: [[762, 355], [848, 390]], aim: 40, lim: [-150, 20], stiff: 0.2 },
    handF: { z: 5, parent: 'forearmF', at: [846, 390], pivot: [852, 390], lim: [-60, 60], stiff: 0.3 },
  },
  // Alternate hand sprites (the four spare hands on the sheet) that dance
  // poses swap in for handF.
  hands: {
    jeeb: { img: 'handJeeb', pivot: [942, 288] },
    wong: { img: 'handWong', pivot: [969, 352] },
    point: { img: 'handPoint', pivot: [972, 419] },
    cup: { img: 'handCup', pivot: [991, 517] },
  },
  rod: { part: 'torso', a: [500, 285], b: [500, 455], extend: 330 },
  handRods: { handF: [900, 385], handB: [95, 345] },
  grips: { handF: [905, 380], handB: [90, 350] },
  limbs: {
    torso: 'torso', head: 'head', pelvis: 'skirt',
    armF: ['upperArmF', 'forearmF', 'handF'], armB: ['upperArmB', 'forearmB'],
    legF: ['thighF', 'shinF'], legB: ['thighB', 'shinB'],
  },
};

const BASE = new URL('../../../assets/puppets/', import.meta.url).href;

export async function loadSheetPuppets() {
  const [r, n] = await Promise.all([loadSheet(BASE + 'reusi', 0.47), loadSheet(BASE + 'nang', 0.56)]);
  const reusi = sheetRig(REUSI, r, 0.47);
  const nang = sheetRig(NANG, n, 0.56);
  // Props that come on the sheets.
  const props = [
    { id: 'reusi-cane', name: 'ไม้เท้าฤๅษี', en: "Hermit's staff", cat: 'weapons', sprite: r.cane, grip: [1068 * 0.47, 185 * 0.47], upright: true, weapon: { kind: 'blunt', a: [1075 * 0.47, 90 * 0.47], b: [1082 * 0.47, 890 * 0.47] } },
    { id: 'reusi-pot', name: 'หม้อน้ำมนต์', en: 'Holy-water pot', cat: 'household', sprite: r.pot, grip: [928 * 0.47, 240 * 0.47] },
    { id: 'nang-fan', name: 'พัดนาง', en: "Princess's fan", cat: 'household', sprite: n.fan, grip: [1000 * 0.56, 700 * 0.56] },
  ];
  return { puppets: [reusi, nang], props };
}
