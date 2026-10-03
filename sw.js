// Argati PWA service worker — v3
const CACHE = 'argati-v3.1.0';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon.png'];
const NEEDS_YOU = ['review', 'unverified', 'manual', 'blocked'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// App shell: network first, cache as fallback. Apps Script calls are never cached.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request)
    .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});

// The page sends the Apps Script URL + key so the badge can be updated after a push.
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'config') {
    caches.open(CACHE + '-config').then(c => c.put('config', new Response(JSON.stringify(e.data))));
  }
});
async function readConfig() {
  try { const r = await (await caches.open(CACHE + '-config')).match('config'); return r ? r.json() : null; }
  catch (e) { return null; }
}
async function updateBadge() {
  const cfg = await readConfig();
  if (!cfg || !cfg.key || !self.navigator.setAppBadge) return;
  try {
    const res = await fetch(cfg.url + '?action=status&key=' + encodeURIComponent(cfg.key) + '&t=' + Date.now());
    const data = await res.json();
    const n = (((data.state || {}).verdicts) || []).filter(v => NEEDS_YOU.includes(v.state)).length;
    n ? await self.navigator.setAppBadge(n) : await self.navigator.clearAppBadge();
  } catch (e) {}
}

self.addEventListener('push', e => {
  let title = 'Argati', body = '';
  if (e.data) {
    try { const d = e.data.json(); title = d.title || title; body = d.body || d.message || ''; }
    catch (err) { body = e.data.text(); }
  }
  const tag = /offline|online/i.test(title) ? 'argati-runner' : 'argati-' + Date.now();
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, { body, icon: 'icon.png', badge: 'icon.png', tag, renotify: true, data: { url: './' } }),
    updateBadge(),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => list.forEach(c => c.postMessage({ type: 'refresh' })))
  ]));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => 'focus' in c);
    if (open) { open.postMessage({ type: 'refresh' }); return open.focus(); }
    return self.clients.openWindow('./');
  }));
});
