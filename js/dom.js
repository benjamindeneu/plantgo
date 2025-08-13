// dom.js
// Purpose: cache DOM nodes + tiny helpers. Now supports late binding via refreshEls().

export const els = {
  // will be filled by refreshEls()
};

export function refreshEls() {
  els.userBtn = document.getElementById('userBtn');
  els.userMenu = document.getElementById('userMenu');
  els.plantDexBtn = document.getElementById('plantDexBtn');
  els.logoutBtn = document.getElementById('logoutBtn');
  els.userName = document.getElementById('userName');
  els.levelNumber = document.getElementById('levelNumber');
  els.levelProgressBar = document.getElementById('levelProgressBar');

  els.photoInput = document.getElementById('photoInput');
  els.validateBtn = document.getElementById('validateBtn');
  els.submitBtn = document.getElementById('submitBtn');
  els.preview = document.getElementById('preview');
  els.validationResult = document.getElementById('validationResult');

  els.getLocationBtn = document.getElementById('getLocationBtn');
  els.locationInfo = document.getElementById('locationInfo');
  els.suggestions = document.getElementById('suggestions');
  els.requestResult = document.getElementById('requestresult');

  els.resultModal = document.getElementById('resultModal');
  els.modalClose = document.getElementById('modalClose');
  els.modalText = document.getElementById('modalText');
  els.resultLevelNumber = document.getElementById('resultLevelNumber');
  els.resultLevelProgressBar = document.getElementById('resultLevelProgressBar');
  els.levelUp = document.getElementById('levelUp');

  els.missionModal = document.getElementById('missionModal');
  els.missionModalClose = document.getElementById('missionModalClose');
  els.missionModalText = document.getElementById('missionModalText');

  els.spinner = document.getElementById('spinner');
}

export const show = (el) => el && (el.style.display = 'block');
export const hide = (el) => el && (el.style.display = 'none');
export const busy = (on) => (on ? show(els.spinner) : hide(els.spinner));
export function toast(html) {
  if (!els.requestResult) return;
  els.requestResult.innerHTML = `<div class="fade-in">${html}</div>`;
  setTimeout(() => (els.requestResult.innerHTML = ''), 4000);
}

// Pure UI (no behavior change)
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
