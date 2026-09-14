// src/ui/components/Badges.view.js
import { t } from "../../language/i18n.js";
import { BADGE_DEFINITIONS, BADGE_GROUPS } from "../../data/badges.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function uiLang() {
  return document.documentElement.lang || "en";
}

function formatDate(d) {
  try {
    return new Intl.DateTimeFormat(uiLang(), { day: "numeric", month: "short", year: "numeric" }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

// Flat single-path glyphs in currentColor, the same technique as the map's
// own controls — not emoji, which would land as a different icon set on
// every platform next to the one emoji that *is* the badge.
const CHECK_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M9.6 16.2 5.4 12l-1.4 1.4 5.6 5.6 12-12-1.4-1.4z"/></svg>`;
const LOCK_ICON = `<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"><path fill="currentColor" d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-7-2a2 2 0 1 1 4 0v2h-4V7z"/></svg>`;

/**
 * The badges page.
 *
 * Dressed like the front page's sheet rather than as a heading over a box:
 * a brand-gradient hero that says how far along the collection is and which
 * badge is nearest, then the badges themselves grouped by what earns them,
 * each a medallion whose ring takes the map's grade colours so the top of
 * a series reads as the prize it is.
 */
export function createBadgesView() {
  const root = document.createElement("section");
  root.className = "mp-badges";

  /** Where a countable badge stands, or null for a binary one. */
  function progressOf(def, counts) {
    if (!def.countKey || !def.threshold) return null;
    const current = Math.min(counts[def.countKey] ?? 0, def.threshold);
    return { current, total: def.threshold, pct: current / def.threshold };
  }

  function renderHero(unlockedSet, counts) {
    const total = BADGE_DEFINITIONS.length;
    const unlocked = BADGE_DEFINITIONS.filter((d) => unlockedSet.has(d.id)).length;
    const pct = total ? Math.round((unlocked / total) * 100) : 0;

    // "Next up" is the locked badge with a counter that is closest to
    // done. Binary badges have no distance to report, so they never win
    // this slot; when everything countable is already unlocked the hero
    // simply says so instead.
    let next = null;
    for (const def of BADGE_DEFINITIONS) {
      if (unlockedSet.has(def.id)) continue;
      const p = progressOf(def, counts);
      if (!p) continue;
      if (!next || p.pct > next.p.pct) next = { def, p };
    }

    const hero = document.createElement("div");
    hero.className = `mp-hero mp-badges__hero${unlocked === total ? " is-complete" : ""}`;
    hero.innerHTML = `
      <div class="mp-hero__top">
        <div>
          <h1 class="mp-hero__title"></h1>
          <p class="mp-hero__subtitle"></p>
        </div>
        <div class="mp-hero__count" aria-hidden="true">
          <span class="mp-hero__count-n"></span><span class="mp-hero__count-of"></span>
        </div>
      </div>
      <div class="mp-badges__rail" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${unlocked}">
        <span class="mp-badges__fill" style="width:${pct}%"></span>
      </div>
      <div class="mp-badges__next" hidden>
        <span class="mp-badges__next-emoji" aria-hidden="true"></span>
        <div class="mp-badges__next-body">
          <span class="mp-badges__next-label"></span>
          <span class="mp-badges__next-name"></span>
        </div>
        <span class="mp-badges__next-meta"></span>
      </div>
    `;
    hero.querySelector(".mp-hero__title").textContent = t("badges.title");
    hero.querySelector(".mp-hero__subtitle").textContent = unlocked === total
      ? t("badges.summary.complete")
      : t("badges.summary.unlocked", { n: unlocked, total });
    hero.querySelector(".mp-hero__count-n").textContent = unlocked;
    hero.querySelector(".mp-hero__count-of").textContent = `/${total}`;

    if (next) {
      const box = hero.querySelector(".mp-badges__next");
      box.hidden = false;
      box.querySelector(".mp-badges__next-emoji").textContent = next.def.emoji;
      box.querySelector(".mp-badges__next-label").textContent = t("badges.summary.next");
      box.querySelector(".mp-badges__next-name").textContent = t(next.def.nameKey);
      box.querySelector(".mp-badges__next-meta").textContent = `${next.p.current} / ${next.p.total}`;
    }
    return hero;
  }

  function renderTile(def, unlockedSet, counts, dates, index) {
    const isUnlocked = unlockedSet.has(def.id);
    const p = isUnlocked ? null : progressOf(def, counts);

    const tile = document.createElement("article");
    tile.className = `mp-badge mp-badge--${def.tier || "common"} ${isUnlocked ? "is-unlocked" : "is-locked"}`;
    // Tiles land one after another rather than all at once, like the
    // result modal's detail lines.
    tile.style.animationDelay = `${Math.min(index, 16) * 28}ms`;
    tile.innerHTML = `
      <div class="mp-badge__medal">
        <span class="mp-badge__emoji" aria-hidden="true"></span>
        <span class="mp-badge__state" aria-hidden="true">${isUnlocked ? CHECK_ICON : LOCK_ICON}</span>
      </div>
      <div class="mp-badge__body">
        <p class="mp-badge__name"></p>
        <p class="mp-badge__desc"></p>
        <div class="mp-badge__foot"></div>
      </div>
    `;
    tile.querySelector(".mp-badge__emoji").textContent = def.emoji;
    tile.querySelector(".mp-badge__name").textContent = t(def.nameKey);
    tile.querySelector(".mp-badge__desc").textContent = t(def.descKey);

    const foot = tile.querySelector(".mp-badge__foot");
    const state = isUnlocked ? t("badges.tile.unlocked") : t("badges.tile.locked");
    tile.setAttribute("aria-label", `${t(def.nameKey)} — ${state}`);

    if (isUnlocked) {
      const when = dates?.get(def.id);
      const line = document.createElement("span");
      line.className = "mp-badge__date";
      line.textContent = when ? t("badges.tile.unlockedOn", { date: formatDate(when) }) : state;
      foot.appendChild(line);
    } else if (p) {
      foot.innerHTML = `
        <span class="mp-badge__rail"><span class="mp-badge__fill" style="width:${Math.round(p.pct * 100)}%"></span></span>
        <span class="mp-badge__meta">${p.current} / ${p.total}</span>
      `;
    } else {
      const line = document.createElement("span");
      line.className = "mp-badge__date";
      line.textContent = state;
      foot.appendChild(line);
    }
    return tile;
  }

  function render(unlockedSet, counts = {}, dates = new Map()) {
    root.replaceChildren(renderHero(unlockedSet, counts));

    let index = 0;
    for (const group of BADGE_GROUPS) {
      const defs = BADGE_DEFINITIONS.filter((d) => d.group === group);
      if (!defs.length) continue;
      const done = defs.filter((d) => unlockedSet.has(d.id)).length;

      const section = document.createElement("section");
      section.className = "mp-badges__group";
      section.innerHTML = `
        <div class="mp-badges__group-head">
          <h2 class="mp-badges__group-title"></h2>
          <span class="mp-badges__group-count"></span>
        </div>
        <div class="mp-badges__grid"></div>
      `;
      section.querySelector(".mp-badges__group-title").textContent = t(`badges.group.${group}`);
      section.querySelector(".mp-badges__group-count").textContent = `${done}/${defs.length}`;
      if (done === defs.length) section.classList.add("is-complete");

      const grid = section.querySelector(".mp-badges__grid");
      for (const def of defs) grid.appendChild(renderTile(def, unlockedSet, counts, dates, index++));
      root.appendChild(section);
    }
  }

  document.addEventListener("i18n:changed", () => {
    if (root._lastUnlocked) render(root._lastUnlocked, root._lastCounts, root._lastDates);
  });

  function showStatus(text, { busy = false } = {}) {
    root.innerHTML = `<div class="mp-badges__status"></div>`;
    const box = root.firstElementChild;
    if (busy) {
      box.innerHTML = `<span class="fetch-loading"><span class="loading-spinner"></span></span>`;
      box.querySelector(".fetch-loading").append(text);
    } else {
      box.textContent = text;
    }
  }

  return {
    element: root,

    update(unlockedSet, counts = {}, dates = new Map()) {
      root._lastUnlocked = unlockedSet;
      root._lastCounts = counts;
      root._lastDates = dates;
      render(unlockedSet, counts, dates);
    },

    showLoading() {
      showStatus(t("badges.loading"), { busy: true });
    },

    showError() {
      root._lastUnlocked = null;
      showStatus(t("badges.error"));
    },
  };
}
