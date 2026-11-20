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
  WEAPONS, WEAPON_IDS, MAX_ENERGY, GROUND_Y, BODY_H, STRIDE, BASH_DIST, BASH_TIME, BASH_FOLLOW, AIR_SHOT_DRAW, ARROW_SPEED,
  JUMP_ATTACK_MULT, WALK_SPEED, APP_VERSION, BULLET_RANGE, BULLET_SPEED, MAPS, GRAVITY, JUMP_V
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

test('layout: side mode fills the height (no strip under the view); guard sits 75° up-right of attack', () => {
  const L = computeLayout(1000, 462, { players: 1 });
  assert.equal(L.mode, 'side');
  // the view is as tall as the clusters allow: 1.5x controls on this phone ride half over the view edge
  assert.ok(L.view.h > 420 && L.view.h <= 462, `${L.view.h}`);
  const old = 462 - 2 * 8 - 60;  // bottom mode would leave a strip under the view
  assert.ok(L.view.w > old * 16 / 9);
  const a = L.buttons.find(b => b.action === 'attack'), g = L.buttons.find(b => b.action === 'guard');
  const ang = Math.atan2(a.y - g.y, g.x - a.x) * 180 / Math.PI;   // attack as the origin, y up
  assert.ok(Math.abs(ang - STACK_ANGLE) < 0.01, `stack angle ${ang}`);
  assert.ok(g.y < a.y && g.x > a.x, 'guard is up and to the right of attack');
  for (const [Wd, H] of [[1000, 462], [2400, 900]]) for (const players of [1, 2]) {
    const L2 = computeLayout(Wd, H, { players });
    if (L2.mode !== 'side') continue;
    for (const p of [0, 1].slice(0, players)) {
      const at = L2.buttons.find(b => b.player === p && b.action === 'attack'), gd = L2.buttons.find(b => b.player === p && b.action === 'guard');
      assert.ok(gd.x > at.x && gd.y < at.y, `${Wd}x${H} P${p + 1}`);
    }
  }
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

test('archer: one shot per jump — a second air attack in the same jump is a sword swing; landing resets it', () => {
  const f = createFighter('archer', 400, 1);
  step(f, { ...NO_INPUT, jump: true }); step(f, NO_INPUT, 6);
  step(f, { ...NO_INPUT, attack: true });
  assert.equal(f.attack?.kind, 'airShot');
  while (f.attack) step(f);
  assert.ok(!f.onGround, 'still in the air after the shot');
  step(f, { ...NO_INPUT, attack: true });
  assert.equal(f.attack?.kind, 'aerial', 'no second arrow this jump');
  while (!f.onGround || f.attack) step(f);
  step(f, { ...NO_INPUT, jump: true }); step(f, NO_INPUT, 6);
  step(f, { ...NO_INPUT, attack: true });
  assert.equal(f.attack?.kind, 'airShot', 'a new jump allows a new shot');
});

test('cowboy: the revolver reaches 1.5x further (5.25 body heights); the moon pulls at 0.8 gravity', () => {
  assert.equal(BULLET_RANGE, 5.25);
  const g = fight('whip', 'sword'), [p, q] = g.fighters;
  p.x = 200; q.x = 200 + 30 + BULLET_RANGE * BODY_H - 10;
  run(g, 0.45 + 0.02 + WEAPONS.whip.startup + WEAPONS.whip.active + WEAPONS.whip.recovery, () => ({ ...NO_INPUT, attack: true }));
  run(g, (BULLET_RANGE * BODY_H) / BULLET_SPEED + 0.2);
  assert.equal(q.energy, MAX_ENERGY - Math.round(WEAPONS.whip.power * 1.5), 'hit at the end of the longer range');
  assert.equal(MAPS.moon.gravity, 0.8);
  const apex = gr => JUMP_V * JUMP_V / (2 * GRAVITY * gr);
  assert.ok(apex(0.8) > apex(1) && apex(0.8) < apex(0.75));
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
test('sword: forward double-tap + hold bashes three strides behind the shield at 1.5x the old pace, guard up at once, no damage', () => {
  const g = fight('sword', 'axe'), [p, q] = g.fighters;
  p.x = 400; q.x = 400 + 120;
  doubleTap(p, 'right');
  assert.ok(p.bash, 'bashing');
  assert.ok(p.guard, 'the shield is up from the first frame');
  const x0 = p.x;
  run(g, BASH_TIME + DT, () => ({ ...NO_INPUT, right: true }), () => ({ ...NO_INPUT, attack: true }));
  assert.ok(Math.abs(p.x - x0 - BASH_DIST * STRIDE) < 6, `moved ${p.x - x0}`);
  assert.equal(BASH_DIST, 3);
  assert.ok(Math.abs(BASH_DIST * STRIDE / BASH_TIME - 1.5 * (2 * STRIDE / 0.35)) < 1e-9, '1.5x the first version\'s speed');
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

test('frames: the sprite sheets carry the shield-bash and air-shot frames; version v15', () => {
  const theme = JSON.parse(readFileSync(new URL('../themes/classic/theme.json', import.meta.url)));
  for (const w of WEAPON_IDS) for (const n of ['bash', 'bash1', 'bash>bash1', 'bash1>bash', 'airDraw', 'airShot', 'jump>airDraw', 'airDraw>airShot', 'airShot>fall'])
    assert.ok(n in theme.characters[w].frames, `${w} ${n}`);
  assert.equal(APP_VERSION, 'v15');
});
