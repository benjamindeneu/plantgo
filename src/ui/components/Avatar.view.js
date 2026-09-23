// src/ui/components/Avatar.view.js
import { SKIN_TONES, HAIR_COLORS, EYE_COLORS, AVATAR_SLOTS, normalizeAvatar } from "../../data/avatar.js";

/**
 * The avatar, in the "Field Guide" style: a sepia pen line over a
 * watercolour wash, like a sketch in a naturalist's notebook. The design
 * kit it comes from, with the guidelines and the reasons behind them, is
 * `design/avatar-styles/` at the project root.
 *
 * Every item is drawn once, in one of two local spaces:
 *  - HEAD space holds the head, face, hair and hats. The head spans x 26–74
 *    and y 19–67.5, the eyes sit at y≈47 and a hat's brim at y≈31–33.
 *  - BODY space holds the neck, outfits, capes and wings. The shoulders
 *    start at y 71.5 on the 100×100 canvas.
 * A pumpkin-head prop is drawn in head space and replaces the head; habitats
 * are drawn straight on the canvas, behind everything.
 * The RIG places both spaces on the canvas, so proportions (head size, how
 * much neck shows) are set in one spot and never by redrawing an item.
 *
 * An item is a list of flat shapes with a kind, and the renderer decides
 * how each kind is painted:
 *  - B(d, fill, {sh})     a base: washed, pen-outlined and shaded, `sh` being its shadow;
 *  - D(d, fill, {sh,cel}) a detail, clipped to its layer's bases, with a finer pen;
 *  - S(d, fill)           a cast shadow, e.g. a fringe or a brim on the face;
 *  - LN(d, colour, w)     a pen line (`ol` draws it under the washes, `fine` drops it when small);
 *  - HL(d, colour, w)     a highlight on hair.
 * A hat can set `covers: y` to hide the hair above y, and `cast`, the
 * shadow its brim throws on the forehead.
 *
 * The wobble of the hand is computed once from each path, so an avatar
 * never "boils" and costs nothing extra to paint. Line and wash share the
 * exact same wobbled path: the pen always sits on the edge of its colour.
 * Paths use only M L H V C Q Z (no arcs), so they can be wobbled.
 *
 * Coins of 40px and under use `small`: cropped to head and shoulders, a
 * thicker pen, flat washes, bigger eyes and no fine lines.
 *
 * Painting one of these costs 10× more than the old flat art, so anything
 * that shows many avatars or repaints often should use `avatarImg`, which
 * bakes each outfit to a bitmap once. Inline SVG is for the big portraits.
 */

const SEPIA = "#4a3829";
const PAPER = "#f6efdf";
const PUPIL = "#2a1f17";

const n = (v) => +v.toFixed(2);
function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

