// src/controllers/ChallengePanel.controller.js
import { createChallengePanelView } from "../ui/components/ChallengePanel.view.js";
import { t } from "../language/i18n.js";
import {
  createChallenge,
  joinChallengeByCode,
  subscribeLeaderboard,
  getMyActiveChallenge,
  clearMyActiveChallenge,
} from "../data/challenges.js";

import { auth } from "../../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

export function ChallengePanel() {
  const view = createChallengePanelView();

  let unsub = null;
  let timer = null;
  let endAtMs = null;
  let active = null; // { id, code, endAtMs }

  function cleanupLive() {
    if (unsub) { unsub(); unsub = null; }
    if (timer) { clearInterval(timer); timer = null; }
  }

  function setEndedUI(isEnded) {
    view.setEnded(!!isEnded);
  }

  function startCountdown() {
    if (!endAtMs) return;

    if (timer) clearInterval(timer);

    timer = setInterval(() => {
      const remaining = endAtMs - Date.now();

      if (remaining <= 0) {
        clearInterval(timer);
        timer = null;
        setEndedUI(true);        // ✅ timer removed, ended text shown
        return;
      }

      view.setTimeLeft(endAtMs);
    }, 1000);
  }

  async function activateFromPointer(pointer) {
    // pointer is users/{uid}.activeChallenge: { id, code, startAt, endAt }
    if (!pointer?.id) {
      active = null;
      endAtMs = null;
      cleanupLive();
      view.setActiveChallenge(null);
      view.renderLeaderboard([]);
      setEndedUI(false);
      return;
    }

    endAtMs = pointer?.endAt?.toMillis ? pointer.endAt.toMillis() : null;
    active = { id: pointer.id, code: pointer.code, endAtMs };

    view.setActiveChallenge({ code: pointer.code, endsAtMs: endAtMs });
    view.renderLeaderboard([]);

    cleanupLive();
    unsub = subscribeLeaderboard(pointer.id, (rows) => view.renderLeaderboard(rows));

    const isEnded = endAtMs && Date.now() >= endAtMs;
    setEndedUI(isEnded);

    if (!isEnded) startCountdown();
  }

  // ✅ Persist / restore on reload (auth can be null at first render)
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // logged out -> clear panel state
      await activateFromPointer(null);
      return;
    }
    try {
      const pointer = await getMyActiveChallenge();
      await activateFromPointer(pointer);
    } catch (e) {
      view.setFeedback(e?.message || t("challenge.error.generic"));
    }
  });

  /*view.onCreate(async ({ durationSec }) => {
    try {
      view.setFeedback("");
      view.setCreateStatus(t("challenge.creating"));

      const res = await createChallenge({ durationSec });

      view.setCreateStatus(`${t("challenge.created")} ${res.code}`);
      await activateFromPointer({ id: res.challengeId, code: res.code, startAt: res.startAt, endAt: res.endAt });
    } catch (e) {
      view.setCreateStatus("");
      view.setFeedback(e?.message || t("challenge.error.generic"));
    }
  });

  view.onJoin(async ({ code }) => {
    try {
      view.setFeedback("");
      view.setJoinStatus(t("challenge.joining"));

      const res = await joinChallengeByCode(code);

      view.setJoinStatus(t("challenge.joined"));
      await activateFromPointer({ id: res.challengeId, code: res.code, startAt: res.startAt, endAt: res.endAt });
    } catch (e) {
      view.setJoinStatus("");
      view.setFeedback(e?.message || t("challenge.error.generic"));
    }
  });*/

  // ✅ Close leaderboard when ended: clears activeChallenge pointer + collapses UI
  view.onClose(async () => {
    try {
      await clearMyActiveChallenge();
      await activateFromPointer(null);
    } catch (e) {
      view.setFeedback(e?.message || t("challenge.error.generic"));
    }
  });

  // initial state
  view.setActiveChallenge(null);
  view.renderLeaderboard([]);
  setEndedUI(false);

  return view.element;
}
