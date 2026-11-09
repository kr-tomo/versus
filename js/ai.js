import { BODY_HALF_W, BODY_H, HIT_CONFIRM, PARRY_WINDOW, SUPER_MAX, SUPERS, LONG_REACH_BONUS, HEAVY_REACH, ARROW_RANGE, VIEW_W, CHARGE_TIME, GUN_LOAD, BULLET_RANGE, AIR_LASH_REACH } from './config.js';
import { attackPhase, attackTiming } from './fighter.js';

// guard: chance to notice an incoming attack; guardLag: extra delay before raising the guard
// (added to the weapon's own guardUp), so even hard misses blocks sometimes.
// backoff: about every BACKOFF_EVERY seconds, the chance to back away and open up some distance.
const LEVELS = {
  easy: { backoff: 0.7, react: 0.45, guard: 0.25, guardLag: 0.12, attack: 0.5, avoidTrap: 0.5, spacing: false, punish: false, jump: 0.04, superUse: 0.15, parry: 0.02, reel: 0.1 },
  hard: { backoff: 0.3, react: 0.14, guard: 0.5, guardLag: 0.08, attack: 0.9, avoidTrap: 1, spacing: true, punish: true, jump: 0.08, superUse: 0.6, parry: 0.06, reel: 0.3 }
};
const halfW = f => f.stats.halfW ?? BODY_HALF_W;
const BACKOFF_EVERY = [16, 24];   // seconds between rolls ("about every 20s")
const BACKOFF_TIME = [1.2, 2.0];  // how long it keeps backing away

// Computer player. Decides every `react` seconds and holds that input in between.
export class AI {
  constructor(level, rand = Math.random) {
    this.p = LEVELS[level];
    this.rand = rand;
    this.cool = 0;
    this.input = { left: false, right: false, jump: false, down: false, attack: false, guard: false };
    this.backoffClock = this.span(BACKOFF_EVERY);
    this.retreat = 0;
  }

  span([a, b]) { return a + this.rand() * (b - a); }

  update(dt, me, op, game) {
    this.cool -= dt;
    // now and then, back away for a moment (easy does it more often than hard)
    this.retreat = Math.max(0, this.retreat - dt);
    if ((this.backoffClock -= dt) <= 0) {
      this.backoffClock = this.span(BACKOFF_EVERY);
      if (this.rand() < this.p.backoff) this.retreat = this.span(BACKOFF_TIME);
    }
    // release one-shot buttons so they register as fresh presses next time
    this.input.jump = false;
    // holding attack + guard to fire the super
    if (this.charging) {
      if (me.super || me.stun > 0 || me.meter < SUPER_MAX || !me.onGround) this.charging = false;
      else return { ...this.input, attack: true, guard: true };
    }
    // scripted taps (the cowboy's back double-tap + hold)
    if (this.seq?.length) {
      const st = this.seq[0];
      st[0] -= dt;
      if (st[0] <= 0) this.seq.shift();
      return { ...this.input, attack: false, guard: false, left: false, right: false, ...st[1] };
    }
    // keep holding attack to chain a charged (guard-breaking) swing
    if (this.holdAttack > 0) { this.holdAttack -= dt; this.input.attack = true; return { ...this.input }; }
    this.input.attack = false;
    if (this.pendingGuard > 0 && (this.pendingGuard -= dt) <= 0) this.input.guard = true;
    if (this.cool > 0) return { ...this.input };
    this.cool = this.p.react * (0.7 + this.rand() * 0.6);
    this.decide(me, op, game);
    return { ...this.input };
  }

