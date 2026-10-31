// Generates the "classic" theme sprite sheets from the vector rig.
// Usage: node tools/build-sprites.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARS, FRAMES, renderChar, renderBull, BULL_FRAMES, f } from './art/rig.js';
import { MAP_ART } from './art/maps.js';
import { MAPS, PLATFORM_WIDTHS } from '../js/config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'themes/classic');
const write = (rel, text) => { const p = join(out, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
const svg = (w, h, body, vb = `0 0 ${w} ${h}`) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}">${body}</svg>\n`;

const CELL = [220, 190], ORIGIN = [70, 180], COLS = 6;
const theme = { id: 'classic', name: '클래식', characters: {}, maps: {} };

for (const c of CHARS) {
  const rows = Math.ceil(FRAMES.length / COLS), cell = c.cell || CELL, origin = c.cellOrigin || ORIGIN;
  let body = '';
  FRAMES.forEach((name, i) => {
    const x = (i % COLS) * cell[0] + origin[0], y = Math.floor(i / COLS) * cell[1] + origin[1];
    body += `<g transform="translate(${x} ${y})">${renderChar(c, name).svg}</g>`;
  });
  write(`characters/${c.id}.svg`, svg(cell[0] * COLS, cell[1] * rows, body));

  const p = renderChar(c, 'idle0', { noFront: true });
  const [hx, hy] = p.head;
  write(`portraits/${c.id}.svg`, svg(128, 128, `<defs><radialGradient id="bg" cx=".6" cy=".4" r=".75"><stop offset="0" stop-color="${c.accent}"/><stop offset="1" stop-color="#1b1824"/></radialGradient></defs>
    <rect x="${f(hx - 30)}" y="${f(hy - 26)}" width="62" height="62" fill="url(#bg)"/>${p.svg}`, `${f(hx - 30)} ${f(hy - 26)} 62 62`));

  theme.characters[c.id] = {
    name: c.name, en: c.en, title: c.origin, color: c.accent,
    sheet: `characters/${c.id}.svg`, portrait: `portraits/${c.id}.svg`,
    cell, origin, cols: COLS, scale: 0.8,
    frames: Object.fromEntries(FRAMES.map((n, i) => [n, i]))
  };
}

const TRAP_PAD = 20, TRAP_TOP = 70, TRAP_H = 114, TRAP_FRAMES = 2;
const PLAT_TOP = 4, PLAT_H = 48;
for (const [id, art] of Object.entries(MAP_ART)) {
  write(`maps/${id}/far.svg`, svg(1280, 360, art.far()));
  write(`maps/${id}/ground.svg`, svg(1280, 44, art.ground(), '0 316 1280 44'));

  const tw = MAPS[id].trapWidth, cw = tw + TRAP_PAD * 2;
  let traps = '';
  for (let fr = 0; fr < TRAP_FRAMES; fr++) traps += `<g transform="translate(${fr * cw + TRAP_PAD} ${TRAP_TOP})">${art.trap(tw, fr)}</g>`;
  write(`maps/${id}/trap.svg`, svg(cw * TRAP_FRAMES, TRAP_H, traps));

  const pw = Math.max(...PLATFORM_WIDTHS) + 8;
  let plats = '';
  PLATFORM_WIDTHS.forEach((w, i) => { plats += `<g transform="translate(4 ${i * PLAT_H + PLAT_TOP})">${art.platform(w)}</g>`; });
  write(`maps/${id}/platforms.svg`, svg(pw, PLAT_H * PLATFORM_WIDTHS.length, plats));

  theme.maps[id] = {
    far: `maps/${id}/far.svg`, ground: `maps/${id}/ground.svg`,
    trap: { sheet: `maps/${id}/trap.svg`, cell: [cw, TRAP_H], origin: [TRAP_PAD, TRAP_TOP], frames: TRAP_FRAMES, width: tw },
    platforms: { sheet: `maps/${id}/platforms.svg`, cellH: PLAT_H, origin: [4, PLAT_TOP], widths: PLATFORM_WIDTHS },
    extras: art.extras || {}
  };
}

// the farmer's bull: one row of gallop frames
const BULL_CELL = [180, 110], BULL_ORIGIN = [80, 104];
let bull = '';
for (let i = 0; i < BULL_FRAMES; i++) bull += `<g transform="translate(${i * BULL_CELL[0] + BULL_ORIGIN[0]} ${BULL_ORIGIN[1]})">${renderBull(i)}</g>`;
write('extras/bull.svg', svg(BULL_CELL[0] * BULL_FRAMES, BULL_CELL[1], bull));
theme.extras = { bull: { sheet: 'extras/bull.svg', cell: BULL_CELL, origin: BULL_ORIGIN, frames: BULL_FRAMES, scale: 0.85 } };

write('theme.json', JSON.stringify(theme, null, 2) + '\n');
console.log(`theme written to ${out}`);
