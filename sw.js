// ─── Service Worker - Parts Center PWA ────────────────────────────────────────
const VAPID_PUBLIC_KEY = 'BOSn4Ynnig74lu56bG3MoLcdGlDDNsRrDYQ9tQrsy1inJY8_QsU_L-qoGYb-PfPipWD50EcYl-F_UVq9EkNHq1U';

const SW_VERSION = '1.0.0';

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
    if (!event.data) {
        console.warn('Push event received but no data');
        return;
    }

    let title, body, icon, badge;

    try {
        // Try JSON format
        const data = event.data.json();
        title = data.title || 'Parts Center';
        body = data.body || 'Porosi e re u regjistrua';
        icon = data.icon || '/icon-192.png';
        badge = data.badge || '/icon-192.png';
    } catch(e) {
        // Plain text fallback
        title = 'Parts Center';
        body = event.data.text() || 'Porosi e re!';
        icon = '/icon-192.png';
        badge = '/icon-192.png';
    }

    const options = {
        body,
        icon,
        badge,
        tag: 'order-' + Date.now(),
        requireInteraction: true,
        vibrate: [200, 100, 200],
        timestamp: Date.now(),
        data: {
            url: self.location.origin + '/',
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
        self.registration.showNotification(title, options)
    );
});

// ─── NOTIFICATION CLICK ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event.action);
    
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ 
            type: 'window', 
            includeUncontrolled: true 
        }).then((clientList) => {
            // If window already open, focus it
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open new window
            if (clients.openWindow) {
                return clients.openWindow(self.location.origin + '/');
            }
        })
    );
});

// ─── PUSH SUBSCRIPTION CHANGE ─────────────────────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('Push subscription changed');
    event.waitUntil(
        self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        }).then((newSubscription) => {
            // Could post to server here
            console.log('New subscription created');
        })
    );
});

// ─── UTILITY (for potential re-subscription) ──────────────────────────────────
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
