/**
 * PlantGo main.js
 * – Clean DOM wiring
 * – Photo queue + preview
 * – Accessible modals
 * – Loading & error states
 * – Hooks for YOUR EXISTING ngrok API calls (paste into the API section)
 */

// ==== Elements ====
const els = {
  photoInput: document.getElementById('photoInput'),
  validateBtn: document.getElementById('validateBtn'),
  submitBtn: document.getElementById('submitBtn'),
  preview: document.getElementById('preview'),
  validationResult: document.getElementById('validationResult'),
  getLocationBtn: document.getElementById('getLocationBtn'),
  locationInfo: document.getElementById('locationInfo'),
  suggestions: document.getElementById('suggestions'),
  requestResult: document.getElementById('requestresult'),
  spinner: document.getElementById('spinner'),
  // header/menu
  userBtn: document.getElementById('userBtn'),
  userMenu: document.getElementById('userMenu'),
  plantDexBtn: document.getElementById('plantDexBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  // modal
  resultModal: document.getElementById('resultModal'),
  modalClose: document.getElementById('modalClose'),
  modalText: document.getElementById('modalText'),
  resultLevelNumber: document.getElementById('resultLevelNumber'),
  resultLevelProgressBar: document.getElementById('resultLevelProgressBar'),
  levelUp: document.getElementById('levelUp'),
  // mission modal
  missionModal: document.getElementById('missionModal'),
  missionModalClose: document.getElementById('missionModalClose'),
  missionModalText: document.getElementById('missionModalText'),
  // header progress
  levelNumber: document.getElementById('levelNumber'),
  levelProgressBar: document.getElementById('levelProgressBar'),
};

// ==== State ====
const state = {
  photoFiles: [],
  user: { name: 'User', level: 1, progress: 0, points: 0 },
};

// ==== Utils ====
const show = (el) => { if (!el) return; el.style.display = 'block'; };
const hide = (el) => { if (!el) return; el.style.display = 'none'; };
const busy = (on) => on ? show(els.spinner) : hide(els.spinner);

function openModal(el) { if (!el) return; el.classList.add('show'); el.setAttribute('open', ''); }
function closeModal(el) { if (!el) return; el.classList.remove('show'); el.removeAttribute('open'); }

function confettiBurst() {
  if (window.confetti) {
    window.confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  }
}

function updateHeaderLevel(level, progressPct) {
  if (els.levelNumber) els.levelNumber.textContent = level;
  if (els.levelProgressBar) els.levelProgressBar.style.width = `${Math.max(0, Math.min(100, progressPct))}%`;
}

function updateResultLevel(level, progressPct) {
  if (els.resultLevelNumber) els.resultLevelNumber.textContent = level;
  if (els.resultLevelProgressBar) els.resultLevelProgressBar.style.width = `${Math.max(0, Math.min(100, progressPct))}%`;
}

function toast(html) {
  els.requestResult.innerHTML = `<div class="fade-in">${html}</div>`;
  setTimeout(() => (els.requestResult.innerHTML = ''), 4000);
}

// Render small preview chips
function renderPreviews(files) {
  els.preview.innerHTML = '';
  files.forEach((file, idx) => {
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.src = url;
    img.alt = `Selected plant photo ${idx + 1}`;
    img.style.width = '84px';
    img.style.height = '84px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '10px';
    img.loading = 'lazy';

    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.appendChild(img);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', 'Remove photo');
    removeBtn.style.position = 'absolute';
    removeBtn.style.right = '4px';
    removeBtn.style.top = '4px';
    removeBtn.style.padding = '0 6px';
    removeBtn.style.borderRadius = '999px';
    removeBtn.style.background = 'rgba(0,0,0,.5)';
    removeBtn.style.color = '#fff';
    removeBtn.onclick = () => {
      state.photoFiles.splice(idx, 1);
      renderPreviews(state.photoFiles);
    };
    wrap.appendChild(removeBtn);

    els.preview.appendChild(wrap);
  });
}

// ==== API (KEEP YOUR NGROK CALLS) ====
const SPECIES_PROXY_URL  = 'https://liked-stirring-stinkbug.ngrok-free.app/api/missions';
const POINTS_PROXY_URL   = 'https://liked-stirring-stinkbug.ngrok-free.app/api/points';
const IDENTIFY_PROXY_URL = 'https://liked-stirring-stinkbug.ngrok-free.app/api/identify';

/**
 * Identify -> then award points
 * @param {File} file  - image file from input
 * @param {Object} ctx - optional context: { lat, lon, userId }
 * @returns {Promise<{
 *   speciesName: string,
 *   confidence: number,
 *   pointsBreakdown: Array<{label:string, points:number}>,
 *   totalPoints: number,
 *   newLevel: number,
 *   newProgress: number
 * }>}
 */
async function apiIdentifyPlant(file, ctx = {}) {
  // 1) Identify
  const formData = new FormData();
  formData.append('image', file);

  const idRes = await fetch(IDENTIFY_PROXY_URL, { method: 'POST', body: formData });
  if (!idRes.ok) throw new Error(`Identify failed: ${idRes.status}`);
  const identifyData = await idRes.json(); // expect { speciesName, confidence, ... }

  // 2) Award points (pass along anything your backend expects)
  const payload = {
    speciesName: identifyData.speciesName,
    confidence: identifyData.confidence,
    // Optional context your backend might use:
    lat: ctx.lat ?? null,
    lon: ctx.lon ?? null,
    userId: ctx.userId ?? null
  };

  const ptRes = await fetch(POINTS_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!ptRes.ok) throw new Error(`Points API failed: ${ptRes.status}`);
  const pointsData = await ptRes.json(); // expect { pointsBreakdown, totalPoints, newLevel, newProgress }

  // 3) Merge for UI
  return { ...identifyData, ...pointsData };
}

/**
 * Missions near a location
 * @returns {Promise<Array<{id,title,description,levelClass,points}>>}
 */
async function apiFetchMissions(lat, lon) {
  const res = await fetch(`${SPECIES_PROXY_URL}?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error(`Missions fetch failed: ${res.status}`);
  return res.json();
}

/** You can also call this directly elsewhere if needed */
async function apiPostPoints(data) {
  const res = await fetch(POINTS_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Points post failed: ${res.status}`);
  return res.json();
}


async function apiLogout() {
  // Optional: paste your existing logout call if you have one.
}

// ==== Event handlers ====
function wireMenu() {
  if (!els.userBtn || !els.userMenu) return;
  els.userBtn.addEventListener('click', () => {
    const open = els.userMenu.style.display === 'block';
    els.userMenu.style.display = open ? 'none' : 'block';
    els.userBtn.setAttribute('aria-expanded', String(!open));
  });
  document.addEventListener('click', (e) => {
    if (!els.userBtn.contains(e.target) && !els.userMenu.contains(e.target)) {
      els.userMenu.style.display = 'none';
      els.userBtn.setAttribute('aria-expanded', 'false');
    }
  });

  if (els.plantDexBtn) {
    els.plantDexBtn.addEventListener('click', () => {
      window.open('plantdex.html', '_blank', 'noopener');
    });
  }
  if (els.logoutBtn) {
    els.logoutBtn.addEventListener('click', async () => {
      await apiLogout()?.catch(() => {});
      window.location.href = 'login.html';
    });
  }
}

function wireCameraFlow() {
  els.validateBtn?.addEventListener('click', () => els.photoInput?.click());
  els.photoInput?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    // Keep latest selection appended
    state.photoFiles.push(...files);
    // Hard cap to avoid memory spikes
    state.photoFiles = state.photoFiles.slice(0, 12);
    renderPreviews(state.photoFiles);
  });

  els.submitBtn?.addEventListener('click', async () => {
    if (!state.photoFiles.length) {
      toast('Please add at least one photo.');
      return;
    }

    busy(true);
    els.validationResult.textContent = '';

    const results = [];
    for (const file of state.photoFiles) {
      try {
        const res = await apiIdentifyPlant(file);
        results.push(res);
      } catch (err) {
        console.error(err);
        toast('One photo failed to validate.');
      }
    }

    busy(false);
    if (!results.length) return;

    // Aggregate & show modal
    const totalAdded = results.reduce((sum, r) => sum + (r.totalPoints || 0), 0);
    const latest = results[results.length - 1];
    state.user.level = latest.newLevel ?? state.user.level;
    state.user.progress = latest.newProgress ?? state.user.progress;
    state.user.points += totalAdded;

    updateResultLevel(state.user.level, state.user.progress);
    updateHeaderLevel(state.user.level, state.user.progress);

    const lines = results.map((r) => {
      const pb = (r.pointsBreakdown || []).map(p => `<span class="badge">${p.label}: <strong>+${p.points}</strong></span>`).join(' ');
      return `<div class="species-item"><div class="card-content"><div class="species-info"><h3>${r.speciesName || 'Unknown species'}</h3><p>Confidence: ${(r.confidence * 100).toFixed(0)}%</p>${pb}</div></div></div>`;
    }).join('');

    els.modalText.innerHTML = `
      <p class="mission-title">Great job! You earned <strong>+${totalAdded}</strong> points.</p>
      ${lines}
    `;

    openModal(els.resultModal);
    confettiBurst();
    // Clear queue and preview
    state.photoFiles = [];
    renderPreviews(state.photoFiles);
  });
}

