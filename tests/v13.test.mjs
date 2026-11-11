import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dpadDirs, dpadSlopes, DPAD_DIAGONAL, DPAD_RANGE_MOD } from '../js/input.js';
import { Game } from '../js/game.js';
import { AI } from '../js/ai.js';
import { NO_INPUT } from '../js/fighter.js';
import { WEAPON_IDS, BODY_HALF_W } from '../js/config.js';

globalThis.addEventListener ??= () => {};
const deg = a => [Math.cos(a * Math.PI / 180), -Math.sin(a * Math.PI / 180)]; // 0° = right, 90° = up
const dirsAt = a => { const d = dpadDirs(...deg(a)); return Object.keys(d).filter(k => d[k]).sort().join('+'); };

test('d-pad: RetroArch 8-way zones — default 80% gives 50° cardinals and 40° diagonals', () => {
  assert.equal(DPAD_DIAGONAL, 80);
  const { low, high } = dpadSlopes(80);
  assert.ok(Math.abs(Math.atan(low) * 180 / Math.PI - 25) < 0.01);
  assert.ok(Math.abs(Math.atan(high) * 180 / Math.PI - 65) < 0.01);
  assert.equal(dirsAt(0), 'right');
  assert.equal(dirsAt(24), 'right');
  assert.equal(dirsAt(26), 'right+up');
  assert.equal(dirsAt(64), 'right+up');
  assert.equal(dirsAt(66), 'up');
  assert.equal(dirsAt(90), 'up');
  assert.equal(dirsAt(135), 'left+up');
  assert.equal(dirsAt(180), 'left');
  assert.equal(dirsAt(225), 'down+left');
  assert.equal(dirsAt(270), 'down');
  assert.equal(dirsAt(315), 'down+right');
  // 100% = 8 equal 45° zones (boundaries at 22.5° and 67.5°)
  const s100 = dpadSlopes(100);
  assert.ok(Math.abs(Math.atan(s100.low) * 180 / Math.PI - 22.5) < 0.01);
  assert.ok(Math.abs(Math.atan(s100.high) * 180 / Math.PI - 67.5) < 0.01);
  assert.equal(DPAD_RANGE_MOD, 1.5);
});

// Play-style metrics against a passive opponent that drifts and guards but never attacks.
function measure(level) {
  let T = 0, close = 0, swings = 0, back = 0, gaps = [], kinds = new Set();
  for (const w of WEAPON_IDS) {
    const g = new Game({ mode: 'hard', weapons: [w, 'sword'], map: 'seoul', wins: 9, time: 40, seed: 3, rand: () => 0.99 });
    g.update(2, [NO_INPUT, NO_INPUT]); g.layout.traps = [];
    const [me, op] = g.fighters, ai = new AI(level);
    let t = 0, last = null, seen = new WeakSet();
    while (t < 40 && g.phase === 'fight') {
      const k = Math.floor(t / 0.8) % 5;
      const ia = ai.update(1 / 120, me, op, g);
      g.update(1 / 120, [ia, { ...NO_INPUT, left: k === 1, right: k === 3, guard: Math.floor(t / 1.3) % 4 === 0 }]);
      t += 1 / 120; T += 1 / 120;
      const gap = Math.abs(op.x - me.x) - (me.stats.halfW ?? BODY_HALF_W) - BODY_HALF_W;
      if (gap < 40) close += 1 / 120;
      if ((op.x - me.x) * ((ia.right ? 1 : 0) - (ia.left ? 1 : 0)) < 0) back += 1 / 120;
      if (me.attack && !seen.has(me.attack)) { seen.add(me.attack); swings++; kinds.add(me.attack.kind); if (last !== null) gaps.push(t - last); last = t; }
    }
  }
  gaps.sort((a, b) => a - b);
  return { close: close / T, rate: swings / T, back: back / T, p25: gaps[gaps.length >> 2], p90: gaps[Math.floor(gaps.length * 0.9)], kinds };
}

test('ai: no longer glued to the opponent — it gives ground, and the rhythm comes in bursts', () => {
  const easy = measure('easy'), hard = measure('hard');
  for (const [name, m] of [['easy', easy], ['hard', hard]]) {
    assert.ok(m.close < 0.4, `${name} close ${m.close}`);          // was 0.54 (easy) before
    assert.ok(m.back > 0.12, `${name} backs off ${m.back}`);        // was 0.07-0.09
    assert.ok(m.p90 > 2.5 * m.p25, `${name} bursts ${m.p25}/${m.p90}`);
  }
  assert.ok(easy.rate < hard.rate, 'easy swings less often');
  assert.ok(hard.rate < 1.1, `hard is not a mash (${hard.rate}/s, was 1.32)`);
  assert.ok(hard.kinds.size >= 4, [...hard.kinds].join(','));
});

test('ai: hard reads a turtling player and breaks the guard more', () => {
  const run = guardAlways => {
    const g = new Game({ mode: 'hard', weapons: ['sword', 'sword'], map: 'seoul', wins: 9, time: 60, seed: 4, rand: () => 0.99 });
    g.update(2, [NO_INPUT, NO_INPUT]); g.layout.traps = [];
    const [me, op] = g.fighters, ai = new AI('hard'), seen = new WeakSet();
    let charged = 0, all = 0;
    for (let t = 0; t < 40 && g.phase === 'fight'; t += 1 / 120) {
      g.update(1 / 120, [ai.update(1 / 120, me, op, g), { ...NO_INPUT, guard: guardAlways }]);
      op.energy = 200;
      if (me.attack && !seen.has(me.attack)) { seen.add(me.attack); all++; if (me.attack.kind === 'charged') charged++; }
    }
    return charged / Math.max(1, all);
  };
  assert.ok(run(true) > run(false) + 0.15);
});
