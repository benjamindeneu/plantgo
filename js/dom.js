// dom.js
// Purpose: cache DOM nodes + tiny helpers. No behavior change.

export const els = {
  // Header / menu
  userBtn: document.getElementById('userBtn'),
  userMenu: document.getElementById('userMenu'),
  plantDexBtn: document.getElementById('plantDexBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  userName: document.getElementById('userName'),
  levelNumber: document.getElementById('levelNumber'),
  levelProgressBar: document.getElementById('levelProgressBar'),

  // Camera / validation
  photoInput: document.getElementById('photoInput'),
  validateBtn: document.getElementById('validateBtn'),
  submitBtn: document.getElementById('submitBtn'),
  preview: document.getElementById('preview'),
  validationResult: document.getElementById('validationResult'),

  // Missions / GPS
  getLocationBtn: document.getElementById('getLocationBtn'),
  locationInfo: document.getElementById('locationInfo'),
  suggestions: document.getElementById('suggestions'),
  requestResult: document.getElementById('requestresult'),

  // Modals
  resultModal: document.getElementById('resultModal'),
  modalClose: document.getElementById('modalClose'),
  modalText: document.getElementById('modalText'),
  resultLevelNumber: document.getElementById('resultLevelNumber'),
  resultLevelProgressBar: document.getElementById('resultLevelProgressBar'),
  levelUp: document.getElementById('levelUp'),

  missionModal: document.getElementById('missionModal'),
  missionModalClose: document.getElementById('missionModalClose'),
  missionModalText: document.getElementById('missionModalText'),

  // Spinner
  spinner: document.getElementById('spinner'),
};

export const show = (el) => el && (el.style.display = 'block');
export const hide = (el) => el && (el.style.display = 'none');
export const busy = (on) => (on ? show(els.spinner) : hide(els.spinner));
export function toast(html) {
  els.requestResult.innerHTML = `<div class="fade-in">${html}</div>`;
  setTimeout(() => (els.requestResult.innerHTML = ''), 4000);
}

// Pure UI (no logic change)
export function updateHeaderLevel(level, progressPct) {
  if (els.levelNumber) els.levelNumber.textContent = level;
  if (els.levelProgressBar) els.levelProgressBar.style.width = `${Math.max(0, Math.min(100, progressPct))}%`;
}
export function updateResultLevel(level, progressPct) {
  if (els.resultLevelNumber) els.resultLevelNumber.textContent = level;
  if (els.resultLevelProgressBar) els.resultLevelProgressBar.style.width = `${Math.max(0, Math.min(100, progressPct))}%`;
}
export function openModal(el) { el?.classList.add('show'); el?.setAttribute('open', ''); }
export function closeModal(el) { el?.classList.remove('show'); el?.removeAttribute('open'); }
export function confettiBurst() {
  if (window.confetti) window.confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
}
