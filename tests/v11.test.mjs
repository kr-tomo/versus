import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFighter, stepFighter, attackTiming, NO_INPUT } from '../js/fighter.js';
import { strike, applyHit, hitbox, canParry } from '../js/combat.js';
import { Game } from '../js/game.js';
import { moveList } from '../js/moves.js';
import { computeLayout } from '../js/layout.js';
import { generateMap, validateMap } from '../js/mapgen.js';
import {
  WEAPONS, WEAPON_IDS, SUPERS, MAPS, MAP_IDS, CHARGE_TIME, GUN_LOAD, MAX_ENERGY, GROUND_Y, BODY_H, MAX_REACH, MAX_POWER,
  ARROW_SPEED, BULLET_SPEED, BULLET_RANGE, PARRY_WINDOW, PARRY_FREEZE, HOLD_HASTE, AIR_LASH_REACH, REEL_DIST, SUPER_MAX, SUPER_HOLD,
  APP_VERSION, canDoubleJump
} from '../js/config.js';

const DT = 1 / 120;
const W = { platforms: [], ice: false };
const never = () => 0.99;
const step = (f, input = NO_INPUT, n = 1, world = W) => { for (let i = 0; i < n; i++) stepFighter(f, input, DT, world); };
const total = w => WEAPONS[w].startup + WEAPONS[w].active + WEAPONS[w].recovery;
function setup(w1 = 'sword', w2 = 'sword', map = 'seoul') {
  const g = new Game({ mode: '2p', weapons: [w1, w2], map, wins: 3, time: 90, seed: 2, rand: never });
  g.update(2, [NO_INPUT, NO_INPUT]);
  g.layout.traps = [];
  const [a, b] = g.fighters;
  a.x = 600; b.x = 660;
  return g;
}
const run = (g, secs, ia = () => NO_INPUT, ib = () => NO_INPUT) => { for (let t = 0; t < secs - 1e-9; t += DT) g.update(DT, [ia(t), ib(t)]); };

test('v11: version bumped on the title and in the service worker cache', () => {
  assert.equal(APP_VERSION, 'v11');
  assert.match(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), /versus-v11/);
});

/* ---------- charge ---------- */
test('charge: 0.3s for everyone (the archer\'s bow too); the revolver loads a bit longer', () => {
  assert.equal(CHARGE_TIME, 0.3);
  for (const w of WEAPON_IDS) {
    const f = createFighter(w, 400, 1);
    f.attack = { t: 0, kind: 'charged', aerial: false, hit: false };
    assert.equal(attackTiming(f).startup, WEAPONS[w].gun ? GUN_LOAD : 0.3, w);
  }
  assert.ok(GUN_LOAD > CHARGE_TIME);
  const src = readFileSync(new URL('../js/stage.js', import.meta.url), 'utf8');
  assert.match(src, /'chargeUp'/, 'charge sound is back');
  assert.match(src, /fx-aura/, 'yellow gathering glow is back');
});

/* ---------- parry ---------- */
test('parry: a fresh guard press within 0.1s before the confirm → no damage, the attacker freezes 0.2s', () => {
  const g = setup(), [a, b] = g.fighters;
  g.update(DT, [{ ...NO_INPUT, attack: true }, NO_INPUT]);   // contact at 0.15s, confirmed at 0.20s
  run(g, 0.13);
  run(g, 0.2, () => NO_INPUT, () => ({ ...NO_INPUT, guard: true }));   // pressed ~0.07s before the confirm
  assert.equal(b.energy, MAX_ENERGY);
  assert.ok(g.effects.some(e => e.type === 'parry'));
  assert.equal(a.attack, null);
  const frozen = createFighter('sword', 400, 1), def = createFighter('sword', 460, -1);
  frozen.attack = { t: 0.16, kind: 'normal', aerial: false, hit: false };
  def.guardPressT = def.t;
  const r = applyHit(frozen, def, strike(frozen), never, { parry: true });
  assert.equal(r.parried, true);
  assert.equal(frozen.stun, PARRY_FREEZE); assert.equal(frozen.frozen, PARRY_FREEZE);
  assert.equal(PARRY_WINDOW, 0.1);
});

