// src/ui/components/ObservationsHistory.view.js
import { ObservationCard } from "../../controllers/ObservationCard.controller.js";
import { t } from "../../language/i18n.js";

function appendToList(listEl, entries) {
  for (const e of entries) listEl.appendChild(ObservationCard(e));
}

export function createObservationsHistoryView() {
  const sec = document.createElement("section");
  sec.className = "herbarium-panel";

  sec.innerHTML = `
    <div id="obsHistoryStatus" class="validation-feedback" aria-live="polite"></div>
    <div id="obsHistoryList" class="obs-history-list"></div>
    <div id="obsHistorySpinner" class="loading-spinner" style="display:none" aria-hidden="true"></div>
    <div id="obsHistorySentinel" class="obs-load-sentinel"></div>
  `;

  const statusEl  = sec.querySelector("#obsHistoryStatus");
  const listEl    = sec.querySelector("#obsHistoryList");
  const spinnerEl = sec.querySelector("#obsHistorySpinner");
  const sentinel  = sec.querySelector("#obsHistorySentinel");

  // All entries accumulated across pages — needed for i18n re-render
  let allEntries = [];

  document.addEventListener("i18n:changed", () => {
    listEl.innerHTML = "";
    if (!allEntries.length) {
      listEl.textContent = t("observations.empty");
    } else {
      appendToList(listEl, allEntries);
    }
  });

  return {
    element: sec,
    sentinel,

    setStatus(text) { statusEl.textContent = text ?? ""; },

    setLoadingMore(loading) {
      spinnerEl.style.display = loading ? "block" : "none";
    },

    clearEntries() {
      allEntries = [];
      listEl.innerHTML = "";
    },

    // First page — clears list first
    renderEntries(entries) {
      allEntries = Array.isArray(entries) ? [...entries] : [];
      listEl.innerHTML = "";
      if (!allEntries.length) {
        listEl.textContent = t("observations.empty");
        return;
      }
      appendToList(listEl, allEntries);
    },

    // Subsequent pages — appends without clearing
    appendEntries(entries) {
      if (!Array.isArray(entries) || !entries.length) return;
      allEntries = [...allEntries, ...entries];
      appendToList(listEl, entries);
    },
  };
}
