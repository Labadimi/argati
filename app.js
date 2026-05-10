// ─── Parts Center PWA App ─────────────────────────────────────────────────────
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJNKQM60EgtoiL9_j0qI8B9hLrjTH9fruhpakO0aMgrJFosgm0dDMkUFWPCAxQlEL7MA/exec';
const VAPID_PUBLIC_KEY = 'BOSn4Ynnig74lu56bG3MoLcdGlDDNsRrDYQ9tQrsy1inJY8_QsU_L-qoGYb-PfPipWD50EcYl-F_UVq9EkNHq1U';

let swRegistration = null;
let pushSubscribed = false;

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
        try {
            swRegistration = await navigator.serviceWorker.register('sw.js');
            console.log('SW registered:', swRegistration.scope);
            
            // Check existing subscription
            const subscription = await swRegistration.pushManager.getSubscription();
            pushSubscribed = !!subscription;
            updateNotifStatus();
            
            // Load orders
            loadOrders();
            
            // Auto-refresh every 30s
            setInterval(loadOrders, 30000);
            
        } catch(e) {
            console.error('SW registration failed:', e);
            document.getElementById('pending-orders').innerHTML = 
                '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Service Worker Error</div><p>' + e.message + '</p></div>';
        }
    } else {
        document.getElementById('notif-text').innerText = 'Push not supported on this device';
    }
}

// ─── PUSH SUBSCRIPTION ────────────────────────────────────────────────────────
async function subscribeToPush() {
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showToast('Please allow notifications in Settings');
            return;
        }
        
        const subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        
        // Save to server
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveSub',
                subscription: subscription.toJSON()
            })
        });
        
        const data = await response.json();
        if (data.saved) {
            pushSubscribed = true;
            updateNotifStatus();
            showToast('🔔 Notifications enabled!');
        } else {
            showToast('Failed to save subscription');
        }
        
    } catch(e) {
        console.error('Subscribe error:', e);
        showToast('Error: ' + e.message);
    }
}

async function unsubscribeFromPush() {
    const subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) {
        await subscription.unsubscribe();
        pushSubscribed = false;
        updateNotifStatus();
        showToast('Notifications disabled');
    }
}

// ─── UI UPDATES ───────────────────────────────────────────────────────────────
function updateNotifStatus() {
    const statusEl = document.getElementById('notif-status');
    const textEl = document.getElementById('notif-text');
    const btnEl = document.getElementById('subscribe-btn');
    
    if (pushSubscribed) {
        statusEl.className = 'notif-status active';
        textEl.innerText = 'Notifications active';
        btnEl.innerText = '🔕 Disable';
        btnEl.onclick = unsubscribeFromPush;
        btnEl.className = 'btn btn-secondary';
        btnEl.style.marginLeft = 'auto';
    } else {
        statusEl.className = 'notif-status inactive';
        textEl.innerText = 'Notifications inactive';
        btnEl.innerText = '🔔 Enable';
        btnEl.onclick = subscribeToPush;
        btnEl.className = 'btn btn-primary';
        btnEl.style.marginLeft = 'auto';
    }
}

// ─── LOAD ORDERS ──────────────────────────────────────────────────────────────
async function loadOrders() {
    const container = document.getElementById('pending-orders');
    
    try {
        const response = await fetch(`${SCRIPT_URL}?action=pending&t=${Date.now()}`);
        const orders = await response.json();
        
        if (!orders || orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎉</div>
                    <div class="empty-title">No pending orders</div>
                    <p style="font-size:13px;margin-top:4px;">All orders have been processed</p>
                </div>`;
            return;
        }
        
        container.innerHTML = orders.map(order => {
            const name = `${order.Emri || ''} ${order.Mbiemri || ''}`.trim();
            const product = order.Produkti || '—';
            const city = order.Qyteti || '—';
            const phone = order.Telefoni || '—';
            const address = order.Adresa || '—';
            const comment = order['Koment shtese (Nese ka)'] || '';
            
            return `
                <div class="order-card" id="order-${order.rowNumber}">
                    <div class="order-top">
                        <div class="order-name">${name}</div>
                        <div class="order-row">#${order.rowNumber}</div>
                    </div>
                    <div class="order-details">
                        <div class="order-detail-item">📦 ${product}</div>
                        <div class="order-detail-item">📍 ${city}</div>
                    </div>
                    <div class="order-details">
                        <div class="order-detail-item">📞 ${phone}</div>
                        <div class="order-detail-item">🏠 ${address}</div>
                    </div>
                    ${comment ? `<div style="background:#fef3c7; padding:6px 10px; border-radius:6px; font-size:11px; margin-bottom:8px;">💬 ${comment}</div>` : ''}
                    <div class="order-actions">
                        <button class="btn-approve" onclick="approveOrder(${order.rowNumber})">
                            ✅ Approve
                        </button>
                        <button class="btn-skip" onclick="skipOrder(${order.rowNumber})">
                            ➡️ Skip
                        </button>
                    </div>
                </div>`;
        }).join('');
        
    } catch(e) {
        console.error('Load orders error:', e);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <div class="empty-title">Connection Error</div>
                <p style="font-size:13px;margin-top:4px;">${e.message}</p>
                <button class="btn btn-primary" onclick="loadOrders()" style="margin-top:12px;">Retry</button>
            </div>`;
    }
}

// ─── ORDER ACTIONS ────────────────────────────────────────────────────────────
async function approveOrder(rowNumber) {
    const card = document.getElementById(`order-${rowNumber}`);
    if (card) card.style.opacity = '0.5';
    
    try {
        const response = await fetch(`${SCRIPT_URL}?action=approve&row=${rowNumber}&t=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Order #' + rowNumber + ' approved!');
            // Reload after short delay
            setTimeout(loadOrders, 1500);
        } else {
            showToast('Error: ' + (data.error || 'Unknown'));
            if (card) card.style.opacity = '1';
        }
    } catch(e) {
        showToast('Connection error');
        if (card) card.style.opacity = '1';
    }
}

function skipOrder(rowNumber) {
    // Just scroll to next order
    const cards = document.querySelectorAll('.order-card');
    let found = false;
    for (let card of cards) {
        if (found) {
            card.scrollIntoView({ behavior: 'smooth' });
            break;
        }
        if (card.id === `order-${rowNumber}`) found = true;
    }
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ─── UTIL ─────────────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// ─── START ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
