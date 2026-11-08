import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, arrowArc } from '../js/game.js';
import { NO_INPUT, createFighter, stepFighter } from '../js/fighter.js';
import { readPad } from '../js/input.js';
import {
  WEAPONS, SUPERS, SUPER_MAX, SUPER_HOLD, MAX_ENERGY, GROUND_Y, BODY_H, WORLD_W, VIEW_W, MAP_IDS, MAPS,
  ARROW_RANGE, canDoubleJump, CHARGE_TIME
} from '../js/config.js';
import { generateMap, validateMap } from '../js/mapgen.js';

const DT = 1 / 120;
const never = () => 0.99;
const both = { ...NO_INPUT, attack: true, guard: true };
function fight(w1, w2, map = 'seoul') {
  const g = new Game({ mode: '2p', weapons: [w1, w2], map, wins: 3, time: 90, seed: 2, rand: never });
  g.update(2, [NO_INPUT, NO_INPUT]);
  g.layout.traps = [];
  return g;
}
const run = (g, secs, ia = () => NO_INPUT, ib = () => NO_INPUT) => { for (let t = 0; t < secs; t += DT) g.update(DT, [ia(t), ib(t)]); };
const speed = w => WEAPONS[w].startup + WEAPONS[w].active + WEAPONS[w].recovery;

test('taekwondo: dagger power/reach, faster than dagger, slower than fist; double jump and back-step attack', () => {
  assert.equal(WEAPONS.tkd.power, WEAPONS.dagger.power);
  assert.equal(WEAPONS.tkd.reach, WEAPONS.dagger.reach);
  assert.ok(speed('tkd') < speed('dagger') && speed('tkd') > speed('fist'));
  assert.ok(canDoubleJump('tkd'));
  const f = createFighter('tkd', 400, 1);
  stepFighter(f, { ...NO_INPUT, left: true, attack: true }, DT, { platforms: [], ice: false });
  assert.equal(f.attack.kind, 'heavy', 'axe kick');
});

test('taekwondo super: flies to an opponent within 3x reach in front or above, and launches it far', () => {
  for (const [dx, high] of [[28 + 120, false], [28 + 60, true]]) {
    const g = fight('tkd', 'sword'), [a, b] = g.fighters;
    a.x = 500; b.x = 500 + dx;
    a.meter = SUPER_MAX;
    run(g, SUPER_HOLD + DT * 2, () => both);
    if (high) { b.y = GROUND_Y - 110; b.onGround = false; }
    run(g, 0.5, () => NO_INPUT, () => { if (high) { b.vy = 0; } return NO_INPUT; });
    assert.equal(b.energy, MAX_ENERGY - SUPERS.tkd.hits[0].dmg, high ? 'above' : 'front');
    run(g, 0.8);
    assert.ok(Math.abs(b.x - a.x) > 150, 'sent flying');
  }
  // too far: whiffs
  const g = fight('tkd', 'sword'), [a, b] = g.fighters;
  a.x = 300; b.x = 300 + 28 + 135 + 40; a.meter = SUPER_MAX;
  run(g, SUPER_HOLD + 1, () => (g.fighters[0].super ? NO_INPUT : both));
  assert.equal(b.energy, MAX_ENERGY);
});

test('archer arrow: arc reaches 2/3 of the view, peaks at 1.2x body height, hits for 1.5x', () => {
  const c = BODY_H * 0.68, H = BODY_H * 1.2, { a, b } = arrowArc(c, H);
  const h = u => a * u * u + b * u + c;
  assert.ok(Math.abs(h(1)) < 1e-9);
  const peak = Math.max(...Array.from({ length: 1001 }, (_, i) => h(i / 1000)));
  assert.ok(Math.abs(peak - H) < 0.5, `${peak}`);
  assert.ok(Math.abs(ARROW_RANGE - VIEW_W * 2 / 3) < 1e-9);
  // in a game: holding attack fires an arrow that lands on a distant opponent at the end of the arc
  const g = fight('archer', 'sword'), [p, q] = g.fighters;
  p.x = 300; q.x = 300 + 16 + ARROW_RANGE - 4;
  run(g, speed("archer") + CHARGE_TIME + 0.05, () => ({ ...NO_INPUT, attack: true }));
  assert.equal(g.projectiles.length, 1, 'arrow in flight');
  run(g, 1.2);
  assert.equal(q.energy, MAX_ENERGY - Math.round(WEAPONS.archer.power * 1.5));
});

