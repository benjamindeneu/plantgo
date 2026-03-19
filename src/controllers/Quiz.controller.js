// src/controllers/Quiz.controller.js
import { auth, db } from "../../firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

import { fetchQuiz } from "../api/plantgo.js";
import { t } from "../language/i18n.js";
import { getUserTotalPoints, awardQuizPoints, isQuizDoneToday, markQuizDone } from "../data/user.repo.js";
import {
  renderLanding,
  renderLoading,
  renderError,
  renderEmpty,
  renderQuestion,
  renderScore,
} from "../ui/components/Quiz.view.js";

const POINTS_PER_CORRECT = 1000;
const MAX_QUESTIONS = 10;

// ── fetch today's unique species ──────────────────────────────────────────────
async function getTodaySpecies(userId) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const obsRef = collection(db, "users", userId, "observations");
  const q = query(
    obsRef,
    where("observedAt", ">=", startOfToday),
    orderBy("observedAt", "desc")
  );

  const snap = await getDocs(q);

  const seen = new Set();
  const items = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!data.gbif_id || !data.speciesName) continue;
    if (seen.has(data.speciesName)) continue;
    seen.add(data.speciesName);
    items.push({ gbif_id: Number(data.gbif_id), name: data.speciesName });
  }

  // Randomly pick up to MAX_QUESTIONS unique species
  if (items.length > MAX_QUESTIONS) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    items.splice(MAX_QUESTIONS);
  }

  return items;
}

// ── controller ────────────────────────────────────────────────────────────────
export function QuizController(container) {
  async function run(userId) {
    // Show landing — tell user if already done today
    renderLoading(container, "");
    let done = false;
    try {
      done = await isQuizDoneToday(userId);
    } catch (e) {
      console.error("Quiz: could not check completion status", e);
    }

    if (done) {
      renderLanding(container, { alreadyDone: true, onStart: null });
      return;
    }

    renderLanding(container, {
      alreadyDone: false,
      onStart: () => startQuiz(userId),
    });
  }

  async function startQuiz(userId) {
    renderLoading(container, t("quiz.loading"));

    let items;
    try {
      items = await getTodaySpecies(userId);
    } catch (e) {
      console.error("Quiz: failed to fetch observations", e);
      renderError(container, t("quiz.error.fetchObs"));
      return; // not counted as done
    }

    if (items.length === 0) {
      renderEmpty(container);
      return; // not counted as done
    }

    const lang = document.documentElement.lang || "en";
    renderLoading(container, t("quiz.loadingQuestions"));

    let questions;
    try {
      questions = await fetchQuiz({ items, lang });
    } catch (e) {
      console.error("Quiz: failed to fetch quiz", e);
      renderError(container, t("quiz.error.fetchQuiz"));
      return; // not counted as done
    }

    if (!questions || questions.length === 0) {
      renderEmpty(container);
      return; // not counted as done
    }

    // Quiz successfully generated — lock for today
    try {
      await markQuizDone(userId);
    } catch (e) {
      console.error("Quiz: could not save completion date", e);
    }

    // Snapshot current total before awarding points
    let currentTotalBefore = 0;
    try {
      currentTotalBefore = await getUserTotalPoints(userId);
    } catch (e) {
      console.error("Quiz: could not fetch total points", e);
    }

    // Run questions
    let correctCount = 0;
    for (let i = 0; i < questions.length; i++) {
      const correct = await renderQuestion(container, questions[i], i, questions.length);
      if (correct) correctCount++;
    }

    // Award points
    const pointsEarned = correctCount * POINTS_PER_CORRECT;
    if (pointsEarned > 0) {
      try {
        await awardQuizPoints(userId, pointsEarned);
      } catch (e) {
        console.error("Quiz: failed to award points", e);
      }
    }

    renderScore(container, correctCount, questions.length, {
      currentTotalBefore,
      pointsEarned,
    });
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      location.replace("./login.html");
      return;
    }
    run(user.uid);
  });
}
