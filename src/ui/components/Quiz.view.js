// src/ui/components/Quiz.view.js
import { t } from "../../language/i18n.js";

/**
 * Renders a single quiz question and returns a Promise that resolves
 * with true (correct) or false (wrong) when the user picks an answer.
 */
export function renderQuestion(container, question, index, total) {
  return new Promise((resolve) => {
    container.innerHTML = "";

    // Progress
    const progress = document.createElement("div");
    progress.className = "quiz-progress";
    const pct = Math.round((index / total) * 100);
    progress.innerHTML = `
      <div class="quiz-progress-bar" style="width:${pct}%"></div>
      <span class="quiz-progress-label">${index + 1} / ${total}</span>
    `;
    container.appendChild(progress);

    if (question.quiz_type === "species_name") {
      // Show the species photo instead of the name
      const img = document.createElement("img");
      img.className = "quiz-species-img";
      img.alt = question.species_name;
      img.onerror = () => {
        // Fallback to species name text if image fails to load
        img.replaceWith((() => {
          const p = document.createElement("p");
          p.className = "quiz-species-name";
          p.innerHTML = `<em>${question.species_name}</em>`;
          return p;
        })());
      };
      img.src = question.image_url;
      container.appendChild(img);
    } else {
      // Show species name for all other types
      const speciesHeader = document.createElement("p");
      speciesHeader.className = "quiz-species-name";
      speciesHeader.innerHTML = `<em>${question.species_name}</em>`;
      container.appendChild(speciesHeader);
    }

    // Question text — backend sends an i18n key for species_name/species_image
    const isI18nKey = question.quiz_type === "species_name" || question.quiz_type === "species_image";
    const qText = document.createElement("p");
    qText.className = "quiz-question";
    qText.textContent = isI18nKey ? t(question.question) : question.question;
    container.appendChild(qText);

    // Choices
    const choicesEl = document.createElement("div");
    choicesEl.className = question.quiz_type === "species_image"
      ? "quiz-choices quiz-choices--images"
      : "quiz-choices";
    container.appendChild(choicesEl);

    const answered = { done: false };

    const handleAnswer = (key, btn) => {
      if (answered.done) return;
      answered.done = true;

      const correct = key === question.answer;

      // Mark all buttons
      for (const [k, el] of Object.entries(buttons)) {
        if (k === question.answer) {
          el.classList.add("quiz-choice--correct");
        } else if (k === key && !correct) {
          el.classList.add("quiz-choice--wrong");
        }
        el.disabled = true;
      }

      // Feedback text
      const feedback = document.createElement("p");
      feedback.className = correct ? "quiz-feedback quiz-feedback--correct" : "quiz-feedback quiz-feedback--wrong";
      feedback.textContent = correct ? t("quiz.correct") : t("quiz.wrong");
      container.appendChild(feedback);

      // Next button
      const nextBtn = document.createElement("button");
      nextBtn.className = "quiz-next-btn";
      nextBtn.textContent = index + 1 < total ? t("quiz.next") : t("quiz.seeResults");
      nextBtn.addEventListener("click", () => resolve(correct));
      container.appendChild(nextBtn);
    };

    const buttons = {};

    if (question.quiz_type === "species_image") {
      // choices are objects: { image_url, name } — show image only
      for (const [key, choice] of Object.entries(question.choices)) {
        const btn = document.createElement("button");
        btn.className = "quiz-choice quiz-choice--image";
        btn.setAttribute("data-key", key);

        const img = document.createElement("img");
        img.src = choice.image_url;
        img.alt = key;
        img.className = "quiz-choice-img";

        btn.appendChild(img);
        btn.addEventListener("click", () => handleAnswer(key, btn));
        choicesEl.appendChild(btn);
        buttons[key] = btn;
      }
    } else {
      // Text choices (species_name, trivia, habitat, description)
      for (const [key, text] of Object.entries(question.choices)) {
        const btn = document.createElement("button");
        btn.className = "quiz-choice quiz-choice--text";
        btn.setAttribute("data-key", key);
        btn.textContent = `${key}. ${text}`;
        btn.addEventListener("click", () => handleAnswer(key, btn));
        choicesEl.appendChild(btn);
        buttons[key] = btn;
      }
    }
  });
}

export function renderLoading(container, msg) {
  container.innerHTML = `<p class="quiz-status">${msg}</p>`;
}

export function renderError(container, msg) {
  container.innerHTML = `<p class="quiz-status quiz-status--error">${msg}</p>`;
}

export function renderEmpty(container) {
  container.innerHTML = `<p class="quiz-status">${t("quiz.noObservations")}</p>`;
}

export function renderScore(container, correct, total) {
  container.innerHTML = "";

  const icon = correct === total ? "🌿" : correct >= total / 2 ? "🌱" : "🍂";

  const wrap = document.createElement("div");
  wrap.className = "quiz-score";
  wrap.innerHTML = `
    <div class="quiz-score-icon">${icon}</div>
    <h2 class="quiz-score-title">${t("quiz.scoreTitle")}</h2>
    <p class="quiz-score-value">${correct} / ${total}</p>
    <p class="quiz-score-subtitle">${scoreLabel(correct, total)}</p>
  `;

  const backBtn = document.createElement("button");
  backBtn.textContent = t("quiz.backHome");
  backBtn.addEventListener("click", () => { location.href = "./index.html"; });
  wrap.appendChild(backBtn);

  const retryBtn = document.createElement("button");
  retryBtn.className = "secondary";
  retryBtn.textContent = t("quiz.retry");
  retryBtn.addEventListener("click", () => { location.reload(); });
  wrap.appendChild(retryBtn);

  container.appendChild(wrap);
}

function scoreLabel(correct, total) {
  const ratio = correct / total;
  if (ratio === 1) return t("quiz.score.perfect");
  if (ratio >= 0.75) return t("quiz.score.great");
  if (ratio >= 0.5) return t("quiz.score.good");
  return t("quiz.score.keepPracticing");
}
