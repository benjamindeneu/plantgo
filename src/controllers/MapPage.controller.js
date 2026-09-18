// src/controllers/MapPage.controller.js
import { t } from "../language/i18n.js";
import { createMapPageView } from "../ui/components/MapPage.view.js";
import { MissionMapPanel } from "./MissionMap.controller.js";
import { IdentifyPanel } from "./IdentifyPanel.controller.js";
import { SpeciesRow } from "../ui/components/SpeciesRow.view.js";
import { SpeciesDetail } from "../ui/components/SpeciesDetail.view.js";
import { createChallengeScreenView, markFound } from "../ui/components/ChallengeScreen.view.js";
import { createInfoSheet } from "../ui/components/InfoSheet.view.js";
import { missionsAtPoint } from "../data/extent.geo.js";
import { distanceMeters, getCurrentPosition } from "../data/geo.service.js";
import { fetchPredictions, fetchMissionDetail, fetchAvailableModels } from "../api/plantgo.js";
import { watchActiveChallenge, isEnded, isSpeciesFound } from "../data/activeChallenge.js";
import { persistMissionsHere } from "../data/missions.repo.js";
import { watchMissionsDoneToday } from "../data/missionsDone.js";
import { QuestsChip } from "./QuestsChip.controller.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { auth } from "../../firebase-config.js";
import { clearMyActiveChallenge, settleChallenge } from "../data/challenges.js";
import { checkAndUnlockBadges, BADGE_DEFINITIONS } from "../data/badges.js";

// How far the player can walk before the "around me" predictions are about
// somewhere else. The model resolves at a few hundred metres.
const AROUND_STALE_M = 400;
// Close enough to read the marker, wide enough to still see where you are.
const AROUND_ZOOM = 17;

function uiLang() {
  return (document.documentElement.lang || "en").split("-")[0];
}

/**
 * The front page: the map, the sheet under it, and the camera.
 *
 * The two tabs answer different questions and so are loaded differently.
 * "Missions" is about where the player is standing, and its list is derived —
 * the map already holds every mission and its zone, so the list is a
 * point-in-polygon filter that reruns on every GPS fix and costs no request.
 * "Around you" is a reading taken at one point, so it is fetched, the pins come
 * off the map, and the map returns to the player.
 */
