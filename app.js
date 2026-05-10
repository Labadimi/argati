// ─── Parts Center PWA - App Logic (Debug Version) ─────────────────────────────
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJNKQM60EgtoiL9_j0qI8B9hLrjTH9fruhpakO0aMgrJFosgm0dDMkUFWPCAxQlEL7MA/exec';
const VAPID_PUBLIC_KEY = 'BOSn4Ynnig74lu56bG3MoLcdGlDDNsRrDYQ9tQrsy1inJY8_QsU_L-qoGYb-PfPipWD50EcYl-F_UVq9EkNHq1U';

let swRegistration = null;
let pushSubscribed = false;
let allOrders = [];
let pushSupported = false;

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
    const debug = [];
    
    // Check 1: Service Worker
    const hasSW = 'serviceWorker' in navigator;
    debug.push('ServiceWorker: ' + (hasSW ? '✅' : '❌'));
    
    // Check 2: PushManager
    const hasPush = 'PushManager' in window;
    debug.push('PushManager: ' + (hasPush ? '✅' : '❌'));
    
    // Check 3: Notification
    const hasNotif = 'Notification' in window;
    debug.push('Notification: ' + (hasNotif ? '✅' : '❌'));
    
    // Check 4: Standalone mode (must be YES for push)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         navigator.standalone;
    debug.push('Standalone: ' + (isStandalone ? '✅' : '❌ (MUST be ✅)'));
    
    // Check 5: HTTPS
    const isHTTPS = location.protocol === 'https:';
    debug.push('HTTPS: ' + (isHTTPS ? '✅' : '❌'));
    
    // Check 6: iOS version
    const iosMatch = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    if (iosMatch) {
        const major = parseInt(iosMatch[1]);
        const minor = parseInt(iosMatch[2]);
        const versionOK = major > 16 || (major === 16 && minor >= 4);
        debug.push('iOS ' + major + '.' + minor + ': ' + (versionOK ? '✅' : '❌ (need 16.4+)'));
    } else {
        debug.push('iOS: Not detected');
    }
    
    // Overall support
    pushSupported = hasSW && hasPush && hasNotif && isStandalone && isHTTPS;
    debug.push('Push Supported: ' + (pushSupported ? '✅ YES!' : '❌ NO'));
    
    console.log('=== PWA PUSH DIAGNOSTIC ===');
    debug.forEach(line => console.log(line));
    console.log('User Agent:', navigator.userAgent);
    console.log('===========================');
    
    // Show debug info on screen temporarily
    document.getElementById('pending-orders').innerHTML = `
        <div style="background:var(--card);border-radius:16px;padding:16px;border:1px solid var(--border);">
            <div style="font-weight:800;margin-bottom:12px;font-size:16px;">🔍 Diagnoza Push</div>
            ${debug.map(d => `<div style="font-size:13px;margin:6px 0;color:#475569;">${d}</div>`).join('')}
            <button class="btn-approve" onclick="location.reload()" style="margin-top:12px;width:100%;">
                OK - Ngarko Porositë
            </button>
        </div>`;
    
    // Register SW anyway
    if (hasSW) {
        try {
            swRegistration = await navigator.serviceWorker.register('/argati/sw.js', { scope: '/argati/' });
            console.log('SW registered');
            await navigator.serviceWorker.ready;
            
            if (swRegistration.pushManager) {
                try {
                    const sub = await swRegistration.pushManager.getSubscription();
                    pushSubscribed = !!sub;
                } catch(e) {
                    console.log('Push check failed:', e.message);
                }
            }
        } catch(e) {
            console.error('SW error:', e);
        }
    }
    
    updateNotifUI();
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
        showToast('❌ Njoftimet nuk suportohen. Shiko diagnozën më sipër.');
        return;
    }
    
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showToast('⚠️ Duhet të lejoni njoftimet');
            return;
        }
        
        const subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        
        console.log('Subscription:', subscription.endpoint);
        
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveSub',
                subscription: subscription.toJSON()
            })
        });
        
        const data = await response.json();
        
        if (data.saved) {
            pushSubscribed = true;
            updateNotifUI();
            showToast('🔔 Njoftimet u aktivizuan!');
        } else {
            showToast('❌ Nuk u ruajt në server');
        }
    } catch(e) {
        console.error('Subscribe error:', e);
        showToast('❌ ' + e.message);
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
        showToast('🔕 Çaktivizuar');
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
        btn.innerText = 'ℹ️ Pse?';
        btn.className = 'btn-subscribe disable';
        btn.onclick = () => init(); // Re-run diagnostic
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
        const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
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
                </div>`;
            return;
        }
        
        container.innerHTML = pending.map(o => `
            <div class="order-card" id="order-${o.rowNumber}">
                <div class="order-top">
                    <div class="order-name-row">
                        <span class="order-row-num">#${o.rowNumber}</span>
                        <span class="order-name">${(o.Emri||'')} ${(o.Mbiemri||'')}</span>
                    </div>
                </div>
                <div class="order-details">
                    <div class="detail-item">📦 ${o.Produkti||'—'}</div>
                    <div class="detail-item">📍 ${o.Qyteti||'—'}</div>
                    <div class="detail-item">📞 ${o.Telefoni||'—'}</div>
                    <div class="detail-item">🏠 ${o.Adresa||'—'}</div>
                </div>
                ${o['Koment shtese (Nese ka)'] ? `<div class="order-comment">💬 ${o['Koment shtese (Nese ka)']}</div>` : ''}
                <div class="order-action-row">
                    <button class="btn-approve" onclick="approveOrder(${o.rowNumber})">✅ Aprovo</button>
                    <button class="btn-view" onclick="openInMaps('${(o.Adresa||'').replace(/'/g,"\\'")}','${(o.Qyteti||'').replace(/'/g,"\\'")}')">🗺️ Harta</button>
                </div>
            </div>
        `).join('');
        
    } catch(e) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Gabim</div></div>`;
    }
}

async function approveOrder(row) {
    const card = document.getElementById('order-' + row);
    if (card) card.classList.add('processing');
    try {
        const r = await fetch(`${SCRIPT_URL}?action=approve&row=${row}&t=${Date.now()}`);
        const d = await r.json();
        if (d.success) { showToast('✅ Aprovuar!'); setTimeout(loadOrders, 2000); }
        else { showToast('❌ Gabim'); if (card) card.classList.remove('processing'); }
    } catch(e) { showToast('❌ Gabim lidhjeje'); if (card) card.classList.remove('processing'); }
}

function openInMaps(addr, city) {
    window.open('https://maps.apple.com/?q=' + encodeURIComponent(addr + ', ' + city + ', Kosova'), '_blank');
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

// ─── START ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
