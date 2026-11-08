import {
  MAPS, MAP_IDS, VIEW_W, WORLD_W, SPAWN_X, BODY_HALF_W, BODY_H, GROUND_Y,
  HIT_CONFIRM, HITSTOP_BASE, HITSTOP_PER_DMG, HITSTOP_MAX, HITSTOP_GUARD, HIT_STUN, KNOCKBACK_PER_DMG,
  ARROW_RANGE, ARROW_APEX, ARROW_SPEED, ARROW_MULT, BULLET_RANGE, BULLET_SPEED, BULLET_MULT
} from './config.js';
import { createFighter, stepFighter, NO_INPUT, dashing, attackPhase } from './fighter.js';
import { detectHits, confirmHit } from './combat.js';
import { constrainCamera } from './camera.js';
import { generateMap } from './mapgen.js';

// Arc through (x, hand height) → apex ARROW_APEX x body height → ground at ARROW_RANGE.
// h(u) = a·u² + b·u + c over u = 0..1 with h(0) = c, h(1) = 0 and max h = H.
export function arrowArc(c, H) {
  const k = 4 * H - 2 * c, a = (-k - Math.sqrt(k * k - 4 * c * c)) / 2;
  return { a, b: -c - a, c };
}

function makeArrow(f, owner) {
  const h = f.stats.height ?? BODY_H, hand = h * 0.68;
  return {
    type: 'arrow', owner, dir: f.facing, x0: f.x + f.facing * 16, x: f.x, feet: f.y, y: f.y - hand, u: 0,
    range: ARROW_RANGE, dmg: Math.round(f.stats.power * ARROW_MULT), ...arrowArc(hand, h * ARROW_APEX), t: 0
  };
}

// The cowboy's revolver: level flight from the hand, BULLET_RANGE body heights, then it drops.
function makeBullet(f, owner) {
  const h = f.stats.height ?? BODY_H, x0 = f.x + f.facing * 30;
  return { type: 'bullet', owner, dir: f.facing, x0, x: x0, y: f.y - h * 0.62, range: BULLET_RANGE * h, dmg: Math.round(f.stats.power * BULLET_MULT), t: 0, dropping: false, vx: 0, vy: 0 };
}

const fHalfW = f => f.stats.halfW ?? BODY_HALF_W;
const fHeight = f => f.stats.height ?? BODY_H;

// Bodies push each other apart; jumping over the opponent is still possible.
export function separate(a, b) {
  if (Math.abs(a.y - b.y) >= BODY_H * 0.8) return;
  const min = ((a.stats?.halfW ?? BODY_HALF_W) + (b.stats?.halfW ?? BODY_HALF_W)) * 0.9, dx = b.x - a.x;
  if (Math.abs(dx) >= min) return;
  const dir = dx !== 0 ? Math.sign(dx) : a.facing, push = (min - Math.abs(dx)) / 2;
  a.x -= dir * push;
  b.x += dir * push;
}

