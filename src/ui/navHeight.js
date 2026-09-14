// src/ui/navHeight.js

/**
 * Keep `--mp-nav-h` on an element equal to the page header's height.
 *
 * The header is sticky at the top of every page. Anything else that wants to
 * stick — the herbarium's search strip, the observations page's date
 * headings — has to sit just under it, and the header's height is not a
 * constant: it wraps on narrow phones and grows with the level chip. So it
 * is measured, and re-measured when the window changes.
 */
export function trackNavHeight(el) {
  const measure = () => {
    const nav = document.querySelector("body > header, body > .nav");
    el.style.setProperty("--mp-nav-h", `${nav ? Math.round(nav.getBoundingClientRect().height) : 0}px`);
  };
  measure();
  requestAnimationFrame(measure);
  window.addEventListener("resize", measure);
  window.addEventListener("load", measure);
  return measure;
}
