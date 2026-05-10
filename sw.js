self.addEventListener('push', event => {
    let title = 'Parts Center', body = 'Porosi e re!';
    if (event.data) {
        try { const d = event.data.json(); title = d.title||title; body = d.body||body; }
        catch(e) { body = event.data.text()||body; }
    }
    event.waitUntil(
        self.registration.showNotification(title, {
            body, icon: '/argati/icon-192.png', badge: '/argati/icon-192.png',
            requireInteraction: true, vibrate: [200,100,200]
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(clients.openWindow(self.registration.scope));
});

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
