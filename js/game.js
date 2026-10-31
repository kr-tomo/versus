import {
  MAPS, MAP_IDS, VIEW_W, WORLD_W, SPAWN_X, BODY_HALF_W, BODY_H, GROUND_Y,
  HIT_CONFIRM, HITSTOP_BASE, HITSTOP_PER_DMG, HITSTOP_MAX, HITSTOP_GUARD
} from './config.js';
import { createFighter, stepFighter, NO_INPUT, dashing } from './fighter.js';
import { detectHits, confirmHit } from './combat.js';
import { constrainCamera } from './camera.js';
import { generateMap } from './mapgen.js';

// Bodies push each other apart; jumping over the opponent is still possible.
export function separate(a, b) {
  if (Math.abs(a.y - b.y) >= BODY_H * 0.8) return;
  const min = ((a.stats?.halfW ?? BODY_HALF_W) + (b.stats?.halfW ?? BODY_HALF_W)) * 0.9, dx = b.x - a.x;
  if (Math.abs(dx) >= min) return;
  const dir = dx !== 0 ? Math.sign(dx) : a.facing, push = (min - Math.abs(dx)) / 2;
  a.x -= dir * push;
  b.x += dir * push;
}

export const INTRO_TIME = 1.6;
export const ROUND_END_TIME = 2.4;

// settings: { mode: '2p'|'easy'|'hard', weapons: [w1, w2], map: id|'random', wins, time, seed, rand }
export class Game {
  constructor(settings) {
    this.settings = settings;
    this.rand = settings.rand ?? Math.random;
    this.seed = settings.seed ?? Math.floor(Math.random() * 1e9);
    this.mapId = settings.map === 'random' ? MAP_IDS[this.seed % MAP_IDS.length] : settings.map;
    this.map = MAPS[this.mapId];
    this.wins = [0, 0];
    this.round = 0;
    this.effects = [];
    this.startRound();
  }

  startRound() {
    this.round++;
    this.layout = generateMap(this.mapId, this.seed + this.round * 7919);
    const [w1, w2] = this.settings.weapons;
    this.fighters = [createFighter(w1, SPAWN_X[0], 1), createFighter(w2, SPAWN_X[1], -1)];
    this.cam = (WORLD_W - VIEW_W) / 2;
    this.timeLeft = this.settings.time;
    this.phase = 'intro';
    this.phaseT = 0;
    this.result = null;
    this.effects = [];
    this.pending = [];
    this.hitstop = 0;
    this.bull = null;
  }

  get world() { return { platforms: this.layout.platforms, ice: this.map.ice }; }

  update(dt, inputs) {
    this.t = (this.t || 0) + dt;
    // impact freeze: the world holds still, effects keep animating
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      this.effects = this.effects.filter(e => (e.t += dt) < (e.life ?? 0.6));
      return;
    }
    this.phaseT += dt;
    const live = this.phase === 'fight';
    const [a, b] = this.fighters;
    const world = this.world;
    const before = this.fighters.map(f => !!f.super);
    // each fighter wants to face the other; stepFighter applies the turn delay
    for (const [me, op] of [[a, b], [b, a]]) if (Math.abs(op.x - me.x) > 1) me.wantFacing = op.x >= me.x ? 1 : -1;
    stepFighter(a, live ? inputs[0] : NO_INPUT, dt, world);
    stepFighter(b, live ? inputs[1] : NO_INPUT, dt, world);
    for (const [i, me, op] of [[0, a, b], [1, b, a]]) {
      if (me.super && !before[i]) this.effects.push({ type: 'super', who: i, name: me.super.def.name, x: me.x, y: me.y, t: 0, life: 1.2 });
      if (me.super?.def.blink !== undefined && !me.super.blinked && me.super.t >= me.super.def.blink) {
        // vanish and reappear behind (or right in front of) the opponent
        me.super.blinked = true;
        this.effects.push({ type: 'smoke', x: me.x, y: me.y - 40, t: 0 });
        const side = op.x >= me.x ? 1 : -1, gap = (op.stats.halfW ?? BODY_HALF_W) + 22;
        const front = me.super.def.blinkSide === 'front';
        me.x = op.x + (front ? -side : side) * gap;
        me.y = op.y; me.onGround = op.onGround; me.platform = op.platform; me.vy = 0;
        me.facing = me.wantFacing = front ? side : -side;
        this.effects.push({ type: 'smoke', x: me.x, y: me.y - 40, t: 0 });
      }
      if (me.super?.def.quake !== undefined && !me.super.quaked && me.super.t >= me.super.def.quake) {
        me.super.quaked = true;
        this.effects.push({ type: 'quake', x: me.x, y: me.y, dir: me.facing, t: 0 });
      }
      const bull = me.super?.def.bull;
      if (bull && !me.super.summoned && me.super.t >= bull.at) {
        // the bull enters from the screen edge behind the farmer and runs the whole map
        me.super.summoned = true;
        const dir = me.facing;
        this.bull = { ...bull, x: dir > 0 ? this.cam - 90 : this.cam + VIEW_W + 90, dir, owner: i, hit: false, t: 0 };
        this.effects.push({ type: 'bull', x: this.bull.x, y: GROUND_Y, dir, t: 0, life: 0.6 });
      }
    }
    separate(a, b);
    this.cam = constrainCamera(this.cam, a, b);

