import {
  WEAPONS, SUPERS, MAX_ENERGY, GROUND_Y, GRAVITY, JUMP_V, WALK_SPEED, KNOCKBACK_SPEED,
  DROP_THROUGH_TIME, ICE_ACCEL, ICE_DECEL, GUARD_MOVE, SUPER_MAX, SUPER_HOLD, HIT_STUN,
  LONG_ATTACK_SLOW, HEAVY_MOVE, DOUBLE_JUMP_V, FLIP_TIME, DIVE_SPEED, DIVE_LAND_RECOVERY, canDoubleJump,
  TURN_DELAY, RUSH_TIME, RUSH_COOLDOWN, CHARGE_TIME, AIR_DASH_DIST, AIR_DASH_TIME, AIR_DASH_ATTACK, BODY_H,
  BLINK_TAP, BLINK_HOLD, BLINK_DIST, BLINK_COOLDOWN, HOLD_HASTE, GUN_LOAD, REEL_DIST, REEL_TIME, REEL_COOLDOWN
} from './config.js';

export const NO_INPUT = Object.freeze({ left: false, right: false, jump: false, down: false, attack: false, guard: false });

export function createFighter(weapon, x, facing) {
  return {
    weapon, stats: WEAPONS[weapon], x, y: GROUND_Y, vx: 0, vy: 0, onGround: true, platform: -1, facing,
    energy: MAX_ENERGY, attack: null, guard: false, guarding: false, guardT: 0, stun: 0,
    meter: 0, charge: 0, super: null, kb: 0, kbDir: 0, drop: 0,
    canDouble: canDoubleJump(weapon), doubled: false, flipT: 0, airDash: null, wantFacing: facing, turnT: 0,
    lastFwd: Infinity, blinkArm: null, blinkCD: 0, blinked: false,
    lastBack: Infinity, reelArm: null, reelCD: 0, reel: null, rush: null, rushCD: 0, lashed: false, haste: false, guardPressT: -Infinity,
    trapAcc: 0, inTrap: false, hitFlash: 0, ko: false, won: false, prevInput: NO_INPUT, walk: 0, t: 0
  };
}

// Attack kinds: normal, aerial, long (walking forward), heavy (walking backward, long reach),
// dive (attack during a double jump: active until landing, then a short recovery),
// airLash (cowboy's double-jump attack: hovers in place and lashes 45° down-forward).
// Times are in attack time; a hasted attack (sword after a landed hold attack) advances faster.
export function attackTiming(f) {
  const s = f.stats, k = f.attack?.kind;
  if (k === 'long') return { startup: s.startup * LONG_ATTACK_SLOW, active: s.active * LONG_ATTACK_SLOW, recovery: s.recovery * LONG_ATTACK_SLOW };
  if (k === 'dive') return { startup: 0.05, active: Infinity, recovery: DIVE_LAND_RECOVERY };
  if (k === 'charged') return { startup: s.gun ? GUN_LOAD : CHARGE_TIME, active: s.active, recovery: s.recovery };
  if (k === 'heavy' && s.heavyHold) return { startup: s.startup + s.heavyHold, active: s.active, recovery: s.recovery };
  return s;
}

export function attackPhase(f) {
  if (!f.attack) return null;
  if (untilLanding(f.attack.kind)) return f.attack.landed !== undefined ? 'recovery' : f.attack.t < 0.05 ? 'startup' : 'active';
  const { startup, active } = attackTiming(f), t = f.attack.t;
  if (t < startup) return 'startup';
  if (t < startup + active) return 'active';
  return 'recovery';
}

// dives stay active until they hit the ground, then recover briefly
export const untilLanding = k => k === 'dive';
// seconds of real time the attack's charge (startup) still needs
export const chargeLeft = f => f.attack?.kind === 'charged' ? Math.max(0, attackTiming(f).startup - f.attack.t) / (f.attack.speed ?? 1) : 0;

const attackOver = f => {
  if (untilLanding(f.attack.kind)) return f.attack.landed !== undefined && f.attack.t - f.attack.landed >= attackTiming(f).recovery;
  const { startup, active, recovery } = attackTiming(f);
  return f.attack.t >= startup + active + recovery;
};

