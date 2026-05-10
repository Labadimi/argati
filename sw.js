// ─── Service Worker - Parts Center PWA ────────────────────────────────────────
const SW_VERSION = '2.0.0';
const CACHE_NAME = 'argati-pwa-v2';

// ─── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('🚀 SW installed v' + SW_VERSION);
    
    // Cache essential files for offline support
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                '/argati/',
                '/argati/index.html',
                '/argati/app.js',
                '/argati/manifest.json',
                '/argati/icon-192.png',
                '/argati/icon-512.png'
            ]);
        }).then(() => {
            console.log('✅ All files cached');
        })
    );
    
    self.skipWaiting();
});

// ─── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('✅ SW activated v' + SW_VERSION);
    
    // Clean old caches
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Old caches cleaned');
        })
    );
    
    event.waitUntil(clients.claim());
});

// ─── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    // Only cache same-origin requests
    if (event.request.url.startsWith(self.location.origin)) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version immediately
                    return cachedResponse;
                }
                
                // Fetch from network and cache
                return fetch(event.request).then((response) => {
                    // Don't cache Google Script API calls
                    if (!event.request.url.includes('script.google.com')) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                });
            })
        );
    }
});

// ─── NOTIFICATION CLICK ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    console.log('🔔 Notification clicked:', event.action);
    
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ 
            type: 'window', 
            includeUncontrolled: true 
        }).then((clientList) => {
            // If a window is already open, focus it
            for (const client of clientList) {
                if (client.url.includes(self.registration.scope) && 'focus' in client) {
                    console.log('Focusing existing window');
                    return client.focus();
                }
            }
            // Otherwise open a new window
            if (clients.openWindow) {
                console.log('Opening new window');
                return clients.openWindow(self.registration.scope);
            }
        })
    );
});

// ─── MESSAGE HANDLER ──────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
    console.log('📨 SW received message:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
