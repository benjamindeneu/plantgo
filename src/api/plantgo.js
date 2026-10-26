// src/api/plantgo.js
import { SPECIES_PROXY_URL, IDENTIFY_PROXY_URL, PREDICTION_PROXY_URL, QUIZ_PROXY_URL, DESCRIPTION_PROXY_BASE, TRIVIA_PROXY_BASE, SPECIES_IMAGES_BASE, SDM_MODELS_URL, IDENTIFIER_MODELS_URL, MAP_MISSIONS_URL, MISSION_DETAIL_BASE, MISSION_ONE_BASE, GPN_TILE_BASE, API_ORIGIN, RASTER_MODELS_URL, SPECIES_LIST_URL, ME_URL } from "./config.js";

// Where the signed-in player's Firebase ID token comes from, set by
// api/session.js on the pages that have one. The server serves some sources
// to beta testers only and tells who is asking from this token. Unset (the
// public mission page), requests go unsigned.
let tokenProvider = null;

/** `fn` returns the current ID token, or a promise of it, or null. */
export function setTokenProvider(fn) {
  tokenProvider = fn;
}

async function authHeaders() {
  try {
    const token = await tokenProvider?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};      // a token that cannot be had is an unsigned request, not a failed one
  }
}

async function http(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), ...(await authHeaders()) } });
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

/** Photos per identification: what Pl@ntNet and FlorID both take at most. */
export const MAX_IDENTIFY_PHOTOS = 5;

/**
 * Resize the photos that go to identification (the first MAX_IDENTIFY_PHOTOS),
 * in parallel. `debugInfo` adds the sizes up across all of them, for the
 * debug timings.
 */
export async function resizeImages(files) {
  const done = await Promise.all(files.slice(0, MAX_IDENTIFY_PHOTOS).map((f) => resizeImage(f)));
  const infos = done.map((d) => d.debugInfo).filter(Boolean);
  const more = infos.length > 1 ? ` +${infos.length - 1}` : "";
  const originalSize = infos.reduce((s, d) => s + d.originalSize, 0);
  const newSize = infos.reduce((s, d) => s + d.newSize, 0);
  return {
    files: done.map((d) => d.file),
    debugInfo: infos.length ? {
      originalSize,
      newSize,
      originalDims: infos[0].originalDims + more,
      newDims: infos[0].newDims + more,
      reduction: Math.round((1 - newSize / originalSize) * 100),
    } : null,
  };
}

/**
 * Identify a plant with the backend contract you shared:
 * - multipart form, one file field named "image" per photo (at most MAX_IDENTIFY_PHOTOS)
 * - form fields: lat, lon, identifier (who names the plant; "auto" = the
 *   default where the player is), model (the SDM the points are scored with)
 */
export async function identifyPlant({ files, lat, lon, identifier = "auto", model = "best", lang = "en", skipResize = false, debug = false }) {
  if (!files?.length) throw new Error("No image file provided.");
  if (lat == null || lon == null) throw new Error("Missing lat/lon for identify.");

  const photos = skipResize ? files.slice(0, MAX_IDENTIFY_PHOTOS) : (await resizeImages(files)).files;

  const formData = new FormData();
  for (const photo of photos) formData.append("image", photo, photo.name || "photo.jpg");
  formData.append("lat", String(lat));
  formData.append("lon", String(lon));
  formData.append("identifier", identifier);
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
export async function fetchPredictions({ lat, lon, model = "best", raster = "auto", limit = 10, lang = "en" }) {
  return http(PREDICTION_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon, model, raster, limit, lang })
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
 * `raster` picks the raster source the missions come from ("auto", or an id
 * from fetchAvailableRasters); the answer's `raster` names the one used, and
 * `fallback` says the pick is not built here.
 *
 * Returns { area, model, raster, fallback, has_rasters, has_extents,
 *   missions: [{ id, gbif_id, name, vernacular_name, lat, lon, extent,
 *   metrics, grade, is_flowering, is_fruiting, raster_tiles }] }
 */
export async function fetchMapMissions({ lat, lon, radius_m = 2000, limit = 20, model = "best", raster = "auto", lang = "en", extent = true, largeScale = false }) {
  // `large_scale` opens the coarse rungs of the ladder (z7, z6). They are
  // always in the catalogue — the cascade tests finer peaks against them — but
  // a z6 zone covers hundreds of square kilometres, so a request has to ask.
  const qs = new URLSearchParams({ lat, lon, radius_m, limit, model, raster, lang, extent, large_scale: largeScale });
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
 * One mission by id, in the shape `fetchMapMissions` gives each pin — grade,
 * zone and phenology included. For the public mission page, which is opened
 * from a link or a QR code and so has an id to show but no viewport.
 * Rejects with a `[404]` error when the mission is not in the catalogue.
 */
export async function fetchMissionById({ id, lang = "en" }) {
  const qs = new URLSearchParams({ lang });
  return httpWithTimeout(`${MISSION_ONE_BASE}/${encodeURIComponent(id)}?${qs}`, {}, 60_000);
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
 * Leaflet tile template for whatever a mission or a prediction shows.
 *
 * The server says where the tiles live (`raster_tiles`): GeoPl@ntNet's own
 * host, or a path on this server for rasters it draws itself. Items from
 * before that field (cached lists, old builds) fall back to spelling the
 * GeoPl@ntNet URL out of their id or their raster fields. Null when there is
 * no raster for the species here.
 */
export function rasterTileUrl(item) {
  if (!item) return null;
  const template = item.raster_tiles;
  if (typeof template === "string" && template) {
    return template.startsWith("/") ? `${API_ORIGIN}${template}` : template;
  }
  return missionRasterTileUrl(item.id) ?? speciesRasterTileUrl(item.raster_area, item.raster_id);
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
 * What the signed-in player may do, as the server sees it from their token:
 * { signed_in, tester }. A beta tester is served what is not public yet.
 */
export async function fetchMe() {
  return http(ME_URL);
}

/**
 * Fetch available SDM models for a given location.
 */
export async function fetchAvailableModels({ lat, lon }) {
  return http(`${SDM_MODELS_URL}?lat=${lat}&lon=${lon}`);
}

/**
 * Fetch the image identifiers available at a location, and the default one.
 * Same shape as fetchAvailableModels: { location, models, default_model }.
 */
export async function fetchAvailableIdentifiers({ lat, lon }) {
  return http(`${IDENTIFIER_MODELS_URL}?lat=${lat}&lon=${lon}`);
}

/**
 * Fetch the raster sources whose missions are built at a location, and the
 * default one. Same shape as fetchAvailableModels: { location, models, default_model }.
 */
export async function fetchAvailableRasters({ lat, lon }) {
  return http(`${RASTER_MODELS_URL}?lat=${lat}&lon=${lon}`);
}

/**
 * Every species the raster source's catalogue covers where the point is — the
 * species page's list. `raster` as for fetchMapMissions ("auto", or an id
 * from fetchAvailableRasters); the answer's `raster` names the source used
 * and `fallback` says the pick is not built here.
 *
 * Returns { area, tdwg4, model, raster, fallback, species: [{ gbif_id, name,
 *   vernacular_name, family, raster_area, raster_id, raster_tiles }] }
 */
export async function fetchSpeciesList({ lat, lon, raster = "auto", lang = "en" }) {
  const qs = new URLSearchParams({ lat, lon, raster, lang });
  return httpWithTimeout(`${SPECIES_LIST_URL}?${qs}`, {}, 30_000);
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
