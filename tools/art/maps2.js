// Map art for the panokseon deck, library, Rome and Egypt. Same layer contract as maps.js.
// trapTop: room above the ground the trap art needs (default 70).
import { OL, f, rng } from './rig.js';

const G = 316;

/* ---------- Joseon panokseon deck: islands with hanok, a turtle ship at sea ---------- */
const hanok = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
  <rect x="-22" y="-14" width="44" height="14" fill="#e8dcc0" stroke="#3a2a1e" stroke-width="1.5"/>
  <path d="M-12 -14 v14 M0 -14 v14 M12 -14 v14" stroke="#7a4a2a" stroke-width="2"/>
  <path d="M-34 -14 Q-20 -18 -16 -28 L16 -28 Q20 -18 34 -14 Q38 -20 36 -24 Q28 -18 22 -20 L18 -32 L-18 -32 L-22 -20 Q-28 -18 -36 -24 Q-38 -20 -34 -14 Z" fill="#3a3f4a" stroke="#1e2128" stroke-width="1.5"/>
  <path d="M-26 -18 Q0 -22 26 -18" stroke="#5a606c" stroke-width="1.5" fill="none"/></g>`;

const turtleShip = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M-110 0 Q-100 22 -60 26 L70 26 Q104 22 114 0 Z" fill="#6a4426" stroke="#2a1a10" stroke-width="2.5"/>
  ${Array.from({ length: 9 }, (_, i) => `<line x1="${-80 + i * 20}" y1="20" x2="${-90 + i * 20}" y2="44" stroke="#4a2e18" stroke-width="3"/>`).join('')}
  <path d="M-96 0 Q-90 -34 -40 -42 L50 -42 Q96 -34 102 0 Z" fill="#7a5a34" stroke="#2a1a10" stroke-width="2.5"/>
  ${Array.from({ length: 6 }, (_, r) => Array.from({ length: 12 }, (_, i) => `<path d="M${-82 + i * 15 + (r % 2) * 7} ${-6 - r * 6} l4 -6 l4 6" fill="#b9bec6" stroke="#2a1a10" stroke-width=".8"/>`).join('')).join('')}
  <path d="M-96 0 L102 0" stroke="#c23a2a" stroke-width="3"/>
  ${Array.from({ length: 6 }, (_, i) => `<rect x="${-70 + i * 26}" y="6" width="10" height="8" fill="#1e140c"/>`).join('')}
  <path d="M102 -6 Q122 -16 132 -32 Q146 -34 150 -24 Q140 -18 146 -8 Q130 -4 118 4 Z" fill="#d8a43a" stroke="#2a1a10" stroke-width="2"/>
  <circle cx="140" cy="-26" r="2.4" fill="#c21a1a"/><path d="M146 -14 l10 -2 M146 -10 l9 3" stroke="#e86a2a" stroke-width="2"/>
  <path d="M-10 -42 L-8 -110 M-8 -104 Q30 -98 34 -56 L-6 -52 Z" stroke="#4a2e18" stroke-width="3" fill="#efe6cf"/>
  <path d="M-8 -104 Q-40 -98 -44 -58 L-10 -52 Z" fill="#e2d8bf" stroke="#4a2e18" stroke-width="2"/>
  <path d="M-8 -110 l-14 -6 l14 -4" fill="#c23a2a"/></g>`;

