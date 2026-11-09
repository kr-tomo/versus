// Touch buttons, keyboard and gamepads merged into per-player input.

// Joystick thresholds (fraction of its radius): walking reacts early, jump/drop need a firm push.
const STICK_X = 0.35, STICK_Y = 0.6;

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
    this.sticks = new Map();   // pointerId → { player, el, dx, dy } (virtual joystick, -1..1)
    this.keys = new Set();
    this.players = 2;
    this.onPadsChanged = () => {};
    this.padCount = 0;
    addEventListener('keydown', e => { if (GAME_KEYS.has(e.code)) { this.keys.add(e.code); e.preventDefault(); } });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.pointers.clear(); this.sticks.clear(); });
    addEventListener('gamepadconnected', () => this.pollPads());
    addEventListener('gamepaddisconnected', () => this.pollPads());
  }

  // Touch controls. The joystick follows its finger anywhere until release. A finger that slides
  // from one button onto another of the same player keeps both pressed (attack → guard = both).
  bindTouch(layer) {
    const hit = (x, y) => {
      const el = document.elementFromPoint(x, y)?.closest('[data-action]');
      return el && !el.classList.contains('off') ? el : null;
    };
    const aim = (st, e) => {
      const r = st.el.getBoundingClientRect(), R = r.width / 2;
      let dx = (e.clientX - r.left - R) / R, dy = (e.clientY - r.top - R) / R;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      st.dx = dx; st.dy = dy;
      st.el.style.setProperty('--kx', `${(dx * R * 0.55).toFixed(1)}px`);
      st.el.style.setProperty('--ky', `${(dy * R * 0.55).toFixed(1)}px`);
    };
    layer.addEventListener('pointerdown', e => {
      e.preventDefault();
      const el = hit(e.clientX, e.clientY);
      if (!el) return;
      try { el.setPointerCapture(e.pointerId); } catch { /* not supported */ }
      if (el.dataset.action === 'stick') {
        const st = { player: +el.dataset.player, el, dx: 0, dy: 0 };
        this.sticks.set(e.pointerId, st);
        aim(st, e);
      } else this.pointers.set(e.pointerId, { player: +el.dataset.player, actions: new Set([el.dataset.action]) });
      this.refreshPressed(layer);
    });
    layer.addEventListener('pointermove', e => {
      const st = this.sticks.get(e.pointerId);
      if (st) { aim(st, e); return; }
      const p = this.pointers.get(e.pointerId), el = p && hit(e.clientX, e.clientY);
      if (el && el.dataset.action !== 'stick' && +el.dataset.player === p.player && !p.actions.has(el.dataset.action)) {
        p.actions.add(el.dataset.action);
        this.refreshPressed(layer);
      }
    });
    const end = e => {
      const st = this.sticks.get(e.pointerId);
      if (st) { st.el.style.setProperty('--kx', '0px'); st.el.style.setProperty('--ky', '0px'); this.sticks.delete(e.pointerId); }
      this.pointers.delete(e.pointerId);
      this.refreshPressed(layer);
    };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) layer.addEventListener(ev, end);
  }

  refreshPressed(layer) {
    const on = new Set([...this.pointers.values()].flatMap(p => [...p.actions].map(a => `${p.player}:${a}`)));
    for (const st of this.sticks.values()) on.add(`${st.player}:stick`);
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
    // joystick: sideways walks, up jumps, down drops through a platform
    for (const st of this.sticks.values()) if (st.player === player) {
      s.left ||= st.dx < -STICK_X; s.right ||= st.dx > STICK_X;
      s.jump ||= st.dy < -STICK_Y; s.down ||= st.dy > STICK_Y;
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
