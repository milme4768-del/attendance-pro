(function () {
  'use strict';

  const user = Api.requireAuth('staff');
  if (!user) return;

  // ─── DOM refs ──────────────────────────────────────────────────────
  const userName = document.getElementById('user-name');
  const userRole = document.getElementById('user-role');
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
  const photoPreview = document.getElementById('photo-preview');
  const photoPreviewImg = document.getElementById('photo-preview-img');
  const confirmPhoto = document.getElementById('confirm-photo');
  const retakePhoto = document.getElementById('retake-photo');

  let pendingPhotoBlob = null;
  let pendingAction = null; // 'checkin' or 'checkout'

  // ─── Sidebar / Navigation ─────────────────────────────────────────
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open');
  });
  document.getElementById('sidebar-overlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
  });

  document.querySelectorAll('.nav-item[data-tab]').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item[data-tab]').forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
      document.getElementById(`tab-${item.dataset.tab}`).classList.add('active');
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-overlay').classList.remove('open');
    });
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    Api.logout();
  });

  // ─── User info ─────────────────────────────────────────────────────
  userName.textContent = user.name || 'Staff';
  userRole.textContent = user.employeeId ? `Staff · ${user.employeeId}` : 'Staff';

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
  let currentPosition = null;

  function getLocation() {
    if (!navigator.geolocation) {
      locationStatus.className = 'location-status unavailable';
      locationStatus.innerHTML = '<span>⚠️</span> Geolocation not supported';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentPosition = pos;
        locationStatus.className = 'location-status available';
        locationStatus.innerHTML = `<span>📍</span> Location detected (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`;
      },
      () => {
        locationStatus.className = 'location-status unavailable';
        locationStatus.innerHTML = '<span>⚠️</span> Location unavailable — enable GPS to check in/out';
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
  getLocation();

  // ─── Load today's status ──────────────────────────────────────────
  async function loadToday() {
    try {
      const data = await Api.request('/attendance/today');
      const record = data.record;
      updateUI(record);
    } catch (err) {
      statusText.textContent = 'Could not load status';
      statusSub.textContent = err.message;
      checkinBtn.style.display = 'block';
      checkinBtn.textContent = '✅ Check In';
    }
  }

  function updateUI(record) {
    if (!record) {
      statusIcon.textContent = '⏳';
      statusText.textContent = 'Not Checked In';
      statusSub.textContent = 'You haven\'t checked in today. Start your shift!';
      checkinBtn.style.display = 'block';
      checkinBtn.textContent = '✅ Check In';
      checkoutBtn.style.display = 'none';
    } else if (record.status === 'checked-in') {
      statusIcon.textContent = '🟡';
      statusText.textContent = 'Checked In';
      const time = new Date(record.checkIn.time).toLocaleTimeString('en-US', { hour12: false });
      statusSub.textContent = `Checked in at ${time}`;
      checkinBtn.style.display = 'none';
      checkoutBtn.style.display = 'block';
      checkoutBtn.textContent = '🚪 Check Out';
    } else if (record.status === 'completed') {
      statusIcon.textContent = '✅';
      statusText.textContent = 'Shift Completed';
      const ci = new Date(record.checkIn.time).toLocaleTimeString('en-US', { hour12: false });
      const co = new Date(record.checkOut.time).toLocaleTimeString('en-US', { hour12: false });
      statusSub.textContent = `${ci} → ${co}`;
      checkinBtn.style.display = 'none';
      checkoutBtn.style.display = 'none';
    }
  }

  // ─── Capture Photo Helper ─────────────────────────────────────────
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
    photoPreviewImg.src = url;
    photoPreview.style.display = 'block';
    checkinBtn.style.display = 'none';
    checkoutBtn.style.display = 'none';
  }

  function hidePhotoPreview() {
    if (photoPreviewImg.src) URL.revokeObjectURL(photoPreviewImg.src);
    photoPreview.style.display = 'none';
    photoPreviewImg.src = '';
    pendingPhotoBlob = null;
    pendingAction = null;
    loadToday(); // restore buttons
  }

  async function submitAttendance(action) {
    if (!currentPosition) {
      Api.toast('Please enable GPS/location to proceed', 'warning');
      getLocation();
      return;
    }

    const endpoint = action === 'checkin' ? '/attendance/checkin' : '/attendance/checkout';
    const successMsg = action === 'checkin' ? '✅ Checked in successfully!' : '✅ Checked out successfully! Shift complete!';

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
      await loadToday();
    } catch (err) {
      Api.toast(err.message, 'error');
      hidePhotoPreview();
    } finally {
      btn.disabled = false;
    }
  }

  // ─── Check In ─────────────────────────────────────────────────────
  checkinBtn.addEventListener('click', async () => {
    if (!currentPosition) {
      Api.toast('Please enable GPS/location to check in', 'warning');
      getLocation();
      return;
    }

    const blob = await capturePhoto();
    if (!blob) {
      Api.toast('Camera access is required for check-in', 'error');
      return;
    }
    showPhotoPreview(blob, 'checkin');
  });

  // ─── Check Out ────────────────────────────────────────────────────
  checkoutBtn.addEventListener('click', async () => {
    if (!currentPosition) {
      Api.toast('Please enable GPS/location to check out', 'warning');
      getLocation();
      return;
    }

    const blob = await capturePhoto();
    if (!blob) {
      Api.toast('Camera access is required for check-out', 'error');
      return;
    }
    showPhotoPreview(blob, 'checkout');
  });

  // ─── Photo Preview Buttons ────────────────────────────────────────
  confirmPhoto.addEventListener('click', () => {
    if (pendingAction) submitAttendance(pendingAction);
  });

  retakePhoto.addEventListener('click', async () => {
    const blob = await capturePhoto();
    if (blob) {
      URL.revokeObjectURL(photoPreviewImg.src);
      showPhotoPreview(blob, pendingAction);
    } else {
      Api.toast('Camera access required', 'error');
      hidePhotoPreview();
    }
  });

  // ─── Load History ─────────────────────────────────────────────────
  async function loadHistory() {
    try {
      const data = await Api.request('/attendance/history');
      const records = data.records || [];
      renderHistory(records);
    } catch (err) {
      historyList.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>Could not load history</h3><p>${err.message}</p></div>`;
    }
  }

  function renderHistory(records) {
    historyCount.textContent = records.length;

    if (records.length === 0) {
      historyList.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No records yet</h3><p>Your attendance history will appear here after you check in.</p></div>`;
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
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        duration = `${hrs}h ${mins}m`;
      }

      const statusClass = r.status === 'completed' ? 'completed' : 'checked-in';
      return `<div class="history-item">
        <div>
          <div class="date">${date}</div>
          <div class="time-range">${ci} → ${co}</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="duration">${duration}</div>
          <span class="status-dot ${statusClass}"></span>
        </div>
      </div>`;
    }).join('');
  }

  // ─── Init ──────────────────────────────────────────────────────────
  loadToday();
  loadHistory();
})();
