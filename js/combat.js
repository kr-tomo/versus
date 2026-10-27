import {
  BODY_HALF_W, BODY_H, KNOCKBACK_PER_DMG, GUARD_KNOCKBACK_RATIO, GUARD_DAMAGE, HIT_STUN,
  JUMP_ATTACK_MULT, AIR_EVADE, SUPER_MAX, SUPER_GAIN_HIT, SUPER_GAIN_GUARD
} from './config.js';
import { attackPhase, superHit } from './fighter.js';

const halfW = f => f.stats.halfW ?? BODY_HALF_W;
const height = f => f.stats.height ?? BODY_H;

// What the fighter is swinging right now: a normal attack or a super hit window.
export function strike(f) {
  const sh = superHit(f);
  if (sh) return { ...sh, super: true };
  if (attackPhase(f) !== 'active' || f.attack.hit) return null;
  const aerial = f.attack.aerial;
  const dmg = aerial ? Math.round(f.stats.power * JUMP_ATTACK_MULT) : f.stats.power;
  return { reach: f.stats.reach, dmg, kb: dmg * KNOCKBACK_PER_DMG, stun: HIT_STUN, aerial, super: false };
}

export function hitbox(f, s = strike(f)) {
  if (!s) return null;
  const h = height(f), front = f.x + f.facing * halfW(f), tip = front + f.facing * s.reach;
  const [y1, y2] = s.aerial ? [f.y - h * 0.85, f.y + 12] : [f.y - h * 0.95, f.y - h * 0.25];
  return { x1: Math.min(front, tip), x2: Math.max(front, tip), y1, y2 };
}

export function hurtbox(f) {
  return { x1: f.x - halfW(f), x2: f.x + halfW(f), y1: f.y - height(f), y2: f.y };
}

const overlap = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
const gain = (f, n) => { f.meter = Math.min(SUPER_MAX, f.meter + n); };

// Normal attacks: guard reduces damage to 1 and knockback to 1/5.
// Supers: guard takes 1/4 chip unless the hit ignores (ub) or crushes the guard.
// Airborne defenders dodge with AIR_EVADE chance. Being hit charges the super gauge.
export function applyHit(att, def, s = strike(att) ?? { dmg: att.stats.power, kb: att.stats.power * KNOCKBACK_PER_DMG, stun: HIT_STUN }, rand = Math.random) {
  if (!def.onGround && rand() < AIR_EVADE) return { evaded: true, guarded: false, damage: 0 };
  const guarded = def.guard && !s.ub;
  const firstOfSuper = !s.super || s.index === 0;
  let damage = s.dmg, kb = s.kb;
  if (guarded) {
    damage = s.super ? Math.max(1, Math.round(s.dmg / (s.crush ? 2.5 : 4))) : GUARD_DAMAGE;
    kb *= GUARD_KNOCKBACK_RATIO;
  }
  def.energy = Math.max(0, def.energy - damage);
  def.kb = kb;
  def.kbDir = att.facing;
  if (!guarded || s.crush) {
    def.stun = guarded ? 0.6 : s.stun;
    def.attack = null; def.charge = 0; def.hitFlash = 0.2;
    if (s.crush) def.guard = def.guarding = false;
    if (s.launch && !guarded) { def.vy = -s.launch; def.onGround = false; def.platform = -1; }
    if (firstOfSuper) gain(def, SUPER_GAIN_HIT);
  } else if (firstOfSuper) gain(def, SUPER_GAIN_GUARD);
  return { evaded: false, guarded, damage };
}

// Both hitboxes are evaluated before applying, so simultaneous hits trade.
// A fighter running a super is invulnerable.
export function resolveHits(a, b, rand = Math.random) {
  const connects = [[a, b], [b, a]].map(([att, def]) => {
    const s = strike(att), hb = hitbox(att, s);
    return [att, def, s, hb];
  }).filter(([, def, , hb]) => hb && !def.ko && !def.super && overlap(hb, hurtbox(def)));
  for (const [att, , s] of connects) if (s.super) att.super.done.add(s.index); else att.attack.hit = true;
  const events = [];
  for (const [att, def, s, hb] of connects) {
    const r = applyHit(att, def, s, rand);
    events.push({
      attacker: att, defender: def, ...r, super: s.super,
      x: (Math.max(hb.x1, def.x - halfW(def)) + Math.min(hb.x2, def.x + halfW(def))) / 2, y: def.y - height(def) * 0.6
    });
  }
  return events;
}
