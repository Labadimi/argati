// ─── Service Worker - Parts Center PWA ────────────────────────────────────────
const SW_VERSION = '2.2.0';

try {
    importScripts('https://cdn.webpushr.com/sw-server.min.js');
    console.log('WebPushr loaded');
} catch(e) {
    console.error('WebPushr failed:', e);
}

self.addEventListener('install', event => {
    console.log('SW install v' + SW_VERSION);
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('SW activate v' + SW_VERSION);
    event.waitUntil(clients.claim());
});

self.addEventListener('push', event => {
    console.log('Push received');
    let title = 'Parts Center';
    let body = 'Porosi e re!';
    
    if (event.data) {
        try {
            const data = event.data.json();
            title = data.title || title;
            body = data.message || data.body || body;
        } catch(e) {
            body = event.data.text() || body;
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(title, {
            body: body,
            icon: '/argati/icon-192.png',
            badge: '/argati/icon-192.png',
            requireInteraction: true,
            vibrate: [200, 100, 200],
            timestamp: Date.now()
        })
    );
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
