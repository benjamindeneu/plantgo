// src/api/plantgo.js
import { SPECIES_PROXY_URL, IDENTIFY_PROXY_URL, PREDICTION_PROXY_URL } from "./config.js";

async function http(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[${res.status}] at ${url} :: ${text}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

/**
 * Identify a plant with the backend contract you shared:
 * - multipart form with *single* file field named "image"
 * - form fields: lat, lon, model
 */
export async function identifyPlant({ file, lat, lon, model = "best", lang = "en" }) {
  if (!file) throw new Error("No image file provided.");
  if (lat == null || lon == null) throw new Error("Missing lat/lon for identify.");

  const formData = new FormData();
  // IMPORTANT: single file under the exact field name "image"
  formData.append("image", file, file.name || "photo.jpg");
  formData.append("lat", String(lat));
  formData.append("lon", String(lon));
  formData.append("model", model);
  formData.append("lang", lang);

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
