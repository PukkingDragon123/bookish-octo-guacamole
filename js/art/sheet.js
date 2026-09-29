// Loads parts sliced from an uploaded puppet sheet (tools/slice_sheet.py)
// as Sprites. Rig coordinates for sheet puppets are authored in the
// original sheet's pixel space, multiplied by `scale` (world units per
// sheet pixel); each Sprite's ox/oy maps them into its own crop.

import { Sprite, makeCanvas } from './leather.js';

const cache = new Map();

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('failed to load ' + src));
    im.src = src;
  });
}

export async function loadSheet(dir, scale) {
  const key = dir + '@' + scale;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const meta = await (await fetch(dir + '/parts.json')).json();
    const out = {};
    await Promise.all(Object.entries(meta.parts).map(async ([name, [x, y]]) => {
      const im = await loadImage(`${dir}/${name}.png`);
      const c = makeCanvas(im.naturalWidth, im.naturalHeight);
      c.getContext('2d').drawImage(im, 0, 0);
      out[name] = new Sprite(c, scale, { ox: -x * scale, oy: -y * scale, name: `${dir}/${name}` });
    }));
    return out;
  })();
  cache.set(key, p);
  return p;
}
