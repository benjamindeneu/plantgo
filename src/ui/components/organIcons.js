// src/ui/components/organIcons.js

/**
 * The little marks in the corner of a species photo: which organ a
 * Pl@ntNet photo shows, and a "W" for the Wikipedia picture.
 *
 * Filled silhouettes on one 24-unit grid, most with one detail cut out of
 * it (the flower's centre, the leaf's midrib, the apple's highlight, the
 * bark's cracks, the tree's branches), drawn with currentColor so the badge
 * decides the colour — not emoji, which render as a different, off-brand
 * icon set depending on the platform (the same reason the detail screen's
 * other icons are inline SVG).
 * Outlines were tried first; at 12px their strokes meet and blur, where a
 * solid shape still reads.
 *
 * Each glyph is a list of paths so separate parts (a stem, a fruit's leaf)
 * can overlap without the even-odd rule punching holes where they meet.
 */
const FLOWER = "M8.94 7.79A3.93 3.93 0 1 1 15.06 7.79A3.93 3.93 0 1 1 16.95 13.61A3.93 3.93 0 1 1 12 17.2A3.93 3.93 0 1 1 7.05 13.61A3.93 3.93 0 1 1 8.94 7.79ZM9.7 12a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0-4.6 0Z";

const GLYPHS = {
  flower: [FLOWER],
  leaf: [
    "M4.5 19.5C3.5 11 9 4.5 20 4C19.5 15 13 20.5 4.5 19.5ZM6.6 16.3L7.7 17.4L16.6 7.4Z",
  ],
  fruit: [
    "M12 8.6C9 6.6 4.5 7.6 4.5 13.2C4.5 18 8 21.6 10.4 21.6C11.2 21.6 11.5 21.1 12 21.1C12.5 21.1 12.8 21.6 13.6 21.6C16 21.6 19.5 18 19.5 13.2C19.5 7.6 15 6.6 12 8.6ZM7.2 13.6C7.2 11.6 8.2 10.4 9.8 10.1C9.1 11 8.7 12.2 8.7 13.6C8.7 14.4 7.2 14.4 7.2 13.6Z",
    "M11.2 8.4C11.2 6.4 11.8 4.6 13 3.2L14.1 4.1C13.1 5.3 12.8 6.8 12.8 8.4Z",
    "M13.8 5.6C14.5 3.4 16.6 2.4 19.2 2.8C18.6 5.1 16.4 6.1 13.8 5.6Z",
  ],
  bark: [
    "M7 2.5H17C16.4 8 16.4 13.5 17.4 17.8C17.9 19.6 19.3 20.8 21 21.5H3C4.7 20.8 6.1 19.6 6.6 17.8C7.6 13.5 7.6 8 7 2.5Z" +
      "M10.2 4.5C8.6 8 8.7 11.5 10.3 15.5C11.9 11.5 11.9 8 10.2 4.5Z" +
      "M13.9 8.5C12.3 12 12.4 15 14 18.8C15.6 15 15.6 12 13.9 8.5Z",
  ],
  habit: [
    "M7.5 16A4.2 4.2 0 0 1 5.8 8.2A6.2 6.2 0 0 1 18.2 8.2A4.2 4.2 0 0 1 16.5 16Z" +
      "M11 16V12.6L8.6 10.2L9.7 9.1L11.3 10.7V7.5H12.7V11.6L14.3 10L15.4 11.1L13 13.5V16Z",
    "M11 15.9H13V21.5H11Z",
  ],
  other: [
    "M11.1 21.5V12.2H12.9V21.5Z",
    "M12.2 13C11.8 8.8 8.8 6.6 3.8 6.6C3.8 10.8 6.9 13.3 12.2 13Z",
    "M11.8 11.4C12.1 6.6 15.2 3.9 20.2 3.9C20.2 8.6 17.1 11.6 11.8 11.4Z",
  ],
};

/** SVG markup for one organ, or "" for a photo that carries no organ (iNaturalist). */
export function organIcon(organ) {
  const paths = GLYPHS[organ];
  if (!paths) return "";
  return `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="currentColor" fill-rule="evenodd">${paths.map((d) => `<path d="${d}"/>`).join("")}</svg>`;
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
