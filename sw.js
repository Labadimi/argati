// ─── Service Worker - Parts Center PWA ────────────────────────────────────────
const SW_VERSION = '3.2.0';

self.addEventListener('install', event => {
    console.log('SW install v' + SW_VERSION);
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('SW activate v' + SW_VERSION);
    event.waitUntil(clients.claim());
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                for (const client of clientList) {
                    if ('focus' in client) return client.focus();
                }
                if (clients.openWindow) return clients.openWindow(self.registration.scope);
            })
    );
});
