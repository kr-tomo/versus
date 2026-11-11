// Precache the whole app per version and serve only from that cache, so files of two versions
// never mix. A new version arrives by changing CACHE; the page reloads once when it takes over.
const CACHE = 'versus-v13';
const THEME = 'themes/classic/';
const CHARS = ['sword', 'spear', 'axe', 'dagger', 'fist', 'stag', 'genghis', 'mace', 'fork', 'tkd', 'archer', 'whip'];
const MAPS = ['lava', 'jungle', 'seoul', 'tundra', 'ship', 'library', 'rome', 'egypt', 'savanna', 'market', 'moon'];
const SFX = ['swing', 'swingHeavy', 'hit', 'hitHeavy', 'guard', 'miss', 'jump', 'land', 'charge', 'super', 'quake', 'ko',
  'round', 'fight', 'trade', 'trap', 'move', 'select', 'back', 'win', 'shout', 'boom', 'bow', 'whirl',
  'chargeUp', 'parry', 'gun', 'crack', 'chomp', 'snip', 'vs', 'heal'];
const PRECACHE = [
  './', 'index.html', 'style.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
  ...['main', 'config', 'layout', 'mapgen', 'camera', 'fighter', 'combat', 'ai', 'input', 'assets', 'stage', 'menu', 'moves', 'game'].map(m => `js/${m}.js`),
  'vendor/phaser-4.2.1.esm.min.js',
  ...SFX.map(n => `sfx/${n}.wav`),
  THEME + 'theme.json', THEME + 'extras/bull.svg', ...MAPS.map(m => `${THEME}extras/supply/${m}.svg`),
  ...CHARS.flatMap(c => [0, 1, 2].map(p => `${THEME}characters/${c}-${p}.svg`).concat(`${THEME}portraits/${c}.svg`)),
  ...MAPS.flatMap(m => ['far', 'ground', 'trap', 'platforms'].map(l => `${THEME}maps/${m}/${l}.svg`))
];

self.addEventListener('install', e => {
  // cache: 'reload' bypasses the HTTP cache so a stale copy can't sneak into the new version
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
    return hit || fetch(req);
  }));
});
