// Service worker enxuto do PicoOs.
// Estratégia conservadora: SEMPRE tenta a rede primeiro (assim o site nunca
// "trava" numa versão antiga) e só cai no cache quando está offline / sem
// internet. As chamadas de dados (/api/...) nunca são cacheadas, pra não
// mostrar número velho nem atrapalhar o salvamento.
const CACHE = 'picoos-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // POST de dados passa direto pra rede
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // recursos externos: não intervém
  if (url.pathname.startsWith('/api/')) return; // dados: sempre rede, sem cache

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
  );
});
