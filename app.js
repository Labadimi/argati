// ─── Parts Center PWA - App Logic ─────────────────────────────────────────────
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJNKQM60EgtoiL9_j0qI8B9hLrjTH9fruhpakO0aMgrJFosgm0dDMkUFWPCAxQlEL7MA/exec';
const VAPID_PUBLIC_KEY = 'BOSn4Ynnig74lu56bG3MoLcdGlDDNsRrDYQ9tQrsy1inJY8_QsU_L-qoGYb-PfPipWD50EcYl-F_UVq9EkNHq1U';

let swRegistration = null;
let pushSubscribed = false;
let pushSupported = false;

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
    const hasSW = 'serviceWorker' in navigator;
    const hasPush = 'PushManager' in window;
    const hasNotif = 'Notification' in window;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const isHTTPS = location.protocol === 'https:';
    
    pushSupported = hasSW && hasPush && hasNotif && isStandalone && isHTTPS;
    
    console.log('Push supported:', pushSupported);
    
    // Register service worker
    if (hasSW) {
        try {
            swRegistration = await navigator.serviceWorker.register('/argati/sw.js', { scope: '/argati/' });
            console.log('✅ SW registered');
            await navigator.serviceWorker.ready;
            
            if (swRegistration.pushManager) {
                try {
                    const sub = await swRegistration.pushManager.getSubscription();
                    pushSubscribed = !!sub;
                    console.log('Already subscribed:', pushSubscribed);
                } catch(e) {
                    console.log('Push check:', e.message);
                }
            }
        } catch(e) {
            console.error('SW error:', e);
        }
    }
    
    updateNotifUI();
    await loadOrders();
    
    // Auto-refresh every 45 seconds
    setInterval(loadOrders, 45000);
}

// ─── NOTIFICATION TOGGLE ──────────────────────────────────────────────────────
async function toggleNotifications() {
    if (pushSubscribed) {
        await unsubscribeFromPush();
    } else {
        await subscribeToPush();
    }
}

async function subscribeToPush() {
    if (!pushSupported || !swRegistration) {
        showToast('❌ Njoftimet nuk suportohen');
        return;
    }
    
    try {
        const permission = await Notification.requestPermission();
        console.log('Permission:', permission);
        
        if (permission !== 'granted') {
            showToast('⚠️ Duhet të lejoni njoftimet në Settings');
            return;
        }
        
        const subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        
        console.log('Subscription created:', subscription.endpoint);
        
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveSub',
                subscription: subscription.toJSON()
            })
        });
        
        const data = await response.json();
        console.log('Save result:', data);
        
        if (data && data.saved) {
            pushSubscribed = true;
            updateNotifUI();
            showToast('🔔 Njoftimet u aktivizuan!');
        } else {
            showToast('❌ Nuk u ruajt. Provoni përsëri.');
        }
    } catch(e) {
        console.error('Subscribe error:', e);
        if (e.name === 'NotAllowedError') {
            showToast('⚠️ Njoftimet u refuzuan. Shkoni te Settings > Notifications > Argati');
        } else {
            showToast('❌ ' + e.message);
        }
    }
}

async function unsubscribeFromPush() {
    try {
        if (swRegistration?.pushManager) {
            const sub = await swRegistration.pushManager.getSubscription();
            if (sub) await sub.unsubscribe();
        }
        pushSubscribed = false;
        updateNotifUI();
        showToast('🔕 Njoftimet u çaktivizuan');
    } catch(e) {
        console.error(e);
    }
}

function updateNotifUI() {
    const bar = document.getElementById('notif-bar');
    const text = document.getElementById('notif-text');
    const btn = document.getElementById('subscribe-btn');
    if (!bar || !text || !btn) return;
    
    if (!pushSupported) {
        bar.className = 'notif-bar inactive';
        text.innerText = 'Njoftimet nuk suportohen';
        btn.innerText = 'ℹ️';
        btn.className = 'btn-subscribe disable';
        return;
    }
    
    if (pushSubscribed) {
        bar.className = 'notif-bar active';
        text.innerText = 'Njoftimet aktive ✅';
        btn.innerText = '🔕 Çaktivizo';
        btn.className = 'btn-subscribe disable';
    } else {
        bar.className = 'notif-bar inactive';
        text.innerText = 'Njoftimet gati për aktivizim';
        btn.innerText = '🔔 Aktivizo';
        btn.className = 'btn-subscribe enable';
    }
}

// ─── LOAD ORDERS ──────────────────────────────────────────────────────────────
async function loadOrders() {
    const container = document.getElementById('pending-orders');
    if (!container) return;
    
    try {
        console.log('Loading orders from:', SCRIPT_URL);
        
        const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        
        if (!res.ok) {
            throw new Error('HTTP ' + res.status);
        }
        
        const text = await res.text();
        console.log('Raw response:', text.substring(0, 200));
        
        let orders;
        try {
            orders = JSON.parse(text);
        } catch(e) {
            throw new Error('Invalid JSON response');
        }
        
        if (!Array.isArray(orders)) {
            // Maybe it's wrapped in an object
            if (orders && Array.isArray(orders.data)) {
                orders = orders.data;
            } else if (orders && Array.isArray(orders.orders)) {
                orders = orders.orders;
            } else {
                throw new Error('Response is not an array');
            }
        }
        
        console.log('Orders loaded:', orders.length);
        
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
                    <div class="empty-sub">Kontrolloni përsëri më vonë</div>
                </div>`;
            return;
        }
        
        container.innerHTML = pending.map(o => `
            <div class="order-card" id="order-${o.rowNumber}">
                <div class="order-top">
                    <div class="order-name-row">
                        <span class="order-row-num">#${o.rowNumber}</span>
                        <span class="order-name">${escapeHtml(o.Emri||'')} ${escapeHtml(o.Mbiemri||'')}</span>
                    </div>
                </div>
                <div class="order-details">
                    <div class="detail-item">📦 ${escapeHtml(o.Produkti||'—')}</div>
                    <div class="detail-item">📍 ${escapeHtml(o.Qyteti||'—')}</div>
                    <div class="detail-item">📞 ${escapeHtml(o.Telefoni||'—')}</div>
                    <div class="detail-item">🏠 ${escapeHtml(o.Adresa||'—')}</div>
                </div>
                ${o['Koment shtese (Nese ka)'] ? `<div class="order-comment">💬 ${escapeHtml(o['Koment shtese (Nese ka)'])}</div>` : ''}
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
                <div class="empty-title">Nuk u ngarkuan porositë</div>
                <div class="empty-sub">${e.message}</div>
                <button class="btn-subscribe enable" onclick="loadOrders()" style="margin-top:12px;">
                    🔄 Provo përsëri
                </button>
            </div>`;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text.toString();
    return div.innerHTML;
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
