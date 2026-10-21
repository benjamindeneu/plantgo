// src/data/inatToken.js
const KEY = "plantgo_inat_token";
const SAVED_KEY = "plantgo_inat_token_saved";
const LOGIN_KEY = "plantgo_inat_login";

// iNaturalist's personal token (inaturalist.org/users/api_token) is a JWT that
// lives for 24 hours. Kept on this device only: it opens the player's iNat
// account, and the Firestore user doc is no place for that.
const LIFETIME_MS = 24 * 3600 * 1000;

/**
 * The token out of whatever was pasted: the bare JWT, or the whole page iNat
 * shows ({"api_token":"…"}) — copying everything is easier on a phone.
 */
function extract(raw) {
  const s = String(raw ?? "").trim();
  const m = s.match(/"api_token"\s*:\s*"([^"]+)"/);
  return (m ? m[1] : s).replace(/^Bearer\s+/i, "").trim();
}

function expiryOf(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(part));
    if (typeof exp === "number") return exp * 1000;
  } catch { /* not a JWT we can read — fall back to when it was saved */ }
  const saved = Number(localStorage.getItem(SAVED_KEY));
  return saved ? saved + LIFETIME_MS : null;
}

export const inatToken = {
  get() { return localStorage.getItem(KEY) || ""; },
  /** Saves what was pasted and returns the token kept ("" if there was none). */
  set(raw) {
    const token = extract(raw);
    if (!token) { this.clear(); return ""; }
    localStorage.setItem(KEY, token);
    localStorage.setItem(SAVED_KEY, String(Date.now()));
    localStorage.removeItem(LOGIN_KEY);
    return token;
  },
  clear() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(SAVED_KEY);
    localStorage.removeItem(LOGIN_KEY);
  },
  /** The iNat login the token was checked against, for "Posting as @login". */
  login() { return localStorage.getItem(LOGIN_KEY) || ""; },
  setLogin(login) { if (login) localStorage.setItem(LOGIN_KEY, login); },
  /** { state: "missing" | "expired" | "valid", expiresAt: ms | null } */
  status() {
    const token = this.get();
    if (!token) return { state: "missing", expiresAt: null };
    const expiresAt = expiryOf(token);
    if (expiresAt && expiresAt <= Date.now()) return { state: "expired", expiresAt };
    return { state: "valid", expiresAt };
  },
};
