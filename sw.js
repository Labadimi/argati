// Argati Service Worker v4
const CACHE_NAME   = 'argati-v6.9';
const SCRIPT_URL   = 'https://script.google.com/macros/s/AKfycbzQMxhghzC2LCW36uaUJTlOI4WxHV6h8snnhRPRBgSM6fXeyG8LZS67Pzxoet41wes/exec';

self.addEventListener('install',  e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(clients.claim()); });

// Refresh badge whenever SW wakes up (push, focus, etc.)
async function refreshBadgeOnly() {
  try {
    const res     = await fetch(SCRIPT_URL + '?action=count&t=' + Date.now());
    const text    = await res.text();
    const pending = parseInt(text.trim()) || 0;
    if ('setAppBadge' in self) {
      if (pending > 0) self.navigator.setAppBadge(pending).catch(() => {});
      else             self.navigator.clearAppBadge().catch(() => {});
    }
    // Update open windows
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    list.forEach(c => c.postMessage({ type: 'BADGE_UPDATE', pending }));
  } catch(e) {}
}

// ── PUSH — fires even when PWA is closed ──────────────────────────────────────
self.addEventListener('push', e => {
  let title = 'Argati';
  let body  = 'New order arrived!';

  if (e.data) {
    try   { const d = e.data.json(); title = d.title || title; body = d.body || body; }
    catch { body = e.data.text() || body; }
  }

  // Set badge immediately (before fetch) so it appears instantly
  if ('setAppBadge' in self) self.setAppBadge().catch(()=>{});

  e.waitUntil(Promise.all([
    // 1. Show notification
    self.registration.showNotification(title, {
      body, icon: 'icon.png', badge: 'icon.png',
      tag: 'argati-order', renotify: true,
      vibrate: [200, 80, 200],
      requireInteraction: false,
      data: { url: self.location.origin }
    }),

    // 2. Fetch exact pending count and update badge with real number
    fetchAndUpdateBadge(),

    // 3. Tell any open PWA window to refresh immediately
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      list.forEach(c => c.postMessage({ type: 'NEW_ORDER' }));
    })
  ]));
});

// ── Fetch pending count + set home screen badge ───────────────────────────────
async function fetchAndUpdateBadge() {
  try {
    const res    = await fetch(SCRIPT_URL + '?t=' + Date.now());
    const orders = await res.json();
    const pending = Array.isArray(orders) ? orders.filter(o => {
      const oid = (o.OrderID || '').toString().trim();
      if (oid !== '' && oid.toLowerCase() !== 'pending') return false;
      return (o.Produkti  || '').toString().trim() !== '' &&
             (o.Emri      || '').toString().trim() !== '' &&
             (o.Mbiemri   || '').toString().trim() !== '' &&
             (o.Telefoni  || '').toString().trim() !== '' &&
             (o.Qyteti    || '').toString().trim() !== '' &&
             (o.Adresa    || '').toString().trim() !== '';
    }).length : 0;

    // Update home screen badge
    if ('setAppBadge' in self) {
      if (pending > 0) self.navigator.setAppBadge(pending).catch(() => {});
      else             self.navigator.clearAppBadge().catch(() => {});
    }

    // Tell open windows the exact count so they update immediately
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    list.forEach(c => c.postMessage({ type: 'BADGE_UPDATE', pending }));

    return pending;
  } catch(e) {
    // Badge increment without exact count if fetch fails
    if ('setAppBadge' in navigator) navigator.setAppBadge().catch(() => {});
  }
}

// ── NOTIFICATION CLICK — open/focus app ──────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    Promise.all([
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        if (list.length > 0) return list[0].focus();
        return clients.openWindow('./');
      }),
      // Don't clear badge on click — let the app do it when orders are loaded
    ])
  );
});

// ── PERIODIC BACKGROUND SYNC — refreshes badge every 5 min ─────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'badge-refresh') {
    e.waitUntil(refreshBadgeOnly());
  }
});

// ── PUSH SUBSCRIPTION CHANGED — auto re-subscribe ────────────────────────────
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(
    self.registration.pushManager.subscribe(e.oldSubscription.options)
      .then(sub => fetch(SCRIPT_URL + '?action=saveSub&t=' + Date.now(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON())
      }))
  );
});
