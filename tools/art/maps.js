// Map art split into sprite layers.
// far():  1280x360 background (scrolls with parallax)
// ground(): drawn in map coords; published with viewBox "0 316 1280 44"
// trap(w, frame): local coords, x 0..w, ground surface y=0
// platform(w): local coords, x 0..w, top surface y=0
import { OL, f, rng } from './rig.js';

export const G = 316;
export const PLATFORM_WIDTHS = [120, 150, 180, 210];

const lava = {
  far() {
    const r = rng(7); let s = `<defs>
      <linearGradient id="lvSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c0607"/><stop offset=".6" stop-color="#5a1408"/><stop offset="1" stop-color="#c2410c"/></linearGradient>
      <radialGradient id="lvGlow"><stop offset="0" stop-color="#ffb347" stop-opacity=".9"/><stop offset="1" stop-color="#ff4500" stop-opacity="0"/></radialGradient></defs>
      <rect width="1280" height="360" fill="url(#lvSky)"/>
      <circle cx="345" cy="95" r="140" fill="url(#lvGlow)" opacity=".7"/>`;
    for (let i = 0; i < 9; i++) s += `<circle cx="${f(345 + i * 9 - 30 + r() * 20)}" cy="${70 - i * 7}" r="${16 + i * 3}" fill="#2a1414" opacity="${f(0.55 - i * 0.04)}"/>`;
    s += `<polygon points="0,250 120,175 210,195 330,92 360,92 470,200 600,165 760,230 860,130 885,128 1000,215 1140,175 1280,235 1280,360 0,360" fill="#3a1411"/>
      <path d="M338 96 Q330 140 302 168 Q290 190 262 206" stroke="#ff7b1c" stroke-width="4" fill="none" opacity=".85"/>
      <path d="M352 96 Q360 130 380 150 Q400 175 420 182" stroke="#ff9a2a" stroke-width="3" fill="none" opacity=".75"/>
      <path d="M872 130 Q866 160 850 180" stroke="#ff7b1c" stroke-width="2.5" fill="none" opacity=".6"/>
      <polygon points="0,290 80,262 150,280 260,250 380,284 520,258 640,286 760,260 880,282 1010,255 1140,284 1280,262 1280,360 0,360" fill="#24100e"/>`;
    for (let i = 0; i < 40; i++) s += `<circle cx="${f(r() * 1280)}" cy="${f(r() * 290)}" r="${f(.8 + r() * 1.6)}" fill="#ffb347" opacity="${f(.4 + r() * .6)}"/>`;
    return s;
  },
  ground() {
    const r = rng(8);
    let s = `<rect y="${G}" width="1280" height="44" fill="#2b1f1d"/><rect y="${G}" width="1280" height="4" fill="#4a302a"/>`;
    for (let i = 0; i < 22; i++) { const x = r() * 1280, y = G + 10 + r() * 26; s += `<polyline points="${f(x)},${f(y)} ${f(x + 10 + r() * 10)},${f(y + 4)} ${f(x + 18 + r() * 14)},${f(y - 2)}" stroke="#ff6a00" stroke-width="1.5" fill="none" opacity=".7"/>`; }
    return s;
  },
  trap(w, fr) {
    const r = rng(40 + fr);
    let s = `<defs><linearGradient id="lvMag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset=".35" stop-color="#ff8a1a"/><stop offset="1" stop-color="#b3200a"/></linearGradient>
      <radialGradient id="lvGlow2"><stop offset="0" stop-color="#ffb347" stop-opacity=".9"/><stop offset="1" stop-color="#ff4500" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="${w / 2}" cy="0" rx="${w / 2 + 16}" ry="${26 + fr * 4}" fill="url(#lvGlow2)" opacity=".8"/>
      <rect x="0" y="2" width="${w}" height="42" fill="url(#lvMag)"/>
      <path d="M0 ${4 + fr * 2} Q${w * .25} ${fr ? 6 : -2} ${w * .5} ${4} T${w} ${4 + fr * 2}" stroke="#fff3a8" stroke-width="2.5" fill="none"/>
      <path d="M-4 0 L2 44 M${w + 4} 0 L${w - 2} 44" stroke="#160c0a" stroke-width="6"/>`;
    for (let i = 0; i < 4; i++) s += `<circle cx="${f(12 + r() * (w - 24))}" cy="${f(6 + r() * 14)}" r="${f(2 + r() * 4)}" fill="#ffe066" stroke="#ff8a1a" stroke-width="1.5"/>`;
    if (fr) s += `<circle cx="${f(w * .3)}" cy="-12" r="2.5" fill="#ffb347"/><circle cx="${f(w * .7)}" cy="-20" r="2" fill="#ffe066"/>`;
    return s;
  },
  platform(w) {
    return `<path d="M0 0 h${w} l-8 20 h${-(w - 16)} z" fill="#3d2b27" stroke="#160c0a" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M4 2 h${w - 8}" stroke="#6a4a40" stroke-width="3"/>
      <path d="M20 8 l14 4 l10 -3 M${w - 50} 9 l12 3" stroke="#ff7a1a" stroke-width="1.5" fill="none" opacity=".8"/>
      <path d="M30 20 q3 10 0 14 M${w - 34} 20 q-2 7 1 10" stroke="#ff7a1a" stroke-width="2" fill="none" opacity=".7"/>`;
  }
};

