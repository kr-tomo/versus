// Supply drops (recovery mode): a themed carrier per map lowers a healing item.
// carrier(flap): drawn above its hook point (0,0); flap 0/1 alternates wings, rotors or panels.
// item(): drawn with its bottom centre at (0,0), about 24px tall.
import { OL, f } from './rig.js';

const S = (w = 2) => `stroke="${OL}" stroke-width="${w}" stroke-linejoin="round"`;

// a generic bird hovering with wings up (flap 0) or down (flap 1); talons hold the hook at (0,0)
function bird({ body, wing, head, beak = '#f2b02a', eye = OL, crest = '' }, flap) {
  const wy = flap ? 8 : -24, wy2 = flap ? 4 : -14;
  return `<path d="M-6 -16 Q-26 ${wy2} -42 ${wy} Q-30 ${wy2 + 6} -10 -8 Z" fill="${wing}" ${S()}/>
    <path d="M0 -4 v4 M-4 -4 l-2 4 M4 -4 l2 4" stroke="${OL}" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse cx="0" cy="-14" rx="17" ry="10" fill="${body}" ${S(2.2)}/>
    <path d="M-16 -16 l-10 -4 l2 6 l-8 2 l10 4 Z" fill="${body}" ${S(1.6)}/>
    <circle cx="15" cy="-20" r="8" fill="${head}" ${S(2.2)}/>${crest}
    <path d="M22 -21 l9 3 l-9 4 Z" fill="${beak}" ${S(1.4)}/>
    <circle cx="17" cy="-22" r="1.6" fill="${eye}"/>
    <path d="M6 -16 Q26 ${wy2} 42 ${wy} Q30 ${wy2 + 6} 10 -8 Z" fill="${wing}" ${S()}/>`;
}

