// src/ui/components/Avatar.view.js
import { SKIN_TONES, HAIR_COLORS, EYE_COLORS, normalizeAvatar } from "../../data/avatar.js";

/**
 * The avatar, drawn as one inline SVG on a 100×100 canvas: a prop behind
 * everything, then the torso, a neck, a round head with a face, the hair,
 * and the hat over it.
 *
 * Everything is flat shapes in the app's own colours — the same vocabulary
 * as the badge medallions — so it reads at 30px in the header as well as
 * at 160px on the editor page. Skin, hair and eye colours come in through
 * custom properties, so a colour change never touches the art.
 *
 * Hats sit on a common baseline, brim at y≈30, above the eyes at y=37;
 * hair covers the top of the head down to the temples and is clipped away
 * under a hat's crown. The head and everything on it are shifted down as a group,
 * so the chin nearly meets the shoulders and only a short neck shows.
 * Torso details are clipped to the torso outline, so pockets and stripes
 * can be drawn as plain rectangles.
 */

const INK = "#16241c";

const TORSO_PATH = "M14 100 V88 C14 74 30 66 50 66 C70 66 86 74 86 88 V100Z";

// Hair is painted in `--av-hair`; a hat goes over it.
const HAIR_ART = {
  short: `<path d="M29 36 C29 22 38 15 50 15 C62 15 71 22 71 36 C68 27 60 24 50 24 C40 24 32 27 29 36Z" fill="var(--av-hair)"/>`,
  curly: `<g fill="var(--av-hair)"><circle cx="30" cy="35" r="5.5"/><circle cx="70" cy="35" r="5.5"/><circle cx="34" cy="26" r="7"/><circle cx="66" cy="26" r="7"/><circle cx="42" cy="19" r="7"/><circle cx="58" cy="19" r="7"/><circle cx="50" cy="16" r="7"/></g>`,
  long:  `<path d="M28 62 L28 34 C28 20 38 14 50 14 C62 14 72 20 72 34 L72 62 L63 62 L63 40 C59 31 41 31 37 40 L37 62Z" fill="var(--av-hair)"/>`,
  bald:  "",
};

