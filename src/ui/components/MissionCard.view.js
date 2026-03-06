// src/ui/components/MissionCard.view.js
import { t } from "../../language/i18n.js";

export function createMissionCardView({
  sciName,
  commonName,
  heroUrl = "",
  pointsTotal = 0,
  levelClass = "common-points",
  missionLevel = "Common",
  isFlowering = false,
  isFruiting = false,
}) {
  const root = document.createElement("div");
  root.className = "species-item";

  root.innerHTML = `
    <h2 class="mission-title" id="missionTitle"></h2>

    <div class="card-content">
      <div class="media-col">
        <div class="herbarium-img" id="imgWrap">
          ${
            heroUrl
              ? `<img class="species-image" src="${heroUrl}" alt="${escapeHtml(sciName)}" loading="lazy">`
              : `<div class="wiki-skeleton"></div>`
          }
        </div>
      </div>

      <div class="species-info">
        <p><strong id="commonName">${escapeHtml(commonName)}</strong></p>

        <div class="species-actions">
          <button class="points-btn ${levelClass}" id="pointsBtn" type="button"></button>
          <div class="badges" id="badges"></div>
        </div>
      </div>
    </div>
    <div class="wiki-desc muted" id="wikiDesc" style="display:none;"></div>
    <div id="extLinksCard" class="ext-links-bar" style="display:none">
      <span class="ext-links-label"></span>
      <a id="wikiLink" class="wiki-ext-link" target="_blank" rel="noopener noreferrer" style="display:none" aria-label="Wikipedia">
        <img src="./assets/wikipedia-logo.svg" alt="Wikipedia" width="22" height="22">
      </a>
      <a id="gbifLink" class="wiki-ext-link" target="_blank" rel="noopener noreferrer" style="display:none" aria-label="GBIF">
        <img src="./assets/gbif-logo.png" alt="GBIF" width="22" height="22">
      </a>
    </div>
  `;

  const missionTitleEl = root.querySelector("#missionTitle");
  const imgWrap = root.querySelector("#imgWrap");
  const pointsBtn = root.querySelector("#pointsBtn");
  const extLinksCard = root.querySelector("#extLinksCard");
  const extLinksLabel = root.querySelector(".ext-links-label");
  const wikiLinkEl = root.querySelector("#wikiLink");
  const gbifLinkEl = root.querySelector("#gbifLink");
  const badgesEl = root.querySelector("#badges");
  const wikiDescEl = root.querySelector("#wikiDesc");

  let onPoints = null;
  pointsBtn.addEventListener("click", () => { if (onPoints) onPoints(); });

  function renderBadges() {
    if (!badgesEl) return;

    let html = "";
    if (isFlowering) {
      html += `<span class="badge flowering-badge is-visible">🌸 ${escapeHtml(t("missions.card.flowering"))}</span>`;
    }
    if (isFruiting) {
      html += `<span class="badge fruiting-badge is-visible">🍎 ${escapeHtml(t("missions.card.fruiting"))}</span>`;
    }

    badgesEl.innerHTML = html;
    badgesEl.style.display = html ? "" : "none";
  }

function refreshI18n() {
    if (missionTitleEl) {
      missionTitleEl.textContent = ""; // clear existing content

      // Add prefix text
      missionTitleEl.append(
        document.createTextNode(t("missions.card.missionPrefix") + " ")
      );

      // Add italic scientific name
      const sciEl = document.createElement("em"); // or "i"
      //sciEl.textContent = formatSciName(sciName);
      sciEl.textContent = sciName;
      missionTitleEl.append(sciEl);
    }

    if (extLinksLabel) extLinksLabel.textContent = t("missions.card.moreInfo");

    if (pointsBtn) {
      pointsBtn.innerHTML = `${pointsTotal} ${t("missions.card.points")}<br>${escapeHtml(missionLevel)}`;
    }
    renderBadges();
  }

  refreshI18n();

  return {
    element: root,

    setWikiImage(url) {
      if (!imgWrap) return;
      imgWrap.innerHTML = url
        ? `<img src="${url}" alt="${escapeHtml(sciName)}" loading="lazy">`
        : `<div class="wiki-missing">${escapeHtml(t("missions.card.noImage"))}</div>`;
    },

    // new: set wiki description (HTML from extract_html)
    setWikiDescriptionHtml(html) {
      if (!wikiDescEl) return;
      const cleaned = String(html ?? "").trim();
      if (!cleaned) {
        wikiDescEl.style.display = "none";
        wikiDescEl.innerHTML = "";
        return;
      }
      wikiDescEl.style.display = "";
      wikiDescEl.innerHTML = cleaned;
    },

    // optional: plain-text version if you ever need it
    setWikiDescriptionText(text) {
      if (!wikiDescEl) return;
      const cleaned = String(text ?? "").trim();
      if (!cleaned) {
        wikiDescEl.style.display = "none";
        wikiDescEl.textContent = "";
        return;
      }
      wikiDescEl.style.display = "";
      wikiDescEl.textContent = cleaned;
    },

    setWikiLinkUrl(url) {
      if (!wikiLinkEl) return;
      if (url) { wikiLinkEl.href = url; wikiLinkEl.style.display = ""; }
      else { wikiLinkEl.style.display = "none"; }
      if (extLinksCard) extLinksCard.style.display = (wikiLinkEl.style.display !== "none" || (gbifLinkEl && gbifLinkEl.style.display !== "none")) ? "" : "none";
    },

    setGbifLinkUrl(url) {
      if (!gbifLinkEl) return;
      if (url) { gbifLinkEl.href = url; gbifLinkEl.style.display = ""; }
      else { gbifLinkEl.style.display = "none"; }
      if (extLinksCard) extLinksCard.style.display = (gbifLinkEl.style.display !== "none" || (wikiLinkEl && wikiLinkEl.style.display !== "none")) ? "" : "none";
    },

    onPointsClick(cb) { onPoints = cb; },
    refreshI18n,

    setPhenology({ flowering, fruiting }) {
      isFlowering = !!flowering;
      isFruiting = !!fruiting;
      renderBadges();
    },
  };
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
