import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFighter, stepFighter, frameName, NO_INPUT } from '../js/fighter.js';
import { strike, applyHit, hitbox } from '../js/combat.js';
import { Game } from '../js/game.js';
import { moveList } from '../js/moves.js';
import {
  WEAPONS, WEAPON_IDS, SUPERS, CHARGE_TIME, MAX_ENERGY, GROUND_Y, BODY_H, SUPER_MAX, SUPER_HOLD, JUMP_V, LONG_REACH_BONUS
} from '../js/config.js';

const DT = 1 / 120;
const W = { platforms: [], ice: false };
const never = () => 0.99;
const step = (f, input = NO_INPUT, n = 1, world = W) => { for (let i = 0; i < n; i++) stepFighter(f, input, DT, world); };
const firstStrike = (f, input = NO_INPUT) => { for (let i = 0; i < 200 && !strike(f); i++) step(f, input); return strike(f); };

test('charge: a steady pose — no flicker', () => {
  const f = createFighter('sword', 400, 1), frames = [];
  for (let i = 0; i < 160; i++) { step(f, { ...NO_INPUT, attack: true }); if (f.attack?.kind === 'charged' && f.attack.t < CHARGE_TIME) frames.push(frameName(f)); }
  assert.ok(frames.length > 0);
  // the pose only moves forward into the hold, never back and forth
  const order = ['idle0>chargeHold', 'chargeHold'];
  for (let i = 1; i < frames.length; i++) assert.ok(order.indexOf(frames[i]) >= order.indexOf(frames[i - 1]), frames.join(','));
});

test('fist super: twice the blows, a half-height 45° hop, and it reaches high in front', () => {
  const hits = SUPERS.fist.hits;
  assert.equal(hits.length, 21);
  assert.equal(SUPERS.fist.hop.v, JUMP_V / 2);
  const f = createFighter('fist', 400, 1);
  f.meter = SUPER_MAX;
  step(f, { ...NO_INPUT, attack: true, guard: true }, Math.ceil(SUPER_HOLD / DT) + 1);
  assert.ok(f.super);
  step(f, NO_INPUT, 8);
  assert.ok(!f.onGround && f.vx > 0, 'hops up and forward');
  const g = new Game({ mode: '2p', weapons: ['fist', 'sword'], map: 'seoul', wins: 3, time: 90, seed: 2, rand: never });
  g.update(2, [NO_INPUT, NO_INPUT]); g.layout.traps = [];
  const [a, b] = g.fighters;
  a.x = 500; b.x = 560; a.meter = SUPER_MAX;
  for (let t = 0; t < SUPER_HOLD + DT * 2; t += DT) g.update(DT, [{ ...NO_INPUT, attack: true, guard: true }, NO_INPUT]);
  // the opponent hangs in the air above head height in front
  for (let t = 0; t < 3; t += DT) { b.x = a.x + 60; b.y = GROUND_Y - BODY_H * 0.9; b.onGround = false; b.vy = 0; b.stun = 0; g.update(DT, [NO_INPUT, NO_INPUT]); }
  assert.equal(MAX_ENERGY - b.energy, 20 * 3 + 10, 'every blow of the flurry connects up high');
});

test('farmer: the bull hits 2.5x harder', () => {
  assert.equal(SUPERS.fork.bull.dmg, 32 * 2.5);
});

test('mace: forward attack keeps going through hits; back-step reach equals the normal reach', () => {
  const att = createFighter('sword', 500, 1), def = createFighter('mace', 560, -1);
  step(def, { ...NO_INPUT, left: true, attack: true });
  assert.equal(def.attack.kind, 'long');
  const r = applyHit(att, def, undefined, never);
  assert.equal(r.armored, true);
  assert.ok(def.attack && def.kb === 0 && def.stun === 0);
  assert.equal(def.energy, MAX_ENERGY - WEAPONS.sword.power);
  const h = createFighter('mace', 400, 1); step(h, { ...NO_INPUT, left: true, attack: true });
  assert.equal(firstStrike(h, { ...NO_INPUT, left: true }).reach, WEAPONS.mace.reach);
});

test('dagger: double-tap forward and hold teleports three body heights ahead', () => {
  const R = { ...NO_INPUT, right: true };
  const f = createFighter('dagger', 300, 1);
  step(f, R, 3); step(f, NO_INPUT, 6);           // first tap
  const x0 = f.x;
  step(f, R);                                       // second tap…
  step(f, R, Math.ceil(0.1 / DT) + 1);              // …held
  assert.ok(f.x - x0 >= 3 * BODY_H - 1, `${f.x - x0}`);
  // a single long press only walks
  const g = createFighter('dagger', 300, 1);
  step(g, R, 60);
  assert.ok(g.x - 300 < 3 * BODY_H);
  // other fighters don't blink
  const s = createFighter('sword', 300, 1);
  step(s, R, 3); step(s, NO_INPUT, 6); step(s, R, 20);
  assert.ok(s.x - 300 < 100);
});

test('spear: jump and forward attacks reach 1.3x; back-step reach equals the normal one', () => {
  const fwd = createFighter('spear', 400, 1); step(fwd, { ...NO_INPUT, right: true, attack: true });
  assert.ok(Math.abs(firstStrike(fwd, { ...NO_INPUT, right: true }).reach - (WEAPONS.spear.reach + LONG_REACH_BONUS) * 1.3) < 1e-9);
  const air = createFighter('spear', 400, 1); air.onGround = false; air.y = GROUND_Y - 60;
  step(air, { ...NO_INPUT, attack: true });
  assert.ok(Math.abs(firstStrike(air).reach - WEAPONS.spear.reach * 1.3) < 1e-9);
});

test('archer super is named 비격진천뢰; every character has a move list with named techniques', () => {
  assert.equal(SUPERS.archer.name, '비격진천뢰');
  for (const w of WEAPON_IDS) {
    const ml = moveList(w), kinds = ml.rows.map(r => r.kind);
    for (const k of ['기본 공격', '전진 공격', '공중 공격', '차징 공격', '방어', '필살기']) assert.ok(kinds.includes(k), `${w} ${k}`);
    assert.ok(ml.rows.every(r => r.name && r.input), w);
    assert.equal(ml.rows.at(-1).name, SUPERS[w].name);
  }
  assert.ok(moveList('dagger').rows.some(r => r.name === '그림자 걸음'));
  assert.ok(!moveList('sword').rows.some(r => r.name === '수직 내려찍기'));
  assert.ok(moveList('tkd').rows.some(r => r.kind === '2단 공격' && r.name === '날라차기'));
  assert.ok(moveList('tkd').rows.some(r => r.kind === '버티기 공격'));
  assert.ok(!moveList('fist').rows.some(r => r.kind === '버티기 공격'));
});
