// ─── Parts Center PWA - App Logic (Safe Version) ─────────────────────────────
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJNKQM60EgtoiL9_j0qI8B9hLrjTH9fruhpakO0aMgrJFosgm0dDMkUFWPCAxQlEL7MA/exec';
const VAPID_PUBLIC_KEY = 'BOSn4Ynnig74lu56bG3MoLcdGlDDNsRrDYQ9tQrsy1inJY8_QsU_L-qoGYb-PfPipWD50EcYl-F_UVq9EkNHq1U';

let swRegistration = null;
let pushSubscribed = false;
let allOrders = [];
let pushSupported = false;

// ─── INITIALIZATION ───────────────────────────────────────────────────────────
async function init() {
    console.log('🚀 Init starting...');
    console.log('User Agent:', navigator.userAgent);
    console.log('Standalone mode:', window.matchMedia('(display-mode: standalone)').matches);
    
    // Check what's available
    const hasSW = 'serviceWorker' in navigator;
    const hasPush = 'PushManager' in window;
    const hasNotif = 'Notification' in window;
    
    console.log('ServiceWorker supported:', hasSW);
    console.log('PushManager supported:', hasPush);
    console.log('Notification supported:', hasNotif);
    
    pushSupported = hasSW && hasPush && hasNotif;
    
    if (hasSW) {
        try {
            swRegistration = await navigator.serviceWorker.register('sw.js', { scope: '/' });
            console.log('✅ Service Worker registered');
            
            // Wait for it to be ready
            await navigator.serviceWorker.ready;
            console.log('✅ Service Worker ready');
            
            // Check if already subscribed to push
            if (hasPush && swRegistration.pushManager) {
                try {
                    const subscription = await swRegistration.pushManager.getSubscription();
                    pushSubscribed = !!subscription;
                    console.log('Push already subscribed:', pushSubscribed);
                    if (subscription) {
                        console.log('Endpoint:', subscription.endpoint);
                    }
                } catch(e) {
                    console.log('Push check failed (may not be supported):', e.message);
                    pushSubscribed = false;
                    pushSupported = false;
                }
            } else {
                console.log('PushManager not available on this device');
                pushSupported = false;
            }
        } catch(e) {
            console.error('SW registration failed:', e);
            swRegistration = null;
            pushSupported = false;
        }
    }
    
    updateNotifUI();
    await loadOrders();
    
    // Auto-refresh every 45 seconds
    setInterval(loadOrders, 45000);
    
    console.log('✅ Init complete. Push supported:', pushSupported, 'Subscribed:', pushSubscribed);
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
    console.log('📱 Attempting to subscribe to push...');
    
    if (!pushSupported || !swRegistration) {
        showToast('❌ Njoftimet nuk suportohen në këtë paisje/shfletues');
        console.log('Push not supported - swRegistration:', !!swRegistration, 'pushSupported:', pushSupported);
        return;
    }
    
    try {
        // Request permission
        console.log('Requesting notification permission...');
        const permission = await Notification.requestPermission();
        console.log('Permission result:', permission);
        
        if (permission !== 'granted') {
            showToast('⚠️ Ju lutemi lejoni njoftimet në Settings');
            return;
        }
        
        // Check pushManager exists
        if (!swRegistration.pushManager) {
            console.error('pushManager is null/undefined');
            showToast('❌ Push Manager nuk është i disponueshëm');
            return;
        }
        
        console.log('VAPID key:', VAPID_PUBLIC_KEY);
        
        // Subscribe
        const subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        
        console.log('✅ Subscription created:', subscription.endpoint);
        
        // Save to Google Apps Script
        const savePayload = {
            action: 'saveSub',
            subscription: subscription.toJSON()
        };
        console.log('Saving subscription...', JSON.stringify(savePayload).substring(0, 100) + '...');
        
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(savePayload)
        });
        
        const data = await response.json();
        console.log('Save response:', data);
        
        if (data && data.saved) {
            pushSubscribed = true;
            updateNotifUI();
            showToast('🔔 Njoftimet u aktivizuan!');
            
            // Test notification after 3 seconds
            setTimeout(() => {
                console.log('Testing - you should receive a push soon...');
            }, 3000);
        } else {
            showToast('❌ Ruajtja dështoi: ' + JSON.stringify(data));
        }
        
    } catch(e) {
        console.error('Subscribe error:', e);
        console.error('Error name:', e.name);
        console.error('Error message:', e.message);
        
        if (e.name === 'NotAllowedError') {
            showToast('⚠️ Njoftimet u bllokuan. Shkoni te Settings > Safari > Notifications');
        } else if (e.name === 'InvalidStateError') {
            showToast('❌ Tashmë jeni i regjistruar. Rifresko faqen.');
        } else if (e.name === 'TypeError') {
            showToast('❌ Gabim teknik. Kjo paisje mund të mos suportojë push.');
            pushSupported = false;
            updateNotifUI();
        } else {
            showToast('❌ Gabim: ' + (e.message || 'E panjohur'));
        }
    }
}

