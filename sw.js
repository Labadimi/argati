// ─── Service Worker - Parts Center PWA ────────────────────────────────────────
const SW_VERSION = '2.3.0';

// Load WebPushr
try {
    importScripts('https://cdn.webpushr.com/sw-server.min.js');
    console.log('✅ WebPushr SW loaded');
} catch(e) {
    console.error('❌ WebPushr SW failed:', e);
}

self.addEventListener('install', event => {
    console.log('✅ Install v' + SW_VERSION);
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('✅ Activate v' + SW_VERSION);
    event.waitUntil(clients.claim());
});

// Handle messages from the page
self.addEventListener('message', event => {
    console.log('📨 SW message:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    // Forward to WebPushr if needed
    if (event.data && event.data.type === 'webpushrPrompt') {
        console.log('WebPushr prompt received');
        // WebPushr script handles this automatically
    }
});

// Push event
self.addEventListener('push', event => {
    console.log('📲 Push received');
    
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
            timestamp: Date.now(),
            data: { url: self.registration.scope }
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

console.log('🚀 SW v' + SW_VERSION + ' ready');
