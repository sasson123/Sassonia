const CACHE = 'sassonia-v2'
const PRECACHE = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  // API requests handled by app-level offline logic (offlineSync.js), not SW
  if (url.pathname.startsWith('/api/')) return

  // Cache-first with background revalidate for app shell
  // Serves cached version instantly (no network wait on bad connectivity),
  // then updates cache in background for next load
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (res.ok) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        }
        return res
      }).catch(() => cached)

      return cached || fetchPromise
    })
  )
})
