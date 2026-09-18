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
import {
  getUserTotalPoints, awardQuizPoints, isQuizDoneToday, markQuizDone,
  getQuizProgress, saveQuizProgress,
} from "../data/user.repo.js";
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
    let progress = null;
    try {
      [done, progress] = await Promise.all([isQuizDoneToday(userId), getQuizProgress(userId)]);
    } catch (e) {
      console.error("Quiz: could not check completion status", e);
    }

    // Today's quiz, as it stands: finished, it shows its results again;
    // left mid-way, it picks up at the question it stopped on.
    if (progress?.finished) {
      showResults(container, progress);
      return;
    }
    if (progress?.items?.length && (progress.results?.length ?? 0) < progress.items.length) {
      renderLoading(container, t("quiz.loadingQuestions"));
      await playQuiz(userId, progress);
      return;
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

  // A question is not ready until its pictures are: the photo (and its
  // credit) come from Wikipedia rather than from the backend, so they are
  // resolved right after the question arrives, as part of the same fetch.
  function loadQuestion(item) {
    const lang = document.documentElement.lang || "en";
    return fetchQuizQuestion({ item, lang }).then(attachQuizPhotos);
  }

  // What gets saved: the question as the backend sent it. Photos are looked
  // up again on resume — they come from a cache — so they are not carried.
  function storable(question) {
    const { photo, ...rest } = question;
    if (question.quiz_type === "species_image") {
      rest.choices = Object.fromEntries(
        Object.entries(question.choices).map(([k, { photo: _p, ...c }]) => [k, c])
      );
    }
    return rest;
  }

  async function startQuiz(userId, items) {
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

    const progress = {
      items,
      questions: [storable(firstQuestion)],
      results: [],
      currentTotalBefore,
    };
    try {
      await saveQuizProgress(userId, progress);
    } catch (e) {
      console.error("Quiz: could not save progress", e);
    }

    await playQuiz(userId, progress, firstQuestion);
  }

  /**
   * Play from wherever `progress` stands: fresh from the start screen, or
   * back from a closed tab with some answers already in. Questions already
   * fetched are reused; the rest are fetched now, all in parallel.
   */
  async function playQuiz(userId, progress, firstQuestion = null) {
    const { items } = progress;
    const total = items.length;
    progress.questions ||= [];
    progress.results ||= [];

    const persist = () => saveQuizProgress(userId, progress)
      .catch((e) => console.error("Quiz: could not save progress", e));

    const questionPromises = items.map((item, idx) => {
      if (idx === 0 && firstQuestion) return Promise.resolve(firstQuestion);
      const stored = progress.questions[idx];
      const p = stored
        ? attachQuizPhotos(structuredClone(stored))
        : loadQuestion(item).then((q) => { if (q) progress.questions[idx] = storable(q); return q; });
      return p.catch((e) => {
        console.error(`Quiz: failed to fetch question ${idx + 1}`, e);
        return null;
      });
    });
    // Once every question is in, the whole set is on record, so a later
    // resume has nothing left to generate.
    Promise.all(questionPromises).then(persist);

    // Run questions — each one is likely already fetched by the time user reaches it.
    // The HUD carries the running score and streak; the view only shows them.
    const game = { score: 0, streak: 0, bestStreak: 0, results: [] };
    let correctCount = 0;
    const tally = (correct) => {
      game.results.push(correct);
      if (correct) {
        correctCount++;
        game.score += POINTS_PER_CORRECT;
        game.streak++;
        game.bestStreak = Math.max(game.bestStreak, game.streak);
      } else {
        game.streak = 0;
      }
    };
    progress.results.forEach(tally);

    for (let i = progress.results.length; i < total; i++) {
      const question = await questionPromises[i];
      if (!question) break;
      const correct = await renderQuestion(container, question, i, total, { ...game, pointsPerCorrect: POINTS_PER_CORRECT });
      tally(correct);
      progress.results.push(correct);
      await persist();
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

    // Over — whether played out or cut short. What is kept is the outcome,
    // so that coming back today shows the results rather than a closed door.
    progress.finished = true;
    progress.pointsEarned = pointsEarned;
    progress.bestStreak = game.bestStreak;
    delete progress.questions;
    await persist();

    showResults(container, progress);
  }

  function showResults(container, progress) {
    const total = progress.items?.length || progress.results?.length || 0;
    const correctCount = (progress.results || []).filter(Boolean).length;
    renderScore(container, correctCount, total, {
      currentTotalBefore: progress.currentTotalBefore || 0,
      pointsEarned: progress.pointsEarned || 0,
      bestStreak: progress.bestStreak || 0,
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
