import {
  WEAPONS, SUPERS, MAX_ENERGY, GROUND_Y, GRAVITY, JUMP_V, WALK_SPEED, KNOCKBACK_SPEED,
  DROP_THROUGH_TIME, ICE_ACCEL, ICE_DECEL, GUARD_MOVE, SUPER_MAX, SUPER_HOLD, HIT_STUN,
  LONG_ATTACK_SLOW, HEAVY_MOVE, DOUBLE_JUMP_V, FLIP_TIME, DIVE_SPEED, DIVE_LAND_RECOVERY, canDoubleJump
} from './config.js';

export const NO_INPUT = Object.freeze({ left: false, right: false, jump: false, down: false, attack: false, guard: false });

export function createFighter(weapon, x, facing) {
  return {
    weapon, stats: WEAPONS[weapon], x, y: GROUND_Y, vx: 0, vy: 0, onGround: true, platform: -1, facing,
    energy: MAX_ENERGY, attack: null, guard: false, guarding: false, guardT: 0, stun: 0,
    meter: 0, charge: 0, super: null, kb: 0, kbDir: 0, drop: 0,
    canDouble: canDoubleJump(weapon), doubled: false, flipT: 0,
    trapAcc: 0, inTrap: false, hitFlash: 0, ko: false, won: false, prevInput: NO_INPUT, walk: 0, t: 0
  };
}

// Attack kinds: normal, aerial, long (walking forward), heavy (walking backward, long reach),
// dive (attack during a double jump: active until landing, then a short recovery).
export function attackTiming(f) {
  const s = f.stats, k = f.attack?.kind;
  if (k === 'long') return { startup: s.startup * LONG_ATTACK_SLOW, active: s.active * LONG_ATTACK_SLOW, recovery: s.recovery * LONG_ATTACK_SLOW };
  if (k === 'dive') return { startup: 0.05, active: Infinity, recovery: DIVE_LAND_RECOVERY };
  return s;
}

export function attackPhase(f) {
  if (!f.attack) return null;
  if (f.attack.kind === 'dive') return f.attack.landed !== undefined ? 'recovery' : f.attack.t < 0.05 ? 'startup' : 'active';
  const { startup, active } = attackTiming(f), t = f.attack.t;
  if (t < startup) return 'startup';
  if (t < startup + active) return 'active';
  return 'recovery';
}

const attackOver = f => {
  if (f.attack.kind === 'dive') return f.attack.landed !== undefined && f.attack.t - f.attack.landed >= DIVE_LAND_RECOVERY;
  const { startup, active, recovery } = attackTiming(f);
  return f.attack.t >= startup + active + recovery;
};

// Current hit window of the running super, or null.
export function superHit(f) {
  if (!f.super) return null;
  const t = f.super.t;
  const i = f.super.def.hits.findIndex(h => t >= h.at && t < h.at + h.len);
  return i < 0 || f.super.done.has(i) ? null : { ...f.super.def.hits[i], index: i };
}

function approach(v, target, rate) {
  return v < target ? Math.min(target, v + rate) : Math.max(target, v - rate);
}

