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
  serverTimestamp,
  Timestamp,
  orderBy,
  limit,
  onSnapshot,
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

export async function createChallenge({ durationSec }) {
  const u = auth.currentUser;
  if (!u) throw new Error("Please log in.");

  // Clamp to 10–60min
  const dur = Math.max(600, Math.min(3600, Number(durationSec || 1800)));

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
  });

  const username = await getMyDisplayName();

  // member doc with score
  await setDoc(doc(db, "challenges", ref.id, "members", u.uid), {
    uid: u.uid,
    username,
    joinedAt: serverTimestamp(),
    score: 0,
  });

  // set user's active challenge pointer (single active challenge per user)
  await setUserActiveChallenge(u.uid, {
    id: ref.id,
    code,
    startAt,
    endAt,
  });

  return { challengeId: ref.id, code, startAt, endAt };
}

export async function joinChallengeByCode(code) {
  const u = auth.currentUser;
  if (!u) throw new Error("Please log in.");

  const challenge = await findChallengeByCode(code);
  if (!challenge) throw new Error("Challenge not found.");

  const endAtMs = challenge?.endAt?.toMillis ? challenge.endAt.toMillis() : null;
  if (endAtMs && Date.now() > endAtMs) throw new Error("This challenge has already ended.");

  const username = await getMyDisplayName();

  // ensure member exists
  await setDoc(
    doc(db, "challenges", challenge.id, "members", u.uid),
    { uid: u.uid, username, joinedAt: serverTimestamp(), score: 0 },
    { merge: true }
  );

  // set active pointer
  await setUserActiveChallenge(u.uid, {
    id: challenge.id,
    code: challenge.code,
    startAt: challenge.startAt,
    endAt: challenge.endAt,
  });

  return { challengeId: challenge.id, code: challenge.code, startAt: challenge.startAt, endAt: challenge.endAt };
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

  const startMs = ac?.startAt?.toMillis ? ac.startAt.toMillis() : null;
  const endMs = ac?.endAt?.toMillis ? ac.endAt.toMillis() : null;
  if (!startMs || !endMs) return;

  if (nowMs < startMs || nowMs > endMs) return;

  const { increment, updateDoc } =
    await import("https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js");

  const memberRef = doc(db, "challenges", ac.id, "members", userId);
  await updateDoc(memberRef, { score: increment(pts) });
}
