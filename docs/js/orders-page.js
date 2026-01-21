import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { collection, getDocs, orderBy, query, where } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

function fmtDate(d) {
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString();
  } catch (e) {
    return '';
  }
}

function moneyNgnFromKobo(kobo) {
  const v = Number(kobo || 0) / 100;
  return `₦${v.toFixed(2)}`;
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderOrders(list) {
  const host = document.getElementById('orders-list');
  if (!host) return;

  if (!list.length) {
    host.innerHTML = '<div class="empty">No orders yet.</div>';
    return;
  }

  host.innerHTML = '';

  list.forEach(o => {
    const items = Array.isArray(o.items) ? o.items : [];
    const itemsHtml = items.slice(0, 20).map(it => {
      const title = esc(it.title || it.name || 'Item');
      const qty = Number(it.quantity || it.qty || 1) || 1;
      const price = Number(it.price || 0);
      return `<div class="order-item"><span>${title}</span><span>x${qty}</span><span>₦${(price * qty).toFixed(2)}</span></div>`;
    }).join('');

    const card = document.createElement('div');
    card.className = 'order-card';

    const totalLabel = o.amountInKobo ? moneyNgnFromKobo(o.amountInKobo) : (o.total ? `₦${Number(o.total || 0).toFixed(2)}` : '');
    const created = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : o.createdAt;

    // Determine status for list view
    let status = 'Pending';
    let statusClass = 'status-pending';
    if (o.status) {
      const s = String(o.status).toLowerCase();
      if (/deliv|delivered/.test(s)) { status = 'Delivered'; statusClass='status-delivered'; }
      else if (/cancel|canceled|cancelled/.test(s)) { status = 'Cancelled'; statusClass='status-cancelled'; }
      else if (/process|processing|paid|confirmed/.test(s)) { status = 'Processing'; statusClass='status-processing'; }
      else { status = String(o.status); statusClass='status-processing'; }
    } else if (Array.isArray(o.trackingNumbers) && o.trackingNumbers.length) { status = 'Confirmed'; statusClass = 'status-confirmed'; }
    if (o.isPending) { status = 'Pending verification'; statusClass = 'status-pending'; }

    const statusBadge = `<div style="margin-top:8px"><span class="status-badge ${statusClass}">${esc(status)}</span></div>`;

    const tracking = Array.isArray(o.trackingNumbers) && o.trackingNumbers.length ? `<div style="margin-top:10px"><strong>Tracking:</strong> <span style="color:#072634">${esc((o.trackingNumbers||[]).slice(0,3).join(', '))}${o.trackingNumbers.length>3? ' ...' : ''}</span> <a href="order-details.html?id=${esc(o.id||'')}#tracking" class="track-link">Track</a> <a href="#" class="view-tracking" data-ref="${esc(o.reference||'')}">Quick view</a></div>` : '';

    card.innerHTML = `
      <div class="order-head">
        <div>
          <div class="order-title">Order</div>
          <div class="order-sub">${esc(o.reference || '')}</div>
        </div>
        <div class="order-meta">
          <div class="order-total">${totalLabel}</div>
          <div class="order-date">${esc(fmtDate(created))}</div>
        </div>
      </div>
      ${statusBadge}
  });

  // Attach view tracking handlers
  host.querySelectorAll('.view-tracking').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const ref = a.getAttribute('data-ref');
      const order = list.find(o => o.reference === ref);
      if (!order) return;
      if (order.id) {
        window.location.href = `order-details.html?id=${encodeURIComponent(order.id)}#tracking`;
        return;
      }
      const tlist = (order.trackingNumbers || []).slice(0, 50);
      alert('Tracking numbers for ' + ref + '\n\n' + (tlist.length ? tlist.join('\n') : 'No tracking numbers available'));
    });
  });
}

async function loadOrders(user) {
  const host = document.getElementById('orders-list');
  if (host) host.innerHTML = '<div class="loading">Loading orders...</div>';

  const q = query(
    collection(db, 'orders'),
    where('uid', '==', user.uid),
    orderBy('createdAt', 'desc')
  );

  const snap = await getDocs(q);
  const list = [];
  snap.forEach(d => list.push({ id: d.id, ...d.data() }));
  renderOrders(list);
}

document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = `login.html?redirect=${encodeURIComponent('orders.html')}`;
      return;
    }

    try {
      await loadOrders(user);
    } catch (err) {
      console.error('Load orders error:', err);
      const host = document.getElementById('orders-list');
      if (host) host.innerHTML = '<div class="empty">Could not load orders.</div>';
    }
  });
});
