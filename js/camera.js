import { VIEW_W, WORLD_W, CAMERA_MARGIN } from './config.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Keeps both fighters inside the view. The view follows a fighter pushing an
// edge, unless the other fighter is pinned to the opposite edge — then the
// camera stays and the pushing fighter is blocked. Mutates fighter x.
export function constrainCamera(cam, a, b) {
  const m = CAMERA_MARGIN;
  const lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x);
  let c = cam;
  if (hi - lo <= VIEW_W - 2 * m) {
    if (hi > c + VIEW_W - m) c = hi - (VIEW_W - m);
    if (lo < c + m) c = lo - m;
  }
  c = clamp(c, 0, WORLD_W - VIEW_W);
  for (const f of [a, b]) f.x = clamp(f.x, c + m, c + VIEW_W - m);
  return c;
}
