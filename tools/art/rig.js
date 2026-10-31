// Vector joint rig shared by the concept page and the sprite builder.
// Character local space: feet at (0,0), facing +x, y down.

export const OL = '#18131f';
export const f = n => Math.round(n * 10) / 10;

export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const m = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + ((1 << 24) | (m((n >> 16) & 255) << 16) | (m((n >> 8) & 255) << 8) | m(n & 255)).toString(16).slice(1);
}
export function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

// angle: 0 = down, 90 = forward(+x), 180 = up
function P(b, len, ang) { const r = ang * Math.PI / 180; return [b[0] + Math.sin(r) * len, b[1] + Math.cos(r) * len]; }
function rot(v, deg) { const r = deg * Math.PI / 180; return [v[0] * Math.cos(r) - v[1] * Math.sin(r), v[0] * Math.sin(r) + v[1] * Math.cos(r)]; }
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
function ln(a, b, w, c) { return `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`; }
function ik(S, T, l1, l2) {
  const dx = T[0] - S[0], dy = T[1] - S[1];
  const d = Math.max(1, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.1));
  const a = Math.atan2(dy, dx), A = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const e1 = [S[0] + Math.cos(a + A) * l1, S[1] + Math.sin(a + A) * l1], e2 = [S[0] + Math.cos(a - A) * l1, S[1] + Math.sin(a - A) * l1];
  const e = e1[1] > e2[1] ? e1 : e2, g = Math.atan2(T[1] - e[1], T[0] - e[0]);
  return [e, [e[0] + Math.cos(g) * l2, e[1] + Math.sin(g) * l2]];
}