const fish = (cx, cy, a) => `<g transform="translate(${cx} ${cy}) rotate(${a})">
  <path d="M-14 0 Q-4 -10 10 -4 L14 0 L10 4 Q-4 10 -14 0 Z" fill="#6f7f8a" stroke="${OL}" stroke-width="2"/>
  <path d="M-4 3 Q4 8 12 2" fill="#d23b2e"/><path d="M-14 0 L-22 -7 L-20 0 L-22 7 Z" fill="#6f7f8a" stroke="${OL}" stroke-width="2"/>
  <circle cx="6" cy="-2" r="1.6" fill="${OL}"/><path d="M10 2 l1 2 l1 -2 l1 2" stroke="#fff" stroke-width="1" fill="none"/></g>`;

const jungle = {
  far() {
    const r = rng(11); let s = `<defs><linearGradient id="jgSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3f3cf"/><stop offset="1" stop-color="#8cc79a"/></linearGradient></defs>
      <rect width="1280" height="360" fill="url(#jgSky)"/>`;
    for (let x = -20; x < 1320; x += 55) s += `<circle cx="${x}" cy="${f(175 + r() * 30)}" r="${f(48 + r() * 20)}" fill="#7db88a"/>`;
    s += `<rect y="190" width="1280" height="170" fill="#7db88a"/>`;
    for (let x = 10; x < 1300; x += 70 + r() * 60) s += `<rect x="${f(x)}" y="120" width="${f(8 + r() * 6)}" height="240" fill="#5f8f68"/>`;
    for (let x = -30; x < 1320; x += 46) s += `<circle cx="${x}" cy="${f(130 + r() * 30)}" r="${f(34 + r() * 16)}" fill="#5c9f6c"/>`;
    for (let x = 30; x < 1280; x += 150 + r() * 80) {
      s += `<path d="M${f(x)} 360 L${f(x + 4)} 60 L${f(x + 26)} 60 L${f(x + 32)} 360 Z" fill="#4b3626" stroke="#2d1f15" stroke-width="2"/>
        <path d="M${f(x + 10)} 300 Q${f(x + 14)} 200 ${f(x + 12)} 90" stroke="#3a2a1d" stroke-width="2" fill="none"/>`;
    }
    for (let x = -40; x < 1320; x += 38) s += `<circle cx="${x}" cy="${f(30 + r() * 40)}" r="${f(40 + r() * 18)}" fill="${r() > .5 ? '#2f7044' : '#367d4c'}"/>`;
    for (let i = 0; i < 18; i++) {
      const x = r() * 1280, len = 90 + r() * 140;
      s += `<path d="M${f(x)} 40 Q${f(x + 14)} ${f(40 + len / 2)} ${f(x)} ${f(40 + len)}" stroke="#3b7a2f" stroke-width="3" fill="none"/>`;
      for (let k = 0; k < 4; k++) s += `<ellipse cx="${f(x + 5)}" cy="${f(60 + k * len / 4)}" rx="6" ry="3" fill="#4f9a3c" transform="rotate(${k % 2 ? 30 : -30} ${f(x + 5)} ${f(60 + k * len / 4)})"/>`;
    }
    return s;
  },
  ground() {
    return `<rect y="${G}" width="1280" height="44" fill="#5a3a20"/>
      <path d="M0 ${G + 6} ${Array.from({ length: 129 }, (_, i) => `L${i * 10} ${G - (i % 2 ? 6 : 0)}`).join(' ')} L1280 ${G + 6} Z" fill="#3f8f3a"/>
      ${Array.from({ length: 30 }, (_, i) => `<circle cx="${(i * 97) % 1280}" cy="${G + 18 + (i * 7) % 20}" r="${2 + i % 3}" fill="#4a2f19"/>`).join('')}`;
  },
  trap(w, fr) {
    let s = `<defs><linearGradient id="jgWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b8c8c"/><stop offset="1" stop-color="#0b3a44"/></linearGradient></defs>
      <rect x="0" y="0" width="${w}" height="44" fill="url(#jgWater)"/>
      <path d="M0 ${8 - fr * 2} Q${w / 4} ${4 + fr * 4} ${w / 2} ${8} T${w} ${8 - fr * 2}" stroke="#9fe3d9" stroke-width="2" fill="none"/>`;
    for (const sx of [-6, w - 6]) for (let k = 0; k < 3; k++) s += `<ellipse cx="${sx + 6}" cy="${4 + k * 13}" rx="9" ry="7" fill="${['#8d8f86', '#a2a49a', '#77796f'][k]}" stroke="#3a3b35" stroke-width="2"/>`;
    s += fr ? fish(w * .62, -28, -20) + fish(w * .35, 24, 160) : fish(w * .35, -18, -55) + fish(w * .7, 22, 20);
    s += `<path d="M${f(w * .25)} 4 q4 -6 8 0 M${f(w * .5)} 6 q3 -5 6 0" stroke="#e8fbff" stroke-width="2" fill="none"/>`;
    return s;
  },
  platform(w) {
    let s = `<rect x="0" y="0" width="${w}" height="13" rx="2" fill="#8b5a2b" stroke="#3a220f" stroke-width="2.5"/>`;
    for (let k = 18; k < w; k += 18) s += `<line x1="${k}" y1="1" x2="${k}" y2="12" stroke="#5a3718" stroke-width="1.5"/>`;
    return s + `<path d="M3 3 h${w - 6}" stroke="#b07a44" stroke-width="2"/>`;
  },
  extras: { ropes: '#c8a46a' }
};

