// src/data/observations.js
import { auth, db } from "../../firebase-config.js";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  GeoPoint,
  increment,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

import { applyActiveChallengeScore } from "./challenges.js";

/**
 * Save observation and discovery (if first time).
 * - observation.total_points = BASE obs points (backend points.total)
 * - observation.bonus = { discovery, mission }
 * - user.total_points increment includes base + bonuses
 * - challenge score includes BASE ONLY (no bonuses)
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
  pointsMap,      // backend points.detail (mapping)
  total_points,   // backend points.total (BASE)
  extraBonus = 0, // mission bonus etc
}) {
  const observationsRef = collection(db, "users", userId, "observations");

  const basePoints = Number(total_points || 0);
  const missionBonus = Number(extraBonus || 0);

  // 1) Create observation with base points + initial bonus (discovery unknown yet)
  const observationData = {
    speciesName,
    observedAt: serverTimestamp(),
    location: new GeoPoint(lat, lon),
    plantnetImageCode,
    plantnet_identify_score,
    total_points: basePoints, // BASE only
    points: pointsMap || {},
    gbif_id: gbif_id ?? null,

    // NEW: bonus breakdown (discovery filled after check)
    bonus: {
      discovery: 0,
      mission: missionBonus,
    },
  };

  const observationDoc = await addDoc(observationsRef, observationData);
  const obsRef = doc(db, "users", userId, "observations", observationDoc.id);

  // 2) Discovery doc (first time only)
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

  // 3) Update observation doc with discovery bonus (and keep mission bonus)
  await updateDoc(obsRef, {
    "bonus.discovery": discoveryBonus,
    "bonus.mission": missionBonus,
  });

  // 4) Update user's total_points: base + discovery + mission
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    total_points: increment(basePoints + discoveryBonus + missionBonus),
  });

  // 5) Challenge score: BASE ONLY (no bonuses)
  await applyActiveChallengeScore({
    userId,
    pointsToAdd: basePoints,
    nowMs: Date.now(),
  });

  return { observationId: observationDoc.id, discoveryBonus };
}
