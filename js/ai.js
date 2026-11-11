import { BODY_HALF_W, BODY_H, HIT_CONFIRM, PARRY_WINDOW, SUPER_MAX, SUPERS, LONG_REACH_BONUS, HEAVY_REACH, ARROW_RANGE, VIEW_W, CHARGE_TIME, GUN_LOAD, BULLET_RANGE, AIR_LASH_REACH } from './config.js';
import { attackPhase, attackTiming } from './fighter.js';

// Computer player.
//
// Instead of walking in and swinging whenever the opponent is in reach, the AI plays in *plans*
// that last a second or two and give the fight a rhythm of offense and defense:
//   neutral — footsies: hover at its own sweet-spot distance with small steps in and out, poke an
//             opponent who walks into range, punish a whiffed swing
//   press   — offense: close in and play a short string (1-3 attacks with beats in between),
//             mixing kinds; ends after the string, or early when it gets blocked
//   bait    — step into the edge of the opponent's reach and back out, punish the swing it draws
//   guard   — let the opponent come: hold position behind the guard, counter after their string
//   reset   — back off to a safe distance and breathe (also the periodic ~20s back-off)
//   zone    — long-range fighters keep their distance and shoot / poke at the tip
// Each character has an archetype that sets its sweet spot and how often it picks each plan.
// The difficulty sets reaction time, guarding, punishing, how varied and how tight the rhythm is,
// and whether it adapts to the player's habits (guards a lot → guard breaks; jumps a lot → anti-air).

// guard: chance to notice an incoming attack; guardLag: extra delay before raising the guard
// (added to the weapon's own guardUp), so even hard misses blocks sometimes.
// backoff: about every BACKOFF_EVERY seconds, the chance to back away and open up some distance.
// beat: pause between attacks of a string [min, max]; breath: pause after a string before the next
// offense; string: max attacks per string; poke/punish: chance to take a free hit; mix: chance to use
// a non-normal attack; adapt: reads the player's habits; aggro: overall weight of offensive plans.
const LEVELS = {
  easy: {
    backoff: 0.7, react: 0.42, guard: 0.25, guardLag: 0.12, avoidTrap: 0.5, superUse: 0.15, parry: 0.02, reel: 0.1,
    beat: [0.4, 0.7], breath: [0.8, 1.6], string: 2, poke: 0.45, punish: 0.3, mix: 0.25, adapt: false, aggro: 1,
    jumpIn: 0.04, slack: 26
  },
  hard: {
    backoff: 0.3, react: 0.14, guard: 0.5, guardLag: 0.08, avoidTrap: 1, superUse: 0.6, parry: 0.06, reel: 0.3,
    beat: [0.12, 0.38], breath: [0.35, 0.9], string: 3, poke: 0.75, punish: 0.85, mix: 0.6, adapt: true, aggro: 1.3,
    jumpIn: 0.1, slack: 10
  }
};

// Archetypes: spot = preferred gap as a fraction of its own reach; plans = base plan weights.
const ARCH = {
  rush:  { spot: 0.6, plans: { neutral: 2, press: 4, bait: 1, guard: 1, reset: 1 }, jump: 1.5 },
  bal:   { spot: 0.9, plans: { neutral: 3, press: 4, bait: 2, guard: 1, reset: 1 }, jump: 1 },
  power: { spot: 1.0, plans: { neutral: 3, press: 3, bait: 2, guard: 2, reset: 1 }, jump: 0.6 },
  poke:  { spot: 1.05, plans: { neutral: 4, press: 3, bait: 2, guard: 1, reset: 1 }, jump: 0.5 },
  zone:  { spot: 1.8, plans: { neutral: 2, press: 2, bait: 1, guard: 1, reset: 1, zone: 4 }, jump: 0.7 }
};
const ARCH_OF = {
  fist: 'rush', dagger: 'rush', tkd: 'rush', stag: 'rush',
  sword: 'bal', fork: 'bal', axe: 'power', mace: 'power',
  spear: 'poke', genghis: 'poke', archer: 'zone', whip: 'zone'
};
const PLAN_TIME = { neutral: [1, 2.2], press: [1.5, 3], bait: [0.9, 1.6], guard: [0.7, 1.3], reset: [0.6, 1.1], zone: [1.4, 2.6] };

