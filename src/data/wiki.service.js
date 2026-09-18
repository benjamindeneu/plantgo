// src/data/wiki.service.js

// --- public: clean a binomial from a full scientific name ---
export function getBinomialName(full) {
  if (!full || typeof full !== "string") return "";
  const cleaned = full
    .replace(/\(.*?\)/g, " ") // remove parenthetical authors
    .replace(/[,.;]+/g, " ")  // remove punctuation
    .replace(/\b(subsp\.|ssp\.|var\.|f\.|cf\.|subg\.|sect\.|series)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned.split(" ");
  return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : cleaned;
}

// --- small in-browser cache (localStorage with TTL) ---
const CACHE_PREFIX = "wikiThumb:";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { v, t, ttl } = JSON.parse(raw);
    if (Date.now() - t > (ttl ?? DEFAULT_TTL_MS)) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return v;
  } catch { return null; }
}
function writeCache(key, value, ttl = DEFAULT_TTL_MS) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ v: value, t: Date.now(), ttl }));
  } catch {}
}

// --- fetch helpers ---
async function fetchWithTimeout(url, { timeout = 4000 } = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// Try REST Summary first: https://{lang}.wikipedia.org/api/rest_v1/page/summary/{title}
async function tryRestSummary(binomial, lang, thumbSize) {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(binomial)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return null;
  const data = await res.json();
  // Some summaries include original-sized thumbs; accept as-is
  return data?.thumbnail?.source || null;
}

// Fallback to Action API (like your old code)
async function tryActionApi(binomial, lang, thumbSize) {
  const url = `https://${lang}.wikipedia.org/w/api.php` +
    `?action=query&titles=${encodeURIComponent(binomial)}` +
    `&prop=pageimages&format=json&pithumbsize=${thumbSize}&origin=*`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data?.query?.pages || {};
  for (const pageId in pages) {
    const src = pages[pageId]?.thumbnail?.source;
    if (src) return src;
  }
  return null;
}

/**
 * Get a Wikipedia thumbnail for a species.
 * - Tries multiple languages (default: en, fr, de, it).
 * - Uses REST Summary first, then Action API.
 * - Caches results in localStorage with TTL.
 */
export async function getWikipediaImage(
  speciesFullName,
  { thumbSize = 150, languages = ["en", "fr", "de", "it"], ttlMs = DEFAULT_TTL_MS } = {}
) {
  const binomial = getBinomialName(speciesFullName);
  if (!binomial) return null;

  const cacheKey = `${binomial}|${thumbSize}|${languages.join(",")}`;
  const cached = readCache(cacheKey);
  if (cached !== null) return cached;

  for (const lang of languages) {
    try {
      const rest = await tryRestSummary(binomial, lang, thumbSize);
      if (rest) { writeCache(cacheKey, rest, ttlMs); return rest; }
      const action = await tryActionApi(binomial, lang, thumbSize);
      if (action) { writeCache(cacheKey, action, ttlMs); return action; }
    } catch {
      // ignore and try next language
    }
  }

  writeCache(cacheKey, null, ttlMs);
  return null;
}

// --- fetch Wikipedia formatted summary (REST API) ---
export async function getWikipediaSummaryHtml(
  speciesFullName,
  { lang = "en", ttlMs = DEFAULT_TTL_MS } = {}
) {
  const binomial = getBinomialName(speciesFullName);
  if (!binomial) return null;

  const cacheKey = `summaryHtml:${binomial}|${lang}`;
  const cached = readCache(cacheKey);
  if (cached !== null) return cached;

  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(binomial)}`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      writeCache(cacheKey, null, ttlMs);
      return null;
    }

    const data = await res.json();

    const html =
      data?.extract_html?.trim() ||
      data?.extract?.trim() ||
      null;

    writeCache(cacheKey, html, ttlMs);
    return html;
  } catch {
    writeCache(cacheKey, null, ttlMs);
    return null;
  }
}

// --- the file behind a thumbnail: a larger rendition and its credit ---
// A thumbnail URL names its Commons file (…/thumb/7/7b/<File>/330px-<File>),
// and Commons serves only a fixed ladder of widths, so a bigger version is
// asked for rather than guessed at. The same imageinfo call carries the
// photographer and licence the viewer has to show. Cached like the rest.
const WIKI_FILE_RE = /\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)\/\d+px-/;

export async function getWikipediaImageInfo(thumbUrl, { width = 800, ttlMs = DEFAULT_TTL_MS } = {}) {
  const m = WIKI_FILE_RE.exec(thumbUrl || "");
  if (!m) return null;
  const file = decodeURIComponent(m[1]);
  const cacheKey = `info:${file}|${width}`;
  const cached = readCache(cacheKey);
  if (cached !== null) return cached;

  let info = null;
  try {
    const url = "https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo"
      + "&iiprop=url|extmetadata&iiextmetadatafilter=Artist|LicenseShortName"
      + `&iiurlwidth=${width}&format=json&formatversion=2&origin=*`
      + `&titles=${encodeURIComponent("File:" + file)}`;
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const ii = (await res.json())?.query?.pages?.[0]?.imageinfo?.[0];
      if (ii) {
        const em = ii.extmetadata || {};
        info = {
          large: ii.thumburl || ii.url || thumbUrl,
          author: stripTags(em.Artist?.value || ""),
          license: em.LicenseShortName?.value || "",
          page: ii.descriptionurl || "",
        };
      }
    }
  } catch {
    // leave null; the viewer shows the thumbnail it already has
  }
  writeCache(cacheKey, info, ttlMs);
  return info;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
