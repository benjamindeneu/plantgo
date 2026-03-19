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
import {
  renderLoading,
  renderError,
  renderEmpty,
  renderQuestion,
  renderScore,
} from "../ui/components/Quiz.view.js";

/** Fetch today's observations (with gbif_id) for the current user */
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
  return items;
}

export function QuizController(container) {
  let correctCount = 0;
  let questions = [];

  async function run(userId) {
    renderLoading(container, t("quiz.loading"));

    let items;
    try {
      items = await getTodaySpecies(userId);
    } catch (e) {
      console.error("Quiz: failed to fetch observations", e);
      renderError(container, t("quiz.error.fetchObs"));
      return;
    }

    if (items.length === 0) {
      renderEmpty(container);
      return;
    }

    const lang = document.documentElement.lang || "en";

    renderLoading(container, t("quiz.loadingQuestions"));

    try {
      questions = await fetchQuiz({ items, lang });
    } catch (e) {
      console.error("Quiz: failed to fetch quiz", e);
      renderError(container, t("quiz.error.fetchQuiz"));
      return;
    }

    if (!questions || questions.length === 0) {
      renderEmpty(container);
      return;
    }

    correctCount = 0;
    for (let i = 0; i < questions.length; i++) {
      const correct = await renderQuestion(container, questions[i], i, questions.length);
      if (correct) correctCount++;
    }

    renderScore(container, correctCount, questions.length);
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      location.replace("./login.html");
      return;
    }
    run(user.uid);
  });
}
