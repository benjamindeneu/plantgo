// src/ui/components/SpeciesDetail.view.js
import { getWikipediaSummaryHtml } from "../../data/wiki.service.js";
import { fetchDescription, fetchTrivia } from "../../api/plantgo.js";
import { speciesImage, tierOf } from "./SpeciesRow.view.js";
import { t } from "../../language/i18n.js";

function uiLang() {
  return (document.documentElement.lang || "en").split("-")[0];
}

function binomialOf(sciName) {
  return sciName ? sciName.trim().split(/\s+/).slice(0, 2).join(" ") : "";
}

/**
 * One species, filling the sheet.
 *
 * This is the screen that used to be a bottom sheet floating over the map. It
 * lives in the sheet the list lives in, and slides in over it, so the map —
 * which is now showing this species' zone and probability surface, the whole
 * reason the pin was tapped — stays visible the entire time.
 */
export function SpeciesDetail(species, { onBack, onRasterToggle, rasterAvailable = false, rasterOn = false } = {}) {
  const sciName = species.name || species.scientific_name || "";
  const commonName = species.vernacular_name || sciName;
  const tier = tierOf(species);
  const graded = !!species.grade;
  const chance = species.metrics?.p_mean;
  const lang = uiLang();
  const binomial = binomialOf(sciName);

  const el = document.createElement("div");
  el.className = `mp-detail mp-detail--${tier}`;
  el.innerHTML = `
    <div class="mp-detail__bar">
      <button class="mp-detail__back" type="button">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M14.7 6.3 13.4 5l-5.7 5.7v2.6L13.4 19l1.3-1.3-4.4-4.4z"/></svg>
        <span class="mp-detail__back-label"></span>
      </button>

      <span class="mp-detail__bar-grab" data-sheet-grab aria-hidden="true"></span>

      <label class="mp-switch" hidden>
        <span class="mp-switch__label"></span>
        <input class="mp-switch__input" type="checkbox">
        <span class="mp-switch__track" aria-hidden="true"><span class="mp-switch__knob"></span></span>
      </label>
    </div>

    <div class="mp-detail__heading">
      <p class="mp-detail__name"></p>
      <p class="mp-detail__sci"></p>
    </div>

    <div class="mp-detail__tags"></div>

    <div class="mp-detail__hero" hidden></div>

    <div class="mp-detail__prose">
      <div class="mp-detail__wiki"></div>
      <div class="mp-detail__backend"></div>
      <p class="mp-detail__muted" id="detailPending"></p>
    </div>

    <div class="mp-detail__trivia" hidden>
      <span class="mp-detail__trivia-label"></span>
      <p></p>
    </div>

    <div class="mp-detail__links">
      <a class="mp-detail__link" target="_blank" rel="noopener noreferrer" data-link="wiki">Wikipedia</a>
      <a class="mp-detail__link" target="_blank" rel="noopener noreferrer" data-link="gbif">GBIF</a>
    </div>
  `;

  el.querySelector(".mp-detail__back-label").textContent = t("map.detail.back");
  el.querySelector(".mp-detail__name").textContent = commonName;
  const sciEl = el.querySelector(".mp-detail__sci");
  sciEl.textContent = sciName;
  // A herbarium entry knows only the Latin name, which then heads the
  // screen; printing it again in italics underneath said nothing new.
  if (commonName === sciName) sciEl.hidden = true;

  const backBtn = el.querySelector(".mp-detail__back");
  if (onBack) backBtn.addEventListener("click", onBack);

  // --- tags -----------------------------------------------------------------
  const tags = el.querySelector(".mp-detail__tags");
  const tag = (text, kind) => {
    const s = document.createElement("span");
    s.className = `mp-tag mp-tag--${kind}`;
    s.textContent = text;
    tags.appendChild(s);
  };
  // Only a mission has a grade. A prediction's tier is derived from a points
  // estimate it does not have, so labelling one "Routine" was inventing a
  // rank for a species nobody graded — the row already omits it, and this
  // screen now agrees.
  if (graded) tag(`${t("missions.card.missionPrefix")} ${t(`missions.card.${tier}`)}`, tier);
  const chanceTag = document.createElement("span");
  chanceTag.className = "mp-tag mp-tag--chance";
  chanceTag.hidden = chance == null;
  if (chance != null) chanceTag.textContent = t("map.meta.chance", { pct: Math.round(chance * 100) });
  tags.appendChild(chanceTag);
  if (species.is_flowering) tag(t("map.tag.flowering"), "pheno");
  if (species.is_fruiting) tag(t("map.tag.fruiting"), "pheno");

  // --- probability surface --------------------------------------------------
  // A mission paints its surface clipped to its own zone; this lifts that clip
  // and spreads it over the whole map, which is also the only way a prediction
  // — which has no zone to clip to — can show one at all. Hidden outright when
  // the species has no raster in this area, rather than offered as a switch
  // that does nothing.
  //
  // It rides in the back bar rather than getting a row of its own: it is a
  // control for the map behind the sheet, not a fact about the species, and
  // the bar already had the width going spare.
  //
  // The bar stays pinned to the top of the sheet while the write-up scrolls
  // (see .mp-detail__bar), so the blank stretch between the two controls is
  // always right under the sheet's grab pill — and a thumb that lands there
  // is reaching for the pill, not the page. The spacer between them carries
  // `data-sheet-grab`, which MapPage treats as another handle for the same
  // drag-resize.
  const rasterSwitch = el.querySelector(".mp-switch");
  const rasterInput = el.querySelector(".mp-switch__input");
  el.querySelector(".mp-switch__label").textContent = t("map.detail.showRaster");
  rasterSwitch.hidden = !rasterAvailable;
  rasterInput.checked = !!rasterOn;
  rasterInput.addEventListener("change", () => onRasterToggle?.(rasterInput.checked));

  // --- hero -----------------------------------------------------------------
  // The photo band appears only once there is a photo. A placeholder rectangle
  // for a species Wikipedia has no picture of is 170px of nothing, and the
  // names read better on paper than over an empty gradient.
  const hero = el.querySelector(".mp-detail__hero");
  speciesImage(sciName).then((url) => {
    if (!url || !el.isConnected) return;
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.addEventListener("load", () => { hero.hidden = false; });
    img.addEventListener("error", () => img.remove());
    img.src = url;
    hero.appendChild(img);
  });

  // --- links ----------------------------------------------------------------
  const wikiUrl = binomial ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(binomial)}` : "";
  const gbifId = species.gbif_id ?? species.gbifId;
  const wikiLink = el.querySelector('[data-link="wiki"]');
  const gbifLink = el.querySelector('[data-link="gbif"]');
  if (wikiUrl) wikiLink.href = wikiUrl; else wikiLink.hidden = true;
  if (gbifId) gbifLink.href = `https://www.gbif.org/species/${gbifId}`; else gbifLink.hidden = true;

  // --- prose ----------------------------------------------------------------
  // Two sources, stacked rather than competing. Wikipedia's summary says what
  // the plant *is*, in one request that nearly always answers; the backend's
  // description and habitat say where to look for it, but are generated on
  // demand and can arrive seconds later or not at all. Showing one instead of
  // the other threw away half of what is known about the species.
  const wikiEl = el.querySelector(".mp-detail__wiki");
  const backendEl = el.querySelector(".mp-detail__backend");
  const pendingEl = el.querySelector("#detailPending");
  // Same spinner-and-caption treatment as the result modal's description and
  // trivia loaders — this screen is fetching the same two things, so it
  // should look like it's fetching them the same way.
  pendingEl.innerHTML = `<span class="fetch-loading"><span class="loading-spinner"></span>${escapeHtml(t("map.detail.loading"))}</span>`;

  function settlePending() {
    // The line only reports on what is still missing; once either source has
    // landed there is something to read, and once both are decided it goes.
    pendingEl.hidden = !!backendEl.innerHTML
      || (!!wikiEl.innerHTML && wikiSettled && backendSettled);
    if (wikiSettled && backendSettled && !wikiEl.innerHTML && !backendEl.innerHTML) {
      pendingEl.hidden = false;
      pendingEl.textContent = t("map.detail.noDescription");
    }
  }

  let wikiSettled = false;
  let backendSettled = false;

  if (binomial) {
    getWikipediaSummaryHtml(sciName, { lang })
      .then((html) => { if (el.isConnected && html) wikiEl.innerHTML = html; })
      .catch(() => {})
      .finally(() => { wikiSettled = true; settlePending(); });
  } else {
    wikiSettled = true;
  }

  // Flat single-path glyphs, same currentColor technique as the back button
  // and the map's own controls — not emoji, which render as a different, off-
  // brand icon set depending on the platform.
  const DESC_ICON = `<svg class="mp-detail__icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 1 4 18.5v-13zm10-2.5h3.5A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5H14V3z"/></svg>`;
  const HABITAT_ICON = `<svg class="mp-detail__icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>`;

  function setBackend(desc) {
    if (!el.isConnected || !desc?.description) return false;
    let html = `<p>${DESC_ICON}${escapeHtml(desc.description)}</p>`;
    if (desc.habitat) {
      html += `<p class="mp-detail__habitat">${HABITAT_ICON}<strong>${escapeHtml(t("missions.card.habitat"))}</strong> ${escapeHtml(desc.habitat)}</p>`;
    }
    backendEl.innerHTML = html;
    backendSettled = true;
    settlePending();
    return true;
  }

  // The backend's routes are keyed by GBIF id; a name alone (a herbarium
  // entry from before ids were kept) has nowhere to be sent.
  if (!setBackend(species.description) && gbifId) {
    pollDescription(gbifId, sciName);
  } else if (!gbifId) {
    backendSettled = true;
    settlePending();
  }

  async function pollDescription(id, name) {
    // Same cadence as pollTrivia below. The description prompt asks Gemini
    // for all 6 languages in one completion, so it's slower and more likely
    // to hit a rate limit and retry (observed 40-50s+ in practice) than
    // trivia's single-language prompt — giving it a *shorter* window than
    // trivia, as this used to, meant it gave up before its own background
    // fetch had a chance to land.
    //
    // The leading 0 must still go through a real setTimeout (never skipped):
    // this function starts running synchronously inside SpeciesDetail's own
    // constructor, before it has returned `el` for the caller to attach to
    // the page, so `el.isConnected` is false at that instant. Skipping the
    // await on a falsy delay used to check it right then — always false,
    // every species, every time — and return before ever calling
    // fetchDescription at all, which is why this never even started.
    for (const delay of [0, 3000, 5000, 8000, 12000]) {
      await new Promise((r) => setTimeout(r, delay));
      if (!el.isConnected) return;
      try {
        const res = await fetchDescription({ gbif_id: id, name, lang });
        if (setBackend(res?.description)) return;
      } catch { /* keep trying */ }
    }
    backendSettled = true;
    settlePending();
  }

  // --- trivia -----------------------------------------------------------
  // Trivia is generated on demand and can lag well behind the description, so
  // it gets the same poll-with-a-spinner treatment as the result modal — the
  // caller's own fetch (below, via setTrivia) usually wins the race, but if
  // it lands empty this keeps trying independently rather than leaving a
  // trivia box that never appears.
  const triviaEl = el.querySelector(".mp-detail__trivia");
  const triviaTextEl = triviaEl.querySelector("p");
  triviaEl.querySelector(".mp-detail__trivia-label").textContent = t("map.trivia");
  let triviaSettled = false;

  function setTrivia(trivia) {
    if (!el.isConnected || triviaSettled) return false;
    const text = typeof trivia === "string"
      ? trivia
      : (trivia?.fact || trivia?.text || trivia?.question || "");
    if (!text) return false;
    triviaEl.hidden = false;
    triviaTextEl.textContent = text;
    triviaSettled = true;
    return true;
  }

  if (!setTrivia(species.trivia) && gbifId) {
    pollTrivia(gbifId, sciName);
  }

  async function pollTrivia(id, name) {
    triviaEl.hidden = false;
    triviaTextEl.innerHTML = `<span class="fetch-loading"><span class="loading-spinner"></span>${escapeHtml(t("result.trivia.loading"))}</span>`;
    for (const delay of [3000, 5000, 8000, 12000]) {
      await new Promise((r) => setTimeout(r, delay));
      if (!el.isConnected || triviaSettled) return;
      try {
        const res = await fetchTrivia({ gbif_id: id, name, lang });
        if (setTrivia(res?.trivia)) return;
      } catch { /* keep trying */ }
    }
    if (triviaSettled || !el.isConnected) return;
    triviaSettled = true;
    triviaTextEl.innerHTML = `<span class="fetch-error">${escapeHtml(t("result.trivia.unavailable"))}</span>`;
  }

  // --- what the caller fills in once the detail request lands ----------------
  el.setChance = (p) => {
    if (p == null) return;
    chanceTag.hidden = false;
    chanceTag.textContent = t("map.meta.chance", { pct: Math.round(p * 100) });
  };
  el.setTrivia = (trivia) => { setTrivia(trivia); };
  /** The detail request can reveal a raster the list row knew nothing about. */
  el.setRasterAvailable = (available) => { rasterSwitch.hidden = !available; };
  el.setDescription = (desc) => { setBackend(desc); };

  return el;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
