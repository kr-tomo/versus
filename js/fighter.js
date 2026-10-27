import {
  WEAPONS, SUPERS, MAX_ENERGY, GROUND_Y, GRAVITY, JUMP_V, WALK_SPEED, KNOCKBACK_SPEED,
  DROP_THROUGH_TIME, ICE_ACCEL, ICE_DECEL, GUARD_MOVE, SUPER_MAX, SUPER_HOLD
} from './config.js';

export const NO_INPUT = Object.freeze({ left: false, right: false, jump: false, down: false, attack: false, guard: false });

export function createFighter(weapon, x, facing) {
  return {
    weapon, stats: WEAPONS[weapon], x, y: GROUND_Y, vx: 0, vy: 0, onGround: true, platform: -1, facing,
    energy: MAX_ENERGY, attack: null, guard: false, guarding: false, guardT: 0, stun: 0,
    meter: 0, charge: 0, super: null, kb: 0, kbDir: 0, drop: 0,
    trapAcc: 0, inTrap: false, hitFlash: 0, ko: false, won: false, prevInput: NO_INPUT, walk: 0, t: 0
  };
}

export function attackPhase(f) {
  if (!f.attack) return null;
  const { startup, active } = f.stats, t = f.attack.t;
  if (t < startup) return 'startup';
  if (t < startup + active) return 'active';
  return 'recovery';
}

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
    const s = f.stats;
    if (f.attack.t >= s.startup + s.active + s.recovery) f.attack = null;
  }
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

  if (canAct && !f.attack && !input.guard && pressed('attack')) f.attack = { t: 0, aerial: !f.onGround, hit: false };
  if (canAct && !f.attack && f.onGround && pressed('jump')) { f.vy = -JUMP_V; f.onGround = false; f.platform = -1; }
  if (canAct && !f.attack && f.onGround && f.platform >= 0 && input.down) { f.drop = DROP_THROUGH_TIME; f.onGround = false; f.platform = -1; f.vy = 0; }

  // horizontal movement; guarding slows the walk
  let dir = canAct ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0;
  if (f.onGround && (f.attack || f.charge > 0)) dir = 0;
  const target = dir * WALK_SPEED * f.stats.move * (f.guarding ? GUARD_MOVE : 1);
  if (f.ko) f.vx = approach(f.vx, 0, ICE_DECEL * dt);
  else if (f.super) f.vx = dash ? dash[2] * f.facing : f.onGround ? 0 : f.vx;
  else if (world.ice && f.onGround) f.vx = approach(f.vx, target, (dir ? ICE_ACCEL : ICE_DECEL) * dt);
  else if (!f.onGround && (f.attack || f.guarding || f.stun > 0)) { /* keep air momentum */ }
  else f.vx = target;

  let kbMove = 0;
  if (f.kb > 0) { const m = Math.min(f.kb, KNOCKBACK_SPEED * dt); f.kb -= m; kbMove = m * f.kbDir; }
  f.x += f.vx * dt + kbMove;

  // vertical movement and landing (platforms are one-way)
  const prevY = f.y;
  if (!f.onGround) {
    f.vy += GRAVITY * dt;
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

  if (f.onGround && Math.abs(f.vx) > 10) f.walk += Math.abs(f.vx) * dt;
}

// Sprite frame for the current state.
export function frameName(f) {
  if (f.won) return 'win';
  if (f.ko || f.stun > 0) return 'hit';
  if (f.super) {
    const hits = f.super.def.hits, t = f.super.t;
    if (hits.some(h => t >= h.at && t < h.at + h.len)) return f.onGround ? 'attack' : 'jumpAtk';
    if (t < hits[0].at) return 'windup';
    return hits.some(h => h.at > t) ? 'windup' : 'attack';
  }
  if (f.charge > 0) return 'guard';
  const ph = attackPhase(f);
  if (ph) {
    if (f.attack.aerial) return ph === 'startup' ? 'jump' : 'jumpAtk';
    if (ph === 'startup') return 'windup';
    if (ph === 'active' || f.attack.t < f.stats.startup + f.stats.active + f.stats.recovery * 0.6) return 'attack';
    return 'idle0';
  }
  if (f.guarding) return f.onGround ? 'guard' : 'airGuard';
  if (!f.onGround) return f.vy < 0 ? 'jump' : 'fall';
  if (Math.abs(f.vx) > 10) return 'walk' + (Math.floor(f.walk / 22) % 4);
  return Math.floor(f.t / 0.45) % 2 ? 'idle1' : 'idle0';
}
