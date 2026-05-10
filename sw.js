// ─── Service Worker - Parts Center PWA ────────────────────────────────────────
const SW_VERSION = '2.0.1';

// ─── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('🚀 SW installed v' + SW_VERSION);
    self.skipWaiting();
});

// ─── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('✅ SW activated v' + SW_VERSION);
    event.waitUntil(clients.claim());
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
            // Try to focus existing window
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open new window
            if (clients.openWindow) {
                return clients.openWindow(self.registration.scope);
            }
        })
    );
});

// ─── NOTIFICATION CLOSE ───────────────────────────────────────────────────────
self.addEventListener('notificationclose', (event) => {
    console.log('Notification closed');
});
