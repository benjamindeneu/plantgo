// src/api/plantgo.js
import { SPECIES_PROXY_URL, IDENTIFY_PROXY_URL, PREDICTION_PROXY_URL, QUIZ_PROXY_URL, DESCRIPTION_PROXY_BASE, TRIVIA_PROXY_BASE, SPECIES_IMAGES_BASE, SDM_MODELS_URL, MAP_MISSIONS_URL, MISSION_DETAIL_BASE, GPN_TILE_BASE } from "./config.js";

async function http(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[${res.status}] at ${url} :: ${text}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

async function httpWithTimeout(url, opts = {}, timeoutMs = 150_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await http(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resize an image File to fit within maxDim x maxDim while preserving aspect ratio.
 * Returns a new File (JPEG, quality 0.85) small enough for fast uploads.
 */
export async function resizeImage(file, maxDim = 1280) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          const resized = new File([blob], file.name || "photo.jpg", { type: "image/jpeg" });
          resolve({
            file: resized,
            debugInfo: {
              originalSize: file.size,
              newSize: blob.size,
              originalDims: `${w}×${h}`,
              newDims: `${canvas.width}×${canvas.height}`,
              reduction: Math.round((1 - blob.size / file.size) * 100),
            },
          });
        },
        "image/jpeg",
        0.95
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ file, debugInfo: null }); }; // fallback: send original
    img.src = url;
  });
}

/**
 * Identify a plant with the backend contract you shared:
 * - multipart form with *single* file field named "image"
 * - form fields: lat, lon, model
 */
export async function identifyPlant({ file, lat, lon, model = "best", lang = "en", skipResize = false, debug = false }) {
  if (!file) throw new Error("No image file provided.");
  if (lat == null || lon == null) throw new Error("Missing lat/lon for identify.");

  const resized = skipResize ? file : (await resizeImage(file)).file;

  const formData = new FormData();
  // IMPORTANT: single file under the exact field name "image"
  formData.append("image", resized, resized.name || "photo.jpg");
  formData.append("lat", String(lat));
  formData.append("lon", String(lon));
  formData.append("model", model);
  formData.append("lang", lang);
  if (debug) formData.append("debug", "true");

  return http(IDENTIFY_PROXY_URL, { method: "POST", body: formData });
}

/**
 * Missions kept as-is
 */
export async function fetchMissions({ lat, lon, model = "best", limit = 10, lang = "en" }) {
  return http(SPECIES_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon, model, limit, lang })
  });
}

/**
 * Fetch species predictions for a given location (used by Species Hunt challenge creation).
 * Returns { model, predictions: [{ gbif_id, name, vernacular_name, score, is_flowering, is_fruiting }] }
 */
export async function fetchPredictions({ lat, lon, model = "best", limit = 10, lang = "en" }) {
  return http(PREDICTION_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon, model, limit, lang })
  });
}

/**
 * Fetch mission pins for the area around a point (front page map).
 *
 * Each mission carries its zone (`extent`, a GeoJSON Polygon) and `metrics`,
 * so the client can test its own position against every zone locally — see
 * data/extent.geo.js — instead of asking the server once per mission per GPS
 * fix. Descriptions and trivia are still per-mission, from fetchMissionDetail.
 * Pass `extent: false` for the pins alone.
 *
 * Returns { area, model, has_rasters, has_extents, missions: [{ id, gbif_id,
 *   name, vernacular_name, lat, lon, extent, metrics, grade, is_flowering,
 *   is_fruiting }] }
 */
export async function fetchMapMissions({ lat, lon, radius_m = 2000, limit = 20, model = "best", lang = "en", extent = true, largeScale = false }) {
  // `large_scale` opens the coarse rungs of the ladder (z7, z6). They are
  // always in the catalogue — the cascade tests finer peaks against them — but
  // a z6 zone covers hundreds of square kilometres, so a request has to ask.
  const qs = new URLSearchParams({ lat, lon, radius_m, limit, model, lang, extent, large_scale: largeScale });
  return httpWithTimeout(`${MAP_MISSIONS_URL}?${qs}`, {}, 60_000);
}

/**
 * Fetch the expensive half of one mission: extent polygon, description, trivia.
 * Returns { id, gbif_id, name, vernacular_name, lat, lon, extent, metrics, points, description, trivia }
 */
export async function fetchMissionDetail({ id, lang = "en", model = "best" }) {
  const qs = new URLSearchParams({ lang, model });
  return httpWithTimeout(`${MISSION_DETAIL_BASE}/${encodeURIComponent(id)}?${qs}`, {}, 60_000);
}

