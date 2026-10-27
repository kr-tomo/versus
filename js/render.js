import { VIEW_W, VIEW_H, GROUND_Y, PARALLAX, MAX_ENERGY, SUPER_MAX, SUPER_HOLD } from './config.js';
import { frameName } from './fighter.js';
import { rasterize } from './assets.js';
import { INTRO_TIME } from './game.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const quant = v => Math.round(v * 4) / 4;
const FONT = '"Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif';

export class Renderer {
  constructor(canvas, theme) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.theme = theme;
    this.sprites = null;
    this.key = '';
  }

  // Rasterize the sprites needed by this game at the current canvas scale.
  async prepare(game) {
    const px = this.canvas.width / VIEW_W;
    const mapScale = quant(clamp(px, 1, 3)), charScale = quant(clamp(px * 0.8, 1, 3));
    const key = `${game.mapId}|${game.settings.weapons}|${mapScale}|${charScale}`;
    if (key === this.key) return;
    const t = this.theme, base = t.base, m = t.maps[game.mapId];
    const [far, ground, trap, platforms, ...chars] = await Promise.all([
      rasterize(base + m.far, mapScale), rasterize(base + m.ground, mapScale),
      rasterize(base + m.trap.sheet, mapScale), rasterize(base + m.platforms.sheet, mapScale),
      ...game.settings.weapons.map(w => rasterize(base + t.characters[w].sheet, charScale))
    ]);
    this.sprites = { far, ground, trap, platforms, chars };
    this.key = key;
  }

  draw(game) {
    const { ctx, canvas } = this;
    const s = canvas.width / VIEW_W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    if (!this.sprites) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); return; }
    const cam = game.cam, sp = this.sprites, m = this.theme.maps[game.mapId];

    ctx.drawImage(sp.far.canvas, -cam * PARALLAX, 0, 1280, 360);
    this.drawPlatforms(game, m, cam);
    ctx.drawImage(sp.ground.canvas, -cam, GROUND_Y, 1280, 44);
    const tf = Math.floor(game.t * 3) % m.trap.frames, [tw, th] = m.trap.cell, ts = sp.trap.scale;
    for (const t of game.layout.traps) {
      ctx.drawImage(sp.trap.canvas, tf * tw * ts, 0, tw * ts, th * ts, t.x - m.trap.origin[0] - cam, GROUND_Y - m.trap.origin[1], tw, th);
    }
    for (const f of game.fighters) this.drawShadow(game, f, cam);
    // the attacker is drawn on top so the weapon stays visible
    const order = [0, 1].sort((a, b) => (game.fighters[a].attack ? 1 : 0) - (game.fighters[b].attack ? 1 : 0));
    for (const i of order) this.drawFighter(game, i, cam);
    this.drawEffects(game, cam);
    this.drawSuperBanner(game);
    this.drawHud(game);
    this.drawBanner(game);
  }

  drawPlatforms(game, m, cam) {
    const { ctx } = this, sp = this.sprites.platforms, pm = m.platforms, k = sp.scale;
    for (const p of game.layout.platforms) {
      const x = p.x - cam;
      ctx.lineWidth = 2.5;
      if (m.extras.ropes) { ctx.strokeStyle = m.extras.ropes; ctx.beginPath(); ctx.moveTo(x + 6, 0); ctx.lineTo(x + 8, p.y); ctx.moveTo(x + p.w - 6, 0); ctx.lineTo(x + p.w - 8, p.y); ctx.stroke(); }
      if (m.extras.posts) {
        ctx.strokeStyle = m.extras.posts; ctx.lineWidth = 4; ctx.beginPath();
        for (const px of [x + 12, x + p.w - 12]) { ctx.moveTo(px, p.y + 14); ctx.lineTo(px, GROUND_Y + 2); }
        ctx.stroke();
      }
      const idx = Math.max(0, pm.widths.indexOf(p.w));
      ctx.drawImage(sp.canvas, 0, idx * pm.cellH * k, (p.w + 8) * k, pm.cellH * k, x - pm.origin[0], p.y - pm.origin[1], p.w + 8, pm.cellH);
    }
  }

  surfaceBelow(game, f) {
    let y = GROUND_Y;
    for (const p of game.layout.platforms) if (f.x >= p.x && f.x <= p.x + p.w && p.y >= f.y - 1 && p.y < y) y = p.y;
    return y;
  }

  drawShadow(game, f, cam) {
    const { ctx } = this, y = this.surfaceBelow(game, f), k = clamp(1 - (y - f.y) / 220, 0.35, 1);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    const w = 20 * (f.stats.halfW ?? 14) / 14;
    ctx.beginPath(); ctx.ellipse(f.x - cam, y + 1, w * k, 5 * k, 0, 0, Math.PI * 2); ctx.fill();
  }

  drawFighter(game, i, cam) {
    const { ctx } = this, f = game.fighters[i], c = this.theme.characters[f.weapon], sheet = this.sprites.chars[i];
    const idx = c.frames[frameName(f)] ?? 0, [cw, ch] = c.cell, k = sheet.scale;
    const col = idx % c.cols, row = Math.floor(idx / c.cols);
    const draw = () => ctx.drawImage(sheet.canvas, col * cw * k, row * ch * k, cw * k, ch * k, -c.origin[0], -c.origin[1], cw, ch);
    // dash afterimages during a super
    if (f.super && Math.abs(f.vx) > 100) {
      for (let g = 3; g >= 1; g--) {
        ctx.save();
        ctx.globalAlpha = 0.12 * (4 - g);
        ctx.translate(f.x - cam - f.vx * 0.025 * g, f.y);
        ctx.scale(f.facing * c.scale, c.scale);
        draw();
        ctx.restore();
      }
    }
    // charging / super aura
    if (f.super || f.charge > 0 || (f.meter >= SUPER_MAX && !f.ko)) {
      const strength = f.super ? 1 : f.charge > 0 ? 0.4 + 0.6 * f.charge / SUPER_HOLD : 0.25 + 0.15 * Math.sin(game.t * 8);
      const h = (f.stats.height ?? 80), cx = f.x - cam, cy = f.y - h / 2;
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, h * 0.75);
      g.addColorStop(0, `rgba(255,220,90,${0.55 * strength})`); g.addColorStop(1, 'rgba(255,140,20,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - h, cy - h, h * 2, h * 2);
    }
    ctx.save();
    ctx.translate(f.x - cam, f.y);
    if (f.ko) { ctx.translate(-f.facing * 6, -10); ctx.rotate(-f.facing * Math.PI / 2 * Math.min(1, (f.t - f.koAt) * 4)); }
    ctx.scale(f.facing * c.scale, c.scale);
    if (f.hitFlash > 0 && Math.floor(f.hitFlash * 30) % 2) ctx.globalAlpha = 0.45;
    if (f.inTrap && Math.floor(game.t * 12) % 2) ctx.globalAlpha = 0.6;
    draw();
    ctx.restore();
  }

  drawEffects(game, cam) {
    const { ctx } = this;
    for (const e of game.effects) {
      const p = e.t / (e.life ?? 0.6), x = e.x - cam;
      if (e.type === 'super') continue;
      ctx.save();
      if (e.type === 'smoke') {
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = '#3b3346';
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ctx.beginPath(); ctx.arc(x + Math.cos(a) * p * 30, e.y + Math.sin(a) * p * 24, 14 * (1 - p * 0.5), 0, Math.PI * 2); ctx.fill(); }
        ctx.restore(); continue;
      }
      if (e.type === 'quake') {
        // shockwave running along the ground in front of the axe
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = '#ffb347';
        for (let k = 0; k < 7; k++) {
          const sx = x + e.dir * (20 + k * 26 * Math.min(1, p * 3)), hgt = 26 * (1 - k / 8) * (1 - p);
          ctx.beginPath(); ctx.moveTo(sx - 9, e.y); ctx.lineTo(sx, e.y - hgt); ctx.lineTo(sx + 9, e.y); ctx.fill();
        }
        ctx.restore(); continue;
      }
      if (e.type === 'miss') {
        ctx.globalAlpha = 1 - p;
        ctx.font = `900 16px ${FONT}`; ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.fillStyle = '#9ef0ff';
        ctx.strokeText('회피!', x, e.y - 18 - p * 30); ctx.fillText('회피!', x, e.y - 18 - p * 30);
        ctx.restore(); continue;
      }
      if (p < 0.4) {
        const r = (8 + p * 60) * (e.big ? 1.6 : 1), a = 1 - p / 0.4;
        ctx.globalAlpha = a;
        ctx.strokeStyle = e.type === 'guard' ? '#8fd3ff' : '#ffe35a';
        ctx.lineWidth = 3;
        if (e.type === 'guard') { ctx.beginPath(); ctx.arc(x, e.y, r * 0.7, 0, Math.PI * 2); ctx.stroke(); }
        else {
          ctx.beginPath();
          for (let k = 0; k < 8; k++) { const a2 = k * Math.PI / 4 + 0.3; ctx.moveTo(x + Math.cos(a2) * r * 0.3, e.y + Math.sin(a2) * r * 0.3); ctx.lineTo(x + Math.cos(a2) * r, e.y + Math.sin(a2) * r); }
          ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, e.y, 6 * a, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1 - p;
      ctx.font = `900 ${e.type === 'guard' ? 14 : 16 + e.dmg * 0.5}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.fillStyle = e.type === 'guard' ? '#bfe6ff' : '#ffef6a';
      ctx.strokeText(`-${e.dmg}`, x, e.y - 18 - p * 30); ctx.fillText(`-${e.dmg}`, x, e.y - 18 - p * 30);
      ctx.restore();
    }
  }

  drawHud(game) {
    const { ctx } = this;
    const barW = 230, barH = 12, top = 12, cx = VIEW_W / 2;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(0, 0, VIEW_W, 44);
    game.fighters.forEach((f, i) => {
      const left = i === 0, x0 = left ? cx - 30 - barW : cx + 30;
      const ratio = f.energy / MAX_ENERGY;
      ctx.fillStyle = '#3a0f12'; ctx.fillRect(x0, top, barW, barH);
      ctx.fillStyle = ratio > 0.3 ? '#ffd23f' : '#ff5a3c';
      const fw = barW * ratio;
      ctx.fillRect(left ? x0 : x0 + barW - fw, top, fw, barH);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(x0, top, barW, barH);
      // wins at the outer ends of the gauges
      const n = game.settings.wins;
      for (let k = 0; k < n; k++) {
        const wx = left ? x0 - 9 - k * 9 : x0 + barW + 9 + k * 9;
        ctx.beginPath(); ctx.arc(wx, top + barH / 2, 3.4, 0, Math.PI * 2);
        ctx.fillStyle = k < game.wins[i] ? '#ffd23f' : '#2a2a33'; ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
      }
      const ch = this.theme.characters[f.weapon];
      const who = i === 0 ? 'P1' : game.settings.mode === '2p' ? 'P2' : 'CPU';
      ctx.font = `700 10px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = left ? 'left' : 'right';
      ctx.fillText(`${who} · ${ch.name}`, left ? x0 : x0 + barW, top + barH + 13);
      ctx.textAlign = left ? 'right' : 'left'; ctx.fillStyle = '#ffd9a0';
      ctx.fillText(`${Math.ceil(f.energy)}`, left ? x0 + barW : x0, top + barH + 13);
      // super gauge just below the HUD strip
      const gw = 120, gh = 6, gx = left ? x0 : x0 + barW - gw, gy = 48;
      const full = f.meter >= SUPER_MAX, gr = f.meter / SUPER_MAX;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(gx - 1, gy - 1, gw + 2, gh + 2);
      ctx.fillStyle = full ? (Math.floor(game.t * 6) % 2 ? '#fff3a0' : '#ff9a1f') : '#4fd1ff';
      ctx.fillRect(left ? gx : gx + gw * (1 - gr), gy, gw * gr, gh);
      if (f.charge > 0) { ctx.fillStyle = '#fff'; ctx.fillRect(left ? gx : gx + gw * (1 - f.charge / SUPER_HOLD), gy + gh - 2, gw * f.charge / SUPER_HOLD, 2); }
      ctx.font = `800 8px ${FONT}`; ctx.textAlign = left ? 'left' : 'right';
      ctx.fillStyle = full ? '#ffe35a' : '#bfefff';
      ctx.lineWidth = 3; ctx.strokeStyle = '#000';
      const label = full ? '필살기 MAX · 공격+방어 1초' : `필살 ${f.meter}/${SUPER_MAX}`;
      ctx.strokeText(label, left ? gx : gx + gw, gy + gh + 9); ctx.fillText(label, left ? gx : gx + gw, gy + gh + 9);
    });
    ctx.textAlign = 'center';
    ctx.font = `900 20px ${FONT}`;
    const tl = Math.ceil(game.timeLeft);
    ctx.fillStyle = tl <= 10 ? '#ff6b5a' : '#fff';
    ctx.fillText(String(tl), cx, top + 15);
  }

  // Super name, dimmed screen edge flash when someone fires a super.
  drawSuperBanner(game) {
    const e = game.effects.find(x => x.type === 'super');
    if (!e) return;
    const { ctx } = this, p = e.t / e.life, left = e.who === 0;
    ctx.save();
    if (e.t < 0.15) { ctx.fillStyle = `rgba(255,240,200,${0.35 * (1 - e.t / 0.15)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    const slide = Math.min(1, e.t * 8), y = 92;
    ctx.globalAlpha = p > 0.8 ? (1 - p) / 0.2 : 1;
    ctx.fillStyle = 'rgba(20,10,0,.6)';
    ctx.fillRect(left ? 0 : VIEW_W - 260 * slide, y - 22, 260 * slide, 32);
    ctx.font = `900 22px ${FONT}`; ctx.textAlign = left ? 'left' : 'right';
    ctx.lineWidth = 5; ctx.strokeStyle = '#1a0d00'; ctx.lineJoin = 'round';
    const tx = left ? -240 + 256 * slide : VIEW_W + 240 - 256 * slide;
    const g = ctx.createLinearGradient(0, y - 20, 0, y + 4); g.addColorStop(0, '#fff6c8'); g.addColorStop(1, '#ff9a1f');
    ctx.strokeText(e.name, tx, y); ctx.fillStyle = g; ctx.fillText(e.name, tx, y);
    ctx.restore();
  }

  drawBanner(game) {
    let text = null, sub = null;
    const ph = game.phase, t = game.phaseT, names = game.fighters.map((f, i) => this.theme.characters[f.weapon].name);
    if (ph === 'intro') text = t < INTRO_TIME * 0.65 ? `ROUND ${game.round}` : 'FIGHT!';
    else if (ph === 'roundEnd' && game.result) {
      text = game.result.reason === 'KO' ? 'K.O.' : 'TIME UP';
      if (t > 0.8) sub = game.result.winner < 0 ? '무승부' : `${names[game.result.winner]} 승리`;
    } else if (ph === 'matchEnd' && t < 1.5) {
      text = 'WINNER'; sub = names[game.winner];
    }
    if (!text) return;
    const { ctx } = this;
    ctx.save();
    ctx.textAlign = 'center';
    const pop = Math.min(1, t * 6);
    ctx.translate(VIEW_W / 2, VIEW_H * 0.42);
    ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
    ctx.font = `900 52px ${FONT}`;
    ctx.lineWidth = 8; ctx.strokeStyle = '#1a0d00'; ctx.lineJoin = 'round';
    ctx.strokeText(text, 0, 0);
    const g = ctx.createLinearGradient(0, -40, 0, 6); g.addColorStop(0, '#fff6c8'); g.addColorStop(1, '#ff9a1f');
    ctx.fillStyle = g; ctx.fillText(text, 0, 0);
    if (sub) { ctx.font = `800 22px ${FONT}`; ctx.lineWidth = 5; ctx.strokeText(sub, 0, 34); ctx.fillStyle = '#fff'; ctx.fillText(sub, 0, 34); }
    ctx.restore();
  }
}
