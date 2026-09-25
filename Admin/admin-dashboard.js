const ADMIN_USERNAME = 'infininekenya';
    const SESSION_KEY = 'infinineAdminSession';
    const ORDER_KEY = 'infinineOrders';
    const ADMIN_SESSION_TTL_MS = 10 * 60 * 1000;

    function readSession() {
      const session = localStorage.getItem(SESSION_KEY);
      if (!session) return null;
      try {
        const parsed = JSON.parse(session);
        if (!parsed || parsed.username !== ADMIN_USERNAME || parsed.expiresAt <= Date.now()) {
          localStorage.removeItem(SESSION_KEY);
          return null;
        }
        return parsed;
      } catch (error) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
    }

    function ensureAccess() {
      if (!readSession()) {
        window.location.href = './admin.html';
      }
    }

    function getOrders() {
      try {
        const raw = localStorage.getItem(ORDER_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (error) {
        return [];
      }
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function getStatusClass(status) {
      const safe = (status || '').toLowerCase();
      if (safe === 'new') return 'new';
      if (safe === 'pending') return 'pending';
      return 'complete';
    }

    function getLastSixMonthsChart(orders) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const values = Array(6).fill(0);

      if (!orders.length) {
        return { monthNames: monthNames.slice(-6), values };
      }

      const now = new Date();
      const lastSix = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        lastSix.push({ monthIndex: d.getMonth(), label: monthNames[d.getMonth()] });
      }

      orders.forEach(order => {
        const created = order.createdAt ? new Date(order.createdAt) : new Date();
        const index = lastSix.findIndex(item => item.monthIndex === created.getMonth() && created.getFullYear() === now.getFullYear());
        if (index >= 0) {
          values[index] += 1;
        }
      });

      return { monthNames: lastSix.map(item => item.label), values };
    }

    function downloadOrderPdf(order) {
      if (!order) {
        alert('This order does not have a downloadable PDF yet.');
        return;
      }

      let pdfData = order.pdfData || '';

      if (!pdfData && window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFillColor(2, 6, 23);
        doc.rect(0, 0, 210, 38, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.text('INFININE SMART SOLUTIONS', 14, 20);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        let y = 52;
        const lines = [
          `Order ID: ${order.id || 'N/A'}`,
          `Customer: ${order.customer || 'N/A'}`,
          `Phone: ${order.phone || 'N/A'}`,
          `Service: ${order.service || 'N/A'}`,
          `Status: ${order.status || 'New'}`,
          `Date: ${order.createdAt || new Date().toISOString()}`,
          '',
          'Message:',
          order.message || 'No extra message provided.'
        ];
        lines.forEach(line => {
          doc.text(String(line), 14, y);
          y += 10;
        });
        pdfData = doc.output('datauristring');
      }

      if (!pdfData) {
        alert('This order does not have a PDF attached yet.');
        return;
      }

      const link = document.createElement('a');
      link.href = pdfData;
      link.download = `order-${(order.id || 'invoice')}.pdf`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    function renderDashboard() {
      const orders = getOrders();
      const totalOrders = orders.length;
      const newOrders = orders.filter(order => String(order.status).toLowerCase() === 'new').length;
      const pending = orders.filter(order => String(order.status).toLowerCase() === 'pending').length;
      const completed = orders.filter(order => String(order.status).toLowerCase() === 'completed').length;

      document.getElementById('newOrders').textContent = newOrders;
      document.getElementById('totalOrders').textContent = totalOrders;
      document.getElementById('pendingOrders').textContent = pending;
      document.getElementById('completedOrders').textContent = completed;
      document.getElementById('summaryNew').textContent = newOrders;
      document.getElementById('summaryPending').textContent = pending;
      document.getElementById('summaryCompleted').textContent = completed;

      const list = document.getElementById('orderList');
      if (!orders.length) {
        list.innerHTML = '<li class="empty">No orders have been received yet.</li>';
      } else {
        list.innerHTML = orders.slice(0, 8).map(order => {
          const customer = escapeHtml(order.customer || 'Customer');
          const service = escapeHtml(order.service || 'Service');
          const phone = escapeHtml(order.phone || 'Not provided');
          const message = escapeHtml((order.message || '').slice(0, 110));
          const created = new Date(order.createdAt || Date.now()).toLocaleString();
          const statusText = escapeHtml(order.status || 'New');
          const orderId = escapeHtml(order.id || '');

          return `
            <li class="list-item">
              <div class="order-main">
                <strong>${customer}</strong>
                <div class="meta">${service} • ${phone}</div>
                <div class="meta">${created}</div>
                ${message ? `<div class="meta message">${message}${(order.message || '').length > 110 ? '…' : ''}</div>` : ''}
              </div>
              <div class="order-actions">
                <span class="pill ${getStatusClass(order.status)}">${statusText}</span>
                <button class="pdf-btn" type="button" data-order-id="${orderId}">Download PDF</button>
              </div>
            </li>
          `;
        }).join('');

        document.querySelectorAll('.pdf-btn').forEach(button => {
          button.addEventListener('click', () => {
            const orderId = button.getAttribute('data-order-id');
            const matchingOrder = orders.find(item => String(item.id) === String(orderId));
            downloadOrderPdf(matchingOrder);
          });
        });
      }

      const salesChart = document.getElementById('salesChart');
      const { monthNames, values } = getLastSixMonthsChart(orders);
      const max = Math.max(...values, 1);

      salesChart.innerHTML = monthNames.map((month, index) => `
        <div class="bar-col">
          <div class="bar" style="height: ${(values[index] / max) * 100}%"></div>
          <div class="bar-label">${month}</div>
        </div>
      `).join('');
    }

    function logout() {
      localStorage.removeItem(SESSION_KEY);
      window.location.href = './admin.html';
    }

    document.getElementById('logoutBtn').addEventListener('click', logout);
    ensureAccess();
    renderDashboard();