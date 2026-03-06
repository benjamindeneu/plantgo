// src/controllers/MissionCard.controller.js
import { createMissionCardView } from "../ui/components/MissionCard.view.js";
import { Modal } from "../ui/components/Modal.js";
import { getWikipediaImage, getWikipediaSummaryHtml } from "../data/wiki.service.js";
import { t } from "../language/i18n.js";

/** ---- Wikipedia caching + concurrency ---- */
const wikiImageCache = new Map();
const wikiSummaryCache = new Map();

const MAX_CONCURRENT = 4;
let inFlight = 0;
const queue = [];

function runLimited(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    pump();
  });
}
function pump() {
  while (inFlight < MAX_CONCURRENT && queue.length) {
    const { task, resolve, reject } = queue.shift();
    inFlight++;
    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        inFlight--;
        pump();
      });
  }
}

function getUiLang() {
  // 1) <html lang="fr"> (best if you control it)
  const htmlLang = document?.documentElement?.lang?.trim();
  if (htmlLang) return htmlLang.split("-")[0].toLowerCase();

  // 2) browser language
  const navLang = navigator?.language?.trim();
  if (navLang) return navLang.split("-")[0].toLowerCase();

  return "en";
}

export function MissionCard(species) {
  const sciName = species.name || species.scientific_name || "";
  const commonName = species.vernacular_name || t("missions.card.noCommonName");

  const heroUrl =
    species.image_url ||
    species.image ||
    (Array.isArray(species.images) && species.images[0]) ||
    "";

  const totalPoints = Number(species.points?.total ?? 0);
  const { missionLevelKey, levelClass } = getRarityFromPoints(totalPoints);

  const view = createMissionCardView({
    sciName,
    commonName,
    heroUrl,
    pointsTotal: totalPoints,
    levelClass,
    missionLevel: t(missionLevelKey),
    isFlowering: !!species.is_flowering,
    isFruiting: !!species.is_fruiting,
  });

  // external links
  if (sciName) {
    const lang = getUiLang();
    const binomial = sciName.trim().split(/\s+/).slice(0, 2).join(" ");
    view.setWikiLinkUrl(`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(binomial)}`);
  }
  const gbifId = species.gbif_id ?? species.gbifId;
  if (gbifId) {
    view.setGbifLinkUrl(`https://www.gbif.org/species/${gbifId}`);
  }

  // points modal
  const detailObj = species.points?.detail || {};
  view.onPointsClick(() => {
    let detail =
      `<h2>${escapeHtml(t("missions.card.pointsDetails"))}</h2>` +
      `<p><small>${escapeHtml(t("missions.card.missionPrefix"))} ${escapeHtml(sciName)}</small></p>`;

    if (detailObj && typeof detailObj === "object") {
      for (const k of Object.keys(detailObj)) {
        const label = t(k); // ✅ backend sends i18n key now
        detail += `<p>${escapeHtml(label)}: ${escapeHtml(detailObj[k])} ${escapeHtml(t("missions.card.points"))}</p>`;
      }
    } else {
      detail += `<p>${escapeHtml(t("missions.card.noBreakdown"))}</p>`;
    }

    document.body.appendChild(
      Modal({ title: t("missions.card.pointsTitle"), content: detail })
    );
  });

  // ---------- description (use backend if present, otherwise Wikipedia) ----------
  const existingDescHtml =
    species.wiki_extract_html ||
    species.description_html ||
    ""; // keep this as HTML only

  const existingDescText =
    (!existingDescHtml && (species.wiki_extract || species.description)) ||
    ""; // plain text fallback

  if (existingDescHtml) {
    view.setWikiDescriptionHtml(existingDescHtml);
  } else if (existingDescText) {
    view.setWikiDescriptionText(existingDescText);
  } else if (sciName) {
    const lang = getUiLang();
    const cacheKey = `${sciName.trim().toLowerCase()}|${lang}`;

    if (!wikiSummaryCache.has(cacheKey)) {
      wikiSummaryCache.set(
        cacheKey,
        runLimited(async () => (await getWikipediaSummaryHtml(sciName, { lang })) || "")
          .catch(() => "")
      );
    }

    Promise.resolve(wikiSummaryCache.get(cacheKey)).then((html) => {
      if (!view.element.isConnected) return;
      if (html) view.setWikiDescriptionHtml(html);
    });
  }

  // ---------- wikipedia image: only if no heroUrl ----------
  if (!heroUrl && sciName) {
    const cacheKey = sciName.trim().toLowerCase();
    if (!wikiImageCache.has(cacheKey)) {
      wikiImageCache.set(
        cacheKey,
        runLimited(async () => (await getWikipediaImage(sciName)) || "").catch(() => "")
      );
    }
    Promise.resolve(wikiImageCache.get(cacheKey)).then((url) => {
      if (!view.element.isConnected) return;
      view.setWikiImage(url);
    });
  }

  return view.element;
}

function getRarityFromPoints(totalPoints) {
  if (totalPoints >= 1500) return { missionLevelKey: "missions.card.legendary", levelClass: "legendary-points" };
  if (totalPoints >= 1000) return { missionLevelKey: "missions.card.epic",      levelClass: "epic-points" };
  if (totalPoints >=  500) return { missionLevelKey: "missions.card.rare",      levelClass: "rare-points" };
  return { missionLevelKey: "missions.card.common", levelClass: "common-points" };
}

function escapeHtml(s) {
  const str = String(s ?? "");
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
