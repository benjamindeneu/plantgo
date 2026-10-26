// src/controllers/MissionMap.controller.js
import { createMissionMapView } from "../ui/components/MissionMap.view.js";
import { distanceMeters, getCurrentPosition, watchPosition } from "../data/geo.service.js";
import { fetchMapMissions, rasterTileUrl } from "../api/plantgo.js";
import { rasterChoice } from "../data/rasterChoice.js";
import { t } from "../language/i18n.js";

const MOVE_DEBOUNCE_MS = 500;
// Below this zoom a viewport covers more ground than a walk, so pins would be
// meaningless — the map asks the user to zoom in instead of fetching.
const MIN_FETCH_ZOOM = 13;
// How many missions — zones included — are kept in memory across a session.
const MAX_KNOWN_MISSIONS = 600;
// How far the map has to travel before it is worth asking about new ground.
// Both a share of what is already covered and a hard floor: at street zoom a
// third of the viewport is barely two blocks, and refetching that often is
// what made ordinary panning feel like the page reloading under you.
const REFETCH_FRACTION = 0.7;
const REFETCH_FLOOR_M = 450;

function uiLang() {
  return (document.documentElement.lang || "en").split("-")[0];
}

/**
 * The mission map. `missions: false` leaves the pins out entirely — no fetch,
 * no status about them — for a page that only paints one species' surface
 * at a time (the species page). `zoom` is how close the first fix frames the
 * player; the map's own default when left out.
 */
