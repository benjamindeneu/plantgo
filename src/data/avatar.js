// src/data/avatar.js
import { db } from "../../firebase-config.js";
import { doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

/**
 * The player's avatar: skin tone, hair style and colour, eye colour, a hat
 * and an outfit, kept as ids on the user doc
 * (`avatar: { skin, hair, hairColor, eyes, hat, torso }`). The art for
 * each id lives in Avatar.view.js; this file only says what exists and what
 * it costs.
 *
 * `requires` is an unlock token — a badge id from badges.js, or an event
 * pass tier from events.js (`"<eventId>:<tier>"`) — or null for a starter
 * item. The editor is the only writer, and it refuses locked items, so
 * nothing else has to re-check.
 */
export const SKIN_TONES = [
  { id: "s1", fill: "#f9dcc4", shade: "#e6c2a5", requires: null },
  { id: "s2", fill: "#f1c68e", shade: "#d9a870", requires: null },
  { id: "s3", fill: "#d8a06a", shade: "#bd8654", requires: null },
  { id: "s4", fill: "#a86b3f", shade: "#8f5731", requires: null },
  { id: "s5", fill: "#6b4226", shade: "#54321b", requires: null },
];

export const HAIR_STYLES = [
  { id: "short", requires: null },
  { id: "curly", requires: null },
  { id: "long",  requires: null },
  { id: "bald",  requires: null },
];

export const HAIR_COLORS = [
  { id: "black",    fill: "#1f1a17", requires: null },
  { id: "brown",    fill: "#3b2a1e", requires: null },
  { id: "chestnut", fill: "#7a4a2a", requires: null },
  { id: "blonde",   fill: "#e1b467", requires: null },
  { id: "ginger",   fill: "#b5482a", requires: null },
  { id: "silver",   fill: "#cdd2d6", requires: null },
  { id: "moss",     fill: "#3fb36a", requires: "level_5" },
  { id: "violet",   fill: "#8b5cf6", requires: "epic_obs" },
  // Event colours are gradients rather than flats: `stops` paints the hair
  // with an SVG gradient and the wardrobe swatch with the CSS one, so an
  // event colour looks like the prize it is. `fill` stays as the single
  // colour anything that cannot take a gradient falls back to.
  { id: "spectral", fill: "#cfe8d8", requires: "hallows_2026:4",
    stops: ["#eafff6", "#a8e6cf", "#7fb3d5", "#9b8ec4"] },
  { id: "ember",    fill: "#ff7a18", requires: "hallows_2026:9",
    stops: ["#ffe66d", "#ff9a2e", "#e8451f", "#8a1616"] },
  // Golden Harvest 2026. Its own items throughout, never a second `requires`
  // on a Hallows one: `requires` is a single token everywhere that reads it
  // (isItemUnlocked, itemsUnlockedBy, the result modal's tier card), so
  // sharing an item between two events would mean teaching all three about
  // lists. These two events are alternatives that will never both ship, so
  // duplicating the two costumes worth carrying over is the cheaper half of
  // that trade — and it lets the carried-over pair be warmed to this palette
  // instead of dragging Hallows' purple-black into it.
  { id: "autumn",   fill: "#d98a2b", requires: "harvest_2026:4",
    stops: ["#ffe1a0", "#e8a33c", "#c2652a", "#8a3c17"] },
  { id: "maple",    fill: "#d94a22", requires: "harvest_2026:9",
    stops: ["#ffd76b", "#f08a2a", "#d33a1c", "#7d1d12"] },
];

export const EYE_COLORS = [
  { id: "brown", fill: "#4a2f1c", requires: null },
  { id: "dark",  fill: "#16241c", requires: null },
  { id: "hazel", fill: "#8a6a2f", requires: null },
  { id: "green", fill: "#3f8a5a", requires: null },
  { id: "blue",  fill: "#4f86c6", requires: null },
  { id: "grey",  fill: "#7d8a94", requires: null },
  { id: "witching", fill: "#b5e853", requires: "hallows_2026:1" },
  { id: "amber",    fill: "#d98a2b", requires: "harvest_2026:1" },
];

export const HAT_ITEMS = [
  { id: "none",         requires: null },
  { id: "cap",          requires: null },
  { id: "beanie",       requires: null },
  { id: "sun_hat",      requires: null },
  { id: "bandana",      requires: "obs_1" },
  { id: "leaf_crown",   requires: "disc_10" },
  { id: "flower_crown", requires: "disc_50" },
  { id: "explorer_hat", requires: "mission_10" },
  { id: "headlamp",     requires: "perfect_day" },
  { id: "laurel",       requires: "legendary_obs" },
  { id: "crown",        requires: "chal_win_10" },
  { id: "wizard_hat",   requires: "level_20" },
  // Harvest & Hallows 2026
  { id: "witch_hat",       requires: "hallows_2026:6" },
  { id: "pumpkin_lantern", requires: "hallows_2026:7" },
  // Golden Harvest 2026
  { id: "acorn_cap",       requires: "harvest_2026:6" },
  { id: "harvest_lantern", requires: "harvest_2026:7" },
];

/**
 * Props: worn on the back, behind the body, rather than on the head or
 * over the torso. "none" is first and is the starter — a prop is an extra,
 * so the plain avatar has to stay one tap away.
 */
export const PROP_ITEMS = [
  { id: "none",      requires: null },
  { id: "bat_wings", requires: "hallows_2026:3" },
  // Golden Harvest 2026 — the same silhouette at the same tier as Hallows'
  // wings, in russet rather than purple-black. Same tier on purpose: it is
  // the one item both events hand out at the same moment, so it is the one
  // place the two themes can be compared without anything else moving.
  { id: "dusk_wings", requires: "harvest_2026:3" },
];

export const TORSO_ITEMS = [
  { id: "tee_green",       requires: null },
  { id: "tee_blue",        requires: null },
  { id: "tee_stripes",     requires: null },
  { id: "hoodie",          requires: null },
  { id: "overalls",        requires: null },
  { id: "raincoat",        requires: "mission_1" },
  { id: "field_vest",      requires: "obs_100" },
  { id: "lab_coat",        requires: "releve_1" },
  { id: "apron",           requires: "disc_100" },
  { id: "explorer_jacket", requires: "mission_100" },
  { id: "cape",            requires: "chal_win_1" },
  { id: "gold_jersey",     requires: "level_10" },
  { id: "star_cloak",      requires: "disc_500" },
  // Harvest & Hallows 2026
  { id: "cobweb_tee",   requires: "hallows_2026:2" },
  { id: "skeleton",     requires: "hallows_2026:5" },
  { id: "vampire_cape", requires: "hallows_2026:8" },
  // Golden Harvest 2026
  { id: "knit_sweater", requires: "harvest_2026:2" },
  { id: "flannel",      requires: "harvest_2026:5" },
  { id: "leaf_cloak",   requires: "harvest_2026:8" },
];

/** Display order of the editor's sections; each names a key of the avatar. */
export const AVATAR_SLOTS = ["skin", "hair", "hairColor", "eyes", "hat", "torso", "props"];

/** The slots with something to unlock — what the hero's "n of total" counts. */
export const WARDROBE_SLOTS = ["hairColor", "hat", "torso", "props"];

export const DEFAULT_AVATAR = { skin: "s3", hair: "short", hairColor: "brown", eyes: "brown", hat: "none", torso: "tee_green", props: "none" };

const SLOT_ITEMS = {
  skin: SKIN_TONES,
  hair: HAIR_STYLES,
  hairColor: HAIR_COLORS,
  eyes: EYE_COLORS,
  hat: HAT_ITEMS,
  torso: TORSO_ITEMS,
  props: PROP_ITEMS,
};

export function slotItems(slot) {
  return SLOT_ITEMS[slot] ?? [];
}

/** i18n key of a slot's name — "Hat", "Outfit", "Props" — for a type label. */
export function slotNameKey(slot) {
  return `avatar.group.${slot}`;
}

/** i18n key of an item's name; skin tones are numbered rather than named. */
export function itemNameKey(slot, id) {
  return slot === "skin" ? "avatar.skin.label" : `avatar.${slot}.${id}`;
}

export function isItemUnlocked(item, unlockedSet) {
  return !item.requires || unlockedSet.has(item.requires);
}

/** The items a badge hands out, as [{ slot, item }] — empty for most badges. */
export function itemsUnlockedBy(badgeId) {
  const out = [];
  for (const slot of AVATAR_SLOTS) {
    for (const item of slotItems(slot)) if (item.requires === badgeId) out.push({ slot, item });
  }
  return out;
}

// The first version had one `head` slot holding either a hair style or a
// hat; a doc written then still reads, landing in whichever slot fits.
const LEGACY_HEAD_HAIR = { hair_short: "short", hair_curly: "curly", hair_long: "long" };
// Bat wings were a hat before they were a prop; anyone wearing them keeps
// them, on the back where they now belong.
const LEGACY_HAT_PROPS = { bat_wings: "props" };

/**
 * A stored avatar made safe to draw: every slot holds a known id, so an item
 * that was renamed or removed falls back to the default rather than to a
 * blank body.
 */
export function normalizeAvatar(raw) {
  const out = { ...DEFAULT_AVATAR };
  if (!raw || typeof raw !== "object") return out;
  const src = { ...raw };
  if (typeof src.head === "string" && !("hair" in src) && !("hat" in src)) {
    if (LEGACY_HEAD_HAIR[src.head]) src.hair = LEGACY_HEAD_HAIR[src.head];
    else src.hat = src.head;
  }
  const moved = LEGACY_HAT_PROPS[src.hat];
  if (moved && !src[moved]) { src[moved] = src.hat; src.hat = "none"; }
  for (const slot of AVATAR_SLOTS) {
    const id = src[slot];
    if (typeof id === "string" && slotItems(slot).some((it) => it.id === id)) out[slot] = id;
  }
  return out;
}

/**
 * Subscribe to the user's avatar. Calls back with a normalized avatar on
 * every change (the default one while nothing is stored yet). Returns an
 * unsubscribe function.
 */
export function subscribeAvatar(userId, callback) {
  return onSnapshot(doc(db, "users", userId), (snap) => {
    callback(normalizeAvatar(snap.data()?.avatar));
  });
}

/**
 * Save the avatar, and mirror it onto the player's row in the challenge
 * they are in, if any: the leaderboard reads member docs, not user docs.
 * A row that cannot be updated (the challenge is over, the doc is gone) is
 * not worth failing the save for.
 */
export async function saveAvatar(userId, avatar) {
  const clean = normalizeAvatar(avatar);
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { avatar: clean });

  let challengeId = null;
  try { challengeId = (await getDoc(userRef)).data()?.activeChallenge?.id ?? null; } catch {}
  if (!challengeId) return;
  try {
    await updateDoc(doc(db, "challenges", challengeId, "members", userId), { avatar: clean });
  } catch (e) {
    console.warn("[avatar] challenge row not updated:", e?.message ?? e);
  }
}
