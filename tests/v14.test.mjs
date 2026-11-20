import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dpadAim } from '../js/input.js';
import { computeLayout, metrics, STACK_ANGLE } from '../js/layout.js';
import { createFighter, stepFighter, attackPhase, attackTiming, frameName, NO_INPUT } from '../js/fighter.js';
import { resolveHits, strike } from '../js/combat.js';
import { Game } from '../js/game.js';
import { moveList } from '../js/moves.js';
import {
  WEAPONS, WEAPON_IDS, MAX_ENERGY, GROUND_Y, BODY_H, AIR_DASH_DIST, AIR_DASH_TIME, RAM_DIST, STRIDE, BASH_DIST, BASH_TIME,
  BASH_FOLLOW, AIR_SHOT_DRAW, ARROW_SPEED, JUMP_ATTACK_MULT, LONG_ATTACK_SLOW, WALK_SPEED, APP_VERSION
} from '../js/config.js';

const DT = 1 / 120;
const W = { platforms: [], ice: false };
const never = () => 0.99;
const step = (f, input = NO_INPUT, n = 1) => { for (let i = 0; i < n; i++) stepFighter(f, input, DT, W); };
const run = (g, secs, ia = () => NO_INPUT, ib = () => NO_INPUT) => { for (let t = 0; t < secs - 1e-9; t += DT) g.update(DT, [ia(t), ib(t)]); };
function fight(w1, w2) {
  const g = new Game({ mode: '2p', weapons: [w1, w2], map: 'seoul', wins: 3, time: 99, seed: 2, rand: never });
  g.update(2, [NO_INPUT, NO_INPUT]); g.layout.traps = [];
  return g;
}
// double-tap forward and hold the second tap
const doubleTap = (f, key, extra = NO_INPUT) => { step(f, { ...extra, [key]: true }); step(f, extra, 2); step(f, { ...extra, [key]: true }, 14); };

/* ---------- touch ---------- */
test('d-pad: once pressed, the finger keeps its direction however far it slides; diagonals too', () => {
  const rect = { left: 100, top: 100, width: 160, height: 160 }; // center (180, 180)
  const on = (x, y) => { const d = dpadAim(rect, x, y); return Object.keys(d).filter(k => d[k]).sort().join('+'); };
  assert.equal(on(240, 180), 'right');
  assert.equal(on(900, 180), 'right', 'far outside the pad, still right');
  assert.equal(on(180, -500), 'up');
  assert.equal(on(700, -340), 'right+up', 'far outside, still a diagonal');
  assert.equal(on(-400, 760), 'down+left');
  assert.equal(on(180, 180), '', 'dead center presses nothing');
});

test('layout: controls 1.5x bigger — buttons 19.5% of the short side, the D-pad 1.9 buttons wide', () => {
  const m = metrics(1000, 462);
  assert.equal(m.btn, 90);                          // was 60 (13%)
  assert.ok(Math.abs(m.padR * 2 - 1.9 * 90) < 1e-9);
  assert.equal(metrics(300, 300).btn, 66);          // never below 1.5 x 44
  assert.equal(metrics(2000, 2000).btn, 126);       // never above 1.5 x 84
  for (const [Wd, H] of [[1000, 462], [844, 390], [1180, 820], [390, 844]]) {
    const L = computeLayout(Wd, H, { players: 1 });
    const d = L.buttons.find(b => b.action === 'dpad'), a = L.buttons.find(b => b.action === 'attack');
    assert.ok(a.r * 2 >= 66 && d.r * 2 >= 1.9 * 66, `${Wd}x${H}`);
    assert.ok(Math.abs(d.r - 0.95 * L.btn) < 1e-9, `${Wd}x${H} d-pad is 1.9 buttons wide in every mode`);
  }
});

