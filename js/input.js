// Touch buttons, keyboard and gamepads merged into per-player input.

// Touch D-pad, after RetroArch's overlay dpad_area (input_driver.c, input_overlay_get_eightway_state):
// the diagonal sensitivity is the size of a diagonal zone relative to a cardinal one; 100% gives
// 8 equal 45° zones. At 80% each diagonal spans 40° and each cardinal 50° (boundaries 25° / 65°).
export const DPAD_DIAGONAL = 80;
export const DPAD_RANGE_MOD = 1.5;     // hitbox growth while held (RetroArch range_mod)
export const HAPTIC_MS = 12;           // attack/guard tick with one player on touch
const NO_DIRS = Object.freeze({ up: false, down: false, left: false, right: false });

export function dpadSlopes(sensitivity = DPAD_DIAGONAL) {
  const f = 2 * sensitivity / (100 + sensitivity);
  const high = f * (0.375 * Math.PI) + (1 - f) * (0.25 * Math.PI);
  const low = f * (0.125 * Math.PI) + (1 - f) * (0.25 * Math.PI);
  return { low: Math.tan(low), high: Math.tan(high) };
}
const SLOPES = dpadSlopes();

// (dx, dy) from the D-pad center (y down) → pressed directions; any offset picks a zone (no dead zone)
export function dpadDirs(dx, dy, { low, high } = SLOPES) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (!ax && !ay) return NO_DIRS;
  const vert = ay > low * ax, horiz = ay < high * ax;
  return { up: vert && dy < 0, down: vert && dy > 0, left: horiz && dx < 0, right: horiz && dx > 0 };
}

const blank = () => ({ left: false, right: false, jump: false, down: false, attack: false, guard: false });

// One pad → logical buttons. Handles the standard mapping plus controllers that report a
// non-standard layout (d-pad on axes 6/7 or a hat switch on axis 9), and analog-only buttons.
export function readPad(pad, dead = 0.5) {
  const b = i => { const x = pad.buttons[i]; return !!x && (x.pressed || x.value > 0.5); };
  const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
  let hx = 0, hy = 0;
  if (pad.mapping !== 'standard') {
    if (pad.axes.length > 7) { hx = Math.round(pad.axes[6] || 0); hy = Math.round(pad.axes[7] || 0); }
    const hat = pad.axes[9];
    if (hat !== undefined && hat >= -1.05 && hat <= 1.05) {
      // 8-way hat: -1 up, -0.71 up-right, -0.43 right, … 0.71 left (anything > 1 is centered)
      const dir = Math.round((hat + 1) / (2 / 7));
      hx = [0, 1, 1, 1, 0, -1, -1, -1][dir] ?? 0;
      hy = [-1, -1, 0, 1, 1, 1, 0, -1][dir] ?? 0;
    }
  }
  return {
    up: b(12) || ay < -dead - 0.05 || hy < 0, down: b(13) || ay > dead + 0.05 || hy > 0,
    left: b(14) || ax < -dead || hx < 0, right: b(15) || ax > dead || hx > 0,
    a: b(0), b: b(1), x: b(2), y: b(3), lb: b(4), rb: b(5), select: b(8), start: b(9)
  };
}

