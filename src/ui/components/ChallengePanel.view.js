// src/ui/components/ChallengePanel.view.js
import { t, initI18n, translateDom } from "../../language/i18n.js";
import { getWikipediaImage } from "../../data/wiki.service.js";
import { debugMode } from "../../data/debugMode.js";
import { MissionCard } from "../../controllers/MissionCard.controller.js";
import { Modal } from "./Modal.js";
await initI18n();

export function createChallengePanelView() {
  const wrap = document.createElement("section");
  wrap.className = "general-";

  wrap.innerHTML = `
    <div id="activeCard" class="card" style="display:none">

      <div style="text-align:center">
        <h1 data-i18n="challenge.active.subtitle">Active challenge</h1>

        <p id="activeLine" style="margin:0"></p>
      </div>

      <div id="leaderWrap" style="margin-top:12px">
        <h3 class="muted" data-i18n="challenge.leaderboard">Leaderboard</h3>
        <ol class="leaderboard" id="leaderList"></ol>
      </div>

      <div id="speciesChecklistWrap" style="display:none; margin-top:16px">
        <h3 class="muted" data-i18n="challenge.speciesHunt.checklistTitle">Species to find</h3>
        <div id="speciesChecklist"></div>
      </div>

      <div id="closeWrap" style="display:none; margin-top:12px; text-align:center">
        <button id="btnClose" class="secondary" type="button"
                data-i18n="challenge.active.close">
          Close leaderboard
        </button>
      </div>
    </div>
  `;

  const activeCard = wrap.querySelector("#activeCard");
  const activeCardSubtitle = wrap.querySelector("#activeCard h1");
  const activeLineEl = wrap.querySelector("#activeLine");
  const leaderList = wrap.querySelector("#leaderList");
  const speciesChecklistWrap = wrap.querySelector("#speciesChecklistWrap");
  const speciesChecklist = wrap.querySelector("#speciesChecklist");
  const closeWrap = wrap.querySelector("#closeWrap");
  const btnClose = wrap.querySelector("#btnClose");

  let closeCb = null;
  let _lastSpeciesList = [];
  let _lastFoundSpecies = [];
  let _lastFoundGbifIds = [];
  const _imgCache = new Map();

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

  document.addEventListener("i18n:changed", () => {
    translateDom(wrap);
    renderChecklist(_lastSpeciesList, _lastFoundSpecies, _lastFoundGbifIds);
  });

  let myUid = null;

  function renderChecklist(speciesList, foundSpecies, foundGbifIds = []) {
    if (!speciesList.length) {
      speciesChecklistWrap.style.display = "none";
      speciesChecklist.innerHTML = "";
      return;
    }

    speciesChecklistWrap.style.display = "block";
    speciesChecklist.innerHTML = "";

    const foundSet = new Set(foundSpecies.map(s => String(s).trim().toLowerCase()));
    const foundGbifSet = new Set(foundGbifIds.map(id => Number(id)));

    // Global debug block: raw Firestore arrays
    const globalDebug = document.createElement("div");
    globalDebug.className = "mission-debug-section";
    const globalTitle = document.createElement("div");
    globalTitle.className = "debug-title";
    globalTitle.textContent = "species hunt debug";
    const globalPre = document.createElement("pre");
    globalPre.textContent =
      `foundSpecies: ${JSON.stringify(foundSpecies)}\nfoundGbifIds: ${JSON.stringify(foundGbifIds)}`;
    globalDebug.appendChild(globalTitle);
    globalDebug.appendChild(globalPre);
    speciesChecklist.appendChild(globalDebug);

    speciesList.forEach((species, i) => {
      if (i > 0) {
        const hr = document.createElement("hr");
        hr.className = "checklist-divider";
        speciesChecklist.appendChild(hr);
      }

      const speciesGbifId = species.gbif_id ? Number(species.gbif_id) : null;
      const matchByName = foundSet.has(String(species.name || "").trim().toLowerCase());
      const matchByGbif = speciesGbifId != null && foundGbifSet.has(speciesGbifId);
      const isFound = matchByName || matchByGbif;
      const row = document.createElement("div");
      row.className = "checklist-row" + (isFound ? " checklist-row-found" : "");

      const imgUrl = species.image_url || species.image || "";

      // Build row using DOM to avoid escaping issues
      const imgWrap = document.createElement("div");
      imgWrap.className = "checklist-img-wrap";
      if (imgUrl) {
        const img = document.createElement("img");
        img.src = imgUrl; img.alt = ""; img.className = "checklist-img"; img.loading = "lazy";
        imgWrap.appendChild(img);
      } else if (species.name) {
        const cacheKey = species.name.trim().toLowerCase();
        if (!_imgCache.has(cacheKey)) {
          _imgCache.set(cacheKey, getWikipediaImage(species.name).catch(() => ""));
        }
        _imgCache.get(cacheKey).then(url => {
          if (url && imgWrap.isConnected) {
            const img = document.createElement("img");
            img.src = url; img.alt = ""; img.className = "checklist-img"; img.loading = "lazy";
            imgWrap.appendChild(img);
          }
        });
      }

      const info = document.createElement("div");
      info.className = "checklist-info";

      const sciEl = document.createElement("em");
      sciEl.className = "checklist-sci";
      sciEl.textContent = species.name || "";

      const commonEl = document.createElement("span");
      commonEl.className = "checklist-common muted";
      commonEl.textContent = species.vernacular_name || "";

      const footer = document.createElement("div");
      footer.className = "checklist-footer";

      const badges = document.createElement("div");
      badges.className = "checklist-badges";
      if (species.is_flowering) {
        const b = document.createElement("span");
        b.className = "badge flowering-badge is-visible";
        b.textContent = `🌸 ${t("missions.card.flowering")}`;
        badges.appendChild(b);
      }
      if (species.is_fruiting) {
        const b = document.createElement("span");
        b.className = "badge fruiting-badge is-visible";
        b.textContent = `🍎 ${t("missions.card.fruiting")}`;
        badges.appendChild(b);
      }

      footer.appendChild(badges);
      info.appendChild(sciEl);
      info.appendChild(commonEl);
      info.appendChild(footer);
      row.appendChild(imgWrap);
      row.appendChild(info);

      if (isFound) {
        const mark = document.createElement("div");
        mark.className = "checklist-found-mark";
        mark.textContent = "✓";
        row.appendChild(mark);
      }

      // Per-species debug block
      const debugEl = document.createElement("div");
      debugEl.className = "mission-debug-section";
      const debugTitle = document.createElement("div");
      debugTitle.className = "debug-title";
      debugTitle.textContent = "debug";
      const debugPre = document.createElement("pre");
      const foundBy = matchByGbif && matchByName ? "gbif+name" : matchByGbif ? "gbif" : matchByName ? "name" : "—";
      debugPre.textContent = [
        `gbif_id: ${speciesGbifId ?? "none"}`,
        `match_by_name: ${matchByName ? "✓" : "✗"}`,
        `match_by_gbif: ${matchByGbif ? "✓" : "✗"}`,
        `found_by: ${foundBy}`,
      ].join("\n");
      debugEl.appendChild(debugTitle);
      debugEl.appendChild(debugPre);
      row.appendChild(debugEl);

      row.style.cursor = "pointer";
      row.addEventListener("click", (e) => {
        if (e.target.closest("a")) return; // let external links through
        const card = MissionCard(species, { showPoints: false, showMissionPrefix: false });
        document.body.appendChild(Modal({ content: card }));
      });

      speciesChecklist.appendChild(row);
    });
  }

  return {
    element: wrap,

    setActiveChallenge(payload) {
      const code = payload?.code;
      const endsAtMs = payload?.endsAtMs;
      const type = payload?.type || "points";

      if (!code) {
        activeCard.style.display = "none";
        return;
      }

      activeCard.style.display = "block";

      if (activeCardSubtitle) {
        activeCardSubtitle.textContent = type === "species_hunt"
          ? t("challenge.speciesHunt.activeSubtitle")
          : t("challenge.active.subtitle");
      }

      const codeSpan = document.createElement("span");
      codeSpan.className = "inline-copy";
      codeSpan.title = "Click to copy";
      codeSpan.innerHTML = `${code}<svg class="inline-copy-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      codeSpan.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(code);
          const originalHtml = codeSpan.innerHTML;
          codeSpan.textContent = "Copied!";
          codeSpan.classList.add("copied");
          setTimeout(() => {
            codeSpan.innerHTML = originalHtml;
            codeSpan.classList.remove("copied");
          }, 1500);
        } catch (e) {}
      });

      activeLineEl.textContent = "";
      activeLineEl.append(
        document.createTextNode(`${t("challenge.active.code")} `),
        codeSpan,
      );

      if (endsAtMs && Date.now() < endsAtMs) {
        activeLineEl.append(
          document.createTextNode(` - ${t("challenge.active.timeLeft")} ${fmtTimeLeft(endsAtMs - Date.now())}`)
        );
      }
    },

    setTimeLeft(endsAtMs) {
      // Update only the trailing text node, preserving the code span
      const codeSpan = activeLineEl.querySelector(".inline-copy");
      activeLineEl.textContent = "";
      if (codeSpan) {
        activeLineEl.append(
          document.createTextNode(`${t("challenge.active.code")} `),
          codeSpan,
          document.createTextNode(` - ${t("challenge.active.timeLeft")} ${fmtTimeLeft(endsAtMs - Date.now())}`)
        );
      }
    },

    setEnded(isEnded) {
      if (isEnded) {
        const codeSpan = activeLineEl.querySelector(".inline-copy");
        activeLineEl.textContent = "";
        if (codeSpan) {
          activeLineEl.append(
            document.createTextNode(`${t("challenge.active.code")} `),
            codeSpan,
            document.createTextNode(` - ${t("challenge.active.ended")}`)
          );
        }
        closeWrap.style.display = "block";
      } else {
        closeWrap.style.display = "none";
      }
    },

    renderLeaderboard(rows = [], type = "points") {
      leaderList.innerHTML = "";

      const scoreLabel = type === "species_hunt"
        ? t("challenge.speciesHunt.scoreLabel")
        : "pts";

      const maxScore = Math.max(...rows.map(r => r.score || 0), 1);

      rows.forEach((r, i) => {
        const percent = Math.round(((r.score || 0) / maxScore) * 100);
        const li = document.createElement("li");
        li.className = "leader-item";

        // current user: only text color change
        if (myUid && r.uid === myUid) {
          li.classList.add("leader-me");
        }

        // top 3: gold/silver/bronze highlight like the old "me" background effect
        if (i === 0) li.classList.add("leader-top1");
        else if (i === 1) li.classList.add("leader-top2");
        else if (i === 2) li.classList.add("leader-top3");

        // optional flash animation stays
        li.classList.add("leader-flash");
        setTimeout(() => li.classList.remove("leader-flash"), 500);

        let medal = "";
        if (i === 0) medal = `<span class="rank-flower gold">✿</span>`;
        else if (i === 1) medal = `<span class="rank-flower silver">✿</span>`;
        else if (i === 2) medal = `<span class="rank-flower bronze">✿</span>`;
        else medal = `<span class="rank-number">#${i + 1}</span>`;

        li.innerHTML = `
          <div class="leader-rank">${medal}</div>
          <div class="leader-name"></div>
          <div class="leader-score">${r.score || 0} ${scoreLabel}</div>
          <div class="leader-bar">
            <div class="leader-bar-fill" style="width:${percent}%"></div>
          </div>
        `;

        // safer than innerHTML for username
        li.querySelector(".leader-name").textContent = r.username || "—";

        leaderList.appendChild(li);
      });
    },

    renderSpeciesChecklist(speciesList = [], foundSpecies = [], foundGbifIds = []) {
      _lastSpeciesList = speciesList;
      _lastFoundSpecies = foundSpecies;
      _lastFoundGbifIds = foundGbifIds;
      renderChecklist(speciesList, foundSpecies, foundGbifIds);
    },

    setMyUid(uid) {
      myUid = uid || null;
    },

    onClose(cb) {
      closeCb = cb;
    },
  };
}
