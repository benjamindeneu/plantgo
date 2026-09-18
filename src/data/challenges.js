// src/data/challenges.js
import { auth, db } from "../../firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  orderBy,
  limit,
  onSnapshot,
  increment,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

function makeCode(len = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < len; i++) s += chars[buf[i] % chars.length];
  return s;
}

async function getMyDisplayName() {
  const u = auth.currentUser;
  if (!u) return "Player";

  // try users/{uid}.username
  try {
    const snap = await getDoc(doc(db, "users", u.uid));
    const data = snap.exists() ? snap.data() : null;
    if (data?.username && String(data.username).trim()) return String(data.username).trim();
  } catch {}

  if (u.displayName) return u.displayName;

  const email = u.email || "";
  if (email.includes("@")) return email.split("@")[0];

  return "Player";
}

export async function findChallengeByCode(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;

  const q = query(collection(db, "challenges"), where("code", "==", c));
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/**
 * Writes users/{uid}.activeChallenge pointer
 */
async function setUserActiveChallenge(uid, payloadOrNull) {
  const userRef = doc(db, "users", uid);
  if (!payloadOrNull) {
    await updateDoc(userRef, { activeChallenge: null });
    return;
  }
  await updateDoc(userRef, { activeChallenge: payloadOrNull });
}

// Get current user's activeChallenge pointer (or null)
export async function getMyActiveChallenge() {
  const u = auth.currentUser;
  if (!u) return null;

  const snap = await getDoc(doc(db, "users", u.uid));
  if (!snap.exists()) return null;

  return snap.data()?.activeChallenge || null;
}

// Clear current user's activeChallenge pointer
export async function clearMyActiveChallenge() {
  const u = auth.currentUser;
  if (!u) return;
  await updateDoc(doc(db, "users", u.uid), { activeChallenge: null });
}

/**
 * Optional helper: if user's activeChallenge is expired, clear it.
 * Call on app start or on Challenge panel init.
 */
export async function maybeClearExpiredActiveChallenge(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return;
  const ac = snap.data()?.activeChallenge;
  const endMs = ac?.endAt?.toMillis ? ac.endAt.toMillis() : null;
  if (endMs && Date.now() > endMs) {
    await setUserActiveChallenge(uid, null);
  }
}

export async function createChallenge({ durationSec, type = "points", speciesList = [] }) {
  const u = auth.currentUser;
  if (!u) throw new Error("Please log in.");

  // Clamp to 10–60min
  const dur = Math.max(600, Math.min(3600, Number(durationSec || 1800)));

  const challengeType = type === "species_hunt" ? "species_hunt" : "points";
  const normalizedSpeciesList = challengeType === "species_hunt"
    ? speciesList.filter(s => s && s.name)
    : [];
  if (challengeType === "species_hunt" && normalizedSpeciesList.length < 2) {
    throw new Error("No species available to create a Species Hunt.");
  }

  // generate unique code
  let code = "";
  for (let i = 0; i < 12; i++) {
    const candidate = makeCode(5);
    const exists = await findChallengeByCode(candidate);
    if (!exists) { code = candidate; break; }
  }
  if (!code) throw new Error("Could not generate a join code. Try again.");

  const now = Date.now();
  const startAt = Timestamp.fromMillis(now);
  const endAt = Timestamp.fromMillis(now + dur * 1000);

  const ref = await addDoc(collection(db, "challenges"), {
    code,
    createdBy: u.uid,
    createdAt: serverTimestamp(),
    startAt,
    endAt,
    status: "active",
    durationSec: dur,
    type: challengeType,
    speciesList: normalizedSpeciesList,
  });

  const username = await getMyDisplayName();

  // member doc with score
  await setDoc(doc(db, "challenges", ref.id, "members", u.uid), {
    uid: u.uid,
    username,
    joinedAt: serverTimestamp(),
    score: 0,
    foundSpecies: [],
  });

  // extract species names + gbif_ids for the activeChallenge pointer (used for fast scoring)
  const speciesNames = normalizedSpeciesList.map(s => s.name);
  const speciesGbifIds = normalizedSpeciesList.map(s => Number(s.gbif_id)).filter(Boolean);

  // set user's active challenge pointer (single active challenge per user)
  await setUserActiveChallenge(u.uid, {
    id: ref.id,
    code,
    startAt,
    endAt,
    type: challengeType,
    speciesNames,
    speciesGbifIds,
  });

  return { challengeId: ref.id, code, startAt, endAt, type: challengeType };
}

export async function joinChallengeByCode(code) {
  const u = auth.currentUser;
  if (!u) throw new Error("Please log in.");

  const challenge = await findChallengeByCode(code);
  if (!challenge) throw new Error("Challenge not found.");

  const endAtMs = challenge?.endAt?.toMillis ? challenge.endAt.toMillis() : null;
  if (endAtMs && Date.now() > endAtMs) throw new Error("This challenge has already ended.");

  const username = await getMyDisplayName();
  const challengeType = challenge.type || "points";
  const speciesList = Array.isArray(challenge.speciesList) ? challenge.speciesList : [];
  const speciesNames = speciesList.map(s => s.name).filter(Boolean);
  const speciesGbifIds = speciesList.map(s => Number(s.gbif_id)).filter(Boolean);

  // First join: create member doc. Re-join: only update username to preserve progress.
  const memberRef = doc(db, "challenges", challenge.id, "members", u.uid);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) {
    await setDoc(memberRef, {
      uid: u.uid,
      username,
      joinedAt: serverTimestamp(),
      score: 0,
      foundSpecies: [],
    });
  } else {
    await updateDoc(memberRef, { username });
  }

  // set active pointer
  await setUserActiveChallenge(u.uid, {
    id: challenge.id,
    code: challenge.code,
    startAt: challenge.startAt,
    endAt: challenge.endAt,
    type: challengeType,
    speciesNames,
    speciesGbifIds,
  });

  return {
    challengeId: challenge.id,
    code: challenge.code,
    startAt: challenge.startAt,
    endAt: challenge.endAt,
    type: challengeType,
  };
}

