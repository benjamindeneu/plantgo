// features/user.js
// Purpose: user load, header render, logout, herbarium open (feature-parity).

import { els, updateHeaderLevel } from '../dom.js';
import { state, setUser, setLevel, setProgress, setTotalPoints } from '../state.js';

// If you already import Firebase elsewhere, keep it exactly the same:
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
  // Auth state → load user profile (exact behavior, names can be adjusted to match your current doc)
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    setUser(user);
    // Load user doc
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const u = snap.data();
      const lvl = Number(u.level ?? state.level);
      const prog = Number(u.progress ?? state.progress);
      const total = Number(u.total_points ?? state.totalPoints);
      setLevel(lvl);
      setProgress(prog);
      setTotalPoints(total);
      if (els.userName) els.userName.textContent = u.username || user.email || 'User';
      updateHeaderLevel(lvl, prog);
    }

    // Live progress snapshot (parity with your current onSnapshot if you have one)
    onSnapshot(userRef, (docSnap) => {
      const u = docSnap.data() || {};
      const lvl = Number(u.level ?? state.level);
      const prog = Number(u.progress ?? state.progress);
      setLevel(lvl);
      setProgress(prog);
      updateHeaderLevel(lvl, prog);
    });
  });

  // Herbarium button
  if (els.plantDexBtn) {
    els.plantDexBtn.addEventListener('click', () => {
      window.open('plantdex.html', '_blank', 'noopener');
    });
  }

  // Logout button (same behavior)
  if (els.logoutBtn) {
    els.logoutBtn.addEventListener('click', async () => {
      try { await signOut(auth); } catch {}
      window.location.href = 'login.html';
    });
  }
}
