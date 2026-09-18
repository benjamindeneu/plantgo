// src/ui/components/PhotoViewer.js
import { t } from "../../language/i18n.js";
import { photoProviderName } from "../../api/plantgo.js";
import { photoCreditLine } from "../photoCredit.js";

/**
 * One photo, full screen, with its credit.
 *
 * The gallery grid shows tiles with no caption so it reads as a set of
 * pictures rather than a table; this is where the author and licence every
 * one of those photos requires are shown — one photo, one line. Arrows,
 * a swipe, or the keyboard move through the same images the grid showed;
 * Escape, the backdrop or the × close it and hand focus back to the tile.
 */
export function openPhotoViewer(images, index = 0, { onClose } = {}) {
  if (!Array.isArray(images) || images.length === 0) return null;
  const prev = document.querySelector(".mp-photo-viewer");
  if (prev) prev._close?.();

  const returnFocus = document.activeElement;
  let i = Math.max(0, Math.min(index, images.length - 1));

  const overlay = document.createElement("div");
  overlay.className = "mp-photo-viewer";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `
    <div class="mp-photo-viewer__backdrop"></div>
    <button class="mp-photo-viewer__close" type="button">×</button>
    <button class="mp-photo-viewer__nav mp-photo-viewer__nav--prev" type="button" aria-hidden="true">‹</button>
    <figure class="mp-photo-viewer__figure">
      <img class="mp-photo-viewer__img" alt="" decoding="async">
      <figcaption class="mp-photo-viewer__caption">
        <span class="mp-photo-viewer__credit"></span>
        <a class="mp-photo-viewer__source" target="_blank" rel="noopener noreferrer" hidden></a>
        <span class="mp-photo-viewer__count"></span>
      </figcaption>
    </figure>
    <button class="mp-photo-viewer__nav mp-photo-viewer__nav--next" type="button" aria-hidden="true">›</button>
  `;

  const img = overlay.querySelector(".mp-photo-viewer__img");
  const credit = overlay.querySelector(".mp-photo-viewer__credit");
  const source = overlay.querySelector(".mp-photo-viewer__source");
  const count = overlay.querySelector(".mp-photo-viewer__count");
  const closeBtn = overlay.querySelector(".mp-photo-viewer__close");
  const prevBtn = overlay.querySelector(".mp-photo-viewer__nav--prev");
  const nextBtn = overlay.querySelector(".mp-photo-viewer__nav--next");
  closeBtn.setAttribute("aria-label", t("photo.close"));
  prevBtn.setAttribute("aria-label", t("photo.prev"));
  nextBtn.setAttribute("aria-label", t("photo.next"));
  const single = images.length < 2;
  prevBtn.hidden = nextBtn.hidden = single;

  function show(n) {
    i = (n + images.length) % images.length;
    const photo = images[i];
    img.src = photo.medium || photo.full || photo.thumb || "";
    credit.textContent = photoCreditLine(photo);
    if (photo.source) {
      source.href = photo.source;
      source.textContent = t("photo.source", { source: photoProviderName(photo.provider) });
      source.hidden = false;
    } else source.hidden = true;
    count.textContent = single ? "" : `${i + 1} / ${images.length}`;
  }

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    document.body.classList.remove("mp-viewer-open");
    overlay.classList.remove("is-open");
    setTimeout(() => overlay.remove(), 220);
    if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
    onClose?.();
  }
  overlay._close = close;
  // A photo whose credit is still on its way (Wikipedia's) is patched in
  // place by the caller, who then asks for the current one to be redrawn.
  overlay._refresh = () => { if (!closed) show(i); };

  function onKey(e) {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft" && !single) show(i - 1);
    else if (e.key === "ArrowRight" && !single) show(i + 1);
  }

  closeBtn.addEventListener("click", close);
  overlay.querySelector(".mp-photo-viewer__backdrop").addEventListener("click", close);
  prevBtn.addEventListener("click", () => show(i - 1));
  nextBtn.addEventListener("click", () => show(i + 1));
  document.addEventListener("keydown", onKey);

  // A horizontal flick moves through the set; a vertical one is left to
  // whatever the browser wants to do with it.
  let startX = null, startY = null;
  overlay.addEventListener("pointerdown", (e) => { startX = e.clientX; startY = e.clientY; });
  overlay.addEventListener("pointerup", (e) => {
    if (startX == null || single) { startX = startY = null; return; }
    const dx = e.clientX - startX, dy = e.clientY - startY;
    startX = startY = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(dx < 0 ? i + 1 : i - 1);
  });
  overlay.addEventListener("pointercancel", () => { startX = startY = null; });

  show(i);
  document.body.appendChild(overlay);
  document.body.classList.add("mp-viewer-open");
  requestAnimationFrame(() => {
    overlay.classList.add("is-open");
    closeBtn.focus();
  });
  return overlay;
}
