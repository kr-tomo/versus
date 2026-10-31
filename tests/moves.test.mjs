import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFighter, stepFighter, attackTiming, frameName, NO_INPUT } from '../js/fighter.js';
import { strike, applyHit, resolveHits } from '../js/combat.js';
import {
  WEAPONS, WEAPON_IDS, MAX_REACH, MAX_ENERGY, LONG_ATTACK_SLOW, LONG_REACH_BONUS, HEAVY_REACH,
  JUMP_ATTACK_MULT, GROUND_Y, canDoubleJump
} from '../js/config.js';

const DT = 1 / 120;
const world = { platforms: [], ice: false };
const always = () => 0, never = () => 0.99;
const step = (f, input = NO_INPUT, n = 1) => { for (let i = 0; i < n; i++) stepFighter(f, input, DT, world); };
const attackWith = (w, held) => { const f = createFighter(w, 400, 1); step(f, { ...NO_INPUT, ...held, attack: true }); return f; };

test('air evade: depends on the defender being airborne, not on the attack', () => {
  const a = createFighter('sword', 500, 1);
  const air = createFighter('sword', 560, -1); air.onGround = false;
  const ground = createFighter('sword', 560, -1);
  // the same ground attack is dodged in the air and lands on the ground
  assert.equal(applyHit(a, air, undefined, always).evaded, true);
  assert.equal(applyHit(a, ground, undefined, always).evaded, false);
  // an airborne fighter in the middle of its own air attack still gets the evade
  const swinging = createFighter('sword', 560, -1); swinging.onGround = false;
  swinging.attack = { t: 0, kind: 'aerial', aerial: true, hit: false };
  assert.equal(applyHit(a, swinging, undefined, always).evaded, true);
});

test('long attack: walking forward, 1.2x slower, reach + half the average stride, keeps advancing', () => {
  const f = attackWith('sword', { right: true });
  assert.equal(f.attack.kind, 'long');
  const n = WEAPONS.sword, t = attackTiming(f);
  assert.ok(Math.abs(t.startup - n.startup * LONG_ATTACK_SLOW) < 1e-9 && Math.abs(t.recovery - n.recovery * LONG_ATTACK_SLOW) < 1e-9);
  const x0 = f.x;
  while (!strike(f)) step(f);
  assert.equal(strike(f).reach, n.reach + LONG_REACH_BONUS);
  assert.ok(f.x - x0 > 20, 'steps forward during the long attack');
  // same bonus for every fighter
  for (const w of WEAPON_IDS) { const g = attackWith(w, { right: true }); while (!strike(g)) step(g); assert.equal(strike(g).reach - WEAPONS[w].reach, LONG_REACH_BONUS, w); }
  // standing still is a normal attack
  assert.equal(attackWith('sword', {}).attack.kind, 'normal');
});

test('long attack: connects where a normal attack falls short', () => {
  const hits = held => {
    const a = createFighter('sword', 400, 1), b = createFighter('sword', 400 + 28 + WEAPONS.sword.reach + 12, -1);
    step(a, { ...NO_INPUT, ...held, attack: true });
    let n = 0;
    for (let i = 0; i < 90; i++) { step(a, held.right ? { ...NO_INPUT, right: true } : NO_INPUT); n += resolveHits(a, b, never).length; }
    return n;
  };
  assert.equal(hits({}), 0);
  assert.equal(hits({ right: true }), 1);
});

test('heavy attack: only long-reach fighters, walking backward, shorter reach, same damage', () => {
  for (const w of WEAPON_IDS) {
    const f = attackWith(w, { left: true });
    assert.equal(f.attack.kind, canDoubleJump(w) ? 'normal' : 'heavy', w);
  }
  const f = attackWith('spear', { left: true });
  while (!strike(f)) step(f, { ...NO_INPUT, left: true });
  assert.equal(strike(f).reach, WEAPONS.spear.reach * HEAVY_REACH);
  assert.equal(strike(f).dmg, WEAPONS.spear.power);
});

