/**
 * AETHER OS — Service Worker v1.0
 * Handles: offline caching, background sync, push notifications
 * File: site/sw.js
 */

const CACHE_NAME    = 'aether-v1';
const WORKER_URL    = 'https://learning-bot.talpadeavi0303.workers.dev';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/site/',
  '/site/index.html',
  '/site/checkin.html',
];

// ─── Install — cache static assets ───────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[AETHER SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[AETHER SW] Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// ─── Activate — clean old caches ─────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[AETHER SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch — network first, fallback to cache ─────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API calls — network only, never cache
  if (url.hostname.includes('workers.dev') ||
      url.hostname.includes('openai.com') ||
      url.hostname.includes('telegram.org')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static assets — cache first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback — return cached index.html
        if (event.request.destination === 'document') {
          return caches.match('/site/index.html');
        }
      });
    })
  );
});

// ─── Background Sync — queue events when offline ──────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-events') {
    event.waitUntil(syncPendingEvents());
  }
});

async function syncPendingEvents() {
  try {
    // Get pending events from IndexedDB (stored when offline)
    const db = await openDB();
    const pending = await getAll(db, 'pending_events');

    for (const event of pending) {
      try {
        await fetch(WORKER_URL + '/log-state', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(event),
        });
        await deleteRecord(db, 'pending_events', event.id);
        console.log('[AETHER SW] Synced pending event:', event.id);
      } catch (e) {
        console.warn('[AETHER SW] Sync failed for event:', event.id);
      }
    }
  } catch (e) {
    console.warn('[AETHER SW] Background sync error:', e);
  }
}

// ─── Push Notifications ───────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'AETHER', body: event.data.text() };
  }

  const options = {
    body:    data.body || 'AETHER has an update for you.',
    icon: '/site/icons/icon-192.png',
    badge: '/site/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data:    { url: data.url || '/' },
    actions: [
      { action: 'open',    title: 'Open AETHER' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'AETHER OS', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Focus existing window if open
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ─── Simple IndexedDB helpers for offline queue ───────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('aether_offline', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pending_events')) {
        db.createObjectStore('pending_events', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function getAll(db, store) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function deleteRecord(db, store, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}