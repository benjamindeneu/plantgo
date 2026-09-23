// src/controllers/AvatarEditor.controller.js
import { createAvatarEditorView } from "../ui/components/AvatarEditor.view.js";
import { subscribeAvatar, saveAvatar } from "../data/avatar.js";
import { subscribeBadges } from "../data/badges.js";
import { subscribeAllEventProgress, tokensFor } from "../data/events.js";
import { auth } from "../../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

export function AvatarEditorPanel() {
  const view = createAvatarEditorView();
  view.showLoading();

  let uid = null;
  let unsubAvatar = null;
  let unsubBadges = null;
  let unsubEvents = null;

  let latestAvatar = null;
  // Ownership is one set of tokens: badge ids, and `<eventId>:<tier>` for
  // every event pass tier reached — including events that are over.
  let latestBadges = new Set();
  let latestEventTokens = new Set();
  let latestUnlocked = new Set();
  // The first paint waits for both, or every badge-gated tile would flash
  // locked for a beat before the badges land.
  let haveAvatar = false;
  let haveBadges = false;
  let haveEvents = false;

  function refresh() {
    if (!haveAvatar || !haveBadges || !haveEvents) return;
    latestUnlocked = new Set([...latestBadges, ...latestEventTokens]);
    view.update(latestAvatar, latestUnlocked);
  }

  // A tap applies at once and saves behind it; the snapshot that follows the
  // write repaints the same state, so nothing waits on the network.
  view.setOnSelect((slot, id) => {
    if (!uid || !latestAvatar) return;
    latestAvatar = { ...latestAvatar, [slot]: id };
    refresh();
    saveAvatar(uid, latestAvatar).catch((e) => console.error("[AvatarEditor] save failed:", e));
  });

  onAuthStateChanged(auth, (user) => {
    if (unsubAvatar) { unsubAvatar(); unsubAvatar = null; }
    if (unsubBadges) { unsubBadges(); unsubBadges = null; }
    if (unsubEvents) { unsubEvents(); unsubEvents = null; }
    haveAvatar = false;
    haveBadges = false;
    haveEvents = false;
    uid = user?.uid ?? null;
    if (!user) { view.showError(); return; }

    unsubAvatar = subscribeAvatar(user.uid, (avatar) => {
      latestAvatar = avatar;
      haveAvatar = true;
      refresh();
    });

    unsubBadges = subscribeBadges(user.uid, (unlockedSet) => {
      latestBadges = unlockedSet;
      haveBadges = true;
      refresh();
    });

    unsubEvents = subscribeAllEventProgress(user.uid, (byEvent) => {
      latestEventTokens = tokensFor(byEvent);
      haveEvents = true;
      refresh();
    });
  });

  const el = view.element;
  el.stop = () => {
    if (unsubAvatar) { unsubAvatar(); unsubAvatar = null; }
    if (unsubBadges) { unsubBadges(); unsubBadges = null; }
    if (unsubEvents) { unsubEvents(); unsubEvents = null; }
  };
  return el;
}
