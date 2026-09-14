// src/ui/components/Herbarium.view.js
import { attachPhoto } from "./SpeciesRow.view.js";
import { getVernacularName } from "../../data/vernacular.service.js";
import { trackNavHeight } from "../navHeight.js";
import { t } from "../../language/i18n.js";

const SORTS = ["newest", "oldest", "az", "za"];

function uiLang() {
  return document.documentElement.lang || "en";
}

function toDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(d) {
  try {
    return new Intl.DateTimeFormat(uiLang(), { day: "numeric", month: "short", year: "numeric" }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/** Case- and accent-blind, so "erable" finds "Érable" and "acer" finds Acer. */
function fold(s) {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const SEARCH_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M10 3a7 7 0 0 1 5.6 11.2l4.6 4.6-1.4 1.4-4.6-4.6A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/></svg>`;
const CLEAR_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7l-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z"/></svg>`;
const CHEVRON_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9.3 6.3 8 7.6l4.4 4.4L8 16.4l1.3 1.3 5.7-5.7z"/></svg>`;
const CARET_ICON = `<svg class="mp-select__caret" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>`;

/**
 * The herbarium: every species the player has ever found.
 *
 * Dressed like the front page's sheet — a brand hero with the count, a
 * search-and-sort strip that stays put while the list scrolls, and the same
 * species rows the map's lists use: common name first, Latin name under it,
 * as the map prints a mission. Tapping a row opens the same species screen
 * the map opens, via the controller.
 *
 * A recent discovery carries its common name; an older one is asked of GBIF
 * when the list is drawn, and its row is filled in as the answer lands.
 */
export function createHerbariumView({ onOpen } = {}) {
  const root = document.createElement("section");
  root.className = "mp-herb";
  root.innerHTML = `
    <div class="mp-hero">
      <div class="mp-hero__top">
        <div>
          <h1 class="mp-hero__title"></h1>
          <p class="mp-hero__subtitle"></p>
        </div>
        <div class="mp-hero__count" aria-hidden="true"><span class="mp-hero__count-n">0</span></div>
      </div>
    </div>

    <div class="mp-herb__tools">
      <label class="mp-search">
        <span class="mp-search__icon">${SEARCH_ICON}</span>
        <input class="mp-search__input" type="search" autocomplete="off" autocorrect="off" spellcheck="false">
        <button class="mp-search__clear" type="button" hidden>${CLEAR_ICON}</button>
      </label>
      <label class="mp-select mp-herb__sort">
        <span class="mp-select__label"></span>
        <select class="mp-select__input"></select>
        ${CARET_ICON}
      </label>
    </div>

    <p class="mp-herb__status" aria-live="polite" hidden></p>
    <div class="mp-list mp-herb__list"></div>
  `;

  const q = (sel) => root.querySelector(sel);
  const subtitleEl = q(".mp-hero__subtitle");
  const countEl = q(".mp-hero__count-n");
  const searchInput = q(".mp-search__input");
  const clearBtn = q(".mp-search__clear");
  const sortSelect = q(".mp-select__input");
  const sortLabel = q(".mp-select__label");
  const statusEl = q(".mp-herb__status");
  const listEl = q(".mp-herb__list");

  let entries = [];
  let query = "";
  let sort = "newest";
  let loaded = false;

  // The strip stays under the page header while the list scrolls (its
  // `top` is --mp-nav-h, see navHeight.js).
  trackNavHeight(root);

  // --- static labels ---------------------------------------------------------
  function labels() {
    q(".mp-hero__title").textContent = t("herbarium.title");
    searchInput.placeholder = t("herbarium.search.placeholder");
    searchInput.setAttribute("aria-label", t("herbarium.search.placeholder"));
    clearBtn.setAttribute("aria-label", t("herbarium.search.clear"));
    sortSelect.setAttribute("aria-label", t("herbarium.sort.label"));
    sortSelect.replaceChildren(...SORTS.map((k) => {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = t(`herbarium.sort.${k}`);
      return o;
    }));
    sortSelect.value = sort;
    sortLabel.textContent = t(`herbarium.sort.${sort}`);
  }
  labels();

  // --- filtering and ordering -----------------------------------------------
  const shown = (e) => e.vernacularName || e.name;

  function visible() {
    const needle = fold(query.trim());
    let rows = needle
      ? entries.filter((e) => fold(e.name).includes(needle) || fold(e.vernacularName).includes(needle))
      : entries.slice();
    const time = (e) => toDate(e.discoveredAt)?.getTime() ?? 0;
    // Ordered by the name that is actually printed large, so an A → Z list
    // reads as one.
    const name = (a, b) => shown(a).localeCompare(shown(b), uiLang(), { sensitivity: "base" });
    switch (sort) {
      case "oldest": rows.sort((a, b) => time(a) - time(b) || name(a, b)); break;
      case "az":     rows.sort(name); break;
      case "za":     rows.sort((a, b) => name(b, a)); break;
      default:       rows.sort((a, b) => time(b) - time(a) || name(a, b));
    }
    return rows;
  }

  function row(entry, index) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "mp-row mp-row--nav";
    el.style.animationDelay = `${Math.min(index, 12) * 22}ms`;
    el.innerHTML = `
      <span class="mp-row__thumb"><span class="mp-row__leaf" aria-hidden="true">🌿</span></span>
      <span class="mp-row__text">
        <span class="mp-row__head"><span class="mp-row__name"></span></span>
        <span class="mp-row__sci" hidden></span>
        <span class="mp-row__date"></span>
      </span>
      <span class="mp-row__chevron" aria-hidden="true">${CHEVRON_ICON}</span>
    `;
    setNames(el, entry);
    const d = toDate(entry.discoveredAt);
    el.querySelector(".mp-row__date").textContent = d
      ? t("herbarium.row.discovered", { date: formatDate(d) })
      : t("herbarium.card.unknownDate");
    attachPhoto(el.querySelector(".mp-row__thumb"), entry.name);
    if (onOpen) el.addEventListener("click", () => onOpen(entry));
    rowsByName.set(entry.name, el);
    return el;
  }

  /** Common name large, Latin beneath — or just the Latin, until there is more. */
  function setNames(el, entry) {
    el.querySelector(".mp-row__name").textContent = shown(entry);
    const sci = el.querySelector(".mp-row__sci");
    sci.textContent = entry.name;
    sci.hidden = !entry.vernacularName;
  }

  /** The rows on screen, so a name that lands late can be written into its row. */
  const rowsByName = new Map();

  // --- common names ------------------------------------------------------------
  // Each entry without one is asked for, all at once (the service queues
  // them). A row is patched in place as its name arrives; the list is only
  // re-sorted or re-filtered once everything is in, so it does not shuffle
  // under the reader's thumb as answers trickle back.
  let namesToken = 0;
  function fetchNames() {
    const token = ++namesToken;
    const lang = uiLang();
    const missing = entries.filter((e) => !e.vernacularName);
    if (!missing.length) return;
    Promise.allSettled(missing.map(async (e) => {
      const v = await getVernacularName({ name: e.name, gbif_id: e.gbif_id, lang });
      if (token !== namesToken || !v) return;
      e.vernacularName = v;
      e._vernacularFromGbif = true;
      const el = rowsByName.get(e.name);
      if (el?.isConnected) setNames(el, e);
    })).then(() => {
      if (token !== namesToken) return;
      if (query.trim() || sort === "az" || sort === "za") render();
    });
  }

  function render() {
    if (!loaded) return;
    const rows = visible();
    countEl.textContent = entries.length;
    subtitleEl.textContent = t("herbarium.hero.subtitle", { n: entries.length });

    listEl.replaceChildren();
    rowsByName.clear();
    if (!entries.length) {
      empty("🌱", t("herbarium.empty"));
    } else if (!rows.length) {
      empty("🔍", t("herbarium.noResults", { q: query.trim() }));
    } else {
      rows.forEach((e, i) => listEl.appendChild(row(e, i)));
    }
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
  searchInput.addEventListener("input", () => {
    query = searchInput.value;
    clearBtn.hidden = !query;
    render();
  });
  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    query = "";
    clearBtn.hidden = true;
    searchInput.focus();
    render();
  });
  sortSelect.addEventListener("change", () => {
    sort = sortSelect.value;
    sortLabel.textContent = t(`herbarium.sort.${sort}`);
    render();
  });

  document.addEventListener("i18n:changed", () => {
    // A name GBIF gave is in the old language; one the discovery itself
    // carries is kept, since that is what the player was told on the day.
    for (const e of entries) if (e._vernacularFromGbif) e.vernacularName = null;
    labels();
    render();
    fetchNames();
  });

  return {
    element: root,

    setStatus(text) {
      statusEl.textContent = text ?? "";
      statusEl.hidden = !text;
    },

    renderEntries(list) {
      entries = Array.isArray(list) ? list : [];
      loaded = true;
      render();
      fetchNames();
    },

    clearEntries() {
      namesToken++;
      entries = [];
      loaded = false;
      listEl.replaceChildren();
      countEl.textContent = "0";
      subtitleEl.textContent = "";
    },

    refreshI18n() { labels(); render(); },
  };
}
