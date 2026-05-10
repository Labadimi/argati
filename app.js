const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJNKQM60EgtoiL9_j0qI8B9hLrjTH9fruhpakO0aMgrJFosgm0dDMkUFWPCAxQlEL7MA/exec';
let badgeCount = 0;

async function init() {
    // Register SW
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/argati/sw.js', { scope: '/argati/' });
            await navigator.serviceWorker.ready;
            
            // Start badge polling
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'START_BADGE' });
            }
        } catch(e) { console.error('SW error:', e); }
    }
    
    // Listen for badge updates from SW
    navigator.serviceWorker?.addEventListener('message', event => {
        if (event.data?.type === 'BADGE_UPDATED') {
            badgeCount = event.data.count;
            updateBadgeDisplay();
        }
    });
    
    await loadOrders();
    setInterval(loadOrders, 60000);
    
    // Initial badge update
    updateBadgeDisplay();
}

function updateBadgeDisplay() {
    const badgeEl = document.getElementById('app-badge');
    if (!badgeEl) return;
    
    if (badgeCount > 0) {
        badgeEl.innerText = badgeCount > 99 ? '99+' : badgeCount;
        badgeEl.style.display = 'flex';
    } else {
        badgeEl.style.display = 'none';
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
        
        badgeCount = pending.length;
        updateBadgeDisplay();
        
        // Tell SW to update badge too
        if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'UPDATE_BADGE' });
        }
        
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
    if(card) card.classList.add('processing');
    try {
        const r = await fetch(`${SCRIPT_URL}?action=approve&row=${row}`);
        const d = await r.json();
        if(d.success) { showToast('✅ Aprovuar!'); setTimeout(loadOrders,2000); }
        else { showToast('❌ Gabim'); if(card) card.classList.remove('processing'); }
    } catch(e) { showToast('❌ Gabim'); if(card) card.classList.remove('processing'); }
}

function showToast(msg) {
    const t=document.getElementById('toast');
    t.innerText=msg; t.classList.add('show');
    clearTimeout(t._tid);
    t._tid=setTimeout(()=>t.classList.remove('show'),3000);
}

document.addEventListener('DOMContentLoaded', init);
