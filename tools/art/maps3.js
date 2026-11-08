// Map art for the savanna, the Korean traditional market and the moon base. Same layer contract as maps.js.
// trapTop: room above the ground the trap art needs (default 70).
import { OL, f, rng } from './rig.js';

const G = 316;

/* ---------- savanna: acacias and golden grass; a crocodile lurks in the swamp ---------- */
const acacia = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M0 0 Q-4 -40 -2 -70 M-2 -50 Q-20 -64 -34 -74 M-1 -58 Q16 -70 30 -78" stroke="#3a2a1a" stroke-width="6" fill="none" stroke-linecap="round"/>
  <ellipse cx="-30" cy="-82" rx="40" ry="11" fill="#4a5a22"/><ellipse cx="22" cy="-86" rx="46" ry="12" fill="#55662a"/>
  <ellipse cx="-4" cy="-92" rx="34" ry="9" fill="#62742f"/></g>`;
const giraffe = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#8a5a22">
  <path d="M-16 0 v-26 M-10 0 v-26 M8 0 v-26 M14 0 v-26" stroke="#8a5a22" stroke-width="3"/>
  <ellipse cx="0" cy="-30" rx="20" ry="9"/><path d="M14 -34 L26 -74 L32 -72 L22 -30 Z"/><ellipse cx="32" cy="-76" rx="8" ry="4"/></g>`;
const crocodile = fr => fr
  // lunging out of the water, jaws wide open
  ? `<g transform="translate(0 6)">
      <path d="M-30 4 Q-10 -8 10 -6 L14 -10 Q40 -40 58 -46 L60 -40 Q40 -26 26 -8 Q44 -12 60 -6 L58 0 Q36 4 14 6 Q-10 12 -30 10 Z" fill="#4f7a2e" stroke="${OL}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M18 -12 L22 -18 L26 -14 L30 -22 L34 -18 L38 -27 L42 -23 L46 -32 L50 -29 M26 -6 L30 -2 L34 -6 L38 -2 L42 -6 L46 -2 L50 -5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linejoin="round"/>
      <path d="M22 -10 Q38 -20 52 -36 L56 -32 Q40 -12 26 -8 Z" fill="#c0392b"/>
      <circle cx="14" cy="-16" r="4" fill="#ffe066" stroke="${OL}" stroke-width="1.5"/><path d="M14 -19 v6" stroke="${OL}" stroke-width="1.6"/>
      ${[-24, -14, -4, 6].map(x => `<path d="M${x} -2 l3 -5 l3 5" fill="#3a5a20" stroke="${OL}" stroke-width="1"/>`).join('')}
    </g>`
  // just the eyes and snout above the murky water
  : `<g transform="translate(-6 10)">
      <path d="M-20 0 Q-10 -6 6 -5 Q24 -6 38 -2 Q40 2 36 3 L-20 3 Z" fill="#4f7a2e" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/>
      <circle cx="0" cy="-6" r="4" fill="#4f7a2e" stroke="${OL}" stroke-width="1.8"/><circle cx="12" cy="-6" r="4" fill="#4f7a2e" stroke="${OL}" stroke-width="1.8"/>
      <circle cx="0" cy="-7" r="1.8" fill="#ffe066"/><circle cx="12" cy="-7" r="1.8" fill="#ffe066"/>
      <circle cx="34" cy="-3" r="1.2" fill="${OL}"/></g>`;

