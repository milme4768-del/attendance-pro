(function () {
  'use strict';

  const user = Api.requireAuth('admin');
  if (!user) return;

  // ─── DOM refs ──────────────────────────────────────────────────────
  const headerUser = document.getElementById('header-user');
  const pageContainer = document.getElementById('page-container');
  const ptrIndicator = document.getElementById('ptr-indicator');

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

  // Sheet Modal
  const sheetOverlay = document.getElementById('sheet-overlay');
  const userSheet = document.getElementById('user-sheet');
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

  // Desktop sidebar
  const adminName = document.getElementById('admin-name');
  const adminRole = document.getElementById('admin-role');

  let editingUserId = null;
  let allUsers = [];
  let allLogs = [];
  let ptrState = 'idle';
  let startY = 0;
  let pulling = false;

  // ─── Header ────────────────────────────────────────────────────────
  headerUser.textContent = `Admin · ${user.name}`;
  if (adminName) adminName.textContent = user.name;
  if (adminRole) adminRole.textContent = 'Admin';

  // ─── Tab Navigation (Mobile + Desktop) ─────────────────────────────
  function switchPage(pageId) {
    // Update mobile tabs
    document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
    document.querySelector(`.nav-tab[data-page="${pageId}"]`)?.classList.add('active');
    // Update desktop sidebar
    document.querySelectorAll('[data-desktop-page]').forEach((n) => n.classList.remove('active'));
    document.querySelector(`[data-desktop-page="${pageId}"]`)?.classList.add('active');
    // Show page
    document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
    pageContainer.scrollTop = 0;

    // Refresh data
    if (pageId === 'logs') loadLogs();
    if (pageId === 'users') loadUsers();
    if (pageId === 'overview') loadOverview();
  }

  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchPage(tab.dataset.page));
  });
  document.querySelectorAll('[data-desktop-page]').forEach((item) => {
    item.addEventListener('click', () => switchPage(item.dataset.desktopPage));
  });

  document.getElementById('logout-btn').addEventListener('click', Api.logout);
  document.getElementById('desktop-logout')?.addEventListener('click', Api.logout);

  // ─── Pull-to-Refresh ───────────────────────────────────────────────
  pageContainer.addEventListener('touchstart', (e) => {
    if (pageContainer.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; }
  }, { passive: true });

  pageContainer.addEventListener('touchmove', (e) => {
    if (!pulling || ptrState === 'refreshing') return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 0) {
      ptrState = diff > 60 ? 'pulling' : 'idle';
      ptrIndicator.textContent = diff > 60 ? '🔄 Release to refresh' : '↓ Pull to refresh';
      ptrIndicator.style.opacity = Math.min(diff / 80, 1);
      ptrIndicator.style.height = Math.min(diff * 0.5, 80) + 'px';
      ptrIndicator.style.overflow = 'visible';
    }
  }, { passive: true });

  pageContainer.addEventListener('touchend', async () => {
    if (ptrState === 'pulling') {
      ptrState = 'refreshing';
      ptrIndicator.innerHTML = '<div class="ptr-spinner"></div><span>Refreshing...</span>';
      ptrIndicator.style.opacity = 1;
      ptrIndicator.style.height = '48px';
      const activePage = document.querySelector('.page.active');
      const id = activePage ? activePage.id.replace('page-', '') : 'overview';
      if (id === 'overview') await loadOverview();
      else if (id === 'users') await loadUsers();
      else if (id === 'logs') await loadLogs();
      ptrState = 'idle';
      ptrIndicator.innerHTML = '<div class="ptr-spinner"></div><span>Pull to refresh</span>';
    }
    ptrIndicator.style.height = '0';
    ptrIndicator.style.overflow = 'hidden';
    ptrIndicator.style.opacity = '0';
    pulling = false;
  }, { passive: true });

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
      statCheckedIn.textContent = todayLogs.filter((l) => l.status === 'checked-in').length;
      statActive.textContent = todayLogs.length;
      statTotalRecords.textContent = logs.length;
    } catch (err) {
      Api.toast('Failed to load overview', 'error');
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
      Api.toast('Failed to load users', 'error');
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
        <td>
          <strong>${escHtml(u.name)}</strong>
          <br/><span style="font-size:11px;color:var(--text-muted)">${escHtml(u.email)}</span>
        </td>
        <td>
          <span class="badge-status ${u.isActive ? 'active' : 'off'}">
            ${u.isActive ? '● Active' : '○ Off'}
          </span>
        </td>
        <td>
          <button class="btn btn-outline btn-sm edit-user" data-id="${u._id}" title="Edit" style="margin-right:4px;">✏️</button>
          <button class="btn btn-outline btn-sm toggle-user" data-id="${u._id}" data-active="${u.isActive}" title="${u.isActive ? 'Disable' : 'Enable'}" style="margin-right:4px;">
            ${u.isActive ? '🔒' : '🔓'}
          </button>
          <button class="btn btn-outline btn-sm delete-user" data-id="${u._id}" data-name="${escHtml(u.name)}" title="Delete" style="color:var(--danger);">🗑️</button>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.edit-user').forEach((b) => b.addEventListener('click', () => openEditUser(b.dataset.id)));
    document.querySelectorAll('.toggle-user').forEach((b) => b.addEventListener('click', () => toggleUser(b.dataset.id, b.dataset.active === 'true')));
    document.querySelectorAll('.delete-user').forEach((b) => b.addEventListener('click', () => deleteUser(b.dataset.id, b.dataset.name)));
  }

  userSearch.addEventListener('input', renderUsers);

  async function toggleUser(id, isActive) {
    try {
      await Api.request(`/admin/users/${id}`, { method: 'PATCH', body: { isActive: !isActive } });
      Api.toast(`User ${isActive ? 'disabled' : 'enabled'}`, 'success');
      await loadUsers();
    } catch (err) { Api.toast(err.message, 'error'); }
  }

  async function deleteUser(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await Api.request(`/admin/users/${id}`, { method: 'DELETE' });
      Api.toast(`"${name}" deleted`, 'success');
      await loadUsers();
    } catch (err) { Api.toast(err.message, 'error'); }
  }

  // ─── Bottom Sheet ──────────────────────────────────────────────────
  function openSheet() {
    sheetOverlay.classList.add('open');
    userSheet.classList.add('open');
  }

  function closeSheet() {
    sheetOverlay.classList.remove('open');
    userSheet.classList.remove('open');
  }

  document.getElementById('add-user-btn').addEventListener('click', () => {
    editingUserId = null;
    modalTitle.textContent = 'Add User';
    formSubmit.textContent = 'Create User';
    userForm.reset();
    formPassword.required = true;
    formPassword.placeholder = 'Enter password';
    formMsg.innerHTML = '';
    openSheet();
  });

  modalClose.addEventListener('click', closeSheet);
  sheetOverlay.addEventListener('click', closeSheet);

  function openEditUser(id) {
    const u = allUsers.find((u) => u._id === id);
    if (!u) return;
    editingUserId = id;
    modalTitle.textContent = 'Edit User';
    formSubmit.textContent = 'Save';
    formName.value = u.name;
    formEmail.value = u.email;
    formPassword.value = '';
    formPassword.required = false;
    formPassword.placeholder = 'Leave blank to keep';
    formEmployeeId.value = u.employeeId || '';
    formDepartment.value = u.department || '';
    formRole.value = u.role || 'staff';
    formMsg.innerHTML = '';
    openSheet();
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
      closeSheet();
      await loadUsers();
    } catch (err) {
      formMsg.innerHTML = `<div class="msg error">${err.message}</div>`;
    } finally {
      formSubmit.disabled = false;
      formSubmit.textContent = editingUserId ? 'Save' : 'Create User';
    }
  });

  // ─── Logs ──────────────────────────────────────────────────────────
  async function loadLogs() {
    try {
      const params = new URLSearchParams();
      if (logDate.value) params.set('date', logDate.value);
      const data = await Api.request('/admin/logs' + (params.toString() ? '?' + params.toString() : ''));
      allLogs = data.logs || [];
      renderLogFilter();
      renderLogs();
    } catch (err) { Api.toast('Failed to load logs', 'error'); }
  }

  function renderLogFilter() {
    const val = logUserFilter.value;
    const users = {};
    allLogs.forEach((l) => { if (l.user && l.user._id) users[l.user._id] = l.user.name; });
    logUserFilter.innerHTML = '<option value="">All</option>' +
      Object.entries(users).map(([id, n]) => `<option value="${id}" ${id === val ? 'selected' : ''}>${escHtml(n)}</option>`).join('');
  }

  function renderLogs() {
    const filtered = logUserFilter.value ? allLogs.filter((l) => l.user && l.user._id === logUserFilter.value) : allLogs;
    if (filtered.length === 0) { logsTbody.innerHTML = ''; logsEmpty.style.display = 'block'; return; }
    logsEmpty.style.display = 'none';
    logsTbody.innerHTML = filtered.map((l) => {
      const name = l.user ? escHtml(l.user.name || '—') : '—';
      const ci = l.checkIn ? new Date(l.checkIn.time).toLocaleTimeString('en-US', { hour12: false }) : '—';
      const co = l.checkOut ? new Date(l.checkOut.time).toLocaleTimeString('en-US', { hour12: false }) : '—';
      let dur = '—';
      if (l.checkIn && l.checkOut) {
        const d = new Date(l.checkOut.time) - new Date(l.checkIn.time);
        dur = `${Math.floor(d / 3600000)}h ${Math.floor((d % 3600000) / 60000)}m`;
      }
      const cls = l.status === 'completed' ? 'done' : l.status === 'checked-in' ? 'idle' : 'off';
      return `<tr>
        <td><strong>${name}</strong><br/><span style="font-size:11px;color:var(--text-muted)">${l.date || ''}</span></td>
        <td>${ci}→${co}<br/><span style="font-size:11px;color:var(--primary)">${dur}</span></td>
        <td><span class="badge-status ${cls}">${l.status === 'completed' ? 'Done' : l.status === 'checked-in' ? 'Active' : l.status}</span></td>
      </tr>`;
    }).join('');
  }

  logDate.addEventListener('change', loadLogs);
  logUserFilter.addEventListener('change', renderLogs);
  document.getElementById('refresh-logs').addEventListener('click', loadLogs);

  // ─── Reports ───────────────────────────────────────────────────────
  (function initReports() {
    const now = new Date();
    const months = 'January February March April May June July August September October November December'.split(' ');
    months.forEach((m, i) => {
      const opt = document.createElement('option');
      opt.value = i + 1; opt.textContent = m;
      if (i === now.getMonth()) opt.selected = true;
      reportMonth.appendChild(opt);
    });
    for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      if (y === now.getFullYear()) opt.selected = true;
      reportYear.appendChild(opt);
    }
  })();

  document.getElementById('download-report').addEventListener('click', async () => {
    reportMsg.innerHTML = '';
    const month = reportMonth.value;
    const year = reportYear.value;
    if (!month || !year) { reportMsg.innerHTML = '<div class="msg error">Select month and year</div>'; return; }
    try {
      const token = Api.getToken();
      const res = await fetch(`/api/admin/reports/monthly?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || 'Failed'); }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `attendance-${year}-${String(month).padStart(2, '0')}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      reportMsg.innerHTML = '<div class="msg success">✅ Downloaded!</div>';
    } catch (err) { reportMsg.innerHTML = `<div class="msg error">${err.message}</div>`; }
  });

  // ─── Helpers ───────────────────────────────────────────────────────
  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Init ──────────────────────────────────────────────────────────
  loadOverview();
  logDate.value = new Date().toISOString().slice(0, 10);
})();
