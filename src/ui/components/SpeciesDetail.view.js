// src/ui/components/SpeciesDetail.view.js
import { getWikipediaSummaryHtml, getWikipediaImageInfo } from "../../data/wiki.service.js";
import { fetchDescription, fetchTrivia, fetchSpeciesImages, photoProviderName } from "../../api/plantgo.js";
import { speciesImage, tierOf } from "./SpeciesRow.view.js";
import { openPhotoViewer } from "./PhotoViewer.js";
import { organIcon, WIKI_MARK, GBIF_MARK } from "./organIcons.js";
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

    <div class="mp-detail__gallery" hidden>
      <div class="mp-detail__gallery-viewport">
        <div class="mp-detail__gallery-scroll">
          <button class="mp-detail__hero" type="button" hidden></button>
          <div class="mp-detail__gallery-grid" hidden></div>
        </div>
        <span class="mp-detail__gallery-fade" aria-hidden="true"></span>
      </div>
      <p class="mp-detail__muted mp-detail__gallery-credit" hidden></p>
    </div>

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
      <a class="mp-detail__link" target="_blank" rel="noopener noreferrer" data-link="wiki">${WIKI_MARK}<span>Wikipedia</span></a>
      <a class="mp-detail__link" target="_blank" rel="noopener noreferrer" data-link="gbif">${GBIF_MARK}<span>GBIF</span></a>
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
  // The public mission page shows one species and no list to go back to.
  if (onBack) backBtn.addEventListener("click", onBack);
  else backBtn.hidden = true;

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

  // --- photos ---------------------------------------------------------------
  // One strip: Wikipedia's picture on the left, marked with a W, and
  // Pl@ntNet's field photos beside it in two rows that together stand as
  // tall as it, each marked with the organ it shows. The strip scrolls
  // sideways when there are more tiles than fit, and a fade on the right
  // edge — the same device the sticky bar uses above the prose — says so.
  // The band appears only once there is a picture to show: a placeholder
  // rectangle for a species nobody has photographed is 150px of nothing.
  // Images go into the document before they load and fade in on `load`
  // (see attachPhoto for why).
  const wikiUrl = binomial ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(binomial)}` : "";
  const gallery = el.querySelector(".mp-detail__gallery");
  const scroller = el.querySelector(".mp-detail__gallery-scroll");
  const hero = el.querySelector(".mp-detail__hero");
  const galleryGrid = el.querySelector(".mp-detail__gallery-grid");

  function settleFade() {
    // "More to the right" is a fact about the scroll position, so it is
    // re-read on scroll, on load and on resize rather than set once.
    const more = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1;
    gallery.classList.toggle("has-more", more);
  }
  scroller.addEventListener("scroll", settleFade, { passive: true });
  if (typeof ResizeObserver === "function") new ResizeObserver(settleFade).observe(scroller);

  function reveal() {
    gallery.hidden = false;
    requestAnimationFrame(settleFade);
  }

  // What the viewer pages through: Wikipedia's picture first when there is
  // one, then the field photos — every one fetched, not only the tiles on
  // show, so a swipe keeps going where the strip would have needed a tap.
  let wikiPhoto = null;
  let fieldPhotos = [];
  const sequence = () => (wikiPhoto ? [wikiPhoto, ...fieldPhotos] : fieldPhotos);

  speciesImage(sciName).then((url) => {
    if (!url || !el.isConnected) return;
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.addEventListener("load", () => { hero.hidden = false; reveal(); });
    img.addEventListener("error", () => img.remove());
    img.src = url;
    hero.appendChild(img);
    hero.insertAdjacentHTML("beforeend", `<span class="mp-detail__badge mp-detail__badge--wiki">${WIKI_MARK}</span>`);
    wikiPhoto = { thumb: url, medium: url, full: url, provider: "wikipedia", source: wikiUrl, author: "", license: "" };
    hero.addEventListener("click", () => {
      const viewer = openPhotoViewer(sequence(), 0);
      // The thumbnail opens at once; the larger rendition and the
      // photographer's credit follow from Commons and are patched in.
      if (wikiPhoto.large) return;
      getWikipediaImageInfo(url).then((info) => {
        if (!info) return;
        Object.assign(wikiPhoto, { large: info.large, medium: info.large, full: info.large, author: info.author, license: info.license });
        viewer?._refresh?.();
      });
    });
  });

  // The backend's gallery is keyed by GBIF id; a name alone has nowhere to
  // be sent, so such a species keeps just its Wikipedia picture.
  const gbifId = species.gbif_id ?? species.gbifId;
  const PAGE = 12;
  if (gbifId) {
    fetchSpeciesImages({ gbif_id: gbifId, limit: 36 }).then((images) => {
      // Two rows: one photo would leave a half-empty column.
      if (!el.isConnected || images.length < 2) return;
      fieldPhotos = images;
      // Usually one provider; a topped-up gallery names both.
      const providers = [...new Set(images.map((p) => photoProviderName(p.provider)))];
      const credit = el.querySelector(".mp-detail__gallery-credit");
      credit.textContent = t("map.detail.photosCredit", { source: providers.join(" & ") });
      credit.hidden = false;

      function tileFor(photo, index) {
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "mp-detail__tile";
        const img = document.createElement("img");
        img.alt = "";
        img.decoding = "async";
        img.addEventListener("load", () => { tile.classList.add("has-photo"); settleFade(); });
        img.addEventListener("error", () => { tile.remove(); settleFade(); });
        img.src = photo.thumb || photo.medium || photo.full;
        tile.appendChild(img);
        const icon = organIcon(photo.organ);
        if (icon) tile.insertAdjacentHTML("beforeend", `<span class="mp-detail__badge">${icon}</span>`);
        tile.addEventListener("click", () => openPhotoViewer(sequence(), index + (wikiPhoto ? 1 : 0)));
        return tile;
      }

      // Twelve tiles at a time. The rest are already here — the backend
      // answers with the whole set — so "more" is a tall tile at the end of
      // the strip that unfolds the next dozen in place, and steps back once
      // nothing is left.
      let shown = 0;
      const more = document.createElement("button");
      more.type = "button";
      more.className = "mp-detail__tile mp-detail__tile--more";
      more.setAttribute("aria-label", t("map.detail.morePhotos"));
      function showNext() {
        const next = images.slice(shown, shown + PAGE);
        next.forEach((photo, i) => galleryGrid.insertBefore(tileFor(photo, shown + i), more));
        shown += next.length;
        const left = images.length - shown;
        if (left > 0) more.innerHTML = `<span class="mp-detail__tile-plus" aria-hidden="true">+${left}</span>`;
        else more.remove();
        requestAnimationFrame(settleFade);
      }
      more.addEventListener("click", () => {
        const from = scroller.scrollLeft;
        showNext();
        // Land on the first new tile rather than snapping back to the start.
        scroller.scrollLeft = from;
      });
      galleryGrid.appendChild(more);
      showNext();

      galleryGrid.hidden = false;
      gallery.classList.add("has-tiles");
      reveal();
    });
  }

  // --- links ----------------------------------------------------------------
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
    // Leading 0 for the same reason as pollDescription above: this can run
    // before `el` is attached to the page, so the first isConnected check
    // needs one real tick — and it lets an already-cached trivia (the
    // common case) return on the next tick instead of after a needless 3s.
    for (const delay of [0, 3000, 5000, 8000, 12000]) {
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
