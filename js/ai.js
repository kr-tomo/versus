import { BODY_HALF_W } from './config.js';
import { attackPhase } from './fighter.js';

const LEVELS = {
  easy: { react: 0.45, guard: 0.25, attack: 0.5, avoidTrap: 0.5, spacing: false, punish: false, jump: 0.04 },
  hard: { react: 0.14, guard: 0.8, attack: 0.9, avoidTrap: 1, spacing: true, punish: true, jump: 0.08 }
};

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
    this.input.attack = false;
    this.input.jump = false;
    if (this.cool > 0) return { ...this.input };
    this.cool = this.p.react * (0.7 + this.rand() * 0.6);
    this.decide(me, op, game);
    return { ...this.input };
  }

  decide(me, op, game) {
    const p = this.p, r = this.rand, inp = this.input;
    inp.left = inp.right = inp.guard = inp.down = false;
    const dir = op.x >= me.x ? 1 : -1;
    const gap = Math.abs(op.x - me.x) - 2 * BODY_HALF_W;
    const myReach = me.stats.reach, opReach = op.stats.reach;
    const opPhase = attackPhase(op);
    const move = d => { if (d > 0) inp.right = true; else if (d < 0) inp.left = true; };

    // standing in a trap: get out
    if (me.inTrap) { move(dir); inp.jump = me.onGround; return; }

    // threatened by an incoming attack
    if ((opPhase === 'startup' || opPhase === 'active') && gap < opReach + 20 && r() < p.guard) { inp.guard = true; return; }

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
    if (!me.onGround && gap < myReach && r() < p.attack * 0.6) inp.attack = true;
    // drop down to chase an opponent on the ground
    if (me.platform >= 0 && op.y > me.y + 40 && r() < 0.5) inp.down = true;
  }
}
