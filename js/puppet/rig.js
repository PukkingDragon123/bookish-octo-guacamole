// Rig definition format shared by every articulated figure (puppets,
// animals, articulated props) plus forward kinematics for the neutral
// pose (used for thumbnails, previews and spawning).
//
// A rig is:
// {
//   id, name (Thai), en (English), kind: 'hero'|'heroine'|'demon'|'hermit'|
//        'monkey'|'comic'|'villager'|'god'|'animal'|'monster',
//   root: 'torso',                         // root part id
//   parts: {
//     torso: { sprite, z: 0 },
//     head:  { sprite, z: 3, parent: 'torso',
//              at: [x, y],       // point on the PARENT (parent box coords)
//              pivot: [x, y],    // point on THIS part (own box coords)
//              rot: 0,           // rest rotation relative to parent (rad, +cw)
//              lim: [-0.3, 0.3], // joint limits relative to rest, or null = free
//              stiff: 0.5,       // 0..1 how strongly the joint holds its rest pose
//              mass: 1 },        // optional mass multiplier
//     ...
//   },
//   rod: { part: 'torso', a: [x, y], b: [x, y], extend: 150 }, // main rod (ไม้ตับ)
//   handRods: { handF: [x, y], handB: [x, y] },                 // hand rods (ไม้มือ)
//   grips: { handF: [x, y], handB: [x, y] },                    // where held props sit
//   holds: { handF: 'sword' },                                  // default held props
//   limbs: { armF: [...ids], armB: [...], legF: [...], legB: [...],
//            head: 'head', torso: 'torso', pelvis: 'skirt', jaw: 'jaw' },
// }
//
// Box coordinates are world units relative to the top-left of the box the
// sprite was painted in (Sprite.local() converts them to sprite space).
// z: draw order; far-side limbs negative, near-side limbs positive.

// 2D affine [a, b, c, d, e, f] as in DOMMatrix / canvas setTransform.
export const M = {
  ident: () => [1, 0, 0, 1, 0, 0],
  mul(m, n) {
    return [
      m[0] * n[0] + m[2] * n[1],
      m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3],
      m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4],
      m[1] * n[4] + m[3] * n[5] + m[5],
    ];
  },
  tr: (x, y) => [1, 0, 0, 1, x, y],
  rot: (a) => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0],
  scale: (sx, sy = sx) => [sx, 0, 0, sy, 0, 0],
  apply: (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]],
  angle: (m) => Math.atan2(m[1], m[0]),
};

export function partOrder(rig) {
  // parents before children
  const out = [];
  const seen = new Set();
  const visit = (id) => {
    if (seen.has(id)) return;
    const p = rig.parts[id];
    if (p.parent) visit(p.parent);
    seen.add(id);
    out.push(id);
  };
  Object.keys(rig.parts).forEach(visit);
  return out;
}

// Neutral-pose transforms: returns { id: matrix } mapping sprite-local
// coordinates to rig space (root pivot at the origin unless given).
export function assemble(rig, rootMatrix = M.ident(), angles = {}) {
  const T = {};
  for (const id of partOrder(rig)) {
    const p = rig.parts[id];
    const s = p.sprite;
    if (!p.parent) {
      T[id] = M.mul(rootMatrix, M.rot(angles[id] || 0));
      continue;
    }
    const par = rig.parts[p.parent];
    const at = par.sprite.local(p.at);
    const pv = s.local(p.pivot);
    T[id] = M.mul(T[p.parent], M.mul(M.tr(at[0], at[1]), M.mul(M.rot((p.rot || 0) + (angles[id] || 0)), M.tr(-pv[0], -pv[1]))));
  }
  return T;
}

// Axis-aligned bounds of the assembled rig in rig space.
export function rigBounds(rig, T = assemble(rig)) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const id in rig.parts) {
    const s = rig.parts[id].sprite;
    for (const c of [[0, 0], [s.w, 0], [0, s.h], [s.w, s.h]]) {
      const [x, y] = M.apply(T[id], c);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

export function drawRig(ctx, rig, T = assemble(rig)) {
  const ids = Object.keys(rig.parts).sort((a, b) => (rig.parts[a].z || 0) - (rig.parts[b].z || 0));
  for (const id of ids) {
    const s = rig.parts[id].sprite;
    const m = T[id];
    ctx.save();
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.drawImage(s.canvas, 0, 0, s.w, s.h);
    ctx.restore();
  }
}

// Main rod line endpoints in rig space.
export function rodLine(rig, T = assemble(rig)) {
  if (!rig.rod) return null;
  const p = rig.parts[rig.rod.part];
  const a = M.apply(T[rig.rod.part], p.sprite.local(rig.rod.a));
  const b = M.apply(T[rig.rod.part], p.sprite.local(rig.rod.b));
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const e = rig.rod.extend ?? 150;
  return [a, [b[0] + ((b[0] - a[0]) / L) * e, b[1] + ((b[1] - a[1]) / L) * e]];
}
