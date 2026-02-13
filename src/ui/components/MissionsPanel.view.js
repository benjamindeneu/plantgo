// src/ui/components/MissionsPanel.view.js
import { MissionCard } from "../../controllers/MissionCard.controller.js";
import { t, initI18n, translateDom } from "../../language/i18n.js";

await initI18n();
translateDom(document);

function renderMissionsList(listEl, missionsList = []) {
  listEl.innerHTML = "";
  if (!missionsList.length) {
    listEl.textContent = t("missions.empty");
    return;
  }
  for (const m of missionsList) listEl.appendChild(MissionCard(m));
}

function renderModelLine(modelEl, model, missionsList = []) {
  const hasMissions = Array.isArray(missionsList) && missionsList.length > 0;

  if (!hasMissions || !model) {
    modelEl.textContent = "";
    modelEl.style.display = "none";
    return;
  }

  modelEl.style.display = "";
  modelEl.textContent = `${t("missions.modelUsed")}: ${model}`;
}

export function createMissionsPanelView() {
  const sec = document.createElement("section");
  sec.className = "card";
  sec.innerHTML = `
    <h1 data-i18n="missions.title">Your missions</h1>

    <div style="display:flex;gap:8px;justify-content:center;margin-bottom:8px">
      <button id="locate" class="secondary" type="button" data-i18n="missions.refresh">
        Refresh Missions
      </button>
    </div>

    <div id="status" aria-live="polite" class="validation-feedback"></div>
    <div id="list" class="form-grid"></div>

    <!-- model used -->
    <div id="modelLine" class="muted" style="margin-top:8px;text-align:center;display:none;"></div>
  `;

  const statusEl = sec.querySelector("#status");
  const listEl = sec.querySelector("#list");
  const locateBtn = sec.querySelector("#locate");
  const modelEl = sec.querySelector("#modelLine");

  // keep last missions so we can re-render on language change
  let lastMissions = [];
  let lastModel = "";

  function refreshI18n() {
    renderMissionsList(listEl, lastMissions);
    renderModelLine(modelEl, lastModel, lastMissions);
  }

  translateDom(document);
  document.addEventListener("i18n:changed", refreshI18n);

  // optional: initial message
  statusEl.textContent = " ";

  return {
    element: sec,
    setStatus(text) {
      statusEl.textContent = text ?? "";
    },

    // UPDATED: accept model too
    renderMissions(missions, model) {
      lastMissions = Array.isArray(missions) ? missions : [];
      lastModel = model ?? "";
      renderMissionsList(listEl, lastMissions);
      renderModelLine(modelEl, lastModel, lastMissions);
    },

    onLocate(handler) {
      locateBtn.addEventListener("click", handler);
    },

    refreshI18n,
  };
}