// Stag beetle air dash: level flight, untouchable, no attacks until the very end.
export const dashing = f => !!f.airDash && f.airDash.t < AIR_DASH_TIME;
const dashLocked = f => (dashing(f) && f.airDash.t < AIR_DASH_TIME - AIR_DASH_ATTACK) || !!f.reel || !!f.rush;

// Current hit window of the running super, or null.
export function superHit(f) {
  if (!f.super) return null;
  const t = f.super.t;
  const i = f.super.def.hits.findIndex(h => t >= h.at && t < h.at + h.len);
  // lasso lashes only land on an opponent the lasso caught
  if (i >= 0 && f.super.def.hits[i].lasso && !f.super.caught) return null;
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
  f.frozen = Math.max(0, (f.frozen || 0) - dt);
  f.drop = Math.max(0, f.drop - dt);
  if (f.ko) f.super = null;
  const canAct = f.stun <= 0 && !f.ko && !f.super;

  // turning around after a cross-up is delayed; pressing attack or guard turns at once
  if (f.wantFacing !== f.facing && !f.attack && !f.super && !f.ko && !dashing(f)) {
    f.turnT += dt;
    if (f.turnT >= TURN_DELAY || pressed('attack') || pressed('guard')) { f.facing = f.wantFacing; f.turnT = 0; }
  } else f.turnT = 0;

  if (pressed('guard')) f.guardPressT = f.t;   // fresh guard press: a parry if a hit lands right after
  if (f.attack) {
    f.attack.t += dt * (f.attack.speed ?? 1);
    if (!input.attack) f.attack.held = false;
    if (f.attack.kind === 'charged' && f.attack.t < attackTiming(f).startup && !input.attack) f.attack = null; // let go: charge cancelled
    else if (attackOver(f)) {
      // still holding attack after a ground swing → charge into a guard-breaking attack
      const chain = f.attack.held && !input.guard && ['normal', 'long', 'heavy'].includes(f.attack.kind) && f.onGround && f.stun <= 0;
      f.attack = chain ? startAttack(f, 'charged', false) : null;
    }
  }
  if (f.doubled && !f.onGround) f.flipT += dt;
  if (f.airDash) { f.airDash.t += dt; if (f.onGround) f.airDash = null; }
  let dash = null;
  if (f.super) {
    f.super.t += dt;
    const hop = f.super.def.hop;
    if (hop && !f.super.hopped && f.super.t >= hop.at && f.onGround) {
      // a small 45° hop: equal forward and upward speed
      f.super.hopped = true; f.vy = -hop.v; f.vx = f.facing * hop.v; f.onGround = false; f.platform = -1;
    }
    dash = f.super.def.dash?.find(([a, b]) => f.super.t >= a && f.super.t < b);
    if (f.super.t >= f.super.def.time) f.super = null;
  }

  // forward double-tap, second tap held: the dagger blinks, Genghis's horse rushes ahead
  f.lastFwd += dt; f.blinkCD = Math.max(0, f.blinkCD - dt); f.blinked = false;
  f.rushCD = Math.max(0, f.rushCD - dt);
  if (f.rush && ((f.rush.t += dt) >= RUSH_TIME || f.stun > 0 || f.ko || f.super)) f.rush = null;
  if (f.stats.blink || f.stats.rush) {
    const fwd = f.facing > 0 ? 'right' : 'left';
    if (pressed(fwd)) { f.blinkArm = f.lastFwd < BLINK_TAP ? 0 : null; f.lastFwd = 0; }
    else if (!input[fwd]) f.blinkArm = null;
    else if (f.blinkArm !== null && (f.blinkArm += dt) >= BLINK_HOLD && canAct && !f.attack && !f.rush) {
      if (f.stats.blink && f.blinkCD <= 0) {
        f.x += f.facing * BLINK_DIST * (f.stats.height ?? BODY_H);
        f.blinked = true; f.blinkArm = null; f.blinkCD = BLINK_COOLDOWN;
      } else if (f.stats.rush && f.rushCD <= 0) {
        f.rush = { t: 0, dir: f.facing };
        f.blinkArm = null; f.rushCD = RUSH_COOLDOWN;
      }
    }
  }

  // cowboy reel: tap back twice and keep holding the second tap → the whip hooks the ground
  // behind and reels him back REEL_DIST body heights over REEL_TIME
  f.lastBack += dt; f.reelCD = Math.max(0, f.reelCD - dt);
  if (f.reel && ((f.reel.t += dt) >= REEL_TIME || !canAct)) f.reel = null;
  if (f.stats.reel) {
    const back = f.facing > 0 ? 'left' : 'right';
    if (pressed(back)) { f.reelArm = f.lastBack < BLINK_TAP ? 0 : null; f.lastBack = 0; }
    else if (!input[back]) f.reelArm = null;
    else if (f.reelArm !== null && (f.reelArm += dt) >= BLINK_HOLD && canAct && !f.attack && f.onGround && f.reelCD <= 0 && !f.reel) {
      f.reel = { t: 0, dir: -f.facing, from: f.x };
      f.reelArm = null; f.reelCD = REEL_COOLDOWN;
    }
  }

  // guard comes up after the weapon's guardUp time
  f.guarding = canAct && input.guard && !f.attack && !f.reel && !f.rush;
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
  if (canAct && !f.attack && !input.guard && !dashLocked(f) && pressed('attack')) {
    let kind = 'normal';
    // during a double jump: a 45° dive, or the cowboy's hovering whip lash (once per double jump)
    if (!f.onGround) kind = f.doubled && f.canDouble ? (f.stats.airLash ? (f.lashed ? 'aerial' : 'airLash') : 'dive') : 'aerial';
    else if (held === f.facing) kind = 'long';
    else if (held === -f.facing && (!f.canDouble || f.stats.heavy)) kind = 'heavy';
    if (kind === 'airLash') { f.lashed = true; f.vx = 0; f.vy = 0; }
    f.attack = startAttack(f, kind, !f.onGround);
  }
  if (canAct && !f.attack && !f.reel && !f.rush && f.onGround && pressed('jump')) { f.vy = -JUMP_V; f.onGround = false; f.platform = -1; }
  // double jump (short-reach fighters): a somersault in mid-air
  else if (canAct && !f.attack && !f.onGround && f.canDouble && !f.doubled && pressed('jump')) { f.vy = -DOUBLE_JUMP_V; f.doubled = true; f.flipT = 0; }
  // stag beetle: the second jump is a level dash in the travel direction
  else if (canAct && !f.attack && !f.onGround && f.stats.airDash && !f.doubled && pressed('jump')) {
    f.doubled = true;
    f.airDash = { t: 0, dir: held || Math.sign(f.vx) || f.facing };
  }
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
  const diving = untilLanding(f.attack?.kind) && f.attack.landed === undefined;
  const hovering = f.attack?.kind === 'airLash' && !f.onGround && f.stun <= 0;
  if (f.ko) f.vx = approach(f.vx, 0, ICE_DECEL * dt);
  else if (f.super?.hover) { f.vx = 0; f.vy = 0; }   // carried by the super (game.js moves it)
  else if (f.super) {
    f.vx = dash ? dash[2] * f.facing : f.onGround || f.super.def.dash?.some(d => d[3]) ? 0 : f.vx;
    // a rising dash climbs at a slant to `rise` body heights by its end
    if (dash?.[3]) { f.vy = -dash[3] * (f.stats.height ?? BODY_H) / (dash[1] - dash[0]); f.onGround = false; f.platform = -1; }
  }
  else if (hovering) { f.vx = 0; f.vy = 0; }
  else if (f.reel) f.vx = f.reel.dir * REEL_DIST * (f.stats.height ?? BODY_H) / REEL_TIME;
  else if (f.rush) f.vx = f.rush.dir * BLINK_DIST * BODY_H / RUSH_TIME;
  else if (diving) { f.vx = f.facing * DIVE_SPEED * Math.SQRT1_2; f.vy = DIVE_SPEED * Math.SQRT1_2; }
  else if (dashing(f)) { f.vx = f.airDash.dir * AIR_DASH_DIST / AIR_DASH_TIME; f.vy = 0; }
  else if (world.ice && f.onGround) f.vx = approach(f.vx, target, (dir ? ICE_ACCEL : ICE_DECEL) * dt);
  else if (!f.onGround && (f.attack || f.guarding || f.stun > 0)) { /* keep air momentum */ }
  else f.vx = target;

  let kbMove = 0;
  if (f.kb > 0) { const m = Math.min(f.kb, KNOCKBACK_SPEED * dt); f.kb -= m; kbMove = m * f.kbDir; }
  f.x += f.vx * dt + kbMove;

  // vertical movement and landing (platforms are one-way)
  const prevY = f.y;
  if (!f.onGround) {
    const rising = f.super?.def.dash?.some(d => d[3] && f.super.t >= d[0] && f.super.t < d[1]);
    if (!diving && !hovering && !dashing(f) && !f.super?.hover && !rising) f.vy += GRAVITY * (world.gravity ?? 1) * dt;
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
    f.lashed = false;
    if (untilLanding(f.attack?.kind) && f.attack.landed === undefined) { f.attack.landed = f.attack.t; f.vx = 0; }
  }
  if (f.onGround && Math.abs(f.vx) > 10) f.walk += Math.abs(f.vx) * dt;
}

