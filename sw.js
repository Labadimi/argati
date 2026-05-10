// Argati Service Worker v3
const CACHE_NAME = 'argati-v3';

self.addEventListener('install', e => { 
    self.skipWaiting(); 
});

self.addEventListener('activate', e => { 
    e.waitUntil(clients.claim()); 
});

// CRITICAL: This fetch handler stops the PWA from hanging on iOS
self.addEventListener('fetch', e => {
    e.respondWith(
        fetch(e.request).catch(() => {
            return caches.match(e.request);
        })
    );
});

// Push notification listener
self.addEventListener('push', e => {
    let data = { title: 'Argati', body: 'New order arrived!' };
    try {
        if (e.data) data = e.data.json();
    } catch(err) {
        data.body = e.data ? e.data.text() : data.body;
    }

    e.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: 'icon.png',
            badge: 'icon.png',
            tag: 'argati-order'
        })
    );
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(list => {
                if (list.length > 0) return list[0].focus();
                return clients.openWindow('./');
            })
    );
});
