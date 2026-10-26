// src/data/quizSpecies.js
import { db } from "../../firebase-config.js";
import {
  collection, getDocs, query, where, orderBy, limit, startAfter,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

export const QUIZ_SIZE = 10;
const PAGE_SIZE = 100;

// One quiz item per species: the first observation of it met wins, and
// low-confidence ones are left out — not validated, so not something to be
// quizzed (and paid) on.
function addSpecies(items, seen, docs) {
  for (const doc of docs) {
    const data = doc.data();
    if (!data.gbif_id || !data.speciesName) continue;
    if (data.lowConfidence) continue;
    if (seen.has(data.speciesName)) continue;
    seen.add(data.speciesName);
    items.push({ gbif_id: Number(data.gbif_id), name: data.speciesName, vernacular: data.vernacularName || null });
  }
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Today's distinct species, up to QUIZ_SIZE of them picked at random. */
export async function getTodaySpecies(userId) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const snap = await getDocs(query(
    collection(db, "users", userId, "observations"),
    where("observedAt", ">=", startOfToday),
    orderBy("observedAt", "desc"),
  ));

  const items = [];
  addSpecies(items, new Set(), snap.docs);
  if (items.length > QUIZ_SIZE) shuffle(items).splice(QUIZ_SIZE);
  return items;
}

/**
 * The last QUIZ_SIZE distinct species observed, whatever the day, read back
 * from the newest observation a page at a time until enough are found or
 * there are no more. Fewer than QUIZ_SIZE means the player has not observed
 * that many species at all.
 */
export async function getRecentSpecies(userId) {
  const ref = collection(db, "users", userId, "observations");
  const items = [];
  const seen = new Set();
  let after = null;
  while (items.length < QUIZ_SIZE) {
    const constraints = [orderBy("observedAt", "desc"), limit(PAGE_SIZE)];
    if (after) constraints.push(startAfter(after));
    const snap = await getDocs(query(ref, ...constraints));
    addSpecies(items, seen, snap.docs);
    if (snap.docs.length < PAGE_SIZE) break;
    after = snap.docs[snap.docs.length - 1];
  }
  return shuffle(items.slice(0, QUIZ_SIZE));
}

/**
 * Field lab: the species for a quiz made on demand. Today's, when there are
 * enough of them, as the daily quiz would have it; otherwise the last ones
 * observed on any day. Throws `not-enough-species` when the player has fewer
 * than QUIZ_SIZE distinct species in all.
 */
export async function getGeneratedQuizSpecies(userId) {
  const today = await getTodaySpecies(userId);
  if (today.length >= QUIZ_SIZE) return today;
  const recent = await getRecentSpecies(userId);
  if (recent.length < QUIZ_SIZE) {
    const e = new Error(`Only ${recent.length} distinct species observed`);
    e.code = "not-enough-species";
    throw e;
  }
  return recent;
}
