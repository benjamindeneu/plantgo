// src/data/badges.js
import { db } from "../../firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  getCountFromServer,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

/**
 * All badge definitions (ordered for display).
 * nameKey / descKey  → i18n keys
 * countKey           → key in the counts object passed to the view  (null = binary/no bar)
 * threshold          → unlock threshold for that counter
 * group              → i18n key suffix the badges page files it under (badges.group.*)
 * tier               → ring colour on the badges page: the same common → legendary
 *                      scale the map grades species on, so the top of each
 *                      series reads as the prize it is
 */
export const BADGE_DEFINITIONS = [
  // Observations
  { id: "obs_1",       emoji: "🌱", nameKey: "badges.obs1.name",       descKey: "badges.obs1.desc",       countKey: "obs",         threshold: 1,    group: "observations", tier: "common" },
  { id: "obs_100",     emoji: "🌿", nameKey: "badges.obs100.name",     descKey: "badges.obs100.desc",     countKey: "obs",         threshold: 100,  group: "observations", tier: "rare" },
  { id: "obs_1000",    emoji: "🌳", nameKey: "badges.obs1000.name",    descKey: "badges.obs1000.desc",    countKey: "obs",         threshold: 1000, group: "observations", tier: "epic" },
  // Missions
  { id: "mission_1",   emoji: "🎯", nameKey: "badges.mission1.name",   descKey: "badges.mission1.desc",   countKey: "mission",     threshold: 1,    group: "missions", tier: "common" },
  { id: "mission_10",  emoji: "🏹", nameKey: "badges.mission10.name",  descKey: "badges.mission10.desc",  countKey: "mission",     threshold: 10,   group: "missions", tier: "rare" },
  { id: "mission_100", emoji: "🏆", nameKey: "badges.mission100.name", descKey: "badges.mission100.desc", countKey: "mission",     threshold: 100,  group: "missions", tier: "epic" },
  // Species diversity
  { id: "disc_10",     emoji: "🌺", nameKey: "badges.disc10.name",     descKey: "badges.disc10.desc",     countKey: "discoveries", threshold: 10,   group: "discoveries", tier: "common" },
  { id: "disc_50",     emoji: "🌸", nameKey: "badges.disc50.name",     descKey: "badges.disc50.desc",     countKey: "discoveries", threshold: 50,   group: "discoveries", tier: "rare" },
  { id: "disc_100",    emoji: "🌍", nameKey: "badges.disc100.name",    descKey: "badges.disc100.desc",    countKey: "discoveries", threshold: 100,  group: "discoveries", tier: "epic" },
  { id: "disc_500",    emoji: "🏛️", nameKey: "badges.disc500.name",    descKey: "badges.disc500.desc",    countKey: "discoveries", threshold: 500,  group: "discoveries", tier: "legendary" },
  // Daily quests: relevé + perfect day
  { id: "releve_1",    emoji: "🔬", nameKey: "badges.releve1.name",    descKey: "badges.releve1.desc",    countKey: null,          threshold: null, group: "quests", tier: "rare" },
  { id: "perfect_day", emoji: "🌄", nameKey: "badges.perfectDay.name", descKey: "badges.perfectDay.desc", countKey: null,          threshold: null, group: "quests", tier: "rare" },
  // Rarity
  { id: "epic_obs",       emoji: "💜", nameKey: "badges.epicObs.name",       descKey: "badges.epicObs.desc",       countKey: null, threshold: null, group: "rarity", tier: "epic" },
  { id: "legendary_obs",  emoji: "🥇", nameKey: "badges.legendaryObs.name",  descKey: "badges.legendaryObs.desc",  countKey: null, threshold: null, group: "rarity", tier: "legendary" },
  // Level milestones
  { id: "level_5",  emoji: "⭐", nameKey: "badges.level5.name",  descKey: "badges.level5.desc",  countKey: "level", threshold: 5,  group: "level", tier: "common" },
  { id: "level_10", emoji: "🌟", nameKey: "badges.level10.name", descKey: "badges.level10.desc", countKey: "level", threshold: 10, group: "level", tier: "rare" },
  { id: "level_20", emoji: "💫", nameKey: "badges.level20.name", descKey: "badges.level20.desc", countKey: "level", threshold: 20, group: "level", tier: "legendary" },
];

/** Display order of the groups on the badges page. */
export const BADGE_GROUPS = ["observations", "missions", "discoveries", "quests", "rarity", "level"];

/**
 * Check which badges should be unlocked given current counts,
 * persist any newly unlocked ones, and return their IDs.
 */
