// features/user.js
// Purpose: Restore original user management behavior from main.js.OLD
// - Username display (Firestore username/name/displayName > auth.displayName > email)
// - Level/progress computed from total_points with 11,000 pts/level
// - Live updates via onSnapshot with the original "resultProgressBar[data-locked]" guard
// - Herbarium button and Logout behavior

import { els, updateHeaderLevel } from '../dom.js';
import { state, setUser, setLevel, setProgress, setTotalPoints } from '../state.js';

// Keep your original Firebase imports/versions
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

// === Constants copied from your old logic ===
const POINTS_PER_LEVEL = 11000;

/** Derive level & progress from total points (matches old main.js logic). */
function computeLevelProgress(totalPoints) {
  const tp = Number(totalPoints || 0);
  const level = Math.floor(1 + tp / POINTS_PER_LEVEL);
  const nextLevelThreshold = level * POINTS_PER_LEVEL;
  const prevLevelThreshold = (level - 1) * POINTS_PER_LEVEL;
  const progressPct = ((tp - prevLevelThreshold) / (nextLevelThreshold - prevLevelThreshold)) * 100;
  return { level, progressPct: Math.max(0, Math.min(100, progressPct)) };
}

/** Guard: if the result modal progress bar is "manually locked", skip header UI updates. */
function isResultProgressLocked() {
  // Your old code checked #resultProgressBar; newer markup might use #resultLevelProgressBar.
  const elA = document.getElementById('resultProgressBar');
  const elB = document.getElementById('resultLevelProgressBar');
  return (elA && elA.dataset.locked === 'true') || (elB && elB.dataset.locked === 'true');
}

/** Apply user doc to UI and state (keeps field names from your old code). */
function applyUserDoc(u, fbUser) {
  // Username preference (preserve old behavior; show email if nothing else available)
  const displayName =
    u?.username || u?.name || u?.displayName || fbUser?.displayName || fbUser?.email || 'User';
  if (els.userName) els.userName.textContent = displayName;

  // Total points → level/progress (original logic)
  const total = Number(u?.total_points ?? state.totalPoints ?? 0);
  const { level, progressPct } = computeLevelProgress(total);

  setTotalPoints(total);
  setLevel(level);
  setProgress(progressPct);

  // Respect the old "lock" check before touching the header bar
  if (!isResultProgressLocked()) {
    updateHeaderLevel(level, progressPct); // updates #levelNumber + #levelProgressBar
  }
}

export function init() {
  // Auth state → load user profile (as in your old main.js)
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    setUser(user);

    const userRef = doc(db, 'users', user.uid);

    // Initial load (old code did a getDoc first)
    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        applyUserDoc(snap.data(), user);
      } else {
        // No doc yet: still show something sensible
        const { level, progressPct } = computeLevelProgress(0);
        setTotalPoints(0); setLevel(level); setProgress(progressPct);
        if (!isResultProgressLocked()) updateHeaderLevel(level, progressPct);
        if (els.userName) els.userName.textContent = user.displayName || user.email || 'User';
      }
    } catch (e) {
      console.warn('User doc read failed', e);
    }

    // Live updates (old onSnapshot block)
    onSnapshot(userRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const userData = docSnap.data() || {};

      // Old logic computed from total_points every time:
      const total = Number(userData.total_points || 0);
      const { level, progressPct } = computeLevelProgress(total);

      // Respect the lock guard just like your old code
      if (isResultProgressLocked()) return;

      // Apply updates to state and header
      setTotalPoints(total);
      setLevel(level);
      setProgress(progressPct);

      // Update header UI (same elements as before)
      if (els.levelNumber) els.levelNumber.textContent = level;
      if (els.levelProgressBar) els.levelProgressBar.style.width = `${progressPct}%`;

      // Username live update (if you edit it in Firestore)
      if ((userData.username || userData.name || userData.displayName) && els.userName) {
        els.userName.textContent =
          userData.username || userData.name || userData.displayName ||
          user.displayName || user.email || 'User';
      }
    });
  });

  // Herbarium button — some of your old code had this commented out.
  // Using a safe open in a new tab, which is what you said worked before.
  if (els.plantDexBtn) {
    els.plantDexBtn.addEventListener('click', () => {
      window.open('plantdex.html', '_blank', 'noopener');
    });
  }

  // Logout button — exactly as in your old main.js
  if (els.logoutBtn) {
    els.logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
        window.location.href = "login.html";
      } catch (error) {
        console.error("Error during logout:", error);
      }
    });
  }
}
