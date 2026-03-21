// src/ui/components/Quiz.view.js
import { t } from "../../language/i18n.js";
import { calcFromLevel, calcToLevel, animateProgress, fireLevelUpConfetti } from "../levelProgress.js";

// ── Landing screen ────────────────────────────────────────────────────────────

export function renderLanding(container, { alreadyDone, locked = false, currentCount = 0, onStart }) {
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "quiz-landing";

  if (alreadyDone) {
    wrap.innerHTML = `
      <div class="quiz-landing-icon">🌿</div>
      <p class="quiz-landing-title">${t("quiz.landing.alreadyDone")}</p>
      <p class="quiz-landing-sub">${t("quiz.landing.comeBack")}</p>
    `;
  } else if (locked) {
    const pct = Math.round((currentCount / 10) * 100);
    wrap.innerHTML = `
      <div class="quiz-landing-icon quiz-landing-icon--lock">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="currentColor" aria-hidden="true">
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
        </svg>
      </div>
      <p class="quiz-landing-title">${t("quiz.landing.title")}</p>
      <p class="quiz-landing-desc">${t("quiz.landing.lockedDesc")}</p>
      <div class="quiz-lock-progress">
        <div class="quiz-lock-progress-bar" style="width:${pct}%"></div>
      </div>
      <p class="quiz-landing-sub">${currentCount} / 10 ${t("quiz.landing.plantsObserved")}</p>
    `;
  } else {
    wrap.innerHTML = `
      <div class="quiz-landing-icon">🌱</div>
      <p class="quiz-landing-title">${t("quiz.landing.title")}</p>
      <p class="quiz-landing-desc">${t("quiz.landing.desc")}</p>
      <p class="quiz-landing-sub">${t("quiz.landing.points")}</p>
    `;
    const startBtn = document.createElement("button");
    startBtn.className = "primary";
    startBtn.textContent = t("quiz.landing.start");
    startBtn.addEventListener("click", onStart);
    wrap.appendChild(startBtn);

    const onceNote = document.createElement("p");
    onceNote.className = "quiz-landing-once";
    onceNote.textContent = t("quiz.landing.onceADay");
    wrap.appendChild(onceNote);
  }

  container.appendChild(wrap);
}

// ── Question renderer ─────────────────────────────────────────────────────────

/**
 * Renders a single quiz question and returns a Promise that resolves
 * with true (correct) or false (wrong) when the user picks an answer.
 */
