import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFighter, stepFighter, NO_INPUT } from '../js/fighter.js';
import { resolveHits, strike } from '../js/combat.js';
import { Game } from '../js/game.js';
import { AI } from '../js/ai.js';
import { computeLayout } from '../js/layout.js';
import { moveList } from '../js/moves.js';
import {
  SUPERS, MAX_ENERGY, GROUND_Y, BODY_H, MAP_IDS, SUPER_MAX, SUPER_HOLD, SUPPLY_EVERY, SUPPLY_LINGER, RUSH_TIME, VIEW_W
} from '../js/config.js';

const DT = 1 / 120;
const W = { platforms: [], ice: false };
const never = () => 0.99;
const step = (f, input = NO_INPUT, n = 1) => { for (let i = 0; i < n; i++) stepFighter(f, input, DT, W); };
const run = (g, secs, ia = () => NO_INPUT, ib = () => NO_INPUT) => { for (let t = 0; t < secs - 1e-9; t += DT) g.update(DT, [ia(t), ib(t)]); };
function fight(w1, w2, extra = {}) {
  const g = new Game({ mode: '2p', weapons: [w1, w2], map: 'seoul', wins: 3, time: 99, seed: 2, rand: never, ...extra });
  g.update(2, [NO_INPUT, NO_INPUT]); g.layout.traps = [];
  return g;
}

test('touch: each touch player gets a D-pad plus attack and guard (no jump button, no ◀ ▶)', () => {
  for (const [Wd, H] of [[844, 390], [1180, 820], [1920, 1080], [390, 844]]) for (const players of [1, 2]) {
    const L = computeLayout(Wd, H, { players });
    for (let p = 0; p < players; p++) assert.deepEqual(L.buttons.filter(b => b.player === p).map(b => b.action).sort(), ['attack', 'dpad', 'guard']);
  }
});

test('touch: a slide across action buttons holds both', async () => {
  globalThis.addEventListener ??= () => {};
  const { InputManager } = await import('../js/input.js');
  const im = new InputManager();
  im.pointers.set(7, { player: 0, actions: new Set(['attack', 'guard']) });
  const s = im.read(0);
  assert.ok(s.attack && s.guard);
});

test('ai: backs off now and then — easy about 70% of the ~20s checks, hard about 30%', () => {
  const tries = (level, roll) => {
    let n = 0;
    for (let k = 0; k < 400; k++) {
      // the 2nd random draw is the backoff roll
      const ai = new AI(level, () => 0.5);
      // after construction: the 1st draw re-arms the ~20s clock, the 2nd is the backoff roll
      let i = 0; ai.rand = () => (i++ === 1 ? roll(k) : 0.5);
      ai.backoffClock = 0; ai.update(DT, createFighter('sword', 400, 1), createFighter('sword', 500, -1), { layout: { traps: [] }, cam: 320 });
      if (ai.retreat > 0) n++;
    }
    return n / 400;
  };
  const uniform = k => (k + 0.5) / 400;
  assert.ok(Math.abs(tries('easy', uniform) - 0.7) < 0.02);
  assert.ok(Math.abs(tries('hard', uniform) - 0.3) < 0.02);
  // while retreating it walks away from the opponent
  const ai = new AI('easy', () => 0.5); ai.retreat = 1.5; ai.cool = 0;
  const me = createFighter('sword', 400, 1), op = createFighter('sword', 520, -1);
  const inp = ai.update(DT, me, op, { layout: { traps: [] }, cam: 320 });
  assert.ok(inp.left && !inp.right);
});

test('traps: every map has 8 frames (4x the old 2)', () => {
  const theme = JSON.parse(readFileSync(new URL('../themes/classic/theme.json', import.meta.url)));
  for (const id of MAP_IDS) assert.equal(theme.maps[id].trap.frames, 8, id);
});