export function MapPage() {
  const view = createMapPageView();
  const map = MissionMapPanel();
  view.mapSlot.appendChild(map.element);

  let missions = [];
  let position = null;
  let missionsLoading = true;
  let aroundLoaded = false;
  let aroundLoading = false;
  let aroundSpecies = [];
  let aroundAt = null;   // where the predictions on screen were fetched
  // The model list is per-location and only fetched once a reading is taken;
  // asking for it before the around tab is opened would spend a request on a
  // control nobody has looked at.
  let aroundModelsLoaded = false;
  // Which list is on screen. A row fetches its own photo, so rebuilding the
  // list is not free — and this runs on every GPS fix. Only an actual change
  // to *which* missions are valid is worth a rebuild.
  let renderedKey = null;
  let detailToken = 0;
  let challengeState = null;
  let challengeTimer = null;
  // Missions accomplished today. Live, because an observation made from this
  // very page has to grey its row and pin out without a reload.
  let missionsDone = new Set();

  // --- the detail screen ---------------------------------------------------

  async function openSpecies(species) {
    // Whether the surface is spread over the whole map. Deliberately per-visit
    // and not remembered: it is a thing you switch on to look at this species,
    // not a setting, and a raster left painted over everything from three
    // species ago is not what the next pin is asking about.
    let fullRaster = false;

    const detail = SpeciesDetail(species, {
      onBack: () => view.showList(),
      rasterAvailable: map.hasRaster(species),
      rasterOn: fullRaster,
      onRasterToggle: (on) => { fullRaster = on; map.setRasterFull(on); },
    });
    view.showDetail(detail);
    // The map is the other half of this screen: it shows the zone you would
    // walk into and the surface it was cut from, and stays visible while you
    // read. That is the whole reason this is not a sheet over the map.
    map.showMission(species, { fullRaster });

    if (!species.id) return;
    const token = ++detailToken;
    try {
      const extra = await fetchMissionDetail({ id: species.id, lang: uiLang() });
      if (token !== detailToken || !detail.isConnected) return;
      if (!species.extent && extra?.extent) {
        map.showMission({ ...species, extent: extra.extent }, { fullRaster });
      }
      detail.setChance(extra?.metrics?.p_mean);
      detail.setDescription(extra?.description);
      detail.setTrivia(extra?.trivia);
    } catch (e) {
      if (token !== detailToken) return;
      console.error("[MapPage] mission detail failed:", e);
    }
  }

  view.onDetailBack(() => {
    detailToken++;            // abandon any detail response still in flight
    map.clearMission();
  });

  map.onOpen(openSpecies);
  map.onBackgroundClick(() => view.showList());

  // --- missions tab: derived from what the map already has ------------------

  function renderValid() {
    // While the first load is still out there is nothing to say yet, and a
    // "no missions here" that turns into a list a second later is worse than
    // a spinner. Same for having no fix: the answer depends on where you are.
    view.setMissionsLoading(missionsLoading);
    if (missionsLoading) return;

    const here = missionsAtPoint(missions, position?.lat, position?.lon);
    // Accomplishing one changes how its row is drawn, so which ones are done
    // belongs in the key — otherwise the list would keep showing a mission as
    // outstanding until the set of missions itself happened to change. Which
    // ones, not how many: a count would miss a swap at the midnight rollover.
    const key = `${position ? 1 : 0}|`
      + here.map((m) => {
          const id = m.id ?? `${m.gbif_id}:${m.lat}:${m.lon}`;
          return `${id}${m.id && missionsDone.has(m.id) ? "*" : ""}`;
        }).join(",");
    if (key === renderedKey) return;
    renderedKey = key;

    view.renderValidMissions(
      here.map((mission) => SpeciesRow(mission, {
        onClick: openSpecies,
        done: !!mission.id && missionsDone.has(mission.id),
      })),
      { locating: !position }
    );

    // Identification scores against this set, and it is computed here — the
    // page that knows both the zones and the player's position. Written only
    // when the set actually changes (the `renderedKey` guard above already
    // returned otherwise), not on every GPS fix.
    persistMissionsHere(auth.currentUser?.uid, here);
  }

  map.onLoading((on) => {
    missionsLoading = on;
    renderValid();
  });

  map.onMissions((all) => {
    missions = all;
    renderValid();
  });

  map.onPosition((pos) => {
    // Predictions are for a point. Walk far enough from the one they were
    // fetched at and they stop being about here, so the tab reloads next time
    // it is opened rather than showing yesterday's neighbourhood.
    if (aroundAt && distanceMeters(aroundAt, pos) > AROUND_STALE_M) aroundLoaded = false;
    position = pos;
    renderValid();
  });

  // --- around you: one reading, taken where the player stands ---------------

  async function loadAround() {
    if (aroundLoaded || aroundLoading) return;
    aroundLoading = true;
    view.setAroundLoading(true);
    try {
      const pos = position ?? await getCurrentPosition().then((p) => ({
        lat: p.coords.latitude, lon: p.coords.longitude,
      }));
      const selected = view.getAroundModel();
      const { predictions, model: usedModel } = await fetchPredictions({
        lat: pos.lat, lon: pos.lon, lang: uiLang(), model: selected,
      });
      // rank 0 is the model's best match.
      aroundSpecies = [...(predictions ?? [])].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
      aroundLoaded = true;
      aroundAt = pos;
      // What actually ran, which is not the selection when it was "Auto".
      view.setAroundModelUsed(aroundSpecies.length ? (usedModel ?? selected) : "");
      renderAround();
      loadAroundModels(pos);
    } catch (e) {
      console.error("[MapPage] around fetch failed:", e);
      aroundSpecies = [];
      view.setAroundModelUsed("");
      renderAround();
    } finally {
      aroundLoading = false;
      view.setAroundLoading(false);
    }
  }

  function renderAround() {
    view.renderAround(aroundSpecies.map((s) => SpeciesRow(s, { onClick: openSpecies })));
  }

  /** Which models this location offers. Fetched once, alongside the first list. */
  async function loadAroundModels(pos) {
    if (aroundModelsLoaded) return;
    aroundModelsLoaded = true;
    try {
      const data = await fetchAvailableModels({ lat: pos.lat, lon: pos.lon });
      view.setAroundModels({ models: data?.models ?? [], defaultModel: data?.default_model ?? null });
    } catch (e) {
      // The picker still offers "Auto", which is what it would have defaulted
      // to anyway, so a failure here costs a choice rather than the feature.
      aroundModelsLoaded = false;
      console.warn("[MapPage] model list failed:", e?.message || e);
    }
  }

  /** Throw the current reading away and take another. */
  function reloadAround() {
    if (aroundLoading) return;
    aroundLoaded = false;
    aroundAt = null;
    loadAround();
  }

  // --- daily quests --------------------------------------------------------

  // Map chrome rather than a header item: it belongs to this screen, and the
  // header is shared with every other page.
  const quests = QuestsChip();
  view.questsSlot.appendChild(quests);

  // --- missions accomplished today ----------------------------------------

  let stopMissionsDone = () => {};
  const stopDoneAuth = onAuthStateChanged(auth, (user) => {
    stopMissionsDone();
    if (!user) {
      missionsDone = new Set();
      map.setMissionsDone(missionsDone);
      renderedKey = null;
      renderValid();
      return;
    }
    stopMissionsDone = watchMissionsDoneToday(user.uid, (ids) => {
      missionsDone = ids;
      map.setMissionsDone(ids);
      renderValid();
    });
  });

  // The explainer covers the whole page, so it hangs off <body> rather than
  // the sheet it was opened from.
  view.onInfo((tab) => {
    const sheet = createInfoSheet(tab);
    if (sheet) document.body.appendChild(sheet);
  });

  view.onAroundRefresh(reloadAround);
  // A different model is a different answer to the same question, so the list
  // is refetched rather than left showing the previous model's.
  view.onAroundModelChange(() => reloadAround());

  // --- the challenge, when the player is in one ----------------------------

  // Mounted once and left in place; only its tab appears and disappears, so
  // switching to it never rebuilds the leaderboard or refetches the photos on
  // a hunt checklist.
  const challengeScreen = createChallengeScreenView({
    onClose: async () => {
      try {
        await clearMyActiveChallenge();
      } catch (e) {
        console.error("[MapPage] closing challenge failed:", e);
      }
    },
  });
  view.mountChallenge(challengeScreen.element);

  function challengeLabel(state) {
    if (!state?.challenge) return "";
    if (isEnded(state.challenge)) return `🏁 ${t("challenge.tab.ended")}`;
    if (!state.challenge.endAtMs) return `🏁 ${t("challenge.title")}`;
    const s = Math.max(0, Math.floor((state.challenge.endAtMs - Date.now()) / 1000));
    return `🏁 ${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  function challengeName(state) {
    return state?.challenge?.type === "species_hunt"
      ? t("challenge.speciesHunt.activeSubtitle")
      : t("challenge.active.subtitle");
  }

  function renderChecklist() {
    const { challenge, speciesList, foundSpecies, foundGbifIds } = challengeState ?? {};
    if (challenge?.type !== "species_hunt" || !speciesList?.length) {
      challengeScreen.setChecklist([], { found: 0, total: 0 });
      return;
    }
    // The same row the missions list uses, so a tap opens the same detail
    // screen instead of a second kind of species card.
    const rows = speciesList.map((sp) =>
      markFound(SpeciesRow(sp, { onClick: openSpecies }), sp, foundSpecies, foundGbifIds));
    const found = speciesList.filter((sp) => isSpeciesFound(sp, foundSpecies, foundGbifIds)).length;
    challengeScreen.setChecklist(rows, { found, total: speciesList.length });
  }

  // --- settling an ended challenge ---
  // The player's place, the points it pays and the record of it are written
  // the first time this page sees the challenge over with its standings in —
  // whether that is the moment the clock runs out or a later visit. Writing
  // is idempotent (see settleChallenge), so an extra attempt costs nothing.
  let settledFor = null;   // challenge id settled, or being settled, in this session
  async function maybeSettle() {
    const { challenge, rows, speciesList, foundSpecies, foundGbifIds, myUid } = challengeState ?? {};
    if (!challenge || !myUid || !isEnded(challenge) || !rows?.length) return;
    if (settledFor === challenge.id) return;
    if (!rows.some((r) => r.uid === myUid)) return;
    settledFor = challenge.id;
    try {
      const found = (speciesList || []).filter((sp) => isSpeciesFound(sp, foundSpecies, foundGbifIds)).length;
      const outcome = await settleChallenge({
        challengeId: challenge.id,
        code: challenge.code,
        type: challenge.type,
        rows,
        found,
        total: (speciesList || []).length,
      });
      if (!outcome) { settledFor = null; return; }
      let newBadges = [];
      if (outcome.settledNow) {
        try {
          const ids = await checkAndUnlockBadges(myUid, {
            challengesPlayed: outcome.challengesPlayed,
            challengesWon: outcome.challengesWon,
          });
          newBadges = ids
            .map((id) => BADGE_DEFINITIONS.find((b) => b.id === id))
            .filter(Boolean)
            .map((b) => ({ emoji: b.emoji, label: t(b.nameKey) }));
        } catch (e) {
          console.error("[MapPage] challenge badges failed:", e);
        }
      }
      if (challengeState?.challenge?.id === challenge.id) {
        challengeScreen.setResult({ ...outcome, newBadges });
      }
    } catch (e) {
      console.error("[MapPage] settling challenge failed:", e);
      settledFor = null;
    }
  }

  /** Repaints the tab's clock, and the screen's, once a second. */
  function tickChallenge() {
    if (!challengeState?.challenge) return;
    const ended = isEnded(challengeState.challenge);
    view.setChallengeTab({ label: challengeLabel(challengeState) });
    challengeScreen.tick(ended);
    if (ended) {
      if (challengeTimer) { clearInterval(challengeTimer); challengeTimer = null; }
      maybeSettle();
    }
  }

  const stopChallengeWatch = watchActiveChallenge((state) => {
    challengeState = state;

    if (challengeTimer) { clearInterval(challengeTimer); challengeTimer = null; }

    if (!state.challenge) {
      view.setChallengeTab({ visible: false });
      return;
    }

    const ended = isEnded(state.challenge);
    challengeScreen.setMyUid(state.myUid);
    challengeScreen.setChallenge(state.challenge, { isEnded: ended });
    challengeScreen.setLeaderboard(state.rows);
    renderChecklist();
    if (ended) maybeSettle();

    view.setChallengeTab({
      visible: true,
      label: challengeLabel(state),
      title: challengeName(state),
    });

    // Deliberately does not switch to the tab. A challenge that was already
    // running when the page opened should not take the map away from the
    // player; joining one is an explicit act and jumps there via
    // `showChallenge()` instead.
    if (!ended) challengeTimer = setInterval(tickChallenge, 1000);
  });

  view.onTabSwitch((tab) => {
    const isAround = tab === "around";
    // Pins are places to walk to; this tab is a reading taken where you are.
    // They would answer a question nobody asked and cover the one marker that
    // matters, so they come off and the map goes back to the player.
    map.setPinsVisible(!isAround);
    map.clearMission();
    if (isAround) {
      map.recenterOnUser(AROUND_ZOOM);
      loadAround();
    }
  });

  view.onResize(() => map.invalidate());

  // --- the camera ----------------------------------------------------------

  // One panel, kept across observations: it owns the file input the camera is
  // opened through, and rebuilding it per shot would lose that handle.
  const identify = IdentifyPanel({
    onFilesChange: (files) => {
      // The camera is opened first and the sheet follows the photo, so a
      // cancelled shot leaves the map exactly as it was.
      if (files.length) view.openObserveSheet();
      else view.closeObserveSheet();
    },
    onSubmit: () => view.closeObserveSheet(),
  });
  view.observeSlot.appendChild(identify);

  view.onObserve(() => identify.openPicker());
  // Dismissing the sheet abandons the shot. Keeping the photos would mean the
  // next "make an observation" quietly reopened with the old one attached.
  view.onObserveSheetClose(() => identify.clearPhotos());

  document.addEventListener("i18n:changed", () => {
    view.refreshI18n();
    challengeScreen.refreshI18n();
    renderedKey = null; // the rows themselves are language-dependent
    renderValid();
    renderAround();
    renderChecklist();
    if (challengeState?.challenge) {
      view.setChallengeTab({
        label: challengeLabel(challengeState),
        title: challengeName(challengeState),
      });
    }
  });

  renderValid();

  return {
    element: view.element,
    /** Jump to the challenge screen — called when the player joins or creates one. */
    showChallenge: () => view.setActiveTab("challenge"),
    start: () => map.start(),
    invalidate: () => map.invalidate(),
    stop: () => {
      if (challengeTimer) { clearInterval(challengeTimer); challengeTimer = null; }
      stopChallengeWatch();
      quests.stop();
      stopDoneAuth();
      stopMissionsDone();
      map.stop();
    },
  };
}