test('layout: side mode fills the height (no strip under the view) and stacks attack/guard on a 75° line', () => {
  const L = computeLayout(1000, 462, { players: 1 });
  assert.equal(L.mode, 'side');
  // the view is as tall as the clusters allow: 1.5x controls on this phone ride half over the view edge
  assert.ok(L.view.h > 420 && L.view.h <= 462, `${L.view.h}`);
  const old = 462 - 2 * 8 - 60;  // bottom mode would leave a strip under the view
  assert.ok(L.view.w > old * 16 / 9);
  const a = L.buttons.find(b => b.action === 'attack'), g = L.buttons.find(b => b.action === 'guard');
  const ang = Math.atan2(a.y - g.y, a.x - g.x) * 180 / Math.PI;
  assert.ok(Math.abs(ang - STACK_ANGLE) < 0.01, `stack angle ${ang}`);
  assert.ok(g.y < a.y && g.x < a.x, 'guard sits up and toward the view from attack');
  assert.ok(Math.hypot(a.x - g.x, a.y - g.y) >= a.r + g.r, 'they do not touch');
  // wide and tall screens: a full-height view
  const full = computeLayout(2400, 900, { players: 1 });
  assert.equal(full.mode, 'side'); assert.equal(full.view.h, 900);
  // the 4:3 tablet keeps the bottom strip: its gutters would be no better
  assert.equal(computeLayout(1180, 820, { players: 1 }).mode, 'bottom');
});

/* ---------- archer ---------- */
test('archer: the air attack hangs where the button was pressed and shoots an arrow 45° down', () => {
  const g = fight('archer', 'sword'), [p, q] = g.fighters;
  p.x = 400; q.x = 400 + 150;
  run(g, DT, () => ({ ...NO_INPUT, jump: true }));
  run(g, 0.2);
  const y0 = p.y, x0 = p.x;
  run(g, DT, () => ({ ...NO_INPUT, attack: true }));
  assert.equal(p.attack?.kind, 'airShot');
  run(g, AIR_SHOT_DRAW - DT);
  assert.ok(Math.abs(p.y - y0) < 1 && Math.abs(p.x - x0) < 1, 'hangs in the air while drawing');
  assert.equal(g.projectiles.length, 0, 'no arrow before the release');
  run(g, DT * 2);
  const arrow = g.projectiles[0];
  assert.ok(arrow && arrow.type === 'arrow' && arrow.diag, 'an arrow is in flight');
  assert.ok(Math.abs(arrow.vx - ARROW_SPEED * Math.SQRT1_2) < 1e-6 && Math.abs(arrow.vy - ARROW_SPEED * Math.SQRT1_2) < 1e-6, '45° down-forward');
  run(g, 0.6);
  assert.equal(q.energy, MAX_ENERGY - Math.round(WEAPONS.archer.power * JUMP_ATTACK_MULT), 'aerial damage (1.5x)');
  assert.ok(p.y > y0, 'falls after the shot');
  assert.ok(moveList('archer').rows.find(r => r.kind === '공중 공격').note.includes('45°'));
});

test('archer: the air shot is blocked by an ordinary guard (it is not a charged shot)', () => {
  const g = fight('archer', 'sword'), [p, q] = g.fighters;
  p.x = 400; q.x = 400 + 150;
  run(g, DT, () => ({ ...NO_INPUT, jump: true }));
  run(g, 0.2);
  run(g, DT, () => ({ ...NO_INPUT, attack: true }));
  run(g, 1, () => NO_INPUT, () => ({ ...NO_INPUT, guard: true }));
  assert.equal(q.energy, MAX_ENERGY - 1);
});

