import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFighter, stepFighter, NO_INPUT } from '../js/fighter.js';
import { applyHit, resolveHits, strike } from '../js/combat.js';
import { Game } from '../js/game.js';
import { AI } from '../js/ai.js';
import {
  WEAPONS, WEAPON_IDS, SUPERS, MAX_ENERGY, WALK_SPEED, GUARD_MOVE, SUPER_MAX, SUPER_HOLD, JUMP_ATTACK_MULT
} from '../js/config.js';
import { readFileSync } from 'node:fs';

const DT = 1 / 120;
const world = { platforms: [], ice: false };
const never = () => 0.99, always = () => 0;
const run = (f, input, secs) => { for (let t = 0; t < secs; t += DT) stepFighter(f, input, DT, world); };

test('roster: stag beetle and mounted Genghis Khan exist with matching theme entries', () => {
  const theme = JSON.parse(readFileSync(new URL('../themes/classic/theme.json', import.meta.url)));
  for (const w of WEAPON_IDS) {
    assert.ok(theme.characters[w], w);
    assert.ok(SUPERS[w], w);
  }
  const s = WEAPONS.stag, g = WEAPONS.genghis;
  const speed = w => WEAPONS[w].startup + WEAPONS[w].active + WEAPONS[w].recovery;
  // stag: middle of the pack; genghis: slowest, hardest hitting, longest reach
  assert.ok(s.power > WEAPONS.sword.power && s.power < WEAPONS.axe.power);
  assert.ok(s.reach > WEAPONS.sword.reach && s.reach < WEAPONS.spear.reach);
  for (const w of WEAPON_IDS.filter(w => w !== 'genghis')) {
    assert.ok(g.reach > WEAPONS[w].reach, w);
    assert.ok(g.power > WEAPONS[w].power, w);
    assert.ok(speed('genghis') > speed(w), w);
  }
});

test('guard: walking while guarding is slow', () => {
  const f = createFighter('sword', 400, 1);
  stepFighter(f, { ...NO_INPUT, guard: true, right: true }, DT, world);
  assert.ok(Math.abs(f.vx - WALK_SPEED * GUARD_MOVE) < 1e-9);
  assert.ok(f.guarding);
});

test('guard: heavy weapons raise the guard more slowly', () => {
  const raise = w => { const f = createFighter(w, 400, 1); let t = 0; while (!f.guard) { stepFighter(f, { ...NO_INPUT, guard: true }, DT, world); t += DT; } return t; };
  assert.ok(raise('fist') < raise('sword'));
  assert.ok(raise('sword') < raise('axe'));
  assert.ok(raise('axe') < raise('genghis'));
  // hit while the guard is still coming up → full damage
  const a = createFighter('sword', 500, 1), b = createFighter('axe', 560, -1);
  stepFighter(b, { ...NO_INPUT, guard: true }, DT, world);
  assert.equal(applyHit(a, b, undefined, never).damage, WEAPONS.sword.power);
});

test('jump attack hits harder', () => {
  const a = createFighter('sword', 500, 1);
  a.attack = { t: a.stats.startup + 0.01, aerial: true, hit: false };
  assert.equal(strike(a).dmg, Math.round(WEAPONS.sword.power * JUMP_ATTACK_MULT));
});

test('airborne defender evades with the evade roll', () => {
  const a = createFighter('sword', 500, 1), b = createFighter('sword', 560, -1);
  b.onGround = false;
  assert.equal(applyHit(a, b, undefined, always).evaded, true);
  assert.equal(b.energy, MAX_ENERGY);
  assert.equal(applyHit(a, b, undefined, never).evaded, false);
  assert.equal(b.energy, MAX_ENERGY - 12);
  // evade rate is about one in three
  let n = 0;
  for (let i = 0; i < 3000; i++) { const d = createFighter('sword', 560, -1); d.onGround = false; if (applyHit(a, d).evaded) n++; }
  assert.ok(n > 850 && n < 1150, `${n}`);
});