const savanna = {
  extras: { posts: '#6a4a2a' },
  far() {
    const r = rng(141); let s = `<defs><linearGradient id="svSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f29a3a"/><stop offset=".55" stop-color="#f7c86a"/><stop offset="1" stop-color="#fbe6a8"/></linearGradient></defs>
      <rect width="1280" height="360" fill="url(#svSky)"/><circle cx="820" cy="150" r="70" fill="#fff1b8" opacity=".85"/>`;
    s += `<path d="M0 230 Q180 196 360 214 Q560 180 760 210 Q960 186 1140 206 Q1220 200 1280 210 V360 H0 Z" fill="#c9a24e" opacity=".7"/>`;
    // a herd on the horizon
    for (let i = 0; i < 7; i++) s += `<ellipse cx="${f(520 + i * 22 + r() * 10)}" cy="${f(214 + r() * 4)}" rx="9" ry="4" fill="#5a3a20" opacity=".6"/>`;
    s += giraffe(300, 228, 0.9) + giraffe(360, 232, 0.7) + giraffe(1060, 222, 0.8);
    s += `<path d="M0 250 Q200 236 420 248 T840 246 T1280 250 V360 H0 Z" fill="#d8b45a"/>`;
    s += acacia(140, 262, 1.1) + acacia(640, 254, 0.8) + acacia(1180, 264, 1.2);
    for (let i = 0; i < 70; i++) { const x = r() * 1280, y = 262 + r() * 54; s += `<path d="M${f(x)} ${f(y)} l-3 -9 M${f(x + 2)} ${f(y)} l1 -11 M${f(x + 4)} ${f(y)} l4 -8" stroke="${r() < 0.5 ? '#a8862e' : '#c49a3a'}" stroke-width="1.6"/>`; }
    return s;
  },
  ground() {
    const r = rng(142);
    let s = `<rect y="${G}" width="1280" height="44" fill="#a8823e"/><rect y="${G}" width="1280" height="5" fill="#c9a24e"/>`;
    for (let i = 0; i < 90; i++) { const x = r() * 1280; s += `<path d="M${f(x)} ${G + 3} l-3 -8 M${f(x + 3)} ${G + 3} l2 -9" stroke="#7a8a2a" stroke-width="1.8"/>`; }
    for (let i = 0; i < 20; i++) s += `<ellipse cx="${f(r() * 1280)}" cy="${f(G + 14 + r() * 24)}" rx="${f(3 + r() * 4)}" ry="2" fill="#8a6a30"/>`;
    return s;
  },
  trap(w, fr) {
    return `<defs><linearGradient id="svSwamp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a7a3a"/><stop offset="1" stop-color="#2a3a1a"/></linearGradient></defs>
      <rect x="0" y="0" width="${w}" height="44" fill="url(#svSwamp)"/>
      <path d="M0 3 Q${w * .25} ${fr ? -2 : 5} ${w * .5} 3 T${w} 3" stroke="#9ac06a" stroke-width="2" fill="none"/>
      ${[0.15, 0.85].map(k => `<path d="M${f(w * k)} 2 l-4 -18 M${f(w * k + 3)} 2 l2 -22 M${f(w * k + 6)} 2 l5 -16" stroke="#5a7a2a" stroke-width="2"/><ellipse cx="${f(w * k + 3)}" cy="-20" rx="2" ry="5" fill="#6a4a2a"/>`).join('')}
      <g transform="translate(${w / 2 - 14} 0)">${crocodile(fr)}</g>
      ${fr ? `<circle cx="${f(w * .2)}" cy="-8" r="3" fill="#bfe0a0" opacity=".8"/><circle cx="${f(w * .8)}" cy="-14" r="2.4" fill="#bfe0a0" opacity=".8"/>` : ''}
      <path d="M-4 0 L2 44 M${w + 4} 0 L${w - 2} 44" stroke="#6a4a2a" stroke-width="6"/>`;
  },
  platform(w) {
    // a fallen log on two stumps
    return `<rect x="0" y="0" width="${w}" height="15" rx="7" fill="#7a5230" stroke="#3a2414" stroke-width="2.5"/>
      <path d="M8 5 h${w - 30} M20 10 h${w - 50}" stroke="#a8784a" stroke-width="1.6"/>
      <ellipse cx="${w - 6}" cy="7.5" rx="5" ry="7" fill="#c8a06a" stroke="#3a2414" stroke-width="2"/><ellipse cx="${w - 6}" cy="7.5" rx="2" ry="3" fill="none" stroke="#8a6a3a" stroke-width="1"/>`;
  }
};

