// src/data/rasterChoice.js
// Which raster source the mission map draws from, kept on this device. "auto"
// lets the server use the default where the player stands. A pick that is not
// built where they are is kept anyway: the server falls back for that request,
// and the pick works again once they are back where it is.
const KEY = "plantgo_raster";
export const AUTO_RASTER = "auto";

// Where the pick lives when storage is blocked (private mode): this page only.
let inMemory = null;

export const rasterChoice = {
  get() {
    try { return localStorage.getItem(KEY) || inMemory || AUTO_RASTER; } catch { return inMemory || AUTO_RASTER; }
  },
  set(id) {
    inMemory = id || AUTO_RASTER;
    try { localStorage.setItem(KEY, inMemory); } catch { /* kept in memory above */ }
  },
};