const ship = {
  extras: { ropes: '#b89a6a' },
  far() {
    const r = rng(61); let s = `<defs>
      <linearGradient id="shSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb6e6"/><stop offset=".7" stop-color="#cfe6f2"/><stop offset="1" stop-color="#f4e6c8"/></linearGradient>
      <linearGradient id="shSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f8ab8"/><stop offset="1" stop-color="#1d4a72"/></linearGradient></defs>
      <rect width="1280" height="360" fill="url(#shSky)"/>`;
    for (let i = 0; i < 6; i++) s += `<ellipse cx="${f(r() * 1280)}" cy="${f(30 + r() * 70)}" rx="${f(50 + r() * 50)}" ry="${f(12 + r() * 8)}" fill="#fff" opacity=".75"/>`;
    s += `<rect y="196" width="1280" height="164" fill="url(#shSea)"/>
      <path d="M-20 200 Q90 120 200 150 Q260 110 330 140 Q380 176 440 200 Z" fill="#4f7a4a"/>
      <path d="M760 200 Q840 130 930 150 Q1010 100 1100 140 Q1180 160 1300 200 Z" fill="#557f4e"/>
      <path d="M-20 200 Q100 168 200 174 Q300 160 440 200 Z" fill="#3e6a3c"/>`;
    s += hanok(150, 170, 1) + hanok(240, 160, 0.8) + hanok(310, 176, 0.7) + hanok(880, 160, 0.9) + hanok(980, 146, 1) + hanok(1080, 162, 0.8);
    s += `<path d="M120 172 Q160 150 200 172" stroke="#c2a26a" stroke-width="2" fill="none" opacity=".6"/>`;
    for (let i = 0; i < 30; i++) s += `<path d="M${f(r() * 1280)} ${f(208 + r() * 90)} q8 -4 16 0" stroke="#9fd0ea" stroke-width="1.6" fill="none" opacity=".8"/>`;
    s += turtleShip(600, 212, 0.9);
    s += `<path d="M560 236 q40 6 80 0 q40 6 90 0" stroke="#cfe8f5" stroke-width="2" fill="none" opacity=".8"/>`;
    // deck railing of our own ship in the foreground
    s += `<rect y="262" width="1280" height="54" fill="#5a3a20"/><rect y="262" width="1280" height="8" fill="#7a5230" stroke="#2a1a10" stroke-width="2"/>
      ${Array.from({ length: 33 }, (_, i) => `<rect x="${i * 40 + 6}" y="270" width="8" height="46" fill="#6a4426" stroke="#2a1a10" stroke-width="1.5"/>`).join('')}
      ${Array.from({ length: 8 }, (_, i) => `<g transform="translate(${80 + i * 160} 262)"><rect x="-10" y="-30" width="20" height="30" fill="${['#c23a2a', '#2a55b0', '#e0a82a', '#2e7d4a'][i % 4]}" stroke="#2a1a10" stroke-width="1.5"/><line x1="-10" y1="-30" x2="-10" y2="-44" stroke="#4a2e18" stroke-width="2"/></g>`).join('')}`;
    return s;
  },
  ground() {
    let s = `<rect y="${G}" width="1280" height="44" fill="#9a6a3c"/><rect y="${G}" width="1280" height="4" fill="#c08a52"/>`;
    for (let y = G + 11; y < G + 44; y += 11) s += `<line x1="0" y1="${y}" x2="1280" y2="${y}" stroke="#6a4426" stroke-width="1.5"/>`;
    for (let row = 0; row < 4; row++) for (let x = (row % 2) * 60; x < 1280; x += 120) s += `<line x1="${x}" y1="${G + row * 11}" x2="${x}" y2="${G + row * 11 + 11}" stroke="#6a4426" stroke-width="1.5"/><circle cx="${x + 6}" cy="${G + row * 11 + 5.5}" r="1.2" fill="#3a2414"/>`;
    return s;
  },
  trap(w, fr) {
    const r = rng(70 + fr);
    let s = `<rect x="0" y="0" width="${w}" height="44" fill="#2a1a12"/>`;
    for (let x = 0; x < w; x += 18) s += `<rect x="${x}" y="1" width="16" height="10" fill="#3a2214" stroke="#160c08" stroke-width="1"/><path d="M${x + 3} 6 l6 -2 l4 3" stroke="#ff7a1a" stroke-width="1.4" fill="none"/>`;
    for (let i = 0; i < 4; i++) {
      const x = 10 + i * (w - 20) / 3, h = 26 + r() * 14 + (fr ? 6 : 0);
      s += `<path d="M${f(x - 10)} 2 Q${f(x - 12)} ${f(-h * 0.5)} ${f(x + (fr ? 3 : -3))} ${f(-h)} Q${f(x + 4)} ${f(-h * 0.55)} ${f(x + 11)} 2 Z" fill="#ff7a1a" stroke="#c2410c" stroke-width="1.4"/>
        <path d="M${f(x - 5)} 2 Q${f(x - 5)} ${f(-h * 0.3)} ${f(x + (fr ? -1 : 2))} ${f(-h * 0.62)} Q${f(x + 3)} ${f(-h * 0.3)} ${f(x + 6)} 2 Z" fill="#ffd23f"/>`;
    }
    if (fr) s += `<circle cx="${f(w * .3)}" cy="-40" r="2" fill="#ffb347"/><circle cx="${f(w * .7)}" cy="-48" r="1.6" fill="#ffe066"/>`;
    return s;
  },
  platform(w) {
    return `<rect x="0" y="0" width="${w}" height="14" rx="3" fill="#8a5a30" stroke="#2a1a10" stroke-width="2.5"/>
      <path d="M4 3 h${w - 8}" stroke="#b07a44" stroke-width="2.5"/>
      ${[12, w - 18].map(x => `<rect x="${x}" y="-3" width="6" height="20" rx="1.5" fill="#4a2e18" stroke="#2a1a10" stroke-width="1.5"/>`).join('')}
      <path d="M20 14 q${(w - 40) / 2} 14 ${w - 40} 0" stroke="#c8a46a" stroke-width="2" fill="none"/>`;
  }
};