/* ---------- Korean traditional market: stalls along the back; a snow crab guards the fish shop ---------- */
const AWNING = ['#c23a2a', '#2a6ab0', '#2e8a4a', '#e0a82a', '#7a3a8a'];
const stall = (x, w, i, sign, goods) => {
  const c = AWNING[i % AWNING.length];
  let s = `<rect x="${x}" y="150" width="${w}" height="130" fill="#d8c8a8" stroke="#4a3a2a" stroke-width="2.5"/>
    <rect x="${x + 8}" y="96" width="${w - 16}" height="34" rx="3" fill="#f6efe0" stroke="#4a3a2a" stroke-width="2"/>
    <text x="${x + w / 2}" y="121" text-anchor="middle" font-size="22" font-weight="900" font-family="Apple SD Gothic Neo, Noto Sans KR, sans-serif" fill="${c}">${sign}</text>`;
  for (let k = 0; k < w; k += 20) s += `<path d="M${x + k} 130 h20 l-3 22 h-14 Z" fill="${(k / 20) % 2 ? '#fff' : c}" stroke="#4a3a2a" stroke-width="1"/>`;
  s += `<rect x="${x + 6}" y="236" width="${w - 12}" height="44" fill="#8a5a32" stroke="#3a2414" stroke-width="2"/>`;
  s += goods;
  return s;
};
const crab = (x, y, s, fr) => `<g transform="translate(${x} ${y}) scale(${s})">
  ${[-1, 1].map(d => [0, 1, 2].map(k => `<path d="M${d * 10} ${-2 + k * 3} q${d * 12} ${-8 + k * 4} ${d * 20} ${4 + k * 5}" stroke="${OL}" stroke-width="4.2" fill="none" stroke-linecap="round"/><path d="M${d * 10} ${-2 + k * 3} q${d * 12} ${-8 + k * 4} ${d * 20} ${4 + k * 5}" stroke="#e0602a" stroke-width="2.2" fill="none" stroke-linecap="round"/>`).join('')).join('')}
  <ellipse cx="0" cy="0" rx="16" ry="11" fill="#e0602a" stroke="${OL}" stroke-width="2.4"/>
  <path d="M-10 -4 q10 -6 20 0" stroke="#ffb07a" stroke-width="2" fill="none"/>
  <path d="M-4 -10 v-6 M4 -10 v-6" stroke="${OL}" stroke-width="2"/><circle cx="-4" cy="-17" r="2.4" fill="#1a1a1a"/><circle cx="4" cy="-17" r="2.4" fill="#1a1a1a"/>
  ${fr
    // claws thrust down and forward, snapping
    ? `<path d="M12 -2 Q30 4 34 24" stroke="${OL}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M12 -2 Q30 4 34 24" stroke="#e0602a" stroke-width="3.6" fill="none" stroke-linecap="round"/>
       <path d="M28 22 Q40 22 42 34 L34 30 L36 38 Q26 36 28 22 Z" fill="#e0602a" stroke="${OL}" stroke-width="2"/>
       <path d="M-12 -2 Q-26 6 -24 26" stroke="${OL}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M-12 -2 Q-26 6 -24 26" stroke="#e0602a" stroke-width="3.6" fill="none" stroke-linecap="round"/>
       <path d="M-28 24 Q-30 36 -18 36 L-22 30 L-14 30 Q-16 20 -28 24 Z" fill="#e0602a" stroke="${OL}" stroke-width="2"/>`
    : `<path d="M10 -6 Q20 -18 26 -14" stroke="${OL}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M10 -6 Q20 -18 26 -14" stroke="#e0602a" stroke-width="3.6" fill="none" stroke-linecap="round"/>
       <path d="M24 -18 Q34 -20 32 -10 L26 -12 Z" fill="#e0602a" stroke="${OL}" stroke-width="2"/>
       <path d="M-10 -6 Q-20 -18 -26 -14" stroke="${OL}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M-10 -6 Q-20 -18 -26 -14" stroke="#e0602a" stroke-width="3.6" fill="none" stroke-linecap="round"/>
       <path d="M-24 -18 Q-34 -20 -32 -10 L-26 -12 Z" fill="#e0602a" stroke="${OL}" stroke-width="2"/>`}
</g>`;