const seoul = {
  far() {
    const r = rng(23); let s = `<defs>
      <linearGradient id="soSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070b24"/><stop offset=".65" stop-color="#1d2559"/><stop offset="1" stop-color="#4a3270"/></linearGradient>
      <filter id="soGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <rect width="1280" height="360" fill="url(#soSky)"/>`;
    for (let i = 0; i < 50; i++) s += `<circle cx="${f(r() * 1280)}" cy="${f(r() * 140)}" r="${f(.5 + r())}" fill="#fff" opacity="${f(.3 + r() * .6)}"/>`;
    s += `<circle cx="1160" cy="58" r="22" fill="#f5f0d0"/><circle cx="1168" cy="52" r="20" fill="#121a45" opacity=".35"/>
      <path d="M140 320 Q240 230 350 205 Q460 225 560 320 Z" fill="#141a3c"/>
      <rect x="346" y="122" width="7" height="85" fill="#cfd6e6"/><rect x="336" y="126" width="27" height="13" rx="5" fill="#e9eef7" stroke="#8890a8" stroke-width="1.5"/>
      <line x1="349.5" y1="122" x2="349.5" y2="86" stroke="#cfd6e6" stroke-width="2.5"/><circle cx="349.5" cy="85" r="2.5" fill="#ff4d4d" filter="url(#soGlow)"/>
      <polygon points="1003,320 1037,320 1029,95 1020,62 1011,95" fill="#2a335f" stroke="#4b5a95" stroke-width="1.5"/>
      <line x1="1020" y1="70" x2="1020" y2="316" stroke="#7f8fd0" stroke-width="1" opacity=".6"/>`;
    const signs = [['치킨', '#ff4fa3'], ['노래방', '#3ff0ff'], ['PC방', '#6dff7a'], ['편의점', '#ffd84a'], ['약국', '#4fb0ff'], ['떡볶이', '#ff7a3d']];
    let si = 0;
    for (let x = -10; x < 1290;) {
      const w = 46 + r() * 50, h = 60 + r() * 120, col = ['#161c3f', '#1b2250', '#202a5c'][Math.floor(r() * 3)];
      s += `<rect x="${f(x)}" y="${f(G - h)}" width="${f(w)}" height="${f(h + 10)}" fill="${col}" stroke="#0e1230" stroke-width="1.5"/>`;
      for (let wy = G - h + 10; wy < G - 30; wy += 14) for (let wx = x + 7; wx < x + w - 10; wx += 12) if (r() > .45) s += `<rect x="${f(wx)}" y="${f(wy)}" width="6" height="7" fill="#ffd76a" opacity="${f(.45 + r() * .5)}"/>`;
      if (r() > .55 && si < signs.length) { const [t, c] = signs[si++]; s += `<g filter="url(#soGlow)"><rect x="${f(x + 6)}" y="${f(G - h + 12)}" width="${t.length * 14 + 6}" height="20" rx="3" fill="#0b0f26" stroke="${c}" stroke-width="2"/><text x="${f(x + 9)}" y="${f(G - h + 27)}" font-size="13" font-weight="800" fill="${c}" font-family="Apple SD Gothic Neo, Noto Sans KR, sans-serif">${t}</text></g>`; }
      x += w + 4;
    }
    for (const x of [120, 520, 760, 1180]) s += `<line x1="${x}" y1="${G}" x2="${x}" y2="${G - 90}" stroke="#7a7f8f" stroke-width="3"/><path d="M${x} ${G - 90} q10 -4 18 2" stroke="#7a7f8f" stroke-width="3" fill="none"/><circle cx="${x + 18}" cy="${G - 86}" r="4" fill="#fff4c2" filter="url(#soGlow)"/>`;
    return s;
  },
  ground() {
    let s = `<rect y="${G}" width="1280" height="44" fill="#24262e"/><rect y="${G}" width="1280" height="12" fill="#5d606c"/>`;
    for (let x = 0; x < 1280; x += 24) s += `<line x1="${x}" y1="${G}" x2="${x}" y2="${G + 12}" stroke="#4a4c57" stroke-width="1"/>`;
    for (let x = 10; x < 1280; x += 60) s += `<rect x="${x}" y="${G + 28}" width="30" height="3" fill="#e8e8e8" opacity=".7"/>`;
    return s;
  },
  trap(w, fr) {
    const spark = fr
      ? `<polyline points="12,-4 20,-26 30,-14 38,-36 48,-16 ${w - 18},-30 ${w - 10},-4" stroke="#bff6ff" stroke-width="2.5" fill="none"/><polyline points="24,0 34,-18 46,-6 ${w - 24},-22" stroke="#ffe94d" stroke-width="2" fill="none"/>`
      : `<polyline points="16,-2 26,-22 32,-12 42,-34 48,-18 58,-28 ${w - 10},-4" stroke="#bff6ff" stroke-width="2.5" fill="none"/><polyline points="30,0 38,-14 50,-8 62,-20" stroke="#ffe94d" stroke-width="2" fill="none"/>`;
    return `<defs><filter id="soGlow2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <rect x="6" y="0" width="${w - 12}" height="44" fill="#06070b"/><ellipse cx="${w / 2}" cy="2" rx="${w / 2 - 4}" ry="5" fill="#0b0d14" stroke="#5d606c" stroke-width="2"/>
      <g filter="url(#soGlow2)">${spark}</g>
      <path d="M-6 0 l7 -22 l7 22 z M${w - 8} 0 l7 -22 l7 22 z" fill="#ff7a1a" stroke="#2a1508" stroke-width="1.5"/>
      <path d="M-3 -9 h8 M${w - 5} -9 h8" stroke="#fff" stroke-width="2.5"/>`;
  },
  platform(w) {
    let s = `<rect x="0" y="0" width="${w}" height="12" fill="#f2c230" stroke="#2a2a2a" stroke-width="2.5"/>`;
    for (let k = 4; k < w - 8; k += 16) s += `<path d="M${k} 12 l8 -12 h6 l-8 12 z" fill="#2a2a2a"/>`;
    return s + `<rect x="0" y="12" width="${w}" height="5" fill="#7a7f8f" stroke="#2a2a2a" stroke-width="1.5"/>`;
  },
  extras: { posts: '#9aa3b5' }
};

