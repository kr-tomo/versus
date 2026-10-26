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
  fist: () => ''
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
export const FRAMES = Object.keys(POSES);
const LEG_KEYS = ['fTh', 'fSh', 'bTh', 'bSh', 'lean', 'tilt'];

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
      guard: { w: -100 }, jumpAtk: { w: 60, fUp: 120, fFo: 60 }, win: { w: -70 }
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
      guard: { w: -115, wB: -65 }, airGuard: { w: -115, wB: -65 }, jumpAtk: { w: 45, wB: 50 }, win: { w: -90, wB: -20 }
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
      win: { fUp: 175, fFo: 180, bUp: 40, bFo: 150 }
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
  }
];

function poseFor(c, name) {
  const ov = c.poses || {};
  const p = Object.assign({}, POSES[name]);
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
  const ground = Math.max(aF[1], aB[1]) + 4;
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
      ${c.headFront(c)}</g>`;
  if (!opts.noFront) s += arm(shF, elF, hF, false) + weapon(hF, p.w) + hand(hF, false);
  const headPos = add(neck, rot([1, -13], p.lean + p.tilt));
  return { svg: `<g transform="translate(0 ${f(-ground)})">${s}</g>`, head: [headPos[0], headPos[1] - ground] };
}
