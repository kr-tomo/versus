import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game.js';
import { NO_INPUT } from '../js/fighter.js';
import { MAX_ENERGY, SUPER_MAX, SUPER_HOLD, SUPERS, WEAPONS, WORLD_W, GROUND_Y } from '../js/config.js';

const DT = 1 / 120;
const always = () => 0;  // every evade roll succeeds
const both = { ...NO_INPUT, attack: true, guard: true };
function fight(w1, w2, rand = always) {
  const g = new Game({ mode: '2p', weapons: [w1, w2], map: 'seoul', wins: 3, time: 90, seed: 2, rand });
  g.update(2, [NO_INPUT, NO_INPUT]);
  g.layout.traps = [];
  return g;
}
const run = (g, secs, ia = () => NO_INPUT, ib = () => NO_INPUT) => { for (let t = 0; t < secs; t += DT) g.update(DT, [ia(t), ib(t)]); };
const fire = (g, ib = () => NO_INPUT) => { g.fighters[0].meter = SUPER_MAX; run(g, SUPER_HOLD + DT * 2, () => both, ib); };

test('stag super: teleports onto the opponent from anywhere; no guard, no air evade', () => {
  for (const airborne of [false, true]) {
    const g = fight('stag', 'sword'), [a, b] = g.fighters;
    a.x = 400; b.x = 900;
    fire(g, () => ({ ...NO_INPUT, guard: true }));
    if (airborne) { b.y = GROUND_Y - 120; b.onGround = false; b.vy = 0; }
    run(g, 0.6, () => NO_INPUT, () => ({ ...NO_INPUT, guard: true }));
    assert.ok(Math.abs(a.x - b.x) < 200, 'blinked next to the opponent');
    assert.equal(b.energy, MAX_ENERGY - SUPERS.stag.hits[0].dmg, airborne ? 'air' : 'ground');
  }
});

test('mace super: grabs anything within twice the reach in front, at any height, and throws it far', () => {
  const g = fight('mace', 'sword'), [a, b] = g.fighters;
  a.x = 400; b.x = 400 + 28 + WEAPONS.mace.reach * 1.9;
  fire(g, () => ({ ...NO_INPUT, guard: true }));
  b.y = GROUND_Y - 150; b.onGround = false; b.vy = -50;
  run(g, 0.4);
  assert.equal(b.energy, MAX_ENERGY - SUPERS.mace.hits[0].dmg);
  run(g, 0.8);
  assert.ok(b.x - a.x > 250, `thrown far (${Math.round(b.x - a.x)})`);
  // out of range: whiffs
  const g2 = fight('mace', 'sword'), [c, d] = g2.fighters;
  c.x = 300; d.x = 300 + 28 + WEAPONS.mace.reach * 2 + 30;
  fire(g2);
  run(g2, 0.8);
  assert.equal(d.energy, MAX_ENERGY);
});

test('fork super: a bull runs from behind the farmer across the map and hits the opponent once', () => {
  const g = fight('fork', 'sword', () => 0.99), [a, b] = g.fighters;
  a.x = 500; b.x = 700;
  fire(g);
  run(g, 0.3);
  assert.ok(g.bull, 'bull summoned');
  assert.ok(g.bull.x < a.x && g.bull.dir === 1, 'enters from behind the farmer');
  const farmer = a.energy;
  run(g, 3);
  assert.equal(g.bull, null, 'ran off the map');
  assert.equal(b.energy, MAX_ENERGY - SUPERS.fork.bull.dmg);
  assert.equal(a.energy, farmer, 'the farmer is not trampled');
});

test('fork super: jumping clear of the bull avoids it', () => {
  const g = fight('fork', 'sword', () => 0.99), [a, b] = g.fighters;
  a.x = 500; b.x = 760;
  fire(g);
  run(g, 0.25);
  // hold the opponent high in the air while the bull passes underneath
  run(g, 2.5, () => NO_INPUT, () => { b.y = GROUND_Y - 120; b.onGround = false; b.vy = 0; return NO_INPUT; });
  assert.equal(b.energy, MAX_ENERGY);
});

test('new fighters: mace and fork have the heavy back-step attack and no double jump', () => {
  for (const w of ['mace', 'fork']) {
    const g = fight(w, 'sword'), [a] = g.fighters;
    g.update(DT, [{ ...NO_INPUT, left: true, attack: true }, NO_INPUT]);
    assert.equal(a.attack.kind, 'heavy', w);
    assert.equal(a.canDouble, false, w);
  }
  assert.ok(WEAPONS.fork.reach === WEAPONS.spear.reach);
});
