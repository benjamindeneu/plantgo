// src/ui/components/Quiz.view.js
import { t } from "../../language/i18n.js";
import { calcFromLevel, calcToLevel, animateProgress, fireLevelUpConfetti } from "../levelProgress.js";
import { photoProviderName } from "../../api/plantgo.js";
import { photoCreditLine } from "../photoCredit.js";
import { providerMark } from "./organIcons.js";

/**
 * The quiz as a game: a start screen, ten rounds and a results screen, all
 * painted inside the one `.card` the page hands over. Every screen is
 * `mp-quiz` markup — v2's native vocabulary — so it owns its own look and
 * the global button rule leaves it alone.
 */

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

// ── Landing screen ────────────────────────────────────────────────────────────

export function renderLanding(container, { alreadyDone, locked = false, currentCount = 0, onStart }) {
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "mp-quiz mp-quiz-landing";

  if (alreadyDone) {
    wrap.innerHTML = `
      <div class="mp-quiz-landing__art mp-quiz-landing__art--done" aria-hidden="true">
        <span class="mp-quiz-landing__emoji">🌿</span>
        <span class="mp-quiz-landing__ring"></span>
      </div>
      <p class="mp-quiz-landing__kicker">${t("quiz.landing.title")}</p>
      <h2 class="mp-quiz-landing__title">${t("quiz.landing.alreadyDone")}</h2>
      <p class="mp-quiz-landing__desc">${t("quiz.landing.comeBack")}</p>
    `;
  } else if (locked) {
    const pct = Math.round((currentCount / 10) * 100);
    wrap.innerHTML = `
      <div class="mp-quiz-landing__art mp-quiz-landing__art--locked" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
        </svg>
        <span class="mp-quiz-landing__ring"></span>
      </div>
      <p class="mp-quiz-landing__kicker">${t("quiz.landing.title")}</p>
      <h2 class="mp-quiz-landing__title">${t("quiz.landing.lockedTitle")}</h2>
      <p class="mp-quiz-landing__desc">${t("quiz.landing.lockedDesc")}</p>
      <div class="mp-quiz-unlock">
        <div class="mp-quiz-unlock__rail"><div class="mp-quiz-unlock__bar" style="width:${pct}%"></div></div>
        <p class="mp-quiz-unlock__label"><strong>${currentCount}</strong> / 10 ${t("quiz.landing.plantsObserved")}</p>
      </div>
    `;
  } else {
    wrap.innerHTML = `
      <div class="mp-quiz-landing__art" aria-hidden="true">
        <span class="mp-quiz-landing__emoji">🌱</span>
        <span class="mp-quiz-landing__ring"></span>
      </div>
      <p class="mp-quiz-landing__kicker">${t("quiz.landing.title")}</p>
      <h2 class="mp-quiz-landing__title">${t("quiz.landing.readyTitle")}</h2>
      <p class="mp-quiz-landing__desc">${t("quiz.landing.desc")}</p>
      <ul class="mp-quiz-stats">
        <li><strong>10</strong><span>${t("quiz.landing.stat.questions")}</span></li>
        <li><strong>200</strong><span>${t("quiz.landing.stat.perAnswer")}</span></li>
        <li><strong>1</strong><span>${t("quiz.landing.stat.perDay")}</span></li>
      </ul>
    `;
    const startBtn = document.createElement("button");
    startBtn.type = "button";
    startBtn.className = "mp-quiz-cta";
    startBtn.innerHTML = `<span>${t("quiz.landing.start")}</span><span class="mp-quiz-cta__arrow" aria-hidden="true">→</span>`;
    startBtn.addEventListener("click", onStart);
    wrap.appendChild(startBtn);

    const onceNote = document.createElement("p");
    onceNote.className = "mp-quiz-landing__note";
    onceNote.textContent = t("quiz.landing.onceADay");
    wrap.appendChild(onceNote);
  }

  container.appendChild(wrap);
}

// ── Photo with its credit ─────────────────────────────────────────────────────

/**
 * One picture and the line it has to be shown with. The credit sits on the
 * photo itself, in the corner, so it travels with the picture wherever the
 * quiz puts it — the hero, or a tile in the 2×2 answer grid. `alt` stays
 * empty on purpose: the species name must never leak through the image.
 */
