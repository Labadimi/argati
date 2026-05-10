// Argati Service Worker v3 — Fixed for iOS Standalone Stability
const CACHE_NAME = 'argati-v3';
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icon.png'
];

// Install: Cache essential UI assets
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => { 
    e.waitUntil(clients.claim()); 
});

// CRITICAL FIX: The Fetch handler prevents the "Stuck on Loading" issue
self.addEventListener('fetch', e => {
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});

// PUSH EVENT
self.addEventListener('push', e => {
    let title = 'Argati';
    let body  = 'New order arrived!';
    let data  = {};
    try {
        data  = e.data ? e.data.json() : {};
        title = data.title || title;
        body  = data.body  || body;
    } catch(err) {
        body = e.data ? e.data.text() : body;
    }

    e.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: 'icon.png',
            badge: 'icon.png',
            tag: 'argati-order',
            renotify: true,
            data: { url: self.location.origin }
        })
    );
});

// NOTIFICATION CLICK
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
