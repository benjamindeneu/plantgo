// src/data/events.js
import { db } from "../../firebase-config.js";
import { doc, getDoc, setDoc, increment, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

/**
 * Seasonal events, and the pass that carries their cosmetics.
 *
 * The pass fills with the points of any observation made inside the window —
 * not with a list of species to find. That is deliberate: a checklist of
 * autumn berries is unplayable in a city in another hemisphere, while points
 * are earned wherever the player is, and missions keep doing the steering.
 * The theme lives in the cosmetics and the colours, never in the rules.
 *
 * Tiers are thresholds of event XP. They unlock avatar items through the
 * same `requires` field badges use: an item asks for the token
 * `"<eventId>:<tier>"` the way it would ask for a badge id, so the wardrobe
 * needs no second notion of ownership.
 *
 * XP lives at users/{uid}/events/{eventId} and only ever grows. An event is
 * over when its window closes; what was unlocked stays unlocked forever.
 */

/**
 * Thresholds for tiers 1…9. Front-loaded — the gaps widen from 1k to 11k —
 * so the first reward lands on day one and the last is a month's work.
 */
const HALLOWS_TIERS = [1000, 3000, 6000, 10000, 15000, 21000, 29000, 38000, 50000];

/**
 * Golden Harvest's ladder — deliberately the same numbers as Hallows', and
 * deliberately its own array rather than a shared constant.
 *
 * The two events are candidates for the same October slot, not a pair: only
 * one will ship. Identical thresholds over an identical window length are
 * what make the comparison about the *theme* — if one ladder were gentler,
 * "which feels better" would be answering a question about pacing instead.
 * Kept separate so tuning one to see how it feels cannot silently retune the
 * other, and so deleting the loser is deleting, not untangling.
 */
const HARVEST_TIERS = [1000, 3000, 6000, 10000, 15000, 21000, 29000, 38000, 50000];

export const EVENTS = [
  {
    id: "hallows_2026",
    nameKey: "events.hallows.name",
    taglineKey: "events.hallows.tagline",
    emoji: "🎃",
    theme: "hallows",
    // Local dates, inclusive of `from`, exclusive of `to` — the same
    // local-calendar reckoning the daily quests use.
    from: "2026-10-12",
    to: "2026-11-03",
    tiers: HALLOWS_TIERS.map((xp, i) => ({ tier: i + 1, xp })),
  },
  {
    // The other October, to be tried against the one above: autumn as a
    // season rather than as Halloween. Same length (22 days) and the same
    // ladder, so what differs between the two is the dressing and nothing
    // else. It keeps two of Hallows' costumes — wings and a carved lantern,
    // warmed up and reshaped as its own items — because those are the two
    // worth finding out whether the season can carry without the rest.
    //
    // Its window opens on the 1st, where leaf-turn actually is, rather than
    // on the 12th, where the run-up to a single night begins.
    //
    // NOTE: the two windows overlap (Oct 12–22). That is fine while both are
    // candidates — `eventSim` chooses between them and now wins outright, see
    // `activeEvent` — but it is not a shippable state: with no override the
    // calendar takes the first live entry in this array, which is Hallows.
    // Whichever loses gets deleted; that resolves it.
    id: "harvest_2026",
    nameKey: "events.harvest.name",
    taglineKey: "events.harvest.tagline",
    emoji: "🍂",
    theme: "harvest",
    from: "2026-10-01",
    to: "2026-10-23",
    tiers: HARVEST_TIERS.map((xp, i) => ({ tier: i + 1, xp })),
  },
];

/**
 * Admin override: pretend an event is running, whatever the date.
 *
 * Kept in localStorage beside the debug-mode flag, and read by
 * `activeEvent()` — so every screen, the pass, the wardrobe and the theme
 * all follow it without knowing it exists. It only ever *adds* an event:
 * it cannot hide one that is genuinely running, and it changes nothing on
 * the server, so XP earned under it is real XP on a real event.
 */
const SIM_KEY = "plantgo_event_sim";

export const eventSim = {
  /** The simulated event's id, or "" when the calendar decides. */
  get() {
    try { return localStorage.getItem(SIM_KEY) || ""; } catch { return ""; }
  },
  set(eventId) {
    try {
      if (eventId) localStorage.setItem(SIM_KEY, eventId);
      else localStorage.removeItem(SIM_KEY);
    } catch { /* private mode: the override simply does not stick */ }
  },
};

/** `YYYY-MM-DD` for a local date, matching dailyQuests' todayKey(). */
function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getEvent(eventId) {
  return EVENTS.find((e) => e.id === eventId) ?? null;
}

export function isEventLive(event, now = new Date()) {
  if (!event) return false;
  const today = dayKey(now);
  return today >= event.from && today < event.to;
}

/**
 * The event running right now, or null. Only one runs at a time.
 * An admin override wins over the calendar; the returned event carries
 * `simulated: true` so the UI can say so rather than quietly lying.
 */
export function activeEvent(now = new Date()) {
  const forced = getEvent(eventSim.get());
  // The override wins outright, live or not. It used to fall through to the
  // calendar whenever the forced event happened to be running — harmless
  // with one event, since the calendar then returned that same event, but
  // with two overlapping windows it silently handed back the *first* live
  // entry rather than the one asked for, so the admin picker could not
  // choose between them during the overlap. `simulated` still marks only the
  // case the UI has to be honest about: an event shown outside its window.
  if (forced) return isEventLive(forced, now) ? forced : { ...forced, simulated: true };
  return EVENTS.find((e) => isEventLive(e, now)) ?? null;
}

/**
 * Whole days left, counting today as one. 0 once the window has closed —
 * except for a simulated event, which reports its full length, since
 * "0 days left" on an event you just switched on is nonsense.
 */
export function daysLeft(event, now = new Date()) {
  if (!event) return 0;
  const end = new Date(`${event.to}T00:00:00`);
  if (event.simulated) return Math.max(1, Math.round((end - new Date(`${event.from}T00:00:00`)) / 86400000));
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((end - start) / 86400000));
}

