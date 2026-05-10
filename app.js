// ─── Parts Center PWA - WebPushr Integration ──────────────────────────────────
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJNKQM60EgtoiL9_j0qI8B9hLrjTH9fruhpakO0aMgrJFosgm0dDMkUFWPCAxQlEL7MA/exec';

// WebPushr Public Key
const WEBPUSHR_PUBLIC_KEY = 'BHVdCTPrQjCOIPfMKnc6_yqXF6iNhPoFDFPyPICll7_dEBWCVFgNwOscuAzwQsJQhD6mCK_NuH1dgYy4LT2oEGQ';

let pushSubscribed = false;

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
    console.log('🚀 PWA Starting...');
    console.log('URL:', window.location.href);
    console.log('Standalone:', window.matchMedia('(display-mode: standalone)').matches || navigator.standalone);
    
    // Register SW
    if ('serviceWorker' in navigator) {
        try {
            // First unregister any old SW
            const oldReg = await navigator.serviceWorker.getRegistration('/argati/');
            if (oldReg) {
                console.log('Unregistering old SW...');
                await oldReg.unregister();
                // Wait for it to fully unregister
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Register fresh
            console.log('Registering new SW...');
            const registration = await navigator.serviceWorker.register('/argati/sw.js?v=' + Date.now(), { 
                scope: '/argati/' 
            });
            console.log('✅ SW registered:', registration.scope);
            
            // Wait for SW to be ready with timeout
            console.log('Waiting for SW ready...');
            const readyPromise = navigator.serviceWorker.ready;
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('SW ready timed out')), 10000)
            );
            
            try {
                await Promise.race([readyPromise, timeoutPromise]);
                console.log('✅ SW ready');
            } catch(timeoutErr) {
                console.error('SW ready failed:', timeoutErr.message);
                // Continue anyway - might still work
            }
            
            // Check if already subscribed
            if ('PushManager' in window && registration.pushManager) {
                try {
                    const subscription = await registration.pushManager.getSubscription();
                    pushSubscribed = !!subscription;
                    console.log('Push already subscribed:', pushSubscribed);
                    
                    if (subscription) {
                        console.log('Endpoint:', subscription.endpoint);
                    }
                } catch(e) {
                    console.log('Push check failed:', e.message);
                    pushSubscribed = false;
                }
            } else {
                console.log('PushManager not available');
            }
            
        } catch(e) {
            console.error('SW registration failed:', e);
        }
    } else {
        console.log('Service Worker not supported');
    }
    
    updateNotifUI();
    await loadOrders();
    setInterval(loadOrders, 60000);
}

// ─── TOGGLE NOTIFICATIONS ─────────────────────────────────────────────────────
async function toggleNotifications() {
    if (pushSubscribed) {
        await unsubscribe();
    } else {
        await subscribe();
    }
}

async function subscribe() {
    if (!('serviceWorker' in navigator)) {
        showToast('❌ Service Worker nuk suportohet');
        return;
    }
    
    if (!('PushManager' in window)) {
        showToast('❌ Push notifications nuk suportohen');
        return;
    }
    
    try {
        console.log('Requesting notification permission...');
        const permission = await Notification.requestPermission();
        console.log('Permission result:', permission);
        
        if (permission !== 'granted') {
            showToast('⚠️ Duhet të lejoni njoftimet në Settings');
            return;
        }
        
        console.log('Getting service worker registration...');
        
        // Get or create SW registration
        let reg = await navigator.serviceWorker.getRegistration('/argati/');
        
        if (!reg) {
            console.log('No existing registration, creating...');
            reg = await navigator.serviceWorker.register('/argati/sw.js?v=' + Date.now(), { 
                scope: '/argati/' 
            });
        }
        
        console.log('SW registration obtained:', reg.scope);
        
        // Wait for SW to be active
        if (reg.installing) {
            console.log('Waiting for SW to finish installing...');
            await new Promise((resolve) => {
                reg.installing.addEventListener('statechange', function() {
                    if (this.state === 'activated') resolve();
                });
                // Timeout
                setTimeout(resolve, 5000);
            });
        }
        
        if (reg.waiting) {
            console.log('Waiting SW found, skipping...');
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log('SW state:', reg.active ? 'active' : 'not active');
        
        // Check existing subscription
        let subscription = null;
        if (reg.pushManager) {
            subscription = await reg.pushManager.getSubscription();
        }
        
        if (subscription) {
            console.log('Already subscribed:', subscription.endpoint);
            pushSubscribed = true;
            updateNotifUI();
            showToast('🔔 Tashmë i abonuar!');
            return;
        }
        
        console.log('Creating new subscription...');
        console.log('Public key length:', WEBPUSHR_PUBLIC_KEY.length);
        
        // Subscribe
        subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(WEBPUSHR_PUBLIC_KEY)
        });
        
        console.log('✅ Subscription successful!');
        console.log('Endpoint:', subscription.endpoint);
        
        pushSubscribed = true;
        updateNotifUI();
        showToast('🔔 Njoftimet u aktivizuan!');
        
        // Test notification after 2 seconds
        setTimeout(async () => {
            try {
                const currentReg = await navigator.serviceWorker.getRegistration('/argati/');
                if (currentReg) {
                    await currentReg.showNotification('✅ Argati Gati!', {
                        body: 'Do të njoftoheni për porositë e reja',
                        icon: '/argati/icon-192.png',
                        badge: '/argati/icon-192.png',
                        tag: 'welcome',
                        requireInteraction: true,
                        vibrate: [200, 100, 200],
                        timestamp: Date.now()
                    });
                    console.log('Test notification sent');
                }
            } catch(e) {
                console.error('Test notification failed:', e);
            }
        }, 2000);
        
    } catch(e) {
        console.error('Subscribe error:', e);
        console.error('Error name:', e.name);
        console.error('Error message:', e.message);
        
        if (e.name === 'NotAllowedError') {
            showToast('⚠️ Njoftimet u bllokuan');
        } else if (e.name === 'InvalidStateError') {
            showToast('❌ Tashmë jeni i regjistruar. Rifresko faqen.');
        } else {
            showToast('❌ ' + (e.message || 'Gabim i panjohur'));
        }
    }
}

