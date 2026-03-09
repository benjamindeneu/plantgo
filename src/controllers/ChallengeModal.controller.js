// src/controllers/ChallengeModal.controller.js
import { Modal } from "../ui/components/Modal.js";
import { t, translateDom } from "../language/i18n.js";
import { createChallenge, joinChallengeByCode } from "../data/challenges.js";
import { getCurrentPosition } from "../data/geo.service.js";
import { fetchPredictions } from "../api/plantgo.js";

export function ChallengeModal() {
  const content = `
    <div class="form-grid" style="gap:12px">

      <div class="card" style="padding:12px">
        <div class="muted" data-i18n="challenge.create.subtitle">Create a challenge</div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px">
          <label class="muted" for="challengeType" data-i18n="challenge.type.label">Type</label>
          <select id="challengeType" class="input" style="width:160px">
            <option value="points" data-i18n="challenge.type.points">Points Race</option>
            <option value="species_hunt" data-i18n="challenge.type.speciesHunt">Species Hunt</option>
          </select>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px">
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
        <div id="modelRow" style="display:none; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px">
          <label class="muted" for="challengeModel" data-i18n="missions.chooseModel">Model</label>
          <select id="challengeModel" class="input" style="width:160px">
            <option value="best" data-i18n="missions.model.auto">Auto</option>
            <option value="geoplantnet" data-i18n="missions.model.geoplantnet">GeoPlantNet</option>
          </select>
        </div>
        <div id="speciesHuntInfo" class="muted" style="margin-top:8px; display:none; font-size:0.9em"></div>
        <div style="margin-top:8px">
          <button id="btnCreate" class="primary" type="button" data-i18n="challenge.create.button">Create</button>
        </div>
        <div id="createOut" class="muted" style="margin-top:10px; display:none"></div>
      </div>

      <div class="card" style="padding:12px">
        <div class="muted" data-i18n="challenge.join.subtitle">Join a challenge</div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px">
          <input id="joinCode" class="input" style="width:160px; text-transform:uppercase"
            maxlength="5" data-i18n-placeholder="challenge.join.placeholder" placeholder="ABCDE" />
          <button id="btnJoin" class="secondary" type="button" data-i18n="challenge.join.button">Join</button>
        </div>
        <div id="joinOut" class="muted" style="margin-top:10px; display:none"></div>
      </div>

      <div id="feedback" class="validation-feedback" aria-live="polite"></div>
    </div>
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

  const elType = modal.querySelector("#challengeType");
  const elDuration = modal.querySelector("#challengeDuration");
  const modelRow = modal.querySelector("#modelRow");
  const elModel = modal.querySelector("#challengeModel");
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

      show(createOut, `${t("challenge.created")} ${res.code}`);
      // ChallengePanel will restore/show active automatically via users/{uid}.activeChallenge
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

      show(joinOut, t("challenge.joined"));
    } catch (e) {
      show(joinOut, "");
      setFeedback(e?.message || t("challenge.error.generic"));
    }
  });

  return modal;
}
