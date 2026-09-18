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

import { fetchQuizQuestion } from "../api/plantgo.js";
import { attachQuizPhotos } from "../data/quizPhoto.js";
import { t } from "../language/i18n.js";
import { getUserTotalPoints, awardQuizPoints, isQuizDoneToday, markQuizDone } from "../data/user.repo.js";
import {
  renderLanding,
  renderLoading,
  renderError,
  renderQuestion,
  renderScore,
} from "../ui/components/Quiz.view.js";

const POINTS_PER_CORRECT = 200;
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
  renderLoading(container, t("quiz.loading"));

  async function run(userId) {
    // Show landing — tell user if already done today
    renderLoading(container, t("quiz.loading"));
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

    // Fetch today's species to check if quiz is unlocked
    let items;
    try {
      items = await getTodaySpecies(userId);
    } catch (e) {
      console.error("Quiz: failed to fetch observations", e);
      renderError(container, t("quiz.error.fetchObs"));
      return;
    }

    if (items.length < MAX_QUESTIONS) {
      renderLanding(container, { alreadyDone: false, locked: true, currentCount: items.length, onStart: null });
      return;
    }

    renderLanding(container, {
      alreadyDone: false,
      locked: false,
      currentCount: items.length,
      onStart: () => startQuiz(userId, items),
    });
  }

  async function startQuiz(userId, items) {
    const lang = document.documentElement.lang || "en";
    const total = items.length;

    // A question is not ready until its pictures are: the photo (and its
    // credit) come from Wikipedia rather than from the backend, so they are
    // resolved right after the question arrives, as part of the same fetch.
    const loadQuestion = (item) => fetchQuizQuestion({ item, lang }).then(attachQuizPhotos);

    // Fetch first question before showing anything
    renderLoading(container, t("quiz.loadingQuestions"));
    let firstQuestion;
    try {
      firstQuestion = await loadQuestion(items[0]);
    } catch (e) {
      console.error("Quiz: failed to fetch first question", e);
      renderError(container, t("quiz.error.fetchQuiz"));
      return;
    }

    if (!firstQuestion) {
      renderError(container, t("quiz.error.fetchQuiz"));
      return;
    }

    // First question ready — lock quiz for today
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

    // First question received — kick off ALL remaining fetches in parallel
    const questionPromises = [Promise.resolve(firstQuestion)];
    for (let j = 1; j < total; j++) {
      const idx = j;
      questionPromises[j] = loadQuestion(items[idx])
        .catch((e) => {
          console.error(`Quiz: failed to fetch question ${idx + 1}`, e);
          return null;
        });
    }

    // Run questions — each one is likely already fetched by the time user reaches it.
    // The HUD carries the running score and streak; the view only shows them.
    const game = { score: 0, streak: 0, bestStreak: 0, results: [] };
    let correctCount = 0;
    for (let i = 0; i < total; i++) {
      const question = await questionPromises[i];
      if (!question) break;
      const correct = await renderQuestion(container, question, i, total, { ...game, pointsPerCorrect: POINTS_PER_CORRECT });
      game.results.push(correct);
      if (correct) {
        correctCount++;
        game.score += POINTS_PER_CORRECT;
        game.streak++;
        game.bestStreak = Math.max(game.bestStreak, game.streak);
      } else {
        game.streak = 0;
      }
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

    renderScore(container, correctCount, total, {
      currentTotalBefore,
      pointsEarned,
      bestStreak: game.bestStreak,
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
