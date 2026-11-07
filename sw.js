const CACHE = 'wedding-planner-v9';
const SHELL = ['./', './index.html', './config.js', './styles.css', './vendor/supabase.js', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Stale-while-revalidate untuk aset; API Supabase selalu langsung ke jaringan.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  if (new URL(req.url).hostname.endsWith('supabase.co')) return;
  const u = new URL(req.url);
  const fresh = req.mode === 'navigate' || (u.origin === location.origin && /\/(index\.html|config\.js|styles\.css)?$/.test(u.pathname));
  if (fresh) {
    e.respondWith(fetch(req).then((res) => { const c = res.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return res; })
      .catch(() => caches.match(req).then((m) => m || caches.match('./index.html'))));
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: false });
      const network = fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
