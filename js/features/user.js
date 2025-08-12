// features/user.js
// Loads username (prefers Firestore username), level/progress, and wires Herbarium & Logout.

import { els, updateHeaderLevel } from '../dom.js';
import { state, setUser, setLevel, setProgress, setTotalPoints } from '../state.js';

import { auth, db } from '../firebase-config.js';
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import {
  doc,
  getDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

export function init() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    setUser(user);

    const userRef = doc(db, 'users', user.uid);
    // Initial load
    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) applyUserDoc(snap.data(), user);
    } catch (e) { console.warn('User doc read failed', e); }

    // Live updates
    onSnapshot(userRef, (docSnap) => {
      const data = docSnap.data() || {};
      applyUserDoc(data, user);
    });
  });

  // Herbarium
  if (els.plantDexBtn) {
    els.plantDexBtn.addEventListener('click', () => {
      window.open('plantdex.html', '_blank', 'noopener');
    });
  }

  // Logout
  if (els.logoutBtn) {
    els.logoutBtn.addEventListener('click', async () => {
      try { await signOut(auth); } catch {}
      window.location.href = 'login.html';
    });
  }
}

function applyUserDoc(u, user) {
  // Username preference: firestore.username > firestore.name/displayName > auth.displayName > email
  const display = u.username || u.name || u.displayName || user.displayName || user.email || 'User';
  if (els.userName) els.userName.textContent = display;

  // Try multiple field names to be robust (no behavior change if yours are standard)
  const lvl = pickNumber(u, ['level', 'current_level', 'lvl'], state.level);
  const prog = pickNumber(u, ['progress', 'level_progress', 'progressPct'], state.progress);
  const total = pickNumber(u, ['total_points', 'points', 'totalPoints'], state.totalPoints);

  setLevel(lvl);
  setProgress(prog);
  setTotalPoints(total);
  updateHeaderLevel(lvl, prog);
}

function pickNumber(obj, keys, fallback) {
  for (const k of keys) {
    if (k in obj && obj[k] != null && !Number.isNaN(Number(obj[k]))) return Number(obj[k]);
  }
  return fallback;
}
