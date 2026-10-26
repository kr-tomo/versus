// Gameplay constants. Visuals live in themes/<id>/theme.json.

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

// power = damage (max 20), reach in world px from body front, timings in seconds
export const WEAPONS = {
  sword:  { name: '칼',   power: 12, reach: 75,  startup: 0.15, active: 0.10, recovery: 0.23, move: 1.0 },
  spear:  { name: '창',   power: 13, reach: 110, startup: 0.22, active: 0.11, recovery: 0.30, move: 0.95 },
  axe:    { name: '도끼', power: 20, reach: 70,  startup: 0.33, active: 0.12, recovery: 0.42, move: 0.9 },
  dagger: { name: '단검', power: 8,  reach: 45,  startup: 0.09, active: 0.09, recovery: 0.16, move: 1.1 },
  fist:   { name: '맨손', power: 6,  reach: 35,  startup: 0.07, active: 0.08, recovery: 0.12, move: 1.15 }
};
export const WEAPON_IDS = Object.keys(WEAPONS);

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