// `covers` is the y from which a hat's crown hides the hair beneath it, so
// curls do not poke out through a beanie; open items (crowns, a bandana)
// leave it unset and the hair shows through.
const HAT_ART = {
  none: { svg: "" },
  cap: {
    covers: 30,
    svg: `<path d="M30 30 C30 19 39 12 50 12 C61 12 70 19 70 30Z" fill="#12b96e"/><path d="M30 30 H79 a2.5 2.5 0 0 1 0 5 H30Z" fill="#0a8f55"/><circle cx="50" cy="12" r="2" fill="#0a8f55"/>`,
  },
  beanie: {
    covers: 32,
    svg: `<path d="M29 32 C29 18 39 11 50 11 C61 11 71 18 71 32Z" fill="#c62348"/><rect x="28" y="27" width="44" height="7" rx="3.5" fill="#9e1a3a"/><circle cx="50" cy="11" r="4" fill="#ffe3e9"/>`,
  },
  sun_hat: {
    covers: 30,
    svg: `<ellipse cx="50" cy="30" rx="33" ry="4.5" fill="#e0b85a"/><path d="M33 30 C33 17 40 11 50 11 C60 11 67 17 67 30Z" fill="#f0c96a"/><rect x="33" y="25" width="34" height="5" fill="#2b7a4b"/>`,
  },
  bandana: {
    svg: `<path d="M29 31 C36 27 64 27 71 31 L71 36 C64 32 36 32 29 36Z" fill="#e0324b"/><path d="M71 31 L79 26 L77 33 L83 35 L74 37Z" fill="#e0324b"/>`,
  },
  leaf_crown: {
    svg: `<g fill="#3fb36a" stroke="#1f8a4c" stroke-width=".8"><ellipse cx="34" cy="26" rx="7" ry="3.4" transform="rotate(-40 34 26)"/><ellipse cx="42" cy="19" rx="7" ry="3.4" transform="rotate(-20 42 19)"/><ellipse cx="50" cy="16" rx="7" ry="3.4"/><ellipse cx="58" cy="19" rx="7" ry="3.4" transform="rotate(20 58 19)"/><ellipse cx="66" cy="26" rx="7" ry="3.4" transform="rotate(40 66 26)"/></g>`,
  },
  flower_crown: {
    svg: `<g fill="#3fb36a"><ellipse cx="39" cy="22" rx="4" ry="2" transform="rotate(-30 39 22)"/><ellipse cx="61" cy="22" rx="4" ry="2" transform="rotate(30 61 22)"/><ellipse cx="31" cy="31" rx="4" ry="2" transform="rotate(-60 31 31)"/><ellipse cx="69" cy="31" rx="4" ry="2" transform="rotate(60 69 31)"/></g><g><circle cx="34" cy="26" r="4" fill="#ff7aa2"/><circle cx="43" cy="18" r="4" fill="#fff"/><circle cx="50" cy="15" r="4.5" fill="#ff7aa2"/><circle cx="57" cy="18" r="4" fill="#fff"/><circle cx="66" cy="26" r="4" fill="#ff7aa2"/></g><g fill="#ffe66d"><circle cx="34" cy="26" r="1.6"/><circle cx="43" cy="18" r="1.6"/><circle cx="50" cy="15" r="1.8"/><circle cx="57" cy="18" r="1.6"/><circle cx="66" cy="26" r="1.6"/></g>`,
  },
  explorer_hat: {
    covers: 31,
    svg: `<ellipse cx="50" cy="31" rx="31" ry="4.5" fill="#8a6b3f"/><path d="M33 31 C33 17 40 12 50 12 C60 12 67 17 67 31Z" fill="#a8844f"/><path d="M44 14 Q50 19 56 14" stroke="#8a6b3f" stroke-width="1.5" fill="none" stroke-linecap="round"/><rect x="33" y="25" width="34" height="5" fill="#5f4527"/>`,
  },
  headlamp: {
    svg: `<path d="M50 25.5 L84 12 L84 39Z" fill="#ffe66d" opacity=".32"/><rect x="29" y="23" width="42" height="5" rx="2.5" fill="#333"/><rect x="43" y="20" width="14" height="11" rx="3" fill="#555"/><circle cx="50" cy="25.5" r="3.5" fill="#ffe66d"/>`,
  },
  laurel: {
    svg: `<g fill="#e5b338" stroke="#b8860b" stroke-width=".7"><ellipse cx="31" cy="31" rx="5" ry="2.4" transform="rotate(-70 31 31)"/><ellipse cx="34" cy="24" rx="5" ry="2.4" transform="rotate(-50 34 24)"/><ellipse cx="40" cy="18" rx="5" ry="2.4" transform="rotate(-30 40 18)"/><ellipse cx="69" cy="31" rx="5" ry="2.4" transform="rotate(70 69 31)"/><ellipse cx="66" cy="24" rx="5" ry="2.4" transform="rotate(50 66 24)"/><ellipse cx="60" cy="18" rx="5" ry="2.4" transform="rotate(30 60 18)"/></g>`,
  },
  crown: {
    svg: `<path d="M31 32 L31 17 L40 25 L50 12 L60 25 L69 17 L69 32Z" fill="#f2b632" stroke="#c98d12" stroke-width="1.4" stroke-linejoin="round"/><rect x="31" y="29" width="38" height="4" fill="#d9981a"/><circle cx="50" cy="12" r="2.4" fill="#e0324b"/><circle cx="31" cy="17" r="2" fill="#3b82f6"/><circle cx="69" cy="17" r="2" fill="#3b82f6"/>`,
  },
  wizard_hat: {
    covers: 31,
    svg: `<ellipse cx="50" cy="31" rx="31" ry="4.5" fill="#5b3fb5"/><path d="M30 32 C33 20 42 8 54 3 C56 12 58 24 68 32Z" fill="#8b5cf6"/><path d="M30 32 C33 22 39 15 46 10 C46 18 44 26 42 32Z" fill="#7a4ae0"/><rect x="30" y="27" width="38" height="5" rx="1" fill="#3b2a80"/><g fill="#ffe66d"><circle cx="48" cy="18" r="1.6"/><circle cx="55" cy="24" r="1.2"/><circle cx="43" cy="24" r="1"/></g>`,
  },
  // --- Harvest & Hallows 2026 ---
  witch_hat: {
    covers: 31,
    // Wider brim and a blacker, more crooked cone than the wizard's, so the
    // two never read as the same hat.
    svg: `<ellipse cx="50" cy="31" rx="35" ry="5" fill="#1b1622"/><path d="M29 32 C33 21 39 11 58 1 C56 12 57 24 69 32Z" fill="#2a2235"/><path d="M29 32 C33 23 38 15 47 8 C46 17 44 25 42 32Z" fill="#372d45"/><rect x="29" y="26" width="40" height="6" rx="1" fill="#120e18"/><rect x="45" y="25" width="9" height="8" rx="1.5" fill="#f2b632"/><rect x="47.5" y="27.5" width="4" height="3" fill="#120e18"/>`,
  },
  pumpkin_lantern: {
    covers: 26,
    // Worn on the head, not over the face: the carved side faces forward on
    // the crown, so the player's own face still reads at 28px.
    svg: `<g><ellipse cx="50" cy="20" rx="21" ry="15" fill="#ef7a1a"/><path d="M39 7 C35 12 35 28 39 33" stroke="#d1610c" stroke-width="1.6" fill="none"/><path d="M61 7 C65 12 65 28 61 33" stroke="#d1610c" stroke-width="1.6" fill="none"/><path d="M50 5.5 C47 11 47 29 50 34.5" stroke="#d1610c" stroke-width="1.6" fill="none"/><path d="M50 6 C50 1 53 -1 56 0 C53 1 52 3 53 6Z" fill="#4a7c34"/><g fill="#3d1f06"><path d="M40 17 L46 20 L40 23Z"/><path d="M60 17 L54 20 L60 23Z"/><path d="M42 26 Q50 32 58 26 L55 26.5 L53 28.5 L50 26.8 L47 28.5 L45 26.5Z"/></g><g fill="#ffd166" opacity=".55"><path d="M40 17 L46 20 L40 23Z"/><path d="M60 17 L54 20 L60 23Z"/></g></g>`,
  },
  // --- Golden Harvest 2026 ---
  acorn_cap: {
    covers: 30,
    // An acorn's cup, which means no brim at all: the first version gave it
    // a wide flat one and it read as a pith helmet. What sells it instead is
    // the rows of overlapping scales narrowing towards the crown, plus the
    // short stalk on top.
    svg: `<path d="M27 31 C27 16 37 8 50 8 C63 8 73 16 73 31Z" fill="#8f6430"/><rect x="26.5" y="27.5" width="47" height="4" rx="2" fill="#6b4a24"/><g fill="none" stroke="#63431f" stroke-width=".9" opacity=".7" stroke-linecap="round"><path d="M29 27 q4.2 -3 8.4 0 M37.4 27 q4.2 -3 8.4 0 M45.8 27 q4.2 -3 8.4 0 M54.2 27 q4.2 -3 8.4 0 M62.6 27 q4.2 -3 8.4 0 M30 22 q4 -3 8 0 M38 22 q4 -3 8 0 M46 22 q4 -3 8 0 M54 22 q4 -3 8 0 M62 22 q4 -3 8 0 M33 17 q4.25 -3 8.5 0 M41.5 17 q4.25 -3 8.5 0 M50 17 q4.25 -3 8.5 0 M58.5 17 q4.25 -3 8.5 0 M37 12.5 q4.333 -3 8.667 0 M45.67 12.5 q4.333 -3 8.667 0 M54.33 12.5 q4.333 -3 8.667 0"/></g><rect x="47.6" y="1.5" width="4.8" height="8" rx="2.2" fill="#5a3c1c"/><path d="M52.2 3 q6.5 -1.5 8.5 -5.5 q-7.5 -1 -9.5 3.5Z" fill="#c2652a"/>`,
  },
  harvest_lantern: {
    covers: 26,
    // The same lantern Hallows hands out at this tier, warmed: rounder
    // carving and a maple leaf on the stem instead of a green sprig, so it
    // reads as a harvest lantern rather than a Halloween prop. Geometry is
    // unchanged from `pumpkin_lantern` on purpose — the two sit identically
    // on the head, so switching events swaps the mood and nothing else.
    svg: `<g><ellipse cx="50" cy="20" rx="21" ry="15" fill="#f28c28"/><path d="M39 7 C35 12 35 28 39 33" stroke="#cf6b12" stroke-width="1.6" fill="none"/><path d="M61 7 C65 12 65 28 61 33" stroke="#cf6b12" stroke-width="1.6" fill="none"/><path d="M50 5.5 C47 11 47 29 50 34.5" stroke="#cf6b12" stroke-width="1.6" fill="none"/><rect x="48.4" y="3" width="3.2" height="5" rx="1.4" fill="#7a5124"/><path d="M52 3 q8 -1 10 -6 q-9 -1 -11 4Z" fill="#c2402a"/><path d="M48 3 q-7 -2 -10 -6 q8 -1 10 4Z" fill="#e0a92e"/><g fill="#5c2f07"><circle cx="43" cy="20" r="3.1"/><circle cx="57" cy="20" r="3.1"/><path d="M42 26 Q50 33 58 26 Q50 29.5 42 26Z"/></g><g fill="#ffd166" opacity=".6"><circle cx="43" cy="20" r="3.1"/><circle cx="57" cy="20" r="3.1"/></g><ellipse cx="50" cy="20" rx="21" ry="15" fill="#ffd166" opacity=".12"/></g>`,
  },
};

