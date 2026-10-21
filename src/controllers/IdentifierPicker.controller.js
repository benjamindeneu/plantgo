// src/controllers/IdentifierPicker.controller.js
import { fetchAvailableIdentifiers } from "../api/plantgo.js";
import { getCurrentPosition } from "../data/geo.service.js";
import { identifierChoice } from "../data/identifierChoice.js";

/**
 * Fill an identify panel's identifier list with what runs where the player
 * is, and keep their pick. Shared by both identify pipelines (the map page's
 * IdentifyPanel and the public mission page), which use the same view.
 *
 * The list is fetched the first time the gear opens, not before: most
 * players never open it, and the server picks the local default anyway. A
 * failed fetch is tried again on the next open; meanwhile Auto alone is
 * offered, which still works.
 */
export function attachIdentifierPicker(view) {
  let loaded = false;
  let loading = false;

  view.onIdentifierOpen(async () => {
    if (loaded || loading) return;
    loading = true;
    view.setIdentifiersLoading();
    try {
      // A fix a minute old is close enough to know the country
      const pos = await getCurrentPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 60_000 });
      const data = await fetchAvailableIdentifiers({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      view.setIdentifiers({
        models: data?.models || [],
        defaultModel: data?.default_model ?? null,
        selected: identifierChoice.get(),
      });
      loaded = true;
    } catch (e) {
      console.warn("[IdentifierPicker] could not load identifiers:", e);
      view.setIdentifiers({ selected: identifierChoice.get() });
    } finally {
      loading = false;
    }
  });

  view.onIdentifierChange((id) => identifierChoice.set(id));
}
