// ui.js
import { els, refreshEls } from './dom.js';

export function init() {
  // ensure elements exist now (after load)
  refreshEls();

  window.addEventListener('beforeunload', function (e) {
    e.preventDefault();
    e.returnValue = '';
  });

  if (els.userBtn && els.userMenu) {
    els.userBtn.addEventListener('click', function () {
      const open = els.userMenu.style.display === 'block';
      els.userMenu.style.display = open ? 'none' : 'block';
      els.userBtn.setAttribute('aria-expanded', String(!open));
    });

    document.addEventListener('click', function (event) {
      if (!els.userBtn.contains(event.target) && !els.userMenu.contains(event.target)) {
        els.userMenu.style.display = 'none';
        els.userBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
}
