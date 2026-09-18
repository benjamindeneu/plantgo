// src/controllers/Badges.controller.js
import { createBadgesView } from "../ui/components/Badges.view.js";
import { subscribeBadges, checkRetroactiveBadges } from "../data/badges.js";
import { db, auth } from "../../firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

export function BadgesPanel() {
  const view = createBadgesView();
  view.showLoading();

  let unsubBadges = null;
  let unsubUser = null;

  // Keep latest values from both subscriptions so we can re-render when either changes
  let latestUnlocked = new Set();
  let latestDates = new Map();
  let latestCounts = { obs: 0, mission: 0, discoveries: 0, level: 1 };
  // The first paint waits for both, or the hero would count "0 of 17" and
  // every bar would sit empty for a beat before the real numbers land.
  let haveCounts = false;
  let haveBadges = false;

  function refresh() {
    if (!haveCounts || !haveBadges) return;
    view.update(latestUnlocked, latestCounts, latestDates);
  }

  onAuthStateChanged(auth, async (user) => {
    if (unsubBadges) { unsubBadges(); unsubBadges = null; }
    if (unsubUser)   { unsubUser();   unsubUser = null; }
    haveCounts = false;
    haveBadges = false;
    if (!user) { view.showError(); return; }

    // Retroactive unlock for existing accounts (no-op if already done)
    await checkRetroactiveBadges(user.uid);

    // Subscribe to user doc for live observation/mission counts
    unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.data() ?? {};
      latestCounts = {
        obs:         Number(data.total_observations        ?? 0),
        mission:     Number(data.total_mission_observations ?? 0),
        discoveries: Number(data.total_discoveries         ?? 0),
        level:       Math.floor(1 + (Number(data.total_points) || 0) / 11000),
        challenges:    Number(data.total_challenges      ?? 0),
        challengeWins: Number(data.total_challenge_wins  ?? 0),
      };
      haveCounts = true;
      refresh();
    });

    // Subscribe to badges collection
    unsubBadges = subscribeBadges(user.uid, (unlockedSet, dates) => {
      latestUnlocked = unlockedSet;
      latestDates = dates;
      haveBadges = true;
      refresh();
    });
  });

  return view.element;
}