/* ---------- weapons (local: grip at origin, pointing +x; blade edge on +y) ---------- */
const WEAPONS = {
  sword: () => `
    <circle cx="-8" cy="0" r="3" fill="#c9a04a" stroke="${OL}" stroke-width="1.5"/>
    <rect x="-7" y="-2.5" width="11" height="5" rx="1.5" fill="#5a3a20" stroke="${OL}" stroke-width="1.5"/>
    <path d="M6 -2.6 L50 -2.2 L58 0 L50 2.2 L6 2.6 Z" fill="#e3e8ee" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/>
    <line x1="8" y1="0" x2="50" y2="0" stroke="#a9b3bf" stroke-width="1"/>
    <rect x="3" y="-8" width="4" height="16" rx="1.5" fill="#c9a04a" stroke="${OL}" stroke-width="1.5"/>`,
  spear: () => `
    <line x1="-48" y1="0" x2="72" y2="0" stroke="${OL}" stroke-width="6.5" stroke-linecap="round"/>
    <line x1="-48" y1="0" x2="72" y2="0" stroke="#8a5a2b" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M70 -3 Q78 -6 96 0 Q78 6 70 3 Z" fill="#e3e8ee" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="66" y="-3.5" width="6" height="7" fill="#c9a04a" stroke="${OL}" stroke-width="1.5"/>
    <path d="M66 0 Q58 8 60 16 Q64 10 68 14 Q66 6 68 2 Z" fill="#d0262e" stroke="${OL}" stroke-width="1.5"/>`,
  axe: () => `
    <line x1="-12" y1="0" x2="50" y2="0" stroke="${OL}" stroke-width="7.5" stroke-linecap="round"/>
    <line x1="-12" y1="0" x2="50" y2="0" stroke="#7a4e28" stroke-width="4.5" stroke-linecap="round"/>
    <line x1="-6" y1="0" x2="2" y2="0" stroke="#3b2a1a" stroke-width="4.5"/>
    <path d="M36 -4 L50 -4 Q58 10 54 26 Q44 22 38 24 Q42 12 36 4 Z" fill="#cdd3da" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M53 6 Q56 16 53 24" stroke="#f4f7fa" stroke-width="2" fill="none"/>`,
  dagger: () => `
    <rect x="-6" y="-2.5" width="9" height="5" rx="1.5" fill="#6b3a1e" stroke="${OL}" stroke-width="1.5"/>
    <rect x="2" y="-5.5" width="3" height="11" rx="1" fill="#c9a04a" stroke="${OL}" stroke-width="1.2"/>
    <path d="M5 -2.5 Q18 -3 27 4 Q22 6 18 4 Q12 2 5 2.5 Z" fill="#e3e8ee" stroke="${OL}" stroke-width="1.8" stroke-linejoin="round"/>`,
  fist: () => '',
  stag: () => '',
  mace: () => `
    <line x1="-12" y1="0" x2="44" y2="0" stroke="${OL}" stroke-width="7" stroke-linecap="round"/>
    <line x1="-12" y1="0" x2="44" y2="0" stroke="#4a4f57" stroke-width="4" stroke-linecap="round"/>
    <rect x="-10" y="-3.2" width="12" height="6.4" rx="1.5" fill="#3a2414" stroke="${OL}" stroke-width="1.4"/>
    <circle cx="-13" cy="0" r="3.2" fill="#6e737a" stroke="${OL}" stroke-width="1.4"/>
    ${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M52 0 L${f(52 + Math.cos(a * Math.PI / 180) * 15)} ${f(Math.sin(a * Math.PI / 180) * 15)}" stroke="${OL}" stroke-width="5" stroke-linecap="round"/><path d="M52 0 L${f(52 + Math.cos(a * Math.PI / 180) * 14)} ${f(Math.sin(a * Math.PI / 180) * 14)}" stroke="#8a9098" stroke-width="2.6" stroke-linecap="round"/>`).join('')}
    <circle cx="52" cy="0" r="8.5" fill="#5e636b" stroke="${OL}" stroke-width="2.2"/>
    <circle cx="49.5" cy="-2.5" r="2.4" fill="#b9c0c8"/>`,
  fork: () => `
    <line x1="-46" y1="0" x2="74" y2="0" stroke="${OL}" stroke-width="6.5" stroke-linecap="round"/>
    <line x1="-46" y1="0" x2="74" y2="0" stroke="#b08850" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M72 -10 Q70 0 72 10" stroke="${OL}" stroke-width="5.5" fill="none" stroke-linecap="round"/>
    <path d="M72 -10 Q70 0 72 10" stroke="#8a9098" stroke-width="2.8" fill="none" stroke-linecap="round"/>
    ${[-10, 0, 10].map(y => `<path d="M72 ${y} L98 ${y * 0.9} L102 ${y * 0.9 - 1}" stroke="${OL}" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M72 ${y} L98 ${y * 0.9} L102 ${y * 0.9 - 1}" stroke="#a9b1ba" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}`,
  genghis: () => `
    <line x1="-62" y1="0" x2="96" y2="0" stroke="${OL}" stroke-width="7" stroke-linecap="round"/>
    <line x1="-62" y1="0" x2="96" y2="0" stroke="#5a2a14" stroke-width="4" stroke-linecap="round"/>
    <path d="M-30 -2.5 L-10 -2.5 M-30 2.5 L-10 2.5" stroke="#d4a017" stroke-width="1.4"/>
    <path d="M-66 -4 L-58 -4 L-56 0 L-58 4 L-66 4 Z" fill="#d4a017" stroke="${OL}" stroke-width="1.5"/>
    <path d="M92 -4 L98 -4 L98 4 L92 4 Z" fill="#d4a017" stroke="${OL}" stroke-width="1.5"/>
    <path d="M98 -6 L104 -9 Q130 -14 150 -6 Q156 2 146 12 Q128 30 104 30 L102 20 Q108 14 98 8 Z" fill="#e3e8ee" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M106 -4 Q128 -9 146 -1" stroke="#a9b3bf" stroke-width="1.4" fill="none"/>
    <path d="M104 -9 L100 -16 L108 -10 Z" fill="#e3e8ee" stroke="${OL}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M104 4 Q112 -1 120 4 Q116 10 106 12 Q110 8 104 4 Z" fill="#3d7a4a" stroke="${OL}" stroke-width="1.2"/>
    <circle cx="114" cy="4" r="1.3" fill="#d4a017"/>
    <path d="M94 4 Q86 16 90 26 Q94 18 98 22 Q96 12 98 6 Z" fill="#d0262e" stroke="${OL}" stroke-width="1.5"/>`
};

/* ---------- poses ---------- */
export const POSES = {
  idle0:   { lean: 6,  tilt: 0,   fTh: 28, fSh: -2,  bTh: -22, bSh: -14, fUp: 30,  fFo: 105, bUp: 10,  bFo: 95,  w: -55,  wB: -40 },
  idle1:   { lean: 7,  tilt: 2,   fTh: 34, fSh: -9,  bTh: -28, bSh: -21, fUp: 33,  fFo: 108, bUp: 12,  bFo: 98,  w: -52,  wB: -38 },
  walk0:   { lean: 9,  tilt: 0,   fTh: 40, fSh: 15,  bTh: -30, bSh: -25, fUp: 30,  fFo: 105, bUp: 10,  bFo: 95,  w: -55,  wB: -40 },
  walk1:   { lean: 9,  tilt: 1,   fTh: 15, fSh: -10, bTh: 5,   bSh: -45, fUp: 32,  fFo: 106, bUp: 12,  bFo: 96,  w: -53,  wB: -39 },
  walk2:   { lean: 9,  tilt: 0,   fTh: -25,fSh: -20, bTh: 35,  bSh: 12,  fUp: 30,  fFo: 105, bUp: 10,  bFo: 95,  w: -55,  wB: -40 },
  walk3:   { lean: 9,  tilt: 1,   fTh: 5,  fSh: -45, bTh: 10,  bSh: -8,  fUp: 32,  fFo: 106, bUp: 12,  bFo: 96,  w: -53,  wB: -39 },
  windup:  { lean: -4, tilt: -2,  fTh: 30, fSh: 0,   bTh: -30, bSh: -20, fUp: 160, fFo: 210, bUp: 20,  bFo: 100, w: -160, wB: -60 },
  attack:  { lean: 18, tilt: 4,   fTh: 55, fSh: 5,   bTh: -40, bSh: -35, fUp: 95,  fFo: 92,  bUp: -30, bFo: 10,  w: -5,   wB: 30 },
  guard:   { lean: -4, tilt: 0,   fTh: 22, fSh: 0,   bTh: -26, bSh: -18, fUp: 25,  fFo: 165, bUp: 15,  bFo: 150, w: -95,  wB: -80 },
  jump:    { lean: 8,  tilt: -5,  fTh: 80, fSh: -5,  bTh: 10,  bSh: -50, fUp: 140, fFo: 150, bUp: -40, bFo: 20,  w: -80,  wB: 20 },
  fall:    { lean: 4,  tilt: 0,   fTh: 35, fSh: 15,  bTh: -15, bSh: -25, fUp: 120, fFo: 130, bUp: -60, bFo: -20, w: -60,  wB: 10 },
  jumpAtk: { lean: 20, tilt: 8,   fTh: 75, fSh: 10,  bTh: 0,   bSh: -60, fUp: 100, fFo: 70,  bUp: -50, bFo: 0,   w: 35,   wB: 40 },
  airGuard:{ lean: 0,  tilt: 0,   fTh: 70, fSh: -10, bTh: 20,  bSh: -40, fUp: 25,  fFo: 165, bUp: 15,  bFo: 150, w: -95,  wB: -80 },
  hit:     { lean: -22,tilt: -15, fTh: 15, fSh: -10, bTh: -35, bSh: -20, fUp: -40, fFo: -10, bUp: -60, bFo: -40, w: -150, wB: -150 },
  win:     { lean: -4, tilt: -6,  fTh: 20, fSh: 0,   bTh: -20, bSh: -10, fUp: 170, fFo: 175, bUp: 20,  bFo: 40,  w: -90,  wB: -60 }
};
const LEG_KEYS = ['fTh', 'fSh', 'bTh', 'bSh', 'lean', 'tilt'];

// Key poses for the attack variations, built from each character's own poses so weapon-specific
// grips carry over: from = [poseA, poseB, mix], then `add` offsets and `set` absolute values.
const DERIVED = {
  longWind:  { from: ['idle0', 'windup', 0.55], add: { lean: -4, fTh: -6, bTh: -8 } },
  longAtk:   { from: ['attack', 'attack', 0], add: { lean: 10, fTh: 20, fSh: 10, bTh: -18, bSh: -14 } },
  heavyWind: { from: ['windup', 'windup', 0], add: { lean: -10, tilt: -5, fUp: 12, w: -20, fTh: 4, bTh: -4 } },
  heavyAtk:  { from: ['attack', 'attack', 0], add: { lean: 10, tilt: 8, fUp: 14, w: 42, wB: 30 }, set: { fTh: 62, fSh: 18, bTh: -46, bSh: -58 } },
  flip:      { from: ['jump', 'jump', 0], add: { lean: 12 }, set: { fTh: 115, fSh: 10, bTh: 95, bSh: -10, fUp: 100, fFo: 40, bUp: 80, bFo: 20 } },
  dive:      { from: ['jumpAtk', 'jumpAtk', 0], add: { lean: 24, w: 30, wB: 30 }, set: { fTh: -15, fSh: -55, bTh: -40, bSh: -85 } },
  chargeHold:{ from: ['heavyWind', 'heavyWind', 0], add: { lean: -4, tilt: -3 }, set: { fTh: 48, fSh: -6, bTh: -40, bSh: -30 } },
  airDash:   { from: ['jump', 'jump', 0], add: { lean: 50 }, set: { fTh: -40, fSh: -75, bTh: -62, bSh: -95, fUp: 95, fFo: 100, bUp: 85, bFo: 95 } }
};

// Sprite frames: key poses plus in-betweens [name, from, to, mix] — twice the old frame count.
const FRAME_DEFS = [
  ['idle0'], ['idle01', 'idle0', 'idle1', 0.5], ['idle1'], ['idle10', 'idle1', 'idle0', 0.5],
  ['walk0'], ['walk01', 'walk0', 'walk1', 0.5], ['walk1'], ['walk12', 'walk1', 'walk2', 0.5],
  ['walk2'], ['walk23', 'walk2', 'walk3', 0.5], ['walk3'], ['walk30', 'walk3', 'walk0', 0.5],
  ['windup0', 'idle0', 'windup', 0.5], ['windup'], ['attack'], ['attack1', 'attack', 'idle0', 0.5],
  ['guard0', 'idle0', 'guard', 0.5], ['guard'], ['airGuard'],
  ['jump'], ['apex', 'jump', 'fall', 0.5], ['fall'], ['jumpAtk0', 'jump', 'jumpAtk', 0.5], ['jumpAtk'],
  ['hit'], ['hit0', 'hit', 'idle0', 0.5], ['win'], ['win0', 'win', 'idle0', 0.35],
  ['longWind'], ['longAtk0', 'longWind', 'longAtk', 0.5], ['longAtk'],
  ['heavyWind'], ['heavyAtk0', 'heavyWind', 'heavyAtk', 0.5], ['heavyAtk'],
  ['flip'], ['dive'], ['chargeHold'], ['airDash']
];
const FRAME_BY_NAME = Object.fromEntries(FRAME_DEFS.map(d => [d[0], d]));
export const FRAMES = FRAME_DEFS.map(d => d[0]);

const mix = (a, b, t) => {
  const o = { ...a };
  for (const k of Object.keys(b)) if (typeof b[k] === 'number' && typeof a[k] === 'number') o[k] = a[k] + (b[k] - a[k]) * t;
  return o;
};
const SEATED = { fTh: 62, fSh: 8, bTh: 50, bSh: 0 };

/* ---------- horse (feet at y=0, facing +x) ---------- */
// legs: [frontNear, frontFar, backNear, backFar] as [upper, lower] angles; rear: body rotation
const HORSE_POSES = {
  stand:  { legs: [[6, -4], [-4, -6], [-4, 6], [6, 4]], rear: 0 },
  walk0:  { legs: [[35, 15], [10, -50], [-30, -10], [10, -30]], rear: -1 },
  walk1:  { legs: [[10, -40], [35, 15], [5, -40], [-30, -10]], rear: 0 },
  walk2:  { legs: [[-20, -30], [15, -60], [25, 10], [-10, -50]], rear: 1 },
  walk3:  { legs: [[15, -60], [-20, -30], [-10, -50], [25, 10]], rear: 0 },
  tuck:   { legs: [[55, -75], [45, -85], [-45, 25], [-35, 35]], rear: -4 },
  windup: { legs: [[14, -8], [4, -10], [-8, 4], [0, 2]], rear: -6 },
  attack: { legs: [[30, 10], [20, 0], [-25, -10], [-15, -5]], rear: 4 },
  hit:    { legs: [[-10, -20], [-20, -25], [10, 20], [0, 10]], rear: -8 },
  rear:   { legs: [[70, -40], [55, -70], [8, 4], [-4, -2]], rear: -24 }
};
const HORSE_FOR = { idle0: 'stand', idle1: 'stand', guard: 'stand', airGuard: 'tuck', jump: 'tuck', fall: 'tuck', jumpAtk: 'tuck', win: 'rear' };

const HS = 1.3; // horse drawing scale
export const SADDLE = [-5, -99];

function renderHorse(name, rider) {
  const hp = HORSE_POSES[HORSE_FOR[name] || name] || HORSE_POSES.stand;
  const coat = '#5a3826', dark = shade(coat, 0.72), mane = '#1c1210';
  const hips = [[28, -44], [24, -44], [-30, -44], [-34, -44]];
  const legs = hp.legs.map(([u, l], i) => { const k = P(hips[i], 21, u); return [hips[i], k, P(k, 21, l)]; });
  const leg = ([h, k, a], far) => ln(h, k, 12, OL) + ln(k, a, 9, OL) + ln(h, k, 8, far ? dark : coat) + ln(k, a, 5, far ? dark : coat)
    + `<rect x="${f(a[0] - 4)}" y="${f(a[1] - 3)}" width="8" height="5" rx="1.5" fill="#1a1414" stroke="${OL}" stroke-width="1.5"/>`;
  let s = `<g transform="scale(${HS})"><path d="M-44 -62 Q-58 -50 -62 -24 Q-54 -30 -50 -20 Q-50 -40 -42 -54 Z" fill="${mane}" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/>`;
  s += leg(legs[1], true) + leg(legs[3], true);
  s += `<path d="M-46 -60 Q-48 -40 -30 -38 L28 -38 Q44 -40 42 -58 Q38 -72 20 -72 L-30 -72 Q-46 -72 -46 -60 Z" fill="${coat}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M24 -66 Q32 -92 46 -100 L58 -93 Q46 -76 42 -48 Z" fill="${coat}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M44 -102 Q53 -106 59 -99 L72 -80 Q74 -73 65 -72 L56 -75 Q47 -84 44 -97 Z" fill="${coat}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M47 -101 L48 -112 L53 -102 Z" fill="${coat}" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M22 -68 Q28 -94 46 -104 Q38 -88 36 -70 Z" fill="${mane}" stroke="${OL}" stroke-width="1.8" stroke-linejoin="round"/>
    <circle cx="54" cy="-93" r="2" fill="${OL}"/><circle cx="67" cy="-77" r="1.3" fill="${OL}"/>
    <path d="M50 -98 L66 -78 M58 -86 L48 -80" stroke="#c9a04a" stroke-width="1.8" fill="none"/>
    <path d="M-26 -74 L14 -74 L16 -50 Q-6 -46 -28 -50 Z" fill="#9c1c1c" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M-25 -55 Q-6 -51 15 -55" stroke="#d4a017" stroke-width="2" fill="none"/>
    <path d="M-22 -74 Q-20 -84 -12 -78 L6 -78 Q12 -86 16 -74 Z" fill="#3b2414" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/></g>`;
  s += rider;
  s += `<g transform="scale(${HS})">${leg(legs[0], false) + leg(legs[2], false)}</g>`;
  const ground = (Math.max(...legs.map(l => l[2][1])) + 2) * HS;
  return { svg: `<g transform="translate(0 ${f(-ground)}) rotate(${hp.rear} ${-32 * HS} 0)">${s}</g>`, ground, rear: hp.rear };
}

/* ---------- characters ---------- */
export const CHARS = [
  {
    id: 'sword', name: '알드릭', en: 'Sir Aldric', weaponName: '칼', origin: '잉글랜드 십자군 기사',
    accent: '#c23b3b', skin: '#f1c9a5', body: '#ece6d8', sleeve: '#a7afb8', fore: '#8a929b', pants: '#8f97a0', shin: '#4b5058', cape: '#a3232b',
    torso: c => `<path d="M-10 0 L10 0 L13 13 L-12 13 Z" fill="${c.body}" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M-10 1 L10 1 L12 -27 Q0 -33 -12 -27 Z" fill="${c.body}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M-2 -24 h4 v7 h7 v4 h-7 v10 h-4 v-10 h-7 v-4 h7 z" fill="#b3242c"/>
      <rect x="-11" y="-5" width="22" height="4" fill="#5a3b22"/><rect x="-2" y="-5.5" width="4" height="5" fill="#c9a04a"/>`,
    headFront: c => `<path d="M-13 -27 Q1 -32 15 -27 L16 1 Q1 4 -13 1 Z" fill="#c3cad2" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="2" y="-16" width="14" height="3.2" fill="${OL}"/>
      <rect x="9" y="-27" width="3" height="28" fill="#9aa2ab"/>
      <circle cx="5" cy="-6" r="1" fill="${OL}"/><circle cx="5" cy="-2" r="1" fill="${OL}"/><circle cx="1" cy="-4" r="1" fill="${OL}"/>
      <path d="M-11 -24 Q1 -28 14 -24" stroke="#e8edf2" stroke-width="2" fill="none"/>`
  },
  {
    id: 'spear', name: '이운', en: 'Lee Woon', weaponName: '창', origin: '조선 무관 장군',
    accent: '#2c4f9e', skin: '#eec39a', body: '#b8262b', sleeve: '#24407a', fore: '#1d3463', pants: '#e8e0cf', shin: '#222226', twoHand: true,
    poses: {
      idle0: { fUp: 40, fFo: 80, w: -15 }, windup: { fUp: 45, fFo: 60, w: -8, lean: -6 }, attack: { fUp: 95, fFo: 90, w: 0, lean: 20 }, guard: { w: -65, fFo: 150 },
      jump: { w: -40, fUp: 110, fFo: 120 }, fall: { w: -30, fUp: 90, fFo: 110 }, jumpAtk: { w: 25, fUp: 95, fFo: 75 }, airGuard: { w: -65, fFo: 150 }, win: { w: -95, fUp: 150, fFo: 170 }
    },
    torso: c => { let studs = ''; for (const y of [-21, -15, -9]) for (const x of [-6, 0, 6]) studs += `<circle cx="${x}" cy="${y}" r="1.3" fill="#f0c24b"/>`;
      let s2 = ''; for (const y of [5, 11]) for (const x of [-7, 0, 7]) s2 += `<circle cx="${x}" cy="${y}" r="1.3" fill="#f0c24b"/>`;
      return `<path d="M-11 0 L11 0 L15 18 L-15 18 Z" fill="${c.body}" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M-14 16 L14 16" stroke="#d9a93a" stroke-width="2"/>${s2}
      <path d="M-10 1 L10 1 L12 -27 Q0 -33 -12 -27 Z" fill="${c.body}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M-6 -30 L0 -20 L6 -30" fill="none" stroke="#24407a" stroke-width="4"/>${studs}
      <rect x="-11" y="-5" width="22" height="4" fill="#24407a"/><circle cx="2" cy="-3" r="2.2" fill="#d9a93a"/>`; },
    headBack: c => `<path d="M-13 -16 L-17 6 L-3 6 L-4 -16 Z" fill="#24407a" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/>`,
    headFront: c => `<path d="M6 -5 Q10 -3 15 -6" stroke="${OL}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M-14 -16 Q-13 -33 1 -33 Q15 -33 16 -16 Z" fill="#2a2a2e" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="-14" y="-19" width="30" height="3.5" fill="#d9a93a" stroke="${OL}" stroke-width="1.2"/>
      <path d="M-1 -32 L1 -45 L3 -32 Z" fill="#d9a93a" stroke="${OL}" stroke-width="1.5"/>
      <path d="M1 -43 Q-12 -48 -17 -36 Q-8 -41 -4 -36 Q-4 -41 1 -41 Z" fill="#d0262e" stroke="${OL}" stroke-width="1.5"/>`
  },
  {
    id: 'axe', name: '비요른', en: 'Bjørn', weaponName: '도끼', origin: '노르드 바이킹 족장',
    accent: '#c8642a', skin: '#e3b48f', body: '#5d6e3b', sleeve: '#e3b48f', fore: '#6b4a2e', pants: '#6b5a48', shin: '#9b8a6e', cape: '#7a5c3c',
    poses: {
      idle0: { w: -75, fUp: 15, fFo: 120 }, windup: { fUp: 170, fFo: 215, w: -175, lean: -8 }, attack: { fUp: 110, fFo: 80, w: 25, lean: 24 },
      guard: { w: -100 }, jumpAtk: { w: 60, fUp: 120, fFo: 60 }, win: { w: -70 },
      // axe dive: overhead chop driven down at 45°
      dive: { lean: 30, fUp: 115, fFo: 85, w: 62, fTh: -10, fSh: -50, bTh: -35, bSh: -80 }
    },
    torso: c => `<path d="M-10 0 L10 0 L12 11 L-12 11 Z" fill="${c.body}" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M-11 1 L11 1 L13 -27 Q0 -34 -13 -27 Z" fill="${c.body}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M-12 -14 L12 -18" stroke="#46552a" stroke-width="2"/>
      <rect x="-12" y="-6" width="24" height="5" fill="#3b2a1a"/><rect x="-1" y="-7" width="6" height="7" rx="1" fill="#d9a93a" stroke="${OL}" stroke-width="1"/>
      <ellipse cx="-2" cy="-28" rx="15" ry="6" fill="#8b6b47" stroke="${OL}" stroke-width="2"/>`,
    headFront: c => `<path d="M-3 -9 Q0 3 9 10 Q17 6 16 -7 Q8 -3 -3 -9 Z" fill="#c8642a" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M4 -6 Q10 -4 16 -7" stroke="#a24f1f" stroke-width="2" fill="none"/>
      <path d="M-14 -15 Q-13 -31 1 -31 Q16 -31 16 -15 Z" fill="#8e9399" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="-14" y="-17" width="30" height="3.5" fill="#6f747a" stroke="${OL}" stroke-width="1.2"/>
      <rect x="11.5" y="-17" width="3.5" height="11" rx="1" fill="#8e9399" stroke="${OL}" stroke-width="1.5"/>
      <path d="M-8 -28 Q0 -31 8 -28" stroke="#c4c8cd" stroke-width="2" fill="none"/>`
  },
  {
    id: 'dagger', name: '자라', en: 'Zahra', weaponName: '단검', origin: '페르시아 사막의 암살자',
    accent: '#a52a2a', skin: '#c99872', body: '#2e3452', sleeve: '#2e3452', fore: '#d8c7a0', pants: '#3b4163', shin: '#7a5534', dual: true,
    poses: {
      idle0: { w: 15, wB: 25, fUp: 45, fFo: 95, bUp: 35, bFo: 85 }, windup: { fUp: 60, fFo: 60, w: -10, wB: 20, lean: 10, bUp: 30, bFo: 90 },
      attack: { fUp: 100, fFo: 100, w: 5, lean: 26, fTh: 62, bTh: -45 },
      guard: { w: -115, wB: -65 }, airGuard: { w: -115, wB: -65 }, jumpAtk: { w: 45, wB: 50 }, win: { w: -90, wB: -20 },
      // blade dive: both daggers point 45° down-forward, body stretched behind them
      dive: { lean: 36, fUp: 75, fFo: 65, bUp: 65, bFo: 55, w: 18, wB: 22, fTh: -20, fSh: -60, bTh: -42, bSh: -88 }
    },
    torso: c => `<path d="M-10 0 L10 0 L15 16 L-12 16 Z" fill="${c.body}" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M-10 1 L10 1 L12 -27 Q0 -33 -12 -27 Z" fill="${c.body}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M2 -29 L-6 -6" stroke="#5a4a7a" stroke-width="2"/>
      <path d="M-11 -9 L11 -9 L11 -3 L-11 -3 Z" fill="#a52a2a" stroke="${OL}" stroke-width="1.5"/>
      <path d="M-10 -6 Q-20 -2 -24 8 L-19 9 Q-16 1 -9 -3 Z" fill="#a52a2a" stroke="${OL}" stroke-width="1.5"/>`,
    headBack: c => `<path d="M-6 -24 Q-22 -18 -20 4 L-8 -2 Z" fill="#262b45" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/>`,
    headFront: c => `<path d="M3 -10 L16 -11 Q16 -1 5 1 Q2 -4 3 -10 Z" fill="#d9c79e" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M-15 -8 Q-17 -32 3 -30 Q18 -29 16 -17 L11 -19 Q5 -23 -1 -19 Q-5 -13 -4 2 L-13 2 Z" fill="#262b45" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M7 -17 L13 -16" stroke="${OL}" stroke-width="1.5"/>`
  },
  {
    id: 'fist', name: '혜명', en: 'Huiming', weaponName: '맨손', origin: '소림사 무승',
    accent: '#e58a1f', skin: '#efc29b', body: '#e58a1f', sleeve: '#e58a1f', fore: '#efc29b', pants: '#f2c467', shin: '#efe8d8',
    poses: {
      idle0: { fUp: 50, fFo: 145, bUp: 40, bFo: 150 }, windup: { fUp: 40, fFo: 150, bUp: 60, bFo: 120, lean: 4 },
      attack: { fUp: 92, fFo: 90, bUp: 30, bFo: 150, lean: 14 },
      guard: { fUp: 20, fFo: 170, bUp: 25, bFo: 165 }, airGuard: { fUp: 20, fFo: 170, bUp: 25, bFo: 165 },
      jump: { fUp: 120, fFo: 170, bUp: -30, bFo: 30 }, fall: { fUp: 60, fFo: 140, bUp: -40, bFo: 20 },
      jumpAtk: { lean: -8, fTh: 100, fSh: 95, bTh: -10, bSh: -70, fUp: 40, fFo: 150, bUp: -50, bFo: -20 },
      win: { fUp: 175, fFo: 180, bUp: 40, bFo: 150 },
      // flying kick: lead leg locked 45° down-forward, rear leg tucked, fists up
      dive: { lean: -14, tilt: -6, fTh: 48, fSh: 46, bTh: 105, bSh: -15, fUp: 40, fFo: 150, bUp: 25, bFo: 140 }
    },
    torso: c => { let beads = ''; for (let i = 0; i < 7; i++) { const a = (-150 + i * 22) * Math.PI / 180; beads += `<circle cx="${f(Math.cos(a) * 9)}" cy="${f(-24 + Math.sin(a) * -7)}" r="1.8" fill="#6b3a1e" stroke="${OL}" stroke-width=".8"/>`; }
      return `<path d="M-10 0 L10 0 L12 9 L-12 9 Z" fill="${c.body}" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M-10 1 L10 1 L12 -27 Q0 -33 -12 -27 Z" fill="${c.body}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M-11 -26 L-4 -28 L11 -4 L5 -1 Z" fill="#9c2f1b" stroke="${OL}" stroke-width="1.5" stroke-linejoin="round"/>
      <rect x="-11" y="-5" width="22" height="4" fill="#f2c467" stroke="${OL}" stroke-width="1"/>${beads}`; },
    headFront: c => `<circle cx="-4" cy="-13" r="3.2" fill="${c.skin}" stroke="${OL}" stroke-width="1.6"/>
      ${[[-5, -24], [0, -25.5], [5, -24], [-2.5, -21], [2.5, -21], [7, -21]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="#8a5a3a"/>`).join('')}
      <path d="M6 -18 L13 -17" stroke="${OL}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M8 -6 L12 -6" stroke="${OL}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M-11 -22 Q-6 -27 2 -27" stroke="#fbe0c6" stroke-width="2" fill="none"/>`
  },
  {
    id: 'stag', name: '루카누스', en: 'Lucanus', weaponName: '큰 턱', origin: '고목 숲의 사슴벌레 전사',
    accent: '#9a5a22', skin: '#4a2c17', body: '#3a2214', sleeve: '#5b351c', fore: '#2e1a0e', pants: '#4a2c17', shin: '#2a180c',
    poses: {
      idle0: { fUp: 40, fFo: 120, bUp: 30, bFo: 110 }, windup: { jaw: 48, lean: -8, tilt: -6, fUp: 20, fFo: 140, bUp: 10, bFo: 130 },
      attack: { jaw: 2, lean: 30, tilt: 12, fUp: 60, fFo: 100, bUp: 40, bFo: 90 },
      guard: { jaw: 6, fUp: 20, fFo: 165, bUp: 25, bFo: 160 }, airGuard: { jaw: 6, fUp: 20, fFo: 165, bUp: 25, bFo: 160 },
      jumpAtk: { jaw: 4, lean: 26, tilt: 14 }, hit: { jaw: 34 }, win: { jaw: 52, fUp: 170, fFo: 175, bUp: 160, bFo: 175, tilt: -14 },
      airDash: { jaw: 44, tilt: -30 }
    },
    back: c => `<path d="M-4 -31 Q-28 -24 -26 12 Q-16 20 -4 8 Z" fill="#6b3d1c" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M-8 -26 Q-20 -18 -20 4" stroke="#a8703c" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    torso: c => `<path d="M-10 0 L10 0 L12 12 L-12 12 Z" fill="${c.body}" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M-10 1 L10 1 L12 -27 Q0 -33 -12 -27 Z" fill="#5b351c" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M-11 -18 Q0 -15 11 -19 M-10 -9 Q0 -6 11 -10" stroke="${OL}" stroke-width="1.6" fill="none"/>
      <path d="M2 -27 Q8 -22 7 -12" stroke="#a8703c" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    headFront: (c, p) => {
      const jaw = `<path d="M0 -3.5 Q18 -9 34 -3 Q43 2 45 11 Q37 5 31 6 L28 2 L25 8 L20 3.5 Q10 4 0 3.5 Z" fill="#6b3d1c" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M6 -3 Q20 -6 33 -1" stroke="#b07a44" stroke-width="1.6" fill="none"/>`;
      return `<path d="M-3 -27 Q-6 -40 2 -44 L3 -43 Q-3 -38 0 -28 Z M2 -44 L10 -46" stroke="${OL}" stroke-width="2.2" fill="#2a180c" stroke-linejoin="round"/>
      <path d="M-14 -18 Q-12 -31 3 -30 Q17 -29 17 -15 Q16 -1 4 1 Q-13 1 -14 -18 Z" fill="#3a2214" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M-8 -26 Q2 -30 12 -25" stroke="#8a5a2b" stroke-width="2" fill="none"/>
      <ellipse cx="10" cy="-17" rx="3.4" ry="3" fill="#e0a21a" stroke="${OL}" stroke-width="1.5"/>
      <g transform="translate(14 -9) rotate(${-p.jaw / 2 - 6})">${jaw}</g>
      <g transform="translate(14 -7) rotate(${p.jaw / 2 + 10}) scale(1 -1)">${jaw}</g>`;
    }
  },
  {
    id: 'genghis', name: '칭기즈 칸', en: 'Genghis Khan', weaponName: '청룡언월도', origin: '몽골 제국의 대칸',
    accent: '#d4a017', skin: '#dcae84', body: '#8a1f1f', sleeve: '#8a1f1f', fore: '#6a1414', pants: '#2f3a5a', shin: '#2a1a10', cape: '#2a3350',
    twoHand: true, mount: true, cell: [360, 300], cellOrigin: [150, 280],
    poses: {
      idle0: { fUp: 40, fFo: 70, w: -40 }, windup: { fUp: 150, fFo: 190, w: -150, lean: -8 }, attack: { fUp: 95, fFo: 85, w: 5, lean: 16 },
      guard: { w: -80, fUp: 30, fFo: 150 }, airGuard: { w: -80, fUp: 30, fFo: 150 }, jump: { w: -50 }, fall: { w: -40 },
      jumpAtk: { w: 20, fUp: 100, fFo: 80 }, win: { w: -100, fUp: 160, fFo: 175 }
    },
    torso: c => `<path d="M-11 0 L11 0 L14 14 L-14 14 Z" fill="${c.body}" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M-11 1 L11 1 L13 -27 Q0 -34 -13 -27 Z" fill="${c.body}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M-6 -30 L9 -4" stroke="#d4a017" stroke-width="3"/>
      <rect x="-12" y="-6" width="24" height="5" fill="#2f3a5a" stroke="${OL}" stroke-width="1"/><circle cx="2" cy="-3.5" r="2.4" fill="#d4a017"/>
      <ellipse cx="-1" cy="-28" rx="15" ry="5.5" fill="#7a5a3a" stroke="${OL}" stroke-width="2"/>`,
    headBack: c => `<path d="M-13 -18 Q-21 -4 -13 8 L-4 1 L-4 -18 Z" fill="#7a5a3a" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/>`,
    headFront: c => `<path d="M3 -6 Q10 -2 16 -6 Q15 6 9 12 Q5 6 3 1 Z" fill="#2a1a12" stroke="${OL}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M7 -7 Q14 -9 18 -1" stroke="#2a1a12" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M-14 -17 Q-13 -34 1 -36 Q15 -34 16 -17 Z" fill="#b08a3a" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M-8 -30 Q1 -34 10 -30" stroke="#ecd38a" stroke-width="2" fill="none"/>
      <rect x="-15" y="-21" width="32" height="6" rx="3" fill="#7a5a3a" stroke="${OL}" stroke-width="1.5"/>
      <path d="M-1 -35 L1 -49 L3 -35 Z" fill="#d4a017" stroke="${OL}" stroke-width="1.5"/>
      <path d="M1 -45 Q-11 -47 -15 -36 Q-7 -41 -3 -38 Z" fill="#d0262e" stroke="${OL}" stroke-width="1.5"/>
      <path d="M7 -15 L13 -14" stroke="${OL}" stroke-width="2" stroke-linecap="round"/>`
  },
  {
    id: 'mace', name: '모르드레드', en: 'Mordred', weaponName: '철퇴', origin: '중갑옷의 흑기사',
    accent: '#6a1a22', skin: '#d8b090', body: '#2b2d33', sleeve: '#3a3d45', fore: '#2b2d33', pants: '#33363e', shin: '#1d1f24', cape: '#4a0e14',
    poses: {
      idle0: { w: -60, fUp: 20, fFo: 110 }, windup: { fUp: 165, fFo: 210, w: -170, lean: -8 }, attack: { fUp: 105, fFo: 85, w: 20, lean: 22 },
      guard: { w: -95 }, jumpAtk: { w: 55, fUp: 115, fFo: 65 }, win: { w: -80, fUp: 170, fFo: 175 }
    },
    torso: c => `<path d="M-11 0 L11 0 L14 14 L-14 14 Z" fill="${c.pants}" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M-13 14 L-9 4 L-5 14 M-1 14 L3 4 L7 14" stroke="#1d1f24" stroke-width="1.6" fill="none"/>
      <path d="M-11 1 L11 1 L14 -27 Q0 -35 -14 -27 Z" fill="${c.body}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M-6 -27 Q0 -22 6 -27 M-11 -15 Q0 -11 12 -15" stroke="#4d515a" stroke-width="2" fill="none"/>
      <path d="M2 -24 Q8 -20 8 -8" stroke="#6b707a" stroke-width="2" fill="none" stroke-linecap="round"/>
      ${[[-8, -19], [8, -19], [-8, -7], [8, -7]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#8a9098"/>`).join('')}
      <rect x="-12" y="-5" width="24" height="4.5" fill="#1d1f24" stroke="${OL}" stroke-width="1"/><rect x="-2" y="-5.5" width="5" height="5.5" fill="#8a1a22"/>
      <ellipse cx="-11" cy="-27" rx="7" ry="5" fill="#3a3d45" stroke="${OL}" stroke-width="2"/>`,
    headFront: c => `<path d="M-14 -26 Q1 -33 16 -26 L17 2 Q1 5 -14 2 Z" fill="#2b2d33" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M3 -17 L17 -17 M3 -12 L17 -12" stroke="#0c0d10" stroke-width="2.8"/>
      <path d="M-11 -24 Q1 -29 14 -24" stroke="#5a5f68" stroke-width="2" fill="none"/>
      <path d="M8 -26 L8 1" stroke="#3f434b" stroke-width="2.4"/>
      ${[[11, -6], [14, -6], [11, -2], [14, -2]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="#0c0d10"/>`).join('')}
      <path d="M-2 -30 Q-8 -46 -24 -42 Q-14 -40 -12 -34 Q-20 -36 -26 -30 Q-12 -30 -4 -28 Z" fill="#8a1a22" stroke="${OL}" stroke-width="1.6" stroke-linejoin="round"/>`
  },
  {
    id: 'fork', name: '얀', en: 'Jan', weaponName: '갈퀴', origin: '네덜란드 농부',
    accent: '#e08a1e', skin: '#f2c8a0', body: '#3b6db3', sleeve: '#3b6db3', fore: '#f2c8a0', pants: '#2f4a7a', shin: '#d9a441', twoHand: true,
    poses: {
      idle0: { fUp: 40, fFo: 80, w: -15 }, windup: { fUp: 45, fFo: 60, w: -8, lean: -6 }, attack: { fUp: 95, fFo: 90, w: 0, lean: 20 }, guard: { w: -65, fFo: 150 },
      jump: { w: -40, fUp: 110, fFo: 120 }, fall: { w: -30, fUp: 90, fFo: 110 }, jumpAtk: { w: 25, fUp: 95, fFo: 75 }, airGuard: { w: -65, fFo: 150 },
      win: { w: -100, fUp: 160, fFo: 175 }
    },
    torso: c => `<path d="M-11 0 L11 0 L13 13 L-13 13 Z" fill="${c.pants}" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M-11 1 L11 1 L12 -27 Q0 -33 -12 -27 Z" fill="${c.body}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M-6 -2 L-5 -27 M5 -2 L4 -27" stroke="#2f4a7a" stroke-width="3"/>
      <circle cx="-5" cy="-10" r="1.3" fill="#e8e0c8"/><circle cx="4" cy="-10" r="1.3" fill="#e8e0c8"/>
      <path d="M-7 -29 L0 -21 L7 -29 Z" fill="#d23a2a" stroke="${OL}" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="-1" cy="-25" r="1" fill="#fff"/><circle cx="3" cy="-27" r="1" fill="#fff"/>`,
    headFront: c => `<path d="M-13 -18 Q-14 -10 -11 -4" stroke="#e8c45a" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M9 -7 Q12 -4 15 -6" stroke="${OL}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <circle cx="12" cy="-9" r="2.4" fill="#f0a890" opacity=".7"/>
      <path d="M-22 -22 Q1 -30 26 -22 Q1 -18 -22 -22 Z" fill="#e8c86a" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M-12 -23 Q-11 -37 1 -37 Q13 -37 14 -23 Z" fill="#e8c86a" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M-12 -25 Q1 -28 14 -25" stroke="#c23a2a" stroke-width="3" fill="none"/>
      <path d="M-8 -33 Q1 -35 10 -33" stroke="#f5e2a0" stroke-width="1.6" fill="none"/>`
  }
];

