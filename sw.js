const CACHE_NAME = 'svuotacoda-static-v1';
const SHARE_CACHE = 'svuotacoda-share-temp';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== SHARE_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercetta la condivisione POST dal menu Condividi di Android (Web Share Target)
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-receiver')) {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const title = formData.get('title') || '';
        const text = formData.get('text') || '';
        const sharedUrl = formData.get('url') || '';
        const mediaFile = formData.get('media');

        const redirectUrl = new URL('./index.html', self.location.href);
        if (title) redirectUrl.searchParams.set('title', String(title));
        if (text) redirectUrl.searchParams.set('text', String(text));
        if (sharedUrl) redirectUrl.searchParams.set('url', String(sharedUrl));

        if (mediaFile && typeof mediaFile === 'object' && mediaFile.size > 0) {
          const shareCache = await caches.open(SHARE_CACHE);
          await shareCache.put('/shared-image', new Response(mediaFile, {
            headers: { 'Content-Type': mediaFile.type || 'image/png' }
          }));
          redirectUrl.searchParams.set('shared_file', '1');
        }

        return Response.redirect(redirectUrl.toString(), 303);
      } catch (err) {
        return Response.redirect('./index.html', 303);
      }
    })());
    return;
  }

  // Strategia Cache-First per i file statici dell'app (funziona anche offline)
  if (event.request.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        }).catch(() => caches.match('./index.html'));
      })
    );
  }
});
