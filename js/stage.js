// Phaser host: owns the WebGL canvas, the sound manager and the fight scene.
// Game rules stay in game.js; this module only reads the state and draws it,
// adding engine-side effects (particles, Arcade-physics debris, camera FX, filters, sound).
import * as Phaser from '../vendor/phaser-4.2.1.esm.min.js';
import { VIEW_W, VIEW_H, WORLD_W, GROUND_Y, PARALLAX, MAX_ENERGY, SUPER_MAX, SUPER_HOLD, BODY_HALF_W, BODY_H } from './config.js';
import { frameName } from './fighter.js';
import { loadImage, rasterize } from './assets.js';
import { INTRO_TIME } from './game.js';

export const SFX = ['swing', 'swingHeavy', 'hit', 'hitHeavy', 'guard', 'miss', 'jump', 'land', 'charge', 'super', 'quake', 'ko',
  'round', 'fight', 'trade', 'trap', 'move', 'select', 'back', 'win'];
const STEP = 1 / 120;
const MAX_TEX = 4096;
const FONT = '"Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const quant = v => Math.floor(v * 4) / 4;
const rnd = (a, b) => a + Math.random() * (b - a);
const halfW = f => f.stats.halfW ?? BODY_HALF_W;
const height = f => f.stats.height ?? BODY_H;

// per-map tint for dust and debris, and the trap splash color
const MAP_FX = {
  lava:   { dust: 0x6a4a3a, debris: 0x4a3328, trap: [0xffd23f, 0xff6a1f, 0xd8261b], ambient: 'embers' },
  jungle: { dust: 0x7a5a36, debris: 0x5e4426, trap: [0x9fe0ff, 0x4aa8d8, 0xffffff], ambient: 'leaves' },
  seoul:  { dust: 0x8a8a92, debris: 0x7c7c84, trap: [0xffffff, 0x8ff3ff, 0x4fb6ff], ambient: null },
  tundra: { dust: 0xdbeaf5, debris: 0xbfe2ff, trap: [0xffffff, 0xbfe8ff, 0x7cc4f0], ambient: 'snow' }
};

/* ---------- procedural textures ---------- */
function canvasTexture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  scene.textures.addCanvas(key, c);
}