function wireMissions() {
  els.getLocationBtn?.addEventListener('click', async () => {
    if (!navigator.geolocation) {
      toast('Geolocation not supported.');
      return;
    }

    busy(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      els.locationInfo.textContent = `Lat ${lat.toFixed(4)}, Lon ${lon.toFixed(4)}`;
      try {
        const missions = await apiFetchMissions(lat, lon);
        renderMissions(missions || []);
      } catch (err) {
        console.error(err);
        toast('Could not fetch missions.');
      } finally {
        busy(false);
      }
    }, (err) => {
      busy(false);
      toast('Location permission denied.');
      console.warn(err);
    }, { enableHighAccuracy: true, timeout: 12000 });
  });
}

function renderMissions(missions) {
  if (!missions.length) {
    els.suggestions.innerHTML = '<p class="muted">No missions nearby right now.</p>';
    return;
  }

  els.suggestions.innerHTML = missions.map(m => `
    <div class="species-item">
      <div class="card-content">
        <div class="species-info">
          <h3>${m.title}</h3>
          <p>${m.description || ''}</p>
          <button class="validate-species-btn ${m.levelClass || ''}" data-mission-id="${m.id}">Accept (+${m.points || 0})</button>
          <div class="validation-feedback muted"></div>
        </div>
      </div>
    </div>
  `).join('');

  // Wire mission buttons (placeholder action)
  els.suggestions.querySelectorAll('button[data-mission-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.nextElementSibling.textContent = 'Mission accepted!';
      setTimeout(() => { btn.disabled = false; btn.nextElementSibling.textContent = ''; }, 2000);
    });
  });
}

function wireModals() {
  els.modalClose?.addEventListener('click', () => closeModal(els.resultModal));
  els.missionModalClose?.addEventListener('click', () => closeModal(els.missionModal));
  [els.resultModal, els.missionModal].forEach((modal) => {
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
    modal?.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(modal); });
  });
}

function init() {
  wireMenu();
  wireCameraFlow();
  wireMissions();
  wireModals();
  // restore last known header state (optional)
  const lv = Number(localStorage.getItem('plantgo.level') || '1');
  const pr = Number(localStorage.getItem('plantgo.progress') || '0');
  state.user.level = lv; state.user.progress = pr;
  updateHeaderLevel(lv, pr);
}

window.addEventListener('load', init);