async function unsubscribeFromPush() {
    try {
        if (swRegistration && swRegistration.pushManager) {
            const subscription = await swRegistration.pushManager.getSubscription();
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
        pushSubscribed = false;
        updateNotifUI();
    }
}

function updateNotifUI() {
    const bar = document.getElementById('notif-bar');
    const text = document.getElementById('notif-text');
    const btn = document.getElementById('subscribe-btn');
    
    if (!bar || !text || !btn) return;
    
    if (!pushSupported) {
        bar.className = 'notif-bar inactive';
        text.innerText = 'Njoftimet nuk suportohen në këtë paisje';
        btn.innerText = 'ℹ️ Info';
        btn.className = 'btn-subscribe disable';
        btn.onclick = () => showToast('Njoftimet kërkojnë iOS 16.4+ dhe PWA të instaluar');
        return;
    }
    
    if (pushSubscribed) {
        bar.className = 'notif-bar active';
        text.innerText = 'Njoftimet aktive';
        btn.innerText = '🔕 Çaktivizo';
        btn.className = 'btn-subscribe disable';
        btn.onclick = toggleNotifications;
    } else {
        bar.className = 'notif-bar inactive';
        text.innerText = 'Njoftimet jo aktive';
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
        const response = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const orders = await response.json();
        
        if (!Array.isArray(orders)) {
            throw new Error('Invalid response: ' + typeof orders);
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
        document.getElementById('stat-pending').innerText = pendingOrders.length;
        document.getElementById('stat-done').innerText = completedToday.length;
        document.getElementById('pending-count').innerText = pendingOrders.length;
        
        // Render
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
                <div class="empty-sub">Kontrolloni lidhjen e internetit</div>
                <button class="btn-subscribe enable" onclick="loadOrders()" style="margin-top:12px;">
                    🔄 Provo përsëri
                </button>
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
    
    const safeAddr = address.replace(/'/g, "\\'");
    const safeCity = city.replace(/'/g, "\\'");
    
    return `
    <div class="order-card" id="order-${order.rowNumber}">
        <div class="order-top">
            <div class="order-name-row">
                <span class="order-row-num">#${order.rowNumber}</span>
                <span class="order-name">${escapeHtml(name)}</span>
            </div>
        </div>
        <div class="order-details">
            <div class="detail-item"><span class="detail-icon">📦</span>${escapeHtml(product)}</div>
            <div class="detail-item"><span class="detail-icon">📍</span>${escapeHtml(city)}</div>
            <div class="detail-item"><span class="detail-icon">📞</span>${escapeHtml(phone)}</div>
            <div class="detail-item"><span class="detail-icon">🏠</span>${escapeHtml(address)}</div>
            ${email ? `<div class="detail-item" style="grid-column:1/-1;"><span class="detail-icon">📧</span>${escapeHtml(email)}</div>` : ''}
        </div>
        ${comment ? `<div class="order-comment">💬 <span>${escapeHtml(comment)}</span></div>` : ''}
        <div class="order-action-row">
            <button class="btn-approve" onclick="approveOrder(${order.rowNumber})">
                ✅ Aprovo
            </button>
            <button class="btn-view" onclick="openInMaps('${safeAddr}', '${safeCity}')">
                🗺️ Harta
            </button>
        </div>
    </div>`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── UTILITY ──────────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// ─── START ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
