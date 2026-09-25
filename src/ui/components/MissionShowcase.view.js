// src/ui/components/MissionShowcase.view.js
import { t } from "../../language/i18n.js";

/**
 * The public mission page: one mission, no account.
 *
 * The front page's layout with everything a visitor cannot use taken out —
 * no tabs, no list, no quests. The map shows the mission's zone, the sheet
 * under it is the same species screen a player gets by tapping a pin, and the
 * camera button asks for the one thing this page is for. Reuses the front
 * page's `mp-` classes so it stays dressed like the app it advertises.
 */
export function createMissionShowcaseView() {
  const root = document.createElement("div");
  root.className = "mp-shell";
  root.innerHTML = `
    <div class="sc-head" id="scHead" hidden>
      <h2 class="sc-head__title"></h2>
      <p class="sc-head__intro"></p>
    </div>

    <div id="mapSlot" class="mp-map"></div>

    <div class="mp-sheet">
      <button type="button" class="mp-sheet__grab" id="sheetGrab" data-sheet-grab aria-label=""></button>

      <div class="mp-screen mp-screen--detail">
        <div class="mp-sheet__scroll" id="detailSlot">
          <div class="mp-spinner" id="scSpinner" aria-hidden="true"></div>
        </div>
      </div>
    </div>

    <div class="mp-fab-wrap" id="observeWrap" hidden>
      <button id="observeBtn" class="mp-fab sc-fab" type="button">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path fill="currentColor" d="M9 4.5c.4-.7 1.1-1.1 1.9-1.1h2.2c.8 0 1.5.4 1.9 1.1l.7 1.2H18c1.7 0 3 1.3 3 3v8c0 1.7-1.3 3-3 3H6c-1.7 0-3-1.3-3-3v-8c0-1.7 1.3-3 3-3h2.3L9 4.5zm3 12.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/>
        </svg>
        <span class="sc-fab__text">
          <span class="sc-fab__title" id="observeTitle"></span>
          <span class="sc-fab__sub" id="observeSub"></span>
        </span>
      </button>
    </div>

    <div id="observeSheet" class="mp-observe" aria-hidden="true">
      <span class="mp-observe__grab" aria-hidden="true"></span>
      <button id="observeClose" class="mp-observe__close" type="button">×</button>
      <div id="observeSlot" class="mp-observe__body"></div>
    </div>
  `;

  const q = (sel) => root.querySelector(sel);
  const mapSlot = q("#mapSlot");
  const sheet = q(".mp-sheet");
  const sheetGrab = q("#sheetGrab");
  // The mission's heading tops the page, over the map; it waits for a
  // mission to name, so the missing and failed notices go without it.
  const head = q("#scHead");
  const kicker = head.querySelector(".sc-head__title");
  const intro = head.querySelector(".sc-head__intro");
  const detailSlot = q("#detailSlot");
  const observeWrap = q("#observeWrap");
  const observeBtn = q("#observeBtn");
  const observeTitle = q("#observeTitle");
  const observeSub = q("#observeSub");
  const observeSheet = q("#observeSheet");
  const observeClose = q("#observeClose");
  const observeSlot = q("#observeSlot");

  let observeCb = null;
  let sheetCloseCb = null;
  let resizeCb = null;

  observeBtn.addEventListener("click", () => observeCb?.());
  observeClose.addEventListener("click", () => closeObserveSheet());

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

  // --- sheet drag-resize, as on the front page ---
  const SHEET_MIN_H = 140;
  const MAP_MIN_H = 96;
  let dragPointerId = null;
  let dragStartY = 0;
  let dragStartHeight = 0;
  let pendingHeight = null;
  let dragRaf = null;

  function clampSheetHeight(px) {
    const max = Math.max(SHEET_MIN_H, root.getBoundingClientRect().height - head.offsetHeight - MAP_MIN_H);
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

  sheetGrab.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const delta = e.key === "ArrowUp" ? 24 : -24;
    applySheetHeight(clampSheetHeight(sheet.getBoundingClientRect().height + delta));
    resizeCb?.();
  });

  const spinner = q("#scSpinner");

  function showNotice({ icon, title, body, cta, href = null, onClick = null }) {
    observeWrap.hidden = true;
    head.hidden = true;
    const box = document.createElement("div");
    box.className = "mp-empty sc-missing";
    box.innerHTML = `
      <span class="mp-empty__icon" aria-hidden="true"></span>
      <p class="sc-missing__title"></p>
      <p></p>
      ${href ? `<a class="sc-cta"></a>` : `<button class="sc-cta" type="button"></button>`}
    `;
    box.querySelector(".mp-empty__icon").textContent = icon;
    const [titleEl, bodyEl] = box.querySelectorAll("p");
    titleEl.textContent = title;
    bodyEl.textContent = body;
    const ctaEl = box.querySelector(".sc-cta");
    ctaEl.textContent = cta;
    if (href) ctaEl.href = href;
    if (onClick) ctaEl.addEventListener("click", onClick);
    detailSlot.replaceChildren(box);
  }

  function refreshI18n() {
    kicker.textContent = t("showcase.kicker");
    intro.textContent = t("showcase.intro");
    observeTitle.textContent = t("showcase.observe.title");
    observeSub.textContent = t("showcase.observe.sub");
    observeClose.setAttribute("aria-label", t("common.close"));
    sheetGrab.setAttribute("aria-label", t("map.sheet.resize"));
  }
  refreshI18n();

  return {
    element: root,
    mapSlot,
    observeSlot,

    /** The mission's species screen, and the camera that goes with it. */
    showMission(detailEl) {
      head.hidden = false;
      detailSlot.replaceChildren(detailEl);
      detailSlot.scrollTop = 0;
      observeWrap.hidden = false;
    },

    /** No mission to show: an explanation and a way into the app instead. */
    showMissing() {
      showNotice({
        icon: "🌱",
        title: t("showcase.missing.title"),
        body: t("showcase.missing.body"),
        cta: t("showcase.missing.cta"),
        href: "./index.html",
      });
    },

    /** The mission could not be fetched — a hiccup, not a verdict. */
    showLoadFailed(retry) {
      showNotice({
        icon: "📡",
        title: t("showcase.failed.title"),
        body: t("showcase.failed.body"),
        cta: t("showcase.failed.retry"),
        onClick: () => {
          detailSlot.replaceChildren(spinner);
          retry();
        },
      });
    },

    onObserve(cb) { observeCb = cb; },
    onObserveSheetClose(cb) { sheetCloseCb = cb; },
    onResize(cb) { resizeCb = cb; },
    openObserveSheet,
    closeObserveSheet,
    refreshI18n,
  };
}
