// Screen size → main view rect + touch button positions.
// Players sit side by side: P1 controls on the left, P2 on the right.
// 'side' mode: the view takes the full height and each player's cluster sits in the gutter beside
//   it (a cluster wider than its gutter rides over the view's edge like a RetroArch overlay).
// 'bottom' mode: the clusters go under the view at the two ends.

export const ASPECT = 16 / 9;
// Minimum control size: 1.5x the old buttons (0.13 of the short side, 44..84px).
export const BTN_RATIO = 0.195;
export const BTN_MIN = 66;
export const BTN_MAX = 126;
export const DPAD_RATIO = 0.95;        // D-pad half size in buttons (its width is 1.9 buttons)
// Side mode stacks attack over guard along a line tilted STACK_ANGLE from the x axis, so the thumb
// reaches both at about the same radius.
export const STACK_ANGLE = 75;
// Side mode may shrink the view until at most this share of a cluster covers the view's edge.
export const SIDE_OVERLAP = 0.5;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ACTIONS = ['attack', 'guard']; // jump is ↑ on the D-pad
const RAD = STACK_ANGLE * Math.PI / 180;

export function metrics(W, H) {
  const btn = Math.round(clamp(Math.min(W, H) * BTN_RATIO, BTN_MIN, BTN_MAX));
  const gap = Math.round(btn * 0.22);
  const margin = Math.max(8, Math.round(btn * 0.18));
  return { btn, gap, margin, sep: Math.round(btn * 0.6), padR: btn * DPAD_RATIO };
}

// attack at the bottom, guard up the tilted line (shifted toward the view for the thumb's arc)
function stack(xRight, bottom, m, player) {
  const { btn, gap } = m, r = btn / 2, d = btn + gap;
  const x0 = xRight - r, y0 = bottom - r;
  return [{ player, action: 'attack', x: x0, y: y0, r }, { player, action: 'guard', x: x0 - Math.cos(RAD) * d, y: y0 - Math.sin(RAD) * d, r }];
}
const stackW = m => m.btn + Math.cos(RAD) * (m.btn + m.gap);
const stackH = m => m.btn + Math.sin(RAD) * (m.btn + m.gap);

// A side cluster: the D-pad on the left (left thumb), the tilted action stack on its right.
// parts: ['move'], ['act'] or both. Returns its buttons laid out from x0 (its left edge).
function sideCluster(x0, bottom, m, player, parts) {
  const out = [];
  let x = x0;
  if (parts.includes('move')) { out.push({ player, action: 'dpad', x: x + m.padR, y: bottom - m.padR, r: m.padR }); x += 2 * m.padR + m.gap; }
  if (parts.includes('act')) out.push(...stack(x + stackW(m), bottom, m, player));
  return out;
}
const clusterW = (m, parts) => (parts.includes('move') ? 2 * m.padR : 0) + (parts.length === 2 ? m.gap : 0) + (parts.includes('act') ? stackW(m) : 0);

function sideLayout(W, H, players, m) {
  const parts = players === 2 ? [['move', 'act'], ['move', 'act']] : [['move'], ['act']];
  const widthOf = part => part === 'move' ? 2 * m.padR : stackW(m);
  // the gutter a cluster needs, letting its innermost element ride over the view by SIDE_OVERLAP
  const gutter = (p, inner) => clusterW(m, p) + 2 * m.margin - SIDE_OVERLAP * widthOf(inner);
  const need = Math.max(gutter(parts[0], parts[0][parts[0].length - 1]), gutter(parts[1], parts[1][0]));
  const clusterH = Math.max(2 * m.padR, stackH(m)) + 2 * m.margin;
  if (clusterH > H) return null;
  // full height when the gutters hold the clusters; otherwise shrink until the overlap is acceptable
  const vw = Math.min(H * ASPECT, W - 2 * need);
  if (vw <= 0) return null;
  const vh = vw / ASPECT;
  const view = { x: (W - vw) / 2, y: (H - vh) / 2, w: vw, h: vh };
  const bottom = H - m.margin;
  const left = sideCluster(m.margin, bottom, m, 0, parts[0]);
  const right = sideCluster(W - m.margin - clusterW(m, parts[1]), bottom, m, players === 2 ? 1 : 0, parts[1]);
  return { mode: 'side', view, btn: m.btn, buttons: [...left, ...right] };
}

