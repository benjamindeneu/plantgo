// src/ui/components/organIcons.js

/**
 * The little marks in the corner of a species photo: which organ a
 * Pl@ntNet photo shows, and a "W" for the Wikipedia picture.
 *
 * Line glyphs on one 24-unit grid, drawn with currentColor so the badge
 * decides the colour — not emoji, which render as a different, off-brand
 * icon set depending on the platform (the same reason the detail screen's
 * other icons are inline SVG).
 */
const PATHS = {
  flower: "M12 3c2 3 2 6 0 9-2-3-2-6 0-9zM21 12c-3 2-6 2-9 0 3-2 6-2 9 0zM12 21c-2-3-2-6 0-9 2 3 2 6 0 9zM3 12c3-2 6-2 9 0-3 2-6 2-9 0z",
  leaf: "M4 20C4 10 10 4 20 4c0 10-6 16-16 16zm0 0c3-6 6-9 11-12",
  fruit: "M12 21c-4 0-7-3-7-7s3-6 7-6 7 2 7 6-3 7-7 7zm0-13V5m0 0c0-1 1-2 3-2",
  bark: "M8 3c1 6-1 12 0 18M16 3c-1 6 1 12 0 18M10 9h2M13 14h2",
  habit: "M12 21v-6m0 0c-4 0-7-3-7-7 0-3 3-5 7-5s7 2 7 5c0 4-3 7-7 7z",
  other: "M12 21v-8m0 0c0-4-3-6-7-6 0 4 3 6 7 6zm0 0c0-4 3-6 7-6 0 4-3 6-7 6z",
};

/** SVG markup for one organ, or "" for a photo that carries no organ (iNaturalist). */
export function organIcon(organ) {
  const d = PATHS[organ];
  if (!d) return "";
  return `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

/** Wikipedia's own mark is a serif W; the display face is one. */
export const WIKI_MARK = `<span class="mp-detail__badge-w" aria-hidden="true">W</span>`;
