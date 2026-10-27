import { MAPS, MAP_IDS, VIEW_W, WORLD_W, SPAWN_X, BODY_HALF_W, BODY_H } from './config.js';
import { createFighter, stepFighter, NO_INPUT } from './fighter.js';
import { resolveHits } from './combat.js';
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
  }

  get world() { return { platforms: this.layout.platforms, ice: this.map.ice }; }

  update(dt, inputs) {
    this.phaseT += dt;
    this.t = (this.t || 0) + dt;
    const live = this.phase === 'fight';
    const [a, b] = this.fighters;
    const world = this.world;
    const before = this.fighters.map(f => !!f.super);
    stepFighter(a, live ? inputs[0] : NO_INPUT, dt, world);
    stepFighter(b, live ? inputs[1] : NO_INPUT, dt, world);
    for (const [i, me, op] of [[0, a, b], [1, b, a]]) {
      if (me.super && !before[i]) this.effects.push({ type: 'super', who: i, name: me.super.def.name, x: me.x, y: me.y, t: 0, life: 1.2 });
      if (me.super?.def.blink !== undefined && !me.super.blinked && me.super.t >= me.super.def.blink) {
        // vanish and reappear behind the opponent
        me.super.blinked = true;
        this.effects.push({ type: 'smoke', x: me.x, y: me.y - 40, t: 0 });
        const side = op.x >= me.x ? 1 : -1;
        me.x = op.x + side * ((op.stats.halfW ?? BODY_HALF_W) + 22);
        me.facing = -side;
        this.effects.push({ type: 'smoke', x: me.x, y: me.y - 40, t: 0 });
      }
      if (me.super?.def.quake !== undefined && !me.super.quaked && me.super.t >= me.super.def.quake) {
        me.super.quaked = true;
        this.effects.push({ type: 'quake', x: me.x, y: me.y, dir: me.facing, t: 0 });
      }
      if (!me.attack && !me.super && !me.ko) me.facing = op.x >= me.x ? 1 : -1;
    }
    separate(a, b);
    this.cam = constrainCamera(this.cam, a, b);

    if (live) {
      for (const e of resolveHits(a, b, this.rand)) {
        this.effects.push({ type: e.evaded ? 'miss' : e.guarded ? 'guard' : 'hit', big: e.super || e.damage >= 20, x: e.x, y: e.y, dmg: e.damage, t: 0 });
      }
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