const market = {
  extras: { posts: '#6a4a2a' },
  trapTop: 140,
  far() {
    const r = rng(161); let s = `<defs><linearGradient id="mkRoof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a6a7a"/><stop offset="1" stop-color="#8a9aaa"/></linearGradient>
      <radialGradient id="mkLamp"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".75"/><stop offset="1" stop-color="#ffcf6a" stop-opacity="0"/></radialGradient></defs>
      <rect width="1280" height="360" fill="#3a3a44"/>
      <path d="M0 0 H1280 V70 Q640 40 0 70 Z" fill="url(#mkRoof)"/>`;
    // arcade roof trusses
    for (let x = 0; x <= 1280; x += 80) s += `<path d="M${x} 0 L${x} 66" stroke="#2a2a32" stroke-width="3"/>`;
    s += `<path d="M0 66 Q640 36 1280 66" stroke="#2a2a32" stroke-width="5" fill="none"/>`;
    const signs = [['청과', 'fruit'], ['떡집', 'rice'], ['정육', 'meat'], ['반찬', 'side'], ['건어물', 'dry'], ['채소', 'veg'], ['분식', 'snack'], ['참기름', 'oil']];
    signs.forEach(([sign, kind], i) => {
      const x = 12 + i * 158, w = 146;
      let goods = '';
      for (let k = 0; k < 6; k++) {
        const gx = x + 18 + k * 21;
        if (kind === 'fruit') goods += `<circle cx="${gx}" cy="232" r="8" fill="${['#e23a2a', '#f2a03a', '#e8d03a'][k % 3]}" stroke="#3a2414" stroke-width="1.2"/>`;
        else if (kind === 'rice') goods += `<rect x="${gx - 8}" y="224" width="16" height="10" rx="3" fill="${['#f6e8f0', '#8ac06a', '#f2c0d0'][k % 3]}" stroke="#3a2414" stroke-width="1.2"/>`;
        else if (kind === 'meat') goods += `<path d="M${gx - 8} 234 q2 -14 12 -12 q8 4 2 12 Z" fill="#c84a4a" stroke="#3a2414" stroke-width="1.2"/>`;
        else if (kind === 'veg') goods += `<path d="M${gx} 236 l-6 -14 M${gx} 236 l0 -16 M${gx} 236 l6 -14" stroke="#3a8a3a" stroke-width="3"/><ellipse cx="${gx}" cy="234" rx="7" ry="4" fill="#f2f2e0" stroke="#3a2414" stroke-width="1"/>`;
        else if (kind === 'oil') goods += `<rect x="${gx - 4}" y="216" width="8" height="18" rx="2" fill="#c89a3a" stroke="#3a2414" stroke-width="1.2"/><rect x="${gx - 2}" y="212" width="4" height="5" fill="#c23a2a"/>`;
        else goods += `<ellipse cx="${gx}" cy="230" rx="9" ry="5" fill="${['#e8c482', '#d8a050', '#f2d494'][k % 3]}" stroke="#3a2414" stroke-width="1.2"/>`;
      }
      s += stall(x, w, i, sign, goods);
    });
    for (const x of [160, 480, 800, 1120]) s += `<circle cx="${x}" cy="84" r="70" fill="url(#mkLamp)"/><path d="M${x} 60 v14" stroke="#2a2a32" stroke-width="2"/><circle cx="${x}" cy="80" r="7" fill="#ffe9a8" stroke="#2a2a32" stroke-width="1.5"/>`;
    // shoppers' silhouettes
    for (let i = 0; i < 9; i++) { const x = 40 + r() * 1200; s += `<g opacity=".55" fill="#2a2a34"><circle cx="${f(x)}" cy="256" r="8"/><path d="M${f(x - 10)} 316 L${f(x - 8)} 266 Q${f(x)} 260 ${f(x + 8)} 266 L${f(x + 10)} 316 Z"/></g>`; }
    return s;
  },
  ground() {
    let s = `<rect y="${G}" width="1280" height="44" fill="#8a8a90"/><rect y="${G}" width="1280" height="4" fill="#a8a8ae"/>`;
    for (let row = 0; row < 3; row++) for (let x = (row % 2) * 24; x < 1280; x += 48) s += `<rect x="${x}" y="${G + 4 + row * 13}" width="48" height="13" fill="none" stroke="#6a6a72" stroke-width="1.2"/>`;
    return s;
  },
  trap(w, fr) {
    // the yellow floor, and the fish shop counter with its glass tank right behind it
    const tx = w / 2 - 34;
    return `<rect x="-6" y="-120" width="${w + 12}" height="120" fill="#e8e0d0" stroke="#4a3a2a" stroke-width="2"/>
      <rect x="0" y="-136" width="${w}" height="24" rx="3" fill="#f6efe0" stroke="#4a3a2a" stroke-width="2"/>
      <text x="${w / 2}" y="-118" text-anchor="middle" font-size="16" font-weight="900" font-family="Apple SD Gothic Neo, Noto Sans KR, sans-serif" fill="#1e6ab0">수산</text>
      <rect x="${tx}" y="-96" width="68" height="56" fill="#6ab8e0" fill-opacity=".75" stroke="#2a4a6a" stroke-width="3"/>
      <path d="M${tx} -84 h68" stroke="#bfe8ff" stroke-width="2"/>
      ${[0, 1, 2].map(k => `<circle cx="${tx + 12 + k * 20}" cy="${-56 - k * 10}" r="2" fill="#e8f8ff" opacity=".9"/>`).join('')}
      ${fr ? '' : crab(tx + 34, -58, 0.8, 0)}
      <rect x="-4" y="-40" width="${w + 8}" height="34" fill="#8a5a32" stroke="#3a2414" stroke-width="2"/>
      <rect x="0" y="-44" width="${w}" height="8" fill="#e8f2f6" stroke="#6a8a9a" stroke-width="1.5"/>
      ${[0.14, 0.86].map(k => `<g transform="translate(${f(w * k)} -48) rotate(${k < 0.5 ? -8 : 8})"><path d="M-12 0 Q-4 -7 8 -3 L12 0 L8 3 Q-4 7 -12 0 Z" fill="#6f7f8a" stroke="${OL}" stroke-width="1.6"/><path d="M-12 0 L-18 -5 L-17 0 L-18 5 Z" fill="#6f7f8a" stroke="${OL}" stroke-width="1.4"/><circle cx="5" cy="-1" r="1.2" fill="${OL}"/></g>`).join('')}
      ${fr ? `${crab(tx + 52, -30, 0.95, 1)}<path d="M${tx + 30} -96 q6 -10 12 0 M${tx + 46} -100 q6 -12 12 0" stroke="#bfe8ff" stroke-width="2.4" fill="none"/>
        <g transform="translate(${w / 2 + 10} -112)"><path d="M-34 -12 h76 q8 0 8 8 v16 q0 8 -8 8 h-46 l-12 10 l2 -10 h-20 q-8 0 -8 -8 v-16 q0 -8 8 -8 Z" fill="#fff" stroke="${OL}" stroke-width="2"/>
        <text x="4" y="9" text-anchor="middle" font-size="15" font-weight="900" font-family="Apple SD Gothic Neo, Noto Sans KR, sans-serif" fill="#c21a1a">집게!!</text></g>` : ''}
      <rect x="0" y="0" width="${w}" height="8" fill="#ffd23f" stroke="#8a6a10" stroke-width="1.5"/>
      ${Array.from({ length: Math.ceil(w / 14) }, (_, i) => `<path d="M${i * 14} 8 l7 -8" stroke="#1a1a1a" stroke-width="3" opacity=".7"/>`).join('')}`;
  },
  platform(w) {
    // a stack of produce crates
    return `<rect x="0" y="0" width="${w}" height="16" fill="#c89a5a" stroke="#4a2e18" stroke-width="2.5"/>
      ${Array.from({ length: Math.floor(w / 30) }, (_, i) => `<path d="M${i * 30 + 2} 2 v12 M${i * 30 + 2} 8 h28" stroke="#8a6232" stroke-width="1.6"/>`).join('')}
      <rect x="${w / 2 - 22}" y="3" width="44" height="10" fill="#f6efe0" stroke="#4a2e18" stroke-width="1.2"/>
      <text x="${w / 2}" y="11.5" text-anchor="middle" font-size="8" font-weight="900" font-family="Apple SD Gothic Neo, Noto Sans KR, sans-serif" fill="#c23a2a">국산</text>`;
  }
};

