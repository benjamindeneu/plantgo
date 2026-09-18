// src/data/user.repo.js
import { auth, db } from "../../firebase-config.js";
import { doc, getDoc, updateDoc, increment, serverTimestamp, deleteField } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

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

export async function clearQuizProgress(uid) {
  await updateDoc(doc(db, "users", uid), { quiz_progress: deleteField() });
}

/** Admin: today's lock and any quiz in progress go, so the quiz can be played again. */
export async function resetQuiz(uid) {
  await updateDoc(doc(db, "users", uid), { quiz_last_date: deleteField(), quiz_progress: deleteField() });
}

/** The `admin` field on the user doc, and only `true` counts; absent is false. */
export async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await getDoc(doc(db, "users", uid));
  return snap.data()?.admin === true;
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
