// ─── Parts Center PWA - Polling-Based Notifications ───────────────────────────
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJNKQM60EgtoiL9_j0qI8B9hLrjTH9fruhpakO0aMgrJFosgm0dDMkUFWPCAxQlEL7MA/exec';

let notificationEnabled = false;
let lastNotificationId = null;
let pollingInterval = null;

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
    console.log('🚀 PWA Starting...');
    
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/argati/sw.js', { scope: '/argati/' });
            console.log('✅ SW registered:', registration.scope);
            await navigator.serviceWorker.ready;
            console.log('✅ SW ready');
        } catch(e) {
            console.error('SW registration failed:', e);
        }
    }
    
    // Check notification permission
    if ('Notification' in window) {
        notificationEnabled = Notification.permission === 'granted';
        console.log('Notification permission:', Notification.permission);
    }
    
    updateNotifUI();
    await loadOrders();
    
    // Poll for new orders every 60 seconds
    setInterval(loadOrders, 60000);
    
    // Poll for notifications every 15 seconds (more frequent)
    pollingInterval = setInterval(checkNotifications, 15000);
    
    // First notification check after 3 seconds
    setTimeout(checkNotifications, 3000);
}

// ─── NOTIFICATION PERMISSION ──────────────────────────────────────────────────
async function toggleNotifications() {
    if (notificationEnabled) {
        notificationEnabled = false;
        updateNotifUI();
        showToast('🔕 Njoftimet u çaktivizuan');
    } else {
        if (!('Notification' in window)) {
            showToast('❌ Njoftimet nuk suportohen');
            return;
        }
        
        try {
            const permission = await Notification.requestPermission();
            console.log('Permission result:', permission);
            
            if (permission === 'granted') {
                notificationEnabled = true;
                updateNotifUI();
                showToast('🔔 Njoftimet u aktivizuan!');
                
                // Test notification via SW after 2 seconds
                setTimeout(() => {
                    showNotificationViaSW('✅ Argati Gati!', 'Do të njoftoheni për porositë e reja');
                }, 2000);
            } else {
                showToast('⚠️ Duhet të lejoni njoftimet në Settings të iPhone');
            }
        } catch(e) {
            console.error('Permission error:', e);
            showToast('❌ Gabim: ' + e.message);
        }
    }
}

// ─── CHECK FOR NEW NOTIFICATIONS (POLLING) ────────────────────────────────────
async function checkNotifications() {
    if (!notificationEnabled) return;
    
    try {
        const res = await fetch(`${SCRIPT_URL}?action=notifications&t=${Date.now()}`);
        
        if (!res.ok) {
            console.log('Poll HTTP error:', res.status);
            return;
        }
        
        const data = await res.json();
        
        if (!data.notifications || data.notifications.length === 0) return;
        
        // Show each notification via Service Worker
        data.notifications.forEach(notif => {
            if (notif.id !== lastNotificationId) {
                showNotificationViaSW(notif.title, notif.body);
                lastNotificationId = notif.id;
            }
        });
        
    } catch(e) {
        console.log('Poll error (will retry):', e.message);
    }
}

// ─── SHOW NOTIFICATION VIA SERVICE WORKER ─────────────────────────────────────
function showNotificationViaSW(title, body) {
    if (!notificationEnabled) return;
    
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
        console.log('SW not ready yet');
        return;
    }
    
    // Send message to Service Worker to show notification
    navigator.serviceWorker.ready.then(registration => {
        // Method 1: Direct SW notification (works in background)
        registration.showNotification(title, {
            body: body,
            icon: '/argati/icon-192.png',
            badge: '/argati/icon-192.png',
            tag: 'order-' + Date.now(),
            requireInteraction: true,
            vibrate: [200, 100, 200, 100, 200],
            timestamp: Date.now(),
            silent: false,
            data: {
                url: self.location.origin + '/argati/',
                timestamp: Date.now()
            }
        });
        console.log('📱 Notification sent via SW:', title);
    }).catch(err => {
        console.error('SW notification failed:', err);
        // Fallback to regular notification
        try {
            new Notification(title, { body: body, icon: '/argati/icon-192.png', requireInteraction: true });
        } catch(e) {
            console.error('Fallback notification failed:', e);
        }
    });
}

// ─── UI UPDATE ────────────────────────────────────────────────────────────────
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
        text.innerText = 'Kliko për të aktivizuar njoftimet';
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
        if (!Array.isArray(orders)) throw new Error('Përgjigje e pavlefshme');
        
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
                <div class="order-action-row">
                    <button class="btn-approve" onclick="approveOrder(${o.rowNumber})">✅ Aprovo</button>
                </div>
            </div>
        `).join('');
        
    } catch(e) {
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
            showToast('❌ Gabim');
            if (card) card.classList.remove('processing');
        }
    } catch(e) {
        showToast('❌ Gabim lidhjeje');
        if (card) card.classList.remove('processing');
    }
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerText = msg;
    t.classList.add('show');
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── START ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
