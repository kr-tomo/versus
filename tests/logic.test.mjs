import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, ASPECT } from '../js/layout.js';
import { generateMap, validateMap } from '../js/mapgen.js';
import { constrainCamera } from '../js/camera.js';
import { createFighter, stepFighter, NO_INPUT } from '../js/fighter.js';
import { applyHit, resolveHits } from '../js/combat.js';
import { Game } from '../js/game.js';
import { MAP_IDS, VIEW_W, WORLD_W, CAMERA_MARGIN, GROUND_Y, MAX_ENERGY, WEAPONS, JUMP_V, GRAVITY } from '../js/config.js';

const SCREENS = [[844, 390], [667, 375], [932, 430], [1180, 820], [1366, 1024], [1920, 1080], [390, 844], [820, 1180], [1024, 600]];
const near = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;

test('layout: 16:9 view, buttons on screen, no overlap with view or each other', () => {
  for (const [W, H] of SCREENS) for (const players of [1, 2]) {
    const L = computeLayout(W, H, { players });
    const v = L.view, tag = `${W}x${H} ${players}P ${L.mode}`;
    assert.ok(near(v.w / v.h, ASPECT, 0.01), tag);
    assert.ok(v.x >= -0.5 && v.y >= -0.5 && v.x + v.w <= W + 0.5 && v.y + v.h <= H + 0.5, tag);
    for (const b of L.buttons) {
      assert.ok(b.x - b.r >= 0 && b.x + b.r <= W && b.y - b.r >= 0 && b.y + b.r <= H, `${tag} ${b.action} off screen`);
      const inX = b.x + b.r > v.x && b.x - b.r < v.x + v.w, inY = b.y + b.r > v.y && b.y - b.r < v.y + v.h;
      assert.ok(!(inX && inY), `${tag} ${b.action} overlaps view`);
    }
    L.buttons.forEach((a, i) => L.buttons.slice(i + 1).forEach(b => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r - 0.5, `${tag} ${a.action}/${b.action} overlap`)));
    assert.equal(L.buttons.length, players * 5, tag);
  }
});

test('layout: P1 controls left of P2 controls, never stacked top/bottom', () => {
  for (const [W, H] of SCREENS) {
    const L = computeLayout(W, H, { players: 2 });
    const p1 = L.buttons.filter(b => b.player === 0), p2 = L.buttons.filter(b => b.player === 1);
    assert.ok(Math.max(...p1.map(b => b.x)) < Math.min(...p2.map(b => b.x)), `${W}x${H}`);
    assert.ok(p1.every(b => b.x < W / 2) && p2.every(b => b.x > W / 2), `${W}x${H}`);
  }
});

test('layout: wide phones use side gutters, 4:3 tablets use bottom', () => {
  assert.equal(computeLayout(844, 390).mode, 'side');
  assert.equal(computeLayout(932, 430).mode, 'side');
  assert.equal(computeLayout(1180, 820).mode, 'bottom');
  assert.equal(computeLayout(390, 844).mode, 'bottom');
});

test('mapgen: layouts are valid and vary by seed', () => {
  for (const id of MAP_IDS) {
    const seen = new Set();
    for (let seed = 1; seed <= 300; seed++) {
      const m = generateMap(id, seed);
      assert.deepEqual(validateMap(m), [], `${id} seed ${seed}`);
      seen.add(JSON.stringify(m));
    }
    assert.ok(seen.size > 250, `${id} variety`);
    assert.deepEqual(generateMap(id, 42), generateMap(id, 42));
  }
});

test('mapgen: every platform is reachable by a jump', () => {
  const apex = JUMP_V * JUMP_V / (2 * GRAVITY);
  for (const id of MAP_IDS) for (let seed = 1; seed < 100; seed++)
    for (const p of generateMap(id, seed).platforms) assert.ok(GROUND_Y - p.y < apex - 20);
});

test('camera: follows a fighter pushing the edge', () => {
  const a = { x: 400 }, b = { x: 960 };
  const cam = constrainCamera(320, a, b);
  assert.ok(cam > 320);
  assert.ok(b.x <= cam + VIEW_W - CAMERA_MARGIN);
});

test('camera: blocked when the other fighter is pinned at the opposite edge', () => {
  const a = { x: 320 + CAMERA_MARGIN }, b = { x: 320 + VIEW_W - CAMERA_MARGIN + 10 };
  const cam = constrainCamera(320, a, b);
  assert.equal(cam, 320);
  assert.equal(b.x, 320 + VIEW_W - CAMERA_MARGIN);
  assert.equal(a.x, 320 + CAMERA_MARGIN);
});

test('camera: clamped to world bounds', () => {
  const a = { x: 2 }, b = { x: 100 };
  assert.equal(constrainCamera(0, a, b), 0);
  assert.equal(a.x, CAMERA_MARGIN);
  const c = { x: WORLD_W + 50 }, d = { x: WORLD_W - 200 };
  assert.equal(constrainCamera(WORLD_W - VIEW_W, c, d), WORLD_W - VIEW_W);
  assert.equal(c.x, WORLD_W - CAMERA_MARGIN);
});

