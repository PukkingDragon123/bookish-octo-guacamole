# Adding puppets and props

Everything on the shadow screen is **cut leather**: a canvas sprite where

- **alpha** is the silhouette of the hide,
- **RGB** is how much lamp light gets *through* it. Near-black leather blocks
  the lamp, translucent dyes glow in their colour, and punched perforations
  (alpha 0) show up as bright specks of lamp light, just like real ฉลุลาย.

In game, a figure pressed against the cloth shows its full colour and
perforations. Pulled back toward the lamp it gets bigger and blurrier and
turns into a soft grey shadow. A silhouette has to read in both states.

## Units

World units. The screen is 1600 × 1000 and a standing adult puppet is about
420 tall. `paintSprite(w, h, draw)` gives you a canvas at `PX = 2` pixels per
unit, so you draw in world units directly. Keep a sprite under ~1600 px on
its longest side (pass `{ px: 1.5 }` or `{ px: 1 }` for very large scenery),
and keep each `build()` quick, under ~50 ms.

Rough sizes: โอ่ง jar 110 tall · sword 170 long · market stall 300 × 260 ·
Thai house 520 × 480 · coconut palm 700 tall · buffalo 300 long · rooster
70 · elephant 450 × 380 · rowing boat 420 long · child puppet 280.

## Toolkit (`js/art/leather.js`)

`leather(ctx, pts|path)` base hide · `dye(ctx, path, colour, alpha)`
translucent colour on the hide only · `line/gold(ctx, pts, width)` painted
lines · `hole/holes/dotLine/dotFill/slit/cut` perforations ·
`curve/smooth/poly/blobPts/ellipsePts/inset/resample` geometry ·
motifs: `dotFlower`, `prajamYam` (ประจำยาม), `krajangPath/krajangRow`
(กระจัง), `kanokPts` (กนก), `lotusRow`, `plaid`, `band`, `eye`, `limb`,
`rivet`. Palette: `INK`.

## Module formats

Props (`js/props/*.js`):

```js
export const PROPS = [{
  id: 'ong-dragon', name: 'โอ่งมังกร', en: 'Dragon water jar', cat: 'household',
  build() {
    return {
      sprite,                 // OR an articulated rig: { root, parts, gait, kind }
      grip: [x, y],           // optional: where a puppet's hand holds it (box coords)
      holdAngle: 0,           // rotation relative to the hand when held
      weapon: { kind: 'blade' | 'point' | 'blunt', a: [x, y], b: [x, y] },
      sound: 'ranat',         // instruments: plays when struck / clicked
      glow: [x, y, radius],   // light sources (lanterns, fire)
      static: true,           // big scenery that stays where placed
      float: true,            // boats bob instead of resting on the floor
      mass: 1,                // density multiplier
    };
  },
}];
```

Categories: `market food household weapons instruments animals buildings
boats nature vehicles monsters`.

Puppets (`js/puppet/characters/*.js`): `export const PUPPETS = [{ id, name,
en, kind, build() { return rig } }]`, with the rig format documented at the
top of `js/puppet/rig.js`. Figures face **right** (+x). `F` limbs are on the
near side (z > 0, drawn over the torso) and `B` limbs on the far side
(z < 0). Draw the neutral pose standing with arms hanging, so most `rot`
values stay 0.

## Previewing

```
node tools/shot.mjs "tools/preview.html?m=js/props/food.js&size=300&debug=1" out.png 1400 900 12000 --full
```

The left panel of each cell is the back-lit (in-game) look and the right
panel is front-lit. `debug=1` marks joints (magenta), grips/rod points
(green) and weapon edges (red).
