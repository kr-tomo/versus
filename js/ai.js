import { BODY_HALF_W, SUPER_MAX, SUPERS, LONG_REACH_BONUS, HEAVY_REACH } from './config.js';
import { attackPhase } from './fighter.js';

// guard: chance to notice an incoming attack; guardLag: extra delay before raising the guard
// (added to the weapon's own guardUp), so even hard misses blocks sometimes.
const LEVELS = {
  easy: { react: 0.45, guard: 0.25, guardLag: 0.12, attack: 0.5, avoidTrap: 0.5, spacing: false, punish: false, jump: 0.04, superUse: 0.15 },
  hard: { react: 0.14, guard: 0.5, guardLag: 0.08, attack: 0.9, avoidTrap: 1, spacing: true, punish: true, jump: 0.08, superUse: 0.6 }
};
const halfW = f => f.stats.halfW ?? BODY_HALF_W;

// Computer player. Decides every `react` seconds and holds that input in between.
export class AI {
  constructor(level, rand = Math.random) {
    this.p = LEVELS[level];
    this.rand = rand;
    this.cool = 0;
    this.input = { left: false, right: false, jump: false, down: false, attack: false, guard: false };
  }

  update(dt, me, op, game) {
    this.cool -= dt;
    // release one-shot buttons so they register as fresh presses next time
    this.input.jump = false;
    // holding attack + guard to fire the super
    if (this.charging) {
      if (me.super || me.stun > 0 || me.meter < SUPER_MAX || !me.onGround) this.charging = false;
      else return { ...this.input, attack: true, guard: true };
    }
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

    // threatened by an incoming attack (or a super, which can't be interrupted)
    const threat = op.super || op.charge > 0 || ((opPhase === 'startup' || opPhase === 'active') && gap < opReach + 20);
    if (threat && r() < p.guard) {
      // back off slowly behind the guard and hold it long enough to come up
      this.pendingGuard = p.guardLag * (0.5 + r());
      this.cool = Math.max(this.cool, this.pendingGuard + me.stats.guardUp + 0.25);
      move(-dir);
      return;
    }

    // full gauge and in range: fire the super
    if (me.meter >= SUPER_MAX && me.onGround && !me.attack && gap <= SUPERS[me.weapon].range && r() < p.superUse) { this.charging = true; return; }

    if (!me.attack && me.onGround) {
      // long-reach fighters crowded up close: back off with an armored heavy swing
      if (!me.canDouble && gap <= myReach * HEAVY_REACH * 0.8 && gap < myReach * 0.5 && r() < p.attack * 0.35) { inp.attack = true; move(-dir); return; }
      // just out of normal reach: step in with a long attack
      if (gap > myReach * 0.9 && gap <= myReach + LONG_REACH_BONUS + 10 && r() < p.attack * 0.5) { inp.attack = true; move(dir); return; }
    }
    // punish recovery or attack when in range
    if (gap <= myReach * 0.9 && !me.attack) {
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
    // after a double jump: dive when the opponent sits roughly on the 45° line ahead
    const dx = (op.x - me.x) * me.facing, dy = op.y - me.y;
    if (me.doubled && !me.attack && dx > 0 && Math.abs(dx - dy) < 70 && r() < p.attack) inp.attack = true;
    else if (!me.onGround && !me.doubled && gap < myReach && r() < p.attack * 0.6) inp.attack = true;
    // drop down to chase an opponent on the ground
    if (me.platform >= 0 && op.y > me.y + 40 && r() < 0.5) inp.down = true;
  }
}
