// src/ui/components/BadgeArt.view.js
import { BADGE_DEFINITIONS } from "../../data/badges.js";
import { n, mix, ell, circ, star, mx, B, D, S, LN, HL, leaf, flower, garland } from "./fieldGuideInk.js";
import { stickerLayers } from "./fieldSticker.js";

/**
 * Badge medallions, drawn as Field Sticker art (bright cel-shaded colour,
 * no ink outline, white die-cut edge; see fieldSticker.js for the rules).
 * The avatars keep the softer Field Guide hand; both share the shape
 * vocabulary.
 *
 * A medallion is built in four parts, back to front:
 *  1. a backing that gives each tier its silhouette;
 *  2. a rim with a gloss on its upper left;
 *  3. a tinted disc with a quiet background, then the badge's own emblem;
 *  4. a ribbon banner across the bottom carrying one to four stars.
 * Every frame stays with plants, climbing in richness: common is a green
 * coin in a leafy wreath, rare a blue coin in leaves starred with
 * forget-me-nots, epic a purple coin in a wreath of lavender, legendary a
 * gold coin as the heart of a sunflower, on an amber ribbon. The stars count the tier, so the climb
 * reads even where colour does not (the locked grey sketches, colour-blind
 * eyes).
 *
 * The medal is centred on (50, 45). Emblems are drawn on a 100×100 canvas
 * centred on (50, 50) within a radius of about 27, and placed by EMBLEM_AT.
 */

const WOOD = "#9a6a3a";
const WOOD_SH = "#74502a";
// The darkest tone a badge uses: never black, which reads cheap when small.
const INKY = "#3e4a42";
const WHITE = "#ffffff";
const C = [50, 45];

