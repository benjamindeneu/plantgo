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
  let latestCounts = { obs: 0, mission: 0, discoveries: 0, level: 1 };

  function refresh() {
    view.update(latestUnlocked, latestCounts);
  }

  onAuthStateChanged(auth, async (user) => {
    if (unsubBadges) { unsubBadges(); unsubBadges = null; }
    if (unsubUser)   { unsubUser();   unsubUser = null; }
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
      };
      refresh();
    });

    // Subscribe to badges collection
    unsubBadges = subscribeBadges(user.uid, (unlockedSet) => {
      latestUnlocked = unlockedSet;
      refresh();
    });
  });

  return view.element;
}
