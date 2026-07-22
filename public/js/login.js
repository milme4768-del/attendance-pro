(function () {
  'use strict';

  // Already logged in? Redirect straight to dashboard
  const existing = Api.getUser();
  if (existing && Api.getToken()) {
    window.location.href = existing.role === 'admin' ? '/admin-dashboard.html' : '/user-dashboard.html';
    return;
  }

  // Ensure toast container exists
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

  // ─── Real-time field validation ───────────────────────────────────
  function validateField(input) {
    const group = input.closest('.input-group');
    if (!group) return true;

    if (input === emailInput) {
      const val = input.value.trim();
      if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        group.classList.add('error');
        group.querySelector('.error-text').textContent = 'Please enter a valid email';
        return false;
      }
      group.classList.remove('error');
      return true;
    }

    if (input === passwordInput) {
      if (input.value && input.value.length < 4) {
        group.classList.add('error');
        group.querySelector('.error-text').textContent = 'Password must be at least 4 characters';
        return false;
      }
      group.classList.remove('error');
      return true;
    }

    return true;
  }

  emailInput.addEventListener('blur', () => validateField(emailInput));
  emailInput.addEventListener('input', () => {
    if (emailInput.value.trim()) validateField(emailInput);
  });
  passwordInput.addEventListener('blur', () => validateField(passwordInput));
  passwordInput.addEventListener('input', () => {
    if (passwordInput.value) validateField(passwordInput);
  });

  // ─── Login Submit ─────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.innerHTML = '';

    // Validate all fields
    const validEmail = validateField(emailInput);
    const validPass = validateField(passwordInput);
    if (!validEmail || !validPass) return;

    // Show loading
    btn.disabled = true;
    btnText.textContent = 'Signing in…';
    btnSpinner.style.display = 'inline-block';

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    try {
      const data = await Api.request('/auth/login', {
        method: 'POST',
        body: { email, password },
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
