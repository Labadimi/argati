// Argati Service Worker — required for iOS PWA notifications
const CACHE = 'argati-v1';

self.addEventListener('install', e => {
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(clients.claim());
});

// Handle push events (for future server-sent push)
self.addEventListener('push', e => {
    const data = e.data ? e.data.json() : {};
    const title = data.title || '🛒 Argati';
    const body  = data.body  || 'New order arrived!';

    e.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon:          'icon.png',
            badge:         'icon.png',
            tag:           'argati-order',
            renotify:      true,
            requireInteraction: false,
        })
    );
});

// Tap on notification opens/focuses the app
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
