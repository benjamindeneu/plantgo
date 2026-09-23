// src/controllers/ResultModal.controller.js
import { createResultModalView } from "../ui/components/ResultModal.view.js";
import { auth, db } from "../../firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { addObservationAndDiscovery } from "../data/observations.js";
import { checkAndAwardQuestCompletions, QUEST_BONUS } from "../data/dailyQuests.js";
import { checkAndUnlockBadges, BADGE_DEFINITIONS } from "../data/badges.js";
import { itemsUnlockedBy, itemNameKey, slotItems, AVATAR_SLOTS } from "../data/avatar.js";
import { addEventXp, activeEvent, tierToken } from "../data/events.js";
import { fetchDescription, fetchTrivia } from "../api/plantgo.js";
import { missionBonusFor } from "../data/missions.repo.js";
import { getMissionsDoneToday, markMissionDone } from "../data/missionsDone.js";
import { t } from "../language/i18n.js";

/**
 * Add this observation's points to the running event pass and turn any tier
 * it crossed into a card for the result modal, naming what the tier gave.
 * Cosmetics only: the pass never pays points, so the total shown is
 * unaffected by this and levels cannot be inflated by an event.
 */
async function awardEventPass(uid, points) {
  const event = activeEvent();
  if (!uid || !event) return [];
  let reached = [];
  try {
    reached = await addEventXp(uid, points);
  } catch (e) {
    console.error("[ResultModal] event XP failed:", e);
    return [];
  }
  return reached.map(({ tier }) => {
    const token = tierToken(event.id, tier);
    const items = AVATAR_SLOTS.flatMap((slot) =>
      slotItems(slot).filter((it) => it.requires === token).map((it) => t(itemNameKey(slot, it.id)))
    );
    return {
      kind: "achievement",
      emoji: event.emoji,
      label: t("events.pass.tierReached", { n: tier }),
      desc: items.length ? t("avatar.unlockNote", { item: items.join(", ") }) : t(event.nameKey),
    };
  });
}

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
      // The matched mission, not just whether there was one: what completing it
      // is worth depends on the grade it was given.
      const mission = await findMatchingMission(speciesName, identify?.gbif_id);
      timings.missionCheck = Math.round(performance.now() - tMission);

      // A mission pays once a day. It is redrawn overnight and can be
      // accomplished again on a later day, so this asks about today only.
      let missionAlreadyDone = false;
      if (user && mission?.id) {
        missionAlreadyDone = (await getMissionsDoneToday(user.uid)).has(mission.id);
      }
      const missionCounts = !!mission && !missionAlreadyDone;

      const missionBonus = missionCounts ? missionBonusFor(mission) : 0;
      const missionTier = mission?.grade?.tier || "common";

      const badges = [];
      if (missionCounts) {
        badges.push({
          kind: "mission",
          tier: missionTier,
          emoji: "🎯",
          // Named as well as coloured — with the bonus now varying by grade,
          // "Mission species +2000" without the grade reads as arbitrary.
          label: `${t("result.badge.missionAccomplished")} · ${t(`missions.card.${missionTier}`)}`,
          bonus: missionBonus,
        });
      }

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
          vernacularName: identify?.vernacularName || null,
          pointsMap: detail,
          total_points: baseTotal,
          extraBonus: missionBonus,
        });
        timings.saveObservation = Math.round(performance.now() - tObs);
        // Written after the observation lands, so a failed save cannot burn
        // the day's one shot at this mission.
        if (missionCounts) await markMissionDone(user.uid, mission.id);
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
        if (!def) continue;
        // A badge that also opens an outfit item says so on its card — the
        // one moment the player learns the wardrobe exists.
        const gear = itemsUnlockedBy(id).map(({ slot, item }) => t(itemNameKey(slot, item.id)));
        const desc = gear.length
          ? `${t(def.descKey)} · ${t("avatar.unlockNote", { item: gear.join(", ") })}`
          : t(def.descKey);
        badges.push({ kind: "achievement", emoji: def.emoji, label: t(def.nameKey), desc });
      }

      if (isNearbyDuplicate) {
        // No discovery badge — nearby duplicates cannot be new discoveries
        const badgeBonus = badges.reduce((s, b) => s + (b.bonus || 0), 0);
        const finalTotal = nearbyPoints + badgeBonus;
        badges.push(...await awardEventPass(user?.uid, finalTotal));
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
          debugData: { identify, mission, missionBonus, missionAlreadyDone, timings, serverTimings },
        });
        if (identify?.gbif_id) {
          fetchAndInject({ gbif_id: identify.gbif_id, name: speciesName, lang, trivia });
        }
        return;
      }

      if (discoveryBonus > 0) badges.push({ kind: "new", emoji: "🆕", label: t("result.badge.newSpecies"), bonus: 500 });

      const finalTotal = baseTotal + badges.reduce((s, b) => s + (b.bonus || 0), 0);
      badges.push(...await awardEventPass(user?.uid, finalTotal));

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
        debugData: { identify, mission, missionBonus, missionAlreadyDone, timings, serverTimings },
      });

      if (identify?.gbif_id) {
        fetchAndInject({ gbif_id: identify.gbif_id, name: speciesName, lang, trivia });
      }
    },
  };

  // Poll for description and trivia if not cached yet. Both endpoints are
  // async — cached-or-null immediately, generated in the background — so
  // both inject into the view the same way, without blocking result display.
  function fetchAndInject({ gbif_id, name, lang, trivia }) {
    view.startDescriptionLoading();
    pollDescription({ gbif_id, name, lang });

    if (!trivia) {
      view.startTriviaLoading();
      pollTrivia({ gbif_id, name, lang });
    }
  }

  async function pollDescription({ gbif_id, name, lang }) {
    const delays = [0, 3000, 5000, 8000, 12000]; // ~28 s total
    for (const delay of delays) {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      try {
        const res = await fetchDescription({ gbif_id, name, lang });
        if (res?.description) { view.injectDescription(res.description); return; }
      } catch { /* ignore, keep polling */ }
    }
    // All attempts exhausted — hide the spinner
    view.injectDescription(null);
  }

  async function pollTrivia({ gbif_id, name, lang }) {
    // Leading 0 like pollDescription — lets already-cached trivia (the
    // common case) come back on the next tick instead of after a fixed 3s.
    const delays = [0, 3000, 5000, 8000, 12000]; // ~28 s total
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

  /**
   * The mission this observation completes, or null.
   *
   * `missions_here` is what the map wrote for where the player is standing;
   * `missions_list` is the old home page's area cache, still read so an
   * observation made from that page keeps working. A match in the first wins,
   * since only those are missions the player is actually inside.
   */
  async function findMatchingMission(name, gbifId) {
    try {
      const user = auth.currentUser;
      if (!user) return null;
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.data() || {};

      // Prefer gbif_id — name strings often differ by author suffix
      // (e.g. "Rosa canina" vs "Rosa canina L.").
      const binomial = (str) => String(str || "").trim().toLowerCase().split(/\s+/).slice(0, 2).join(" ");
      const wanted = binomial(name);
      const matches = (m) => (gbifId != null && m?.gbif_id != null)
        ? Number(m.gbif_id) === Number(gbifId)
        : binomial(m?.name || m?.speciesName) === wanted;

      for (const list of [data.missions_here, data.missions_list]) {
        const hit = (list || []).find(matches);
        if (hit) return hit;
      }
      return null;
    } catch {
      return null;
    }
  }
}