/* ---------- stag beetle ---------- */
test('stag: attacking during the air dash rams straight at the opponent, 0.8x the dash distance, passing through', () => {
  // the opponent hangs in the air at the stag's height, so the ram runs its full length
  const g = fight('stag', 'sword'), [p, q] = g.fighters;
  p.x = 400; q.x = 400 + 120;
  const hold = y => () => { q.y = y; q.vy = 0; q.onGround = false; return NO_INPUT; };
  run(g, DT, () => ({ ...NO_INPUT, jump: true }));
  run(g, 0.08);
  run(g, DT, () => ({ ...NO_INPUT, jump: true, right: true }));
  assert.ok(p.airDash, 'dashing');
  run(g, 0.03, () => ({ ...NO_INPUT, right: true }));
  const x0 = p.x, y0 = p.y, qx0 = q.x;
  run(g, DT, () => ({ ...NO_INPUT, attack: true }), hold(y0));
  assert.equal(p.attack?.kind, 'ram'); assert.equal(p.airDash, null);
  const [ux, uy] = p.attack.dir;
  assert.ok(ux > 0.99 && Math.abs(uy) < 0.1, 'aimed straight at the opponent');
  // run until the ram ends (impact hitstop pauses the clock)
  for (let i = 0; i < 120 && p.attack?.kind === 'ram'; i++) g.update(DT, [NO_INPUT, hold(y0)()]);
  const flown = Math.hypot(p.x - x0, p.y - y0);
  assert.ok(flown <= RAM_DIST * AIR_DASH_DIST + 2 && flown >= RAM_DIST * AIR_DASH_DIST - 2, `flew ${flown}`);
  assert.equal(q.energy, MAX_ENERGY - Math.round(WEAPONS.stag.power * JUMP_ATTACK_MULT), 'aerial damage, once');
  assert.ok(p.x > qx0 + 10, 'passed through to the far side of where the opponent hung');
  assert.ok(Math.abs(p.vx) < 1, 'stops dead');
  // a grounded opponent: the ram dives at its body and ends when the stag lands
  const h = fight('stag', 'sword'), [r, u] = h.fighters;
  r.x = 400; u.x = 520;
  run(h, DT, () => ({ ...NO_INPUT, jump: true }));
  run(h, 0.08);
  run(h, DT, () => ({ ...NO_INPUT, jump: true, right: true }));
  run(h, 0.03, () => ({ ...NO_INPUT, right: true }));
  run(h, DT, () => ({ ...NO_INPUT, attack: true }));
  assert.ok(r.attack.dir[1] > 0.3, 'aimed down at the grounded body');
  for (let i = 0; i < 120 && r.attack?.kind === 'ram'; i++) h.update(DT, [NO_INPUT, NO_INPUT]);
  assert.ok(r.onGround && u.energy === MAX_ENERGY - 21, 'landed after hitting');
  assert.ok(moveList('stag').rows.some(r => r.name === '집게 돌격'));
});

test('stag: the ram can be hit (unlike the dash)', () => {
  const p = createFighter('stag', 400, 1), a = createFighter('spear', 460, -1);
  step(p, { ...NO_INPUT, jump: true }); step(p, NO_INPUT, 12);
  step(p, { ...NO_INPUT, jump: true, right: true }); step(p, { ...NO_INPUT, right: true }, 3);
  a.y = p.y; a.attack = { t: a.stats.startup + 0.01, kind: 'normal', aerial: false, hit: false };
  assert.equal(resolveHits(a, p, never).length, 0, 'untouchable while dashing');
  step(p, { ...NO_INPUT, attack: true });
  assert.equal(p.attack.kind, 'ram');
  a.attack = { t: a.stats.startup + 0.01, kind: 'normal', aerial: false, hit: false }; a.y = p.y;
  assert.ok(resolveHits(a, p, never).some(e => e.defender === p && e.damage > 0), 'the ram takes the hit');
});

/* ---------- spear ---------- */
test('spear: the forward attack lunges one more stride during its startup', () => {
  const travel = w => {
    const f = createFighter(w, 400, 1), x0 = f.x;
    step(f, { ...NO_INPUT, right: true, attack: true });
    while (attackPhase(f) !== 'recovery') step(f, { ...NO_INPUT, right: true });
    return f.x - x0;
  };
  const T = attackTiming({ stats: WEAPONS.spear, attack: { kind: 'long' } });
  const walk = WALK_SPEED * WEAPONS.spear.move * (T.startup + T.active);
  assert.ok(Math.abs(travel('spear') - (walk + STRIDE)) < 4, `spear ${travel('spear')} vs ${walk + STRIDE}`);
  const Ts = attackTiming({ stats: WEAPONS.sword, attack: { kind: 'long' } });
  assert.ok(Math.abs(travel('sword') - WALK_SPEED * (Ts.startup + Ts.active)) < 4, 'others only walk');
  assert.ok(moveList('spear').rows.find(r => r.kind === '전진 공격').note.includes('돌진'));
});