export function MissionMapPanel({ missions: withMissions = true, zoom } = {}) {
  const view = createMissionMapView();
  view.refreshI18n();

  let userPos = null;
  let moveTimer = null;
  let inFlight = null;
  let stopWatch = () => {};
  // Centre of the last successful fetch. Refetching is gated on real distance
  // rather than rounded coordinates, so a real walk still brings in missions.
  let lastFetchAt = null;
  // Centre of the request currently out. The gate has to know about it as well
  // as about the last one that landed: a cold viewport can take half a minute,
  // and gating on `lastFetchAt` alone meant every event in that window started
  // a fresh request, which abandoned the one before it — so `lastFetchAt` was
  // never set, and the map reloaded for as long as anything nudged it.
  let pendingAt = null;
  // Only the very first load is worth a spinner in the page's sheet. Later
  // fetches are about ground the player is looking at, not the ground they are
  // standing on, so the list they are reading must not be torn down for them.
  let everLoaded = false;

  // Every mission the map has seen this session, keyed the same way the pins
  // are. The sheet below the map answers "which of these am I standing in",
  // and that question is about everywhere the player has looked — not only
  // whatever the last response happened to contain.
  const knownMissions = new Map();

  const listeners = { loading: [], missions: [], position: [], open: [], raster: [] };
  const emit = (name, value) => { for (const cb of listeners[name]) cb(value); };

  function missionKey(mission) {
    return mission.id || `${mission.gbif_id}:${mission.lat}:${mission.lon}`;
  }

  async function loadMissions(vp, { force = false } = {}) {
    if (!withMissions) { view.setStatus(""); return; }
    if (!vp) return;
    if (vp.zoom < MIN_FETCH_ZOOM) {
      view.setStatus(t("map.status.zoomIn"));
      return;
    }
    // Measured against whatever is most recently claimed for this ground, in
    // flight or landed.
    const covered = pendingAt ?? lastFetchAt;
    const threshold = Math.max(vp.radius_m * REFETCH_FRACTION, REFETCH_FLOOR_M);
    if (!force && covered && distanceMeters(covered, vp) < threshold) return;

    const token = Symbol("fetch");
    inFlight = token;
    pendingAt = { lat: vp.lat, lon: vp.lon };
    view.setStatus(t("map.status.loading"), { busy: true });
    if (!everLoaded) emit("loading", true);

    try {
      const data = await fetchMapMissions({
        lat: vp.lat,
        lon: vp.lon,
        radius_m: vp.radius_m,
        limit: 300,
        lang: uiLang(),
        raster: rasterChoice.get(),
      });
      if (inFlight !== token) return; // a newer request already won
      // Which raster source answered, and whether the pick had to fall back.
      emit("raster", { raster: data?.raster ?? null, fallback: !!data?.fallback });

      lastFetchAt = { lat: vp.lat, lon: vp.lon };
      const missions = Array.isArray(data?.missions) ? data.missions : [];
      const added = view.renderPins(missions);

      for (const mission of missions) {
        knownMissions.set(missionKey(mission), mission);
      }
      // Zones are polygons, and a long walk across a city would otherwise
      // accumulate them without bound. Insertion order is oldest-first, and
      // anything dropped comes straight back the next time it is fetched.
      while (knownMissions.size > MAX_KNOWN_MISSIONS) {
        knownMissions.delete(knownMissions.keys().next().value);
      }
      emit("missions", [...knownMissions.values()]);

      if (!missions.length) {
        view.setStatus(t("map.status.empty"));
      } else if (data.has_rasters === false) {
        view.setStatus(t("map.status.noRasters"));
      } else if (added > 0) {
        // Say so explicitly — pins arriving among dozens of others is easy to
        // miss, and silence reads as "panning does nothing".
        view.setStatus(t("map.status.added", { count: added }), { transient: true });
      } else {
        view.setStatus("");
      }
    } catch (e) {
      if (inFlight !== token) return;
      console.error("[MissionMap] fetch failed:", e);
      view.setStatus(t("map.status.loadFailed"));
    } finally {
      // Only the request still considered current clears the gate; a superseded
      // one must not reopen it for the request that replaced it.
      if (inFlight === token) {
        pendingAt = null;
        if (!everLoaded) { everLoaded = true; emit("loading", false); }
      }
    }
  }

  // What is on the map right now, and whether its surface is spread over the
  // whole viewport instead of clipped to a mission zone.
  let shown = null;
  let rasterFull = false;

  /**
   * The tile template for a species' probability surface, whichever kind it is.
   *
   * Missions and predictions both carry it (`raster_tiles`); older ones spell
   * it out of their id or raster fields — see `rasterTileUrl`. Null when this
   * area has no raster for the species, which is what the detail screen keys
   * its toggle off.
   */
  function rasterUrlFor(species) {
    return rasterTileUrl(species);
  }

  function paintRaster() {
    const url = rasterUrlFor(shown);
    // A mission paints its surface by default, clipped to the zone it is
    // asking about. A prediction is a reading at a point with no zone to clip
    // to, so its surface only goes up when the player asks for it.
    if (!url || (!rasterFull && !shown?.id)) { view.showRaster(null); return; }
    view.showRaster(url, rasterFull ? null : (shown.extent || null));
  }

  /** Put one species' zone and probability surface on the map, framed in view. */
  function showMission(mission, { fullRaster = false } = {}) {
    shown = mission;
    rasterFull = fullRaster;
    // Only a mission has a pin to raise.
    view.selectMission(mission?.id ? mission : null);
    paintRaster();
    if (mission?.extent) {
      view.showExtent(mission.extent);
    } else if (mission?.lat != null && mission?.lon != null) {
      // A prediction carries no coordinates of its own — there is no one place
      // it is about — so there is no radius to draw either.
      view.showFallbackRadius(mission.lat, mission.lon);
    }
  }

  function clearMission() {
    shown = null;
    rasterFull = false;
    view.selectMission(null);
    view.clearOverlays();
  }

  function setPosition(pos) {
    userPos = pos;
    view.setUserLocation(pos.lat, pos.lon);
    emit("position", pos);
  }

  // Which missions the player is standing in changes as they walk, and a list
  // that only updated when they pressed a button would be wrong exactly while
  // they are moving towards a pin — so a watch keeps following in the
  // background from the moment the player is first located. Also reached from
  // `refresh()`, which restarts it defensively: a watch that dies silently
  // (a permission hiccup, the OS suspending GPS) would otherwise leave
  // location frozen for the rest of the session with no visible symptom until
  // the player happened to notice and re-tap locate.
  function startWatch() {
    stopWatch();
    stopWatch = watchPosition(setPosition, {
      onError: (e) => console.warn("[MissionMap] position watch:", e?.message || e),
    });
  }

  async function locate({ recenter = true, force = true } = {}) {
    view.setStatus(t("map.status.locating"), { busy: true });

    // Started before the fix below even lands — a watch that only started
    // once that first request had already succeeded meant one slow or failed
    // GPS read on a cold start left location frozen until the player tapped
    // locate again.
    startWatch();

    try {
      const pos = await getCurrentPosition();
      setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      if (recenter) view.recenter(userPos.lat, userPos.lon, zoom);
      view.invalidate();
      await loadMissions(view.getViewport(), { force });
    } catch (e) {
      console.error("[MissionMap] locate failed:", e);
      view.setStatus(t("map.status.locateError"));
      if (!everLoaded) { everLoaded = true; emit("loading", false); }
    }
  }

  /** Refresh: a fresh GPS fix plus a forced re-fetch of what's on screen — not
   *  just the missions. Previously this only re-fetched missions for whatever
   *  the map happened to be centred on, so a player who had walked since their
   *  last fix (or panned away) saw stale ground marked as their own. Run both
   *  at once rather than one after the other: the mission re-fetch doesn't
   *  depend on the fix, and there's no reason to make it wait on GPS latency. */
  function refresh() {
    loadMissions(view.getViewport(), { force: true });
    startWatch();
    getCurrentPosition()
      .then((pos) => setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude }))
      .catch((e) => console.warn("[MissionMap] refresh location failed:", e?.message || e));
  }

  view.onPinClick((mission) => emit("open", mission));

  view.onMoveEnd((vp) => {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => loadMissions(vp), MOVE_DEBOUNCE_MS);
  });

  // Recentring is not a reason to refetch. Ground already covered is still
  // covered after the map slides back to you, and the normal distance gate
  // will ask for anything new — so a stray tap costs a pan, not a round trip.
  view.onLocate(() => locate({ recenter: true, force: false }));
  view.onRefresh(refresh);

  document.addEventListener("i18n:changed", () => {
    view.refreshI18n();
    lastFetchAt = null; // names and descriptions are language-dependent
    loadMissions(view.getViewport(), { force: true });
  });

  return {
    element: view.element,
    start: () => locate({ recenter: true }),
    invalidate: () => view.invalidate(),
    stop: () => { stopWatch(); stopWatch = () => {}; },

    /**
     * Start over from the raster source now picked: the missions on the map
     * were drawn from another catalogue, so they all come off, and the ground
     * on screen is asked again.
     */
    reload() {
      clearMission();
      knownMissions.clear();
      view.clearPins();
      lastFetchAt = null;
      emit("missions", []);
      loadMissions(view.getViewport(), { force: true });
    },

    /** Everything the map has loaded so far, zones included. */
    getMissions: () => [...knownMissions.values()],
    getUserPosition: () => userPos,

    showMission,
    clearMission,

    /** Mission ids accomplished today, for the pins to mark. */
    setMissionsDone: (ids) => view.setMissionsDone(ids),

    /** Does this area have a probability raster for the species at all? */
    hasRaster: (species) => !!rasterUrlFor(species),

    /**
     * Spread the surface over the whole map, or put it back inside the zone.
     * Only re-cuts the clip — the tiles already on screen are kept.
     */
    setRasterFull(full) {
      rasterFull = !!full;
      paintRaster();
    },
    setPinsVisible: (visible) => view.setPinsVisible(visible),
    recenterOnUser(zoom) {
      if (userPos) view.recenter(userPos.lat, userPos.lon, zoom);
    },

    /** Show a mission and bring its pin into view — the sheet's list does this. */
    focusMission(mission) {
      showMission(mission);
    },

    onLoading(cb) { listeners.loading.push(cb); },
    onMissions(cb) { listeners.missions.push(cb); },
    onPosition(cb) { listeners.position.push(cb); },
    /** Each answer's raster source: `{ raster: {id, name} | null, fallback }`. */
    onRaster(cb) { listeners.raster.push(cb); },
    /** A pin was tapped; the page decides what to show. */
    onOpen(cb) { listeners.open.push(cb); },
    onBackgroundClick(cb) { view.onBackgroundClick(cb); },
  };
}
