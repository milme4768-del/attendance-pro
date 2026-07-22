(function () {
  'use strict';

  const user = Api.requireAuth('staff');
  if (!user) return;

  // ─── DOM refs ──────────────────────────────────────────────────────
  const headerUser = document.getElementById('header-user');
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  const statusSub = document.getElementById('status-sub');
  const liveClock = document.getElementById('live-clock');
  const liveDate = document.getElementById('live-date');
  const checkinBtn = document.getElementById('checkin-btn');
  const checkoutBtn = document.getElementById('checkout-btn');
  const locationStatus = document.getElementById('location-status');
  const checkinMsg = document.getElementById('checkin-msg');
  const historyList = document.getElementById('history-list');
  const historyCount = document.getElementById('history-count');
  const photoPreviewWrapper = document.getElementById('photo-preview-wrapper');
  const pageContainer = document.getElementById('page-container');
  const ptrIndicator = document.getElementById('ptr-indicator');

  let currentPosition = null;
  let pendingPhotoBlob = null;
  let pendingAction = null;
  let todayRecord = null;
  let ptrState = 'idle'; // idle | pulling | refreshing

  // ─── User info ─────────────────────────────────────────────────────
  headerUser.textContent = user.employeeId
    ? `Staff · ${user.employeeId}`
    : `Staff · ${user.name}`;

  // ─── Bottom Tab Navigation ─────────────────────────────────────────
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
      document.getElementById(`page-${tab.dataset.page}`).classList.add('active');
      document.getElementById('page-container').scrollTop = 0;
    });
  });

  document.getElementById('logout-btn').addEventListener('click', Api.logout);
  document.getElementById('desktop-logout')?.addEventListener('click', Api.logout);

  // Desktop sidebar navigation
  if (document.getElementById('desktop-user-name')) {
    document.getElementById('desktop-user-name').textContent = user.name;
    document.getElementById('desktop-user-role').textContent = user.employeeId ? `Staff · ${user.employeeId}` : 'Staff';
  }
  document.querySelectorAll('[data-desktop-page]').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('[data-desktop-page]').forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
      // Also update mobile nav
      document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
      document.querySelector(`.nav-tab[data-page="${item.dataset.desktopPage}"]`)?.classList.add('active');
      document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
      document.getElementById(`page-${item.dataset.desktopPage}`).classList.add('active');
      pageContainer.scrollTop = 0;
    });
  });

  // ─── Live Clock ────────────────────────────────────────────────────
  function updateClock() {
    const now = new Date();
    liveClock.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    liveDate.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ─── Geolocation ──────────────────────────────────────────────────
  function getLocation() {
    if (!navigator.geolocation) {
      locationStatus.className = 'checkin-location no';
      locationStatus.innerHTML = '<span>⚠️</span> GPS not supported';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentPosition = pos;
        locationStatus.className = 'checkin-location ok';
        locationStatus.innerHTML = `<span>📍</span> ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
      },
      () => {
        locationStatus.className = 'checkin-location no';
        locationStatus.innerHTML = '<span>⚠️</span> Enable GPS to check in';
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
  getLocation();

  // ─── Load Today ────────────────────────────────────────────────────
  async function loadToday() {
    try {
      const data = await Api.request('/attendance/today');
      todayRecord = data.record;
      updateUI(todayRecord);
    } catch (err) {
      statusText.textContent = 'Error loading status';
      statusSub.textContent = err.message;
      checkinBtn.style.display = 'block';
      checkinBtn.textContent = '✅ Check In';
      checkoutBtn.style.display = 'none';
    }
  }

  function updateUI(record) {
    if (!record) {
      statusIcon.textContent = '⏳';
      statusText.textContent = 'Not Checked In';
      statusSub.textContent = 'Start your shift!';
      checkinBtn.style.display = 'block';
      checkinBtn.textContent = '✅ Check In';
      checkoutBtn.style.display = 'none';
    } else if (record.status === 'checked-in') {
      statusIcon.textContent = '🟡';
      statusText.textContent = 'Checked In';
      const time = new Date(record.checkIn.time).toLocaleTimeString('en-US', { hour12: false });
      statusSub.textContent = `Since ${time}`;
      checkinBtn.style.display = 'none';
      checkoutBtn.style.display = 'block';
      checkoutBtn.textContent = '🚪 Check Out';
    } else if (record.status === 'completed') {
      statusIcon.textContent = '✅';
      statusText.textContent = 'Shift Complete';
      const ci = new Date(record.checkIn.time).toLocaleTimeString('en-US', { hour12: false });
      const co = new Date(record.checkOut.time).toLocaleTimeString('en-US', { hour12: false });
      statusSub.textContent = `${ci} → ${co}`;
      checkinBtn.style.display = 'none';
      checkoutBtn.style.display = 'none';
    }
  }

  // ─── Pull-to-Refresh ───────────────────────────────────────────────
  let startY = 0;
  let pulling = false;

  pageContainer.addEventListener('touchstart', (e) => {
    if (pageContainer.scrollTop === 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  pageContainer.addEventListener('touchmove', (e) => {
    if (!pulling || ptrState === 'refreshing') return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 0) {
      ptrIndicator.textContent = diff > 60 ? '🔄 Release to refresh' : '↓ Pull to refresh';
      ptrIndicator.style.opacity = Math.min(diff / 80, 1);
      ptrIndicator.style.height = Math.min(diff * 0.5, 80) + 'px';
      ptrIndicator.style.overflow = 'visible';
      if (diff > 60) ptrState = 'pulling';
    }
  }, { passive: true });

  pageContainer.addEventListener('touchend', async () => {
    if (ptrState === 'pulling') {
      ptrState = 'refreshing';
      ptrIndicator.innerHTML = '<div class="ptr-spinner"></div><span>Refreshing...</span>';
      ptrIndicator.style.opacity = 1;
      ptrIndicator.style.height = '48px';
      await Promise.all([loadToday(), loadHistory()]);
      ptrState = 'idle';
      ptrIndicator.innerHTML = '<div class="ptr-spinner"></div><span>Pull to refresh</span>';
    }
    ptrIndicator.style.height = '0';
    ptrIndicator.style.overflow = 'hidden';
    ptrIndicator.style.opacity = '0';
    pulling = false;
  }, { passive: true });

  // ─── Camera & Photo Preview ────────────────────────────────────────
  async function capturePhoto() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
      stream.getTracks().forEach((t) => t.stop());
      return blob;
    } catch {
      return null;
    }
  }

  function showPhotoPreview(blob, action) {
    pendingPhotoBlob = blob;
    pendingAction = action;
    const url = URL.createObjectURL(blob);
    photoPreviewWrapper.style.display = 'block';
    photoPreviewWrapper.innerHTML = `
      <div class="photo-preview-card">
        <img src="${url}" alt="Preview" />
        <div style="display:flex;gap:8px;">
          <button class="btn btn-success btn-sm" id="confirm-photo" style="flex:1;">✅ Confirm</button>
          <button class="btn btn-outline btn-sm" id="retake-photo" style="flex:1;">🔄 Retake</button>
        </div>
      </div>`;
    checkinBtn.style.display = 'none';
    checkoutBtn.style.display = 'none';

    document.getElementById('confirm-photo').addEventListener('click', submitAttendance);
    document.getElementById('retake-photo').addEventListener('click', async () => {
      const blob = await capturePhoto();
      if (blob) {
        URL.revokeObjectURL(url);
        showPhotoPreview(blob, action);
      } else {
        Api.toast('Camera access required', 'error');
        hidePhotoPreview();
      }
    });
  }

  function hidePhotoPreview() {
    if (photoPreviewWrapper.querySelector('img')) {
      URL.revokeObjectURL(photoPreviewWrapper.querySelector('img').src);
    }
    photoPreviewWrapper.style.display = 'none';
    photoPreviewWrapper.innerHTML = '';
    pendingPhotoBlob = null;
    pendingAction = null;
    updateUI(todayRecord);
  }

  async function submitAttendance() {
    if (!currentPosition) {
      Api.toast('Enable GPS to proceed', 'warning');
      getLocation();
      return;
    }

    const action = pendingAction;
    const endpoint = action === 'checkin' ? '/attendance/checkin' : '/attendance/checkout';
    const successMsg = action === 'checkin' ? '✅ Checked in!' : '✅ Checked out!';

    const btn = action === 'checkin' ? checkinBtn : checkoutBtn;
    btn.disabled = true;
    btn.textContent = '⏳ Processing...';

    try {
      const formData = new FormData();
      formData.append('image', pendingPhotoBlob, `${action}.jpg`);
      formData.append('latitude', currentPosition.coords.latitude);
      formData.append('longitude', currentPosition.coords.longitude);
      formData.append('accuracy', currentPosition.coords.accuracy || 0);

      await Api.request(endpoint, { method: 'POST', body: formData, isForm: true });
      Api.toast(successMsg, 'success');
      hidePhotoPreview();
      await Promise.all([loadToday(), loadHistory()]);
    } catch (err) {
      Api.toast(err.message, 'error');
      hidePhotoPreview();
    } finally {
      btn.disabled = false;
    }
  }

  // ─── Check In / Out ────────────────────────────────────────────────
  checkinBtn.addEventListener('click', async () => {
    if (!currentPosition) { getLocation(); Api.toast('Enable GPS to check in', 'warning'); return; }
    if (navigator.vibrate) navigator.vibrate(10);
    const blob = await capturePhoto();
    if (!blob) { Api.toast('Camera access required', 'error'); return; }
    showPhotoPreview(blob, 'checkin');
  });

  checkoutBtn.addEventListener('click', async () => {
    if (!currentPosition) { getLocation(); Api.toast('Enable GPS to check out', 'warning'); return; }
    if (navigator.vibrate) navigator.vibrate(10);
    const blob = await capturePhoto();
    if (!blob) { Api.toast('Camera access required', 'error'); return; }
    showPhotoPreview(blob, 'checkout');
  });

  // ─── Load History ─────────────────────────────────────────────────
  async function loadHistory() {
    try {
      const data = await Api.request('/attendance/history');
      renderHistory(data.records || []);
    } catch (err) {
      historyList.innerHTML = `<div class="empty-state"><h3>Could not load history</h3><p>${err.message}</p></div>`;
    }
  }

  function renderHistory(records) {
    historyCount.textContent = records.length;
    if (records.length === 0) {
      historyList.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No records yet</h3></div>`;
      return;
    }
    historyList.innerHTML = records.map((r) => {
      const date = new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      });
      const ci = r.checkIn ? new Date(r.checkIn.time).toLocaleTimeString('en-US', { hour12: false }) : '—';
      const co = r.checkOut ? new Date(r.checkOut.time).toLocaleTimeString('en-US', { hour12: false }) : '—';
      let duration = '—';
      if (r.checkIn && r.checkOut) {
        const diff = new Date(r.checkOut.time) - new Date(r.checkIn.time);
        duration = `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
      }
      const cls = r.status === 'completed' ? 'done' : 'on';
      return `<div class="history-item">
        <div>
          <div class="h-date">${date}</div>
          <div class="h-time">${ci} → ${co}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="h-dur">${duration}</div>
          <span class="h-dot ${cls}"></span>
        </div>
      </div>`;
    }).join('');
  }

  // ─── Init ──────────────────────────────────────────────────────────
  loadToday();
  loadHistory();
})();