// A new attack; the sword's haste (after a landed hold attack) speeds up exactly one attack.
function startAttack(f, kind, aerial) {
  const a = { t: 0, kind, aerial, hit: false, held: true };
  if (f.haste) { a.speed = HOLD_HASTE; f.haste = false; }
  return a;
}

// Motion chains as drawn by tools/art/rig.js (a>b is the midpoint frame between a and b).
const mid = list => list.flatMap((n, i) => (i < list.length - 1 ? [n, `${n}>${list[i + 1]}`] : [n]));
const IDLE = mid(['idle0', 'idle01', 'idle1', 'idle10', 'idle0']).slice(0, -1);
const WALK = mid(['walk0', 'walk01', 'walk1', 'walk12', 'walk2', 'walk23', 'walk3', 'walk30', 'walk0']).slice(0, -1);
const WINDUP = ['idle0>windup0', 'windup0', 'windup0>windup', 'windup'];
const RECOVER = (from, via = 'attack1') => [from, `${from}>${via}`, via, `${via}>idle0`];
// u in [0, 1) picks a frame from the list
const pick = (list, u) => list[Math.min(list.length - 1, Math.max(0, Math.floor((u || 0) * list.length)))];

// Body turn for the taekwondo back kick: 1 = facing the opponent, -1 = back to the opponent.
// The sprite's x scale is multiplied by this, so the turn reads as the body spinning around.
export function turnScale(f) {
  if (f.attack?.kind !== 'charged' || !f.stats.backKick || f.super || f.stun > 0) return 1;
  const T = attackTiming(f), t = f.attack.t;
  if (t < T.startup) { const v = (t / T.startup - 0.55) / 0.45; return v <= 0 ? 1 : Math.cos(Math.PI * Math.min(1, v)); }
  if (t < T.startup + T.active) return -1;
  const v = ((t - T.startup - T.active) / T.recovery - 0.35) / 0.65;
  return v <= 0 ? -1 : -Math.cos(Math.PI * Math.min(1, v));
}