    this.updateBull(dt, live);
    if (live) {
      this.resolveContacts(dt);
      for (const f of this.fighters) this.applyTrap(f, dt);
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      this.checkRoundEnd();
    }
    this.effects = this.effects.filter(e => (e.t += dt) < (e.life ?? 0.6));

    if (this.phase === 'intro' && this.phaseT >= INTRO_TIME) this.setPhase('fight');
    else if (this.phase === 'roundEnd' && this.phaseT >= ROUND_END_TIME) {
      if (this.wins.some(w => w >= this.settings.wins)) {
        this.setPhase('matchEnd');
        this.fighters.forEach((f, i) => { f.won = this.winner === i; });
      } else this.startRound();
    }
  }

  setPhase(p) { this.phase = p; this.phaseT = 0; }

  updateBull(dt, live) {
    const bull = this.bull;
    if (!bull) return;
    bull.t += dt;
    bull.x += bull.dir * bull.speed * dt;
    const op = this.fighters[1 - bull.owner];
    const hw = op.stats.halfW ?? BODY_HALF_W;
    // the bull is about 70px tall; jumping clear of it avoids the hit
    if (live && !bull.hit && !op.ko && !op.super && !dashing(op) && Math.abs(op.x - bull.x) < 50 + hw && op.y > GROUND_Y - 70) {
      bull.hit = true;
      const s = { dmg: bull.dmg, kb: bull.kb, stun: bull.stun, launch: bull.launch, super: true, index: 0 };
      const att = { facing: bull.dir, x: bull.x, stats: {} };
      const e = confirmHit({ att, def: op, s, x: op.x }, this.rand, { lateGuard: op.guarding });
      this.effects.push({ type: e.evaded ? 'miss' : e.guarded ? 'guard' : 'hit', who: 1 - bull.owner, big: true, x: e.x, y: e.y, dmg: e.damage, dir: bull.dir, t: 0 });
      if (!e.evaded) this.hitstop = Math.max(this.hitstop, HITSTOP_MAX);
    }
    if (bull.x < -200 || bull.x > WORLD_W + 200) this.bull = null;
  }

  // Contacts wait HIT_CONFIRM before applying: late guards count and near-simultaneous hits trade.
  resolveContacts(dt) {
    const [a, b] = this.fighters;
    for (const c of detectHits(a, b)) this.pending.push({ ...c, wait: HIT_CONFIRM });
    const due = [];
    for (const p of this.pending) if ((p.wait -= dt) <= 0) due.push(p);
    if (!due.length) return;
    this.pending = this.pending.filter(p => p.wait > 0);
    // a hit confirmed together with (or within the window of) one going the other way is a trade
    const trade = due.length > 1 || this.pending.some(p => due.some(d => d.att === p.def));
    for (const p of due) {
      if (p.def.super || p.def.ko || (dashing(p.def) && !p.s.sure)) continue;
      const e = confirmHit(p, this.rand, { lateGuard: p.def.guarding });
      const who = this.fighters.indexOf(p.def);
      this.effects.push({ type: e.evaded ? 'miss' : e.broken ? 'break' : e.guarded ? 'guard' : e.armored ? 'armor' : 'hit', who, big: e.super || e.damage >= 20, x: e.x, y: e.y, dmg: e.damage, dir: p.att.facing, t: 0 });
      if (!e.evaded) this.hitstop = Math.max(this.hitstop, e.guarded ? HITSTOP_GUARD : Math.min(HITSTOP_MAX, HITSTOP_BASE + e.damage * HITSTOP_PER_DMG));
    }
    if (trade && due.length) this.effects.push({ type: 'trade', x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 100, t: 0, life: 0.9 });
  }

  applyTrap(f, dt) {
    const onTrap = f.onGround && f.platform < 0 && this.layout.traps.some(t => f.x > t.x + 4 && f.x < t.x + t.w - 4);
    f.inTrap = onTrap;
    if (!onTrap) { f.trapAcc = 0; return; }
    f.trapAcc += dt * this.map.trapDps;
    while (f.trapAcc >= 1 && f.energy > 0) { f.trapAcc -= 1; f.energy -= 1; }
  }

  checkRoundEnd() {
    const [a, b] = this.fighters;
    let winner = null, reason = null;
    if (a.energy <= 0 || b.energy <= 0) {
      reason = 'KO';
      winner = a.energy <= 0 && b.energy <= 0 ? -1 : a.energy <= 0 ? 1 : 0;
    } else if (this.timeLeft <= 0) {
      reason = 'TIME';
      winner = a.energy === b.energy ? -1 : a.energy > b.energy ? 0 : 1;
    }
    if (reason === null) return;
    if (reason === 'KO') this.fighters.forEach(f => { if (f.energy <= 0) { f.ko = true; f.koAt = f.t; } });
    if (winner >= 0) this.wins[winner]++;
    this.result = { winner, reason };
    this.setPhase('roundEnd');
  }

  // Match winner (index) once someone reached the win count.
  get winner() { return this.wins[0] >= this.settings.wins ? 0 : this.wins[1] >= this.settings.wins ? 1 : -1; }
}
