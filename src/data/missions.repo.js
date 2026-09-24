// src/data/missions.repo.js
import { getCachedMissions, saveSpeciesAndMissions, saveMissionsHere } from "./user.repo.js";

// The bonus table lives in its own module so pages without Firebase can use it.
export { MISSION_BONUS_BY_TIER, missionBonusFor } from "./missionBonus.js";

/**
 * Remember the missions the player is standing inside, for the identify flow
 * to score against.
 *
 * Deliberately not `missions_list`: that is the old home page's cache of
 * "missions fetched for your area", while this is the strict subset you are
 * actually standing in and can complete right now. Only what identification
 * needs is stored — a mission carries its zone polygon, and writing a few
 * hundred of those to the user document on every GPS fix is not free.
 */
export function persistMissionsHere(uid, missions = []) {
  if (!uid) return Promise.resolve();
  const trimmed = missions.map((m) => ({
    id: m.id ?? null,
    gbif_id: m.gbif_id ?? null,
    name: m.name ?? "",
    vernacular_name: m.vernacular_name ?? "",
    grade: m.grade?.tier ? { tier: m.grade.tier } : null,
  }));
  return saveMissionsHere(uid, trimmed)
    .catch((e) => console.warn("[missions.repo] missions_here save failed:", e?.message || e));
}
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
export async function loadAndMaybePersistMissions(
  uid,
  { lat, lon },
  speciesList = [],
  model = "best"
) {
  const lang = document.documentElement.lang || "en";

  const data = await fetchMissions({
    lat,
    lon,
    lang,
    model   // passed to backend
  });

  const missions = Array.isArray(data?.missions)
    ? data.missions
    : (Array.isArray(data) ? data : []);

  const resolvedModel =
    typeof data?.model === "string" ? data.model
      : typeof data?.model === "number" ? String(data.model)
      : model; // fallback to requested model

  if (uid) {
    saveSpeciesAndMissions(uid, speciesList, missions, resolvedModel)
      .catch((e) => {
        console.warn("[missions.repo] Save skipped/failed:", e?.message || e);
      });
  }

  return { missions, model: resolvedModel };
}
