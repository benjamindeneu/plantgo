// src/data/discoveries.repo.js
import { db } from "../../firebase-config.js";
import {
  collection, doc, getDoc, getDocs, query, orderBy, documentId
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

/**
 * Load discoveries for a user.
 * Returns [{ name, discoveredAt, gbif_id, vernacularName, observationId }]
 */
export async function loadDiscoveries(uid) {
  const ref = collection(db, "users", uid, "discoveries");
  const qy = query(ref, orderBy(documentId(), "asc"));
  const snap = await getDocs(qy);

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      name: d.id,                 // doc id == speciesName
      discoveredAt: data.discoveredAt,
      gbif_id: data.gbif_id ?? null,
      vernacularName: data.vernacularName || null,
      observationId: data.observationId ?? null,
    };
  });
}

/**
 * The GBIF id behind a discovery.
 *
 * Discoveries made since ids were kept carry their own; older ones only
 * point at the observation that made them, which does have it. One read,
 * only when the species screen is actually opened.
 */
export async function resolveDiscoveryGbifId(uid, entry) {
  if (entry?.gbif_id != null) return entry.gbif_id;
  if (!entry?.observationId) return null;
  try {
    const snap = await getDoc(doc(db, "users", uid, "observations", entry.observationId));
    return snap.data()?.gbif_id ?? null;
  } catch {
    return null;
  }
}
