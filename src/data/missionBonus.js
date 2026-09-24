// src/data/missionBonus.js
//
// Kept apart from missions.repo.js, which reaches Firestore: the public
// mission page scores a find without Firebase on the page at all.

/**
 * What completing a mission is worth, by how hard it was to earn.
 *
 * The tiers are the same four the map grades missions with (shown there as
 * Routine / Important / Major / Critical). A flat 500 for every mission made
 * a critical find worth exactly as much as a routine one, which is the whole
 * point of grading them.
 */
export const MISSION_BONUS_BY_TIER = Object.freeze({
  common:    500,   // Routine
  rare:      750,   // Important
  epic:     1000,   // Major
  legendary: 2000,  // Critical
});

/** The bonus a mission is worth. Unknown or ungraded falls back to Routine. */
export function missionBonusFor(mission) {
  const tier = mission?.grade?.tier;
  return MISSION_BONUS_BY_TIER[tier] ?? MISSION_BONUS_BY_TIER.common;
}