export const SUPPLY_ART = {
  // savanna: an eagle with an apple
  savanna: {
    carrier: fl => bird({ body: '#6a4a2a', wing: '#5a3a1e', head: '#f4f0e6' }, fl),
    item: () => `<path d="M0 -2 Q-12 0 -12 -12 Q-12 -22 -3 -21 Q0 -19 3 -21 Q12 -22 12 -12 Q12 0 0 -2 Z" fill="#d8262a" ${S()}/>
      <path d="M0 -20 q1 -5 3 -7" stroke="#5a3a1e" stroke-width="2.4" fill="none"/><path d="M2 -23 q6 -6 10 -1 q-6 3 -10 1 Z" fill="#4a9a3a" ${S(1.2)}/>
      <path d="M-7 -15 q2 -4 5 -4" stroke="#ff9a8a" stroke-width="2" fill="none"/>`
  },
  // moon base: a satellite carrying a battery
  moon: {
    carrier: fl => `<path d="M0 -6 v6" stroke="#9aa2ab" stroke-width="2.4"/>
      <rect x="-12" y="-28" width="24" height="22" rx="3" fill="#d8dde3" ${S(2.2)}/><rect x="-7" y="-24" width="14" height="8" fill="#3a6ab0"/>
      ${[-1, 1].map(s => `<path d="M${s * 12} -17 h${s * 6}" stroke="${OL}" stroke-width="2"/><rect x="${s > 0 ? 18 : -46}" y="-26" width="28" height="18" fill="${fl ? '#4a7ad0' : '#2a5ab0'}" ${S(1.8)}/>
        <path d="M${s > 0 ? 25 : -39} -26 v18 M${s > 0 ? 32 : -32} -26 v18 M${s > 0 ? 39 : -25} -26 v18 M${s > 0 ? 18 : -46} -17 h28" stroke="#9ec4ff" stroke-width="1"/>`).join('')}
      <path d="M0 -28 v-8" stroke="${OL}" stroke-width="2"/><circle cx="0" cy="-38" r="3" fill="#ff5a3c" ${S(1.4)}/>
      ${fl ? '<circle cx="0" cy="-38" r="6" fill="#ff5a3c" opacity=".35"/>' : ''}`,
    item: () => `<rect x="-8" y="-24" width="16" height="24" rx="2" fill="#3aa84a" ${S()}/><rect x="-4" y="-28" width="8" height="4" fill="#c8ccd2" ${S(1.4)}/>
      <rect x="-8" y="-8" width="16" height="8" fill="#1e1e24"/><path d="M-3 -16 h6 M0 -19 v6" stroke="#fff" stroke-width="2"/>`
  },
  // Egypt: the sun god (falcon-headed, sun disk) lowers a water jar
  egypt: {
    carrier: fl => {
      const wy = fl ? 4 : -18;
      return `${[-1, 1].map(s => `<path d="M${s * 6} -18 Q${s * 30} ${wy - 6} ${s * 46} ${wy} L${s * 44} ${wy + 6} Q${s * 28} ${wy + 2} ${s * 8} -10 Z" fill="#2a6ab0" ${S(1.8)}/>
        ${[0, 1, 2].map(k => `<path d="M${s * (16 + k * 9)} ${f(wy * (0.4 + k * 0.2) - 10 + k)} l${s * 4} 8" stroke="#e8c45a" stroke-width="2"/>`).join('')}`).join('')}
        <path d="M-8 -22 L8 -22 L10 0 L-10 0 Z" fill="#f4eed8" ${S(2)}/><rect x="-9" y="-12" width="18" height="4" fill="#2a6ab0"/>
        <circle cx="0" cy="-30" r="8" fill="#3a6a8a" ${S(2)}/><path d="M6 -31 l7 3 l-7 3 Z" fill="#e8c45a" ${S(1.2)}/><circle cx="3" cy="-32" r="1.5" fill="#fff"/>
        <circle cx="0" cy="-46" r="9" fill="#ffd23f" ${S(2)}/><circle cx="0" cy="-46" r="13" fill="#ffd23f" opacity=".3"/>
        <path d="M-6 -38 Q0 -34 6 -38" stroke="#c23a2a" stroke-width="2" fill="none"/>`;
    },
    item: () => `<path d="M-6 -24 h12 l-2 4 Q12 -16 10 -6 Q8 0 0 0 Q-8 0 -10 -6 Q-12 -16 -4 -20 Z" fill="#c8743a" ${S()}/>
      <path d="M-9 -12 h18 M-8 -8 h16" stroke="#2a6ab0" stroke-width="2"/><path d="M-3 -26 q3 -3 6 0" stroke="#7ac4f0" stroke-width="2" fill="none"/>`
  },
  // lava: a volcano bat with a roasted sweet potato
  lava: {
    carrier: fl => {
      const wy = fl ? 6 : -16;
      return `${[-1, 1].map(s => `<path d="M${s * 8} -16 Q${s * 22} ${wy - 10} ${s * 42} ${wy} Q${s * 34} ${wy + 2} ${s * 30} ${wy + 8} Q${s * 24} ${wy + 2} ${s * 18} ${wy + 8} Q${s * 14} ${wy} ${s * 6} -8 Z" fill="#4a2a3a" ${S(1.8)}/>`).join('')}
        <ellipse cx="0" cy="-14" rx="9" ry="11" fill="#5a3a4a" ${S(2)}/><path d="M-6 -24 l-2 -8 l5 5 M6 -24 l2 -8 l-5 5" fill="#5a3a4a" ${S(1.6)}/>
        <circle cx="-3" cy="-17" r="1.8" fill="#ffb347"/><circle cx="3" cy="-17" r="1.8" fill="#ffb347"/><path d="M-2 -11 l1 2 l1 -2 M1 -11 l1 2 l1 -2" stroke="#fff" stroke-width="1"/>
        <path d="M0 -4 v4" stroke="${OL}" stroke-width="2.4"/>`;
    },
    item: () => `<path d="M-13 -8 Q-12 -20 0 -20 Q14 -20 13 -9 Q10 0 -2 -1 Q-12 0 -13 -8 Z" fill="#8a3a5a" ${S()}/>
      <path d="M-2 -18 Q8 -18 9 -10 Q6 -4 -2 -5 Z" fill="#ffc83a"/><path d="M-6 -20 q-2 -4 0 -6 M0 -21 q2 -4 0 -7" stroke="#e8e0d0" stroke-width="1.6" fill="none" opacity=".8"/>`
  },
  // jungle: a parrot with a banana bunch
  jungle: {
    carrier: fl => bird({ body: '#2aa84a', wing: '#2a6ad0', head: '#e8402a', beak: '#f4efe4', crest: '<path d="M12 -27 l-4 -8 l6 4 l0 -7 l4 8" fill="#ffd23f" stroke="#18131f" stroke-width="1.2"/>' }, fl),
    item: () => [-6, 0, 6].map((x, i) => `<path d="M${x} -24 Q${x - 10} -12 ${x - 2} 0 Q${x - 4} -12 ${x + 4} -22 Z" fill="#ffd23f" ${S(1.6)} transform="rotate(${(i - 1) * 14} ${x} -24)"/>`).join('')
      + `<rect x="-3" y="-28" width="6" height="5" fill="#6a4a1e" ${S(1.2)}/>`
  },
  // Seoul: a delivery drone with a triangle kimbap
  seoul: {
    carrier: fl => `${[-1, 1].map(s => `<path d="M${s * 8} -20 L${s * 26} -26" stroke="${OL}" stroke-width="3"/>
        <ellipse cx="${s * 28}" cy="-28" rx="${fl ? 14 : 4}" ry="2.4" fill="${fl ? 'rgba(200,210,230,.6)' : '#3a3a44'}" ${fl ? '' : S(1.2)}/>
        ${fl ? '' : `<path d="M${s * 18} -28 h20" stroke="#3a3a44" stroke-width="2.4"/>`}`).join('')}
      <rect x="-12" y="-24" width="24" height="12" rx="4" fill="#f4f6f8" ${S(2.2)}/><circle cx="0" cy="-18" r="3" fill="#2a2a32"/><circle cx="8" cy="-21" r="1.4" fill="${fl ? '#5aff6a' : '#2a8a3a'}"/>
      <path d="M0 -12 v12" stroke="#9aa2ab" stroke-width="2"/>`,
    item: () => `<path d="M0 -24 L12 -2 Q12 0 10 0 L-10 0 Q-12 0 -12 -2 Z" fill="#f8f8f4" ${S()}/>
      <rect x="-8" y="-10" width="16" height="10" fill="#1e3a24"/><path d="M-4 -16 h8" stroke="#e8402a" stroke-width="2"/>`
  },
  // tundra: a snowy owl with a fish
  tundra: {
    carrier: fl => {
      const wy = fl ? 6 : -20;
      return `${[-1, 1].map(s => `<path d="M${s * 8} -18 Q${s * 26} ${wy - 4} ${s * 40} ${wy} Q${s * 26} ${wy + 6} ${s * 8} -8 Z" fill="#eef2f6" ${S(1.8)}/>
        <path d="M${s * 20} ${f((wy - 18) / 2)} l2 1 M${s * 28} ${f((wy - 10) / 2)} l2 1" stroke="#7a8a9a" stroke-width="1.6"/>`).join('')}
        <ellipse cx="0" cy="-16" rx="12" ry="14" fill="#f8fafc" ${S(2.2)}/>
        <circle cx="-5" cy="-20" r="4" fill="#ffd23f" ${S(1.4)}/><circle cx="5" cy="-20" r="4" fill="#ffd23f" ${S(1.4)}/>
        <circle cx="-5" cy="-20" r="1.8" fill="${OL}"/><circle cx="5" cy="-20" r="1.8" fill="${OL}"/><path d="M-2 -15 l2 3 l2 -3 Z" fill="#3a3a44"/>
        <path d="M-6 -8 l1 1 M0 -6 l1 1 M6 -8 l1 1" stroke="#9aa8b8" stroke-width="1.4"/><path d="M0 -3 v3" stroke="${OL}" stroke-width="2.4"/>`;
    },
    item: () => `<g transform="rotate(-90)"><path d="M0 -8 Q12 -12 22 -2 Q12 8 0 4 Z" fill="#9ab4c8" ${S()}/><path d="M0 -2 L-8 -9 L-6 -2 L-8 5 Z" fill="#9ab4c8" ${S(1.6)}/><circle cx="16" cy="-3" r="1.6" fill="${OL}"/></g>`
  },
  // panokseon deck: a stingray kite (gaori-yeon) with a rice ball
  ship: {
    carrier: fl => `<path d="M0 -50 L22 -28 L0 -8 L-22 -28 Z" fill="#f4efe0" ${S(2)}/>
      <path d="M0 -50 V-8 M-22 -28 H22" stroke="#c23a2a" stroke-width="2"/><circle cx="0" cy="-28" r="6" fill="#2a55b0" ${S(1.4)}/>
      <path d="M-14 -20 q-10 ${fl ? 8 : 14} -6 ${fl ? 22 : 18} M14 -20 q10 ${fl ? 14 : 8} 6 ${fl ? 18 : 22}" stroke="#e8402a" stroke-width="2.4" fill="none"/>
      <path d="M0 -8 v8" stroke="#8a6a3a" stroke-width="1.6"/>`,
    item: () => `<path d="M-11 -2 Q-14 -14 -6 -21 Q0 -25 6 -21 Q14 -14 11 -2 Q0 2 -11 -2 Z" fill="#f8f8f4" ${S()}/>
      <rect x="-10" y="-11" width="20" height="9" rx="2" fill="#1e3a24"/><circle cx="-4" cy="-17" r="1.2" fill="#2a2a2a"/>`
  },
  // library: a paper airplane with a bottle of banana milk
  library: {
    carrier: fl => `<path d="M-30 -24 L28 ${fl ? -18 : -20} L-12 -10 Z" fill="#fbfbf6" ${S(2)}/>
      <path d="M-12 -10 L28 ${fl ? -18 : -20} L-18 -4 Z" fill="#e2e4dc" ${S(2)}/><path d="M-30 -24 L-12 -10" stroke="#b8bab0" stroke-width="1.4"/>
      <path d="M-4 -8 v8" stroke="#9a9a9a" stroke-width="1.4"/>${fl ? '<path d="M-38 -20 h-8 M-36 -14 h-10" stroke="#c8ccd6" stroke-width="1.6"/>' : ''}`,
    item: () => `<path d="M-9 -2 Q-12 -10 -8 -16 L-5 -20 h10 L8 -16 Q12 -10 9 -2 Q0 2 -9 -2 Z" fill="#ffd96a" ${S()}/>
      <rect x="-5" y="-26" width="10" height="6" rx="1.5" fill="#2a8a4a" ${S(1.4)}/><path d="M-6 -11 h12" stroke="#e0a82a" stroke-width="2"/>`
  },
  // Rome: a golden eagle (aquila) with a bunch of grapes
  rome: {
    carrier: fl => bird({ body: '#d4a017', wing: '#c08a10', head: '#e8c040', beak: '#8a5a10' }, fl),
    item: () => [[0, -22], [-5, -17], [5, -17], [-7, -11], [0, -11], [7, -11], [-3, -5], [3, -5], [0, 0]].map(([x, y]) => `<circle cx="${x}" cy="${y - 3}" r="4" fill="#7a3a9a" ${S(1.2)}/>`).join('')
      + `<path d="M0 -27 q2 -4 6 -4" stroke="#5a3a1e" stroke-width="2" fill="none"/><path d="M2 -28 q6 -6 10 0 q-6 2 -10 0 Z" fill="#4a9a3a" ${S(1)}/>`
  },
  // traditional market: a magpie with a fish-shaped bungeoppang
  market: {
    carrier: fl => bird({ body: '#1e2030', wing: '#2a3a6a', head: '#1e2030', beak: '#3a3a44', eye: '#fff' }, fl)
      + '<path d="M-10 -12 q10 6 20 0" stroke="#f4f6fa" stroke-width="4" fill="none"/>',
    item: () => `<g transform="translate(0 -12)"><path d="M-14 0 Q-4 -12 10 -6 L14 0 L10 6 Q-4 12 -14 0 Z" fill="#c8843a" ${S()}/>
      <path d="M-14 0 L-20 -7 L-18 0 L-20 7 Z" fill="#c8843a" ${S(1.6)}/><circle cx="7" cy="-2" r="1.6" fill="${OL}"/>
      <path d="M-6 -4 q3 4 0 8 M0 -5 q3 5 0 10" stroke="#8a5a2a" stroke-width="1.4" fill="none"/></g>`
  }
};
