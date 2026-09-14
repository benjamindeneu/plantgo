// src/ui/components/SpeciesSheet.js
import { SpeciesDetail } from "./SpeciesDetail.view.js";
import { t } from "../../language/i18n.js";

/**
 * The species screen, on a page that has no map sheet to put it in.
 *
 * On the front page a species opens inside the sheet over the map. The
 * herbarium and observations pages have no sheet, so this raises one: a
 * panel that slides up over the page, dims what is behind it, and holds the
 * very same SpeciesDetail — photo, write-up, trivia, links — so a species
 * reads the same wherever it was tapped. Its back button closes the sheet.
 *
 * Returns the detail element, so the caller can feed it what a later
 * request reveals (`setDescription`, `setTrivia`, …) exactly as the map
 * controller does.
 */
export function openSpeciesSheet(species, { onClose } = {}) {
  const prev = document.querySelector(".mp-species-sheet");
  if (prev) prev._close?.({ immediate: true });

  const overlay = document.createElement("div");
  overlay.className = "mp-species-sheet";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `
    <div class="mp-species-sheet__backdrop"></div>
    <div class="mp-species-sheet__panel">
      <span class="mp-species-sheet__grab" aria-hidden="true"></span>
      <button class="mp-species-sheet__close" type="button">×</button>
      <div class="mp-species-sheet__scroll"></div>
    </div>
  `;

  const panel = overlay.querySelector(".mp-species-sheet__panel");
  const scroll = overlay.querySelector(".mp-species-sheet__scroll");
  const closeBtn = overlay.querySelector(".mp-species-sheet__close");
  closeBtn.setAttribute("aria-label", t("species.sheet.close"));

  let closed = false;
  function close({ immediate = false } = {}) {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    document.body.classList.remove("mp-sheet-open");
    overlay.classList.remove("is-open");
    if (immediate) overlay.remove();
    else {
      // Let the slide-out finish. `transitionend` alone is not enough — a
      // sheet closed before it ever fully opened may fire none.
      setTimeout(() => overlay.remove(), 340);
    }
    onClose?.();
  }
  overlay._close = close;

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  const detail = SpeciesDetail(species, { onBack: () => close() });
  scroll.appendChild(detail);

  closeBtn.addEventListener("click", () => close());
  overlay.querySelector(".mp-species-sheet__backdrop").addEventListener("click", () => close());
  document.addEventListener("keydown", onKey);

  // A short downward flick on the grab strip closes it, the way a phone
  // sheet does; anything else on the panel is left to scroll.
  let startY = null;
  panel.addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".mp-species-sheet__grab") && scroll.scrollTop > 0) return;
    startY = e.clientY;
  });
  panel.addEventListener("pointermove", (e) => {
    if (startY == null) return;
    if (e.clientY - startY > 70 && scroll.scrollTop <= 0) { startY = null; close(); }
  });
  panel.addEventListener("pointerup", () => { startY = null; });
  panel.addEventListener("pointercancel", () => { startY = null; });

  document.body.appendChild(overlay);
  document.body.classList.add("mp-sheet-open");
  // Two frames, so the transform actually transitions from its closed value.
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("is-open")));
  closeBtn.focus({ preventScroll: true });

  return detail;
}
