// ─── Service Worker - Parts Center PWA ────────────────────────────────────────
const SW_VERSION = '1.0.1';

// ─── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('SW installed v' + SW_VERSION);
    self.skipWaiting();
});

// ─── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('SW activated v' + SW_VERSION);
    event.waitUntil(clients.claim());
});

// ─── PUSH NOTIFICATION ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
    console.log('Push event received');
    
    let notificationData = {
        title: 'Parts Center',
        body: 'Porosi e re u regjistrua',
        icon: '/icon-192.png',
        badge: '/icon-192.png'
    };

    if (event.data) {
        try {
            const data = event.data.json();
            notificationData.title = data.title || notificationData.title;
            notificationData.body = data.body || notificationData.body;
        } catch(e) {
            // Plain text
            notificationData.body = event.data.text() || notificationData.body;
        }
    }

    const options = {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: notificationData.badge,
        tag: 'order-' + Date.now(),
        requireInteraction: true,
        vibrate: [200, 100, 200],
        timestamp: Date.now(),
        data: {
            url: self.registration.scope,
            dateOfArrival: Date.now()
        },
        actions: [
            {
                action: 'open',
                title: 'Shiko Porositë'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(notificationData.title, options)
    );
});

// ─── NOTIFICATION CLICK ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked');
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ 
            type: 'window', 
            includeUncontrolled: true 
        }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(self.registration.scope) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(self.registration.scope);
            }
        })
    );
});