function photoFigure(photo, { className = "" } = {}) {
  const fig = document.createElement("figure");
  fig.className = `mp-quiz-photo ${className}`.trim();

  if (!photo?.url) {
    fig.classList.add("mp-quiz-photo--empty");
    fig.innerHTML = `<span class="mp-quiz-photo__empty" aria-hidden="true">?</span>`;
    return fig;
  }

  const img = document.createElement("img");
  img.alt = "";
  img.decoding = "async";
  img.addEventListener("load", () => fig.classList.add("has-photo"));
  img.addEventListener("error", () => {
    fig.classList.add("mp-quiz-photo--empty");
    img.remove();
    fig.insertAdjacentHTML("afterbegin", `<span class="mp-quiz-photo__empty" aria-hidden="true">?</span>`);
  });
  img.src = photo.url;
  fig.appendChild(img);

  // The source's mark, then the same credit line every source gets.
  const cap = document.createElement("figcaption");
  cap.className = "mp-quiz-photo__credit";
  const source = photoProviderName(photo.provider);
  const line = photoCreditLine(photo);
  const mark = providerMark(photo.provider);
  cap.innerHTML = `${mark ? `<span class="mp-quiz-photo__mark">${mark}</span>` : ""}<span class="mp-quiz-photo__credit-text"></span>`;
  cap.querySelector(".mp-quiz-photo__credit-text").textContent = line;
  cap.title = photo.author ? `${line} · ${source}` : line;
  fig.appendChild(cap);

  return fig;
}

// ── HUD ───────────────────────────────────────────────────────────────────────

function hud({ index, total, score, streak, results }) {
  const el = document.createElement("div");
  el.className = "mp-quiz-hud";

  const pips = document.createElement("div");
  pips.className = "mp-quiz-pips";
  pips.setAttribute("aria-label", t("quiz.hud.round", { n: index + 1, total }));
  for (let i = 0; i < total; i++) {
    const pip = document.createElement("span");
    let state = "todo";
    if (i < results.length) state = results[i] ? "right" : "wrong";
    else if (i === index) state = "now";
    pip.className = `mp-quiz-pip mp-quiz-pip--${state}`;
    pips.appendChild(pip);
  }

  const stats = document.createElement("div");
  stats.className = "mp-quiz-hud__stats";
  stats.innerHTML = `
    <span class="mp-quiz-stat mp-quiz-stat--score" title="${t("quiz.hud.score")}">
      <span class="mp-quiz-stat__icon" aria-hidden="true">★</span>
      <span class="mp-quiz-stat__value" data-score>${score}</span>
    </span>
    <span class="mp-quiz-stat mp-quiz-stat--streak${streak > 0 ? " is-hot" : ""}" title="${t("quiz.hud.streak")}">
      <span class="mp-quiz-stat__icon" aria-hidden="true">🔥</span>
      <span class="mp-quiz-stat__value" data-streak>${streak}</span>
    </span>
  `;

  el.append(pips, stats);
  return el;
}

// ── Question renderer ─────────────────────────────────────────────────────────

/**
 * Renders one round and returns a Promise that resolves with true (correct)
 * or false (wrong) once the player has answered and pressed on.
 *
 * `game` is the running state the HUD shows: score, streak, and one boolean
 * per round already played.
 */