test('heavy attack: armor takes damage without knockback or interruption', () => {
  const att = createFighter('sword', 500, 1), def = attackWith('spear', { left: true });
  def.x = 560; def.facing = -1; def.attack.kind = 'heavy';
  const r = applyHit(att, def, undefined, never);
  assert.equal(r.damage, WEAPONS.sword.power);
  assert.equal(def.energy, MAX_ENERGY - WEAPONS.sword.power);
  assert.equal(def.kb, 0);
  assert.equal(def.stun, 0);
  assert.ok(def.attack, 'keeps swinging');
  // a normal attack is interrupted as before
  const plain = attackWith('spear', {});
  applyHit(att, plain, undefined, never);
  assert.equal(plain.attack, null);
});

test('double jump: only fighters with reach at most half the longest', () => {
  for (const w of WEAPON_IDS) {
    const f = createFighter(w, 400, 1);
    step(f, { ...NO_INPUT, jump: true }); step(f, NO_INPUT, 20);
    const vy = f.vy;
    step(f, { ...NO_INPUT, jump: true });
    assert.equal(f.doubled, WEAPONS[w].reach <= MAX_REACH / 2, w);
    assert.equal(f.vy < -500 && vy > -500, f.doubled, w);
  }
  // only once per jump, and it resets on landing
  const f = createFighter('fist', 400, 1);
  step(f, { ...NO_INPUT, jump: true }); step(f, NO_INPUT, 10); step(f, { ...NO_INPUT, jump: true }); step(f, NO_INPUT, 2);
  const vy = f.vy; step(f, { ...NO_INPUT, jump: true });
  assert.ok(f.vy > vy, 'no triple jump');
  step(f, NO_INPUT, 200);
  assert.equal(f.onGround, true); assert.equal(f.doubled, false);
});

test('dive: attack during a double jump drives 45° into the ground with aerial damage', () => {
  const f = createFighter('fist', 400, 1);
  step(f, { ...NO_INPUT, jump: true }); step(f, NO_INPUT, 10); step(f, { ...NO_INPUT, jump: true }); step(f, NO_INPUT, 4);
  assert.equal(frameName(f), 'flip');
  step(f, { ...NO_INPUT, attack: true });
  assert.equal(f.attack.kind, 'dive');
  step(f, NO_INPUT, 8);
  assert.ok(Math.abs(Math.abs(f.vx) - f.vy) < 1e-6 && f.vx > 0 && f.vy > 0, '45° down-forward');
  assert.equal(strike(f).dmg, Math.round(WEAPONS.fist.power * JUMP_ATTACK_MULT));
  step(f, NO_INPUT, 200);
  assert.equal(f.y, GROUND_Y);
  assert.equal(f.attack, null, 'short landing recovery, then done');
});

test('frames: twice the old count, every frame the game asks for exists in each sprite sheet', () => {
  const theme = JSON.parse(readFileSync(new URL('../themes/classic/theme.json', import.meta.url)));
  const names = ['idle0', 'idle01', 'idle1', 'idle10', 'walk0', 'walk01', 'walk1', 'walk12', 'walk2', 'walk23', 'walk3', 'walk30',
    'windup0', 'windup', 'attack', 'attack1', 'guard0', 'guard', 'airGuard', 'jump', 'apex', 'fall', 'jumpAtk0', 'jumpAtk',
    'hit', 'hit0', 'win', 'win0', 'longWind', 'longAtk0', 'longAtk', 'heavyWind', 'heavyAtk0', 'heavyAtk', 'flip', 'dive'];
  for (const w of WEAPON_IDS) {
    const frames = theme.characters[w].frames;
    assert.ok(Object.keys(frames).length >= 30, w);
    for (const n of names) assert.ok(n in frames, `${w} ${n}`);
  }
});
