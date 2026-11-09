// Screen size → main view rect + touch button positions.
// Players sit side by side: P1 controls on the left, P2 on the right.
// 'side' mode puts each player's two-hand cluster beside the view;
// 'bottom' mode puts the clusters under the view at the two ends.

export const ASPECT = 16 / 9;
export const SIDE_MIN_RATIO = 0.75;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ACTIONS = ['attack', 'guard', 'jump'];

function metrics(W, H) {
  const btn = Math.round(clamp(Math.min(W, H) * 0.13, 44, 84));
  const gap = Math.round(btn * 0.22);
  const margin = Math.max(8, Math.round(btn * 0.18));
  return { btn, gap, margin, sep: Math.round(btn * 0.6) };
}

// Virtual joystick radius in the side gutter (fits the old two-button row).
const stickR = m => m.btn * 0.95;

// 2 columns: [jump] / [attack guard] / (gap) / [joystick], bottom aligned
function sideCluster(cx, bottom, m, player, parts) {
  const { btn, gap } = m, r = btn / 2, dx = (btn + gap) / 2, rs = stickR(m);
  const yStick = bottom - rs, yAct = yStick - rs - gap - r, yJump = yAct - btn - gap;
  const out = [];
  if (parts.includes('move')) out.push({ player, action: 'stick', x: cx, y: yStick, r: rs });
  if (parts.includes('act')) {
    // with no joystick below, the actions drop to the bottom for the thumb
    const shift = parts.includes('move') ? 0 : bottom - r - yAct;
    out.push({ player, action: 'attack', x: cx - dx, y: yAct + shift, r }, { player, action: 'guard', x: cx + dx, y: yAct + shift, r }, { player, action: 'jump', x: cx, y: yJump + shift, r });
  }
  return out;
}

function sideLayout(W, H, players, m) {
  const gutter = 2 * m.btn + m.gap + 2 * m.margin;
  const clusterH = 2 * stickR(m) + 2 * m.btn + 2 * m.gap + 2 * m.margin;
  const vw = Math.min(W - 2 * gutter, H * ASPECT);
  if (vw <= 0 || clusterH > H) return null;
  const vh = vw / ASPECT;
  const view = { x: (W - vw) / 2, y: (H - vh) / 2, w: vw, h: vh };
  const leftCx = view.x / 2, rightCx = W - view.x / 2, bottom = H - m.margin;
  const buttons = players === 2
    ? [...sideCluster(leftCx, bottom, m, 0, ['move', 'act']), ...sideCluster(rightCx, bottom, m, 1, ['move', 'act'])]
    : [...sideCluster(leftCx, bottom, m, 0, ['move']), ...sideCluster(rightCx, bottom, m, 0, ['act'])];
  return { mode: 'side', view, btn: m.btn, buttons };
}

function row(x0, y, m, player, actions) {
  return actions.map((action, i) => ({ player, action, x: x0 + m.btn / 2 + i * (m.btn + m.gap), y, r: m.btn / 2 }));
}

// The joystick takes the two slots the ◀ ▶ buttons used; under the view it is limited by the row height.
function stickSlot(x0, y, m, player) {
  return { player, action: 'stick', x: x0 + m.btn + m.gap / 2, y, r: Math.min(m.btn + m.gap / 2, m.btn / 2 + m.margin * 0.8) };
}

function bottomLayout(W, H, players, m0) {
  let m = { ...m0 };
  const half = players === 2 ? W / 2 - m.margin * 1.5 : W - m.margin * 2;
  const wide = mm => 5 * mm.btn + 3 * mm.gap + mm.sep;
  let twoRows = false;
  if (players === 2 && wide(m) > half) {
    twoRows = true;
    const narrow = 3 * m.btn + 2 * m.gap;
    if (narrow > half) {
      const btn = Math.floor((half) / (3 + 2 * 0.22));
      m = { ...m, btn, gap: Math.round(btn * 0.22), sep: Math.round(btn * 0.6) };
    }
  }
  const ch = (twoRows ? 2 * m.btn + m.gap : m.btn) + 2 * m.margin;
  const vh = Math.min(H - ch, W / ASPECT), vw = vh * ASPECT;
  const view = { x: (W - vw) / 2, y: (H - ch - vh) / 2, w: vw, h: vh };
  const yB = H - m.margin - m.btn / 2, yT = yB - m.btn - m.gap;
  const buttons = [];
  const clusterW = twoRows ? 3 * m.btn + 2 * m.gap : wide(m);
  const cluster = (x0, player) => {
    if (twoRows) {
      buttons.push(...row(x0, yT, m, player, ACTIONS));
      buttons.push(stickSlot(x0 + (m.btn + m.gap) / 2, yB, m, player));
    } else {
      buttons.push(stickSlot(x0, yB, m, player));
      buttons.push(...row(x0 + 2 * (m.btn + m.gap) - m.gap + m.sep, yB, m, player, ACTIONS));
    }
  };
  if (players === 2) { cluster(m.margin, 0); cluster(W - m.margin - clusterW, 1); }
  else {
    buttons.push(stickSlot(m.margin, yB, m, 0));
    buttons.push(...row(W - m.margin - (3 * m.btn + 2 * m.gap), yB, m, 0, ACTIONS));
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
  const L = side && side.view.w >= bottom.view.w * SIDE_MIN_RATIO ? side : bottom;
  // a single cluster belongs to whichever player is left on touch
  if (n === 1) L.buttons.forEach(b => { b.player = touch[0]; });
  return L;
}
