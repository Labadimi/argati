// ─── Service Worker for Parts Center PWA ──────────────────────────────────────
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJNKQM60EgtoiL9_j0qI8B9hLrjTH9fruhpakO0aMgrJFosgm0dDMkUFWPCAxQlEL7MA/exec';
const VAPID_PUBLIC_KEY = 'BOSn4Ynnig74lu56bG3MoLcdGlDDNsRrDYQ9tQrsy1inJY8_QsU_L-qoGYb-PfPipWD50EcYl-F_UVq9EkNHq1U';

// ─── Push Subscription ────────────────────────────────────────────────────────
self.addEventListener('push', function(event) {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const title = data.title || 'Parts Center';
    const options = {
      body: data.body || 'New order received',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: 'order-notification',
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: {
        url: '/',
        timestamp: Date.now()
      },
      actions: [
        {
          action: 'open',
          title: 'View Orders'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch(e) {
    // Fallback for plain text
    event.waitUntil(
      self.registration.showNotification('Parts Center', {
        body: event.data.text(),
        icon: 'icon-192.png'
      })
    );
  }
});

// ─── Notification Click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // If a window is already open, focus it
        for (let client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// ─── Install & Activate ───────────────────────────────────────────────────────
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

// ─── Push Subscription Management ─────────────────────────────────────────────
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SAVE_SUBSCRIPTION') {
    // Forward subscription to Google Apps Script
    fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveSub',
        subscription: event.data.subscription
      })
    }).then(response => response.json())
      .then(data => {
        // Notify client
        event.ports[0] && event.ports[0].postMessage({ saved: data.saved });
      })
      .catch(err => {
        console.error('Failed to save subscription:', err);
        event.ports[0] && event.ports[0].postMessage({ saved: false, error: err.message });
      });
  }
});
