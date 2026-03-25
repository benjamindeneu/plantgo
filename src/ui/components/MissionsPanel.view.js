// src/ui/components/MissionsPanel.view.js
import { MissionCard } from "../../controllers/MissionCard.controller.js";
import { t, initI18n, translateDom } from "../../language/i18n.js";
import { Modal } from "./Modal.js";
import { debugMode } from "../../data/debugMode.js";

await initI18n();
translateDom(document);
debugMode.init();

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

    <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-bottom:8px">
      <button id="locate" class="secondary" type="button" data-i18n="missions.refresh">
        Refresh Missions
      </button>
      <button id="settingsBtn" class="secondary btn-icon" type="button" aria-label="Settings">⚙</button>
    </div>

    <div id="status" aria-live="polite" class="validation-feedback"></div>
    <div id="loadingTrack" class="loading-track" style="display:none" aria-hidden="true">
      <div class="loading-indeterminate"></div>
    </div>
    <div id="list" class="form-grid" style="text-align:center"></div>

    <!-- model used -->
    <div id="modelLine" class="muted" style="margin-top:8px;text-align:center;display:none;"></div>
  `;

  const statusEl     = sec.querySelector("#status");
  const loadingTrack = sec.querySelector("#loadingTrack");
  const listEl       = sec.querySelector("#list");
  const locateBtn    = sec.querySelector("#locate");
  const modelEl      = sec.querySelector("#modelLine");
  const settingsBtn  = sec.querySelector("#settingsBtn");

  // persistent select element — survives modal open/close cycles
  const modelSelect = document.createElement("select");
  modelSelect.className = "input";
  modelSelect.style.cssText = "width:100%;padding:8px 10px;margin-top:6px";
  modelSelect.innerHTML = `<option value="best">${t("missions.model.auto")}</option>`;

  const modelLabel = document.createElement("label");
  modelLabel.className = "muted";
  modelLabel.style.cssText = "display:flex;flex-direction:column";
  const modelLabelSpan = document.createElement("span");
  modelLabelSpan.setAttribute("data-i18n", "missions.chooseModel");
  modelLabelSpan.textContent = t("missions.chooseModel");
  modelLabel.appendChild(modelLabelSpan);
  modelLabel.appendChild(modelSelect);

  let settingsOpenHandler = null;

  settingsBtn.addEventListener("click", () => {
    // open modal immediately
    const modal = Modal({ title: t("settings.title"), content: "" });
    const body = modal.querySelector(".body");

    const loadingTrackModal = document.createElement("div");
    loadingTrackModal.className = "loading-track";
    loadingTrackModal.innerHTML = `<div class="loading-indeterminate"></div>`;
    body.appendChild(loadingTrackModal);
    modelLabel.style.display = "none";
    body.appendChild(modelLabel);

    const debugLabel = document.createElement("label");
    debugLabel.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer";
    const debugCheckbox = document.createElement("input");
    debugCheckbox.type = "checkbox";
    debugCheckbox.checked = debugMode.get();
    debugCheckbox.addEventListener("change", () => debugMode.set(debugCheckbox.checked));
    debugLabel.appendChild(debugCheckbox);
    debugLabel.appendChild(document.createTextNode("Debug mode"));
    body.appendChild(debugLabel);

    document.body.appendChild(modal);

    if (!settingsOpenHandler) return;

    settingsOpenHandler().then(data => {
      if (data) {
        const currentVal = modelSelect.value;
        const models = data.models ?? [];
        const defaultModel = data.default_model ?? null;

        // "Auto (FlorID)" when we know what the backend will pick
        const defaultName = defaultModel
          ? (models.find(m => m.id === defaultModel)?.name ?? defaultModel)
          : null;
        const autoLabel = defaultName
          ? `${t("missions.model.auto")} (${defaultName})`
          : t("missions.model.auto");

        modelSelect.innerHTML = "";

        const defaultGroup = document.createElement("optgroup");
        defaultGroup.label = t("missions.model.group.default");
        const autoOpt = document.createElement("option");
        autoOpt.value = "best";
        autoOpt.textContent = autoLabel;
        defaultGroup.appendChild(autoOpt);
        modelSelect.appendChild(defaultGroup);

        if (models.length) {
          const availableGroup = document.createElement("optgroup");
          availableGroup.label = t("missions.model.group.available");
          for (const m of models) {
            const opt = document.createElement("option");
            opt.value = m.id;
            opt.textContent = m.name;
            availableGroup.appendChild(opt);
          }
          modelSelect.appendChild(availableGroup);
        }

        // restore manual pick if still available, otherwise default to auto
        const preserved = currentVal !== "best" &&
          [...modelSelect.options].some(o => o.value === currentVal);
        modelSelect.value = preserved ? currentVal : "best";
      }
    }).catch(() => {}).finally(() => {
      loadingTrackModal.remove();
      modelLabel.style.display = "";
    });
  });

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

    setLoading(on) {
      loadingTrack.style.display = on ? "" : "none";
    },

    renderMissions(missions, model) {
      lastMissions = Array.isArray(missions) ? missions : [];
      lastModel = model ?? "";
      renderMissionsList(listEl, lastMissions);
      renderModelLine(modelEl, lastModel, lastMissions);
    },

    onSettingsOpen(handler) {
      settingsOpenHandler = handler;
    },

    getSelectedModel() {
      return modelSelect?.value || "best";
    },

    onLocate(handler) {
      locateBtn.addEventListener("click", handler);
    },

    refreshI18n,
  };
}
