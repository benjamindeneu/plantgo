// src/controllers/ResultModal.controller.js
import { createResultModalView } from "../ui/components/ResultModal.view.js";
import { auth, db } from "../../firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { addObservationAndDiscovery } from "../data/observations.js";
import { checkAndAwardQuestCompletions, QUEST_BONUS } from "../data/dailyQuests.js";
import { checkAndUnlockBadges, BADGE_DEFINITIONS } from "../data/badges.js";
import { fetchDescription, fetchTrivia } from "../api/plantgo.js";
import { t } from "../language/i18n.js";

export function ResultModal() {
  const view = createResultModalView();

  return {
    el: view.el,

    showError(message) {
      view.showError(message);
    },

    async initLoading({ photos, currentTotalPoints }) {
      await view.initLoading({ photos, currentTotalPoints });
    },

    async showResult({ identify, points, trivia = null, lat, lon, plantnetImageCode, clientTimings = {}, timings: serverTimings = null }) {
      const timings = clientTimings;
      const speciesName = identify?.name || t("result.unknownSpecies");
      const speciesVernacularName = identify?.vernacularName || t("result.noCommonName");
      const baseTotal = Number(points?.total ?? 0);
      const plantnet_identify_score = Number(identify?.score ?? 0);
      const detail = (points?.detail && typeof points.detail === "object") ? points.detail : {};

      const lang = document.documentElement.lang || "en";

      // Low confidence — show tentative result, do not save observation
      if (plantnet_identify_score < 0.2) {
        await view.showLowConfidenceUI({ speciesName, speciesVernacularName, speciesScore: plantnet_identify_score });
        return;
      }

      const user = auth.currentUser;
      let currentTotalBefore = 0;
      if (user) {
        try {
          const ref = doc(db, "users", user.uid);
          const snap = await getDoc(ref);
          currentTotalBefore = Number(snap.data()?.total_points ?? 0);
        } catch { /* noop */ }
      }

      const tMission = performance.now();
      const missionHit = await isInMissionsList(speciesName, identify?.gbif_id);
      timings.missionCheck = Math.round(performance.now() - tMission);

      const badges = [];
      if (missionHit) badges.push({ kind: "mission", emoji: "🎯", label: t("result.badge.missionSpecies"), bonus: 500 });

      let discoveryBonus = 0;
      let isNearbyDuplicate = false;
      let nearbyPoints = 0;
      let obsResult = {};
      if (user) {
        const tObs = performance.now();
        obsResult = await addObservationAndDiscovery({
          userId: user.uid,
          speciesName,
          lat, lon,
          plantnetImageCode,
          plantnet_identify_score,
          gbif_id: identify?.gbif_id ?? null,
          pointsMap: detail,
          total_points: baseTotal,
          extraBonus: missionHit ? 500 : 0,
        });
        timings.saveObservation = Math.round(performance.now() - tObs);
        discoveryBonus = obsResult.discoveryBonus;
        isNearbyDuplicate = obsResult.isNearbyDuplicate;
        nearbyPoints = obsResult.nearbyPoints ?? 0;
      }

      // Check if this observation completed any daily quests (+ relevé / perfect day badges)
      let completedQuestIds = [], questBadges = [];
      if (user) {
        const tQuests = performance.now();
        try {
          ({ completedQuestIds, newlyUnlockedBadges: questBadges } = await checkAndAwardQuestCompletions(user.uid));
        } catch (e) {
          console.error("[ResultModal] checkAndAwardQuestCompletions failed:", e);
        }
        timings.quests = Math.round(performance.now() - tQuests);
      }
      for (const _ of completedQuestIds) {
        badges.push({ kind: "quest", emoji: "🏆", label: t("result.badge.questComplete"), bonus: QUEST_BONUS });
      }

      // Estimate new total points for level badge check
      const missionBonus = missionHit ? 500 : 0;
      const questBonus = completedQuestIds.length * QUEST_BONUS;
      const estimatedNewTotal = currentTotalBefore + baseTotal + discoveryBonus + missionBonus + questBonus;
      const newLevel = Math.floor(1 + estimatedNewTotal / 11000);

      // Check all achievement badges
      let achievementBadgeIds = [];
      if (user) {
        try {
          achievementBadgeIds = await checkAndUnlockBadges(user.uid, {
            obsCount:         obsResult.obsCount         ?? 0,
            missionObsCount:  obsResult.missionObsCount  ?? 0,
            discoveriesCount: obsResult.discoveriesCount ?? 0,
            hasEpicObs:       obsResult.hasEpicObs       ?? false,
            hasLegendaryObs:  obsResult.hasLegendaryObs  ?? false,
            level:            newLevel,
          });
        } catch (e) {
          console.error("[ResultModal] checkAndUnlockBadges failed:", e);
        }
      }

      // Merge all newly unlocked achievement badges (from obs + quests)
      const allNewBadgeIds = [...new Set([...achievementBadgeIds, ...questBadges])];
      for (const id of allNewBadgeIds) {
        const def = BADGE_DEFINITIONS.find((b) => b.id === id);
        if (def) badges.push({ kind: "achievement", emoji: def.emoji, label: t(def.nameKey), desc: t(def.descKey) });
      }

      if (isNearbyDuplicate) {
        // No discovery badge — nearby duplicates cannot be new discoveries
        const missionBonus = badges.reduce((s, b) => s + (b.bonus || 0), 0);
        const finalTotal = nearbyPoints + missionBonus;
        await view.showResultUI({
          speciesName,
          speciesVernacularName,
          speciesScore: plantnet_identify_score,
          baseTotal: nearbyPoints,
          detail,
          badges,
          currentTotalBefore,
          finalTotal,
          isNearbyDuplicate: true,
          trivia,
          debugData: { identify, missionHit, timings, serverTimings },
        });
        if (identify?.gbif_id) {
          fetchAndInject({ gbif_id: identify.gbif_id, name: speciesName, lang, trivia });
        }
        return;
      }

      if (discoveryBonus > 0) badges.push({ kind: "new", emoji: "🆕", label: t("result.badge.newSpecies"), bonus: 500 });

      const finalTotal = baseTotal + badges.reduce((s, b) => s + (b.bonus || 0), 0);

      await view.showResultUI({
        speciesName,
        speciesVernacularName,
        speciesScore: plantnet_identify_score,
        baseTotal,
        detail,
        badges,
        currentTotalBefore,
        finalTotal,
        trivia,
        debugData: { identify, missionHit, timings, serverTimings },
      });

      if (identify?.gbif_id) {
        fetchAndInject({ gbif_id: identify.gbif_id, name: speciesName, lang, trivia });
      }
    },
  };

  // Fire description fetch immediately; poll for trivia if not cached yet.
  // Both inject into the view asynchronously without blocking result display.
  function fetchAndInject({ gbif_id, name, lang, trivia }) {
    view.startDescriptionLoading();
    fetchDescription({ gbif_id, name, lang })
      .then((res) => view.injectDescription(res?.description ?? null))
      .catch(() => view.injectDescription(null));

    if (!trivia) {
      view.startTriviaLoading();
      pollTrivia({ gbif_id, name, lang });
    }
  }

  async function pollTrivia({ gbif_id, name, lang }) {
    const delays = [3000, 5000, 8000, 12000]; // ~28 s total
    for (const delay of delays) {
      await new Promise((r) => setTimeout(r, delay));
      try {
        const res = await fetchTrivia({ gbif_id, name, lang });
        if (res?.trivia) { view.injectTrivia(res.trivia); return; }
      } catch { /* ignore, keep polling */ }
    }
    // All attempts exhausted — hide the spinner
    view.injectTrivia(null);
  }

  async function isInMissionsList(name, gbifId) {
    try {
      const user = auth.currentUser;
      if (!user) return false;
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      const list = snap.data()?.missions_list || [];
      // Prefer gbif_id comparison — name strings often differ by author suffix (e.g. "Rosa canina" vs "Rosa canina L.")
      if (gbifId != null) {
        return list.some((m) => Number(m?.gbif_id) === Number(gbifId));
      }
      // Fallback: compare first two words of scientific name (genus + species, strip author)
      const binomial = (str) => str.trim().toLowerCase().split(/\s+/).slice(0, 2).join(" ");
      return list.some((m) => binomial(m?.name || m?.speciesName || "") === binomial(name));
    } catch {
      return false;
    }
  }
}
