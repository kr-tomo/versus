// Phaser host: owns the WebGL canvas, the sound manager and the fight scene.
// Game rules stay in game.js; this module only reads the state and draws it,
// adding engine-side effects (particles, Arcade-physics debris, camera FX, filters, sound).
import * as Phaser from '../vendor/phaser-4.2.1.esm.min.js';
import { VIEW_W, VIEW_H, WORLD_W, GROUND_Y, PARALLAX, MAX_ENERGY, SUPER_MAX, SUPER_HOLD, BODY_HALF_W, BODY_H, FLIP_TIME, CHARGE_TIME, LONG_REACH_BONUS, AIR_LASH_REACH, REEL_DIST } from './config.js';
import { frameName, turnScale, attackPhase, attackTiming, chargeLeft } from './fighter.js';
import { loadImage, rasterize } from './assets.js';
import { INTRO_TIME } from './game.js';

export const SFX = ['swing', 'swingHeavy', 'hit', 'hitHeavy', 'guard', 'miss', 'jump', 'land', 'charge', 'super', 'quake', 'ko',
  'round', 'fight', 'trade', 'trap', 'move', 'select', 'back', 'win', 'heal', 'shout', 'boom', 'bow', 'whirl',
  'chargeUp', 'parry', 'gun', 'crack', 'chomp', 'snip', 'vs'];
const STEP = 1 / 120;
const MAX_TEX = 4096;
const FONT = '"Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const quant = v => Math.floor(v * 4) / 4;
const rnd = (a, b) => a + Math.random() * (b - a);
const halfW = f => f.stats.halfW ?? BODY_HALF_W;
const ease = t => t * t * (3 - 2 * t);
const CLOSE_ZOOM = 0.45;              // super close-up: extra zoom at full focus
const FOCUS_IN = 0.22, FOCUS_OUT = 0.45; // seconds to zoom in / back out
const height = f => f.stats.height ?? BODY_H;

// per-map tint for dust and debris, and the trap splash color
const MAP_FX = {
  lava:   { dust: 0x6a4a3a, debris: 0x4a3328, trap: [0xffd23f, 0xff6a1f, 0xd8261b], ambient: 'embers' },
  jungle: { dust: 0x7a5a36, debris: 0x5e4426, trap: [0x9fe0ff, 0x4aa8d8, 0xffffff], ambient: 'leaves' },
  seoul:  { dust: 0x8a8a92, debris: 0x7c7c84, trap: [0xffffff, 0x8ff3ff, 0x4fb6ff], ambient: null },
  tundra: { dust: 0xdbeaf5, debris: 0xbfe2ff, trap: [0xffffff, 0xbfe8ff, 0x7cc4f0], ambient: 'snow' },
  ship:    { dust: 0xb08a5a, debris: 0x7a5230, trap: [0xffd23f, 0xff7a1a, 0xc2410c], ambient: 'embers' },
  library: { dust: 0xc8b08a, debris: 0x8a5a32, trap: [0xffe066, 0xffffff, 0xffd23f], ambient: null },
  rome:    { dust: 0xe0d0aa, debris: 0xc8b890, trap: [0xc8a46a, 0x8a6a3a, 0xffffff], ambient: null },
  egypt:   { dust: 0xe8c482, debris: 0xc49a5a, trap: [0xe8c482, 0x8aa83a, 0xc49a5a], ambient: null },
  savanna: { dust: 0xc9a24e, debris: 0x8a6a30, trap: [0x9ac06a, 0x5a7a3a, 0xd8e8b0], ambient: 'leaves' },
  market:  { dust: 0xa8a8ae, debris: 0x6a6a72, trap: [0x9fe0ff, 0x6ab8e0, 0xffffff], ambient: null },
  moon:    { dust: 0xb8bcc4, debris: 0x8a8e96, trap: [0xd8ff6a, 0x7aff4a, 0x2aa02a], ambient: null }
};
const ADD_TRAPS = new Set(['seoul', 'lava', 'moon']);

