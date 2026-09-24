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

    function formatCurrency(value) {
      return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(value || 0);
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
          values[index] += Number(order.amount) || 0;
        }
      });

      return { monthNames: lastSix.map(item => item.label), values };
    }

    function renderDashboard() {
      const orders = getOrders();
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.amount) || 0), 0);
      const pending = orders.filter(order => String(order.status).toLowerCase() === 'pending').length;
      const completed = orders.filter(order => String(order.status).toLowerCase() === 'completed').length;

      document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
      document.getElementById('totalOrders').textContent = totalOrders;
      document.getElementById('pendingOrders').textContent = pending;
      document.getElementById('completedOrders').textContent = completed;
      document.getElementById('summaryNew').textContent = orders.filter(order => String(order.status).toLowerCase() === 'new').length;
      document.getElementById('summaryPending').textContent = pending;
      document.getElementById('summaryCompleted').textContent = completed;

      const list = document.getElementById('orderList');
      if (!orders.length) {
        list.innerHTML = '<li class="empty">No orders have been received yet. The dashboard is currently in construction mode.</li>';
      } else {
        list.innerHTML = orders.slice(0, 6).map(order => `
          <li class="list-item">
            <div>
              <strong>${(order.customer || 'Customer').replace(/</g, '&lt;')}</strong>
              <div class="meta">${(order.service || 'Service').replace(/</g, '&lt;')} • ${new Date(order.createdAt || Date.now()).toLocaleString()}</div>
            </div>
            <div style="text-align:right;">
              <div class="meta">${formatCurrency(order.amount || 0)}</div>
              <span class="pill ${getStatusClass(order.status)}">${(order.status || 'New')}</span>
            </div>
          </li>
        `).join('');
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