test('spear super: 1.5x further, climbing to about 0.8 body heights at the end', () => {
  const f = createFighter('spear', 300, 1);
  f.meter = SUPER_MAX;
  step(f, { ...NO_INPUT, attack: true, guard: true }, Math.ceil(SUPER_HOLD / DT) + 1);
  const x0 = f.x;
  let top = 0;
  const [from, to] = SUPERS.spear.dash[0];
  while (f.super && f.super.t < to - DT) { step(f); top = Math.max(top, GROUND_Y - f.y); }
  assert.ok(Math.abs(f.x - x0 - 405) < 20, `distance ${f.x - x0}`);
  assert.ok(Math.abs(top - 0.8 * BODY_H) < 6, `height ${top}`);
  step(f, NO_INPUT, 120);
  assert.equal(f.onGround, true, 'comes back down');
});

test('genghis: forward double-tap + hold rushes 240px; only supers and air attacks hurt meanwhile', () => {
  const R = { ...NO_INPUT, right: true };
  const f = createFighter('genghis', 300, 1);
  step(f, R, 3); step(f, NO_INPUT, 6); step(f, R); step(f, R, Math.ceil(0.1 / DT) + 1);
  assert.ok(f.rush, 'rushing');
  const x0 = f.x;
  step(f, R, Math.ceil(RUSH_TIME / DT));
  assert.ok(f.x - x0 > 200, `${f.x - x0}`);
  // a ground attack does nothing during the rush, an air attack does
  for (const aerial of [false, true]) {
    const g = createFighter('genghis', 500, 1), a = createFighter('sword', 560, -1);
    g.rush = { t: 0, dir: 1 };
    a.attack = { t: a.stats.startup + 0.01, kind: aerial ? 'aerial' : 'normal', aerial, hit: false };
    if (aerial) { a.onGround = false; a.y = GROUND_Y - 30; }
    assert.equal(resolveHits(a, g, never).length, aerial ? 1 : 0, aerial ? 'air attack' : 'ground attack');
  }
  assert.ok(moveList('genghis').rows.some(r => r.name === '기마 돌진'));
});

test('supply: off by default; every 20s a drop falls in view, lands, heals 10% on touch', () => {
  const off = fight('sword', 'axe');
  run(off, SUPPLY_EVERY + 1);
  assert.equal(off.items.length, 0);
  const g = fight('sword', 'axe', { supply: 'on' }), [a, b] = g.fighters;
  a.x = 200; b.x = 1100; g.cam = 0; a.energy = 150;
  run(g, SUPPLY_EVERY + DT);
  assert.equal(g.items.length, 1);
  const it = g.items[0];
  assert.ok(it.x >= g.cam && it.x <= g.cam + VIEW_W, 'inside the view');
  run(g, 6, () => NO_INPUT);
  assert.equal(it.state, 'land');
  assert.equal(it.y, GROUND_Y);
  a.x = it.x; run(g, DT * 2);
  assert.equal(a.energy, 150 + MAX_ENERGY * 0.1);
  assert.equal(g.items.length, 0);
});

test('supply: lands on a platform, blinks 2s and vanishes; x2 makes every second drop a 20% one', () => {
  const g = fight('sword', 'axe', { supply: 'x2' }), [a, b] = g.fighters;
  a.x = 100; b.x = 1200; g.cam = 0;
  g.layout.platforms = [{ x: 0, y: GROUND_Y - 80, w: 640 }];
  run(g, SUPPLY_EVERY + DT, () => { a.x = 100; b.x = 1200; return NO_INPUT; });
  run(g, 4, () => { a.x = 100; b.x = 1200; return NO_INPUT; });
  const first = g.items[0];
  assert.equal(first.y, GROUND_Y - 80, 'resting on the platform');
  assert.equal(first.big, false);
  run(g, SUPPLY_LINGER + 0.1, () => { a.x = 100; b.x = 1200; return NO_INPUT; });
  assert.equal(g.items.length, 0, 'vanished after blinking');
  // the next drop is the big one
  for (let t = 0; t < SUPPLY_EVERY + 1 && !g.items.length; t += DT) { a.x = 100; b.x = 1200; g.update(DT, [NO_INPUT, NO_INPUT]); }
  assert.equal(g.items[0].big, true);
  assert.equal(g.items[0].heal, MAX_ENERGY * 0.2);
});
