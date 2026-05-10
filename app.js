// ─── Parts Center PWA - WebPushr Integration ──────────────────────────────────
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJNKQM60EgtoiL9_j0qI8B9hLrjTH9fruhpakO0aMgrJFosgm0dDMkUFWPCAxQlEL7MA/exec';

// Your WebPushr keys
const WEBPUSHR_PUBLIC_KEY = 'YOUR_PUBLIC_KEY_HERE'; // The public key from WebPushr dashboard

let pushSubscribed = false;

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
    console.log('🚀 PWA Starting...');
    
    // Register WebPushr's SW
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/argati/sw.js', { scope: '/argati/' });
            console.log('✅ SW registered');
            await navigator.serviceWorker.ready;
            
            // Check if already subscribed
            const reg = await navigator.serviceWorker.ready;
            const subscription = await reg.pushManager.getSubscription();
            pushSubscribed = !!subscription;
            console.log('Push subscribed:', pushSubscribed);
            
        } catch(e) {
            console.error('SW error:', e);
        }
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
    
    try {
        console.log('Requesting permission...');
        const permission = await Notification.requestPermission();
        console.log('Permission:', permission);
        
        if (permission !== 'granted') {
            showToast('⚠️ Duhet të lejoni njoftimet');
            return;
        }
        
        console.log('Subscribing with WebPushr...');
        const reg = await navigator.serviceWorker.ready;
        
        // Subscribe using WebPushr's public key
        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(WEBPUSHR_PUBLIC_KEY)
        });
        
        console.log('✅ Subscribed!', subscription.endpoint);
        pushSubscribed = true;
        updateNotifUI();
        showToast('🔔 Njoftimet u aktivizuan!');
        
    } catch(e) {
        console.error('Subscribe error:', e);
        showToast('❌ Gabim: ' + e.message);
    }
}

async function unsubscribe() {
    try {
        const reg = await navigator.serviceWorker.ready;
        const subscription = await reg.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
            console.log('Unsubscribed');
        }
        pushSubscribed = false;
        updateNotifUI();
        showToast('🔕 Njoftimet u çaktivizuan');
    } catch(e) {
        console.error(e);
    }
}

// ─── UI ───────────────────────────────────────────────────────────────────────
function updateNotifUI() {
    const bar = document.getElementById('notif-bar');
    const text = document.getElementById('notif-text');
    const btn = document.getElementById('subscribe-btn');
    if (!bar || !text || !btn) return;
    
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        bar.className = 'notif-bar inactive';
        text.innerText = 'Push nuk suportohet';
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
        text.innerText = 'Kliko për të aktivizuar';
        btn.innerText = '🔔 Aktivizo';
        btn.className = 'btn-subscribe enable';
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
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-title">Asnjë porosi në pritje</div></div>';
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
                <div class="order-action-row">
                    <button class="btn-approve" onclick="approveOrder(${o.rowNumber})">✅ Aprovo</button>
                </div>
            </div>`).join('');
    } catch(e) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Gabim</div><div class="empty-sub">${esc(e.message)}</div></div>`;
    }
}

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s.toString();
    return d.innerHTML;
}

async function approveOrder(row) {
    const card = document.getElementById('order-' + row);
    if (card) card.classList.add('processing');
    try {
        const r = await fetch(`${SCRIPT_URL}?action=approve&row=${row}&t=${Date.now()}`);
        const d = await r.json();
        if (d.success) { showToast('✅ Aprovuar!'); setTimeout(loadOrders, 2000); }
        else { showToast('❌ Gabim'); if (card) card.classList.remove('processing'); }
    } catch(e) { showToast('❌ Gabim'); if (card) card.classList.remove('processing'); }
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerText = msg;
    t.classList.add('show');
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.remove('show'), 3000);
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

document.addEventListener('DOMContentLoaded', init);
