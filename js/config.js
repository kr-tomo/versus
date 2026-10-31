// Gameplay constants. Visuals live in themes/<id>/theme.json.

// Shown on the title screen; keep in step with CACHE in sw.js.
export const APP_VERSION = 'v7';

export const WORLD_W = 1280;
export const VIEW_W = 640;
export const VIEW_H = 360;
export const GROUND_Y = 316;

export const MAX_ENERGY = 200;
export const GRAVITY = 2000;
export const JUMP_V = 720;
export const WALK_SPEED = 190;
export const BODY_HALF_W = 14;
export const BODY_H = 80;
export const KNOCKBACK_PER_DMG = 4;
export const KNOCKBACK_SPEED = 520;
export const GUARD_KNOCKBACK_RATIO = 1 / 5;
export const GUARD_DAMAGE = 1;
export const HIT_STUN = 0.25;
export const GUARD_STUN = 0.12;
export const DROP_THROUGH_TIME = 0.25;
export const CAMERA_MARGIN = BODY_HALF_W + 4;
export const PARALLAX = 0.6;

export const WIN_OPTIONS = [1, 2, 3, 4, 5];
export const TIME_OPTIONS = [60, 90, 120, 150, 180, 210, 240];

// power = damage, reach in world px from body front, timings in seconds.
// guardUp: time the guard needs to come up (heavy weapons are slower).
// halfW/height: hurtbox, defaults BODY_HALF_W/BODY_H (the mounted boss is bigger).
export const WEAPONS = {
  sword:   { name: '칼',       power: 12, reach: 75,  startup: 0.15, active: 0.10, recovery: 0.23, move: 1.0,  guardUp: 0.07 },
  spear:   { name: '창',       power: 13, reach: 110, startup: 0.22, active: 0.11, recovery: 0.30, move: 0.95, guardUp: 0.10 },
  axe:     { name: '도끼',     power: 20, reach: 70,  startup: 0.33, active: 0.12, recovery: 0.42, move: 0.9,  guardUp: 0.15 },
  dagger:  { name: '단검',     power: 8,  reach: 45,  startup: 0.09, active: 0.09, recovery: 0.16, move: 1.1,  guardUp: 0.04 },
  fist:    { name: '맨손',     power: 6,  reach: 35,  startup: 0.07, active: 0.08, recovery: 0.12, move: 1.15, guardUp: 0.03 },
  stag:    { name: '큰 턱',    power: 14, reach: 85,  startup: 0.17, active: 0.10, recovery: 0.26, move: 1.0,  guardUp: 0.08, airDash: true },
  genghis: { name: '청룡언월도', power: 22, reach: 140, startup: 0.36, active: 0.13, recovery: 0.46, move: 0.85, guardUp: 0.17, halfW: 26, height: 110 },
  mace:    { name: '철퇴',     power: 18, reach: 92,  startup: 0.30, active: 0.12, recovery: 0.40, move: 0.88, guardUp: 0.13 },
  fork:    { name: '갈퀴',     power: 10, reach: 110, startup: 0.18, active: 0.10, recovery: 0.27, move: 1.0,  guardUp: 0.09 }
};
export const WEAPON_IDS = Object.keys(WEAPONS);
export const MAX_POWER = Math.max(...WEAPON_IDS.map(w => WEAPONS[w].power));
export const MAX_REACH = Math.max(...WEAPON_IDS.map(w => WEAPONS[w].reach));
export const canDoubleJump = w => WEAPONS[w].reach <= MAX_REACH / 2;

export const GUARD_MOVE = 0.35;        // walking speed ratio while guarding

// Attack variations (ground):
//   long  — attacking while walking forward: 1.2x slower, reach + LONG_REACH_BONUS for everyone,
//           and the fighter keeps stepping forward (that movement is on top of the bonus).
//           Bonus = half the average walking stride (37.9px measured from the rig's walk poses).
//   heavy — long-reach fighters attacking while walking backward: reach x HEAVY_REACH, same damage,
//           and super armor: hits still deal damage but cause no knockback/stun and don't cancel it.
export const LONG_ATTACK_SLOW = 1.2;
export const LONG_REACH_BONUS = 19;
export const HEAVY_REACH = 0.8;
export const HEAVY_MOVE = 0.35;        // backstep speed ratio during a heavy attack
// Short-reach fighters (reach <= half of the longest reach) get a double jump.
// Attacking during it dives 45° into the ground with aerial-attack damage.
export const DOUBLE_JUMP_V = 640;
export const FLIP_TIME = 0.42;         // somersault on the double jump
export const DIVE_SPEED = 620;
export const DIVE_REACH = 34;
export const DIVE_LAND_RECOVERY = 0.18;
// A contact is confirmed HIT_CONFIRM seconds later. Inside that window the defender can still
// guard (any raise counts) and can still land its own hit — both hits go through (trade).
export const HIT_CONFIRM = 0.05;
export const HITSTOP_BASE = 0.035;     // freeze on impact: base + per damage, capped
export const HITSTOP_PER_DMG = 0.0025;
export const HITSTOP_MAX = 0.12;
export const HITSTOP_GUARD = 0.03;
export const JUMP_ATTACK_MULT = 1.5;   // aerial attacks hit harder
export const AIR_EVADE = 1 / 3;        // chance an airborne fighter dodges a hit

// Super gauge: +3 when hit, +1 on a successful guard. At max, hold attack+guard for SUPER_HOLD.
export const SUPER_MAX = 20;
export const SUPER_GAIN_HIT = 3;
export const SUPER_GAIN_GUARD = 1;
export const SUPER_HOLD = 1;

