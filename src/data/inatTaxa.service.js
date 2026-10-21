// src/data/inatTaxa.service.js
//
// The bridge between the two catalogues. PlantGo is keyed on GBIF ids and
// Pl@ntNet names; iNaturalist has its own taxa and its own accepted names.
// There is no id-to-id table to lean on (Wikidata's GBIF ids are often an
// older backbone's), so the bridge is the scientific name, both ways.
import { inatTaxaSearch } from "../api/inaturalist.js";

const GBIF_API = "https://api.gbif.org/v1";
const CACHE_PREFIX = "inat-taxon:";
const HIT_TTL_MS = 30 * 24 * 3600 * 1000;
// A name iNat did not know may be added or merged; ask again sooner.
const MISS_TTL_MS = 7 * 24 * 3600 * 1000;

const RANK_MARKERS = new Set(["subsp.", "ssp.", "var.", "subvar.", "f.", "forma", "nothosubsp.", "nothovar."]);
// iNat ranks below species, and the word GBIF's matcher wants in their names.
const INFRA_MARKER = { subspecies: "subsp.", variety: "var.", form: "f." };

function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    const { v, t } = JSON.parse(raw);
    if (Date.now() - t > (v ? HIT_TTL_MS : MISS_TTL_MS)) { localStorage.removeItem(CACHE_PREFIX + key); return undefined; }
    return v;
  } catch { return undefined; }
}
function writeCache(key, value) {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ v: value, t: Date.now() })); } catch {}
}

/**
 * A name without its authors: "Primula veris L." → "Primula veris",
 * "Anemone nemorosa var. coerulea Pritz." → "Anemone nemorosa var. coerulea".
 * Epithets are lower case and authors are not, which is where it stops.
 */
export function canonicalName(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const out = [words[0]];
  let i = 1;
  if ((words[0] === "×" || words[0] === "x") && words[1]) out.push(words[i++]);
  for (; i < words.length; i++) {
    const w = words[i];
    const marker = RANK_MARKERS.has(w.toLowerCase());
    if (!marker && w !== "x" && !/^[×a-zà-ÿ-]+$/.test(w)) break;
    out.push(w);
  }
  return out.join(" ");
}

/**
 * What two names are compared on. iNat writes a subspecies without its rank
 * word ("Quercus robur robur") and spells hybrids with ×; the key drops both.
 */
function nameKey(name) {
  return String(name || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/×/g, " ")
    .split(/\s+/)
    .filter((w) => w && w !== "x" && !RANK_MARKERS.has(w))
    .join(" ");
}

/** iNat's English names come lower case ("wood anemone"); the app's do not. */
function capitalise(s) {
  return s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : null;
}

/** The handful of taxon fields the app shows or sends, small enough to cache. */
export function slimTaxon(tx) {
  if (!tx) return null;
  return {
    id: tx.id,
    name: tx.name,
    rank: tx.rank || null,
    rank_level: tx.rank_level ?? null,
    common_name: capitalise(tx.preferred_common_name),
    photo: tx.default_photo?.square_url || null,
  };
}

/**
 * The iNaturalist taxon for Pl@ntNet's suggestion, or null when iNat has no
 * plant by that name. A hit is accepted on its own name or on the synonym it
 * matched (`matched_term`) — iNat files Anemone nemorosa under Anemonoides
 * nemorosa, and that is still the right taxon to post.
 */
export async function inatTaxonForSuggestion({ gbif_id, name, locale = "en" }) {
  const query = canonicalName(name);
  if (!query) return null;
  // The common name comes in the UI's language, so the cache is per locale.
  const cacheKey = `${locale}:${gbif_id ?? nameKey(query)}`;
  const cached = readCache(cacheKey);
  if (cached !== undefined) return cached;

  // Not cached on failure: a lookup that never happened is not "no match".
  const results = await inatTaxaSearch(nameKey(query), { locale });
  const want = nameKey(query);
  const hit = results.find((tx) => nameKey(tx.name) === want)
    || results.find((tx) => nameKey(tx.matched_term) === want);
  const taxon = slimTaxon(hit);
  writeCache(cacheKey, taxon);
  return taxon;
}

/**
 * The GBIF id for a species the player picked on iNat, so a correction is kept
 * on the same key as everything else. Only an exact match counts; a fuzzy one
 * would file the correction under some other plant. Synonyms resolve to the
 * accepted taxon, as identify does for Pl@ntNet's answers.
 */
export async function gbifKeyForInatTaxon({ name, rank } = {}) {
  if (!name) return null;
  const words = name.split(/\s+/);
  const marker = INFRA_MARKER[rank];
  const gbifName = marker && words.length === 3 ? `${words[0]} ${words[1]} ${marker} ${words[2]}` : name;
  const params = new URLSearchParams({ name: gbifName, kingdom: "Plantae", strict: "true" });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${GBIF_API}/species/match?${params}`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const m = await res.json();
    if (m?.matchType !== "EXACT") return null;
    const key = m.acceptedUsageKey ?? m.usageKey;
    return key != null ? Number(key) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
