// ─── Parts Center PWA - App Logic ─────────────────────────────────────────────
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJNKQM60EgtoiL9_j0qI8B9hLrjTH9fruhpakO0aMgrJFosgm0dDMkUFWPCAxQlEL7MA/exec';
const VAPID_PUBLIC_KEY = 'BOSn4Ynnig74lu56bG3MoLcdGlDDNsRrDYQ9tQrsy1inJY8_QsU_L-qoGYb-PfPipWD50EcYl-F_UVq9EkNHq1U';

let swRegistration = null;
let pushSubscribed = false;
let allOrders = [];

// ─── INITIALIZATION ───────────────────────────────────────────────────────────
async function init() {
    // First, check if service workers are supported
    if (!('serviceWorker' in navigator)) {
        showError('Service Worker nuk suportohet në këtë shfletues');
        return;
    }

    // Check if Push API is supported
    if (!('PushManager' in window)) {
        showError('Push notifications nuk suportohen në këtë paisje');
        document.getElementById('subscribe-btn').style.display = 'none';
        document.getElementById('notif-text').innerText = 'Njoftimet nuk suportohen';
        await loadOrders();
        return;
    }

    try {
        // Register service worker
        swRegistration = await navigator.serviceWorker.register('sw.js', { 
            scope: '/' 
        });
        console.log('✅ Service Worker registered:', swRegistration.scope);
        
        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        console.log('✅ Service Worker ready');
        
        // Now safely check push subscription
        if (swRegistration && swRegistration.pushManager) {
            try {
                const subscription = await swRegistration.pushManager.getSubscription();
                pushSubscribed = !!subscription;
                console.log('Push subscribed:', pushSubscribed);
            } catch(pushErr) {
                console.warn('Push check failed:', pushErr);
                pushSubscribed = false;
            }
        }
        
        updateNotifUI();
        
        // Load orders
        await loadOrders();
        
        // Auto-refresh every 45 seconds
        setInterval(loadOrders, 45000);
        
    } catch(e) {
        console.error('Init error:', e);
        showError(e.message || 'Gabim i panjohur gjatë inicializimit');
    }
}

