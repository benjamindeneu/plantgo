// src/ui/sheetResize.js

// Enough for the grab + head with a sliver of list.
const SHEET_MIN_H = 140;
// The map never fully disappears under the sheet.
const MAP_MIN_H = 96;

/**
 * Let the player drag the sheet under a map taller or shorter.
 *
 * The page's CSS split is only a default. Dragging the grab handle sets an
 * explicit pixel height on the sheet (and lets the map claim whatever's
 * left) which, being inline, outranks those percentages — so once the player
 * has sized it once, it holds that size across tab switches too.
 *
 * The pill is not the only handle. Anything inside the sheet marked
 * `data-sheet-grab` starts the same drag — the detail screen's back bar uses
 * it for the blank stretch between its two controls, which sits pinned right
 * under the pill and is what a thumb reaching for the pill actually lands on.
 * The pointer is captured by the pill's button regardless of which handle
 * caught it, so the move/up listeners stay in one place.
 *
 * `onResize` runs whenever the map's container changed size: Leaflet has to
 * be told.
 */
export function makeSheetResizable({ root, sheet, grab, mapSlot, onResize }) {
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
    onResize();
  }

  function stepSheetHeight(deltaPx) {
    applySheetHeight(clampSheetHeight(sheet.getBoundingClientRect().height + deltaPx));
    onResize();
    requestAnimationFrame(() => onResize());
  }

  sheet.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    if (dragPointerId !== null) return;
    if (!(e.target instanceof Element) || !e.target.closest("[data-sheet-grab]")) return;
    dragPointerId = e.pointerId;
    dragStartY = e.clientY;
    dragStartHeight = sheet.getBoundingClientRect().height;
    sheet.classList.add("mp-sheet--dragging");
    grab.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  grab.addEventListener("pointermove", (e) => {
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
    requestAnimationFrame(() => onResize());
  }
  grab.addEventListener("pointerup", endSheetDrag);
  grab.addEventListener("pointercancel", endSheetDrag);

  // Arrow keys give keyboard users the same control once the handle is focused.
  grab.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") { e.preventDefault(); stepSheetHeight(24); }
    else if (e.key === "ArrowDown") { e.preventDefault(); stepSheetHeight(-24); }
  });
}
