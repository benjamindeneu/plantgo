// src/ui/components/ChallengePanel.view.js
import { t, initI18n, translateDom } from "../../language/i18n.js";
import { getWikipediaImage } from "../../data/wiki.service.js";
await initI18n();

export function createChallengePanelView() {
  const wrap = document.createElement("section");
  wrap.className = "general-";

  wrap.innerHTML = `
    <div id="activeCard" class="card" style="display:none">

      <div style="text-align:center">
        <h1 data-i18n="challenge.active.subtitle">Active challenge</h1>

        <div style="display:flex; align-items: center; justify-content:center; gap: 8px;">
          <span id="activeLine" style="font-weight:700"></span>
          <span>-</span>
          <span id="timerLine" class="muted" style="display:none"></span>
          <span id="endedLine" class="muted" style="display:none" data-i18n="challenge.active.ended">
            Challenge ended
          </span>
        </div>
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
  const activeLine = wrap.querySelector("#activeLine");
  const timerLine = wrap.querySelector("#timerLine");
  const endedLine = wrap.querySelector("#endedLine");
  const leaderList = wrap.querySelector("#leaderList");
  const speciesChecklistWrap = wrap.querySelector("#speciesChecklistWrap");
  const speciesChecklist = wrap.querySelector("#speciesChecklist");
  const closeWrap = wrap.querySelector("#closeWrap");
  const btnClose = wrap.querySelector("#btnClose");

  let closeCb = null;
  let _lastSpeciesList = [];
  let _lastFoundSpecies = [];
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
    renderChecklist(_lastSpeciesList, _lastFoundSpecies);
  });

  let myUid = null;

  function renderChecklist(speciesList, foundSpecies) {
    if (!speciesList.length) {
      speciesChecklistWrap.style.display = "none";
      speciesChecklist.innerHTML = "";
      return;
    }

    speciesChecklistWrap.style.display = "block";
    speciesChecklist.innerHTML = "";

    const foundSet = new Set(foundSpecies.map(s => String(s).trim().toLowerCase()));
    const lang = document.documentElement.lang?.split("-")[0] || "en";

    speciesList.forEach((species, i) => {
      if (i > 0) {
        const hr = document.createElement("hr");
        hr.className = "checklist-divider";
        speciesChecklist.appendChild(hr);
      }

      const isFound = foundSet.has(String(species.name || "").trim().toLowerCase());
      const row = document.createElement("div");
      row.className = "checklist-row" + (isFound ? " checklist-row-found" : "");

      const imgUrl = species.image_url || species.image || "";
      const binomial = (species.name || "").trim().split(/\s+/).slice(0, 2).join(" ");
      const wikiUrl = binomial ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(binomial)}` : "";
      const gbifUrl = species.gbif_id ? `https://www.gbif.org/species/${encodeURIComponent(species.gbif_id)}` : "";

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

      const links = document.createElement("div");
      links.className = "checklist-links";
      if (wikiUrl) {
        const a = document.createElement("a");
        a.href = wikiUrl; a.target = "_blank"; a.rel = "noopener noreferrer";
        a.className = "wiki-ext-link"; a.setAttribute("aria-label", "Wikipedia");
        const img = document.createElement("img");
        img.src = "./assets/wikipedia-logo.svg"; img.alt = "Wikipedia"; img.width = 18; img.height = 18;
        a.appendChild(img); links.appendChild(a);
      }
      if (gbifUrl) {
        const a = document.createElement("a");
        a.href = gbifUrl; a.target = "_blank"; a.rel = "noopener noreferrer";
        a.className = "wiki-ext-link"; a.setAttribute("aria-label", "GBIF");
        const img = document.createElement("img");
        img.src = "./assets/gbif-logo.png"; img.alt = "GBIF"; img.width = 18; img.height = 18;
        a.appendChild(img); links.appendChild(a);
      }

      footer.appendChild(badges);
      footer.appendChild(links);
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

    renderSpeciesChecklist(speciesList = [], foundSpecies = []) {
      _lastSpeciesList = speciesList;
      _lastFoundSpecies = foundSpecies;
      renderChecklist(speciesList, foundSpecies);
    },

    setMyUid(uid) {
      myUid = uid || null;
    },

    onClose(cb) {
      closeCb = cb;
    },
  };
}
