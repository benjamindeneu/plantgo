// src/controllers/MissionsPanel.controller.js
import { createMissionsPanelView } from "../ui/components/MissionsPanel.view.js";
import { getCurrentPosition } from "../data/geo.service.js";
import { maybeLoadCachedMissions, loadAndMaybePersistMissions } from "../data/missions.repo.js";
import { auth } from "../../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { t } from "../language/i18n.js";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const toDate = (ts) =>
  typeof ts?.toDate === "function" ? ts.toDate()
    : typeof ts?.seconds === "number" ? new Date(ts.seconds * 1000)
    : new Date(ts);

const isFresh = (ts, win = THREE_HOURS_MS) => {
  const d = toDate(ts);
  if (!d || Number.isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() < win;
};

export function MissionsPanel() {
  const view = createMissionsPanelView();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      view.setStatus(t("missions.status.loginRequired"));
      return;
    }
    try {
      const { missions, model, fromCache } = await maybeLoadCachedMissions(user.uid, isFresh);
      if (fromCache && missions.length) {
        view.renderMissions(missions, model);
        view.setStatus("");
      } else {
        // Keep list empty (it will show missions.empty in the list area)
        view.renderMissions([], "");
        view.setStatus(t("missions.empty.hint"));
      }
    } catch (e) {
      console.error("[MissionsPanel] Cache load error:", e);
      view.setStatus(t("missions.status.cacheError"));
    }
  });

  view.onLocate(async () => {
    view.renderMissions([], ""); // shows missions.empty (translated) + hides model line
    view.setStatus(t("missions.status.fetchingLocation"));

    try {
      const pos = await getCurrentPosition();
      view.setStatus(t("missions.status.loading"));

      const user = auth.currentUser;

      const { missions, model } = await loadAndMaybePersistMissions(
        user?.uid,
        { lat: pos.coords.latitude, lon: pos.coords.longitude }
      );

      view.renderMissions(missions, model);
      view.setStatus("");
    } catch (e) {
      console.error("[MissionsPanel] Locate/Fetch error:", e);
      view.setStatus(e?.message || t("missions.status.locateError"));
    }
  });

  return view.element;
}