// Props hang behind the body — drawn before the torso, so the shoulders
// and the head overlap them and they read as worn rather than stuck on.
const PROP_ART = {
  none: "",
  bat_wings: `<g>
    <path d="M50 74 C40 62 23 55 7 60 C14 65 14 72 9 78 C18 75 25 78 29 85 C34 78 42 75 50 82Z" fill="#241a2e"/>
    <path d="M50 74 C60 62 77 55 93 60 C86 65 86 72 91 78 C82 75 75 78 71 85 C66 78 58 75 50 82Z" fill="#241a2e"/>
    <g stroke="#3d2d4d" stroke-width="1.2" fill="none" stroke-linecap="round">
      <path d="M48 76 L14 63 M48 79 L12 76 M48 81 L30 84"/>
      <path d="M52 76 L86 63 M52 79 L88 76 M52 81 L70 84"/>
    </g>
  </g>`,
  // --- Golden Harvest 2026 ---
  // Hallows' silhouette exactly, in russet and amber. Both events hand wings
  // out at tier 3, so this is the one item where the two themes can be put
  // side by side with nothing but the colour changing.
  dusk_wings: `<g>
    <path d="M50 74 C40 62 23 55 7 60 C14 65 14 72 9 78 C18 75 25 78 29 85 C34 78 42 75 50 82Z" fill="#8f4a1e"/>
    <path d="M50 74 C60 62 77 55 93 60 C86 65 86 72 91 78 C82 75 75 78 71 85 C66 78 58 75 50 82Z" fill="#8f4a1e"/>
    <g stroke="#f2a51c" stroke-width="1.2" fill="none" stroke-linecap="round">
      <path d="M48 76 L14 63 M48 79 L12 76 M48 81 L30 84"/>
      <path d="M52 76 L86 63 M52 79 L88 76 M52 81 L70 84"/>
    </g>
  </g>`,
};

