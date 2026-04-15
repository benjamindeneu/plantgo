// src/ui/components/MissionsPanel.view.js
import { MissionCard } from "../../controllers/MissionCard.controller.js";
import { t, initI18n, translateDom } from "../../language/i18n.js";
import { Modal } from "./Modal.js";
import L from "https://esm.sh/leaflet@1.9.4";
await initI18n();
translateDom(document);

function renderMissionsList(listEl, missionsList = [], { showPoints = true, showMissionPrefix = true } = {}) {
  listEl.innerHTML = "";
  if (!missionsList.length) {
    listEl.textContent = t("missions.empty");
    return;
  }
  for (const m of missionsList) listEl.appendChild(MissionCard(m, { showPoints, showMissionPrefix }));
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
    <div class="panel-tab-bar" role="tablist">
      <span class="panel-tab panel-tab--active" id="tabAround" role="tab" tabindex="0" aria-selected="true" data-i18n="missions.tab.aroundYou">Around me</span>
      <span class="panel-tab" id="tabMissions" role="tab" tabindex="0" aria-selected="false" data-i18n="missions.tab.missions">Missions</span>
    </div>

    <p id="tabDesc" class="tab-desc muted"></p>

    <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-bottom:8px">
      <button id="locate" class="secondary" type="button" data-i18n="missions.refresh.around">
        Refresh predictions
      </button>
      <button id="settingsBtn" class="secondary btn-icon" type="button" aria-label="Settings">⚙</button>
    </div>

    <div id="status" aria-live="polite" class="validation-feedback"></div>
    <div id="loadingTrack" class="loading-spinner" style="display:none" aria-hidden="true"></div>

    <div id="locationMap" class="location-map" style="display:none"></div>

    <div id="paneAround" class="form-grid" style="text-align:center"></div>
    <div id="paneMissions" class="form-grid" style="text-align:center;display:none"></div>

    <!-- model used -->
    <div id="modelLine" class="muted" style="margin-top:8px;text-align:center;display:none;"></div>
  `;

  const statusEl      = sec.querySelector("#status");
  const loadingTrack  = sec.querySelector("#loadingTrack");
  const locationMapEl = sec.querySelector("#locationMap");
  const listMissions  = sec.querySelector("#paneMissions");
  const listAround    = sec.querySelector("#paneAround");
  const locateBtn     = sec.querySelector("#locate");
  const modelEl       = sec.querySelector("#modelLine");
  const settingsBtn   = sec.querySelector("#settingsBtn");
  const tabMissions   = sec.querySelector("#tabMissions");
  const tabAround     = sec.querySelector("#tabAround");
  const tabDescEl     = sec.querySelector("#tabDesc");

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

  // --- tab state ---
  let activeTab = "around"; // "missions" | "around"
  let tabSwitchHandler = null;

  function setActiveTab(tab) {
    activeTab = tab;
    tabMissions.classList.toggle("panel-tab--active", tab === "missions");
    tabMissions.setAttribute("aria-selected", tab === "missions" ? "true" : "false");
    tabAround.classList.toggle("panel-tab--active", tab === "around");
    tabAround.setAttribute("aria-selected", tab === "around" ? "true" : "false");
    listMissions.style.display = tab === "missions" ? "" : "none";
    listAround.style.display   = tab === "around"   ? "" : "none";
    locateBtn.setAttribute("data-i18n", tab === "around" ? "missions.refresh.around" : "missions.refresh");
    locateBtn.textContent = t(tab === "around" ? "missions.refresh.around" : "missions.refresh");
    tabDescEl.setAttribute("data-i18n", tab === "around" ? "missions.desc.around" : "missions.desc.missions");
    tabDescEl.textContent = t(tab === "around" ? "missions.desc.around" : "missions.desc.missions");
    if (tabSwitchHandler) tabSwitchHandler(tab);
  }

  function addTabListeners(el, tab) {
    el.addEventListener("click", () => setActiveTab(tab));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveTab(tab); }
    });
  }
  addTabListeners(tabMissions, "missions");
  addTabListeners(tabAround,   "around");

  // --- settings modal ---
  let settingsOpenHandler = null;

  settingsBtn.addEventListener("click", () => {
    const modal = Modal({ title: t("settings.title"), content: "" });
    const body = modal.querySelector(".body");

    const loadingTrackModal = document.createElement("div");
    loadingTrackModal.className = "loading-spinner";
    body.appendChild(loadingTrackModal);
    modelLabel.style.display = "none";
    body.appendChild(modelLabel);

    document.body.appendChild(modal);

    if (!settingsOpenHandler) return;

    settingsOpenHandler().then(data => {
      if (data) {
        const currentVal = modelSelect.value;
        const models = data.models ?? [];
        const defaultModel = data.default_model ?? null;

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

        const preserved = currentVal !== "best" &&
          [...modelSelect.options].some(o => o.value === currentVal);
        modelSelect.value = preserved ? currentVal : "best";
      }
    }).catch(() => {}).finally(() => {
      loadingTrackModal.remove();
      modelLabel.style.display = "";
    });
  });

  // keep last data so we can re-render on language change
  let lastMissions = [];
  let lastAround   = [];
  let lastModel    = "";

  function refreshI18n() {
    renderMissionsList(listMissions, lastMissions, { showPoints: true,  showMissionPrefix: true  });
    renderMissionsList(listAround,   lastAround,   { showPoints: false, showMissionPrefix: false });
    renderModelLine(modelEl, lastModel, activeTab === "missions" ? lastMissions : lastAround);
  }

  translateDom(document);
  document.addEventListener("i18n:changed", refreshI18n);

  tabDescEl.setAttribute("data-i18n", "missions.desc.around");
  tabDescEl.textContent = t("missions.desc.around");
  statusEl.textContent = " ";

  // Leaflet map — initialised lazily on first setLocation call
  let leafletMap = null;
  let leafletMarker = null;

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
      renderMissionsList(listMissions, lastMissions, { showPoints: true, showMissionPrefix: true });
      if (activeTab === "missions") renderModelLine(modelEl, lastModel, lastMissions);
    },

    renderAround(species) {
      lastAround = Array.isArray(species) ? species : [];
      renderMissionsList(listAround, lastAround, { showPoints: false, showMissionPrefix: false });
      if (activeTab === "around") renderModelLine(modelEl, "", lastAround);
    },

    onTabSwitch(handler) {
      tabSwitchHandler = handler;
    },

    getActiveTab() {
      return activeTab;
    },

    onSettingsOpen(handler) {
      settingsOpenHandler = handler;
    },

    getSelectedModel() {
      return modelSelect?.value || "best";
    },

    setLocation(lat, lon) {
      locationMapEl.style.display = "";
      if (!leafletMap) {
        leafletMap = L.map(locationMapEl, {
          zoomControl: true,
          attributionControl: false,
          scrollWheelZoom: true,
          touchZoom: true,
          dragging: true,
          doubleClickZoom: true,
          keyboard: false,
        }).setView([lat, lon], 16);
        L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
          maxZoom: 17,
        }).addTo(leafletMap);
        const icon = L.icon({
          iconUrl: "./assets/plantgo_logo2.png",
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40],
        });
        leafletMarker = L.marker([lat, lon], { icon }).addTo(leafletMap);

        // On touch: require 2 fingers to pan, single finger scrolls the page
        leafletMap.dragging.disable();
        locationMapEl.addEventListener("touchstart", (e) => {
          if (e.touches.length >= 2) leafletMap.dragging.enable();
          else leafletMap.dragging.disable();
        }, { passive: true });
        locationMapEl.addEventListener("touchend", () => {
          leafletMap.dragging.disable();
        }, { passive: true });
        // Mouse users keep normal single-click drag
        locationMapEl.addEventListener("mousedown", () => leafletMap.dragging.enable(), { passive: true });
        locationMapEl.addEventListener("mouseup",   () => leafletMap.dragging.disable(), { passive: true });
      } else {
        leafletMap.setView([lat, lon], 16);
        leafletMarker.setLatLng([lat, lon]);
      }
    },

    onLocate(handler) {
      locateBtn.addEventListener("click", handler);
    },

    refreshI18n,
  };
}
