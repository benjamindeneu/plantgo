// src/ui/components/ChallengeScreen.view.js
import { t } from "../../language/i18n.js";
import { isSpeciesFound } from "../../data/activeChallenge.js";
import { standings, MIN_PLAYERS_FOR_POINTS } from "../../data/challenges.js";
import { avatarSvg } from "./Avatar.view.js";
import { fireLevelUpConfetti } from "../levelProgress.js";

/**
 * The challenge screen inside the map sheet.
 *
 * The sheet is a third of a phone screen, so this is built the way the other
 * screens in it are: a compact head, then one scrolling list. While the
 * hunt runs the head is a match card — the clock, how much of the list is
 * found, who is playing — and once it is over the card gives way to the
 * result: your place, what it paid, what it unlocked. Under either come the
 * standings, the top three on a podium and the rest in rows, and then a
 * species hunt's checklist.
 *
 * The species rows are not built here. They are the same `SpeciesRow` the
 * missions list uses, passed in by the controller, so tapping one opens the
 * same detail screen rather than a second kind of card.
 */

const WARN_MS = 5 * 60 * 1000;
const CRITICAL_MS = 60 * 1000;

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

// Player colours: a small palette picked by uid, so a player keeps their
// colour from one render to the next and no two neighbours are likely alike.
const AVATAR_HUES = [152, 200, 262, 330, 24, 48, 180, 300];
function hueOf(uid) {
  let h = 0;
  for (const ch of String(uid || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}
// A player's avatar on their coloured disc; a row from before avatars
// existed shows the initial instead.
function avatar(row, className = "mp-avatar") {
  const el = document.createElement("span");
  el.className = className;
  el.style.setProperty("--hue", hueOf(row.uid));
  if (row.avatar) el.innerHTML = avatarSvg(row.avatar);
  else el.textContent = (row.username || "?").trim().charAt(0).toUpperCase() || "?";
  el.title = row.username || "";
  return el;
}

export function createChallengeScreenView({ onClose } = {}) {
  const root = document.createElement("div");
  root.className = "mp-chal";
  root.innerHTML = `
    <div class="mp-chal__match">
      <div class="mp-chal__match-top">
        <span class="mp-chal__kind"></span>
        <button class="mp-chal__code" type="button" title="">
          <span class="mp-chal__code-value"></span>
          <svg class="mp-chal__code-icon" viewBox="0 0 24 24" width="13" height="13" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>
      <div class="mp-chal__match-body">
        <div class="mp-chal__clock-wrap">
          <span class="mp-chal__clock"></span>
          <span class="mp-chal__clock-label"></span>
        </div>
        <div class="mp-chal__found" hidden>
          <span class="mp-chal__found-value"><b data-found>0</b><span data-total>/0</span></span>
          <span class="mp-chal__found-label"></span>
          <span class="mp-chal__found-rail"><span class="mp-chal__found-fill"></span></span>
        </div>
      </div>
      <div class="mp-chal__players"></div>
    </div>

    <div class="mp-chal__result" hidden>
      <div class="mp-chal__result-medal" aria-hidden="true"></div>
      <p class="mp-chal__result-title"></p>
      <p class="mp-chal__result-sub"></p>
      <p class="mp-chal__result-pts" hidden>+<span data-pts>0</span> <span data-unit></span></p>
      <p class="mp-chal__result-note" hidden></p>
      <div class="mp-chal__result-badges" hidden></div>
    </div>

    <section class="mp-chal__section">
      <h3 class="mp-chal__label" id="chalBoardLabel"></h3>
      <ol class="mp-podium" id="chalPodium"></ol>
      <ol class="mp-lead" id="chalBoard"></ol>
    </section>

    <section class="mp-chal__section" id="chalHunt" hidden>
      <h3 class="mp-chal__label"></h3>
      <div class="mp-list" id="chalSpecies"></div>
    </section>

    <div class="mp-chal__foot" id="chalFoot" hidden>
      <button class="mp-chal__close" type="button" id="chalClose"></button>
    </div>
  `;

  const q = (sel) => root.querySelector(sel);
  const match = q(".mp-chal__match");
  const kindEl = q(".mp-chal__kind");
  const codeBtn = q(".mp-chal__code");
  const codeValue = q(".mp-chal__code-value");
  const clockEl = q(".mp-chal__clock");
  const clockLabel = q(".mp-chal__clock-label");
  const foundEl = q(".mp-chal__found");
  const foundValue = q("[data-found]");
  const foundTotal = q("[data-total]");
  const foundLabel = q(".mp-chal__found-label");
  const foundFill = q(".mp-chal__found-fill");
  const playersEl = q(".mp-chal__players");
  const result = q(".mp-chal__result");
  const resultMedal = q(".mp-chal__result-medal");
  const resultTitle = q(".mp-chal__result-title");
  const resultSub = q(".mp-chal__result-sub");
  const resultPts = q(".mp-chal__result-pts");
  const resultPtsValue = q("[data-pts]");
  const resultPtsUnit = q("[data-unit]");
  const resultNote = q(".mp-chal__result-note");
  const resultBadges = q(".mp-chal__result-badges");
  const huntSection = q("#chalHunt");
  const huntLabel = q("#chalHunt .mp-chal__label");
  const speciesList = q("#chalSpecies");
  const boardLabel = q("#chalBoardLabel");
  const podium = q("#chalPodium");
  const board = q("#chalBoard");
  const foot = q("#chalFoot");
  const closeBtn = q("#chalClose");

  let challenge = null;
  let myUid = null;
  let rows = [];
  let ended = false;
  let progress = { found: 0, total: 0 };
  let outcome = null;
  // Last drawn scores by uid: the difference is what gets a "+1".
  let lastScores = new Map();

  codeBtn.addEventListener("click", async () => {
    if (!challenge?.code) return;
    try {
      await navigator.clipboard.writeText(challenge.code);
      codeBtn.classList.add("is-copied");
      codeValue.textContent = t("common.copied");
      setTimeout(() => {
        codeBtn.classList.remove("is-copied");
        codeValue.textContent = challenge?.code ?? "";
      }, 1500);
    } catch { /* clipboard blocked — the code is still on screen to read */ }
  });

  closeBtn.addEventListener("click", () => onClose?.());

  /** mm:ss, and never a negative clock. */
  function fmt(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  // --- the match card -------------------------------------------------------

  function renderClock() {
    if (!challenge) return;
    const left = challenge.endAtMs ? challenge.endAtMs - Date.now() : null;
    if (ended || left == null) {
      clockEl.textContent = t("challenge.active.ended");
      clockLabel.textContent = "";
      match.classList.remove("is-warning", "is-critical");
      match.classList.add("is-ended");
      return;
    }
    clockEl.textContent = fmt(left);
    clockLabel.textContent = t("challenge.match.timeLeft");
    match.classList.remove("is-ended");
    match.classList.toggle("is-critical", left <= CRITICAL_MS);
    match.classList.toggle("is-warning", left > CRITICAL_MS && left <= WARN_MS);
  }

  function renderFound() {
    const isHunt = challenge?.type === "species_hunt" && progress.total > 0;
    foundEl.hidden = !isHunt;
    if (!isHunt) return;
    foundValue.textContent = String(progress.found);
    foundTotal.textContent = `/${progress.total}`;
    foundLabel.textContent = t("challenge.match.found");
    foundFill.style.width = `${Math.round((progress.found / progress.total) * 100)}%`;
  }

  function renderPlayers() {
    playersEl.replaceChildren();
    const table = standings(rows);
    const shown = table.slice(0, 6);
    for (const r of shown) {
      const a = avatar(r, "mp-avatar mp-avatar--sm");
      if (r.uid === myUid) a.classList.add("is-me");
      playersEl.appendChild(a);
    }
    if (table.length > shown.length) {
      const more = document.createElement("span");
      more.className = "mp-avatar mp-avatar--sm mp-avatar--more";
      more.textContent = `+${table.length - shown.length}`;
      playersEl.appendChild(more);
    }
    const count = document.createElement("span");
    count.className = "mp-chal__players-count";
    count.textContent = t("challenge.match.players", { n: table.length });
    playersEl.appendChild(count);
  }

  // --- standings ------------------------------------------------------------

  /** Where every player's element sits right now, by uid — for the FLIP. */
  function snapshotRects() {
    const rects = new Map();
    for (const el of root.querySelectorAll("[data-uid]")) {
      rects.set(el.dataset.uid, el.getBoundingClientRect());
    }
    return rects;
  }

  /** Slide each player from where they were to where they are now. */
  function playFlip(before) {
    if (reducedMotion() || !before.size) return;
    for (const el of root.querySelectorAll("[data-uid]")) {
      const from = before.get(el.dataset.uid);
      if (!from) continue;
      const to = el.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (!dx && !dy) continue;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 420ms var(--mp-ease)";
        el.style.transform = "";
        el.addEventListener("transitionend", () => { el.style.transition = ""; }, { once: true });
      });
    }
  }

  /** A score that went up pulses, with the gain floating off it. */
  function bump(scoreEl, gain) {
    if (reducedMotion()) return;
    scoreEl.classList.remove("is-bump");
    void scoreEl.offsetWidth;
    scoreEl.classList.add("is-bump");
    const float = document.createElement("span");
    float.className = "mp-lead__gain";
    float.textContent = `+${gain}`;
    scoreEl.appendChild(float);
    float.addEventListener("animationend", () => float.remove());
  }

  function scoreText(score) {
    const unit = challenge?.type === "species_hunt"
      ? t("challenge.speciesHunt.scoreLabel")
      : t("result.ptsShort");
    return `${score} ${unit}`;
  }

  function renderBoard() {
    const before = snapshotRects();
    const table = standings(rows);
    const gains = new Map();
    for (const r of table) {
      const prev = lastScores.get(r.uid);
      if (prev != null && r.score > prev) gains.set(r.uid, r.score - prev);
    }

    podium.replaceChildren();
    board.replaceChildren();

    if (!table.length) {
      const empty = document.createElement("li");
      empty.className = "mp-lead__empty";
      empty.textContent = t("challenge.leaderboard.empty");
      board.appendChild(empty);
      lastScores = new Map();
      return;
    }

    // The podium: the first three in order of standing, drawn 2nd-1st-3rd
    // so the winner stands in the middle and tallest.
    const top = table.slice(0, 3);
    const order = [1, 0, 2].filter((i) => i < top.length);
    podium.hidden = false;
    for (const i of order) {
      const r = top[i];
      const spot = document.createElement("li");
      spot.className = `mp-podium__spot mp-podium__spot--${i + 1}`;
      spot.dataset.uid = r.uid;
      if (r.uid === myUid) spot.classList.add("is-me");
      if (i === 0) spot.insertAdjacentHTML("afterbegin", `<span class="mp-podium__crown" aria-hidden="true">👑</span>`);
      const av = avatar(r, "mp-avatar mp-avatar--podium");
      const name = document.createElement("span");
      name.className = "mp-podium__name";
      name.textContent = r.username;
      const score = document.createElement("span");
      score.className = "mp-podium__score";
      score.textContent = scoreText(r.score);
      const block = document.createElement("span");
      block.className = "mp-podium__block";
      block.textContent = String(r.rank);
      spot.append(av, name, score, block);
      podium.appendChild(spot);
      if (gains.has(r.uid)) bump(score, gains.get(r.uid));
    }

    // Everyone else, in rows.
    const rest = table.slice(3);
    const best = Math.max(table[0]?.score || 0, 1);
    for (const r of rest) {
      const li = document.createElement("li");
      li.className = "mp-lead__row";
      li.dataset.uid = r.uid;
      if (r.uid === myUid) li.classList.add("is-me");
      const rank = document.createElement("span");
      rank.className = "mp-lead__rank";
      rank.textContent = String(r.rank);
      const av = avatar(r, "mp-avatar mp-avatar--row");
      const name = document.createElement("span");
      name.className = "mp-lead__name";
      name.textContent = r.username;
      const score = document.createElement("span");
      score.className = "mp-lead__score";
      score.textContent = scoreText(r.score);
      const rail = document.createElement("span");
      rail.className = "mp-lead__rail";
      const fill = document.createElement("span");
      fill.className = "mp-lead__fill";
      fill.style.width = `${Math.round((r.score / best) * 100)}%`;
      rail.appendChild(fill);
      li.append(rank, av, name, score, rail);
      board.appendChild(li);
      if (gains.has(r.uid)) bump(score, gains.get(r.uid));
    }

    lastScores = new Map(table.map((r) => [r.uid, r.score]));
    playFlip(before);
  }

  // --- the result -----------------------------------------------------------

  function medalFor(rank) {
    return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏁";
  }

  function renderResult() {
    const show = ended && !!outcome;
    result.hidden = !show;
    match.hidden = show;
    if (!show) return;
    const { rank, players, found, total, points, newBadges = [] } = outcome;
    resultMedal.textContent = medalFor(rank);
    const contested = players >= 2;
    result.classList.toggle("is-winner", rank === 1 && contested);
    resultTitle.textContent = rank === 1 && contested
      ? t("challenge.result.won")
      : rank <= 3 && contested
        ? t("challenge.result.podium")
        : t("challenge.result.over");
    const place = contested ? t("challenge.result.place", { rank, players }) : t("challenge.result.solo");
    resultSub.textContent = challenge?.type === "species_hunt" && total
      ? `${place} · ${t("challenge.result.found", { found, total })}`
      : place;
    resultPts.hidden = !(points > 0);
    resultPtsUnit.textContent = t("result.ptsShort");
    // Why a place paid nothing, when it might have been expected to.
    const noPay = points <= 0 && rank <= 3
      ? players < MIN_PLAYERS_FOR_POINTS
        ? t("challenge.result.needPlayers", { n: MIN_PLAYERS_FOR_POINTS })
        : t("challenge.result.needFind")
      : "";
    resultNote.textContent = noPay;
    resultNote.hidden = !noPay;
    resultBadges.hidden = !newBadges.length;
    resultBadges.replaceChildren();
    for (const b of newBadges) {
      const chip = document.createElement("span");
      chip.className = "mp-chal__badge";
      chip.innerHTML = `<span aria-hidden="true"></span><span></span>`;
      chip.firstElementChild.textContent = b.emoji;
      chip.lastElementChild.textContent = b.label;
      resultBadges.appendChild(chip);
    }
  }

  function animateCounter(el, target, duration = 900) {
    if (reducedMotion()) { el.textContent = String(target); return Promise.resolve(); }
    const start = performance.now();
    return new Promise((res) => {
      function frame(ts) {
        const tt = Math.max(0, Math.min(1, (ts - start) / duration));
        const eased = 1 - Math.pow(1 - tt, 3);
        el.textContent = String(Math.round(target * eased));
        if (tt < 1) requestAnimationFrame(frame); else res();
      }
      requestAnimationFrame(frame);
    });
  }

  function refreshI18n() {
    codeBtn.title = t("common.copy");
    kindEl.textContent = challenge?.type === "species_hunt"
      ? `🏁 ${t("challenge.speciesHunt.activeSubtitle")}`
      : `🏁 ${t("challenge.active.subtitle")}`;
    huntLabel.textContent = t("challenge.speciesHunt.checklistTitle");
    boardLabel.textContent = t("challenge.leaderboard");
    closeBtn.textContent = t("challenge.active.close");
    renderClock();
    renderFound();
    renderPlayers();
    renderBoard();
    renderResult();
  }

  refreshI18n();

  return {
    element: root,

    setChallenge(next, { isEnded = false } = {}) {
      if (next?.id !== challenge?.id) { lastScores = new Map(); outcome = null; }
      challenge = next;
      ended = isEnded;
      codeValue.textContent = next?.code ?? "";
      root.classList.toggle("mp-chal--hunt", next?.type === "species_hunt");
      foot.hidden = !isEnded;
      refreshI18n();
    },

    setMyUid(uid) { myUid = uid || null; },

    setLeaderboard(next = []) {
      rows = next;
      renderPlayers();
      renderBoard();
    },

    /**
     * @param {HTMLElement[]} speciesRows rows already built by the controller
     * @param {{found:number,total:number}} nextProgress
     */
    setChecklist(speciesRows, nextProgress) {
      progress = nextProgress || { found: 0, total: 0 };
      huntSection.hidden = !speciesRows.length;
      speciesList.replaceChildren(...speciesRows);
      huntLabel.textContent = speciesRows.length
        ? `${t("challenge.speciesHunt.checklistTitle")} · ${progress.found}/${progress.total}`
        : t("challenge.speciesHunt.checklistTitle");
      renderFound();
    },

    /**
     * The settled outcome for this player. Fresh news — settled just now —
     * counts its points up and, for a win, drops confetti; a result seen
     * before is drawn as it stands.
     */
    async setResult(next) {
      outcome = next;
      renderResult();
      if (!next) return;
      if (next.points > 0) {
        if (next.settledNow) await animateCounter(resultPtsValue, next.points);
        else resultPtsValue.textContent = String(next.points);
      }
      if (next.settledNow && next.rank === 1 && next.points > 0) {
        fireLevelUpConfetti(root.closest(".mp-sheet") || root);
      }
    },

    /** Ticked once a second by the controller while the clock runs. */
    tick(isEndedNow) {
      ended = isEndedNow;
      foot.hidden = !isEndedNow;
      renderClock();
      renderResult();
    },

    refreshI18n,
  };
}

/** Marks a row the player has already found, for the hunt checklist. */
export function markFound(rowEl, species, foundSpecies, foundGbifIds) {
  if (isSpeciesFound(species, foundSpecies, foundGbifIds)) rowEl.classList.add("mp-row--found");
  return rowEl;
}
