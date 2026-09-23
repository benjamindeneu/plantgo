// src/ui/components/fieldSticker.js
import { mix } from "./fieldGuideInk.js";

/**
 * The "Field Sticker" hand, as the badges use it: bright flat colour with a
 * cel-shaded crescent and a white die-cut edge with a soft drop shadow, as
 * if the drawing were a sticker peeled onto the page. There is no ink: a
 * dark outline is what made small badges look cheap, so shapes are told
 * apart by colour and value alone, with at most a hairline rim a shade
 * deeper than the shape's own shadow. It paints the same shape kinds as
 * the Field Guide hand (`fieldGuideInk.js`), so art can be described once
 * and given to either:
 *
 *  - B base:        a tonal hairline rim, then the fill with cel shading;
 *  - D detail:      clipped to its layer's bases, flat or cel-shaded, no rim;
 *  - S cast shadow: a flat patch of the shadow colour;
 *  - LN line:       a plain stroke (`fine` drops it when small; `ol` lines
 *                   are not clipped to the bases and get a tonal rim);
 *  - HL highlight:  a light stroke, dropped when small.
 *
 * Light comes from the top left: each base is filled in its shadow colour,
 * then its own copy is nudged up-left and clipped to it, which leaves a
 * crescent of shadow on the lower right.
 *
 * Conventions for art drawn in this hand:
 *  - never use near-black for a fill or line; the darkest tone of a shape is
 *    its own colour mixed towards a deep green-brown (see `deep`);
 *  - neighbouring bases need a clear step in value (light on dark, or dark
 *    on light), since nothing else separates them;
 *  - white or very pale shapes on a pale ground need a shadow colour `sh`,
 *    which gives them their rim.
 *
 * The design reference is style A in `design/avatar-styles/`.
 */

// The rim of a shape: its shadow colour pushed a step further into shade.
const deep = (c) => mix(c, "#1c2a1e", 0.3);

const tfA = (s) => (s.tf ? ` transform="${s.tf}"` : "");
const path = (s, attrs) => `<path d="${s.d}"${tfA(s)} ${attrs}/>`;

/**
 * Paint layers of shapes, with the same layer format as `inkLayers`:
 * { sp, shapes, cel, clipY, tf } or { sp, markup }.
 * `small` (40px and under) widens the rims and drops fine lines and
 * highlights. `shift` is how far the lit copy is nudged for the cel crescent.
 * Returns { defs, body, filter }: wrap `body` in a group with
 * `filter="${filter}"` to get the die-cut white edge and the shadow.
 */
export function stickerLayers(layers, { id, small = false, spaces = {}, shift = [-2, -2.4] }) {
  const defs = [];
  const RIM = small ? 1.5 : 1;
  const cel = (key, s, fill) => {
    defs.push(`<clipPath id="${id}k${key}">${path(s, "")}</clipPath>`);
    return `${path(s, `fill="${s.sh || fill}"`)}<g clip-path="url(#${id}k${key})"><g transform="translate(${shift[0]} ${shift[1]})">${path(s, `fill="${fill}"`)}</g></g>`;
  };

  let body = "";
  layers.forEach((layer, i) => {
    const place = (g) => {
      if (layer.tf) g = `<g transform="${layer.tf}">${g}</g>`;
      return spaces[layer.sp] ? `<g transform="${spaces[layer.sp]}">${g}</g>` : g;
    };
    if (layer.markup != null) { body += place(layer.markup); return; }
    const bases = layer.shapes.filter((s) => s.k === "b");
    defs.push(`<clipPath id="${id}u${i}">${bases.map((s) => path(s, "")).join("")}</clipPath>`);
    // Every rim of the layer first, so touching bases of one layer merge
    // into one silhouette instead of cutting lines into each other.
    let g = bases.map((s) => {
      const c = deep(s.sh || s.f);
      return path(s, `fill="${c}" stroke="${c}" stroke-width="${RIM}" stroke-linejoin="round"`);
    }).join("");
    const ol = layer.shapes.filter((s) => s.k === "l" && s.ol);
    g += ol.map((s) => path(s, `fill="none" stroke="${deep(s.c)}" stroke-width="${s.w + RIM}" stroke-linecap="round"`)).join("");
    g += ol.map((s) => path(s, `fill="none" stroke="${s.c}" stroke-width="${s.w}" stroke-linecap="round"`)).join("");
    bases.forEach((s, j) => { g += layer.cel && s.sh ? cel(`${i}_${j}`, s, s.f) : path(s, `fill="${s.f}"`); });
    let inner = "";
    layer.shapes.forEach((s, j) => {
      if (s.k === "d") inner += s.cel && s.sh ? cel(`${i}d${j}`, s, s.f) : path(s, `fill="${s.f}"`);
      else if (s.k === "s") inner += path(s, `fill="${s.f}"`);
      else if (s.k === "l" && !s.ol && !(small && s.fine)) inner += path(s, `fill="none" stroke="${s.c}" stroke-width="${s.w}" stroke-linecap="round"`);
      else if (s.k === "h" && !small) inner += path(s, `fill="none" stroke="${s.c}" stroke-width="${s.w}" stroke-linecap="round" opacity=".8"`);
    });
    g += `<g clip-path="url(#${id}u${i})">${inner}</g>`;
    if (layer.clipY != null) {
      defs.push(`<clipPath id="${id}y${i}"><rect x="-10" y="${layer.clipY}" width="120" height="120"/></clipPath>`);
      g = `<g clip-path="url(#${id}y${i})">${g}</g>`;
    }
    body += place(g);
  });
  // The die-cut edge: the silhouette grown and flooded white, with a soft
  // shadow under it.
  const edge = small ? 1.6 : 2.2;
  defs.push(`<filter id="${id}f" x="-12%" y="-12%" width="124%" height="130%"><feMorphology in="SourceAlpha" operator="dilate" radius="${edge}" result="d"/><feFlood flood-color="#fff"/><feComposite in2="d" operator="in" result="w"/><feGaussianBlur in="d" stdDeviation="1.1"/><feOffset dy="1.3" result="bo"/><feFlood flood-color="#16241c" flood-opacity=".22"/><feComposite in2="bo" operator="in" result="sh"/><feMerge><feMergeNode in="sh"/><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
  return { defs: defs.join(""), body, filter: `url(#${id}f)` };
}
