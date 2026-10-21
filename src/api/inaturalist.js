// src/api/inaturalist.js
//
// iNaturalist's API, called straight from the browser. It answers CORS for any
// origin, so the player's token and photos never pass through our server.
// Writes carry the personal token (a JWT) as the bare Authorization header.

export const INAT_API = "https://api.inaturalist.org/v1";
export const INAT_SITE = "https://www.inaturalist.org";
export const INAT_TOKEN_URL = `${INAT_SITE}/users/api_token`;
/** iNat's taxon id for Plantae: every search here stays inside it. */
export const PLANTAE = 47126;

export const inatObservationUrl = (id) => `${INAT_SITE}/observations/${id}`;
export const inatTaxonUrl = (id) => `${INAT_SITE}/taxa/${id}`;

/** status 0 is the network failing, not iNat answering. */
export class InatError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// iNat's error bodies come in several shapes depending on which layer refused.
function messageOf(data, text) {
  const e = data?.error;
  const msg = e?.original?.error || e?.original?.errors?.[0] || (typeof e === "string" ? e : null)
    || data?.errors?.[0] || text;
  return typeof msg === "string" ? msg : JSON.stringify(msg);
}

async function inat(path, { token, method = "GET", body, signal } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = token;
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${INAT_API}${path}`, { method, headers, body: payload, signal });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new InatError(0, e?.message || "Network error");
  }
  const text = await res.text().catch(() => "");
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) throw new InatError(res.status, messageOf(data, text) || res.statusText);
  return data;
}

/** The account a token belongs to; a 401 means the token is dead. */
export async function inatMe(token) {
  const data = await inat("/users/me", { token });
  return data?.results?.[0] || null;
}

/** Plants matching what the player types — Latin or common name, in `locale`. */
export async function inatAutocomplete(q, { locale, signal } = {}) {
  const params = new URLSearchParams({ q, taxon_id: PLANTAE, is_active: "true", per_page: "12" });
  if (locale) params.set("locale", locale);
  const data = await inat(`/taxa/autocomplete?${params}`, { signal });
  // Species and below: rank_level 10 is species, 20 genus.
  return (data?.results || []).filter((tx) => Number(tx.rank_level) <= 10);
}

/** The full taxa search, which also reports the synonym a hit matched on. */
export async function inatTaxaSearch(name, { locale } = {}) {
  const params = new URLSearchParams({ q: name, taxon_id: PLANTAE, is_active: "true", per_page: "10" });
  if (locale) params.set("locale", locale);
  const data = await inat(`/taxa?${params}`);
  return data?.results || [];
}

export async function inatCreateObservation(token, observation) {
  const data = await inat("/observations", { token, method: "POST", body: { observation } });
  // v1 answers with the observation itself; tolerate the list and results shapes too.
  if (Array.isArray(data)) return data[0] || null;
  return data?.id ? data : (data?.results?.[0] || null);
}

export async function inatUploadPhoto(token, observationId, file) {
  const form = new FormData();
  form.append("observation_photo[observation_id]", String(observationId));
  form.append("file", file, file.name || "photo.jpg");
  return inat("/observation_photos", { token, method: "POST", body: form });
}

/** Finds an observation by the uuid it was created with — a create can land even when its answer is lost. */
export async function inatFindByUuid(uuid, token) {
  const data = await inat(`/observations?uuid=${encodeURIComponent(uuid)}&per_page=1`, { token });
  return data?.results?.[0] || null;
}
