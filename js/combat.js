import {
  BODY_HALF_W, BODY_H, KNOCKBACK_PER_DMG, GUARD_KNOCKBACK_RATIO, GUARD_DAMAGE, HIT_STUN,
  JUMP_ATTACK_MULT, AIR_EVADE, SUPER_MAX, SUPER_GAIN_HIT, SUPER_GAIN_GUARD,
  LONG_REACH_BONUS, HEAVY_REACH, DIVE_REACH, CHARGE_MULT, CHARGE_GUARD_RATIO, CHARGE_BREAK_STUN, SUPER_GAIN_CHARGE_GUARD,
  AIR_LASH_REACH, PARRY_WINDOW, PARRY_FREEZE
} from './config.js';
import { attackPhase, superHit, dashing } from './fighter.js';

const halfW = f => f.stats.halfW ?? BODY_HALF_W;
const height = f => f.stats.height ?? BODY_H;

// What the fighter is swinging right now: a normal attack or a super hit window.
export function strike(f) {
  const sh = superHit(f);
  if (sh) return { ...sh, super: true };
  if (attackPhase(f) !== 'active' || f.attack.hit) return null;
  const { aerial, kind } = f.attack;
  if (kind === 'charged' && (f.stats.bow || f.stats.gun)) return null; // shoots instead (game.js spawns the arrow / bullet)
  const st = f.stats, mult = aerial ? JUMP_ATTACK_MULT : kind === 'charged' ? CHARGE_MULT : 1;
  const dmg = Math.round(st.power * mult);
  const reach = kind === 'long' ? (st.reach + LONG_REACH_BONUS) * (st.longReach ?? 1)
    : kind === 'heavy' ? st.reach * (st.heavyReach ?? HEAVY_REACH)
    : kind === 'dive' ? DIVE_REACH
    : kind === 'airLash' ? st.reach * AIR_LASH_REACH
    : aerial ? st.reach * (st.airReach ?? 1) : st.reach;
  return { reach, dmg, kb: dmg * KNOCKBACK_PER_DMG, stun: HIT_STUN, aerial, kind, super: false };
}

export function hitbox(f, s = strike(f)) {
  if (!s) return null;
  const h = height(f), front = f.x + f.facing * halfW(f), tip = front + f.facing * s.reach;
  // a dive leads with the feet / blade: the box sits low and reaches below the body
  // the cowboy's air lash is a line from the hand 45° down-forward (seg: x0, y0, x1, y1)
  if (s.kind === 'airLash') {
    const x0 = front, y0 = f.y - h * 0.6, d = s.reach * Math.SQRT1_2, x1 = x0 + f.facing * d, y1 = y0 + d;
    return { x1: Math.min(x0, x1), x2: Math.max(x0, x1), y1: y0, y2: y1, seg: [x0, y0, x1, y1] };
  }
  const [y1, y2] = s.tall ? [f.y - 400, f.y + 60] : s.high ? [f.y - h * 1.6, f.y - h * 0.15] : s.kind === 'dive' ? [f.y - h * 0.55, f.y + 22] : s.aerial ? [f.y - h * 0.85, f.y + 12] : [f.y - h * 0.95, f.y - h * 0.25];
  return { x1: Math.min(front, tip), x2: Math.max(front, tip), y1, y2 };
}

export function hurtbox(f) {
  return { x1: f.x - halfW(f), x2: f.x + halfW(f), y1: f.y - height(f), y2: f.y };
}

const boxOverlap = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
// a line hitbox (seg) touches the box when any point along it (with a little thickness) is inside
const overlap = (a, b) => {
  if (!a.seg) return boxOverlap(a, b);
  if (!boxOverlap(a, b)) return false;
  const [x0, y0, x1, y1] = a.seg, pad = 4;
  for (let i = 0; i <= 24; i++) {
    const x = x0 + (x1 - x0) * i / 24, y = y0 + (y1 - y0) * i / 24;
    if (x > b.x1 - pad && x < b.x2 + pad && y > b.y1 - pad && y < b.y2 + pad) return true;
  }
  return false;
};
const gain = (f, n) => { f.meter = Math.min(SUPER_MAX, f.meter + n); };