  decide(me, op, game) {
    const p = this.p, r = this.rand, inp = this.input;
    inp.left = inp.right = inp.guard = inp.down = false;
    this.pendingGuard = 0;
    const dir = op.x >= me.x ? 1 : -1;
    const gap = Math.abs(op.x - me.x) - halfW(me) - halfW(op);
    const myReach = me.stats.reach, opReach = op.stats.reach;
    const opPhase = attackPhase(op);
    const move = d => { if (d > 0) inp.right = true; else if (d < 0) inp.left = true; };

    // standing in a trap: get out
    if (me.inTrap) { move(dir); inp.jump = me.onGround; return; }

    // backing off: walk away (hopping over a trap behind), still guarding against a swing
    if (this.retreat > 0 && !me.super) {
      move(-dir);
      const behind = me.x - dir * 40;
      if (me.onGround && game.layout.traps.some(t => behind > t.x && behind < t.x + t.w)) inp.jump = true;
      if ((attackPhase(op) === 'startup' || attackPhase(op) === 'active') && gap < opReach + 20 && r() < p.guard) inp.guard = true;
      return;
    }

    // threatened by an incoming attack (or a super, which can't be interrupted)
    const threat = op.super || op.charge > 0 || ((opPhase === 'startup' || opPhase === 'active') && gap < opReach + 20);
    // now and then: a parry — let go of guard, then tap it just before the swing lands
    if (!op.super && opPhase === 'startup' && gap < opReach + 20 && !me.attack && r() < p.parry) {
      const left = (attackTiming(op).startup - op.attack.t) / (op.attack.speed ?? 1);
      this.pendingGuard = Math.max(0.01, left - 0.02);
      this.cool = this.pendingGuard + 0.25;
      return;
    }
    if (threat && r() < p.guard) {
      // back off slowly behind the guard and hold it long enough to come up
      this.pendingGuard = p.guardLag * (0.5 + r());
      // a press that lands inside the parry window would be a parry: the computer only gets that
      // right now and then — otherwise it raises the guard at once, or is simply too late
      // (an active swing may connect any moment: treat it as already too close)
      const confirmIn = op.super ? Infinity : opPhase === 'startup' ? (attackTiming(op).startup - op.attack.t) / (op.attack.speed ?? 1) + HIT_CONFIRM
        : opPhase === 'active' ? 0 : Infinity;
      if (confirmIn - this.pendingGuard <= PARRY_WINDOW + 0.04 && r() >= p.parry) {
        if (confirmIn > PARRY_WINDOW + 0.05) this.pendingGuard = 0.001;
        else { this.pendingGuard = 0; move(-dir); return; }
      }
      this.cool = Math.max(this.cool, this.pendingGuard + me.stats.guardUp + 0.25);
      move(-dir);
      return;
    }

    // full gauge and in range: fire the super (the artillery waits for the opponent near the view center)
    const sup = SUPERS[me.weapon];
    const superReady = sup.bomb ? Math.abs(op.x - (game.cam + VIEW_W / 2)) < sup.bomb.radius * 0.7 : gap <= sup.range;
    if (me.meter >= SUPER_MAX && me.onGround && !me.attack && superReady && r() < p.superUse) { this.charging = true; return; }
    // archer at a distance: hold attack for the charged bow shot (the cowboy for his revolver)
    const shotRange = me.stats.gun ? BULLET_RANGE * BODY_H : ARROW_RANGE;
    if ((me.stats.bow || me.stats.gun) && me.onGround && !me.attack && gap > 140 && gap < shotRange * 0.9 && Math.abs(op.y - me.y) < 40 && r() < p.attack * 0.4) {
      const s = me.stats;
      this.holdAttack = s.startup + s.active + s.recovery + (s.gun ? GUN_LOAD : CHARGE_TIME) + 0.05;
      inp.attack = true;
      return;
    }
    // cowboy crowded up close: double-tap back and hold to reel away
    if (me.stats.reel && me.onGround && !me.attack && me.reelCD <= 0 && gap < 30 && r() < p.reel) {
      const back = dir > 0 ? { left: true } : { right: true };
      this.seq = [[0.04, back], [0.04, {}], [0.16, back]];
      return;
    }

    // Genghis far away: double-tap forward and hold to charge in on horseback
    if (me.stats.rush && me.onGround && !me.attack && !me.rush && me.rushCD <= 0 && gap > 180 && r() < p.reel) {
      const fwd = dir > 0 ? { right: true } : { left: true };
      this.seq = [[0.04, fwd], [0.04, {}], [0.16, fwd]];
      return;
    }

    if (!me.attack && me.onGround) {
      // long-reach fighters crowded up close: back off with an armored heavy swing
      if ((!me.canDouble || me.stats.heavy) && gap <= myReach * HEAVY_REACH * 0.8 && gap < myReach * 0.5 && r() < p.attack * 0.35) { inp.attack = true; move(-dir); return; }
      // just out of normal reach: step in with a long attack
      if (gap > myReach * 0.9 && gap <= myReach + LONG_REACH_BONUS + 10 && r() < p.attack * 0.5) { inp.attack = true; move(dir); return; }
    }
    // punish recovery or attack when in range; against a turtling opponent, hold for a charged swing
    if (gap <= myReach * 0.9 && !me.attack) {
      if (op.guarding && r() < p.attack * 0.6) {
        const s = me.stats;
        this.holdAttack = s.startup + s.active + s.recovery + CHARGE_TIME + 0.05;
        inp.attack = true;
        return;
      }
      if ((p.punish && opPhase === 'recovery') || r() < p.attack) { inp.attack = true; return; }
    }

    // spacing: long weapons keep the opponent at the tip
    let want = dir;
    if (p.spacing && myReach > opReach + 15 && gap < myReach * 0.55) want = -dir;
    else if (gap <= myReach * 0.75) want = 0;

    // traps ahead on the ground → jump over (or stop)
    if (want && me.onGround) {
      const ahead = me.x + want * 40;
      const trap = game.layout.traps.find(t => ahead > t.x && ahead < t.x + t.w);
      if (trap) {
        if (r() < p.avoidTrap) inp.jump = true;
        else want = r() < 0.5 ? want : 0;
      }
    }
    move(want);

    // opponent above on a platform → follow; occasional jump attack
    if (me.onGround && op.y < me.y - 40 && Math.abs(op.x - me.x) < 120) inp.jump = true;
    else if (me.onGround && r() < p.jump) inp.jump = true;
    if (!me.onGround && me.canDouble && !me.doubled && me.vy > -200 && r() < p.jump * 3) inp.jump = true;
    // stag beetle: air dash toward a distant opponent
    if (!me.onGround && me.stats.airDash && !me.doubled && gap > 120 && r() < p.jump * 4) { inp.jump = true; move(dir); }
    // after a double jump: dive when the opponent sits roughly on the 45° line ahead
    // (the cowboy lashes his whip down that line from where he hangs)
    const dx = (op.x - me.x) * me.facing, dy = op.y - me.y;
    if (me.doubled && me.stats.airLash && !me.lashed && !me.attack && dx > 0 && dx - dy > -10 && dx - dy < 55 && dx < myReach * AIR_LASH_REACH * 0.75 && r() < p.attack) inp.attack = true;
    else if (me.doubled && !me.stats.airLash && !me.attack && dx > 0 && Math.abs(dx - dy) < 70 && r() < p.attack) inp.attack = true;
    else if (!me.onGround && !me.doubled && gap < myReach && r() < p.attack * 0.6) inp.attack = true;
    // drop down to chase an opponent on the ground
    if (me.platform >= 0 && op.y > me.y + 40 && r() < 0.5) inp.down = true;
  }
}
