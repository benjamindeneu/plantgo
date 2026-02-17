// src/ui/components/ChallengePanel.view.js
import { t, initI18n, translateDom } from "../../language/i18n.js";
await initI18n();

/**
 * Pure view for the Challenge panel.
 */
export function createChallengePanelView() {
  const wrap = document.createElement("section");
  wrap.className = "general-validation";

  wrap.innerHTML = `
    <h1 data-i18n="challenge.title">Challenge</h1>

    <div class="card" style="padding:14px; margin-top:10px">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap">
        <div>
          <div class="muted" data-i18n="challenge.create.subtitle">Create a challenge</div>
          <div style="font-weight:700" data-i18n="challenge.create.title">Start a timed challenge</div>
        </div>

        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
          <label class="muted" for="challengeDuration" data-i18n="challenge.duration">Duration</label>
          <select id="challengeDuration" class="input" style="width:160px">
            <option value="600">10 min</option>
            <option value="900">15 min</option>
            <option value="1200">20 min</option>
            <option value="1800" selected>30 min</option>
            <option value="2700">45 min</option>
            <option value="3600">60 min</option>
          </select>
          <button id="btnCreate" class="primary" type="button" data-i18n="challenge.create.button">Create</button>
        </div>
      </div>

      <div id="createOut" class="muted" style="margin-top:10px; display:none"></div>
    </div>

    <div class="card" style="padding:14px; margin-top:10px">
      <div class="muted" data-i18n="challenge.join.subtitle">Join a challenge</div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:6px">
        <input id="joinCode" class="input" style="width:160px; text-transform:uppercase"
          maxlength="5" data-i18n-placeholder="challenge.join.placeholder" placeholder="ABCDE" />
        <button id="btnJoin" class="secondary" type="button" data-i18n="challenge.join.button">Join</button>
      </div>
      <div id="joinOut" class="muted" style="margin-top:10px; display:none"></div>
    </div>

    <div class="card" style="padding:14px; margin-top:10px">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap">
        <div>
          <div class="muted" data-i18n="challenge.active.subtitle">Active challenge</div>
          <div id="activeLine" style="font-weight:700" data-i18n="challenge.active.none">No active challenge</div>
        </div>
        <div id="timerLine" class="muted" style="display:none"></div>
      </div>

      <div id="leaderWrap" style="margin-top:10px; display:none">
        <div class="muted" data-i18n="challenge.leaderboard">Leaderboard</div>
        <ol id="leaderList" style="margin-top:6px; padding-left:18px"></ol>
      </div>
    </div>

    <div id="feedback" aria-live="polite" class="validation-feedback"></div>
  `;

  const elDuration = wrap.querySelector("#challengeDuration");
  const btnCreate = wrap.querySelector("#btnCreate");
  const createOut = wrap.querySelector("#createOut");

  const elJoinCode = wrap.querySelector("#joinCode");
  const btnJoin = wrap.querySelector("#btnJoin");
  const joinOut = wrap.querySelector("#joinOut");

  const activeLine = wrap.querySelector("#activeLine");
  const timerLine = wrap.querySelector("#timerLine");
  const leaderWrap = wrap.querySelector("#leaderWrap");
  const leaderList = wrap.querySelector("#leaderList");

  const feedback = wrap.querySelector("#feedback");

  let createCb = null;
  let joinCb = null;

  function showOut(el, text) {
    el.style.display = text ? "block" : "none";
    el.textContent = text || "";
  }

  function fmtTimeLeft(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  btnCreate.addEventListener("click", () => {
    const durationSec = Number(elDuration.value || 1800);
    if (createCb) createCb({ durationSec });
  });

  btnJoin.addEventListener("click", () => {
    const code = String(elJoinCode.value || "").trim().toUpperCase();
    if (!code || code.length !== 5) return showOut(joinOut, t("challenge.join.invalidCode"));
    if (joinCb) joinCb({ code });
  });

  // keep uppercase
  elJoinCode.addEventListener("input", () => {
    elJoinCode.value = elJoinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  });

  translateDom(document);
  document.addEventListener("i18n:changed", () => translateDom(wrap));

  return {
    element: wrap,

    setFeedback(text) {
      feedback.textContent = text ?? "";
    },

    setCreateStatus(text) {
      showOut(createOut, text);
    },

    setJoinStatus(text) {
      showOut(joinOut, text);
    },

    setActiveChallenge(payload) {
        const code = payload?.code;
        const endsAtMs = payload?.endsAtMs;

        if (!code) {
            activeLine.textContent = t("challenge.active.none");
            timerLine.style.display = "none";
            leaderWrap.style.display = "none";
            return;
        }

        activeLine.textContent = `${t("challenge.active.code")} ${code}`;
        timerLine.style.display = "block";
        timerLine.textContent = `${t("challenge.active.timeLeft")} ${fmtTimeLeft(endsAtMs - Date.now())}`;
        leaderWrap.style.display = "block";
    },

    setTimeLeft(endsAtMs) {
      if (!endsAtMs) return;
      timerLine.style.display = "block";
      timerLine.textContent = `${t("challenge.active.timeLeft")} ${fmtTimeLeft(endsAtMs - Date.now())}`;
    },

    renderLeaderboard(rows = []) {
      leaderList.innerHTML = "";
      for (const r of rows) {
        const li = document.createElement("li");
        const name = r.username || "Player";
        const pts = Number(r.score || 0);
        li.innerHTML = `<span style="font-weight:600">${name}</span> <span class="muted">— ${pts} pts</span>`;
        leaderList.appendChild(li);
      }
      // if empty, still show an empty state
      if (!rows.length) {
        const li = document.createElement("li");
        li.className = "muted";
        li.textContent = t("challenge.leaderboard.empty");
        leaderList.appendChild(li);
      }
    },

    onCreate(cb) {
      createCb = cb;
    },

    onJoin(cb) {
      joinCb = cb;
    },
  };
}