// After the fighters cross, turning around takes TURN_DELAY unless attack or guard is pressed.
export const TURN_DELAY = 0.5;

// Charged attack: keep holding attack through a ground attack, charge CHARGE_TIME, then swing.
// It breaks guard: a guarding defender takes half damage, is staggered, and gains 2 gauge.
export const CHARGE_TIME = 0.5;
export const CHARGE_MULT = 1;          // damage vs the fighter's normal attack
export const CHARGE_GUARD_RATIO = 0.5;
export const CHARGE_BREAK_STUN = 0.45;
export const SUPER_GAIN_CHARGE_GUARD = 2;

// Stag beetle air dash: its second jump flies level in the travel direction. It ignores hits
// while flying and can't attack until the last AIR_DASH_ATTACK seconds.
export const AIR_DASH_DIST = 210;
export const AIR_DASH_TIME = 0.26;
export const AIR_DASH_ATTACK = 0.06;

// Supers. The user is invulnerable while it runs.
//   dash: [from, to, speed] forward movement   blink: teleport behind the opponent at this time
//   hits: at/len (window), reach, dmg, kb, stun; ub = ignores guard, crush = guard breaks (chip + stun),
//         launch = pops the opponent into the air. Guarded non-ub hits deal 1/4 chip.
//   range: distance (gap) where the computer will fire it
const rapid = (n, from, step, hit) => Array.from({ length: n }, (_, i) => ({ at: from + i * step, len: step * 0.6, ...hit }));
export const SUPERS = {
  sword: { name: '성검 십자참', time: 0.8, range: 110, dash: [[0.12, 0.5, 360]],
    hits: [{ at: 0.18, len: 0.12, reach: 90, dmg: 16, kb: 20, stun: 0.4 }, { at: 0.48, len: 0.12, reach: 105, dmg: 22, kb: 140, stun: 0.6 }] },
  spear: { name: '일섬 돌격', time: 0.85, range: 260, dash: [[0.2, 0.65, 600]],
    hits: [{ at: 0.2, len: 0.45, reach: 115, dmg: 34, kb: 220, stun: 0.7 }] },
  axe: { name: '대지 분쇄', time: 1.05, range: 180, dash: [[0.42, 0.5, 200]],
    hits: [{ at: 0.5, len: 0.12, reach: 190, dmg: 40, kb: 170, stun: 0.8, ub: true }], quake: 0.5 },
  dagger: { name: '그림자 습격', time: 0.95, range: 220, blink: 0.18,
    hits: rapid(4, 0.26, 0.12, { reach: 55, dmg: 7, kb: 10, stun: 0.35, ub: true }).map((h, i, a) => i === a.length - 1 ? { ...h, kb: 110 } : h) },
  fist: { name: '백열권', time: 1.2, range: 60, dash: [[0, 1.0, 70]],
    hits: [...rapid(10, 0.1, 0.08, { reach: 50, dmg: 3, kb: 3, stun: 0.25 }), { at: 0.98, len: 0.08, reach: 60, dmg: 10, kb: 150, stun: 0.6 }] },
  // teleports onto the opponent: sure = connects wherever the opponent is, can't be dodged or guarded
  stag: { name: '집게 내던지기', time: 1.0, range: 2000, blink: 0.15, blinkSide: 'front',
    hits: [{ at: 0.22, len: 0.12, reach: 95, dmg: 30, kb: 160, stun: 0.9, ub: true, sure: true, launch: 680 }] },
  genghis: { name: '기마 돌격', time: 1.05, range: 330, dash: [[0.18, 0.85, 620]],
    hits: [{ at: 0.18, len: 0.67, reach: 170, dmg: 38, kb: 240, stun: 0.9, crush: true }] },
  // grab: anything within twice the reach in front is caught (any height), pulled in and thrown far
  mace: { name: '잡아던지기', time: 0.95, range: 180,
    hits: [{ at: 0.25, len: 0.1, reach: 184, dmg: 34, kb: 420, stun: 1.1, ub: true, noEvade: true, tall: true, grab: true, launch: 620 }] },
  // a bull charges in from the screen edge behind the farmer and runs across the whole map
  fork: { name: '황소 돌격', time: 0.6, range: 2000, hits: [],
    bull: { at: 0.2, speed: 950, dmg: 32, kb: 280, stun: 0.9, launch: 460 } }
};

// Per-map variables. Layout is regenerated every round inside these safe ranges.
// platformRise: platform top height above the ground (jump apex is ~130px).
export const MAPS = {
  lava:   { name: '용암 지대',   trap: '마그마 웅덩이', trapWidth: 90, traps: [2, 3], platforms: [2, 3], platformRise: [72, 92], trapDps: 10, ice: false },
  jungle: { name: '아마존 밀림', trap: '피라냐 우물',   trapWidth: 80, traps: [1, 2], platforms: [3, 4], platformRise: [70, 96], trapDps: 7,  ice: false },
  seoul:  { name: '서울 도심',   trap: '감전 맨홀',     trapWidth: 80, traps: [2, 2], platforms: [3, 3], platformRise: [76, 90], trapDps: 8,  ice: false },
  tundra: { name: '북극 툰드라', trap: '얼음 구멍',     trapWidth: 90, traps: [2, 3], platforms: [2, 3], platformRise: [72, 92], trapDps: 6,  ice: true }
};
export const MAP_IDS = Object.keys(MAPS);
export const PLATFORM_WIDTHS = [120, 150, 180, 210];

// Ice ground: acceleration/deceleration instead of instant velocity
export const ICE_ACCEL = 900;
export const ICE_DECEL = 380;

// Initial camera is centered; fighters spawn inside it.
export const SPAWN_X = [480, 800];
export const SPAWN_SAFE = 60;
