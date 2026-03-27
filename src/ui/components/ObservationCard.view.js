// src/ui/components/ObservationCard.view.js
import { t } from "../../language/i18n.js";

function escapeHtml(s) {
  const str = String(s ?? "");
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getRarity(val) {
  return val >= 1500 ? "legendary-points" :
         val >= 1000 ? "epic-points" :
         val >= 500  ? "rare-points" : "common-points";
}

function formatDate(timestamp) {
  if (!timestamp) return t("herbarium.card.unknownDate");
  const date = timestamp.toDate?.() ?? new Date(timestamp);
  return date.toLocaleString(document.documentElement.lang || "en", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatConfidence(score) {
  if (score == null) return "—";
  return `${Math.round(Number(score) * 100)}%`;
}

export function createObservationCardView(obs) {
  const rarity = getRarity(obs.total_points || 0);
  const rarityLabel = t(`result.rarity.${rarity.replace("-points", "")}`);
  const confidence = formatConfidence(obs.plantnet_identify_score);
  const date = formatDate(obs.observedAt);

  const detailEntries = Object.entries(obs.points || {});
  const detailHtml = detailEntries
    .map(([k, v]) => `<div class="detail-line" data-k="${escapeHtml(k)}"><span>${escapeHtml(t(k))}</span><span>+${escapeHtml(String(v))}</span></div>`)
    .join("");

  const lat = obs.location?.latitude;
  const lon = obs.location?.longitude;
  const coordsHtml = (lat != null && lon != null)
    ? `<a class="obs-coords muted small-text" href="${escapeHtml(`geo:${lat},${lon}?q=${lat},${lon}`)}">📍 ${escapeHtml(lat.toFixed(5))}, ${escapeHtml(lon.toFixed(5))}</a>`
    : "";

  const root = document.createElement("div");
  root.className = "obs-history-card card";

  root.innerHTML = `
    <div class="obs-card-top">
      <div class="obs-wiki-img">
        <div class="wiki-skeleton"></div>
      </div>
      <div class="obs-card-info">
        <div class="obs-history-header">
          <span class="obs-history-date muted">${escapeHtml(date)}</span>
          ${obs.nearbyDuplicate ? `<span class="obs-nearby-badge">${escapeHtml(t("result.badge.nearbyDuplicate"))}</span>` : ""}
        </div>
        ${coordsHtml}
        <div class="obs-history-species">
          <span class="obs-species-name">${obs.speciesName ? `<em>${escapeHtml(obs.speciesName)}</em>` : escapeHtml(t("result.unknownSpecies"))}</span>
          <span class="obs-confidence muted small-text">${escapeHtml(t("result.confidence"))} ${escapeHtml(confidence)}</span>
        </div>
        <div class="points-badge ${escapeHtml(rarity)}">
          <span class="value">${escapeHtml(String(obs.total_points || 0))} <span class="rarity-label">${escapeHtml(rarityLabel)}</span></span>
        </div>
      </div>
    </div>
    <div class="obs-history-details">
      ${detailHtml}
    </div>
  `;

  const imgWrap = root.querySelector(".obs-wiki-img");

  return {
    element: root,

    setImage(url) {
      if (!imgWrap) return;
      if (url) {
        imgWrap.innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(obs.speciesName || "")}" loading="lazy">`;
      } else {
        imgWrap.innerHTML = `<div class="wiki-missing">${escapeHtml(t("herbarium.card.noImage"))}</div>`;
      }
    },
  };
}