async function unsubscribe() {
    try {
        const reg = await navigator.serviceWorker.getRegistration('/argati/');
        if (reg && reg.pushManager) {
            const subscription = await reg.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
                console.log('Unsubscribed');
            }
        }
        pushSubscribed = false;
        updateNotifUI();
        showToast('🔕 Njoftimet u çaktivizuan');
    } catch(e) {
        console.error('Unsubscribe error:', e);
    }
}

// ─── UI ───────────────────────────────────────────────────────────────────────
function updateNotifUI() {
    const bar = document.getElementById('notif-bar');
    const text = document.getElementById('notif-text');
    const btn = document.getElementById('subscribe-btn');
    if (!bar || !text || !btn) return;
    
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        bar.className = 'notif-bar inactive';
        text.innerText = 'Push nuk suportohet në këtë pajisje';
        btn.innerText = 'ℹ️';
        btn.className = 'btn-subscribe disable';
        btn.onclick = () => showToast('Nevojitet iOS 16.4+ dhe PWA e instaluar');
        return;
    }
    
    if (pushSubscribed) {
        bar.className = 'notif-bar active';
        text.innerText = 'Njoftimet aktive ✅';
        btn.innerText = '🔕 Çaktivizo';
        btn.className = 'btn-subscribe disable';
        btn.onclick = toggleNotifications;
    } else {
        bar.className = 'notif-bar inactive';
        text.innerText = 'Kliko për të aktivizuar njoftimet';
        btn.innerText = '🔔 Aktivizo';
        btn.className = 'btn-subscribe enable';
        btn.onclick = toggleNotifications;
    }
}

// ─── LOAD ORDERS ──────────────────────────────────────────────────────────────
async function loadOrders() {
    const container = document.getElementById('pending-orders');
    if (!container) return;
    
    try {
        const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        
        const orders = await res.json();
        if (!Array.isArray(orders)) throw new Error('Invalid data');
        
        const pending = orders.filter(o => {
            const oid = (o.OrderID || '').toString().trim();
            return !oid || oid.toLowerCase() === 'pending';
        });
        
        const todayStr = new Date().toDateString();
        const done = orders.filter(o => {
            const oid = (o.OrderID || '').toString().trim();
            if (!oid || oid.toLowerCase() === 'pending') return false;
            try { return new Date(o.PlacedDate || '').toDateString() === todayStr; } catch(e) { return false; }
        });
        
        document.getElementById('stat-pending').innerText = pending.length;
        document.getElementById('stat-done').innerText = done.length;
        document.getElementById('pending-count').innerText = pending.length;
        
        if (pending.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎉</div>
                    <div class="empty-title">Asnjë porosi në pritje</div>
                    <div class="empty-sub">Të gjitha porositë janë përpunuar</div>
                </div>`;
            return;
        }
        
        container.innerHTML = pending.map(o => `
            <div class="order-card" id="order-${o.rowNumber}">
                <div class="order-top">
                    <div class="order-name-row">
                        <span class="order-row-num">#${o.rowNumber}</span>
                        <span class="order-name">${esc(o.Emri||'')} ${esc(o.Mbiemri||'')}</span>
                    </div>
                </div>
                <div class="order-details">
                    <div class="detail-item">📦 ${esc(o.Produkti||'—')}</div>
                    <div class="detail-item">📍 ${esc(o.Qyteti||'—')}</div>
                    <div class="detail-item">📞 ${esc(o.Telefoni||'—')}</div>
                    <div class="detail-item">🏠 ${esc(o.Adresa||'—')}</div>
                </div>
                ${o['Koment shtese (Nese ka)'] ? `<div class="order-comment">💬 ${esc(o['Koment shtese (Nese ka)'])}</div>` : ''}
                <div class="order-action-row">
                    <button class="btn-approve" onclick="approveOrder(${o.rowNumber})">✅ Aprovo</button>
                </div>
            </div>
        `).join('');
        
    } catch(e) {
        console.error('Load error:', e);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <div class="empty-title">Gabim në ngarkim</div>
                <div class="empty-sub">${esc(e.message)}</div>
                <button class="btn-subscribe enable" onclick="loadOrders()" style="margin-top:12px;">🔄 Provo përsëri</button>
            </div>`;
    }
}

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s.toString();
    return d.innerHTML;
}

// ─── APPROVE ORDER ────────────────────────────────────────────────────────────
async function approveOrder(row) {
    const card = document.getElementById('order-' + row);
    if (card) card.classList.add('processing');
    
    try {
        const r = await fetch(`${SCRIPT_URL}?action=approve&row=${row}&t=${Date.now()}`);
        const d = await r.json();
        if (d.success) {
            showToast('✅ Porosia #' + row + ' u aprovua!');
            setTimeout(loadOrders, 2000);
        } else {
            showToast('❌ Gabim: ' + (d.error || 'E panjohur'));
            if (card) card.classList.remove('processing');
        }
    } catch(e) {
        showToast('❌ Gabim në lidhje');
        if (card) card.classList.remove('processing');
    }
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerText = msg;
    t.classList.add('show');
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── UTILITY ──────────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

// ─── START ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