test('archer super: the shell bursts at the center of the current view, radius 225', () => {
  assert.equal(SUPERS.archer.bomb.radius, 150 * 1.5);
  // camera pushed to the left edge: the view center (320) is far from the map center (640)
  for (const [ox, hit] of [[320 + 200, true], [320 + 300, false]]) {
    const g = fight('archer', 'sword'), [a, b] = g.fighters;
    g.cam = 0; a.x = 60; b.x = ox; a.meter = SUPER_MAX;
    run(g, SUPER_HOLD + DT * 2, () => both, () => { b.x = ox; return NO_INPUT; });
    let bomb;
    for (let t = 0; t < 1 && !bomb; t += DT) { g.update(DT, [NO_INPUT, NO_INPUT]); bomb = g.projectiles.find(p => p.type === 'bomb'); }
    assert.ok(bomb, 'shell launched');
    assert.ok(Math.abs(bomb.cx - (g.cam + VIEW_W / 2)) < 1, 'aimed at the view center');
    assert.ok(Math.abs(bomb.cx - WORLD_W / 2) > 200, 'not the map center');
    let boom = false;
    for (let t = 0; t < 1.8; t += DT) { g.update(DT, [NO_INPUT, NO_INPUT]); boom ||= g.effects.some(e => e.type === 'explosion'); }
    assert.ok(boom, 'explodes');
    assert.equal(b.energy, hit ? MAX_ENERGY - SUPERS.archer.bomb.dmg : MAX_ENERGY, hit ? 'near' : 'far');
    assert.equal(a.energy, MAX_ENERGY, 'the archer is never hurt');
  }
});

test('maps: four new maps generate valid layouts; the library guard scolds on entering', () => {
  for (const id of ['ship', 'library', 'rome', 'egypt']) {
    assert.ok(MAP_IDS.includes(id));
    for (let seed = 1; seed < 80; seed++) assert.deepEqual(validateMap(generateMap(id, seed)), [], `${id} ${seed}`);
  }
  const g = new Game({ mode: '2p', weapons: ['sword', 'axe'], map: 'library', wins: 1, time: 60, seed: 3, rand: never });
  g.update(2, [NO_INPUT, NO_INPUT]);
  const t = g.layout.traps[0], f = g.fighters[0];
  f.x = t.x + t.w / 2;
  g.applyTrap(f, DT);
  assert.ok(g.effects.some(e => e.type === 'scold'));
  assert.ok(MAPS.library.trapReact);
});

test('pads: standard d-pad, analog value buttons and a non-standard hat switch all read', () => {
  const pad = (over = {}) => ({ mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), ...over });
  const p1 = pad(); p1.buttons[14].pressed = true; p1.buttons[0].value = 1;
  assert.deepEqual([readPad(p1).left, readPad(p1).a], [true, true]);
  const hat = pad({ mapping: '', axes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.714] });
  assert.equal(readPad(hat).left, true);
  hat.axes[9] = -1;
  assert.equal(readPad(hat).up, true);
  hat.axes[9] = 1.286;   // centered
  const r = readPad(hat);
  assert.ok(!r.up && !r.down && !r.left && !r.right);
});

test('stage: every map has its effect palette (missing ones crashed the fight scene)', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../js/stage.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('const MAP_FX = {'), src.indexOf('};', src.indexOf('const MAP_FX = {')));
  for (const id of MAP_IDS) assert.match(block, new RegExp(`\\b${id}:`), id);
});

test('taekwondo: the axe kick holds 0.2s at the top; the back kick turns the body around', async () => {
  const { attackTiming, turnScale, frameName } = await import('../js/fighter.js');
  const W = { platforms: [], ice: false };
  const f = createFighter('tkd', 400, 1);
  stepFighter(f, { ...NO_INPUT, left: true, attack: true }, DT, W);
  assert.equal(f.attack.kind, 'heavy');
  assert.ok(Math.abs(attackTiming(f).startup - (WEAPONS.tkd.startup + 0.2)) < 1e-9);
  const top = [];
  for (let i = 0; i < 60; i++) { stepFighter(f, { ...NO_INPUT, left: true }, DT, W); top.push(frameName(f)); }
  assert.ok(top.filter(n => n === 'heavyWind').length * DT >= 0.2, 'leg held up for at least 0.2s');
  // back kick: faces the opponent, turns its back while charging, kicks with its back turned, turns back
  const k = createFighter('tkd', 400, 1), scales = [];
  for (let i = 0; i < 200; i++) { stepFighter(k, { ...NO_INPUT, attack: i < 120 }, DT, W); if (k.attack?.kind === 'charged') scales.push([turnScale(k), frameName(k)]); }
  assert.ok(scales.some(([s]) => s === 1) && scales.some(([s]) => s === -1), 'turns from front to back');
  assert.ok(scales.some(([s]) => Math.abs(s) < 0.3), 'passes through side-on mid-turn');
  assert.ok(scales.filter(([, n]) => n === 'backKick').every(([s]) => s === -1), 'kicks with the back turned');
  assert.equal(turnScale(createFighter('sword', 0, 1)), 1);
});
