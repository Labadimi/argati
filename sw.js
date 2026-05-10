const SW_VERSION = '2.0.3';
let SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJNKQM60EgtoiL9_j0qI8B9hLrjTH9fruhpakO0aMgrJFosgm0dDMkUFWPCAxQlEL7MA/exec';
let pollingInterval = null;

self.addEventListener('install', event => {
    console.log('SW install v' + SW_VERSION);
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('SW activate v' + SW_VERSION);
    event.waitUntil(clients.claim());
});

// ─── MESSAGE HANDLER ──────────────────────────────────────────────────────────
self.addEventListener('message', event => {
    console.log('SW message:', event.data?.type);
    
    if (event.data?.type === 'START_POLLING') {
        if (event.data.scriptUrl) SCRIPT_URL = event.data.scriptUrl;
        startPolling();
    }
    
    if (event.data?.type === 'KEEP_ALIVE') {
        // Just receiving a message keeps SW alive
        console.log('Keep-alive received');
    }
});

// ─── POLLING ──────────────────────────────────────────────────────────────────
function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    console.log('SW starting notification polling');
    pollingInterval = setInterval(pollNotifications, 20000);
    pollNotifications();
}

async function pollNotifications() {
    try {
        const res = await fetch(`${SCRIPT_URL}?action=notifications&t=${Date.now()}`);
        if (!res.ok) return;
        
        const data = await res.json();
        if (!data.notifications?.length) return;
        
        for (const notif of data.notifications) {
            await self.registration.showNotification(notif.title, {
                body: notif.body,
                icon: '/argati/icon-192.png',
                badge: '/argati/icon-192.png',
                tag: 'order-' + notif.id,
                requireInteraction: true,
                vibrate: [200, 100, 200],
                silent: false,
                timestamp: Date.now()
            });
            console.log('📱 SW notification:', notif.title);
        }
    } catch(e) {
        console.log('SW poll error:', e.message);
    }
}

// ─── NOTIFICATION CLICK ───────────────────────────────────────────────────────
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
