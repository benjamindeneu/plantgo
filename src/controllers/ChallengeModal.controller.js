// src/controllers/ChallengeModal.controller.js
import { Modal } from "../ui/components/Modal.js";
import { t, translateDom } from "../language/i18n.js";
import { createChallenge, joinChallengeByCode } from "../data/challenges.js";
import { auth } from "../../firebase-config.js";
import { getCachedMissions } from "../data/user.repo.js";

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
  const speciesHuntInfo = modal.querySelector("#speciesHuntInfo");
  const btnCreate = modal.querySelector("#btnCreate");
  const createOut = modal.querySelector("#createOut");

  const joinCode = modal.querySelector("#joinCode");
  const btnJoin = modal.querySelector("#btnJoin");
  const joinOut = modal.querySelector("#joinOut");

  const feedback = modal.querySelector("#feedback");

  // Cached missions for species hunt
  let cachedMissions = [];

  function show(el, text) {
    el.style.display = text ? "block" : "none";
    el.textContent = text || "";
  }

  function setFeedback(text) {
    feedback.textContent = text || "";
  }

  function cleanMissionForStorage(m) {
    const { wiki_extract_html, wiki_extract, description_html, ...rest } = m;
    return rest;
  }

  async function loadCreatorMissions() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const data = await getCachedMissions(uid);
      const missions = Array.isArray(data?.missions_list) ? data.missions_list : [];
      cachedMissions = missions.map(cleanMissionForStorage);
      if (cachedMissions.length > 0) {
        speciesHuntInfo.style.display = "block";
        speciesHuntInfo.textContent = t("challenge.speciesHunt.missionsInfo").replace(
          "{count}", cachedMissions.length
        );
      } else {
        speciesHuntInfo.style.display = "block";
        speciesHuntInfo.textContent = t("challenge.speciesHunt.noMissions");
      }
    } catch (e) {
      speciesHuntInfo.style.display = "block";
      speciesHuntInfo.textContent = t("challenge.speciesHunt.noMissions");
    }
  }

  elType?.addEventListener("change", () => {
    if (elType.value === "species_hunt") {
      loadCreatorMissions();
    } else {
      speciesHuntInfo.style.display = "none";
      cachedMissions = [];
    }
  });

  joinCode?.addEventListener("input", () => {
    joinCode.value = joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  });

  btnCreate?.addEventListener("click", async () => {
    try {
      setFeedback("");
      show(joinOut, "");
      show(createOut, t("challenge.creating"));

      const durationSec = Number(elDuration?.value || 1800);
      const type = elType?.value || "points";

      if (type === "species_hunt" && cachedMissions.length < 2) {
        show(createOut, "");
        setFeedback(t("challenge.speciesHunt.error.minSpecies"));
        return;
      }

      const res = await createChallenge({
        durationSec,
        type,
        speciesList: type === "species_hunt" ? cachedMissions : [],
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