/**
 * Leaflet tile template for the probability raster behind one mission.
 *
 * A mission id spells out where its raster lives —
 * `gpn2:<area>:<raster_id>:<pin_lat_e5>:<pin_lon_e5>` optionally followed by
 * the site the zone is grown from — so the overlay costs no request of its own
 * and can go up the moment a pin is tapped. Returns null for ids that carry no
 * raster, which is also what the map gets for the approximate missions the
 * backend emits when an area has none.
 */
export function missionRasterTileUrl(missionId) {
  const [prefix, area, rasterId, ...rest] = String(missionId ?? "").split(":");
  // gpn2 — v1: `gpn2:<area>:<raster>:<lat_e5>:<lon_e5>`, optionally + site pair.
  // gpn3 — v2: `gpn3:<area>:<raster>:<level>:<lat_e5>:<lon_e5>`, the level being
  // the pyramid rung the peak was found on.
  if (!area || !rasterId) return null;
  if (prefix === "gpn3") {
    if (rest.length !== 3) return null;
  } else if (prefix === "gpn2") {
    if (rest.length !== 2 && rest.length !== 4) return null;
  } else {
    return null;
  }
  return speciesRasterTileUrl(area, rasterId);
}

/**
 * Leaflet tile template for one species' probability raster in one area.
 *
 * Missions spell their area and raster id out of their own id; predictions
 * carry them as fields, because a reading taken at a point has no mission to
 * derive them from. Both end up here.
 */
export function speciesRasterTileUrl(area, rasterId) {
  if (!area || rasterId == null) return null;
  return `${GPN_TILE_BASE}/${encodeURIComponent(area)}/2/species/${encodeURIComponent(rasterId)}/{z}/{x}/{y}`;
}

/**
 * Fetch a single quiz question for one observed species.
 * @param {{ item: {gbif_id: number, name: string}, lang: string }} params
 * Returns the first question object from the backend response.
 */
export async function fetchQuizQuestion({ item, lang = "en" }) {
  const result = await httpWithTimeout(QUIZ_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [item], lang }),
  }, 60_000); // 1 min per question
  return Array.isArray(result) ? result[0] : result;
}

/**
 * Fetch available SDM models for a given location.
 */
export async function fetchAvailableModels({ lat, lon }) {
  return http(`${SDM_MODELS_URL}?lat=${lat}&lon=${lon}`);
}

/**
 * Fetch description + habitat for a single species.
 * Returns { gbif_id, description: { description, habitat } }
 */
export async function fetchDescription({ gbif_id, name, lang = "en" }) {
  return http(`${DESCRIPTION_PROXY_BASE}/${gbif_id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, lang }),
  });
}

/**
 * Fetch trivia for a single species.
 * Returns { gbif_id, trivia } — trivia is null if not yet cached (backend computes in background).
 */
export async function fetchTrivia({ gbif_id, name, lang = "en" }) {
  return http(`${TRIVIA_PROXY_BASE}/${gbif_id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, lang }),
  });
}

/** Gallery lookups are shared across every screen on the page, like species photos are. */
const speciesImagesCache = new Map();

/**
 * Fetch the photo gallery for a single species, keyed by GBIF id only.
 * Returns the images array — `[]` when the species has none or the request
 * failed, so a caller never has to tell the two apart. Each image is
 * { thumb, medium, full, organ, author, license, source, provider }, where
 * provider is "plantnet" or, for a species Pl@ntNet has too few photos of,
 * "inaturalist".
 */
export const PHOTO_PROVIDERS = { plantnet: "Pl@ntNet", inaturalist: "iNaturalist", wikipedia: "Wikipedia" };
export function photoProviderName(provider) {
  return PHOTO_PROVIDERS[provider] || PHOTO_PROVIDERS.plantnet;
}
export function fetchSpeciesImages({ gbif_id, limit = 9 }) {
  if (!gbif_id) return Promise.resolve([]);
  const key = `${gbif_id}|${limit}`;
  if (!speciesImagesCache.has(key)) {
    speciesImagesCache.set(
      key,
      httpWithTimeout(`${SPECIES_IMAGES_BASE}/${gbif_id}/images?limit=${limit}`, {}, 8_000)
        .then((data) => (Array.isArray(data?.images) ? data.images : []))
        .catch(() => []),
    );
  }
  return speciesImagesCache.get(key);
}
