// src/data/vernacular.service.js
import { getBinomialName } from "./wiki.service.js";

/**
 * A species' common name, from GBIF.
 *
 * The identify step hands us a vernacular name for every new find and it is
 * now kept on the discovery. Finds from before that only have the Latin name,
 * and this fills the gap: GBIF's vernacular-names list for the species, in
 * the interface language if it has one, English failing that. Two requests
 * for a name-only entry (match the name to a GBIF key, then list), one when
 * the key is known — and none at all after the first time, since the answer
 * is cached for a month. Empty answers are cached too; asking again would
 * not change them.
 */

const CACHE_PREFIX = "vernacular:";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

// ISO 639-1 (the interface) → ISO 639-3 (what GBIF tags names with).
const GBIF_LANG = { en: "eng", fr: "fra", de: "deu", it: "ita", es: "spa", pt: "por" };

function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    const { v, t } = JSON.parse(raw);
    if (Date.now() - t > TTL_MS) { localStorage.removeItem(CACHE_PREFIX + key); return undefined; }
    return v;
  } catch { return undefined; }
}
function writeCache(key, value) {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ v: value, t: Date.now() })); } catch {}
}

async function getJson(url, timeout = 6000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

// GBIF is generous, but a herbarium of a few hundred species should not
// open a few hundred connections at once.
const MAX_CONCURRENT = 4;
let inFlight = 0;
const queue = [];
function limited(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    pump();
  });
}
function pump() {
  while (inFlight < MAX_CONCURRENT && queue.length) {
    const { task, resolve, reject } = queue.shift();
    inFlight++;
    Promise.resolve().then(task).then(resolve, reject).finally(() => { inFlight--; pump(); });
  }
}

/** Requests in progress, so two rows for one species share a single lookup. */
const pending = new Map();

function tidy(name) {
  const s = String(name || "").trim().replace(/\s+/g, " ");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/** Among GBIF's names for one language, the one it lists most often. */
function pickName(results, lang3) {
  const counts = new Map();
  for (const r of results) {
    if (r?.language !== lang3 || !r.vernacularName) continue;
    const key = r.vernacularName.trim().toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
  return tidy(best);
}

/**
 * Resolve the common name for a species. Returns "" when GBIF has none.
 * @param {{ name: string, gbif_id?: number|string|null, lang?: string }} opts
 */
export function getVernacularName({ name, gbif_id = null, lang = "en" }) {
  const binomial = getBinomialName(name);
  const lang2 = String(lang || "en").toLowerCase().split("-")[0];
  const lang3 = GBIF_LANG[lang2] || "eng";
  if (!binomial) return Promise.resolve("");

  const key = `${binomial.toLowerCase()}|${lang3}`;
  const cached = readCache(key);
  if (cached !== undefined) return Promise.resolve(cached);
  if (pending.has(key)) return pending.get(key);

  const p = limited(async () => {
    try {
      let usageKey = gbif_id != null ? Number(gbif_id) : null;
      if (!usageKey) {
        const match = await getJson(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(binomial)}`);
        usageKey = match?.usageKey ?? null;
      }
      if (!usageKey) { writeCache(key, ""); return ""; }

      const list = await getJson(`https://api.gbif.org/v1/species/${usageKey}/vernacularNames?limit=200`);
      const results = Array.isArray(list?.results) ? list.results : [];
      const found = pickName(results, lang3) || (lang3 !== "eng" ? pickName(results, "eng") : "");
      writeCache(key, found);
      return found;
    } catch {
      return "";           // not cached: a failed request is worth retrying next visit
    } finally {
      pending.delete(key);
    }
  });
  pending.set(key, p);
  return p;
}