// Normal attacks: guard reduces damage to 1 and knockback to 1/5.
// Supers: guard takes 1/4 chip unless the hit ignores (ub) or crushes the guard.
// Airborne defenders dodge with AIR_EVADE chance. Being hit charges the super gauge.
// lateGuard: the defender is holding guard when the hit is confirmed (counts even if not fully up).
// parry: check for a parry (a fresh guard press within PARRY_WINDOW before now).
// Heavy-attack armor: a defender in a heavy attack (or the mace's forward attack) takes the damage
// but no knockback or stun and keeps swinging (supers still break through). The sword's hold attack
// takes no damage at all.
export function applyHit(att, def, s = strike(att) ?? { dmg: att.stats.power, kb: att.stats.power * KNOCKBACK_PER_DMG, stun: HIT_STUN }, rand = Math.random, { lateGuard = false, parry = false } = {}) {
  if (parry && canParry(def, s)) {
    // perfect timing: no damage, the attacker freezes for a moment
    att.stun = Math.max(att.stun ?? 0, PARRY_FREEZE); att.frozen = PARRY_FREEZE; att.attack = null; att.charge = 0;
    def.guardPressT = -Infinity; def.hitFlash = 0;
    gain(def, SUPER_GAIN_GUARD);
    return { evaded: false, guarded: false, parried: true, damage: 0 };
  }
  if (!def.onGround && !s.sure && !s.noEvade && rand() < AIR_EVADE) return { evaded: true, guarded: false, damage: 0 };
  const guarded = (def.guard || lateGuard) && !s.ub;
  // the sword's hold attack landed: its next attack comes out faster
  if (!guarded && s.kind === 'heavy' && !s.super && att.stats?.holdHaste) att.haste = true;
  // charged attack vs guard: the guard breaks, half damage, and the defender gains 2 gauge
  if (guarded && s.kind === 'charged') {
    const damage = Math.max(1, Math.round(s.dmg * CHARGE_GUARD_RATIO));
    def.energy = Math.max(0, def.energy - damage);
    def.kb = s.kb * 0.5; def.kbDir = att.facing;
    def.stun = CHARGE_BREAK_STUN; def.guard = def.guarding = false; def.guardT = 0;
    def.attack = null; def.charge = 0; def.hitFlash = 0.2;
    gain(def, SUPER_GAIN_CHARGE_GUARD);
    return { evaded: false, guarded: true, broken: true, damage };
  }
  if (s.grab) {
    // pulled in front of the grabber before the throw
    def.x = att.x + att.facing * (halfW(att) + halfW(def) + 4);
    def.y = att.y; def.onGround = true; def.platform = att.platform;
  }
  const firstOfSuper = !s.super || s.index === 0;
  let damage = s.dmg, kb = s.kb;
  if (guarded) {
    damage = s.super ? Math.max(1, Math.round(s.dmg / (s.crush ? 2.5 : 4))) : GUARD_DAMAGE;
    kb *= GUARD_KNOCKBACK_RATIO;
  }
  const armored = def.attack?.kind === 'heavy' || (def.attack?.kind === 'long' && def.stats.longArmor);
  if (armored && !s.super && !guarded && def.attack.kind === 'heavy' && def.stats.holdImmune) damage = 0;
  def.energy = Math.max(0, def.energy - damage);
  if (armored && !s.super && !guarded) {
    def.hitFlash = 0.2;
    gain(def, SUPER_GAIN_HIT);
    return { evaded: false, guarded, damage, armored: true };
  }
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

// A parry needs a fresh guard press within PARRY_WINDOW (not just holding guard), a free defender,
// and an ordinary attack: supers, unblockable hits and grabs go through.
export function canParry(def, s, now = def.t) {
  return !s.super && !s.ub && !s.grab && !s.sure && !def.ko && !def.super && !def.attack && def.stun <= 0
    && now - (def.guardPressT ?? -Infinity) <= PARRY_WINDOW + 1e-9;
}

// Contacts this frame. Each attack (or super hit window) connects once; it is marked used here.
// A fighter running a super, or a stag beetle in its air dash, is invulnerable.
// A `sure` super hit connects wherever the opponent is.
export function detectHits(a, b) {
  const connects = [[a, b], [b, a]].map(([att, def]) => {
    const s = strike(att), hb = hitbox(att, s);
    return { att, def, s, hb };
  }).filter(({ def, s, hb }) => hb && !def.ko && !def.super && (s.sure || (!dashing(def) && overlap(hb, hurtbox(def)))));
  for (const { att, s } of connects) if (s.super) att.super.done.add(s.index); else att.attack.hit = true;
  return connects.map(c => ({ ...c, x: (Math.max(c.hb.x1, c.def.x - halfW(c.def)) + Math.min(c.hb.x2, c.def.x + halfW(c.def))) / 2 }));
}

export function confirmHit({ att, def, s, x }, rand = Math.random, opts) {
  const r = applyHit(att, def, s, rand, opts);
  return { attacker: att, defender: def, ...r, super: s.super, x, y: def.y - height(def) * 0.6 };
}

// Immediate resolution: both hitboxes are evaluated before applying, so same-frame hits trade.
export function resolveHits(a, b, rand = Math.random) {
  return detectHits(a, b).map(c => confirmHit(c, rand));
}
