/*
 * Recallify service worker: the offline review shell.
 *
 * What it does, and nothing more:
 *   1. Build output under /_next/static is content-hashed, so it is served
 *      from cache first and never goes stale.
 *   2. App pages are fetched from the network first and kept, so a page that
 *      has been opened once on this device opens again with no connection.
 *   3. Reads from the API (GET /api/v1/...) are fetched from the network first
 *      and kept, so the review queue that was last loaded is still there.
 *
 * Answers given offline are not handled here. They already go into the
 * outbox in localStorage and are sent when the connection returns; see
 * lib/use-review-outbox.ts.
 *
 * Signing out deletes the data cache from the page (lib/auth.ts), so the next
 * person on a shared computer never sees the last one's cards.
 */

const VERSION = 'v1';
const STATIC = `recallify-static-${VERSION}`;
const PAGES = `recallify-pages-${VERSION}`;
const DATA = 'recallify-data';
const KEEP = [STATIC, PAGES, DATA];

const APP_PAGES = ['/today', '/decks', '/review', '/stats', '/settings'];
const OFFLINE_PAGE = '/offline';
const STATIC_LIMIT = 400;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // The offline page holds nothing personal, so it lives with the build
      // files and survives the account change that clears user data. The app
      // pages are a bonus: they only cache if this browser is signed in now.
      await (await caches.open(STATIC)).add(OFFLINE_PAGE).catch(() => undefined);
      const cache = await caches.open(PAGES);
      await Promise.all(
        ['/review', '/today'].map(async (path) => {
          try {
            const response = await fetch(path, { credentials: 'same-origin' });
            if (response.ok && !response.redirected) await cache.put(path, response);
          } catch {
            // Offline during install, or signed out: nothing to keep yet.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith('recallify-') && !KEEP.includes(n)).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'clear-user-data') {
    event.waitUntil(Promise.all([caches.delete(DATA), caches.delete(PAGES)]));
  }
});

function isAppPage(pathname) {
  return APP_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Only a real, complete answer is worth keeping: never a redirect or an error. */
function keepable(response) {
  return response && response.ok && !response.redirected && response.type === 'basic';
}

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i += 1) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (keepable(response)) {
    await cache.put(request, response.clone());
    void trim(STATIC, STATIC_LIMIT);
  }
  return response;
}

async function networkFirst(request, cacheName, fallback) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (keepable(response)) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    if (fallback) {
      const page = await caches.match(fallback);
      if (page) return page;
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/icon.svg') {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.startsWith('/api/v1/')) {
    event.respondWith(networkFirst(request, DATA));
    return;
  }

  if (request.mode === 'navigate' && isAppPage(url.pathname)) {
    event.respondWith(networkFirst(request, PAGES, OFFLINE_PAGE));
  }
});
