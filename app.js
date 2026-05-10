// ─── Parts Center PWA - Aggressive Background Polling ─────────────────────────
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJNKQM60EgtoiL9_j0qI8B9hLrjTH9fruhpakO0aMgrJFosgm0dDMkUFWPCAxQlEL7MA/exec';

let notificationEnabled = false;
let lastNotificationId = null;
let keepAliveInterval = null;
let notificationInterval = null;

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
    console.log('🚀 PWA Starting...');
    
    // Register SW
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('/argati/sw.js', { scope: '/argati/' });
            console.log('✅ SW registered');
            await navigator.serviceWorker.ready;
            console.log('✅ SW ready');
        } catch(e) {
            console.error('SW error:', e);
        }
    }
    
    // Check permission
    if ('Notification' in window) {
        notificationEnabled = Notification.permission === 'granted';
    }
    
    updateNotifUI();
    await loadOrders();
    setInterval(loadOrders, 60000);
    
    // If notifications enabled, start aggressive polling
    if (notificationEnabled) {
        startBackgroundPolling();
    }
    
    // Keep-alive: ping SW every 10 seconds to prevent iOS from killing it
    keepAliveInterval = setInterval(() => {
        if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'KEEP_ALIVE' });
        }
    }, 10000);
}

// ─── START BACKGROUND POLLING ─────────────────────────────────────────────────
function startBackgroundPolling() {
    if (notificationInterval) clearInterval(notificationInterval);
    
    // Poll every 15 seconds
    notificationInterval = setInterval(checkNotifications, 15000);
    
    // First check immediately
    checkNotifications();
    
    // Also tell SW to poll
    if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ 
            type: 'START_POLLING',
            scriptUrl: SCRIPT_URL
        });
    }
}

// ─── CHECK NOTIFICATIONS ──────────────────────────────────────────────────────
async function checkNotifications() {
    if (!notificationEnabled) return;
    
    try {
        const res = await fetch(`${SCRIPT_URL}?action=notifications&t=${Date.now()}`);
        if (!res.ok) return;
        
        const data = await res.json();
        if (!data.notifications?.length) return;
        
        for (const notif of data.notifications) {
            if (notif.id !== lastNotificationId) {
                // Show via SW for lock screen delivery
                if (navigator.serviceWorker?.ready) {
                    const reg = await navigator.serviceWorker.ready;
                    await reg.showNotification(notif.title, {
                        body: notif.body,
                        icon: '/argati/icon-192.png',
                        badge: '/argati/icon-192.png',
                        tag: 'order-' + notif.id,
                        requireInteraction: true,
                        vibrate: [200, 100, 200, 100, 200],
                        silent: false
                    });
                    console.log('📱 Notification sent:', notif.title);
                }
                lastNotificationId = notif.id;
            }
        }
    } catch(e) {
        console.log('Poll error:', e.message);
    }
}

// ─── NOTIFICATION PERMISSION ──────────────────────────────────────────────────
async function toggleNotifications() {
    if (notificationEnabled) {
        notificationEnabled = false;
        if (notificationInterval) clearInterval(notificationInterval);
        updateNotifUI();
        showToast('🔕 Çaktivizuar');
    } else {
        if (!('Notification' in window)) {
            showToast('❌ Nuk suportohet');
            return;
        }
        
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
            notificationEnabled = true;
            updateNotifUI();
            startBackgroundPolling();
            showToast('🔔 Aktivizuar!');
            
            // Test notification
            setTimeout(async () => {
                if (navigator.serviceWorker?.ready) {
                    const reg = await navigator.serviceWorker.ready;
                    await reg.showNotification('✅ Argati Gati!', {
                        body: 'Njoftimet janë aktive',
                        icon: '/argati/icon-192.png',
                        requireInteraction: true
                    });
                }
            }, 2000);
        } else {
            showToast('⚠️ Duhet të lejoni njoftimet');
        }
    }
}

// ─── UI ───────────────────────────────────────────────────────────────────────
function updateNotifUI() {
    const bar = document.getElementById('notif-bar');
    const text = document.getElementById('notif-text');
    const btn = document.getElementById('subscribe-btn');
    if (!bar || !text || !btn) return;
    
    if (!('Notification' in window)) {
        bar.className = 'notif-bar inactive';
        text.innerText = 'Njoftimet nuk suportohen';
        btn.innerText = 'ℹ️';
        btn.className = 'btn-subscribe disable';
        return;
    }
    
    if (notificationEnabled) {
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

// ─── PAGE VISIBILITY ──────────────────────────────────────────────────────────
// When page becomes visible, check notifications immediately
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && notificationEnabled) {
        checkNotifications();
        loadOrders();
    }
});

// ─── START ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
