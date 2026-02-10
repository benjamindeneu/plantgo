// src/controllers/ResultModal.controller.js
import { createResultModalView } from "../ui/components/ResultModal.view.js";
import { auth, db } from "../../firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { addObservationAndDiscovery } from "../data/observations.js";
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
      if (user) {
        const { discoveryBonus: got } = await addObservationAndDiscovery({
          userId: user.uid,
          speciesName,
          lat, lon,
          plantnetImageCode,
          plantnet_identify_score,
          gbif_id: identify?.gbif_id ?? null,
          pointsMap: detail, // detail keys already stable i18n keys
          total_points: baseTotal,
          extraBonus: missionHit ? 500 : 0,
        });
        discoveryBonus = got;
      }
      if (discoveryBonus > 0) badges.push({ kind: "new", emoji: "🆕", label: t("result.badge.newSpecies"), bonus: 500 });

      const finalTotal = baseTotal + badges.reduce((s, b) => s + (b.bonus || 0), 0);

      await view.showResultUI({
        speciesName,
        speciesVernacularName,
        plantnet_identify_score,
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
