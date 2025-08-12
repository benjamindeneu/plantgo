// ui.js
// Purpose: small global UI interactions previously inline in index.html.

import { els } from './dom.js';

export function init() {
  // beforeunload — unchanged
  window.addEventListener('beforeunload', function (e) {
    e.preventDefault();
    e.returnValue = '';
  });

  // user menu toggle — unchanged
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