// world: { platforms: [{x,y,w}], ice: bool }
export function stepFighter(f, input, dt, world) {
  if (f.ko) input = NO_INPUT;
  const prev = f.prevInput;
  const pressed = k => input[k] && !prev[k];
  f.prevInput = { ...input };
  f.t += dt;
  f.hitFlash = Math.max(0, f.hitFlash - dt);
  f.stun = Math.max(0, f.stun - dt);
  f.drop = Math.max(0, f.drop - dt);
  if (f.ko) f.super = null;
  const canAct = f.stun <= 0 && !f.ko && !f.super;

  if (f.attack) {
    f.attack.t += dt;
    if (attackOver(f)) f.attack = null;
  }
  if (f.doubled && !f.onGround) f.flipT += dt;
  let dash = null;
  if (f.super) {
    f.super.t += dt;
    dash = f.super.def.dash?.find(([a, b]) => f.super.t >= a && f.super.t < b);
    if (f.super.t >= f.super.def.time) f.super = null;
  }

  // guard comes up after the weapon's guardUp time
  f.guarding = canAct && input.guard && !f.attack;
  f.guardT = f.guarding ? f.guardT + dt : 0;
  f.guard = f.guarding && f.guardT >= f.stats.guardUp;

  // super: hold attack + guard with a full gauge
  const charging = canAct && f.onGround && input.attack && input.guard && !f.attack && f.meter >= SUPER_MAX;
  f.charge = charging ? f.charge + dt : 0;
  if (f.charge >= SUPER_HOLD) {
    f.super = { t: 0, def: SUPERS[f.weapon], done: new Set(), blinked: false };
    f.meter = 0; f.charge = 0; f.guard = f.guarding = false; f.guardT = 0;
  }

  const held = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (canAct && !f.attack && !input.guard && pressed('attack')) {
    let kind = 'normal';
    if (!f.onGround) kind = f.doubled ? 'dive' : 'aerial';
    else if (held === f.facing) kind = 'long';
    else if (held === -f.facing && !f.canDouble) kind = 'heavy';
    f.attack = { t: 0, kind, aerial: !f.onGround, hit: false };
  }
  if (canAct && !f.attack && f.onGround && pressed('jump')) { f.vy = -JUMP_V; f.onGround = false; f.platform = -1; }
  // double jump (short-reach fighters): a somersault in mid-air
  else if (canAct && !f.attack && !f.onGround && f.canDouble && !f.doubled && pressed('jump')) { f.vy = -DOUBLE_JUMP_V; f.doubled = true; f.flipT = 0; }
  if (canAct && !f.attack && f.onGround && f.platform >= 0 && input.down) { f.drop = DROP_THROUGH_TIME; f.onGround = false; f.platform = -1; f.vy = 0; }

  // horizontal movement; guarding slows the walk. A long attack keeps stepping forward and a
  // heavy one keeps backing off until the swing is over.
  let dir = canAct ? held : 0, speed = f.guarding ? GUARD_MOVE : 1;
  const ph = attackPhase(f), swinging = ph === 'startup' || ph === 'active';
  if (f.onGround && f.attack) {
    if (f.attack.kind === 'long' && swinging) dir = f.facing;
    else if (f.attack.kind === 'heavy' && swinging) { dir = -f.facing; speed = HEAVY_MOVE; }
    else dir = 0;
  }
  if (f.onGround && f.charge > 0) dir = 0;
  const target = dir * WALK_SPEED * f.stats.move * speed;
  const diving = f.attack?.kind === 'dive' && f.attack.landed === undefined;
  if (f.ko) f.vx = approach(f.vx, 0, ICE_DECEL * dt);
  else if (f.super) f.vx = dash ? dash[2] * f.facing : f.onGround ? 0 : f.vx;
  else if (diving) { f.vx = f.facing * DIVE_SPEED * Math.SQRT1_2; f.vy = DIVE_SPEED * Math.SQRT1_2; }
  else if (world.ice && f.onGround) f.vx = approach(f.vx, target, (dir ? ICE_ACCEL : ICE_DECEL) * dt);
  else if (!f.onGround && (f.attack || f.guarding || f.stun > 0)) { /* keep air momentum */ }
  else f.vx = target;

  let kbMove = 0;
  if (f.kb > 0) { const m = Math.min(f.kb, KNOCKBACK_SPEED * dt); f.kb -= m; kbMove = m * f.kbDir; }
  f.x += f.vx * dt + kbMove;

  // vertical movement and landing (platforms are one-way)
  const prevY = f.y;
  if (!f.onGround) {
    if (!diving) f.vy += GRAVITY * dt;
    f.y += f.vy * dt;
    if (f.vy >= 0) {
      if (f.drop <= 0) {
        world.platforms.forEach((p, i) => {
          if (!f.onGround && prevY <= p.y + 0.01 && f.y >= p.y && f.x >= p.x && f.x <= p.x + p.w) {
            f.y = p.y; f.vy = 0; f.onGround = true; f.platform = i;
          }
        });
      }
      if (!f.onGround && f.y >= GROUND_Y) { f.y = GROUND_Y; f.vy = 0; f.onGround = true; f.platform = -1; }
    }
  } else if (f.platform >= 0) {
    const p = world.platforms[f.platform];
    if (f.x < p.x || f.x > p.x + p.w) { f.onGround = false; f.platform = -1; f.vy = 0; }
  }

  if (f.onGround) {
    if (f.doubled) { f.doubled = false; f.flipT = 0; }
    if (f.attack?.kind === 'dive' && f.attack.landed === undefined) { f.attack.landed = f.attack.t; f.vx = 0; }
  }
  if (f.onGround && Math.abs(f.vx) > 10) f.walk += Math.abs(f.vx) * dt;
}

const IDLE = ['idle0', 'idle01', 'idle1', 'idle10'];
const WALK = ['walk0', 'walk01', 'walk1', 'walk12', 'walk2', 'walk23', 'walk3', 'walk30'];

// Sprite frame for the current state.
export function frameName(f) {
  if (f.won) return Math.floor(f.t / 0.4) % 2 ? 'win0' : 'win';
  if (f.ko) return 'hit';
  if (f.stun > 0) return f.stun > HIT_STUN * 0.4 ? 'hit' : 'hit0';
  if (f.super) {
    const hits = f.super.def.hits, t = f.super.t;
    if (hits.some(h => t >= h.at && t < h.at + h.len)) return f.onGround ? 'attack' : 'jumpAtk';
    if (t < hits[0].at) return 'windup';
    return hits.some(h => h.at > t) ? 'windup' : 'attack';
  }
  if (f.charge > 0) return 'guard';
  const ph = attackPhase(f);
  if (ph) {
    const k = f.attack.kind, { startup, active, recovery } = attackTiming(f), t = f.attack.t;
    const early = ph === 'startup' && t < startup * 0.45, rec = (t - startup - active) / recovery;
    if (k === 'dive') return ph === 'recovery' ? 'hit0' : 'dive';
    if (k === 'aerial') return ph === 'startup' ? (early ? 'jump' : 'jumpAtk0') : 'jumpAtk';
    if (k === 'long') return ph === 'startup' ? (early ? 'longWind' : 'longAtk0') : ph === 'active' || rec < 0.4 ? 'longAtk' : 'attack1';
    if (k === 'heavy') return ph === 'startup' ? (t < startup * 0.6 ? 'heavyWind' : 'heavyAtk0') : ph === 'active' || rec < 0.5 ? 'heavyAtk' : 'attack1';
    if (ph === 'startup') return early ? 'windup0' : 'windup';
    if (ph === 'active' || rec < 0.35) return 'attack';
    return rec < 0.7 ? 'attack1' : 'idle0';
  }
  if (f.guarding) return f.onGround ? (f.guard ? 'guard' : 'guard0') : 'airGuard';
  if (!f.onGround) {
    if (f.doubled && f.flipT < FLIP_TIME) return 'flip';
    return f.vy < -250 ? 'jump' : f.vy <= 250 ? 'apex' : 'fall';
  }
  if (Math.abs(f.vx) > 10) return WALK[Math.floor(f.walk / 11) % 8];
  return IDLE[Math.floor(f.t / 0.225) % 4];
}