// ─── SHOW ERROR ───────────────────────────────────────────────────────────────
function showError(message) {
    document.getElementById('pending-orders').innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <div class="empty-title">Gabim</div>
            <div class="empty-sub">${message}</div>
            <button class="btn-subscribe enable" onclick="location.reload()" style="margin-top:12px;">
                Rifresko faqen
            </button>
        </div>`;
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
    try {
        // Check if we have service worker registration
        if (!swRegistration) {
            showToast('❌ Service Worker nuk është gati. Rifresko faqen.');
            return;
        }

        if (!swRegistration.pushManager) {
            showToast('❌ PushManager nuk suportohet');
            return;
        }
        
        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showToast('⚠️ Ju lutemi lejoni njoftimet në Settings të iPhone');
            return;
        }
        
        console.log('Subscribing with VAPID key...');
        
        // Subscribe with VAPID key
        const subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        
        console.log('Subscription created:', subscription.endpoint);
        
        // Save subscription to Google Apps Script
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveSub',
                subscription: subscription.toJSON()
            })
        });
        
        const data = await response.json();
        console.log('Save response:', data);
        
        if (data && data.saved) {
            pushSubscribed = true;
            updateNotifUI();
            showToast('🔔 Njoftimet u aktivizuan!');
        } else {
            showToast('❌ Ruajtja dështoi. Provoni përsëri.');
        }
        
    } catch(e) {
        console.error('Subscribe error:', e);
        
        if (e.name === 'NotAllowedError') {
            showToast('⚠️ Njoftimet u bllokuan. Kontrolloni Settings.');
        } else if (e.name === 'InvalidStateError') {
            showToast('❌ Regjistrimi ekziston. Rifresko faqen.');
        } else {
            showToast('Gabim: ' + (e.message || 'E panjohur'));
        }
    }
}

async function unsubscribeFromPush() {
    try {
        if (!swRegistration || !swRegistration.pushManager) {
            pushSubscribed = false;
            updateNotifUI();
            return;
        }

        const subscription = await swRegistration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
            console.log('Unsubscribed');
        }
        pushSubscribed = false;
        updateNotifUI();
        showToast('🔕 Njoftimet u çaktivizuan');
    } catch(e) {
        console.error('Unsubscribe error:', e);
        pushSubscribed = false;
        updateNotifUI();
    }
}

function updateNotifUI() {
    const bar = document.getElementById('notif-bar');
    const text = document.getElementById('notif-text');
    const btn = document.getElementById('subscribe-btn');
    
    if (!bar || !text || !btn) return;
    
    if (pushSubscribed) {
        bar.className = 'notif-bar active';
        text.innerText = 'Njoftimet aktive';
        btn.innerText = '🔕 Çaktivizo';
        btn.className = 'btn-subscribe disable';
    } else {
        bar.className = 'notif-bar inactive';
        text.innerText = 'Njoftimet jo aktive';
        btn.innerText = '🔔 Aktivizo';
        btn.className = 'btn-subscribe enable';
    }
}

// ─── LOAD ORDERS ──────────────────────────────────────────────────────────────
async function loadOrders() {
    const container = document.getElementById('pending-orders');
    
    try {
        const response = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const orders = await response.json();
        
        if (!Array.isArray(orders)) {
            throw new Error('Invalid response format');
        }
        
        allOrders = orders;
        
        // Calculate stats
        const todayStr = new Date().toDateString();
        const pendingOrders = orders.filter(o => {
            const oid = (o.OrderID || '').toString().trim();
            return !oid || oid.toLowerCase() === 'pending';
        });
        const completedToday = orders.filter(o => {
            const oid = (o.OrderID || '').toString().trim();
            if (!oid || oid.toLowerCase() === 'pending') return false;
            const placed = (o.PlacedDate || '').toString().trim();
            if (!placed) return false;
            try { return new Date(placed).toDateString() === todayStr; } catch(e) { return false; }
        });
        
        // Update stats
        const statPending = document.getElementById('stat-pending');
        const statDone = document.getElementById('stat-done');
        const pendingCount = document.getElementById('pending-count');
        
        if (statPending) statPending.innerText = pendingOrders.length;
        if (statDone) statDone.innerText = completedToday.length;
        if (pendingCount) pendingCount.innerText = pendingOrders.length;
        
        // Render pending orders
        if (pendingOrders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎉</div>
                    <div class="empty-title">Asnjë porosi në pritje</div>
                    <div class="empty-sub">Të gjitha porositë janë përpunuar</div>
                </div>`;
            return;
        }
        
        container.innerHTML = pendingOrders.map(order => renderOrderCard(order)).join('');
        
    } catch(e) {
        console.error('Load orders error:', e);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <div class="empty-title">Gabim në lidhje</div>
                <div class="empty-sub">${e.message || 'Nuk mund të lidhet me serverin'}</div>
                <button class="btn-subscribe enable" onclick="loadOrders()" style="margin-top:12px;">Provo përsëri</button>
            </div>`;
    }
}

function renderOrderCard(order) {
    const name = `${order.Emri || ''} ${order.Mbiemri || ''}`.trim() || 'Pa emër';
    const product = order.Produkti || '—';
    const city = order.Qyteti || '—';
    const phone = order.Telefoni || '—';
    const address = order.Adresa || '—';
    const comment = order['Koment shtese (Nese ka)'] || order.KomentshtesaNeseka || '';
    const email = order['Email(Opsionale)'] || '';
    
    const safeAddress = address.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const safeCity = city.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    
    return `
    <div class="order-card" id="order-${order.rowNumber}">
        <div class="order-top">
            <div class="order-name-row">
                <span class="order-row-num">#${order.rowNumber}</span>
                <span class="order-name">${name}</span>
            </div>
        </div>
        <div class="order-details">
            <div class="detail-item"><span class="detail-icon">📦</span>${product}</div>
            <div class="detail-item"><span class="detail-icon">📍</span>${city}</div>
            <div class="detail-item"><span class="detail-icon">📞</span>${phone}</div>
            <div class="detail-item"><span class="detail-icon">🏠</span>${address}</div>
            ${email ? `<div class="detail-item" style="grid-column:1/-1;"><span class="detail-icon">📧</span>${email}</div>` : ''}
        </div>
        ${comment ? `<div class="order-comment">💬 <span>${comment}</span></div>` : ''}
        <div class="order-action-row">
            <button class="btn-approve" onclick="approveOrder(${order.rowNumber})">
                ✅ Aprovo
            </button>
            <button class="btn-view" onclick="openInMaps('${safeAddress}', '${safeCity}')">
                🗺️ Harta
            </button>
        </div>
    </div>`;
}

// ─── APPROVE ORDER ────────────────────────────────────────────────────────────
async function approveOrder(rowNumber) {
    const card = document.getElementById(`order-${rowNumber}`);
    if (card) card.classList.add('processing');
    
    try {
        const response = await fetch(`${SCRIPT_URL}?action=approve&row=${rowNumber}&t=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Porosia #' + rowNumber + ' u aprovua!');
            setTimeout(loadOrders, 2000);
        } else {
            showToast('❌ Gabim: ' + (data.error || 'E panjohur'));
            if (card) card.classList.remove('processing');
        }
    } catch(e) {
        showToast('❌ Gabim në lidhje');
        if (card) card.classList.remove('processing');
    }
}

// ─── OPEN IN MAPS ─────────────────────────────────────────────────────────────
function openInMaps(address, city) {
    const query = encodeURIComponent(`${address}, ${city}, Kosova`);
    window.open(`https://maps.apple.com/?q=${query}`, '_blank');
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ─── UTILITY ──────────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// ─── START ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
