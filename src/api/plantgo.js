// src/api/plantgo.js
import { SPECIES_PROXY_URL, IDENTIFY_PROXY_URL, PREDICTION_PROXY_URL, QUIZ_PROXY_URL, DESCRIPTION_PROXY_BASE, SDM_MODELS_URL } from "./config.js";

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
