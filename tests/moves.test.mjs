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
    const flips = WEAPONS[w].reach <= MAX_REACH / 2;
    assert.equal(f.doubled, flips || !!WEAPONS[w].airDash, w);   // the stag's second jump is a level dash
    assert.equal(f.vy < -500 && vy > -500, flips, w);
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

/* ---------- cross-up turn delay ---------- */
test('turn: after a cross-up the fighter turns after 0.5s, or at once on attack/guard', () => {
  const late = createFighter('sword', 400, 1); late.wantFacing = -1;
  step(late, NO_INPUT, 30);
  assert.equal(late.facing, 1, 'still facing the old way at 0.25s');
  step(late, NO_INPUT, 31);
  assert.equal(late.facing, -1, 'turned after 0.5s');
  for (const key of ['attack', 'guard']) {
    const f = createFighter('sword', 400, 1); f.wantFacing = -1;
    step(f, NO_INPUT, 5);
    step(f, { ...NO_INPUT, [key]: true });
    assert.equal(f.facing, -1, key);
    if (key === 'attack') assert.equal(f.attack.kind, 'normal', 'the attack goes toward the new side');
  }
});

/* ---------- charged attack ---------- */
const holdAttack = (f, secs) => { for (let t = 0; t < secs; t += DT) stepFighter(f, { ...NO_INPUT, attack: true }, DT, world); };

test('charged: holding attack chains a 0.5s charge after the first normal swing', () => {
  const f = createFighter('sword', 400, 1);
  const total = WEAPONS.sword.startup + WEAPONS.sword.active + WEAPONS.sword.recovery;
  holdAttack(f, DT);
  assert.equal(f.attack.kind, 'normal');
  holdAttack(f, total);
  assert.equal(f.attack.kind, 'charged');
  assert.equal(strike(f), null, 'no hit while charging');
  holdAttack(f, 0.5);
  assert.ok(strike(f), 'swings after the charge');
  // releasing during the charge cancels it
  const g = createFighter('sword', 400, 1);
  holdAttack(g, total + DT * 2);
  assert.equal(g.attack.kind, 'charged');
  step(g, NO_INPUT);
  assert.equal(g.attack, null);
  // a tap is just a normal attack
  const h = createFighter('sword', 400, 1);
  step(h, { ...NO_INPUT, attack: true }); step(h, NO_INPUT, 120);
  assert.equal(h.attack, null);
});

test('charged: breaks guard for half damage and +2 gauge to the guarder; full damage unguarded', () => {
  const att = createFighter('mace', 500, 1);
  att.attack = { t: 0.5 + 0.01, kind: 'charged', aerial: false, hit: false };
  const def = createFighter('sword', 560, -1); def.guard = def.guarding = true;
  const s = strike(att);
  const r = applyHit(att, def, s, never);
  assert.equal(r.damage, Math.round(WEAPONS.mace.power * 0.5));
  assert.equal(def.guard, false); assert.ok(def.stun > 0, 'guard broken');
  assert.equal(def.meter, 2);
  const open = createFighter('sword', 560, -1);
  assert.equal(applyHit(att, open, s, never).damage, WEAPONS.mace.power);
});

/* ---------- stag beetle ---------- */
test('stag: second jump dashes level in the travel direction, untouchable, no attack until its end', () => {
  const f = createFighter('stag', 400, 1);
  step(f, { ...NO_INPUT, jump: true }); step(f, NO_INPUT, 12);
  const y = f.y;
  step(f, { ...NO_INPUT, jump: true, left: true });
  assert.ok(f.airDash && f.airDash.dir === -1, 'dashes the way it is travelling');
  const x0 = f.x;
  step(f, { ...NO_INPUT, left: true }, 6);
  assert.ok(Math.abs(f.y - y) < 1, 'level flight');
  step(f, { ...NO_INPUT, attack: true });
  assert.equal(f.attack, null, 'no attack mid-dash');
  // untouchable while dashing
  const a = createFighter('spear', f.x + 60, -1);
  a.attack = { t: a.stats.startup + 0.01, kind: 'normal', aerial: false, hit: false }; a.y = f.y;
  assert.equal(resolveHits(a, f, never).length, 0);
  step(f, NO_INPUT, Math.round((0.26 - 0.05) / DT) - 8);
  step(f, NO_INPUT);
  step(f, { ...NO_INPUT, attack: true });
  assert.equal(f.attack?.kind, 'aerial', 'air attack allowed right before the dash ends');
  assert.ok(x0 - f.x > 120);
});
