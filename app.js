const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJNKQM60EgtoiL9_j0qI8B9hLrjTH9fruhpakO0aMgrJFosgm0dDMkUFWPCAxQlEL7MA/exec';
const VAPID_PUBLIC_KEY = 'BJ7TcIy_DwcitAe01lyoE2FKZxo5qsaUu0o-GfKLul0rEAYzMQqSIvb0q3pi8fVAqEG0GxxEeHTarzTseOWNtwA';

let pushSubscribed = false;

async function init() {
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('/argati/sw.js', { scope: '/argati/' });
            await navigator.serviceWorker.ready;
            if (reg.pushManager) {
                const sub = await reg.pushManager.getSubscription();
                pushSubscribed = !!sub;
            }
        } catch(e) { console.error('SW error:', e); }
    }
    updateUI();
    await loadOrders();
    setInterval(loadOrders, 60000);
    document.getElementById('subscribe-btn').addEventListener('click', toggleNotifications);
}

async function toggleNotifications() {
    if (pushSubscribed) {
        const reg = await navigator.serviceWorker.getRegistration('/argati/');
        if (reg) {
            const sub = await reg.pushManager.getSubscription();
            if (sub) await sub.unsubscribe();
        }
        pushSubscribed = false;
        updateUI();
        showToast('🔕 Çaktivizuar');
    } else {
        try {
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') { showToast('⚠️ Duhet të lejoni'); return; }
            
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
            
            // Save subscription to GAS
            await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'saveSub',
                    subscription: sub.toJSON()
                })
            });
            
            pushSubscribed = true;
            updateUI();
            showToast('🔔 Aktivizuar!');
        } catch(e) {
            showToast('❌ ' + e.message);
        }
    }
}

function updateUI() {
    const bar = document.getElementById('notif-bar');
    const text = document.getElementById('notif-text');
    const btn = document.getElementById('subscribe-btn');
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

async function loadOrders() {
    const container = document.getElementById('pending-orders');
    try {
        const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const orders = await res.json();
        if (!Array.isArray(orders)) throw new Error('Invalid');
        
        const pending = orders.filter(o => {
            const oid = (o.OrderID||'').toString().trim();
            return !oid || oid.toLowerCase() === 'pending';
        });
        
        const today = new Date().toDateString();
        const done = orders.filter(o => {
            const oid = (o.OrderID||'').toString().trim();
            if (!oid || oid.toLowerCase() === 'pending') return false;
            try { return new Date(o.PlacedDate||'').toDateString() === today; } catch(e) { return false; }
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
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Gabim</div></div>';
    }
}

function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s.toString(); return d.innerHTML; }

async function approveOrder(row) {
    const card = document.getElementById('order-'+row);
    if (card) card.classList.add('processing');
    try {
        const r = await fetch(`${SCRIPT_URL}?action=approve&row=${row}`);
        const d = await r.json();
        if (d.success) { showToast('✅ Aprovuar!'); setTimeout(loadOrders, 2000); }
        else { showToast('❌ Gabim'); if(card) card.classList.remove('processing'); }
    } catch(e) { showToast('❌ Gabim'); if(card) card.classList.remove('processing'); }
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg; t.classList.add('show');
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.remove('show'), 3000);
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const o = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) o[i] = rawData.charCodeAt(i);
    return o;
}

document.addEventListener('DOMContentLoaded', init);