test('parry: pressing earlier than 0.1s, or just holding guard, is a normal guard', () => {
  // pressed 0.17s before the confirm and held: an ordinary guard (1 damage)
  const g = setup(), [, b] = g.fighters;
  g.update(DT, [{ ...NO_INPUT, attack: true }, NO_INPUT]);
  run(g, 0.03);
  run(g, 0.3, () => NO_INPUT, () => ({ ...NO_INPUT, guard: true }));
  assert.equal(b.energy, MAX_ENERGY - 1);
  assert.ok(g.effects.some(e => e.type === 'guard') && !g.effects.some(e => e.type === 'parry'));
  // held guard from the start
  const h = setup(), [, d] = h.fighters;
  h.update(DT, [{ ...NO_INPUT, attack: true }, { ...NO_INPUT, guard: true }]);
  run(h, 0.3, () => NO_INPUT, () => ({ ...NO_INPUT, guard: true }));
  assert.equal(d.energy, MAX_ENERGY - 1);
  assert.ok(!h.effects.some(e => e.type === 'parry'));
});

test('parry: supers, unblockable hits and grabs go through', () => {
  const def = createFighter('sword', 460, -1);
  def.guardPressT = def.t;
  assert.equal(canParry(def, { dmg: 5 }), true);
  for (const s of [{ dmg: 5, super: true }, { dmg: 5, ub: true }, { dmg: 5, grab: true }]) assert.equal(canParry(def, s), false, JSON.stringify(s));
  def.guardPressT = def.t - PARRY_WINDOW - 0.01;
  assert.equal(canParry(def, { dmg: 5 }), false, 'too early');
});

/* ---------- sword ---------- */
test('sword: no more vertical drop — a high air attack is a normal air attack', () => {
  assert.equal(WEAPONS.sword.plunge, undefined);
  const f = createFighter('sword', 400, 1);
  f.y = GROUND_Y - BODY_H * 2.5; f.onGround = false; f.vy = 0;
  step(f, { ...NO_INPUT, attack: true });
  assert.equal(f.attack.kind, 'aerial');
  assert.ok(!moveList('sword').rows.some(r => /내려찍기/.test(r.name)));
  const theme = JSON.parse(readFileSync(new URL('../themes/classic/theme.json', import.meta.url)));
  assert.ok(!('plunge' in theme.characters.sword.frames));
});

test('sword: the hold attack takes no damage at all (supers still hurt)', () => {
  const att = createFighter('axe', 500, 1), def = createFighter('sword', 560, -1);
  step(def, { ...NO_INPUT, right: true, attack: true });   // back = away from the opponent on the left
  assert.equal(def.attack.kind, 'heavy');
  const r = applyHit(att, def, undefined, never);
  assert.equal(r.armored, true); assert.equal(r.damage, 0);
  assert.equal(def.energy, MAX_ENERGY);
  assert.ok(def.attack, 'keeps swinging');
  applyHit(att, def, { dmg: 10, kb: 0, stun: 0.3, super: true, index: 0 }, never);
  assert.equal(def.energy, MAX_ENERGY - 10);
  // other heavy attackers still take the damage
  const m = createFighter('mace', 560, -1); step(m, { ...NO_INPUT, right: true, attack: true });
  applyHit(att, m, undefined, never);
  assert.equal(m.energy, MAX_ENERGY - WEAPONS.axe.power);
});

