// src/ui/components/SpeciesPage.view.js
import { t } from "../../language/i18n.js";
import { makeSheetResizable } from "../sheetResize.js";
import { fillModelSelect } from "./MapPage.view.js";
import { createSearchField, fold } from "./SearchField.js";
import { SpeciesRow } from "./SpeciesRow.view.js";

const SORTS = ["az", "za", "latin", "family"];
// Rows are drawn this many at a time as the list is scrolled. A country has
// one or two thousand species, and every row fetches its own photo.
const PAGE = 40;

function uiLang() {
  return document.documentElement.lang || "en";
}

/**
 * The species page: the front page's map and sheet, with every species of the
 * region in the sheet instead of missions.
 *
 * The same bands as MapPage.view — map on top, a sheet riding over its bottom
 * edge that the grab handle resizes, the species screen opening inside the
 * sheet while the map shows its surface — minus the tabs and the camera. The
 * list is filtered by the herbarium's search pill and ordered by a sort pill
 * beside it; both stay pinned to the top of the sheet while the list scrolls.
 */
export function createSpeciesPageView({ onOpen } = {}) {
  const root = document.createElement("div");
  root.className = "mp-shell mp-shell--species";
  root.innerHTML = `
    <div id="mapSlot" class="mp-map"></div>

    <div class="mp-sheet">
      <button type="button" class="mp-sheet__grab" data-sheet-grab aria-label=""></button>

      <div class="mp-screen" data-screen="list">
        <div class="mp-sheet__head">
          <h2 class="mp-sheet__title"></h2>
          <span class="mp-sheet__count" hidden></span>
        </div>
        <div class="mp-sheet__scroll" data-list-scroll>
          <!-- Which distribution maps the list is of. Only shown where more
               than one is built: elsewhere there is no choice. -->
          <div class="mp-around-bar" data-raster-bar hidden>
            <label class="mp-select">
              <span class="mp-select__label"></span>
              <select class="mp-select__input" data-raster></select>
              <svg class="mp-select__caret" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                <path fill="currentColor" d="M7 10l5 5 5-5z"/>
              </svg>
            </label>
          </div>
          <p class="mp-around-model" data-source hidden></p>
          <!-- A list whose names are still being looked up says so, and a
               tap asks for it again. -->
          <button class="mp-species__pending" type="button" data-pending hidden></button>

          <div class="mp-herb__tools mp-species__tools">
            <label class="mp-select mp-herb__sort">
              <span class="mp-select__label"></span>
              <select class="mp-select__input" data-sort></select>
              <svg class="mp-select__caret" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                <path fill="currentColor" d="M7 10l5 5 5-5z"/>
              </svg>
            </label>
          </div>

          <div class="mp-spinner" data-spinner hidden aria-hidden="true"></div>
          <div class="mp-list" data-list></div>
          <div class="mp-species__more" data-more aria-hidden="true"></div>
        </div>
      </div>

      <div class="mp-screen mp-screen--detail" data-screen="detail" hidden>
        <div class="mp-sheet__scroll" data-detail></div>
      </div>
    </div>
  `;

  const q = (sel) => root.querySelector(sel);
  const mapSlot = q("#mapSlot");
  const sheet = q(".mp-sheet");
  const sheetGrab = q(".mp-sheet__grab");
  const screenList = q('[data-screen="list"]');
  const screenDetail = q('[data-screen="detail"]');
  const detailSlot = q("[data-detail]");
  const titleEl = q(".mp-sheet__title");
  const countEl = q(".mp-sheet__count");
  const listScroll = q("[data-list-scroll]");
  const rasterBar = q("[data-raster-bar]");
  const rasterSelect = q("[data-raster]");
  const rasterLabel = rasterBar.querySelector(".mp-select__label");
  const sourceEl = q("[data-source]");
  const pendingBtn = q("[data-pending]");
  const tools = q(".mp-species__tools");
  const sortSelect = q("[data-sort]");
  const sortLabel = tools.querySelector(".mp-select__label");
  const spinner = q("[data-spinner]");
  const listEl = q("[data-list]");
  const moreEl = q("[data-more]");

  let species = null;      // null until a list has landed
  let query = "";
  let sort = "az";
  let emptyState = null;   // what to say instead of a list: { icon, key }
  let sourceName = "";
  // The source the server actually used, when it is not the pick (a pick not
  // built here falls back): the pill names what the list is of.
  let fallbackName = "";
  let rasterOffer = { models: [], defaultModel: null };
  let rasterCb = null;
  let refreshCb = null;
  let pendingCount = 0;
  let resizeCb = null;
  let detailBackCb = null;

  const search = createSearchField({ onInput: (text) => { query = text; render(); toResults(); } });
  tools.prepend(search.element);

  makeSheetResizable({ root, sheet, grab: sheetGrab, mapSlot, onResize: () => resizeCb?.() });

  // --- the list -------------------------------------------------------------
  const printed = (s) => s.vernacular_name || s.name || "";

  /** The species matching the search, in the order picked. */
  function visible() {
    const needle = fold(query.trim());
    const rows = needle ? species.filter((s) => searchText.get(s).includes(needle)) : species.slice();
    const lang = uiLang();
    const cmp = (a, b) => String(a ?? "").localeCompare(String(b ?? ""), lang, { sensitivity: "base" });
    // Ordered by the name that is actually printed large, so an A → Z list
    // reads as one.
    switch (sort) {
      case "za":     rows.sort((a, b) => cmp(printed(b), printed(a))); break;
      case "latin":  rows.sort((a, b) => cmp(a.name, b.name)); break;
      case "family": rows.sort((a, b) => cmp(a.family, b.family) || cmp(a.name, b.name)); break;
      default:       rows.sort((a, b) => cmp(printed(a), printed(b)));
    }
    return rows;
  }

  // Every name a row is found by, folded once per list rather than per
  // keystroke: a country lists four thousand species and more.
  const searchText = new WeakMap();

  function row(s) {
    const el = SpeciesRow(s, { onClick: onOpen });
    // Without a common name the row would print the Latin one twice.
    if (!s.vernacular_name) el.querySelector(".mp-row__sci").hidden = true;
    return el;
  }

  // Rows not drawn yet, appended a page at a time as the end of the list
  // comes near — see PAGE.
  let pending = [];
  function drawMore() {
    const next = pending.splice(0, PAGE);
    for (const s of next) listEl.appendChild(row(s));
    // The observer only reports changes, and a page of rows may leave the end
    // still in reach (a tall sheet). Observing afresh reports where it is now.
    if (pending.length && moreObserver) {
      moreObserver.unobserve(moreEl);
      moreObserver.observe(moreEl);
    }
  }
  const moreObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting) && pending.length) drawMore();
      }, { root: listScroll, rootMargin: "600px 0px" })
    : null;
  moreObserver?.observe(moreEl);

  function render() {
    listEl.replaceChildren();
    pending = [];
    if (!species) {
      countEl.hidden = true;
      if (emptyState) empty(emptyState.icon, t(emptyState.key));
      return;
    }
    const rows = visible();
    countEl.hidden = !rows.length;
    countEl.textContent = String(rows.length);
    if (!species.length) {
      empty("🗺️", t("speciesPage.empty"));
    } else if (!rows.length) {
      empty("🔍", t("speciesPage.noResults", { q: query.trim() }));
    } else {
      pending = rows;
      drawMore();
      // Without an observer there is no "later": draw everything now.
      if (!moreObserver) while (pending.length) drawMore();
    }
  }

  /**
   * Bring the first result up under the pinned strip. A new query or order
   * typed from deep in the list would otherwise leave the reader wherever the
   * old list had them, partway down the new one.
   */
  function toResults() {
    const top = listEl.getBoundingClientRect().top - listScroll.getBoundingClientRect().top
      + listScroll.scrollTop - tools.offsetHeight;
    if (listScroll.scrollTop > top) listScroll.scrollTop = top;
  }

  function empty(icon, text) {
    const box = document.createElement("div");
    box.className = "mp-empty";
    box.innerHTML = `<span class="mp-empty__icon" aria-hidden="true"></span><p></p>`;
    box.querySelector(".mp-empty__icon").textContent = icon;
    box.querySelector("p").textContent = text;
    listEl.appendChild(box);
  }

  // --- controls -------------------------------------------------------------
  sortSelect.addEventListener("change", () => {
    sort = sortSelect.value;
    sortLabel.textContent = t(`speciesPage.sort.${sort}`);
    render();
    toResults();
  });

  pendingBtn.addEventListener("click", () => refreshCb?.());

  function syncPending() {
    pendingBtn.hidden = !pendingCount;
    pendingBtn.textContent = pendingCount ? t("speciesPage.pending", { n: pendingCount }) : "";
  }

  rasterSelect.addEventListener("change", () => {
    fallbackName = "";
    syncRasterLabel();
    rasterCb?.(rasterSelect.value);
  });

  function syncRasterLabel() {
    const opt = rasterSelect.selectedOptions[0];
    rasterLabel.textContent = fallbackName || (opt ? opt.textContent : t("missions.model.auto"));
  }

  // Where there is a picker it already names the source; the line is for
  // where there is none.
  function syncSource() {
    sourceEl.hidden = !sourceName || !rasterBar.hidden;
    sourceEl.textContent = sourceName ? `${t("speciesPage.source")}: ${sourceName}` : "";
  }

  // --- the detail screen ------------------------------------------------------
  function showList() {
    if (screenDetail.hidden) return;
    screenDetail.hidden = true;
    screenList.hidden = false;
    detailSlot.replaceChildren();
    detailBackCb?.();
  }

  function showDetail(element) {
    detailSlot.replaceChildren(element);
    detailSlot.scrollTop = 0;
    screenList.hidden = true;
    screenDetail.hidden = false;
  }

  function refreshI18n() {
    titleEl.textContent = t("speciesPage.title");
    sheetGrab.setAttribute("aria-label", t("map.sheet.resize"));
    search.setLabels({ placeholder: t("speciesPage.search.placeholder"), clear: t("speciesPage.search.clear") });
    sortSelect.setAttribute("aria-label", t("speciesPage.sort.label"));
    sortSelect.replaceChildren(...SORTS.map((k) => {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = t(`speciesPage.sort.${k}`);
      return o;
    }));
    sortSelect.value = sort;
    sortLabel.textContent = t(`speciesPage.sort.${sort}`);
    rasterSelect.setAttribute("aria-label", t("speciesPage.chooseRaster"));
    syncPending();
    setRasters({ ...rasterOffer, selected: rasterSelect.value || "auto" });
    syncSource();
  }

  /**
   * Fill the source picker from what is built here. `selected` is the
   * player's stored pick — the same one the front page's missions use; one
   * not offered here shows as Auto.
   */
  function setRasters({ models = [], defaultModel = null, selected = "auto" } = {}) {
    rasterOffer = { models, defaultModel };
    fillModelSelect(rasterSelect, { models, defaultModel, autoValue: "auto" });
    const offered = [...rasterSelect.options].some((o) => o.value === selected);
    rasterSelect.value = offered ? selected : "auto";
    rasterBar.hidden = models.length < 2;
    syncRasterLabel();
    syncSource();
  }

  refreshI18n();

  return {
    element: root,
    mapSlot,

    /** Called whenever the map's container changes size. */
    onResize(cb) { resizeCb = cb; },

    showDetail,
    showList,
    /** Fires whenever the detail screen is left, however it was left. */
    onDetailBack(cb) { detailBackCb = cb; },

    setRasters,
    onRasterChange(cb) { rasterCb = cb; },
    /** The "still looking names up" note was tapped. */
    onRefresh(cb) { refreshCb = cb; },

    setLoading(on) {
      spinner.hidden = !on;
      // The spinner replaces the list rather than sitting above it.
      listEl.hidden = on;
      if (on) countEl.hidden = true;
    },

    /** The list, or null and what to say instead (`{ icon, key }`). */
    setSpecies(list, { status = null, pending = 0 } = {}) {
      species = Array.isArray(list) ? list : null;
      for (const s of species ?? []) {
        searchText.set(s, fold(`${s.name ?? ""}\n${s.vernacular_name ?? ""}\n${s.family ?? ""}`));
      }
      pendingCount = pending;
      syncPending();
      emptyState = status;
      listScroll.scrollTop = 0;
      render();
    },

    /** Which source's maps the list on screen is of, and whether it is not the pick. */
    setSource({ name = "", fallback = false } = {}) {
      sourceName = name || "";
      fallbackName = fallback ? sourceName : "";
      syncRasterLabel();
      syncSource();
    },

    refreshI18n() { refreshI18n(); render(); },
  };
}