test('super gauge: +3 on hit, +1 on guard, capped at 20', () => {
  const a = createFighter('sword', 500, 1), b = createFighter('sword', 560, -1);
  applyHit(a, b, undefined, never);
  assert.equal(b.meter, 3);
  b.stun = 0; b.guard = true;
  applyHit(a, b, undefined, never);
  assert.equal(b.meter, 4);
  b.guard = false;
  for (let i = 0; i < 10; i++) applyHit(a, b, undefined, never);
  assert.equal(b.meter, SUPER_MAX);
});

test('super: needs a full gauge and attack+guard held for one second', () => {
  const both = { ...NO_INPUT, attack: true, guard: true };
  const f = createFighter('sword', 400, 1);
  run(f, both, SUPER_HOLD + 0.1);
  assert.equal(f.super, null);
  f.meter = SUPER_MAX;
  run(f, both, SUPER_HOLD - 0.1);
  assert.equal(f.super, null);
  run(f, both, 0.15);
  assert.ok(f.super);
  assert.equal(f.meter, 0);
});

const fire = (w, x = 400) => { const f = createFighter(w, x, 1); f.meter = SUPER_MAX; run(f, { ...NO_INPUT, attack: true, guard: true }, SUPER_HOLD + DT); assert.ok(f.super, w); return f; };

test('super: spear dashes forward in a straight line', () => {
  const f = fire('spear'), x0 = f.x;
  run(f, NO_INPUT, SUPERS.spear.time);
  assert.ok(f.x - x0 > 200, `${f.x - x0}`);
});

test('super: axe ignores guard, sword is chipped by guard', () => {
  for (const [w, ub] of [['axe', true], ['sword', false]]) {
    const a = fire(w, 500), b = createFighter('sword', 500 + 28 + 60, -1);
    b.guard = true;
    let dmg = 0;
    for (let t = 0; t < SUPERS[w].time; t += DT) { stepFighter(a, NO_INPUT, DT, world); dmg += resolveHits(a, b, never).reduce((s, e) => s + e.damage, 0); b.guard = true; b.stun = 0; }
    const total = SUPERS[w].hits.reduce((s, h) => s + h.dmg, 0);
    if (ub) assert.equal(dmg, total, w); else assert.ok(dmg > 0 && dmg < total / 2, `${w} ${dmg}`);
  }
});

test('super: fist lands a flurry, user is invulnerable', () => {
  const a = fire('fist', 500), b = createFighter('sword', 500 + 28 + 30, -1);
  b.attack = { t: b.stats.startup + 0.01, aerial: false, hit: false };
  let events = 0;
  for (let t = 0; t < SUPERS.fist.time; t += DT) { stepFighter(a, NO_INPUT, DT, world); b.x = a.x + 58; events += resolveHits(a, b, never).filter(e => e.attacker === a).length; }
  assert.equal(a.energy, MAX_ENERGY);
  assert.ok(events >= 10, `${events}`);
});

test('super: dagger blinks behind the opponent inside a game', () => {
  const g = new Game({ mode: '2p', weapons: ['dagger', 'sword'], map: 'seoul', wins: 1, time: 90, seed: 2, rand: never });
  g.update(2, [NO_INPUT, NO_INPUT]);
  const [a, b] = g.fighters;
  a.meter = SUPER_MAX;
  const side0 = Math.sign(b.x - a.x);
  for (let t = 0; t < SUPER_HOLD + 0.3; t += DT) g.update(DT, [{ ...NO_INPUT, attack: true, guard: true }, NO_INPUT]);
  assert.equal(Math.sign(b.x - a.x), -side0);
  assert.ok(g.effects.some(e => e.type === 'super') || a.super);
});

test('ai: hard computer does not block every attack', () => {
  let blocked = 0, total = 0;
  for (let i = 0; i < 200; i++) {
    const ai = new AI('hard'), me = createFighter('sword', 560, -1), op = createFighter('sword', 500, 1);
    op.attack = { t: 0, aerial: false, hit: false };
    for (let t = 0; t < op.stats.startup; t += DT) { stepFighter(me, ai.update(DT, me, op, { layout: { traps: [] } }), DT, world); op.attack.t += DT; }
    total++; if (me.guard) blocked++;
  }
  assert.ok(blocked < total * 0.75, `${blocked}/${total}`);
  assert.ok(blocked > 0);
});