/* ---------- library: shelves of books; the guard scolds anyone on the yellow floor ---------- */
const BOOK_COLORS = ['#a8322a', '#2a55b0', '#2e7d4a', '#d4a017', '#6a3a8a', '#c86a2a', '#1e6a7a', '#7a2a3a'];
function shelfRow(x0, x1, y, h, r) {
  let s = '';
  for (let x = x0; x < x1 - 6;) {
    const bw = 6 + r() * 7, bh = h * (0.7 + r() * 0.3), c = BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)];
    s += `<rect x="${f(x)}" y="${f(y - bh)}" width="${f(bw)}" height="${f(bh)}" fill="${c}" stroke="#20140c" stroke-width=".8"/><rect x="${f(x + 1)}" y="${f(y - bh + 4)}" width="${f(bw - 2)}" height="2" fill="#e8d28a" opacity=".8"/>`;
    x += bw + (r() < 0.08 ? 10 : 0.6);
  }
  return s;
}

const guard = (fr) => `<g transform="translate(0 -4)">
  <path d="M-10 0 L-8 -34 M10 0 L8 -34" stroke="${OL}" stroke-width="9" stroke-linecap="round"/>
  <path d="M-10 0 L-8 -34 M10 0 L8 -34" stroke="#2c3550" stroke-width="5.5" stroke-linecap="round"/>
  <path d="M-14 1 h9 M5 1 h9" stroke="#141418" stroke-width="4" stroke-linecap="round"/>
  <path d="M-14 -34 L14 -34 L16 -68 Q0 -74 -16 -68 Z" fill="#2c3550" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M-3 -70 L0 -54 L3 -70" stroke="#e8e0cf" stroke-width="3" fill="none"/>
  <rect x="5" y="-62" width="8" height="5" rx="1" fill="#d4a017" stroke="${OL}" stroke-width="1"/>
  <rect x="-16" y="-38" width="32" height="4" fill="#141418"/>
  ${fr
    ? `<path d="M14 -64 L34 -74" stroke="${OL}" stroke-width="8" stroke-linecap="round"/><path d="M14 -64 L34 -74" stroke="#2c3550" stroke-width="5" stroke-linecap="round"/><circle cx="36" cy="-75" r="4" fill="#efc29b" stroke="${OL}" stroke-width="1.5"/>
       <path d="M-14 -64 Q-22 -48 -16 -40" stroke="${OL}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M-14 -64 Q-22 -48 -16 -40" stroke="#2c3550" stroke-width="5" fill="none" stroke-linecap="round"/>`
    : `<path d="M-14 -64 Q-20 -50 -6 -44 M14 -64 Q20 -50 6 -44" stroke="${OL}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M-14 -64 Q-20 -50 -6 -44 M14 -64 Q20 -50 6 -44" stroke="#2c3550" stroke-width="5" fill="none" stroke-linecap="round"/>`}
  <circle cx="0" cy="-82" r="11" fill="#efc29b" stroke="${OL}" stroke-width="2.5"/>
  <path d="M-12 -86 Q0 -100 12 -86 L14 -84 L-14 -84 Z" fill="#2c3550" stroke="${OL}" stroke-width="2"/>
  <path d="M-14 -84 h28 l4 3 h-30 Z" fill="#141418"/><circle cx="0" cy="-91" r="2.4" fill="#d4a017"/>
  <path d="M-6 -76 Q0 -73 6 -76" stroke="#3a2a1e" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  ${fr
    ? `<path d="M-4 -80 L-8 -82 M4 -80 L8 -82" stroke="${OL}" stroke-width="2" stroke-linecap="round"/><ellipse cx="0" cy="-73" rx="4" ry="4.5" fill="#5a1a1a" stroke="${OL}" stroke-width="1.2"/>
       <path d="M20 -96 q6 -4 12 0 M24 -104 q8 -6 16 0 M28 -112 q10 -7 20 0" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    : `<circle cx="-4" cy="-82" r="1.3" fill="${OL}"/><circle cx="4" cy="-82" r="1.3" fill="${OL}"/><path d="M-2 -71 h4" stroke="${OL}" stroke-width="1.4"/>`}