const tundra = {
  far() {
    const r = rng(31); let s = `<defs>
      <linearGradient id="tdSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#061433"/><stop offset=".6" stop-color="#17336b"/><stop offset="1" stop-color="#6d97c9"/></linearGradient>
      <filter id="tdBlur"><feGaussianBlur stdDeviation="8"/></filter></defs>
      <rect width="1280" height="360" fill="url(#tdSky)"/>`;
    for (let i = 0; i < 70; i++) s += `<circle cx="${f(r() * 1280)}" cy="${f(r() * 170)}" r="${f(.5 + r())}" fill="#fff" opacity="${f(.3 + r() * .7)}"/>`;
    s += `<g filter="url(#tdBlur)" opacity=".55">
        <path d="M-20 90 Q200 30 420 80 T860 60 T1300 70" stroke="#48f5a8" stroke-width="34" fill="none"/>
        <path d="M-20 120 Q260 70 520 115 T1000 95 T1300 110" stroke="#2fd3c8" stroke-width="20" fill="none"/>
        <path d="M200 50 Q480 10 760 45 T1300 30" stroke="#9a7bff" stroke-width="22" fill="none"/></g>
      <polygon points="0,250 90,190 160,215 300,140 420,220 520,180 640,240 760,160 880,210 990,150 1120,220 1280,180 1280,360 0,360" fill="#d6e6f7"/>
      <polygon points="300,140 360,316 420,220" fill="#a9c3e3" opacity=".7"/><polygon points="760,160 820,316 880,210" fill="#a9c3e3" opacity=".7"/><polygon points="990,150 1050,316 1120,220" fill="#a9c3e3" opacity=".7"/>
      <polygon points="0,290 120,270 240,288 380,266 520,290 700,272 860,292 1020,268 1180,290 1280,276 1280,360 0,360" fill="#eaf4ff"/>
      <path d="M1170 ${G} a40 34 0 0 1 80 0 z" fill="#f6fbff" stroke="#a9c3e3" stroke-width="2"/><path d="M1180 ${G - 14} h60 M1188 ${G - 26} h44 M1210 ${G - 34} v20" stroke="#bcd3ec" stroke-width="1.5"/><path d="M1198 ${G} a12 14 0 0 1 24 0 z" fill="#3a5a80"/>`;
    for (let i = 0; i < 60; i++) s += `<circle cx="${f(r() * 1280)}" cy="${f(r() * 300)}" r="${f(.8 + r() * 1.6)}" fill="#fff" opacity="${f(.5 + r() * .5)}"/>`;
    return s;
  },
  ground() {
    return `<rect y="${G}" width="1280" height="44" fill="#f2f8ff"/><rect y="${G + 26}" width="1280" height="18" fill="#cfe0f2"/>
      <path d="M0 ${G} ${Array.from({ length: 32 }, (_, i) => `Q${i * 40 + 20} ${G - 5} ${i * 40 + 40} ${G}`).join(' ')} L1280 ${G + 4} L0 ${G + 4} Z" fill="#ffffff" stroke="#cfe0f2" stroke-width="1.5"/>`;
  },
  trap(w, fr) {
    const dx = fr ? 4 : 0;
    return `<defs><linearGradient id="tdWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d5a8c"/><stop offset="1" stop-color="#061a33"/></linearGradient></defs>
      <path d="M0 2 Q${w / 2} 12 ${w} 2 L${w - 6} 44 L6 44 Z" fill="url(#tdWater)"/>
      <path d="M-8 1 q12 -6 24 0 q14 -5 26 1 q16 -6 30 0 q12 -4 ${w - 72} 0" stroke="#9fc4e6" stroke-width="3" fill="none"/>
      <path d="M-14 8 l10 -4 l-6 10 M${w + 14} 8 l-10 -4 l6 10" stroke="#9fc4e6" stroke-width="1.5" fill="none"/>
      <polygon points="${20 + dx},14 ${34 + dx},10 ${38 + dx},18 ${24 + dx},21" fill="#e3f2ff" stroke="#7fb8e0" stroke-width="1.5"/>
      <polygon points="${58 - dx},22 ${70 - dx},18 ${72 - dx},26" fill="#e3f2ff" stroke="#7fb8e0" stroke-width="1.5"/>
      <ellipse cx="${w / 2}" cy="${-6 - fr * 3}" rx="${w / 2}" ry="10" fill="#e8f6ff" opacity="${fr ? .25 : .38}"/>`;
  },
  platform(w) {
    const r = rng(50 + w);
    let s = `<rect x="0" y="0" width="${w}" height="18" rx="4" fill="#bfe5fb" stroke="#6fa8d6" stroke-width="2.5"/>
      <path d="M6 4 h${f(w * .55)}" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M${f(w * .6)} 3 l-10 12 M${f(w * .3)} 6 l8 9" stroke="#8cc3ea" stroke-width="1.5"/>`;
    for (let k = 10; k < w - 6; k += 14 + r() * 10) s += `<path d="M${f(k)} 18 l4 ${f(8 + r() * 10)} l4 ${f(-(8 + r() * 10))} z" fill="#d6efff" stroke="#6fa8d6" stroke-width="1"/>`;
    return s;
  }
};

export const MAP_ART = { lava, jungle, seoul, tundra };
