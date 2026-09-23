// src/ui/components/fieldGuideInk.js
/**
 * The "Field Guide" hand: a sepia pen line over a watercolour wash, shared
 * by everything drawn in that style (avatars, badges). Art is described as
 * layers of flat shapes; `inkLayers` decides how each kind is painted.
 *
 *  - B(d, fill, {sh})     a base: washed, pen-outlined and shaded, `sh` being its shadow;
 *  - D(d, fill, {sh,cel}) a detail, clipped to its layer's bases, with a finer pen;
 *  - S(d, fill)           a cast shadow, hatched;
 *  - LN(d, colour, w)     a pen line (`ol` draws it under the washes, `fine` drops it when small);
 *  - HL(d, colour, w)     a highlight stroke.
 * Any shape can carry `tf`, an SVG transform.
 *
 * The wobble of the hand is computed once from each path, so a drawing
 * never "boils" and costs nothing extra to paint. Line and wash share the
 * exact same wobbled path: the pen always sits on the edge of its colour.
 * Paths use only M L H V C Q Z (no arcs), so they can be wobbled.
 *
 * `small` is for drawings of 40px and under: a thicker pen, flat washes
 * and no fine lines.
 */

export const SEPIA = "#4a3829";
export const PAPER = "#f6efdf";

export const n = (v) => +v.toFixed(2);
export function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

// Ellipses as four cubics rather than arcs, so they can be wobbled too.
const K = 0.5523;
export function ell(cx, cy, rx, ry) {
  const kx = rx * K, ky = ry * K;
  return `M${n(cx - rx)} ${n(cy)}C${n(cx - rx)} ${n(cy - ky)} ${n(cx - kx)} ${n(cy - ry)} ${n(cx)} ${n(cy - ry)}C${n(cx + kx)} ${n(cy - ry)} ${n(cx + rx)} ${n(cy - ky)} ${n(cx + rx)} ${n(cy)}C${n(cx + rx)} ${n(cy + ky)} ${n(cx + kx)} ${n(cy + ry)} ${n(cx)} ${n(cy + ry)}C${n(cx - kx)} ${n(cy + ry)} ${n(cx - rx)} ${n(cy + ky)} ${n(cx - rx)} ${n(cy)}Z`;
}
export const circ = (cx, cy, r) => ell(cx, cy, r, r);
export function star(cx, cy, r) {
  let d = "";
  for (let k = 0; k < 10; k++) {
    const a = ((k * 36 - 90) * Math.PI) / 180, rr = k % 2 ? r * 0.45 : r;
    d += `${k ? "L" : "M"}${n(cx + Math.cos(a) * rr)} ${n(cy + Math.sin(a) * rr)}`;
  }
  return d + "Z";
}

// ------------------------------------------------------- the hand's wobble
function absPath(d) {
  const t = d.match(/[MLHVCQZmlhvcqz]|-?(?:\d+\.?\d*|\.\d+)/g);
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, cmd = "M";
  const out = [], num = () => parseFloat(t[i++]);
  while (i < t.length) {
    if (/[a-zA-Z]/.test(t[i])) cmd = t[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const ox = rel ? cx : 0, oy = rel ? cy : 0;
    if (C === "Z") { out.push({ c: "Z", p: [] }); cx = sx; cy = sy; if (i < t.length && !/[a-zA-Z]/.test(t[i])) break; continue; }
    if (C === "M") { const x = num() + ox, y = num() + oy; out.push({ c: "M", p: [[x, y]] }); cx = sx = x; cy = sy = y; cmd = rel ? "l" : "L"; }
    else if (C === "L") { const x = num() + ox, y = num() + oy; out.push({ c: "L", p: [[x, y]] }); cx = x; cy = y; }
    else if (C === "H") { const x = num() + (rel ? cx : 0); out.push({ c: "L", p: [[x, cy]] }); cx = x; }
    else if (C === "V") { const y = num() + (rel ? cy : 0); out.push({ c: "L", p: [[cx, y]] }); cy = y; }
    else if (C === "C") { const p = [[num() + ox, num() + oy], [num() + ox, num() + oy], [num() + ox, num() + oy]]; out.push({ c: "C", p }); [cx, cy] = p[2]; }
    else if (C === "Q") { const p = [[num() + ox, num() + oy], [num() + ox, num() + oy]]; out.push({ c: "Q", p }); [cx, cy] = p[1]; }
    else break;
  }
  return out;
}
const toD = (segs, f = (pt) => pt) => segs.map((g) => g.c + g.p.map(f).map(([x, y]) => `${n(x)} ${n(y)}`).join(" ")).join("");
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function subdivide(segs) {
  const out = [];
  let cur = [0, 0], start = [0, 0];
  for (const s of segs) {
    if (s.c === "M") { cur = start = s.p[0]; out.push(s); }
    else if (s.c === "L") { out.push({ c: "L", p: [lerp(cur, s.p[0], 0.5)] }, s); cur = s.p[0]; }
    else if (s.c === "C") {
      const [p1, p2, p3] = s.p, a = lerp(cur, p1, 0.5), b = lerp(p1, p2, 0.5), c = lerp(p2, p3, 0.5);
      const d = lerp(a, b, 0.5), e = lerp(b, c, 0.5), m = lerp(d, e, 0.5);
      out.push({ c: "C", p: [a, d, m] }, { c: "C", p: [e, c, p3] }); cur = p3;
    } else if (s.c === "Q") { out.push(s); cur = s.p[1]; }
    else { out.push(s); cur = start; }
  }
  return out;
}
const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h % 1000) / 37; };
const nz = (x, y, s) => Math.sin(x * 0.61 + y * 0.23 + s) * 0.6 + Math.sin(y * 0.83 - x * 0.37 + s * 1.9) * 0.4;
const wobbleCache = new Map();
export function wobble(d, amp) {
  const key = `${d}|${amp}`;
  let out = wobbleCache.get(key);
  if (out === undefined) {
    const s = hash(d);
    out = toD(subdivide(absPath(d)), ([x, y]) => [x + amp * nz(x, y, s), y + amp * nz(y, x, s + 5)]);
    wobbleCache.set(key, out);
  }
  return out;
}
// The left half of a symmetric item, mirrored about x = 50.
export const mx = (d) => toD(absPath(d), ([x, y]) => [100 - x, y]);
export const both = (d) => d + mx(d);

