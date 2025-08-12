// features/user.js
// Purpose: load user, show username (not email), load level/progress, herbarium + logout.
// Keeps your Firestore contract; adjust field names below only if yours differ.

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
  // Auth state → load user profile (WITHOUT changing your schema)
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    setUser(user);

    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const u = snap.data();

      // Prefer username from Firestore, fall back to displayName, then email
      const display =
        (u && (u.username || u.name || u.displayName)) ||
        user.displayName ||
        user.email ||
        'User';
      if (els.userName) els.userName.textContent = display;

      // Load points/level/progress using your existing fields
      const lvl = Number(u.level ?? state.level);
      const prog = Number(u.progress ?? state.progress);
      const total = Number(u.total_points ?? state.totalPoints);

      setLevel(lvl);
      setProgress(prog);
      setTotalPoints(total);
      updateHeaderLevel(lvl, prog);
    }

    // Live updates (if you update user doc elsewhere)
    onSnapshot(userRef, (docSnap) => {
      const u = docSnap.data() || {};
      if (u.username && els.userName) els.userName.textContent = u.username;
      if (typeof u.level !== 'undefined') {
        const lvl = Number(u.level);
        setLevel(lvl);
        const prog = Number(u.progress ?? state.progress);
        setProgress(prog);
        updateHeaderLevel(lvl, prog);
      }
      if (typeof u.total_points !== 'undefined') {
        setTotalPoints(Number(u.total_points));
      }
    });
  });

  // Herbarium button (open plantdex.html exactly as before)
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