// `fill` paints the torso outline; `collar` decides what shows at the neck
// opening ("round" for a tee, "none" for anything buttoned to the top);
// `behind` is drawn before the body, for capes and hoods; `svg` goes over
// the torso, clipped to it.
const TORSO_ART = {
  tee_green: {
    fill: "#12b96e", collar: "round",
    svg: `<path d="M50 80 C50 73 56 70 59 70 C59 77 55 81 50 80Z" fill="#dff7ea"/>`,
  },
  tee_blue: {
    fill: "#3b82f6", collar: "round",
    svg: `<rect x="0" y="82" width="100" height="5" fill="#fff" opacity=".9"/>`,
  },
  tee_stripes: {
    fill: "#fff", collar: "round",
    svg: `<g fill="#1f4e79"><rect x="0" y="72" width="100" height="4"/><rect x="0" y="80" width="100" height="4"/><rect x="0" y="88" width="100" height="4"/><rect x="0" y="96" width="100" height="4"/></g>`,
  },
  hoodie: {
    fill: "#6b7280", collar: "none",
    behind: `<path d="M30 68 C30 48 70 48 70 68Z" fill="#4b5563"/>`,
    svg: `<path d="M34 66 C40 75 60 75 66 66 L66 72 C60 81 40 81 34 72Z" fill="#4b5563"/><path d="M46 72 V82 M54 72 V82" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><path d="M36 90 H64 V100 H36Z" fill="#4b5563"/>`,
  },
  overalls: {
    fill: "#f0c96a", collar: "round",
    svg: `<path d="M38 66 L40 78 M62 66 L60 78" stroke="#3b5998" stroke-width="4"/><rect x="36" y="76" width="28" height="30" rx="3" fill="#3b5998"/><circle cx="40" cy="79" r="1.8" fill="#f2b632"/><circle cx="60" cy="79" r="1.8" fill="#f2b632"/><rect x="44" y="85" width="12" height="9" rx="1.5" fill="#2e4577"/>`,
  },
  raincoat: {
    fill: "#f5b90a", collar: "none",
    svg: `<path d="M50 70 V100" stroke="#c48f00" stroke-width="2"/><path d="M43 66 L50 76 L57 66 L61 66 L50 81 L39 66Z" fill="#d89e00"/><g fill="#c48f00"><circle cx="41" cy="86" r="1.6"/><circle cx="41" cy="94" r="1.6"/><circle cx="59" cy="86" r="1.6"/><circle cx="59" cy="94" r="1.6"/></g>`,
  },
  field_vest: {
    fill: "#7c9a6b", collar: "round",
    svg: `<path d="M14 100 V88 C14 76 24 70 34 68 L40 100Z" fill="#c2a878"/><path d="M86 100 V88 C86 76 76 70 66 68 L60 100Z" fill="#c2a878"/><rect x="18" y="84" width="14" height="10" rx="2" fill="#a88f5f"/><rect x="68" y="84" width="14" height="10" rx="2" fill="#a88f5f"/>`,
  },
  lab_coat: {
    fill: "#fff", collar: "none",
    svg: `<path d="M44 66 L50 80 L56 66Z" fill="#3b82f6"/><path d="M42 66 L50 82 L58 66 L62 66 L50 88 L38 66Z" fill="#e6ece1"/><rect x="64" y="84" width="14" height="11" rx="1.5" fill="none" stroke="#c9d3c3" stroke-width="1.2"/><rect x="69" y="80" width="2.5" height="10" rx="1" fill="#c62348"/><circle cx="50" cy="91" r="1.5" fill="#c9d3c3"/><circle cx="50" cy="97" r="1.5" fill="#c9d3c3"/>`,
  },
  apron: {
    fill: "#d9e8d0", collar: "round",
    svg: `<path d="M40 71 V66 M60 71 V66" stroke="#7cb46a" stroke-width="3"/><path d="M40 70 H60 V80 H72 V100 H28 V80 H40Z" fill="#7cb46a"/><path d="M50 86 V79" stroke="#3fb36a" stroke-width="1.5"/><circle cx="50" cy="79" r="3.2" fill="#ff7aa2"/><circle cx="50" cy="79" r="1.3" fill="#ffe66d"/><rect x="42" y="86" width="16" height="10" rx="2" fill="#5f9c50"/>`,
  },
  explorer_jacket: {
    fill: "#8a6b3f", collar: "none",
    svg: `<path d="M50 70 V100" stroke="#5c4326" stroke-width="2"/><path d="M40 66 L50 78 L60 66 L64 66 L50 84 L36 66Z" fill="#6f5430"/><g fill="#6f5430"><rect x="22" y="78" width="14" height="10" rx="2"/><rect x="64" y="78" width="14" height="10" rx="2"/><rect x="22" y="92" width="14" height="10" rx="2"/><rect x="64" y="92" width="14" height="10" rx="2"/></g>`,
  },
  cape: {
    fill: "#c62348", collar: "none",
    behind: `<path d="M8 100 V84 C8 66 28 60 50 60 C72 60 92 66 92 84 V100Z" fill="#8e1435"/>`,
    svg: `<rect x="0" y="94" width="100" height="4" fill="#f2b632"/><circle cx="50" cy="70" r="3.2" fill="#f2b632"/>`,
  },
  gold_jersey: {
    fill: "#f2b632", collar: "round",
    svg: `<rect x="0" y="90" width="100" height="3" fill="#fff" opacity=".7"/><path d="M50 74 l2.6 5.4 6 .8 -4.3 4.2 1 5.9 -5.3 -2.8 -5.3 2.8 1 -5.9 -4.3 -4.2 6 -.8Z" fill="#fff"/>`,
  },
  // --- Harvest & Hallows 2026 ---
  cobweb_tee: {
    fill: "#2b2440", collar: "round",
    svg: `<g stroke="#cfd6e8" stroke-width="1" fill="none" opacity=".92"><path d="M14 68 L14 100 M14 68 C30 70 40 82 42 100 M14 68 C24 78 28 88 28 100"/><path d="M14 76 C22 77 28 83 30 90 M14 84 C20 85 24 90 25 95"/></g><g fill="#cfd6e8"><circle cx="66" cy="82" r="3"/><path d="M62 79 L58 76 M70 79 L74 76 M62 85 L58 88 M70 85 L74 88" stroke="#cfd6e8" stroke-width="1"/></g>`,
  },
  skeleton: {
    fill: "#17161d", collar: "none",
    svg: `<g fill="#eef1f5"><rect x="47" y="66" width="6" height="4" rx="1"/><rect x="38" y="74" width="24" height="3.2" rx="1.6"/><rect x="36" y="81" width="28" height="3.2" rx="1.6"/><rect x="38" y="88" width="24" height="3.2" rx="1.6"/><rect x="48.5" y="73" width="3" height="20" rx="1.5"/><path d="M30 72 L24 86 M70 72 L76 86" stroke="#eef1f5" stroke-width="3" stroke-linecap="round"/></g>`,
  },
  vampire_cape: {
    fill: "#1a1620", collar: "none",
    behind: `<path d="M8 100 V84 C8 66 28 60 50 60 C72 60 92 66 92 84 V100Z" fill="#8a0f2a"/>`,
    svg: `<path d="M34 66 L50 74 L66 66 L66 70 L50 80 L34 70Z" fill="#eef1f5"/><path d="M28 62 L38 62 L34 74Z" fill="#c31437"/><path d="M72 62 L62 62 L66 74Z" fill="#c31437"/><circle cx="50" cy="84" r="3" fill="#c31437"/><path d="M47.6 92 L50 88 L52.4 92 L50 94Z" fill="#c31437"/>`,
  },
  // --- Golden Harvest 2026 ---
  knit_sweater: {
    fill: "#c25d2a", collar: "round",
    // Cables and a ribbed hem. Both are drawn as plain strokes rather than
    // a pattern fill, because the torso is clipped and a tiled pattern would
    // need its own def per avatar — and there can be thirty on the wardrobe
    // page at once.
    svg: `<rect x="0" y="93" width="100" height="7" fill="#a4471c"/><g stroke="#96401f" stroke-width="1" opacity=".8"><path d="M0 94.5 H100 M0 97 H100"/></g><g stroke="#d97a42" stroke-width="2" fill="none" stroke-linecap="round"><path d="M36 68 C40 73 32 77 36 82 C40 87 32 91 36 95"/><path d="M50 66 C54 71 46 75 50 80 C54 85 46 89 50 93"/><path d="M64 68 C68 73 60 77 64 82 C68 87 60 91 64 95"/></g><g fill="#a4491f"><circle cx="24" cy="78" r="1.2"/><circle cx="24" cy="86" r="1.2"/><circle cx="76" cy="78" r="1.2"/><circle cx="76" cy="86" r="1.2"/></g>`,
  },
  flannel: {
    fill: "#c1512f", collar: "none",
    // Plaid the cheap way: two sets of translucent bands crossing, plus a
    // thin gold overcheck. The crossings darken themselves, which is what
    // makes it read as woven rather than as a grid drawn on top.
    svg: `<g fill="#8a2c1a" opacity=".5"><rect x="0" y="68" width="100" height="6"/><rect x="0" y="82" width="100" height="6"/><rect x="0" y="96" width="100" height="6"/><rect x="18" y="60" width="6" height="45"/><rect x="40" y="60" width="6" height="45"/><rect x="62" y="60" width="6" height="45"/><rect x="84" y="60" width="6" height="45"/></g><g stroke="#f2d06a" stroke-width=".9" opacity=".8"><path d="M0 78 H100 M0 92 H100 M32 60 V105 M76 60 V105"/></g><path d="M34 66 L50 76 L66 66 L66 70 L50 81 L34 70Z" fill="#a53b22"/><rect x="47.5" y="74" width="5" height="26" fill="#8a2c1a"/><g fill="#e8b04a"><circle cx="50" cy="82" r="1.3"/><circle cx="50" cy="90" r="1.3"/><circle cx="50" cy="97" r="1.3"/></g>`,
  },
  leaf_cloak: {
    fill: "#b3601f", collar: "none",
    behind: `<path d="M8 100 V84 C8 66 28 60 50 60 C72 60 92 66 92 84 V100Z" fill="#d98a2b"/>`,
    // Leaves as rotated ellipses with a midrib — the same vocabulary
    // `leaf_crown` and `laurel` already use, so the wardrobe stays one hand.
    svg: `<g><g transform="rotate(-35 30 78)"><ellipse cx="30" cy="78" rx="6" ry="3.1" fill="#f2d04a"/><path d="M25 78 H35" stroke="#a8701a" stroke-width=".7"/></g><g transform="rotate(25 68 74)"><ellipse cx="68" cy="74" rx="5.5" ry="2.9" fill="#e0541c"/><path d="M63.4 74 H72.6" stroke="#9c2f13" stroke-width=".7"/></g><g transform="rotate(-15 40 92)"><ellipse cx="40" cy="92" rx="5" ry="2.6" fill="#93a437"/><path d="M35.8 92 H44.2" stroke="#8a3c17" stroke-width=".7"/></g><g transform="rotate(50 74 92)"><ellipse cx="74" cy="92" rx="4.8" ry="2.5" fill="#f2a51c"/><path d="M70 92 H78" stroke="#a8701a" stroke-width=".7"/></g><g transform="rotate(10 22 90)"><ellipse cx="22" cy="90" rx="4.3" ry="2.3" fill="#c1372a"/></g></g><circle cx="50" cy="70" r="3.4" fill="#f2d06a"/><circle cx="50" cy="70" r="1.5" fill="#8a3c17"/>`,
  },
  star_cloak: {
    fill: "#1e1b4b", collar: "none",
    behind: `<path d="M6 100 V86 C6 66 28 60 50 60 C72 60 94 66 94 86 V100Z" fill="#312e81"/>`,
    svg: `<g fill="#ffe66d"><circle cx="30" cy="82" r="1.4"/><circle cx="66" cy="78" r="1.1"/><circle cx="44" cy="92" r="1.3"/><circle cx="72" cy="94" r="1"/><circle cx="56" cy="84" r="1.6"/><circle cx="22" cy="94" r="1"/></g><circle cx="50" cy="70" r="3.2" fill="#ffe66d"/>`,
  },
};

