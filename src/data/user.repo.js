// src/data/user.repo.js
import { auth, db } from "../../firebase-config.js";
import { doc, getDoc, updateDoc, increment, serverTimestamp, deleteField } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { fetchMe } from "../api/plantgo.js";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function isQuizDoneToday(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.data()?.quiz_last_date === todayKey();
}

export async function markQuizDone(uid) {
  await updateDoc(doc(db, "users", uid), { quiz_last_date: todayKey() });
}

/**
 * A quiz in progress: the day's species, the questions fetched so far and
 * the answers given, so that closing the page mid-way and coming back
 * resumes at the same question rather than meeting "already done".
 *
 * Kept as one JSON string: the questions carry nested objects and the odd
 * undefined, and Firestore accepts neither arrays in arrays nor undefined.
 * It is only ever read back by the same code that wrote it.
 */
export async function getQuizProgress(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  const p = snap.data()?.quiz_progress;
  if (!p || p.date !== todayKey() || !p.json) return null;
  try { return JSON.parse(p.json); } catch { return null; }
}

export async function saveQuizProgress(uid, progress) {
  await updateDoc(doc(db, "users", uid), {
    quiz_progress: { date: todayKey(), json: JSON.stringify(progress) },
  });
}

/**
 * Field lab: today's lock and any quiz in progress go, replaced by a quiz on
 * `items` that has not been started — the quiz page offers it as today's.
 */
export async function generateQuiz(uid, items) {
  await updateDoc(doc(db, "users", uid), {
    quiz_last_date: deleteField(),
    quiz_progress: { date: todayKey(), json: JSON.stringify({ items, generated: true }) },
  });
}

/** The `admin` field on the user doc, and only `true` counts; absent is false. */
export async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await getDoc(doc(db, "users", uid));
  return snap.data()?.admin === true;
}

/**
 * Whether the signed-in player is a field tester. Asked of the server, which
 * keeps the list (the user doc is the player's to write) and is the one that
 * serves testers more; false when it cannot be asked.
 */
export async function isTester() {
  try {
    return (await fetchMe())?.tester === true;
  } catch {
    return false;
  }
}

export async function getCurrentUser() {
  return auth.currentUser ?? null;
}

export async function getUserTotalPoints(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return Number(snap.data()?.total_points ?? 0);
}

// UPDATED: added missionsModel
export async function saveSpeciesAndMissions(uid, speciesList = [], missionsList = [], missionsModel = "") {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, {
    species_list: speciesList,
    missions_list: missionsList,
    missions_model: missionsModel,
    last_species_fetch: serverTimestamp(),
  });
}

/**
 * The missions the player is currently standing in.
 *
 * Kept apart from `missions_list` (the old home page's area cache) because it
 * answers a different question: not "what is near me" but "what could I
 * complete with the next photo I take".
 */
export async function saveMissionsHere(uid, missions = []) {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { missions_here: missions });
}

export async function awardQuizPoints(uid, points) {
  if (!points) return;
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { total_points: increment(points) });
}


export async function getCachedMissions(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : {};
}
