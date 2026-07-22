(function () {
  'use strict';

  const user = Api.requireAuth('staff');
  if (!user) return;

  const headerUser = document.getElementById('header-user');
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  const statusSub = document.getElementById('status-sub');
  const liveClock = document.getElementById('live-clock');
  const liveDate = document.getElementById('live-date');
  const checkinBtn = document.getElementById('checkin-btn');
  const checkoutBtn = document.getElementById('checkout-btn');
  const locationStatus = document.getElementById('location-status');
  const historyList = document.getElementById('history-list');
  const historyCount = document.getElementById('history-count');
  const cameraArea = document.getElementById('camera-area');
  const cameraPreview = document.getElementById('camera-preview');
  const capturedPhoto = document.getElementById('captured-photo');
  const captureBtn = document.getElementById('capture-btn');
  const captureOverlay = document.getElementById('capture-overlay');
  const captureActions = document.getElementById('capture-actions');
  const confirmBtn = document.getElementById('confirm-photo');
  const retakeBtn = document.getElementById('retake-photo');
  const cancelBtn = document.getElementById('cancel-camera');
  const cameraStatus = document.getElementById('camera-status');
  const pageContainer = document.getElementById('page-container');

  let currentPosition = null;
  let todayRecord = null;
  let mediaStream = null;
  let pendingAction = null;
  let capturedBlob = null;

  headerUser.textContent = user.employeeId ? `Staff · ${user.employeeId}` : `Staff · ${user.name}`;

  if (document.getElementById('desktop-user-name')) {
    document.getElementById('desktop-user-name').textContent = user.name;
    document.getElementById('desktop-user-role').textContent = user.employeeId ? `Staff · ${user.employeeId}` : 'Staff';
  }
  document.getElementById('logout-btn').addEventListener('click', Api.logout);
  document.getElementById('desktop-logout')?.addEventListener('click', Api.logout);

  function updateClock() {
    const now = new Date();
    liveClock.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    liveDate.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  updateClock();
  setInterval(updateClock, 1000);

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
      statusSub.textContent = `Since ${new Date(record.checkIn.time).toLocaleTimeString('en-US', { hour12: false })}`;
      checkinBtn.style.display = 'none';
      checkoutBtn.style.display = 'block';
      checkoutBtn.textContent = '🚪 Check Out';
    } else {
      statusIcon.textContent = '✅';
      statusText.textContent = 'Shift Complete';
      const ci = new Date(record.checkIn.time).toLocaleTimeString('en-US', { hour12: false });
      const co = new Date(record.checkOut.time).toLocaleTimeString('en-US', { hour12: false });
      statusSub.textContent = `${ci} → ${co}`;
      checkinBtn.style.display = 'none';
      checkoutBtn.style.display = 'none';
    }
  }

  async function openCamera() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      cameraPreview.srcObject = mediaStream;
      cameraArea.style.display = 'block';
      captureOverlay.style.display = 'flex';
      capturedPhoto.style.display = 'none';
      cameraPreview.style.display = 'block';
      captureActions.style.display = 'none';
      cameraStatus.innerHTML = '';
      return true;
    } catch (err) {
      cameraStatus.innerHTML = `<div class="msg error">Camera access denied. Please allow camera permissions.</div>`;
      return false;
    }
  }

  function closeCamera() {
    if (mediaStream) { mediaStream.getTracks().forEach((t) => t.stop()); mediaStream = null; }
    cameraArea.style.display = 'none';
    cameraPreview.srcObject = null;
    capturedBlob = null;
    pendingAction = null;
  }

  function capturePhoto() {
    const canvas = document.createElement('canvas');
    canvas.width = cameraPreview.videoWidth || 480;
    canvas.height = cameraPreview.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      capturedBlob = blob;
      capturedPhoto.src = URL.createObjectURL(blob);
      capturedPhoto.style.display = 'block';
      cameraPreview.style.display = 'none';
      captureOverlay.style.display = 'none';
      captureActions.style.display = 'flex';
      if (mediaStream) { mediaStream.getTracks().forEach((t) => t.stop()); mediaStream = null; }
    }, 'image/jpeg', 0.8);
  }

  checkinBtn.addEventListener('click', async () => {
    if (!currentPosition) { getLocation(); Api.toast('Enable GPS to check in', 'warning'); return; }
    if (navigator.vibrate) navigator.vibrate(10);
    pendingAction = 'checkin';
    checkinBtn.style.display = 'none';
    checkoutBtn.style.display = 'none';
    if (!(await openCamera())) { pendingAction = null; updateUI(todayRecord); }
  });

  checkoutBtn.addEventListener('click', async () => {
    if (!currentPosition) { getLocation(); Api.toast('Enable GPS to check out', 'warning'); return; }
    if (navigator.vibrate) navigator.vibrate(10);
    pendingAction = 'checkout';
    checkinBtn.style.display = 'none';
    checkoutBtn.style.display = 'none';
    if (!(await openCamera())) { pendingAction = null; updateUI(todayRecord); }
  });

  captureBtn.addEventListener('click', () => { if (navigator.vibrate) navigator.vibrate(15); capturePhoto(); });
  confirmBtn.addEventListener('click', submitAttendance);

  retakeBtn.addEventListener('click', async () => {
    capturedBlob = null; capturedPhoto.src = ''; capturedPhoto.style.display = 'none';
    captureActions.style.display = 'none';
    if (!(await openCamera())) { closeCamera(); updateUI(todayRecord); }
  });

  cancelBtn.addEventListener('click', () => { closeCamera(); updateUI(todayRecord); });

  async function submitAttendance() {
    if (!currentPosition) { Api.toast('Enable GPS to proceed', 'warning'); getLocation(); return; }
    if (!capturedBlob) { Api.toast('Please capture a photo first', 'warning'); return; }

    const action = pendingAction;
    const endpoint = action === 'checkin' ? '/attendance/checkin' : '/attendance/checkout';
    confirmBtn.disabled = true;
    confirmBtn.textContent = '⏳ Submitting...';

    try {
      const formData = new FormData();
      formData.append('image', capturedBlob, `${action}.jpg`);
      formData.append('latitude', currentPosition.coords.latitude);
      formData.append('longitude', currentPosition.coords.longitude);
      formData.append('accuracy', currentPosition.coords.accuracy || 0);

      await Api.request(endpoint, { method: 'POST', body: formData, isForm: true });
      Api.toast(action === 'checkin' ? '✅ Checked in!' : '✅ Checked out!', 'success');
      closeCamera();
      await loadToday();
      await loadHistory();
    } catch (err) {
      Api.toast(err.message, 'error');
      closeCamera();
      updateUI(todayRecord);
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = '✅ Confirm';
    }
  }

  async function loadHistory() {
    try {
      const data = await Api.request('/attendance/history');
      const records = data.records || [];
      historyCount.textContent = records.length;
      if (records.length === 0) {
        historyList.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No records yet</h3></div>`;
        return;
      }
      historyList.innerHTML = records.map((r) => {
        const date = new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const ci = r.checkIn ? new Date(r.checkIn.time).toLocaleTimeString('en-US', { hour12: false }) : '—';
        const co = r.checkOut ? new Date(r.checkOut.time).toLocaleTimeString('en-US', { hour12: false }) : '—';
        let dur = '—';
        if (r.checkIn && r.checkOut) {
          const d = new Date(r.checkOut.time) - new Date(r.checkIn.time);
          dur = `${Math.floor(d / 3600000)}h ${Math.floor((d % 3600000) / 60000)}m`;
        }
        const cls = r.status === 'completed' ? 'done' : 'on';
        return `<div class="history-item"><div><div class="h-date">${date}</div><div class="h-time">${ci} → ${co}</div></div><div style="display:flex;align-items:center;gap:8px;"><div class="h-dur">${dur}</div><span class="h-dot ${cls}"></span></div></div>`;
      }).join('');
    } catch (err) {
      historyList.innerHTML = `<div class="empty-state"><h3>Could not load history</h3></div>`;
    }
  }

  loadToday();
  loadHistory();
})();
