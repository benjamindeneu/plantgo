// src/data/identifierChoice.js
// Which image identifier the player picked, kept on this device. "auto" lets
// the server use the default where they stand. A pick that does not run
// where they are is kept anyway: the server falls back for that request, and
// the pick works again once they are back where it does.
const KEY = "plantgo_identifier";
export const AUTO_IDENTIFIER = "auto";

// Where the pick lives when storage is blocked (private mode): this page only.
let inMemory = null;

export const identifierChoice = {
  get() {
    try { return localStorage.getItem(KEY) || inMemory || AUTO_IDENTIFIER; } catch { return inMemory || AUTO_IDENTIFIER; }
  },
  set(id) {
    inMemory = id || AUTO_IDENTIFIER;
    try { localStorage.setItem(KEY, inMemory); } catch { /* kept in memory above */ }
  },
};
