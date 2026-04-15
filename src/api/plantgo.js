// src/api/plantgo.js
import { SPECIES_PROXY_URL, IDENTIFY_PROXY_URL, PREDICTION_PROXY_URL, QUIZ_PROXY_URL, DESCRIPTION_PROXY_BASE, TRIVIA_PROXY_BASE, SDM_MODELS_URL } from "./config.js";

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
