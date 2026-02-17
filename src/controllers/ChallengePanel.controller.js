// src/controllers/ChallengePanel.controller.js
import { createChallengePanelView } from "../ui/components/ChallengePanel.view.js";
import { t } from "../language/i18n.js";
import {
  createChallenge,
  joinChallengeByCode,
  subscribeLeaderboard,
} from "../data/challenges.js";

export function ChallengePanel() {
  const view = createChallengePanelView();

  let unsub = null;
  let timer = null;
  let endAtMs = null;

  function cleanupLive() {
    if (unsub) { unsub(); unsub = null; }
    if (timer) { clearInterval(timer); timer = null; }
  }

  function startCountdown() {
    if (!endAtMs) return;
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      view.setTimeLeft(endAtMs);
      if (Date.now() >= endAtMs) {
        clearInterval(timer);
        timer = null;
      }
    }, 1000);
  }

  async function activate({ challengeId, code, endAt }) {
    endAtMs = endAt?.toMillis ? endAt.toMillis() : null;
    view.setActiveChallenge({ code, endsAtMs: endAtMs });
    view.renderLeaderboard([]);

    cleanupLive();
    unsub = subscribeLeaderboard(challengeId, (rows) => view.renderLeaderboard(rows));
    startCountdown();
  }

  view.onCreate(async ({ durationSec }) => {
    try {
      view.setFeedback("");
      view.setCreateStatus(t("challenge.creating"));

      const res = await createChallenge({ durationSec });

      view.setCreateStatus(`${t("challenge.created")} ${res.code}`);
      await activate({ challengeId: res.challengeId, code: res.code, endAt: res.endAt });
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
      await activate({ challengeId: res.challengeId, code: res.code, endAt: res.endAt });
    } catch (e) {
      view.setJoinStatus("");
      view.setFeedback(e?.message || t("challenge.error.generic"));
    }
  });

  view.setActiveChallenge(null);
  view.renderLeaderboard([]);
  return view.element;
}
