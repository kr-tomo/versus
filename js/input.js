// Touch buttons, keyboard and gamepads merged into per-player input.

const blank = () => ({ left: false, right: false, jump: false, down: false, attack: false, guard: false });

const KEYMAP = [
  { KeyA: 'left', KeyD: 'right', KeyW: 'jump', KeyS: 'down', KeyF: 'attack', KeyG: 'guard' },
  { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', ArrowDown: 'down', KeyK: 'attack', KeyL: 'guard' }
];
const GAME_KEYS = new Set(KEYMAP.flatMap(Object.keys));

export class InputManager {
  constructor() {
    this.pointers = new Map(); // pointerId → { player, action }
    this.keys = new Set();
    this.players = 2;
    this.onPadsChanged = () => {};
    this.padCount = 0;
    addEventListener('keydown', e => { if (GAME_KEYS.has(e.code)) { this.keys.add(e.code); e.preventDefault(); } });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.pointers.clear(); });
    addEventListener('gamepadconnected', () => this.pollPads());
    addEventListener('gamepaddisconnected', () => this.pollPads());
  }

  // Pointer tracking on the controls layer; sliding a finger between buttons works.
  bindTouch(layer) {
    const target = (x, y) => {
      const el = document.elementFromPoint(x, y)?.closest('[data-action]');
      return el && !el.classList.contains('off') ? { player: +el.dataset.player, action: el.dataset.action } : null;
    };
    const update = e => {
      const t = target(e.clientX, e.clientY);
      if (t) this.pointers.set(e.pointerId, t); else this.pointers.delete(e.pointerId);
      this.refreshPressed(layer);
    };
    layer.addEventListener('pointerdown', e => { e.preventDefault(); update(e); });
    layer.addEventListener('pointermove', e => { if (this.pointers.has(e.pointerId) || e.buttons) update(e); });
    const end = e => { this.pointers.delete(e.pointerId); this.refreshPressed(layer); };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) layer.addEventListener(ev, end);
  }

  refreshPressed(layer) {
    const on = new Set([...this.pointers.values()].map(p => `${p.player}:${p.action}`));
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
    for (const p of this.pointers.values()) if (p.player === player) s[p.action] = true;
    const maps = this.players === 1 ? KEYMAP : [KEYMAP[player]];
    for (const map of maps) for (const [code, action] of Object.entries(map)) if (this.keys.has(code)) s[action] = true;
    const pad = this.pads()[player];
    if (pad && player < this.players) {
      const b = i => pad.buttons[i]?.pressed;
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      s.left ||= b(14) || ax < -0.5;
      s.right ||= b(15) || ax > 0.5;
      s.jump ||= b(12) || ay < -0.6;
      s.down ||= b(13) || ay > 0.6;
      s.attack ||= b(0);
      s.guard ||= b(1);
    }
    return s;
  }

  padPressed(button) {
    return this.pads().some(p => p.buttons[button]?.pressed);
  }
}
