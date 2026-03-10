// src/data/dailyQuests.js
import { db } from "../../firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { checkAndUnlockBadges } from "./badges.js";

export const QUEST_BONUS = 1000;

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeInventoryProgress(observations) {
  if (observations.length === 0) return 0;
  let maxCluster = 0;
  for (const obs of observations) {
    const loc = obs.location;
    if (!loc) continue;
    const nearbySpecies = new Set([obs.speciesName]);
    for (const other of observations) {
      if (!other.location) continue;
      const dist = haversineMeters(
        loc.latitude, loc.longitude,
        other.location.latitude, other.location.longitude
      );
      if (dist <= 50) nearbySpecies.add(other.speciesName);
    }
    maxCluster = Math.max(maxCluster, nearbySpecies.size);
  }
  return maxCluster;
}

function computeQuestProgress(observations) {
  const observationsCount = observations.length;
  const inventoryCount = computeInventoryProgress(observations);
  const missionCount = observations.filter(o => (o.bonus?.mission ?? 0) > 0).length;

  return [
    {
      id: "daily_observations",
      progress: Math.min(observationsCount, 10),
      goal: 10,
      completed: observationsCount >= 10,
    },
    {
      id: "inventory",
      progress: Math.min(inventoryCount, 5),
      goal: 5,
      completed: inventoryCount >= 5,
    },
    {
      id: "mission",
      progress: Math.min(missionCount, 1),
      goal: 1,
      completed: missionCount >= 1,
    },
  ];
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * After saving an observation, call this to detect newly completed quests,
 * award 1000 pts each, and return their IDs.
 */
export async function checkAndAwardQuestCompletions(userId) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTimestamp = Timestamp.fromDate(startOfToday);

  const snap = await getDocs(query(
    collection(db, "users", userId, "observations"),
    where("observedAt", ">=", startTimestamp)
  ));
  const observations = snap.docs.map(d => d.data());
  const quests = computeQuestProgress(observations);

  const completionRef = doc(db, "users", userId, "dailyQuestCompletions", todayKey());
  const completionSnap = await getDoc(completionRef);
  const alreadyCompleted = completionSnap.exists() ? (completionSnap.data()?.completedIds ?? []) : [];

  const newlyCompleted = quests.filter(q => q.completed && !alreadyCompleted.includes(q.id));

  if (newlyCompleted.length > 0) {
    await setDoc(completionRef, {
      completedIds: [...alreadyCompleted, ...newlyCompleted.map(q => q.id)],
    }, { merge: true });
    await updateDoc(doc(db, "users", userId), {
      total_points: increment(newlyCompleted.length * QUEST_BONUS),
    });
  }

  const hasReleve = newlyCompleted.some(q => q.id === "inventory");
  const newlyUnlockedBadges = hasReleve
    ? await checkAndUnlockBadges(userId, { hasReleve: true })
    : [];

  return { completedQuestIds: newlyCompleted.map(q => q.id), newlyUnlockedBadges };
}

/**
 * Subscribe to daily quest progress for the given user.
 * Calls callback with quest array whenever today's observations change.
 * Returns an unsubscribe function.
 */
export function subscribeDailyQuests(userId, callback) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTimestamp = Timestamp.fromDate(startOfToday);

  const q = query(
    collection(db, "users", userId, "observations"),
    where("observedAt", ">=", startTimestamp)
  );

  return onSnapshot(q, (snap) => {
    const observations = snap.docs.map(d => d.data());
    callback(computeQuestProgress(observations));
  });
}