// Ellipses as four cubics rather than arcs, so they can be wobbled too.
const K = 0.5523;
function ell(cx, cy, rx, ry) {
  const kx = rx * K, ky = ry * K;
  return `M${n(cx - rx)} ${n(cy)}C${n(cx - rx)} ${n(cy - ky)} ${n(cx - kx)} ${n(cy - ry)} ${n(cx)} ${n(cy - ry)}C${n(cx + kx)} ${n(cy - ry)} ${n(cx + rx)} ${n(cy - ky)} ${n(cx + rx)} ${n(cy)}C${n(cx + rx)} ${n(cy + ky)} ${n(cx + kx)} ${n(cy + ry)} ${n(cx)} ${n(cy + ry)}C${n(cx - kx)} ${n(cy + ry)} ${n(cx - rx)} ${n(cy + ky)} ${n(cx - rx)} ${n(cy)}Z`;
}
const circ = (cx, cy, r) => ell(cx, cy, r, r);
function star(cx, cy, r) {
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
function wobble(d, amp) {
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
const mx = (d) => toD(absPath(d), ([x, y]) => [100 - x, y]);
const both = (d) => d + mx(d);

// ------------------------------------------------------------ shape kinds
const B = (d, f, o = {}) => ({ k: "b", d, f, ...o });
const D = (d, f, o = {}) => ({ k: "d", d, f, ...o });
const S = (d, f, o = {}) => ({ k: "s", d, f, ...o });
const LN = (d, c, w, o = {}) => ({ k: "l", d, c, w, ...o });
const HL = (d, c, w, o = {}) => ({ k: "h", d, c, w, ...o });

function leaf(cx, cy, len, rot, f, kind = D) {
  const h = len * 0.52, tf = `translate(${n(cx)} ${n(cy)}) rotate(${n(rot)})`;
  const d = `M${-len} 0C${n(-len / 2)} ${n(-h)} ${n(len / 2)} ${n(-h)} ${len} 0C${n(len / 2)} ${n(h)} ${n(-len / 2)} ${n(h)} ${-len} 0Z`;
  return [kind(d, f, { tf, sh: mix(f, "#3a1a0a", 0.25) }), LN(`M${n(-len * 0.75)} 0H${n(len * 0.75)}`, mix(f, "#2a1405", 0.35), 0.7, { tf, fine: 1 })];
}
function flower(cx, cy, r, f, kind = B) {
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
function garland(cx, cy, rx, ry, a0, a1, count, len, colours, kind = B) {
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

// ---------------------------------------------------------------- palette
function skinPaint(id) {
  const t = SKIN_TONES.find((s) => s.id === id) ?? SKIN_TONES[0];
  return { f: t.fill, sh: t.shade };
}
function hairPaint(id) {
  const c = HAIR_COLORS.find((h) => h.id === id) ?? HAIR_COLORS[0];
  return {
    f: c.fill,
    sh: mix(c.fill, "#1a0d05", 0.32),
    l: mix(c.fill, "#fffaf0", 0.4),
    stops: Array.isArray(c.stops) ? c.stops : null,
  };
}
const eyePaint = (id) => (EYE_COLORS.find((e) => e.id === id) ?? EYE_COLORS[0]).fill;

// --------------------------------------------------------------- geometry
const HEAD = "M26 42C26 27 36.5 19 50 19C63.5 19 74 27 74 42C74 51 71 58 65.5 62.5C61.5 65.8 56 67.5 50 67.5C44 67.5 38.5 65.8 34.5 62.5C29 58 26 51 26 42Z";
const TORSO = "M20 100C20 89 21.5 81.5 27 77C32 73 40 71.5 50 71.5C60 71.5 68 73 73 77C78.5 81.5 80 89 80 100Z";
const NECK = "M44.5 60H55.5V76H44.5Z";
// Two seams hint at the arms.
const ARMS = "M28.5 86C29.3 91 29.5 96 29.2 100M71.5 86C70.7 91 70.5 96 70.8 100";
// A cape or cloak's two front panels, meeting at the collar.
const PANEL_L = "M20 100C20 89 21.5 81.5 27 77C32 73 38 71.8 44.5 71.6L41.5 100Z";
const PANELS = both(PANEL_L);
const CAPE_BACK = "M11 100V89C11 72 29 64 50 64C71 64 89 72 89 89V100Z";

// Necklines stay shallow on purpose: a deep scoop of skin under the chin is
// what made the first prototype's necks look long.
const crew = (sk, c) => [D("M43 71.8Q50 75.6 57 71.8Z", sk.f), LN("M42.4 72Q50 76.8 57.6 72", c, 1.8)];
const vee = (sk, depth = 75.5) => D(`M45 71.8L50 ${depth}L55 71.8Z`, sk.f);

// Hair pulled back smoothly from the face, shared by the bun.
const SLEEK = "M24.5 46C22 28 34 16.5 50 16.5C66 16.5 78 28 75.5 46C74 41 72 37 69.5 34.8C63 31.3 57 29.8 50 29.8C43 29.8 37 31.3 30.5 34.8C28 37 26 41 24.5 46Z";

const HAIRSTYLE = {
  short: (h) => ({
    front: [
      B("M24.5 46C22 27 34.5 15.5 50.5 15.5C66.5 15.5 78 26 75.5 46C74 40.5 72.5 36.5 69.5 34C66 37.5 60 38.5 55 37C58 35.5 59.5 33.5 60 31C54 35.5 42 37.5 32.5 36C29.5 38.5 26.5 42 24.5 46Z", h.f, { sh: h.sh, hair: 1 }),
      B("M46 17C45 12 48.5 9 53.5 8.5C51.5 11.5 51.5 14 53 16.5Z", h.f, { sh: h.sh, hair: 1 }),
      HL("M32.5 27C36 22 41.5 19.5 47 19", h.l, 2.2),
      HL("M63 20.5C65 21.5 67 23.5 68 25.5", h.l, 1.8),
    ],
  }),
  long: (h) => ({
    back: [B("M23.5 44C21.5 25 35.5 14.5 50 14.5C64.5 14.5 78.5 25 76.5 44C77 57 78.5 68 81.5 78C75 81.5 68 80 65 75L35 75C32 80 25 81.5 18.5 78C21.5 68 23 57 23.5 44Z", h.f, { sh: h.sh, hair: 1 })],
    locks: [
      B("M24 47C23.5 59 22.5 71 20 82C24.5 85 30.5 84.5 33.5 80C31.5 71 30.5 60 31 47Z", h.f, { sh: h.sh, hair: 1 }),
      B("M76 47C76.5 59 77.5 71 80 82C75.5 85 69.5 84.5 66.5 80C68.5 71 69.5 60 69 47Z", h.f, { sh: h.sh, hair: 1 }),
      HL("M22.8 62C22.4 68 21.6 73 20.6 77.5", h.l, 1.4),
    ],
    front: [
      B("M24.5 48C22 27 34.5 15 50 15C65.5 15 78 27 75.5 48C72 41.5 69 36 64.5 32C60.5 34.5 55 34 51 30.5C47 34 40 35.5 35 33.5C30.5 37 27 42 24.5 48Z", h.f, { sh: h.sh, hair: 1 }),
      HL("M30.5 28.5C33.5 23 39 20 45 19", h.l, 2.2),
      HL("M57 19.3C61.5 20.1 65.5 22.3 68.3 25.5", h.l, 1.8),
    ],
  }),
  curly: (h) => {
    const c = (x, y, r) => B(circ(x, y, r), h.f, { sh: h.sh, hair: 1 });
    return {
      back: [c(23.5, 48, 6.8), c(76.5, 48, 6.8), c(23, 39, 7.2), c(77, 39, 7.2), c(25.5, 57.5, 5.8), c(74.5, 57.5, 5.8)],
      front: [
        B("M29 40C29 27 38.5 20 50 20C61.5 20 71 27 71 40C63 33 37 33 29 40Z", h.f, { sh: h.sh, hair: 1 }),
        c(27.5, 38, 6.4), c(30.5, 29, 7.4), c(38.5, 21.5, 8), c(50, 18.5, 8.5), c(61.5, 21.5, 8), c(69.5, 29, 7.4), c(72.5, 38, 6.4),
        c(35, 33.5, 5), c(42.5, 31, 5), c(50.5, 30.5, 5), c(58.5, 31, 5), c(65, 33.5, 5),
        HL("M44 16C46 14.4 48.5 13.6 51 13.8", h.l, 1.8), HL("M33.3 17.8C35.1 16.4 36.9 15.8 38.9 15.9", h.l, 1.6), HL("M25.6 25.9C26.6 24.5 27.8 23.6 29.2 23.1", h.l, 1.5),
      ],
    };
  },
  bob: (h) => ({
    back: [B("M23 44C21 25 35 14.5 50 14.5C65 14.5 79 25 77 44C77 53 78 60 80 66C73.5 69 67 68 64 64L36 64C33 68 26.5 69 20 66C22 60 23 53 23 44Z", h.f, { sh: h.sh, hair: 1 })],
    front: [
      B("M24.5 47C22 27 34.5 15 50 15C65.5 15 78 27 75.5 47C74 42.5 72.5 38.5 71 36C66.5 38.5 61 37.5 58 35.5C55 37.8 45 37.8 42 35.5C39 37.5 33.5 38.5 29 36C27.5 38.5 26 42.5 24.5 47Z", h.f, { sh: h.sh, hair: 1 }),
      HL("M30.5 28.5C33.5 23 39 20 45 19", h.l, 2.2),
    ],
  }),
  // Cropped close: a thin cap of colour with a straight hairline.
  buzz: (h) => ({
    front: [
      B("M25.8 43C24.5 28 36 17.8 50 17.8C64 17.8 75.5 28 74.2 43C73.4 38.5 72 35 69.8 32.6C63.5 31 57 30.4 50 30.4C43 30.4 36.5 31 30.2 32.6C28 35 26.6 38.5 25.8 43Z", h.f, { sh: h.sh, hair: 1 }),
      HL("M35 24C38.5 21.5 42.5 20.4 46.5 20.2", h.l, 1.6),
    ],
  }),
  // Short at the sides, the front swept up and over to the right.
  quiff: (h) => ({
    front: [
      B("M24.5 45C22.5 30 29.5 20.5 39.5 17C42.5 11.5 51.5 7.5 60.5 9.5C57.5 11 56 12.8 55.8 15C64.5 15.5 72.5 22 75.5 45C74 40 72.5 36.5 70 34C65 35.5 58.5 35 52.5 32.5C47 34.2 40 35 31.5 35C29 38 26.5 41.5 24.5 45Z", h.f, { sh: h.sh, hair: 1 }),
      HL("M42 16.5C46 12.5 51.5 10.5 57 10.8", h.l, 2),
      HL("M64 21C66 22.3 67.7 24.2 68.6 26.3", h.l, 1.6),
    ],
  }),
  // Pulled back smooth into a bun on the crown.
  bun: (h) => ({
    back: [B(circ(50, 11.5, 7.2), h.f, { sh: h.sh, hair: 1 }), HL("M45.5 8.5C47 6.4 49.5 5.4 52 5.6", h.l, 1.6)],
    front: [
      B(SLEEK, h.f, { sh: h.sh, hair: 1 }),
      LN("M38 20.5Q44 22.5 47.5 29.5M62 20.5Q56 22.5 52.5 29.5", h.sh, 0.9, { fine: 1 }),
      HL("M31 28C34 23.5 38.5 20.6 44 19.6", h.l, 2),
    ],
  }),
  // Tied at the back; the tail swings out beside the neck on the right.
  ponytail: (h) => ({
    back: [
      B("M64 22C74 19.5 81.5 27 81 38C80.5 48 82 57 84.5 66C80 69 74.5 66.5 73 60.5C71.5 53 73 45 71.5 37C70.5 31 68 26 64 22Z", h.f, { sh: h.sh, hair: 1 }),
      HL("M79 44C78.8 50 79.6 55 81 60", h.l, 1.4),
    ],
    front: [
      B("M24.5 46C22 28 34 16.5 50 16.5C66 16.5 78 28 75.5 46C74 40.5 72 36.5 69.2 33.5C61.5 34.5 53 32.5 46.5 28.5C42 32.5 34.5 35 28.8 36.2C27 39.2 25.6 42.4 24.5 46Z", h.f, { sh: h.sh, hair: 1 }),
      HL("M31 28C34 23.5 38.5 20.6 44 19.6", h.l, 2),
      HL("M58 19.5C62 20.4 65.5 22.4 68 25.3", h.l, 1.6),
    ],
  }),
  // A centre parting and two plaits over the shoulders, tied in green.
  braids: (h) => {
    const plait = (d) => [
      ...[[24.8, 55, 3.5, 4.3], [25.3, 62.8, 3.35, 4.1], [25.8, 70.2, 3.15, 3.9], [26.3, 77, 2.9, 3.5]]
        .map(([x, y, rx, ry]) => B(d(ell(x, y, rx, ry)), h.f, { sh: h.sh, hair: 1 })),
      B(d("M23.6 81.5C24.5 84.5 25 86.5 26.4 88C27.5 86.5 28.5 84.5 29 81.5Z"), h.f, { sh: h.sh, hair: 1 }),
      B(d("M23.7 79.6H28.9V82H23.7Z"), "#3f9a55", { sh: "#2f7a42" }),
    ];
    return {
      locks: [...plait((d) => d), ...plait(mx)],
      front: [
        B("M24.5 47C22 28 34 16 50 16C66 16 78 28 75.5 47C74 41 72.5 37.5 70 35C63 32 55 28 50.5 23C46 28 37 32 30 35C27.5 37.5 26 41 24.5 47Z", h.f, { sh: h.sh, hair: 1 }),
        HL("M31 28C34 23.5 38.5 20.6 44 19.6", h.l, 2),
        HL("M56 19.3C60.5 20.1 64.5 22.3 67.3 25.5", h.l, 1.8),
      ],
    };
  },
  // Bald still gets a sheen, so the head does not read as unfinished.
  bald: (h, sk) => ({ front: [HL("M36 25C39.5 22.3 43.5 21 47.5 20.8", mix(sk.f, "#ffffff", 0.5), 1.8)] }),
};

// ------------------------------------------------------------------- hats
const BRIM_CAST = "M26 35C36 41.5 64 41.5 74 35V33H26Z";
const HAT = {
  none: null,
  cap: {
    covers: 31,
    cast: "M26 36C36 41.5 64 41.5 74 36V34H26Z",
    shapes: [
      B("M27 33C27 19.5 37 12 50 12C63 12 73 19.5 73 33Z", "#2fbf71", { sh: "#1f9a58" }),
      LN("M50 13V31M40 15Q36.5 23 36 31M60 15Q63.5 23 64 31", "#1f9a58", 0.9, { fine: 1 }),
      ...leaf(50, 23, 3.4, -25, "#c8f5da"),
      B(circ(50, 12.2, 1.9), "#239f5c", { sh: "#1a7d47" }),
      // The peak juts out to one side, as the old cap's did: seen from the
      // front a peak is only a line, and a line does not read at 28px.
      B("M25.5 30.5H75.5C80.5 30.5 84.5 31.5 85.5 33.5C86 35.3 84.8 36.3 82.5 36.3H25.5C24.3 36.3 23.6 35.3 23.6 33.4C23.6 31.5 24.3 30.5 25.5 30.5Z", "#239f5c", { sh: "#1a7d47" }),
    ],
  },
  beanie: {
    covers: 33,
    cast: "M26 37.5C36 42.5 64 42.5 74 37.5V35.5H26Z",
    shapes: [
      B(circ(50, 9.5, 5), "#f4e6e0", { sh: "#dcc6bf" }),
      B("M25.5 34C25.5 18.5 36.5 11 50 11C63.5 11 74.5 18.5 74.5 34Z", "#d0344f", { sh: "#a4223b" }),
      LN("M38 15Q34.5 23 34 30M44 12.3Q42.5 21 42.2 30M50 11.3V30M56 12.3Q57.5 21 57.8 30M62 15Q65.5 23 66 30", "#a4223b", 0.9, { fine: 1 }),
      B("M25 29H75C76.5 29 77.2 30 77.2 31.6V35.6C77.2 37.2 76.5 38.2 75 38.2H25C23.5 38.2 22.8 37.2 22.8 35.6V31.6C22.8 30 23.5 29 25 29Z", "#b52a44", { sh: "#8e1f35" }),
      LN(Array.from({ length: 12 }, (_, k) => `M${27 + k * 4.2} 30.4V36.8`).join(""), "#8e1f35", 0.8, { fine: 1 }),
    ],
  },
  sun_hat: {
    covers: 31,
    cast: BRIM_CAST,
    shapes: [
      B(ell(50, 33, 37, 6.8), "#e8c46a", { sh: "#c79d45" }),
      LN("M20 33.5Q50 40 80 33.5M26 36.8Q50 41.6 74 36.8", "#c79d45", 0.8, { fine: 1 }),
      B("M33.5 33.3C33.5 19 41 11.5 50 11.5C59 11.5 66.5 19 66.5 33.3Z", "#f1d27f", { sh: "#cfa955" }),
      LN("M37 19.5Q50 16.5 63 19.5", "#c79d45", 0.8, { fine: 1 }),
      D("M33 26.5H67V33.3H33Z", "#3f9a5c", { sh: "#2f7a47" }),
      ...flower(61.5, 29.9, 2.2, "#ffffff"),
    ],
  },
  bandana: {
    shapes: [
      B("M73.5 35L83 29.5L82 36L87.5 39.5L76.5 41Z", "#d8404f", { sh: "#ad2c3b" }),
      B("M24.3 36.5C28 29 38 25.5 50 25.5C62 25.5 72 29 75.7 36.5L75.2 41C71 35 62 31.8 50 31.8C38 31.8 29 35 24.8 41Z", "#d8404f", { sh: "#ad2c3b" }),
      D(circ(33.5, 32.3, 0.9) + circ(41.5, 28.9, 0.9) + circ(50, 28.2, 0.9) + circ(58.5, 28.9, 0.9) + circ(66.5, 32.3, 0.9) + circ(37.5, 32.2, 0.6) + circ(46, 30.6, 0.6) + circ(54, 30.6, 0.6) + circ(62.5, 32.2, 0.6), "#fbeee6"),
    ],
  },
  leaf_crown: {
    shapes: [
      LN("M25.5 37C25.5 27.06 36.47 19 50 19C63.53 19 74.5 27.06 74.5 37", "#3f7a3a", 1.6, { ol: 1 }),
      ...garland(50, 37, 24.5, 18, 172, 8, 11, 4.4, ["#4fbf6a", "#3f9a55", "#86c95a"]),
    ],
  },
  flower_crown: {
    shapes: [
      LN("M25.5 37C28.5 25.5 38.5 19 50 19C61.5 19 71.5 25.5 74.5 37", "#3f9a55", 2.2, { ol: 1 }),
      ...leaf(26.5, 33, 4.2, -75, "#4fbf6a", B), ...leaf(34.5, 23.5, 4.2, -38, "#4fbf6a", B),
      ...leaf(65.5, 23.5, 4.2, 38, "#4fbf6a", B), ...leaf(73.5, 33, 4.2, 75, "#4fbf6a", B),
      ...flower(30.5, 28.5, 3.1, "#ff8fb1"), ...flower(40, 21.2, 3.1, "#ffffff"), ...flower(50, 18.3, 3.7, "#ff8fb1"),
      ...flower(60, 21.2, 3.1, "#ffffff"), ...flower(69.5, 28.5, 3.1, "#ff8fb1"),
    ],
  },
  explorer_hat: {
    covers: 30,
    cast: BRIM_CAST,
    shapes: [
      B(ell(50, 31.5, 35, 5.8), "#a98352", { sh: "#86653c" }),
      B("M32 31.2C32 18 39.5 10.5 50 10.5C60.5 10.5 68 18 68 31.2Z", "#c7a068", { sh: "#9e7a47" }),
      D("M30 24.5H70V31.4H30Z", "#5f4527", { sh: "#4a351d" }),
      LN("M44 13Q50 17.6 56 13", "#9a7646", 1.4, { fine: 1 }),
      ...leaf(71.5, 20.5, 7.5, -42, "#4fbf6a", B),
    ],
  },
  headlamp: {
    shapes: [
      B("M24.5 35C29 31 39 29.5 50 29.5C61 29.5 71 31 75.5 35V39C71 35 61 33.5 50 33.5C39 33.5 29 35 24.5 39Z", "#3d4a45", { sh: "#28312d" }),
      B("M43.5 26H56.5C57.9 26 58.6 27 58.6 28.4V35C58.6 36.4 57.9 37.4 56.5 37.4H43.5C42.1 37.4 41.4 36.4 41.4 35V28.4C41.4 27 42.1 26 43.5 26Z", "#6b7a73", { sh: "#4c5853" }),
      B(circ(50, 31.7, 3.6), "#ffe66d", { sh: "#f2c230" }),
      HL("M48 30.4Q48.8 29.3 50.2 29.1", "#ffffff", 1.1),
    ],
  },
  laurel: {
    shapes: [
      LN("M28 44C26.5 34 30 26 38.5 20.5" + mx("M28 44C26.5 34 30 26 38.5 20.5"), "#9a7a1c", 1.1, { ol: 1 }),
      ...garland(50, 43, 22.5, 22.5, 182, 118, 6, 3.8, ["#e5b338", "#f0c850"]),
      ...garland(50, 43, 22.5, 22.5, 62, -2, 6, 3.8, ["#f0c850", "#e5b338"]),
    ],
  },
  crown: {
    shapes: [
      B("M28 34L28 17L38.5 25L50 11L61.5 25L72 17L72 34Z", "#f2b632", { sh: "#c98d12" }),
      D("M27 29H73V35H27Z", "#d9981a", { sh: "#b57b0e", cel: 1 }),
      D(circ(39, 32, 1.3) + circ(61, 32, 1.3), "#e0324b"),
      D(circ(50, 32, 1.6), "#3b82f6"),
      B(circ(50, 11, 2.4), "#e0324b", { sh: "#b01f36" }),
      B(circ(28, 17, 2), "#3b82f6", { sh: "#2a62c0" }),
      B(circ(72, 17, 2), "#3b82f6", { sh: "#2a62c0" }),
    ],
  },
  // The level-20 prize: a wise owl perched on the crown, gripping the hair.
  // Drawn at a comfortable size, then grown by `tf` about its feet.
  owl: {
    tf: "translate(50 23) scale(1.2) translate(-50 -19.5)",
    shapes: [
      B("M41 18.5C39.5 14 39.5 9 41 6L40.2 1L44.8 4Q50 3 55.2 4L59.8 1L59 6C60.5 9 60.5 14 59 18.5C55 20.5 45 20.5 41 18.5Z", "#9a7650", { sh: "#775a3a" }),
      D(both("M41 8C38.8 11 39 16 41.5 18.8C43 15.5 43 11 41 8Z"), "#7a5a38", { sh: "#5e452b", cel: 1 }),
      D(ell(50, 15.6, 5.2, 3.9), "#e6d2ad"),
      LN("M47 14.6L48 15.4L49 14.6M51 14.6L52 15.4L53 14.6M49 16.9L50 17.7L51 16.9", "#9a7650", 0.8, { fine: 1 }),
      D(circ(45.7, 8.6, 3.3) + circ(54.3, 8.6, 3.3), "#f1e2c4"),
      D(circ(45.7, 8.6, 1.75) + circ(54.3, 8.6, 1.75), "#f2b632"),
      D(circ(45.7, 8.7, 0.85) + circ(54.3, 8.7, 0.85), "#2a1f17"),
      D("M48.9 10.2L51.1 10.2L50 12.6Z", "#d9962a"),
      B(ell(46.4, 19.4, 1.9, 0.95), "#e0a02a", { sh: "#b97d14" }),
      B(ell(53.6, 19.4, 1.9, 0.95), "#e0a02a", { sh: "#b97d14" }),
    ],
  },
  // --- Harvest & Hallows 2026 ---
  // A wide brim and a crooked cone.
  witch_hat: {
    covers: 32,
    cast: "M24 35.5C35 42 65 42 76 35.5V33.5H24Z",
    shapes: [
      B(ell(50, 32.5, 38, 6), "#2a2235", { sh: "#1b1622" }),
      B("M29 33C33 22 39 11.5 59 0C56 10.5 58 24 71 33Z", "#3a2f48", { sh: "#241c2e" }),
      D("M28 27H72V33H28Z", "#16121c"),
      D("M45 25.8H55V34.2H45Z", "#f2b632", { sh: "#c98d12" }),
      D("M47.6 28.2H52.4V31.8H47.6Z", "#16121c"),
    ],
  },
  // --- Golden Harvest 2026 ---
  // An acorn's cup: no brim at all. What sells it is the rows of scales
  // narrowing towards the crown, plus the short stalk on top.
  acorn_cap: {
    covers: 32,
    cast: "M26 36C36 42 64 42 74 36V34H26Z",
    shapes: [
      B("M47.8 1.5H52.2V10H47.8Z", "#5a3c1c", { sh: "#40290f" }),
      B("M52 4.5C56.5 0 63 -1 68 1C65 6 58.5 8 52 6Z", "#e0632a", { sh: "#b44418" }),
      B("M24.5 33C24.5 16.5 36 7.5 50 7.5C64 7.5 75.5 16.5 75.5 33Z", "#9f7038", { sh: "#77522a" }),
      LN("M29 26Q33.2 23 37.4 26M37.4 26Q41.6 23 45.8 26M45.8 26Q50 23 54.2 26M54.2 26Q58.4 23 62.6 26M62.6 26Q66.8 23 71 26M30.5 20.5Q34.5 17.5 38.5 20.5M38.5 20.5Q42.5 17.5 46.5 20.5M46.5 20.5Q50.5 17.5 54.5 20.5M54.5 20.5Q58.5 17.5 62.5 20.5M62.5 20.5Q66.5 17.5 70.5 20.5M35 15Q38.75 12.4 42.5 15M42.5 15Q46.25 12.4 50 15M50 15Q53.75 12.4 57.5 15M57.5 15Q61.25 12.4 65 15", "#6b4a24", 1, { fine: 1 }),
      B("M26.3 30.5H73.7C75.3 30.5 76.5 31.7 76.5 33.3C76.5 34.9 75.3 36.1 73.7 36.1H26.3C24.7 36.1 23.5 34.9 23.5 33.3C23.5 31.7 24.7 30.5 26.3 30.5Z", "#6b4a24", { sh: "#523718" }),
    ],
  },
};

// ---------------------------------------------------------------- outfits
function webLines() {
  // A cobweb in the left shoulder: spokes from one corner, joined by sagging threads.
  const o = [26, 75.5], spokes = [18, 40, 62, 84].map((a) => (a * Math.PI) / 180);
  const at = (a, r) => [o[0] + Math.cos(a) * r, o[1] + Math.sin(a) * r];
  let d = spokes.map((a) => { const [x, y] = at(a, 30); return `M${o[0]} ${o[1]}L${n(x)} ${n(y)}`; }).join("");
  for (const r of [7, 13, 19]) {
    for (let k = 0; k < spokes.length - 1; k++) {
      const [x1, y1] = at(spokes[k], r), [x2, y2] = at(spokes[k + 1], r), [xm, ym] = at((spokes[k] + spokes[k + 1]) / 2, r * 0.82);
      d += `M${n(x1)} ${n(y1)}Q${n(xm)} ${n(ym)} ${n(x2)} ${n(y2)}`;
    }
  }
  return d;
}
function plaid() {
  // Two sets of bands crossing, darker where they cross: that is what makes
  // it read as woven rather than as a grid drawn on top.
  const rows = [76, 86, 96], cols = [26, 38, 60, 72];
  const band = rows.map((y) => `M0 ${y}H100V${y + 4}H0Z`).join("") + cols.map((x) => `M${x} 60H${x + 4}V100H${x}Z`).join("");
  const cross = rows.flatMap((y) => cols.map((x) => `M${x} ${y}H${x + 4}V${y + 4}H${x}Z`)).join("");
  const check = [82.6, 92.6].map((y) => `M0 ${y}H100V${y + 0.7}H0Z`).join("") + [33, 66].map((x) => `M${x} 60H${x + 0.7}V100H${x}Z`).join("");
  return [D(band, "#a13e24"), D(cross, "#7e2e1c"), D(check, "#e8b84a")];
}

const TORSO_ART = {
  tee_green: (sk) => ({
    f: "#2fbf71", sh: "#1f9a58",
    shapes: [...crew(sk, "#1f9a58"), ...leaf(61, 84.5, 4.2, -35, "#c8f5da"), LN(ARMS, "#1f9a58", 1.2, { fine: 1 })],
  }),
  tee_blue: (sk) => ({
    f: "#4f8fe0", sh: "#3570c0",
    shapes: [D("M0 84H100V88H0Z", "#f4f1ea"), ...crew(sk, "#3570c0"), LN(ARMS, "#3570c0", 1.2, { fine: 1 })],
  }),
  tee_stripes: (sk) => ({
    f: "#f4f1ea", sh: "#d4cdbd",
    shapes: [D("M0 77.5H100V80.5H0ZM0 84H100V87H0ZM0 90.5H100V93.5H0ZM0 97H100V100H0Z", "#2f5f8f"), ...crew(sk, "#2f5f8f"), LN(ARMS, "#b9b1a0", 1.2, { fine: 1 })],
  }),
  hoodie: () => ({
    f: "#7d8791", sh: "#5d666f",
    behind: [B("M29 79C27 63 37 55 50 55C63 55 73 63 71 79Z", "#66707a", { sh: "#4d555e" })],
    shapes: [
      D("M34 72C38 80 62 80 66 72L66 76C61 84 39 84 34 76Z", "#66707a", { sh: "#4d555e", cel: 1 }),
      D("M44.8 78.6H46.2V89H44.8ZM53.8 78.6H55.2V89H53.8Z", "#f4f1ea"),
      D("M34 90C40 88.5 60 88.5 66 90L68.5 100H31.5Z", "#717b85", { sh: "#59626b", cel: 1 }),
      LN(ARMS, "#5d666f", 1.2, { fine: 1 }),
    ],
  }),
  overalls: (sk) => ({
    f: "#f2cd6e", sh: "#d4a84a",
    shapes: [
      ...crew(sk, "#d4a84a"),
      D(both("M36.2 73.4L38.6 72.8L40.4 80.5L38 81Z"), "#4a6fae"),
      D("M37 79.5H63V100H37Z", "#4a6fae", { sh: "#37558a", cel: 1 }),
      D(circ(39.8, 82, 1.5) + circ(60.2, 82, 1.5), "#f2b632"),
      D("M44 85.5H56V93Q50 95 44 93Z", "#3f6099"),
      LN(ARMS, "#d4a84a", 1.2, { fine: 1 }),
    ],
  }),
  raincoat: (sk) => ({
    f: "#f5bf1f", sh: "#cf9a0a",
    shapes: [
      vee(sk, 76),
      D(both("M41.5 72L50 77.5L45.5 82.5L37 75Z"), "#e2a90c"),
      LN("M50 78V100", "#b98a06", 1.3),
      D(circ(53.5, 86, 1.3) + circ(53.5, 93, 1.3), "#8a6a10"),
      D(both("M25.5 89H35V91.8H25.5Z"), "#e2a90c"),
      LN(ARMS, "#cf9a0a", 1.2, { fine: 1 }),
    ],
  }),
  field_vest: (sk) => ({
    f: "#7fa36c", sh: "#5f8350",
    shapes: [
      ...crew(sk, "#5f8350"),
      D(both("M20 100C20 89 21.5 81.5 27 77C31 74.5 36 72.8 41.5 72.2L45 100Z"), "#c9ae7a", { sh: "#a88d5a", cel: 1 }),
      D(both("M26 84H37V93H26Z"), "#b69a66"),
      D(both("M25.5 83H37.5V86H25.5Z"), "#a88d5a"),
      LN(ARMS, "#a88d5a", 1.2, { fine: 1 }),
    ],
  }),
  lab_coat: (sk) => ({
    f: "#f7f6f0", sh: "#d6d9cf",
    shapes: [
      D("M43.5 71.8L50 80L56.5 71.8Z", "#4f8fe0"),
      vee(sk, 74.5),
      D(both("M41.5 72L50 81.5L46.5 86L37.5 75Z"), "#eceee6"),
      LN("M50 86V100", "#c9ccc2", 1),
      D(circ(50, 90, 1.1) + circ(50, 96, 1.1), "#c9ccc2"),
      D("M65.2 81.5H67.4V88H65.2Z", "#d8404f"),
      D("M62 86H73V96H62Z", "#eceee6"),
      LN(ARMS, "#c9ccc2", 1.2, { fine: 1 }),
    ],
  }),
  apron: (sk) => ({
    f: "#f1f5ea", sh: "#cfdcc2",
    shapes: [
      D("M44.5 71.8L50 75.3L55.5 71.8Z", sk.f),
      D(both("M42 71.8L50 75.2L45.6 79.2Z"), "#ffffff"),
      D(both("M36.4 73.9L38.2 73.1L41 80.6L39.2 81.2Z"), "#5f9a4e"),
      D("M38.5 80.5H61.5V100H38.5Z", "#6fae5c", { sh: "#558f44", cel: 1 }),
      D("M43 88.5H57V95Q50 97.5 43 95Z", "#5a9449"),
      LN("M54.3 89L56.6 83.2", "#f2b632", 1.8), LN("M56.6 83.2L57.1 82", "#3b2a1e", 1.8),
      LN("M47 88.5V84.8", "#3f7a35", 1.1),
      ...flower(47, 83.5, 1.7, "#ff8fb1", D),
      LN(ARMS, "#cfdcc2", 1.2, { fine: 1 }),
    ],
  }),
  explorer_jacket: () => ({
    f: "#b58d58", sh: "#8e6b3e",
    shapes: [
      D("M44 71.8L50 77L56 71.8Z", "#2fbf71"),
      D(both("M42 72L50 77.5L46.5 82L38.5 74.5Z"), "#a07a48"),
      LN("M50 79V100", "#7a5a32", 1.3, { fine: 1 }),
      D(both("M26 86H36V94H26Z"), "#a07a48"), D(both("M25.5 85H36.5V88.5H25.5Z"), "#8e6b3e"),
      D("M28 76.5L32 74.5L75 100H68Z", "#6b4526", { sh: "#50321a", cel: 1 }),
      D("M50 85.6H54.6V90.2H50Z", "#f2b632", { tf: "rotate(30 52.3 87.9)" }),
      LN(ARMS, "#8e6b3e", 1.2, { fine: 1 }),
    ],
  }),
  cape: (sk) => ({
    f: "#2e2a33", sh: "#1d1a21",
    behind: [B(CAPE_BACK, "#8e1435", { sh: "#6d0f29" })],
    shapes: [
      ...crew(sk, "#1d1a21"),
      D(PANELS, "#c62348", { sh: "#9a1836", cel: 1 }),
      D("M0 95H100V98H0Z", "#f2b632"),
      LN("M44.5 72.8Q50 76 55.5 72.8", "#c98d12", 1.2),
      D(circ(50, 75.2, 3), "#f2b632", { sh: "#c98d12" }),
    ],
  }),
  gold_jersey: (sk) => ({
    f: "#f2b632", sh: "#cf9119",
    shapes: [
      D("M0 89H100V91.5H0Z", "#fff7de"),
      D(star(50, 82, 4.6), "#fff7de"),
      ...crew(sk, "#cf9119"),
      LN(ARMS, "#cf9119", 1.2, { fine: 1 }),
    ],
  }),
  star_cloak: (sk) => ({
    f: "#2c2869", sh: "#1d1a4c",
    behind: [B("M9 100V90C9 71 29 63 50 63C71 63 91 71 91 90V100Z", "#3d3896", { sh: "#2c2870" })],
    shapes: [
      ...crew(sk, "#1d1a4c"),
      D(PANELS, "#3d3896", { sh: "#2c2870", cel: 1 }),
      D(star(29, 85, 1.9) + star(35.5, 94, 1.4) + star(24.5, 93, 1.1) + star(71, 84, 1.7) + star(65.5, 94, 2) + star(75.5, 92.5, 1.1), "#ffe66d"),
      D(circ(50, 75.2, 3.2), "#ffe66d"),
      D(circ(51.4, 74.3, 2.5), "#3d3896"),
    ],
  }),
  // --- Harvest & Hallows 2026 ---
  cobweb_tee: (sk) => ({
    f: "#2f2846", sh: "#201a33",
    shapes: [
      ...crew(sk, "#201a33"),
      LN(webLines(), "#e6ebf5", 0.9),
      LN("M64 79.5V71.5", "#e6ebf5", 0.7, { fine: 1 }),
      LN("M62 83L58.5 80.5M62 85L58 86.8M66 83L69.5 80.5M66 85L70 86.8", "#e6ebf5", 0.9),
      D(circ(64, 84.2, 2.4) + circ(64, 80.9, 1.4), "#d5dbe9"),
    ],
  }),
  skeleton: () => ({
    f: "#1f1d26", sh: "#141218",
    shapes: [
      D(both("M34.5 75.3Q41.5 73.3 48.5 76L48.2 77.4Q41.5 75 34.8 76.8Z"), "#eef1f5"),
      D("M48.6 76.5H51.4V94H48.6Z", "#eef1f5"),
      D([79, 84.5, 90].map((y, k) => `M${38 + k} ${y}Q50 ${y + 3} ${62 - k} ${y}L${62 - k} ${y + 2.4}Q50 ${y + 5.4} ${38 + k} ${y + 2.4}Z`).join(""), "#eef1f5"),
      D(both("M25 84.5L27.4 84.2L28 100H25.6Z"), "#eef1f5"),
    ],
  }),
  vampire_cape: (sk) => ({
    f: "#231e2a", sh: "#16121b",
    behind: [B(CAPE_BACK, "#8a0f2a", { sh: "#660a1f" }), B(both("M26.5 79L29.5 59.5L41.5 71.5Z"), "#c31437", { sh: "#930e29" })],
    shapes: [
      D("M41 71.8L50 81L59 71.8Z", "#eef1f5"),
      vee(sk),
      D("M47.8 76.5L50 79L52.2 76.5L51.3 84.5H48.7Z", "#dfe3ea"),
      D(circ(50, 84, 2.3), "#c31437", { sh: "#930e29" }),
      LN(ARMS, "#3a3342", 1.2, { fine: 1 }),
    ],
  }),
  // --- Golden Harvest 2026 ---
  knit_sweater: (sk) => ({
    f: "#c25d2a", sh: "#9c4520",
    shapes: [
      D("M0 94H100V100H0Z", "#a4471c"),
      LN(Array.from({ length: 16 }, (_, k) => `M${21.5 + k * 3.8} 94.8V99.4`).join(""), "#7e3614", 0.8, { fine: 1 }),
      LN("M36 78C39 81 33 84 36 87C39 90 33 92 36 93.5M50 77C53 80 47 83 50 86C53 89 47 92 50 93.5M64 78C67 81 61 84 64 87C67 90 61 92 64 93.5", "#e08a52", 1.3),
      D("M41.5 71.8Q50 78 58.5 71.8Z", "#a4471c"),
      D("M43.5 71.8Q50 75.4 56.5 71.8Z", sk.f),
      LN(ARMS, "#9c4520", 1.2, { fine: 1 }),
    ],
  }),
  flannel: (sk) => ({
    f: "#c1512f", sh: "#973a1f",
    shapes: [
      ...plaid(),
      vee(sk),
      D(both("M41 71.8L50 78L46 82L37 74.5Z"), "#a13e24"),
      D("M48.6 78H51.4V100H48.6Z", "#a13e24"),
      D(circ(50, 83, 1.1) + circ(50, 90, 1.1) + circ(50, 97, 1.1), "#e8b04a"),
      LN(ARMS, "#7e2e1c", 1.2, { fine: 1 }),
    ],
  }),
  leaf_cloak: (sk) => ({
    f: "#7d3f1f", sh: "#5e2d15",
    behind: [B("M13 100V90C13 73 30 65 50 65C70 65 87 73 87 90V100Z", "#c8742a", { sh: "#9c521b" })],
    shapes: [
      D("M45 71.8L50 74.8L55 71.8Z", sk.f),
      D(PANELS, "#e39432", { sh: "#b86d1e", cel: 1 }),
      ...leaf(29, 85, 5, -35, "#f4d04a"), ...leaf(34.5, 94.5, 4.5, 20, "#c9402a"), ...leaf(25.5, 95.5, 4, -60, "#93a437"),
      ...leaf(71, 85, 5, 35, "#e0541c"), ...leaf(65.5, 94.5, 4.6, -15, "#f4d04a"), ...leaf(74.5, 95.5, 4, 60, "#93a437"),
      D(circ(50, 74.8, 3.3), "#f2d06a", { sh: "#c9a232" }), D(circ(50, 74.8, 1.35), "#8a3c17"),
    ],
  }),
};

// Props hang behind the body, so the shoulders overlap them and they read
// as worn rather than stuck on.
const WING_L = "M47 76C38 64 22 57 6 62C13 67 13 74 8 80C17 77 24 80 28 87C33 80 41 77 47 84Z";
// The finger bones are light struts rather than pen lines, which would
// vanish into a dark membrane.
function strut(x0, y0, x1, y1, w) {
  const len = Math.hypot(x1 - x0, y1 - y0), px = (-(y1 - y0) / len) * w / 2, py = ((x1 - x0) / len) * w / 2;
  return `M${n(x0 + px)} ${n(y0 + py)}L${n(x1 + px * 0.3)} ${n(y1 + py * 0.3)}L${n(x1 - px * 0.3)} ${n(y1 - py * 0.3)}L${n(x0 - px)} ${n(y0 - py)}Z`;
}
const WING_BONES = both(strut(46, 78.5, 12, 64.5, 1.4) + strut(46, 81, 10, 78, 1.3) + strut(46, 83, 28.5, 86.5, 1.2));
const wings = (f, sh, bone) => ({ behind: [B(both(WING_L), f, { sh }), D(WING_BONES, bone)] });
// A carved pumpkin worn over the whole head, in head space: it hides the
// hair, ears and face, and a hat still sits on top of it (see `build`).
const PUMPKIN = ell(50, 42, 29, 26.5);
// The stalk and its leaves, which a hat on top hides.
const stem = (shapes) => shapes.map((s) => ({ ...s, stem: 1 }));
const PUMPKIN_RIBS = "M36 17.5C29 26 29 58 36 66.5M64 17.5C71 26 71 58 64 66.5M50 15.5C46 28 46 56 50 68.5";
const PROP_ART = {
  none: null,
  // --- Harvest & Hallows 2026 ---
  bat_wings: wings("#2c2236", "#1b1622", "#8a78a0"),
  pumpkin_lantern: {
    mask: [
      ...stem([B("M47.8 17.5C47.5 13 48.5 10 51.5 8L54 9.8C51.8 11.5 51.5 14 51.8 17.5Z", "#4a7c34", { sh: "#355a25" }), ...leaf(57.5, 11.5, 3.6, -20, "#5a9a3a", B)]),
      B(PUMPKIN, "#ef7a1a", { sh: "#c85a0c" }),
      LN(PUMPKIN_RIBS, "#c85a0c", 1),
      D(both("M35 37L45.5 41.5L36.5 46.5Z") + "M47.8 50.5L52.2 50.5L50 46.8Z"
        + "M35 53.5Q50 66 65 53.5L60.5 54.8L58 58L54.5 56.2L50 59.3L45.5 56.2L42 58L39.5 54.8Z", "#ffc44d"),
    ],
  },
  // --- Golden Harvest 2026 ---
  // The Hallows pumpkin warmed up: round carving and autumn leaves on the
  // stem, in exactly the same place.
  harvest_lantern: {
    mask: [
      ...stem([B("M48.3 9H51.7V17.5H48.3Z", "#7a5124", { sh: "#5a3a18" }), ...leaf(57, 9.8, 4.2, -25, "#c2402a", B), ...leaf(43, 10.4, 3.6, 25, "#e0a92e", B)]),
      B(PUMPKIN, "#f28c28", { sh: "#cf6b12" }),
      LN(PUMPKIN_RIBS, "#cf6b12", 1),
      D(circ(40.5, 41.5, 4) + circ(59.5, 41.5, 4) + "M37.5 53Q50 64.5 62.5 53Q50 58.5 37.5 53Z", "#ffd166"),
    ],
  },
};
// On a pumpkin head a hat sits on the pumpkin: head space is scaled so the
// head's crown (x 26–74, top y 19) lands on the pumpkin's (x 21–79, top 15.5).
const HAT_ON_MASK = "translate(50 15.5) scale(1.21) translate(-50 -19)";

// --------------------------------------------------------------- habitats
// Drawn in canvas space behind everything, in a softer pen and a paler
// wash, flat (no hatching), so the scene stays behind the character. The
// sides carry the detail: the middle is where the avatar stands.
const SKY = "M-2 -2H102V102H-2Z";
const ground = (d, f) => B(d, f);
function pine(x, base, h, w, f) {
  const t = (k, s) => `${n(x + s * w * k)} ${n(base - h * (k === 1 ? 0 : k === 0.7 ? 0.32 : 0.64))}`;
  return B(`M${x} ${n(base - h)}L${t(0.42, 1)}L${t(0.28, 1)}L${t(0.7, 1)}L${t(0.5, 1)}L${t(1, 1)}L${t(1, -1)}L${t(0.5, -1)}L${t(0.7, -1)}L${t(0.28, -1)}L${t(0.42, -1)}Z`, f);
}
const trunk = (x, top, bottom, w = 2.4) => B(`M${n(x - w / 2)} ${bottom}V${top}H${n(x + w / 2)}V${bottom}Z`, "#8a6a45");
function broadleaf(x, base, r, fills) {
  return [
    trunk(x, base - r * 1.2, base, r * 0.34),
    B(circ(x - r * 0.55, base - r * 1.55, r * 0.72), fills[1]),
    B(circ(x + r * 0.6, base - r * 1.5, r * 0.7), fills[1]),
    B(circ(x, base - r * 2.05, r * 0.82), fills[0]),
  ];
}
const dots = (pts, r, f) => D(pts.map(([x, y]) => circ(x, y, r)).join(""), f);
const snowcap = (x, y, w) => D(`M${x} ${y}L${n(x + w)} ${n(y + w * 1.25)}L${n(x + w * 0.35)} ${n(y + w)}L${x} ${n(y + w * 1.35)}L${n(x - w * 0.35)} ${n(y + w)}L${n(x - w)} ${n(y + w * 1.25)}Z`, "#ffffff");

const BACKDROP_ART = {
  none: null,
  meadow: [
    B(SKY, "#d4ebf2"),
    B(circ(80, 19, 6.5), "#fff1b0"),
    B("M6 27C6 23.5 9 22 11.5 23C12.5 19.5 17.5 19 19 22.5C22 22 24 24 23.5 27Z", "#ffffff"),
    ground("M-2 62C16 55 34 56 52 60C70 64 86 56 102 58V102H-2Z", "#b2dc98"),
    ground("M-2 72C24 67 58 71 102 66V102H-2Z", "#84c873"),
    dots([[9, 79], [17, 85], [86, 77], [92, 83], [6, 90]], 1.2, "#ff9ab8"),
    dots([[13, 81], [89, 88], [82, 82]], 1.1, "#ffffff"),
    dots([[20, 78], [95, 78]], 1, "#ffd84a"),
    LN("M4 76L5 72.8M7 76.2L6.4 72.6M92 73.8L93 70.6M94.5 74L93.9 70.6", "#4f9a4a", 0.9),
  ],
  pine_forest: [
    B(SKY, "#dcece6"),
    pine(30, 64, 24, 6.5, "#8fb59c"), pine(70, 63, 26, 7, "#8fb59c"), pine(42, 62, 18, 5, "#8fb59c"), pine(58, 62, 19, 5, "#8fb59c"),
    ground("M-2 66C30 62 70 64 102 62V102H-2Z", "#7aa864"),
    trunk(14, 74, 84), trunk(86, 72, 84),
    pine(14, 76, 44, 10, "#3f7d5a"), pine(86, 74, 46, 10.5, "#3f7d5a"),
    pine(26, 76, 26, 7, "#4f8d66"), pine(74, 75, 27, 7, "#4f8d66"),
  ],
  broadleaf_forest: [
    B(SKY, "#e5f1dc"),
    B(circ(24, 50, 9), "#9fca82"), B(circ(76, 49, 9.5), "#9fca82"), B(circ(40, 55, 7), "#9fca82"), B(circ(62, 54, 7.5), "#9fca82"),
    ground("M-2 68C30 63 70 65 102 63V102H-2Z", "#8cbf68"),
    ...broadleaf(14, 80, 12, ["#5fa352", "#4c9146"]),
    ...broadleaf(87, 78, 12.5, ["#6fb05a", "#4c9146"]),
  ],
  mountain: [
    B(SKY, "#dcebf6"),
    B("M-2 64L14 44L24 52L36 32L48 50L60 26L74 46L86 36L102 54V102H-2Z", "#b8c6d3"),
    snowcap(14, 44, 3.4), snowcap(36, 32, 4.2), snowcap(60, 26, 4.6), snowcap(86, 36, 3.8),
    B("M-2 72L16 58L28 65L44 56L62 67L80 54L102 68V102H-2Z", "#94abbb"),
    ground("M-2 78C30 72 70 76 102 72V102H-2Z", "#8cc77d"),
    dots([[8, 86], [92, 84]], 1.1, "#ffffff"),
  ],
  coastline: [
    B(SKY, "#d7ebf4"),
    B(circ(78, 20, 6), "#fff1b0"),
    B("M-2 58H102V102H-2Z", "#7dbdd6"),
    B("M-2 42C6 40 13 44 17 51C19 55 21 59 25 62H-2Z", "#c2ab7c"),
    D("M-2 42C6 40 13 44 17 51L15.4 51.8C11.5 46 6 43.6 -2 44.5Z", "#8cbf68"),
    LN("M30 64Q33 62 36 64Q39 66 42 64M62 67Q65 65 68 67Q71 69 74 67M82 61Q85 59 88 61", "#4f8fb0", 1),
    ground("M-2 80C28 74 64 78 102 72V102H-2Z", "#eedcaa"),
    LN("M64 27Q67 24 70 27Q73 24 76 27M84 33Q86 31.5 88 33Q90 31.5 92 33", SEPIA, 0.9),
  ],
  // --- Golden Harvest 2026 ---
  autumn_forest: [
    B(SKY, "#f5e6c8"),
    B(circ(24, 50, 9), "#efc27a"), B(circ(76, 49, 9.5), "#e8a860"), B(circ(40, 55, 7), "#f0cf86"), B(circ(62, 54, 7.5), "#efc27a"),
    ground("M-2 70C20 66 36 68 52 67C70 66 86 63 102 65V102H-2Z", "#d8b06a"),
    ...broadleaf(14, 80, 12, ["#e8902f", "#d9622b"]),
    ...broadleaf(87, 78, 12.5, ["#f0c04a", "#c9452a"]),
    ...leaf(30, 26, 2.4, 30, "#e0632a"), ...leaf(72, 20, 2.2, -40, "#f0c04a"), ...leaf(24, 60, 2.2, 70, "#c9452a"),
    dots([[8, 84], [20, 88], [80, 86], [92, 82], [6, 76]], 1.3, "#d9622b"),
    dots([[14, 92], [88, 90]], 1.2, "#f0c04a"),
  ],
};

// --------------------------------------------------------------- the rig
// Head space is scaled about the head's centre (50, 43), body space about
// the bottom middle (50, 100): a slightly narrower, longer face than a
// cartoon's and a short natural neck, as a field sketch would have it.
const rig = (hs, hsy, hy, bs) => ({
  head: `translate(${n(50 - 50 * hs)} ${n(43 - 43 * hsy + hy)}) scale(${hs} ${hsy})`,
  body: `translate(${n(50 - 50 * bs)} ${n(100 - 100 * bs)}) scale(${bs})`,
});
const RIG = { ...rig(0.95, 0.99, 1.6, 1), canvas: "" };

function build(a) {
  const sk = skinPaint(a.skin), h = hairPaint(a.hairColor);
  const hair = (HAIRSTYLE[a.hair] ?? HAIRSTYLE.short)(h, sk);
  const hat = HAT[a.hat] ?? null;
  const t = (TORSO_ART[a.torso] ?? TORSO_ART.tee_green)(sk);
  const prop = PROP_ART[a.props] ?? null;
  const backdrop = BACKDROP_ART[a.backdrop] ?? null;
  const mask = prop?.mask ?? null;
  const clipY = hat?.covers ?? null;
  const frontBases = (hair.front || []).filter((s) => s.k === "b");
  const L = [];
  if (backdrop) L.push({ sp: "canvas", shapes: backdrop, soft: 1 });
  if (prop?.behind) L.push({ sp: "body", shapes: prop.behind, cel: 1 });
  if (t.behind) L.push({ sp: "body", shapes: t.behind, cel: 1 });
  if (hair.back && !mask) L.push({ sp: "head", shapes: hair.back, cel: 1, clipY });
  L.push({ sp: "body", shapes: [B(NECK, sk.sh, { sh: mix(sk.sh, "#000000", 0.12) })] });
  L.push({ sp: "body", shapes: [B(TORSO, t.f, { sh: t.sh }), ...t.shapes], cel: 1 });
  if (mask) {
    // A pumpkin head replaces the whole head; a hat sits on the pumpkin.
    L.push({ sp: "head", shapes: hat ? mask.filter((s) => !s.stem) : mask, cel: 1 });
    if (hat) L.push({ sp: "head", shapes: hat.shapes, cel: 1, tf: [HAT_ON_MASK, hat.tf].filter(Boolean).join(" ") });
    return { L, sk, h, eye: eyePaint(a.eyes) };
  }
  if (hair.locks) L.push({ sp: "head", shapes: hair.locks, cel: 1 });
  L.push({ sp: "head", cel: 1, shapes: [
    B(circ(25.5, 46.5, 4.6), sk.f, { sh: sk.sh }), B(circ(74.5, 46.5, 4.6), sk.f, { sh: sk.sh }),
    LN("M24.3 44.9Q22.6 46.5 24.4 48.5M75.7 44.9Q77.4 46.5 75.6 48.5", sk.sh, 1.1, { fine: 1 }),
  ] });
  // The fringe casts its shadow on the forehead, and so does a brim.
  const head = [B(HEAD, sk.f, { sh: sk.sh }), ...frontBases.map((s) => S(s.d, sk.sh, { tf: "translate(1 2.6)" }))];
  if (hat?.cast) head.push(S(hat.cast, sk.sh));
  L.push({ sp: "head", shapes: head, cel: 1 });
  L.push({ sp: "head", face: 1 });
  if (hair.front) L.push({ sp: "head", shapes: hair.front, cel: 1, clipY });
  if (hat) L.push({ sp: "head", shapes: hat.shapes, cel: 1, tf: hat.tf });
  return { L, sk, h, eye: eyePaint(a.eyes) };
}

// ------------------------------------------------------------------- face
// The face is the prototype's, unchanged, and deliberately neutral: small
// eyes, one lid line, one short tick. Bigger eyes, a ring round the iris or
// a lash flick at each outer corner all read as make-up and push every face
// towards feminine. The eye colour lives inside the same small oval: the
// iris fills it and a dark pupil sits in the middle.
function face({ sk, h, eye }, small) {
  const brow = mix(h.sh, SEPIA, 0.4);
  const iris = mix(eye, PUPIL, 0.15);
  const e = (cx) => small
    ? `<ellipse cx="${cx}" cy="47" rx="2.4" ry="3" fill="${iris}"/><ellipse cx="${cx}" cy="47.2" rx="1.2" ry="1.55" fill="${PUPIL}"/>`
    : `<ellipse cx="${cx}" cy="47" rx="1.9" ry="2.4" fill="${iris}"/><ellipse cx="${cx}" cy="47.15" rx=".95" ry="1.25" fill="${PUPIL}"/><circle cx="${n(cx + 0.65)}" cy="46.2" r=".6" fill="${PAPER}"/><path d="M${n(cx - 2.8)} 44.7Q${cx} 43.2 ${n(cx + 2.8)} 44.7" stroke="${SEPIA}" stroke-width=".9" fill="none" stroke-linecap="round"/><path d="M${n(cx + 2.6)} 44.6L${n(cx + 3.5)} 43.7" stroke="${SEPIA}" stroke-width=".7" stroke-linecap="round"/>`;
  const blush = small ? 0.45 : 0.32;
  return `${e(41)}${e(59)}
    <path d="${wobble("M37.4 40.6Q41 39.2 44.3 40.3M55.7 40.3Q59 39.2 62.6 40.6", 0.25)}" stroke="${brow}" stroke-width="${small ? 1.8 : 1.1}" fill="none" stroke-linecap="round"/>
    <ellipse cx="35.3" cy="53" rx="3.5" ry="2.2" fill="#e98b7d" opacity="${blush}"/><ellipse cx="64.7" cy="53" rx="3.5" ry="2.2" fill="#e98b7d" opacity="${blush}"/>
    ${small ? "" : `<g fill="${mix(sk.sh, SEPIA, 0.5)}" opacity=".6"><circle cx="33.8" cy="51.6" r=".42"/><circle cx="36" cy="52.4" r=".36"/><circle cx="34.8" cy="54.2" r=".36"/><circle cx="66.2" cy="51.6" r=".42"/><circle cx="64" cy="52.4" r=".36"/><circle cx="65.2" cy="54.2" r=".36"/></g>
    <path d="${wobble("M50.5 48.6Q48.8 51.8 50.8 52.5", 0.2)}" stroke="${SEPIA}" stroke-width=".85" fill="none" stroke-linecap="round"/>`}
    <path d="${wobble("M46.4 55.6Q50 58.6 53.6 55.6", 0.2)}" stroke="${SEPIA}" stroke-width="${small ? 1.5 : 1}" fill="none" stroke-linecap="round"/>${small ? "" : `<path d="M49 58.5Q50 59 51 58.5" stroke="${SEPIA}" stroke-width=".6" fill="none" stroke-linecap="round" opacity=".7"/>`}`;
}

// --------------------------------------------------------------- renderer
// Inline SVG ids are document-wide and a page can show thirty avatars, so
// every render gets its own prefix.
let seq = 0;
const tfA = (s) => (s.tf ? ` transform="${s.tf}"` : "");
const path = (s, attrs, d) => `<path d="${d}"${tfA(s)} ${attrs}/>`;

function render(avatar, { className = "av", small = false } = {}) {
  const id = `av${++seq}-`, M = build(normalizeAvatar(avatar)), defs = [];
  // Washes are mixed a little towards the paper, less so when small.
  const paper = (c) => mix(c, PAPER, small ? 0.06 : 0.16);
  const wl = (s) => wobble(s.d, small ? 0.25 : 0.45);
  const LW = small ? 1.9 : 1;
  // An event hair colour is a gradient across the whole head of hair, in
  // head space, so every curl takes its own slice of it.
  const hairFill = M.h.stops ? `url(#${id}hair)` : null;
  if (hairFill) {
    defs.push(`<linearGradient id="${id}hair" gradientUnits="userSpaceOnUse" x1="46" y1="8" x2="56" y2="60">${
      M.h.stops.map((c, i) => `<stop offset="${n(i / (M.h.stops.length - 1))}" stop-color="${paper(c)}"/>`).join("")
    }</linearGradient>`);
  }
  const fillOf = (s) => (s.hair && hairFill ? hairFill : paper(s.f));
  // A habitat is inked in a lighter pen over paler washes.
  const SOFT_INK = mix(SEPIA, PAPER, 0.4);
  const softPaper = (c) => mix(c, PAPER, small ? 0.14 : 0.26);
  if (!small) defs.push(`<pattern id="${id}hatch" width="2.3" height="2.3" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><path d="M0 0V2.3" stroke="${SEPIA}" stroke-width=".5" opacity=".6"/></pattern>`);

  let body = "";
  M.L.forEach((layer, i) => {
    if (layer.face) { body += `<g transform="${RIG.head}">${face(M, small)}</g>`; return; }
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
      const d = wl(s), fill = layer.soft ? wash(s.f) : fillOf(s);
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
    if (layer.tf) g = `<g transform="${layer.tf}">${g}</g>`;
    body += RIG[layer.sp] ? `<g transform="${RIG[layer.sp]}">${g}</g>` : g;
  });
  // Coins of 40px and under are cropped to head and shoulders.
  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="${small ? "12 3 76 76" : "0 0 100 100"}" aria-hidden="true" focusable="false"><defs>${defs.join("")}</defs>${body}</svg>`;
}

/**
 * The avatar as inline SVG markup, for the big portraits (the wardrobe's
 * hero, the event pass's fitting room).
 * `avatar` is { skin, hair, hairColor, eyes, hat, torso, props }; unknown
 * ids fall back to the defaults. `small` is the coin drawing, for 40px and
 * under.
 */
export function avatarSvg(avatar, { className = "av", small = false } = {}) {
  return render(avatar, { className, small });
}

/** The same, as an element ready to append. */
export function avatarElement(avatar, opts) {
  const tpl = document.createElement("template");
  tpl.innerHTML = avatarSvg(avatar, opts).trim();
  return tpl.content.firstElementChild;
}

// ----------------------------------------------------------- bitmap cache
// Painting the SVG costs ~1.4ms an avatar per repaint; a baked bitmap
// costs ~0.07ms. So anything repeated (the header coin, the leaderboard,
// wardrobe tiles) shows an <img>: first the SVG itself, then, once baked,
// a PNG at twice its size. Bakes run one at a time off the critical path,
// and one whose image has left the page by its turn is skipped, since the
// wardrobe redraws every tile on each pick.
const images = new Map(); // key -> { svg, png }
const queue = [];
let baking = false;

const keyOf = (a, small, px) => `${AVATAR_SLOTS.map((s) => a[s]).join(".")}.${small ? "s" : "l"}${px}`;

function schedule(fn) {
  if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: 500 });
  else setTimeout(fn, 16);
}

async function bakeNext() {
  const job = queue.shift();
  if (!job) { baking = false; return; }
  const entry = images.get(job.key);
  const live = document.querySelectorAll(`img[data-av="${job.key}"]`);
  if (entry && !entry.png && live.length) {
    try {
      const img = new Image();
      img.src = entry.svg;
      await img.decode();
      const size = job.px * 2;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d").drawImage(img, 0, 0, size, size);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob) {
        entry.png = URL.createObjectURL(blob);
        document.querySelectorAll(`img[data-av="${job.key}"]`).forEach((el) => { el.src = entry.png; });
      }
    } catch {
      // A browser that will not rasterise the SVG keeps showing the SVG.
    }
  }
  schedule(bakeNext);
}

/**
 * The avatar as an `<img>` markup string, drawn for a box of `px` CSS
 * pixels. Same options as `avatarSvg`.
 */
export function avatarImg(avatar, { className = "av", small = false, px = 64 } = {}) {
  const a = normalizeAvatar(avatar);
  const key = keyOf(a, small, px);
  let entry = images.get(key);
  if (!entry) {
    const svg = render(a, { className: "", small });
    entry = { svg: URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })), png: null };
    images.set(key, entry);
  }
  if (!entry.png) {
    queue.push({ key, px });
    if (!baking) { baking = true; schedule(bakeNext); }
  }
  return `<img class="${className}" src="${entry.png || entry.svg}" data-av="${key}" alt="" draggable="false">`;
}
