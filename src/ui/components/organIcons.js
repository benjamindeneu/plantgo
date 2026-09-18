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
  leaf: "M4 20C4 10 10 4 20 4c0 10-6 16-16 16zm0 0c3-6 6-9 11-12",
  fruit: "M12 21c-4 0-7-3-7-7s3-6 7-6 7 2 7 6-3 7-7 7zm0-13V5m0 0c0-1 1-2 3-2",
  bark: "M8 3c1 6-1 12 0 18M16 3c-1 6 1 12 0 18M10 9h2M13 14h2",
  habit: "M12 21v-6m0 0c-4 0-7-3-7-7 0-3 3-5 7-5s7 2 7 5c0 4-3 7-7 7z",
  other: "M12 21v-8m0 0c0-4-3-6-7-6 0 4 3 6 7 6zm0 0c0-4 3-6 7-6 0 4-3 6-7 6z",
};

// The flower is the one filled glyph: five round petals around a hollow
// centre. Drawn as an outline it was four strokes meeting in the middle,
// which at 12px is a cross, not a flower.
const FLOWER = "M8.94 7.79A3.93 3.93 0 1 1 15.06 7.79A3.93 3.93 0 1 1 16.95 13.61A3.93 3.93 0 1 1 12 17.2A3.93 3.93 0 1 1 7.05 13.61A3.93 3.93 0 1 1 8.94 7.79ZM9.7 12a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0-4.6 0Z";

/** SVG markup for one organ, or "" for a photo that carries no organ (iNaturalist). */
export function organIcon(organ) {
  if (organ === "flower") {
    return `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="currentColor" fill-rule="evenodd"><path d="${FLOWER}"/></svg>`;
  }
  const d = PATHS[organ];
  if (!d) return "";
  return `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

/** The real logos, as the legacy card already shows them. */
export const WIKI_MARK = `<img src="./assets/wikipedia-logo.svg" alt="" width="18" height="18" decoding="async">`;
export const GBIF_MARK = `<img src="./assets/gbif-logo.svg" alt="" width="18" height="18" decoding="async">`;
export const INAT_MARK = `<img src="./assets/inaturalist-logo.png" alt="" width="18" height="18" decoding="async">`;
export const PLANTNET_MARK = `<img src="./assets/plantnet-logo.svg" alt="" width="18" height="18" decoding="async">`;

/** The mark for whichever source a photo came from. */
export function providerMark(provider) {
  if (provider === "wikipedia") return WIKI_MARK;
  if (provider === "inaturalist") return INAT_MARK;
  if (provider === "plantnet") return PLANTNET_MARK;
  return "";
}
