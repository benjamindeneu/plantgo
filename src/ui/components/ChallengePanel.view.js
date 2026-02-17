// src/ui/components/ChallengePanel.view.js
import { t, initI18n, translateDom } from "../../language/i18n.js";
import { auth } from "../../../firebase-config.js";
await initI18n();

export function createChallengePanelView() {
  const wrap = document.createElement("section");
  wrap.className = "general-validation";

  wrap.innerHTML = `
    <div id="activeCard" class="card" style="display:none">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap">
        <div>
          <h1 data-i18n="challenge.active.subtitle">Active challenge</h1>
          <div id="activeLine" style="font-weight:700"></div>
          <div id="endedLine" class="muted" style="display:none; margin-top:4px"
               data-i18n="challenge.active.ended">
            Challenge ended
          </div>
        </div>
        <div id="timerLine" class="muted" style="display:none"></div>
      </div>

      <div id="leaderWrap" style="margin-top:10px">
        <div class="muted" data-i18n="challenge.leaderboard">Leaderboard</div>
        <ol id="leaderList" style="margin-top:6px; padding-left:18px"></ol>

        <div id="closeWrap" style="display:none; margin-top:12px; text-align:center">
          <button id="btnClose" class="secondary" type="button"
                  data-i18n="challenge.active.close">
            Close leaderboard
          </button>
        </div>
      </div>
    </div>
  `;

  const activeCard = wrap.querySelector("#activeCard");
  const activeLine = wrap.querySelector("#activeLine");
  const timerLine = wrap.querySelector("#timerLine");
  const endedLine = wrap.querySelector("#endedLine");
  const leaderList = wrap.querySelector("#leaderList");
  const closeWrap = wrap.querySelector("#closeWrap");
  const btnClose = wrap.querySelector("#btnClose");

  let closeCb = null;

  function fmtTimeLeft(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  btnClose.addEventListener("click", () => {
    if (closeCb) closeCb();
  });

  translateDom(wrap);
  const currentUid = auth.currentUser?.uid;

  return {
    element: wrap,

    setActiveChallenge(payload) {
      const code = payload?.code;
      const endsAtMs = payload?.endsAtMs;

      if (!code) {
        activeCard.style.display = "none";
        return;
      }

      activeCard.style.display = "block";
      activeLine.textContent = `${t("challenge.active.code")} ${code}`;

      if (endsAtMs && Date.now() < endsAtMs) {
        timerLine.style.display = "block";
        timerLine.textContent =
          `${t("challenge.active.timeLeft")} ${fmtTimeLeft(endsAtMs - Date.now())}`;
      } else {
        timerLine.style.display = "none";
      }
    },

    setTimeLeft(endsAtMs) {
      timerLine.style.display = "block";
      timerLine.textContent =
        `${t("challenge.active.timeLeft")} ${fmtTimeLeft(endsAtMs - Date.now())}`;
    },

    setEnded(isEnded) {
      if (isEnded) {
        timerLine.style.display = "none";
        endedLine.style.display = "block";
        closeWrap.style.display = "block";
      } else {
        endedLine.style.display = "none";
        closeWrap.style.display = "none";
      }
    },

    renderLeaderboard(rows = []) {
        leaderList.innerHTML = "";

        const maxScore = Math.max(...rows.map(r => r.score || 0), 1);

        rows.forEach((r, i) => {
            const percent = Math.round(((r.score || 0) / maxScore) * 100);
            const li = document.createElement("li");
            li.className = "leader-item";
            if (r.uid === currentUid) {
              li.classList.add("leader-me");
            }
            li.classList.add("leader-flash");
            setTimeout(() => li.classList.remove("leader-flash"), 500);
            
            let medal = "";
            if (i === 0) medal = "🥇";
            else if (i === 1) medal = "🥈";
            else if (i === 2) medal = "🥉";
            else medal = `<span class="rank-number">#${i + 1}</span>`;

            li.innerHTML = `
              <div class="leader-rank">${medal}</div>
              <div class="leader-name">${r.username}</div>
              <div class="leader-score">${r.score || 0} pts</div>
              <div class="leader-bar">
                <div class="leader-bar-fill" style="width:${percent}%"></div>
              </div>
            `;

            leaderList.appendChild(li);
        });
    },

    onClose(cb) {
      closeCb = cb;
    },
  };
}
