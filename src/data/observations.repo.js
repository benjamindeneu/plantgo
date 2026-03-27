// src/data/observations.repo.js
import { db } from "../../firebase-config.js";
import {
  collection, getDocs, query, orderBy, limit, startAfter
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

const PAGE_SIZE = 20;

function docToEntry(d) {
  const data = d.data();
  return {
    id: d.id,
    speciesName: data.speciesName || null,
    observedAt: data.observedAt || null,
    plantnet_identify_score: data.plantnet_identify_score ?? null,
    total_points: data.total_points ?? 0,
    points: data.points || {},
    bonus: data.bonus || {},
    nearbyDuplicate: data.nearbyDuplicate || false,
    location: data.location || null,
  };
}

/**
 * Load a page of observations ordered by date descending.
 * Pass `after` (a Firestore DocumentSnapshot) to get the next page.
 * Returns { entries, lastDoc, hasMore }.
 */
export async function loadObservationsPage(uid, { after = null } = {}) {
  const ref = collection(db, "users", uid, "observations");
  const constraints = [orderBy("observedAt", "desc"), limit(PAGE_SIZE)];
  if (after) constraints.push(startAfter(after));
  const snap = await getDocs(query(ref, ...constraints));

  return {
    entries: snap.docs.map(docToEntry),
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}
