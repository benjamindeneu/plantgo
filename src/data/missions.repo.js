// src/data/missions.repo.js
import { getCachedMissions, saveSpeciesAndMissions } from "./user.repo.js";
import { fetchMissions } from "../api/plantgo.js";

export async function maybeLoadCachedMissions(uid, isFreshFn) {
  const data = await getCachedMissions(uid);

  if (isFreshFn?.(data?.last_species_fetch)) {
    return {
      missions: data?.missions_list || [],
      model: data?.missions_model || "",
      fromCache: true,
    };
  }

  return { missions: [], model: "", fromCache: false };
}

/**
 * Fetch missions and try to save them, but NEVER block rendering on save.
 * If save fails (no uid, rules, offline), we just log it.
 */
export async function loadAndMaybePersistMissions(uid, { lat, lon }, speciesList = [], model = "best") {
  const lang = document.documentElement.lang || "en";
  const data = await fetchMissions({ lat, lon, lang, model });

  // backend can return { missions: [...], model: "..." }
  const missions = Array.isArray(data?.missions)
    ? data.missions
    : (Array.isArray(data) ? data : []);

  const model =
    typeof data?.model === "string" ? data.model
      : typeof data?.model === "number" ? String(data.model)
      : "";

  // fire-and-forget save
  if (uid) {
    saveSpeciesAndMissions(uid, speciesList, missions, model).catch((e) => {
      console.warn("[missions.repo] Save skipped/failed:", e?.message || e);
    });
  }

  return { missions, model };
}