// ------------------------------------------------------------ shape kinds
export const B = (d, f, o = {}) => ({ k: "b", d, f, ...o });
export const D = (d, f, o = {}) => ({ k: "d", d, f, ...o });
export const S = (d, f, o = {}) => ({ k: "s", d, f, ...o });
export const LN = (d, c, w, o = {}) => ({ k: "l", d, c, w, ...o });
export const HL = (d, c, w, o = {}) => ({ k: "h", d, c, w, ...o });

export function leaf(cx, cy, len, rot, f, kind = D) {
  const h = len * 0.52, tf = `translate(${n(cx)} ${n(cy)}) rotate(${n(rot)})`;
  const d = `M${-len} 0C${n(-len / 2)} ${n(-h)} ${n(len / 2)} ${n(-h)} ${len} 0C${n(len / 2)} ${n(h)} ${n(-len / 2)} ${n(h)} ${-len} 0Z`;
  return [kind(d, f, { tf, sh: mix(f, "#3a1a0a", 0.25) }), LN(`M${n(-len * 0.75)} 0H${n(len * 0.75)}`, mix(f, "#2a1405", 0.35), 0.7, { tf, fine: 1 })];
}
export function flower(cx, cy, r, f, kind = B) {
  const out = [];
  for (let k = 0; k < 5; k++) {
    const a = ((k * 72 - 90) * Math.PI) / 180;
    out.push(kind(circ(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92, r * 0.66), f, { sh: f === "#ffffff" ? "#dfe4ec" : mix(f, "#a2204e", 0.3) }));
  }
  out.push(D(circ(cx, cy, r * 0.48), "#ffcf3f", { sh: "#e6a51c" }));
  return out;
}
// Leaves along an elliptic arc about (cx, cy), from angle a0 to a1 in
// degrees (0 = right, 90 = up), alternately nudged out and in.
export function garland(cx, cy, rx, ry, a0, a1, count, len, colours, kind = B) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const a = ((a0 + ((a1 - a0) * k) / (count - 1)) * Math.PI) / 180;
    const side = k % 2 ? -1 : 1;
    const x = cx + Math.cos(a) * (rx + side), y = cy - Math.sin(a) * (ry + side);
    const tangent = (Math.atan2(-Math.cos(a) * ry, -Math.sin(a) * rx) * 180) / Math.PI;
    out.push(...leaf(x, y, len, tangent + side * 22, colours[k % colours.length], kind));
  }
  return out;
}

// --------------------------------------------------------------- painter
const tfA = (s) => (s.tf ? ` transform="${s.tf}"` : "");
const path = (s, attrs, d) => `<path d="${d}"${tfA(s)} ${attrs}/>`;

/**
 * Paint layers of shapes. A layer is { sp, shapes, cel, soft, clipY, tf }
 * or { sp, markup } for ready-made SVG:
 *  - `sp` names a transform in `spaces` (a coordinate space; none = canvas);
 *  - `cel` shades each base with a hatched crescent on its lower right;
 *  - `soft` inks the layer in a lighter pen over paler washes (scenery);
 *  - `clipY` hides everything above that y;
 *  - `tf` is one more transform inside the space's.
 * `id` prefixes every def, since inline SVG ids are document-wide.
 * `fillOf(shape, wash)` may override a base's fill (e.g. a gradient).
 * Returns { defs, body } to wrap in an <svg>.
 */