/* ---------- moon base: domes under a black sky with Earth; a radioactive spill glows ---------- */
const dome = (x, y, r) => `<path d="M${x - r} ${y} A${r} ${r} 0 0 1 ${x + r} ${y} Z" fill="#cfe4f2" fill-opacity=".55" stroke="#8aa0b0" stroke-width="3"/>
  <path d="M${x - r * 0.7} ${y - r * 0.55} A${r} ${r} 0 0 1 ${x - r * 0.1} ${y - r * 0.98}" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/>
  <rect x="${x - r - 4}" y="${y}" width="${2 * r + 8}" height="10" fill="#9aa4ae" stroke="#5a646e" stroke-width="2"/>`;
const trefoil = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})"><circle r="3" fill="${c}"/>
  ${[0, 120, 240].map(a => `<path d="M0 0 L${f(Math.cos((a - 30) * Math.PI / 180) * 12)} ${f(Math.sin((a - 30) * Math.PI / 180) * 12)} A12 12 0 0 1 ${f(Math.cos((a + 30) * Math.PI / 180) * 12)} ${f(Math.sin((a + 30) * Math.PI / 180) * 12)} Z" fill="${c}" transform="rotate(-90)"/>`).join('')}</g>`;

const moon = {
  extras: { posts: '#8a949e' },
  far() {
    const r = rng(181); let s = `<rect width="1280" height="360" fill="#05060c"/>`;
    for (let i = 0; i < 160; i++) s += `<circle cx="${f(r() * 1280)}" cy="${f(r() * 230)}" r="${f(.4 + r() * 1.3)}" fill="#fff" opacity="${f(.4 + r() * .6)}"/>`;
    // Earth rising
    s += `<defs><radialGradient id="mnEarth" cx=".4" cy=".35"><stop offset="0" stop-color="#7ac0ff"/><stop offset="1" stop-color="#1a4a9a"/></radialGradient></defs>
      <circle cx="1010" cy="80" r="42" fill="url(#mnEarth)"/>
      <path d="M985 60 q14 -8 22 4 q-6 10 -18 6 Z M1010 95 q14 -6 24 6 q-10 8 -22 2 Z" fill="#4a9a4a"/>
      <circle cx="1010" cy="80" r="46" fill="none" stroke="#9fd0ff" stroke-width="3" opacity=".4"/>`;
    s += `<path d="M0 230 Q160 200 340 222 Q520 196 700 220 Q900 190 1080 218 Q1200 206 1280 214 V360 H0 Z" fill="#5a5e66"/>`;
    s += dome(240, 252, 46) + dome(330, 256, 28) + dome(860, 250, 54);
    s += `<path d="M600 252 v-90 M590 170 h20 M600 162 l-24 -16 M600 162 l24 -16" stroke="#9aa4ae" stroke-width="4"/><circle cx="600" cy="156" r="4" fill="#ff5a3c"/>
      <path d="M560 240 a40 20 0 0 1 80 0" fill="#c8ccd2" stroke="#6a727c" stroke-width="2" transform="rotate(-20 600 240)"/>`;
    s += `<path d="M0 260 Q200 248 420 258 T840 254 T1280 260 V360 H0 Z" fill="#7a7e86"/>`;
    for (let i = 0; i < 18; i++) { const x = r() * 1280, y = 268 + r() * 40, rx = 10 + r() * 26; s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(rx * 0.28)}" fill="#5e626a"/><path d="M${f(x - rx)} ${f(y)} a${f(rx)} ${f(rx * 0.28)} 0 0 0 ${f(rx * 2)} 0" stroke="#9aa0a8" stroke-width="1.5" fill="none"/>`; }
    // a little rover
    s += `<g transform="translate(1150 286)"><rect x="-26" y="-18" width="52" height="14" rx="3" fill="#e8ecf0" stroke="#4a525c" stroke-width="2"/>
      ${[-18, 0, 18].map(x => `<circle cx="${x}" cy="-2" r="6" fill="#3a3e46" stroke="#1a1c20" stroke-width="1.5"/>`).join('')}<path d="M10 -18 v-14 l10 -4" stroke="#4a525c" stroke-width="2" fill="none"/></g>`;
    return s;
  },
  ground() {
    const r = rng(182);
    let s = `<rect y="${G}" width="1280" height="44" fill="#8a8e96"/><rect y="${G}" width="1280" height="4" fill="#a8acb4"/>`;
    for (let i = 0; i < 26; i++) { const x = r() * 1280, rx = 6 + r() * 14; s += `<ellipse cx="${f(x)}" cy="${f(G + 12 + r() * 26)}" rx="${f(rx)}" ry="${f(rx * 0.3)}" fill="#6e727a"/>`; }
    for (let i = 0; i < 40; i++) s += `<path d="M${f(r() * 1280)} ${f(G + 6 + r() * 34)} l5 2 l-1 3" stroke="#a0a4ac" stroke-width="1.2" fill="none"/>`;
    return s;
  },
  trap(w, fr) {
    return `<defs><radialGradient id="mnRad${fr}"><stop offset="0" stop-color="#d8ff6a" stop-opacity="${fr ? 1 : 0.8}"/><stop offset=".6" stop-color="#5aff3a" stop-opacity="${fr ? 0.7 : 0.45}"/><stop offset="1" stop-color="#2aa02a" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="${w / 2}" cy="-4" rx="${w / 2 + (fr ? 18 : 10)}" ry="${fr ? 40 : 30}" fill="url(#mnRad${fr})"/>
      <rect x="0" y="0" width="${w}" height="44" fill="#2a3a1e"/>
      <path d="M4 4 Q${w * .3} ${fr ? 10 : 6} ${w * .5} 5 T${w - 4} 6 V30 Q${w / 2} 38 4 30 Z" fill="#7aff4a" opacity="${fr ? 0.95 : 0.75}"/>
      ${trefoil(w / 2, 18, 0.7, '#1a2a10')}
      <rect x="0" y="0" width="${w}" height="6" fill="#ffd23f" stroke="#8a6a10" stroke-width="1.2"/>
      ${Array.from({ length: Math.ceil(w / 12) }, (_, i) => `<path d="M${i * 12} 6 l6 -6" stroke="#1a1a1a" stroke-width="3"/>`).join('')}
      ${[-2, w + 2].map(x => `<g transform="translate(${x} 0)"><path d="M0 0 v-34" stroke="#5a646e" stroke-width="3"/><path d="M-11 -50 L11 -50 L0 -32 Z" fill="#ffd23f" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round"/>${trefoil(0, -44, 0.32, '#1a1a1a')}</g>`).join('')}
      ${fr ? `<circle cx="${f(w * .3)}" cy="-14" r="2.4" fill="#d8ff6a"/><circle cx="${f(w * .62)}" cy="-24" r="2" fill="#d8ff6a"/><circle cx="${f(w * .8)}" cy="-10" r="1.6" fill="#d8ff6a"/>` : `<circle cx="${f(w * .45)}" cy="-8" r="1.8" fill="#d8ff6a"/>`}`;
  },
  platform(w) {
    // a metal catwalk with hazard edging
    return `<rect x="0" y="0" width="${w}" height="12" fill="#b8c0c8" stroke="#3a424c" stroke-width="2.5"/>
      ${Array.from({ length: Math.floor(w / 12) }, (_, i) => `<path d="M${i * 12 + 2} 2 l8 8 M${i * 12 + 10} 2 l-8 8" stroke="#8a949e" stroke-width="1"/>`).join('')}
      <path d="M0 12 h${w}" stroke="#ffd23f" stroke-width="3"/>
      <path d="M10 12 l-6 14 M${w - 10} 12 l6 14" stroke="#5a646e" stroke-width="3"/>`;
  }
};

export const MAP_ART_3 = { savanna, market, moon };