const halfW = f => f.stats.halfW ?? BODY_HALF_W;
const BACKOFF_EVERY = [16, 24];   // seconds between rolls ("about every 20s")
const BACKOFF_TIME = [1.2, 2.0];  // how long it keeps backing away

export class AI {
  constructor(level, rand = Math.random) {
    this.p = LEVELS[level];
    this.level = level;
    this.rand = rand;
    this.cool = 0;
    this.input = { left: false, right: false, jump: false, down: false, attack: false, guard: false };
    this.backoffClock = this.span(BACKOFF_EVERY);
    this.retreat = 0;
    this.plan = 'neutral'; this.planT = 1; this.beatT = 0; this.breathT = 0; this.left = 0;
    // what it has noticed about the player
    this.habit = { t: 0, guardT: 0, jumps: 0, swings: 0, whiffs: 0 };
    this.seenAttack = null; this.wasGround = true;
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
    this.planT -= dt; this.beatT -= dt; this.breathT -= dt;
    this.watch(dt, op);
    // release one-shot buttons so they register as fresh presses next time
    this.input.jump = false;
    // holding attack + guard to fire the super
    if (this.charging) {
      if (me.super || me.stun > 0 || me.meter < SUPER_MAX || !me.onGround) this.charging = false;
      else return { ...this.input, attack: true, guard: true };
    }
    // scripted taps (the cowboy's back double-tap + hold, Genghis's rush)
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

  // Track the player's habits: how much they guard, jump, swing and whiff.
  watch(dt, op) {
    const h = this.habit;
    h.t += dt;
    if (op.guarding) h.guardT += dt;
    if (this.wasGround && !op.onGround && op.vy < 0) h.jumps++;
    this.wasGround = op.onGround;
    if (op.attack !== this.seenAttack) {
      if (this.seenAttack && !this.seenAttack.hit) h.whiffs++;
      if (op.attack) h.swings++;
      this.seenAttack = op.attack;
    }
    // forget slowly so it follows a change of style
    if (h.t > 20) { const k = 1 - dt / 20; h.t *= k; h.guardT *= k; h.jumps *= k; h.swings *= k; h.whiffs *= k; }
  }

  // Pick the next plan: archetype weights, nudged by the situation and (hard) by the player's habits.
  choosePlan(me, op, gap) {
    const p = this.p, arch = ARCH[ARCH_OF[me.weapon]] ?? ARCH.bal, h = this.habit;
    const w = { ...arch.plans };
    w.press = (w.press ?? 0) * p.aggro;
    if (this.breathT > 0) w.press *= 0.3;                       // just finished a string: breathe
    if (me.energy < op.energy - 40) { w.press *= 1.4; w.guard *= 0.7; }   // behind: take risks
    if (me.energy > op.energy + 40) { w.guard *= 1.4; w.neutral *= 1.3; } // ahead: play safe
    if (gap > 200) { w.press *= 2; w.guard *= 0.3; w.reset *= 0.3; }
    if (p.adapt && h.t > 4) {
      const guardy = h.guardT / h.t, jumpy = h.jumps / h.t, swingy = h.swings / h.t;
      if (guardy > 0.3) { w.press *= 1.5; w.bait *= 0.6; }     // turtle → press with guard breaks
      if (swingy > 0.9) { w.bait *= 1.8; w.guard *= 1.5; }     // button masher → bait and punish
      if (jumpy > 0.25) w.neutral *= 1.4;                       // jumper → wait under and anti-air
    }
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    let r = this.rand() * total, plan = 'neutral';
    for (const [k, v] of Object.entries(w)) if ((r -= v) <= 0) { plan = k; break; }
    this.plan = plan;
    this.planT = this.span(PLAN_TIME[plan]);
    if (plan === 'press') this.left = 1 + Math.floor(this.rand() * p.string);
    if (plan === 'reset') this.breathT = 0;
  }

  // Swing now; picks the attack kind (normal / long / charged / back-step heavy) for the situation.
  swing(me, op, gap, dir, move) {
    const p = this.p, r = this.rand, inp = this.input, s = me.stats, reach = s.reach;
    const guardy = p.adapt && this.habit.t > 4 && this.habit.guardT / this.habit.t > 0.3;
    inp.attack = true;
    if (op.guarding && r() < (guardy ? 0.8 : p.mix)) {
      // guard break: hold through a swing into the charged attack
      this.holdAttack = s.startup + s.active + s.recovery + CHARGE_TIME + 0.05;
    } else if (gap > reach * 0.85 && r() < 0.5 + p.mix * 0.4) move(dir);                    // step-in long attack
    else if ((!me.canDouble || s.heavy) && gap < reach * 0.5 && r() < p.mix * 0.5) move(-dir); // armored heavy
    this.beatT = this.span(p.beat);
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
    const arch = ARCH[ARCH_OF[me.weapon]] ?? ARCH.bal;
    const spot = Math.max(20, myReach * arch.spot);

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
    // in the guard plan it is a little more watchful
    if (threat && r() < (this.plan === 'guard' ? Math.min(0.9, p.guard + 0.2) : p.guard)) {
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
      // a press that got blocked/interrupted ends the string: breathe
      if (this.plan === 'press' && r() < 0.5) { this.plan = 'reset'; this.planT = this.span(PLAN_TIME.reset); this.breathT = this.span(p.breath); }
      return;
    }

    // full gauge and in range: fire the super (the artillery waits for the opponent near the view center)
    const sup = SUPERS[me.weapon];
    const superReady = sup.bomb ? Math.abs(op.x - (game.cam + VIEW_W / 2)) < sup.bomb.radius * 0.7 : gap <= sup.range;
    if (me.meter >= SUPER_MAX && me.onGround && !me.attack && superReady && r() < p.superUse) { this.charging = true; return; }

    if (this.planT <= 0) this.choosePlan(me, op, gap);
    const ready = !me.attack && this.beatT <= 0;

    // free hits, in any plan: punish a whiffed swing in recovery, poke someone walking into range
    if (ready && me.onGround && gap <= myReach * 0.95) {
      const approaching = (op.vx * -dir) > 40;
      if (opPhase === 'recovery' && r() < p.punish) { this.swing(me, op, gap, dir, move); return; }
      if (approaching && this.plan !== 'press' && r() < p.poke * 0.6) { this.swing(me, op, gap, dir, move); return; }
    }
    // anti-air: an opponent jumping in over its head
    if (ready && me.onGround && !op.onGround && op.vy > -200 && Math.abs(op.x - me.x) < myReach + 30 && op.y < me.y - 20 && r() < p.poke * (p.adapt ? 1 : 0.5)) {
      inp.attack = true; inp.jump = myReach < 60 && r() < 0.5; this.beatT = this.span(p.beat); return;
    }

    // ranged fighters at a distance: the charged bow / revolver shot
    const shotRange = me.stats.gun ? BULLET_RANGE * BODY_H : ARROW_RANGE;
    if ((me.stats.bow || me.stats.gun) && ready && me.onGround && gap > 140 && gap < shotRange * 0.9 && Math.abs(op.y - me.y) < 40
        && r() < (this.plan === 'zone' ? 0.55 : 0.12)) {
      const s = me.stats;
      this.holdAttack = s.startup + s.active + s.recovery + (s.gun ? GUN_LOAD : CHARGE_TIME) + 0.05;
      inp.attack = true;
      this.beatT = this.span(p.beat) + 0.3;
      return;
    }
    // cowboy crowded up close: double-tap back and hold to reel away
    if (me.stats.reel && me.onGround && !me.attack && me.reelCD <= 0 && gap < 30 && r() < p.reel) {
      const back = dir > 0 ? { left: true } : { right: true };
      this.seq = [[0.04, back], [0.04, {}], [0.16, back]];
      return;
    }

    let want = 0;
    switch (this.plan) {
      case 'press': {
        // Genghis far away: double-tap forward and hold to charge in on horseback
        if (me.stats.rush && me.onGround && !me.attack && !me.rush && me.rushCD <= 0 && gap > 180 && r() < p.reel * 2) {
          const fwd = dir > 0 ? { right: true } : { left: true };
          this.seq = [[0.04, fwd], [0.04, {}], [0.16, fwd]];
          return;
        }
        if (ready && me.onGround && gap > myReach * 0.85 && gap <= myReach + LONG_REACH_BONUS && r() < 0.5 + p.mix * 0.4) {
          // just outside reach: a step-in long attack
          inp.attack = true; move(dir); this.beatT = this.span(p.beat);
          if (--this.left <= 0) { this.plan = 'reset'; this.planT = this.span(PLAN_TIME.reset); this.breathT = this.span(p.breath); }
          return;
        }
        if (gap > myReach * 0.85) {
          want = dir;
          // a jump-in now and then (rushdown more often)
          if (me.onGround && gap < myReach + 120 && r() < p.jumpIn * arch.jump) inp.jump = true;
        } else if (ready) {
          this.swing(me, op, gap, dir, move);
          if (--this.left <= 0) { this.plan = 'reset'; this.planT = this.span(PLAN_TIME.reset); this.breathT = this.span(p.breath); }
          return;
        }
        break;
      }
      case 'bait': {
        // dance at the edge of the opponent's reach: in, then out
        const edge = opReach + 8;
        want = Math.floor((this.planT * 3) % 2) ? (gap > edge ? dir : 0) : (gap < edge + 40 ? -dir : 0);
        break;
      }
      case 'guard': {
        // hold position, guard up when close, then counter once their swing is spent
        if (gap < opReach + 30 && r() < 0.6) inp.guard = true;
        want = gap > spot * 1.6 ? dir : 0;
        break;
      }
      case 'reset': {
        want = gap < Math.max(spot * 1.3, opReach + 30) ? -dir : 0;
        break;
      }
      case 'zone': {
        const far = Math.max(spot, opReach + 60);
        want = gap < far - 20 ? -dir : gap > far + 60 ? dir : 0;
        if (ready && gap <= myReach * 0.95 && r() < p.poke * 0.5) { this.swing(me, op, gap, dir, move); return; }
        break;
      }
      default: { // neutral footsies around the sweet spot, with small steps and pauses
        const slack = p.slack;
        if (gap > spot + slack) want = dir;
        else if (gap < spot - slack) want = -dir;
        else want = r() < 0.35 ? (r() < 0.5 ? dir : -dir) : 0;
        if (ready && gap <= myReach * 0.95 && r() < p.poke * 0.4) { this.swing(me, op, gap, dir, move); return; }
      }
    }

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

    // opponent above on a platform → follow
    if (me.onGround && op.y < me.y - 40 && Math.abs(op.x - me.x) < 120 && this.plan !== 'reset') inp.jump = true;
    // short-reach fighters use the double jump on the way in; the stag dashes toward a distant opponent
    if (!me.onGround && me.canDouble && !me.doubled && me.vy > -200 && this.plan === 'press' && r() < 0.3 * arch.jump) inp.jump = true;
    if (!me.onGround && me.stats.airDash && !me.doubled && gap > 120 && this.plan === 'press' && r() < 0.3) { inp.jump = true; move(dir); }
    // after a double jump: dive when the opponent sits roughly on the 45° line ahead
    // (the cowboy lashes his whip down that line from where he hangs)
    const dx = (op.x - me.x) * me.facing, dy = op.y - me.y;
    if (me.doubled && me.stats.airLash && !me.lashed && !me.attack && dx > 0 && dx - dy > -10 && dx - dy < 55 && dx < myReach * AIR_LASH_REACH * 0.75 && r() < 0.8) inp.attack = true;
    else if (me.doubled && !me.stats.airLash && !me.attack && dx > 0 && Math.abs(dx - dy) < 70 && r() < 0.8) inp.attack = true;
    else if (!me.onGround && !me.doubled && !me.attack && gap < myReach && r() < 0.5) inp.attack = true;
    // drop down to chase an opponent on the ground
    if (me.platform >= 0 && op.y > me.y + 40 && r() < 0.5) inp.down = true;
  }
}