// ------------------------------------------------------------- geometry
function nstar(cx, cy, R, r, k, rot = -90) {
  let d = "";
  for (let i = 0; i < k * 2; i++) {
    const a = ((rot + (i * 180) / k) * Math.PI) / 180, rr = i % 2 ? r : R;
    d += `${i ? "L" : "M"}${n(cx + Math.cos(a) * rr)} ${n(cy + Math.sin(a) * rr)}`;
  }
  return d + "Z";
}
function scallops(cx, cy, r, out, k) {
  let d = "";
  for (let i = 0; i <= k; i++) {
    const a = (i / k) * Math.PI * 2 - Math.PI / 2, am = ((i - 0.5) / k) * Math.PI * 2 - Math.PI / 2;
    const [x, y] = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    d += i ? `Q${n(cx + Math.cos(am) * out)} ${n(cy + Math.sin(am) * out)} ${n(x)} ${n(y)}` : `M${n(x)} ${n(y)}`;
  }
  return d + "Z";
}
const pt = (r, deg, [cx, cy] = C) => [cx + Math.cos((deg * Math.PI) / 180) * r, cy + Math.sin((deg * Math.PI) / 180) * r];
const poly = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${n(x)} ${n(y)}`).join("") + "Z";
const rect = (x, y, w, h) => `M${x} ${y}H${n(x + w)}V${n(y + h)}H${x}Z`;
// Short radial ticks between two radii, every `step` degrees.
const ticks = (r0, r1, step, from = 0) => Array.from({ length: Math.round(360 / step) }, (_, i) => {
  const a = from + i * step, [x0, y0] = pt(r0, a), [x1, y1] = pt(r1, a);
  return `M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}`;
}).join("");
const sparkle = (x, y, r, f = "#ffe066") => B(nstar(x, y, r, r * 0.3, 4), f, { sh: mix(f, "#b07a00", 0.3) });
const dots = (pts, r, f) => D(pts.map(([x, y]) => circ(x, y, r)).join(""), f);
// The rim's gloss: a bright arc on its upper left, where the light comes from.
const gloss = (r) => {
  const [a, b, c] = [pt(r, 200), pt(r * 1.08, 232), pt(r, 262)];
  return HL(`M${n(a[0])} ${n(a[1])}Q${n(b[0])} ${n(b[1])} ${n(c[0])} ${n(c[1])}`, WHITE, 2.4);
};

// A sprig of lavender along the medal's edge, rising from behind the ribbon
// on the left (side -1) or right (1): buds set alternately along a
// grey-green stem, shrinking to the tip.
function lavender(side) {
  const R = 43.5, a0 = 236, a1 = 100, k = 17;
  const at = (a) => {
    const x = C[0] + Math.cos((a * Math.PI) / 180) * R, y = C[1] - Math.sin((a * Math.PI) / 180) * R;
    return side > 0 ? [100 - x, y] : [x, y];
  };
  const heading = (a) => { const [x, y] = at(a), [x2, y2] = at(a - 1); return (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI; };
  const [sx, sy] = at(a0), [ex, ey] = at(a1);
  const out = [LN(`M${n(sx)} ${n(sy)}A${R} ${R} 0 0 ${side > 0 ? 0 : 1} ${n(ex)} ${n(ey)}`, "#7fa27a", 1.2, { ol: 1 })];
  for (let i = 0; i < k; i++) {
    const t = i / (k - 1), a = a0 + (a1 - a0) * (0.12 + 0.88 * t);
    const [x, y] = at(a), turn = heading(a) + (i % 2 ? 34 : -34), r = (turn * Math.PI) / 180, s = 3.4 - 1.5 * t;
    const f = i % 4 < 2 ? "#b48cf2" : "#9a6ee6";
    out.push(B(ell(0, 0, s, s * 0.6), f, { sh: mix(f, "#3a1a6a", 0.3), tf: `translate(${n(x + Math.cos(r) * s * 0.8)} ${n(y + Math.sin(r) * s * 0.8)}) rotate(${n(turn)})` }));
  }
  out.push(B(ell(0, 0, 1.8, 1.1), "#b48cf2", { sh: "#8a5ad6", tf: `translate(${n(ex)} ${n(ey)}) rotate(${n(heading(a1))})` }));
  return out;
}

// A ring of `k` sunflower petals about the medal's centre, their middles
// at radius r, each 2·len long and 2·w wide, turned by `from` degrees.
const sunPetals = (r, len, w, k, from, f) => Array.from({ length: k }, (_, i) => {
  const a = from + (i * 360) / k, [x, y] = pt(r, a);
  return B(`M${-len} 0C${n(-len / 2)} ${-w} ${n(len / 2)} ${-w} ${len} 0C${n(len / 2)} ${w} ${n(-len / 2)} ${w} ${-len} 0Z`, f, { sh: mix(f, "#8a3a00", 0.3), tf: `translate(${n(x)} ${n(y)}) rotate(${n(a)})` });
});

// A forget-me-not: five sky-blue petals round a white eye and a yellow heart.
const forgetMeNot = (x, y, r) => [
  B(Array.from({ length: 5 }, (_, i) => circ(...pt(r * 0.9, i * 72 - 90, [x, y]), r * 0.64)).join("") + circ(x, y, r * 0.6), "#9cc6f7", { sh: "#6a9ee0" }),
  D(circ(x, y, r * 0.5), WHITE),
  D(circ(x, y, r * 0.28), "#ffcf3f"),
];

// ---------------------------------------------------------------- banner
// A ribbon across the bottom, its ends folded behind, stars on its face.
const BANNER = "M22.5 72.5Q50 81 77.5 72.5L80 84.5Q50 93 20 84.5Z";
const BANNER_END = "M25 75.5L11 74L16 80.3L10.5 87L22.8 86.2Z";
const FOLD = "M22.8 86.2L25 75.5L22.3 76.3Z";
function banner(stars, f, sh, end, endSh, starF = "#ffe066") {
  const xs = Array.from({ length: stars }, (_, i) => 50 + (i - (stars - 1) / 2) * 7.4);
  return {
    ends: [B(BANNER_END, end, { sh: endSh }), B(mx(BANNER_END), end, { sh: endSh }), D(FOLD + mx(FOLD), endSh)],
    band: [B(BANNER, f, { sh }), LN("M24 75.8Q50 84 76 75.8M22 82Q50 90.2 78 82", mix(f, WHITE, 0.35), 0.9, { fine: 1 })],
    stars: xs.map((x) => B(star(x, 82.6 - ((x - 50) / 28) ** 2 * 4.7, 3.1), starF, { sh: mix(starF, "#e09a20", 0.4) })),
  };
}

// ---------------------------------------------------------------- frames
// Each tier: { back, rim, disc, banner, crest? }, each a list of shapes.
const FRAME = {
  common: () => ({
    back: [
      ...garland(C[0], C[1], 42.5, 42.5, 212, 128, 5, 5.6, ["#44ad63", "#2f8f4e"]),
      ...garland(C[0], C[1], 42.5, 42.5, -32, 52, 5, 5.6, ["#2f8f4e", "#44ad63"]),
      ...leaf(50, 3.5, 4.6, -90, "#44ad63", B),
    ],
    rim: [
      B(circ(...C, 38.5), "#5cc07a", { sh: "#3a9a5a" }),
      D(circ(...C, 34.5), "#3a9a5a"),
      LN(ticks(35.5, 37.5, 15, 7.5), "#8fd6a2", 1.1, { fine: 1 }),
      gloss(36.5),
    ],
    disc: [
      B(circ(...C, 31), "#f2fbec", { sh: "#d6eecb" }),
      D("M18 55C28 50 38 53 50 55C62 57 72 51 82 54V80H18Z", "#dff2d2"),
      D("M18 61C32 57 60 61 82 58V80H18Z", "#cdeabd"),
    ],
    banner: banner(1, "#3fae62", "#2a8a4a", "#2f8f4e", "#1f6e3a"),
  }),
  // A coin in a wreath of leaves starred with forget-me-nots.
  rare: () => ({
    // The flowers are their own layer, so the leaves' veins do not cross them.
    bloom: [
      ...[196, 152, 118].flatMap((a) => {
        const [x, y] = pt(43, -a);
        return [...forgetMeNot(x, y, 3.6), ...forgetMeNot(100 - x, y, 3.6)];
      }),
      ...forgetMeNot(50, 3.8, 3.4),
    ],
    back: [
      ...garland(C[0], C[1], 42.5, 42.5, 214, 112, 6, 4.8, ["#44ad63", "#3a9a5a"]),
      ...garland(C[0], C[1], 42.5, 42.5, -34, 68, 6, 4.8, ["#3a9a5a", "#44ad63"]),
    ],
    rim: [
      B(circ(...C, 38.5), "#4f8fe6", { sh: "#3470c4" }),
      D(circ(...C, 34.5), "#3a74c8"),
      LN(ticks(35.5, 37.5, 15, 7.5), "#8fbdf7", 1.1, { fine: 1 }),
      gloss(36.5),
    ],
    disc: [
      B(circ(...C, 31), "#eef5ff", { sh: "#d2e3fa" }),
      D("M24 34C24 30.5 27 29 29.5 30C30.5 26.5 35.5 26 37 29.5C40 29 42 31 41.5 34Z", WHITE),
      D("M18 60C32 56 60 60 82 57V80H18Z", "#dbe9fb"),
    ],
    banner: banner(2, "#4a88e0", "#2f64b8", "#2f64b8", "#224c8e"),
  }),
  // A coin in a wreath of lavender: two sprigs of buds rising from behind
  // the ribbon to meet at the top.
  epic: () => ({
    back: [...lavender(-1), ...lavender(1)],
    rim: [
      B(circ(...C, 38.5), "#a47cf0", { sh: "#7a52cc" }),
      D(circ(...C, 34.5), "#8a60dc"),
      dots(Array.from({ length: 24 }, (_, i) => pt(36.5, i * 15 + 7.5)), 0.7, "#cdb4fa"),
      gloss(36.5),
    ],
    disc: [
      B(circ(...C, 31), "#f6f0ff", { sh: "#e2d6fa" }),
      D("M18 55C28 50 38 53 50 55C62 57 72 51 82 54V80H18Z", "#ece2fd"),
      D("M18 61C32 57 60 61 82 58V80H18Z", "#e2d3fb"),
    ],
    banner: banner(3, "#8a5ae6", "#6a3cc4", "#6a3cc4", "#512e9c"),
  }),
  // A gold coin as the heart of a sunflower: two rings of petals and an
  // amber ribbon.
  legendary: () => ({
    back: [
      ...sunPetals(44.5, 8, 4, 18, 0, "#f0a41c"),
      ...sunPetals(42, 7.2, 3.6, 18, 10, "#ffd23f"),
    ],
    rim: [
      B(circ(...C, 38.5), "#f7c843", { sh: "#d6971a" }),
      D(circ(...C, 34.5), "#e8ad2a"),
      LN(circ(...C, 36.5), "#ffe39a", 0.8, { fine: 1 }),
      gloss(36.5),
    ],
    disc: [
      B(circ(...C, 31), "#fff7de", { sh: "#f3e0a8" }),
      D("M18 55C28 50 38 53 50 55C62 57 72 51 82 54V80H18Z", "#fdedc0"),
      D("M18 61C32 57 60 61 82 58V80H18Z", "#fbe4a8"),
    ],
    banner: banner(4, "#d27a1a", "#a85a10", "#a85a10", "#80420a", "#fff6cc"),
  }),
};
// Emblems are drawn around (50, 50) and set into the disc a touch smaller.
const EMBLEM_AT = "translate(50 45) scale(.92) translate(-50 -50)";

// --------------------------------------------------------------- emblems
// Each returns layers ({ shapes, cel }), drawn in order over the disc.
const L = (shapes, cel = 1) => ({ shapes, cel });
const mound = (f = "#6fbf5a") => B("M28 70C35 61.5 65 61.5 72 70C63 73 37 73 28 70Z", f, { sh: mix(f, "#1a2a08", 0.28) });
const tuft = (x, y, f = "#3a9a5a") => B(`M${x - 3} ${y}C${x - 3} ${y - 3} ${x - 2} ${y - 5} ${x - 1.2} ${y - 6.5}C${x - 0.5} ${y - 4.5} ${x} ${y - 3.5} ${x + 0.4} ${y - 2.5}C${x + 1} ${y - 5} ${x + 2} ${y - 6.5} ${x + 3.2} ${y - 7}C${x + 3} ${y - 4} ${x + 3} ${y - 2} ${x + 3} ${y}Z`, f, { sh: mix(f, "#0a2a10", 0.3) });
const petals = (cx, cy, count, len, f, kind = B, rot = 0) => Array.from({ length: count }, (_, i) => {
  const a = rot + (i * 360) / count, r = (a * Math.PI) / 180;
  return leaf(cx + Math.cos(r) * len, cy + Math.sin(r) * len, len, a, f, kind);
}).flat();
const stalk = (x0, y0, x1, y1, w = 1.4, f = "#3a9a5a") => {
  const len = Math.hypot(x1 - x0, y1 - y0), px = (-(y1 - y0) / len) * w / 2, py = ((x1 - x0) / len) * w / 2;
  return B(poly([[x0 + px, y0 + py], [x1 + px, y1 + py], [x1 - px, y1 - py], [x0 - px, y0 - py]]), f, { sh: mix(f, "#0a2010", 0.28) });
};
const bee = (x, y) => [
  B(ell(x - 1.6, y - 2.6, 2.2, 1.5) + ell(x + 1.2, y - 2.8, 2.2, 1.5), "#eaf6ff", { sh: "#c8def0" }),
  B(ell(x, y, 3.4, 2.4), "#ffd23f", { sh: "#e0a52a" }),
  D(`M${x - 1.2} ${y - 2.4}V${y + 2.4}H${x - 0.2}V${y - 2.4}Z` + `M${x + 1} ${y - 2.3}V${y + 2.3}H${x + 2}V${y - 2.3}Z`, INKY),
];
const ladybird = (x, y, rot = 0) => {
  const tf = `rotate(${rot} ${x} ${y})`;
  return [
    B(ell(x, y, 3, 2.4), "#e0402a", { sh: "#b02a1a", tf }),
    D(circ(x + 2.8, y, 1.4), INKY, { tf }),
    D(circ(x - 0.8, y - 1, 0.6) + circ(x - 0.6, y + 1, 0.6) + circ(x + 0.9, y - 0.4, 0.5), INKY, { tf }),
  ];
};
const canopy = (parts, dark, light) => parts.map(([x, y, rx, ry], i) => {
  const f = i < 2 ? dark : light;
  return B(ell(x, y, rx, ry), f, { sh: mix(f, "#0a2010", 0.25) });
});
const cloud = (x, y, s = 1) => `M${n(x)} ${n(y)}C${n(x)} ${n(y - 3 * s)} ${n(x + 2.5 * s)} ${n(y - 4 * s)} ${n(x + 4.5 * s)} ${n(y - 3.4 * s)}C${n(x + 5.5 * s)} ${n(y - 6.5 * s)} ${n(x + 10 * s)} ${n(y - 7 * s)} ${n(x + 11.5 * s)} ${n(y - 4 * s)}C${n(x + 14 * s)} ${n(y - 4.4 * s)} ${n(x + 15.5 * s)} ${n(y - 2.5 * s)} ${n(x + 15 * s)} ${n(y)}Z`;

const EMBLEM = {
  // --- observations: the kit of field work, first boot to plant press ---
  // A walking boot, laced and muddy at the sole: the first steps out.
  obs_1: () => [L([
    tuft(27, 70, "#44ad63"), tuft(73, 70, "#3a9a5a"),
    B("M35 34H48.5V53C55 53.5 62 55 66 58C69 60 69.5 64 67.5 66H34.5C33.5 66 33 65.3 33 64.3V37C33 35.3 33.8 34 35 34Z", "#b07a44", { sh: "#8a5a2e" }),
    D("M34 34H49V39H34Z", "#d8513a", { sh: "#b03a28", cel: 1 }),
    D("M60 56.5C64 58 67 60.5 67.5 64.5H59.5Z", "#8a5a2e"),
    D("M33 58H59.5V61.5H33Z", "#c98e52"),
    LN("M37.5 43.5H45.5M37.5 47.5H45.5M37.5 51.5H45.5", "#fff4dc", 1.5),
    dots([[37, 43.5], [46, 43.5], [37, 47.5], [46, 47.5], [37, 51.5], [46, 51.5]], 0.8, "#f5c142"),
    LN("M34.5 40.5V64M50 55.8Q58 56.6 64 60", "#6b4526", 0.8, { fine: 1 }),
    HL("M36.5 38V54", "#fff4dc", 1.6),
    B("M33 65H68.5C69.5 65 70 65.8 69.7 66.7L69 69.2C68.7 70 68.1 70.3 67.4 70.3H33.8C33 70.3 32.5 69.8 32.5 69V65.8C32.5 65.3 32.7 65 33 65Z", "#4a3829", { sh: "#2e2219" }),
    D("M36 68.3H39V70.3H36ZM42 68.3H45V70.3H42ZM48 68.3H51V70.3H48ZM54 68.3H57V70.3H54ZM60 68.3H63V70.3H60Z", "#6b5646"),
    B(circ(70.5, 72.5, 1.3) + circ(26, 72.8, 1.1), "#a88a6a", { sh: "#86684a" }),
  ])],
  // A hand lens over a leaf, a ladybird on the midrib: looking closely.
  obs_100: () => [L([
    ...leaf(47, 58, 15, -28, "#5fbf6a", B),
    LN("M34.5 65L60 51M42 61L40 56.5M48 57.8L46.5 53M54 54.5L53 50M44 62L47.5 64.5M50 58.8L53.6 61", "#2f8f4e", 1, { fine: 1 }),
    ...ladybird(43.5, 61.3, -28),
    stalk(52.5, 51.5, 66.5, 67, 5.4, "#b07a44"),
    D(poly([[61.5, 60.6], [64.5, 64], [66.2, 62.4], [63.2, 59]]), "#8a5a2e"),
    B(circ(44.5, 41.5, 13), "#707f88", { sh: "#4c5860" }),
    B(circ(44.5, 41.5, 10), "#d4f1fa", { sh: "#a4d8ea" }),
    D("M35 48C40 43.5 47 41.5 55 42L55 52L35 52Z", "#86d680"),
    LN("M36 51.5L55 44.8", "#2f8f4e", 1.6, { fine: 1 }),
    HL("M37.5 37.5Q39.8 33.8 44.2 33", WHITE, 2),
    HL("M49.5 47.5Q51.5 45.5 52 43", WHITE, 1.2),
  ])],
  // A clipboard with a field sheet, ticked row by row: recording data.
  obs_500: () => [L([
    B("M35 32H65C66.1 32 67 32.9 67 34V70C67 71.1 66.1 72 65 72H35C33.9 72 33 71.1 33 70V34C33 32.9 33.9 32 35 32Z", "#c08a50", { sh: "#9a6a36" }),
    LN("M34.5 42Q36 50 34.5 58M65.5 38Q64 46 65.5 56", "#a0723e", 0.8, { fine: 1 }),
    D("M37 37H63V68.5H37Z", WHITE, { sh: "#e4e8ea", cel: 1 }),
    LN("M40.5 44L42.5 46L46 42M40.5 51L42.5 53L46 49M40.5 58L42.5 60L46 56", "#2f9a55", 1.5),
    LN("M49 44H59M49 51H58M49 58H55.5M40.5 64.5H52", "#9aa5ab", 1.2, { fine: 1 }),
    ...leaf(58.5, 62.5, 3, -40, "#5fbf6a"),
    B("M42.5 29H57.5C58.3 29 59 29.7 59 30.5V35.5H41V30.5C41 29.7 41.7 29 42.5 29Z", "#aab3b8", { sh: "#7c878d" }),
    D(circ(50, 31.2, 1.3), "#6b767c"),
    stalk(59.5, 66, 71, 49.5, 3.6, "#f5c142"),
    D(poly([[69.6, 48.5], [72.4, 50.4], [73.4, 48.9], [70.6, 47]]), "#ff8fa0"),
    B("M57.7 67.4L58.6 70.2L61.1 68.6Z", "#4a3829"),
    HL("M36 34.5H48", "#f0c890", 1.4),
  ])],
  // A botanist's plant press, strapped tight, a fern and a flower escaping.
  obs_1000: () => [
    L([
      stalk(58, 40, 66.5, 23, 1.6, "#2f8f4e"),
      ...leaf(60.2, 33, 3.8, -25, "#44ad63", B), ...leaf(64.8, 35, 3.6, 35, "#44ad63", B),
      ...leaf(62.4, 27.5, 3.4, -30, "#5fbf6a", B), ...leaf(67, 29.5, 3.2, 25, "#5fbf6a", B),
      stalk(37, 40, 34.5, 30.5, 1.4, "#2f8f4e"),
      ...flower(34.5, 28.5, 3.6, "#ff8fb1", B),
      ...leaf(40, 34, 3, 30, "#44ad63", B),
    ]),
    L([
      B("M29 38H71V70H29Z", "#c9975a", { sh: "#a0723e" }),
      D("M29 38H71V41.5H29Z", "#b8844a"),
      LN("M29 46H71M29 54H71M29 62H71M37 38V70M46 38V70M54 38V70M63 38V70", "#a0723e", 1.2),
      LN("M31 49Q34 48 36 50M47 57Q50 56 52.5 58M56 43Q59 42 61.5 44M31 66Q34 65 36 67M64 58Q67 57 69.5 59", "#a8804a", 0.8, { fine: 1 }),
      D("M37.5 36V72H42.5V36Z" + "M57.5 36V72H62.5V36Z", "#6b4526", { sh: "#4e321a", cel: 1 }),
      D("M36.3 51.3H43.7V57.7H36.3Z" + "M56.3 51.3H63.7V57.7H56.3Z", "#f5c142", { sh: "#d6971a", cel: 1 }),
      D("M38.6 53.6H41.4V55.4H38.6Z" + "M58.6 53.6H61.4V55.4H58.6Z", "#6b4526"),
      HL("M31 40.5H69", "#e8c08a", 1.2),
    ]),
  ],

  // --- missions: out into the field ---
  mission_1: () => [
    L([
      B("M28 59L40 55L52 59L64 55L72 58.5V73L64 69.5L52 73.5L40 69.5L28 73Z", "#f1e6bf", { sh: "#d6c796" }),
      D("M28 59L40 55V69.5L28 73Z" + "M52 59L64 55V69.5L52 73.5Z", "#e4d6a8"),
      D("M31 63C36 60 41 65 45 62L47 66.5C42 69.5 37 66.5 32 69.5Z", "#a8d690"),
      D("M55 61.5C59 59.5 63 62.5 68 60.5L68 65.5C63 67.5 59 65.5 55 67.5Z", "#9fd0e0"),
      LN("M33 70Q40 65 46 67.5Q52 70 58 66Q63 63 68 64.5", "#d8403a", 1.1, { fine: 1 }),
      D(nstar(66, 70, 2, 0.6, 4), "#3f6fae"),
    ]),
    L([
      S(ell(50, 62.5, 5, 1.6), "#c9b986"),
      B("M50 61C43.5 52 40.5 47.8 40.5 42C40.5 36.2 44.6 32 50 32C55.4 32 59.5 36.2 59.5 42C59.5 47.8 56.5 52 50 61Z", "#e8503a", { sh: "#b03a28" }),
      D(circ(50, 42, 3.8), WHITE),
      HL("M43.5 38.5Q44.8 35.3 48 34.3", WHITE, 1.8),
    ]),
  ],
  mission_10: () => [L([
    LN("M33 45Q24 58 34 70M67 45Q76 58 66 70", "#6b4526", 1.6),
    B(rect(35, 34, 10, 10) + rect(55, 34, 10, 10), "#5a6a62", { sh: "#435049" }),
    D(rect(35, 37, 10, 2) + rect(55, 37, 10, 2), "#3f4c46"),
    B("M33 43H47V65C47 68.5 45 70.5 40 70.5C35 70.5 33 68.5 33 65Z", "#4a5a52", { sh: "#35423c" }),
    B(mx("M33 43H47V65C47 68.5 45 70.5 40 70.5C35 70.5 33 68.5 33 65Z"), "#4a5a52", { sh: "#35423c" }),
    D(rect(33, 50, 14, 5) + rect(53, 50, 14, 5), "#6b7a73"),
    B(rect(45.5, 46, 9, 9), "#6b7a73", { sh: "#4c5853" }),
    D(circ(50, 50.5, 2), "#aab3b8"),
    D(circ(40, 64.5, 4.6) + circ(60, 64.5, 4.6), "#7fc4e8", { sh: "#4a9ac8", cel: 1 }),
    HL("M37.6 62.6Q38.6 60.8 40.4 60.6M57.6 62.6Q58.6 60.8 60.4 60.6", WHITE, 1.3),
    HL("M35 45V58", "#8a9a92", 1.2),
  ])],
  mission_100: () => [L([
    B(circ(50, 50, 26), "#c9975a", { sh: "#a0723e" }),
    B(circ(50, 50, 22.5), "#fbf3dc", { sh: "#e6d8b0" }),
    LN(Array.from({ length: 16 }, (_, i) => {
      const a = (i * 22.5 * Math.PI) / 180, r0 = i % 4 ? 20 : 18.5;
      return `M${n(50 + Math.cos(a) * r0)} ${n(50 + Math.sin(a) * r0)}L${n(50 + Math.cos(a) * 21.8)} ${n(50 + Math.sin(a) * 21.8)}`;
    }).join(""), "#9a8a60", 0.9, { fine: 1 }),
    D(nstar(50, 50, 13, 3.2, 4, -45), "#9fb8d8"),
    D(nstar(50, 50, 18.5, 4, 4), "#3f6fae", { sh: "#2c5490", cel: 1 }),
    D("M50 31.5L53 46H47Z", "#e0402a"),
    B(circ(50, 50, 2.6), "#f5c142", { sh: "#d6971a" }),
    B(circ(50, 24, 2.8), "#c9975a", { sh: "#a0723e" }),
    HL("M31.5 41Q34 32 43 28", WHITE, 1.8),
  ])],
  mission_500: () => [L([
    B(cloud(24, 38), WHITE, { sh: "#dce9f5" }),
    B("M22 72L41 40L48.5 50L58 36L78 72Z", "#8ea6c4", { sh: "#6a82a4" }),
    D("M58 36L78 72H66L60 58Z", "#7a92b2"),
    D("M41 40L45.8 46.6L43 45.8L41 48.5L39 45.6L36.8 46.8Z" + "M58 36L64 45.8L60.8 44.4L58.2 47.3L55.8 44.4L52.6 46Z", WHITE),
    B("M20 72C30 66 40 68 50 70C60 72 70 66 80 70V74H20Z", "#6fbf5a", { sh: "#4f9a44" }),
    LN("M33 72L38 67L36 64L41 60L44 56", "#fff4dc", 1, { fine: 1 }),
    B("M57.2 37V21H59V37Z", "#6b4a24", { sh: "#4a3315" }),
    B("M59 21.5C62.5 20 66.5 24 71.5 22.5V31C66.5 32.5 62.5 28.5 59 30Z", "#e8503a", { sh: "#b03a28" }),
    D(star(64.8, 26.2, 2.2), "#ffe066"),
  ])],

  // --- discoveries: flowers, then a collection ---
  disc_10: () => [L([
    tuft(40, 72, "#44ad63"), tuft(61, 72, "#3a9a5a"),
    stalk(50, 72, 50, 46, 2),
    ...leaf(43.5, 63, 5.5, -30, "#44ad63", B), ...leaf(56.5, 58.5, 5.5, 210, "#44ad63", B),
    ...petals(50, 39, 12, 7.2, WHITE, B),
    B(circ(50, 39, 5), "#ffc93a", { sh: "#e0a52a" }),
    dots([[48.5, 37.5], [51.5, 38], [49.5, 40.8], [52, 41]], 0.6, "#c98a10"),
    ...bee(66, 30),
    LN("M58 36Q60 33 62.5 32", "#9aa5ab", 0.8, { fine: 1 }),
  ])],
  disc_50: () => [
    L([
      B("M38 40H62V69C62 72.5 60 74.5 56.5 74.5H43.5C40 74.5 38 72.5 38 69Z", "#dcf0f5", { sh: "#b3d6de" }),
      stalk(46, 70, 45, 51, 1.4), stalk(54, 70, 55.5, 55.5, 1.4),
      ...leaf(49.5, 64, 3, -30, "#44ad63", B),
      ...flower(45, 49, 3.4, "#ff8fb1", B), ...flower(55.5, 54, 3, "#b48ae8", B),
      D(rect(42.5, 60.5, 15, 8), "#fff7e0"),
      LN("M45 63.5H55M45 66H52", "#9a8a60", 0.9, { fine: 1 }),
      HL("M40.8 44V67", WHITE, 1.8), HL("M59.2 60V67", WHITE, 1),
    ]),
    L([
      B("M36 34H64C64.8 34 65.5 34.7 65.5 35.5V39.5C65.5 40.3 64.8 41 64 41H36C35.2 41 34.5 40.3 34.5 39.5V35.5C34.5 34.7 35.2 34 36 34Z", WOOD, { sh: WOOD_SH }),
      LN("M37 37.5H63", "#b8844a", 0.9, { fine: 1 }),
      B("M40 30H60V34H40Z", "#c9975a", { sh: "#a0723e" }),
    ]),
  ],
  disc_100: () => [L([
    B("M38 58L50 76L62 58Z", "#f0cf90", { sh: "#cfa860" }),
    stalk(50, 64, 40, 41, 1.4), stalk(50, 64, 60, 41, 1.4), stalk(50, 64, 50, 34, 1.4),
    ...leaf(41, 51, 5, -60, "#44ad63", B), ...leaf(59, 51, 5, 240, "#44ad63", B),
    ...flower(40, 39.5, 5.2, "#ff8fb1"), ...flower(60, 39.5, 5.2, "#b48ae8"), ...flower(50, 31, 5.8, "#ffd84a"),
    D("M38 58L62 58L60.4 60.4L39.6 60.4Z", "#e2bb74"),
    LN("M44 63L48 69M56 63L52 69", "#cfa860", 0.9, { fine: 1 }),
    B("M50 62L42.5 58L42.5 66Z" + "M50 62L57.5 58L57.5 66Z", "#e0503a", { sh: "#b03a28" }),
    B(circ(50, 62, 2.1), "#c0392b", { sh: "#90281f" }),
  ])],
  disc_500: () => [L([
    B("M24 41C33 38 44 39 50 43C56 39 67 38 76 41V71C67 68 56 69 50 72C44 69 33 68 24 71Z", "#7a4a2a", { sh: "#553018" }),
    B("M26.5 39.5C34 36.5 44 37.5 50 41.5V69C44 65.5 34 65 26.5 67.5Z", "#fffaf0", { sh: "#ece0c4" }),
    B(mx("M26.5 39.5C34 36.5 44 37.5 50 41.5V69C44 65.5 34 65 26.5 67.5Z"), "#fffaf0", { sh: "#ece0c4" }),
    ...leaf(38, 52, 8.5, -60, "#5fbf6a"),
    LN("M33.5 60Q38 54.5 42.5 45.5", "#3a8a4a", 1),
    D(rect(33.5, 58.5, 4, 1.4) + rect(40, 43, 4, 1.4), "#f7ebc8"),
    ...flower(62, 48, 3.8, "#ff8fb1", D),
    LN("M62 52V57", "#3a8a4a", 1, { fine: 1 }),
    LN("M55.5 59.5H68.5M55.5 62.5H66.5M55.5 65.5H67.5", "#9a8a60", 0.9, { fine: 1 }),
    B("M46.5 39.5H49.5V50L48 48.3L46.5 50Z", "#e0503a", { sh: "#b03a28" }),
  ])],

  // --- daily quests ---
  // A relevé: a surveyor's quadrat laid on the grass, a plant in each square.
  releve_1: () => [
    L([
      B(rect(33, 34, 34, 34), "#a8dc8c", { sh: "#84c06a" }),
      ...flower(41.5, 42.5, 2.8, WHITE, B), ...flower(58.5, 59.5, 2.8, "#ff8fb1", B),
      ...leaf(58.5, 42.5, 3.8, -40, "#2f8f4e", B), ...leaf(41.5, 59.5, 3.8, 30, "#2f8f4e", B),
      ...flower(50, 51, 2.4, "#ffd84a", B),
      dots([[36.5, 50], [64, 48], [46, 64.5], [55, 37]], 0.7, "#6fae54"),
    ]),
    L([
      B("M30 31H70V71H30ZM33.5 34.5V67.5H66.5V34.5Z", "#d4a766", { sh: "#a8783e" }),
      LN("M50 34.5V67.5M33.5 51H66.5", "#fff4dc", 1),
      LN("M30 36H33.5M30 41H33.5M30 46H33.5M30 56H33.5M30 61H33.5M30 66H33.5", "#8a5a2e", 0.8, { fine: 1 }),
    ]),
    L([B(circ(30.5, 31.5, 1.8), "#e0503a", { sh: "#b03a28" }), B(circ(69.5, 70.5, 1.8), "#e0503a", { sh: "#b03a28" })]),
  ],
  perfect_day: () => [L([
    B(cloud(58, 34), WHITE, { sh: "#dce9f5" }),
    LN(Array.from({ length: 7 }, (_, i) => {
      const a = ((200 + i * 23.3) * Math.PI) / 180;
      return `M${n(50 + Math.cos(a) * 16)} ${n(56 + Math.sin(a) * 16)}L${n(50 + Math.cos(a) * 22)} ${n(56 + Math.sin(a) * 22)}`;
    }).join(""), "#f0a820", 1.6, { ol: 1 }),
    B(circ(50, 56, 13), "#ffd23f", { sh: "#f0a820" }),
    HL("M41 51Q43 46 48 44.5", WHITE, 1.8),
    B("M22 64C32 56.5 42.5 57.5 51 63C59 57.5 69 55.5 78 63V74H22Z", "#7cc46e", { sh: "#5ea052" }),
    B("M22 68.5C35 63.5 60 65.5 78 66.5V76H22Z", "#4fb56a", { sh: "#3a9a5a" }),
    LN("M30 40Q32 38 34 40Q36 38 38 40M38.5 34Q40 32.5 41.5 34Q43 32.5 44.5 34", "#5a6a78", 1, { ol: 1 }),
  ])],

  // --- rare finds ---
  // An orchid: three sepals, two petals and the lip, on an arching stem.
  epic_obs: () => [L([
    stalk(50, 72, 50, 52, 2),
    ...leaf(41.5, 68.5, 8.5, -18, "#44ad63", B), ...leaf(58.5, 68.5, 8.5, 198, "#3a9a5a", B),
    ...leaf(50, 32.5, 8.5, -90, "#d2b0f7", B),
    ...leaf(42.5, 51, 8, 125, "#d2b0f7", B), ...leaf(57.5, 51, 8, 55, "#d2b0f7", B),
    ...leaf(41, 40, 8.5, 195, "#b07ae8", B), ...leaf(59, 40, 8.5, -15, "#b07ae8", B),
    B("M43.5 43C42.5 51.5 46.5 57.5 50 57.5C53.5 57.5 57.5 51.5 56.5 43C53 46 47 46 43.5 43Z", "#8a4fc8", { sh: "#6a36a0" }),
    D(circ(47.5, 50.5, 0.9) + circ(52.5, 50.5, 0.9) + circ(50, 53.5, 0.9) + circ(48.5, 47.5, 0.7) + circ(51.5, 47.5, 0.7), "#f4e0ff"),
    B(ell(50, 42, 2.6, 3.2), "#ffd23f", { sh: "#e0a52a" }),
    HL("M47.5 28Q48.5 25.5 50 25", WHITE, 1.2),
    sparkle(67, 30, 3.6), sparkle(33, 60, 2.6),
  ])],
  legendary_obs: () => [L([
    B("M28 72C30 64 36 62 40 64C43 59 50 58 54 62C58 59 66 60 68 66C71 66 73 69 72 72Z", "#b8c0c8", { sh: "#8e98a2" }),
    ...leaf(41, 63, 6.5, 150, "#9ab88a", B), ...leaf(59, 63, 6.5, 30, "#9ab88a", B),
    ...petals(50, 45, 9, 9.5, "#fbf8f0", B, -90),
    LN(Array.from({ length: 9 }, (_, i) => {
      const a = ((-90 + i * 40) * Math.PI) / 180;
      return `M${n(50 + Math.cos(a) * 8)} ${n(45 + Math.sin(a) * 8)}L${n(50 + Math.cos(a) * 14)} ${n(45 + Math.sin(a) * 14)}`;
    }).join(""), "#d0ccc0", 0.8, { fine: 1 }),
    B(circ(50, 45, 5.8), "#f3e6a8", { sh: "#d8c270" }),
    dots([[47.8, 43.5], [52.2, 43.5], [50, 47.2], [46.5, 46.8], [53.5, 46.8], [50, 42.5]], 1.4, "#e8c040"),
    sparkle(70, 28, 5), sparkle(29, 58, 3.4), sparkle(33, 29, 2.6),
  ])],

  // --- challenges ---
  chal_1: () => [L([
    B("M24 72C33 61 67 61 76 72Z", "#6fbf5a", { sh: "#4f9a44" }),
    tuft(33, 70, "#3a9a5a"), tuft(66, 69, "#44ad63"),
    B("M43.2 67V28H46V67Z", "#8a5a30", { sh: "#6b4526" }),
    B(circ(44.6, 27, 2), "#f5c142", { sh: "#d6971a" }),
    B("M46 30C52 27 58 33 67 30V46C58 49 52 43 46 46Z", WHITE, { sh: "#d6dbe0" }),
    D([[46, 29.5], [54.2, 29.5], [50.1, 33.5], [58.3, 33.5], [46, 37.5], [54.2, 37.5], [50.1, 41.5], [58.3, 41.5], [62.4, 29.5], [62.4, 37.5], [62.4, 45.5], [54.2, 45.5], [46, 45.5]]
      .map(([x, y]) => rect(x, y, 4.1, 4)).join(""), INKY),
    LN("M69.5 34H74M70 39H75.5M69.5 44H73", "#9aa5ab", 1, { fine: 1 }),
  ])],
  chal_win_1: () => [L([
    D(rect(33, 30, 2, 3.2) + rect(64, 33, 2.4, 2) + rect(38, 44, 2.2, 1.8) + rect(62, 46, 1.8, 3), "#e0503a"),
    D(rect(29, 38, 2.4, 2) + rect(68, 40, 2, 3) + rect(56, 29, 1.8, 2.6), "#4a88e0"),
    D(rect(44, 30, 2.2, 1.8) + rect(34, 50, 1.8, 2.8), "#3fae62"),
    B(rect(27.5, 57, 14, 15), "#c4d0dc", { sh: "#9aabbc" }),
    B(rect(58.5, 61, 14, 11), "#d8a070", { sh: "#b07a4c" }),
    B(rect(41.5, 48, 17, 24), "#f7c843", { sh: "#d6971a" }),
    LN("M47.8 56.5L50.6 54.3V66", "#8a5a10", 1.4),
    LN("M33 63.5H36M64 66H67", "#7a8a98", 1.2),
    HL("M43.5 50V69", "#fff0b0", 1.4),
    B(star(50, 37, 8), "#ffd23f", { sh: "#e0a52a" }),
    HL("M47 35Q48 33 50 32", WHITE, 1.2),
  ])],
  chal_10: () => [L([
    B("M39 31H61C61 41 53 46 52 50C53 54 61 59 61 69H39C39 59 47 54 48 50C47 46 39 41 39 31Z", "#dcf0f5", { sh: "#b3d6de" }),
    D("M42.5 37H57.5C56.5 41.5 53 44.5 50 47.5C47 44.5 43.5 41.5 42.5 37Z", "#f0c860"),
    D("M41.5 69C43 63.5 46.5 61 50 60C53.5 61 57 63.5 58.5 69Z", "#f0c860"),
    LN("M50 48.5V60", "#d8a840", 0.9),
    HL("M41.5 33.5Q42 39 45.5 43M41.5 66.5Q42.5 61 45.5 57.5", WHITE, 1.4),
    B(rect(34, 28, 3.2, 44) + rect(62.8, 28, 3.2, 44), WOOD, { sh: WOOD_SH }),
    B("M31.5 24.5H68.5C69.3 24.5 70 25.2 70 26V29.5H30V26C30 25.2 30.7 24.5 31.5 24.5Z", "#c9975a", { sh: "#a0723e" }),
    B("M30 70.5H70V74C70 74.8 69.3 75.5 68.5 75.5H31.5C30.7 75.5 30 74.8 30 74Z", "#c9975a", { sh: "#a0723e" }),
    D(circ(35.6, 27, 0.9) + circ(64.4, 27, 0.9) + circ(35.6, 73, 0.9) + circ(64.4, 73, 0.9), "#f5c142"),
  ])],
  chal_win_10: () => [L([
    B("M36 35C27.5 35 27.5 48 38.5 49L38.5 45.5C32 44.5 31.5 38.5 36 38.5Z" + mx("M36 35C27.5 35 27.5 48 38.5 49L38.5 45.5C32 44.5 31.5 38.5 36 38.5Z"), "#e8ad2a", { sh: "#c28a18" }),
    B("M35.5 31H64.5V40C64.5 50.5 58 57 50 57C42 57 35.5 50.5 35.5 40Z", "#f7c843", { sh: "#d6971a" }),
    D("M35.5 31H64.5V34.5H35.5Z", "#e8ad2a"),
    B(rect(47, 56.5, 6, 6.5), "#e8ad2a", { sh: "#c28a18" }),
    B("M43 62.5H57L58 65H42Z", "#e8ad2a", { sh: "#c28a18" }),
    B("M39.5 65H60.5L62 72H38Z", WOOD, { sh: WOOD_SH }),
    D(rect(45, 67, 10, 3), "#f5c142"),
    ...leaf(43.5, 45, 3.6, -50, "#5fbf6a"), ...leaf(56.5, 45, 3.6, 230, "#5fbf6a"),
    D(star(50, 43, 4.8), "#fff1b0"),
    HL("M39.5 36.5V45", WHITE, 1.8),
    sparkle(69.5, 30, 3.6), sparkle(29, 55, 2.6),
  ])],

  // --- levels: an oak growing up, from its seed to an old tree ---
  level_5: () => [L([
    mound("#b07a4a"),
    dots([[33, 68], [66, 67.5]], 1.1, "#8a5a30"),
    B(ell(50, 55, 8.8, 10.5), "#c98a45", { sh: "#a06a30" }),
    LN("M50 45V64", "#a06a30", 0.9, { fine: 1 }),
    B("M40 48.5C40 41.5 44.5 38 50 38C55.5 38 60 41.5 60 48.5C56 47 44 47 40 48.5Z", "#8a5a30", { sh: "#6b4526" }),
    LN("M42.5 44L45.5 45.5M47 41.5L49.5 43.5M52.5 41.5L50 43.5M57.5 44L54.5 45.5M44.5 47L47 45M55.5 47L53 45", "#6b4526", 1, { fine: 1 }),
    B("M49 38C49 35.5 49.5 33.5 51 32L52.6 33.1C51.4 34.5 51 36.1 51 38Z", "#6b4526"),
    ...leaf(56.5, 32.5, 4, -25, "#44ad63", B),
    HL("M44.5 54Q45 49.5 47.5 48", "#fff4dc", 1.8),
  ])],
  level_10: () => [L([
    mound("#b07a4a"),
    dots([[34, 68], [64.5, 67]], 1.1, "#8a5a30"),
    stalk(50, 65, 50, 46, 2.2, "#3a9a5a"),
    ...leaf(42.5, 44, 7.5, -25, "#5fbf6a", B),
    ...leaf(58, 42.5, 8, 20, "#5fbf6a", B),
    ...leaf(50, 39, 3.2, -80, "#86d680", B),
    HL("M37.5 44.5Q41 41.5 45 41.5M54 40Q58 38.5 62 40", "#dff7d0", 1.2),
    B("M62.5 45.5C62.5 44 63.2 42.8 64 42C64.8 42.8 65.5 44 65.5 45.5C65.5 46.4 64.8 47 64 47C63.2 47 62.5 46.4 62.5 45.5Z", "#bfe8ff", { sh: "#8ecbee" }),
  ])],
  level_20: () => [L([
    B(ell(50, 71, 20, 3.4), "#6fbf5a", { sh: "#4f9a44" }),
    tuft(35, 71, "#3a9a5a"),
    B("M45.5 72C47 64 47 58 44.5 51L55.5 51C53 58 53 64 54.5 72Z", WOOD, { sh: WOOD_SH }),
    LN("M48.5 70Q49 63 47.5 57M52 69Q51.5 63 53 58", WOOD_SH, 0.9, { fine: 1 }),
    ...canopy([[38.5, 44, 10, 10], [61.5, 44, 10, 10], [50, 33.5, 12.5, 12], [50, 46.5, 10.5, 10]], "#2f8f4e", "#44ad63"),
    HL("M40.5 30Q43.5 25 50 23.5M30.5 42Q32 37.5 35.5 36", "#a8e6a0", 1.6),
    dots([[44, 40], [56, 38], [51, 49], [41, 49], [60, 48]], 0.9, "#86d680"),
  ])],
  // The Master's old oak: a gnarled trunk, roots, a crown as wide as the badge.
  level_50: () => [L([
    B(ell(50, 71, 22, 3.6), "#6fbf5a", { sh: "#4f9a44" }),
    B("M40 73C44 70 45.5 64 44.5 56L38 50L45 51.5L48 44L50 51L55 45L55.5 52L62 50L55.5 56C54.5 64 56 70 60 73L63 74L56 72.8H44L37 74Z", "#8a5a30", { sh: "#6b4526" }),
    LN("M47 60Q50 62 53 60M46 66Q50 64 54 67M48.5 55Q50 57 51.5 55", "#6b4526", 1, { fine: 1 }),
    D(ell(50, 62.5, 1.6, 2.2), "#4a2e18"),
    ...canopy([[33, 44, 10.5, 7.5], [67, 44, 10.5, 7.5], [50, 31, 18, 9.5], [41, 40, 10.5, 7.5], [59, 40, 10.5, 7.5]], "#1f6e3a", "#3a9a5a"),
    HL("M36 28Q41 23 50 21.5M24.5 42Q26 38 29.5 37", "#a8e6a0", 1.6),
    dots([[44, 30], [56, 35], [36, 43], [63, 41], [50, 39]], 1.4, "#f7c843"),
    sparkle(73, 26, 3), sparkle(27, 30, 2.4),
  ])],
};

// ------------------------------------------------------------- rendering
let seq = 0;
function render(id, { className = "badge-art", small = false, size = 240 } = {}) {
  const def = BADGE_DEFINITIONS.find((b) => b.id === id);
  const tier = FRAME[def?.tier] ? def.tier : "common";
  const f = FRAME[tier]();
  const layers = [
    { shapes: f.back, cel: 1 },
    ...(f.bloom ? [{ shapes: f.bloom, cel: 1 }] : []),
    { shapes: f.banner.ends, cel: 1 },
    { shapes: f.rim, cel: 1 },
    ...(f.crest ? [{ shapes: f.crest, cel: 1 }] : []),
    { shapes: f.disc, cel: 1 },
    ...(EMBLEM[id]?.() ?? []).map((layer) => ({ ...layer, sp: "emblem" })),
    { shapes: f.banner.band, cel: 1 },
    { shapes: f.banner.stars, cel: 1 },
  ];
  const { defs, body, filter } = stickerLayers(layers, { id: `bd${++seq}-`, small, spaces: { emblem: EMBLEM_AT }, shift: [-1.6, -1.9] });
  // `width`/`height` give the drawing an intrinsic size well above any size
  // it is shown at. Without them an SVG image defaults to 150px, and Chrome
  // can rasterise it at that size and scale it up: soft on a 2–3× screen,
  // sharp only while a hover transform forces a fresh raster.
  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-5 -5 110 110" aria-hidden="true" focusable="false"><defs>${defs}</defs><g filter="${filter}">${body}</g></svg>`;
}

/** A badge's medallion as inline SVG markup. `small` for 40px and under. */
export function badgeSvg(id, opts) {
  return render(id, opts);
}

// A page shows a badge many times over (the badges page, the result card,
// a leaderboard chip), so each drawing is made once and shown as an image.
const urls = new Map();
/** A badge's medallion as an `<img>` markup string. */
export function badgeImg(id, { className = "badge-art", small = false } = {}) {
  const key = `${id}.${small ? "s" : "l"}`;
  let url = urls.get(key);
  if (!url) {
    url = URL.createObjectURL(new Blob([render(id, { className: "", small, size: small ? 128 : 256 })], { type: "image/svg+xml" }));
    urls.set(key, url);
  }
  return `<img class="${className}" src="${url}" alt="" draggable="false">`;
}
