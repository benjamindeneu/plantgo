// src/data/observations.js
import { auth, db } from "../../firebase-config.js";
import {
  collection, addDoc, doc, getDoc, setDoc, updateDoc,
  serverTimestamp, GeoPoint, increment
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

/**
 * Save observation and discovery (if first time).
 * - observation.total_points = base observation points (backend `points.total`)
 * - user.total_points increment includes base + discovery bonus (+ optional extraBonus e.g. mission)
 * - Adds gbif_id, plantnetImageCode, plantnet_identify_score, location, observedAt
 *
 * Returns: { observationId, discoveryBonus }
 */
export async function addObservationAndDiscovery({
  userId,
  speciesName,
  lat,
  lon,
  plantnetImageCode,
  plantnet_identify_score,
  gbif_id,
  pointsMap,         // backend points.detail (mapping)
  total_points,      // backend points.total
  extraBonus = 0,    // e.g. +500 for mission species
}) {
  const observationsRef = collection(db, "users", userId, "observations");

  const observationData = {
    speciesName,
    observedAt: serverTimestamp(),
    location: new GeoPoint(lat, lon),
    plantnetImageCode,
    plantnet_identify_score,
    total_points,        // base observation points (no client bonuses)
    points: pointsMap || {},
    gbif_id: gbif_id ?? null,
  };

  const observationDoc = await addDoc(observationsRef, observationData);

  // Discovery doc (first time only)
  const discoveryRef = doc(db, "users", userId, "discoveries", speciesName);
  const discoverySnap = await getDoc(discoveryRef);

  let discoveryBonus = 0;
  if (!discoverySnap.exists()) {
    discoveryBonus = 500;
    await setDoc(discoveryRef, {
      speciesName,
      discoveredAt: serverTimestamp(),
      location: new GeoPoint(lat, lon),
      observationId: observationDoc.id,
    });
  }

  // Update user's total_points: base + discovery + extra (mission) bonus
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    total_points: increment(Number(total_points || 0) + discoveryBonus + Number(extraBonus || 0)),
  });

  return { observationId: observationDoc.id, discoveryBonus };
}
