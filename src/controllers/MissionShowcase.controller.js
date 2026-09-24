// src/controllers/MissionShowcase.controller.js
import { t } from "../language/i18n.js";
import { createMissionShowcaseView } from "../ui/components/MissionShowcase.view.js";
import { createMissionMapView } from "../ui/components/MissionMap.view.js";
import { createIdentifyPanelView } from "../ui/components/IdentifyPanel.view.js";
import { createResultModalView } from "../ui/components/ResultModal.view.js";
import { SpeciesDetail } from "../ui/components/SpeciesDetail.view.js";
import { fetchMissionById, identifyPlant, resizeImage, missionRasterTileUrl } from "../api/plantgo.js";
import { getCurrentPosition, watchPosition, distanceMeters } from "../data/geo.service.js";
import { pointInExtent } from "../data/extent.geo.js";
import { missionBonusFor } from "../data/missionBonus.js";
import { stashPendingObservation } from "../data/pendingObservation.js";

// Below this Pl@ntNet is guessing, and the app does not score it either.
const MIN_SCORE = 0.2;

function uiLang() {
  return (document.documentElement.lang || "en").split("-")[0];
}

function binomial(name) {
  return String(name || "").trim().toLowerCase().split(/\s+/).slice(0, 2).join(" ");
}

/** Is the identified plant the one the mission asks for? GBIF id first, as the app does. */
function isMissionSpecies(mission, identify) {
  if (mission?.gbif_id != null && identify?.gbif_id != null) {
    return Number(mission.gbif_id) === Number(identify.gbif_id);
  }
  return !!identify?.name && binomial(identify.name) === binomial(mission?.name);
}

function formatDistance(m) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

/**
 * One mission, shown to someone who has no account yet.
 *
 * Opened from a link or a QR code (`mission.html?id=<mission id>`). It is the
 * app's own mission screen and camera, so what a visitor tries here is what
 * they would get after joining. The result is judged against this one
 * mission: the right plant shows its points and says what the observation is
 * worth to science, anything else says so and shows none. Nothing is saved to
 * an account — there is none — but the observation is kept in the browser and
 * filed under the visitor's name if they sign up (see pendingObservation.js).
 */