</g>`;

const library = {
  extras: { posts: '#5a3a20' },
  trapTop: 145,
  far() {
    const r = rng(81); let s = `<defs><linearGradient id="lbWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2e1c"/><stop offset="1" stop-color="#2a1a10"/></linearGradient>
      <radialGradient id="lbLamp"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".8"/><stop offset="1" stop-color="#ffcf6a" stop-opacity="0"/></radialGradient></defs>
      <rect width="1280" height="360" fill="url(#lbWall)"/>`;
    for (let b = 0; b < 8; b++) {
      const x0 = b * 160 + 6, x1 = x0 + 148;
      if (b === 3 || b === 6) {
        // tall arched window between the shelves
        s += `<path d="M${x0 + 24} 300 V90 Q${x0 + 74} 30 ${x1 - 24} 90 V300 Z" fill="#9fc8e6" stroke="#2a1a10" stroke-width="5"/>
          <path d="M${x0 + 74} 46 V300 M${x0 + 24} 170 H${x1 - 24}" stroke="#2a1a10" stroke-width="4"/>
          <path d="M${x0 + 34} 100 L${x0 + 60} 70" stroke="#e8f4ff" stroke-width="5" opacity=".7"/>`;
        continue;
      }
      s += `<rect x="${x0}" y="20" width="148" height="290" fill="#3a2414" stroke="#1e120a" stroke-width="4"/>`;
      for (let y = 70; y <= 300; y += 46) s += shelfRow(x0 + 6, x1 - 6, y, 38, r) + `<rect x="${x0}" y="${y}" width="148" height="6" fill="#6a4426" stroke="#1e120a" stroke-width="1.5"/>`;
      s += `<path d="M${x0} 20 h148 l-8 -14 h-132 Z" fill="#6a4426" stroke="#1e120a" stroke-width="2"/>`;
    }
    for (const x of [240, 640, 1040]) s += `<circle cx="${x}" cy="40" r="110" fill="url(#lbLamp)"/><path d="M${x} 0 v26" stroke="#2a1a10" stroke-width="2"/><path d="M${x - 16} 26 h32 l-6 12 h-20 Z" fill="#d4a017" stroke="#2a1a10" stroke-width="1.5"/>`;
    // reading tables in front of the shelves
    for (const x of [120, 520, 920]) s += `<rect x="${x}" y="276" width="140" height="10" fill="#7a4e2a" stroke="#2a1a10" stroke-width="2"/><path d="M${x + 10} 286 v30 M${x + 130} 286 v30" stroke="#5a3a20" stroke-width="6"/>
      <path d="M${x + 30} 276 l10 -8 h22 l-4 8 Z" fill="#efe6cf" stroke="#2a1a10" stroke-width="1"/><rect x="${x + 90}" y="262" width="12" height="14" fill="#2a55b0" stroke="#2a1a10" stroke-width="1"/>`;
    return s;
  },
  ground() {
    let s = `<rect y="${G}" width="1280" height="44" fill="#8a5a32"/><rect y="${G}" width="1280" height="4" fill="#b07a44"/>`;
    for (let x = 0; x < 1280; x += 32) for (let row = 0; row < 3; row++) {
      const y = G + 4 + row * 13, a = (x / 32 + row) % 2;
      s += `<path d="M${x} ${y} l16 ${a ? 13 : 0} M${x + 16} ${y} l16 ${a ? 0 : 13}" stroke="#6a4426" stroke-width="1.2"/>`;
    }
    return s;
  },
  trap(w, fr) {
    return `<rect x="0" y="0" width="${w}" height="8" fill="#ffd23f" stroke="#8a6a10" stroke-width="1.5"/>
      ${Array.from({ length: Math.ceil(w / 14) }, (_, i) => `<path d="M${i * 14} 8 l7 -8" stroke="#1a1a1a" stroke-width="3" opacity=".7"/>`).join('')}
      <g transform="translate(${w / 2} -6)">${guard(fr)}</g>
      ${fr ? `<g transform="translate(${w / 2 + 24} -118)"><path d="M-30 -14 h80 q8 0 8 8 v18 q0 8 -8 8 h-50 l-14 10 l2 -10 h-18 q-8 0 -8 -8 v-18 q0 -8 8 -8 Z" fill="#fff" stroke="${OL}" stroke-width="2"/>
        <text x="10" y="8" text-anchor="middle" font-size="15" font-weight="900" font-family="Apple SD Gothic Neo, Noto Sans KR, sans-serif" fill="#c21a1a">조용히!!</text></g>` : ''}`;
  },
  platform(w) {
    const r = rng(90 + w);
    return `${shelfRow(6, w - 6, 0, 22, r)}<rect x="0" y="0" width="${w}" height="10" rx="2" fill="#6a4426" stroke="#1e120a" stroke-width="2.5"/>
      <path d="M4 3 h${w - 8}" stroke="#9a6a3c" stroke-width="2"/>`;
  }
};

/* ---------- Rome: Colosseum and columns; lions wait in the pit ---------- */
const lion = (fr) => `<g>
  <path d="M-30 0 Q-34 -36 0 -40 Q34 -36 30 0 Z" fill="#a8641e" stroke="${OL}" stroke-width="2.5"/>
  ${Array.from({ length: 11 }, (_, i) => { const a = Math.PI * (0.05 + i * 0.09); return `<path d="M0 -18 L${f(-Math.cos(a) * 36)} ${f(-18 - Math.sin(a) * 26)}" stroke="#7a4410" stroke-width="5" stroke-linecap="round"/>`; }).join('')}
  <ellipse cx="0" cy="-16" rx="18" ry="17" fill="#e0a24a" stroke="${OL}" stroke-width="2.5"/>
  <circle cx="-14" cy="-30" r="5" fill="#e0a24a" stroke="${OL}" stroke-width="2"/><circle cx="14" cy="-30" r="5" fill="#e0a24a" stroke="${OL}" stroke-width="2"/>
  <path d="M-8 -20 l5 2 M8 -20 l-5 2" stroke="${OL}" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M-4 -12 h8 l-4 4 Z" fill="#3a1a10"/>
  ${fr
    ? `<path d="M-10 -6 Q0 12 10 -6 Z" fill="#7a1a1a" stroke="${OL}" stroke-width="2"/><path d="M-8 -6 l2 5 l2 -5 M4 -6 l2 5 l2 -5" fill="#fff"/>`
    : `<path d="M-6 -4 Q0 0 6 -4" stroke="${OL}" stroke-width="2" fill="none"/>`}