test('sword: after a hold attack lands, the next attack (only) is 1.5x faster', () => {
  const g = setup(), [a, b] = g.fighters;
  b.x = 650;
  g.update(DT, [{ ...NO_INPUT, left: true, attack: true }, NO_INPUT]);
  assert.equal(a.attack.kind, 'heavy');
  run(g, 0.6);
  assert.ok(b.energy < MAX_ENERGY, 'hold attack landed');
  assert.equal(a.haste, true);
  const timeOf = f => { let n = 0; step(f, { ...NO_INPUT, attack: true }); while (f.attack && n < 400) { step(f); n++; } return (n + 1) * DT; };
  const fast = timeOf(a), slow = timeOf(a);
  assert.equal(HOLD_HASTE, 1.5);
  assert.ok(Math.abs(fast - total('sword') / 1.5) < 0.02, `${fast}`);
  assert.ok(Math.abs(slow - total('sword')) < 0.02, `${slow}`);
  // a guarded hold attack doesn't count
  const s = createFighter('sword', 400, 1), d = createFighter('sword', 460, -1);
  s.attack = { t: 0.2, kind: 'heavy', aerial: false, hit: false }; d.guard = true;
  applyHit(s, d, strike(s), never);
  assert.ok(!s.haste);
});

/* ---------- cowboy ---------- */
test('cowboy: reach 3/4 of the longest, power 2/5 of the highest, speed 3/5 of the fastest', () => {
  const st = WEAPONS.whip, others = WEAPON_IDS.filter(w => w !== 'whip');
  const maxReach = Math.max(...others.map(w => WEAPONS[w].reach)), maxPower = Math.max(...others.map(w => WEAPONS[w].power));
  const fastest = Math.min(...others.map(total));
  assert.equal(st.reach, maxReach * 3 / 4);
  assert.ok(Math.abs(st.power - maxPower * 2 / 5) < 1e-9);
  assert.ok(Math.abs(fastest / total('whip') - 3 / 5) < 1e-9);
  assert.equal(MAX_REACH, maxReach); assert.equal(MAX_POWER, maxPower);
  assert.ok(canDoubleJump('whip'));
  // no hold attack: back + attack is a plain whip swing
  const f = createFighter('whip', 400, 1);
  step(f, { ...NO_INPUT, left: true, attack: true });
  assert.equal(f.attack.kind, 'normal');
  assert.ok(!moveList('whip').rows.some(r => r.kind === '버티기 공격'));
});

test('cowboy: the revolver flies level at arrow speed for 3.5 body heights, then drops', () => {
  assert.equal(BULLET_SPEED, ARROW_SPEED);
  const g = setup('whip', 'sword'), [a, b] = g.fighters;
  a.x = 400; b.x = 400 + BULLET_RANGE * BODY_H + 60;   // just out of range
  g.cam = 300;
  let shot = null, t = 0;
  for (; t < 2 && !shot; t += DT) { g.update(DT, [{ ...NO_INPUT, attack: true }, NO_INPUT]); shot = g.projectiles.find(p => p.type === 'bullet'); }
  assert.ok(shot, 'fired');
  assert.ok(t >= total('whip') + GUN_LOAD - 0.02, 'loads longer than the bow');
  const y0 = shot.y, x0 = shot.x0;
  let flightT = 0;
  while (!shot.dropping && flightT < 2) { g.update(DT, [NO_INPUT, NO_INPUT]); flightT += DT; assert.equal(shot.y, y0, 'level flight'); }
  assert.ok(Math.abs(Math.abs(shot.x - x0) - BULLET_RANGE * BODY_H) < 1e-6);
  assert.ok(Math.abs(flightT - BULLET_RANGE * BODY_H / BULLET_SPEED) < 0.02);
  while (g.projectiles.includes(shot)) g.update(DT, [NO_INPUT, NO_INPUT]);
  assert.ok(Math.abs(shot.x - (x0 + BULLET_RANGE * BODY_H)) < 30, 'dropped right there');
  assert.equal(b.energy, MAX_ENERGY, 'spent bullet is harmless');
  // in range it hits for 1.5x and breaks the guard like any charged attack
  const h = setup('whip', 'sword'), [c, d] = h.fighters;
  c.x = 400; d.x = 600; h.cam = 300;
  run(h, 1.5, () => ({ ...NO_INPUT, attack: true }));
  assert.equal(d.energy, MAX_ENERGY - Math.round(WEAPONS.whip.power * 1.5));
});

