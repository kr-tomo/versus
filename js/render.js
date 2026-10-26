import { VIEW_W, VIEW_H, GROUND_Y, PARALLAX, MAX_ENERGY } from './config.js';
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
    ctx.beginPath(); ctx.ellipse(f.x - cam, y + 1, 20 * k, 5 * k, 0, 0, Math.PI * 2); ctx.fill();
  }

  drawFighter(game, i, cam) {
    const { ctx } = this, f = game.fighters[i], c = this.theme.characters[f.weapon], sheet = this.sprites.chars[i];
    const idx = c.frames[frameName(f)] ?? 0, [cw, ch] = c.cell, k = sheet.scale;
    const col = idx % c.cols, row = Math.floor(idx / c.cols);
    ctx.save();
    ctx.translate(f.x - cam, f.y);
    if (f.ko) { ctx.translate(-f.facing * 6, -10); ctx.rotate(-f.facing * Math.PI / 2 * Math.min(1, (f.t - f.koAt) * 4)); }
    ctx.scale(f.facing * c.scale, c.scale);
    if (f.hitFlash > 0 && Math.floor(f.hitFlash * 30) % 2) ctx.globalAlpha = 0.45;
    if (f.inTrap && Math.floor(game.t * 12) % 2) ctx.globalAlpha = 0.6;
    ctx.drawImage(sheet.canvas, col * cw * k, row * ch * k, cw * k, ch * k, -c.origin[0], -c.origin[1], cw, ch);
    ctx.restore();
  }

  drawEffects(game, cam) {
    const { ctx } = this;
    for (const e of game.effects) {
      const p = e.t / 0.6, x = e.x - cam;
      ctx.save();
      if (p < 0.4) {
        const r = 8 + p * 60, a = 1 - p / 0.4;
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
    });
    ctx.textAlign = 'center';
    ctx.font = `900 20px ${FONT}`;
    const tl = Math.ceil(game.timeLeft);
    ctx.fillStyle = tl <= 10 ? '#ff6b5a' : '#fff';
    ctx.fillText(String(tl), cx, top + 15);
    ctx.font = `600 8px ${FONT}`; ctx.fillStyle = '#aaa';
    ctx.fillText('II', cx, top + 26);
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
