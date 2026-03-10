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
 * nameKey / descKey are i18n keys resolved at render time.
 */
export const BADGE_DEFINITIONS = [
  { id: "obs_1",       emoji: "🌱", nameKey: "badges.obs1.name",       descKey: "badges.obs1.desc",       countKey: "obs",     threshold: 1 },
  { id: "obs_100",     emoji: "🌿", nameKey: "badges.obs100.name",     descKey: "badges.obs100.desc",     countKey: "obs",     threshold: 100 },
  { id: "obs_1000",    emoji: "🌳", nameKey: "badges.obs1000.name",    descKey: "badges.obs1000.desc",    countKey: "obs",     threshold: 1000 },
  { id: "mission_1",   emoji: "🎯", nameKey: "badges.mission1.name",   descKey: "badges.mission1.desc",   countKey: "mission", threshold: 1 },
  { id: "mission_10",  emoji: "🏹", nameKey: "badges.mission10.name",  descKey: "badges.mission10.desc",  countKey: "mission", threshold: 10 },
  { id: "mission_100", emoji: "🏆", nameKey: "badges.mission100.name", descKey: "badges.mission100.desc", countKey: "mission", threshold: 100 },
  { id: "releve_1",    emoji: "🔬", nameKey: "badges.releve1.name",    descKey: "badges.releve1.desc",    countKey: null,      threshold: null },
];

/**
 * Check which badges should be unlocked given current counts,
 * persist any newly unlocked ones, and return their IDs.
 *
 * @param {string} userId
 * @param {{ obsCount?: number, missionObsCount?: number, hasReleve?: boolean }} counts
 * @returns {Promise<string[]>} newly unlocked badge IDs
 */
export async function checkAndUnlockBadges(userId, { obsCount = 0, missionObsCount = 0, hasReleve = false } = {}) {
  const triggered = [];

  if (obsCount >= 1)    triggered.push("obs_1");
  if (obsCount >= 100)  triggered.push("obs_100");
  if (obsCount >= 1000) triggered.push("obs_1000");

  if (missionObsCount >= 1)   triggered.push("mission_1");
  if (missionObsCount >= 10)  triggered.push("mission_10");
  if (missionObsCount >= 100) triggered.push("mission_100");

  if (hasReleve) triggered.push("releve_1");

  if (!triggered.length) return [];

  // Read which badges are already unlocked
  const badgesCol = collection(db, "users", userId, "badges");
  const snap = await getDocs(badgesCol);
  const alreadyUnlocked = new Set(snap.docs.map((d) => d.id));

  const newlyUnlocked = triggered.filter((id) => !alreadyUnlocked.has(id));

  // Persist newly unlocked badges
  for (const id of newlyUnlocked) {
    await setDoc(doc(db, "users", userId, "badges", id), { unlockedAt: serverTimestamp() });
  }

  return newlyUnlocked;
}

/**
 * One-time retroactive scan for existing accounts.
 * Counts real Firestore data, syncs the counter fields on the user doc,
 * and unlocks any badges the user already earned before the badge system existed.
 * Guarded by a `badgesRetroChecked` flag so it only runs once per account.
 *
 * @returns {Promise<string[]>} newly unlocked badge IDs (empty if already done)
 */
export async function checkRetroactiveBadges(userId) {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.data()?.badgesRetroChecked) return [];

  const obsCol = collection(db, "users", userId, "observations");

  // Count all observations
  const totalObsSnap = await getCountFromServer(obsCol);
  const obsCount = totalObsSnap.data().count;

  // Count observations that were part of a mission (bonus.mission > 0)
  const missionObsSnap = await getCountFromServer(
    query(obsCol, where("bonus.mission", ">", 0))
  );
  const missionObsCount = missionObsSnap.data().count;

  // Check if the inventory (relevé) quest was ever completed
  const completionsCol = collection(db, "users", userId, "dailyQuestCompletions");
  const completionsSnap = await getDocs(completionsCol);
  const hasReleve = completionsSnap.docs.some(
    (d) => (d.data().completedIds ?? []).includes("inventory")
  );

  // Persist real counters so future increments are accurate, mark retro as done
  await updateDoc(userRef, {
    total_observations: obsCount,
    total_mission_observations: missionObsCount,
    badgesRetroChecked: true,
  });

  return checkAndUnlockBadges(userId, { obsCount, missionObsCount, hasReleve });
}

/**
 * Subscribe to the user's unlocked badges in real-time.
 * Calls callback with a Set<string> of unlocked badge IDs whenever it changes.
 * Returns an unsubscribe function.
 */
export function subscribeBadges(userId, callback) {
  const badgesCol = collection(db, "users", userId, "badges");
  return onSnapshot(badgesCol, (snap) => {
    const unlocked = new Set(snap.docs.map((d) => d.id));
    callback(unlocked);
  });
}