export function MissionShowcase({ missionId }) {
  const view = createMissionShowcaseView();
  const map = createMissionMapView();
  view.mapSlot.appendChild(map.element);
  map.refreshI18n();

  let mission = null;
  let userPos = null;
  let stopWatch = () => {};

  // --- the mission ----------------------------------------------------------

  async function load() {
    if (!missionId) { view.showMissing(); return; }
    try {
      mission = await fetchMissionById({ id: missionId, lang: uiLang() });
    } catch (e) {
      console.error("[MissionShowcase] mission load failed:", e);
      // Only the backend's own verdict means the mission is gone. Anything
      // else — the server down, or an old one without this route (whose 404
      // is an HTML page, not our JSON) — is worth another try, not a goodbye.
      const gone = /^\[(400|404)\]/.test(e?.message || "")
        && /"error":\s*"(unknown mission|invalid mission id)"/.test(e.message);
      if (gone) view.showMissing();
      else view.showLoadFailed(load);
      return;
    }
    render();
    followUser();
  }

  function render() {
    let fullRaster = false;
    const rasterUrl = missionRasterTileUrl(mission.id);
    const detail = SpeciesDetail(mission, {
      rasterAvailable: !!rasterUrl,
      rasterOn: fullRaster,
      onRasterToggle: (on) => {
        fullRaster = on;
        map.showRaster(rasterUrl, on ? null : (mission.extent || null));
      },
    });
    view.showMission(detail);

    // The map is built on the mission, not on the visitor: the page is about
    // that patch of ground, wherever they happen to be reading it from.
    map.recenter(mission.lat, mission.lon);
    map.renderPins([mission]);
    map.selectMission(mission);
    if (rasterUrl) map.showRaster(rasterUrl, mission.extent || null);
    if (mission.extent) map.showExtent(mission.extent);
    else map.showFallbackRadius(mission.lat, mission.lon);
    updateStatus();
  }

  // --- where the visitor is, relative to the zone ---------------------------

  function updateStatus() {
    if (!mission || !userPos) return;
    if (mission.extent && pointInExtent(mission.extent, userPos.lat, userPos.lon)) {
      map.setStatus(t("showcase.status.inside"));
    } else {
      map.setStatus(t("showcase.status.away", { distance: formatDistance(distanceMeters(userPos, mission)) }));
    }
  }

  function setPosition(pos) {
    userPos = pos;
    map.setUserLocation(pos.lat, pos.lon);
    updateStatus();
  }

  // Location is a nice-to-have here — the map is centred on the mission — so
  // a refusal costs the "you are here" dot and nothing else until a photo is
  // taken, which does need it.
  function followUser() {
    stopWatch();
    stopWatch = watchPosition(setPosition, {
      onError: (e) => console.warn("[MissionShowcase] position watch:", e?.message || e),
    });
  }

  map.onPinClick(() => { if (mission?.extent) map.showExtent(mission.extent); });
  map.onLocate(() => {
    if (userPos) map.recenter(userPos.lat, userPos.lon);
    else if (mission) map.recenter(mission.lat, mission.lon);
    getCurrentPosition()
      .then((p) => {
        setPosition({ lat: p.coords.latitude, lon: p.coords.longitude });
        map.recenter(userPos.lat, userPos.lon);
      })
      .catch(() => {});
  });

  // --- the camera -----------------------------------------------------------

  const identify = createIdentifyPanelView();
  let chosen = [];
  identify.onFilesChange((files) => {
    chosen = files;
    if (files.length) view.openObserveSheet();
    else view.closeObserveSheet();
  });
  identify.onClear(() => { chosen = []; identify.setFeedback(""); view.closeObserveSheet(); });
  identify.onIdentify((picked) => {
    const files = picked?.length ? picked : chosen.slice();
    if (!files.length) return identify.setFeedback(t("identify.feedback.addOnePhoto"));
    view.closeObserveSheet();
    runIdentification(files);
  });
  view.observeSlot.appendChild(identify.element);

  view.onObserve(() => identify.openPicker());
  view.onObserveSheetClose(() => {
    chosen = [];
    identify.clear();
    identify.setFeedback("");
  });

  async function runIdentification(files) {
    const modal = createResultModalView({ showLevel: false });
    document.body.appendChild(modal.el);
    await modal.initLoading({ photos: files.map((f) => URL.createObjectURL(f)) });

    let lat, lon;
    try {
      const pos = await getCurrentPosition();
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } catch {
      modal.showError(t("identify.feedback.locationDenied"));
      return;
    }

    let result;
    try {
      const { file } = await resizeImage(files[0]);
      result = await identifyPlant({ file, lat, lon, model: "best", lang: uiLang(), skipResize: true });
    } catch (e) {
      modal.showError(e?.message || t("identify.feedback.failed"));
      return;
    }

    const found = result?.identify || {};
    const speciesName = found.name || t("result.unknownSpecies");
    const speciesVernacularName = found.vernacularName || t("result.noCommonName");
    const score = Number(found.score ?? 0);

    if (score < MIN_SCORE) {
      await modal.showLowConfidenceUI({ speciesName, speciesVernacularName, speciesScore: score });
      return;
    }

    const matched = isMissionSpecies(mission, found);
    const baseTotal = Number(result?.points?.total ?? 0);
    const detail = (result?.points?.detail && typeof result.points.detail === "object") ? result.points.detail : {};
    const missionBonus = matched ? missionBonusFor(mission) : 0;
    const tier = mission?.grade?.tier || "common";

    // Kept for the visitor's account, if they make one. A wrong plant is
    // still a real observation — it just earns no mission.
    const raw = found.raw || null;
    stashPendingObservation({
      speciesName,
      vernacularName: found.vernacularName || null,
      lat, lon,
      plantnetImageCode: raw?.images?.[0]?.id || raw?.imageCode || raw?.image?.id || "",
      score,
      gbif_id: found.gbif_id ?? null,
      pointsMap: detail,
      basePoints: baseTotal,
      missionId: matched ? mission.id : null,
      missionBonus,
    });

    const missionName = mission.vernacular_name || mission.name;

    if (!matched) {
      await modal.showNoPointsUI({
        speciesName, speciesVernacularName, speciesScore: score,
        title: t("showcase.result.miss.title"),
        message: t("showcase.result.miss.body", { species: found.vernacularName || speciesName, mission: missionName }),
      });
      modal.appendOutro(outro({ found: false }));
      return;
    }

    const badges = [{
      kind: "mission",
      tier,
      emoji: "🎯",
      label: `${t("result.badge.missionAccomplished")} · ${t(`missions.card.${tier}`)}`,
      bonus: missionBonus,
    }];
    await modal.showResultUI({
      speciesName,
      speciesVernacularName,
      speciesScore: score,
      baseTotal,
      detail,
      badges,
      currentTotalBefore: 0,
      finalTotal: baseTotal + missionBonus,
    });
    modal.appendOutro(outro({ found: true, species: missionName }));
  }

  /** What the result ends on: what just happened, and the way in. */
  function outro({ found, species = "" }) {
    const box = document.createElement("div");
    box.className = `sc-outro ${found ? "sc-outro--found" : ""}`;
    box.innerHTML = `
      ${found ? `<p class="sc-outro__title"></p><p class="sc-outro__text sc-outro__science"></p>` : ""}
      <p class="sc-outro__text sc-outro__join"></p>
      <a class="sc-cta" href="./signup.html"></a>
      <a class="sc-outro__alt" href="./login.html"></a>
    `;
    if (found) {
      box.querySelector(".sc-outro__title").textContent = t("showcase.result.found.title");
      box.querySelector(".sc-outro__science").textContent = t("showcase.result.found.body", { species });
    }
    box.querySelector(".sc-outro__join").textContent =
      t(found ? "showcase.result.join.found" : "showcase.result.join.miss");
    box.querySelector(".sc-cta").textContent =
      t(found ? "showcase.result.join.ctaSave" : "showcase.result.join.cta");
    box.querySelector(".sc-outro__alt").textContent = t("showcase.result.login");
    return box;
  }

  view.onResize(() => map.invalidate());

  document.addEventListener("i18n:changed", () => {
    view.refreshI18n();
    map.refreshI18n();
    updateStatus();
  });

  return {
    element: view.element,
    start: load,
    invalidate: () => map.invalidate(),
    stop: () => { stopWatch(); stopWatch = () => {}; },
  };
}
