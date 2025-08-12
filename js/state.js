// state.js
// Purpose: central app state. Keep fields you already use.

export const state = {
  user: null,
  level: 1,
  progress: 0,        // 0–100
  totalPoints: 0,
  photoFiles: [],
  geo: null,          // { lat, lon }
  speciesList: [],    // cached from result_pred.species
  missionsList: [],   // cached from result.species
};

// Setters (no behavior change)
export const setUser = (u) => (state.user = u);
export const setLevel = (lv) => (state.level = lv);
export const setProgress = (p) => (state.progress = p);
export const setTotalPoints = (p) => (state.totalPoints = p);
export const setGeo = (g) => (state.geo = g);
export const setSpeciesList = (list) => (state.speciesList = list || []);
export const setMissionsList = (list) => (state.missionsList = list || []);
