// Synthesizes the sound effects into sfx/*.wav (mono 16-bit, 22.05 kHz).
// Usage: node tools/build-sfx.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'sfx');
mkdirSync(out, { recursive: true });

let seed = 1;
const noise = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * 2 - 1; };
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

// voice(t) → sample; mixes into a buffer of the given length
function render(len, voices) {
  const n = Math.floor(len * RATE), buf = new Float32Array(n);
  for (const v of voices) {
    let lp = 0, phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      if (t < (v.at || 0)) continue;
      const lt = t - (v.at || 0);
      const f = typeof v.freq === 'function' ? v.freq(lt) : v.freq || 0;
      phase += f / RATE;
      let s = 0;
      if (v.type === 'noise') { const x = noise(); lp += (x - lp) * (v.cut ? v.cut(lt) : 1); s = lp; }
      else if (v.type === 'square') s = Math.sign(Math.sin(phase * 2 * Math.PI)) * 0.6;
      else if (v.type === 'saw') s = ((phase % 1) * 2 - 1) * 0.7;
      else s = Math.sin(phase * 2 * Math.PI);
      buf[i] += s * env(lt, v.a ?? 0.002, v.d ?? 0.1) * (v.gain ?? 1);
    }
  }
  return buf;
}

function wav(name, buf, peak = 0.85) {
  const max = buf.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-6), k = peak / max;
  const data = Buffer.alloc(44 + buf.length * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + buf.length * 2, 4); data.write('WAVE', 8);
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(RATE, 24); data.writeUInt32LE(RATE * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(buf.length * 2, 40);
  buf.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * k)) * 32767), 44 + i * 2));
  writeFileSync(join(out, name + '.wav'), data);
}

const SFX = {
  swing:  render(0.22, [{ type: 'noise', cut: t => 0.05 + t * 1.6, a: 0.04, d: 0.06 }]),
  swingHeavy: render(0.38, [{ type: 'noise', cut: t => 0.03 + t * 0.6, a: 0.09, d: 0.1 }, { freq: t => 90 - t * 80, a: 0.08, d: 0.1, gain: 0.4 }]),
  hit:    render(0.25, [{ type: 'noise', cut: () => 0.5, d: 0.03 }, { freq: t => 170 * Math.exp(-t * 9), d: 0.07, gain: 0.9 }]),
  hitHeavy: render(0.5, [{ type: 'noise', cut: t => 0.6 - t, d: 0.07 }, { freq: t => 110 * Math.exp(-t * 5), d: 0.16, gain: 1.2 }, { type: 'square', freq: 55, d: 0.08, gain: 0.25 }]),
  guard:  render(0.4, [{ freq: 1250, d: 0.08, gain: 0.6 }, { freq: 1873, d: 0.06, gain: 0.4 }, { freq: 2960, d: 0.04, gain: 0.3 }, { type: 'noise', cut: () => 0.9, d: 0.01, gain: 0.5 }]),
  miss:   render(0.3, [{ type: 'noise', cut: t => 0.4 - t, a: 0.02, d: 0.08, gain: 0.6 }, { freq: t => 900 + t * 1800, d: 0.08, gain: 0.25 }]),
  jump:   render(0.15, [{ type: 'noise', cut: () => 0.25, d: 0.04, gain: 0.5 }, { freq: t => 220 + t * 900, d: 0.05, gain: 0.25 }]),
  land:   render(0.2, [{ type: 'noise', cut: () => 0.12, d: 0.04 }, { freq: t => 80 - t * 100, d: 0.05, gain: 0.6 }]),
  charge: render(1.0, [{ type: 'saw', freq: t => 110 + t * 330, a: 0.3, d: 0.5, gain: 0.25 }, { freq: t => 220 + t * 660, a: 0.3, d: 0.5, gain: 0.3 }]),
  super:  render(1.0, [
    { type: 'saw', freq: 220, a: 0.01, d: 0.35, gain: 0.35 }, { type: 'saw', freq: 277, a: 0.01, d: 0.35, gain: 0.3 }, { type: 'saw', freq: 330, a: 0.01, d: 0.35, gain: 0.3 },
    { type: 'saw', freq: 440, at: 0.12, d: 0.4, gain: 0.35 }, { type: 'noise', cut: () => 0.2, d: 0.2, gain: 0.4 }]),
  quake:  render(0.9, [{ type: 'noise', cut: () => 0.04, a: 0.01, d: 0.3, gain: 1.4 }, { freq: t => 50 - t * 20, d: 0.3 }]),
  ko:     render(1.2, [{ type: 'noise', cut: t => 0.3 - t * 0.2, d: 0.3 }, { freq: t => 90 * Math.exp(-t * 1.5), d: 0.45, gain: 1.2 }, { type: 'square', freq: t => 60 - t * 20, d: 0.3, gain: 0.3 }]),
  round:  render(0.45, [{ type: 'square', freq: 523, d: 0.12, gain: 0.35 }, { type: 'square', freq: 784, at: 0.12, d: 0.18, gain: 0.35 }]),
  fight:  render(0.6, [{ type: 'square', freq: 659, d: 0.08, gain: 0.3 }, { type: 'square', freq: 784, at: 0.08, d: 0.08, gain: 0.3 }, { type: 'square', freq: 1047, at: 0.16, d: 0.25, gain: 0.35 }]),
  trade:  render(0.35, [{ freq: 1500, d: 0.05, gain: 0.5 }, { freq: 2250, at: 0.04, d: 0.08, gain: 0.5 }, { type: 'noise', cut: () => 0.7, d: 0.02, gain: 0.4 }]),
  trap:   render(0.3, [{ type: 'noise', cut: () => 0.08, a: 0.05, d: 0.1, gain: 0.6 }, { freq: t => 300 + Math.sin(t * 60) * 80, a: 0.05, d: 0.08, gain: 0.25 }]),
  move:   render(0.06, [{ type: 'square', freq: 880, d: 0.02, gain: 0.3 }]),
  select: render(0.16, [{ type: 'square', freq: 660, d: 0.03, gain: 0.3 }, { type: 'square', freq: 990, at: 0.05, d: 0.05, gain: 0.3 }]),
  back:   render(0.14, [{ type: 'square', freq: 520, d: 0.03, gain: 0.3 }, { type: 'square', freq: 350, at: 0.05, d: 0.05, gain: 0.3 }]),
  win:    render(1.1, [523, 659, 784, 1047].map((f, i) => ({ type: 'square', freq: f, at: i * 0.12, d: i === 3 ? 0.4 : 0.1, gain: 0.3 })))
};

for (const [name, buf] of Object.entries(SFX)) wav(name, buf);
console.log(`${Object.keys(SFX).length} sounds written to ${out}`);
export const SFX_NAMES = Object.keys(SFX);
