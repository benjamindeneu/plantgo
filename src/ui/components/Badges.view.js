// src/ui/components/Badges.view.js
import { t } from "../../language/i18n.js";
import { BADGE_DEFINITIONS } from "../../data/badges.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function createBadgesView() {
  const root = document.createElement("div");
  root.className = "badges-panel";

  // counts = { obs: number, mission: number }
  function render(unlockedSet, counts = {}) {
    root.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "badges-grid";

    for (const def of BADGE_DEFINITIONS) {
      const isUnlocked = unlockedSet.has(def.id);
      const card = document.createElement("div");
      card.className = `badge-card${isUnlocked ? " badge-card--unlocked" : " badge-card--locked"}`;
      card.setAttribute("aria-label", t(def.nameKey));

      let progressHtml = "";
      if (!isUnlocked && def.countKey && def.threshold) {
        const current = Math.min(counts[def.countKey] ?? 0, def.threshold);
        const pct = Math.round((current / def.threshold) * 100);
        progressHtml = `
          <div class="badge-card__progress">
            <div class="badge-card__progress-rail">
              <div class="badge-card__progress-bar" style="width:${pct}%"></div>
            </div>
            <div class="badge-card__progress-label">${current} / ${def.threshold}</div>
          </div>
        `;
      } else if (!isUnlocked) {
        progressHtml = `<div class="badge-card__status badge-card__status--locked">🔒</div>`;
      }

      card.innerHTML = `
        <div class="badge-card__emoji">${def.emoji}</div>
        <div class="badge-card__name">${escapeHtml(t(def.nameKey))}</div>
        <div class="badge-card__desc">${escapeHtml(t(def.descKey))}</div>
        ${isUnlocked ? `<div class="badge-card__status">✓</div>` : progressHtml}
      `;
      grid.appendChild(card);
    }

    root.appendChild(grid);
  }

  document.addEventListener("i18n:changed", () => {
    if (root._lastUnlocked) render(root._lastUnlocked, root._lastCounts);
  });

  return {
    element: root,

    update(unlockedSet, counts = {}) {
      root._lastUnlocked = unlockedSet;
      root._lastCounts = counts;
      render(unlockedSet, counts);
    },

    showLoading() {
      root.textContent = t("badges.loading");
    },

    showError() {
      root.textContent = t("badges.error");
    },
  };
}
