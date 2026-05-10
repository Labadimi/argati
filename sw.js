// Argati Service Worker v2 — handles push notifications
const CACHE = 'argati-v2';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(clients.claim()); });

// ── PUSH EVENT — fires when server sends a push ───────────────────────────────
self.addEventListener('push', e => {
    let title = 'Argati';
    let body  = 'New order arrived!';
    let data  = {};

    try {
        data  = e.data ? e.data.json() : {};
        title = data.title || title;
        body  = data.body  || body;
    } catch(err) {
        body = e.data ? e.data.text() : body;
    }

    e.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon:          'icon.png',
            badge:         'icon.png',
            tag:           'argati-order',
            renotify:      true,
            requireInteraction: false,
            data:          { url: self.location.origin }
        })
    );
});

// ── NOTIFICATION CLICK — open/focus the app ───────────────────────────────────
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