// Inline SVG ids are document-wide, and a page shows many avatars at once
// (every editor tile is one), so each clip path gets its own id.
let clipSeq = 0;

function eye(cx) {
  return `<circle cx="${cx}" cy="37" r="2.8" fill="var(--av-eyes)"/><circle cx="${cx}" cy="37" r="1.4" fill="${INK}"/><circle cx="${cx + 1}" cy="36" r=".7" fill="#fff"/>`;
}

/**
 * The avatar as an SVG markup string.
 * `avatar` is { skin, hair, hairColor, eyes, hat, torso, props }; unknown
 * ids fall back to the defaults.
 */
export function avatarSvg(avatar, { className = "av" } = {}) {
  const a = normalizeAvatar(avatar);
  const tone = SKIN_TONES.find((s) => s.id === a.skin) ?? SKIN_TONES[0];
  const hairColor = HAIR_COLORS.find((c) => c.id === a.hairColor) ?? HAIR_COLORS[0];
  const eyes = EYE_COLORS.find((c) => c.id === a.eyes) ?? EYE_COLORS[0];
  const hair = HAIR_ART[a.hair] ?? HAIR_ART.short;
  const hat = HAT_ART[a.hat] ?? HAT_ART.none;
  const torso = TORSO_ART[a.torso] ?? TORSO_ART.tee_green;
  const prop = PROP_ART[a.props] ?? "";
  const seq = ++clipSeq;
  const torsoClip = `av-torso-${seq}`;
  const hairClip = `av-hair-${seq}`;
  // A gradient hair colour is painted by a real SVG gradient, referenced
  // through the same custom property a flat colour uses — so the hair art
  // itself never learns the difference.
  const hairGradId = `av-hairgrad-${seq}`;
  const hairStops = Array.isArray(hairColor.stops) ? hairColor.stops : null;
  const hairPaint = hairStops ? `url(#${hairGradId})` : hairColor.fill;

  const collar = torso.collar === "round"
    ? `<path d="M42 66 Q50 72 58 66Z" fill="var(--av-skin-2)"/>`
    : "";
  const hairLayer = hat.covers
    ? `<g clip-path="url(#${hairClip})">${hair}</g>`
    : hair;

  return `<svg class="${className}" viewBox="0 0 100 100" aria-hidden="true" focusable="false" style="--av-skin:${tone.fill};--av-skin-2:${tone.shade};--av-hair:${hairPaint};--av-eyes:${eyes.fill}">
  <defs>
    <clipPath id="${torsoClip}"><path d="${TORSO_PATH}"/></clipPath>
    ${hat.covers ? `<clipPath id="${hairClip}"><rect x="0" y="${hat.covers}" width="100" height="100"/></clipPath>` : ""}
    ${hairStops ? `<linearGradient id="${hairGradId}" x1="0" y1="0" x2="0.35" y2="1">${
      hairStops.map((c, i) => `<stop offset="${(i / (hairStops.length - 1)).toFixed(3)}" stop-color="${c}"/>`).join("")
    }</linearGradient>` : ""}
  </defs>
  ${prop}
  ${torso.behind ?? ""}
  <rect x="42" y="54" width="16" height="16" rx="5" fill="var(--av-skin-2)"/>
  <path d="${TORSO_PATH}" fill="${torso.fill}"/>
  <g clip-path="url(#${torsoClip})">${collar}${torso.svg ?? ""}</g>
  <g transform="translate(0 6)">
    <circle cx="30" cy="38" r="3.6" fill="var(--av-skin-2)"/>
    <circle cx="70" cy="38" r="3.6" fill="var(--av-skin-2)"/>
    <circle cx="50" cy="36" r="20" fill="var(--av-skin)"/>
    <circle cx="40" cy="43" r="3" fill="#e65a6e" opacity=".22"/>
    <circle cx="60" cy="43" r="3" fill="#e65a6e" opacity=".22"/>
    ${eye(43)}${eye(57)}
    <path d="M45.5 45 Q50 49 54.5 45" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${hairLayer}
    ${hat.svg}
  </g>
</svg>`;
}

/** The same, as an element ready to append. */
export function avatarElement(avatar, opts) {
  const tpl = document.createElement("template");
  tpl.innerHTML = avatarSvg(avatar, opts).trim();
  return tpl.content.firstElementChild;
}
