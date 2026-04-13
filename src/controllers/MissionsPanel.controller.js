// src/controllers/MissionsPanel.controller.js
import { createMissionsPanelView } from "../ui/components/MissionsPanel.view.js";
import { getCurrentPosition } from "../data/geo.service.js";
import { maybeLoadCachedMissions, loadAndMaybePersistMissions } from "../data/missions.repo.js";
import { fetchAvailableModels, fetchPredictions } from "../api/plantgo.js";
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

  let lastPos = null;
  // track whether each tab has already been loaded for the current position
  let aroundLoaded = false;

  view.onSettingsOpen(async () => {
    if (!lastPos) {
      try { lastPos = await getCurrentPosition(); }
      catch (_) { return null; }
    }
    return fetchAvailableModels({ lat: lastPos.coords.latitude, lon: lastPos.coords.longitude });
  });

  async function doLocateMissions() {
    view.renderMissions([], "");
    view.setStatus(t("missions.status.fetchingLocation"));
    view.setLoading(true);

    try {
      const pos = await getCurrentPosition();
      lastPos = pos;
      aroundLoaded = false;
      missionsLoaded = false;
      view.setLocation(pos.coords.latitude, pos.coords.longitude);
      view.setStatus(t("missions.status.loading"));

      const user = auth.currentUser;
      const selectedModel = view.getSelectedModel();

      const { missions, model } = await loadAndMaybePersistMissions(
        user?.uid,
        { lat: pos.coords.latitude, lon: pos.coords.longitude },
        [],
        selectedModel
      );

      missionsLoaded = true;
      view.setLoading(false);
      view.renderMissions(missions, model);
      view.setStatus("");
    } catch (e) {
      console.error("[MissionsPanel] Locate/Fetch error:", e);
      view.setLoading(false);
      view.setStatus(e?.message || t("missions.status.locateError"));
    }
  }

  async function doLoadAround() {
    if (aroundLoaded) return;

    view.renderAround([]);
    view.setStatus(t("missions.status.fetchingLocation"));
    view.setLoading(true);

    try {
      if (!lastPos) lastPos = await getCurrentPosition();
      view.setLocation(lastPos.coords.latitude, lastPos.coords.longitude);
      view.setStatus(t("missions.status.loadingAround"));

      const selectedModel = view.getSelectedModel();
      const lang = document.documentElement.lang?.split("-")[0] || "en";

      const { predictions } = await fetchPredictions({
        lat: lastPos.coords.latitude,
        lon: lastPos.coords.longitude,
        model: selectedModel,
        lang,
      });

      aroundLoaded = true;
      view.setLoading(false);
      // Sort by rank ascending (rank 0 = best match)
      const sorted = [...(predictions ?? [])].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
      view.renderAround(sorted);
      view.setStatus("");
    } catch (e) {
      console.error("[MissionsPanel] Around fetch error:", e);
      view.setLoading(false);
      view.setStatus(e?.message || t("missions.status.locateError"));
    }
  }

  let missionsLoaded = false;

  // When user switches tab, load lazily
  view.onTabSwitch((tab) => {
    if (tab === "around" && !aroundLoaded) doLoadAround();
    if (tab === "missions" && !missionsLoaded) doLocateMissions();
  });

  // Refresh button: reload whichever tab is active
  view.onLocate(() => {
    if (view.getActiveTab() === "around") {
      aroundLoaded = false;
      doLoadAround();
    } else {
      missionsLoaded = false;
      doLocateMissions();
    }
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      view.setStatus(t("missions.status.loginRequired"));
      return;
    }
    // Default tab is "around" — load predictions immediately
    doLoadAround();
    // Pre-load missions from cache silently into the background tab
    try {
      const { missions, model, fromCache } = await maybeLoadCachedMissions(user.uid, isFresh);
      if (fromCache && missions.length) {
        missionsLoaded = true;
        view.renderMissions(missions, model);
      }
    } catch (e) {
      console.error("[MissionsPanel] Cache load error:", e);
    }
  });

  return view.element;
}
