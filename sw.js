// Precache the app shell and theme; serve cache first and refresh in the background.
const CACHE = 'versus-v3';
const THEME = 'themes/classic/';
const CHARS = ['sword', 'spear', 'axe', 'dagger', 'fist', 'stag', 'genghis'];
const MAPS = ['lava', 'jungle', 'seoul', 'tundra'];
const PRECACHE = [
  './', 'index.html', 'style.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
  ...['main', 'config', 'layout', 'mapgen', 'camera', 'fighter', 'combat', 'ai', 'input', 'assets', 'render', 'game'].map(m => `js/${m}.js`),
  THEME + 'theme.json',
  ...CHARS.flatMap(c => [`${THEME}characters/${c}.svg`, `${THEME}portraits/${c}.svg`]),
  ...MAPS.flatMap(m => ['far', 'ground', 'trap', 'platforms'].map(l => `${THEME}maps/${m}/${l}.svg`))
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || fresh;
  }));
});
