const CACHE = 'sassonia-v1.3.7'
const PRECACHE = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  } else if (event.data === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => self.clients.claim())
    )
  }
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)

  // API requests handled by app-level offline logic (offlineSync.js), not SW
  if (url.pathname.startsWith('/api/')) return

  // 1. Navigation requests (HTML pages): Network-first with offline cache fallback
  // This ensures online users always get the newest app version immediately
  if (e.request.mode === 'navigate' || e.request.destination === 'document' || url.pathname === '/') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(e.request, clone))
          }
          return res
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('/')))
    )
    return
  }

  // 2. Static hashed assets, images, icons: Stale-While-Revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          }
          return res
        })
        .catch(() => cached)

      return cached || fetchPromise
    })
  )
})