/** The token an item's `requires` names for this tier. */
export function tierToken(eventId, tier) {
  return `${eventId}:${tier}`;
}

/**
 * What a `requires` token means, for the wardrobe's captions:
 * { kind: "event", event, tier } for an event token, or null for anything
 * else (a badge id, which the caller resolves against BADGE_DEFINITIONS).
 */
export function tokenInfo(token) {
  if (typeof token !== "string" || !token.includes(":")) return null;
  const [eventId, raw] = token.split(":");
  const event = getEvent(eventId);
  const tier = Number(raw);
  if (!event || !Number.isFinite(tier)) return null;
  return { kind: "event", event, tier };
}

/** The highest tier reached at this much XP (0 = none yet). */
export function tierAt(event, xp) {
  let reached = 0;
  for (const t of event?.tiers ?? []) if (xp >= t.xp) reached = t.tier;
  return reached;
}

/** The next tier and how far it is, or null once the track is finished. */
export function nextTier(event, xp) {
  const next = (event?.tiers ?? []).find((t) => xp < t.xp);
  if (!next) return null;
  const prevXp = event.tiers.find((t) => t.tier === next.tier - 1)?.xp ?? 0;
  const span = Math.max(1, next.xp - prevXp);
  return { ...next, remaining: next.xp - xp, pct: Math.min(1, (xp - prevXp) / span) };
}

/** Every token the player owns, across every event, past and present. */
export function tokensFor(progressByEvent = {}) {
  const tokens = new Set();
  for (const event of EVENTS) {
    const xp = Number(progressByEvent[event.id]?.xp ?? 0);
    for (let tier = 1; tier <= tierAt(event, xp); tier++) tokens.add(tierToken(event.id, tier));
  }
  return tokens;
}

/**
 * Add an observation's points to the running event, if one is running.
 * Returns the tiers this observation crossed, as [{ tier, xp }], so the
 * result modal can announce them; [] when no event is live.
 *
 * The write is an `increment`, so two observations landing together cannot
 * lose each other's XP. The tier is derived from the total rather than
 * stored as a counter, which keeps the read-back honest if a write is
 * retried.
 */
export async function addEventXp(userId, points, now = new Date()) {
  const event = activeEvent(now);
  const gained = Math.max(0, Math.round(Number(points) || 0));
  if (!userId || !event || !gained) return [];

  const ref = doc(db, "users", userId, "events", event.id);
  let before = 0;
  try {
    before = Number((await getDoc(ref)).data()?.xp ?? 0);
  } catch { /* a first observation has nothing to read */ }

  await setDoc(ref, { xp: increment(gained), updatedAt: serverTimestamp() }, { merge: true });

  const after = before + gained;
  return (event.tiers ?? []).filter((t) => t.xp > before && t.xp <= after);
}

/** Live progress on one event: { xp, tier }. Returns an unsubscribe function. */
export function subscribeEventProgress(userId, eventId, callback) {
  return onSnapshot(doc(db, "users", userId, "events", eventId), (snap) => {
    const xp = Number(snap.data()?.xp ?? 0);
    callback({ xp, tier: tierAt(getEvent(eventId), xp) });
  });
}

/**
 * Progress on every event at once, for the wardrobe: it has to know about
 * events that are over as well as the one running, or an item won last
 * October would read as locked. One listener per event, torn down together.
 */
export function subscribeAllEventProgress(userId, callback) {
  const byEvent = {};
  const stops = EVENTS.map((event) =>
    onSnapshot(doc(db, "users", userId, "events", event.id), (snap) => {
      byEvent[event.id] = { xp: Number(snap.data()?.xp ?? 0) };
      callback({ ...byEvent });
    })
  );
  return () => stops.forEach((stop) => stop());
}

/**
 * Dress the page for the running event: `ev-<theme>` on the body, which the
 * stylesheet hangs the event's paper, motif and header tint off. Called by
 * every page's bootstrap, beside `debugMode.init()`. A no-op — and a clean
 * removal — when no event is on.
 */
export function applyEventTheme(now = new Date()) {
  const event = activeEvent(now);
  for (const cls of [...document.body.classList]) {
    if (cls === "is-event" || cls.startsWith("ev-")) document.body.classList.remove(cls);
  }
  // Two classes, on purpose. `is-event` is what every themed rule in the
  // stylesheet hangs off — it is written once and never mentions an event.
  // `ev-<theme>` carries only that event's palette. A new event is a new
  // palette block; no structural CSS is added or changed.
  if (event) document.body.classList.add("is-event", `ev-${event.theme}`);
  return event;
}
