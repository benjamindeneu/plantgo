// src/controllers/ChallengeModal.controller.js
import { Modal } from "../ui/components/Modal.js";
import { t, translateDom } from "../language/i18n.js";
import { createChallenge, joinChallengeByCode, listChallengeHistory } from "../data/challenges.js";
import { auth } from "../../firebase-config.js";
import { getCurrentPosition } from "../data/geo.service.js";
import { fetchPredictions } from "../api/plantgo.js";

/**
 * Challenge types that can be created, in the order they are offered.
 *
 * The points race is off for now — put "points" back in this list to offer it
 * again. This gates creation only: a points race that already exists still
 * scores and still renders wherever challenges are shown, so re-enabling it
 * needs no other change.
 */
const CREATABLE_TYPES = ["species_hunt"];

const TYPE_LABEL_KEY = {
  points: "challenge.type.points",
  species_hunt: "challenge.type.speciesHunt",
};

export function ChallengeModal({ onJoined } = {}) {
  const typeOptions = CREATABLE_TYPES
    .map((v) => `<option value="${v}" data-i18n="${TYPE_LABEL_KEY[v]}"></option>`)
    .join("");
  // With a single type there is no choice to present, so the row is dropped
  // rather than shown as a select with one entry.
  const typeRowStyle = CREATABLE_TYPES.length > 1 ? "flex" : "none";

  const content = `
    <div class="panel-tab-bar" role="tablist">
      <span class="panel-tab panel-tab--active" id="tabCreate" role="tab" tabindex="0" aria-selected="true"
            data-i18n="challenge.create.tab">Create</span>
      <span class="panel-tab" id="tabJoin" role="tab" tabindex="0" aria-selected="false"
            data-i18n="challenge.join.tab">Join</span>
      <span class="panel-tab" id="tabHistory" role="tab" tabindex="0" aria-selected="false"
            data-i18n="challenge.history.tab">History</span>
    </div>

    <div id="paneCreate" style="display:flex; flex-direction:column; gap:12px">
      <div id="typeRow" style="display:${typeRowStyle}; gap:8px; align-items:center; flex-wrap:wrap">
        <label class="muted" for="challengeType" data-i18n="challenge.type.label">Type</label>
        <select id="challengeType" class="input" style="width:160px">${typeOptions}</select>
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
      </div>
      <div id="modelRow" style="display:none; gap:8px; align-items:center; flex-wrap:wrap">
        <label class="muted" for="challengeModel" data-i18n="missions.chooseModel">Model</label>
        <select id="challengeModel" class="input" style="width:160px">
          <option value="best" data-i18n="missions.model.auto">Auto</option>
          <option value="geoplantnet" data-i18n="missions.model.geoplantnet">GeoPlantNet</option>
        </select>
      </div>
      <div id="speciesCountRow" style="display:none; gap:8px; align-items:center; flex-wrap:wrap">
        <label class="muted" for="challengeSpeciesCount" data-i18n="challenge.speciesHunt.speciesCount">Species</label>
        <select id="challengeSpeciesCount" class="input" style="width:160px">
            <option value="10">10</option>
          <option value="15">15</option>
          <option value="20" selected>20</option>
          <option value="25">25</option>
          <option value="30">30</option>
          <option value="35">35</option>
          <option value="40">40</option>
          <option value="45">45</option>
          <option value="50">50</option>
        </select>
      </div>
      <div id="speciesHuntInfo" class="muted" style="display:none; font-size:0.9em"></div>
      <button id="btnCreate" class="primary" type="button" data-i18n="challenge.create.button">Create</button>
      <div id="createOut" class="muted" style="display:none"></div>
    </div>

    <div id="paneJoin" style="display:none; flex-direction:column; gap:12px">
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
        <input id="joinCode" class="input" style="flex:1; text-transform:uppercase"
          maxlength="5" data-i18n-placeholder="challenge.join.placeholder" placeholder="ABCDE" />
        <button id="btnJoin" class="secondary" type="button" data-i18n="challenge.join.button">Join</button>
      </div>
      <div id="joinOut" class="muted" style="display:none"></div>
    </div>

    <div id="paneHistory" class="mp-history" style="display:none">
      <p class="mp-history__status muted" data-i18n="challenge.history.loading">Loading…</p>
      <ol class="mp-history__list"></ol>
    </div>

    <div id="feedback" class="validation-feedback" aria-live="polite"></div>
  `;

  const modal = Modal({
    title: t("challenge.modal.title"),
    content,
  });

  // Make the modal OK button say "Close"
  const doneBtn = modal.querySelector("#doneBtn");
  if (doneBtn) doneBtn.textContent = t("common.close");

  // translate content
  translateDom(modal);

  const tabs = {
    create: { tab: modal.querySelector("#tabCreate"), pane: modal.querySelector("#paneCreate"), display: "flex" },
    join: { tab: modal.querySelector("#tabJoin"), pane: modal.querySelector("#paneJoin"), display: "flex" },
    history: { tab: modal.querySelector("#tabHistory"), pane: modal.querySelector("#paneHistory"), display: "block" },
  };

  function setTab(which) {
    for (const [name, { tab, pane, display }] of Object.entries(tabs)) {
      const on = name === which;
      tab.classList.toggle("panel-tab--active", on);
      tab.setAttribute("aria-selected", String(on));
      pane.style.display = on ? display : "none";
    }
    if (which === "history") loadHistory();
  }

  for (const [name, { tab }] of Object.entries(tabs)) {
    tab.addEventListener("click", () => setTab(name));
    tab.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTab(name); } });
  }

  // --- past challenges ---
  // Read once per opening of the modal: the list only changes when a
  // challenge ends, and that is not something that happens while it is open.
  let historyLoaded = false;
  const historyStatus = modal.querySelector(".mp-history__status");
  const historyList = modal.querySelector(".mp-history__list");

  async function loadHistory() {
    if (historyLoaded) return;
    historyLoaded = true;
    try {
      const items = await listChallengeHistory(auth.currentUser?.uid);
      historyList.replaceChildren(...items.map(historyRow));
      historyStatus.textContent = items.length ? "" : t("challenge.history.empty");
      historyStatus.hidden = !!items.length;
    } catch (e) {
      console.error("[ChallengeModal] history failed:", e);
      historyStatus.textContent = t("challenge.error.generic");
      historyLoaded = false;
    }
  }

  function historyRow(h) {
    const li = document.createElement("li");
    li.className = `mp-history__row${h.won ? " is-won" : ""}`;
    const medal = h.rank === 1 && h.players >= 2 ? "🥇" : h.rank === 2 ? "🥈" : h.rank === 3 ? "🥉" : "🏁";
    const date = h.endedAtMs
      ? new Date(h.endedAtMs).toLocaleDateString(document.documentElement.lang || "en", { day: "numeric", month: "short" })
      : "";
    const place = h.players >= 2 ? t("challenge.result.place", { rank: h.rank, players: h.players }) : t("challenge.result.solo");
    const found = h.total ? t("challenge.result.found", { found: h.found, total: h.total }) : "";
    li.innerHTML = `
      <span class="mp-history__medal" aria-hidden="true"></span>
      <span class="mp-history__text">
        <span class="mp-history__line"></span>
        <span class="mp-history__meta"></span>
      </span>
      <span class="mp-history__pts"></span>
    `;
    li.querySelector(".mp-history__medal").textContent = medal;
    li.querySelector(".mp-history__line").textContent = place;
    li.querySelector(".mp-history__meta").textContent = [date, found].filter(Boolean).join(" · ");
    li.querySelector(".mp-history__pts").textContent = h.points > 0 ? `+${h.points} ${t("result.ptsShort")}` : "";
    return li;
  }

  const elType = modal.querySelector("#challengeType");
  const elDuration = modal.querySelector("#challengeDuration");
  const modelRow = modal.querySelector("#modelRow");
  const elModel = modal.querySelector("#challengeModel");
  const speciesCountRow = modal.querySelector("#speciesCountRow");
  const elSpeciesCount = modal.querySelector("#challengeSpeciesCount");
  const speciesHuntInfo = modal.querySelector("#speciesHuntInfo");
  const btnCreate = modal.querySelector("#btnCreate");
  const createOut = modal.querySelector("#createOut");

  const joinCode = modal.querySelector("#joinCode");
  const btnJoin = modal.querySelector("#btnJoin");
  const joinOut = modal.querySelector("#joinOut");

  const feedback = modal.querySelector("#feedback");

  // Predictions fetched at challenge creation time for species hunt
  let fetchedPredictions = [];

  function show(el, text) {
    el.style.display = text ? "block" : "none";
    el.textContent = text || "";
  }

  function setFeedback(text) {
    feedback.textContent = text || "";
  }

  // Runs on init as well as on change: with the points race off, a hunt is
  // selected from the start and its extra rows have to be showing already.
  function applyType() {
    const isHunt = (elType?.value || CREATABLE_TYPES[0]) === "species_hunt";
    modelRow.style.display = isHunt ? "flex" : "none";
    speciesCountRow.style.display = isHunt ? "flex" : "none";
    if (!isHunt) {
      speciesHuntInfo.style.display = "none";
      fetchedPredictions = [];
    } else {
      speciesHuntInfo.style.display = "block";
      speciesHuntInfo.textContent = t("challenge.speciesHunt.infoLocate");
    }
  }

  elType?.addEventListener("change", applyType);
  applyType();

  joinCode?.addEventListener("input", () => {
    joinCode.value = joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  });

  btnCreate?.addEventListener("click", async () => {
    try {
      setFeedback("");
      show(joinOut, "");
      btnCreate.style.display = "none";

      const durationSec = Number(elDuration?.value || 1800);
      const type = elType?.value || CREATABLE_TYPES[0];

      if (type === "species_hunt") {
        // Step 1: get location
        show(createOut, t("identify.feedback.fetchingLocation"));
        const pos = await getCurrentPosition();
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const lang = document.documentElement.lang || "en";

        // Step 2: fetch predictions from backend
        show(createOut, t("challenge.speciesHunt.fetchingSpecies"));
        const model = elModel?.value || "best";
        const limit = Number(elSpeciesCount?.value || 20);
        const data = await fetchPredictions({ lat, lon, lang, model, limit });
        const predictions = Array.isArray(data?.predictions) ? data.predictions : [];
        // Sort by rank ascending (rank 0 = best); fall back to index for species without rank
        fetchedPredictions = predictions
          .slice()
          .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

        if (fetchedPredictions.length < 2) {
          show(createOut, "");
          setFeedback(t("challenge.speciesHunt.error.minSpecies"));
          return;
        }

        speciesHuntInfo.style.display = "block";
        speciesHuntInfo.textContent = t("challenge.speciesHunt.missionsInfo").replace(
          "{count}", fetchedPredictions.length
        );
      }

      // Step 3: create the challenge
      show(createOut, t("challenge.creating"));
      const res = await createChallenge({
        durationSec,
        type,
        speciesList: type === "species_hunt" ? fetchedPredictions : [],
      });

      // ChallengePanel will restore/show active automatically via users/{uid}.activeChallenge
      modal.querySelector(".body").innerHTML =
        `<p style="text-align:center;padding:12px 0">${t("challenge.created")} ${res.code}</p>`;
      onJoined?.();
    } catch (e) {
      show(createOut, "");
      setFeedback(e?.message || t("challenge.error.generic"));
      btnCreate.style.display = "";
    }
  });

  btnJoin?.addEventListener("click", async () => {
    try {
      setFeedback("");
      show(createOut, "");

      const code = String(joinCode?.value || "").trim().toUpperCase();
      if (code.length !== 5) {
        show(joinOut, t("challenge.join.invalidCode"));
        return;
      }

      show(joinOut, t("challenge.joining"));
      await joinChallengeByCode(code);

      modal.querySelector(".body").innerHTML =
        `<p style="text-align:center;padding:12px 0">${t("challenge.joined")}</p>`;
      onJoined?.();
    } catch (e) {
      show(joinOut, "");
      setFeedback(e?.message || t("challenge.error.generic"));
    }
  });

  return modal;
}
