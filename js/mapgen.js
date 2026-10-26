import { MAPS, WORLD_W, GROUND_Y, PLATFORM_WIDTHS, SPAWN_X, SPAWN_SAFE } from './config.js';

export const EDGE = 40;
export const TRAP_GAP = 120;
export const PLATFORM_GAP = 40;

export function seededRandom(seed) {
  let s = Math.abs(Math.floor(seed)) % 2147483646 + 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const gapBetween = (a1, a2, b1, b2) => Math.max(b1 - a2, a1 - b2);

function placeTraps(cfg, n, rand) {
  const w = cfg.trapWidth, traps = [];
  for (let i = 0; i < n; i++) {
    let ok = false;
    for (let t = 0; t < 60 && !ok; t++) {
      const x = Math.round(EDGE + rand() * (WORLD_W - EDGE * 2 - w));
      const clearSpawn = SPAWN_X.every(sx => gapBetween(x, x + w, sx - SPAWN_SAFE, sx + SPAWN_SAFE) > 0);
      const clearTraps = traps.every(o => gapBetween(x, x + w, o.x, o.x + o.w) >= TRAP_GAP);
      if (clearSpawn && clearTraps) { traps.push({ x, w }); ok = true; }
    }
    if (!ok) return null;
  }
  return traps.sort((a, b) => a.x - b.x);
}

function placePlatforms(cfg, n, rand) {
  const plats = [];
  const [lo, hi] = cfg.platformRise;
  for (let i = 0; i < n; i++) {
    let ok = false;
    for (let t = 0; t < 60 && !ok; t++) {
      const w = PLATFORM_WIDTHS[Math.floor(rand() * PLATFORM_WIDTHS.length)];
      const x = Math.round(EDGE + rand() * (WORLD_W - EDGE * 2 - w));
      const rise = Math.round(lo + rand() * (hi - lo));
      if (plats.every(o => gapBetween(x, x + w, o.x, o.x + o.w) >= PLATFORM_GAP)) { plats.push({ x, y: GROUND_Y - rise, w }); ok = true; }
    }
    if (!ok) return null;
  }
  return plats.sort((a, b) => a.x - b.x);
}

// Random layout within the map's safe ranges. Same seed → same layout.
export function generateMap(mapId, seed) {
  const cfg = MAPS[mapId];
  const rand = seededRandom(seed);
  const pick = ([a, b]) => a + Math.floor(rand() * (b - a + 1));
  let nt = pick(cfg.traps), np = pick(cfg.platforms);
  for (let attempt = 0; attempt < 100; attempt++) {
    const traps = placeTraps(cfg, nt, rand);
    const platforms = traps && placePlatforms(cfg, np, rand);
    if (traps && platforms) return { id: mapId, traps, platforms };
    if (attempt % 20 === 19) { nt = Math.max(cfg.traps[0], nt - 1); np = Math.max(cfg.platforms[0], np - 1); }
  }
  throw new Error(`cannot place map ${mapId}`);
}

// Checks the safety rules; returns a list of violations (empty when valid).
export function validateMap(layout) {
  const cfg = MAPS[layout.id], errors = [];
  const { traps, platforms } = layout;
  if (traps.length < cfg.traps[0] || traps.length > cfg.traps[1]) errors.push('trap count');
  if (platforms.length < cfg.platforms[0] || platforms.length > cfg.platforms[1]) errors.push('platform count');
  traps.forEach((t, i) => {
    if (t.x < EDGE || t.x + t.w > WORLD_W - EDGE) errors.push(`trap ${i} out of bounds`);
    if (SPAWN_X.some(sx => gapBetween(t.x, t.x + t.w, sx - SPAWN_SAFE, sx + SPAWN_SAFE) <= 0)) errors.push(`trap ${i} on spawn`);
    if (i > 0 && gapBetween(t.x, t.x + t.w, traps[i - 1].x, traps[i - 1].x + traps[i - 1].w) < TRAP_GAP) errors.push(`trap ${i} too close`);
  });
  platforms.forEach((p, i) => {
    const rise = GROUND_Y - p.y;
    if (rise < cfg.platformRise[0] || rise > cfg.platformRise[1]) errors.push(`platform ${i} height`);
    if (p.x < EDGE || p.x + p.w > WORLD_W - EDGE) errors.push(`platform ${i} out of bounds`);
    if (!PLATFORM_WIDTHS.includes(p.w)) errors.push(`platform ${i} width`);
    if (i > 0 && gapBetween(p.x, p.x + p.w, platforms[i - 1].x, platforms[i - 1].x + platforms[i - 1].w) < PLATFORM_GAP) errors.push(`platform ${i} too close`);
  });
  return errors;
}
