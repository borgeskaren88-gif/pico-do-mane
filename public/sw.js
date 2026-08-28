// Service worker enxuto do PicoOS.
// Estratégia conservadora: SEMPRE tenta a rede primeiro (assim o site nunca
// "trava" numa versão antiga) e só cai no cache quando está offline / sem
// internet. As chamadas de dados (/api/...) nunca são cacheadas, pra não
// mostrar número velho nem atrapalhar o salvamento.
const CACHE = 'picoos-v2';

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

// --- Notificações (push) ---
// Chega um aviso do servidor mesmo com o app fechado: mostra a notificação.
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = {}; }
  const title = data.title || 'PicoOS';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
    tag: data.tag || undefined,
    renotify: !!data.tag,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Tocar na notificação: foca uma aba já aberta ou abre o app na tela certa.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const alvo = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) { if ('focus' in c) { c.navigate && c.navigate(alvo); return c.focus(); } }
      if (self.clients.openWindow) return self.clients.openWindow(alvo);
    })
  );
});