/* ---------- the farmer's bull (feet at y=0, facing +x) ---------- */
const BULL_LEGS = [
  [[30, 10], [5, -40], [-30, -10], [5, -35]], [[5, -45], [30, 10], [0, -40], [-30, -10]],
  [[-25, -30], [15, -60], [25, 5], [-10, -45]], [[15, -60], [-25, -30], [-10, -45], [25, 5]]
];
export const BULL_FRAMES = BULL_LEGS.length;
export function renderBull(frame) {
  const hide = '#3a2418', dark = shade(hide, 0.7);
  const hips = [[30, -36], [26, -36], [-34, -38], [-38, -38]];
  const legs = BULL_LEGS[frame].map(([u, l], i) => { const k = P(hips[i], 18, u); return [hips[i], k, P(k, 18, l)]; });
  const leg = ([h, k, a], far) => ln(h, k, 14, OL) + ln(k, a, 10, OL) + ln(h, k, 10, far ? dark : hide) + ln(k, a, 6, far ? dark : hide)
    + `<rect x="${f(a[0] - 5)}" y="${f(a[1] - 3)}" width="10" height="5" rx="1.5" fill="#141010" stroke="${OL}" stroke-width="1.5"/>`;
  let s = `<path d="M-52 -58 Q-66 -48 -62 -28 L-58 -30 Q-60 -44 -50 -52 Z" fill="${hide}" stroke="${OL}" stroke-width="2"/>
    <path d="M-64 -30 Q-68 -24 -62 -20 Q-60 -26 -60 -30 Z" fill="#141010"/>`;
  s += leg(legs[1], true) + leg(legs[3], true);
  s += `<path d="M-54 -50 Q-56 -32 -40 -30 L30 -30 Q48 -32 50 -50 Q50 -74 30 -78 Q0 -84 -30 -74 Q-52 -68 -54 -50 Z" fill="${hide}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M10 -78 Q30 -86 44 -74 L50 -56 Q40 -70 14 -72 Z" fill="${dark}"/>
    <path d="M44 -66 Q58 -70 70 -58 L74 -42 Q72 -32 62 -32 Q52 -34 46 -44 Z" fill="${hide}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M62 -36 Q70 -34 74 -40" stroke="#c99a7a" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="70" cy="-38" r="3.2" fill="none" stroke="#d4a017" stroke-width="2"/>
    <circle cx="60" cy="-54" r="2.6" fill="#ff3a2a" stroke="${OL}" stroke-width="1"/>
    <path d="M56 -64 Q48 -76 56 -86 Q58 -76 64 -70 Z" fill="#efe6cf" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M64 -64 Q72 -78 84 -78 Q74 -72 70 -62 Z" fill="#efe6cf" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M74 -40 Q82 -44 86 -40 M74 -36 Q82 -34 86 -30" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>`;
  s += leg(legs[0], false) + leg(legs[2], false);
  const ground = Math.max(...legs.map(l => l[2][1])) + 2;
  return `<g transform="translate(0 ${f(-ground)})">${s}</g>`;
}