export async function checkAndUnlockBadges(userId, {
  obsCount = 0,
  missionObsCount = 0,
  hasReleve = false,
  discoveriesCount = 0,
  hasPerfectDay = false,
  hasEpicObs = false,
  hasLegendaryObs = false,
  level = 1,
} = {}) {
  const triggered = [];

  if (obsCount >= 1)    triggered.push("obs_1");
  if (obsCount >= 100)  triggered.push("obs_100");
  if (obsCount >= 1000) triggered.push("obs_1000");

  if (missionObsCount >= 1)   triggered.push("mission_1");
  if (missionObsCount >= 10)  triggered.push("mission_10");
  if (missionObsCount >= 100) triggered.push("mission_100");

  if (hasReleve)    triggered.push("releve_1");

  if (discoveriesCount >= 10)  triggered.push("disc_10");
  if (discoveriesCount >= 50)  triggered.push("disc_50");
  if (discoveriesCount >= 100) triggered.push("disc_100");
  if (discoveriesCount >= 500) triggered.push("disc_500");

  if (hasPerfectDay)   triggered.push("perfect_day");
  if (hasEpicObs)      triggered.push("epic_obs");
  if (hasLegendaryObs) triggered.push("legendary_obs");

  if (level >= 5)  triggered.push("level_5");
  if (level >= 10) triggered.push("level_10");
  if (level >= 20) triggered.push("level_20");

  if (!triggered.length) return [];

  // Read which badges are already unlocked
  const badgesCol = collection(db, "users", userId, "badges");
  const snap = await getDocs(badgesCol);
  const alreadyUnlocked = new Set(snap.docs.map((d) => d.id));

  const newlyUnlocked = triggered.filter((id) => !alreadyUnlocked.has(id));

  for (const id of newlyUnlocked) {
    await setDoc(doc(db, "users", userId, "badges", id), { unlockedAt: serverTimestamp() });
  }

  return newlyUnlocked;
}

/**
 * One-time retroactive scan for existing accounts.
 * Counts real Firestore data, syncs counter fields on the user doc,
 * and unlocks any badges the user already earned before the badge system existed.
 * Guarded by `badgesRetroChecked` — runs only once per account.
 */
export async function checkRetroactiveBadges(userId) {
  // Bump this whenever new badge categories are added so existing accounts re-scan.
  const RETRO_VERSION = 2;

  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if ((userSnap.data()?.badgesRetroVersion ?? 0) >= RETRO_VERSION) return [];

  const userData = userSnap.data() || {};
  const obsCol = collection(db, "users", userId, "observations");

  // Count all observations
  const totalObsSnap = await getCountFromServer(obsCol);
  const obsCount = totalObsSnap.data().count;

  // Count mission observations
  const missionObsSnap = await getCountFromServer(query(obsCol, where("bonus.mission", ">", 0)));
  const missionObsCount = missionObsSnap.data().count;

  // Count unique species discovered
  const discCol = collection(db, "users", userId, "discoveries");
  const discSnap = await getCountFromServer(discCol);
  const discoveriesCount = discSnap.data().count;

  // Check for epic / legendary observations (by base points)
  const epicSnap = await getCountFromServer(query(obsCol, where("total_points", ">=", 1000)));
  const hasEpicObs = epicSnap.data().count > 0;

  const legendarySnap = await getCountFromServer(query(obsCol, where("total_points", ">=", 1500)));
  const hasLegendaryObs = legendarySnap.data().count > 0;

  // Scan daily quest completions for relevé and perfect day
  const completionsCol = collection(db, "users", userId, "dailyQuestCompletions");
  const completionsSnap = await getDocs(completionsCol);
  const ALL_QUEST_IDS = ["daily_observations", "inventory", "mission"];
  let hasReleve = false;
  let hasPerfectDay = false;
  for (const d of completionsSnap.docs) {
    const ids = d.data().completedIds ?? [];
    if (ids.includes("inventory")) hasReleve = true;
    if (ALL_QUEST_IDS.every(id => ids.includes(id))) hasPerfectDay = true;
  }

  // Current level from total_points
  const level = Math.floor(1 + (Number(userData.total_points) || 0) / 11000);

  // Persist real counters so future increments are accurate; mark retro as done
  await updateDoc(userRef, {
    total_observations: obsCount,
    total_mission_observations: missionObsCount,
    total_discoveries: discoveriesCount,
    badgesRetroVersion: RETRO_VERSION,
  });

  return checkAndUnlockBadges(userId, {
    obsCount, missionObsCount, hasReleve,
    discoveriesCount, hasPerfectDay, hasEpicObs, hasLegendaryObs, level,
  });
}

/**
 * Subscribe to the user's unlocked badges in real-time.
 * Calls callback with a Set<string> of unlocked badge IDs, and a
 * Map<string, Date|null> of when each was unlocked (null while the server
 * timestamp of a badge unlocked this very session is still pending).
 * Returns an unsubscribe function.
 */
export function subscribeBadges(userId, callback) {
  const badgesCol = collection(db, "users", userId, "badges");
  return onSnapshot(badgesCol, (snap) => {
    const ids = new Set();
    const dates = new Map();
    for (const d of snap.docs) {
      ids.add(d.id);
      const at = d.data()?.unlockedAt;
      dates.set(d.id, typeof at?.toDate === "function" ? at.toDate() : null);
    }
    callback(ids, dates);
  });
}