</g>`;

const rome = {
  extras: { posts: '#e2d8c0' },
  far() {
    const r = rng(101); let s = `<defs><linearGradient id="rmSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5aa0e0"/><stop offset="1" stop-color="#e6f0f6"/></linearGradient></defs>
      <rect width="1280" height="360" fill="url(#rmSky)"/>`;
    for (let i = 0; i < 5; i++) s += `<ellipse cx="${f(r() * 1280)}" cy="${f(40 + r() * 50)}" rx="${f(60 + r() * 40)}" ry="${f(12 + r() * 6)}" fill="#fff" opacity=".8"/>`;
    // Colosseum: three tiers of arches, broken on one side
    s += `<path d="M300 280 V110 Q640 70 980 110 V280 Z" fill="#d8c8a2" stroke="#8a7a5a" stroke-width="3"/>
      <path d="M860 106 L900 130 L940 112 L980 140 V110 Z" fill="url(#rmSky)"/>`;
    for (let tier = 0; tier < 3; tier++) for (let i = 0; i < 16; i++) {
      const x = 320 + i * 40, y = 260 - tier * 54;
      if (tier === 2 && i > 13) continue;
      s += `<path d="M${x} ${y} v-30 q12 -16 24 0 v30 Z" fill="#7a6a4a" opacity=".85"/>`;
    }
    for (let tier = 0; tier < 3; tier++) s += `<line x1="300" y1="${270 - tier * 54}" x2="980" y2="${270 - tier * 54}" stroke="#a8987a" stroke-width="4"/>`;
    // columns and cypress trees in front
    for (const x of [90, 170, 1110, 1190]) s += `<rect x="${x - 10}" y="130" width="20" height="150" fill="#efe8d6" stroke="#9a8a6a" stroke-width="2"/><rect x="${x - 16}" y="122" width="32" height="10" fill="#e2d8c0" stroke="#9a8a6a" stroke-width="2"/>
      ${[-5, 0, 5].map(d => `<line x1="${x + d}" y1="134" x2="${x + d}" y2="278" stroke="#c8bca0" stroke-width="1.2"/>`).join('')}`;
    s += `<rect x="60" y="112" width="140" height="12" fill="#e2d8c0" stroke="#9a8a6a" stroke-width="2"/><rect x="1080" y="112" width="140" height="12" fill="#e2d8c0" stroke="#9a8a6a" stroke-width="2"/>`;
    for (const x of [250, 1030, 1250]) s += `<path d="M${x} 280 Q${x - 16} 200 ${x} 130 Q${x + 16} 200 ${x} 280 Z" fill="#3e6a3c" stroke="#2a4a28" stroke-width="2"/>`;
    s += `<rect y="280" width="1280" height="36" fill="#cbb98e"/>`;
    return s;
  },
  ground() {
    let s = `<rect y="${G}" width="1280" height="44" fill="#d8c8a2"/><rect y="${G}" width="1280" height="4" fill="#efe2c0"/>`;
    for (let row = 0; row < 2; row++) for (let x = (row % 2) * 40; x < 1280; x += 80) s += `<rect x="${x}" y="${G + 4 + row * 20}" width="80" height="20" fill="none" stroke="#a8987a" stroke-width="1.5"/>`;
    return s;
  },
  trap(w, fr) {
    return `<rect x="0" y="0" width="${w}" height="44" fill="#1e140c"/>
      <g transform="translate(${w / 2} ${fr ? 20 : 28})">${lion(fr)}</g>
      ${Array.from({ length: Math.floor(w / 12) + 1 }, (_, i) => `<line x1="${i * 12 + 2}" y1="0" x2="${i * 12 + 2}" y2="10" stroke="#5a5a62" stroke-width="3"/>`).join('')}
      <rect x="-4" y="-2" width="${w + 8}" height="6" fill="#6a6a72" stroke="#2a2a30" stroke-width="1.5"/>
      <path d="M-4 0 L2 44 M${w + 4} 0 L${w - 2} 44" stroke="#8a7a5a" stroke-width="6"/>`;
  },
  platform(w) {
    return `<rect x="0" y="0" width="${w}" height="16" fill="#efe8d6" stroke="#8a7a5a" stroke-width="2.5"/>
      <path d="M0 5 h${w}" stroke="#c8bca0" stroke-width="1.5"/>
      ${Array.from({ length: Math.floor(w / 24) }, (_, i) => `<rect x="${i * 24 + 6}" y="8" width="12" height="6" fill="#d8ccb0"/>`).join('')}`;
  }
};

/* ---------- Egypt: pyramids and palms; cobras rise from the snake pit ---------- */
const cobra = (x, fr, flip) => `<g transform="translate(${x} 30) scale(${flip ? -1 : 1} 1)">
  <path d="M0 14 Q-8 0 0 ${fr ? -26 : -12} Q6 ${fr ? -34 : -18} 2 ${fr ? -40 : -24}" stroke="${OL}" stroke-width="9" fill="none" stroke-linecap="round"/>
  <path d="M0 14 Q-8 0 0 ${fr ? -26 : -12} Q6 ${fr ? -34 : -18} 2 ${fr ? -40 : -24}" stroke="#6a8a2a" stroke-width="5.5" fill="none" stroke-linecap="round"/>
  <path d="M-9 ${fr ? -34 : -18} Q2 ${fr ? -52 : -34} 13 ${fr ? -34 : -18} Q2 ${fr ? -28 : -12} -9 ${fr ? -34 : -18} Z" fill="#8aa83a" stroke="${OL}" stroke-width="1.8"/>
  <circle cx="5" cy="${fr ? -42 : -26}" r="1.6" fill="#ffd23f"/>
  ${fr ? `<path d="M8 -42 l8 2 l-2 3 M8 -42 l8 -1" stroke="#d0262e" stroke-width="1.5" fill="none"/>` : ''}
