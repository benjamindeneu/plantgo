// src/data/observations.js
import { auth, db } from "../../firebase-config.js";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  GeoPoint,
  increment,
  query,
  where,
  limit,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

import { applyActiveChallengeScore, applySpeciesHuntScore } from "./challenges.js";

const NEARBY_RADIUS_M = 100;

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function hasNearbyObservation(userId, speciesName, lat, lon) {
  const q = query(
    collection(db, "users", userId, "observations"),
    where("speciesName", "==", speciesName),
    limit(100),
  );
  const snap = await getDocs(q);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const d of snap.docs) {
    const data = d.data();
    // Only consider observations made today
    const obsDate = data.observedAt?.toDate?.();
    if (!obsDate || obsDate < startOfToday) continue;
    const loc = data.location;
    if (loc && haversineMeters(lat, lon, loc.latitude, loc.longitude) <= NEARBY_RADIUS_M) {
      return true;
    }
  }
  return false;
}

/**
 * Save observation and discovery (if first time).
 * - observation.total_points = BASE obs points (backend points.total)
 * - observation.bonus = { discovery, mission }
 * - user.total_points increment includes base + bonuses
 * - challenge score includes BASE ONLY (no bonuses)
 * - if a previous observation of the same species exists within 100 m,
 *   only points.baseObs points are awarded (no bonuses, no challenge scoring)
 *
 * Returns: { observationId, discoveryBonus, isNearbyDuplicate }
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

  // Proximity check — if same species already observed within 100 m, limit scoring
  const isNearbyDuplicate = await hasNearbyObservation(userId, speciesName, lat, lon);

  if (isNearbyDuplicate) {
    // Only base obs points — no discovery (it's a duplicate), no rarity bonuses
    const nearbyPoints = Number(pointsMap?.["points.baseObs"] ?? 0);

    const observationDoc = await addDoc(observationsRef, {
      speciesName,
      observedAt: serverTimestamp(),
      location: new GeoPoint(lat, lon),
      plantnetImageCode,
      plantnet_identify_score,
      total_points: nearbyPoints,
      points: { "points.baseObs": nearbyPoints },
      gbif_id: gbif_id ?? null,
      bonus: { discovery: 0, mission: missionBonus },
      nearbyDuplicate: true,
    });

    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { total_points: increment(nearbyPoints + missionBonus) });

    // Challenge: base obs points only for points race; species hunt still counts
    await applyActiveChallengeScore({ userId, pointsToAdd: nearbyPoints, nowMs: Date.now() });
    await applySpeciesHuntScore({ userId, speciesName, nowMs: Date.now() });

    return { observationId: observationDoc.id, discoveryBonus: 0, isNearbyDuplicate: true, nearbyPoints };
  }

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

  // 5) Challenge score: BASE ONLY (no bonuses) for points race; species name for species_hunt
  await applyActiveChallengeScore({
    userId,
    pointsToAdd: basePoints,
    nowMs: Date.now(),
  });

  await applySpeciesHuntScore({
    userId,
    speciesName,
    nowMs: Date.now(),
  });

  return { observationId: observationDoc.id, discoveryBonus, isNearbyDuplicate: false };
}
