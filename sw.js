// ─── Service Worker - Parts Center PWA ────────────────────────────────────────
const SW_VERSION = '3.1.0';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJNKQM60EgtoiL9_j0qI8B9hLrjTH9fruhpakO0aMgrJFosgm0dDMkUFWPCAxQlEL7MA/exec';

let badgeInterval = null;

self.addEventListener('install', event => {
    console.log('SW install v' + SW_VERSION);
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('SW activate v' + SW_VERSION);
    event.waitUntil(clients.claim());
    startBadgePolling();
});

function startBadgePolling() {
    if (badgeInterval) clearInterval(badgeInterval);
    console.log('Starting badge polling every 60s');
    updateBadge();
    badgeInterval = setInterval(updateBadge, 60000);
}

async function updateBadge() {
    try {
        const res = await fetch(SCRIPT_URL + '?t=' + Date.now());
        if (!res.ok) return;
        
        const orders = await res.json();
        if (!Array.isArray(orders)) return;
        
        const pendingCount = orders.filter(o => {
            const oid = (o.OrderID || '').toString().trim();
            return !oid || oid.toLowerCase() === 'pending';
        }).length;
        
        // Set badge on app icon
        if (pendingCount > 0) {
            await self.registration.setAppBadge(pendingCount);
            console.log('🔴 Badge set to:', pendingCount);
        } else {
            await self.registration.clearAppBadge();
            console.log('🟢 Badge cleared');
        }
        
        // Also notify all open PWA windows to refresh
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach(client => {
            client.postMessage({ type: 'BADGE_UPDATED', count: pendingCount });
        });
        
    } catch(e) {
        console.log('Badge update error:', e.message);
    }
}

self.addEventListener('message', event => {
    if (event.data?.type === 'UPDATE_BADGE') {
        updateBadge();
    }
    if (event.data?.type === 'START_BADGE') {
        startBadgePolling();
    }
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