export function renderQuestion(container, question, index, total, game = {}) {
  const { score = 0, streak = 0, results = [], pointsPerCorrect = 200 } = game;
  const isImagePick = question.quiz_type === "species_image";
  const hideName = question.quiz_type === "species_name";

  return new Promise((resolve) => {
    container.innerHTML = "";

    const round = document.createElement("div");
    round.className = "mp-quiz mp-quiz-round";
    container.appendChild(round);

    const hudEl = hud({ index, total, score, streak, results });
    round.appendChild(hudEl);

    // --- the stage: the plant this round is about ---------------------------
    // Every round but "which image" leads with the plant's picture; the name
    // is laid over it, except when the name is the answer.
    const stage = document.createElement("div");
    stage.className = "mp-quiz-stage";
    if (isImagePick) {
      stage.classList.add("mp-quiz-stage--name");
      stage.innerHTML = `
        <span class="mp-quiz-stage__round">${t("quiz.hud.round", { n: index + 1, total })}</span>
        <p class="mp-quiz-stage__species"></p>
      `;
      stage.querySelector(".mp-quiz-stage__species").textContent = question.species_name;
    } else {
      const fig = photoFigure(question.photo, { className: "mp-quiz-photo--hero" });
      stage.appendChild(fig);
      const badge = document.createElement("span");
      badge.className = "mp-quiz-stage__round mp-quiz-stage__round--over";
      badge.textContent = t("quiz.hud.round", { n: index + 1, total });
      stage.appendChild(badge);
      if (!hideName) {
        const name = document.createElement("p");
        name.className = "mp-quiz-stage__species mp-quiz-stage__species--over";
        name.textContent = question.species_name;
        stage.appendChild(name);
      }
    }
    round.appendChild(stage);

    // --- the question -------------------------------------------------------
    const isI18nKey = hideName || isImagePick;
    const qText = document.createElement("p");
    qText.className = "mp-quiz-question";
    qText.textContent = isI18nKey ? t(question.question) : question.question;
    round.appendChild(qText);

    // --- the choices --------------------------------------------------------
    const choicesEl = document.createElement("div");
    choicesEl.className = isImagePick ? "mp-quiz-choices mp-quiz-choices--images" : "mp-quiz-choices";
    choicesEl.setAttribute("role", "group");
    round.appendChild(choicesEl);

    const footer = document.createElement("div");
    footer.className = "mp-quiz-footer";
    round.appendChild(footer);

    const buttons = {};
    let answered = false;

    const handleAnswer = (key) => {
      if (answered) return;
      answered = true;

      const correct = key === question.answer;

      for (const [k, el] of Object.entries(buttons)) {
        el.disabled = true;
        if (k === question.answer) el.classList.add("is-correct");
        else if (k === key) el.classList.add("is-wrong");
        else el.classList.add("is-dim");
      }
      round.classList.add(correct ? "is-right" : "is-missed");

      // The HUD reacts at once: the pip for this round settles, the score
      // ticks up with a "+200" rising off it, the streak counts on.
      const pip = hudEl.querySelectorAll(".mp-quiz-pip")[index];
      pip.className = `mp-quiz-pip mp-quiz-pip--${correct ? "right" : "wrong"}`;
      const streakEl = hudEl.querySelector("[data-streak]");
      const streakStat = streakEl.closest(".mp-quiz-stat");
      if (correct) {
        bumpScore(hudEl, score, score + pointsPerCorrect, pointsPerCorrect);
        streakEl.textContent = String(streak + 1);
        streakStat.classList.add("is-hot");
        pulse(streakStat);
      } else {
        streakEl.textContent = "0";
        streakStat.classList.remove("is-hot");
      }

      const feedback = document.createElement("p");
      feedback.className = `mp-quiz-feedback ${correct ? "mp-quiz-feedback--right" : "mp-quiz-feedback--wrong"}`;
      const newStreak = streak + 1;
      feedback.textContent = correct
        ? (newStreak >= 3 ? t("quiz.feedback.streak", { n: newStreak }) : t("quiz.correct"))
        : t("quiz.wrong");
      footer.appendChild(feedback);

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "mp-quiz-cta";
      const last = index + 1 >= total;
      // The button draws its own arrow; the translations still carry one.
      const label = (last ? t("quiz.seeResults") : t("quiz.next")).replace(/\s*→\s*$/, "");
      nextBtn.innerHTML = `<span>${label}</span><span class="mp-quiz-cta__arrow" aria-hidden="true">→</span>`;
      nextBtn.addEventListener("click", () => resolve(correct));
      footer.appendChild(nextBtn);
      nextBtn.focus({ preventScroll: true });
    };

    for (const [key, choice] of Object.entries(question.choices)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.key = key;

      if (isImagePick) {
        // Choices are { name, image_url, photo }: only the picture shows,
        // with its credit, never the name.
        btn.className = "mp-quiz-choice mp-quiz-choice--image";
        btn.appendChild(photoFigure(choice.photo, { className: "mp-quiz-photo--tile" }));
        btn.insertAdjacentHTML("beforeend", `<span class="mp-quiz-choice__key">${key}</span><span class="mp-quiz-choice__mark" aria-hidden="true"></span>`);
      } else {
        btn.className = `mp-quiz-choice mp-quiz-choice--text${hideName ? " mp-quiz-choice--species" : ""}`;
        btn.innerHTML = `<span class="mp-quiz-choice__key">${key}</span><span class="mp-quiz-choice__label"></span><span class="mp-quiz-choice__mark" aria-hidden="true"></span>`;
        btn.querySelector(".mp-quiz-choice__label").textContent = choice;
      }

      btn.addEventListener("click", () => handleAnswer(key));
      choicesEl.appendChild(btn);
      buttons[key] = btn;
    }
  });
}

function pulse(el) {
  if (reducedMotion()) return;
  el.classList.remove("is-pulsing");
  void el.offsetWidth;
  el.classList.add("is-pulsing");
}

/** Tick the HUD score from one value to the next, with the gain floating off it. */
function bumpScore(hudEl, from, to, gain) {
  const scoreEl = hudEl.querySelector("[data-score]");
  const stat = scoreEl.closest(".mp-quiz-stat");
  pulse(stat);

  const float = document.createElement("span");
  float.className = "mp-quiz-gain";
  float.textContent = `+${gain}`;
  stat.appendChild(float);
  float.addEventListener("animationend", () => float.remove());

  if (reducedMotion()) { scoreEl.textContent = String(to); return; }
  animateCounter(scoreEl, to, 600, from);
}

// ── Loading / error states ────────────────────────────────────────────────────

export function renderLoading(container, msg) {
  container.innerHTML = `
    <div class="mp-quiz mp-quiz-status">
      <span class="mp-quiz-spinner" aria-hidden="true"></span>
      <p></p>
    </div>`;
  container.querySelector("p").textContent = msg || "";
}

