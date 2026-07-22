const Api = {
  base: '/api',

  getToken() { return localStorage.getItem('token'); },

  getUser() {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  setSession(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  logout() {
    Api.clearSession();
    window.location.href = '/login.html';
  },

  requireAuth(role) {
    const token = Api.getToken();
    const user = Api.getUser();
    if (!token || !user) {
      Api.clearSession();
      window.location.href = '/login.html';
      return null;
    }
    if (role && user.role !== role) {
      window.location.href = user.role === 'admin' ? '/admin-dashboard.html' : '/user-dashboard.html';
      return null;
    }
    return user;
  },

  async request(path, { method = 'GET', body, isForm = false } = {}) {
    const headers = {};
    const token = Api.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isForm && body) headers['Content-Type'] = 'application/json';

    const res = await fetch(Api.base + path, { method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined });

    let data = null;
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) {
      const message = (data && data.message) || `Request failed (${res.status})`;
      if (res.status === 401) {
        const user = Api.getUser();
        if (user) { Api.clearSession(); window.location.href = '/login.html'; }
      }
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  toast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="t-icon">${icons[type] || 'ℹ️'}</span><span class="t-msg">${message}</span><button class="t-close">&times;</button>`;

    toast.querySelector('.t-close').onclick = () => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    };

    container.appendChild(toast);
    setTimeout(() => {
      if (toast.isConnected) {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  },
};
