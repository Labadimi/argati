// Argati Service Worker v3 — handles Web Push notifications
// Required for iOS PWA push notifications (iOS 16.4+)
const CACHE_NAME = 'argati-v4';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(clients.claim()); });

// ── Push event — fires when server sends a push ───────────────────────────────
// This fires even when the PWA is completely closed
self.addEventListener('push', e => {
  let title = 'Argati';
  let body  = 'New order arrived!';
  let icon  = 'icon.png';

  if (e.data) {
    try {
      const data = e.data.json();
      title = data.title || title;
      body  = data.body  || body;
    } catch(err) {
      body = e.data.text() || body;
    }
  }

  const options = {
    body,
    icon,
    badge:          icon,
    tag:            'argati-order',
    renotify:       true,
    requireInteraction: false,
    vibrate:        [200, 80, 200],
    data:           { url: self.location.origin }
  };

  // event.waitUntil keeps SW alive until notification is shown
  e.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click — open/focus the app ───────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        if (list.length > 0) return list[0].focus();
        return clients.openWindow('./');
      })
  );
});

// ── Push subscription changed — re-subscribe automatically ───────────────────
// iOS sometimes drops subscriptions — this re-subscribes and saves new sub
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(
    self.registration.pushManager.subscribe(e.oldSubscription.options)
      .then(sub => {
        return fetch('{}/argati-subscribe'.replace('{}', self.location.origin), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON())
        });
      })
  );
});
