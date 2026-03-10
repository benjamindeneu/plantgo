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

  function render(unlockedSet) {
    root.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "badges-grid";

    for (const def of BADGE_DEFINITIONS) {
      const isUnlocked = unlockedSet.has(def.id);
      const card = document.createElement("div");
      card.className = `badge-card${isUnlocked ? " badge-card--unlocked" : " badge-card--locked"}`;
      card.setAttribute("aria-label", t(def.nameKey));
      card.innerHTML = `
        <div class="badge-card__emoji">${def.emoji}</div>
        <div class="badge-card__name">${escapeHtml(t(def.nameKey))}</div>
        <div class="badge-card__desc">${escapeHtml(t(def.descKey))}</div>
        ${isUnlocked ? `<div class="badge-card__status">✓</div>` : `<div class="badge-card__status badge-card__status--locked">🔒</div>`}
      `;
      grid.appendChild(card);
    }

    root.appendChild(grid);
  }

  document.addEventListener("i18n:changed", () => {
    // Re-render with the last known unlocked set
    if (root._lastUnlocked) render(root._lastUnlocked);
  });

  return {
    element: root,

    update(unlockedSet) {
      root._lastUnlocked = unlockedSet;
      render(unlockedSet);
    },

    showLoading() {
      root.textContent = t("badges.loading");
    },

    showError() {
      root.textContent = t("badges.error");
    },
  };
}