test('combat: hit deals power damage and knockback proportional to damage', () => {
  const a = createFighter('axe', 500, 1), b = createFighter('fist', 560, -1);
  const r = applyHit(a, b);
  assert.equal(r.damage, 20);
  assert.equal(b.energy, MAX_ENERGY - 20);
  assert.equal(b.kb, 80);
  assert.equal(b.kbDir, 1);
});

test('combat: guard takes exactly 1 damage and 1/5 knockback', () => {
  for (const w of Object.keys(WEAPONS)) {
    const a = createFighter(w, 500, 1), b = createFighter('sword', 560, -1);
    b.guard = true;
    const r = applyHit(a, b);
    assert.equal(r.damage, 1);
    assert.equal(b.energy, MAX_ENERGY - 1);
    assert.ok(near(b.kb, WEAPONS[w].power * 4 / 5, 1e-9));
  }
});

test('combat: reach decides whether an attack connects', () => {
  const swing = (weapon, dist) => {
    const a = createFighter(weapon, 400, 1), b = createFighter('sword', 400 + dist, -1);
    const world = { platforms: [], ice: false };
    stepFighter(a, { ...NO_INPUT, attack: true }, 1 / 60, world);
    let hits = 0;
    for (let i = 0; i < 60; i++) { stepFighter(a, NO_INPUT, 1 / 60, world); stepFighter(b, NO_INPUT, 1 / 60, world); hits += resolveHits(a, b).length; }
    return hits;
  };
  assert.equal(swing('spear', 28 + 100), 1);
  assert.equal(swing('fist', 28 + 100), 0);
  assert.equal(swing('fist', 28 + 30), 1);
});

test('fighter: jumps onto a platform and drops through with down', () => {
  const world = { platforms: [{ x: 350, y: GROUND_Y - 85, w: 150 }], ice: false };
  const f = createFighter('sword', 400, 1);
  stepFighter(f, { ...NO_INPUT, jump: true }, 1 / 60, world);
  for (let i = 0; i < 90; i++) stepFighter(f, NO_INPUT, 1 / 60, world);
  assert.equal(f.platform, 0);
  assert.equal(f.y, GROUND_Y - 85);
  stepFighter(f, { ...NO_INPUT, down: true }, 1 / 60, world);
  for (let i = 0; i < 60; i++) stepFighter(f, NO_INPUT, 1 / 60, world);
  assert.equal(f.platform, -1);
  assert.equal(f.y, GROUND_Y);
});

test('game: trap drains energy little by little; timeout gives win to higher energy', () => {
  const g = new Game({ mode: '2p', weapons: ['sword', 'axe'], map: 'lava', wins: 1, time: 60, seed: 3 });
  g.update(2, [NO_INPUT, NO_INPUT]);
  assert.equal(g.phase, 'fight');
  const t = g.layout.traps[0];
  const f = g.fighters[0];
  f.x = t.x + t.w / 2; g.cam = Math.max(0, Math.min(WORLD_W - VIEW_W, f.x - 100)); g.fighters[1].x = f.x + 200;
  for (let i = 0; i < 60; i++) { f.x = t.x + t.w / 2; g.applyTrap(f, 1 / 60); }
  assert.ok(f.energy < MAX_ENERGY && f.energy >= MAX_ENERGY - 11);
  g.timeLeft = 0.001;
  g.update(1 / 60, [NO_INPUT, NO_INPUT]);
  assert.equal(g.phase, 'roundEnd');
  assert.deepEqual(g.result, { winner: 1, reason: 'TIME' });
});

test('game: KO ends the match at the win target', () => {
  const g = new Game({ mode: '2p', weapons: ['sword', 'axe'], map: 'seoul', wins: 2, time: 90, seed: 5 });
  for (let r = 0; r < 2; r++) {
    g.update(2, [NO_INPUT, NO_INPUT]);
    g.fighters[1].energy = 0;
    g.update(1 / 60, [NO_INPUT, NO_INPUT]);
    assert.equal(g.result.reason, 'KO');
    g.update(3, [NO_INPUT, NO_INPUT]);
  }
  assert.equal(g.phase, 'matchEnd');
  assert.equal(g.winner, 0);
});

test('combat: simultaneous hits trade without crashing', () => {
  const a = createFighter('sword', 500, 1), b = createFighter('sword', 560, -1);
  for (const f of [a, b]) f.attack = { t: f.stats.startup + 0.01, aerial: false, hit: false };
  const events = resolveHits(a, b);
  assert.equal(events.length, 2);
  assert.equal(a.energy, MAX_ENERGY - 12);
  assert.equal(b.energy, MAX_ENERGY - 12);
});
