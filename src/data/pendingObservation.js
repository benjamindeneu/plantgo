// src/data/pendingObservation.js
//
// An observation made on the public mission page, before its author had an
// account. It waits in this browser until they sign up or log in, and the
// front page then files it under their name — so "join to save this
// observation" is a promise the page actually keeps.
//
// Only the stash and the lookup live at the top level: the mission page runs
// without Firebase, so the saving half is imported on demand.

const KEY = "plantgo.pendingObservation";
// Long enough to sign up on the way home from a walk, short enough that a
// stale photo code does not surface on a shared computer weeks later.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Keep one observation for later. A newer one replaces it: the page invites
 * the visitor to save the photo they just took, not a queue of them.
 * `obs` is the argument list of `addObservationAndDiscovery`, minus the user,
 * plus `missionId` when it accomplished the mission.
 */
export function stashPendingObservation(obs) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...obs, stashedAt: Date.now() }));
  } catch { /* private mode or storage full: the invitation still stands */ }
}

function readPending() {
  try {
    const obs = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!obs) return null;
    if (!(Date.now() - obs.stashedAt < MAX_AGE_MS)) {
      localStorage.removeItem(KEY);
      return null;
    }
    return obs;
  } catch {
    return null;
  }
}

/**
 * Save the waiting observation, if there is one, to this user's account.
 * Returns what was saved and what it earned, or null when nothing was waiting.
 *
 * The stash is removed before the write, not after: a failed save loses the
 * observation, but a retried one would count it twice.
 */
export async function claimPendingObservation(uid) {
  const obs = readPending();
  if (!obs || !uid) return null;
  try { localStorage.removeItem(KEY); } catch { /* noop */ }

  const [{ addObservationAndDiscovery }, { getMissionsDoneToday, markMissionDone }] = await Promise.all([
    import("./observations.js"),
    import("./missionsDone.js"),
  ]);

  // A mission pays once a day. Someone who already had an account may have
  // done this one today from the app itself.
  const missionCounts = !!obs.missionId
    && !(await getMissionsDoneToday(uid).catch(() => new Set())).has(obs.missionId);
  const extraBonus = missionCounts ? Number(obs.missionBonus || 0) : 0;
  const result = await addObservationAndDiscovery({
    userId: uid,
    speciesName: obs.speciesName,
    lat: obs.lat,
    lon: obs.lon,
    plantnetImageCode: obs.plantnetImageCode || "",
    plantnet_identify_score: obs.score,
    gbif_id: obs.gbif_id ?? null,
    vernacularName: obs.vernacularName || null,
    pointsMap: obs.pointsMap || {},
    total_points: Number(obs.basePoints || 0),
    extraBonus,
  });
  if (missionCounts) await markMissionDone(uid, obs.missionId);

  // A nearby duplicate keeps only its base points, but still pays the mission.
  const earned = extraBonus + (result.isNearbyDuplicate
    ? Number(result.nearbyPoints ?? 0)
    : Number(obs.basePoints || 0) + Number(result.discoveryBonus || 0));
  return {
    speciesName: obs.speciesName,
    vernacularName: obs.vernacularName || null,
    points: earned,
  };
}