function row(x0, y, m, player, actions) {
  return actions.map((action, i) => ({ player, action, x: x0 + m.btn / 2 + i * (m.btn + m.gap), y, r: m.btn / 2 }));
}

// The D-pad keeps its full size under the view too; it takes two button slots of width.
function padSlot(x0, y, m, player) {
  return { player, action: 'dpad', x: x0 + m.padR, y, r: m.padR };
}
const padW = m => 2 * m.padR;

function bottomLayout(W, H, players, m0) {
  let m = { ...m0 };
  const half = players === 2 ? W / 2 - m.margin * 1.5 : W - m.margin * 2;
  const wide = mm => padW(mm) + mm.sep + 2 * mm.btn + mm.gap;
  let twoRows = false;
  if (players === 2 && wide(m) > half) {
    twoRows = true;
    if (padW(m) > half) {
      const btn = Math.floor(half / (2 * DPAD_RATIO));
      m = { ...m, btn, gap: Math.round(btn * 0.22), sep: Math.round(btn * 0.6), padR: btn * DPAD_RATIO };
    }
  }
  const ch = (twoRows ? padW(m) + m.btn + m.gap : padW(m)) + 2 * m.margin;
  const vh = Math.min(H - ch, W / ASPECT), vw = vh * ASPECT;
  const view = { x: (W - vw) / 2, y: (H - ch - vh) / 2, w: vw, h: vh };
  const yB = H - m.margin - m.padR, yT = yB - m.padR - m.gap - m.btn / 2;
  const buttons = [];
  const clusterW = twoRows ? Math.max(padW(m), 2 * m.btn + m.gap) : wide(m);
  const cluster = (x0, player) => {
    if (twoRows) {
      buttons.push(...row(x0, yT, m, player, ACTIONS));
      buttons.push(padSlot(x0, yB, m, player));
    } else {
      buttons.push(padSlot(x0, yB, m, player));
      buttons.push(...row(x0 + padW(m) + m.sep, yB, m, player, ACTIONS));
    }
  };
  if (players === 2) { cluster(m.margin, 0); cluster(W - m.margin - clusterW, 1); }
  else {
    buttons.push(padSlot(m.margin, yB, m, 0));
    buttons.push(...row(W - m.margin - (2 * m.btn + m.gap), yB, m, 0, ACTIONS));
  }
  return { mode: 'bottom', view, btn: m.btn, buttons };
}

// touch: the players that actually need touch buttons (default: all). A player on a gamepad or the
// computer gets none; with nobody left on touch the view takes the whole screen.
export function computeLayout(W, H, { players = 2, touch = Array.from({ length: players }, (_, i) => i) } = {}) {
  if (!touch.length) {
    const vw = Math.min(W, H * ASPECT), vh = vw / ASPECT;
    return { mode: 'none', view: { x: (W - vw) / 2, y: (H - vh) / 2, w: vw, h: vh }, btn: 0, buttons: [] };
  }
  const n = touch.length >= 2 ? 2 : 1;
  const m = metrics(W, H);
  const side = sideLayout(W, H, n, m);
  const bottom = bottomLayout(W, H, n, m);
  // side wins when its view is at least as wide (a full-height view beats a strip of buttons)
  const L = side && side.view.w >= bottom.view.w ? side : bottom;
  // a single cluster belongs to whichever player is left on touch
  if (n === 1) L.buttons.forEach(b => { b.player = touch[0]; });
  return L;
}
