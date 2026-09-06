// refreshApp.js — Force full application refresh, clear all caches & service workers

export async function forceFullRefresh() {
  try {
    // 1. Tell active Service Worker to clear its caches and skip waiting
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('CLEAR_CACHE')
      navigator.serviceWorker.controller.postMessage('SKIP_WAITING')
    }

    // 2. Clear all CacheStorage in the browser
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }

    // 3. Unregister all existing Service Workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(r => r.unregister()))
    }
  } catch (err) {
    console.warn('Cache clearing notice:', err)
  }

  // 4. Force hard reload with a cache-busting timestamp param
  const target = window.location.origin + window.location.pathname + '?_reload=' + Date.now()
  window.location.replace(target)
}
