// ─── Service Worker - Parts Center PWA ────────────────────────────────────────
const SW_VERSION = '2.2.0';

// Load WebPushr SW server
try {
    importScripts('https://cdn.webpushr.com/sw-server.min.js');
    console.log('WebPushr SW loaded successfully');
} catch(e) {
    console.error('WebPushr SW failed to load:', e);
}

// ─── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('✅ SW installed v' + SW_VERSION);
    self.skipWaiting();
});

// ─── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('✅ SW activated v' + SW_VERSION);
    event.waitUntil(clients.claim());
});

// ─── PUSH EVENT ───────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
    console.log('📲 Push received');
    
    let title = 'Parts Center';
    let body = 'Porosi e re!';
    let icon = '/argati/icon-192.png';
    
    if (event.data) {
        try {
            const data = event.data.json();
            title = data.title || title;
            body = data.message || data.body || body;
            icon = data.icon || icon;
        } catch(e) {
            body = event.data.text() || body;
        }
    }
    
    const options = {
        body: body,
        icon: icon,
        badge: '/argati/icon-192.png',
        tag: 'order-' + Date.now(),
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        timestamp: Date.now(),
        data: {
            url: self.registration.scope
        }
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ─── NOTIFICATION CLICK ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    console.log('🔔 Notification clicked');
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ 
            type: 'window', 
            includeUncontrolled: true 
        }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(self.registration.scope);
            }
        })
    );
});

console.log('🚀 SW v' + SW_VERSION + ' fully loaded');
