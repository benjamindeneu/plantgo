// src/controllers/Badges.controller.js
import { createBadgesView } from "../ui/components/Badges.view.js";
import { subscribeBadges, checkRetroactiveBadges } from "../data/badges.js";
import { auth } from "../../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

export function BadgesPanel() {
  const view = createBadgesView();
  view.showLoading();

  let unsubBadges = null;

  onAuthStateChanged(auth, async (user) => {
    if (unsubBadges) { unsubBadges(); unsubBadges = null; }
    if (!user) { view.showError(); return; }

    // Retroactive unlock for existing accounts (no-op if already done)
    await checkRetroactiveBadges(user.uid);

    // Subscribe after retro check so the view reflects all unlocked badges
    unsubBadges = subscribeBadges(user.uid, (unlockedSet) => {
      view.update(unlockedSet);
    });
  });

  return view.element;
}