// Sprite frame for the current state.
export function frameName(f) {
  if (f.won) return pick(['win', 'win>win0', 'win0', 'win0>win'], (f.t / 0.8) % 1);
  if (f.ko) return 'hit';
  if (f.stun > 0) return pick(RECOVER('hit', 'hit0'), 1 - Math.min(1, f.stun / HIT_STUN));
  if (f.super) {
    const def = f.super.def, hits = def.hits, t = f.super.t;
    if (!hits.length) return t < def.time * 0.4 ? pick(WINDUP, t / (def.time * 0.4)) : 'win'; // summons: a call, then a pointing pose
    if (f.super.flying) return 'flip';
    if (hits.some(h => t >= h.at && t < h.at + h.len)) return def.hitFrame ?? (f.onGround ? 'attack' : 'jumpAtk');
    if (t < hits[0].at) return pick(WINDUP, t / hits[0].at);
    const last = hits[hits.length - 1], end = last.at + last.len;
    return t < end ? 'windup' : pick(RECOVER('attack'), (t - end) / Math.max(0.01, def.time - end));
  }
  if (f.charge > 0) return 'guard';
  const ph = attackPhase(f);
  if (ph) {
    const k = f.attack.kind, T = attackTiming(f), t = f.attack.t;
    const us = t / T.startup, ua = (t - T.startup) / T.active, ur = (t - T.startup - T.active) / T.recovery;
    if (k === 'dive') return ph === 'recovery' ? pick(['hit0', 'hit0>idle0'], (t - f.attack.landed) / DIVE_LAND_RECOVERY) : pick(['flip>dive', 'dive'], t / 0.1);
    if (k === 'airLash') {
      if (ph === 'startup') return pick(['jump', 'jump>airLash'], us);
      return ph === 'active' ? 'airLash' : pick(['airLash', 'airLash>fall'], ur);
    }
    if (k === 'aerial') return ph === 'startup' ? pick(['jump', 'jump>jumpAtk0', 'jumpAtk0', 'jumpAtk0>jumpAtk'], us) : 'jumpAtk';
    if (k === 'long') {
      if (ph === 'startup') return pick(['idle0>longWind', 'longWind', 'longWind>longAtk0', 'longAtk0', 'longAtk0>longAtk'], us);
      return ph === 'active' ? 'longAtk' : pick(RECOVER('longAtk'), ur);
    }
    if (k === 'heavy') {
      // rise, hold at the top (taekwondo axe kick), then chop
      const base = f.stats.startup, hold = f.stats.heavyHold || 0, rise = base * 0.6;
      if (ph === 'startup') {
        if (t < rise) return pick(['idle0>heavyWind', 'heavyWind'], t / rise);
        if (t < rise + hold) return 'heavyWind';
        return pick(['heavyWind>heavyAtk0', 'heavyAtk0'], (t - rise - hold) / (base - rise));
      }
      return ph === 'active' ? pick(['heavyAtk0>heavyAtk', 'heavyAtk'], ua * 2) : pick(RECOVER('heavyAtk'), ur);
    }
    if (k === 'charged' && (f.stats.bow || f.stats.gun)) {
      if (ph === 'startup') return pick(['idle0>bowDraw', 'bowDraw'], us * 2.5);
      return pick(['bowDraw>bowShot', 'bowShot', 'bowShot>idle0'], (t - T.startup) / (T.active + T.recovery));
    }
    if (k === 'charged' && f.stats.backKick) {
      if (ph === 'startup') return us < 0.55 ? pick(['idle0>chargeHold', 'chargeHold'], us / 0.55 * 2) : pick(['chargeHold>backTurn', 'backTurn'], (us - 0.55) / 0.45);
      if (ph === 'active') return pick(['backTurn>backKick', 'backKick'], ua * 2);
      return ur < 0.35 ? 'backKick' : pick(['backKick>backTurn', 'backTurn', 'backTurn>idle0'], (ur - 0.35) / 0.65);
    }
    if (k === 'charged') {
      if (ph === 'startup') return pick(['idle0>chargeHold', 'chargeHold'], us / 0.4);
      return ph === 'active' ? pick(['chargeHold>chargeAtk', 'chargeAtk'], ua * 2) : pick(RECOVER('chargeAtk'), ur);
    }
    if (ph === 'startup') return pick(WINDUP, us);
    return ph === 'active' ? pick(['windup>attack', 'attack'], ua * 2) : pick(RECOVER('attack'), ur);
  }
  if (f.reel) return pick(['airLash>fall', 'fall'], f.reel.t / 0.08);
  if (f.rush) return WALK[Math.floor(f.rush.t * 40) % WALK.length]; // a fast gallop
  if (f.guarding) return f.onGround ? (f.guard ? 'guard' : pick(['idle0>guard0', 'guard0', 'guard0>guard'], f.guardT / f.stats.guardUp)) : 'airGuard';
  if (!f.onGround) {
    if (dashing(f)) return pick(['jump>airDash', 'airDash'], f.airDash.t / 0.06);
    if (f.doubled && f.canDouble && f.flipT < FLIP_TIME) return f.flipT < 0.05 ? 'jump>flip' : 'flip';
    return pick(['jump', 'jump>apex', 'apex', 'apex>fall', 'fall'], (f.vy + 400) / 800);
  }
  if (Math.abs(f.vx) > 10) return WALK[Math.floor(f.walk / 5.5) % WALK.length];
  return IDLE[Math.floor(f.t / 0.1125) % IDLE.length];
}