export function renderQuestion(container, question, index, total) {
  return new Promise((resolve) => {
    container.innerHTML = "";

    // Progress header: counter + bar
    const progressHeader = document.createElement("div");
    progressHeader.className = "quiz-progress-header";
    progressHeader.innerHTML = `<span class="quiz-progress-label">${index + 1} / ${total}</span>`;
    container.appendChild(progressHeader);

    const progress = document.createElement("div");
    progress.className = "quiz-progress";
    const pct = Math.round((index / total) * 100);
    progress.innerHTML = `<div class="quiz-progress-bar" style="width:${pct}%"></div>`;
    container.appendChild(progress);

    if (question.quiz_type === "species_name") {
      // Show the species photo instead of the name
      const img = document.createElement("img");
      img.className = "quiz-species-img";
      img.alt = question.species_name;
      img.onerror = () => {
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

    const handleAnswer = (key) => {
      if (answered.done) return;
      answered.done = true;

      const correct = key === question.answer;

      for (const [k, el] of Object.entries(buttons)) {
        if (k === question.answer) {
          el.classList.add("quiz-choice--correct");
        } else if (k === key && !correct) {
          el.classList.add("quiz-choice--wrong");
        }
        el.disabled = true;
      }

      const feedback = document.createElement("p");
      feedback.className = correct ? "quiz-feedback quiz-feedback--correct" : "quiz-feedback quiz-feedback--wrong";
      feedback.textContent = correct ? t("quiz.correct") : t("quiz.wrong");
      container.appendChild(feedback);

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
        btn.addEventListener("click", () => handleAnswer(key));
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
        btn.addEventListener("click", () => handleAnswer(key));
        choicesEl.appendChild(btn);
        buttons[key] = btn;
      }
    }
  });
}

// ── Loading / error states ────────────────────────────────────────────────────

export function renderLoading(container, msg) {
  container.innerHTML = `<p class="quiz-status">${msg}</p>`;
}

export function renderError(container, msg) {
  container.innerHTML = `<p class="quiz-status quiz-status--error">${msg}</p>`;
}

export function renderEmpty(container) {
  container.innerHTML = `<p class="quiz-status">${t("quiz.noObservations")}</p>`;
}

// ── Score screen with level bar ───────────────────────────────────────────────

export async function renderScore(container, correct, total, { currentTotalBefore = 0, pointsEarned = 0 } = {}) {
  container.innerHTML = "";

  // Level bar
  const { fromLevel, nextLevel, fromPct } = calcFromLevel(currentTotalBefore);
  const { toLevel, toPct } = calcToLevel(currentTotalBefore + pointsEarned);

  const levelWrap = document.createElement("div");
  levelWrap.className = "level-wrap";
  levelWrap.innerHTML = `
    <div class="level-line">
      <span>${t("result.level")} <span id="qLevelFrom">${fromLevel}</span></span>
      <span id="qLevelToLabel" style="opacity:0.9">→ <span id="qLevelTo">${nextLevel}</span></span>
    </div>
    <div class="progress-rail">
      <div class="progress-bar" id="qLevelProgress" style="width:${fromPct}%"></div>
    </div>
  `;
  container.appendChild(levelWrap);

  // Score card
  const icon = correct === total ? "🌿" : correct >= total / 2 ? "🌱" : "🍂";

  const wrap = document.createElement("div");
  wrap.className = "quiz-score";

  wrap.innerHTML = `
    <div class="quiz-score-icon">${icon}</div>
    <h2 class="quiz-score-title">${t("quiz.scoreTitle")}</h2>
    <p class="quiz-score-value">${correct} / ${total}</p>
    <p class="quiz-score-subtitle">${scoreLabel(correct, total)}</p>
  `;

  // Points earned badge
  if (pointsEarned > 0) {
    const ptsBadge = document.createElement("div");
    ptsBadge.className = "quiz-score-pts";
    ptsBadge.innerHTML = `
      <span class="quiz-pts-label">${t("quiz.earned")}</span>
      <span class="quiz-pts-value" id="qPtsCounter">0</span>
      <span class="quiz-pts-unit">${t("result.ptsShort")}</span>
    `;
    wrap.appendChild(ptsBadge);
  }

  const backBtn = document.createElement("button");
  backBtn.textContent = t("quiz.backHome");
  backBtn.addEventListener("click", () => { location.href = "./index.html"; });
  wrap.appendChild(backBtn);

  container.appendChild(wrap);

  // Animate points counter
  if (pointsEarned > 0) {
    const counterEl = container.querySelector("#qPtsCounter");
    await animateCounter(counterEl, pointsEarned);
  }

  // Animate level bar
  const barEl = container.querySelector("#qLevelProgress");
  const leveledUp = toLevel > fromLevel;

  if (leveledUp) {
    await animateProgress(barEl, fromPct, 100, { ease: "easeOut" });

    const levelLine = levelWrap.querySelector(".level-line");
    levelLine.innerHTML = `<span class="level-reached-text">${t("result.levelReached", { level: toLevel })}</span>`;

    fireLevelUpConfetti(container.closest(".card") || container);

    barEl.style.transition = "none";
    barEl.style.width = "0%";
    void barEl.offsetWidth;
    barEl.style.transition = "";

    await new Promise((r) => setTimeout(r, 300));
    await animateProgress(barEl, 0, toPct, { ease: "easeOut" });
  } else {
    await animateProgress(barEl, fromPct, toPct, { ease: "easeOut" });
    container.querySelector("#qLevelFrom").textContent = toLevel;
    container.querySelector("#qLevelTo").textContent = toLevel + 1;
  }
}

function scoreLabel(correct, total) {
  const ratio = correct / total;
  if (ratio === 1) return t("quiz.score.perfect");
  if (ratio >= 0.75) return t("quiz.score.great");
  if (ratio >= 0.5) return t("quiz.score.good");
  return t("quiz.score.keepPracticing");
}

function animateCounter(el, target, duration = 1200) {
  const start = performance.now();
  return new Promise((res) => {
    function frame(ts) {
      const tt = Math.min(1, (ts - start) / duration);
      el.textContent = String(Math.round(target * tt));
      if (tt < 1) requestAnimationFrame(frame); else res();
    }
    requestAnimationFrame(frame);
  });
}