/* ---------- sword ---------- */
test('sword: forward double-tap + hold bashes two strides behind the shield, guard up at once, no damage', () => {
  const g = fight('sword', 'axe'), [p, q] = g.fighters;
  p.x = 400; q.x = 400 + 120;
  doubleTap(p, 'right');
  assert.ok(p.bash, 'bashing');
  assert.ok(p.guard, 'the shield is up from the first frame');
  const x0 = p.x;
  run(g, BASH_TIME + DT, () => ({ ...NO_INPUT, right: true }), () => ({ ...NO_INPUT, attack: true }));
  assert.ok(Math.abs(p.x - x0 - BASH_DIST * STRIDE) < 6, `moved ${p.x - x0}`);
  assert.equal(p.bash, null, 'over');
  assert.ok(q.x >= p.x + 28 - 1, 'the opponent was shoved along in front of the shield');
  assert.equal(q.energy, MAX_ENERGY, 'the shove does no damage');
  assert.ok(p.energy >= MAX_ENERGY - 2, 'swings into the shield cost at most the guard chip');
  assert.ok(g.effects.some(e => e.type === 'shove') || p.energy <= MAX_ENERGY, 'shove effect fired');
  assert.ok(moveList('sword').rows.some(r => r.name === '방패 돌진'));
});

test('sword: an attack during or right after the bash has no startup; the shield shows in the guard frame', () => {
  const f = createFighter('sword', 400, 1);
  doubleTap(f, 'right');
  assert.ok(f.bash);
  assert.ok(frameName(f).startsWith('bash'));
  step(f, { ...NO_INPUT, right: true, attack: true });
  assert.ok(f.attack?.instant && f.bash === null);
  assert.equal(attackTiming(f).startup, 0);
  assert.equal(attackPhase(f), 'active', 'the blade is out on the first frame');
  // after the bash ends there is a short follow-up window
  const h = createFighter('sword', 400, 1);
  doubleTap(h, 'right');
  step(h, { ...NO_INPUT, right: true }, Math.ceil(BASH_TIME / DT) + 1);
  assert.equal(h.bash, null);
  step(h, NO_INPUT, Math.floor(BASH_FOLLOW / DT) - 2);
  step(h, { ...NO_INPUT, attack: true });
  assert.ok(h.attack?.instant, 'still instant inside the window');
  const k = createFighter('sword', 400, 1);
  doubleTap(k, 'right');
  step(k, { ...NO_INPUT, right: true }, Math.ceil(BASH_TIME / DT) + 1);
  step(k, NO_INPUT, Math.ceil(BASH_FOLLOW / DT) + 2);
  step(k, { ...NO_INPUT, attack: true });
  assert.ok(k.attack && !k.attack.instant, 'normal startup after the window');
  // a bashing sword cannot be bashed by others: only the sword has it
  for (const w of WEAPON_IDS) assert.equal(!!WEAPONS[w].bash, w === 'sword');
});

test('frames: the sprite sheets carry the shield-bash and air-shot frames; version v14', () => {
  const theme = JSON.parse(readFileSync(new URL('../themes/classic/theme.json', import.meta.url)));
  for (const w of WEAPON_IDS) for (const n of ['bash', 'bash1', 'bash>bash1', 'bash1>bash', 'airDraw', 'airShot', 'jump>airDraw', 'airDraw>airShot', 'airShot>fall'])
    assert.ok(n in theme.characters[w].frames, `${w} ${n}`);
  assert.equal(APP_VERSION, 'v14');
});
