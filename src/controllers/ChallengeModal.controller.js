// src/controllers/ChallengeModal.controller.js
import { Modal } from "../ui/components/Modal.js";
import { t, translateDom } from "../language/i18n.js";
import { createChallenge, joinChallengeByCode } from "../data/challenges.js";
import { getCurrentPosition } from "../data/geo.service.js";
import { fetchPredictions } from "../api/plantgo.js";

export function ChallengeModal() {
  const content = `
    <div class="panel-tab-bar" role="tablist">
      <span class="panel-tab panel-tab--active" id="tabCreate" role="tab" tabindex="0" aria-selected="true"
            data-i18n="challenge.create.tab">Create</span>
      <span class="panel-tab" id="tabJoin" role="tab" tabindex="0" aria-selected="false"
            data-i18n="challenge.join.tab">Join</span>
    </div>

    <div id="paneCreate" style="display:flex; flex-direction:column; gap:12px">
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
        <label class="muted" for="challengeType" data-i18n="challenge.type.label">Type</label>
        <select id="challengeType" class="input" style="width:160px">
          <option value="points" data-i18n="challenge.type.points">Points Race</option>
          <option value="species_hunt" data-i18n="challenge.type.speciesHunt">Species Hunt</option>
        </select>
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
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="15">15</option>
          <option value="20" selected>20</option>
          <option value="30">30</option>
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

  const tabCreate = modal.querySelector("#tabCreate");
  const tabJoin = modal.querySelector("#tabJoin");
  const paneCreate = modal.querySelector("#paneCreate");
  const paneJoin = modal.querySelector("#paneJoin");

  function setTab(tab) {
    const isCreate = tab === "create";
    tabCreate.classList.toggle("panel-tab--active", isCreate);
    tabCreate.setAttribute("aria-selected", String(isCreate));
    tabJoin.classList.toggle("panel-tab--active", !isCreate);
    tabJoin.setAttribute("aria-selected", String(!isCreate));
    paneCreate.style.display = isCreate ? "flex" : "none";
    paneJoin.style.display = isCreate ? "none" : "flex";
  }

  tabCreate.addEventListener("click", () => setTab("create"));
  tabJoin.addEventListener("click", () => setTab("join"));
  tabCreate.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTab("create"); } });
  tabJoin.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTab("join"); } });

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

  elType?.addEventListener("change", () => {
    const isHunt = elType.value === "species_hunt";
    modelRow.style.display = isHunt ? "flex" : "none";
    speciesCountRow.style.display = isHunt ? "flex" : "none";
    if (!isHunt) {
      speciesHuntInfo.style.display = "none";
      fetchedPredictions = [];
    } else {
      speciesHuntInfo.style.display = "block";
      speciesHuntInfo.textContent = t("challenge.speciesHunt.infoLocate");
    }
  });

  joinCode?.addEventListener("input", () => {
    joinCode.value = joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  });

  btnCreate?.addEventListener("click", async () => {
    try {
      setFeedback("");
      show(joinOut, "");

      const durationSec = Number(elDuration?.value || 1800);
      const type = elType?.value || "points";

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
        const data = await fetchPredictions({ lat, lon, lang, model });
        const predictions = Array.isArray(data?.predictions) ? data.predictions : [];
        // Sort by rank ascending (rank 0 = best); fall back to index for species without rank
        const wantedCount = Number(elSpeciesCount?.value || 20);
        fetchedPredictions = predictions
          .slice()
          .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
          .slice(0, wantedCount);

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
    } catch (e) {
      show(createOut, "");
      setFeedback(e?.message || t("challenge.error.generic"));
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
    } catch (e) {
      show(joinOut, "");
      setFeedback(e?.message || t("challenge.error.generic"));
    }
  });

  return modal;
}
