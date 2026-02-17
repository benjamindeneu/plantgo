// src/controllers/ChallengeModal.controller.js
import { Modal } from "../ui/components/Modal.js";
import { t, translateDom } from "../language/i18n.js";
import { createChallenge, joinChallengeByCode } from "../data/challenges.js";

export function ChallengeModal() {
  const content = `
    <div class="form-grid" style="gap:12px">

      <div class="card" style="padding:12px">
        <div class="muted" data-i18n="challenge.create.subtitle">Create a challenge</div>
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

  const elDuration = modal.querySelector("#challengeDuration");
  const btnCreate = modal.querySelector("#btnCreate");
  const createOut = modal.querySelector("#createOut");

  const joinCode = modal.querySelector("#joinCode");
  const btnJoin = modal.querySelector("#btnJoin");
  const joinOut = modal.querySelector("#joinOut");

  const feedback = modal.querySelector("#feedback");

  function show(el, text) {
    el.style.display = text ? "block" : "none";
    el.textContent = text || "";
  }

  function setFeedback(text) {
    feedback.textContent = text || "";
  }

  joinCode?.addEventListener("input", () => {
    joinCode.value = joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  });

  btnCreate?.addEventListener("click", async () => {
    try {
      setFeedback("");
      show(joinOut, "");
      show(createOut, t("challenge.creating"));

      const durationSec = Number(elDuration?.value || 1800);
      const res = await createChallenge({ durationSec });

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
