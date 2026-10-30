import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game.js';
import { NO_INPUT } from '../js/fighter.js';
import { pickNext } from '../js/menu.js';
import { HIT_CONFIRM, MAX_ENERGY, WEAPONS } from '../js/config.js';

const DT = 1 / 120;
const never = () => 0.99;
// Two fighters face to face in the fight phase, 60px apart.
function setup(w1 = 'sword', w2 = 'sword') {
  const g = new Game({ mode: '2p', weapons: [w1, w2], map: 'seoul', wins: 3, time: 90, seed: 2, rand: never });
  g.update(2, [NO_INPUT, NO_INPUT]);
  g.layout.traps = [];
  const [a, b] = g.fighters;
  a.x = 600; b.x = 660;
  return g;
}
const run = (g, secs, ia = () => NO_INPUT, ib = () => NO_INPUT) => {
  for (let t = 0; t < secs; t += DT) g.update(DT, [ia(t), ib(t)]);
};

test('judge: a hit lands after the confirm window, with a hitstop', () => {
  const g = setup(), [a, b] = g.fighters;
  g.update(DT, [{ ...NO_INPUT, attack: true }, NO_INPUT]);
  let contactT = null;
  for (let t = 0; t < 0.5 && b.energy === MAX_ENERGY; t += DT) {
    g.update(DT, [NO_INPUT, NO_INPUT]);
    if (contactT === null && g.pending.length) contactT = t;
  }
  assert.equal(b.energy, MAX_ENERGY - WEAPONS.sword.power);
  assert.ok(g.hitstop > 0);
});

test('judge: pressing guard during the confirm window still guards (late guard)', () => {
  const g = setup('sword', 'axe'), [a, b] = g.fighters;
  g.update(DT, [{ ...NO_INPUT, attack: true }, NO_INPUT]);
  while (!g.pending.length) g.update(DT, [NO_INPUT, NO_INPUT]);
  // guard pressed right after contact — the axe's guard would never be up in time on its own
  run(g, HIT_CONFIRM + 0.05, () => NO_INPUT, () => ({ ...NO_INPUT, guard: true }));
  assert.equal(b.energy, MAX_ENERGY - 1);
  assert.ok(g.effects.some(e => e.type === 'guard'));
});

test('judge: guard after the window is too late', () => {
  const g = setup('sword', 'axe'), [, b] = g.fighters;
  g.update(DT, [{ ...NO_INPUT, attack: true }, NO_INPUT]);
  while (!g.pending.length) g.update(DT, [NO_INPUT, NO_INPUT]);
  run(g, HIT_CONFIRM + 0.02);
  assert.equal(b.energy, MAX_ENERGY - WEAPONS.sword.power);
});

test('judge: hits a few frames apart both land (trade)', () => {
  const g = setup(), [a, b] = g.fighters;
  g.update(DT, [{ ...NO_INPUT, attack: true }, NO_INPUT]);
  // B swings 3 frames later; without the window A's hit would cancel B's attack
  run(g, 3 * DT);
  g.update(DT, [NO_INPUT, { ...NO_INPUT, attack: true }]);
  run(g, 0.4);
  assert.equal(a.energy, MAX_ENERGY - WEAPONS.sword.power);
  assert.equal(b.energy, MAX_ENERGY - WEAPONS.sword.power);
  assert.ok(g.effects.some(e => e.type === 'trade'));
});

test('judge: a hit well after the window does not trade', () => {
  const g = setup(), [a, b] = g.fighters;
  g.update(DT, [{ ...NO_INPUT, attack: true }, NO_INPUT]);
  run(g, 0.1);
  g.update(DT, [NO_INPUT, { ...NO_INPUT, attack: true }]);
  run(g, 0.4);
  assert.equal(a.energy, MAX_ENERGY);
  assert.ok(b.energy < MAX_ENERGY);
});

test('menu: spatial navigation picks the nearest item in a direction', () => {
  // 3 portraits in a row, a wide button below the middle one
  const r = [{ x: 0, y: 0, w: 40, h: 40 }, { x: 50, y: 0, w: 40, h: 40 }, { x: 100, y: 0, w: 40, h: 40 }, { x: 30, y: 80, w: 80, h: 40 }];
  assert.equal(pickNext(r, 0, 'right'), 1);
  assert.equal(pickNext(r, 1, 'right'), 2);
  assert.equal(pickNext(r, 2, 'right'), 2);
  assert.equal(pickNext(r, 2, 'down'), 3);
  assert.equal(pickNext(r, 3, 'up'), 1);
  assert.equal(pickNext(r, 0, 'up'), 0);
});
