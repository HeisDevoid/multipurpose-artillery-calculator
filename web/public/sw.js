/*
 * Service worker: the app works offline after the first
 * visit.
 *
 * - The page (navigation): network first, the cache on failure. A new
 *   version is picked up at once, and offline the last one opens.
 * - Build files from assets/ (a hash in the name, never change): cache first.
 * - The rest (icons, the manifest): from the cache, refreshed in parallel.
 *
 * The cache version comes from the registration address (sw.js?v=0.8.0):
 * a new version removes the old caches.
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const CACHE = `artillery-calc-${VERSION}`
const SHELL = ['./', './manifest.webmanifest', './favicon.svg', './icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('artillery-calc-') && key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

async function networkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put('./', response.clone())
    return response
  } catch {
    return (await cache.match('./')) || Response.error()
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => cached)
  return cached || network
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
  } else if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request))
  } else {
    event.respondWith(staleWhileRevalidate(request))
  }
})