test('cowboy: back double-tap + hold reels him back 2 body heights fast, with a cooldown', () => {
  const reel = (w, facing) => {
    const f = createFighter(w, 640, facing), back = facing > 0 ? { ...NO_INPUT, left: true } : { ...NO_INPUT, right: true };
    step(f, back, 3); step(f, NO_INPUT, 6);
    let i = 0;
    while (!f.reel && i++ < 40) step(f, back);
    if (!f.reel) return null;
    const x0 = f.x;
    let n = 0;
    while (f.reel) { step(f, back); n++; }
    return { d: (f.x - x0) * -facing, t: n * DT, f };
  };
  for (const facing of [1, -1]) {
    const r = reel('whip', facing);
    assert.ok(r, 'reels');
    assert.ok(Math.abs(r.d - REEL_DIST * BODY_H) < 4, `${r.d}`);
    assert.ok(r.t <= 0.21, 'quick');
    assert.ok(r.f.reelCD > 0, 'cooldown');
  }
  assert.equal(reel('sword', 1), null, 'other fighters only walk back');
  assert.ok(moveList('whip').rows.some(r => r.name === '갈고리 후퇴'));
});

test('cowboy: double-jump attack stops in mid-air and lashes 45° down-forward with 1.5x reach', () => {
  const f = createFighter('whip', 400, 1);
  step(f, { ...NO_INPUT, jump: true }); step(f, NO_INPUT, 20); step(f, { ...NO_INPUT, jump: true }); step(f, NO_INPUT, 10);
  assert.ok(f.doubled);
  step(f, { ...NO_INPUT, attack: true });
  assert.equal(f.attack.kind, 'airLash');
  const y = f.y;
  let s = null;
  for (let i = 0; i < 100 && !s; i++) { step(f); assert.equal(f.y, y, 'hangs in the air'); s = strike(f); }
  assert.ok(Math.abs(s.reach - WEAPONS.whip.reach * AIR_LASH_REACH) < 1e-9);
  const hb = hitbox(f, s), [x0, y0, x1, y1] = hb.seg;
  assert.ok(Math.abs((x1 - x0) - (y1 - y0)) < 1e-9 && x1 > x0, '45° down-forward');
  assert.ok(Math.abs(Math.hypot(x1 - x0, y1 - y0) - WEAPONS.whip.reach * 1.5) < 1e-9);
  // only once per double jump: the next one is an ordinary air attack
  while (f.attack) step(f);
  step(f, { ...NO_INPUT, attack: true });
  assert.equal(f.attack?.kind, 'aerial');
});

test('cowboy super: lassoes an opponent within 2.5 body heights (any direction), pulls him in and whips him', () => {
  assert.equal(SUPERS.whip.lasso.radius, 2.5 * BODY_H);
  const fire = (dx, dy) => {
    const g = setup('whip', 'sword'), [a, b] = g.fighters;
    a.x = 640; b.x = 640 + dx; g.cam = 320; a.meter = SUPER_MAX;
    if (dy) { b.y = GROUND_Y - dy; b.onGround = false; }
    run(g, SUPER_HOLD + 0.02, () => ({ ...NO_INPUT, attack: true, guard: true }));
    const at = a.x;
    if (dy) for (let t = 0; t < 0.12; t += DT) { b.y = GROUND_Y - dy; b.vy = 0; g.update(DT, [NO_INPUT, NO_INPUT]); }
    run(g, 2);
    return { a, b, at };
  };
  const near = fire(-150);                 // behind him, inside the radius
  assert.ok(near.a.super === null);
  assert.ok(MAX_ENERGY - near.b.energy >= 8 * 3 + 14 - 1, `${MAX_ENERGY - near.b.energy}`);
  const far = fire(230);                    // outside
  assert.equal(far.b.energy, MAX_ENERGY);
  const high = fire(60, 120);               // up in the air in front
  assert.ok(high.b.energy < MAX_ENERGY);
});