export function inkLayers(layers, { id, small = false, spaces = {}, fillOf = null }) {
  const defs = [];
  // Washes are mixed a little towards the paper, less so when small.
  const paper = (c) => mix(c, PAPER, small ? 0.06 : 0.16);
  const wl = (s) => wobble(s.d, small ? 0.25 : 0.45);
  const LW = small ? 1.9 : 1;
  const SOFT_INK = mix(SEPIA, PAPER, 0.4);
  const softPaper = (c) => mix(c, PAPER, small ? 0.14 : 0.26);
  if (!small) defs.push(`<pattern id="${id}hatch" width="2.3" height="2.3" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><path d="M0 0V2.3" stroke="${SEPIA}" stroke-width=".5" opacity=".6"/></pattern>`);

  let body = "";
  layers.forEach((layer, i) => {
    const place = (g) => {
      if (layer.tf) g = `<g transform="${layer.tf}">${g}</g>`;
      return spaces[layer.sp] ? `<g transform="${spaces[layer.sp]}">${g}</g>` : g;
    };
    if (layer.markup != null) { body += place(layer.markup); return; }
    const bases = layer.shapes.filter((s) => s.k === "b");
    const ink = layer.soft ? SOFT_INK : SEPIA;
    const wash = layer.soft ? softPaper : paper;
    const lw = layer.soft ? (small ? 1.1 : 0.75) : LW;
    defs.push(`<clipPath id="${id}u${i}">${bases.map((s) => path(s, "", wl(s))).join("")}</clipPath>`);
    let g = layer.shapes.filter((s) => s.k === "l" && s.ol)
      .map((s) => path(s, `fill="none" stroke="${mix(s.c, SEPIA, 0.3)}" stroke-width="${small ? s.w * 1.3 : s.w}" stroke-linecap="round"`, wl(s))).join("");
    // Wash then line, shape by shape, so a front shape's wash covers the
    // line of the one behind it (an ear under the cheek, a brim under a crown).
    bases.forEach((s, j) => {
      const d = wl(s), fill = (!layer.soft && fillOf?.(s, wash)) || wash(s.f);
      g += path(s, `fill="${fill}"`, d);
      if (layer.cel) {
        // Cel shading: the shadow wash (hatched), then the shape's own wash
        // nudged up-left and clipped to it, leaving a crescent lower right.
        defs.push(`<clipPath id="${id}k${i}_${j}">${path(s, "", d)}</clipPath>`);
        g += `<g clip-path="url(#${id}k${i}_${j})">${path(s, `fill="${mix(paper(s.sh || s.f), PAPER, small ? 0 : 0.25)}"`, d)}${small ? "" : path(s, `fill="url(#${id}hatch)"`, d)}<g transform="translate(-2.2 -2.6)">${path(s, `fill="${fill}"`, d)}</g></g>`;
      }
      // Watercolour pools at its edge: a faint darker rim.
      if (!small) g += path(s, `fill="none" stroke="${mix(wash(s.sh || s.f), SEPIA, 0.15)}" stroke-width=".9" opacity=".35"`, d);
      g += path(s, `fill="none" stroke="${ink}" stroke-width="${lw}" stroke-linejoin="round" stroke-linecap="round"`, d);
    });
    let inner = "";
    layer.shapes.forEach((s, j) => {
      if (s.k === "d") {
        const d = wl(s);
        if (s.cel && !small) {
          defs.push(`<clipPath id="${id}d${i}_${j}">${path(s, "", d)}</clipPath>`);
          inner += path(s, `fill="${mix(paper(s.sh), PAPER, 0.25)}"`, d)
            + `<g clip-path="url(#${id}d${i}_${j})">${path(s, `fill="url(#${id}hatch)"`, d)}<g transform="translate(-2.2 -2.6)">${path(s, `fill="${paper(s.f)}"`, d)}</g></g>`;
        } else {
          inner += path(s, `fill="${wash(s.f)}"`, d);
        }
        inner += path(s, `fill="none" stroke="${ink}" stroke-width="${small ? 1.2 : 0.7}" stroke-linejoin="round"`, d);
      } else if (s.k === "s") {
        inner += path(s, `fill="${paper(s.f)}" opacity=".55"`, wl(s)) + (small ? "" : path(s, `fill="url(#${id}hatch)"`, wl(s)));
      } else if (s.k === "h" && !small) {
        inner += path(s, `fill="none" stroke="${PAPER}" stroke-width="${n(s.w * 0.9)}" stroke-linecap="round" opacity=".55"`, wl(s));
      } else if (s.k === "l" && !s.ol && !(small && s.fine)) {
        inner += path(s, `fill="none" stroke="${mix(s.c, ink, 0.55)}" stroke-width="${n(Math.min(s.w, 1.2) * (small ? 1.2 : 0.8))}" stroke-linecap="round"`, wl(s));
      }
    });
    g += `<g clip-path="url(#${id}u${i})">${inner}</g>`;
    if (layer.clipY != null) {
      defs.push(`<clipPath id="${id}y${i}"><rect x="-10" y="${layer.clipY}" width="120" height="120"/></clipPath>`);
      g = `<g clip-path="url(#${id}y${i})">${g}</g>`;
    }
    body += place(g);
  });
  return { defs: defs.join(""), body };
}
