// src/controllers/ResultModal.controller.js
import { createResultModalView } from "../ui/components/ResultModal.view.js";
import { auth, db } from "../../firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { addObservationAndDiscovery } from "../data/observations.js";
import { checkAndAwardQuestCompletions, QUEST_BONUS } from "../data/dailyQuests.js";
import { checkAndUnlockBadges, BADGE_DEFINITIONS } from "../data/badges.js";
import { t } from "../language/i18n.js";

export function ResultModal() {
  const view = createResultModalView();

  return {
    el: view.el,

    async initLoading({ photos, currentTotalPoints }) {
      await view.initLoading({ photos, currentTotalPoints });
    },

    async showResult({ identify, points, lat, lon, plantnetImageCode }) {
      const speciesName = identify?.name || t("result.unknownSpecies");
      const speciesVernacularName = identify?.vernacularName || t("result.noCommonName");
      const baseTotal = Number(points?.total ?? 0);
      const plantnet_identify_score = Number(identify?.score ?? 0);
      const detail = (points?.detail && typeof points.detail === "object") ? points.detail : {};

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

      const missionHit = await isInMissionsList(speciesName);
      const badges = [];
      if (missionHit) badges.push({ kind: "mission", emoji: "🎯", label: t("result.badge.missionSpecies"), bonus: 500 });

      let discoveryBonus = 0;
      let isNearbyDuplicate = false;
      let nearbyPoints = 0;
      let obsResult = {};
      if (user) {
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
        discoveryBonus = obsResult.discoveryBonus;
        isNearbyDuplicate = obsResult.isNearbyDuplicate;
        nearbyPoints = obsResult.nearbyPoints ?? 0;
      }

      // Check if this observation completed any daily quests (+ relevé / perfect day badges)
      const { completedQuestIds, newlyUnlockedBadges: questBadges } = await checkAndAwardQuestCompletions(user.uid);
      for (const _ of completedQuestIds) {
        badges.push({ kind: "quest", emoji: "🏆", label: t("result.badge.questComplete"), bonus: QUEST_BONUS });
      }

      // Estimate new total points for level badge check
      const missionBonus = missionHit ? 500 : 0;
      const questBonus = completedQuestIds.length * QUEST_BONUS;
      const estimatedNewTotal = currentTotalBefore + baseTotal + discoveryBonus + missionBonus + questBonus;
      const newLevel = Math.floor(1 + estimatedNewTotal / 11000);

      // Check all achievement badges
      const achievementBadgeIds = await checkAndUnlockBadges(user.uid, {
        obsCount:         obsResult.obsCount         ?? 0,
        missionObsCount:  obsResult.missionObsCount  ?? 0,
        discoveriesCount: obsResult.discoveriesCount ?? 0,
        hasEpicObs:       obsResult.hasEpicObs       ?? false,
        hasLegendaryObs:  obsResult.hasLegendaryObs  ?? false,
        level:            newLevel,
      });

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
        });
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
      });
    },
  };

  async function isInMissionsList(name) {
    try {
      const user = auth.currentUser;
      if (!user) return false;
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      const list = snap.data()?.missions_list || [];
      return list.some((m) => (m?.name || m?.speciesName || "").toLowerCase() === name.toLowerCase());
    } catch {
      return false;
    }
  }
}