/* ---------- maps ---------- */
test('maps: savanna (crocodile swamp), traditional market (fish-shop crab), moon base (radiation)', () => {
  assert.equal(MAPS.savanna.trap, '악어 늪');
  assert.equal(MAPS.market.trap, '생선가게 대게');
  assert.equal(MAPS.moon.trap, '방사능 지역');
  assert.equal(MAPS.savanna.trapEvent, 'bite'); assert.equal(MAPS.market.trapEvent, 'pinch');
  assert.ok(MAPS.moon.gravity < 1);
  const theme = JSON.parse(readFileSync(new URL('../themes/classic/theme.json', import.meta.url)));
  for (const id of ['savanna', 'market', 'moon']) {
    assert.ok(theme.maps[id]?.trap.sheet, id);
    for (let seed = 1; seed < 40; seed++) assert.deepEqual(validateMap(generateMap(id, seed)), [], `${id} ${seed}`);
  }
  assert.equal(MAP_IDS.length, 11);
});

test('maps: stepping into the swamp / fish shop sets the trap off once and hurts over time', () => {
  for (const [map, ev] of [['savanna', 'bite'], ['market', 'pinch'], ['library', 'scold']]) {
    const g = new Game({ mode: '2p', weapons: ['sword', 'sword'], map, wins: 3, time: 90, seed: 3, rand: never });
    g.update(2, [NO_INPUT, NO_INPUT]);
    const [a] = g.fighters, t = g.layout.traps[0];
    a.x = t.x + t.w / 2;
    run(g, 1);
    assert.equal(g.effects.filter(e => e.type === ev).length + (a.energy < MAX_ENERGY ? 0 : 99), 1, map);
    assert.ok(a.energy < MAX_ENERGY, map);
  }
});

test('maps: lower gravity on the moon lets you jump higher', () => {
  const peak = world => { const f = createFighter('sword', 400, 1); let top = f.y; step(f, { ...NO_INPUT, jump: true }, 1, world); for (let i = 0; i < 200; i++) { step(f, NO_INPUT, 1, world); top = Math.min(top, f.y); } return GROUND_Y - top; };
  assert.ok(peak({ ...W, gravity: MAPS.moon.gravity }) > peak(W) * 1.2);
});

/* ---------- touch layout ---------- */
test('layout: touch buttons only for players that need them; none → the view fills the space', () => {
  // a 16:9 screen (phone / laptop): the buttons take room the view gets back when they go
  const both = computeLayout(1280, 720, { players: 2 });
  const p2only = computeLayout(1280, 720, { players: 2, touch: [1] });
  const none = computeLayout(1280, 720, { players: 2, touch: [] });
  assert.equal(both.buttons.length, 10);
  assert.equal(p2only.buttons.length, 5);
  assert.ok(p2only.buttons.every(b => b.player === 1));
  assert.equal(none.buttons.length, 0);
  assert.ok(none.view.w > p2only.view.w && p2only.view.w >= both.view.w);
  assert.equal(none.view.w, 1280); assert.equal(none.view.h, 720);
  const cpu = computeLayout(1280, 720, { players: 1, touch: [] });
  assert.equal(cpu.buttons.length, 0);
});

test('move list: the touch popup has a close button and scrolls by drag', () => {
  const src = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.match(src, /ml-close/);
  assert.match(src, /e\.detail > 0 && settings\.weapons\[p\] === b\.dataset\.w/);
  for (const w of WEAPON_IDS) assert.ok(moveList(w).rows.some(r => r.name === '패링'), w);
});
