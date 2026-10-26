// src/controllers/SpeciesPage.controller.js
import { createSpeciesPageView } from "../ui/components/SpeciesPage.view.js";
import { MissionMapPanel } from "./MissionMap.controller.js";
import { SpeciesDetail } from "../ui/components/SpeciesDetail.view.js";
import { fetchSpeciesList, fetchAvailableRasters } from "../api/plantgo.js";
import { rasterChoice } from "../data/rasterChoice.js";

// A species' surface is about a region, not a street: the first fix frames
// enough ground around the player to see where it is likely and where not.
const START_ZOOM = 11;

function uiLang() {
  return (document.documentElement.lang || "en").split("-")[0];
}

/**
 * The species page: every species the distribution maps cover where the
 * player is, under a map that paints the one tapped.
 *
 * The list is every species the raster source the missions use (the same
 * stored pick, `rasterChoice`) maps in the player's country — not only the
 * ones missions are drawn from — so it is asked for once, at the first fix,
 * and again only when the source or the language changes. There are no
 * pins: the map is there for the surfaces.
 */
export function SpeciesPage() {
  const view = createSpeciesPageView({ onOpen: openSpecies });
  const map = MissionMapPanel({ missions: false, zoom: START_ZOOM });
  view.mapSlot.appendChild(map.element);

  let position = null;
  let listToken = 0;
  let rastersLoaded = false;

  // --- the detail screen ---------------------------------------------------

  function openSpecies(species) {
    // The surface is the point of opening a species here, so it goes up at
    // once — over the whole map, since there is no zone to clip it to.
    const detail = SpeciesDetail(species, {
      onBack: () => view.showList(),
      rasterAvailable: map.hasRaster(species),
      rasterOn: true,
      onRasterToggle: (on) => map.setRasterFull(on),
    });
    view.showDetail(detail);
    map.showMission(species, { fullRaster: true });
  }

  view.onDetailBack(() => map.clearMission());

  // --- the list --------------------------------------------------------------

  async function loadList() {
    if (!position) return;
    const token = ++listToken;
    view.showList();
    view.setLoading(true);
    try {
      const data = await fetchSpeciesList({
        lat: position.lat, lon: position.lon, raster: rasterChoice.get(), lang: uiLang(),
      });
      if (token !== listToken) return;
      view.setSource({ name: data?.raster?.name, fallback: !!data?.fallback });
      view.setSpecies(data?.species ?? [], { pending: data?.pending ?? 0 });
    } catch (e) {
      if (token !== listToken) return;
      console.error("[SpeciesPage] species list failed:", e);
      view.setSource();
      view.setSpecies(null, { status: { icon: "⚠️", key: "speciesPage.loadFailed" } });
    } finally {
      if (token === listToken) view.setLoading(false);
    }
  }

  /** Which raster sources this location offers. Fetched once. */
  async function loadRasters(pos) {
    if (rastersLoaded) return;
    rastersLoaded = true;
    try {
      const data = await fetchAvailableRasters({ lat: pos.lat, lon: pos.lon });
      view.setRasters({
        models: data?.models ?? [],
        defaultModel: data?.default_model ?? null,
        selected: rasterChoice.get(),
      });
    } catch (e) {
      rastersLoaded = false;
      console.warn("[SpeciesPage] raster list failed:", e?.message || e);
    }
  }

  // The list is for the country the player is in, so the first fix is all it
  // needs; walking on does not change it.
  map.onPosition((pos) => {
    const first = !position;
    position = pos;
    if (first) {
      loadList();
      loadRasters(pos);
    }
  });

  // Another source is another catalogue. The pick is the front page's too:
  // its missions come from the same maps.
  view.onRasterChange((id) => {
    rasterChoice.set(id);
    loadList();
  });

  view.onRefresh(() => loadList());

  view.onResize(() => map.invalidate());

  document.addEventListener("i18n:changed", () => {
    view.refreshI18n();
    // Common names come with the list, in the language it was asked in.
    loadList();
  });

  view.setSpecies(null, { status: { icon: "📍", key: "map.here.locating" } });

  return {
    element: view.element,
    start: () => map.start(),
    invalidate: () => map.invalidate(),
    stop: () => map.stop(),
  };
}
