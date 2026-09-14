// src/ui/components/MapPage.view.js
import { t } from "../../language/i18n.js";

/**
 * The shell the mission map lives in.
 *
 * Three bands and two floating layers: the map fills the screen, a capsule of
 * tabs floats over the top of it, a sheet rides over its bottom edge, and the
 * camera sits above everything where a thumb reaches. The map itself is not
 * built here — it is mounted into `mapSlot` — because Leaflet measures its
 * container on init and this layout decides that container's height.
 *
 * The sheet's height is fixed rather than sized to its contents. A panel that
 * grew and shrank with the list resized the map underneath it on every load,
 * which read as the map reloading; a stable sheet that scrolls its own
 * contents is both calmer and how every map app on a phone behaves.
 */
export function createMapPageView() {
  const root = document.createElement("div");
  root.className = "mp-shell";
  root.innerHTML = `
    <div id="mapSlot" class="mp-map"></div>

    <!-- Daily quests, top-left over the map. -->
    <div id="questsSlot" class="mp-quests-slot"></div>

    <div class="mp-tabs" role="tablist">
      <button class="mp-tab is-active" id="tabMissions" type="button" role="tab" aria-selected="true"></button>
      <button class="mp-tab" id="tabAround" type="button" role="tab" aria-selected="false"></button>
      <button class="mp-tab mp-tab--chal" id="tabChallenge" type="button" role="tab" aria-selected="false" hidden></button>
    </div>

    <div class="mp-sheet">
      <button type="button" class="mp-sheet__grab" id="sheetGrab" data-sheet-grab aria-label=""></button>

      <div id="screenList" class="mp-screen">
        <div class="mp-sheet__head">
          <h2 id="paneTitle" class="mp-sheet__title"></h2>
          <button id="paneInfo" class="mp-sheet__info" type="button" hidden>
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4.6a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6zM13.2 17h-2.4v-6.4h2.4V17z"/>
            </svg>
          </button>
          <span id="paneCount" class="mp-sheet__count" hidden></span>
        </div>
        <div class="mp-sheet__scroll">
          <section id="paneMissions">
            <div id="missionsSpinner" class="mp-spinner" hidden aria-hidden="true"></div>
            <div id="missionsList" class="mp-list"></div>
          </section>
          <section id="paneAround" hidden>
            <div class="mp-around-bar">
              <label class="mp-select" id="aroundModelWrap">
                <span class="mp-select__label" id="aroundModelLabel"></span>
                <select class="mp-select__input" id="aroundModel"></select>
                <svg class="mp-select__caret" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                  <path fill="currentColor" d="M7 10l5 5 5-5z"/>
                </svg>
              </label>
              <button class="mp-icon-btn" id="aroundRefresh" type="button">
                <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>
              </button>
            </div>
            <p class="mp-around-model" id="aroundModelUsed" hidden></p>
            <div id="aroundSpinner" class="mp-spinner" hidden aria-hidden="true"></div>
            <div id="aroundList" class="mp-list"></div>
          </section>
          <section id="paneChallenge" hidden></section>
        </div>
      </div>

      <div id="screenDetail" class="mp-screen mp-screen--detail" hidden>
        <div class="mp-sheet__scroll" id="detailSlot"></div>
      </div>
    </div>

    <div class="mp-fab-wrap">
      <button id="observeBtn" class="mp-fab" type="button">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M9 4.5c.4-.7 1.1-1.1 1.9-1.1h2.2c.8 0 1.5.4 1.9 1.1l.7 1.2H18c1.7 0 3 1.3 3 3v8c0 1.7-1.3 3-3 3H6c-1.7 0-3-1.3-3-3v-8c0-1.7 1.3-3 3-3h2.3L9 4.5zm3 12.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/>
        </svg>
        <span id="observeLabel"></span>
      </button>
    </div>

    <div id="observeSheet" class="mp-observe" aria-hidden="true">
      <span class="mp-observe__grab" aria-hidden="true"></span>
      <button id="observeClose" class="mp-observe__close" type="button">×</button>
      <div id="observeSlot" class="mp-observe__body"></div>
    </div>
  `;

  const q = (sel) => root.querySelector(sel);
  const tabMissions = q("#tabMissions");
  const tabAround = q("#tabAround");
  const tabChallenge = q("#tabChallenge");
  const tabsWrap = q(".mp-tabs");
  const questsSlot = q("#questsSlot");
  const mapSlot = q("#mapSlot");
  const sheet = q(".mp-sheet");
  const sheetGrab = q("#sheetGrab");
  const screenList = q("#screenList");
  const screenDetail = q("#screenDetail");
  const detailSlot = q("#detailSlot");
  const paneMissions = q("#paneMissions");
  const paneAround = q("#paneAround");
  const paneChallenge = q("#paneChallenge");
  const paneTitle = q("#paneTitle");
  const paneInfo = q("#paneInfo");
  const paneCount = q("#paneCount");
  const missionsSpinner = q("#missionsSpinner");
  const aroundSpinner = q("#aroundSpinner");
  const missionsList = q("#missionsList");
  const aroundList = q("#aroundList");
  const aroundModelSelect = q("#aroundModel");
  const aroundModelLabel = q("#aroundModelLabel");
  const aroundModelUsed = q("#aroundModelUsed");
  const aroundRefreshBtn = q("#aroundRefresh");
  const observeBtn = q("#observeBtn");
  const observeLabel = q("#observeLabel");
  const observeSheet = q("#observeSheet");
  const observeClose = q("#observeClose");
  const observeSlot = q("#observeSlot");

  let activeTab = "missions";
  let counts = { missions: null, around: null, challenge: null };
  let challengeTitle = "";
  let tabSwitchCb = null;
  let infoCb = null;
  let aroundRefreshCb = null;
  let aroundModelCb = null;
  // The name the backend reported for the list on screen, kept so the line can
  // be re-rendered in a new language without refetching.
  let aroundModelUsedName = "";
  let observeCb = null;
  let sheetCloseCb = null;
  let resizeCb = null;
  let detailBackCb = null;

  const TABS = {
    missions:  { btn: tabMissions,  pane: paneMissions,  titleKey: "map.here.title" },
    around:    { btn: tabAround,    pane: paneAround,    titleKey: "map.around.title" },
    challenge: { btn: tabChallenge, pane: paneChallenge, titleKey: null },
  };

  function syncHead() {
    // The challenge screen's title is the challenge's own name, which only the
    // controller knows; every other tab has a fixed one.
    const { titleKey } = TABS[activeTab];
    paneTitle.textContent = titleKey ? t(titleKey) : challengeTitle;
    // Only the two model-driven lists have an explainer; the challenge screen
    // speaks for itself.
    paneInfo.hidden = activeTab === "challenge";
    paneInfo.setAttribute("aria-label", t("map.info.open"));
    paneInfo.title = t("map.info.open");
    const count = counts[activeTab];
    paneCount.hidden = !count;
    paneCount.textContent = count ? String(count) : "";
  }

  function setActiveTab(tab, { notify = true } = {}) {
    if (!TABS[tab]) return;
    // The challenge tab is only in the capsule while a challenge is running.
    if (tab === "challenge" && tabChallenge.hidden) return;
    activeTab = tab;

    for (const [name, { btn, pane }] of Object.entries(TABS)) {
      const on = name === tab;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", String(on));
      pane.hidden = !on;
    }
    showList();
    syncHead();

    // With three tabs on a narrow phone the capsule scrolls rather than
    // sliding under the quest chip or the map controls, so the tab just
    // chosen has to be brought into view.
    TABS[tab].btn.scrollIntoView?.({ block: "nearest", inline: "nearest" });

    // The map keeps its full height on the missions tab, where it *is* the
    // page, and shrinks on the other two, where the list is what the player
    // came for.
    root.classList.toggle("mp-shell--compact", tab !== "missions");
    // Leaflet has no idea its container just changed size. Once now, once
    // after the frame the new sizes land on — the first alone has measured a
    // stale height on Safari.
    resizeCb?.();
    requestAnimationFrame(() => resizeCb?.());

    if (notify) tabSwitchCb?.(tab);
  }

  tabMissions.addEventListener("click", () => setActiveTab("missions"));
  tabAround.addEventListener("click", () => setActiveTab("around"));
  tabChallenge.addEventListener("click", () => setActiveTab("challenge"));
  paneInfo.addEventListener("click", () => infoCb?.(activeTab));
  aroundRefreshBtn.addEventListener("click", () => aroundRefreshCb?.());
  aroundModelSelect.addEventListener("change", () => {
    syncAroundModelLabel();
    aroundModelCb?.(aroundModelSelect.value);
  });
  observeBtn.addEventListener("click", () => observeCb?.());
  observeClose.addEventListener("click", () => closeObserveSheet());

  // The sheet is deliberately the same height on both screens. Growing it for
  // the detail view resized the map underneath, and a map that re-lays out
  // under your thumb the moment you tap a pin reads as the page reloading.
  // The detail scrolls instead.
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

  function openObserveSheet() {
    observeSheet.setAttribute("aria-hidden", "false");
    observeSheet.classList.add("is-open");
  }

  function closeObserveSheet() {
    if (observeSheet.getAttribute("aria-hidden") === "true") return;
    observeSheet.setAttribute("aria-hidden", "true");
    observeSheet.classList.remove("is-open");
    sheetCloseCb?.();
  }

  // --- sheet drag-resize ---
  // The 44%/34% split above is only a default. Dragging the grab handle sets
  // an explicit pixel height on the sheet (and lets the map claim whatever's
  // left) which, being inline, outranks those percentages — so once the
  // player has sized it once, it holds that size across tab switches too.
  const SHEET_MIN_H = 140; // enough for the grab + head with a sliver of list
  const MAP_MIN_H = 96;    // the map never fully disappears under the sheet
  let dragPointerId = null;
  let dragStartY = 0;
  let dragStartHeight = 0;
  let pendingHeight = null;
  let dragRaf = null;

  function clampSheetHeight(px) {
    const max = Math.max(SHEET_MIN_H, root.getBoundingClientRect().height - MAP_MIN_H);
    return Math.min(max, Math.max(SHEET_MIN_H, px));
  }

  function applySheetHeight(px) {
    sheet.style.flex = `0 0 ${px}px`;
    mapSlot.style.flex = "1 1 auto";
  }

  function flushDrag() {
    dragRaf = null;
    if (pendingHeight == null) return;
    applySheetHeight(pendingHeight);
    resizeCb?.();
  }

  function stepSheetHeight(deltaPx) {
    applySheetHeight(clampSheetHeight(sheet.getBoundingClientRect().height + deltaPx));
    resizeCb?.();
    requestAnimationFrame(() => resizeCb?.());
  }

  // The pill is not the only handle. Anything inside the sheet marked
  // `data-sheet-grab` starts the same drag — the detail screen's back bar
  // uses it for the blank stretch between its two controls, which sits
  // pinned right under the pill and is what a thumb reaching for the pill
  // actually lands on. The pointer is captured by the pill's button
  // regardless of which handle caught it, so the move/up listeners below
  // stay in one place.
  sheet.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    if (dragPointerId !== null) return;
    if (!(e.target instanceof Element) || !e.target.closest("[data-sheet-grab]")) return;
    dragPointerId = e.pointerId;
    dragStartY = e.clientY;
    dragStartHeight = sheet.getBoundingClientRect().height;
    sheet.classList.add("mp-sheet--dragging");
    sheetGrab.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  sheetGrab.addEventListener("pointermove", (e) => {
    if (dragPointerId === null || e.pointerId !== dragPointerId) return;
    pendingHeight = clampSheetHeight(dragStartHeight + (dragStartY - e.clientY));
    if (dragRaf == null) dragRaf = requestAnimationFrame(flushDrag);
  });

  function endSheetDrag(e) {
    if (dragPointerId === null || e.pointerId !== dragPointerId) return;
    dragPointerId = null;
    sheet.classList.remove("mp-sheet--dragging");
    if (dragRaf != null) { cancelAnimationFrame(dragRaf); dragRaf = null; }
    flushDrag();
    requestAnimationFrame(() => resizeCb?.());
  }
  sheetGrab.addEventListener("pointerup", endSheetDrag);
  sheetGrab.addEventListener("pointercancel", endSheetDrag);

  // Arrow keys give keyboard users the same control once the handle is focused.
  sheetGrab.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") { e.preventDefault(); stepSheetHeight(24); }
    else if (e.key === "ArrowDown") { e.preventDefault(); stepSheetHeight(-24); }
  });

  /** Replace a list's contents, or stand an illustrated empty state in. */
  function fill(listEl, rows, { icon, text }) {
    listEl.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "mp-empty";
      empty.innerHTML = `<span class="mp-empty__icon" aria-hidden="true"></span><p></p>`;
      empty.querySelector(".mp-empty__icon").textContent = icon;
      empty.querySelector("p").textContent = text;
      listEl.appendChild(empty);
      return;
    }
    for (const row of rows) listEl.appendChild(row);
  }

  /**
   * Fill the model picker from what the backend offers here.
   *
   * "Auto" names the model it would pick for this location, so choosing it is
   * not a blind option. A selection the player already made survives the
   * refill as long as that model is still offered. Called once at init with
   * nothing, so the picker is never an empty select while the list loads.
   */
  function setAroundModels({ models = [], defaultModel = null } = {}) {
    const previous = aroundModelSelect.value;
    const defaultName = defaultModel
      ? (models.find((m) => m.id === defaultModel)?.name ?? defaultModel)
      : null;

    aroundModelSelect.replaceChildren();

    const auto = document.createElement("optgroup");
    auto.label = t("missions.model.group.default");
    const autoOpt = document.createElement("option");
    autoOpt.value = "best";
    autoOpt.textContent = defaultName
      ? `${t("missions.model.auto")} (${defaultName})`
      : t("missions.model.auto");
    auto.appendChild(autoOpt);
    aroundModelSelect.appendChild(auto);

    if (models.length) {
      const group = document.createElement("optgroup");
      group.label = t("missions.model.group.available");
      for (const m of models) {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.name;
        group.appendChild(opt);
      }
      aroundModelSelect.appendChild(group);
    }

    const keep = previous && previous !== "best"
      && [...aroundModelSelect.options].some((o) => o.value === previous);
    aroundModelSelect.value = keep ? previous : "best";
    syncAroundModelLabel();
  }

  // The pill shows the chosen model's own name; the native <select> behind it
  // is what actually opens, so the picker is the platform's and the chrome is
  // ours.
  function syncAroundModelLabel() {
    const opt = aroundModelSelect.selectedOptions[0];
    aroundModelLabel.textContent = opt ? opt.textContent : t("missions.model.auto");
  }

  function syncAroundModelUsed() {
    aroundModelUsed.hidden = !aroundModelUsedName;
    aroundModelUsed.textContent = aroundModelUsedName
      ? `${t("missions.modelUsed")}: ${aroundModelUsedName}`
      : "";
  }

  function refreshI18n() {
    tabMissions.textContent = t("missions.tab.missions");
    tabAround.textContent = t("missions.tab.aroundYou");
    aroundRefreshBtn.setAttribute("aria-label", t("missions.refresh.around"));
    aroundRefreshBtn.title = t("missions.refresh.around");
    aroundModelSelect.setAttribute("aria-label", t("missions.chooseModel"));
    syncAroundModelLabel();
    syncAroundModelUsed();
    observeLabel.textContent = t("map.observe");
    observeClose.setAttribute("aria-label", t("common.close"));
    sheetGrab.setAttribute("aria-label", t("map.sheet.resize"));
    syncHead();
  }
  setAroundModels();
  refreshI18n();

  return {
    element: root,
    mapSlot,
    observeSlot,
    questsSlot,

    getActiveTab: () => activeTab,
    setActiveTab,
    onTabSwitch(cb) { tabSwitchCb = cb; },
    /** Called whenever the map's container changes size. */
    onResize(cb) { resizeCb = cb; },

    showDetail,
    showList,
    isShowingDetail: () => !screenDetail.hidden,
    /** Fires whenever the detail screen is left, however it was left. */
    onDetailBack(cb) { detailBackCb = cb; },

    setMissionsLoading(on) {
      missionsSpinner.hidden = !on;
      // The spinner replaces the list rather than sitting above it: a stale
      // "you are standing in nothing" under a spinner reads as an answer.
      missionsList.hidden = on;
      if (on) { counts.missions = null; syncHead(); }
    },

    setAroundLoading(on) {
      aroundSpinner.hidden = !on;
      aroundList.hidden = on;
      aroundRefreshBtn.disabled = on;
      aroundRefreshBtn.classList.toggle("is-busy", on);
      if (on) { counts.around = null; syncHead(); }
    },

    setAroundModels,

    getAroundModel: () => aroundModelSelect.value || "best",

    /** Which model actually produced the list on screen. */
    setAroundModelUsed(name) {
      aroundModelUsedName = name || "";
      syncAroundModelUsed();
    },

    renderValidMissions(rows, { locating = false } = {}) {
      counts.missions = rows.length;
      syncHead();
      fill(missionsList, rows, locating
        ? { icon: "📍", text: t("map.here.locating") }
        : { icon: "🥾", text: t("map.here.empty") });
    },

    renderAround(rows) {
      counts.around = rows.length;
      syncHead();
      fill(aroundList, rows, { icon: "🌿", text: t("map.around.empty") });
    },

    /** The challenge screen is mounted once and kept; only its tab comes and goes. */
    mountChallenge(element) { paneChallenge.replaceChildren(element); },

    /**
     * Show or hide the challenge tab. Hiding the tab the player is currently
     * on — the challenge was closed out from under them — falls back to
     * missions rather than leaving an empty sheet.
     */
    setChallengeTab({ visible, label, title } = {}) {
      if (title != null) challengeTitle = title;
      if (label != null) tabChallenge.textContent = label;
      const wasVisible = !tabChallenge.hidden;
      if (visible === undefined || visible === wasVisible) {
        if (activeTab === "challenge") syncHead();
        return;
      }
      tabChallenge.hidden = !visible;
      // Three tabs need more room than two; the capsule tightens up rather
      // than overflowing the narrowest phones.
      tabsWrap.classList.toggle("mp-tabs--crowded", visible);
      if (!visible && activeTab === "challenge") setActiveTab("missions");
      else if (activeTab === "challenge") syncHead();
    },

    /** The "what is this?" button next to the sheet title. */
    onInfo(cb) { infoCb = cb; },

    onAroundRefresh(cb) { aroundRefreshCb = cb; },
    onAroundModelChange(cb) { aroundModelCb = cb; },

    onObserve(cb) { observeCb = cb; },
    onObserveSheetClose(cb) { sheetCloseCb = cb; },
    openObserveSheet,
    closeObserveSheet,

    refreshI18n,
  };
}
