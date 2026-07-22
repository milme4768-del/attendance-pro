(function () {
  'use strict';

  const user = Api.requireAuth('admin');
  if (!user) return;

  // ─── DOM refs ──────────────────────────────────────────────────────
  const adminName = document.getElementById('admin-name');
  const adminRole = document.getElementById('admin-role');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  // Overview
  const statTotal = document.getElementById('stat-total');
  const statCheckedIn = document.getElementById('stat-checked-in');
  const statActive = document.getElementById('stat-active');
  const statTotalRecords = document.getElementById('stat-total-records');

  // Users
  const usersTbody = document.getElementById('users-tbody');
  const usersEmpty = document.getElementById('users-empty');
  const userSearch = document.getElementById('user-search');

  // Logs
  const logsTbody = document.getElementById('logs-tbody');
  const logsEmpty = document.getElementById('logs-empty');
  const logDate = document.getElementById('log-date');
  const logUserFilter = document.getElementById('log-user-filter');

  // Reports
  const reportMonth = document.getElementById('report-month');
  const reportYear = document.getElementById('report-year');
  const reportMsg = document.getElementById('report-msg');

  // Modal
  const userModal = document.getElementById('user-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalClose = document.getElementById('modal-close');
  const userForm = document.getElementById('user-form');
  const formName = document.getElementById('form-name');
  const formEmail = document.getElementById('form-email');
  const formPassword = document.getElementById('form-password');
  const formEmployeeId = document.getElementById('form-employee-id');
  const formDepartment = document.getElementById('form-department');
  const formRole = document.getElementById('form-role');
  const formSubmit = document.getElementById('form-submit');
  const formMsg = document.getElementById('form-msg');
  const editUserId = document.getElementById('edit-user-id');

  let editingUserId = null;
  let allUsers = [];
  let allLogs = [];

  // ─── User info ─────────────────────────────────────────────────────
  adminName.textContent = user.name || 'Admin';
  adminRole.textContent = 'Admin';

  // ─── Sidebar / Tabs ────────────────────────────────────────────────
  document.getElementById('hamburger').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });

  document.querySelectorAll('.nav-item[data-tab]').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item[data-tab]').forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
      document.getElementById(`tab-${item.dataset.tab}`).classList.add('active');
      sidebar.classList.remove('open');
      overlay.classList.remove('open');

      // Refresh data when switching tabs
      if (item.dataset.tab === 'logs') loadLogs();
      if (item.dataset.tab === 'users') loadUsers();
      if (item.dataset.tab === 'overview') loadOverview();
    });
  });

  document.getElementById('logout-btn').addEventListener('click', Api.logout);

  // ─── Overview ──────────────────────────────────────────────────────
  async function loadOverview() {
    try {
      const [usersData, logsData] = await Promise.all([
        Api.request('/admin/users'),
        Api.request('/admin/logs'),
      ]);

      const users = usersData.users || [];
      const logs = logsData.logs || [];

      statTotal.textContent = users.length;

      const today = new Date().toISOString().slice(0, 10);
      const todayLogs = logs.filter((l) => l.date === today);
      const checkedIn = todayLogs.filter((l) => l.status === 'checked-in');
      const completed = todayLogs.filter((l) => l.status === 'completed');

      statCheckedIn.textContent = checkedIn.length;
      statActive.textContent = todayLogs.length;
      statTotalRecords.textContent = logs.length;
    } catch (err) {
      Api.toast('Failed to load overview: ' + err.message, 'error');
    }
  }

  document.getElementById('refresh-overview').addEventListener('click', loadOverview);

  // ─── Users ─────────────────────────────────────────────────────────
  async function loadUsers() {
    try {
      const data = await Api.request('/admin/users');
      allUsers = data.users || [];
      renderUsers();
    } catch (err) {
      Api.toast('Failed to load users: ' + err.message, 'error');
    }
  }

  function renderUsers() {
    const query = userSearch.value.toLowerCase().trim();
    const filtered = query
      ? allUsers.filter((u) => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
      : allUsers;

    if (filtered.length === 0) {
      usersTbody.innerHTML = '';
      usersEmpty.style.display = 'block';
      return;
    }

    usersEmpty.style.display = 'none';
    usersTbody.innerHTML = filtered.map((u) => `
      <tr>
        <td><strong>${escHtml(u.name)}</strong></td>
        <td>${escHtml(u.email)}</td>
        <td>${escHtml(u.employeeId || '—')}</td>
        <td>${escHtml(u.department || '—')}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-warning' : ''}">${u.role}</span></td>
        <td>
          <span class="table-status ${u.isActive ? 'present' : 'absent'}">
            ${u.isActive ? '● Active' : '○ Disabled'}
          </span>
        </td>
        <td style="white-space:nowrap;">
          <button class="btn btn-outline btn-sm edit-user" data-id="${u._id}" title="Edit" style="margin-right:4px;">✏️</button>
          <button class="btn btn-outline btn-sm toggle-user" data-id="${u._id}" data-active="${u.isActive}" title="${u.isActive ? 'Disable' : 'Enable'}" style="margin-right:4px;">
            ${u.isActive ? '🔒' : '🔓'}
          </button>
          <button class="btn btn-outline btn-sm delete-user" data-id="${u._id}" data-name="${escHtml(u.name)}" title="Delete" style="color:var(--danger);">🗑️</button>
        </td>
      </tr>
    `).join('');

    // Edit handlers
    document.querySelectorAll('.edit-user').forEach((btn) => {
      btn.addEventListener('click', () => openEditUser(btn.dataset.id));
    });
    // Toggle active
    document.querySelectorAll('.toggle-user').forEach((btn) => {
      btn.addEventListener('click', () => toggleUser(btn.dataset.id, btn.dataset.active === 'true'));
    });
    // Delete handlers
    document.querySelectorAll('.delete-user').forEach((btn) => {
      btn.addEventListener('click', () => deleteUser(btn.dataset.id, btn.dataset.name));
    });
  }

  userSearch.addEventListener('input', renderUsers);

  async function toggleUser(id, isActive) {
    try {
      await Api.request(`/admin/users/${id}`, {
        method: 'PATCH',
        body: { isActive: !isActive },
      });
      Api.toast(`User ${isActive ? 'disabled' : 'enabled'} successfully`, 'success');
      await loadUsers();
    } catch (err) {
      Api.toast(err.message, 'error');
    }
  }

  async function deleteUser(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
    try {
      await Api.request(`/admin/users/${id}`, { method: 'DELETE' });
      Api.toast(`User "${name}" deleted`, 'success');
      await loadUsers();
    } catch (err) {
      Api.toast(err.message, 'error');
    }
  }

  // ─── User Modal ────────────────────────────────────────────────────
  document.getElementById('add-user-btn').addEventListener('click', () => openAddUser());
  modalClose.addEventListener('click', () => closeModal());
  userModal.addEventListener('click', (e) => {
    if (e.target === userModal) closeModal();
  });

  function openAddUser() {
    editingUserId = null;
    modalTitle.textContent = 'Add New User';
    formSubmit.textContent = 'Create User';
    userForm.reset();
    formPassword.required = true;
    formPassword.placeholder = 'Enter password';
    formMsg.innerHTML = '';
    userModal.classList.add('open');
  }

  function openEditUser(id) {
    const u = allUsers.find((u) => u._id === id);
    if (!u) return;
    editingUserId = id;
    modalTitle.textContent = 'Edit User';
    formSubmit.textContent = 'Save Changes';
    formName.value = u.name;
    formEmail.value = u.email;
    formPassword.value = '';
    formPassword.required = false;
    formPassword.placeholder = 'Leave blank to keep current';
    formEmployeeId.value = u.employeeId || '';
    formDepartment.value = u.department || '';
    formRole.value = u.role || 'staff';
    formMsg.innerHTML = '';
    userModal.classList.add('open');
  }

  function closeModal() {
    userModal.classList.remove('open');
  }

  userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formMsg.innerHTML = '';
    formSubmit.disabled = true;
    formSubmit.textContent = 'Saving...';

    try {
      const body = {
        name: formName.value.trim(),
        email: formEmail.value.trim(),
        employeeId: formEmployeeId.value.trim(),
        department: formDepartment.value.trim(),
        role: formRole.value,
      };

      if (formPassword.value) body.password = formPassword.value;

      if (editingUserId) {
        await Api.request(`/admin/users/${editingUserId}`, { method: 'PATCH', body });
        Api.toast('User updated!', 'success');
      } else {
        await Api.request('/admin/users', { method: 'POST', body });
        Api.toast('User created!', 'success');
      }

      closeModal();
      await loadUsers();
    } catch (err) {
      formMsg.innerHTML = `<div class="error-msg">${err.message}</div>`;
    } finally {
      formSubmit.disabled = false;
      formSubmit.textContent = editingUserId ? 'Save Changes' : 'Create User';
    }
  });

  // ─── Logs ──────────────────────────────────────────────────────────
  async function loadLogs() {
    try {
      const params = new URLSearchParams();
      if (logDate.value) params.set('date', logDate.value);

      const url = '/admin/logs' + (params.toString() ? '?' + params.toString() : '');
      const data = await Api.request(url);
      allLogs = data.logs || [];

      // Populate user filter dropdown
      renderLogUserFilter(allLogs);
      renderLogs();
    } catch (err) {
      Api.toast('Failed to load logs: ' + err.message, 'error');
    }
  }

  function renderLogUserFilter(logs) {
    const currentVal = logUserFilter.value;
    const users = {};
    logs.forEach((l) => {
      if (l.user && l.user._id) {
        users[l.user._id] = l.user.name || 'Unknown';
      }
    });

    logUserFilter.innerHTML = '<option value="">All Users</option>' +
      Object.entries(users).map(([id, name]) =>
        `<option value="${id}" ${id === currentVal ? 'selected' : ''}>${escHtml(name)}</option>`
      ).join('');
  }

  function renderLogs() {
    const filterUser = logUserFilter.value;
    const filtered = filterUser
      ? allLogs.filter((l) => l.user && l.user._id === filterUser)
      : allLogs;

    if (filtered.length === 0) {
      logsTbody.innerHTML = '';
      logsEmpty.style.display = 'block';
      return;
    }

    logsEmpty.style.display = 'none';
    logsTbody.innerHTML = filtered.map((l) => {
      const staffName = l.user ? escHtml(l.user.name || '—') : '—';
      const staffEmail = l.user ? escHtml(l.user.email || '') : '';
      const ci = l.checkIn ? new Date(l.checkIn.time).toLocaleTimeString('en-US', { hour12: false }) : '—';
      const co = l.checkOut ? new Date(l.checkOut.time).toLocaleTimeString('en-US', { hour12: false }) : '—';

      let duration = '—';
      if (l.checkIn && l.checkOut) {
        const diff = new Date(l.checkOut.time) - new Date(l.checkIn.time);
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        duration = `${hrs}h ${mins}m`;
      }

      const statusClass = l.status === 'completed' ? 'present' : l.status === 'checked-in' ? 'late' : 'absent';
      const statusLabel = l.status === 'completed' ? 'Completed' : l.status === 'checked-in' ? 'Active' : l.status;

      return `<tr>
        <td>${l.date || '—'}</td>
        <td><strong>${staffName}</strong>${staffEmail ? `<br/><span style="font-size:12px;color:var(--text-muted)">${staffEmail}</span>` : ''}</td>
        <td>${ci}</td>
        <td>${co}</td>
        <td>${duration}</td>
        <td><span class="table-status ${statusClass}">${statusLabel}</span></td>
      </tr>`;
    }).join('');
  }

  logDate.addEventListener('change', loadLogs);
  logUserFilter.addEventListener('change', renderLogs);
  document.getElementById('refresh-logs').addEventListener('click', loadLogs);

  // ─── Reports ───────────────────────────────────────────────────────
  function initReportSelects() {
    const now = new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    months.forEach((m, i) => {
      const opt = document.createElement('option');
      opt.value = i + 1;
      opt.textContent = m;
      if (i === now.getMonth()) opt.selected = true;
      reportMonth.appendChild(opt);
    });
    for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      if (y === now.getFullYear()) opt.selected = true;
      reportYear.appendChild(opt);
    }
  }
  initReportSelects();

  document.getElementById('download-report').addEventListener('click', async () => {
    reportMsg.innerHTML = '';
    const month = reportMonth.value;
    const year = reportYear.value;

    if (!month || !year) {
      reportMsg.innerHTML = '<div class="error-msg">Please select both month and year</div>';
      return;
    }

    try {
      const url = `/api/admin/reports/monthly?month=${month}&year=${year}`;
      const token = Api.getToken();

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Download failed');
      }

      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `attendance-report-${year}-${String(month).padStart(2, '0')}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      reportMsg.innerHTML = '<div class="success-msg">✅ Report downloaded!</div>';
    } catch (err) {
      reportMsg.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });

  // ─── Helpers ───────────────────────────────────────────────────────
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Init ──────────────────────────────────────────────────────────
  loadOverview();

  // Pre-set today's date in log filter
  logDate.value = new Date().toISOString().slice(0, 10);
})();