function makeFxTextures(scene) {
  const radial = (stops) => (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  };
  canvasTexture(scene, 'fx-dot', 32, 32, radial([[0, '#fff'], [0.35, 'rgba(255,255,255,.9)'], [1, 'rgba(255,255,255,0)']]));
  canvasTexture(scene, 'fx-puff', 64, 64, radial([[0, 'rgba(255,255,255,.85)'], [0.6, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]));
  canvasTexture(scene, 'fx-aura', 128, 128, radial([[0, 'rgba(255,230,120,.9)'], [0.45, 'rgba(255,160,40,.45)'], [1, 'rgba(255,120,0,0)']]));
  canvasTexture(scene, 'fx-vignette', 256, 144, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  canvasTexture(scene, 'fx-ring', 96, 96, (ctx, w) => {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(w / 2, w / 2, w / 2 - 6, 0, Math.PI * 2); ctx.stroke();
  });
  canvasTexture(scene, 'fx-star', 96, 96, (ctx, w) => {
    ctx.translate(w / 2, w / 2); ctx.fillStyle = '#fff'; ctx.beginPath();
    for (let i = 0; i < 16; i++) { const r = i % 2 ? 9 : 46, a = i * Math.PI / 8; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.fill();
  });
  canvasTexture(scene, 'fx-rock', 14, 12, ctx => {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(2, 4); ctx.lineTo(7, 1); ctx.lineTo(13, 4); ctx.lineTo(11, 11); ctx.lineTo(3, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  });
  canvasTexture(scene, 'fx-leaf', 14, 8, ctx => {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(7, 4, 6.5, 3, 0, 0, Math.PI * 2); ctx.fill();
  });
}

/* ---------- scenes ---------- */
class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  preload() { for (const n of SFX) this.load.audio(n, `sfx/${n}.wav`); }
  create() { makeFxTextures(this); this.game.events.emit('versus-ready'); }
}

class FightScene extends Phaser.Scene {
  constructor() { super('fight'); }

  // data: { game, theme, readInputs(), onLoaded() }
  init(data) {
    Object.assign(this, { model: data.game, theme: data.theme, readInputs: data.readInputs, onLoaded: data.onLoaded });
    this.ready = false; this.acc = 0; this.slowT = 0; this.round = -1;
    this.seen = new WeakSet(); this.texts = []; this.prev = [{}, {}]; this.trapT = [0, 0];
  }

  create() {
    const cam = this.cameras.main;
    cam.setOrigin(0, 0).setBackgroundColor('#000');
    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);
    this.events.once('shutdown', () => { this.scale.off('resize', this.fitCamera, this); this.sound.stopByKey?.('charge'); });
    this.physics.world.setBounds(0, -400, WORLD_W, VIEW_H + 800);
    this.prepare().then(() => { if (this.sys.isActive() || this.sys.isPaused()) { this.build(); this.ready = true; this.onLoaded?.(); } });
  }

  fitCamera() {
    const z = this.scale.width / VIEW_W;
    this.cameras.main.setZoom(z);
    for (const t of this.texts) t.setResolution(Math.min(3, z));
  }

  // Rasterize SVG sheets at the screen scale (capped to the GPU texture limit) and cut frames.
  async prepare() {
    const px = this.scale.width / VIEW_W, t = this.theme, base = t.base, m = t.maps[this.model.mapId];
    const sheet = async (url, want) => {
      const img = await loadImage(url);
      const k = Math.max(0.5, quant(Math.min(want, MAX_TEX / Math.max(img.naturalWidth, img.naturalHeight))));
      const r = await rasterize(url, k), key = `${url}@${k}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, r.canvas);
      return { key, k, tex: this.textures.get(key) };
    };
    const mapScale = clamp(px, 1, 3), charScale = clamp(px * 0.8, 1, 3);
    const [far, ground, trap, plats, ...chars] = await Promise.all([
      sheet(base + m.far, mapScale), sheet(base + m.ground, mapScale), sheet(base + m.trap.sheet, mapScale), sheet(base + m.platforms.sheet, mapScale),
      ...this.model.settings.weapons.map(w => sheet(base + t.characters[w].sheet, charScale))
    ]);
    const tw = m.trap.cell[0], th = m.trap.cell[1];
    for (let fr = 0; fr < m.trap.frames; fr++) if (!trap.tex.has(`f${fr}`)) trap.tex.add(`f${fr}`, 0, fr * tw * trap.k, 0, tw * trap.k, th * trap.k);
    m.platforms.widths.forEach((w, i) => { if (!plats.tex.has(`w${w}`)) plats.tex.add(`w${w}`, 0, 0, i * m.platforms.cellH * plats.k, (w + 8) * plats.k, m.platforms.cellH * plats.k); });
    this.model.settings.weapons.forEach((w, i) => {
      const c = t.characters[w], s = chars[i];
      for (const [name, idx] of Object.entries(c.frames)) {
        if (s.tex.has(name)) continue;
        const col = idx % c.cols, row = Math.floor(idx / c.cols);
        s.tex.add(name, 0, col * c.cell[0] * s.k, row * c.cell[1] * s.k, c.cell[0] * s.k, c.cell[1] * s.k);
      }
    });
    this.sheets = { far, ground, trap, plats, chars };
  }

  build() {
    const { sheets: sh, theme } = this, m = theme.maps[this.model.mapId];
    this.mapFx = MAP_FX[this.model.mapId];
    this.add.image(0, 0, sh.far.key).setOrigin(0).setScale(1 / sh.far.k).setScrollFactor(PARALLAX).setDepth(0);
    this.roundObjs = [];
    this.add.image(0, GROUND_Y, sh.ground.key).setOrigin(0).setScale(1 / sh.ground.k).setDepth(3);
    this.shadows = this.add.graphics().setDepth(5);

    // Arcade physics: debris bounces on the ground and lands on platforms (one-way)
    this.solids = this.physics.add.staticGroup();
    this.debris = this.physics.add.group({ bounceX: 0.3, bounceY: 0.42, dragX: 90, maxSize: 60 });
    this.physics.add.collider(this.debris, this.solids, (d) => { if (Math.abs(d.body.velocity.y) < 40) d.setAngularVelocity(d.body.angularVelocity * 0.6); });

    this.fighters = this.model.settings.weapons.map((w, i) => {
      const c = theme.characters[w], s = sh.chars[i];
      const mk = () => this.add.sprite(0, 0, s.key, 'idle0').setOrigin(c.origin[0] / c.cell[0], c.origin[1] / c.cell[1]);
      const ghosts = [0, 1, 2].map(() => mk().setVisible(false).setDepth(9).setTint(0xffd27a).setTintMode(Phaser.TintModes.ADD));
      const aura = this.add.image(0, 0, 'fx-aura').setBlendMode(Phaser.BlendModes.ADD).setDepth(9).setVisible(false);
      const sprite = mk().setDepth(10);
      let glow = null;
      try { sprite.enableFilters(); glow = sprite.filters.internal.addGlow(0xffc83a, 6, 0, 1, false, 10, 12); glow.active = false; } catch { glow = null; }
      // particles converging on the fighter while charging the super
      const charge = this.add.particles(0, 0, 'fx-dot', {
        emitting: false, lifespan: 320, scale: { start: 0.35, end: 0.05 }, alpha: { start: 0, end: 1 }, blendMode: 'ADD', tint: [0xffe27a, 0xffffff],
        emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 70), quantity: 24 },
        emitCallback: p => { p.velocityX = -p.x / 0.32; p.velocityY = -p.y / 0.32; }
      }).setDepth(11);
      return { c, k: s.k, sprite, ghosts, aura, glow, charge };
    });

    const P = (cfg) => this.add.particles(0, 0, cfg.texture || 'fx-dot', { emitting: false, ...cfg }).setDepth(cfg.depth ?? 20);
    const groundBounds = { x: -200, y: -800, w: WORLD_W + 400, h: GROUND_Y + 800 };
    this.fx = {
      spark: P({ lifespan: { min: 260, max: 520 }, speed: { min: 160, max: 440 }, scale: { start: 0.42, end: 0 }, blendMode: 'ADD', tint: [0xffffff, 0xffe35a, 0xffa628],
        gravityY: 900, bounce: 0.45, bounds: groundBounds, collideTop: false, collideLeft: false, collideRight: false }),
      guard: P({ lifespan: { min: 200, max: 380 }, speed: { min: 120, max: 300 }, scale: { start: 0.36, end: 0 }, blendMode: 'ADD', tint: [0xffffff, 0x9fdcff, 0x4fa3ff],
        gravityY: 700, bounce: 0.5, bounds: groundBounds, collideTop: false, collideLeft: false, collideRight: false }),
      dust: P({ texture: 'fx-puff', lifespan: { min: 380, max: 700 }, speedX: { min: -70, max: 70 }, speedY: { min: -40, max: -5 }, scale: { start: 0.25, end: 0.7 },
        alpha: { start: 0.55, end: 0 }, tint: this.mapFx.dust, depth: 8 }),
      smoke: P({ texture: 'fx-puff', lifespan: { min: 400, max: 700 }, speed: { min: 30, max: 120 }, scale: { start: 0.5, end: 1.1 }, alpha: { start: 0.85, end: 0 }, tint: [0x2a2236, 0x4a3a5e], depth: 12 }),
      trap: P({ lifespan: { min: 300, max: 700 }, speedX: { min: -60, max: 60 }, speedY: { min: -320, max: -120 }, gravityY: 800, scale: { start: 0.35, end: 0.05 },
        blendMode: this.model.mapId === 'seoul' || this.model.mapId === 'lava' ? 'ADD' : 'NORMAL', tint: this.mapFx.trap, bounce: 0.3, bounds: groundBounds,
        collideTop: false, collideLeft: false, collideRight: false })
    };
    this.makeAmbient();

    // HUD (fixed to the camera)
    const T = (style, ox = 0, oy = 0) => {
      const t = this.add.text(0, 0, '', { fontFamily: FONT, color: '#fff', stroke: '#000', ...style }).setOrigin(ox, oy).setScrollFactor(0).setDepth(1001);
      this.texts.push(t); return t;
    };
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.hudText = [0, 1].map(i => ({
      name: T({ fontSize: '10px', fontStyle: '700', strokeThickness: 2 }, i ? 1 : 0, 0),
      hp: T({ fontSize: '10px', fontStyle: '700', color: '#ffd9a0', strokeThickness: 2 }, i ? 0 : 1, 0),
      gauge: T({ fontSize: '8px', fontStyle: '800', strokeThickness: 3 }, i ? 1 : 0, 0)
    }));
    this.timer = T({ fontSize: '20px', fontStyle: '900', strokeThickness: 3 }, 0.5, 0);
    this.banner = T({ fontSize: '52px', fontStyle: '900', color: '#ffcf5a', stroke: '#1a0d00', strokeThickness: 8 }, 0.5, 0.5);
    this.bannerSub = T({ fontSize: '22px', fontStyle: '800', stroke: '#1a0d00', strokeThickness: 5 }, 0.5, 0.5);
    this.superName = T({ fontSize: '22px', fontStyle: '900', color: '#ffd05a', stroke: '#1a0d00', strokeThickness: 5 }, 0, 0.5);
    for (const t of [this.banner, this.bannerSub]) t.setPosition(VIEW_W / 2, VIEW_H * 0.42);
    this.bannerSub.y = VIEW_H * 0.42 + 38;
    this.superBar = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.vignette = this.add.image(0, 0, 'fx-vignette').setOrigin(0).setDisplaySize(VIEW_W, VIEW_H).setScrollFactor(0).setDepth(900).setAlpha(0);
    this.fitCamera();
  }

  makeAmbient() {
    const kind = this.mapFx.ambient;
    if (kind === 'embers') this.add.particles(0, 0, 'fx-dot', { x: { min: 0, max: WORLD_W }, y: GROUND_Y + 6, frequency: 90, lifespan: 3200, speedY: { min: -70, max: -25 },
      speedX: { min: -12, max: 12 }, scale: { start: 0.22, end: 0 }, alpha: { start: 1, end: 0 }, blendMode: 'ADD', tint: [0xffb347, 0xff6a1f, 0xffe27a] }).setDepth(7);
    if (kind === 'leaves') this.add.particles(0, 0, 'fx-leaf', { x: { min: 0, max: WORLD_W }, y: -10, frequency: 520, lifespan: 9000, speedY: { min: 22, max: 42 },
      speedX: { min: -25, max: 15 }, rotate: { start: 0, end: 540 }, scale: { min: 0.7, max: 1.1 }, tint: [0x4f8f3a, 0x7cb342, 0x9a8a2a] }).setDepth(7);
    if (kind === 'snow') this.add.particles(0, 0, 'fx-dot', { x: { min: 0, max: WORLD_W }, y: -10, frequency: 45, lifespan: 7000, speedY: { min: 28, max: 60 },
      speedX: { min: -18, max: 6 }, scale: { min: 0.08, max: 0.2 }, alpha: { min: 0.5, max: 0.95 } }).setDepth(21);
  }

  // Platforms and traps move every round.
  buildRound() {
    const m = this.theme.maps[this.model.mapId], L = this.model.layout, sh = this.sheets;
    for (const o of this.roundObjs) o.destroy();
    this.roundObjs = [];
    this.solids.clear(true, true);
    this.debris.clear(true, true);
    const g = this.add.graphics().setDepth(1);
    for (const p of L.platforms) {
      if (m.extras.ropes) { g.lineStyle(2.5, Phaser.Display.Color.HexStringToColor(m.extras.ropes).color); g.lineBetween(p.x + 6, 0, p.x + 8, p.y); g.lineBetween(p.x + p.w - 6, 0, p.x + p.w - 8, p.y); }
      if (m.extras.posts) { g.lineStyle(4, Phaser.Display.Color.HexStringToColor(m.extras.posts).color); for (const px of [p.x + 12, p.x + p.w - 12]) g.lineBetween(px, p.y + 14, px, GROUND_Y + 2); }
    }
    this.roundObjs.push(g);
    for (const p of L.platforms) {
      this.roundObjs.push(this.add.image(p.x - m.platforms.origin[0], p.y - m.platforms.origin[1], sh.plats.key, `w${p.w}`).setOrigin(0).setScale(1 / sh.plats.k).setDepth(2));
      const z = this.add.zone(p.x + p.w / 2, p.y + 3, p.w, 6);
      this.solids.add(z);
      Object.assign(z.body.checkCollision, { down: false, left: false, right: false });
    }
    const gz = this.add.zone(WORLD_W / 2, GROUND_Y + 10, WORLD_W + 400, 20);
    this.solids.add(gz);
    this.traps = L.traps.map(t => this.add.sprite(t.x - m.trap.origin[0], GROUND_Y - m.trap.origin[1], sh.trap.key, 'f0').setOrigin(0).setScale(1 / sh.trap.k).setDepth(4));
    this.roundObjs.push(...this.traps);
    this.round = this.model.round;
  }

  update(time, delta) {
    if (!this.ready) return;
    const dt = Math.min(0.05, delta / 1000);
    this.slowT = Math.max(0, this.slowT - dt);
    this.acc += dt * (this.slowT > 0 ? 0.3 : 1);
    while (this.acc >= STEP) {
      this.model.update(STEP, this.readInputs());
      this.acc -= STEP;
      if (this.model.round !== this.round) this.buildRound();
      this.events_();
    }
    this.sync(dt);
  }

  /* ---------- state → effects & sound ---------- */
  sfx(key, cfg) { if (this.game.sound.locked) return; this.sound.play(key, cfg); }

  events_() {
    const g = this.model, cam = this.cameras.main;
    for (const e of g.effects) {
      if (this.seen.has(e)) continue;
      this.seen.add(e);
      const dir = e.dir ?? 1;
      if (e.type === 'hit') {
        const big = e.big || e.dmg >= 18;
        this.fx.spark.setEmitterAngle?.({ min: dir > 0 ? -70 : 110, max: dir > 0 ? 70 : 250 });
        this.fx.spark.explode(big ? 26 : 12, e.x, e.y);
        this.flashStar(e.x, e.y, big ? 1.2 : 0.7, 0xfff3b0);
        this.popText(`-${e.dmg}`, e.x, e.y - 18, big ? '#ffb347' : '#ffef6a', 16 + e.dmg * 0.5);
        cam.shake(big ? 220 : 110, (big ? 0.012 : 0.005) + e.dmg * 0.0002);
        if (big) this.spawnDebris(e.x, GROUND_Y - 4, 6, dir);
        this.sfx(big ? 'hitHeavy' : 'hit', { volume: 0.8 });
      } else if (e.type === 'guard') {
        this.fx.guard.setEmitterAngle?.({ min: dir > 0 ? -80 : 100, max: dir > 0 ? 80 : 260 });
        this.fx.guard.explode(10, e.x, e.y);
        this.ring(e.x, e.y, 0x8fd3ff);
        this.popText(`-${e.dmg}`, e.x, e.y - 18, '#bfe6ff', 14);
        cam.shake(70, 0.003);
        this.sfx('guard', { volume: 0.7 });
      } else if (e.type === 'miss') {
        this.popText('회피!', e.x, e.y - 18, '#9ef0ff', 16);
        this.sfx('miss', { volume: 0.7 });
      } else if (e.type === 'trade') {
        this.popText('동시타격!', e.x, e.y, '#ff8a5a', 18);
        this.ring(e.x, e.y + 40, 0xffffff, 1.6);
        this.sfx('trade');
      } else if (e.type === 'super') {
        const f = g.fighters[e.who];
        cam.flash(180, 255, 240, 200);
        this.ring(f.x, f.y - height(f) / 2, 0xffd05a, 2.4);
        this.fx.dust.explode(14, f.x, f.y);
        this.pulseVignette();
        this.sfx('super');
      } else if (e.type === 'smoke') {
        this.fx.smoke.explode(16, e.x, e.y);
        this.sfx('miss', { volume: 0.5, rate: 0.7 });
      } else if (e.type === 'quake') {
        cam.shake(420, 0.02);
        for (let k = 1; k <= 6; k++) this.time.delayedCall(k * 40, () => { const x = e.x + e.dir * k * 30; this.fx.dust.explode(5, x, GROUND_Y); this.spawnDebris(x, GROUND_Y - 4, 3, e.dir); });
        this.sfx('quake');
      }
    }

    g.fighters.forEach((f, i) => {
      const p = this.prev[i];
      if (f.attack && f.attack !== p.attack) this.sfx(f.stats.power >= 18 ? 'swingHeavy' : 'swing', { volume: 0.55, rate: rnd(0.92, 1.08) });
      if (p.onGround && !f.onGround && f.vy < 0) { this.fx.dust.explode(5, f.x, f.y); this.sfx('jump', { volume: 0.4 }); }
      if (p.onGround === false && f.onGround) {
        this.fx.dust.explode(p.vy > 600 ? 10 : 5, f.x, f.y);
        this.sfx('land', { volume: 0.45 });
        if (p.vy > 650) this.cameras.main.shake(80, 0.003);
      }
      if (f.charge > 0 && !(p.charge > 0)) this.chargeSound = this.sound.add('charge'), this.game.sound.locked || this.chargeSound.play({ volume: 0.5 });
      if (!(f.charge > 0) && p.charge > 0) { this.chargeSound?.stop(); this.chargeSound?.destroy(); this.chargeSound = null; }
      if (f.ko && !p.ko) {
        this.slowT = 0.9;
        this.cameras.main.flash(260, 255, 255, 255);
        this.cameras.main.shake(500, 0.016);
        this.spawnDebris(f.x, f.y - 4, 10, -f.facing);
        this.pulseVignette(0.75);
        this.sfx('ko');
      }
      // trap splash
      if (f.inTrap) {
        this.trapT[i] -= STEP;
        if (this.trapT[i] <= 0) { this.trapT[i] = 0.16; this.fx.trap.explode(5, f.x, GROUND_Y - 4); if (Math.random() < 0.4) this.sfx('trap', { volume: 0.35 }); }
      }
      // super dash: dust trail from the feet
      if (f.super && f.onGround && Math.abs(f.vx) > 150 && Math.random() < 0.5) this.fx.dust.explode(2, f.x - f.facing * 10, f.y);
      Object.assign(p, { attack: f.attack, onGround: f.onGround, vy: f.vy, charge: f.charge, ko: f.ko });
    });

    if (g.phase !== this.lastPhase) {
      if (g.phase === 'intro') this.sfx('round', { volume: 0.6 });
      if (g.phase === 'fight') this.sfx('fight', { volume: 0.6 });
      if (g.phase === 'matchEnd') this.sfx('win', { volume: 0.6 });
      this.lastPhase = g.phase;
    }
  }

  spawnDebris(x, y, n, dir = 0) {
    for (let k = 0; k < n; k++) {
      const d = this.debris.get(x + rnd(-8, 8), y, 'fx-rock');
      if (!d) return;
      d.setActive(true).setVisible(true).setAlpha(1).setDepth(6).setTint(this.mapFx.debris).setScale(rnd(0.5, 1.15));
      d.body.reset(d.x, d.y);
      d.body.setAllowGravity(true);
      d.body.setGravityY(700);
      d.setVelocity(rnd(-140, 140) + dir * 120, rnd(-460, -200));
      d.setAngularVelocity(rnd(-720, 720));
      this.tweens.add({ targets: d, alpha: 0, delay: 1400, duration: 400, onComplete: () => { this.debris.killAndHide(d); d.body.enable = false; } });
      d.body.enable = true;
    }
  }

  flashStar(x, y, s, tint) {
    const img = this.add.image(x, y, 'fx-star').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setDepth(19).setScale(0.2 * s).setRotation(rnd(0, 1));
    this.tweens.add({ targets: img, scale: 0.75 * s, alpha: 0, duration: 200, ease: 'Cubic.easeOut', onComplete: () => img.destroy() });
  }

  ring(x, y, tint, s = 1) {
    const img = this.add.image(x, y, 'fx-ring').setTint(tint).setDepth(19).setScale(0.2 * s).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: img, scale: 0.9 * s, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => img.destroy() });
  }

  popText(str, x, y, color, size) {
    const t = this.add.text(x, y, str, { fontFamily: FONT, fontSize: `${Math.round(size)}px`, fontStyle: '900', color, stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5).setDepth(30).setResolution(Math.min(3, this.cameras.main.zoom));
    this.tweens.add({ targets: t, y: y - 34, alpha: { from: 1, to: 0 }, duration: 650, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  pulseVignette(strength = 0.6) {
    this.tweens.killTweensOf(this.vignette);
    this.vignette.setAlpha(strength);
    this.tweens.add({ targets: this.vignette, alpha: 0, duration: 900, ease: 'Quad.easeOut' });
  }

  /* ---------- per-frame sync ---------- */
  sync() {
    const g = this.model, cam = this.cameras.main;
    cam.scrollX = g.cam;
    const tf = Math.floor(g.t * 3) % 2;
    for (const s of this.traps || []) s.setFrame(`f${tf}`);

    this.shadows.clear();
    g.fighters.forEach((f, i) => {
      const y = this.surfaceBelow(f), k = clamp(1 - (y - f.y) / 220, 0.35, 1), w = 20 * halfW(f) / BODY_HALF_W;
      this.shadows.fillStyle(0x000000, 0.35).fillEllipse(f.x, y + 1, w * 2 * k, 10 * k);
      const v = this.fighters[i], c = v.c, sx = f.facing * c.scale / v.k, sy = c.scale / v.k;
      const frame = frameName(f);
      v.sprite.setFrame(frame).setScale(sx, sy).setDepth(f.attack || f.super ? 11 : 10);
      if (f.ko) {
        const r = Math.min(1, (f.t - f.koAt) * 4);
        v.sprite.setPosition(f.x - f.facing * 6, f.y - 10).setRotation(-f.facing * Math.PI / 2 * r);
      } else v.sprite.setPosition(f.x, f.y).setRotation(0);
      // hit flash: solid white for a moment, then blink
      if (f.hitFlash > 0.14) v.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL).setAlpha(1);
      else {
        v.sprite.clearTint?.(); v.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
        v.sprite.setAlpha(f.hitFlash > 0 && Math.floor(f.hitFlash * 30) % 2 ? 0.45 : f.inTrap && Math.floor(g.t * 12) % 2 ? 0.6 : 1);
      }
      if (v.glow) v.glow.active = !!f.super;
      // dash afterimages
      const dashing = f.super && Math.abs(f.vx) > 100;
      v.ghosts.forEach((gh, n) => {
        gh.setVisible(dashing);
        if (dashing) gh.setFrame(frame).setScale(sx, sy).setPosition(f.x - f.vx * 0.025 * (n + 1), f.y).setAlpha(0.32 - n * 0.09);
      });
      // aura while the gauge is full, charging or in a super
      const full = f.meter >= SUPER_MAX && !f.ko;
      if (f.super || f.charge > 0 || full) {
        const s = f.super ? 1 : f.charge > 0 ? 0.45 + 0.55 * f.charge / SUPER_HOLD : 0.3 + 0.12 * Math.sin(g.t * 8);
        v.aura.setVisible(true).setPosition(f.x, f.y - height(f) / 2).setScale(height(f) * 1.6 / 128).setAlpha(s);
      } else v.aura.setVisible(false);
      v.charge.setPosition(f.x, f.y - height(f) / 2);
      if (f.charge > 0) v.charge.emitParticle(2);
    });
    this.drawHud();
  }

  surfaceBelow(f) {
    let y = GROUND_Y;
    for (const p of this.model.layout.platforms) if (f.x >= p.x && f.x <= p.x + p.w && p.y >= f.y - 1 && p.y < y) y = p.y;
    return y;
  }

  drawHud() {
    const g = this.model, h = this.hud, barW = 230, barH = 12, top = 12, cx = VIEW_W / 2;
    h.clear();
    h.fillStyle(0x000000, 0.45).fillRect(0, 0, VIEW_W, 44);
    g.fighters.forEach((f, i) => {
      const left = i === 0, x0 = left ? cx - 30 - barW : cx + 30, ratio = f.energy / MAX_ENERGY, fw = barW * ratio;
      h.fillStyle(0x3a0f12).fillRect(x0, top, barW, barH);
      h.fillStyle(ratio > 0.3 ? 0xffd23f : 0xff5a3c).fillRect(left ? x0 : x0 + barW - fw, top, fw, barH);
      h.lineStyle(1.5, 0xffffff).strokeRect(x0, top, barW, barH);
      for (let k = 0; k < g.settings.wins; k++) {
        const wx = left ? x0 - 9 - k * 9 : x0 + barW + 9 + k * 9;
        h.fillStyle(k < g.wins[i] ? 0xffd23f : 0x2a2a33).fillCircle(wx, top + barH / 2, 3.4);
        h.lineStyle(1, 0x000000).strokeCircle(wx, top + barH / 2, 3.4);
      }
      const T = this.hudText[i], ch = this.theme.characters[f.weapon];
      T.name.setText(`${i === 0 ? 'P1' : g.settings.mode === '2p' ? 'P2' : 'CPU'} · ${ch.name}`).setPosition(left ? x0 : x0 + barW, top + barH + 3);
      T.hp.setText(String(Math.ceil(f.energy))).setPosition(left ? x0 + barW : x0, top + barH + 3);
      // super gauge
      const gw = 120, gh = 6, gx = left ? x0 : x0 + barW - gw, gy = 48, full = f.meter >= SUPER_MAX, gr = f.meter / SUPER_MAX;
      h.fillStyle(0x000000, 0.55).fillRect(gx - 1, gy - 1, gw + 2, gh + 2);
      h.fillStyle(full ? (Math.floor(g.t * 6) % 2 ? 0xfff3a0 : 0xff9a1f) : 0x4fd1ff).fillRect(left ? gx : gx + gw * (1 - gr), gy, gw * gr, gh);
      if (f.charge > 0) { const cw = gw * f.charge / SUPER_HOLD; h.fillStyle(0xffffff).fillRect(left ? gx : gx + gw - cw, gy + gh - 2, cw, 2); }
      T.gauge.setText(full ? '필살기 MAX · 공격+방어 1초' : `필살 ${f.meter}/${SUPER_MAX}`).setColor(full ? '#ffe35a' : '#bfefff').setPosition(left ? gx : gx + gw, gy + gh + 2);
    });
    const tl = Math.ceil(g.timeLeft);
    this.timer.setText(String(tl)).setColor(tl <= 10 ? '#ff6b5a' : '#ffffff').setPosition(cx, top - 4);

    // round banners
    let text = '', sub = '';
    const ph = g.phase, t = g.phaseT, names = g.fighters.map(f => this.theme.characters[f.weapon].name);
    if (ph === 'intro') text = t < INTRO_TIME * 0.65 ? `ROUND ${g.round}` : 'FIGHT!';
    else if (ph === 'roundEnd' && g.result) {
      text = g.result.reason === 'KO' ? 'K.O.' : 'TIME UP';
      if (t > 0.8) sub = g.result.winner < 0 ? '무승부' : `${names[g.result.winner]} 승리`;
    } else if (ph === 'matchEnd' && t < 1.5) { text = 'WINNER'; sub = names[g.winner]; }
    const pop = 0.6 + 0.4 * Math.min(1, t * 6);
    this.banner.setText(text).setScale(pop);
    this.bannerSub.setText(sub);

    // super name slides in from the user's side
    const e = g.effects.find(x => x.type === 'super');
    this.superBar.clear();
    if (e) {
      const left = e.who === 0, slide = Math.min(1, e.t * 8), p = e.t / e.life, a = p > 0.8 ? (1 - p) / 0.2 : 1, y = 92;
      this.superBar.fillStyle(0x140a00, 0.6 * a).fillRect(left ? 0 : VIEW_W - 260 * slide, y - 16, 260 * slide, 32);
      this.superName.setText(e.name).setAlpha(a).setOrigin(left ? 0 : 1, 0.5).setPosition(left ? -240 + 256 * slide : VIEW_W + 240 - 256 * slide, y);
    } else this.superName.setText('');
  }
}

/* ---------- host ---------- */
export class Stage {
  constructor(parent) {
    this.parent = parent;
    this.ready = new Promise(resolve => {
      this.game = new Phaser.Game({
        type: Phaser.WEBGL, parent, width: VIEW_W, height: VIEW_H, backgroundColor: '#000000', banner: false,
        scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
        input: { keyboard: false, mouse: false, touch: false, gamepad: false },
        render: { antialias: true, powerPreference: 'high-performance' },
        physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1400 } } },
        scene: [BootScene, FightScene]
      });
      this.game.events.once('versus-ready', resolve);
    });
    this.muted = false;
  }

  // pixel size of the canvas backing store; CSS size is set by the caller
  resize(pw, ph) { if (this.game.scale.width !== pw || this.game.scale.height !== ph) this.game.scale.resize(pw, ph); }

  startFight(data) {
    const sm = this.game.scene;
    if (sm.isActive('fight') || sm.isPaused('fight')) sm.stop('fight');
    sm.start('fight', data);
  }
  stopFight() { this.game.scene.stop('fight'); }
  pause() { this.game.scene.pause('fight'); this.game.sound.pauseAll(); }
  resume() { this.game.scene.resume('fight'); this.game.sound.resumeAll(); }
  setMuted(v) { this.muted = v; this.game.sound.mute = v; }
  play(key, cfg) { if (!this.game.sound.locked && this.game.cache.audio.exists(key)) this.game.sound.play(key, { volume: 0.5, ...cfg }); }
}
