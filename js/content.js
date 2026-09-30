// Loads every puppet and prop module, tolerating any that fail, and
// builds their sprites (drawing is cheap enough to do up front, spread
// over animation frames so the loading screen stays alive).

import { loadSheetPuppets } from './puppet/characters/sheetPuppets.js';

const PUPPET_MODULES = ['./puppet/characters/classical.js', './puppet/characters/comic.js'];
const PROP_MODULES = ['weapons', 'food', 'market', 'household', 'instruments', 'animals', 'monsters', 'buildings', 'boats', 'nature', 'vehicles'].map((n) => `./props/${n}.js`);

export const CATEGORIES = [
  ['puppets', 'ตัวหนัง', 'Puppets'],
  ['weapons', 'อาวุธ', 'Weapons'],
  ['market', 'ตลาด', 'Market'],
  ['food', 'อาหาร', 'Food'],
  ['household', 'ของใช้', 'Household'],
  ['instruments', 'ดนตรี', 'Music'],
  ['animals', 'สัตว์', 'Animals'],
  ['monsters', 'ปีศาจ', 'Monsters'],
  ['buildings', 'บ้านวัด', 'Buildings'],
  ['boats', 'เรือ', 'Boats'],
  ['nature', 'ธรรมชาติ', 'Nature'],
  ['vehicles', 'พาหนะ', 'Vehicles'],
];

// Prop instrument ids -> audio instrument names
const SOUND_ALIAS = { 'ranat-ek': 'ranat', 'klong-that': 'klong', 'saw-duang': 'saw', 'pi-nai': 'pi' };

const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

export async function loadContent(progress = () => {}) {
  const puppets = [], props = [];
  const errors = [];
  progress(0.05, 'ตัดหนังจากแผ่นต้นแบบ · cutting the hides');
  const sheet = await loadSheetPuppets();
  sheet.puppets.forEach((r) => puppets.push({ ...r, rig: r, source: 'sheet' }));
  sheet.props.forEach((p) => props.push(p));

  const mods = await Promise.all([...PUPPET_MODULES, ...PROP_MODULES].map((m) => import(m).catch((e) => { errors.push(`${m}: ${e.message}`); return null; })));
  const entries = [];
  mods.forEach((m) => {
    if (!m) return;
    for (const d of m.PUPPETS || []) entries.push(['puppet', d]);
    for (const d of m.PROPS || []) entries.push(['prop', d]);
  });
  let t0 = performance.now();
  for (let i = 0; i < entries.length; i++) {
    const [type, d] = entries[i];
    const tb = performance.now();
    try {
      const built = await d.build();
      if (type === 'puppet') {
        const rig = { ...built, id: d.id, name: d.name || built.name, en: d.en || built.en, kind: d.kind || built.kind, lines: built.lines || d.lines, voice: built.voice || d.voice };
        puppets.push({ ...rig, rig });
      } else if (built.parts) {
        props.push({ id: d.id, name: d.name, en: d.en, cat: d.cat, rig: { ...built, kind: built.kind || 'animal' }, sound: built.sound, glow: built.glow, float: built.float });
      } else {
        const def = { id: d.id, name: d.name, en: d.en, cat: d.cat, ...built };
        if (def.sound && SOUND_ALIAS[def.sound]) def.sound = SOUND_ALIAS[def.sound];
        props.push(def);
      }
    } catch (e) {
      errors.push(`${d.id}: ${e.message}`);
    }
    const bt = performance.now() - tb;
    if (bt > 300) console.log('slow build', d.id, Math.round(bt));
    if (performance.now() - t0 > 40) {
      progress(0.1 + 0.8 * (i / entries.length), `วาดลาย ${d.name || d.id} · ${d.en || ''}`);
      await frame();
      t0 = performance.now();
    }
  }
  if (errors.length) console.warn('content errors', errors);
  const byId = new Map();
  for (const p of puppets) byId.set(p.id, p);
  for (const p of props) byId.set(p.id, p);
  return { puppets, props, byId, errors };
}
