// Service worker enxuto do app de finanças.
// Estratégia conservadora: SEMPRE tenta a rede primeiro (assim o site nunca
// "trava" numa versão antiga) e só cai no cache quando está offline / sem
// internet. As chamadas de dados (/api/...) nunca são cacheadas, pra não
// mostrar número velho nem atrapalhar o salvamento.
const CACHE = 'financas-v1';

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

// ---- Notificações push (lembretes do caderno) ----
self.addEventListener('push', (e) => {
  let dado = {};
  try { dado = e.data ? e.data.json() : {}; } catch { dado = { corpo: e.data ? e.data.text() : '' }; }
  const titulo = dado.titulo || 'Nossa Casa';
  const opcoes = {
    body: dado.corpo || 'Você tem um lembrete.',
    icon: '/apple-touch-icon.png',
    badge: '/favicon-32.png',
    tag: dado.tag || 'lembrete',
    data: { url: dado.url || '/?aba=caderno' },
  };
  e.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const alvo = (e.notification.data && e.notification.data.url) || '/?aba=caderno';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cls) => {
      for (const c of cls) { if ('focus' in c) { c.navigate(alvo); return c.focus(); } }
      if (self.clients.openWindow) return self.clients.openWindow(alvo);
    })
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