export function subscribeLeaderboard(challengeId, cb) {
  const qMembers = query(
    collection(db, "challenges", challengeId, "members"),
    orderBy("score", "desc"),
    limit(50)
  );

  return onSnapshot(qMembers, (snap) => {
    cb(snap.docs.map((d) => d.data()));
  });
}

/**
 * Fast O(1) scorer: only checks users/{uid}.activeChallenge
 * and increments the member score if we're inside the window.
 */
export async function applyActiveChallengeScore({
  userId,
  pointsToAdd,
  nowMs = Date.now(),
}) {
  const pts = Number(pointsToAdd || 0);
  if (!pts) return;

  const userSnap = await getDoc(doc(db, "users", userId));
  if (!userSnap.exists()) return;

  const ac = userSnap.data()?.activeChallenge;
  if (!ac?.id) return;

  // Skip points scoring for species_hunt challenges (handled by applySpeciesHuntScore)
  if (ac.type === "species_hunt") return;

  const startMs = ac?.startAt?.toMillis ? ac.startAt.toMillis() : null;
  const endMs = ac?.endAt?.toMillis ? ac.endAt.toMillis() : null;
  if (!startMs || !endMs) return;

  if (nowMs < startMs || nowMs > endMs) return;

  const { increment, updateDoc } =
    await import("https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js");

  const memberRef = doc(db, "challenges", ac.id, "members", userId);
  await updateDoc(memberRef, { score: increment(pts) });
}

/**
 * Species Hunt scorer: checks if speciesName is in the target list,
 * and atomically marks it as found (once per species per player).
 */
export async function applySpeciesHuntScore({
  userId,
  speciesName,
  gbifId = null,
  nowMs = Date.now(),
}) {
  if (!speciesName) return;

  const userSnap = await getDoc(doc(db, "users", userId));
  if (!userSnap.exists()) return;

  const ac = userSnap.data()?.activeChallenge;
  if (!ac?.id || ac.type !== "species_hunt") return;

  const startMs = ac?.startAt?.toMillis ? ac.startAt.toMillis() : null;
  const endMs = ac?.endAt?.toMillis ? ac.endAt.toMillis() : null;
  if (!startMs || !endMs) return;
  if (nowMs < startMs || nowMs > endMs) return;

  // Helper: compare first two words only (genus + species, strips author suffix)
  const binomial = s => String(s).trim().toLowerCase().split(/\s+/).slice(0, 2).join(" ");

  // Check if species is in the target list — prefer gbif_id, fall back to binomial name
  const gbifIdNum = Number(gbifId) || null;
  const gbifIds = Array.isArray(ac.speciesGbifIds) ? ac.speciesGbifIds : [];
  const targetNames = Array.isArray(ac.speciesNames) ? ac.speciesNames : [];

  const isTarget =
    (gbifIdNum && gbifIds.some(id => Number(id) === gbifIdNum)) ||
    targetNames.some(s => binomial(s) === binomial(speciesName));
  if (!isTarget) return;

  // Use a transaction to atomically check + update foundSpecies to prevent double-counting
  const memberRef = doc(db, "challenges", ac.id, "members", userId);
  await runTransaction(db, async (txn) => {
    const memberSnap = await txn.get(memberRef);
    if (!memberSnap.exists()) return;

    const foundSpecies = memberSnap.data()?.foundSpecies || [];
    const foundGbifIds = memberSnap.data()?.foundGbifIds || [];

    const alreadyFound =
      (gbifIdNum && foundGbifIds.some(id => Number(id) === gbifIdNum)) ||
      foundSpecies.some(s => binomial(s) === binomial(speciesName));
    if (alreadyFound) return;

    const update = {
      foundSpecies: [...foundSpecies, speciesName],
      score: (memberSnap.data().score || 0) + 1,
    };
    if (gbifIdNum) update.foundGbifIds = [...foundGbifIds, gbifIdNum];

    txn.update(memberRef, update);
  });
}