/* ---------- procedural textures ---------- */
function rngLocal(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
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
  canvasTexture(scene, 'fx-blueglow', 128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(150,215,255,.9)'); g.addColorStop(0.45, 'rgba(60,140,255,.45)'); g.addColorStop(1, 'rgba(30,80,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  // one tongue of blue flame: white-hot core, blue edge, pointed tip
  canvasTexture(scene, 'fx-flame', 32, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(16, 46, 2, 16, 40, 30);
    g.addColorStop(0, 'rgba(200,236,255,.85)'); g.addColorStop(0.35, 'rgba(90,170,255,.7)'); g.addColorStop(0.75, 'rgba(30,90,255,.4)'); g.addColorStop(1, 'rgba(20,60,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(16, 0); ctx.bezierCurveTo(30, 22, 32, 40, 28, 52); ctx.quadraticCurveTo(16, 66, 4, 52); ctx.bezierCurveTo(0, 40, 2, 22, 16, 0); ctx.fill();
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
  canvasTexture(scene, 'fx-arrow', 40, 10, ctx => {
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(2, 5); ctx.lineTo(32, 5); ctx.stroke();
    ctx.strokeStyle = '#c9a46a'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.fillStyle = '#cdd3da'; ctx.beginPath(); ctx.moveTo(30, 1.5); ctx.lineTo(39, 5); ctx.lineTo(30, 8.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d0262e'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(2, 5); ctx.lineTo(-2, 1); ctx.moveTo(2, 5); ctx.lineTo(-2, 9); ctx.moveTo(7, 5); ctx.lineTo(3, 1); ctx.moveTo(7, 5); ctx.lineTo(3, 9); ctx.stroke();
  });
  // bigyeok-jincheollae: a round iron shell with a lit fuse
  canvasTexture(scene, 'fx-bomb', 40, 40, ctx => {
    const g = ctx.createRadialGradient(15, 17, 2, 20, 22, 16);
    g.addColorStop(0, '#8a8f98'); g.addColorStop(1, '#22252b');
    ctx.fillStyle = g; ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(20, 22, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#5a5f68'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(20, 22, 15, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.strokeStyle = '#7a4a1a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(20, 7); ctx.quadraticCurveTo(24, 2, 30, 4); ctx.stroke();
  });
  // a jagged lightning bolt with a soft blue glow, pointing down
  canvasTexture(scene, 'fx-bolt', 64, 256, ctx => {
    const r = rngLocal(5), pts = [[32, 0]];
    for (let y = 22; y < 256; y += 18 + r() * 14) pts.push([32 + (r() - 0.5) * 34, y]);
    pts.push([30 + (r() - 0.5) * 10, 256]);
    const stroke = (w, c, blur) => { ctx.shadowBlur = blur; ctx.shadowColor = '#7fc8ff'; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); };
    stroke(12, 'rgba(120,190,255,.35)', 18); stroke(6, '#bfe4ff', 10); stroke(2.5, '#ffffff', 4);
    // two side forks
    for (const k of [3, 6]) { const [x, y] = pts[Math.min(k, pts.length - 1)]; ctx.lineWidth = 2; ctx.strokeStyle = '#dff2ff'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (k % 2 ? 18 : -18), y + 26); ctx.lineTo(x + (k % 2 ? 12 : -24), y + 44); ctx.stroke(); }
  });
  // orange-yellow fire tongue for the VS intro
  canvasTexture(scene, 'fx-fire', 32, 64, ctx => {
    const g = ctx.createRadialGradient(16, 46, 2, 16, 40, 30);
    g.addColorStop(0, 'rgba(255,250,200,.95)'); g.addColorStop(0.35, 'rgba(255,190,60,.85)'); g.addColorStop(0.75, 'rgba(255,90,20,.5)'); g.addColorStop(1, 'rgba(200,30,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(16, 0); ctx.bezierCurveTo(30, 22, 32, 40, 28, 52); ctx.quadraticCurveTo(16, 66, 4, 52); ctx.bezierCurveTo(0, 40, 2, 22, 16, 0); ctx.fill();
  });
  canvasTexture(scene, 'fx-bullet', 14, 6, ctx => {
    ctx.fillStyle = '#d4a017'; ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(1, 1); ctx.lineTo(8, 1); ctx.quadraticCurveTo(13, 3, 8, 5); ctx.lineTo(1, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
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
    this.seen = new WeakSet(); this.texts = []; this.prev = [{}, {}]; this.trapT = [0, 0]; this.chargeUps = [];
    this.focus = 0; this.focusAt = null; this.vsT = -1;
  }

  create() {
    const cam = this.cameras.main;
    cam.setOrigin(0, 0).setBackgroundColor('#000');
    // HUD gets its own camera so the super close-up zooms the world only
    this.hudCam = this.cameras.add(0, 0, this.scale.width, this.scale.height).setOrigin(0, 0);
    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);
    this.events.once('shutdown', () => { this.scale.off('resize', this.fitCamera, this); this.sound.stopByKey?.('charge'); this.sound.stopByKey?.('chargeUp'); });
    this.physics.world.setBounds(0, -400, WORLD_W, VIEW_H + 800);
    this.prepare().then(() => { if (this.sys.isActive() || this.sys.isPaused()) { this.build(); this.ready = true; this.onLoaded?.(); } });
  }

  fitCamera() {
    const z = this.scale.width / VIEW_W;
    this.baseZoom = z;
    this.cameras.main.setSize(this.scale.width, this.scale.height).setZoom(z);
    this.hudCam?.setSize(this.scale.width, this.scale.height).setZoom(z);
    for (const t of this.texts) t.setResolution(Math.min(3, z));
  }

  // Each object is drawn by exactly one camera: HUD objects (scrollFactor 0) by hudCam, the rest by main.
  sortCameras() {
    for (const o of this.children.list) {
      if (o.camSorted) continue;
      o.camSorted = true;
      if (o.scrollFactorX === 0) this.cameras.main.ignore(o); else this.hudCam.ignore(o);
    }
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
    const [far, ground, trap, plats, bull, por0, por1, ...chars] = await Promise.all([
      sheet(base + m.far, mapScale), sheet(base + m.ground, mapScale), sheet(base + m.trap.sheet, mapScale), sheet(base + m.platforms.sheet, mapScale),
      sheet(base + t.extras.bull.sheet, charScale),
      // portraits for the VS intro (drawn ~110px tall on the 360px view)
      ...this.model.settings.weapons.map(w => sheet(base + t.characters[w].portrait, clamp(px * 110 / 128, 1, 3))),
      ...this.model.settings.weapons.map(w => Promise.all(t.characters[w].sheets.map(p => sheet(base + p, charScale))))
    ]);
    // supply drop carrier + item for this map: frames c0/c1 (carrying, flapping), k0 (carrier), it (item)
    const sx = t.extras.supply, supply = await sheet(base + sx.sheets[this.model.mapId], charScale);
    ['c0', 'c1', 'k0', 'it'].forEach((n, k) => { if (!supply.tex.has(n)) supply.tex.add(n, 0, k * sx.cell[0] * supply.k, 0, sx.cell[0] * supply.k, sx.cell[1] * supply.k); });
    this.supplySheet = supply;
    this.portraits = [por0, por1];
    const bc = t.extras.bull.cell;
    for (let fr = 0; fr < t.extras.bull.frames; fr++) if (!bull.tex.has(`b${fr}`)) bull.tex.add(`b${fr}`, 0, fr * bc[0] * bull.k, 0, bc[0] * bull.k, bc[1] * bull.k);
    const tw = m.trap.cell[0], th = m.trap.cell[1];
    for (let fr = 0; fr < m.trap.frames; fr++) if (!trap.tex.has(`f${fr}`)) trap.tex.add(`f${fr}`, 0, fr * tw * trap.k, 0, tw * trap.k, th * trap.k);
    m.platforms.widths.forEach((w, i) => { if (!plats.tex.has(`w${w}`)) plats.tex.add(`w${w}`, 0, 0, i * m.platforms.cellH * plats.k, (w + 8) * plats.k, m.platforms.cellH * plats.k); });
    // character frames live on several sheet pages; remember which page holds each frame
    this.model.settings.weapons.forEach((w, i) => {
      const c = t.characters[w], pages = chars[i];
      pages.pageOf = {};
      for (const [name, idx] of Object.entries(c.frames)) {
        const s = pages[Math.floor(idx / c.perPage)], local = idx % c.perPage;
        pages.pageOf[name] = s.key;
        if (s.tex.has(name)) continue;
        const col = local % c.cols, row = Math.floor(local / c.cols);
        s.tex.add(name, 0, col * c.cell[0] * s.k, row * c.cell[1] * s.k, c.cell[0] * s.k, c.cell[1] * s.k);
      }
    });
    this.sheets = { far, ground, trap, plats, bull, chars };
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

    this.arrows = []; this.bombs = []; this.bullets = [];
    // the cowboy's whip and lasso, drawn as live curves
    this.lash = this.add.graphics().setDepth(12);
    this.whirl = this.add.graphics().setDepth(13);
    // electric sparks crackling around the thunder whirlwind
    this.zap = this.add.particles(0, 0, 'fx-dot', { emitting: false, lifespan: { min: 120, max: 260 }, speed: { min: 80, max: 260 }, scale: { start: 0.3, end: 0 },
      blendMode: 'ADD', tint: [0xffffff, 0x9fdcff, 0xfff36a] }).setDepth(14);
    this.fuse = this.add.particles(0, 0, 'fx-dot', { emitting: false, lifespan: 260, speed: { min: 20, max: 70 }, scale: { start: 0.25, end: 0 }, blendMode: 'ADD', tint: [0xffe27a, 0xff8a1a] }).setDepth(21);
    const bx = theme.extras.bull;
    this.bullSprite = this.add.sprite(0, 0, sh.bull.key, 'b0').setOrigin(bx.origin[0] / bx.cell[0], bx.origin[1] / bx.cell[1]).setDepth(12).setVisible(false);
    this.fighters = this.model.settings.weapons.map((w, i) => {
      const c = theme.characters[w], pages = sh.chars[i], s = pages[0];
      const mk = () => this.add.sprite(0, 0, pages.pageOf.idle0, 'idle0').setOrigin(c.origin[0] / c.cell[0], c.origin[1] / c.cell[1]);
      const ghosts = [0, 1, 2].map(() => mk().setVisible(false).setDepth(9).setTint(0xffd27a).setTintMode(Phaser.TintModes.ADD));
      const aura = this.add.image(0, 0, 'fx-blueglow').setBlendMode(Phaser.BlendModes.ADD).setDepth(9).setVisible(false);
      // charged attack: yellow energy gathers onto the fighter, arriving exactly when the charge completes
      const gather = this.add.image(0, 0, 'fx-aura').setBlendMode(Phaser.BlendModes.ADD).setDepth(9).setVisible(false);
      const charge = this.add.particles(0, 0, 'fx-dot', {
        emitting: false, lifespan: 300, scale: { start: 0.4, end: 0.08 }, alpha: { start: 0.2, end: 1 }, blendMode: 'ADD', tint: [0xffe27a, 0xfff6c0, 0xffc83a],
        emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 64), quantity: 28 },
        emitCallback: p => { const L = Math.max(0.04, this.gatherLeft || 0.3); p.life = p.lifeCurrent = L * 1000; p.velocityX = -p.x / L; p.velocityY = -p.y / L; }
      }).setDepth(11);
      const sprite = mk().setDepth(10);
      let glow = null;
      try { sprite.enableFilters(); glow = sprite.filters.internal.addGlow(0x5aaeff, 6, 0, 1, false, 10, 12); glow.active = false; } catch { glow = null; }
      return { c, k: s.k, pageOf: pages.pageOf, sprite, ghosts, aura, glow, gather, charge };
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
        blendMode: ADD_TRAPS.has(this.model.mapId) ? 'ADD' : 'NORMAL', tint: this.mapFx.trap, bounce: 0.3, bounds: groundBounds,
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
    // super focus: the stage dims behind the fighters and cinema bars slide in
    this.dim = this.add.rectangle(-200, -400, WORLD_W + 400, VIEW_H + 800, 0x05030a).setOrigin(0).setDepth(8.9).setAlpha(0);
    this.bars = [0, 1].map(i => this.add.rectangle(0, i ? VIEW_H : 0, VIEW_W, 0, 0x000000).setOrigin(0, i).setScrollFactor(0).setDepth(950));
    this.buildVs();
    this.fitCamera();
  }

  // Round intro: both portraits slide in and a burning, thunderstruck "VS" slams down between them.
  buildVs() {
    const H = (o, d) => o.setScrollFactor(0).setDepth(d).setVisible(false);
    const g = this.add.graphics();
    const port = this.portraits.map(p => H(this.add.image(0, 0, p.key).setScale(110 / 128 / p.k), 1003));
    const fires = Array.from({ length: 10 }, () => H(this.add.image(0, 0, 'fx-fire').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD), 1004));
    const bolts = Array.from({ length: 3 }, () => H(this.add.image(0, 0, 'fx-bolt').setOrigin(0.5, 0.5).setBlendMode(Phaser.BlendModes.ADD), 1004));
    const T = (size, color, stroke, th) => { const t = H(this.add.text(0, 0, '', { fontFamily: FONT, fontSize: size, fontStyle: '900', color, stroke, strokeThickness: th }).setOrigin(0.5), 1005); this.texts.push(t); return t; };
    const names = [0, 1].map(() => T('15px', '#ffffff', '#000', 4));
    const vs = T('64px', '#ffe35a', '#7a1a00', 9);
    vs.setText('VS');
    try { vs.setShadow(0, 0, '#ff7a1a', 18, true, true); } catch { /* no shadow support */ }
    this.vs = { g: H(g, 1002), port, fires, bolts, names, text: vs };
  }

  drawVs() {
    const g = this.model, v = this.vs, t = g.phaseT;
    const on = g.phase === 'intro' && t < INTRO_TIME * 0.65;
    const all = [v.g, ...v.port, ...v.fires, ...v.bolts, ...v.names, v.text];
    if (!on) { if (v.g.visible) all.forEach(o => o.setVisible(false)); return; }
    all.forEach(o => o.setVisible(true));
    const end = INTRO_TIME * 0.65, out = clamp((end - t) / 0.18, 0, 1);          // fade out before FIGHT!
    const slide = ease(clamp(t / 0.25, 0, 1)), cy = VIEW_H * 0.57, cx = VIEW_W / 2;
    const px = [cx - 165, cx + 165];
    v.g.clear();
    // a dark band behind everything, slanted red/blue halves
    v.g.fillStyle(0x000000, 0.55 * out).fillRect(0, cy - 78, VIEW_W, 156);
    v.g.fillStyle(0x2a5aff, 0.35 * out).fillPoints([{ x: 0, y: cy - 78 }, { x: cx + 30, y: cy - 78 }, { x: cx - 30, y: cy + 78 }, { x: 0, y: cy + 78 }], true);
    v.g.fillStyle(0xff3a2a, 0.35 * out).fillPoints([{ x: cx + 30, y: cy - 78 }, { x: VIEW_W, y: cy - 78 }, { x: VIEW_W, y: cy + 78 }, { x: cx - 30, y: cy + 78 }], true);
    g.fighters.forEach((f, i) => {
      const x = px[i] + (i ? 1 : -1) * (1 - slide) * 260, ch = this.theme.characters[f.weapon];
      const col = Phaser.Display.Color.HexStringToColor(ch.color).color;
      v.g.lineStyle(4, col, out).strokeRect(x - 57, cy - 66, 114, 114);
      v.g.lineStyle(1.5, 0xffffff, out).strokeRect(x - 60, cy - 69, 120, 120);
      v.port[i].setPosition(x, cy - 9).setAlpha(out).setFlipX(i === 1);
      v.names[i].setText(ch.name).setPosition(x, cy + 62).setAlpha(out);
    });
    // VS slams in (big → normal) at 0.2s, then trembles with fire and lightning
    const k = clamp((t - 0.18) / 0.12, 0, 1), shake = k >= 1 ? (Math.random() - 0.5) * 3 : 0;
    v.text.setScale(k > 0 ? 2.6 - 1.6 * ease(k) : 0.01).setAlpha(k * out).setPosition(cx + shake, cy + shake);
    v.fires.forEach((fi, n) => {
      const a = n / v.fires.length * Math.PI * 2 + t * 3, r = 34 + 6 * Math.sin(t * 20 + n);
      fi.setPosition(cx + Math.cos(a) * r * 1.2, cy + 26 + Math.sin(a) * r * 0.35).setScale(0.8 + Math.random() * 0.5, 1 + Math.random() * 0.9).setAlpha(k * out * (0.6 + Math.random() * 0.4));
    });
    v.bolts.forEach((b, n) => {
      const flick = k > 0 && Math.random() < 0.45;
      b.setPosition(cx + (n - 1) * 46 + (Math.random() - 0.5) * 20, cy - 4).setRotation((n - 1) * 0.5 + (Math.random() - 0.5) * 0.4)
        .setScale(0.5 + Math.random() * 0.2, 0.55).setAlpha(flick ? out : 0);
    });
    if (k > 0 && this.vsT !== g.round) { this.vsT = g.round; this.sfx('vs', { volume: 0.7 }); this.cameras.main.shake(160, 0.008); }
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
      // the whirlwind kick lands: a thunderbolt strikes the target
      if (e.type === 'hit' && e.who !== undefined && g.fighters[1 - e.who]?.super?.def.spin) {
        this.bolt(e.x, e.y + 40, 1.4);
        this.bolt(e.x - 26, e.y + 40, 0.9); this.bolt(e.x + 26, e.y + 40, 0.9);
        cam.flash(220, 200, 230, 255);
        this.zap.explode(40, e.x, e.y);
        this.sfx('boom', { volume: 0.7, rate: 1.4 });
      }
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
      } else if (e.type === 'armor') {
        // heavy-attack armor: damage lands, the fighter doesn't budge (the sword's hold takes none)
        this.fx.spark.explode(8, e.x, e.y);
        this.ring(e.x, e.y, e.dmg ? 0xffa040 : 0xffffff, 1.2);
        if (e.dmg) this.popText(`-${e.dmg}`, e.x, e.y - 18, '#ffb347', 16);
        this.popText(e.dmg ? '버팀!' : '무적 버팀!', e.x, e.y - 44, '#ffd27a', 13);
        cam.shake(90, 0.004);
        this.sfx('guard', { volume: 0.6, rate: 0.7 });
      } else if (e.type === 'miss') {
        this.popText('회피!', e.x, e.y - 18, '#9ef0ff', 16);
        this.sfx('miss', { volume: 0.7 });
      } else if (e.type === 'break') {
        // charged attack smashed through the guard
        this.fx.guard.explode(18, e.x, e.y);
        this.flashStar(e.x, e.y, 1.1, 0x9fdcff);
        this.ring(e.x, e.y, 0xffffff, 1.6);
        this.popText(`-${e.dmg}`, e.x, e.y - 18, '#bfe6ff', 16);
        this.popText('가드 브레이크!', e.x, e.y - 46, '#ff8a5a', 15);
        cam.shake(160, 0.009);
        this.sfx('hitHeavy', { volume: 0.7, rate: 1.2 });
        this.sfx('guard', { volume: 0.6, rate: 0.6 });
      } else if (e.type === 'parry') {
        // perfect parry: a bright flash, a golden double ring, the attacker locks up
        this.flashStar(e.x, e.y, 1.6, 0xffffff);
        this.flashStar(e.x, e.y, 1.1, 0xffe35a);
        this.ring(e.x, e.y, 0xffe35a, 1.4); this.time.delayedCall(70, () => this.ring(e.x, e.y, 0xffffff, 2.2));
        this.fx.guard.explode(22, e.x, e.y);
        this.popText('패링!', e.x, e.y - 30, '#fff36a', 22);
        cam.flash(90, 255, 250, 210);
        cam.shake(90, 0.004);
        this.sfx('parry', { volume: 0.85 });
      } else if (e.type === 'muzzle') {
        this.flashStar(e.x, e.y, 0.6, 0xffd27a);
        this.fx.smoke.explode(4, e.x + e.dir * 6, e.y);
        this.fx.spark.explode(6, e.x, e.y);
        cam.shake(80, 0.004);
        this.sfx('gun', { volume: 0.8 });
      } else if (e.type === 'bulletDrop') {
        this.fx.dust.explode(3, e.x, e.y);
      } else if (e.type === 'lasso') {
        this.ring(e.x, e.y, 0xc9a46a, 1.4);
        this.popText('올가미!', e.x, e.y - 40, '#ffd27a', 18);
        this.sfx('crack', { volume: 0.8, rate: 0.8 });
      } else if (e.type === 'lassoMiss') {
        this.sfx('crack', { volume: 0.5, rate: 0.7 });
      } else if (e.type === 'rush') {
        // Genghis spurs the horse: a burst of dust behind and a thud of hooves
        this.fx.dust.explode(12, e.x - e.dir * 30, e.y);
        this.sfx('land', { volume: 0.6, rate: 0.7 });
        cam.shake(120, 0.004);
      } else if (e.type === 'reel') {
        this.fx.dust.explode(6, e.x, e.y);
        this.sfx('crack', { volume: 0.6, rate: 1.2 });
      } else if (e.type === 'bite' || e.type === 'pinch') {
        // the crocodile lunges out of the swamp / the snow crab climbs out of the tank
        const t = g.layout.traps.find(tr => e.x > tr.x && e.x < tr.x + tr.w), tx = t ? t.x + t.w / 2 : e.x;
        const bite = e.type === 'bite';
        this.fx.trap.explode(14, tx, GROUND_Y - 6);
        this.flashStar(e.x, GROUND_Y - 30, 0.7, bite ? 0xffffff : 0xffb07a);
        this.popText(bite ? '콱!' : '집게 꼬집!', tx, GROUND_Y - (bite ? 80 : 160), bite ? '#c8ff8a' : '#ff8a5a', 18);
        cam.shake(140, 0.005);
        this.sfx(bite ? 'chomp' : 'snip', { volume: 0.85 });
      } else if (e.type === 'scold') {
        // the library guard yells; sound rings burst from his spot
        const t = g.layout.traps.find(tr => e.x > tr.x && e.x < tr.x + tr.w), gx = t ? t.x + t.w / 2 : e.x;
        for (let k = 0; k < 3; k++) this.time.delayedCall(k * 110, () => this.ring(gx + 8, GROUND_Y - 90, 0xffffff, 1.2 + k * 0.5));
        this.popText('쉿! 뛰지 마!', gx, GROUND_Y - 150, '#ff5a3c', 16);
        cam.shake(160, 0.004);
        this.sfx('shout', { volume: 0.8 });
      } else if (e.type === 'explosion') {
        cam.flash(220, 255, 220, 160);
        cam.shake(600, 0.022);
        this.fx.spark.explode(46, e.x, e.y - 30);
        this.fx.smoke.explode(28, e.x, e.y - 40);
        this.fx.dust.explode(24, e.x, e.y);
        for (const k of [1, 1.8, 2.6]) this.ring(e.x, e.y - 30, 0xffb347, k * e.r / 60);
        this.flashStar(e.x, e.y - 40, 3, 0xfff0b0);
        this.spawnDebris(e.x, e.y - 6, 14, 0);
        this.pulseVignette(0.6);
        this.sfx('boom');
      } else if (e.type === 'arrowStuck') {
        this.fx.dust.explode(3, e.x, e.y);
        const a = this.add.image(e.x, e.y - 4, 'fx-arrow').setRotation(e.dir > 0 ? 0.6 : Math.PI - 0.6).setDepth(6);
        this.tweens.add({ targets: a, alpha: 0, delay: 500, duration: 300, onComplete: () => a.destroy() });
      } else if (e.type === 'supply') {
        this.sfx('select', { volume: 0.35, rate: 0.8 });
      } else if (e.type === 'landed') {
        // the carrier lets go and flies off; the item stays and blinks
        const sx = this.theme.extras.supply, k = this.supplySheet.k;
        const c = this.add.image(e.x, e.y, this.supplySheet.key, 'k0').setOrigin(sx.origin[0] / sx.cell[0], sx.origin[1] / sx.cell[1]).setScale(1 / k).setDepth(15);
        this.tweens.add({ targets: c, x: e.x + 90, y: e.y - 160, alpha: 0, duration: 1000, ease: 'Quad.easeIn', onComplete: () => c.destroy() });
        this.fx.dust.explode(4, e.x, e.y);
      } else if (e.type === 'heal') {
        this.popText(`+${e.amount}`, e.x, e.y - 20, '#7dff8a', e.big ? 22 : 18);
        this.ring(e.x, e.y, 0x7dff8a, e.big ? 1.6 : 1.1);
        this.flashStar(e.x, e.y, e.big ? 1.1 : 0.7, 0xb8ffc0);
        this.sfx('heal', { volume: 0.7 });
      } else if (e.type === 'bull') {
        cam.shake(700, 0.006);
        this.sfx('quake', { volume: 0.8 });
      } else if (e.type === 'trade') {
        this.popText('동시타격!', e.x, e.y, '#ff8a5a', 18);
        this.ring(e.x, e.y + 40, 0xffffff, 1.6);
        this.sfx('trade');
      } else if (e.type === 'super' && g.fighters[e.who].super?.def.spin) {
        // thunder whirlwind: bolts rain around the kicker as it winds up
        const f = g.fighters[e.who];
        cam.flash(160, 190, 225, 255);
        for (let k = 0; k < 5; k++) this.time.delayedCall(k * 70, () => this.bolt(f.x + (Math.random() - 0.5) * 120, f.y, 0.7 + Math.random() * 0.4));
        this.ring(f.x, f.y - height(f) / 2, 0x9fdcff, 2.2);
        this.pulseVignette(0.5);
        this.sfx('super');
      } else if (e.type === 'super') {
        const f = g.fighters[e.who];
        cam.flash(180, 255, 240, 200);
        this.slowT = Math.max(this.slowT, 0.22); // a beat of slow motion as the close-up lands
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
      if (f.attack && f.attack !== p.attack && !(f.attack.kind === 'charged' && (f.stats.gun || f.stats.bow))) {
        if (f.weapon === 'whip') this.time.delayedCall(Math.max(0, attackTiming(f).startup / (f.attack.speed ?? 1)) * 1000, () => this.sfx('crack', { volume: 0.6, rate: rnd(0.95, 1.1) }));
        else this.sfx(f.stats.power >= 18 ? 'swingHeavy' : 'swing', { volume: 0.55, rate: rnd(0.92, 1.08) });
      }
      if (p.onGround && !f.onGround && f.vy < 0) { this.fx.dust.explode(5, f.x, f.y); this.sfx('jump', { volume: 0.4 }); }
      if (f.doubled && !p.doubled) { this.ring(f.x, f.y, 0xffffff, 0.8); this.sfx('jump', { volume: 0.4, rate: 1.3 }); }
      if (f.attack?.kind === 'dive' && f.attack.landed !== undefined && p.diveLanded === undefined && p.attack === f.attack) {
        this.fx.dust.explode(14, f.x, f.y);
        this.spawnDebris(f.x + f.facing * 10, f.y - 4, 4, f.facing);
        this.cameras.main.shake(120, 0.006);
        this.sfx('land', { volume: 0.7, rate: 0.8 });
      }
      if (p.onGround === false && f.onGround) {
        this.fx.dust.explode(p.vy > 600 ? 10 : 5, f.x, f.y);
        this.sfx('land', { volume: 0.45 });
        if (p.vy > 650) this.cameras.main.shake(80, 0.003);
      }
      if (f.charge > 0 && !(p.charge > 0)) this.chargeSound = this.sound.add('charge'), this.game.sound.locked || this.chargeSound.play({ volume: 0.5 });
      if (!(f.charge > 0) && p.charge > 0) { this.chargeSound?.stop(); this.chargeSound?.destroy(); this.chargeSound = null; }
      // charged attack: the old rising charge hum, squeezed to end exactly as the charge completes
      const charging = f.attack?.kind === 'charged' && attackPhase(f) === 'startup';
      if (charging && !p.charging) {
        this.stopChargeUp(i);
        const total = attackTiming(f).startup / (f.attack.speed ?? 1);
        if (!this.game.sound.locked) { const snd = this.sound.add('chargeUp'); snd.play({ volume: 0.55, rate: CHARGE_TIME / total }); this.chargeUps[i] = snd; }
      }
      if (!charging && p.charging) {
        if (f.attack?.kind === 'charged') {
          // charge complete: a burst of light as the gathered energy is released
          const h = height(f);
          this.ring(f.x, f.y - h / 2, 0xffe27a, 1.5); this.flashStar(f.x, f.y - h / 2, 0.8, 0xfff3b0);
        } else this.stopChargeUp(i);   // let go early
      }
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
      // stag beetle air dash: a streak of afterimage dust
      if (f.blinked) this.sfx('miss', { volume: 0.6, rate: 1.8 });
      if (f.airDash && !p.airDash) { this.ring(f.x, f.y - 40, 0xffd27a, 0.9); this.sfx('miss', { volume: 0.5, rate: 1.4 }); }
      if (f.attack?.fired && !p.fired) this.sfx('bow', { volume: 0.7 });
      if (f.super?.def.spin && !p.spin) this.sfx('whirl', { volume: 0.7 });

      // super dash: dust trail from the feet
      if (f.super && f.onGround && Math.abs(f.vx) > 150 && Math.random() < 0.5) this.fx.dust.explode(2, f.x - f.facing * 10, f.y);
      Object.assign(p, { charging, fired: f.attack?.fired, spin: !!f.super?.def.spin, airDash: f.airDash, attack: f.attack, onGround: f.onGround, vy: f.vy, charge: f.charge, ko: f.ko, doubled: f.doubled, diveLanded: f.attack?.landed });
    });

    if (g.phase !== this.lastPhase) {
      if (g.phase === 'intro') this.sfx('round', { volume: 0.6 });
      if (g.phase === 'fight') this.sfx('fight', { volume: 0.6 });
      if (g.phase === 'matchEnd') this.sfx('win', { volume: 0.6 });
      this.lastPhase = g.phase;
    }
  }

  stopChargeUp(i) {
    this.chargeUps ??= [];
    const s = this.chargeUps[i];
    if (s) { s.stop(); s.destroy(); this.chargeUps[i] = null; }
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
  sync(dt) {
    const g = this.model, cam = this.cameras.main;
    this.updateFocus(dt);
    // 8-frame traps: loops run at 12 fps; reacting traps idle on frames 0-3 and shake on 4-7
    const tf = Math.floor(g.t * 12) % 8;
    const react = g.map.trapReact;
    (this.traps || []).forEach((s, k) => {
      const t = g.layout.traps[k];
      // the library guard only turns to yell while someone stands on his yellow floor
      const busy = react && g.fighters.some(f => f.inTrap && f.x > t.x && f.x < t.x + t.w);
      s.setFrame(`f${react ? (busy ? 4 + Math.floor(g.t * 16) % 4 : Math.floor(g.t * 4) % 4) : tf}`);
    });

    this.shadows.clear();
    g.fighters.forEach((f, i) => {
      const y = this.surfaceBelow(f), k = clamp(1 - (y - f.y) / 220, 0.35, 1), w = 20 * halfW(f) / BODY_HALF_W;
      this.shadows.fillStyle(0x000000, 0.35).fillEllipse(f.x, y + 1, w * 2 * k, 10 * k);
      // turnScale < 0 shows the back (taekwondo back kick); passing through 0 reads as spinning around
      const v = this.fighters[i], c = v.c, sx = f.facing * turnScale(f) * c.scale / v.k, sy = c.scale / v.k;
      const frame = frameName(f), show = (spr) => spr.texture.key === v.pageOf[frame] ? spr.setFrame(frame) : spr.setTexture(v.pageOf[frame], frame);
      show(v.sprite).setScale(sx, sy).setDepth(f.attack || f.super ? 11 : 10);
      const ox = c.origin[0] / c.cell[0], oy = c.origin[1] / c.cell[1];
      if (f.ko) {
        const r = Math.min(1, (f.t - f.koAt) * 4);
        v.sprite.setOrigin(ox, oy).setPosition(f.x - f.facing * 6, f.y - 10).setRotation(-f.facing * Math.PI / 2 * r);
      } else if (frame === 'flip') {
        // somersault around the body center
        const h = height(f), r = f.super ? f.super.t * 3 : ease(Math.min(1, f.flipT / FLIP_TIME));
        v.sprite.setOrigin(ox, (c.origin[1] - h / 2 / c.scale) / c.cell[1]).setPosition(f.x, f.y - h / 2).setRotation(f.facing * Math.PI * 2 * r);
      } else v.sprite.setOrigin(ox, oy).setPosition(f.x, f.y).setRotation(0);
      // hit flash: solid white for a moment, then blink
      if (f.hitFlash > 0.14) v.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL).setAlpha(1);
      else if (f.frozen > 0) v.sprite.setTint(0x8fb8ff).setTintMode(Phaser.TintModes.MULTIPLY).setAlpha(1);   // parried: locked up
      else {
        v.sprite.clearTint?.(); v.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
        v.sprite.setAlpha(f.hitFlash > 0 && Math.floor(f.hitFlash * 30) % 2 ? 0.45 : f.inTrap && Math.floor(g.t * 12) % 2 ? 0.6 : 1);
      }
      if (v.glow) v.glow.active = !!f.super;
      // dash afterimages
      const dashing = (f.rush || f.super || f.airDash?.t < 0.3) && Math.abs(f.vx) > 100;
      v.ghosts.forEach((gh, n) => {
        gh.setVisible(dashing);
        if (dashing) show(gh).setScale(sx, sy).setPosition(f.x - f.vx * 0.025 * (n + 1), f.y).setAlpha(0.32 - n * 0.09);
      });
      // aura while the gauge is full, charging or in a super
      const full = f.meter >= SUPER_MAX && !f.ko;
      // super: blue flames that grow while the attack+guard hold charges, burn big during the super
      const fire = f.super ? Math.min(1, (f.super.def.time - f.super.t) * 3) : f.charge > 0 ? 0.2 + 0.8 * f.charge / SUPER_HOLD : full ? 0.12 : 0;
      if (fire > 0) {
        v.aura.setVisible(true).setPosition(f.x, f.y - height(f) * 0.45).setScale(height(f) * (0.8 + 0.8 * fire) / 128).setAlpha(0.2 + 0.3 * fire);
        if (Math.random() < 0.2 + 0.45 * fire) this.flame(f, fire);
      } else v.aura.setVisible(false);
      // charged attack: yellow energy converging on the body; the particles' flight time is the time
      // the charge still needs, so they all arrive as it completes
      const left = f.attack?.kind === 'charged' && attackPhase(f) === 'startup' ? chargeLeft(f) : 0;
      if (left > 0) {
        const total = attackTiming(f).startup / (f.attack.speed ?? 1), u = 1 - left / total, h = height(f);
        v.gather.setVisible(true).setPosition(f.x, f.y - h / 2).setScale(h * (0.7 + 0.9 * u) / 128).setAlpha(0.25 + 0.6 * u);
        v.charge.setPosition(f.x, f.y - h / 2);
        this.gatherLeft = left;
        if (left > 0.03) v.charge.emitParticle(2);
      } else v.gather.setVisible(false);
    });
    this.syncProjectiles(g);
    this.syncSupply(g);
    this.drawLash(g);
    this.drawWhirl(g);
    const bull = g.bull, bs = this.bullSprite, bx = this.theme.extras.bull;
    bs.setVisible(!!bull);
    if (bull) {
      bs.setPosition(bull.x, GROUND_Y).setScale(bull.dir * bx.scale / this.sheets.bull.k, bx.scale / this.sheets.bull.k).setFrame(`b${Math.floor(bull.t * 14) % bx.frames}`);
      if (Math.random() < 0.6) this.fx.dust.explode(2, bull.x - bull.dir * 50, GROUND_Y);
    }
    this.drawHud();
    this.sortCameras();
  }

  // Supply drops: a flapping carrier while falling; once down, the item blinks out its last seconds.
  // Big drops (x2 mode) are larger and glow.
  syncSupply(g) {
    const sx = this.theme.extras.supply, sh = this.supplySheet;
    this.supplyPool ??= [];
    while (this.supplyPool.length < g.items.length) {
      const glow = this.add.image(0, 0, 'fx-aura').setBlendMode(Phaser.BlendModes.ADD).setDepth(13);
      const spr = this.add.sprite(0, 0, sh.key, 'c0').setOrigin(sx.origin[0] / sx.cell[0], sx.origin[1] / sx.cell[1]).setDepth(14);
      this.supplyPool.push({ spr, glow });
    }
    this.supplyPool.forEach(({ spr, glow }, k) => {
      const it = g.items[k];
      spr.setVisible(!!it); glow.setVisible(!!it?.big);
      if (!it) return;
      const s = (it.big ? 1.25 : 1) / sh.k, falling = it.state === 'fall';
      spr.setFrame(falling ? `c${Math.floor(g.t * 6) % 2}` : 'it').setScale(s).setPosition(it.x, it.y + (falling ? Math.sin(g.t * 3 + k) * 2 : 0))
        .setAlpha(falling || Math.floor(it.t * 8) % 2 === 0 ? 1 : 0.25);
      if (it.big) glow.setPosition(it.x, it.y - 14).setScale(0.45 + 0.08 * Math.sin(g.t * 6)).setAlpha(spr.alpha * 0.8);
    });
  }

  syncProjectiles(g) {
    const arrows = g.projectiles.filter(p => p.type === 'arrow'), bombs = g.projectiles.filter(p => p.type === 'bomb');
    const bullets = g.projectiles.filter(p => p.type === 'bullet');
    while (this.bullets.length < bullets.length) this.bullets.push(this.add.image(0, 0, 'fx-bullet').setDepth(14));
    this.bullets.forEach((img, k) => {
      const p = bullets[k];
      img.setVisible(!!p);
      if (!p) return;
      img.setPosition(p.x, p.y).setFlipX(p.dir < 0).setRotation(p.dropping ? p.dir * Math.min(1.2, p.vy / 900) : 0);
      if (!p.dropping) this.fx.spark.emitParticle(1, p.x - p.dir * 8, p.y);
    });
    while (this.arrows.length < arrows.length) this.arrows.push(this.add.image(0, 0, 'fx-arrow').setDepth(14));
    while (this.bombs.length < bombs.length) this.bombs.push(this.add.image(0, 0, 'fx-bomb').setDepth(14).setScale(0.8));
    this.arrows.forEach((img, k) => {
      const p = arrows[k];
      img.setVisible(!!p);
      if (!p) return;
      // nose follows the arc: slope of h(u) over the horizontal run
      const dh = (2 * p.a * p.u + p.b) / p.range;
      img.setPosition(p.x, p.y).setRotation(p.dir > 0 ? -Math.atan(dh) : Math.PI + Math.atan(dh));
    });
    this.bombs.forEach((img, k) => {
      const p = bombs[k];
      img.setVisible(!!p);
      if (!p) return;
      img.setPosition(p.x, p.y).setRotation(p.t * 6);
      this.fuse.emitParticle(1, p.x + 4, p.y - 14);
    });
  }

  // Thunder whirlwind around a taekwondo fighter during the super.
  // One rising tongue of blue flame around the fighter; size follows the charge.
  flame(f, k) {
    const h = height(f), hw = halfW(f) + 6 + 14 * k;
    // mostly behind the body so the fighter stays readable; a few thin tongues lick in front
    const front = Math.random() < 0.2;
    const img = this.add.image(f.x + (Math.random() * 2 - 1) * hw, f.y + 2, 'fx-flame').setOrigin(0.5, 1)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(front ? 11 : 9).setAlpha(front ? 0.45 : 0.8)
      .setScale((0.35 + 0.7 * k) * (0.7 + Math.random() * 0.5) * (front ? 0.6 : 1), (0.5 + 1.1 * k) * (0.7 + Math.random() * 0.6));
    this.tweens.add({ targets: img, y: img.y - h * (0.3 + 0.5 * k), scaleX: img.scaleX * 0.3, alpha: 0, duration: 380 + 260 * k, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
  }

  // A lightning bolt striking down onto (x, groundY).
  bolt(x, y, s = 1) {
    const b = this.add.image(x, y, 'fx-bolt').setOrigin(0.5, 1).setScale(s * 0.9, s).setBlendMode(Phaser.BlendModes.ADD).setDepth(15)
      .setFlipX(Math.random() < 0.5);
    this.tweens.add({ targets: b, alpha: { from: 1, to: 0 }, duration: 260, ease: 'Stepped', easeParams: [4], onComplete: () => b.destroy() });
    this.zap.explode(10, x, y - 4);
    this.fx.dust.explode(4, x, y);
  }

  // The cowboy's bullwhip: a live curve from the hand. It arcs back over the head while winding up,
  // cracks out to its full reach while active and reels back in during recovery. The lasso and the
  // reel-back line use the same rope.
  drawLash(g) {
    const L = this.lash;
    L.clear();
    for (const f of g.fighters) {
      if (f.weapon !== 'whip' || f.ko) continue;
      const h = height(f), hx = f.x + f.facing * (halfW(f) + 4), hy = f.y - h * 0.62;
      const rope = (pts, w = 1) => {
        for (const [wd, col] of [[3.6 * w, 0x18131f], [1.8 * w, 0x8a5a2e]]) {
          L.lineStyle(wd, col, 1).beginPath(); L.moveTo(pts[0][0], pts[0][1]);
          for (const [x, y] of pts.slice(1)) L.lineTo(x, y);
          L.strokePath();
        }
      };
      const curve = (x0, y0, x1, y1, bend, n = 14) => Array.from({ length: n + 1 }, (_, i) => {
        const u = i / n, mx = (x0 + x1) / 2, my = (y0 + y1) / 2 - bend;
        return [(1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * mx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * my + u * u * y1];
      });
      if (f.reel) {
        // hooked into the ground behind and reeling in
        const hook = f.reel.from + f.reel.dir * (REEL_DIST * h + 24);
        rope(curve(f.x + f.reel.dir * 6, hy, hook, f.y, -6));
        L.fillStyle(0x8a9098).fillCircle(hook, f.y - 2, 3);
        continue;
      }
      const sp = f.super;
      if (sp?.def.lasso) {
        const op = g.fighters.find(o => o !== f), las = sp.def.lasso, t = sp.t;
        if (sp.caught) {
          const lashing = sp.def.hits.some(hh => t >= hh.at - 0.04 && t < hh.at + hh.len);
          if (t < las.at + las.pull + 0.1) rope(curve(hx, hy, op.x, op.y - height(op) * 0.55, 10));
          else if (lashing) rope(curve(hx, hy, op.x + (Math.random() - 0.5) * 20, op.y - height(op) * (0.3 + Math.random() * 0.5), 30 + Math.random() * 40));
          else rope(curve(hx, hy, hx - f.facing * 30, hy - 50, 20));
        } else if (t >= las.at - 0.1 && t < las.at + 0.3) {
          // thrown loop sails out to the lasso radius and comes back empty
          const u = clamp((t - las.at + 0.1) / 0.4, 0, 1), d = las.radius * Math.sin(Math.PI * u);
          const tx = hx + f.facing * d, ty = hy - 30 * Math.sin(Math.PI * u);
          rope(curve(hx, hy, tx, ty, 24));
          L.lineStyle(2.4, 0x8a5a2e).strokeEllipse(tx, ty, 26, 12);
        } else if (t < las.at) rope(curve(hx, hy, hx - f.facing * 20, hy - 60, 0));
        continue;
      }
      const a = f.attack;
      if (!a || a.kind === 'charged') continue;
      const ph = attackPhase(f), T = attackTiming(f);
      const reach = a.kind === 'long' ? f.stats.reach + LONG_REACH_BONUS : a.kind === 'airLash' ? f.stats.reach * AIR_LASH_REACH : f.stats.reach;
      const front = f.x + f.facing * halfW(f);
      let tx = front + f.facing * reach, ty = a.aerial && a.kind !== 'airLash' ? f.y - h * 0.3 : hy + 6;
      if (a.kind === 'airLash') { const d = reach * Math.SQRT1_2; tx = front + f.facing * d; ty = hy + d; }
      if (ph === 'startup') {
        // swung back over the head
        const u = a.t / T.startup;
        if (u < 0.35) continue;
        rope(curve(hx, hy - 6, hx - f.facing * 50 * u, hy - 50 * u, -10));
      } else if (ph === 'active') {
        const u = (a.t - T.startup) / T.active, wave = Math.sin(u * Math.PI * 3) * 6 * (1 - u);
        rope(curve(hx, hy, tx, ty, 8 + wave));
        if (u < 0.3) this.flashStar(tx, ty, 0.35, 0xffffff);
      } else {
        const u = clamp((a.t - T.startup - T.active) / T.recovery, 0, 1), k = 1 - ease(u);
        if (k > 0.05) rope(curve(hx, hy, hx + (tx - hx) * k, hy + (ty - hy) * k + 18 * (1 - k), -6 * k));
      }
    }
  }

  drawWhirl(g) {
    const w = this.whirl;
    w.clear();
    for (const f of g.fighters) {
      if (!f.super?.def.spin) continue;
      const t = f.super.t, fade = Math.min(1, (f.super.def.time - t) * 4, t * 6), h = height(f);
      const cx = f.x, cy = f.y - h / 2;
      // blue core glow and crackling sparks; a bolt strikes nearby every few frames
      w.fillStyle(0x7fc8ff, 0.18 * fade).fillEllipse(cx, cy, 120, 150);
      w.fillStyle(0xffffff, 0.12 * fade).fillEllipse(cx, cy, 60, 90);
      this.zap.emitParticle(2, cx + (Math.random() - 0.5) * 60, cy + (Math.random() - 0.5) * 70);
      if (Math.random() < 0.12 * fade) this.bolt(cx + (Math.random() - 0.5) * 140, Math.min(GROUND_Y, f.y + 4), 0.5 + Math.random() * 0.4);
      for (let k = 0; k < 5; k++) {
        const rx = 26 + k * 9, ry = 7 + k * 2.4, y = cy + 34 - k * 17, a = t * 14 + k;
        w.lineStyle(3 - k * 0.3, 0xcfe8ff, 0.75 * fade);
        w.beginPath();
        for (let s = 0; s <= 24; s++) { const th = a + s / 24 * Math.PI * 1.6; w.lineTo(cx + Math.cos(th) * rx, y + Math.sin(th) * ry); }
        w.strokePath();
      }
      // lightning forks
      if (Math.floor(t * 20) % 3 !== 0) {
        w.lineStyle(2.5, 0xfff36a, fade);
        for (let k = 0; k < 2; k++) {
          let x = cx + (Math.random() - 0.5) * 70, y = cy - 60;
          w.beginPath(); w.moveTo(x, y);
          for (let s = 0; s < 5; s++) { x += (Math.random() - 0.5) * 26; y += 20; w.lineTo(x, y); }
          w.strokePath();
        }
      }
    }
  }

  // Super close-up: zoom on the user, dim the stage and slide in cinema bars; ease back after.
  updateFocus(dt) {
    const g = this.model, cam = this.cameras.main, user = g.fighters.find(f => f.super);
    // the bull summon takes the camera for its whole run
    const target = g.bull ? { x: g.bull.x + g.bull.dir * 60, y: GROUND_Y - 70 } : user ? { x: user.x + user.facing * 40, y: user.y - height(user) / 2 - 10 } : null;
    if (target) {
      if (!this.focusAt || this.focus === 0) this.focusAt = { ...target };
      const k = Math.min(1, dt * 14);
      this.focusAt.x += (target.x - this.focusAt.x) * k; this.focusAt.y += (target.y - this.focusAt.y) * k;
    }
    this.focus = clamp(this.focus + (target ? dt / FOCUS_IN : -dt / FOCUS_OUT), 0, 1);
    const e = ease(this.focus), Z = 1 + CLOSE_ZOOM * e;
    cam.setZoom(this.baseZoom * Z);
    if (e > 0 && this.focusAt) {
      const w = VIEW_W / Z, h = VIEW_H / Z;
      cam.scrollX = clamp(g.cam + (this.focusAt.x - w / 2 - g.cam) * e, 0, WORLD_W - w);
      cam.scrollY = clamp((this.focusAt.y - h / 2) * e, 0, VIEW_H - h);
    } else { cam.scrollX = g.cam; cam.scrollY = 0; }
    this.dim.setAlpha(0.55 * e);
    this.bars.forEach(b => b.setSize(VIEW_W, 26 * e));
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

    // round banners (while ROUND n shows, the VS intro sits under it)
    let text = '', sub = '';
    const ph = g.phase, t = g.phaseT, names = g.fighters.map(f => this.theme.characters[f.weapon].name);
    const vsOn = ph === 'intro' && t < INTRO_TIME * 0.65;
    this.banner.y = vsOn ? VIEW_H * 0.57 - 100 : VIEW_H * 0.42;
    this.drawVs();
    if (ph === 'intro') text = vsOn ? `ROUND ${g.round}` : 'FIGHT!';
    else if (ph === 'roundEnd' && g.result) {
      text = g.result.reason === 'KO' ? 'K.O.' : 'TIME UP';
      if (t > 0.8) sub = g.result.winner < 0 ? '무승부' : `${names[g.result.winner]} 승리`;
    } else if (ph === 'matchEnd' && t < 1.5) { text = 'WINNER'; sub = names[g.winner]; }
    const pop = 0.6 + 0.4 * Math.min(1, t * 6);
    this.banner.setText(text).setScale(pop * (vsOn ? 0.68 : 1));
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