</g>`;

const egypt = {
  extras: { posts: '#c9a46a' },
  far() {
    const r = rng(121); let s = `<defs><linearGradient id="egSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2a648"/><stop offset=".6" stop-color="#f7d58a"/><stop offset="1" stop-color="#fbe9b8"/></linearGradient></defs>
      <rect width="1280" height="360" fill="url(#egSky)"/><circle cx="980" cy="90" r="46" fill="#fff4c8" opacity=".9"/>`;
    s += `<polygon points="180,260 360,90 540,260" fill="#d8a85a"/><polygon points="360,90 540,260 420,260" fill="#b88a42"/>
      <polygon points="500,260 620,150 740,260" fill="#e0b46a"/><polygon points="620,150 740,260 660,260" fill="#c09048"/>
      <polygon points="820,260 900,190 980,260" fill="#e0b46a"/><polygon points="900,190 980,260 930,260" fill="#c09048"/>`;
    for (let i = 0; i < 9; i++) s += `<line x1="${f(250 + i * 25)}" y1="${f(194 + i * 7.5)}" x2="${f(470 - i * 25)}" y2="${f(194 + i * 7.5)}" stroke="#c4964e" stroke-width="1" opacity=".5"/>`;
    // sphinx silhouette and palm trees
    s += `<path d="M1040 260 h120 v-20 q-10 -6 -30 -6 l-6 -26 q-8 -10 -18 0 l-4 26 q-30 2 -62 26 Z" fill="#c8984e" stroke="#9a7238" stroke-width="2"/>`;
    for (const x of [90, 760, 1220]) s += `<path d="M${x} 280 Q${x + 6} 230 ${x - 2} 180" stroke="#7a5a30" stroke-width="7" fill="none"/>
      ${[-60, -20, 20, 60, 100, 140].map(a => `<path d="M${x - 2} 180 q${f(Math.cos(a * Math.PI / 180) * 26)} ${f(-Math.sin(a * Math.PI / 180) * 18)} ${f(Math.cos(a * Math.PI / 180) * 46)} ${f(-Math.sin(a * Math.PI / 180) * 4 + 14)}" stroke="#3e7a3c" stroke-width="6" fill="none" stroke-linecap="round"/>`).join('')}`;
    s += `<path d="M0 270 Q160 250 320 268 T640 264 T960 270 T1280 262 V316 H0 Z" fill="#e8c482"/>`;
    for (let i = 0; i < 20; i++) s += `<path d="M${f(r() * 1280)} ${f(280 + r() * 30)} q10 -3 20 0" stroke="#c9a464" stroke-width="1.4" fill="none"/>`;
    return s;
  },
  ground() {
    let s = `<rect y="${G}" width="1280" height="44" fill="#e2bc78"/><rect y="${G}" width="1280" height="4" fill="#f2d494"/>`;
    for (let x = 0; x < 1280; x += 64) s += `<rect x="${x}" y="${G + 4}" width="64" height="22" fill="none" stroke="#b8904e" stroke-width="1.5"/>
      <path d="M${x + 14} ${G + 10} v10 M${x + 24} ${G + 12} q4 -4 8 0 q-4 4 -8 0 M${x + 44} ${G + 10} l4 6 l4 -6" stroke="#9a7238" stroke-width="1.3" fill="none"/>`;
    return s;
  },
  trap(w, fr) {
    return `<rect x="0" y="0" width="${w}" height="44" fill="#3a2614"/>
      <path d="M0 30 Q${w * 0.25} 22 ${w * 0.5} 30 T${w} 30 V44 H0 Z" fill="#5a3e20"/>
      ${cobra(w * 0.28, fr, false)}${cobra(w * 0.72, 1 - fr, true)}
      <path d="M-4 0 L2 44 M${w + 4} 0 L${w - 2} 44" stroke="#b8904e" stroke-width="6"/>
      <path d="M-6 0 h${w + 12}" stroke="#9a7238" stroke-width="3"/>`;
  },
  platform(w) {
    return `<rect x="0" y="0" width="${w}" height="18" fill="#e0b46a" stroke="#8a6a32" stroke-width="2.5"/>
      <path d="M0 5 h${w}" stroke="#f2d494" stroke-width="2"/>
      ${Array.from({ length: Math.floor(w / 30) }, (_, i) => `<path d="M${i * 30 + 10} 9 l5 6 l5 -6 M${i * 30 + 22} 8 v8" stroke="#9a7238" stroke-width="1.4" fill="none"/>`).join('')}`;
  }
};

export const MAP_ART_2 = { ship, library, rome, egypt };
