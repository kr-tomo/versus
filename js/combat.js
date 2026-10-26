import {
  BODY_HALF_W, BODY_H, KNOCKBACK_PER_DMG, GUARD_KNOCKBACK_RATIO, GUARD_DAMAGE, HIT_STUN
} from './config.js';
import { attackPhase } from './fighter.js';

export function hitbox(f) {
  if (attackPhase(f) !== 'active' || f.attack.hit) return null;
  const front = f.x + f.facing * BODY_HALF_W, tip = front + f.facing * f.stats.reach;
  const [y1, y2] = f.attack.aerial ? [f.y - BODY_H * 0.85, f.y + 12] : [f.y - BODY_H * 0.95, f.y - BODY_H * 0.25];
  return { x1: Math.min(front, tip), x2: Math.max(front, tip), y1, y2 };
}

export function hurtbox(f) {
  return { x1: f.x - BODY_HALF_W, x2: f.x + BODY_HALF_W, y1: f.y - BODY_H, y2: f.y };
}

const overlap = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

// Guard always reduces damage to 1 and knockback to 1/5.
export function applyHit(att, def) {
  const guarded = def.guard;
  const power = att.stats.power;
  const damage = guarded ? GUARD_DAMAGE : power;
  def.energy = Math.max(0, def.energy - damage);
  def.kb = power * KNOCKBACK_PER_DMG * (guarded ? GUARD_KNOCKBACK_RATIO : 1);
  def.kbDir = att.facing;
  if (!guarded) { def.stun = HIT_STUN; def.attack = null; def.hitFlash = 0.2; }
  return { guarded, damage };
}

// Both hitboxes are evaluated before applying, so simultaneous hits trade.
export function resolveHits(a, b) {
  const connects = [[a, b, hitbox(a)], [b, a, hitbox(b)]].filter(([, def, hb]) => hb && !def.ko && overlap(hb, hurtbox(def)));
  for (const [att] of connects) att.attack.hit = true;
  const events = [];
  for (const [att, def, hb] of connects) {
    const r = applyHit(att, def);
    events.push({ attacker: att, defender: def, ...r, x: (Math.max(hb.x1, def.x - BODY_HALF_W) + Math.min(hb.x2, def.x + BODY_HALF_W)) / 2, y: def.y - BODY_H * 0.6 });
  }
  return events;
}