export function renderError(container, msg) {
  container.innerHTML = `<div class="mp-quiz mp-quiz-status mp-quiz-status--error"><p></p></div>`;
  container.querySelector("p").textContent = msg;
}

export function renderEmpty(container) {
  renderError(container, t("quiz.noObservations"));
}

// ── Score screen with level bar ───────────────────────────────────────────────

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

export async function renderScore(container, correct, total, { currentTotalBefore = 0, pointsEarned = 0, bestStreak = 0 } = {}) {
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "mp-quiz mp-quiz-score";
  const perfect = correct === total;
  if (perfect) wrap.classList.add("is-perfect");

  const accuracy = total ? Math.round((correct / total) * 100) : 0;

  wrap.innerHTML = `
    <p class="mp-quiz-landing__kicker">${t("quiz.scoreTitle")}</p>
    <div class="mp-quiz-ring" role="img" aria-label="${correct} / ${total}">
      <svg viewBox="0 0 120 120" width="150" height="150" aria-hidden="true">
        <circle class="mp-quiz-ring__rail" cx="60" cy="60" r="${RING_R}"/>
        <circle class="mp-quiz-ring__bar" cx="60" cy="60" r="${RING_R}"
                stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"/>
      </svg>
      <div class="mp-quiz-ring__label">
        <span class="mp-quiz-ring__value"><span data-ring-count>0</span><small>/${total}</small></span>
      </div>
    </div>
    <h2 class="mp-quiz-score__title">${scoreLabel(correct, total)}</h2>
    <ul class="mp-quiz-stats mp-quiz-stats--score">
      <li><strong>${accuracy}%</strong><span>${t("quiz.score.accuracy")}</span></li>
      <li><strong>${bestStreak}</strong><span>${t("quiz.score.bestStreak")}</span></li>
      <li class="mp-quiz-stats__pts"><strong>+<span data-pts>0</span></strong><span>${t("quiz.earned")}</span></li>
    </ul>
  `;

  // Level bar
  const { fromLevel, nextLevel, fromPct } = calcFromLevel(currentTotalBefore);
  const { toLevel, toPct } = calcToLevel(currentTotalBefore + pointsEarned);

  const levelWrap = document.createElement("div");
  levelWrap.className = "level-wrap mp-quiz-level";
  levelWrap.innerHTML = `
    <div class="level-line">
      <span>${t("result.level")} <span id="qLevelFrom">${fromLevel}</span></span>
      <span id="qLevelToLabel" style="opacity:0.9">→ <span id="qLevelTo">${nextLevel}</span></span>
    </div>
    <div class="progress-rail">
      <div class="progress-bar" id="qLevelProgress" style="width:${fromPct}%"></div>
    </div>
  `;
  wrap.appendChild(levelWrap);

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "mp-quiz-cta";
  backBtn.innerHTML = `<span>${t("quiz.backHome")}</span>`;
  backBtn.addEventListener("click", () => { location.href = "./index.html"; });
  wrap.appendChild(backBtn);

  container.appendChild(wrap);

  // The ring fills and the count climbs together; the points follow.
  const bar = wrap.querySelector(".mp-quiz-ring__bar");
  const target = RING_C * (1 - (total ? correct / total : 0));
  requestAnimationFrame(() => { bar.style.strokeDashoffset = String(target); });
  await animateCounter(wrap.querySelector("[data-ring-count]"), correct, 900);
  if (pointsEarned > 0) await animateCounter(wrap.querySelector("[data-pts]"), pointsEarned, 800);

  if (perfect) fireLevelUpConfetti(container.closest(".card") || container);

  // Animate level bar
  const barEl = wrap.querySelector("#qLevelProgress");
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
    wrap.querySelector("#qLevelFrom").textContent = toLevel;
    wrap.querySelector("#qLevelTo").textContent = toLevel + 1;
  }
}

function scoreLabel(correct, total) {
  const ratio = correct / total;
  if (ratio === 1) return t("quiz.score.perfect");
  if (ratio >= 0.75) return t("quiz.score.great");
  if (ratio >= 0.5) return t("quiz.score.good");
  return t("quiz.score.keepPracticing");
}

function animateCounter(el, target, duration = 1200, from = 0) {
  if (reducedMotion()) { el.textContent = String(target); return Promise.resolve(); }
  const start = performance.now();
  return new Promise((res) => {
    function frame(ts) {
      // The first frame's timestamp can predate `start`; never count backwards.
      const tt = Math.max(0, Math.min(1, (ts - start) / duration));
      const eased = 1 - Math.pow(1 - tt, 3);
      el.textContent = String(Math.round(from + (target - from) * eased));
      if (tt < 1) requestAnimationFrame(frame); else res();
    }
    requestAnimationFrame(frame);
  });
}