// ── the end of a challenge ───────────────────────────────────────────────────

/**
 * What a place on the podium is worth. Only the podium pays: the species
 * found along the way were already paid for as observations.
 */
export const PODIUM_POINTS = [1000, 600, 300];

/**
 * Standings from leaderboard rows (already sorted by score, descending).
 * Equal scores share a place and the next place is skipped — two players
 * on 7 are both 1st and the next is 3rd — so a tie never robs anyone.
 * Returns [{ uid, username, score, rank }].
 */
export function standings(rows = []) {
  const sorted = [...rows].sort((a, b) => (b.score || 0) - (a.score || 0));
  let rank = 0;
  let prevScore = null;
  return sorted.map((r, i) => {
    const score = r.score || 0;
    if (score !== prevScore) { rank = i + 1; prevScore = score; }
    return { uid: r.uid, username: r.username || "—", score, rank };
  });
}

/**
 * Settle an ended challenge for the signed-in player: their place, the
 * points it earns and a record of it, written once. Runs as a transaction
 * on the player's own history document, so a second call — another tab,
 * another day — finds the record and returns it instead of paying twice.
 *
 * Podium points need company: a hunt with one player, or a place earned
 * with nothing found, pays nothing.
 *
 * Returns { rank, players, score, found, total, points, challengesPlayed,
 *           challengesWon, settledNow }.
 */
export async function settleChallenge({ challengeId, code, type, rows, found = 0, total = 0 }) {
  const u = auth.currentUser;
  if (!u || !challengeId) return null;

  const table = standings(rows);
  const me = table.find((r) => r.uid === u.uid);
  if (!me) return null;

  const players = table.length;
  const paid = players >= 2 && me.score > 0 ? (PODIUM_POINTS[me.rank - 1] || 0) : 0;

  const userRef = doc(db, "users", u.uid);
  const histRef = doc(db, "users", u.uid, "challengeHistory", challengeId);

  return runTransaction(db, async (txn) => {
    const [histSnap, userSnap] = await Promise.all([txn.get(histRef), txn.get(userRef)]);
    const user = userSnap.data() || {};
    if (histSnap.exists()) {
      const h = histSnap.data();
      return {
        ...h,
        challengesPlayed: Number(user.total_challenges || 0),
        challengesWon: Number(user.total_challenge_wins || 0),
        settledNow: false,
      };
    }
    const record = {
      challengeId,
      code: code || "",
      type: type || "species_hunt",
      endedAt: serverTimestamp(),
      rank: me.rank,
      players,
      score: me.score,
      found,
      total,
      points: paid,
      won: me.rank === 1 && paid > 0,
    };
    txn.set(histRef, record);
    txn.update(userRef, {
      total_points: increment(paid),
      total_challenges: increment(1),
      total_challenge_wins: increment(record.won ? 1 : 0),
    });
    return {
      ...record,
      challengesPlayed: Number(user.total_challenges || 0) + 1,
      challengesWon: Number(user.total_challenge_wins || 0) + (record.won ? 1 : 0),
      settledNow: true,
    };
  });
}

/** The player's past challenges, newest first. */
export async function listChallengeHistory(uid, max = 30) {
  if (!uid) return [];
  const q = query(
    collection(db, "users", uid, "challengeHistory"),
    orderBy("endedAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const h = d.data();
    return { ...h, endedAtMs: h.endedAt?.toMillis ? h.endedAt.toMillis() : null };
  });
}
