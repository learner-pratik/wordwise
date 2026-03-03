// ─────────────────────────────────────────────────────────────────────────────
//  WordWise Service Worker — v2
//  • Caches all app assets for offline use
//  • Handles Web Push notifications (daily word + weekly quiz)
//  • Opens / focuses the app when a notification is clicked
// ─────────────────────────────────────────────────────────────────────────────
const CACHE   = 'wordwise-v2';
const CORE    = ['/', '/index.html', '/manifest.json'];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate (clean up old caches) ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch (cache-first, network fallback) ────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ── Push received ─────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {
    title: '📚 WordWise',
    body:  'Your daily word is ready!',
    url:   '/?tab=today',
    tag:   'wordwise-daily',
  };

  if (event.data) {
    try { Object.assign(data, event.data.json()); } catch {}
  }

  const options = {
    body:    data.body,
    tag:     data.tag,           // replaces any existing notification with the same tag
    renotify: true,
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    vibrate: [100, 50, 100],
    data:    { url: data.url },
    actions: [
      { action: 'open',    title: '📖 Open WordWise' },
      { action: 'dismiss', title: 'Later'            },
    ],
    // Show on lock screen on iOS
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Notification clicked ──────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? self.location.origin + event.notification.data.url
    : self.location.origin + '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If the app is already open, just focus it and navigate
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