function poseFor(c, name) {
  const ov = c.poses || {};
  const d = FRAME_BY_NAME[name];
  if (d && d.length > 1) return mix(poseFor(c, d[1]), poseFor(c, d[2]), d[3]);
  if (DERIVED[name]) {
    const { from: [a, b, t], add = {}, set = {} } = DERIVED[name];
    const p = mix(poseFor(c, a), poseFor(c, b), t);
    for (const [k, v] of Object.entries(add)) p[k] = (p[k] ?? 0) + v;
    return Object.assign(p, set, c.mount ? SEATED : {}, ov[name] || {});
  }
  const p = Object.assign({ jaw: 16 }, POSES[name], c.mount ? SEATED : {});
  // idle arm/weapon overrides carry over to the idle bob and walk cycle
  if (name !== 'idle0' && (name.startsWith('idle') || name.startsWith('walk')) && ov.idle0) {
    for (const [k, v] of Object.entries(ov.idle0)) if (!LEG_KEYS.includes(k)) p[k] = v;
  }
  return Object.assign(p, ov[name] || {});
}

export function renderChar(c, poseName, opts = {}) {
  const p = poseFor(c, poseName);
  const H = [0, 0], T = v => add(H, rot(v, p.lean));
  const neck = T([0, -30]), shF = T([2, -26]), shB = T([-2, -26]), hipF = T([3, -1]), hipB = T([-3, -1]);
  const kF = P(hipF, 23, p.fTh), aF = P(kF, 23, p.fSh), kB = P(hipB, 23, p.bTh), aB = P(kB, 23, p.bSh);
  const elF = P(shF, 19, p.fUp), hF = P(elF, 18, p.fFo);
  let elB, hB;
  if (c.twoHand) [elB, hB] = ik(shB, add(hF, rot([-30, 0], p.w)), 19, 18);
  else { elB = P(shB, 19, p.bUp); hB = P(elB, 18, p.bFo); }
  const ground = c.mount ? 0 : Math.max(aF[1], aB[1]) + 4;
  const handR = c.id === 'fist' ? 6 : 4.5;
  const fistWrap = c.id === 'fist' ? '#f4efe4' : c.skin;
  const dk = col => shade(col, 0.78);

  const leg = (hip, k, a, d) => {
    const toe = [a[0] + 8, a[1] + 1.5], cp = d ? dk(c.pants) : c.pants, cs = d ? dk(c.shin) : c.shin;
    return ln(hip, k, 13, OL) + ln(k, a, 12, OL) + ln(a, toe, 11, OL) + ln(hip, k, 9, cp) + ln(k, a, 8, cs) + ln(a, toe, 7, cs);
  };
  const arm = (sh, el, h, d) => ln(sh, el, 12, OL) + ln(el, h, 11, OL) + ln(sh, el, 8, d ? dk(c.sleeve) : c.sleeve) + ln(el, h, 7, d ? dk(c.fore) : c.fore);
  const hand = (h, d) => `<circle cx="${f(h[0])}" cy="${f(h[1])}" r="${handR}" fill="${d ? dk(fistWrap) : fistWrap}" stroke="${OL}" stroke-width="2"/>`;
  const weapon = (h, ang) => `<g transform="translate(${f(h[0])} ${f(h[1])}) rotate(${ang})">${WEAPONS[c.id]()}</g>`;

  let s = '';
  if (c.back) s += `<g transform="rotate(${p.lean})">${c.back(c)}</g>`;
  if (c.cape) s += `<g transform="rotate(${p.lean})"><path d="M-8 -28 Q-22 -8 -24 16 L-14 18 L-4 8 Z" fill="${c.cape}" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/></g>`;
  s += arm(shB, elB, hB, true);
  if (c.dual) s += weapon(hB, p.wB);
  s += hand(hB, true);
  s += leg(hipB, kB, aB, true) + leg(hipF, kF, aF, false);
  s += `<g transform="rotate(${p.lean})">${c.torso(c)}</g>`;
  s += `<g transform="translate(${f(neck[0])} ${f(neck[1])}) rotate(${p.lean + p.tilt})">
      ${c.headBack ? c.headBack(c) : ''}
      <line x1="0" y1="2" x2="1" y2="-8" stroke="${OL}" stroke-width="11"/><line x1="0" y1="2" x2="1" y2="-8" stroke="${c.skin}" stroke-width="7"/>
      <circle cx="1" cy="-13" r="14" fill="${c.skin}" stroke="${OL}" stroke-width="3"/>
      <ellipse cx="9.5" cy="-13" rx="1.8" ry="2.5" fill="${OL}"/>
      ${c.headFront(c, p)}</g>`;
  if (!opts.noFront) s += arm(shF, elF, hF, false) + weapon(hF, p.w) + hand(hF, false);
  const headPos = add(neck, rot([1, -13], p.lean + p.tilt));
  if (c.mount) {
    const h = renderHorse(poseName, `<g transform="translate(${SADDLE[0]} ${SADDLE[1]})">${s}</g>`);
    const hp = rot(add(add(headPos, SADDLE), [32 * HS, 0]), h.rear);
    return { svg: h.svg, head: [hp[0] - 32 * HS, hp[1] - h.ground] };
  }
  return { svg: `<g transform="translate(0 ${f(-ground)})">${s}</g>`, head: [headPos[0], headPos[1] - ground] };
}
