// src/ui/components/ObservationsHistory.view.js
import { attachPhoto } from "./SpeciesRow.view.js";
import { MISSION_BONUS_BY_TIER } from "../../data/missions.repo.js";
import { trackNavHeight } from "../navHeight.js";
import { t } from "../../language/i18n.js";

// The base observation points head the breakdown, the same key and the same
// treatment as the result modal (see ResultModal.view.js).
const BASE_KEY = "points.baseObs";

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

function toDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateTime(d) {
  try {
    return new Intl.DateTimeFormat(uiLang(), {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function formatInt(n) {
  try { return new Intl.NumberFormat(uiLang()).format(n); } catch { return String(n); }
}

/**
 * Which stretch of time an observation belongs to, for the headings that
 * divide the list. Coarse near the present, where "today" and "yesterday"
 * mean something, then by month once it is all just the past.
 */
function periodOf(d, now = new Date()) {
  if (!d) return { key: "unknown", label: t("herbarium.card.unknownDate") };
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const daysAgo = Math.round((day(now) - day(d)) / 86400000);
  if (daysAgo <= 0) return { key: "today", label: t("observations.period.today") };
  if (daysAgo === 1) return { key: "yesterday", label: t("observations.period.yesterday") };
  if (daysAgo < 7) return { key: "week", label: t("observations.period.week") };
  const sameMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (sameMonth) return { key: "month", label: t("observations.period.month") };
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (d.getFullYear() === last.getFullYear() && d.getMonth() === last.getMonth()) {
    return { key: "lastMonth", label: t("observations.period.lastMonth") };
  }
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  let label;
  try {
    label = new Intl.DateTimeFormat(uiLang(), { month: "long", year: "numeric" }).format(d);
    label = label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    label = key;
  }
  return { key, label };
}

/** The same four steps the result modal grades a find on, off its base points. */
function rarityOf(base) {
  return base >= 1500 ? "legendary" : base >= 1000 ? "epic" : base >= 500 ? "rare" : "common";
}

/** The mission bonus is stored as an amount; the grade it came from is read back off the table. */
function missionTierOf(bonus) {
  return Object.keys(MISSION_BONUS_BY_TIER).find((k) => MISSION_BONUS_BY_TIER[k] === Number(bonus)) || null;
}

const CHEVRON_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7.4 8.6 6 10l6 6 6-6-1.4-1.4-4.6 4.6z"/></svg>`;
const PIN_ICON = `<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>`;
const LEAF_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M17 8C8 10 5.9 16.2 3.8 21.4l1.9.6.9-2.2c.6.2 1.3.2 1.9.2 6.5 0 10.5-5.7 10.5-14 0 0-1.4 1.6-2 2z"/></svg>`;

/**
 * Every observation the player has made, newest first.
 *
 * Each is a card whose head is the find — photo, species, when, how sure —
 * with its points chip on the right, graded the way the result modal grades
 * it. Tapping the head unfolds the same breakdown the modal shows: the base
 * line on its own ground, each bonus line added under it, the mission and
 * new-species pills, and the total. From there the species itself opens in
 * the same screen the map uses.
 */
export function createObservationsHistoryView({ onOpenSpecies } = {}) {
  const root = document.createElement("section");
  root.className = "mp-obs";
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

    <p class="mp-obs__status" aria-live="polite" hidden></p>
    <div class="mp-obs__list"></div>
    <div class="mp-spinner" hidden aria-hidden="true"></div>
    <div class="mp-obs__sentinel"></div>
  `;

  const q = (sel) => root.querySelector(sel);
  const titleEl = q(".mp-hero__title");
  const subtitleEl = q(".mp-hero__subtitle");
  const countEl = q(".mp-hero__count-n");
  const statusEl = q(".mp-obs__status");
  const listEl = q(".mp-obs__list");
  const spinnerEl = q(".mp-spinner");
  const sentinel = q(".mp-obs__sentinel");

  trackNavHeight(root);

  let allEntries = [];
  let totals = null;
  /** The group section currently at the foot of the list, and its period. */
  let tailGroup = null;
  let tailKey = null;
  /** Which cards are unfolded, by observation id, so a re-render keeps them so. */
  const open = new Set();

  function labels() {
    titleEl.textContent = t("observations.title");
    if (totals) {
      countEl.textContent = formatInt(totals.observations);
      subtitleEl.textContent = t("observations.hero.points", { pts: formatInt(totals.points) });
    } else {
      countEl.textContent = formatInt(allEntries.length);
      subtitleEl.textContent = "";
    }
  }
  labels();

  // --- one observation --------------------------------------------------------
  function card(obs, index) {
    const base = Number(obs.total_points || 0);
    const discovery = Number(obs.bonus?.discovery || 0);
    const mission = Number(obs.bonus?.mission || 0);
    const total = base + discovery + mission;
    const rarity = rarityOf(base);
    const when = toDate(obs.observedAt);
    const name = obs.speciesName || "";
    const isOpen = open.has(obs.id);

    const el = document.createElement("article");
    el.className = `mp-obs-card${isOpen ? " is-open" : ""}`;
    el.style.animationDelay = `${Math.min(index, 12) * 22}ms`;
    el.innerHTML = `
      <button class="mp-obs-card__head" type="button" aria-expanded="${isOpen}">
        <span class="mp-row__thumb"><span class="mp-row__leaf" aria-hidden="true">🌿</span></span>
        <span class="mp-obs-card__text">
          <span class="mp-obs-card__name"></span>
          <span class="mp-obs-card__meta"></span>
          <span class="mp-obs-card__tags"></span>
        </span>
        <span class="mp-obs-card__side">
          <span class="points-badge ${rarity}-points mp-obs-card__chip">
            <span class="value">${escapeHtml(String(base))} <span class="rarity-label"></span></span>
          </span>
          <span class="mp-obs-card__chevron" aria-hidden="true">${CHEVRON_ICON}</span>
        </span>
      </button>
      <div class="mp-obs-card__body" ${isOpen ? "" : "hidden"}>
        <div class="details mp-obs-card__details"></div>
        <div class="badges big mp-obs-card__badges"></div>
        <div class="result-total mp-obs-card__total">
          <span></span> <strong>${escapeHtml(formatInt(total))}</strong> <span></span>
        </div>
        <div class="mp-obs-card__foot"></div>
      </div>
    `;

    const nameEl = el.querySelector(".mp-obs-card__name");
    if (name) nameEl.textContent = name;
    else { nameEl.textContent = t("result.unknownSpecies"); nameEl.classList.add("is-unknown"); }

    const bits = [];
    if (when) bits.push(formatDateTime(when));
    if (obs.plantnet_identify_score != null) {
      bits.push(`${t("result.confidence").trim()} ${Math.round(Number(obs.plantnet_identify_score) * 100)}%`);
    }
    el.querySelector(".mp-obs-card__meta").textContent = bits.join(" · ");
    el.querySelector(".rarity-label").textContent = t(`result.rarity.${rarity}`);

    // Tags on the head, so what made this find special shows folded up too.
    const tags = el.querySelector(".mp-obs-card__tags");
    const tag = (text, kind) => {
      const s = document.createElement("span");
      s.className = `mp-tag mp-tag--${kind}`;
      s.textContent = text;
      tags.appendChild(s);
    };
    if (discovery > 0) tag(t("result.badge.newSpecies"), "chance");
    if (mission > 0) tag(t("result.badge.missionAccomplished"), missionTierOf(mission) || "common");
    if (obs.nearbyDuplicate) tag(t("result.badge.nearbyDuplicate"), "pheno");

    // --- the breakdown: same rows, same order, same classes as the modal ---
    const details = el.querySelector(".mp-obs-card__details");
    const entries = Object.entries(obs.points || {});
    const line = (key, value, isBase) => {
      const row = document.createElement("div");
      row.className = "detail-line" + (isBase ? " detail-line--base" : "");
      row.setAttribute("data-k", key);
      row.innerHTML = `<span>${escapeHtml(t(key))}</span><span>${isBase ? "" : "+"}${escapeHtml(String(value))}</span>`;
      return row;
    };
    for (const [k, v] of entries.filter(([k]) => k === BASE_KEY)) details.appendChild(line(k, v, true));
    for (const [k, v] of entries.filter(([k]) => k !== BASE_KEY)) details.appendChild(line(k, v, false));

    const badges = el.querySelector(".mp-obs-card__badges");
    const pill = ({ emoji, label, bonus, tier }) => {
      const b = document.createElement("div");
      b.className = "badge big in";
      if (tier) b.classList.add("badge--mission", `badge--${tier}`);
      b.innerHTML = `<span class="icon">${emoji}</span><span class="txt">${escapeHtml(label)}</span><span class="add">+${escapeHtml(String(bonus))}</span>`;
      return b;
    };
    if (mission > 0) {
      const tier = missionTierOf(mission) || "common";
      badges.appendChild(pill({
        emoji: "🎯",
        label: `${t("result.badge.missionAccomplished")} · ${t(`missions.card.${tier}`)}`,
        bonus: mission,
        tier,
      }));
    }
    if (discovery > 0) badges.appendChild(pill({ emoji: "🆕", label: t("result.badge.newSpecies"), bonus: discovery }));
    if (!badges.children.length) badges.hidden = true;

    const totalSpans = el.querySelectorAll(".mp-obs-card__total > span");
    totalSpans[0].textContent = t("result.total");
    totalSpans[1].textContent = t("result.ptsShort");

    // --- foot: where, and the way to the species --------------------------
    const foot = el.querySelector(".mp-obs-card__foot");
    const lat = obs.location?.latitude;
    const lon = obs.location?.longitude;
    if (lat != null && lon != null) {
      const a = document.createElement("a");
      a.className = "mp-obs-card__coords";
      a.href = `geo:${lat},${lon}?q=${lat},${lon}`;
      a.innerHTML = `${PIN_ICON}<span></span>`;
      a.querySelector("span").textContent = `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`;
      foot.appendChild(a);
    }
    if (name && onOpenSpecies) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mp-obs-card__species";
      b.innerHTML = `${LEAF_ICON}<span></span>`;
      b.querySelector("span").textContent = t("observations.card.viewSpecies");
      b.addEventListener("click", () => onOpenSpecies(obs));
      foot.appendChild(b);
    }

    // --- fold / unfold ------------------------------------------------------
    const head = el.querySelector(".mp-obs-card__head");
    const body = el.querySelector(".mp-obs-card__body");
    head.setAttribute("aria-label", `${name || t("result.unknownSpecies")} — ${formatInt(total)} ${t("result.ptsShort")}`);
    head.addEventListener("click", () => {
      const now = !el.classList.contains("is-open");
      el.classList.toggle("is-open", now);
      body.hidden = !now;
      head.setAttribute("aria-expanded", String(now));
      if (now) open.add(obs.id); else open.delete(obs.id);
    });

    if (name) attachPhoto(el.querySelector(".mp-row__thumb"), name);
    return el;
  }

  // --- date groups ------------------------------------------------------------
  // Cards go under a heading for their stretch of time. The heading sticks
  // under the page header while its group scrolls past, and the next group's
  // heading shoves it out — so whatever is on screen, its period is named
  // at the top. A later page of results joins the last group when it
  // belongs there, rather than starting the same month over.
  function groupFor(period) {
    if (tailGroup && tailKey === period.key) return tailGroup;
    const section = document.createElement("section");
    section.className = "mp-obs__group";
    section.innerHTML = `
      <h2 class="mp-obs__period"><span></span><span class="mp-obs__period-count">0</span></h2>
      <div class="mp-list mp-obs__group-list"></div>
    `;
    section.querySelector(".mp-obs__period span").textContent = period.label;
    listEl.appendChild(section);
    tailGroup = section;
    tailKey = period.key;
    return section;
  }

  function append(entries, startIndex = 0) {
    const now = new Date();
    entries.forEach((e, i) => {
      const group = groupFor(periodOf(toDate(e.observedAt), now));
      const list = group.querySelector(".mp-obs__group-list");
      list.appendChild(card(e, startIndex + i));
      group.querySelector(".mp-obs__period-count").textContent = list.children.length;
    });
  }

  function renderAll() {
    listEl.replaceChildren();
    tailGroup = null;
    tailKey = null;
    if (!allEntries.length) {
      const box = document.createElement("div");
      box.className = "mp-empty";
      box.innerHTML = `<span class="mp-empty__icon" aria-hidden="true">📷</span><p></p>`;
      box.querySelector("p").textContent = t("observations.empty");
      listEl.appendChild(box);
      return;
    }
    append(allEntries);
  }

  document.addEventListener("i18n:changed", () => { labels(); renderAll(); });

  return {
    element: root,
    sentinel,

    setStatus(text) {
      statusEl.textContent = text ?? "";
      statusEl.hidden = !text;
    },

    setTotals(next) {
      totals = next;
      labels();
    },

    setLoadingMore(loading) {
      spinnerEl.hidden = !loading;
    },

    clearEntries() {
      allEntries = [];
      open.clear();
      listEl.replaceChildren();
      tailGroup = null;
      tailKey = null;
      labels();
    },

    // First page — clears the list first.
    renderEntries(entries) {
      allEntries = Array.isArray(entries) ? [...entries] : [];
      renderAll();
      labels();
    },

    // Later pages — appended without clearing.
    appendEntries(entries) {
      if (!Array.isArray(entries) || !entries.length) return;
      const start = allEntries.length;
      allEntries = [...allEntries, ...entries];
      append(entries, start);
      labels();
    },
  };
}
