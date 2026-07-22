(function () {
  'use strict';

  const existing = Api.getUser();
  if (existing && Api.getToken()) {
    window.location.href = existing.role === 'admin' ? '/admin-dashboard.html' : '/user-dashboard.html';
    return;
  }

  if (!document.getElementById('toast-container')) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const form = document.getElementById('login-form');
  const msg = document.getElementById('msg');
  const btn = document.getElementById('login-btn');
  const btnText = btn.querySelector('.btn-text');
  const btnSpinner = btn.querySelector('.spinner');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.innerHTML = '';

    btn.disabled = true;
    btnText.textContent = 'Signing in…';
    btnSpinner.style.display = 'inline-block';

    try {
      const data = await Api.request('/auth/login', {
        method: 'POST',
        body: { email: emailInput.value.trim(), password: passwordInput.value },
      });

      Api.setSession(data.token, data.user);
      Api.toast(`Welcome back, ${data.user.name}!`, 'success');

      setTimeout(() => {
        window.location.href = data.user.role === 'admin' ? '/admin-dashboard.html' : '/user-dashboard.html';
      }, 500);
    } catch (err) {
      msg.innerHTML = `<div class="msg error">${err.message}</div>`;
      btn.disabled = false;
      btnText.textContent = 'Sign In';
      btnSpinner.style.display = 'none';
    }
  });
})();