const KEYMAP = [
  { KeyA: 'left', KeyD: 'right', KeyW: 'jump', KeyS: 'down', KeyF: 'attack', KeyG: 'guard' },
  { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', ArrowDown: 'down', KeyK: 'attack', KeyL: 'guard' }
];
const GAME_KEYS = new Set(KEYMAP.flatMap(Object.keys));

export class InputManager {
  constructor() {
    this.pointers = new Map(); // pointerId → { player, actions: Set } (buttons touched during the stroke)
    this.dpads = new Map();    // pointerId → { player, el, on, dirs } (touch D-pad)
    this.keys = new Set();
    this.players = 2;
    this.onPadsChanged = () => {};
    this.padCount = 0;
    addEventListener('keydown', e => { if (GAME_KEYS.has(e.code)) { this.keys.add(e.code); e.preventDefault(); } });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.pointers.clear(); this.dpads.clear(); });
    addEventListener('gamepadconnected', () => this.pollPads());
    addEventListener('gamepaddisconnected', () => this.pollPads());
  }

  // Touch controls, modelled on RetroArch's overlay D-pad (dpad_area):
  // - one cross-shaped area; the direction comes from the angle of the finger from its center,
  //   8-way with diagonal zones sized by DPAD_DIAGONAL (RetroArch default 80%)
  // - the press must start inside the drawn area; while held the hitbox grows by DPAD_RANGE_MOD
  //   (RetroArch range_mod) so the thumb can roll around without slipping off; leaving even that
  //   releases it, and coming back into the drawn area presses again
  // - the finger slides between directions freely; no dynamic recentering
  // A finger that slides from one action button onto another of the same player keeps both pressed
  // (attack → guard = both). With one player on touch, attack/guard give a short haptic tick.
  bindTouch(layer) {
    const hit = (x, y) => {
      const el = document.elementFromPoint(x, y)?.closest('[data-action]');
      return el && !el.classList.contains('off') ? el : null;
    };
    const aim = (st, e) => {
      const r = st.el.getBoundingClientRect(), R = r.width / 2;
      const dx = (e.clientX - r.left - R) / R, dy = (e.clientY - r.top - R) / R;
      const reach = st.on ? DPAD_RANGE_MOD : 1;
      st.on = Math.abs(dx) <= reach && Math.abs(dy) <= reach;
      st.dirs = st.on ? dpadDirs(dx, dy) : NO_DIRS;
      st.el.dataset.dirs = Object.keys(st.dirs).filter(k => st.dirs[k]).join(' ');
    };
    const tick = (player, action) => {
      if (this.players === 1 && (action === 'attack' || action === 'guard')) navigator.vibrate?.(HAPTIC_MS);
    };
    layer.addEventListener('pointerdown', e => {
      e.preventDefault();
      const el = hit(e.clientX, e.clientY);
      if (!el) return;
      try { el.setPointerCapture(e.pointerId); } catch { /* not supported */ }
      if (el.dataset.action === 'dpad') {
        const st = { player: +el.dataset.player, el, on: false, dirs: NO_DIRS };
        this.dpads.set(e.pointerId, st);
        aim(st, e);
      } else {
        this.pointers.set(e.pointerId, { player: +el.dataset.player, actions: new Set([el.dataset.action]) });
        tick(+el.dataset.player, el.dataset.action);
      }
      this.refreshPressed(layer);
    });
    layer.addEventListener('pointermove', e => {
      const st = this.dpads.get(e.pointerId);
      if (st) { aim(st, e); this.refreshPressed(layer); return; }
      const p = this.pointers.get(e.pointerId), el = p && hit(e.clientX, e.clientY);
      if (el && el.dataset.action !== 'dpad' && +el.dataset.player === p.player && !p.actions.has(el.dataset.action)) {
        p.actions.add(el.dataset.action);
        tick(p.player, el.dataset.action);
        this.refreshPressed(layer);
      }
    });
    const end = e => {
      const st = this.dpads.get(e.pointerId);
      if (st) { st.el.dataset.dirs = ''; this.dpads.delete(e.pointerId); }
      this.pointers.delete(e.pointerId);
      this.refreshPressed(layer);
    };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) layer.addEventListener(ev, end);
  }

  refreshPressed(layer) {
    const on = new Set([...this.pointers.values()].flatMap(p => [...p.actions].map(a => `${p.player}:${a}`)));
    for (const st of this.dpads.values()) if (st.on) on.add(`${st.player}:dpad`);
    for (const el of layer.querySelectorAll('[data-action]')) el.classList.toggle('down', on.has(`${el.dataset.player}:${el.dataset.action}`));
  }

  pads() {
    return [...(navigator.getGamepads?.() || [])].filter(p => p && p.connected).sort((a, b) => a.index - b.index);
  }

  pollPads() {
    const n = this.pads().length;
    if (n !== this.padCount) { this.padCount = n; this.onPadsChanged(); }
  }

  // Which players currently use a gamepad (pads are assigned to players in order).
  padPlayers() {
    return this.pads().slice(0, this.players).map((_, i) => i);
  }

  read(player) {
    const s = blank();
    for (const p of this.pointers.values()) if (p.player === player) for (const a of p.actions) s[a] = true;
    // D-pad: ◀ ▶ walk, ▲ jumps (diagonals jump while moving), ▼ drops through a platform
    for (const st of this.dpads.values()) if (st.player === player) {
      s.left ||= st.dirs.left; s.right ||= st.dirs.right; s.jump ||= st.dirs.up; s.down ||= st.dirs.down;
    }
    const maps = this.players === 1 ? KEYMAP : [KEYMAP[player]];
    for (const map of maps) for (const [code, action] of Object.entries(map)) if (this.keys.has(code)) s[action] = true;
    const pad = this.pads()[player];
    if (pad && player < this.players) {
      const p = readPad(pad);
      s.left ||= p.left;
      s.right ||= p.right;
      s.jump ||= p.up;
      s.down ||= p.down;
      s.attack ||= p.a;
      s.guard ||= p.b;
    }
    return s;
  }

  padPressed(button) {
    return this.pads().some(p => { const x = p.buttons[button]; return !!x && (x.pressed || x.value > 0.5); });
  }
}