const hitType = e => e.parried ? 'parry' : e.evaded ? 'miss' : e.broken ? 'break' : e.guarded ? 'guard' : e.armored ? 'armor' : 'hit';
const hitstopFor = e => e.evaded ? 0 : e.parried ? HITSTOP_GUARD * 2 : e.guarded ? HITSTOP_GUARD : Math.min(HITSTOP_MAX, HITSTOP_BASE + e.damage * HITSTOP_PER_DMG);

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
    this.projectiles = [];
  }

  get world() { return { platforms: this.layout.platforms, ice: this.map.ice, gravity: this.map.gravity ?? 1 }; }

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
      if (me.blinked) {
        // dagger blink: vanish and reappear three body heights ahead
        const d = me.facing * 3 * (me.stats.height ?? BODY_H);
        this.effects.push({ type: 'smoke', x: me.x - d, y: me.y - 40, t: 0 }, { type: 'smoke', x: me.x, y: me.y - 40, t: 0 });
      }
      this.updateSeek(me, op, dt);
      const bomb = me.super?.def.bomb;
      if (bomb && !me.super.summoned && me.super.t >= bomb.at) {
        // lobbed from behind the archer (off to the rear) toward the middle of the current view
        me.super.summoned = true;
        const x0 = Math.max(-120, Math.min(WORLD_W + 120, me.x - me.facing * 360));
        this.projectiles.push({ type: 'bomb', owner: i, x0, x: x0, cx: this.cam + VIEW_W / 2, y: GROUND_Y - 60, t: 0, ...bomb });
      }
      // the archer's charged shot leaves the bow as the release frame starts (the cowboy fires his revolver)
      if (me.attack?.kind === 'charged' && (me.stats.bow || me.stats.gun) && !me.attack.fired && attackPhase(me) === 'active') {
        me.attack.fired = true;
        if (me.stats.gun) {
          const b = makeBullet(me, i);
          this.projectiles.push(b);
          this.effects.push({ type: 'muzzle', x: b.x, y: b.y, dir: me.facing, t: 0, life: 0.25 });
        } else this.projectiles.push(makeArrow(me, i));
      }
      if (me.reel && me.reel.t === 0) this.effects.push({ type: 'reel', who: i, x: me.x, y: me.y, dir: me.reel.dir, t: 0, life: 0.3 });
      this.updateLasso(me, op, i, dt);
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
    this.updateProjectiles(dt, live);
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

  // Cowboy's lasso: at lasso.at an opponent within the radius (any direction) is caught and pulled
  // in front of him over lasso.pull seconds; the lashes that follow only land on a caught opponent.
  updateLasso(me, op, i, dt) {
    const las = me.super?.def.lasso, sp = me.super;
    if (!las) return;
    if (!sp.lassoed && sp.t >= las.at) {
      sp.lassoed = true;
      const dx = op.x - me.x, dy = (op.y - fHeight(op) / 2) - (me.y - fHeight(me) / 2);
      const free = !op.ko && !op.super && !dashing(op);
      if (free && Math.hypot(dx, dy) <= las.radius) {
        const tx = Math.max(20, Math.min(WORLD_W - 20, me.x + me.facing * (fHalfW(me) + fHalfW(op) + 14)));
        sp.caught = { from: { x: op.x, y: op.y }, to: { x: tx, y: me.y }, t: 0, pull: las.pull };
        op.stun = Math.max(op.stun, sp.def.time - sp.t); op.attack = null; op.charge = 0; op.guard = op.guarding = false;
        op.airDash = null; op.reel = null; op.kb = 0;
        this.effects.push({ type: 'lasso', who: i, x: op.x, y: op.y - 40, t: 0, life: 0.5 });
      } else this.effects.push({ type: 'lassoMiss', who: i, x: me.x + me.facing * 120, y: me.y - 40, t: 0, life: 0.4 });
    }
    const c = sp.caught;
    if (c && c.t < c.pull) {
      c.t = Math.min(c.pull, c.t + dt);
      const u = c.t / c.pull, e = u * (2 - u);
      op.x = c.from.x + (c.to.x - c.from.x) * e;
      op.y = c.from.y + (c.to.y - c.from.y) * e - Math.sin(Math.PI * u) * 30;
      op.vx = op.vy = 0; op.kb = 0;
      op.onGround = u >= 1; op.platform = u >= 1 ? me.platform : -1;
    }
  }

  // Whirlwind kick: at seek.at, an opponent in front within range (or above) pulls the kicker to it.
  updateSeek(me, op, dt) {
    const sk = me.super?.def.seek, sp = me.super;
    if (!sk) return;
    if (!sp.sought && sp.t >= sk.at) {
      sp.sought = true;
      const dx = (op.x - me.x) * me.facing, hw = (me.stats.halfW ?? BODY_HALF_W) + (op.stats.halfW ?? BODY_HALF_W);
      if (!op.ko && dx > -hw && dx - hw <= sk.range && op.y <= me.y + 10) {
        sp.hover = true; sp.flying = true;
        sp.from = { x: me.x, y: me.y };
        sp.to = { x: op.x - me.facing * (hw + 6), y: op.y };
        me.onGround = false; me.platform = -1;
      }
    }
    if (sp.flying) {
      const u = Math.min(1, (sp.t - sk.at) / sk.fly), e = u * (2 - u);
      me.x = sp.from.x + (sp.to.x - sp.from.x) * e;
      me.y = sp.from.y + (sp.to.y - sp.from.y) * e;
      if (u >= 1) sp.flying = false;
    }
  }

  // Arrows and the artillery bomb.
  updateProjectiles(dt, live) {
    for (const p of this.projectiles) {
      p.t += dt;
      const op = this.fighters[1 - p.owner], hw = op.stats.halfW ?? BODY_HALF_W, h = op.stats.height ?? BODY_H;
      if (p.type === 'arrow') {
        p.u += ARROW_SPEED * dt / p.range;
        p.x = p.x0 + p.dir * p.u * p.range;
        p.y = p.feet - (p.a * p.u * p.u + p.b * p.u + p.c);
        const inside = Math.abs(op.x - p.x) < hw + 4 && p.y > op.y - h - 4 && p.y < op.y + 2;
        if (live && !op.ko && !op.super && !dashing(op) && inside) {
          p.done = true;
          const s = { kind: 'charged', dmg: p.dmg, kb: p.dmg * KNOCKBACK_PER_DMG, stun: HIT_STUN };
          this.hitFrom({ facing: p.dir, x: p.x, stats: {} }, op, s, p.x, 1 - p.owner);
        } else if (p.u >= 1) { p.done = true; this.effects.push({ type: 'arrowStuck', x: p.x, y: GROUND_Y, dir: p.dir, t: 0, life: 0.8 }); }
      } else if (p.type === 'bullet') {
        if (!p.dropping) {
          p.x += p.dir * BULLET_SPEED * dt;
          if (Math.abs(p.x - p.x0) >= p.range) { p.x = p.x0 + p.dir * p.range; p.dropping = true; p.vx = p.dir * 60; p.vy = 0; }
          const inside = Math.abs(op.x - p.x) < hw + 4 && p.y > op.y - h - 4 && p.y < op.y + 2;
          if (live && !op.ko && !op.super && !dashing(op) && inside) {
            p.done = true;
            const s = { kind: 'charged', dmg: p.dmg, kb: p.dmg * KNOCKBACK_PER_DMG, stun: HIT_STUN };
            this.hitFrom({ facing: p.dir, x: p.x, stats: {} }, op, s, p.x, 1 - p.owner);
          }
        } else {
          // spent: falls straight to the ground, harmless
          p.vy += 2600 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.y >= GROUND_Y) { p.done = true; this.effects.push({ type: 'bulletDrop', x: p.x, y: GROUND_Y, t: 0, life: 0.5 }); }
        }
      } else if (p.type === 'bomb') {
        const u = Math.min(1, p.t / p.flight), cx = p.cx;
        p.x = p.x0 + (cx - p.x0) * u;
        p.y = GROUND_Y - 60 * (1 - u) - p.apex * 4 * u * (1 - u);
        if (u >= 1) {
          p.done = true;
          this.effects.push({ type: 'explosion', x: cx, y: GROUND_Y, r: p.radius, t: 0, life: 1.0 });
          if (live && !op.ko && !op.super && !dashing(op) && Math.abs(op.x - cx) < p.radius + hw && op.y > GROUND_Y - 220) {
            const s = { dmg: p.dmg, kb: p.kb, stun: p.stun, launch: p.launch, super: true, index: 0, noEvade: true };
            this.hitFrom({ facing: op.x >= cx ? 1 : -1, x: cx, stats: {} }, op, s, op.x, 1 - p.owner);
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.done && p.x > -300 && p.x < WORLD_W + 300);
  }

  // Applies a hit that doesn't come from a fighter's own hitbox (arrows, bombs, the bull).
  hitFrom(att, def, s, x, who) {
    const e = confirmHit({ att, def, s, x }, this.rand, { lateGuard: def.guarding, parry: true });
    this.effects.push({ type: hitType(e), who, big: !!s.super || e.damage >= 18, x: e.x, y: e.y, dmg: e.damage, dir: att.facing, t: 0 });
    this.hitstop = Math.max(this.hitstop, hitstopFor(e));
    return e;
  }

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
      this.hitFrom({ facing: bull.dir, x: bull.x, stats: {} }, op, s, op.x, 1 - bull.owner);
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
      const e = confirmHit(p, this.rand, { lateGuard: p.def.guarding, parry: true });
      const who = this.fighters.indexOf(p.def);
      this.effects.push({ type: hitType(e), who, big: e.super || e.damage >= 20, x: e.x, y: e.y, dmg: e.damage, dir: p.att.facing, t: 0, ...(e.parried ? { life: 0.6, ax: p.att.x, ay: p.att.y } : {}) });
      this.hitstop = Math.max(this.hitstop, hitstopFor(e));
    }
    if (trade && due.length) this.effects.push({ type: 'trade', x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 100, t: 0, life: 0.9 });
  }

  applyTrap(f, dt) {
    const onTrap = f.onGround && f.platform < 0 && this.layout.traps.some(t => f.x > t.x + 4 && f.x < t.x + t.w - 4);
    // stepping in sets the trap off once: the guard scolds, the crocodile bites, the crab pinches
    if (onTrap && !f.inTrap && this.map.trapEvent) this.effects.push({ type: this.map.trapEvent, x: f.x, who: this.fighters.indexOf(f), t: 0, life: 1.1 });
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
