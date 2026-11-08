import { readPad } from './input.js';

// Gamepad / keyboard navigation for the DOM screens.
// Sources: every connected pad (by index) and the keyboard ('kb').
// Emits: up down left right ok back start, with auto-repeat for directions.

const REPEAT_DELAY = 0.32, REPEAT_RATE = 0.11;
const DIRS = ['up', 'down', 'left', 'right'];
const KEYS = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Enter: 'ok', Space: 'ok', NumpadEnter: 'ok', Escape: 'back', Backspace: 'back', KeyP: 'start'
};

// Spatial navigation: nearest rect whose center lies in the direction, preferring aligned ones.
export function pickNext(rects, from, dir) {
  const c = r => [r.x + r.w / 2, r.y + r.h / 2];
  const [fx, fy] = c(rects[from]);
  let best = -1, bestScore = Infinity;
  rects.forEach((r, i) => {
    if (i === from) return;
    const [x, y] = c(r), dx = x - fx, dy = y - fy;
    const main = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    const cross = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (main <= 1) return;
    const score = main + cross * 2.2;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best < 0 ? from : best;
}

export class MenuNav {
  constructor(onAction) {
    this.onAction = onAction;
    this.held = new Map(); // `${src}:${dir}` → seconds held
    this.prevButtons = new Map();
    addEventListener('keydown', e => {
      const a = KEYS[e.code];
      if (!a) return;
      if (this.onAction(a, 'kb', e.repeat) && !e.repeat) e.preventDefault();
    });
  }

  // Call every animation frame with the connected pads.
  poll(dt, pads) {
    pads.forEach((pad, src) => {
      const p = readPad(pad, 0.55), dirs = p;
      for (const d of DIRS) {
        const k = `${src}:${d}`;
        if (!dirs[d]) { this.held.delete(k); continue; }
        const t = this.held.get(k);
        if (t === undefined) { this.held.set(k, 0); this.onAction(d, src, false); continue; }
        const nt = t + dt;
        this.held.set(k, nt);
        if (nt >= REPEAT_DELAY && Math.floor((nt - REPEAT_DELAY) / REPEAT_RATE) !== Math.floor((t - REPEAT_DELAY) / REPEAT_RATE)) this.onAction(d, src, true);
      }
      const prev = this.prevButtons.get(src) || [];
      const now = [p.a, p.b, p.start, p.select, p.lb, p.rb];
      ['ok', 'back', 'start', 'select', 'prev', 'next'].forEach((a, i) => { if (now[i] && !prev[i]) this.onAction(a, src, false); });
      this.prevButtons.set(src, now);
    });
    for (const src of [...this.prevButtons.keys()]) if (src >= pads.length) this.prevButtons.delete(src);
  }

  // Swallow buttons already held (e.g. A pressed to confirm) so they don't fire again.
  sync(pads) {
    pads.forEach((pad, src) => { const p = readPad(pad); this.prevButtons.set(src, [p.a, p.b, p.start, p.select, p.lb, p.rb]); });
  }
}
